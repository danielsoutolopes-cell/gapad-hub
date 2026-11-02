#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GADAP Hub ERP — Gerador Oficial da "Bíblia do GADAP" v2.0 (Prompt 88)
=====================================================================
Gera o Manual Completo de Onboarding e Operação Enterprise (PDF + Markdown)
contemplando todas as evoluções das Fases 1 a 20, incluindo os 4 novos
módulos obrigatórios:
  1. Gestão de Aditivos (Change Orders)
  2. Portaria Digital e Termos de Logística
  3. Smart Procurement (OCR, IA e Categorização Curva ABC)
  4. Faturamento e Renovação PIX
"""

from __future__ import annotations

import datetime
from pathlib import Path
from typing import Any, Dict, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

MANUAL_VERSION = "2.0.0-ENTERPRISE"

# ==============================================================================
# CONTEÚDO ESTRUTURADO DA BÍBLIA DO GADAP V2.0
# ==============================================================================
BIBLE_MODULES: List[Dict[str, Any]] = [
    {
        "code": "MÓDULO 01",
        "title": "Gestão de Aditivos (Change Orders)",
        "subtitle": "Governança Contratual B2B, Extras de Cliente e Extras de Empreiteiros com Assinatura Gov.br",
        "summary": (
            "Controla qualquer alteração de escopo pós-assinatura do contrato principal, "
            "separando receitas extras cobradas do cliente final (CLIENT_EXTRA) de custos "
            "adicionais negociados com subempreiteiros (SUBCONTRACTOR_EXTRA)."
        ),
        "rules": [
            "CLIENT_EXTRA (Aditivo de Receita): Aumenta automaticamente o Valor do Contrato Principal (projects.contract_value) e gera parcela extra no Contas a Receber.",
            "SUBCONTRACTOR_EXTRA (Aditivo de Custo): Recalibra o teto do contrato de subempreita (subcontracts.total_contract_value) e agenda obrigação no Contas a Pagar.",
            "Assinatura Digital e WhatsApp: Todo aditivo gera um Termo PDF formal com hash de auditoria, link de assinatura Gov.br e disparo direto para o WhatsApp do cliente.",
            "Isolamento da Margem Real: Impede que extras de obra corroam silenciosamente o BDI e o lucro líquido previsto no orçamento original.",
        ],
    },
    {
        "code": "MÓDULO 02",
        "title": "Portaria Digital e Termos de Logística",
        "subtitle": "Rastreabilidade de Canteiro, Recebimento de Cargas e Termos para Motoristas (Lalamove/Uber/Transportadoras)",
        "summary": (
            "Blindagem operacional na entrada e saída de insumos e equipamentos no canteiro de obras. "
            "Garante conferência física com registro fotográfico e emissão instantânea de Termos de Responsabilidade Logística."
        ),
        "rules": [
            "Check-in de Entrega no Canteiro: O almoxarife ou mestre de obras confere a Nota Fiscal/Romaneio contra o Pedido de Compra aprovado.",
            "Termo para Transportadoras e App (Lalamove / Uber Flash / Freteiros): Gera PDF assinado na tela do celular atestando volumes, integridade da carga, placa do veículo e documento do condutor.",
            "Integração Automática com Estoque: O aceite sem ressalvas alimenta o saldo físico de inventory_items agrupado pela família do insumo.",
            "Bloqueio de Divergências: Entregas parciais ou avariadas geram alerta imediato para o comprador responsável antes da liberação financeira.",
        ],
    },
    {
        "code": "MÓDULO 03",
        "title": "Smart Procurement (OCR, IA e Categorização Curva ABC)",
        "subtitle": "Mapas Sequenciais por Obra, Trava Human-in-the-Loop, AI Advisor e Agrupamento por Família",
        "summary": (
            "Revoluciona o setor de suprimentos combinando extração omnichannel via LLM/Vision "
            "(PDFs, fotos de orçamentos e textos de WhatsApp) com rigorosa validação humana obrigatória "
            "e inteligência de custos em Curva ABC."
        ),
        "rules": [
            "Regra de Ouro Human-in-the-Loop (HITL): Nenhuma Inteligência Artificial grava valores diretamente no banco de dados. Toda leitura retorna em memória (Draft) e exige revisão e clique humano em 'Confirmar e Injetar na Matriz'.",
            "Mapas Sequenciais por Obra: Numeração automática padronizada (ex.: MAPA-001-LORENA) e Matriz de Responsabilidade Financeira (CONSTRUCTOR, CLIENT_DIRECT e CLIENT_REIMBURSEMENT com Contas a Pagar Duplo).",
            "Categorização Inteligente e Curva ABC: O motor LLM deduz automaticamente a família do insumo (ELÉTRICA, HIDRÁULICA, REVESTIMENTOS, ESTRUTURAL, MARCENARIA, CIVIL), agrupa o PDF do cliente com subtotais por categoria e alimenta o gráfico de Pareto (Classes A, B e C).",
            "AI Advisor e Comprinhas de Canteiro: Exibe o melhor preço histórico praticado de forma consultiva (não bloqueante) e permite registrar Compras Diretas de urgência com foto do cupom fiscal.",
        ],
    },
    {
        "code": "MÓDULO 04",
        "title": "Faturamento e Renovação PIX",
        "subtitle": "Gestão de Assinatura SaaS, Checkout Instantâneo via QR Code PIX e Governança PLG",
        "summary": (
            "Central de autoatendimento financeiro do Tenant para controle do plano contratado, "
            "renovação de benefícios comerciais (Founder / PLG) e liquidação instantânea via PIX integrado ao gateway."
        ),
        "rules": [
            "Renovação Instantânea via PIX: Geração dinâmica de QR Code PIX e código Copia-e-Cola com conciliação automática via Webhook em segundos.",
            "Desbloqueio Automático de Módulos: Assim que o pagamento é confirmado pelo gateway, o status da empresa (plan_status = active) e os módulos contratados são liberados sem intervenção manual.",
            "Gestão de Benefícios PLG: Controle transparente de vigência de descontos promocionais (renewal_count / max_renewals) e histórico auditável de faturas.",
            "Emissão Fiscal Nacional (NF-e / NFS-e / IVA Dual): Integração nativa com Certificado Digital A1 (mTLS), retenções técnicas (INSS/ISS/IRRF) e Simulador da Reforma Tributária (CBS + IBS).",
        ],
    },
]

FAQ_RAPIDO: List[Dict[str, str]] = [
    {
        "question": "1. Como aprovar uma cotação gerada pela Inteligência Artificial?",
        "answer": (
            "No módulo de Suprimentos (Matriz de Cotação), envie o PDF/Foto do orçamento ou cole o texto do WhatsApp "
            "e clique em 'Ler com IA (Revisão HITL)'. O sistema abrirá o Modal Obrigatório de Revisão Humana com os "
            "valores extraídos e a Categoria deduzida (ex.: ELÉTRICA ou REVESTIMENTOS) apenas em memória. Confira ou "
            "ajuste o fornecedor, preços e categoria, e clique em 'Confirmar e Injetar na Matriz'. Em seguida, marque a "
            "proposta vencedora com o Selo de Recomendação e clique em 'Aprovar Cotação Vencedora'."
        ),
    },
    {
        "question": "2. Como gerar um termo de recebimento de material para transportadoras (Lalamove/Uber)?",
        "answer": (
            "Acesse o módulo de Logística / Portaria Digital da obra ou a aba de Compras Diretas ('Comprinhas') em "
            "Suprimentos, selecione a entrega/pedido correspondente e clique em 'Gerar Termo de Recebimento / Logística'. "
            "Informe a placa/modal (Lalamove, Uber Flash ou Transportadora), anexe a foto da carga ou recibo no ato do "
            "descarregamento e gere o PDF assinado digitalmente para liberar o motorista com rastreabilidade completa."
        ),
    },
]


def generate_markdown_manual(output_md_path: Path) -> Path:
    """Gera a versão Markdown indexável da Bíblia do GADAP v2.0."""
    output_md_path.parent.mkdir(parents=True, exist_ok=True)
    today = datetime.date.today().strftime("%d/%m/%Y")

    lines: List[str] = [
        f"# 📘 BÍBLIA DO GADAP HUB ERP — Versão {MANUAL_VERSION}",
        f"**Data de Publicação:** {today}  ",
        "**Público-Alvo:** Diretores de Engenharia, Gestores de Suprimentos, Orçamentistas, Mestres de Obras e Analistas Financeiros.",
        "",
        "---",
        "",
        "## 🚀 Módulos Operacionais e Arquitetura Enterprise (Fases 1 a 20)",
        "",
    ]

    for mod in BIBLE_MODULES:
        lines.append(f"### {mod['code']} — {mod['title']}")
        lines.append(f"*{mod['subtitle']}*")
        lines.append("")
        lines.append(str(mod["summary"]))
        lines.append("")
        lines.append("**Regras de Negócio e Fluxo Operacional:**")
        for rule in mod["rules"]:
            lines.append(f"- {rule}")
        lines.append("")

    lines.extend(
        [
            "---",
            "",
            "## ⚡ FAQ Rápido de Canteiro & Operação",
            "",
        ]
    )

    for faq in FAQ_RAPIDO:
        lines.append(f"#### {faq['question']}")
        lines.append(faq["answer"])
        lines.append("")

    output_md_path.write_text("\n".join(lines), encoding="utf-8")
    return output_md_path


def generate_pdf_manual(output_pdf_path: Path) -> Path:
    """Gera o documento PDF executivo da Bíblia do GADAP v2.0 usando ReportLab."""
    output_pdf_path.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(output_pdf_path),
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"Bíblia do GADAP Hub v{MANUAL_VERSION}",
        author="GADAP Hub Engineering",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "BibleTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=17,
        leading=21,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "BibleSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#475569"),
        spaceAfter=10,
    )
    mod_title_style = ParagraphStyle(
        "ModTitle",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#047857"),
        spaceBefore=10,
        spaceAfter=2,
    )
    mod_sub_style = ParagraphStyle(
        "ModSub",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#334155"),
        spaceAfter=5,
    )
    body_style = ParagraphStyle(
        "BibleBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1E293B"),
        spaceAfter=4,
    )
    bullet_style = ParagraphStyle(
        "BibleBullet",
        parent=body_style,
        leftIndent=10,
        spaceAfter=3,
    )

    story = []
    today_str = datetime.date.today().strftime("%d/%m/%Y")

    story.append(Paragraph(f"BÍBLIA DO GADAP HUB ERP — VERSÃO {MANUAL_VERSION}", title_style))
    story.append(
        Paragraph(
            f"Manual Oficial de Onboarding, Governança de Obras, Smart Procurement e Compliance Fiscal • Atualizado em {today_str}",
            subtitle_style,
        )
    )
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1")))
    story.append(Spacer(1, 4 * mm))

    for mod in BIBLE_MODULES:
        story.append(Paragraph(f"{mod['code']} — {mod['title']}", mod_title_style))
        story.append(Paragraph(str(mod["subtitle"]), mod_sub_style))
        story.append(Paragraph(str(mod["summary"]), body_style))
        for rule in mod["rules"]:
            story.append(Paragraph(f"• {rule}", bullet_style))
        story.append(Spacer(1, 2.5 * mm))

    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#CBD5E1")))
    story.append(Paragraph("FAQ RÁPIDO DE OPERAÇÃO E CANTEIRO", mod_title_style))
    story.append(Spacer(1, 2 * mm))

    faq_rows = []
    for faq in FAQ_RAPIDO:
        faq_rows.append(
            [
                Paragraph(f"<b>{faq['question']}</b><br/>{faq['answer']}", body_style),
            ]
        )

    faq_table = Table(faq_rows, colWidths=[178 * mm])
    faq_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#CBD5E1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(faq_table)

    doc.build(story)
    return output_pdf_path


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    docs_dir = repo_root / "public" / "docs"
    md_path = generate_markdown_manual(docs_dir / "biblia_do_gadap_v2.md")
    pdf_path = generate_pdf_manual(docs_dir / "biblia_do_gadap_v2.pdf")
    print(f"[OK] Bíblia do GADAP v2.0 gerada com sucesso:")
    print(f"  - Markdown: {md_path}")
    print(f"  - PDF:      {pdf_path}")


if __name__ == "__main__":
    main()

