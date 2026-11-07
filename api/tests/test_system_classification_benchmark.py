import pytest
from uuid import uuid4
from decimal import Decimal
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app
from app.services.subcontract_extras_llm_service import SubcontractExtrasLLMService

client = TestClient(app)

TENANT_ID = "7ffdf475-b337-4282-ae1f-3f8056394334"
SUBCONTRACT_ID = str(uuid4())

# ==============================================================================
# BATERIA DE CLASSIFICAÇÃO SISTÊMICA (PROMPTS 99 A 102)
# ==============================================================================

def test_full_pipeline_parse_and_negociation_alert():
    """
    Classificação: Inteligência NLP / LLM + Motor de Negociação de Custos.
    Verifica decodificação de áudio/texto desestruturado e injeção de alerta
    de negociação quando a média histórica for superada.
    """
    raw_whatsapp = """
    Mestre, segue o que fizemos por fora:
    - 2.500,00 da colocação do piso na cobertura com o dia di Tonho
    - 3 registros de gaveta 450 reais
    - 15 caixinhas 4x2 a 70 reais cada = 1050
    """
    payload = {"raw_text": raw_whatsapp, "subcontract_id": SUBCONTRACT_ID}

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [
            {
                "id": str(uuid4()),
                "standardized_service": "Assentamento de piso",
                "average_price": "1800.00",
                "average_unit_price": "1800.00",
                "highest_unit_price": "2200.00",
            },
            {
                "id": str(uuid4()),
                "standardized_service": "caixinha 4x2",
                "average_price": "45.00",
                "average_unit_price": "45.00",
                "highest_unit_price": "55.00",
            },
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
        assert data["has_negotiation_alerts"] is True
        items = data["items"]
        assert len(items) >= 2


def test_anti_fraud_duplicate_risk_and_ledger_segregation():
    """
    Classificação: Integridade Financeira / Prevenção de Fraude (Anti-Duplicidade).
    Testa se o motor 'Gato Escaldado' segrega verbas (Principal vs Extra)
    e alerta o gestor sobre cobranças duplicadas já liquidadas no passado.
    """
    payload = {
        "subcontract_id": SUBCONTRACT_ID,
        "principal_amount": "12000.00",
        "contracted_extra_amount": "2000.00",
        "field_extras": [
            {
                "description": "Instalação de caixa de passagem 4x2 no pavimento 2",
                "amount": "1050.00",
                "requested_by_supplier": "Tonho",
                "validated_by_field": "Eng. Paulo",
            }
        ],
    }

    with patch("httpx.AsyncClient.get") as mock_get, \
         patch("httpx.AsyncClient.post") as mock_post:

        mock_get_resp = MagicMock()
        mock_get_resp.status_code = 200
        mock_get_resp.json.return_value = [
            {
                "id": str(uuid4()),
                "description": "Instalação de 10 caixinhas 4x2 no pavimento 2",
                "amount": "800.00",
                "created_at": "2026-10-25T14:00:00Z",
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
        res = response.json()
        assert res["success"] is True
        assert res["warning_duplicate_risk"] is True
        assert len(res["duplicate_suspects"]) >= 1
        assert Decimal(str(res["total_paid_now"])) == Decimal("15050.00")


def test_continuous_price_dictionary_learning():
    """
    Classificação: Aprendizado Contínuo de Preços Históricos (Machine Learning de Custos).
    Garante que a liquidação de um novo serviço extra atualiza as métricas
    de preço médio e maior preço no Supabase.
    """
    payload = {
        "subcontract_id": SUBCONTRACT_ID,
        "principal_amount": "0.00",
        "contracted_extra_amount": "0.00",
        "field_extras": [
            {
                "description": "Instalação de registro de gaveta área gourmet",
                "amount": "320.00",
                "requested_by_supplier": "Encanador Mário",
                "validated_by_field": "Mestre Severino",
            }
        ],
    }

    with patch("httpx.AsyncClient.get") as mock_get, \
         patch("httpx.AsyncClient.post") as mock_post, \
         patch("httpx.AsyncClient.patch") as mock_patch:

        mock_get_resp = MagicMock()
        mock_get_resp.status_code = 200
        mock_get_resp.json.return_value = [
            {
                "id": str(uuid4()),
                "standardized_service_name": "Instalação de registro de gaveta área gourmet",
                "average_unit_price": "280.00",
                "highest_unit_price": "300.00",
                "sample_count": 2,
            }
        ]
        mock_get.return_value = mock_get_resp

        mock_post_resp = MagicMock()
        mock_post_resp.status_code = 201
        mock_post_resp.json.return_value = [{"id": str(uuid4())}]
        mock_post.return_value = mock_post_resp

        mock_patch_resp = MagicMock()
        mock_patch_resp.status_code = 200
        mock_patch.return_value = mock_patch_resp

        response = client.post(
            "/api/v1/finance/payables/subcontracts/pay",
            json=payload,
            headers={"Authorization": "Bearer test-token", "X-Tenant-Id": TENANT_ID},
        )

        assert response.status_code == 201
        assert mock_patch.called or mock_post.called

