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

export async function GET(req: NextRequest) {
  try {
    const { supabase, tenantId, error: authErr } = await getAuthenticatedSupabase(req);
    if (!supabase || !tenantId) {
      return NextResponse.json({ detail: authErr }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const category = searchParams.get('category')?.trim();
    const isActive = searchParams.get('is_active');
    const limit = Math.min(Number(searchParams.get('limit') || 100), 200);
    const offset = Math.max(Number(searchParams.get('offset') || 0), 0);

    let query = supabase
      .from('suppliers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      query = query.eq('is_active', isActive === 'true');
    }

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,document.ilike.%${search}%,contact_name.ilike.%${search}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { detail: `Falha ao listar fornecedores: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(data || [], { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message || 'Erro interno ao listar fornecedores.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, tenantId, error: authErr } = await getAuthenticatedSupabase(req);
    if (!supabase || !tenantId) {
      return NextResponse.json({ detail: authErr }, { status: 401 });
    }

    const body = await req.json();
    const cleanDoc = (body.document || '').replace(/\D/g, '');

    if (!cleanDoc || (cleanDoc.length !== 11 && cleanDoc.length !== 14)) {
      return NextResponse.json(
        { detail: 'Documento inválido. Informe CPF (11 dígitos) ou CNPJ (14 dígitos).' },
        { status: 400 }
      );
    }

    // 1. Verifica unicidade de documento no tenant
    const { data: existing } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('document', cleanDoc)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          detail: `Já existe um fornecedor cadastrado com o documento '${cleanDoc}' (${existing.name}) nesta empresa.`,
        },
        { status: 409 }
      );
    }

    const specialtyIds: string[] = Array.isArray(body.specialty_ids)
      ? body.specialty_ids
      : [];

    const isSubcontractor =
      Boolean(body.is_subcontractor) ||
      body.category === 'subempreiteira' ||
      specialtyIds.length > 0;

    const insertPayload = {
      tenant_id: tenantId,
      person_type: body.person_type || (cleanDoc.length === 14 ? 'PJ' : 'PF'),
      document: cleanDoc,
      name: (body.name || '').trim(),
      trade_name: body.trade_name?.trim() || null,
      category: body.category || 'materiais_construcao',
      email: body.email?.trim().toLowerCase() || null,
      phone: body.phone?.trim() || null,
      contact_name: body.contact_name?.trim() || null,
      state_registration: body.state_registration?.trim() || null,
      municipal_registration: body.municipal_registration?.trim() || null,
      address_zip_code: body.address_zip_code?.replace(/\D/g, '') || null,
      address_street: body.address_street?.trim() || null,
      address_number: body.address_number?.trim() || null,
      address_complement: body.address_complement?.trim() || null,
      address_neighborhood: body.address_neighborhood?.trim() || null,
      address_city: body.address_city?.trim() || null,
      address_state: body.address_state?.trim().toUpperCase() || null,
      is_subcontractor: isSubcontractor,
      notes: body.notes?.trim() || null,
      is_active: body.is_active !== false,
    };

    const { data: created, error: insertErr } = await supabase
      .from('suppliers')
      .insert(insertPayload)
      .select('*')
      .single();

    if (insertErr || !created) {
      return NextResponse.json(
        { detail: insertErr?.message || 'Erro ao gravar fornecedor no Supabase.' },
        { status: 400 }
      );
    }

    // 2. Vínculo de especialidades técnicas se fornecidas
    if (specialtyIds.length > 0) {
      const links = specialtyIds.map((specId) => ({
        tenant_id: tenantId,
        supplier_id: created.id,
        specialty_id: specId,
      }));
      await supabase.from('supplier_specialties').upsert(links, {
        onConflict: 'supplier_id,specialty_id',
        ignoreDuplicates: true,
      });
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message || 'Erro interno ao cadastrar fornecedor.' },
      { status: 500 }
    );
  }
}

