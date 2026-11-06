-- =============================================================================
-- Migration: 20261106400000_seed_inventory_and_quotes_freight.sql
-- Prompt 91/92: Seed 50 Insumos da Construção Civil, Link Hash e Frete/Desconto
-- =============================================================================

-- 1. Expansão da tabela purchase_requests
ALTER TABLE public.purchase_requests
    ADD COLUMN IF NOT EXISTS target_location VARCHAR(100) DEFAULT 'ESCRITORIO',
    ADD COLUMN IF NOT EXISTS supplier_link_hash UUID DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS supplier_link_expires_at TIMESTAMPTZ DEFAULT (now() + interval '15 days');

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_requests_link_hash 
    ON public.purchase_requests(supplier_link_hash);

-- 2. Expansão da tabela quotes (freight_amount e discount_amount)
ALTER TABLE public.quotes
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS freight_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;

-- 3. Carga Inicial (Seed) dos 50 Insumos mais comuns da Construção Civil em inventory_items
INSERT INTO public.inventory_items (id, name, category, unit, min_quantity, current_quantity, unit_cost)
VALUES
    -- ELÉTRICA (10 itens)
    (gen_random_uuid(), 'Fio Elétrico Flexível Verde 2,5mm (Rolo 100m)', 'ELÉTRICA', 'ROLO', 2, 8, 175.00),
    (gen_random_uuid(), 'Fio Elétrico Flexível Azul 2,5mm (Rolo 100m)', 'ELÉTRICA', 'ROLO', 2, 6, 175.00),
    (gen_random_uuid(), 'Fio Elétrico Flexível Vermelho 2,5mm (Rolo 100m)', 'ELÉTRICA', 'ROLO', 2, 7, 175.00),
    (gen_random_uuid(), 'Cabo Flexível 6,0mm Preto (Rolo 100m)', 'ELÉTRICA', 'ROLO', 1, 3, 380.00),
    (gen_random_uuid(), 'Disjuntor Bipolar DIN 32A Curva C', 'ELÉTRICA', 'UN', 5, 14, 45.00),
    (gen_random_uuid(), 'Disjuntor Monopolar DIN 20A Curva C', 'ELÉTRICA', 'UN', 10, 25, 18.50),
    (gen_random_uuid(), 'Eletroduto Corrugado Amarelo 3/4" (Rolo 50m)', 'ELÉTRICA', 'ROLO', 3, 10, 75.00),
    (gen_random_uuid(), 'Caixa de Luz 4x2 Amarela Embutir', 'ELÉTRICA', 'UN', 30, 80, 2.20),
    (gen_random_uuid(), 'Fita Isolante 3M Imperial 20 metros', 'ELÉTRICA', 'UN', 10, 30, 9.80),
    (gen_random_uuid(), 'Quadro de Distribuição de Embutir 12/16 DIN com Barramento', 'ELÉTRICA', 'UN', 1, 4, 120.00),

    -- HIDRÁULICA (10 itens)
    (gen_random_uuid(), 'Tubo PVC Soldável Marrom 25mm 6 metros', 'HIDRÁULICA', 'BARRA', 10, 35, 28.00),
    (gen_random_uuid(), 'Tubo PVC Soldável Marrom 32mm 6 metros', 'HIDRÁULICA', 'BARRA', 5, 15, 42.00),
    (gen_random_uuid(), 'Tubo PVC Esgoto Série Normal 100mm 6 metros', 'HIDRÁULICA', 'BARRA', 8, 20, 68.00),
    (gen_random_uuid(), 'Tubo PVC Esgoto Série Normal 50mm 6 metros', 'HIDRÁULICA', 'BARRA', 6, 18, 36.00),
    (gen_random_uuid(), 'Joelho 90 Graus PVC Soldável 25mm', 'HIDRÁULICA', 'UN', 25, 70, 1.80),
    (gen_random_uuid(), 'Tê 90 Graus PVC Soldável 25mm', 'HIDRÁULICA', 'UN', 15, 45, 2.90),
    (gen_random_uuid(), 'Registro de Gaveta Bruto 3/4" Docol/Deca', 'HIDRÁULICA', 'UN', 4, 12, 58.00),
    (gen_random_uuid(), 'Adesivo Plástico para PVC Bisnaga 75g Tigre', 'HIDRÁULICA', 'UN', 5, 16, 8.50),
    (gen_random_uuid(), 'Fita Veda Rosca 18mm x 50m Tigre', 'HIDRÁULICA', 'UN', 8, 22, 12.00),
    (gen_random_uuid(), 'Caixa d''Água Polietileno 1000 Litros com Tampa Fortlev', 'HIDRÁULICA', 'UN', 1, 3, 420.00),

    -- CIVIL / ESTRUTURAL (12 itens)
    (gen_random_uuid(), 'Cimento Portland CP II-E-32 Saco 50kg Votoran', 'CIVIL', 'SACO', 50, 180, 32.50),
    (gen_random_uuid(), 'Areia Média Lavada Canto Limpo (m³)', 'CIVIL', 'M3', 10, 30, 110.00),
    (gen_random_uuid(), 'Pedra Brita nº 1 Basáltica (m³)', 'CIVIL', 'M3', 10, 25, 125.00),
    (gen_random_uuid(), 'Barra de Aço CA-50 10mm (3/8") 12 metros Gerdau', 'ESTRUTURAL', 'BARRA', 30, 120, 48.00),
    (gen_random_uuid(), 'Barra de Aço CA-50 8mm (5/16") 12 metros Gerdau', 'ESTRUTURAL', 'BARRA', 30, 95, 34.00),
    (gen_random_uuid(), 'Barra de Aço CA-50 12,5mm (1/2") 12 metros Gerdau', 'ESTRUTURAL', 'BARRA', 20, 60, 78.00),
    (gen_random_uuid(), 'Arame Recozido Torcido nº 18 (kg)', 'ESTRUTURAL', 'KG', 15, 40, 16.50),
    (gen_random_uuid(), 'Bloco Cerâmico 9x19x19cm Vedação 8 Furos (Milheiro)', 'CIVIL', 'MILHEIRO', 2, 5, 850.00),
    (gen_random_uuid(), 'Argamassa AC-I Uso Interno 20kg Quartzolit', 'CIVIL', 'SACO', 20, 65, 15.00),
    (gen_random_uuid(), 'Argamassa AC-III Cinza Alta Flexibilidade 20kg Quartzolit', 'CIVIL', 'SACO', 15, 45, 33.00),
    (gen_random_uuid(), 'Tábua de Pinus Bruta 30cm x 3m para Fôrma', 'CIVIL', 'UN', 20, 60, 26.00),
    (gen_random_uuid(), 'Sarrafo de Pinus 5cm x 3m para Escoramento', 'CIVIL', 'UN', 25, 80, 8.50),

    -- REVESTIMENTOS E PINTURA (10 itens)
    (gen_random_uuid(), 'Tinta Acrílica Fosca Standard Branco Neve Lata 18L Suvinil', 'REVESTIMENTOS', 'LATA', 4, 12, 340.00),
    (gen_random_uuid(), 'Massa Corrida PVA Balde 25kg Suvinil', 'REVESTIMENTOS', 'BALDE', 5, 18, 75.00),
    (gen_random_uuid(), 'Selador Acrílico Branco Balde 18L', 'REVESTIMENTOS', 'BALDE', 3, 8, 120.00),
    (gen_random_uuid(), 'Lixa de Massa Madeira nº 120 Folha Norton', 'REVESTIMENTOS', 'FOLHA', 50, 150, 2.10),
    (gen_random_uuid(), 'Fita Crepe Automotiva / Pintor 48mm x 50m 3M', 'REVESTIMENTOS', 'UN', 10, 35, 14.50),
    (gen_random_uuid(), 'Rolo de Lã Sintética Antirrespingo 23cm Atlas', 'REVESTIMENTOS', 'UN', 4, 15, 24.00),
    (gen_random_uuid(), 'Gesso em Pó para Revestimento Secagem Lenta Saco 40kg', 'REVESTIMENTOS', 'SACO', 10, 30, 28.00),
    (gen_random_uuid(), 'Rejunte Cerâmico Flexível Cinza Platina 1kg Quartzolit', 'REVESTIMENTOS', 'PCT', 10, 28, 9.50),
    (gen_random_uuid(), 'Espaçador e Nivelador de Porcelanato 1,5mm (Pacote 100un)', 'REVESTIMENTOS', 'PCT', 5, 20, 22.00),
    (gen_random_uuid(), 'Solvente Aguarrás Mineral Lata 5 Litros', 'REVESTIMENTOS', 'LATA', 2, 6, 72.00),

    -- EPIs E FERRAMENTAS (8 itens)
    (gen_random_uuid(), 'Capacete de Segurança Classe B com Jugular Amarelo CA', 'CIVIL', 'UN', 10, 25, 29.00),
    (gen_random_uuid(), 'Óculos de Proteção Incolor Antirrisco e Antiembassante', 'CIVIL', 'UN', 10, 30, 8.50),
    (gen_random_uuid(), 'Luva de Vaqueta Mista Cano Curto Tamanho G', 'CIVIL', 'PAR', 15, 45, 16.00),
    (gen_random_uuid(), 'Bota de Segurança de Couro com Bico de Aço nº 42 Marluvas', 'CIVIL', 'PAR', 4, 12, 115.00),
    (gen_random_uuid(), 'Disco de Corte Diamantado Turbo 110mm Makita', 'CIVIL', 'UN', 6, 18, 38.00),
    (gen_random_uuid(), 'Trena Métrica Emborrachada com Trava 8 Metros Lufkin', 'CIVIL', 'UN', 4, 10, 46.00),
    (gen_random_uuid(), 'Colher de Pedreiro Reta Canto Vivo 8 Polegadas Famastil', 'CIVIL', 'UN', 4, 12, 28.00),
    (gen_random_uuid(), 'Pá de Bico com Cabo de Madeira 120cm Tramontina', 'CIVIL', 'UN', 3, 8, 48.00)
ON CONFLICT DO NOTHING;

