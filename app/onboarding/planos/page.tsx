import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { OnboardingPlanosClient } from './onboarding-planos-client';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Planos & Checkout SaaS (PLG) | GADAP Hub ERP',
  description: 'Escolha o plano ideal com 6 meses de isenção nos módulos Core + Fiscal e 50% de desconto nos módulos extras.',
};

export default async function OnboardingPlanosPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let companyData = null;
  if (user) {
    const tenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
    if (tenantId) {
      const { data } = await supabase
        .from('companies')
        .select('id, trade_name, plan_status, trial_ends_at, discount_expires_at, renewal_count, max_renewals, metadata_json')
        .eq('id', tenantId)
        .maybeSingle();
      companyData = data;
    }
  }

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-black">
      <OnboardingPlanosClient company={companyData} userEmail={user?.email || null} />
    </div>
  );
}
