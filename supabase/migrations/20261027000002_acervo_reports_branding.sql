-- ==============================================================================
-- MIGRATION: FASES 22 & 23 (PROMPTS 75 & 76)
-- ACERVO TÉCNICO EXTERNO ZERO-STORAGE, FIELD REPORTS & ONBOARDING WHITE-LABEL
-- ==============================================================================

-- 1. PROMPT 75: Atualização da tabela projects para Acervo Técnico Externo
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS art_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS permit_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS technical_lead VARCHAR(255),
ADD COLUMN IF NOT EXISTS external_drives_json JSONB DEFAULT '{}'::jsonb;

-- Tabela de relatórios de campo (Field Reports com Zero-Storage de imagens)
CREATE TABLE IF NOT EXISTS public.field_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    progress_percentage NUMERIC(5, 2) DEFAULT 0.00,
    client_whatsapp VARCHAR(30),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.field_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "field_reports_tenant_isolation" ON public.field_reports
    FOR ALL
    USING (
        project_id IN (
            SELECT p.id FROM public.projects p
            WHERE p.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
               OR p.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        )
    );

-- 2. PROMPT 76: Atualização da tabela companies para White-Label Branding
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS website VARCHAR(255),
ADD COLUMN IF NOT EXISTS social_media_json JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS address_json JSONB DEFAULT '{}'::jsonb;

-- Bucket de Storage para Tenant Branding
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-branding', 'tenant-branding', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de Storage para tenant-branding
CREATE POLICY "Public Read Tenant Branding"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-branding');

CREATE POLICY "Tenant Admin Insert Tenant Branding"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'tenant-branding'
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Tenant Admin Update Tenant Branding"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'tenant-branding'
    AND auth.role() = 'authenticated'
);
