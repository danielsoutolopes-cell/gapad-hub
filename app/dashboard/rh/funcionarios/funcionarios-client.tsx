'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Plus,
  Palmtree,
  UserMinus,
  AlertCircle,
  CheckCircle2,
  X,
  Calendar,
  DollarSign,
  HardHat,
  ArrowLeft,
  Loader2,
  Clock,
  FileSpreadsheet,
  Upload,
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
  termination_date?: string | null;
  termination_reason?: string | null;
  vacation_start_date?: string | null;
  vacation_end_date?: string | null;
  leave_reason?: string | null;
  current_project?: string;
  phone?: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'VACATION' | 'TERMINATED';
  epi_status?: string;
}

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

export function FuncionariosClient({ activeModules }: { activeModules: string[] }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modais de Ações
  const [showAddModal, setShowAddModal] = useState(false);
  const [vacationModalEmp, setVacationModalEmp] = useState<Employee | null>(null);
  const [leaveModalEmp, setLeaveModalEmp] = useState<Employee | null>(null);
  const [terminateModalEmp, setTerminateModalEmp] = useState<Employee | null>(null);

  // Formulário de Admissão
  const [newFullName, setNewFullName] = useState('');
  const [newCpf, setNewCpf] = useState('');
  const [newRole, setNewRole] = useState('Pedreiro');
  const [newSalary, setNewSalary] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAdmissionDate, setNewAdmissionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formulário de Férias
  const [vacStart, setVacStart] = useState('');
  const [vacEnd, setVacEnd] = useState('');

  // Formulário de Afastamento
  const [leaveReason, setLeaveReason] = useState('Licença Médica (Atestado)');

  // Formulário de Rescisão
  const [termDate, setTermDate] = useState(new Date().toISOString().slice(0, 10));
  const [termReason, setTermReason] = useState('Demissão sem justa causa');

  // Modal de Importação em Lote de Colaboradores
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/hr/employees');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.items || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const term = searchTerm.toLowerCase();
      const matchSearch =
        e.full_name.toLowerCase().includes(term) ||
        e.role.toLowerCase().includes(term) ||
        e.cpf.includes(term);
      const matchStatus = statusFilter === 'ALL' ? true : e.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [employees, searchTerm, statusFilter]);

  // Handler Admissão
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName || !newCpf || !newSalary) {
      setBanner({ type: 'error', text: 'Preencha todos os campos obrigatórios.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/hr/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: newFullName,
          cpf: newCpf,
          role: newRole,
          base_salary: parseFloat(newSalary),
          admission_date: newAdmissionDate,
          phone: newPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Falha ao cadastrar funcionário.');
      setBanner({ type: 'success', text: `Colaborador ${newFullName} admitido com sucesso!` });
      setShowAddModal(false);
      setNewFullName('');
      setNewCpf('');
      setNewSalary('');
      setNewPhone('');
      loadEmployees();
    } catch (err: any) {
      setBanner({ type: 'error', text: err.message || 'Erro ao admitir funcionário.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler Programar Férias
  const handleScheduleVacation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vacationModalEmp || !vacStart || !vacEnd) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/hr/employees/${vacationModalEmp.id}/schedule-vacation`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vacation_start_date: vacStart,
            vacation_end_date: vacEnd,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erro ao programar férias.');
      setBanner({
        type: 'success',
        text: `Férias programadas com sucesso para ${vacationModalEmp.full_name}!`,
      });
      setVacationModalEmp(null);
      setVacStart('');
      setVacEnd('');
      loadEmployees();
    } catch (err: any) {
      setBanner({ type: 'error', text: err.message || 'Erro ao programar férias.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler Afastamento
  const handleRegisterLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveModalEmp || !leaveReason) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/hr/employees/${leaveModalEmp.id}/register-leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leave_reason: leaveReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erro ao registrar afastamento.');
      setBanner({
        type: 'success',
        text: `Afastamento registrado para ${leaveModalEmp.full_name}.`,
      });
      setLeaveModalEmp(null);
      loadEmployees();
    } catch (err: any) {
      setBanner({ type: 'error', text: err.message || 'Erro ao registrar afastamento.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler Rescisão / Demitir
  const handleTerminateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminateModalEmp || !termDate || !termReason) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/hr/employees/${terminateModalEmp.id}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          termination_date: termDate,
          termination_reason: termReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erro ao registrar rescisão.');
      setBanner({
        type: 'success',
        text: `Rescisão do colaborador ${terminateModalEmp.full_name} concluída.`,
      });
      setTerminateModalEmp(null);
      loadEmployees();
    } catch (err: any) {
      setBanner({ type: 'error', text: err.message || 'Erro ao registrar rescisão.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler de Importação em Lote de Colaboradores (CSV / TSV / Texto)
  const handleImportEmployees = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim()) return;
    setIsImporting(true);

    try {
      // Faz o parsing das linhas (formato: Nome, CPF, Cargo, Salário, [Telefone], [Obra])
      const lines = importText.split('\n').map((l) => l.trim()).filter(Boolean);
      const itemsToImport: any[] = [];

      for (const line of lines) {
        // Ignora cabeçalhos se houver
        if (line.toLowerCase().includes('nome') && line.toLowerCase().includes('cpf')) continue;

        const parts = line.split(/[;,\t]/).map((p) => p.trim());
        if (parts.length >= 4) {
          const [name, cpf, role, salaryStr, phone, project] = parts;
          const salary = parseFloat(salaryStr.replace('R$', '').replace('.', '').replace(',', '.')) || 0;
          if (name && cpf && salary > 0) {
            itemsToImport.push({
              full_name: name,
              cpf: cpf,
              role: role || 'Ajudante',
              base_salary: salary,
              phone: phone || '',
              current_project: project || 'Matriz / Obra Central',
            });
          }
        }
      }

      if (itemsToImport.length === 0) {
        throw new Error('Nenhum formato válido de colaborador reconhecido. Utilize: Nome, CPF, Cargo, Salário.');
      }

      const res = await fetch('/api/v1/hr/employees/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees: itemsToImport }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Falha ao importar colaboradores.');

      setBanner({
        type: 'success',
        text: data.message || `${data.imported_count} colaboradores importados com sucesso!`,
      });
      setShowImportModal(false);
      setImportText('');
      loadEmployees();
    } catch (err: any) {
      setBanner({ type: 'error', text: err.message || 'Erro ao importar relação de colaboradores.' });
    } finally {
      setIsImporting(false);
    }
  };

  if (!activeModules.includes('RH')) {
    return (
      <PaywallBlocker
        moduleName="Central do Colaborador"
        description="Gestão de cadastro e ciclo de vida completo de funcionários."
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
            <Users className="w-7 h-7 text-emerald-400" />
            <span>Central do Colaborador</span>
            <HelpTooltip
              title="Ações no Ciclo de Vida"
              content="Admissão rápida de funcionários com definição de salário-base CLT. Permite programar férias (atualizando status para VACATION), registrar afastamentos por motivo médico ou formalizar rescisões contratuais."
            />
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Admissões de pessoal, programação de férias, licenças e registro formal de desligamentos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl shadow-sm flex items-center gap-2 cursor-pointer transition-all"
            title="Importar lista de colaboradores a partir de planilha, texto ou CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Importar Lista</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Admissão</span>
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

      {/* BARRA DE FILTROS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, CPF ou função..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
          >
            <option value="ALL">Todos os Status</option>
            <option value="ACTIVE">Ativos</option>
            <option value="VACATION">Em Férias</option>
            <option value="ON_LEAVE">Afastados</option>
            <option value="TERMINATED">Rescindidos</option>
          </select>
        </div>
      </div>

      {/* TABELA DE FUNCIONÁRIOS COM AÇÕES NA LINHA (REQUISITO 3) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                <th className="p-4">Colaborador</th>
                <th className="p-4">Função</th>
                <th className="p-4">Salário Base</th>
                <th className="p-4">Admissão</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações de DP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Nenhum colaborador encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white text-sm">{emp.full_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                        <span>CPF: {emp.cpf}</span>
                        {emp.phone && (
                          <>
                            <span>•</span>
                            <span>{emp.phone}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-slate-300 font-medium">{emp.role}</td>
                    <td className="p-4 tabular-nums font-mono font-bold text-emerald-400">
                      {formatBRL(emp.base_salary)}
                    </td>
                    <td className="p-4 text-slate-300 tabular-nums">
                      {new Date(emp.admission_date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
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
                          ? 'FÉRIAS'
                          : emp.status === 'ON_LEAVE'
                          ? 'AFASTADO'
                          : 'RESCINDIDO'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {emp.status !== 'TERMINATED' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {/* AÇÃO 1: PROGRAMAR FÉRIAS */}
                          <button
                            type="button"
                            onClick={() => setVacationModalEmp(emp)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                            title="Programar Férias"
                          >
                            <Palmtree className="w-3.5 h-3.5" />
                            <span>Férias</span>
                          </button>

                          {/* AÇÃO 2: REGISTRAR AFASTAMENTO */}
                          <button
                            type="button"
                            onClick={() => setLeaveModalEmp(emp)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                            title="Registrar Afastamento / Atestado"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Afastar</span>
                          </button>

                          {/* AÇÃO 3: DEMITIR */}
                          <button
                            type="button"
                            onClick={() => setTerminateModalEmp(emp)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                            title="Registrar Rescisão Contratual"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            <span>Demitir</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">
                          Rescindido em {emp.termination_date || 'Data anterior'}
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

      {/* MODAL 1: NOVA ADMISSÃO */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Admissão de Colaborador</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo de Oliveira"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">CPF *</label>
                  <input
                    type="text"
                    required
                    value={newCpf}
                    onChange={(e) => setNewCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Função *</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  >
                    <option value="Pedreiro">Pedreiro</option>
                    <option value="Servente">Servente</option>
                    <option value="Eletricista">Eletricista</option>
                    <option value="Encanador">Encanador</option>
                    <option value="Carpinteiro">Carpinteiro</option>
                    <option value="Mestre de Obras">Mestre de Obras</option>
                    <option value="Engenheiro Residente">Engenheiro Residente</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Salário Base (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newSalary}
                    onChange={(e) => setNewSalary(e.target.value)}
                    placeholder="2800.00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Data de Admissão
                  </label>
                  <input
                    type="date"
                    required
                    value={newAdmissionDate}
                    onChange={(e) => setNewAdmissionDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirmar Admissão</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PROGRAMAR FÉRIAS */}
      {vacationModalEmp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Palmtree className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Programar Férias</h3>
              </div>
              <button
                type="button"
                onClick={() => setVacationModalEmp(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Colaborador: <strong className="text-white">{vacationModalEmp.full_name}</strong> (
              {vacationModalEmp.role})
            </p>

            <form onSubmit={handleScheduleVacation} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Início das Férias</label>
                  <input
                    type="date"
                    required
                    value={vacStart}
                    onChange={(e) => setVacStart(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Término das Férias</label>
                  <input
                    type="date"
                    required
                    value={vacEnd}
                    onChange={(e) => setVacEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300">
                O status do colaborador será atualizado para <strong className="text-amber-200">VACATION</strong> e as datas ficarão registradas no histórico funcional.
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setVacationModalEmp(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Salvar Programação</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REGISTRAR AFASTAMENTO */}
      {leaveModalEmp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">Registrar Afastamento / Licença</h3>
              </div>
              <button
                type="button"
                onClick={() => setLeaveModalEmp(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Colaborador: <strong className="text-white">{leaveModalEmp.full_name}</strong>
            </p>

            <form onSubmit={handleRegisterLeave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Motivo do Afastamento
                </label>
                <select
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                >
                  <option value="Licença Médica (Atestado)">Licença Médica (Atestado)</option>
                  <option value="Acidente de Trabalho (CAT)">Acidente de Trabalho (CAT)</option>
                  <option value="Licença Paternidade / Maternidade">
                    Licença Paternidade / Maternidade
                  </option>
                  <option value="Afastamento Previdenciário (INSS)">
                    Afastamento Previdenciário (INSS)
                  </option>
                  <option value="Outros Motivos Legais">Outros Motivos Legais</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setLeaveModalEmp(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirmar Afastamento</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RESCISÃO CONTRATUAL */}
      {terminateModalEmp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <UserMinus className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Registrar Rescisão Contratual</h3>
              </div>
              <button
                type="button"
                onClick={() => setTerminateModalEmp(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Você está formalizando a saída de:{' '}
              <strong className="text-white">{terminateModalEmp.full_name}</strong> (
              {terminateModalEmp.role})
            </p>

            <form onSubmit={handleTerminateEmployee} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Data da Rescisão</label>
                <input
                  type="date"
                  required
                  value={termDate}
                  onChange={(e) => setTermDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Motivo do Desligamento
                </label>
                <select
                  value={termReason}
                  onChange={(e) => setTermReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                >
                  <option value="Demissão sem justa causa">Demissão sem justa causa</option>
                  <option value="Pedido de demissão">Pedido de demissão</option>
                  <option value="Término de contrato por prazo determinado">
                    Término de contrato por prazo determinado
                  </option>
                  <option value="Acordo mútuo (Art. 484-A CLT)">
                    Acordo mútuo (Art. 484-A CLT)
                  </option>
                  <option value="Demissão com justa causa">Demissão com justa causa</option>
                </select>
              </div>

              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-[11px] text-rose-300">
                O colaborador será inativado na base com status <strong className="text-rose-200">TERMINATED</strong> e retirado dos cálculos futuros da folha de pagamento.
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setTerminateModalEmp(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Efetivar Rescisão</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE IMPORTAÇÃO DE FUNCIONÁRIOS EM LOTE */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Importação em Lote de Colaboradores</h3>
                  <p className="text-xs text-slate-400">Cole linhas de planilha (Excel / Google Sheets) ou arquivo CSV / TSV</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2">
              <p className="font-semibold text-slate-200">Formato esperado por linha (separado por TAB ou ponto-e-vírgula):</p>
              <code className="block bg-slate-900 p-2 rounded text-[11px] text-emerald-300 overflow-x-auto font-mono">
                Nome; CPF; Cargo; Salário Base; Telefone; Nome da Obra
              </code>
              <p className="text-[11px] text-slate-400">
                • Se o CPF já existir no cadastro, ele será desconsiderado para evitar duplicidade.<br/>
                • Linhas de cabeçalho com a palavra &quot;nome&quot; ou &quot;cpf&quot; são ignoradas automaticamente.
              </p>
            </div>

            <form onSubmit={handleImportEmployees} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Conteúdo da Relação de Funcionários
                </label>
                <textarea
                  rows={8}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`João da Silva\t123.456.789-00\tPedreiro\t2800\t(11) 98888-1111\tEdifício Horizonte\nMaria Santos\t987.654.321-99\tEngenheira Civil\t8500\t(11) 97777-2222\tMatriz`}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs focus:border-emerald-500 focus:outline-none placeholder:text-slate-600"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                <span className="text-slate-400">
                  {importText.trim() ? `${importText.trim().split('\n').length} linha(s) detectada(s)` : 'Nenhuma linha inserida'}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportText('');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isImporting || !importText.trim()}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Processando Importação...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Confirmar e Importar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

