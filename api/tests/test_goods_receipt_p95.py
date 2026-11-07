"""
=============================================================================
Testes de Goods Receipt, Entregas Parciais e Supplier Credits (PROMPT 95)
=============================================================================
"""

import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_list_pending_deliveries_pwa():
    """Valida a listagem de materiais aguardados no canteiro para o PWA."""
    proj_id = "550e8400-e29b-41d4-a716-446655440020"
    resp = client.get(f"/api/v1/logistics/deliveries/pending/{proj_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert len(data["deliveries"]) >= 1
    first_del = data["deliveries"][0]
    assert "items" in first_del
    assert len(first_del["items"]) >= 1


def test_receive_delivery_partial_generates_supplier_credit_and_keeps_payable_intact():
    """
    Simula uma entrega parcial no canteiro:
    - Esperado: 80 sacos de cimento a R$ 40,00 (Total R$ 3.200,00)
    - Recebido real: 60 sacos (Faltam 20 sacos = R$ 800,00 de diferença)
    - Validação:
      1. Status do Goods Receipt deve ser PARTIAL.
      2. Saldo credor de R$ 800,00 gerado automaticamente em supplier_credits.
      3. Contas a Pagar permanece INTACT_AND_APPROVED para não gerar bloqueio fiscal.
      4. Alerta interno gerado para o setor de compras.
    """
    proj_id = str(uuid4())
    sup_id = str(uuid4())
    sup_name = "Votoran Cimentos Brasil S.A."

    payload = {
        "project_id": proj_id,
        "purchase_order_id": "PO-95-001",
        "supplier_id": sup_id,
        "supplier_name": sup_name,
        "signature_or_photo_url": "https://storage.gadap.com.br/canhotos/canhoto_entrega_001.jpg",
        "notes": "Caminhão descarregou apenas 60 sacos; os outros 20 estavam rasgados no caminhão.",
        "items": [
            {
                "item_description": "Cimento Portland CP II-E-32 50kg",
                "expected_quantity": 80.0,
                "actual_received_quantity": 60.0,
                "unit": "SC",
                "unit_price": 40.00,
            }
        ],
    }

    resp = client.post("/api/v1/logistics/deliveries/receive", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["success"] is True
    assert data["status"] == "PARTIAL"
    assert data["divergence_credit_amount"] == 800.00
    assert data["supplier_credit_generated"] is True
    assert data["accounts_payable_status"] == "INTACT_AND_APPROVED"
    assert "ALERTA DE DIVERGÊNCIA" in data["internal_procurement_alert"]

    # Consulta saldo credor do fornecedor
    c_resp = client.get(f"/api/v1/logistics/suppliers/{sup_id}/credits")
    assert c_resp.status_code == 200
    c_data = c_resp.json()
    assert c_data["has_available_credit"] is True
    assert c_data["total_available_credit"] == 800.00


def test_receive_delivery_full_generates_no_credit():
    """Valida entrega 100% integral sem gerar saldo credor."""
    payload = {
        "project_id": str(uuid4()),
        "purchase_order_id": "PO-95-002",
        "supplier_id": str(uuid4()),
        "supplier_name": "Tigre Tubos e Conexões",
        "items": [
            {
                "item_description": "Tubo PVC Esgoto 100mm 6m",
                "expected_quantity": 30.0,
                "actual_received_quantity": 30.0,
                "unit": "BR",
                "unit_price": 60.00,
            }
        ],
    }
    resp = client.post("/api/v1/logistics/deliveries/receive", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "FULL"
    assert data["divergence_credit_amount"] == 0.00
    assert data["supplier_credit_generated"] is False


def test_supplier_credits_summary_for_office():
    """Valida o endpoint de resumo executivo da Conta Corrente de Fornecedores."""
    resp = client.get("/api/v1/logistics/credits/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "total_network_credit" in data
    assert "items" in data

