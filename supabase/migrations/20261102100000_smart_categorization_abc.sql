-- =============================================================================
-- MIGRATION: PROMPT 87 - CATEGORIZAÇÃO INTELIGENTE E AGRUPAMENTO DE COTAÇÕES (CURVA ABC)
-- 1. Coluna category (ELÉTRICA, HIDRÁULICA, CIVIL, MARCENARIA, REVESTIMENTOS, ESTRUTURAL)
--    em inventory_items, purchase_requests, quotes, procurement_quotes e direct_purchases
-- 2. Coluna categorized_items (JSONB) para detalhamento agrupado com subtotais no PDF
-- =============================================================================

BEGIN;

-- 1. Garante tabela inventory_items e coluna category
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(80),
    unit VARCHAR(20) NOT NULL DEFAULT 'UN',
    category VARCHAR(60) NOT NULL DEFAULT 'CIVIL',
    quantity_on_hand NUMERIC(15, 3) NOT NULL DEFAULT 0,
    unit_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.inventory_items
    ADD COLUMN IF NOT EXISTS category VARCHAR(60) NOT NULL DEFAULT 'CIVIL';

CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant_category
    ON public.inventory_items (tenant_id, category);

-- 2. Coluna category e categorized_items em purchase_requests
ALTER TABLE public.purchase_requests
    ADD COLUMN IF NOT EXISTS category VARCHAR(60) NOT NULL DEFAULT 'CIVIL',
    ADD COLUMN IF NOT EXISTS categorized_items JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_purchase_requests_tenant_category
    ON public.purchase_requests (tenant_id, project_id, category);

-- 3. Coluna category e categorized_items em quotes e procurement_quotes
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'quotes'
    ) THEN
        ALTER TABLE public.quotes
            ADD COLUMN IF NOT EXISTS category VARCHAR(60) NOT NULL DEFAULT 'CIVIL',
            ADD COLUMN IF NOT EXISTS categorized_items JSONB NOT NULL DEFAULT '[]'::jsonb;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'procurement_quotes'
    ) THEN
        ALTER TABLE public.procurement_quotes
            ADD COLUMN IF NOT EXISTS category VARCHAR(60) NOT NULL DEFAULT 'CIVIL',
            ADD COLUMN IF NOT EXISTS categorized_items JSONB NOT NULL DEFAULT '[]'::jsonb;

        CREATE INDEX IF NOT EXISTS idx_procurement_quotes_tenant_category
            ON public.procurement_quotes (tenant_id, category);
    END IF;
END $$;

-- 4. Coluna category em direct_purchases ("Comprinhas")
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'direct_purchases'
    ) THEN
        ALTER TABLE public.direct_purchases
            ADD COLUMN IF NOT EXISTS category VARCHAR(60) NOT NULL DEFAULT 'CIVIL';
    END IF;
END $$;

COMMIT;

