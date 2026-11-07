"""
=============================================================================
GADAP Hub - Gerador de PDF "Autorização de Faturamento Direto" (Prompt 98)
Módulo: api/app/services/direct_billing_auth_pdf_generator.py
=============================================================================
Gera em memória o documento jurídico oficial de "Autorização de Faturamento Direto",
contendo:
  - Cabeçalho com identidade visual da Construtora (Tenant)
  - Identificação completa do Cliente (Pagador / CNPJ / Razão Social / Endereço)
  - Identificação do Fornecedor Comercial (Vendedor / CNPJ / Razão Social)
  - Identificação do Comprador do ERP (User responsável pela homologação da OC)
  - Discriminação dos itens, quantidades e valores autorizados
  - Cláusula jurídica de responsabilidade direta de pagamento pelo cliente
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


class DirectBillingAuthPdfGenerator:
    """Gerador determinístico em memória do documento jurídico de Autorização de Faturamento Direto."""

    @staticmethod
    def _format_brl(value: Any) -> str:
        try:
            dec = Decimal(str(value or 0))
            formatted = f"{dec:,.2f}"
            return "R$ " + formatted.replace(",", "X").replace(".", ",").replace("X", ".")
        except Exception:
            return "R$ 0,00"

    @classmethod
    def generate_pdf(
        cls,
        order_data: Dict[str, Any],
        client_data: Dict[str, Any],
        supplier_data: Dict[str, Any],
        buyer_data: Dict[str, Any],
        items: List[Dict[str, Any]],
        company_data: Optional[Dict[str, Any]] = None,
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
            "AuthDocTitle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=18,
            textColor=HexColor("#0f172a"),
            alignment=1,  # Centralizado
        )

        subtitle_style = ParagraphStyle(
            "AuthDocSubtitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=HexColor("#059669"),
            alignment=1,
        )

        section_heading = ParagraphStyle(
            "AuthDocSectionHeading",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=HexColor("#1e293b"),
            spaceBefore=8,
            spaceAfter=4,
        )

        body_style = ParagraphStyle(
            "AuthDocBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=12,
            textColor=HexColor("#334155"),
        )

        legal_notice_style = ParagraphStyle(
            "AuthDocLegal",
            parent=styles["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=8,
            leading=11,
            textColor=HexColor("#475569"),
        )

        story = []

        # Cabeçalho Construtora
        company_name = (company_data or {}).get("name") or "GADAP CONSTRUÇÕES & ENGENHARIA LTDA"
        company_cnpj = (company_data or {}).get("document") or "12.345.678/0001-90"
        order_num = order_data.get("order_number") or order_data.get("id", "OC-2026-DIR")[:12].upper()

        header_table = Table(
            [
                [
                    Paragraph(f"<b>{company_name}</b><br/>CNPJ: {company_cnpj}<br/>Sistema Integrado de Suprimentos (ERP GADAP)", body_style),
                    Paragraph(f"<b>AUTORIZAÇÃO DE FATURAMENTO DIRETO</b><br/><b>Ref: OC #{order_num}</b><br/>Data: {datetime.date.today().strftime('%d/%m/%Y')}", ParagraphStyle("HRight", parent=body_style, alignment=2)),
                ]
            ],
            colWidths=[320, 202],
        )
        header_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LINEBELOW", (0, 0), (-1, -1), 1.5, HexColor("#0f172a")),
            ])
        )
        story.append(header_table)
        story.append(Spacer(1, 14))

        # Título do Instrumento Jurídico
        story.append(Paragraph("INSTRUMENTO DE AUTORIZAÇÃO FORMAL DE FATURAMENTO COMERCIAL", title_style))
        story.append(Paragraph("MODALIDADE CLIENT_DIRECT • FATURAMENTO EXCLUSIVO NO CNPJ/CPF DO CLIENTE", subtitle_style))
        story.append(Spacer(1, 12))

        # Partes Envolvidas (3 Blocos: Cliente Pagador, Fornecedor Vendedor, Comprador Responsável)
        client_name = client_data.get("name") or "CLIENTE NÃO INFORMADO"
        client_doc = client_data.get("document") or client_data.get("cnpj") or "00.000.000/0000-00"
        client_proj = client_data.get("project_name") or order_data.get("project_name") or "Obra Residencial"

        supplier_name = supplier_data.get("name") or "FORNECEDOR HOMOLOGADO"
        supplier_doc = supplier_data.get("document") or supplier_data.get("cnpj") or "00.000.000/0000-00"
        supplier_contact = supplier_data.get("contact") or supplier_data.get("phone") or "Comercial"

        buyer_name = buyer_data.get("name") or "Comprador de Suprimentos"
        buyer_email = buyer_data.get("email") or "suprimentos@gadap.com.br"
        buyer_role = buyer_data.get("role") or "Especialista em Procurement / ERP"

        parties_data = [
            [
                Paragraph("<b>1. DADOS DO CLIENTE (PAGADOR / NOTA FISCAL):</b>", section_heading),
                Paragraph("<b>2. FORNECEDOR AUTORIZADO (EMISSOR):</b>", section_heading),
            ],
            [
                Paragraph(f"<b>Razão Social:</b> {client_name}<br/><b>CNPJ/CPF:</b> {client_doc}<br/><b>Empreendimento:</b> {client_proj}", body_style),
                Paragraph(f"<b>Razão Social:</b> {supplier_name}<br/><b>CNPJ:</b> {supplier_doc}<br/><b>Contato:</b> {supplier_contact}", body_style),
            ],
            [
                Paragraph("<b>3. COMPRADOR RESPONSÁVEL (ERP GADAP):</b>", section_heading),
                Paragraph("<b>4. CONDIÇÕES COMERCIAIS:</b>", section_heading),
            ],
            [
                Paragraph(f"<b>Nome:</b> {buyer_name}<br/><b>Cargo:</b> {buyer_role}<br/><b>E-mail:</b> {buyer_email}", body_style),
                Paragraph(f"<b>Prazo Pagto:</b> {order_data.get('payment_terms', '28 DDL')}<br/><b>Local Entrega:</b> Canteiro da Obra<br/><b>Frete:</b> CIF (Incluso)", body_style),
            ],
        ]

        parties_table = Table(parties_data, colWidths=[261, 261])
        parties_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (-1, 0), HexColor("#f8fafc")),
                ("BACKGROUND", (0, 2), (-1, 2), HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#e2e8f0")),
                ("PADDING", (0, 0), (-1, -1), 6),
            ])
        )
        story.append(parties_table)
        story.append(Spacer(1, 12))

        # Tabela de Itens e Valores Autorizados
        story.append(Paragraph("<b>5. DISCRIMINAÇÃO DOS INSUMOS E VALORES AUTORIZADOS:</b>", section_heading))
        items_table_data = [
            [
                Paragraph("<b>Item / Descrição</b>", body_style),
                Paragraph("<b>Unid.</b>", body_style),
                Paragraph("<b>Qtd.</b>", body_style),
                Paragraph("<b>Preço Unit.</b>", body_style),
                Paragraph("<b>Total (R$)</b>", body_style),
            ]
        ]

        total_amount = Decimal("0.00")
        for it in items:
            q = Decimal(str(it.get("quantity") or 1))
            pu = Decimal(str(it.get("unit_price") or it.get("subtotal") or 0))
            tot = q * pu
            total_amount += tot
            items_table_data.append([
                Paragraph(str(it.get("description") or "Material de Construção"), body_style),
                Paragraph(str(it.get("unit") or "UN"), body_style),
                Paragraph(f"{q:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."), body_style),
                Paragraph(cls._format_brl(pu), body_style),
                Paragraph(cls._format_brl(tot), body_style),
            ])

        # Linha Total
        items_table_data.append([
            Paragraph("<b>TOTAL GERAL AUTORIZADO PARA FATURAMENTO</b>", body_style),
            Paragraph("", body_style),
            Paragraph("", body_style),
            Paragraph("", body_style),
            Paragraph(f"<b>{cls._format_brl(total_amount)}</b>", ParagraphStyle("TotB", parent=body_style, textColor=HexColor("#059669"))),
        ])

        items_table = Table(items_table_data, colWidths=[242, 45, 55, 90, 90])
        items_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), HexColor("#0f172a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#ffffff")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#cbd5e1")),
                ("BACKGROUND", (0, -1), (-1, -1), HexColor("#f1f5f9")),
                ("PADDING", (0, 0), (-1, -1), 5),
            ])
        )
        story.append(items_table)
        story.append(Spacer(1, 14))

        # Cláusula Jurídica de Responsabilidade e Bypass
        legal_text = (
            "<b>CLÁUSULA DE EMISSÃO FISCAL E RESPONSABILIDADE FINANCEIRA:</b><br/>"
            "Fica o fornecedor qualificado acima expressamente autorizado a emitir a competente Nota Fiscal Eletrônica (NF-e) "
            f"e respectivos títulos de cobrança bancária (Boleto) diretamente contra o <b>CLIENTE PAGADOR ({client_name} - CNPJ/CPF: {client_doc})</b>. "
            "A construtora atua exclusivamente como mandatária de gestão técnica de compras e fiscalização de obra, "
            "não subsistindo qualquer corresponsabilidade cambial originária da construtora perante este faturamento.<br/>"
            "A mercadoria será recepcionada e conferida no canteiro de obras por meio do sistema digital (Goods Receipt PWA). "
            "Eventuais divergências físicas acarretarão compensação em saldo credor exclusivo para esta obra."
        )
        story.append(Paragraph(legal_text, legal_notice_style))
        story.append(Spacer(1, 18))

        # Assinaturas
        sig_data = [
            [
                Paragraph(f"__________________________________________<br/><b>{buyer_name}</b><br/>Comprador Responsável (ERP GADAP)", ParagraphStyle("Sig1", parent=body_style, alignment=1)),
                Paragraph(f"__________________________________________<br/><b>{company_name}</b><br/>Gestão de Suprimentos & Engenharia", ParagraphStyle("Sig2", parent=body_style, alignment=1)),
            ]
        ]
        sig_table = Table(sig_data, colWidths=[261, 261])
        sig_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story.append(sig_table)

        doc.build(story)
        return buffer.getvalue()

