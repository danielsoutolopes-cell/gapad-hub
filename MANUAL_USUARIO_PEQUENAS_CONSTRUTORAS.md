# 🏗️ Manual Completo do Usuário — GADAP Hub para Pequenas Construtoras

**Versão:** 2.4 Enterprise • **ERP Web:** `/dashboard` • **PWA de Campo:** [https://gadap-field.vercel.app/](https://gadap-field.vercel.app/)

---

## Sumário
1. [Introdução, Hierarquia de Usuários e Segurança](#1-introdução-hierarquia-de-usuários-e-segurança)
2. [Cadastro de Clientes, Obras e Cronograma Editável (WBS)](#2-cadastro-de-clientes-obras-e-cronograma-editável-wbs)
3. [PWA Blindado de Campo (`GADAP Field`) — Operação Diária](#3-pwa-blindado-de-campo-gadap-field--operação-diária)
4. [Inteligência Climática (OpenWeatherMap) & Relatórios PF / SPE](#4-inteligência-climática-openweathermap--relatórios-pf--spe)
5. [Medições Físico-Financeiras & Sugestão Automática por Delta WBS](#5-medições-físico-financeiras--sugestão-automática-por-delta-wbs)
6. [Suprimentos, Radar Regional (30 Dias) & Recebimento 3-Way Match](#6-suprimentos-radar-regional-30-dias--recebimento-3-way-match)
7. [RH, Ponto GPS, Aprendizado de Apelidos & Folha de Pagamento](#7-rh-ponto-gps-aprendizado-de-apelidos--folha-de-pagamento)
8. [Financeiro, DRE, Exportações Auditáveis & LGPD](#8-financeiro-dre-exportações-auditáveis--lgpd)

---

## 1. Introdução, Hierarquia de Usuários e Segurança
O **GADAP Hub** opera com **isolamento hermético multi-tenant**: cada construtora enxerga exclusivamente suas próprias obras, SKUs, funcionários e dados financeiros.

- **Perfis de Acesso (`/dashboard/usuarios`)**:
  - **Diretor / Sócio Administrador (`admin`)**: Acesso total à construtora, DRE, fechamento de folha e aprovações financeiras.
  - **Engenheiro Residente / Gestor de Obras**: Cronogramas, medições, aprovações de aditivos e relatórios climáticos.
  - **Comprador / Suprimentos**: Mapas de cotação, Radar Regional e conferência de notas fiscais.
  - **Mestre de Obras / Apontador**: Opera exclusivamente no **PWA Blindado (`https://gadap-field.vercel.app/`)**, sem acesso a margens, salários ou DRE do escritório.
- **Privacidade do Superusuário**: O administrador da plataforma gerencia planos e empresas, mas nunca visualiza dados financeiros, salariais ou operacionais das construtoras.

---

## 2. Cadastro de Clientes, Obras e Cronograma Editável (WBS)
1. **Clientes (`/dashboard/clientes`)**: Cadastre Pessoa Física (PF) ou Pessoa Jurídica / SPE (CNPJ com preenchimento automático).
2. **Obras (`/dashboard/obras`)**:
   - Informe o **Valor do Contrato** (ex: `R$ 500.000,00`) e a **Retenção Técnica** contratual (ex: `5%`).
   - Ao criar a obra, o sistema gera um **Cronograma Físico-Financeiro Editável (WBS)** dividido em etapas (*Fundações*, *Estrutura*, *Alvenaria*, *Instalações*, *Acabamentos*), permitindo ajustar prazos e o peso financeiro (%) de cada fase.

---

## 3. PWA Blindado de Campo (`GADAP Field`) — Operação Diária
Acesse **[https://gadap-field.vercel.app/](https://gadap-field.vercel.app/)** no celular (Android/iOS) usando o mesmo e-mail e senha do ERP e adicione à tela inicial:

1. **Aba `Medição` (Diário + Avanço + Fotos + Clima + Presença)**:
   - Selecione a **Obra Ativa** e a **Etapa da WBS**.
   - Arraste a **barra de rolagem (%)** para informar o avanço acumulado ou do dia.
   - Toque em **`📍 Detectar via GPS`** para capturar o clima oficial via **OpenWeatherMap** (Sol, Nublado, Chuva Leve ou Chuva Forte) e registrar eventual paralisação (`0d`, `0.5d` ou `1d`).
   - Tire até **3 fotos** pela câmera do celular.
   - Digite os nomes da **Equipe Presente no formato WhatsApp** (ex: *"João Silva, Marcos Pedreiro, Tonhão"*).
   - Ao enviar, o sistema gera um **Recibo Auditável com Hash SHA-256** e coordenadas GPS.
2. **Aba `Caixinha` (Despesas Rápidas de Canteiro)**:
   - Registre compras emergenciais (pregos, discos de corte, água, fretes) informando valor e forma de pagamento (**Pix / Reembolso** ou **Dinheiro / Fundo Fixo**), abatendo automaticamente do custo da obra.
3. **Aba `Ponto`, `Pedir`, `Receber` e `WBS`**:
   - **Ponto**: Validação de cerca virtual GPS (Geofencing).
   - **Pedir**: Requisição de materiais em texto livre via IA/NLP.
   - **Receber**: Conferência física de entregas totais ou parciais de notas fiscais.
   - **WBS**: Consulta de etapas e envio de solicitações de Aditivo / Extra ao escritório.

---

## 4. Inteligência Climática (OpenWeatherMap) & Relatórios PF / SPE
- Rota analítica: `GET /api/v1/projects/{id}/weather-impact-report`
- **O que o sistema entrega**:
  - **Dias Úteis Previstos vs. Dias Efetivamente Trabalhados** na semana ou no mês.
  - **Deslocamento Automático do Cronograma (*Excusable Delay*)**: Cada dia perdido por chuva forte desloca a previsão de entrega sem gerar multa contratual.
  - **Relatório para Cliente PF**: Linguagem clara explicando os dias trabalhados, dias de chuva e fotos comprobatórias.
  - **Relatório para Cliente SPE / Incorporadora**: Formato técnico de **RDO Consolidado** com percentual de eficiência produtiva e justificativa formal de força maior climática.

---

## 5. Medições Físico-Financeiras & Sugestão Automática por Delta WBS
Ao emitir uma nova cobrança por medição no escritório, você pode ativar (opcionalmente) a **Sugestão Inteligente por Delta WBS** (`POST /api/v1/projects/{id}/measurement-suggestion`):
- **Exemplo Prático**:
  - Etapa *Fundações* tem peso de `20%` sobre um contrato de `R$ 500.000,00` (`R$ 100.000,00` alocados).
  - Última medição faturada: `5%`. Avanço atual informado pelo mestre no PWA: `15%`.
  - O sistema calcula o **Delta (`15% - 5% = 10%`)** e sugere automaticamente **`R$ 10.000,00` brutos** (`R$ 9.500,00` líquidos após retenção técnica de 5%).
- Caso prefira lançar um valor manual avulso, basta desativar a sugestão automática.

---

## 6. Suprimentos, Radar Regional (30 Dias) & Recebimento 3-Way Match
1. **Requisições & Cotações (`/dashboard/suprimentos`)**: Converta pedidos do canteiro em mapas de cotação com link público para fornecedores.
2. **Radar de Melhores Compras Regionais (`POST /api/v1/procurement/regional-best-prices`)**:
   - Compara o preço cotado com compras reais efetuadas na mesma cidade/UF nos últimos **30 dias**, de forma **100% anonimizada (LGPD-Safe)**.
   - Se outra compra recente na região obteve preço menor (ex: Cimento na *Loja Pássaro* 28% mais barato), o sistema alerta imediatamente sem expor dados de terceiros.
3. **3-Way Match Fiscal**: Cruza Pedido de Compra $\times$ XML da NF-e $\times$ Conferência Física no PWA antes de liberar o pagamento.

---

## 7. RH, Ponto GPS, Aprendizado de Apelidos & Folha de Pagamento
- **Aprendizado Contínuo de Apelidos (`POST /api/v1/hr/attendance/resolve-aliases`)**:
  - Quando o mestre envia uma lista de presença e o sistema não reconhece um apelido (ex: *"Tonhão"*), um aviso automático é exibido.
  - Ao vincular *"Tonhão"* ao colaborador oficial (*Antônio Carlos*) via `/employees/learn-alias`, o sistema aprende definitivamente e reconhece automaticamente nos próximos pontos.
- **Folha de Pagamento (`/dashboard/rh/folha`)**:
  - Suporte completo a salário base, horas extras, faltas, **dissídios retroativos, PLR, bônus e prêmios (Art. 457 § 2º CLT)**, além de descontos legais (INSS, IRRF, VT 6%, VA/PAT e Plano de Saúde).
  - **Fechamento Atômico**: Gera automaticamente os **5 títulos no Contas a Pagar** (Salários Líquidos, INSS, IRRF, FGTS Digital e Benefícios).

---

## 8. Financeiro, DRE, Exportações Auditáveis & LGPD
- **Fluxo de Caixa & DRE (`/dashboard/financeiro`)**: Visão consolidada por obra e centro de custo.
- **Exportações Seguras (`.xlsx` / PDF)**: Toda planilha exportada recebe **Marca d'Água LGPD** (CNPJ e Razão Social) e **Hash Criptográfico SHA-256** no rodapé, com proteção de *Rate-Limiting* por tenant (100 req/min).
- **Conformidade LGPD**: CPFs, e-mails e telefones são mascarados automaticamente nas listagens e exportações.
