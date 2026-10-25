-- ==============================================================================
-- GADAP Hub - Migração 20261025000005: Subcontratos, Medições e Compliance Trabalhista
-- Fase 13: Gestão de Terceirizados, Passivo Trabalhista e Retenções Fiscais
-- Tabelas: subcontracts, sub_measurements, compliance_documents
-- Dialeto: PostgreSQL 16+ (Supabase)
-- Requisitos: UUIDv7, tenant_id compulsório, RLS FORCE em todas as tabelas
-- ==============================================================================

-- ==============================================================================
-- 1. TABELA: subcontracts (Contratos de Empreitada e Subempreiteiros)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subcontracts (
    id UUID PRIMARY KEY DEFAULT public.gen_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    contract_number VARCHAR(50),
    scope_description TEXT NOT NULL,
    total_value NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    technical_retention_percentage NUMERIC(7, 4) NOT NULL DEFAULT 0.0500, -- Ex: 5% a 10%
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_subcontracts_total_value CHECK (total_value >= 0),
    CONSTRAINT chk_subcontracts_retention_perc CHECK (technical_retention_percentage >= 0 AND technical_retention_percentage <= 1.0000),
    CONSTRAINT chk_subcontracts_status CHECK (
        status IN ('active', 'suspended', 'completed', 'terminated', 'draft')
    )
);

COMMENT ON TABLE public.subcontracts IS 'Contratos de terceirizados, subempreiteiras e prestadores de mão de obra vinculados às obras.';
COMMENT ON COLUMN public.subcontracts.technical_retention_percentage IS 'Percentual de retenção técnica contratual como garantia de entrega da obra (ex: 0.0500 para 5%).';

-- Índices
CREATE INDEX IF NOT EXISTS idx_subcontracts_tenant ON public.subcontracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subcontracts_project ON public.subcontracts(tenant_id, project_id);
CREATE INDEX IF NOT EXISTS idx_subcontracts_supplier ON public.subcontracts(tenant_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_subcontracts_status ON public.subcontracts(tenant_id, status);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_subcontracts_updated_at ON public.subcontracts;
CREATE TRIGGER trg_subcontracts_updated_at
    BEFORE UPDATE ON public.subcontracts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.subcontracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontracts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subcontracts_isolation_select ON public.subcontracts;
CREATE POLICY subcontracts_isolation_select ON public.subcontracts
    FOR SELECT USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS subcontracts_isolation_insert ON public.subcontracts;
CREATE POLICY subcontracts_isolation_insert ON public.subcontracts
    FOR INSERT WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS subcontracts_isolation_update ON public.subcontracts;
CREATE POLICY subcontracts_isolation_update ON public.subcontracts
    FOR UPDATE USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS subcontracts_isolation_delete ON public.subcontracts;
CREATE POLICY subcontracts_isolation_delete ON public.subcontracts
    FOR DELETE USING (tenant_id = public.get_current_tenant());


-- ==============================================================================
-- 2. TABELA: sub_measurements (Medições Físico-Financeiras de Terceirizados)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.sub_measurements (
    id UUID PRIMARY KEY DEFAULT public.gen_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    subcontract_id UUID NOT NULL REFERENCES public.subcontracts(id) ON DELETE CASCADE,
    measurement_number INT NOT NULL DEFAULT 1,
    measured_value NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    technical_retention_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    inss_retention_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    iss_retention_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    tax_withholding_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000, -- Soma de todas as retenções tributárias
    net_payable_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    invoice_url TEXT,
    measurement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    financial_entry_id UUID REFERENCES public.financial_entries(id) ON DELETE SET NULL,
    compliance_checked_at TIMESTAMPTZ,
    compliance_checked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_sub_measurements_values CHECK (
        measured_value >= 0 AND 
        technical_retention_amount >= 0 AND 
        inss_retention_amount >= 0 AND 
        iss_retention_amount >= 0 AND 
        net_payable_amount >= 0
    ),
    CONSTRAINT chk_sub_measurements_status CHECK (
        status IN ('draft', 'pending_documents', 'compliance_approved', 'approved', 'paid', 'rejected')
    )
);

COMMENT ON TABLE public.sub_measurements IS 'Boletins de medição de serviços de subempreiteiros com cálculo de retenções fiscais e técnicas.';
COMMENT ON COLUMN public.sub_measurements.financial_entry_id IS 'Vínculo com o Contas a Pagar gerado automaticamente após validação do compliance e retenções.';

-- Índices
CREATE INDEX IF NOT EXISTS idx_sub_measurements_tenant ON public.sub_measurements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_measurements_subcontract ON public.sub_measurements(subcontract_id);
CREATE INDEX IF NOT EXISTS idx_sub_measurements_status ON public.sub_measurements(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sub_measurements_fin_entry ON public.sub_measurements(financial_entry_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_sub_measurements_updated_at ON public.sub_measurements;
CREATE TRIGGER trg_sub_measurements_updated_at
    BEFORE UPDATE ON public.sub_measurements
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.sub_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_measurements FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sub_measurements_isolation_select ON public.sub_measurements;
CREATE POLICY sub_measurements_isolation_select ON public.sub_measurements
    FOR SELECT USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS sub_measurements_isolation_insert ON public.sub_measurements;
CREATE POLICY sub_measurements_isolation_insert ON public.sub_measurements
    FOR INSERT WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS sub_measurements_isolation_update ON public.sub_measurements;
CREATE POLICY sub_measurements_isolation_update ON public.sub_measurements
    FOR UPDATE USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS sub_measurements_isolation_delete ON public.sub_measurements;
CREATE POLICY sub_measurements_isolation_delete ON public.sub_measurements
    FOR DELETE USING (tenant_id = public.get_current_tenant());


-- ==============================================================================
-- 3. TABELA: compliance_documents (Documentos de Regularidade Trabalhista e Previdenciária)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.compliance_documents (
    id UUID PRIMARY KEY DEFAULT public.gen_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    sub_measurement_id UUID NOT NULL REFERENCES public.sub_measurements(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- 'GFIP', 'CND', 'FGTS', 'FOLHA_PAGAMENTO', 'ASO', 'OUTROS'
    file_url TEXT NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_compliance_doc_type CHECK (
        document_type IN ('GFIP', 'CND', 'FGTS', 'FOLHA_PAGAMENTO', 'ASO', 'OUTROS')
    )
);

COMMENT ON TABLE public.compliance_documents IS 'Documentos comprobatórios de quitação previdenciária e trabalhista exigidos antes de pagar medições de terceirizados.';
COMMENT ON COLUMN public.compliance_documents.is_verified IS 'Indicador de auditoria humana ou IA: deve ser true para liberar a geração do Contas a Pagar.';

-- Índices
CREATE INDEX IF NOT EXISTS idx_compliance_docs_tenant ON public.compliance_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_sub_measurement ON public.compliance_documents(sub_measurement_id);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_verified ON public.compliance_documents(sub_measurement_id, is_verified);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_compliance_documents_updated_at ON public.compliance_documents;
CREATE TRIGGER trg_compliance_documents_updated_at
    BEFORE UPDATE ON public.compliance_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compliance_documents_isolation_select ON public.compliance_documents;
CREATE POLICY compliance_documents_isolation_select ON public.compliance_documents
    FOR SELECT USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS compliance_documents_isolation_insert ON public.compliance_documents;
CREATE POLICY compliance_documents_isolation_insert ON public.compliance_documents
    FOR INSERT WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS compliance_documents_isolation_update ON public.compliance_documents;
CREATE POLICY compliance_documents_isolation_update ON public.compliance_documents
    FOR UPDATE USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS compliance_documents_isolation_delete ON public.compliance_documents;
CREATE POLICY compliance_documents_isolation_delete ON public.compliance_documents
    FOR DELETE USING (tenant_id = public.get_current_tenant());
