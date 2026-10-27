"""
=============================================================================
GADAP Hub - Load & Stress Testing Suite (Locust)
Arquivo: tests/load/locustfile.py
=============================================================================
Objetivo: Simular até 500 usuários simultâneos disparando requisições concorrentes
contra a API FastAPI para testar:
  1. POST /api/v1/fiscal/invoices/simulate (Cálculo em tempo real do IVA Dual vs Legado)
  2. GET /api/v1/finance/payables (Central Financeira Consolidada de Todas as Obras)
=============================================================================
"""

import random
from locust import HttpUser, task, between, events


class GadapHubLoadUser(HttpUser):
    # Tempo de espera simulado entre 100ms e 500ms para gerar carga contínua e realista
    wait_time = between(0.1, 0.5)

    # Token sintético de homologação para testes de estresse
    default_headers = {
        "Authorization": "Bearer stress-test-token-load-user",
        "x-tenant-id": "7ffdf475-b337-4282-ae1f-3f8056394334",
        "Content-Type": "application/json",
    }

    @task(3)
    def test_simulate_fiscal_invoice(self):
        """
        Simula a carga de requisições de cálculo simultâneo de tributos, retenções
        e transição do IVA Dual para grandes obras da construção civil.
        """
        payload = {
            "valor_faturamento_bruto": round(random.uniform(50000.0, 500000.0), 2),
            "deducoes_materiais": round(random.uniform(5000.0, 40000.0), 2),
            "base_calculo_inss_perc": 40.0,
            "exercicio_ano": random.choice([2026, 2027, 2028, 2029, 2033]),
            "optante_simples_nacional": False,
            "tax_regime": "lucro_presumido",
            "iss_aliquota": 5.0,
            "creditos_materiais_cbs": round(random.uniform(100.0, 2000.0), 2),
            "creditos_materiais_ibs": round(random.uniform(200.0, 4000.0), 2),
            "aplicar_redutor_construcao": True,
        }

        with self.client.post(
            "/api/v1/fiscal/invoices/simulate",
            json=payload,
            headers=self.default_headers,
            catch_response=True,
            name="POST /api/v1/fiscal/invoices/simulate",
        ) as response:
            if response.status_code == 200:
                body = response.json()
                if "modelo_iva_dual" in body and "modelo_legado" in body:
                    response.success()
                else:
                    response.failure(f"Payload inválido retornado: {response.text[:200]}")
            else:
                response.failure(f"HTTP {response.status_code}: {response.text[:200]}")

    @task(2)
    def test_get_financial_payables(self):
        """
        Simula o acesso em alta concorrência da Central Financeira (Contas a Pagar),
        avaliando tempo de agregação por obra e limite de conexões do Supabase PostgreSQL.
        """
        status_filter = random.choice(["aberto", "pago", ""])
        params = f"?status={status_filter}" if status_filter else ""

        with self.client.get(
            f"/api/v1/finance/payables{params}",
            headers=self.default_headers,
            catch_response=True,
            name="GET /api/v1/finance/payables",
        ) as response:
            if response.status_code == 200:
                body = response.json()
                if "totals" in body and "grouped_by_project" in body:
                    response.success()
                else:
                    response.failure("Estrutura da resposta financeira incorreta.")
            else:
                response.failure(f"HTTP {response.status_code}: {response.text[:200]}")


import sys

# Garante suporte a UTF-8 no stdout/stderr no Windows
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("=================================================================")
    print("[TESTE DE CARGA] INICIANDO GADAP HUB (500 USUARIOS SIMULTANEOS)")
    print("=================================================================")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    print("=================================================================")
    print("[TESTE DE CARGA] FINALIZADO - ESTATISTICAS COMPUTADAS COM SUCESSO")
    print("=================================================================")
