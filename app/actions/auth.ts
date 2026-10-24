'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export interface AuthResponse {
  error?: string | null;
  success?: boolean;
}

/**
 * Server Action de Autenticação Segura.
 * Executa signInWithPassword via @supabase/ssr com persistência de sessão em cookies HTTP-only.
 * Injeta tenant_id via app_metadata do Supabase para validação de RLS no PostgreSQL.
 */
export async function login(formData: FormData): Promise<AuthResponse | void> {
  const email = formData.get('email')?.toString().trim();
  const password = formData.get('password')?.toString();

  if (!email || !password) {
    return {
      error: 'Informe seu e-mail corporativo e senha de acesso.',
    };
  }

  const supabase = createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Tratamento de mensagens amigáveis em português
    const msg = error.message.toLowerCase();
    if (msg.includes('invalid login credentials')) {
      return { error: 'Credenciais inválidas. Verifique seu e-mail e senha.' };
    }
    if (msg.includes('email not confirmed')) {
      return { error: 'E-mail não confirmado. Acesse o link enviado para validação.' };
    }
    if (msg.includes('too many requests')) {
      return { error: 'Muitas tentativas consecutivas. Aguarde alguns instantes.' };
    }
    return { error: error.message };
  }

  // Se o login for bem-sucedido, redireciona o usuário para o painel operacional de obras
  redirect('/dashboard/obras');
}

/**
 * Server Action para encerramento de sessão e descarte dos cookies de autenticação.
 */
export async function logout(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
