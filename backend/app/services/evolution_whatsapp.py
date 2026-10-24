import logging
import re
from typing import Any, Dict, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("gadap.whatsapp")


class EvolutionWhatsAppClient:
    """
    Cliente oficial assíncrono para comunicação com o Gateway WhatsApp (Evolution API).
    Suporta envio de notificações em texto e transmissão de documentos/laudos/medições em PDF.
    """

    def __init__(
        self,
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
        instance_name: Optional[str] = None,
        timeout: float = 30.0,
    ) -> None:
        self.api_url = (api_url or settings.EVOLUTION_API_URL).rstrip("/")
        self.api_key = api_key or settings.EVOLUTION_API_KEY
        self.instance_name = instance_name or settings.EVOLUTION_INSTANCE_NAME
        self.timeout = timeout
        self._headers: Dict[str, str] = {
            "apikey": self.api_key,
            "Content-Type": "application/json",
        }

    @staticmethod
    def sanitize_phone(phone: str) -> str:
        """
        Sanitiza e padroniza números de telefone brasileiros para o formato internacional E.164:
        DDI (55) + DDD (2 dígitos) + Número (8 ou 9 dígitos).
        
        Exemplos de entrada:
        - "(11) 98765-4321"   -> "5511987654321"
        - "11987654321"       -> "5511987654321"
        - "011987654321"      -> "5511987654321"
        - "5511987654321"     -> "5511987654321"
        - "+55 21 8765-4321"  -> "552187654321"
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

    async def send_text(
        self,
        phone: str,
        message: str,
        delay_ms: int = 1200,
        link_preview: bool = True,
    ) -> Dict[str, Any]:
        """
        Envia mensagem de texto via endpoint POST /message/sendText/{instance}.
        """
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

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    endpoint_url,
                    headers=self._headers,
                    json=payload,
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as exc:
                error_detail = exc.response.text
                logger.error(
                    "Falha HTTP na Evolution API [%s]: %s - %s",
                    endpoint_url,
                    exc.response.status_code,
                    error_detail,
                )
                raise RuntimeError(
                    f"Evolution API retornou erro HTTP {exc.response.status_code}: {error_detail}"
                ) from exc
            except httpx.RequestError as exc:
                logger.error("Falha de conexão com Evolution API [%s]: %s", endpoint_url, str(exc))
                raise RuntimeError(
                    f"Não foi possível conectar à Evolution API: {str(exc)}"
                ) from exc

    async def send_pdf(
        self,
        phone: str,
        media_url_or_base64: str,
        file_name: str,
        caption: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Envia documento PDF via endpoint POST /message/sendMedia/{instance}.
        Aceita tanto uma URL pública acessível quanto a string de dados codificada em Base64.
        """
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

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    endpoint_url,
                    headers=self._headers,
                    json=payload,
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as exc:
                error_detail = exc.response.text
                logger.error(
                    "Falha HTTP ao transmitir documento na Evolution API [%s]: %s - %s",
                    endpoint_url,
                    exc.response.status_code,
                    error_detail,
                )
                raise RuntimeError(
                    f"Evolution API falhou ao enviar PDF ({exc.response.status_code}): {error_detail}"
                ) from exc
            except httpx.RequestError as exc:
                logger.error("Falha de rede ao transmitir PDF para Evolution API: %s", str(exc))
                raise RuntimeError(
                    f"Erro de conexão durante envio do documento PDF: {str(exc)}"
                ) from exc
