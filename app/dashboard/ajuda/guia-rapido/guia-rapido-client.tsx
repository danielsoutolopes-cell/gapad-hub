'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  Users,
  HardHat,
  Calculator,
  ArrowRight,
  ShieldCheck,
  Building2,
  Sparkles,
  FileText,
  DollarSign,
  TrendingUp,
  Percent,
  Layers,
  ChevronRight,
  HelpCircle,
  ExternalLink,
  Info,
  Clock,
  Sparkle,
  ArrowUpRight,
  Receipt,
  Bot,
  Cpu,
  Zap,
} from 'lucide-react';

export function GuiaRapidoClient() {
  const [completedSteps, setCompletedSteps] = useState<{ [key: number]: boolean }>({
    1: false,
    2: false,
    3: false,
    4: false,
    5: false,
    6: false,
  });

  const [simuladorValor, setSimuladorValor] = useState<number>(100000);
  const [simuladorRetencao, setSimuladorRetencao] = useState<number>(5.0);

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [stepNumber]: !prev[stepNumber],
    }));
  };

  // Cálculo do simulador didático
  const retencaoCalculada = (simuladorValor * (simuladorRetencao / 100));
  const liquidoCalculado = simuladorValor - retencaoCalculada;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / 6) * 100);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* --------------------------------------------------------------------- */}
      {/* Hero Banner: Boas-Vindas e Propósito da Plataforma                   */}
      {/* --------------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-[#0b101b] p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              Ambiente de Testes • Guia Prático de 1ª Utilização
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono text-slate-400 bg-slate-800/60 border border-slate-700/60">
              admin@teste.com
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
              Bem-vindo ao <span className="text-emerald-400">GADAP Hub</span>, seu Centro de Comando da Construção Civil
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-3xl leading-relaxed">
              Desenvolvido por quem entende de canteiro de obras e engenharia. O GADAP Hub elimina planilhas de Excel paralelas, cálculos manuais de BDI e inconsistências em retenções técnicas, unificando o Comercial, a Engenharia e o Financeiro em um único fluxo contínuo e determinístico.
            </p>
          </div>

          {/* Barra de Progresso do Onboarding */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs font-medium mb-1.5">
              <span className="text-slate-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Seu Progresso de Inicialização do ERP
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                {completedCount} de 6 passos concluídos ({progressPercent}%)
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-800/80 border border-slate-700 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400 transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* Os 6 Passos Fundamentais do Ciclo Operacional                         */}
      {/* --------------------------------------------------------------------- */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-emerald-400" />
            A Jornada Completa em 6 Passos: Do Cadastro ao Faturamento Fiscal
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Siga o roteiro passo a passo para cadastrar seu tomador, orçar com BDI oficial, controlar o canteiro de obras e emitir a NFS-e Padrão Nacional.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* PASSO 1: CADASTRO DO PRIMEIRO CLIENTE */}
          <div
            className={`glass-panel p-6 sm:p-7 rounded-2xl border transition-all ${
              completedSteps[1]
                ? 'border-emerald-500/50 bg-emerald-950/15'
                : 'border-slate-800 hover:border-slate-700/80'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0 font-extrabold text-lg">
                  1
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      Passo 1 • Módulo Comercial
                    </span>
                    {completedSteps[1] && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Concluído
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-white">
                    Cadastrar o Primeiro Cliente (PF ou PJ)
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
                    O <strong className="text-white">Cliente Contratante</strong> é a espinha dorsal de todo o faturamento. Seja uma Incorporadora (PJ) ou um proprietário particular (PF), o GADAP Hub valida automaticamente o formato do CPF/CNPJ, registra os endereços fiscais e prepara a entidade para receber os contratos de obras e orçamentos técnicos com isolamento hermético por Tenant (RLS).
                  </p>

                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                    <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      Por que isso elimina retrabalho:
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      Ao cadastrar o cliente uma única vez, seus dados fiscais, telefone e e-mail corporativo alimentam automaticamente a emissão de contratos, DANFEs, NFS-e e notificações de WhatsApp sem necessidade de redigitação.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                <Link
                  href="/dashboard/clientes"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                >
                  <Users className="w-4 h-4" />
                  Ir para Clientes
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <button
                  type="button"
                  onClick={() => toggleStep(1)}
                  className={`text-xs font-medium transition-colors ${
                    completedSteps[1] ? 'text-slate-400 hover:text-white' : 'text-emerald-400 hover:underline'
                  }`}
                >
                  {completedSteps[1] ? 'Desmarcar' : 'Marcar como testado'}
                </button>
              </div>
            </div>
          </div>

          {/* PASSO 2: CADASTRO DA PRIMEIRA OBRA */}
          <div
            className={`glass-panel p-6 sm:p-7 rounded-2xl border transition-all ${
              completedSteps[2]
                ? 'border-emerald-500/50 bg-emerald-950/15'
                : 'border-slate-800 hover:border-slate-700/80'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500/20 to-emerald-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 flex-shrink-0 font-extrabold text-lg">
                  2
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      Passo 2 • Módulo de Engenharia
                    </span>
                    {completedSteps[2] && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Concluído
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-white">
                    Cadastrar a Obra e Vincular ao Cliente
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
                    A <strong className="text-white">Obra</strong> é a célula operacional do canteiro. Ao cadastrá-la no GADAP Hub, você seleciona o Cliente cadastrado no Passo 1, estipula o <strong className="text-emerald-400">Valor Total do Contrato</strong>, define a <strong className="text-teal-300">Retenção Técnica Padrão (ex: 5%)</strong>, registra o código CNO da Receita Federal e os prazos planejados de início e entrega.
                  </p>

                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                    <div className="font-semibold text-teal-300 flex items-center gap-1.5">
                      <HardHat className="w-4 h-4" />
                      Visão do Engenheiro de Campo:
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      Chega de gerenciar 15 planilhas de canteiro desconectadas. O cadastro da obra ancora todas as compras, diários e boletins de medição em um único centro de custo.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                <Link
                  href="/dashboard/obras"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-teal-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                >
                  <HardHat className="w-4 h-4" />
                  Ir para Obras
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <button
                  type="button"
                  onClick={() => toggleStep(2)}
                  className={`text-xs font-medium transition-colors ${
                    completedSteps[2] ? 'text-slate-400 hover:text-white' : 'text-emerald-400 hover:underline'
                  }`}
                >
                  {completedSteps[2] ? 'Desmarcar' : 'Marcar como testado'}
                </button>
              </div>
            </div>
          </div>

          {/* PASSO 3: LANÇAR E APROVAR A PRIMEIRA MEDIÇÃO */}
          <div
            className={`glass-panel p-6 sm:p-7 rounded-2xl border transition-all ${
              completedSteps[3]
                ? 'border-emerald-500/50 bg-emerald-950/15'
                : 'border-slate-800 hover:border-slate-700/80'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500/20 to-emerald-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 flex-shrink-0 font-extrabold text-lg">
                  3
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      Passo 3 • Medição Físico-Financeira
                    </span>
                    {completedSteps[3] && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Concluído
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-white">
                    Lançar a Primeira Medição e Conhecer o Cálculo Determinístico
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
                    Na tela de Obras, clique em <strong className="text-emerald-400">"Medições"</strong> para acessar o canteiro. Clique em <strong className="text-white">"Lançar Medição"</strong> e informe o período e o valor apurado. O GADAP Hub aplica a regra de negócio inegociável: calcula compulsoriamente a retenção técnica monetária e o valor líquido a receber no backend Python usando precisão <code className="text-emerald-400 font-mono">Decimal</code> e arredondamento bancário (<code className="text-teal-300 font-mono">ROUND_HALF_EVEN</code>).
                  </p>

                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                    <div className="font-semibold text-purple-300 flex items-center gap-1.5">
                      <Calculator className="w-4 h-4" />
                      Garantia Financeira & Compliance:
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      O cliente nunca recebe um valor distorcido por arredondamentos manuais. A retenção fica guardada como provisão de garantia e o botão "Aprovar Medição" libera o lote para faturamento automático.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                <Link
                  href="/dashboard/obras"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                >
                  <Calculator className="w-4 h-4" />
                  Medições da Obra
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <button
                  type="button"
                  onClick={() => toggleStep(3)}
                  className={`text-xs font-medium transition-colors ${
                    completedSteps[3] ? 'text-slate-400 hover:text-white' : 'text-emerald-400 hover:underline'
                  }`}
                >
                  {completedSteps[3] ? 'Desmarcar' : 'Marcar como testado'}
                </button>
              </div>
            </div>
          </div>

          {/* PASSO 4: ELABORAR O ORÇAMENTO COM BDI OFICIAL */}
          <div
            className={`glass-panel p-6 sm:p-7 rounded-2xl border transition-all ${
              completedSteps[4]
                ? 'border-emerald-500/50 bg-emerald-950/15'
                : 'border-slate-800 hover:border-slate-700/80'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-teal-500/20 border border-sky-500/30 flex items-center justify-center text-sky-300 flex-shrink-0 font-extrabold text-lg">
                  4
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      Passo 4 • Orçamentação
                    </span>
                    {completedSteps[4] && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Concluído
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-white">
                    Elaborar o Orçamento com Margem BDI Oficial (TCU)
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
                    No menu <strong className="text-white">Orçamentos</strong> (`/dashboard/orcamentos`), monte as composições de custos analíticos para serviços e materiais. O GADAP Hub aplica a fórmula oficial do BDI do Acórdão 2622/2013 do TCU (AC, S, R, G, DF, L, I), assegurando margens e cobrindo contingências antes de pactuar o contrato.
                  </p>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                <Link
                  href="/dashboard/orcamentos/novo"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-teal-600 hover:from-sky-400 hover:to-teal-500 text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-sky-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                >
                  <Calculator className="w-4 h-4" />
                  Novo Orçamento
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <button
                  type="button"
                  onClick={() => toggleStep(4)}
                  className={`text-xs font-medium transition-colors ${
                    completedSteps[4] ? 'text-slate-400 hover:text-white' : 'text-emerald-400 hover:underline'
                  }`}
                >
                  {completedSteps[4] ? 'Desmarcar' : 'Marcar como testado'}
                </button>
              </div>
            </div>
          </div>

          {/* PASSO 5: CADASTRAR FORNECEDORES E INSUMOS */}
          <div
            className={`glass-panel p-6 sm:p-7 rounded-2xl border transition-all ${
              completedSteps[5]
                ? 'border-emerald-500/50 bg-emerald-950/15'
                : 'border-slate-800 hover:border-slate-700/80'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-teal-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 flex-shrink-0 font-extrabold text-lg">
                  5
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Passo 5 • Suprimentos
                    </span>
                    {completedSteps[5] && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Concluído
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-white">
                    Cadastrar Fornecedores e Catálogo de Insumos
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
                    Registre os parceiros comerciais (usinas de concreto, distribuidoras de aço e locadoras de andaimes) e os materiais com classificação NCM e NBS. Isso alimenta as composições de custos e viabiliza a futura conciliação automática com notas fiscais de entrada.
                  </p>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                <Link
                  href="/dashboard/fornecedores"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                >
                  <Users className="w-4 h-4" />
                  Fornecedores
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <button
                  type="button"
                  onClick={() => toggleStep(5)}
                  className={`text-xs font-medium transition-colors ${
                    completedSteps[5] ? 'text-slate-400 hover:text-white' : 'text-emerald-400 hover:underline'
                  }`}
                >
                  {completedSteps[5] ? 'Desmarcar' : 'Marcar como testado'}
                </button>
              </div>
            </div>
          </div>

          {/* PASSO 6: FATURANDO A MEDIÇÃO DA OBRA COM NFS-E */}
          <div
            className={`glass-panel p-6 sm:p-7 rounded-2xl border transition-all ${
              completedSteps[6]
                ? 'border-purple-500/50 bg-purple-950/20'
                : 'border-slate-800 hover:border-purple-500/40'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500/30 to-indigo-500/30 border border-purple-500/40 flex items-center justify-center text-purple-300 flex-shrink-0 font-extrabold text-lg shadow-inner">
                  6
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/30">
                      Passo 6 • Faturamento Fiscal & NFS-e
                    </span>
                    {completedSteps[6] && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Concluído
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-white">
                    Faturando a Medição da Obra com NFS-e (Padrão Nacional)
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
                    Com a medição aprovada no painel de Obras (`/dashboard/obras/{'{id}'}/medicoes`), clique no botão <strong className="text-purple-300">"Emitir NFS-e"</strong>. O motor fiscal executa a validação territorial do ISS (LC 116/2003, Art. 3º, III), descriptografa o Certificado A1 estritamente em memória, gera a Chave de Acesso Nacional de 50 dígitos (Módulo 11), salva XML e PDF no Supabase Storage (`xml-fiscais`) e despacha notificação com DANFSE anexo no WhatsApp do cliente via Evolution API.
                  </p>

                  <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/20 text-xs text-purple-200 space-y-1.5">
                    <div className="font-semibold text-purple-300 flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-purple-400" />
                      Visualização Imediata com Presigned URL:
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      Assim que autorizada, a medição passa para "Faturada" e o botão "Visualizar PDF" permite abrir o espelho DANFSE em link seguro gerado dinamicamente via Supabase Storage.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                <Link
                  href="/dashboard/obras"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-purple-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                >
                  <Receipt className="w-4 h-4" />
                  Ir para Medições
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <button
                  type="button"
                  onClick={() => toggleStep(6)}
                  className={`text-xs font-medium transition-colors ${
                    completedSteps[6] ? 'text-slate-400 hover:text-white' : 'text-purple-400 hover:underline'
                  }`}
                >
                  {completedSteps[6] ? 'Desmarcar' : 'Marcar como testado'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* DECLARAÇÃO FINAL: 🎯 MVP CONCLUÍDO                                    */}
      {/* --------------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 via-teal-950/30 to-[#0c0f1d] p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                🎯 MVP CONCLUÍDO
              </span>
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Fase 10 (Tax Intelligence) 100% Concluída
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-white">
              Fase 10 100% Concluída! O GADAP Hub atingiu sua maturidade operacional da V0.
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Fase 10 100% Concluída! O GADAP Hub atingiu sua maturidade operacional da V0. Estamos prontos para embarcar os Clientes Piloto em produção e escalar para a Fase 11 (Billing SaaS)!
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <Bot className="w-7 h-7" />
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* Simulador Interativo Didático de Retenção Técnica                      */}
      {/* --------------------------------------------------------------------- */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 space-y-6 bg-gradient-to-br from-slate-900/90 to-[#0b101b]">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Simulador Interativo
            </span>
            <span className="text-xs text-slate-400">Entenda a matemática em tempo real</span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white mt-1 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-400" />
            Como Funciona o Cálculo Automático de Medição no GADAP Hub
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Altere os valores abaixo para ver como o motor de regras calcula instantaneamente a provisão de garantia e o líquido a faturar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Controles do Simulador */}
          <div className="md:col-span-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Valor Bruto da Medição (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
                  R$
                </span>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  value={simuladorValor}
                  onChange={(e) => setSimuladorValor(Number(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
                <span>Taxa de Retenção Técnica Contratual</span>
                <span className="text-emerald-400 font-mono font-bold">{simuladorRetencao.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={simuladorRetencao}
                onChange={(e) => setSimuladorRetencao(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>0% (Sem retenção)</span>
                <span>5% (Padrão de Mercado)</span>
                <span>10% (Garantia Máxima)</span>
              </div>
            </div>
          </div>

          {/* Resultado Projetado */}
          <div className="md:col-span-6">
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Resultado Apurado pelo Backend
              </div>

              <div className="space-y-2 text-xs divide-y divide-slate-800">
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Valor Bruto Medido:</span>
                  <span className="font-mono text-white font-semibold">
                    {formatCurrency(simuladorValor)}
                  </span>
                </div>

                <div className="flex justify-between py-1 text-amber-400">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Retenção Técnica ({simuladorRetencao.toFixed(1)}%):
                  </span>
                  <span className="font-mono font-bold">
                    -{formatCurrency(retencaoCalculada)}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="font-bold text-white text-xs sm:text-sm">
                    Líquido a Receber / Faturar:
                  </span>
                  <span className="font-mono font-extrabold text-emerald-400 text-lg sm:text-xl">
                    {formatCurrency(liquidoCalculado)}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 pt-1 leading-relaxed">
                ✓ Valor protegido contra divergências fiscais na emissão da NFS-e.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* Atalhos Rápidos para outros Módulos Disponíveis                        */}
      {/* --------------------------------------------------------------------- */}
      <div className="space-y-4">
        <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          Outros Módulos Já Disponíveis no Ambiente
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/dashboard/orcamentos/novo"
            className="glass-panel p-4 rounded-xl border border-slate-800 hover:border-emerald-500/40 transition-all hover:scale-[1.01] group"
          >
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold text-emerald-400">Motor de Orçamentos</span>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
            </div>
            <div className="font-bold text-white text-sm">Orçamento com BDI Analítico</div>
            <p className="text-[11px] text-slate-400 mt-1">
              Fórmula oficial do GADAP Hub para materiais e serviços com marcação analítica de tributos e lucro.
            </p>
          </Link>

          <Link
            href="/dashboard/produtos"
            className="glass-panel p-4 rounded-xl border border-slate-800 hover:border-teal-500/40 transition-all hover:scale-[1.01] group"
          >
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold text-teal-300">Catálogo de Insumos</span>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-teal-300 transition-colors" />
            </div>
            <div className="font-bold text-white text-sm">Materiais com NCM</div>
            <p className="text-[11px] text-slate-400 mt-1">
              Cadastro estruturado de materiais de construção civil com unidades de medida e custos base.
            </p>
          </Link>

          <Link
            href="/dashboard/servicos"
            className="glass-panel p-4 rounded-xl border border-slate-800 hover:border-sky-500/40 transition-all hover:scale-[1.01] group"
          >
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold text-sky-400">Catálogo de Serviços</span>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition-colors" />
            </div>
            <div className="font-bold text-white text-sm">Serviços com Código NBS</div>
            <p className="text-[11px] text-slate-400 mt-1">
              Enquadramento municipal de serviços de engenharia com alíquotas de LC 116/03.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
