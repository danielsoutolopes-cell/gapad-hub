import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { SimuladorReformaClient } from './simulador-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Simulador da Reforma Tributária & IVA Dual | GADAP Hub',
  description:
    'Simulação paralela do impacto da Reforma Tributária (EC 132/2023) nas medições de obras: Modelo Legado vs IVA Dual (CBS/IBS) com Não-Cumulatividade Plena.',
};

export default async function SimuladorReformaPage() {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login?redirect=/dashboard/fiscal/simulador-reforma');
  }

  const tenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
  let tenantName = 'Construtora Teste';

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
        <SimuladorReformaClient tenantName={tenantName} />
      </main>
    </div>
  );
}
