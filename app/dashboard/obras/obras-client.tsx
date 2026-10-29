'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  HardHat,
  Building2,
  Plus,
  Search,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Filter,
  ShieldCheck,
  TrendingUp,
  MapPin,
  FileCheck2,
  ChevronRight,
  ExternalLink,
  Layers,
  Users,
  Truck,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// -----------------------------------------------------------------------------
// 1. Schema de Validação com Zod
// -----------------------------------------------------------------------------
const projectFormSchema = z.object({
  client_id: z.string().min(1, 'Selecione o cliente contratante.'),
  name: z
    .string()
    .min(3, 'O nome da obra deve ter no mínimo 3 caracteres.')
    .max(255, 'Máximo de 255 caracteres.'),
  code: z.string().max(50).optional(),
  description: z.string().optional(),
  contract_value: z
    .union([z.string(), z.number()])
    .refine((v) => Number(v) >= 0, { message: 'Valor do contrato deve ser maior ou igual a zero.' })
    .transform((v) => Number(v)),
  technical_retention_perc: z
    .union([z.string(), z.number()])
    .refine((v) => Number(v) >= 0 && Number(v) <= 100, {
      message: 'Retenção técnica deve estar entre 0% e 100%.',
    })
    .transform((v) => Number(v)),
  start_date: z.string().optional(),
  end_date_planned: z.string().optional(),
  status: z.enum(['planejamento', 'em_andamento', 'paralisada', 'concluida', 'cancelada']),
  address_city_ibge: z
    .string()
    .optional()
    .refine((v) => !v || v.replace(/\D/g, '').length === 7, {
      message: 'O código IBGE deve conter exatamente 7 dígitos numéricos.',
    }),
  address_state: z
    .string()
    .optional()
    .refine((v) => !v || v.trim().length === 2, {
      message: 'Sigla da UF deve ter 2 letras (ex: SP, RJ, MG).',
    }),
  address_city: z.string().max(100).optional(),
  address_street: z.string().max(255).optional(),
  address_number: z.string().max(30).optional(),
  address_neighborhood: z.string().max(100).optional(),
  address_zip_code: z.string().max(10).optional(),
  cno: z.string().max(20).optional(),
  art_rrt: z.string().max(50).optional(),
});

type ProjectFormData = z.infer<typeof projectFormSchema>;

interface ClientItem {
  id: string;
  name: string;
  document: string;
}

interface ProjectItem {
  id: string;
  tenant_id: string;
  client_id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  cno?: string | null;
  art_rrt?: string | null;
  contract_value: number;
  technical_retention_perc: number;
  status: 'planejamento' | 'em_andamento' | 'paralisada' | 'concluida' | 'cancelada';
  start_date?: string | null;
  end_date_planned?: string | null;
  expected_end_date?: string | null;
  actual_end_date?: string | null;
  address_city_ibge?: string | null;
  address_state?: string | null;
  address_city?: string | null;
  created_at: string;
  clients?: {
    id?: string;
    name: string;
    document: string;
  } | null;
}

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export function ObrasClient() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // 2. React Hook Form
  // ---------------------------------------------------------------------------
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema) as any,
    defaultValues: {
      client_id: '',
      name: '',
      code: '',
      description: '',
      contract_value: 0,
      technical_retention_perc: 5.0,
      status: 'planejamento',
      start_date: new Date().toISOString().split('T')[0],
      end_date_planned: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      address_state: 'SP',
      address_city: '',
      address_city_ibge: '',
      address_street: '',
      address_number: '',
      address_neighborhood: '',
      address_zip_code: '',
      cno: '',
      art_rrt: '',
    },
  });

  // ---------------------------------------------------------------------------
  // 3. Consulta de Clientes para o Select do Formulário
  // ---------------------------------------------------------------------------
  const {
    data: clients = [],
    isLoading: isLoadingClients,
  } = useQuery<ClientItem[]>({
    queryKey: ['clients-select'],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return [];

      // Tenta rota FastAPI /api/v1/clients
      try {
        const response = await fetch('/api/v1/clients?limit=100', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (response.ok) {
          return await response.json();
        }
      } catch (e) {
        console.warn('Fallback para Supabase Client ao listar clientes...', e);
      }

      // Fallback via Supabase Client
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, document')
        .order('name');
      if (error) throw error;
      return (data || []) as ClientItem[];
    },
  });

  // ---------------------------------------------------------------------------
  // 4. Consulta de Obras (Projetos)
  // ---------------------------------------------------------------------------
  const {
    data: projects = [],
    isLoading,
    error,
  } = useQuery<ProjectItem[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      // Tenta rota FastAPI /api/v1/projects
      try {
        const response = await fetch('/api/v1/projects?limit=100', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (response.ok) {
          return await response.json();
        }
      } catch (e) {
        console.warn('Fallback para Supabase Client ao listar obras...', e);
      }

      // Fallback via Supabase Client com join do cliente contratante
      const { data, error: sbError } = await supabase
        .from('projects')
        .select(`
          id,
          tenant_id,
          client_id,
          code,
          name,
          description,
          cno,
          art_rrt,
          contract_value,
          technical_retention_perc,
          status,
          start_date,
          end_date_planned,
          expected_end_date,
          actual_end_date,
          address_city_ibge,
          address_state,
          address_city,
          created_at,
          clients (
            name,
            document
          )
        `)
        .order('created_at', { ascending: false });

      if (sbError) throw sbError;
      return (data || []) as unknown as ProjectItem[];
    },
  });

  // ---------------------------------------------------------------------------
  // 5. Mutação para Criação de Nova Obra
  // ---------------------------------------------------------------------------
  const createProjectMutation = useMutation({
    mutationFn: async (formData: ProjectFormData) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const payload = {
        client_id: formData.client_id,
        name: formData.name,
        code: formData.code || null,
        description: formData.description || null,
        contract_value: formData.contract_value,
        technical_retention_perc: formData.technical_retention_perc,
        start_date: formData.start_date || null,
        end_date_planned: formData.end_date_planned || null,
        expected_end_date: formData.end_date_planned || null,
        status: formData.status,
        address_city_ibge: formData.address_city_ibge ? formData.address_city_ibge.replace(/\D/g, '') : null,
        address_state: formData.address_state ? formData.address_state.trim().toUpperCase() : null,
        address_city: formData.address_city || null,
        address_street: formData.address_street || null,
        address_number: formData.address_number || null,
        address_neighborhood: formData.address_neighborhood || null,
        address_zip_code: formData.address_zip_code || null,
        cno: formData.cno || null,
        art_rrt: formData.art_rrt || null,
      };

      // Tenta chamar a API FastAPI em /api/v1/projects
      let res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Fallback direto via Supabase Client
        const tenantId = session.user.app_metadata?.tenant_id || session.user.user_metadata?.tenant_id;
        const { data: created, error: sbInsertError } = await supabase
          .from('projects')
          .insert({
            ...payload,
            tenant_id: tenantId,
          })
          .select()
          .single();

        if (sbInsertError) {
          throw new Error(sbInsertError.message || 'Falha ao salvar obra no banco de dados.');
        }

        return created;
      }

      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      reset();
      setIsModalOpen(false);
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Erro inesperado ao cadastrar obra.');
    },
  });

  const onSubmit = (data: ProjectFormData) => {
    setErrorMessage(null);
    createProjectMutation.mutate(data);
  };

  // ---------------------------------------------------------------------------
  // 6. Métricas & Filtros
  // ---------------------------------------------------------------------------
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.code?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (p.clients?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (p.cno?.toLowerCase() || '').includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalContractValue = projects.reduce(
    (acc, p) => acc + (Number(p.contract_value) || 0),
    0
  );

  const activeProjectsCount = projects.filter((p) => p.status === 'em_andamento').length;
  const planningProjectsCount = projects.filter((p) => p.status === 'planejamento').length;
  const avgRetention =
    projects.length > 0
      ? projects.reduce((acc, p) => acc + (Number(p.technical_retention_perc) || 0), 0) /
        projects.length
      : 5.0;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'planejamento':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            Planejamento
          </span>
        );
      case 'em_andamento':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Em Andamento
          </span>
        );
      case 'paralisada':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Paralisada
          </span>
        );
      case 'concluida':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <CheckCircle2 className="w-3 h-3 text-purple-400" />
            Concluída
          </span>
        );
      case 'cancelada':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Cancelada
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
      {/* Header com Título e Ação de Criar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <HardHat className="w-8 h-8 text-emerald-400" />
            Gestão de Obras & Empreendimentos
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Controle de contratos, retenções técnicas de garantia, cronogramas e cadastros CNO.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Nova Obra
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Contratos Sob Gestão</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-white mt-1">
            {formatCurrency(totalContractValue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {projects.length} contrato(s) registrado(s)
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Obras em Andamento</span>
            <HardHat className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-teal-400 mt-1">
            {activeProjectsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Canteiros ativos no momento</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Em Planejamento</span>
            <Calendar className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-sky-400 mt-1">
            {planningProjectsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Aguardando ordem de serviço</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Retenção Técnica Média</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-emerald-400 mt-1">
            {avgRetention.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Garantia técnica contratual</div>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome da obra, código, CNO ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="all">Todos os Status</option>
            <option value="planejamento">Planejamento</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="paralisada">Paralisada</option>
            <option value="concluida">Concluída</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
      </div>

      {/* Tabela de Obras (Shadcn UI Dark Pattern) */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <div className="animate-spin w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full mx-auto mb-3" />
            Carregando obras cadastradas...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400 text-sm flex items-center justify-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>Erro ao carregar obras: {(error as Error).message}</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mx-auto text-slate-400">
              <HardHat className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Nenhuma obra cadastrada</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {searchTerm || statusFilter !== 'all'
                  ? 'Nenhum resultado corresponde aos filtros aplicados.'
                  : 'Cadastre sua primeira obra para iniciar o diário e as medições técnicas.'}
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                Cadastrar Obra
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3">Obra / Empreendimento</th>
                  <th className="px-5 py-3">Cliente Contratante</th>
                  <th className="px-5 py-3 text-right">Valor Contratado</th>
                  <th className="px-5 py-3 text-center">Retenção</th>
                  <th className="px-5 py-3">Cronograma Previsto</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                {filteredProjects.map((project) => {
                  const plannedEnd = project.end_date_planned || project.expected_end_date;

                  return (
                    <tr
                      key={project.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
                          {project.name}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                          {project.code && <span>{project.code}</span>}
                          {project.cno && <span>• CNO: {project.cno}</span>}
                          {project.address_state && (
                            <span className="text-slate-400">
                              • {project.address_city || 'Localidade'}/{project.address_state}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-slate-200">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate max-w-[190px]">
                            {project.clients?.name || 'Cliente Geral'}
                          </span>
                        </div>
                        {project.clients?.document && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            {project.clients.document}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right font-mono font-bold text-white">
                        {formatCurrency(Number(project.contract_value) || 0)}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {Number(project.technical_retention_perc || 5).toFixed(1)}%
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>
                            {project.start_date
                              ? new Date(project.start_date).toLocaleDateString('pt-BR')
                              : 'A definir'}{' '}
                            →{' '}
                            {plannedEnd
                              ? new Date(plannedEnd).toLocaleDateString('pt-BR')
                              : 'Sem data'}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        {getStatusBadge(project.status)}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/dashboard/obras/${project.id}/suprimentos/transferencias`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-teal-400 hover:text-white bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 transition-colors"
                            title="Portaria Digital: Termos de Retirada e Recebimento com GPS e Assinatura"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            Portaria
                          </Link>
                          <Link
                            href={`/dashboard/obras/${project.id}/subcontratos`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-amber-400 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-colors"
                            title="Gestão de Subcontratos e Terceirizados (Modelo Farol)"
                          >
                            <Users className="w-3.5 h-3.5" />
                            Terceirizados
                          </Link>
                          <Link
                            href={`/dashboard/obras/${project.id}/medicoes`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                            title="Gerenciar Medições da Obra"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                            Medições
                          </Link>
                        </div>
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
      {/* 7. Modal / Dialog para Cadastro de "Nova Obra"                       */}
      {/* --------------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="glass-panel w-full max-w-3xl rounded-2xl border border-slate-800 bg-[#0b101b] shadow-2xl overflow-hidden my-8">
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <HardHat className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Cadastrar Nova Obra</h3>
                  <p className="text-xs text-slate-400">
                    Vincule o contrato a um cliente cadastrado e defina os parâmetros do canteiro.
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

            {/* Formulário com React Hook Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
              {/* Seção 1: Cliente e Identificação da Obra */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  1. Identificação & Cliente Contratante
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Cliente Tomador *
                    </label>
                    <select
                      {...register('client_id')}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                      <option value="">Selecione um cliente cadastrado...</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.document})
                        </option>
                      ))}
                    </select>
                    {errors.client_id && (
                      <p className="text-red-400 text-[11px] mt-1">{errors.client_id.message}</p>
                    )}
                    {clients.length === 0 && !isLoadingClients && (
                      <p className="text-amber-400 text-[10px] mt-1">
                        Nenhum cliente encontrado.{' '}
                        <Link href="/dashboard/clientes" className="underline hover:text-amber-300">
                          Cadastre um cliente primeiro
                        </Link>
                        .
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Código / Centro de Custo
                    </label>
                    <input
                      {...register('code')}
                      placeholder="Ex: OBR-2026-001"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nome da Obra / Empreendimento *
                  </label>
                  <input
                    {...register('name')}
                    placeholder="Ex: Residencial Alphaville - Torre 2"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  {errors.name && (
                    <p className="text-red-400 text-[11px] mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Memorial Resumido / Escopo Técnico
                  </label>
                  <textarea
                    {...register('description')}
                    rows={2}
                    placeholder="Descreva as características técnicas principais da obra..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              {/* Seção 2: Valores Contratuais e Cronograma */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  2. Valores, Retenções e Cronograma
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Valor do Contrato (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('contract_value')}
                      placeholder="0.00"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                    {errors.contract_value && (
                      <p className="text-red-400 text-[11px] mt-1">
                        {errors.contract_value.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Retenção Técnica (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        {...register('technical_retention_perc')}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                        %
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Situação Inicial
                    </label>
                    <select
                      {...register('status')}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                      <option value="planejamento">Planejamento</option>
                      <option value="em_andamento">Em Andamento</option>
                      <option value="paralisada">Paralisada</option>
                      <option value="concluida">Concluída</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Data de Início Prevista
                    </label>
                    <input
                      type="date"
                      {...register('start_date')}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Data Planejada de Término
                    </label>
                    <input
                      type="date"
                      {...register('end_date_planned')}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 3: Localização e Dados Regulatórios (CNO, ART, IBGE) */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  3. Localização & Dados Regulatórios (CNO / ART / IBGE)
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Estado (UF)
                    </label>
                    <select
                      {...register('address_state')}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                      {BRAZILIAN_STATES.map((uf) => (
                        <option key={uf} value={uf}>
                          {uf}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Município</label>
                    <input
                      {...register('address_city')}
                      placeholder="Ex: São Paulo"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Código IBGE (7 dígitos)
                    </label>
                    <input
                      {...register('address_city_ibge')}
                      placeholder="Ex: 3550308"
                      maxLength={7}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                    {errors.address_city_ibge && (
                      <p className="text-red-400 text-[10px] mt-1">
                        {errors.address_city_ibge.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">CNO da RFB</label>
                    <input
                      {...register('cno')}
                      placeholder="Ex: 12.345.67890/12"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Logradouro / Endereço do Canteiro
                    </label>
                    <input
                      {...register('address_street')}
                      placeholder="Ex: Av. Engenheiro Luís Carlos Berrini, 1000"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      ART / RRT Responsável
                    </label>
                    <input
                      {...register('art_rrt')}
                      placeholder="Ex: ART-SP-2026-12345"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Botões de Ação do Modal */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createProjectMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
                >
                  {createProjectMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gravando Obra...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Salvar Obra
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
