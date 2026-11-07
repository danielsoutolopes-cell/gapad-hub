-- ==============================================================================
-- Migration: Segregação de Verbas de Terceiros e Alerta Anti-Fraude
-- Arquivo: supabase/migrations/20261107140000_subcontract_extras_and_segregation.sql
-- Prompt: 100
-- ==============================================================================

-- 1. Enum e Coluna payment_category em subcontract_transactions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subcontract_payment_category') THEN
        CREATE TYPE public.subcontract_payment_category AS ENUM ('PRINCIPAL', 'CONTRACTED_EXTRA', 'FIELD_EXTRA');
    END IF;
END $$;

ALTER TABLE public.subcontract_transactions
    ADD COLUMN IF NOT EXISTS payment_category VARCHAR(30) DEFAULT 'PRINCIPAL';

COMMENT ON COLUMN public.subcontract_transactions.payment_category IS 'Segregação de verba: PRINCIPAL (contrato base), CONTRACTED_EXTRA (aditivo contratado), FIELD_EXTRA (extra de campo).';

-- 2. Tabela: subcontract_extras
CREATE TABLE IF NOT EXISTS public.subcontract_extras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    subcontract_id UUID NOT NULL REFERENCES public.subcontracts(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
    requested_by_supplier VARCHAR(255),
    validated_by_field VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID')),
    transaction_id UUID REFERENCES public.subcontract_transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_subcontract_extras_subcontract_id ON public.subcontract_extras(subcontract_id);
CREATE INDEX IF NOT EXISTS idx_subcontract_extras_tenant_id ON public.subcontract_extras(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subcontract_extras_status ON public.subcontract_extras(subcontract_id, status);

-- Trigger de updated_at
DROP TRIGGER IF EXISTS trg_subcontract_extras_updated_at ON public.subcontract_extras;
CREATE TRIGGER trg_subcontract_extras_updated_at
    BEFORE UPDATE ON public.subcontract_extras
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.subcontract_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subcontract_extras_tenant_isolation ON public.subcontract_extras;
CREATE POLICY subcontract_extras_tenant_isolation ON public.subcontract_extras
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
        OR (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
        OR (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id
    );

