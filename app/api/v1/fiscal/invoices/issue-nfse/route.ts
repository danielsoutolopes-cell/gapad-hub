import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Proxy e Handler para emissão de NFS-e (Padrão Nacional).
 * Encaminha requisição autenticada para o microserviço FastAPI Fiscal
 * mantendo conformidade integral com RFC 7807 (Problem Details).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    const authToken = session?.access_token || request.headers.get('authorization')?.replace('Bearer ', '');
    const tenantId = request.headers.get('x-tenant-id') || session?.user?.user_metadata?.tenant_id;

    const body = await request.json().catch(() => ({}));
    const fastApiBaseUrl = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';
    const targetUrl = `${fastApiBaseUrl.replace(/\/$/, '')}/api/v1/fiscal/invoices/issue-nfse`;

    const forwardHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
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
        method: 'POST',
        headers: forwardHeaders,
        body: JSON.stringify(body),
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
      // Retorno padronizado RFC 7807 caso o serviço FastAPI não esteja acessível
      return new NextResponse(
        JSON.stringify({
          type: 'https://gadap.com.br/errors/fiscal-backend-unreachable',
          title: 'Microserviço Fiscal Indisponível',
          status: 503,
          detail: `Não foi possível conectar ao motor fiscal FastAPI em ${targetUrl}. Verifique se o serviço uvicorn está ativo.`,
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
        title: 'Erro Interno de Processamento Fiscal',
        status: 500,
        detail: err.message || 'Ocorreu um erro inesperado ao orquestrar a emissão da NFS-e.',
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
