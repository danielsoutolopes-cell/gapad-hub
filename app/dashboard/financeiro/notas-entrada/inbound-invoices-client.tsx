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
  reconciliation_status?: 'PENDING' | 'MATCHED' | 'PRICE_DIVERGENCE' | 'QUANTITY_DIVERGENCE' | 'MATCHED_WITH_CREDIT' | null;
  purchase_request_id?: string | null;
  goods_receipt_id?: string | null;
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

  // Estados do Modal de Auditoria Fiscal 3-Way Match (PROMPT 96)
  const [auditModalInvoiceId, setAuditModalInvoiceId] = useState<string | null>(null);
  const [resolvingCredit, setResolvingCredit] = useState(false);

  // Query de Auditoria Fiscal 3-Way Match
  const { data: auditResponse, isLoading: isLoadingAudit, refetch: refetchAudit } = useQuery({
    queryKey: ['three_way_match_audit', auditModalInvoiceId],
    queryFn: async () => {
      if (!auditModalInvoiceId) return null;
      const res = await fetch(`/api/v1/finance/reconciliation/match/${auditModalInvoiceId}/audit`);
      if (!res.ok) throw new Error('Falha ao obter auditoria fiscal 3-Way Match');
      return res.json();
    },
    enabled: !!auditModalInvoiceId,
  });

  // Mutação para aprovar pagamento e gerar crédito na Conta Corrente
  const approveWithCreditMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      setResolvingCredit(true);
      const res = await fetch(`/api/v1/finance/reconciliation/match/${invoiceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APPROVE_WITH_CREDIT',
          notes: 'Aprovação manual de auditoria com crédito a favor da construtora.',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.detail || json.message || 'Erro ao homologar crédito de fornecedor.');
      }
      return json;
    },
    onSuccess: (data) => {
      setSuccessMessage(data.message || 'Reconciliação 3-Way Match homologada com sucesso! Crédito inserido.');
      queryClient.invalidateQueries({ queryKey: ['inbound_invoices'] });
      queryClient.invalidateQueries({ queryKey: ['supplier_credits'] });
      refetchAudit();
      setResolvingCredit(false);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Erro ao processar resolução de 3-Way Match');
      setResolvingCredit(false);
    },
  });
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
                  {/* Status 3-Way Match */}
                  {inv.reconciliation_status === 'MATCHED' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      3-Way Match: 100% Ok
                    </span>
                  )}
                  {inv.reconciliation_status === 'MATCHED_WITH_CREDIT' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-teal-400" />
                      3-Way: Crédito Gerado
                    </span>
                  )}
                  {(inv.reconciliation_status === 'QUANTITY_DIVERGENCE' || inv.reconciliation_status === 'PRICE_DIVERGENCE') && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 animate-pulse">
                      <AlertCircle className="w-3 h-3 text-rose-400" />
                      Divergência Fiscal
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
                {/* Botão Auditoria Fiscal 3-Way Match */}
                <button
                  onClick={() => setAuditModalInvoiceId(inv.id)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white font-semibold text-xs rounded-lg border border-slate-700 transition-all flex items-center gap-1.5"
                  title="Auditoria 3-Way Match (PO x GR x NF-e)"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>Auditar 3-Way Match</span>
                </button>

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
      {/* MODAL DE AUDITORIA FISCAL (3-WAY MATCH) - PROMPT 96 */}
      {auditModalInvoiceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Auditoria Fiscal 3-Way Match
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold border bg-slate-800 text-slate-300 border-slate-700">
                      Procure-to-Pay
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Reconciliação cruzada: Pedido de Compra (PO) × Recebimento Físico (GR) × NF-e (SEFAZ)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAuditModalInvoiceId(null)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {isLoadingAudit ? (
                <div className="py-16 text-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-sky-400 mb-3" />
                  <p className="text-sm font-medium">Cruzando 3 vias fiscais e de almoxarifado...</p>
                </div>
              ) : !auditResponse?.audit ? (
                <div className="py-12 text-center text-slate-400">
                  <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p>Não foi possível carregar os dados de auditoria para esta nota.</p>
                </div>
              ) : (
                <>
                  {/* Status Banner */}
                  <div
                    className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      auditResponse.audit.status === 'MATCHED'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : auditResponse.audit.status === 'MATCHED_WITH_CREDIT'
                        ? 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-bold text-sm">
                        {auditResponse.audit.status === 'MATCHED' ? (
                          <>
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            <span>Reconciliação 100% Compatível (3-Way Matched)</span>
                          </>
                        ) : auditResponse.audit.status === 'MATCHED_WITH_CREDIT' ? (
                          <>
                            <CheckCircle2 className="w-5 h-5 text-teal-400" />
                            <span>Reconciliado com Geração de Saldo Credor (Conta Corrente)</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-5 h-5 text-rose-400" />
                            <span>Divergência Fiscal Detectada — Contas a Pagar Travado (BLOCKED)</span>
                          </>
                        )}
                      </div>
                      <p className="text-xs opacity-90">
                        Fornecedor: <strong>{auditResponse.audit.issuer_name}</strong> | NF-e: <strong>#{auditResponse.audit.nfe_number}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-[11px] text-slate-400">Total Faturado (NF-e)</div>
                        <div className="text-base font-bold font-mono text-white">
                          R$ {Number(auditResponse.audit.total_amount_nfe || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* As 3 Colunas: Comparativo de Itens */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Detalhamento dos Itens Cruzados
                    </h4>

                    {auditResponse.audit.items?.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/80 pb-3 gap-2">
                          <span className="font-semibold text-white text-sm">
                            {item.item_description}
                          </span>
                          {item.financial_difference > 0 && (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Faturado a maior: {item.missing_quantity} un (Diferença: R$ {item.financial_difference.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                            </span>
                          )}
                        </div>

                        {/* As 3 Colunas */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Coluna 1: Comprado (PO) */}
                          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                            <div className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center justify-between">
                              <span>1. Pedido de Compra (PO)</span>
                              <FileText className="w-3.5 h-3.5 text-sky-400" />
                            </div>
                            <div className="text-xs text-slate-300 space-y-1">
                              <div>Qtd: <strong className="text-white font-mono">{item.purchased_po.quantity}</strong></div>
                              <div>Preço Unit: <strong className="text-white font-mono">R$ {Number(item.purchased_po.unit_price).toFixed(2)}</strong></div>
                              <div className="pt-1 border-t border-slate-800 text-sky-300 font-mono font-bold">
                                Total: R$ {Number(item.purchased_po.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          </div>

                          {/* Coluna 2: Recebido (GR) */}
                          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                            <div className="text-[11px] font-bold text-teal-400 uppercase tracking-wider flex items-center justify-between">
                              <span>2. Recebido no Campo (GR)</span>
                              <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                            </div>
                            <div className="text-xs text-slate-300 space-y-1">
                              <div>Qtd Real: <strong className="text-white font-mono">{item.received_gr.quantity}</strong></div>
                              <div>Preço Base: <strong className="text-white font-mono">R$ {Number(item.received_gr.unit_price).toFixed(2)}</strong></div>
                              <div className="pt-1 border-t border-slate-800 text-teal-300 font-mono font-bold">
                                Total Físico: R$ {Number(item.received_gr.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          </div>

                          {/* Coluna 3: Faturado (NF-e XML) */}
                          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                            <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center justify-between">
                              <span>3. Faturado NF-e (XML)</span>
                              <FileCheck2 className="w-3.5 h-3.5 text-purple-400" />
                            </div>
                            <div className="text-xs text-slate-300 space-y-1">
                              <div>Qtd Cobrada: <strong className="text-white font-mono">{item.invoiced_nfe.quantity}</strong></div>
                              <div>Preço Unit: <strong className="text-white font-mono">R$ {Number(item.invoiced_nfe.unit_price).toFixed(2)}</strong></div>
                              <div className="pt-1 border-t border-slate-800 text-purple-300 font-mono font-bold">
                                Total NF-e: R$ {Number(item.invoiced_nfe.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Resolução Inteligente de Créditos (Prompt 95 + 96 + 98) */}
                  {auditResponse.can_approve_with_credit && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <DollarSign className="w-4 h-4 text-amber-400" />
                          <span>
                            {auditResponse.audit.responsibility === 'CLIENT_DIRECT'
                              ? 'Resolução CLIENT_DIRECT: Faturado a maior no CNPJ do Cliente'
                              : 'Oportunidade de Compensação Financeira (Saldo Credor Construtora)'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {auditResponse.audit.responsibility === 'CLIENT_DIRECT'
                            ? `A NF-e cobrou R$ ${Number(auditResponse.financial_credit_potential).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} a mais do que a entrega física. Ao aprovar, o crédito fica retido exclusivamente para esta obra e o boleto corrigido é liberado para envio ao cliente.`
                            : `A NF-e cobrou R$ ${Number(auditResponse.financial_credit_potential).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} a mais do que a entrega física. Você pode destravar o Contas a Pagar sem protestos e criar automaticamente um Saldo Credor com o fornecedor.`}
                        </p>
                      </div>

                      <button
                        onClick={() => approveWithCreditMutation.mutate(auditModalInvoiceId)}
                        disabled={resolvingCredit}
                        className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 border border-emerald-400/30 flex items-center gap-2 whitespace-nowrap disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        {resolvingCredit ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Processando Crédito...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 text-emerald-200" />
                            <span>
                              {auditResponse.audit.responsibility === 'CLIENT_DIRECT'
                                ? 'Aprovar Boleto com Divergência e Gerar Crédito na Obra'
                                : 'Aprovar Pagamento e Gerar Crédito'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end">
              <button
                onClick={() => setAuditModalInvoiceId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
