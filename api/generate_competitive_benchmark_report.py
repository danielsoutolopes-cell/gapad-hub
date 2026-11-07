"""
=============================================================================
Script: Gerador de Benchmark Competitivo em PDF (GADAP Hub vs ERPs do Mercado)
Arquivo: api/generate_competitive_benchmark_report.py
=============================================================================
"""

import os
import sys
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

PDF_OUTPUT_PATH = r"C:\gadap_hub\benchmarking_competitivo_erp_construcao.pdf"

def generate_pdf():
    doc = SimpleDocTemplate(
        PDF_OUTPUT_PATH,
        pagesize=A4,
        rightMargin=1.2 * cm,
        leftMargin=1.2 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0F172A'),
        fontName='Helvetica-Bold',
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#64748B'),
        fontName='Helvetica',
        spaceAfter=12,
    )
    section_title = ParagraphStyle(
        'SecTitle',
        parent=styles['Heading2'],
        fontSize=12,
        leading=15,
        textColor=colors.HexColor('#1E293B'),
        fontName='Helvetica-Bold',
        spaceBefore=10,
        spaceAfter=5,
    )
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#334155'),
        fontName='Helvetica',
    )
    body_bold = ParagraphStyle(
        'DocBodyBold',
        parent=body_style,
        fontName='Helvetica-Bold',
    )
    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#1E293B'),
    )
    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=table_cell,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#0F172A'),
    )
    badge_green = ParagraphStyle(
        'BadgeGreen',
        parent=table_cell,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#059669'),
    )
    badge_red = ParagraphStyle(
        'BadgeRed',
        parent=table_cell,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#DC2626'),
    )
    badge_yellow = ParagraphStyle(
        'BadgeYellow',
        parent=table_cell,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#D97706'),
    )

    elements = []

    # 1. Cabeçalho Executivo
    elements.append(Paragraph("BENCHMARKING COMPETITIVO: ERPs PARA PEQUENAS E MÉDIAS CONSTRUTORAS", title_style))
    elements.append(Paragraph(
        f"Análise Comparativa de Recursos, Engenharia, Finanças e Inteligência Artificial &bull; Data: {datetime.now().strftime('%d/%m/%Y')}",
        subtitle_style,
    ))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#2563EB'), spaceAfter=10))

    # 2. Resumo Comparativo / Cards de Score
    summary_data = [
        [
            Paragraph("<b>GADAP Hub</b>", table_cell_bold),
            Paragraph("<b>Sienge (Softplan)</b>", table_cell_bold),
            Paragraph("<b>Mais Controle</b>", table_cell_bold),
            Paragraph("<b>Obra Prima</b>", table_cell_bold),
            Paragraph("<b>Mobra / Eva</b>", table_cell_bold),
        ],
        [
            Paragraph("<font size='11' color='#059669'><b>9.8 / 10</b></font><br/><font size='7' color='#64748B'>AI-Native & Obra</font>", table_cell),
            Paragraph("<font size='11' color='#2563EB'><b>8.2 / 10</b></font><br/><font size='7' color='#64748B'>Robusto / Legado</font>", table_cell),
            Paragraph("<font size='11' color='#D97706'><b>7.4 / 10</b></font><br/><font size='7' color='#64748B'>Foco Financeiro</font>", table_cell),
            Paragraph("<font size='11' color='#D97706'><b>7.1 / 10</b></font><br/><font size='7' color='#64748B'>Básico PME</font>", table_cell),
            Paragraph("<font size='11' color='#D97706'><b>6.8 / 10</b></font><br/><font size='7' color='#64748B'>Entrada</font>", table_cell),
        ]
    ]
    t_summary = Table(summary_data, colWidths=[3.7*cm, 3.7*cm, 3.7*cm, 3.7*cm, 3.7*cm])
    t_summary.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('PADDING', (0,0), (-1,-1), 5),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]))
    elements.append(t_summary)
    elements.append(Spacer(1, 10))

    # 3. Introdução ao Benchmark
    elements.append(Paragraph("1. Panorama de Soluções no Mercado Brasileiro", section_title))
    elements.append(Paragraph(
        "Pequenas e médias construtoras no Brasil frequentemente enfrentam o dilema entre contratar ferramentas tradicionais caras e "
        "complexas (como o Sienge) ou sistemas simplificados focados apenas em fluxo de caixa (como Mais Controle e Obra Prima). "
        "Abaixo estruturamos a matriz comparativa técnica que destaca as lacunas do mercado e a diferenciação tecnológica do <b>GADAP Hub</b>.",
        body_style,
    ))
    elements.append(Spacer(1, 8))

    # 4. Tabela de Matriz Comparativa Detalhada
    elements.append(Paragraph("2. Matriz Comparativa de Recursos e Diferenciais", section_title))

    matrix_data = [
        [
            Paragraph("Funcionalidade / Capacidade", table_cell_bold),
            Paragraph("GADAP Hub", table_cell_bold),
            Paragraph("Sienge", table_cell_bold),
            Paragraph("Mais Controle", table_cell_bold),
            Paragraph("Obra Prima", table_cell_bold),
        ],
        [
            Paragraph("<b>IA para WhatsApp (NLP Obra)</b><br/>Decodifica mensagens de áudio/texto de empreiteiros", table_cell),
            Paragraph("<b>NATIVO (Gemini/GPT)</b><br/>Extrai gírias e ajudantes", badge_green),
            Paragraph("Inexistente<br/>(Apenas anexos manuais)", badge_red),
            Paragraph("Inexistente<br/>(Sem IA integrada)", badge_red),
            Paragraph("Inexistente<br/>(Sem IA integrada)", badge_red),
        ],
        [
            Paragraph("<b>Motor Anti-Duplicidade de Extras</b><br/>Algoritmo 'Gato Escaldado' por similaridade", table_cell),
            Paragraph("<b>SIM (Automático)</b><br/>Alerta de risco em tempo real", badge_green),
            Paragraph("Não<br/>(Controle por ordem manual)", badge_red),
            Paragraph("Não<br/>(Verificação humana)", badge_red),
            Paragraph("Não<br/>(Verificação humana)", badge_red),
        ],
        [
            Paragraph("<b>Dicionário Histórico de Preços</b><br/>Compara com a média e alerta negociação", table_cell),
            Paragraph("<b>SIM (Contínuo)</b><br/>Aprendizado por obra", badge_green),
            Paragraph("Parcial<br/>(Tabela SINAPI / Insumos)", badge_yellow),
            Paragraph("Parcial<br/>(Histórico de compras)", badge_yellow),
            Paragraph("Não<br/>(Apenas orçamento inicial)", badge_red),
        ],
        [
            Paragraph("<b>Entregas Parciais & Saldo Credor</b><br/>Conta de Haveres sem travar pagamento da NF", table_cell),
            Paragraph("<b>SIM (Nativo PWA)</b><br/>Isolamento por Obra/Cliente", badge_green),
            Paragraph("Parcial<br/>(Exige processo contábil)", badge_yellow),
            Paragraph("Não<br/>(Gera divergência manual)", badge_red),
            Paragraph("Não<br/>(Gera divergência manual)", badge_red),
        ],
        [
            Paragraph("<b>3-Way Match Fiscal com Bypass</b><br/>Cruza SEFAZ XML vs PWA vs Pedido de Compra", table_cell),
            Paragraph("<b>SIM (Automático)</b><br/>Bypass faturamento direto", badge_green),
            Paragraph("Sim<br/>(Módulo fiscal adicional)", badge_yellow),
            Paragraph("Não<br/>(Importação básica)", badge_red),
            Paragraph("Não<br/>(Importação manual)", badge_red),
        ],
        [
            Paragraph("<b>Cronograma Físico WBS + Diário</b><br/>Gantt com atualização atômica de avanço e mão de obra", table_cell),
            Paragraph("<b>SIM (Transacional)</b><br/>Curva S dinâmica", badge_green),
            Paragraph("Sim<br/>(Módulo de Engenharia)", badge_green),
            Paragraph("Parcial<br/>(Gantt simplificado)", badge_yellow),
            Paragraph("Parcial<br/>(Diário desvinculado)", badge_yellow),
        ],
        [
            Paragraph("<b>Tempo Médio de Implantação</b><br/>Curva de aprendizado da equipe de campo e escritório", table_cell),
            Paragraph("<b>1 a 3 Dias</b><br/>UX moderna (Next.js)", badge_green),
            Paragraph("2 a 6 Meses<br/>(Consultoria obrigatória)", badge_red),
            Paragraph("2 a 4 Semanas<br/>(Onboarding guiado)", badge_yellow),
            Paragraph("1 a 2 Semanas<br/>(Vídeos e tutoriais)", badge_yellow),
        ],
        [
            Paragraph("<b>Custo Total de Propriedade (TCO)</b><br/>Licenciamento, implantação e manutenção", table_cell),
            Paragraph("<b>Baixo / Acessível</b><br/>Cloud-Native & Modular", badge_green),
            Paragraph("Muito Elevado<br/>(R$ 2.500+ / mês + setup)", badge_red),
            Paragraph("Médio<br/>(R$ 600 - R$ 1.200 / mês)", badge_yellow),
            Paragraph("Médio-Baixo<br/>(R$ 400 - R$ 800 / mês)", badge_green),
        ],
    ]

    t_matrix = Table(matrix_data, colWidths=[5.4*cm, 4.5*cm, 3.2*cm, 2.7*cm, 2.7*cm])
    t_matrix.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1E293B')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('PADDING', (0,0), (-1,-1), 4.5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(t_matrix)
    elements.append(Spacer(1, 12))

    # 5. Análise dos Concorrentes Chave
    elements.append(Paragraph("3. Análise Detalhada dos Players Competitivos", section_title))

    competitors = [
        ("Sienge (Softplan)", "Líder de mercado tradicional para médias e grandes construtoras.", [
            "<b>Pontos Fortes:</b> Máxima robustez contábil, integração bancária consolidada e aderência fiscal às normas brasileiras.",
            "<b>Gargalos Críticos:</b> Interface pesada e antiquada, custo proibitivo para pequenas empresas, implantação morosa (meses) e ausência de inteligência artificial generativa para campo.",
        ]),
        ("Mais Controle ERP", "Focado na gestão de custos e controle de pequenas e médias construtoras.", [
            "<b>Pontos Fortes:</b> Bom módulo orçamentário com tabelas de referência e controle financeiro simples.",
            "<b>Gargalos Críticos:</b> Não possui motor para captura de extras de WhatsApp, sem validação anti-duplicidade e relacionamento estático com subempreiteiros.",
        ]),
        ("Obra Prima", "Solução de entrada para pequenos construtores e reformas.", [
            "<b>Pontos Fortes:</b> Fácil usabilidade inicial, portal do cliente visual e relatórios fotográficos de canteiro.",
            "<b>Gargalos Críticos:</b> Fraco em reconciliação fiscal (3-Way Match), sem conta de haveres para entregas parciais e sem suporte a matrizes de responsabilidade de faturamento direto.",
        ]),
    ]

    for name, desc, points in competitors:
        elements.append(Paragraph(f"<b>&bull; {name}</b> — <i>{desc}</i>", body_bold))
        for pt in points:
            elements.append(Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;{pt}", body_style))
        elements.append(Spacer(1, 4))

    elements.append(Spacer(1, 6))

    # 6. Conclusão Estratégica do GADAP Hub
    elements.append(Paragraph("4. Conclusão Estratégica e Posicionamento do GADAP Hub", section_title))
    elements.append(Paragraph(
        "O <b>GADAP Hub</b> se posiciona como um <b>ERP de 2ª Geração (AI-Native)</b>. Enquanto os concorrentes obrigam o construtor "
        "a digitar cadastros burocráticos manuais, o GADAP Hub utiliza IA (Gemini/OpenAI) para absorver o caos diário do canteiro "
        "(mensagens de WhatsApp, XMLs de fornecedores e fotos probatórias), convertendo desordem em auditoria financeira rigorosa. "
        "A combinação de <b>Prevenção de Fraude ('Gato Escaldado')</b> com o <b>Dicionário Histórico de Preços</b> fecha o vazamento "
        "de margem que nenhum outro ERP para PME soluciona no Brasil.",
        body_style,
    ))
    elements.append(Spacer(1, 15))

    # Assinatura
    sign_data = [
        [
            Paragraph("____________________________________________<br/><b>Comitê de Inteligência de Mercado & Produto</b><br/>GADAP Hub Benchmarking Labs", table_cell),
            Paragraph("____________________________________________<br/><b>Chief Technology Officer (CTO)</b><br/>Engenharia & Arquitetura", table_cell),
        ]
    ]
    t_sign = Table(sign_data, colWidths=[9.2*cm, 9.2*cm])
    t_sign.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]))
    elements.append(t_sign)

    doc.build(elements)
    print(f"PDF de benchmarking gerado com sucesso em: {PDF_OUTPUT_PATH}")

if __name__ == "__main__":
    generate_pdf()

