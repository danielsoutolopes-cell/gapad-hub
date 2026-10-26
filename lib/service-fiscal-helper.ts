/**
 * Base de Conhecimento e Enquadramento Fiscal Inteligente para Serviços de Engenharia
 * Tabela de Correspondência entre LC 116/03, NBS, CNAE e Alíquotas Padrão de Retenção.
 */

export interface ServiceFiscalPreset {
  lc116_code: string;
  lc116_label: string;
  nbs_code: string;
  cnae_code: string;
  unit_of_measure: string;
  iss_aliquota: number;
  iss_retido_default: boolean;
  inss_retencao_aliquota: number;
  prefix: string;
  keywords: string[];
}

export const SERVICE_FISCAL_PRESETS: ServiceFiscalPreset[] = [
  {
    lc116_code: '07.02',
    lc116_label: '07.02 - Execução de obras de construção civil, hidráulica, elétrica e alvenaria',
    nbs_code: '1.0101.10.00',
    cnae_code: '4120-4/00',
    unit_of_measure: 'M2',
    iss_aliquota: 5.0,
    iss_retido_default: true,
    inss_retencao_aliquota: 11.0,
    prefix: 'OBR',
    keywords: [
      'alvenaria',
      'concretagem',
      'construcao',
      'obra',
      'fundacao',
      'estrutura',
      'piscina',
      'hidraulica',
      'eletrica',
      'instalacao',
      'impermeabilizacao',
      'manta',
      'reboco',
      'contrapiso',
    ],
  },
  {
    lc116_code: '07.05',
    lc116_label: '07.05 - Reparação, conservação, reforma e manutenção de edifícios e instalações',
    nbs_code: '1.0101.20.00',
    cnae_code: '4330-4/99',
    unit_of_measure: 'M2',
    iss_aliquota: 5.0,
    iss_retido_default: true,
    inss_retencao_aliquota: 11.0,
    prefix: 'REF',
    keywords: [
      'reforma',
      'reparo',
      'recuperacao',
      'manutencao',
      'tratamento',
      'pintura',
      'restauracao',
      'resina',
      'epoxi',
      'porcelanato liquido',
      'impermeabilizante',
    ],
  },
  {
    lc116_code: '07.04',
    lc116_label: '07.04 - Demolição',
    nbs_code: '1.0101.40.00',
    cnae_code: '4311-8/01',
    unit_of_measure: 'M3',
    iss_aliquota: 5.0,
    iss_retido_default: true,
    inss_retencao_aliquota: 11.0,
    prefix: 'DEM',
    keywords: ['demolicao', 'desmonte', 'bota fora', 'remocao de entulho', 'quebra'],
  },
  {
    lc116_code: '07.06',
    lc116_label: '07.06 - Colocação e instalação de revestimentos, cerâmicas, pedras e pisos',
    nbs_code: '1.0101.30.00',
    cnae_code: '4330-4/05',
    unit_of_measure: 'M2',
    iss_aliquota: 5.0,
    iss_retido_default: false,
    inss_retencao_aliquota: 11.0,
    prefix: 'REV',
    keywords: ['revestimento', 'piso', 'porcelanato', 'ceramica', 'granito', 'azulejo', 'pastilha', 'pedra'],
  },
  {
    lc116_code: '07.03',
    lc116_label: '07.03 - Elaboração de planos diretores, estudos de viabilidade, projetos executivos',
    nbs_code: '1.0102.10.00',
    cnae_code: '7112-0/00',
    unit_of_measure: 'UN',
    iss_aliquota: 2.0,
    iss_retido_default: false,
    inss_retencao_aliquota: 0.0,
    prefix: 'PRJ',
    keywords: ['projeto', 'estudo', 'laudo', 'plano diretor', 'viabilidade', 'consultoria', 'memorial'],
  },
  {
    lc116_code: '07.17',
    lc116_label: '07.17 - Engenharia, arquitetura, geologia, perícia e fiscalização técnica',
    nbs_code: '1.0102.20.00',
    cnae_code: '7112-0/00',
    unit_of_measure: 'HORA',
    iss_aliquota: 2.0,
    iss_retido_default: false,
    inss_retencao_aliquota: 0.0,
    prefix: 'ENG',
    keywords: ['art', 'rrt', 'responsabilidade tecnica', 'pericia', 'engenharia', 'arquitetura', 'vistoria', 'fiscalizacao'],
  },
];

/**
 * Encontra a regra fiscal mais adequada com base no texto da descrição do serviço
 */
export function matchServiceFiscalPreset(description: string): ServiceFiscalPreset | null {
  if (!description || description.trim().length < 3) return null;
  const normalized = description
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  for (const preset of SERVICE_FISCAL_PRESETS) {
    for (const kw of preset.keywords) {
      if (normalized.includes(kw)) {
        return preset;
      }
    }
  }

  // Fallback padrão da construção civil
  return SERVICE_FISCAL_PRESETS[0];
}

/**
 * Gera um Código Interno SKU padronizado para o serviço:
 * Ex: SRV-OBR-702-841 ou SRV-REF-705-192
 */
export function generateServiceCode(lc116Code?: string, customPrefix?: string): string {
  const cleanLc = (lc116Code || '07.02').replace(/\D/g, '');
  const prefix = customPrefix || 'SRV';
  const randomSuffix = Math.floor(100 + Math.random() * 900).toString();
  return `${prefix}-${cleanLc}-${randomSuffix}`;
}
