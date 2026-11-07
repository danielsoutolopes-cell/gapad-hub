import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_hr_employees_import():
    payload = {
        "employees": [
            {
                "full_name": "Juliana Silveira",
                "cpf": "111.222.333-44",
                "role": "Engenheira de Segurança",
                "base_salary": 6500.0,
                "phone": "(11) 98888-7777",
                "current_project": "Residencial Jardins"
            },
            {
                "full_name": "Roberto Albuquerque",
                "cpf": "555.666.777-88",
                "role": "Técnico em Edificações",
                "base_salary": 3800.0,
                "phone": "(11) 97777-6666",
                "current_project": "Residencial Jardins"
            }
        ]
    }

    response = client.post("/api/v1/hr/employees/import", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["imported_count"] == 2
    assert len(data["imported_employees"]) == 2

    # Test duplicate CPF rejection
    response_dup = client.post("/api/v1/hr/employees/import", json=payload)
    assert response_dup.status_code == 201
    data_dup = response_dup.json()
    assert data_dup["imported_count"] == 0
    assert data_dup["skipped_count"] == 2
