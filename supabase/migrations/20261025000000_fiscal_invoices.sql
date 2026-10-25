-- ==============================================================================
-- GADAP Hub - Migração 20261025000000: Documentos Fiscais e NFS-e Padrão Nacional
-- ==============================================================================

-- 1. Criação da Tabela de Documentos Fiscais (fiscal_invoices)
CREATE TABLE IF NOT EXISTS public.fiscal_invoices (
    id UUID PRIMARY KEY DEFAULT public.gen_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    measurement_id UUID REFERENCES public.medicoes(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    invoice_type VARCHAR(50) NOT NULL DEFAULT 'NFSE_NACIONAL',
    environment VARCHAR(20) NOT NULL DEFAULT 'homologacao',
    number BIGINT NOT NULL,
    series VARCHAR(10) NOT NULL DEFAULT '1',
    access_key VARCHAR(60) NOT NULL,
    dps_number BIGINT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'autorizada',
    protocol_number VARCHAR(100),
    authorized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    provider_cnpj VARCHAR(14) NOT NULL,
    provider_city_ibge VARCHAR(7) NOT NULL,
    taker_document VARCHAR(14) NOT NULL,
    taker_name VARCHAR(255) NOT NULL,
    construction_city_ibge VARCHAR(7) NOT NULL,
    service_code_lc116 VARCHAR(20) NOT NULL DEFAULT '07.02',
    service_description TEXT NOT NULL,
    gross_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    deductions_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    calculation_base NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    iss_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    iss_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    iss_retained BOOLEAN NOT NULL DEFAULT false,
    iss_retained_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    inss_retained_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    irrf_retained_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    csll_retained_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    pis_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    cofins_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    net_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    cno VARCHAR(20),
    art VARCHAR(50),
    xml_url TEXT,
    pdf_url TEXT,
    xml_raw TEXT,
    whatsapp_notification_sent BOOLEAN NOT NULL DEFAULT false,
    whatsapp_recipient VARCHAR(30),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_fiscal_amounts CHECK (gross_amount >= 0 AND calculation_base >= 0 AND net_amount >= 0),
    CONSTRAINT chk_fiscal_status CHECK (status IN ('rascunho', 'transmitindo', 'autorizada', 'cancelada', 'rejeitada')),
    CONSTRAINT uq_fiscal_tenant_access_key UNIQUE (tenant_id, access_key)
);

COMMENT ON TABLE public.fiscal_invoices IS 'Registro oficial de notas fiscais emitidas (NFS-e Padrão Nacional e NF-e) vinculadas a medições e obras.';

-- 2. Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_fiscal_tenant_status ON public.fiscal_invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_fiscal_tenant_project ON public.fiscal_invoices(tenant_id, project_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_tenant_measurement ON public.fiscal_invoices(tenant_id, measurement_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_tenant_client ON public.fiscal_invoices(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_access_key ON public.fiscal_invoices(access_key);
CREATE INDEX IF NOT EXISTS idx_fiscal_authorized_at ON public.fiscal_invoices(tenant_id, authorized_at DESC);

-- 3. Trigger de updated_at para auditoria
DROP TRIGGER IF EXISTS trg_fiscal_invoices_updated_at ON public.fiscal_invoices;
CREATE TRIGGER trg_fiscal_invoices_updated_at
    BEFORE UPDATE ON public.fiscal_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. Habilitação e Forçamento Rigoroso de RLS
ALTER TABLE public.fiscal_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_invoices FORCE ROW LEVEL SECURITY;

-- 5. Políticas de Isolamento por Tenant
DROP POLICY IF EXISTS fiscal_invoices_isolation_select ON public.fiscal_invoices;
CREATE POLICY fiscal_invoices_isolation_select ON public.fiscal_invoices
    FOR SELECT
    USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS fiscal_invoices_isolation_insert ON public.fiscal_invoices;
CREATE POLICY fiscal_invoices_isolation_insert ON public.fiscal_invoices
    FOR INSERT
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS fiscal_invoices_isolation_update ON public.fiscal_invoices;
CREATE POLICY fiscal_invoices_isolation_update ON public.fiscal_invoices
    FOR UPDATE
    USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS fiscal_invoices_isolation_delete ON public.fiscal_invoices;
CREATE POLICY fiscal_invoices_isolation_delete ON public.fiscal_invoices
    FOR DELETE
    USING (tenant_id = public.get_current_tenant());
