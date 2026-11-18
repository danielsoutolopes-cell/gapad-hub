# 🛠️ Manual Completo do Usuário — GADAP Hub para Autônomos & MEI

**Versão:** 2.4 • **ERP Web:** `/dashboard` • **PWA de Campo:** [https://gadap-field.vercel.app/](https://gadap-field.vercel.app/)

---

## Sumário
1. [Para Quem é Este Manual](#1-para-quem-é-este-manual)
2. [Configuração Inicial em 3 Minutos](#2-configuração-inicial-em-3-minutos)
3. [Orçamentos Profissionais & Aprovação Rápida](#3-orçamentos-profissionais--aprovação-rápida)
4. [Gestão da Obra pelo Celular (`GADAP Field`)](#4-gestão-da-obra-pelo-celular-gadap-field)
5. [Transparência com o Cliente PF (Fotos, Clima & Prazos)](#5-transparência-com-o-cliente-pf-fotos-clima--prazos)
6. [Cobrança por Medição, Caixinha & Controle do Lucro](#6-cobrança-por-medição-caixinha--controle-do-lucro)

---

## 1. Para Quem é Este Manual
Este guia foi feito para **Engenheiros Autônomos, Arquitetos, Empreiteiros e MEIs** que executam reformas, construções residenciais, piscinas e obras rápidas — e precisam de controle profissional direto do celular, sem perder horas em planilhas complexas.

---

## 2. Configuração Inicial em 3 Minutos
1. **Acesse o Sistema**: Entre com seu e-mail e senha corporativa no painel web (`/login`).
2. **Cadastre seu Cliente (`/dashboard/clientes`)**: Informe CPF ou CNPJ, telefone e e-mail do contratante.
3. **Crie sua Obra (`/dashboard/obras`)**:
   - Defina o nome da obra (ex: *Reforma Cobertura Alpha* ou *Piscina Residencial*), valor fechado do serviço/contrato e prazo estimado.
   - O sistema cria automaticamente as etapas básicas do cronograma (que você pode editar conforme o escopo).

---

## 3. Orçamentos Profissionais & Aprovação Rápida
1. Acesse **Orçamentos (`/dashboard/orcamentos`)**.
2. Adicione os serviços e materiais previstos com seu **Markup** desejado.
3. Envie a proposta para o cliente aprovar. Assim que aprovada, o valor já serve de base para suas medições e controle de margem.

---

## 4. Gestão da Obra pelo Celular (`GADAP Field`)
No dia a dia da obra, você não precisa abrir o computador. Acesse **[https://gadap-field.vercel.app/](https://gadap-field.vercel.app/)** no navegador do seu celular e toque em **"Adicionar à Tela Inicial"**:

1. **Diário & Avanço do Dia (Aba `Medição`)**:
   - Selecione a obra e a etapa que está executando.
   - Deslize a barra de rolagem para marcar o avanço (ex: `+10%`).
   - Tire até **3 fotos** do serviço executado.
   - Se tiver ajudantes/pedreiros com você no dia, digite os nomes na caixa **Equipe Presente** (igual a uma mensagem de WhatsApp).
   - Toque em **Enviar Relatório do Dia** para gerar o comprovante auditável com data, hora, GPS e Hash SHA-256.
2. **Caixinha da Obra (Aba `Caixinha`)**:
   - Comprou prego, argamassa, disco de corte ou pagou um carreto de última hora?
   - Abra a aba **Caixinha**, digite a descrição, o valor gasto (ex: `R$ 180,00`) e marque **Pix** ou **Dinheiro**. O gasto já entra no custo real da obra para você não perder dinheiro sem perceber.

---

## 5. Transparência com o Cliente PF (Fotos, Clima & Prazos)
Um dos maiores problemas de quem trabalha por conta própria é o cliente questionar por que a obra atrasou em semana de chuva.
- Na aba **Medição** do PWA, toque em **`📍 Detectar via GPS`** para registrar automaticamente o clima oficial (**OpenWeatherMap**) da região da obra.
- Se choveu forte e impediu concretagem, impermeabilização ou pintura externa, marque a paralisação (`+0.5d` ou `+1d`).
- O sistema gera o **Relatório Climático para Cliente PF**, mostrando exatamente quantos dias foram trabalhados, as fotos da obra e o novo prazo ajustado com total transparência.

---

## 6. Cobrança por Medição, Caixinha & Controle do Lucro
- **Cobrança por Medição**: Sempre que concluir uma etapa ou percentual (ex: evoluiu de `5%` para `15%`), o sistema calcula automaticamente quanto você deve cobrar do cliente naquela parcela.
- **Fluxo de Caixa Simples**: Acompanhe no painel financeiro tudo o que já recebeu do cliente versus tudo o que gastou com materiais, ajudantes e caixinha, garantindo que o lucro combinado sobre no seu bolso no final da obra.
