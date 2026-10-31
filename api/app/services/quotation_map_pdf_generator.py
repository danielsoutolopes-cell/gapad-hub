"""
=============================================================================
GADAP Hub - Gerador de PDF "Mapa Comparativo de Cotação" (Prompt 84)
Módulo: api/app/services/quotation_map_pdf_generator.py
=============================================================================
Gera em memória o PDF oficial do Mapa de Cotação de Engenharia para envio ao
Cliente via WhatsApp (Evolution API), contendo:
  - Cabeçalho com identidade da Construtora (Tenant) e dados da Obra/Cliente
  - Etiqueta da Matriz de Responsabilidade (CONSTRUCTOR, CLIENT_DIRECT, CLIENT_REIMBURSEMENT)
  - Comparativo Lado a Lado dos Fornecedores A, B e C (Preço, Prazo, Condição)
  - "SELO DE RECOMENDAÇÃO DA ENGENHARIA" na cotação com is_winner = True + justification
=============================================================================
"""

import datetime
import io
from decimal import Decimal
from typing import Any, Dict, List, Optional

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


class QuotationMapPdfGenerator:
    """Gerador determinístico em memória do PDF 'Mapa Comparativo de Cotação de Engenharia'."""

    @staticmethod
    def _format_brl(value: Any) -> str:
        try:
            dec = Decimal(str(value or 0))
            formatted = f"{dec:,.2f}"
            return "R$ " + formatted.replace(",", "X").replace(".", ",").replace("X", ".")
        except Exception:
            return "R$ 0,00"

    @staticmethod
    def _responsibility_label(resp_code: str) -> str:
        code = (resp_code or "CONSTRUCTOR").upper()
        if code == "CLIENT_DIRECT":
            return "FATURAMENTO DIRETO NO CPF/CNPJ DO CLIENTE (CLIENT_DIRECT)"
        if code == "CLIENT_REIMBURSEMENT":
            return "COMPRA PELA CONSTRUTORA COM REEMBOLSO DO CLIENTE (CLIENT_REIMBURSEMENT)"
        return "CUSTO PRÓPRIO DA CONSTRUTORA (CONSTRUCTOR)"

    @classmethod
    def generate_map_pdf(
        cls,
        request_data: Dict[str, Any],
        quotes_list: List[Dict[str, Any]],
        company_data: Optional[Dict[str, Any]] = None,
        project_data: Optional[Dict[str, Any]] = None,
    ) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "MapTitle",
            parent=styles["Heading1"],
            fontSize=14,
            leading=18,
            textColor=HexColor("#0f172a"),
            fontName="Helvetica-Bold",
        )
        subtitle_style = ParagraphStyle(
            "MapSubtitle",
            parent=styles["Normal"],
            fontSize=9,
            leading=12,
            textColor=HexColor("#475569"),
            fontName="Helvetica",
        )
        section_style = ParagraphStyle(
            "SectionHeader",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            textColor=HexColor("#0f172a"),
            fontName="Helvetica-Bold",
        )
        cell_header = ParagraphStyle(
            "CellHeader",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
            textColor=HexColor("#334155"),
            fontName="Helvetica-Bold",
        )
        cell_body = ParagraphStyle(
            "CellBody",
            parent=styles["Normal"],
            fontSize=8.5,
            leading=11,
            textColor=HexColor("#0f172a"),
            fontName="Helvetica",
        )
        cell_winner = ParagraphStyle(
            "CellWinner",
            parent=styles["Normal"],
            fontSize=8.5,
            leading=11,
            textColor=HexColor("#065f46"),
            fontName="Helvetica-Bold",
        )
        badge_style = ParagraphStyle(
            "WinnerBadge",
            parent=styles["Normal"],
            fontSize=9.5,
            leading=13,
            textColor=HexColor("#065f46"),
            fontName="Helvetica-Bold",
        )

        story = []
        company = company_data or {}
        project = project_data or {}
        client_obj = project.get("clients") or project.get("client") or {}

        company_name = (
            company.get("legal_name")
            or company.get("trade_name")
            or "GADAP ENGENHARIA & SUPRIMENTOS LTDA"
        )
        project_name = project.get("name") or request_data.get("project_name") or "Obra / Canteiro"
        client_name = client_obj.get("name") or "Cliente Proprietário"
        client_doc = client_obj.get("document") or "Conforme Contrato"

        req_number = request_data.get("request_number") or str(request_data.get("id", "1042"))[:6].upper()
        items_desc = (
            request_data.get("items_description")
            or request_data.get("notes")
            or "Insumos e Materiais de Engenharia"
        )
        responsibility = str(request_data.get("responsibility") or "CONSTRUCTOR").upper()

        # 1. Cabeçalho Executivo
        story.append(Paragraph(f"MAPA COMPARATIVO DE COTAÇÃO — REQ #{req_number}", title_style))
        story.append(
            Paragraph(
                f"Emitido por: <b>{company_name}</b> • Data: {datetime.datetime.now().strftime('%d/%m/%Y %H:%M')}",
                subtitle_style,
            )
        )
        story.append(Spacer(1, 12))

        # 2. Quadro de Identificação e Matriz de Responsabilidade
        meta_grid = [
            [
                Paragraph("OBRA / EMPREENDIMENTO", cell_header),
                Paragraph("CLIENTE / TOMADOR", cell_header),
                Paragraph("MATRIZ DE RESPONSABILIDADE", cell_header),
            ],
            [
                Paragraph(f"<b>{project_name}</b>", cell_body),
                Paragraph(f"{client_name}<br/>Doc: {client_doc}", cell_body),
                Paragraph(f"<b>{cls._responsibility_label(responsibility)}</b>", cell_winner),
            ],
        ]
        t_meta = Table(meta_grid, colWidths=[160, 160, 200])
        t_meta.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#cbd5e1")),
                    ("BACKGROUND", (0, 0), (-1, 0), HexColor("#f8fafc")),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(t_meta)
        story.append(Spacer(1, 12))

        story.append(Paragraph("ESPECIFICAÇÃO TÉCNICA DOS INSUMOS COTADOS", section_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph(items_desc, cell_body))
        story.append(Spacer(1, 14))

        # 3. Tabela Comparativa de Fornecedores (A, B, C)
        story.append(Paragraph("QUADRO COMPARATIVO DE PROPOSTAS (FORNECEDORES A, B e C)", section_style))
        story.append(Spacer(1, 6))

        rows = [
            [
                Paragraph("FORNECEDOR", cell_header),
                Paragraph("VALOR TOTAL", cell_header),
                Paragraph("PRAZO ENTREGA", cell_header),
                Paragraph("CONDIÇÃO PAGTO", cell_header),
                Paragraph("PARECER DA ENGENHARIA", cell_header),
            ]
        ]

        winner_quote: Optional[Dict[str, Any]] = None
        for idx, q in enumerate(quotes_list):
            is_win = bool(q.get("is_winner"))
            if is_win:
                winner_quote = q

            sup_name = q.get("supplier_name") or f"Fornecedor {chr(65 + idx)}"
            total_val = q.get("total_amount") or q.get("total_price") or 0
            deliv_days = q.get("delivery_days") or 3
            pay_terms = q.get("payment_terms") or "28 DDL / Faturado"
            justif = q.get("justification") or (
                "Melhor relação custo-benefício e prazo" if is_win else "Proposta em análise comparativa"
            )

            style_used = cell_winner if is_win else cell_body
            seal_prefix = "★ [SELO DE RECOMENDAÇÃO] " if is_win else ""

            rows.append(
                [
                    Paragraph(f"{seal_prefix}{sup_name}", style_used),
                    Paragraph(cls._format_brl(total_val), style_used),
                    Paragraph(f"{deliv_days} dias úteis", style_used),
                    Paragraph(str(pay_terms), style_used),
                    Paragraph(str(justif), style_used),
                ]
            )

        t_quotes = Table(rows, colWidths=[145, 85, 75, 80, 135])
        table_styles = [
            ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#cbd5e1")),
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#f1f5f9")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]
        for idx, q in enumerate(quotes_list, start=1):
            if q.get("is_winner"):
                table_styles.append(("BACKGROUND", (0, idx), (-1, idx), HexColor("#ecfdf5")))
                table_styles.append(("BOX", (0, idx), (-1, idx), 1.2, HexColor("#10b981")))

        t_quotes.setStyle(TableStyle(table_styles))
        story.append(t_quotes)
        story.append(Spacer(1, 16))

        # 4. Caixa de Destaque do Selo de Recomendação da Engenharia
        if winner_quote:
            win_name = winner_quote.get("supplier_name") or "Fornecedor Vencedor"
            win_total = cls._format_brl(
                winner_quote.get("total_amount") or winner_quote.get("total_price") or 0
            )
            win_just = (
                winner_quote.get("justification")
                or "Menor prazo de entrega e conformidade integral com o projeto executivo."
            )
            seal_box = Table(
                [
                    [
                        Paragraph(
                            f"★ SELO DE RECOMENDAÇÃO TÉCNICA DA ENGENHARIA ★<br/>"
                            f"Fornecedor Recomendado: <b>{win_name}</b> • Valor Final: <b>{win_total}</b><br/>"
                            f"Justificativa da Engenharia: <i>\"{win_just}\"</i>",
                            badge_style,
                        )
                    ]
                ],
                colWidths=[520],
            )
            seal_box.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#d1fae5")),
                        ("BOX", (0, 0), (-1, -1), 1.5, HexColor("#059669")),
                        ("TOPPADDING", (0, 0), (-1, -1), 10),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                        ("LEFTPADDING", (0, 0), (-1, -1), 12),
                    ]
                )
            )
            story.append(seal_box)

        doc.build(story)
        return buffer.getvalue()

