-- ==============================================================================
-- GADAP Hub - Migração 20261027000000: Captura de DFe e Manifestação SEFAZ (Fase 14)
-- Tabela de Documentos Fiscais de Entrada (inbound_invoices)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.inbound_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    access_key VARCHAR(44) NOT NULL,
    issuer_cnpj VARCHAR(14) NOT NULL,
    issuer_name VARCHAR(255),
    issuer_trade_name VARCHAR(255),
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    manifestation_status VARCHAR(50) NOT NULL DEFAULT 'NOT_MANIFESTED',
    manifestation_date TIMESTAMPTZ,
    manifestation_protocol VARCHAR(100),
    financial_entry_id UUID REFERENCES public.financial_entries(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    issue_date DATE,
    operation_type VARCHAR(50) DEFAULT 'COMPRA_INSUMO',
    xml_data TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inbound_invoices_tenant_access_key UNIQUE (tenant_id, access_key)
);

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_inbound_tenant_status ON public.inbound_invoices(tenant_id, manifestation_status);
CREATE INDEX IF NOT EXISTS idx_inbound_access_key ON public.inbound_invoices(access_key);
CREATE INDEX IF NOT EXISTS idx_inbound_issuer_cnpj ON public.inbound_invoices(issuer_cnpj);
CREATE INDEX IF NOT EXISTS idx_inbound_tenant_project ON public.inbound_invoices(tenant_id, project_id);
CREATE INDEX IF NOT EXISTS idx_inbound_financial_entry ON public.inbound_invoices(financial_entry_id);

-- Row Level Security (RLS) Hermético
ALTER TABLE public.inbound_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_invoices FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inbound_invoices_isolation_select ON public.inbound_invoices;
CREATE POLICY inbound_invoices_isolation_select ON public.inbound_invoices
    FOR SELECT USING (
        tenant_id = (current_setting('app.current_tenant_id', true))::uuid
        OR (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
        OR (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS inbound_invoices_isolation_insert ON public.inbound_invoices;
CREATE POLICY inbound_invoices_isolation_insert ON public.inbound_invoices
    FOR INSERT WITH CHECK (
        tenant_id = (current_setting('app.current_tenant_id', true))::uuid
        OR (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
        OR (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS inbound_invoices_isolation_update ON public.inbound_invoices;
CREATE POLICY inbound_invoices_isolation_update ON public.inbound_invoices
    FOR UPDATE USING (
        tenant_id = (current_setting('app.current_tenant_id', true))::uuid
        OR (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
        OR (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS inbound_invoices_isolation_delete ON public.inbound_invoices;
CREATE POLICY inbound_invoices_isolation_delete ON public.inbound_invoices
    FOR DELETE USING (
        tenant_id = (current_setting('app.current_tenant_id', true))::uuid
        OR (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
        OR (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id
        OR auth.role() = 'service_role'
    );

COMMENT ON TABLE public.inbound_invoices IS 'Documentos Fiscais Eletrônicos de Entrada (DFe NFe) capturados via webservice da SEFAZ com controle de Manifestação do Destinatário e conversão direta em Contas a Pagar.';
