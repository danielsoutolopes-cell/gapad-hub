import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
import httpx
from app.core.config import settings
from app.core.deps import get_current_tenant_and_token
from app.schemas.project import (
    ProjectCreate,
    ProjectResponse,
    ProjectStatus,
    ProjectUpdate,
)

logger = logging.getLogger("gadap.projects")

router = APIRouter()


def _get_supabase_headers(token: str) -> Dict[str, str]:
    """
    Retorna os headers autenticados para interação direta com o PostgREST do Supabase.
    Injeta o token JWT do operador para ativação transparente de RLS no PostgreSQL.
    """
    return {
        "apikey": settings.SUPABASE_ANON_KEY or "",
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


@router.get(
    "/",
    response_model=List[ProjectResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar Obras e Empreendimentos de Engenharia",
    description="Retorna as obras do tenant logado, com filtros opcionais por cliente e status de execução.",
)
async def list_projects(
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
    client_id: Optional[UUID] = Query(None, description="Filtrar obras vinculadas a um cliente específico"),
    status_filter: Optional[ProjectStatus] = Query(None, alias="status", description="Filtrar por status da obra"),
    search: Optional[str] = Query(None, description="Busca textual por nome da obra, código ou CNO"),
    limit: int = Query(50, ge=1, le=200, description="Limite de registros retornados"),
    offset: int = Query(0, ge=0, description="Offset de paginação"),
) -> List[ProjectResponse]:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/projects"

    # Isolamento Compulsório de Tenant no Nível de Aplicação
    params: Dict[str, str] = {
        "tenant_id": f"eq.{tenant_id}",
        "select": "*,clients(id,name,document)",
        "order": "created_at.desc",
        "limit": str(limit),
        "offset": str(offset),
    }

    if client_id:
        params["client_id"] = f"eq.{client_id}"

    if status_filter:
        params["status"] = f"eq.{status_filter.value}"

    if search:
        params["or"] = f"(name.ilike.*{search}*,code.ilike.*{search}*,cno.ilike.*{search}*)"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(
                supabase_url,
                headers=_get_supabase_headers(token),
                params=params,
            )
            response.raise_for_status()
            data = response.json()
            return [ProjectResponse.model_validate(item) for item in data]

        except httpx.HTTPStatusError as exc:
            logger.error("Falha ao consultar obras no Supabase: %s", exc.response.text)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro na consulta de obras: {exc.response.text}",
            ) from exc
        except Exception as exc:
            logger.exception("Erro de comunicação ao listar obras.")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Serviço de banco de dados indisponível: {str(exc)}",
            ) from exc


@router.post(
    "/",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar nova Obra (Módulo de Engenharia)",
    description="Cria uma nova obra vinculada compulsoriamente ao tenant_id do usuário logado e valida o cliente tomador.",
)
async def create_project(
    payload: ProjectCreate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> ProjectResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')

    # 1. Valida se o cliente informado existe e pertence estritamente ao mesmo tenant
    clients_url = f"{base_url}/rest/v1/clients"
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            client_check = await client.get(
                clients_url,
                headers=_get_supabase_headers(token),
                params={
                    "id": f"eq.{payload.client_id}",
                    "tenant_id": f"eq.{tenant_id}",
                    "select": "id,name,document",
                    "limit": "1",
                },
            )
            client_check.raise_for_status()
            client_records = client_check.json()
            if not client_records:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Cliente contratante {payload.client_id} não encontrado ou não pertence à sua empresa.",
                )
            client_info = client_records[0]

        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Erro ao validar cliente %s: %s", payload.client_id, str(exc))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao verificar cliente contratante: {str(exc)}",
            ) from exc

        # 2. Prepara o payload para inserção com injeção compulsória do tenant_id
        project_dict = payload.model_dump(exclude_unset=True)
        project_dict["tenant_id"] = str(tenant_id)
        project_dict["client_id"] = str(payload.client_id)
        project_dict["contract_value"] = float(payload.contract_value)
        project_dict["technical_retention_perc"] = float(payload.technical_retention_perc)
        project_dict["status"] = payload.status.value

        # Sincroniza campos de datas de término planejado/esperado
        if payload.end_date_planned:
            project_dict["end_date_planned"] = payload.end_date_planned.isoformat()
            if not project_dict.get("expected_end_date"):
                project_dict["expected_end_date"] = payload.end_date_planned.isoformat()
        elif payload.expected_end_date:
            project_dict["expected_end_date"] = payload.expected_end_date.isoformat()
            project_dict["end_date_planned"] = payload.expected_end_date.isoformat()

        if payload.start_date:
            project_dict["start_date"] = payload.start_date.isoformat()
        if payload.actual_end_date:
            project_dict["actual_end_date"] = payload.actual_end_date.isoformat()

        # Inserção na tabela projects
        projects_url = f"{base_url}/rest/v1/projects"
        try:
            response = await client.post(
                projects_url,
                headers=_get_supabase_headers(token),
                json=project_dict,
            )
            response.raise_for_status()
            created_records = response.json()

            if not created_records:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Não foi possível criar o registro da obra.",
                )

            record = created_records[0]
            record["clients"] = client_info
            return ProjectResponse.model_validate(record)

        except httpx.HTTPStatusError as exc:
            logger.error("Erro ao inserir obra no Supabase: %s", exc.response.text)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Erro na gravação da obra no banco de dados: {exc.response.text}",
            ) from exc
        except Exception as exc:
            logger.exception("Falha ao salvar obra.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro interno ao criar obra: {str(exc)}",
            ) from exc


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    status_code=status.HTTP_200_OK,
    summary="Buscar Obra por ID",
    description="Retorna os detalhes completos de uma obra, garantindo o isolamento hermético por tenant.",
)
async def get_project_by_id(
    project_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> ProjectResponse:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/projects"

    params = {
        "id": f"eq.{project_id}",
        "tenant_id": f"eq.{tenant_id}",
        "select": "*,clients(id,name,document)",
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
                    detail=f"Obra {project_id} não encontrada ou não pertence ao seu tenant.",
                )

            return ProjectResponse.model_validate(records[0])

        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Falha ao buscar obra %s: %s", project_id, str(exc))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao buscar obra: {str(exc)}",
            ) from exc


@router.put(
    "/{project_id}",
    response_model=ProjectResponse,
    status_code=status.HTTP_200_OK,
    summary="Atualizar dados da Obra",
    description="Atualiza os campos permitidos da obra, validando a titularidade do tenant_id autenticado.",
)
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> ProjectResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')
    supabase_url = f"{base_url}/rest/v1/projects"

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum campo informado para atualização.",
        )

    # Bloqueio de mutação de campos protegidos
    update_data.pop("tenant_id", None)
    update_data.pop("id", None)

    # Conversões e serializações
    if "client_id" in update_data and update_data["client_id"]:
        update_data["client_id"] = str(update_data["client_id"])
    if "contract_value" in update_data and update_data["contract_value"] is not None:
        update_data["contract_value"] = float(update_data["contract_value"])
    if "technical_retention_perc" in update_data and update_data["technical_retention_perc"] is not None:
        update_data["technical_retention_perc"] = float(update_data["technical_retention_perc"])
    if "status" in update_data and update_data["status"]:
        update_data["status"] = update_data["status"].value
    if "start_date" in update_data and update_data["start_date"]:
        update_data["start_date"] = update_data["start_date"].isoformat()
    if "end_date_planned" in update_data and update_data["end_date_planned"]:
        iso_end = update_data["end_date_planned"].isoformat()
        update_data["end_date_planned"] = iso_end
        update_data["expected_end_date"] = iso_end
    elif "expected_end_date" in update_data and update_data["expected_end_date"]:
        iso_end = update_data["expected_end_date"].isoformat()
        update_data["expected_end_date"] = iso_end
        update_data["end_date_planned"] = iso_end
    if "actual_end_date" in update_data and update_data["actual_end_date"]:
        update_data["actual_end_date"] = update_data["actual_end_date"].isoformat()

    params = {
        "id": f"eq.{project_id}",
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
                    detail=f"Obra {project_id} não encontrada ou não pertence ao seu tenant.",
                )

            # Busca com os dados do cliente vinculado
            get_res = await client.get(
                supabase_url,
                headers=_get_supabase_headers(token),
                params={
                    "id": f"eq.{project_id}",
                    "tenant_id": f"eq.{tenant_id}",
                    "select": "*,clients(id,name,document)",
                    "limit": "1",
                },
            )
            get_res.raise_for_status()
            final_records = get_res.json()
            return ProjectResponse.model_validate(final_records[0])

        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Falha ao atualizar obra %s: %s", project_id, str(exc))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao atualizar obra: {str(exc)}",
            ) from exc


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_200_OK,
    summary="Excluir Obra",
    description="Remove a obra da base de dados, garantindo que o tenant logado seja o legítimo titular do registro.",
)
async def delete_project(
    project_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> Dict[str, Any]:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/projects"

    params = {
        "id": f"eq.{project_id}",
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
                    detail=f"Obra {project_id} não encontrada ou não pertence à sua empresa.",
                )

            return {
                "success": True,
                "message": f"Obra '{deleted_records[0].get('name')}' excluída com sucesso.",
                "deleted_id": str(project_id),
            }

        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Falha ao excluir obra %s: %s", project_id, str(exc))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao excluir obra: {str(exc)}",
            ) from exc
