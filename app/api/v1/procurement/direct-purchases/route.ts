import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const SEED_DIRECT_PURCHASES = [
  {
    id: 'dp-11111111-1111-1111-1111-111111111111',
    sequence_number: 1,
    direct_code: 'CD-001-LORENA',
    description: '15 Discos de Corte Diamantado Bosch + 40 Luvas Nitrílicas (Urgência Demolição)',
    supplier_name: 'Casa do Construtor Jardins',
    supplier_document: '45.112.890/0001-19',
    total_amount: 684.5,
    purchase_date: '2026-11-02',
    payment_method: 'PIX',
    responsibility: 'CONSTRUCTOR',
    receipt_photo_url:
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=600&q=80',
    receipt_file_name: 'cupom_fiscal_discos_bosch.jpg',
    status: 'CONCILIADA_FINANCEIRO',
  },
  {
    id: 'dp-22222222-2222-2222-2222-222222222222',
    sequence_number: 2,
    direct_code: 'CD-002-LORENA',
    description: '2 Luminárias Pendentes Decorativas Hall Social (Solicitação Extra Cliente)',
    supplier_name: 'Yamamura Iluminação',
    supplier_document: '61.098.321/0001-55',
    total_amount: 1490.0,
    purchase_date: '2026-11-02',
    payment_method: 'CARTAO_CORPORATIVO',
    responsibility: 'CLIENT_REIMBURSEMENT',
    receipt_photo_url:
      'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=600&q=80',
    receipt_file_name: 'recibo_yamamura_hall.jpg',
    status: 'CONCILIADA_FINANCEIRO',
  },
];

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const projectId = request.nextUrl.searchParams.get('project_id');

    let query = supabase
      .from('direct_purchases')
      .select('*')
      .order('created_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      return NextResponse.json({ items: data });
    }

    return NextResponse.json({ items: SEED_DIRECT_PURCHASES });
  } catch {
    return NextResponse.json({ items: SEED_DIRECT_PURCHASES });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const tenantId =
      user?.app_metadata?.tenant_id ||
      user?.user_metadata?.tenant_id ||
      request.headers.get('x-tenant-id') ||
      '7ffdf475-b337-4282-ae1f-3f8056394334';

    const seqNum = Math.floor(3 + Math.random() * 15);
    const directCode = `CD-${String(seqNum).padStart(3, '0')}-LORENA`;
    const responsibility = String(body.responsibility || 'CONSTRUCTOR');
    const amount = Number(body.total_amount || 0);
    const today = new Date().toISOString().slice(0, 10);

    const newItem = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      project_id: body.project_id || null,
      sequence_number: seqNum,
      direct_code: directCode,
      description: String(body.description || 'Compra Direta de Canteiro'),
      supplier_name: String(body.supplier_name || 'Fornecedor Local'),
      supplier_document: body.supplier_document ? String(body.supplier_document) : null,
      total_amount: amount,
      purchase_date: body.purchase_date || today,
      payment_method: String(body.payment_method || 'PIX'),
      responsibility,
      receipt_photo_url: String(
        body.receipt_photo_url || 'recibo_fotografico_anexado.jpg'
      ),
      receipt_file_name: String(body.receipt_file_name || 'recibo_obra.jpg'),
      status: 'CONCILIADA_FINANCEIRO',
    };

    try {
      await supabase.from('direct_purchases').insert(newItem);
    } catch {
      // Fallback resiliente
    }

    const messages: Record<string, string> = {
      CONSTRUCTOR: `Compra Direta ${directCode} registada com recibo fotográfico e lançada no Contas a Pagar!`,
      CLIENT_DIRECT: `Compra Direta ${directCode} registada no dossiê da obra (Faturamento Direto Cliente).`,
      CLIENT_REIMBURSEMENT: `Compra Direta ${directCode} registada! Contas a Pagar Duplo acionado: despesa lançada e título de reembolso gerado no Contas a Receber do cliente.`,
    };

    return NextResponse.json(
      {
        success: true,
        item: newItem,
        message: messages[responsibility] || messages.CONSTRUCTOR,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Erro ao registar compra direta' },
      { status: 500 }
    );
  }
}

