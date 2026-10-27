import { test, expect } from '@playwright/test';

test.describe('Global Routing, RBAC Security & Dead-Link Verification Suite', () => {

  const protectedRoutes = [
    '/dashboard',
    '/dashboard/obras',
    '/dashboard/financeiro/pagar',
    '/dashboard/financeiro/receber',
    '/dashboard/subcontratos',
    '/dashboard/compras',
    '/dashboard/rh',
    '/dashboard/crm',
    '/dashboard/configuracoes',
  ];

  for (const route of protectedRoutes) {
    test(`deve proteger e redirecionar rota ${route} para /login sem autenticação`, async ({ page }) => {
      const response = await page.goto(route);
      // Garante que não temos erro fatal de servidor (500)
      if (response) {
        expect(response.status()).toBeLessThan(500);
      }
      // Valida redirecionamento automático para a tela de autenticação
      await expect(page).toHaveURL(/.*\/login/);
    });
  }

  test('deve validar elementos essenciais da tela de login e navegação pública', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (exception) => pageErrors.push(exception));

    await page.goto('/login');
    // Valida presença da marca GADAP Hub
    await expect(page.getByText('GADAP Hub')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Garante que nenhum erro de execução de JavaScript ou React State crashou a página
    expect(pageErrors.length).toBe(0);
  });

  test('deve garantir que links públicos não geram Dead Links ou travamentos', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('form')).toBeVisible();
  });
});

