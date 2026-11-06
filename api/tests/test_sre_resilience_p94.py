"""
=============================================================================
Testes de Infraestrutura SRE & Resiliência (PROMPT 94)
1. Supavisor Connection String & Porta 6543
2. Circuit Breaker Evolution API com Fallback e Log sem Crash
3. Middleware de Crash Handler (Intercepção 500 com Webhook RFC 7807)
4. Edge Caching Headers (Cache-Control) em Holerites e Mapas de Cotação
=============================================================================
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import build_supavisor_connection_string
from app.services.evolution_whatsapp import EvolutionWhatsAppClient

client = TestClient(app)


def test_sre_supavisor_connection_port_enforcement():
    """Garante que a string de conexão é roteada estritamente para a porta 6543 do Supavisor."""
    conn_str = build_supavisor_connection_string()
    assert ":6543/" in conn_str, f"A porta configurada deveria ser 6543 (Supavisor), obtido: {conn_str}"
    assert ":5432/" not in conn_str


@pytest.mark.asyncio
async def test_sre_evolution_circuit_breaker_resilience():
    """
    Simula falhas contínuas de rede na Evolution WhatsApp API.
    O cliente DEVE tentar os retries e, após esgotar, acionar o Circuit Breaker
    sem quebrar a execução ou levantar exceção não tratada.
    """
    broken_client = EvolutionWhatsAppClient(
        api_url="https://mock-broken-whatsapp.internal.gadap",
        api_key="invalid-key",
        instance_name="broken-test",
        timeout=0.2,
    )
    # Sobrescreve cooldown para teste rápido
    broken_client._cooldown_seconds = 2.0

    # 1. Primeira falha
    res1 = await broken_client.send_text("11999999991", "Teste 1")
    assert res1["success"] is False
    assert res1["status"] in ("FAILED_AND_LOGGED", "FALLBACK_LOGGED")

    # 2. Segunda falha
    res2 = await broken_client.send_text("11999999992", "Teste 2")
    assert res2["success"] is False

    # 3. Terceira falha -> Ativa Circuit Breaker
    res3 = await broken_client.send_text("11999999993", "Teste 3")
    assert res3["success"] is False

    # 4. Quarta tentativa -> Circuit Breaker deve estar ABERTO imediatamente sem disparar HTTP
    res4 = await broken_client.send_text("11999999994", "Teste 4")
    assert res4["circuit_breaker_triggered"] is True
    assert "CIRCUIT BREAKER" in res4["error"]


def test_sre_edge_caching_headers_on_pdf_endpoints():
    """Garante que os PDFs possuem headers Cache-Control e CDN-Cache-Control configurados."""
    # 1. Mapa de Cotação
    resp_quote = client.get("/api/v1/procurement/requests/a1111111-1111-1111-1111-111111111111/quotation-map/pdf")
    assert resp_quote.status_code == 200
    assert "Cache-Control" in resp_quote.headers
    assert "public" in resp_quote.headers["Cache-Control"]
    assert "s-maxage" in resp_quote.headers["Cache-Control"]
    assert "CDN-Cache-Control" in resp_quote.headers

    # 2. Holerite CLT
    resp_holerite = client.get("/api/v1/hr/payroll/records/pay-2026-11-emp-1/holerite/pdf")
    assert resp_holerite.status_code == 200
    assert "Cache-Control" in resp_holerite.headers
    assert "public" in resp_holerite.headers["Cache-Control"]
    assert "max-age" in resp_holerite.headers["Cache-Control"]

