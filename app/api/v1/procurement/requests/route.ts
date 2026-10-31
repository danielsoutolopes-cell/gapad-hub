import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const SEED_REQUESTS = [
  {
    id: 'a1111111-1111-1111-1111-111111111111',
    request_number: 1042,
    project_name: 'Edifício Metropolitan / Retrofit',
    category: 'Acabamentos Nobres & Revestimentos',
    urgency: 'alta',
    status: 'cotando',
    responsibility: 'CLIENT_REIMBURSEMENT',
    delivery_deadline: '2026-11-05',
    items_description: 'Porcelanato Retificado 120x120cm Calacata Extra (180 m²) + Argamassa AC-III',
    quotes: [
      {
        id: 'q1-1042',
        supplier_name: 'Portobello Shop Corporativo',
        unit_price: 185.0,
        total_amount: 33300.0,
        delivery_days: 3,
        payment_terms: '28 DDL Boleto',
        is_winner: true,
        justification: 'Menor prazo de entrega (pronta entrega no CD) e lote calibrado único.',
      },
      {
        id: 'q2-1042',
        supplier_name: 'Eliane Revestimentos Engenharia',
        unit_price: 179.0,
        total_amount: 32220.0,
        delivery_days: 18,
        payment_terms: '30 DDL',
        is_winner: false,
        justification: 'Prazo de 18 dias úteis compromete o cronograma do piso.',
      },
      {
        id: 'q3-1042',
        supplier_name: 'Boutique dos Revestimentos',
        unit_price: 210.0,
        total_amount: 37800.0,
        delivery_days: 5,
        payment_terms: 'À Vista PIX',
        is_winner: false,
        justification: 'Valor global 13,5% superior à cotação recomendada.',
      },
    ],
  },
  {
    id: 'a2222222-2222-2222-2222-222222222222',
    request_number: 1043,
    project_name: 'Edifício Metropolitan / Retrofit',
    category: 'Aço & Estruturas',
    urgency: 'normal',
    status: 'cotando',
    responsibility: 'CONSTRUCTOR',
    delivery_deadline: '2026-11-10',
    items_description: 'Aço CA-50 10.0mm (Barra 12m) - 2.500 kg',
    quotes: [
      {
        id: 'q1-1043',
        supplier_name: 'Gerdau Comercial de Aços',
        unit_price: 6.85,
        total_amount: 17125.0,
        delivery_days: 3,
        payment_terms: '28 DDL',
        is_winner: true,
        justification: 'Menor preço global com frete CIF incluso no canteiro.',
      },
      {
        id: 'q2-1043',
        supplier_name: 'ArcelorMittal Distribuidora',
        unit_price: 7.15,
        total_amount: 17875.0,
        delivery_days: 2,
        payment_terms: '30 DDL',
        is_winner: false,
        justification: 'Preço superior em R$ 750,00.',
      },
      {
        id: 'q3-1043',
        supplier_name: 'Açofer Estruturas',
        unit_price: 7.4,
        total_amount: 18500.0,
        delivery_days: 5,
        payment_terms: '14 DDL',
        is_winner: false,
        justification: 'Maior prazo e menor fôlego financeiro.',
      },
    ],
  },
];

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const projectId = request.nextUrl.searchParams.get('project_id');

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const bearer =
      request.headers.get('authorization') ||
      (session?.access_token ? `Bearer ${session.access_token}` : '');

    if (bearer) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 2500);
        const fastApiBase = process.env.FASTAPI_INTERNAL_URL || 'http://127.0.0.1:8000';
        const qs = projectId ? `?project_id=${projectId}` : '';
        const resp = await fetch(`${fastApiBase}/api/v1/procurement/requests${qs}`, {
          headers: { Authorization: bearer },
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(t);
        if (resp.ok) {
          return NextResponse.json(await resp.json(), { status: 200 });
        }
      } catch {
        // Fallback nativo
      }
    }

    let query = supabase
      .from('purchase_requests')
      .select('*, procurement_quotes(*)')
      .order('created_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      const items = data.map((r) => ({
        id: r.id,
        request_number: r.request_number || 1001,
        project_id: r.project_id,
        project_name: 'Obra Vinculada',
        category: r.category || 'material_bruto',
        urgency: r.urgency || 'normal',
        status: r.status || 'cotando',
        responsibility: r.responsibility || 'CONSTRUCTOR',
        delivery_deadline: r.delivery_deadline,
        items_description: r.items_description || r.notes || 'Insumos de Obra',
        quotes: r.procurement_quotes || [],
      }));
      return NextResponse.json({ items });
    }

    return NextResponse.json({ items: SEED_REQUESTS });
  } catch {
    return NextResponse.json({ items: SEED_REQUESTS });
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
      request.headers.get('x-tenant-id');

    if (tenantId) {
      const { data: reqRow } = await supabase
        .from('purchase_requests')
        .insert({
          tenant_id: tenantId,
          project_id: body.project_id || null,
          status: 'cotando',
          category: body.category || 'material_bruto',
          urgency: body.urgency || 'normal',
          responsibility: body.responsibility || 'CONSTRUCTOR',
          delivery_deadline: body.delivery_deadline || null,
          items_description: body.items_description,
          notes: body.notes || body.items_description,
        })
        .select('*')
        .single();

      if (reqRow && Array.isArray(body.quotes) && body.quotes.length > 0) {
        const quotesToInsert = body.quotes.map((q: Record<string, unknown>) => ({
          tenant_id: tenantId,
          purchase_request_id: reqRow.id,
          supplier_name: String(q.supplier_name || 'Fornecedor'),
          unit_price: Number(q.unit_price || 0),
          total_amount: Number(q.total_amount || 0),
          payment_terms: String(q.payment_terms || '28 DDL'),
          delivery_days: Number(q.delivery_days || 3),
          is_winner: Boolean(q.is_winner),
          justification: q.justification ? String(q.justification) : null,
          status: q.is_winner ? 'selecionada' : 'em_analise',
        }));

        const { data: insertedQuotes } = await supabase
          .from('procurement_quotes')
          .insert(quotesToInsert)
          .select('*');

        return NextResponse.json(
          { ...reqRow, quotes: insertedQuotes || quotesToInsert },
          { status: 201 }
        );
      }
    }

    return NextResponse.json(
      {
        id: crypto.randomUUID(),
        request_number: Math.floor(1050 + Math.random() * 900),
        ...body,
        status: 'cotando',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Erro ao criar requisição' },
      { status: 500 }
    );
  }
}

