import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { CronogramaClient } from './cronograma-client';

export const dynamic = 'force-dynamic';

export default async function CronogramaObraPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect('/login');

  const tenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
  let tenantName = 'Empresa Teste';
  let activeModules: string[] = ['CORE', 'FISCAL', 'FINANCEIRO', 'SUPRIMENTOS', 'RH', 'CRM', 'GANTT'];

  if (tenantId) {
    const { data: company } = await supabase
      .from('companies')
      .select('trade_name, active_modules')
      .eq('id', tenantId)
      .maybeSingle();
    if (company?.trade_name) tenantName = company.trade_name;
    if (company?.active_modules) activeModules = company.active_modules;
  }

  // Busca dados da obra
  let projectName = 'Residencial Jardins Lorena';
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, code')
    .eq('id', params.id)
    .maybeSingle();

  if (project?.name) {
    projectName = project.name;
  }

  const isSuperAdmin =
    user.app_metadata?.is_superadmin === true || user.user_metadata?.is_superadmin === true;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      <DashboardNav tenantName={tenantName} isSuperAdmin={isSuperAdmin} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <CronogramaClient
          projectId={params.id}
          projectName={projectName}
          activeModules={activeModules}
        />
      </main>
    </div>
  );
}

