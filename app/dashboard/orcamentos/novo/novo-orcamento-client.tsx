'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calculator,
  Plus,
  Trash2,
  Package,
  Wrench,
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  Percent,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HelpCircle,
  Sparkles,
  Layers,
  ChevronDown,
  Info,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// -----------------------------------------------------------------------------
// 1. Schema de Validação com Zod
// -----------------------------------------------------------------------------
const quoteItemSchema = z.object({
  item_type: z.enum(['product', 'service']),
  product_id: z.string().optional(),
  service_id: z.string().optional(),
  description: z.string().min(2, 'Informe a descrição do item.'),
  unit_of_measure: z.string().min(1, 'Unidade obrigatória.').max(10),
  quantity: z
    .union([z.string(), z.number()])
    .refine((v) => Number(v) > 0, { message: 'Qtd deve ser > 0.' })
    .transform((v) => Number(v)),
  unit_cost: z
    .union([z.string(), z.number()])
    .refine((v) => Number(v) >= 0, { message: 'Custo deve ser >= 0.' })
    .transform((v) => Number(v)),
  bdi_rate: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .optional()
    .transform((v) => (v !== undefined && v !== null && v !== '' ? Number(v) : undefined)),
});

const quoteFormSchema = z.object({
  client_id: z.string().min(1, 'Selecione o cliente tomador.'),
  title: z.string().min(2, 'Informe o título do orçamento.').max(255),
  description: z.string().optional(),
  valid_until: z.string().optional(),
  notes: z.string().optional(),
  // Taxas BDI (%)
  ac_rate: z.union([z.string(), z.number()]).transform((v) => Number(v || 0)),
  s_rate: z.union([z.string(), z.number()]).transform((v) => Number(v || 0)),
  r_rate: z.union([z.string(), z.number()]).transform((v) => Number(v || 0)),
  g_rate: z.union([z.string(), z.number()]).transform((v) => Number(v || 0)),
  df_rate: z.union([z.string(), z.number()]).transform((v) => Number(v || 0)),
  l_rate: z.union([z.string(), z.number()]).transform((v) => Number(v || 0)),
  i_rate: z.union([z.string(), z.number()]).transform((v) => Number(v || 0)),
  discount_amount: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v || 0)),
  items: z.array(quoteItemSchema).min(1, 'Adicione pelo menos um item ao orçamento.'),
});

type QuoteFormData = z.infer<typeof quoteFormSchema>;

interface ClientOption {
  id: string;
  name: string;
  document: string;
}

interface ProductOption {
  id: string;
  code?: string;
  name: string;
  unit_of_measure: string;
  base_cost: number;
}

interface ServiceOption {
  id: string;
  code?: string;
  name: string;
  unit_of_measure: string;
  base_cost: number;
}

export function NovoOrcamentoClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showBdiDetails, setShowBdiDetails] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      client_id: '',
      title: '',
      description: '',
      valid_until: '',
      notes: '',
      ac_rate: 4.0, // 4.0%
      s_rate: 0.8, // 0.8%
      r_rate: 1.2, // 1.2%
      g_rate: 0.4, // 0.4%
      df_rate: 1.0, // 1.0%
      l_rate: 8.0, // 8.0%
      i_rate: 8.65, // 8.65% (PIS/COFINS/ISS)
      discount_amount: 0,
      items: [
        {
          item_type: 'product',
          description: '',
          unit_of_measure: 'UN',
          quantity: 1,
          unit_cost: 0,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedValues = watch();

  // Helper para obter o token JWT do Supabase
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
  // Consultas de Apoio (Clientes, Produtos, Serviços)
  // ---------------------------------------------------------------------------
  const { data: clients = [] } = useQuery<ClientOption[]>({
    queryKey: ['clients-options'],
    queryFn: async () => {
      const token = await getAuthToken();
      const res = await fetch('/api/v1/clients?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok ? res.json() : [];
    },
  });

  const { data: products = [] } = useQuery<ProductOption[]>({
    queryKey: ['products-options'],
    queryFn: async () => {
      const token = await getAuthToken();
      const res = await fetch('/api/v1/products?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok ? res.json() : [];
    },
  });

  const { data: services = [] } = useQuery<ServiceOption[]>({
    queryKey: ['services-options'],
    queryFn: async () => {
      const token = await getAuthToken();
      const res = await fetch('/api/v1/services?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok ? res.json() : [];
    },
  });

  // ---------------------------------------------------------------------------
  // Cálculo de BDI em Tempo Real no Frontend
  // BDI = [((1 + AC + S + R + G) * (1 + DF) * (1 + L)) / (1 - I)] - 1
  // ---------------------------------------------------------------------------
  const financialSummary = useMemo(() => {
    const norm = (v: number) => (v > 1 ? v / 100 : v);

    const ac = norm(Number(watchedValues.ac_rate) || 0);
    const s = norm(Number(watchedValues.s_rate) || 0);
    const r = norm(Number(watchedValues.r_rate) || 0);
    const g = norm(Number(watchedValues.g_rate) || 0);
    const df = norm(Number(watchedValues.df_rate) || 0);
    const l = norm(Number(watchedValues.l_rate) || 0);
    const i = norm(Number(watchedValues.i_rate) || 0);

    const denominator = 1 - i;
    let bdiMultiplier = 0;

    if (denominator > 0) {
      const numerator = (1 + ac + s + r + g) * (1 + df) * (1 + l);
      bdiMultiplier = numerator / denominator - 1;
    }

    let totalCost = 0;
    let totalProductsCost = 0;
    let totalServicesCost = 0;
    let totalGrossPrice = 0;

    const items = watchedValues.items || [];
    const itemBreakdown = items.map((item) => {
      const qty = Number(item.quantity) || 0;
      const cost = Number(item.unit_cost) || 0;
      const itemBdi =
        item.bdi_rate !== undefined && item.bdi_rate !== null && item.bdi_rate !== 0
          ? norm(Number(item.bdi_rate))
          : bdiMultiplier;

      const unitPrice = cost * (1 + itemBdi);
      const itemCostTotal = qty * cost;
      const itemPriceTotal = qty * unitPrice;

      totalCost += itemCostTotal;
      totalGrossPrice += itemPriceTotal;

      if (item.item_type === 'product') {
        totalProductsCost += itemCostTotal;
      } else {
        totalServicesCost += itemCostTotal;
      }

      return {
        unitPrice,
        itemCostTotal,
        itemPriceTotal,
        itemBdi,
      };
    });

    const discount = Number(watchedValues.discount_amount) || 0;
    const bdiAmount = Math.max(0, totalGrossPrice - totalCost);
    const grandTotal = Math.max(0, totalGrossPrice - discount);

    return {
      bdiMultiplier,
      bdiPercentage: (bdiMultiplier * 100).toFixed(2),
      totalCost,
      totalProductsCost,
      totalServicesCost,
      bdiAmount,
      discount,
      grandTotal,
      itemBreakdown,
    };
  }, [
    watchedValues.ac_rate,
    watchedValues.s_rate,
    watchedValues.r_rate,
    watchedValues.g_rate,
    watchedValues.df_rate,
    watchedValues.l_rate,
    watchedValues.i_rate,
    watchedValues.discount_amount,
    watchedValues.items,
  ]);

  // ---------------------------------------------------------------------------
  // Mutação: Envio do Orçamento para a API FastAPI (/api/v1/quotes)
  // ---------------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: async (data: QuoteFormData) => {
      const token = await getAuthToken();

      const payload = {
        client_id: data.client_id,
        title: data.title,
        description: data.description || null,
        valid_until: data.valid_until || null,
        notes: data.notes || null,
        ac_rate: data.ac_rate,
        s_rate: data.s_rate,
        r_rate: data.r_rate,
        g_rate: data.g_rate,
        df_rate: data.df_rate,
        l_rate: data.l_rate,
        i_rate: data.i_rate,
        discount_amount: data.discount_amount,
        items: data.items.map((it) => ({
          item_type: it.item_type,
          product_id: it.product_id || null,
          service_id: it.service_id || null,
          description: it.description,
          unit_of_measure: it.unit_of_measure,
          quantity: it.quantity,
          unit_cost: it.unit_cost,
          bdi_rate: it.bdi_rate || null,
        })),
      };

      const res = await fetch('/api/v1/quotes', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Falha ao emitir orçamento.');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      router.push('/dashboard/orcamentos');
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Erro inesperado ao gerar orçamento.');
    },
  });

  const onSubmit = (data: QuoteFormData) => {
    setErrorMessage(null);
    createMutation.mutate(data);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const handleSelectProduct = (index: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      setValue(`items.${index}.product_id`, prod.id);
      setValue(`items.${index}.service_id`, undefined);
      setValue(`items.${index}.description`, prod.name);
      setValue(`items.${index}.unit_of_measure`, prod.unit_of_measure);
      setValue(`items.${index}.unit_cost`, Number(prod.base_cost));
    }
  };

  const handleSelectService = (index: number, serviceId: string) => {
    const srv = services.find((s) => s.id === serviceId);
    if (srv) {
      setValue(`items.${index}.service_id`, srv.id);
      setValue(`items.${index}.product_id`, undefined);
      setValue(`items.${index}.description`, srv.name);
      setValue(`items.${index}.unit_of_measure`, srv.unit_of_measure);
      setValue(`items.${index}.unit_cost`, Number(srv.base_cost));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Barra de Topo */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/orcamentos"
          className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Orçamentos
        </Link>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            Motor BDI Analítico Ativo
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Calculator className="w-7 h-7 text-emerald-400" />
            Novo Orçamento Técnico
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Composição mista de materiais e serviços com marcação automatizada de BDI analítico.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2.5 animate-fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="leading-relaxed">{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Coluna da Esquerda: Dados do Orçamento, Itens e Taxas de BDI (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Bloco 1: Cabeçalho do Orçamento */}
            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                Dados do Cliente e Objeto
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Cliente / Tomador do Serviço *
                  </label>
                  <select
                    {...register('client_id')}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
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
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Validade da Proposta
                  </label>
                  <input
                    type="date"
                    {...register('valid_until')}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Título da Proposta *
                </label>
                <input
                  {...register('title')}
                  placeholder="Ex: Reforma Estrutural e Impermeabilização - Bloco A"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                {errors.title && (
                  <p className="text-red-400 text-[11px] mt-1">{errors.title.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Escopo e Especificações Gerais
                </label>
                <textarea
                  {...register('description')}
                  rows={2}
                  placeholder="Descreva as condições técnicas, etapas da obra e observações relevantes..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            {/* Bloco 2: Parametrização de BDI (Fórmula Oficial) */}
            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Percent className="w-4 h-4 text-emerald-400" />
                    Parâmetros Analíticos de BDI
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                    BDI = [((1 + AC + S + R + G) * (1 + DF) * (1 + L)) / (1 - I)] - 1
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBdiDetails(!showBdiDetails)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
                >
                  {showBdiDetails ? 'Recolher Taxas' : 'Ajustar Taxas Detalhadas'}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showBdiDetails ? 'rotate-180' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">BDI Calculado</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono mt-0.5 block">
                    {financialSummary.bdiPercentage}%
                  </span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Lucro Bruto (L)</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      type="number"
                      step="0.01"
                      {...register('l_rate')}
                      className="w-16 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white font-mono"
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Tributos (I)</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      type="number"
                      step="0.01"
                      {...register('i_rate')}
                      className="w-16 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white font-mono"
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Desconto</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs text-slate-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('discount_amount')}
                      className="w-20 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Taxas Detalhadas Expandíveis */}
              {showBdiDetails && (
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs animate-fade-in">
                  <div>
                    <label className="text-[11px] text-slate-400 block">Admin Central (AC %)</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register('ac_rate')}
                      className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block">Seguros (S %)</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register('s_rate')}
                      className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block">Riscos (R %)</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register('r_rate')}
                      className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block">Garantias (G %)</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register('g_rate')}
                      className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block">Desp. Financ. (DF %)</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register('df_rate')}
                      className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bloco 3: Lista de Itens do Orçamento (useFieldArray) */}
            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    Itens e Serviços Orçados ({fields.length})
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Contrato misto: combine produtos e serviços com precificação automática.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      append({
                        item_type: 'product',
                        description: '',
                        unit_of_measure: 'UN',
                        quantity: 1,
                        unit_cost: 0,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors"
                  >
                    <Package className="w-3.5 h-3.5" />
                    + Material
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      append({
                        item_type: 'service',
                        description: '',
                        unit_of_measure: 'M2',
                        quantity: 1,
                        unit_cost: 0,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-500/15 text-teal-300 hover:bg-teal-500/25 border border-teal-500/30 transition-colors"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    + Serviço
                  </button>
                </div>
              </div>

              {errors.items?.message && (
                <p className="text-red-400 text-xs">{errors.items.message}</p>
              )}

              {/* Lista Dinâmica de Itens */}
              <div className="space-y-4">
                {fields.map((field, index) => {
                  const itemBreakdown = financialSummary.itemBreakdown[index];
                  const currentItemType = watch(`items.${index}.item_type`);

                  return (
                    <div
                      key={field.id}
                      className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 transition-all space-y-3"
                    >
                      {/* Linha 1: Tipo, Seleção rápida do Catálogo e Exclusão */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              currentItemType === 'product'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                            }`}
                          >
                            {currentItemType === 'product' ? (
                              <Package className="w-3 h-3" />
                            ) : (
                              <Wrench className="w-3 h-3" />
                            )}
                            Item #{index + 1} ({currentItemType === 'product' ? 'Material' : 'Serviço'})
                          </span>

                          {/* Seletor rápido a partir do catálogo */}
                          {currentItemType === 'product' ? (
                            <select
                              onChange={(e) => handleSelectProduct(index, e.target.value)}
                              className="bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300 rounded px-2 py-0.5 focus:outline-none"
                              defaultValue=""
                            >
                              <option value="" disabled>
                                Importar do Catálogo de Produtos...
                              </option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({formatCurrency(p.base_cost)} / {p.unit_of_measure})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <select
                              onChange={(e) => handleSelectService(index, e.target.value)}
                              className="bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300 rounded px-2 py-0.5 focus:outline-none"
                              defaultValue=""
                            >
                              <option value="" disabled>
                                Importar do Catálogo de Serviços...
                              </option>
                              {services.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({formatCurrency(s.base_cost)} / {s.unit_of_measure})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"
                            title="Remover este item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Linha 2: Descrição e Unidade */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] text-slate-400 mb-0.5">Descrição do Item *</label>
                          <input
                            {...register(`items.${index}.description`)}
                            placeholder="Ex: Cimento CP-II ou Alvenaria Estrutural"
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-0.5">Unidade *</label>
                          <input
                            {...register(`items.${index}.unit_of_measure`)}
                            placeholder="M2, UN, SC"
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      {/* Linha 3: Quantidade, Custo Unitário e Prévia de Preço de Venda */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-slate-800/60 items-center">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-0.5">Quantidade *</label>
                          <input
                            type="number"
                            step="0.0001"
                            min="0.0001"
                            {...register(`items.${index}.quantity`)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-400 mb-0.5">Custo Base Unitário (R$) *</label>
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            {...register(`items.${index}.unit_cost`)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>

                        <div>
                          <span className="block text-[11px] text-slate-400 mb-0.5">Preço Unit. Venda (c/ BDI)</span>
                          <span className="block text-xs font-mono font-bold text-emerald-400 py-1.5">
                            {formatCurrency(itemBreakdown?.unitPrice || 0)}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="block text-[11px] text-slate-400 mb-0.5">Subtotal Venda</span>
                          <span className="block text-xs font-mono font-extrabold text-white py-1.5">
                            {formatCurrency(itemBreakdown?.itemPriceTotal || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Coluna da Direita: Painel Resumo em Tempo Real e Botão de Emissão (4 cols) */}
          <div className="lg:col-span-4 sticky top-20 space-y-4">
            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden backdrop-blur-xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

              <h3 className="text-sm font-bold text-white mb-4 pb-2 border-b border-slate-800 flex items-center justify-between">
                <span>Resumo da Proposta</span>
                <span className="text-[11px] font-mono text-emerald-400">BDI: +{financialSummary.bdiPercentage}%</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Custo Direto Materiais:</span>
                  <span className="font-mono text-white">{formatCurrency(financialSummary.totalProductsCost)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Custo Direto Serviços:</span>
                  <span className="font-mono text-white">{formatCurrency(financialSummary.totalServicesCost)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300 pt-2 border-t border-slate-800">
                  <span>Custo Direto Total:</span>
                  <span className="font-mono font-bold text-white">{formatCurrency(financialSummary.totalCost)}</span>
                </div>

                <div className="flex items-center justify-between text-emerald-400">
                  <span className="flex items-center gap-1">
                    Margem BDI Agregada:
                  </span>
                  <span className="font-mono font-bold">+{formatCurrency(financialSummary.bdiAmount)}</span>
                </div>

                {financialSummary.discount > 0 && (
                  <div className="flex items-center justify-between text-amber-400">
                    <span>Desconto Comercial:</span>
                    <span className="font-mono font-bold">-{formatCurrency(financialSummary.discount)}</span>
                  </div>
                )}

                {/* Grand Total */}
                <div className="pt-4 border-t-2 border-slate-800 mt-2">
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold">
                    Valor Final do Contrato (Grand Total)
                  </span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 font-mono block mt-1">
                    {formatCurrency(financialSummary.grandTotal)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full mt-6 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all duration-200 disabled:opacity-60"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando BDI & Emitindo...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    Gerar Proposta Comercial
                  </>
                )}
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <span className="font-bold text-slate-300 block">Isolamento Multi-tenant:</span>
              <p>
                O orçamento será gravado em <code className="text-emerald-400 font-mono">quotes</code> com status inicial{' '}
                <strong className="text-slate-200">Draft</strong> e código sequencial automático vinculado exclusivamente à sua empresa.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
