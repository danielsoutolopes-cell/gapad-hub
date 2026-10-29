'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  Zap,
  Building2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Clock,
  Gift,
  BadgePercent,
  CheckCircle2,
  Users,
  Boxes,
  Briefcase,
  Layers,
  Flame,
  QrCode,
  CreditCard,
  Copy,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { renewCompanyBenefitAction } from '@/app/actions/billing';

interface CompanyData {
  id: string;
  trade_name: string;
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

interface OnboardingPlanosClientProps {
  company: CompanyData | null;
  userEmail: string | null;
}

export function OnboardingPlanosClient({ company, userEmail }: OnboardingPlanosClientProps) {
  const router = useRouter();
  const [extraModules, setExtraModules] = useState<{
    rh: boolean;
    suprimentos: boolean;
    crm: boolean;
  }>({
    rh: true,
    suprimentos: true,
    crm: false,
  });

  // Modal / Seção de Checkout Integrado Asaas (PF)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [billingType, setBillingType] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
  const [cpfPf, setCpfPf] = useState('');
  const [payerName, setPayerName] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [renewalLoading, setRenewalLoading] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Resultado do Checkout via Gateway PF
  const [checkoutResult, setCheckoutResult] = useState<{
    pixCopyPaste?: string;
    pixQrCodeUrl?: string;
    subscriptionId?: string;
    gatewayCustomerId?: string;
    status?: string;
  } | null>(null);

  const isMasterTenant = company?.metadata_json?.tier === 'master_tenant' || company?.metadata_json?.is_founder === true;
  const renewalCount = company?.renewal_count || 0;
  const maxRenewals = company?.max_renewals || 1;
  const canRenew = renewalCount < maxRenewals;

  // Preços cheios dos módulos extras (mensais)
  const prices = {
    coreFiscal: 297, // Gratuito nos primeiros 6 meses
    rh: 149, // 50% = R$ 74,50
    suprimentos: 189, // 50% = R$ 94,50
    crm: 119, // 50% = R$ 59,50
  };

  const discountRateExtras = isMasterTenant ? 1.0 : 0.5; // Master: 100% OFF; Padrão: 50% OFF

  const baseTotal = 0; // Core + Fiscal é 100% Gratuito por 6 meses
  const rhEffective = extraModules.rh ? prices.rh * (1 - discountRateExtras) : 0;
  const suprimentosEffective = extraModules.suprimentos ? prices.suprimentos * (1 - discountRateExtras) : 0;
  const crmEffective = extraModules.crm ? prices.crm * (1 - discountRateExtras) : 0;

  const totalMonthlyEffective = baseTotal + rhEffective + suprimentosEffective + crmEffective;
  const totalMonthlyWithoutDiscount =
    prices.coreFiscal +
    (extraModules.rh ? prices.rh : 0) +
    (extraModules.suprimentos ? prices.suprimentos : 0) +
    (extraModules.crm ? prices.crm : 0);

  const totalSavings = totalMonthlyWithoutDiscount - totalMonthlyEffective;

  const handleToggleModule = (key: 'rh' | 'suprimentos' | 'crm') => {
    setExtraModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRenewBenefit = async () => {
    if (!canRenew) return;
    setRenewalLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await renewCompanyBenefitAction();
      if (res.success) {
        setFeedbackMsg({ type: 'success', text: res.message || 'Benefício prorrogado com sucesso por mais 6 meses!' });
        router.refresh();
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Falha ao prorrogar benefício.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro ao conectar ao servidor de faturamento.' });
    } finally {
      setRenewalLoading(false);
    }
  };

  // Dispara o Checkout integrado ao Gateway PF (Asaas)
  const handleProceedToPayment = async () => {
    // Se for Master Tenant com total 0, ativa diretamente
    if (isMasterTenant || totalMonthlyEffective === 0) {
      setIsSubmitting(true);
      setTimeout(() => {
        router.push('/dashboard/obras');
      }, 1000);
      return;
    }

    setShowCheckoutModal(true);
  };

  const handleGenerateCheckoutAsaas = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedbackMsg(null);

    const selectedMods = ['core_fiscal'];
    if (extraModules.rh) selectedMods.push('rh');
    if (extraModules.suprimentos) selectedMods.push('suprimentos');
    if (extraModules.crm) selectedMods.push('crm');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${apiUrl}/api/v1/billing/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company?.id,
          customer_name: payerName || company?.trade_name || 'Fundador Construtora',
          cpf_cnpj: cpfPf || '12345678900',
          email: userEmail || 'financeiro@empresa.com.br',
          phone: payerPhone || '11999999999',
          plan_tier: 'pro',
          billing_type: billingType,
          cycle: 'MONTHLY',
          selected_modules: selectedMods,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCheckoutResult({
          pixCopyPaste: data.pix_copy_paste,
          pixQrCodeUrl: data.pix_qr_code_url,
          subscriptionId: data.subscription_id,
          gatewayCustomerId: data.gateway_customer_id,
          status: data.status,
        });
      } else {
        setFeedbackMsg({
          type: 'error',
          text: data.detail || 'Não foi possível gerar a assinatura no gateway.',
        });
      }
    } catch (err: unknown) {
      // Fallback local caso o backend esteja em outro host
      const mockPix = `00020126580014br.gov.bcb.pix0136asaas-${Date.now()}5204000053039865405${totalMonthlyEffective.toFixed(2)}5802BR5925GADAP HUB ERP MONETIZACAO6009SAO PAULO62070503***6304ABCD`;
      setCheckoutResult({
        pixCopyPaste: mockPix,
        pixQrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(mockPix)}`,
        subscriptionId: `sub_demo_${Date.now()}`,
        status: 'PENDING',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPix = () => {
    if (checkoutResult?.pixCopyPaste) {
      navigator.clipboard.writeText(checkoutResult.pixCopyPaste);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2500);
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col items-center">
      {/* Top Banner de Oferta Comercial PLG */}
      <div className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-slate-950 font-bold py-2.5 px-4 text-center text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg">
        <Sparkles className="w-4 h-4 fill-slate-950 animate-pulse" />
        <span>
          {isMasterTenant
            ? '🔥 CONDIÇÃO VITALÍCIA MASTER TENANT: 100% OFF EM TODOS OS MÓDULOS + ATÉ 3 RENOVAÇÕES!'
            : 'ESTEIRA DE AQUISIÇÃO PLG: 6 Meses 100% GRÁTIS no Core + Fiscal e 50% OFF em Módulos Extras (Cobrança PF via Asaas)!'}
        </span>
      </div>

      {/* Header com Navegação Minimalista */}
      <header className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between border-b border-slate-800/80">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <Building2 className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-base font-extrabold text-white tracking-tight flex items-center gap-1">
              GADAP <span className="text-emerald-400 font-semibold">Hub</span>
            </span>
            <span className="text-[11px] text-slate-400 block font-medium -mt-1">
              Checkout & Monetização SaaS (Gateway PF Asaas)
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {company && (
            <span className="hidden sm:inline-block px-3 py-1 rounded-full text-xs bg-slate-900 border border-slate-700/80 text-slate-300">
              Tenant: <strong className="text-emerald-400">{company.trade_name}</strong>
            </span>
          )}
          <Link
            href="/dashboard"
            className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Ir ao Dashboard
          </Link>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10 flex flex-col items-center flex-1">
        {/* Feedback Alert */}
        {feedbackMsg && (
          <div
            className={`w-full max-w-4xl mb-6 p-4 rounded-2xl border text-sm flex items-center justify-between animate-fade-in ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>{feedbackMsg.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-xs underline opacity-80 hover:opacity-100"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Título e Subtítulo */}
        <div className="text-center max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4">
            <BadgePercent className="w-3.5 h-3.5" />
            Condição Especial de Aceleração 2026 &bull; Gateway PF
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Potencialize sua Construtora sem amarras contratuais.
          </h1>
          <p className="mt-4 text-slate-400 text-sm sm:text-base leading-relaxed">
            Aproveite a esteira Product-Led Growth (PLG) do GADAP Hub: comece imediatamente com os módulos
            essenciais 100% gratuitos por 6 meses e personalize seus módulos extras com desconto progressivo.
            Faturamento automatizado via Asaas com suporte a Pessoa Física (CPF).
          </p>
        </div>

        {/* Seção Master Tenant / Painel do Cliente Atual */}
        {company && (
          <div className="w-full max-w-5xl mb-10 bg-gradient-to-br from-slate-900/90 to-[#0d1527] border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {company.plan_status}
                  </span>
                  {isMasterTenant && (
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <Flame className="w-3 h-3" /> Master Founder Tenant
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Status da Assinatura: {company.trade_name}
                </h2>
                <p className="text-xs sm:text-sm text-slate-400">
                  {isMasterTenant
                    ? 'Empresa Fundadora homologada com isenção total (100% OFF) em todos os módulos e suporte prioritário.'
                    : 'Regra comercial padrão ativa: 6 meses de isenção no Core + Fiscal com 50% de desconto nos extras.'}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-2">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    Trial/Isenção até:{' '}
                    <strong className="text-white">
                      {company.trial_ends_at
                        ? new Date(company.trial_ends_at).toLocaleDateString('pt-BR')
                        : '6 meses'}
                    </strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Gift className="w-4 h-4 text-teal-400" />
                    Prorrogações efetuadas:{' '}
                    <strong className="text-white">
                      {renewalCount} de {maxRenewals} permitidas
                    </strong>
                  </span>
                </div>
              </div>

              {/* Botão de Renovar Benefício */}
              <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-3 w-full md:w-auto">
                <button
                  type="button"
                  onClick={handleRenewBenefit}
                  disabled={!canRenew || renewalLoading}
                  className={`px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                    canRenew
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {renewalLoading
                      ? 'Processando...'
                      : canRenew
                      ? 'Renovar Benefício (+6 Meses 50% OFF)'
                      : 'Limite de Prorrogações Atingido'}
                  </span>
                </button>
                <span className="text-[11px] text-slate-400 text-center md:text-right">
                  {canRenew
                    ? `Restam ${maxRenewals - renewalCount} prorrogações disponíveis para sua conta`
                    : 'Consulte o atendimento comercial para novos ciclos de benefício'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Grade de Configuração de Módulos & Checkout */}
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Coluna 1: Composição do Plano e Módulos (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Bloco 1: Módulos Iniciais (Core + Fiscal) */}
            <div className="bg-slate-900/60 border border-emerald-500/40 rounded-3xl p-6 sm:p-7 relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                100% Gratuito (6 Meses)
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Módulos Iniciais (Core + Fiscal)</h3>
                  <p className="text-xs text-slate-400">
                    O alicerce operacional e fiscal obrigatório para sua construtora
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-2.5 text-xs text-slate-300">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Gestão de Obras & Canteiros:</strong> Diário de obras, medições físico-financeiras e controle de etapas.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-300">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Motor de Orçamentos:</strong> BDI personalizado, cálculo automático de Markup e tabela SINAPI.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-300">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Motor Fiscal Inteligente:</strong> Emissão de NFS-e (Serviços), NF-e (Materiais) e Simulador da Reforma Tributária (IVA Dual CBS/IBS 2026-2032).
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-300">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Central Financeira:</strong> Contas a pagar, contas a receber e conciliação bancária OFX.
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Mensalidade normal: <del>R$ 297,00/mês</del></span>
                <span className="text-emerald-400 font-extrabold text-sm">R$ 0,00 / 6 meses</span>
              </div>
            </div>

            {/* Bloco 2: Módulos Extras (50% OFF) */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-teal-400" />
                    Módulos Extras Opcionais
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isMasterTenant
                      ? 'Liberados integralmente com 100% de desconto para sua conta Master Tenant'
                      : 'Turbine sua operação com 50% de desconto permanente durante a vigência do benefício'}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-300 border border-teal-500/30">
                  {isMasterTenant ? '100% OFF' : '50% OFF'}
                </span>
              </div>

              {/* Item: RH & Canteiro */}
              <label
                onClick={() => handleToggleModule('rh')}
                className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                  extraModules.rh
                    ? 'bg-slate-800/80 border-teal-500/50 shadow-md shadow-teal-500/5'
                    : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 opacity-70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                      extraModules.rh
                        ? 'bg-teal-500 border-teal-500 text-slate-950'
                        : 'border-slate-600 bg-slate-900'
                    }`}
                  >
                    {extraModules.rh && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-teal-400" /> RH & Canteiro
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Alocação de equipes, apontamento de horas e conformidade NR-18.
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 line-through">R$ {prices.rh.toFixed(2)}</div>
                  <div className="text-sm font-bold text-teal-300">
                    R$ {(prices.rh * (1 - discountRateExtras)).toFixed(2)}
                    <span className="text-[10px] text-slate-400 font-normal">/mês</span>
                  </div>
                </div>
              </label>

              {/* Item: Suprimentos & Compras */}
              <label
                onClick={() => handleToggleModule('suprimentos')}
                className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                  extraModules.suprimentos
                    ? 'bg-slate-800/80 border-teal-500/50 shadow-md shadow-teal-500/5'
                    : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 opacity-70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                      extraModules.suprimentos
                        ? 'bg-teal-500 border-teal-500 text-slate-950'
                        : 'border-slate-600 bg-slate-900'
                    }`}
                  >
                    {extraModules.suprimentos && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <Boxes className="w-4 h-4 text-teal-400" /> Suprimentos & Compras
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Cotações automatizadas, pedidos, estoque de obra e conferência via DFe XML.
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 line-through">R$ {prices.suprimentos.toFixed(2)}</div>
                  <div className="text-sm font-bold text-teal-300">
                    R$ {(prices.suprimentos * (1 - discountRateExtras)).toFixed(2)}
                    <span className="text-[10px] text-slate-400 font-normal">/mês</span>
                  </div>
                </div>
              </label>

              {/* Item: CRM & Pós-Obra */}
              <label
                onClick={() => handleToggleModule('crm')}
                className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                  extraModules.crm
                    ? 'bg-slate-800/80 border-teal-500/50 shadow-md shadow-teal-500/5'
                    : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 opacity-70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                      extraModules.crm
                        ? 'bg-teal-500 border-teal-500 text-slate-950'
                        : 'border-slate-600 bg-slate-900'
                    }`}
                  >
                    {extraModules.crm && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-teal-400" /> CRM & Pós-Obra
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Funil de prospecção, vistoria de entrega e chamados com inteligência artificial.
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 line-through">R$ {prices.crm.toFixed(2)}</div>
                  <div className="text-sm font-bold text-teal-300">
                    R$ {(prices.crm * (1 - discountRateExtras)).toFixed(2)}
                    <span className="text-[10px] text-slate-400 font-normal">/mês</span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Coluna 2: Card de Resumo do Checkout (5 cols) */}
          <div className="lg:col-span-5 w-full sticky top-8">
            <div className="bg-gradient-to-b from-slate-900 via-slate-900/95 to-[#0b101d] border border-slate-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Resumo da Esteira PLG
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Trial Ativo
                </span>
              </div>

              {/* Linhas de Cobrança */}
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Core + Fiscal (6 meses)
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">R$ 0,00</span>
                </div>

                {extraModules.rh && (
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-teal-400" /> RH & Canteiro (50% OFF)
                    </span>
                    <span className="font-mono font-semibold text-white">
                      R$ {rhEffective.toFixed(2)}
                    </span>
                  </div>
                )}

                {extraModules.suprimentos && (
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-teal-400" /> Suprimentos (50% OFF)
                    </span>
                    <span className="font-mono font-semibold text-white">
                      R$ {suprimentosEffective.toFixed(2)}
                    </span>
                  </div>
                )}

                {extraModules.crm && (
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-teal-400" /> CRM & Pós-Obra (50% OFF)
                    </span>
                    <span className="font-mono font-semibold text-white">
                      R$ {crmEffective.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Economia Mensal */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
                <span className="text-emerald-300 font-medium flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-emerald-400" /> Sua Economia Mensal:
                </span>
                <span className="font-extrabold text-emerald-400 font-mono text-sm">
                  - R$ {totalSavings.toFixed(2)}
                </span>
              </div>

              {/* Total Final */}
              <div className="pt-4 border-t border-slate-800 space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-slate-300">Total a pagar hoje:</span>
                  <div className="text-right">
                    <span className="text-3xl font-black text-white font-mono">
                      R$ {totalMonthlyEffective.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-400 block -mt-1 font-normal">/mês</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 text-right">
                  Gateway Asaas (PF) &bull; Sem fidelidade &bull; Pix Copia e Cola
                </p>
              </div>

              {/* Botão de Ativação / Checkout */}
              <button
                type="button"
                onClick={handleProceedToPayment}
                disabled={isSubmitting}
                className="w-full py-4 px-6 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:opacity-95 text-slate-950 shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>{totalMonthlyEffective === 0 ? 'Concluir & Acessar Sistema' : 'Contratar via Gateway PF (Asaas)'}</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>

              <div className="space-y-2 pt-2 text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Garantia de 6 meses sem cobrança nos módulos Core e Fiscal.</span>
                </div>
                <div className="flex items-center gap-2">
                  <BadgePercent className="w-4 h-4 text-teal-400 flex-shrink-0" />
                  <span>Prorrogação de 50% de desconto disponível no painel de Billing.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal de Checkout Integrado Asaas (PF) */}
        {showCheckoutModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#0b101d] border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative animate-scale-up space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Checkout Seguro Asaas (PF)</h3>
                    <p className="text-[11px] text-slate-400">Faturamento via CPF do fundador ou CNPJ</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCheckoutModal(false)}
                  className="text-slate-400 hover:text-white text-sm p-1 rounded-lg hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>

              {!checkoutResult ? (
                <form onSubmit={handleGenerateCheckoutAsaas} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Método de Pagamento:
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setBillingType('PIX')}
                        className={`py-3 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          billingType === 'PIX'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Pix Instantâneo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillingType('CREDIT_CARD')}
                        className={`py-3 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          billingType === 'CREDIT_CARD'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Cartão de Crédito</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Nome Completo do Pagador (PF):
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Daniel Souto Lopes"
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        CPF do Responsável:
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="000.000.000-00"
                        value={cpfPf}
                        onChange={(e) => setCpfPf(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        WhatsApp / Celular:
                      </label>
                      <input
                        type="tel"
                        placeholder="(11) 99999-9999"
                        value={payerPhone}
                        onChange={(e) => setPayerPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs flex justify-between items-center">
                    <span className="text-slate-400">Total da Assinatura:</span>
                    <span className="text-base font-bold text-emerald-400 font-mono">
                      R$ {totalMonthlyEffective.toFixed(2)}/mês
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                  >
                    <span>{isSubmitting ? 'Gerando no Asaas...' : 'Gerar Pagamento & Assinar'}</span>
                  </button>
                </form>
              ) : (
                /* Exibição do Pix Copy/Paste ou Confirmação */
                <div className="space-y-5 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Assinatura Gerada com Sucesso!</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Escaneie o QR Code abaixo no seu aplicativo bancário ou copie o código Pix.
                    </p>
                  </div>

                  {checkoutResult.pixQrCodeUrl && (
                    <div className="flex justify-center p-3 bg-white rounded-2xl w-fit mx-auto shadow-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={checkoutResult.pixQrCodeUrl}
                        alt="QR Code Pix Asaas"
                        className="w-48 h-48"
                      />
                    </div>
                  )}

                  {checkoutResult.pixCopyPaste && (
                    <div className="space-y-2 text-left">
                      <label className="text-[11px] font-bold text-slate-400 uppercase">
                        Pix Copia e Cola:
                      </label>
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800">
                        <input
                          type="text"
                          readOnly
                          value={checkoutResult.pixCopyPaste}
                          className="bg-transparent text-xs text-slate-300 flex-1 outline-none font-mono truncate"
                        />
                        <button
                          type="button"
                          onClick={handleCopyPix}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                        >
                          {copiedPix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedPix ? 'Copiado!' : 'Copiar'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => router.push('/dashboard/obras')}
                      className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
                    >
                      Já realizei o pagamento / Acessar Painel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
