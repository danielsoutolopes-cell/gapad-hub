'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  DollarSign,
  Download,
  Filter,
  Search,
  Loader2,
  Check,
  FileCheck2,
  WalletCards,
  ArrowDownRight,
  ExternalLink,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface InboundInvoiceItem {
  id: string;
  tenant_id: string;
  access_key: string;
  issuer_cnpj: string;
  issuer_name?: string;
  issuer_trade_name?: string;
  total_amount: number;
  manifestation_status: string;
  manifestation_date?: string | null;
  manifestation_protocol?: string | null;
  financial_entry_id?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  issue_date?: string | null;
  operation_type?: string;
  created_at: string;
}

interface InboundInvoicesResponse {
  items: InboundInvoiceItem[];
  total_count: number;
  total_amount_sum: number;
  not_manifested_count: number;
  confirmed_count: number;
  converted_count: number;
}

export function InboundInvoicesClient() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [manifestingId, setManifestingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Busca Notas de Entrada
  const { data, isLoading, refetch, isFetching } = useQuery<InboundInvoicesResponse>({
    queryKey: ['inbound_invoices', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status_filter', statusFilter);
      const res = await fetch(`/api/v1/inbound-invoices?${params.toString()}`);
      if (!res.ok) throw new Error('Falha ao carregar notas de entrada');
      return res.json();
    },
  });

  // 2. Busca Obras para vínculo na conversão
  const { data: projects = [] } = useQuery({
    queryKey: ['inbound_projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id, name, code').order('name');
      if (error) return [];
      return data || [];
    },
  });

  // Sincronização com a SEFAZ
  const syncSefazMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      setSuccessMessage(null);
      const res = await fetch('/api/v1/inbound-invoices/sync-sefaz', { method: 'POST' });
      if (!res.ok) throw new Error('Falha ao sincronizar com webservice SEFAZ');
      return res.json();
    },
    onSuccess: (res) => {
      setSuccessMessage(res.message || 'Sincronização com SEFAZ concluída com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['inbound_invoices'] });
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Erro na sincronização SEFAZ');
    },
  });

  // Manifestação do Destinatário
  const manifestMutation = useMutation({
    mutationFn: async ({ id, eventType }: { id: string; eventType: string }) => {
      setManifestingId(id);
      const res = await fetch(`/api/v1/inbound-invoices/${id}/manifest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: eventType }),
      });
      if (!res.ok) throw new Error('Falha ao homologar manifestação na SEFAZ');
      return res.json();
    },
    onSuccess: (res) => {
      setManifestingId(null);
      setSuccessMessage(res.message || 'Manifestação registrada na SEFAZ!');
      queryClient.invalidateQueries({ queryKey: ['inbound_invoices'] });
    },
    onError: (err: any) => {
      setManifestingId(null);
      setErrorMessage(err.message || 'Erro na manifestação do destinatário');
    },
  });

  // Conversão Direta em Contas a Pagar
  const convertMutation = useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId?: string }) => {
      setConvertingId(id);
      const res = await fetch(`/api/v1/inbound-invoices/${id}/convert-to-payable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId || null }),
      });
      if (!res.ok) throw new Error('Falha ao converter nota em Contas a Pagar');
      return res.json();
    },
    onSuccess: (res) => {
      setConvertingId(null);
      setSuccessMessage(res.message || 'Lançamento financeiro de Contas a Pagar gerado!');
      queryClient.invalidateQueries({ queryKey: ['inbound_invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payables_list'] });
    },
    onError: (err: any) => {
      setConvertingId(null);
      setErrorMessage(err.message || 'Erro ao converter em Contas a Pagar');
    },
  });

  const invoices = data?.items || [];
  const totals = {
    total_sum: data?.total_amount_sum || 0,
    total_count: data?.total_count || 0,
    not_manifested: data?.not_manifested_count || 0,
    confirmed: data?.confirmed_count || 0,
    converted: data?.converted_count || 0,
  };

  const filteredInvoices = invoices.filter((inv) => {
    const term = searchTerm.toLowerCase();
    const matchKey = inv.access_key.toLowerCase().includes(term);
    const matchIssuer = inv.issuer_name?.toLowerCase().includes(term) || inv.issuer_trade_name?.toLowerCase().includes(term);
    const matchCnpj = inv.issuer_cnpj.includes(term);
    return matchKey || matchIssuer || matchCnpj;
  });

  const formatKey = (key: string) => {
    if (!key || key.length !== 44) return key;
    return key.replace(/(\d{4})/g, '$1 ').trim();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
              Fase 14 • DFe & Manifestação SEFAZ
            </span>
            <span className="text-xs text-slate-400">• Captura Automática de Insumos</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-sky-400" />
            Notas de Entrada (DFe SEFAZ)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Monitore em tempo real todas as notas fiscais eletrônicas (NF-e) emitidas contra o CNPJ da sua empresa,
            manifeste ciência/confirmação e converta os insumos diretamente em Contas a Pagar.
          </p>
        </div>

        {/* BOTÃO SINCRONIZAR SEFAZ */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => syncSefazMutation.mutate()}
            disabled={syncSefazMutation.isPending || isFetching}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-sky-600/25 border border-sky-400/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncSefazMutation.isPending || isFetching ? 'animate-spin' : ''}`} />
            <span>Sincronizar SEFAZ</span>
          </button>
        </div>
      </div>

      {/* ALERTAS DE STATUS */}
      {successMessage && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 flex items-center justify-between text-xs text-emerald-300">
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            {successMessage}
          </span>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white text-[11px]">✕</button>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 flex items-center justify-between text-xs text-rose-300">
          <span className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            {errorMessage}
          </span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white text-[11px]">✕</button>
        </div>
      )}

      {/* CARDS TOTALIZADORES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Valor Insumos */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Total em Insumos (DFe)</span>
            <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            R$ {totals.total_sum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {totals.total_count} notas capturadas no período
          </div>
        </div>

        {/* Não Manifestadas */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Aguardando Manifestação</span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
            {totals.not_manifested}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Exigem Confirmação na SEFAZ
          </div>
        </div>

        {/* Operações Confirmadas */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Operações Confirmadas</span>
            <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-teal-400 font-mono">
            {totals.confirmed}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Ciência ou Confirmação homologada
          </div>
        </div>

        {/* Convertidas em Contas a Pagar */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Convertidas em Pagar</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <WalletCards className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            {totals.converted}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Integradas ao Contas a Pagar
          </div>
        </div>
      </div>

      {/* FILTROS E PESQUISA */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por Chave de Acesso, Razão Social ou CNPJ..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 text-sky-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-sky-500"
          >
            <option value="all">Todos os Status</option>
            <option value="NOT_MANIFESTED">Não Manifestadas</option>
            <option value="CIENCIA_DA_OPERACAO">Ciência da Operação</option>
            <option value="CONFIRMACAO_DA_OPERACAO">Confirmação da Operação</option>
          </select>
        </div>
      </div>

      {/* LISTA / CARDS DE NOTAS FISCAIS DE ENTRADA */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-12 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-sky-400 mb-2" />
            Carregando documentos fiscais eletrônicos da SEFAZ...
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-12 text-center text-slate-400">
            <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="font-semibold text-slate-300">Nenhuma nota fiscal de entrada encontrada</p>
            <p className="text-xs text-slate-500 mt-1">
              Clique em &quot;Sincronizar SEFAZ&quot; para buscar novas notas emitidas para seu CNPJ.
            </p>
          </div>
        ) : (
          filteredInvoices.map((inv) => (
            <div
              key={inv.id}
              className="bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
            >
              {/* Lado Esquerdo: Chave e Fornecedor */}
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-slate-400 tracking-wider bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {formatKey(inv.access_key)}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                      inv.manifestation_status === 'CONFIRMACAO_DA_OPERACAO' || inv.manifestation_status === 'CONFIRMADA'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : inv.manifestation_status === 'CIENCIA_DA_OPERACAO'
                        ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {inv.manifestation_status === 'NOT_MANIFESTED'
                      ? 'Não Manifestada'
                      : inv.manifestation_status === 'CONFIRMACAO_DA_OPERACAO'
                      ? 'Confirmada na SEFAZ'
                      : inv.manifestation_status}
                  </span>
                  {inv.financial_entry_id && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                      <Check className="w-3 h-3 text-purple-400" />
                      Em Contas a Pagar
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-2">
                  <h3 className="font-bold text-white text-base">
                    {inv.issuer_name || 'Fornecedor de Insumos'}
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    (CNPJ: {inv.issuer_cnpj})
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 pt-0.5">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    Emissão: {inv.issue_date || 'Recente'}
                  </span>
                  <span>•</span>
                  <span className="text-slate-300 font-medium">
                    Valor: <strong className="text-emerald-400 font-mono font-bold text-sm">R$ {Number(inv.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </span>
                </div>
              </div>

              {/* Lado Direito: Ações */}
              <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap flex-shrink-0">
                {/* Botão Manifestar Confirmação se ainda não confirmada */}
                {inv.manifestation_status === 'NOT_MANIFESTED' && (
                  <button
                    onClick={() =>
                      manifestMutation.mutate({
                        id: inv.id,
                        eventType: 'CONFIRMACAO_DA_OPERACAO',
                      })
                    }
                    disabled={manifestingId === inv.id}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white font-semibold text-xs rounded-lg border border-slate-700 transition-all flex items-center gap-1.5 disabled:opacity-50"
                    title="Confirmar operação perante a SEFAZ"
                  >
                    {manifestingId === inv.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                    )}
                    <span>Manifestar SEFAZ</span>
                  </button>
                )}

                {/* BOTÃO CONVERTER EM CONTAS A PAGAR */}
                {inv.financial_entry_id ? (
                  <Link
                    href="/dashboard/financeiro/pagar"
                    className="px-3 py-1.5 bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 font-semibold text-xs rounded-lg border border-purple-500/30 transition-all inline-flex items-center gap-1.5"
                  >
                    <WalletCards className="w-3.5 h-3.5 text-purple-400" />
                    <span>Ver no Contas a Pagar</span>
                  </Link>
                ) : (
                  <button
                    onClick={() => convertMutation.mutate({ id: inv.id })}
                    disabled={convertingId === inv.id}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/25 border border-emerald-400/30 transition-all hover:scale-[1.02] active:scale-[0.98] inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {convertingId === inv.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Convertendo...</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownRight className="w-3.5 h-3.5 text-emerald-200" />
                        <span>Converter em Contas a Pagar</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
