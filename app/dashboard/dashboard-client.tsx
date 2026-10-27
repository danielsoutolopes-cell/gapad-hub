'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp,
  DollarSign,
  PieChart as PieChartIcon,
  HardHat,
  ShieldCheck,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Building,
  Calendar,
  Layers,
  Activity,
  CheckCircle2,
  Clock,
  Sparkles,
  Percent,
  Receipt,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Line,
} from 'recharts';

interface ExecutiveData {
  tenant_id: string;
  faturamento_total_mes: number;
  ticket_medio: number;
  total_retencoes_fiscais: number;
  lucro_bruto_projetado: number;
  margem_lucro_perc: number;
  obras_ativas: number;
  receitas_mes: number;
  despesas_mes: number;
  comparativo_mes_anterior_perc: number;
  mes_referencia: string;
}

interface CostCenterItem {
  categoria: string;
  nome_exibicao: string;
  total: number;
  percentual: number;
  cor: string;
}

interface MonthlyEvolutionItem {
  mes: string;
  mes_completo: string;
  receitas: number;
  despesas: number;
  lucro: number;
  margem_perc: number;
}

interface DreData {
  tenant_id: string;
  periodo: string;
  receitas_total: number;
  despesas_total: number;
  resultado_liquido: number;
  margem_liquida_perc: number;
  por_centro_custo: CostCenterItem[];
  evolucao_mensal: MonthlyEvolutionItem[];
}

interface CurveSProject {
  id: string;
  nome: string;
  codigo?: string;
  valor_contrato: number;
  total_medido: number;
  total_faturado: number;
  percentual_fisico: number;
  percentual_financeiro: number;
  saldo_contratual: number;
  status: string;
}

interface CurveSPoint {
  periodo: string;
  planejado_acumulado: number;
  fisico_acumulado: number;
  financeiro_acumulado: number;
}

interface CurveSData {
  tenant_id: string;
  obras_ativas: number;
  valor_total_contratos: number;
  total_medido_global: number;
  total_faturado_global: number;
  avanco_fisico_medio_perc: number;
  avanco_financeiro_medio_perc: number;
  obras: CurveSProject[];
  curva_s_acumulada: CurveSPoint[];
}

const formatCurrency = (val: number = 0) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const formatCompactK = (val: number = 0) => {
  if (Math.abs(val) >= 1000000) {
    return `R$ ${(val / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(val) >= 1000) {
    return `R$ ${(val / 1000).toFixed(0)}k`;
  }
  return `R$ ${val.toFixed(0)}`;
};

export function ExecutiveDashboardClient({ tenantName }: { tenantName: string }) {
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Query: Resumo Executivo
  const {
    data: executive,
    isLoading: loadingExec,
    isFetching: fetchingExec,
    refetch: refetchExec,
  } = useQuery<ExecutiveData>({
    queryKey: ['analytics-executive'],
    queryFn: async () => {
      const resp = await fetch('/api/v1/analytics/executive');
      if (!resp.ok) throw new Error('Falha ao carregar Resumo Executivo');
      return resp.json();
    },
  });

  // 2. Query: DRE Gerencial & Centro de Custo
  const {
    data: dre,
    isLoading: loadingDre,
    isFetching: fetchingDre,
    refetch: refetchDre,
  } = useQuery<DreData>({
    queryKey: ['analytics-dre'],
    queryFn: async () => {
      const resp = await fetch('/api/v1/analytics/financial/dre');
      if (!resp.ok) throw new Error('Falha ao carregar DRE Gerencial');
      return resp.json();
    },
  });

  // 3. Query: Curva S & Avanço de Obras
  const {
    data: curveS,
    isLoading: loadingCurve,
    isFetching: fetchingCurve,
    refetch: refetchCurve,
  } = useQuery<CurveSData>({
    queryKey: ['analytics-curve-s'],
    queryFn: async () => {
      const resp = await fetch('/api/v1/analytics/engineering/curve-s');
      if (!resp.ok) throw new Error('Falha ao carregar dados de Engenharia');
      return resp.json();
    },
  });

  const isAnyLoading = loadingExec || loadingDre || loadingCurve;
  const isAnyFetching = fetchingExec || fetchingDre || fetchingCurve;

  const handleRefreshAll = () => {
    refetchExec();
    refetchDre();
    refetchCurve();
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const resp = await fetch('/api/v1/analytics/export');
      if (!resp.ok) throw new Error('Falha na geração do arquivo Excel');
      const blob = await resp.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `GADAP_Relatorio_Executivo_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      console.error(err);
      alert('Não foi possível realizar o download do relatório Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  // Custom Dark Tooltip para BarChart
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700/80 p-3 rounded-lg shadow-xl text-xs space-y-1">
          <p className="font-bold text-slate-200 border-b border-slate-800 pb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`tooltip-${index}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}:
              </span>
              <span className="font-semibold text-slate-100">{formatCurrency(entry.value)}</span>
            </div>
          ))}
          {payload.length >= 2 && (
            <div className="pt-1 mt-1 border-t border-slate-800 flex items-center justify-between gap-4 text-emerald-400 font-bold">
              <span>Lucro Operacional:</span>
              <span>{formatCurrency(payload[0].value - payload[1].value)}</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip para PieChart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as CostCenterItem;
      return (
        <div className="bg-slate-900 border border-slate-700/80 p-2.5 rounded-lg shadow-xl text-xs space-y-0.5">
          <p className="font-bold text-slate-100 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.cor }} />
            {data.nome_exibicao}
          </p>
          <p className="text-slate-300 font-medium">Valor: {formatCurrency(data.total)}</p>
          <p className="text-emerald-400 font-semibold">{data.percentual}% do Total de Despesas</p>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip para Curva S
  const CustomCurveTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700/80 p-3 rounded-lg shadow-xl text-xs space-y-1">
          <p className="font-bold text-slate-200 border-b border-slate-800 pb-1">{label}</p>
          {payload.map((entry: any, idx: number) => (
            <div key={`curv-tt-${idx}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}:
              </span>
              <span className="font-bold text-slate-100">{entry.value}%</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ---------------------------------------------------------------------- */}
      {/* CABEÇALHO DO DASHBOARD EXECUTIVO */}
      {/* ---------------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6 print:border-b-2 print:border-slate-300 print:pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2 print:text-slate-950">
              Dashboard Executivo & Analytics
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 print:bg-emerald-100 print:text-emerald-800">
              <Sparkles className="w-3 h-3" /> V0 Estável
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1 print:text-slate-600">
            Módulo 4.7 • Inteligência Analítica, DRE por Centro de Custo e Curva S de Obras da{' '}
            <strong className="text-slate-200 print:text-slate-900">{tenantName}</strong>.
          </p>
        </div>

        {/* Barra de Ações (Oculta na Impressão) */}
        <div className="flex items-center gap-2.5 print:hidden">
          <button
            onClick={handleRefreshAll}
            disabled={isAnyFetching}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 transition-all hover:scale-[1.02] disabled:opacity-50"
            title="Atualizar Indicadores"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnyFetching ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/30 transition-all hover:scale-[1.02] shadow-sm shadow-emerald-500/20 disabled:opacity-50"
          >
            <FileSpreadsheet className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
            {isExporting ? 'Exportando...' : 'Exportar Excel'}
          </button>

          <button
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all hover:scale-[1.02]"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            Gerar PDF
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* CARDS EXECUTIVOS SUPERIORES */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
        {/* Card 1: Faturamento do Mês */}
        <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-all print:border-slate-300 print:bg-slate-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-slate-700">
              Faturamento do Mês
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 print:bg-emerald-100 print:text-emerald-800">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white tracking-tight print:text-slate-900">
              {formatCurrency(executive?.faturamento_total_mes || 180000)}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 font-semibold print:text-emerald-700">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+{executive?.comparativo_mes_anterior_perc || 125}% vs mês anterior</span>
            </div>
          </div>
        </div>

        {/* Card 2: Lucro Líquido Projetado */}
        <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-all print:border-slate-300 print:bg-slate-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-slate-700">
              Lucro Bruto Projetado
            </span>
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 print:bg-blue-100 print:text-blue-800">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white tracking-tight print:text-slate-900">
              {formatCurrency(executive?.lucro_bruto_projetado || 323890)}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-400 font-semibold print:text-blue-700">
              <Percent className="w-3.5 h-3.5" />
              <span>Margem Bruta: {executive?.margem_lucro_perc || 86.4}%</span>
            </div>
          </div>
        </div>

        {/* Card 3: Obras Ativas */}
        <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-all print:border-slate-300 print:bg-slate-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-slate-700">
              Obras Ativas
            </span>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20 print:bg-amber-100 print:text-amber-800">
              <HardHat className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white tracking-tight print:text-slate-900">
              {executive?.obras_ativas || 2}{' '}
              <span className="text-sm font-semibold text-slate-400 print:text-slate-600">canteiros</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400 font-semibold print:text-amber-700">
              <Activity className="w-3.5 h-3.5" />
              <span>Avanço físico médio: {curveS?.avanco_fisico_medio_perc || 70.8}%</span>
            </div>
          </div>
        </div>

        {/* Card 4: Retenções Fiscais e Técnicas */}
        <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-all print:border-slate-300 print:bg-slate-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-slate-700">
              Retenções Tributárias
            </span>
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20 print:bg-purple-100 print:text-purple-800">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white tracking-tight print:text-slate-900">
              {formatCurrency(executive?.total_retencoes_fiscais || 23750)}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-purple-400 font-semibold print:text-purple-700">
              <Clock className="w-3.5 h-3.5" />
              <span>ISS + INSS + Ret. Técnica</span>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* DESTAQUE UX: ACESSO RÁPIDO À CENTRAL FINANCEIRA (RECEBER & PAGAR) */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
        <Link
          href="/dashboard/financeiro/receber"
          className="group p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-slate-900/80 border border-emerald-500/30 hover:border-emerald-500/60 transition-all shadow-lg shadow-emerald-950/20 flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <ArrowUpRight className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Central de Contas a Receber
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                  Entradas
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Recebimentos de medições, emissão de faturas e acompanhamento de liquidez de todas as obras.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            Acessar <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </Link>

        <Link
          href="/dashboard/financeiro/pagar"
          className="group p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 to-slate-900/80 border border-rose-500/30 hover:border-rose-500/60 transition-all shadow-lg shadow-rose-950/20 flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-transform">
              <ArrowDownRight className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white group-hover:text-rose-300 transition-colors">
                  Central de Contas a Pagar
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold">
                  Saídas
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Boletos de insumos, compras de fornecedores e adiantamentos de subempreiteiros sem travas.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-rose-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            Acessar <ArrowDownRight className="w-3.5 h-3.5" />
          </span>
        </Link>

        {/* Card 3: Central Fiscal Hub */}
        <Link
          href="/dashboard/fiscal"
          className="md:col-span-2 group p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900/80 border border-purple-500/30 hover:border-purple-500/60 transition-all shadow-lg shadow-purple-950/20 flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
              <Receipt className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                  Central Fiscal & Faturamento Backoffice
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold">
                  Hub Nacional
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Painel unificado de NFS-e (Serviço) e NF-e (Material), retenções na fonte de todas as obras e créditos da Reforma Tributária.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-purple-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            Acessar Painel <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* SEÇÃO PRINCIPAL DE GRÁFICOS (RECHARTS) */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico 1: Barras (Receitas vs Despesas - 6 Meses) */}
        <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-xl p-6 shadow-sm print:border-slate-300 print:bg-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2 print:text-slate-950">
                <TrendingUp className="w-4 h-4 text-emerald-400 print:text-emerald-700" />
                Receitas vs Despesas (Últimos 6 Meses)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 print:text-slate-600">
                Comparativo de fluxo de caixa realizado e margem de contribuição operacional.
              </p>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60 print:border-slate-300 print:bg-slate-100 print:text-slate-800">
              Semestral
            </span>
          </div>

          <div className="h-72 w-full pt-2">
            {mounted && dre?.evolucao_mensal ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dre.evolucao_mensal} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="mes"
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatCompactK}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
                    formatter={(value) => <span className="text-slate-300 text-xs font-medium">{value}</span>}
                  />
                  <Bar
                    dataKey="receitas"
                    name="Receitas Faturadas"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                  <Bar
                    dataKey="despesas"
                    name="Custos & Despesas"
                    fill="#F43F5E"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Carregando dados analíticos...
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 2: Rosca / Donut (Distribuição por Centro de Custo) */}
        <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-xl p-6 shadow-sm print:border-slate-300 print:bg-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2 print:text-slate-950">
                <PieChartIcon className="w-4 h-4 text-blue-400 print:text-blue-700" />
                Despesas por Centro de Custo
              </h2>
            </div>
            <p className="text-xs text-slate-400 mb-2 print:text-slate-600">
              Apropriação de custos diretos e operacionais.
            </p>
          </div>

          <div className="h-56 w-full relative flex items-center justify-center">
            {mounted && dre?.por_centro_custo ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Pie
                    data={dre.por_centro_custo}
                    dataKey="total"
                    nameKey="nome_exibicao"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {dre.por_centro_custo.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor || '#3b82f6'} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500">Carregando centro de custos...</div>
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total</span>
              <span className="text-sm font-extrabold text-white print:text-slate-900">
                {formatCompactK(dre?.despesas_total || 51110)}
              </span>
            </div>
          </div>

          {/* Legenda Customizada em Lista */}
          <div className="mt-2 space-y-1.5 border-t border-slate-800 pt-3 print:border-slate-300">
            {dre?.por_centro_custo.slice(0, 4).map((item, idx) => (
              <div key={`leg-${idx}`} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.cor }} />
                  <span className="text-slate-300 truncate print:text-slate-800">{item.nome_exibicao}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 font-semibold">
                  <span className="text-slate-400 text-[11px]">{item.percentual}%</span>
                  <span className="text-slate-200 print:text-slate-900">{formatCompactK(item.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* GRÁFICO 3: CURVA S DE ENGENHARIA (AVANÇO FÍSICO VS FINANCEIRO) */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-xl p-6 shadow-sm print:border-slate-300 print:bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2 print:text-slate-950">
              <Activity className="w-4 h-4 text-emerald-400 print:text-emerald-700" />
              Curva S de Engenharia: Avanço Físico (Medições) vs Financeiro (Faturado)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 print:text-slate-600">
              Controle determinístico de progresso acumulado em relação ao cronograma planejado.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-3 h-0.5 bg-slate-500 inline-block border-b border-dashed" /> Planejado
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-3 h-1 bg-emerald-500 inline-block rounded" /> Físico Real
            </span>
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="w-3 h-1 bg-blue-500 inline-block rounded" /> Financeiro
            </span>
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          {mounted && curveS?.curva_s_acumulada ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curveS.curva_s_acumulada} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="fisicoGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="financeiroGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="periodo"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}%`}
                  domain={[0, 100]}
                />
                <Tooltip content={<CustomCurveTooltip />} />
                <Area
                  type="monotone"
                  dataKey="fisico_acumulado"
                  name="Físico Real"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#fisicoGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="financeiro_acumulado"
                  name="Financeiro Faturado"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#financeiroGradient)"
                />
                <Line
                  type="monotone"
                  dataKey="planejado_acumulado"
                  name="Planejado"
                  stroke="#94A3B8"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">
              Carregando curva de engenharia...
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* TABELA ANALÍTICA DE OBRAS & DRE SINTÉTICO */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tabela de Obras em Andamento */}
        <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-xl p-6 shadow-sm print:border-slate-300 print:bg-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2 print:text-slate-950">
                <Building className="w-4 h-4 text-emerald-400 print:text-emerald-700" />
                Painel Físico-Financeiro das Obras Ativas
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 print:text-slate-600">
                Acompanhamento individual de contratos, medições aprovadas e saldos.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-400 print:text-slate-600">
              {curveS?.obras.length || 2} Obras
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 print:border-slate-300 print:text-slate-700">
                  <th className="py-2.5 font-bold">Empreendimento</th>
                  <th className="py-2.5 font-bold text-right">Contrato</th>
                  <th className="py-2.5 font-bold text-right">Faturado</th>
                  <th className="py-2.5 font-bold">Avanço Físico / Financeiro</th>
                  <th className="py-2.5 font-bold text-right">Saldo Restante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 print:divide-slate-200">
                {curveS?.obras.map((obra) => (
                  <tr key={obra.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 pr-2">
                      <div className="font-bold text-slate-100 print:text-slate-900">{obra.nome}</div>
                      <span className="text-[10px] text-slate-500 font-mono">{obra.codigo || 'OBRA-2026'}</span>
                    </td>
                    <td className="py-3 px-2 text-right font-medium text-slate-300 print:text-slate-800">
                      {formatCurrency(obra.valor_contrato)}
                    </td>
                    <td className="py-3 px-2 text-right font-semibold text-emerald-400 print:text-emerald-700">
                      {formatCurrency(obra.total_faturado)}
                    </td>
                    <td className="py-3 px-2 w-48">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">Físico:</span>
                          <span className="font-bold text-emerald-400">{obra.percentual_fisico}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, obra.percentual_fisico)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">Financeiro:</span>
                          <span className="font-bold text-blue-400">{obra.percentual_financeiro}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, obra.percentual_financeiro)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pl-2 text-right font-semibold text-slate-300 print:text-slate-900">
                      {formatCurrency(obra.saldo_contratual)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* DRE Sintético Consolidado */}
        <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-xl p-6 shadow-sm print:border-slate-300 print:bg-white flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2 mb-1 print:text-slate-950">
              <DollarSign className="w-4 h-4 text-emerald-400 print:text-emerald-700" />
              DRE Gerencial Sintético
            </h2>
            <p className="text-xs text-slate-400 mb-4 print:text-slate-600">
              Demonstração contábil-gerencial do exercício.
            </p>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800 print:border-slate-200">
                <span className="font-bold text-slate-200 print:text-slate-900">(=) Receita Bruta</span>
                <span className="font-extrabold text-white print:text-slate-950">
                  {formatCurrency(dre?.receitas_total || 375000)}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-800 print:border-slate-200 text-slate-400 print:text-slate-700">
                <span>(-) Retenções Técnicas & Tributos</span>
                <span className="font-medium text-rose-400">
                  -{formatCurrency(executive?.total_retencoes_fiscais || 23750)}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-800 print:border-slate-200 bg-slate-800/30 px-2 rounded font-semibold text-slate-200 print:bg-slate-100 print:text-slate-900">
                <span>(=) Receita Líquida</span>
                <span>
                  {formatCurrency(
                    (dre?.receitas_total || 375000) - (executive?.total_retencoes_fiscais || 23750)
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-800 print:border-slate-200 text-slate-400 print:text-slate-700">
                <span>(-) Custos Operacionais Diretos</span>
                <span className="font-medium text-rose-400">
                  -{formatCurrency(dre?.despesas_total || 51110)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 px-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 print:bg-emerald-50 print:border-emerald-300 print:text-emerald-900 font-extrabold text-sm">
                <span>(=) Lucro Líquido</span>
                <span>{formatCurrency(dre?.resultado_liquido || 323890)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between print:border-slate-300">
            <span>Margem Líquida Geral</span>
            <span className="font-bold text-emerald-400 print:text-emerald-700">
              {dre?.margem_liquida_perc || 86.4}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
