'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Wrench,
  Plus,
  Search,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Percent,
  Calculator,
  ShieldAlert,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// -----------------------------------------------------------------------------
// 1. Schema de Validação com Zod
// -----------------------------------------------------------------------------
const serviceFormSchema = z.object({
  code: z.string().max(50).optional(),
  name: z.string().min(2, 'O nome do serviço deve ter no mínimo 2 caracteres.').max(255),
  description: z.string().optional(),
  nbs_code: z.string().min(1, 'Código NBS é obrigatório (ex: 1.0101.10.00).').max(20),
  lc116_code: z
    .string()
    .min(1, 'Código LC 116/03 é obrigatório (ex: 07.02).')
    .refine((val) => /^\d{2}(\.\d{2})?$/.test(val.trim()), {
      message: 'Código LC 116/03 inválido. Formato esperado: 07.02 ou 0702.',
    }),
  cnae_code: z.string().max(20).optional(),
  base_cost: z
    .union([z.string(), z.number()])
    .refine((val) => Number(val) >= 0, { message: 'Custo base deve ser maior ou igual a zero.' })
    .transform((val) => Number(val)),
  default_price: z
    .union([z.string(), z.number()])
    .refine((val) => Number(val) >= 0, { message: 'Preço padrão deve ser maior ou igual a zero.' })
    .transform((val) => Number(val)),
  unit_of_measure: z.string().min(1, 'Selecione a unidade de medição.').max(10),
  iss_aliquota: z
    .union([z.string(), z.number()])
    .refine((val) => Number(val) >= 0 && Number(val) <= 100, {
      message: 'Alíquota de ISS deve estar entre 0% e 100%.',
    })
    .transform((val) => Number(val)),
  iss_retido_default: z.boolean().default(false),
  inss_retencao_aliquota: z
    .union([z.string(), z.number()])
    .refine((val) => Number(val) >= 0 && Number(val) <= 100, {
      message: 'Alíquota de retenção de INSS deve estar entre 0% e 100%.',
    })
    .transform((val) => Number(val)),
  is_active: z.boolean().default(true),
});

type ServiceFormData = z.infer<typeof serviceFormSchema>;

interface ServiceItem {
  id: string;
  tenant_id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  nbs_code: string;
  lc116_code: string;
  cnae_code?: string | null;
  base_cost: number;
  default_price: number;
  unit_of_measure: string;
  iss_aliquota: number;
  iss_retido_default: boolean;
  inss_retencao_aliquota: number;
  is_active: boolean;
  created_at: string;
}

const SERVICE_UNITS = ['M2', 'M3', 'UN', 'HORA', 'DIA', 'MES', 'GL', 'PONTO', 'KM'];

const LC116_OPTIONS = [
  { value: '07.02', label: '07.02 - Execução de obras de construção civil, hidráulica ou elétrica' },
  { value: '07.03', label: '07.03 - Elaboração de planos diretores, estudos de viabilidade, projetos' },
  { value: '07.04', label: '07.04 - Demolição' },
  { value: '07.05', label: '07.05 - Reparação, conservação e reforma de edifícios, estradas, pontes' },
  { value: '07.06', label: '07.06 - Colocação e instalação de tapetes, cortinas, revestimentos' },
  { value: '07.17', label: '07.17 - Engenharia, agronomia, agrimensura, arquitetura, geologia' },
  { value: 'outros', label: 'Outro subitem da LC 116/03' },
];

export function ServicosClient() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLc116, setSelectedLc116] = useState<string>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      nbs_code: '1.0101.10.00',
      lc116_code: '07.02',
      cnae_code: '4120-4/00',
      base_cost: 0,
      default_price: 0,
      unit_of_measure: 'M2',
      iss_aliquota: 5.0,
      iss_retido_default: false,
      inss_retencao_aliquota: 11.0,
      is_active: true,
    },
  });

  const getAuthToken = async (): Promise<string> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    return session.access_token;
  };

  // ---------------------------------------------------------------------------
  // TanStack Query: Listagem de Serviços
  // ---------------------------------------------------------------------------
  const {
    data: services = [],
    isLoading,
    isError,
    error,
  } = useQuery<ServiceItem[]>({
    queryKey: ['services', searchTerm, selectedLc116],
    queryFn: async () => {
      const token = await getAuthToken();
      const url = new URL('/api/v1/services', window.location.origin);
      if (searchTerm.trim()) {
        url.searchParams.set('search', searchTerm.trim());
      }
      if (selectedLc116 && selectedLc116 !== 'all') {
        url.searchParams.set('lc116_code', selectedLc116);
      }

      // 1. Tenta API FastAPI
      try {
        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          return await response.json();
        }
      } catch (e) {
        console.warn('Fallback para Supabase Client ao listar serviços...', e);
      }

      // 2. Fallback resiliente via Supabase Client (RLS nativo)
      let query = supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchTerm.trim()) {
        query = query.or(`name.ilike.%${searchTerm.trim()}%,code.ilike.%${searchTerm.trim()}%`);
      }
      if (selectedLc116 && selectedLc116 !== 'all') {
        query = query.eq('lc116_code', selectedLc116);
      }

      const { data, error: supaErr } = await query;
      if (supaErr) {
        throw new Error(`Falha ao consultar serviços: ${supaErr.message}`);
      }
      return (data || []) as ServiceItem[];
    },
  });

  // ---------------------------------------------------------------------------
  // Mutação: Criação de Serviço
  // ---------------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: async (formData: ServiceFormData) => {
      const token = await getAuthToken();
      const response = await fetch('/api/v1/services', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Falha ao cadastrar serviço.');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      reset();
      setIsModalOpen(false);
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Erro inesperado ao cadastrar serviço.');
    },
  });

  const onSubmit = (data: ServiceFormData) => {
    setErrorMessage(null);
    createMutation.mutate(data);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(val);
  };

  // KPIs
  const totalCount = services.length;
  const avgCost = totalCount > 0 ? services.reduce((acc, s) => acc + Number(s.base_cost), 0) / totalCount : 0;
  const activeCount = services.filter((s) => s.is_active).length;

  return (
    <div className="space-y-6">
      {/* Título & Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Catálogo Geral</span>
            <span>/</span>
            <span className="text-emerald-400 font-medium">Serviços Técnicos & Empreitadas</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Catálogo de Serviços
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configuração fiscal de serviços de engenharia com NBS, LC 116/03, alíquotas de ISS e retenção de INSS.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            reset();
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all duration-200"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Novo Serviço
        </button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <span className="text-xs font-medium text-slate-400">Total de Serviços</span>
          <p className="text-2xl font-bold text-white mt-1">{totalCount}</p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <span className="text-xs font-medium text-slate-400">Custo Médio Unitário</span>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(avgCost)}</p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <span className="text-xs font-medium text-slate-400">Serviços Ativos</span>
          <p className="text-2xl font-bold text-teal-400 mt-1">{activeCount}</p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por descrição do serviço, código interno, NBS ou código LC 116..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        <select
          value={selectedLc116}
          onChange={(e) => setSelectedLc116(e.target.value)}
          className="bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="all">Todos os Subitens LC 116</option>
          {LC116_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tabela de Serviços */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Serviço / Código</th>
                <th className="py-3 px-4">Tributação (NBS / LC 116)</th>
                <th className="py-3 px-4">Unidade</th>
                <th className="py-3 px-4 text-right">Custo Base (18,4)</th>
                <th className="py-3 px-4 text-right">Preço Padrão</th>
                <th className="py-3 px-4 text-center">Retenções (ISS / INSS)</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-400 mb-2" />
                    Carregando catálogo de serviços...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-red-400">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-400" />
                    {error instanceof Error ? error.message : 'Falha ao consultar serviços.'}
                  </td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Nenhum serviço cadastrado. Clique no botão acima para adicionar.
                  </td>
                </tr>
              ) : (
                services.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{s.name}</div>
                      {s.code && (
                        <div className="text-xs font-mono text-emerald-400/90">{s.code}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-teal-300 border border-slate-700">
                          LC {s.lc116_code}
                        </span>
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          NBS {s.nbs_code}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-300">
                      {s.unit_of_measure}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-white font-medium">
                      {formatCurrency(Number(s.base_cost))}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-300">
                      {formatCurrency(Number(s.default_price))}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 text-xs font-mono">
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                          ISS {Number(s.iss_aliquota).toFixed(1)}% {s.iss_retido_default && '(Ret)'}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          INSS {Number(s.inss_retencao_aliquota).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          s.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            s.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                          }`}
                        />
                        {s.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Cadastro de Serviço */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-[#0b101b] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Novo Serviço de Engenharia</h3>
                  <p className="text-xs text-slate-400">Configure enquadramento fiscal e tributário na fonte.</p>
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

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 overflow-y-auto space-y-4 flex-1">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Código e Descrição */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Código Interno</label>
                  <input
                    {...register('code')}
                    placeholder="Ex: SRV-EST-002"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Descrição do Serviço *</label>
                  <input
                    {...register('name')}
                    placeholder="Ex: Concretagem Estrutural FCK 30 Mpa"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  {errors.name && <p className="text-red-400 text-[11px] mt-1">{errors.name.message}</p>}
                </div>
              </div>

              {/* Parâmetros Fiscais: NBS e LC 116 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Subitem LC 116/03 *</label>
                  <select
                    {...register('lc116_code')}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="07.02">07.02 - Execução de obras de construção civil</option>
                    <option value="07.03">07.03 - Elaboração de planos diretores, projetos</option>
                    <option value="07.04">07.04 - Demolição</option>
                    <option value="07.05">07.05 - Reparação, conservação e reforma de edifícios</option>
                    <option value="07.06">07.06 - Colocação e instalação de revestimentos</option>
                    <option value="07.17">07.17 - Engenharia, arquitetura e geologia</option>
                  </select>
                  {errors.lc116_code && <p className="text-red-400 text-[11px] mt-1">{errors.lc116_code.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Código NBS *</label>
                  <input
                    {...register('nbs_code')}
                    placeholder="1.0101.10.00"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  {errors.nbs_code && <p className="text-red-400 text-[11px] mt-1">{errors.nbs_code.message}</p>}
                </div>
              </div>

              {/* Custos e Unidade */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Custo Base Operacional (R$) *</label>
                  <input
                    {...register('base_cost')}
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="0.0000"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  {errors.base_cost && <p className="text-red-400 text-[11px] mt-1">{errors.base_cost.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Preço Padrão de Faturamento (R$)</label>
                  <input
                    {...register('default_price')}
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="0.0000"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Unidade de Medição *</label>
                  <select
                    {...register('unit_of_measure')}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {SERVICE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Retenções Fiscais: ISS e INSS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-300">Alíquota de ISS (%)</label>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                      <input type="checkbox" {...register('iss_retido_default')} className="rounded bg-slate-800 border-slate-700 text-emerald-500" />
                      Retido na fonte
                    </label>
                  </div>
                  <input
                    {...register('iss_aliquota')}
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="5.00"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Retenção de INSS (%)</label>
                  <input
                    {...register('inss_retencao_aliquota')}
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="11.00"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">Geralmente 11% ou 3.5% (com desoneração)</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-60"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gravando...
                    </>
                  ) : (
                    'Salvar Serviço'
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
