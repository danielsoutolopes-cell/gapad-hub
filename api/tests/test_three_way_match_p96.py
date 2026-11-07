"""
=============================================================================
GADAP Hub - Testes Automatizados 3-Way Match & Auditoria Fiscal (Prompt 96)
=============================================================================
Testa o cruzamento PO vs. GR vs. NF-e XML:
1. 100% Match -> Status MATCHED, Contas a Pagar APPROVED
2. Divergência de Quantidade -> Status QUANTITY_DIVERGENCE, Contas a Pagar BLOCKED
3. Auditoria Fiscal -> Retorna colunas comparativas PO / GR / NF-e
4. Resolução APPROVE_WITH_CREDIT -> Libera pagamento, status MATCHED_WITH_CREDIT,
   e injeta automaticamente o crédito em supplier_credits.
=============================================================================
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_3way_match_audit_divergent():
    """Verifica que a rota de auditoria retorna as 3 colunas e detecta divergência."""
    response = client.get(
        "/api/v1/finance/reconciliation/match/inv-001/audit",
        headers={"x-tenant-id": "11111111-1111-1111-1111-111111111111"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["can_approve_with_credit"] is True
    assert data["financial_credit_potential"] == 800.00

    audit = data["audit"]
    assert audit["status"] == "QUANTITY_DIVERGENCE"
    assert audit["accounts_payable_status"] == "BLOCKED"
    assert len(audit["items"]) == 1

    item = audit["items"][0]
    assert item["purchased_po"]["quantity"] == 80.0
    assert item["received_gr"]["quantity"] == 60.0
    assert item["invoiced_nfe"]["quantity"] == 80.0
    assert item["financial_difference"] == 800.00


def test_get_3way_match_audit_matched():
    """Verifica auditoria de uma nota fiscal 100% reconciliada."""
    response = client.get(
        "/api/v1/finance/reconciliation/match/inv-002/audit",
        headers={"x-tenant-id": "11111111-1111-1111-1111-111111111111"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["can_approve_with_credit"] is False
    assert data["financial_credit_potential"] == 0.00

    audit = data["audit"]
    assert audit["status"] == "MATCHED"
    assert audit["accounts_payable_status"] == "APPROVED"


def test_auto_match_reconciliation_trigger():
    """Verifica auto-match de reconciliação."""
    response = client.post(
        "/api/v1/finance/reconciliation/match/inv-002",
        json={"action": "AUTO_MATCH"},
        headers={"x-tenant-id": "11111111-1111-1111-1111-111111111111"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["reconciliation_status"] == "MATCHED"
    assert data["accounts_payable_status"] == "APPROVED"


def test_resolve_divergence_approve_with_credit():
    """
    Regra de Ouro (Prompt 95 + 96):
    Ao aprovar com crédito, o boleto/título no Contas a Pagar é DESTRAVADO (APPROVED),
    o status vira MATCHED_WITH_CREDIT e um crédito é gerado na Conta Corrente do Fornecedor.
    """
    response = client.post(
        "/api/v1/finance/reconciliation/match/inv-001",
        json={
            "action": "APPROVE_WITH_CREDIT",
            "notes": "Acordo comercial com distribuidora Votoran para abater R$ 800 no próximo pedido.",
        },
        headers={"x-tenant-id": "11111111-1111-1111-1111-111111111111"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["reconciliation_status"] == "MATCHED_WITH_CREDIT"
    assert data["accounts_payable_status"] == "APPROVED"
    assert data["credit_amount"] == 800.00
    assert data["credit_id"] is not None

    # Consulta novamente a auditoria para garantir persistência do status
    audit_res = client.get(
        "/api/v1/finance/reconciliation/match/inv-001/audit",
        headers={"x-tenant-id": "11111111-1111-1111-1111-111111111111"},
    )
    audit_data = audit_res.json()["audit"]
    assert audit_data["status"] == "MATCHED_WITH_CREDIT"
    assert audit_data["accounts_payable_status"] == "APPROVED"
