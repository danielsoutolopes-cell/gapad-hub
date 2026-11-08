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
  extraordinary_amount?: number;
  absent_days: number;
  absence_deduction: number;
  gross_amount: number;
  inss_deduction: number;
  irrf_deduction: number;
  other_deductions?: number;
  benefits_deduction?: number;
  net_amount: number;
  fgts_amount?: number;
  deductions_json?: {
    extraordinary_earnings?: Array<{ rubric: string; amount: number; rubric_type?: string }>;
    vale_transporte_6perc?: number;
    vale_alimentacao_pat?: number;
    plano_saude_coparticipacao?: number;
    seguro_vida_coletivo_nr18?: number;
  };
  status: 'DRAFT' | 'APPROVED' | 'PAID' | 'CLOSED';
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
  const [closing, setClosing] = useState(false);
  const [showAddExtraModal, setShowAddExtraModal] = useState(false);
  const [extraEmployeeId, setExtraEmployeeId] = useState('');
  const [extraRubricType, setExtraRubricType] = useState('BONUS_PRODUTIVIDADE');
  const [extraRubricName, setExtraRubricName] = useState('Bônus de Produtividade');
  const [extraAmount, setExtraAmount] = useState('500.00');
  const [pendingExtras, setPendingExtras] = useState<Array<{
    employee_id: string;
    rubric_type: string;
    rubric_name: string;
    amount: number;
    taxable_inss: boolean;
    taxable_irrf: boolean;
    taxable_fgts: boolean;
  }>>([]);

  const handleAddExtra = () => {
    if (!extraEmployeeId || !extraAmount || Number(extraAmount) <= 0) {
      alert('Informe o colaborador e um valor válido.');
      return;
    }
    const isPlr = extraRubricType === 'PLR';
    const isDiaria = extraRubricType === 'DIARIA_VIAGEM';
    const isPremio = extraRubricType === 'PREMIO_DESEMPENHO';

    setPendingExtras((prev) => [
      ...prev,
      {
        employee_id: extraEmployeeId,
        rubric_type: extraRubricType,
        rubric_name: extraRubricName,
        amount: parseFloat(extraAmount),
        taxable_inss: !isPlr && !isDiaria && !isPremio,
        taxable_irrf: !isDiaria,
        taxable_fgts: !isPlr && !isDiaria,
      },
    ]);
    setShowAddExtraModal(false);
    setBanner({
      type: 'success',
      text: `Rúbrica "${extraRubricName}" adicionada à pré-folha. Clique em "Calcular Folha com Rúbricas" para atualizar os cálculos.`,
    });
  };

  const handleClosePayroll = async () => {
    if (!confirm(`Deseja fechar e consolidar a folha de ${selectedMonth}? Isso gerará 5 títulos financeiros automáticos no Contas a Pagar.`)) {
      return;
    }
    setClosing(true);
    setBanner(null);
    try {
      const res = await fetch('/api/v1/hr/payroll/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference_month: selectedMonth }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail?.detail || data.detail || 'Falha ao fechar folha.');
      setBanner({
        type: 'success',
        text: `Folha de ${selectedMonth} fechada com sucesso! 5 títulos gerados no Contas a Pagar (Obrigação Total: ${formatBRL(data.total_financial_obligation)}).`,
      });
      loadPayroll();
    } catch (err: any) {
      setBanner({ type: 'error', text: err.message || 'Erro ao fechar folha.' });
    } finally {
      setClosing(false);
    }
  };

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

  // Disparo em lote do cálculo de folha (com suporte a Remunerações Extraordinárias)
  const handleCalculatePayroll = async () => {
    setCalculating(true);
    setBanner(null);
    try {
      const res = await fetch('/api/v1/hr/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference_month: selectedMonth,
          extraordinary_earnings: pendingExtras,
        }),
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const res = await fetch(`/api/v1/hr/payroll/export?reference_month=${selectedMonth}&format_type=csv`);
                if (res.ok) {
                  const data = await res.json();
                  const blob = new Blob([data.content], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = data.file_name;
                  a.click();
                  URL.revokeObjectURL(url);
                }
              }}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              title="Exportar Folha Detalhada em CSV"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                const res = await fetch(`/api/v1/hr/payroll/export?reference_month=${selectedMonth}&format_type=cnab240`);
                if (res.ok) {
                  const data = await res.json();
                  const blob = new Blob([data.content], { type: 'text/plain;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = data.file_name;
                  a.click();
                  URL.revokeObjectURL(url);
                }
              }}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              title="Exportar Remessa Bancária CNAB 240 (Febraban)"
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
              <span>Remessa CNAB240</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddExtraModal(true)}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              title="Lançar Bônus, Dissídios, PLR ou Gratificações"
            >
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span>+ Remuneração Extraordinária</span>
              {pendingExtras.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-slate-950 font-bold">
                  {pendingExtras.length}
                </span>
              )}
            </button>

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
              <span>Calcular Folha com Rúbricas</span>
            </button>

            <button
              type="button"
              onClick={handleClosePayroll}
              disabled={closing || records.length === 0}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-60"
              title="Fecha a folha e gera 5 títulos integrados no Contas a Pagar"
            >
              {closing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Fechar Folha (Contas a Pagar)</span>
            </button>
          </div>
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
                <th className="p-3.5">Remun. Extraordinárias</th>
                <th className="p-3.5">Faltas / Atrasos</th>
                <th className="p-3.5">Bruto Apurado</th>
                <th className="p-3.5">INSS Retido</th>
                <th className="p-3.5">IRRF</th>
                <th className="p-3.5">Benefícios (VT/VA/Saúde)</th>
                <th className="p-3.5 text-right">Líquido a Pagar</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-slate-500">
                    Nenhum cálculo processado para {selectedMonth}. Clique em &quot;Calcular Folha com Rúbricas&quot;.
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
                    <td className="p-3.5 tabular-nums font-mono text-amber-300">
                      {rec.extraordinary_amount && rec.extraordinary_amount > 0 ? (
                        <div>
                          <span className="font-bold">+{formatBRL(rec.extraordinary_amount)}</span>
                          {rec.deductions_json?.extraordinary_earnings && (
                            <div className="text-[10px] text-slate-400 space-y-0.5 mt-0.5 font-sans">
                              {rec.deductions_json.extraordinary_earnings.map((ex, idx) => (
                                <div key={idx} className="truncate max-w-[130px]" title={ex.rubric}>
                                  {ex.rubric}: {formatBRL(ex.amount)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
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
                    <td className="p-3.5 tabular-nums font-mono text-rose-300">
                      {rec.benefits_deduction && rec.benefits_deduction > 0 ? (
                        <div>
                          <span>-{formatBRL(rec.benefits_deduction)}</span>
                          <span className="text-[9px] text-slate-400 block font-sans">
                            VT, VA, Saúde, Seguro
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="p-3.5 tabular-nums font-mono font-bold text-emerald-400 text-right text-sm">
                      {formatBRL(rec.net_amount)}
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          rec.status === 'CLOSED'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                            : rec.status === 'APPROVED'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {rec.status === 'CLOSED' ? 'CONSOLIDADA' : rec.status === 'APPROVED' ? 'APROVADO' : 'PRÉ-FOLHA'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      {rec.status !== 'APPROVED' && rec.status !== 'CLOSED' ? (
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

      {/* MODAL PARA LANÇAR REMUNERAÇÕES EXTRAORDINÁRIAS */}
      {showAddExtraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Lançar Remuneração Extraordinária</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddExtraModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Colaborador:</label>
                <select
                  value={extraEmployeeId}
                  onChange={(e) => setExtraEmployeeId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">Selecione o colaborador...</option>
                  {records.map((r) => (
                    <option key={r.employee_id} value={r.employee_id}>
                      {r.employee_name} ({r.employee_role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Tipo de Rúbrica:</label>
                <select
                  value={extraRubricType}
                  onChange={(e) => {
                    const t = e.target.value;
                    setExtraRubricType(t);
                    if (t === 'DISSIDIO_RETROATIVO') setExtraRubricName('Dissídio Coletivo Retroativo');
                    else if (t === 'PLR') setExtraRubricName('PLR Semestral (Lei 10.101/2000)');
                    else if (t === 'BONUS_PRODUTIVIDADE') setExtraRubricName('Bônus de Produtividade');
                    else if (t === 'PREMIO_DESEMPENHO') setExtraRubricName('Prêmio por Desempenho / Meta de Obra');
                    else if (t === 'GRATIFICACAO_FUNCAO') setExtraRubricName('Gratificação de Função');
                    else if (t === 'ADICIONAL_PERICULOSIDADE') setExtraRubricName('Adicional de Periculosidade (30%)');
                    else if (t === 'ADICIONAL_INSALUBRIDADE') setExtraRubricName('Adicional de Insalubridade');
                    else if (t === 'DIARIA_VIAGEM') setExtraRubricName('Diária de Deslocamento / Canteiro');
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="BONUS_PRODUTIVIDADE">Bônus de Produtividade</option>
                  <option value="DISSIDIO_RETROATIVO">Dissídio Coletivo Retroativo</option>
                  <option value="PLR">PLR (Participação nos Lucros - Isento INSS)</option>
                  <option value="PREMIO_DESEMPENHO">Prêmio Desempenho de Canteiro</option>
                  <option value="GRATIFICACAO_FUNCAO">Gratificação de Função</option>
                  <option value="ADICIONAL_PERICULOSIDADE">Adicional de Periculosidade</option>
                  <option value="ADICIONAL_INSALUBRIDADE">Adicional de Insalubridade</option>
                  <option value="DIARIA_VIAGEM">Diária de Viagem / Canteiro</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Descrição / Rótulo no Holerite:</label>
                <input
                  type="text"
                  value={extraRubricName}
                  onChange={(e) => setExtraRubricName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Valor da Rúbrica (R$):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={extraAmount}
                  onChange={(e) => setExtraAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300 block mb-0.5">Enquadramento Legal:</span>
                {extraRubricType === 'PLR' && (
                  <span className="text-emerald-400">Isento de INSS e FGTS conforme Lei Federal 10.101/2000.</span>
                )}
                {extraRubricType === 'DISSIDIO_RETROATIVO' && (
                  <span className="text-sky-400">Dissídio Coletivo da Construção Civil com incidência padrão de encargos.</span>
                )}
                {extraRubricType === 'PREMIO_DESEMPENHO' && (
                  <span className="text-amber-400">Prêmio por liberalidade conforme Art. 457 § 2º da CLT (Sem encargos previdenciários).</span>
                )}
                {extraRubricType !== 'PLR' && extraRubricType !== 'DISSIDIO_RETROATIVO' && extraRubricType !== 'PREMIO_DESEMPENHO' && (
                  <span className="text-slate-400">Incidência legal de INSS, IRRF e FGTS Digital calculada automaticamente.</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddExtraModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddExtra}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-amber-500/20"
              >
                Confirmar e Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

