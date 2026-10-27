-- ==============================================================================
-- GADAP Hub - Migração 20261027000001: Suprimentos, RH, CRM, Open Finance & Auditoria
-- Fases: 15 (Suprimentos), 16 (RH & Geofencing), 17 (CRM & Garantias),
--        18 (Open Finance & OFX), Paywall (PLG), Governança (Auditoria) e Gov.br
-- ==============================================================================

-- 1. FASE 15: SUPRIMENTOS E LOGÍSTICA (PROCUREMENT)
CREATE TABLE IF NOT EXISTS public.purchase_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    request_number SERIAL,
    status VARCHAR(50) NOT NULL DEFAULT 'pendente', -- pendente, cotando, aprovado, entregue, cancelado
    category VARCHAR(100) DEFAULT 'material_bruto',
    urgency VARCHAR(20) DEFAULT 'normal', -- baixa, normal, alta, urgente
    delivery_deadline DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.procurement_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    purchase_request_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    supplier_name VARCHAR(255) NOT NULL,
    supplier_phone VARCHAR(30),
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    payment_terms VARCHAR(100),
    delivery_days INT DEFAULT 3,
    status VARCHAR(50) NOT NULL DEFAULT 'em_analise', -- em_analise, selecionada, recusada
    whatsapp_dispatched BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    item_name VARCHAR(255) NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT 'UN',
    quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
    minimum_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
    average_unit_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    location VARCHAR(100) DEFAULT 'Almoxarifado Central',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.equipment_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    equipment_name VARCHAR(255) NOT NULL,
    patrimony_code VARCHAR(100),
    origin_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    destination_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    transfer_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    status VARCHAR(50) DEFAULT 'em_transito', -- em_transito, recebido, cancelado
    responsible_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- 2. FASE 16: RH & SEGURANÇA NO CANTEIRO (GEOFENCING & EPI)
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    current_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) NOT NULL,
    role VARCHAR(100) NOT NULL, -- pedreiro, servente, eletricista, mestre_obras
    admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
    daily_wage NUMERIC(12, 2) DEFAULT 0.00,
    phone VARCHAR(30),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.time_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    log_type VARCHAR(20) NOT NULL, -- entrada, saida, almoco_inicio, almoco_fim
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    distance_to_site_meters NUMERIC(10, 2),
    is_within_geofence BOOLEAN NOT NULL DEFAULT true,
    device_info TEXT
);

CREATE TABLE IF NOT EXISTS public.epi_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    epi_name VARCHAR(255) NOT NULL,
    ca_code VARCHAR(50) NOT NULL, -- Certificado de Aprovação Ministério do Trabalho
    delivered_at DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'regular', -- regular, vencendo, vencido
    signature_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. FASE 17: CRM, FUNIL DE VENDAS & PORTAL PÓS-OBRA
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(30),
    estimated_budget NUMERIC(15, 2) DEFAULT 0.00,
    stage VARCHAR(50) NOT NULL DEFAULT 'NOVO', -- NOVO, QUALIFICACAO, PROPOSTA, NEGOCIACAO, FECHADO, PERDIDO
    source VARCHAR(100) DEFAULT 'Site / WhatsApp',
    notes TEXT,
    assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    ticket_number SERIAL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'infiltracao', -- hidraulica, eletrica, fissura, pintura, etc.
    priority VARCHAR(20) DEFAULT 'media', -- baixa, media, alta, emergencial
    status VARCHAR(50) DEFAULT 'aberto', -- aberto, em_vistoria, em_reparo, resolvido
    sla_deadline TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. FASE 18: CONCILIAÇÃO BANCÁRIA HÍBRIDA (PLUGGY + OFX AUTO-MATCH)
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    bank_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    agency_number VARCHAR(20),
    provider VARCHAR(50) DEFAULT 'manual', -- pluggy, manual, ofx
    pluggy_item_id VARCHAR(100),
    pluggy_account_id VARCHAR(100),
    current_balance NUMERIC(15, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL, -- positivo: credito/recebimento, negativo: debito/pagamento
    pluggy_transaction_id VARCHAR(100),
    financial_entry_id UUID REFERENCES public.financial_entries(id) ON DELETE SET NULL,
    is_reconciled BOOLEAN DEFAULT false,
    reconciliation_type VARCHAR(50), -- auto_match, manual, rule
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. FASE 19 (PROMPT 68): PAYWALL & LIMITES PLG NA TABELA COMPANIES
ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'PRO',
    ADD COLUMN IF NOT EXISTS max_clients INT DEFAULT 10,
    ADD COLUMN IF NOT EXISTS active_modules JSONB DEFAULT '["CORE", "FISCAL", "FINANCEIRO", "SUPRIMENTOS", "RH", "CRM"]'::jsonb;

-- 6. FASE 20 (PROMPT 70): AUDIT TRAIL / LOGS DE AUDITORIA
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID,
    user_name VARCHAR(255),
    action VARCHAR(50) NOT NULL, -- INSERT, UPDATE, DELETE, ISSUE_INVOICE, EXECUTE_PAYMENT
    table_name VARCHAR(100) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. FASE 21 (PROMPT 71): ASSINATURA ELETRÔNICA GOV.BR
CREATE TABLE IF NOT EXISTS public.document_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL, -- contrato_subempreitada, termo_epi, medicao_assinada
    reference_id UUID,
    status VARCHAR(50) DEFAULT 'pendente', -- pendente, assinado, rejeitado
    govbr_transaction_id VARCHAR(100),
    signed_file_url TEXT,
    signer_name VARCHAR(255),
    signer_cpf VARCHAR(14),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitação Universal de RLS
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epi_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;
