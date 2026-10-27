import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ title: 'Não Autorizado', detail: 'Sessão inválida' }, { status: 401 });
    }

    const tenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ title: 'Tenant não encontrado' }, { status: 400 });
    }

    const { data: members, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone, role, is_active, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar membros:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: members || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ title: 'Não Autorizado', detail: 'Sessão inválida' }, { status: 401 });
    }

    const tenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ title: 'Tenant não encontrado' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { full_name, email, phone, role } = body;

    if (!full_name || !email) {
      return NextResponse.json({ title: 'Nome e email são obrigatórios' }, { status: 400 });
    }

    const { data: newMember, error } = await supabase
      .from('users')
      .insert({
        tenant_id: tenantId,
        full_name,
        email: email.trim().toLowerCase(),
        phone: phone || null,
        role: role || 'engenheiro',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(newMember, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
