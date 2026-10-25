import sys
import os
from decimal import Decimal
from typing import Any

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.subcontract_compliance_service import (
    SubcontractComplianceService,
    ComplianceBlockedException,
)


def test_compliance_audit_missing_documents():
    """Valida bloqueio quando faltam documentos obrigatórios."""
    documents = [
        {"document_type": "GFIP", "is_verified": True},
    ]
    result = SubcontractComplianceService.audit_measurement_compliance(documents)
    assert result["is_compliant"] is False
    assert "CND" in result["missing_documents"]
    assert "FGTS" in result["missing_documents"]


def test_compliance_audit_unverified_documents():
    """Valida bloqueio quando os documentos existem mas não foram auditados."""
    documents = [
        {"document_type": "GFIP", "is_verified": True},
        {"document_type": "CND", "is_verified": False},
        {"document_type": "FGTS", "is_verified": True},
    ]
    result = SubcontractComplianceService.audit_measurement_compliance(documents)
    assert result["is_compliant"] is False
    assert "CND" in result["unverified_documents"]


def test_compliance_audit_approved():
    """Valida aprovação quando GFIP, CND e FGTS estão todos verificados."""
    documents = [
        {"document_type": "GFIP", "is_verified": True},
        {"document_type": "CND", "is_verified": True},
        {"document_type": "FGTS", "is_verified": True},
    ]
    result = SubcontractComplianceService.audit_measurement_compliance(documents)
    assert result["is_compliant"] is True
    assert len(result["missing_documents"]) == 0
    assert len(result["unverified_documents"]) == 0


def test_tax_and_technical_withholdings_regular_supplier():
    """Valida cálculo de retenções para fornecedor convencional (INSS 11% + ISS 5% + Retenção 5%)."""
    res = SubcontractComplianceService.calculate_tax_and_technical_withholdings(
        measured_value=Decimal("20000.0000"),
        technical_retention_percentage=Decimal("0.0500"), # 5%
        supplier_tax_regime="LUCRO_PRESUMIDO",
        custom_iss_rate=Decimal("0.0500"), # 5%
        custom_inss_rate=Decimal("0.1100"), # 11%
    )
    assert res["measured_value"] == Decimal("20000.0000")
    assert res["technical_retention_amount"] == Decimal("1000.0000") # 5%
    assert res["inss_retention_amount"] == Decimal("2200.0000") # 11%
    assert res["iss_retention_amount"] == Decimal("1000.0000") # 5%
    assert res["tax_withholding_amount"] == Decimal("3200.0000")
    # Líquido = 20000 - 1000 - 2200 - 1000 = 15800
    assert res["net_payable_amount"] == Decimal("15800.0000")


def test_tax_and_technical_withholdings_mei_supplier():
    """Valida que terceirizado MEI recebe Bypass Fiscal de INSS e ISS na fonte."""
    res = SubcontractComplianceService.calculate_tax_and_technical_withholdings(
        measured_value=Decimal("20000.0000"),
        technical_retention_percentage=Decimal("0.0500"), # 5%
        supplier_tax_regime="MEI",
    )
    assert res["measured_value"] == Decimal("20000.0000")
    assert res["technical_retention_amount"] == Decimal("1000.0000") # 5% garantia
    assert res["inss_retention_amount"] == Decimal("0.0000") # Isento no MEI
    assert res["iss_retention_amount"] == Decimal("0.0000") # Isento no MEI
    assert res["tax_withholding_amount"] == Decimal("0.0000")
    # Líquido = 20000 - 1000 = 19000
    assert res["net_payable_amount"] == Decimal("19000.0000")


def test_enforce_compliance_blocks_when_not_compliant():
    """Testa que a trava financeira bloqueia a geração do Contas a Pagar."""
    subcontract = {
        "tenant_id": "0192e2b3-57a4-7935-86b2-0941ba9e7428",
        "supplier_id": "0192e2b3-57a4-7935-86b2-0941ba9e7429",
        "project_id": None,
        "contract_number": "SUB-001",
        "technical_retention_percentage": 0.05,
    }
    sub_measurement = {
        "id": "0192e2b3-57a4-7935-86b2-0941ba9e7430",
        "measured_value": 10000.0,
        "measurement_number": 1,
    }
    # Sem documentos
    documents = []

    try:
        SubcontractComplianceService.enforce_compliance_and_prepare_financial_entry(
            subcontract=subcontract,
            sub_measurement=sub_measurement,
            documents=documents,
        )
        assert False, "Deveria ter lançado ComplianceBlockedException"
    except ComplianceBlockedException as exc:
        assert exc.status_code == 422
        detail_data: Any = exc.detail
        assert isinstance(detail_data, dict)
        assert detail_data.get("error") == "COMPLIANCE_LOCK_ACTIVE"


def test_farol_green_pagamentos_menor_ou_igual_medicao():
    """Valida Farol GREEN quando total_paid <= total_measured."""
    # Contrato 100k, Medido 40k, Pago 35k -> GREEN
    res = SubcontractComplianceService.calculate_risk_traffic_light(
        contract_value=Decimal("100000.00"),
        total_paid=Decimal("35000.00"),
        total_measured=Decimal("40000.00"),
    )
    assert res["risk_status"] == "GREEN"
    assert res["financial_exposure"] == Decimal("0.0000")


def test_farol_yellow_pagamentos_maior_medicao_mas_abaixo_80_porcento():
    """Valida Farol YELLOW quando total_paid > total_measured, porém total_paid < 80% do contrato."""
    # Contrato 100k, Medido 40k, Pago 60k (60k < 80k) -> YELLOW
    res = SubcontractComplianceService.calculate_risk_traffic_light(
        contract_value=Decimal("100000.00"),
        total_paid=Decimal("60000.00"),
        total_measured=Decimal("40000.00"),
    )
    assert res["risk_status"] == "YELLOW"
    assert res["financial_exposure"] == Decimal("20000.0000")


def test_farol_red_pagamentos_maior_medicao_e_acima_80_porcento():
    """Valida Farol RED quando total_paid > total_measured E total_paid >= 80% do contrato."""
    # Contrato 100k, Medido 40k, Pago 85k (85k >= 80k) -> RED
    res = SubcontractComplianceService.calculate_risk_traffic_light(
        contract_value=Decimal("100000.00"),
        total_paid=Decimal("85000.00"),
        total_measured=Decimal("40000.00"),
    )
    assert res["risk_status"] == "RED"
    assert res["financial_exposure"] == Decimal("45000.0000")


if __name__ == "__main__":
    test_compliance_audit_missing_documents()
    test_compliance_audit_unverified_documents()
    test_compliance_audit_approved()
    test_tax_and_technical_withholdings_regular_supplier()
    test_tax_and_technical_withholdings_mei_supplier()
    test_enforce_compliance_blocks_when_not_compliant()
    test_farol_green_pagamentos_menor_ou_igual_medicao()
    test_farol_yellow_pagamentos_maior_medicao_mas_abaixo_80_porcento()
    test_farol_red_pagamentos_maior_medicao_e_acima_80_porcento()
    print("Todos os testes de test_subcontracts_compliance.py passaram com sucesso!")

