-- ==============================================================================
-- GADAP Hub - Migração 20261031200000: Matriz de Responsabilidade e Mapas de Cotação (Prompt 84)
-- Descrição:
--   1. Adiciona o campo responsibility ('CONSTRUCTOR', 'CLIENT_DIRECT', 'CLIENT_REIMBURSEMENT')
--      e items_description na tabela public.purchase_requests.
--   2. Adiciona as colunas is_winner (BOOLEAN) e justification (TEXT) nas tabelas
--      public.quotes e public.procurement_quotes.
--   3. Garante políticas RLS Multi-Tenant completas para Suprimentos.
-- ==============================================================================

-- 1. Evolução da tabela public.purchase_requests (Matriz de Responsabilidade)
ALTER TABLE public.purchase_requests
    ADD COLUMN IF NOT EXISTS responsibility VARCHAR(30) NOT NULL DEFAULT 'CONSTRUCTOR'
        CHECK (responsibility IN ('CONSTRUCTOR', 'CLIENT_DIRECT', 'CLIENT_REIMBURSEMENT')),
    ADD COLUMN IF NOT EXISTS items_description TEXT;

COMMENT ON COLUMN public.purchase_requests.responsibility IS
    'Matriz de Responsabilidade: CONSTRUCTOR (Padrão), CLIENT_DIRECT (Faturar no CPF/CNPJ do Cliente) ou CLIENT_REIMBURSEMENT (Construtora paga e gera reembolso no Contas a Receber).';

-- 2. Evolução das tabelas public.quotes e public.procurement_quotes (Selo Vencedora & Justificativa)
ALTER TABLE public.quotes
    ADD COLUMN IF NOT EXISTS is_winner BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS justification TEXT;

ALTER TABLE public.procurement_quotes
    ADD COLUMN IF NOT EXISTS is_winner BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS justification TEXT,
    ADD COLUMN IF NOT EXISTS unit_price NUMERIC(15, 2) DEFAULT 0.00;

COMMENT ON COLUMN public.procurement_quotes.is_winner IS 'Indica a cotação vencedora recomendada pela engenharia (Selo de Recomendação).';
COMMENT ON COLUMN public.procurement_quotes.justification IS 'Justificativa técnica/comercial da escolha (ex: Menor prazo de entrega).';

-- 3. Políticas de Isolamento Multi-Tenant (RLS)
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_requests_tenant_isolation" ON public.purchase_requests;
CREATE POLICY "purchase_requests_tenant_isolation"
ON public.purchase_requests
FOR ALL
TO authenticated
USING (tenant_id = public.get_current_tenant())
WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS "procurement_quotes_tenant_isolation" ON public.procurement_quotes;
CREATE POLICY "procurement_quotes_tenant_isolation"
ON public.procurement_quotes
FOR ALL
TO authenticated
USING (tenant_id = public.get_current_tenant())
WITH CHECK (tenant_id = public.get_current_tenant());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_requests TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procurement_quotes TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

