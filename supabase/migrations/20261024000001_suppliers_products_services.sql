-- ==============================================================================
-- GADAP Hub ERP - Migração: Cadastros Base do Módulo Comercial
-- Tabelas: suppliers (Fornecedores), products (Produtos/Insumos) e services (Serviços)
-- Versão: 1.1.0
-- Dialeto: PostgreSQL 16+ (Supabase)
-- Requisitos: Chaves Primárias UUIDv7, tenant_id compulsório, RLS FORCE
-- ==============================================================================

-- 1. FUNÇÃO AUXILIAR DE GERAÇÃO DE UUIDv7 (RFC 9562)
-- Gera identificadores temporalmente ordenados combinando timestamp em ms e entropia aleatória.
CREATE OR REPLACE FUNCTION public.gen_uuid_v7()
RETURNS UUID AS $$
DECLARE
    v_time TIMESTAMP WITH TIME ZONE := clock_timestamp();
    v_epoch BIGINT := (EXTRACT(EPOCH FROM v_time) * 1000)::BIGINT;
    v_hex TEXT := lpad(to_hex(v_epoch), 12, '0');
    v_rand BYTEA := gen_random_bytes(10);
    v_res TEXT;
BEGIN
    v_res := substr(v_hex, 1, 8) || '-' ||
             substr(v_hex, 9, 4) || '-' ||
             '7' || substr(encode(v_rand, 'hex'), 1, 3) || '-' ||
             to_hex((8 + (get_byte(v_rand, 2) % 4))) || substr(encode(v_rand, 'hex'), 4, 3) || '-' ||
             substr(encode(v_rand, 'hex'), 7, 12);
    RETURN v_res::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION public.gen_uuid_v7() IS 'Gera chaves primárias ordenadas por tempo no padrão UUIDv7 (RFC 9562).';

-- ==============================================================================
-- 2. TABELA: suppliers (Fornecedores, Empreiteiros e Prestadores)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT public.gen_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    person_type VARCHAR(2) NOT NULL DEFAULT 'PJ',
    document VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    category VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(30),
    contact_name VARCHAR(100),
    state_registration VARCHAR(30),
    municipal_registration VARCHAR(30),
    address_street VARCHAR(255),
    address_number VARCHAR(30),
    address_complement VARCHAR(100),
    address_neighborhood VARCHAR(100),
    address_city VARCHAR(100),
    address_state VARCHAR(2),
    address_zip_code VARCHAR(10),
    bank_info JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_suppliers_person_type CHECK (person_type IN ('PF', 'PJ')),
    CONSTRAINT uq_suppliers_tenant_document UNIQUE (tenant_id, document)
);

COMMENT ON TABLE public.suppliers IS 'Fornecedores de materiais, subempreiteiras e prestadores parceiros do tenant.';

-- Trigger de updated_at para suppliers
DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER trg_suppliers_updated_at
    BEFORE UPDATE ON public.suppliers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 3. TABELA: products (Insumos, Materiais de Construção e Mercadorias)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT public.gen_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    ncm VARCHAR(10) NOT NULL,
    unit_of_measure VARCHAR(10) NOT NULL,
    base_cost NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    sale_price NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    cest VARCHAR(10),
    cfop_default VARCHAR(5),
    barcode VARCHAR(50),
    brand VARCHAR(100),
    category VARCHAR(100),
    min_stock NUMERIC(18, 4) DEFAULT 0.0000,
    current_stock NUMERIC(18, 4) DEFAULT 0.0000,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_products_base_cost CHECK (base_cost >= 0),
    CONSTRAINT chk_products_sale_price CHECK (sale_price >= 0),
    CONSTRAINT uq_products_tenant_code UNIQUE (tenant_id, code)
);

COMMENT ON TABLE public.products IS 'Catálogo de materiais, insumos de obras e produtos comercializados pelo tenant.';

-- Trigger de updated_at para products
DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 4. TABELA: services (Serviços de Construção Civil e Empreitadas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT public.gen_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    nbs_code VARCHAR(20) NOT NULL,
    lc116_code VARCHAR(20) NOT NULL,
    cnae_code VARCHAR(20),
    base_cost NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    default_price NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    unit_of_measure VARCHAR(10) NOT NULL DEFAULT 'UN',
    iss_aliquota NUMERIC(5, 2) DEFAULT 0.00,
    iss_retido_default BOOLEAN NOT NULL DEFAULT false,
    inss_retencao_aliquota NUMERIC(5, 2) DEFAULT 11.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_services_base_cost CHECK (base_cost >= 0),
    CONSTRAINT chk_services_default_price CHECK (default_price >= 0),
    CONSTRAINT uq_services_tenant_code UNIQUE (tenant_id, code)
);

COMMENT ON TABLE public.services IS 'Catálogo de serviços técnicos de engenharia e construção civil com parâmetros tributários (NBS/LC 116).';

-- Trigger de updated_at para services
DROP TRIGGER IF EXISTS trg_services_updated_at ON public.services;
CREATE TRIGGER trg_services_updated_at
    BEFORE UPDATE ON public.services
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 5. ATIVAÇÃO DE ROW LEVEL SECURITY (RLS) FORÇADO
-- ==============================================================================
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers FORCE ROW LEVEL SECURITY;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services FORCE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 6. POLÍTICAS RLS: suppliers
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS suppliers_isolation_select ON public.suppliers;
CREATE POLICY suppliers_isolation_select ON public.suppliers
    FOR SELECT
    USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS suppliers_isolation_insert ON public.suppliers;
CREATE POLICY suppliers_isolation_insert ON public.suppliers
    FOR INSERT
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS suppliers_isolation_update ON public.suppliers;
CREATE POLICY suppliers_isolation_update ON public.suppliers
    FOR UPDATE
    USING (tenant_id = public.get_current_tenant())
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS suppliers_isolation_delete ON public.suppliers;
CREATE POLICY suppliers_isolation_delete ON public.suppliers
    FOR DELETE
    USING (tenant_id = public.get_current_tenant());

-- ------------------------------------------------------------------------------
-- 7. POLÍTICAS RLS: products
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS products_isolation_select ON public.products;
CREATE POLICY products_isolation_select ON public.products
    FOR SELECT
    USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS products_isolation_insert ON public.products;
CREATE POLICY products_isolation_insert ON public.products
    FOR INSERT
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS products_isolation_update ON public.products;
CREATE POLICY products_isolation_update ON public.products
    FOR UPDATE
    USING (tenant_id = public.get_current_tenant())
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS products_isolation_delete ON public.products;
CREATE POLICY products_isolation_delete ON public.products
    FOR DELETE
    USING (tenant_id = public.get_current_tenant());

-- ------------------------------------------------------------------------------
-- 8. POLÍTICAS RLS: services
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS services_isolation_select ON public.services;
CREATE POLICY services_isolation_select ON public.services
    FOR SELECT
    USING (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS services_isolation_insert ON public.services;
CREATE POLICY services_isolation_insert ON public.services
    FOR INSERT
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS services_isolation_update ON public.services;
CREATE POLICY services_isolation_update ON public.services
    FOR UPDATE
    USING (tenant_id = public.get_current_tenant())
    WITH CHECK (tenant_id = public.get_current_tenant());

DROP POLICY IF EXISTS services_isolation_delete ON public.services;
CREATE POLICY services_isolation_delete ON public.services
    FOR DELETE
    USING (tenant_id = public.get_current_tenant());

-- ==============================================================================
-- 9. ÍNDICES DE PERFORMANCE B-TREE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_active ON public.suppliers (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_document ON public.suppliers (tenant_id, document);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers (name);

CREATE INDEX IF NOT EXISTS idx_products_tenant_active ON public.products (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_tenant_code ON public.products (tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_products_tenant_ncm ON public.products (tenant_id, ncm);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products (name);

CREATE INDEX IF NOT EXISTS idx_services_tenant_active ON public.services (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_services_tenant_code ON public.services (tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_services_tenant_lc116 ON public.services (tenant_id, lc116_code);
CREATE INDEX IF NOT EXISTS idx_services_name ON public.services (name);
