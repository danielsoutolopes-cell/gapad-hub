"""
GADAP Hub - Script de Seed do Banco de Dados & Supabase Auth
Inicializa a 'Empresa Teste' (tenant_id) e o usuário 'admin@teste.com' com app_metadata.tenant_id.
"""

import os
import sys
import json
from pathlib import Path
import httpx

# Tenta carregar variáveis do .env.local na raiz do monorepo
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

def run_seed():
    print("=" * 60)
    print("🚀 GADAP Hub (Python) - Inicialização do Seed de Ambiente")
    print("=" * 60)

    with httpx.Client(base_url=SUPABASE_URL, headers=HEADERS, timeout=30.0) as client:
        # -------------------------------------------------------------
        # 1. Obter ou Criar a Empresa Teste (public.companies)
        # -------------------------------------------------------------
        print("\n📦 Passo 1: Configurando Empresa Teste (Tenant raiz)...")
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

        # -------------------------------------------------------------
        # 2. Criar ou Atualizar Usuário no Supabase Auth (auth.admin)
        # -------------------------------------------------------------
        print("\n🔑 Passo 2: Configurando Usuário Admin no Supabase Auth...")
        user_email = "admin@teste.com"
        user_password = "Gadap2026!"

        # Lista usuários existentes via Auth Admin API
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
            print(f"   ✓ Criando novo usuário {user_email} com app_metadata.tenant_id...")
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

        # -------------------------------------------------------------
        # 3. Inserir ou Atualizar em public.users
        # -------------------------------------------------------------
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

        # -------------------------------------------------------------
        # 4. Dados Demonstrativos (Cliente e Obra)
        # -------------------------------------------------------------
        print("\n🏗️ Passo 4: Verificando dados demonstrativos...")
        resp = client.get(f"/rest/v1/clients?tenant_id=eq.{tenant_id}&document=eq.98765432000188&select=id")
        resp.raise_for_status()
        clients = resp.json()

        if not clients:
            client_payload = {
                "tenant_id": tenant_id,
                "person_type": "PJ",
                "document": "98765432000188",
                "name": "Condomínio Residencial Parque das Águas",
                "trade_name": "Residencial Parque das Águas",
                "email": "sindico@parquedasaguas.com.br",
                "phone": "11977776666",
                "address_city": "São Paulo",
                "address_state": "SP",
                "is_active": True,
            }
            resp = client.post("/rest/v1/clients", json=client_payload)
            resp.raise_for_status()
            client_id = resp.json()[0]["id"]
            print("   ✓ Cliente demonstrativo cadastrado.")
        else:
            client_id = clients[0]["id"]
            print("   ✓ Cliente demonstrativo já presente.")

        resp = client.get(f"/rest/v1/projects?tenant_id=eq.{tenant_id}&code=eq.OBR-2026-001&select=id")
        resp.raise_for_status()
        projects = resp.json()

        if not projects and client_id:
            project_payload = {
                "tenant_id": tenant_id,
                "client_id": client_id,
                "code": "OBR-2026-001",
                "name": "Reforma Estrutural & Impermeabilização - Bloco A",
                "description": "Recuperação de fachadas, impermeabilização de calhas e medição quinzenal.",
                "cno": "12.345.67890/12",
                "contract_value": 450000.0,
                "technical_retention_perc": 5.0,
                "status": "em_andamento",
                "start_date": "2026-10-01",
                "expected_end_date": "2027-04-30",
            }
            client.post("/rest/v1/projects", json=project_payload).raise_for_status()
            print("   ✓ Obra demonstrativa cadastrada.")
        else:
            print("   ✓ Obra demonstrativa já presente.")

    print("\n" + "=" * 60)
    print("🎉 SEED EXECUTADO COM SUCESSO TOTAL!")
    print("=" * 60)
    print("🏢 Empresa:       Empresa Teste")
    print(f"🆔 Tenant ID:     {tenant_id}")
    print("📧 E-mail:        admin@teste.com")
    print("🔒 Senha:         Gadap2026!")
    print("🌐 Rota de Login: http://localhost:3000/login")
    print("📊 Painel Obras:  http://localhost:3000/dashboard/obras")
    print("👥 Clientes:      http://localhost:3000/dashboard/clientes")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    run_seed()
