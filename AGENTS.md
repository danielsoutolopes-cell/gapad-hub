# AGENTS.md — Diretrizes de Engenharia & Governança do GADAP Hub

Este arquivo define as regras operacionais obrigatórias para qualquer agente de IA ou desenvolvedor trabalhando no ecossistema **GADAP Hub** (`c:\gadap_hub`) e **GADAP Field** (`c:\Gadap-field`).

---

## 1. Arquitetura & Segurança Multi-Tenant (Regras Inegociáveis)
- **Isolamento Hermético (`tenant_id`)**: Toda consulta, inserção, atualização ou exportação deve filtrar explicitamente pelo `tenant_id` extraído do token JWT autenticado.
- **Privacidade do Superusuário**: O Superusuário (`is_superadmin=true`) gerencia empresas e planos, mas **nunca** pode visualizar dados confidenciais operacionais, financeiros ou salariais dos tenants.
- **LGPD (Lei nº 13.709/2018)**: Dados pessoais (CPF, e-mail, telefone) devem ser mascarados nas listagens e exportações via `api/app/core/lgpd.py`.
- **Zero Segredos no Código**: Nunca inserir chaves de API (`OPENWEATHER_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.) diretamente no código-fonte. Utilizar exclusivamente `.env.local` e variáveis de ambiente da Vercel.

---

## 2. Regra Obrigatória Pós-Implementação (Documentação & Ajuda)
Sempre que uma nova funcionalidade, módulo ou regra de negócio for implementada, **é obrigatório atualizar antes de concluir a tarefa**:
1. **Manual / Guia Rápido**: [`GADAP_HUB_Onboarding_e_Guia_Rapido.md`](GADAP_HUB_Onboarding_e_Guia_Rapido.md)
2. **Tela de Ajuda (FAQ)**: [`app/dashboard/ajuda/page.tsx`](app/dashboard/ajuda/page.tsx)
3. **GADAP Academy**: [`app/dashboard/academy/page.tsx`](app/dashboard/academy/page.tsx)

---

## 3. Padrão de Validação & Commit
Antes de realizar qualquer `git commit`:
1. **Frontend (Next.js / TypeScript)**: Executar `npx tsc --noEmit` e garantir **0 erros**.
2. **Backend (FastAPI / Python)**: Executar `pytest` nos testes afetados e garantir que não haja erros de tipagem estática (Pyrefly).
3. **Commits Semânticos**: Utilizar prefixos claros (`feat:`, `fix:`, `docs:`, `chore:`) e nunca commitar arquivos `.env.local` ou credenciais.
