-- ==============================================================================
-- Migration: Dicionário Histórico de Preços de Serviços de Subempreiteiros
-- Arquivo: supabase/migrations/20261107150000_subcontract_price_dictionary.sql
-- Prompt: 101
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.subcontract_price_dictionary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    standardized_service_name VARCHAR(255) NOT NULL,
    average_unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    highest_unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    sample_count INT NOT NULL DEFAULT 1,
    unit VARCHAR(30) DEFAULT 'un',
    last_updated TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_tenant_standardized_service UNIQUE (tenant_id, standardized_service_name)
);

CREATE INDEX IF NOT EXISTS idx_subcontract_price_dict_tenant ON public.subcontract_price_dictionary(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subcontract_price_dict_name ON public.subcontract_price_dictionary(tenant_id, standardized_service_name);

ALTER TABLE public.subcontract_price_dictionary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subcontract_price_dictionary_isolation ON public.subcontract_price_dictionary;
CREATE POLICY subcontract_price_dictionary_isolation ON public.subcontract_price_dictionary
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

