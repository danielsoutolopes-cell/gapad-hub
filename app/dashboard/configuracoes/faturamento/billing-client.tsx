'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  Sparkles,
  ShieldCheck,
  Clock,
  Gift,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Layers,
  ArrowRight,
  Flame,
  BadgePercent,
  Check,
} from 'lucide-react';
import { renewCompanyBenefitAction } from '@/app/actions/billing';

interface BillingCompany {
  id: string;
  trade_name: string;
  legal_name: string;
  cnpj: string;
  plan_status: string;
  trial_ends_at?: string;
  discount_expires_at?: string;
  renewal_count: number;
  max_renewals: number;
  metadata_json?: {
    tier?: string;
    is_founder?: boolean;
    billing_discount_rate?: number;
    technical_contact_email?: string;
  };
}

interface BillingClientProps {
  company: BillingCompany | null;
  userEmail: string | null;
}

export function BillingClient({ company, userEmail }: BillingClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isMasterTenant = company?.metadata_json?.tier === 'master_tenant' || company?.metadata_json?.is_founder === true;
  const renewalCount = company?.renewal_count || 0;
  const maxRenewals = company?.max_renewals || 1;
  const canRenew = renewalCount < maxRenewals;

  const handleRenew = async () => {
    if (!canRenew) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await renewCompanyBenefitAction();
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || 'Benefício de 50% prorrogado por mais 6 meses com sucesso!',
        });
        router.refresh();
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Não foi possível prorrogar o benefício.',
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Falha de comunicação com o servidor de faturamento.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header do Painel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <CreditCard className="w-7 h-7 text-emerald-400" />
              Faturamento & Gestão de Assinatura (Billing)
            </h1>
            {isMasterTenant && (
              <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" /> Master Tenant
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Acompanhe a vigência do seu benefício comercial PLG, renove descontos e veja o histórico da conta.
          </p>
        </div>

        <Link
          href="/onboarding/planos"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors self-start sm:self-auto"
        >
          <span>Visualizar Planos & Módulos</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Alerta de Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs underline opacity-80 hover:opacity-100">
            Fechar
          </button>
        </div>
      )}

      {/* Card Principal de Status e Benefício */}
      <div className="bg-gradient-to-br from-slate-900/90 to-[#0e1628] border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10 items-center">
          {/* Informações da Empresa e Vigência (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Plano: {company?.plan_status || 'TRIAL'}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                CNPJ: {company?.cnpj || 'Não informado'}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white">
              {company?.trade_name || 'Empresa Padrão'}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {isMasterTenant ? (
                <>
                  Esta conta pertence a uma das <strong>Empresas Fundadoras do GADAP Hub</strong>. Você possui
                  isenção de 100% em todos os módulos e direito de até 3 renovações com isenção total.
                </>
              ) : (
                <>
                  Regra Comercial Vigente: <strong>6 meses 100% gratuitos</strong> nos módulos Core + Fiscal e{' '}
                  <strong>50% de desconto</strong> nos Módulos Extras (RH, Suprimentos e CRM).
                </>
              )}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5 uppercase font-bold tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" /> Vencimento do Trial / Isenção
                </span>
                <span className="text-base font-bold text-white mt-1 block">
                  {company?.trial_ends_at
                    ? new Date(company.trial_ends_at).toLocaleDateString('pt-BR')
                    : '6 meses a partir da criação'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5 uppercase font-bold tracking-wider">
                  <Gift className="w-3.5 h-3.5 text-teal-400" /> Prorrogações Realizadas
                </span>
                <span className="text-base font-bold text-white mt-1 block">
                  {renewalCount} de {maxRenewals} permitidas
                </span>
              </div>
            </div>

            {company?.metadata_json?.technical_contact_email && (
              <div className="text-xs text-slate-400 pt-1">
                Contato técnico central: <strong className="text-slate-200">{company.metadata_json.technical_contact_email}</strong>
              </div>
            )}
          </div>

          {/* Card de Ação: Renovar Benefício (5 cols) */}
          <div className="lg:col-span-5 bg-slate-950/80 border border-slate-800 p-6 rounded-3xl space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BadgePercent className="w-4 h-4 text-emerald-400" /> Benefício PLG
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                  {isMasterTenant ? '100% OFF' : '50% OFF'}
                </span>
              </div>

              <h3 className="text-base font-bold text-white mt-3">
                Prorrogar Benefício Comercial
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {isMasterTenant
                  ? 'Prorrogue por mais 6 meses a isenção total (100% OFF) em todo o ecossistema.'
                  : 'Prorrogue por mais 6 meses adicionais com 50% de desconto em todo o ecossistema.'}
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleRenew}
                disabled={!canRenew || loading}
                className={`w-full py-3.5 px-4 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xl ${
                  canRenew
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {loading
                    ? 'Processando prorrogação...'
                    : canRenew
                    ? isMasterTenant
                      ? 'Renovar Benefício (+6 Meses 100% OFF)'
                      : 'Renovar Benefício (+6 Meses 50% OFF)'
                    : 'Limite de Prorrogações Atingido'}
                </span>
              </button>

              <p className="text-[11px] text-slate-500 text-center">
                {canRenew
                  ? `Você ainda tem ${maxRenewals - renewalCount} prorrogações disponíveis nesta conta.`
                  : 'Você já utilizou o limite máximo de renovações comerciais para esta conta.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Módulos Inclusos */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-emerald-400" />
          Módulos do Sistema & Status de Habilitação
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-white">Módulos Core & Engenharia</h4>
              <p className="text-[11px] text-slate-400">Obras, Orçamentos BDI, Markup SINAPI e Medições Físico-Financeiras.</p>
              <span className="text-[10px] text-emerald-400 font-bold mt-1 inline-block">100% Gratuito (Isenção Ativa)</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-white">Módulo Fiscal & Tributário</h4>
              <p className="text-[11px] text-slate-400">NFS-e, NF-e, Leitura DFe de XMLs e Simulador de Reforma Tributária.</p>
              <span className="text-[10px] text-emerald-400 font-bold mt-1 inline-block">100% Gratuito (Isenção Ativa)</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-white">RH & Canteiro de Obras</h4>
              <p className="text-[11px] text-slate-400">Apontamento de equipes e segurança de trabalho.</p>
              <span className="text-[10px] text-teal-400 font-bold mt-1 inline-block">{isMasterTenant ? '100% OFF (Master)' : '50% OFF Ativo'}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-white">Suprimentos & CRM Pós-Obra</h4>
              <p className="text-[11px] text-slate-400">Cotações automatizadas, funil comercial e gestão de garantias.</p>
              <span className="text-[10px] text-teal-400 font-bold mt-1 inline-block">{isMasterTenant ? '100% OFF (Master)' : '50% OFF Ativo'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
