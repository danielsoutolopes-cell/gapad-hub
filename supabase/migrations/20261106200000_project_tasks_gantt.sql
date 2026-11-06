-- =============================================================================
-- Migration: 20261106200000_project_tasks_gantt.sql
-- Prompt 92: Cronograma Físico-Financeiro (Gantt) & Curva S (Planejado vs Realizado)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    progress_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    budget_rubric_id UUID NULL,
    dependencies_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    planned_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_task_dates CHECK (end_date >= start_date)
);

-- Índices para consultas de alta performance no gráfico de Gantt e cálculo da Curva S
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON public.project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_dates ON public.project_tasks(project_id, start_date, end_date);

-- RLS (Row Level Security) herdando do projeto vinculado
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'project_tasks' AND policyname = 'project_tasks_isolation_policy'
    ) THEN
        CREATE POLICY project_tasks_isolation_policy ON public.project_tasks
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM public.projects p
                    WHERE p.id = project_tasks.project_id
                    AND (
                        p.tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid
                        OR (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'tenant_id')::uuid = p.tenant_id
                    )
                )
            );
    END IF;
END $$;

