'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  HardHat,
  ShieldAlert,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Calendar,
  Briefcase,
  FileSpreadsheet,
  ArrowRight,
  TrendingUp,
  UserCheck,
  Palmtree,
  UserMinus,
  Plus,
} from 'lucide-react';
import { PaywallBlocker } from '@/components/ui/paywall-blocker';
import { HelpTooltip } from '@/components/ui/tooltip';

interface Employee {
  id: string;
  full_name: string;
  role: string;
  cpf: string;
  base_salary: number;
  daily_wage?: number;
  admission_date: string;
  current_project?: string;
  phone?: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'VACATION' | 'TERMINATED';
  epi_status?: string;
}

interface PayrollRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  gross_amount: number;
  net_amount: number;
  reference_month: string;
}

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

export function RhClient({ activeModules }: { activeModules: string[] }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollSummary, setPayrollSummary] = useState<{
    totalGross: number;
    totalNet: number;
    referenceMonth: string;
  }>({
    totalGross: 0,
    totalNet: 0,
    referenceMonth: new Date().toISOString().slice(0, 7),
  });
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, payRes] = await Promise.all([
        fetch('/api/v1/hr/employees').catch(() => null),
        fetch(`/api/v1/hr/payroll/records?reference_month=${new Date().toISOString().slice(0, 7)}`).catch(() => null),
      ]);

      if (empRes && empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData.items || []);
      }
      if (payRes && payRes.ok) {
        const payData = await payRes.json();
        setPayrollSummary({
          totalGross: payData.total_gross || 0,
          totalNet: payData.total_net || 0,
          referenceMonth: payData.reference_month || new Date().toISOString().slice(0, 7),
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!activeModules.includes('RH')) {
    return (
      <PaywallBlocker
        moduleName="RH & Departamento Pessoal Completo"
        description="Gestão integrada de admissões, férias, afastamentos, rescisões, ponto eletrônico com Geofencing e cálculo inteligente de folha."
      />
    );
  }

  const activeEmployees = employees.filter((e) => e.status === 'ACTIVE');
  const vacationEmployees = employees.filter((e) => e.status === 'VACATION');
  const onLeaveEmployees = employees.filter((e) => e.status === 'ON_LEAVE');
  const terminatedEmployees = employees.filter((e) => e.status === 'TERMINATED');

  // Custo da Folha Projetada: se ainda não houver folha calculada, projeta pela soma dos salários base ativos
  const projectedGross =
    payrollSummary.totalGross > 0
      ? payrollSummary.totalGross
      : activeEmployees.reduce((acc, curr) => acc + (Number(curr.base_salary) || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Fase 16 • Departamento Pessoal 360° (Prompt 65 v2.0)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-emerald-400" />
            <span>Departamento Pessoal &amp; RH</span>
            <HelpTooltip
              title="Ciclo de Vida do Funcionário & Folha"
              content="Gestão integrada da admissão à rescisão. O cálculo de folha cruza o salário-base com as batidas de ponto (GPS), aplicando adicionais de horas extras e deduzindo faltas automaticamente com retenções legais."
            />
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Admissões, programação de férias, afastamentos, rescisões e processamento automatizado de folha de pagamento para obras.
          </p>
        </div>

        {/* ATALHOS RÁPIDOS */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/dashboard/rh/funcionarios"
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Central do Colaborador</span>
          </Link>

          <Link
            href="/dashboard/rh/folha"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 border border-emerald-400/30 flex items-center gap-2 transition-all"
          >
            <DollarSign className="w-4 h-4" />
            <span>Processamento de Folha</span>
          </Link>

          <Link
            href="/dashboard/rh/ponto"
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Ponto GPS</span>
          </Link>
        </div>
      </div>

      {/* METRIC CARDS (OBRIGATÓRIO REQUISITO 3) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* CARD 1: FUNCIONÁRIOS ATIVOS */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Funcionários Ativos
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight tabular-nums font-mono">
              {activeEmployees.length}
            </span>
            <span className="text-xs text-slate-400">colaboradores no canteiro</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Total cadastrados: {employees.length}</span>
            <Link
              href="/dashboard/rh/funcionarios"
              className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
            >
              Ver equipe <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* CARD 2: PESSOAS EM FÉRIAS */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Pessoas em Férias
            </span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Palmtree className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-300 tracking-tight tabular-nums font-mono">
              {vacationEmployees.length}
            </span>
            <span className="text-xs text-slate-400">em descanso programado</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Afastamentos: {onLeaveEmployees.length}</span>
            <Link
              href="/dashboard/rh/funcionarios?status=VACATION"
              className="text-amber-400 hover:underline flex items-center gap-1 font-semibold"
            >
              Gerenciar férias <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* CARD 3: CUSTO TOTAL DA FOLHA PROJETADA */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Custo Folha Projetada ({payrollSummary.referenceMonth})
            </span>
            <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight tabular-nums font-mono">
              {formatBRL(projectedGross)}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Líquido: {formatBRL(payrollSummary.totalNet)}</span>
            <Link
              href="/dashboard/rh/folha"
              className="text-teal-400 hover:underline flex items-center gap-1 font-semibold"
            >
              Abrir folha <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* SEÇÃO RÁPIDA: QUADRO DE FUNCIONÁRIOS E STATUS DE EPI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LISTAGEM DOS PRINCIPAIS COLABORADORES */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-white">
              <HardHat className="w-4 h-4 text-emerald-400" />
              <span>Colaboradores Alocados nos Canteiros</span>
            </div>
            <Link
              href="/dashboard/rh/funcionarios"
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              Ver todos →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="p-3.5">Colaborador</th>
                  <th className="p-3.5">Função</th>
                  <th className="p-3.5">Salário Base</th>
                  <th className="p-3.5">Obra / Alocação</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {employees.slice(0, 5).map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-white">{emp.full_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{emp.cpf}</div>
                    </td>
                    <td className="p-3.5 text-slate-300">{emp.role}</td>
                    <td className="p-3.5 tabular-nums font-mono font-semibold text-emerald-400">
                      {formatBRL(emp.base_salary)}
                    </td>
                    <td className="p-3.5 text-slate-300">
                      {emp.current_project || 'Canteiro Principal'}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          emp.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : emp.status === 'VACATION'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : emp.status === 'ON_LEAVE'
                            ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                            : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {emp.status === 'ACTIVE'
                          ? 'ATIVO'
                          : emp.status === 'VACATION'
                          ? 'EM FÉRIAS'
                          : emp.status === 'ON_LEAVE'
                          ? 'AFASTADO'
                          : 'RESCINDIDO'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ALERTAS DE EPI E SEGURANÇA */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <span>Conformidade &amp; EPI (NR-6 / NR-18)</span>
          </div>
          <p className="text-xs text-slate-400">
            Acompanhe o vencimento de Certificados de Aprovação (CA) para evitar passivos trabalhistas.
          </p>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-white">Antônio Ferreira (Pedreiro)</div>
                <div className="text-slate-400 text-[11px]">Capacete de Segurança (CA-35890)</div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30">
                Vence em 25 dias
              </span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-white">João Carlos de Lima (Eletricista)</div>
                <div className="text-slate-400 text-[11px]">Luva Isolante de Borracha (CA-12940)</div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold text-[10px] border border-rose-500/30">
                VENCIDO - Trocar Já
              </span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/dashboard/rh/ponto"
              className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Ver Auditoria de Ponto Geofenced</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
