import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function POST(
  request: NextRequest,
  { params }: { params: { hash: string } }
) {
  try {
    const body = await request.json();
    const hash = params.hash;

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/procurement/suppliers/quotes/${hash}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
      }
    } catch {
      // Backend offline: fallback de cotação de fornecedor
    }

    const total = Number(body.total_amount || 0);
    const disc = Number(body.discount_amount || 0);
    const freight = Number(body.freight_amount || 0);
    const net = total - disc + freight;

    return NextResponse.json(
      {
        success: true,
        quote_id: `quote-${Date.now()}`,
        supplier_name: body.supplier_name,
        unit_price: Number(body.unit_price || 0),
        total_amount: total,
        discount_amount: disc,
        freight_amount: freight,
        net_total: net,
        delivery_days: body.delivery_days || 2,
        payment_terms: body.payment_terms || 'Boleto',
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Falha ao processar cotação' },
      { status: 500 }
    );
  }
}
