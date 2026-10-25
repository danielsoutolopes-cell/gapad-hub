import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { MeiAcademyClient } from './mei-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Onboarding Expresso para MEIs e Arquitetos | GADAP Hub',
  description:
    'Guia ultra rápido em 3 passos para autônomos, arquitetos e pequenas empreiteiras: Orçamento com Markup, criação de obra e emissão de nota com isenção fiscal.',
};

export default async function MeiAcademyPage() {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login?redirect=/dashboard/academy/mei');
  }

  const tenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
  let tenantName = 'Minha Empresa';
  let taxRegime = 'MEI';

  if (tenantId) {
    const { data: company } = await supabase
      .from('companies')
      .select('trade_name, tax_regime')
      .eq('id', tenantId)
      .maybeSingle();

    if (company?.trade_name) {
      tenantName = company.trade_name;
    }
    if (company?.tax_regime) {
      taxRegime = company.tax_regime;
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
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      <DashboardNav tenantName={tenantName} isSuperAdmin={isSuperAdmin} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <MeiAcademyClient tenantName={tenantName} taxRegime={taxRegime} />
      </main>
    </div>
  );
}
