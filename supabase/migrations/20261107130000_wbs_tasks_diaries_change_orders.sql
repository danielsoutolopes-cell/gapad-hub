-- =============================================================================
-- PROMPT 99: WBS HIERÁRQUICA, DIÁRIOS DE OBRA ATÔMICOS & CHANGE ORDERS (ADITIVOS)
-- =============================================================================

-- 1. Expansão de project_tasks para suporte completo à WBS (Árvore Hierárquica)
ALTER TABLE public.project_tasks
ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.project_tasks(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS planned_start DATE NULL,
ADD COLUMN IF NOT EXISTS planned_end DATE NULL,
ADD COLUMN IF NOT EXISTS actual_start DATE NULL,
ADD COLUMN IF NOT EXISTS actual_end DATE NULL,
ADD COLUMN IF NOT EXISTS wbs_code VARCHAR(50) NULL;

-- Sincroniza planned_start/end com start_date/end_date caso não informados
UPDATE public.project_tasks
SET planned_start = COALESCE(planned_start, start_date),
    planned_end = COALESCE(planned_end, end_date)
WHERE planned_start IS NULL OR planned_end IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_tasks_parent ON public.project_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_wbs ON public.project_tasks(project_id, wbs_code);

-- 2. Atualizar field_reports adicionando task_id (FK para project_tasks)
ALTER TABLE public.field_reports
ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.project_tasks(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS progress_recorded NUMERIC(5,2) NULL,
ADD COLUMN IF NOT EXISTS workforce_count INT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS weather_condition VARCHAR(40) NULL DEFAULT 'ENSOLARADO',
ADD COLUMN IF NOT EXISTS observations TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_field_reports_task_id ON public.field_reports(task_id);

-- 3. Criar tabela change_orders_requests (Pedidos extras originados no campo)
CREATE TABLE IF NOT EXISTS public.change_orders_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    task_id UUID NULL REFERENCES public.project_tasks(id) ON DELETE SET NULL,
    requested_by_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    requested_by_user_name TEXT NULL,
    
    client_request_text TEXT NOT NULL,
    field_notes TEXT NULL,
    photo_urls JSONB DEFAULT '[]'::jsonb,
    
    status VARCHAR(40) NOT NULL DEFAULT 'PENDING_COMMERCIAL'
        CHECK (status IN ('PENDING_COMMERCIAL', 'PRICED', 'APPROVED', 'REJECTED')),
    
    priced_amount NUMERIC(15,2) NULL DEFAULT 0.00,
    priced_notes TEXT NULL,
    contract_amendment_id UUID NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_change_orders_tenant_proj ON public.change_orders_requests(tenant_id, project_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_status ON public.change_orders_requests(status);

ALTER TABLE public.change_orders_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'change_orders_requests' AND policyname = 'change_orders_isolation_policy'
    ) THEN
        CREATE POLICY change_orders_isolation_policy ON public.change_orders_requests
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM public.projects p
                    WHERE p.id = change_orders_requests.project_id
                    AND (
                        p.tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid
                        OR (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'tenant_id')::uuid = p.tenant_id
                    )
                )
            );
    END IF;
END $$;

