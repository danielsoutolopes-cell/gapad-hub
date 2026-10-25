from datetime import date, datetime
from decimal import Decimal
from enum import Enum
import re
from typing import Any, Dict, Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class ProjectStatus(str, Enum):
    """
    Status oficiais do ciclo de vida de uma Obra no GADAP Hub.
    """
    PLANEJAMENTO = "planejamento"
    EM_ANDAMENTO = "em_andamento"
    PARALISADA = "paralisada"
    CONCLUIDA = "concluida"
    CANCELADA = "cancelada"


class ProjectBase(BaseModel):
    """
    Schema base com todos os atributos operacionais e cadastrais da Obra.
    """
    client_id: UUID = Field(
        ...,
        description="Identificador do Cliente Contratante (FK para clients)",
        example="018f3a2b-7c1e-7b5a-9d2e-3f4a5b6c7d8e",
    )
    name: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="Nome comercial ou identificador do Empreendimento/Obra",
        example="Edifício Residencial Jardins - Torre 1",
    )
    code: Optional[str] = Field(
        None,
        max_length=50,
        description="Código interno da obra ou centro de custo corporativo",
        example="OBR-2026-001",
    )
    description: Optional[str] = Field(
        None,
        description="Memorial descritivo resumido ou escopo do contrato",
        example="Construção civil de edifício residencial multifamiliar com 22 pavimentos.",
    )
    cno: Optional[str] = Field(
        None,
        max_length=20,
        description="Cadastro Nacional de Obras (CNO) na Receita Federal do Brasil",
        example="12.345.67890/12",
    )
    art_rrt: Optional[str] = Field(
        None,
        max_length=50,
        description="Anotação de Responsabilidade Técnica (ART/CREA) ou RRT/CAU",
        example="ART-SP-2026-987654",
    )
    contract_value: Decimal = Field(
        default=Decimal("0.0000"),
        ge=0,
        description="Valor total pactuado no contrato da obra (numeric 18,4)",
        example=1500000.0000,
    )
    technical_retention_perc: Decimal = Field(
        default=Decimal("5.00"),
        ge=0,
        le=100,
        description="Percentual de retenção técnica contratual de garantia (0% a 100%)",
        example=5.00,
    )
    start_date: Optional[date] = Field(
        None,
        description="Data de início ou expedição da ordem de serviço",
        example="2026-03-01",
    )
    end_date_planned: Optional[date] = Field(
        None,
        description="Data planejada/prevista para entrega da obra",
        example="2027-08-31",
    )
    expected_end_date: Optional[date] = Field(
        None,
        description="Alias de compatibilidade para data prevista de conclusão",
        example="2027-08-31",
    )
    actual_end_date: Optional[date] = Field(
        None,
        description="Data real da conclusão com expedição do Habite-se",
        example=None,
    )
    status: ProjectStatus = Field(
        default=ProjectStatus.PLANEJAMENTO,
        description="Situação operacional da obra",
        example=ProjectStatus.PLANEJAMENTO,
    )
    address_city_ibge: Optional[str] = Field(
        None,
        description="Código IBGE do município com 7 dígitos (ex: 3550308 para São Paulo)",
        example="3550308",
    )
    address_state: Optional[str] = Field(
        None,
        min_length=2,
        max_length=2,
        description="Sigla da Unidade Federativa da obra (UF com 2 dígitos)",
        example="SP",
    )
    address_street: Optional[str] = Field(None, max_length=255)
    address_number: Optional[str] = Field(None, max_length=30)
    address_complement: Optional[str] = Field(None, max_length=100)
    address_neighborhood: Optional[str] = Field(None, max_length=100)
    address_city: Optional[str] = Field(None, max_length=100)
    address_zip_code: Optional[str] = Field(None, max_length=10)

    @field_validator("address_city_ibge")
    @classmethod
    def sanitize_ibge_code(cls, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        cleaned = re.sub(r"\D", "", value)
        if len(cleaned) != 7:
            raise ValueError(
                f"Código IBGE de município inválido: '{value}'. Deve conter exatamente 7 dígitos numéricos."
            )
        return cleaned

    @field_validator("address_state")
    @classmethod
    def sanitize_state(cls, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        return value.strip().upper()


class ProjectCreate(ProjectBase):
    """
    Schema de entrada para cadastro de nova obra.
    O tenant_id é injetado compulsoriamente via autenticação JWT.
    """
    pass


class ProjectUpdate(BaseModel):
    """
    Schema para alteração parcial de dados da obra (PATCH/PUT).
    """
    client_id: Optional[UUID] = None
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    code: Optional[str] = None
    description: Optional[str] = None
    cno: Optional[str] = None
    art_rrt: Optional[str] = None
    contract_value: Optional[Decimal] = Field(None, ge=0)
    technical_retention_perc: Optional[Decimal] = Field(None, ge=0, le=100)
    start_date: Optional[date] = None
    end_date_planned: Optional[date] = None
    expected_end_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    status: Optional[ProjectStatus] = None
    address_city_ibge: Optional[str] = None
    address_state: Optional[str] = Field(None, min_length=2, max_length=2)
    address_street: Optional[str] = None
    address_number: Optional[str] = None
    address_complement: Optional[str] = None
    address_neighborhood: Optional[str] = None
    address_city: Optional[str] = None
    address_zip_code: Optional[str] = None

    @field_validator("address_city_ibge")
    @classmethod
    def sanitize_ibge_code(cls, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        cleaned = re.sub(r"\D", "", value)
        if len(cleaned) != 7:
            raise ValueError(
                f"Código IBGE de município inválido: '{value}'. Deve conter exatamente 7 dígitos numéricos."
            )
        return cleaned

    @field_validator("address_state")
    @classmethod
    def sanitize_state(cls, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        return value.strip().upper()


class ProjectResponse(ProjectBase):
    """
    Schema de retorno serializado para frontend e integrações.
    """
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime
    clients: Optional[Dict[str, Any]] = None

    model_config = {
        "from_attributes": True
    }
