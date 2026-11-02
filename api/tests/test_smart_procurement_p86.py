"""
Testes de Integração e Segurança para o Prompt 86 (Smart Procurement):
1. Trava Human-in-the-Loop em /api/v1/procurement/parse-quote (Zero DB write automático)
2. Confirmação humana explícita em /api/v1/procurement/requests/{id}/quotes/confirm
3. AI Advisor consultivo (não bloqueante) em /api/v1/procurement/advisor
4. Compras Diretas ("Comprinhas") com recibo fotográfico e Matriz de Responsabilidade
"""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_parse_quote_enforces_human_in_the_loop_draft_only():
    payload = {
        "request_id": "a1111111-1111-1111-1111-111111111111",
        "source": "WHATSAPP_WEBHOOK",
        "raw_text": "Saint-Gobain Cerâmicas\nUnitário R$ 174,50 | Total R$ 31.410,00 | Entrega 4 dias úteis | PIX",
    }
    resp = client.post("/api/v1/procurement/parse-quote", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "DRAFT_PENDING_HUMAN_REVIEW"
    assert data["persisted_in_database"] is False
    assert data["requires_human_confirmation"] is True
    assert data["draft_quote"]["supplier_name"] == "Saint-Gobain Cerâmicas"
    assert data["draft_quote"]["unit_price"] == 174.50
    assert data["draft_quote"]["total_amount"] == 31410.00


def test_confirm_human_verified_quote_persists_after_review():
    req_id = "a1111111-1111-1111-1111-111111111111"
    payload = {
        "supplier_name": "Saint-Gobain Cerâmicas (Validado)",
        "unit_price": 174.00,
        "total_amount": 31320.00,
        "delivery_days": 4,
        "payment_terms": "À Vista PIX",
        "is_winner": False,
        "justification": "Conferido pelo engenheiro responsável",
    }
    resp = client.post(f"/api/v1/procurement/requests/{req_id}/quotes/confirm", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["success"] is True
    assert data["persisted_in_database"] is True
    assert data["human_verified"] is True


def test_ai_advisor_returns_historical_benchmark_and_suppliers():
    resp = client.get("/api/v1/procurement/advisor?query=Porcelanato+120x120")
    assert resp.status_code == 200
    data = resp.json()
    assert data["non_blocking"] is True
    assert data["best_historical_price"] > 0
    assert len(data["suggested_suppliers"]) >= 3


def test_direct_purchases_with_receipt_and_dual_payables():
    payload = {
        "description": "10 Discos de Corte Diamantado Bosch (Urgência Obra)",
        "supplier_name": "Casa do Construtor",
        "total_amount": 490.00,
        "payment_method": "PIX",
        "responsibility": "CLIENT_REIMBURSEMENT",
        "receipt_photo_url": "cupom_fiscal_discos.jpg",
    }
    resp = client.post("/api/v1/procurement/direct-purchases", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["success"] is True
    assert "CD-" in data["item"]["direct_code"]
    assert data["item"]["responsibility"] == "CLIENT_REIMBURSEMENT"


def test_parse_quote_infers_engineering_category_automatically_p87():
    payload = {
        "request_id": "c3333333-3333-3333-3333-333333333333",
        "source": "WHATSAPP_TEXT_PASTE",
        "raw_text": "Prysmian Cabos e Disjuntores DIN | Unitário R$ 408,00 | Total R$ 18.360,00 | 3 dias úteis",
    }
    resp = client.post("/api/v1/procurement/parse-quote", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["persisted_in_database"] is False
    assert data["draft_quote"]["category"] == "ELÉTRICA"
    assert len(data["draft_quote"]["categorized_items"]) >= 1
    assert data["draft_quote"]["categorized_items"][0]["category"] == "ELÉTRICA"


def test_costs_by_category_curva_abc_p87():
    resp = client.get("/api/v1/procurement/costs-by-category")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_project_spend"] > 0
    assert len(data["categories"]) >= 3
    first_cat = data["categories"][0]
    assert "category" in first_cat
    assert "total_spent" in first_cat
    assert "percentage" in first_cat
    assert first_cat["abc_class"] in ("A", "B", "C")


def test_quotation_map_pdf_groups_by_category_and_subtotals_p87():
    req_id = "a1111111-1111-1111-1111-111111111111"
    resp = client.get(f"/api/v1/procurement/requests/{req_id}/quotation-map/pdf")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content.startswith(b"%PDF")


