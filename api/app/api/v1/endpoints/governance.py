"""
=============================================================================
GADAP Hub - Microserviço de Governança, Audit Trail & Assinatura Gov.br
Fases: 20 (Auditoria Global) e 21 (Assinatura Eletrônica Gov.br Lei 14.063/2020)
=============================================================================
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Header, HTTPException, Query, status
from pydantic import BaseModel, Field

logger = logging.getLogger("gadap.audit_signatures")
router = APIRouter(prefix="/governance", tags=["Auditoria & Assinatura Gov.br"])


@router.get("/audit-logs")
async def list_audit_logs(
    x_tenant_id: Optional[str] = Header(None),
    limit: int = 20,
):
    now = datetime.now()
    return {
        "items": [
            {
                "id": "log-1",
                "user_name": "Eng. Carlos Silva",
                "user_role": "engenheiro",
                "action": "UPDATE_MEDICAO",
                "table_name": "medicoes",
                "description": "Aprovou medição de obra #03 no valor de R$ 48.500,00",
                "timestamp": (now - timedelta(minutes=14)).isoformat(),
            },
            {
                "id": "log-2",
                "user_name": "Beatriz Santos",
                "user_role": "financeiro",
                "action": "AUTO_MATCH_OFX",
                "table_name": "financial_entries",
                "description": "Baixou título a pagar #1042 referente à compra Gerdau via conciliação bancária",
                "timestamp": (now - timedelta(hours=1, minutes=20)).isoformat(),
            },
            {
                "id": "log-3",
                "user_name": "Diretoria Master",
                "user_role": "admin",
                "action": "ISSUE_NFSE",
                "table_name": "fiscal_invoices",
                "description": "Autorizou e transmitiu NFS-e Nacional Nº 1024 com envio WhatsApp",
                "timestamp": (now - timedelta(hours=3)).isoformat(),
            },
        ]
    }


class GovbrSignRequest(BaseModel):
    document_type: str = Field(..., description="contrato_subempreitada, termo_epi, medicao_assinada")
    document_id: UUID
    signer_cpf: str
    signer_name: str


@router.post("/signatures/govbr/sign")
async def sign_document_with_govbr(payload: GovbrSignRequest):
    """Simula o fluxo OAuth2 PKCE com a API de Assinatura Avançada do Gov.br."""
    transaction_id = f"GOVBR_{uuid4().hex[:12].upper()}"
    signed_url = f"https://supabase.gadap.com.br/storage/v1/object/public/documentos-assinados/{payload.document_id}_assinado_govbr.pdf"

    return {
        "success": True,
        "status": "ASSINADO_AVANCADO",
        "govbr_transaction_id": transaction_id,
        "signer_name": payload.signer_name,
        "signer_cpf": payload.signer_cpf,
        "legislation_compliance": "Lei Federal 14.063/2020 (Assinatura Eletrônica Avançada Gov.br)",
        "signed_file_url": signed_url,
        "signed_at": datetime.now().isoformat(),
        "message": "Documento assinado digitalmente com fé pública e carimbo de tempo oficial ICP-Brasil / Gov.br.",
    }
