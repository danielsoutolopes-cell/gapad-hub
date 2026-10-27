import sys
import os

# Garante suporte a UTF-8 no Windows
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient

# Inclusão da pasta api no sys.path
api_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "api"))
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from app.main import app

client = TestClient(app)


def test_billing_webhook_payment_succeeded_auto_provisioning():
    """Valida o provisionamento automático de novo tenant e usuário Admin no evento payment.succeeded."""
    payload = {
        "event": "payment.succeeded",
        "data": {
            "customer_name": "Construtora Horizonte Ltda",
            "customer_cnpj": "12.345.678/0001-95",
            "customer_email": "diretoria@horizonte.com.br",
            "plan_tier": "pro",
            "tax_regime": "simples_nacional",
        },
    }

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get, \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        # Mock de empresa ainda não existente
        mock_get_resp = MagicMock()
        mock_get_resp.status_code = 200
        mock_get_resp.json.return_value = []
        mock_get.return_value = mock_get_resp

        # Mock de criação de empresa e usuário com sucesso
        mock_post_resp = MagicMock()
        mock_post_resp.status_code = 201
        mock_post_resp.json.return_value = [{"id": "11111111-2222-3333-4444-555555555555"}]
        mock_post.return_value = mock_post_resp

        response = client.post("/api/v1/billing/webhook", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "TENANT_PROVISIONED"
        assert data["company"] == "Construtora Horizonte Ltda"
        assert data["role"] == "admin"
        assert "tenant_id" in data


def test_billing_webhook_ignored_event():
    """Valida que eventos diferentes de payment.succeeded são ignorados sem provisionamento indevido."""
    payload = {
        "event": "subscription.canceled",
        "data": {
            "customer_name": "Construtora Teste",
            "customer_cnpj": "00.000.000/0001-00",
        },
    }
    response = client.post("/api/v1/billing/webhook", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "IGNORED"
