# GADAP Hub • Enterprise Construction ERP
## Manual de Onboarding, Guia Rápido de 1ª Utilização e Curso Prático Integrado
**Documento Oficial de Treinamento e Sucesso do Cliente Piloto**  
*Versão: 1.0 (Release Piloto) • Publicação: Outubro/2026 • GADAP Technologies*

---

> ### 📌 NOTA DE GOVERNANÇA & CONFIDENCIALIDADE
> Este manual foi elaborado pelo time de Engenharia de Sucesso e Arquitetura do **GADAP-ERP** para capacitar novos clientes pilotos, diretores técnicos, engenheiros de campo e gestores financeiros. O conteúdo documenta fielmente os fluxos operacionais, regras determinísticas de cálculo e salvaguardas da plataforma.

---

# SUMÁRIO GERAL

1. **Visão Geral da Plataforma GADAP Hub**
   - 1.1 A Dor do Mercado da Construção Civil
   - 1.2 A Solução GADAP: Eliminação do Caos de Planilhas e Retrabalho
   - 1.3 Arquitetura de Isolamento Hermético Multi-tenant (RLS)

2. **PARTE I: Guia Rápido de 1ª Utilização (Do Login ao Primeiro Faturamento)**
   - Passo 1: Acesso Inicial e Configuração do Usuário
   - Passo 2: Cadastro do Primeiro Cliente Tomador (PF / PJ)
   - Passo 3: Cadastro de Fornecedores e Insumos da Obra
   - Passo 4: Elaboração do Orçamento e Aplicação da Margem BDI Oficial
   - Passo 5: Abertura e Vinculação da Obra / Contrato
   - Passo 6: Lançamento do 1º Boletim de Medição Físico-Financeira
   - Passo 7: Conferência da Retenção Técnica e Aprovação para Faturamento Financeiro

3. **PARTE II: Curso Prático Integrado: "Dominando a Gestão de Obras no GADAP Hub"**
   - Módulo 1: Navegando no Dashboard e Visão Geral da Obra
   - Módulo 2: O Ciclo de Vida da Obra (do Contrato ao Apontamento de Campo)
   - Módulo 3: A Mágica Matemática do Faturamento (Retenções, Trava de 100% e Compliance)

4. **PARTE III: Manual do Administrador da Plataforma (Área Restrita Master)**
   - 4.1 Torre de Controle Global (God Mode)
   - 4.2 O Botão "Zerar Dados / Reset Ambiente": Finalidade e Limites
   - 4.3 Alerta Crítico de Irreversibilidade Operacional
   - 4.4 Preservação de Logins e Contas no Supabase Auth

5. **PARTE IV: Glossário Técnico e Tabela de Fórmulas Matemáticas**
   - Fórmula Oficial do BDI (Acórdão 2622/2013 TCU)
   - Retenção Técnica Contratual (Lei 8.212 / IN RFB)
   - Trava de Exaustão de Contrato (100%)

---

# 1. VISÃO GERAL DA PLATAFORMA GADAP HUB

### 1.1 A Dor do Mercado da Construção Civil
A grande maioria das construtoras e empreiteiras de médio porte no Brasil opera de forma fragmentada:
- Planilhas paralelas em Excel com fórmulas corrompidas;
- Divergências recorrentes entre as medições de campo apontadas pelo engenheiro e o faturamento emitido pelo departamento financeiro;
- Glosas e atrasos de pagamento causados por erro no cálculo de retenções técnicas (5% a 10%);
- Falta de controle sobre o saldo residual dos contratos, levando a estouros orçamentários involuntários.

### 1.2 A Solução GADAP Hub
O **GADAP Hub** centraliza o ciclo de vida completo da engenharia e da gestão financeira em uma única plataforma web de alta performance. Os cálculos fiscais, retenções e orçamentos operam através de motores determinísticos no backend, impedindo divergências aritméticas entre a obra e o faturamento.

### 1.3 Arquitetura de Isolamento Hermético Multi-tenant (RLS)
Cada construtora cliente possui seu ambiente totalmente isolado. No nível de banco de dados, o Supabase PostgreSQL impõe **Row Level Security (RLS)** inegociável em todas as tabelas: nenhum cliente enxerga orçamentos, obras, medições ou lançamentos financeiros de outra empresa.

---

# PARTE I: GUIA RÁPIDO DE 1ª UTILIZAÇÃO
### Passo a Passo Objetivo: Do Login ao Primeiro Faturamento

```
  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  │ 1. LOGIN    │ ──> │ 2. CLIENTE  │ ──> │ 3. OBRA     │ ──> │ 4. MEDIÇÃO  │
  │ admin@teste │     │  Cadastrar  │     │  Vincular   │     │  Lançar com │
  │             │     │  Tomador PJ │     │  Contrato   │     │  Retenção 5%│
  └─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                     │
                                                              ┌──────▼──────┐
                                                              │ 5. FINANÇAS │
                                                              │  Aprovar e  │
                                                              │  Faturar    │
                                                              └─────────────┘
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
   - **Pessoa Jurídica (PJ):** Informe CNPJ, Razão Social, Nome Fantasia, Inscrição Estadual/Municipal, e-mail do setor de contas a pagar e endereço completo.
   - **Pessoa Física (PF):** Informe Nome Completo, CPF, RG e contato.
4. Clique em **"Salvar Cliente"**. O cliente agora está disponível no seletor de obras.

> [!TIP]
> **Dica de Sucesso:** O preenchimento correto do município do cliente é essencial para o correto enquadramento da alíquota do ISS no faturamento posterior.

---

### PASSO 3: Cadastro de Fornecedores e Insumos
1. No menu **Fornecedores** (`/dashboard/fornecedores`), cadastre seus principais parceiros (concreto, aço, locação de andaimes, empreiteiros de mão de obra).
2. Nos menus **Produtos / Insumos** e **Serviços**, confira a tabela de preços-base utilizada para as composições de custos diretos.

---

### PASSO 4: Elaboração do Orçamento com BDI Oficial
1. Acesse **Orçamentos** (`/dashboard/orcamentos`) e clique em **"Novo Orçamento BDI"**.
2. Preencha os custos diretos previstos para os insumos e serviços da obra.
3. Defina os percentuais das taxas do **BDI (Benefícios e Despesas Indiretas)** de acordo com as particularidades da sua construtora:
   - **AC:** Administração Central (ex: 4,00%)
   - **S:** Seguro da Obra (ex: 0,80%)
   - **R:** Riscos e Imprevistos (ex: 1,20%)
   - **G:** Garantia Contratual (ex: 0,40%)
   - **DF:** Despesas Financeiras (ex: 1,23%)
   - **L:** Lucro Bruto Operacional (ex: 7,40%)
   - **I:** Tributos Incidentes (ISS, PIS, COFINS, CPRB) (ex: 8,65%)
4. O motor matemático do GADAP calcula o multiplicador BDI e apresenta o preço de venda final sugerido.

---

### PASSO 5: Cadastro da Obra / Contrato
1. Acesse **Obras** (`/dashboard/obras`) e clique em **"Nova Obra"**.
2. Preencha os dados contratuais:
   - **Nome da Obra:** Ex: *"Edifício Residencial Alpha"* ou *"Reforma Centro Logístico"*.
   - **Cliente Vinculado:** Selecione o cliente cadastrado no Passo 2.
   - **Valor Global do Contrato:** Valor total contratado (ex: `R$ 500.000,00`).
   - **Data de Início e Prazo Estimado:** Cronograma físico acordado.
   - **Status:** Selecione *"Em Execução"*.
3. Clique em **"Salvar Obra"**. A obra passará a constar na tabela central com seus cards de saldo contratual.

---

### PASSO 6: Lançamento do 1º Boletim de Medição Físico-Financeira
1. Na lista de Obras, localize a obra cadastrada e clique no botão **"Medições"** (ícone de régua/prancheta).
2. Você será direcionado para o painel de medições da obra: `/dashboard/obras/{id}/medicoes`.
3. Clique em **"Lançar Medição"**.
4. No formulário do boletim:
   - **Período de Medição:** Defina a data de início e a data de término do período medido (ex: 01/10/2026 a 31/10/2026).
   - **Valor Medido Bruto:** Digite o valor dos serviços efetivamente executados no campo (ex: `R$ 50.000,00`).
   - **% de Retenção Técnica:** O sistema sugere o padrão contratual de **5,00%** (editável conforme contrato).
5. **UX em Tempo Real:** Observe que, enquanto você digita, o GADAP exibe a prévia imediata:
   - Retenção Técnica: `R$ 2.500,00`
   - **Valor Líquido a Receber:** `R$ 47.500,00`
6. Clique em **"Salvar e Enviar Medição"**.

---

### PASSO 7: Aprovação da Medição e Integração Financeira
1. A medição recém-criada é exibida com status **"Pendente"**.
2. O engenheiro responsável ou diretor de operações revisa os apontamentos e clica em **"Aprovar Medição"**.
3. **Mágica da Integração:** Ao aprovar:
   - O status da medição muda para **"Aprovada"**;
   - Uma entrada financeira de **Conta a Receber** é gerada automaticamente no módulo Financeiro (`/dashboard/financeiro`), já com o valor líquido de `R$ 47.500,00` e vencimento parametrizado;
   - O saldo restante do contrato da obra é reduzido em tempo real, mantendo a integridade contra estouro de saldo.

---

# PARTE II: CURSO PRÁTICO INTEGRADO
## "Dominando a Gestão de Obras no GADAP Hub"
*Carga Horária Estimada: 15 minutos • Foco: Produtividade, Eliminação de Retrabalho e Compliance Fiscal*

---

### MÓDULO 1: Navegando no Dashboard e Visão Geral da Obra

#### 1. Contexto e Objetivos de Aprendizagem
O primeiro desafio de um gestor de obras é ter a visão consolidada de todos os seus canteiros sem precisar abrir dez planilhas distintas. Neste módulo, você aprende a interpretar os indicadores de saúde física e financeira de cada projeto.

#### 2. Os 3 Pilares da Gestão 360°
- **Painel Consolidado de Contratos:** Visualize instantaneamente o montante total contratado, o total já medido/faturado e o saldo contratual remanescente.
- **Filtros Ágeis por Cliente e Andamento:** Localize obras ativas, em planejamento ou concluídas, sabendo exatamente quem é o tomador do serviço.
- **Previsibilidade de Fluxo de Caixa:** Antecipe o volume de medições a serem faturadas antes do fechamento contábil mensal, evitando surpresas no contas a pagar da construtora.

#### 3. Checklist Prático do Módulo 1
- [ ] Acessar `/dashboard/obras` e identificar os cards de Valor Global e Status;
- [ ] Filtrar as obras pelo status "Em Execução";
- [ ] Navegar até os detalhes do cliente tomador para conferência cadastral.

---

### MÓDULO 2: O Ciclo de Vida de uma Obra (do Contrato ao Apontamento de Campo)

#### 1. Da Assinatura do Contrato ao Canteiro
Uma obra no GADAP Hub não nasce de uma simples estimativa informal; ela segue um ciclo de governança estruturado:
1. **Cadastro do Tomador:** Vinculação estrita da empresa contratante;
2. **Orçamento e BDI:** Definição da margem operacional e custos diretos;
3. **Abertura do Contrato de Obra:** Fixação do teto global financeiro;
4. **Apontamentos Mensais:** Lançamento de boletins periódicos pelo engenheiro de campo.

#### 2. Eliminação do Telefone sem Fio entre Campo e Escritório
Tradicionalmente, o engenheiro preenche um caderno de campo ou planilha local, envia por e-mail para a sede, onde um digitador insere os dados no ERP financeiro. Esse processo causa até 18% de divergências aritméticas.  
No GADAP Hub, o próprio engenheiro ou apontador registra a medição diretamente na interface web da obra. O cálculo é feito pelo servidor em microssegundos.

#### 3. Checklist Prático do Módulo 2
- [ ] Criar uma nova obra de demonstração vinculada a um cliente existente;
- [ ] Definir o valor do contrato em R$ 100.000,00 com data de vigência de 6 meses;
- [ ] Abrir a tela de medições físico-financeiras da obra recém-criada.

---

### MÓDULO 3: A Mágica Matemática por trás do Faturamento (Retenções)

#### 1. O que é a Retenção Técnica?
A **Retenção Técnica** (usualmente entre 5% e 10%) é uma garantia prevista em contratos civis e na legislação previdenciária (IN RFB). O tomador do serviço retém uma parcela do valor medido bruto para assegurar a entrega definitiva da obra e cobrir eventuais encargos trabalhistas de subempreiteiros.
- **Importante:** A retenção técnica **NÃO é um desconto comercial** nem perda de faturamento. É um valor retido que pertence à sua construtora e que deve ser liberado pelo cliente após a emissão do Termo de Recebimento Definitivo da Obra (TRD).

#### 2. Cálculo Determinístico no Backend
No GADAP Hub, o frontend nunca envia o valor líquido calculado no navegador. O usuário informa apenas o valor bruto e a taxa contratual:
$$\text{Valor da Retenção} = \text{Valor Medido Bruto} \times \left(\frac{\%\text{ Retenção}}{100}\right)$$
$$\text{Valor Líquido a Receber} = \text{Valor Medido Bruto} - \text{Valor da Retenção}$$
O backend em Python e FastAPI realiza essa operação utilizando precisão decimal estrita (`Decimal` de 4 casas), garantindo exatidão com o que será impresso na Nota Fiscal de Serviço (NFS-e).

#### 3. Simulação Visual de uma Medição Típica
| Componente da Medição | Valor Base | Explicação Prática |
| :--- | :--- | :--- |
| **Valor Medido Bruto** | `R$ 100.000,00` | Total de serviços civis realizados no período |
| **Retenção Técnica (5%)** | `- R$ 5.000,00` | Caução de garantia retida pelo tomador |
| **Valor Líquido a Faturar** | **`R$ 95.000,00`** | Montante que entrará no Contas a Receber e na NFS-e |

#### 4. Trava de Proteção dos 100% (Salvaguarda de Saldo)
Se a soma das medições acumuladas de uma obra ultrapassar o Valor Global do Contrato original, o sistema **bloqueia o registro** automaticamente. Para continuar medindo, a construtora é obrigada a formalizar um **Termo Aditivo Contratual**. Isso protege a construtora contra a prestação de serviços adicionais sem cobertura orçamentária.

#### 5. Checklist Prático do Módulo 3
- [ ] Simular uma medição de R$ 50.000,00 com 5% de retenção;
- [ ] Conferir se o valor líquido resultante é exatamente R$ 47.500,00;
- [ ] Aprovar a medição e verificar o lançamento correspondente no Contas a Receber.

---

# PARTE III: MANUAL DO ADMINISTRADOR DA PLATAFORMA
## Área Restrita (Master) • Backoffice God Mode

O módulo Master é o painel de governança central reservado exclusivamente ao dono da plataforma SaaS ou ao Super Administrador com privilégios `is_superadmin = true`.

---

### 4.1 Torre de Controle Global (God Mode)
Acessível pela rota `/backoffice`, o painel Master fornece métricas globais e infraestruturais consolidadas:
- **Total de Empresas (Tenants):** Número de instâncias ativas no banco de dados;
- **MRR SaaS Consolidado:** Receita recorrente mensal acumulada da plataforma;
- **Total de Usuários Globais:** Quantidade de engenheiros, faturistas e administradores cadastrados em todos os tenants;
- **Obras Ativas Globais:** Total de canteiros em operação no ecossistema;
- **Tabela de Tenants:** Listagem detalhada de todas as empresas clientes com filtros por Razão Social, CNPJ e e-mail.

---

### 4.2 O Botão "Zerar Dados / Reset Ambiente"
Na tabela de instâncias do backoffice, cada linha possui o botão administrativo **"Zerar Dados / Reset Ambiente"**.

#### Qual a finalidade desta ferramenta?
O botão foi projetado especificamente para:
1. **Ambientes de Demonstração (Presales):** Limpar dados fictícios de demonstrações comerciais anteriores para receber um novo prospect com a casa limpa;
2. **Tutoriais e Workshops de Onboarding:** Permitir que novos alunos ou clientes pilotos reiniciem o roteiro prático do zero quantas vezes forem necessárias;
3. **Homologação:** Sanitizar a base após baterias de testes de estresse.

---

### 4.3 Alerta Crítico de Irreversibilidade Operacional

> [!CAUTION]
> ### ⚠️ ATENÇÃO MÁXIMA: AÇÃO DESTRUTIVA IRREVERSÍVEL
> Ao confirmar o reset de um Tenant, uma rotina atômica em cascata no PostgreSQL expurga **PERMANENTEMENTE** todos os dados operacionais:
> - **Projetos/Obras:** Todas as obras registradas são excluídas;
> - **Medições:** Todos os boletins físico-financeiros são apagados;
> - **Financeiro:** Todos os lançamentos de Contas a Pagar e Contas a Receber são deletados;
> - **Orçamentos:** Todas as composições de BDI são expurgadas;
> - **Cadastros:** Todos os Clientes e Fornecedores vinculados à empresa são removidos.
>
> **NÃO HÁ COMO DESFAZER ESTA OPERAÇÃO APÓS A CONFIRMAÇÃO.**

---

### 4.4 Preservação de Logins e Contas de Acesso
Apesar do expurgo operacional rigoroso, o botão "Zerar Dados" possui uma salvaguarda fundamental:
- **A empresa continua existindo:** O registro raiz na tabela `companies` permanece intacto com seu CNPJ e razão social;
- **Os logins continuam funcionando:** Todos os usuários vinculados àquele Tenant e suas credenciais de acesso no Supabase Auth (`auth.users`) **são 100% preservados**.
- **Resultado Prático:** Nem o administrador nem os faturistas perdem suas senhas. Eles continuam conseguindo logar imediatamente e encontram o ambiente pronto para novo cadastro.

---

### 4.5 Salvaguardas no Frontend (Shadcn UI)
Para prevenir acidentes operacionais graves, o backoffice conta com dupla proteção:
1. **Tooltip Contextual:** Ao repousar o cursor sobre o botão, surge o aviso informativo:
   > *"Limpa todos os clientes, orçamentos, medições e dados financeiros deste Tenant. Ideal para resetar ambientes de Demonstração e Tutoriais."*
2. **AlertDialog Modal:** Ao clicar, um modal vermelho de confirmação bloqueia a tela, detalha exatamente o que será excluído e exige confirmação expressa do Super Admin.

---

# PARTE IV: GLOSSÁRIO TÉCNICO & FÓRMULAS OFICIAIS

### 1. Fórmula Oficial do BDI (Acórdão 2622/2013 - Plenário TCU)
$$BDI = \left[ \frac{(1 + AC + S + R + G) \times (1 + DF) \times (1 + L)}{(1 - I)} \right] - 1$$

Onde:
- **AC:** Taxa de Administração Central da Construtora
- **S:** Taxa de Seguros
- **R:** Taxa de Riscos e Incertezas da Obra
- **G:** Taxa de Garantias Contratuais
- **DF:** Taxa de Despesas Financeiras
- **L:** Margem de Lucro Bruto Operacional
- **I:** Incidência de Tributos (ISS, PIS, COFINS, CPRB)

---

### 2. Retenção Técnica vs Retenção Tributária
- **Retenção Técnica:** Caução civil contratual (5% a 10%) para assegurar a entrega da obra. Pertence à construtora e é restituída no término do contrato.
- **Retenção Tributária (INSS / ISS):** Obrigação legal em que o tomador recolhe impostos devidos na fonte diretamente aos cofres públicos (Receita Federal / Prefeitura). O GADAP-ERP separa rigorosamente essas duas naturezas para evitar glosas financeiras.

---

### 3. Checklist Rápido de Sucesso do Cliente Piloto
- [x] Login efetuado com isolamento RLS;
- [x] Cliente tomador cadastrado com CNPJ e Inscrição Municipal;
- [x] Obra criada com Valor Global do Contrato fixado;
- [x] Orçamento com BDI oficial formulado;
- [x] 1ª Medição físico-financeira apontada com retenção técnica automática;
- [x] Medição aprovada e Conta a Receber gerada no Financeiro;
- [x] Governança e Reset compreendidos para manutenção de instâncias.

---
*GADAP-ERP • Construindo o futuro da engenharia civil com tecnologia e integridade.*
