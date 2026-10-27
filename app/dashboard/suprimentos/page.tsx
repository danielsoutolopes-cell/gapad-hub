import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { SuprimentosClient } from './suprimentos-client';

export const dynamic = 'force-dynamic';

export default async function SuprimentosPage() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) redirect('/login');

  const tenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
  let tenantName = 'Empresa Teste';
  let activeModules = ['CORE', 'FISCAL', 'FINANCEIRO', 'SUPRIMENTOS', 'RH', 'CRM'];

  if (tenantId) {
    const { data: company } = await supabase.from('companies').select('trade_name, active_modules').eq('id', tenantId).maybeSingle();
    if (company?.trade_name) tenantName = company.trade_name;
    if (company?.active_modules) activeModules = company.active_modules;
  }

  const isSuperAdmin = user.app_metadata?.is_superadmin === true || user.user_metadata?.is_superadmin === true;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      <DashboardNav tenantName={tenantName} isSuperAdmin={isSuperAdmin} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <SuprimentosClient activeModules={activeModules} />
      </main>
    </div>
  );
}
