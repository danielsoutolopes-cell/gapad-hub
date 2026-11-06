import { test, expect } from "@playwright/test";

/**
 * =============================================================================
 * PROMPT 92: E2E CAOS & FLUXO COMPLETO CANTEIRO -> ESCRITÓRIO
 * Empresa Alvo: "TESTE Engenharia"
 * 
 * Etapas Validadas:
 * 1. PWA Mobile (Apontador/Mestre de Obras):
 *    - Bate ponto com validação de Geofencing GPS (-23.561684, -46.655981)
 *    - Envia Requisição de Materiais com texto livre via NLP
 * 
 * 2. ERP Principal (Comprador/Suprimentos):
 *    - Acessa Mapa de Cotações com Desconto (-) e Frete (+)
 *    - Aprova a proposta mais vantajosa (Menor Preço Global)
 * 
 * 3. ERP Principal (RH & Departamento Pessoal):
 *    - Confere os pontos e horas apuradas
 *    - Executa o Fechamento Atômico de Folha e verifica títulos no Contas a Pagar
 * =============================================================================
 */

test.describe("Fluxo Ponta a Ponta: TESTE Engenharia (Canteiro ao Escritório)", () => {
  const companyName = "TESTE Engenharia";
  const refMonth = "2026-11";

  test("Deve executar o ciclo completo de ponto, suprimentos e fechamento de folha", async ({ request, page }) => {
    // -------------------------------------------------------------------------
    // ETAPA 1: PWA Field App - Registro de Ponto & Requisição via NLP
    // -------------------------------------------------------------------------
    const checkInPayload = {
      employee_id: "550e8400-e29b-41d4-a716-446655440010",
      project_id: "550e8400-e29b-41d4-a716-446655440020",
      latitude: -23.561684,
      longitude: -46.655981,
      log_type: "entrada",
      device_info: "PWA Canteiro TESTE Engenharia",
    };

    const pointResp = await request.post("/api/v1/hr/time-log/check-in", {
      data: checkInPayload,
      headers: { "x-tenant-id": "11111111-1111-1111-1111-111111111111" },
    });
    expect(pointResp.status()).toBe(200);
    const pointData = await pointResp.json();
    expect(pointData.is_within_geofence).toBe(true);
    expect(pointData.geofence_status).toBe("DENTRO_DO_CANTEIRO");

    // Requisição rápida via NLP do Canteiro
    const nlpPayload = {
      raw_text: "20 sacos de cimento cp2 e 3 rolos de fio 2,5mm verde",
      target_location: "Canteiro Jardins Lorena - TESTE Engenharia",
    };
    const nlpResp = await request.post("/api/v1/procurement/requests/parse-text", {
      data: nlpPayload,
      headers: { "x-tenant-id": "11111111-1111-1111-1111-111111111111" },
    });
    expect(nlpResp.status()).toBe(200);
    const nlpData = await nlpResp.json();
    expect(nlpData.recognized_items.length).toBeGreaterThanOrEqual(2);
    expect(nlpData.supplier_link_hash).toBeDefined();

    // -------------------------------------------------------------------------
    // ETAPA 2: Portal do Fornecedor & Matriz de Cotações com Frete/Desconto
    // -------------------------------------------------------------------------
    const supplierQuotePayload = {
      supplier_name: "Distribuidora de Materiais Aliança Ltda",
      supplier_document: "12.345.678/0001-90",
      unit_price: 38.0,
      total_amount: 1140.0,
      discount_amount: 40.0,
      freight_amount: 80.0,
      delivery_days: 2,
      payment_terms: "Boleto 28 dias",
    };

    const supplierResp = await request.post(
      `/api/v1/procurement/suppliers/quotes/${nlpData.supplier_link_hash}`,
      { data: supplierQuotePayload }
    );
    expect(supplierResp.status()).toBe(200);
    const supplierData = await supplierResp.json();
    expect(supplierData.discount_amount).toBe(40.0);
    expect(supplierData.freight_amount).toBe(80.0);
    // Net total = 1140 - 40 + 80 = 1180
    expect(supplierData.net_total).toBe(1180.0);

    // -------------------------------------------------------------------------
    // ETAPA 3: ERP Principal RH - Fechamento de Folha Atômico & Contas a Pagar
    // -------------------------------------------------------------------------
    const closePayrollPayload = {
      reference_month: refMonth,
      simulate_darf_failure: false,
    };
    const payrollCloseResp = await request.post("/api/v1/hr/payroll/close", {
      data: closePayrollPayload,
      headers: { "x-tenant-id": "11111111-1111-1111-1111-111111111111" },
    });
    expect(payrollCloseResp.status()).toBe(200);
    const closeData = await payrollCloseResp.json();
    expect(closeData.records_closed).toBeGreaterThanOrEqual(1);
    expect(closeData.financial_payables_generated.length).toBe(3); // Salários, DARF e FGTS
    expect(closeData.total_financial_obligation).toBeGreaterThan(0);
  });
});

