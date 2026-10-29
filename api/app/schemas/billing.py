"""
=============================================================================
GADAP Hub - Schemas Pydantic para Checkout SaaS & Gateway PF (Asaas)
Arquivo: api/app/schemas/billing.py
=============================================================================
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class SubscribeRequest(BaseModel):
    """
    Payload enviado pelo frontend ou cliente para iniciar a assinatura
    ou checkout do SaaS via Gateway PF (Asaas).
    """
    company_id: Optional[UUID] = Field(None, description="UUID da empresa no Supabase (se já cadastrada)")
    customer_name: str = Field(..., description="Nome Completo ou Razão Social")
    cpf_cnpj: str = Field(..., description="CPF do comprador PF ou CNPJ da construtora")
    email: str = Field(..., description="E-mail principal para cobrança e login")
    phone: Optional[str] = Field(None, description="Telefone com DDD")
    plan_tier: str = Field(default="pro", description="pro, enterprise, starter")
    billing_type: Literal["PIX", "BOLETO", "CREDIT_CARD"] = Field(
        default="PIX", description="Método de pagamento: PIX, BOLETO ou CREDIT_CARD"
    )
    cycle: Literal["MONTHLY", "SEMIANNUALLY", "YEARLY"] = Field(
        default="MONTHLY", description="Ciclo de cobrança: MONTHLY, SEMIANNUALLY, YEARLY"
    )
    selected_modules: List[str] = Field(
        default_factory=lambda: ["core_fiscal"],
        description="Módulos selecionados: core_fiscal, rh, suprimentos, crm",
    )
    credit_card: Optional[Dict[str, Any]] = Field(
        None, description="Dados do cartão de crédito (se billing_type=CREDIT_CARD)"
    )


class SubscribeResponse(BaseModel):
    """
    Resposta do checkout contendo ID do cliente no gateway, id da assinatura
    e dados de pagamento (Pix Copy/Paste, QR Code, Boleto ou status do Cartão).
    """
    success: bool
    message: str
    company_id: Optional[str] = None
    gateway_customer_id: Optional[str] = None
    subscription_id: Optional[str] = None
    billing_type: str
    value: float
    status: str
    pix_copy_paste: Optional[str] = None
    pix_qr_code_url: Optional[str] = None
    bank_slip_url: Optional[str] = None
    invoice_url: Optional[str] = None


class CustomerBillingData(BaseModel):
    customer_name: str = Field(..., description="Razão Social ou Nome do Cliente / Construtora")
    customer_cnpj: str = Field(..., description="CNPJ (14 dígitos) ou CPF do Cliente")
    customer_email: Optional[str] = Field(None, description="Email de contato e do usuário administrador")
    customer_phone: Optional[str] = None
    trade_name: Optional[str] = None
    plan_tier: Optional[str] = Field(default="pro", description="Plano contratado: starter, pro, enterprise")
    tax_regime: Optional[str] = Field(default="simples_nacional", description="simples_nacional, mei, lucro_presumido, lucro_real")
    amount_paid: Optional[Decimal] = None
    subscription_id: Optional[str] = None


class BillingWebhookPayload(BaseModel):
    event: str = Field(..., description="Nome do evento (ex: PAYMENT_CONFIRMED, PAYMENT_RECEIVED, payment.succeeded)")
    data: Optional[CustomerBillingData] = None
    payment: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None


class BillingWebhookResponse(BaseModel):
    status: str
    company: Optional[str] = None
    tenant_id: Optional[UUID] = None
    admin_user_id: Optional[UUID] = None
    role: Optional[str] = None
    message: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
