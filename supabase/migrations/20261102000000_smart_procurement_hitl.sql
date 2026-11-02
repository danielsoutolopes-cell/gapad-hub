-- =============================================================================
-- MIGRATION: PROMPT 86 - SMART PROCUREMENT (HITL, MAPAS SEQUENCIAIS & COMPRINHAS)
-- 1. sequence_number e map_code sequenciais por obra em purchase_requests
-- 2. Auditoria Human-in-the-Loop (human_verified) em quotes e procurement_quotes
-- 3. Tabela direct_purchases ("Comprinhas" / Fundo de Maneio) com recibo fotográfico
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. EVOLUÇÃO DE purchase_requests: sequence_number E map_code POR OBRA
-- -----------------------------------------------------------------------------
ALTER TABLE public.purchase_requests
    ADD COLUMN IF NOT EXISTS sequence_number INTEGER,
    ADD COLUMN IF NOT EXISTS map_code VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_project_seq
    ON public.purchase_requests (tenant_id, project_id, sequence_number);

-- Trigger para gerar sequence_number e map_code (ex: MAPA-001-LORENA) por obra
CREATE OR REPLACE FUNCTION public.assign_purchase_request_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next_seq INTEGER;
    v_proj_name TEXT;
    v_slug TEXT;
BEGIN
    IF NEW.sequence_number IS NULL THEN
        SELECT COALESCE(MAX(sequence_number), 0) + 1
          INTO v_next_seq
          FROM public.purchase_requests
         WHERE tenant_id = NEW.tenant_id
           AND (
               (NEW.project_id IS NOT NULL AND project_id = NEW.project_id)
               OR (NEW.project_id IS NULL AND project_id IS NULL)
           );
        NEW.sequence_number := COALESCE(v_next_seq, 1);
    END IF;

    IF NEW.map_code IS NULL OR btrim(NEW.map_code) = '' THEN
        IF NEW.project_id IS NOT NULL THEN
            SELECT name INTO v_proj_name FROM public.projects WHERE id = NEW.project_id;
        END IF;

        v_slug := upper(regexp_replace(COALESCE(v_proj_name, 'OBRA'), '[^a-zA-Z0-9]+', '', 'g'));
        v_slug := left(COALESCE(NULLIF(v_slug, ''), 'OBRA'), 10);

        NEW.map_code := 'MAPA-' || lpad(NEW.sequence_number::text, 3, '0') || '-' || v_slug;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_purchase_request_sequence ON public.purchase_requests;
CREATE TRIGGER trg_assign_purchase_request_sequence
    BEFORE INSERT ON public.purchase_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_purchase_request_sequence();

-- -----------------------------------------------------------------------------
-- 2. AUDITORIA HUMAN-IN-THE-LOOP NAS COTAÇÕES (quotes & procurement_quotes)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'quotes'
    ) THEN
        ALTER TABLE public.quotes
            ADD COLUMN IF NOT EXISTS human_verified BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS human_verified_at TIMESTAMPTZ DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS extraction_source VARCHAR(40) DEFAULT 'HUMAN_CONFIRMED';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'procurement_quotes'
    ) THEN
        ALTER TABLE public.procurement_quotes
            ADD COLUMN IF NOT EXISTS human_verified BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS human_verified_at TIMESTAMPTZ DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS extraction_source VARCHAR(40) DEFAULT 'HUMAN_CONFIRMED';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. TABELA direct_purchases ("COMPRINHAS" / FUNDO DE MANEIO DE URGÊNCIA)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.direct_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    sequence_number INTEGER NOT NULL DEFAULT 1,
    direct_code VARCHAR(64),
    description TEXT NOT NULL,
    supplier_name VARCHAR(255) NOT NULL,
    supplier_document VARCHAR(30),
    total_amount NUMERIC(15, 2) NOT NULL CHECK (total_amount > 0),
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method VARCHAR(40) NOT NULL DEFAULT 'PIX',
    responsibility VARCHAR(30) NOT NULL DEFAULT 'CONSTRUCTOR'
        CHECK (responsibility IN ('CONSTRUCTOR', 'CLIENT_DIRECT', 'CLIENT_REIMBURSEMENT')),
    receipt_photo_url TEXT NOT NULL,
    receipt_file_name VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'CONCILIADA_FINANCEIRO'
        CHECK (status IN ('REGISTRADA', 'CONCILIADA_FINANCEIRO', 'CANCELADA')),
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_direct_purchases_tenant_project
    ON public.direct_purchases (tenant_id, project_id, created_at DESC);

ALTER TABLE public.direct_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS direct_purchases_tenant_isolation ON public.direct_purchases;
CREATE POLICY direct_purchases_tenant_isolation ON public.direct_purchases
    FOR ALL
    TO authenticated
    USING (
        tenant_id = COALESCE(
            (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid,
            (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
        )
    )
    WITH CHECK (
        tenant_id = COALESCE(
            (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid,
            (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
        )
    );

-- Bucket privado para recibos fotográficos de compras diretas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'direct-purchase-receipts',
    'direct-purchase-receipts',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

