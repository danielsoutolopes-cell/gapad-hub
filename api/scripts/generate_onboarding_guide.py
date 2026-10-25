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
**Documento Oficial de Treinamento e Sucesso do Cliente Piloto**  
*Versão: 2.0 (Release Fiscal & NFS-e) • Publicação: Outubro/2026 • GADAP Technologies*

---

> ### 📌 NOTA DE GOVERNANÇA & CONFIDENCIALIDADE
> Este manual foi elaborado pelo time de Engenharia de Sucesso e Arquitetura do **GADAP-ERP** para capacitar novos clientes pilotos, diretores técnicos, engenheiros de campo e gestores financeiros. O conteúdo documenta fielmente os fluxos operacionais, regras determinísticas de cálculo, salvaguardas da plataforma e a emissão oficial de NFS-e no Padrão Nacional da Receita Federal.

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
   - **Passo 6: Faturando a Medição da Obra com NFS-e (Padrão Nacional)**

3. **PARTE II: Curso Prático Integrado: "Dominando a Gestão de Obras no GADAP Hub"**
   - Módulo 1: Navegando no Dashboard e Visão Geral da Obra
   - Módulo 2: O Ciclo de Vida da Obra (do Contrato ao Apontamento de Campo)
   - Módulo 3: A Mágica Matemática do Faturamento (Retenções, Trava de 100% e Compliance)

4. **PARTE III: Manual do Administrador da Plataforma (Área Restrita Master)**
   - 4.1 Torre de Controle Global (God Mode)
   - 4.2 O Botão "Zerar Dados / Reset Ambiente": Finalidade e Limites
   - 4.3 Alerta Crítico de Irreversibilidade Operacional

5. **PARTE IV: Glossário Técnico e Tabela de Fórmulas Matemáticas**
   - Fórmula Oficial do BDI (Acórdão 2622/2013 TCU)
   - Retenção Técnica Contratual (Lei 8.212 / IN RFB)
   - Regra Territorial do ISS na Construção Civil (LC 116/2003, Art. 3º, III)
   - Chave de Acesso Nacional da NFS-e (50 Dígitos Módulo 11)

6. **🚀 PRÓXIMA FASE: Fase 10 - Tax Intelligence & IA**

---

# 1. VISÃO GERAL DA PLATAFORMA GADAP HUB

### 1.1 A Dor do Mercado da Construção Civil
A grande maioria das construtoras e empreiteiras de médio porte no Brasil opera de forma fragmentada:
- Planilhas paralelas em Excel com fórmulas corrompidas;
- Divergências recorrentes entre as medições de campo apontadas pelo engenheiro e o faturamento emitido pelo departamento financeiro;
- Glosas e atrasos de pagamento causados por erro no cálculo de retenções técnicas (5% a 10%) e bitributação de ISS;
- Falta de controle sobre o saldo residual dos contratos, levando a estouros orçamentários involuntários.

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
  │ 6. NFS-e    │ <── │ 5. MEDIÇÃO  │ <───┴─────────────┴────────────┘
  │  Faturamento│     │  Lançar &   │
  │  Nacional   │     │  Aprovar    │
  └─────────────┘     └─────────────┘
```

---

### PASSO 1: Acesso Inicial e Boas-Vindas
1. Acesse o portal web através da URL fornecida (ex: `http://localhost:3000/login` ou seu domínio corporativo).
2. Insira as credenciais iniciais da empresa de teste ou de sua organização:
   - **E-mail:** `admin@teste.com`
   - **Senha:** `admin123`
3. Ao entrar, o sistema valida a sessão JWT e carrega o painel exclusivo da sua empresa com isolamento RLS.

---

### PASSO 2: Cadastro do Primeiro Cliente Tomador (PF ou PJ)
Antes de cadastrar qualquer obra, é obrigatório registrar o cliente tomador do serviço.
1. No menu superior, clique em **Clientes** (`/dashboard/clientes`).
2. Clique no botão **"Novo Cliente"**.
3. Selecione o tipo de pessoa:
   - **Pessoa Jurídica (PJ):** Informe CNPJ, Razão Social, Nome Fantasia, Inscrição Estadual/Municipal, e-mail do setor financeiro e endereço completo com código IBGE.
   - **Pessoa Física (PF):** Informe Nome Completo, CPF, RG e contato.
4. Clique em **"Salvar Cliente"**. O cliente agora está disponível no seletor de obras.

> [!TIP]
> **Dica de Sucesso:** O preenchimento correto do município do cliente e da obra é essencial para o correto enquadramento da alíquota do ISS no faturamento posterior.

---

### PASSO 3: Cadastro da Obra, Contrato e Insumos
1. No menu **Fornecedores** (`/dashboard/fornecedores`), cadastre seus principais parceiros (concreto, aço, locação de equipamentos).
2. Acesse **Obras** (`/dashboard/obras`) e clique em **"Nova Obra"**.
3. Preencha os dados contratuais:
   - **Nome da Obra:** Ex: *"Residencial Alphaville"* ou *"Ampliação Galpão Logístico"*.
   - **Cliente Vinculado:** Selecione o cliente cadastrado no Passo 2.
   - **CNO (Cadastro Nacional de Obras):** Número do registro na Receita Federal.
   - **Valor Global do Contrato:** Valor total contratado (ex: `R$ 500.000,00`).
   - **% Retenção Técnica:** Percentual padrão estipulado em contrato (ex: 5,00%).
4. Clique em **"Salvar Obra"**.

---

### PASSO 4: Elaboração do Orçamento com BDI Oficial
1. Acesse **Orçamentos** (`/dashboard/orcamentos`) e clique em **"Novo Orçamento BDI"**.
2. Preencha os custos diretos previstos para insumos e serviços.
3. Parametrize as taxas do **BDI (Benefícios e Despesas Indiretas)** conforme Acórdão 2622/2013 TCU (AC, S, R, G, DF, L, I).
4. O motor matemático do GADAP calcula o multiplicador BDI e apresenta o preço de venda e margens seguras.

---

### PASSO 5: Lançamento e Aprovação da Medição de Campo
1. Na lista de Obras, localize a obra e clique no botão **"Medições"** (`/dashboard/obras/{id}/medicoes`).
2. Clique em **"Lançar Medição"**.
3. Informe o período de apuração (início e fim) e o valor bruto medido dos serviços no canteiro.
4. **Cálculo Determinístico:** O backend Python calcula automaticamente:
   - Retenção Técnica: `R$ Valor Medido x % Retenção`
   - Valor Líquido Apurado: `R$ Valor Medido - Retenção`
5. Salve o boletim (status inicial: *"Rascunho"*).
6. O engenheiro ou diretor clica em **"Aprovar Medição"**. A medição é consolidada e liberada com status **"Aprovada"**.

---

### PASSO 6: Faturando a Medição da Obra com NFS-e (Padrão Nacional)
Com a medição aprovada, o GADAP Hub permite transformar o avanço físico em faturamento fiscal oficial em um único clique:

1. **Acesso à Ação Fiscal**:
   - Na tabela de medições da obra, identifique a linha da medição com status **"Aprovada"**.
   - O sistema habilitará o botão de ação rápida: **"Emitir NFS-e"** (ícone roxo com destaque executivo).

2. **Clique e Disparo da Transmissão**:
   - Ao clicar em **"Emitir NFS-e"**, a aplicação aciona o endpoint `/api/v1/fiscal/invoices/issue-nfse` via TanStack Query.
   - O backend inicia o pipeline de emissão em tempo real:
     - **Regra Territorial do ISS (Art. 3º, III da LC 116/2003):** O motor tributário compara o código IBGE do prestador com o município do canteiro da obra. Se forem distintos, o ISS é **obrigatoriamente retido na fonte pelo tomador** (`iss_retained = True`). Se forem iguais, o ISS é recolhido pelo prestador.
     - **Certificado Digital A1 em Memória:** O certificado ICP-Brasil (.pfx) é descriptografado estritamente em memória RAM. Nenhuma chave privada é salva em disco.
     - **Chave de Acesso Nacional:** Gera a chave canônica de 50 dígitos calculada com Dígito Verificador Módulo 11 (pesos cíclicos de 2 a 9).
     - **Geração de XML e JSON Sped Nacional:** Monta o XML canônico da DPS (`<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">`) e transmite via HTTPS mTLS.

3. **Armazenamento Seguro em Nuvem (Supabase Storage)**:
   - Uma vez autorizada pela Receita Federal, o XML assinado e o espelho oficial **DANFSE (PDF)** são armazenados no bucket seguro `xml-fiscais` sob o caminho `{tenant_id}/{access_key}.pdf`.

4. **Notificação Proativa via WhatsApp (Evolution API)**:
   - O tomador do serviço recebe imediatamente em seu WhatsApp um resumo executivo com os dados da medição, valores líquidos, alíquotas retidas e o arquivo PDF do DANFSE em anexo.

5. **Visualização Imediata e Presigned URL**:
   - A tela de Medições é atualizada automaticamente para o status **"Faturada (NFS-e)"**.
   - O botão de ação é substituído por **"Visualizar PDF"**. Ao clicar, o sistema gera uma **Presigned URL** do Supabase Storage com validade de 1 hora, abrindo o documento fiscal oficial diretamente no navegador.

---

# PARTE II: CURSO PRÁTICO INTEGRADO
## "Dominando a Gestão de Obras no GADAP Hub"
*Carga Horária Estimada: 15 minutos • Foco: Produtividade, Eliminação de Retrabalho e Compliance Fiscal*

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

---

# 🚀 PRÓXIMA FASE

> ### 🚀 DECLARAÇÃO OFICIAL DE PRÓXIMO PASSO
> **Fase 9 (NFS-e) 100% Concluída! O ERP está totalmente operacional.**  
> **Vamos iniciar agora a FASE 10: TAX INTELLIGENCE (OCR de comprovantes e IA de monitoramento legal).**
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
        fontSize=11,
        leading=14,
        textColor=HexColor("#334155"),
        fontName="Helvetica",
    )
    meta_style = ParagraphStyle(
        "MetaText",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
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
        leading=13,
        textColor=HexColor("#047857"),
        fontName="Helvetica-Bold",
        spaceBefore=8,
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "BodyCustom",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=11.5,
        textColor=HexColor("#1e293b"),
        fontName="Helvetica",
        spaceAfter=4,
    )
    bullet_style = ParagraphStyle(
        "BulletCustom",
        parent=body_style,
        leftIndent=14,
        firstLineIndent=-8,
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
    next_phase_style = ParagraphStyle(
        "NextPhaseTitle",
        parent=styles["Heading1"],
        fontSize=12,
        leading=15,
        textColor=HexColor("#4338ca"),
        fontName="Helvetica-Bold",
    )

    story = []

    # Cabeçalho Principal
    story.append(Paragraph("GADAP Hub • Enterprise Construction ERP", title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Manual de Onboarding, Guia Rápido de 1ª Utilização e Curso Prático Integrado", subtitle_style))
    story.append(Paragraph("Documento Oficial de Treinamento e Sucesso do Cliente Piloto • Versão 2.0 (Release Fiscal & NFS-e)", meta_style))
    story.append(Spacer(1, 10))

    # Box de Governança
    box_data = [[
        Paragraph(
            "<b>NOTA DE GOVERNANÇA:</b> Este manual documenta os fluxos operacionais, regras determinísticas "
            "de cálculo da Lei Complementar 116/2003, salvaguardas contratuais e a emissão oficial de NFS-e no "
            "Padrão Nacional da Receita Federal.",
            callout_style,
        )
    ]]
    t_gov = Table(box_data, colWidths=[520])
    t_gov.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#ecfdf5")),
        ("BOX", (0, 0), (-1, -1), 1, HexColor("#a7f3d0")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(t_gov)
    story.append(Spacer(1, 12))

    # PARTE I: GUIA RÁPIDO
    story.append(Paragraph("PARTE I: GUIA RÁPIDO DE 1ª UTILIZAÇÃO", h1_style))
    story.append(Paragraph("Passo a passo objetivo para operar a plataforma do login ao faturamento oficial da medição:", body_style))
    story.append(Spacer(1, 4))

    passos = [
        ("Passo 1: Acesso Inicial e Boas-Vindas", "Faça login com as credenciais administrativas (admin@teste.com). O sistema valida a sessão JWT e isola o tenant via Row Level Security (RLS)."),
        ("Passo 2: Cadastro do Cliente Tomador", "No menu Clientes (/dashboard/clientes), cadastre o tomador (PJ ou PF) informando CNPJ, Razão Social e Código IBGE do município."),
        ("Passo 3: Cadastro da Obra e Contrato", "No menu Obras (/dashboard/obras), cadastre a obra com seu CNO (Cadastro Nacional de Obras), Valor Global e percentual de Retenção Técnica padrão (5%)."),
        ("Passo 4: Elaboração do Orçamento com BDI", "No menu Orçamentos, monte as composições de custos e aplique a fórmula analítica do BDI conforme Acórdão 2622/2013 do TCU."),
        ("Passo 5: Lançamento e Aprovação da Medição", "No painel de medições (/dashboard/obras/{id}/medicoes), lance o boletim físico-financeiro. O backend calcula compulsoriamente a retenção e o líquido. Aprove a medição para liberar o faturamento fiscal."),
        ("Passo 6: Faturando a Medição com NFS-e (Padrão Nacional)", 
         "Com a medição aprovada, clique no botão <b>'Emitir NFS-e'</b>. O motor fiscal valida a competência territorial do ISS (LC 116/2003, Art. 3º, III), "
         "descriptografa o Certificado A1 em memória RAM, gera a DPS canônica com Chave de 50 dígitos (Módulo 11), salva XML e PDF no Supabase Storage "
         "('xml-fiscais') e despacha o comprovante via WhatsApp (Evolution API). O botão passa a exibir <b>'Visualizar PDF'</b> através de Presigned URL segura."),
    ]

    for titulo, desc in passos:
        story.append(Paragraph(f"• <b>{titulo}</b>", h2_style))
        story.append(Paragraph(desc, bullet_style))
        story.append(Spacer(1, 2))

    # Quebra de página deliberada para equilíbrio visual perfeito
    story.append(PageBreak())

    # PÁGINA 2
    story.append(Paragraph("PARTE II: CURSO PRÁTICO INTEGRADO (ACADEMY)", h1_style))
    story.append(Paragraph("<b>Módulo 1: Navegando no Dashboard</b> — Acompanhe Contrato Global, Saldo Residual e Curva Físico-Financeira em tempo real, sem planilhas paralelas.", body_style))
    story.append(Paragraph("<b>Módulo 2: Ciclo de Vida da Obra</b> — Rastreabilidade completa com CNO, ART e boletins de medição numerados sequencialmente e auditáveis.", body_style))
    story.append(Paragraph("<b>Módulo 3: Faturamento Matemático e Compliance</b> — Trava de 100% que impede supermedições e segregação territorial de retenção do ISS.", body_style))
    story.append(Spacer(1, 10))

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
            Paragraph("<b>Chave de Acesso Nacional</b>", body_style),
            Paragraph("50 dígitos estruturados com Código IBGE, Tipo de Inscrição, CNPJ, Série, Número da DPS, Código de Segurança e Dígito Verificador Módulo 11.", body_style)
        ],
        [
            Paragraph("<b>BDI Analítico TCU</b>", body_style),
            Paragraph("Acórdão 2622/2013 TCU: Aplicação das taxas de Administração Central (AC), Seguros (S), Riscos (R), Garantias (G), Despesas Financeiras (DF), Lucro (L) e Tributos (I).", body_style)
        ],
    ]
    t_trib = Table(tributos_info, colWidths=[130, 390])
    t_trib.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 1, HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_trib)
    story.append(Spacer(1, 14))

    # BLOCO OFICIAL DA PRÓXIMA FASE
    story.append(Paragraph("🚀 PRÓXIMA FASE", next_phase_style))
    phase_box = [[
        Paragraph(
            "<b>DECLARAÇÃO OFICIAL DE PRÓXIMO PASSO:</b><br/>"
            "<b>Fase 9 (NFS-e) 100% Concluída! O ERP está totalmente operacional.</b><br/>"
            "Vamos iniciar agora a <b>FASE 10: TAX INTELLIGENCE</b> (OCR de comprovantes e IA de monitoramento legal).",
            body_style,
        )
    ]]
    t_phase = Table(phase_box, colWidths=[520])
    t_phase.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#eef2ff")),
        ("BOX", (0, 0), (-1, -1), 1.5, HexColor("#6366f1")),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(t_phase)

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
