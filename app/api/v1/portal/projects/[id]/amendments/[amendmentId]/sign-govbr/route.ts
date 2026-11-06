import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; amendmentId: string } }
) {
  try {
    const { id, amendmentId } = params;
    const authHeader = request.headers.get('authorization') || '';

    const res = await fetch(
      `${BACKEND_URL}/api/v1/portal/projects/${id}/amendments/${amendmentId}/sign-govbr`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
      }
    );

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Falha ao assinar aditivo via Gov.br' },
      { status: 500 }
    );
  }
}

