import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const SEED_REQUESTS = [
  {
    id: 'a1111111-1111-1111-1111-111111111111',
    request_number: 1042,
    sequence_number: 1,
    map_code: 'MAPA-001-LORENA',
    project_name: 'Residencial Jardins Lorena / Retrofit',
    category: 'REVESTIMENTOS',
    urgency: 'alta',
    status: 'cotando',
    responsibility: 'CLIENT_REIMBURSEMENT',
    delivery_deadline: '2026-11-05',
    items_description: 'Porcelanato Retificado 120x120cm Calacata Extra (180 m²) + Argamassa AC-III',
    categorized_items: [
      {
        description: 'Porcelanato Retificado 120x120cm Calacata Extra',
        category: 'REVESTIMENTOS',
        quantity: 180,
        unit: 'M2',
        unit_price: 165.0,
        subtotal: 29700.0,
      },
      {
        description: 'Argamassa Colante AC-III Flexível Branca 20kg',
        category: 'CIVIL',
        quantity: 90,
        unit: 'SC',
        unit_price: 40.0,
        subtotal: 3600.0,
      },
    ],
    quotes: [
      {
        id: 'q1-1042',
        supplier_name: 'Portobello Shop Corporativo',
        category: 'REVESTIMENTOS',
        unit_price: 185.0,
        total_amount: 33300.0,
        delivery_days: 3,
        payment_terms: '28 DDL Boleto',
        is_winner: true,
        human_verified: true,
        justification: 'Menor prazo de entrega (pronta entrega no CD) e lote calibrado único.',
      },
      {
        id: 'q2-1042',
        supplier_name: 'Eliane Revestimentos Engenharia',
        category: 'REVESTIMENTOS',
        unit_price: 179.0,
        total_amount: 32220.0,
        delivery_days: 18,
        payment_terms: '30 DDL',
        is_winner: false,
        human_verified: true,
        justification: 'Prazo de 18 dias úteis compromete o cronograma do piso.',
      },
      {
        id: 'q3-1042',
        supplier_name: 'Boutique dos Revestimentos',
        category: 'REVESTIMENTOS',
        unit_price: 210.0,
        total_amount: 37800.0,
        delivery_days: 5,
        payment_terms: 'À Vista PIX',
        is_winner: false,
        human_verified: true,
        justification: 'Valor global 13,5% superior à cotação recomendada.',
      },
    ],
  },
  {
    id: 'a2222222-2222-2222-2222-222222222222',
    request_number: 1043,
    sequence_number: 2,
    map_code: 'MAPA-002-LORENA',
    project_name: 'Residencial Jardins Lorena / Retrofit',
    category: 'ESTRUTURAL',
    urgency: 'normal',
    status: 'cotando',
    responsibility: 'CONSTRUCTOR',
    delivery_deadline: '2026-11-10',
    items_description: 'Aço CA-50 10.0mm (Barra 12m) - 2.500 kg + Arame Recozido BWG 18',
    categorized_items: [
      {
        description: 'Vergalhão Aço CA-50 10.0mm (Barra 12m)',
        category: 'ESTRUTURAL',
        quantity: 2500,
        unit: 'KG',
        unit_price: 6.6,
        subtotal: 16500.0,
      },
      {
        description: 'Arame Recozido Torcido BWG 18 (Rolo 1kg)',
        category: 'CIVIL',
        quantity: 50,
        unit: 'KG',
        unit_price: 12.5,
        subtotal: 625.0,
      },
    ],
    quotes: [
      {
        id: 'q1-1043',
        supplier_name: 'Gerdau Comercial de Aços',
        category: 'ESTRUTURAL',
        unit_price: 6.85,
        total_amount: 17125.0,
        delivery_days: 3,
        payment_terms: '28 DDL',
        is_winner: true,
        human_verified: true,
        justification: 'Menor preço global com frete CIF incluso no canteiro.',
      },
      {
        id: 'q2-1043',
        supplier_name: 'ArcelorMittal Distribuidora',
        category: 'ESTRUTURAL',
        unit_price: 7.15,
        total_amount: 17875.0,
        delivery_days: 2,
        payment_terms: '30 DDL',
        is_winner: false,
        human_verified: true,
        justification: 'Preço superior em R$ 750,00.',
      },
      {
        id: 'q3-1043',
        supplier_name: 'Açofer Estruturas',
        category: 'ESTRUTURAL',
        unit_price: 7.4,
        total_amount: 18500.0,
        delivery_days: 5,
        payment_terms: '14 DDL',
        is_winner: false,
        human_verified: true,
        justification: 'Maior prazo e menor fôlego financeiro.',
      },
    ],
  },
  {
    id: 'a3333333-3333-3333-3333-333333333333',
    request_number: 1044,
    sequence_number: 3,
    map_code: 'MAPA-003-LORENA',
    project_name: 'Residencial Jardins Lorena / Retrofit',
    category: 'ELÉTRICA',
    urgency: 'alta',
    status: 'cotando',
    responsibility: 'CONSTRUCTOR',
    delivery_deadline: '2026-11-12',
    items_description: 'Cabo Flexível 750V 2,5mm² e 6,0mm² Prysmian + Quadro QDC 36 Disjuntores DIN',
    categorized_items: [
      {
        description: 'Cabo Flexível Antichama 750V 2,5mm² e 6,0mm² (Bobinas 100m)',
        category: 'ELÉTRICA',
        quantity: 25,
        unit: 'RL',
        unit_price: 380.0,
        subtotal: 9500.0,
      },
      {
        description: 'Quadro de Distribuição Metálico 36 Disjuntores DIN + Barramento Cobre',
        category: 'ELÉTRICA',
        quantity: 4,
        unit: 'UN',
        unit_price: 1220.0,
        subtotal: 4880.0,
      },
    ],
    quotes: [
      {
        id: 'q1-1044',
        supplier_name: 'Sonepar / Nortel Suprimentos Elétricos',
        category: 'ELÉTRICA',
        unit_price: 575.2,
        total_amount: 14380.0,
        delivery_days: 2,
        payment_terms: '28 DDL',
        is_winner: true,
        human_verified: true,
        justification: 'Cabos normatizados INMETRO pronta entrega.',
      },
      {
        id: 'q2-1044',
        supplier_name: 'Eletrotrafo Distribuidora',
        category: 'ELÉTRICA',
        unit_price: 598.0,
        total_amount: 14950.0,
        delivery_days: 4,
        payment_terms: '30 DDL',
        is_winner: false,
        human_verified: true,
        justification: 'Valor 4% superior ao primeiro colocado.',
      },
    ],
  },
  {
    id: 'a4444444-4444-4444-4444-444444444444',
    request_number: 1045,
    sequence_number: 4,
    map_code: 'MAPA-004-LORENA',
    project_name: 'Residencial Jardins Lorena / Retrofit',
    category: 'HIDRÁULICA',
    urgency: 'normal',
    status: 'cotando',
    responsibility: 'CLIENT_REIMBURSEMENT',
    delivery_deadline: '2026-11-15',
    items_description: 'Tubulação PPR Água Quente Tigre Aquatherm + Registros de Gaveta Deca',
    categorized_items: [
      {
        description: 'Tubos e Conexões PPR Tigre Aquatherm 25mm e 32mm',
        category: 'HIDRÁULICA',
        quantity: 60,
        unit: 'BR',
        unit_price: 95.0,
        subtotal: 5700.0,
      },
      {
        description: 'Registros de Gaveta e Pressão Bruto Deca 3/4"',
        category: 'HIDRÁULICA',
        quantity: 24,
        unit: 'UN',
        unit_price: 145.0,
        subtotal: 3480.0,
      },
    ],
    quotes: [
      {
        id: 'q1-1045',
        supplier_name: 'Hidráulica Paulista Técnica',
        category: 'HIDRÁULICA',
        unit_price: 153.0,
        total_amount: 9180.0,
        delivery_days: 2,
        payment_terms: '28 DDL Boleto',
        is_winner: true,
        human_verified: true,
        justification: 'Linha completa Tigre + Deca num único embarque.',
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

