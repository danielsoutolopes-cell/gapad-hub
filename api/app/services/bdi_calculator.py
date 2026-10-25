"""
GADAP Hub ERP - Motor Oficial de Cálculo de BDI (Benefícios e Despesas Indiretas)
Norma: Acórdão TCU 2622/2013 e Especificação GADAP-ERP.
Precisão: Decimal com Arredondamento Bancário (Round Half-to-Even).
"""

from decimal import Decimal, ROUND_HALF_EVEN
from typing import Any, Dict, List, Tuple

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
    ac_rate: Decimal,
    s_rate: Decimal,
    r_rate: Decimal,
    g_rate: Decimal,
    df_rate: Decimal,
    l_rate: Decimal,
    i_rate: Decimal,
    discount_amount: Decimal,
    items: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Calcula o BDI analítico, precifica cada item individualmente e consolida
    os totais financeiros do orçamento com precisão Round Half-to-Even.
    """
    bdi_multiplier = calculate_bdi_multiplier(
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

        # Se o item tiver taxa de BDI customizada, normaliza; senão usa a taxa global calculada
        custom_bdi = raw_item.get("bdi_rate")
        if custom_bdi is not None:
            item_bdi_rate = normalize_rate(custom_bdi)
        else:
            item_bdi_rate = quantize_half_even(bdi_multiplier, QUANT_RATE_4)

        # Preço final unitário = unit_cost * (1 + BDI)
        unit_price = quantize_half_even(unit_cost * (Decimal("1.0") + item_bdi_rate))

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
        calc_item["bdi_rate"] = float(item_bdi_rate)
        calc_item["unit_price"] = float(unit_price)
        calc_item["total_cost"] = float(item_total_cost)
        calc_item["total_price"] = float(item_total_price)
        calculated_items.append(calc_item)

    bdi_amount = quantize_half_even(total_gross_price - total_cost)
    grand_total = quantize_half_even(total_gross_price - discount)
    if grand_total < Decimal("0.0000"):
        grand_total = Decimal("0.0000")

    return {
        "bdi_multiplier": float(bdi_multiplier),
        "total_cost": float(total_cost),
        "total_products_cost": float(total_products_cost),
        "total_services_cost": float(total_services_cost),
        "bdi_amount": float(bdi_amount),
        "discount_amount": float(discount),
        "grand_total": float(grand_total),
        "items": calculated_items,
    }
