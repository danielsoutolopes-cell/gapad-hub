import { createClient as createAdminClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dkjcgrwztyhcsyxlajia.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Realiza o descarte de todas as alterações feitas pelo usuário de teste (admin@teste.com)
 * e restaura os dados operacionais sintéticos oficiais da "Empresa Teste" (Tenant Raiz).
 * 
 * Executado compulsoriamente no momento do logout do usuário teste.
 */
export async function resetDemoTenantData(tenantId: string): Promise<boolean> {
  if (!SERVICE_ROLE_KEY) {
    console.error('[resetDemoTenantData] SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.');
    return false;
  }

  const supabase = createAdminClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    console.log(`[resetDemoTenantData] Iniciando limpeza das alterações do tenant de teste: ${tenantId}...`);

    // 1. Limpeza em cascata de dados voláteis
    await supabase.from('financial_entries').delete().eq('tenant_id', tenantId);
    await supabase.from('medicoes').delete().eq('tenant_id', tenantId);

    const { data: quotes } = await supabase
      .from('quotes')
      .select('id')
      .eq('tenant_id', tenantId);

    if (quotes && quotes.length > 0) {
      const qids = quotes.map((q) => q.id);
      await supabase.from('quote_items').delete().in('quote_id', qids);
      await supabase.from('quotes').delete().eq('tenant_id', tenantId);
    }

    // Subcontratos se existirem
    try {
      await supabase.from('subcontract_transactions').delete().eq('tenant_id', tenantId);
      await supabase.from('subcontracts').delete().eq('tenant_id', tenantId);
    } catch {
      // Ignora se tabela não existir
    }

    await supabase.from('projects').delete().eq('tenant_id', tenantId);
    await supabase.from('clients').delete().eq('tenant_id', tenantId);
    await supabase.from('suppliers').delete().eq('tenant_id', tenantId);
    await supabase.from('products').delete().eq('tenant_id', tenantId);
    await supabase.from('services').delete().eq('tenant_id', tenantId);

    console.log(`[resetDemoTenantData] Limpeza concluída. Restaurando dados sintéticos oficiais...`);

    // 2. Repovoamento Oficial da Empresa Teste
    // Clientes
    const { data: clients, error: errClients } = await supabase
      .from('clients')
      .insert([
        {
          tenant_id: tenantId,
          person_type: 'PJ',
          document: '33445566000177',
          name: 'Construtora & Incorporadora Horizonte Sul S.A.',
          trade_name: 'Horizonte Sul Empreendimentos',
          email: 'financeiro@horizontesul.com.br',
          phone: '1132549900',
          address_street: 'Av. Paulista',
          address_number: '1800',
          address_neighborhood: 'Bela Vista',
          address_city: 'São Paulo',
          address_state: 'SP',
          address_zip_code: '01310200',
          is_active: true,
        },
        {
          tenant_id: tenantId,
          person_type: 'PJ',
          document: '55667788000199',
          name: 'Condomínio Residencial Villa Bella',
          trade_name: 'Condomínio Villa Bella',
          email: 'sindico@villabella.com.br',
          phone: '1138887711',
          address_street: 'Rua Oscar Freire',
          address_number: '920',
          address_neighborhood: 'Cerqueira César',
          address_city: 'São Paulo',
          address_state: 'SP',
          address_zip_code: '01426001',
          is_active: true,
        },
        {
          tenant_id: tenantId,
          person_type: 'PF',
          document: '12345678909',
          name: 'Carlos Eduardo Mendonça',
          email: 'carlos.mendonca@gmail.com',
          phone: '11998877665',
          address_street: 'Rua das Laranjeiras',
          address_number: '340',
          address_neighborhood: 'Pinheiros',
          address_city: 'São Paulo',
          address_state: 'SP',
          address_zip_code: '05412000',
          is_active: true,
        },
      ])
      .select('id, name');

    if (errClients || !clients) {
      console.error('[resetDemoTenantData] Erro ao cadastrar clientes:', errClients);
      return false;
    }

    const clientHorizonte = clients[0];
    const clientVilla = clients[1];

    // Obras
    const { data: projects, error: errProjects } = await supabase
      .from('projects')
      .insert([
        {
          tenant_id: tenantId,
          client_id: clientHorizonte.id,
          name: 'Reforma Residencial Alpha',
          code: 'OBRA-2026-001',
          contract_value: 350000.0,
          technical_retention_perc: 5.0,
          status: 'em_andamento',
          start_date: '2026-08-01',
          expected_end_date: '2026-12-15',
          address_street: 'Av. Brigadeiro Faria Lima',
          address_number: '2500',
          address_city: 'São Paulo',
          address_state: 'SP',
          description: 'Reforma integral de cobertura duplex com reforço estrutural e acabamento padrão luxo.',
        },
        {
          tenant_id: tenantId,
          client_id: clientVilla.id,
          name: 'Instalação Piscina Beta',
          code: 'OBRA-2026-002',
          contract_value: 180000.0,
          technical_retention_perc: 5.0,
          status: 'em_andamento',
          start_date: '2026-09-10',
          expected_end_date: '2026-11-30',
          address_street: 'Alameda dos Jacarandás',
          address_number: '120',
          address_city: 'São Paulo',
          address_state: 'SP',
          description: 'Construção de piscina semiolímpica aquecida com deck molhado e iluminação fibra óptica.',
        },
      ])
      .select('id, name, client_id');

    if (errProjects || !projects) {
      console.error('[resetDemoTenantData] Erro ao cadastrar obras:', errProjects);
      return false;
    }

    const projectAlpha = projects[0];
    const projectPiscina = projects[1];

    // Fornecedores
    const { data: suppliers, error: errSuppliers } = await supabase
      .from('suppliers')
      .insert([
        {
          tenant_id: tenantId,
          person_type: 'PJ',
          document: '44556677000188',
          name: 'Distribuidora de Cimento Central Ltda',
          trade_name: 'Cimento Central',
          category: 'material_construcao',
          email: 'pedidos@cimentocentral.com.br',
          phone: '1131112233',
          address_city: 'São Paulo',
          address_state: 'SP',
          is_active: true,
        },
        {
          tenant_id: tenantId,
          person_type: 'PJ',
          document: '66778899000100',
          name: 'Aços & Armaduras Paulistana Ltda',
          trade_name: 'Aço Paulistana',
          category: 'material_construcao',
          email: 'vendas@acopaulistana.com.br',
          phone: '1132224455',
          address_city: 'São Paulo',
          address_state: 'SP',
          is_active: true,
        },
        {
          tenant_id: tenantId,
          person_type: 'PJ',
          document: '88990011000122',
          name: 'Locadora Morumbi Equipamentos e Caçambas Ltda',
          trade_name: 'Locadora Morumbi',
          category: 'locacao_equipamentos',
          email: 'atendimento@locadoramorumbi.com.br',
          phone: '1135556677',
          address_city: 'São Paulo',
          address_state: 'SP',
          is_active: true,
        },
      ])
      .select('id, name');

    if (errSuppliers || !suppliers) {
      console.error('[resetDemoTenantData] Erro ao cadastrar fornecedores:', errSuppliers);
      return false;
    }

    // Medições
    const { data: medicoes, error: errMedicoes } = await supabase
      .from('medicoes')
      .insert([
        {
          tenant_id: tenantId,
          project_id: projectAlpha.id,
          numero_sequencial: 1,
          periodo_inicio: '2026-08-01',
          periodo_fim: '2026-08-31',
          valor_medido: 80000.0,
          retencao_tecnica: 4000.0,
          valor_liquido: 76000.0,
          status: 'pago',
          observacoes: '1º Boletim: Demolições, retiradas de entulho e reforço estrutural.',
        },
        {
          tenant_id: tenantId,
          project_id: projectAlpha.id,
          numero_sequencial: 2,
          periodo_inicio: '2026-09-01',
          periodo_fim: '2026-09-30',
          valor_medido: 110000.0,
          retencao_tecnica: 5500.0,
          valor_liquido: 104500.0,
          status: 'pago',
          observacoes: '2º Boletim: Alvenarias, tubulações hidráulicas e infra elétrica.',
        },
        {
          tenant_id: tenantId,
          project_id: projectAlpha.id,
          numero_sequencial: 3,
          periodo_inicio: '2026-10-01',
          periodo_fim: '2026-10-31',
          valor_medido: 65000.0,
          retencao_tecnica: 3250.0,
          valor_liquido: 61750.0,
          status: 'aprovada',
          observacoes: '3º Boletim: Revestimentos cerâmicos e impermeabilizações.',
        },
        {
          tenant_id: tenantId,
          project_id: projectPiscina.id,
          numero_sequencial: 1,
          periodo_inicio: '2026-09-10',
          periodo_fim: '2026-09-30',
          valor_medido: 70000.0,
          retencao_tecnica: 3500.0,
          valor_liquido: 66500.0,
          status: 'pago',
          observacoes: '1º Boletim: Escavação, armação de aço e concretagem.',
        },
        {
          tenant_id: tenantId,
          project_id: projectPiscina.id,
          numero_sequencial: 2,
          periodo_inicio: '2026-10-01',
          periodo_fim: '2026-10-31',
          valor_medido: 50000.0,
          retencao_tecnica: 2500.0,
          valor_liquido: 47500.0,
          status: 'aprovada',
          observacoes: '2º Boletim: Impermeabilização e assentamento de pastilhas.',
        },
      ])
      .select('id, numero_sequencial, valor_medido, retencao_tecnica, valor_liquido');

    if (errMedicoes || !medicoes) {
      console.error('[resetDemoTenantData] Erro ao cadastrar medições:', errMedicoes);
      return false;
    }

    // Lançamentos Financeiros (5 a Receber e 5 a Pagar)
    await supabase.from('financial_entries').insert([
      {
        tenant_id: tenantId,
        entry_type: 'receivable',
        description: 'Faturamento 1ª Medição - Reforma Alpha',
        project_id: projectAlpha.id,
        client_id: projectAlpha.client_id,
        measurement_id: medicoes[0].id,
        category: 'medicao_obra',
        nominal_amount: 80000.0,
        technical_retention_amount: 4000.0,
        net_amount: 76000.0,
        status: 'pago',
        due_date: '2026-09-05',
        payment_date: '2026-09-04',
        document_number: 'FAT-2026-001',
        document_type: 'pix',
        notes: 'Recebimento integral com retenção de 5% garantida.',
      },
      {
        tenant_id: tenantId,
        entry_type: 'receivable',
        description: 'Faturamento 2ª Medição - Reforma Alpha',
        project_id: projectAlpha.id,
        client_id: projectAlpha.client_id,
        measurement_id: medicoes[1].id,
        category: 'medicao_obra',
        nominal_amount: 110000.0,
        technical_retention_amount: 5500.0,
        net_amount: 104500.0,
        status: 'pago',
        due_date: '2026-10-05',
        payment_date: '2026-10-05',
        document_number: 'FAT-2026-002',
        document_type: 'boleto',
        notes: 'Liquidado via boleto bancário no Bradesco.',
      },
      {
        tenant_id: tenantId,
        entry_type: 'receivable',
        description: 'Faturamento 3ª Medição - Reforma Alpha',
        project_id: projectAlpha.id,
        client_id: projectAlpha.client_id,
        measurement_id: medicoes[2].id,
        category: 'medicao_obra',
        nominal_amount: 65000.0,
        technical_retention_amount: 3250.0,
        net_amount: 61750.0,
        status: 'pendente',
        due_date: '2026-11-10',
        document_number: 'FAT-2026-003',
        document_type: 'boleto',
        notes: 'Boleto bancário emitido aguardando compensação.',
      },
      {
        tenant_id: tenantId,
        entry_type: 'receivable',
        description: 'Faturamento 1ª Medição - Piscina Beta',
        project_id: projectPiscina.id,
        client_id: projectPiscina.client_id,
        measurement_id: medicoes[3].id,
        category: 'medicao_obra',
        nominal_amount: 70000.0,
        technical_retention_amount: 3500.0,
        net_amount: 66500.0,
        status: 'pago',
        due_date: '2026-10-15',
        payment_date: '2026-10-14',
        document_number: 'FAT-2026-004',
        document_type: 'pix',
        notes: 'Transferência Pix liquidada com sucesso.',
      },
      {
        tenant_id: tenantId,
        entry_type: 'receivable',
        description: 'Faturamento 2ª Medição - Piscina Beta',
        project_id: projectPiscina.id,
        client_id: projectPiscina.client_id,
        measurement_id: medicoes[4].id,
        category: 'medicao_obra',
        nominal_amount: 50000.0,
        technical_retention_amount: 2500.0,
        net_amount: 47500.0,
        status: 'pendente',
        due_date: '2026-11-20',
        document_number: 'FAT-2026-005',
        document_type: 'boleto',
        notes: 'Boleto bancário a vencer.',
      },
      {
        tenant_id: tenantId,
        entry_type: 'payable',
        description: 'Aquisição de 400 sacos de Cimento CP-II 50kg (NF 18452)',
        project_id: projectAlpha.id,
        supplier_id: suppliers[0].id,
        category: 'material_construcao',
        nominal_amount: 15400.0,
        technical_retention_amount: 0.0,
        net_amount: 15400.0,
        status: 'pago',
        due_date: '2026-08-25',
        payment_date: '2026-08-25',
        document_number: 'NF-18452',
        document_type: 'boleto',
        notes: 'Boleto bancário liquidado no banco emissor.',
      },
      {
        tenant_id: tenantId,
        entry_type: 'payable',
        description: 'Armaduras de aço CA-50 10mm e 8mm dobradas e cortadas',
        project_id: projectPiscina.id,
        supplier_id: suppliers[1].id,
        category: 'material_construcao',
        nominal_amount: 12850.0,
        technical_retention_amount: 0.0,
        net_amount: 12850.0,
        status: 'pago',
        due_date: '2026-09-20',
        payment_date: '2026-09-19',
        document_number: 'NF-22901',
        document_type: 'pix',
        notes: 'Liquidado com desconto antecipado via Pix.',
      },
      {
        tenant_id: tenantId,
        entry_type: 'payable',
        description: 'Fornecimento de 18m³ de concreto usinado bombeado FCK 30',
        project_id: projectPiscina.id,
        supplier_id: suppliers[0].id,
        category: 'material_construcao',
        nominal_amount: 8640.0,
        technical_retention_amount: 0.0,
        net_amount: 8640.0,
        status: 'pago',
        due_date: '2026-10-12',
        payment_date: '2026-10-12',
        document_number: 'NF-23115',
        document_type: 'boleto',
        notes: 'Concretagem da estrutura da piscina realizada em 10/10.',
      },
      {
        tenant_id: tenantId,
        entry_type: 'payable',
        description: 'Manta Asfáltica Poliéster 4mm e primer impermeabilizante',
        project_id: projectAlpha.id,
        supplier_id: suppliers[0].id,
        category: 'material_construcao',
        nominal_amount: 9420.0,
        technical_retention_amount: 0.0,
        net_amount: 9420.0,
        status: 'pendente',
        due_date: '2026-11-02',
        document_number: 'NF-24089',
        document_type: 'boleto',
        notes: 'Material entregue no canteiro da cobertura duplex.',
      },
      {
        tenant_id: tenantId,
        entry_type: 'payable',
        description: 'Locação mensal de torre de andaimes fachadeiros e 6 caçambas',
        project_id: projectAlpha.id,
        supplier_id: suppliers[2].id,
        category: 'locacao_equipamentos',
        nominal_amount: 4800.0,
        technical_retention_amount: 0.0,
        net_amount: 4800.0,
        status: 'pendente',
        due_date: '2026-11-15',
        document_number: 'FAT-LOC-998',
        document_type: 'boleto',
        notes: 'Equipamentos em uso para finalização de fachadas.',
      },
    ]);

    // Catálogo Produtos e Serviços
    await supabase.from('products').insert([
      {
        tenant_id: tenantId,
        sku: 'CIM-CPII-50KG',
        name: 'Cimento Portland Composto CP II-E-32 (Saco 50kg)',
        category: 'material_basico',
        unit_of_measure: 'SC',
        unit_cost: 38.5,
        target_markup_perc: 35.0,
        suggested_price: 51.98,
        stock_quantity: 400.0,
        min_stock: 50.0,
        is_active: true,
      },
      {
        tenant_id: tenantId,
        sku: 'ACO-CA50-10MM',
        name: 'Barra de Aço Nervurado CA-50 10.0mm (Barra 12m)',
        category: 'estruturas_metalicas',
        unit_of_measure: 'BR',
        unit_cost: 64.2,
        target_markup_perc: 40.0,
        suggested_price: 89.88,
        stock_quantity: 150.0,
        min_stock: 20.0,
        is_active: true,
      },
    ]);

    await supabase.from('services').insert([
      {
        tenant_id: tenantId,
        service_code: 'SRV-DEMOL-01',
        name: 'Demolição Controlada de Alvenaria e Remoção Manual de Entulho',
        category: 'mao_de_obra',
        unit_of_measure: 'M3',
        base_cost: 110.0,
        target_markup_perc: 45.0,
        suggested_price: 159.5,
        is_active: true,
      },
      {
        tenant_id: tenantId,
        service_code: 'SRV-IMPERM-02',
        name: 'Impermeabilização com Manta Asfáltica 4mm em Lajes e Decks',
        category: 'mao_de_obra',
        unit_of_measure: 'M2',
        base_cost: 85.0,
        target_markup_perc: 50.0,
        suggested_price: 127.5,
        is_active: true,
      },
    ]);

    console.log(`[resetDemoTenantData] ✅ Tenant de teste ${tenantId} restaurado com sucesso!`);
    return true;
  } catch (err) {
    console.error('[resetDemoTenantData] Erro inesperado ao resetar tenant de teste:', err);
    return false;
  }
}
