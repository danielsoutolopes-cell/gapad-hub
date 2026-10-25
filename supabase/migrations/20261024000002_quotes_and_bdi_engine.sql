-- ==============================================================================
-- GADAP Hub ERP - Migração: Motor de Orçamentos e Cálculo de BDI
-- Tabelas: quotes (Orçamentos) e quote_items (Itens do Orçamento)
-- Versão: 1.2.0
-- Dialeto: PostgreSQL 16+ (Supabase)
-- Requisitos: Chaves Primárias UUIDv7, tenant_id compulsório, RLS FORCE
-- ==============================================================================

-- ==============================================================================
-- 1. TABELA: quotes (Propostas Comerciais e Orçamentos com BDI)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID PRIMARY KEY DEFAULT public.gen_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    code VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    -- Parâmetros do BDI analítico (em taxas decimais)
    ac_rate NUMERIC(7, 4) NOT NULL DEFAULT 0.0400, -- Administração Central
    s_rate NUMERIC(7, 4) NOT NULL DEFAULT 0.0080,  -- Seguros
    r_rate NUMERIC(7, 4) NOT NULL DEFAULT 0.0120,  -- Riscos e Imprevistos
    g_rate NUMERIC(7, 4) NOT NULL DEFAULT 0.0040,  -- Garantias
    df_rate NUMERIC(7, 4) NOT NULL DEFAULT 0.0100, -- Despesas Financeiras
    l_rate NUMERIC(7, 4) NOT NULL DEFAULT 0.0800,  -- Lucro Bruto
    i_rate NUMERIC(7, 4) NOT NULL DEFAULT 0.0865,  -- Tributos Faturamento (ISS/PIS/COFINS ou IBS/CBS)
    bdi_multiplier NUMERIC(8, 6) NOT NULL DEFAULT 0.000000, -- Multiplicador BDI calculado
    -- Totais Consolidados (NUMERIC 18, 4)
    total_cost NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    total_products_cost NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    total_services_cost NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    bdi_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    discount_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    grand_total NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    valid_until DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_quotes_status CHECK (
        status IN ('draft', 'sent', 'approved', 'rejected', 'converted')
    ),
    CONSTRAINT chk_quotes_totals CHECK (
        total_cost >= 0 AND grand_total >= 0 AND discount_amount >= 0
    ),
    CONSTRAINT uq_quotes_tenant_code UNIQUE (tenant_id, code)
);

COMMENT ON TABLE public.quotes IS 'Orçamentos e propostas comerciais técnicas com composição de BDI analítico.';

-- Trigger de updated_at para quotes
DROP TRIGGER IF EXISTS trg_quotes_updated_at ON public.quotes;
CREATE TRIGGER trg_quotes_updated_at
    BEFORE UPDATE ON public.quotes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 2. TABELA: quote_items (Itens de Composição: Materiais e Serviços)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.quote_items (
    id UUID PRIMARY KEY DEFAULT public.gen_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
    item_type VARCHAR(10) NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    description VARCHAR(255) NOT NULL,
    unit_of_measure VARCHAR(10) NOT NULL,
    quantity NUMERIC(18, 4) NOT NULL,
    unit_cost NUMERIC(18, 4) NOT NULL,
    bdi_rate NUMERIC(7, 4) NOT NULL DEFAULT 0.0000,
    unit_price NUMERIC(18, 4) NOT NULL,
    total_cost NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    total_price NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_quote_items_type CHECK (item_type IN ('product', 'service')),
    CONSTRAINT chk_quote_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_quote_items_costs CHECK (unit_cost >= 0 AND unit_price >= 0)
);

COMMENT ON TABLE public.quote_items IS 'Linhas de composição físico-financeira do orçamento (produtos e serviços).';

-- Trigger de updated_at para quote_items
DROP TRIGGER IF EXISTS trg_quote_items_updated_at ON public.quote_items;
CREATE TRIGGER trg_quote_items_updated_at
    BEFORE UPDATE ON public.quote_items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 3. ATIVAÇÃO DE ROW LEVEL SECURITY (RLS) FORÇADO
-- ==============================================================================
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items FORCE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 4. POLÍTICAS RLS: quotes
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS quotes_isolation_select ON public.quotes;
CREATE POLICY quotes_isolation_select ON public.quotes
    FOR SELECT
    USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS quotes_isolation_insert ON public.quotes;
CREATE POLICY quotes_isolation_insert ON public.quotes
    FOR INSERT
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS quotes_isolation_update ON public.quotes;
CREATE POLICY quotes_isolation_update ON public.quotes
    FOR UPDATE
    USING (tenant_id = public.get_current_tenant())
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS quotes_isolation_delete ON public.quotes;
CREATE POLICY quotes_isolation_delete ON public.quotes
    FOR DELETE
    USING (tenant_id = public.get_current_tenant());

-- ------------------------------------------------------------------------------
-- 5. POLÍTICAS RLS: quote_items
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS quote_items_isolation_select ON public.quote_items;
CREATE POLICY quote_items_isolation_select ON public.quote_items
    FOR SELECT
    USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS quote_items_isolation_insert ON public.quote_items;
CREATE POLICY quote_items_isolation_insert ON public.quote_items
    FOR INSERT
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS quote_items_isolation_update ON public.quote_items;
CREATE POLICY quote_items_isolation_update ON public.quote_items
    FOR UPDATE
    USING (tenant_id = public.get_current_tenant())
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS quote_items_isolation_delete ON public.quote_items;
CREATE POLICY quote_items_isolation_delete ON public.quote_items
    FOR DELETE
    USING (tenant_id = public.get_current_tenant());

-- ==============================================================================
-- 6. ÍNDICES DE PERFORMANCE B-TREE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_status ON public.quotes (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_code ON public.quotes (tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_client ON public.quotes (tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_tenant_quote ON public.quote_items (tenant_id, quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_product ON public.quote_items (product_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_service ON public.quote_items (service_id);
