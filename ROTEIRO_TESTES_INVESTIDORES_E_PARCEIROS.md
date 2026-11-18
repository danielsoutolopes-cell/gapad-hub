# 🚀 GADAP Hub & GADAP Field — Roteiro Oficial de Testes (Investidores e Parceiros)

Bem-vindo ao ambiente de homologação do **GADAP Hub (ERP de Engenharia & Construção Civil)** e do **GADAP Field (PWA Blindado de Canteiro)**.  
Este roteiro foi desenhado para que você valide, em poucos minutos, toda a jornada ponta a ponta: **do canteiro de obras ao fechamento financeiro e compliance fiscal/LGPD**.

---

## 🔑 1. Credenciais de Acesso Rápido (Ambiente Sandbox)

- **Usuário de Demonstração**: `admin@teste.com`
- **Senha**: `Gadap2026!`
- *(Dica: Tanto na tela de login do **ERP** quanto no **PWA Field**, basta clicar no botão **"⚡ Preencher Usuário Teste"** para preencher automaticamente).*

> **Segurança & Isolamento de Dados (Auto-Reset):**  
> Ao clicar em **Sair (Logout)** — ou automaticamente à **meia-noite (00:00)** — todas as alterações feitas durante o teste são descartadas e o ambiente é restaurado para o estado limpo original.

---

## 📱 Roteiro 1: Canteiro de Obras no Celular (PWA `GADAP Field`)
**Acesso Direto (Mobile / Desktop):** [https://gadap-field.vercel.app/](https://gadap-field.vercel.app/)

1. **Login Blindado**: Acesse o PWA Field em `https://gadap-field.vercel.app/` e entre com o usuário teste. Observe que nenhuma informação financeira sensível (DRE, salários, margens) é carregada no bundle do canteiro.
2. **Medição Diária com Fotos, Clima & Presença**:
   - Selecione a obra **Reforma Residencial Alpha**.
   - Na etapa **Fundações & Infraestrutura**, arraste a barra de rolagem de avanço para **`+10%`**.
   - Toque em **`📍 Detectar via GPS`** para capturar o clima oficial da obra via **OpenWeatherMap** (ou selecione manualmente *Chuva Forte* para simular paralisação de `+1 dia` no cronograma).
   - Tire até **3 fotos** pela câmera do celular.
   - No campo **Equipe Presente (Estilo WhatsApp)**, digite: `João Silva, Marcos Pedreiro, José Servente`.
   - Toque em **Enviar Relatório do Dia** e confira o **Recibo Auditável com Hash SHA-256**.
3. **Ponto GPS com Geofencing**: Na aba **Ponto**, registre uma entrada e valide a cerca virtual do canteiro.
4. **Suprimentos por Texto Livre (NLP)**: Na aba **Pedir**, escreva *"20 sacos de cimento CP2 e 3 rolos de fio 2,5mm"* e envie para Compras.
5. **Caixinha da Obra**: Na aba **Caixinha**, lance uma despesa rápida de `R$ 180,00` (Pix/Dinheiro) e veja o abatimento direto no custo da obra.

---

## 🏗️ Roteiro 2: Escritório — Obras, Cronograma, Clima & Medição por Delta

1. Acesse **Obras & Empreendimentos** (`/dashboard/obras`) e abra uma obra cadastrada.
2. **Relatório Climático (PF vs. SPE)**:
   - Consulte o impacto de chuvas na semana/mês (`GET /api/v1/projects/{id}/weather-impact-report`) para visualizar dias úteis previstos vs. trabalhados e justificativa automática de prazo.
3. **Medição Inteligente por Delta WBS**:
   - Ao emitir uma medição, ative o cálculo por evolução física (`POST /api/v1/projects/{id}/measurement-suggestion`): o sistema compara o avanço atual do campo (`15%`) com a última medição cobrada (`5%`), calcula o delta de `+10%` sobre o orçamento da etapa e já sugere o valor exato com retenção técnica de 5%.

---

## 🛒 Roteiro 3: Suprimentos & Radar de Melhores Compras Regionais (LGPD-Safe)

1. Acesse **Suprimentos & Compras** (`/dashboard/suprimentos`).
2. **Radar Regional (Últimos 30 Dias)**:
   - Ao cotar um insumo (ex: *Cimento CP-II 50kg* em *Angra dos Reis* a `R$ 42,00`), o motor anonimizado (`POST /api/v1/procurement/regional-best-prices`) identifica se houve compra recente na mesma cidade por preço menor (ex: `R$ 29,90` na *Loja Pássaro*) sem expor nenhum dado de outras construtoras.

---

## 👥 Roteiro 4: RH, Folha de Pagamento & Contas a Pagar

1. Acesse **RH > Folha de Pagamento** (`/dashboard/rh/folha`).
2. Adicione uma **Remuneração Extraordinária** (ex: *PLR* ou *Prêmio de Desempenho Art. 457 CLT* isento de INSS/FGTS).
3. Execute o **Fechamento Atômico da Folha** e confirme a geração automática dos **5 títulos no Contas a Pagar** (Salários Líquidos, INSS, IRRF, FGTS Digital e Benefícios).

---

## 🛡️ Roteiro 5: Governança, LGPD & Exportações Auditáveis

1. Acesse **Relatórios & Exportações** e baixe uma planilha `.xlsx` (DRE, Fluxo de Caixa ou Inadimplência).
2. Verifique no rodapé do Excel a **Marca d'Água LGPD** com CNPJ, Razão Social e **Hash Criptográfico SHA-256**.
3. Acesse **RH > Colaboradores** e confirme o mascaramento automático de CPF/E-mail/Telefone em conformidade com a LGPD.
4. Ao finalizar os testes, clique em **Sair** no topo da tela e faça login novamente para comprovar que todas as alterações temporárias foram descartadas.
