-- ==============================================================================
-- GADAP Hub - Migração 20261031100000: Gestão de Aditivos Contratuais (Prompt 83)
-- Descrição:
--   1. Garante a presença das colunas budget_total em public.projects e
--      total_contract_value em public.subcontracts para sincronização automática
--      do orçamento da obra e do Farol de Risco dos subempreiteiros.
--   2. Cria a tabela public.contract_amendments para rastrear Change Orders
--      (CLIENT_EXTRA e SUBCONTRACTOR_EXTRA).
--   3. Configura Row Level Security (RLS) Multi-Tenant em public.contract_amendments.
-- ==============================================================================

-- 1. Colunas de consolidação financeira em projects e subcontracts
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS budget_total NUMERIC(18, 4) DEFAULT 0.0000;

UPDATE public.projects
SET budget_total = COALESCE(contract_value, 0.0000)
WHERE budget_total IS NULL OR budget_total = 0;

ALTER TABLE public.subcontracts
    ADD COLUMN IF NOT EXISTS total_contract_value NUMERIC(18, 4) DEFAULT 0.0000;

UPDATE public.subcontracts
SET total_contract_value = COALESCE(total_value, 0.0000)
WHERE total_contract_value IS NULL OR total_contract_value = 0;

-- 2. Criação da tabela public.contract_amendments
CREATE TABLE IF NOT EXISTS public.contract_amendments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    subcontract_id UUID NULL REFERENCES public.subcontracts(id) ON DELETE SET NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('CLIENT_EXTRA', 'SUBCONTRACTOR_EXTRA')),
    description TEXT NOT NULL,
    amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_SIGNATURE', 'APPROVED', 'REJECTED')),
    signed_pdf_url TEXT NULL,
    govbr_transaction_id VARCHAR(120) NULL,
    approved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_subcontractor_extra_requires_subcontract CHECK (
        (type = 'CLIENT_EXTRA') OR (type = 'SUBCONTRACTOR_EXTRA' AND subcontract_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_contract_amendments_tenant_project
    ON public.contract_amendments(tenant_id, project_id);

CREATE INDEX IF NOT EXISTS idx_contract_amendments_subcontract
    ON public.contract_amendments(subcontract_id);

COMMENT ON TABLE public.contract_amendments IS 'Termos Aditivos Contratuais (Change Orders) do Contrato Principal (CLIENT_EXTRA) e de Subempreiteiros (SUBCONTRACTOR_EXTRA).';

-- 3. Ativação do Row Level Security (RLS) Multi-Tenant
ALTER TABLE public.contract_amendments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contract_amendments_select_tenant" ON public.contract_amendments;
CREATE POLICY "contract_amendments_select_tenant"
ON public.contract_amendments
FOR SELECT
TO authenticated
USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS "contract_amendments_insert_tenant" ON public.contract_amendments;
CREATE POLICY "contract_amendments_insert_tenant"
ON public.contract_amendments
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS "contract_amendments_update_tenant" ON public.contract_amendments;
CREATE POLICY "contract_amendments_update_tenant"
ON public.contract_amendments
FOR UPDATE
TO authenticated
USING (tenant_id = public.get_current_tenant())
WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS "contract_amendments_delete_tenant" ON public.contract_amendments;
CREATE POLICY "contract_amendments_delete_tenant"
ON public.contract_amendments
FOR DELETE
TO authenticated
USING (tenant_id = public.get_current_tenant());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_amendments TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

