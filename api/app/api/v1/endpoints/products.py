import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
import httpx
from app.core.config import settings
from app.core.deps import get_current_tenant_and_token
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate

logger = logging.getLogger("gadap.products")

router = APIRouter()


def _get_supabase_headers(token: str) -> Dict[str, str]:
    """
    Retorna os headers obrigatórios para interação com o PostgREST do Supabase.
    Passa o token JWT do usuário para ativar o Row-Level Security no PostgreSQL.
    """
    return {
        "apikey": settings.SUPABASE_ANON_KEY or "",
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


@router.get("", include_in_schema=False)
@router.get(
    "/",
    response_model=List[ProductResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar produtos/insumos do tenant autenticado",
    description="Retorna a listagem de materiais e produtos cadastrados exclusivamente para a empresa do usuário logado.",
)
async def list_products(
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
    search: Optional[str] = Query(None, description="Filtro por nome, código SKU, NCM ou código de barras"),
    category: Optional[str] = Query(None, description="Filtrar por categoria do produto"),
    is_active: Optional[bool] = Query(None, description="Filtrar por status ativo/inativo"),
    limit: int = Query(50, ge=1, le=200, description="Limite de registros retornados"),
    offset: int = Query(0, ge=0, description="Offset de paginação"),
) -> List[ProductResponse]:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/products"

    params: Dict[str, str] = {
        "tenant_id": f"eq.{tenant_id}",
        "order": "created_at.desc",
        "limit": str(limit),
        "offset": str(offset),
    }

    if is_active is not None:
        params["is_active"] = f"eq.{str(is_active).lower()}"

    if category:
        params["category"] = f"eq.{category}"

    if search:
        params["or"] = f"(name.ilike.*{search}*,code.ilike.*{search}*,ncm.ilike.*{search}*,barcode.ilike.*{search}*)"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(
                supabase_url,
                headers=_get_supabase_headers(token),
                params=params,
            )
            response.raise_for_status()
            data = response.json()
            return [ProductResponse.model_validate(item) for item in data]

        except httpx.HTTPStatusError as exc:
            logger.error("Erro ao listar produtos no Supabase: %s", exc.response.text)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Falha de consulta no banco de dados: {exc.response.text}",
            ) from exc
        except Exception as exc:
            logger.exception("Erro de rede ao consultar produtos.")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Serviço de banco indisponível: {str(exc)}",
            ) from exc


@router.post("", include_in_schema=False)
@router.post(
    "/",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar novo produto/insumo de obra",
    description="Insere um novo material/produto garantindo a vinculação compulsória ao tenant_id do usuário logado.",
)
async def create_product(
    payload: ProductCreate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> ProductResponse:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/products"

    product_dict = payload.model_dump(exclude_unset=True)
    product_dict["tenant_id"] = str(tenant_id)
    # Converte Decimals para float/string para serialização correta
    if "base_cost" in product_dict:
        product_dict["base_cost"] = float(product_dict["base_cost"])
    if "sale_price" in product_dict:
        product_dict["sale_price"] = float(product_dict["sale_price"])
    if "min_stock" in product_dict:
        product_dict["min_stock"] = float(product_dict["min_stock"])
    if "current_stock" in product_dict:
        product_dict["current_stock"] = float(product_dict["current_stock"])

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            # Validação de Unicidade de Código SKU (se preenchido)
            if payload.code:
                check_resp = await client.get(
                    supabase_url,
                    headers=_get_supabase_headers(token),
                    params={
                        "tenant_id": f"eq.{tenant_id}",
                        "code": f"eq.{payload.code}",
                        "select": "id,name",
                    },
                )
                check_resp.raise_for_status()
                if check_resp.json():
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Já existe um produto com o código '{payload.code}' nesta empresa.",
                    )

            # Inserção
            insert_resp = await client.post(
                supabase_url,
                headers=_get_supabase_headers(token),
                json=product_dict,
            )
            insert_resp.raise_for_status()
            created_records = insert_resp.json()

            if not created_records:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="O banco de dados não retornou o registro de produto criado.",
                )

            return ProductResponse.model_validate(created_records[0])

        except HTTPException:
            raise
        except httpx.HTTPStatusError as exc:
            logger.error("Erro HTTP ao criar produto: %s", exc.response.text)
            raise HTTPException(
                status_code=exc.response.status_code,
                detail=f"Erro de persistência no Supabase: {exc.response.text}",
            ) from exc
        except Exception as exc:
            logger.exception("Erro inesperado ao cadastrar produto.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Falha interna ao processar requisição: {str(exc)}",
            ) from exc


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    status_code=status.HTTP_200_OK,
    summary="Obter detalhes de um produto/insumo",
)
async def get_product(
    product_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> ProductResponse:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/products"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(
                supabase_url,
                headers=_get_supabase_headers(token),
                params={
                    "id": f"eq.{product_id}",
                    "tenant_id": f"eq.{tenant_id}",
                    "select": "*",
                },
            )
            response.raise_for_status()
            data = response.json()

            if not data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Produto não encontrado ou não pertence a esta empresa.",
                )

            return ProductResponse.model_validate(data[0])

        except HTTPException:
            raise
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro de consulta no banco: {exc.response.text}",
            ) from exc


@router.put(
    "/{product_id}",
    response_model=ProductResponse,
    status_code=status.HTTP_200_OK,
    summary="Atualizar produto/insumo",
)
async def update_product(
    product_id: UUID,
    payload: ProductUpdate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> ProductResponse:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/products"

    update_dict = payload.model_dump(exclude_unset=True)
    if not update_dict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum campo fornecido para atualização.",
        )

    # Converte Decimals para float
    for k in ["base_cost", "sale_price", "min_stock", "current_stock"]:
        if k in update_dict and update_dict[k] is not None:
            update_dict[k] = float(update_dict[k])

    update_dict.pop("tenant_id", None)
    update_dict.pop("id", None)

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.patch(
                supabase_url,
                headers=_get_supabase_headers(token),
                params={
                    "id": f"eq.{product_id}",
                    "tenant_id": f"eq.{tenant_id}",
                },
                json=update_dict,
            )
            response.raise_for_status()
            updated_records = response.json()

            if not updated_records:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Produto não encontrado ou sem permissão para alteração.",
                )

            return ProductResponse.model_validate(updated_records[0])

        except HTTPException:
            raise
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao atualizar produto: {exc.response.text}",
            ) from exc


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir produto/insumo",
)
async def delete_product(
    product_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> None:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/products"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.delete(
                supabase_url,
                headers=_get_supabase_headers(token),
                params={
                    "id": f"eq.{product_id}",
                    "tenant_id": f"eq.{tenant_id}",
                },
            )
            response.raise_for_status()
            return None

        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Falha ao excluir produto: {exc.response.text}",
            ) from exc
