"""
=============================================================================
GADAP Hub - Gerador de PDF "Mapa Comparativo de Cotação" (Prompts 84 & 87)
Módulo: api/app/services/quotation_map_pdf_generator.py
=============================================================================
Gera em memória o PDF oficial do Mapa de Cotação de Engenharia para envio ao
Cliente via WhatsApp (Evolution API), contendo:
  - Cabeçalho com identidade da Construtora (Tenant) e código sequencial (MAPA-001-LORENA)
  - Etiqueta da Matriz de Responsabilidade (CONSTRUCTOR, CLIENT_DIRECT, CLIENT_REIMBURSEMENT)
  - [PROMPT 87] Agrupamento de Insumos por Categoria (ex: Categoria: ELÉTRICA, HIDRÁULICA, CIVIL)
    com SUBTOTAL por categoria antes do TOTAL GERAL da cotação
  - Comparativo Lado a Lado dos Fornecedores A, B e C (Preço, Prazo, Condição)
  - "SELO DE RECOMENDAÇÃO DA ENGENHARIA" na cotação com is_winner = True + justification
=============================================================================
"""

from collections import defaultdict
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
    def _extract_grouped_items(
        cls, request_data: Dict[str, Any], quotes_list: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Agrupa os insumos por família (`category`: ELÉTRICA, HIDRÁULICA, CIVIL, MARCENARIA, etc.)
        para renderizar cabeçalhos separadores e SUBTOTAIS por categoria antes do TOTAL GERAL.
        """
        raw_items: List[Dict[str, Any]] = []
        if isinstance(request_data.get("categorized_items"), list) and request_data["categorized_items"]:
            raw_items = list(request_data["categorized_items"])
        else:
            winner = next((q for q in quotes_list if q.get("is_winner")), quotes_list[0] if quotes_list else {})
            if isinstance(winner.get("categorized_items"), list) and winner["categorized_items"]:
                raw_items = list(winner["categorized_items"])
            else:
                cat = str(request_data.get("category") or winner.get("category") or "CIVIL").upper()
                total_val = float(winner.get("total_amount") or winner.get("total_price") or 0)
                unit_val = float(winner.get("unit_price") or total_val)
                raw_items = [
                    {
                        "description": request_data.get("items_description") or "Insumos da Requisição",
                        "category": cat,
                        "quantity": 1,
                        "unit": "LOTE",
                        "unit_price": unit_val,
                        "subtotal": total_val,
                    }
                ]

        grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for item in raw_items:
            cat_name = str(item.get("category") or "CIVIL").upper()
            grouped[cat_name].append(item)
        return dict(grouped)

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
        cat_header_style = ParagraphStyle(
            "CategoryHeader",
            parent=styles["Normal"],
            fontSize=9,
            leading=12,
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

        map_code = request_data.get("map_code") or f"MAPA-001-LORENA"
        req_number = request_data.get("request_number") or str(request_data.get("id", "1042"))[:6].upper()
        responsibility = str(request_data.get("responsibility") or "CONSTRUCTOR").upper()

        # 1. Cabeçalho Executivo
        story.append(
            Paragraph(f"MAPA COMPARATIVO DE COTAÇÃO — {map_code} (REQ #{req_number})", title_style)
        )
        story.append(
            Paragraph(
                f"Emitido por: <b>{company_name}</b> • Data: {datetime.datetime.now().strftime('%d/%m/%Y %H:%M')}",
                subtitle_style,
            )
        )
        story.append(Spacer(1, 10))

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

        # 3. [PROMPT 87] Memorial Agrupado por Categoria (Curva ABC) com Subtotais e Total Geral
        story.append(
            Paragraph(
                "MEMORIAL DE INSUMOS AGRUPADOS POR CATEGORIA (SUBTOTAIS POR FAMÍLIA)",
                section_style,
            )
        )
        story.append(Spacer(1, 6))

        grouped_items = cls._extract_grouped_items(request_data, quotes_list)
        cat_rows = [
            [
                Paragraph("DESCRIÇÃO DO INSUMO / SERVIÇO", cell_header),
                Paragraph("QTD / UNID.", cell_header),
                Paragraph("PREÇO UNIT.", cell_header),
                Paragraph("SUBTOTAL ITEM", cell_header),
            ]
        ]
        cat_styles: List[Any] = [
            ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#cbd5e1")),
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#f1f5f9")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]

        grand_total = Decimal("0.00")
        row_cursor = 1

        for category_name, items in grouped_items.items():
            # Linha Separadora de Cabeçalho da Categoria (Ex: "Categoria: ELÉTRICA")
            cat_rows.append(
                [
                    Paragraph(f"Categoria: {category_name}", cat_header_style),
                    Paragraph("", cell_body),
                    Paragraph("", cell_body),
                    Paragraph("", cell_body),
                ]
            )
            cat_styles.append(("SPAN", (0, row_cursor), (-1, row_cursor)))
            cat_styles.append(("BACKGROUND", (0, row_cursor), (-1, row_cursor), HexColor("#e2e8f0")))
            row_cursor += 1

            category_subtotal = Decimal("0.00")
            for it in items:
                qty = Decimal(str(it.get("quantity") or 1))
                unit = str(it.get("unit") or "UN")
                u_price = Decimal(str(it.get("unit_price") or 0))
                sub = Decimal(str(it.get("subtotal") or (qty * u_price)))
                category_subtotal += sub

                cat_rows.append(
                    [
                        Paragraph(str(it.get("description") or "Insumo"), cell_body),
                        Paragraph(f"{qty} {unit}", cell_body),
                        Paragraph(cls._format_brl(u_price), cell_body),
                        Paragraph(cls._format_brl(sub), cell_body),
                    ]
                )
                row_cursor += 1

            grand_total += category_subtotal

            # Linha de SUBTOTAL DA CATEGORIA
            cat_rows.append(
                [
                    Paragraph(f"<b>SUBTOTAL — {category_name}</b>", cell_header),
                    Paragraph("", cell_body),
                    Paragraph("", cell_body),
                    Paragraph(f"<b>{cls._format_brl(category_subtotal)}</b>", cell_winner),
                ]
            )
            cat_styles.append(("SPAN", (0, row_cursor), (2, row_cursor)))
            cat_styles.append(("BACKGROUND", (0, row_cursor), (-1, row_cursor), HexColor("#f8fafc")))
            row_cursor += 1

        # Linha de TOTAL GERAL DA COTAÇÃO
        cat_rows.append(
            [
                Paragraph("<b>TOTAL GERAL CONSOLIDADO DA COTAÇÃO</b>", cat_header_style),
                Paragraph("", cell_body),
                Paragraph("", cell_body),
                Paragraph(f"<b>{cls._format_brl(grand_total)}</b>", cell_winner),
            ]
        )
        cat_styles.append(("SPAN", (0, row_cursor), (2, row_cursor)))
        cat_styles.append(("BACKGROUND", (0, row_cursor), (-1, row_cursor), HexColor("#ecfdf5")))

        t_categorized = Table(cat_rows, colWidths=[260, 75, 90, 95])
        t_categorized.setStyle(TableStyle(cat_styles))
        story.append(t_categorized)
        story.append(Spacer(1, 14))

        # 4. Tabela Comparativa de Fornecedores (A, B, C)
        story.append(
            Paragraph("QUADRO COMPARATIVO DE PROPOSTAS (FORNECEDORES A, B e C)", section_style)
        )
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
                "Melhor relação custo-benefício e prazo"
                if is_win
                else "Proposta em análise comparativa"
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
        table_styles: List[Any] = [
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
        story.append(Spacer(1, 14))

        # 5. Caixa de Destaque do Selo de Recomendação da Engenharia
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
                            f'Justificativa da Engenharia: <i>"{win_just}"</i>',
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
