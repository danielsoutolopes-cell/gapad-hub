'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  Loader2,
  FileSpreadsheet,
  Download,
  Check,
  TrendingDown,
  TrendingUp,
  Percent,
  X,
  Play,
  RotateCw,
} from 'lucide-react';
import { PaywallBlocker } from '@/components/ui/paywall-blocker';
import { HelpTooltip } from '@/components/ui/tooltip';

interface PayrollRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_role: string;
  reference_month: string;
  base_salary: number;
  overtime_hours: number;
  overtime_amount: number;
  absent_days: number;
  absence_deduction: number;
  gross_amount: number;
  inss_deduction: number;
  irrf_deduction: number;
  other_deductions: number;
  net_amount: number;
  status: 'DRAFT' | 'APPROVED' | 'PAID';
  calculated_at: string;
}

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

export function FolhaClient({ activeModules }: { activeModules: string[] }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [summary, setSummary] = useState({
    totalGross: 0,
    totalNet: 0,
    totalDeductions: 0,
    count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/hr/payroll/records?reference_month=${selectedMonth}`);
      if (res.ok) {
        const data = await res.json();
        const items: PayrollRecord[] = data.items || [];
        setRecords(items);
        const gross = items.reduce((acc, r) => acc + (r.gross_amount || 0), 0);
        const net = items.reduce((acc, r) => acc + (r.net_amount || 0), 0);
        setSummary({
          totalGross: gross,
          totalNet: net,
          totalDeductions: gross - net,
          count: items.length,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadPayroll();
  }, [loadPayroll]);

  // Disparo em lote do cálculo de folha (Requisito 2 e 3)
  const handleCalculatePayroll = async () => {
    setCalculating(true);
    setBanner(null);
    try {
      const res = await fetch('/api/v1/hr/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference_month: selectedMonth }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Falha ao processar cálculo da folha.');
      setBanner({
        type: 'success',
        text: `Folha de competência ${selectedMonth} calculada com sucesso para ${data.processed_count} colaboradores!`,
      });
      loadPayroll();
    } catch (err: any) {
      setBanner({ type: 'error', text: err.message || 'Erro ao calcular folha.' });
    } finally {
      setCalculating(false);
    }
  };

  const handleApproveRecord = async (recordId: string) => {
    setApprovingId(recordId);
    try {
      const res = await fetch(`/api/v1/hr/payroll/records/${recordId}/approve`, {
        method: 'POST',
      });
      if (res.ok) {
        setRecords((prev) =>
          prev.map((r) => (r.id === recordId ? { ...r, status: 'APPROVED' } : r))
        );
        setBanner({ type: 'success', text: 'Demonstrativo aprovado para pagamento!' });
      }
    } catch {
      setBanner({ type: 'error', text: 'Erro ao aprovar registro de folha.' });
    } finally {
      setApprovingId(null);
    }
  };

  if (!activeModules.includes('RH')) {
    return (
      <PaywallBlocker
        moduleName="Processamento de Folha Inteligente"
        description="Fechamento de folha automatizado cruzando salário-base CLT com batidas de ponto eletrônico GPS."
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/rh"
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Painel DP
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <DollarSign className="w-7 h-7 text-emerald-400" />
            <span>Processamento de Folha Inteligente</span>
            <HelpTooltip
              title="Cálculo da Folha com Cruzamento de Ponto"
              content="O motor calcula o valor bruto somando horas extras apuradas via ponto GPS (adicional de 50%) e deduzindo faltas. Em seguida aplica a tabela progressiva de INSS, IRRF e vale-transporte."
            />
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Apuração automática de horas extras (GPS), descontos de faltas e retenções legais (INSS/IRRF).
          </p>
        </div>

        {/* SELETOR DE MÊS E BOTÃO DE CÁLCULO EM LOTE (REQUISITO 3) */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-400">Competência:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs text-white font-bold font-mono focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleCalculatePayroll}
            disabled={calculating}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-60"
          >
            {calculating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
            <span>Calcular Folha do Mês</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {banner && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between font-medium ${
            banner.type === 'success'
              ? 'bg-slate-900 border-emerald-500/30 text-emerald-300'
              : 'bg-slate-900 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span>{banner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* CARDS RESUMO DO FECHAMENTO */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 uppercase block">
            Colaboradores Apurados
          </span>
          <span className="text-2xl font-extrabold text-white font-mono mt-1 block">
            {summary.count}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 uppercase block">
            Total Proventos Brutos
          </span>
          <span className="text-2xl font-extrabold text-white font-mono mt-1 block">
            {formatBRL(summary.totalGross)}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 uppercase block">
            Total Retenções / Encargos
          </span>
          <span className="text-2xl font-extrabold text-rose-400 font-mono mt-1 block">
            - {formatBRL(summary.totalDeductions)}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/30 bg-emerald-500/5">
          <span className="text-[11px] font-bold text-emerald-400 uppercase block">
            Total Líquido a Pagar
          </span>
          <span className="text-2xl font-extrabold text-emerald-400 font-mono mt-1 block">
            {formatBRL(summary.totalNet)}
          </span>
        </div>
      </div>

      {/* TABELA DE PRÉ-FOLHA APURADA */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-white">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Demonstrativo Analítico da Competência ({selectedMonth})</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {records.length} demonstrativos gerados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                <th className="p-3.5">Colaborador</th>
                <th className="p-3.5">Salário Base</th>
                <th className="p-3.5">H. Extras (50%)</th>
                <th className="p-3.5">Faltas / Atrasos</th>
                <th className="p-3.5">Bruto Apurado</th>
                <th className="p-3.5">INSS Retido</th>
                <th className="p-3.5">IRRF</th>
                <th className="p-3.5 text-right">Líquido a Pagar</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500">
                    Nenhum cálculo processado para {selectedMonth}. Clique em &quot;Calcular Folha do
                    Mês&quot;.
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-white">{rec.employee_name}</div>
                      <div className="text-[11px] text-slate-400">{rec.employee_role}</div>
                    </td>
                    <td className="p-3.5 tabular-nums font-mono text-slate-300">
                      {formatBRL(rec.base_salary)}
                    </td>
                    <td className="p-3.5 tabular-nums font-mono text-emerald-400">
                      {rec.overtime_hours > 0 ? (
                        <>
                          +{formatBRL(rec.overtime_amount)}
                          <span className="text-[10px] text-slate-400 block font-sans">
                            ({rec.overtime_hours}h)
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="p-3.5 tabular-nums font-mono text-rose-400">
                      {rec.absent_days > 0 ? (
                        <>
                          -{formatBRL(rec.absence_deduction)}
                          <span className="text-[10px] text-slate-400 block font-sans">
                            ({rec.absent_days} d)
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="p-3.5 tabular-nums font-mono font-bold text-white">
                      {formatBRL(rec.gross_amount)}
                    </td>
                    <td className="p-3.5 tabular-nums font-mono text-slate-300">
                      -{formatBRL(rec.inss_deduction)}
                    </td>
                    <td className="p-3.5 tabular-nums font-mono text-slate-300">
                      {rec.irrf_deduction > 0 ? `-${formatBRL(rec.irrf_deduction)}` : 'Isento'}
                    </td>
                    <td className="p-3.5 tabular-nums font-mono font-bold text-emerald-400 text-right text-sm">
                      {formatBRL(rec.net_amount)}
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          rec.status === 'APPROVED'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {rec.status === 'APPROVED' ? 'APROVADO' : 'PRÉ-FOLHA'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      {rec.status !== 'APPROVED' ? (
                        <button
                          type="button"
                          disabled={approvingId === rec.id}
                          onClick={() => handleApproveRecord(rec.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] cursor-pointer transition-all flex items-center gap-1 ml-auto"
                        >
                          {approvingId === rec.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          <span>Aprovar</span>
                        </button>
                      ) : (
                        <span className="text-emerald-400 text-[11px] font-semibold flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Pronto
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

