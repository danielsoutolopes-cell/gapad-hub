import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Cliente Supabase para execução em Server Components, Server Actions e Route Handlers.
 * Mantém sessão e autenticação através de cookies HTTP-only de forma segura.
 */
export function createClient(options?: { ignoreExistingCookies?: boolean }) {
  const cookieStore = cookies();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          if (options?.ignoreExistingCookies) {
            return undefined;
          }
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Em Server Components a manipulação direta de cookies é apenas leitura
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Em Server Components a manipulação direta de cookies é apenas leitura
          }
        },
      },
    }
  );
}
