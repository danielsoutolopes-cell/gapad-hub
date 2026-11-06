"""
=============================================================================
GADAP Hub - SRE Observability Middleware & Crash Alert Dispatcher
=============================================================================
Intercepta qualquer exceção não tratada (HTTP 500 / unhandled exception) em tempo real:
- Captura payload de entrada, método, rota, tenant e stack trace completo.
- Dispara webhook estruturado assíncrono para o canal de engenharia (Discord / Slack).
- Retorna resposta limpa e padronizada (RFC 7807 Problem Details) para o cliente.
=============================================================================
"""

import asyncio
import logging
import time
import traceback
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Optional

import httpx
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import settings
from app.core.metrics import (
    increment_in_flight,
    decrement_in_flight,
    record_request_metrics,
)

logger = logging.getLogger("gadap.sre.middleware")


class SRECrashAlertMiddleware(BaseHTTPMiddleware):
    """
    Middleware global para observabilidade ativa, métricas Prometheus e captura de crashes.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        increment_in_flight()
        start_ts = time.time()
        path = request.url.path
        method = request.method

        # Tenta ler o body sem consumir a stream para caso precise registrar no log de erro
        body_bytes = b""
        try:
            body_bytes = await request.body()
        except Exception:
            pass

        try:
            response = await call_next(request)
            duration = time.time() - start_ts
            record_request_metrics(method, path, response.status_code, duration)
            return response
        except Exception as exc:
            duration = time.time() - start_ts
            record_request_metrics(method, path, 500, duration)
            # Captura stack trace detalhado
            stack_trace = traceback.format_exc()
            error_msg = str(exc)
            tenant_id = request.headers.get("x-tenant-id") or "N/A"
            timestamp = datetime.now(timezone.utc).isoformat()

            logger.critical(
                "[CRASH DETECTADO 500] %s %s - Tenant: %s - Erro: %s\nStack:\n%s",
                method,
                path,
                tenant_id,
                error_msg,
                stack_trace,
            )

            # Prepara payload estruturado para notificação SRE
            alert_payload = {
                "environment": settings.ENVIRONMENT,
                "project": settings.PROJECT_NAME,
                "timestamp": timestamp,
                "method": method,
                "path": path,
                "tenant_id": tenant_id,
                "error": error_msg,
                "stack_trace": stack_trace[-1500:],  # Últimos 1500 caracteres
                "body_preview": body_bytes.decode("utf-8", errors="ignore")[:500] if body_bytes else None,
            }

            # Dispara alerta em background sem bloquear o retorno do cliente
            asyncio.create_task(self._send_sre_crash_webhook(alert_payload))

            # Resposta defensiva RFC 7807
            return JSONResponse(
                status_code=500,
                content={
                    "type": "https://errors.gadap.com.br/sre/unhandled-exception",
                    "title": "Erro Interno no Servidor",
                    "status": 500,
                    "detail": "Ocorreu uma falha inesperada. A equipe de engenharia foi notificada automaticamente via SRE Alert.",
                    "instance": path,
                    "incident_id": f"INC-{timestamp[:10].replace('-', '')}-{hash(stack_trace) % 1000000:06d}",
                },
            )
        finally:
            decrement_in_flight()

    async def _send_sre_crash_webhook(self, payload: Dict[str, Any]) -> None:
        """
        Dispara webhook formatado para Discord ou Slack.
        """
        webhook_url = settings.SRE_ALERT_WEBHOOK_URL
        if not webhook_url:
            logger.info("[SRE] SRE_ALERT_WEBHOOK_URL não configurado. Alerta registrado no log local.")
            return

        try:
            # Formato compatível com Discord Webhook Embeds
            discord_embed = {
                "content": "🚨 **[ALERTA CRÍTICO SRE] Falha Não Tratada no GADAP Hub (HTTP 500)**",
                "embeds": [
                    {
                        "title": f"Crash: {payload['method']} {payload['path']}",
                        "color": 15158332,  # Vermelho
                        "fields": [
                            {"name": "Ambiente", "value": payload["environment"], "inline": True},
                            {"name": "Tenant ID", "value": payload["tenant_id"], "inline": True},
                            {"name": "Erro", "value": f"`{payload['error'][:200]}`", "inline": False},
                            {
                                "name": "Stack Trace",
                                "value": f"```{payload['stack_trace'][-800:]}```",
                                "inline": False,
                            },
                        ],
                        "footer": {"text": f"GADAP Hub SRE • {payload['timestamp']}"},
                    }
                ],
            }

            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(webhook_url, json=discord_embed)
                logger.info("[SRE] Webhook de alerta de crash enviado com sucesso.")
        except Exception as alert_err:
            logger.error("[SRE] Falha ao disparar Webhook de alerta: %s", alert_err)

