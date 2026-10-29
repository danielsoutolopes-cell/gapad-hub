import { createBrowserClient } from '@supabase/ssr';

/**
 * Cliente Supabase para execução em componentes cliente do navegador (Client Components).
 * Utiliza as credenciais públicas que respeitam compulsoriamente as regras de RLS do PostgreSQL.
 */
export function createClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
