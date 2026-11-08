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

    if (!tenantId && !authToken) {
      return NextResponse.json(
        { error: 'Não autorizado: tenant_id e credenciais ausentes na requisição.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'executive';

    const fastApiBaseUrl = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';
    let path = '/api/v1/analytics/export';
    if (reportType === 'dre') path = '/api/v1/analytics/export/dre';
    else if (reportType === 'sla-docas' || reportType === 'sla') path = '/api/v1/analytics/export/sla-docas';
    else if (reportType === 'inadimplencia') path = '/api/v1/analytics/export/inadimplencia';
    else if (reportType === 'movimentacao') path = '/api/v1/analytics/export/movimentacao';

    const targetUrl = `${fastApiBaseUrl.replace(/\/$/, '')}${path}`;

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
      const errorText = await response.text();
      const responseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter) {
        responseHeaders['Retry-After'] = retryAfter;
      }
      return new NextResponse(errorText, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    const fileBuffer = await response.arrayBuffer();
    const contentDisposition =
      response.headers.get('content-disposition') ||
      `attachment; filename="GADAP_Relatorio_${reportType}.xlsx"`;
    const reportSha256 = response.headers.get('x-report-sha256') || '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': contentDisposition,
      'X-Tenant-RateLimit-Limit': '100',
    };
    if (reportSha256) {
      headers['X-Report-SHA256'] = reportSha256;
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Falha ao gerar arquivo de exportação Excel', details: error.message },
      { status: 500 }
    );
  }
}
