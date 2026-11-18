# 🏗️ Manual do Usuário — GADAP Hub para Pequenas Construtoras

**Versão:** 2.4 Enterprise • **PWA de Campo:** [https://gadap-field.vercel.app/](https://gadap-field.vercel.app/)

---

## 1. Visão Geral da Operação
O **GADAP Hub** foi projetado para conectar o **canteiro de obras** ao **escritório financeiro e ao RH** em tempo real, com isolamento hermético multi-tenant e conformidade total com a LGPD.

---

## 2. Gestão de Obras, Cronograma & Medições por Delta WBS
1. **Cadastro de Obras (`/dashboard/obras`)**:
   - Cadastre o cliente (PF ou SPE/Incorporadora), valor de contrato, retenção técnica (ex: 5%) e cronograma editável de etapas (Fundações, Estrutura, Alvenaria, Instalações, Acabamentos).
2. **Medição Inteligente por Delta**:
   - Ao emitir uma cobrança por medição, o sistema cruza o avanço físico informado pelo mestre de obras no PWA com a última medição faturada (`POST /api/v1/projects/{id}/measurement-suggestion`) e sugere automaticamente o valor exato da parcela.
3. **Relatório Climático (PF & SPE)**:
   - Consolida os dias úteis previstos vs. efetivamente trabalhados (`GET /api/v1/projects/{id}/weather-impact-report`), justificando atrasos por chuva (*Excusable Delay*) com dados oficiais da **OpenWeatherMap** e fotos do canteiro.

---

## 3. Suprimentos, Cotações & Radar Regional (30 Dias)
- **Requisições do Canteiro (NLP)**: O mestre de obras pede insumos por texto livre no PWA (`20 sacos de cimento CP2`).
- **Radar de Melhores Compras Regionais (`POST /api/v1/procurement/regional-best-prices`)**: Compara sua cotação com compras reais da mesma cidade nos últimos 30 dias de forma **100% anonimizada (LGPD-Safe)**, alertando se houver fornecedor mais barato na região.
- **Conferência Física (Goods Receipt)**: Registro de entregas totais ou parciais direto no canteiro.

---

## 4. RH, Ponto GPS, Apelidos & Folha de Pagamento
- **Ponto com Geofencing GPS**: Validação de cerca virtual da obra.
- **Presença Estilo WhatsApp + Aprendizado de Apelidos**: O mestre envia os nomes da equipe no PWA; caso algum apelido não seja reconhecido, o RH vincula uma única vez (`POST /api/v1/hr/employees/learn-alias`) e o sistema passa a reconhecer automaticamente.
- **Folha de Pagamento & Contas a Pagar**: Cálculo de INSS, IRRF, FGTS Digital, dissídios, PLR e Prêmios (Art. 457 CLT), com fechamento atômico gerando os 5 títulos no Contas a Pagar.

---

## 5. PWA Blindado de Campo (`GADAP Field`)
- Acesse em **[https://gadap-field.vercel.app/](https://gadap-field.vercel.app/)** usando o mesmo login do ERP.
- **Recursos**: Avanço diário (slider %), 3 fotos da obra, Clima via GPS, Presença WhatsApp, Ponto GPS, Pedidos NLP, Recebimento e **Caixinha da Obra**.
