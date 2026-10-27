"""
=============================================================================
GADAP Hub - Schemas de Dados para a Central Financeira (Contas a Pagar e Receber)
Arquivo: api/app/schemas/finance.py
=============================================================================
"""

from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel, Field


class FinancialProjectSummary(BaseModel):
    id: str = Field(..., description="ID da obra")
    name: str = Field(..., description="Nome da obra")
    code: Optional[str] = Field(None, description="Código da obra")


class FinancialPartySummary(BaseModel):
    id: str = Field(..., description="ID do favorecido ou pagador (cliente/fornecedor)")
    name: str = Field(..., description="Nome ou Razão Social")
    document: Optional[str] = Field(None, description="CPF ou CNPJ")


class FinancialEntryItem(BaseModel):
    id: str = Field(..., description="Identificador único do lançamento (UUID)")
    tenant_id: str = Field(..., description="ID do Tenant")
    entry_type: str = Field(..., description="Tipo do lançamento: 'payable' ou 'receivable'")
    description: str = Field(..., description="Descrição detalhada do título financeiro")
    category: str = Field(..., description="Categoria / Centro de custo")
    nominal_amount: float = Field(..., description="Valor nominal / bruto")
    technical_retention_amount: float = Field(0.0, description="Retenção técnica de engenharia")
    discount_amount: float = Field(0.0, description="Desconto financeiro concedido/obtido")
    interest_penalty_amount: float = Field(0.0, description="Juros e multas")
    net_amount: float = Field(..., description="Valor líquido a pagar ou a receber")
    status: str = Field(..., description="Status no banco: pendente, pago, atrasado, cancelado")
    effective_status: str = Field(..., description="Status calculado para UX: atrasado, vence_hoje, a_vencer, pago, cancelado")
    due_date: str = Field(..., description="Data de vencimento (YYYY-MM-DD)")
    payment_date: Optional[str] = Field(None, description="Data efetiva da liquidação/pagamento")
    document_number: Optional[str] = Field(None, description="Número da nota fiscal, fatura ou boleto")
    document_type: Optional[str] = Field(None, description="Tipo de documento (boleto, pix, nfe, nfse, transferencia, outro)")
    pix_code: Optional[str] = Field(None, description="Chave Pix ou código copia-e-cola")
    notes: Optional[str] = Field(None, description="Observações complementares")
    created_at: str = Field(..., description="Data de criação no sistema")
    updated_at: str = Field(..., description="Data da última modificação")
    project: Optional[FinancialProjectSummary] = Field(None, description="Obra vinculada")
    party: Optional[FinancialPartySummary] = Field(None, description="Cliente (receivable) ou Fornecedor (payable)")


class FinancialEntriesTotals(BaseModel):
    total_geral: float = Field(..., description="Soma total de todos os títulos")
    total_em_aberto: float = Field(..., description="Soma de títulos pendentes e atrasados")
    total_atrasado: float = Field(..., description="Soma de títulos vencidos e não pagos")
    total_vence_hoje: float = Field(..., description="Soma de títulos que vencem na data de hoje")
    total_a_vencer: float = Field(..., description="Soma de títulos a vencer")
    total_pago: float = Field(..., description="Soma de títulos já liquidados/pagos")
    count_total: int = Field(..., description="Quantidade total de títulos")
    count_em_aberto: int = Field(..., description="Quantidade de títulos pendentes e atrasados")
    count_atrasado: int = Field(..., description="Quantidade de títulos vencidos")
    count_vence_hoje: int = Field(..., description="Quantidade de títulos vencendo hoje")
    count_pago: int = Field(..., description="Quantidade de títulos pagos")


class FinancialProjectGroup(BaseModel):
    project_id: Optional[str] = Field(None, description="ID da obra (ou None se corporativo/geral)")
    project_name: str = Field(..., description="Nome da obra ou 'Despesas Corporativas / Sem Obra'")
    total_nominal: float = Field(..., description="Total nominal bruto do grupo")
    total_liquido: float = Field(..., description="Total líquido do grupo")
    total_em_aberto: float = Field(..., description="Total em aberto do grupo")
    total_pago: float = Field(..., description="Total pago do grupo")
    items_count: int = Field(..., description="Quantidade de lançamentos do grupo")
    items: List[FinancialEntryItem] = Field(default_factory=list, description="Lista de lançamentos")


class FinancialListResponse(BaseModel):
    tenant_id: str = Field(..., description="Identificador do Tenant")
    entry_type: str = Field(..., description="'payable' ou 'receivable'")
    date_ref: str = Field(..., description="Data atual de referência no backend (YYYY-MM-DD)")
    totals: FinancialEntriesTotals = Field(..., description="Totais consolidados para exibição nos cards superiores")
    grouped_by_project: List[FinancialProjectGroup] = Field(..., description="Lançamentos agrupados por obra")
    items: List[FinancialEntryItem] = Field(..., description="Lista plana de todos os lançamentos filtrados")


class FinancialStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="Novo status ('pago', 'pendente', 'cancelado')")
    payment_date: Optional[str] = Field(None, description="Data da baixa/pagamento (obrigatório se pago)")
    notes: Optional[str] = Field(None, description="Observação da baixa ou estorno")
