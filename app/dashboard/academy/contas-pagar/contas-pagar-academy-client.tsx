'use client';

import React from 'react';
import Link from 'next/link';
import {
  FileText,
  Zap,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Scan,
  RefreshCw,
  WalletCards,
  ArrowLeft,
  Building2,
  Lock,
} from 'lucide-react';

export function ContasPagarAcademyClient() {
  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* NAVEGAÇÃO SUPERIOR */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <Link
          href="/dashboard/academy"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Hub Academy</span>
        </Link>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          Módulo Financeiro & Backoffice 4.0
        </span>
      </div>

      {/* HEADER PRINCIPAL */}
      <div className="border-b border-slate-800/80 pb-6">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
            <Zap className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Guia Prático: Automação do Contas a Pagar
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Descubra como o GADAP Hub elimina a digitação manual de notas e boletos da sua construtora.
            </p>
          </div>
        </div>
      </div>

      {/* PASSOS DA AUTOMAÇÃO */}
      <div className="space-y-5">
        {/* Passo 1: Captura Automática DFe */}
        <div className="p-6 bg-slate-900/60 hover:bg-slate-900/90 rounded-2xl border border-slate-800 hover:border-slate-700/80 transition-all shadow-xl group">
          <div className="flex items-start sm:items-center justify-between gap-4 mb-3">
            <div className="flex items-center space-x-3.5">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 font-extrabold text-sm border border-sky-500/30 shadow-sm flex-shrink-0">
                1
              </span>
              <div>
                <h2 className="font-extrabold text-white text-base sm:text-lg group-hover:text-sky-300 transition-colors flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-sky-400" />
                  Captura Automática (DFe SEFAZ)
                </h2>
                <span className="text-[11px] font-medium text-slate-500">Varredura periódica e transparente via WebService Nacional</span>
              </div>
            </div>
            <Link
              href="/dashboard/financeiro/notas-entrada"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 border border-sky-500/20 transition-all flex-shrink-0"
            >
              <span>Ver Notas DFe</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 pl-0 sm:pl-12 leading-relaxed">
            Nosso motor varre a base da SEFAZ diariamente. Quando um fornecedor (ex: Gerdau, Votorantim) emite uma NF-e contra o seu CNPJ, ela aparece de forma autônoma na sua tela de Notas de Entrada.
          </p>
        </div>

        {/* Passo 2: Transformação em Título (1 Clique) */}
        <div className="p-6 bg-slate-900/60 hover:bg-slate-900/90 rounded-2xl border border-slate-800 hover:border-slate-700/80 transition-all shadow-xl group">
          <div className="flex items-start sm:items-center justify-between gap-4 mb-3">
            <div className="flex items-center space-x-3.5">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 font-extrabold text-sm border border-emerald-500/30 shadow-sm flex-shrink-0">
                2
              </span>
              <div>
                <h2 className="font-extrabold text-white text-base sm:text-lg group-hover:text-emerald-300 transition-colors flex items-center gap-2">
                  <WalletCards className="w-4 h-4 text-emerald-400" />
                  Transformação em Título (1 Clique)
                </h2>
                <span className="text-[11px] font-medium text-slate-500">Eliminação total de erros manuais de digitação de valores</span>
              </div>
            </div>
            <Link
              href="/dashboard/financeiro/pagar"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all flex-shrink-0"
            >
              <span>Contas a Pagar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 pl-0 sm:pl-12 leading-relaxed">
            Pare de digitar valores. Clique no botão &quot;Converter em Contas a Pagar&quot; ao lado da nota. O sistema lê o XML, identifica o valor e a data de vencimento, e já provisiona a despesa na sua Central Financeira global.
          </p>
        </div>

        {/* Passo 3: Inteligência Artificial (OCR) para Recibos Físicos */}
        <div className="p-6 bg-slate-900/60 hover:bg-slate-900/90 rounded-2xl border border-slate-800 hover:border-slate-700/80 transition-all shadow-xl group">
          <div className="flex items-start sm:items-center justify-between gap-4 mb-3">
            <div className="flex items-center space-x-3.5">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 font-extrabold text-sm border border-purple-500/30 shadow-sm flex-shrink-0">
                3
              </span>
              <div>
                <h2 className="font-extrabold text-white text-base sm:text-lg group-hover:text-purple-300 transition-colors flex items-center gap-2">
                  <Scan className="w-4 h-4 text-purple-400" />
                  Inteligência Artificial (OCR) para Recibos Físicos
                </h2>
                <span className="text-[11px] font-medium text-slate-500">Visão computacional e leitura instantânea de cupom fiscal</span>
              </div>
            </div>
            <Link
              href="/dashboard/inteligencia"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/20 transition-all flex-shrink-0"
            >
              <span>Abrir OCR IA</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 pl-0 sm:pl-12 leading-relaxed">
            Comprou cimento na loja da esquina e trouxe um recibo de papel? Tire uma foto, arraste para a tela de &quot;Inteligência (OCR)&quot;. A nossa IA lê a imagem, extrai o CNPJ e o valor total, e preenche o lançamento por si.
          </p>
        </div>
      </div>

      {/* BANNER DE FLUXO CONECTADO */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-purple-950/40 border border-slate-800 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <h3 className="font-extrabold text-white text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Pronto para testar a automação?
          </h3>
          <p className="text-xs text-slate-400 max-w-xl">
            Acesse o Painel de Notas de Entrada e sincronize os documentos da SEFAZ para provisionar suas compras com 1 clique.
          </p>
        </div>

        <Link
          href="/dashboard/financeiro/notas-entrada"
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/25 border border-emerald-400/30 transition-all hover:scale-[1.02] flex items-center gap-2 flex-shrink-0"
        >
          <span>Acessar Notas de Entrada (DFe)</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
