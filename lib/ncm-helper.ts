/**
 * Mapeamento e inteligência fiscal para NCMs da Construção Civil e Obras
 * Integração com base local e consulta online (BrasilAPI).
 */

export interface NcmInfo {
  code: string;
  description: string;
  suggestedCategory: string;
  defaultUnit?: string;
}

// Mapeamento por prefixo de Capítulo / Posição da TIPI / NCM
export const NCM_CONSTRUCTION_MAP: Record<string, { category: string; label: string; unit?: string }> = {
  // 25 - Terras, pedras, gessos, cal e cimento
  '2505': { category: 'agregados', label: 'Areias naturais de qualquer espécie', unit: 'M3' },
  '2517': { category: 'agregados', label: 'Seixos, cascalho, britas e pedras britadas', unit: 'M3' },
  '2520': { category: 'aglomerantes', label: 'Gesso e anidrita', unit: 'SC' },
  '2522': { category: 'aglomerantes', label: 'Cal viva, cal apagada e cal hidráulica', unit: 'SC' },
  '2523': { category: 'aglomerantes', label: 'Cimentos hidráulicos (Portland, aluminoso, etc.)', unit: 'SC' },

  // 68 - Obras de pedra, gesso, cimento, amianto ou mica
  '6810': { category: 'alvenaria', label: 'Obras de cimento, de concreto ou de pedra artificial (blocos, tubos)', unit: 'UN' },
  '6802': { category: 'acabamento', label: 'Mármores, travertinos e granitos talhados', unit: 'M2' },
  '6809': { category: 'acabamento', label: 'Obras de gesso (placas drywall, sancas)', unit: 'M2' },

  // 69 - Produtos cerâmicos
  '6901': { category: 'alvenaria', label: 'Tijolos, placas e outros corpos cerâmicos', unit: 'MIL' },
  '6902': { category: 'alvenaria', label: 'Tijolos e lajotas refratárias', unit: 'UN' },
  '6904': { category: 'alvenaria', label: 'Tijolos para construção, blocos e telhas cerâmicas', unit: 'MIL' },
  '6905': { category: 'cobertura', label: 'Telhas, elementos de chaminés e outros ornamentos', unit: 'UN' },
  '6907': { category: 'acabamento', label: 'Pisos e revestimentos cerâmicos / porcelanatos', unit: 'M2' },
  '6910': { category: 'loucas_metais', label: 'Pias, lavatórios, bacias sanitárias e louças', unit: 'UN' },

  // 72 e 73 - Ferro e Aço
  '7213': { category: 'aco_ferragens', label: 'Fio-máquina de ferro ou aço', unit: 'KG' },
  '7214': { category: 'aco_ferragens', label: 'Barras de ferro ou aço para concreto armado (vergalhão)', unit: 'KG' },
  '7308': { category: 'aco_ferragens', label: 'Construções e suas partes (perfis, pilares, treliças)', unit: 'KG' },
  '7314': { category: 'aco_ferragens', label: 'Telas metálicas e grades de aço soldadas', unit: 'M2' },
  '7304': { category: 'hidraulica', label: 'Tubos e perfis ocos de ferro ou aço', unit: 'BARRA' },
  '7306': { category: 'hidraulica', label: 'Outros tubos e canos de ferro fundido ou aço', unit: 'BARRA' },

  // 39 - Plásticos e suas obras (Hidráulica / Conexões)
  '3917': { category: 'hidraulica', label: 'Tubos e seus acessórios (juntas, cotovelos) de plásticos (PVC/PPR)', unit: 'BARRA' },
  '3925': { category: 'acabamento', label: 'Artefatos para apetrechamento de construções de plástico', unit: 'UN' },

  // 32 - Tintas, vernizes e impermeabilizantes
  '3208': { category: 'tintas_quimicos', label: 'Tintas e vernizes à base de polímeros sintéticos', unit: 'GL' },
  '3209': { category: 'tintas_quimicos', label: 'Tintas e vernizes dispersos em meio aquoso (acrílica, látex)', unit: 'L' },
  '3214': { category: 'tintas_quimicos', label: 'Massas de vedação, colas e impermeabilizantes', unit: 'KG' },

  // 85 - Materiais Elétricos
  '8544': { category: 'eletrica', label: 'Fios, cabos isolados para eletricidade e condutores', unit: 'M' },
  '8536': { category: 'eletrica', label: 'Interruptores, tomadas, disjuntores e conectores elétricos', unit: 'UN' },
  '8538': { category: 'eletrica', label: 'Quadros de distribuição e caixas elétricas', unit: 'UN' },

  // 44 - Madeira
  '4407': { category: 'madeira', label: 'Madeira serrada ou cortada longitudinalmente (tábuas, vigas)', unit: 'M3' },
  '4418': { category: 'madeira', label: 'Obras de marcenaria ou carpintaria para construção (portas, janelas)', unit: 'UN' },
};

/**
 * Identifica a categoria a partir do NCM (localmente primeiro, fallback com BrasilAPI)
 */
export async function lookupNcm(ncmInput: string): Promise<NcmInfo | null> {
  const cleanNcm = ncmInput.replace(/\D/g, '');
  if (cleanNcm.length < 4) return null;

  // 1. Tenta identificar categoria pelo prefixo de 4 dígitos (Posição SH)
  const prefix4 = cleanNcm.substring(0, 4);
  const localMatch = NCM_CONSTRUCTION_MAP[prefix4];

  let officialDescription = '';

  // 2. Se tiver os 8 dígitos completos, busca na BrasilAPI a descrição oficial do NCM
  if (cleanNcm.length === 8) {
    try {
      const response = await fetch(`https://brasilapi.com.br/api/ncm/v1/${cleanNcm}`);
      if (response.ok) {
        const data = await response.json();
        officialDescription = data.descricao || '';
      }
    } catch (e) {
      console.warn('Erro ao consultar BrasilAPI NCM:', e);
    }
  }

  const category = localMatch?.category || 'outros';
  const description = officialDescription || localMatch?.label || 'Insumo de Construção';
  const defaultUnit = localMatch?.unit;

  return {
    code: cleanNcm,
    description,
    suggestedCategory: category,
    defaultUnit,
  };
}

/**
 * Mapeamento de prefixos de SKU padronizados para construção civil
 */
const CATEGORY_SKU_PREFIX: Record<string, string> = {
  aglomerantes: 'CIM',
  agregados: 'AGR',
  alvenaria: 'ALV',
  aco_ferragens: 'ACO',
  hidraulica: 'HID',
  eletrica: 'ELE',
  tintas_quimicos: 'TIN',
  acabamento: 'ACB',
  cobertura: 'COB',
  loucas_metais: 'SAN',
  madeira: 'MAD',
  outros: 'MAT',
};

/**
 * Gera um SKU inteligente e padronizado: MAT-[PREFIXO]-[NCM4]-[RANDOM3]
 * Exemplo: MAT-CIM-2523-841
 */
export function generateProductSku(category: string, ncm?: string): string {
  const catPrefix = CATEGORY_SKU_PREFIX[category] || 'MAT';
  const cleanNcm = (ncm || '').replace(/\D/g, '');
  const ncmPart = cleanNcm.length >= 4 ? cleanNcm.substring(0, 4) : Math.floor(1000 + Math.random() * 9000).toString();
  const randomSuffix = Math.floor(100 + Math.random() * 900).toString();

  return `MAT-${catPrefix}-${ncmPart}-${randomSuffix}`;
}
