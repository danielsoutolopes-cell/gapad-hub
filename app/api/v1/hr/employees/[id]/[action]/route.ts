import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; action: string } }
) {
  try {
    const { id, action } = params;
    const body = await request.json().catch(() => ({}));
    const authHeader = request.headers.get('authorization') || '';

    let endpoint = '';
    if (action === 'schedule-vacation') endpoint = `/api/v1/hr/employees/${id}/schedule-vacation`;
    else if (action === 'register-leave') endpoint = `/api/v1/hr/employees/${id}/register-leave`;
    else if (action === 'terminate') endpoint = `/api/v1/hr/employees/${id}/terminate`;
    else {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }

    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Falha ao processar ação de funcionário' },
      { status: 500 }
    );
  }
}

