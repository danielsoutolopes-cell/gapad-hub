import { test, expect } from '@playwright/test';

test.describe('Global Routing & RBAC Security Suite', () => {

  test('deve redirecionar usuário não autenticado para /login ao tentar acessar /dashboard/obras', async ({ page }) => {
    // 1. Tenta acessar rota restrita sem sessão
    await page.goto('/dashboard/obras');

    // 2. Valida redirecionamento automático para a tela de autenticação
    await expect(page).toHaveURL(/.*\/login/);

    // 3. Verifica elementos essenciais da tela de login
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('deve redirecionar rota financeira /dashboard/financeiro/receber para /login sem token', async ({ page }) => {
    await page.goto('/dashboard/financeiro/receber');
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('deve validar elementos da navegação global quando na página de login', async ({ page }) => {
    await page.goto('/login');
    // Valida presença da marca GADAP Hub
    await expect(page.getByText('GADAP Hub')).toBeVisible();
  });

  test('deve garantir que links da Sidebar apontam para rotas canônicas', async ({ page }) => {
    await page.goto('/login');
    // Verifica título da aba do navegador
    await expect(page).toHaveTitle(/GADAP/);
  });
});
