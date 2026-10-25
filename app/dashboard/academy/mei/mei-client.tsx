'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Zap,
  ArrowRight,
  CheckCircle2,
  Circle,
  Calculator,
  Building,
  FileCheck2,
  Download,
  HelpCircle,
  Sparkles,
  ShieldCheck,
  DollarSign,
  ArrowLeft,
  Share2,
  Check,
  Clock,
  Briefcase,
  ChevronRight,
  FileText,
} from 'lucide-react';

interface MeiAcademyClientProps {
  tenantName?: string;
  taxRegime?: string;
}

export function MeiAcademyClient({ tenantName = 'Minha Empresa', taxRegime = 'MEI' }: MeiAcademyClientProps) {
  // Checklist de 3 passos salvo no localStorage
  const [completedSteps, setCompletedSteps] = useState<{ [key: string]: boolean }>({
    step1: false,
    step2: false,
    step3: false,
  });

  // Simulador rápido de Markup
  const [simCost, setSimCost] = useState<number>(2500);
  const [simMarkup, setSimMarkup] = useState<number>(35);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gadap_mei_onboarding_progress');
      if (saved) {
        setCompletedSteps(JSON.parse(saved));
      }
    } catch {
      // Ignora erro de acesso a storage
    }
  }, []);

  const toggleStep = (stepKey: string) => {
    const updated = {
      ...completedSteps,
      [stepKey]: !completedSteps[stepKey],
    };
    setCompletedSteps(updated);
    try {
      localStorage.setItem('gadap_mei_onboarding_progress', JSON.stringify(updated));
    } catch {
      // Ignora erro
    }
  };

  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / 3) * 100);

  // Cálculo do simulador
  const simProfit = simCost * (simMarkup / 100);
  const simFinalPrice = simCost + simProfit;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-16">
      {/* Barra de Navegação Superior */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/academy"
          className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Academy Geral
        </Link>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Trilha Expressa • 3 Passos
          </span>
        </div>
      </div>

      {/* Banner Principal com Apresentação */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-amber-950/30 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-64 h-64 rounded-full bg-yellow-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Sem Planilhas Confusas • Direto ao Ponto</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Onboarding Expresso para{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-200">
                MEIs e Arquitetos
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Feito para o profissional autônomo, arquiteto independente e empreiteiro solo.
              Aprenda a <strong>orçar rápido com margem direta</strong>, criar sua obra com 1 clique e <strong>emitir notas fiscais limpas sem retenções</strong>.
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-2">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Tempo de leitura: 3 minutos
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                Apenas 3 passos essenciais
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                100% livre de retenções no MEI
              </span>
            </div>
          </div>

          {/* Card de Progresso do Autônomo */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 min-w-[280px] shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
                <span className="font-semibold">Seu Avanço Expresso</span>
                <span className="text-amber-400 font-bold">{progressPercent}%</span>
              </div>

              {/* Barra de Progresso */}
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500 ease-out shadow-sm shadow-amber-500/50"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="text-[11px] text-slate-400 mt-2">
                {completedCount} de 3 passos concluídos
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between gap-2">
              <a
                href="/Guia_Rapido_Autonomos_MEI.pdf"
                download="Guia_Rapido_Autonomos_MEI.pdf"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                title="Baixar guia em formato PDF"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                Baixar PDF Oficial
              </a>

              {completedCount === 3 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Pronto!
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grid dos 3 Passos Principais */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-amber-400" />
            O Ciclo de 3 Passos do Pequeno Empreendedor
          </h2>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Clique na caixinha para marcar cada passo como concluído
          </span>
        </div>

        {/* PASSO 1: Orçamento com Markup */}
        <div className={`glass-panel p-6 rounded-2xl border transition-all duration-300 space-y-5 ${
          completedSteps.step1
            ? 'border-emerald-500/40 bg-emerald-950/10'
            : 'border-slate-800 hover:border-amber-500/30'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-start sm:items-center gap-3.5">
              <button
                type="button"
                onClick={() => toggleStep('step1')}
                className="mt-1 sm:mt-0 focus:outline-none transition-transform hover:scale-110"
                title="Marcar passo 1 como concluído"
              >
                {completedSteps.step1 ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 fill-emerald-500/20" />
                ) : (
                  <Circle className="w-6 h-6 text-slate-500 hover:text-amber-400" />
                )}
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                    Passo 1
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Como Orçar Rápido Usando Margem Direta (Markup)
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Preço de venda direto sobre o custo. Sem planilhas de rateio ou fórmulas confusas.
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/orcamentos/novo"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition-all self-start sm:self-auto"
            >
              <Calculator className="w-4 h-4 stroke-[2.5]" />
              Criar Novo Orçamento
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                No topo da tela de criação de proposta, ative a chave{' '}
                <strong className="text-amber-300 font-semibold">"Orçamento Simplificado (Ideal para Autônomos)"</strong>.
              </p>
              <ul className="space-y-1.5 list-disc list-inside text-slate-400">
                <li>Os campos corporativos de taxas e coeficientes somem da tela.</li>
                <li>Você informa o custo dos materiais e os valores das diárias de mão de obra.</li>
                <li>Digita a sua <strong>% de Margem (Markup)</strong> ou usa os atalhos rápidos (<span className="text-slate-200 font-mono">+20%</span>, <span className="text-slate-200 font-mono">+30%</span>, <span className="text-slate-200 font-mono">+40%</span>, <span className="text-slate-200 font-mono">+50%</span>).</li>
              </ul>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-300">
                <span className="text-amber-400 font-bold block">Fórmula Simplificada:</span>
                Preço Final de Venda = Custo Total × (1 + Margem %)
              </div>
            </div>

            {/* Simulador Interativo de Markup */}
            <div className="lg:col-span-5 bg-slate-950/90 border border-slate-800 p-4 rounded-xl space-y-3 shadow-inner">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold text-slate-200 flex items-center gap-1">
                  <Calculator className="w-3.5 h-3.5 text-amber-400" />
                  Simulador de Margem ao Vivo
                </span>
                <span className="text-[10px] text-amber-400 font-mono">Faça seu teste</span>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Custo Estimado (R$):</span>
                    <span className="font-mono text-white">{formatCurrency(simCost)}</span>
                  </div>
                  <input
                    type="range"
                    min="500"
                    max="20000"
                    step="250"
                    value={simCost}
                    onChange={(e) => setSimCost(Number(e.target.value))}
                    className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Sua Margem Markup:</span>
                    <span className="font-mono text-amber-400 font-bold">+{simMarkup}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={simMarkup}
                    onChange={(e) => setSimMarkup(Number(e.target.value))}
                    className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Preço da Proposta</span>
                  <span className="text-base font-bold text-amber-400 font-mono">
                    {formatCurrency(simFinalPrice)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase">Seu Lucro Bruto</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    +{formatCurrency(simProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PASSO 2: Como Gerar a Obra */}
        <div className={`glass-panel p-6 rounded-2xl border transition-all duration-300 space-y-4 ${
          completedSteps.step2
            ? 'border-emerald-500/40 bg-emerald-950/10'
            : 'border-slate-800 hover:border-amber-500/30'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-start sm:items-center gap-3.5">
              <button
                type="button"
                onClick={() => toggleStep('step2')}
                className="mt-1 sm:mt-0 focus:outline-none transition-transform hover:scale-110"
                title="Marcar passo 2 como concluído"
              >
                {completedSteps.step2 ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 fill-emerald-500/20" />
                ) : (
                  <Circle className="w-6 h-6 text-slate-500 hover:text-amber-400" />
                )}
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                    Passo 2
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Como Gerar a Obra em 1 Clique
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Transforme a proposta aceita pelo cliente em uma obra ativa automaticamente.
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/obras"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all self-start sm:self-auto"
            >
              <Building className="w-4 h-4 text-emerald-400" />
              Ver Minhas Obras
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                1
              </div>
              <h4 className="font-bold text-white">Aceite Comercial</h4>
              <p className="text-slate-400 leading-relaxed">
                Assim que o cliente aprovar o orçamento, acesse a proposta e mude o status para <strong>"Aprovado"</strong>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                2
              </div>
              <h4 className="font-bold text-white">Pasta da Obra Criada</h4>
              <p className="text-slate-400 leading-relaxed">
                O GADAP Hub cria a obra vinculada com o escopo acordado e o valor total fechado sem redigitação.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
              <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 font-bold">
                3
              </div>
              <h4 className="font-bold text-white">Controle de Gastos</h4>
              <p className="text-slate-400 leading-relaxed">
                Lance os recibos de compras na obra e saiba a qualquer momento se o seu lucro está sendo preservado.
              </p>
            </div>
          </div>
        </div>

        {/* PASSO 3: Faturamento Limpo sem Retenções */}
        <div className={`glass-panel p-6 rounded-2xl border transition-all duration-300 space-y-4 ${
          completedSteps.step3
            ? 'border-emerald-500/40 bg-emerald-950/10'
            : 'border-slate-800 hover:border-amber-500/30'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-start sm:items-center gap-3.5">
              <button
                type="button"
                onClick={() => toggleStep('step3')}
                className="mt-1 sm:mt-0 focus:outline-none transition-transform hover:scale-110"
                title="Marcar passo 3 como concluído"
              >
                {completedSteps.step3 ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 fill-emerald-500/20" />
                ) : (
                  <Circle className="w-6 h-6 text-slate-500 hover:text-amber-400" />
                )}
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                    Passo 3
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Como Faturar a Nota Fiscal Isenta das Retenções Complexas
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Seus tributos já são pagos no DAS mensal. Receba 100% líquido sem descontos na fonte.
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/faturamento"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all self-start sm:self-auto"
            >
              <FileCheck2 className="w-4 h-4 text-teal-400" />
              Painel de Faturamento
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h4 className="font-bold text-amber-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                A Proteção do Bypass Fiscal do GADAP Hub
              </h4>
              <p className="text-slate-300 leading-relaxed">
                Por lei (Lei Complementar nº 123/2006), o MEI <strong>não pode sofrer retenção na fonte</strong> de INSS (11%), Imposto de Renda (1,5%) ou contribuições.
              </p>
              <p className="text-slate-400">
                O motor do GADAP Hub identifica sua empresa e zera automaticamente esses campos na nota fiscal para que o tomador pague o valor integral.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h4 className="font-bold text-white flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                O que sai na sua NFS-e Oficial:
              </h4>
              <ul className="space-y-1.5 text-slate-300 font-mono text-[11px]">
                <li className="flex items-center justify-between border-b border-slate-800 pb-1">
                  <span>Retenção de INSS:</span>
                  <span className="text-emerald-400 font-bold">R$ 0,00 (0%)</span>
                </li>
                <li className="flex items-center justify-between border-b border-slate-800 pb-1">
                  <span>Retenção de IRRF:</span>
                  <span className="text-emerald-400 font-bold">R$ 0,00 (0%)</span>
                </li>
                <li className="flex items-center justify-between pt-0.5">
                  <span className="text-white font-bold">Valor Líquido a Receber:</span>
                  <span className="text-amber-400 font-bold">100% do Contrato</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Dúvidas Rápidas (FAQ do Autônomo) */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-amber-400" />
          Perguntas Frequentes do Prestador Autônomo
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-300">
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 space-y-1.5">
            <span className="font-bold text-white block">Posso alterar a margem em cada obra?</span>
            <p className="text-slate-400">
              Sim! Em cada orçamento você pode definir uma porcentagem diferente ou usar os atalhos rápidos de margem.
            </p>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 space-y-1.5">
            <span className="font-bold text-white block">E se o cliente pedir desconto?</span>
            <p className="text-slate-400">
              Basta preencher o campo "Desconto Comercial". O sistema recalcula o valor final sem alterar seus custos reais.
            </p>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 space-y-1.5">
            <span className="font-bold text-white block">Como baixo o manual completo?</span>
            <p className="text-slate-400">
              Você pode baixar o <a href="/Guia_Rapido_Autonomos_MEI.pdf" download className="text-amber-400 underline font-semibold">PDF Oficial</a> para consultar offline quando quiser.
            </p>
          </div>
        </div>
      </div>

      {/* Card de Chamada Final para Ação */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-base font-bold text-white">
            Pronto para emitir propostas profissionais e receber sem glosas?
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Comece agora criando seu primeiro orçamento com margem Markup direta.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/orcamentos/novo"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/25 transition-all"
          >
            <Zap className="w-4 h-4 stroke-[2.5]" />
            Criar Orçamento Simplificado
          </Link>
        </div>
      </div>
    </div>
  );
}
