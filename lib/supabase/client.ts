import { createBrowserClient } from '@supabase/ssr';

/**
 * Cliente Supabase para execução em componentes cliente do navegador (Client Components).
 * Utiliza as credenciais públicas que respeitam compulsoriamente as regras de RLS do PostgreSQL.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
