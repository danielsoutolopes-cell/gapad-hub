'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  UploadCloud,
  ShieldAlert,
  TrendingDown,
  Receipt,
  Camera,
  X,
  Layers,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Send,
  Users,
  Search,
} from 'lucide-react';
import { PaywallBlocker } from '@/components/ui/paywall-blocker';
import { createClient } from '@/lib/supabase/client';
import { HelpTooltip } from '@/components/ui/tooltip';

type ResponsibilityType = 'CONSTRUCTOR' | 'CLIENT_DIRECT' | 'CLIENT_REIMBURSEMENT';

const ENGINEERING_CATEGORIES = [
  'ESTRUTURAL',
  'REVESTIMENTOS',
  'ELÉTRICA',
  'HIDRÁULICA',
  'MARCENARIA',
  'CIVIL',
] as const;

interface CategoryCostItem {
  category: string;
  total_spent: number;
  items_count: number;
  percentage: number;
  abc_class: 'A' | 'B' | 'C';
}

interface QuoteItem {
  id: string;
  supplier_name: string;
  unit_price: number;
  total_amount: number;
  delivery_days: number;
  payment_terms: string;
  is_winner: boolean;
  human_verified?: boolean;
  category?: string;
  justification?: string | null;
}

interface PurchaseRequestItem {
  id: string;
  request_number: number;
  sequence_number?: number;
  map_code?: string;
  project_name?: string;
  category: string;
  urgency: string;
  status: string;
  responsibility: ResponsibilityType;
  delivery_deadline?: string | null;
  items_description: string;
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
  justification: string;
  confidence_score: number;
  source: string;
  file_name?: string | null;
}

interface AdvisorData {
  query: string;
  best_historical_price: number;
  average_historical_price: number;
  unit: string;
  best_price_supplier: string;
  advisory_message: string;
  suggested_suppliers: {
    name: string;
    last_unit_price: number;
    avg_delivery_days: number;
    reliability_score: string;
  }[];
}

interface DirectPurchaseItem {
  id: string;
  sequence_number: number;
  direct_code: string;
  description: string;
  supplier_name: string;
  total_amount: number;
  purchase_date: string;
  payment_method: string;
  responsibility: ResponsibilityType;
  receipt_file_name?: string;
}

interface SupplierOption {
  id: string;
  name: string;
  trade_name?: string | null;
  phone?: string | null;
  document?: string | null;
  category?: string | null;
}

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(val || 0)
  );
}

export function SuprimentosClient({ activeModules }: { activeModules: string[] }) {
  const [activeTab, setActiveTab] = useState<
    'concorrencia' | 'requisicoes' | 'comprinhas' | 'custos_abc'
  >('concorrencia');
  const [requests, setRequests] = useState<PurchaseRequestItem[]>([]);
  const [directPurchases, setDirectPurchases] = useState<DirectPurchaseItem[]>([]);
  const [categoryCosts, setCategoryCosts] = useState<CategoryCostItem[]>([]);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [selectedReqId, setSelectedReqId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Prompt 86 & 87: AI Advisor & Omnichannel HITL com Categorização Inteligente
  const [advisor, setAdvisor] = useState<AdvisorData | null>(null);
  const [rawPasteText, setRawPasteText] = useState<string>('');
  const [isParsingAI, setIsParsingAI] = useState<boolean>(false);
  const [draftModal, setDraftModal] = useState<DraftQuoteReview | null>(null);
  const [isConfirmingHITL, setIsConfirmingHITL] = useState<boolean>(false);

  // Prompt 86: Compras Diretas ("Comprinhas")
  const [dpDesc, setDpDesc] = useState<string>('');
  const [dpSupplier, setDpSupplier] = useState<string>('');
  const [dpAmount, setDpAmount] = useState<string>('');
  const [dpResponsibility, setDpResponsibility] = useState<ResponsibilityType>('CONSTRUCTOR');
  const [dpReceiptName, setDpReceiptName] = useState<string>('');

  // Prompt 89: RFQ e Disparo em Lote via WhatsApp
  const [rfqModalReq, setRfqModalReq] = useState<PurchaseRequestItem | null>(null);
  const [availableSuppliers, setAvailableSuppliers] = useState<SupplierOption[]>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [rfqSearchTerm, setRfqSearchTerm] = useState<string>('');
  const [rfqDeadlineDays, setRfqDeadlineDays] = useState<number>(2);
  const [isSendingRfq, setIsSendingRfq] = useState<boolean>(false);

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
      const [resp, dpResp, abcResp, supResp] = await Promise.all([
        fetch('/api/v1/procurement/requests', { headers, cache: 'no-store' }),
        fetch('/api/v1/procurement/direct-purchases', { headers, cache: 'no-store' }),
        fetch('/api/v1/procurement/costs-by-category', { headers, cache: 'no-store' }),
        fetch('/api/v1/suppliers?limit=100', { headers, cache: 'no-store' }).catch(() => null),
      ]);
      if (resp.ok) {
        const data = await resp.json();
        const items: PurchaseRequestItem[] = data.items || [];
        setRequests(items);
        if (items.length > 0 && !selectedReqId) {
          setSelectedReqId(items[0].id);
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
      if (supResp && supResp.ok) {
        const supData = await supResp.json();
        const sups = supData.suppliers || supData.items || [];
        if (Array.isArray(sups) && sups.length > 0) {
          setAvailableSuppliers(
            sups.map((s: any) => ({
              id: s.id,
              name: s.name || s.trade_name || 'Fornecedor',
              trade_name: s.trade_name || s.name,
              phone: s.phone || s.whatsapp || '',
              document: s.document || s.cnpj || '',
              category: s.category || '',
            }))
          );
        } else {
          setAvailableSuppliers([
            { id: 'sup-1', name: 'Distribuidora Telha Norte', trade_name: 'Telhanorte Materiais', phone: '5511999990001', category: 'CIVIL' },
            { id: 'sup-2', name: 'C&C Casa e Construção', trade_name: 'C&C Pro', phone: '5511999990002', category: 'CIVIL' },
            { id: 'sup-3', name: 'Hidráulica Paulista Tubos', trade_name: 'Paulista Tubos', phone: '5511999990003', category: 'HIDRÁULICA' },
            { id: 'sup-4', name: 'Elétrica Santa Ifigênia Materiais', trade_name: 'Santa Ifigênia Cabos', phone: '5511999990004', category: 'ELÉTRICA' },
          ]);
        }
      } else {
        setAvailableSuppliers([
          { id: 'sup-1', name: 'Distribuidora Telha Norte', trade_name: 'Telhanorte Materiais', phone: '5511999990001', category: 'CIVIL' },
          { id: 'sup-2', name: 'C&C Casa e Construção', trade_name: 'C&C Pro', phone: '5511999990002', category: 'CIVIL' },
          { id: 'sup-3', name: 'Hidráulica Paulista Tubos', trade_name: 'Paulista Tubos', phone: '5511999990003', category: 'HIDRÁULICA' },
          { id: 'sup-4', name: 'Elétrica Santa Ifigênia Materiais', trade_name: 'Santa Ifigênia Cabos', phone: '5511999990004', category: 'ELÉTRICA' },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedReqId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentReq = requests.find((r) => r.id === selectedReqId) || requests[0];

  const groupedRequestsByCategory = requests.reduce<
    Record<string, { items: PurchaseRequestItem[]; subtotal: number }>
  >((acc, req) => {
    const cat = (req.category || 'CIVIL').toUpperCase();
    if (!acc[cat]) {
      acc[cat] = { items: [], subtotal: 0 };
    }
    const winner = req.quotes.find((q) => q.is_winner) || req.quotes[0];
    acc[cat].items.push(req);
    acc[cat].subtotal += Number(winner?.total_amount || 0);
    return acc;
  }, {});

  const toggleCategoryAccordion = (cat: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [cat]: prev[cat] === undefined ? false : !prev[cat],
    }));
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

  if (!activeModules.includes('SUPRIMENTOS')) {
    return (
      <PaywallBlocker
        moduleName="Suprimentos & Smart Procurement"
        description="Controle cotações omnichannel com Human-in-the-Loop, AI Advisor de preços históricos e Compras Diretas de canteiro."
      />
    );
  }

  const triggerOmnichannelParse = async (opts: {
    raw_text?: string;
    file_name?: string;
    source: string;
  }) => {
    setFeedback(null);
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
      if (data.draft_quote) {
        setDraftModal(data.draft_quote);
      }
    } catch {
      setFeedback({ type: 'error', text: 'Erro ao processar leitura via IA.' });
    } finally {
      setIsParsingAI(false);
    }
  };

  const handleConfirmHumanReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftModal || !currentReq) return;
    setIsConfirmingHITL(true);
    try {
      const selectedCategory = (draftModal.category || currentReq.category || 'CIVIL').toUpperCase();
      const resp = await fetch(`/api/v1/procurement/requests/${currentReq.id}/quotes/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_name: draftModal.supplier_name,
          category: selectedCategory,
          unit_price: Number(draftModal.unit_price),
          total_amount: Number(draftModal.total_amount),
          delivery_days: Number(draftModal.delivery_days),
          payment_terms: draftModal.payment_terms,
          justification: draftModal.justification,
          is_winner: false,
        }),
      });
      const data = await resp.json();
      const confirmedQuote: QuoteItem = {
        id: data.quote?.id || `q-hitl-${Date.now()}`,
        supplier_name: draftModal.supplier_name,
        category: selectedCategory,
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
          r.id === currentReq.id
            ? { ...r, category: selectedCategory, quotes: [...r.quotes, confirmedQuote] }
            : r
        )
      );
      setDraftModal(null);
      setRawPasteText('');
      setFeedback({ type: 'success', text: data.message });
    } finally {
      setIsConfirmingHITL(false);
    }
  };

  const handleCreateDirectPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dpDesc.trim() || !dpSupplier.trim() || Number(dpAmount) <= 0) return;
    setProcessing('dp');
    try {
      const resp = await fetch('/api/v1/procurement/direct-purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: dpDesc.trim(),
          supplier_name: dpSupplier.trim(),
          total_amount: Number(dpAmount),
          responsibility: dpResponsibility,
          receipt_photo_url: dpReceiptName || 'cupom_fiscal_canteiro.jpg',
          receipt_file_name: dpReceiptName || 'cupom_fiscal_canteiro.jpg',
        }),
      });
      const data = await resp.json();
      if (data.item) {
        setDirectPurchases((prev) => [data.item, ...prev]);
      }
      setDpDesc('');
      setDpSupplier('');
      setDpAmount('');
      setDpReceiptName('');
      setFeedback({ type: 'success', text: data.message });
    } finally {
      setProcessing(null);
    }
  };

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

  const handleOpenRfqModal = (req: PurchaseRequestItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRfqModalReq(req);
    setSelectedSupplierIds([]);
    setRfqDeadlineDays(2);
    setRfqSearchTerm('');
  };

  const handleToggleSupplierSelection = (supplierId: string) => {
    setSelectedSupplierIds((prev) =>
      prev.includes(supplierId) ? prev.filter((id) => id !== supplierId) : [...prev, supplierId]
    );
  };

  const handleSelectAllSuppliers = () => {
    const allFilteredIds = filteredSuppliers.map((s: SupplierOption) => s.id);
    if (selectedSupplierIds.length === allFilteredIds.length) {
      setSelectedSupplierIds([]);
    } else {
      setSelectedSupplierIds(allFilteredIds);
    }
  };

  const handleSendRfqBatch = async () => {
    if (!rfqModalReq || selectedSupplierIds.length === 0) return;
    setIsSendingRfq(true);
    setFeedback(null);
    try {
      const resp = await fetch(`/api/v1/procurement/requests/${rfqModalReq.id}/send-rfq`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_ids: selectedSupplierIds,
          custom_deadline_days: rfqDeadlineDays,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.detail || 'Falha ao disparar solicitação RFQ.');
      }

      const newQuotes: QuoteItem[] = (data.results || []).map((res: any) => ({
        id: res.quote_id || `q-rfq-${Math.random()}`,
        supplier_name: res.supplier_name,
        category: rfqModalReq.category,
        unit_price: 0,
        total_amount: 0,
        delivery_days: rfqDeadlineDays,
        payment_terms: 'Aguardando proposta',
        is_winner: false,
        human_verified: false,
        justification: 'RFQ disparada via WhatsApp. Aguardando retorno da loja.',
      }));

      setRequests((prev) =>
        prev.map((r) =>
          r.id === rfqModalReq.id
            ? {
                ...r,
                status: 'EM_COTACAO',
                quotes: [...r.quotes, ...newQuotes],
              }
            : r
        )
      );

      setFeedback({
        type: 'success',
        text: `Solicitação de cotação (RFQ) enviada para ${selectedSupplierIds.length} fornecedor(es) via WhatsApp!`,
      });
      setRfqModalReq(null);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao disparar RFQ.',
      });
    } finally {
      setIsSendingRfq(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    return availableSuppliers.filter((s) => {
      const term = rfqSearchTerm.toLowerCase();
      const matchName = (s.trade_name || s.name || '').toLowerCase().includes(term);
      const matchDoc = (s.document || '').includes(term);
      const matchCat = (s.category || '').toLowerCase().includes(term);
      return matchName || matchDoc || matchCat;
    });
  }, [availableSuppliers, rfqSearchTerm]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-900 text-slate-300 border border-slate-800">
              Prompt 86 • Smart Procurement (Human-in-the-Loop, AI Advisor & Comprinhas)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Package className="w-7 h-7 text-slate-300" />
            <span>Smart Procurement & Mapas de Cotação</span>
            <HelpTooltip
              title="Regra da Matriz de Cotação & HITL"
              content="Toda cotação lida via IA exige confirmação humana (HITL) antes de entrar na Matriz. Os insumos são agrupados por família (ELÉTRICA, HIDRÁULICA, REVESTIMENTOS, ESTRUTURAL) com subtotais no PDF do cliente e cálculo automático de Curva ABC."
            />
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Mapas sequenciais por obra (<code className="text-slate-300">MAPA-001-LORENA</code>),
            extração omnichannel com trava humana obrigatória, AI Advisor de preços históricos e
            Compras Diretas de canteiro.
          </p>
        </div>

        {currentReq && activeTab === 'concorrencia' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleSendClientMap}
              disabled={processing === 'map'}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-xl text-xs font-bold transition-all duration-200 ease-in-out flex items-center gap-2 cursor-pointer"
            >
              {processing === 'map' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MessageSquare className="w-4 h-4" />
              )}
              <span>Gerar Mapa para Cliente (WhatsApp)</span>
            </button>

            <a
              href={`/api/v1/procurement/requests/${currentReq.id}/quotation-map/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-slate-400" />
              <span>PDF do Mapa</span>
            </a>

            <button
              type="button"
              onClick={handleApproveRequest}
              disabled={processing === 'approve' || currentReq.status === 'aprovado'}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
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
              ? 'bg-slate-900 border-emerald-500/30 text-emerald-300'
              : 'bg-slate-900 border-rose-500/30 text-rose-300'
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
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('concorrencia')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'concorrencia'
              ? 'bg-slate-900 text-white border border-slate-700'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Mapa de Cotação & Omnichannel HITL
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('requisicoes')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'requisicoes'
              ? 'bg-slate-900 text-white border border-slate-700'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>Matriz por Família / Accordions ({requests.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('custos_abc')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'custos_abc'
              ? 'bg-slate-900 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Despesas por Categoria (Curva ABC)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('comprinhas')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'comprinhas'
              ? 'bg-slate-900 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Receipt className="w-3.5 h-3.5 text-amber-400" />
          <span>Compras Diretas / &ldquo;Comprinhas&rdquo; ({directPurchases.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          <span>A carregar Smart Procurement...</span>
        </div>
      ) : activeTab === 'custos_abc' ? (
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>Despesas por Categoria — Curva ABC de Engenharia</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Visão consolidada do peso financeiro de cada família de insumos sobre o custo total de suprimentos.
              </p>
            </div>
            <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-emerald-400 tabular-nums font-mono">
              Total Acumulado:{' '}
              {formatBRL(categoryCosts.reduce((sum, c) => sum + c.total_spent, 0))}
            </span>
          </div>

          <div className="space-y-4">
            {categoryCosts.map((cat) => (
              <div
                key={cat.category}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        cat.abc_class === 'A'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : cat.abc_class === 'B'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      Classe {cat.abc_class}
                    </span>
                    <span className="font-bold text-white">👷 Categoria: {cat.category}</span>
                    <span className="text-slate-500">({cat.items_count} mapas)</span>
                  </div>
                  <div className="flex items-center gap-3 tabular-nums font-mono">
                    <span className="text-slate-400">{cat.percentage.toFixed(1)}%</span>
                    <span className="font-bold text-white">{formatBRL(cat.total_spent)}</span>
                  </div>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full ${
                      cat.abc_class === 'A'
                        ? 'bg-rose-500'
                        : cat.abc_class === 'B'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(6, cat.percentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'comprinhas' ? (
        <div className="space-y-5">
          <form
            onSubmit={handleCreateDirectPurchase}
            className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-4"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Camera className="w-4 h-4 text-amber-400" />
              <span>Nova Compra Direta (&ldquo;Comprinha&rdquo; de Urgência com Recibo)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                value={dpDesc}
                onChange={(e) => setDpDesc(e.target.value)}
                placeholder="Descrição (Ex: Discos de Corte + Buchas)"
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              />
              <input
                type="text"
                value={dpSupplier}
                onChange={(e) => setDpSupplier(e.target.value)}
                placeholder="Loja / Fornecedor"
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              />
              <input
                type="number"
                step="0.01"
                value={dpAmount}
                onChange={(e) => setDpAmount(e.target.value)}
                placeholder="Valor R$"
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white tabular-nums font-mono"
              />
              <select
                value={dpResponsibility}
                onChange={(e) => setDpResponsibility(e.target.value as ResponsibilityType)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              >
                <option value="CONSTRUCTOR">CONSTRUCTOR</option>
                <option value="CLIENT_REIMBURSEMENT">CLIENT_REIMBURSEMENT (Duplo)</option>
                <option value="CLIENT_DIRECT">CLIENT_DIRECT</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 cursor-pointer">
                <Camera className="w-4 h-4 text-amber-400" />
                <span>{dpReceiptName || 'Anexar Recibo Fotográfico (.jpg/.pdf)'}</span>
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
              <button
                type="submit"
                disabled={processing === 'dp'}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Registar Compra Direta
              </button>
            </div>
          </form>

          <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-[11px] font-bold text-slate-400 uppercase">
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Descrição / Fornecedor</th>
                  <th className="py-3 px-4">Responsabilidade</th>
                  <th className="py-3 px-4 text-right">Valor</th>
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
      ) : activeTab === 'requisicoes' ? (
        <div className="space-y-4">
          {Object.entries(groupedRequestsByCategory).map(([cat, group]) => {
            const isOpen = openCategories[cat] ?? true;
            return (
              <div
                key={cat}
                className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleCategoryAccordion(cat)}
                  className="w-full px-5 py-3.5 bg-slate-950/70 hover:bg-slate-900 flex items-center justify-between border-b border-slate-800 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                      👷 Categoria: {cat}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-slate-300 border border-slate-800">
                      {group.items.length} mapas
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white tabular-nums font-mono">
                    Subtotal {cat}:{' '}
                    <span className="text-emerald-400">{formatBRL(group.subtotal)}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="divide-y divide-slate-800">
                    {group.items.map((req, idx) => (
                      <div
                        key={req.id}
                        onClick={() => {
                          setSelectedReqId(req.id);
                          setActiveTab('concorrencia');
                        }}
                        className="cursor-pointer hover:bg-slate-800/50 p-4 sm:p-5 flex items-center justify-between gap-4 transition-all duration-200 ease-in-out"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="tabular-nums font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              {req.map_code || `MAPA-${String(idx + 1).padStart(3, '0')}-LORENA`}
                            </span>
                            <span className="text-xs font-bold text-white">
                              {req.items_description}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />{' '}
                              {req.project_name || 'Residencial Jardins Lorena'}
                            </span>
                            <span>•</span>
                            <span>Responsabilidade: {req.responsibility}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={(e) => handleOpenRfqModal(req, e)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Solicitar Cotação</span>
                          </button>
                          <span className="px-3 py-1 rounded-full text-xs font-bold tabular-nums bg-slate-800 text-slate-300 border border-slate-700">
                            {req.quotes.length} Cotações Validadas
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        currentReq && (
          <div className="space-y-5">
            {/* AI Advisor Consultivo (Não Bloqueante) */}
            {advisor && (
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-400">
                    <TrendingDown className="w-3.5 h-3.5" />
                    AI Advisor • Melhor Preço Histórico (Consultivo / Não Bloqueante)
                  </span>
                  <p className="text-xs text-slate-200 mt-1">{advisor.advisory_message}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-right">
                    <span className="text-[10px] text-slate-400 block">Menor Histórico</span>
                    <span className="text-xs font-bold text-emerald-400 tabular-nums font-mono">
                      {formatBRL(advisor.best_historical_price)}/{advisor.unit}
                    </span>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-right">
                    <span className="text-[10px] text-slate-400 block">Média</span>
                    <span className="text-xs font-bold text-slate-200 tabular-nums font-mono">
                      {formatBRL(advisor.average_historical_price)}/{advisor.unit}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Importação Omnichannel via IA com Trava Human-in-the-Loop */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              <div className="flex-1">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4 text-emerald-400" />
                  <span>Importar Cotação (Drag-and-Drop PDF/Foto ou Colar WhatsApp)</span>
                </span>
                <input
                  type="text"
                  value={rawPasteText}
                  onChange={(e) => setRawPasteText(e.target.value)}
                  placeholder="Cole o texto do WhatsApp ou selecione um PDF/Imagem para abrir o Modal de Revisão Humana..."
                  className="mt-2 w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer">
                  <span>Upload PDF/Foto</span>
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
                <button
                  type="button"
                  disabled={isParsingAI}
                  onClick={() =>
                    triggerOmnichannelParse({
                      raw_text:
                        rawPasteText.trim() ||
                        'Saint-Gobain Distribuição | Unitário R$ 175,00 | Total R$ 31.500,00 | 4 dias úteis',
                      source: 'WHATSAPP_TEXT_PASTE',
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  {isParsingAI ? 'A ler...' : 'Ler com IA (Revisão HITL)'}
                </button>
              </div>
            </div>

            {/* Seletor de Matriz de Responsabilidade */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 tabular-nums font-mono block">
                  {currentReq.map_code || 'MAPA-001-LORENA'} • REQ #{currentReq.request_number}
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
                      ? 'bg-slate-800 text-white border-slate-600'
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

            {/* Cotações Lado a Lado */}
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
                        <span className="tabular-nums font-medium text-white">
                          {formatBRL(q.unit_price)}
                        </span>
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
                        <span className="text-white tabular-nums font-medium">
                          {q.payment_terms}
                        </span>
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

      {/* Modal Obrigatório de Revisão Humana (HITL) */}
      {draftModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-slate-900 border border-amber-500/50 p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <ShieldAlert className="w-3 h-3" />
                  REVISÃO HUMANA OBRIGATÓRIA (HITL)
                </span>
                <h3 className="text-base font-bold text-white mt-1.5">
                  Conferir Valores Extraídos pela IA
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDraftModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmHumanReview} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Fornecedor</label>
                  <input
                    type="text"
                    value={draftModal.supplier_name}
                    onChange={(e) =>
                      setDraftModal({ ...draftModal, supplier_name: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-emerald-400 font-semibold mb-1">
                    Categoria Deduzida (IA)
                  </label>
                  <select
                    value={(draftModal.category || currentReq?.category || 'CIVIL').toUpperCase()}
                    onChange={(e) =>
                      setDraftModal({ ...draftModal, category: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/40 rounded-xl text-emerald-300 font-bold"
                  >
                    {ENGINEERING_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Preço Unitário (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={draftModal.unit_price}
                    onChange={(e) =>
                      setDraftModal({ ...draftModal, unit_price: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white tabular-nums font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Valor Total (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={draftModal.total_amount}
                    onChange={(e) =>
                      setDraftModal({ ...draftModal, total_amount: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-bold tabular-nums font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDraftModal(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isConfirmingHITL}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer"
                >
                  Confirmar e Injetar na Matriz
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROMPT 89: MODAL DE SELEÇÃO E DISPARO EM LOTE DE RFQ VIA WHATSAPP */}
      {rfqModalReq && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  Solicitar Cotação (RFQ WhatsApp em Lote)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRfqModalReq(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cabeçalho do Insumo Requisitado */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Insumo / Requisição ({rfqModalReq.category || 'CIVIL'})
              </span>
              <p className="text-xs text-slate-200 line-clamp-2">{rfqModalReq.items_description}</p>
            </div>

            {/* Configuração de Prazo e Busca */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={rfqSearchTerm}
                  onChange={(e) => setRfqSearchTerm(e.target.value)}
                  placeholder="Buscar fornecedor por nome, categoria ou CNPJ..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700"
                />
              </div>
              <div>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={rfqDeadlineDays}
                  onChange={(e) => setRfqDeadlineDays(Number(e.target.value) || 2)}
                  placeholder="Prazo (Dias Úteis)"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700"
                />
              </div>
            </div>

            {/* Lista com Seleção Múltipla */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold">
                  Fornecedores Homologados ({filteredSuppliers.length})
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllSuppliers}
                  className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors cursor-pointer"
                >
                  {selectedSupplierIds.length === filteredSuppliers.length
                    ? 'Desmarcar Todos'
                    : 'Selecionar Todos'}
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {filteredSuppliers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                    Nenhum fornecedor encontrado para o filtro informado.
                  </div>
                ) : (
                  filteredSuppliers.map((sup: SupplierOption) => {
                    const isSelected = selectedSupplierIds.includes(sup.id);
                    return (
                      <div
                        key={sup.id}
                        onClick={() => handleToggleSupplierSelection(sup.id)}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all duration-150 ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/40'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-bold text-white block">
                              {sup.trade_name || sup.name}
                            </span>
                            <span className="text-[11px] text-slate-400 flex items-center gap-2">
                              <span>WhatsApp: {sup.phone || 'Cadastrar telefone'}</span>
                              {sup.category && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-400">{sup.category}</span>
                                </>
                              )}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isSelected
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          {isSelected ? 'Selecionado' : 'Disponível'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <span className="text-xs text-slate-400">
                <strong className="text-white">{selectedSupplierIds.length}</strong> fornecedor(es) selecionado(s)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRfqModalReq(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={selectedSupplierIds.length === 0 || isSendingRfq}
                  onClick={handleSendRfqBatch}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs cursor-pointer transition-all shadow-md shadow-emerald-500/20"
                >
                  {isSendingRfq ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Disparando WhatsApp...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Disparar RFQ para {selectedSupplierIds.length} Fornecedores</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
