"""
=============================================================================
GADAP Hub - Schemas Pydantic para Logística de Canteiro e Portaria Digital
Arquivo: api/app/schemas/transfers.py
=============================================================================
"""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class GeolocationData(BaseModel):
    latitude: Optional[float] = Field(None, description="Latitude GPS")
    longitude: Optional[float] = Field(None, description="Longitude GPS")
    accuracy: Optional[float] = Field(None, description="Precisão em metros")
    timestamp: Optional[str] = Field(None, description="Timestamp da leitura")


class MaterialTransferCreate(BaseModel):
    """
    Payload enviado pelo frontend mobile para registro de Retirada ou Recebimento.
    """
    type: Literal["WITHDRAWAL", "RECEIPT"] = Field(
        ..., description="Tipo do termo: WITHDRAWAL (Retirada) ou RECEIPT (Recebimento)"
    )
    description: str = Field(
        ..., description="Discriminação detalhada dos materiais, ferramentas ou insumos"
    )
    carrier_name: str = Field(
        ..., description="Nome do motorista, portador ou responsável pelo transporte"
    )
    carrier_document: str = Field(
        ..., description="CPF ou RG do motorista/portador"
    )
    license_plate: Optional[str] = Field(
        None, description="Placa do veículo / caminhão (opcional)"
    )
    signature_base64: str = Field(
        ..., description="Assinatura manuscrita capturada no touchscreen (Base64)"
    )
    photos_base64: Optional[List[str]] = Field(
        default_factory=list, description="Fotos em Base64 ou URLs anexadas no canteiro"
    )
    geolocation: Optional[GeolocationData] = Field(
        None, description="Coordenadas geográficas GPS capturadas no momento da assinatura"
    )


class MaterialTransferResponse(BaseModel):
    """
    Retorno da criação do termo de transferência.
    """
    transfer_id: UUID
    project_id: UUID
    tenant_id: UUID
    type: str
    description: str
    carrier_name: str
    carrier_document: str
    license_plate: Optional[str] = None
    pdf_url: str
    created_at: datetime
    message: str = "Termo de Responsabilidade e Guarda gerado com sucesso!"


class TransferNotifyRequest(BaseModel):
    """
    Payload para disparo de notificações via WhatsApp pelo modal de compartilhamento.
    """
    phones: List[str] = Field(
        ..., min_length=1, max_length=3, description="Lista de até 3 telefones destinatários com DDD"
    )


class TransferNotifyResponse(BaseModel):
    """
    Resposta do envio dos recibos em PDF via Evolution API.
    """
    transfer_id: UUID
    dispatched_count: int
    results: List[Dict[str, Any]]
    message: str
