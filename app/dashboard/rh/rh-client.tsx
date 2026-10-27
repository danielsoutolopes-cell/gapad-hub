'use client';

import React from 'react';
import Link from 'next/link';
import {
  Users,
  HardHat,
  ShieldAlert,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Phone,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { PaywallBlocker } from '@/components/ui/paywall-blocker';

export function RhClient({ activeModules }: { activeModules: string[] }) {
  if (!activeModules.includes('RH')) {
    return (
      <PaywallBlocker
        moduleName="RH & Segurança no Canteiro"
        description="Gestão de ponto eletrônico com Geofencing, controle de validade de EPIs com alertas preventivos e conformidade trabalhista."
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Fase 16 • RH & Segurança no Canteiro
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-emerald-400" />
            Gestão de Mão de Obra &amp; EPI
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Monitoramento de presença com cerca eletrônica (Geofencing), auditoria de ponto e controle rigoroso de validade de EPIs.
          </p>
        </div>

        <Link
          href="/dashboard/rh/ponto"
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/25 border border-emerald-400/30 transition-all flex items-center gap-2"
        >
          <Clock className="w-4 h-4" />
          <span>Bater Ponto Mobile (Geofencing)</span>
        </Link>
      </div>

      {/* ALERTAS DE EPI */}
      <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 space-y-3">
        <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <span>Alertas Preventivos de EPI (Segurança do Trabalho)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <div className="font-bold text-white">Antônio Ferreira (Pedreiro)</div>
              <div className="text-slate-400">Capacete de Segurança (CA-35890)</div>
            </div>
            <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">
              Vence em 25 dias
            </span>
          </div>

          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <div className="font-bold text-white">João Carlos de Lima (Eletricista)</div>
              <div className="text-slate-400">Luva Isolante de Borracha (CA-12940)</div>
            </div>
            <span className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">
              VENCIDO - Trocar Já
            </span>
          </div>
        </div>
      </div>

      {/* QUADRO DE COLABORADORES */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 font-bold text-sm text-white flex items-center gap-2">
          <HardHat className="w-4 h-4 text-emerald-400" />
          <span>Colaboradores Alocados nos Canteiros</span>
        </div>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
              <th className="p-4">Colaborador</th>
              <th className="p-4">Função</th>
              <th className="p-4">Obra Atual</th>
              <th className="p-4">Diária</th>
              <th className="p-4">Status de Ponto Hoje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            <tr className="hover:bg-slate-800/40">
              <td className="p-4 font-bold text-white">Antônio Ferreira</td>
              <td className="p-4">Pedreiro</td>
              <td className="p-4 text-emerald-400">Edifício Metropolitan</td>
              <td className="p-4 font-mono font-bold">R$ 220,00</td>
              <td className="p-4">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-max">
                  <CheckCircle2 className="w-3 h-3" /> Dentro do Raio (Entrada 07h02)
                </span>
              </td>
            </tr>
            <tr className="hover:bg-slate-800/40">
              <td className="p-4 font-bold text-white">João Carlos de Lima</td>
              <td className="p-4">Eletricista</td>
              <td className="p-4 text-emerald-400">Residencial Jardins</td>
              <td className="p-4 font-mono font-bold">R$ 260,00</td>
              <td className="p-4">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-max">
                  <CheckCircle2 className="w-3 h-3" /> Dentro do Raio (Entrada 07h15)
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
