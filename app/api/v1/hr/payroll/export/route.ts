import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const refMonth = searchParams.get('reference_month') || '2026-11';
    const formatType = searchParams.get('format_type') || 'csv';

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/hr/payroll/export?reference_month=${refMonth}&format_type=${formatType}`);
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch {
      // Backend offline
    }

    const csvContent =
      "ID;Colaborador;Cargo;Cargo_Organograma;Salario_Base;Horas_Extras_R$;Faltas_R$;Remun_Extraordinarias_R$;Bruto_R$;INSS_R$;IRRF_R$;Beneficios_VT_VA_Saude_R$;Liquido_R$;FGTS_8perc_R$\n" +
      `emp-1;Antônio Ferreira;Pedreiro;MESTRE_OBRAS;2860.00;0.00;95.33;300.00;3064.67;254.82;41.22;341.60;2427.03;245.17\n` +
      `emp-2;João Carlos de Lima;Eletricista;ENGENHEIRO_CAMPO;3380.00;184.36;0.00;0.00;3564.36;317.84;105.54;382.80;2758.18;285.15`;

    return NextResponse.json({
      format: formatType.toUpperCase(),
      file_name: `Folha_${refMonth}.${formatType === 'json' ? 'json' : 'csv'}`,
      content: csvContent,
      records_count: 2,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Falha ao exportar folha' },
      { status: 500 }
    );
  }
}

