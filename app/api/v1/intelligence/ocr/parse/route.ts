import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Proxy e Handler para OCR Preditivo de Notas Fiscais e Insumos (Contas a Pagar).
 * Encaminha o arquivo multipart para o microserviço FastAPI (/api/v1/intelligence/ocr/parse).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const authToken = session?.access_token || request.headers.get('authorization')?.replace('Bearer ', '');
    const tenantId = request.headers.get('x-tenant-id') || session?.user?.user_metadata?.tenant_id;

    const fastApiBaseUrl = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';
    const targetUrl = `${fastApiBaseUrl.replace(/\/$/, '')}/api/v1/intelligence/ocr/parse`;

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return new NextResponse(
        JSON.stringify({
          type: 'https://gadap.com.br/errors/bad-request',
          title: 'Arquivo Ausente',
          status: 400,
          detail: "O campo 'file' contendo a nota fiscal (PDF ou imagem) é obrigatório.",
          instance: request.nextUrl.pathname,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/problem+json' },
        }
      );
    }

    // Prepara payload multipart/form-data para o FastAPI
    const backendFormData = new FormData();
    backendFormData.append('file', file, (file as File).name || 'nota_fiscal.pdf');

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
        method: 'POST',
        headers: forwardHeaders,
        body: backendFormData,
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
          type: 'https://gadap.com.br/errors/ocr-backend-unreachable',
          title: 'Serviço de OCR Preditivo Indisponível',
          status: 503,
          detail: `Não foi possível conectar ao motor de IA FastAPI em ${targetUrl}. Verifique o microserviço.`,
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
        title: 'Erro no Processamento do OCR',
        status: 500,
        detail: err.message || 'Ocorreu um erro inesperado ao orquestrar o OCR da nota.',
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
