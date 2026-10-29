-- ==============================================================================
-- GADAP Hub - Migração 20261028000000: Modelagem de Assinaturas & Checkout SaaS (PLG)
-- Dialeto: PostgreSQL 16 (Supabase)
-- Diretrizes: Idempotente, Snake_case, RLS Hermético
-- ==============================================================================

-- 1. ADICIONAR COLUNAS DE PRECIFICAÇÃO E ASSINATURA NA TABELA companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS plan_status VARCHAR(20) NOT NULL DEFAULT 'TRIAL',
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '6 months'),
ADD COLUMN IF NOT EXISTS discount_expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '6 months'),
ADD COLUMN IF NOT EXISTS renewal_count INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_renewals INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS metadata_json JSONB DEFAULT '{}'::jsonb;

-- Validação de integridade do status do plano
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_companies_plan_status'
    ) THEN
        ALTER TABLE public.companies
        ADD CONSTRAINT chk_companies_plan_status
        CHECK (plan_status IN ('ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELLED'));
    END IF;
END $$;

COMMENT ON COLUMN public.companies.plan_status IS 'Status da assinatura do tenant: ACTIVE, TRIAL, SUSPENDED, CANCELLED';
COMMENT ON COLUMN public.companies.trial_ends_at IS 'Data e hora limite do período de trial/isenção';
COMMENT ON COLUMN public.companies.discount_expires_at IS 'Data e hora limite de expiração do desconto concedido';
COMMENT ON COLUMN public.companies.renewal_count IS 'Quantidade de renovações de benefício já executadas pelo tenant';
COMMENT ON COLUMN public.companies.max_renewals IS 'Limite máximo de renovações de benefícios permitidas para a conta';
COMMENT ON COLUMN public.companies.metadata_json IS 'Metadados gerais, configurações de faturamento e contatos técnicos super-admin';

-- 2. FUNÇÃO RPC PARA RENOVAÇÃO DE BENEFÍCIO (PLG BILLING)
CREATE OR REPLACE FUNCTION public.renew_company_benefit(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company RECORD;
    v_new_count INT;
    v_new_discount_expiry TIMESTAMPTZ;
BEGIN
    -- Busca a empresa garantindo integridade
    SELECT * INTO v_company FROM public.companies WHERE id = p_company_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Empresa não encontrada.');
    END IF;

    -- Checa limite de renovações
    IF v_company.renewal_count >= v_company.max_renewals THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Limite de prorrogações de benefícios atingido (' || v_company.renewal_count || '/' || v_company.max_renewals || ').'
        );
    END IF;

    v_new_count := v_company.renewal_count + 1;
    -- Prorroga por mais 6 meses a partir da data atual ou da data de expiração anterior
    v_new_discount_expiry := GREATEST(COALESCE(v_company.discount_expires_at, now()), now()) + INTERVAL '6 months';

    UPDATE public.companies
    SET 
        renewal_count = v_new_count,
        discount_expires_at = v_new_discount_expiry,
        plan_status = 'ACTIVE',
        updated_at = now()
    WHERE id = p_company_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Benefício comercial prorrogado com sucesso por mais 6 meses!',
        'renewal_count', v_new_count,
        'max_renewals', v_company.max_renewals,
        'discount_expires_at', v_new_discount_expiry
    );
END;
$$;

COMMENT ON FUNCTION public.renew_company_benefit(UUID) IS 'Executa a regra PLG de renovação de benefício de 50% de desconto por 6 meses adicionais respeitando max_renewals.';

-- Notifica o PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
