from pathlib import Path
from typing import Optional
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

    # Evolution API (WhatsApp Gateway)
    EVOLUTION_API_URL: str = "https://whatsapp-ecostone.onrender.com"
    EVOLUTION_API_KEY: Optional[str] = None
    EVOLUTION_INSTANCE_NAME: str = "ecostone"

    # Inteligência Artificial (Google Gemini)
    GEMINI_API_KEY: Optional[str] = None

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

    def get_supabase_url(self) -> str:
        return self.SUPABASE_URL or self.NEXT_PUBLIC_SUPABASE_URL or "https://dkjcgrwztyhcsyxlajia.supabase.co"

    def get_service_role_key(self) -> str:
        return self.SUPABASE_SERVICE_ROLE_KEY or ""

    def get_anon_key(self) -> str:
        return self.SUPABASE_ANON_KEY or self.NEXT_PUBLIC_SUPABASE_ANON_KEY or ""


settings = Settings()
