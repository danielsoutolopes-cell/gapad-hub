from datetime import datetime
from decimal import Decimal
import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
import httpx
from app.core.config import settings
from app.core.deps import get_current_tenant_and_token
from app.schemas.quote import QuoteConvertResponse, QuoteCreate, QuoteResponse, QuoteStatus, QuoteUpdate
from app.services.bdi_calculator import calculate_quote_financials

logger = logging.getLogger("gadap.quotes")

router = APIRouter()


def _get_supabase_headers(token: str) -> Dict[str, str]:
    return {
        "apikey": settings.SUPABASE_ANON_KEY or "",
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


async def _generate_quote_code(client: httpx.AsyncClient, supabase_base_url: str, token: str, tenant_id: UUID) -> str:
    """
    Gera automaticamente o próximo código sequencial de orçamento para o ano corrente.
    Ex: ORC-2026-001
    """
    current_year = datetime.now().year
    prefix = f"ORC-{current_year}-"

    resp = await client.get(
        f"{supabase_base_url}/rest/v1/quotes",
        headers=_get_supabase_headers(token),
        params={
            "tenant_id": f"eq.{tenant_id}",
            "code": f"like.{prefix}*",
            "order": "code.desc",
            "limit": "1",
            "select": "code",
        },
    )
    if resp.is_success and resp.json():
        last_code = resp.json()[0].get("code", "")
        try:
            seq_part = last_code.split("-")[-1]
            next_seq = int(seq_part) + 1
            return f"{prefix}{next_seq:03d}"
        except Exception:
            pass
    return f"{prefix}001"


@router.get("", response_model=List[QuoteResponse], include_in_schema=False)
@router.get(
    "/",
    response_model=List[QuoteResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar orçamentos do tenant autenticado",
    description="Retorna a lista de orçamentos e propostas comerciais filtrados pelo tenant_id do usuário autenticado.",
)
async def list_quotes(
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
    search: Optional[str] = Query(None, description="Filtro por título ou código do orçamento"),
    status_filter: Optional[QuoteStatus] = Query(None, alias="status", description="Filtrar por status"),
    client_id: Optional[UUID] = Query(None, description="Filtrar por cliente tomador"),
    limit: int = Query(50, ge=1, le=200, description="Limite de registros retornados"),
    offset: int = Query(0, ge=0, description="Offset de paginação"),
) -> List[QuoteResponse]:
    tenant_id, token = auth_data
    supabase_base_url = settings.SUPABASE_URL.rstrip("/")

    params: Dict[str, str] = {
        "tenant_id": f"eq.{tenant_id}",
        "order": "created_at.desc",
        "limit": str(limit),
        "offset": str(offset),
        "select": "*,client:clients(id,name,document)",
    }

    if status_filter:
        params["status"] = f"eq.{status_filter.value}"

    if client_id:
        params["client_id"] = f"eq.{client_id}"

    if search:
        params["or"] = f"(title.ilike.*{search}*,code.ilike.*{search}*)"

    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            response = await client.get(
                f"{supabase_base_url}/rest/v1/quotes",
                headers=_get_supabase_headers(token),
                params=params,
            )
            response.raise_for_status()
            data = response.json()
            return [QuoteResponse.model_validate(q) for q in data]

        except httpx.HTTPStatusError as exc:
            logger.error("Erro ao listar orçamentos: %s", exc.response.text)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Falha de consulta de orçamentos no banco: {exc.response.text}",
            ) from exc


@router.post("", response_model=QuoteResponse, include_in_schema=False)
@router.post(
    "/",
    response_model=QuoteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar novo orçamento com cálculo analítico de BDI",
    description=(
        "Executa o motor de BDI oficial do GADAP Hub: BDI = [((1 + AC + S + R + G)*(1 + DF)*(1 + L))/(1 - I)] - 1. "
        "Aplica o multiplicador de BDI em cada item de produto/serviço, calcula custos e preços com "
        "arredondamento bancário (Round Half-to-Even) e grava o orçamento e suas linhas de composição."
    ),
)
async def create_quote(
    payload: QuoteCreate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> QuoteResponse:
    tenant_id, token = auth_data
    supabase_base_url = settings.SUPABASE_URL.rstrip("/")

    async with httpx.AsyncClient(timeout=25.0) as client:
        # 1. Validação do Cliente no mesmo Tenant
        client_check = await client.get(
            f"{supabase_base_url}/rest/v1/clients",
            headers=_get_supabase_headers(token),
            params={
                "id": f"eq.{payload.client_id}",
                "tenant_id": f"eq.{tenant_id}",
                "select": "id,name,document",
            },
        )
        client_check.raise_for_status()
        client_data = client_check.json()
        if not client_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cliente {payload.client_id} não encontrado ou não pertence a esta empresa.",
            )

        # 2. Geração do Código se não fornecido
        quote_code = payload.code
        if not quote_code:
            quote_code = await _generate_quote_code(client, supabase_base_url, token, tenant_id)

        # 3. Execução do Motor de Precificação (BDI ou MARKUP)
        raw_items = [item.model_dump() for item in payload.items]
        try:
            financials = calculate_quote_financials(
                ac_rate=payload.ac_rate,
                s_rate=payload.s_rate,
                r_rate=payload.r_rate,
                g_rate=payload.g_rate,
                df_rate=payload.df_rate,
                l_rate=payload.l_rate,
                i_rate=payload.i_rate,
                discount_amount=payload.discount_amount,
                items=raw_items,
                calculation_type=payload.calculation_type,
                markup_percentage=payload.markup_percentage,
            )
        except ValueError as err:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Erro de parametrização de precificação: {str(err)}",
            ) from err

        # 4. Gravação do Cabeçalho do Orçamento (quotes)
        quote_insert_payload = {
            "tenant_id": str(tenant_id),
            "client_id": str(payload.client_id),
            "project_id": str(payload.project_id) if payload.project_id else None,
            "code": quote_code,
            "title": payload.title,
            "description": payload.description,
            "status": QuoteStatus.DRAFT.value,
            "calculation_type": financials["calculation_type"],
            "markup_percentage": financials["markup_percentage"],
            "ac_rate": float(payload.ac_rate),
            "s_rate": float(payload.s_rate),
            "r_rate": float(payload.r_rate),
            "g_rate": float(payload.g_rate),
            "df_rate": float(payload.df_rate),
            "l_rate": float(payload.l_rate),
            "i_rate": float(payload.i_rate),
            "bdi_multiplier": financials["bdi_multiplier"],
            "total_cost": financials["total_cost"],
            "total_products_cost": financials["total_products_cost"],
            "total_services_cost": financials["total_services_cost"],
            "bdi_amount": financials["bdi_amount"],
            "discount_amount": financials["discount_amount"],
            "grand_total": financials["grand_total"],
            "valid_until": payload.valid_until.isoformat() if payload.valid_until else None,
            "notes": payload.notes,
        }

        quote_resp = await client.post(
            f"{supabase_base_url}/rest/v1/quotes",
            headers=_get_supabase_headers(token),
            json=quote_insert_payload,
        )
        if not quote_resp.is_success:
            logger.error("Falha ao gravar orçamento: %s", quote_resp.text)
            raise HTTPException(
                status_code=quote_resp.status_code,
                detail=f"Erro ao criar orçamento: {quote_resp.text}",
            )
        created_quote = quote_resp.json()[0]
        quote_id = created_quote["id"]

        # 5. Gravação dos Itens Calculados (quote_items)
        items_to_insert = []
        for calc_item in financials["items"]:
            items_to_insert.append({
                "tenant_id": str(tenant_id),
                "quote_id": quote_id,
                "item_type": calc_item["item_type"],
                "product_id": str(calc_item["product_id"]) if calc_item.get("product_id") else None,
                "service_id": str(calc_item["service_id"]) if calc_item.get("service_id") else None,
                "description": calc_item["description"],
                "unit_of_measure": calc_item["unit_of_measure"],
                "quantity": calc_item["quantity"],
                "unit_cost": calc_item["unit_cost"],
                "bdi_rate": calc_item["bdi_rate"],
                "unit_price": calc_item["unit_price"],
                "total_cost": calc_item["total_cost"],
                "total_price": calc_item["total_price"],
            })

        items_resp = await client.post(
            f"{supabase_base_url}/rest/v1/quote_items",
            headers=_get_supabase_headers(token),
            json=items_to_insert,
        )
        if not items_resp.is_success:
            logger.error("Falha ao gravar itens do orçamento: %s", items_resp.text)
            # Reverte o cabeçalho se os itens falharem
            await client.delete(
                f"{supabase_base_url}/rest/v1/quotes",
                headers=_get_supabase_headers(token),
                params={"id": f"eq.{quote_id}", "tenant_id": f"eq.{tenant_id}"},
            )
            raise HTTPException(
                status_code=items_resp.status_code,
                detail=f"Erro ao gravar itens do orçamento: {items_resp.text}",
            )
        created_items = items_resp.json()

        created_quote["items"] = created_items
        created_quote["client"] = client_data[0]
        return QuoteResponse.model_validate(created_quote)


@router.get(
    "/{quote_id}",
    response_model=QuoteResponse,
    status_code=status.HTTP_200_OK,
    summary="Obter orçamento com itens e composição analítica",
)
async def get_quote(
    quote_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> QuoteResponse:
    tenant_id, token = auth_data
    supabase_base_url = settings.SUPABASE_URL.rstrip("/")

    async with httpx.AsyncClient(timeout=20.0) as client:
        # Busca cabeçalho
        resp = await client.get(
            f"{supabase_base_url}/rest/v1/quotes",
            headers=_get_supabase_headers(token),
            params={
                "id": f"eq.{quote_id}",
                "tenant_id": f"eq.{tenant_id}",
                "select": "*,client:clients(id,name,document)",
            },
        )
        resp.raise_for_status()
        quote_list = resp.json()
        if not quote_list:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Orçamento não encontrado ou não pertence a esta empresa.",
            )
        quote = quote_list[0]

        # Busca itens
        items_resp = await client.get(
            f"{supabase_base_url}/rest/v1/quote_items",
            headers=_get_supabase_headers(token),
            params={
                "quote_id": f"eq.{quote_id}",
                "tenant_id": f"eq.{tenant_id}",
                "order": "created_at.asc",
            },
        )
        items_resp.raise_for_status()
        quote["items"] = items_resp.json()

        return QuoteResponse.model_validate(quote)


@router.put(
    "/{quote_id}",
    response_model=QuoteResponse,
    status_code=status.HTTP_200_OK,
    summary="Atualizar status ou dados cadastrais do orçamento",
)
async def update_quote(
    quote_id: UUID,
    payload: QuoteUpdate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> QuoteResponse:
    tenant_id, token = auth_data
    supabase_base_url = settings.SUPABASE_URL.rstrip("/")

    update_dict = payload.model_dump(exclude_unset=True)
    if not update_dict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum campo fornecido para atualização.",
        )

    if "discount_amount" in update_dict and update_dict["discount_amount"] is not None:
        update_dict["discount_amount"] = float(update_dict["discount_amount"])
    if "valid_until" in update_dict and update_dict["valid_until"] is not None:
        update_dict["valid_until"] = update_dict["valid_until"].isoformat()

    update_dict.pop("tenant_id", None)
    update_dict.pop("id", None)

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.patch(
            f"{supabase_base_url}/rest/v1/quotes",
            headers=_get_supabase_headers(token),
            params={"id": f"eq.{quote_id}", "tenant_id": f"eq.{tenant_id}"},
            json=update_dict,
        )
        resp.raise_for_status()
        updated_records = resp.json()
        if not updated_records:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Orçamento não encontrado para atualização.",
            )

        # Retorna com itens recarregados
        items_resp = await client.get(
            f"{supabase_base_url}/rest/v1/quote_items",
            headers=_get_supabase_headers(token),
            params={"quote_id": f"eq.{quote_id}", "tenant_id": f"eq.{tenant_id}"},
        )
        record = updated_records[0]
        record["items"] = items_resp.json() if items_resp.is_success else []
        return QuoteResponse.model_validate(record)


@router.delete(
    "/{quote_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir orçamento e seus itens",
)
async def delete_quote(
    quote_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> None:
    tenant_id, token = auth_data
    supabase_base_url = settings.SUPABASE_URL.rstrip("/")

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.delete(
            f"{supabase_base_url}/rest/v1/quotes",
            headers=_get_supabase_headers(token),
            params={"id": f"eq.{quote_id}", "tenant_id": f"eq.{tenant_id}"},
        )
        resp.raise_for_status()
        return None


@router.post(
    "/{quote_id}/convert-to-project",
    response_model=QuoteConvertResponse,
    status_code=status.HTTP_200_OK,
    summary="Aprovar orçamento e converter automaticamente em Obra (Projects) com Cronograma Físico-Financeiro",
    description=(
        "Trava o orçamento mudando o status para 'approved'/'converted', "
        "cria a Obra na tabela projects espelhando o valor contratual e cliente, "
        "e estrutura o cronograma físico-financeiro espelhado nos itens de composição."
    ),
)
async def convert_quote_to_project(
    quote_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> QuoteConvertResponse:
    tenant_id, token = auth_data
    supabase_base_url = settings.SUPABASE_URL.rstrip("/")

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Carrega o orçamento com itens e cliente
        quote_resp = await client.get(
            f"{supabase_base_url}/rest/v1/quotes",
            headers=_get_supabase_headers(token),
            params={
                "id": f"eq.{quote_id}",
                "tenant_id": f"eq.{tenant_id}",
                "select": "*,client:clients(id,name,document,address_street,address_number,address_city,address_state,address_zip_code)",
            },
        )
        quote_resp.raise_for_status()
        quotes = quote_resp.json()
        if not quotes:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Orçamento {quote_id} não encontrado ou não pertence a este tenant.",
            )
        quote_data = quotes[0]

        # 2. Carrega os itens do orçamento
        items_resp = await client.get(
            f"{supabase_base_url}/rest/v1/quote_items",
            headers=_get_supabase_headers(token),
            params={
                "quote_id": f"eq.{quote_id}",
                "tenant_id": f"eq.{tenant_id}",
                "order": "created_at.asc",
            },
        )
        items_resp.raise_for_status()
        quote_items = items_resp.json()
        quote_data["items"] = quote_items

        # 3. Gera código e dados da Obra a partir do orçamento
        client_info = quote_data.get("client") or {}
        project_code = f"OBR-{quote_data.get('code', 'ORC')}"
        project_name = f"Obra: {quote_data.get('title')}"
        contract_value = float(quote_data.get("grand_total") or 0.0)

        # 4. Cria a Obra em public.projects
        project_payload = {
            "tenant_id": str(tenant_id),
            "client_id": str(quote_data["client_id"]),
            "code": project_code,
            "name": project_name,
            "description": quote_data.get("description") or f"Obra originada do Orçamento {quote_data.get('code')}",
            "contract_value": contract_value,
            "technical_retention_perc": 5.0,
            "status": "planejamento",
            "address_street": client_info.get("address_street"),
            "address_number": client_info.get("address_number"),
            "address_city": client_info.get("address_city") or "São Paulo",
            "address_state": client_info.get("address_state") or "SP",
            "address_zip_code": client_info.get("address_zip_code"),
            "start_date": datetime.now().strftime("%Y-%m-%d"),
            "end_date_planned": (datetime.now().date().replace(year=datetime.now().year + 1)).strftime("%Y-%m-%d"),
        }

        proj_resp = await client.post(
            f"{supabase_base_url}/rest/v1/projects",
            headers=_get_supabase_headers(token),
            json=project_payload,
        )
        if not proj_resp.is_success:
            logger.error("Falha ao criar Obra a partir do orçamento: %s", proj_resp.text)
            raise HTTPException(
                status_code=proj_resp.status_code,
                detail=f"Erro ao criar Obra no banco de dados: {proj_resp.text}",
            )
        created_project = proj_resp.json()[0]
        project_id = created_project["id"]

        # 5. Atualiza o Orçamento para travado ('approved') e vincula project_id
        update_quote_payload = {
            "status": QuoteStatus.APPROVED.value,
            "project_id": str(project_id),
        }
        patch_quote_resp = await client.patch(
            f"{supabase_base_url}/rest/v1/quotes",
            headers=_get_supabase_headers(token),
            params={"id": f"eq.{quote_id}", "tenant_id": f"eq.{tenant_id}"},
            json=update_quote_payload,
        )
        patch_quote_resp.raise_for_status()
        quote_data["status"] = QuoteStatus.APPROVED.value
        quote_data["project_id"] = str(project_id)

        # 6. Estrutura o Cronograma Físico-Financeiro espelhado nos itens aprovados
        cronograma = []
        accumulated_pct = 0.0
        total_items_val = sum(float(it.get("total_price") or 0.0) for it in quote_items)
        if total_items_val == 0.0:
            total_items_val = contract_value or 1.0

        for idx, item in enumerate(quote_items, start=1):
            item_price = float(item.get("total_price") or 0.0)
            weight_pct = round((item_price / total_items_val) * 100.0, 2)
            accumulated_pct = round(accumulated_pct + weight_pct, 2)
            cronograma.append({
                "etapa_sequencial": idx,
                "item_id": item.get("id"),
                "tipo": item.get("item_type"),
                "descricao": item.get("description"),
                "unidade": item.get("unit_of_measure"),
                "quantidade": float(item.get("quantity") or 0.0),
                "valor_total": item_price,
                "peso_percentual": weight_pct,
                "peso_acumulado": min(accumulated_pct, 100.0),
                "status": "planejado",
            })

        return QuoteConvertResponse(
            message=f"Orçamento {quote_data.get('code')} travado e convertido com sucesso na Obra {project_code}.",
            quote=QuoteResponse.model_validate(quote_data),
            project=created_project,
            cronograma=cronograma,
        )
