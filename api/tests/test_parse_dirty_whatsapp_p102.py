import pytest
from uuid import uuid4
from decimal import Decimal
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app

client = TestClient(app)

TENANT_ID = "7ffdf475-b337-4282-ae1f-3f8056394334"

def test_parse_dirty_whatsapp_slang_and_slur():
    """
    Testa decodificação de texto de WhatsApp com gírias e erros:
    '2.000,00. Da colocação do piso... com o dia di tonho'
    'registro da gurme'
    """
    raw_text = """
    Fala mestre segue:
    2.000,00. Da colocação do piso... com o dia di tonho
    registro da gurme 350 reais
    total fecha valeu
    """

    payload = {"raw_text": raw_text}

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [
            {
                "id": str(uuid4()),
                "standardized_service": "Instalação de registro de gaveta área gourmet",
                "average_price": "200.00",
                "average_unit_price": "200.00",
            },
            {
                "id": str(uuid4()),
                "standardized_service": "Assentamento de piso",
                "average_price": "1800.00",
                "average_unit_price": "1800.00",
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
        items = data["items"]
        assert len(items) >= 2

        # 1. Verifica item com ajudante Tonho
        piso_item = next((i for i in items if "piso" in i["standardized_service"].lower()), None)
        assert piso_item is not None
        assert "Tonho" in piso_item["notes"]
        assert Decimal(str(piso_item["total_line_price"])) == Decimal("2000.00")
        assert piso_item["negotiation_alert"] is True  # 2000 > 1800

        # 2. Verifica item "gurme" corrigido para Gourmet / registro
        gourmet_item = next((i for i in items if "gourmet" in i["standardized_service"].lower() or "registro" in i["standardized_service"].lower()), None)
        assert gourmet_item is not None
        assert Decimal(str(gourmet_item["total_line_price"])) == Decimal("350.00")
        assert gourmet_item["negotiation_alert"] is True  # 350 > 200
        assert Decimal(str(gourmet_item["historical_average"])) == Decimal("200.00")

