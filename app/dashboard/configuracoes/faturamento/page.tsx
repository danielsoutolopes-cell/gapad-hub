import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { BillingClient } from './billing-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Faturamento & Assinatura | GADAP Hub ERP',
  description: 'Gerencie seu plano, benefícios comerciais e histórico de faturamento.',
};

export default async function BillingPage() {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  const tenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
  let company = null;

  if (tenantId) {
    const { data } = await supabase
      .from('companies')
      .select('id, trade_name, legal_name, cnpj, plan_status, trial_ends_at, discount_expires_at, renewal_count, max_renewals, metadata_json')
      .eq('id', tenantId)
      .maybeSingle();
    company = data;
  }

  return (
    <div className="space-y-6">
      <BillingClient company={company} userEmail={user.email || null} />
    </div>
  );
}
