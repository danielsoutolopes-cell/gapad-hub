import pytest
from datetime import date, timedelta
from uuid import UUID, uuid4
from fastapi.testclient import TestClient
from app.main import app
from app.core.deps import get_current_tenant_and_token

test_tenant_id = UUID("11111111-1111-1111-1111-111111111111")
test_token = "mock-jwt-test-token"
app.dependency_overrides[get_current_tenant_and_token] = lambda: (test_tenant_id, test_token)

client = TestClient(app)
test_project_id = str(uuid4())


def test_project_schedule_crud_and_curve_s():
    # 1. Listar tarefas iniciais (gera as tarefas mock de engenharia se vazio)
    resp = client.get(f"/api/v1/projects/{test_project_id}/schedule")
    assert resp.status_code == 200
    tasks = resp.json()
    assert len(tasks) >= 5
    first_task = tasks[0]
    assert "start_date" in first_task
    assert "end_date" in first_task

    # 2. Criar nova tarefa
    today = date.today()
    new_task_payload = {
        "name": "6. Entrega das Chaves e Vistoria com Cliente",
        "start_date": (today + timedelta(days=211)).isoformat(),
        "end_date": (today + timedelta(days=220)).isoformat(),
        "progress_percentage": 0.0,
        "planned_cost": 15000.00,
        "dependencies_json": [first_task["id"]],
        "sort_order": 6,
    }
    create_resp = client.post(f"/api/v1/projects/{test_project_id}/schedule", json=new_task_payload)
    assert create_resp.status_code == 201
    created_task = create_resp.json()
    assert created_task["name"] == new_task_payload["name"]
    created_id = created_task["id"]

    # 3. Atualizar tarefa (Drag-and-Drop de datas e progresso)
    update_payload = {
        "progress_percentage": 50.0,
        "end_date": (today + timedelta(days=225)).isoformat(),
    }
    update_resp = client.patch(
        f"/api/v1/projects/{test_project_id}/schedule/{created_id}",
        json=update_payload,
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["progress_percentage"] == 50.0

    # 4. Calcular Curva S Físico-Financeira
    curve_resp = client.get(f"/api/v1/projects/{test_project_id}/curve-s")
    assert curve_resp.status_code == 200
    curve_data = curve_resp.json()
    assert "total_budget" in curve_data
    assert "data_points" in curve_data
    assert len(curve_data["data_points"]) > 0
    assert "planned_percentage" in curve_data["data_points"][0]
    assert "realized_percentage" in curve_data["data_points"][0]

    # 5. Excluir tarefa
    del_resp = client.delete(f"/api/v1/projects/{test_project_id}/schedule/{created_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True
