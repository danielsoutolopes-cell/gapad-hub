"""
=============================================================================
GADAP Hub - Endpoints da Central Financeira Consolidada (Módulo Financeiro)
Arquivo: api/app/api/v1/endpoints/finance.py
=============================================================================
"""

import logging
from datetime import date, datetime
from typing import Any, Dict, List, Optional
import httpx
from fastapi import APIRouter, Header, HTTPException, Query, status

from app.core.config import settings
from app.schemas.finance import (
    FinancialEntryItem,
    FinancialEntriesTotals,
    FinancialListResponse,
    FinancialPartySummary,
    FinancialProjectGroup,
    FinancialProjectSummary,
    FinancialStatusUpdateRequest,
)

logger = logging.getLogger("gadap.finance")

router = APIRouter()


async def _resolve_tenant_and_headers(
    auth_header: Optional[str] = None,
    x_tenant_id: Optional[str] = None,
):
    service_key = settings.get_service_role_key()
    anon_key = settings.get_anon_key()
    default_tenant = "7ffdf475-b337-4282-ae1f-3f8056394334"

    token = None
    tenant_id = x_tenant_id

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        try:
            import jwt

            payload = jwt.decode(token, options={"verify_signature": False})
            extracted_tenant = (
                payload.get("app_metadata", {}).get("tenant_id")
                or payload.get("user_metadata", {}).get("tenant_id")
                or payload.get("tenant_id")
            )
            if extracted_tenant:
                tenant_id = str(extracted_tenant)
        except Exception:
            pass

    if not tenant_id:
        tenant_id = default_tenant

    use_key = service_key or anon_key
    # Se o token não for um JWT válido de 3 partes, utiliza use_key no header do PostgREST
    valid_jwt = token if (token and token.count(".") == 2) else use_key
    headers = {
        "apikey": use_key,
        "Authorization": f"Bearer {valid_jwt}",
        "Content-Type": "application/json",
    }
    return str(tenant_id), headers


async def _fetch_dataset(
    table: str,
    tenant_id: str,
    select: str,
    headers: Dict[str, str],
    extra_filter: str = "",
) -> List[Dict[str, Any]]:
    base_url = settings.get_supabase_url().rstrip("/")
    url = f"{base_url}/rest/v1/{table}?tenant_id=eq.{tenant_id}&select={select}{extra_filter}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                return resp.json()
            logger.warning(
                "Falha ao consultar tabela %s para tenant %s: HTTP %s - %s",
                table,
                tenant_id,
                resp.status_code,
                resp.text,
            )
            return []
    except Exception as exc:
        logger.error("Erro de conexão ao buscar %s: %s", table, exc)
        return []


def _compute_effective_status(entry_status: str, due_date_str: str, today: date) -> str:
    status_lower = (entry_status or "").lower()
    if status_lower in ("pago", "paid"):
        return "pago"
    if status_lower in ("cancelado", "cancelled"):
        return "cancelado"

    try:
        due = datetime.strptime(due_date_str[:10], "%Y-%m-%d").date()
        if due < today:
            return "atrasado"
        elif due == today:
            return "vence_hoje"
        else:
            return "a_vencer"
    except Exception:
        return "a_vencer"


async def _build_financial_list(
    entry_type: str,
    tenant_id: str,
    headers: Dict[str, str],
    status_filter: Optional[str] = None,
    due_date_start: Optional[str] = None,
    due_date_end: Optional[str] = None,
    project_id_filter: Optional[str] = None,
) -> FinancialListResponse:
    today = date.today()
    today_str = today.isoformat()

    # Query financeira
    query_types = (
        "('receivable','RECEIVABLE','a_receber')"
        if entry_type == "receivable"
        else "('payable','PAYABLE','a_pagar')"
    )
    extra_filter = f"&entry_type=in.{query_types}&order=due_date.asc"

    if due_date_start:
        extra_filter += f"&due_date=gte.{due_date_start}"
    if due_date_end:
        extra_filter += f"&due_date=lte.{due_date_end}"
    if project_id_filter:
        extra_filter += f"&project_id=eq.{project_id_filter}"

    select_fields = (
        "id,tenant_id,entry_type,description,category,nominal_amount,"
        "technical_retention_amount,discount_amount,interest_penalty_amount,"
        "net_amount,status,due_date,payment_date,document_number,document_type,"
        "pix_code,notes,created_at,updated_at,project_id,client_id,supplier_id"
    )

    raw_entries = await _fetch_dataset(
        "financial_entries",
        tenant_id,
        select_fields,
        headers,
        extra_filter,
    )

    # Coleta de projetos, clientes e fornecedores relacionados
    projects_list = await _fetch_dataset(
        "projects",
        tenant_id,
        "id,name,code",
        headers,
    )
    projects_map = {p["id"]: p for p in projects_list}

    clients_map = {}
    suppliers_map = {}

    if entry_type == "receivable":
        clients_list = await _fetch_dataset(
            "clients",
            tenant_id,
            "id,name,document",
            headers,
        )
        clients_map = {c["id"]: c for c in clients_list}
    else:
        suppliers_list = await _fetch_dataset(
            "suppliers",
            tenant_id,
            "id,trade_name,corporate_name,document",
            headers,
        )
        suppliers_map = {s["id"]: s for s in suppliers_list}

    # Processamento e cálculo de status efetivo
    items: List[FinancialEntryItem] = []
    
    # Totais gerais (antes do filtro específico de status para alimentar os cards)
    tot_geral = 0.0
    tot_em_aberto = 0.0
    tot_atrasado = 0.0
    tot_vence_hoje = 0.0
    tot_a_vencer = 0.0
    tot_pago = 0.0
    cnt_total = 0
    cnt_em_aberto = 0
    cnt_atrasado = 0
    cnt_vence_hoje = 0
    cnt_pago = 0

    for row in raw_entries:
        net = float(row.get("net_amount") or 0.0)
        due_str = str(row.get("due_date") or today_str)
        raw_st = str(row.get("status") or "pendente")
        eff_status = _compute_effective_status(raw_st, due_str, today)

        # Acumula totais
        tot_geral += net
        cnt_total += 1

        if eff_status == "pago":
            tot_pago += net
            cnt_pago += 1
        elif eff_status != "cancelado":
            tot_em_aberto += net
            cnt_em_aberto += 1
            if eff_status == "atrasado":
                tot_atrasado += net
                cnt_atrasado += 1
            elif eff_status == "vence_hoje":
                tot_vence_hoje += net
                cnt_vence_hoje += 1
            elif eff_status == "a_vencer":
                tot_a_vencer += net

        # Obra
        proj_data = None
        if row.get("project_id") and row["project_id"] in projects_map:
            p = projects_map[row["project_id"]]
            proj_data = FinancialProjectSummary(
                id=p["id"],
                name=p["name"],
                code=p.get("code"),
            )

        # Favorecido / Cliente
        party_data = None
        if entry_type == "receivable" and row.get("client_id") and row["client_id"] in clients_map:
            c = clients_map[row["client_id"]]
            party_data = FinancialPartySummary(
                id=c["id"],
                name=c.get("name") or "Cliente Desconhecido",
                document=c.get("document"),
            )
        elif entry_type == "payable" and row.get("supplier_id") and row["supplier_id"] in suppliers_map:
            s = suppliers_map[row["supplier_id"]]
            party_data = FinancialPartySummary(
                id=s["id"],
                name=s.get("trade_name") or s.get("corporate_name") or "Fornecedor",
                document=s.get("document"),
            )

        item = FinancialEntryItem(
            id=row["id"],
            tenant_id=row["tenant_id"],
            entry_type=entry_type,
            description=row.get("description") or "Sem descrição",
            category=row.get("category") or "geral",
            nominal_amount=float(row.get("nominal_amount") or 0.0),
            technical_retention_amount=float(row.get("technical_retention_amount") or 0.0),
            discount_amount=float(row.get("discount_amount") or 0.0),
            interest_penalty_amount=float(row.get("interest_penalty_amount") or 0.0),
            net_amount=net,
            status=raw_st,
            effective_status=eff_status,
            due_date=due_str,
            payment_date=row.get("payment_date"),
            document_number=row.get("document_number"),
            document_type=row.get("document_type"),
            pix_code=row.get("pix_code"),
            notes=row.get("notes"),
            created_at=str(row.get("created_at") or today_str),
            updated_at=str(row.get("updated_at") or today_str),
            project=proj_data,
            party=party_data,
        )

        # Filtro de Status
        if status_filter:
            st_filter_lower = status_filter.lower()
            if st_filter_lower == "aberto":
                if eff_status in ("pago", "cancelado"):
                    continue
            elif st_filter_lower == "pago":
                if eff_status != "pago":
                    continue
            elif st_filter_lower == "atrasado":
                if eff_status != "atrasado":
                    continue
            elif st_filter_lower == "vence_hoje":
                if eff_status != "vence_hoje":
                    continue
            elif st_filter_lower == "a_vencer":
                if eff_status != "a_vencer":
                    continue

        items.append(item)

    # Agrupamento por Obra
    groups_dict: Dict[str, Dict[str, Any]] = {}
    for it in items:
        p_id = it.project.id if it.project else "__sem_obra__"
        p_name = it.project.name if it.project else "Despesas Corporativas / Sem Obra Vinculada"

        if p_id not in groups_dict:
            groups_dict[p_id] = {
                "project_id": it.project.id if it.project else None,
                "project_name": p_name,
                "total_nominal": 0.0,
                "total_liquido": 0.0,
                "total_em_aberto": 0.0,
                "total_pago": 0.0,
                "items": [],
            }

        groups_dict[p_id]["total_nominal"] += it.nominal_amount
        groups_dict[p_id]["total_liquido"] += it.net_amount
        if it.effective_status == "pago":
            groups_dict[p_id]["total_pago"] += it.net_amount
        elif it.effective_status != "cancelado":
            groups_dict[p_id]["total_em_aberto"] += it.net_amount

        groups_dict[p_id]["items"].append(it)

    grouped_by_project = [
        FinancialProjectGroup(
            project_id=g["project_id"],
            project_name=g["project_name"],
            total_nominal=round(g["total_nominal"], 2),
            total_liquido=round(g["total_liquido"], 2),
            total_em_aberto=round(g["total_em_aberto"], 2),
            total_pago=round(g["total_pago"], 2),
            items_count=len(g["items"]),
            items=g["items"],
        )
        for g in groups_dict.values()
    ]

    totals = FinancialEntriesTotals(
        total_geral=round(tot_geral, 2),
        total_em_aberto=round(tot_em_aberto, 2),
        total_atrasado=round(tot_atrasado, 2),
        total_vence_hoje=round(tot_vence_hoje, 2),
        total_a_vencer=round(tot_a_vencer, 2),
        total_pago=round(tot_pago, 2),
        count_total=cnt_total,
        count_em_aberto=cnt_em_aberto,
        count_atrasado=cnt_atrasado,
        count_vence_hoje=cnt_vence_hoje,
        count_pago=cnt_pago,
    )

    return FinancialListResponse(
        tenant_id=tenant_id,
        entry_type=entry_type,
        date_ref=today_str,
        totals=totals,
        grouped_by_project=grouped_by_project,
        items=items,
    )


# ------------------------------------------------------------------------------
# 1. GET /api/v1/finance/payables (Contas a Pagar Consolidado)
# ------------------------------------------------------------------------------
@router.get(
    "/payables",
    response_model=FinancialListResponse,
    status_code=status.HTTP_200_OK,
    summary="Listar Contas a Pagar Consolidadas de Todas as Obras",
    description="Retorna títulos de despesas e contas a pagar consolidados por obra com totalizadores executivos.",
)
async def get_financial_payables(
    status: Optional[str] = Query(None, description="Filtro de status: 'aberto', 'pago', 'atrasado', 'vence_hoje', 'a_vencer'"),
    due_date_start: Optional[str] = Query(None, description="Data de vencimento inicial (YYYY-MM-DD)"),
    due_date_end: Optional[str] = Query(None, description="Data de vencimento final (YYYY-MM-DD)"),
    project_id: Optional[str] = Query(None, description="Filtro opcional por UUID de obra"),
    authorization: Optional[str] = Header(None),
    x_tenant_id: Optional[str] = Header(None),
) -> FinancialListResponse:
    tenant_id, headers = await _resolve_tenant_and_headers(authorization, x_tenant_id)
    return await _build_financial_list(
        entry_type="payable",
        tenant_id=tenant_id,
        headers=headers,
        status_filter=status,
        due_date_start=due_date_start,
        due_date_end=due_date_end,
        project_id_filter=project_id,
    )


# ------------------------------------------------------------------------------
# 2. GET /api/v1/finance/receivables (Contas a Receber Consolidado)
# ------------------------------------------------------------------------------
@router.get(
    "/receivables",
    response_model=FinancialListResponse,
    status_code=status.HTTP_200_OK,
    summary="Listar Contas a Receber Consolidadas de Todas as Obras",
    description="Retorna medições faturadas, notas de serviço e receitas a receber consolidadas por obra.",
)
async def get_financial_receivables(
    status: Optional[str] = Query(None, description="Filtro de status: 'aberto', 'pago', 'atrasado', 'vence_hoje', 'a_vencer'"),
    due_date_start: Optional[str] = Query(None, description="Data de vencimento inicial (YYYY-MM-DD)"),
    due_date_end: Optional[str] = Query(None, description="Data de vencimento final (YYYY-MM-DD)"),
    project_id: Optional[str] = Query(None, description="Filtro opcional por UUID de obra"),
    authorization: Optional[str] = Header(None),
    x_tenant_id: Optional[str] = Header(None),
) -> FinancialListResponse:
    tenant_id, headers = await _resolve_tenant_and_headers(authorization, x_tenant_id)
    return await _build_financial_list(
        entry_type="receivable",
        tenant_id=tenant_id,
        headers=headers,
        status_filter=status,
        due_date_start=due_date_start,
        due_date_end=due_date_end,
        project_id_filter=project_id,
    )


# ------------------------------------------------------------------------------
# 3. PATCH /api/v1/finance/entries/{id}/status (Baixa Rápida & Estorno)
# ------------------------------------------------------------------------------
@router.patch(
    "/entries/{entry_id}/status",
    status_code=status.HTTP_200_OK,
    summary="Alterar Status do Título (Registrar Pagamento / Estornar)",
)
async def update_entry_status(
    entry_id: str,
    payload: FinancialStatusUpdateRequest,
    authorization: Optional[str] = Header(None),
    x_tenant_id: Optional[str] = Header(None),
):
    tenant_id, headers = await _resolve_tenant_and_headers(authorization, x_tenant_id)
    base_url = settings.get_supabase_url().rstrip("/")

    update_body: Dict[str, Any] = {
        "status": payload.status,
    }

    if payload.status == "pago":
        update_body["payment_date"] = payload.payment_date or date.today().isoformat()
    elif payload.status in ("pendente", "atrasado"):
        update_body["payment_date"] = None

    if payload.notes:
        update_body["notes"] = payload.notes

    url = f"{base_url}/rest/v1/financial_entries?id=eq.{entry_id}&tenant_id=eq.{tenant_id}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.patch(
                url,
                headers={**headers, "Prefer": "return=representation"},
                json=update_body,
            )
            if resp.status_code in (200, 204):
                data = resp.json() if resp.status_code == 200 else []
                return {
                    "success": True,
                    "message": "Status financeiro atualizado com sucesso.",
                    "entry": data[0] if data else None,
                }
            raise HTTPException(
                status_code=resp.status_code,
                detail=f"Falha ao atualizar título: {resp.text}",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Erro ao atualizar status do título %s: %s", entry_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
