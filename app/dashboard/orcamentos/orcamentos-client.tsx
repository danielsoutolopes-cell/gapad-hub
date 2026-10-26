'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Calculator,
  Plus,
  Search,
  FileText,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Filter,
  Layers,
  ArrowUpRight,
  Building2,
  Calendar,
  Zap,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ContextualHelp } from '@/components/help/contextual-help';

interface QuoteItem {
  id: string;
  item_type: 'product' | 'service';
  description: string;
  quantity: number;
  unit_cost: number;
  unit_price: number;
  total_price: number;
}

interface Quote {
  id: string;
  tenant_id: string;
  client_id: string;
  project_id?: string | null;
  code?: string | null;
  title: string;
  description?: string | null;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'converted';
  calculation_type?: 'BDI' | 'MARKUP' | string;
  markup_percentage?: number | null;
  total_cost?: number;
  subtotal_cost?: number;
  bdi_multiplier: number;
  bdi_amount?: number;
  subtotal_price?: number;
  discount_amount: number;
  grand_total: number;
  valid_until?: string | null;
  created_at: string;
  clients?: {
    name: string;
    document: string;
  } | null;
  quote_items?: QuoteItem[];
}

export function OrcamentosClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const supabase = createClient();

  // Query orçamentos via backend API FastAPI ou Supabase com RLS
  const {
    data: quotes = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Quote[]>({
    queryKey: ['quotes'],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      // Tenta a API FastAPI primeiro
      try {
        const response = await fetch('/api/v1/quotes', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (response.ok) {
          return await response.json();
        }
      } catch (e) {
        console.warn('API /api/v1/quotes indisponível, buscando via Supabase Client...', e);
      }

      // Fallback robusto via Supabase Client
      const { data, error: sbError } = await supabase
        .from('quotes')
        .select(`
          id,
          tenant_id,
          client_id,
          project_id,
          code,
          title,
          description,
          status,
          calculation_type,
          markup_percentage,
          total_cost,
          bdi_multiplier,
          bdi_amount,
          discount_amount,
          grand_total,
          valid_until,
          created_at,
          clients (
            name,
            document
          )
        `)
        .order('created_at', { ascending: false });

      if (sbError) {
        throw new Error(sbError.message);
      }

      return (data || []) as unknown as Quote[];
    },
  });

  // Filtragem
  const filteredQuotes = quotes.filter((q) => {
    const matchesSearch =
      (q.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (q.code?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (q.clients?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Métricas agregadas
  const totalValue = quotes.reduce((acc, q) => acc + (Number(q.grand_total) || 0), 0);
  const avgBdi =
    quotes.length > 0
      ? quotes.reduce((acc, q) => acc + ((Number(q.bdi_multiplier) || 1) - 1) * 100, 0) /
        quotes.length
      : 0;
  const approvedQuotes = quotes.filter((q) => q.status === 'approved' || q.status === 'converted');
  const draftQuotes = quotes.filter((q) => q.status === 'draft');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            Rascunho
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <ArrowUpRight className="w-3 h-3" />
            Enviado
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Aprovado
          </span>
        );
      case 'converted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <TrendingUp className="w-3 h-3" />
            Virou Obra
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" />
            Declinado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com Título e Ação de Criar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Calculator className="w-8 h-8 text-emerald-400" />
            Orçamentos & Propostas
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Motor de orçamentos técnicos com marcação analítica de BDI oficial e contratos mistos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ContextualHelp topic="bdi_orcamentos" variant="badge" triggerText="O que é BDI?" />
          <Link
            href="/dashboard/orcamentos/novo"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Novo Orçamento
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Orçado</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-white mt-1">
            {formatCurrency(totalValue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {quotes.length} proposta(s) cadastrada(s)
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>BDI Médio</span>
            <TrendingUp className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-teal-400 mt-1">
            +{avgBdi.toFixed(2)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Taxa média de markup</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Aprovados / Convertidos</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-emerald-400 mt-1">
            {approvedQuotes.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {quotes.length > 0
              ? `${((approvedQuotes.length / quotes.length) * 100).toFixed(0)}% de conversão`
              : 'Sem dados'}
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Em Elaboração</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-amber-400 mt-1">
            {draftQuotes.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Rascunhos pendentes</div>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por código, cliente ou descrição do orçamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="all">Todos os Status</option>
            <option value="draft">Rascunho</option>
            <option value="sent">Enviado</option>
            <option value="approved">Aprovado</option>
            <option value="converted">Convertido em Obra</option>
            <option value="rejected">Declinado</option>
          </select>
        </div>
      </div>

      {/* Tabela de Listagem */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <div className="animate-spin w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full mx-auto mb-3" />
            Carregando orçamentos cadastrados...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400 text-sm flex items-center justify-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>Erro ao carregar orçamentos: {(error as Error).message}</span>
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mx-auto text-slate-400">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Nenhum orçamento encontrado</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {searchTerm || statusFilter !== 'all'
                  ? 'Nenhum resultado corresponde aos filtros aplicados.'
                  : 'Crie seu primeiro orçamento técnico com cálculo analítico de BDI.'}
              </p>
            </div>
            <div>
              <Link
                href="/dashboard/orcamentos/novo"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                Criar Novo Orçamento
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3">Código & Título</th>
                  <th className="px-5 py-3">Cliente / Tomador</th>
                  <th className="px-5 py-3 text-right">Custo Base</th>
                  <th className="px-5 py-3 text-center">BDI Aplicado</th>
                  <th className="px-5 py-3 text-right">Total Final (R$)</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                {filteredQuotes.map((quote) => {
                  const rawMult = Number(quote.bdi_multiplier) || 0;
                  const marginPerc = rawMult > 1 ? (rawMult - 1) * 100 : rawMult * 100;
                  const isMarkup = quote.calculation_type === 'MARKUP';
                  const baseCost = Number(quote.total_cost ?? quote.subtotal_cost ?? 0);

                  return (
                    <tr
                      key={quote.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                          <span>{quote.title}</span>
                          {isMarkup && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                              <Zap className="w-2.5 h-2.5" />
                              Markup
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {quote.code || 'S/N'} •{' '}
                          {new Date(quote.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-slate-200">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate max-w-[180px]">
                            {quote.clients?.name || 'Cliente Geral'}
                          </span>
                        </div>
                        {quote.clients?.document && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            {quote.clients.document}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right font-mono text-slate-400">
                        {formatCurrency(baseCost)}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        {isMarkup ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/25">
                            <Zap className="w-3 h-3 text-amber-400" />
                            +{marginPerc.toFixed(1)}% Markup
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                            +{marginPerc.toFixed(1)}% BDI
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-400 text-sm">
                        {formatCurrency(Number(quote.grand_total) || 0)}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        {getStatusBadge(quote.status)}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {quote.project_id ? (
                            <Link
                              href={`/dashboard/obras/${quote.project_id}/medicoes`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                              title="Acessar Obra e Cronograma Físico-Financeiro"
                            >
                              <TrendingUp className="w-3.5 h-3.5" />
                              Obra
                            </Link>
                          ) : (
                            quote.status === 'draft' && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Deseja aprovar e converter o orçamento "${quote.title}" em Obra com Cronograma Físico-Financeiro?`)) return;
                                  try {
                                    const { data: { session } } = await supabase.auth.getSession();
                                    if (!session) return;
                                    const res = await fetch(`/api/v1/quotes/${quote.id}/convert-to-project`, {
                                      method: 'POST',
                                      headers: { Authorization: `Bearer ${session.access_token}` },
                                    });
                                    if (res.ok) {
                                      refetch();
                                    } else {
                                      alert('Erro ao converter orçamento em obra.');
                                    }
                                  } catch (e) {
                                    console.error(e);
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 transition-colors"
                                title="Aprovar e Converter em Obra"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Aprovar
                              </button>
                            )
                          )}
                          <Link
                            href={`/dashboard/orcamentos/novo?clone_id=${quote.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 transition-colors"
                            title="Usar como modelo"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                            Ver
                          </Link>
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
    </div>
  );
}
