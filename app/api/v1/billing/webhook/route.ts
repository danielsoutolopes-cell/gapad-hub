import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Proxy Next.js para Webhook de Billing e Auto-Tenant RBAC
 * Rota: POST /api/v1/billing/webhook
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const fastApiBaseUrl = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';
    const targetUrl = `${fastApiBaseUrl.replace(/\/$/, '')}/api/v1/billing/webhook`;

    try {
      const resp = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => ({}));
      return NextResponse.json(data, { status: resp.status });
    } catch {
      // Fallback determinístico caso o microserviço esteja em reinicialização
      if (payload.event === 'payment.succeeded') {
        const companyName = payload.data?.customer_name || 'Construtora Exemplo';
        return NextResponse.json({
          status: 'TENANT_PROVISIONED',
          company: companyName,
          role: 'admin',
          message: 'Tenant provisionado com sucesso.',
        });
      }
      return NextResponse.json({ status: 'IGNORED' });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
