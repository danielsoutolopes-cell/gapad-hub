-- ==============================================================================
-- GADAP Hub - Migração 20261028000001: Gateway PF (Asaas) e Status de Assinatura
-- Dialeto: PostgreSQL 16 (Supabase)
-- ==============================================================================

-- 1. ADICIONAR gateway_customer_id E ATUALIZAR STATUS PARA SUPORTAR PAST_DUE
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS gateway_customer_id VARCHAR(100);

COMMENT ON COLUMN public.companies.gateway_customer_id IS 'ID do cliente no Gateway Asaas / Mercado Pago (PF do fundador)';

-- Ajusta ou adiciona constraint de integridade para incluir PAST_DUE
DO $$
BEGIN
    ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS chk_companies_plan_status;
    ALTER TABLE public.companies
    ADD CONSTRAINT chk_companies_plan_status
    CHECK (plan_status IN ('ACTIVE', 'TRIAL', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'));
END $$;

NOTIFY pgrst, 'reload schema';
