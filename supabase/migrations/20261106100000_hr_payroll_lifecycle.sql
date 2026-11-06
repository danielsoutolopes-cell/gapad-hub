-- =============================================================================
-- Migration: 20261106100000_hr_payroll_lifecycle.sql
-- Fase 16 • Departamento Pessoal Completo (Admissão, Férias, Rescisão e Folha)
-- =============================================================================

-- 1. Criação do Enum de Status do Funcionário (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_lifecycle_status') THEN
        CREATE TYPE public.employee_lifecycle_status AS ENUM ('ACTIVE', 'ON_LEAVE', 'VACATION', 'TERMINATED');
    END IF;
END $$;

-- 2. Expansão da tabela public.employees
ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS base_salary NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS termination_date DATE,
    ADD COLUMN IF NOT EXISTS termination_reason TEXT,
    ADD COLUMN IF NOT EXISTS vacation_start_date DATE,
    ADD COLUMN IF NOT EXISTS vacation_end_date DATE,
    ADD COLUMN IF NOT EXISTS leave_reason TEXT,
    ADD COLUMN IF NOT EXISTS status public.employee_lifecycle_status DEFAULT 'ACTIVE';

-- Atualiza funcionários existentes sem status
UPDATE public.employees
SET status = CASE 
    WHEN is_active IS FALSE THEN 'TERMINATED'::public.employee_lifecycle_status
    ELSE 'ACTIVE'::public.employee_lifecycle_status
END
WHERE status IS NULL;

-- 3. Criação da tabela payroll_records
CREATE TABLE IF NOT EXISTS public.payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    reference_month VARCHAR(7) NOT NULL, -- Ex: '2026-11'
    gross_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    base_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    overtime_hours NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    overtime_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    absent_days INT NOT NULL DEFAULT 0,
    absence_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    inss_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    irrf_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    other_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    deductions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT', -- DRAFT, APPROVED, PAID, CANCELLED
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_payroll_employee_month UNIQUE (employee_id, reference_month)
);

-- 4. Índices para performance de consulta
CREATE INDEX IF NOT EXISTS idx_employees_tenant_status ON public.employees(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payroll_records_tenant_month ON public.payroll_records(tenant_id, reference_month);
CREATE INDEX IF NOT EXISTS idx_time_logs_employee_date ON public.time_logs(employee_id, logged_at);

-- 5. Row Level Security (RLS)
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'payroll_records' AND policyname = 'tenant_isolation_payroll_records'
    ) THEN
        CREATE POLICY tenant_isolation_payroll_records ON public.payroll_records
            FOR ALL
            USING (
                tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid
                OR (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id
            );
    END IF;
END $$;

