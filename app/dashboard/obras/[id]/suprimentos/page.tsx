'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  Award,
  MessageCircle,
  CheckCircle2,
  FileText,
  Truck,
  Building2,
  UserCheck,
  Repeat,
  Clock,
  Loader2,
  Sparkles,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type ResponsibilityType = 'CONSTRUCTOR' | 'CLIENT_DIRECT' | 'CLIENT_REIMBURSEMENT';

interface QuoteItem {
  id: string;
  supplier_name: string;
  unit_price: number;
  total_amount: number;
  delivery_days: number;
  payment_terms: string;
  is_winner: boolean;
  justification?: string | null;
}

interface PurchaseRequestItem {
  id: string;
  request_number: number;
  project_id?: string | null;
  project_name?: string;
  category: string;
  urgency: string;
  status: string;
  responsibility: ResponsibilityType;
  delivery_deadline?: string | null;
  items_description: string;
  quotes: QuoteItem[];
}

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(val || 0)
  );
}

const RESPONSIBILITY_BADGES: Record<
  ResponsibilityType,
  { label: string; desc: string; colorClass: string; icon: React.ElementType }
> = {
  CONSTRUCTOR: {
    label: 'Custo Construtora (CONSTRUCTOR)',
    desc: 'Faturado e pago pela construtora (Contas a Pagar padrão).',
    colorClass: 'bg-slate-800 text-slate-200 border-slate-700',
    icon: Building2,
  },
  CLIENT_DIRECT: {
    label: 'Faturamento Direto Cliente (CLIENT_DIRECT)',
    desc: 'Fornecedor fatura NF-e e boletos diretamente no CPF/CNPJ do Cliente.',
    colorClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    icon: UserCheck,
  },
  CLIENT_REIMBURSEMENT: {
    label: 'Reembolso Cliente (CLIENT_REIMBURSEMENT)',
    desc: 'Construtora paga a loja (Contas a Pagar) e espelha cobrança automática no Contas a Receber.',
    colorClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    icon: Repeat,
  },
};

export default function ObraSuprimentosMapaPage() {
  const params = useParams();
  const projectId = String(params?.id || '');

  const [requests, setRequests] = useState<PurchaseRequestItem[]>([]);
  const [selectedReqId, setSelectedReqId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const qs = projectId ? `?project_id=${projectId}` : '';
      const resp = await fetch(`/api/v1/procurement/requests${qs}`, {
        headers,
        cache: 'no-store',
      });
      if (resp.ok) {
        const data = await resp.json();
        const list: PurchaseRequestItem[] = data.items || [];
        setRequests(list);
        if (list.length > 0 && !selectedReqId) {
          setSelectedReqId(list[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedReqId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const currentReq = requests.find((r) => r.id === selectedReqId) || requests[0];

  const handleChangeResponsibility = (newResp: ResponsibilityType) => {
    if (!currentReq) return;
    setRequests((prev) =>
      prev.map((r) => (r.id === currentReq.id ? { ...r, responsibility: newResp } : r))
    );
  };

  const handleSelectWinner = (quoteId: string) => {
    if (!currentReq) return;
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id !== currentReq.id) return r;
        return {
          ...r,
          quotes: r.quotes.map((q) => ({
            ...q,
            is_winner: q.id === quoteId,
          })),
        };
      })
    );
  };

  const handleUpdateJustification = (quoteId: string, text: string) => {
    if (!currentReq) return;
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id !== currentReq.id) return r;
        return {
          ...r,
          quotes: r.quotes.map((q) => (q.id === quoteId ? { ...q, justification: text } : q)),
        };
      })
    );
  };

  const handleSendMapToClient = async () => {
    if (!currentReq) return;
    setBanner(null);
    setProcessingAction('whatsapp-map');
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const resp = await fetch(`/api/v1/procurement/requests/${currentReq.id}/send-client-map`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      const data = await resp.json();
      setBanner({
        type: 'success',
        text:
          data.message ||
          'Mapa de Cotação com Selo de Recomendação enviado para o WhatsApp do cliente solicitando o De Acordo!',
      });
    } catch {
      setBanner({
        type: 'error',
        text: 'Falha ao disparar o Mapa de Cotação para o WhatsApp do cliente.',
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleApproveRequest = async () => {
    if (!currentReq) return;
    setBanner(null);
    setProcessingAction('approve');
    try {
      const winner = currentReq.quotes.find((q) => q.is_winner) || currentReq.quotes[0];
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const resp = await fetch(`/api/v1/procurement/requests/${currentReq.id}/approve`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          responsibility: currentReq.responsibility,
          winner_quote_id: winner?.id,
          supplier_name: winner?.supplier_name,
          amount: winner?.total_amount,
          project_id: projectId || currentReq.project_id,
          justification: winner?.justification,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.detail || 'Erro ao aprovar requisição.');
      }

      setRequests((prev) =>
        prev.map((r) => (r.id === currentReq.id ? { ...r, status: 'aprovado' } : r))
      );
      setBanner({
        type: 'success',
        text: data.message,
      });
    } catch (err: unknown) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao aprovar cotação.',
      });
    } finally {
      setProcessingAction(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho Contextual da Obra */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link
              href="/dashboard/obras"
              className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar para Obras
            </Link>
            <span>&bull;</span>
            <Link
              href={`/dashboard/obras/${projectId}/suprimentos/transferencias`}
              className="text-teal-400 hover:underline"
            >
              Portaria Digital & Transferências
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Package className="w-6 h-6 text-amber-400" />
            <span>Matriz de Responsabilidade & Mapa de Cotação de Cliente</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Compare os 3 orçamentos lado a lado, defina o Selo de Recomendação da Engenharia,
            envie o Mapa em PDF para o WhatsApp do cliente e acione o Contas a Pagar/Receber Duplo.
          </p>
        </div>

        {currentReq && (
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Botão Obrigatório: Gerar Mapa para Cliente (WhatsApp Evolution API) */}
            <button
              type="button"
              onClick={handleSendMapToClient}
              disabled={processingAction === 'whatsapp-map'}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {processingAction === 'whatsapp-map' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MessageCircle className="w-4 h-4" />
              )}
              <span>Gerar Mapa para Cliente (WhatsApp)</span>
            </button>

            <a
              href={`/api/v1/procurement/requests/${currentReq.id}/quotation-map/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
            >
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Ver PDF do Mapa</span>
            </a>

            <button
              type="button"
              onClick={handleApproveRequest}
              disabled={processingAction === 'approve' || currentReq.status === 'aprovado'}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              {processingAction === 'approve' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>
                {currentReq.status === 'aprovado'
                  ? 'Cotação Aprovada & Integrada'
                  : 'Aprovar Vencedora & Gerar Financeiro'}
              </span>
            </button>
          </div>
        )}
      </div>

      {banner && (
        <div
          className={`rounded-xl border p-4 flex items-center gap-3 text-xs font-medium ${
            banner.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
          }`}
        >
          {banner.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          <span>A carregar requisições e mapas comparativos de cotação...</span>
        </div>
      ) : (
        <>
          {/* Seletor de Requisições em Kanban / Pills */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requests.map((req) => {
              const active = req.id === currentReq?.id;
              const badge =
                RESPONSIBILITY_BADGES[req.responsibility] || RESPONSIBILITY_BADGES.CONSTRUCTOR;
              return (
                <div
                  key={req.id}
                  onClick={() => setSelectedReqId(req.id)}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                    active
                      ? 'bg-slate-900 border-amber-500/50 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                      REQ #{req.request_number}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badge.colorClass}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-white">{req.items_description}</p>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                    <span>{req.quotes.length} Orçamentos Lado a Lado</span>
                    <span className="uppercase font-bold text-emerald-400">{req.status}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {currentReq && (
            <div className="space-y-6">
              {/* Matriz de Responsabilidade (3 Estados Obrigatórios) */}
              <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block mb-3">
                  1. Matriz de Responsabilidade Financeira desta Requisição
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(
                    ['CONSTRUCTOR', 'CLIENT_DIRECT', 'CLIENT_REIMBURSEMENT'] as ResponsibilityType[]
                  ).map((mode) => {
                    const info = RESPONSIBILITY_BADGES[mode];
                    const Icon = info.icon;
                    const selected = currentReq.responsibility === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => handleChangeResponsibility(mode)}
                        className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                          selected
                            ? 'bg-emerald-950/30 border-emerald-500/50 ring-1 ring-emerald-500/40'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs text-white mb-1">
                          <Icon
                            className={`w-4 h-4 ${
                              selected ? 'text-emerald-400' : 'text-slate-400'
                            }`}
                          />
                          <span>{info.label}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">{info.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Comparativo Lado a Lado dos 3 Orçamentos (Kanban / Colunas A, B e C) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    2. Comparativo Lado a Lado — 3 Orçamentos (Fornecedores A, B e C)
                  </span>
                  <span className="text-xs text-slate-400">
                    Clique em &ldquo;Marcar como Vencedora&rdquo; para aplicar o Selo de Recomendação
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {currentReq.quotes.map((quote, idx) => {
                    const isWinner = quote.is_winner;
                    return (
                      <div
                        key={quote.id}
                        className={`rounded-2xl border p-5 flex flex-col justify-between transition-all relative ${
                          isWinner
                            ? 'bg-emerald-950/20 border-emerald-500/60 shadow-xl shadow-emerald-950/30'
                            : 'bg-slate-900/70 border-slate-800'
                        }`}
                      >
                        {isWinner && (
                          <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-extrabold uppercase tracking-wide self-start">
                            <Award className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Selo de Recomendação da Engenharia</span>
                          </div>
                        )}

                        <div className="space-y-4">
                          <div>
                            <span className="text-[10px] font-mono uppercase text-slate-400">
                              Opção {String.fromCharCode(65 + idx)}
                            </span>
                            <h3 className="text-base font-bold text-white mt-0.5">
                              {quote.supplier_name}
                            </h3>
                          </div>

                          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400">Preço Unitário:</span>
                              <span className="font-mono text-slate-200">
                                {formatBRL(quote.unit_price)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-400 font-semibold">
                                Valor Global:
                              </span>
                              <span
                                className={`text-lg font-extrabold font-mono ${
                                  isWinner ? 'text-emerald-400' : 'text-white'
                                }`}
                              >
                                {formatBRL(quote.total_amount)}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/60">
                              <span className="text-[10px] text-slate-500 block">
                                Prazo de Entrega
                              </span>
                              <span className="font-bold text-slate-200 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                {quote.delivery_days} dias úteis
                              </span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/60">
                              <span className="text-[10px] text-slate-500 block">
                                Condição Pagto
                              </span>
                              <span className="font-bold text-slate-200 block mt-0.5">
                                {quote.payment_terms}
                              </span>
                            </div>
                          </div>

                          {/* Justificativa Técnica (justification) */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-300 mb-1">
                              Justificativa da Engenharia (justification)
                            </label>
                            <input
                              type="text"
                              value={quote.justification || ''}
                              onChange={(e) =>
                                handleUpdateJustification(quote.id, e.target.value)
                              }
                              placeholder="Ex: Menor prazo de entrega / Frete CIF"
                              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>

                        <div className="mt-5 pt-4 border-t border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => handleSelectWinner(quote.id)}
                            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                              isWinner
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                            }`}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>
                              {isWinner
                                ? 'Cotação Vencedora Recomendada'
                                : 'Marcar como Vencedora (is_winner)'}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

