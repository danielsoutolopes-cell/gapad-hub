"""
=============================================================================
GADAP Hub - Microserviço Suprimentos & Procurement (Fase 15)
Cotação em lote via WhatsApp com Evolution API e Mapa de Concorrência
=============================================================================
"""

import logging
from datetime import datetime, date
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Header, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.evolution_whatsapp import EvolutionWhatsAppClient

logger = logging.getLogger("gadap.procurement")
router = APIRouter(prefix="/procurement", tags=["Suprimentos & Procurement"])
whatsapp_client = EvolutionWhatsAppClient()


class PurchaseRequestCreate(BaseModel):
    project_id: Optional[UUID] = None
    category: str = "material_bruto"
    urgency: str = "normal"
    delivery_deadline: Optional[date] = None
    items_description: str
    notes: Optional[str] = None


class BatchQuoteRequest(BaseModel):
    purchase_request_id: UUID
    item_description: str
    supplier_phones: List[str] = Field(..., description="Lista de telefones com DDD dos fornecedores")
    estimated_quantity: str = "1"


@router.get("/requests")
async def list_purchase_requests(
    x_tenant_id: Optional[str] = Header(None),
    status_filter: Optional[str] = Query(None),
):
    tenant_id = x_tenant_id or "7ffdf475-b337-4282-ae1f-3f8056394334"
    return {
        "items": [
            {
                "id": "a1111111-1111-1111-1111-111111111111",
                "request_number": 1042,
                "project_name": "Edifício Metropolitan",
                "category": "Aço & Ferragens",
                "urgency": "alta",
                "status": "cotando",
                "delivery_deadline": "2026-11-05",
                "items_count": 4,
                "quotes_received": 3,
                "created_at": datetime.now().isoformat(),
            },
            {
                "id": "a2222222-2222-2222-2222-222222222222",
                "request_number": 1043,
                "project_name": "Residencial Jardins",
                "category": "Cimento & Agregados",
                "urgency": "normal",
                "status": "pendente",
                "delivery_deadline": "2026-11-10",
                "items_count": 2,
                "quotes_received": 1,
                "created_at": datetime.now().isoformat(),
            },
        ]
    }


@router.get("/comparison-map")
async def get_comparison_map(
    request_id: Optional[UUID] = Query(None),
    x_tenant_id: Optional[str] = Header(None),
):
    return {
        "request_id": str(request_id or uuid4()),
        "item_name": "Aço CA-50 10.0mm (Barra 12m) - 2.500 kg",
        "quotes": [
            {
                "id": "q1",
                "supplier_name": "Gerdau Comercial de Aços",
                "unit_price": 6.85,
                "total_price": 17125.00,
                "delivery_days": 3,
                "payment_terms": "28 DDL",
                "is_best_price": true,
                "status": "selecionada",
            },
            {
                "id": "q2",
                "supplier_name": "ArcelorMittal Distribuidora",
                "unit_price": 7.15,
                "total_price": 17875.00,
                "delivery_days": 2,
                "payment_terms": "30 DDL",
                "is_best_price": false,
                "status": "em_analise",
            },
            {
                "id": "q3",
                "supplier_name": "Açofer Estruturas",
                "unit_price": 7.40,
                "total_price": 18500.00,
                "delivery_days": 5,
                "payment_terms": "14 DDL",
                "is_best_price": false,
                "status": "em_analise",
            },
        ],
    }


@router.post("/batch-quote-whatsapp")
async def send_batch_quotes_whatsapp(payload: BatchQuoteRequest):
    dispatched = 0
    for phone in payload.supplier_phones:
        msg = (
            f"🏗️ *GADAP Hub • Solicitação de Cotação de Preços*\n\n"
            f"Prezado fornecedor, solicitamos proposta para:\n"
            f"📦 *Item:* {payload.item_description}\n"
            f"🔢 *Qtd Solicitada:* {payload.estimated_quantity}\n\n"
            f"Por favor, responda com preço unitário, prazo de entrega e condições de pagamento."
        )
        try:
            await whatsapp_client.send_text(phone=phone, message=msg)
            dispatched += 1
        except Exception as exc:
            logger.warning("Falha ao enviar cotação para %s: %s", phone, exc)

    return {
        "success": True,
        "dispatched_count": dispatched,
        "total_suppliers": len(payload.supplier_phones),
        "message": f"Cotações disparadas via WhatsApp para {dispatched} fornecedores.",
    }
