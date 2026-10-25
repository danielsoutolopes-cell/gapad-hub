import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = params.id;

    // 1. Validar autenticação do usuário logado
    const supabase = createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { detail: 'Não autenticado' },
        { status: 401 }
      );
    }

    // 2. Validar se é SuperAdmin
    const isSuperAdminMeta =
      user.app_metadata?.is_superadmin === true ||
      user.user_metadata?.is_superadmin === true ||
      user.app_metadata?.role === 'superadmin';

    let isSuperAdminDb = false;
    const { data: dbUser } = await supabase
      .from('users')
      .select('is_superadmin, role')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (dbUser?.is_superadmin === true || dbUser?.role === 'superadmin') {
      isSuperAdminDb = true;
    }

    if (!isSuperAdminMeta && !isSuperAdminDb) {
      return NextResponse.json(
        { detail: 'Acesso Proibido: Requer privilégios de Super Administrador (MASTER).' },
        { status: 403 }
      );
    }

    // 3. Executar expurgo via Admin Client com Service Role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dkjcgrwztyhcsyxlajia.supabase.co';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json(
        { detail: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 4. Verificar se a empresa existe
    const { data: company, error: companyErr } = await adminClient
      .from('companies')
      .select('id, trade_name, legal_name')
      .eq('id', tenantId)
      .maybeSingle();

    if (companyErr || !company) {
      return NextResponse.json(
        { detail: `Empresa com ID ${tenantId} não encontrada.` },
        { status: 404 }
      );
    }

    const tenantName = company.trade_name || company.legal_name;

    // 5. Expurgo em cascata reversa
    await adminClient.from('financial_entries').delete().eq('tenant_id', tenantId);
    await adminClient.from('medicoes').delete().eq('tenant_id', tenantId);

    const { data: quotes } = await adminClient
      .from('quotes')
      .select('id')
      .eq('tenant_id', tenantId);

    if (quotes && quotes.length > 0) {
      const quoteIds = quotes.map((q) => q.id);
      await adminClient.from('quote_items').delete().in('quote_id', quoteIds);
      await adminClient.from('quotes').delete().eq('tenant_id', tenantId);
    }

    await adminClient.from('projects').delete().eq('tenant_id', tenantId);
    await adminClient.from('clients').delete().eq('tenant_id', tenantId);
    await adminClient.from('suppliers').delete().eq('tenant_id', tenantId);
    await adminClient.from('products').delete().eq('tenant_id', tenantId);
    await adminClient.from('services').delete().eq('tenant_id', tenantId);

    return NextResponse.json({
      success: true,
      message: `Reset operacional concluído com sucesso para a empresa '${tenantName}'. Todas as obras, medições, clientes e dados financeiros foram expurgados. A empresa e os usuários foram preservados intactos.`,
      tenant_id: tenantId,
      tenant_name: tenantName,
      preserved_records: ['companies', 'users'],
      purged_domains: [
        'financial_entries',
        'medicoes',
        'quote_items',
        'quotes',
        'projects',
        'clients',
        'suppliers',
        'products',
        'services',
      ],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { detail: error.message || 'Erro durante o reset do tenant' },
      { status: 500 }
    );
  }
}
