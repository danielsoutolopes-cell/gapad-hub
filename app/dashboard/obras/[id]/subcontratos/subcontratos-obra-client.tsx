'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  HardHat,
  ArrowLeft,
  Plus,
  Calendar,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileText,
  Clock,
  Layers,
  Sparkles,
  TrendingUp,
  Tag,
  Search,
  Filter,
  X,
  Loader2,
  Check,
  CreditCard,
  Building2,
  ExternalLink,
  ChevronRight,
  Info,
  Scale,
  Receipt,
  HelpCircle,
  MessageCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ContextualHelp } from '@/components/help/contextual-help';

// =============================================================================
// TIPOS E MODELOS DE DADOS
// =============================================================================

export type RiskStatus = 'GREEN' | 'YELLOW' | 'RED';

export interface SpecialtyItem {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string;
}

export interface SupplierItem {
  id: string;
  name: string;
  trade_name?: string | null;
  document?: string | null;
  tax_regime?: string | null;
  phone?: string | null;
  email?: string | null;
  is_subcontractor?: boolean;
}

export interface ProjectDetail {
  id: string;
  name: string;
  code?: string | null;
  cno?: string | null;
  contract_value: number;
  status: string;
  clients?: {
    name: string;
    document?: string;
  } | null;
}

export interface SubcontractItem {
  id: string;
  tenant_id: string;
  project_id: string;
  supplier_id: string;
  contract_number?: string | null;
  scope_description: string;
  total_value: number;
  technical_retention_percentage: number;
  status: 'active' | 'suspended' | 'completed' | 'cancelled';
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  created_at: string;
  // Campos calculados e enriquecidos
  specialties: string[];
  total_paid: number;
  total_measured: number;
  balance_remaining: number;
  financial_exposure: number;
  risk_status: RiskStatus;
  risk_description: string;
  suppliers?: SupplierItem | null;
  projects?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
}

export interface SubcontractTransaction {
  id: string;
  tenant_id: string;
  subcontract_id: string;
  type: 'PAYMENT' | 'MEASUREMENT';
  amount: number;
  date: string;
  observation?: string | null;
  financial_entry_id?: string | null;
  created_at: string;
}

interface SubcontratosObraClientProps {
  projectId: string;
}

// Formatadores
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
};

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  try {
    const [y, m, d] = dateStr.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
};

export function SubcontratosObraClient({ projectId }: SubcontratosObraClientProps) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Estados de Filtro e Busca
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | RiskStatus>('ALL');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('ALL');

  // Estados de Modais
  const [paymentSubcontract, setPaymentSubcontract] = useState<SubcontractItem | null>(null);
  const [measurementSubcontract, setMeasurementSubcontract] = useState<SubcontractItem | null>(null);
  const [statementSubcontract, setStatementSubcontract] = useState<SubcontractItem | null>(null);
  const [specialtiesTargetSupplier, setSpecialtiesTargetSupplier] = useState<SupplierItem | null>(null);
  const [isSpecialtiesModalOpen, setIsSpecialtiesModalOpen] = useState(false);
  const [isNewSubcontractModalOpen, setIsNewSubcontractModalOpen] = useState(false);

  // Estados de Notificação/Feedback
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    warning?: string | null;
  } | null>(null);

  // ===========================================================================
  // 1. QUERIES (Dados da Obra, Subcontratos, Especialidades e Fornecedores)
  // ===========================================================================

  // 1.1 Detalhes da Obra
  const { data: project, isLoading: isLoadingProject } = useQuery<ProjectDetail>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada.');

      try {
        const res = await fetch(`/api/v1/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Fallback para Supabase ao buscar obra:', err);
      }

      const { data, error } = await supabase
        .from('projects')
        .select('id, name, code, cno, contract_value, status, clients(name, document)')
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  // 1.2 Subcontratos da Obra (Com Farol e Especialidades enriquecidos)
  const {
    data: subcontracts = [],
    isLoading: isLoadingSubcontracts,
    isRefetching: isRefetchingSubcontracts,
  } = useQuery<SubcontractItem[]>({
    queryKey: ['subcontracts', projectId],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada.');

      const res = await fetch(`/api/v1/subcontracts?project_id=${projectId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Falha ao buscar subcontratos da obra.');
      }
      return await res.json();
    },
  });

  // 1.3 Catálogo de Especialidades do Tenant
  const { data: allSpecialties = [] } = useQuery<SpecialtyItem[]>({
    queryKey: ['specialties'],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return [];

      const res = await fetch('/api/v1/subcontracts/specialties', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return [];
      return await res.json();
    },
  });

  // 1.4 Fornecedores (para criação de novo subcontrato)
  const { data: suppliers = [] } = useQuery<SupplierItem[]>({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return [];

      try {
        const res = await fetch('/api/v1/suppliers?limit=100', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const json = await res.json();
          return json.items || json || [];
        }
      } catch (err) {
        console.warn('Fallback Supabase fornecedores:', err);
      }

      const { data } = await supabase
        .from('suppliers')
        .select('id, name, trade_name, document, tax_regime, is_subcontractor')
        .order('name');
      return (data as any) || [];
    },
  });

  // ===========================================================================
  // 2. CÁLCULO DOS INDICADORES CONSOLIDADOS (FAROL DA OBRA)
  // ===========================================================================
  const summary = useMemo(() => {
    let totalContratado = 0;
    let totalPago = 0;
    let totalMedido = 0;
    let greenCount = 0;
    let yellowCount = 0;
    let redCount = 0;

    for (const sub of subcontracts) {
      totalContratado += Number(sub.total_value) || 0;
      totalPago += Number(sub.total_paid) || 0;
      totalMedido += Number(sub.total_measured) || 0;

      if (sub.risk_status === 'GREEN') greenCount++;
      else if (sub.risk_status === 'YELLOW') yellowCount++;
      else if (sub.risk_status === 'RED') redCount++;
    }

    const totalExposicao = Math.max(0, totalPago - totalMedido);

    return {
      totalContratado,
      totalPago,
      totalMedido,
      totalExposicao,
      greenCount,
      yellowCount,
      redCount,
      count: subcontracts.length,
    };
  }, [subcontracts]);

  // ===========================================================================
  // 3. FILTRAGEM DOS SUBCONTRATOS
  // ===========================================================================
  const filteredSubcontracts = useMemo(() => {
    return subcontracts.filter((sub) => {
      // Filtro de Farol
      if (riskFilter !== 'ALL' && sub.risk_status !== riskFilter) {
        return false;
      }

      // Filtro de Especialidade
      if (specialtyFilter !== 'ALL') {
        const hasSpec = sub.specialties?.some(
          (s) => s.toLowerCase() === specialtyFilter.toLowerCase()
        );
        if (!hasSpec) return false;
      }

      // Filtro de Texto
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const suppName = (sub.suppliers?.name || '').toLowerCase();
        const tradeName = (sub.suppliers?.trade_name || '').toLowerCase();
        const doc = (sub.suppliers?.document || '').toLowerCase();
        const scope = (sub.scope_description || '').toLowerCase();
        const contractNum = (sub.contract_number || '').toLowerCase();

        return (
          suppName.includes(term) ||
          tradeName.includes(term) ||
          doc.includes(term) ||
          scope.includes(term) ||
          contractNum.includes(term)
        );
      }

      return true;
    });
  }, [subcontracts, riskFilter, specialtyFilter, searchTerm]);

  // Helper de Cores e Estilos do Farol
  const getFarolMeta = (status: RiskStatus) => {
    switch (status) {
      case 'GREEN':
        return {
          borderClass: 'border-emerald-500/70 hover:border-emerald-400',
          bgGlow: 'bg-gradient-to-br from-emerald-950/20 via-slate-900/80 to-slate-950/95',
          shadowClass: 'shadow-lg shadow-emerald-950/25',
          badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          dotClass: 'bg-emerald-400 shadow-[0_0_8px_#10b981]',
          title: 'Farol Verde',
          shortStatus: 'Equilibrado (Medição em dia)',
          description: 'Desembolsos cobertos pelo avanço físico medido.',
        };
      case 'YELLOW':
        return {
          borderClass: 'border-amber-500/70 hover:border-amber-400',
          bgGlow: 'bg-gradient-to-br from-amber-950/20 via-slate-900/80 to-slate-950/95',
          shadowClass: 'shadow-lg shadow-amber-950/25',
          badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          dotClass: 'bg-amber-400 shadow-[0_0_8px_#f59e0b]',
          title: 'Farol Amarelo',
          shortStatus: 'Atenção (Desembolso > Medição)',
          description: 'Adiantamento concedido sem medição (< 80% do contrato).',
        };
      case 'RED':
        return {
          borderClass: 'border-rose-500/80 hover:border-rose-400 ring-1 ring-rose-500/30',
          bgGlow: 'bg-gradient-to-br from-rose-950/30 via-slate-900/80 to-slate-950/95',
          shadowClass: 'shadow-xl shadow-rose-950/40',
          badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          dotClass: 'bg-rose-400 animate-pulse shadow-[0_0_10px_#f43f5e]',
          title: 'Farol Vermelho',
          shortStatus: 'Risco Crítico (Desembolso > 80%)',
          description: 'Desembolso atingiu mais de 80% do valor global sem medição correspondente!',
        };
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* ------------------------------------------------------------------- */}
      {/* NAVEGAÇÃO & TOPO                                                    */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link
              href="/dashboard/obras"
              className="hover:text-emerald-400 transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Obras & Canteiros
            </Link>
            <span>/</span>
            <span className="text-slate-300 font-medium">
              {isLoadingProject ? 'Carregando obra...' : project?.name || 'Obra'}
            </span>
            <span>/</span>
            <span className="text-emerald-400 font-semibold">Subcontratos & Terceirizados</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-emerald-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/5">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Gestão de Terceirizados & Subcontratos
                <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  Modelo Farol
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Conta corrente desburocratizada com política <strong>Zero Travas</strong>, campos de
                atuação e controle visual do risco físico-financeiro.
              </p>
            </div>
          </div>
        </div>

        {/* Botões de Ação do Topo */}
        <div className="flex items-center gap-2 flex-wrap">
          <ContextualHelp topic="subcontratos" variant="button" />

          <button
            type="button"
            onClick={() => {
              setSpecialtiesTargetSupplier(null);
              setIsSpecialtiesModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 transition-all shadow-sm"
          >
            <Tag className="w-4 h-4 text-amber-400" />
            Especialidades & Atuação
          </button>

          <Link
            href={`/dashboard/obras/${projectId}/medicoes`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 transition-all shadow-sm"
            title="Acessar Medições Gerais da Obra"
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            Medições da Obra
          </Link>

          <button
            type="button"
            onClick={() => setIsNewSubcontractModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 shadow-md shadow-amber-400/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Novo Subcontrato
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* BANNER DE FEEDBACK DINÂMICO (Ex: Alertas do Farol)                  */}
      {/* ------------------------------------------------------------------- */}
      {feedbackBanner && (
        <div
          className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
            feedbackBanner.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
              : feedbackBanner.type === 'warning'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {feedbackBanner.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            ) : feedbackBanner.type === 'warning' ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs sm:text-sm">
              <p className="font-bold text-white">{feedbackBanner.message}</p>
              {feedbackBanner.warning && (
                <p className="mt-1 text-xs opacity-90">{feedbackBanner.warning}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* CARDS DE RESUMO EXECUTIVO (FAROL CONSOLIDADO)                        */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Montante Subcontratado */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Total Subcontratado</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            {formatCurrency(summary.totalContratado)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="font-semibold text-sky-400">{summary.count}</span> contratos ativos
            com parceiros
          </div>
        </div>

        {/* Card 2: Total Desembolsado (Pago) */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Total Desembolsado (Pago)</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-300 font-mono">
            {formatCurrency(summary.totalPago)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {summary.totalContratado > 0
              ? `${((summary.totalPago / summary.totalContratado) * 100).toFixed(1)}% do contratado`
              : 'Sem contratos'}
          </div>
        </div>

        {/* Card 3: Total Medido Físico */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Avanço Físico Medido</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            {formatCurrency(summary.totalMedido)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>
              {summary.totalContratado > 0
                ? `${((summary.totalMedido / summary.totalContratado) * 100).toFixed(1)}% executado`
                : '0%'}
            </span>
            {summary.totalExposicao > 0 && (
              <span className="text-amber-400 font-semibold font-mono text-[10px]">
                Exp: {formatCurrency(summary.totalExposicao)}
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Farol Consolidado da Obra */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Farol Consolidado</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2 my-1">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
              title="Farol Verde (Equilibrado)"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {summary.greenCount}
            </span>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30"
              title="Farol Amarelo (Atenção)"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              {summary.yellowCount}
            </span>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30"
              title="Farol Vermelho (Risco Crítico)"
            >
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              {summary.redCount}
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            {summary.redCount > 0 ? (
              <span className="text-rose-400 font-medium">⚠️ {summary.redCount} parceiro(s) em risco crítico</span>
            ) : summary.yellowCount > 0 ? (
              <span className="text-amber-400 font-medium">⚡ {summary.yellowCount} com adiantamento a medir</span>
            ) : (
              <span className="text-emerald-400 font-medium">✓ Todos os desembolsos cobertos</span>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* BARRA DE FILTROS E BUSCA                                            */}
      {/* ------------------------------------------------------------------- */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Campo de Busca */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome do subempreiteiro, CNPJ, contrato ou escopo..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-xs sm:text-sm focus:outline-none focus:border-amber-500 transition-colors placeholder:text-slate-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtros por Farol e Especialidade */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro Farol */}
          <div className="flex items-center bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setRiskFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                riskFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos ({subcontracts.length})
            </button>
            <button
              type="button"
              onClick={() => setRiskFilter('GREEN')}
              className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-all ${
                riskFilter === 'GREEN'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Verde ({summary.greenCount})
            </button>
            <button
              type="button"
              onClick={() => setRiskFilter('YELLOW')}
              className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-all ${
                riskFilter === 'YELLOW'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Amarelo ({summary.yellowCount})
            </button>
            <button
              type="button"
              onClick={() => setRiskFilter('RED')}
              className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-all ${
                riskFilter === 'RED'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              Vermelho ({summary.redCount})
            </button>
          </div>

          {/* Filtro de Especialidade (Dropdown) */}
          {allSpecialties.length > 0 && (
            <select
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">Todas as Atuações</option>
              {allSpecialties.map((spec) => (
                <option key={spec.id} value={spec.name}>
                  {spec.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* GRID DE CARDS DOS SUBCONTRATADOS (FAROL & ATUAÇÃO UX)                */}
      {/* ------------------------------------------------------------------- */}
      {isLoadingSubcontracts ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <p className="text-sm text-slate-400">Carregando subcontratos e avaliando Farol...</p>
        </div>
      ) : filteredSubcontracts.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Nenhum subcontrato encontrado</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              {searchTerm || riskFilter !== 'ALL' || specialtyFilter !== 'ALL'
                ? 'Nenhum parceiro corresponde aos critérios de busca selecionados.'
                : 'Cadastre os parceiros e subempreiteiros desta obra para gerenciar desembolsos e medições sob o Modelo Farol.'}
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsNewSubcontractModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all shadow-md shadow-amber-400/20"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Primeiro Subcontrato
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredSubcontracts.map((sub) => {
            const farol = getFarolMeta(sub.risk_status);
            const partner = sub.suppliers;
            const partnerName = partner?.trade_name || partner?.name || 'Fornecedor Terceirizado';
            const vContrato = Number(sub.total_value) || 0;
            const vPago = Number(sub.total_paid) || 0;
            const vMedido = Number(sub.total_measured) || 0;
            const saldoResidual = Number(sub.balance_remaining) || 0;
            const exposicao = Number(sub.financial_exposure) || 0;

            const percMedido = vContrato > 0 ? Math.min(100, (vMedido / vContrato) * 100) : 0;
            const percPago = vContrato > 0 ? Math.min(100, (vPago / vContrato) * 100) : 0;

            return (
              <div
                key={sub.id}
                className={`rounded-3xl border ${farol.borderClass} ${farol.bgGlow} ${farol.shadowClass} p-5 sm:p-6 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group`}
              >
                {/* Cabeçalho do Card */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-black text-white truncate group-hover:text-amber-300 transition-colors">
                          {partnerName}
                        </h3>
                        {partner?.tax_regime && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {partner.tax_regime.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono">
                        {partner?.document && <span>{partner.document}</span>}
                        {sub.contract_number && (
                          <>
                            <span>•</span>
                            <span className="text-slate-300 font-semibold">
                              Contrato: {sub.contract_number}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Badge do Farol */}
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shrink-0 border ${farol.badgeClass}`}
                      title={farol.description}
                    >
                      <span className={`w-2 h-2 rounded-full ${farol.dotClass}`} />
                      <span>{farol.title}</span>
                    </div>
                  </div>

                  {/* Escopo do Serviço */}
                  <div className="mt-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs text-slate-300">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>Escopo Contratado</span>
                      <span className="text-[10px] font-mono text-slate-500">
                        Retenção Técnica: {Number(sub.technical_retention_percentage || 5).toFixed(1)}%
                      </span>
                    </div>
                    <p className="line-clamp-2 leading-relaxed">
                      {sub.scope_description || 'Serviços especializados de canteiro.'}
                    </p>
                  </div>

                  {/* Campos de Atuação (Especialidades Badges) - Requisito Obrigatório 2 */}
                  <div className="mt-3.5">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                      <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-400" />
                        Campos de Atuação (Especialidades):
                      </span>
                      {partner && (
                        <button
                          type="button"
                          onClick={() => {
                            setSpecialtiesTargetSupplier(partner);
                            setIsSpecialtiesModalOpen(true);
                          }}
                          className="text-[11px] text-amber-400 hover:text-amber-300 font-medium hover:underline inline-flex items-center gap-0.5"
                        >
                          + Editar Atuação
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {sub.specialties && sub.specialties.length > 0 ? (
                        sub.specialties.map((spec, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm"
                          >
                            {spec}
                          </span>
                        ))
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (partner) {
                              setSpecialtiesTargetSupplier(partner);
                              setIsSpecialtiesModalOpen(true);
                            }
                          }}
                          className="text-xs text-slate-400 hover:text-amber-300 border border-dashed border-slate-700 hover:border-amber-400/50 rounded-lg px-2.5 py-1 transition-colors"
                        >
                          + Definir Especialidade de Atuação
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Barra de Progresso Físico vs Financeiro */}
                  <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        Medido: <strong>{percMedido.toFixed(1)}%</strong>
                      </span>
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            percPago > percMedido ? 'bg-amber-400' : 'bg-slate-400'
                          }`}
                        />
                        Pago: <strong>{percPago.toFixed(1)}%</strong>
                      </span>
                    </div>

                    <div className="w-full bg-slate-950/80 h-2.5 rounded-full overflow-hidden flex border border-slate-800">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-500 rounded-l-full"
                        style={{ width: `${percMedido}%` }}
                        title={`Medição aprovada: ${percMedido.toFixed(1)}%`}
                      />
                      {percPago > percMedido && (
                        <div
                          className="bg-amber-500 h-full transition-all duration-500"
                          style={{ width: `${Math.min(100 - percMedido, percPago - percMedido)}%` }}
                          title={`Exposição / Adiantamento: ${(percPago - percMedido).toFixed(1)}%`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Grade de Métricas Físico-Financeiras */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-center">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                        Contrato Global
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-white font-mono">
                        {formatCurrency(vContrato)}
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-center">
                      <span className="text-[10px] text-emerald-400 uppercase tracking-wider block">
                        Total Medido
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-emerald-300 font-mono">
                        {formatCurrency(vMedido)}
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-center">
                      <span className="text-[10px] text-amber-400 uppercase tracking-wider block">
                        Total Pago
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-amber-300 font-mono">
                        {formatCurrency(vPago)}
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-center">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                        Saldo a Medir
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-300 font-mono">
                        {formatCurrency(saldoResidual)}
                      </span>
                    </div>
                  </div>

                  {/* Alerta de Exposição / Diagnóstico do Farol */}
                  {exposicao > 0 && (
                    <div
                      className={`mt-3 p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                        sub.risk_status === 'RED'
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                      }`}
                    >
                      <AlertTriangle
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          sub.risk_status === 'RED' ? 'text-rose-400' : 'text-amber-400'
                        }`}
                      />
                      <div className="space-y-0.5">
                        <div className="font-bold flex items-center justify-between">
                          <span>Exposição Financeira (Adiantamento):</span>
                          <span className="font-mono">{formatCurrency(exposicao)}</span>
                        </div>
                        <p className="text-[11px] opacity-90 leading-relaxed">
                          {sub.risk_description}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ------------------------------------------------------------- */}
                {/* BOTÕES DE AÇÃO RÁPIDA (REQUISITOS OBRIGATÓRIOS 3 E 4)        */}
                {/* ------------------------------------------------------------- */}
                <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center gap-2 flex-wrap">
                  {/* Botão Ação Rápida: Lançar Pagamento (Zero Travas) */}
                  <button
                    type="button"
                    onClick={() => setPaymentSubcontract(sub)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 shadow-md shadow-emerald-500/20 transition-all"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Lançar Pagamento
                  </button>

                  {/* Botão Ação Rápida: Registrar Medição (Abater Saldo) */}
                  <button
                    type="button"
                    onClick={() => setMeasurementSubcontract(sub)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
                  >
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    Registrar Medição
                  </button>

                  {/* Botão Extrato Conta Corrente */}
                  <button
                    type="button"
                    onClick={() => setStatementSubcontract(sub)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800 transition-all inline-flex items-center gap-1"
                    title="Ver Extrato da Conta Corrente"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    Extrato
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: LANÇAR PAGAMENTO (ZERO TRAVAS - REQUISITO 3)                 */}
      {/* ===================================================================== */}
      {paymentSubcontract && (
        <PaymentModal
          subcontract={paymentSubcontract}
          onClose={() => setPaymentSubcontract(null)}
          onSuccess={(result) => {
            queryClient.invalidateQueries({ queryKey: ['subcontracts', projectId] });
            setPaymentSubcontract(null);
            setFeedbackBanner({
              type: result.risk_warning ? 'warning' : 'success',
              message: result.message || 'Pagamento lançado na conta corrente com sucesso!',
              warning: result.risk_warning,
            });
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: REGISTRAR MEDIÇÃO (ABATER SALDO - REQUISITO 4)               */}
      {/* ===================================================================== */}
      {measurementSubcontract && (
        <MeasurementModal
          subcontract={measurementSubcontract}
          onClose={() => setMeasurementSubcontract(null)}
          onSuccess={(result) => {
            queryClient.invalidateQueries({ queryKey: ['subcontracts', projectId] });
            setMeasurementSubcontract(null);
            setFeedbackBanner({
              type: 'success',
              message:
                'Medição física registrada com sucesso! A exposição financeira foi abatida e o Farol foi atualizado.',
            });
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: GESTÃO DE ESPECIALIDADES E ATUAÇÃO (REQUISITO 5)             */}
      {/* ===================================================================== */}
      {isSpecialtiesModalOpen && (
        <SpecialtiesModal
          initialSupplier={specialtiesTargetSupplier}
          allSuppliers={suppliers}
          allSpecialties={allSpecialties}
          onClose={() => {
            setIsSpecialtiesModalOpen(false);
            setSpecialtiesTargetSupplier(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['specialties'] });
            queryClient.invalidateQueries({ queryKey: ['subcontracts', projectId] });
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            setFeedbackBanner({
              type: 'success',
              message: 'Campos de atuação e especialidades atualizados com sucesso!',
            });
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: EXTRATO COMPLETO DA CONTA CORRENTE                          */}
      {/* ===================================================================== */}
      {statementSubcontract && (
        <StatementModal
          subcontract={statementSubcontract}
          onClose={() => setStatementSubcontract(null)}
          onLaunchPayment={() => {
            const sub = statementSubcontract;
            setStatementSubcontract(null);
            setPaymentSubcontract(sub);
          }}
          onLaunchMeasurement={() => {
            const sub = statementSubcontract;
            setStatementSubcontract(null);
            setMeasurementSubcontract(sub);
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL 5: CADASTRAR NOVO SUBCONTRATO                                  */}
      {/* ===================================================================== */}
      {isNewSubcontractModalOpen && (
        <NewSubcontractModal
          projectId={projectId}
          suppliers={suppliers}
          allSpecialties={allSpecialties}
          onClose={() => setIsNewSubcontractModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['subcontracts', projectId] });
            setIsNewSubcontractModalOpen(false);
            setFeedbackBanner({
              type: 'success',
              message: 'Novo subcontrato registrado com sucesso no canteiro de obras!',
            });
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTE: MODAL DE LANÇAMENTO DE PAGAMENTO (ZERO TRAVAS)
// =============================================================================
function PaymentModal({
  subcontract,
  onClose,
  onSuccess,
}: {
  subcontract: SubcontractItem;
  onClose: () => void;
  onSuccess: (res: any) => void;
}) {
  const supabase = createClient();
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [observation, setObservation] = useState<string>('');
  const [createFinancialEntry, setCreateFinancialEntry] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'TRANSFER' | 'OUTRO'>('PIX');
  const [pixKey, setPixKey] = useState<string>('');
  const [successPayment, setSuccessPayment] = useState<{ amount: number; date: string; method: string } | null>(null);

  const partnerName =
    subcontract.suppliers?.trade_name || subcontract.suppliers?.name || 'Fornecedor';
  const partnerPhone = subcontract.suppliers?.phone || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Informe um valor de pagamento válido maior que zero.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');

      const obsFull = [
        `[Método: ${paymentMethod}${pixKey ? ` - Chave/Conta: ${pixKey}` : ''}]`,
        observation.trim(),
      ]
        .filter(Boolean)
        .join(' ');

      const res = await fetch(`/api/v1/subcontracts/${subcontract.id}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type: 'PAYMENT',
          amount: numAmount,
          date: paymentDate,
          due_date: dueDate,
          observation: obsFull || undefined,
          create_financial_entry: createFinancialEntry,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.detail || 'Erro ao registrar pagamento na conta corrente.');
      }

      setSuccessPayment({
        amount: numAmount,
        date: paymentDate,
        method: paymentMethod,
      });
      onSuccess(resJson);
    } catch (err: any) {
      setError(err.message || 'Falha ao processar pagamento.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenWhatsApp = () => {
    if (!successPayment) return;
    const cleanPhone = (partnerPhone || '').replace(/\D/g, '');
    const numStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(successPayment.amount);
    const dateFormatted = formatDate(successPayment.date);
    const obraNome = subcontract.projects?.name || 'Obra';

    const message = `Olá, *${partnerName}*!\n\nInformamos que foi lançado um *Adiantamento Financeiro* no valor de *${numStr}* referente aos serviços contratados na obra *${obraNome}*.\n\n📅 *Data:* ${dateFormatted}\n💳 *Forma:* ${successPayment.method}${pixKey ? ` (${pixKey})` : ''}\n${observation ? `📝 *Obs:* ${observation}\n` : ''}\nO saldo da sua conta corrente na obra foi atualizado automaticamente. Em caso de dúvidas, estamos à disposição!`;

    const targetUrl = cleanPhone
      ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(targetUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0b101b] shadow-2xl overflow-hidden my-8">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Lançar Adiantamento / Pagamento</h3>
              <p className="text-xs text-slate-400">
                Parceiro: <span className="text-slate-200 font-semibold">{partnerName}</span>
                {partnerPhone && <span className="text-emerald-400 ml-1.5 font-mono">({partnerPhone})</span>}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal de Sucesso com Ação WhatsApp */}
        {successPayment ? (
          <div className="p-6 space-y-5 text-center animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-bold text-white">Adiantamento Lançado com Sucesso!</h4>
              <p className="text-xs text-slate-400">
                O valor de <span className="font-mono font-bold text-emerald-400">{formatCurrency(successPayment.amount)}</span> foi registrado na conta corrente de <span className="text-white font-medium">{partnerName}</span>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-left text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Método:</span>
                <span className="font-semibold text-white">{successPayment.method}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Data Desembolso:</span>
                <span className="font-mono text-white">{formatDate(successPayment.date)}</span>
              </div>
              {pixKey && (
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Chave / Identificação:</span>
                  <span className="font-mono text-emerald-300">{pixKey}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md shadow-emerald-600/30"
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                Enviar Comprovante via WhatsApp
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          /* Formulário */
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Destaque da Política Zero Travas */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/30 to-teal-950/20 border border-emerald-500/30 text-xs text-slate-300 space-y-1">
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Política Zero Travas (Adiantamento & Agilidade)
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Adiantamentos podem ser liberados sem nenhuma medição física prévia. A conta corrente
                registra a exposição com farol recalculado em tempo real e permite notificação instantânea via WhatsApp.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Valor do Pagamento / Adiantamento (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    autoFocus
                    placeholder="0,00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Data do Desembolso *
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Forma de Pagamento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Forma de Pagamento
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('PIX')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      paymentMethod === 'PIX'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Pix
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('TRANSFER')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      paymentMethod === 'TRANSFER'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Transferência
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('OUTRO')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      paymentMethod === 'OUTRO'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Outro
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {paymentMethod === 'PIX' ? 'Chave Pix (Opcional)' : 'Identificador / Conta'}
                </label>
                <input
                  type="text"
                  placeholder={paymentMethod === 'PIX' ? 'Ex: CNPJ, celular, email...' : 'Ex: Banco Itaú Ag 1234 C/C 5678-9'}
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Observação / Justificativa do Desembolso
              </label>
              <textarea
                rows={2}
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Ex: Adiantamento financeiro para mobilização inicial da equipe de elétrica..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
              />
            </div>

            {/* Toggle Contas a Pagar */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-200 block">
                  Integrar ao Contas a Pagar
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Cria título financeiro da despesa automaticamente em `financial_entries`.
                </span>
              </div>
              <input
                type="checkbox"
                id="finEntryCheckbox"
                checked={createFinancialEntry}
                onChange={(e) => setCreateFinancialEntry(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
              />
            </div>

            {/* Botões do Rodapé */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800/80 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirmar Desembolso
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTE: MODAL DE REGISTRO DE MEDIÇÃO (ABATER SALDO)
// =============================================================================
function MeasurementModal({
  subcontract,
  onClose,
  onSuccess,
}: {
  subcontract: SubcontractItem;
  onClose: () => void;
  onSuccess: (res: any) => void;
}) {
  const supabase = createClient();
  const [amount, setAmount] = useState<string>('');
  const [measurementDate, setMeasurementDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [observation, setObservation] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const partnerName =
    subcontract.suppliers?.trade_name || subcontract.suppliers?.name || 'Fornecedor';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Informe um valor medido válido maior que zero.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');

      const res = await fetch(`/api/v1/subcontracts/${subcontract.id}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type: 'MEASUREMENT',
          amount: numAmount,
          date: measurementDate,
          observation: observation.trim() || undefined,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.detail || 'Erro ao registrar medição na conta corrente.');
      }

      onSuccess(resJson);
    } catch (err: any) {
      setError(err.message || 'Falha ao registrar medição.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0b101b] shadow-2xl overflow-hidden my-8">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Registrar Medição de Campo</h3>
              <p className="text-xs text-slate-400">
                Parceiro: <span className="text-slate-200 font-semibold">{partnerName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Explicação de abatimento */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/30 to-slate-950/40 border border-cyan-500/30 text-xs text-slate-300 space-y-1">
            <div className="font-bold text-cyan-400 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" />
              Abatimento do Saldo Devedor Físico
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Registrar o avanço físico do serviço cobre os desembolsos realizados na conta corrente,
              reduz a <em>exposição financeira</em> e devolve o parceiro para o <strong>Farol Verde</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Valor Medido (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Data da Medição *
              </label>
              <input
                type="date"
                required
                value={measurementDate}
                onChange={(e) => setMeasurementDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Observação / Descrição da Etapa Medida
            </label>
            <textarea
              rows={2}
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Ex: Conclusão de 100% da fiação do 3º pavimento, aprovação pelo engenheiro fiscal..."
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:border-cyan-500 placeholder:text-slate-600"
            />
          </div>

          {/* Botões do Rodapé */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800/80 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Registrar Medição
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTE: MODAL DE GESTÃO DE ESPECIALIDADES (REQUISITO 5)
// =============================================================================
function SpecialtiesModal({
  initialSupplier,
  allSuppliers,
  allSpecialties,
  onClose,
  onSuccess,
}: {
  initialSupplier: SupplierItem | null;
  allSuppliers: SupplierItem[];
  allSpecialties: SpecialtyItem[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const supabase = createClient();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    initialSupplier?.id || (allSuppliers[0]?.id ?? '')
  );
  const [selectedSpecialtyIds, setSelectedSpecialtyIds] = useState<string[]>([]);
  const [newSpecialtyName, setNewSpecialtyName] = useState('');
  const [newSpecialtyDesc, setNewSpecialtyDesc] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingSpec, setIsSavingSpec] = useState(false);
  const [activeTab, setActiveTab] = useState<'link' | 'create'>('link');
  const [error, setError] = useState<string | null>(null);

  // Carrega as especialidades atuais do fornecedor selecionado
  React.useEffect(() => {
    if (!selectedSupplierId) return;

    let isMounted = true;
    async function loadCurrentSpecialties() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch(`/api/v1/subcontracts/suppliers/${selectedSupplierId}/specialties`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (isMounted) {
            setSelectedSpecialtyIds(json.map((s: SpecialtyItem) => s.id));
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar especialidades do fornecedor:', err);
      }
    }

    loadCurrentSpecialties();
    return () => {
      isMounted = false;
    };
  }, [selectedSupplierId, supabase]);

  const toggleSpecialty = (specId: string) => {
    setSelectedSpecialtyIds((prev) =>
      prev.includes(specId) ? prev.filter((id) => id !== specId) : [...prev, specId]
    );
  };

  // Salva vínculos
  const handleSaveLinks = async () => {
    if (!selectedSupplierId) {
      setError('Selecione um fornecedor.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada.');

      const res = await fetch(`/api/v1/subcontracts/suppliers/${selectedSupplierId}/specialties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ specialty_ids: selectedSpecialtyIds }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Erro ao vincular especialidades.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar vínculos.');
    } finally {
      setIsLoading(false);
    }
  };

  // Cadastra nova especialidade
  const handleCreateSpecialty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpecialtyName.trim()) {
      setError('Informe o nome da especialidade.');
      return;
    }

    setIsSavingSpec(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada.');

      const res = await fetch('/api/v1/subcontracts/specialties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: newSpecialtyName.trim(),
          description: newSpecialtyDesc.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Erro ao criar especialidade técnica.');
      }

      const created = await res.json();
      setNewSpecialtyName('');
      setNewSpecialtyDesc('');
      setSelectedSpecialtyIds((prev) => [...prev, created.id]);
      setActiveTab('link');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Falha ao cadastrar especialidade.');
    } finally {
      setIsSavingSpec(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="glass-panel w-full max-w-xl rounded-2xl border border-slate-800 bg-[#0b101b] shadow-2xl overflow-hidden my-8">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Campos de Atuação & Especialidades</h3>
              <p className="text-xs text-slate-400">
                Vincule especialidades técnicas aos subempreiteiros para exibição no Farol.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6">
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'link'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Vincular Atuação ao Parceiro
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'create'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            + Cadastrar Nova Especialidade
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'link' ? (
            <div className="space-y-4">
              {/* Seleção do Fornecedor */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Selecione o Fornecedor / Subempreiteiro *
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                >
                  {allSuppliers.map((supp) => (
                    <option key={supp.id} value={supp.id}>
                      {supp.trade_name || supp.name} {supp.document ? `(${supp.document})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lista de Especialidades para Selecionar */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Campos de Atuação (Selecione todos que se aplicam)
                </label>
                {allSpecialties.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    Nenhuma especialidade cadastrada. Clique na aba "+ Cadastrar Nova Especialidade".
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allSpecialties.map((spec) => {
                      const isSelected = selectedSpecialtyIds.includes(spec.id);
                      return (
                        <button
                          key={spec.id}
                          type="button"
                          onClick={() => toggleSpecialty(spec.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                            isSelected
                              ? 'bg-amber-400 text-slate-950 font-bold shadow-sm shadow-amber-400/30 scale-105'
                              : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          {spec.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  {selectedSpecialtyIds.length} especialidade(s) selecionada(s)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800/80 transition-colors"
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveLinks}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all shadow-md shadow-amber-400/20 disabled:opacity-50"
                  >
                    {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Salvar Vínculos de Atuação
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateSpecialty} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome da Especialidade Técnica *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Climatização & HVAC, Drywall, Impermeabilização..."
                  value={newSpecialtyName}
                  onChange={(e) => setNewSpecialtyName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Descrição (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalhamento das atividades e escopo desta especialidade..."
                  value={newSpecialtyDesc}
                  onChange={(e) => setNewSpecialtyDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('link')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800/80 transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={isSavingSpec}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all shadow-md shadow-amber-400/20 disabled:opacity-50"
                >
                  {isSavingSpec && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Cadastrar Especialidade
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTE: MODAL DE EXTRATO DA CONTA CORRENTE
// =============================================================================
function StatementModal({
  subcontract,
  onClose,
  onLaunchPayment,
  onLaunchMeasurement,
}: {
  subcontract: SubcontractItem;
  onClose: () => void;
  onLaunchPayment: () => void;
  onLaunchMeasurement: () => void;
}) {
  const supabase = createClient();
  const partnerName =
    subcontract.suppliers?.trade_name || subcontract.suppliers?.name || 'Fornecedor';

  const { data: transactions = [], isLoading } = useQuery<SubcontractTransaction[]>({
    queryKey: ['subcontract-statement', subcontract.id],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return [];

      const res = await fetch(`/api/v1/subcontracts/${subcontract.id}/transactions`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return [];
      return await res.json();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#0b101b] shadow-2xl overflow-hidden my-8">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Extrato da Conta Corrente</h3>
              <p className="text-xs text-slate-400">
                Parceiro: <span className="text-slate-200 font-semibold">{partnerName}</span> • Contrato:{' '}
                {subcontract.contract_number || 'S/N'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resumo do Extrato */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                Total Pago (Desembolsos)
              </span>
              <span className="text-sm font-bold text-amber-400 font-mono">
                {formatCurrency(subcontract.total_paid)}
              </span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                Total Medido (Físico)
              </span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                {formatCurrency(subcontract.total_measured)}
              </span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                Exposição Atual
              </span>
              <span
                className={`text-sm font-bold font-mono ${
                  subcontract.financial_exposure > 0 ? 'text-rose-400' : 'text-slate-300'
                }`}
              >
                {formatCurrency(subcontract.financial_exposure)}
              </span>
            </div>
          </div>

          {/* Tabela de Lançamentos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Movimentações Cronológicas</span>
              <span>{transactions.length} lançamento(s)</span>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                Carregando movimentações...
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
                Nenhum lançamento registrado nesta conta corrente ainda.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {transactions.map((tx) => {
                  const isPayment = tx.type === 'PAYMENT';
                  return (
                    <div
                      key={tx.id}
                      className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isPayment
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {isPayment ? (
                            <CreditCard className="w-3.5 h-3.5" />
                          ) : (
                            <Layers className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span>{isPayment ? 'Desembolso / Pagamento' : 'Medição Física'}</span>
                            <span className="text-[10px] text-slate-400 font-mono font-normal">
                              {formatDate(tx.date)}
                            </span>
                          </div>
                          {tx.observation && (
                            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                              {tx.observation}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`font-mono font-bold text-xs sm:text-sm ${
                            isPayment ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          {isPayment ? '-' : '+'} {formatCurrency(tx.amount)}
                        </span>
                        {tx.financial_entry_id && (
                          <span className="block text-[10px] text-slate-500 font-mono">
                            Despesa lançada
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ações Rápidas no Extrato */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800/80 transition-colors"
            >
              Fechar
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onLaunchPayment}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all shadow-sm"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Lançar Pagamento
              </button>
              <button
                type="button"
                onClick={onLaunchMeasurement}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Registrar Medição
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTE: MODAL DE CADASTRO DE NOVO SUBCONTRATO
// =============================================================================
function NewSubcontractModal({
  projectId,
  suppliers,
  allSpecialties,
  onClose,
  onSuccess,
}: {
  projectId: string;
  suppliers: SupplierItem[];
  allSpecialties: SpecialtyItem[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const supabase = createClient();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [contractNumber, setContractNumber] = useState('');
  const [scopeDescription, setScopeDescription] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [retentionPerc, setRetentionPerc] = useState('5.0');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setError('Selecione o parceiro / subempreiteiro.');
      return;
    }
    const numValue = parseFloat(totalValue.replace(',', '.'));
    if (isNaN(numValue) || numValue <= 0) {
      setError('Informe um valor total de contrato válido.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada.');

      const res = await fetch('/api/v1/subcontracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          project_id: projectId,
          supplier_id: supplierId,
          contract_number: contractNumber.trim() || undefined,
          scope_description: scopeDescription.trim() || 'Serviços gerais de subcontrato.',
          total_value: numValue,
          technical_retention_percentage: parseFloat(retentionPerc) || 5.0,
          status: 'active',
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Falha ao registrar novo subcontrato.');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar subcontrato.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0b101b] shadow-2xl overflow-hidden my-8">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Cadastrar Novo Subcontrato</h3>
              <p className="text-xs text-slate-400">
                Vincule um parceiro terceirizado à obra e defina o teto contratual.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Fornecedor / Subempreiteiro *
            </label>
            <select
              required
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500"
            >
              {suppliers.map((supp) => (
                <option key={supp.id} value={supp.id}>
                  {supp.trade_name || supp.name} {supp.document ? `(${supp.document})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Número do Contrato (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: SUB-001/2026"
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Valor Total do Contrato (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0,00"
                value={totalValue}
                onChange={(e) => setTotalValue(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Escopo / Descrição dos Serviços *
            </label>
            <textarea
              rows={2}
              required
              placeholder="Ex: Instalação de toda a fiação elétrica, quadros de distribuição e luminárias..."
              value={scopeDescription}
              onChange={(e) => setScopeDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Retenção (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={retentionPerc}
                onChange={(e) => setRetentionPerc(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Data de Início
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Data Prevista Fim
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Rodapé */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800/80 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all shadow-md shadow-amber-400/20 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Registrar Subcontrato
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
