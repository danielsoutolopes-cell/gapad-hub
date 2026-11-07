import pytest
from uuid import uuid4
from decimal import Decimal
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app

client = TestClient(app)

TENANT_ID = "7ffdf475-b337-4282-ae1f-3f8056394334"
SUBCONTRACT_ID = str(uuid4())

def test_pay_subcontract_clean_no_duplicates():
    """Testa pagamento segregado sem serviços extras suspeitos."""
    payload = {
        "subcontract_id": SUBCONTRACT_ID,
        "principal_amount": "9000.00",
        "contracted_extra_amount": "1000.00",
        "field_extras": [
            {
                "description": "Instalação de tomadas adicionais 220V",
                "amount": "350.00",
                "requested_by_supplier": "Mestre João",
                "validated_by_field": "Eng. Roberto",
            }
        ],
        "observation": "Pagamento quinzenal regular",
    }

    # Mock das requisições ao Supabase
    with patch("httpx.AsyncClient.get") as mock_get, \
         patch("httpx.AsyncClient.post") as mock_post:

        # Mock GET do histórico de extras (vazio ou serviços diferentes)
        mock_get_resp = MagicMock()
        mock_get_resp.status_code = 200
        mock_get_resp.json.return_value = [
            {
                "id": str(uuid4()),
                "description": "Pintura de rodapé em epóxi",
                "amount": "500.00",
                "created_at": "2026-10-15T10:00:00Z",
            }
        ]
        mock_get.return_value = mock_get_resp

        # Mock POST das transações e extras
        mock_post_resp = MagicMock()
        mock_post_resp.status_code = 201
        mock_post_resp.json.return_value = [{"id": str(uuid4()), "status": "APPROVED"}]
        mock_post.return_value = mock_post_resp

        response = client.post(
            "/api/v1/finance/payables/subcontracts/pay",
            json=payload,
            headers={"Authorization": "Bearer test-token", "X-Tenant-Id": TENANT_ID},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert data["warning_duplicate_risk"] is False
        assert len(data["duplicate_suspects"]) == 0
        assert Decimal(str(data["total_paid_now"])) == Decimal("10350.00")


def test_pay_subcontract_detects_duplicate_field_extra():
    """Testa algoritmo 'Gato Escaldado' detectando cobrança duplicada similar."""
    payload = {
        "subcontract_id": SUBCONTRACT_ID,
        "principal_amount": "5000.00",
        "contracted_extra_amount": "0.00",
        "field_extras": [
            {
                "description": "10 caixinhas 4x2 no pavimento 2",
                "amount": "800.00",
                "requested_by_supplier": "Eletricista Carlos",
                "validated_by_field": "Mestre Paulo",
            }
        ],
    }

    with patch("httpx.AsyncClient.get") as mock_get, \
         patch("httpx.AsyncClient.post") as mock_post:

        # Mock histórico com item muito similar
        mock_get_resp = MagicMock()
        mock_get_resp.status_code = 200
        mock_get_resp.json.return_value = [
            {
                "id": str(uuid4()),
                "description": "Instalação de 10 caixinhas 4x2 no pavimento 2",
                "amount": "800.00",
                "created_at": "2026-10-20T14:30:00Z",
            }
        ]
        mock_get.return_value = mock_get_resp

        mock_post_resp = MagicMock()
        mock_post_resp.status_code = 201
        mock_post_resp.json.return_value = [{"id": str(uuid4())}]
        mock_post.return_value = mock_post_resp

        response = client.post(
            "/api/v1/finance/payables/subcontracts/pay",
            json=payload,
            headers={"Authorization": "Bearer test-token", "X-Tenant-Id": TENANT_ID},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert data["warning_duplicate_risk"] is True
        assert len(data["duplicate_suspects"]) >= 1
        assert "10 caixinhas 4x2" in data["duplicate_suspects"][0]["description"]

