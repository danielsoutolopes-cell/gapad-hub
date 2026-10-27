import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/components/layout/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
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

  const isSuperAdmin =
    user.app_metadata?.is_superadmin === true ||
    user.user_metadata?.is_superadmin === true ||
    user.app_metadata?.role === 'superadmin';

  return (
    <DashboardShell tenantName={tenantName} isSuperAdmin={isSuperAdmin}>
      {children}
    </DashboardShell>
  );
}
