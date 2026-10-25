"""
GADAP Hub - Script de Seed do Banco de Dados & Supabase Auth (Python)
Módulo: Povoamento de Dados e Backoffice
Idempotente: Limpa dados sintéticos prévios da Empresa Teste antes de repovoar.

Dados sintéticos gerados para a Empresa Teste (tenant_id):
1. Empresa Teste (Tenant raiz) e usuário admin (admin@teste.com / Gadap2026!) com app_metadata.tenant_id
2. 3 Clientes (2 PJ e 1 PF)
3. 2 Obras (Projects): "Reforma Residencial Alpha" e "Instalação Piscina Beta"
4. 3 Fornecedores de materiais, estruturas e locações
5. 5 Medições distribuídas entre as obras, com retenção técnica de 5%
6. 10 Lançamentos Financeiros (5 Contas a Receber vinculadas às medições e 5 Contas a Pagar)
7. Produtos e Serviços de demonstração para os catálogos comerciais
"""

import os
import sys
import json
from pathlib import Path
from decimal import Decimal, ROUND_HALF_EVEN
import httpx

# -----------------------------------------------------------------------------
# 1. Carregamento Seguro de Variáveis de Ambiente
# -----------------------------------------------------------------------------
root_dir = Path(__file__).resolve().parent.parent.parent
env_local_path = root_dir / ".env.local"

if env_local_path.exists():
    with open(env_local_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                key, *vals = line.split("=")
                val = "=".join(vals).strip("\"'")
                if key and key not in os.environ:
                    os.environ[key] = val

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "https://dkjcgrwztyhcsyxlajia.supabase.co").rstrip("/")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SERVICE_ROLE_KEY or "your_" in SERVICE_ROLE_KEY:
    print("ERRO: SUPABASE_SERVICE_ROLE_KEY não configurada no .env.local.")
    print("Defina SUPABASE_SERVICE_ROLE_KEY='sb_secret_...' no arquivo .env.local")
    sys.exit(1)

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

def round_currency(val: float | Decimal) -> float:
    """Arredondamento determinístico Round Half-to-Even (Bancário)."""
    d = Decimal(str(val))
    return float(d.quantize(Decimal("0.0001"), rounding=ROUND_HALF_EVEN))


def run_seed():
    print("=" * 65)
    print("🚀 GADAP Hub (Python) - Povoamento de Dados e Backoffice")
    print("=" * 65)

    with httpx.Client(base_url=SUPABASE_URL, headers=HEADERS, timeout=30.0) as client:
        # ---------------------------------------------------------------------
        # 1. Obter ou Criar a Empresa Teste (public.companies)
        # ---------------------------------------------------------------------
        print("\n🏢 Passo 1: Configurando Empresa Teste (Tenant raiz)...")
        cnpj = "12345678000199"

        resp = client.get(f"/rest/v1/companies?cnpj=eq.{cnpj}&select=id,trade_name")
        resp.raise_for_status()
        companies = resp.json()

        if companies:
            tenant_id = companies[0]["id"]
            trade_name = companies[0]["trade_name"]
            print(f"   ✓ Empresa existente encontrada: '{trade_name}'")
            print(f"   ✓ Tenant ID: {tenant_id}")
        else:
            payload = {
                "legal_name": "Empresa Teste Engenharia e Obras Ltda",
                "trade_name": "Empresa Teste",
                "cnpj": cnpj,
                "state_registration": "123456789",
                "municipal_registration": "987654",
                "tax_regime": "simples_nacional",
                "email": "admin@teste.com",
                "phone": "11987654321",
                "address_city": "São Paulo",
                "address_state": "SP",
                "is_active": True,
            }
            resp = client.post("/rest/v1/companies", json=payload)
            resp.raise_for_status()
            created = resp.json()
            tenant_id = created[0]["id"]
            print("   ✓ Empresa Teste cadastrada com sucesso!")
            print(f"   ✓ Tenant ID: {tenant_id}")

        # ---------------------------------------------------------------------
        # 2. Configurar Usuário Admin no Supabase Auth
        # ---------------------------------------------------------------------
        print("\n🔑 Passo 2: Configurando Usuário Admin no Supabase Auth...")
        user_email = "admin@teste.com"
        user_password = "Gadap2026!"

        resp = client.get("/auth/v1/admin/users")
        resp.raise_for_status()
        auth_data = resp.json()
        users_list = auth_data.get("users", [])

        existing_user = next((u for u in users_list if u.get("email") == user_email), None)

        if existing_user:
            auth_user_id = existing_user["id"]
            print(f"   ✓ Usuário {user_email} já existe no Auth ({auth_user_id}). Atualizando app_metadata...")

            update_payload = {
                "password": user_password,
                "app_metadata": {
                    "tenant_id": tenant_id,
                    "role": "admin",
                },
                "user_metadata": {
                    "tenant_id": tenant_id,
                    "role": "admin",
                    "full_name": "Administrador Teste",
                },
                "email_confirm": True,
            }
            resp = client.put(f"/auth/v1/admin/users/{auth_user_id}", json=update_payload)
            resp.raise_for_status()
            print("   ✓ Senha e app_metadata.tenant_id atualizados com sucesso no Auth!")
        else:
            print(f"   ✓ Criando novo usuário {user_email}...")
            create_payload = {
                "email": user_email,
                "password": user_password,
                "email_confirm": True,
                "app_metadata": {
                    "tenant_id": tenant_id,
                    "role": "admin",
                },
                "user_metadata": {
                    "tenant_id": tenant_id,
                    "role": "admin",
                    "full_name": "Administrador Teste",
                },
            }
            resp = client.post("/auth/v1/admin/users", json=create_payload)
            resp.raise_for_status()
            new_user = resp.json()
            auth_user_id = new_user.get("id") or new_user.get("user", {}).get("id")
            print(f"   ✓ Usuário Auth criado com sucesso! ID: {auth_user_id}")

        # ---------------------------------------------------------------------
        # 3. Vincular em public.users
        # ---------------------------------------------------------------------
        print("\n👤 Passo 3: Vinculando usuário na tabela pública public.users...")
        resp = client.get(f"/rest/v1/users?auth_user_id=eq.{auth_user_id}&select=id")
        resp.raise_for_status()
        public_users = resp.json()

        if public_users:
            public_id = public_users[0]["id"]
            client.patch(
                f"/rest/v1/users?id=eq.{public_id}",
                json={
                    "tenant_id": tenant_id,
                    "full_name": "Administrador Teste",
                    "role": "admin",
                    "is_active": True,
                },
            ).raise_for_status()
            print("   ✓ Registro em public.users atualizado com tenant_id.")
        else:
            client.post(
                "/rest/v1/users",
                json={
                    "tenant_id": tenant_id,
                    "auth_user_id": auth_user_id,
                    "full_name": "Administrador Teste",
                    "email": user_email,
                    "phone": "11987654321",
                    "role": "admin",
                    "is_active": True,
                },
            ).raise_for_status()
            print("   ✓ Usuário inserido na tabela public.users.")

        # ---------------------------------------------------------------------
        # 4. Limpeza Idempotente: Remover dados anteriores da Empresa Teste
        # ---------------------------------------------------------------------
        print("\n🧹 Passo 4: Limpeza idempotente dos registros anteriores da Empresa Teste...")

        # Deleta lançamentos financeiros
        client.delete(f"/rest/v1/financial_entries?tenant_id=eq.{tenant_id}").raise_for_status()
        print("   ✓ Lançamentos financeiros anteriores removidos.")

        # Deleta medições de engenharia
        client.delete(f"/rest/v1/medicoes?tenant_id=eq.{tenant_id}").raise_for_status()
        print("   ✓ Medições anteriores removidas.")

        # Deleta orçamentos e itens
        resp = client.get(f"/rest/v1/quotes?tenant_id=eq.{tenant_id}&select=id")
        resp.raise_for_status()
        old_quotes = resp.json()
        if old_quotes:
            quote_ids = [q["id"] for q in old_quotes]
            for qid in quote_ids:
                client.delete(f"/rest/v1/quote_items?quote_id=eq.{qid}").raise_for_status()
            client.delete(f"/rest/v1/quotes?tenant_id=eq.{tenant_id}").raise_for_status()
            print("   ✓ Orçamentos anteriores removidos.")

        # Deleta obras
        client.delete(f"/rest/v1/projects?tenant_id=eq.{tenant_id}").raise_for_status()
        print("   ✓ Obras anteriores removidas.")

        # Deleta clientes
        client.delete(f"/rest/v1/clients?tenant_id=eq.{tenant_id}").raise_for_status()
        print("   ✓ Clientes anteriores removidos.")

        # Deleta fornecedores, produtos e serviços
        client.delete(f"/rest/v1/suppliers?tenant_id=eq.{tenant_id}").raise_for_status()
        client.delete(f"/rest/v1/products?tenant_id=eq.{tenant_id}").raise_for_status()
        client.delete(f"/rest/v1/services?tenant_id=eq.{tenant_id}").raise_for_status()
        print("   ✓ Fornecedores, produtos e serviços anteriores removidos.")

        # ---------------------------------------------------------------------
        # 5. Cadastrar 3 Clientes Sintéticos (2 PJ e 1 PF)
        # ---------------------------------------------------------------------
        print("\n👥 Passo 5: Cadastrando 3 Clientes sintéticos realistas (2 PJ e 1 PF)...")
        clients_payload = [
            {
                "tenant_id": tenant_id,
                "person_type": "PJ",
                "document": "33445566000177",
                "name": "Construtora & Incorporadora Horizonte Sul S.A.",
                "trade_name": "Horizonte Sul Empreendimentos",
                "email": "financeiro@horizontesul.com.br",
                "phone": "1132549900",
                "address_street": "Av. Paulista",
                "address_number": "1800",
                "address_neighborhood": "Bela Vista",
                "address_city": "São Paulo",
                "address_state": "SP",
                "address_zip_code": "01310200",
                "is_active": True,
            },
            {
                "tenant_id": tenant_id,
                "person_type": "PJ",
                "document": "88990011000122",
                "name": "Condomínio Residencial Villa Bella",
                "trade_name": "Residencial Villa Bella",
                "email": "administracao@villabella.com.br",
                "phone": "11984521122",
                "address_street": "Rua das Figueiras",
                "address_number": "450",
                "address_neighborhood": "Jardim Europa",
                "address_city": "São Paulo",
                "address_state": "SP",
                "address_zip_code": "01449000",
                "is_active": True,
            },
            {
                "tenant_id": tenant_id,
                "person_type": "PF",
                "document": "21568974512",
                "name": "Carlos Eduardo Mendonça",
                "trade_name": "Dr. Carlos Eduardo",
                "email": "carlos.mendonca@medicina.com.br",
                "phone": "11991234567",
                "address_street": "Alameda dos Anapurus",
                "address_number": "820",
                "address_neighborhood": "Moema",
                "address_city": "São Paulo",
                "address_state": "SP",
                "address_zip_code": "04087002",
                "is_active": True,
            },
        ]
        resp = client.post("/rest/v1/clients", json=clients_payload)
        resp.raise_for_status()
        created_clients = resp.json()

        client_alpha = next(c for c in created_clients if c["document"] == "33445566000177")
        client_villa = next(c for c in created_clients if c["document"] == "88990011000122")
        client_carlos = next(c for c in created_clients if c["document"] == "21568974512")

        print(f"   ✓ [PJ] {client_alpha['name']} (ID: {client_alpha['id']})")
        print(f"   ✓ [PJ] {client_villa['name']} (ID: {client_villa['id']})")
        print(f"   ✓ [PF] {client_carlos['name']} (ID: {client_carlos['id']})")

        # ---------------------------------------------------------------------
        # 6. Cadastrar 2 Obras (Projects)
        # ---------------------------------------------------------------------
        print("\n🏗️ Passo 6: Cadastrando 2 Obras emblemáticas...")
        projects_payload = [
            {
                "tenant_id": tenant_id,
                "client_id": client_alpha["id"],
                "code": "OBR-ALPHA-01",
                "name": "Reforma Residencial Alpha",
                "description": "Reforma completa de cobertura duplex: reforço estrutural, impermeabilização e acabamento de alto padrão.",
                "contract_value": 350000.0,
                "technical_retention_perc": 5.0,
                "status": "em_andamento",
                "start_date": "2026-08-01",
                "end_date_planned": "2027-02-28",
                "address_city_ibge": "3550308",
                "address_state": "SP",
            },
            {
                "tenant_id": tenant_id,
                "client_id": client_carlos["id"],
                "code": "OBR-PISC-02",
                "name": "Instalação Piscina Beta",
                "description": "Construção e instalação de piscina em concreto armado com deck térmico, iluminação LED e casa de máquinas.",
                "contract_value": 180000.0,
                "technical_retention_perc": 5.0,
                "status": "em_andamento",
                "start_date": "2026-09-15",
                "end_date_planned": "2026-12-20",
                "address_city_ibge": "3550308",
                "address_state": "SP",
            },
        ]
        resp = client.post("/rest/v1/projects", json=projects_payload)
        resp.raise_for_status()
        created_projects = resp.json()

        project_alpha = next(p for p in created_projects if p["code"] == "OBR-ALPHA-01")
        project_piscina = next(p for p in created_projects if p["code"] == "OBR-PISC-02")

        print(f"   ✓ Obra 1: '{project_alpha['name']}' (Contrato: R$ 350.000,00)")
        print(f"   ✓ Obra 2: '{project_piscina['name']}' (Contrato: R$ 180.000,00)")

        # ---------------------------------------------------------------------
        # 7. Cadastrar 3 Fornecedores Homologados
        # ---------------------------------------------------------------------
        print("\n🚚 Passo 7: Cadastrando 3 Fornecedores de materiais e equipamentos...")
        suppliers_payload = [
            {
                "tenant_id": tenant_id,
                "person_type": "PJ",
                "document": "11222333000199",
                "name": "Distribuidora de Cimento Central Ltda",
                "trade_name": "Cimento Central",
                "category": "materiais_construcao",
                "email": "vendas@cimentocentral.com.br",
                "phone": "11988887777",
                "contact_name": "Marcos Vinicius",
                "address_city": "São Paulo",
                "address_state": "SP",
                "is_active": True,
            },
            {
                "tenant_id": tenant_id,
                "person_type": "PJ",
                "document": "44555666000188",
                "name": "Aços & Armaduras Paulistana Ltda",
                "trade_name": "Paulistana Aços",
                "category": "estruturas_metalicas",
                "email": "comercial@paulistanaacos.com.br",
                "phone": "1138882200",
                "contact_name": "Rodrigo Silva",
                "address_city": "São Paulo",
                "address_state": "SP",
                "is_active": True,
            },
            {
                "tenant_id": tenant_id,
                "person_type": "PJ",
                "document": "77888999000111",
                "name": "Locadora Morumbi Equipamentos e Caçambas Ltda",
                "trade_name": "Morumbi Locações",
                "category": "locacao_equipamentos",
                "email": "contato@morumbilocacoes.com.br",
                "phone": "1137774411",
                "contact_name": "Renata Castro",
                "address_city": "São Paulo",
                "address_state": "SP",
                "is_active": True,
            },
        ]
        resp = client.post("/rest/v1/suppliers", json=suppliers_payload)
        resp.raise_for_status()
        created_suppliers = resp.json()

        supplier_cimento = created_suppliers[0]
        supplier_aco = created_suppliers[1]
        supplier_locacao = created_suppliers[2]

        print(f"   ✓ Fornecedor 1: {supplier_cimento['name']}")
        print(f"   ✓ Fornecedor 2: {supplier_aco['name']}")
        print(f"   ✓ Fornecedor 3: {supplier_locacao['name']}")

        # ---------------------------------------------------------------------
        # 8. Cadastrar 5 Medições (com retenção técnica determinística de 5%)
        # ---------------------------------------------------------------------
        print("\n📐 Passo 8: Cadastrando 5 Medições Físico-Financeiras com retenção de 5%...")
        measurements_payload = [
            # Obra Alpha
            {
                "tenant_id": tenant_id,
                "project_id": project_alpha["id"],
                "numero_sequencial": 1,
                "periodo_inicio": "2026-08-01",
                "periodo_fim": "2026-08-31",
                "valor_medido": 80000.0,
                "retencao_tecnica": round_currency(Decimal("80000.0") * Decimal("0.05")),
                "valor_liquido": round_currency(Decimal("80000.0") * Decimal("0.95")),
                "status": "faturada",
                "observacoes": "1º Boletim Mensal: Demolições, retiradas de entulho e reforço estrutural em pilares.",
            },
            {
                "tenant_id": tenant_id,
                "project_id": project_alpha["id"],
                "numero_sequencial": 2,
                "periodo_inicio": "2026-09-01",
                "periodo_fim": "2026-09-30",
                "valor_medido": 110000.0,
                "retencao_tecnica": round_currency(Decimal("110000.0") * Decimal("0.05")),
                "valor_liquido": round_currency(Decimal("110000.0") * Decimal("0.95")),
                "status": "faturada",
                "observacoes": "2º Boletim Mensal: Alvenarias estruturais, tubulações hidrossanitárias e eletrodutos.",
            },
            {
                "tenant_id": tenant_id,
                "project_id": project_alpha["id"],
                "numero_sequencial": 3,
                "periodo_inicio": "2026-10-01",
                "periodo_fim": "2026-10-24",
                "valor_medido": 65000.0,
                "retencao_tecnica": round_currency(Decimal("65000.0") * Decimal("0.05")),
                "valor_liquido": round_currency(Decimal("65000.0") * Decimal("0.95")),
                "status": "aprovada",
                "observacoes": "3º Boletim Mensal: Impermeabilização com manta asfáltica e regularização de contrapisos.",
            },
            # Obra Piscina Beta
            {
                "tenant_id": tenant_id,
                "project_id": project_piscina["id"],
                "numero_sequencial": 1,
                "periodo_inicio": "2026-09-15",
                "periodo_fim": "2026-10-05",
                "valor_medido": 70000.0,
                "retencao_tecnica": round_currency(Decimal("70000.0") * Decimal("0.05")),
                "valor_liquido": round_currency(Decimal("70000.0") * Decimal("0.95")),
                "status": "faturada",
                "observacoes": "1º Boletim Físico: Escavação mecânica, compactação e armação de aço da piscina.",
            },
            {
                "tenant_id": tenant_id,
                "project_id": project_piscina["id"],
                "numero_sequencial": 2,
                "periodo_inicio": "2026-10-06",
                "periodo_fim": "2026-10-24",
                "valor_medido": 50000.0,
                "retencao_tecnica": round_currency(Decimal("50000.0") * Decimal("0.05")),
                "valor_liquido": round_currency(Decimal("50000.0") * Decimal("0.95")),
                "status": "aprovada",
                "observacoes": "2º Boletim Físico: Concretagem estrutural usinada, impermeabilização e tubulação de retorno.",
            },
        ]
        resp = client.post("/rest/v1/medicoes", json=measurements_payload)
        resp.raise_for_status()
        created_measurements = resp.json()

        med_alpha_1 = next(m for m in created_measurements if m["project_id"] == project_alpha["id"] and m["numero_sequencial"] == 1)
        med_alpha_2 = next(m for m in created_measurements if m["project_id"] == project_alpha["id"] and m["numero_sequencial"] == 2)
        med_alpha_3 = next(m for m in created_measurements if m["project_id"] == project_alpha["id"] and m["numero_sequencial"] == 3)
        med_pisc_1 = next(m for m in created_measurements if m["project_id"] == project_piscina["id"] and m["numero_sequencial"] == 1)
        med_pisc_2 = next(m for m in created_measurements if m["project_id"] == project_piscina["id"] and m["numero_sequencial"] == 2)

        print("   ✓ Medições da Obra Alpha (1, 2 e 3) e Piscina Beta (1 e 2) gravadas com sucesso.")

        # ---------------------------------------------------------------------
        # 9. Cadastrar 10 Lançamentos Financeiros (5 CR e 5 CP)
        # ---------------------------------------------------------------------
        print("\n💰 Passo 9: Cadastrando 10 Lançamentos Financeiros (5 Contas a Receber e 5 Contas a Pagar)...")
        financial_payload = [
            # 5 CONTAS A RECEBER
            {
                "tenant_id": tenant_id,
                "entry_type": "receivable",
                "description": "Faturamento Medição 01 - Reforma Residencial Alpha",
                "project_id": project_alpha["id"],
                "client_id": client_alpha["id"],
                "measurement_id": med_alpha_1["id"],
                "category": "medicao_obra",
                "nominal_amount": 80000.0,
                "technical_retention_amount": 4000.0,
                "net_amount": 76000.0,
                "status": "pago",
                "due_date": "2026-09-10",
                "payment_date": "2026-09-08",
                "document_number": "FAT-MED-001",
                "document_type": "boleto",
                "pix_code": "00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000520400005303986540876000.005802BR5913Empresa Teste6009Sao Paulo62070503***6304ABCD",
                "notes": "Liquidado pontualmente via conciliação bancária.",
            },
            {
                "tenant_id": tenant_id,
                "entry_type": "receivable",
                "description": "Faturamento Medição 02 - Reforma Residencial Alpha",
                "project_id": project_alpha["id"],
                "client_id": client_alpha["id"],
                "measurement_id": med_alpha_2["id"],
                "category": "medicao_obra",
                "nominal_amount": 110000.0,
                "technical_retention_amount": 5500.0,
                "net_amount": 104500.0,
                "status": "pago",
                "due_date": "2026-10-10",
                "payment_date": "2026-10-10",
                "document_number": "FAT-MED-002",
                "document_type": "pix",
                "pix_code": "00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-42661417400052040000530398654104500.005802BR5913Empresa Teste6009Sao Paulo62070503***6304BCDE",
                "notes": "Recebimento automático confirmado via Webhook Pix.",
            },
            {
                "tenant_id": tenant_id,
                "entry_type": "receivable",
                "description": "Faturamento Medição 03 - Reforma Residencial Alpha",
                "project_id": project_alpha["id"],
                "client_id": client_alpha["id"],
                "measurement_id": med_alpha_3["id"],
                "category": "medicao_obra",
                "nominal_amount": 65000.0,
                "technical_retention_amount": 3250.0,
                "net_amount": 61750.0,
                "status": "pendente",
                "due_date": "2026-11-10",
                "document_number": "FAT-MED-003",
                "document_type": "boleto",
                "notes": "Aguardando vencimento programado no fluxo de caixa.",
            },
            {
                "tenant_id": tenant_id,
                "entry_type": "receivable",
                "description": "Faturamento Medição 01 - Instalação Piscina Beta",
                "project_id": project_piscina["id"],
                "client_id": client_carlos["id"],
                "measurement_id": med_pisc_1["id"],
                "category": "medicao_obra",
                "nominal_amount": 70000.0,
                "technical_retention_amount": 3500.0,
                "net_amount": 66500.0,
                "status": "pago",
                "due_date": "2026-10-15",
                "payment_date": "2026-10-14",
                "document_number": "FAT-PISC-001",
                "document_type": "pix",
                "notes": "Liquidado via transferência Pix pelo cliente Dr. Carlos.",
            },
            {
                "tenant_id": tenant_id,
                "entry_type": "receivable",
                "description": "Faturamento Medição 02 - Instalação Piscina Beta",
                "project_id": project_piscina["id"],
                "client_id": client_carlos["id"],
                "measurement_id": med_pisc_2["id"],
                "category": "medicao_obra",
                "nominal_amount": 50000.0,
                "technical_retention_amount": 2500.0,
                "net_amount": 47500.0,
                "status": "pendente",
                "due_date": "2026-11-05",
                "document_number": "FAT-PISC-002",
                "document_type": "boleto",
                "notes": "Boletim aprovado em campo, boleto gerado para faturamento.",
            },

            # 5 CONTAS A PAGAR
            {
                "tenant_id": tenant_id,
                "entry_type": "payable",
                "description": "Aquisição de 400 sacos de Cimento CP-II 50kg (NF 18452)",
                "project_id": project_alpha["id"],
                "supplier_id": supplier_cimento["id"],
                "category": "material_construcao",
                "nominal_amount": 15400.0,
                "technical_retention_amount": 0.0,
                "net_amount": 15400.0,
                "status": "pago",
                "due_date": "2026-08-25",
                "payment_date": "2026-08-25",
                "document_number": "NF-18452",
                "document_type": "boleto",
                "notes": "Boleto bancário liquidado no banco emissor.",
            },
            {
                "tenant_id": tenant_id,
                "entry_type": "payable",
                "description": "Armaduras de aço CA-50 10mm e 8mm dobradas e cortadas",
                "project_id": project_piscina["id"],
                "supplier_id": supplier_aco["id"],
                "category": "material_construcao",
                "nominal_amount": 12850.0,
                "technical_retention_amount": 0.0,
                "net_amount": 12850.0,
                "status": "pago",
                "due_date": "2026-09-20",
                "payment_date": "2026-09-19",
                "document_number": "NF-22901",
                "document_type": "pix",
                "notes": "Liquidado com desconto antecipado via Pix.",
            },
            {
                "tenant_id": tenant_id,
                "entry_type": "payable",
                "description": "Fornecimento de 18m³ de concreto usinado bombeado FCK 30",
                "project_id": project_piscina["id"],
                "supplier_id": supplier_cimento["id"],
                "category": "material_construcao",
                "nominal_amount": 8640.0,
                "technical_retention_amount": 0.0,
                "net_amount": 8640.0,
                "status": "pago",
                "due_date": "2026-10-12",
                "payment_date": "2026-10-12",
                "document_number": "NF-23115",
                "document_type": "boleto",
                "notes": "Concretagem da estrutura da piscina realizada em 10/10.",
            },
            {
                "tenant_id": tenant_id,
                "entry_type": "payable",
                "description": "Manta Asfáltica Poliéster 4mm e primer impermeabilizante",
                "project_id": project_alpha["id"],
                "supplier_id": supplier_cimento["id"],
                "category": "material_construcao",
                "nominal_amount": 9420.0,
                "technical_retention_amount": 0.0,
                "net_amount": 9420.0,
                "status": "pendente",
                "due_date": "2026-11-02",
                "document_number": "NF-24089",
                "document_type": "boleto",
                "notes": "Material entregue no canteiro da cobertura duplex.",
            },
            {
                "tenant_id": tenant_id,
                "entry_type": "payable",
                "description": "Locação mensal de torre de andaimes fachadeiros e 6 caçambas",
                "project_id": project_alpha["id"],
                "supplier_id": supplier_locacao["id"],
                "category": "locacao_equipamentos",
                "nominal_amount": 4800.0,
                "technical_retention_amount": 0.0,
                "net_amount": 4800.0,
                "status": "pendente",
                "due_date": "2026-11-15",
                "document_number": "FAT-LOC-998",
                "document_type": "boleto",
                "notes": "Equipamentos em uso para finalização de fachadas.",
            },
        ]
        client.post("/rest/v1/financial_entries", json=financial_payload).raise_for_status()
        print("   ✓ 5 Contas a Receber (R$ 356.250,00 líquidos) e 5 Contas a Pagar (R$ 51.110,00) registradas.")

        # ---------------------------------------------------------------------
        # 10. Cadastrar Catálogo de Produtos e Serviços
        # ---------------------------------------------------------------------
        print("\n📦 Passo 10: Cadastrando Produtos e Serviços do catálogo...")
        products_payload = [
            {
                "tenant_id": tenant_id,
                "code": "MAT-CIM-001",
                "name": "Cimento CP-II 50kg Votoran",
                "description": "Cimento Portland composto com escória granulada de alto-forno",
                "ncm": "25232910",
                "unit_of_measure": "SC",
                "base_cost": 38.5,
                "sale_price": 45.0,
                "category": "aglomerantes",
                "is_active": True,
            },
            {
                "tenant_id": tenant_id,
                "code": "MAT-ACO-002",
                "name": "Barra de Aço CA-50 10mm (12m)",
                "description": "Vergalhão nervurado para armadura de estruturas de concreto armado",
                "ncm": "72142000",
                "unit_of_measure": "BR",
                "base_cost": 52.0,
                "sale_price": 64.0,
                "category": "estruturas_metalicas",
                "is_active": True,
            },
        ]
        client.post("/rest/v1/products", json=products_payload).raise_for_status()

        services_payload = [
            {
                "tenant_id": tenant_id,
                "code": "SRV-ALV-001",
                "name": "Alvenaria Estrutural Bloco de Concreto",
                "description": "Execução de alvenaria estrutural armada com blocos vazados de concreto 14x19x39 cm",
                "nbs_code": "1.0101.10.00",
                "lc116_code": "07.02",
                "base_cost": 42.0,
                "default_price": 65.0,
                "unit_of_measure": "M2",
                "iss_aliquota": 5.0,
                "inss_retencao_aliquota": 11.0,
                "is_active": True,
            },
            {
                "tenant_id": tenant_id,
                "code": "SRV-IMP-002",
                "name": "Impermeabilização com Manta Asfáltica 4mm",
                "description": "Aplicação de primer e manta asfáltica aderida com maçarico a gás",
                "nbs_code": "1.0101.20.00",
                "lc116_code": "07.05",
                "base_cost": 58.0,
                "default_price": 88.0,
                "unit_of_measure": "M2",
                "iss_aliquota": 5.0,
                "inss_retencao_aliquota": 11.0,
                "is_active": True,
            },
        ]
        client.post("/rest/v1/services", json=services_payload).raise_for_status()
        print("   ✓ Catálogo de insumos e serviços cadastrado com sucesso.")

    print("\n" + "=" * 65)
    print("🎉 SEED CONCLUÍDO COM SUCESSO TOTAL E IDEMPOTÊNCIA!")
    print("=" * 65)
    print("🏢 Empresa:               Empresa Teste")
    print(f"🆔 Tenant ID:             {tenant_id}")
    print("📧 E-mail Admin:          admin@teste.com")
    print("🔒 Senha Admin:           Gadap2026!")
    print("👥 Clientes Povoados:     3 (2 PJ e 1 PF)")
    print("🏗️ Obras Ativas:          2 ('Reforma Residencial Alpha' e 'Instalação Piscina Beta')")
    print("📐 Medições Registradas:  5 (todas com 5% de retenção técnica determinística)")
    print("💰 Lançamentos:           10 (5 Contas a Receber e 5 Contas a Pagar)")
    print("🌐 Rota de Login:         http://localhost:3000/login")
    print("📊 Painel Obras:          http://localhost:3000/dashboard/obras")
    print("👥 Clientes:              http://localhost:3000/dashboard/clientes")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    run_seed()
