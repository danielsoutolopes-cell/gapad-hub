import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const COST_CENTER_COLORS: Record<string, [string, string]> = {
  material_construcao: ['Materiais & Insumos', '#3B82F6'],
  material: ['Materiais & Insumos', '#3B82F6'],
  insumos: ['Insumos de Canteiro', '#06B6D4'],
  mao_de_obra: ['Mão de Obra & Empreiteiros', '#10B981'],
  locacao_equipamentos: ['Locação de Equipamentos', '#F59E0B'],
  equipamentos: ['Locação de Equipamentos', '#F59E0B'],
  impostos: ['Tributos & Retenções Fiscais', '#EF4444'],
  tributos: ['Tributos & Retenções Fiscais', '#EF4444'],
  administrativo: ['Despesas Administrativas', '#8B5CF6'],
  servicos_terceiros: ['Serviços Especializados', '#EC4899'],
  geral: ['Outras Despesas Operacionais', '#64748B'],
};

const PT_MONTHS: Record<number, [string, string]> = {
  1: ['Jan', 'Janeiro'],
  2: ['Fev', 'Fevereiro'],
  3: ['Mar', 'Março'],
  4: ['Abr', 'Abril'],
  5: ['Mai', 'Maio'],
  6: ['Jun', 'Junho'],
  7: ['Jul', 'Julho'],
  8: ['Ago', 'Agosto'],
  9: ['Set', 'Setembro'],
  10: ['Out', 'Outubro'],
  11: ['Nov', 'Novembro'],
  12: ['Dez', 'Dezembro'],
};

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
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
      return NextResponse.json({ detail: 'Não autorizado.' }, { status: 401 });
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
      return NextResponse.json({ detail: 'Tenant não vinculado.' }, { status: 403 });
    }

    const fastApiBaseUrl = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';
    try {
      const targetUrl = `${fastApiBaseUrl.replace(/\/$/, '')}/api/v1/analytics/financial/dre`;
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
      // Executa direto no Supabase com RLS caso o processo FastAPI não esteja ativo
    }

    const supabase = createSupabaseJsClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${authToken}` } },
        auth: { persistSession: false },
      }
    );

    const { data: invData } = await supabase
      .from('invoices')
      .select('total_invoice_amount, gross_amount, status')
      .eq('tenant_id', tenantId)
      .in('status', ['AUTHORIZED', 'authorized', 'AUTORIZADO', 'autorizado', 'AUTORIZADA', 'autorizada']);

    const { data: entries } = await supabase
      .from('financial_entries')
      .select('entry_type, category, nominal_amount, net_amount, status, due_date')
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelado');

    const receitasInvoices = (invData || []).reduce(
      (acc, r) => acc + Number(r.total_invoice_amount ?? r.gross_amount ?? 0),
      0
    );

    let receitasEntries = 0;
    let despesasTotal = 0;
    const porCategoria: Record<string, number> = {};
    const porMes: Record<string, { receitas: number; despesas: number }> = {};

    for (const entry of entries || []) {
      const etype = String(entry.entry_type || '').toLowerCase();
      const nominal = Number(entry.nominal_amount || 0);
      const catRaw = String(entry.category || 'geral').toLowerCase().trim();
      const dueStr = String(entry.due_date || '');
      const ym = dueStr.length >= 7 ? dueStr.slice(0, 7) : '';

      if (ym && !porMes[ym]) {
        porMes[ym] = { receitas: 0, despesas: 0 };
      }

      if (etype === 'receivable' || etype === 'a_receber') {
        receitasEntries += nominal;
        if (ym) porMes[ym].receitas += nominal;
      } else if (etype === 'payable' || etype === 'a_pagar') {
        despesasTotal += nominal;
        porCategoria[catRaw] = (porCategoria[catRaw] || 0) + nominal;
        if (ym) porMes[ym].despesas += nominal;
      }
    }

    const receitasTotal = receitasInvoices > 0 ? receitasInvoices : receitasEntries;

    const porCentroCusto = Object.entries(porCategoria)
      .map(([catKey, total]) => {
        const cfg = COST_CENTER_COLORS[catKey] || [
          catKey.replace(/_/g, ' '),
          '#94A3B8',
        ];
        const perc = despesasTotal > 0 ? Number(((total / despesasTotal) * 100).toFixed(1)) : 0;
        return {
          categoria: catKey,
          nome_exibicao: cfg[0],
          total: Number(total.toFixed(2)),
          percentual: perc,
          cor: cfg[1],
        };
      })
      .sort((a, b) => b.total - a.total);

    const evolucaoMensal = Object.keys(porMes)
      .sort()
      .slice(-6)
      .map((ym) => {
        const yearVal = Number(ym.slice(0, 4));
        const monthVal = Number(ym.slice(5, 7));
        const mInfo = PT_MONTHS[monthVal] || [ym, ym];
        const rec = Number(porMes[ym].receitas.toFixed(2));
        const desp = Number(porMes[ym].despesas.toFixed(2));
        const lucro = Number((rec - desp).toFixed(2));
        const margem = rec > 0 ? Number(((lucro / rec) * 100).toFixed(1)) : 0;
        return {
          mes: `${mInfo[0]}/${String(yearVal).slice(-2)}`,
          mes_completo: `${mInfo[1]}/${yearVal}`,
          receitas: rec,
          despesas: desp,
          lucro,
          margem_perc: margem,
        };
      });

    const resultadoLiquido = Number((receitasTotal - despesasTotal).toFixed(2));
    const margemLiquidaPerc =
      receitasTotal > 0 ? Number(((resultadoLiquido / receitasTotal) * 100).toFixed(2)) : 0;

    return NextResponse.json({
      tenant_id: tenantId,
      periodo: `Exercício ${new Date().getFullYear()}`,
      receitas_total: Number(receitasTotal.toFixed(2)),
      despesas_total: Number(despesasTotal.toFixed(2)),
      resultado_liquido: resultadoLiquido,
      margem_liquida_perc: margemLiquidaPerc,
      por_centro_custo: porCentroCusto,
      evolucao_mensal: evolucaoMensal,
    });
  } catch (error: any) {
    return NextResponse.json(
      { detail: error?.message || 'Erro ao carregar DRE Gerencial.' },
      { status: 500 }
    );
  }
}
