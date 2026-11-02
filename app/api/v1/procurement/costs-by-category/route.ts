import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * [PROMPT 87 — CURVA ABC / DESPESAS POR CATEGORIA]
 * Retorna os custos agrupados por família de insumo para o Gráfico de Despesas por Categoria.
 */
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('project_id');
  const categories = [
    {
      category: 'REVESTIMENTOS',
      label: '👷 Categoria: REVESTIMENTOS',
      subtotal: 33300.0,
      items_count: 2,
      abc_class: 'A',
      percentage: 38.4,
    },
    {
      category: 'ESTRUTURAL',
      label: '👷 Categoria: ESTRUTURAL',
      subtotal: 17125.0,
      items_count: 2,
      abc_class: 'A',
      percentage: 19.7,
    },
    {
      category: 'ELÉTRICA',
      label: '👷 Categoria: ELÉTRICA',
      subtotal: 15870.0,
      items_count: 3,
      abc_class: 'B',
      percentage: 18.3,
    },
    {
      category: 'HIDRÁULICA',
      label: '👷 Categoria: HIDRÁULICA',
      subtotal: 9180.0,
      items_count: 2,
      abc_class: 'B',
      percentage: 10.6,
    },
    {
      category: 'MARCENARIA',
      label: '👷 Categoria: MARCENARIA',
      subtotal: 6400.0,
      items_count: 1,
      abc_class: 'C',
      percentage: 7.4,
    },
    {
      category: 'CIVIL',
      label: '👷 Categoria: CIVIL',
      subtotal: 4909.5,
      items_count: 3,
      abc_class: 'C',
      percentage: 5.6,
    },
  ];
  const grandTotal = categories.reduce((acc, c) => acc + c.subtotal, 0);
  return NextResponse.json({
    project_id: projectId,
    grand_total: grandTotal,
    categories,
  });
}

