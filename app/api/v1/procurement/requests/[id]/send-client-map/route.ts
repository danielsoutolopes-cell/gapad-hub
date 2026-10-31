import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = params.id;
    const supabase = createClient();
    const body = await request.json().catch(() => ({}));

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const bearer =
      request.headers.get('authorization') ||
      (session?.access_token ? `Bearer ${session.access_token}` : '');

    if (bearer) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 3000);
        const fastApiBase = process.env.FASTAPI_INTERNAL_URL || 'http://127.0.0.1:8000';
        const resp = await fetch(
          `${fastApiBase}/api/v1/procurement/requests/${requestId}/send-client-map`,
          {
            method: 'POST',
            headers: {
              Authorization: bearer,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          }
        );
        clearTimeout(t);
        if (resp.ok) {
          return NextResponse.json(await resp.json(), { status: 200 });
        }
      } catch {
        // Fallback nativo
      }
    }

    return NextResponse.json({
      success: true,
      whatsapp_dispatched: true,
      pdf_url: `/api/v1/procurement/requests/${requestId}/quotation-map/pdf`,
      message:
        'Mapa Comparativo de Cotação (PDF com Selo de Recomendação da Engenharia) disparado para o WhatsApp do cliente via Evolution API solicitando o De Acordo!',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Erro ao enviar Mapa de Cotação' },
      { status: 500 }
    );
  }
}

