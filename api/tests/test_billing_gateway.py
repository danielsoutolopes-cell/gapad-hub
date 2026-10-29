"""
Testes unitários e de integração para o Router de Billing e Gateway PF Asaas.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_subscribe_endpoint_pix():
    payload = {
        "customer_name": "Daniel Souto Lopes",
        "cpf_cnpj": "123.456.789-00",
        "email": "daniel@construtora.com.br",
        "phone": "11987654321",
        "plan_tier": "pro",
        "billing_type": "PIX",
        "cycle": "MONTHLY",
        "selected_modules": ["core_fiscal", "rh", "suprimentos"],
    }
    response = client.post("/api/v1/billing/subscribe", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["billing_type"] == "PIX"
    assert "pix_copy_paste" in data
    assert data["pix_copy_paste"] is not None
    assert "gateway_customer_id" in data


def test_billing_webhook_payment_confirmed():
    payload = {
        "event": "PAYMENT_CONFIRMED",
        "payment": {
            "id": "pay_test_123",
            "customer": "cus_12345678",
            "value": 169.00,
            "billingType": "PIX",
        },
    }
    response = client.post("/api/v1/billing/webhook", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "PROCESSED"
    assert data["details"]["plan_status"] == "ACTIVE"


def test_billing_webhook_payment_overdue():
    payload = {
        "event": "PAYMENT_OVERDUE",
        "payment": {
            "id": "pay_overdue_456",
            "customer": "cus_12345678",
            "value": 169.00,
        },
    }
    response = client.post("/api/v1/billing/webhook", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "PROCESSED"
    assert data["details"]["plan_status"] == "PAST_DUE"
