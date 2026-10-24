from datetime import datetime
from enum import Enum
import re
from typing import Any, Dict, Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator


class PersonType(str, Enum):
    PF = "PF"
    PJ = "PJ"


class SupplierBase(BaseModel):
    person_type: PersonType = Field(
        default=PersonType.PJ,
        description="Tipo de fornecedor: 'PF' (Pessoa Física) ou 'PJ' (Pessoa Jurídica)",
        example="PJ",
    )
    document: str = Field(
        ...,
        description="Número do CPF (11 dígitos) ou CNPJ (14 dígitos) do fornecedor",
        example="11222333000181",
    )
    name: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="Razão Social ou Nome Completo do fornecedor",
        example="Distribuidora de Cimento e Concreto São Paulo Ltda",
    )
    trade_name: Optional[str] = Field(
        None,
        max_length=255,
        description="Nome Fantasia do fornecedor",
        example="Cimento São Paulo",
    )
    category: Optional[str] = Field(
        None,
        max_length=100,
        description="Categoria (ex: materiais_construcao, subempreiteira, locacao_equipamentos)",
        example="materiais_construcao",
    )
    email: Optional[EmailStr] = Field(
        None,
        description="E-mail de contato corporativo/financeiro do fornecedor",
        example="pedidos@cimentosp.com.br",
    )
    phone: Optional[str] = Field(
        None,
        max_length=30,
        description="Telefone com DDD",
        example="11988887777",
    )
    contact_name: Optional[str] = Field(
        None,
        max_length=100,
        description="Nome do representante comercial ou contato de obra",
        example="Carlos Eduardo",
    )
    state_registration: Optional[str] = Field(None, max_length=30)
    municipal_registration: Optional[str] = Field(None, max_length=30)
    address_street: Optional[str] = Field(None, max_length=255)
    address_number: Optional[str] = Field(None, max_length=30)
    address_complement: Optional[str] = Field(None, max_length=100)
    address_neighborhood: Optional[str] = Field(None, max_length=100)
    address_city: Optional[str] = Field(None, max_length=100)
    address_state: Optional[str] = Field(None, min_length=2, max_length=2)
    address_zip_code: Optional[str] = Field(None, max_length=10)
    bank_info: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Dados bancários e chave PIX para pagamentos",
    )
    notes: Optional[str] = None
    is_active: bool = True

    @field_validator("document")
    @classmethod
    def validate_and_sanitize_document(cls, value: str) -> str:
        digits = re.sub(r"\D", "", value)
        if len(digits) not in (11, 14):
            raise ValueError(
                f"Documento inválido: '{value}'. Forneça 11 dígitos para CPF ou 14 dígitos para CNPJ."
            )
        return digits


class SupplierCreate(SupplierBase):
    """
    Payload de cadastro de fornecedor.
    tenant_id é injetado pelo backend com base no JWT do usuário autenticado.
    """
    pass


class SupplierUpdate(BaseModel):
    """
    Payload para atualização parcial (PATCH/PUT) de fornecedor.
    """
    person_type: Optional[PersonType] = None
    document: Optional[str] = None
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    trade_name: Optional[str] = None
    category: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    contact_name: Optional[str] = None
    state_registration: Optional[str] = None
    municipal_registration: Optional[str] = None
    address_street: Optional[str] = None
    address_number: Optional[str] = None
    address_complement: Optional[str] = None
    address_neighborhood: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = Field(None, min_length=2, max_length=2)
    address_zip_code: Optional[str] = None
    bank_info: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("document")
    @classmethod
    def validate_and_sanitize_document(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        digits = re.sub(r"\D", "", value)
        if len(digits) not in (11, 14):
            raise ValueError(
                f"Documento inválido: '{value}'. Forneça 11 dígitos para CPF ou 14 dígitos para CNPJ."
            )
        return digits


class SupplierResponse(SupplierBase):
    """
    Schema de retorno serializado para clientes e API.
    """
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }
