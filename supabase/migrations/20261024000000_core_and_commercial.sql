-- ==============================================================================
-- GADAP Hub ERP - Migração Inicial (Core & Comercial)
-- Versão: 1.0.0
-- Dialeto: PostgreSQL 16 (Supabase)
-- Diretrizes: Idempotente, Snake_case, UUID v4, RLS Hermético
-- ==============================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. FUNÇÃO CANÔNICA DE EXTRAÇÃO DE TENANT (RLS)
-- Extrai o tenant_id do payload app_metadata contido no JWT assinado pelo Supabase Auth.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_current_tenant()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(
        (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id'),
        ''
    )::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_current_tenant() IS 'Retorna o UUID do tenant_id autenticado a partir do token JWT (app_metadata.tenant_id).';

-- ==============================================================================
-- 3. FUNÇÃO DE GATILHO DE AUDITORIA (updated_at)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 4. TABELA: companies (Empresas / Tenants)
-- Entidade raiz do ecossistema multi-tenant.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(14) NOT NULL,
    state_registration VARCHAR(30),
    municipal_registration VARCHAR(30),
    tax_regime VARCHAR(50) NOT NULL DEFAULT 'simples_nacional',
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    address_street VARCHAR(255),
    address_number VARCHAR(30),
    address_complement VARCHAR(100),
    address_neighborhood VARCHAR(100),
    address_city VARCHAR(100),
    address_state VARCHAR(2),
    address_zip_code VARCHAR(10),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_companies_tax_regime CHECK (
        tax_regime IN ('mei', 'simples_nacional', 'lucro_presumido', 'lucro_real')
    ),
    CONSTRAINT uq_companies_cnpj UNIQUE (cnpj)
);

COMMENT ON TABLE public.companies IS 'Empresas e pessoas jurídicas cadastradas como tenants no GADAP Hub.';

-- Trigger de updated_at para companies
DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at
    BEFORE UPDATE ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 5. TABELA: users (Usuários vinculados a companies)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    role VARCHAR(50) NOT NULL DEFAULT 'operador',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_users_role CHECK (
        role IN ('admin', 'diretor', 'engenheiro', 'financeiro', 'fiscal', 'operador')
    ),
    CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email)
);

COMMENT ON TABLE public.users IS 'Usuários do GADAP Hub associados a um tenant e integrados ao auth.users.';

-- Trigger de updated_at para users
DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 6. TABELA: clients (Clientes das Obras / Contratantes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    person_type VARCHAR(2) NOT NULL DEFAULT 'PJ',
    document VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    state_registration VARCHAR(30),
    municipal_registration VARCHAR(30),
    email VARCHAR(255),
    phone VARCHAR(30),
    address_street VARCHAR(255),
    address_number VARCHAR(30),
    address_complement VARCHAR(100),
    address_neighborhood VARCHAR(100),
    address_city VARCHAR(100),
    address_state VARCHAR(2),
    address_zip_code VARCHAR(10),
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_clients_person_type CHECK (person_type IN ('PF', 'PJ')),
    CONSTRAINT uq_clients_tenant_document UNIQUE (tenant_id, document)
);

COMMENT ON TABLE public.clients IS 'Clientes e contratantes das obras para cada tenant.';

-- Trigger de updated_at para clients
DROP TRIGGER IF EXISTS trg_clients_updated_at ON public.clients;
CREATE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 7. TABELA: projects (Obras e Projetos de Engenharia)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    code VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cno VARCHAR(20),
    art_rrt VARCHAR(50),
    contract_value NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    technical_retention_perc NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
    address_street VARCHAR(255),
    address_number VARCHAR(30),
    address_complement VARCHAR(100),
    address_neighborhood VARCHAR(100),
    address_city VARCHAR(100),
    address_state VARCHAR(2),
    address_zip_code VARCHAR(10),
    start_date DATE,
    expected_end_date DATE,
    actual_end_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'planejamento',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_projects_status CHECK (
        status IN ('planejamento', 'em_andamento', 'paralisada', 'concluida', 'cancelada')
    ),
    CONSTRAINT chk_projects_contract_value CHECK (contract_value >= 0),
    CONSTRAINT chk_projects_retention CHECK (technical_retention_perc >= 0 AND technical_retention_perc <= 100)
);

COMMENT ON TABLE public.projects IS 'Obras, canteiros e projetos civis vinculados a clientes e geridos pelo tenant.';

-- Trigger de updated_at para projects
DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 8. ÍNDICES DE PERFORMANCE E ISOLAMENTO
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON public.companies(cnpj);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_auth ON public.users(tenant_id, auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON public.users(tenant_id, email);

CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON public.clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_document ON public.clients(tenant_id, document);

CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON public.projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_client ON public.projects(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_status ON public.projects(tenant_id, status);

-- ==============================================================================
-- 9. HABILITAÇÃO COMPULSÓRIA DE ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies FORCE ROW LEVEL SECURITY;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients FORCE ROW LEVEL SECURITY;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;

-- ==============================================================================
-- 10. POLÍTICAS DE RLS (POLICIES) - ISOLAMENTO HERMÉTICO MULTI-TENANT
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Políticas para: companies
-- O próprio tenant só acessa o registro de sua própria empresa.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS companies_isolation_select ON public.companies;
CREATE POLICY companies_isolation_select ON public.companies
    FOR SELECT
    USING (id = public.get_current_tenant());

DROP POLICY IF EXISTS companies_isolation_insert ON public.companies;
CREATE POLICY companies_isolation_insert ON public.companies
    FOR INSERT
    WITH CHECK (id = public.get_current_tenant());

DROP POLICY IF EXISTS companies_isolation_update ON public.companies;
CREATE POLICY companies_isolation_update ON public.companies
    FOR UPDATE
    USING (id = public.get_current_tenant())
    WITH CHECK (id = public.get_current_tenant());

DROP POLICY IF EXISTS companies_isolation_delete ON public.companies;
CREATE POLICY companies_isolation_delete ON public.companies
    FOR DELETE
    USING (id = public.get_current_tenant());

-- ------------------------------------------------------------------------------
-- Políticas para: users
-- Acesso restrito aos usuários do mesmo tenant_id.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS users_isolation_select ON public.users;
CREATE POLICY users_isolation_select ON public.users
    FOR SELECT
    USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS users_isolation_insert ON public.users;
CREATE POLICY users_isolation_insert ON public.users
    FOR INSERT
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS users_isolation_update ON public.users;
CREATE POLICY users_isolation_update ON public.users
    FOR UPDATE
    USING (tenant_id = public.get_current_tenant())
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS users_isolation_delete ON public.users;
CREATE POLICY users_isolation_delete ON public.users
    FOR DELETE
    USING (tenant_id = public.get_current_tenant());

-- ------------------------------------------------------------------------------
-- Políticas para: clients
-- Acesso restrito aos clientes cadastrados pelo mesmo tenant_id.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS clients_isolation_select ON public.clients;
CREATE POLICY clients_isolation_select ON public.clients
    FOR SELECT
    USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS clients_isolation_insert ON public.clients;
CREATE POLICY clients_isolation_insert ON public.clients
    FOR INSERT
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS clients_isolation_update ON public.clients;
CREATE POLICY clients_isolation_update ON public.clients
    FOR UPDATE
    USING (tenant_id = public.get_current_tenant())
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS clients_isolation_delete ON public.clients;
CREATE POLICY clients_isolation_delete ON public.clients
    FOR DELETE
    USING (tenant_id = public.get_current_tenant());

-- ------------------------------------------------------------------------------
-- Políticas para: projects
-- Acesso restrito às obras/projetos do mesmo tenant_id.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS projects_isolation_select ON public.projects;
CREATE POLICY projects_isolation_select ON public.projects
    FOR SELECT
    USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS projects_isolation_insert ON public.projects;
CREATE POLICY projects_isolation_insert ON public.projects
    FOR INSERT
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS projects_isolation_update ON public.projects;
CREATE POLICY projects_isolation_update ON public.projects
    FOR UPDATE
    USING (tenant_id = public.get_current_tenant())
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS projects_isolation_delete ON public.projects;
CREATE POLICY projects_isolation_delete ON public.projects
    FOR DELETE
    USING (tenant_id = public.get_current_tenant());
