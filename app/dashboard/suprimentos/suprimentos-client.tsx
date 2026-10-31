'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  CheckCircle2,
  Clock,
  MessageSquare,
  Award,
  Sparkles,
  Building2,
  UserCheck,
  Repeat,
  FileText,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { PaywallBlocker } from '@/components/ui/paywall-blocker';
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

export function SuprimentosClient({ activeModules }: { activeModules: string[] }) {
  const [activeTab, setActiveTab] = useState<'requisicoes' | 'concorrencia'>('concorrencia');
  const [requests, setRequests] = useState<PurchaseRequestItem[]>([]);
  const [selectedReqId, setSelectedReqId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const loadData = useCallback(async () => {
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
      const resp = await fetch('/api/v1/procurement/requests', {
        headers,
        cache: 'no-store',
      });
      if (resp.ok) {
        const data = await resp.json();
        const items: PurchaseRequestItem[] = data.items || [];
        setRequests(items);
        if (items.length > 0 && !selectedReqId) {
          setSelectedReqId(items[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [selectedReqId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!activeModules.includes('SUPRIMENTOS')) {
    return (
      <PaywallBlocker
        moduleName="Suprimentos & Procurement"
        description="Controle cotações em lote via WhatsApp, Matriz de Responsabilidade e Mapas de Cotação com Selo de Recomendação."
      />
    );
  }

  const currentReq = requests.find((r) => r.id === selectedReqId) || requests[0];

  const handleSetResponsibility = (respType: ResponsibilityType) => {
    if (!currentReq) return;
    setRequests((prev) =>
      prev.map((r) => (r.id === currentReq.id ? { ...r, responsibility: respType } : r))
    );
  };

  const handleSetWinner = (quoteId: string) => {
    if (!currentReq) return;
    setRequests((prev) =>
      prev.map((r) =>
        r.id === currentReq.id
          ? {
              ...r,
              quotes: r.quotes.map((q) => ({ ...q, is_winner: q.id === quoteId })),
            }
          : r
      )
    );
  };

  const handleSendClientMap = async () => {
    if (!currentReq) return;
    setFeedback(null);
    setProcessing('map');
    try {
      const resp = await fetch(`/api/v1/procurement/requests/${currentReq.id}/send-client-map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await resp.json();
      setFeedback({
        type: 'success',
        text:
          data.message ||
          'Mapa de Cotação enviado em PDF para o WhatsApp do cliente solicitando o De Acordo!',
      });
    } catch {
      setFeedback({ type: 'error', text: 'Erro ao disparar Mapa para o WhatsApp do cliente.' });
    } finally {
      setProcessing(null);
    }
  };

  const handleApproveRequest = async () => {
    if (!currentReq) return;
    setFeedback(null);
    setProcessing('approve');
    try {
      const winner = currentReq.quotes.find((q) => q.is_winner) || currentReq.quotes[0];
      const resp = await fetch(`/api/v1/procurement/requests/${currentReq.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responsibility: currentReq.responsibility,
          winner_quote_id: winner?.id,
          supplier_name: winner?.supplier_name,
          amount: winner?.total_amount,
          justification: winner?.justification,
        }),
      });
      const data = await resp.json();
      setRequests((prev) =>
        prev.map((r) => (r.id === currentReq.id ? { ...r, status: 'aprovado' } : r))
      );
      setFeedback({ type: 'success', text: data.message });
    } catch {
      setFeedback({ type: 'error', text: 'Falha ao aprovar requisição.' });
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              Prompt 84 • Matriz de Responsabilidade & Mapas de Cotação
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Package className="w-7 h-7 text-amber-400" />
            Suprimentos & Mapas de Cotação de Cliente
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Compare 3 orçamentos lado a lado, aplique o Selo de Recomendação da Engenharia, dispare
            o PDF do Mapa para o WhatsApp do cliente e execute o Contas a Pagar Duplo em compras
            reembolsáveis.
          </p>
        </div>

        {currentReq && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleSendClientMap}
              disabled={processing === 'map'}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/25 border border-emerald-400/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              {processing === 'map' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MessageSquare className="w-4 h-4 text-emerald-200" />
              )}
              <span>Gerar Mapa para Cliente (WhatsApp)</span>
            </button>

            <a
              href={`/api/v1/procurement/requests/${currentReq.id}/quotation-map/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-amber-400" />
              <span>PDF do Mapa</span>
            </a>

            <button
              type="button"
              onClick={handleApproveRequest}
              disabled={processing === 'approve' || currentReq.status === 'aprovado'}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              {processing === 'approve' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>
                {currentReq.status === 'aprovado'
                  ? 'Aprovado & Lançado'
                  : 'Aprovar Cotação Vencedora'}
              </span>
            </button>
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* TABS NAVEGAÇÃO */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('concorrencia')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'concorrencia'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Mapa de Cotação (3 Orçamentos Lado a Lado)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('requisicoes')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'requisicoes'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Requisições de Obra ({requests.length})
        </button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          <span>A carregar cotações...</span>
        </div>
      ) : activeTab === 'requisicoes' ? (
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              onClick={() => {
                setSelectedReqId(req.id);
                setActiveTab('concorrencia');
              }}
              className="cursor-pointer bg-slate-900/60 hover:bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 transition-all"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    REQ #{req.request_number}
                  </span>
                  <span className="text-xs font-bold text-white">{req.items_description}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />{' '}
                    {req.project_name || 'Edifício Metropolitan'}
                  </span>
                  <span>•</span>
                  <span>Responsabilidade: {req.responsibility}</span>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                {req.quotes.length} Cotações Recebidas
              </span>
            </div>
          ))}
        </div>
      ) : (
        currentReq && (
          <div className="space-y-5">
            {/* Seletor de Matriz de Responsabilidade */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                  Matriz de Responsabilidade • REQ #{currentReq.request_number}
                </span>
                <p className="text-sm font-bold text-white mt-0.5">
                  {currentReq.items_description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSetResponsibility('CONSTRUCTOR')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    currentReq.responsibility === 'CONSTRUCTOR'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>CONSTRUCTOR</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetResponsibility('CLIENT_DIRECT')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    currentReq.responsibility === 'CLIENT_DIRECT'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>CLIENT_DIRECT</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetResponsibility('CLIENT_REIMBURSEMENT')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    currentReq.responsibility === 'CLIENT_REIMBURSEMENT'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>CLIENT_REIMBURSEMENT (Contas a Pagar Duplo)</span>
                </button>
              </div>
            </div>

            {/* 3 Cotações Lado a Lado */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {currentReq.quotes.map((q) => (
                <div
                  key={q.id}
                  className={`rounded-xl p-5 border transition-all duration-200 ease-in-out flex flex-col justify-between ${
                    q.is_winner
                      ? 'bg-slate-900 border-emerald-500/50'
                      : 'bg-slate-900 border-slate-800 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="space-y-3">
                    {q.is_winner && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold uppercase">
                        <Award className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Selo de Recomendação (is_winner)</span>
                      </div>
                    )}

                    <h3 className="text-sm font-bold text-white">{q.supplier_name}</h3>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Preço Unitário:</span>
                        <span className="tabular-nums font-medium text-white">{formatBRL(q.unit_price)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Total da Proposta:</span>
                        <span className="tabular-nums font-medium font-bold text-emerald-400">
                          {formatBRL(q.total_amount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Prazo Entrega:</span>
                        <span className="text-white flex items-center gap-1 tabular-nums font-medium">
                          <Clock className="w-3 h-3 text-amber-400" /> {q.delivery_days} dias úteis
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Condição:</span>
                        <span className="text-white tabular-nums font-medium">{q.payment_terms}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Justificativa Técnica:
                      </span>
                      <p className="text-xs text-slate-300 italic mt-0.5">
                        &ldquo;{q.justification || 'Em análise comparativa'}&rdquo;
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSetWinner(q.id)}
                    className={`mt-4 w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all duration-200 ease-in-out ${
                      q.is_winner
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{q.is_winner ? 'Recomendada pela Engenharia' : 'Recomendar esta'}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
