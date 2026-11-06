"""
=============================================================================
GADAP Hub - SRE & Database Connection Pooling via Supavisor (Porta 6543)
=============================================================================
Padrão Arquitetural de Alta Disponibilidade:
- Modo Transaction do Supavisor (PgBouncer de alta performance do Supabase).
- Conexão estrita na porta 6543 para mitigar esgotamento de conexões (connection starvation).
- Pool Size e Max Overflow configurados com base nas melhores práticas para microsserviços
  assíncronos FastAPI rodando em contêineres autônomos.
=============================================================================
"""

import logging
from typing import Any, AsyncGenerator, Optional
from app.core.config import settings

logger = logging.getLogger("gadap.sre.database")

# Estrutura modular e defensiva: caso SQLAlchemy esteja instalado no container
try:
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
    from sqlalchemy.pool import AsyncAdaptedQueuePool, NullPool
    _HAS_SQLALCHEMY = True
except ImportError:
    create_async_engine = None  # type: ignore
    AsyncSession = None  # type: ignore
    async_sessionmaker = None  # type: ignore
    AsyncAdaptedQueuePool = None  # type: ignore
    NullPool = None  # type: ignore
    _HAS_SQLALCHEMY = False


def build_supavisor_connection_string() -> str:
    """
    Constrói ou higieniza a URI do banco para forçar a porta 6543 (Supavisor Transaction Pooler).
    Substitui 5432 por 6543 se fornecido por engano na variável DATABASE_URL.
    """
    raw_url = settings.DATABASE_URL
    if not raw_url:
        # Fallback de montagem baseado no SUPABASE_URL
        project_ref = settings.get_supabase_url().replace("https://", "").split(".")[0]
        # Padrão Supavisor Transaction Pooler
        raw_url = f"postgresql+asyncpg://postgres.{project_ref}:secret@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"

    # Força a porta 6543 se vier com 5432 padrão
    if ":5432/" in raw_url:
        logger.warning(
            "[SRE WARN] Conexão direta na porta 5432 detectada. Redirecionando para o Supavisor na porta 6543."
        )
        raw_url = raw_url.replace(":5432/", ":6543/")

    return raw_url


# Configuração do Engine Assíncrono com Pooling Otimizado
engine = None
AsyncSessionLocal = None

if _HAS_SQLALCHEMY:
    database_url = build_supavisor_connection_string()

    engine = create_async_engine(
        database_url,
        poolclass=AsyncAdaptedQueuePool,
        # pool_size: Mantém 20 conexões ativas pré-aquecidas por worker do FastAPI
        pool_size=settings.DB_POOL_SIZE,
        # max_overflow: Permite pico elástico de até mais 10 conexões durante surtos de requisições
        max_overflow=settings.DB_MAX_OVERFLOW,
        # pool_timeout: 30 segundos de espera máxima antes de rejeitar se o pool estiver saturado
        pool_timeout=settings.DB_POOL_TIMEOUT,
        # pool_recycle: Recicla conexões a cada 30 min (1800s) evitando desconexões abruptas por idle timeout
        pool_recycle=settings.DB_POOL_RECYCLE,
        pool_pre_ping=True,  # Valida se a conexão está viva antes de entregá-la da fila
        echo=settings.DEBUG,
    )

    AsyncSessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    logger.info("[SRE] SQLAlchemy Engine inicializado com Supavisor Pooling (Porta 6543).")
else:
    logger.info("[SRE] SQLAlchemy não detectado no ambiente atual. Camada preparada para injeção.")


async def get_db_session() -> AsyncGenerator[Optional[Any], None]:
    """
    Dependency FastAPI para injeção de sessão transacional com Supavisor.
    """
    if not AsyncSessionLocal:
        yield None
        return

    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
