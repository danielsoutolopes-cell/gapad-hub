import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { ExecutiveDashboardClient } from './dashboard-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard Executivo & Analytics | GADAP Hub',
  description:
    'Painel analítico da diretoria com indicadores de faturamento, DRE gerencial por centro de custo e Curva S de engenharia.',
};

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login?redirect=/dashboard');
  }

  const tenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
  let tenantName = 'Construtora Exemplo';

  if (tenantId) {
    const { data: company } = await supabase
      .from('companies')
      .select('trade_name')
      .eq('id', tenantId)
      .maybeSingle();
    if (company?.trade_name) {
      tenantName = company.trade_name;
    }
  }

  let isSuperAdmin = false;
  if (user) {
    const { data: dbUser } = await supabase
      .from('users')
      .select('is_superadmin')
      .eq('id', user.id)
      .maybeSingle();
    isSuperAdmin = !!dbUser?.is_superadmin;
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col print:bg-white print:text-slate-900">
      <div className="print:hidden">
        <DashboardNav tenantName={tenantName} isSuperAdmin={isSuperAdmin} />
      </div>
      <main className="flex-1">
        <ExecutiveDashboardClient tenantName={tenantName} />
      </main>
    </div>
  );
}
