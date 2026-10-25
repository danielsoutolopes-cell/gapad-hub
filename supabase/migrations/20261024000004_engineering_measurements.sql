-- ==============================================================================
-- GADAP Hub - Migração 20261024000004: Medições Físico-Financeiras (medicoes)
-- ==============================================================================

-- 1. Criação da Tabela de Medições
CREATE TABLE IF NOT EXISTS public.medicoes (
    id UUID PRIMARY KEY DEFAULT public.gen_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    numero_sequencial INTEGER NOT NULL,
    periodo_inicio DATE NOT NULL,
    periodo_fim DATE NOT NULL,
    valor_medido NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    retencao_tecnica NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    valor_liquido NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    status VARCHAR(50) NOT NULL DEFAULT 'rascunho',
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_medicoes_valor_medido CHECK (valor_medido >= 0),
    CONSTRAINT chk_medicoes_retencao CHECK (retencao_tecnica >= 0),
    CONSTRAINT chk_medicoes_valor_liquido CHECK (valor_liquido >= 0),
    CONSTRAINT chk_medicoes_periodo CHECK (periodo_fim >= periodo_inicio),
    CONSTRAINT chk_medicoes_status CHECK (
        status IN ('rascunho', 'enviada', 'aprovada', 'faturada', 'rejeitada')
    ),
    CONSTRAINT uq_medicoes_tenant_project_seq UNIQUE (tenant_id, project_id, numero_sequencial)
);

COMMENT ON TABLE public.medicoes IS 'Boletins de medição físico-financeira das obras com retenção técnica e cálculo determinístico no backend.';
COMMENT ON COLUMN public.medicoes.numero_sequencial IS 'Número sequencial do boletim de medição na obra (ex: 1 para 1ª Medição).';
COMMENT ON COLUMN public.medicoes.valor_medido IS 'Valor bruto apurado na medição física do período (numeric 18,4).';
COMMENT ON COLUMN public.medicoes.retencao_tecnica IS 'Valor monetário retido como garantia técnica contratual (calculado via Decimal no backend).';
COMMENT ON COLUMN public.medicoes.valor_liquido IS 'Valor líquido a faturar (valor_medido - retencao_tecnica).';

-- 2. Índices para Alta Performance
CREATE INDEX IF NOT EXISTS idx_medicoes_tenant_project ON public.medicoes(tenant_id, project_id);
CREATE INDEX IF NOT EXISTS idx_medicoes_tenant_status ON public.medicoes(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_medicoes_tenant_seq ON public.medicoes(tenant_id, project_id, numero_sequencial DESC);

-- 3. Trigger de updated_at para auditoria
DROP TRIGGER IF EXISTS trg_medicoes_updated_at ON public.medicoes;
CREATE TRIGGER trg_medicoes_updated_at
    BEFORE UPDATE ON public.medicoes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. Habilitação e Forçamento Rigoroso de RLS (Row Level Security)
ALTER TABLE public.medicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicoes FORCE ROW LEVEL SECURITY;

-- 5. Políticas de Isolamento por Tenant
DROP POLICY IF EXISTS medicoes_isolation_select ON public.medicoes;
CREATE POLICY medicoes_isolation_select ON public.medicoes
    FOR SELECT
    USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS medicoes_isolation_insert ON public.medicoes;
CREATE POLICY medicoes_isolation_insert ON public.medicoes
    FOR INSERT
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS medicoes_isolation_update ON public.medicoes;
CREATE POLICY medicoes_isolation_update ON public.medicoes
    FOR UPDATE
    USING (tenant_id = public.get_current_tenant())
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS medicoes_isolation_delete ON public.medicoes;
CREATE POLICY medicoes_isolation_delete ON public.medicoes
    FOR DELETE
    USING (tenant_id = public.get_current_tenant());
