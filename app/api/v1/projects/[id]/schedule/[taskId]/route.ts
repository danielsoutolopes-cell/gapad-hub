import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const { id, taskId } = params;
    const body = await request.json();
    const authHeader = request.headers.get('authorization') || '';

    const res = await fetch(`${BACKEND_URL}/api/v1/projects/${id}/schedule/${taskId}`, {
      method: 'PATCH',
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
      { error: error?.message || 'Falha ao atualizar tarefa do cronograma' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const { id, taskId } = params;
    const authHeader = request.headers.get('authorization') || '';

    const res = await fetch(`${BACKEND_URL}/api/v1/projects/${id}/schedule/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Falha ao excluir tarefa do cronograma' },
      { status: 500 }
    );
  }
}

