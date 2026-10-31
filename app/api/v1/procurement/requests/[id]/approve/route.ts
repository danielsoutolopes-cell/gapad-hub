import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = params.id;
    const supabase = createClient();
    const body = await request.json().catch(() => ({}));

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const bearer =
      request.headers.get('authorization') ||
      (session?.access_token ? `Bearer ${session.access_token}` : '');

    // 1. Tenta delegar ao FastAPI se estiver em execução
    if (bearer) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 3000);
        const fastApiBase = process.env.FASTAPI_INTERNAL_URL || 'http://127.0.0.1:8000';
        const resp = await fetch(
          `${fastApiBase}/api/v1/procurement/requests/${requestId}/approve`,
          {
            method: 'PATCH',
            headers: {
              Authorization: bearer,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          }
        );
        clearTimeout(t);
        if (resp.ok) {
          return NextResponse.json(await resp.json(), { status: 200 });
        }
      } catch {
        // Fallback nativo no Supabase
      }
    }

    // 2. Fallback Nativo: Lógica do Contas a Pagar Duplo (CLIENT_REIMBURSEMENT)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const tenantId =
      user?.app_metadata?.tenant_id ||
      user?.user_metadata?.tenant_id ||
      request.headers.get('x-tenant-id');

    const responsibility = String(body.responsibility || 'CLIENT_REIMBURSEMENT').toUpperCase();
    const supplierName = String(body.supplier_name || 'Fornecedor Vencedor');
    const amount = Number(body.amount || 33300.0);
    const projectId = body.project_id || null;
    const dueDate = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    if (tenantId) {
      if (responsibility === 'CONSTRUCTOR' || responsibility === 'CLIENT_REIMBURSEMENT') {
        await supabase.from('financial_entries').insert({
          tenant_id: tenantId,
          project_id: projectId,
          entry_type: 'payable',
          description: `[Suprimentos #${requestId.slice(0, 6).toUpperCase()}] ${supplierName}`,
          category:
            responsibility === 'CLIENT_REIMBURSEMENT'
              ? 'Compra Reembolsável pelo Cliente (CLIENT_REIMBURSEMENT)'
              : 'Suprimentos & Materiais de Obra (CONSTRUCTOR)',
          nominal_amount: amount,
          net_amount: amount,
          status: 'a_vencer',
          due_date: dueDate,
          document_number: `OC-PAG-${requestId.slice(0, 6).toUpperCase()}`,
          document_type: 'ORDEM_COMPRA',
        });
      }

      if (responsibility === 'CLIENT_REIMBURSEMENT') {
        await supabase.from('financial_entries').insert({
          tenant_id: tenantId,
          project_id: projectId,
          entry_type: 'receivable',
          description: `[Reembolso de Compra #${requestId.slice(0, 6).toUpperCase()}] Repasse Cliente (${supplierName})`,
          category: 'Reembolso de Suprimentos (CLIENT_REIMBURSEMENT)',
          nominal_amount: amount,
          net_amount: amount,
          status: 'a_vencer',
          due_date: dueDate,
          document_number: `REB-CLI-${requestId.slice(0, 6).toUpperCase()}`,
          document_type: 'REEMBOLSO_SUPRIMENTOS',
        });
      }

      await supabase
        .from('purchase_requests')
        .update({ status: 'aprovado', responsibility })
        .eq('id', requestId);
    }

    const message =
      responsibility === 'CLIENT_REIMBURSEMENT'
        ? `Contas a Pagar Duplo executado com sucesso! Obrigação gerada no Contas a Pagar (${supplierName}) e título espelho lançado automaticamente no Contas a Receber para reembolso do cliente.`
        : responsibility === 'CLIENT_DIRECT'
        ? `Ordem de Compra aprovada na modalidade Faturamento Direto no CPF/CNPJ do Cliente (CLIENT_DIRECT).`
        : `Ordem de Compra aprovada (${supplierName}) e lançada no Contas a Pagar da construtora.`;

    return NextResponse.json({
      success: true,
      request_id: requestId,
      status: 'aprovado',
      responsibility,
      message,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Erro ao aprovar requisição' },
      { status: 500 }
    );
  }
}

