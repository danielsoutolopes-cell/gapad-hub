import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/fiscal/invoices
 * Retorna as notas fiscais emitidas pelo tenant com filtros de período, status e obra,
 * acompanhadas dos totais consolidados de impostos retidos e faturados.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { title: 'Não Autorizado', detail: 'Sessão expirada ou inválida' },
        { status: 401 }
      );
    }

    const tenantId =
      user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;

    if (!tenantId) {
      return NextResponse.json(
        { title: 'Tenant não identificado', detail: 'Usuário sem tenant vinculado' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const status = searchParams.get('status');
    const invoiceType = searchParams.get('type');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let query = supabase
      .from('fiscal_invoices')
      .select(`
        id,
        tenant_id,
        project_id,
        measurement_id,
        client_id,
        invoice_type,
        environment,
        number,
        series,
        access_key,
        dps_number,
        status,
        protocol_number,
        authorized_at,
        provider_cnpj,
        provider_city_ibge,
        taker_document,
        taker_name,
        construction_city_ibge,
        service_code_lc116,
        service_description,
        gross_amount,
        deductions_amount,
        calculation_base,
        iss_rate,
        iss_amount,
        iss_retained,
        iss_retained_amount,
        inss_retained_amount,
        irrf_retained_amount,
        csll_retained_amount,
        pis_amount,
        cofins_amount,
        net_amount,
        cno,
        art,
        xml_url,
        pdf_url,
        whatsapp_notification_sent,
        whatsapp_recipient,
        created_at,
        projects (
          id,
          name,
          code
        ),
        clients (
          id,
          name,
          trade_name,
          tax_id
        )
      `)
      .eq('tenant_id', tenantId)
      .order('authorized_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (invoiceType) {
      query = query.eq('invoice_type', invoiceType);
    }
    if (startDate) {
      query = query.gte('authorized_at', `${startDate}T00:00:00Z`);
    }
    if (endDate) {
      query = query.lte('authorized_at', `${endDate}T23:59:59Z`);
    }

    const { data: invoices, error } = await query;

    if (error) {
      console.error('Erro ao buscar fiscal_invoices:', error);
      return NextResponse.json(
        { title: 'Erro de Banco de Dados', detail: error.message },
        { status: 500 }
      );
    }

    // Calcula totalizadores do período / mês
    let totalGross = 0;
    let totalNet = 0;
    let totalIssRetained = 0;
    let totalIssOwn = 0;
    let totalInssRetained = 0;
    let totalFederalRetained = 0; // IRRF + CSLL + PIS + COFINS

    const mappedInvoices = (invoices || []).map((inv: any) => {
      const gross = Number(inv.gross_amount || 0);
      const net = Number(inv.net_amount || 0);
      const issRet = Number(inv.iss_retained_amount || 0);
      const issAmount = Number(inv.iss_amount || 0);
      const inssRet = Number(inv.inss_retained_amount || 0);
      const irrfRet = Number(inv.irrf_retained_amount || 0);
      const csllRet = Number(inv.csll_retained_amount || 0);
      const pis = Number(inv.pis_amount || 0);
      const cofins = Number(inv.cofins_amount || 0);

      totalGross += gross;
      totalNet += net;
      if (inv.iss_retained) {
        totalIssRetained += issRet;
      } else {
        totalIssOwn += issAmount;
      }
      totalInssRetained += inssRet;
      totalFederalRetained += irrfRet + csllRet + pis + cofins;

      return {
        ...inv,
        gross_amount: gross,
        net_amount: net,
        iss_retained_amount: issRet,
        iss_amount: issAmount,
        inss_retained_amount: inssRet,
        project_name: inv.projects?.name || 'Obra não informada',
        project_code: inv.projects?.code || null,
        client_name: inv.clients?.name || inv.taker_name || 'Cliente Geral',
      };
    });

    const totalTaxesRetained = totalIssRetained + totalInssRetained + totalFederalRetained;

    return NextResponse.json({
      items: mappedInvoices,
      total_count: mappedInvoices.length,
      totals: {
        total_gross: totalGross,
        total_net: totalNet,
        total_iss_retained: totalIssRetained,
        total_iss_own: totalIssOwn,
        total_inss_retained: totalInssRetained,
        total_federal_retained: totalFederalRetained,
        total_taxes_retained: totalTaxesRetained,
      },
    });
  } catch (err: any) {
    console.error('Erro na API Fiscal:', err);
    return NextResponse.json(
      { title: 'Erro Interno', detail: err.message || 'Erro inesperado' },
      { status: 500 }
    );
  }
}
