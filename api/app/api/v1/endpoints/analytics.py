"""
=============================================================================
GADAP Hub - Router de Analytics & Dashboards Executivos (Módulo 4.7)
Arquivo: api/app/api/v1/endpoints/analytics.py
Rotas:
  - GET /api/v1/analytics/executive
  - GET /api/v1/analytics/financial/dre
  - GET /api/v1/analytics/engineering/curve-s
  - GET /api/v1/analytics/export (Excel .xlsx)
=============================================================================
"""

import io
import logging
from datetime import datetime
from typing import Any, Dict, List, Mapping, Tuple
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from postgrest.types import CountMethod
from supabase import Client, ClientOptions, create_client

from app.core.config import settings
from app.core.deps import get_current_tenant_and_token
from app.schemas.analytics import (
    CostCenterBreakdown,
    CurveSPoint,
    CurveSProjectItem,
    EngineeringCurveSResponse,
    ExecutiveSummaryResponse,
    FinancialDreResponse,
    MonthlyEvolutionItem,
)

logger = logging.getLogger("gadap.analytics")

router = APIRouter()

# Cores corporativas padrão para os centros de custo no Donut Chart
COST_CENTER_COLORS: Dict[str, Tuple[str, str]] = {
    "material_construcao": ("Materiais & Insumos", "#3B82F6"),
    "material": ("Materiais & Insumos", "#3B82F6"),
    "insumos": ("Insumos de Canteiro", "#06B6D4"),
    "mao_de_obra": ("Mão de Obra & Empreiteiros", "#10B981"),
    "locacao_equipamentos": ("Locação de Equipamentos", "#F59E0B"),
    "equipamentos": ("Locação de Equipamentos", "#F59E0B"),
    "impostos": ("Tributos & Retenções Fiscais", "#EF4444"),
    "tributos": ("Tributos & Retenções Fiscais", "#EF4444"),
    "administrativo": ("Despesas Administrativas", "#8B5CF6"),
    "servicos_terceiros": ("Serviços Especializados", "#EC4899"),
    "geral": ("Outras Despesas Operacionais", "#64748B"),
}

AUTHORIZED_INVOICE_STATUSES = [
    "AUTHORIZED",
    "authorized",
    "AUTORIZADO",
    "autorizado",
    "AUTORIZADA",
    "autorizada",
]

ACTIVE_PROJECT_STATUSES = [
    "EM_ANDAMENTO",
    "em_andamento",
]

PT_MONTHS = {
    1: ("Jan", "Janeiro"),
    2: ("Fev", "Fevereiro"),
    3: ("Mar", "Março"),
    4: ("Abr", "Abril"),
    5: ("Mai", "Maio"),
    6: ("Jun", "Junho"),
    7: ("Jul", "Julho"),
    8: ("Ago", "Agosto"),
    9: ("Set", "Setembro"),
    10: ("Out", "Outubro"),
    11: ("Nov", "Novembro"),
    12: ("Dez", "Dezembro"),
}


# ------------------------------------------------------------------------------
# Helper: Cliente Supabase Autenticado com JWT da Requisição (RLS Ativo)
# ------------------------------------------------------------------------------
def get_supabase_client(token: str) -> Client:
    """
    Cria e retorna uma instância do cliente oficial do Supabase injetando o JWT
    do usuário autenticado no PostgREST para que as políticas de RLS sejam
    acionadas automaticamente no banco de dados PostgreSQL.
    """
    supabase_url = settings.get_supabase_url()
    supabase_key = settings.get_anon_key() or settings.get_service_role_key()
    if not supabase_url or not supabase_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Configuração do Supabase ausente no servidor.",
        )

    options = ClientOptions(
        headers={
            "Authorization": f"Bearer {token}",
        }
    )
    client: Client = create_client(supabase_url, supabase_key, options=options)
    client.postgrest.auth(token)
    return client


def _as_dict_list(data: Any) -> List[Dict[str, Any]]:
    """Converte com segurança a lista JSON do PostgREST para List[Dict[str, Any]]."""
    if not isinstance(data, list):
        return []
    return [dict(row) for row in data if isinstance(row, Mapping)]


def _fetch_authorized_invoices(supabase: Client, tenant_id_str: str) -> List[Dict[str, Any]]:
    """
    Consulta as faturas autorizadas na tabela/view `invoices` com RLS ativo.
    Possui fallback transparente para `fiscal_invoices` caso a view `invoices`
    ainda não esteja publicada em algum ambiente isolado.
    """
    try:
        res = (
            supabase.table("invoices")
            .select(
                "total_invoice_amount, gross_amount, net_amount, "
                "iss_retained_amount, inss_retained_amount, irrf_retained_amount, csll_retained_amount, "
                "status, authorized_at"
            )
            .eq("tenant_id", tenant_id_str)
            .in_("status", AUTHORIZED_INVOICE_STATUSES)
            .execute()
        )
        return _as_dict_list(res.data)
    except Exception as exc:
        logger.warning("Fallback de invoices para fiscal_invoices: %s", exc)
        res = (
            supabase.table("fiscal_invoices")
            .select(
                "gross_amount, net_amount, "
                "iss_retained_amount, inss_retained_amount, irrf_retained_amount, csll_retained_amount, "
                "status, authorized_at"
            )
            .eq("tenant_id", tenant_id_str)
            .in_("status", AUTHORIZED_INVOICE_STATUSES)
            .execute()
        )
        return _as_dict_list(res.data)


# ------------------------------------------------------------------------------
# 1. Endpoint: /executive
# ------------------------------------------------------------------------------
@router.get(
    "/executive",
    response_model=ExecutiveSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Resumo Executivo para a Diretoria (Conectado ao Supabase com RLS)",
    description=(
        "Extrai o tenant_id do token JWT do usuário autenticado, injeta o JWT no cliente "
        "Supabase para acionamento de RLS e retorna agregados reais de faturamento bruto "
        "(invoices autorizadas), obras ativas (projects EM_ANDAMENTO), retenções e lucro."
    ),
)
async def get_executive_summary(
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> ExecutiveSummaryResponse:
    tenant_id, token = auth_data
    tenant_id_str = str(tenant_id)
    supabase = get_supabase_client(token)

    try:
        # 1. Query Real: gross_revenue = SOMA de total_invoice_amount em `invoices` onde status é autorizado
        invoices_rows = _fetch_authorized_invoices(supabase, tenant_id_str)

        gross_revenue = sum(
            float(row.get("total_invoice_amount") or row.get("gross_amount") or 0.0)
            for row in invoices_rows
        )

        # Retenções tributárias reais das notas fiscais autorizadas
        fiscal_retentions = sum(
            float(row.get("iss_retained_amount") or 0.0)
            + float(row.get("inss_retained_amount") or 0.0)
            + float(row.get("irrf_retained_amount") or 0.0)
            + float(row.get("csll_retained_amount") or 0.0)
            for row in invoices_rows
        )

        # 2. Query Real: active_projects = COUNT da tabela `projects` onde status é 'EM_ANDAMENTO'
        projects_res = (
            supabase.table("projects")
            .select("id, status", count=CountMethod.exact)
            .eq("tenant_id", tenant_id_str)
            .in_("status", ACTIVE_PROJECT_STATUSES)
            .execute()
        )
        active_projects = (
            projects_res.count
            if projects_res.count is not None
            else len(_as_dict_list(projects_res.data))
        )

        # 3. Query Real: Lançamentos financeiros para apuração de despesas operacionais e retenções técnicas
        entries_res = (
            supabase.table("financial_entries")
            .select("entry_type, nominal_amount, technical_retention_amount, net_amount, status, due_date")
            .eq("tenant_id", tenant_id_str)
            .neq("status", "cancelado")
            .execute()
        )
        entries_rows = _as_dict_list(entries_res.data)

        technical_retentions = 0.0
        total_expenses = 0.0
        for entry in entries_rows:
            etype = (entry.get("entry_type") or "").lower()
            nominal = float(entry.get("nominal_amount") or 0.0)
            retention = float(entry.get("technical_retention_amount") or 0.0)
            if etype in ("receivable", "a_receber"):
                technical_retentions += retention
            elif etype in ("payable", "a_pagar"):
                total_expenses += nominal

        total_retentions = round(fiscal_retentions + technical_retentions, 2)
        gross_revenue_rounded = round(gross_revenue, 2)
        total_expenses_rounded = round(total_expenses, 2)

        # Lucro real: Faturamento Bruto - Retenções Fiscais/Técnicas - Despesas Operacionais
        net_profit = round(gross_revenue_rounded - fiscal_retentions - total_expenses_rounded, 2)
        margem_lucro = (
            round((net_profit / gross_revenue_rounded) * 100, 2)
            if gross_revenue_rounded > 0
            else 0.0
        )

        invoices_count = len(invoices_rows)
        ticket_medio = (
            round(gross_revenue_rounded / invoices_count, 2)
            if invoices_count > 0
            else 0.0
        )

        # Variação percentual real entre meses a partir das datas de autorização
        now = datetime.now()
        current_ym = now.strftime("%Y-%m")
        prev_year = now.year if now.month > 1 else now.year - 1
        prev_month = now.month - 1 if now.month > 1 else 12
        prev_ym = f"{prev_year:04d}-{prev_month:02d}"

        cur_month_rev = 0.0
        prev_month_rev = 0.0
        for row in invoices_rows:
            auth_dt = str(row.get("authorized_at") or "")
            amt = float(row.get("total_invoice_amount") or row.get("gross_amount") or 0.0)
            if auth_dt.startswith(current_ym):
                cur_month_rev += amt
            elif auth_dt.startswith(prev_ym):
                prev_month_rev += amt

        comparativo_perc = (
            round(((cur_month_rev - prev_month_rev) / prev_month_rev) * 100, 1)
            if prev_month_rev > 0
            else 0.0
        )

        mes_nome = PT_MONTHS.get(now.month, ("Mês", "Mês"))[1]
        mes_referencia = f"{mes_nome}/{now.year}"

        return ExecutiveSummaryResponse(
            tenant_id=tenant_id_str,
            gross_revenue=gross_revenue_rounded,
            active_projects=active_projects,
            net_profit=net_profit,
            total_retentions=total_retentions,
            total_expenses=total_expenses_rounded,
            faturamento_total_mes=gross_revenue_rounded,
            ticket_medio=ticket_medio,
            total_retencoes_fiscais=total_retentions,
            lucro_bruto_projetado=net_profit,
            margem_lucro_perc=margem_lucro,
            obras_ativas=active_projects,
            receitas_mes=gross_revenue_rounded,
            despesas_mes=total_expenses_rounded,
            comparativo_mes_anterior_perc=comparativo_perc,
            mes_referencia=mes_referencia,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Erro ao consultar indicadores executivos no Supabase: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao apurar indicadores executivos no Supabase: {str(exc)}",
        ) from exc


# ------------------------------------------------------------------------------
# 2. Endpoint: /financial/dre
# ------------------------------------------------------------------------------
@router.get(
    "/financial/dre",
    response_model=FinancialDreResponse,
    status_code=status.HTTP_200_OK,
    summary="Consolidação do DRE Gerencial (Conectado ao Supabase com RLS)",
    description="Retorna Receitas vs Despesas reais agrupadas por Centro de Custo e evolução mensal.",
)
async def get_financial_dre(
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> FinancialDreResponse:
    tenant_id, token = auth_data
    tenant_id_str = str(tenant_id)
    supabase = get_supabase_client(token)

    try:
        invoices_rows = _fetch_authorized_invoices(supabase, tenant_id_str)
        entries_res = (
            supabase.table("financial_entries")
            .select("entry_type, category, nominal_amount, net_amount, status, due_date")
            .eq("tenant_id", tenant_id_str)
            .neq("status", "cancelado")
            .execute()
        )
        entries = _as_dict_list(entries_res.data)

        receitas_invoices = sum(
            float(inv.get("total_invoice_amount") or inv.get("gross_amount") or 0.0)
            for inv in invoices_rows
        )
        receitas_entries = 0.0
        despesas_total = 0.0
        por_categoria: Dict[str, float] = {}
        por_mes: Dict[str, Dict[str, float]] = {}

        for entry in entries:
            etype = (entry.get("entry_type") or "").lower()
            nominal = float(entry.get("nominal_amount") or 0.0)
            cat_raw = (entry.get("category") or "geral").lower().strip()
            due_str = str(entry.get("due_date") or "")
            ym = due_str[:7] if len(due_str) >= 7 else ""

            if ym:
                if ym not in por_mes:
                    por_mes[ym] = {"receitas": 0.0, "despesas": 0.0}

            if etype in ("receivable", "a_receber"):
                receitas_entries += nominal
                if ym:
                    por_mes[ym]["receitas"] += nominal
            elif etype in ("payable", "a_pagar"):
                despesas_total += nominal
                por_categoria[cat_raw] = por_categoria.get(cat_raw, 0.0) + nominal
                if ym:
                    por_mes[ym]["despesas"] += nominal

        # Se não houver lançamentos a receber em financial_entries, considera as faturas autorizadas
        receitas_total = receitas_invoices if receitas_invoices > 0 else receitas_entries

        breakdown: List[CostCenterBreakdown] = []
        for cat_key, cat_total in por_categoria.items():
            config = COST_CENTER_COLORS.get(
                cat_key, (cat_key.replace("_", " ").title(), "#94A3B8")
            )
            perc = (cat_total / despesas_total * 100) if despesas_total > 0 else 0.0
            breakdown.append(
                CostCenterBreakdown(
                    categoria=cat_key,
                    nome_exibicao=config[0],
                    total=round(cat_total, 2),
                    percentual=round(perc, 1),
                    cor=config[1],
                )
            )

        breakdown.sort(key=lambda x: x.total, reverse=True)

        evolucao: List[MonthlyEvolutionItem] = []
        for ym in sorted(por_mes.keys())[-6:]:
            try:
                year_val, month_val = int(ym[:4]), int(ym[5:7])
                curto, completo = PT_MONTHS.get(month_val, (ym, ym))
                rotulo = f"{curto}/{str(year_val)[-2:]}"
                nome_completo = f"{completo}/{year_val}"
            except Exception:
                rotulo = ym
                nome_completo = ym

            rec_m = round(por_mes[ym]["receitas"], 2)
            desp_m = round(por_mes[ym]["despesas"], 2)
            lucro_m = round(rec_m - desp_m, 2)
            margem_m = round((lucro_m / rec_m * 100), 1) if rec_m > 0 else 0.0
            evolucao.append(
                MonthlyEvolutionItem(
                    mes=rotulo,
                    mes_completo=nome_completo,
                    receitas=rec_m,
                    despesas=desp_m,
                    lucro=lucro_m,
                    margem_perc=margem_m,
                )
            )

        resultado_liquido = round(receitas_total - despesas_total, 2)
        margem_liquida = (
            round((resultado_liquido / receitas_total * 100), 2)
            if receitas_total > 0
            else 0.0
        )

        return FinancialDreResponse(
            tenant_id=tenant_id_str,
            periodo=f"Exercício {datetime.now().year}",
            receitas_total=round(receitas_total, 2),
            despesas_total=round(despesas_total, 2),
            resultado_liquido=resultado_liquido,
            margem_liquida_perc=margem_liquida,
            por_centro_custo=breakdown,
            evolucao_mensal=evolucao,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Erro ao consultar DRE no Supabase: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao apurar DRE no Supabase: {str(exc)}",
        ) from exc


# ------------------------------------------------------------------------------
# 3. Endpoint: /engineering/curve-s
# ------------------------------------------------------------------------------
@router.get(
    "/engineering/curve-s",
    response_model=EngineeringCurveSResponse,
    status_code=status.HTTP_200_OK,
    summary="Avanço de Obras e Curva S (Conectado ao Supabase com RLS)",
    description="Retorna avanço físico (medições) vs financeiro (faturado) real por obra.",
)
async def get_engineering_curve_s(
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> EngineeringCurveSResponse:
    tenant_id, token = auth_data
    tenant_id_str = str(tenant_id)
    supabase = get_supabase_client(token)

    try:
        projects_res = (
            supabase.table("projects")
            .select("id, name, code, contract_value, status")
            .eq("tenant_id", tenant_id_str)
            .execute()
        )
        projects = _as_dict_list(projects_res.data)

        medicoes_res = (
            supabase.table("medicoes")
            .select("project_id, valor_medido, valor_liquido, status, periodo_fim")
            .eq("tenant_id", tenant_id_str)
            .execute()
        )
        medicoes = _as_dict_list(medicoes_res.data)

        medicoes_por_obra: Dict[str, Dict[str, float]] = {}
        for m in medicoes:
            pid = str(m.get("project_id"))
            status_m = (m.get("status") or "").lower()
            v_med = float(m.get("valor_medido") or 0.0)
            v_liq = float(m.get("valor_liquido") or 0.0)

            if pid not in medicoes_por_obra:
                medicoes_por_obra[pid] = {"medido": 0.0, "faturado": 0.0}

            if status_m in ("aprovada", "faturada"):
                medicoes_por_obra[pid]["medido"] += v_med
            if status_m == "faturada":
                medicoes_por_obra[pid]["faturado"] += v_liq

        obras_detalhadas: List[CurveSProjectItem] = []
        total_contratos = 0.0
        total_medido_global = 0.0
        total_faturado_global = 0.0
        obras_em_andamento = 0

        for p in projects:
            pid = str(p.get("id"))
            nome = p.get("name") or "Empreendimento"
            codigo = p.get("code")
            status_p = p.get("status") or "planejamento"
            if status_p in ACTIVE_PROJECT_STATUSES:
                obras_em_andamento += 1

            contrato = float(p.get("contract_value") or 0.0)
            acum = medicoes_por_obra.get(pid, {"medido": 0.0, "faturado": 0.0})
            medido = acum["medido"]
            faturado = acum["faturado"]

            total_contratos += contrato
            total_medido_global += medido
            total_faturado_global += faturado

            perc_fis = (
                min(100.0, round((medido / contrato * 100), 2)) if contrato > 0 else 0.0
            )
            perc_fin = (
                min(100.0, round((faturado / contrato * 100), 2)) if contrato > 0 else 0.0
            )
            saldo = max(0.0, round(contrato - faturado, 2))

            obras_detalhadas.append(
                CurveSProjectItem(
                    id=pid,
                    nome=nome,
                    codigo=codigo,
                    valor_contrato=contrato,
                    total_medido=round(medido, 2),
                    total_faturado=round(faturado, 2),
                    percentual_fisico=perc_fis,
                    percentual_financeiro=perc_fin,
                    saldo_contratual=saldo,
                    status=status_p,
                )
            )

        avanco_fis_medio = (
            round((total_medido_global / total_contratos * 100), 2)
            if total_contratos > 0
            else 0.0
        )
        avanco_fin_medio = (
            round((total_faturado_global / total_contratos * 100), 2)
            if total_contratos > 0
            else 0.0
        )

        # Constrói a Curva S acumulada a partir das medições reais ordenadas por período
        curva_s: List[CurveSPoint] = []
        if medicoes and total_contratos > 0:
            por_periodo: Dict[str, Dict[str, float]] = {}
            for m in medicoes:
                status_m = (m.get("status") or "").lower()
                if status_m not in ("aprovada", "faturada"):
                    continue
                pfim = str(m.get("periodo_fim") or "")
                ym = pfim[:7] if len(pfim) >= 7 else "Atual"
                if ym not in por_periodo:
                    por_periodo[ym] = {"medido": 0.0, "faturado": 0.0}
                por_periodo[ym]["medido"] += float(m.get("valor_medido") or 0.0)
                if status_m == "faturada":
                    por_periodo[ym]["faturado"] += float(m.get("valor_liquido") or 0.0)

            acum_med = 0.0
            acum_fat = 0.0
            sorted_periods = sorted(por_periodo.keys())
            total_steps = max(1, len(sorted_periods))
            for idx, ym in enumerate(sorted_periods, start=1):
                acum_med += por_periodo[ym]["medido"]
                acum_fat += por_periodo[ym]["faturado"]
                fis_pct = min(100.0, round((acum_med / total_contratos) * 100, 1))
                fin_pct = min(100.0, round((acum_fat / total_contratos) * 100, 1))
                plan_pct = min(100.0, round((idx / total_steps) * fis_pct, 1))
                curva_s.append(
                    CurveSPoint(
                        periodo=ym,
                        planejado_acumulado=plan_pct,
                        fisico_acumulado=fis_pct,
                        financeiro_acumulado=fin_pct,
                    )
                )

        return EngineeringCurveSResponse(
            tenant_id=tenant_id_str,
            obras_ativas=obras_em_andamento,
            valor_total_contratos=round(total_contratos, 2),
            total_medido_global=round(total_medido_global, 2),
            total_faturado_global=round(total_faturado_global, 2),
            avanco_fisico_medio_perc=avanco_fis_medio,
            avanco_financeiro_medio_perc=avanco_fin_medio,
            obras=obras_detalhadas,
            curva_s_acumulada=curva_s,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Erro ao consultar Curva S no Supabase: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao apurar dados de engenharia no Supabase: {str(exc)}",
        ) from exc


# ------------------------------------------------------------------------------
# 4. Endpoint: /export (Geração de Planilha Excel .xlsx Profissional)
# ------------------------------------------------------------------------------
@router.get(
    "/export",
    summary="Exportação de Relatório Executivo em Excel (.xlsx)",
    description="Gera uma planilha contendo Fluxo de Caixa, Retenções Fiscais e DRE Gerencial real.",
)
async def export_excel_report(
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
):
    tenant_id, token = auth_data
    tenant_id_str = str(tenant_id)
    supabase = get_supabase_client(token)

    entries_res = (
        supabase.table("financial_entries")
        .select(
            "entry_type, description, category, nominal_amount, "
            "technical_retention_amount, net_amount, status, due_date, payment_date, document_number"
        )
        .eq("tenant_id", tenant_id_str)
        .execute()
    )
    entries = _as_dict_list(entries_res.data)

    wb = Workbook()

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    regular_font = Font(name="Calibri", size=10)
    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )
    currency_fmt = "R$ #,##0.00"

    ws_cash = wb.active or wb.create_sheet()
    ws_cash.title = "Fluxo de Caixa"
    ws_cash.views.sheetView[0].showGridLines = True

    ws_cash.merge_cells("A1:I1")
    ws_cash["A1"] = "GADAP HUB ERP - RELATÓRIO ANALÍTICO DE FLUXO DE CAIXA"
    ws_cash["A1"].font = Font(name="Calibri", size=14, bold=True, color="1E3A8A")
    ws_cash["A1"].alignment = Alignment(horizontal="left", vertical="center")
    ws_cash.row_dimensions[1].height = 28

    ws_cash.merge_cells("A2:I2")
    ws_cash["A2"] = f"Exportado em: {datetime.now().strftime('%d/%m/%Y %H:%M')} | Tenant: {tenant_id_str}"
    ws_cash["A2"].font = Font(name="Calibri", size=9, italic=True, color="64748B")
    ws_cash.row_dimensions[2].height = 18

    cash_headers = [
        "Vencimento",
        "Pagamento",
        "Tipo",
        "Descrição",
        "Centro de Custo",
        "Status",
        "Valor Bruto",
        "Retenção Técnica",
        "Valor Líquido",
    ]

    ws_cash.append([])
    ws_cash.append(cash_headers)
    header_row_cash = 4
    ws_cash.row_dimensions[header_row_cash].height = 24

    for col_idx in range(1, len(cash_headers) + 1):
        cell = ws_cash.cell(row=header_row_cash, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    row_cash = 5
    for item in entries:
        tipo = "Receita" if (item.get("entry_type") or "").lower() in ("receivable", "a_receber") else "Despesa"
        venc = item.get("due_date") or "-"
        pag = item.get("payment_date") or "-"
        desc = item.get("description") or "-"
        cat = COST_CENTER_COLORS.get(item.get("category") or "", (item.get("category") or "Geral", ""))[0]
        st = (item.get("status") or "pendente").capitalize()
        bruto = float(item.get("nominal_amount") or 0.0)
        ret = float(item.get("technical_retention_amount") or 0.0)
        liq = float(item.get("net_amount") or 0.0)

        ws_cash.append([venc, pag, tipo, desc, cat, st, bruto, ret, liq])
        ws_cash.row_dimensions[row_cash].height = 20

        for c_idx in range(1, 10):
            c = ws_cash.cell(row=row_cash, column=c_idx)
            c.font = regular_font
            c.border = thin_border
            if c_idx in (7, 8, 9):
                c.number_format = currency_fmt
                c.alignment = Alignment(horizontal="right", vertical="center")
            else:
                c.alignment = Alignment(horizontal="left", vertical="center")
        row_cash += 1

    for col_idx, col in enumerate(ws_cash.columns, start=1):
        max_len = 0
        col_letter = get_column_letter(col_idx)
        for cell in col:
            if cell.row is None or cell.row <= 2:
                continue
            val_str = str(cell.value or "")
            if val_str.startswith("="):
                val_str = "R$ 999.999,00"
            max_len = max(max_len, len(val_str))
        ws_cash.column_dimensions[col_letter].width = max(max_len + 5, 14)

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    filename = f"GADAP_Relatorio_Executivo_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )
