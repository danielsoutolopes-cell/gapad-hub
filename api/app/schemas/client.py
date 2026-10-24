from datetime import datetime
from enum import Enum
import re
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator


class PersonType(str, Enum):
    PF = "PF"
    PJ = "PJ"


class ClientBase(BaseModel):
    person_type: PersonType = Field(
        default=PersonType.PJ,
        description="Tipo de tomador: 'PF' (Pessoa Física) ou 'PJ' (Pessoa Jurídica)",
        example="PJ",
    )
    document: str = Field(
        ...,
        description="Número do documento cadastral: CPF (11 dígitos) ou CNPJ (14 dígitos)",
        example="12345678000195",
    )
    name: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="Razão Social ou Nome Completo do Tomador do Serviço",
        example="Construtora e Empreiteira Horizonte Ltda",
    )
    trade_name: Optional[str] = Field(
        None,
        max_length=255,
        description="Nome Fantasia do Tomador",
        example="Horizonte Engenharia",
    )
    email: Optional[EmailStr] = Field(
        None,
        description="E-mail corporativo para envio automático de DANFEs, NFS-e e boletos",
        example="financeiro@horizonte.com.br",
    )
    phone: Optional[str] = Field(
        None,
        max_length=30,
        description="Telefone ou celular com DDD para notificações automáticas via WhatsApp",
        example="11999998888",
    )
    state_registration: Optional[str] = Field(
        None,
        max_length=30,
        description="Inscrição Estadual (IE)",
    )
    municipal_registration: Optional[str] = Field(
        None,
        max_length=30,
        description="Inscrição Municipal (IM)",
    )
    address_street: Optional[str] = Field(None, max_length=255)
    address_number: Optional[str] = Field(None, max_length=30)
    address_complement: Optional[str] = Field(None, max_length=100)
    address_neighborhood: Optional[str] = Field(None, max_length=100)
    address_city: Optional[str] = Field(None, max_length=100)
    address_state: Optional[str] = Field(None, min_length=2, max_length=2)
    address_zip_code: Optional[str] = Field(None, max_length=10)
    notes: Optional[str] = None
    is_active: bool = True

    @field_validator("document")
    @classmethod
    def validate_and_sanitize_document(cls, value: str) -> str:
        digits_only = re.sub(r"\D", "", value)
        if len(digits_only) not in (11, 14):
            raise ValueError(
                f"Documento inválido: '{value}'. Esperado 11 dígitos para CPF ou 14 dígitos para CNPJ."
            )
        return digits_only


class ClientCreate(ClientBase):
    """
    Schema utilizado para inserção de um novo cliente.
    O tenant_id é injetado compulsoriamente pelo backend via token JWT.
    """
    pass


class ClientUpdate(BaseModel):
    """
    Schema para atualização parcial de dados do cliente (PATCH/PUT).
    """
    person_type: Optional[PersonType] = None
    document: Optional[str] = None
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    trade_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    state_registration: Optional[str] = None
    municipal_registration: Optional[str] = None
    address_street: Optional[str] = None
    address_number: Optional[str] = None
    address_complement: Optional[str] = None
    address_neighborhood: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = Field(None, min_length=2, max_length=2)
    address_zip_code: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("document")
    @classmethod
    def validate_and_sanitize_document(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        digits_only = re.sub(r"\D", "", value)
        if len(digits_only) not in (11, 14):
            raise ValueError(
                f"Documento inválido: '{value}'. Esperado 11 dígitos para CPF ou 14 dígitos para CNPJ."
            )
        return digits_only


class ClientResponse(ClientBase):
    """
    Schema de resposta serializado para o frontend / consumidores de API.
    Garante o retorno do ID único e do tenant_id para rastreabilidade e auditoria.
    """
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }
