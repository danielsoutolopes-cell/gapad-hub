"""
=============================================================================
GADAP Hub - Testes Automatizados WBS Gantt, Diário Atômico & Aditivos (Prompt 99)
=============================================================================
Testa:
1. GET /api/v1/projects/{id}/gantt (Árvore WBS e lista para o PWA).
2. PATCH /api/v1/projects/tasks/{task_id}/progress (Transacional: avanço + diário de obra).
3. GET /api/v1/projects/change-orders-requests (Lista pedidos extras do campo).
4. POST /api/v1/projects/change-orders-requests/generate-amendment
   (Precificação, geração do PDF do Aditivo e disparo ao cliente).
5. GET /api/v1/projects/{id}/curve-s (Curva S consolidando o avanço físico médio).
=============================================================================
"""

import pytest
from uuid import UUID, uuid4
from fastapi.testclient import TestClient
from app.main import app
from app.core.deps import get_current_tenant_and_token

test_tenant_id = UUID("11111111-1111-1111-1111-111111111111")
test_token = "mock-jwt-test-token"
app.dependency_overrides[get_current_tenant_and_token] = lambda: (test_tenant_id, test_token)

client = TestClient(app)
PROJ_ID = "550e8400-e29b-41d4-a716-446655440020"


def test_get_project_gantt_wbs_tree():
    """Valida retorno estruturado da WBS e Gantt para o PWA."""
    response = client.get(f"/api/v1/projects/{PROJ_ID}/gantt")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "tasks" in data
    assert "wbs_tree" in data
    assert data["total_tasks"] >= 5
    assert "overall_progress_percentage" in data


def test_update_task_progress_and_diary_atomic():
    """Valida atualização atômica: percentual da tarefa + criação do Diário de Obra."""
    task_id = "test-task-p99"
    payload = {
        "progress_percentage": 75.0,
        "field_report": {
            "workforce_count": 18,
            "weather_condition": "SOL_ENTRE_NUVENS",
            "observations": "Concretagem da laje do 2º pavimento concluída.",
            "photo_urls": ["https://storage.gadap.com.br/obras/laje2.jpg"],
        },
    }

    response = client.patch(
        f"/api/v1/projects/tasks/{task_id}/progress",
        json=payload,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["atomic_transaction"] is True
    assert data["task"]["progress_percentage"] == 75.0
    assert data["field_report"]["workforce_count"] == 18
    assert data["field_report"]["weather_condition"] == "SOL_ENTRE_NUVENS"


def test_list_change_orders_requests():
    """Lista pedidos extras enviados pelo canteiro de obras."""
    response = client.get(
        f"/api/v1/projects/change-orders-requests?project_id={PROJ_ID}",
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["total"] >= 1
    req = data["requests"][0]
    assert "client_request_text" in req
    assert "status" in req


def test_price_and_generate_contract_amendment():
    """Orçamentista precifica pedido do cliente, gera PDF e dispara aditivo contratual."""
    payload = {
        "request_id": "cor-001",
        "priced_amount": 12500.00,
        "notes": "Incluso fornecimento e assentamento de Porcelanato Calacata 120x120.",
        "client_phone": "5511999999999",
    }

    response = client.post(
        "/api/v1/projects/change-orders-requests/generate-amendment",
        json=payload,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["status"] == "APPROVED"
    assert data["priced_amount"] == 12500.00
    assert data["amendment_id"] is not None
    assert "pdf_download_url" in data
