"""
=============================================================================
GADAP Hub - Schemas Pydantic para Captura de DFe e Manifestação SEFAZ (Fase 14)
=============================================================================
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class InboundInvoiceItem(BaseModel):
    id: UUID
    tenant_id: UUID
    access_key: str = Field(..., min_length=44, max_length=44, description="Chave de acesso de 44 dígitos da NF-e")
    issuer_cnpj: str
    issuer_name: Optional[str] = None
    issuer_trade_name: Optional[str] = None
    total_amount: Decimal
    manifestation_status: str = Field(
        default="NOT_MANIFESTED",
        description="NOT_MANIFESTED, CIENCIA_DA_OPERACAO, CONFIRMACAO_DA_OPERACAO, DESCONHECIMENTO, OPERACAO_NAO_REALIZADA",
    )
    manifestation_date: Optional[datetime] = None
    manifestation_protocol: Optional[str] = None
    financial_entry_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    project_name: Optional[str] = None
    issue_date: Optional[date] = None
    operation_type: Optional[str] = "COMPRA_INSUMO"
    xml_data: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class InboundInvoicesListResponse(BaseModel):
    items: List[InboundInvoiceItem]
    total_count: int
    total_amount_sum: Decimal
    not_manifested_count: int
    confirmed_count: int
    converted_count: int


class SefazSyncResponse(BaseModel):
    success: bool
    synchronized_count: int
    new_invoices_count: int
    updated_count: int
    message: str
    last_nsu: Optional[str] = None


class SefazManifestRequest(BaseModel):
    event_type: str = Field(
        ...,
        description="CIENCIA_DA_OPERACAO (210210), CONFIRMACAO_DA_OPERACAO (210200), DESCONHECIMENTO (210220), OPERACAO_NAO_REALIZADA (210240)",
    )
    justification: Optional[str] = Field(None, max_length=255)


class SefazManifestResponse(BaseModel):
    success: bool
    invoice_id: UUID
    access_key: str
    manifestation_status: str
    protocol_number: str
    manifestation_date: datetime
    message: str


class ConvertToPayableRequest(BaseModel):
    project_id: Optional[UUID] = None
    due_date: Optional[date] = None
    category: Optional[str] = "insumos_materiais"
    notes: Optional[str] = None


class ConvertToPayableResponse(BaseModel):
    success: bool
    inbound_invoice_id: UUID
    financial_entry_id: UUID
    net_amount: Decimal
    due_date: date
    message: str
