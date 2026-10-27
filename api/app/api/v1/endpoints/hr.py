"""
=============================================================================
GADAP Hub - Microserviço RH, Ponto com Geofencing & Alertas de EPI (Fase 16)
=============================================================================
"""

import logging
import math
from datetime import datetime, date, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Header, HTTPException, Query, status
from pydantic import BaseModel, Field

logger = logging.getLogger("gadap.hr")
router = APIRouter(prefix="/hr", tags=["RH & Segurança do Trabalho"])


def _calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calcula a distância em metros entre duas coordenadas geográficas."""
    R = 6371000.0  # Raio da Terra em metros
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


class TimeCheckInRequest(BaseModel):
    employee_id: UUID
    project_id: UUID
    latitude: float
    longitude: float
    log_type: str = Field(default="entrada", description="entrada, saida, almoco_inicio, almoco_fim")
    device_info: Optional[str] = "PWA Mobile"


@router.post("/time-log/check-in")
async def register_time_log_geofenced(payload: TimeCheckInRequest):
    # Coordenadas do Canteiro de Obras (Exemplo: Av. Paulista, SP)
    SITE_LATITUDE = -23.561684
    SITE_LONGITUDE = -46.655981
    ALLOWED_RADIUS_METERS = 300.0  # Raio de tolerância do canteiro

    distance = _calculate_haversine_distance(
        payload.latitude, payload.longitude, SITE_LATITUDE, SITE_LONGITUDE
    )
    is_within_geofence = distance <= ALLOWED_RADIUS_METERS

    return {
        "success": True,
        "log_id": str(uuid4()),
        "log_type": payload.log_type,
        "timestamp": datetime.now().isoformat(),
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "distance_to_site_meters": round(distance, 1),
        "is_within_geofence": is_within_geofence,
        "geofence_status": "DENTRO_DO_CANTEIRO" if is_within_geofence else "FORA_DO_CANTEIRO_ALERTA",
        "message": (
            "Ponto registrado com sucesso dentro do canteiro."
            if is_within_geofence
            else f"Ponto registrado a {round(distance)}m do canteiro. Notificação de auditoria gerada."
        ),
    }


@router.get("/epi/alerts")
async def list_epi_alerts(x_tenant_id: Optional[str] = Header(None)):
    today = date.today()
    return {
        "total_alerts": 2,
        "alerts": [
            {
                "id": "epi-1",
                "employee_name": "Antônio Ferreira (Pedreiro)",
                "epi_name": "Capacete de Segurança com Jugular",
                "ca_code": "CA-35890",
                "delivered_at": (today - timedelta(days=340)).isoformat(),
                "expiration_date": (today + timedelta(days=25)).isoformat(),
                "days_remaining": 25,
                "urgency": "vencendo",
                "status": "Vence em menos de 30 dias",
            },
            {
                "id": "epi-2",
                "employee_name": "João Carlos de Lima (Eletricista)",
                "epi_name": "Luva Isolante de Borracha Classe 2",
                "ca_code": "CA-12940",
                "delivered_at": (today - timedelta(days=370)).isoformat(),
                "expiration_date": (today - timedelta(days=5)).isoformat(),
                "days_remaining": -5,
                "urgency": "vencido",
                "status": "VENCIDO - Troca Imediata Obrigatória",
            },
        ],
    }


@router.get("/employees")
async def list_employees(x_tenant_id: Optional[str] = Header(None)):
    return {
        "items": [
            {
                "id": "emp-1",
                "full_name": "Antônio Ferreira",
                "role": "Pedreiro",
                "cpf": "123.456.789-01",
                "daily_wage": 220.00,
                "current_project": "Edifício Metropolitan",
                "status": "ativo",
                "epi_status": "regular",
            },
            {
                "id": "emp-2",
                "full_name": "João Carlos de Lima",
                "role": "Eletricista",
                "cpf": "987.654.321-02",
                "daily_wage": 260.00,
                "current_project": "Residencial Jardins",
                "status": "ativo",
                "epi_status": "atencao",
            },
        ]
    }
