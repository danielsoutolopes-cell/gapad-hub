-- ==============================================================================
-- GADAP Hub - Migração 20261024000006: Módulo MASTER / Super Admin
-- ==============================================================================

-- 1. Adicionar coluna is_superadmin na tabela public.users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.is_superadmin IS 'Indica se o usuário possui privilégios de Super Administrador (MASTER) para backoffice global do SaaS.';

-- 2. Índice parcial para localização veloz de Super Admins
CREATE INDEX IF NOT EXISTS idx_users_is_superadmin 
ON public.users(is_superadmin) 
WHERE is_superadmin = TRUE;
