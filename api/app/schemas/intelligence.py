"""
=============================================================================
GADAP Hub - Schemas de Tax Intelligence & Monitoramento Legal (Fase 10)
Arquivo: api/app/schemas/intelligence.py
=============================================================================
"""

from datetime import date, datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class LegislationImpactLevel:
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class LegislationCategory:
    TAX = "tax"
    ISS = "iss"
    INSS = "inss"
    IRRF = "irrf"
    NFSE = "nfse"
    IBPT = "ibpt"
    REFORMA_TRIBUTARIA = "reforma_tributaria"
    TRABALHISTA = "trabalhista"
    AMBIENTAL = "ambiental"


class LegislationUpdateBase(BaseModel):
    source: str = Field(..., description="Fonte oficial da atualização (ex: IBPT, Receita Federal, Planalto, SEFAZ)")
    title: str = Field(..., min_length=3, max_length=255, description="Título descritivo da alteração ou nota fiscal")
    summary: str = Field(..., description="Resumo executivo do impacto na construção civil e engenharia")
    law_reference: Optional[str] = Field(None, max_length=100, description="Número/Artigo da lei ou Nota Técnica (ex: LC 116/2003, NT 2026.002)")
    category: str = Field(default="tax", description="Categoria tributária (iss, inss, irrf, nfse, ibpt, reforma_tributaria)")
    impact_level: str = Field(default="info", description="Nível de impacto: info, warning ou critical")
    effective_date: Optional[date] = Field(None, description="Data de entrada em vigor ou publicação oficial")
    details: Dict[str, Any] = Field(default_factory=dict, description="Metadados complementares (alíquotas, regras de retenção, NCM/NBS)")


class LegislationUpdateCreate(LegislationUpdateBase):
    tenant_id: Optional[UUID] = Field(None, description="ID do Tenant opcional (None = alerta global do ecossistema)")
    raw_content: Optional[str] = Field(None, description="Conteúdo bruto capturado via scraping ou payload de API")
    content_hash: str = Field(..., description="Hash SHA-256 de identificação unívoca para detecção de duplicidades")


class LegislationUpdateResponse(LegislationUpdateBase):
    id: UUID
    tenant_id: Optional[UUID] = None
    content_hash: str
    detected_at: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LegislationAlertsListResponse(BaseModel):
    total: int = Field(..., description="Quantidade total de alertas localizados")
    sources_monitored: List[str] = Field(..., description="Fontes rastreadas ativamente pelo monitor")
    last_sync_at: Optional[datetime] = Field(None, description="Data e hora da última sincronização bem-sucedida")
    alerts: List[LegislationUpdateResponse] = Field(..., description="Lista de atualizações e alertas ordenados por criticidade")


class LegislationSyncResponse(BaseModel):
    status: str = Field(..., description="Resultado do ciclo de monitoramento")
    checked_sources: int = Field(..., description="Número de fontes governamentais/fiscais consultadas")
    new_alerts_detected: int = Field(..., description="Número de alterações inéditas registradas no banco")
    message: str = Field(..., description="Mensagem de resumo do ciclo de Tax Intelligence")
    details: List[Dict[str, Any]] = Field(default_factory=list, description="Detalhes das novas ocorrências salvas")
