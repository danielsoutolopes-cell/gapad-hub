# GADAP Hub • Enterprise Construction ERP
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
