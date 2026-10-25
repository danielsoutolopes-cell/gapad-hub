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

    const fastApiBaseUrl = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';
    const targetUrl = `${fastApiBaseUrl.replace(/\/$/, '')}/api/v1/analytics/export`;

    const forwardHeaders: Record<string, string> = {};
    if (authToken) {
      forwardHeaders['Authorization'] = `Bearer ${authToken}`;
    }
    if (tenantId) {
      forwardHeaders['x-tenant-id'] = tenantId;
    }

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: forwardHeaders,
      cache: 'no-store',
    });

    if (!response.ok) {
      return new NextResponse(await response.text(), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const fileBuffer = await response.arrayBuffer();
    const contentDisposition =
      response.headers.get('content-disposition') ||
      'attachment; filename="GADAP_Relatorio_Gerencial.xlsx"';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': contentDisposition,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Falha ao gerar arquivo de exportação Excel', details: error.message },
      { status: 500 }
    );
  }
}
