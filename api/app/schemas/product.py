from datetime import datetime
from decimal import Decimal
import re
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class ProductBase(BaseModel):
    code: Optional[str] = Field(
        None,
        max_length=50,
        description="Código interno SKU ou código de almoxarifado",
        example="MAT-CIM-001",
    )
    name: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="Descrição detalhada do material ou insumo",
        example="Cimento CP-II-E-32 Saco 50kg Votoran",
    )
    description: Optional[str] = Field(
        None,
        description="Informações complementares ou especificações técnicas",
    )
    ncm: str = Field(
        ...,
        max_length=10,
        description="Nomenclatura Comum do Mercosul (8 dígitos numéricos)",
        example="25232910",
    )
    unit_of_measure: str = Field(
        ...,
        max_length=10,
        description="Unidade comercial/tributável (ex: UN, M2, M3, KG, SC, TON, L)",
        example="SC",
    )
    base_cost: Decimal = Field(
        ...,
        ge=0,
        decimal_places=4,
        description="Custo base unitário de aquisição (NUMERIC 18,4)",
        example=Decimal("38.5000"),
    )
    sale_price: Decimal = Field(
        default=Decimal("0.0000"),
        ge=0,
        decimal_places=4,
        description="Preço base de venda ou faturamento na planilha (NUMERIC 18,4)",
        example=Decimal("45.0000"),
    )
    cest: Optional[str] = Field(
        None,
        max_length=10,
        description="Código Especificador da Substituição Tributária (se aplicável)",
        example="0500100",
    )
    cfop_default: Optional[str] = Field(
        None,
        max_length=5,
        description="CFOP padrão para saídas ou remessas (ex: 5102, 5949)",
        example="5102",
    )
    barcode: Optional[str] = Field(
        None,
        max_length=50,
        description="Código de barras EAN/GTIN",
        example="7891234567890",
    )
    brand: Optional[str] = Field(
        None,
        max_length=100,
        description="Marca ou fabricante",
        example="Votorantim Cimentos",
    )
    category: Optional[str] = Field(
        None,
        max_length=100,
        description="Categoria de insumo (ex: agregados, cimentos, ferragens, hidraulica)",
        example="aglomerantes",
    )
    min_stock: Decimal = Field(
        default=Decimal("0.0000"),
        ge=0,
        decimal_places=4,
        description="Estoque mínimo de segurança para a obra",
    )
    current_stock: Decimal = Field(
        default=Decimal("0.0000"),
        decimal_places=4,
        description="Estoque atual registrado",
    )
    is_active: bool = True

    @field_validator("ncm")
    @classmethod
    def validate_ncm(cls, value: str) -> str:
        clean = re.sub(r"\D", "", value)
        if len(clean) != 8:
            raise ValueError(f"NCM inválido: '{value}'. O código NCM deve conter exatamente 8 dígitos numéricos.")
        return clean

    @field_validator("unit_of_measure")
    @classmethod
    def sanitize_unit(cls, value: str) -> str:
        return value.strip().upper()


class ProductCreate(ProductBase):
    """
    Schema para inserção de um novo produto/insumo.
    tenant_id é injetado pelo backend com base no JWT do usuário autenticado.
    """
    pass


class ProductUpdate(BaseModel):
    """
    Schema para atualização parcial de produto.
    """
    code: Optional[str] = None
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    ncm: Optional[str] = None
    unit_of_measure: Optional[str] = None
    base_cost: Optional[Decimal] = Field(None, ge=0, decimal_places=4)
    sale_price: Optional[Decimal] = Field(None, ge=0, decimal_places=4)
    cest: Optional[str] = None
    cfop_default: Optional[str] = None
    barcode: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    min_stock: Optional[Decimal] = Field(None, ge=0, decimal_places=4)
    current_stock: Optional[Decimal] = None
    is_active: Optional[bool] = None

    @field_validator("ncm")
    @classmethod
    def validate_ncm(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        clean = re.sub(r"\D", "", value)
        if len(clean) != 8:
            raise ValueError(f"NCM inválido: '{value}'. O código NCM deve conter exatamente 8 dígitos numéricos.")
        return clean

    @field_validator("unit_of_measure")
    @classmethod
    def sanitize_unit(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.strip().upper()


class ProductResponse(ProductBase):
    """
    Schema de resposta serializado de produto.
    """
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }
