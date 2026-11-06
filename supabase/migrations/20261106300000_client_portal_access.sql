-- =============================================================================
-- Migration: 20261106300000_client_portal_access.sql
-- Prompt 93: Portal do Cliente (Transparência, Curva S, Fotos e Assinatura Gov.br)
-- =============================================================================

-- 1. Garante colunas de suporte na tabela public.users
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- 2. Índice para consultas rápidas de usuários do Portal do Cliente
CREATE INDEX IF NOT EXISTS idx_users_client_id ON public.users(client_id);
CREATE INDEX IF NOT EXISTS idx_users_role_tenant ON public.users(tenant_id, role);

-- 3. Atualiza comentários explicativos
COMMENT ON COLUMN public.users.client_id IS 'ID do cliente externo vinculado quando role = CLIENT (Prompt 93).';

