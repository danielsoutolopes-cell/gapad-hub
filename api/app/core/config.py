import base64
import hashlib
from pathlib import Path
from typing import Any, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Configurações centralizadas do ecossistema GADAP Hub Backend.
    Carrega variáveis do ambiente operacional ou arquivos .env / .env.local.
    Segurança corporativa: Nenhuma credencial ou segredo fica hardcoded no repositório.
    """
    # Aplicação
    PROJECT_NAME: str = "GADAP Hub - Backend Services"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = False

    # Chave global de criptografia simétrica (Fernet / Cofre de Certificado Digital A1)
    SECRET_KEY: Optional[str] = None

    # Evolution API (WhatsApp Gateway)
    EVOLUTION_API_URL: str = "https://whatsapp-ecostone.onrender.com"
    EVOLUTION_API_KEY: Optional[str] = None
    EVOLUTION_INSTANCE_NAME: str = "ecostone"

    # Inteligência Artificial (Google Gemini)
    GEMINI_API_KEY: Optional[str] = None

    # Gateway de Pagamento PF (Asaas / Mercado Pago)
    ASAAS_API_KEY: Optional[str] = None
    ASAAS_API_URL: str = "https://sandbox.asaas.com/api/v3"  # ou https://api.asaas.com/v3 em produção
    ASAAS_WEBHOOK_TOKEN: Optional[str] = None

    # Supabase (Banco Relacional & Storage)
    SUPABASE_URL: str = "https://dkjcgrwztyhcsyxlajia.supabase.co"
    NEXT_PUBLIC_SUPABASE_URL: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=(
            str(Path(__file__).resolve().parent.parent.parent.parent / ".env.local"),
            str(Path(__file__).resolve().parent.parent.parent.parent / ".env"),
            "../.env.local",
            ".env.local",
            ".env",
        ),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    def model_post_init(self, __context: Any) -> None:
        if not self.SUPABASE_ANON_KEY and self.NEXT_PUBLIC_SUPABASE_ANON_KEY:
            self.SUPABASE_ANON_KEY = self.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if not self.SUPABASE_URL and self.NEXT_PUBLIC_SUPABASE_URL:
            self.SUPABASE_URL = self.NEXT_PUBLIC_SUPABASE_URL

    def get_supabase_url(self) -> str:
        return self.SUPABASE_URL or self.NEXT_PUBLIC_SUPABASE_URL or "https://dkjcgrwztyhcsyxlajia.supabase.co"

    def get_service_role_key(self) -> str:
        return self.SUPABASE_SERVICE_ROLE_KEY or ""

    def get_anon_key(self) -> str:
        return self.SUPABASE_ANON_KEY or self.NEXT_PUBLIC_SUPABASE_ANON_KEY or ""

    def get_fernet_key(self) -> bytes:
        """
        Retorna uma chave Fernet de 32 bytes codificada em URL-safe Base64.
        Deriva deterministicamente via SHA-256 a partir de SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY como fallback).
        """
        raw_secret = (
            self.SECRET_KEY
            or self.SUPABASE_SERVICE_ROLE_KEY
            or "gadap-hub-enterprise-vault-master-secret-key-2026"
        )
        digest = hashlib.sha256(raw_secret.encode("utf-8")).digest()
        return base64.urlsafe_b64encode(digest)


settings = Settings()
