import os, sys, re, shutil
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
import html

def md_to_flowable_text(text):
    text = html.escape(text)
    # replace bold
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    # replace italic
    text = re.sub(r'\*(.+?)\*', r'<i>\1</i>', text)
    # clean latex dollars
    text = text.replace('$$', '').replace('$', '')
    # replace inline code
    text = re.sub(r'`(.+?)`', r'<font face="Courier" color="#047857">\1</font>', text)
    return text

def generate_pdf(md_path, pdf_path, title):
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=36, leftMargin=36,
        topMargin=36, bottomMargin=36
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#064e3b'),
        spaceAfter=6
    )
    h2_style = ParagraphStyle(
        'DocH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=colors.HexColor('#047857'),
        spaceBefore=10,
        spaceAfter=4
    )
    h3_style = ParagraphStyle(
        'DocH3',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#1f2937'),
        spaceBefore=6,
        spaceAfter=3
    )
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor('#374151'),
        spaceAfter=3
    )
    code_style = ParagraphStyle(
        'DocCode',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor('#0f172a'),
    )
    bullet_style = ParagraphStyle(
        'DocBullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#1f2937'),
        leftIndent=12,
        spaceAfter=2
    )

    story = []
    lines = content.split('\n')
    in_code_block = False
    code_buffer = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith('```'):
            if in_code_block:
                in_code_block = False
                block_txt = '\n'.join(code_buffer)
                code_buffer = []
                p = Paragraph(html.escape(block_txt).replace('\n', '<br/>'), code_style)
                tbl = Table([[p]], colWidths=[540])
                tbl.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f1f5f9')),
                    ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
                    ('PADDING', (0,0), (-1,-1), 6),
                ]))
                story.append(tbl)
                story.append(Spacer(1, 4))
            else:
                in_code_block = True
                code_buffer = []
            continue

        if in_code_block:
            code_buffer.append(line)
            continue

        if not stripped:
            continue

        if stripped.startswith('# '):
            story.append(Spacer(1, 8))
            story.append(Paragraph(md_to_flowable_text(stripped[2:]), title_style))
            story.append(HRFlowable(width='100%', thickness=1.5, color=colors.HexColor('#10b981'), spaceAfter=6))
        elif stripped.startswith('## '):
            story.append(Paragraph(md_to_flowable_text(stripped[3:]), h2_style))
        elif stripped.startswith('### '):
            story.append(Paragraph(md_to_flowable_text(stripped[4:]), h3_style))
        elif stripped.startswith('- ') or stripped.startswith('* '):
            story.append(Paragraph('&bull; ' + md_to_flowable_text(stripped[2:]), bullet_style))
        elif stripped.startswith('> '):
            callout_text = md_to_flowable_text(stripped[2:])
            tbl = Table([[Paragraph(callout_text, body_style)]], colWidths=[540])
            tbl.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#ecfdf5')),
                ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#a7f3d0')),
                ('PADDING', (0,0), (-1,-1), 6),
            ]))
            story.append(Spacer(1, 4))
            story.append(tbl)
            story.append(Spacer(1, 4))
        elif stripped.startswith('---'):
            story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#cbd5e1'), spaceBefore=4, spaceAfter=4))
        else:
            txt = md_to_flowable_text(stripped)
            story.append(Paragraph(txt, body_style))

    doc.build(story)
    print(f'Successfully generated: {pdf_path}')

if __name__ == '__main__':
    generate_pdf(r'c:\gadap_hub\GADAP_HUB_Onboarding_e_Guia_Rapido.md', r'c:\gadap_hub\GADAP_HUB_Onboarding_e_Guia_Rapido.pdf', 'GADAP Hub Onboarding')
    generate_pdf(r'c:\gadap_hub\Guia_Rapido_Autonomos_MEI.md', r'c:\gadap_hub\Guia_Rapido_Autonomos_MEI.pdf', 'Guia Rapido Autonomos MEI')

    if os.path.exists(r'c:\gadap_hub\public'):
        shutil.copy2(r'c:\gadap_hub\Guia_Rapido_Autonomos_MEI.pdf', r'c:\gadap_hub\public\Guia_Rapido_Autonomos_MEI.pdf')
        print('Copied to public/Guia_Rapido_Autonomos_MEI.pdf')
