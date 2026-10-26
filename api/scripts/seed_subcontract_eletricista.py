import sys
import re
from decimal import Decimal
import httpx
from app.core.config import settings

def main():
    service_key = settings.SUPABASE_SERVICE_ROLE_KEY or ""
    supabase_url = settings.SUPABASE_URL.rstrip('/')
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    with httpx.Client(timeout=25.0) as client:
        # 1. Buscar Obra gerada
        p_res = client.get(
            f"{supabase_url}/rest/v1/projects?select=id,name,code,tenant_id&code=like.OBR-ORC-SIMP*&order=created_at.desc&limit=1",
            headers=headers
        )
        p_res.raise_for_status()
        projects = p_res.json()
        if not projects:
            print("Nenhuma obra OBR-ORC-SIMP encontrada!")
            return
        proj = projects[0]
        print(f"Obra selecionada: {proj['name']} ({proj['code']}) [ID: {proj['id']}]")
        tenant_id = proj['tenant_id']

        # 2. Buscar Fornecedor Leopoldo
        s_res = client.get(
            f"{supabase_url}/rest/v1/suppliers?tenant_id=eq.{tenant_id}&name=like.*Leopoldo*&select=id,name,phone,is_subcontractor",
            headers=headers
        )
        s_res.raise_for_status()
        suppliers = s_res.json()
        if not suppliers:
            print("Fornecedor Leopoldo não encontrado!")
            return
        supp = suppliers[0]
        print(f"Fornecedor: {supp['name']} | Telefone: {supp.get('phone')} | Subcontratado: {supp.get('is_subcontractor')}")

        # 3. Buscar Especialidade Eletricista
        sp_res = client.get(
            f"{supabase_url}/rest/v1/specialties?tenant_id=eq.{tenant_id}&name=eq.Eletricista",
            headers=headers
        )
        sp_res.raise_for_status()
        specialties = sp_res.json()
        spec_id = specialties[0]['id'] if specialties else None
        print(f"Especialidade Eletricista ID: {spec_id}")

        # 4. Verificar se já existe subcontrato
        sub_res = client.get(
            f"{supabase_url}/rest/v1/subcontracts?project_id=eq.{proj['id']}&supplier_id=eq.{supp['id']}&select=id,contract_number,total_value,status",
            headers=headers
        )
        sub_res.raise_for_status()
        subcontracts = sub_res.json()

        if subcontracts:
            sub = subcontracts[0]
            subcontract_id = sub['id']
            print(f"Subcontrato existente encontrado: {sub['contract_number']} [ID: {subcontract_id}] - Valor: R$ {sub['total_value']}")
        else:
            # Criar Subcontrato
            new_sub_data = {
                "tenant_id": tenant_id,
                "project_id": proj['id'],
                "supplier_id": supp['id'],
                "contract_number": "SUB-ELET-001",
                "scope_description": "Instalações elétricas gerais, cabeamento e quadros de distribuição",
                "total_value": 15000.00,
                "technical_retention_percentage": 0.05,
                "status": "active"
            }
            create_res = client.post(
                f"{supabase_url}/rest/v1/subcontracts",
                json=new_sub_data,
                headers=headers
            )
            create_res.raise_for_status()
            sub = create_res.json()[0]
            subcontract_id = sub['id']
            print(f"[OK] Subcontrato Criado: {sub['contract_number']} [ID: {subcontract_id}] - R$ {sub['total_value']}")

            if spec_id:
                client.post(
                    f"{supabase_url}/rest/v1/subcontract_specialties",
                    json={"subcontract_id": subcontract_id, "specialty_id": spec_id},
                    headers=headers
                )
                print(f"[OK] Especialidade Eletricista vinculada ao subcontrato.")

        # 5. Verificar transações existentes
        tr_res = client.get(
            f"{supabase_url}/rest/v1/subcontract_transactions?subcontract_id=eq.{subcontract_id}&select=id,type,amount,date,observation",
            headers=headers
        )
        tr_res.raise_for_status()
        transactions = tr_res.json()
        print(f"Transações existentes no subcontrato: {len(transactions)}")
        for t in transactions:
            print(f"  -> {t['type']} | R$ {t['amount']} | {t['date']} | {t.get('observation')}")

if __name__ == '__main__':
    main()
