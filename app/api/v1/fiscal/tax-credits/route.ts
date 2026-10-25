import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const authToken = session?.access_token || request.headers.get('authorization')?.replace('Bearer ', '');
    const tenantId = request.headers.get('x-tenant-id') || session?.user?.user_metadata?.tenant_id || session?.user?.app_metadata?.tenant_id;

    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();

    const fastApiBaseUrl = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';
    const targetUrl = `${fastApiBaseUrl.replace(/\/$/, '')}/api/v1/fiscal/tax-credits${
      queryString ? `?${queryString}` : ''
    }`;

    const forwardHeaders: Record<string, string> = {
      Accept: 'application/json',
    };
    if (authToken) forwardHeaders['Authorization'] = `Bearer ${authToken}`;
    if (tenantId) forwardHeaders['x-tenant-id'] = tenantId;

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: forwardHeaders,
        cache: 'no-store',
      });
      const data = await response.json().catch(() => []);
      return NextResponse.json(data, { status: response.status });
    } catch {
      // Fallback para consulta direta via Supabase Client
      let query = supabase.from('tax_credits').select('*').order('created_at', { ascending: false });
      const statusFilter = searchParams.get('status');
      if (statusFilter) query = query.eq('status', statusFilter);
      const { data } = await query;
      return NextResponse.json(data || [], { status: 200 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const authToken = session?.access_token || request.headers.get('authorization')?.replace('Bearer ', '');
    const tenantId = request.headers.get('x-tenant-id') || session?.user?.user_metadata?.tenant_id || session?.user?.app_metadata?.tenant_id;

    const body = await request.json().catch(() => ({}));
    const fastApiBaseUrl = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';
    const targetUrl = `${fastApiBaseUrl.replace(/\/$/, '')}/api/v1/fiscal/tax-credits`;

    const forwardHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (authToken) forwardHeaders['Authorization'] = `Bearer ${authToken}`;
    if (tenantId) forwardHeaders['x-tenant-id'] = tenantId;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
