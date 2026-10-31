-- ==============================================================================
-- GADAP Hub - Migração 20261031000000: Cofre Digital Certificado A1 (.pfx / .p12)
-- Descrição:
--   1. Adiciona colunas de cofre digital na tabela public.companies:
--      - cert_password (VARCHAR - senha cifrada via Fernet/AES-128-CBC + HMAC-SHA256)
--      - cert_expiration (TIMESTAMPTZ - data de expiração extraída do X.509 not_valid_after)
--      - cert_status (VARCHAR - 'VALID', 'EXPIRED', 'MISSING')
--   2. Cria o bucket ESTRITAMENTE PRIVADO 'tenant-certificates' no Supabase Storage.
--   3. Configura políticas RLS em storage.objects garantindo isolamento Multi-Tenant
--      (nenhum acesso público; apenas Service Role ou o próprio Tenant autenticado
--       pode ler/escrever no prefixo <tenant_id>/*).
-- ==============================================================================

-- 1. Atualização da tabela public.companies com colunas do Certificado A1
ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS cert_password VARCHAR(512),
    ADD COLUMN IF NOT EXISTS cert_expiration TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cert_status VARCHAR(50) DEFAULT 'MISSING';

COMMENT ON COLUMN public.companies.cert_password IS 'Senha do Certificado Digital A1 cifrada simetricamente via Fernet (SECRET_KEY global).';
COMMENT ON COLUMN public.companies.cert_expiration IS 'Data/hora de expiração (not_valid_after) extraída do Certificado X.509 ICP-Brasil.';
COMMENT ON COLUMN public.companies.cert_status IS 'Estado atual do Certificado A1: VALID, EXPIRED ou MISSING.';

-- 2. Criação do Bucket Privado 'tenant-certificates' (public = false)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'tenant-certificates',
    'tenant-certificates',
    false,
    5242880, -- Limite de 5MB para arquivos PKCS#12 (.pfx / .p12)
    ARRAY['application/x-pkcs12', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE
SET
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Políticas RLS para o Bucket Privado 'tenant-certificates'
-- Garante que NENHUM acesso público exista e que cada Tenant acesse apenas a pasta <tenant_id>/*
DROP POLICY IF EXISTS "tenant_certificates_select_own_tenant" ON storage.objects;
CREATE POLICY "tenant_certificates_select_own_tenant"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'tenant-certificates'
    AND (storage.foldername(name))[1] = public.get_current_tenant()::text
);

DROP POLICY IF EXISTS "tenant_certificates_insert_own_tenant" ON storage.objects;
CREATE POLICY "tenant_certificates_insert_own_tenant"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'tenant-certificates'
    AND (storage.foldername(name))[1] = public.get_current_tenant()::text
);

DROP POLICY IF EXISTS "tenant_certificates_update_own_tenant" ON storage.objects;
CREATE POLICY "tenant_certificates_update_own_tenant"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'tenant-certificates'
    AND (storage.foldername(name))[1] = public.get_current_tenant()::text
)
WITH CHECK (
    bucket_id = 'tenant-certificates'
    AND (storage.foldername(name))[1] = public.get_current_tenant()::text
);

DROP POLICY IF EXISTS "tenant_certificates_delete_own_tenant" ON storage.objects;
CREATE POLICY "tenant_certificates_delete_own_tenant"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'tenant-certificates'
    AND (storage.foldername(name))[1] = public.get_current_tenant()::text
);

-- Notifica o PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';

