'use client';

import React from 'react';
import Link from 'next/link';
import { Lock, Sparkles, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface PaywallBlockerProps {
  moduleName: string;
  description?: string;
  benefits?: string[];
  children?: React.ReactNode;
  isBlocked?: boolean;
}

export function PaywallBlocker({
  moduleName,
  description = 'Este módulo faz parte do plano corporativo PRO e Enterprise do GADAP Hub.',
  benefits = [
    'Automação e controle operacional sem planilhas paralelas',
    'Conformidade jurídica e fiscal em tempo real',
    'Disparos automatizados via WhatsApp e E-mail',
    'Relatórios consolidados para diretoria',
  ],
  children,
  isBlocked = false,
}: PaywallBlockerProps) {
  if (!isBlocked && children) {
    return <>{children}</>;
  }
  return (
    <div className="min-h-[500px] flex items-center justify-center p-4 sm:p-8 animate-fade-in">
      <div className="max-w-xl w-full bg-slate-900/80 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md">
            <Lock className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              Módulo Premium
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5">
              Acesso ao Módulo de {moduleName}
            </h2>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
          {description}
        </p>

        <div className="space-y-2.5 p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 mb-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Benefícios Inclusos no Upgrade:
          </h4>
          {benefits.map((b, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>{b}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/dashboard/ajuda/guia-rapido"
            className="w-full sm:w-auto flex-1 py-3 px-5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/25 transition-all text-center flex items-center justify-center gap-2"
          >
            <span>Fazer Upgrade para o Plano PRO</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto py-3 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all text-center"
          >
            Voltar ao Início
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PaywallBlocker;
