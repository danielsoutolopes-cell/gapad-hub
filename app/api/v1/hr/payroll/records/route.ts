import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const refMonth = searchParams.get('reference_month') || '2026-11';
    const authHeader = request.headers.get('authorization') || '';
    const tenantHeader = request.headers.get('x-tenant-id') || '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authHeader) headers['Authorization'] = authHeader;
    if (tenantHeader) headers['X-Tenant-Id'] = tenantHeader;

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/hr/payroll/records?reference_month=${refMonth}`, {
        headers,
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
      }
    } catch {
      // Backend offline
    }

    const mockRecords = [
      {
        id: `pay-${refMonth}-emp-1`,
        employee_id: 'emp-1',
        employee_name: 'Antônio Ferreira',
        employee_role: 'Pedreiro',
        construction_role: 'MESTRE_OBRAS',
        reference_month: refMonth,
        base_salary: 2860.0,
        overtime_hours: 0.0,
        overtime_amount: 0.0,
        extraordinary_amount: 300.0,
        absent_days: 1,
        absence_deduction: 95.33,
        gross_amount: 3064.67,
        inss_deduction: 254.82,
        irrf_deduction: 41.22,
        benefits_deduction: 341.6,
        net_amount: 2427.03,
        fgts_amount: 245.17,
        status: 'DRAFT',
        calculated_at: new Date().toISOString(),
      },
      {
        id: `pay-${refMonth}-emp-2`,
        employee_id: 'emp-2',
        employee_name: 'João Carlos de Lima',
        employee_role: 'Eletricista',
        construction_role: 'ENGENHEIRO_CAMPO',
        reference_month: refMonth,
        base_salary: 3380.0,
        overtime_hours: 8.0,
        overtime_amount: 184.36,
        extraordinary_amount: 0.0,
        absent_days: 0,
        absence_deduction: 0.0,
        gross_amount: 3564.36,
        inss_deduction: 317.84,
        irrf_deduction: 105.54,
        benefits_deduction: 382.8,
        net_amount: 2758.18,
        fgts_amount: 285.15,
        status: 'DRAFT',
        calculated_at: new Date().toISOString(),
      },
    ];

    const gross = mockRecords.reduce((a, b) => a + b.gross_amount, 0);
    const net = mockRecords.reduce((a, b) => a + b.net_amount, 0);

    return NextResponse.json({
      reference_month: refMonth,
      total_records: mockRecords.length,
      total_gross: gross,
      total_net: net,
      items: mockRecords,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Falha ao buscar registros de folha' },
      { status: 500 }
    );
  }
}
