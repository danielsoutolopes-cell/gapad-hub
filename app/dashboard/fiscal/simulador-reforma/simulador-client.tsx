'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Scale,
  ShieldCheck,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Plus,
  ArrowRight,
  Layers,
  HelpCircle,
  RefreshCw,
  Sparkles,
  Building,
  FileText,
  CheckCircle2,
  AlertCircle,
  Percent,
  Info,
  Calendar,
  Check,
  Package,
  Zap,
} from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';

interface TaxCreditItem {
  id: string;
  document_number?: string;
  supplier_name: string;
  supplier_cnpj: string;
  invoice_date: string;
  material_gross_amount: number;
  cbs_credit_amount: number;
  ibs_credit_amount: number;
  total_credit_amount: number;
  status: string;
  is_compensated: boolean;
}

interface DualSimulationResponse {
  faturamento_bruto: number;
  exercicio_ano: number;
  tax_regime?: string;
  bypass_fiscal_ativo?: boolean;
  modelo_legado: {
    regime: string;
    bypass_fiscal_ativo?: boolean;
    das_simei_mensal_estimado?: number;
    base_calculo_bruta: number;
    deducoes_materiais: number;
    base_calculo_iss: number;
    iss: {
      aliquota_nominal_perc: number;
      fator_transicao_ano: number;
      valor_devido: number;
    };
    pis: {
      aliquota_perc: number;
      valor_devido: number;
    };
    cofins: {
      aliquota_perc: number;
      valor_devido: number;
    };
    inss_retencao: {
      base_calculo_mao_de_obra: number;
      aliquota_perc: number;
      valor_devido: number;
    };
    irrf: {
      aliquota_perc: number;
      valor_devido: number;
    };
    csll: {
      aliquota_perc: number;
      valor_devido: number;
    };
    total_tributos_legado: number;
    aliquota_efetiva_legado_perc: number;
  };
  modelo_iva_dual: {
    exercicio_ano: number;
    bypass_fiscal_ativo?: boolean;
    periodo_teste_2026: boolean;
    redutor_construcao_civil_ativo: boolean;
    percentual_redutor_construcao: number;
    cbs: {
      aliquota_padrao_referencia: number;
      aliquota_aplicada_ano: number;
      debito_bruto: number;
      creditos_financeiros_disponiveis: number;
      creditos_abatidos: number;
      saldo_liquido_a_pagar: number;
      saldo_credor_remanescente: number;
    };
    ibs: {
      aliquota_padrao_referencia: number;
      aliquota_estadual_ref: number;
      aliquota_municipal_ref: number;
      fator_transicao_subnacional: number;
      aliquota_aplicada_ano: number;
      debito_bruto: number;
      creditos_financeiros_disponiveis: number;
      creditos_abatidos: number;
      saldo_liquido_a_pagar: number;
      saldo_credor_remanescente: number;
    };
    total_iva_dual_bruto: number;
    total_creditos_materiais_abatidos: number;
    total_iva_dual_liquido_devido: number;
    aliquota_efetiva_iva_perc: number;
  };
  demonstrativo_comparativo: {
    exercicio_analisado: number;
    faturamento_bruto_fatura: number;
    total_modelo_legado: number;
    aliquota_efetiva_legado_perc: number;
    total_modelo_iva_dual_liquido: number;
    aliquota_efetiva_iva_dual_perc: number;
    credito_tributario_materiais_aproveitado: number;
    diferenca_nominal: number;
    variacao_percentual_carga: number;
    diagnostico_impacto: 'ECONOMIA_TRIBUTARIA' | 'ACRESCIMO_CARGA' | 'NEUTRO' | 'ISENTO_MEI_BYPASS';
    parecer_tecnico: string;
  };
}

const formatCurrency = (val: number = 0) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export function SimuladorReformaClient({ tenantName }: { tenantName: string }) {
  const queryClient = useQueryClient();

  // Estados dos Parâmetros de Simulação
  const [valorMedicao, setValorMedicao] = useState<number>(100000);
  const [deducaoMateriais, setDeducaoMateriais] = useState<number>(20000);
  const [exercicioAno, setExercicioAno] = useState<number>(2026);
  const [taxRegime, setTaxRegime] = useState<'lucro_presumido' | 'simples_nacional' | 'mei'>('lucro_presumido');
  const [aplicarRedutor, setAplicarRedutor] = useState<boolean>(true);

  // Estados para Registro de Novo Crédito de Material
  const [showAddCredit, setShowAddCredit] = useState(false);
  const [creditSupplier, setCreditSupplier] = useState('');
  const [creditCnpj, setCreditCnpj] = useState('');
  const [creditDocNumber, setCreditDocNumber] = useState('');
  const [creditMaterialAmount, setCreditMaterialAmount] = useState<number>(15000);

  // 1. Query: Listagem de Créditos Fiscais de Materiais da Construtora
  const { data: taxCredits = [], isLoading: loadingCredits } = useQuery<TaxCreditItem[]>({
    queryKey: ['tax-credits-list'],
    queryFn: async () => {
      const resp = await fetch('/api/v1/fiscal/tax-credits');
      if (!resp.ok) throw new Error('Falha ao listar créditos fiscais');
      return resp.json();
    },
  });

  // Cálculo dos créditos disponíveis na base
  const totalCreditosCbsDisponiveis = taxCredits.reduce(
    (acc, curr) => (!curr.is_compensated ? acc + Number(curr.cbs_credit_amount || 0) : acc),
    0
  );
  const totalCreditosIbsDisponiveis = taxCredits.reduce(
    (acc, curr) => (!curr.is_compensated ? acc + Number(curr.ibs_credit_amount || 0) : acc),
    0
  );

  // 2. Query: Simulação Paralela (Demonstrativo Dual)
  const {
    data: simData,
    isLoading: loadingSim,
    isFetching: fetchingSim,
    refetch: refetchSim,
  } = useQuery<DualSimulationResponse>({
    queryKey: [
      'tax-dual-simulation',
      valorMedicao,
      deducaoMateriais,
      exercicioAno,
      taxRegime,
      aplicarRedutor,
      totalCreditosCbsDisponiveis,
      totalCreditosIbsDisponiveis,
    ],
    queryFn: async () => {
      const payload = {
        valor_faturamento_bruto: valorMedicao,
        deducoes_materiais: deducaoMateriais,
        exercicio_ano: exercicioAno,
        optante_simples_nacional: taxRegime === 'simples_nacional',
        tax_regime: taxRegime === 'mei' ? 'MEI' : (taxRegime === 'simples_nacional' ? 'Simples Nacional' : 'Lucro Presumido'),
        iss_aliquota: 5.0,
        creditos_materiais_cbs: totalCreditosCbsDisponiveis,
        creditos_materiais_ibs: totalCreditosIbsDisponiveis,
        aplicar_redutor_construcao: aplicarRedutor,
      };

      const resp = await fetch('/api/v1/fiscal/tax-calculator/simulate-dual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        throw new Error('Falha ao calcular simulação dual');
      }
      return resp.json();
    },
  });

  // 3. Mutação: Registro de Novo Crédito Financeiro de Insumo
  const createCreditMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch('/api/v1/fiscal/tax-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_name: creditSupplier,
          supplier_cnpj: creditCnpj.replace(/\D/g, '') || '00000000000100',
          document_number: creditDocNumber,
          material_gross_amount: creditMaterialAmount,
        }),
      });

      if (!resp.ok) {
        throw new Error('Falha ao registrar crédito fiscal');
      }
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-credits-list'] });
      queryClient.invalidateQueries({ queryKey: ['tax-dual-simulation'] });
      setShowAddCredit(false);
      setCreditSupplier('');
      setCreditCnpj('');
      setCreditDocNumber('');
    },
  });

  const comp = simData?.demonstrativo_comparativo;
  const legado = simData?.modelo_legado;
  const iva = simData?.modelo_iva_dual;

  const isMei = simData?.bypass_fiscal_ativo || comp?.diagnostico_impacto === 'ISENTO_MEI_BYPASS' || taxRegime === 'mei';
  const isEconomia = comp?.diagnostico_impacto === 'ECONOMIA_TRIBUTARIA';

  return (
    <TooltipProvider delayDuration={150}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ---------------------------------------------------------------------- */}
        {/* CABEÇALHO DO SIMULADOR DA REFORMA TRIBUTÁRIA */}
        {/* ---------------------------------------------------------------------- */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6 print:border-b-2 print:border-slate-300 print:pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2 print:text-slate-950">
                  Simulador da Reforma Tributária & IVA Dual
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5 print:text-slate-600">
                  Análise comparativa determinística do impacto na margem de lucro de medições de obras (EC nº 132/2023 & PLP 68/2024).
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 print:hidden">
            {/* Tooltip de Ajuda Contextual: Tranquilidade e Convivência Automática */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500/15 to-teal-500/15 hover:from-emerald-500/25 hover:to-teal-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold cursor-help transition-all shadow-sm shadow-emerald-500/10">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Convivência 2026-2032: Operação Automática</span>
                  <HelpCircle className="w-3.5 h-3.5 text-emerald-400/80 flex-shrink-0" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" className="max-w-md p-4 bg-slate-900 border-emerald-500/40 text-slate-200">
                <div className="space-y-2">
                  <p className="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Tranquilidade Fiscal Total no Período de Convivência
                  </p>
                  <p className="text-[11px] leading-relaxed text-slate-300">
                    Sua construtora não precisa se preocupar com parametrizações manuais complexas. Durante todo o período de transição (2026 a 2032), o <strong>GADAP Hub calcula e opera automaticamente em ambos os regimes simultaneamente</strong>:
                  </p>
                  <ul className="text-[10px] space-y-1 text-slate-300 list-disc list-inside">
                    <li><strong>Apuração Paralela:</strong> A emissão de NFS-e e o Contas a Receber geram as retenções legadas e projetam o IVA Dual em tempo real;</li>
                    <li><strong>Créditos Automáticos:</strong> Compras de materiais com destaque de IBS e CBS amortizam diretamente a guia da medição faturada;</li>
                    <li><strong>Sem Risco de Glosa:</strong> Conformidade assegurada com as regras da EC nº 132/2023 e PLP 68/2024.</li>
                  </ul>
                </div>
              </TooltipContent>
            </Tooltip>

            <button
              onClick={() => refetchSim()}
              disabled={fetchingSim}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${fetchingSim ? 'animate-spin text-emerald-400' : ''}`} />
              Recalcular
            </button>
          </div>
        </div>

        {/* ---------------------------------------------------------------------- */}
        {/* PAINEL DE CONTROLES INTERATIVOS DE SIMULAÇÃO */}
        {/* ---------------------------------------------------------------------- */}
        <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-xl p-6 shadow-sm print:border-slate-300 print:bg-white">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2 print:text-slate-900">
            <Building className="w-4 h-4 text-emerald-400" /> Parâmetros da Medição &amp; Cenário Fiscal
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Regime Tributário da Construtora / Profissional */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <span>Regime Tributário</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help text-slate-400 hover:text-emerald-400 inline-flex">
                        <HelpCircle className="w-3.5 h-3.5" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs p-3 bg-slate-900 border-slate-700 text-slate-200">
                      <p className="font-bold text-white mb-1">Enquadramento Tributário</p>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Escolha o regime da empresa. O sistema adapta automaticamente as retenções de INSS, IRRF, CSRF e débitos de IVA Dual.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </label>
              </div>
              <select
                value={taxRegime}
                onChange={(e) => setTaxRegime(e.target.value as 'lucro_presumido' | 'simples_nacional' | 'mei')}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/70 rounded-lg text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="lucro_presumido">Lucro Presumido / Real (Médias e Grandes)</option>
                <option value="simples_nacional">Simples Nacional (Anexo IV da Construção)</option>
                <option value="mei">MEI - Microempreendedor (Bypass Fiscal Ativo)</option>
              </select>
              {taxRegime === 'mei' ? (
                <span className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
                  <Zap className="w-3 h-3" /> Bypass Ativo: Retenções e IBS/CBS desonerados (LC 123/06)
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 mt-1 block">Regime configurado na empresa</span>
              )}
            </div>

            {/* Valor Bruto da Medição */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <span>Valor Bruto da Medição (R$)</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help text-slate-400 hover:text-emerald-400 inline-flex">
                        <HelpCircle className="w-3.5 h-3.5" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs p-3 bg-slate-900 border-slate-700 text-slate-200">
                      <p className="font-bold text-white mb-1">Base do Faturamento de Serviços</p>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Valor homologado no Boletim de Medição físico-financeira que dará origem à emissão da NFS-e.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </label>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-slate-500">R$</span>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={valorMedicao}
                  onChange={(e) => setValorMedicao(Number(e.target.value) || 0)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-700/70 rounded-lg text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Dedução de Materiais (Legado) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <span>Dedução de Materiais ISS (R$)</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help text-slate-400 hover:text-emerald-400 inline-flex">
                        <HelpCircle className="w-3.5 h-3.5" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs p-3 bg-slate-900 border-slate-700 text-slate-200">
                      <p className="font-bold text-white mb-1">Abatimento no ISS (DL 406/1968)</p>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Dedução legal de materiais adquiridos e incorporados à obra na base de cálculo do ISS municipal. No IVA Dual, é substituído pelos créditos financeiros amplos.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </label>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-slate-500">R$</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={deducaoMateriais}
                  onChange={(e) => setDeducaoMateriais(Number(e.target.value) || 0)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-700/70 rounded-lg text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Abatimento previsto no DL 406/1968</span>
            </div>

            {/* Ano do Exercício (Cronograma de Transição) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <span>Ano do Exercício (Transição)</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help text-slate-400 hover:text-emerald-400 inline-flex">
                        <HelpCircle className="w-3.5 h-3.5" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs p-3 bg-slate-900 border-slate-700 text-slate-200">
                      <p className="font-bold text-white mb-1">Cronograma Oficial (EC 132/2023)</p>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        2026 (ano de teste com CBS 0.9% e IBS 0.1%), 2027 (extinção de PIS/COFINS), e 2029-2032 (transição gradual do ISS para o IBS).
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </label>
              </div>
              <select
                value={exercicioAno}
                onChange={(e) => setExercicioAno(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/70 rounded-lg text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
              >
                <option value={2026}>2026 (Ano Teste: 0.9% CBS + 0.1% IBS)</option>
                <option value={2027}>2027 (CBS Plena / PIS & COFINS Extintos)</option>
                <option value={2029}>2029 (90% Legado / 10% IBS)</option>
                <option value={2030}>2030 (80% Legado / 20% IBS)</option>
                <option value={2031}>2031 (70% Legado / 30% IBS)</option>
                <option value={2032}>2032 (60% Legado / 40% IBS)</option>
                <option value={2033}>2033+ (100% Pleno IVA Dual: IBS + CBS)</option>
              </select>
              <span className="text-[10px] text-slate-500 mt-1 block">Conforme cronograma da EC 132/2023</span>
            </div>
          </div>

          {/* Redutor Setorial da Construção */}
          <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={aplicarRedutor}
                onChange={(e) => setAplicarRedutor(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-950 border-slate-700"
              />
              <span>Aplicar Redutor Setorial da Construção Civil (Desconto de 40% no IVA Dual)</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-slate-400 hover:text-emerald-400 inline-flex">
                    <HelpCircle className="w-3.5 h-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs p-3 bg-slate-900 border-slate-700 text-slate-200">
                  <p className="font-bold text-white mb-1">Benefício Setorial PLP 68/2024</p>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    O setor da construção civil e incorporação conta com redutor constitucional de 40%, reduzindo a alíquota padrão estimada de ~27,97% para uma alíquota efetiva de ~16,78%.
                  </p>
                </TooltipContent>
              </Tooltip>
            </label>
          </div>
        </div>

        {/* ---------------------------------------------------------------------- */}
        {/* CARD PRINCIPAL DE IMPACTO ECONÔMICO & PARECER */}
        {/* ---------------------------------------------------------------------- */}
        {comp && (
          <div
            className={`border rounded-xl p-6 shadow-sm transition-all ${
              isMei
                ? 'bg-gradient-to-r from-teal-950/40 via-slate-900 to-emerald-950/40 border-teal-500/40 text-teal-200'
                : isEconomia
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isMei
                      ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                      : isEconomia
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {isMei ? <Zap className="w-6 h-6" /> : isEconomia ? <TrendingDown className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                        isMei
                          ? 'bg-teal-500/20 text-teal-300'
                          : isEconomia
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {isMei ? 'Bypass Fiscal MEI Ativo (SIMEI)' : isEconomia ? 'Economia Tributária Projetada' : 'Acréscimo de Carga Fiscal'}
                    </span>
                    <span className="text-xs text-slate-400">Exercício {comp.exercicio_analisado}</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black mt-1 text-white tracking-tight">
                    {isMei ? (
                      <span>R$ 0,00 <span className="text-sm font-semibold text-teal-400 ml-2">(Isenção de Retenções na Fonte e IBS/CBS)</span></span>
                    ) : (
                      <>
                        {formatCurrency(Math.abs(comp.diferenca_nominal))}
                        <span className="text-sm font-semibold text-slate-400 ml-2">
                          ({Math.abs(comp.variacao_percentual_carga).toFixed(1)}% vs Modelo Legado)
                        </span>
                      </>
                    )}
                  </h3>
                </div>
              </div>

              {/* Destaque da Amortização ou do DAS-MEI */}
              <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-lg text-right flex-shrink-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  {isMei ? 'Recolhimento Fixo Unificado' : 'Amortização por Não-Cumulatividade'}
                </span>
                <span className="text-lg font-black text-emerald-400">
                  {isMei ? 'R$ 75,00 / mês' : formatCurrency(comp.credito_tributario_materiais_aproveitado)}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {isMei ? 'Guia única DAS-MEI por fora' : 'Créditos de materiais abatidos'}
                </span>
              </div>
            </div>

            <p className="mt-4 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/80 pt-3">
              <strong>Parecer da Consultoria GADAP:</strong> {comp.parecer_tecnico}
            </p>
          </div>
        )}

        {/* ---------------------------------------------------------------------- */}
        {/* COMPARATIVO LADO A LADO: REGIME ATUAL VS REGIME IVA DUAL */}
        {/* ---------------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* COLUNA 1: REGIME TRIBUTÁRIO ATUAL (LEGADO) */}
          <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-xl p-6 shadow-sm flex flex-col justify-between print:border-slate-300 print:bg-white">
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Regime Vigente
                  </span>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-lg font-black text-white flex items-center gap-2 print:text-slate-900">
                      Sistema Tributário Legado
                    </h2>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help text-slate-400 hover:text-emerald-400 inline-flex">
                          <HelpCircle className="w-4 h-4" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs p-3 bg-slate-900 border-slate-700 text-slate-200">
                        <p className="font-bold text-white mb-1">Modelo Tributário Cumulativo</p>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Baseado em ISSQN municipal (LC 116/2003), PIS/COFINS e retenção de INSS na fonte (11%). Sem aproveitamento dos tributos pagos em compras de insumos.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {isMei ? 'Isenção SIMEI' : 'Cumulativo'}
                </span>
              </div>

              <p className="text-xs text-slate-400 mb-4">
                {isMei
                  ? 'Bypass Fiscal MEI Ativo: Isenção automática de retenções na fonte (INSS 11%, IRRF, CSRF) conforme LC 123/2006.'
                  : 'Apuração com base nas retenções fiscais tradicionais de prestação de serviços de engenharia (LC 116/2003 e Lei 10.833/2003).'}
              </p>

            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 font-bold">Tributo / Retenção</th>
                  <th className="py-2 font-bold text-center">Alíquota</th>
                  <th className="py-2 font-bold text-right">Valor Retido / Devido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                <tr>
                  <td className="py-2.5">
                    <span className="font-semibold text-slate-200">ISS Municipal</span>
                    <span className="text-[10px] text-slate-500 block">
                      Base deduzida: {formatCurrency(legado?.base_calculo_iss)}
                    </span>
                  </td>
                  <td className="py-2.5 text-center font-mono">
                    {legado?.iss.aliquota_nominal_perc.toFixed(2)}%
                  </td>
                  <td className="py-2.5 text-right font-semibold text-slate-200">
                    {formatCurrency(legado?.iss.valor_devido)}
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5">
                    <span className="font-semibold text-slate-200">PIS / PASEP</span>
                    <span className="text-[10px] text-slate-500 block">Federal</span>
                  </td>
                  <td className="py-2.5 text-center font-mono">
                    {legado?.pis.aliquota_perc.toFixed(2)}%
                  </td>
                  <td className="py-2.5 text-right font-semibold text-slate-200">
                    {formatCurrency(legado?.pis.valor_devido)}
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5">
                    <span className="font-semibold text-slate-200">COFINS</span>
                    <span className="text-[10px] text-slate-500 block">Federal</span>
                  </td>
                  <td className="py-2.5 text-center font-mono">
                    {legado?.cofins.aliquota_perc.toFixed(2)}%
                  </td>
                  <td className="py-2.5 text-right font-semibold text-slate-200">
                    {formatCurrency(legado?.cofins.valor_devido)}
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5">
                    <span className="font-semibold text-slate-200">INSS Retenção</span>
                    <span className="text-[10px] text-slate-500 block">11% sobre 40% de mão de obra</span>
                  </td>
                  <td className="py-2.5 text-center font-mono">
                    {legado?.inss_retencao.aliquota_perc.toFixed(2)}%
                  </td>
                  <td className="py-2.5 text-right font-semibold text-slate-200">
                    {formatCurrency(legado?.inss_retencao.valor_devido)}
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5">
                    <span className="font-semibold text-slate-200">IRRF & CSLL</span>
                    <span className="text-[10px] text-slate-500 block">Retenções federais (1.5% + 1.0%)</span>
                  </td>
                  <td className="py-2.5 text-center font-mono">2.50%</td>
                  <td className="py-2.5 text-right font-semibold text-slate-200">
                    {formatCurrency((legado?.irrf.valor_devido || 0) + (legado?.csll.valor_devido || 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Total Legado</span>
              <span className="text-xl font-black text-white">
                {formatCurrency(legado?.total_tributos_legado)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Alíquota Efetiva</span>
              <span className="text-sm font-bold text-amber-400 font-mono">
                {legado?.aliquota_efetiva_legado_perc.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* COLUNA 2: REGIME REFORMA TRIBUTÁRIA (IVA DUAL: CBS + IBS) */}
        <div className="bg-slate-900/60 backdrop-blur-sm border border-emerald-500/30 rounded-xl p-6 shadow-sm flex flex-col justify-between print:border-slate-300 print:bg-white relative overflow-hidden">
          <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Novo Sistema Constitucional
                </span>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-lg font-black text-white flex items-center gap-2 print:text-slate-900">
                    Modelo IVA Dual (CBS + IBS)
                  </h2>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help text-emerald-400 hover:text-emerald-300 inline-flex">
                        <HelpCircle className="w-4 h-4" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs p-3 bg-slate-900 border-slate-700 text-slate-200">
                      <p className="font-bold text-white mb-1">Não-Cumulatividade Plena (EC 132/2023)</p>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Tributação moderna de valor agregado. A construtora apropria 100% dos créditos destacados em notas fiscais de cimento, aço, blocos, maquinário e locações para compensar o IBS e a CBS.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {isMei ? 'Isenção Art. 106' : 'Não-Cumulativo Pleno'}
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              {isMei
                ? 'Isenção Constitucional (Art. 106 do PLP 68/2024): O MEI não é contribuinte de CBS/IBS, com notas de serviços emitidas sem débitos.'
                : 'CBS (Federal) e IBS (Estadual/Municipal) calculados com o redutor setorial de 40% da Construção Civil e abatimento financeiro de insumos.'}
            </p>

            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 font-bold">Componente IVA</th>
                  <th className="py-2 font-bold text-center">Alíquota Ano</th>
                  <th className="py-2 font-bold text-right">Débito Bruto</th>
                  <th className="py-2 font-bold text-right text-emerald-400">(-) Créditos</th>
                  <th className="py-2 font-bold text-right">Líquido a Pagar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                <tr>
                  <td className="py-3">
                    <span className="font-semibold text-slate-200">CBS Federal</span>
                    <span className="text-[10px] text-slate-500 block">
                      Ref: {iva?.cbs.aliquota_padrao_referencia}% (-40% redutor)
                    </span>
                  </td>
                  <td className="py-3 text-center font-mono">
                    {iva?.cbs.aliquota_aplicada_ano.toFixed(2)}%
                  </td>
                  <td className="py-3 text-right font-medium text-slate-400">
                    {formatCurrency(iva?.cbs.debito_bruto)}
                  </td>
                  <td className="py-3 text-right font-semibold text-emerald-400">
                    -{formatCurrency(iva?.cbs.creditos_abatidos)}
                  </td>
                  <td className="py-3 text-right font-bold text-slate-100">
                    {formatCurrency(iva?.cbs.saldo_liquido_a_pagar)}
                  </td>
                </tr>

                <tr>
                  <td className="py-3">
                    <span className="font-semibold text-slate-200">IBS Subnacional</span>
                    <span className="text-[10px] text-slate-500 block">
                      Ref: {iva?.ibs.aliquota_padrao_referencia}% (Estadual + Municipal)
                    </span>
                  </td>
                  <td className="py-3 text-center font-mono">
                    {iva?.ibs.aliquota_aplicada_ano.toFixed(2)}%
                  </td>
                  <td className="py-3 text-right font-medium text-slate-400">
                    {formatCurrency(iva?.ibs.debito_bruto)}
                  </td>
                  <td className="py-3 text-right font-semibold text-emerald-400">
                    -{formatCurrency(iva?.ibs.creditos_abatidos)}
                  </td>
                  <td className="py-3 text-right font-bold text-slate-100">
                    {formatCurrency(iva?.ibs.saldo_liquido_a_pagar)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Aviso sobre Saldo Credor Remanescente */}
            {((iva?.cbs.saldo_credor_remanescente || 0) > 0 || (iva?.ibs.saldo_credor_remanescente || 0) > 0) && (
              <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>
                  <strong>Saldo Credor Transferível:</strong> A empresa mantém{' '}
                  {formatCurrency((iva?.cbs.saldo_credor_remanescente || 0) + (iva?.ibs.saldo_credor_remanescente || 0))}{' '}
                  em créditos acumulados para abater nas próximas medições ou pedir ressarcimento rápido.
                </span>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase text-emerald-400 block">Total IVA Dual Líquido</span>
              <span className="text-xl font-black text-white">
                {formatCurrency(iva?.total_iva_dual_liquido_devido)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Alíquota Efetiva Líquida</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                {iva?.aliquota_efetiva_iva_perc.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* SEÇÃO: RASTREAMENTO DOS CRÉDITOS FINANCEIROS DE MATERIAIS */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-xl p-6 shadow-sm print:border-slate-300 print:bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white tracking-tight print:text-slate-950">
                Rastreamento de Créditos Financeiros da Cadeia de Materiais
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 print:text-slate-600">
              Sob a <strong>Não-Cumulatividade Plena</strong>, cada aquisição de insumos gera créditos de CBS (8.8%) e IBS (17.7%) que reduzem diretamente a guia a recolher.
            </p>
          </div>

          <button
            onClick={() => setShowAddCredit(!showAddCredit)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/30 transition-all hover:scale-[1.02] shadow-sm shadow-emerald-500/20 flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Compra com Crédito
          </button>
        </div>

        {/* Modal / Formulário de Cadastro Rápido de Crédito de Insumos */}
        {showAddCredit && (
          <div className="mb-6 p-4 rounded-xl bg-slate-950 border border-slate-700/80 space-y-4">
            <h3 className="text-xs font-bold uppercase text-emerald-400 tracking-wider">
              Lançamento de Nota Fiscal de Compra de Insumos
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Fornecedor / Razão Social</label>
                <input
                  type="text"
                  placeholder="Ex: Gerdau Aços S.A."
                  value={creditSupplier}
                  onChange={(e) => setCreditSupplier(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">CNPJ do Fornecedor</label>
                <input
                  type="text"
                  placeholder="00.000.000/0000-00"
                  value={creditCnpj}
                  onChange={(e) => setCreditCnpj(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Número NF-e / Documento</label>
                <input
                  type="text"
                  placeholder="NF-e 12345"
                  value={creditDocNumber}
                  onChange={(e) => setCreditDocNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Valor dos Materiais (R$)</label>
                <input
                  type="number"
                  min="100"
                  step="500"
                  value={creditMaterialAmount}
                  onChange={(e) => setCreditMaterialAmount(Number(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddCredit(false)}
                className="px-3 py-1.5 rounded text-xs font-semibold text-slate-400 hover:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!creditSupplier || creditMaterialAmount <= 0 || createCreditMutation.isPending}
                onClick={() => createCreditMutation.mutate()}
                className="px-3.5 py-1.5 rounded text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
              >
                {createCreditMutation.isPending ? 'Gravando...' : 'Salvar Crédito'}
              </button>
            </div>
          </div>
        )}

        {/* Tabela de Créditos Registrados */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 print:border-slate-300">
                <th className="py-2.5 font-bold">Documento</th>
                <th className="py-2.5 font-bold">Fornecedor</th>
                <th className="py-2.5 font-bold text-right">Valor Materiais</th>
                <th className="py-2.5 font-bold text-right">Crédito CBS (8.8%)</th>
                <th className="py-2.5 font-bold text-right">Crédito IBS (17.7%)</th>
                <th className="py-2.5 font-bold text-right text-emerald-400">Total Amortização</th>
                <th className="py-2.5 font-bold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 print:divide-slate-200">
              {taxCredits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    Nenhum crédito fiscal de insumo registrado ainda. Clique em "Adicionar Compra" para registrar notas de fornecedores.
                  </td>
                </tr>
              ) : (
                taxCredits.map((cred) => (
                  <tr key={cred.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 font-mono font-bold text-slate-200">
                      {cred.document_number || 'NF-e'}
                    </td>
                    <td className="py-3">
                      <div className="font-semibold text-slate-100">{cred.supplier_name}</div>
                      <span className="text-[10px] text-slate-500 font-mono">{cred.supplier_cnpj}</span>
                    </td>
                    <td className="py-3 text-right font-medium text-slate-300">
                      {formatCurrency(cred.material_gross_amount)}
                    </td>
                    <td className="py-3 text-right font-mono text-slate-300">
                      {formatCurrency(cred.cbs_credit_amount)}
                    </td>
                    <td className="py-3 text-right font-mono text-slate-300">
                      {formatCurrency(cred.ibs_credit_amount)}
                    </td>
                    <td className="py-3 text-right font-bold text-emerald-400">
                      {formatCurrency(cred.total_credit_amount)}
                    </td>
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Check className="w-3 h-3" /> Disponível
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </TooltipProvider>
);
}
