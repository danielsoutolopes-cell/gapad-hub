import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { SuperadminAdminClient } from './superadmin-admin-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Painel Master do Superusuário (Zero-Knowledge) | GADAP Hub',
  description: 'Administração global do SaaS com isolamento estrito: proibição de visualização de dados confidenciais de empresas.',
};

export default async function SuperadminPage() {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login?redirect=/dashboard/admin');
  }

  // Validação estrita de Super Administrador
  const isSuperAdminMeta =
    user.app_metadata?.is_superadmin === true ||
    user.user_metadata?.is_superadmin === true ||
    user.app_metadata?.role === 'superadmin';

  let isSuperAdminDb = false;
  const { data: dbUser } = await supabase
    .from('users')
    .select('is_superadmin, role')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (dbUser?.is_superadmin === true || dbUser?.role === 'superadmin') {
    isSuperAdminDb = true;
  }

  if (!isSuperAdminMeta && !isSuperAdminDb) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <SuperadminAdminClient superadminEmail={user.email || 'superadmin@gadap.com.br'} />
      </main>
    </div>
  );
}
