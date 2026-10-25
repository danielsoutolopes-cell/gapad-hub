import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { MedicoesObraClient } from './medicoes-obra-client';

export const dynamic = 'force-dynamic';

interface MedicoesPageProps {
  params: {
    id: string;
  };
}

export default async function MedicoesPage({ params }: MedicoesPageProps) {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(`/login?redirect=/dashboard/obras/${params.id}/medicoes`);
  }

  const tenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
  let tenantName = 'Empresa Teste';

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
        <MedicoesObraClient projectId={params.id} />
      </main>
    </div>
  );
}
