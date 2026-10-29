import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const AUTHORIZED_STATUSES = [
  'AUTHORIZED',
  'authorized',
  'AUTORIZADO',
  'autorizado',
  'AUTORIZADA',
  'autorizada',
];

const ACTIVE_PROJECT_STATUSES = ['EM_ANDAMENTO', 'em_andamento'];

const PT_MONTHS: Record<number, string> = {
  1: 'Janeiro',
  2: 'Fevereiro',
  3: 'Março',
  4: 'Abril',
  5: 'Maio',
  6: 'Junho',
  7: 'Julho',
  8: 'Agosto',
  9: 'Setembro',
  10: 'Outubro',
  11: 'Novembro',
  12: 'Dezembro',
};

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const serverSupabase = createServerClient();

    const headerAuth = request.headers.get('authorization');
    let authToken =
      headerAuth && headerAuth.startsWith('Bearer ')
        ? headerAuth.slice(7).trim()
        : null;

    if (!authToken) {
      const {
        data: { session },
      } = await serverSupabase.auth.getSession();
      authToken = session?.access_token || null;
    }

    if (!authToken) {
      return NextResponse.json(
        { detail: 'Token de autorização JWT ausente.' },
        { status: 401 }
      );
    }

    const jwtPayload = decodeJwtPayload(authToken);
    let tenantId =
      jwtPayload?.app_metadata?.tenant_id ||
      jwtPayload?.user_metadata?.tenant_id ||
      jwtPayload?.tenant_id;

    if (!tenantId) {
      const {
        data: { user },
      } = await serverSupabase.auth.getUser(authToken);
      tenantId =
        user?.app_metadata?.tenant_id || user?.user_metadata?.tenant_id;
    }

    if (!tenantId) {
      return NextResponse.json(
        { detail: 'Acesso Proibido: Usuário autenticado não possui tenant_id vinculado no JWT.' },
        { status: 403 }
      );
    }

    // 1. Encaminha para o backend FastAPI caso esteja ativo na porta 8000
    const fastApiBaseUrl = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';
    try {
      const targetUrl = `${fastApiBaseUrl.replace(/\/$/, '')}/api/v1/analytics/executive`;
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    } catch {
      // Se o processo FastAPI não estiver ativo localmente, executa as queries reais direto no Supabase com RLS
    }

    // 2. Cliente Supabase autenticado com o JWT da requisição para acionamento automático de RLS
    const supabase = createSupabaseJsClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
        auth: {
          persistSession: false,
        },
      }
    );

    // Query 1: gross_revenue = SOMA do total_invoice_amount da tabela invoices onde status é autorizado
    let invoicesRows: any[] = [];
    const { data: invData, error: invErr } = await supabase
      .from('invoices')
      .select(
        'total_invoice_amount, gross_amount, net_amount, iss_retained_amount, inss_retained_amount, irrf_retained_amount, csll_retained_amount, status, authorized_at'
      )
      .eq('tenant_id', tenantId)
      .in('status', AUTHORIZED_STATUSES);

    if (!invErr && invData) {
      invoicesRows = invData;
    } else {
      const { data: fiscalData } = await supabase
        .from('fiscal_invoices')
        .select(
          'gross_amount, net_amount, iss_retained_amount, inss_retained_amount, irrf_retained_amount, csll_retained_amount, status, authorized_at'
        )
        .eq('tenant_id', tenantId)
        .in('status', AUTHORIZED_STATUSES);
      invoicesRows = fiscalData || [];
    }

    const grossRevenue = invoicesRows.reduce(
      (acc, row) => acc + Number(row.total_invoice_amount ?? row.gross_amount ?? 0),
      0
    );

    const fiscalRetentions = invoicesRows.reduce(
      (acc, row) =>
        acc +
        Number(row.iss_retained_amount ?? 0) +
        Number(row.inss_retained_amount ?? 0) +
        Number(row.irrf_retained_amount ?? 0) +
        Number(row.csll_retained_amount ?? 0),
      0
    );

    // Query 2: active_projects = COUNT da tabela projects onde status é 'EM_ANDAMENTO'
    const { count: activeProjectsCount, data: activeProjectsData } = await supabase
      .from('projects')
      .select('id, status', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .in('status', ACTIVE_PROJECT_STATUSES);

    const activeProjects =
      typeof activeProjectsCount === 'number'
        ? activeProjectsCount
        : (activeProjectsData || []).length;

    // Query 3: Despesas e retenções técnicas reais em financial_entries
    const { data: entriesData } = await supabase
      .from('financial_entries')
      .select('entry_type, nominal_amount, technical_retention_amount, net_amount, status, due_date')
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelado');

    let technicalRetentions = 0;
    let totalExpenses = 0;
    for (const entry of entriesData || []) {
      const etype = String(entry.entry_type || '').toLowerCase();
      const nominal = Number(entry.nominal_amount || 0);
      const retention = Number(entry.technical_retention_amount || 0);
      if (etype === 'receivable' || etype === 'a_receber') {
        technicalRetentions += retention;
      } else if (etype === 'payable' || etype === 'a_pagar') {
        totalExpenses += nominal;
      }
    }

    const grossRevenueRounded = Number(grossRevenue.toFixed(2));
    const totalRetentions = Number((fiscalRetentions + technicalRetentions).toFixed(2));
    const totalExpensesRounded = Number(totalExpenses.toFixed(2));
    const netProfit = Number(
      (grossRevenueRounded - fiscalRetentions - totalExpensesRounded).toFixed(2)
    );
    const margemLucro =
      grossRevenueRounded > 0
        ? Number(((netProfit / grossRevenueRounded) * 100).toFixed(2))
        : 0;
    const ticketMedio =
      invoicesRows.length > 0
        ? Number((grossRevenueRounded / invoicesRows.length).toFixed(2))
        : 0;

    const now = new Date();
    const mesReferencia = `${PT_MONTHS[now.getMonth() + 1] || 'Mês'}/${now.getFullYear()}`;

    return NextResponse.json({
      tenant_id: tenantId,
      gross_revenue: grossRevenueRounded,
      active_projects: activeProjects,
      net_profit: netProfit,
      total_retentions: totalRetentions,
      total_expenses: totalExpensesRounded,
      faturamento_total_mes: grossRevenueRounded,
      ticket_medio: ticketMedio,
      total_retencoes_fiscais: totalRetentions,
      lucro_bruto_projetado: netProfit,
      margem_lucro_perc: margemLucro,
      obras_ativas: activeProjects,
      receitas_mes: grossRevenueRounded,
      despesas_mes: totalExpensesRounded,
      comparativo_mes_anterior_perc: 0,
      mes_referencia: mesReferencia,
    });
  } catch (error: any) {
    return NextResponse.json(
      { detail: error?.message || 'Erro interno ao consultar dados executivos.' },
      { status: 500 }
    );
  }
}
