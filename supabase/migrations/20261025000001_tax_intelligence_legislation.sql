-- ==============================================================================
-- GADAP Hub - Migração 20261025000001: Tax Intelligence & Monitoramento Legal
-- Tabela: public.legislation_updates e View canônica: public."LegislationUpdate"
-- ==============================================================================

-- 1. Criação da Tabela de Atualizações Legislativas (legislation_updates)
CREATE TABLE IF NOT EXISTS public.legislation_updates (
    id UUID PRIMARY KEY DEFAULT public.gen_uuid_v7(),
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    source VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    law_reference VARCHAR(100),
    category VARCHAR(50) NOT NULL DEFAULT 'tax',
    impact_level VARCHAR(20) NOT NULL DEFAULT 'info',
    effective_date DATE,
    details JSONB DEFAULT '{}'::jsonb,
    raw_content TEXT,
    content_hash VARCHAR(64) UNIQUE NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_impact_level CHECK (impact_level IN ('info', 'warning', 'critical')),
    CONSTRAINT chk_category CHECK (category IN ('tax', 'iss', 'inss', 'irrf', 'nfse', 'ibpt', 'reforma_tributaria', 'trabalhista', 'ambiental'))
);

COMMENT ON TABLE public.legislation_updates IS 'Registro histórico de atualizações tributárias, fiscais e legais monitoradas pelo robô de IA do GADAP Hub.';

-- 2. View com o nome estrito solicitado pelo requisito "LegislationUpdate"
CREATE OR REPLACE VIEW public."LegislationUpdate" AS
    SELECT * FROM public.legislation_updates;

-- 3. Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_legislation_detected_at ON public.legislation_updates(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_legislation_impact ON public.legislation_updates(impact_level);
CREATE INDEX IF NOT EXISTS idx_legislation_category ON public.legislation_updates(category);
CREATE INDEX IF NOT EXISTS idx_legislation_source ON public.legislation_updates(source);
CREATE INDEX IF NOT EXISTS idx_legislation_hash ON public.legislation_updates(content_hash);
CREATE INDEX IF NOT EXISTS idx_legislation_tenant ON public.legislation_updates(tenant_id);

-- 4. Trigger de updated_at para auditoria
DROP TRIGGER IF EXISTS trg_legislation_updates_updated_at ON public.legislation_updates;
CREATE TRIGGER trg_legislation_updates_updated_at
    BEFORE UPDATE ON public.legislation_updates
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Habilitação de RLS
ALTER TABLE public.legislation_updates ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de RLS
-- Leituras permitidas para atualizações públicas globais (tenant_id IS NULL) ou do próprio tenant autenticado
DROP POLICY IF EXISTS legislation_updates_select ON public.legislation_updates;
CREATE POLICY legislation_updates_select ON public.legislation_updates
    FOR SELECT
    USING (
        tenant_id IS NULL 
        OR tenant_id = public.get_current_tenant()
    );

-- Escrita (INSERT/UPDATE/DELETE) liberada para service_role ou tenant ativo
DROP POLICY IF EXISTS legislation_updates_insert ON public.legislation_updates;
CREATE POLICY legislation_updates_insert ON public.legislation_updates
    FOR INSERT
    WITH CHECK (
        tenant_id IS NULL 
        OR tenant_id = public.get_current_tenant()
    );

DROP POLICY IF EXISTS legislation_updates_update ON public.legislation_updates;
CREATE POLICY legislation_updates_update ON public.legislation_updates
    FOR UPDATE
    USING (
        tenant_id IS NULL 
        OR tenant_id = public.get_current_tenant()
    );

DROP POLICY IF EXISTS legislation_updates_delete ON public.legislation_updates;
CREATE POLICY legislation_updates_delete ON public.legislation_updates
    FOR DELETE
    USING (
        tenant_id IS NULL 
        OR tenant_id = public.get_current_tenant()
    );
