import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { SubcontratosObraClient } from './subcontratos-obra-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Subcontratos & Gestão de Terceirizados (Modelo Farol) | GADAP Hub',
  description:
    'Gestão ágil de subempreiteiros em canteiro de obras: conta corrente desburocratizada, campos de atuação e Farol de Risco Físico-Financeiro (Zero Travas).',
};

interface SubcontratosPageProps {
  params: {
    id: string;
  };
}

export default async function SubcontratosPage({ params }: SubcontratosPageProps) {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(`/login?redirect=/dashboard/obras/${params.id}/subcontratos`);
  }

  const tenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
  let tenantName = 'Minha Empresa';

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

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      <DashboardNav tenantName={tenantName} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <SubcontratosObraClient projectId={params.id} />
      </main>
    </div>
  );
}
