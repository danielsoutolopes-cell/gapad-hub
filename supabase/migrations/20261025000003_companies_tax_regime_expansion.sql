-- ==============================================================================
-- GADAP Hub - Migração 20261025000003: Expansão de Público (MEI, EPP e Simples Nacional)
-- Tabela: public.companies
-- ==============================================================================

-- 1. Garante existência da coluna tax_regime na tabela companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS tax_regime VARCHAR(50) NOT NULL DEFAULT 'simples_nacional';

-- 2. Atualiza a constraint de validação para suportar tanto os formatos canônicos snake_case
-- quanto os nomes corporativos estritos (MEI, Simples Nacional, Lucro Presumido, Lucro Real)
ALTER TABLE public.companies 
DROP CONSTRAINT IF EXISTS chk_companies_tax_regime;

ALTER TABLE public.companies
ADD CONSTRAINT chk_companies_tax_regime CHECK (
    LOWER(REPLACE(tax_regime, ' ', '_')) IN (
        'mei',
        'simples_nacional',
        'lucro_presumido',
        'lucro_real'
    )
);

-- 3. Atualiza comentários para clareza da governança fiscal
COMMENT ON COLUMN public.companies.tax_regime IS 
'Regime tributário da empresa: MEI (Microempreendedor Individual), Simples Nacional, Lucro Presumido ou Lucro Real. Permite ativação automática do Bypass Fiscal para MEIs/Engenheiros Solo.';

-- 4. Índice para consultas rápidas de regime fiscal
CREATE INDEX IF NOT EXISTS idx_companies_tax_regime ON public.companies(tax_regime);

-- 5. Notificação de reload do schema PostgREST
NOTIFY pgrst, 'reload schema';
