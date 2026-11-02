# 📘 BÍBLIA DO GADAP HUB ERP — Versão 2.0.0-ENTERPRISE
**Data de Publicação:** 02/11/2026  
**Público-Alvo:** Diretores de Engenharia, Gestores de Suprimentos, Orçamentistas, Mestres de Obras e Analistas Financeiros.

---

## 🚀 Módulos Operacionais e Arquitetura Enterprise (Fases 1 a 20)

### MÓDULO 01 — Gestão de Aditivos (Change Orders)
*Governança Contratual B2B, Extras de Cliente e Extras de Empreiteiros com Assinatura Gov.br*

Controla qualquer alteração de escopo pós-assinatura do contrato principal, separando receitas extras cobradas do cliente final (CLIENT_EXTRA) de custos adicionais negociados com subempreiteiros (SUBCONTRACTOR_EXTRA).

**Regras de Negócio e Fluxo Operacional:**
- CLIENT_EXTRA (Aditivo de Receita): Aumenta automaticamente o Valor do Contrato Principal (projects.contract_value) e gera parcela extra no Contas a Receber.
- SUBCONTRACTOR_EXTRA (Aditivo de Custo): Recalibra o teto do contrato de subempreita (subcontracts.total_contract_value) e agenda obrigação no Contas a Pagar.
- Assinatura Digital e WhatsApp: Todo aditivo gera um Termo PDF formal com hash de auditoria, link de assinatura Gov.br e disparo direto para o WhatsApp do cliente.
- Isolamento da Margem Real: Impede que extras de obra corroam silenciosamente o BDI e o lucro líquido previsto no orçamento original.

### MÓDULO 02 — Portaria Digital e Termos de Logística
*Rastreabilidade de Canteiro, Recebimento de Cargas e Termos para Motoristas (Lalamove/Uber/Transportadoras)*

Blindagem operacional na entrada e saída de insumos e equipamentos no canteiro de obras. Garante conferência física com registro fotográfico e emissão instantânea de Termos de Responsabilidade Logística.

**Regras de Negócio e Fluxo Operacional:**
- Check-in de Entrega no Canteiro: O almoxarife ou mestre de obras confere a Nota Fiscal/Romaneio contra o Pedido de Compra aprovado.
- Termo para Transportadoras e App (Lalamove / Uber Flash / Freteiros): Gera PDF assinado na tela do celular atestando volumes, integridade da carga, placa do veículo e documento do condutor.
- Integração Automática com Estoque: O aceite sem ressalvas alimenta o saldo físico de inventory_items agrupado pela família do insumo.
- Bloqueio de Divergências: Entregas parciais ou avariadas geram alerta imediato para o comprador responsável antes da liberação financeira.

### MÓDULO 03 — Smart Procurement (OCR, IA e Categorização Curva ABC)
*Mapas Sequenciais por Obra, Trava Human-in-the-Loop, AI Advisor e Agrupamento por Família*

Revoluciona o setor de suprimentos combinando extração omnichannel via LLM/Vision (PDFs, fotos de orçamentos e textos de WhatsApp) com rigorosa validação humana obrigatória e inteligência de custos em Curva ABC.

**Regras de Negócio e Fluxo Operacional:**
- Regra de Ouro Human-in-the-Loop (HITL): Nenhuma Inteligência Artificial grava valores diretamente no banco de dados. Toda leitura retorna em memória (Draft) e exige revisão e clique humano em 'Confirmar e Injetar na Matriz'.
- Mapas Sequenciais por Obra: Numeração automática padronizada (ex.: MAPA-001-LORENA) e Matriz de Responsabilidade Financeira (CONSTRUCTOR, CLIENT_DIRECT e CLIENT_REIMBURSEMENT com Contas a Pagar Duplo).
- Categorização Inteligente e Curva ABC: O motor LLM deduz automaticamente a família do insumo (ELÉTRICA, HIDRÁULICA, REVESTIMENTOS, ESTRUTURAL, MARCENARIA, CIVIL), agrupa o PDF do cliente com subtotais por categoria e alimenta o gráfico de Pareto (Classes A, B e C).
- AI Advisor e Comprinhas de Canteiro: Exibe o melhor preço histórico praticado de forma consultiva (não bloqueante) e permite registrar Compras Diretas de urgência com foto do cupom fiscal.

### MÓDULO 04 — Faturamento e Renovação PIX
*Gestão de Assinatura SaaS, Checkout Instantâneo via QR Code PIX e Governança PLG*

Central de autoatendimento financeiro do Tenant para controle do plano contratado, renovação de benefícios comerciais (Founder / PLG) e liquidação instantânea via PIX integrado ao gateway.

**Regras de Negócio e Fluxo Operacional:**
- Renovação Instantânea via PIX: Geração dinâmica de QR Code PIX e código Copia-e-Cola com conciliação automática via Webhook em segundos.
- Desbloqueio Automático de Módulos: Assim que o pagamento é confirmado pelo gateway, o status da empresa (plan_status = active) e os módulos contratados são liberados sem intervenção manual.
- Gestão de Benefícios PLG: Controle transparente de vigência de descontos promocionais (renewal_count / max_renewals) e histórico auditável de faturas.
- Emissão Fiscal Nacional (NF-e / NFS-e / IVA Dual): Integração nativa com Certificado Digital A1 (mTLS), retenções técnicas (INSS/ISS/IRRF) e Simulador da Reforma Tributária (CBS + IBS).

---

## ⚡ FAQ Rápido de Canteiro & Operação

#### 1. Como aprovar uma cotação gerada pela Inteligência Artificial?
No módulo de Suprimentos (Matriz de Cotação), envie o PDF/Foto do orçamento ou cole o texto do WhatsApp e clique em 'Ler com IA (Revisão HITL)'. O sistema abrirá o Modal Obrigatório de Revisão Humana com os valores extraídos e a Categoria deduzida (ex.: ELÉTRICA ou REVESTIMENTOS) apenas em memória. Confira ou ajuste o fornecedor, preços e categoria, e clique em 'Confirmar e Injetar na Matriz'. Em seguida, marque a proposta vencedora com o Selo de Recomendação e clique em 'Aprovar Cotação Vencedora'.

#### 2. Como gerar um termo de recebimento de material para transportadoras (Lalamove/Uber)?
Acesse o módulo de Logística / Portaria Digital da obra ou a aba de Compras Diretas ('Comprinhas') em Suprimentos, selecione a entrega/pedido correspondente e clique em 'Gerar Termo de Recebimento / Logística'. Informe a placa/modal (Lalamove, Uber Flash ou Transportadora), anexe a foto da carga ou recibo no ato do descarregamento e gere o PDF assinado digitalmente para liberar o motorista com rastreabilidade completa.
