import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; amendmentId: string } }
) {
  try {
    const { id: projectId, amendmentId } = params;
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ detail: 'Não autenticado.' }, { status: 401 });
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const bearer =
      request.headers.get('authorization') ||
      (session?.access_token ? `Bearer ${session.access_token}` : '');

    // 1. Tenta delegar ao FastAPI primeiro
    if (bearer) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 3500);
        const fastApiBase = process.env.FASTAPI_INTERNAL_URL || 'http://127.0.0.1:8000';
        const resp = await fetch(
          `${fastApiBase}/api/v1/projects/${projectId}/amendments/${amendmentId}/approve`,
          {
            method: 'PATCH',
            headers: { Authorization: bearer },
            signal: controller.signal,
          }
        );
        clearTimeout(t);
        if (resp.ok || resp.status === 400 || resp.status === 404) {
          return NextResponse.json(await resp.json(), { status: resp.status });
        }
      } catch {
        // Fallback nativo no Supabase
      }
    }

    // 2. Fallback Nativo: Aplica a Regra de Negócio Diretamente no Supabase
    const { data: amendment, error: amendErr } = await supabase
      .from('contract_amendments')
      .select('*')
      .eq('id', amendmentId)
      .eq('project_id', projectId)
      .single();

    if (amendErr || !amendment) {
      return NextResponse.json({ detail: 'Termo Aditivo não encontrado.' }, { status: 404 });
    }

    if (amendment.status === 'APPROVED') {
      return NextResponse.json(
        { detail: 'Este Termo Aditivo já se encontra aprovado.' },
        { status: 400 }
      );
    }

    const amount = Number(amendment.amount || 0);
    const tenantId = amendment.tenant_id;
    const dueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    let previousTotal = 0;
    let newTotal = 0;

    if (amendment.type === 'CLIENT_EXTRA') {
      const { data: project } = await supabase
        .from('projects')
        .select('id, client_id, contract_value, budget_total')
        .eq('id', projectId)
        .single();

      previousTotal = Number(project?.budget_total ?? project?.contract_value ?? 0);
      newTotal = previousTotal + amount;

      await supabase
        .from('projects')
        .update({
          budget_total: newTotal,
          contract_value: newTotal,
        })
        .eq('id', projectId);

      await supabase.from('financial_entries').insert({
        tenant_id: tenantId,
        project_id: projectId,
        client_id: project?.client_id || null,
        entry_type: 'receivable',
        description: `Aditivo Contratual #${amendmentId.slice(0, 8).toUpperCase()} - ${amendment.description}`,
        category: 'Aditivo Contratual (Change Order)',
        nominal_amount: amount,
        technical_retention_amount: 0,
        discount_amount: 0,
        interest_penalty_amount: 0,
        net_amount: amount,
        status: 'a_vencer',
        due_date: dueDate,
        document_number: `ADIT-CLI-${amendmentId.slice(0, 6).toUpperCase()}`,
        document_type: 'TERMO_ADITIVO',
      });
    } else if (amendment.type === 'SUBCONTRACTOR_EXTRA' && amendment.subcontract_id) {
      const { data: subcontract } = await supabase
        .from('subcontracts')
        .select('id, supplier_id, total_value, total_contract_value')
        .eq('id', amendment.subcontract_id)
        .single();

      previousTotal = Number(subcontract?.total_contract_value ?? subcontract?.total_value ?? 0);
      newTotal = previousTotal + amount;

      await supabase
        .from('subcontracts')
        .update({
          total_contract_value: newTotal,
          total_value: newTotal,
        })
        .eq('id', amendment.subcontract_id);

      await supabase.from('financial_entries').insert({
        tenant_id: tenantId,
        project_id: projectId,
        supplier_id: subcontract?.supplier_id || null,
        entry_type: 'payable',
        description: `Aditivo Subcontrato #${amendmentId.slice(0, 8).toUpperCase()} - ${amendment.description}`,
        category: 'Aditivo de Subempreitada (Change Order)',
        nominal_amount: amount,
        technical_retention_amount: 0,
        discount_amount: 0,
        interest_penalty_amount: 0,
        net_amount: amount,
        status: 'a_vencer',
        due_date: dueDate,
        document_number: `ADIT-SUB-${amendmentId.slice(0, 6).toUpperCase()}`,
        document_type: 'TERMO_ADITIVO_SUBCONTRATO',
      });
    }

    const pdfUrl = `/api/v1/projects/${projectId}/amendments/${amendmentId}/pdf`;
    const { data: updated } = await supabase
      .from('contract_amendments')
      .update({
        status: 'APPROVED',
        signed_pdf_url: pdfUrl,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', amendmentId)
      .select('*')
      .single();

    return NextResponse.json({
      success: true,
      amendment: updated || { ...amendment, status: 'APPROVED', signed_pdf_url: pdfUrl },
      previous_total: previousTotal,
      added_amount: amount,
      new_total: newTotal,
      signed_pdf_url: pdfUrl,
      message:
        amendment.type === 'CLIENT_EXTRA'
          ? 'Aditivo de Cliente aprovado! Orçamento da obra atualizado e título lançado no Contas a Receber.'
          : 'Aditivo de Subempreiteiro aprovado! Contrato (Farol de Risco) atualizado e despesa lançada no Contas a Pagar.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao aprovar aditivo';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

