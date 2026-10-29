import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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
      const targetUrl = `${fastApiBaseUrl.replace(/\/$/, '')}/api/v1/analytics/engineering/curve-s`;
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

    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, code, contract_value, status')
      .eq('tenant_id', tenantId);

    const { data: medicoes } = await supabase
      .from('medicoes')
      .select('project_id, valor_medido, valor_liquido, status, periodo_fim')
      .eq('tenant_id', tenantId);

    const medicoesPorObra: Record<string, { medido: number; faturado: number }> = {};
    for (const m of medicoes || []) {
      const pid = String(m.project_id);
      const statusM = String(m.status || '').toLowerCase();
      const vMed = Number(m.valor_medido || 0);
      const vLiq = Number(m.valor_liquido || 0);

      if (!medicoesPorObra[pid]) {
        medicoesPorObra[pid] = { medido: 0, faturado: 0 };
      }
      if (statusM === 'aprovada' || statusM === 'faturada') {
        medicoesPorObra[pid].medido += vMed;
      }
      if (statusM === 'faturada') {
        medicoesPorObra[pid].faturado += vLiq;
      }
    }

    let totalContratos = 0;
    let totalMedidoGlobal = 0;
    let totalFaturadoGlobal = 0;
    let obrasEmAndamento = 0;

    const obras = (projects || []).map((p: any) => {
      const pid = String(p.id);
      const contrato = Number(p.contract_value || 0);
      const st = String(p.status || 'planejamento');
      if (st === 'EM_ANDAMENTO' || st === 'em_andamento') {
        obrasEmAndamento += 1;
      }

      const acum = medicoesPorObra[pid] || { medido: 0, faturado: 0 };
      totalContratos += contrato;
      totalMedidoGlobal += acum.medido;
      totalFaturadoGlobal += acum.faturado;

      const percFis = contrato > 0 ? Math.min(100, Number(((acum.medido / contrato) * 100).toFixed(2))) : 0;
      const percFin = contrato > 0 ? Math.min(100, Number(((acum.faturado / contrato) * 100).toFixed(2))) : 0;
      const saldo = Math.max(0, Number((contrato - acum.faturado).toFixed(2)));

      return {
        id: pid,
        nome: p.name || 'Empreendimento',
        codigo: p.code || undefined,
        valor_contrato: contrato,
        total_medido: Number(acum.medido.toFixed(2)),
        total_faturado: Number(acum.faturado.toFixed(2)),
        percentual_fisico: percFis,
        percentual_financeiro: percFin,
        saldo_contratual: saldo,
        status: st,
      };
    });

    const avancoFisMedio =
      totalContratos > 0 ? Number(((totalMedidoGlobal / totalContratos) * 100).toFixed(2)) : 0;
    const avancoFinMedio =
      totalContratos > 0 ? Number(((totalFaturadoGlobal / totalContratos) * 100).toFixed(2)) : 0;

    const curvaSAcumulada: any[] = [];
    if ((medicoes || []).length > 0 && totalContratos > 0) {
      const porPeriodo: Record<string, { medido: number; faturado: number }> = {};
      for (const m of medicoes || []) {
        const st = String(m.status || '').toLowerCase();
        if (st !== 'aprovada' && st !== 'faturada') continue;
        const pfim = String(m.periodo_fim || '');
        const ym = pfim.length >= 7 ? pfim.slice(0, 7) : 'Atual';
        if (!porPeriodo[ym]) porPeriodo[ym] = { medido: 0, faturado: 0 };
        porPeriodo[ym].medido += Number(m.valor_medido || 0);
        if (st === 'faturada') {
          porPeriodo[ym].faturado += Number(m.valor_liquido || 0);
        }
      }
      let acumMed = 0;
      let acumFat = 0;
      const sortedPeriods = Object.keys(porPeriodo).sort();
      const totalSteps = Math.max(1, sortedPeriods.length);
      sortedPeriods.forEach((ym, idx) => {
        acumMed += porPeriodo[ym].medido;
        acumFat += porPeriodo[ym].faturado;
        const fisPct = Math.min(100, Number(((acumMed / totalContratos) * 100).toFixed(1)));
        const finPct = Math.min(100, Number(((acumFat / totalContratos) * 100).toFixed(1)));
        const planPct = Math.min(100, Number((((idx + 1) / totalSteps) * fisPct).toFixed(1)));
        curvaSAcumulada.push({
          periodo: ym,
          planejado_acumulado: planPct,
          fisico_acumulado: fisPct,
          financeiro_acumulado: finPct,
        });
      });
    }

    return NextResponse.json({
      tenant_id: tenantId,
      obras_ativas: obrasEmAndamento,
      valor_total_contratos: Number(totalContratos.toFixed(2)),
      total_medido_global: Number(totalMedidoGlobal.toFixed(2)),
      total_faturado_global: Number(totalFaturadoGlobal.toFixed(2)),
      avanco_fisico_medio_perc: avancoFisMedio,
      avanco_financeiro_medio_perc: avancoFinMedio,
      obras,
      curva_s_acumulada: curvaSAcumulada,
    });
  } catch (error: any) {
    return NextResponse.json(
      { detail: error?.message || 'Erro ao carregar dados de engenharia.' },
      { status: 500 }
    );
  }
}
