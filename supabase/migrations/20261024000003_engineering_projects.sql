-- ==============================================================================
-- GADAP Hub - Migração 20261024000003: Módulo de Engenharia (Obras / Projects)
-- ==============================================================================

-- 1. Garante colunas específicas do Módulo de Engenharia na tabela projects
DO $$
BEGIN
    -- Criação da tabela se ainda não existir
    CREATE TABLE IF NOT EXISTS public.projects (
        id UUID PRIMARY KEY DEFAULT public.gen_uuid_v7(),
        tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
        code VARCHAR(50),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        cno VARCHAR(20),
        art_rrt VARCHAR(50),
        contract_value NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
        technical_retention_perc NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
        address_street VARCHAR(255),
        address_number VARCHAR(30),
        address_complement VARCHAR(100),
        address_neighborhood VARCHAR(100),
        address_city VARCHAR(100),
        address_city_ibge VARCHAR(7),
        address_state VARCHAR(2),
        address_zip_code VARCHAR(10),
        start_date DATE,
        end_date_planned DATE,
        expected_end_date DATE,
        actual_end_date DATE,
        status VARCHAR(50) NOT NULL DEFAULT 'planejamento',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT chk_projects_contract_value CHECK (contract_value >= 0)
    );

    -- Atualiza / adiciona colunas se a tabela já existir previamente
    ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS end_date_planned DATE;
    ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS address_city_ibge VARCHAR(7);

    -- Sincroniza end_date_planned com expected_end_date caso exista
    UPDATE public.projects 
    SET end_date_planned = expected_end_date 
    WHERE end_date_planned IS NULL AND expected_end_date IS NOT NULL;

    -- Atualiza expected_end_date com end_date_planned para compatibilidade reversa
    UPDATE public.projects 
    SET expected_end_date = end_date_planned 
    WHERE expected_end_date IS NULL AND end_date_planned IS NOT NULL;
END $$;

COMMENT ON TABLE public.projects IS 'Cadastro oficial de Obras e Empreendimentos de Engenharia com isolamento por Tenant.';
COMMENT ON COLUMN public.projects.address_city_ibge IS 'Código IBGE do município (7 dígitos) para apuração de retenção tributária e ISS municipal.';
COMMENT ON COLUMN public.projects.end_date_planned IS 'Data prevista/planejada para conclusão da obra ou entrega final.';

-- 2. Índices de Otimização Operacional
CREATE INDEX IF NOT EXISTS idx_projects_tenant_client ON public.projects(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_status ON public.projects(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_created ON public.projects(tenant_id, created_at DESC);

-- 3. Trigger de updated_at para projects
DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. Habilitação e Forçamento Rigoroso de RLS (Row Level Security)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;

-- 5. Políticas de Isolamento por Tenant
DROP POLICY IF EXISTS projects_isolation_select ON public.projects;
CREATE POLICY projects_isolation_select ON public.projects
    FOR SELECT
    USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS projects_isolation_insert ON public.projects;
CREATE POLICY projects_isolation_insert ON public.projects
    FOR INSERT
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS projects_isolation_update ON public.projects;
CREATE POLICY projects_isolation_update ON public.projects
    FOR UPDATE
    USING (tenant_id = public.get_current_tenant())
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS projects_isolation_delete ON public.projects;
CREATE POLICY projects_isolation_delete ON public.projects
    FOR DELETE
    USING (tenant_id = public.get_current_tenant());
