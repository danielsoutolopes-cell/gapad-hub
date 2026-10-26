'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Plus,
  Search,
  DollarSign,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Tag,
  Barcode,
  TrendingUp,
  Percent,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// -----------------------------------------------------------------------------
// 1. Schema de Validação com Zod
// -----------------------------------------------------------------------------
const productFormSchema = z.object({
  code: z.string().max(50).optional(),
  name: z.string().min(2, 'O nome do material deve ter no mínimo 2 caracteres.').max(255),
  description: z.string().optional(),
  ncm: z
    .string()
    .min(1, 'NCM é obrigatório.')
    .refine((val) => val.replace(/\D/g, '').length === 8, {
      message: 'O NCM deve conter exatamente 8 dígitos numéricos (ex: 25232910).',
    }),
  unit_of_measure: z.string().min(1, 'Selecione a unidade de medida.').max(10),
  base_cost: z
    .union([z.string(), z.number()])
    .refine((val) => Number(val) >= 0, { message: 'Custo base deve ser maior ou igual a zero.' })
    .transform((val) => Number(val)),
  sale_price: z
    .union([z.string(), z.number()])
    .refine((val) => Number(val) >= 0, { message: 'Preço de venda deve ser maior ou igual a zero.' })
    .transform((val) => Number(val)),
  brand: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  min_stock: z
    .union([z.string(), z.number()])
    .transform((val) => Number(val || 0)),
  current_stock: z
    .union([z.string(), z.number()])
    .transform((val) => Number(val || 0)),
  is_active: z.boolean().default(true),
});

type ProductFormData = z.infer<typeof productFormSchema>;

interface ProductItem {
  id: string;
  tenant_id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  ncm: string;
  unit_of_measure: string;
  base_cost: number;
  sale_price: number;
  brand?: string | null;
  category?: string | null;
  min_stock: number;
  current_stock: number;
  is_active: boolean;
  created_at: string;
}

const UNITS = ['UN', 'SC', 'M2', 'M3', 'KG', 'TON', 'L', 'ML', 'BARRA', 'ROLO', 'CX'];

import { lookupNcm, generateProductSku } from '@/lib/ncm-helper';

const PRODUCT_CATEGORIES = [
  { value: 'aglomerantes', label: 'Cimentos & Aglomerantes' },
  { value: 'agregados', label: 'Areias, Britas & Agregados' },
  { value: 'alvenaria', label: 'Blocos & Tijolos' },
  { value: 'aco_ferragens', label: 'Aço & Ferragens Estruturais' },
  { value: 'hidraulica', label: 'Tubos & Conexões Hidráulicas' },
  { value: 'eletrica', label: 'Fios, Cabos & Elétrica' },
  { value: 'tintas_quimicos', label: 'Tintas & Impermeabilizantes' },
  { value: 'acabamento', label: 'Pisos, Revestimentos & Granitos' },
  { value: 'cobertura', label: 'Telhas & Coberturas' },
  { value: 'loucas_metais', label: 'Louças & Metais Sanitários' },
  { value: 'madeira', label: 'Madeiras & Esquadrias' },
  { value: 'outros', label: 'Outros Materiais' },
];

export function ProdutosClient() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingNcm, setLoadingNcm] = useState<boolean>(false);
  const [ncmFeedback, setNcmFeedback] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      ncm: '',
      unit_of_measure: 'UN',
      base_cost: 0,
      sale_price: 0,
      brand: '',
      category: 'aglomerantes',
      min_stock: 0,
      current_stock: 0,
      is_active: true,
    },
  });

  const handleGenerateSku = () => {
    const cat = watch('category') || 'aglomerantes';
    const ncm = watch('ncm') || '';
    const newSku = generateProductSku(cat, ncm);
    setValue('code', newSku);
  };

  const handleNcmLookup = async (ncmValue: string) => {
    const cleanNcm = ncmValue.replace(/\D/g, '');
    if (cleanNcm.length < 4) {
      setNcmFeedback(null);
      return;
    }
    setLoadingNcm(true);
    setNcmFeedback(null);
    try {
      const info = await lookupNcm(cleanNcm);
      if (info) {
        const targetCategory = info.suggestedCategory && info.suggestedCategory !== 'outros'
          ? info.suggestedCategory
          : watch('category') || 'aglomerantes';

        if (info.suggestedCategory && info.suggestedCategory !== 'outros') {
          setValue('category', info.suggestedCategory);
        }
        if (info.defaultUnit && UNITS.includes(info.defaultUnit)) {
          setValue('unit_of_measure', info.defaultUnit);
        }
        // Se o campo nome estiver vazio, sugere a descrição oficial do NCM
        const currentName = watch('name');
        if (!currentName || currentName.trim() === '') {
          setValue('name', info.description);
        }
        // Se o SKU estiver vazio, gera um SKU padronizado automaticamente
        const currentCode = watch('code');
        if (!currentCode || currentCode.trim() === '') {
          const autoSku = generateProductSku(targetCategory, cleanNcm);
          setValue('code', autoSku);
        }
        setNcmFeedback(`✓ NCM Identificado: ${info.description}`);
      }
    } catch (e) {
      console.warn('Falha na consulta automática do NCM:', e);
    } finally {
      setLoadingNcm(false);
    }
  };

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
  // TanStack Query: Listagem de Produtos
  // ---------------------------------------------------------------------------
  const {
    data: products = [],
    isLoading,
    isError,
    error,
  } = useQuery<ProductItem[]>({
    queryKey: ['products', searchTerm, selectedCategory],
    queryFn: async () => {
      const token = await getAuthToken();
      const url = new URL('/api/v1/products', window.location.origin);
      if (searchTerm.trim()) {
        url.searchParams.set('search', searchTerm.trim());
      }
      if (selectedCategory && selectedCategory !== 'all') {
        url.searchParams.set('category', selectedCategory);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Falha ao buscar catálogo de produtos.');
      }

      return response.json();
    },
  });

  // ---------------------------------------------------------------------------
  // Mutação: Criação de Produto
  // ---------------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: async (formData: ProductFormData) => {
      const token = await getAuthToken();
      const response = await fetch('/api/v1/products', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Falha ao cadastrar produto.');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      reset();
      setIsModalOpen(false);
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Erro inesperado ao cadastrar produto.');
    },
  });

  const onSubmit = (data: ProductFormData) => {
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

  const formatNcm = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (clean.length === 8) {
      return clean.replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3');
    }
    return val;
  };

  // KPIs
  const totalCount = products.length;
  const avgCost = totalCount > 0 ? products.reduce((acc, p) => acc + Number(p.base_cost), 0) / totalCount : 0;
  const activeCount = products.filter((p) => p.is_active).length;

  return (
    <div className="space-y-6">
      {/* Título & Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Catálogo Geral</span>
            <span>/</span>
            <span className="text-emerald-400 font-medium">Produtos & Insumos de Obra</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Materiais e Insumos
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Catálogo unificado com NCM, custos base de aquisição e precificação para composições de obras.
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
          Novo Insumo / Produto
        </button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <span className="text-xs font-medium text-slate-400">Total de Insumos</span>
          <p className="text-2xl font-bold text-white mt-1">{totalCount}</p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <span className="text-xs font-medium text-slate-400">Custo Médio Base</span>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(avgCost)}</p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <span className="text-xs font-medium text-slate-400">Itens Ativos</span>
          <p className="text-2xl font-bold text-teal-400 mt-1">{activeCount}</p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por descrição, código SKU, NCM ou marca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="all">Todas as Categorias</option>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tabela de Produtos */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Item / SKU</th>
                <th className="py-3 px-4">NCM Fiscal</th>
                <th className="py-3 px-4">Unidade</th>
                <th className="py-3 px-4 text-right">Custo Base (18,4)</th>
                <th className="py-3 px-4 text-right">Preço Venda</th>
                <th className="py-3 px-4">Categoria / Marca</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-400 mb-2" />
                    Carregando catálogo de produtos...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-red-400">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-400" />
                    {error instanceof Error ? error.message : 'Falha ao consultar produtos.'}
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Nenhum produto/insumo cadastrado. Clique no botão acima para adicionar.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const margin =
                    Number(p.sale_price) > 0 && Number(p.base_cost) > 0
                      ? (((Number(p.sale_price) - Number(p.base_cost)) / Number(p.sale_price)) * 100).toFixed(1)
                      : null;

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{p.name}</div>
                        {p.code && (
                          <div className="text-xs font-mono text-emerald-400/90">{p.code}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          <Tag className="w-3 h-3 text-emerald-400" />
                          {formatNcm(p.ncm)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-300">
                        {p.unit_of_measure}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-white font-medium">
                        {formatCurrency(Number(p.base_cost))}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-emerald-300">
                        {formatCurrency(Number(p.sale_price))}
                        {margin && (
                          <span className="block text-[10px] text-slate-400">
                            +{margin}%
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        <div>
                          {PRODUCT_CATEGORIES.find((c) => c.value === p.category)?.label || p.category || 'Geral'}
                        </div>
                        {p.brand && <div className="text-[11px] text-slate-500">{p.brand}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            p.is_active
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              p.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                            }`}
                          />
                          {p.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Cadastro de Produto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-[#0b101b] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Novo Produto ou Insumo</h3>
                  <p className="text-xs text-slate-400">Defina especificações técnicas e parâmetros tributários.</p>
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

              {/* Código SKU e Descrição */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-300">Código SKU Interno</label>
                    <button
                      type="button"
                      onClick={handleGenerateSku}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium transition-colors"
                      title="Gerar código SKU automático padronizado"
                    >
                      <Sparkles className="w-3 h-3" /> Gerar
                    </button>
                  </div>
                  <input
                    {...register('code')}
                    placeholder="Ex: MAT-CIM-2523-102"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Descrição do Insumo *</label>
                  <input
                    {...register('name')}
                    placeholder="Ex: Areia Média Lavada a Granel"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  {errors.name && <p className="text-red-400 text-[11px] mt-1">{errors.name.message}</p>}
                </div>
              </div>

              {/* NCM, Unidade e Categoria */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-300">Código NCM (8 dígitos) *</label>
                    {loadingNcm && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Buscando NCM...
                      </span>
                    )}
                  </div>
                  <input
                    {...register('ncm')}
                    maxLength={10}
                    placeholder="Ex: 25232910"
                    onBlur={(e) => handleNcmLookup(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  {ncmFeedback && (
                    <p className="text-[11px] text-emerald-400 mt-1 truncate font-medium">
                      {ncmFeedback}
                    </p>
                  )}
                  {errors.ncm && <p className="text-red-400 text-[11px] mt-1">{errors.ncm.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Unidade de Medida *</label>
                  <select
                    {...register('unit_of_measure')}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Categoria de Material</label>
                  <select
                    {...register('category')}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custos e Preços */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Custo Base de Aquisição (R$) *</label>
                  <input
                    {...register('base_cost')}
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="0.0000"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  {errors.base_cost && <p className="text-red-400 text-[11px] mt-1">{errors.base_cost.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Preço Base de Venda / Faturamento (R$)</label>
                  <input
                    {...register('sale_price')}
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="0.0000"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              {/* Marca e Descrição Técnica */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Marca / Fabricante</label>
                  <input
                    {...register('brand')}
                    placeholder="Ex: Votorantim, Gerdau, Tigre"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Estoque Mínimo de Segurança</label>
                  <input
                    {...register('min_stock')}
                    type="number"
                    step="0.01"
                    placeholder="0"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
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
                    'Salvar Insumo'
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
