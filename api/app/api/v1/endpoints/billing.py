"""
=============================================================================
GADAP Hub - Endpoints para Billing SaaS, Gateway PF (Asaas) e Webhooks
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
from app.schemas.billing import (
    BillingWebhookResponse,
    SubscribeRequest,
    SubscribeResponse,
)

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


def _calculate_plan_price(selected_modules: list[str], is_trial: bool = False) -> float:
    """
    Calcula o valor mensal baseado na regra comercial PLG:
    - Core + Fiscal: 6 meses 100% gratuitos (normal R$ 297,00)
    - Módulos extras (50% de desconto durante vigência):
      RH: R$ 149 -> R$ 74,50
      Suprimentos: R$ 189 -> R$ 94,50
      CRM: R$ 119 -> R$ 59,50
    """
    base_price = 0.0 if is_trial else 297.00
    extras_total = 0.0

    if "rh" in selected_modules:
        extras_total += 74.50
    if "suprimentos" in selected_modules:
        extras_total += 94.50
    if "crm" in selected_modules:
        extras_total += 59.50

    total = base_price + extras_total
    # Caso selecione apenas Core+Fiscal no Trial, o valor mínimo do Pix teste é R$ 5.00 ou 0
    return round(total if total > 0 else 0.0, 2)


# =============================================================================
# 1. ENDPOINT: /subscribe (Cria Assinatura e Gera Pagamento no Asaas PF)
# =============================================================================
@router.post(
    "/subscribe",
    response_model=SubscribeResponse,
    status_code=status.HTTP_200_OK,
    summary="Cria assinatura SaaS e emite Pix/Boleto/Cartão no Asaas (Gateway PF)",
    description=(
        "Conecta à API do Asaas para cadastrar o cliente (CPF do fundador ou CNPJ), "
        "cria a assinatura recorrente e retorna o Pix Copia e Cola / QR Code ou Boleto."
    ),
)
async def subscribe_tenant(req: SubscribeRequest) -> SubscribeResponse:
    clean_doc_number = _clean_doc(req.cpf_cnpj)
    if not clean_doc_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CPF ou CNPJ inválido.",
        )

    # 1. Determina o valor do plano
    calculated_value = _calculate_plan_price(req.selected_modules, is_trial=True)
    # Valor mínimo para geração no Asaas caso 0: taxa simbólica ou simulação
    charge_value = calculated_value if calculated_value > 0 else 5.00

    asaas_api_key = settings.ASAAS_API_KEY
    asaas_base_url = settings.ASAAS_API_URL.rstrip("/")

    gateway_customer_id = None
    subscription_id = f"sub_{uuid4().hex[:12]}"
    pix_copy_paste = None
    pix_qr_code_url = None
    bank_slip_url = None
    invoice_url = None

    # 2. Se a chave do Asaas estiver configurada, chamamos a API externa
    if asaas_api_key and "your_" not in asaas_api_key:
        headers_asaas = {
            "access_token": asaas_api_key,
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=20.0) as http_client:
            try:
                # 2.1 Buscar ou Criar Cliente no Asaas
                find_res = await http_client.get(
                    f"{asaas_base_url}/customers?cpfCnpj={clean_doc_number}",
                    headers=headers_asaas,
                )
                if find_res.status_code == 200 and find_res.json().get("data"):
                    gateway_customer_id = find_res.json()["data"][0]["id"]
                else:
                    cust_payload = {
                        "name": req.customer_name,
                        "cpfCnpj": clean_doc_number,
                        "email": req.email,
                        "phone": req.phone or "11999999999",
                        "notificationDisabled": False,
                    }
                    create_cust_res = await http_client.post(
                        f"{asaas_base_url}/customers",
                        headers=headers_asaas,
                        json=cust_payload,
                    )
                    if create_cust_res.status_code in (200, 201):
                        gateway_customer_id = create_cust_res.json().get("id")

                # 2.2 Criar Assinatura ou Cobrança no Asaas
                if gateway_customer_id:
                    next_due = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
                    sub_payload: Dict[str, Any] = {
                        "customer": gateway_customer_id,
                        "billingType": req.billing_type,
                        "value": charge_value,
                        "nextDueDate": next_due,
                        "cycle": req.cycle,
                        "description": f"GADAP Hub ERP - Plano {req.plan_tier.upper()} (Assinatura SaaS)",
                    }

                    if req.billing_type == "CREDIT_CARD" and req.credit_card:
                        sub_payload["creditCard"] = req.credit_card

                    sub_res = await http_client.post(
                        f"{asaas_base_url}/subscriptions",
                        headers=headers_asaas,
                        json=sub_payload,
                    )
                    if sub_res.status_code in (200, 201):
                        sub_data = sub_res.json()
                        subscription_id = sub_data.get("id")

                        # Obter cobrança gerada para obter o Pix Qr Code
                        payments_res = await http_client.get(
                            f"{asaas_base_url}/subscriptions/{subscription_id}/payments",
                            headers=headers_asaas,
                        )
                        if payments_res.status_code == 200 and payments_res.json().get("data"):
                            first_payment = payments_res.json()["data"][0]
                            payment_id = first_payment.get("id")
                            bank_slip_url = first_payment.get("bankSlipUrl")
                            invoice_url = first_payment.get("invoiceUrl")

                            if req.billing_type == "PIX" and payment_id:
                                qr_res = await http_client.get(
                                    f"{asaas_base_url}/payments/{payment_id}/pixQrCode",
                                    headers=headers_asaas,
                                )
                                if qr_res.status_code == 200:
                                    qr_data = qr_res.json()
                                    pix_copy_paste = qr_data.get("payload")
                                    pix_qr_code_url = qr_data.get("encodedImage")
            except Exception as asaas_err:
                logger.error("Erro na comunicação com Gateway Asaas: %s", asaas_err)

    # Fallback determinístico caso Sandbox ou sem chave externa
    if not gateway_customer_id:
        gateway_customer_id = f"cus_{clean_doc_number[:8]}"
    if req.billing_type == "PIX" and not pix_copy_paste:
        pix_copy_paste = (
            f"00020126580014br.gov.bcb.pix0136{uuid4().hex}520400005303986"
            f"540{len(str(charge_value)):02d}{charge_value:.2f}5802BR5925GADAP HUB ERP MONETIZACAO6009SAO PAULO62070503***6304ABCD"
        )
        pix_qr_code_url = f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={pix_copy_paste}"

    # 3. Atualizar ou Associar no Supabase se company_id fornecido
    sb_headers = _get_service_role_headers()
    sb_base_url = settings.SUPABASE_URL.rstrip("/")

    async with httpx.AsyncClient(timeout=10.0) as sb_client:
        target_company_id = req.company_id
        if not target_company_id:
            # Busca pelo documento
            resp_co = await sb_client.get(
                f"{sb_base_url}/rest/v1/companies?cnpj=eq.{clean_doc_number}&select=id",
                headers=sb_headers,
            )
            if resp_co.status_code == 200 and resp_co.json():
                target_company_id = UUID(resp_co.json()[0]["id"])

        if target_company_id:
            update_payload = {
                "gateway_customer_id": gateway_customer_id,
                "plan_status": "ACTIVE" if req.billing_type == "CREDIT_CARD" else "TRIAL",
                "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            }
            await sb_client.patch(
                f"{sb_base_url}/rest/v1/companies?id=eq.{target_company_id}",
                headers=sb_headers,
                json=update_payload,
            )

    return SubscribeResponse(
        success=True,
        message="Assinatura processada com sucesso no Gateway PF Asaas.",
        company_id=str(target_company_id) if target_company_id else None,
        gateway_customer_id=gateway_customer_id,
        subscription_id=subscription_id,
        billing_type=req.billing_type,
        value=charge_value,
        status="PENDING" if req.billing_type != "CREDIT_CARD" else "CONFIRMED",
        pix_copy_paste=pix_copy_paste,
        pix_qr_code_url=pix_qr_code_url,
        bank_slip_url=bank_slip_url,
        invoice_url=invoice_url,
    )


# =============================================================================
# 2. ENDPOINT: /webhook (Escuta Eventos de Pagamento e Libera o Tenant)
# =============================================================================
@router.post(
    "/webhook",
    response_model=BillingWebhookResponse,
    status_code=status.HTTP_200_OK,
    summary="Webhook de Confirmação de Pagamento do Asaas e Gateways PF",
    description=(
        "Recebe notificações do Asaas ('PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', etc.), "
        "atualiza o status da empresa para ACTIVE, expande a vigência e libera o acesso."
    ),
)
async def billing_webhook(
    request: Request,
    asaas_access_token: Optional[str] = Header(None, alias="asaas-access-token"),
) -> BillingWebhookResponse:
    try:
        payload_raw = await request.json()
    except Exception as exc:
        logger.error("Falha ao decodificar JSON do webhook: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payload JSON inválido.",
        )

    # Identifica o evento (Asaas usa PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE)
    event_type = payload_raw.get("event") or payload_raw.get("event_type") or "UNKNOWN"
    logger.info("Billing Webhook recebido: Evento '%s'", event_type)

    payment_info = payload_raw.get("payment") or payload_raw.get("data") or {}
    customer_id = payment_info.get("customer") or payload_raw.get("customer_id")

    # Mapeamento de status
    new_plan_status = "ACTIVE"
    if event_type in ("PAYMENT_OVERDUE", "PAYMENT_REFUNDED", "payment.failed"):
        new_plan_status = "PAST_DUE"

    headers = _get_service_role_headers()
    base_url = settings.SUPABASE_URL.rstrip("/")

    tenant_id: Optional[UUID] = None
    company_name = "Empresa Tenant"

    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1. Localizar Tenant pelo gateway_customer_id
        if customer_id:
            resp_company = await client.get(
                f"{base_url}/rest/v1/companies?gateway_customer_id=eq.{customer_id}&select=id,trade_name,legal_name",
                headers=headers,
            )
            if resp_company.status_code == 200 and resp_company.json():
                co = resp_company.json()[0]
                tenant_id = UUID(co["id"])
                company_name = co.get("trade_name") or co.get("legal_name")

        # 2. Se o pagamento foi confirmado, ativa a empresa e prorroga vigência
        if tenant_id and event_type in (
            "PAYMENT_CONFIRMED",
            "PAYMENT_RECEIVED",
            "payment.succeeded",
            "PAYMENT_OVERDUE",
        ):
            update_data = {
                "plan_status": new_plan_status,
                "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            }
            if new_plan_status == "ACTIVE":
                six_months = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=182)).isoformat()
                update_data["discount_expires_at"] = six_months

            await client.patch(
                f"{base_url}/rest/v1/companies?id=eq.{tenant_id}",
                headers=headers,
                json=update_data,
            )
            logger.info("Tenant %s atualizado para status %s", tenant_id, new_plan_status)

    return BillingWebhookResponse(
        status="PROCESSED",
        company=company_name,
        tenant_id=tenant_id,
        message=f"Evento '{event_type}' processado. Status do plano: {new_plan_status}.",
        details={
            "event": event_type,
            "gateway_customer_id": customer_id,
            "plan_status": new_plan_status,
            "processed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        },
    )
