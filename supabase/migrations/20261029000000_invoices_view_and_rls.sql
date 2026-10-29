-- ==============================================================================
-- GADAP Hub - Migração 20261029000000: View Canônica public.invoices com RLS Invoker
-- ==============================================================================

-- 1. Aprimora a função get_current_tenant() para suportar app_metadata, user_metadata e claim direta
CREATE OR REPLACE FUNCTION public.get_current_tenant()
RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        NULLIF((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id'), '')::UUID,
        NULLIF((current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'tenant_id'), '')::UUID,
        NULLIF((current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id'), '')::UUID
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Cria a View public.invoices com security_invoker = true (respeita estritamente o RLS de fiscal_invoices)
CREATE OR REPLACE VIEW public.invoices
WITH (security_invoker = true)
AS
SELECT
    id,
    tenant_id,
    project_id,
    measurement_id,
    client_id,
    invoice_type,
    environment,
    number,
    series,
    access_key,
    dps_number,
    status,
    protocol_number,
    authorized_at,
    provider_cnpj,
    provider_city_ibge,
    taker_document,
    taker_name,
    construction_city_ibge,
    service_code_lc116,
    service_description,
    gross_amount AS total_invoice_amount,
    gross_amount,
    deductions_amount,
    calculation_base,
    iss_rate,
    iss_amount,
    iss_retained,
    iss_retained_amount,
    inss_retained_amount,
    irrf_retained_amount,
    csll_retained_amount,
    pis_amount,
    cofins_amount,
    net_amount,
    cno,
    art,
    xml_url,
    pdf_url,
    created_at,
    updated_at
FROM public.fiscal_invoices;

COMMENT ON VIEW public.invoices IS 'View canônica de faturas fiscais (total_invoice_amount) com security_invoker=true para acionamento automático de RLS.';

GRANT SELECT ON public.invoices TO authenticated, service_role, anon;

NOTIFY pgrst, 'reload schema';

