# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: global_routing.spec.ts >> Global Routing & RBAC Security Suite >> deve validar elementos da navegação global quando na página de login
- Location: tests\e2e\global_routing.spec.ts:22:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/login
Call log:
  - navigating to "http://localhost:3000/login", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Global Routing & RBAC Security Suite', () => {
  4  | 
  5  |   test('deve redirecionar usuário não autenticado para /login ao tentar acessar /dashboard/obras', async ({ page }) => {
  6  |     // 1. Tenta acessar rota restrita sem sessão
  7  |     await page.goto('/dashboard/obras');
  8  | 
  9  |     // 2. Valida redirecionamento automático para a tela de autenticação
  10 |     await expect(page).toHaveURL(/.*\/login/);
  11 | 
  12 |     // 3. Verifica elementos essenciais da tela de login
  13 |     await expect(page.locator('input[type="email"]')).toBeVisible();
  14 |     await expect(page.locator('button[type="submit"]')).toBeVisible();
  15 |   });
  16 | 
  17 |   test('deve redirecionar rota financeira /dashboard/financeiro/receber para /login sem token', async ({ page }) => {
  18 |     await page.goto('/dashboard/financeiro/receber');
  19 |     await expect(page).toHaveURL(/.*\/login/);
  20 |   });
  21 | 
  22 |   test('deve validar elementos da navegação global quando na página de login', async ({ page }) => {
> 23 |     await page.goto('/login');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/login
  24 |     // Valida presença da marca GADAP Hub
  25 |     await expect(page.getByText('GADAP Hub')).toBeVisible();
  26 |   });
  27 | 
  28 |   test('deve garantir que links da Sidebar apontam para rotas canônicas', async ({ page }) => {
  29 |     await page.goto('/login');
  30 |     // Verifica título da aba do navegador
  31 |     await expect(page).toHaveTitle(/GADAP/);
  32 |   });
  33 | });
  34 | 
```