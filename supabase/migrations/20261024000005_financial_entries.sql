-- ==============================================================================
-- GADAP Hub - Migração 20261024000005: Lançamentos Financeiros (financial_entries)
-- Módulo Financeiro: Contas a Receber (Medições) e Contas a Pagar (Insumos/Fornecedores)
-- ==============================================================================

-- 1. Criação da Tabela de Lançamentos Financeiros
CREATE TABLE IF NOT EXISTS public.financial_entries (
    id UUID PRIMARY KEY DEFAULT public.gen_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    measurement_id UUID REFERENCES public.medicoes(id) ON DELETE SET NULL,
    entry_type VARCHAR(20) NOT NULL,
    description VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'geral',
    nominal_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    technical_retention_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    discount_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    interest_penalty_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    net_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    status VARCHAR(50) NOT NULL DEFAULT 'pendente',
    due_date DATE NOT NULL,
    payment_date DATE,
    document_number VARCHAR(100),
    document_type VARCHAR(50) DEFAULT 'boleto',
    pix_code TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_financial_nominal CHECK (nominal_amount >= 0),
    CONSTRAINT chk_financial_net CHECK (net_amount >= 0),
    CONSTRAINT chk_financial_retention CHECK (technical_retention_amount >= 0),
    CONSTRAINT chk_financial_entry_type CHECK (
        entry_type IN ('receivable', 'payable', 'RECEIVABLE', 'PAYABLE', 'a_receber', 'a_pagar')
    ),
    CONSTRAINT chk_financial_status CHECK (
        status IN ('pendente', 'pago', 'atrasado', 'cancelado', 'pending', 'paid', 'overdue', 'cancelled')
    )
);

COMMENT ON TABLE public.financial_entries IS 'Lançamentos financeiros de Contas a Pagar e Contas a Receber com apropriação por obra, medição e centro de custo.';
COMMENT ON COLUMN public.financial_entries.entry_type IS 'Tipo do lançamento financeiro: receivable (a receber) ou payable (a pagar).';
COMMENT ON COLUMN public.financial_entries.nominal_amount IS 'Valor nominal bruto do título/fatura.';
COMMENT ON COLUMN public.financial_entries.technical_retention_amount IS 'Valor retido como retenção técnica de engenharia (quando aplicável).';
COMMENT ON COLUMN public.financial_entries.net_amount IS 'Valor líquido do lançamento (nominal - retencao - descontos + juros/multa).';

-- 2. Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_financial_tenant_type ON public.financial_entries(tenant_id, entry_type);
CREATE INDEX IF NOT EXISTS idx_financial_tenant_status ON public.financial_entries(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_financial_tenant_project ON public.financial_entries(tenant_id, project_id);
CREATE INDEX IF NOT EXISTS idx_financial_tenant_due_date ON public.financial_entries(tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_financial_measurement ON public.financial_entries(measurement_id);

-- 3. Trigger de updated_at para auditoria
DROP TRIGGER IF EXISTS trg_financial_entries_updated_at ON public.financial_entries;
CREATE TRIGGER trg_financial_entries_updated_at
    BEFORE UPDATE ON public.financial_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. Habilitação e Forçamento Rigoroso de RLS (Row Level Security)
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_entries FORCE ROW LEVEL SECURITY;

-- 5. Políticas de Isolamento Hermético por Tenant
DROP POLICY IF EXISTS financial_entries_isolation_select ON public.financial_entries;
CREATE POLICY financial_entries_isolation_select ON public.financial_entries
    FOR SELECT
    USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS financial_entries_isolation_insert ON public.financial_entries;
CREATE POLICY financial_entries_isolation_insert ON public.financial_entries
    FOR INSERT
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS financial_entries_isolation_update ON public.financial_entries;
CREATE POLICY financial_entries_isolation_update ON public.financial_entries
    FOR UPDATE
    USING (tenant_id = public.get_current_tenant())
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS financial_entries_isolation_delete ON public.financial_entries;
CREATE POLICY financial_entries_isolation_delete ON public.financial_entries
    FOR DELETE
    USING (tenant_id = public.get_current_tenant());
