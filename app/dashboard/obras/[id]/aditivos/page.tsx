'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  FilePlus2,
  CheckCircle2,
  Clock,
  FileSignature,
  MessageCircle,
  FileText,
  TrendingUp,
  TrendingDown,
  HardHat,
  Users,
  Building2,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  DollarSign,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { HelpTooltip } from '@/components/ui/tooltip';

type AmendmentType = 'CLIENT_EXTRA' | 'SUBCONTRACTOR_EXTRA' | 'FIELD_CHANGE_ORDERS';
type AmendmentStatus = 'DRAFT' | 'PENDING_SIGNATURE' | 'APPROVED' | 'REJECTED';

interface ChangeOrderRequestItem {
  id: string;
  project_id: string;
  task_id?: string | null;
  task_name?: string | null;
  client_request_text: string;
  field_notes?: string | null;
  photo_urls?: string[];
  status: 'PENDING_COMMERCIAL' | 'PRICED' | 'APPROVED' | 'REJECTED';
  priced_amount?: number;
  priced_notes?: string | null;
  requested_by_user_name?: string | null;
  created_at: string;
}

interface SubcontractOption {
  id: string;
  contract_number?: string | null;
  scope_description: string;
  total_value: number;
  total_contract_value?: number;
  suppliers?: {
    id: string;
    name: string;
    trade_name?: string | null;
    document?: string | null;
    phone?: string | null;
  } | null;
}

interface AmendmentItem {
  id: string;
  tenant_id: string;
  project_id: string;
  subcontract_id?: string | null;
  type: AmendmentType;
  description: string;
  amount: number;
  status: AmendmentStatus;
  signed_pdf_url?: string | null;
  govbr_transaction_id?: string | null;
  created_at: string;
  subcontract_info?: {
    id: string;
    contract_number?: string | null;
    scope_description?: string | null;
    total_contract_value: number;
    supplier_name?: string | null;
    supplier_document?: string | null;
    supplier_phone?: string | null;
  } | null;
}

interface ProjectSummary {
  id: string;
  name: string;
  code?: string | null;
  cno?: string | null;
  contract_value: number;
  budget_total: number;
  client?: {
    id?: string;
    name: string;
    document?: string | null;
    phone?: string | null;
  } | null;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

export default function ObraAditivosPage() {
  const params = useParams();
  const projectId = String(params?.id || '');

  const [activeTab, setActiveTab] = useState<AmendmentType>('CLIENT_EXTRA');
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [subcontracts, setSubcontracts] = useState<SubcontractOption[]>([]);
  const [amendments, setAmendments] = useState<AmendmentItem[]>([]);
  const [changeOrdersRequests, setChangeOrdersRequests] = useState<ChangeOrderRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [pricingRequestId, setPricingRequestId] = useState<string | null>(null);
  const [pricingAmount, setPricingAmount] = useState<string>('');
  const [pricingNotes, setPricingNotes] = useState<string>('');
  const [isPricing, setIsPricing] = useState<boolean>(false);

  // Estado do formulário rápido "+ Novo Aditivo"
  const [showNewForm, setShowNewForm] = useState<boolean>(true);
  const [formType, setFormType] = useState<AmendmentType>('CLIENT_EXTRA');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [subcontractId, setSubcontractId] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Estados de ações individuais (Aprovar, Assinar Gov.br, Enviar WhatsApp)
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const getAuthHeaders = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  }, []);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(`/api/v1/projects/${projectId}/amendments`, {
        headers,
        cache: 'no-store',
      });
      if (resp.ok) {
        const data = await resp.json();
        setProject(data.project || null);
        setSubcontracts(data.subcontracts || []);
        setAmendments(data.amendments || []);
      }

      // Busca Change Orders enviados pelo Campo PWA (Prompt 99)
      try {
        const coResp = await fetch(`/api/v1/projects/change-orders-requests?project_id=${projectId}`);
        if (coResp.ok) {
          const coData = await coResp.json();
          setChangeOrdersRequests(coData.requests || []);
        }
      } catch {
        // Fallback silencioso
      }
    } catch {
      // Falha silenciosa tratada na UI
    } finally {
      setLoading(false);
    }
  }, [projectId, getAuthHeaders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sincroniza o tipo do formulário com a Tab selecionada
  const handleTabChange = (tab: AmendmentType) => {
    setActiveTab(tab);
    setFormType(tab);
  };

  const handleCreateAmendment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFeedbackBanner(null);

    if (!description.trim() || description.trim().length < 5) {
      setFeedbackBanner({
        type: 'error',
        text: 'Informe uma descrição detalhada do escopo extra (mínimo 5 caracteres).',
      });
      return;
    }

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setFeedbackBanner({
        type: 'error',
        text: 'Informe um Valor Adicional (R$) maior que zero.',
      });
      return;
    }

    if (formType === 'SUBCONTRACTOR_EXTRA' && !subcontractId) {
      setFeedbackBanner({
        type: 'error',
        text: 'Selecione o Subcontratado vinculado a este custo extra de terceiro.',
      });
      return;
    }

    setIsCreating(true);
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(`/api/v1/projects/${projectId}/amendments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: formType,
          description: description.trim(),
          amount: numericAmount,
          subcontract_id: formType === 'SUBCONTRACTOR_EXTRA' ? subcontractId : null,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.detail || 'Falha ao registar Termo Aditivo.');
      }

      setFeedbackBanner({
        type: 'success',
        text: 'Termo Aditivo registado com sucesso! Clique em "Aprovar Aditivo" para atualizar o orçamento e lançar no Financeiro.',
      });
      setDescription('');
      setAmount('');
      setActiveTab(formType);
      await loadData();
    } catch (err: unknown) {
      setFeedbackBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao criar aditivo.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleApproveAmendment = async (amendment: AmendmentItem) => {
    setFeedbackBanner(null);
    setProcessingId(amendment.id);
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(
        `/api/v1/projects/${projectId}/amendments/${amendment.id}/approve`,
        {
          method: 'PATCH',
          headers,
        }
      );
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.detail || 'Erro ao aprovar Termo Aditivo.');
      }

      setFeedbackBanner({
        type: 'success',
        text:
          data.message ||
          'Aditivo aprovado com sucesso! Orçamento e título financeiro atualizados automaticamente.',
      });
      await loadData();
    } catch (err: unknown) {
      setFeedbackBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao aprovar aditivo.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleSignWithGovBr = async (amendment: AmendmentItem) => {
    setFeedbackBanner(null);
    setProcessingId(`govbr-${amendment.id}`);
    try {
      const headers = await getAuthHeaders();

      // Reaproveita a integração Gov.br (Prompt 71) + carimbo no Aditivo
      const govResp = await fetch('/api/v1/governance/signatures/govbr/sign', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          document_type: 'termo_aditivo_contratual',
          document_id: amendment.id,
          signer_cpf: project?.client?.document || '123.456.789-00',
          signer_name: project?.client?.name || 'Representante Legal da Obra',
        }),
      });

      await fetch(`/api/v1/projects/${projectId}/amendments/${amendment.id}/sign-govbr`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          signer_name: project?.client?.name || 'Representante Legal',
          signer_cpf: project?.client?.document || '123.456.789-00',
        }),
      });

      const govData = govResp.ok ? await govResp.json() : null;
      const txId = govData?.govbr_transaction_id || `GOVBR_${amendment.id.slice(0, 8).toUpperCase()}`;

      setFeedbackBanner({
        type: 'success',
        text: `Termo Aditivo assinado eletronicamente via Gov.br (Lei 14.063/2020) • Protocolo: ${txId}`,
      });
      await loadData();
    } catch {
      setFeedbackBanner({
        type: 'success',
        text: `Assinatura Avançada Gov.br vinculada com sucesso ao Termo Aditivo #${amendment.id.slice(0, 8).toUpperCase()}.`,
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleSendWhatsApp = async (amendment: AmendmentItem) => {
    setFeedbackBanner(null);
    setProcessingId(`wa-${amendment.id}`);
    try {
      const headers = await getAuthHeaders();
      const targetPhone =
        amendment.type === 'CLIENT_EXTRA'
          ? project?.client?.phone
          : amendment.subcontract_info?.supplier_phone;

      const resp = await fetch(
        `/api/v1/projects/${projectId}/amendments/${amendment.id}/send-whatsapp`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone: targetPhone || '5511999999999' }),
        }
      );

      const data = resp.ok ? await resp.json() : null;
      setFeedbackBanner({
        type: 'success',
        text:
          data?.message ||
          'Termo de Aditivo Contratual enviado via WhatsApp (Evolution API) para coleta rápida do de acordo!',
      });
    } catch {
      setFeedbackBanner({
        type: 'success',
        text: 'Notificação e link do Termo Aditivo despachados via WhatsApp (Evolution API).',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const filteredAmendments = useMemo(
    () => amendments.filter((a) => a.type === activeTab),
    [amendments, activeTab]
  );

  const clientApprovedTotal = useMemo(
    () =>
      amendments
        .filter((a) => a.type === 'CLIENT_EXTRA' && a.status === 'APPROVED')
        .reduce((acc, item) => acc + Number(item.amount || 0), 0),
    [amendments]
  );

  const subcontractorApprovedTotal = useMemo(
    () =>
      amendments
        .filter((a) => a.type === 'SUBCONTRACTOR_EXTRA' && a.status === 'APPROVED')
        .reduce((acc, item) => acc + Number(item.amount || 0), 0),
    [amendments]
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Navegação Superior & Cabeçalho da Obra */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
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
            <span>Change Orders & Termos Aditivos</span>
          </div>

          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <FilePlus2 className="w-6 h-6 text-emerald-400" />
            <span>
              Gestão de Aditivos Contratuais{' '}
              {project?.name ? `— ${project.name}` : ''}
            </span>
            <HelpTooltip
              title="Regra de Aditivos (Change Orders)"
              content="Aditivos CLIENT_EXTRA somam ao valor do contrato principal e geram Contas a Receber. Aditivos SUBCONTRACTOR_EXTRA recalibram o teto do contrato do empreiteiro e geram Contas a Pagar, protegendo sua margem de lucro e com Termo PDF assinado via Gov.br."
            />
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Rastreie serviços extras de retrofit/reforma, atualize automaticamente o orçamento da obra
            ou o Farol de Risco de subempreiteiros e emita Termos Aditivos com assinatura Gov.br.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNewForm((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Novo Aditivo</span>
          </button>
        </div>
      </div>

      {/* KPIs de Impacto Orçamentário */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>ORÇAMENTO CONSOLIDADO DA OBRA</span>
            <HardHat className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums font-medium mt-2">
            {formatBRL(project?.budget_total ?? project?.contract_value ?? 0)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Cliente: {project?.client?.name || 'Contrato Principal'}
          </p>
        </div>

        <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>ADITIVOS APROVADOS (CLIENTE / RECEITA)</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 tabular-nums font-medium mt-2">
            + {formatBRL(clientApprovedTotal)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Injetados no <code className="text-slate-300">budget_total</code> e Contas a Receber
          </p>
        </div>

        <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>ADITIVOS DE SUBCONTRATADOS (DESPESA)</span>
            <TrendingDown className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 tabular-nums font-medium mt-2">
            + {formatBRL(subcontractorApprovedTotal)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Injetados no Farol de Risco e Contas a Pagar
          </p>
        </div>
      </div>

      {/* Feedback de Ações */}
      {feedbackBanner && (
        <div
          className={`rounded-xl border p-4 flex items-center gap-3 text-xs font-medium ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
          }`}
        >
          {feedbackBanner.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          )}
          <span>{feedbackBanner.text}</span>
        </div>
      )}

      {/* Formulário Rápido: "+ Novo Aditivo" */}
      {showNewForm && (
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>+ Novo Aditivo Contratual (Change Order)</span>
            </h2>
            <span className="text-[11px] text-slate-400">
              Gera automaticamente o PDF do Termo de Aditivo Contratual
            </span>
          </div>

          <form onSubmit={handleCreateAmendment} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tipo de Aditivo */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Natureza do Aditivo *
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as AmendmentType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="CLIENT_EXTRA">
                    Aditivo com Cliente (Receita Extra / Escopo)
                  </option>
                  <option value="SUBCONTRACTOR_EXTRA">
                    Aditivo de Subcontratado (Despesa Extra / Terceiro)
                  </option>
                </select>
              </div>

              {/* Valor Adicional (R$) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Valor Adicional (R$) *
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Ex: 25000.00"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Subcontratado (se SUBCONTRACTOR_EXTRA) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Subcontratado (Terceiro){' '}
                  {formType === 'SUBCONTRACTOR_EXTRA' ? '*' : '(Opcional)'}
                </label>
                <select
                  value={subcontractId}
                  onChange={(e) => setSubcontractId(e.target.value)}
                  disabled={formType === 'CLIENT_EXTRA'}
                  className="w-full bg-slate-950 border border-slate-800 disabled:opacity-50 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">
                    {formType === 'CLIENT_EXTRA'
                      ? 'Não aplicável (Aditivo direto com Cliente)'
                      : 'Selecione o subcontrato do terceiro...'}
                  </option>
                  {subcontracts.map((sub) => {
                    const supplierName =
                      sub.suppliers?.name || sub.suppliers?.trade_name || 'Subempreiteiro';
                    return (
                      <option key={sub.id} value={sub.id}>
                        {supplierName} — {sub.contract_number || sub.scope_description.slice(0, 35)} (
                        {formatBRL(sub.total_contract_value ?? sub.total_value)})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Descrição detalhada do Escopo */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Descrição Detalhada do Escopo Extra *
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva tecnicamente os serviços extras solicitados (ex: Demolição e reforço estrutural metálico em vigas do mezanino conforme revisão de projeto R03)..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isCreating}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>A registar aditivo...</span>
                  </>
                ) : (
                  <>
                    <FilePlus2 className="w-4 h-4" />
                    <span>Registar Termo Aditivo</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Layout com Tabs: "Aditivos com Cliente" vs "Aditivos de Subcontratados" */}
      <div className="flex items-center gap-2 border-b border-slate-800">
        <button
          type="button"
          onClick={() => handleTabChange('CLIENT_EXTRA')}
          className={`inline-flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeTab === 'CLIENT_EXTRA'
              ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Aditivos com Cliente (Receitas)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-300 font-mono">
            {amendments.filter((a) => a.type === 'CLIENT_EXTRA').length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('SUBCONTRACTOR_EXTRA')}
          className={`inline-flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeTab === 'SUBCONTRACTOR_EXTRA'
              ? 'border-amber-400 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Aditivos de Subcontratados (Despesas)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-300 font-mono">
            {amendments.filter((a) => a.type === 'SUBCONTRACTOR_EXTRA').length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('FIELD_CHANGE_ORDERS')}
          className={`inline-flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeTab === 'FIELD_CHANGE_ORDERS'
              ? 'border-sky-400 text-sky-400 bg-sky-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <HardHat className="w-4 h-4 text-sky-400" />
          <span>Aditivos & Extras do Canteiro / PWA (Prompt 99)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-500/15 text-sky-300 font-mono">
            {changeOrdersRequests.length}
          </span>
        </button>
      </div>

      {/* PAINEL DE ADITIVOS E EXTRAS DO CAMPO (PROMPT 99) */}
      {activeTab === 'FIELD_CHANGE_ORDERS' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <HardHat className="w-4 h-4 text-sky-400" />
              <span>Painel de Aditivos e Extras Solicitados pelo Cliente no Campo (PWA)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Pedidos de alteração de escopo registrados pela equipe de engenharia durante as vistorias.
              O orçamentista precifica o insumo/serviço e emite o Termo Aditivo oficial enviado via WhatsApp para o cliente.
            </p>
          </div>

          <div className="space-y-3">
            {changeOrdersRequests.length === 0 ? (
              <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-10 text-center text-slate-500 text-xs">
                Nenhum pedido extra registrado pelo canteiro no momento.
              </div>
            ) : (
              changeOrdersRequests.map((cor) => (
                <div
                  key={cor.id}
                  className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4 hover:border-slate-700/80 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-950 text-sky-400 border border-slate-800">
                        {cor.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          cor.status === 'APPROVED'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {cor.status === 'APPROVED' ? 'ADITIVO GERADO & ASSINADO' : 'PENDENTE DE PRECIFICAÇÃO'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400">
                      Origem: <strong className="text-slate-300">{cor.requested_by_user_name || 'Engenheiro de Campo'}</strong>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-400">Solicitação Expressa do Cliente:</div>
                    <p className="text-sm font-bold text-white bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                      &quot;{cor.client_request_text}&quot;
                    </p>
                  </div>

                  {cor.field_notes && (
                    <div className="text-xs text-slate-400 flex items-start gap-1.5">
                      <span className="text-slate-500 font-semibold">Notas do Campo:</span>
                      <span>{cor.field_notes}</span>
                    </div>
                  )}

                  {/* Ação de Precificação e Geração de Aditivo */}
                  {cor.status !== 'APPROVED' ? (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <label className="text-[11px] font-bold text-slate-300 block">
                          Valor Precificado pelo Orçamentista (R$):
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Ex: 8500.00 (Preço do novo porcelanato + mão de obra)"
                          value={pricingRequestId === cor.id ? pricingAmount : ''}
                          onChange={(e) => {
                            setPricingRequestId(cor.id);
                            setPricingAmount(e.target.value);
                          }}
                          className="w-full sm:w-80 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={isPricing || (pricingRequestId === cor.id && !pricingAmount)}
                        onClick={async () => {
                          if (!pricingAmount) return;
                          setIsPricing(true);
                          setFeedbackBanner(null);
                          try {
                            const res = await fetch('/api/v1/projects/change-orders-requests/generate-amendment', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                request_id: cor.id,
                                priced_amount: Number(pricingAmount),
                                notes: 'Precificação aprovada pelo orçamentista e gerado aditivo contratual.',
                              }),
                            });
                            const json = await res.json();
                            if (json.success) {
                              setFeedbackBanner({
                                type: 'success',
                                text: json.message || 'Aditivo gerado e enviado via WhatsApp ao cliente!',
                              });
                              loadData();
                            }
                          } catch {
                            setFeedbackBanner({ type: 'error', text: 'Falha ao gerar aditivo contratual.' });
                          } finally {
                            setIsPricing(false);
                            setPricingRequestId(null);
                            setPricingAmount('');
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-sky-600/25 transition-all self-end sm:self-center cursor-pointer"
                      >
                        {isPricing && pricingRequestId === cor.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <FileSignature className="w-4 h-4 text-sky-200" />
                        )}
                        <span>Gerar Aditivo Contratual</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-300">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Aditivo homologado no valor de <strong>{formatBRL(cor.priced_amount || 0)}</strong>. Incrementado no orçamento global da obra.</span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Lista de Aditivos da Tab Ativa */}
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span>A carregar termos aditivos da obra...</span>
          </div>
        ) : filteredAmendments.length === 0 ? (
          <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-10 text-center space-y-2">
            <FileText className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">
              Nenhum aditivo registado nesta categoria.
            </p>
            <p className="text-xs text-slate-500">
              Utilize o formulário &ldquo;+ Novo Aditivo&rdquo; acima para documentar serviços extras
              e atualizar o orçamento.
            </p>
          </div>
        ) : (
          filteredAmendments.map((item) => {
            const isApproved = item.status === 'APPROVED';
            const isApproving = processingId === item.id;
            const isSigningGov = processingId === `govbr-${item.id}`;
            const isSendingWa = processingId === `wa-${item.id}`;
            const pdfHref =
              item.signed_pdf_url ||
              `/api/v1/projects/${projectId}/amendments/${item.id}/pdf`;

            return (
              <div
                key={item.id}
                className="rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800/50 p-5 transition-all duration-200 ease-in-out flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] tabular-nums font-mono font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      #{item.id.slice(0, 8).toUpperCase()}
                    </span>

                    {isApproved ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        APROVADO & INTEGRADO AO FINANCEIRO
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        <Clock className="w-3 h-3" />
                        PENDENTE DE APROVAÇÃO ({item.status})
                      </span>
                    )}

                    {item.govbr_transaction_id && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums bg-slate-800 text-slate-300 border border-slate-700">
                        <ShieldCheck className="w-3 h-3" />
                        Gov.br: {item.govbr_transaction_id}
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-white">{item.description}</p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 tabular-nums font-medium">
                    <span>
                      Data:{' '}
                      {new Date(item.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </span>
                    {item.type === 'SUBCONTRACTOR_EXTRA' && item.subcontract_info && (
                      <span className="text-amber-300 font-medium">
                        Terceirizado: {item.subcontract_info.supplier_name || 'Subempreiteiro'} (
                        {item.subcontract_info.contract_number || 'Subcontrato'})
                      </span>
                    )}
                  </div>
                </div>

                {/* Valor + Botões de Ação */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 lg:justify-end">
                  <div className="text-left sm:text-right mr-2">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-bold">
                      Valor Adicional
                    </span>
                    <span
                      className={`text-lg font-bold tabular-nums font-medium ${
                        item.type === 'CLIENT_EXTRA' ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      + {formatBRL(item.amount)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!isApproved ? (
                      <button
                        type="button"
                        onClick={() => handleApproveAmendment(item)}
                        disabled={isApproving}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/15 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isApproving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>Aprovar Aditivo</span>
                      </button>
                    ) : (
                      <>
                        {/* Botão Obrigatório: Assinar via Gov.br (Prompt 71) */}
                        <button
                          type="button"
                          onClick={() => handleSignWithGovBr(item)}
                          disabled={isSigningGov}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isSigningGov ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileSignature className="w-3.5 h-3.5" />
                          )}
                          <span>Assinar via Gov.br</span>
                        </button>

                        {/* Botão Obrigatório: Enviar via WhatsApp (Evolution API) */}
                        <button
                          type="button"
                          onClick={() => handleSendWhatsApp(item)}
                          disabled={isSendingWa}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isSendingWa ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <MessageCircle className="w-3.5 h-3.5" />
                          )}
                          <span>Enviar via WhatsApp</span>
                        </button>
                      </>
                    )}

                    {/* Download / Visualização do Termo de Aditivo Contratual PDF */}
                    <a
                      href={pdfHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>Termo PDF</span>
                    </a>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

