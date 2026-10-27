'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  Calendar,
  Building2,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Check,
  Plus,
  Loader2,
  FileText,
  Users,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface FinancialEntryItem {
  id: string;
  tenant_id: string;
  entry_type: string;
  description: string;
  category: string;
  nominal_amount: number;
  technical_retention_amount: number;
  discount_amount: number;
  interest_penalty_amount: number;
  net_amount: number;
  status: string;
  effective_status: 'atrasado' | 'vence_hoje' | 'a_vencer' | 'pago' | 'cancelado';
  due_date: string;
  payment_date?: string | null;
  document_number?: string | null;
  document_type?: string | null;
  pix_code?: string | null;
  notes?: string | null;
  created_at: string;
  project?: {
    id: string;
    name: string;
    code?: string;
  } | null;
  party?: {
    id: string;
    name: string;
    document?: string;
  } | null;
}

interface FinancialTotals {
  total_geral: number;
  total_em_aberto: number;
  total_atrasado: number;
  total_vence_hoje: number;
  total_a_vencer: number;
  total_pago: number;
  count_total: number;
  count_em_aberto: number;
  count_atrasado: number;
  count_vence_hoje: number;
  count_pago: number;
}

interface FinancialGroup {
  project_id?: string | null;
  project_name: string;
  total_nominal: number;
  total_liquido: number;
  total_em_aberto: number;
  total_pago: number;
  items_count: number;
  items: FinancialEntryItem[];
}

interface FinancialApiResponse {
  tenant_id: string;
  entry_type: string;
  date_ref: string;
  totals: FinancialTotals;
  grouped_by_project: FinancialGroup[];
  items: FinancialEntryItem[];
}

const formatCurrency = (val: number = 0) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export function ContasReceberClient() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'aberto' | 'pagos' | 'todos'>('aberto');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('todos');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modais de Ação Rápida
  const [receivingEntry, setReceivingEntry] = useState<FinancialEntryItem | null>(null);
  const [receiveDateInput, setReceiveDateInput] = useState(new Date().toISOString().slice(0, 10));
  const [receiveNotes, setReceiveNotes] = useState('');

  const [revertingEntry, setRevertingEntry] = useState<FinancialEntryItem | null>(null);
  const [isModalCreateOpen, setIsModalCreateOpen] = useState(false);

  // Form de criação manual rápida de Conta a Receber
  const [newDesc, setNewDesc] = useState('');
  const [newNominal, setNewNominal] = useState('');
  const [newRetention, setNewRetention] = useState('0');
  const [newDueDate, setNewDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [newCategory, setNewCategory] = useState('medicao_obra');
  const [newDocNumber, setNewDocNumber] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newClientName, setNewClientName] = useState('');

  // 1. Query: Listar Contas a Receber
  const { data, isLoading, isError, refetch } = useQuery<FinancialApiResponse>({
    queryKey: ['financial-receivables', activeTab, selectedProject, startDate, endDate],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const tenantId = session?.user?.app_metadata?.tenant_id || session?.user?.user_metadata?.tenant_id || '';

      const params = new URLSearchParams();
      if (activeTab === 'aberto') params.append('status', 'aberto');
      else if (activeTab === 'pagos') params.append('status', 'pago');

      if (selectedProject !== 'todos') params.append('project_id', selectedProject);
      if (startDate) params.append('due_date_start', startDate);
      if (endDate) params.append('due_date_end', endDate);

      const res = await fetch(`/api/v1/finance/receivables?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': tenantId,
        },
      });

      if (!res.ok) {
        throw new Error('Falha ao carregar Contas a Receber');
      }
      return res.json();
    },
  });

  // 2. Mutação: Registrar Recebimento (Baixa)
  const receiveMutation = useMutation({
    mutationFn: async ({ entryId, date, notes }: { entryId: string; date: string; notes?: string }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const tenantId = session?.user?.app_metadata?.tenant_id || session?.user?.user_metadata?.tenant_id || '';

      const res = await fetch(`/api/v1/finance/entries/${entryId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          status: 'pago',
          payment_date: date,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Erro ao registrar recebimento.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-receivables'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-executive'] });
      setReceivingEntry(null);
      setReceiveNotes('');
    },
  });

  // 3. Mutação: Estornar Recebimento
  const revertMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const tenantId = session?.user?.app_metadata?.tenant_id || session?.user?.user_metadata?.tenant_id || '';

      const res = await fetch(`/api/v1/finance/entries/${entryId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          status: 'pendente',
          notes: 'Recebimento estornado pelo operador financeiro.',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Erro ao estornar recebimento.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-receivables'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-executive'] });
      setRevertingEntry(null);
    },
  });

  // 4. Mutação: Criar Conta a Receber Rápida
  const createReceivableMutation = useMutation({
    mutationFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const tenantId = session?.user?.app_metadata?.tenant_id || session?.user?.user_metadata?.tenant_id;
      if (!tenantId) throw new Error('Tenant não identificado.');

      const val = parseFloat(newNominal.replace(',', '.'));
      if (isNaN(val) || val <= 0) throw new Error('Informe um valor válido maior que zero.');
      if (!newDesc.trim()) throw new Error('Informe a descrição do faturamento.');

      const ret = parseFloat(newRetention.replace(',', '.')) || 0;
      const net = Math.max(0, val - ret);

      const { data, error } = await supabase.from('financial_entries').insert({
        tenant_id: tenantId,
        entry_type: 'receivable',
        description: newDesc,
        category: newCategory,
        nominal_amount: val,
        technical_retention_amount: ret,
        net_amount: net,
        due_date: newDueDate,
        status: 'pendente',
        document_number: newDocNumber || null,
        project_id: newProjectId || null,
        notes: newClientName ? `Cliente informado: ${newClientName}` : null,
      }).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-receivables'] });
      setIsModalCreateOpen(false);
      setNewDesc('');
      setNewNominal('');
      setNewRetention('0');
      setNewDocNumber('');
      setNewClientName('');
    },
  });

  // Filtros em memória para busca rápida
  const filteredItems = (data?.items || []).filter((item) => {
    const matchSearch =
      searchTerm === '' ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.document_number && item.document_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.party?.name && item.party.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.project?.name && item.project.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchCategory =
      selectedCategory === 'todas' || item.category === selectedCategory;

    return matchSearch && matchCategory;
  });

  const totals = data?.totals || {
    total_geral: 0,
    total_em_aberto: 0,
    total_atrasado: 0,
    total_vence_hoje: 0,
    total_a_vencer: 0,
    total_pago: 0,
    count_total: 0,
    count_em_aberto: 0,
    count_atrasado: 0,
    count_vence_hoje: 0,
    count_pago: 0,
  };

  const availableProjects = data?.grouped_by_project || [];

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------------- */}
      {/* CABEÇALHO DA PÁGINA */}
      {/* ---------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ArrowUpRight className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Contas a Receber
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  Entradas & Faturamento
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Visão consolidada de medições de clientes, faturas emitidas, adiantamentos contratuais e retenções técnicas a liberar.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/financeiro/pagar"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all"
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>Ir para Contas a Pagar</span>
          </Link>
          <button
            type="button"
            onClick={() => setIsModalCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 transition-all shadow-md shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Faturamento / Recebível</span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* CARDS COM TOTALIZADORES EXECUTIVOS */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Atrasado (Vermelho) */}
        <div className="bg-slate-900/60 backdrop-blur-sm border border-rose-500/30 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
              Em Atraso (Inadimplência)
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-rose-300 font-mono tracking-tight">
              {formatCurrency(totals.total_atrasado)}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              {totals.count_atrasado} {totals.count_atrasado === 1 ? 'cliente com título vencido' : 'títulos em atraso'}
            </span>
          </div>
        </div>

        {/* Total Vence Hoje (Amarelo) */}
        <div className="bg-slate-900/60 backdrop-blur-sm border border-amber-500/30 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Vence Hoje
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-amber-300 font-mono tracking-tight">
              {formatCurrency(totals.total_vence_hoje)}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              {totals.count_vence_hoje} {totals.count_vence_hoje === 1 ? 'recebimento hoje' : 'recebimentos hoje'}
            </span>
          </div>
        </div>

        {/* Total Em Aberto / A Receber (Azul / Slate) */}
        <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Total a Receber
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-white font-mono tracking-tight">
              {formatCurrency(totals.total_em_aberto)}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              {totals.count_em_aberto} faturas em aberto
            </span>
          </div>
        </div>

        {/* Total Recebido / Liquidado (Verde) */}
        <div className="bg-slate-900/60 backdrop-blur-sm border border-emerald-500/30 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Total Recebido
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-emerald-300 font-mono tracking-tight">
              {formatCurrency(totals.total_pago)}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              {totals.count_pago} faturas quitadas
            </span>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* TABS DE STATUS & BARRA DE FILTROS */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('aberto')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'aberto'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Em Aberto ({totals.count_em_aberto})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pagos')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'pagos'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Recebidos ({totals.count_pago})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('todos')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'todos'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>Todos ({totals.count_total})</span>
            </button>
          </div>

          {/* Filtro por Obra */}
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="todos">Todas as Obras Contratadas</option>
              {availableProjects.map((p) => (
                <option key={p.project_id || 'corp'} value={p.project_id || ''}>
                  {p.project_name} ({p.items_count})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Barra de Pesquisa e Datas */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por cliente, descrição, nº da NFS-e ou fatura..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="todas">Todas as Categorias</option>
              <option value="medicao_obra">Medição de Obra</option>
              <option value="contrato">Contrato / Sinal</option>
              <option value="servicos">Serviços Técnicos</option>
              <option value="geral">Geral / Outros</option>
            </select>
          </div>

          <div className="sm:col-span-3 flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Início"
              className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            />
            <span className="text-slate-600 text-xs">até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="Fim"
              className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* TABELA DE RECEBÍVEIS */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
            <p className="text-xs text-slate-400">Carregando recebíveis consolidados de obras...</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-rose-400 text-xs space-y-2">
            <AlertCircle className="w-6 h-6 mx-auto" />
            <p>Ocorreu um erro ao carregar o Contas a Receber.</p>
            <button
              onClick={() => refetch()}
              className="px-3 py-1 bg-rose-500/20 rounded-lg text-rose-300 hover:bg-rose-500/30"
            >
              Tentar novamente
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <FileText className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">Nenhum recebível encontrado</p>
            <p className="text-xs text-slate-500">
              Não há títulos de Contas a Receber para os filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4">Cliente Contratante</th>
                  <th className="py-3 px-4">Descrição & Obra</th>
                  <th className="py-3 px-4">Doc / Tipo</th>
                  <th className="py-3 px-4 text-right">Líquido a Receber</th>
                  <th className="py-3 px-4 text-center">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                {filteredItems.map((item) => {
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-850/60 transition-colors group"
                    >
                      {/* Badge de Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.effective_status === 'atrasado' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                            Atrasado
                          </span>
                        )}
                        {item.effective_status === 'vence_hoje' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Vence Hoje
                          </span>
                        )}
                        {item.effective_status === 'a_vencer' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            A Vencer
                          </span>
                        )}
                        {item.effective_status === 'pago' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <Check className="w-3 h-3 text-emerald-400" />
                            Recebido
                          </span>
                        )}
                        {item.effective_status === 'cancelado' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400">
                            Cancelado
                          </span>
                        )}
                      </td>

                      {/* Vencimento */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs">
                        <span
                          className={
                            item.effective_status === 'atrasado'
                              ? 'text-rose-400 font-bold'
                              : item.effective_status === 'vence_hoje'
                              ? 'text-amber-300 font-bold'
                              : 'text-slate-300'
                          }
                        >
                          {formatDate(item.due_date)}
                        </span>
                        {item.payment_date && (
                          <span className="block text-[10px] text-emerald-400/80">
                            Recebido em: {formatDate(item.payment_date)}
                          </span>
                        )}
                      </td>

                      {/* Cliente */}
                      <td className="py-3 px-4 max-w-[200px]">
                        <div className="font-semibold text-white truncate" title={item.party?.name || 'Cliente'}>
                          {item.party?.name || 'Cliente Direto'}
                        </div>
                        {item.party?.document && (
                          <span className="text-[10px] text-slate-500 font-mono block">
                            {item.party.document}
                          </span>
                        )}
                      </td>

                      {/* Descrição & Obra */}
                      <td className="py-3 px-4 max-w-[260px]">
                        <div className="text-slate-200 line-clamp-1 font-medium" title={item.description}>
                          {item.description}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {item.project ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              <Building2 className="w-2.5 h-2.5" />
                              {item.project.name}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">Corporativo / Geral</span>
                          )}
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                            • {item.category.replace('_', ' ')}
                          </span>
                        </div>
                      </td>

                      {/* Documento / Tipo */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-xs text-slate-300 block">
                          {item.document_number || 'S/N'}
                        </span>
                        <span className="text-[10px] uppercase text-slate-500">
                          {item.document_type || 'Boleto / Pix'}
                        </span>
                      </td>

                      {/* Valor Líquido */}
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <div className="font-black text-emerald-400 font-mono text-sm">
                          {formatCurrency(item.net_amount)}
                        </div>
                        {item.technical_retention_amount > 0 && (
                          <span className="text-[10px] text-amber-400/80 block">
                            Ret. Téc: {formatCurrency(item.technical_retention_amount)}
                          </span>
                        )}
                      </td>

                      {/* Ações Rápidas */}
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {item.effective_status !== 'pago' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setReceivingEntry(item);
                                setReceiveDateInput(new Date().toISOString().slice(0, 10));
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all shadow-sm shadow-emerald-500/20"
                              title="Confirmar recebimento / liquidação bancária"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Registrar Recebimento</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setRevertingEntry(item)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 border border-slate-800 hover:border-amber-500/30 transition-all"
                              title="Estornar recebimento para Em Aberto"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Estornar</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 1: REGISTRAR RECEBIMENTO (BAIXA RÁPIDA) */}
      {/* ---------------------------------------------------------------------- */}
      {receivingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0b101b] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
                <CheckCircle2 className="w-5 h-5" />
                Registrar Recebimento do Cliente
              </div>
              <button
                onClick={() => setReceivingEntry(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 block">Faturamento / Medição:</span>
              <p className="text-xs font-semibold text-white">{receivingEntry.description}</p>
              <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-800/80">
                <span className="text-xs text-slate-400">Valor Líquido Recebido:</span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  {formatCurrency(receivingEntry.net_amount)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Data do Crédito em Conta *
                </label>
                <input
                  type="date"
                  value={receiveDateInput}
                  onChange={(e) => setReceiveDateInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Comprovante / Observações do Recebimento
                </label>
                <input
                  type="text"
                  placeholder="Ex: Recebido via Pix Dr. Carlos - Doc 78912"
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setReceivingEntry(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={receiveMutation.isPending}
                onClick={() =>
                  receiveMutation.mutate({
                    entryId: receivingEntry.id,
                    date: receiveDateInput,
                    notes: receiveNotes,
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                {receiveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirmar Recebimento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 2: CONFIRMAÇÃO DE ESTORNO */}
      {/* ---------------------------------------------------------------------- */}
      {revertingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0b101b] border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Estornar Recebimento?</h3>
              <p className="text-xs text-slate-400">
                O título voltará para o status <strong>Em Aberto / A Receber</strong> e constará como pendente no fluxo financeiro da obra.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRevertingEntry(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={revertMutation.isPending}
                onClick={() => revertMutation.mutate(revertingEntry.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all disabled:opacity-50"
              >
                {revertMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Sim, Estornar Recebimento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 3: NOVO FATURAMENTO A RECEBER (CADASTRO RÁPIDO) */}
      {/* ---------------------------------------------------------------------- */}
      {isModalCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-[#0b101b] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
                <Plus className="w-5 h-5" />
                Lançar Novo Título a Receber
              </div>
              <button
                onClick={() => setIsModalCreateOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createReceivableMutation.mutate();
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Descrição do Faturamento / Medição *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Faturamento Parcela 01 - Execução de Estrutura..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Valor Bruto / Nominal (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0,00"
                    value={newNominal}
                    onChange={(e) => setNewNominal(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Retenção Técnica (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={newRetention}
                    onChange={(e) => setNewRetention(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Data de Vencimento *
                  </label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nº Documento / NFS-e / Fatura
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: FAT-OBRA-001"
                    value={newDocNumber}
                    onChange={(e) => setNewDocNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Obra Vinculada (Opcional)
                </label>
                <select
                  value={newProjectId}
                  onChange={(e) => setNewProjectId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Receita Corporativa / Sem Obra Vinculada</option>
                  {availableProjects.filter(p => p.project_id).map((p) => (
                    <option key={p.project_id} value={p.project_id || ''}>
                      {p.project_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome do Cliente / Pagador
                </label>
                <input
                  type="text"
                  placeholder="Ex: Residencial Alphaville Empreendimentos"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {createReceivableMutation.isError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {(createReceivableMutation.error as any)?.message || 'Erro ao registrar conta a receber'}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createReceivableMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  {createReceivableMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Salvar Conta a Receber
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
