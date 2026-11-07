"""
=============================================================================
GADAP Hub - Testes Automatizados Entregas Parciais & Créditos Isolados por Obra (Prompt 97)
=============================================================================
Testa o isolamento rigoroso da Matriz de Responsabilidade:
1. Recebimento parcial com responsibility = 'CLIENT_DIRECT' gera crédito com
   client_id_owner e project_id_owner vinculados.
2. Consulta de créditos com project_id:
   - Retorna saldo se project_id coincidir.
   - Retorna R$ 0 se project_id for de outra obra (bloqueio de uso cruzado).
3. Sumário com agrupamento em accordion por obras (by_projects).
=============================================================================
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

PROJ_OBRA_A = "550e8400-e29b-41d4-a716-446655440020"
PROJ_OBRA_B = "550e8400-e29b-41d4-a716-446655440030"
CLIENT_A = "550e8400-e29b-41d4-a716-446655440099"
SUPPLIER_VOTORAN = "550e8400-e29b-41d4-a716-446655440001"


def test_receive_partial_delivery_client_direct_creates_isolated_credit():
    """Entrega parcial faturada no CNPJ do cliente gera crédito com tranca dupla de isolamento."""
    payload = {
        "project_id": PROJ_OBRA_A,
        "client_id": CLIENT_A,
        "purchase_order_id": "PO-TEST-P97-01",
        "supplier_id": SUPPLIER_VOTORAN,
        "supplier_name": "Distribuidora de Cimento Votoran Ltda",
        "responsibility": "CLIENT_DIRECT",
        "project_name": "Obra Residencial Jardins Lorena",
        "client_name": "Residencial Jardins Incorporadora",
        "items": [
            {
                "item_description": "Cimento CP II (Saco 50kg)",
                "expected_quantity": 100.0,
                "actual_received_quantity": 80.0,
                "unit": "SC",
                "unit_price": 50.00,
            }
        ],
    }

    response = client.post(
        "/api/v1/logistics/deliveries/receive",
        json=payload,
        headers={"x-tenant-id": "11111111-1111-1111-1111-111111111111"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["status"] == "PARTIAL"
    assert data["divergence_credit_amount"] == 1000.00
    assert data["supplier_credit_generated"] is True

    credit = data["supplier_credit"]
    assert credit["project_id_owner"] == PROJ_OBRA_A
    assert credit["client_id_owner"] == CLIENT_A
    assert credit["responsibility"] == "CLIENT_DIRECT"
    assert credit["credit_amount"] == 1000.00


def test_get_credits_cross_project_lockout():
    """
    Restrição de Uso:
    - Se consultar com project_id da Obra A: deve listar o crédito retido.
    - Se consultar com project_id da Obra B: NÃO deve listar o crédito do cliente (bloqueio cruzado).
    """
    # Consulta na Obra A (mesmo projeto do crédito)
    res_a = client.get(
        f"/api/v1/suppliers/{SUPPLIER_VOTORAN}/credits?project_id={PROJ_OBRA_A}",
        headers={"x-tenant-id": "11111111-1111-1111-1111-111111111111"},
    )
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert data_a["has_available_credit"] is True
    assert data_a["total_available_credit"] >= 1000.00

    # Consulta na Obra B (obra diferente da faturada pelo cliente)
    res_b = client.get(
        f"/api/v1/suppliers/{SUPPLIER_VOTORAN}/credits?project_id={PROJ_OBRA_B}",
        headers={"x-tenant-id": "11111111-1111-1111-1111-111111111111"},
    )
    assert res_b.status_code == 200
    data_b = res_b.json()
    # Não deve vazar o crédito retido da Obra A
    client_direct_credits_in_b = [
        c for c in data_b["credits"]
        if c.get("responsibility") == "CLIENT_DIRECT" and c.get("project_id_owner") == PROJ_OBRA_A
    ]
    assert len(client_direct_credits_in_b) == 0


def test_credits_summary_includes_projects_breakdown():
    """O sumário global deve retornar o detalhamento por obras para o accordion da tela."""
    response = client.get(
        "/api/v1/logistics/credits/summary",
        headers={"x-tenant-id": "11111111-1111-1111-1111-111111111111"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "summary" in data

    supplier_votoran = next(
        (s for s in data["summary"] if s["supplier_id"] == SUPPLIER_VOTORAN),
        None,
    )
    assert supplier_votoran is not None
    assert "by_projects" in supplier_votoran
    assert len(supplier_votoran["by_projects"]) >= 1

