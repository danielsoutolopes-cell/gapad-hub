from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class TenantStats(BaseModel):
    total_users: int = Field(0, description="Total de usuários cadastrados no tenant")
    total_active_projects: int = Field(0, description="Total de obras ativas (em_andamento)")
    total_projects: int = Field(0, description="Total de obras cadastradas (todos os status)")
    total_measurements: int = Field(0, description="Total de medições físico-financeiras realizadas")
    total_clients: int = Field(0, description="Total de clientes cadastrados")


class TenantSummaryResponse(BaseModel):
    id: UUID = Field(..., description="UUID identificador do tenant (Empresa)")
    legal_name: str = Field(..., description="Razão Social da empresa")
    trade_name: Optional[str] = Field(None, description="Nome Fantasia")
    cnpj: str = Field(..., description="CNPJ da empresa")
    email: Optional[str] = Field(None, description="E-mail principal de contato")
    phone: Optional[str] = Field(None, description="Telefone de contato")
    address_city: Optional[str] = Field(None, description="Município")
    address_state: Optional[str] = Field(None, description="UF")
    is_active: bool = Field(True, description="Status de ativação do tenant no SaaS")
    created_at: datetime = Field(..., description="Data de criação da empresa")
    stats: TenantStats = Field(..., description="Métricas operacionais e consolidadas da empresa")


class BackofficeTenantsListResponse(BaseModel):
    total_tenants: int = Field(..., description="Total de empresas contratantes cadastradas no SaaS")
    total_users_global: int = Field(..., description="Total global de usuários ativos em todas as empresas")
    total_active_projects_global: int = Field(..., description="Total global de obras em execução física")
    tenants: List[TenantSummaryResponse] = Field(..., description="Listagem detalhada das empresas e suas métricas")


class TenantResetRequest(BaseModel):
    confirm_phrase: Optional[str] = Field(
        None,
        description="Frase de confirmação de segurança para autorizar o expurgo de dados",
        example="RESET_TENANT_CONFIRMED",
    )


class TenantResetResponse(BaseModel):
    success: bool = Field(True, description="Indica se o expurgo foi concluído com sucesso")
    message: str = Field(..., description="Mensagem descritiva da ação realizada")
    tenant_id: UUID = Field(..., description="UUID do tenant que teve seus dados operacionais limpos")
    tenant_name: str = Field(..., description="Nome da empresa")
    preserved_records: List[str] = Field(
        default=["companies", "users"],
        description="Tabelas fundamentais preservadas durante a operação",
    )
    purged_domains: List[str] = Field(
        default=[
            "financial_entries",
            "medicoes",
            "quote_items",
            "quotes",
            "projects",
            "clients",
            "suppliers",
            "products",
            "services",
        ],
        description="Módulos operacionais e transacionais que foram completamente limpos",
    )
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Data/hora do expurgo")
