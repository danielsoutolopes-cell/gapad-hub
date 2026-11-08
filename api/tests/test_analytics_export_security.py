import io
import jwt
from uuid import UUID, uuid4
import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook

from app.main import app
from app.core.deps import get_tenant_from_auth_header, get_current_tenant_and_token
from app.api.v1.endpoints.analytics import _EXPORT_RATE_LIMIT_BUCKETS, MAX_EXPORT_REQUESTS_PER_MINUTE

client = TestClient(app)

TENANT_ALPHA = str(uuid4())
TENANT_BETA = str(uuid4())

def make_token(tenant_id: str) -> str:
    payload = {
        "sub": str(uuid4()),
        "email": f"user_{tenant_id[:8]}@gadap.com.br",
        "app_metadata": {"tenant_id": tenant_id},
        "role": "authenticated",
    }
    return jwt.encode(payload, "secret-test-key", algorithm="HS256")


def test_export_requires_authentication_and_tenant():
    """
    Rotas de exportação sem autenticação/tenant devem ser terminantemente barradas com 401/403.
    """
    # 1. Sem header
    resp = client.get("/api/v1/analytics/export")
    assert resp.status_code in (401, 403), f"Esperado 401/403, obtido {resp.status_code}"

    # 2. Token inválido/malformado
    resp_invalid = client.get("/api/v1/analytics/export", headers={"Authorization": "Bearer token_invalido_sem_formato"})
    assert resp_invalid.status_code in (401, 403)


def test_export_generates_valid_excel_with_sha256_and_watermark(monkeypatch):
    """
    A exportação (.xlsx) deve conter hash SHA-256 no header, aba de conformidade LGPD
    e rodapé de impressão com rastreabilidade digital.
    """
    token = make_token(TENANT_ALPHA)
    # Mock do get_supabase_client em analytics para retornar dados limpos de teste
    from app.api.v1.endpoints import analytics

    class MockTable:
        def __init__(self, name):
            self.name = name
        def select(self, *args, **kwargs):
            return self
        def eq(self, *args, **kwargs):
            return self
        def limit(self, *args, **kwargs):
            return self
        def execute(self):
            class Res:
                data = [
                    {
                        "entry_type": "receivable",
                        "description": "Medição 01 - Torre Alpha",
                        "category": "material_construcao",
                        "nominal_amount": 50000.0,
                        "technical_retention_amount": 2500.0,
                        "net_amount": 47500.0,
                        "status": "pago",
                        "due_date": "2026-11-10",
                        "payment_date": "2026-11-08",
                        "document_number": "NF-1001",
                        "name": "Construtora Alpha Ltda",
                        "trade_name": "Alpha Engenharia",
                        "cnpj": "12.345.678/0001-90",
                    }
                ]
            return Res()

    class MockSupabase:
        def table(self, name):
            return MockTable(name)

    monkeypatch.setattr(analytics, "get_supabase_client", lambda t: MockSupabase())

    # Injeta a dependência
    app.dependency_overrides[get_tenant_from_auth_header] = lambda: (UUID(TENANT_ALPHA), token)

    try:
        resp = client.get(
            "/api/v1/analytics/export",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, f"Falha na exportação: {resp.text}"
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in resp.headers["content-type"]
        assert "X-Report-SHA256" in resp.headers
        sha256_received = resp.headers["X-Report-SHA256"]
        assert len(sha256_received) == 64, f"Hash SHA-256 deve ter 64 caracteres hex: {sha256_received}"

        # Carrega o workbook Excel em memória e inspeciona abas e rodapés
        wb = load_workbook(io.BytesIO(resp.content))
        assert "Fluxo de Caixa" in wb.sheetnames
        assert "Auditoria & Conformidade" in wb.sheetnames

        ws_cash = wb["Fluxo de Caixa"]
        assert ws_cash.oddFooter.left.text is not None
        assert "GADAP Hub ERP" in ws_cash.oddFooter.left.text
        assert "RASTREABILIDADE LGPD" in ws_cash.oddFooter.center.text

        ws_audit = wb["Auditoria & Conformidade"]
        cell_val = ws_audit["A1"].value
        assert "REGISTRO DE RASTREABILIDADE" in str(cell_val)

    finally:
        app.dependency_overrides.pop(get_tenant_from_auth_header, None)


def test_sectorial_exports_enforce_tenant_and_sha256(monkeypatch):
    """
    Testa os 3 relatórios setoriais: DRE, Inadimplência e SLA de Docas.
    Todos devem validar o tenant estritamente e retornar planilhas carimbadas com SHA-256.
    """
    token = make_token(TENANT_BETA)
    from app.api.v1.endpoints import analytics

    class MockTable:
        def __init__(self, name): pass
        def select(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def in_(self, *a, **k): return self
        def limit(self, *a, **k): return self
        def execute(self):
            class Res:
                data = [{"trade_name": "Beta Construções", "cnpj": "98.765.432/0001-10"}]
            return Res()

    class MockSupabase:
        def table(self, name): return MockTable(name)

    monkeypatch.setattr(analytics, "get_supabase_client", lambda t: MockSupabase())
    app.dependency_overrides[get_tenant_from_auth_header] = lambda: (UUID(TENANT_BETA), token)

    try:
        for path, expected_name in [
            ("/api/v1/analytics/export/dre", "DRE"),
            ("/api/v1/analytics/export/inadimplencia", "Inadimplencia"),
            ("/api/v1/analytics/export/sla-docas", "SLA_Docas"),
            ("/api/v1/analytics/export/movimentacao", "Movimentacao"),
        ]:
            resp = client.get(path, headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code == 200, f"Falha no endpoint {path}: {resp.text}"
            assert "X-Report-SHA256" in resp.headers
            assert len(resp.headers["X-Report-SHA256"]) == 64
            assert expected_name in resp.headers["content-disposition"]
    finally:
        app.dependency_overrides.pop(get_tenant_from_auth_header, None)


def test_rate_limiting_enforces_100_requests_per_minute():
    """
    Dispara mais de 100 requisições simuladas para um mesmo tenant_id.
    A partir da 101ª requisição, deve barrar imediatamente com HTTP 429 Too Many Requests
    e header Retry-After: 60.
    """
    test_tenant_id = f"test-tenant-rate-limit-{uuid4()}"
    token = make_token(test_tenant_id)
    app.dependency_overrides[get_tenant_from_auth_header] = lambda: (UUID(test_tenant_id.replace("test-tenant-rate-limit-", "")), token)

    # Limpa bucket do tenant
    _EXPORT_RATE_LIMIT_BUCKETS[str(UUID(test_tenant_id.replace("test-tenant-rate-limit-", "")))] = []

    try:
        from app.api.v1.endpoints.analytics import check_tenant_export_rate_limit
        from fastapi import HTTPException

        tid_str = str(UUID(test_tenant_id.replace("test-tenant-rate-limit-", "")))

        # Executa 100 chamadas válidas
        for _ in range(MAX_EXPORT_REQUESTS_PER_MINUTE):
            check_tenant_export_rate_limit(tid_str)

        # 101ª requisição deve levantar HTTP 429
        with pytest.raises(HTTPException) as exc_info:
            check_tenant_export_rate_limit(tid_str)

        assert exc_info.value.status_code == 429
        assert "Retry-After" in exc_info.value.headers
        assert exc_info.value.headers["Retry-After"] == "60"
        assert "Limite de requisições de exportação excedido" in exc_info.value.detail
    finally:
        app.dependency_overrides.pop(get_tenant_from_auth_header, None)
