-- ==============================================================================
-- PROMPT 96: 3-WAY MATCH & RECONCILIAÇÃO FISCAL AUTOMÁTICA
-- Cruzamento entre Ordem de Compra (PO), Recebimento Físico (GR) e NF-e (XML SEFAZ)
-- ==============================================================================

-- Adiciona campos de reconciliação fiscal e 3-Way Match na tabela inbound_invoices
ALTER TABLE public.inbound_invoices
ADD COLUMN IF NOT EXISTS purchase_request_id UUID NULL REFERENCES public.purchase_requests(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS goods_receipt_id UUID NULL REFERENCES public.goods_receipts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(40) NOT NULL DEFAULT 'PENDING'
    CHECK (reconciliation_status IN ('PENDING', 'MATCHED', 'PRICE_DIVERGENCE', 'QUANTITY_DIVERGENCE', 'MATCHED_WITH_CREDIT')),
ADD COLUMN IF NOT EXISTS xml_items_json JSONB NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS reconciliation_audit_json JSONB NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ NULL;

-- Índices para cruzamentos rápidos no fechamento contábil e auditoria
CREATE INDEX IF NOT EXISTS idx_inbound_invoices_reconciliation ON public.inbound_invoices(tenant_id, reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_inbound_invoices_po ON public.inbound_invoices(purchase_request_id);
CREATE INDEX IF NOT EXISTS idx_inbound_invoices_gr ON public.inbound_invoices(goods_receipt_id);

COMMENT ON COLUMN public.inbound_invoices.reconciliation_status IS 'Status do 3-Way Match: PENDING, MATCHED, PRICE_DIVERGENCE, QUANTITY_DIVERGENCE, MATCHED_WITH_CREDIT';
COMMENT ON COLUMN public.inbound_invoices.xml_items_json IS 'Lista estruturada de itens extraídos da tag <det> do XML da NF-e (cProd, xProd, qCom, vUnCom, vProd, NCM)';

