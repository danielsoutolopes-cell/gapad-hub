-- ==============================================================================
-- PROMPT 98: CLIENT BILLINGS & RECONCILIAÇÃO FISCAL (3-WAY MATCH COM BYPASS)
-- Compras CLIENT_DIRECT faturadas no CNPJ do cliente não oneram Contas a Pagar
-- da construtora; criam registros auditados em client_billings.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.client_billings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    supplier_id UUID NULL REFERENCES public.suppliers(id) ON DELETE SET NULL,
    inbound_invoice_id UUID NULL REFERENCES public.inbound_invoices(id) ON DELETE SET NULL,
    purchase_request_id UUID NULL REFERENCES public.purchase_requests(id) ON DELETE SET NULL,
    goods_receipt_id UUID NULL REFERENCES public.goods_receipts(id) ON DELETE SET NULL,
    
    document_number VARCHAR(100) NULL,
    invoice_number VARCHAR(60) NULL,
    access_key VARCHAR(44) NULL,
    supplier_name TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_document VARCHAR(30) NULL,
    
    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    divergence_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    due_date DATE NULL,
    
    status VARCHAR(40) NOT NULL DEFAULT 'AUDITED_MATCHED'
      CHECK (status IN ('PENDING_AUDIT', 'AUDITED_MATCHED', 'QUANTITY_DIVERGENCE', 'PRICE_DIVERGENCE', 'APPROVED_WITH_CREDIT', 'SENT_TO_CLIENT', 'PAID_BY_CLIENT')),
    
    notes TEXT NULL,
    billing_pdf_url TEXT NULL,
    authorized_by_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    authorized_by_user_name TEXT NULL,
    authorized_at TIMESTAMPTZ NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_client_billings_tenant ON public.client_billings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_billings_project ON public.client_billings(project_id);
CREATE INDEX IF NOT EXISTS idx_client_billings_client ON public.client_billings(client_id);
CREATE INDEX IF NOT EXISTS idx_client_billings_status ON public.client_billings(status);

ALTER TABLE public.client_billings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for client_billings"
    ON public.client_billings FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

