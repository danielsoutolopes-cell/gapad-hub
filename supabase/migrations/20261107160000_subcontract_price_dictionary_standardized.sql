-- ==============================================================================
-- Migration: Dicionário de Preços de Serviços de Subempreiteiros (Standardized)
-- Arquivo: supabase/migrations/20261107160000_subcontract_price_dictionary_standardized.sql
-- Prompt: 102
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.subcontract_price_dictionary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    standardized_service VARCHAR(255) NOT NULL,
    standardized_service_name VARCHAR(255),
    average_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    average_unit_price NUMERIC(15, 2) DEFAULT 0.00,
    highest_unit_price NUMERIC(15, 2) DEFAULT 0.00,
    sample_count INT NOT NULL DEFAULT 1,
    unit VARCHAR(30) DEFAULT 'un',
    last_updated TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_tenant_standardized_service_name UNIQUE (tenant_id, standardized_service)
);

-- Compatibilidade de colunas caso a tabela já tenha sido criada com nomenclatura similar
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subcontract_price_dictionary' AND column_name = 'standardized_service'
    ) THEN
        ALTER TABLE public.subcontract_price_dictionary ADD COLUMN standardized_service VARCHAR(255);
        UPDATE public.subcontract_price_dictionary 
        SET standardized_service = standardized_service_name 
        WHERE standardized_service IS NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subcontract_price_dictionary' AND column_name = 'average_price'
    ) THEN
        ALTER TABLE public.subcontract_price_dictionary ADD COLUMN average_price NUMERIC(15, 2) DEFAULT 0.00;
        UPDATE public.subcontract_price_dictionary 
        SET average_price = average_unit_price 
        WHERE average_price IS NULL OR average_price = 0.00;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subcontract_price_dict_std_service ON public.subcontract_price_dictionary(tenant_id, standardized_service);

ALTER TABLE public.subcontract_price_dictionary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subcontract_price_dictionary_std_isolation ON public.subcontract_price_dictionary;
CREATE POLICY subcontract_price_dictionary_std_isolation ON public.subcontract_price_dictionary
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

