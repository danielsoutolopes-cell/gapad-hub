"""
=============================================================================
GADAP Hub - Testes Automatizados Autorização de Faturamento & Reconciliação
Fiscal com Bypass Financeiro (Prompt 98)
=============================================================================
Testa:
1. Geração de PDF de Autorização de Faturamento Direto em CLIENT_DIRECT.
2. Reconciliação Fiscal 3-Way Match em CLIENT_DIRECT:
   - Se 100% compatível -> accounts_payable_status = BYPASS_CLIENT_DIRECT e client_billing_status = AUDITED_MATCHED.
   - Se divergente (quantidade a maior) -> status = QUANTITY_DIVERGENCE, bloqueio de boleto.
   - Resolução APPROVE_WITH_CREDIT -> Libera envio ao cliente, gera saldo credor na obra e atualiza client_billings.
=============================================================================
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.direct_billing_auth_pdf_generator import DirectBillingAuthPdfGenerator

client = TestClient(app)


def test_direct_billing_auth_pdf_generation():
    """Gera o PDF de Autorização de Faturamento Direto com CNPJ do Cliente, Fornecedor e Comprador."""
    pdf_bytes = DirectBillingAuthPdfGenerator.generate_pdf(
        order_data={"id": "OC-DIR-98", "order_number": "OC-98-001", "payment_terms": "28 DDL"},
        client_data={"name": "Cliente Teste S.A.", "document": "12.345.678/0001-99", "project_name": "Obra Alfa"},
        supplier_data={"name": "Fornecedor Alfa Materiais", "document": "98.765.432/0001-11"},
        buyer_data={"name": "Carlos Comprador", "role": "Procurement Lead", "email": "carlos@gadap.com.br"},
        items=[
            {"description": "Aço CA-50 10mm", "unit": "BR", "quantity": 100, "unit_price": 80.0, "subtotal": 8000.0}
        ],
    )
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF")


def test_download_direct_billing_auth_pdf_endpoint():
    """Rota GET do PDF de autorização formal."""
    response = client.get(
        "/api/v1/procurement/requests/req-98-003/direct-billing-auth/pdf",
        headers={"x-tenant-id": "11111111-1111-1111-1111-111111111111"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert len(response.content) > 1000


def test_reconciliation_3way_client_direct_quantity_divergence():
    """Verifica que compra CLIENT_DIRECT com divergência de quantidade bloqueia boleto."""
    response = client.post(
        "/api/v1/finance/reconciliation/match/inv-003",
        json={"action": "AUTO_MATCH"},
        headers={"x-tenant-id": "11111111-1111-1111-1111-111111111111"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["responsibility"] == "CLIENT_DIRECT"
    assert data["reconciliation_status"] == "QUANTITY_DIVERGENCE"
    assert data["accounts_payable_status"] == "BYPASS_CLIENT_DIRECT"
    assert data["client_billing_status"] == "QUANTITY_DIVERGENCE"
    assert data["financial_divergence_amount"] == 3000.00


def test_reconciliation_3way_client_direct_approve_with_credit():
    """
    Aprovar boleto com divergência em CLIENT_DIRECT:
    - Destrava envio ao cliente (APPROVED_WITH_CREDIT).
    - Aplica o bypass financeiro (sem contas a pagar da construtora).
    - Injeta crédito de R$ 3.000 exclusivo para aquela obra.
    """
    response = client.post(
        "/api/v1/finance/reconciliation/match/inv-003",
        json={
            "action": "APPROVE_WITH_CREDIT",
            "notes": "Acordo comercial: loja concedeu crédito de R$ 3.000 exclusivo para a Obra Jardins.",
        },
        headers={"x-tenant-id": "11111111-1111-1111-1111-111111111111"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["responsibility"] == "CLIENT_DIRECT"
    assert data["reconciliation_status"] == "MATCHED_WITH_CREDIT"
    assert data["accounts_payable_status"] == "BYPASS_CLIENT_DIRECT"
    assert data["client_billing_status"] == "APPROVED_WITH_CREDIT"
    assert data["credit_amount"] == 3000.00
    assert data["supplier_credit_generated"] is True

