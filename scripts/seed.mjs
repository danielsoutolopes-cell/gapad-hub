import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Carrega variáveis do arquivo .env.local se existirem
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...values] = trimmed.split('=');
      const val = values.join('=').replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dkjcgrwztyhcsyxlajia.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.includes('your_')) {
  console.error('ERRO: SUPABASE_SERVICE_ROLE_KEY não configurada no .env.local.');
  console.error('Defina SUPABASE_SERVICE_ROLE_KEY="sb_secret_..." no arquivo .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function runSeed() {
  console.log('====================================================');
  console.log('🚀 GADAP Hub - Povoamento de Dados e Backoffice');
  console.log('====================================================\n');

  try {
    // -------------------------------------------------------------------------
    // 1. Criar ou Obter a "Empresa Teste" na tabela public.companies (Tenant Raiz)
    // -------------------------------------------------------------------------
    console.log('🏢 Passo 1: Configurando Empresa Teste (Tenant raiz)...');
    
    const companyCnpj = '12345678000199';
    let tenantId = null;

    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id, trade_name')
      .eq('cnpj', companyCnpj)
      .maybeSingle();

    if (existingCompany) {
      tenantId = existingCompany.id;
      console.log(`   ✓ Empresa existente encontrada: "${existingCompany.trade_name}"`);
      console.log(`   ✓ Tenant ID: ${tenantId}`);
    } else {
      const { data: newCompany, error: createCompanyError } = await supabase
        .from('companies')
        .insert({
          legal_name: 'Empresa Teste Engenharia e Obras Ltda',
          trade_name: 'Empresa Teste',
          cnpj: companyCnpj,
          state_registration: '123456789',
          municipal_registration: '987654',
          tax_regime: 'simples_nacional',
          email: 'admin@teste.com',
          phone: '11987654321',
          address_city: 'São Paulo',
          address_state: 'SP',
          is_active: true,
        })
        .select('id, trade_name')
        .single();

      if (createCompanyError) {
        throw new Error(`Falha ao criar Empresa Teste: ${createCompanyError.message}`);
      }

      tenantId = newCompany.id;
      console.log(`   ✓ Empresa Teste cadastrada com sucesso!`);
      console.log(`   ✓ Tenant ID: ${tenantId}`);
    }

    // -------------------------------------------------------------------------
    // 2. Criar ou Atualizar Usuário no Supabase Auth (auth.users)
    // -------------------------------------------------------------------------
    console.log('\n🔑 Passo 2: Configurando Usuário Admin no Supabase Auth...');
    const userEmail = 'admin@teste.com';
    const userPassword = 'Gadap2026!';
    let authUserId = null;

    const { data: { users }, error: listUsersError } = await supabase.auth.admin.listUsers();
    if (listUsersError) {
      throw new Error(`Erro ao listar usuários do Auth: ${listUsersError.message}`);
    }

    const existingAuthUser = users.find((u) => u.email === userEmail);

    if (existingAuthUser) {
      authUserId = existingAuthUser.id;
      console.log(`   ✓ Usuário ${userEmail} localizado no Auth (${authUserId}). Atualizando permissões...`);

      const { error: updateAuthError } = await supabase.auth.admin.updateUserById(authUserId, {
        password: userPassword,
        app_metadata: {
          tenant_id: tenantId,
          role: 'admin',
        },
        user_metadata: {
          tenant_id: tenantId,
          role: 'admin',
          full_name: 'Administrador Teste',
        },
        email_confirm: true,
      });

      if (updateAuthError) {
        throw new Error(`Erro ao atualizar usuário no Auth: ${updateAuthError.message}`);
      }
      console.log(`   ✓ Credenciais e app_metadata.tenant_id sincronizados.`);
    } else {
      console.log(`   ✓ Criando novo usuário ${userEmail}...`);

      const { data: newAuthUser, error: createAuthError } = await supabase.auth.admin.createUser({
        email: userEmail,
        password: userPassword,
        email_confirm: true,
        app_metadata: {
          tenant_id: tenantId,
          role: 'admin',
        },
        user_metadata: {
          tenant_id: tenantId,
          role: 'admin',
          full_name: 'Administrador Teste',
        },
      });

      if (createAuthError) {
        throw new Error(`Erro ao criar usuário no Auth: ${createAuthError.message}`);
      }

      authUserId = newAuthUser.user.id;
      console.log(`   ✓ Usuário Auth criado com sucesso! ID: ${authUserId}`);
    }

    // -------------------------------------------------------------------------
    // 3. Vincular na tabela pública public.users
    // -------------------------------------------------------------------------
    console.log('\n👤 Passo 3: Vinculando usuário na tabela pública public.users...');
    const { data: existingPublicUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (existingPublicUser) {
      await supabase
        .from('users')
        .update({
          tenant_id: tenantId,
          full_name: 'Administrador Teste',
          role: 'admin',
          is_active: true,
          is_superadmin: false,
        })
        .eq('id', existingPublicUser.id);
      console.log(`   ✓ Registro em public.users atualizado com tenant_id.`);
    } else {
      await supabase
        .from('users')
        .insert({
          tenant_id: tenantId,
          auth_user_id: authUserId,
          full_name: 'Administrador Teste',
          email: userEmail,
          phone: '11987654321',
          role: 'admin',
          is_active: true,
          is_superadmin: false,
        });
      console.log(`   ✓ Usuário inserido na tabela public.users.`);
    }

    // -------------------------------------------------------------------------
    // 3B. Criar ou Configurar Usuário MASTER Absoluto do SaaS (Super Admin)
    // -------------------------------------------------------------------------
    console.log('\n👑 Passo 3B: Configurando Usuário MASTER (Super Admin) no Supabase Auth...');
    const masterEmail = 'danielsmlopes@hotmail.com';
    const masterPassword = 'Gabriel2006';
    let masterAuthId = null;

    const existingMasterAuth = users.find((u) => u.email === masterEmail);

    if (existingMasterAuth) {
      masterAuthId = existingMasterAuth.id;
      console.log(`   ✓ Usuário MASTER já existe no Auth (${masterAuthId}). Atualizando flag is_superadmin=true...`);

      const { error: updateMasterAuthErr } = await supabase.auth.admin.updateUserById(masterAuthId, {
        password: masterPassword,
        app_metadata: {
          tenant_id: tenantId,
          role: 'superadmin',
          is_superadmin: true,
        },
        user_metadata: {
          tenant_id: tenantId,
          role: 'superadmin',
          is_superadmin: true,
          full_name: 'Daniel Master (SuperAdmin)',
        },
        email_confirm: true,
      });

      if (updateMasterAuthErr) {
        throw new Error(`Erro ao atualizar MASTER no Auth: ${updateMasterAuthErr.message}`);
      }
      console.log(`   ✓ Senha e app_metadata.is_superadmin=true configurados com sucesso!`);
    } else {
      console.log(`   ✓ Criando novo usuário MASTER ${masterEmail} com is_superadmin=true...`);

      const { data: newMasterAuth, error: createMasterAuthErr } = await supabase.auth.admin.createUser({
        email: masterEmail,
        password: masterPassword,
        email_confirm: true,
        app_metadata: {
          tenant_id: tenantId,
          role: 'superadmin',
          is_superadmin: true,
        },
        user_metadata: {
          tenant_id: tenantId,
          role: 'superadmin',
          is_superadmin: true,
          full_name: 'Daniel Master (SuperAdmin)',
        },
      });

      if (createMasterAuthErr) {
        throw new Error(`Erro ao criar usuário MASTER no Auth: ${createMasterAuthErr.message}`);
      }

      masterAuthId = newMasterAuth.user.id;
      console.log(`   ✓ Usuário MASTER criado no Auth com ID: ${masterAuthId}`);
    }

    // Vincular ou atualizar o MASTER em public.users
    const { data: existingMasterPublic } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', masterAuthId)
      .maybeSingle();

    if (existingMasterPublic) {
      await supabase
        .from('users')
        .update({
          tenant_id: tenantId,
          full_name: 'Daniel Master (SuperAdmin)',
          role: 'superadmin',
          is_superadmin: true,
          is_active: true,
        })
        .eq('id', existingMasterPublic.id);
      console.log(`   ✓ Registro de public.users atualizado com is_superadmin = true.`);
    } else {
      await supabase
        .from('users')
        .insert({
          tenant_id: tenantId,
          auth_user_id: masterAuthId,
          full_name: 'Daniel Master (SuperAdmin)',
          email: masterEmail,
          phone: '11999998888',
          role: 'superadmin',
          is_superadmin: true,
          is_active: true,
        });
      console.log(`   ✓ Registro de MASTER inserido em public.users com is_superadmin = true.`);
    }

    // -------------------------------------------------------------------------
    // 4. Idempotência Rigorosa: Limpeza prévia de registros sintéticos da Empresa Teste
    // -------------------------------------------------------------------------
    console.log('\n🧹 Passo 4: Limpeza idempotente dos registros anteriores da Empresa Teste...');
    
    // Deleta lançamentos financeiros
    await supabase.from('financial_entries').delete().eq('tenant_id', tenantId);
    console.log('   ✓ Lançamentos financeiros anteriores removidos.');

    // Deleta medições de engenharia
    await supabase.from('medicoes').delete().eq('tenant_id', tenantId);
    console.log('   ✓ Medições anteriores removidas.');

    // Deleta orçamentos e itens
    const { data: oldQuotes } = await supabase.from('quotes').select('id').eq('tenant_id', tenantId);
    if (oldQuotes && oldQuotes.length > 0) {
      const quoteIds = oldQuotes.map((q) => q.id);
      await supabase.from('quote_items').delete().in('quote_id', quoteIds);
      await supabase.from('quotes').delete().eq('tenant_id', tenantId);
      console.log('   ✓ Orçamentos anteriores removidos.');
    }

    // Deleta obras
    await supabase.from('projects').delete().eq('tenant_id', tenantId);
    console.log('   ✓ Obras anteriores removidas.');

    // Deleta clientes
    await supabase.from('clients').delete().eq('tenant_id', tenantId);
    console.log('   ✓ Clientes anteriores removidos.');

    // Deleta fornecedores, produtos e serviços anteriores para recriação limpa
    await supabase.from('suppliers').delete().eq('tenant_id', tenantId);
    await supabase.from('products').delete().eq('tenant_id', tenantId);
    await supabase.from('services').delete().eq('tenant_id', tenantId);
    console.log('   ✓ Catálogos comerciais anteriores limpos com sucesso.');

    // -------------------------------------------------------------------------
    // 5. Cadastrar 3 Clientes Sintéticos (2 PJ e 1 PF)
    // -------------------------------------------------------------------------
    console.log('\n👥 Passo 5: Cadastrando 3 Clientes sintéticos realistas (2 PJ e 1 PF)...');

    const clientsPayload = [
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
        document: '88990011000122',
        name: 'Condomínio Residencial Villa Bella',
        trade_name: 'Residencial Villa Bella',
        email: 'administracao@villabella.com.br',
        phone: '11984521122',
        address_street: 'Rua das Figueiras',
        address_number: '450',
        address_neighborhood: 'Jardim Europa',
        address_city: 'São Paulo',
        address_state: 'SP',
        address_zip_code: '01449000',
        is_active: true,
      },
      {
        tenant_id: tenantId,
        person_type: 'PF',
        document: '21568974512',
        name: 'Carlos Eduardo Mendonça',
        trade_name: 'Dr. Carlos Eduardo',
        email: 'carlos.mendonca@medicina.com.br',
        phone: '11991234567',
        address_street: 'Alameda dos Anapurus',
        address_number: '820',
        address_neighborhood: 'Moema',
        address_city: 'São Paulo',
        address_state: 'SP',
        address_zip_code: '04087002',
        is_active: true,
      },
    ];

    const { data: createdClients, error: createClientsErr } = await supabase
      .from('clients')
      .insert(clientsPayload)
      .select('id, name, person_type');

    if (createClientsErr) {
      throw new Error(`Erro ao cadastrar clientes: ${createClientsErr.message}`);
    }

    const clientHorizonte = createdClients.find((c) => c.person_type === 'PJ' && c.name.includes('Horizonte'));
    const clientVillaBella = createdClients.find((c) => c.person_type === 'PJ' && c.name.includes('Villa Bella'));
    const clientCarlosPF = createdClients.find((c) => c.person_type === 'PF');

    console.log(`   ✓ [PJ] ${clientHorizonte?.name} (ID: ${clientHorizonte?.id})`);
    console.log(`   ✓ [PJ] ${clientVillaBella?.name} (ID: ${clientVillaBella?.id})`);
    console.log(`   ✓ [PF] ${clientCarlosPF?.name} (ID: ${clientCarlosPF?.id})`);

    // -------------------------------------------------------------------------
    // 6. Cadastrar 2 Obras (Projects)
    // -------------------------------------------------------------------------
    console.log('\n🏗️ Passo 6: Cadastrando 2 Obras emblemáticas...');

    const projectsPayload = [
      {
        tenant_id: tenantId,
        client_id: clientHorizonte.id,
        code: 'OBR-ALPHA-01',
        name: 'Reforma Residencial Alpha',
        description: 'Reforma completa de cobertura duplex: reforço estrutural, impermeabilização e acabamento de alto padrão.',
        contract_value: 350000.0,
        technical_retention_perc: 5.0,
        status: 'em_andamento',
        start_date: '2026-08-01',
        end_date_planned: '2027-02-28',
        address_city_ibge: '3550308',
        address_state: 'SP',
      },
      {
        tenant_id: tenantId,
        client_id: clientCarlosPF.id,
        code: 'OBR-PISC-02',
        name: 'Instalação Piscina Beta',
        description: 'Construção e instalação de piscina em concreto armado com deck térmico, iluminação LED e casa de máquinas.',
        contract_value: 180000.0,
        technical_retention_perc: 5.0,
        status: 'em_andamento',
        start_date: '2026-09-15',
        end_date_planned: '2026-12-20',
        address_city_ibge: '3550308',
        address_state: 'SP',
      },
    ];

    const { data: createdProjects, error: createProjectsErr } = await supabase
      .from('projects')
      .insert(projectsPayload)
      .select('id, name, code, contract_value');

    if (createProjectsErr) {
      throw new Error(`Erro ao cadastrar obras: ${createProjectsErr.message}`);
    }

    const projectAlpha = createdProjects.find((p) => p.code === 'OBR-ALPHA-01');
    const projectPiscina = createdProjects.find((p) => p.code === 'OBR-PISC-02');

    console.log(`   ✓ Obra 1: "${projectAlpha.name}" - Contrato: R$ ${projectAlpha.contract_value.toLocaleString('pt-BR')}`);
    console.log(`   ✓ Obra 2: "${projectPiscina.name}" - Contrato: R$ ${projectPiscina.contract_value.toLocaleString('pt-BR')}`);

    // -------------------------------------------------------------------------
    // 7. Cadastrar Fornecedores de Insumos Fictícios
    // -------------------------------------------------------------------------
    console.log('\n🚚 Passo 7: Cadastrando Fornecedores homologados de materiais e serviços...');

    const suppliersPayload = [
      {
        tenant_id: tenantId,
        person_type: 'PJ',
        document: '11222333000199',
        name: 'Distribuidora de Cimento Central Ltda',
        trade_name: 'Cimento Central',
        category: 'materiais_construcao',
        email: 'vendas@cimentocentral.com.br',
        phone: '11988887777',
        contact_name: 'Marcos Vinicius',
        address_city: 'São Paulo',
        address_state: 'SP',
        is_active: true,
      },
      {
        tenant_id: tenantId,
        person_type: 'PJ',
        document: '44555666000188',
        name: 'Aços & Armaduras Paulistana Ltda',
        trade_name: 'Paulistana Aços',
        category: 'estruturas_metalicas',
        email: 'comercial@paulistanaacos.com.br',
        phone: '1138882200',
        contact_name: 'Rodrigo Silva',
        address_city: 'São Paulo',
        address_state: 'SP',
        is_active: true,
      },
      {
        tenant_id: tenantId,
        person_type: 'PJ',
        document: '77888999000111',
        name: 'Locadora Morumbi Equipamentos e Caçambas Ltda',
        trade_name: 'Morumbi Locações',
        category: 'locacao_equipamentos',
        email: 'contato@morumbilocacoes.com.br',
        phone: '1137774411',
        contact_name: 'Renata Castro',
        address_city: 'São Paulo',
        address_state: 'SP',
        is_active: true,
      },
    ];

    const { data: createdSuppliers, error: createSuppliersErr } = await supabase
      .from('suppliers')
      .insert(suppliersPayload)
      .select('id, name');

    if (createSuppliersErr) {
      throw new Error(`Erro ao cadastrar fornecedores: ${createSuppliersErr.message}`);
    }

    const supplierCimento = createdSuppliers[0];
    const supplierAco = createdSuppliers[1];
    const supplierLocacao = createdSuppliers[2];

    console.log(`   ✓ Fornecedor 1: ${supplierCimento.name}`);
    console.log(`   ✓ Fornecedor 2: ${supplierAco.name}`);
    console.log(`   ✓ Fornecedor 3: ${supplierLocacao.name}`);

    // -------------------------------------------------------------------------
    // 8. Cadastrar 5 Medições Físico-Financeiras (com 5% de Retenção Técnica)
    // -------------------------------------------------------------------------
    console.log('\n📐 Passo 8: Cadastrando 5 Medições com retenção técnica determinística de 5%...');

    const measurementsPayload = [
      // Medições Obra Alpha
      {
        tenant_id: tenantId,
        project_id: projectAlpha.id,
        numero_sequencial: 1,
        periodo_inicio: '2026-08-01',
        periodo_fim: '2026-08-31',
        valor_medido: 80000.0,
        retencao_tecnica: 4000.0, // 5% de 80.000
        valor_liquido: 76000.0,
        status: 'faturada',
        observacoes: '1º Boletim Mensal: Demolições, retiradas de entulho e reforço estrutural em pilares.',
      },
      {
        tenant_id: tenantId,
        project_id: projectAlpha.id,
        numero_sequencial: 2,
        periodo_inicio: '2026-09-01',
        periodo_fim: '2026-09-30',
        valor_medido: 110000.0,
        retencao_tecnica: 5500.0, // 5% de 110.000
        valor_liquido: 104500.0,
        status: 'faturada',
        observacoes: '2º Boletim Mensal: Alvenarias estruturais, tubulações hidrossanitárias e eletrodutos.',
      },
      {
        tenant_id: tenantId,
        project_id: projectAlpha.id,
        numero_sequencial: 3,
        periodo_inicio: '2026-10-01',
        periodo_fim: '2026-10-24',
        valor_medido: 65000.0,
        retencao_tecnica: 3250.0, // 5% de 65.000
        valor_liquido: 61750.0,
        status: 'aprovada',
        observacoes: '3º Boletim Mensal: Impermeabilização com manta asfáltica e regularização de contrapisos.',
      },
      // Medições Obra Piscina Beta
      {
        tenant_id: tenantId,
        project_id: projectPiscina.id,
        numero_sequencial: 1,
        periodo_inicio: '2026-09-15',
        periodo_fim: '2026-10-05',
        valor_medido: 70000.0,
        retencao_tecnica: 3500.0, // 5% de 70.000
        valor_liquido: 66500.0,
        status: 'faturada',
        observacoes: '1º Boletim Físico: Escavação mecânica, compactação e armação de aço da piscina.',
      },
      {
        tenant_id: tenantId,
        project_id: projectPiscina.id,
        numero_sequencial: 2,
        periodo_inicio: '2026-10-06',
        periodo_fim: '2026-10-24',
        valor_medido: 50000.0,
        retencao_tecnica: 2500.0, // 5% de 50.000
        valor_liquido: 47500.0,
        status: 'aprovada',
        observacoes: '2º Boletim Físico: Concretagem estrutural usinada, impermeabilização e tubulação de retorno.',
      },
    ];

    const { data: createdMeasurements, error: createMeasurementsErr } = await supabase
      .from('medicoes')
      .insert(measurementsPayload)
      .select('id, numero_sequencial, valor_medido, valor_liquido, project_id');

    if (createMeasurementsErr) {
      throw new Error(`Erro ao cadastrar medições: ${createMeasurementsErr.message}`);
    }

    const medAlpha1 = createdMeasurements.find((m) => m.project_id === projectAlpha.id && m.numero_sequencial === 1);
    const medAlpha2 = createdMeasurements.find((m) => m.project_id === projectAlpha.id && m.numero_sequencial === 2);
    const medAlpha3 = createdMeasurements.find((m) => m.project_id === projectAlpha.id && m.numero_sequencial === 3);
    const medPiscina1 = createdMeasurements.find((m) => m.project_id === projectPiscina.id && m.numero_sequencial === 1);
    const medPiscina2 = createdMeasurements.find((m) => m.project_id === projectPiscina.id && m.numero_sequencial === 2);

    console.log(`   ✓ Medição 1 (Alpha): Bruto R$ 80.000,00 | Retenção 5% R$ 4.000,00 | Líquido R$ 76.000,00`);
    console.log(`   ✓ Medição 2 (Alpha): Bruto R$ 110.000,00 | Retenção 5% R$ 5.500,00 | Líquido R$ 104.500,00`);
    console.log(`   ✓ Medição 3 (Alpha): Bruto R$ 65.000,00 | Retenção 5% R$ 3.250,00 | Líquido R$ 61.750,00`);
    console.log(`   ✓ Medição 1 (Piscina): Bruto R$ 70.000,00 | Retenção 5% R$ 3.500,00 | Líquido R$ 66.500,00`);
    console.log(`   ✓ Medição 2 (Piscina): Bruto R$ 50.000,00 | Retenção 5% R$ 2.500,00 | Líquido R$ 47.500,00`);

    // -------------------------------------------------------------------------
    // 9. Cadastrar 10 Lançamentos Financeiros (5 Contas a Receber e 5 Contas a Pagar)
    // -------------------------------------------------------------------------
    console.log('\n💰 Passo 9: Cadastrando 10 Lançamentos Financeiros (5 Contas a Receber e 5 Contas a Pagar)...');

    const financialPayload = [
      // 5 CONTAS A RECEBER (Vinculadas às medições)
      {
        tenant_id: tenantId,
        entry_type: 'receivable',
        description: 'Faturamento Medição 01 - Reforma Residencial Alpha',
        project_id: projectAlpha.id,
        client_id: clientHorizonte.id,
        measurement_id: medAlpha1.id,
        category: 'medicao_obra',
        nominal_amount: 80000.0,
        technical_retention_amount: 4000.0,
        net_amount: 76000.0,
        status: 'pago',
        due_date: '2026-09-10',
        payment_date: '2026-09-08',
        document_number: 'FAT-MED-001',
        document_type: 'boleto',
        pix_code: '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000520400005303986540876000.005802BR5913Empresa Teste6009Sao Paulo62070503***6304ABCD',
        notes: 'Liquidado pontualmente via conciliação bancária.',
      },
      {
        tenant_id: tenantId,
        entry_type: 'receivable',
        description: 'Faturamento Medição 02 - Reforma Residencial Alpha',
        project_id: projectAlpha.id,
        client_id: clientHorizonte.id,
        measurement_id: medAlpha2.id,
        category: 'medicao_obra',
        nominal_amount: 110000.0,
        technical_retention_amount: 5500.0,
        net_amount: 104500.0,
        status: 'pago',
        due_date: '2026-10-10',
        payment_date: '2026-10-10',
        document_number: 'FAT-MED-002',
        document_type: 'pix',
        pix_code: '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-42661417400052040000530398654104500.005802BR5913Empresa Teste6009Sao Paulo62070503***6304BCDE',
        notes: 'Recebimento automático confirmado via Webhook Pix.',
      },
      {
        tenant_id: tenantId,
        entry_type: 'receivable',
        description: 'Faturamento Medição 03 - Reforma Residencial Alpha',
        project_id: projectAlpha.id,
        client_id: clientHorizonte.id,
        measurement_id: medAlpha3.id,
        category: 'medicao_obra',
        nominal_amount: 65000.0,
        technical_retention_amount: 3250.0,
        net_amount: 61750.0,
        status: 'pendente',
        due_date: '2026-11-10',
        document_number: 'FAT-MED-003',
        document_type: 'boleto',
        notes: 'Aguardando vencimento programado no fluxo de caixa.',
      },
      {
        tenant_id: tenantId,
        entry_type: 'receivable',
        description: 'Faturamento Medição 01 - Instalação Piscina Beta',
        project_id: projectPiscina.id,
        client_id: clientCarlosPF.id,
        measurement_id: medPiscina1.id,
        category: 'medicao_obra',
        nominal_amount: 70000.0,
        technical_retention_amount: 3500.0,
        net_amount: 66500.0,
        status: 'pago',
        due_date: '2026-10-15',
        payment_date: '2026-10-14',
        document_number: 'FAT-PISC-001',
        document_type: 'pix',
        notes: 'Liquidado via transferência Pix pelo cliente Dr. Carlos.',
      },
      {
        tenant_id: tenantId,
        entry_type: 'receivable',
        description: 'Faturamento Medição 02 - Instalação Piscina Beta',
        project_id: projectPiscina.id,
        client_id: clientCarlosPF.id,
        measurement_id: medPiscina2.id,
        category: 'medicao_obra',
        nominal_amount: 50000.0,
        technical_retention_amount: 2500.0,
        net_amount: 47500.0,
        status: 'pendente',
        due_date: '2026-11-05',
        document_number: 'FAT-PISC-002',
        document_type: 'boleto',
        notes: 'Boletim aprovado em campo, boleto gerado para faturamento.',
      },

      // 5 CONTAS A PAGAR (Insumos, fornecedores e locações)
      {
        tenant_id: tenantId,
        entry_type: 'payable',
        description: 'Aquisição de 400 sacos de Cimento CP-II 50kg (NF 18452)',
        project_id: projectAlpha.id,
        supplier_id: supplierCimento.id,
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
        supplier_id: supplierAco.id,
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
        supplier_id: supplierCimento.id,
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
        supplier_id: supplierCimento.id,
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
        supplier_id: supplierLocacao.id,
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
    ];

    const { error: createFinancialErr } = await supabase
      .from('financial_entries')
      .insert(financialPayload);

    if (createFinancialErr) {
      throw new Error(`Erro ao cadastrar lançamentos financeiros: ${createFinancialErr.message}`);
    }

    console.log('   ✓ 5 Contas a Receber cadastradas (R$ 356.250,00 líquidos faturados/programados).');
    console.log('   ✓ 5 Contas a Pagar cadastradas (R$ 51.110,00 de insumos e equipamentos).');

    // -------------------------------------------------------------------------
    // 10. Cadastrar Produtos e Serviços de Demonstração
    // -------------------------------------------------------------------------
    console.log('\n📦 Passo 10: Cadastrando Produtos e Serviços para o catálogo comercial...');

    await supabase.from('products').insert([
      {
        tenant_id: tenantId,
        code: 'MAT-CIM-001',
        name: 'Cimento CP-II 50kg Votoran',
        description: 'Cimento Portland composto com escória granulada de alto-forno',
        ncm: '25232910',
        unit_of_measure: 'SC',
        base_cost: 38.5,
        sale_price: 45.0,
        category: 'aglomerantes',
        is_active: true,
      },
      {
        tenant_id: tenantId,
        code: 'MAT-ACO-002',
        name: 'Barra de Aço CA-50 10mm (12m)',
        description: 'Vergalhão nervurado para armadura de estruturas de concreto armado',
        ncm: '72142000',
        unit_of_measure: 'BR',
        base_cost: 52.0,
        sale_price: 64.0,
        category: 'estruturas_metalicas',
        is_active: true,
      },
    ]);

    await supabase.from('services').insert([
      {
        tenant_id: tenantId,
        code: 'SRV-ALV-001',
        name: 'Alvenaria Estrutural Bloco de Concreto',
        description: 'Execução de alvenaria estrutural armada com blocos vazados de concreto 14x19x39 cm',
        nbs_code: '1.0101.10.00',
        lc116_code: '07.02',
        base_cost: 42.0,
        default_price: 65.0,
        unit_of_measure: 'M2',
        iss_aliquota: 5.0,
        inss_retencao_aliquota: 11.0,
        is_active: true,
      },
      {
        tenant_id: tenantId,
        code: 'SRV-IMP-002',
        name: 'Impermeabilização com Manta Asfáltica 4mm',
        description: 'Aplicação de primer e manta asfáltica aderida com maçarico a gás',
        nbs_code: '1.0101.20.00',
        lc116_code: '07.05',
        base_cost: 58.0,
        default_price: 88.0,
        unit_of_measure: 'M2',
        iss_aliquota: 5.0,
        inss_retencao_aliquota: 11.0,
        is_active: true,
      },
    ]);

    console.log('   ✓ Insumos e serviços do catálogo cadastrados com sucesso.');

    console.log('\n====================================================');
    console.log('🎉 SEED CONCLUÍDO COM SUCESSO TOTAL E IDEMPOTÊNCIA!');
    console.log('====================================================');
    console.log('🏢 Empresa:               Empresa Teste');
    console.log(`🆔 Tenant ID:             ${tenantId}`);
    console.log('📧 E-mail Admin:          admin@teste.com');
    console.log('🔒 Senha Admin:           Gadap2026!');
    console.log('👑 E-mail MASTER:         danielsmlopes@hotmail.com');
    console.log('🔒 Senha MASTER:          Gabriel2006 (is_superadmin=true)');
    console.log('👥 Clientes Povoados:     3 (2 PJ e 1 PF)');
    console.log('🏗️ Obras Ativas:          2 ("Reforma Residencial Alpha" e "Instalação Piscina Beta")');
    console.log('📐 Medições Registradas:  5 (todas com 5% de retenção técnica determinística)');
    console.log('💰 Lançamentos:           10 (5 Contas a Receber e 5 Contas a Pagar)');
    console.log('🌐 Rota de Login:         http://localhost:3000/login');
    console.log('📊 Painel Obras:          http://localhost:3000/dashboard/obras');
    console.log('👥 Clientes:              http://localhost:3000/dashboard/clientes');
    console.log('====================================================\n');

  } catch (error) {
    console.error('\n❌ ERRO DURANTE EXECUÇÃO DO SEED:');
    console.error(error);
    process.exit(1);
  }
}

runSeed();
