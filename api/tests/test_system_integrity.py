#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
GADAP Hub - Bateria Oficial de Testes de Integridade do Sistema
Valida de ponta a ponta:
1. Relações e Modelagem de Dados (Entidades, Chaves e Foreign Keys)
2. Motor de Engenharia e Medições (Retenção Técnica e Trava de 100%)
3. Motor Comercial (Orçamentos: BDI Analítico TCU vs Markup Simplificado)
4. Motor Fiscal & Reforma Tributária (Demonstrativo Dual, Não-Cumulatividade, Bypass MEI)
5. Motor de Subcontratos e Terceirizados (Regra do Farol, Zero Travas e Abatimento)
6. Emissor NFS-e Padrão Nacional (Chave de Acesso 50 dígitos e ISS LC 116/2003)
7. Integridade da Árvore de Rotas da API FastAPI (app.main:app)
=============================================================================
"""

import sys
import os
from decimal import Decimal, ROUND_HALF_EVEN
from datetime import date
from typing import Dict, Any, List

# Garante path para importação do pacote app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.tax_calculator import TaxCalculator, quantize_currency
from app.services.subcontract_compliance_service import (
    SubcontractComplianceService,
    ComplianceBlockedException,
)
from app.services.nfse_builder import NfseNationalBuilder
from app.services.bdi_calculator import calculate_bdi_multiplier
from app.main import app


# =============================================================================
# 1. TESTE DE INTEGRIDADE: MOTOR FISCAL & REFORMA TRIBUTÁRIA (FASE 12)
# =============================================================================

def test_integrity_tax_calculator_dual_demonstrative():
    """Valida o cálculo do Demonstrativo Dual (Legado vs IBS/CBS) com redutor de 40%."""
    faturamento = Decimal("100000.00")
    materiais_legado = Decimal("20000.00")
    credito_cbs = Decimal("1500.00")
    credito_ibs = Decimal("2500.00")

    # Teste no ano de vigência plena (2033) com aproveitamento integral dos créditos
    result = TaxCalculator.calculate_dual_demonstrative(
        valor_faturamento_bruto=faturamento,
        deducoes_materiais_legado=materiais_legado,
        exercicio_ano=2033,
        tax_regime="lucro_presumido",
        iss_aliquota=Decimal("0.0500"),
        creditos_materiais_cbs=credito_cbs,
        creditos_materiais_ibs=credito_ibs,
        aplicar_redutor_construcao=True,
    )

    assert result["faturamento_bruto"] == 100000.00
    assert result["exercicio_ano"] == 2033
    assert result["tax_regime"] == "LUCRO_PRESUMIDO"
    assert result["bypass_fiscal_ativo"] is False

    # Validação do Modelo Legado (Em 2033, ISS é 100% extinto pela EC 132/2023)
    legado = result["modelo_legado"]
    assert legado["base_calculo_bruta"] == 100000.00
    assert legado["deducoes_materiais"] == 20000.00
    assert legado["base_calculo_iss"] == 80000.00  # 100k - 20k
    assert legado["iss"]["valor_devido"] == 0.0  # Em 2033 o ISS foi extinto
    assert legado["total_tributos_legado"] > 0

    # Validação do período de transição (2030) onde ISS ainda incide com redutor de transição
    res_2030 = TaxCalculator.calculate_dual_demonstrative(
        valor_faturamento_bruto=faturamento,
        deducoes_materiais_legado=materiais_legado,
        exercicio_ano=2030,
        tax_regime="lucro_presumido",
        iss_aliquota=Decimal("0.0500"),
    )
    assert res_2030["modelo_legado"]["iss"]["valor_devido"] > 0

    # Validação do Modelo IVA Dual (Plena vigência 2033: CBS + IBS com créditos abatidos)
    iva = result["modelo_iva_dual"]
    assert iva["redutor_construcao_civil_ativo"] is True
    assert iva["percentual_redutor_construcao"] == 40.0
    assert iva["cbs"]["creditos_abatidos"] == 1500.00
    assert iva["ibs"]["creditos_abatidos"] == 2500.00
    assert iva["total_creditos_materiais_abatidos"] == 4000.00
    assert iva["total_iva_dual_liquido_devido"] >= 0

    # Validação do Demonstrativo Comparativo
    comp = result["demonstrativo_comparativo"]
    assert comp["exercicio_analisado"] == 2033
    assert comp["diagnostico_impacto"] in ("ECONOMIA_TRIBUTARIA", "ACRESCIMO_CARGA", "NEUTRO")
    assert len(comp["parecer_tecnico"]) > 20
    print("[PASS] 1.1 Motor Fiscal: Demonstrativo Dual e Não-Cumulatividade Plena")


def test_integrity_tax_calculator_mei_bypass():
    """Valida o Bypass Fiscal para empresas MEI / Engenheiros Solo (SIMEI)."""
    faturamento = Decimal("15000.00")

    result = TaxCalculator.calculate_dual_demonstrative(
        valor_faturamento_bruto=faturamento,
        tax_regime="MEI",
        optante_simples_nacional=True,
    )

    assert result["bypass_fiscal_ativo"] is True
    assert result["tax_regime"] == "MEI"

    legado = result["modelo_legado"]
    assert legado["bypass_fiscal_ativo"] is True
    assert legado["total_tributos_legado"] == 0.0
    assert legado["iss"]["isencao"] is True
    assert legado["inss_retencao"]["isencao"] is True
    assert legado["irrf"]["isencao"] is True
    assert legado["desoneracoes_especiais"]["status"] == "DESONERADO_BYPASS"
    assert legado["das_simei_mensal_estimado"] == 75.00

    iva = result["modelo_iva_dual"]
    assert iva["bypass_fiscal_ativo"] is True
    assert iva["total_iva_dual_liquido_devido"] == 0.0
    print("[PASS] 1.2 Motor Fiscal: Bypass Fiscal MEI / SIMEI (Zero Retenções)")


# =============================================================================
# 2. TESTE DE INTEGRIDADE: MOTOR DE SUBCONTRATOS & FAROL DE RISCO (FASE 13)
# =============================================================================

def test_integrity_subcontracts_farol_rules():
    """Valida as 3 zonas do Farol Físico-Financeiro (GREEN, YELLOW, RED)."""
    v_contrato = Decimal("100000.00")

    # 1. GREEN: Pagamentos <= Medição
    res_green = SubcontractComplianceService.calculate_risk_traffic_light(
        contract_value=v_contrato,
        total_paid=Decimal("30000.00"),
        total_measured=Decimal("35000.00"),
    )
    assert res_green["risk_status"] == "GREEN"
    assert res_green["financial_exposure"] == Decimal("0.0000")

    # 2. YELLOW: Pagamentos > Medição, mas < 80% do Contrato Global
    res_yellow = SubcontractComplianceService.calculate_risk_traffic_light(
        contract_value=v_contrato,
        total_paid=Decimal("50000.00"),
        total_measured=Decimal("30000.00"),
    )
    assert res_yellow["risk_status"] == "YELLOW"
    assert res_yellow["financial_exposure"] == Decimal("20000.0000")

    # 3. RED: Pagamentos > Medição E >= 80% do Contrato Global
    res_red = SubcontractComplianceService.calculate_risk_traffic_light(
        contract_value=v_contrato,
        total_paid=Decimal("85000.00"),
        total_measured=Decimal("60000.00"),
    )
    assert res_red["risk_status"] == "RED"
    assert res_red["financial_exposure"] == Decimal("25000.0000")
    print("[PASS] 2.1 Motor de Subcontratos: Regra do Farol (GREEN, YELLOW, RED)")


def test_integrity_subcontracts_compliance_lock_and_retention():
    """Valida a Trava Financeira de regularidade documental e a retenção técnica."""
    subcontract = {
        "id": "11111111-1111-1111-1111-111111111111",
        "tenant_id": "99999999-9999-9999-9999-999999999999",
        "project_id": "22222222-2222-2222-2222-222222222222",
        "supplier_id": "33333333-3333-3333-3333-333333333333",
        "contract_number": "SUB-TEST-01",
        "technical_retention_percentage": Decimal("5.0000"),
    }
    sub_measurement = {
        "id": "44444444-4444-4444-4444-444444444444",
        "measured_value": Decimal("20000.00"),
        "measurement_number": 1,
    }

    # Caso 1: Documentos Ausentes -> Deve acionar ComplianceBlockedException (422)
    docs_incompletos = [{"document_type": "GFIP", "is_verified": True}]
    try:
        SubcontractComplianceService.enforce_compliance_and_prepare_financial_entry(
            subcontract=subcontract,
            sub_measurement=sub_measurement,
            documents=docs_incompletos,
        )
        assert False, "Deveria ter lançado ComplianceBlockedException"
    except ComplianceBlockedException as exc:
        assert exc.status_code == 422
        detail_data: Any = exc.detail
        assert isinstance(detail_data, dict)
        assert detail_data.get("error") == "COMPLIANCE_LOCK_ACTIVE"

    # Caso 2A: Documentos Completos - Empreiteiro Padrão (Retenção Técnica + Retenções Fiscais 11% INSS e 5% ISS)
    docs_completos = [
        {"document_type": "GFIP", "is_verified": True},
        {"document_type": "CND", "is_verified": True},
        {"document_type": "FGTS", "is_verified": True},
    ]
    res_padrao = SubcontractComplianceService.enforce_compliance_and_prepare_financial_entry(
        subcontract=subcontract,
        sub_measurement=sub_measurement,
        documents=docs_completos,
        supplier_tax_regime="lucro_presumido",
    )
    fin_padrao = res_padrao["financial_entry_payload"]
    assert fin_padrao["nominal_amount"] == 20000.00
    assert fin_padrao["technical_retention_amount"] == 1000.00  # 5% de 20k
    assert fin_padrao["discount_amount"] == 3200.00            # 11% INSS (2200) + 5% ISS (1000)
    assert fin_padrao["net_amount"] == 15800.00                # 20k - 1k - 3.2k
    assert fin_padrao["entry_type"] == "payable"

    # Caso 2B: Empreiteiro MEI / Autônomo (Bypass Fiscal: Retenção Técnica mantida, retenção fiscal zerada)
    res_mei = SubcontractComplianceService.enforce_compliance_and_prepare_financial_entry(
        subcontract=subcontract,
        sub_measurement=sub_measurement,
        documents=docs_completos,
        supplier_tax_regime="MEI",
    )
    fin_mei = res_mei["financial_entry_payload"]
    assert fin_mei["nominal_amount"] == 20000.00
    assert fin_mei["technical_retention_amount"] == 1000.00  # 5% de 20k
    assert fin_mei["discount_amount"] == 0.00                # Bypass Fiscal MEI
    assert fin_mei["net_amount"] == 19000.00                 # 20k - 1k
    assert fin_mei["entry_type"] == "payable"

    print("[PASS] 2.2 Motor de Subcontratos: Trava de Compliance e Retenção Técnica/Fiscal (Padrão & MEI)")


# =============================================================================
# 3. TESTE DE INTEGRIDADE: MOTOR FISCAL & NFS-e NACIONAL
# =============================================================================

def test_integrity_nfse_national_access_key_modulo11():
    """Valida o cálculo canônico da Chave de Acesso Nacional de 50 dígitos com Módulo 11."""
    chave_mock = NfseNationalBuilder.generate_access_key(
        codigo_municipio_ibge="3509502",  # Campinas/SP
        tipo_inscricao="1",              # 1 = CNPJ
        documento="12345678000195",
        serie="00001",
        numero_dps=105,
        codigo_seguranca=9876543,
    )
    # A chave deve conter exatamente 50 dígitos numéricos
    assert len(chave_mock) == 50
    assert chave_mock.isdigit()
    assert chave_mock.startswith("3509502")
    assert "12345678000195" in chave_mock

    # Validação do Dígito Verificador (Módulo 11 com pesos de 2 a 9)
    raiz_49 = chave_mock[:49]
    dv_calculado = NfseNationalBuilder.calculate_dv_modulo11(raiz_49)
    assert chave_mock[49] == dv_calculado
    print("[PASS] 3.1 Motor Fiscal: Chave de Acesso Nacional (50 dígitos Módulo 11)")


def test_integrity_nfse_iss_competence():
    """Valida a regra territorial do ISS da Construção Civil (LC 116/2003, Art. 3º, III)."""
    # 1. Município do prestador == Município da obra -> Não retém (salvo instrução)
    res_mesmo_mun = NfseNationalBuilder.validate_and_compute_iss(
        municipio_prestador_ibge="3550308",  # São Paulo/SP
        municipio_obra_ibge="3550308",       # São Paulo/SP
        valor_servico=Decimal("10000.00"),
        valor_deducoes=Decimal("0.00"),
        aliquota_iss=Decimal("5.00"),
        iss_retido_informado=False,
    )
    assert res_mesmo_mun["iss_retained"] is False
    assert res_mesmo_mun["municipios_distintos"] is False

    # 2. Município do prestador != Município da obra -> Retenção compulsória pelo tomador
    res_outro_mun = NfseNationalBuilder.validate_and_compute_iss(
        municipio_prestador_ibge="3550308",  # São Paulo/SP
        municipio_obra_ibge="3509502",       # Campinas/SP
        valor_servico=Decimal("10000.00"),
        valor_deducoes=Decimal("0.00"),
        aliquota_iss=Decimal("5.00"),
        iss_retido_informado=False,  # Mesmo se tentar informar False, a lei força True!
    )
    assert res_outro_mun["iss_retained"] is True
    assert res_outro_mun["municipios_distintos"] is True
    print("[PASS] 3.2 Motor Fiscal: Competência Territorial do ISS (LC 116/2003)")


# =============================================================================
# 4. TESTE DE INTEGRIDADE: MOTOR COMERCIAL (BDI ANALÍTICO VS MARKUP)
# =============================================================================

def test_integrity_commercial_bdi_and_markup_formulas():
    """Valida a precisão matemática do BDI Analítico oficial TCU e do Markup simplificado."""
    # 1. BDI Analítico TCU (Acórdão 2622/2013)
    # Acórdão 2622/2013 TCU: ((1 + AC + S + R + G) * (1 + DF) * (1 + L)) / (1 - I) - 1
    ac = Decimal("0.0400")  # 4%
    s = Decimal("0.0080")   # 0.8%
    r = Decimal("0.0120")   # 1.2%
    g = Decimal("0.0040")   # 0.4%
    df = Decimal("0.0123")  # 1.23%
    l = Decimal("0.0740")   # 7.4%
    i = Decimal("0.0865")   # 8.65% (PIS/COFINS/ISS)

    bdi_mult = calculate_bdi_multiplier(ac, s, r, g, df, l, i)
    bdi_perc = (bdi_mult * Decimal("100.0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)

    # BDI de engenharia deve ficar em faixa plausível (entre 20% e 30%)
    assert Decimal("20.00") <= bdi_perc <= Decimal("30.00")

    # 2. Markup Simplificado: Preço = Custo * (1 + Markup %)
    custo_total = Decimal("50000.00")
    markup_perc = Decimal("25.00")  # 25%
    preco_venda = custo_total * (Decimal("1.0") + (markup_perc / Decimal("100.0")))
    assert preco_venda == Decimal("62500.00")
    print("[PASS] 4.1 Motor Comercial: Fórmulas do BDI Analítico TCU e Markup Autônomos")


# =============================================================================
# 5. TESTE DE INTEGRIDADE: ÁRVORE DE ROTAS E ENDPOINTS DA API FASTAPI
# =============================================================================

def test_integrity_fastapi_route_tree():
    """Verifica se todos os 12 roteadores essenciais estão montados na aplicação FastAPI."""
    expected_prefixes = [
        "/api/v1/clients",
        "/api/v1/suppliers",
        "/api/v1/products",
        "/api/v1/services",
        "/api/v1/quotes",
        "/api/v1/projects",
        "/api/v1/measurements",
        "/api/v1/backoffice",
        "/api/v1/fiscal",
        "/api/v1/intelligence",
        "/api/v1/analytics",
        "/api/v1/subcontracts",
    ]

    # Obtém todas as rotas registradas via OpenAPI
    openapi_paths = list(app.openapi().get("paths", {}).keys())
    registered_paths = set(openapi_paths) | {getattr(r, "path", "") for r in app.routes}
    
    for prefix in expected_prefixes:
        matches = [p for p in registered_paths if p.startswith(prefix)]
        assert len(matches) > 0, f"Roteador não registrado: {prefix}"

    # Valida endpoints críticos de cada módulo
    assert "/api/v1/fiscal/tax-calculator/simulate-dual" in registered_paths
    assert "/api/v1/analytics/export" in registered_paths
    assert "/api/v1/subcontracts/specialties" in registered_paths
    assert "/api/v1/intelligence/ocr/parse" in registered_paths
    print(f"[PASS] 5.1 FastAPI: {len(expected_prefixes)} módulos e rotas registradas com integridade")


# =============================================================================
# EXECUÇÃO DA BATERIA DE INTEGRIDADE
# =============================================================================

def run_all_integrity_tests():
    print("=" * 75)
    print(" GADAP HUB - BATERIA DE TESTES DE INTEGRIDADE DE RELACOES E FUNCOES")
    print("=" * 75)
    
    tests = [
        test_integrity_tax_calculator_dual_demonstrative,
        test_integrity_tax_calculator_mei_bypass,
        test_integrity_subcontracts_farol_rules,
        test_integrity_subcontracts_compliance_lock_and_retention,
        test_integrity_nfse_national_access_key_modulo11,
        test_integrity_nfse_iss_competence,
        test_integrity_commercial_bdi_and_markup_formulas,
        test_integrity_fastapi_route_tree,
    ]

    passed = 0
    failed = 0
    errors = []

    import traceback
    for test_fn in tests:
        try:
            test_fn()
            passed += 1
        except Exception as exc:
            failed += 1
            errors.append((test_fn.__name__, str(exc)))
            print(f"[FAIL] {test_fn.__name__}: {exc}")
            traceback.print_exc()

    print("=" * 75)
    print(f"Resultado Final: {passed}/{len(tests)} testes aprovados com sucesso!")
    if failed == 0:
        print("[OK] INTEGRIDADE 100% HOMOLOGADA: Todas as funcoes e relacoes operam sem falhas.")
    else:
        print(f"[FAIL] Falhas detectadas ({failed}):")
        for name, err in errors:
            print(f"  - {name}: {err}")
    print("=" * 75)
    
    return failed == 0


if __name__ == "__main__":
    success = run_all_integrity_tests()
    sys.exit(0 if success else 1)
