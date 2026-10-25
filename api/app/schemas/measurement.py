from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class MeasurementStatus(str, Enum):
    """
    Status do fluxo operacional da Medição de Obra.
    """
    RASCUNHO = "rascunho"
    ENVIADA = "enviada"
    APROVADA = "aprovada"
    FATURADA = "faturada"
    REJEITADA = "rejeitada"


class MeasurementCreate(BaseModel):
    """
    Schema de entrada para emissão de um novo boletim de medição.
    
    REGRA DE NEGÓCIO INEGOCIÁVEL (DETERMINISMO):
    O frontend/cliente envia APENAS o 'valor_medido' e opcionalmente o percentual 'retencao_tecnica_perc'.
    O backend Python calcula compulsoriamente 'retencao_tecnica' e 'valor_liquido' usando Decimal
    e arredondamento bancário (ROUND_HALF_EVEN). O cliente NUNCA envia valores finais calculados.
    """
    project_id: UUID = Field(
        ...,
        description="Identificador da Obra (FK para projects)",
        example="018f3a2b-7c1e-7b5a-9d2e-3f4a5b6c7d8e",
    )
    numero_sequencial: Optional[int] = Field(
        None,
        ge=1,
        description="Número sequencial da medição (ex: 1 para 1ª Medição). Se omitido, o backend auto-incrementa.",
        example=1,
    )
    periodo_inicio: date = Field(
        ...,
        description="Data de início do ciclo/período de apuração física",
        example="2026-03-01",
    )
    periodo_fim: date = Field(
        ...,
        description="Data de encerramento do ciclo de apuração física",
        example="2026-03-31",
    )
    valor_medido: Decimal = Field(
        ...,
        ge=0,
        description="Valor bruto apurado na medição física (numeric 18,4)",
        example=120000.0000,
    )
    retencao_tecnica_perc: Optional[Decimal] = Field(
        None,
        ge=0,
        le=100,
        description="Percentual de retenção técnica contratual (ex: 5.0 para 5%). Se omitido, utiliza a taxa cadastrada na Obra.",
        example=5.00,
    )
    status: MeasurementStatus = Field(
        default=MeasurementStatus.RASCUNHO,
        description="Status inicial do boletim de medição",
        example=MeasurementStatus.RASCUNHO,
    )
    observacoes: Optional[str] = Field(
        None,
        description="Notas de fiscalização técnica, memorial de cálculo ou registros do canteiro",
        example="Medição referente à concretagem da laje do 4º pavimento e alvenaria perimetral.",
    )

    @field_validator("periodo_fim")
    @classmethod
    def validate_periodo(cls, v: date, info) -> date:
        inicio = info.data.get("periodo_inicio")
        if inicio and v < inicio:
            raise ValueError(
                f"Data final do período ({v}) não pode ser anterior à data inicial ({inicio})."
            )
        return v


class MeasurementUpdate(BaseModel):
    """
    Schema para atualização de boletim de medição existente.
    """
    periodo_inicio: Optional[date] = None
    periodo_fim: Optional[date] = None
    valor_medido: Optional[Decimal] = Field(None, ge=0)
    retencao_tecnica_perc: Optional[Decimal] = Field(None, ge=0, le=100)
    status: Optional[MeasurementStatus] = None
    observacoes: Optional[str] = None

    @field_validator("periodo_fim")
    @classmethod
    def validate_periodo(cls, v: Optional[date], info) -> Optional[date]:
        if v is None:
            return None
        inicio = info.data.get("periodo_inicio")
        if inicio and v < inicio:
            raise ValueError(
                f"Data final do período ({v}) não pode ser anterior à data inicial ({inicio})."
            )
        return v


class MeasurementResponse(BaseModel):
    """
    Schema de resposta oficial do boletim de medição.
    Retorna os valores monetários calculados de forma auditável e determinística.
    """
    id: UUID
    tenant_id: UUID
    project_id: UUID
    numero_sequencial: int
    periodo_inicio: date
    periodo_fim: date
    valor_medido: Decimal = Field(..., description="Valor bruto medido (R$)")
    retencao_tecnica: Decimal = Field(..., description="Valor monetário retido calculado (R$)")
    valor_liquido: Decimal = Field(..., description="Valor líquido a faturar (R$)")
    status: MeasurementStatus
    observacoes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    projects: Optional[Dict[str, Any]] = None

    model_config = {
        "from_attributes": True
    }
