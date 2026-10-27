'use client';

import React, { useState } from 'react';
import { 
  Building, 
  UploadCloud, 
  CheckCircle2, 
  RefreshCw, 
  Zap, 
  FileText, 
  AlertCircle, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Check, 
  Clock, 
  Sparkles,
  Link2
} from 'lucide-react';

interface BankTx {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  source: 'PLUGGY_D0' | 'OFX_UPLOAD';
  match_status: 'MATCHED' | 'UNMATCHED';
  matched_title?: string;
  matched_category?: string;
}

const INITIAL_TRANSACTIONS: BankTx[] = [
  {
    id: 'tx-01',
    date: '27/10/2026',
    description: 'TED RECEBIDA - CLIENTE RESIDENCIAL HORIZON',
    amount: 145000.00,
    type: 'CREDIT',
    source: 'PLUGGY_D0',
    match_status: 'MATCHED',
    matched_title: 'Medição #04 - Construtora Horizon',
    matched_category: 'Receita Operacional de Obra'
  },
  {
    id: 'tx-02',
    date: '27/10/2026',
    description: 'PAGTO TITULO ITAU - VOTORANTIM CIMENTOS',
    amount: -34200.50,
    type: 'DEBIT',
    source: 'PLUGGY_D0',
    match_status: 'MATCHED',
    matched_title: 'NF-e 441029 - Cimento CP-II 32',
    matched_category: 'Insumos de Concreto'
  },
  {
    id: 'tx-03',
    date: '26/10/2026',
    description: 'PIX ENVIADO - LOCACAO ANDAIMES ALPHACON',
    amount: -8900.00,
    type: 'DEBIT',
    source: 'OFX_UPLOAD',
    match_status: 'MATCHED',
    matched_title: 'Contrato Subcontrato #19 - Andaimes',
    matched_category: 'Locação de Equipamentos'
  },
  {
    id: 'tx-04',
    date: '26/10/2026',
    description: 'TARIFA BANCARIA PACOTE EMPRESARIAL',
    amount: -125.00,
    type: 'DEBIT',
    source: 'PLUGGY_D0',
    match_status: 'UNMATCHED'
  }
];

export default function ConciliacaoClient() {
  const [tenantTier, setTenantTier] = useState<'FREE' | 'PREMIUM'>('PREMIUM');
  const [transactions, setTransactions] = useState<BankTx[]>(INITIAL_TRANSACTIONS);
  const [syncing, setSyncing] = useState(false);
  const [ofxFileName, setOfxFileName] = useState<string | null>(null);
  const [parsingOfx, setParsingOfx] = useState(false);

  const handleSyncPluggy = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      alert('Sincronização Open Finance Pluggy realizada com sucesso! 2 novas transações D+0 importadas e auto-conciliadas.');
    }, 1200);
  };

  const handleSimulateOfxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setOfxFileName(file.name);
      setParsingOfx(true);
      setTimeout(() => {
        setParsingOfx(false);
        const newTx: BankTx = {
          id: `tx-ofx-${Date.now()}`,
          date: '27/10/2026',
          description: 'TRANSFERENCIA RECEBIDA - MEDICAO 02 GALPAO',
          amount: 88500.00,
          type: 'CREDIT',
          source: 'OFX_UPLOAD',
          match_status: 'MATCHED',
          matched_title: 'Fatura 1092 - Galpão Cajamar',
          matched_category: 'Medições Aprovadas'
        };
        setTransactions(prev => [newTx, ...prev]);
      }, 1500);
    }
  };

  const handleManualMatch = (id: string) => {
    setTransactions(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          match_status: 'MATCHED',
          matched_title: 'Despesa Administrativa - Banco Itaú',
          matched_category: 'Tarifas Bancárias e Manutenção'
        };
      }
      return t;
    }));
  };

  const matchedCount = transactions.filter(t => t.match_status === 'MATCHED').length;
  const matchRate = Math.round((matchedCount / transactions.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header com Chaveamento de Plano (Simulação PLG) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Conciliação Bancária Híbrida
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Fase 18 • D+0 & Zero-Cost
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Motor inteligente de auto-match cruzando extratos com títulos de contas a pagar e receber.
          </p>
        </div>

        {/* Seletor de Simulação de Plano */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setTenantTier('FREE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tenantTier === 'FREE'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Plano Grátis (OFX)
          </button>
          <button
            onClick={() => setTenantTier('PREMIUM')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              tenantTier === 'PREMIUM'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Plano Pro (Pluggy D+0)
          </button>
        </div>
      </div>

      {/* Top Banner de Status do Motor de Auto-Match */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">Taxa de Auto-Match</div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {matchRate}%
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {matchedCount} de {transactions.length} transações conciliadas
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">Contas Conectadas</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            2 Contas PJ
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Itaú Empresas e Banco Inter PJ
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">Fluxo D+0 (Pluggy)</div>
          <div className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-1">
            Ativo
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Webhook sincronizado em tempo real
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">Custo de Operação</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            R$ 0,00
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Arquitetura resiliente com contingência OFX
          </p>
        </div>
      </div>

      {/* Widget Interativo de Acordo com o Plano */}
      {tenantTier === 'PREMIUM' ? (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/30 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Zap className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Open Finance Pluggy (D+0 Real-Time Feed)
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950 uppercase">
                      Premium Live
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Extratos bancários consolidados automaticamente sem necessidade de subir arquivos manuais.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSyncPluggy}
                disabled={syncing}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Atualizar Extratos Agora'}
              </button>
              <button className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-colors">
                <Link2 className="w-4 h-4" />
                Conectar Novo Banco
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Importação de Extrato Bancário (.OFX) - Gratuito
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Baixe o arquivo .ofx no Internet Banking da sua construtora e solte aqui. Nosso parser processa e localiza as notas correspondentes em segundos.
            </p>
          </div>

          <div className="pt-2">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity">
              <FileText className="w-4 h-4" />
              {parsingOfx ? 'Processando OFX...' : (ofxFileName || 'Selecionar Arquivo .OFX')}
              <input
                type="file"
                accept=".ofx"
                onChange={handleSimulateOfxUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {/* Tabela de Transações e Baixa Automática */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Transações Capturadas & Reconciliação
            </h3>
            <p className="text-xs text-slate-500">
              Cruza datas e valores exatos com o Contas a Pagar/Receber.
            </p>
          </div>
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-900">
              <th className="p-3.5">Data</th>
              <th className="p-3.5">Descrição Bancária</th>
              <th className="p-3.5">Origem</th>
              <th className="p-3.5">Valor (R$)</th>
              <th className="p-3.5">Status Auto-Match</th>
              <th className="p-3.5">Título Vinculado</th>
              <th className="p-3.5 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400">
                  {tx.date}
                </td>
                <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                  {tx.description}
                </td>
                <td className="p-3.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    tx.source === 'PLUGGY_D0'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                  }`}>
                    {tx.source === 'PLUGGY_D0' ? 'Pluggy D+0' : 'Extrato OFX'}
                  </span>
                </td>
                <td className="p-3.5 font-mono font-bold">
                  <span className={`inline-flex items-center gap-1 ${
                    tx.amount > 0 ? 'text-emerald-600' : 'text-slate-900 dark:text-white'
                  }`}>
                    {tx.amount > 0 ? (
                      <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
                    )}
                    R$ {Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </td>
                <td className="p-3.5">
                  {tx.match_status === 'MATCHED' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      <Check className="w-3 h-3" />
                      Baixado Automático
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                      <Clock className="w-3 h-3" />
                      Pendente de Vínculo
                    </span>
                  )}
                </td>
                <td className="p-3.5">
                  {tx.matched_title ? (
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {tx.matched_title}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {tx.matched_category}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">Nenhum título localizado</span>
                  )}
                </td>
                <td className="p-3.5 text-right">
                  {tx.match_status === 'UNMATCHED' ? (
                    <button
                      onClick={() => handleManualMatch(tx.id)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-sm"
                    >
                      Conciliar
                    </button>
                  ) : (
                    <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs font-semibold">
                      Ver Título
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
