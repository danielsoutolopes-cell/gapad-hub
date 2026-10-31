import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ detail: 'Não autenticado.' }, { status: 401 });
    }

    const tenantId =
      user.app_metadata?.tenant_id ||
      user.user_metadata?.tenant_id ||
      request.headers.get('x-tenant-id');

    // Tenta delegar ao FastAPI se estiver ativo
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const bearer =
      request.headers.get('authorization') ||
      (session?.access_token ? `Bearer ${session.access_token}` : '');

    if (bearer) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 2500);
        const fastApiBase = process.env.FASTAPI_INTERNAL_URL || 'http://127.0.0.1:8000';
        const resp = await fetch(`${fastApiBase}/api/v1/projects/${projectId}/amendments`, {
          headers: { Authorization: bearer },
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(t);
        if (resp.ok) {
          return NextResponse.json(await resp.json(), { status: 200 });
        }
      } catch {
        // Fallback nativo no Supabase
      }
    }

    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('*, clients(id, name, document, phone, email)')
      .eq('id', projectId)
      .maybeSingle();

    if (projErr || !project) {
      return NextResponse.json({ detail: 'Obra não encontrada.' }, { status: 404 });
    }

    const { data: subcontractsData } = await supabase
      .from('subcontracts')
      .select('*, suppliers(id, name, trade_name, document, phone)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    const subcontracts = subcontractsData || [];
    const subMap = new Map(subcontracts.map((s) => [String(s.id), s]));

    const { data: amendmentsData } = await supabase
      .from('contract_amendments')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    const amendments = (amendmentsData || []).map((item) => {
      const sub = item.subcontract_id ? subMap.get(String(item.subcontract_id)) : undefined;
      if (sub) {
        const sup = sub.suppliers || {};
        return {
          ...item,
          subcontract_info: {
            id: sub.id,
            contract_number: sub.contract_number,
            scope_description: sub.scope_description,
            total_contract_value: Number(sub.total_contract_value ?? sub.total_value ?? 0),
            supplier_name: sup.name || sup.trade_name,
            supplier_document: sup.document,
            supplier_phone: sup.phone,
          },
        };
      }
      return item;
    });

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        code: project.code,
        cno: project.cno,
        contract_value: Number(project.contract_value || 0),
        budget_total: Number(project.budget_total ?? project.contract_value ?? 0),
        client: project.clients,
        tenant_id: tenantId || project.tenant_id,
      },
      subcontracts,
      amendments,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao carregar aditivos';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ detail: 'Não autenticado.' }, { status: 401 });
    }

    const body = await request.json();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const bearer =
      request.headers.get('authorization') ||
      (session?.access_token ? `Bearer ${session.access_token}` : '');

    if (bearer) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 3000);
        const fastApiBase = process.env.FASTAPI_INTERNAL_URL || 'http://127.0.0.1:8000';
        const resp = await fetch(`${fastApiBase}/api/v1/projects/${projectId}/amendments`, {
          method: 'POST',
          headers: {
            Authorization: bearer,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(t);
        if (resp.ok || resp.status === 400 || resp.status === 422) {
          return NextResponse.json(await resp.json(), { status: resp.status });
        }
      } catch {
        // Fallback nativo no Supabase
      }
    }

    const tenantId =
      user.app_metadata?.tenant_id ||
      user.user_metadata?.tenant_id ||
      request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json({ detail: 'Tenant não identificado.' }, { status: 403 });
    }

    if (body.type === 'SUBCONTRACTOR_EXTRA' && !body.subcontract_id) {
      return NextResponse.json(
        { detail: 'Selecione o Subcontrato vinculado para aditivos de subempreiteiro.' },
        { status: 400 }
      );
    }

    const { data: created, error: insertErr } = await supabase
      .from('contract_amendments')
      .insert({
        tenant_id: tenantId,
        project_id: projectId,
        subcontract_id: body.subcontract_id || null,
        type: body.type,
        description: String(body.description || '').trim(),
        amount: Number(body.amount || 0),
        status: 'PENDING_SIGNATURE',
      })
      .select('*')
      .single();

    if (insertErr) {
      return NextResponse.json({ detail: insertErr.message }, { status: 500 });
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao criar aditivo';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

