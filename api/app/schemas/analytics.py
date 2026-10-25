"""
=============================================================================
GADAP Hub - Schemas de Dados para Analytics & Dashboards Executivos (Módulo 4.7)
Arquivo: api/app/schemas/analytics.py
=============================================================================
"""

from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


# ------------------------------------------------------------------------------
# Schemas para /executive
# ------------------------------------------------------------------------------
class ExecutiveSummaryResponse(BaseModel):
    tenant_id: str = Field(..., description="Identificador do Tenant")
    faturamento_total_mes: float = Field(..., description="Faturamento total consolidado no mês atual")
    ticket_medio: float = Field(..., description="Ticket médio de faturamento por medição/contrato")
    total_retencoes_fiscais: float = Field(..., description="Soma total de retenções fiscais e técnicas do período")
    lucro_bruto_projetado: float = Field(..., description="Lucro bruto apurado (Receitas - Despesas diretas)")
    margem_lucro_perc: float = Field(..., description="Margem de lucro bruto em percentual")
    obras_ativas: int = Field(..., description="Número total de obras em andamento ou ativas")
    receitas_mes: float = Field(..., description="Total de receitas faturadas/a receber do mês")
    despesas_mes: float = Field(..., description="Total de despesas pagas/a pagar do mês")
    comparativo_mes_anterior_perc: float = Field(
        0.0, description="Variação percentual do faturamento em relação ao mês anterior"
    )
    mes_referencia: str = Field(..., description="Mês de referência (ex: 'Outubro/2026')")


# ------------------------------------------------------------------------------
# Schemas para /financial/dre
# ------------------------------------------------------------------------------
class CostCenterBreakdown(BaseModel):
    categoria: str = Field(..., description="Chave da categoria ou centro de custo")
    nome_exibicao: str = Field(..., description="Nome amigável corporativo")
    total: float = Field(..., description="Valor total acumulado na categoria")
    percentual: float = Field(..., description="Percentual representativo sobre as despesas totais")
    cor: str = Field(..., description="Cor hexadecimal para renderização no gráfico de rosca")


class MonthlyEvolutionItem(BaseModel):
    mes: str = Field(..., description="Rótulo do mês (ex: 'Mai/26', 'Jun/26')")
    mes_completo: str = Field(..., description="Nome completo do mês")
    receitas: float = Field(..., description="Receitas totais do mês")
    despesas: float = Field(..., description="Despesas totais do mês")
    lucro: float = Field(..., description="Resultado líquido (Receitas - Despesas)")
    margem_perc: float = Field(..., description="Margem líquida percentual")


class FinancialDreResponse(BaseModel):
    tenant_id: str = Field(..., description="Identificador do Tenant")
    periodo: str = Field(..., description="Período de consolidação do DRE")
    receitas_total: float = Field(..., description="Receita Operacional Bruta acumulada")
    despesas_total: float = Field(..., description="Custos e Despesas Totais acumuladas")
    resultado_liquido: float = Field(..., description="Resultado Líquido do Exercício (Lucro Líquido)")
    margem_liquida_perc: float = Field(..., description="Margem Líquida percentual geral")
    por_centro_custo: List[CostCenterBreakdown] = Field(
        ..., description="Distribuição analítica de despesas por centro de custo"
    )
    evolucao_mensal: List[MonthlyEvolutionItem] = Field(
        ..., description="Evolução financeira mensal dos últimos 6 meses"
    )


# ------------------------------------------------------------------------------
# Schemas para /engineering/curve-s
# ------------------------------------------------------------------------------
class CurveSProjectItem(BaseModel):
    id: str = Field(..., description="UUID da obra")
    nome: str = Field(..., description="Nome do empreendimento")
    codigo: Optional[str] = Field(None, description="Código de engenharia da obra")
    valor_contrato: float = Field(..., description="Valor total contratado da obra")
    total_medido: float = Field(..., description="Valor bruto acumulado de medições físicas realizadas")
    total_faturado: float = Field(..., description="Valor total efetivamente faturado (NFS-e/Financeiro)")
    percentual_fisico: float = Field(..., description="Percentual físico executado (% sobre contrato)")
    percentual_financeiro: float = Field(..., description="Percentual financeiro faturado (% sobre contrato)")
    saldo_contratual: float = Field(..., description="Saldo restante a executar e faturar")
    status: str = Field(..., description="Status operacional da obra")


class CurveSPoint(BaseModel):
    periodo: str = Field(..., description="Marco temporal ou mês de avanço (ex: 'Mês 1', 'Mês 2')")
    planejado_acumulado: float = Field(..., description="Avanço físico planejado acumulado (%)")
    fisico_acumulado: float = Field(..., description="Avanço físico real acumulado (%)")
    financeiro_acumulado: float = Field(..., description="Avanço financeiro faturado acumulado (%)")


class EngineeringCurveSResponse(BaseModel):
    tenant_id: str = Field(..., description="Identificador do Tenant")
    obras_ativas: int = Field(..., description="Total de obras com medições ativas")
    valor_total_contratos: float = Field(..., description="Soma do valor contratado de todas as obras")
    total_medido_global: float = Field(..., description="Soma de medições físicas executadas")
    total_faturado_global: float = Field(..., description="Soma de faturamento emitido")
    avanco_fisico_medio_perc: float = Field(..., description="Avanço físico médio ponderado (%)")
    avanco_financeiro_medio_perc: float = Field(..., description="Avanço financeiro médio ponderado (%)")
    obras: List[CurveSProjectItem] = Field(..., description="Detalhamento individual de cada obra")
    curva_s_acumulada: List[CurveSPoint] = Field(
        ..., description="Série temporal de dados para plotagem da Curva S"
    )
