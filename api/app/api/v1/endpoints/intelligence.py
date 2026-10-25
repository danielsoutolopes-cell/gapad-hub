"""
=============================================================================
GADAP Hub - Router de Tax Intelligence & Monitoramento Legal (Fase 10)
Arquivo: api/app/api/v1/endpoints/intelligence.py
Rota: GET /api/v1/intelligence/legislation/alerts
=============================================================================
"""

import logging
from typing import Any, Dict, List, Optional
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, File, Header, HTTPException, Query, UploadFile, status

from app.schemas.intelligence import (
    LegislationAlertsListResponse,
    LegislationCategory,
    LegislationImpactLevel,
    LegislationSyncResponse,
    LegislationUpdateResponse,
    OcrParseResponse,
)
from app.services.legislation_monitor import legislation_monitor
from app.services.ocr_service import ocr_service

logger = logging.getLogger("gadap.intelligence_api")

router = APIRouter()


@router.get(
    "/legislation/alerts",
    response_model=LegislationAlertsListResponse,
    status_code=status.HTTP_200_OK,
    summary="Consulta alertas tributários e normativos da construção civil",
    description=(
        "Retorna a lista de alterações legislativas e notas fiscais monitoradas "
        "(IBPT, Receita Federal, Portal Nacional NFS-e, LC 116/2003 e Reforma Tributária). "
        "Permite filtros por categoria (iss, inss, nfse, ibpt) e nível de impacto (critical, warning, info)."
    ),
)
async def list_legislation_alerts(
    background_tasks: BackgroundTasks,
    category: Optional[str] = Query(
        None,
        description="Filtro opcional por categoria (iss, inss, irrf, nfse, ibpt, reforma_tributaria)",
    ),
    impact_level: Optional[str] = Query(
        None,
        description="Filtro opcional por nível de impacto (info, warning, critical)",
    ),
    limit: int = Query(
        20,
        ge=1,
        le=100,
        description="Limite de registros retornados (padrão 20, máximo 100)",
    ),
    auto_sync_if_empty: bool = Query(
        True,
        description="Se verdadeiro e o banco estiver vazio, aciona a varredura inicial automaticamente",
    ),
) -> LegislationAlertsListResponse:
    """
    Recupera os alertas legislativos gravados no banco de dados.
    Caso a tabela esteja sem registros (primeira execução), dispara o ciclo
    de varredura em tempo real para popular a inteligência fiscal.
    """
    try:
        raw_alerts = await legislation_monitor.get_alerts(
            category=category,
            impact_level=impact_level,
            limit=limit,
        )

        # Se for a primeira execução do ambiente e não houver dados gravados, realiza sync imediato
        if not raw_alerts and auto_sync_if_empty:
            logger.info("Base de alertas vazia. Executando varredura inicial de Tax Intelligence...")
            sync_result = await legislation_monitor.run_monitoring_cycle()
            raw_alerts = await legislation_monitor.get_alerts(
                category=category,
                impact_level=impact_level,
                limit=limit,
            )

        # Montagem das respostas tipadas
        alerts_models: List[LegislationUpdateResponse] = []
        for alert in raw_alerts:
            alerts_models.append(LegislationUpdateResponse(**alert))

        # Ordena: críticos primeiro, depois avisos, depois informativos; e mais recentes primeiro
        impact_weights = {"critical": 3, "warning": 2, "info": 1}
        alerts_models.sort(
            key=lambda x: (impact_weights.get(x.impact_level, 0), x.detected_at),
            reverse=True,
        )

        return LegislationAlertsListResponse(
            total=len(alerts_models),
            sources_monitored=[
                "IBPT (Instituto Brasileiro de Planejamento e Tributação)",
                "Receita Federal do Brasil (Portal Nacional NFS-e)",
                "Presidência da República (Lei Complementar 116/2003)",
                "Ministério da Fazenda (Reforma Tributária EC 132/2023)",
            ],
            last_sync_at=alerts_models[0].detected_at if alerts_models else datetime.utcnow(),
            alerts=alerts_models,
        )

    except Exception as exc:
        logger.exception("Falha ao recuperar alertas legislativos.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno ao consultar inteligência fiscal e alertas legislativos: {str(exc)}",
        ) from exc


@router.post(
    "/legislation/sync",
    response_model=LegislationSyncResponse,
    status_code=status.HTTP_200_OK,
    summary="Aciona ciclo de varredura e raspagem de inteligência fiscal em background",
    description=(
        "Dispara a Background Task de web scraping com BeautifulSoup no portal do IBPT "
        "e Portal Nacional da NFS-e. As novidades são salvas na tabela legislation_updates."
    ),
)
async def sync_legislation_intelligence(
    background_tasks: BackgroundTasks,
    run_async: bool = Query(
        False,
        description="Se true, roda estritamente em background assíncrono e retorna status 202 imediato",
    ),
) -> LegislationSyncResponse:
    """Executa o robô de monitoramento fiscal."""
    try:
        if run_async:
            background_tasks.add_task(legislation_monitor.run_monitoring_cycle)
            return LegislationSyncResponse(
                status="accepted",
                checked_sources=2,
                new_alerts_detected=0,
                message="Ciclo de Tax Intelligence enfileirado para execução em segundo plano.",
                details=[],
            )

        # Execução síncrona com relatório imediato
        result = await legislation_monitor.run_monitoring_cycle()
        return LegislationSyncResponse(
            status="completed",
            checked_sources=result.get("checked_sources", 2),
            new_alerts_detected=result.get("new_alerts_detected", 0),
            message=(
                f"Varredura concluída. {result.get('total_evaluated', 0)} normas avaliadas, "
                f"{result.get('new_alerts_detected', 0)} novos alertas registrados."
            ),
            details=result.get("details", []),
        )

    except Exception as exc:
        logger.exception("Erro ao executar ciclo de sincronização de legislação.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha ao executar ciclo de monitoramento legislativo: {str(exc)}",
        ) from exc


# ------------------------------------------------------------------------------
# Rota de OCR Preditivo com LLM (Contas a Pagar)
# ------------------------------------------------------------------------------
@router.post(
    "/ocr/parse",
    response_model=OcrParseResponse,
    status_code=status.HTTP_200_OK,
    summary="OCR preditivo de notas fiscais de insumos (Contas a Pagar)",
    description=(
        "Recebe um arquivo (PDF ou imagem) da nota fiscal de insumos ou compras de fornecedor. "
        "Persiste o documento temporariamente no servidor, envia ao LLM multimodal (Gemini 2.5 Flash) "
        "para extração de Fornecedor (CNPJ), Data, Valor Total e Itens discriminados, "
        "e retorna o parsed_payload acompanhado do confidence_score para preencher o Contas a Pagar."
    ),
)
async def parse_invoice_ocr(
    file: UploadFile = File(..., description="Arquivo PDF ou imagem (PNG, JPEG, WebP) da nota fiscal"),
) -> OcrParseResponse:
    """Extrai informações cadastrais e contábeis da nota fiscal de fornecedor."""
    try:
        return await ocr_service.process_invoice_file(file)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Falha inesperada no processamento de OCR preditivo.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno durante processamento de OCR da nota fiscal: {str(exc)}",
        ) from exc
