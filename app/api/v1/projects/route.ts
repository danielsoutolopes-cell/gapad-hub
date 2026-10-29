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
    const clientId = searchParams.get('client_id')?.trim();
    const statusFilter = searchParams.get('status')?.trim();
    const search = searchParams.get('search')?.trim();
    const limit = Math.min(Number(searchParams.get('limit') || 100), 200);
    const offset = Math.max(Number(searchParams.get('offset') || 0), 0);

    let query = supabase
      .from('projects')
      .select('*, clients(id, name, document)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,code.ilike.%${search}%,cno.ilike.%${search}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { detail: `Erro na consulta de obras: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(data || [], { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message || 'Erro interno ao listar obras.' },
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

    const insertPayload = {
      ...body,
      tenant_id: tenantId,
    };

    const { data: created, error: insertErr } = await supabase
      .from('projects')
      .insert(insertPayload)
      .select('*, clients(id, name, document)')
      .single();

    if (insertErr || !created) {
      return NextResponse.json(
        { detail: insertErr?.message || 'Erro ao cadastrar obra no Supabase.' },
        { status: 400 }
      );
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message || 'Erro interno ao cadastrar obra.' },
      { status: 500 }
    );
  }
}

