import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function getAuthenticatedSupabase(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  let authToken: string | null = null;

  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    authToken = authHeader.slice(7).trim();
  }

  let tenantId: string | null = null;
  const serverSupabase = createServerClient();

  if (!authToken) {
    const {
      data: { session },
    } = await serverSupabase.auth.getSession();
    if (session?.access_token) {
      authToken = session.access_token;
    }
  }

  if (!authToken) {
    return { supabase: null, tenantId: null, error: 'Token de autorização ausente ou inválido.' };
  }

  const payload = decodeJwtPayload(authToken);
  tenantId =
    payload?.app_metadata?.tenant_id ||
    payload?.user_metadata?.tenant_id ||
    payload?.tenant_id ||
    null;

  if (!tenantId) {
    const {
      data: { user },
    } = await serverSupabase.auth.getUser(authToken);
    tenantId =
      user?.app_metadata?.tenant_id || user?.user_metadata?.tenant_id || null;
  }

  if (!tenantId) {
    return { supabase: null, tenantId: null, error: 'Contexto de empresa (tenant_id) não localizado no token.' };
  }

  const supabase = createSupabaseClient(
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
        autoRefreshToken: false,
      },
    }
  );

  return { supabase, tenantId, error: null };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase, tenantId, error: authErr } = await getAuthenticatedSupabase(req);
  if (!supabase || !tenantId) {
    return NextResponse.json({ detail: authErr }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', params.id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { detail: 'Fornecedor não encontrado.' },
      { status: 404 }
    );
  }

  return NextResponse.json(data, { status: 200 });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase, tenantId, error: authErr } = await getAuthenticatedSupabase(req);
    if (!supabase || !tenantId) {
      return NextResponse.json({ detail: authErr }, { status: 401 });
    }

    const body = await req.json();
    const cleanDoc = body.document
      ? body.document.replace(/\D/g, '')
      : undefined;

    const specialtyIds: string[] | undefined = Array.isArray(body.specialty_ids)
      ? body.specialty_ids
      : undefined;

    const updatePayload: Record<string, any> = {};
    if (body.person_type !== undefined) updatePayload.person_type = body.person_type;
    if (cleanDoc !== undefined) updatePayload.document = cleanDoc;
    if (body.name !== undefined) updatePayload.name = body.name.trim();
    if (body.trade_name !== undefined) updatePayload.trade_name = body.trade_name?.trim() || null;
    if (body.category !== undefined) updatePayload.category = body.category;
    if (body.email !== undefined) updatePayload.email = body.email?.trim().toLowerCase() || null;
    if (body.phone !== undefined) updatePayload.phone = body.phone?.trim() || null;
    if (body.contact_name !== undefined) updatePayload.contact_name = body.contact_name?.trim() || null;
    if (body.state_registration !== undefined) updatePayload.state_registration = body.state_registration?.trim() || null;
    if (body.municipal_registration !== undefined) updatePayload.municipal_registration = body.municipal_registration?.trim() || null;
    if (body.address_zip_code !== undefined) updatePayload.address_zip_code = body.address_zip_code?.replace(/\D/g, '') || null;
    if (body.address_street !== undefined) updatePayload.address_street = body.address_street?.trim() || null;
    if (body.address_number !== undefined) updatePayload.address_number = body.address_number?.trim() || null;
    if (body.address_complement !== undefined) updatePayload.address_complement = body.address_complement?.trim() || null;
    if (body.address_neighborhood !== undefined) updatePayload.address_neighborhood = body.address_neighborhood?.trim() || null;
    if (body.address_city !== undefined) updatePayload.address_city = body.address_city?.trim() || null;
    if (body.address_state !== undefined) updatePayload.address_state = body.address_state?.trim().toUpperCase() || null;
    if (body.is_subcontractor !== undefined) updatePayload.is_subcontractor = Boolean(body.is_subcontractor);
    if (body.notes !== undefined) updatePayload.notes = body.notes?.trim() || null;
    if (body.is_active !== undefined) updatePayload.is_active = Boolean(body.is_active);

    const { data: updated, error: updateErr } = await supabase
      .from('suppliers')
      .update(updatePayload)
      .eq('id', params.id)
      .eq('tenant_id', tenantId)
      .select('*')
      .maybeSingle();

    if (updateErr || !updated) {
      return NextResponse.json(
        { detail: updateErr?.message || 'Fornecedor não encontrado ou sem permissão.' },
        { status: 400 }
      );
    }

    if (specialtyIds) {
      await supabase
        .from('supplier_specialties')
        .delete()
        .eq('supplier_id', params.id)
        .eq('tenant_id', tenantId);

      if (specialtyIds.length > 0) {
        const links = specialtyIds.map((specId) => ({
          tenant_id: tenantId,
          supplier_id: params.id,
          specialty_id: specId,
        }));
        await supabase.from('supplier_specialties').insert(links);
      }
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message || 'Erro interno ao atualizar fornecedor.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase, tenantId, error: authErr } = await getAuthenticatedSupabase(req);
  if (!supabase || !tenantId) {
    return NextResponse.json({ detail: authErr }, { status: 401 });
  }

  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', params.id)
    .eq('tenant_id', tenantId);

  if (error) {
    return NextResponse.json(
      { detail: `Erro ao remover fornecedor: ${error.message}` },
      { status: 400 }
    );
  }

  return new NextResponse(null, { status: 204 });
}

