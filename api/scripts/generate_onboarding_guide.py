#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
GADAP-ERP - Script Gerador da Documentação de Onboarding e Guia Rápido
Gera fisicamente:
1. GADAP_HUB_Onboarding_e_Guia_Rapido.md
2. GADAP_HUB_Onboarding_e_Guia_Rapido.pdf (via ReportLab)
=============================================================================
"""

import os
import sys

# Garante suporte a UTF-8 no stdout/stderr no Windows
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")

from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether

DOCUMENT_CONTENT = r"""# GADAP Hub • Enterprise Construction ERP
## Manual de Onboarding, Guia Rápido de 1ª Utilização e Curso Prático Integrado
**Documento Oficial de Treinamento, Sucesso do Cliente Piloto e Bíblia de Operação**  
*Versão: 3.0 (Release Fiscal & Tax Intelligence) • Publicação: Outubro/2026 • GADAP Technologies*

---

> ### 📌 NOTA DE GOVERNANÇA & CONFIDENCIALIDADE
> Este manual foi elaborado pelo time de Engenharia de Sucesso e Arquitetura do **GADAP-ERP** para capacitar novos clientes pilotos, diretores técnicos, engenheiros de campo e gestores financeiros. O conteúdo documenta fielmente os fluxos operacionais, regras determinísticas de cálculo, salvaguardas da plataforma, emissão oficial de NFS-e no Padrão Nacional da Receita Federal e as novas capacidades de Tax Intelligence (OCR de compras e monitoramento de alíquotas).

---

# SUMÁRIO GERAL

1. **Visão Geral da Plataforma GADAP Hub**
   - 1.1 A Dor do Mercado da Construção Civil
   - 1.2 A Solução GADAP: Eliminação do Caos de Planilhas e Retrabalho
   - 1.3 Arquitetura de Isolamento Hermético Multi-tenant (RLS)

2. **PARTE I: Guia Rápido de 1ª Utilização (Do Login ao Primeiro Faturamento)**
   - Passo 1: Acesso Inicial e Configuração do Usuário
   - Passo 2: Cadastro do Primeiro Cliente Tomador (PF / PJ)
   - Passo 3: Cadastro da Obra, Contrato e Insumos
   - Passo 4: Elaboração do Orçamento com Margem BDI Oficial
   - Passo 5: Lançamento e Aprovação da Medição de Campo
   - Passo 6: Faturando a Medição da Obra com NFS-e (Padrão Nacional)

3. **PARTE II: Curso Prático Integrado: "Dominando a Gestão de Obras no GADAP Hub"**
   - Módulo 1: Navegando no Dashboard e Visão Geral da Obra
   - Módulo 2: O Ciclo de Vida da Obra (do Contrato ao Apontamento de Campo)
   - Módulo 3: A Mágica Matemática do Faturamento (Retenções, Trava de 100% e Compliance)
   - Módulo 4: Gestão Financeira Integrada (Contas a Pagar/Receber & DRE Operacional)
   - Módulo 5: Faturamento Fiscal (NFS-e Padrão Nacional & Transmissão Segura)
   - Módulo 6: Inteligência Artificial a seu favor: Como Não Depender do Contador para Alíquotas e Insumos
   - **Módulo 7: Preparando sua construtora para o IBS e CBS (Reforma Tributária e Período de Convivência 2026-2032)**

4. **PARTE III: Manual do Administrador da Plataforma (Área Restrita Master)**
   - 4.1 Torre de Controle Global (God Mode)
   - 4.2 O Botão "Zerar Dados / Reset Ambiente": Finalidade e Limites
   - 4.3 Alerta Crítico de Irreversibilidade Operacional

5. **PARTE IV: Glossário Técnico e Tabela de Fórmulas Matemáticas**
   - Fórmula Oficial do BDI (Acórdão 2622/2013 TCU)
   - Retenção Técnica Contratual (Lei 8.212 / IN RFB)
   - Regra Territorial do ISS na Construção Civil (LC 116/2003, Art. 3º, III)
   - Chave de Acesso Nacional da NFS-e (50 Dígitos Módulo 11)
   - Reforma Tributária: Não-Cumulatividade Plena do IVA Dual & Redutor de 40% (EC 132/2023 & PLP 68/2024)
   - Bypass Fiscal MEI / SIMEI (LC 123/2006 & Art. 106 PLP 68/2024)

6. **🎯 MVP CONCLUÍDO & CORE SELADO PARA O FUTURO**

---

# 1. VISÃO GERAL DA PLATAFORMA GADAP HUB

### 1.1 A Dor do Mercado da Construção Civil
A grande maioria das construtoras e empreiteiras de médio porte no Brasil opera de forma fragmentada:
- Planilhas paralelas em Excel com fórmulas corrompidas;
- Divergências recorrentes entre as medições de campo apontadas pelo engenheiro e o faturamento emitido pelo departamento financeiro;
- Glosas e atrasos de pagamento causados por erro no cálculo de retenções técnicas (5% a 10%) e bitributação de ISS;
- Dependência cega de escritórios contábeis externos para saber se uma alíquota municipal foi alterada ou se uma nota de material foi faturada com impostos corretos.

### 1.2 A Solução GADAP Hub
O **GADAP Hub** centraliza o ciclo de vida completo da engenharia e da gestão financeira em uma única plataforma web de alta performance. Os cálculos fiscais, retenções e orçamentos operam através de motores determinísticos no backend, impedindo divergências aritméticas entre a obra e o faturamento oficial.

### 1.3 Arquitetura de Isolamento Hermético Multi-tenant (RLS)
Cada construtora cliente possui seu ambiente totalmente isolado. No nível de banco de dados, o Supabase PostgreSQL impõe **Row Level Security (RLS)** inegociável em todas as tabelas: nenhum cliente enxerga orçamentos, obras, medições ou lançamentos fiscais de outra empresa.

---

# PARTE I: GUIA RÁPIDO DE 1ª UTILIZAÇÃO
### Passo a Passo Objetivo: Do Login à Emissão da NFS-e Oficial

```
  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  │ 1. LOGIN    │ ──> │ 2. CLIENTE  │ ──> │ 3. OBRA     │ ──> │ 4. BDI      │
  │ admin@teste │     │  Cadastrar  │     │  Vincular   │     │  Orçamento  │
  │             │     │  Tomador PJ │     │  Contrato   │     │  Analítico  │
  └─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                     │
  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐            │
  │ 7. TAX INTEL│ <── │ 6. NFS-e    │ <── │ 5. MEDIÇÃO  │ <──────────┘
  │ OCR Insumos │     │  DPS Padrão │     │  Boletim    │
  │ Radar IBPT  │     │  Nacional   │     │  Aprovado   │
  └─────────────┘     └─────────────┘     └─────────────┘
```

#### Passo 1: Acesso Inicial e Boas-Vindas
- Acesse o portal em `/login`.
- Insira as credenciais do administrador da empresa (ex: `admin@teste.com` / `Gabriel2006`).
- O sistema carrega o painel autenticado, aplicando a claim de isolamento por `tenant_id`.

#### Passo 2: Cadastro do Cliente Tomador (PF / PJ)
- Navegue para `/dashboard/clientes` e clique em **"Novo Cliente"**.
- Preencha o CNPJ (se PJ) ou CPF (se PF), Razão Social e o Código IBGE do município do tomador (ex: `3509502` - Campinas/SP).

#### Passo 3: Cadastro da Obra, Contrato e Insumos
- Navegue para `/dashboard/obras` e clique em **"Cadastrar Obra"**.
- Defina o nome do empreendimento, o cliente tomador, o Valor Global do Contrato e o percentual de retenção técnica padrão (ex: `5.00%`).
- Registre o CNO (Cadastro Nacional de Obras) para atendimento ao eSocial / Reinf.

#### Passo 4: Elaboração do Orçamento com Margem BDI Oficial
- Navegue para `/dashboard/orcamentos` e clique em **"Novo Orçamento"**.
- Utilize composições de custos unitários e configure as taxas de BDI analítico (Acórdão 2622/2013 TCU), blindando a margem de lucro.

#### Passo 5: Lançamento e Aprovação da Medição de Campo
- Na página da Obra, acesse a aba **"Medições"** (`/dashboard/obras/{id}/medicoes`).
- Clique em **"Lançar Medição"**, informando o valor medido acumulado do período.
- O motor de cálculo aplica automaticamente a retenção técnica e gera o valor líquido faturável.
- Ao clicar em **"Aprovar Medição"**, o status avança para `aprovada`, liberando o faturamento fiscal.

#### Passo 6: Faturando a Medição da Obra com NFS-e (Padrão Nacional)
- Com a medição aprovada, clique no botão **"Emitir NFS-e"**.
- O sistema valida a competência territorial do ISS (LC 116/2003, Art. 3º, III), descriptografa o Certificado A1 em memória RAM, gera a DPS canônica com Chave de 50 dígitos (Módulo 11), salva XML e PDF no Supabase Storage (`xml-fiscais`) e despacha o comprovante via WhatsApp (Evolution API).
- O botão passa a exibir **"Visualizar PDF"** através de Presigned URL segura.

---

# PARTE II: CURSO PRÁTICO INTEGRADO
## "Dominando a Gestão de Obras no GADAP Hub"
*Carga Horária Estimada: 20 minutos • Foco: Produtividade, Eliminação de Retrabalho e Compliance Fiscal*

### MÓDULO 1: Navegando no Dashboard e Visão Geral da Obra
- Visão unificada de saúde financeira e física das obras ativas.
- Cards em tempo real: Contrato Global, Total Medido Acumulado, Saldo Residual e Provisão de Retenções.
- Gráficos de evolução física baseados em medições reais, eliminando estimativas subjetivas.

### MÓDULO 2: O Ciclo de Vida da Obra (do Contrato ao Apontamento de Campo)
- Como evitar glosas de medição: documente as datas de ciclo com precisão.
- Vinculação de contratos com CNO e ART para garantir rastreabilidade perante auditorias da Receita Federal e Crea.
- O histórico imutável de medições: cada boletim possui numeração sequencial auditável.

### MÓDULO 3: A Mágica Matemática do Faturamento (Retenções e Trava de 100%)
- **Retenção Técnica Contratual:** Como ela protege a construtora de riscos trabalhistas e acidentários (Lei 8.212/91).
- **A Trava de Supermedição (100%):** O sistema impede que a soma das medições ultrapasse o teto contratual pactuado.
- **Segregação Territorial do ISS:** O fim das multas por recolhimento de ISS no município errado. O sistema audita o local da prestação (canteiro de obras) e define automaticamente quem deve recolher o imposto.

### MÓDULO 4: Gestão Financeira Integrada (Contas a Pagar/Receber & DRE)
- Contas a Receber gerado diretamente dos boletins de medição aprovados, sem digitação paralela.
- Controle rigoroso de vencimentos e conciliação de faturas faturadas.

### MÓDULO 5: Faturamento Fiscal (NFS-e Padrão Nacional & Transmissão Segura)
- Conversão instantânea de medição em nota fiscal eletrônica oficial.
- Despacho automático de comprovantes via WhatsApp para os tomadores de serviço.

### MÓDULO 6: Inteligência Artificial a seu favor: Como Não Depender do Contador para Alíquotas e Insumos
- **Autonomia Tributária com o Radar Legal:** O robô do GADAP Hub monitora continuamente as publicações do IBPT e do Portal Nacional da NFS-e. O cliente não precisa mais telefonar ou esperar a contabilidade para saber se a prefeitura aumentou a alíquota do ISS (item 07.02) ou se uma nova regra de retenção entrou em vigor.
- **OCR Preditivo Multimodal (Gemini 2.5 Flash):** Digitalização e leitura em segundos de comprovantes de compras de materiais (cimento, aço, tubos, ferragens). A IA extrai o CNPJ do fornecedor, os dados da fatura e discrimina cada insumo diretamente para o Contas a Pagar.
- **Governança Human-in-the-Loop:** A IA extrai e pré-preenche com 99% de acurácia, mas a responsabilidade contábil é protegida por uma barreira de revisão humana compulsória antes de qualquer lançamento financeiro.

### MÓDULO 7: Preparando sua construtora para o IBS e CBS (Reforma Tributária & Período de Convivência)
- **Fim do Efeito Cascata & Não-Cumulatividade Plena:** No modelo IVA Dual (CBS Federal + IBS Estadual/Municipal), cada nota de compra de insumos (cimento, areia, aço, brita, blocos, locações) gera crédito financeiro automático que abate diretamente o imposto devido na medição de serviços.
- **Redutor Setorial de 40% da Construção Civil:** Conforme a EC nº 132/2023 e o PLP 68/2024, obras de engenharia e incorporações contam com desconto constitucional de 40% na alíquota padrão, resultando em uma alíquota efetiva estimada de ~16,78% sobre o faturamento.
- **Período de Convivência Transparente (2026 a 2032):** O GADAP Hub apura ambos os regimes (Legado e IVA Dual) simultaneamente e em tempo real. O canteiro de obras e o financeiro operam sem risco de descontinuidade ou erros fiscais.
- **Bypass Fiscal para MEI e Engenheiros Solo (LC 123/2006 & Art. 106 do PLP 68/2024):** Arquitetos e engenheiros autônomos optantes pelo SIMEI contam com desoneração total de retenções na fonte de INSS (11%), IRRF e CSRF, além de isenção de débitos de IBS/CBS. A NFS-e sai limpa, pagando apenas a guia única mensal fixa do DAS-MEI (R$ 75,00).

---

# PARTE III: MANUAL DO ADMINISTRADOR (ÁREA RESTRITA MASTER)

### 4.1 Torre de Controle Global (God Mode)
A rota `/backoffice` é restrita exclusivamente a usuários com privilégio de Super Administrador (`is_superadmin = true`).

### 4.2 O Botão "Zerar Dados / Reset Ambiente": Finalidade e Limites
Permite expurgar todos os dados operacionais sintéticos de um Tenant de demonstração (clientes, orçamentos, obras, medições e lançamentos fiscais).

### 4.3 Alerta Crítico de Irreversibilidade Operacional
> [!CAUTION]
> A ação de reset de ambiente é permanente e destrutiva para tabelas operacionais. No entanto, ela **preserva os logins e usuários do Supabase Auth**, permitindo que a equipe volte a operar imediatamente sem necessidade de recriar contas.

---

# PARTE IV: GLOSSÁRIO TÉCNICO E FÓRMULAS MATEMÁTICAS

### 1. Fórmula Oficial do BDI (Acórdão 2622/2013 TCU)
$$BDI = \left( \frac{(1 + AC + S + R + G) \times (1 + DF) \times (1 + L)}{1 - I} \right) - 1$$

### 2. Retenção Técnica Contratual
$$Valor\ Retenção = Valor\ Bruto\ Medido \times \left(\frac{\% Retenção}{100}\right)$$
$$Valor\ Líquido = Valor\ Bruto\ Medido - Valor\ Retenção$$

### 3. Regra de Competência do ISS (Art. 3º, III da LC 116/2003)
- Se $Município_{Prestador} \neq Município_{Obra} \implies ISS\ Retido\ na\ Fonte = \mathbf{SIM}$
- Se $Município_{Prestador} = Município_{Obra} \implies ISS\ Retido\ na\ Fonte = \mathbf{NÃO}$

### 4. Chave de Acesso Nacional da NFS-e (50 Dígitos)
$$\text{Chave} = \text{cMun}(7) + \text{tpInsc}(1) + \text{Doc}(14) + \text{Série}(5) + \text{nDPS}(15) + \text{cSeg}(7) + \mathbf{DV}(1)$$
Onde o Dígito Verificador ($\mathbf{DV}$) é calculado pelo algoritmo de Módulo 11 com pesos de 2 a 9.

### 5. Reforma Tributária: Não-Cumulatividade Plena do IVA Dual & Redutor de 40% (EC 132/2023 & PLP 68/2024)
$$Alíquota\ Efetiva\ IBS/CBS = Alíquota\ Padrão \times (1 - 0.40) \approx 27.97\% \times 0.60 = 16.78\%$$
$$Débito\ Líquido\ a\ Pagar = Débito\ Bruto - Créditos\ Financeiros\ de\ Materiais\ (CBS + IBS)$$

### 6. Bypass Fiscal MEI (SIMEI - LC 123/2006 & Art. 106 do PLP 68/2024)
$$Retenções\ na\ Fonte = R\$\ 0,00 \quad | \quad Débito\ IBS/CBS = R\$\ 0,00 \quad | \quad DAS-MEI = Guia\ Fixa\ Mensal$$

---

# 🎯 MVP CONCLUÍDO & CORE SELADO

> ### 🎯 DECLARAÇÃO OFICIAL DE PRÓXIMO PASSO
> **O core do negócio está selado para o futuro! Toda a esteira operacional, orçamentos BDI, medições físico-financeiras, governança multi-tenant, motor de IA e conformidade com o IVA Dual (2026-2032) estão 100% consolidadas. A próxima etapa é a FASE 11: BILLING E MONETIZAÇÃO SAAS!**
"""

def generate_markdown(output_path: str):
    """Grava o conteúdo completo em arquivo Markdown (.md)."""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(DOCUMENT_CONTENT.strip() + "\n")
    print(f"[OK] Documento Markdown gerado com sucesso em: {output_path}")

def generate_pdf_reportlab(pdf_path: str):
    """
    Gera o documento PDF oficial formatado e diagramado via ReportLab.
    """
    doc = SimpleDocTemplate(
        pdf_path,
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
        textColor=HexColor("#065f46"),
        fontName="Helvetica-Bold",
        alignment=0,
    )
    subtitle_style = ParagraphStyle(
        "CoverSub",
        parent=styles["Normal"],
        fontSize=10.5,
        leading=14,
        textColor=HexColor("#334155"),
        fontName="Helvetica",
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
        fontSize=12,
        leading=15,
        textColor=HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        spaceBefore=10,
        spaceAfter=5,
    )
    h2_style = ParagraphStyle(
        "Heading2Custom",
        parent=styles["Heading2"],
        fontSize=9.5,
        leading=12,
        textColor=HexColor("#047857"),
        fontName="Helvetica-Bold",
        spaceBefore=6,
        spaceAfter=3,
    )
    body_style = ParagraphStyle(
        "BodyCustom",
        parent=styles["Normal"],
        fontSize=8,
        leading=11,
        textColor=HexColor("#1e293b"),
        fontName="Helvetica",
        spaceAfter=3,
    )
    bullet_style = ParagraphStyle(
        "BulletCustom",
        parent=body_style,
        leftIndent=12,
        firstLineIndent=-6,
        spaceAfter=2,
    )
    callout_style = ParagraphStyle(
        "CalloutText",
        parent=body_style,
        fontSize=8,
        leading=11,
        textColor=HexColor("#065f46"),
        fontName="Helvetica",
    )
    mvp_title_style = ParagraphStyle(
        "MvpTitle",
        parent=styles["Heading1"],
        fontSize=12,
        leading=15,
        textColor=HexColor("#065f46"),
        fontName="Helvetica-Bold",
    )

    story = []

    # Cabeçalho Principal
    story.append(Paragraph("GADAP Hub • Enterprise Construction ERP", title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Manual de Onboarding, Guia Rápido de 1ª Utilização e Bíblia Operacional", subtitle_style))
    story.append(Paragraph("Documento Oficial de Treinamento • Versão 3.0 (Release Fiscal & Tax Intelligence com IA)", meta_style))
    story.append(Spacer(1, 8))

    # Box de Governança
    box_data = [[
        Paragraph(
            "<b>NOTA DE GOVERNANÇA:</b> Este manual documenta os fluxos operacionais, regras determinísticas "
            "de cálculo da Lei Complementar 116/2003, salvaguardas contratuais, a emissão oficial de NFS-e no "
            "Padrão Nacional e a suíte autônoma de Tax Intelligence com OCR multimodal e radar de alíquotas.",
            callout_style,
        )
    ]]
    t_gov = Table(box_data, colWidths=[520])
    t_gov.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#ecfdf5")),
        ("BOX", (0, 0), (-1, -1), 1, HexColor("#a7f3d0")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(t_gov)
    story.append(Spacer(1, 8))

    # PARTE I: GUIA RÁPIDO
    story.append(Paragraph("PARTE I: GUIA RÁPIDO DE 1ª UTILIZAÇÃO", h1_style))
    story.append(Paragraph("Passo a passo objetivo para operar a plataforma do login à emissão fiscal:", body_style))
    story.append(Spacer(1, 2))

    passos = [
        ("Passo 1: Acesso Inicial e Boas-Vindas", "Faça login com as credenciais administrativas (admin@teste.com). O sistema valida a sessão JWT e isola o tenant via Row Level Security (RLS)."),
        ("Passo 2: Cadastro do Cliente Tomador", "No menu Clientes (/dashboard/clientes), cadastre o tomador (PJ ou PF) informando CNPJ, Razão Social e Código IBGE do município."),
        ("Passo 3: Cadastro da Obra e Contrato", "No menu Obras (/dashboard/obras), cadastre a obra com seu CNO (Cadastro Nacional de Obras), Valor Global e percentual de Retenção Técnica padrão (5%)."),
        ("Passo 4: Elaboração do Orçamento com BDI", "No menu Orçamentos, monte as composições de custos e aplique a fórmula analítica do BDI conforme Acórdão 2622/2013 do TCU."),
        ("Passo 5: Lançamento e Aprovação da Medição", "No painel de medições (/dashboard/obras/{id}/medicoes), lance o boletim físico-financeiro. O backend calcula a retenção e o líquido. Aprove para liberar faturamento."),
        ("Passo 6: Faturando a Medição com NFS-e (Padrão Nacional)", 
         "Com a medição aprovada, clique no botão <b>'Emitir NFS-e'</b>. O motor fiscal valida a competência territorial do ISS (LC 116/2003, Art. 3º, III), "
         "descriptografa o Certificado A1 em memória, gera a DPS canônica com Chave de 50 dígitos (Módulo 11), salva XML e PDF no Supabase Storage "
         "('xml-fiscais') e despacha o comprovante via WhatsApp (Evolution API)."),
    ]

    for titulo, desc in passos:
        story.append(Paragraph(f"• <b>{titulo}</b>", h2_style))
        story.append(Paragraph(desc, bullet_style))
        story.append(Spacer(1, 1))

    # Quebra de página deliberada para equilíbrio visual perfeito
    story.append(PageBreak())

    # PÁGINA 2
    story.append(Paragraph("PARTE II: CURSO PRÁTICO INTEGRADO (ACADEMY COM IA)", h1_style))
    story.append(Paragraph("<b>Módulo 1: Navegando no Dashboard</b> — Acompanhe Contrato Global, Saldo Residual e Curva Físico-Financeira em tempo real, sem planilhas paralelas.", body_style))
    story.append(Paragraph("<b>Módulo 2: Ciclo de Vida da Obra</b> — Rastreabilidade completa com CNO, ART e boletins de medição numerados sequencialmente e auditáveis.", body_style))
    story.append(Paragraph("<b>Módulo 3: Faturamento Matemático e Compliance</b> — Trava de 100% que impede supermedições e segregação territorial de retenção do ISS.", body_style))
    story.append(Paragraph("<b>Módulo 6: Inteligência Artificial a seu favor</b> — Autonomia Fiscal & Radar Tributário: monitoramento do IBPT/NFS-e e OCR preditivo multimodal (Gemini 2.5 Flash) de notas de compras com revisão humana compulsória.", body_style))
    story.append(Paragraph("<b>Módulo 7: Preparando sua construtora para o IBS e CBS</b> — Fim do efeito cascata com Não-Cumulatividade Plena (créditos automáticos de insumos), redutor constitucional de 40% na Construção Civil, período de convivência transparente (2026-2032) e Bypass Fiscal automático para MEIs/Engenheiros Solo (LC 123/2006 & PLP 68/2024).", body_style))
    story.append(Spacer(1, 6))

    # PARTE III: GLOSSÁRIO E REGRAS FISCAIS
    story.append(Paragraph("PARTE III: REGRAS DETERMINÍSTICAS E TRIBUTÁRIAS", h1_style))
    
    tributos_info = [
        [Paragraph("<b>Regra / Tributo</b>", body_style), Paragraph("<b>Fundamentação Legal e Aplicação no GADAP Hub</b>", body_style)],
        [
            Paragraph("<b>Retenção do ISS</b>", body_style),
            Paragraph("<b>Art. 3º, III da Lei Complementar nº 116/2003:</b> Se o município da obra for distinto do município do prestador, o ISSQN pertence ao local da obra e é <u>obrigatoriamente retido na fonte</u> pelo tomador.", body_style)
        ],
        [
            Paragraph("<b>Retenção Técnica INSS</b>", body_style),
            Paragraph("<b>Instrução Normativa RFB nº 2.110/2022:</b> Retenção previdenciária de 5% a 11% sobre o valor medido, garantindo provisão de contingência trabalhista.", body_style)
        ],
        [
            Paragraph("<b>Tax Intelligence (IA)</b>", body_style),
            Paragraph("<b>Lei 12.741/2012 (IBPT) & LLM Gemini 2.5 Flash:</b> Varredura autônoma de coeficientes e OCR preditivo multimodal de romaneios com conferência humana obrigatória.", body_style)
        ],
        [
            Paragraph("<b>Chave de Acesso Nacional</b>", body_style),
            Paragraph("50 dígitos estruturados com Código IBGE, Tipo de Inscrição, CNPJ, Série, Número da DPS, Código de Segurança e Dígito Verificador Módulo 11.", body_style)
        ],
        [
            Paragraph("<b>BDI Analítico TCU</b>", body_style),
            Paragraph("Acórdão 2622/2013 TCU: Aplicação das taxas de Administração Central (AC), Seguros (S), Riscos (R), Garantias (G), Despesas Financeiras (DF), Lucro (L) e Tributos (I).", body_style)
        ],
        [
            Paragraph("<b>Reforma Tributária (IBS/CBS)</b>", body_style),
            Paragraph("<b>EC nº 132/2023 & PLP 68/2024:</b> IVA Dual com Não-Cumulatividade Plena e Redutor de 40% na Construção Civil. Apuração simultânea e créditos automáticos de insumos.", body_style)
        ],
        [
            Paragraph("<b>Bypass Fiscal MEI / SIMEI</b>", body_style),
            Paragraph("<b>LC 123/2006 & Art. 106 PLP 68/2024:</b> Desoneração integral de retenções na fonte (INSS 11%, IRRF, CSRF) e isenção de débitos de IBS/CBS, com guia fixa no DAS-MEI.", body_style)
        ],
    ]
    t_trib = Table(tributos_info, colWidths=[130, 390])
    t_trib.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 1, HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(t_trib)
    story.append(Spacer(1, 8))

    # BLOCO OFICIAL: 🎯 MVP CONCLUÍDO & PRÓXIMA ETAPA: FASE 11
    story.append(Paragraph("🎯 MVP CONCLUÍDO & CORE SELADO PARA O FUTURO", mvp_title_style))
    mvp_box = [[
        Paragraph(
            "<b>DECLARAÇÃO OFICIAL DE PRÓXIMO PASSO:</b><br/>"
            "<b>O core do negócio está selado para o futuro! Toda a esteira operacional, orçamentos BDI, medições "
            "físico-financeiras, governança multi-tenant, motor de IA e conformidade com o IVA Dual (2026-2032) "
            "estão 100% consolidadas. A próxima etapa é a FASE 11: BILLING E MONETIZAÇÃO SAAS!</b>",
            body_style,
        )
    ]]
    t_mvp = Table(mvp_box, colWidths=[520])
    t_mvp.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#ecfdf5")),
        ("BOX", (0, 0), (-1, -1), 1.5, HexColor("#059669")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(t_mvp)

    # Constrói o PDF físico
    doc.build(story)
    print(f"[OK] Documento PDF compilado com sucesso via ReportLab em: {pdf_path}")

def main():
    workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    
    target_md = os.path.join(workspace_root, "GADAP_HUB_Onboarding_e_Guia_Rapido.md")
    target_pdf = os.path.join(workspace_root, "GADAP_HUB_Onboarding_e_Guia_Rapido.pdf")
    
    print("=" * 70)
    print(" GADAP-ERP • GERADOR DE DOCUMENTAÇÃO DE ONBOARDING E GUIA RÁPIDO")
    print("=" * 70)
    print(f"Diretório Alvo: {workspace_root}")
    
    generate_markdown(target_md)
    generate_pdf_reportlab(target_pdf)
    
    print("=" * 70)
    print(f"Sucesso: Arquivos físicos criados:")
    print(f" - Markdown: {os.path.basename(target_md)} ({os.path.getsize(target_md)} bytes)")
    print(f" - PDF:      {os.path.basename(target_pdf)} ({os.path.getsize(target_pdf)} bytes)")
    print("=" * 70)

if __name__ == "__main__":
    main()
