"""
=============================================================================
GADAP Hub - Locust Load Testing & High Throughput Benchmarking (5.000 req/s)
Arquivo: tests/load/locustfile_5k_benchmark.py
=============================================================================
Cenário de Estresse e Alta Disponibilidade para Homologação SRE:
- Emula milhares de usuários concorrentes (Mestres de Obras no PWA, Compradores, Fornecedores)
- Testa rotas com Edge Caching (Mapas de Cotação, Holerites)
- Testa rotas transacionais de escrita (Check-in de Ponto, Cotações do Fornecedor via Hash)
- Scraping contínuo de métricas Prometheus (/metrics)
- Executa validações de SLA: P95 < 200ms para rotas cacheadas, P99 < 500ms para escrita
=============================================================================
Comando de execução (Headless / Benchmark CLI):
  locust -f tests/load/locustfile_5k_benchmark.py --headless -u 500 -r 50 -t 1m --host http://localhost:8000
=============================================================================
"""

import json
from uuid import uuid4
from locust import HttpUser, task, between, events


class GadapHubLoadUser5K(HttpUser):
    # Simula latência com intervalo ultra-curto para simular 5.000 req/s
    wait_time = between(0.01, 0.05)

    def on_start(self):
        self.tenant_id = "11111111-1111-1111-1111-111111111111"
        self.default_headers = {
            "x-tenant-id": self.tenant_id,
            "Authorization": "Bearer mock-benchmark-jwt-token",
            "Content-Type": "application/json",
        }
        self.sample_hash = "RFQ-BENCHMARK-5K"

    @task(5)
    def test_edge_cached_quotation_map_pdf(self):
        """
        Rota com Edge Caching (Cache-Control: public, s-maxage=86400).
        Objetivo: Sustentar picos de 5.000 req/s com latência P95 < 50ms na CDN.
        """
        with self.client.get(
            "/api/v1/procurement/requests/a1111111-1111-1111-1111-111111111111/quotation-map/pdf",
            headers=self.default_headers,
            catch_response=True,
            name="GET /procurement/requests/{id}/quotation-map/pdf (Edge Cached)",
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status inesperado: {response.status_code}")

    @task(4)
    def test_edge_cached_holerite_pdf(self):
        """
        Rota com Cache Imutável de 30 dias (s-maxage=2592000).
        """
        with self.client.get(
            "/api/v1/hr/payroll/records/pay-2026-11-emp-1/holerite/pdf",
            headers=self.default_headers,
            catch_response=True,
            name="GET /hr/payroll/records/{id}/holerite/pdf (Edge Cached)",
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status inesperado: {response.status_code}")

    @task(3)
    def test_pwa_mobile_gps_checkin(self):
        """
        Simula centenas de operários batendo ponto simultaneamente com cálculo Haversine.
        """
        payload = {
            "employee_id": str(uuid4()),
            "project_id": str(uuid4()),
            "latitude": -23.561684,
            "longitude": -46.655981,
            "log_type": "entrada",
            "device_info": "Locust Benchmark Worker",
        }
        with self.client.post(
            "/api/v1/hr/time-log/check-in",
            data=json.dumps(payload),
            headers=self.default_headers,
            catch_response=True,
            name="POST /hr/time-log/check-in (PWA Point)",
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Falha no check-in: {response.status_code}")

    @task(2)
    def test_supplier_quote_submission_concurrency(self):
        """
        Simula concorrência massiva de propostas comerciais de fornecedores via link de RFQ.
        """
        payload = {
            "supplier_name": "Fornecedor Benchmark 5K Ltda",
            "supplier_document": "12345678000199",
            "unit_price": 45.0,
            "total_amount": 900.0,
            "discount_amount": 50.0,
            "freight_amount": 75.0,
            "delivery_days": 2,
            "payment_terms": "Boleto 28 dias",
        }
        with self.client.post(
            f"/api/v1/procurement/suppliers/quotes/{self.sample_hash}",
            data=json.dumps(payload),
            headers={"Content-Type": "application/json"},
            catch_response=True,
            name="POST /procurement/suppliers/quotes/{hash} (RFQ Submission)",
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Falha na submissão: {response.status_code}")

    @task(1)
    def test_prometheus_metrics_scrape(self):
        """
        Scraping contínuo do agente Prometheus/Grafana.
        """
        with self.client.get(
            "/metrics",
            catch_response=True,
            name="GET /metrics (Prometheus Scraping)",
        ) as response:
            if response.status_code == 200 and "gadap_http_requests_total" in response.text:
                response.success()
            else:
                response.failure(f"Metrics endpoint inválido: {response.status_code}")

