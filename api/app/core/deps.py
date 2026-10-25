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
            or payload.get("tenant_id")
        )

        # Fallback: Consulta direta na tabela public.users se não estiver nas claims do JWT
        if not tenant_id_raw and payload.get("sub"):
            user_id = payload.get("sub")
            from app.core.config import settings
            import httpx
            service_key = settings.SUPABASE_SERVICE_ROLE_KEY
            if service_key and settings.SUPABASE_URL:
                try:
                    url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/users?auth_user_id=eq.{user_id}&select=tenant_id"
                    h = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
                    with httpx.Client(timeout=3.0) as client:
                        resp = client.get(url, headers=h)
                        if resp.status_code == 200 and resp.json():
                            tenant_id_raw = resp.json()[0].get("tenant_id")
                except Exception as e:
                    logger.warning("Falha ao consultar tenant_id em public.users: %s", e)

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


def get_current_superadmin(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> Dict[str, Any]:
    """
    Middleware/Dependência de segurança que valida se o usuário autenticado via Bearer JWT
    possui a claim ou privilégio is_superadmin == True.
    Se não possuir, interrompe imediatamente a requisição com 403 Forbidden.
    Retorna o dicionário de contexto do SuperAdmin autenticado.
    """
    token = credentials.credentials
    try:
        payload: Dict[str, Any] = jwt.decode(
            token,
            options={"verify_signature": False},
        )

        is_superadmin = (
            payload.get("app_metadata", {}).get("is_superadmin") is True
            or payload.get("user_metadata", {}).get("is_superadmin") is True
            or payload.get("is_superadmin") is True
            or payload.get("app_metadata", {}).get("role") == "superadmin"
        )

        user_id = payload.get("sub")
        email = payload.get("email")

        # Dupla checagem no banco de dados via public.users
        if not is_superadmin and user_id:
            from app.core.config import settings
            import httpx
            if settings.SUPABASE_SERVICE_ROLE_KEY and settings.SUPABASE_URL:
                try:
                    resp = httpx.get(
                        f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/users?auth_user_id=eq.{user_id}&select=is_superadmin,role",
                        headers={
                            "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                        },
                        timeout=5.0,
                    )
                    if resp.status_code == 200:
                        rows = resp.json()
                        if rows and (rows[0].get("is_superadmin") is True or rows[0].get("role") == "superadmin"):
                            is_superadmin = True
                except Exception as check_exc:
                    logger.warning("Falha ao checar is_superadmin no banco para user %s: %s", user_id, check_exc)

        if not is_superadmin:
            logger.warning(
                "Acesso NÃO AUTORIZADO bloqueado na rota MASTER: user_id=%s, email=%s",
                user_id,
                email,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso Proibido: Esta rota e recursos são de uso exclusivo do Super Administrador (MASTER) do GADAP Hub.",
            )

        return {
            "user_id": user_id,
            "email": email,
            "token": token,
            "is_superadmin": True,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Falha ao decodificar token do Super Administrador: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token de autorização inválido ou expirado: {str(exc)}",
        ) from exc

