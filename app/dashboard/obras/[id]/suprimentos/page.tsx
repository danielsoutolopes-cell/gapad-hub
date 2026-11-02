'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  Award,
  MessageCircle,
  CheckCircle2,
  FileText,
  Building2,
  UserCheck,
  Repeat,
  Clock,
  Loader2,
  Sparkles,
  AlertTriangle,
  UploadCloud,
  ShieldAlert,
  TrendingDown,
  Receipt,
  Camera,
  X,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Layers,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { HelpTooltip } from '@/components/ui/tooltip';

type ResponsibilityType = 'CONSTRUCTOR' | 'CLIENT_DIRECT' | 'CLIENT_REIMBURSEMENT';

const ENGINEERING_CATEGORIES = [
  'ELÉTRICA',
  'HIDRÁULICA',
  'CIVIL',
  'MARCENARIA',
  'REVESTIMENTOS',
  'ESTRUTURAL',
] as const;

interface CategorizedLineItem {
  description: string;
  category: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
}

interface QuoteItem {
  id: string;
  supplier_name: string;
  category?: string;
  unit_price: number;
  total_amount: number;
  delivery_days: number;
  payment_terms: string;
  is_winner: boolean;
  human_verified?: boolean;
  justification?: string | null;
}

interface PurchaseRequestItem {
  id: string;
  request_number: number;
  sequence_number?: number;
  map_code?: string;
  project_id?: string | null;
  project_name?: string;
  category: string;
  urgency: string;
  status: string;
  responsibility: ResponsibilityType;
  delivery_deadline?: string | null;
  items_description: string;
  categorized_items?: CategorizedLineItem[];
  quotes: QuoteItem[];
}

interface DraftQuoteReview {
  draft_id: string;
  supplier_name: string;
  supplier_document?: string;
  category: string;
  unit_price: number;
  total_amount: number;
  delivery_days: number;
  payment_terms: string;
  categorized_items?: CategorizedLineItem[];
  justification: string;
  confidence_score: number;
  source: string;
  file_name?: string | null;
}

interface AdvisorSupplier {
  name: string;
  last_unit_price: number;
  avg_delivery_days: number;
  phone: string;
  reliability_score: string;
}

interface AdvisorData {
  query: string;
  non_blocking: boolean;
  best_historical_price: number;
  average_historical_price: number;
  unit: string;
  best_price_supplier: string;
  best_price_date: string;
  best_price_project: string;
  suggested_suppliers: AdvisorSupplier[];
  advisory_message: string;
}

interface CategoryCostSummary {
  category: string;
  label: string;
  subtotal: number;
  items_count: number;
  abc_class: string;
  percentage: number;
}

interface DirectPurchaseItem {
  id: string;
  sequence_number: number;
  direct_code: string;
  category?: string;
  description: string;
  supplier_name: string;
  supplier_document?: string | null;
  total_amount: number;
  purchase_date: string;
  payment_method: string;
  responsibility: ResponsibilityType;
  receipt_photo_url: string;
  receipt_file_name?: string;
  status: string;
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
    colorClass: 'bg-slate-800 text-slate-300 border-slate-700',
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

  const [activeView, setActiveView] = useState<'matriz' | 'custos_abc' | 'comprinhas'>('matriz');
  const [requests, setRequests] = useState<PurchaseRequestItem[]>([]);
  const [selectedReqId, setSelectedReqId] = useState<string>('');
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    REVESTIMENTOS: true,
    ESTRUTURAL: true,
    ELÉTRICA: true,
    HIDRÁULICA: true,
    CIVIL: true,
    MARCENARIA: true,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Prompt 86: AI Advisor (Não Bloqueante)
  const [advisor, setAdvisor] = useState<AdvisorData | null>(null);

  // Prompt 87: Curva ABC / Despesas por Categoria
  const [categoryCosts, setCategoryCosts] = useState<CategoryCostSummary[]>([]);

  // Prompt 86 & 87: Drag-and-Drop / Omnichannel LLM Parser & Modal Human-in-the-Loop com Category
  const [rawPasteText, setRawPasteText] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isParsingAI, setIsParsingAI] = useState<boolean>(false);
  const [draftModal, setDraftModal] = useState<DraftQuoteReview | null>(null);
  const [isConfirmingHITL, setIsConfirmingHITL] = useState<boolean>(false);

  // Prompt 86: Compras Diretas ("Comprinhas" / Fundo de Maneio)
  const [directPurchases, setDirectPurchases] = useState<DirectPurchaseItem[]>([]);
  const [dpDesc, setDpDesc] = useState<string>('');
  const [dpCategory, setDpCategory] = useState<string>('CIVIL');
  const [dpSupplier, setDpSupplier] = useState<string>('');
  const [dpAmount, setDpAmount] = useState<string>('');
  const [dpMethod, setDpMethod] = useState<string>('PIX');
  const [dpResponsibility, setDpResponsibility] = useState<ResponsibilityType>('CONSTRUCTOR');
  const [dpReceiptName, setDpReceiptName] = useState<string>('');

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

      const qs = projectId ? `?project_id=${projectId}` : '';
      const [reqResp, dpResp, abcResp] = await Promise.all([
        fetch(`/api/v1/procurement/requests${qs}`, { headers, cache: 'no-store' }),
        fetch(`/api/v1/procurement/direct-purchases${qs}`, { headers, cache: 'no-store' }),
        fetch(`/api/v1/procurement/costs-by-category${qs}`, { headers, cache: 'no-store' }),
      ]);

      if (reqResp.ok) {
        const data = await reqResp.json();
        const list: PurchaseRequestItem[] = data.items || [];
        setRequests(list);
        if (list.length > 0 && !selectedReqId) {
          setSelectedReqId(list[0].id);
        }
      }

      if (dpResp.ok) {
        const dpData = await dpResp.json();
        setDirectPurchases(dpData.items || []);
      }

      if (abcResp.ok) {
        const abcData = await abcResp.json();
        setCategoryCosts(abcData.categories || []);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedReqId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentReq = requests.find((r) => r.id === selectedReqId) || requests[0];

  // Agrupamento das requisições por Família do Insumo (Accordions Prompt 87)
  const groupedRequestsByCategory = useMemo(() => {
    const groups: Record<
      string,
      { category: string; subtotal: number; items: PurchaseRequestItem[] }
    > = {};

    for (const req of requests) {
      const cat = String(req.category || 'CIVIL').toUpperCase();
      if (!groups[cat]) {
        groups[cat] = { category: cat, subtotal: 0, items: [] };
      }
      const winner = req.quotes.find((q) => q.is_winner) || req.quotes[0];
      const reqSubtotal = Number(winner?.total_amount || 0);
      groups[cat].subtotal += reqSubtotal;
      groups[cat].items.push(req);
    }

    return Object.values(groups);
  }, [requests]);

  const toggleCategoryAccordion = (cat: string) => {
    setOpenCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  useEffect(() => {
    if (!currentReq?.items_description) return;
    let active = true;
    fetch(
      `/api/v1/procurement/advisor?query=${encodeURIComponent(currentReq.items_description)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data) setAdvisor(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [currentReq?.items_description]);

  const triggerOmnichannelParse = async (opts: {
    raw_text?: string;
    file_name?: string;
    source: string;
  }) => {
    setBanner(null);
    setIsParsingAI(true);
    try {
      const resp = await fetch('/api/v1/procurement/parse-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: currentReq?.id,
          raw_text: opts.raw_text,
          file_name: opts.file_name,
          source: opts.source,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.detail || 'Erro na leitura da cotação via IA.');
      }
      setDraftModal({
        ...data.draft_quote,
        category: data.draft_quote?.category || 'ELÉTRICA',
      });
    } catch (err: unknown) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha ao extrair rascunho da cotação.',
      });
    } finally {
      setIsParsingAI(false);
    }
  };

  const handleConfirmHumanReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftModal || !currentReq) return;
    setIsConfirmingHITL(true);
    try {
      const resp = await fetch(`/api/v1/procurement/requests/${currentReq.id}/quotes/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_name: draftModal.supplier_name,
          supplier_document: draftModal.supplier_document,
          category: draftModal.category,
          unit_price: Number(draftModal.unit_price),
          total_amount: Number(draftModal.total_amount),
          delivery_days: Number(draftModal.delivery_days),
          payment_terms: draftModal.payment_terms,
          justification: draftModal.justification,
          is_winner: false,
          extraction_source: `HUMAN_VERIFIED_${draftModal.source}`,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.detail || 'Erro ao confirmar cotação.');
      }

      const confirmedQuote: QuoteItem = {
        id: data.quote?.id || `q-hitl-${Date.now()}`,
        supplier_name: draftModal.supplier_name,
        category: draftModal.category,
        unit_price: Number(draftModal.unit_price),
        total_amount: Number(draftModal.total_amount),
        delivery_days: Number(draftModal.delivery_days),
        payment_terms: draftModal.payment_terms,
        is_winner: false,
        human_verified: true,
        justification: draftModal.justification,
      };

      setRequests((prev) =>
        prev.map((r) =>
          r.id === currentReq.id ? { ...r, quotes: [...r.quotes, confirmedQuote] } : r
        )
      );
      setDraftModal(null);
      setRawPasteText('');
      setBanner({
        type: 'success',
        text: data.message,
      });
    } catch (err: unknown) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao injetar cotação na Matriz.',
      });
    } finally {
      setIsConfirmingHITL(false);
    }
  };

  const handleCreateDirectPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dpDesc.trim() || !dpSupplier.trim() || Number(dpAmount) <= 0) {
      setBanner({
        type: 'error',
        text: 'Preencha descrição, fornecedor, valor e anexe a foto do recibo para registar a Compra Direta.',
      });
      return;
    }
    setProcessingAction('create-dp');
    try {
      const resp = await fetch('/api/v1/procurement/direct-purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId || null,
          category: dpCategory,
          description: dpDesc.trim(),
          supplier_name: dpSupplier.trim(),
          total_amount: Number(dpAmount),
          payment_method: dpMethod,
          responsibility: dpResponsibility,
          receipt_photo_url: dpReceiptName || 'recibo_fotografico_obra.jpg',
          receipt_file_name: dpReceiptName || 'recibo_fotografico_obra.jpg',
        }),
      });
      const data = await resp.json();
      if (data.item) {
        setDirectPurchases((prev) => [{ ...data.item, category: dpCategory }, ...prev]);
      }
      setDpDesc('');
      setDpSupplier('');
      setDpAmount('');
      setDpReceiptName('');
      setBanner({
        type: 'success',
        text: data.message || 'Compra Direta registada com sucesso!',
      });
    } finally {
      setProcessingAction(null);
    }
  };

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
      const resp = await fetch(`/api/v1/procurement/requests/${currentReq.id}/send-client-map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await resp.json();
      setBanner({
        type: 'success',
        text:
          data.message ||
          'Mapa de Cotação agrupado por Categoria enviado para o WhatsApp do cliente solicitando o De Acordo!',
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
      const resp = await fetch(`/api/v1/procurement/requests/${currentReq.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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

  const totalCostABC = useMemo(
    () => categoryCosts.reduce((acc, c) => acc + c.subtotal, 0),
    [categoryCosts]
  );

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
              className="text-slate-300 hover:text-white underline"
            >
              Portaria Digital & Transferências
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Package className="w-6 h-6 text-slate-300" />
            <span>Smart Procurement • Categorização ABC, Accordions & HITL</span>
            <HelpTooltip
              title="Regra da Matriz de Cotação & HITL"
              content="Nenhuma IA grava valores direto no banco: toda leitura (PDF/WhatsApp) abre o Modal Human-in-the-Loop para revisão e categorização (Curva ABC). Selecione CLIENT_REIMBURSEMENT quando a construtora pagar mas o custo gerar reembolso automático no Contas a Receber do cliente."
            />
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Agrupamento inteligente de cotações por família de insumos (
            <strong className="text-slate-200">ELÉTRICA, HIDRÁULICA, CIVIL, MARCENARIA</strong>),
            subtotais no PDF do cliente e trava obrigatória{' '}
            <strong className="text-slate-200">Human-in-the-Loop</strong>.
          </p>
        </div>

        {currentReq && activeView === 'matriz' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleSendMapToClient}
              disabled={processingAction === 'whatsapp-map'}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition-all duration-200 ease-in-out cursor-pointer disabled:opacity-50"
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-all duration-200 ease-in-out"
            >
              <FileText className="w-4 h-4 text-slate-400" />
              <span>PDF Agrupado por Categoria</span>
            </a>

            <button
              type="button"
              onClick={handleApproveRequest}
              disabled={processingAction === 'approve' || currentReq.status === 'aprovado'}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-bold text-xs transition-all duration-200 ease-in-out cursor-pointer"
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

      {/* Navegação de Abas */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveView('matriz')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ease-in-out cursor-pointer flex items-center gap-1.5 ${
            activeView === 'matriz'
              ? 'bg-slate-900 text-white border border-slate-700'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>Matriz Agrupada por Família (Accordions • {requests.length} Mapas)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('custos_abc')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ease-in-out cursor-pointer flex items-center gap-1.5 ${
            activeView === 'custos_abc'
              ? 'bg-slate-900 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Dashboard de Custos: Despesas por Categoria (Curva ABC)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('comprinhas')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ease-in-out cursor-pointer flex items-center gap-1.5 ${
            activeView === 'comprinhas'
              ? 'bg-slate-900 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Receipt className="w-3.5 h-3.5 text-amber-400" />
          <span>Compras Diretas / &ldquo;Comprinhas&rdquo; ({directPurchases.length})</span>
        </button>
      </div>

      {banner && (
        <div
          className={`rounded-xl border p-4 flex items-center gap-3 text-xs font-medium ${
            banner.type === 'success'
              ? 'bg-slate-900 border-emerald-500/40 text-emerald-300'
              : 'bg-slate-900 border-rose-500/40 text-rose-300'
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
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          <span>A carregar Categorização Inteligente e Curva ABC...</span>
        </div>
      ) : activeView === 'custos_abc' ? (
        /* =====================================================================
           ABA: DASHBOARD DE CUSTOS — DESPESAS POR CATEGORIA (CURVA ABC — P87)
           ===================================================================== */
        <div className="space-y-6">
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-400" />
                  <span>Gráfico de Despesas por Categoria da Obra (Curva ABC)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Distribuição consolidada do orçamento de suprimentos por família de insumo
                  (REVESTIMENTOS, ESTRUTURAL, ELÉTRICA, HIDRÁULICA, MARCENARIA e CIVIL).
                </p>
              </div>
              <div className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Total Geral Cotado / Apropriado
                </span>
                <span className="text-lg font-extrabold text-emerald-400 tabular-nums font-mono">
                  {formatBRL(totalCostABC)}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {categoryCosts.map((cat) => (
                <div
                  key={cat.category}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          cat.abc_class === 'A'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : cat.abc_class === 'B'
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        Curva {cat.abc_class}
                      </span>
                      <span className="font-bold text-white">{cat.label}</span>
                      <span className="text-slate-500 tabular-nums">
                        ({cat.items_count} itens agrupados)
                      </span>
                    </div>

                    <div className="flex items-center gap-4 tabular-nums font-medium">
                      <span className="text-slate-400">{cat.percentage}% da obra</span>
                      <span className="text-sm font-bold text-white font-mono">
                        {formatBRL(cat.subtotal)}
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full rounded-full ${
                        cat.abc_class === 'A'
                          ? 'bg-emerald-500'
                          : cat.abc_class === 'B'
                          ? 'bg-amber-500'
                          : 'bg-slate-500'
                      }`}
                      style={{ width: `${Math.min(100, cat.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeView === 'comprinhas' ? (
        /* =====================================================================
           ABA DE COMPRAS DIRETAS ("COMPRINHAS" / FUNDO DE MANEIO)
           ===================================================================== */
        <div className="space-y-6">
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white mb-1 flex items-center gap-2">
              <Camera className="w-4 h-4 text-amber-400" />
              <span>Registar Compra Direta (&ldquo;Comprinha&rdquo; / Fundo de Maneio)</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Para despesas rápidas de canteiro classificadas por Categoria (Curva ABC) com anexo de
              recibo fotográfico.
            </p>

            <form onSubmit={handleCreateDirectPurchase} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Descrição dos Itens de Urgência *
                  </label>
                  <input
                    type="text"
                    value={dpDesc}
                    onChange={(e) => setDpDesc(e.target.value)}
                    placeholder="Ex: 15 Discos Diamantados Bosch + Parafusos Bucha 8"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Categoria (Família) *
                  </label>
                  <select
                    value={dpCategory}
                    onChange={(e) => setDpCategory(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    {ENGINEERING_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Fornecedor / Loja *
                  </label>
                  <input
                    type="text"
                    value={dpSupplier}
                    onChange={(e) => setDpSupplier(e.target.value)}
                    placeholder="Ex: Casa do Construtor"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Valor Total (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={dpAmount}
                    onChange={(e) => setDpAmount(e.target.value)}
                    placeholder="Ex: 485.90"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white tabular-nums font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Responsabilidade Financeira *
                  </label>
                  <select
                    value={dpResponsibility}
                    onChange={(e) => setDpResponsibility(e.target.value as ResponsibilityType)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    <option value="CONSTRUCTOR">CONSTRUCTOR (Custo Construtora)</option>
                    <option value="CLIENT_REIMBURSEMENT">
                      CLIENT_REIMBURSEMENT (Reembolso Cliente • Contas Duplo)
                    </option>
                    <option value="CLIENT_DIRECT">CLIENT_DIRECT (Pago pelo Cliente)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Meio de Pagamento
                  </label>
                  <select
                    value={dpMethod}
                    onChange={(e) => setDpMethod(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    <option value="PIX">PIX / Fundo de Maneio</option>
                    <option value="CARTAO_CORPORATIVO">Cartão Corporativo da Obra</option>
                    <option value="DINHEIRO">Caixa Rápido Canteiro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Foto do Recibo / Cupom Fiscal *
                  </label>
                  <label className="flex items-center justify-between px-3.5 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs text-slate-300 cursor-pointer">
                    <span className="truncate">
                      {dpReceiptName || 'Clique para anexar foto do cupom (.jpg/.png/.pdf)...'}
                    </span>
                    <Camera className="w-4 h-4 text-amber-400 flex-shrink-0 ml-2" />
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setDpReceiptName(f.name);
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={processingAction === 'create-dp'}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Registar Compra Direta & Conciliar Financeiro
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-[11px] font-bold text-slate-400 uppercase">
                  <th className="py-3 px-4">Código Sequencial</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Descrição / Fornecedor</th>
                  <th className="py-3 px-4">Responsabilidade</th>
                  <th className="py-3 px-4 text-right">Valor Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {directPurchases.map((dp) => (
                  <tr
                    key={dp.id}
                    className="hover:bg-slate-800/50 transition-all duration-200 ease-in-out"
                  >
                    <td className="py-3 px-4 tabular-nums font-mono font-bold text-amber-400">
                      {dp.direct_code}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700">
                        {dp.category || 'CIVIL'}
                      </span>
                    </td>
                    <td className="py-3 px-4 tabular-nums font-medium text-slate-300">
                      {dp.purchase_date}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{dp.description}</div>
                      <div className="text-[11px] text-slate-400">{dp.supplier_name}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {dp.responsibility}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-medium text-white">
                      {formatBRL(dp.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* =====================================================================
           ABA PRINCIPAL: ACCORDIONS POR FAMÍLIA DE INSUMO + MATRIZ HITL (P87)
           ===================================================================== */
        <>
          {/* COMPONENTE DRAG-AND-DROP OMNICHANNEL COM INFERÊNCIA DE CATEGORIA */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-emerald-400" />
                  <span>
                    Importação Omnichannel com Categorização Automática (ELÉTRICA, HIDRÁULICA,
                    CIVIL, MARCENARIA)
                  </span>
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  A IA deduz a família do insumo e extrai os valores em memória (Draft), abrindo o
                  Modal de Revisão Humana antes de gravar no banco.
                </p>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                Human-in-the-Loop + Auto-Category
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) {
                    triggerOmnichannelParse({
                      file_name: f.name,
                      source: 'DRAG_AND_DROP_FILE',
                    });
                  }
                }}
                className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ease-in-out ${
                  isDragging
                    ? 'border-emerald-400 bg-slate-800/60'
                    : 'border-slate-700 bg-slate-950 hover:border-slate-600'
                }`}
              >
                <UploadCloud className="w-7 h-7 text-slate-400 mb-2" />
                <span className="text-xs font-bold text-slate-200">
                  Arraste e solte o PDF ou Foto do Orçamento aqui
                </span>
                <span className="text-[11px] text-slate-500 mt-1">
                  A IA identificará automaticamente os itens e sua Categoria (Curva ABC)
                </span>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      triggerOmnichannelParse({
                        file_name: f.name,
                        source: 'MANUAL_FILE_UPLOAD',
                      });
                    }
                  }}
                />
              </label>

              <div className="flex flex-col justify-between bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <textarea
                  rows={3}
                  value={rawPasteText}
                  onChange={(e) => setRawPasteText(e.target.value)}
                  placeholder="Ou cole o texto bruto do WhatsApp (Ex: 'Eletrotrafo - Cabo Flexível 2,5mm e Disjuntores DIN - Unitário R$ 380,00 / Total R$ 14.380,00 - 3 dias')..."
                  className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none resize-none"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={isParsingAI}
                    onClick={() =>
                      triggerOmnichannelParse({
                        raw_text:
                          rawPasteText.trim() ||
                          'Sonepar Elétrica\nCabo Flexível 750V + Disjuntor DIN | Unitário R$ 375,00 | Total R$ 14.250,00 | 3 dias úteis | PIX',
                        source: 'WHATSAPP_TEXT_PASTE',
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold cursor-pointer"
                  >
                    {isParsingAI ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>A categorizar com IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Extrair & Categorizar via IA (Abrir Revisão HITL)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ACCORDIONS DE AGRUPAMENTO POR FAMÍLIA DO INSUMO (PROMPT 87) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Famílias de Insumos Agrupadas (Accordions Curva ABC)
              </span>
              <span className="text-xs text-slate-400">
                Clique numa família para expandir ou recolher os mapas da categoria
              </span>
            </div>

            {groupedRequestsByCategory.map((group) => {
              const isOpen = openCategories[group.category] ?? true;
              return (
                <div
                  key={group.category}
                  className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden"
                >
                  {/* Cabeçalho Separador do Accordion da Categoria com SUBTOTAL */}
                  <button
                    type="button"
                    onClick={() => toggleCategoryAccordion(group.category)}
                    className="w-full px-5 py-3.5 bg-slate-950 hover:bg-slate-800/50 flex items-center justify-between gap-4 transition-all duration-200 ease-in-out cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                      <span className="text-xs sm:text-sm font-bold text-white">
                        👷 Categoria: {group.category}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 tabular-nums">
                        {group.items.length} {group.items.length === 1 ? 'Mapa' : 'Mapas'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400 uppercase text-[10px] font-bold">
                        Subtotal {group.category}:
                      </span>
                      <span className="text-sm font-bold text-emerald-400 tabular-nums font-mono">
                        {formatBRL(group.subtotal)}
                      </span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-800">
                      {group.items.map((req, idx) => {
                        const active = req.id === currentReq?.id;
                        const badge =
                          RESPONSIBILITY_BADGES[req.responsibility] ||
                          RESPONSIBILITY_BADGES.CONSTRUCTOR;
                        const mapCode =
                          req.map_code ||
                          `MAPA-${String(req.sequence_number || idx + 1).padStart(3, '0')}-LORENA`;
                        return (
                          <div
                            key={req.id}
                            onClick={() => setSelectedReqId(req.id)}
                            className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 ease-in-out ${
                              active
                                ? 'bg-slate-950 border-emerald-500/60'
                                : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span className="tabular-nums font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                                  {mapCode}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                  {req.category}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.colorClass}`}
                              >
                                {req.responsibility}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-white">
                              {req.items_description}
                            </p>
                            <div className="flex items-center justify-between text-xs text-slate-400 mt-2 tabular-nums">
                              <span>{req.quotes.length} Cotações Validadas</span>
                              <span className="uppercase font-bold text-emerald-400">
                                {req.status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* TELA INTERMEDIÁRIA CONSULTIVA: AI ADVISOR (NÃO BLOQUEANTE) */}
          {advisor && (
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <TrendingDown className="w-3 h-3" />
                    AI ADVISOR • BENCHMARK HISTÓRICO (CONSULTIVO / NÃO BLOQUEANTE)
                  </span>
                  <p className="text-xs sm:text-sm text-slate-200 font-medium mt-1">
                    {advisor.advisory_message}
                  </p>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-bold">
                      Menor Preço Histórico
                    </span>
                    <span className="text-sm font-bold text-emerald-400 tabular-nums font-mono">
                      {formatBRL(advisor.best_historical_price)} / {advisor.unit}
                    </span>
                  </div>
                  <div className="px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-bold">
                      Média Histórica
                    </span>
                    <span className="text-sm font-bold text-slate-200 tabular-nums font-mono">
                      {formatBRL(advisor.average_historical_price)} / {advisor.unit}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentReq && (
            <div className="space-y-6">
              {/* Matriz de Responsabilidade */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    1. Matriz de Responsabilidade Financeira ({currentReq.map_code} • Categoria:{' '}
                    {currentReq.category})
                  </span>
                </div>
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
                        className={`text-left p-4 rounded-xl border transition-all duration-200 ease-in-out cursor-pointer ${
                          selected
                            ? 'bg-slate-950 border-emerald-500/50'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
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

              {/* Comparativo Lado a Lado dos Orçamentos */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    2. Comparativo Lado a Lado — Cotações da Família {currentReq.category} (
                    {currentReq.quotes.length})
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {currentReq.quotes.map((quote, idx) => {
                    const isWinner = quote.is_winner;
                    return (
                      <div
                        key={quote.id}
                        className={`rounded-xl border p-5 flex flex-col justify-between transition-all duration-200 ease-in-out relative ${
                          isWinner
                            ? 'bg-slate-900 border-emerald-500/60'
                            : 'bg-slate-900 border-slate-800 hover:bg-slate-800/50'
                        }`}
                      >
                        {isWinner && (
                          <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-extrabold uppercase tracking-wide self-start">
                            <Award className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Selo de Recomendação da Engenharia</span>
                          </div>
                        )}

                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] tabular-nums font-mono uppercase text-slate-400">
                                Opção {String.fromCharCode(65 + idx)} •{' '}
                                {quote.category || currentReq.category}
                              </span>
                              <span className="text-[10px] text-emerald-400 font-semibold">
                                ✓ Validado HITL
                              </span>
                            </div>
                            <h3 className="text-base font-bold text-white mt-0.5">
                              {quote.supplier_name}
                            </h3>
                          </div>

                          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400">Preço Unitário:</span>
                              <span className="tabular-nums font-medium text-slate-200">
                                {formatBRL(quote.unit_price)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-400 font-semibold">
                                Valor Global:
                              </span>
                              <span
                                className={`text-lg font-extrabold tabular-nums font-mono ${
                                  isWinner ? 'text-emerald-400' : 'text-white'
                                }`}
                              >
                                {formatBRL(quote.total_amount)}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                              <span className="text-[10px] text-slate-500 block">
                                Prazo de Entrega
                              </span>
                              <span className="font-bold text-slate-200 flex items-center gap-1 mt-0.5 tabular-nums">
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                {quote.delivery_days} dias úteis
                              </span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                              <span className="text-[10px] text-slate-500 block">
                                Condição Pagto
                              </span>
                              <span className="font-bold text-slate-200 block mt-0.5 tabular-nums">
                                {quote.payment_terms}
                              </span>
                            </div>
                          </div>

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
                              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-slate-600"
                            />
                          </div>
                        </div>

                        <div className="mt-5 pt-4 border-t border-slate-800">
                          <button
                            type="button"
                            onClick={() => handleSelectWinner(quote.id)}
                            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-200 ease-in-out cursor-pointer flex items-center justify-center gap-2 ${
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

      {/* =====================================================================
          MODAL OBRIGATÓRIO DE REVISÃO HUMANA (HITL + CATEGORIA DEDUZIDA — P87)
          ===================================================================== */}
      {draftModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-xl bg-slate-900 border border-amber-500/50 p-6 space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  TRAVA HUMAN-IN-THE-LOOP • CATEGORIA DEDUZIDA PELA IA
                </span>
                <h2 className="text-lg font-bold text-white mt-2">
                  Conferência Obrigatória de Valores e Categoria (Curva ABC)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  A IA classificou o insumo na família{' '}
                  <strong className="text-emerald-400">{draftModal.category}</strong> em memória
                  (Draft). Valide ou altere antes de injetar na Matriz.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDraftModal(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmHumanReview} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Fornecedor Identificado *
                  </label>
                  <input
                    type="text"
                    value={draftModal.supplier_name}
                    onChange={(e) =>
                      setDraftModal({ ...draftModal, supplier_name: e.target.value })
                    }
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-400 mb-1">
                    Categoria Deduzida (IA) *
                  </label>
                  <select
                    value={draftModal.category}
                    onChange={(e) =>
                      setDraftModal({ ...draftModal, category: e.target.value })
                    }
                    className="w-full px-3.5 py-2 bg-slate-950 border border-emerald-500/40 rounded-xl text-xs font-bold text-emerald-300"
                  >
                    {ENGINEERING_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        👷 {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Preço Unitário Lido (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={draftModal.unit_price}
                    onChange={(e) =>
                      setDraftModal({ ...draftModal, unit_price: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white tabular-nums font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Valor Total da Proposta (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={draftModal.total_amount}
                    onChange={(e) =>
                      setDraftModal({ ...draftModal, total_amount: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-emerald-400 font-bold tabular-nums font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Prazo de Entrega (Dias Úteis)
                  </label>
                  <input
                    type="number"
                    value={draftModal.delivery_days}
                    onChange={(e) =>
                      setDraftModal({ ...draftModal, delivery_days: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white tabular-nums font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Condição de Pagamento
                  </label>
                  <input
                    type="text"
                    value={draftModal.payment_terms}
                    onChange={(e) =>
                      setDraftModal({ ...draftModal, payment_terms: e.target.value })
                    }
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDraftModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Descartar Leitura
                </button>
                <button
                  type="submit"
                  disabled={isConfirmingHITL}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  {isConfirmingHITL ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Confirmar e Injetar na Matriz ({draftModal.category})</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
