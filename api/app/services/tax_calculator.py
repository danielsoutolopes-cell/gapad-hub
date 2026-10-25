"""
=============================================================================
GADAP Hub - Motor Oficial de Cálculo Tributário & Reforma Tributária (Fase 12)
Arquivo: api/app/services/tax_calculator.py
Normas: Emenda Constitucional nº 132/2023, PLP 68/2024 e LC 116/2003.
Período de Convivência: 2026 a 2032 | Vigência Plena: 2033+
Precisão: Decimal com Arredondamento Bancário (ROUND_HALF_EVEN / IEEE 754)
=============================================================================
"""

from decimal import Decimal, ROUND_HALF_EVEN
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("gadap.tax_calculator")

# Quantizadores Oficiais de Moeda e Alíquotas
QUANT_MONETARY_2 = Decimal("0.01")
QUANT_MONETARY_4 = Decimal("0.0001")
QUANT_RATE_4 = Decimal("0.0001")
QUANT_RATE_6 = Decimal("0.000001")
ZERO = Decimal("0.0000")


def quantize_currency(val: Decimal) -> Decimal:
    """Arredonda para 2 casas decimais monetárias (R$) usando Round Half-to-Even."""
    return val.quantize(QUANT_MONETARY_2, rounding=ROUND_HALF_EVEN)


def quantize_calc(val: Decimal) -> Decimal:
    """Arredonda cálculos intermediários para 4 casas decimais (Round Half-to-Even)."""
    return val.quantize(QUANT_MONETARY_4, rounding=ROUND_HALF_EVEN)


def normalize_tax_rate(val: Any) -> Decimal:
    """
    Normaliza alíquotas percentuais ou decimais.
    Exemplo: 5.0 ou 5 -> 0.0500 | 0.05 -> 0.0500 | 8.8 -> 0.0880
    """
    if val is None:
        return ZERO
    d = Decimal(str(val))
    if d > Decimal("1.0"):
        d = d / Decimal("100.0")
    return d.quantize(QUANT_RATE_4, rounding=ROUND_HALF_EVEN)


class TaxCalculator:
    """
    Motor Matemático Determinístico da Reforma Tributária Brasileira.
    Executa a apuração paralela e simultânea do:
      1. Modelo Tributário Legado (ISS, PIS, COFINS, INSS, IRRF, CSLL)
      2. Modelo IVA Dual (CBS Federal + IBS Subnacional) com Redutor da Construção Civil
      3. Mecanismo de Não-Cumulatividade Plena (Aproveitamento de Créditos Financeiros)
      4. Demonstrativo Comparativo de Transição (Impacto Econômico)
    """

    # Parâmetros Oficiais de Referência da Reforma Tributária (PLP 68/2024)
    CBS_STANDARD_RATE = Decimal("0.0880")       # 8.8% Federal
    IBS_STATE_RATE = Decimal("0.1200")          # 12.0% Estadual
    IBS_MUNICIPAL_RATE = Decimal("0.0570")      # 5.7% Municipal
    IBS_STANDARD_RATE = Decimal("0.1770")       # 17.7% Total IBS Subnacional
    
    # Redutor Setorial da Construção Civil (EC 132/2023 - Desconto de 40%)
    CONSTRUCTION_REDUCTION_RATE = Decimal("0.4000")
    
    # Alíquotas de Teste do Ano de 2026 (Compensáveis)
    TEST_2026_CBS_RATE = Decimal("0.0090")      # 0.9%
    TEST_2026_IBS_RATE = Decimal("0.0010")      # 0.1%

    @classmethod
    def calculate_dual_demonstrative(
        cls,
        valor_faturamento_bruto: Decimal,
        deducoes_materiais_legado: Decimal = Decimal("0.00"),
        base_calculo_inss_perc: Decimal = Decimal("40.00"),
        exercicio_ano: int = 2026,
        optante_simples_nacional: bool = False,
        iss_aliquota: Optional[Decimal] = None,
        creditos_materiais_cbs: Decimal = Decimal("0.00"),
        creditos_materiais_ibs: Decimal = Decimal("0.00"),
        aplicar_redutor_construcao: bool = True,
    ) -> Dict[str, Any]:
        """
        Gera o Demonstrativo Dual completo contendo a apuração legado, a apuração do
        IVA Dual com créditos financeiros, e a análise de impacto da transição.
        """
        bruto = max(ZERO, quantize_calc(valor_faturamento_bruto))
        deducao_mat = min(bruto, max(ZERO, quantize_calc(deducoes_materiais_legado)))
        ano = int(exercicio_ano)

        # ----------------------------------------------------------------------
        # 1. APURAÇÃO DO MODELO LEGADO
        # ----------------------------------------------------------------------
        # Base de cálculo do ISS: Dedução de materiais legalmente comprovados
        base_iss = max(ZERO, bruto - deducao_mat)
        aliq_iss = normalize_tax_rate(iss_aliquota if iss_aliquota is not None else Decimal("5.00"))
        
        # PIS e COFINS: Cumulativo para construção civil (0.65% e 3.0%)
        # Em 2027+, PIS e COFINS são extintos pela Reforma Tributária
        if ano >= 2027:
            aliq_pis = ZERO
            aliq_cofins = ZERO
        else:
            aliq_pis = Decimal("0.0065")
            aliq_cofins = Decimal("0.0300")

        # INSS: Retenção sobre a base de mão de obra (padrão 40% a 50%)
        base_inss_taxa = normalize_tax_rate(base_calculo_inss_perc)
        base_inss = quantize_calc(bruto * base_inss_taxa)
        aliq_inss = Decimal("0.1100")  # 11% retenção na fonte

        # IRRF e CSLL
        aliq_irrf = Decimal("0.0150")   # 1.5%
        aliq_csll = Decimal("0.0100")   # 1.0%

        if optante_simples_nacional:
            # No Simples Nacional, os tributos federais e municipais são unificados no DAS
            # Para fins comparativos, a taxa média do Anexo IV da construção civil é ~4.5% a 7.5%
            iss_legado = quantize_currency(bruto * Decimal("0.0250"))
            pis_legado = ZERO
            cofins_legado = ZERO
            inss_legado = quantize_currency(base_inss * Decimal("0.1100"))  # Anexo IV recolhe INSS patronal em separado
            irrf_legado = ZERO
            csll_legado = ZERO
        else:
            iss_legado = quantize_currency(base_iss * aliq_iss)
            pis_legado = quantize_currency(bruto * aliq_pis)
            cofins_legado = quantize_currency(bruto * aliq_cofins)
            inss_legado = quantize_currency(base_inss * aliq_inss)
            irrf_legado = quantize_currency(bruto * aliq_irrf)
            csll_legado = quantize_currency(bruto * aliq_csll)

        # Fator de Transição Subnacional para o ISS (2029 a 2032)
        fator_iss_legado = Decimal("1.0000")
        if ano == 2029:
            fator_iss_legado = Decimal("0.9000")
        elif ano == 2030:
            fator_iss_legado = Decimal("0.8000")
        elif ano == 2031:
            fator_iss_legado = Decimal("0.7000")
        elif ano == 2032:
            fator_iss_legado = Decimal("0.6000")
        elif ano >= 2033:
            fator_iss_legado = ZERO  # Extinção total do ISS

        iss_legado_efetivo = quantize_currency(iss_legado * fator_iss_legado)

        total_tributos_legado = (
            iss_legado_efetivo
            + pis_legado
            + cofins_legado
            + inss_legado
            + irrf_legado
            + csll_legado
        )

        aliquota_efetiva_legado = (
            quantize_calc((total_tributos_legado / bruto) * Decimal("100.0"))
            if bruto > ZERO
            else ZERO
        )

        modelo_legado = {
            "regime": "Simples Nacional (Anexo IV)" if optante_simples_nacional else "Lucro Presumido / Real",
            "base_calculo_bruta": float(bruto),
            "deducoes_materiais": float(deducao_mat),
            "base_calculo_iss": float(base_iss),
            "iss": {
                "aliquota_nominal_perc": float(aliq_iss * Decimal("100.0")),
                "fator_transicao_ano": float(fator_iss_legado * Decimal("100.0")),
                "valor_devido": float(iss_legado_efetivo),
            },
            "pis": {
                "aliquota_perc": float(aliq_pis * Decimal("100.0")),
                "valor_devido": float(pis_legado),
            },
            "cofins": {
                "aliquota_perc": float(aliq_cofins * Decimal("100.0")),
                "valor_devido": float(cofins_legado),
            },
            "inss_retencao": {
                "base_calculo_mao_de_obra": float(base_inss),
                "aliquota_perc": float(aliq_inss * Decimal("100.0")),
                "valor_devido": float(inss_legado),
            },
            "irrf": {
                "aliquota_perc": float(aliq_irrf * Decimal("100.0")),
                "valor_devido": float(irrf_legado),
            },
            "csll": {
                "aliquota_perc": float(aliq_csll * Decimal("100.0")),
                "valor_devido": float(csll_legado),
            },
            "total_tributos_legado": float(total_tributos_legado),
            "aliquota_efetiva_legado_perc": float(aliquota_efetiva_legado),
        }

        # ----------------------------------------------------------------------
        # 2. APURAÇÃO DO MODELO IVA DUAL (REFORMA TRIBUTÁRIA)
        # ----------------------------------------------------------------------
        redutor_fator = (
            (Decimal("1.0") - cls.CONSTRUCTION_REDUCTION_RATE)
            if aplicar_redutor_construcao
            else Decimal("1.0")
        )

        cbs_padrao = cls.CBS_STANDARD_RATE
        ibs_padrao = cls.IBS_STANDARD_RATE

        cbs_efetiva_cheia = quantize_calc(cbs_padrao * redutor_fator)
        ibs_efetiva_cheia = quantize_calc(ibs_padrao * redutor_fator)

        # Determinação das alíquotas conforme cronograma legal de transição
        fator_iva_subnacional = ZERO
        cbs_teste_ativa = False
        ibs_teste_ativa = False

        if ano == 2026:
            # Ano Teste: 0.9% CBS e 0.1% IBS
            cbs_aliq_ano = cls.TEST_2026_CBS_RATE
            ibs_aliq_ano = cls.TEST_2026_IBS_RATE
            cbs_teste_ativa = True
            ibs_teste_ativa = True
        elif ano in (2027, 2028):
            # CBS plena; IBS ainda em teste ou transição inicial
            cbs_aliq_ano = cbs_efetiva_cheia
            ibs_aliq_ano = ZERO
        elif 2029 <= ano <= 2032:
            # Transição progressiva de 4 anos do IBS (10%, 20%, 30%, 40%)
            fator_iva_subnacional = Decimal(str((ano - 2028) * 0.10))
            cbs_aliq_ano = cbs_efetiva_cheia
            ibs_aliq_ano = quantize_calc(ibs_efetiva_cheia * fator_iva_subnacional)
        else:
            # 2033+: Vigência Plena do IVA Dual
            fator_iva_subnacional = Decimal("1.0000")
            cbs_aliq_ano = cbs_efetiva_cheia
            ibs_aliq_ano = ibs_efetiva_cheia

        # Débito Bruto de IVA sobre o Faturamento da Medição
        cbs_bruta = quantize_currency(bruto * cbs_aliq_ano)
        ibs_bruta = quantize_currency(bruto * ibs_aliq_ano)

        # ----------------------------------------------------------------------
        # 3. REGRAS DE NÃO-CUMULATIVIDADE PLENA (ABATIMENTO DE CRÉDITOS FINANCEIROS)
        # ----------------------------------------------------------------------
        cred_cbs_disp = max(ZERO, quantize_currency(creditos_materiais_cbs))
        cred_ibs_disp = max(ZERO, quantize_currency(creditos_materiais_ibs))

        # O crédito financeiro abate o débito gerado até o limite do imposto devido
        cred_cbs_aproveitado = min(cbs_bruta, cred_cbs_disp)
        cred_ibs_aproveitado = min(ibs_bruta, cred_ibs_disp)

        cbs_liquida_a_pagar = max(ZERO, cbs_bruta - cred_cbs_aproveitado)
        ibs_liquido_a_pagar = max(ZERO, ibs_bruta - cred_ibs_aproveitado)

        saldo_credor_cbs = max(ZERO, cred_cbs_disp - cbs_bruta)
        saldo_credor_ibs = max(ZERO, cred_ibs_disp - ibs_bruta)

        total_iva_bruto = cbs_bruta + ibs_bruta
        total_creditos_aproveitados = cred_cbs_aproveitado + cred_ibs_aproveitado
        total_iva_liquido_devido = cbs_liquida_a_pagar + ibs_liquido_a_pagar

        aliquota_efetiva_iva = (
            quantize_calc((total_iva_liquido_devido / bruto) * Decimal("100.0"))
            if bruto > ZERO
            else ZERO
        )

        modelo_iva_dual = {
            "exercicio_ano": ano,
            "periodo_teste_2026": cbs_teste_ativa,
            "redutor_construcao_civil_ativo": aplicar_redutor_construcao,
            "percentual_redutor_construcao": float(cls.CONSTRUCTION_REDUCTION_RATE * Decimal("100.0")),
            "cbs": {
                "aliquota_padrao_referencia": float(cbs_padrao * Decimal("100.0")),
                "aliquota_aplicada_ano": float(cbs_aliq_ano * Decimal("100.0")),
                "debito_bruto": float(cbs_bruta),
                "creditos_financeiros_disponiveis": float(cred_cbs_disp),
                "creditos_abatidos": float(cred_cbs_aproveitado),
                "saldo_liquido_a_pagar": float(cbs_liquida_a_pagar),
                "saldo_credor_remanescente": float(saldo_credor_cbs),
            },
            "ibs": {
                "aliquota_padrao_referencia": float(ibs_padrao * Decimal("100.0")),
                "aliquota_estadual_ref": float(cls.IBS_STATE_RATE * Decimal("100.0")),
                "aliquota_municipal_ref": float(cls.IBS_MUNICIPAL_RATE * Decimal("100.0")),
                "fator_transicao_subnacional": float(fator_iva_subnacional * Decimal("100.0")),
                "aliquota_aplicada_ano": float(ibs_aliq_ano * Decimal("100.0")),
                "debito_bruto": float(ibs_bruta),
                "creditos_financeiros_disponiveis": float(cred_ibs_disp),
                "creditos_abatidos": float(cred_ibs_aproveitado),
                "saldo_liquido_a_pagar": float(ibs_liquido_a_pagar),
                "saldo_credor_remanescente": float(saldo_credor_ibs),
            },
            "total_iva_dual_bruto": float(total_iva_bruto),
            "total_creditos_materiais_abatidos": float(total_creditos_aproveitados),
            "total_iva_dual_liquido_devido": float(total_iva_liquido_devido),
            "aliquota_efetiva_iva_perc": float(aliquota_efetiva_iva),
        }

        # ----------------------------------------------------------------------
        # 4. DEMONSTRATIVO COMPARATIVO E IMPACTO DA TRANSIÇÃO
        # ----------------------------------------------------------------------
        # Comparação da carga efetiva entre o Modelo Legado e o IVA Dual
        diferenca_nominal = total_iva_liquido_devido - total_tributos_legado
        variacao_perc = (
            quantize_calc((diferenca_nominal / total_tributos_legado) * Decimal("100.0"))
            if total_tributos_legado > ZERO
            else ZERO
        )

        if diferenca_nominal < -Decimal("0.05"):
            diagnostico = "ECONOMIA_TRIBUTARIA"
            parecer = (
                f"A empresa obtém uma economia tributária estimada de {quantize_currency(abs(diferenca_nominal))} "
                f"({abs(variacao_perc)}% de redução de carga). O aproveitamento de créditos na aquisição "
                f"de materiais sob a Não-Cumulatividade Plena somado ao redutor setorial de 40% da Construção Civil "
                f"supera a carga cumulativa do modelo legado."
            )
        elif diferenca_nominal > Decimal("0.05"):
            diagnostico = "ACRESCIMO_CARGA"
            parecer = (
                f"A projeção indica um acréscimo nominal de {quantize_currency(diferenca_nominal)} "
                f"({variacao_perc}%). Recomenda-se aumentar a exigência de notas fiscais com destaque de "
                f"CBS/IBS de todos os fornecedores de materiais e locações para ampliar a base de créditos dedutíveis."
            )
        else:
            diagnostico = "NEUTRO"
            parecer = (
                "A carga tributária calculada é neutra em relação ao modelo anterior "
                "durante esta etapa de transição."
            )

        demonstrativo_comparativo = {
            "exercicio_analisado": ano,
            "faturamento_bruto_fatura": float(bruto),
            "total_modelo_legado": float(total_tributos_legado),
            "aliquota_efetiva_legado_perc": float(aliquota_efetiva_legado),
            "total_modelo_iva_dual_liquido": float(total_iva_liquido_devido),
            "aliquota_efetiva_iva_dual_perc": float(aliquota_efetiva_iva),
            "credito_tributario_materiais_aproveitado": float(total_creditos_aproveitados),
            "diferenca_nominal": float(quantize_currency(diferenca_nominal)),
            "variacao_percentual_carga": float(variacao_perc),
            "diagnostico_impacto": diagnostico,
            "parecer_tecnico": parecer,
        }

        return {
            "faturamento_bruto": float(bruto),
            "exercicio_ano": ano,
            "modelo_legado": modelo_legado,
            "modelo_iva_dual": modelo_iva_dual,
            "demonstrativo_comparativo": demonstrativo_comparativo,
        }
