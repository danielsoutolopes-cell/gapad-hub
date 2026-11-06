import pytest
from datetime import date
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_list_and_create_employee_dp():
    # 1. Listagem inicial
    resp = client.get("/api/v1/hr/employees")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    initial_count = data["total"]
    assert initial_count >= 3

    # 2. Admissão de novo colaborador
    new_emp_payload = {
        "full_name": "Carlos Eduardo Carpinteiro",
        "cpf": "111.222.333-44",
        "role": "Carpinteiro",
        "base_salary": 3100.00,
        "admission_date": "2026-11-01",
        "phone": "(11) 98888-7777"
    }
    create_resp = client.post("/api/v1/hr/employees", json=new_emp_payload)
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["full_name"] == "Carlos Eduardo Carpinteiro"
    assert created["base_salary"] == 3100.00
    assert created["status"] == "ACTIVE"
    emp_id = created["id"]

    # 3. Programação de Férias
    vacation_payload = {
        "vacation_start_date": "2026-12-01",
        "vacation_end_date": "2026-12-20"
    }
    vac_resp = client.post(f"/api/v1/hr/employees/{emp_id}/schedule-vacation", json=vacation_payload)
    assert vac_resp.status_code == 200
    assert vac_resp.json()["employee"]["status"] == "VACATION"

    # 4. Rescisão
    term_payload = {
        "termination_date": "2026-12-21",
        "termination_reason": "Término de contrato de obra por prazo determinado"
    }
    term_resp = client.post(f"/api/v1/hr/employees/{emp_id}/terminate", json=term_payload)
    assert term_resp.status_code == 200
    assert term_resp.json()["employee"]["status"] == "TERMINATED"


def test_calculate_payroll_engine_dp():
    payload = {
        "reference_month": "2026-11"
    }
    resp = client.post("/api/v1/hr/payroll/calculate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["reference_month"] == "2026-11"
    assert data["processed_count"] >= 2
    assert data["total_gross_amount"] > 0
    assert data["total_net_amount"] > 0

    # Verifica cruzamento de horas extras e faltas nos records
    records = data["records"]
    assert any(r["overtime_hours"] > 0 for r in records)
    assert any(r["absent_days"] > 0 for r in records)

    # Consulta listagem de folhas calculadas
    list_resp = client.get("/api/v1/hr/payroll/records?reference_month=2026-11")
    assert list_resp.status_code == 200
    list_data = list_resp.json()
    assert list_data["total_records"] >= 2

