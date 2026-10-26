from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class QuoteStatus(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    APPROVED = "approved"
    REJECTED = "rejected"
    CONVERTED = "converted"


class QuoteItemType(str, Enum):
    PRODUCT = "product"
    SERVICE = "service"


# ------------------------------------------------------------------------------
# Schemas dos Itens de Orçamento (QuoteItem)
# ------------------------------------------------------------------------------
class QuoteItemBase(BaseModel):
    item_type: QuoteItemType = Field(
        ...,
        description="Tipo de item orçado: 'product' (material) ou 'service' (mão de obra/serviço)",
        example="service",
    )
    product_id: Optional[UUID] = Field(None, description="Vínculo opcional com a tabela de produtos")
    service_id: Optional[UUID] = Field(None, description="Vínculo opcional com a tabela de serviços")
    description: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="Descrição detalhada do item orçado",
        example="Alvenaria Estrutural com Blocos de Concreto 14x19x39",
    )
    unit_of_measure: str = Field(
        ...,
        max_length=10,
        description="Unidade de medição (ex: M2, M3, UN, SC, HORA)",
        example="M2",
    )
    quantity: Decimal = Field(
        ...,
        gt=0,
        decimal_places=4,
        description="Quantidade orçada",
        example=Decimal("150.0000"),
    )
    unit_cost: Decimal = Field(
        ...,
        ge=0,
        decimal_places=4,
        description="Custo direto unitário de insumo/execução (NUMERIC 18,4)",
        example=Decimal("42.0000"),
    )
    bdi_rate: Optional[Decimal] = Field(
        None,
        decimal_places=4,
        description="Taxa específica de BDI para este item (se omitida, herda o BDI global do orçamento)",
        example=Decimal("0.2729"),
    )


class QuoteItemCreate(QuoteItemBase):
    pass


class QuoteItemResponse(QuoteItemBase):
    id: UUID
    quote_id: UUID
    tenant_id: UUID
    bdi_rate: Decimal
    unit_price: Decimal = Field(
        ...,
        description="Preço final unitário de venda já com aplicação do multiplicador de BDI",
    )
    total_cost: Decimal = Field(..., description="Custo direto total (quantity * unit_cost)")
    total_price: Decimal = Field(..., description="Preço total de venda (quantity * unit_price)")
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


# ------------------------------------------------------------------------------
# Schemas do Orçamento Principal (Quote)
# ------------------------------------------------------------------------------
class QuoteBase(BaseModel):
    client_id: UUID = Field(..., description="Identificador do cliente tomador da obra")
    project_id: Optional[UUID] = Field(None, description="Identificador da obra (se já existente)")
    code: Optional[str] = Field(None, max_length=50, description="Código orçamentário (ex: ORC-2026-001)")
    title: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="Título ou objeto do orçamento",
        example="Reforma e Recuperação Estrutural de Fachada",
    )
    description: Optional[str] = Field(None, description="Detalhamento técnico do escopo da proposta")
    
    # Parâmetros Analíticos de BDI
    ac_rate: Decimal = Field(
        default=Decimal("0.0400"),
        description="Taxa de Administração Central (ex: 4% = 0.0400 ou 4.0)",
        example=Decimal("0.0400"),
    )
    s_rate: Decimal = Field(
        default=Decimal("0.0080"),
        description="Taxa de Seguros (ex: 0.8% = 0.0080)",
        example=Decimal("0.0080"),
    )
    r_rate: Decimal = Field(
        default=Decimal("0.0120"),
        description="Taxa de Riscos e Imprevistos (ex: 1.2% = 0.0120)",
        example=Decimal("0.0120"),
    )
    g_rate: Decimal = Field(
        default=Decimal("0.0040"),
        description="Taxa de Garantias (ex: 0.4% = 0.0040)",
        example=Decimal("0.0040"),
    )
    df_rate: Decimal = Field(
        default=Decimal("0.0100"),
        description="Taxa de Despesas Financeiras (ex: 1.0% = 0.0100)",
        example=Decimal("0.0100"),
    )
    l_rate: Decimal = Field(
        default=Decimal("0.0800"),
        description="Taxa de Lucro Bruto da Construtora (ex: 8.0% = 0.0800)",
        example=Decimal("0.0800"),
    )
    i_rate: Decimal = Field(
        default=Decimal("0.0865"),
        description="Tributos Incidentes sobre o Faturamento - ISS, PIS, COFINS (ex: 8.65% = 0.0865)",
        example=Decimal("0.0865"),
    )

    # Método de Precificação: BDI ou MARKUP
    calculation_type: str = Field(
        default="BDI",
        description="Método de cálculo: 'BDI' (analítico corporativo) ou 'MARKUP' (simplificado para autônomos/MEI)",
        example="BDI",
    )
    markup_percentage: Optional[Decimal] = Field(
        default=Decimal("0.0000"),
        ge=0,
        description="Margem percentual de Markup aplicada diretamente sobre os custos (ex: 30% = 0.3000 ou 30.0)",
        example=Decimal("0.3000"),
    )

    discount_amount: Decimal = Field(
        default=Decimal("0.0000"),
        ge=0,
        description="Desconto comercial concedido na proposta",
    )
    valid_until: Optional[date] = Field(None, description="Data limite de validade da proposta")
    notes: Optional[str] = Field(None, description="Condições gerais de pagamento e prazos")


class QuoteCreate(QuoteBase):
    items: List[QuoteItemCreate] = Field(
        ...,
        min_length=1,
        description="Lista de itens de insumo (produtos) e serviços técnicos que compõem o orçamento",
    )


class QuoteUpdate(BaseModel):
    status: Optional[QuoteStatus] = None
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    calculation_type: Optional[str] = None
    markup_percentage: Optional[Decimal] = Field(None, ge=0)
    discount_amount: Optional[Decimal] = Field(None, ge=0)
    valid_until: Optional[date] = None
    notes: Optional[str] = None


class QuoteResponse(QuoteBase):
    id: UUID
    tenant_id: UUID
    status: QuoteStatus
    calculation_type: str = "BDI"
    markup_percentage: Optional[Decimal] = None
    bdi_multiplier: Decimal = Field(..., description="Multiplicador global de BDI ou taxa de Markup calculado pelo motor")
    total_cost: Decimal = Field(..., description="Custo direto total somado de todos os itens")
    total_products_cost: Decimal = Field(..., description="Custo direto de insumos e produtos")
    total_services_cost: Decimal = Field(..., description="Custo direto de serviços e mão de obra")
    bdi_amount: Decimal = Field(..., description="Valor monetário agregado pelo BDI ou Markup")
    grand_total: Decimal = Field(..., description="Preço final comercial da proposta")
    created_at: datetime
    updated_at: datetime
    items: Optional[List[QuoteItemResponse]] = None
    client: Optional[Dict[str, Any]] = None

    model_config = {
        "from_attributes": True
    }


class QuoteConvertResponse(BaseModel):
    message: str = "Orçamento aprovado e convertido em Obra com sucesso."
    quote: QuoteResponse
    project: Dict[str, Any]
    cronograma: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Etapas do cronograma físico-financeiro inicial gerado a partir dos itens do orçamento",
    )
