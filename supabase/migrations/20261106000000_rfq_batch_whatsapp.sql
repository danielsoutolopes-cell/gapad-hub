-- =============================================================================
-- MIGRATION: PROMPT 89 - RFQ (REQUEST FOR QUOTATION) & DISPARO EM LOTE WHATSAPP
-- 1. Status 'AGUARDANDO_FORNECEDOR' e rastreamento de RFQ em procurement_quotes / quotes
-- 2. Coluna supplier_id, rfq_sent_at, rfq_message_id
-- 3. Atualização de status de purchase_requests ('EM_COTACAO')
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. CAMPOS DE RFQ E STATUS EM procurement_quotes
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'procurement_quotes'
    ) THEN
        ALTER TABLE public.procurement_quotes
            ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS rfq_sent_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS rfq_message_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS rfq_notes TEXT;

        CREATE INDEX IF NOT EXISTS idx_procurement_quotes_rfq_status
            ON public.procurement_quotes (purchase_request_id, status);
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'quotes'
    ) THEN
        ALTER TABLE public.quotes
            ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS rfq_sent_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS rfq_message_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS rfq_notes TEXT;

        CREATE INDEX IF NOT EXISTS idx_quotes_rfq_status
            ON public.quotes (purchase_request_id, status);
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. CAMPOS DE CONTROLE RFQ EM purchase_requests
-- -----------------------------------------------------------------------------
ALTER TABLE public.purchase_requests
    ADD COLUMN IF NOT EXISTS rfq_dispatched_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rfq_last_dispatched_at TIMESTAMPTZ;

COMMIT;

