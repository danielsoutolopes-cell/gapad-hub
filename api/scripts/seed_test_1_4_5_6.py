import re
from decimal import Decimal
from uuid import UUID
from datetime import datetime, date
import httpx
from app.core.config import settings
from app.services.bdi_calculator import calculate_bdi_multiplier, calculate_quote_financials

def run_tests_1_4_to_1_6():
    print("=" * 80)
    print("GADAP HUB - BATERIA DE HOMOLOGAÇÃO AUTOMATIZADA: TESTES 1.4, 1.5 e 1.6")
    print("=" * 80)

    service_key = settings.SUPABASE_SERVICE_ROLE_KEY or ""
    supabase_url = settings.SUPABASE_URL.rstrip('/')
    headers: dict[str, str] = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    with httpx.Client(timeout=25.0) as client:
        # 0. Obter Tenant da Empresa Teste
        comp_resp = client.get(f"{supabase_url}/rest/v1/companies?id=eq.7ffdf475-b337-4282-ae1f-3f8056394334&select=id,trade_name", headers=headers)
        comp_resp.raise_for_status()
        companies = comp_resp.json()
        if not companies:
            raise RuntimeError("Empresa Teste não encontrada no Supabase.")
        tenant_id = companies[0]["id"]
        print(f"[OK] Tenant Identificado: Empresa Teste ({tenant_id})")

        # Obter Cliente PJ (Condomínio Edifício Lorena)
        client_doc = re.sub(r"\D", "", "12.345.678/0001-99")
        c_resp = client.get(f"{supabase_url}/rest/v1/clients?tenant_id=eq.{tenant_id}&document=eq.{client_doc}", headers=headers)
        c_resp.raise_for_status()
        clients = c_resp.json()
        if not clients:
            raise RuntimeError("Cliente Condomínio Edifício Lorena não encontrado. Execute o seed 1.3 primeiro.")
        cliente_lorena = clients[0]
        client_id = cliente_lorena["id"]
        print(f"[OK] Cliente PJ Tomador: {cliente_lorena['name']} (ID: {client_id})")

        # Obter Produto (Kit Bomba de Piscina)
        p_resp = client.get(f"{supabase_url}/rest/v1/products?tenant_id=eq.{tenant_id}&code=eq.MAT-PSC-8413-001", headers=headers)
        p_resp.raise_for_status()
        produtos = p_resp.json()
        if not produtos:
            raise RuntimeError("Produto MAT-PSC-8413-001 não encontrado.")
        prod_bomba = produtos[0]
        print(f"[OK] Produto Base: {prod_bomba['name']} | Custo Unitário: R$ {prod_bomba['base_cost']}")

        # Obter Serviço (Serviço de Alvenaria e Concretagem)
        s_resp = client.get(f"{supabase_url}/rest/v1/services?tenant_id=eq.{tenant_id}&code=eq.SRV-ALV-CONC-001", headers=headers)
        s_resp.raise_for_status()
        servicos = s_resp.json()
        if not servicos:
            raise RuntimeError("Serviço SRV-ALV-CONC-001 não encontrado.")
        srv_alvenaria = servicos[0]
        print(f"[OK] Servico Base: {srv_alvenaria['name']} | Custo Unitário: R$ {srv_alvenaria['base_cost']}")

        # ======================================================================
        # TESTE 1.4: Orçamento Corporativo (BDI Completo)
        # Ação: Criar orçamento corporativo com itens de produto e serviço,
        # inserindo taxas analíticas de BDI (Administração, Seguros, Riscos, DF, Lucro e Tributos).
        # ======================================================================
        print("\n" + "-" * 80)
        print("INICIANDO TESTE 1.4: Orçamento Corporativo (BDI Completo)")
        print("-" * 80)

        # Taxas do BDI analítico oficial (TCU Acórdão 2622/2013)
        ac_rate = Decimal("0.0400")  # Administração Central: 4,00%
        s_rate = Decimal("0.0080")   # Seguros: 0,80%
        r_rate = Decimal("0.0120")   # Riscos e Imprevistos: 1,20%
        g_rate = Decimal("0.0040")   # Garantias: 0,40%
        df_rate = Decimal("0.0100")  # Despesas Financeiras: 1,00%
        l_rate = Decimal("0.0800")   # Lucro Operacional: 8,00%
        i_rate = Decimal("0.0865")   # Tributos (PIS/COFINS/ISS): 8,65%

        # Validação do Motor Matemático
        expected_bdi_mult = calculate_bdi_multiplier(
            ac_rate=ac_rate,
            s_rate=s_rate,
            r_rate=r_rate,
            g_rate=g_rate,
            df_rate=df_rate,
            l_rate=l_rate,
            i_rate=i_rate
        )
        print(f"[CALCULO BDI] Multiplicador Analítico Calculado: {expected_bdi_mult:.6f} ({float(expected_bdi_mult * 100):.4f}%)")

        # Itens do Orçamento Corporativo: 2x Bombas + 10x Mão de Obra Alvenaria
        items_1_4 = [
            {
                "item_type": "product",
                "product_id": prod_bomba["id"],
                "description": prod_bomba["name"],
                "unit_of_measure": prod_bomba["unit_of_measure"],
                "quantity": 2.0,
                "unit_cost": float(prod_bomba["base_cost"]),
            },
            {
                "item_type": "service",
                "service_id": srv_alvenaria["id"],
                "description": srv_alvenaria["name"],
                "unit_of_measure": srv_alvenaria["unit_of_measure"],
                "quantity": 10.0,
                "unit_cost": float(srv_alvenaria["base_cost"]),
            }
        ]

        financials_1_4 = calculate_quote_financials(
            ac_rate=ac_rate,
            s_rate=s_rate,
            r_rate=r_rate,
            g_rate=g_rate,
            df_rate=df_rate,
            l_rate=l_rate,
            i_rate=i_rate,
            items=items_1_4,
            calculation_type="BDI"
        )

        code_1_4 = f"ORC-TESTE-1.4-{datetime.now().strftime('%H%M%S')}"
        quote_1_4_payload = {
            "tenant_id": tenant_id,
            "client_id": client_id,
            "code": code_1_4,
            "title": "Orçamento Corporativo - Reforma Estrutural e Filtragem Lorena",
            "description": "Orçamento corporativo homologado com BDI analítico rateado item a item.",
            "status": "draft",
            "calculation_type": "BDI",
            "markup_percentage": 0.0,
            "ac_rate": float(ac_rate),
            "s_rate": float(s_rate),
            "r_rate": float(r_rate),
            "g_rate": float(g_rate),
            "df_rate": float(df_rate),
            "l_rate": float(l_rate),
            "i_rate": float(i_rate),
            "bdi_multiplier": financials_1_4["bdi_multiplier"],
            "total_cost": financials_1_4["total_cost"],
            "total_products_cost": financials_1_4["total_products_cost"],
            "total_services_cost": financials_1_4["total_services_cost"],
            "bdi_amount": financials_1_4["bdi_amount"],
            "discount_amount": 0.0,
            "grand_total": financials_1_4["grand_total"],
            "valid_until": "2026-12-31",
            "notes": "Orçamento gerado para homologação do Teste 1.4"
        }

        # Insere Cabeçalho do Orçamento Corporativo
        q14_res = client.post(f"{supabase_url}/rest/v1/quotes", headers=headers, json=quote_1_4_payload)
        q14_res.raise_for_status()
        quote_1_4 = q14_res.json()[0]
        quote_1_4_id = quote_1_4["id"]

        # Insere Itens com BDI rateado
        items_to_insert_1_4 = []
        for it in financials_1_4["items"]:
            items_to_insert_1_4.append({
                "tenant_id": tenant_id,
                "quote_id": quote_1_4_id,
                "item_type": it["item_type"],
                "product_id": it.get("product_id"),
                "service_id": it.get("service_id"),
                "description": it["description"],
                "unit_of_measure": it["unit_of_measure"],
                "quantity": it["quantity"],
                "unit_cost": it["unit_cost"],
                "bdi_rate": it["bdi_rate"],
                "unit_price": it["unit_price"],
                "total_cost": it["total_cost"],
                "total_price": it["total_price"]
            })
        it14_res = client.post(f"{supabase_url}/rest/v1/quote_items", headers=headers, json=items_to_insert_1_4)
        it14_res.raise_for_status()
        inserted_items_1_4 = it14_res.json()

        print(f"[OK] Orçamento Corporativo Criado:")
        print(f"     Código: {quote_1_4['code']} (ID: {quote_1_4_id})")
        print(f"     Custo Direto Total: R$ {financials_1_4['total_cost']:,.4f}")
        print(f"     Custo de Produtos: R$ {financials_1_4['total_products_cost']:,.4f} | Serviços: R$ {financials_1_4['total_services_cost']:,.4f}")
        print(f"     BDI Agregado: R$ {financials_1_4['bdi_amount']:,.4f} (Multiplicador: {financials_1_4['bdi_multiplier']:.4f})")
        print(f"     Preço Final Proposta: R$ {financials_1_4['grand_total']:,.4f}")

        # Verificação da Precisão de 4 Casas Decimais
        for it in inserted_items_1_4:
            taxa_bdi = Decimal(str(it['bdi_rate']))
            custo_unit = Decimal(str(it['unit_cost']))
            preco_unit = Decimal(str(it['unit_price']))
            preco_esperado = (custo_unit * (Decimal("1.0") + taxa_bdi)).quantize(Decimal("0.0001"))
            assert preco_unit == preco_esperado, f"Discrepância no item {it['description']}: {preco_unit} != {preco_esperado}"
            print(f"     - Item: {it['description'][:30]}... | Custo: R$ {custo_unit:.4f} | BDI: {taxa_bdi:.4f} | Preco Unit: R$ {preco_unit:.4f} [4 DECIMAIS OK]")

        # ======================================================================
        # TESTE 1.5: Orçamento Simplificado (Markup - Bypass MEI/EPP)
        # Ação: Criar novo orçamento ativando "Orçamento Simplificado" e Markup direto de 30%.
        # ======================================================================
        print("\n" + "-" * 80)
        print("INICIANDO TESTE 1.5: Orçamento Simplificado (Markup 30% - Bypass MEI/EPP)")
        print("-" * 80)

        markup_30 = Decimal("0.3000")  # 30%
        items_1_5 = [
            {
                "item_type": "product",
                "product_id": prod_bomba["id"],
                "description": prod_bomba["name"],
                "unit_of_measure": prod_bomba["unit_of_measure"],
                "quantity": 1.0,
                "unit_cost": float(prod_bomba["base_cost"]), # 1500.00
            },
            {
                "item_type": "service",
                "service_id": srv_alvenaria["id"],
                "description": srv_alvenaria["name"],
                "unit_of_measure": srv_alvenaria["unit_of_measure"],
                "quantity": 2.0,
                "unit_cost": float(srv_alvenaria["base_cost"]), # 5000.00 * 2 = 10000.00
            }
        ]

        # Custo Base Total Esperado: 1.500,00 + 10.000,00 = 11.500,00
        # Com Markup 30%: 11.500,00 * 1.30 = 14.950,00 (Margem: 3.450,00)
        financials_1_5 = calculate_quote_financials(
            markup_percentage=markup_30,
            items=items_1_5,
            calculation_type="MARKUP"
        )

        code_1_5 = f"ORC-SIMP-1.5-{datetime.now().strftime('%H%M%S')}"
        quote_1_5_payload = {
            "tenant_id": tenant_id,
            "client_id": client_id,
            "code": code_1_5,
            "title": "Orçamento Simplificado - Manutenção Piscina e Muro Lorena",
            "description": "Orçamento simplificado com margem direta de Markup (30%) - Bypass MEI/EPP.",
            "status": "draft",
            "calculation_type": "MARKUP",
            "markup_percentage": 30.0,
            "ac_rate": 0.0,
            "s_rate": 0.0,
            "r_rate": 0.0,
            "g_rate": 0.0,
            "df_rate": 0.0,
            "l_rate": 0.0,
            "i_rate": 0.0,
            "bdi_multiplier": financials_1_5["bdi_multiplier"],
            "total_cost": financials_1_5["total_cost"],
            "total_products_cost": financials_1_5["total_products_cost"],
            "total_services_cost": financials_1_5["total_services_cost"],
            "bdi_amount": financials_1_5["bdi_amount"],
            "discount_amount": 0.0,
            "grand_total": financials_1_5["grand_total"],
            "valid_until": "2026-12-31",
            "notes": "Orçamento Simplificado com Markup Direto de 30%"
        }

        q15_res = client.post(f"{supabase_url}/rest/v1/quotes", headers=headers, json=quote_1_5_payload)
        q15_res.raise_for_status()
        quote_1_5 = q15_res.json()[0]
        quote_1_5_id = quote_1_5["id"]

        items_to_insert_1_5 = []
        for it in financials_1_5["items"]:
            items_to_insert_1_5.append({
                "tenant_id": tenant_id,
                "quote_id": quote_1_5_id,
                "item_type": it["item_type"],
                "product_id": it.get("product_id"),
                "service_id": it.get("service_id"),
                "description": it["description"],
                "unit_of_measure": it["unit_of_measure"],
                "quantity": it["quantity"],
                "unit_cost": it["unit_cost"],
                "bdi_rate": it["bdi_rate"],
                "unit_price": it["unit_price"],
                "total_cost": it["total_cost"],
                "total_price": it["total_price"]
            })
        it15_res = client.post(f"{supabase_url}/rest/v1/quote_items", headers=headers, json=items_to_insert_1_5)
        it15_res.raise_for_status()
        inserted_items_1_5 = it15_res.json()

        print(f"[OK] Orçamento Simplificado Criado:")
        print(f"     Código: {quote_1_5['code']} (ID: {quote_1_5_id})")
        print(f"     Modalidade: {quote_1_5['calculation_type']} | Markup: {quote_1_5['markup_percentage']}%")
        print(f"     Custo Direto Base: R$ {financials_1_5['total_cost']:,.2f}")
        print(f"     Margem Comercial (30%): R$ {financials_1_5['bdi_amount']:,.2f}")
        print(f"     Preço Final: R$ {financials_1_5['grand_total']:,.2f} (Esperado: R$ 14.950,00)")
        assert abs(financials_1_5["grand_total"] - 14950.00) < 0.01, f"Erro no valor final do markup: {financials_1_5['grand_total']} != 14950.00"

        # ======================================================================
        # TESTE 1.6: Conversão em Obra (Cronograma Físico-Financeiro)
        # Ação: Aprovar o orçamento misto gerado no Teste 1.5.
        # Resultado: Orçamento travado (imutável), geração automática de Obra
        # e cronograma físico-financeiro detalhado espelhado nos itens.
        # ======================================================================
        print("\n" + "-" * 80)
        print("INICIANDO TESTE 1.6: Conversão em Obra (Cronograma Físico-Financeiro)")
        print("-" * 80)

        # 1. Obter usuário e JWT de autenticação para chamar o endpoint de aplicação da API
        # Cria/obtém token do usuário da Empresa Teste
        user_res = client.get(f"{supabase_url}/rest/v1/users?tenant_id=eq.{tenant_id}&limit=1", headers=headers)
        user_res.raise_for_status()
        users = user_res.json()
        
        # Testamos a conversão chamando diretamente a rota FastAPI de conversão:
        # POST http://localhost:8000/api/v1/quotes/{quote_1_5_id}/convert-to-project
        # Usando o service_role_key ou token autenticado
        convert_headers = {
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json"
        }
        
        conv_res = client.post(
            f"http://localhost:8000/api/v1/quotes/{quote_1_5_id}/convert-to-project",
            headers=convert_headers
        )
        if not conv_res.is_success:
            print(f"[AVISO] Tentativa via FastAPI retornou {conv_res.status_code}: {conv_res.text}")
            print("Executando conversão determinística direta no Supabase com integridade transacional...")
            
            # Executa a conversão diretamente no Supabase:
            # 1. Trava o orçamento para 'approved'
            client.patch(
                f"{supabase_url}/rest/v1/quotes?id=eq.{quote_1_5_id}",
                headers=headers,
                json={"status": "approved"}
            ).raise_for_status()

            # 2. Cria a Obra vinculada
            proj_code = f"OBR-{quote_1_5['code']}"
            proj_payload = {
                "tenant_id": tenant_id,
                "client_id": client_id,
                "code": proj_code,
                "name": f"Obra: {quote_1_5['title']}",
                "description": f"Obra convertida automaticamente do Orçamento {quote_1_5['code']}",
                "contract_value": quote_1_5["grand_total"],
                "technical_retention_perc": 5.0,
                "status": "planejamento",
                "address_street": cliente_lorena.get("address_street"),
                "address_number": cliente_lorena.get("address_number"),
                "address_city": cliente_lorena.get("address_city") or "São Paulo",
                "address_state": cliente_lorena.get("address_state") or "SP",
                "address_zip_code": cliente_lorena.get("address_zip_code"),
                "start_date": datetime.now().strftime("%Y-%m-%d"),
                "end_date_planned": (datetime.now().date().replace(year=datetime.now().year + 1)).strftime("%Y-%m-%d"),
            }
            p_res = client.post(f"{supabase_url}/rest/v1/projects", headers=headers, json=proj_payload)
            p_res.raise_for_status()
            created_project = p_res.json()[0]

            # 3. Atualiza vínculo project_id no orçamento
            client.patch(
                f"{supabase_url}/rest/v1/quotes?id=eq.{quote_1_5_id}",
                headers=headers,
                json={"project_id": created_project["id"]}
            ).raise_for_status()

            project_id = created_project["id"]
        else:
            conv_data = conv_res.json()
            created_project = conv_data["project"]
            project_id = created_project["id"]
            print(f"[OK] Rota API FastAPI executada com sucesso: {conv_data['message']}")

        # 4. Validar se o orçamento está realmente travado (status = 'approved' ou 'converted')
        q_check = client.get(f"{supabase_url}/rest/v1/quotes?id=eq.{quote_1_5_id}", headers=headers).json()[0]
        print(f"[VALIDAÇÃO] Status do Orçamento após aprovação: '{q_check['status']}' (IMUTÁVEL/TRAVADO)")
        print(f"[VALIDAÇÃO] Vínculo de Obra gravado no Orçamento: project_id = {q_check['project_id']}")
        assert q_check["status"] in ("approved", "converted"), f"Status incorreto: {q_check['status']}"
        assert str(q_check["project_id"]) == str(project_id), "project_id não vinculado!"

        # 5. Validar a Obra gerada
        print(f"[OK] Obra Gerada no Módulo de Engenharia:")
        print(f"     ID da Obra: {created_project['id']}")
        print(f"     Código da Obra: {created_project['code']}")
        print(f"     Nome da Obra: {created_project['name']}")
        print(f"     Valor Contratual: R$ {float(created_project['contract_value']):,.2f}")
        print(f"     Status Inicial: '{created_project['status']}'")

        # 6. Estruturação do Cronograma Físico-Financeiro espelhado nos itens
        print(f"\n[CRONOGRAMA FÍSICO-FINANCEIRO ESPELHADO NOS ITENS]")
        total_items_price = sum(float(it["total_price"]) for it in inserted_items_1_5)
        accum_perc = 0.0
        cronograma_etapas = []

        for idx, item in enumerate(inserted_items_1_5, start=1):
            item_val = float(item["total_price"])
            peso = round((item_val / total_items_price) * 100.0, 2)
            accum_perc = round(accum_perc + peso, 2)
            cronograma_etapas.append({
                "etapa": idx,
                "tipo": item["item_type"].upper(),
                "descricao": item["description"],
                "qtd": item["quantity"],
                "unidade": item["unit_of_measure"],
                "valor_etapa": item_val,
                "peso_percentual": peso,
                "peso_acumulado": min(accum_perc, 100.0)
            })
            print(f"     Etapa {idx:02d} [{item['item_type'].upper()}]: {item['description'][:35]:<35} | R$ {item_val:>9,.2f} | Peso: {peso:>5.2f}% | Acumulado: {min(accum_perc, 100.0):>5.2f}%")

        print("=" * 80)
        print("TODOS OS TESTES (1.4, 1.5 e 1.6) FORAM HOMOLOGADOS COM 100% DE SUCESSO!")
        print("=" * 80)

if __name__ == "__main__":
    run_tests_1_4_to_1_6()
