# HANDOFF.md — Estado Atual do Ecossistema GADAP Hub & GADAP Field

**Data da última atualização:** 2026-11-17

---

## 1. Repositórios & Ambientes
| Projeto | Caminho Local | Repositório GitHub | URL de Produção |
| :--- | :--- | :--- | :--- |
| **GADAP Hub (ERP Principal)** | `c:\gadap_hub` | `https://github.com/danielsoutolopes-cell/gapad-hub.git` | Next.js + FastAPI |
| **GADAP Field (PWA Blindado)** | `c:\Gadap-field` | `https://github.com/gadapfiscalhub-boop/Gadap-field.git` | [https://gadap-field.vercel.app/](https://gadap-field.vercel.app/) |

---

## 2. Credenciais de Demonstração & Auto-Reset
- **Usuário Teste**: `admin@teste.com` / **Senha**: `Gadap2026!`
- **Comportamento**:
  - Botão de preenchimento rápido ativo na tela `/login` de ambos os sistemas.
  - Ao clicar em **Sair (Logout)** ou automaticamente à **meia-noite (00:00)**, o sistema executa `resetDemoTenantData`, descartando todas as alterações feitas na sessão e restaurando os dados originais da *Empresa Teste*.

---

## 3. Funcionalidades Recentes Entregues
- **PWA Blindado (`GADAP Field`)**:
  - Medição diária com barra de rolagem (%), até 3 fotos, lista de presença estilo WhatsApp e recibo auditável com Hash SHA-256.
  - Detecção automática de clima via GPS (**OpenWeatherMap**) e dias de paralisação por chuva.
  - Abas integradas: **Ponto GPS** (Geofencing), **Suprimentos NLP**, **Recebimento (Goods Receipt)**, **Caixinha da Obra** e **WBS / Aditivos**.
  - Link direto na Sidebar, Academy, Ajuda e Manuais do ERP principal.
- **Inteligência de Engenharia & Compras (`gadap_hub`)**:
  - `GET /api/v1/projects/{id}/weather-impact-report`: Relatório climático para clientes PF e SPE com impacto no cronograma e fator opcional de medição.
  - `POST /api/v1/projects/{id}/measurement-suggestion`: Sugestão automática de medição por Delta WBS.
  - `POST /api/v1/procurement/regional-best-prices`: Radar de Melhores Compras Regionais (últimos 30 dias, 100% anonimizado / LGPD-Safe).
  - `POST /api/v1/hr/attendance/resolve-aliases` e `/employees/learn-alias`: Aprendizado contínuo de apelidos de funcionários no ponto de campo.
- **Roteiro de Testes**: [`ROTEIRO_TESTES_INVESTIDORES_E_PARCEIROS.md`](ROTEIRO_TESTES_INVESTIDORES_E_PARCEIROS.md).

---

## 4. Pendência Imediata / Próximo Passo
- **Git Push no `c:\gadap_hub`**: O último commit (`a52f2b7` + este handoff) está salvo localmente. Como a credencial ativa no Windows Credential Manager está autenticada como `gadapfiscalhub-boop`, alterne para `danielsoutolopes-cell` (ou conceda acesso de colaborador) e execute `git push` em `c:\gadap_hub`.
