import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
import httpx
from app.core.config import settings
from app.core.deps import get_current_tenant_and_token
from app.schemas.client import ClientCreate, ClientResponse, ClientUpdate

logger = logging.getLogger("gadap.clients")

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
    response_model=List[ClientResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar clientes do tenant autenticado",
    description="Retorna a listagem de clientes vinculados exclusivamente à empresa (tenant_id) do usuário autenticado.",
)
async def list_clients(
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
    search: Optional[str] = Query(None, description="Filtro por nome ou documento"),
    is_active: Optional[bool] = Query(None, description="Filtrar por clientes ativos/inativos"),
    limit: int = Query(50, ge=1, le=200, description="Limite de registros retornados"),
    offset: int = Query(0, ge=0, description="Offset de paginação"),
) -> List[ClientResponse]:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/clients"

    # Isolamento de Segurança Compulsório: tenant_id é fixado na consulta
    params: Dict[str, str] = {
        "tenant_id": f"eq.{tenant_id}",
        "order": "created_at.desc",
        "limit": str(limit),
        "offset": str(offset),
    }

    if is_active is not None:
        params["is_active"] = f"eq.{str(is_active).lower()}"

    if search:
        # Busca por nome (ilike) ou documento (eq)
        params["or"] = f"(name.ilike.*{search}*,document.ilike.*{search}*)"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(
                supabase_url,
                headers=_get_supabase_headers(token),
                params=params,
            )
            response.raise_for_status()
            data = response.json()
            return [ClientResponse.model_validate(item) for item in data]

        except httpx.HTTPStatusError as exc:
            logger.error("Erro ao listar clientes no Supabase: %s", exc.response.text)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Falha de consulta no banco de dados: {exc.response.text}",
            ) from exc
        except Exception as exc:
            logger.exception("Erro de rede/comunicação com a base de dados.")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Serviço de banco indisponível: {str(exc)}",
            ) from exc


@router.post("", include_in_schema=False)
@router.post(
    "/",
    response_model=ClientResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar novo cliente (Tomador de Obra/Serviço)",
    description="Insere um novo cliente garantindo a vinculação compulsória ao tenant_id do usuário logado.",
)
async def create_client(
    payload: ClientCreate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> ClientResponse:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/clients"

    # Injeção compulsória do tenant_id para garantir isolamento hermético
    client_dict = payload.model_dump(exclude_unset=True)
    client_dict["tenant_id"] = str(tenant_id)

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.post(
                supabase_url,
                headers=_get_supabase_headers(token),
                json=client_dict,
            )
            
            if response.status_code == 409:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Já existe um cliente cadastrado com o documento '{payload.document}' nesta empresa.",
                )

            response.raise_for_status()
            created_records = response.json()
            if not created_records:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Não foi possível criar o cliente.",
                )

            return ClientResponse.model_validate(created_records[0])

        except HTTPException:
            raise
        except httpx.HTTPStatusError as exc:
            logger.error("Erro ao inserir cliente no Supabase: %s", exc.response.text)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Erro na validação do banco de dados: {exc.response.text}",
            ) from exc


@router.get(
    "/{client_id}",
    response_model=ClientResponse,
    status_code=status.HTTP_200_OK,
    summary="Obter detalhes de um cliente específico",
    description="Retorna o registro de um cliente por ID, validando se ele pertence ao tenant do usuário autenticado.",
)
async def get_client_by_id(
    client_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> ClientResponse:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/clients"

    # Isolamento estrito: deve coincidir ID e tenant_id
    params = {
        "id": f"eq.{client_id}",
        "tenant_id": f"eq.{tenant_id}",
        "limit": "1",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(
                supabase_url,
                headers=_get_supabase_headers(token),
                params=params,
            )
            response.raise_for_status()
            records = response.json()

            if not records:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Cliente {client_id} não encontrado ou não pertence à sua empresa.",
                )

            return ClientResponse.model_validate(records[0])

        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Falha ao recuperar cliente %s: %s", client_id, str(exc))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao buscar registro: {str(exc)}",
            ) from exc


@router.put(
    "/{client_id}",
    response_model=ClientResponse,
    status_code=status.HTTP_200_OK,
    summary="Atualizar dados cadastrais do cliente",
    description="Atualiza os campos informados do cliente, assegurando que apenas o tenant proprietário possa alterar o registro.",
)
async def update_client(
    client_id: UUID,
    payload: ClientUpdate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> ClientResponse:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/clients"

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum campo fornecido para atualização.",
        )

    # Bloqueia qualquer tentativa de mutação manual do tenant_id
    update_data.pop("tenant_id", None)
    update_data.pop("id", None)

    # Parâmetros com filtro duplo de segurança
    params = {
        "id": f"eq.{client_id}",
        "tenant_id": f"eq.{tenant_id}",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.patch(
                supabase_url,
                headers=_get_supabase_headers(token),
                params=params,
                json=update_data,
            )
            response.raise_for_status()
            updated_records = response.json()

            if not updated_records:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Cliente {client_id} inexistente ou não pertence ao seu tenant.",
                )

            return ClientResponse.model_validate(updated_records[0])

        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Falha ao atualizar cliente %s: %s", client_id, str(exc))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao atualizar registro: {str(exc)}",
            ) from exc


@router.delete(
    "/{client_id}",
    status_code=status.HTTP_200_OK,
    summary="Excluir ou inativar cliente",
    description="Remove o cliente da base de dados, garantindo que o tenant autenticado seja o legítimo titular do registro.",
)
async def delete_client(
    client_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> Dict[str, Any]:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/clients"

    params = {
        "id": f"eq.{client_id}",
        "tenant_id": f"eq.{tenant_id}",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.delete(
                supabase_url,
                headers=_get_supabase_headers(token),
                params=params,
            )
            response.raise_for_status()
            deleted_records = response.json()

            if not deleted_records:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Cliente {client_id} inexistente ou não pertence à sua empresa.",
                )

            return {
                "success": True,
                "message": f"Cliente '{deleted_records[0].get('name')}' excluído com sucesso.",
                "deleted_id": str(client_id),
            }

        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Falha ao excluir cliente %s: %s", client_id, str(exc))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao excluir cliente: {str(exc)}",
            ) from exc
