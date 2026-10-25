from datetime import date, datetime
from decimal import Decimal
import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
import httpx
from app.core.config import settings
from app.core.deps import get_current_tenant_and_token
from app.schemas.subcontract import (
    ComplianceCheckSummary,
    ComplianceDocumentCreate,
    ComplianceDocumentResponse,
    ComplianceDocumentVerify,
    RiskStatus,
    SpecialtyCreate,
    SpecialtyResponse,
    SubMeasurementApprovalRequest,
    SubMeasurementCreate,
    SubMeasurementResponse,
    SubMeasurementStatus,
    SubMeasurementUpdate,
    SubcontractAccountStatement,
    SubcontractCreate,
    SubcontractResponse,
    SubcontractStatus,
    SubcontractTransactionCreate,
    SubcontractTransactionResponse,
    SubcontractUpdate,
    SupplierSpecialtyLink,
    TransactionType,
)
from app.services.subcontract_compliance_service import (
    ComplianceBlockedException,
    SubcontractComplianceService,
)

logger = logging.getLogger("gadap.subcontracts")

router = APIRouter()


def _get_supabase_headers(token: str) -> Dict[str, str]:
    return {
        "apikey": settings.SUPABASE_ANON_KEY or "",
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


# ==============================================================================
# 1. ROTAS DE ESPECIALIDADES TÉCNICAS (SPECIALTIES)
# ==============================================================================

@router.get(
    "/specialties",
    response_model=List[SpecialtyResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar Especialidades Técnicas",
    description="Retorna o catálogo de especialidades do tenant (ex: Elétrica, Hidráulica, Alvenaria, Pintura).",
)
async def list_specialties(
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> List[SpecialtyResponse]:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')
    supabase_url = f"{base_url}/rest/v1/specialties"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.get(
                supabase_url,
                headers=_get_supabase_headers(token),
                params={"tenant_id": f"eq.{tenant_id}", "order": "name.asc"},
            )
            res.raise_for_status()
            return res.json()
        except Exception as exc:
            logger.error("Erro ao listar especialidades: %s", str(exc))
            raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post(
    "/specialties",
    response_model=SpecialtyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar Especialidade Técnica",
)
async def create_specialty(
    payload: SpecialtyCreate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> SpecialtyResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')
    supabase_url = f"{base_url}/rest/v1/specialties"

    insert_payload = {
        "tenant_id": str(tenant_id),
        "name": payload.name.strip(),
        "description": payload.description,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.post(
                f"{supabase_url}?select=*",
                headers=_get_supabase_headers(token),
                json=insert_payload,
            )
            res.raise_for_status()
            created = res.json()
            return created[0]
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=422, detail=f"Erro ao salvar especialidade: {exc.response.text}") from exc


@router.post(
    "/suppliers/{supplier_id}/specialties",
    status_code=status.HTTP_200_OK,
    summary="Vincular Especialidades ao Fornecedor/Subempreiteiro",
    description="Associa especialidades de atuação ao fornecedor e marca automaticamente is_subcontractor = true.",
)
async def link_supplier_specialties(
    supplier_id: UUID,
    payload: SupplierSpecialtyLink,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> Dict[str, Any]:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')

    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1. Marca fornecedor como subempreiteiro
        await client.patch(
            f"{base_url}/rest/v1/suppliers?id=eq.{supplier_id}&tenant_id=eq.{tenant_id}",
            headers=_get_supabase_headers(token),
            json={"is_subcontractor": True},
        )

        # 2. Insere vínculos
        inserts = [
            {
                "tenant_id": str(tenant_id),
                "supplier_id": str(supplier_id),
                "specialty_id": str(spec_id),
            }
            for spec_id in payload.specialty_ids
        ]

        if inserts:
            # Upsert or insert ignore
            res = await client.post(
                f"{base_url}/rest/v1/supplier_specialties",
                headers={**_get_supabase_headers(token), "Prefer": "resolution=ignore-duplicates"},
                json=inserts,
            )
            res.raise_for_status()

        return {
            "success": True,
            "message": f"{len(payload.specialty_ids)} especialidade(s) associada(s) ao fornecedor com sucesso.",
            "supplier_id": str(supplier_id),
            "is_subcontractor": True,
        }


@router.get(
    "/suppliers/{supplier_id}/specialties",
    response_model=List[SpecialtyResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar Especialidades do Fornecedor",
)
async def get_supplier_specialties(
    supplier_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> List[SpecialtyResponse]:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.get(
                f"{base_url}/rest/v1/supplier_specialties",
                headers=_get_supabase_headers(token),
                params={
                    "supplier_id": f"eq.{supplier_id}",
                    "tenant_id": f"eq.{tenant_id}",
                    "select": "specialties(*)",
                },
            )
            res.raise_for_status()
            records = res.json()
            return [r["specialties"] for r in records if r.get("specialties")]
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc


# ==============================================================================
# 2. ROTAS DE SUBCONTRATOS (SUBCONTRACTS & REGRA DO FAROL)
# ==============================================================================

async def _enrich_subcontract_data(
    client: httpx.AsyncClient,
    base_url: str,
    token: str,
    tenant_id: UUID,
    subcontract: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Enriquece o subcontrato com:
      - Especialidades do fornecedor
      - Total Pago (Conta Corrente)
      - Total Medido
      - Cálculo determinístico do FAROL DE RISCO (GREEN, YELLOW, RED)
    """
    sub_id = subcontract["id"]
    supp_id = subcontract.get("supplier_id")
    v_contrato = Decimal(str(subcontract.get("total_value", "0.0000")))

    # 1. Busca especialidades do fornecedor
    specialties_names: List[str] = []
    if supp_id:
        spec_res = await client.get(
            f"{base_url}/rest/v1/supplier_specialties",
            headers=_get_supabase_headers(token),
            params={"supplier_id": f"eq.{supp_id}", "tenant_id": f"eq.{tenant_id}", "select": "specialties(name)"},
        )
        if spec_res.is_success:
            for item in spec_res.json():
                if item.get("specialties") and item["specialties"].get("name"):
                    specialties_names.append(item["specialties"]["name"])

    # 2. Busca movimentações da conta corrente
    tx_res = await client.get(
        f"{base_url}/rest/v1/subcontract_transactions",
        headers=_get_supabase_headers(token),
        params={"subcontract_id": f"eq.{sub_id}", "tenant_id": f"eq.{tenant_id}", "select": "*"},
    )
    transactions = tx_res.json() if tx_res.is_success else []

    total_paid_tx = sum(Decimal(str(tx.get("amount", "0"))) for tx in transactions if tx.get("type") == "PAYMENT")
    total_measured_tx = sum(Decimal(str(tx.get("amount", "0"))) for tx in transactions if tx.get("type") == "MEASUREMENT")

    # 3. Busca medições formais aprovadas
    meas_res = await client.get(
        f"{base_url}/rest/v1/sub_measurements",
        headers=_get_supabase_headers(token),
        params={"subcontract_id": f"eq.{sub_id}", "tenant_id": f"eq.{tenant_id}", "status": "eq.approved", "select": "measured_value"},
    )
    measurements = meas_res.json() if meas_res.is_success else []
    total_measured_meas = sum(Decimal(str(m.get("measured_value", "0"))) for m in measurements)

    # Total medido consolidado
    total_measured = max(total_measured_tx, total_measured_meas)
    total_paid = total_paid_tx

    # 4. REGRA DO FAROL
    risk_info = SubcontractComplianceService.calculate_risk_traffic_light(
        contract_value=v_contrato,
        total_paid=total_paid,
        total_measured=total_measured,
    )

    balance_remaining = max(Decimal("0.0000"), v_contrato - total_measured)

    subcontract["specialties"] = sorted(specialties_names)
    subcontract["total_paid"] = total_paid
    subcontract["total_measured"] = total_measured
    subcontract["balance_remaining"] = balance_remaining
    subcontract["financial_exposure"] = risk_info["financial_exposure"]
    subcontract["risk_status"] = risk_info["risk_status"]
    subcontract["risk_description"] = risk_info["risk_description"]

    return subcontract


@router.get(
    "/",
    response_model=List[SubcontractResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar Subcontratos com Farol de Risco e Especialidades",
    description=(
        "Retorna a listagem de subcontratos com as especialidades do fornecedor, "
        "total pago, total medido e cálculo em tempo real do FAROL DE RISCO (GREEN, YELLOW, RED)."
    ),
)
async def list_subcontracts(
    project_id: Optional[UUID] = Query(None, description="Filtrar por obra"),
    supplier_id: Optional[UUID] = Query(None, description="Filtrar por fornecedor"),
    status_filter: Optional[SubcontractStatus] = Query(None, alias="status", description="Filtrar por status"),
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> List[SubcontractResponse]:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')
    supabase_url = f"{base_url}/rest/v1/subcontracts"

    params: Dict[str, str] = {
        "tenant_id": f"eq.{tenant_id}",
        "select": "*,suppliers(id,name,trade_name,document,tax_regime,is_subcontractor),projects(id,name,code)",
        "order": "created_at.desc",
    }
    if project_id:
        params["project_id"] = f"eq.{project_id}"
    if supplier_id:
        params["supplier_id"] = f"eq.{supplier_id}"
    if status_filter:
        params["status"] = f"eq.{status_filter.value}"

    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            res = await client.get(supabase_url, headers=_get_supabase_headers(token), params=params)
            res.raise_for_status()
            subcontracts = res.json()

            enriched_list = []
            for sub in subcontracts:
                enriched = await _enrich_subcontract_data(client, base_url, token, tenant_id, sub)
                enriched_list.append(enriched)

            return enriched_list
        except Exception as exc:
            logger.error("Falha ao listar subcontratos: %s", str(exc))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao consultar subcontratos: {str(exc)}",
            ) from exc


@router.post(
    "/",
    response_model=SubcontractResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar Novo Subcontrato de Terceirizado",
    description="Registra um novo subcontrato e marca o fornecedor como is_subcontractor = true.",
)
async def create_subcontract(
    payload: SubcontractCreate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> SubcontractResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')
    supabase_url = f"{base_url}/rest/v1/subcontracts"

    insert_payload = {
        "tenant_id": str(tenant_id),
        "project_id": str(payload.project_id) if payload.project_id else None,
        "supplier_id": str(payload.supplier_id),
        "contract_number": payload.contract_number,
        "scope_description": payload.scope_description,
        "total_value": float(payload.total_value),
        "technical_retention_percentage": float(payload.technical_retention_percentage),
        "status": payload.status.value,
        "start_date": payload.start_date.isoformat() if payload.start_date else None,
        "end_date": payload.end_date.isoformat() if payload.end_date else None,
        "notes": payload.notes,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            # 1. Marca fornecedor como subempreiteiro
            await client.patch(
                f"{base_url}/rest/v1/suppliers?id=eq.{payload.supplier_id}&tenant_id=eq.{tenant_id}",
                headers=_get_supabase_headers(token),
                json={"is_subcontractor": True},
            )

            # 2. Cria subcontrato
            res = await client.post(
                f"{supabase_url}?select=*,suppliers(id,name,trade_name,document,tax_regime,is_subcontractor),projects(id,name,code)",
                headers=_get_supabase_headers(token),
                json=insert_payload,
            )
            res.raise_for_status()
            records = res.json()
            if not records:
                raise HTTPException(status_code=400, detail="Erro ao criar subcontrato.")

            enriched = await _enrich_subcontract_data(client, base_url, token, tenant_id, records[0])
            return enriched
        except httpx.HTTPStatusError as exc:
            logger.error("Erro ao inserir subcontrato: %s", exc.response.text)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Erro ao salvar subcontrato: {exc.response.text}",
            ) from exc


@router.get(
    "/{subcontract_id}",
    response_model=SubcontractResponse,
    status_code=status.HTTP_200_OK,
    summary="Obter Subcontrato por ID (com Farol e Conta Corrente)",
)
async def get_subcontract_by_id(
    subcontract_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> SubcontractResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')
    supabase_url = f"{base_url}/rest/v1/subcontracts"

    params = {
        "id": f"eq.{subcontract_id}",
        "tenant_id": f"eq.{tenant_id}",
        "select": "*,suppliers(id,name,trade_name,document,tax_regime,is_subcontractor),projects(id,name,code),sub_measurements(*),subcontract_transactions(*)",
        "limit": "1",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.get(supabase_url, headers=_get_supabase_headers(token), params=params)
            res.raise_for_status()
            records = res.json()
            if not records:
                raise HTTPException(status_code=404, detail="Subcontrato não encontrado.")

            enriched = await _enrich_subcontract_data(client, base_url, token, tenant_id, records[0])
            return enriched
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put(
    "/{subcontract_id}",
    response_model=SubcontractResponse,
    status_code=status.HTTP_200_OK,
    summary="Atualizar Subcontrato",
)
async def update_subcontract(
    subcontract_id: UUID,
    payload: SubcontractUpdate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> SubcontractResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')
    supabase_url = f"{base_url}/rest/v1/subcontracts"

    update_dict = payload.model_dump(exclude_unset=True)
    if "status" in update_dict and update_dict["status"]:
        update_dict["status"] = update_dict["status"].value
    if "total_value" in update_dict and update_dict["total_value"] is not None:
        update_dict["total_value"] = float(update_dict["total_value"])
    if "technical_retention_percentage" in update_dict and update_dict["technical_retention_percentage"] is not None:
        update_dict["technical_retention_percentage"] = float(update_dict["technical_retention_percentage"])
    if "start_date" in update_dict and update_dict["start_date"]:
        update_dict["start_date"] = update_dict["start_date"].isoformat()
    if "end_date" in update_dict and update_dict["end_date"]:
        update_dict["end_date"] = update_dict["end_date"].isoformat()

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.patch(
                f"{supabase_url}?id=eq.{subcontract_id}&tenant_id=eq.{tenant_id}&select=*,suppliers(id,name,trade_name,document,tax_regime,is_subcontractor),projects(id,name,code)",
                headers=_get_supabase_headers(token),
                json=update_dict,
            )
            res.raise_for_status()
            records = res.json()
            if not records:
                raise HTTPException(status_code=404, detail="Subcontrato não encontrado para atualização.")

            enriched = await _enrich_subcontract_data(client, base_url, token, tenant_id, records[0])
            return enriched
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc


# ==============================================================================
# 3. ROTAS DE CONTA CORRENTE (TRANSACTIONS) - REGRA DE ZERO TRAVAS
# ==============================================================================

@router.post(
    "/{subcontract_id}/transactions",
    status_code=status.HTTP_201_CREATED,
    summary="Lançar Transação na Conta Corrente (ZERO TRAVAS)",
    description=(
        "REGRA DE ZERO TRAVAS: Registra desembolsos ('PAYMENT') ou avanços ('MEASUREMENT'). "
        "NUNCA bloqueia a operação, mesmo se o farol de risco for RED ou YELLOW. "
        "Integra automaticamente com o Módulo Financeiro para gerar a despesa em financial_entries."
    ),
)
async def create_subcontract_transaction(
    subcontract_id: UUID,
    payload: SubcontractTransactionCreate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> Dict[str, Any]:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')

    async with httpx.AsyncClient(timeout=20.0) as client:
        # 1. Recupera o subcontrato
        sub_res = await client.get(
            f"{base_url}/rest/v1/subcontracts",
            headers=_get_supabase_headers(token),
            params={"id": f"eq.{subcontract_id}", "tenant_id": f"eq.{tenant_id}", "limit": "1"},
        )
        sub_res.raise_for_status()
        sub_records = sub_res.json()
        if not sub_records:
            raise HTTPException(status_code=404, detail="Subcontrato não encontrado.")
        subcontract = sub_records[0]

        financial_entry = None
        financial_entry_id = None
        tx_date = payload.date or date.today()

        # 2. INTEGRAÇÃO FINANCEIRA: Se for PAYMENT e create_financial_entry == True, gera a despesa
        if payload.type == TransactionType.PAYMENT and payload.create_financial_entry:
            contract_num = subcontract.get("contract_number") or str(subcontract_id)[:8]
            due = payload.due_date or tx_date

            fin_payload = {
                "tenant_id": str(tenant_id),
                "project_id": str(subcontract["project_id"]) if subcontract.get("project_id") else None,
                "supplier_id": str(subcontract["supplier_id"]),
                "entry_type": "payable",
                "description": f"Desembolso Subcontrato {contract_num}" + (f" - {payload.observation}" if payload.observation else ""),
                "category": "subempreiteiros",
                "nominal_amount": float(payload.amount),
                "technical_retention_amount": 0.0,
                "discount_amount": 0.0,
                "net_amount": float(payload.amount),
                "status": "pendente",
                "due_date": due.isoformat(),
                "payment_date": tx_date.isoformat() if due <= date.today() else None,
                "document_number": f"PAG-SUB-{contract_num}-{tx_date.strftime('%Y%m%d')}",
                "document_type": "recibo_subcontrato",
                "notes": f"Lançamento automático via Conta Corrente de Terceirizados. Obs: {payload.observation or 'S/N'}",
            }

            fin_res = await client.post(
                f"{base_url}/rest/v1/financial_entries?select=*",
                headers=_get_supabase_headers(token),
                json=fin_payload,
            )
            if fin_res.is_success and fin_res.json():
                financial_entry = fin_res.json()[0]
                financial_entry_id = financial_entry["id"]
            else:
                logger.warning("Não foi possível gerar financial_entry automático: %s", fin_res.text)

        # 3. Registra a transação na conta corrente
        tx_insert = {
            "tenant_id": str(tenant_id),
            "subcontract_id": str(subcontract_id),
            "type": payload.type.value,
            "amount": float(payload.amount),
            "date": tx_date.isoformat(),
            "observation": payload.observation,
            "financial_entry_id": str(financial_entry_id) if financial_entry_id else None,
        }

        tx_res = await client.post(
            f"{base_url}/rest/v1/subcontract_transactions?select=*",
            headers=_get_supabase_headers(token),
            json=tx_insert,
        )
        tx_res.raise_for_status()
        created_tx = tx_res.json()[0]

        # 4. RECALCULA O FAROL DE RISCO ATUALIZADO (ZERO BLOQUEIOS!)
        enriched_sub = await _enrich_subcontract_data(client, base_url, token, tenant_id, subcontract)

        risk_warning = None
        if enriched_sub["risk_status"] == "RED":
            risk_warning = (
                "⚠️ ALERTA VERMELHO (RISCO CRÍTICO): Os pagamentos acumulados superam o avanço medido "
                "e já atingiram mais de 80% do contrato global. Operação autorizada conforme política Zero Travas."
            )
        elif enriched_sub["risk_status"] == "YELLOW":
            risk_warning = (
                "⚠️ ALERTA AMARELO (ATENÇÃO): Os pagamentos superam o avanço medido em campo, "
                "mas continuam abaixo de 80% do contrato global."
            )

        return {
            "success": True,
            "message": "Transação lançada na conta corrente com sucesso (Zero Travas).",
            "transaction": created_tx,
            "financial_entry": financial_entry,
            "updated_account_summary": {
                "total_paid": float(enriched_sub["total_paid"]),
                "total_measured": float(enriched_sub["total_measured"]),
                "financial_exposure": float(enriched_sub["financial_exposure"]),
                "contract_balance": float(enriched_sub["balance_remaining"]),
                "risk_status": enriched_sub["risk_status"],
                "risk_description": enriched_sub["risk_description"],
            },
            "risk_warning": risk_warning,
        }


@router.get(
    "/{subcontract_id}/transactions",
    response_model=List[SubcontractTransactionResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar Transações da Conta Corrente",
)
async def list_subcontract_transactions(
    subcontract_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> List[SubcontractTransactionResponse]:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.get(
                f"{base_url}/rest/v1/subcontract_transactions",
                headers=_get_supabase_headers(token),
                params={"subcontract_id": f"eq.{subcontract_id}", "tenant_id": f"eq.{tenant_id}", "order": "date.desc,created_at.desc"},
            )
            res.raise_for_status()
            return res.json()
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get(
    "/{subcontract_id}/statement",
    response_model=SubcontractAccountStatement,
    status_code=status.HTTP_200_OK,
    summary="Extrato Completo da Conta Corrente e Diagnóstico do Farol",
)
async def get_subcontract_account_statement(
    subcontract_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> SubcontractAccountStatement:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')

    async with httpx.AsyncClient(timeout=20.0) as client:
        # Busca subcontrato com fornecedor
        sub_res = await client.get(
            f"{base_url}/rest/v1/subcontracts",
            headers=_get_supabase_headers(token),
            params={"id": f"eq.{subcontract_id}", "tenant_id": f"eq.{tenant_id}", "select": "*,suppliers(*)", "limit": "1"},
        )
        sub_res.raise_for_status()
        records = sub_res.json()
        if not records:
            raise HTTPException(status_code=404, detail="Subcontrato não encontrado.")

        subcontract = records[0]
        enriched = await _enrich_subcontract_data(client, base_url, token, tenant_id, subcontract)

        # Busca transações
        tx_res = await client.get(
            f"{base_url}/rest/v1/subcontract_transactions",
            headers=_get_supabase_headers(token),
            params={"subcontract_id": f"eq.{subcontract_id}", "tenant_id": f"eq.{tenant_id}", "order": "date.asc,created_at.asc"},
        )
        transactions = tx_res.json() if tx_res.is_success else []

        return SubcontractAccountStatement(
            subcontract_id=subcontract["id"],
            contract_number=subcontract.get("contract_number"),
            total_value=Decimal(str(subcontract["total_value"])),
            total_measured=enriched["total_measured"],
            total_paid=enriched["total_paid"],
            balance_to_measure=enriched["balance_remaining"],
            financial_exposure=enriched["financial_exposure"],
            risk_status=RiskStatus(enriched["risk_status"]),
            risk_description=enriched["risk_description"],
            supplier=subcontract.get("suppliers") or {},
            specialties=enriched["specialties"],
            transactions=transactions,
        )


# ==============================================================================
# 4. ROTAS DE MEDIÇÕES E COMPLIANCE (GFIP, CND, FGTS)
# ==============================================================================

@router.get(
    "/{subcontract_id}/measurements",
    response_model=List[SubMeasurementResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar Medições de um Subcontrato",
)
async def list_sub_measurements(
    subcontract_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> List[SubMeasurementResponse]:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')
    supabase_url = f"{base_url}/rest/v1/sub_measurements"

    params = {
        "subcontract_id": f"eq.{subcontract_id}",
        "tenant_id": f"eq.{tenant_id}",
        "select": "*,compliance_documents(*)",
        "order": "measurement_number.asc",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.get(supabase_url, headers=_get_supabase_headers(token), params=params)
            res.raise_for_status()
            return res.json()
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post(
    "/{subcontract_id}/measurements",
    response_model=SubMeasurementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar Boletim de Medição de Subempreiteiro",
)
async def create_sub_measurement(
    subcontract_id: UUID,
    payload: SubMeasurementCreate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> SubMeasurementResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')

    async with httpx.AsyncClient(timeout=15.0) as client:
        sub_res = await client.get(
            f"{base_url}/rest/v1/subcontracts",
            headers=_get_supabase_headers(token),
            params={"id": f"eq.{subcontract_id}", "tenant_id": f"eq.{tenant_id}", "limit": "1"},
        )
        sub_res.raise_for_status()
        subcontracts = sub_res.json()
        if not subcontracts:
            raise HTTPException(status_code=404, detail="Subcontrato não encontrado.")
        subcontract = subcontracts[0]

        count_res = await client.get(
            f"{base_url}/rest/v1/sub_measurements",
            headers=_get_supabase_headers(token),
            params={"subcontract_id": f"eq.{subcontract_id}", "tenant_id": f"eq.{tenant_id}", "select": "measurement_number"},
        )
        count_res.raise_for_status()
        existing = count_res.json()
        next_number = max([m.get("measurement_number", 0) for m in existing] or [0]) + 1
        measurement_number = payload.measurement_number or next_number

        val_medido = Decimal(str(payload.measured_value))
        tech_rate = Decimal(str(subcontract.get("technical_retention_percentage", "0.0500")))
        tech_amount = (val_medido * tech_rate).quantize(Decimal("0.0001"))

        insert_payload = {
            "tenant_id": str(tenant_id),
            "subcontract_id": str(subcontract_id),
            "measurement_number": measurement_number,
            "measured_value": float(val_medido),
            "technical_retention_amount": float(tech_amount),
            "inss_retention_amount": 0.0,
            "iss_retention_amount": 0.0,
            "tax_withholding_amount": 0.0,
            "net_payable_amount": float(val_medido - tech_amount),
            "status": SubMeasurementStatus.PENDING_DOCUMENTS.value,
            "invoice_url": payload.invoice_url,
            "measurement_date": (payload.measurement_date or date.today()).isoformat(),
            "notes": payload.notes,
        }

        try:
            res = await client.post(
                f"{base_url}/rest/v1/sub_measurements?select=*,compliance_documents(*)",
                headers=_get_supabase_headers(token),
                json=insert_payload,
            )
            res.raise_for_status()
            created = res.json()
            return created[0]
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=422, detail=f"Erro ao registrar medição: {exc.response.text}") from exc


@router.get(
    "/measurements/{measurement_id}",
    response_model=SubMeasurementResponse,
    status_code=status.HTTP_200_OK,
    summary="Obter Detalhes da Medição de Terceirizado",
)
async def get_sub_measurement_by_id(
    measurement_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> SubMeasurementResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')
    supabase_url = f"{base_url}/rest/v1/sub_measurements"

    params = {
        "id": f"eq.{measurement_id}",
        "tenant_id": f"eq.{tenant_id}",
        "select": "*,compliance_documents(*),subcontracts(*,suppliers(id,name,trade_name,document,tax_regime),projects(id,name,code))",
        "limit": "1",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.get(supabase_url, headers=_get_supabase_headers(token), params=params)
            res.raise_for_status()
            records = res.json()
            if not records:
                raise HTTPException(status_code=404, detail="Medição não encontrada.")
            return records[0]
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post(
    "/measurements/{measurement_id}/documents",
    response_model=ComplianceDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Anexar Documento de Compliance Trabalhista (GFIP, CND, FGTS)",
)
async def attach_compliance_document(
    measurement_id: UUID,
    payload: ComplianceDocumentCreate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> ComplianceDocumentResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')

    insert_payload = {
        "tenant_id": str(tenant_id),
        "sub_measurement_id": str(measurement_id),
        "document_type": payload.document_type.value,
        "file_url": payload.file_url,
        "is_verified": False,
        "notes": payload.notes,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.post(
                f"{base_url}/rest/v1/compliance_documents?select=*",
                headers=_get_supabase_headers(token),
                json=insert_payload,
            )
            res.raise_for_status()
            created = res.json()
            return created[0]
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=422, detail=f"Erro ao anexar documento: {exc.response.text}") from exc


@router.patch(
    "/documents/{document_id}/verify",
    response_model=ComplianceDocumentResponse,
    status_code=status.HTTP_200_OK,
    summary="Verificar / Auditar Documento de Compliance",
)
async def verify_compliance_document(
    document_id: UUID,
    payload: ComplianceDocumentVerify,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> ComplianceDocumentResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')

    patch_payload = {
        "is_verified": payload.is_verified,
        "verified_at": datetime.now().isoformat() if payload.is_verified else None,
        "notes": payload.notes,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.patch(
                f"{base_url}/rest/v1/compliance_documents?id=eq.{document_id}&tenant_id=eq.{tenant_id}&select=*",
                headers=_get_supabase_headers(token),
                json=patch_payload,
            )
            res.raise_for_status()
            updated = res.json()
            if not updated:
                raise HTTPException(status_code=404, detail="Documento de compliance não encontrado.")
            return updated[0]
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get(
    "/measurements/{measurement_id}/compliance-status",
    response_model=ComplianceCheckSummary,
    status_code=status.HTTP_200_OK,
    summary="Consultar Diagnóstico de Regularidade e Trava",
)
async def check_measurement_compliance_status(
    measurement_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> ComplianceCheckSummary:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')

    async with httpx.AsyncClient(timeout=15.0) as client:
        doc_res = await client.get(
            f"{base_url}/rest/v1/compliance_documents",
            headers=_get_supabase_headers(token),
            params={"sub_measurement_id": f"eq.{measurement_id}", "tenant_id": f"eq.{tenant_id}"},
        )
        doc_res.raise_for_status()
        documents = doc_res.json()

        audit = SubcontractComplianceService.audit_measurement_compliance(documents)
        return ComplianceCheckSummary.model_validate(audit)


@router.post(
    "/measurements/{measurement_id}/approve",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Aprovar Medição, Executar Trava de Compliance e Abater Retenções Fiscais",
)
async def approve_sub_measurement(
    measurement_id: UUID,
    payload: SubMeasurementApprovalRequest,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> Dict[str, Any]:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')

    async with httpx.AsyncClient(timeout=20.0) as client:
        # 1. Busca a medição
        meas_res = await client.get(
            f"{base_url}/rest/v1/sub_measurements",
            headers=_get_supabase_headers(token),
            params={"id": f"eq.{measurement_id}", "tenant_id": f"eq.{tenant_id}", "limit": "1"},
        )
        meas_res.raise_for_status()
        meas_records = meas_res.json()
        if not meas_records:
            raise HTTPException(status_code=404, detail="Medição de terceirizado não encontrada.")
        sub_measurement = meas_records[0]

        if sub_measurement.get("status") == SubMeasurementStatus.APPROVED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Esta medição já foi aprovada e possui lançamento financeiro gerado.",
            )

        # 2. Busca o subcontrato vinculado e fornecedor
        subcontract_id = sub_measurement["subcontract_id"]
        sub_res = await client.get(
            f"{base_url}/rest/v1/subcontracts",
            headers=_get_supabase_headers(token),
            params={"id": f"eq.{subcontract_id}", "tenant_id": f"eq.{tenant_id}", "limit": "1"},
        )
        sub_res.raise_for_status()
        sub_records = sub_res.json()
        if not sub_records:
            raise HTTPException(status_code=404, detail="Subcontrato vinculado não encontrado.")
        subcontract = sub_records[0]

        supplier_id = subcontract["supplier_id"]
        supp_res = await client.get(
            f"{base_url}/rest/v1/suppliers",
            headers=_get_supabase_headers(token),
            params={"id": f"eq.{supplier_id}", "tenant_id": f"eq.{tenant_id}", "limit": "1"},
        )
        supp_res.raise_for_status()
        supp_records = supp_res.json()
        supplier = supp_records[0] if supp_records else {}
        supplier_tax_regime = supplier.get("tax_regime")

        # 3. Documentos de compliance
        doc_res = await client.get(
            f"{base_url}/rest/v1/compliance_documents",
            headers=_get_supabase_headers(token),
            params={"sub_measurement_id": f"eq.{measurement_id}", "tenant_id": f"eq.{tenant_id}"},
        )
        doc_res.raise_for_status()
        documents = doc_res.json()

        # 4. Executa Trava de Compliance e Cálculo de Retenções
        compliance_plan = SubcontractComplianceService.enforce_compliance_and_prepare_financial_entry(
            subcontract=subcontract,
            sub_measurement=sub_measurement,
            documents=documents,
            supplier_tax_regime=supplier_tax_regime,
            custom_iss_rate=payload.custom_iss_rate,
            custom_inss_rate=payload.custom_inss_rate,
            due_date=payload.due_date,
            notes=payload.notes,
        )

        # 5. Gera lançamento financeiro (Contas a Pagar)
        financial_entry_payload = compliance_plan["financial_entry_payload"]
        fin_res = await client.post(
            f"{base_url}/rest/v1/financial_entries?select=*",
            headers=_get_supabase_headers(token),
            json=financial_entry_payload,
        )
        if not fin_res.is_success:
            logger.error("Falha ao gerar lançamento financeiro: %s", fin_res.text)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Falha ao gerar Contas a Pagar: {fin_res.text}",
            )
        financial_entry = fin_res.json()[0]

        # 6. Atualiza a medição
        withholdings = compliance_plan["withholdings"]
        meas_update_payload = {
            "status": SubMeasurementStatus.APPROVED.value,
            "financial_entry_id": financial_entry["id"],
            "compliance_checked_at": datetime.now().isoformat(),
            "technical_retention_amount": float(withholdings["technical_retention_amount"]),
            "inss_retention_amount": float(withholdings["inss_retention_amount"]),
            "iss_retention_amount": float(withholdings["iss_retention_amount"]),
            "tax_withholding_amount": float(withholdings["tax_withholding_amount"]),
            "net_payable_amount": float(withholdings["net_payable_amount"]),
        }

        meas_patch_res = await client.patch(
            f"{base_url}/rest/v1/sub_measurements?id=eq.{measurement_id}&tenant_id=eq.{tenant_id}&select=*",
            headers=_get_supabase_headers(token),
            json=meas_update_payload,
        )
        meas_patch_res.raise_for_status()
        approved_measurement = meas_patch_res.json()[0]

        # 7. Registra a medição física também na Conta Corrente (subcontract_transactions)
        tx_insert = {
            "tenant_id": str(tenant_id),
            "subcontract_id": str(subcontract_id),
            "type": TransactionType.MEASUREMENT.value,
            "amount": float(withholdings["measured_value"]),
            "date": sub_measurement.get("measurement_date") or date.today().isoformat(),
            "observation": f"Medição aprovada #{sub_measurement.get('measurement_number', 1)}",
        }
        await client.post(
            f"{base_url}/rest/v1/subcontract_transactions",
            headers=_get_supabase_headers(token),
            json=tx_insert,
        )

        # 8. Recalcula o farol de risco do subcontrato
        enriched = await _enrich_subcontract_data(client, base_url, token, tenant_id, subcontract)

        return {
            "success": True,
            "message": "Medição aprovada, Contas a Pagar gerado e conta corrente sincronizada.",
            "measurement": approved_measurement,
            "financial_entry": financial_entry,
            "risk_status": enriched["risk_status"],
            "risk_description": enriched["risk_description"],
            "tax_breakdown": {
                "measured_gross_value": float(withholdings["measured_value"]),
                "technical_retention_amount": float(withholdings["technical_retention_amount"]),
                "inss_retention_amount": float(withholdings["inss_retention_amount"]),
                "iss_retention_amount": float(withholdings["iss_retention_amount"]),
                "total_deductions": float(withholdings["technical_retention_amount"] + withholdings["tax_withholding_amount"]),
                "net_payable": float(withholdings["net_payable_amount"]),
            },
        }
