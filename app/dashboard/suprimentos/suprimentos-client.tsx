'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Package,
  Truck,
  Plus,
  Send,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  MessageSquare,
  DollarSign,
  Layers,
  Sparkles,
} from 'lucide-react';
import { PaywallBlocker } from '@/components/ui/paywall-blocker';

export function SuprimentosClient({ activeModules }: { activeModules: string[] }) {
  const [activeTab, setActiveTab] = useState<'requisicoes' | 'concorrencia'>('requisicoes');
  const [batchSent, setBatchSent] = useState(false);

  // Verificação de Paywall PLG (PROMPT 68)
  if (!activeModules.includes('SUPRIMENTOS')) {
    return (
      <PaywallBlocker
        moduleName="Suprimentos & Procurement"
        description="Controle cotações em lote via WhatsApp, mapas de concorrência com melhor preço e estoques de canteiro sem burocracia."
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              Fase 15 • Suprimentos & Procurement
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Package className="w-7 h-7 text-amber-400" />
            Suprimentos & Logística de Canteiro
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Gestão unificada de requisições de compra, cotação simultânea para múltiplos fornecedores via WhatsApp e mapa comparativo de preços.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setBatchSent(true);
              setTimeout(() => setBatchSent(false), 4000);
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/25 border border-emerald-400/30 transition-all flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4 text-emerald-200" />
            <span>Disparar Cotação WhatsApp</span>
          </button>
        </div>
      </div>

      {batchSent && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Cotações disparadas em lote via WhatsApp para Gerdau, ArcelorMittal e Açofer!</span>
        </div>
      )}

      {/* TABS NAVEGAÇÃO */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('requisicoes')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'requisicoes'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Requisições de Obra
        </button>
        <button
          onClick={() => setActiveTab('concorrencia')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'concorrencia'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Mapa de Concorrência
        </button>
      </div>

      {/* ABA 1: REQUISIÇÕES DE OBRA */}
      {activeTab === 'requisicoes' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  REQ #1042
                </span>
                <span className="text-xs font-bold text-white">Aço CA-50 10.0mm (Barra 12m) - 2.500 kg</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-emerald-400" /> Edifício Metropolitan</span>
                <span>•</span>
                <span>Prazo: 05/11/2026</span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
              3 Cotações Recebidas
            </span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  REQ #1043
                </span>
                <span className="text-xs font-bold text-white">Cimento CP-II 50kg (120 sacos)</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-emerald-400" /> Residencial Jardins</span>
                <span>•</span>
                <span>Prazo: 10/11/2026</span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              Aguardando Respostas
            </span>
          </div>
        </div>
      )}

      {/* ABA 2: MAPA DE CONCORRÊNCIA */}
      {activeTab === 'concorrencia' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
            Comparativo de cotações para: <strong className="text-white">Aço CA-50 10.0mm (Barra 12m) - 2.500 kg</strong>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Fornecedor 1 (Vencedor) */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-slate-900 border-2 border-emerald-500/50 shadow-xl relative">
              <span className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-slate-950">
                Melhor Preço
              </span>
              <h3 className="font-bold text-white text-base">Gerdau Comercial</h3>
              <p className="text-xs text-slate-400 mt-1">Preço Unitário: R$ 6,85/kg</p>
              <div className="text-xl font-black text-emerald-400 font-mono mt-3">R$ 17.125,00</div>
              <div className="text-xs text-slate-300 mt-2 space-y-1">
                <div>Entrega: 3 dias úteis</div>
                <div>Condição: 28 DDL</div>
              </div>
              <button className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all">
                Aprovar &amp; Comprar
              </button>
            </div>

            {/* Fornecedor 2 */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <h3 className="font-bold text-white text-base">ArcelorMittal</h3>
              <p className="text-xs text-slate-400 mt-1">Preço Unitário: R$ 7,15/kg</p>
              <div className="text-xl font-black text-white font-mono mt-3">R$ 17.875,00</div>
              <div className="text-xs text-slate-400 mt-2 space-y-1">
                <div>Entrega: 2 dias úteis</div>
                <div>Condição: 30 DDL</div>
              </div>
            </div>

            {/* Fornecedor 3 */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <h3 className="font-bold text-white text-base">Açofer Estruturas</h3>
              <p className="text-xs text-slate-400 mt-1">Preço Unitário: R$ 7,40/kg</p>
              <div className="text-xl font-black text-white font-mono mt-3">R$ 18.500,00</div>
              <div className="text-xs text-slate-400 mt-2 space-y-1">
                <div>Entrega: 5 dias úteis</div>
                <div>Condição: 14 DDL</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
