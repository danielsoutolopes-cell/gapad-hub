import re
from uuid import UUID
from app.core.config import settings
import httpx

def run_homologation_seed():
    service_key = settings.SUPABASE_SERVICE_ROLE_KEY
    supabase_url = settings.SUPABASE_URL.rstrip('/')
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    # 1. Obter tenant_id da Empresa Teste
    with httpx.Client(timeout=15.0) as client:
        comp_resp = client.get(f"{supabase_url}/rest/v1/companies?trade_name=eq.Empresa Teste&select=id", headers=headers)
        comp_resp.raise_for_status()
        tenant_id = comp_resp.json()[0]["id"]
        print(f"[OK] Tenant ID ativo: {tenant_id}")

        # ----------------------------------------------------------------------
        # 1. Cliente PJ (Tomador): Condomínio Edifício Lorena
        # ----------------------------------------------------------------------
        client_doc = re.sub(r"\D", "", "12.345.678/0001-99")
        client_payload = {
            "tenant_id": tenant_id,
            "person_type": "PJ",
            "name": "Condomínio Edifício Lorena",
            "trade_name": "Edifício Lorena",
            "document": client_doc,
            "email": "contato@condominiolorena.teste.com.br",
            "phone": "11999991111",
            "address_street": "Alameda Lorena",
            "address_number": "1000",
            "address_neighborhood": "Jardins",
            "address_city": "São Paulo",
            "address_state": "SP",
            "address_zip_code": "01424-001",
            "is_active": True
        }
        
        # Limpa anterior se existir para idempotência
        client.delete(f"{supabase_url}/rest/v1/clients?tenant_id=eq.{tenant_id}&document=eq.{client_doc}", headers=headers)
        c_res = client.post(f"{supabase_url}/rest/v1/clients", headers=headers, json=client_payload)
        c_res.raise_for_status()
        client_data = c_res.json()[0]
        print(f"[OK] Cliente PJ cadastrado com sucesso: {client_data['name']} (ID: {client_data['id']})")

        # ----------------------------------------------------------------------
        # 2. Subcontratado (Fornecedor): Instalações Elétricas Leopoldo
        # ----------------------------------------------------------------------
        supplier_doc = re.sub(r"\D", "", "98.765.432/0001-11")
        supplier_payload = {
            "tenant_id": tenant_id,
            "person_type": "PJ",
            "name": "Instalações Elétricas Leopoldo",
            "trade_name": "Elétrica Leopoldo",
            "document": supplier_doc,
            "email": "leopoldo.eletrica@teste.com.br",
            "phone": "11988882222",
            "contact_name": "Leopoldo",
            "category": "subempreiteira",
            "is_subcontractor": True,
            "address_street": "Rua Leopoldo",
            "address_number": "200",
            "address_neighborhood": "Itaim Bibi",
            "address_city": "São Paulo",
            "address_state": "SP",
            "address_zip_code": "04530-000",
            "is_active": True
        }
        client.delete(f"{supabase_url}/rest/v1/suppliers?tenant_id=eq.{tenant_id}&document=eq.{supplier_doc}", headers=headers)
        s_res = client.post(f"{supabase_url}/rest/v1/suppliers", headers=headers, json=supplier_payload)
        s_res.raise_for_status()
        supplier_data = s_res.json()[0]
        supplier_id = supplier_data["id"]
        print(f"[OK] Fornecedor/Subempreiteiro cadastrado: {supplier_data['name']} (ID: {supplier_id})")

        # Especialidade Eletricista
        spec_res = client.get(f"{supabase_url}/rest/v1/specialties?tenant_id=eq.{tenant_id}&name=eq.Eletricista", headers=headers)
        if spec_res.json():
            spec_id = spec_res.json()[0]["id"]
        else:
            new_spec = client.post(f"{supabase_url}/rest/v1/specialties", headers=headers, json={
                "tenant_id": tenant_id,
                "name": "Eletricista",
                "description": "Instalações e manutenção elétrica predial e de canteiro"
            }).json()[0]
            spec_id = new_spec["id"]
        
        # Vincula supplier_specialties
        client.delete(f"{supabase_url}/rest/v1/supplier_specialties?tenant_id=eq.{tenant_id}&supplier_id=eq.{supplier_id}", headers=headers)
        client.post(f"{supabase_url}/rest/v1/supplier_specialties", headers=headers, json={
            "tenant_id": tenant_id,
            "supplier_id": supplier_id,
            "specialty_id": spec_id
        })
        print(f"[OK] Especialidade 'Eletricista' vinculada ao subcontratado.")

        # ----------------------------------------------------------------------
        # 3. Produto (Material): Kit Bomba de Piscina 1/2 CV
        # ----------------------------------------------------------------------
        prod_ncm = "84137090"
        prod_sku = "MAT-PSC-8413-001"
        prod_payload = {
            "tenant_id": tenant_id,
            "code": prod_sku,
            "name": "Kit Bomba de Piscina 1/2 CV",
            "description": "Bomba centrífuga autoescorvante para recirculação e filtragem de piscinas residenciais",
            "ncm": prod_ncm,
            "unit_of_measure": "UN",
            "base_cost": 1500.00,
            "sale_price": 1950.00,
            "category": "piscinas",
            "is_active": True
        }
        client.delete(f"{supabase_url}/rest/v1/products?tenant_id=eq.{tenant_id}&code=eq.{prod_sku}", headers=headers)
        p_res = client.post(f"{supabase_url}/rest/v1/products", headers=headers, json=prod_payload)
        p_res.raise_for_status()
        prod_data = p_res.json()[0]
        print(f"[OK] Produto/Material cadastrado: {prod_data['name']} | NCM: {prod_data['ncm']} | Custo: R$ {prod_data['base_cost']}")

        # ----------------------------------------------------------------------
        # 4. Serviço (Mão de Obra): Serviço de Alvenaria e Concretagem
        # ----------------------------------------------------------------------
        srv_code = "SRV-ALV-CONC-001"
        srv_payload = {
            "tenant_id": tenant_id,
            "code": srv_code,
            "name": "Serviço de Alvenaria e Concretagem",
            "description": "Execução de alvenaria estrutural, armação e concretagem de lajes e vigas conforme projeto estrutural",
            "lc116_code": "07.02",
            "nbs_code": "1.0101.10.00",
            "cnae_code": "4120-4/00",
            "unit_of_measure": "UN",
            "base_cost": 5000.00,
            "default_price": 6500.00,
            "iss_aliquota": 5.00,
            "iss_retido_default": True,
            "inss_retencao_aliquota": 11.00,
            "is_active": True
        }
        client.delete(f"{supabase_url}/rest/v1/services?tenant_id=eq.{tenant_id}&code=eq.{srv_code}", headers=headers)
        srv_res = client.post(f"{supabase_url}/rest/v1/services", headers=headers, json=srv_payload)
        srv_res.raise_for_status()
        srv_data = srv_res.json()[0]
        print(f"[OK] Servico cadastrado: {srv_data['name']} | LC 116: {srv_data['lc116_code']} | CNAE: {srv_data['cnae_code']} | ISS: {srv_data['iss_aliquota']}% | INSS: {srv_data['inss_retencao_aliquota']}%")

if __name__ == "__main__":
    run_homologation_seed()
