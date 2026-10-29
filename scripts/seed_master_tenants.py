#!/usr/bin/env python3
"""
GADAP Hub ERP - Seed de Master Tenants & Provisionamento PLG
Prompt 80: Checkout SaaS e Seed de Master Tenants

Provisiona as 3 empresas fundadoras com regras exclusivas de Master Tenant:
- 100% OFF (isenção total) em todos os módulos por 6 meses iniciais
- max_renewals = 3 (permitindo até 3 prorrogações de 100% OFF)
- Contato técnico principal vinculado a danielsmlopes@hotmail.com no metadata_json
- Criação/sincronização do usuário Auth no Supabase e vínculo com public.users (admin + superadmin)
"""

import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, Any, List

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Adicionar pasta raiz ao sys.path para import de dependências se necessário
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

# Carregar variáveis do .env.local
env_file = root_dir / ".env.local"
if not env_file.exists():
    env_file = root_dir / ".env"

if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip().strip("'\"")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL") or "https://dkjcgrwztyhcsyxlajia.supabase.co"
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SERVICE_ROLE_KEY or "your_" in SERVICE_ROLE_KEY:
    print("❌ ERRO: SUPABASE_SERVICE_ROLE_KEY não configurada no .env.local")
    sys.exit(1)

try:
    from supabase import create_client, Client
except ImportError:
    print("❌ ERRO: Biblioteca 'supabase' não instalada. Execute: pip install supabase")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

MASTER_TENANTS: List[Dict[str, Any]] = [
    {
        "cnpj": "11495860000160",
        "cnpj_raw": "11.495.860/0001-60",
        "trade_name": "Intermack Construtora & Engenharia",
        "legal_name": "INTERMACK CONSTRUTORA E ENGENHARIA LTDA",
        "email": "daniel@intermack.com.br",
        "password": "Gabriel2006",
        "full_name": "Daniel Souto Lopes (Intermack)",
    },
    {
        "cnpj": "68422749000160",
        "cnpj_raw": "68.422.749/0001-60",
        "trade_name": "Pools Piscinas & Lazer",
        "legal_name": "POOLS ENGENHARIA E CONSTRUCOES DE PISCINAS LTDA",
        "email": "daniel@pools.com.br",
        "password": "Gabriel2006",
        "full_name": "Daniel Souto Lopes (Pools)",
    },
    {
        "cnpj": "63011697000116",
        "cnpj_raw": "63.011.697/0001-16",
        "trade_name": "Daniel Souto Lopes Engenharia",
        "legal_name": "DANIEL SOUTO LOPES ENGENHARIA CIVIL E CONSTRUCAO",
        "email": "daniel@daniel.com.br",
        "password": "Gabriel2006",
        "full_name": "Daniel Souto Lopes (Master Admin)",
    },
]

SUPER_ADMIN_TECHNICAL_EMAIL = "danielsmlopes@hotmail.com"


def seed_master_tenants():
    print("==================================================================")
    print("🚀 GADAP Hub - Seed Automatizado de Master Tenants (Prompt 80)")
    print("==================================================================")
    print(f"Supabase Endpoint: {SUPABASE_URL}")
    print(f"Contato Técnico Central Super-Admin: {SUPER_ADMIN_TECHNICAL_EMAIL}\n")

    now = datetime.now(timezone.utc)
    six_months_ahead = (now + timedelta(days=182)).isoformat()

    for idx, tenant in enumerate(MASTER_TENANTS, start=1):
        print(f"[{idx}/3] Provisionando Master Tenant: {tenant['trade_name']} ({tenant['cnpj_raw']})...")

        metadata_json = {
            "tier": "master_tenant",
            "is_founder": True,
            "billing_discount_rate": 1.0,  # 100% OFF em todos os módulos
            "all_modules_unlocked": True,
            "technical_contact_email": SUPER_ADMIN_TECHNICAL_EMAIL,
            "super_admin_contact": {
                "name": "Daniel Souto Lopes",
                "email": SUPER_ADMIN_TECHNICAL_EMAIL,
                "role": "Master Technical Owner",
            },
            "founder_conditions": {
                "exempt_all_modules": True,
                "initial_period_months": 6,
                "allowed_renewals": 3,
                "created_at": now.isoformat(),
            },
        }

        # 1. Verificar se a empresa já existe pelo CNPJ
        resp_company = supabase.table("companies").select("id, trade_name").eq("cnpj", tenant["cnpj"]).execute()
        company_id = None

        company_payload = {
            "legal_name": tenant["legal_name"],
            "trade_name": tenant["trade_name"],
            "cnpj": tenant["cnpj"],
            "tax_regime": "simples_nacional",
            "email": tenant["email"],
            "phone": "(11) 99999-8888",
            "is_active": True,
            "plan_status": "ACTIVE",
            "gateway_customer_id": f"cus_master_{tenant['cnpj'][:8]}",
            "trial_ends_at": six_months_ahead,
            "discount_expires_at": six_months_ahead,
            "renewal_count": 0,
            "max_renewals": 3,  # Regra de Master Tenant: prorrogação até 3 vezes
            "metadata_json": metadata_json,
        }

        if resp_company.data and len(resp_company.data) > 0:
            company_id = resp_company.data[0]["id"]
            print(f"    ✓ Empresa encontrada ({company_id}). Atualizando dados e plano...")
            update_res = supabase.table("companies").update(company_payload).eq("id", company_id).execute()
        else:
            print("    ✓ Inserindo nova empresa na tabela public.companies...")
            insert_res = supabase.table("companies").insert(company_payload).execute()
            if not insert_res.data:
                print(f"    ❌ Falha ao inserir empresa: {tenant['trade_name']}")
                continue
            company_id = insert_res.data[0]["id"]
            print(f"    ✓ Empresa inserida com sucesso! ID: {company_id}")

        # 2. Provisionar Usuário no Supabase Auth
        user_email = tenant["email"]
        user_password = tenant["password"]
        auth_user_id = None

        print(f"    🔑 Sincronizando usuário Auth ({user_email})...")
        auth_users = supabase.auth.admin.list_users()
        existing_user = next((u for u in auth_users if u.email == user_email), None)

        user_metadata = {
            "tenant_id": company_id,
            "full_name": tenant["full_name"],
            "role": "admin",
            "is_superadmin": True,
            "technical_contact": SUPER_ADMIN_TECHNICAL_EMAIL,
        }
        app_metadata = {
            "tenant_id": company_id,
            "role": "superadmin",
            "is_superadmin": True,
            "tier": "master_tenant",
        }

        if existing_user:
            auth_user_id = existing_user.id
            print(f"    ✓ Usuário Auth existente ({auth_user_id}). Atualizando senha e claims...")
            supabase.auth.admin.update_user_by_id(
                auth_user_id,
                {
                    "password": user_password,
                    "email_confirm": True,
                    "app_metadata": app_metadata,
                    "user_metadata": user_metadata,
                },
            )
        else:
            print(f"    ✓ Criando novo usuário no Supabase Auth...")
            create_resp = supabase.auth.admin.create_user(
                {
                    "email": user_email,
                    "password": user_password,
                    "email_confirm": True,
                    "app_metadata": app_metadata,
                    "user_metadata": user_metadata,
                }
            )
            auth_user_id = create_resp.user.id
            print(f"    ✓ Usuário Auth criado! ID: {auth_user_id}")

        # 3. Vincular na tabela pública public.users
        print(f"    👤 Sincronizando tabela public.users...")
        public_user_resp = supabase.table("users").select("id").eq("auth_user_id", auth_user_id).execute()

        public_user_data = {
            "tenant_id": company_id,
            "auth_user_id": auth_user_id,
            "full_name": tenant["full_name"],
            "email": user_email,
            "role": "admin",
            "is_active": True,
            "is_superadmin": True,
        }

        if public_user_resp.data and len(public_user_resp.data) > 0:
            supabase.table("users").update(public_user_data).eq("auth_user_id", auth_user_id).execute()
            print("    ✓ Perfil público em public.users atualizado.")
        else:
            supabase.table("users").insert(public_user_data).execute()
            print("    ✓ Perfil público em public.users criado.")

        print(f"    🎉 Master Tenant [{tenant['trade_name']}] 100% PROVISIONADO!\n")

    print("==================================================================")
    print("✅ SEED DE MASTER TENANTS CONCLUÍDO COM SUCESSO!")
    print("==================================================================")


if __name__ == "__main__":
    seed_master_tenants()
