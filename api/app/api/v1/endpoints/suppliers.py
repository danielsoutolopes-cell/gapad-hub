import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
import httpx
from app.core.config import settings
from app.core.deps import get_current_tenant_and_token
from app.schemas.supplier import SupplierCreate, SupplierResponse, SupplierUpdate

logger = logging.getLogger("gadap.suppliers")

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


@router.get(
    "/",
    response_model=List[SupplierResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar fornecedores do tenant autenticado",
    description="Retorna a listagem de fornecedores vinculados exclusivamente à empresa (tenant_id) do usuário autenticado.",
)
async def list_suppliers(
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
    search: Optional[str] = Query(None, description="Filtro por nome, documento ou contato"),
    category: Optional[str] = Query(None, description="Filtrar por categoria de fornecimento"),
    is_active: Optional[bool] = Query(None, description="Filtrar por status ativo/inativo"),
    limit: int = Query(50, ge=1, le=200, description="Limite de registros retornados"),
    offset: int = Query(0, ge=0, description="Offset de paginação"),
) -> List[SupplierResponse]:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/suppliers"

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
        params["or"] = f"(name.ilike.*{search}*,document.ilike.*{search}*,contact_name.ilike.*{search}*)"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(
                supabase_url,
                headers=_get_supabase_headers(token),
                params=params,
            )
            response.raise_for_status()
            data = response.json()
            return [SupplierResponse.model_validate(item) for item in data]

        except httpx.HTTPStatusError as exc:
            logger.error("Erro ao listar fornecedores no Supabase: %s", exc.response.text)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Falha de consulta no banco de dados: {exc.response.text}",
            ) from exc
        except Exception as exc:
            logger.exception("Erro de rede ao consultar fornecedores.")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Serviço de banco indisponível: {str(exc)}",
            ) from exc


@router.post(
    "/",
    response_model=SupplierResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar novo fornecedor",
    description="Insere um novo fornecedor garantindo a vinculação compulsória ao tenant_id do usuário logado.",
)
async def create_supplier(
    payload: SupplierCreate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> SupplierResponse:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/suppliers"

    supplier_dict = payload.model_dump(exclude_unset=True)
    supplier_dict["tenant_id"] = str(tenant_id)

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            # 1. Validação de Unicidade de Documento no Tenant
            check_resp = await client.get(
                supabase_url,
                headers=_get_supabase_headers(token),
                params={
                    "tenant_id": f"eq.{tenant_id}",
                    "document": f"eq.{payload.document}",
                    "select": "id,name",
                },
            )
            check_resp.raise_for_status()
            existing = check_resp.json()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Já existe um fornecedor cadastrado com o documento '{payload.document}' nesta empresa.",
                )

            # 2. Inserção
            insert_resp = await client.post(
                supabase_url,
                headers=_get_supabase_headers(token),
                json=supplier_dict,
            )
            insert_resp.raise_for_status()
            created_records = insert_resp.json()

            if not created_records:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="O banco de dados não retornou o registro de fornecedor criado.",
                )

            return SupplierResponse.model_validate(created_records[0])

        except HTTPException:
            raise
        except httpx.HTTPStatusError as exc:
            logger.error("Erro HTTP ao criar fornecedor: %s", exc.response.text)
            raise HTTPException(
                status_code=exc.response.status_code,
                detail=f"Erro de persistência no Supabase: {exc.response.text}",
            ) from exc
        except Exception as exc:
            logger.exception("Erro inesperado ao cadastrar fornecedor.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Falha interna ao processar requisição: {str(exc)}",
            ) from exc


@router.get(
    "/{supplier_id}",
    response_model=SupplierResponse,
    status_code=status.HTTP_200_OK,
    summary="Obter detalhes de um fornecedor",
)
async def get_supplier(
    supplier_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> SupplierResponse:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/suppliers"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(
                supabase_url,
                headers=_get_supabase_headers(token),
                params={
                    "id": f"eq.{supplier_id}",
                    "tenant_id": f"eq.{tenant_id}",
                    "select": "*",
                },
            )
            response.raise_for_status()
            data = response.json()

            if not data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Fornecedor não encontrado ou não pertence a esta empresa.",
                )

            return SupplierResponse.model_validate(data[0])

        except HTTPException:
            raise
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro de consulta no banco: {exc.response.text}",
            ) from exc


@router.put(
    "/{supplier_id}",
    response_model=SupplierResponse,
    status_code=status.HTTP_200_OK,
    summary="Atualizar dados de um fornecedor",
)
async def update_supplier(
    supplier_id: UUID,
    payload: SupplierUpdate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> SupplierResponse:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/suppliers"

    update_dict = payload.model_dump(exclude_unset=True)
    if not update_dict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum campo fornecido para atualização.",
        )

    # Garante que tenant_id nunca seja modificado
    update_dict.pop("tenant_id", None)
    update_dict.pop("id", None)

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.patch(
                supabase_url,
                headers=_get_supabase_headers(token),
                params={
                    "id": f"eq.{supplier_id}",
                    "tenant_id": f"eq.{tenant_id}",
                },
                json=update_dict,
            )
            response.raise_for_status()
            updated_records = response.json()

            if not updated_records:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Fornecedor não encontrado ou sem permissão para alteração.",
                )

            return SupplierResponse.model_validate(updated_records[0])

        except HTTPException:
            raise
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao atualizar fornecedor: {exc.response.text}",
            ) from exc


@router.delete(
    "/{supplier_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir ou desativar fornecedor",
)
async def delete_supplier(
    supplier_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> None:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/suppliers"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.delete(
                supabase_url,
                headers=_get_supabase_headers(token),
                params={
                    "id": f"eq.{supplier_id}",
                    "tenant_id": f"eq.{tenant_id}",
                },
            )
            response.raise_for_status()
            return None

        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Falha ao excluir fornecedor: {exc.response.text}",
            ) from exc
