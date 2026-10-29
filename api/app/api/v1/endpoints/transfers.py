"""
=============================================================================
GADAP Hub - Endpoints para Logística de Canteiro e Termos de Retirada/Recebimento
Arquivo: api/app/api/v1/endpoints/transfers.py
=============================================================================
"""

import datetime
import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, Path, status

from app.core.config import settings
from app.core.deps import get_current_tenant_and_token
from app.schemas.transfers import (
    MaterialTransferCreate,
    MaterialTransferResponse,
    TransferNotifyRequest,
    TransferNotifyResponse,
)
from app.services.evolution_whatsapp import EvolutionWhatsAppClient
from app.services.transfer_pdf_builder import build_transfer_term_pdf

logger = logging.getLogger("gadap.transfers")

router = APIRouter(tags=["Logística de Canteiro & Portaria Digital"])


def _get_headers(token: str) -> Dict[str, str]:
    return {
        "apikey": settings.SUPABASE_ANON_KEY or "",
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _get_service_role_headers() -> Dict[str, str]:
    api_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY or ""
    return {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


# =============================================================================
# ROTA 1: POST /api/v1/projects/{id}/transfers (Criar Termo e Gerar PDF)
# =============================================================================
@router.post(
    "/projects/{project_id}/transfers",
    response_model=MaterialTransferResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar Termo de Retirada/Recebimento de Materiais com Assinatura e GPS",
    description=(
        "Registra a movimentação de portaria de materiais, gera o Termo de Responsabilidade e Guarda "
        "em PDF contendo carimbo GPS e assinatura em tela, salva no Supabase Storage e retorna os dados."
    ),
)
async def create_material_transfer(
    transfer_in: MaterialTransferCreate,
    project_id: UUID = Path(..., description="ID da Obra / Empreendimento"),
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> MaterialTransferResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip("/")
    headers = _get_headers(token)
    sr_headers = _get_service_role_headers()

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    transfer_id = uuid4()

    # 1. Buscar Informações da Obra e do Tenant (para cabeçalho do PDF)
    project_name = "Canteiro de Obras Principal"
    tenant_name = "Construtora & Incorporadora"

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Obter nome da obra
        try:
            resp_p = await client.get(
                f"{base_url}/rest/v1/projects?id=eq.{project_id}&tenant_id=eq.{tenant_id}&select=name",
                headers=headers,
            )
            if resp_p.status_code == 200 and resp_p.json():
                project_name = resp_p.json()[0].get("name") or project_name
        except Exception as e:
            logger.warning("Falha ao buscar dados da obra %s: %s", project_id, e)

        # Obter nome da empresa
        try:
            resp_co = await client.get(
                f"{base_url}/rest/v1/companies?id=eq.{tenant_id}&select=trade_name,legal_name",
                headers=headers,
            )
            if resp_co.status_code == 200 and resp_co.json():
                co_data = resp_co.json()[0]
                tenant_name = co_data.get("trade_name") or co_data.get("legal_name") or tenant_name
        except Exception as e:
            logger.warning("Falha ao buscar dados da empresa %s: %s", tenant_id, e)

    # 2. Gerar PDF Formal via ReportLab
    geo_dict = transfer_in.geolocation.model_dump() if transfer_in.geolocation else {}
    pdf_bytes = build_transfer_term_pdf(
        transfer_type=transfer_in.type,
        project_name=project_name,
        tenant_name=tenant_name,
        carrier_name=transfer_in.carrier_name,
        carrier_document=transfer_in.carrier_document,
        license_plate=transfer_in.license_plate,
        description=transfer_in.description,
        signature_base64=transfer_in.signature_base64,
        geolocation=geo_dict,
        created_at=now_utc,
    )

    # 3. Salvar PDF no Supabase Storage (Bucket: documents / material-transfers)
    file_path = f"transfers/{tenant_id}/{project_id}/{transfer_id}.pdf"
    pdf_url = f"{base_url}/storage/v1/object/public/documents/{file_path}"

    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            upload_headers = {
                "apikey": settings.SUPABASE_SERVICE_ROLE_KEY or token,
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY or token}",
                "Content-Type": "application/pdf",
                "x-upsert": "true",
            }
            upload_res = await client.post(
                f"{base_url}/storage/v1/object/documents/{file_path}",
                headers=upload_headers,
                content=pdf_bytes,
            )
            if upload_res.status_code not in (200, 201):
                logger.warning("Supabase Storage upload warning: %s. Usando fallback de URL.", upload_res.text)
        except Exception as upload_err:
            logger.error("Erro no upload do PDF para o Storage: %s", upload_err)

    # 4. Salvar Registro na tabela material_transfers
    transfer_payload = {
        "id": str(transfer_id),
        "tenant_id": str(tenant_id),
        "project_id": str(project_id),
        "type": transfer_in.type,
        "description": transfer_in.description,
        "carrier_name": transfer_in.carrier_name,
        "carrier_document": transfer_in.carrier_document,
        "license_plate": transfer_in.license_plate,
        "signature_base64": transfer_in.signature_base64,
        "photos_json": transfer_in.photos_base64,
        "geolocation_json": geo_dict,
        "pdf_url": pdf_url,
        "created_at": now_utc.isoformat(),
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        insert_res = await client.post(
            f"{base_url}/rest/v1/material_transfers",
            headers=headers,
            json=transfer_payload,
        )

        if insert_res.status_code not in (200, 201):
            logger.error("Falha ao registrar transferência em material_transfers: %s", insert_res.text)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao persistir termo de transferência: {insert_res.text}",
            )

    return MaterialTransferResponse(
        transfer_id=transfer_id,
        project_id=project_id,
        tenant_id=tenant_id,
        type=transfer_in.type,
        description=transfer_in.description,
        carrier_name=transfer_in.carrier_name,
        carrier_document=transfer_in.carrier_document,
        license_plate=transfer_in.license_plate,
        pdf_url=pdf_url,
        created_at=now_utc,
        message="Termo de Responsabilidade e Guarda gerado com sucesso!",
    )


# =============================================================================
# ROTA 2: POST /api/v1/transfers/{transfer_id}/notify (Disparo Manual WhatsApp)
# =============================================================================
@router.post(
    "/transfers/{transfer_id}/notify",
    response_model=TransferNotifyResponse,
    status_code=status.HTTP_200_OK,
    summary="Disparo Manual dos Recibos de Logística via WhatsApp (Evolution API)",
    description=(
        "Recebe até 3 números de telefone flexíveis informados no Modal de Compartilhamento "
        "(ex: Motorista, Fornecedor, Engenheiro) e transmite o PDF gerado via Evolution API."
    ),
)
async def notify_material_transfer(
    notify_in: TransferNotifyRequest,
    transfer_id: UUID = Path(..., description="ID da Transferência"),
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> TransferNotifyResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip("/")
    headers = _get_headers(token)

    # 1. Buscar a transferência e garantir isolamento por tenant
    transfer_data: Optional[Dict[str, Any]] = None
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{base_url}/rest/v1/material_transfers?id=eq.{transfer_id}&tenant_id=eq.{tenant_id}&select=*",
            headers=headers,
        )
        if resp.status_code == 200 and resp.json():
            transfer_data = resp.json()[0]

    if not transfer_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Termo de transferência não encontrado ou sem permissão de acesso.",
        )

    pdf_url = transfer_data.get("pdf_url")
    carrier_name = transfer_data.get("carrier_name") or "Portador"
    transfer_type_desc = "Retirada (Saída)" if transfer_data.get("type") == "WITHDRAWAL" else "Recebimento (Entrada)"

    caption = (
        f"📋 *Termo de {transfer_type_desc} de Materiais - Portaria Digital*\n\n"
        f"• *Responsável:* {carrier_name}\n"
        f"• *Doc:* {transfer_data.get('carrier_document')}\n"
        f"• *Veículo:* {transfer_data.get('license_plate') or 'Não informado'}\n"
        f"• *Data/Hora:* {datetime.datetime.now().strftime('%d/%m/%Y %H:%M')}\n\n"
        f"Documento assinado digitalmente no canteiro de obras via GADAP Hub."
    )

    whatsapp_client = EvolutionWhatsAppClient()
    results: List[Dict[str, Any]] = []

    # 2. Transmitir para cada um dos telefones informados (até 3)
    for phone in notify_in.phones:
        cleaned_phone = phone.strip()
        if not cleaned_phone:
            continue
        try:
            res = await whatsapp_client.send_pdf(
                phone=cleaned_phone,
                media_url_or_base64=pdf_url,
                file_name=f"Termo_{transfer_data.get('type')}_{transfer_id.hex[:6]}.pdf",
                caption=caption,
            )
            results.append({"phone": cleaned_phone, "status": "SENT", "response": res})
            logger.info("Termo %s enviado com sucesso para %s", transfer_id, cleaned_phone)
        except Exception as send_err:
            logger.warning("Falha ao enviar Termo %s para %s: %s", transfer_id, cleaned_phone, send_err)
            results.append({"phone": cleaned_phone, "status": "FAILED", "error": str(send_err)})

    return TransferNotifyResponse(
        transfer_id=transfer_id,
        dispatched_count=len([r for r in results if r["status"] == "SENT"]),
        results=results,
        message="Processo de notificação por WhatsApp concluído.",
    )
