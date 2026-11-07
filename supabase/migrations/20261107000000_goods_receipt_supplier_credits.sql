-- ==============================================================================
-- PROMPT 95: GOODS RECEIPT (RECEBIMENTO DE MATERIAIS) & SUPPLIER CREDITS
-- Gestão de Entregas Parciais gerando Saldo Credor / Conta Corrente com Fornecedor
-- ==============================================================================

-- 1. Tabela de Recebimentos Físicos na Obra (Goods Receipts)
CREATE TABLE IF NOT EXISTS public.goods_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    purchase_order_id UUID NULL,
    received_by_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('FULL', 'PARTIAL', 'DIVERGENT')),
    signature_or_photo_url TEXT NULL,
    notes TEXT NULL,
    divergence_amount NUMERIC(15,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_goods_receipts_tenant ON public.goods_receipts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_project ON public.goods_receipts(project_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_status ON public.goods_receipts(status);

-- 2. Tabela de Itens Recebidos (Conferência de Quantidades)
CREATE TABLE IF NOT EXISTS public.goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
    item_id UUID NULL,
    item_description TEXT NOT NULL,
    expected_quantity NUMERIC(12,3) NOT NULL CHECK (expected_quantity > 0),
    actual_received_quantity NUMERIC(12,3) NOT NULL CHECK (actual_received_quantity >= 0),
    unit VARCHAR(20) DEFAULT 'UN',
    unit_price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    difference_quantity NUMERIC(12,3) GENERATED ALWAYS AS (expected_quantity - actual_received_quantity) STORED,
    difference_value NUMERIC(15,2) GENERATED ALWAYS AS ((expected_quantity - actual_received_quantity) * unit_price) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_goods_receipt_items_receipt ON public.goods_receipt_items(receipt_id);

-- 3. Tabela de Conta Corrente e Créditos de Fornecedor (Supplier Credits / Haveres)
CREATE TABLE IF NOT EXISTS public.supplier_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    receipt_id UUID NULL REFERENCES public.goods_receipts(id) ON DELETE SET NULL,
    credit_amount NUMERIC(15,2) NOT NULL CHECK (credit_amount > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'USED', 'REFUNDED')),
    notes TEXT NULL,
    used_in_purchase_order_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_supplier_credits_tenant_supplier ON public.supplier_credits(tenant_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_credits_status ON public.supplier_credits(status);

-- Habilita RLS
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_credits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS por Tenant
CREATE POLICY "Tenant isolation for goods_receipts"
    ON public.goods_receipts FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant isolation for goods_receipt_items"
    ON public.goods_receipt_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.goods_receipts gr
            WHERE gr.id = goods_receipt_items.receipt_id
            AND gr.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        )
    );

CREATE POLICY "Tenant isolation for supplier_credits"
    ON public.supplier_credits FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

