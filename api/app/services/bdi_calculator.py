"""
GADAP Hub ERP - Motor Oficial de Cálculo de BDI (Benefícios e Despesas Indiretas)
Norma: Acórdão TCU 2622/2013 e Especificação GADAP-ERP.
Precisão: Decimal com Arredondamento Bancário (Round Half-to-Even).
"""

from decimal import Decimal, ROUND_HALF_EVEN
from typing import Any, Dict, List, Optional, Tuple

# Precisões e Quantizadores Bancários
QUANT_MONETARY_4 = Decimal("0.0001")
QUANT_MONETARY_2 = Decimal("0.01")
QUANT_RATE_6 = Decimal("0.000001")
QUANT_RATE_4 = Decimal("0.0001")


def quantize_half_even(val: Decimal, precision: Decimal = QUANT_MONETARY_4) -> Decimal:
    """
    Arredonda um valor Decimal utilizando o método Round Half-to-Even (Bancário / IEEE 754).
    """
    return val.quantize(precision, rounding=ROUND_HALF_EVEN)


def normalize_rate(val: Any) -> Decimal:
    """
    Converte para Decimal e normaliza taxas fornecidas em porcentagem ou decimal.
    Ex: 4.0 ou 4 -> 0.0400 | 0.04 -> 0.0400.
    """
    if val is None:
        return Decimal("0.0000")
    d = Decimal(str(val))
    if d > Decimal("1.0"):
        d = d / Decimal("100")
    return quantize_half_even(d, QUANT_RATE_4)


def calculate_bdi_multiplier(
    ac_rate: Decimal,
    s_rate: Decimal,
    r_rate: Decimal,
    g_rate: Decimal,
    df_rate: Decimal,
    l_rate: Decimal,
    i_rate: Decimal,
) -> Decimal:
    """
    Aplica a Fórmula Oficial de BDI do GADAP Hub:
    BDI = [((1 + AC + S + R + G) * (1 + DF) * (1 + L)) / (1 - I)] - 1

    Onde:
    - AC: Administração Central
    - S:  Seguros
    - R:  Riscos e Imprevistos
    - G:  Garantias
    - DF: Despesas Financeiras
    - L:  Lucro Bruto / Remuneração da Construtora
    - I:  Soma de Tributos sobre o Faturamento (ISS, PIS, COFINS ou IBS/CBS)
    """
    ac = normalize_rate(ac_rate)
    s = normalize_rate(s_rate)
    r = normalize_rate(r_rate)
    g = normalize_rate(g_rate)
    df = normalize_rate(df_rate)
    l = normalize_rate(l_rate)
    i = normalize_rate(i_rate)

    if i >= Decimal("1.0"):
        raise ValueError(f"Alíquota de impostos (I = {i}) não pode ser igual ou superior a 100% (1.0).")

    one = Decimal("1.0")

    # Numerador: (1 + AC + S + R + G) * (1 + DF) * (1 + L)
    term_indirect = one + ac + s + r + g
    term_fin = one + df
    term_profit = one + l
    numerator = term_indirect * term_fin * term_profit

    # Denominador: (1 - I)
    denominator = one - i

    bdi = (numerator / denominator) - one
    return quantize_half_even(bdi, QUANT_RATE_6)


def calculate_quote_financials(
    ac_rate: Decimal = Decimal("0.0400"),
    s_rate: Decimal = Decimal("0.0080"),
    r_rate: Decimal = Decimal("0.0120"),
    g_rate: Decimal = Decimal("0.0040"),
    df_rate: Decimal = Decimal("0.0100"),
    l_rate: Decimal = Decimal("0.0800"),
    i_rate: Decimal = Decimal("0.0865"),
    discount_amount: Decimal = Decimal("0.0000"),
    items: List[Dict[str, Any]] = None,
    calculation_type: str = "BDI",
    markup_percentage: Optional[Decimal] = None,
) -> Dict[str, Any]:
    """
    Calcula a precificação orçamentária:
    - Se calculation_type == 'MARKUP': Fórmula simplificada Custo Total * (1 + Markup %)
    - Se calculation_type == 'BDI': Fórmula analítica TCU [((1 + AC + S + R + G)*(1 + DF)*(1 + L))/(1 - I)] - 1
    Consolida custos, preços e itens com arredondamento bancário Round Half-to-Even.
    """
    if items is None:
        items = []

    calc_type = (calculation_type or "BDI").upper()

    if calc_type == "MARKUP":
        # Se for Markup, a fórmula a ser calculada será apenas Custo Total * (1 + Markup %)
        markup_rate = normalize_rate(markup_percentage if markup_percentage is not None else Decimal("0.0000"))
        multiplier = markup_rate
    else:
        multiplier = calculate_bdi_multiplier(
            ac_rate=ac_rate,
            s_rate=s_rate,
            r_rate=r_rate,
            g_rate=g_rate,
            df_rate=df_rate,
            l_rate=l_rate,
            i_rate=i_rate,
        )

    discount = quantize_half_even(Decimal(str(discount_amount or "0.0000")))

    calculated_items: List[Dict[str, Any]] = []
    total_cost = Decimal("0.0000")
    total_products_cost = Decimal("0.0000")
    total_services_cost = Decimal("0.0000")
    total_gross_price = Decimal("0.0000")

    for raw_item in items:
        qty = quantize_half_even(Decimal(str(raw_item["quantity"])))
        unit_cost = quantize_half_even(Decimal(str(raw_item["unit_cost"])))
        item_type = str(raw_item["item_type"]).lower()

        # Se o item tiver taxa customizada (apenas em BDI), normaliza; senão usa a taxa global calculada
        custom_rate = raw_item.get("bdi_rate")
        if custom_rate is not None and calc_type != "MARKUP":
            item_rate = normalize_rate(custom_rate)
        else:
            item_rate = quantize_half_even(multiplier, QUANT_RATE_4)

        # Preço final unitário = unit_cost * (1 + Margem/BDI)
        unit_price = quantize_half_even(unit_cost * (Decimal("1.0") + item_rate))

        # Subtotais do item
        item_total_cost = quantize_half_even(qty * unit_cost)
        item_total_price = quantize_half_even(qty * unit_price)

        total_cost += item_total_cost
        total_gross_price += item_total_price

        if item_type == "product":
            total_products_cost += item_total_cost
        elif item_type == "service":
            total_services_cost += item_total_cost

        calc_item = dict(raw_item)
        calc_item["quantity"] = float(qty)
        calc_item["unit_cost"] = float(unit_cost)
        calc_item["bdi_rate"] = float(item_rate)
        calc_item["unit_price"] = float(unit_price)
        calc_item["total_cost"] = float(item_total_cost)
        calc_item["total_price"] = float(item_total_price)
        calculated_items.append(calc_item)

    bdi_amount = quantize_half_even(total_gross_price - total_cost)
    grand_total = quantize_half_even(total_gross_price - discount)
    if grand_total < Decimal("0.0000"):
        grand_total = Decimal("0.0000")

    return {
        "calculation_type": calc_type,
        "markup_percentage": float(normalize_rate(markup_percentage) * Decimal("100.0")) if markup_percentage is not None else 0.0,
        "bdi_multiplier": float(multiplier),
        "total_cost": float(total_cost),
        "total_products_cost": float(total_products_cost),
        "total_services_cost": float(total_services_cost),
        "bdi_amount": float(bdi_amount),
        "discount_amount": float(discount),
        "grand_total": float(grand_total),
        "items": calculated_items,
    }
