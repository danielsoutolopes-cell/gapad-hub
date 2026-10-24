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
    SUPABASE_URL: Optional[str] = "https://dkjcgrwztyhcsyxlajia.supabase.co"
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=(".env.local", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
