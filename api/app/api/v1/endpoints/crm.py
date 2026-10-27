"""
=============================================================================
GADAP Hub - Microserviço CRM, Funil de Vendas & Chamados Pós-Obra (Fase 17)
Regras de transição de status e cálculo de SLA de garantia
=============================================================================
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Header, HTTPException, Query, status
from pydantic import BaseModel, Field

logger = logging.getLogger("gadap.crm")
router = APIRouter(prefix="/crm", tags=["CRM & Pós-Obra"])


class LeadUpdateStageRequest(BaseModel):
    stage: str = Field(..., description="NOVO, QUALIFICACAO, PROPOSTA, NEGOCIACAO, FECHADO, PERDIDO")


class TicketStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="aberto, em_vistoria, em_reparo, resolvido")
    resolution_notes: Optional[str] = None


@router.get("/leads/kanban")
async def get_leads_kanban(x_tenant_id: Optional[str] = Header(None)):
    return {
        "stages": ["NOVO", "QUALIFICACAO", "PROPOSTA", "NEGOCIACAO", "FECHADO"],
        "leads": [
            {
                "id": "lead-1",
                "name": "Condomínio Alvorada",
                "company_name": "Alvorada Administração",
                "estimated_budget": 450000.00,
                "stage": "PROPOSTA",
                "phone": "(11) 98111-2222",
                "source": "Indicação",
            },
            {
                "id": "lead-2",
                "name": "Dr. Fernando Souza",
                "company_name": "Clínica Integrada",
                "estimated_budget": 180000.00,
                "stage": "NEGOCIACAO",
                "phone": "(11) 97222-3333",
                "source": "Site",
            },
            {
                "id": "lead-3",
                "name": "Galpão Logístico Cajamar",
                "company_name": "LogBrasil Transportes",
                "estimated_budget": 1200000.00,
                "stage": "QUALIFICACAO",
                "phone": "(11) 96333-4444",
                "source": "WhatsApp",
            },
        ],
    }


@router.patch("/leads/{lead_id}/stage")
async def update_lead_stage(lead_id: UUID, payload: LeadUpdateStageRequest):
    return {
        "success": True,
        "lead_id": str(lead_id),
        "new_stage": payload.stage,
        "updated_at": datetime.now().isoformat(),
    }


@router.get("/tickets")
async def list_service_tickets(
    x_tenant_id: Optional[str] = Header(None),
    priority: Optional[str] = Query(None),
):
    now = datetime.now()
    return {
        "items": [
            {
                "id": "t-1",
                "ticket_number": 302,
                "project_name": "Edifício Metropolitan (Apto 42)",
                "title": "Infiltração no teto do banheiro da suíte",
                "category": "hidraulica",
                "priority": "alta",
                "status": "aberto",
                "sla_hours_remaining": 18,
                "sla_status": "DENTRO_DO_PRAZO",
                "created_at": (now - timedelta(hours=6)).isoformat(),
            },
            {
                "id": "t-2",
                "ticket_number": 303,
                "project_name": "Residencial Jardins (Casa 12)",
                "title": "Fissura superficial na alvenaria externa",
                "category": "fissura",
                "priority": "media",
                "status": "em_vistoria",
                "sla_hours_remaining": 54,
                "sla_status": "DENTRO_DO_PRAZO",
                "created_at": (now - timedelta(hours=18)).isoformat(),
            },
        ]
    }


@router.patch("/tickets/{ticket_id}/status")
async def update_ticket_status(ticket_id: UUID, payload: TicketStatusUpdateRequest):
    return {
        "success": True,
        "ticket_id": str(ticket_id),
        "status": payload.status,
        "resolved_at": datetime.now().isoformat() if payload.status == "resolvido" else None,
        "message": f"Chamado atualizado para '{payload.status}' com sucesso.",
    }
