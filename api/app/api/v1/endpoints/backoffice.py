import logging
from typing import Any, Dict, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Path, status
import httpx
from app.core.config import settings
from app.core.deps import get_current_superadmin
from app.schemas.backoffice import (
    BackofficeTenantsListResponse,
    TenantResetRequest,
    TenantResetResponse,
    TenantStats,
    TenantSummaryResponse,
)

logger = logging.getLogger("gadap.backoffice")

router = APIRouter()


def _get_service_role_headers() -> Dict[str, str]:
    """
    Retorna os headers com a SERVICE_ROLE_KEY do Supabase para operações
    irrestritas e globais de backoffice / master.
    """
    api_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY or ""
    return {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


@router.get(
    "/tenants",
    response_model=BackofficeTenantsListResponse,
    status_code=status.HTTP_200_OK,
    summary="Listar todas as empresas do SaaS e estatísticas globais",
    description="Endpoint exclusivo do MASTER. Retorna todas as empresas cadastradas e seus indicadores consolidados.",
)
async def list_all_tenants(
    superadmin: Dict[str, Any] = Depends(get_current_superadmin),
) -> BackofficeTenantsListResponse:
    logger.info("MASTER %s acessando listagem global de tenants.", superadmin.get("email"))
    headers = _get_service_role_headers()
    base_url = settings.SUPABASE_URL.rstrip("/")

    async with httpx.AsyncClient(timeout=20.0) as client:
        # 1. Buscar todas as empresas cadastradas
        resp_companies = await client.get(
            f"{base_url}/rest/v1/companies?select=*&order=created_at.desc",
            headers=headers,
        )
        if resp_companies.status_code != 200:
            logger.error("Falha ao buscar empresas no backoffice: %s", resp_companies.text)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Erro de comunicação com banco de dados Supabase: {resp_companies.text}",
            )
        companies_data = resp_companies.json()

        # 2. Buscar contadores consolidados de cada entidade
        # Usuários
        resp_users = await client.get(
            f"{base_url}/rest/v1/users?select=id,tenant_id",
            headers=headers,
        )
        users_list = resp_users.json() if resp_users.status_code == 200 else []

        # Obras
        resp_projects = await client.get(
            f"{base_url}/rest/v1/projects?select=id,tenant_id,status",
            headers=headers,
        )
        projects_list = resp_projects.json() if resp_projects.status_code == 200 else []

        # Medições
        resp_medicoes = await client.get(
            f"{base_url}/rest/v1/medicoes?select=id,tenant_id",
            headers=headers,
        )
        medicoes_list = resp_medicoes.json() if resp_medicoes.status_code == 200 else []

        # Clientes
        resp_clients = await client.get(
            f"{base_url}/rest/v1/clients?select=id,tenant_id",
            headers=headers,
        )
        clients_list = resp_clients.json() if resp_clients.status_code == 200 else []

    # 3. Mapear métricas por tenant
    tenants_summary: List[TenantSummaryResponse] = []
    total_users_global = len(users_list)
    total_active_projects_global = 0

    for comp in companies_data:
        comp_id_str = str(comp["id"])

        tenant_users = [u for u in users_list if str(u.get("tenant_id")) == comp_id_str]
        tenant_projects = [p for p in projects_list if str(p.get("tenant_id")) == comp_id_str]
        tenant_active_proj = [
            p for p in tenant_projects if p.get("status") in ("em_andamento", "ativa", "ativo")
        ]
        tenant_medicoes = [m for m in medicoes_list if str(m.get("tenant_id")) == comp_id_str]
        tenant_clients = [c for c in clients_list if str(c.get("tenant_id")) == comp_id_str]

        total_active_projects_global += len(tenant_active_proj)

        stats = TenantStats(
            total_users=len(tenant_users),
            total_active_projects=len(tenant_active_proj),
            total_projects=len(tenant_projects),
            total_measurements=len(tenant_medicoes),
            total_clients=len(tenant_clients),
        )

        tenants_summary.append(
            TenantSummaryResponse(
                id=UUID(comp["id"]),
                legal_name=comp["legal_name"],
                trade_name=comp.get("trade_name"),
                cnpj=comp["cnpj"],
                email=comp.get("email"),
                phone=comp.get("phone"),
                address_city=comp.get("address_city"),
                address_state=comp.get("address_state"),
                is_active=comp.get("is_active", True),
                created_at=comp["created_at"],
                stats=stats,
            )
        )

    return BackofficeTenantsListResponse(
        total_tenants=len(companies_data),
        total_users_global=total_users_global,
        total_active_projects_global=total_active_projects_global,
        tenants=tenants_summary,
    )


@router.post(
    "/tenants/{tenant_id}/reset",
    response_model=TenantResetResponse,
    status_code=status.HTTP_200_OK,
    summary="Expurgar dados operacionais de um tenant específico",
    description=(
        "Endpoint destrutivo exclusivo do MASTER. Apaga (DELETE) todas as obras, medições, "
        "clientes, fornecedores, catálogos e dados financeiros de um tenant específico, "
        "preservando compulsoriamente apenas o registro da Empresa e seus Usuários."
    ),
)
async def reset_tenant_data(
    tenant_id: UUID = Path(..., description="UUID do tenant a ser resetado"),
    payload: Optional[TenantResetRequest] = None,
    superadmin: Dict[str, Any] = Depends(get_current_superadmin),
) -> TenantResetResponse:
    tenant_str = str(tenant_id)
    logger.warning(
        "MASTER %s iniciou RESET destrutivo para tenant %s",
        superadmin.get("email"),
        tenant_str,
    )
    headers = _get_service_role_headers()
    base_url = settings.SUPABASE_URL.rstrip("/")

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Verificar se o tenant existe
        resp_company = await client.get(
            f"{base_url}/rest/v1/companies?id=eq.{tenant_str}&select=id,trade_name,legal_name",
            headers=headers,
        )
        if resp_company.status_code != 200 or not resp_company.json():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Empresa/Tenant com ID {tenant_id} não foi encontrada no banco de dados.",
            )

        company = resp_company.json()[0]
        tenant_name = company.get("trade_name") or company.get("legal_name")

        # 2. Expurgo em cascata reversa para respeitar Foreign Keys

        # 2.1 Lançamentos Financeiros (Contas a Pagar e Receber)
        await client.delete(
            f"{base_url}/rest/v1/financial_entries?tenant_id=eq.{tenant_str}",
            headers=headers,
        )

        # 2.2 Medições de Engenharia
        await client.delete(
            f"{base_url}/rest/v1/medicoes?tenant_id=eq.{tenant_str}",
            headers=headers,
        )

        # 2.3 Itens de Orçamento e Orçamentos
        resp_quotes = await client.get(
            f"{base_url}/rest/v1/quotes?tenant_id=eq.{tenant_str}&select=id",
            headers=headers,
        )
        if resp_quotes.status_code == 200 and resp_quotes.json():
            quote_ids = [q["id"] for q in resp_quotes.json()]
            for qid in quote_ids:
                await client.delete(
                    f"{base_url}/rest/v1/quote_items?quote_id=eq.{qid}",
                    headers=headers,
                )
            await client.delete(
                f"{base_url}/rest/v1/quotes?tenant_id=eq.{tenant_str}",
                headers=headers,
            )

        # 2.4 Obras (Projects)
        await client.delete(
            f"{base_url}/rest/v1/projects?tenant_id=eq.{tenant_str}",
            headers=headers,
        )

        # 2.5 Clientes
        await client.delete(
            f"{base_url}/rest/v1/clients?tenant_id=eq.{tenant_str}",
            headers=headers,
        )

        # 2.6 Fornecedores, Produtos e Serviços
        await client.delete(
            f"{base_url}/rest/v1/suppliers?tenant_id=eq.{tenant_str}",
            headers=headers,
        )
        await client.delete(
            f"{base_url}/rest/v1/products?tenant_id=eq.{tenant_str}",
            headers=headers,
        )
        await client.delete(
            f"{base_url}/rest/v1/services?tenant_id=eq.{tenant_str}",
            headers=headers,
        )

    logger.info("RESET do tenant %s (%s) concluído com sucesso pelo MASTER.", tenant_str, tenant_name)

    return TenantResetResponse(
        success=True,
        message=(
            f"Reset operacional concluído com sucesso para a empresa '{tenant_name}'. "
            "Todas as obras, medições, clientes e dados financeiros foram expurgados. "
            "A empresa e os usuários foram preservados intactos."
        ),
        tenant_id=tenant_id,
        tenant_name=tenant_name,
        preserved_records=["companies", "users"],
        purged_domains=[
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
    )
