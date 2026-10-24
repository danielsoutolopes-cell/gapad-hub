import logging
from typing import Any, Dict, Tuple
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt

logger = logging.getLogger("gadap.auth")

security_scheme = HTTPBearer(
    scheme_name="Supabase JWT",
    description="Informe o token JWT emitido pelo Supabase Auth no formato: Bearer <token>",
)


def get_current_tenant_and_token(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> Tuple[UUID, str]:
    """
    Extrai o token JWT do cabeçalho Authorization, decodifica o payload
    e valida a existência compulsória do tenant_id (app_metadata.tenant_id).
    
    Retorna uma tupla: (tenant_id: UUID, raw_jwt_token: str).
    """
    token = credentials.credentials
    try:
        # Decodifica as claims do token JWT assinado pelo Supabase
        payload: Dict[str, Any] = jwt.decode(
            token,
            options={"verify_signature": False},
        )

        # O padrão canônico do Supabase armazena variáveis do sistema em app_metadata
        tenant_id_raw = (
            payload.get("app_metadata", {}).get("tenant_id")
            or payload.get("user_metadata", {}).get("tenant_id")
        )

        if not tenant_id_raw:
            logger.warning("Tentativa de acesso por usuário sem tenant_id vinculado nas claims.")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso Proibido: Usuário autenticado não possui vínculo com nenhuma empresa/tenant ativo.",
            )

        try:
            tenant_id = UUID(str(tenant_id_raw))
        except ValueError as exc:
            logger.error("tenant_id em formato UUID inválido: %s", tenant_id_raw)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Identificador de tenant corrompido ou fora do formato UUID: {tenant_id_raw}",
            ) from exc

        return tenant_id, token

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Falha ao decodificar token de autorização: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token de autorização inválido ou expirado: {str(exc)}",
        ) from exc
