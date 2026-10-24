from datetime import datetime
from decimal import Decimal
import re
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class ServiceBase(BaseModel):
    code: Optional[str] = Field(
        None,
        max_length=50,
        description="Código interno do serviço ou item de planilha",
        example="SRV-ALV-001",
    )
    name: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="Descrição detalhada do serviço prestado",
        example="Execução de Alvenaria Estrutural com Blocos de Concreto",
    )
    description: Optional[str] = Field(
        None,
        description="Escopo técnico, normas ABNT aplicáveis e condições contratuais",
    )
    nbs_code: str = Field(
        ...,
        max_length=20,
        description="Nomenclatura Brasileira de Serviços (NBS)",
        example="1.0101.10.00",
    )
    lc116_code: str = Field(
        ...,
        max_length=20,
        description="Subitem da Lista de Serviços anexa à Lei Complementar 116/2003 (ex: '07.02')",
        example="07.02",
    )
    cnae_code: Optional[str] = Field(
        None,
        max_length=20,
        description="Código CNAE correspondente da atividade (ex: '4120-4/00')",
        example="4120-4/00",
    )
    base_cost: Decimal = Field(
        ...,
        ge=0,
        decimal_places=4,
        description="Custo operacional base por unidade de medição (NUMERIC 18,4)",
        example=Decimal("42.0000"),
    )
    default_price: Decimal = Field(
        default=Decimal("0.0000"),
        ge=0,
        decimal_places=4,
        description="Preço de venda / medição padrão a ser faturado (NUMERIC 18,4)",
        example=Decimal("65.0000"),
    )
    unit_of_measure: str = Field(
        default="M2",
        max_length=10,
        description="Unidade de medição (ex: M2, M3, UN, HORA, DIA, MES, GL)",
        example="M2",
    )
    iss_aliquota: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        le=100,
        decimal_places=2,
        description="Alíquota municipal padrão de ISS (%)",
        example=Decimal("5.00"),
    )
    iss_retido_default: bool = Field(
        default=False,
        description="Indica se o ISS habitualmente sofre retenção na fonte pelo tomador",
    )
    inss_retencao_aliquota: Decimal = Field(
        default=Decimal("11.00"),
        ge=0,
        le=100,
        decimal_places=2,
        description="Alíquota de retenção previdenciária de INSS (ex: 11% ou 3.5% c/ desoneração da folha)",
        example=Decimal("11.00"),
    )
    is_active: bool = True

    @field_validator("lc116_code")
    @classmethod
    def sanitize_lc116(cls, value: str) -> str:
        trimmed = value.strip()
        if not re.match(r"^\d{2}(\.\d{2})?$", trimmed):
            raise ValueError(f"Código LC 116/03 inválido: '{value}'. Formato esperado: '07.02' ou '0702'.")
        return trimmed

    @field_validator("unit_of_measure")
    @classmethod
    def sanitize_unit(cls, value: str) -> str:
        return value.strip().upper()


class ServiceCreate(ServiceBase):
    """
    Schema para cadastro de serviço.
    tenant_id é injetado pelo backend com base no JWT do usuário autenticado.
    """
    pass


class ServiceUpdate(BaseModel):
    """
    Schema para atualização parcial de serviço.
    """
    code: Optional[str] = None
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    nbs_code: Optional[str] = None
    lc116_code: Optional[str] = None
    cnae_code: Optional[str] = None
    base_cost: Optional[Decimal] = Field(None, ge=0, decimal_places=4)
    default_price: Optional[Decimal] = Field(None, ge=0, decimal_places=4)
    unit_of_measure: Optional[str] = None
    iss_aliquota: Optional[Decimal] = Field(None, ge=0, le=100, decimal_places=2)
    iss_retido_default: Optional[bool] = None
    inss_retencao_aliquota: Optional[Decimal] = Field(None, ge=0, le=100, decimal_places=2)
    is_active: Optional[bool] = None

    @field_validator("lc116_code")
    @classmethod
    def sanitize_lc116(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        trimmed = value.strip()
        if not re.match(r"^\d{2}(\.\d{2})?$", trimmed):
            raise ValueError(f"Código LC 116/03 inválido: '{value}'. Formato esperado: '07.02' ou '0702'.")
        return trimmed

    @field_validator("unit_of_measure")
    @classmethod
    def sanitize_unit(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.strip().upper()


class ServiceResponse(ServiceBase):
    """
    Schema de resposta serializado de serviço.
    """
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }
