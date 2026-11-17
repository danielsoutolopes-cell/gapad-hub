'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { resetDemoTenantData } from '@/lib/demo-reset';

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

  const supabase = createClient({ ignoreExistingCookies: true });

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
 * Caso o usuário seja o usuário de testes (admin@teste.com), executa compulsoriamente
 * o descarte de todas as alterações feitas e restaura o ambiente sintético original da Empresa Teste.
 */
export async function logout(): Promise<void> {
  const supabase = createClient();
  
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Se o usuário que está fazendo logout for o usuário teste de demonstração
    if (user?.email === 'admin@teste.com') {
      const tenantId =
        user.app_metadata?.tenant_id ||
        user.user_metadata?.tenant_id ||
        '7ffdf475-b337-4282-ae1f-3f8056394334';

      console.log(`[Logout] Usuário teste (admin@teste.com) efetuando logout. Descartando alterações do tenant ${tenantId}...`);
      await resetDemoTenantData(tenantId);
    }
  } catch (err) {
    console.error('[Logout] Erro durante verificação/descarte de dados de teste:', err);
  }

  await supabase.auth.signOut();
  redirect('/login');
}
