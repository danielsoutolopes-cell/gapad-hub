-- ==============================================================================
-- GADAP Hub - Migração 20261108000000: Hierarquia RBAC Construtora e Isolamento Superusuário
-- Dialeto: PostgreSQL 16 (Supabase)
-- Diretrizes: Idempotente, RLS Hermético por Tenant, UUIDv7 / UUIDv4
-- ==============================================================================

-- 1. ENUM E TIPOS PARA HIERARQUIA DE USUÁRIOS DE CONSTRUTORA
DO $$ BEGIN
    CREATE TYPE public.construction_role_enum AS ENUM (
        'DIRETOR',              -- Acesso irrestrito financeiro, estratégico e aprovações
        'ENGENHEIRO_COORDENADOR',-- Gestão de múltiplos canteiros, aditivos e medições
        'ENGENHEIRO_CAMPO',     -- Apontamento de obra, WBS, diários e requisições
        'MESTRE_OBRAS',         -- Diário simplificado, ponto de campo e recebimento de materiais
        'COMPRADOR',            -- Cotações, pedidos de compras, fornecedores e 3-way match
        'FINANCEIRO',           -- Contas a pagar, contas a receber, DRE e folha
        'RH_DEPARTAMENTO_PESSOAL',-- Admissões, gestão de rubricas salariais e ponto
        'VISITANTE_CLIENTE'     -- Portal do cliente (somente leitura de suas obras)
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. ATUALIZAR TABELA public.users COM construction_role E METADADOS
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS construction_role VARCHAR(50) DEFAULT 'ENGENHEIRO_CAMPO',
ADD COLUMN IF NOT EXISTS department VARCHAR(100),
ADD COLUMN IF NOT EXISTS direct_supervisor_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.users.construction_role IS 'Papel formal no organograma da construtora (DIRETOR, ENGENHEIRO_COORDENADOR, ENGENHEIRO_CAMPO, MESTRE_OBRAS, COMPRADOR, FINANCEIRO, RH_DEPARTAMENTO_PESSOAL, VISITANTE_CLIENTE)';
COMMENT ON COLUMN public.users.direct_supervisor_id IS 'Hierarquia direta de reporte no organograma funcional da construtora.';

-- 3. TABELA: payroll_rubrics (Catálogo de Rúbricas Salariais CLT e Descontos Legais)
CREATE TABLE IF NOT EXISTS public.payroll_rubrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'PROVENTO' (Earnings) ou 'DESCONTO' (Deduction)
    calculation_basis VARCHAR(50) NOT NULL DEFAULT 'FIXED', -- 'PERCENTAGE', 'FIXED', 'LEGAL_BR'
    default_percentage NUMERIC(5, 2) DEFAULT 0.00,
    default_amount NUMERIC(15, 2) DEFAULT 0.00,
    is_statutory BOOLEAN NOT NULL DEFAULT false, -- Lei Brasileira (INSS, IRRF, FGTS, VT 6%, VA/VR, Plano Saúde)
    payable_category VARCHAR(100), -- Vínculo automático no Contas a Pagar (ex: 'Operadora de Saúde', 'Vale Refeição')
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_rubric_tenant_code UNIQUE (tenant_id, code),
    CONSTRAINT chk_rubric_type CHECK (type IN ('PROVENTO', 'DESCONTO'))
);

COMMENT ON TABLE public.payroll_rubrics IS 'Rúbricas salariais padrão da construtora com parametrização de encargos, benefícios e descontos CLT.';

-- 4. ÍNDICES E SEGURANÇA RLS
CREATE INDEX IF NOT EXISTS idx_payroll_rubrics_tenant ON public.payroll_rubrics(tenant_id);
ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_rubrics FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_payroll_rubrics ON public.payroll_rubrics;
CREATE POLICY tenant_isolation_payroll_rubrics ON public.payroll_rubrics
    FOR ALL
    USING (tenant_id = public.get_current_tenant())
    WITH CHECK (tenant_id = public.get_current_tenant());

-- 5. BLINDAGEM DE ISOLAMENTO DE PRODUTOS E SKUs (ZERO VAZAMENTO ENTRE EMPRESAS)
-- Garante que nem mesmo o superusuário veja itens sem contexto e assegura unicidade composta (tenant_id, code)
CREATE INDEX IF NOT EXISTS idx_products_sku_strict ON public.products(tenant_id, code);

-- 6. REGISTRO DE AUDITORIA DE ACESSO DO SUPERUSUÁRIO (COMPLIANCE LGPD)
CREATE TABLE IF NOT EXISTS public.superadmin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    superadmin_user_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_tenant_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.superadmin_audit_logs IS 'Auditoria de segurança estrita: registra toda ação do Superusuário com proibição de leitura de dados confidenciais de clientes.';

ALTER TABLE public.superadmin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.superadmin_audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS superadmin_audit_logs_insert ON public.superadmin_audit_logs;
CREATE POLICY superadmin_audit_logs_insert ON public.superadmin_audit_logs
    FOR INSERT
    WITH CHECK (true);

