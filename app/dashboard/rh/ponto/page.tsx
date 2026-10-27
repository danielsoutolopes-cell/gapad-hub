import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import PontoMobileClient from './ponto-mobile-client';

export const dynamic = 'force-dynamic';

export default async function PontoPage() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) redirect('/login');

  const tenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
  let tenantName = 'Empresa Teste';

  if (tenantId) {
    const { data: company } = await supabase.from('companies').select('trade_name').eq('id', tenantId).maybeSingle();
    if (company?.trade_name) tenantName = company.trade_name;
  }

  const isSuperAdmin = user.app_metadata?.is_superadmin === true || user.user_metadata?.is_superadmin === true;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      <DashboardNav tenantName={tenantName} isSuperAdmin={isSuperAdmin} />
      <main className="max-w-md mx-auto px-4 py-8 flex-1 w-full flex items-center justify-center">
        <PontoMobileClient />
      </main>
    </div>
  );
}
