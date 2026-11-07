"""
=============================================================================
GADAP Hub - Schemas Pydantic para Cronograma Físico-Financeiro (Gantt) & Curva S
Fase 20 • Prompt 92
=============================================================================
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class ProjectTaskBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Nome da etapa/tarefa da obra")
    start_date: date = Field(..., description="Data de início previsto")
    end_date: date = Field(..., description="Data de término previsto")
    planned_start: Optional[date] = Field(None, description="Data planejada de início")
    planned_end: Optional[date] = Field(None, description="Data planejada de término")
    actual_start: Optional[date] = Field(None, description="Data real de início")
    actual_end: Optional[date] = Field(None, description="Data real de término")
    parent_task_id: Optional[UUID] = Field(None, description="Tarefa pai na árvore WBS")
    wbs_code: Optional[str] = Field(None, description="Código WBS (ex: 1.1, 1.2)")
    progress_percentage: float = Field(default=0.0, ge=0.0, le=100.0, description="Percentual de avanço físico executado (0 a 100%)")
    budget_rubric_id: Optional[UUID] = Field(default=None, description="Vínculo com rubrica orçamentária")
    dependencies_json: List[str] = Field(default_factory=list, description="IDs das tarefas predecessoras")
    planned_cost: Optional[float] = Field(default=0.0, ge=0.0, description="Custo financeiro planejado para a tarefa")
    sort_order: Optional[int] = Field(default=0, description="Ordem de exibição no gráfico de Gantt")


class ProjectTaskCreate(ProjectTaskBase):
    pass


class ProjectTaskUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    planned_start: Optional[date] = None
    planned_end: Optional[date] = None
    actual_start: Optional[date] = None
    actual_end: Optional[date] = None
    parent_task_id: Optional[UUID] = None
    wbs_code: Optional[str] = None
    progress_percentage: Optional[float] = Field(None, ge=0.0, le=100.0)
    budget_rubric_id: Optional[UUID] = None
    dependencies_json: Optional[List[str]] = None
    planned_cost: Optional[float] = None
    sort_order: Optional[int] = None


class DiaryInputPayload(BaseModel):
    workforce_count: Optional[int] = Field(default=0, ge=0, description="Contingente de trabalhadores no dia")
    weather_condition: Optional[str] = Field(default="ENSOLARADO", description="Condição climática")
    observations: Optional[str] = Field(None, description="Relato das atividades e ocorrências")
    photo_urls: Optional[List[str]] = Field(default_factory=list, description="Fotos probatórias do avanço")


class TaskProgressUpdatePayload(BaseModel):
    progress_percentage: float = Field(..., ge=0.0, le=100.0, description="Novo percentual de avanço")
    actual_start: Optional[date] = None
    actual_end: Optional[date] = None
    field_report: Optional[DiaryInputPayload] = None


class ProjectTaskResponse(ProjectTaskBase):
    id: UUID
    project_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CurveSDataPoint(BaseModel):
    period: str = Field(..., description="Data ou mês de referência (YYYY-MM ou YYYY-MM-DD)")
    planned_percentage: float = Field(..., description="% acumulado previsto (linha azul)")
    realized_percentage: float = Field(..., description="% acumulado realizado (linha verde)")
    planned_amount: float = Field(..., description="Valor financeiro acumulado planejado (R$)")
    realized_amount: float = Field(..., description="Valor financeiro acumulado realizado/medido (R$)")


class CurveSResponse(BaseModel):
    project_id: UUID
    project_name: str
    total_budget: float
    total_realized: float
    current_physical_progress: float
    current_financial_progress: float
    data_points: List[CurveSDataPoint]

