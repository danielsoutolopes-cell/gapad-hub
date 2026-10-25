import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
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

    // 3. Consultar dados com Service Role
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

    const [companiesRes, usersRes, projectsRes, medicoesRes, clientsRes] = await Promise.all([
      adminClient.from('companies').select('*').order('created_at', { ascending: false }),
      adminClient.from('users').select('id, tenant_id'),
      adminClient.from('projects').select('id, tenant_id, status'),
      adminClient.from('medicoes').select('id, tenant_id'),
      adminClient.from('clients').select('id, tenant_id'),
    ]);

    const companies = companiesRes.data || [];
    const allUsers = usersRes.data || [];
    const allProjects = projectsRes.data || [];
    const allMedicoes = medicoesRes.data || [];
    const allClients = clientsRes.data || [];

    let totalActiveProjectsGlobal = 0;

    const tenantsSummary = companies.map((comp) => {
      const compId = comp.id;
      const tUsers = allUsers.filter((u) => u.tenant_id === compId);
      const tProjects = allProjects.filter((p) => p.tenant_id === compId);
      const tActiveProj = tProjects.filter((p) =>
        ['em_andamento', 'ativa', 'ativo'].includes(p.status)
      );
      const tMedicoes = allMedicoes.filter((m) => m.tenant_id === compId);
      const tClients = allClients.filter((c) => c.tenant_id === compId);

      totalActiveProjectsGlobal += tActiveProj.length;

      return {
        id: comp.id,
        legal_name: comp.legal_name,
        trade_name: comp.trade_name,
        cnpj: comp.cnpj,
        email: comp.email,
        phone: comp.phone,
        address_city: comp.address_city,
        address_state: comp.address_state,
        is_active: comp.is_active ?? true,
        created_at: comp.created_at,
        stats: {
          total_users: tUsers.length,
          total_active_projects: tActiveProj.length,
          total_projects: tProjects.length,
          total_measurements: tMedicoes.length,
          total_clients: tClients.length,
        },
      };
    });

    return NextResponse.json({
      total_tenants: companies.length,
      total_users_global: allUsers.length,
      total_active_projects_global: totalActiveProjectsGlobal,
      tenants: tenantsSummary,
    });
  } catch (error: any) {
    return NextResponse.json(
      { detail: error.message || 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}
