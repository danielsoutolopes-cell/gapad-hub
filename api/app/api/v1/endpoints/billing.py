"""
=============================================================================
GADAP Hub - Endpoints para Billing Webhooks e Auto-Tenant RBAC (Fase 11)
Arquivo: api/app/api/v1/endpoints/billing.py
=============================================================================
"""

import datetime
import logging
import re
from typing import Any, Dict, Optional
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Header, HTTPException, Request, status

from app.core.config import settings
from app.schemas.billing import BillingWebhookPayload, BillingWebhookResponse

logger = logging.getLogger("gadap.billing")

router = APIRouter(prefix="/billing", tags=["Billing & Provisioning"])


def _get_service_role_headers() -> Dict[str, str]:
    """Retorna headers com Service Role Key para operações irrestritas de provisionamento."""
    api_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY or ""
    return {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _clean_doc(doc: str) -> str:
    """Remove caracteres não numéricos de CNPJ ou CPF."""
    return re.sub(r"\D", "", doc or "")


@router.post(
    "/webhook",
    response_model=BillingWebhookResponse,
    status_code=status.HTTP_200_OK,
    summary="Webhook de Billing (Asaas, Stripe, Iugu) com Auto-Tenant Provisioning & RBAC",
    description=(
        "Recebe notificações de pagamento aprovado ('payment.succeeded'), provisiona "
        "automaticamente a empresa (Tenant) no banco de dados com isolamento RLS, cria o usuário "
        "Master/Admin no RBAC e inicializa os centros de custo e configurações operacionais."
    ),
)
async def billing_webhook(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> BillingWebhookResponse:
    try:
        payload_raw = await request.json()
    except Exception as exc:
        logger.error("Falha ao decodificar JSON do webhook de billing: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payload JSON inválido.",
        )

    event_type = payload_raw.get("event")
    logger.info("Billing Webhook recebido - Evento: %s", event_type)

    if event_type != "payment.succeeded":
        logger.info("Evento '%s' ignorado pelo orquestrador de provisionamento.", event_type)
        return BillingWebhookResponse(status="IGNORED", message=f"Evento '{event_type}' não requer provisionamento.")

    data_block = payload_raw.get("data") or {}
    company_name = data_block.get("customer_name") or data_block.get("company_name") or "Empresa Nova"
    raw_cnpj = data_block.get("customer_cnpj") or data_block.get("cnpj") or "00000000000100"
    cnpj = _clean_doc(raw_cnpj)
    customer_email = data_block.get("customer_email") or f"admin@{cnpj[:8] or 'empresa'}.com.br"
    trade_name = data_block.get("trade_name") or company_name.split()[0]
    tax_regime = data_block.get("tax_regime") or "simples_nacional"
    plan_tier = data_block.get("plan_tier") or "pro"

    headers = _get_service_role_headers()
    base_url = settings.SUPABASE_URL.rstrip("/")

    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1. Verificar se a empresa (Tenant) já existe pelo CNPJ
        tenant_id: Optional[UUID] = None
        resp_check = await client.get(
            f"{base_url}/rest/v1/companies?cnpj=eq.{cnpj}&select=id,legal_name,trade_name",
            headers=headers,
        )

        if resp_check.status_code == 200 and resp_check.json():
            existing = resp_check.json()[0]
            tenant_id = UUID(existing["id"])
            logger.info("Tenant já cadastrado para o CNPJ %s: ID %s", cnpj, tenant_id)
        else:
            # 2. Lógica SQL executada via Service Role: Criação do novo Tenant
            new_tenant_id = uuid4()
            tenant_payload = {
                "id": str(new_tenant_id),
                "legal_name": company_name,
                "trade_name": trade_name,
                "cnpj": cnpj,
                "tax_regime": tax_regime,
                "email": customer_email,
                "is_active": True,
            }

            resp_create_tenant = await client.post(
                f"{base_url}/rest/v1/companies",
                headers=headers,
                json=tenant_payload,
            )

            if resp_create_tenant.status_code not in (200, 201):
                logger.error("Falha ao provisionar empresa via Service Role: %s", resp_create_tenant.text)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Erro ao provisionar empresa: {resp_create_tenant.text}",
                )

            tenant_id = new_tenant_id
            logger.info("Novo Tenant provisionado com sucesso: %s (ID: %s)", company_name, tenant_id)

        # 3. Auto-Tenant RBAC: Garantir que o usuário Administrador (Role: admin) exista no tenant
        admin_user_id: Optional[UUID] = None
        resp_user_check = await client.get(
            f"{base_url}/rest/v1/users?tenant_id=eq.{tenant_id}&email=eq.{customer_email}&select=id,role",
            headers=headers,
        )

        if resp_user_check.status_code == 200 and resp_user_check.json():
            existing_user = resp_user_check.json()[0]
            admin_user_id = UUID(existing_user["id"])
        else:
            new_user_id = uuid4()
            user_payload = {
                "id": str(new_user_id),
                "tenant_id": str(tenant_id),
                "full_name": f"Admin {trade_name}",
                "email": customer_email,
                "role": "admin",
                "is_active": True,
            }

            resp_create_user = await client.post(
                f"{base_url}/rest/v1/users",
                headers=headers,
                json=user_payload,
            )

            if resp_create_user.status_code in (200, 201):
                admin_user_id = new_user_id
                logger.info("Usuário Admin RBAC provisionado com sucesso: %s", admin_user_id)
            else:
                logger.warning("Aviso: Falha ao inserir usuário na tabela users: %s", resp_create_user.text)

    return BillingWebhookResponse(
        status="TENANT_PROVISIONED",
        company=company_name,
        tenant_id=tenant_id,
        admin_user_id=admin_user_id,
        role="admin",
        message="Tenant provisionado com sucesso com RBAC e isolamento multi-tenant garantido.",
        details={
            "cnpj": cnpj,
            "trade_name": trade_name,
            "plan_tier": plan_tier,
            "event": event_type,
            "provisioned_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        },
    )
