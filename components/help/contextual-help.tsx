'use client';

import React, { useState } from 'react';
import {
  HelpCircle,
  X,
  ShieldCheck,
  Calculator,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Info,
  ExternalLink,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

export type HelpTopic = 'medicoes' | 'bdi_orcamentos' | 'subcontratos' | 'custom';

interface ContextualHelpProps {
  topic?: HelpTopic;
  title?: string;
  triggerText?: string;
  variant?: 'icon' | 'badge' | 'button';
  children?: React.ReactNode;
}

export function ContextualHelp({
  topic = 'custom',
  title,
  triggerText,
  variant = 'badge',
  children,
}: ContextualHelpProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Renderizador do Conteúdo pré-configurado por tópico
  const renderTopicContent = () => {
    if (topic === 'subcontratos') {
      return (
        <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {/* Card 1: Modelo Farol */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <h4 className="font-bold text-white flex items-center gap-2 text-xs uppercase tracking-wider text-emerald-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              1. O que é o Modelo Farol de Subcontratados?
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              O <strong>Modelo Farol</strong> monitora em tempo real a correlação entre os <em>desembolsos financeiros efetuados</em> e o <em>avanço físico medido em campo</em>:
            </p>
            <div className="space-y-1 text-xs pt-1">
              <div className="flex items-center gap-2 text-emerald-400 font-medium">
                <span>🟢 Farol Verde (Equilibrado):</span>
                <span className="text-slate-300">Pagamentos cobertos por medições físicas aprovadas.</span>
              </div>
              <div className="flex items-center gap-2 text-amber-400 font-medium">
                <span>🟡 Farol Amarelo (Atenção):</span>
                <span className="text-slate-300">Pagamentos superam a medição, mas permanecem abaixo de 80% do contrato.</span>
              </div>
              <div className="flex items-center gap-2 text-rose-400 font-medium">
                <span>🔴 Farol Vermelho (Risco Crítico):</span>
                <span className="text-slate-300">Pagamentos superam a medição e já atingiram &ge; 80% do valor global sem entrega.</span>
              </div>
            </div>
          </div>

          {/* Card 2: Política Zero Travas */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <h4 className="font-bold text-white flex items-center gap-2 text-xs uppercase tracking-wider text-amber-400">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              2. Política Zero Travas (Agilidade de Canteiro)
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              Diferente de ERPs burocráticos tradicionais, o GADAP Hub <strong>nunca trava</strong> a liberação de vales, diárias ou compras de insumos para os parceiros. Lançamentos de pagamento ocorrem de forma fluida e direta, alimentando o Contas a Pagar sem exigir medição prévia. O sistema sinaliza o risco visualmente, preservando a governança com total autonomia decisória da engenharia.
            </p>
          </div>

          {/* Card 3: Como abater a exposição */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <h4 className="font-bold text-white flex items-center gap-2 text-xs uppercase tracking-wider text-teal-300">
              <Calculator className="w-4 h-4 text-teal-300" />
              3. Como Abater o Saldo Devedor do Parceiro?
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              Ao clicar no botão <strong>"Registrar Medição"</strong>, a construtora formaliza a entrega do serviço executado pelo parceiro. Esse registro abate imediatamente a <em>exposição financeira</em>, reequilibrando a balança física e retornando o status para o <strong>Farol Verde</strong>.
            </p>
          </div>
        </div>
      );
    }

    if (topic === 'medicoes') {
      return (
        <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {/* Parágrafo 1: O que é a retenção técnica */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <h4 className="font-bold text-white flex items-center gap-2 text-xs uppercase tracking-wider text-emerald-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              1. O que é a Retenção Técnica Contratual?
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              A retenção técnica (tipicamente entre <strong>5% e 10%</strong>) é uma garantia financeira estipulada em contrato e retida pelo tomador a cada medição mensal. Seu objetivo é caucionar a execução do canteiro contra vícios construtivos ocultos e contingências trabalhistas ou previdenciárias. Esse valor <strong>não é um desconto comercial</strong>: ele é provisionado e restituído integralmente à construtora após a entrega definitiva da obra (expedição do Termo de Recebimento Definitivo e CND da RFB).
            </p>
          </div>

          {/* Parágrafo 2: Por que o valor líquido é calculado automaticamente pelo motor do GADAP-ERP */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <h4 className="font-bold text-white flex items-center gap-2 text-xs uppercase tracking-wider text-teal-300">
              <Calculator className="w-4 h-4 text-teal-300" />
              2. Por que o Valor Líquido é Calculado pelo Backend Python?
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              Para eliminar conflitos entre o apontamento do engenheiro no canteiro e a tesouraria do cliente, o GADAP-ERP aplica uma <strong>regra determinística inegociável</strong>: o canteiro informa apenas o <em>Valor Medido Bruto</em> e a <em>taxa % contratual</em>. O motor de cálculo no backend em Python apura a retenção e o <em>Valor Líquido</em> com precisão de 4 casas decimais (<code className="text-emerald-400 font-mono">Decimal</code>) e arredondamento bancário (<code className="text-teal-300 font-mono">ROUND_HALF_EVEN</code>), impedindo divergências fiscais na emissão da NFS-e.
            </p>
          </div>

          {/* Parágrafo 3: Regra de Bloqueio de 100% e Saldo Contratual */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <h4 className="font-bold text-white flex items-center gap-2 text-xs uppercase tracking-wider text-amber-400">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              3. Regra de Bloqueio dos 100% (Governança e Teto do Contrato)
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              O somatório acumulado dos boletins de medição nunca pode ultrapassar o <strong>Saldo Contratual Restante</strong> da obra. Caso a execução física demande valores superiores ao contrato original, o sistema aciona a trava de governança, exigindo a formalização de um <em>Termo Aditivo Contratual</em> com o cliente antes de autorizar novas medições ou faturamentos adicionais.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800">
            <span>Dúvidas sobre medições? Consulte o Onboarding.</span>
            <Link
              href="/dashboard/ajuda/guia-rapido"
              className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1"
              onClick={() => setIsOpen(false)}
            >
              Abrir Guia Rápido
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      );
    }

    if (topic === 'bdi_orcamentos') {
      return (
        <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {/* Parágrafo 1: O que é o BDI e Margem de Segurança */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <h4 className="font-bold text-white flex items-center gap-2 text-xs uppercase tracking-wider text-emerald-400">
              <Percent className="w-4 h-4 text-emerald-400" />
              1. O que é o BDI Analítico e sua Margem de Segurança?
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              O <strong>BDI (Benefícios e Despesas Indiretas)</strong> é o multiplicador técnico que converte o custo direto dos materiais e serviços no preço final de venda da proposta. Em vez de adicionar uma porcentagem aleatória de "chute", o BDI analisa despesas de escritório central, contingências e tributos, assegurando que o contrato suporte imprevistos e gere lucro líquido real para a construtora.
            </p>
          </div>

          {/* Parágrafo 2: As Siglas da Fórmula Oficial */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <h4 className="font-bold text-white flex items-center gap-2 text-xs uppercase tracking-wider text-teal-300">
              <Calculator className="w-4 h-4 text-teal-300" />
              2. As Siglas da Fórmula Oficial do GADAP-ERP
            </h4>
            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 font-mono text-[11px] text-emerald-400 text-center">
              BDI = [((1 + AC + S + R + G) * (1 + DF) * (1 + L)) / (1 - I)] - 1
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <li className="bg-slate-950/50 p-2 rounded border border-slate-800">
                <strong className="text-white">AC (Administração Central):</strong> Rateio das despesas da sede (diretoria, engenharia, aluguel).
              </li>
              <li className="bg-slate-950/50 p-2 rounded border border-slate-800">
                <strong className="text-white">S & G (Seguros & Garantias):</strong> Apólices de risco de engenharia e cauções contratuais.
              </li>
              <li className="bg-slate-950/50 p-2 rounded border border-slate-800">
                <strong className="text-white">R (Riscos / Imprevistos):</strong> Margem para intempéries climáticas, solos e retrabalhos.
              </li>
              <li className="bg-slate-950/50 p-2 rounded border border-slate-800">
                <strong className="text-white">DF (Despesas Financeiras):</strong> Custo do capital próprio e defasagem até o recebimento.
              </li>
              <li className="bg-slate-950/50 p-2 rounded border border-slate-800">
                <strong className="text-white">L (Lucro Líquido):</strong> Remuneração pretendida sobre o capital investido.
              </li>
              <li className="bg-slate-950/50 p-2 rounded border border-slate-800">
                <strong className="text-white">I (Tributos no denominador):</strong> Impostos incidentes (PIS, COFINS, ISS e CPRB).
              </li>
            </ul>
          </div>

          {/* Parágrafo 3: Aplicação nos Preços Unitários */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <h4 className="font-bold text-white flex items-center gap-2 text-xs uppercase tracking-wider text-sky-400">
              <CheckCircle2 className="w-4 h-4 text-sky-400" />
              3. Como o Sistema Protege o seu Contrato?
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              O GADAP Hub aplica o multiplicador de BDI item a item, recalculando subtotal de materiais, subtotal de serviços e o Grand Total em tempo real. Se o cliente solicitar um desconto no fechamento, o sistema evidencia visualmente o impacto direto na margem de lucro líquido da empresa antes de você bater o martelo.
            </p>
          </div>
        </div>
      );
    }

    return children;
  };

  const getResolvedTitle = () => {
    if (title) return title;
    if (topic === 'subcontratos') return 'Ajuda: Gestão de Terceirizados & Modelo Farol';
    if (topic === 'medicoes') return 'Ajuda: Medições & Retenção Técnica';
    if (topic === 'bdi_orcamentos') return 'Ajuda: Fórmula Oficial do BDI Analítico';
    return 'Ajuda Contextual';
  };

  const getResolvedTriggerText = () => {
    if (triggerText) return triggerText;
    if (topic === 'subcontratos') return 'Como funciona o Modelo Farol?';
    if (topic === 'medicoes') return 'Como funciona a Retenção?';
    if (topic === 'bdi_orcamentos') return 'Entenda as taxas do BDI';
    return 'Ajuda';
  };

  return (
    <>
      {/* Botão de Disparo */}
      {variant === 'icon' && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="text-slate-400 hover:text-emerald-400 p-1 rounded-lg hover:bg-slate-800/60 transition-colors"
          title={getResolvedTitle()}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      )}

      {variant === 'badge' && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 transition-all hover:scale-[1.02]"
        >
          <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span>{getResolvedTriggerText()}</span>
        </button>
      )}

      {variant === 'button' && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all"
        >
          <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span>{getResolvedTriggerText()}</span>
        </button>
      )}

      {/* Modal / Dialog de Ajuda Contextual */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#0b101b] shadow-2xl overflow-hidden my-8">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{getResolvedTitle()}</h3>
                  <p className="text-xs text-slate-400">
                    Orientações técnicas e regras de negócio do GADAP-ERP
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo Didático */}
            <div className="p-6 max-h-[75vh] overflow-y-auto space-y-4">
              {renderTopicContent()}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/40 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
