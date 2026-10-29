"""
Testes unitários e de integração para Logística de Canteiro e Portaria Digital (Prompt 81).
"""

from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

DUMMY_SIGNATURE = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


def test_build_transfer_pdf():
    from datetime import datetime, timezone
    from app.services.transfer_pdf_builder import build_transfer_term_pdf

    pdf_bytes = build_transfer_term_pdf(
        transfer_type="RECEIPT",
        project_name="Edifício Horizonte Teste",
        tenant_name="Intermack Construtora",
        carrier_name="João da Silva",
        carrier_document="123.456.789-00",
        license_plate="ABC1D23",
        description="100 sacos de cimento, 50 tubos PVC 100mm",
        signature_base64=DUMMY_SIGNATURE,
        geolocation={"latitude": -23.55052, "longitude": -46.633308, "accuracy": 10},
        created_at=datetime.now(timezone.utc),
    )
    assert pdf_bytes is not None
    assert len(pdf_bytes) > 500
    assert pdf_bytes.startswith(b"%PDF")


def test_transfer_routes_registered():
    routes = [r.path for r in app.routes if hasattr(r, "path")]
    # Checa rotas do roteador de transferências
    from app.api.v1.endpoints.transfers import router
    router_paths = [r.path for r in router.routes]
    assert "/projects/{project_id}/transfers" in router_paths
    assert "/transfers/{transfer_id}/notify" in router_paths
