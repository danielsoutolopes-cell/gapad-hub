-- ==============================================================================
-- GADAP Hub ERP - Migração: Orçamentos Simplificados (Markup vs BDI)
-- Adiciona calculation_type e markup_percentage na tabela quotes
-- ==============================================================================

ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS calculation_type VARCHAR(20) NOT NULL DEFAULT 'BDI';

ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS markup_percentage NUMERIC(7, 4) DEFAULT 0.0000;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_quotes_calculation_type'
    ) THEN
        ALTER TABLE public.quotes
        ADD CONSTRAINT chk_quotes_calculation_type
        CHECK (calculation_type IN ('BDI', 'MARKUP'));
    END IF;
END $$;

COMMENT ON COLUMN public.quotes.calculation_type IS 'Método de precificação comercial: BDI (analítico TCU) ou MARKUP (simplificado para autônomos/MEI).';
COMMENT ON COLUMN public.quotes.markup_percentage IS 'Margem percentual direta sobre o custo total quando calculation_type = MARKUP.';
