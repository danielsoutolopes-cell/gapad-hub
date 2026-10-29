"""
=============================================================================
GADAP Hub - Gerador de Laudos e Termos de Responsabilidade e Guarda em PDF
Arquivo: api/app/services/transfer_pdf_builder.py
=============================================================================
"""

import base64
import io
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    HRFlowable,
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

logger = logging.getLogger("gadap.transfers.pdf")


def build_transfer_term_pdf(
    transfer_type: str,
    project_name: str,
    tenant_name: str,
    carrier_name: str,
    carrier_document: str,
    license_plate: Optional[str],
    description: str,
    signature_base64: str,
    geolocation: Optional[Dict[str, Any]],
    created_at: datetime,
    logo_base64_or_path: Optional[str] = None,
) -> bytes:
    """
    Gera em memória (bytes) o Termo Formal de Responsabilidade e Guarda de Materiais
    utilizando a biblioteca ReportLab, com design corporativo, carimbo de GPS e assinatura digital.
    """
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

    # Estilos customizados
    title_style = ParagraphStyle(
        "TransferTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=colors.HexColor("#0f172a"),
        alignment=1,  # Centralizado
    )

    subtitle_style = ParagraphStyle(
        "TransferSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#059669"),
        alignment=1,
    )

    label_style = ParagraphStyle(
        "LabelStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#475569"),
    )

    value_style = ParagraphStyle(
        "ValueStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#0f172a"),
    )

    body_style = ParagraphStyle(
        "BodyStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1e293b"),
    )

    legal_style = ParagraphStyle(
        "LegalStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#64748b"),
        alignment=4,  # Justificado
    )

    elements = []

    # 1. Cabeçalho Corporativo com Logo e Título
    type_label = "TERMO DE RETIRADA E TRANSPORTE (SAÍDA)" if transfer_type == "WITHDRAWAL" else "TERMO DE RECEBIMENTO E CONFERÊNCIA (ENTRADA)"
    
    header_data = [
        [
            Paragraph(f"<b>GADAP HUB ERP</b><br/><font size=7 color='#64748b'>Logística & Portaria Digital</font>", label_style),
            Paragraph(f"<b>{tenant_name.upper()}</b><br/>{type_label}", subtitle_style),
            Paragraph(f"<b>Data:</b> {created_at.strftime('%d/%m/%Y %H:%M')}<br/><b>Status:</b> HOMOLOGADO", label_style),
        ]
    ]

    header_table = Table(header_data, colWidths=[130, 260, 130])
    header_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("PADDING", (0, 0), (-1, -1), 6),
        ])
    )
    elements.append(header_table)
    elements.append(Spacer(1, 12))

    # Título Principal
    elements.append(Paragraph(type_label, title_style))
    elements.append(Paragraph("DOCUMENTO DE CONTROLE DE CUSTÓDIA E MOVIMENTAÇÃO DE CARGA", subtitle_style))
    elements.append(Spacer(1, 12))

    # 2. Dados da Obra e do Transportador
    dados_grid = [
        [
            Paragraph("<b>OBRA / CANTEIRO:</b>", label_style),
            Paragraph(project_name, value_style),
            Paragraph("<b>PLACA DO VEÍCULO:</b>", label_style),
            Paragraph(license_plate or "Não informada", value_style),
        ],
        [
            Paragraph("<b>RESPONSÁVEL / MOTORISTA:</b>", label_style),
            Paragraph(carrier_name, value_style),
            Paragraph("<b>DOCUMENTO (CPF/RG):</b>", label_style),
            Paragraph(carrier_document, value_style),
        ],
    ]

    t_dados = Table(dados_grid, colWidths=[120, 180, 110, 110])
    t_dados.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("PADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])
    )
    elements.append(t_dados)
    elements.append(Spacer(1, 12))

    # 3. Discriminação dos Materiais / Carga
    elements.append(Paragraph("<b>DISCRIMINAÇÃO DOS MATERIAIS, INSUMOS OU EQUIPAMENTOS:</b>", label_style))
    elements.append(Spacer(1, 4))

    desc_table = Table([[Paragraph(description.replace("\n", "<br/>"), body_style)]], colWidths=[520])
    desc_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("PADDING", (0, 0), (-1, -1), 8),
            ("MINROWHEIGHT", (0, 0), (-1, -1), 80),
        ])
    )
    elements.append(desc_table)
    elements.append(Spacer(1, 12))

    # 4. Cláusula Legal de Responsabilidade e Guarda
    legal_text = (
        "O recebedor/portador identificado acima declara que conferiu e retirou/recebeu as mercadorias "
        "e insumos listados neste termo em perfeitas condições de uso, responsabilizando-se civil e criminalmente "
        "pela integridade, guarda e fiel entrega dos bens até a conclusão do transporte, de acordo com as diretrizes do "
        "Código Civil Brasileiro (Art. 627 a 652 - Do Depósito e Transporte) e normas de segurança do canteiro de obras."
    )
    elements.append(Paragraph(legal_text, legal_style))
    elements.append(Spacer(1, 12))

    # 5. Carimbo de Geolocalização GPS e Timestamp
    geo_str = "GPS Não registrado"
    if geolocation and geolocation.get("latitude"):
        lat = geolocation.get("latitude")
        lng = geolocation.get("longitude")
        acc = geolocation.get("accuracy", "0")
        geo_str = f"Lat: {lat:.6f} | Lng: {lng:.6f} | Precisão: ~{acc}m"

    geo_table_data = [
        [
            Paragraph("<b>CARIMBO DIGITAL DE AUTENTICIDADE:</b>", label_style),
            Paragraph(f"<b>Horário UTC:</b> {created_at.isoformat()}", value_style),
            Paragraph(f"<b>Coordenadas GPS:</b> {geo_str}", value_style),
        ]
    ]
    t_geo = Table(geo_table_data, colWidths=[150, 160, 210])
    t_geo.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ecfdf5")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#6ee7b7")),
            ("PADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])
    )
    elements.append(t_geo)
    elements.append(Spacer(1, 16))

    # 6. Assinatura em Tela (Touchscreen)
    signature_flowable = None
    if signature_base64 and signature_base64.startswith("data:image"):
        try:
            # Extrai os bytes da imagem PNG em Base64
            header_part, data_part = signature_base64.split(",", 1)
            sig_bytes = base64.b64decode(data_part)
            sig_stream = io.BytesIO(sig_bytes)
            signature_flowable = Image(sig_stream, width=160, height=60)
        except Exception as sig_err:
            logger.warning("Falha ao converter assinatura Base64 para Image: %s", sig_err)

    if not signature_flowable:
        signature_flowable = Paragraph("<i>[Assinado Digitalmente no Touchscreen]</i>", value_style)

    sig_grid = [
        [
            Paragraph(f"<b>{tenant_name}</b><br/><font size=7 color='#64748b'>Responsável pela Portaria / Canteiro</font>", label_style),
            Paragraph(f"<b>{carrier_name}</b><br/><font size=7 color='#64748b'>Assinatura do Motorista / Portador (Doc: {carrier_document})</font>", label_style),
        ],
        [
            Paragraph("__________________________________________<br/><font size=7 color='#059669'>Conferido via Sistema GADAP Hub</font>", value_style),
            signature_flowable,
        ],
    ]

    t_sig = Table(sig_grid, colWidths=[260, 260])
    t_sig.setStyle(
        TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 4),
        ])
    )
    elements.append(t_sig)

    # Constrói o PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
