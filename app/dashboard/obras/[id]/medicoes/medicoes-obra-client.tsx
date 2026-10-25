'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calculator,
  HardHat,
  ArrowLeft,
  Plus,
  Calendar,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck2,
  Layers,
  ChevronRight,
  TrendingUp,
  X,
  Loader2,
  Building2,
  Check,
  Tag,
  Percent,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ContextualHelp } from '@/components/help/contextual-help';

// -----------------------------------------------------------------------------
// 1. Schema de Validação com Zod
// -----------------------------------------------------------------------------
const measurementFormSchema = z
  .object({
    periodo_inicio: z.string().min(1, 'Data de início é obrigatória.'),
    periodo_fim: z.string().min(1, 'Data de término é obrigatória.'),
    valor_medido: z
      .union([z.string(), z.number()])
      .refine((v) => Number(v) > 0, { message: 'O valor medido deve ser maior que zero.' })
      .transform((v) => Number(v)),
    retencao_tecnica_perc: z
      .union([z.string(), z.number()])
      .refine((v) => Number(v) >= 0 && Number(v) <= 100, {
        message: 'A retenção deve estar entre 0% e 100%.',
      })
      .transform((v) => Number(v)),
    observacoes: z.string().optional(),
  })
  .refine((data) => new Date(data.periodo_fim) >= new Date(data.periodo_inicio), {
    message: 'A data de término não pode ser anterior à data de início do período.',
    path: ['periodo_fim'],
  });

type MeasurementFormData = z.infer<typeof measurementFormSchema>;

interface ProjectDetail {
  id: string;
  name: string;
  code?: string | null;
  cno?: string | null;
  contract_value: number;
  technical_retention_perc: number;
  status: string;
  clients?: {
    name: string;
    document: string;
  } | null;
}

interface MeasurementItem {
  id: string;
  tenant_id: string;
  project_id: string;
  numero_sequencial: number;
  periodo_inicio: string;
  periodo_fim: string;
  valor_medido: number;
  retencao_tecnica: number;
  valor_liquido: number;
  status: 'rascunho' | 'enviada' | 'aprovada' | 'faturada' | 'rejeitada';
  observacoes?: string | null;
  created_at: string;
}

interface MedicoesObraClientProps {
  projectId: string;
}

export function MedicoesObraClient({ projectId }: MedicoesObraClientProps) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // 2. Consulta dos Detalhes da Obra
  // ---------------------------------------------------------------------------
  const {
    data: project,
    isLoading: isLoadingProject,
    error: projectError,
  } = useQuery<ProjectDetail>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Sessão expirada. Efetue login novamente.');
      }

      // Tenta rota FastAPI
      try {
        const res = await fetch(`/api/v1/projects/${projectId}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn('Fallback para Supabase ao buscar obra...', e);
      }

      // Fallback via Supabase Client
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          code,
          cno,
          contract_value,
          technical_retention_perc,
          status,
          clients (
            name,
            document
          )
        `)
        .eq('id', projectId)
        .single();

      if (error) throw error;
      return data as unknown as ProjectDetail;
    },
  });

  // ---------------------------------------------------------------------------
  // 3. Consulta da Lista de Medições da Obra
  // ---------------------------------------------------------------------------
  const {
    data: measurements = [],
    isLoading: isLoadingMeasurements,
    refetch: refetchMeasurements,
  } = useQuery<MeasurementItem[]>({
    queryKey: ['measurements', projectId],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Sessão expirada. Efetue login novamente.');
      }

      // Tenta rota FastAPI /api/v1/measurements?project_id={projectId}
      try {
        const res = await fetch(`/api/v1/measurements?project_id=${projectId}&limit=100`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn('Fallback para Supabase ao listar medições...', e);
      }

      // Fallback via Supabase Client
      const { data, error } = await supabase
        .from('medicoes')
        .select(`
          id,
          tenant_id,
          project_id,
          numero_sequencial,
          periodo_inicio,
          periodo_fim,
          valor_medido,
          retencao_tecnica,
          valor_liquido,
          status,
          observacoes,
          created_at
        `)
        .eq('project_id', projectId)
        .order('numero_sequencial', { ascending: false });

      if (error) throw error;
      return (data || []) as MeasurementItem[];
    },
  });

  // ---------------------------------------------------------------------------
  // 4. React Hook Form Setup com Preview em Tempo Real
  // ---------------------------------------------------------------------------
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .split('T')[0];

  const defaultRetention = Number(project?.technical_retention_perc ?? 5.0);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<MeasurementFormData>({
    resolver: zodResolver(measurementFormSchema) as any,
    defaultValues: {
      periodo_inicio: firstDay,
      periodo_fim: lastDay,
      valor_medido: 0,
      retencao_tecnica_perc: defaultRetention,
      observacoes: '',
    },
    mode: 'onChange',
  });

  // Watchers reativos para o preview em tempo real
  const watchedValorMedido = watch('valor_medido');
  const watchedRetencaoPerc = watch('retencao_tecnica_perc');

  // Preview em Tempo Real do Valor Líquido no Frontend
  const previewCalculation = useMemo(() => {
    const bruto = Number(watchedValorMedido) || 0;
    const perc = Number(watchedRetencaoPerc) || 0;
    const rate = perc > 1 ? perc / 100 : perc;
    const retencao = bruto * rate;
    const liquido = Math.max(0, bruto - retencao);

    return {
      bruto,
      ratePerc: rate * 100,
      retencao,
      liquido,
    };
  }, [watchedValorMedido, watchedRetencaoPerc]);

  // ---------------------------------------------------------------------------
  // 5. Mutação para Criar Nova Medição
  // ---------------------------------------------------------------------------
  const createMeasurementMutation = useMutation({
    mutationFn: async (data: MeasurementFormData) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      // REGRA: O frontend envia APENAS valor_medido e retencao_tecnica_perc.
      // O backend Python calcula deterministicamente a retenção e o líquido.
      const payload = {
        project_id: projectId,
        periodo_inicio: data.periodo_inicio,
        periodo_fim: data.periodo_fim,
        valor_medido: data.valor_medido,
        retencao_tecnica_perc: data.retencao_tecnica_perc,
        status: 'rascunho',
        observacoes: data.observacoes || null,
      };

      // Tenta rota FastAPI /api/v1/measurements
      let res = await fetch('/api/v1/measurements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Fallback robusto direto via Supabase Client
        const tenantId =
          session.user.app_metadata?.tenant_id || session.user.user_metadata?.tenant_id;

        // Auto-incrementa numero_sequencial
        const nextSeq =
          measurements.length > 0
            ? Math.max(...measurements.map((m) => m.numero_sequencial)) + 1
            : 1;

        const rate =
          data.retencao_tecnica_perc > 1
            ? data.retencao_tecnica_perc / 100
            : data.retencao_tecnica_perc;
        const retencaoCalc = Number((data.valor_medido * rate).toFixed(4));
        const liquidoCalc = Number((data.valor_medido - retencaoCalc).toFixed(4));

        const { data: created, error: sbError } = await supabase
          .from('medicoes')
          .insert({
            tenant_id: tenantId,
            project_id: projectId,
            numero_sequencial: nextSeq,
            periodo_inicio: data.periodo_inicio,
            periodo_fim: data.periodo_fim,
            valor_medido: data.valor_medido,
            retencao_tecnica: retencaoCalc,
            valor_liquido: liquidoCalc,
            status: 'rascunho',
            observacoes: data.observacoes || null,
          })
          .select()
          .single();

        if (sbError) throw sbError;
        return created;
      }

      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['measurements', projectId] });
      reset();
      setIsModalOpen(false);
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Falha ao registrar medição.');
    },
  });

  // ---------------------------------------------------------------------------
  // 6. Mutação para Aprovar Medição
  // ---------------------------------------------------------------------------
  const approveMeasurementMutation = useMutation({
    mutationFn: async (measurementId: string) => {
      setApprovingId(measurementId);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      // Tenta rota FastAPI /api/v1/measurements/{id}
      let res = await fetch(`/api/v1/measurements/${measurementId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status: 'aprovada' }),
      });

      if (!res.ok) {
        // Fallback via Supabase Client
        const { data, error: sbError } = await supabase
          .from('medicoes')
          .update({ status: 'aprovada' })
          .eq('id', measurementId)
          .select()
          .single();

        if (sbError) throw sbError;
        return data;
      }

      return await res.json();
    },
    onSuccess: () => {
      setApprovingId(null);
      queryClient.invalidateQueries({ queryKey: ['measurements', projectId] });
    },
    onError: (err: any) => {
      setApprovingId(null);
      alert(`Falha ao aprovar medição: ${err.message || 'Erro inesperado'}`);
    },
  });

  const onSubmit = (formData: MeasurementFormData) => {
    setErrorMessage(null);
    createMeasurementMutation.mutate(formData);
  };

  // ---------------------------------------------------------------------------
  // 7. KPIs Físico-Financeiros da Obra
  // ---------------------------------------------------------------------------
  const contractTotal = Number(project?.contract_value) || 0;
  const totalMedidoAcumulado = measurements.reduce(
    (acc, m) => acc + (Number(m.valor_medido) || 0),
    0
  );
  const totalRetencaoAcumulada = measurements.reduce(
    (acc, m) => acc + (Number(m.retencao_tecnica) || 0),
    0
  );
  const totalLiquidoAprovado = measurements
    .filter((m) => m.status === 'aprovada' || m.status === 'faturada')
    .reduce((acc, m) => acc + (Number(m.valor_liquido) || 0), 0);

  const saldoContratual = Math.max(0, contractTotal - totalMedidoAcumulado);
  const percentConcluido =
    contractTotal > 0 ? (totalMedidoAcumulado / contractTotal) * 100 : 0;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'rascunho':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            Rascunho
          </span>
        );
      case 'enviada':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <TrendingUp className="w-3 h-3" />
            Enviada ao Cliente
          </span>
        );
      case 'aprovada':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Aprovada
          </span>
        );
      case 'faturada':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <FileCheck2 className="w-3 h-3" />
            Faturada (NFS-e)
          </span>
        );
      case 'rejeitada':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" />
            Rejeitada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de Navegação Superior */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/obras"
          className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Lista de Obras
        </Link>

        {project?.code && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-slate-800/80 text-slate-300 border border-slate-700/80">
            {project.code}
          </span>
        )}
      </div>

      {/* Cabeçalho da Obra com Botão de Ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Canteiro de Obras
            </span>
            {project?.cno && (
              <span className="text-xs text-slate-500 font-mono">CNO: {project.cno}</span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3 mt-1">
            <HardHat className="w-8 h-8 text-emerald-400" />
            {project?.name || 'Carregando Obra...'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Cliente Contratante:</span>
            <span className="text-slate-200 font-medium">
              {project?.clients?.name || 'Cliente Geral'}
            </span>
            {project?.clients?.document && (
              <span className="text-slate-500 font-mono">({project.clients.document})</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ContextualHelp topic="medicoes" variant="badge" triggerText="Como funciona a Retenção?" />
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Lançar Medição
          </button>
        </div>
      </div>

      {/* KPI Cards: Acompanhamento Físico-Financeiro */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Contrato Pactuado</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-white mt-1">
            {formatCurrency(contractTotal)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Retenção padrão: {Number(project?.technical_retention_perc || 5).toFixed(1)}%
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Medido Acumulado</span>
            <TrendingUp className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-teal-400 mt-1">
            {formatCurrency(totalMedidoAcumulado)}
          </div>
          <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">
            {percentConcluido.toFixed(1)}% do contrato executado
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Saldo a Medir</span>
            <Calculator className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-sky-400 mt-1">
            {formatCurrency(saldoContratual)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Saldo contratual remanescente</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Retenção Técnica Total</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-emerald-400 mt-1">
            {formatCurrency(totalRetencaoAcumulada)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Fundo de garantia retido</div>
        </div>
      </div>

      {/* Barra de Progresso Físico-Financeiro */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            Evolução Física Acumulada
          </span>
          <span className="font-mono text-emerald-400 font-bold text-sm">
            {percentConcluido.toFixed(2)}%
          </span>
        </div>
        <div className="w-full h-3 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 transition-all duration-700 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, percentConcluido))}%` }}
          />
        </div>
      </div>

      {/* Tabela de Boletins de Medição */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              Histórico de Boletins de Medição
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Acompanhamento de ciclos, retenções contratuais e valores líquidos autorizados.
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {measurements.length} boletim(ns)
          </span>
        </div>

        {isLoadingMeasurements ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <div className="animate-spin w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full mx-auto mb-3" />
            Carregando boletins de medição...
          </div>
        ) : measurements.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mx-auto text-slate-400">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Nenhuma medição registrada</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Lance o primeiro boletim físico-financeiro para apurar o avanço da obra e calcular a retenção técnica.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                Lançar 1ª Medição
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3">Medição</th>
                  <th className="px-5 py-3">Período de Apuração</th>
                  <th className="px-5 py-3 text-right">Valor Medido Bruto</th>
                  <th className="px-5 py-3 text-right">Retenção Técnica</th>
                  <th className="px-5 py-3 text-right">Valor Líquido</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Ação Operacional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                {measurements.map((m) => {
                  const retencaoPerc =
                    Number(m.valor_medido) > 0
                      ? ((Number(m.retencao_tecnica) / Number(m.valor_medido)) * 100).toFixed(1)
                      : '5.0';

                  const isApproving = approvingId === m.id;

                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono text-xs flex items-center justify-center font-bold">
                            #{m.numero_sequencial}
                          </span>
                          <span>{m.numero_sequencial}ª Medição</span>
                        </div>
                        {m.observacoes && (
                          <div className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                            {m.observacoes}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-slate-300">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>
                            {new Date(m.periodo_inicio).toLocaleDateString('pt-BR')} →{' '}
                            {new Date(m.periodo_fim).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-right font-mono font-medium text-slate-300">
                        {formatCurrency(Number(m.valor_medido) || 0)}
                      </td>

                      <td className="px-5 py-3.5 text-right font-mono text-amber-400">
                        <span>-{formatCurrency(Number(m.retencao_tecnica) || 0)}</span>
                        <span className="block text-[10px] text-slate-500">({retencaoPerc}%)</span>
                      </td>

                      <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-400 text-sm">
                        {formatCurrency(Number(m.valor_liquido) || 0)}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        {getStatusBadge(m.status)}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        {m.status === 'rascunho' || m.status === 'enviada' ? (
                          <button
                            type="button"
                            onClick={() => approveMeasurementMutation.mutate(m.id)}
                            disabled={isApproving}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                            title="Aprovar medição e liberar para faturamento"
                          >
                            {isApproving ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Aprovando...
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                Aprovar Medição
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-medium inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Liberada
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 8. Modal de "Lançar Medição" com Preview em Tempo Real                 */}
      {/* --------------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="glass-panel w-full max-w-xl rounded-2xl border border-slate-800 bg-[#0b101b] shadow-2xl overflow-hidden my-8">
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Lançar Novo Boletim de Medição</h3>
                  <p className="text-xs text-slate-400">
                    {project?.name || 'Obra'} • Apuração física de serviços executados
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
              {/* Período de Apuração */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Início do Período *
                  </label>
                  <input
                    type="date"
                    {...register('periodo_inicio')}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  {errors.periodo_inicio && (
                    <p className="text-red-400 text-[11px] mt-1">
                      {errors.periodo_inicio.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Fim do Período *
                  </label>
                  <input
                    type="date"
                    {...register('periodo_fim')}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  {errors.periodo_fim && (
                    <p className="text-red-400 text-[11px] mt-1">{errors.periodo_fim.message}</p>
                  )}
                </div>
              </div>

              {/* Valor Medido e Retenção */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Valor Medido Bruto (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      {...register('valor_medido')}
                      placeholder="0.00"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                  {errors.valor_medido && (
                    <p className="text-red-400 text-[11px] mt-1">
                      {errors.valor_medido.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Retenção Técnica (%) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      {...register('retencao_tecnica_perc')}
                      placeholder="5.0"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                      %
                    </span>
                  </div>
                  {errors.retencao_tecnica_perc && (
                    <p className="text-red-400 text-[11px] mt-1">
                      {errors.retencao_tecnica_perc.message}
                    </p>
                  )}
                </div>
              </div>

              {/* UX AVANÇADA: PREVIEW EM TEMPO REAL DO VALOR LÍQUIDO A RECEBER */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span>Conferência Prévia (Cálculo em Tempo Real)</span>
                    <ContextualHelp topic="medicoes" variant="icon" />
                  </div>
                  <span className="text-emerald-400 font-normal normal-case">
                    Motor Determinístico Ativo
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300 divide-y divide-slate-800/80">
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Valor Bruto Medido:</span>
                    <span className="font-mono text-white">
                      {formatCurrency(previewCalculation.bruto)}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 text-amber-400">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Retenção Técnica ({previewCalculation.ratePerc.toFixed(1)}%):
                    </span>
                    <span className="font-mono font-medium">
                      -{formatCurrency(previewCalculation.retencao)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="font-bold text-white text-xs sm:text-sm">
                      Valor Líquido a Receber / Faturar:
                    </span>
                    <span className="font-mono font-extrabold text-emerald-400 text-base sm:text-lg">
                      {formatCurrency(previewCalculation.liquido)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Observações / Memorial */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Observações Técnicas do Canteiro
                </label>
                <textarea
                  {...register('observacoes')}
                  rows={2}
                  placeholder="Ex: Concretagem da laje L5, alvenaria do 2º pavimento e instalações hidráulicas..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMeasurementMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
                >
                  {createMeasurementMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gravando Medição...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Salvar Boletim de Medição
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
