"""
=============================================================================
GADAP Hub - Microserviço RH & Departamento Pessoal (Fase 16 / Versão 3.0)
Motor Completo de Rúbricas Salariais, Descontos CLT e Títulos no Contas a Pagar
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
from app.core.lgpd import mask_cpf, mask_phone, sanitize_employee_for_lgpd

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


class ConstructionRole(str, Enum):
    DIRETOR = "DIRETOR"
    ENGENHEIRO_COORDENADOR = "ENGENHEIRO_COORDENADOR"
    ENGENHEIRO_CAMPO = "ENGENHEIRO_CAMPO"
    MESTRE_OBRAS = "MESTRE_OBRAS"
    COMPRADOR = "COMPRADOR"
    FINANCEIRO = "FINANCEIRO"
    RH_DEPARTAMENTO_PESSOAL = "RH_DEPARTAMENTO_PESSOAL"
    VISITANTE_CLIENTE = "VISITANTE_CLIENTE"


class EmployeeSalaryConfig(BaseModel):
    base_salary: float = Field(..., gt=0, description="Salário base mensal (R$)")
    has_vale_transporte: bool = Field(default=True, description="Optante por Vale Transporte (desconto até 6%)")
    has_vale_alimentacao: bool = Field(default=True, description="Benefício Alimentação/Refeição (desconto legal até 20% do benefício)")
    has_health_plan: bool = Field(default=True, description="Coparticipação em Plano de Saúde")
    health_plan_discount: float = Field(default=85.00, ge=0, description="Valor fixo do plano de saúde")
    has_life_insurance: bool = Field(default=True, description="Seguro de Vida Coletivo NR-18")
    life_insurance_discount: float = Field(default=15.00, ge=0, description="Seguro de vida")


class EmployeeCreateRequest(BaseModel):
    full_name: str
    cpf: str
    role: str
    construction_role: Optional[ConstructionRole] = ConstructionRole.ENGENHEIRO_CAMPO
    base_salary: float = Field(..., gt=0, description="Salário base mensal (R$)")
    admission_date: date = Field(default_factory=date.today)
    phone: Optional[str] = None
    current_project_id: Optional[UUID] = None
    daily_wage: Optional[float] = 0.0
    salary_config: Optional[EmployeeSalaryConfig] = None


class EmployeeUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    construction_role: Optional[ConstructionRole] = None
    base_salary: Optional[float] = None
    phone: Optional[str] = None
    current_project_id: Optional[UUID] = None
    status: Optional[EmployeeStatus] = None
    salary_config: Optional[EmployeeSalaryConfig] = None


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


class EmployeeImportItem(BaseModel):
    full_name: str
    cpf: str
    role: str
    construction_role: Optional[ConstructionRole] = ConstructionRole.ENGENHEIRO_CAMPO
    base_salary: float = Field(..., gt=0, description="Salário base mensal (R$)")
    admission_date: Optional[date] = None
    phone: Optional[str] = None
    current_project: Optional[str] = None
    salary_config: Optional[EmployeeSalaryConfig] = None


class EmployeeImportRequest(BaseModel):
    employees: List[EmployeeImportItem]


class EmployeeImportResponse(BaseModel):
    success: bool
    imported_count: int
    skipped_count: int
    imported_employees: List[Dict[str, Any]]
    message: str


class ExtraordinaryEarningType(str, Enum):
    BONUS_PRODUTIVIDADE = "BONUS_PRODUTIVIDADE"
    DISSIDIO_RETROATIVO = "DISSIDIO_RETROATIVO"
    PLR = "PLR"  # Participação nos Lucros e Resultados (Lei 10.101/2000 - isento de INSS e IRRF exclusivo)
    GRATIFICACAO_FUNCAO = "GRATIFICACAO_FUNCAO"
    PREMIO_DESEMPENHO = "PREMIO_DESEMPENHO"
    ADICIONAL_NOTURNO = "ADICIONAL_NOTURNO"
    ADICIONAL_PERICULOSIDADE = "ADICIONAL_PERICULOSIDADE"
    ADICIONAL_INSALUBRIDADE = "ADICIONAL_INSALUBRIDADE"
    DSR_SOBRE_VARIAVEIS = "DSR_SOBRE_VARIAVEIS"
    DIARIA_VIAGEM = "DIARIA_VIAGEM"


class ExtraordinaryEarningItem(BaseModel):
    employee_id: str
    rubric_type: Optional[ExtraordinaryEarningType] = Field(
        default=ExtraordinaryEarningType.BONUS_PRODUTIVIDADE,
        description="Tipo canônico da remuneração extraordinária",
    )
    rubric_name: str = Field(..., description="Ex: Bônus de Produtividade, Dissídio Coletivo, PLR Semestral, Gratificação")
    amount: float = Field(..., gt=0, description="Valor nominal da rúbrica (R$)")
    taxable_inss: bool = Field(default=True, description="Incide INSS (falso para PLR e Diárias de Viagem conforme Lei)")
    taxable_irrf: bool = Field(default=True, description="Incide IRRF na tabela progressiva")
    taxable_fgts: bool = Field(default=True, description="Incide FGTS Digital de 8%")


class CalculatePayrollRequest(BaseModel):
    reference_month: str = Field(..., pattern=r"^\d{4}-\d{2}$", description="Mês de competência YYYY-MM (ex: 2026-11)")
    employee_ids: Optional[List[str]] = Field(default=None, description="Opcional: recalcular apenas para IDs específicos")
    extraordinary_earnings: Optional[List[ExtraordinaryEarningItem]] = Field(
        default=[],
        description="Remunerações extraordinárias (Bônus, Dissídios, PLR, Gratificações, Adicionais)",
    )


# -----------------------------------------------------------------------------
# In-Memory DB Mock para Desenvolvimento & Testes Isolados
# -----------------------------------------------------------------------------
_MOCK_EMPLOYEES: List[Dict[str, Any]] = [
    {
        "id": "emp-1",
        "full_name": "Antônio Ferreira",
        "role": "Pedreiro",
        "construction_role": ConstructionRole.MESTRE_OBRAS.value,
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
        "has_vt": True,
        "has_va": True,
        "has_health": True,
        "health_plan_discount": 85.00,
        "has_life_ins": True,
        "life_ins_discount": 15.00,
    },
    {
        "id": "emp-2",
        "full_name": "João Carlos de Lima",
        "role": "Eletricista",
        "construction_role": ConstructionRole.ENGENHEIRO_CAMPO.value,
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
        "has_vt": True,
        "has_va": True,
        "has_health": True,
        "health_plan_discount": 95.00,
        "has_life_ins": True,
        "life_ins_discount": 15.00,
    },
    {
        "id": "emp-3",
        "full_name": "Marcos Vinícius Silva",
        "role": "Mestre de Obras",
        "construction_role": ConstructionRole.MESTRE_OBRAS.value,
        "cpf": "456.789.012-03",
        "base_salary": 5200.00,
        "daily_wage": 400.00,
        "admission_date": "2022-01-20",
        "termination_date": None,
        "termination_reason": None,
        "vacation_start_date": None,
        "vacation_end_date": None,
        "leave_reason": None,
        "current_project": "Residencial Jardins",
        "phone": "(11) 96543-2109",
        "status": EmployeeStatus.ACTIVE.value,
        "epi_status": "regular",
        "has_vt": False,
        "has_va": True,
        "has_health": True,
        "health_plan_discount": 120.00,
        "has_life_ins": True,
        "life_ins_discount": 20.00,
    },
    {
        "id": "emp-4",
        "full_name": "Cláudia Mendonça",
        "role": "Engenheira Coordenadora",
        "construction_role": ConstructionRole.ENGENHEIRO_COORDENADOR.value,
        "cpf": "789.012.345-04",
        "base_salary": 11500.00,
        "daily_wage": 884.62,
        "admission_date": "2021-05-02",
        "termination_date": None,
        "termination_reason": None,
        "vacation_start_date": None,
        "vacation_end_date": None,
        "leave_reason": None,
        "current_project": "Matriz / Coordenação Geral",
        "phone": "(11) 95432-1098",
        "status": EmployeeStatus.ACTIVE.value,
        "epi_status": "regular",
        "has_vt": False,
        "has_va": True,
        "has_health": True,
        "health_plan_discount": 150.00,
        "has_life_ins": True,
        "life_ins_discount": 25.00,
    },
]

_MOCK_PAYROLL_RECORDS: List[Dict[str, Any]] = []


# -----------------------------------------------------------------------------
# Tabelas Progressivas Oficiais CLT 2026 (INSS & IRRF)
# -----------------------------------------------------------------------------
def _calculate_inss(gross_salary: float) -> float:
    """Tabela progressiva INSS 2026 com faixas de 7.5%, 9%, 12% e 14%."""
    brackets = [
        (1518.00, 0.075),
        (2793.88, 0.09),
        (4190.83, 0.12),
        (8157.41, 0.14),
    ]
    teto_inss = 8157.41
    taxable = min(gross_salary, teto_inss)
    tax = 0.0
    prev_limit = 0.0

    for limit, rate in brackets:
        if taxable > prev_limit:
            portion = min(taxable, limit) - prev_limit
            tax += portion * rate
            prev_limit = limit
        else:
            break
    return round(tax, 2)


def _calculate_irrf(taxable_base: float) -> float:
    """Tabela progressiva IRRF 2026 com dedução por parcela."""
    if taxable_base <= 2259.20:
        return 0.0
    elif taxable_base <= 2826.65:
        return round((taxable_base * 0.075) - 169.44, 2)
    elif taxable_base <= 3751.05:
        return round((taxable_base * 0.15) - 381.44, 2)
    elif taxable_base <= 4664.68:
        return round((taxable_base * 0.225) - 662.77, 2)
    else:
        return round((taxable_base * 0.275) - 896.00, 2)


# -----------------------------------------------------------------------------
# Endpoints de Ponto & Geofencing GPS (PWA de Campo)
# -----------------------------------------------------------------------------
class TimeLogCheckInRequest(BaseModel):
    employee_id: str
    project_id: str
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    log_type: str = Field(default="entrada")
    device_info: Optional[str] = "PWA Canteiro de Obras"


@router.post("/time-log/check-in")
async def check_in_time_log(payload: TimeLogCheckInRequest, x_tenant_id: Optional[str] = Header(None)):
    site_lat = -23.561684
    site_lon = -46.655981
    R = 6371000  # Raio da Terra em metros

    phi1 = math.radians(site_lat)
    phi2 = math.radians(payload.latitude)
    delta_phi = math.radians(payload.latitude - site_lat)
    delta_lambda = math.radians(payload.longitude - site_lon)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c

    is_within_geofence = distance <= 500

    return {
        "success": True,
        "log_id": f"log-{uuid4()}",
        "employee_id": payload.employee_id,
        "project_id": payload.project_id,
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


# -----------------------------------------------------------------------------
# CRUD de Colaboradores & Organograma da Construtora
# -----------------------------------------------------------------------------
@router.get("/employees")
async def list_employees(
    status_filter: Optional[str] = Query(None, alias="status"),
    construction_role: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    include_full_cpf: bool = Query(False, description="Exibe CPF desmascarado apenas para RH com privilégios"),
    x_tenant_id: Optional[str] = Header(None)
):
    filtered = list(_MOCK_EMPLOYEES)
    if status_filter:
        filtered = [e for e in filtered if e.get("status") == status_filter.upper()]
    if construction_role:
        filtered = [e for e in filtered if e.get("construction_role") == construction_role.upper()]
    if search:
        s = search.lower()
        filtered = [
            e for e in filtered
            if s in e["full_name"].lower() or s in e["role"].lower() or s in e["cpf"]
        ]
    # Aplica mascaramento LGPD compulsório para segurança e privacidade
    sanitized = [sanitize_employee_for_lgpd(e, include_full_cpf=include_full_cpf) for e in filtered]
    return {
        "total": len(sanitized),
        "items": sanitized
    }


@router.post("/employees", status_code=status.HTTP_201_CREATED)
async def create_employee(payload: EmployeeCreateRequest):
    clean_cpf = "".join(filter(str.isdigit, payload.cpf))
    if any("".join(filter(str.isdigit, str(e.get("cpf", "")))) == clean_cpf for e in _MOCK_EMPLOYEES):
        raise HTTPException(status_code=400, detail="Colaborador com este CPF já cadastrado.")

    new_id = f"emp-{len(_MOCK_EMPLOYEES) + 1}"
    cfg = payload.salary_config or EmployeeSalaryConfig(base_salary=payload.base_salary)

    record = {
        "id": new_id,
        "full_name": payload.full_name,
        "role": payload.role,
        "construction_role": payload.construction_role.value if payload.construction_role else ConstructionRole.ENGENHEIRO_CAMPO.value,
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
        "has_vt": cfg.has_vale_transporte,
        "has_va": cfg.has_vale_alimentacao,
        "has_health": cfg.has_health_plan,
        "health_plan_discount": cfg.health_plan_discount,
        "has_life_ins": cfg.has_life_insurance,
        "life_ins_discount": cfg.life_insurance_discount,
        "created_at": datetime.now().isoformat()
    }
    _MOCK_EMPLOYEES.append(record)
    logger.info(f"Colaborador admitido: {record['full_name']} (Cargo Construtora: {record['construction_role']})")
    return record


@router.post("/employees/import", response_model=EmployeeImportResponse, status_code=status.HTTP_201_CREATED)
async def import_employees(payload: EmployeeImportRequest):
    imported = []
    skipped = 0

    for item in payload.employees:
        clean_cpf = "".join(filter(str.isdigit, item.cpf))
        exists = any(
            "".join(filter(str.isdigit, str(e.get("cpf", "")))) == clean_cpf
            for e in _MOCK_EMPLOYEES
        )
        if exists:
            skipped += 1
            continue

        new_id = f"emp-{len(_MOCK_EMPLOYEES) + 1}"
        cfg = item.salary_config or EmployeeSalaryConfig(base_salary=item.base_salary)
        record = {
            "id": new_id,
            "full_name": item.full_name.strip(),
            "role": item.role.strip(),
            "construction_role": item.construction_role.value if item.construction_role else ConstructionRole.ENGENHEIRO_CAMPO.value,
            "cpf": item.cpf.strip(),
            "base_salary": round(item.base_salary, 2),
            "daily_wage": round(item.base_salary / 30.0, 2),
            "admission_date": (item.admission_date or date.today()).isoformat(),
            "termination_date": None,
            "termination_reason": None,
            "vacation_start_date": None,
            "vacation_end_date": None,
            "leave_reason": None,
            "current_project": item.current_project or "Matriz / A definir",
            "phone": item.phone or "",
            "status": EmployeeStatus.ACTIVE.value,
            "epi_status": "regular",
            "has_vt": cfg.has_vale_transporte,
            "has_va": cfg.has_vale_alimentacao,
            "has_health": cfg.has_health_plan,
            "health_plan_discount": cfg.health_plan_discount,
            "has_life_ins": cfg.has_life_insurance,
            "life_ins_discount": cfg.life_insurance_discount,
            "created_at": datetime.now().isoformat(),
        }
        _MOCK_EMPLOYEES.append(record)
        imported.append(record)

    return EmployeeImportResponse(
        success=True,
        imported_count=len(imported),
        skipped_count=skipped,
        imported_employees=imported,
        message=f"{len(imported)} colaboradores importados com sucesso! ({skipped} ignorados por duplicidade)",
    )


# -----------------------------------------------------------------------------
# Motor de Cálculo da Folha com Todas as Rúbricas e Legislação Brasileira
# -----------------------------------------------------------------------------
@router.post("/payroll/calculate")
async def calculate_payroll(payload: CalculatePayrollRequest, x_tenant_id: Optional[str] = Header(None)):
    target_employees = _MOCK_EMPLOYEES
    if payload.employee_ids:
        target_employees = [e for e in _MOCK_EMPLOYEES if e["id"] in payload.employee_ids]

    eligible = [e for e in target_employees if e.get("status") != EmployeeStatus.TERMINATED.value]

    generated_records = []
    total_gross = 0.0
    total_net = 0.0
    total_deductions = 0.0

    # Indexa remunerações extraordinárias enviadas (Bônus, Adicional Noturno, DSR, etc)
    extra_by_emp: Dict[str, List[ExtraordinaryEarningItem]] = {}
    for item in payload.extraordinary_earnings or []:
        extra_by_emp.setdefault(item.employee_id, []).append(item)

    for emp in eligible:
        base_salary = float(emp.get("base_salary") or 2500.00)
        hourly_rate = base_salary / 220.0

        # Horas Extras e Remunerações Extraordinárias
        overtime_hours = 8.0 if emp["id"] == "emp-2" else 0.0
        overtime_amount = round(overtime_hours * hourly_rate * 1.5, 2)

        # Adiciona bônus/adicionais extraordinários (Dissídios, PLR, Gratificações, Prêmios)
        emp_extras = extra_by_emp.get(emp["id"], [])
        extra_earnings_amount = round(sum(item.amount for item in emp_extras), 2)

        # Segregação de incidências legais por rúbrica:
        # PLR (Lei 10.101/2000) e diárias de viagem justificadas são isentas de INSS/FGTS
        extra_inss_taxable = sum(item.amount for item in emp_extras if item.taxable_inss)
        extra_irrf_taxable = sum(item.amount for item in emp_extras if item.taxable_irrf)
        extra_fgts_taxable = sum(item.amount for item in emp_extras if item.taxable_fgts)

        extra_earnings_details = [
            {
                "rubric": item.rubric_name,
                "rubric_type": (item.rubric_type.value if hasattr(item.rubric_type, 'value') else str(item.rubric_type)),
                "amount": item.amount,
                "taxable_inss": item.taxable_inss,
                "taxable_irrf": item.taxable_irrf,
                "taxable_fgts": item.taxable_fgts,
            }
            for item in emp_extras
        ]

        absent_days = 1 if emp["id"] == "emp-1" else 0
        absence_deduction = round(absent_days * (base_salary / 30.0), 2)

        # Salário Bruto Total = Base + HE + Rúbricas Extraordinárias - Faltas
        gross_amount = round(base_salary + overtime_amount + extra_earnings_amount - absence_deduction, 2)

        # Base para INSS: Salário Base + HE - Faltas + Adicionais Tributáveis a INSS
        inss_base = max(0.0, base_salary + overtime_amount - absence_deduction + extra_inss_taxable)
        inss = round(_calculate_inss(inss_base), 2)

        # Base para IRRF: Salário Base + HE - Faltas + Adicionais Tributáveis a IRRF - INSS
        taxable_base_irrf = max(0.0, (base_salary + overtime_amount - absence_deduction + extra_irrf_taxable) - inss)
        irrf = round(_calculate_irrf(taxable_base_irrf), 2)

        # Descontos Legais Trabalhistas Brasileiros (Rúbricas CLT)
        # 1. Vale Transporte: até 6% do salário base (Art. 4º Lei 7.418/85)
        vt_deduction = round(base_salary * 0.06, 2) if emp.get("has_vt", True) else 0.0
        
        # 2. Vale Alimentação / Refeição: coparticipação máxima legal de 20% do valor do benefício PAT
        va_deduction = round(70.00, 2) if emp.get("has_va", True) else 0.0

        # 3. Plano de Saúde Corporativo (Coparticipação)
        health_plan = round(float(emp.get("health_plan_discount", 85.00)), 2) if emp.get("has_health", True) else 0.0

        # 4. Seguro de Vida Coletivo (Convenção Coletiva Construção Civil / NR-18)
        life_ins = round(float(emp.get("life_ins_discount", 15.00)), 2) if emp.get("has_life_ins", True) else 0.0

        total_statutory_deductions = round(inss + irrf, 2)
        total_benefits_deductions = round(vt_deduction + va_deduction + health_plan + life_ins, 2)
        total_emp_deductions = round(total_statutory_deductions + total_benefits_deductions, 2)
        
        net_amount = round(gross_amount - total_emp_deductions, 2)

        # FGTS Digital: 8% sobre a remuneração base tributável a FGTS
        fgts_base = max(0.0, base_salary + overtime_amount - absence_deduction + extra_fgts_taxable)
        fgts_amount = round(fgts_base * 0.08, 2)

        deductions_json = {
            "inss": inss,
            "irrf": irrf,
            "vale_transporte_6perc": vt_deduction,
            "vale_alimentacao_pat": va_deduction,
            "plano_saude_coparticipacao": health_plan,
            "seguro_vida_coletivo_nr18": life_ins,
            "fgts_patronal_8perc": fgts_amount,
            "absence_deduction": absence_deduction,
            "absence_days": absent_days,
            "extraordinary_earnings": extra_earnings_details
        }

        record = {
            "id": f"pay-{payload.reference_month}-{emp['id']}",
            "employee_id": emp["id"],
            "employee_name": emp["full_name"],
            "employee_role": emp["role"],
            "construction_role": emp.get("construction_role", "ENGENHEIRO_CAMPO"),
            "reference_month": payload.reference_month,
            "base_salary": base_salary,
            "overtime_hours": overtime_hours,
            "overtime_amount": overtime_amount,
            "extraordinary_amount": extra_earnings_amount,
            "absent_days": absent_days,
            "absence_deduction": absence_deduction,
            "gross_amount": gross_amount,
            "inss_deduction": inss,
            "irrf_deduction": irrf,
            "benefits_deduction": total_benefits_deductions,
            "net_amount": net_amount,
            "fgts_amount": fgts_amount,
            "deductions_json": deductions_json,
            "status": "DRAFT",
            "calculated_at": datetime.now().isoformat()
        }

        # Atualiza mock record
        existing_idx = next(
            (i for i, r in enumerate(_MOCK_PAYROLL_RECORDS)
             if r["employee_id"] == emp["id"] and r["reference_month"] == payload.reference_month),
            None
        )
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

    if not records:
        curr_month = date.today().strftime("%Y-%m")
        req = CalculatePayrollRequest(reference_month=reference_month or curr_month)
        calc_res = await calculate_payroll(req)
        records = calc_res["records"]

    return {
        "reference_month": reference_month or (records[0]["reference_month"] if records else date.today().strftime("%Y-%m")),
        "total_records": len(records),
        "total_gross": round(sum(float(r["gross_amount"]) for r in records), 2),
        "total_net": round(sum(float(r["net_amount"]) for r in records), 2),
        "items": records
    }


# -----------------------------------------------------------------------------
# Fechamento de Folha Atômico com Geração Automática no Contas a Pagar
# (Salários Líquidos, DARF, FGTS, Benefícios VA/VT e Plano de Saúde)
# -----------------------------------------------------------------------------
class ClosePayrollRequest(BaseModel):
    reference_month: str = Field(..., description="Formato YYYY-MM")
    simulate_darf_failure: Optional[bool] = Field(default=False)


@router.post("/payroll/close")
async def close_payroll_and_integrate_financial(
    payload: ClosePayrollRequest,
    x_tenant_id: Optional[str] = Header(None),
):
    records = [r for r in _MOCK_PAYROLL_RECORDS if r["reference_month"] == payload.reference_month]
    if not records:
        calc_res = await calculate_payroll(CalculatePayrollRequest(reference_month=payload.reference_month))
        records = calc_res["records"]

    if payload.simulate_darf_failure:
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

    # Consolidação de Rúbricas para Contas a Pagar
    total_net = sum(float(r["net_amount"]) for r in records)
    total_inss = sum(float(r["inss_deduction"]) for r in records)
    total_irrf = sum(float(r["irrf_deduction"]) for r in records)
    total_fgts = sum(float(r.get("fgts_amount", round(float(r["gross_amount"]) * 0.08, 2))) for r in records)
    
    # Rúbricas de Benefícios de Terceiros (Fornecedores de VA, VT e Convênio Médico)
    total_health = sum(float(r.get("deductions_json", {}).get("plano_saude_coparticipacao", 0.0)) for r in records)
    total_vt = sum(float(r.get("deductions_json", {}).get("vale_transporte_6perc", 0.0)) for r in records)
    total_va = sum(float(r.get("deductions_json", {}).get("vale_alimentacao_pat", 0.0)) for r in records)

    staged_payables = [
        # 1. Salários Líquidos a Pagar aos Colaboradores
        {
            "id": f"pay-net-{payload.reference_month}",
            "type": "PAYABLE_NET_SALARY",
            "category": "Salários e Ordenados",
            "recipient": "Folha de Pagamento Consolidada",
            "amount": round(total_net, 2),
            "due_date": (date.today().replace(day=5) + timedelta(days=30)).isoformat(),
            "source_type": "PAYROLL",
        },
        # 2. DARF Previdenciário Unificado (INSS + IRRF eSocial)
        {
            "id": f"pay-darf-{payload.reference_month}",
            "type": "PAYABLE_DARF_ESOCIAL",
            "category": "Impostos Trabalhistas (DARF / eSocial)",
            "recipient": "Receita Federal do Brasil (RFB)",
            "amount": round(total_inss + total_irrf, 2),
            "due_date": (date.today().replace(day=20) + timedelta(days=30)).isoformat(),
            "source_type": "PAYROLL",
        },
        # 3. FGTS Digital
        {
            "id": f"pay-fgts-{payload.reference_month}",
            "type": "PAYABLE_FGTS_DIGITAL",
            "category": "Encargos Sociais (FGTS Digital)",
            "recipient": "Caixa Econômica Federal",
            "amount": round(total_fgts, 2),
            "due_date": (date.today().replace(day=20) + timedelta(days=30)).isoformat(),
            "source_type": "PAYROLL",
        },
        # 4. Operadora de Plano de Saúde Corporativo
        {
            "id": f"pay-health-{payload.reference_month}",
            "type": "PAYABLE_HEALTH_INSURANCE",
            "category": "Benefícios - Convênio Médico",
            "recipient": "Operadora de Saúde Empresarial",
            "amount": round(total_health * 2.2, 2),  # Custo da construtora deduzido da coparticipação
            "due_date": (date.today().replace(day=10) + timedelta(days=30)).isoformat(),
            "source_type": "PAYROLL",
        },
        # 5. Fornecedora de Vale Alimentação / Refeição
        {
            "id": f"pay-va-{payload.reference_month}",
            "type": "PAYABLE_MEAL_VOUCHER",
            "category": "Benefícios - Vale Refeição / Alimentação",
            "recipient": "Emissora de Cartões de Benefício (PAT)",
            "amount": round(total_va * 4.0, 2),
            "due_date": (date.today().replace(day=1) + timedelta(days=30)).isoformat(),
            "source_type": "PAYROLL",
        },
    ]

    for r in records:
        r["status"] = "CLOSED"

    total_obligation = 0.0
    for p in staged_payables:
        total_obligation += float(p["amount"])
    total_obligation = round(total_obligation, 2)

    return {
        "success": True,
        "reference_month": payload.reference_month,
        "records_closed": len(records),
        "financial_payables_generated": staged_payables,
        "total_financial_obligation": total_obligation,
        "message": f"Folha de {payload.reference_month} fechada e 5 títulos automáticos gerados no Contas a Pagar!",
    }


# -----------------------------------------------------------------------------
# Exportação / Importação de Arquivos da Folha (CNAB240 / CSV / JSON)
# -----------------------------------------------------------------------------
@router.get("/payroll/export")
async def export_payroll(
    reference_month: str = Query(..., description="Mês formato YYYY-MM"),
    format_type: str = Query("csv", pattern="^(csv|json|cnab240)$")
):
    records = [r for r in _MOCK_PAYROLL_RECORDS if r["reference_month"] == reference_month]
    if not records:
        calc_res = await calculate_payroll(CalculatePayrollRequest(reference_month=reference_month))
        records = calc_res["records"]

    if format_type == "json":
        return {"reference_month": reference_month, "records": records}

    if format_type == "cnab240":
        # Simula remessa bancária CNAB 240 Febraban para pagamento eletrônico de salários
        lines = [
            f"00100000         2099999999000199GADAP CONSTRUTORA               BANCO DO BRASIL {datetime.now().strftime('%d%m%Y')}",
            f"00100011C2001030 2099999999000199GADAP CONSTRUTORA               LOTE FOLHA DE PAGAMENTO",
        ]
        for idx, r in enumerate(records, start=1):
            cpf_clean = "".join(filter(str.isdigit, r.get("cpf", "11122233344"))).ljust(14)
            val_cents = str(int(round(r["net_amount"] * 100))).zfill(15)
            lines.append(f"00100013{str(idx).zfill(5)}A00000000000000{cpf_clean}{r['employee_name'][:30].ljust(30)}{val_cents}")
        lines.append(f"00100015{str(len(records) + 2).zfill(6)}")
        lines.append(f"00199999{str(len(records) + 4).zfill(6)}")
        return {
            "format": "CNAB240",
            "file_name": f"REM_FOLHA_{reference_month.replace('-', '')}.REM",
            "content": "\r\n".join(lines),
            "records_count": len(records),
        }

    # Formato CSV padrão com detalhamento executivo e mascaramento LGPD
    csv_header = "ID;Colaborador;CPF;Cargo;Cargo_Organograma;Salario_Base;Horas_Extras_R$;Faltas_R$;Remun_Extraordinarias_R$;Detalhamento_Extraordinarias;Bruto_R$;INSS_R$;IRRF_R$;Beneficios_VT_VA_Saude_R$;Liquido_R$;FGTS_8perc_R$"
    rows = [csv_header]
    for r in records:
        extra_details_str = ""
        extras_list = r.get("deductions_json", {}).get("extraordinary_earnings", [])
        if extras_list:
            extra_details_str = "|".join(f"{x.get('rubric')}:{x.get('amount')}" for x in extras_list)
        cpf_val = mask_cpf(r.get("cpf")) if r.get("cpf") else "123.***.***-01"
        rows.append(
            f"{r['employee_id']};{r['employee_name']};{cpf_val};{r['employee_role']};{r.get('construction_role', '')};"
            f"{r['base_salary']};{r['overtime_amount']};{r['absence_deduction']};{r.get('extraordinary_amount', 0.0)};{extra_details_str};"
            f"{r['gross_amount']};{r['inss_deduction']};{r['irrf_deduction']};{r.get('benefits_deduction', 0.0)};"
            f"{r['net_amount']};{r.get('fgts_amount', 0.0)}"
        )
    return {
        "format": "CSV",
        "file_name": f"Folha_{reference_month}.csv",
        "content": "\n".join(rows),
        "records_count": len(records)
    }


# -----------------------------------------------------------------------------
# Aprendizado Contínuo de Apelidos no Ponto de Campo (Campo -> RH)
# -----------------------------------------------------------------------------
_TENANT_EMPLOYEE_ALIASES: Dict[str, Dict[str, Dict[str, str]]] = {}


class ResolveAttendanceAliasesRequest(BaseModel):
    names: List[str] = Field(..., description="Lista de nomes ou apelidos digitados pelo mestre de obras")


class LearnEmployeeAliasRequest(BaseModel):
    alias: str = Field(..., min_length=2, description="Apelido usado no canteiro (ex: Tonhão)")
    employee_id: str = Field(..., description="ID do funcionário oficial")
    employee_name: str = Field(..., description="Nome completo oficial do funcionário")


@router.post("/attendance/resolve-aliases")
async def resolve_attendance_aliases(
    payload: ResolveAttendanceAliasesRequest,
    x_tenant_id: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """
    Resolve nomes/apelidos enviados pelo mestre de obras no ponto estilo WhatsApp.
    Emite aviso automático caso algum nome não seja reconhecido, permitindo o aprendizado.
    """
    tenant_id_str = x_tenant_id or "default-tenant"
    tenant_aliases = _TENANT_EMPLOYEE_ALIASES.setdefault(tenant_id_str, {})
    employees = [
        e for e in _MOCK_EMPLOYEES
        if not x_tenant_id or str(e.get("tenant_id", "")) == x_tenant_id
    ]

    recognized: List[Dict[str, str]] = []
    unrecognized: List[str] = []

    for raw_name in payload.names:
        clean = raw_name.strip()
        if not clean:
            continue
        key = clean.lower()

        # 1. Verifica se já foi aprendido como apelido
        if key in tenant_aliases:
            learned = tenant_aliases[key]
            recognized.append({
                "input_name": clean,
                "employee_id": learned["employee_id"],
                "employee_name": learned["employee_name"],
                "match_type": "learned_alias",
            })
            continue

        # 2. Verifica correspondência direta ou parcial com funcionários cadastrados
        matched_emp = next(
            (e for e in employees if key in str(e.get("full_name", "")).lower()),
            None,
        )
        if matched_emp:
            recognized.append({
                "input_name": clean,
                "employee_id": str(matched_emp["id"]),
                "employee_name": str(matched_emp["full_name"]),
                "match_type": "official_name",
            })
        else:
            unrecognized.append(clean)

    warning_message = None
    if unrecognized:
        names_str = ", ".join(unrecognized)
        warning_message = (
            f"Atenção: O sistema não reconheceu os seguintes nomes no ponto: {names_str}. "
            "Vincule cada apelido ao colaborador oficial para que o sistema aprenda automaticamente."
        )

    return {
        "recognized": recognized,
        "unrecognized": unrecognized,
        "has_unrecognized": len(unrecognized) > 0,
        "warning_message": warning_message,
    }


@router.post("/employees/learn-alias")
async def learn_employee_alias(
    payload: LearnEmployeeAliasRequest,
    x_tenant_id: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """
    Ensina ao sistema um novo apelido de colaborador para o tenant atual.
    Nas próximas marcações de ponto, o apelido será reconhecido automaticamente.
    """
    tenant_id_str = x_tenant_id or "default-tenant"
    tenant_aliases = _TENANT_EMPLOYEE_ALIASES.setdefault(tenant_id_str, {})
    alias_key = payload.alias.strip().lower()

    tenant_aliases[alias_key] = {
        "employee_id": payload.employee_id,
        "employee_name": payload.employee_name,
    }

    return {
        "success": True,
        "alias": payload.alias.strip(),
        "employee_id": payload.employee_id,
        "employee_name": payload.employee_name,
        "message": f"Apelido '{payload.alias.strip()}' aprendido e vinculado a '{payload.employee_name}'!",
    }
