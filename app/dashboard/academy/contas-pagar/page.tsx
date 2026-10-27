import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { ContasPagarAcademyClient } from './contas-pagar-academy-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Guia Prático: Automação do Contas a Pagar | GADAP Hub Academy',
  description:
    'Descubra como o GADAP Hub elimina a digitação manual de notas e boletos da sua construtora com Captura DFe SEFAZ, 1-Click Payable e IA OCR.',
};

export default async function ContasAPagarAcademyPage() {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login?redirect=/dashboard/academy/contas-pagar');
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
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <ContasPagarAcademyClient />
      </main>
    </div>
  );
}
