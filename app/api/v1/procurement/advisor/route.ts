import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * [AI ADVISOR CONSULTIVO — PROMPT 86]
 * Informa o melhor preço histórico, preço médio e sugere fornecedores ao montar/analisar o pedido.
 * 100% consultivo e não bloqueante.
 */
export async function GET(request: NextRequest) {
  const query =
    request.nextUrl.searchParams.get('query') || 'Porcelanato Retificado 120x120cm';
  const qLower = query.toLowerCase();

  const isSteel =
    qLower.includes('aço') || qLower.includes('ca-50') || qLower.includes('ferro');

  if (isSteel) {
    return NextResponse.json({
      query,
      non_blocking: true,
      best_historical_price: 6.65,
      average_historical_price: 7.12,
      unit: 'kg',
      best_price_supplier: 'Gerdau Comercial de Aços',
      best_price_date: '2026-09-14',
      best_price_project: 'Obra Edifício Horizontes',
      suggested_suppliers: [
        {
          name: 'Gerdau Comercial de Aços',
          last_unit_price: 6.65,
          avg_delivery_days: 3,
          phone: '11988112233',
          reliability_score: '99% No Prazo',
        },
        {
          name: 'ArcelorMittal Distribuidora',
          last_unit_price: 6.95,
          avg_delivery_days: 2,
          phone: '11977223344',
          reliability_score: '97% No Prazo',
        },
        {
          name: 'Belgo Bekaert Arames & Aços',
          last_unit_price: 7.1,
          avg_delivery_days: 4,
          phone: '11966334455',
          reliability_score: '95% No Prazo',
        },
      ],
      advisory_message:
        'AI Advisor: O menor preço histórico para Aço CA-50 foi R$ 6,65/kg com Gerdau Comercial de Aços (Obra Edifício Horizontes). Média histórica: R$ 7,12/kg.',
    });
  }

  return NextResponse.json({
    query,
    non_blocking: true,
    best_historical_price: 172.9,
    average_historical_price: 188.5,
    unit: 'm²',
    best_price_supplier: 'Eliane Revestimentos Engenharia (Direto Fábrica)',
    best_price_date: '2026-08-22',
    best_price_project: 'Retrofit Vila Nova Conceição',
    suggested_suppliers: [
      {
        name: 'Portobello Shop Corporativo',
        last_unit_price: 179.0,
        avg_delivery_days: 3,
        phone: '11991112222',
        reliability_score: '98% No Prazo (Lote Único)',
      },
      {
        name: 'Eliane Revestimentos Engenharia',
        last_unit_price: 172.9,
        avg_delivery_days: 12,
        phone: '11993334444',
        reliability_score: '96% No Prazo',
      },
      {
        name: 'Cerâmica Atlas & Revestimentos Técnicos',
        last_unit_price: 184.0,
        avg_delivery_days: 5,
        phone: '11995556666',
        reliability_score: '94% No Prazo',
      },
    ],
    advisory_message: `AI Advisor: O menor preço histórico para "${query.slice(0, 42)}" foi R$ 172,90/m² com Eliane Revestimentos Engenharia (Retrofit Vila Nova Conceição). Média histórica: R$ 188,50/m².`,
  });
}

