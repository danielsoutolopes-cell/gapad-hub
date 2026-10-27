import { test, expect } from '@playwright/test';

test.describe('GADAP Hub - Fluxo Crítico E2E de Engenharia e Comercial', () => {
  const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
  const timestamp = Date.now();
  const testProjectName = `Obra E2E Teste Automático ${timestamp}`;
  const testQuoteTitle = `Orçamento Markup E2E ${timestamp}`;

  test('Fluxo Crítico: Login -> Criar Obra -> Orçamento Markup -> Aprovar -> Lançar Medição', async ({ page }) => {
    // -------------------------------------------------------------------------
    // 1. LOGIN
    // -------------------------------------------------------------------------
    await page.goto(`${baseUrl}/login`);
    await expect(page).toHaveTitle(/GADAP/i);

    // Preenche credenciais de acesso corporativo
    await page.fill('#login-email', 'admin@teste.com');
    await page.fill('#login-password', 'Gadap2026!');
    await page.click('button[type="submit"]');

    // Aguarda redirecionamento para o dashboard
    await page.waitForURL('**/dashboard/**', { timeout: 15000 });
    await expect(page.locator('header')).toBeVisible();

    // -------------------------------------------------------------------------
    // 2. CRIAR OBRA
    // -------------------------------------------------------------------------
    await page.goto(`${baseUrl}/dashboard/obras`);
    await expect(page.locator('h1')).toContainText('Gestão de Obras & Empreendimentos');

    // Abre o modal de cadastro de obra
    const btnNovaObra = page.locator('button:has-text("Nova Obra"), button:has-text("Cadastrar Obra")').first();
    await btnNovaObra.click();
    await expect(page.locator('text=Identificação & Cliente Contratante')).toBeVisible();

    // Seleciona o cliente (primeiro disponível no select)
    const selectCliente = page.locator('select[name="client_id"]');
    await selectCliente.selectOption({ index: 1 });

    // Preenche dados da obra
    await page.fill('input[name="name"]', testProjectName);
    await page.fill('input[name="contract_value"]', '350000.00');
    await page.fill('input[name="technical_retention_perc"]', '5.0');

    // Submete cadastro
    await page.click('button:has-text("Salvar Obra")');

    // Valida que a obra foi criada e consta na lista
    await expect(page.locator(`text=${testProjectName}`)).toBeVisible({ timeout: 10000 });

    // -------------------------------------------------------------------------
    // 3. ORÇAMENTO MARKUP
    // -------------------------------------------------------------------------
    await page.goto(`${baseUrl}/dashboard/orcamentos/novo`);
    await expect(page.locator('h1')).toBeVisible();

    // Ativa o Switch de Orçamento Simplificado (Markup) se não estiver ativo
    const switchMarkup = page.locator('#simplified-quote-switch');
    const isChecked = await switchMarkup.isChecked();
    if (!isChecked) {
      await switchMarkup.click();
    }
    await expect(page.locator('text=Margem Direta Ativa')).toBeVisible();

    // Seleciona cliente e preenche título
    await page.locator('select[name="client_id"]').selectOption({ index: 1 });
    await page.fill('input[name="title"]', testQuoteTitle);
    await page.fill('input[name="markup_percentage"]', '35.0');

    // Adiciona um item de serviço
    await page.click('button:has-text("+ Serviço")');
    await page.fill('input[name="items.0.description"]', 'Serviço de Execução de Concretagem e Alvenaria');
    await page.fill('input[name="items.0.quantity"]', '10');
    await page.fill('input[name="items.0.unit_cost"]', '1500');

    // Submete o orçamento
    await page.click('button:has-text("Gerar Proposta com Markup")');
    await page.waitForURL('**/dashboard/orcamentos', { timeout: 10000 });

    // -------------------------------------------------------------------------
    // 4. APROVAR ORÇAMENTO (CONVERTER EM OBRA OU APROVADO)
    // -------------------------------------------------------------------------
    await expect(page.locator(`text=${testQuoteTitle}`)).toBeVisible({ timeout: 10000 });
    
    // Localiza a linha do orçamento e clica em Aprovar caso esteja em rascunho
    const btnAprovar = page.locator(`tr:has-text("${testQuoteTitle}") button:has-text("Aprovar")`).first();
    if (await btnAprovar.isVisible()) {
      page.once('dialog', (dialog) => dialog.accept());
      await btnAprovar.click();
    }

    // -------------------------------------------------------------------------
    // 5. LANÇAR MEDIÇÃO NA OBRA
    // -------------------------------------------------------------------------
    // Navega para a tela de medições da obra recém-criada
    await page.goto(`${baseUrl}/dashboard/obras`);
    const linkObra = page.locator(`tr:has-text("${testProjectName}") a:has-text("Medições")`).first();
    await linkObra.click();

    await page.waitForURL('**/medicoes', { timeout: 10000 });
    await expect(page.locator('h1')).toContainText(testProjectName);

    // Clica no botão "Lançar Medição"
    await page.click('button:has-text("Lançar Medição")');
    await expect(page.locator('text=Boletim de Medição Físico-Financeira')).toBeVisible();

    // Preenche os campos da medição
    const today = new Date().toISOString().slice(0, 10);
    await page.fill('input[name="periodo_inicio"]', today);
    await page.fill('input[name="periodo_fim"]', today);
    await page.fill('input[name="valor_medido"]', '45000.00');
    await page.fill('input[name="retencao_tecnica_perc"]', '5.0');

    // Valida o preview em tempo real de retenção e líquido
    await expect(page.locator('text=R$ 42.750,00')).toBeVisible();

    // Submete a medição
    await page.click('button:has-text("Gravar e Enviar Medição")');

    // Valida a presença da Medição #1 na listagem
    await expect(page.locator('text=Medição #1')).toBeVisible({ timeout: 10000 });
  });
});
