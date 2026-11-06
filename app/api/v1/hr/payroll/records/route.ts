import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('reference_month') || '';
    const url = new URL(`${BACKEND_URL}/api/v1/hr/payroll/records`);
    if (month) url.searchParams.set('reference_month', month);

    const authHeader = request.headers.get('authorization') || '';
    const res = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      cache: 'no-store',
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Falha ao buscar registros de folha' },
      { status: 500 }
    );
  }
}

