"""
=============================================================================
GADAP Hub - RFC 7807 Problem Details for HTTP APIs
Padronização de respostas de erro da API Fiscal conforme RFC 7807
=============================================================================
"""

from typing import Any, Dict, List, Optional
from fastapi import Request, status
from fastapi.responses import JSONResponse


class ProblemException(Exception):
    """
    Exceção base compatível com RFC 7807 (Problem Details for HTTP APIs).
    Permite encapsular erros fiscais, regras de retenção e falhas de transmissão.
    """

    def __init__(
        self,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        title: str = "Erro na Operação Fiscal",
        detail: str = "Ocorreu uma falha no processamento da solicitação fiscal.",
        type_uri: str = "https://gadap.com.br/errors/fiscal-error",
        instance: Optional[str] = None,
        invalid_params: Optional[List[Dict[str, Any]]] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.status_code = status_code
        self.title = title
        self.detail = detail
        self.type_uri = type_uri
        self.instance = instance
        self.invalid_params = invalid_params or []
        self.extra = extra or {}
        super().__init__(detail)

    def to_dict(self) -> Dict[str, Any]:
        result: Dict[str, Any] = {
            "type": self.type_uri,
            "title": self.title,
            "status": self.status_code,
            "detail": self.detail,
        }
        if self.instance:
            result["instance"] = self.instance
        if self.invalid_params:
            result["invalid_params"] = self.invalid_params
        if self.extra:
            result.update(self.extra)
        return result


async def problem_exception_handler(request: Request, exc: ProblemException) -> JSONResponse:
    """Handler registrado no FastAPI para serializar ProblemException em application/problem+json."""
    if not exc.instance:
        exc.instance = request.url.path
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict(),
        media_type="application/problem+json",
    )
