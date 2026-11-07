"""
=============================================================================
GADAP Hub - Endpoints da Central Financeira Consolidada (Módulo Financeiro)
Arquivo: api/app/api/v1/endpoints/finance.py
=============================================================================
"""

import logging
from datetime import date, datetime
from decimal import Decimal
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
from app.schemas.subcontract import (
    ParseExtrasRequest,
    ParseExtrasResponse,
    ParsedExtraItem,
    SubcontractPaymentPayload,
    SubcontractPaymentResponse,
    SuspectDuplicateItem,
)
from app.services.subcontract_extras_llm_service import SubcontractExtrasLLMService
import difflib
import re

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


def _calculate_similarity(text1: str, text2: str) -> float:
    """
    Calcula índice de similaridade entre duas descrições de serviços extras.
    Normaliza caracteres alfanuméricos e compara por SequenceMatcher e overlap de tokens.
    """
    t1 = re.sub(r"[^\w\s]", "", text1.lower()).strip()
    t2 = re.sub(r"[^\w\s]", "", text2.lower()).strip()
    if not t1 or not t2:
        return 0.0

    # Similaridade direta de sequência
    seq_ratio = difflib.SequenceMatcher(None, t1, t2).ratio()

    # Similaridade de palavras-chave (token overlap)
    words1 = set(t1.split())
    words2 = set(t2.split())
    intersection = words1.intersection(words2)
    union = words1.union(words2)
    jaccard = len(intersection) / len(union) if union else 0.0

    # Ponderação híbrida
    return round(max(seq_ratio, jaccard, (seq_ratio * 0.6 + jaccard * 0.4)), 4)


@router.post(
    "/payables/subcontracts/pay",
    response_model=SubcontractPaymentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Liquidara/Pagar Subcontratados com Segregação de Verbas e Motor Anti-Duplicidade",
    description="Permite o pagamento segregado (Principal, Extra Contratado e Extras de Campo) com detecção prévia de duplicidade pelo algoritmo 'Gato Escaldado'.",
)
async def pay_subcontract_with_segregation(
    payload: SubcontractPaymentPayload,
    authorization: Optional[str] = Header(None),
    x_tenant_id: Optional[str] = Header(None),
):
    tenant_id, headers = await _resolve_tenant_and_headers(authorization, x_tenant_id)
    base_url = settings.get_supabase_url().rstrip("/")

    total_amount = (
        payload.principal_amount
        + payload.contracted_extra_amount
        + sum(extra.amount for extra in payload.field_extras)
    )

    if total_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O valor total a pagar deve ser superior a zero.",
        )

    # 1. Motor Anti-Fraude "Gato Escaldado": Verifica histórico de extras para este subcontrato
    suspects: List[SuspectDuplicateItem] = []
    warning_duplicate_risk = False

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Busca extras já existentes para este subcontrato
        history_url = f"{base_url}/rest/v1/subcontract_extras?tenant_id=eq.{tenant_id}&subcontract_id=eq.{payload.subcontract_id}&select=*"
        try:
            hist_resp = await client.get(history_url, headers=headers)
            historical_extras = hist_resp.json() if hist_resp.status_code == 200 else []
        except Exception as exc:
            logger.warning("Falha ao consultar histórico de extras no Supabase: %s", exc)
            historical_extras = []

        # Se há novos extras de campo no payload, compara com os anteriores
        for field_extra in payload.field_extras:
            for hist in historical_extras:
                hist_desc = hist.get("description", "")
                score = _calculate_similarity(field_extra.description, hist_desc)
                # Limiar de alerta: score >= 0.55 ou substrings relevantes
                if score >= 0.55 or (len(field_extra.description) > 4 and field_extra.description.lower() in hist_desc.lower()) or (len(hist_desc) > 4 and hist_desc.lower() in field_extra.description.lower()):
                    warning_duplicate_risk = True
                    suspects.append(
                        SuspectDuplicateItem(
                            id=hist.get("id"),
                            description=hist_desc,
                            amount=Decimal(str(hist.get("amount", "0.00"))),
                            created_at=str(hist.get("created_at", "")),
                            similarity_score=float(score),
                            notes=f"Alerta: similar à solicitação atual '{field_extra.description}'",
                        )
                    )

        # 2. Criar Transações em `subcontract_transactions` com a segregação de verbas
        transactions_created = []

        # (a) Pagamento Principal
        if payload.principal_amount > 0:
            tx_principal = {
                "tenant_id": str(tenant_id),
                "subcontract_id": str(payload.subcontract_id),
                "type": "PAYMENT",
                "payment_category": "PRINCIPAL",
                "amount": float(payload.principal_amount),
                "date": payload.payment_date.isoformat() if payload.payment_date else date.today().isoformat(),
                "observation": f"Pagamento Contrato Principal: {payload.observation or ''}".strip(),
            }
            tx_resp = await client.post(
                f"{base_url}/rest/v1/subcontract_transactions",
                headers={**headers, "Prefer": "return=representation"},
                json=tx_principal,
            )
            if tx_resp.status_code in (200, 201):
                transactions_created.extend(tx_resp.json())

        # (b) Pagamento Aditivo Contratado
        if payload.contracted_extra_amount > 0:
            tx_contracted = {
                "tenant_id": str(tenant_id),
                "subcontract_id": str(payload.subcontract_id),
                "type": "PAYMENT",
                "payment_category": "CONTRACTED_EXTRA",
                "amount": float(payload.contracted_extra_amount),
                "date": payload.payment_date.isoformat() if payload.payment_date else date.today().isoformat(),
                "observation": f"Pagamento Aditivo Contratado: {payload.observation or ''}".strip(),
            }
            tx_resp = await client.post(
                f"{base_url}/rest/v1/subcontract_transactions",
                headers={**headers, "Prefer": "return=representation"},
                json=tx_contracted,
            )
            if tx_resp.status_code in (200, 201):
                transactions_created.extend(tx_resp.json())

        # (c) Extras de Campo (Field Extras)
        extras_recorded = []
        for extra in payload.field_extras:
            tx_extra = {
                "tenant_id": str(tenant_id),
                "subcontract_id": str(payload.subcontract_id),
                "type": "PAYMENT",
                "payment_category": "FIELD_EXTRA",
                "amount": float(extra.amount),
                "date": payload.payment_date.isoformat() if payload.payment_date else date.today().isoformat(),
                "observation": f"Serviço Extra de Campo: {extra.description}",
            }
            tx_resp = await client.post(
                f"{base_url}/rest/v1/subcontract_transactions",
                headers={**headers, "Prefer": "return=representation"},
                json=tx_extra,
            )
            tx_id = None
            if tx_resp.status_code in (200, 201):
                created_items = tx_resp.json()
                transactions_created.extend(created_items)
                if created_items:
                    tx_id = created_items[0].get("id")

            # Grava na tabela `subcontract_extras`
            extra_record = {
                "tenant_id": str(tenant_id),
                "subcontract_id": str(payload.subcontract_id),
                "description": extra.description,
                "amount": float(extra.amount),
                "requested_by_supplier": extra.requested_by_supplier,
                "validated_by_field": extra.validated_by_field,
                "status": "APPROVED",
                "transaction_id": tx_id,
            }
            rec_resp = await client.post(
                f"{base_url}/rest/v1/subcontract_extras",
                headers={**headers, "Prefer": "return=representation"},
                json=extra_record,
            )
            if rec_resp.status_code in (200, 201):
                extras_recorded.extend(rec_resp.json())

            # 3. Atualização Contínua do Dicionário Histórico de Preços (Prompt 101)
            try:
                dict_url = f"{base_url}/rest/v1/subcontract_price_dictionary?tenant_id=eq.{tenant_id}&standardized_service_name=eq.{extra.description}&select=*"
                dict_resp = await client.get(dict_url, headers=headers)
                existing_dict = dict_resp.json() if dict_resp.status_code == 200 else []
                current_amount = float(extra.amount)

                if existing_dict:
                    item_d = existing_dict[0]
                    prev_avg = float(item_d.get("average_unit_price") or current_amount)
                    prev_highest = float(item_d.get("highest_unit_price") or current_amount)
                    prev_samples = int(item_d.get("sample_count") or 1)

                    new_samples = prev_samples + 1
                    new_avg = round(((prev_avg * prev_samples) + current_amount) / new_samples, 2)
                    new_highest = max(prev_highest, current_amount)

                    await client.patch(
                        f"{base_url}/rest/v1/subcontract_price_dictionary?id=eq.{item_d['id']}",
                        headers=headers,
                        json={
                            "average_unit_price": new_avg,
                            "highest_unit_price": new_highest,
                            "sample_count": new_samples,
                            "last_updated": datetime.utcnow().isoformat(),
                        },
                    )
                else:
                    await client.post(
                        f"{base_url}/rest/v1/subcontract_price_dictionary",
                        headers=headers,
                        json={
                            "tenant_id": str(tenant_id),
                            "standardized_service_name": extra.description,
                            "average_unit_price": current_amount,
                            "highest_unit_price": current_amount,
                            "sample_count": 1,
                        },
                    )
            except Exception as exc:
                logger.warning("Falha ao atualizar dicionário de preços para '%s': %s", extra.description, exc)

    return SubcontractPaymentResponse(
        success=True,
        subcontract_id=payload.subcontract_id,
        total_paid_now=total_amount,
        transactions_created=transactions_created,
        extras_recorded=extras_recorded,
        warning_duplicate_risk=warning_duplicate_risk,
        duplicate_suspects=suspects,
        message=(
            "Pagamento registrado com sucesso, mas atenção: foram detectadas cobranças anteriores com alta similaridade!"
            if warning_duplicate_risk
            else "Pagamento registrado com sucesso e verbas devidamente segregadas."
        ),
    )


@router.post(
    "/payables/subcontracts/parse-extras",
    response_model=ParseExtrasResponse,
    status_code=status.HTTP_200_OK,
    summary="Decodificar Texto do WhatsApp com LLM e Consultar Dicionário de Preços",
    description="Recebe texto bruto colado do WhatsApp, extrai serviços, quantidades e preços via IA e cruza com a média histórica para apoiar a negociação de custos.",
)
async def parse_subcontract_extras_with_llm(
    payload: ParseExtrasRequest,
    authorization: Optional[str] = Header(None),
    x_tenant_id: Optional[str] = Header(None),
):
    tenant_id, headers = await _resolve_tenant_and_headers(authorization, x_tenant_id)
    base_url = settings.get_supabase_url().rstrip("/")

    # 1. Parsing via LLM Service (Gemini ou Fallback Heurístico Especializado)
    llm_service = SubcontractExtrasLLMService()
    raw_extracted_items = await llm_service.parse_raw_whatsapp_text(payload.raw_text)

    # 2. Carregar Dicionário de Preços do Tenant para Cruzamento Semântico / Textual
    price_dict_items: List[Dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            dict_resp = await client.get(
                f"{base_url}/rest/v1/subcontract_price_dictionary?tenant_id=eq.{tenant_id}&select=*",
                headers=headers,
            )
            if dict_resp.status_code == 200:
                price_dict_items = dict_resp.json()
        except Exception as exc:
            logger.warning("Falha ao carregar dicionário de preços no Supabase: %s", exc)

    # 3. Cruzamento e Cálculo de Alertas de Negociação ("Chorar o Preço")
    structured_items: List[ParsedExtraItem] = []
    has_alerts = False
    total_acc = Decimal("0.00")

    for raw_it in raw_extracted_items:
        orig_text = raw_it.get("original_text") or ""
        std_service = raw_it.get("standardized_service") or raw_it.get("service") or "Serviço Extra"
        qty = float(raw_it.get("quantity", 1.0))
        if qty <= 0:
            qty = 1.0

        total_line_p = Decimal(str(raw_it.get("total_line_price") or raw_it.get("total") or 0.0))
        unit_p = Decimal(str(raw_it.get("unit_price") or 0.0))

        if total_line_p == Decimal("0.00") and unit_p > Decimal("0.00"):
            total_line_p = round(Decimal(str(qty)) * unit_p, 2)
        elif unit_p == Decimal("0.00") and total_line_p > Decimal("0.00"):
            unit_p = round(total_line_p / Decimal(str(qty)), 2)

        total_acc += total_line_p
        notes = raw_it.get("notes") or ""

        # Busca melhor match no dicionário de preços pelo standardized_service
        best_match = None
        best_similarity = 0.0

        for dict_entry in price_dict_items:
            dict_service = (
                dict_entry.get("standardized_service")
                or dict_entry.get("standardized_service_name")
                or ""
            )
            sim = _calculate_similarity(std_service, dict_service)
            # Match por substring direta ou threshold relaxado
            if (
                sim > best_similarity
                and (
                    sim >= 0.25
                    or (len(dict_service) > 3 and dict_service.lower() in std_service.lower())
                    or (len(std_service) > 3 and std_service.lower() in dict_service.lower())
                )
            ):
                best_similarity = sim
                best_match = dict_entry

        negotiation_alert = False
        hist_avg = None
        hist_high = None
        variance_perc = None

        if best_match:
            hist_avg = Decimal(
                str(
                    best_match.get("average_price")
                    or best_match.get("average_unit_price")
                    or "0.00"
                )
            )
            hist_high = Decimal(
                str(best_match.get("highest_unit_price") or hist_avg or "0.00")
            )

            # Motor de Negociação: Se (total_line_price / quantity) > average_price
            effective_unit = unit_p if unit_p > Decimal("0.00") else (total_line_p / Decimal(str(qty)))
            if effective_unit > hist_avg and hist_avg > Decimal("0.00"):
                negotiation_alert = True
                has_alerts = True
                diff = effective_unit - hist_avg
                variance_perc = round(float((diff / hist_avg) * 100), 1)

        structured_items.append(
            ParsedExtraItem(
                original_text=orig_text,
                standardized_service=std_service,
                service=std_service,
                quantity=qty,
                unit_price=unit_p,
                total_line_price=total_line_p,
                total=total_line_p,
                notes=notes,
                historical_average=hist_avg,
                highest_historical_price=hist_high,
                negotiation_alert=negotiation_alert,
                price_variance_percent=variance_perc,
            )
        )

    return ParseExtrasResponse(
        success=True,
        items=structured_items,
        total_estimated=total_acc,
        has_negotiation_alerts=has_alerts,
        message=(
            "Cobrança de WhatsApp decodificada com sucesso pela IA. Foram identificados itens com preço acima da média histórica para negociação!"
            if has_alerts
            else "Cobrança decodificada com sucesso pela IA. Valores compatíveis com as médias históricas."
        ),
    )
