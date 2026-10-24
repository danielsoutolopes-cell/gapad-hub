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
  console.log('🚀 GADAP Hub - Inicialização do Seed de Ambiente');
  console.log('====================================================\n');

  try {
    // -------------------------------------------------------------------------
    // 1. Criar ou Obter a "Empresa Teste" na tabela public.companies
    // -------------------------------------------------------------------------
    console.log('📦 Passo 1: Configurando Empresa Teste (Tenant raiz)...');
    
    const companyCnpj = '12345678000199';
    let tenantId = null;

    const { data: existingCompany, error: findCompanyError } = await supabase
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
      console.log(`   ✓ Usuário ${userEmail} já existe no Auth (${authUserId}). Atualizando credenciais e app_metadata...`);

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
      console.log(`   ✓ Senha e app_metadata.tenant_id injetados com sucesso!`);
    } else {
      console.log(`   ✓ Criando novo usuário ${userEmail} com app_metadata.tenant_id...`);

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
    // 3. Inserir ou Atualizar na tabela pública public.users
    // -------------------------------------------------------------------------
    console.log('\n👤 Passo 3: Vinculando usuário na tabela pública public.users...');

    const { data: existingPublicUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (existingPublicUser) {
      const { error: updatePublicError } = await supabase
        .from('users')
        .update({
          tenant_id: tenantId,
          full_name: 'Administrador Teste',
          role: 'admin',
          is_active: true,
        })
        .eq('id', existingPublicUser.id);

      if (updatePublicError) {
        throw new Error(`Erro ao atualizar public.users: ${updatePublicError.message}`);
      }
      console.log(`   ✓ Registro em public.users atualizado com tenant_id.`);
    } else {
      const { error: insertPublicError } = await supabase
        .from('users')
        .insert({
          tenant_id: tenantId,
          auth_user_id: authUserId,
          full_name: 'Administrador Teste',
          email: userEmail,
          phone: '11987654321',
          role: 'admin',
          is_active: true,
        });

      if (insertPublicError) {
        throw new Error(`Erro ao inserir em public.users: ${insertPublicError.message}`);
      }
      console.log(`   ✓ Usuário inserido na tabela public.users.`);
    }

    // -------------------------------------------------------------------------
    // 4. Cadastrar 1 Cliente e 1 Obra Demonstrativa para o Tenant
    // -------------------------------------------------------------------------
    console.log('\n🏗️ Passo 4: Cadastrando dados demonstrativos para validação imediata...');
    
    // Cliente
    let clientId = null;
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('document', '98765432000188')
      .maybeSingle();

    if (!existingClient) {
      const { data: newClient } = await supabase
        .from('clients')
        .insert({
          tenant_id: tenantId,
          person_type: 'PJ',
          document: '98765432000188',
          name: 'Condomínio Residencial Parque das Águas',
          trade_name: 'Residencial Parque das Águas',
          email: 'sindico@parquedasaguas.com.br',
          phone: '11977776666',
          address_city: 'São Paulo',
          address_state: 'SP',
          is_active: true,
        })
        .select('id')
        .single();
      clientId = newClient?.id;
      console.log('   ✓ Cliente demonstrativo cadastrado: Condomínio Residencial Parque das Águas');
    } else {
      clientId = existingClient.id;
    }

    // Obra
    if (clientId) {
      const { data: existingProject } = await supabase
        .from('projects')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('code', 'OBR-2026-001')
        .maybeSingle();

      if (!existingProject) {
        await supabase.from('projects').insert({
          tenant_id: tenantId,
          client_id: clientId,
          code: 'OBR-2026-001',
          name: 'Reforma Estrutural & Impermeabilização - Bloco A',
          description: 'Recuperação de fachadas, impermeabilização de calhas e medição quinzenal.',
          cno: '12.345.67890/12',
          contract_value: 450000.0,
          technical_retention_perc: 5.0,
          status: 'em_andamento',
          start_date: '2026-10-01',
          expected_end_date: '2027-04-30',
        });
        console.log('   ✓ Obra demonstrativa cadastrada: Reforma Estrutural & Impermeabilização');
      }
    }

    // -------------------------------------------------------------------------
    // 5. Cadastrar Fornecedor, Produto e Serviço demonstrativos
    // -------------------------------------------------------------------------
    console.log('\n📦 Passo 5: Cadastrando Fornecedor, Produto e Serviço demonstrativos...');

    // Fornecedor
    const { data: existingSupplier } = await supabase
      .from('suppliers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('document', '11222333000199')
      .maybeSingle();

    if (!existingSupplier) {
      await supabase.from('suppliers').insert({
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
      });
      console.log('   ✓ Fornecedor demonstrativo cadastrado: Distribuidora de Cimento Central Ltda');
    } else {
      console.log('   ✓ Fornecedor demonstrativo já presente.');
    }

    // Produto
    const { data: existingProduct } = await supabase
      .from('products')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('code', 'MAT-CIM-001')
      .maybeSingle();

    if (!existingProduct) {
      await supabase.from('products').insert({
        tenant_id: tenantId,
        code: 'MAT-CIM-001',
        name: 'Cimento CP-II 50kg Votoran',
        description: 'Cimento Portland composto com escória granulada de alto-forno',
        ncm: '25232910',
        unit_of_measure: 'SC',
        base_cost: 38.50,
        sale_price: 45.00,
        category: 'aglomerantes',
        is_active: true,
      });
      console.log('   ✓ Produto demonstrativo cadastrado: Cimento CP-II 50kg Votoran (NCM 25232910)');
    } else {
      console.log('   ✓ Produto demonstrativo já presente.');
    }

    // Serviço
    const { data: existingService } = await supabase
      .from('services')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('code', 'SRV-ALV-001')
      .maybeSingle();

    if (!existingService) {
      await supabase.from('services').insert({
        tenant_id: tenantId,
        code: 'SRV-ALV-001',
        name: 'Alvenaria Estrutural Bloco de Concreto',
        description: 'Execução de alvenaria estrutural armada com blocos vazados de concreto 14x19x39 cm',
        nbs_code: '1.0101.10.00',
        lc116_code: '07.02',
        base_cost: 42.00,
        default_price: 65.00,
        unit_of_measure: 'M2',
        iss_aliquota: 5.0,
        inss_retencao_aliquota: 11.0,
        is_active: true,
      });
      console.log('   ✓ Serviço demonstrativo cadastrado: Alvenaria Estrutural (NBS 1.0101.10.00 / LC 116 07.02)');
    } else {
      console.log('   ✓ Serviço demonstrativo já presente.');
    }

    console.log('\n====================================================');
    console.log('🎉 SEED EXECUTADO COM SUCESSO TOTAL!');
    console.log('====================================================');
    console.log('🏢 Empresa:       Empresa Teste');
    console.log(`🆔 Tenant ID:     ${tenantId}`);
    console.log('📧 E-mail:        admin@teste.com');
    console.log('🔒 Senha:         Gadap2026!');
    console.log('🌐 Rota de Login: http://localhost:3000/login');
    console.log('📊 Painel Obras:  http://localhost:3000/dashboard/obras');
    console.log('👥 Clientes:      http://localhost:3000/dashboard/clientes');
    console.log('====================================================\n');

  } catch (error) {
    console.error('\n❌ ERRO DURANTE EXECUÇÃO DO SEED:');
    console.error(error);
    process.exit(1);
  }
}

runSeed();
