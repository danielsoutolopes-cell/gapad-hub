import pytest
from uuid import uuid4
from decimal import Decimal
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app

client = TestClient(app)

TENANT_ID = "7ffdf475-b337-4282-ae1f-3f8056394334"

def test_parse_extras_from_whatsapp_text_with_negotiation_alert():
    """Testa decodificação de texto de WhatsApp com cálculo de alerta de negociação contra média histórica."""
    raw_whatsapp = """
    Fala mestre, segue os extras de elétrica desse mês:
    - 10 caixinhas 4x2 a 65 reais cada = 650
    - 4 luminarias led a 150 cada = 600
    Total fecha em 1250 valeu
    """

    payload = {
        "raw_text": raw_whatsapp,
    }

    with patch("httpx.AsyncClient.get") as mock_get:
        # Mock do dicionário de preços histórico do tenant
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [
            {
                "id": str(uuid4()),
                "standardized_service_name": "caixinha 4x2",
                "average_unit_price": "45.00",
                "highest_unit_price": "55.00",
                "sample_count": 8,
            },
            {
                "id": str(uuid4()),
                "standardized_service_name": "luminaria led",
                "average_unit_price": "160.00",
                "highest_unit_price": "180.00",
                "sample_count": 4,
            }
        ]
        mock_get.return_value = mock_resp

        response = client.post(
            "/api/v1/finance/payables/subcontracts/parse-extras",
            json=payload,
            headers={"Authorization": "Bearer test-token", "X-Tenant-Id": TENANT_ID},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["items"]) >= 2
        assert data["has_negotiation_alerts"] is True

        # Verifica o item de caixinha 4x2 cobrado a 65 vs media 45
        caixinha_item = next(
            (
                i
                for i in data["items"]
                if "caixinha" in (i.get("service") or "").lower()
                or "caixa" in (i.get("service") or "").lower()
                or "caixinha" in (i.get("standardized_service") or "").lower()
                or "caixa" in (i.get("standardized_service") or "").lower()
            ),
            None,
        )
        assert caixinha_item is not None
        assert Decimal(str(caixinha_item["unit_price"])) == Decimal("65.00")
        assert Decimal(str(caixinha_item["historical_average"])) == Decimal("45.00")
        assert caixinha_item["negotiation_alert"] is True
        assert caixinha_item["price_variance_percent"] > 0

