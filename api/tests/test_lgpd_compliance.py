import pytest
from app.core.lgpd import (
    mask_cpf,
    mask_email,
    mask_phone,
    mask_cnpj,
    sanitize_employee_for_lgpd,
)
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_lgpd_masking_algorithms():
    """
    Testa os algoritmos de anonimização e mascaramento previstos no Art. 13 da LGPD.
    """
    # 1. CPF
    assert mask_cpf("123.456.789-01") == "123.***.***-01"
    assert mask_cpf("12345678901") == "123.***.***-01"
    assert mask_cpf("") == "***.***.***-**"
    assert mask_cpf(None) == "***.***.***-**"

    # 2. E-mail
    assert mask_email("carlos.silva@construtora.com.br") == "c***a@construtora.com.br"
    assert mask_email("rh@gadap.com.br") == "r***@gadap.com.br"
    assert mask_email(None) == "***@***.***"

    # 3. Telefone
    assert mask_phone("(11) 98765-4321") == "(11) 9****-**21"
    assert mask_phone("11987654321") == "(11) 9****-**21"
    assert mask_phone(None) == "(**) *****-****"

    # 4. CNPJ
    assert mask_cnpj("12.345.678/0001-90") == "12.***.***/0001-90"
    assert mask_cnpj(None) == "**.***.***/****-**"


def test_lgpd_employee_sanitization():
    """
    Colaborador listado deve ter CPF e telefone mascarados por padrão.
    """
    emp = {
        "id": "emp-10",
        "full_name": "Marcos Paulo Santos",
        "cpf": "456.789.123-45",
        "phone": "(11) 98765-4321",
        "base_salary": 4500.00,
    }
    sanitized = sanitize_employee_for_lgpd(emp, include_full_cpf=False)
    assert sanitized["cpf"] == "456.***.***-45"
    assert sanitized["cpf_masked"] == "456.***.***-45"
    assert sanitized["phone_masked"] == "(11) 9****-**21"

    # Se explicitamente autorizado pelo RH
    authorized = sanitize_employee_for_lgpd(emp, include_full_cpf=True)
    assert authorized["cpf"] == "456.789.123-45"
    assert authorized["cpf_masked"] == "456.***.***-45"


def test_lgpd_endpoints_governance():
    """
    Testa os endpoints da LGPD: solicitação de titular (Art. 18) e status de conformidade.
    """
    # 1. Solicitação do Titular
    req_payload = {
        "cpf": "123.456.789-00",
        "request_type": "ACCESS",
        "justification": "Solicitação de confirmação de dados cadastrais conforme Art. 18 da LGPD",
    }
    resp = client.post("/api/v1/governance/lgpd/subject-request", json=req_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["subject_cpf_masked"] == "123.***.***-00"
    assert data["status"] == "UNDER_ANALYSIS"
    assert data["deadline_days"] == 15

    # 2. Diagnóstico de Conformidade LGPD
    resp_diag = client.get("/api/v1/governance/lgpd/compliance-status")
    assert resp_diag.status_code == 200
    diag = resp_diag.json()
    assert diag["status"] == "COMPLIANT"
    assert diag["score_lgpd"] == 100.0
    assert "encryption_at_rest" in diag["security_safeguards"]
    assert "superadmin_privacy" in diag["security_safeguards"]
