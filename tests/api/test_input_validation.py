import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
api_dir = os.path.join(root_dir, "api")
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

class TestInputValidationAndCrashResilience:
    """
    Testes de Crash & Validação de Entrada I/O.
    Garante que payloads maliciosos, vazios ou corrompidos sejam interceptados
    pelo Pydantic com HTTP 422 sem derrubar o processo FastAPI.
    """

    def test_fiscal_simulation_empty_payload_returns_422(self):
        """Disparo de payload vazio contra a rota de simulação fiscal."""
        response = client.post("/api/v1/fiscal/invoices/simulate", json={})
        assert response.status_code == 422
        errors = response.json()
        assert "detail" in errors

    def test_fiscal_simulation_corrupted_types(self):
        """Disparo de campos com tipos corrompidos (string no lugar de float)."""
        corrupted_payload = {
            "gross_amount": "VALOR_INVALIDO_INJECAO_SQL",
            "invoice_type": 12345,
            "deductions": "NAO_NUMERICO"
        }
        response = client.post("/api/v1/fiscal/invoices/simulate", json=corrupted_payload)
        assert response.status_code == 422
        assert isinstance(response.json().get("detail"), list)

    def test_malicious_sql_injection_in_headers(self):
        """Tentativa de injeção SQL no cabeçalho x-tenant-id."""
        malicious_headers = {
            "x-tenant-id": "'; DROP TABLE companies CASCADE; --",
            "Authorization": "Bearer fake_token"
        }
        response = client.get("/api/v1/finance/payables", headers=malicious_headers)
        # O backend não deve sofrer crash (500 com traceback cru)
        assert response.status_code in [200, 400, 401, 403, 422]

    def test_overflow_payload_protection(self):
        """Disparo de string gigante (1MB) para testar estouro de buffer."""
        giant_payload = {
            "service_description": "A" * 1000000,
            "gross_amount": -99999.0
        }
        response = client.post("/api/v1/fiscal/invoices/simulate", json=giant_payload)
        assert response.status_code in [400, 422]

    def test_server_remains_healthy_after_abuse(self):
        """Comprova que o servidor continua operando normalmente após as tentativas de abuso."""
        health_resp = client.get("/api/v1/health")
        assert health_resp.status_code == 200
        assert health_resp.json().get("status") in ["healthy", "ok", "ACTIVE"]
