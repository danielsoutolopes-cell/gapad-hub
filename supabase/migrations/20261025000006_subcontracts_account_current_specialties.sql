-- ==============================================================================
-- GADAP Hub - Migração 20261025000006: Subcontratos - Conta Corrente e Campos de Atuação
-- Fase 13: Gestão de Terceirizados, Especialidades, Conta Corrente e Farol de Risco
-- Tabelas: suppliers (alter), specialties, supplier_specialties, subcontract_transactions
-- Dialeto: PostgreSQL 16+ (Supabase)
-- ==============================================================================

-- 1. ALTER TABLE: suppliers (Adicionar flag is_subcontractor)
ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS is_subcontractor BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_suppliers_is_subcontractor 
ON public.suppliers(tenant_id, is_subcontractor);

COMMENT ON COLUMN public.suppliers.is_subcontractor IS 'Indica se o fornecedor atua como subempreiteiro/prestador de serviços em canteiro.';


-- ==============================================================================
-- 2. TABELA: specialties (Especialidades de Serviços da Construção Civil)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.specialties (
    id UUID PRIMARY KEY DEFAULT public.gen_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_specialties_tenant_name UNIQUE (tenant_id, name)
);

COMMENT ON TABLE public.specialties IS 'Catálogo de especialidades técnicas de engenharia (ex: Elétrica, Hidráulica, Alvenaria, Pintura).';

-- Índices
CREATE INDEX IF NOT EXISTS idx_specialties_tenant ON public.specialties(tenant_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_specialties_updated_at ON public.specialties;
CREATE TRIGGER trg_specialties_updated_at
    BEFORE UPDATE ON public.specialties
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialties FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS specialties_isolation_select ON public.specialties;
CREATE POLICY specialties_isolation_select ON public.specialties
    FOR SELECT USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS specialties_isolation_insert ON public.specialties;
CREATE POLICY specialties_isolation_insert ON public.specialties
    FOR INSERT WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS specialties_isolation_update ON public.specialties;
CREATE POLICY specialties_isolation_update ON public.specialties
    FOR UPDATE USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS specialties_isolation_delete ON public.specialties;
CREATE POLICY specialties_isolation_delete ON public.specialties
    FOR DELETE USING (tenant_id = public.get_current_tenant());


-- ==============================================================================
-- 3. TABELA: supplier_specialties (Vínculo Fornecedor <-> Especialidades)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.supplier_specialties (
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (supplier_id, specialty_id)
);

COMMENT ON TABLE public.supplier_specialties IS 'Mapeamento de quais especialidades o subempreiteiro executa (campos de atuação).';

-- Índices
CREATE INDEX IF NOT EXISTS idx_supp_spec_tenant ON public.supplier_specialties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_supp_spec_specialty ON public.supplier_specialties(specialty_id);

-- RLS
ALTER TABLE public.supplier_specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_specialties FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_specialties_isolation_select ON public.supplier_specialties;
CREATE POLICY supplier_specialties_isolation_select ON public.supplier_specialties
    FOR SELECT USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS supplier_specialties_isolation_insert ON public.supplier_specialties;
CREATE POLICY supplier_specialties_isolation_insert ON public.supplier_specialties
    FOR INSERT WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS supplier_specialties_isolation_delete ON public.supplier_specialties;
CREATE POLICY supplier_specialties_isolation_delete ON public.supplier_specialties
    FOR DELETE USING (tenant_id = public.get_current_tenant());


-- ==============================================================================
-- 4. TABELA: subcontract_transactions (Conta Corrente do Terceirizado)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subcontract_transactions (
    id UUID PRIMARY KEY DEFAULT public.gen_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    subcontract_id UUID NOT NULL REFERENCES public.subcontracts(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    observation TEXT,
    financial_entry_id UUID REFERENCES public.financial_entries(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_subcontract_tx_type CHECK (type IN ('PAYMENT', 'MEASUREMENT')),
    CONSTRAINT chk_subcontract_tx_amount CHECK (amount >= 0)
);

COMMENT ON TABLE public.subcontract_transactions IS 'Conta corrente do subcontrato: registra cada desembolso (PAYMENT) e cada avanço medido (MEASUREMENT) para o farol de risco.';

-- Índices
CREATE INDEX IF NOT EXISTS idx_sub_tx_tenant ON public.subcontract_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_tx_subcontract ON public.subcontract_transactions(subcontract_id);
CREATE INDEX IF NOT EXISTS idx_sub_tx_date ON public.subcontract_transactions(subcontract_id, date);
CREATE INDEX IF NOT EXISTS idx_sub_tx_type ON public.subcontract_transactions(subcontract_id, type);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_subcontract_tx_updated_at ON public.subcontract_transactions;
CREATE TRIGGER trg_subcontract_tx_updated_at
    BEFORE UPDATE ON public.subcontract_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.subcontract_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontract_transactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subcontract_transactions_isolation_select ON public.subcontract_transactions;
CREATE POLICY subcontract_transactions_isolation_select ON public.subcontract_transactions
    FOR SELECT USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS subcontract_transactions_isolation_insert ON public.subcontract_transactions;
CREATE POLICY subcontract_transactions_isolation_insert ON public.subcontract_transactions
    FOR INSERT WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS subcontract_transactions_isolation_update ON public.subcontract_transactions;
CREATE POLICY subcontract_transactions_isolation_update ON public.subcontract_transactions
    FOR UPDATE USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS subcontract_transactions_isolation_delete ON public.subcontract_transactions;
CREATE POLICY subcontract_transactions_isolation_delete ON public.subcontract_transactions
    FOR DELETE USING (tenant_id = public.get_current_tenant());
