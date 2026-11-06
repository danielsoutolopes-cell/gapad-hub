import pytest
from datetime import date
from uuid import UUID, uuid4
from fastapi.testclient import TestClient
from app.main import app
from app.core.deps import get_current_client_portal_user

test_tenant_id = UUID("11111111-1111-1111-1111-111111111111")
test_client_id = UUID("22222222-2222-2222-2222-222222222222")

app.dependency_overrides[get_current_client_portal_user] = lambda: {
    "user_id": str(uuid4()),
    "email": "cliente.lorena@gmail.com",
    "role": "CLIENT",
    "tenant_id": test_tenant_id,
    "client_id": test_client_id,
    "token": "mock-client-jwt",
}

client = TestClient(app)
test_project_id = str(uuid4())


def test_portal_summary_gallery_and_amendments():
    # 1. Resumo da Obra
    resp = client.get(f"/api/v1/portal/projects/{test_project_id}/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert "physical_progress_pct" in data
    assert "financial_progress_pct" in data

    # 2. Curva S da Obra
    c_resp = client.get(f"/api/v1/portal/projects/{test_project_id}/curve-s")
    assert c_resp.status_code == 200
    c_data = c_resp.json()
    assert "points" in c_data
    assert len(c_data["points"]) > 0

    # 3. Galeria de Fotos / Diário
    g_resp = client.get(f"/api/v1/portal/projects/{test_project_id}/gallery")
    assert g_resp.status_code == 200
    g_data = g_resp.json()
    assert "reports" in g_data
    assert len(g_data["reports"]) > 0
    assert len(g_data["reports"][0]["photos"]) > 0

    # 4. Aditivos e Assinatura Gov.br
    a_resp = client.get(f"/api/v1/portal/projects/{test_project_id}/amendments")
    assert a_resp.status_code == 200
    a_data = a_resp.json()
    assert "amendments" in a_data

    # Assinar Aditivo
    sign_resp = client.post(f"/api/v1/portal/projects/{test_project_id}/amendments/amd-001/sign-govbr")
    assert sign_resp.status_code == 200
    sign_data = sign_resp.json()
    assert sign_data["success"] is True
    assert sign_data["signature_type"] == "ASSINATURA_AVANCADA_GOVBR"

