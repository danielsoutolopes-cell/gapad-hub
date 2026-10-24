import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
import httpx
from app.core.config import settings
from app.core.deps import get_current_tenant_and_token
from app.schemas.service import ServiceCreate, ServiceResponse, ServiceUpdate

logger = logging.getLogger("gadap.services")

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
    response_model=List[ServiceResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar serviços do tenant autenticado",
    description="Retorna a listagem de serviços de engenharia e construção cadastrados exclusivamente para a empresa do usuário logado.",
)
async def list_services(
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
    search: Optional[str] = Query(None, description="Filtro por nome, código interno, NBS ou código LC 116"),
    lc116_code: Optional[str] = Query(None, description="Filtrar por código da Lista de Serviços LC 116/03"),
    is_active: Optional[bool] = Query(None, description="Filtrar por status ativo/inativo"),
    limit: int = Query(50, ge=1, le=200, description="Limite de registros retornados"),
    offset: int = Query(0, ge=0, description="Offset de paginação"),
) -> List[ServiceResponse]:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/services"

    params: Dict[str, str] = {
        "tenant_id": f"eq.{tenant_id}",
        "order": "created_at.desc",
        "limit": str(limit),
        "offset": str(offset),
    }

    if is_active is not None:
        params["is_active"] = f"eq.{str(is_active).lower()}"

    if lc116_code:
        params["lc116_code"] = f"eq.{lc116_code.strip()}"

    if search:
        params["or"] = f"(name.ilike.*{search}*,code.ilike.*{search}*,nbs_code.ilike.*{search}*,lc116_code.ilike.*{search}*)"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(
                supabase_url,
                headers=_get_supabase_headers(token),
                params=params,
            )
            response.raise_for_status()
            data = response.json()
            return [ServiceResponse.model_validate(item) for item in data]

        except httpx.HTTPStatusError as exc:
            logger.error("Erro ao listar serviços no Supabase: %s", exc.response.text)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Falha de consulta no banco de dados: {exc.response.text}",
            ) from exc
        except Exception as exc:
            logger.exception("Erro de rede ao consultar serviços.")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Serviço de banco indisponível: {str(exc)}",
            ) from exc


@router.post(
    "/",
    response_model=ServiceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar novo serviço de engenharia/construção",
    description="Insere um novo serviço garantindo a vinculação compulsória ao tenant_id do usuário logado e parâmetros fiscais (NBS/LC 116).",
)
async def create_service(
    payload: ServiceCreate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> ServiceResponse:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/services"

    service_dict = payload.model_dump(exclude_unset=True)
    service_dict["tenant_id"] = str(tenant_id)
    # Converte Decimals para float para serialização JSON
    if "base_cost" in service_dict:
        service_dict["base_cost"] = float(service_dict["base_cost"])
    if "default_price" in service_dict:
        service_dict["default_price"] = float(service_dict["default_price"])
    if "iss_aliquota" in service_dict:
        service_dict["iss_aliquota"] = float(service_dict["iss_aliquota"])
    if "inss_retencao_aliquota" in service_dict:
        service_dict["inss_retencao_aliquota"] = float(service_dict["inss_retencao_aliquota"])

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            # Validação de Unicidade de Código Interno (se preenchido)
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
                        detail=f"Já existe um serviço cadastrado com o código '{payload.code}' nesta empresa.",
                    )

            # Inserção
            insert_resp = await client.post(
                supabase_url,
                headers=_get_supabase_headers(token),
                json=service_dict,
            )
            insert_resp.raise_for_status()
            created_records = insert_resp.json()

            if not created_records:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="O banco de dados não retornou o registro de serviço criado.",
                )

            return ServiceResponse.model_validate(created_records[0])

        except HTTPException:
            raise
        except httpx.HTTPStatusError as exc:
            logger.error("Erro HTTP ao criar serviço: %s", exc.response.text)
            raise HTTPException(
                status_code=exc.response.status_code,
                detail=f"Erro de persistência no Supabase: {exc.response.text}",
            ) from exc
        except Exception as exc:
            logger.exception("Erro inesperado ao cadastrar serviço.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Falha interna ao processar requisição: {str(exc)}",
            ) from exc


@router.get(
    "/{service_id}",
    response_model=ServiceResponse,
    status_code=status.HTTP_200_OK,
    summary="Obter detalhes de um serviço",
)
async def get_service(
    service_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> ServiceResponse:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/services"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(
                supabase_url,
                headers=_get_supabase_headers(token),
                params={
                    "id": f"eq.{service_id}",
                    "tenant_id": f"eq.{tenant_id}",
                    "select": "*",
                },
            )
            response.raise_for_status()
            data = response.json()

            if not data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Serviço não encontrado ou não pertence a esta empresa.",
                )

            return ServiceResponse.model_validate(data[0])

        except HTTPException:
            raise
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro de consulta no banco: {exc.response.text}",
            ) from exc


@router.put(
    "/{service_id}",
    response_model=ServiceResponse,
    status_code=status.HTTP_200_OK,
    summary="Atualizar dados de um serviço",
)
async def update_service(
    service_id: UUID,
    payload: ServiceUpdate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> ServiceResponse:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/services"

    update_dict = payload.model_dump(exclude_unset=True)
    if not update_dict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum campo fornecido para atualização.",
        )

    # Converte Decimals para float
    for k in ["base_cost", "default_price", "iss_aliquota", "inss_retencao_aliquota"]:
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
                    "id": f"eq.{service_id}",
                    "tenant_id": f"eq.{tenant_id}",
                },
                json=update_dict,
            )
            response.raise_for_status()
            updated_records = response.json()

            if not updated_records:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Serviço não encontrado ou sem permissão para alteração.",
                )

            return ServiceResponse.model_validate(updated_records[0])

        except HTTPException:
            raise
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao atualizar serviço: {exc.response.text}",
            ) from exc


@router.delete(
    "/{service_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir serviço",
)
async def delete_service(
    service_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> None:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/services"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.delete(
                supabase_url,
                headers=_get_supabase_headers(token),
                params={
                    "id": f"eq.{service_id}",
                    "tenant_id": f"eq.{tenant_id}",
                },
            )
            response.raise_for_status()
            return None

        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Falha ao excluir serviço: {exc.response.text}",
            ) from exc
