-- ==============================================================================
-- GADAP Hub - Migração 20261028000002: Logística de Canteiro (Portaria Digital)
-- Dialeto: PostgreSQL 16 (Supabase)
-- Diretrizes: Idempotente, RLS Hermético por Tenant, UUIDv7 / UUIDv4
-- ==============================================================================

-- 1. TABELA: material_transfers (Termos de Retirada e Recebimento de Materiais)
CREATE TABLE IF NOT EXISTS public.material_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    description TEXT NOT NULL,
    carrier_name VARCHAR(255) NOT NULL,
    carrier_document VARCHAR(50) NOT NULL,
    license_plate VARCHAR(20),
    signature_base64 TEXT NOT NULL,
    photos_json JSONB DEFAULT '[]'::jsonb,
    geolocation_json JSONB DEFAULT '{}'::jsonb,
    pdf_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_material_transfers_type CHECK (type IN ('WITHDRAWAL', 'RECEIPT'))
);

COMMENT ON TABLE public.material_transfers IS 'Termos de retirada (saída) e recebimento (entrada) de insumos e equipamentos em canteiro de obras com assinatura digital e geolocalização.';
COMMENT ON COLUMN public.material_transfers.type IS 'Tipo da operação de logística: WITHDRAWAL (Retirada/Saída) ou RECEIPT (Recebimento/Entrada)';
COMMENT ON COLUMN public.material_transfers.signature_base64 IS 'Assinatura digital capturada na tela do operador/motorista (formato data:image/png;base64,...)';
COMMENT ON COLUMN public.material_transfers.photos_json IS 'Array JSON contendo URLs ou metadados das fotos capturadas na portaria do canteiro';
COMMENT ON COLUMN public.material_transfers.geolocation_json IS 'Objeto JSON com latitude, longitude, precisão e timestamp da captura GPS';
COMMENT ON COLUMN public.material_transfers.pdf_url IS 'URL pública ou assinada do PDF do Termo de Responsabilidade e Guarda gerado pelo backend';

-- 2. ÍNDICES DE PERFORMANCE E BUSCA
CREATE INDEX IF NOT EXISTS idx_material_transfers_tenant_project 
ON public.material_transfers(tenant_id, project_id);

CREATE INDEX IF NOT EXISTS idx_material_transfers_created_at 
ON public.material_transfers(created_at DESC);

-- 3. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.material_transfers ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS RLS (ISOLAMENTO MULTI-TENANT HERMÉTICO)
DROP POLICY IF EXISTS tenant_isolation_material_transfers_select ON public.material_transfers;
CREATE POLICY tenant_isolation_material_transfers_select ON public.material_transfers
    FOR SELECT
    USING (
        tenant_id = public.get_current_tenant()
        OR (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
        OR (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
        OR (auth.jwt() -> 'user_metadata' ->> 'is_superadmin') = 'true'
    );

DROP POLICY IF EXISTS tenant_isolation_material_transfers_insert ON public.material_transfers;
CREATE POLICY tenant_isolation_material_transfers_insert ON public.material_transfers
    FOR INSERT
    WITH CHECK (
        tenant_id = public.get_current_tenant()
        OR (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
        OR (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
        OR (auth.jwt() -> 'user_metadata' ->> 'is_superadmin') = 'true'
    );

DROP POLICY IF EXISTS tenant_isolation_material_transfers_update ON public.material_transfers;
CREATE POLICY tenant_isolation_material_transfers_update ON public.material_transfers
    FOR UPDATE
    USING (
        tenant_id = public.get_current_tenant()
        OR (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
        OR (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
        OR (auth.jwt() -> 'user_metadata' ->> 'is_superadmin') = 'true'
    );

-- Trigger de updated_at
DROP TRIGGER IF EXISTS trg_material_transfers_updated_at ON public.material_transfers;
CREATE TRIGGER trg_material_transfers_updated_at
    BEFORE UPDATE ON public.material_transfers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Notificar PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';
