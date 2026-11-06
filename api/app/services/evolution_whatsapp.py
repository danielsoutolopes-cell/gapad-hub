import logging
import re
from typing import Any, Dict, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("gadap.whatsapp")


import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("gadap.whatsapp")

# Tenta carregar tenacity para retry com backoff exponencial; fallback para retry assíncrono nativo
try:
    from tenacity import (
        AsyncRetrying,
        stop_after_attempt,
        wait_exponential,
        retry_if_exception_type,
    )
    _HAS_TENACITY = True
except ImportError:
    _HAS_TENACITY = False


class CircuitBreakerOpenException(Exception):
    """Lançada quando o Circuit Breaker está ativado para evitar sobrecarga."""
    pass


class EvolutionWhatsAppClient:
    """
    Cliente oficial assíncrono para comunicação com o Gateway WhatsApp (Evolution API).
    Resiliência SRE:
    - Backoff exponencial de 3 tentativas (2s, 4s, 8s).
    - Padrão Circuit Breaker: após falhas consecutivas, abre o circuito temporariamente
      e registra logs de falha no banco em vez de congelar a thread ou a requisição da API.
    """

    def __init__(
        self,
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
        instance_name: Optional[str] = None,
        timeout: float = 15.0,
    ) -> None:
        self.api_url = (api_url or settings.EVOLUTION_API_URL).rstrip("/")
        self.api_key = api_key or settings.EVOLUTION_API_KEY
        self.instance_name = instance_name or settings.EVOLUTION_INSTANCE_NAME
        self.timeout = timeout
        self._headers: Dict[str, str] = {
            "apikey": self.api_key or "",
            "Content-Type": "application/json",
        }
        # Estado do Circuit Breaker
        self._failure_count: int = 0
        self._circuit_open: bool = False
        self._circuit_opened_at: Optional[float] = None
        self._cooldown_seconds: float = 60.0  # Tempo para tentar fechar o circuito

    def _check_circuit_state(self) -> None:
        """Verifica se o circuito pode ser testado (Half-Open) ou continua aberto."""
        if self._circuit_open:
            import time
            elapsed = time.time() - (self._circuit_opened_at or 0)
            if elapsed > self._cooldown_seconds:
                logger.info("[CIRCUIT BREAKER] Entrando em estado HALF-OPEN para teste de recuperação.")
                self._circuit_open = False
            else:
                raise CircuitBreakerOpenException(
                    f"[CIRCUIT BREAKER ATIVADO] Evolution API inacessível. Tentativa bloqueada ({int(self._cooldown_seconds - elapsed)}s restantes)."
                )

    def _record_success(self) -> None:
        self._failure_count = 0
        self._circuit_open = False

    def _record_failure(self, error_msg: str, phone: str, context: str) -> None:
        import time
        self._failure_count += 1
        if self._failure_count >= 3:
            self._circuit_open = True
            self._circuit_opened_at = time.time()
            logger.error(
                "[CIRCUIT BREAKER DISPARADO] 3 falhas consecutivas na Evolution API. "
                "Circuito ABERTO por %ss para proteger o ecossistema GADAP.",
                self._cooldown_seconds,
            )
        # Registra log defensivo de falha no banco/sistema de auditoria
        self._log_delivery_failure_to_db(phone, error_msg, context)

    def _log_delivery_failure_to_db(self, phone: str, error_msg: str, context: str) -> None:
        """Salva registro de falha de envio para auditoria sem quebrar a execução."""
        log_entry = {
            "service": "EvolutionWhatsAppClient",
            "phone": phone,
            "error": error_msg,
            "context": context,
            "circuit_state": "OPEN" if self._circuit_open else "CLOSED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        logger.warning("[AUDITORIA SRE] Falha no Envio WhatsApp registrada: %s", log_entry)

    @staticmethod
    def sanitize_phone(phone: str) -> str:
        """
        Sanitiza e padroniza números de telefone brasileiros para o formato internacional E.164:
        DDI (55) + DDD (2 dígitos) + Número (8 ou 9 dígitos).
        """
        if not phone or not isinstance(phone, str):
            raise ValueError("O parâmetro de telefone deve ser uma string não vazia.")

        digits_only = re.sub(r"\D", "", phone)

        # Remove zero inicial de discagem interurbana (ex: 011...)
        if digits_only.startswith("0") and len(digits_only) in (11, 12):
            digits_only = digits_only[1:]

        # Caso já contenha o DDI do Brasil (55)
        if digits_only.startswith("55"):
            if len(digits_only) in (12, 13):
                return digits_only
            raise ValueError(
                f"Número com DDI 55 possui comprimento inválido ({len(digits_only)} dígitos): '{phone}'"
            )

        # Caso contenha DDD + Número (10 dígitos para fixo ou 11 para celular)
        if len(digits_only) in (10, 11):
            return f"55{digits_only}"

        raise ValueError(
            f"Formato de telefone inválido: '{phone}'. É necessário fornecer DDD + número (10 ou 11 dígitos)."
        )

    async def _execute_with_retry(self, coro_func, *args, **kwargs) -> Dict[str, Any]:
        """
        Executa operação com retry e backoff exponencial (2s, 4s, 8s).
        Se tenacity estiver disponível, usa AsyncRetrying; caso contrário, executa loop nativo.
        """
        delays = [2.0, 4.0, 8.0]
        last_exception = None

        if _HAS_TENACITY:
            try:
                async for attempt in AsyncRetrying(
                    stop=stop_after_attempt(3),
                    wait=wait_exponential(multiplier=2, min=2, max=8),
                    retry=retry_if_exception_type((httpx.RequestError, httpx.HTTPStatusError)),
                    reraise=True,
                ):
                    with attempt:
                        return await coro_func(*args, **kwargs)
            except Exception as exc:
                last_exception = exc
        else:
            for attempt_idx, delay in enumerate(delays, start=1):
                try:
                    return await coro_func(*args, **kwargs)
                except (httpx.RequestError, httpx.HTTPStatusError, Exception) as exc:
                    last_exception = exc
                    logger.warning(
                        "[RETRY] Tentativa %s/3 falhou ao comunicar com Evolution API: %s. Aguardando %ss...",
                        attempt_idx,
                        exc,
                        delay,
                    )
                    if attempt_idx < len(delays):
                        await asyncio.sleep(delay)

        raise last_exception or RuntimeError("Falha desconhecida no envio de WhatsApp após 3 tentativas.")

    async def send_text(
        self,
        phone: str,
        message: str,
        delay_ms: int = 1200,
        link_preview: bool = True,
    ) -> Dict[str, Any]:
        """
        Envia mensagem de texto via POST /message/sendText/{instance} com Circuit Breaker e Retry.
        """
        try:
            self._check_circuit_state()
        except CircuitBreakerOpenException as cbe:
            logger.warning(str(cbe))
            return {
                "success": False,
                "circuit_breaker_triggered": True,
                "error": str(cbe),
                "status": "FALLBACK_LOGGED",
            }

        sanitized_number = self.sanitize_phone(phone)
        endpoint_url = f"{self.api_url}/message/sendText/{self.instance_name}"
        payload: Dict[str, Any] = {
            "number": sanitized_number,
            "text": message,
            "options": {
                "delay": delay_ms,
                "presence": "composing",
                "linkPreview": link_preview,
            },
        }

        async def _request_call():
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    endpoint_url,
                    headers=self._headers,
                    json=payload,
                )
                response.raise_for_status()
                return response.json()

        try:
            result = await self._execute_with_retry(_request_call)
            self._record_success()
            return result
        except Exception as exc:
            err_msg = str(exc)
            logger.error("Falha final no envio de texto WhatsApp para %s após retries: %s", phone, err_msg)
            self._record_failure(err_msg, phone, context="send_text")
            return {
                "success": False,
                "circuit_breaker_triggered": self._circuit_open,
                "error": err_msg,
                "status": "FAILED_AND_LOGGED",
            }

    async def send_pdf(
        self,
        phone: str,
        media_url_or_base64: str,
        file_name: str,
        caption: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Envia documento PDF via POST /message/sendMedia/{instance} com Circuit Breaker e Retry.
        """
        try:
            self._check_circuit_state()
        except CircuitBreakerOpenException as cbe:
            logger.warning(str(cbe))
            return {
                "success": False,
                "circuit_breaker_triggered": True,
                "error": str(cbe),
                "status": "FALLBACK_LOGGED",
            }

        sanitized_number = self.sanitize_phone(phone)
        endpoint_url = f"{self.api_url}/message/sendMedia/{self.instance_name}"
        payload: Dict[str, Any] = {
            "number": sanitized_number,
            "mediatype": "document",
            "mimetype": "application/pdf",
            "caption": caption or file_name,
            "media": media_url_or_base64,
            "fileName": file_name,
        }

        async def _request_call():
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    endpoint_url,
                    headers=self._headers,
                    json=payload,
                )
                response.raise_for_status()
                return response.json()

        try:
            result = await self._execute_with_retry(_request_call)
            self._record_success()
            return result
        except Exception as exc:
            err_msg = str(exc)
            logger.error("Falha final no envio de PDF WhatsApp para %s após retries: %s", phone, err_msg)
            self._record_failure(err_msg, phone, context=f"send_pdf:{file_name}")
            return {
                "success": False,
                "circuit_breaker_triggered": self._circuit_open,
                "error": err_msg,
                "status": "FAILED_AND_LOGGED",
            }

