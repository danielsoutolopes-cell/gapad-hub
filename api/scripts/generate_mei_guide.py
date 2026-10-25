#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
GADAP Hub - Script Gerador do Onboarding Expresso para MEIs e Arquitetos
Gera fisicamente:
1. Guia_Rapido_Autonomos_MEI.md
2. Guia_Rapido_Autonomos_MEI.pdf (via ReportLab)
=============================================================================
"""

import os
import sys

# Garante suporte a UTF-8 no Windows
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")

from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether

DOCUMENT_CONTENT_MD = r"""# GADAP Hub • Guia Rápido & Onboarding Expresso
## Guia do Autônomo, Arquiteto e Empreiteiro MEI
**Do Primeiro Orçamento ao Faturamento em 3 Passos Simples**  
*Publicação: Outubro/2026 • GADAP Technologies • Suporte ao Empreendedor*

---

> ### ⚡ FEITO PARA QUEM NÃO TEM TEMPO A PERDER
> Este guia foi desenhado exclusivamente para profissionais autônomos, arquitetos independentes, engenheiros solo e pequenas empreiteiras optantes pelo MEI.
> Aqui você **não encontrará termos fiscais pesados ou planilhas complexas**. Em apenas **3 passos**, você coloca seu negócio para rodar com orçamentos profissionais e faturamento seguro.

---

# 📋 OS 3 PASSOS ESSENCIAIS DO SUCESSO

```
   ┌───────────────────────┐      ┌───────────────────────┐      ┌───────────────────────┐
   │       PASSO 1         │      │        PASSO 2        │      │        PASSO 3        │
   │  Orçar Rápido com     │ ───► │  Gerar a Obra em      │ ───► │  Faturar com Isenção  │
   │  Margem Direta        │      │  Apenas 1 Clique      │      │  Total de Retenções   │
   │  (Markup sobre Custo) │      │  (Orçamento Aprovado) │      │  (Bypass Fiscal MEI)  │
   └───────────────────────┘      └───────────────────────┘      └───────────────────────┘
```

---

## PASSO 1: Como Orçar Rápido Usando Margem Direta (Markup)

O modelo corporativo tradicional exige cálculos complexos de taxas de administração e rateios indiretos. Para o autônomo e arquiteto, o que realmente importa é: **quanto custa executar o serviço e qual é a sua margem de lucro**.

### Como funciona no GADAP Hub:
1. Acesse o menu **Orçamentos > Novo Orçamento**.
2. No topo da tela, ative a chave de alternância: **"Orçamento Simplificado (Ideal para Autônomos)"**.
3. Automaticamente, todas as fórmulas e campos de taxas corporativas somem da tela.
4. Adicione os itens da proposta (materiais e diárias de mão de obra) informando quantidade e custo unitário.
5. Digite sua **% de Margem (Markup)** desejada ou clique nos botões rápidos de atalho (`+20%`, `+30%`, `+40%`, `+50%`).

### A Fórmula Matemática Aplicada:
$$\text{Preço Final de Venda} = \text{Custo Total dos Itens} \times (1 + \text{Margem \%})$$

### 💡 Exemplo Prático:
- **Custo dos Materiais + Diárias:** R$ 3.000,00
- **Sua Margem Desejada (Markup):** 40% (0,40)
- **Cálculo Automático:** R$ 3.000,00 × 1,40 = **R$ 4.200,00**
- **Seu Lucro Bruto Garantido:** R$ 1.200,00

Pronto! Você gera uma proposta comercial limpa, com design elegante, pronta para enviar pelo WhatsApp ou e-mail ao cliente.

---

## PASSO 2: Como Gerar a Obra com 1 Clique

Esqueça o controle paralelo de cadernos e notas soltas. Assim que o cliente fechar a proposta, o GADAP Hub transforma o orçamento em obra ativa instantaneamente.

### Como funciona no GADAP Hub:
1. Na lista de propostas em **Orçamentos**, localize a proposta aceita pelo cliente.
2. Altere o status para **"Aprovado / Convertido em Obra"**.
3. O sistema cria automaticamente o registro da obra vinculada ao cliente, com o escopo fechado e o valor total contratado.
4. Você passa a lançar as notas de compras de materiais e recibos de ajudantes diretamente na obra, sabendo a qualquer momento se está dentro do lucro planejado.

---

## PASSO 3: Como Faturar a Nota Fiscal sem Retenções Complexas

Uma das maiores dores do pequeno prestador é ter pagamentos retidos na fonte por clientes grandes que aplicam descontos indevidos de INSS (11%), IRRF (1,5%) e CSLL/PIS/COFINS (4,65%).

### O Benefício do MEI na Construção Civil:
Por determinação legal da **Lei Complementar nº 123/2006 (Estatuto da Micro e Pequena Empresa)**, o MEI recolhe todos os seus tributos de forma consolidada no boleto mensal do **DAS** (cerca de R$ 75 a R$ 80 por mês). Portanto:
- O tomador do serviço **NÃO PODE reter INSS** na nota fiscal do MEI.
- O tomador **NÃO PODE reter Imposto de Renda** nem contribuições sociais.
- O prestador MEI recebe **100% líquido do valor faturado**.

### Como o GADAP Hub protege você:
- O motor inteligente de **Bypass Fiscal** reconhece que sua empresa é MEI.
- Na emissão da NFS-e ou no faturamento da medição, os campos de retenção de impostos são **automaticamente zerados**.
- A nota fiscal é gerada no Padrão Nacional com as anotações legais corretas, impedindo que o departamento financeiro do cliente retenha seu dinheiro indevidamente.

---

# ❓ PERGUNTAS FREQUENTES (FAQ DO AUTÔNOMO)

### 1. Preciso emitir nota fiscal para todo orçamento que fechar?
Apenas quando prestar serviços para Pessoas Jurídicas (empresas ou condomínios) ou quando o cliente Pessoa Física exigir o documento. No GADAP Hub, você pode manter obras registradas mesmo antes de emitir a nota oficial.

### 2. Posso mudar a margem de markup de um cliente para outro?
Sim! A cada orçamento você pode definir a margem que desejar, permitindo cobrar margens diferenciadas para reformas rápidas, projetos executivos de arquitetura ou empreitadas de longa duração.

### 3. E se o cliente pedir um desconto no final?
Basta preencher o campo **"Desconto Comercial (R$)"**. O sistema abate o desconto do valor final da proposta sem desconfigurar o seu custo real, mantendo seu controle financeiro transparente.

---

# 🚀 RESUMO EM 30 SEGUNDOS

1. **Orçar:** Ative *"Orçamento Simplificado"*, coloque seus custos e clique no markup desejado.
2. **Executar:** Clique em *"Aprovar / Converter"* e acompanhe seus gastos em tempo real.
3. **Receber:** Emita sua NFS-e limpa via Bypass Fiscal e receba 100% do seu dinheiro na conta.

*GADAP Hub • O ERP da Construção que fala a língua do seu negócio.*
"""

def generate_markdown(output_path: str):
    """Gera o arquivo Markdown do Guia Rápido."""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(DOCUMENT_CONTENT_MD.strip() + "\n")
    print(f"-> Arquivo Markdown gerado com sucesso: {output_path}")


def generate_pdf(output_path: str):
    """Gera a versão PDF profissional do Guia Rápido via ReportLab."""
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "CoverTitle",
        parent=styles["Heading1"],
        fontSize=18,
        leading=22,
        textColor=HexColor("#d97706"), # Âmbar profissional
        fontName="Helvetica-Bold",
        alignment=0,
    )
    subtitle_style = ParagraphStyle(
        "CoverSub",
        parent=styles["Normal"],
        fontSize=11,
        leading=15,
        textColor=HexColor("#1e293b"),
        fontName="Helvetica-Bold",
    )
    meta_style = ParagraphStyle(
        "MetaText",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=11,
        textColor=HexColor("#64748b"),
        fontName="Helvetica-Oblique",
    )
    h1_style = ParagraphStyle(
        "Heading1Custom",
        parent=styles["Heading1"],
        fontSize=13,
        leading=16,
        textColor=HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        spaceBefore=12,
        spaceAfter=6,
    )
    h2_style = ParagraphStyle(
        "Heading2Custom",
        parent=styles["Heading2"],
        fontSize=10.5,
        leading=14,
        textColor=HexColor("#b45309"),
        fontName="Helvetica-Bold",
        spaceBefore=8,
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "BodyCustom",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=12,
        textColor=HexColor("#1e293b"),
        fontName="Helvetica",
        spaceAfter=4,
    )
    callout_style = ParagraphStyle(
        "CalloutText",
        parent=body_style,
        fontSize=8.5,
        leading=12,
        textColor=HexColor("#92400e"),
        fontName="Helvetica",
    )
    formula_style = ParagraphStyle(
        "FormulaText",
        parent=body_style,
        fontSize=9.5,
        leading=13,
        textColor=HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=1, # Centralizado
    )

    story = []

    # Cabeçalho Principal
    story.append(Paragraph("GADAP Hub • Onboarding Expresso", title_style))
    story.append(Spacer(1, 3))
    story.append(Paragraph("Guia do Autônomo, Arquiteto e Empreiteiro MEI: Emissão Rápida em 3 Passos", subtitle_style))
    story.append(Paragraph("Documento Oficial de Treinamento Rápido • Outubro/2026 • GADAP Technologies", meta_style))
    story.append(Spacer(1, 8))

    # Box de Destaque
    box_data = [[
        Paragraph(
            "<b>FEITO PARA QUEM NÃO TEM TEMPO A PERDER:</b> Este guia foi elaborado exclusivamente para "
            "profissionais autônomos, arquitetos independentes, engenheiros solo e pequenas empreiteiras optantes "
            "pelo MEI. Aqui você <b>não encontrará termos fiscais pesados ou fórmulas complicadas</b>. Em apenas 3 passos, "
            "você coloca seu negócio para rodar com orçamentos profissionais e faturamento limpo.",
            callout_style,
        )
    ]]
    t_gov = Table(box_data, colWidths=[520])
    t_gov.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#fef3c7")), # Amber-100
        ("BOX", (0, 0), (-1, -1), 1, HexColor("#fcd34d")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(t_gov)
    story.append(Spacer(1, 10))

    # Tabela com o Fluxo de 3 Passos
    steps_data = [
        [
            Paragraph("<b>PASSO 1: ORÇAR RÁPIDO</b>", h2_style),
            Paragraph("<b>PASSO 2: GERAR A OBRA</b>", h2_style),
            Paragraph("<b>PASSO 3: FATURAR LIMPO</b>", h2_style),
        ],
        [
            Paragraph("Ative a chave 'Orçamento Simplificado'. Preencha os custos e sua margem Markup (ex: 30%). Proposta pronta em 2 minutos.", body_style),
            Paragraph("Cliente aprovou? Com 1 clique em 'Aprovar / Converter', sua obra é gerada automaticamente com escopo e valor contratado.", body_style),
            Paragraph("O Bypass Fiscal do GADAP zera as retenções de INSS e IRRF na NFS-e. Você recebe 100% líquido do valor na conta.", body_style),
        ]
    ]
    t_steps = Table(steps_data, colWidths=[170, 175, 175])
    t_steps.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#fffbeb")),
        ("BACKGROUND", (0, 1), (-1, 1), HexColor("#ffffff")),
        ("BOX", (0, 0), (-1, -1), 1, HexColor("#e2e8f0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#cbd5e1")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t_steps)
    story.append(Spacer(1, 10))

    # Detalhamento Passo 1
    story.append(Paragraph("PASSO 1: Como Orçar Rápido Usando Margem Direta (Markup)", h1_style))
    story.append(Paragraph(
        "Para o profissional autônomo e arquiteto solo, o que realmente importa é: <b>quanto custa executar o serviço "
        "e qual é a margem de lucro líquida desejada</b>.",
        body_style,
    ))
    story.append(Paragraph("<b>Como fazer no sistema:</b>", body_style))
    story.append(Paragraph("• No menu <b>Orçamentos > Novo Orçamento</b>, ligue a chave <b>'Orçamento Simplificado (Ideal para Autônomos)'</b>.", body_style))
    story.append(Paragraph("• Todos os campos corporativos do BDI somem da tela instantaneamente.", body_style))
    story.append(Paragraph("• Lance os materiais e serviços e defina a <b>% de Margem (Markup)</b> ou clique nos atalhos (+20%, +30%, +40%, +50%).", body_style))
    story.append(Spacer(1, 4))

    # Box com a fórmula
    f_box = [[
        Paragraph("<b>FÓRMULA DIRETA:</b> Preço Final = Custo Total dos Itens × (1 + Margem %)", formula_style)
    ]]
    t_f = Table(f_box, colWidths=[520])
    t_f.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 1, HexColor("#cbd5e1")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t_f)
    story.append(Spacer(1, 8))

    # Detalhamento Passo 2
    story.append(Paragraph("PASSO 2: Como Gerar a Obra Automaticamente", h1_style))
    story.append(Paragraph(
        "Elimine o uso de cadernos e pastas desorganizadas. Quando o cliente der o aceite comercial na sua proposta:",
        body_style,
    ))
    story.append(Paragraph("• Altere o status do orçamento para <b>'Aprovado / Convertido em Obra'</b>.", body_style))
    story.append(Paragraph("• O GADAP Hub cria a pasta da obra com o nome do cliente, escopo fechado e valor total.", body_style))
    story.append(Paragraph("• Você tem controle total das compras e recibos sem precisar de planilhas paralelas.", body_style))
    story.append(Spacer(1, 8))

    # Detalhamento Passo 3
    story.append(Paragraph("PASSO 3: Faturamento Seguro e Isento de Retenções (Bypass Fiscal MEI)", h1_style))
    story.append(Paragraph(
        "Pela <b>Lei Complementar nº 123/2006</b>, o Microempreendedor Individual recolhe todos os seus impostos na guia "
        "única do <b>DAS mensal</b> (valor fixo). Clientes tomadores <b>NÃO podem reter INSS nem IRRF</b> na nota fiscal do MEI.",
        body_style,
    ))
    story.append(Paragraph("• O GADAP Hub detecta automaticamente o enquadramento MEI da sua empresa.", body_style))
    story.append(Paragraph("• O motor de cálculo aciona o <b>Bypass Fiscal</b>, zerando retenções de INSS (11%), IRRF (1,5%) e contribuições.", body_style))
    story.append(Paragraph("• Sua NFS-e sai no Padrão Nacional 100% limpa, garantindo que você receba o valor integral combinado.", body_style))
    story.append(Spacer(1, 10))

    # Box de FAQ Resumido
    faq_data = [
        [Paragraph("<b>DÚVIDAS FREQUENTES:</b>", h2_style)],
        [Paragraph("<b>• Posso mudar a margem por proposta?</b> Sim, em cada orçamento você pode digitar qualquer percentual de markup.", body_style)],
        [Paragraph("<b>• E se o cliente pedir desconto?</b> Preencha o campo 'Desconto Comercial (R$)', que o sistema recalcula na hora.", body_style)],
        [Paragraph("<b>• Pago imposto na nota?</b> Não. O MEI quita seus impostos exclusivamente no boleto DAS mensal fixo.", body_style)],
    ]
    t_faq = Table(faq_data, colWidths=[520])
    t_faq.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 1, HexColor("#e2e8f0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#f1f5f9")),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_faq)
    story.append(Spacer(1, 12))

    # Conclusão / Rodapé
    story.append(Paragraph(
        "<b>GADAP Hub ERP</b> • Versão Exclusiva para Autônomos, Engenheiros Solo, Arquitetos e Pequenos Prestadores MEI.",
        meta_style,
    ))

    doc.build(story)
    print(f"-> Arquivo PDF gerado com sucesso via ReportLab: {output_path}")


def main():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    md_file = os.path.join(base_dir, "Guia_Rapido_Autonomos_MEI.md")
    pdf_file = os.path.join(base_dir, "Guia_Rapido_Autonomos_MEI.pdf")

    # Garante diretório public se existir para acesso web
    public_dir = os.path.join(base_dir, "public")
    os.makedirs(public_dir, exist_ok=True)
    public_pdf = os.path.join(public_dir, "Guia_Rapido_Autonomos_MEI.pdf")

    print("=================================================================")
    print("Iniciando geração física dos artefatos: Guia Rápido Autônomos/MEI")
    print("=================================================================")

    generate_markdown(md_file)
    generate_pdf(pdf_file)

    # Copia para a pasta public para download direto no frontend
    import shutil
    shutil.copyfile(pdf_file, public_pdf)
    print(f"-> Cópia para download web gerada em: {public_pdf}")

    print("=================================================================")
    print("Artefatos concluídos com sucesso!")
    print(f"1. Markdown: {md_file} ({os.path.getsize(md_file)} bytes)")
    print(f"2. PDF:      {pdf_file} ({os.path.getsize(pdf_file)} bytes)")
    print("=================================================================")


if __name__ == "__main__":
    main()
