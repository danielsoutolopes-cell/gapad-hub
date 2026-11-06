"""
=============================================================================
GADAP Hub - Microserviço RH & Departamento Pessoal (Fase 16 / Prompt 65 v2.0)
Ciclo de Vida do Colaborador: Admissão, Férias, Rescisão, Ponto e Folha Inteligente
=============================================================================
"""

import logging
import math
from datetime import datetime, date, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Header, HTTPException, Query, status
from pydantic import BaseModel, Field

logger = logging.getLogger("gadap.hr")
router = APIRouter(prefix="/hr", tags=["RH & Departamento Pessoal"])


# -----------------------------------------------------------------------------
# Enums e Modelos
# -----------------------------------------------------------------------------
class EmployeeStatus(str, Enum):
    ACTIVE = "ACTIVE"
    ON_LEAVE = "ON_LEAVE"
    VACATION = "VACATION"
    TERMINATED = "TERMINATED"


class EmployeeCreateRequest(BaseModel):
    full_name: str
    cpf: str
    role: str
    base_salary: float = Field(..., gt=0, description="Salário base mensal (R$)")
    admission_date: date = Field(default_factory=date.today)
    phone: Optional[str] = None
    current_project_id: Optional[UUID] = None
    daily_wage: Optional[float] = 0.0


class EmployeeUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    base_salary: Optional[float] = None
    phone: Optional[str] = None
    current_project_id: Optional[UUID] = None
    status: Optional[EmployeeStatus] = None


class ScheduleVacationRequest(BaseModel):
    vacation_start_date: date
    vacation_end_date: date
    notes: Optional[str] = None


class RegisterLeaveRequest(BaseModel):
    leave_reason: str
    leave_start_date: Optional[date] = None
    notes: Optional[str] = None


class TerminateEmployeeRequest(BaseModel):
    termination_date: date = Field(default_factory=date.today)
    termination_reason: str = Field(..., description="Motivo da rescisão (sem justa causa, pedido, etc.)")


class CalculatePayrollRequest(BaseModel):
    reference_month: str = Field(..., pattern=r"^\d{4}-\d{2}$", description="Mês de competência YYYY-MM (ex: 2026-11)")
    employee_ids: Optional[List[str]] = Field(default=None, description="Opcional: recalcular apenas para IDs específicos")


# -----------------------------------------------------------------------------
# In-Memory DB Mock para Desenvolvimento & Testes Isolados
# -----------------------------------------------------------------------------
_MOCK_EMPLOYEES: List[Dict[str, Any]] = [
    {
        "id": "emp-1",
        "full_name": "Antônio Ferreira",
        "role": "Pedreiro",
        "cpf": "123.456.789-01",
        "base_salary": 2860.00,
        "daily_wage": 220.00,
        "admission_date": "2024-03-10",
        "termination_date": None,
        "termination_reason": None,
        "vacation_start_date": None,
        "vacation_end_date": None,
        "leave_reason": None,
        "current_project": "Edifício Metropolitan",
        "phone": "(11) 98765-4321",
        "status": EmployeeStatus.ACTIVE.value,
        "epi_status": "regular",
    },
    {
        "id": "emp-2",
        "full_name": "João Carlos de Lima",
        "role": "Eletricista",
        "cpf": "987.654.321-02",
        "base_salary": 3380.00,
        "daily_wage": 260.00,
        "admission_date": "2023-08-15",
        "termination_date": None,
        "termination_reason": None,
        "vacation_start_date": None,
        "vacation_end_date": None,
        "leave_reason": None,
        "current_project": "Residencial Jardins",
        "phone": "(11) 97654-3210",
        "status": EmployeeStatus.ACTIVE.value,
        "epi_status": "atencao",
    },
    {
        "id": "emp-3",
        "full_name": "Marcos Vinícius Silva",
        "role": "Mestre de Obras",
        "cpf": "456.789.123-03",
        "base_salary": 5500.00,
        "daily_wage": 350.00,
        "admission_date": "2022-01-10",
        "termination_date": None,
        "termination_reason": None,
        "vacation_start_date": "2026-11-01",
        "vacation_end_date": "2026-11-30",
        "leave_reason": None,
        "current_project": "Residencial Jardins Lorena",
        "phone": "(11) 99123-8899",
        "status": EmployeeStatus.VACATION.value,
        "epi_status": "regular",
    },
]

_MOCK_PAYROLL_RECORDS: List[Dict[str, Any]] = []


# -----------------------------------------------------------------------------
# Motor de Cálculo Trabalhista (CLT / Construção Civil)
# -----------------------------------------------------------------------------
def _calculate_inss(gross: float) -> float:
    """Tabela progressiva simplificada de INSS (2026)."""
    if gross <= 1412.00:
        return gross * 0.075
    elif gross <= 2666.68:
        return 105.90 + (gross - 1412.00) * 0.09
    elif gross <= 4000.03:
        return 218.82 + (gross - 2666.68) * 0.12
    elif gross <= 7786.02:
        return 378.82 + (gross - 4000.03) * 0.14
    else:
        return 908.86  # Teto do INSS


def _calculate_irrf(gross_minus_inss: float) -> float:
    """Tabela progressiva IRRF simplificada."""
    if gross_minus_inss <= 2259.20:
        return 0.0
    elif gross_minus_inss <= 2826.65:
        return (gross_minus_inss * 0.075) - 169.44
    elif gross_minus_inss <= 3751.05:
        return (gross_minus_inss * 0.15) - 381.44
    elif gross_minus_inss <= 4664.68:
        return (gross_minus_inss * 0.225) - 662.77
    else:
        return (gross_minus_inss * 0.275) - 896.00


# -----------------------------------------------------------------------------
# Endpoints de Ponto com Geofencing & EPI (Compatibilidade Fase 16)
# -----------------------------------------------------------------------------
def _calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
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
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude geográfica válida (-90 a 90)")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude geográfica válida (-180 a 180)")
    log_type: str = Field(default="entrada", description="entrada, saida, almoco_inicio, almoco_fim")
    device_info: Optional[str] = "PWA Mobile"


@router.post("/time-log/check-in")
async def register_time_log_geofenced(payload: TimeCheckInRequest):
    # Validação defensiva adicional de resiliência móvel / dados corrompidos
    if math.isnan(payload.latitude) or math.isnan(payload.longitude) or math.isinf(payload.latitude) or math.isinf(payload.longitude):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "type": "https://errors.gadap.com.br/hr/corrupt-gps",
                "title": "Coordenadas GPS Inválidas ou Corrompidas",
                "status": 400,
                "detail": "As coordenadas enviadas pelo dispositivo móvel continham valores indefinidos (NaN/Inf).",
            },
        )

    SITE_LATITUDE = -23.561684
    SITE_LONGITUDE = -46.655981
    ALLOWED_RADIUS_METERS = 300.0

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


# -----------------------------------------------------------------------------
# CRUD de Colaboradores & Ciclo de Vida (Fase 16 / Prompt 65 v2.0)
# -----------------------------------------------------------------------------
@router.get("/employees")
async def list_employees(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    x_tenant_id: Optional[str] = Header(None)
):
    filtered = list(_MOCK_EMPLOYEES)
    if status_filter:
        filtered = [e for e in filtered if e.get("status") == status_filter.upper()]
    if search:
        s = search.lower()
        filtered = [
            e for e in filtered
            if s in e["full_name"].lower() or s in e["role"].lower() or s in e["cpf"]
        ]
    return {
        "total": len(filtered),
        "items": filtered
    }


@router.get("/employees/{employee_id}")
async def get_employee(employee_id: str):
    emp = next((e for e in _MOCK_EMPLOYEES if e["id"] == employee_id), None)
    if not emp:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado.")
    return emp


@router.post("/employees", status_code=status.HTTP_201_CREATED)
async def create_employee(payload: EmployeeCreateRequest):
    new_id = f"emp-{len(_MOCK_EMPLOYEES) + 1}"
    record = {
        "id": new_id,
        "full_name": payload.full_name,
        "role": payload.role,
        "cpf": payload.cpf,
        "base_salary": round(payload.base_salary, 2),
        "daily_wage": round(payload.daily_wage or (payload.base_salary / 30.0), 2),
        "admission_date": payload.admission_date.isoformat(),
        "termination_date": None,
        "termination_reason": None,
        "vacation_start_date": None,
        "vacation_end_date": None,
        "leave_reason": None,
        "current_project": "Matriz / A definir",
        "phone": payload.phone or "",
        "status": EmployeeStatus.ACTIVE.value,
        "epi_status": "regular",
        "created_at": datetime.now().isoformat()
    }
    _MOCK_EMPLOYEES.append(record)
    logger.info(f"Colaborador admitido: {record['full_name']} (CPF: {record['cpf']})")
    return record


@router.patch("/employees/{employee_id}")
async def update_employee(employee_id: str, payload: EmployeeUpdateRequest):
    emp = next((e for e in _MOCK_EMPLOYEES if e["id"] == employee_id), None)
    if not emp:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado.")
    if payload.full_name is not None:
        emp["full_name"] = payload.full_name
    if payload.role is not None:
        emp["role"] = payload.role
    if payload.base_salary is not None:
        emp["base_salary"] = round(payload.base_salary, 2)
    if payload.phone is not None:
        emp["phone"] = payload.phone
    if payload.status is not None:
        emp["status"] = payload.status.value
    return emp


@router.post("/employees/{employee_id}/schedule-vacation")
async def schedule_vacation(employee_id: str, payload: ScheduleVacationRequest):
    emp = next((e for e in _MOCK_EMPLOYEES if e["id"] == employee_id), None)
    if not emp:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado.")
    if payload.vacation_end_date <= payload.vacation_start_date:
        raise HTTPException(status_code=400, detail="Data final das férias deve ser posterior à data inicial.")
    
    emp["status"] = EmployeeStatus.VACATION.value
    emp["vacation_start_date"] = payload.vacation_start_date.isoformat()
    emp["vacation_end_date"] = payload.vacation_end_date.isoformat()
    
    logger.info(f"Férias programadas para {emp['full_name']}: {emp['vacation_start_date']} a {emp['vacation_end_date']}")
    return {
        "success": True,
        "message": f"Férias de {emp['full_name']} programadas com sucesso.",
        "employee": emp
    }


@router.post("/employees/{employee_id}/register-leave")
async def register_leave(employee_id: str, payload: RegisterLeaveRequest):
    emp = next((e for e in _MOCK_EMPLOYEES if e["id"] == employee_id), None)
    if not emp:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado.")
    emp["status"] = EmployeeStatus.ON_LEAVE.value
    emp["leave_reason"] = payload.leave_reason
    return {
        "success": True,
        "message": f"Afastamento de {emp['full_name']} registrado ({payload.leave_reason}).",
        "employee": emp
    }


@router.post("/employees/{employee_id}/terminate")
async def terminate_employee(employee_id: str, payload: TerminateEmployeeRequest):
    emp = next((e for e in _MOCK_EMPLOYEES if e["id"] == employee_id), None)
    if not emp:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado.")
    emp["status"] = EmployeeStatus.TERMINATED.value
    emp["termination_date"] = payload.termination_date.isoformat()
    emp["termination_reason"] = payload.termination_reason
    logger.info(f"Rescisão registrada para {emp['full_name']}: {payload.termination_reason}")
    return {
        "success": True,
        "message": f"Rescisão do colaborador {emp['full_name']} concluída com sucesso.",
        "employee": emp
    }


# -----------------------------------------------------------------------------
# Motor de Cálculo Inteligente da Folha de Pagamento
# Cruza base_salary com time_logs, calcula HE e faltas
# -----------------------------------------------------------------------------
@router.post("/payroll/calculate")
async def calculate_payroll(payload: CalculatePayrollRequest, x_tenant_id: Optional[str] = Header(None)):
    target_employees = _MOCK_EMPLOYEES
    if payload.employee_ids:
        target_employees = [e for e in _MOCK_EMPLOYEES if e["id"] in payload.employee_ids]
    
    # Processa apenas funcionários não desligados antes do mês
    eligible = [e for e in target_employees if e.get("status") != EmployeeStatus.TERMINATED.value]

    generated_records = []
    total_gross = 0.0
    total_net = 0.0
    total_deductions = 0.0

    for emp in eligible:
        base_salary = float(emp.get("base_salary") or 2500.00)
        hourly_rate = base_salary / 220.0  # Jornada padrão CLT 220h
        
        # Simulação inteligente de cruzamento com time_logs do mês
        # Funcionários ativos têm variações realistas de ponto (HE ou Faltas)
        overtime_hours = 8.0 if emp["id"] == "emp-2" else 0.0
        overtime_amount = round(overtime_hours * hourly_rate * 1.5, 2)  # Adicional de 50%
        
        absent_days = 1 if emp["id"] == "emp-1" else 0
        absence_deduction = round(absent_days * (base_salary / 30.0), 2)
        
        gross_amount = round(base_salary + overtime_amount - absence_deduction, 2)
        
        # Deduções legais (INSS + IRRF)
        inss = round(_calculate_inss(gross_amount), 2)
        taxable_base = max(0.0, gross_amount - inss)
        irrf = round(_calculate_irrf(taxable_base), 2)
        
        vt_deduction = round(min(base_salary * 0.06, 180.00), 2)  # Vale Transporte (até 6%)
        other_deductions = vt_deduction
        
        total_emp_deductions = round(inss + irrf + other_deductions, 2)
        net_amount = round(gross_amount - total_emp_deductions, 2)
        
        deductions_json = {
            "inss": inss,
            "irrf": irrf,
            "vale_transporte": vt_deduction,
            "absence_deduction": absence_deduction,
            "absence_days": absent_days
        }

        # Remove registro anterior se já existir para este mês
        existing_idx = next(
            (i for i, r in enumerate(_MOCK_PAYROLL_RECORDS)
             if r["employee_id"] == emp["id"] and r["reference_month"] == payload.reference_month),
            None
        )

        record = {
            "id": f"pay-{payload.reference_month}-{emp['id']}",
            "employee_id": emp["id"],
            "employee_name": emp["full_name"],
            "employee_role": emp["role"],
            "reference_month": payload.reference_month,
            "base_salary": base_salary,
            "overtime_hours": overtime_hours,
            "overtime_amount": overtime_amount,
            "absent_days": absent_days,
            "absence_deduction": absence_deduction,
            "gross_amount": gross_amount,
            "inss_deduction": inss,
            "irrf_deduction": irrf,
            "other_deductions": other_deductions,
            "net_amount": net_amount,
            "deductions_json": deductions_json,
            "status": "DRAFT",
            "calculated_at": datetime.now().isoformat()
        }

        if existing_idx is not None:
            _MOCK_PAYROLL_RECORDS[existing_idx] = record
        else:
            _MOCK_PAYROLL_RECORDS.append(record)

        generated_records.append(record)
        total_gross += gross_amount
        total_net += net_amount
        total_deductions += total_emp_deductions

    return {
        "success": True,
        "reference_month": payload.reference_month,
        "processed_count": len(generated_records),
        "total_gross_amount": round(total_gross, 2),
        "total_net_amount": round(total_net, 2),
        "total_deductions_amount": round(total_deductions, 2),
        "records": generated_records
    }


@router.get("/payroll/records")
async def list_payroll_records(
    reference_month: Optional[str] = Query(None, description="Mês no formato YYYY-MM"),
    x_tenant_id: Optional[str] = Header(None)
):
    records = _MOCK_PAYROLL_RECORDS
    if reference_month:
        records = [r for r in records if r["reference_month"] == reference_month]
    
    # Se ainda não houver folha calculada no mock, gera a do mês corrente para exibição imediata
    if not records:
        curr_month = date.today().strftime("%Y-%m")
        req = CalculatePayrollRequest(reference_month=reference_month or curr_month)
        calc_res = await calculate_payroll(req)
        records = calc_res["records"]

    return {
        "reference_month": reference_month or (records[0]["reference_month"] if records else date.today().strftime("%Y-%m")),
        "total_records": len(records),
        "total_gross": round(sum(r["gross_amount"] for r in records), 2),
        "total_net": round(sum(r["net_amount"] for r in records), 2),
        "items": records
    }


@router.post("/payroll/records/{record_id}/approve")
async def approve_payroll_record(record_id: str):
    rec = next((r for r in _MOCK_PAYROLL_RECORDS if r["id"] == record_id), None)
    if not rec:
        raise HTTPException(status_code=404, detail="Registro de folha não encontrado.")
    rec["status"] = "APPROVED"
    rec["approved_at"] = datetime.now().isoformat()
    return {"success": True, "record": rec}


class ClosePayrollRequest(BaseModel):
    reference_month: str = Field(..., description="Formato YYYY-MM")
    simulate_darf_failure: Optional[bool] = Field(default=False, description="Simula falha na integração financeira/DARF para teste de rollback")


@router.post("/payroll/close")
async def close_payroll_and_integrate_financial(
    payload: ClosePayrollRequest,
    x_tenant_id: Optional[str] = Header(None),
):
    """
    [PROMPT 90 & 92: Fechamento de Folha Atômico com Rollback Financeiro]
    Gera títulos no Contas a Pagar (Salários Líquidos, DARF Previdenciário/IRRF, FGTS).
    Se qualquer etapa falhar, executa rollback completo mantendo a folha em DRAFT.
    """
    records = [r for r in _MOCK_PAYROLL_RECORDS if r["reference_month"] == payload.reference_month]
    if not records:
        # Gera cálculo automático caso não tenha sido executado
        calc_res = await calculate_payroll(CalculatePayrollRequest(reference_month=payload.reference_month))
        records = calc_res["records"]

    # Estado prévio para rollback
    previous_states = {r["id"]: r.get("status", "DRAFT") for r in records}

    # Transação atômica simulada
    staged_payables = []
    total_net = sum(r["net_amount"] for r in records)
    total_inss = sum(r["inss_deduction"] for r in records)
    total_irrf = sum(r["irrf_deduction"] for r in records)
    total_fgts = round(sum(r["gross_amount"] * 0.08 for r in records), 2)

    # 1. Título Salários a Pagar
    staged_payables.append({
        "type": "PAYABLE_NET_SALARY",
        "category": "Salários e Ordenados",
        "amount": round(total_net, 2),
        "source_type": "PAYROLL",
    })

    # 2. Título DARF Previdenciário Unificado (INSS + IRRF)
    if payload.simulate_darf_failure:
        # Simula falha e executa rollback imediato
        for r in records:
            r["status"] = previous_states[r["id"]]
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "type": "https://errors.gadap.com.br/finance/darf-integration-failed",
                "title": "Falha na Geração da DARF Previdenciária",
                "status": 500,
                "detail": "Falha de comunicação com o Gateway da Receita Federal. Transação abortada e folha revertida para DRAFT.",
                "rollback_executed": True,
            },
        )

    staged_payables.append({
        "type": "PAYABLE_DARF_ESOCIAL",
        "category": "Impostos Trabalhistas (DARF / eSocial)",
        "amount": round(total_inss + total_irrf, 2),
        "source_type": "PAYROLL",
    })

    # 3. Título FGTS Digital
    staged_payables.append({
        "type": "PAYABLE_FGTS_DIGITAL",
        "category": "Encargos Sociais (FGTS Digital)",
        "amount": total_fgts,
        "source_type": "PAYROLL",
    })

    # Concretiza fechamento
    closed_at = datetime.now().isoformat()
    for r in records:
        r["status"] = "CLOSED"
        r["closed_at"] = closed_at

    return {
        "success": True,
        "reference_month": payload.reference_month,
        "records_closed": len(records),
        "financial_payables_generated": staged_payables,
        "total_financial_obligation": round(total_net + total_inss + total_irrf + total_fgts, 2),
        "message": f"Folha de {payload.reference_month} fechada e títulos gerados no Contas a Pagar!",
    }


@router.get("/payroll/records/{record_id}/holerite/pdf")
async def download_holerite_pdf(
    record_id: str,
    x_tenant_id: Optional[str] = Header(None),
):
    """
    [PROMPT 90 & 94: Emissão de Holerite com Edge Caching SRE]
    Retorna o Holerite com headers de Cache-Control estritos instruindo a CDN
    a realizar Edge Caching por 30 dias (folhas fechadas são imutáveis).
    """
    from starlette.responses import Response

    rec = next((r for r in _MOCK_PAYROLL_RECORDS if r["id"] == record_id), None)
    emp_name = rec["employee_name"] if rec else "Colaborador"
    ref_month = rec["reference_month"] if rec else "2026-11"

    # Simulação de PDF de Holerite executivo com assinatura digital
    mock_pdf_content = (
        f"%PDF-1.4\n1 0 obj\n<< /Title (Holerite CLT - {emp_name} - {ref_month}) >>\n"
        f"endobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    ).encode("utf-8")

    return Response(
        content=mock_pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="Holerite_{record_id}.pdf"',
            # Cache imutável na CDN por 30 dias para aliviar requisições ao Supabase
            "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400",
            "CDN-Cache-Control": "max-age=2592000",
            "Vary": "Accept-Encoding, Authorization",
        },
    )


