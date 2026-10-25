-- ==============================================================================
-- GADAP Hub - Migração 20261025000002: Reforma Tributária & IVA Dual (Fase 12)
-- Tabelas: public.tax_rules e public.tax_credits (Não-Cumulatividade Plena)
-- Período de Convivência: 2026 a 2032 (EC 132/2023 & PLP 68/2024)
-- ==============================================================================

-- 1. Criação / Atualização da Tabela de Regras Tributárias (tax_rules)
CREATE TABLE IF NOT EXISTS public.tax_rules (
    id UUID PRIMARY KEY DEFAULT public.gen_uuid_v7(),
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    exercise_year INTEGER NOT NULL DEFAULT 2026,
    service_code_lc116 VARCHAR(20) NOT NULL DEFAULT '07.02',
    description TEXT,
    
    -- Modelo Legado (Cumulativo e Retenções Tradicionais)
    legacy_iss_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0500,        -- 5.0%
    legacy_icms_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0000,       -- 0.0% (serviço puro)
    legacy_pis_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0065,        -- 0.65% (cumulativo)
    legacy_cofins_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0300,     -- 3.00% (cumulativo)
    legacy_inss_retention_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.1100, -- 11.0% (mão de obra)
    legacy_irrf_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0150,       -- 1.5%
    legacy_csll_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0100,       -- 1.0%

    -- Modelo IVA Dual (Reforma Tributária: CBS Federal + IBS Subnacional)
    cbs_standard_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0880,      -- 8.8% (Federal)
    ibs_state_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.1200,         -- 12.0% (Estadual)
    ibs_municipal_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0570,     -- 5.7% (Municipal)
    ibs_standard_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.1770,      -- 17.7% (IBS Total)
    
    -- Redutor Setorial da Construção Civil (EC 132/2023 / PLP 68/2024 - 40% de Desconto)
    construction_reduction_perc NUMERIC(6, 4) NOT NULL DEFAULT 0.4000, -- 40.0% de redução
    cbs_effective_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0528,     -- 8.8% * (1 - 0.40) = 5.28%
    ibs_effective_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.1062,     -- 17.7% * (1 - 0.40) = 10.62%

    -- Alíquotas de Teste do Ano de 2026 (Compensatórias)
    test_period_active BOOLEAN NOT NULL DEFAULT true,
    cbs_test_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0090,          -- 0.9% teste em 2026
    ibs_test_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0010,          -- 0.1% teste em 2026

    -- Fatores de Transição Proporcional (2029 a 2032)
    transition_factor_legacy NUMERIC(6, 4) NOT NULL DEFAULT 1.0000, -- Parcela do tributo legado mantida
    transition_factor_iva NUMERIC(6, 4) NOT NULL DEFAULT 0.0000,    -- Parcela do IVA Dual cobrada
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_tax_rules_year CHECK (exercise_year >= 2026 AND exercise_year <= 2040)
);

COMMENT ON TABLE public.tax_rules IS 'Parâmetros oficiais de tributação comparativa e convivência entre Sistema Legado e IVA Dual (IBS/CBS).';

-- 2. Criação da Tabela de Créditos Tributários por Não-Cumulatividade Plena (tax_credits)
CREATE TABLE IF NOT EXISTS public.tax_credits (
    id UUID PRIMARY KEY DEFAULT public.gen_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    financial_entry_id UUID REFERENCES public.financial_entries(id) ON DELETE SET NULL,
    document_number VARCHAR(100),
    supplier_name VARCHAR(255) NOT NULL,
    supplier_cnpj VARCHAR(14) NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Base e Alíquotas do Crédito Financeiro do Insumo
    material_gross_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    cbs_credit_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0880,
    cbs_credit_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    ibs_credit_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.1770,
    ibs_credit_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    total_credit_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    
    -- Controle de Compensação contra Medição Faturada
    is_compensated BOOLEAN NOT NULL DEFAULT false,
    compensated_measurement_id UUID REFERENCES public.medicoes(id) ON DELETE SET NULL,
    compensated_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'disponivel',
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_tax_credits_amounts CHECK (
        material_gross_amount >= 0 AND total_credit_amount >= 0
    ),
    CONSTRAINT chk_tax_credits_status CHECK (
        status IN ('disponivel', 'compensado', 'glosado', 'estornado')
    )
);

COMMENT ON TABLE public.tax_credits IS 'Créditos fiscais de materiais e insumos adquiridos para abatimento de IBS/CBS sob o princípio da Não-Cumulatividade Plena.';

-- 3. Índices de Otimização Operacional
CREATE INDEX IF NOT EXISTS idx_tax_rules_year ON public.tax_rules(exercise_year);
CREATE INDEX IF NOT EXISTS idx_tax_rules_tenant ON public.tax_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tax_credits_tenant_status ON public.tax_credits(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tax_credits_project ON public.tax_credits(project_id);
CREATE INDEX IF NOT EXISTS idx_tax_credits_measurement ON public.tax_credits(compensated_measurement_id);

-- 4. Triggers de updated_at para Auditoria
DROP TRIGGER IF EXISTS trg_tax_rules_updated_at ON public.tax_rules;
CREATE TRIGGER trg_tax_rules_updated_at
    BEFORE UPDATE ON public.tax_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_tax_credits_updated_at ON public.tax_credits;
CREATE TRIGGER trg_tax_credits_updated_at
    BEFORE UPDATE ON public.tax_credits
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Habilitação e Forçamento Rigoroso de RLS
ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_credits ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de Isolamento Hermético por Tenant
-- tax_rules: Acesso às regras globais (tenant_id IS NULL) ou personalizadas do tenant
DROP POLICY IF EXISTS tax_rules_isolation_select ON public.tax_rules;
CREATE POLICY tax_rules_isolation_select ON public.tax_rules
    FOR SELECT
    USING (tenant_id IS NULL OR tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS tax_rules_isolation_insert ON public.tax_rules;
CREATE POLICY tax_rules_isolation_insert ON public.tax_rules
    FOR INSERT
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS tax_rules_isolation_update ON public.tax_rules;
CREATE POLICY tax_rules_isolation_update ON public.tax_rules
    FOR UPDATE
    USING (tenant_id = public.get_current_tenant())
    WITH CHECK (tenant_id = public.get_current_tenant());

-- tax_credits: Isolamento estrito por tenant
DROP POLICY IF EXISTS tax_credits_isolation_select ON public.tax_credits;
CREATE POLICY tax_credits_isolation_select ON public.tax_credits
    FOR SELECT
    USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS tax_credits_isolation_insert ON public.tax_credits;
CREATE POLICY tax_credits_isolation_insert ON public.tax_credits
    FOR INSERT
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS tax_credits_isolation_update ON public.tax_credits;
CREATE POLICY tax_credits_isolation_update ON public.tax_credits
    FOR UPDATE
    USING (tenant_id = public.get_current_tenant())
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS tax_credits_isolation_delete ON public.tax_credits;
CREATE POLICY tax_credits_isolation_delete ON public.tax_credits
    FOR DELETE
    USING (tenant_id = public.get_current_tenant());

-- 7. Carga de Parâmetros Canônicos do Cronograma da Reforma Tributária (2026 a 2033)
INSERT INTO public.tax_rules (
    name,
    exercise_year,
    description,
    legacy_iss_rate,
    legacy_pis_rate,
    legacy_cofins_rate,
    cbs_standard_rate,
    ibs_standard_rate,
    construction_reduction_perc,
    cbs_effective_rate,
    ibs_effective_rate,
    test_period_active,
    cbs_test_rate,
    ibs_test_rate,
    transition_factor_legacy,
    transition_factor_iva
) VALUES
-- 2026: Ano Teste (0.9% CBS + 0.1% IBS, 100% compensável)
(
    'Fase Teste 2026 - Início da Transição do IVA Dual',
    2026,
    'Ano de teste da CBS (0.9%) e IBS (0.1%), com manutenção integral de ISS, ICMS, PIS e COFINS.',
    0.0500, 0.0065, 0.0300,
    0.0880, 0.1770, 0.4000, 0.0528, 0.1062,
    true, 0.0090, 0.0010,
    1.0000, 0.0000
),
-- 2027: Vigência Plena da CBS e Extinção de PIS/COFINS
(
    'Transição 2027 - CBS Vigente e Extinção de PIS/COFINS',
    2027,
    'Entrada em vigor definitiva da CBS na alíquota padrão com redução de 40% para construção civil. PIS e COFINS extintos.',
    0.0500, 0.0000, 0.0000,
    0.0880, 0.1770, 0.4000, 0.0528, 0.1062,
    false, 0.0000, 0.0000,
    1.0000, 0.3320
),
-- 2029: Início da Redução Gradual de ICMS/ISS (90% Legado / 10% IBS)
(
    'Transição 2029 - 90% Legado e 10% IBS',
    2029,
    'Início da transição de 4 anos dos tributos subnacionais: ISS/ICMS reduzidos para 90% e IBS cobra 10% da alíquota de referência.',
    0.0450, 0.0000, 0.0000,
    0.0880, 0.1770, 0.4000, 0.0528, 0.1062,
    false, 0.0000, 0.0000,
    0.9000, 0.1000
),
-- 2030: 80% Legado e 20% IBS
(
    'Transição 2030 - 80% Legado e 20% IBS',
    2030,
    'ISS reduzido para 80% e IBS cobra 20% com redução da construção civil.',
    0.0400, 0.0000, 0.0000,
    0.0880, 0.1770, 0.4000, 0.0528, 0.1062,
    false, 0.0000, 0.0000,
    0.8000, 0.2000
),
-- 2031: 70% Legado e 30% IBS
(
    'Transição 2031 - 70% Legado e 30% IBS',
    2031,
    'ISS reduzido para 70% e IBS cobra 30%.',
    0.0350, 0.0000, 0.0000,
    0.0880, 0.1770, 0.4000, 0.0528, 0.1062,
    false, 0.0000, 0.0000,
    0.7000, 0.3000
),
-- 2032: 60% Legado e 40% IBS
(
    'Transição 2032 - Último Ano de Convivência (60% Legado / 40% IBS)',
    2032,
    'Último ano do período de transição: ISS em 60% e IBS em 40%.',
    0.0300, 0.0000, 0.0000,
    0.0880, 0.1770, 0.4000, 0.0528, 0.1062,
    false, 0.0000, 0.0000,
    0.6000, 0.4000
),
-- 2033: Vigência Plena do IVA Dual (Extinção Total de ICMS e ISS)
(
    'Vigência Plena 2033 - 100% IVA Dual (IBS + CBS)',
    2033,
    'Modelo definitivo da Reforma Tributária: ISS e ICMS 100% extintos. IBS e CBS em operação plena com Não-Cumulatividade Total.',
    0.0000, 0.0000, 0.0000,
    0.0880, 0.1770, 0.4000, 0.0528, 0.1062,
    false, 0.0000, 0.0000,
    0.0000, 1.0000
)
ON CONFLICT DO NOTHING;
