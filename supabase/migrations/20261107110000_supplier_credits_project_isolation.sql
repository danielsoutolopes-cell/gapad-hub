-- ==============================================================================
-- PROMPT 97: SUPPLY CHAIN & GOODS RECEIPT COM SEGREGAÇÃO POR OBRA E CLIENTE
-- Matriz de Responsabilidade: Compras faturadas no CNPJ do cliente geram
-- créditos exclusivos para aquela obra específica (Tranca Dupla de Isolamento).
-- ==============================================================================

-- 1. Assegurar colunas e constraints em goods_receipts
ALTER TABLE public.goods_receipts
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS responsibility VARCHAR(40) DEFAULT 'CONSTRUCTOR'
  CHECK (responsibility IN ('CONSTRUCTOR', 'CLIENT_DIRECT', 'CLIENT_REIMBURSEMENT'));

-- 2. Assegurar colunas e constraints de isolamento em supplier_credits
-- Tranca dupla: client_id_owner e project_id_owner garantem que compras faturadas
-- no CNPJ do cliente geram haveres exclusivos para aquele centro de custo / obra.
ALTER TABLE public.supplier_credits
ADD COLUMN IF NOT EXISTS client_id_owner UUID REFERENCES public.clients(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS project_id_owner UUID REFERENCES public.projects(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS project_name TEXT NULL,
ADD COLUMN IF NOT EXISTS client_name TEXT NULL,
ADD COLUMN IF NOT EXISTS responsibility VARCHAR(40) DEFAULT 'CONSTRUCTOR'
  CHECK (responsibility IN ('CONSTRUCTOR', 'CLIENT_DIRECT', 'CLIENT_REIMBURSEMENT'));

-- Índices compostos de consulta rápida e auditoria de centro de custo
CREATE INDEX IF NOT EXISTS idx_supplier_credits_owner_isolation
    ON public.supplier_credits(tenant_id, supplier_id, project_id_owner, client_id_owner);

CREATE INDEX IF NOT EXISTS idx_supplier_credits_status_isolation
    ON public.supplier_credits(status, project_id_owner);

-- Políticas RLS adicionais de auditoria caso necessário
COMMENT ON COLUMN public.supplier_credits.project_id_owner IS 'Obra proprietária do crédito gerado por entrega parcial (Isolamento Estrito)';
COMMENT ON COLUMN public.supplier_credits.client_id_owner IS 'Cliente/CNPJ proprietário do crédito caso responsibility = CLIENT_DIRECT';

