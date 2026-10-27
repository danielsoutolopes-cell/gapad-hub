"""
=============================================================================
GADAP Hub - Schemas Pydantic para Billing Webhooks e Auto-Tenant RBAC (Fase 11)
=============================================================================
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


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
    event: str = Field(..., description="Nome do evento (ex: payment.succeeded, subscription.created)")
    data: CustomerBillingData
    created_at: Optional[datetime] = None


class BillingWebhookResponse(BaseModel):
    status: str
    company: Optional[str] = None
    tenant_id: Optional[UUID] = None
    admin_user_id: Optional[UUID] = None
    role: Optional[str] = None
    message: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
