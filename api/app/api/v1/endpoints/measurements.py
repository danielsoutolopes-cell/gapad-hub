from decimal import Decimal, ROUND_HALF_EVEN
import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
import httpx
from app.core.config import settings
from app.core.deps import get_current_tenant_and_token
from app.schemas.measurement import (
    MeasurementCreate,
    MeasurementResponse,
    MeasurementStatus,
    MeasurementUpdate,
)

logger = logging.getLogger("gadap.measurements")

router = APIRouter()

# Precisão monetária oficial (numeric 18,4)
FOUR_PLACES = Decimal("0.0001")


def _get_supabase_headers(token: str) -> Dict[str, str]:
    """
    Retorna os headers para comunicação autenticada com o PostgREST do Supabase.
    Passa o token JWT do usuário para ativação das políticas RLS na tabela 'medicoes'.
    """
    return {
        "apikey": settings.SUPABASE_ANON_KEY or "",
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _calculate_measurement_values(
    valor_medido: Decimal,
    retencao_perc_input: Optional[Decimal],
    default_retention_perc: Decimal = Decimal("5.00"),
) -> Tuple[Decimal, Decimal]:
    """
    MOTOR MATEMÁTICO DETERMINÍSTICO DE MEDIÇÃO:
    Calcula o valor da retenção técnica e o valor líquido a faturar.
    
    Regra:
    1. Normaliza a taxa: se > 1.0 (ex: 5.0%), divide por 100 -> 0.05.
    2. retencao_tecnica = valor_medido * taxa (com ROUND_HALF_EVEN bancário).
    3. valor_liquido = valor_medido - retencao_tecnica.
    """
    if retencao_perc_input is not None:
        rate = Decimal(str(retencao_perc_input))
    else:
        rate = Decimal(str(default_retention_perc))

    # Normalização percentual
    if rate > Decimal("1.0"):
        rate = rate / Decimal("100.0")

    retencao_tecnica = (valor_medido * rate).quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN)
    valor_liquido = (valor_medido - retencao_tecnica).quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN)

    if valor_liquido < Decimal("0.0000"):
        valor_liquido = Decimal("0.0000")

    return retencao_tecnica, valor_liquido


@router.get(
    "/",
    response_model=List[MeasurementResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar Boletins de Medição Físico-Financeira",
    description="Retorna as medições cadastradas do tenant, com filtros opcionais por obra (project_id) e status.",
)
async def list_measurements(
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
    project_id: Optional[UUID] = Query(None, description="Filtrar medições de uma obra específica"),
    status_filter: Optional[MeasurementStatus] = Query(None, alias="status", description="Filtrar por status da medição"),
    limit: int = Query(50, ge=1, le=200, description="Limite de registros retornados"),
    offset: int = Query(0, ge=0, description="Offset de paginação"),
) -> List[MeasurementResponse]:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/medicoes"

    params: Dict[str, str] = {
        "tenant_id": f"eq.{tenant_id}",
        "select": "*,projects(id,name,code)",
        "order": "numero_sequencial.desc,created_at.desc",
        "limit": str(limit),
        "offset": str(offset),
    }

    if project_id:
        params["project_id"] = f"eq.{project_id}"

    if status_filter:
        params["status"] = f"eq.{status_filter.value}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(
                supabase_url,
                headers=_get_supabase_headers(token),
                params=params,
            )
            response.raise_for_status()
            data = response.json()
            return [MeasurementResponse.model_validate(item) for item in data]

        except httpx.HTTPStatusError as exc:
            logger.error("Falha ao consultar medições no Supabase: %s", exc.response.text)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro na consulta de medições: {exc.response.text}",
            ) from exc
        except Exception as exc:
            logger.exception("Erro de comunicação ao listar medições.")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Serviço de banco de dados indisponível: {str(exc)}",
            ) from exc


@router.post(
    "/",
    response_model=MeasurementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Emitir Boletim de Medição (Cálculo Determinístico no Backend)",
    description=(
        "Cria um novo boletim de medição. O payload recebe exclusivamente o 'valor_medido' "
        "e opcionalmente o percentual de retenção técnica. O backend calcula compulsoriamente "
        "a retenção monetária e o valor líquido com arredondamento bancário."
    ),
)
async def create_measurement(
    payload: MeasurementCreate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> MeasurementResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')

    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1. Valida se a Obra informada existe e pertence estritamente ao tenant autenticado
        projects_url = f"{base_url}/rest/v1/projects"
        try:
            project_check = await client.get(
                projects_url,
                headers=_get_supabase_headers(token),
                params={
                    "id": f"eq.{payload.project_id}",
                    "tenant_id": f"eq.{tenant_id}",
                    "select": "id,name,code,technical_retention_perc",
                    "limit": "1",
                },
            )
            project_check.raise_for_status()
            project_records = project_check.json()
            if not project_records:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Obra {payload.project_id} não encontrada ou não pertence à sua empresa.",
                )
            project_info = project_records[0]
            default_retention = Decimal(str(project_info.get("technical_retention_perc") or "5.00"))

        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Erro ao validar obra da medição %s: %s", payload.project_id, str(exc))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao verificar obra da medição: {str(exc)}",
            ) from exc

        # 2. Determinação determinística do número sequencial da medição (se não fornecido)
        numero_seq = payload.numero_sequencial
        if not numero_seq:
            medicoes_url = f"{base_url}/rest/v1/medicoes"
            try:
                seq_check = await client.get(
                    medicoes_url,
                    headers=_get_supabase_headers(token),
                    params={
                        "project_id": f"eq.{payload.project_id}",
                        "tenant_id": f"eq.{tenant_id}",
                        "select": "numero_sequencial",
                        "order": "numero_sequencial.desc",
                        "limit": "1",
                    },
                )
                seq_check.raise_for_status()
                latest_seq = seq_check.json()
                if latest_seq and latest_seq[0].get("numero_sequencial"):
                    numero_seq = int(latest_seq[0]["numero_sequencial"]) + 1
                else:
                    numero_seq = 1
            except Exception as exc:
                logger.warning("Falha ao obter último sequencial, adotando 1: %s", str(exc))
                numero_seq = 1

        # 3. REGRA DE NEGÓCIO INEGOCIÁVEL:
        # Cálculo determinístico em Python usando Decimal e ROUND_HALF_EVEN
        valor_medido_dec = Decimal(str(payload.valor_medido))
        retencao_tecnica_dec, valor_liquido_dec = _calculate_measurement_values(
            valor_medido=valor_medido_dec,
            retencao_perc_input=payload.retencao_tecnica_perc,
            default_retention_perc=default_retention,
        )

        logger.info(
            "Cálculo de Medição Obra=%s Seq=%s: Bruto=%s, Retenção=%s, Líquido=%s",
            payload.project_id,
            numero_seq,
            valor_medido_dec,
            retencao_tecnica_dec,
            valor_liquido_dec,
        )

        # 4. Gravação na tabela medicoes com isolamento do tenant_id
        measurement_dict = {
            "tenant_id": str(tenant_id),
            "project_id": str(payload.project_id),
            "numero_sequencial": numero_seq,
            "periodo_inicio": payload.periodo_inicio.isoformat(),
            "periodo_fim": payload.periodo_fim.isoformat(),
            "valor_medido": float(valor_medido_dec),
            "retencao_tecnica": float(retencao_tecnica_dec),
            "valor_liquido": float(valor_liquido_dec),
            "status": payload.status.value,
            "observacoes": payload.observacoes or None,
        }

        medicoes_post_url = f"{base_url}/rest/v1/medicoes"
        try:
            insert_response = await client.post(
                medicoes_post_url,
                headers=_get_supabase_headers(token),
                json=measurement_dict,
            )
            
            if insert_response.status_code == 409:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Já existe uma medição registrada com o sequencial #{numero_seq} para esta obra.",
                )

            insert_response.raise_for_status()
            created_records = insert_response.json()

            if not created_records:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Não foi possível salvar o boletim de medição.",
                )

            record = created_records[0]
            record["projects"] = project_info
            return MeasurementResponse.model_validate(record)

        except HTTPException:
            raise
        except httpx.HTTPStatusError as exc:
            logger.error("Erro na gravação da medição no Supabase: %s", exc.response.text)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Erro na validação do banco de dados: {exc.response.text}",
            ) from exc
        except Exception as exc:
            logger.exception("Falha inesperada ao registrar medição.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro interno ao registrar medição: {str(exc)}",
            ) from exc


@router.get(
    "/{measurement_id}",
    response_model=MeasurementResponse,
    status_code=status.HTTP_200_OK,
    summary="Obter Boletim de Medição por ID",
    description="Retorna os dados auditados da medição, validando a titularidade pelo tenant autenticado.",
)
async def get_measurement_by_id(
    measurement_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> MeasurementResponse:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/medicoes"

    params = {
        "id": f"eq.{measurement_id}",
        "tenant_id": f"eq.{tenant_id}",
        "select": "*,projects(id,name,code)",
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
                    detail=f"Medição {measurement_id} não encontrada ou não pertence à sua empresa.",
                )

            return MeasurementResponse.model_validate(records[0])

        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Falha ao recuperar medição %s: %s", measurement_id, str(exc))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao buscar medição: {str(exc)}",
            ) from exc


@router.put(
    "/{measurement_id}",
    response_model=MeasurementResponse,
    status_code=status.HTTP_200_OK,
    summary="Atualizar Boletim de Medição (Recálculo Automático)",
    description=(
        "Atualiza a medição informada. Se o 'valor_medido' ou a taxa de retenção forem alterados, "
        "o backend recalcula os valores monetários de retenção e líquido deterministamente."
    ),
)
async def update_measurement(
    measurement_id: UUID,
    payload: MeasurementUpdate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> MeasurementResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')
    supabase_url = f"{base_url}/rest/v1/medicoes"

    update_dict = payload.model_dump(exclude_unset=True)
    if not update_dict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum campo fornecido para atualização da medição.",
        )

    # Bloqueio de mutação de campos de controle
    update_dict.pop("tenant_id", None)
    update_dict.pop("id", None)
    update_dict.pop("project_id", None)
    update_dict.pop("numero_sequencial", None)
    update_dict.pop("valor_liquido", None)
    update_dict.pop("retencao_tecnica", None)

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Se alterou valor_medido ou retencao_tecnica_perc, recupera registro atual para recalcular
        if "valor_medido" in update_dict or "retencao_tecnica_perc" in update_dict:
            current_res = await client.get(
                supabase_url,
                headers=_get_supabase_headers(token),
                params={"id": f"eq.{measurement_id}", "tenant_id": f"eq.{tenant_id}", "limit": "1"},
            )
            current_res.raise_for_status()
            current_records = current_res.json()
            if not current_records:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Medição {measurement_id} não encontrada para atualização.",
                )
            current = current_records[0]

            val_medido_raw = update_dict.get("valor_medido", current["valor_medido"])
            val_medido_dec = Decimal(str(val_medido_raw))
            ret_perc_raw = update_dict.pop("retencao_tecnica_perc", None)

            retencao_dec, liquido_dec = _calculate_measurement_values(
                valor_medido=val_medido_dec,
                retencao_perc_input=Decimal(str(ret_perc_raw)) if ret_perc_raw is not None else None,
            )

            update_dict["valor_medido"] = float(val_medido_dec)
            update_dict["retencao_tecnica"] = float(retencao_dec)
            update_dict["valor_liquido"] = float(liquido_dec)

        if "status" in update_dict and update_dict["status"]:
            update_dict["status"] = update_dict["status"].value
        if "periodo_inicio" in update_dict and update_dict["periodo_inicio"]:
            update_dict["periodo_inicio"] = update_dict["periodo_inicio"].isoformat()
        if "periodo_fim" in update_dict and update_dict["periodo_fim"]:
            update_dict["periodo_fim"] = update_dict["periodo_fim"].isoformat()

        params = {
            "id": f"eq.{measurement_id}",
            "tenant_id": f"eq.{tenant_id}",
        }

        try:
            response = await client.patch(
                supabase_url,
                headers=_get_supabase_headers(token),
                params=params,
                json=update_dict,
            )
            response.raise_for_status()
            updated_records = response.json()

            if not updated_records:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Medição {measurement_id} inexistente ou não pertence à sua empresa.",
                )

            # Busca com os dados da obra vinculada
            get_res = await client.get(
                supabase_url,
                headers=_get_supabase_headers(token),
                params={
                    "id": f"eq.{measurement_id}",
                    "tenant_id": f"eq.{tenant_id}",
                    "select": "*,projects(id,name,code)",
                    "limit": "1",
                },
            )
            get_res.raise_for_status()
            final_records = get_res.json()
            return MeasurementResponse.model_validate(final_records[0])

        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Falha ao atualizar medição %s: %s", measurement_id, str(exc))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao atualizar medição: {str(exc)}",
            ) from exc


@router.delete(
    "/{measurement_id}",
    status_code=status.HTTP_200_OK,
    summary="Excluir Boletim de Medição",
    description="Remove a medição da base de dados, garantindo o isolamento hermético por tenant.",
)
async def delete_measurement(
    measurement_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> Dict[str, Any]:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/medicoes"

    params = {
        "id": f"eq.{measurement_id}",
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
                    detail=f"Medição {measurement_id} inexistente ou não pertence à sua empresa.",
                )

            return {
                "success": True,
                "message": f"Medição #{deleted_records[0].get('numero_sequencial')} excluída com sucesso.",
                "deleted_id": str(measurement_id),
            }

        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Falha ao excluir medição %s: %s", measurement_id, str(exc))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao excluir medição: {str(exc)}",
            ) from exc
