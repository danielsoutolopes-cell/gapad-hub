import { NextRequest, NextResponse } from 'next/server';
import { GET as getByParam } from './[cnpj]/route';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cnpj = searchParams.get('cnpj') || '';
  return getByParam(req, { params: { cnpj } });
}
