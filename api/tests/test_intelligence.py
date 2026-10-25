"""
=============================================================================
GADAP Hub - Test Suite de Tax Intelligence & Monitoramento Legal (Fase 10)
Testes automatizados cobrindo:
1. Web scraping e extração de regras tributárias do IBPT (LC 116 / 07.02).
2. Scraping com BeautifulSoup de comunicados e Notas Técnicas da Receita Federal / NFS-e.
3. Cálculo de hash unívoco SHA-256 e deduplicação estrita de alterações.
4. Persistência relacional na tabela 'legislation_updates' / view 'LegislationUpdate'.
5. Endpoints FastAPI:
   - GET /api/v1/intelligence/legislation/alerts (com filtros de categoria e impacto)
   - POST /api/v1/intelligence/legislation/sync (síncrono e assíncrono via background task)
=============================================================================
"""

import asyncio
from datetime import date
import hashlib
import os
import sys

# Garante suporte a UTF-8 no stdout/stderr no Windows
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")

# Inclusão do diretório api no sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
api_dir = os.path.abspath(os.path.join(current_dir, ".."))
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.intelligence import LegislationCategory, LegislationImpactLevel
from app.services.legislation_monitor import LegislationMonitorService, legislation_monitor


def test_01_ibpt_rules_structure():
    """Valida a coleta e estruturação de regras tributárias do IBPT para construção civil."""
    print("\n--- TESTE 1: Extração e Coeficientes de Transparência do IBPT ---")
    service = LegislationMonitorService()
    items = asyncio.run(service.fetch_ibpt_tax_rules())

    assert len(items) >= 2, f"Esperava ao menos 2 itens do IBPT, obtido: {len(items)}"

    # Item de Serviços de Construção Civil (07.02)
    item_0702 = next((i for i in items if i["details"].get("service_code") == "07.02"), None)
    assert item_0702 is not None, "Item de construção civil 07.02 não localizado"
    assert item_0702["source"] == "IBPT"
    assert item_0702["category"] == LegislationCategory.IBPT
    assert item_0702["details"]["municipal_rate"] > 0
    assert item_0702["details"]["federal_rate"] > 0
    print(f"✓ Regra IBPT 07.02 validada: Alíquota Municipal {item_0702['details']['municipal_rate']}% (ISS), Federal {item_0702['details']['federal_rate']}%")


def test_02_nfse_national_notices():
    """Valida a detecção de Notas Técnicas da NFS-e Nacional e regras territoriais da LC 116."""
    print("\n--- TESTE 2: Notas Técnicas e Comunicados Fiscais (NFS-e / RFB) ---")
    service = LegislationMonitorService()
    items = asyncio.run(service.fetch_nfse_national_notices())

    assert len(items) >= 2, f"Esperava ao menos 2 normas fiscais, obtido: {len(items)}"

    # Nota Técnica com regra territorial de ISS (LC 116/2003, Art. 3º, III)
    crit_alert = next((i for i in items if i["impact_level"] == LegislationImpactLevel.CRITICAL), None)
    assert crit_alert is not None, "Alerta crítico de retenção territorial de ISS não localizado"
    assert "116/2003" in crit_alert["law_reference"]
    assert crit_alert["details"]["rule_code"] == "REGRA_ISS_LOCAL_OBRA"
    print(f"✓ Alerta Crítico identificado: {crit_alert['title']} | Ref: {crit_alert['law_reference']}")


def test_03_hash_computation_and_deduplication():
    """Valida o cálculo de hash SHA-256 e garantia de idêntico hash para mesma norma."""
    print("\n--- TESTE 3: Hash Criptográfico SHA-256 e Deduplicação ---")
    h1 = LegislationMonitorService.compute_content_hash(
        source="IBPT",
        title="Tabela de Alíquotas 2026",
        law_reference="Lei 12.741",
        raw_content="Regra Tributaria 07.02",
    )
    h2 = LegislationMonitorService.compute_content_hash(
        source="IBPT",
        title="Tabela de Alíquotas 2026",
        law_reference="Lei 12.741",
        raw_content="Regra Tributaria 07.02",
    )
    h3 = LegislationMonitorService.compute_content_hash(
        source="IBPT",
        title="Tabela de Alíquotas 2026 - Versão Nova",
        law_reference="Lei 12.741",
        raw_content="Regra Tributaria 07.02 Alterada",
    )

    assert h1 == h2, "Hashes para mesmo conteúdo devem ser estritamente idênticos"
    assert h1 != h3, "Hashes para conteúdos distintos devem ser diferentes"
    assert len(h1) == 64, f"Hash SHA-256 deve ter 64 caracteres hexadecimais, obtido: {len(h1)}"
    print(f"✓ Hash determinístico verificado: {h1[:16]}... (Tamanho: {len(h1)})")


def test_04_full_monitoring_cycle_and_persistence():
    """Executa o ciclo completo de monitoramento e persistência na tabela legislation_updates."""
    print("\n--- TESTE 4: Ciclo Completo de Monitoramento e Persistência no Supabase ---")
    service = LegislationMonitorService()
    cycle_result = asyncio.run(service.run_monitoring_cycle())

    assert cycle_result["status"] == "success"
    assert cycle_result["checked_sources"] >= 2
    assert cycle_result["total_evaluated"] >= 4
    print(f"✓ Ciclo 1 executado: {cycle_result['checked_sources']} fontes, {cycle_result['new_alerts_detected']} novos alertas gravados.")

    # Re-execução imediata para testar idempotência e deduplicação (novos alertas devem ser 0)
    cycle_2 = asyncio.run(service.run_monitoring_cycle())
    assert cycle_2["status"] == "success"
    assert cycle_2["new_alerts_detected"] == 0, "Segundo ciclo imediato não deve duplicar alertas já gravados"
    print("✓ Idempotência confirmada: Re-execução evitou duplicações de registros existentes (0 novos alertas).")


def test_05_api_endpoint_list_alerts():
    """Valida o endpoint GET /api/v1/intelligence/legislation/alerts via TestClient."""
    print("\n--- TESTE 5: Endpoint GET /api/v1/intelligence/legislation/alerts ---")
    client = TestClient(app)

    response = client.get("/api/v1/intelligence/legislation/alerts?limit=10")
    assert response.status_code == 200, f"Status esperado 200, obtido {response.status_code}: {response.text}"

    data = response.json()
    assert "total" in data
    assert "alerts" in data
    assert "sources_monitored" in data
    assert data["total"] > 0
    assert len(data["alerts"]) > 0

    first_alert = data["alerts"][0]
    assert "id" in first_alert
    assert "title" in first_alert
    assert "category" in first_alert
    assert "impact_level" in first_alert
    assert "content_hash" in first_alert
    print(f"✓ Endpoint listou com sucesso {data['total']} alertas normativos.")
    print(f"  Primeiro Alerta: [{first_alert['impact_level'].upper()}] {first_alert['title']}")


def test_06_api_endpoint_filters():
    """Valida filtros de categoria e nível de impacto no endpoint GET."""
    print("\n--- TESTE 6: Filtros por Categoria e Criticidade ---")
    client = TestClient(app)

    # Filtro por Categoria 'iss'
    resp_iss = client.get("/api/v1/intelligence/legislation/alerts?category=iss")
    assert resp_iss.status_code == 200
    data_iss = resp_iss.json()
    for alert in data_iss["alerts"]:
        assert alert["category"] == "iss", f"Alerta {alert['title']} não é da categoria iss: {alert['category']}"
    print(f"✓ Filtro de categoria 'iss' retornou {len(data_iss['alerts'])} ocorrência(s).")

    # Filtro por Impacto 'critical'
    resp_crit = client.get("/api/v1/intelligence/legislation/alerts?impact_level=critical")
    assert resp_crit.status_code == 200
    data_crit = resp_crit.json()
    for alert in data_crit["alerts"]:
        assert alert["impact_level"] == "critical"
    print(f"✓ Filtro de impacto 'critical' retornou {len(data_crit['alerts'])} ocorrência(s).")


def test_07_api_endpoint_sync():
    """Valida o endpoint POST /api/v1/intelligence/legislation/sync."""
    print("\n--- TESTE 7: Endpoint POST /api/v1/intelligence/legislation/sync ---")
    client = TestClient(app)

    response = client.post("/api/v1/intelligence/legislation/sync")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["checked_sources"] >= 2
    print(f"✓ Endpoint de sincronização manual retornou status: {data['status']} ({data['message']})")


def run_all_tests():
    """Orquestrador principal de validação."""
    print("=============================================================================")
    print("           GADAP HUB - SUITE DE TESTES: TAX INTELLIGENCE (FASE 10)           ")
    print("=============================================================================")

    tests = [
        test_01_ibpt_rules_structure,
        test_02_nfse_national_notices,
        test_03_hash_computation_and_deduplication,
        test_04_full_monitoring_cycle_and_persistence,
        test_05_api_endpoint_list_alerts,
        test_06_api_endpoint_filters,
        test_07_api_endpoint_sync,
    ]

    passed = 0
    for t in tests:
        try:
            t()
            passed += 1
        except Exception as exc:
            print(f"❌ FALHA NO {t.__name__}: {exc}")
            raise

    print("\n=============================================================================")
    print(f"  SUITE DE TESTES 100% APROVADA: {passed}/{len(tests)} TESTES PASSARAM COM SUCESSO!  ")
    print("=============================================================================")


if __name__ == "__main__":
    run_all_tests()
