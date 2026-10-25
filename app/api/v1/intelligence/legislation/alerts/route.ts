import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Proxy e Handler para consulta de Alertas de Tax Intelligence e Legislação.
 * Encaminha a requisição para o microserviço FastAPI (/api/v1/intelligence/legislation/alerts).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const authToken = session?.access_token || request.headers.get('authorization')?.replace('Bearer ', '');
    const tenantId = request.headers.get('x-tenant-id') || session?.user?.user_metadata?.tenant_id;

    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();

    const fastApiBaseUrl = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';
    const targetUrl = `${fastApiBaseUrl.replace(/\/$/, '')}/api/v1/intelligence/legislation/alerts${
      queryString ? `?${queryString}` : ''
    }`;

    const forwardHeaders: Record<string, string> = {
      Accept: 'application/json, application/problem+json',
    };

    if (authToken) {
      forwardHeaders['Authorization'] = `Bearer ${authToken}`;
    }
    if (tenantId) {
      forwardHeaders['x-tenant-id'] = tenantId;
    }

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: forwardHeaders,
      });

      const responseData = await response.json().catch(() => ({}));
      const contentType = response.headers.get('content-type') || 'application/json';

      return new NextResponse(JSON.stringify(responseData), {
        status: response.status,
        headers: {
          'Content-Type': contentType,
        },
      });
    } catch (networkError: any) {
      return new NextResponse(
        JSON.stringify({
          type: 'https://gadap.com.br/errors/intelligence-backend-unreachable',
          title: 'Serviço de Tax Intelligence Temporariamente Indisponível',
          status: 503,
          detail: `Não foi possível conectar ao motor FastAPI em ${targetUrl}. Verifique o serviço backend.`,
          instance: request.nextUrl.pathname,
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/problem+json',
          },
        }
      );
    }
  } catch (err: any) {
    return new NextResponse(
      JSON.stringify({
        type: 'https://gadap.com.br/errors/internal-server-error',
        title: 'Erro Interno de Consulta Legislativa',
        status: 500,
        detail: err.message || 'Ocorreu um erro inesperado ao consultar os alertas de Tax Intelligence.',
        instance: request.nextUrl.pathname,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/problem+json',
        },
      }
    );
  }
}
