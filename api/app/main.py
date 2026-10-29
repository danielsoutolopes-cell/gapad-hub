import logging
from typing import Any, Dict
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from app.core.config import settings
from app.services.evolution_whatsapp import EvolutionWhatsAppClient
from app.core.errors import ProblemException, problem_exception_handler
from app.api.v1.endpoints.clients import router as clients_router
from app.api.v1.endpoints.suppliers import router as suppliers_router
from app.api.v1.endpoints.products import router as products_router
from app.api.v1.endpoints.services import router as services_router
from app.api.v1.endpoints.quotes import router as quotes_router
from app.api.v1.endpoints.projects import router as projects_router
from app.api.v1.endpoints.measurements import router as measurements_router
from app.api.v1.endpoints.backoffice import router as backoffice_router
from app.api.v1.endpoints.fiscal import router as fiscal_router
from app.api.v1.endpoints.intelligence import router as intelligence_router
from app.api.v1.endpoints.analytics import router as analytics_router
from app.api.v1.endpoints.subcontracts import router as subcontracts_router
from app.api.v1.endpoints.finance import router as finance_router
from app.api.v1.endpoints.inbound_invoices import router as inbound_invoices_router
from app.api.v1.endpoints.billing import router as billing_router
from app.api.v1.endpoints.procurement import router as procurement_router
from app.api.v1.endpoints.hr import router as hr_router
from app.api.v1.endpoints.crm import router as crm_router
from app.api.v1.endpoints.reconciliation import router as reconciliation_router
from app.api.v1.endpoints.governance import router as governance_router
from app.api.v1.endpoints.transfers import router as transfers_router

# Configuração de Logs
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("gadap.main")

# Inicialização da Instância Principal do FastAPI
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Microserviço assíncrono oficial do GADAP Hub. Responsável pelo orquestrador de "
        "notificações proativas (Evolution API / WhatsApp) e regras operacionais fiscais assíncronas."
    ),
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
)

# Configuração de CORS para comunicação fluida com Next.js (Cloudflare Pages)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instanciação do Cliente de WhatsApp
whatsapp_client = EvolutionWhatsAppClient()

# Registro de Rotas de Módulos Corporativos
app.include_router(
    clients_router,
    prefix=f"{settings.API_V1_STR}/clients",
    tags=["Clientes (Módulo Comercial)"],
)
app.include_router(
    suppliers_router,
    prefix=f"{settings.API_V1_STR}/suppliers",
    tags=["Fornecedores (Módulo Comercial)"],
)
app.include_router(
    products_router,
    prefix=f"{settings.API_V1_STR}/products",
    tags=["Produtos e Insumos (Módulo Comercial)"],
)
app.include_router(
    services_router,
    prefix=f"{settings.API_V1_STR}/services",
    tags=["Serviços de Engenharia (Módulo Comercial)"],
)
app.include_router(
    quotes_router,
    prefix=f"{settings.API_V1_STR}/quotes",
    tags=["Orçamentos & BDI (Módulo Comercial)"],
)
app.include_router(
    projects_router,
    prefix=f"{settings.API_V1_STR}/projects",
    tags=["Obras & Empreendimentos (Módulo Engenharia)"],
)
app.include_router(
    measurements_router,
    prefix=f"{settings.API_V1_STR}/measurements",
    tags=["Medições Físico-Financeiras (Módulo Engenharia)"],
)
app.include_router(
    backoffice_router,
    prefix=f"{settings.API_V1_STR}/backoffice",
    tags=["Backoffice Master (Super Admin)"],
)
app.include_router(
    fiscal_router,
    prefix=f"{settings.API_V1_STR}/fiscal",
    tags=["Motor Fiscal & NFS-e (Fase 9)"],
)
app.include_router(
    intelligence_router,
    prefix=f"{settings.API_V1_STR}/intelligence",
    tags=["Tax Intelligence & Monitoramento Legal (Fase 10)"],
)
app.include_router(
    analytics_router,
    prefix=f"{settings.API_V1_STR}/analytics",
    tags=["Analytics & Dashboards Executivos (Módulo 4.7)"],
)
app.include_router(
    subcontracts_router,
    prefix=f"{settings.API_V1_STR}/subcontracts",
    tags=["Subcontratos & Compliance Trabalhista (Fase 13)"],
)
app.include_router(
    finance_router,
    prefix=f"{settings.API_V1_STR}/finance",
    tags=["Central Financeira - Contas a Pagar e Receber"],
)
app.include_router(
    inbound_invoices_router,
    prefix=f"{settings.API_V1_STR}/inbound-invoices",
    tags=["Captura DFe & Manifestação SEFAZ (Fase 14)"],
)
app.include_router(
    billing_router,
    prefix=f"{settings.API_V1_STR}",
    tags=["Billing & Auto-Tenant RBAC (Fase 11)"],
)
app.include_router(
    procurement_router,
    prefix=f"{settings.API_V1_STR}",
    tags=["Suprimentos & Procurement (Fase 15)"],
)
app.include_router(
    hr_router,
    prefix=f"{settings.API_V1_STR}",
    tags=["RH & Ponto Geofencing (Fase 16)"],
)
app.include_router(
    crm_router,
    prefix=f"{settings.API_V1_STR}",
    tags=["CRM & Pós-Obra (Fase 17)"],
)
app.include_router(
    reconciliation_router,
    prefix=f"{settings.API_V1_STR}/finance/reconciliation",
    tags=["Conciliação Bancária Híbrida (Fase 18)"],
)
app.include_router(
    reconciliation_router,
    prefix=f"{settings.API_V1_STR}/reconciliation",
    tags=["Conciliação Bancária Híbrida (Fase 18)"],
)
app.include_router(
    governance_router,
    prefix=f"{settings.API_V1_STR}",
    tags=["Governança, Auditoria & Assinatura Gov.br"],
)
app.include_router(
    transfers_router,
    prefix=f"{settings.API_V1_STR}",
    tags=["Logística de Canteiro & Portaria Digital (Fase 19)"],
)

# Registro de Handler RFC 7807 para Problemas Fiscais e Validações
app.add_exception_handler(ProblemException, problem_exception_handler)


# ------------------------------------------------------------------------------
# Schemas de Dados (Pydantic com Tipagem Estrita)
# ------------------------------------------------------------------------------
class NotifyRequest(BaseModel):
    phone: str = Field(
        ...,
        description="Número de telefone do destinatário com DDD (ex: '(11) 98765-4321' ou '11987654321')",
        example="11987654321",
    )
    message: str = Field(
        ...,
        min_length=1,
        description="Mensagem de texto corporativa a ser enviada ao operador ou cliente",
        example="Olá! Sua medição de obra no GADAP Hub foi aprovada com sucesso.",
    )


class NotifyResponse(BaseModel):
    success: bool
    sanitized_phone: str
    message: str
    raw_response: Dict[str, Any]


class HealthCheckResponse(BaseModel):
    status: str
    service: str
    version: str
    evolution_instance: str


# ------------------------------------------------------------------------------
# Rotas Base & Health Check
# ------------------------------------------------------------------------------
@app.get("/", tags=["Health"])
async def root() -> Dict[str, str]:
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "documentation": f"{settings.API_V1_STR}/docs",
    }


@app.get(
    f"{settings.API_V1_STR}/health",
    response_model=HealthCheckResponse,
    tags=["Health"],
    summary="Verificação de integridade operacional do microserviço",
)
async def health_check() -> HealthCheckResponse:
    return HealthCheckResponse(
        status="healthy",
        service=settings.PROJECT_NAME,
        version=settings.VERSION,
        evolution_instance=settings.EVOLUTION_INSTANCE_NAME,
    )


# ------------------------------------------------------------------------------
# Endpoints de Mensageria & Notificações
# ------------------------------------------------------------------------------
@app.post(
    f"{settings.API_V1_STR}/notify",
    response_model=NotifyResponse,
    status_code=status.HTTP_200_OK,
    tags=["Notificações"],
    summary="Disparo de mensagem de texto via WhatsApp (Evolution API)",
    description=(
        "Recebe o número de telefone e o conteúdo textual, realiza a sanitização do número "
        "para o padrão E.164 (DDI 55) e despacha via Evolution API."
    ),
)
async def send_notification(payload: NotifyRequest) -> NotifyResponse:
    try:
        # Sanitização prévia de telefone para validação imediata
        sanitized_phone = EvolutionWhatsAppClient.sanitize_phone(payload.phone)

        logger.info("Iniciando despacho de WhatsApp para: %s", sanitized_phone)

        evolution_result = await whatsapp_client.send_text(
            phone=payload.phone,
            message=payload.message,
        )

        return NotifyResponse(
            success=True,
            sanitized_phone=sanitized_phone,
            message="Notificação enviada com sucesso ao destinatário.",
            raw_response=evolution_result,
        )

    except ValueError as ve:
        logger.warning("Falha de validação de telefone: %s", str(ve))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve),
        ) from ve

    except RuntimeError as re_err:
        logger.error("Falha de integração com o gateway WhatsApp: %s", str(re_err))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(re_err),
        ) from re_err

    except Exception as exc:
        logger.exception("Erro interno inesperado durante disparo de notificação.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro inesperado no servidor: {str(exc)}",
        ) from exc
