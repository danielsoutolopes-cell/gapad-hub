"""
=============================================================================
GADAP Hub - Gerador de PDF "Termo de Aditivo Contratual" (Prompt 83)
Módulo: api/app/services/amendment_pdf_generator.py
=============================================================================
Responsável por gerar em memória o PDF com validade jurídica do Termo Aditivo
Contratual (Change Order), mesclando:
  - Identidade visual e dados cadastrais da Empresa (Logo/Cabeçalho do Tenant)
  - Dados da Obra (Nome, Código, CNO)
  - Dados do Contratante (Cliente) ou Contratado (Subempreiteiro)
  - Descrição técnica detalhada do serviço extra (Escopo)
  - Quadro financeiro (Valor Original, Valor do Aditivo e Novo Valor Consolidado)
  - Chancelas de Assinatura Eletrônica Avançada Gov.br (Lei 14.063/2020)
=============================================================================
"""

import datetime
import io
from decimal import Decimal
from typing import Any, Dict, Optional

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


class AmendmentPdfGenerator:
    """Gerador determinístico em memória do PDF 'Termo de Aditivo Contratual'."""

    @staticmethod
    def _format_brl(value: Any) -> str:
        try:
            dec = Decimal(str(value or 0))
            formatted = f"{dec:,.2f}"
            return "R$ " + formatted.replace(",", "X").replace(".", ",").replace("X", ".")
        except Exception:
            return "R$ 0,00"

    @classmethod
    def generate_amendment_pdf(
        cls,
        amendment_data: Dict[str, Any],
        company_data: Dict[str, Any],
        project_data: Dict[str, Any],
        counterparty_data: Optional[Dict[str, Any]] = None,
        previous_total: Decimal = Decimal("0.00"),
        new_total: Decimal = Decimal("0.00"),
    ) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=40,
            leftMargin=40,
            topMargin=40,
            bottomMargin=40,
        )

        styles = getSampleStyleSheet()
        brand_title = ParagraphStyle(
            "BrandTitle",
            parent=styles["Heading1"],
            fontSize=13,
            leading=16,
            textColor=HexColor("#065f46"),
            fontName="Helvetica-Bold",
        )
        doc_title = ParagraphStyle(
            "DocTitle",
            parent=styles["Heading1"],
            fontSize=14,
            leading=18,
            alignment=1,
            textColor=HexColor("#0f172a"),
            fontName="Helvetica-Bold",
        )
        subtitle_style = ParagraphStyle(
            "Subtitle",
            parent=styles["Normal"],
            fontSize=9,
            leading=12,
            alignment=1,
            textColor=HexColor("#475569"),
            fontName="Helvetica",
        )
        section_header = ParagraphStyle(
            "SectionHeader",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            textColor=HexColor("#0f172a"),
            fontName="Helvetica-Bold",
        )
        body_style = ParagraphStyle(
            "BodyTextCustom",
            parent=styles["Normal"],
            fontSize=9.5,
            leading=14,
            textColor=HexColor("#1e293b"),
            fontName="Helvetica",
        )
        cell_label = ParagraphStyle(
            "CellLabel",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
            textColor=HexColor("#64748b"),
            fontName="Helvetica-Bold",
        )
        cell_value = ParagraphStyle(
            "CellValue",
            parent=styles["Normal"],
            fontSize=9,
            leading=12,
            textColor=HexColor("#0f172a"),
            fontName="Helvetica-Bold",
        )

        story = []

        # 1. Cabeçalho Corporativo com Logo/Identidade do Tenant
        company_name = (
            company_data.get("legal_name")
            or company_data.get("trade_name")
            or "CONSTRUTORA & ENGENHARIA TENANT LTDA"
        )
        company_cnpj = company_data.get("cnpj") or "00.000.000/0001-00"
        company_logo_url = company_data.get("logo_url") or "Identidade Visual Oficial do Tenant"

        header_table_data = [
            [
                Paragraph(f"<b>[LOGO TENANT]</b><br/>{company_name}", brand_title),
                Paragraph(
                    f"<b>CNPJ:</b> {company_cnpj}<br/>"
                    f"<b>Logo / Identidade:</b> {company_logo_url[:45]}<br/>"
                    f"<b>Emissão:</b> {datetime.datetime.now().strftime('%d/%m/%Y %H:%M')}",
                    cell_label,
                ),
            ]
        ]
        header_table = Table(header_table_data, colWidths=[310, 205])
        header_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), HexColor("#f0fdf4")),
                    ("BOX", (0, 0), (-1, -1), 1, HexColor("#10b981")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                    ("LEFTPADDING", (0, 0), (-1, -1), 12),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ]
            )
        )
        story.append(header_table)
        story.append(Spacer(1, 16))

        # 2. Título Jurídico do Instrumento
        amendment_type = str(amendment_data.get("type", "CLIENT_EXTRA")).upper()
        type_label = (
            "ADITIVO AO CONTRATO PRINCIPAL DE EMPREITADA (CLIENTE / RECEITA)"
            if amendment_type == "CLIENT_EXTRA"
            else "ADITIVO DE SUBEMPREITADA E SERVIÇOS TERCEIRIZADOS (DESPESA)"
        )
        amendment_id_short = str(amendment_data.get("id", "0001"))[:8].upper()

        story.append(Paragraph(f"TERMO DE ADITIVO CONTRATUAL Nº {amendment_id_short}", doc_title))
        story.append(Paragraph(type_label, subtitle_style))
        story.append(Spacer(1, 14))

        # 3. Quadro de Identificação da Obra e das Partes Contratantes
        project_name = project_data.get("name") or "Obra / Retrofit"
        project_code = project_data.get("code") or "OBR-001"
        project_cno = project_data.get("cno") or "Não informado"

        counterparty = counterparty_data or {}
        party_role = "CLIENTE CONTRATANTE" if amendment_type == "CLIENT_EXTRA" else "SUBEMPREITEIRO CONTRATADO"
        party_name = (
            counterparty.get("name")
            or counterparty.get("trade_name")
            or ("Cliente Proprietário da Obra" if amendment_type == "CLIENT_EXTRA" else "Empresa Subcontratada")
        )
        party_doc = counterparty.get("document") or counterparty.get("cnpj") or "Conforme Contrato Principal"

        info_grid = [
            [
                Paragraph("EMPREENDIMENTO / OBRA", cell_label),
                Paragraph("CÓDIGO / CNO", cell_label),
                Paragraph("STATUS DO ADITIVO", cell_label),
            ],
            [
                Paragraph(project_name, cell_value),
                Paragraph(f"{project_code} • CNO: {project_cno}", cell_value),
                Paragraph(str(amendment_data.get("status", "APPROVED")), cell_value),
            ],
            [
                Paragraph(party_role, cell_label),
                Paragraph("DOCUMENTO (CNPJ / CPF)", cell_label),
                Paragraph("DATA DE REGISTRO", cell_label),
            ],
            [
                Paragraph(party_name, cell_value),
                Paragraph(party_doc, cell_value),
                Paragraph(datetime.date.today().strftime("%d/%m/%Y"), cell_value),
            ],
        ]
        t_info = Table(info_grid, colWidths=[215, 165, 135])
        t_info.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#cbd5e1")),
                    ("BACKGROUND", (0, 0), (-1, 0), HexColor("#f8fafc")),
                    ("BACKGROUND", (0, 2), (-1, 2), HexColor("#f8fafc")),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(t_info)
        story.append(Spacer(1, 16))

        # 4. Cláusula Primeira - Do Objeto e Escopo Técnico Adicional
        story.append(Paragraph("CLÁUSULA PRIMEIRA — DO OBJETO E ESCOPO DOS SERVIÇOS EXTRAS", section_header))
        story.append(Spacer(1, 6))
        description_text = str(amendment_data.get("description") or "Alteração de escopo técnico solicitada em obra.")
        story.append(
            Paragraph(
                f"Pelo presente instrumento particular de Termo Aditivo Contratual, as partes acima qualificadas "
                f"resolvem aditar o contrato originário vinculado à obra <b>{project_name}</b> para inclusão do "
                f"seguinte escopo técnico extraordinário (Change Order):<br/><br/>"
                f"<b>Descrição Detalhada do Serviço Extra:</b> {description_text}",
                body_style,
            )
        )
        story.append(Spacer(1, 14))

        # 5. Cláusula Segunda - Do Impacto Financeiro e Consolidação Orçamentária
        story.append(Paragraph("CLÁUSULA SEGUNDA — DO VALOR ADICIONAL E REEQUILÍBRIO FINANCEIRO", section_header))
        story.append(Spacer(1, 6))

        amount_dec = Decimal(str(amendment_data.get("amount") or 0))
        if new_total <= Decimal("0") and previous_total >= Decimal("0"):
            new_total = previous_total + amount_dec

        fin_grid = [
            [
                Paragraph("SALDO CONTRATUAL ANTERIOR", cell_label),
                Paragraph("VALOR DESTE ADITIVO (+)", cell_label),
                Paragraph("NOVO VALOR CONSOLIDADO", cell_label),
            ],
            [
                Paragraph(cls._format_brl(previous_total), cell_value),
                Paragraph(cls._format_brl(amount_dec), cell_value),
                Paragraph(cls._format_brl(new_total), cell_value),
            ],
        ]
        t_fin = Table(fin_grid, colWidths=[171, 172, 172])
        t_fin.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.75, HexColor("#10b981")),
                    ("BACKGROUND", (0, 0), (-1, 0), HexColor("#ecfdf5")),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ]
            )
        )
        story.append(t_fin)
        story.append(Spacer(1, 16))

        # 6. Cláusula Terceira - Ratificação e Assinatura Digital Gov.br / ICP-Brasil
        story.append(Paragraph("CLÁUSULA TERCEIRA — DA RATIFICAÇÃO E ASSINATURA ELETRÔNICA", section_header))
        story.append(Spacer(1, 6))
        govbr_tx = amendment_data.get("govbr_transaction_id") or "PENDENTE / ASSINATURA ELETRÔNICA GOV.BR"
        story.append(
            Paragraph(
                "Permanecem inalteradas e expressamente ratificadas todas as demais cláusulas, prazos e garantias "
                "do contrato principal que não tenham sido modificadas por este Termo Aditivo. Este documento possui "
                "plena validade jurídica nos termos da Lei Federal nº 14.063/2020 (Assinatura Eletrônica Avançada Gov.br) "
                f"e MP 2.200-2/2001 (ICP-Brasil). Protocolo Gov.br: <b>{govbr_tx}</b>.",
                body_style,
            )
        )
        story.append(Spacer(1, 32))

        sig_grid = [
            [
                Paragraph(f"__________________________________________<br/><b>{company_name}</b><br/>CNPJ: {company_cnpj}", body_style),
                Paragraph(f"__________________________________________<br/><b>{party_name}</b><br/>Doc: {party_doc}", body_style),
            ]
        ]
        t_sig = Table(sig_grid, colWidths=[257, 258])
        t_sig.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story.append(t_sig)

        doc.build(story)
        return buffer.getvalue()

