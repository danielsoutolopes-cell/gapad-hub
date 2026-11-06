'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  TrendingUp,
  BarChart3,
  Layers,
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  MoveHorizontal,
  ChevronRight,
  ChevronLeft,
  DollarSign,
  Loader2,
  RefreshCw,
  Sparkles,
  Lock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { PaywallBlocker } from '@/components/ui/paywall-blocker';
import { HelpTooltip } from '@/components/ui/tooltip';

interface ProjectTask {
  id: string;
  project_id: string;
  name: string;
  start_date: string;
  end_date: string;
  progress_percentage: number;
  planned_cost: number;
  dependencies_json: string[];
  sort_order: number;
}

interface CurveSPoint {
  period: string;
  planned_percentage: number;
  realized_percentage: number;
  planned_amount: number;
  realized_amount: number;
}

interface CurveSData {
  total_budget: number;
  total_realized: number;
  current_physical_progress: number;
  current_financial_progress: number;
  data_points: CurveSPoint[];
}

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

export function CronogramaClient({
  projectId,
  projectName,
  activeModules,
}: {
  projectId: string;
  projectName: string;
  activeModules: string[];
}) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [curveData, setCurveData] = useState<CurveSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'gantt' | 'curve_s' | 'table'>('gantt');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Estados de Edição/Criação de Tarefa
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [taskName, setTaskName] = useState('');
  const [taskStart, setTaskStart] = useState('');
  const [taskEnd, setTaskEnd] = useState('');
  const [taskProgress, setTaskProgress] = useState(0);
  const [taskCost, setTaskCost] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Estado de Drag and Drop (Arrasto de Barra no Gantt)
  const [draggingTask, setDraggingTask] = useState<{
    id: string;
    mode: 'move' | 'resize-start' | 'resize-end';
    initialMouseX: number;
    initialStart: Date;
    initialEnd: Date;
  } | null>(null);

  // 1. Verificação de Paywall (Módulo GANTT - Prompt 68 / 92)
  if (!activeModules.includes('GANTT')) {
    return (
      <PaywallBlocker
        moduleName="Cronograma Físico-Financeiro & Gantt (Módulo Premium)"
        description="Gráfico de Gantt interativo com Drag-and-Drop, cálculo automático de Curva S (Planejado vs Realizado) e amarração direta com orçamentos e suprimentos da obra."
      />
    );
  }

  // 2. Carregamento de Dados
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, curveRes] = await Promise.all([
        fetch(`/api/v1/projects/${projectId}/schedule`).catch(() => null),
        fetch(`/api/v1/projects/${projectId}/curve-s`).catch(() => null),
      ]);

      if (tasksRes && tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data || []);
      }
      if (curveRes && curveRes.ok) {
        const cData = await curveRes.json();
        setCurveData(cData);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Recálculo imediato da Curva S
  const refreshCurveS = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/curve-s`);
      if (res.ok) {
        const cData = await res.json();
        setCurveData(cData);
      }
    } catch {}
  }, [projectId]);

  // Limites temporais do Gantt
  const { minTimelineDate, maxTimelineDate, totalDays } = useMemo(() => {
    if (tasks.length === 0) {
      const today = new Date();
      return {
        minTimelineDate: today,
        maxTimelineDate: new Date(today.getTime() + 180 * 86400000),
        totalDays: 180,
      };
    }
    const starts = tasks.map((t) => new Date(t.start_date).getTime());
    const ends = tasks.map((t) => new Date(t.end_date).getTime());
    const minD = new Date(Math.min(...starts));
    const maxD = new Date(Math.max(...ends));
    
    // Adiciona margem de 10 dias nas pontas
    minD.setDate(minD.getDate() - 5);
    maxD.setDate(maxD.getDate() + 10);
    
    const diff = Math.max(1, Math.round((maxD.getTime() - minD.getTime()) / 86400000));
    return { minTimelineDate: minD, maxTimelineDate: maxD, totalDays: diff };
  }, [tasks]);

  // Função utilitária para converter data em % da timeline horizontal
  const getPositionPercent = (dateStr: string) => {
    const d = new Date(dateStr).getTime();
    const min = minTimelineDate.getTime();
    const max = maxTimelineDate.getTime();
    const pct = ((d - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, pct));
  };

  // Drag and Drop: Início do arrasto
  const handleDragStart = (
    e: React.MouseEvent,
    task: ProjectTask,
    mode: 'move' | 'resize-start' | 'resize-end'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingTask({
      id: task.id,
      mode,
      initialMouseX: e.clientX,
      initialStart: new Date(task.start_date),
      initialEnd: new Date(task.end_date),
    });
  };

  // Drag and Drop: Movimento global
  useEffect(() => {
    if (!draggingTask) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - draggingTask.initialMouseX;
      // 1 dia ≈ 6 pixels de arrasto
      const daysDelta = Math.round(deltaX / 6);
      if (daysDelta === 0) return;

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== draggingTask.id) return t;

          const newStart = new Date(draggingTask.initialStart);
          const newEnd = new Date(draggingTask.initialEnd);

          if (draggingTask.mode === 'move') {
            newStart.setDate(newStart.getDate() + daysDelta);
            newEnd.setDate(newEnd.getDate() + daysDelta);
          } else if (draggingTask.mode === 'resize-end') {
            newEnd.setDate(newEnd.getDate() + daysDelta);
            if (newEnd <= newStart) newEnd.setDate(newStart.getDate() + 1);
          } else if (draggingTask.mode === 'resize-start') {
            newStart.setDate(newStart.getDate() + daysDelta);
            if (newStart >= newEnd) newStart.setDate(newEnd.getDate() - 1);
          }

          return {
            ...t,
            start_date: newStart.toISOString().slice(0, 10),
            end_date: newEnd.toISOString().slice(0, 10),
          };
        })
      );
    };

    const handleMouseUp = async () => {
      const currentTask = tasks.find((t) => t.id === draggingTask.id);
      setDraggingTask(null);

      if (currentTask) {
        // Dispara sincronização com o backend e recalcula Curva S imediatamente
        try {
          await fetch(`/api/v1/projects/${projectId}/schedule/${currentTask.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              start_date: currentTask.start_date,
              end_date: currentTask.end_date,
            }),
          });
          refreshCurveS();
        } catch {}
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingTask, tasks, projectId, refreshCurveS]);

  // Salvar Tarefa (Criar / Editar)
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName || !taskStart || !taskEnd) return;
    setIsSaving(true);
    try {
      if (editingTask) {
        const res = await fetch(`/api/v1/projects/${projectId}/schedule/${editingTask.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: taskName,
            start_date: taskStart,
            end_date: taskEnd,
            progress_percentage: Number(taskProgress),
            planned_cost: Number(taskCost),
          }),
        });
        if (res.ok) {
          const updated = await res.json();
          setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        }
      } else {
        const res = await fetch(`/api/v1/projects/${projectId}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: taskName,
            start_date: taskStart,
            end_date: taskEnd,
            progress_percentage: Number(taskProgress),
            planned_cost: Number(taskCost),
            sort_order: tasks.length + 1,
          }),
        });
        if (res.ok) {
          const created = await res.json();
          setTasks((prev) => [...prev, created]);
        }
      }
      setShowTaskModal(false);
      setEditingTask(null);
      refreshCurveS();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Deseja excluir esta etapa do cronograma?')) return;
    try {
      await fetch(`/api/v1/projects/${projectId}/schedule/${taskId}`, {
        method: 'DELETE',
      });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      refreshCurveS();
    } catch {}
  };

  const openCreateModal = () => {
    setEditingTask(null);
    setTaskName('');
    const today = new Date().toISOString().slice(0, 10);
    setTaskStart(today);
    const end = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    setTaskEnd(end);
    setTaskProgress(0);
    setTaskCost('50000');
    setShowTaskModal(true);
  };

  const openEditModal = (t: ProjectTask) => {
    setEditingTask(t);
    setTaskName(t.name);
    setTaskStart(t.start_date);
    setTaskEnd(t.end_date);
    setTaskProgress(t.progress_percentage);
    setTaskCost(String(t.planned_cost || '0'));
    setShowTaskModal(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/dashboard/obras`}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar às Obras
            </Link>
            <span className="text-slate-600">•</span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              Prompt 92 • Cronograma Físico-Financeiro (Gantt Premium)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Calendar className="w-7 h-7 text-amber-400" />
            <span>Cronograma Físico-Financeiro • {projectName}</span>
            <HelpTooltip
              title="Gantt & Curva S Interativa"
              content="Linha do tempo física da obra amarrada aos custos orçamentários. Você pode arrastar as barras das etapas para alterar as datas (Drag-and-Drop), recalculando instantaneamente o avanço físico e a Curva S da obra."
            />
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Gráfico de Gantt interativo com avanço ponderado, controle de predecessores e Curva S analítica (Planejado vs. Realizado).
          </p>
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Etapa</span>
          </button>
        </div>
      </div>

      {/* METRIC CARDS RESUMO */}
      {curveData && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 uppercase block">
              Orçamento Total Planejado
            </span>
            <span className="text-2xl font-extrabold text-white font-mono mt-1 block">
              {formatBRL(curveData.total_budget)}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 uppercase block">
              Realizado Financeiro (Medido)
            </span>
            <span className="text-2xl font-extrabold text-emerald-400 font-mono mt-1 block">
              {formatBRL(curveData.total_realized)}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 uppercase block">
              Avanço Físico Global
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-amber-400 font-mono">
                {curveData.current_physical_progress}%
              </span>
              <span className="text-xs text-slate-400">das etapas concluídas</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/30 bg-amber-500/5">
            <span className="text-[11px] font-bold text-amber-300 uppercase block">
              Avanço Financeiro
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-white font-mono">
                {curveData.current_financial_progress}%
              </span>
              <span className="text-xs text-slate-400">do orçamento liberado</span>
            </div>
          </div>
        </div>
      )}

      {/* ABAS DE NAVEGAÇÃO */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('gantt')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'gantt'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Linha do Tempo (Gráfico de Gantt)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('curve_s')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'curve_s'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Curva S (Planejado vs. Realizado)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('table')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'table'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Tabela Detalhada de Etapas</span>
        </button>
      </div>

      {/* CONTEÚDO DA ABA 1: GRÁFICO DE GANTT INTERATIVO */}
      {activeTab === 'gantt' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <MoveHorizontal className="w-4 h-4 text-amber-400" />
              <span>
                <strong>Dica de Interação:</strong> Arraste o corpo da barra para alterar as datas de início/fim, ou as bordas para redimensionar a duração da etapa.
              </span>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500 block" /> Concluído / Em Execução
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-800 border border-slate-700 block" /> Previsto
              </span>
            </div>
          </div>

          {/* GRID DO GANTT */}
          <div className="overflow-x-auto select-none">
            <div className="min-w-[850px] space-y-2">
              {/* Régua de Tempo */}
              <div className="flex items-center border-b border-slate-800 pb-2 text-[11px] font-mono text-slate-400">
                <div className="w-64 flex-shrink-0 font-bold uppercase tracking-wider text-white">
                  Etapa / Pacote de Trabalho
                </div>
                <div className="flex-1 flex justify-between px-2">
                  <span>{minTimelineDate.toLocaleDateString('pt-BR')}</span>
                  <span>Meio da Obra</span>
                  <span>{maxTimelineDate.toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              {/* Linhas das Tarefas */}
              {tasks.map((task) => {
                const leftPct = getPositionPercent(task.start_date);
                const rightPct = getPositionPercent(task.end_date);
                const widthPct = Math.max(3, rightPct - leftPct);

                return (
                  <div
                    key={task.id}
                    className="flex items-center group hover:bg-slate-800/30 p-2 rounded-xl transition-all"
                  >
                    {/* Coluna Esquerda: Nome e Ações */}
                    <div className="w-64 flex-shrink-0 pr-3 flex items-center justify-between">
                      <div className="truncate">
                        <span className="text-xs font-bold text-white block truncate" title={task.name}>
                          {task.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {task.progress_percentage}% • {formatBRL(task.planned_cost)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => openEditModal(task)}
                          className="p-1 text-slate-400 hover:text-amber-400"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1 text-slate-400 hover:text-rose-400"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Coluna Direita: Pista da Barra do Gantt */}
                    <div className="flex-1 h-9 bg-slate-950/80 rounded-xl relative overflow-hidden border border-slate-800/80">
                      {/* Grid de Linhas Verticais de Fundo */}
                      <div className="absolute inset-0 grid grid-cols-6 divide-x divide-slate-800/40 pointer-events-none" />

                      {/* Barra Interativa da Tarefa */}
                      <div
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                        }}
                        onMouseDown={(e) => handleDragStart(e, task, 'move')}
                        className={`absolute top-1 bottom-1 rounded-lg border cursor-grab active:cursor-grabbing transition-shadow flex items-center px-2 group/bar ${
                          task.progress_percentage >= 100
                            ? 'bg-emerald-600/30 border-emerald-500/50 hover:border-emerald-400'
                            : 'bg-amber-500/20 border-amber-500/40 hover:border-amber-400'
                        }`}
                      >
                        {/* Alça Redimensionar Início */}
                        <div
                          onMouseDown={(e) => handleDragStart(e, task, 'resize-start')}
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/40 rounded-l"
                        />

                        {/* Barra de Progresso Físico Interna */}
                        <div
                          style={{ width: `${task.progress_percentage}%` }}
                          className={`absolute left-0 top-0 bottom-0 rounded-l transition-all pointer-events-none ${
                            task.progress_percentage >= 100 ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />

                        {/* Texto dentro da Barra */}
                        <span className="relative z-10 text-[10px] font-bold text-white truncate drop-shadow">
                          {task.progress_percentage}% ({new Date(task.start_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} até {new Date(task.end_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})
                        </span>

                        {/* Alça Redimensionar Fim */}
                        <div
                          onMouseDown={(e) => handleDragStart(e, task, 'resize-end')}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/40 rounded-r"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: CURVA S (PLANEJADO VS REALIZADO) */}
      {activeTab === 'curve_s' && curveData && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                Curva S de Engenharia (Avanço Físico-Financeiro Acumulado)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Compara a curva teórica planejada (sigmoide do cronograma) com os valores reais aprovados nas medições e cotações.
              </p>
            </div>
            <button
              type="button"
              onClick={refreshCurveS}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Atualizar Curva</span>
            </button>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={curveData.data_points} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="period" stroke="#64748b" fontSize={11} />
                <YAxis
                  yAxisId="left"
                  stroke="#64748b"
                  fontSize={11}
                  unit="%"
                  domain={[0, 100]}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '12px' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                  formatter={(val: any, name: any) => {
                    if (name.includes('Valor')) return [formatBRL(val), name];
                    return [`${val}%`, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar
                  yAxisId="right"
                  dataKey="realized_amount"
                  name="Gasto Realizado no Mês (R$)"
                  fill="#10b981"
                  opacity={0.3}
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="planned_percentage"
                  name="% Planejado Acumulado"
                  stroke="#38bdf8"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#38bdf8' }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="realized_percentage"
                  name="% Realizado Acumulado"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#10b981' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 3: TABELA DETALHADA */}
      {activeTab === 'table' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="p-4">Etapa da Obra</th>
                  <th className="p-4">Data Início</th>
                  <th className="p-4">Data Término</th>
                  <th className="p-4">Custo Planejado</th>
                  <th className="p-4">Avanço Físico</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-bold text-white text-sm">{task.name}</td>
                    <td className="p-4 text-slate-300 font-mono">
                      {new Date(task.start_date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4 text-slate-300 font-mono">
                      {new Date(task.end_date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4 tabular-nums font-mono font-bold text-amber-400">
                      {formatBRL(task.planned_cost)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                          <div
                            style={{ width: `${task.progress_percentage}%` }}
                            className={`h-full ${
                              task.progress_percentage >= 100 ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                        </div>
                        <span className="font-mono text-xs font-semibold text-white">
                          {task.progress_percentage}%
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(task)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px]"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold text-[11px]"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE TAREFA */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white pb-3 border-b border-slate-800">
              {editingTask ? 'Editar Etapa do Cronograma' : 'Nova Etapa no Cronograma'}
            </h3>

            <form onSubmit={handleSaveTask} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nome da Etapa *</label>
                <input
                  type="text"
                  required
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="Ex: Alvenaria e Fechamento de Vãos"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Data Início *</label>
                  <input
                    type="date"
                    required
                    value={taskStart}
                    onChange={(e) => setTaskStart(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Data Término *</label>
                  <input
                    type="date"
                    required
                    value={taskEnd}
                    onChange={(e) => setTaskEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Avanço Físico ({taskProgress}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={taskProgress}
                    onChange={(e) => setTaskProgress(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Custo Planejado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={taskCost}
                    onChange={(e) => setTaskCost(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Salvar Etapa</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

