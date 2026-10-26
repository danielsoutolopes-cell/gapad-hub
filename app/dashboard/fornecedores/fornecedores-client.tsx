'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Truck,
  Plus,
  Search,
  Mail,
  Phone,
  Building2,
  User,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  MapPin,
  ExternalLink,
  MessageCircle,
  Copy,
  Check,
  HardHat,
  Tag,
  Zap,
  Wrench,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// -----------------------------------------------------------------------------
// 1. Schema de Validação com Zod
// -----------------------------------------------------------------------------
const supplierFormSchema = z
  .object({
    person_type: z.enum(['PF', 'PJ'], {
      required_error: 'Selecione o tipo de fornecedor.',
    }),
    document: z
      .string()
      .min(1, 'Documento (CPF ou CNPJ) é obrigatório.')
      .refine(
        (val) => {
          const clean = val.replace(/\D/g, '');
          return clean.length === 11 || clean.length === 14;
        },
        {
          message: 'Documento inválido. Informe CPF (11 dígitos) ou CNPJ (14 dígitos).',
        }
      ),
    name: z
      .string()
      .min(2, 'O Nome ou Razão Social deve ter no mínimo 2 caracteres.')
      .max(255),
    trade_name: z.string().max(255).optional(),
    category: z.string().max(100).optional(),
    email: z.string().email('E-mail inválido.').or(z.literal('')).optional(),
    phone: z.string().min(8, 'Telefone inválido.').or(z.literal('')).optional(),
    contact_name: z.string().max(100).optional(),
    state_registration: z.string().max(30).optional(),
    municipal_registration: z.string().max(30).optional(),
    address_zip_code: z.string().max(10).optional(),
    address_street: z.string().max(255).optional(),
    address_number: z.string().max(30).optional(),
    address_complement: z.string().max(100).optional(),
    address_neighborhood: z.string().max(100).optional(),
    address_city: z.string().max(100).optional(),
    address_state: z.string().max(2).optional(),
    is_subcontractor: z.boolean().default(false),
    specialty_ids: z.array(z.string()).optional(),
    notes: z.string().optional(),
    is_active: z.boolean().default(true),
  })
  .refine(
    (data) => {
      const clean = data.document.replace(/\D/g, '');
      if (data.person_type === 'PF') return clean.length === 11;
      if (data.person_type === 'PJ') return clean.length === 14;
      return true;
    },
    {
      message: 'O comprimento do documento não corresponde ao tipo selecionado (PF=11, PJ=14).',
      path: ['document'],
    }
  );

type SupplierFormData = z.infer<typeof supplierFormSchema>;

interface SpecialtyOption {
  id: string;
  name: string;
  description?: string | null;
}

interface SupplierItem {
  id: string;
  tenant_id: string;
  person_type: 'PF' | 'PJ';
  document: string;
  name: string;
  trade_name?: string | null;
  category?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_name?: string | null;
  state_registration?: string | null;
  municipal_registration?: string | null;
  address_zip_code?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  is_subcontractor?: boolean;
  specialties?: string[];
  notes?: string | null;
  is_active: boolean;
  created_at: string;
}

const CATEGORIES = [
  { value: 'materiais_construcao', label: 'Materiais de Construção' },
  { value: 'subempreiteira', label: 'Subempreiteira / Mão de Obra' },
  { value: 'locacao_equipamentos', label: 'Locação de Equipamentos' },
  { value: 'servicos_especializados', label: 'Serviços Especializados' },
  { value: 'outros', label: 'Outros Suprimentos' },
];

export function FornecedoresClient() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadingCep, setLoadingCep] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      person_type: 'PJ',
      document: '',
      name: '',
      trade_name: '',
      category: 'materiais_construcao',
      email: '',
      phone: '',
      contact_name: '',
      state_registration: '',
      municipal_registration: '',
      address_zip_code: '',
      address_street: '',
      address_number: '',
      address_complement: '',
      address_neighborhood: '',
      address_city: '',
      address_state: '',
      is_active: true,
    },
  });

  const handleCepLookup = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setValue('address_street', data.logradouro || '');
        setValue('address_neighborhood', data.bairro || '');
        setValue('address_city', data.localidade || '');
        setValue('address_state', data.uf || '');
      }
    } catch (err) {
      console.warn('Falha na consulta automática do CEP:', err);
    } finally {
      setLoadingCep(false);
    }
  };

  const selectedPersonType = watch('person_type');
  const isSubcontractorChecked = watch('is_subcontractor');
  const selectedSpecialtyIds = watch('specialty_ids') || [];

  // Token JWT para autorização da API FastAPI
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
  // TanStack Query: Especialidades Técnicas Disponíveis
  // ---------------------------------------------------------------------------
  const { data: specialtiesList = [] } = useQuery<SpecialtyOption[]>({
    queryKey: ['specialties-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('specialties')
        .select('id, name, description')
        .order('name');
      if (error) {
        console.warn('Erro ao listar especialidades:', error);
        return [];
      }
      return data || [];
    },
  });

  // ---------------------------------------------------------------------------
  // TanStack Query: Listagem de Fornecedores
  // ---------------------------------------------------------------------------
  const {
    data: suppliers = [],
    isLoading,
    isError,
    error,
  } = useQuery<SupplierItem[]>({
    queryKey: ['suppliers', searchTerm, selectedCategory],
    queryFn: async () => {
      const token = await getAuthToken();
      let fetchedSuppliers: SupplierItem[] = [];

      // 1. Tenta API FastAPI
      try {
        const url = new URL('/api/v1/suppliers', window.location.origin);
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

        if (response.ok) {
          fetchedSuppliers = await response.json();
        }
      } catch (e) {
        console.warn('Fallback para Supabase Client ao listar fornecedores...', e);
      }

      // 2. Fallback resiliente via Supabase Client (RLS nativo) se necessário
      if (!fetchedSuppliers || fetchedSuppliers.length === 0) {
        let query = supabase
          .from('suppliers')
          .select('*')
          .order('created_at', { ascending: false });

        if (searchTerm.trim()) {
          query = query.or(`name.ilike.%${searchTerm.trim()}%,document.ilike.%${searchTerm.trim()}%`);
        }
        if (selectedCategory && selectedCategory !== 'all') {
          query = query.eq('category', selectedCategory);
        }

        const { data, error: supaErr } = await query;
        if (supaErr) {
          throw new Error(`Falha ao consultar fornecedores: ${supaErr.message}`);
        }
        fetchedSuppliers = (data || []) as SupplierItem[];
      }

      // 3. Enriquecer com especialidades de supplier_specialties
      try {
        const { data: links } = await supabase
          .from('supplier_specialties')
          .select('supplier_id, specialties(name)');
        
        if (links) {
          const specMap: Record<string, string[]> = {};
          links.forEach((l: any) => {
            const suppId = l.supplier_id;
            const sName = l.specialties?.name;
            if (suppId && sName) {
              if (!specMap[suppId]) specMap[suppId] = [];
              specMap[suppId].push(sName);
            }
          });

          fetchedSuppliers = fetchedSuppliers.map((s) => ({
            ...s,
            specialties: specMap[s.id] || [],
          }));
        }
      } catch (err) {
        console.warn('Não foi possível carregar especialidades dos fornecedores:', err);
      }

      return fetchedSuppliers;
    },
  });

  // ---------------------------------------------------------------------------
  // Mutação: Cadastro de Fornecedor
  // ---------------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: async (formData: SupplierFormData) => {
      const token = await getAuthToken();
      const response = await fetch('/api/v1/suppliers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Falha ao cadastrar fornecedor.');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      reset();
      setIsModalOpen(false);
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Erro inesperado ao cadastrar fornecedor.');
    },
  });

  const onSubmit = (data: SupplierFormData) => {
    setErrorMessage(null);
    createMutation.mutate(data);
  };

  const formatDocument = (doc: string, type: 'PF' | 'PJ') => {
    const clean = doc.replace(/\D/g, '');
    if (type === 'PF' && clean.length === 11) {
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (type === 'PJ' && clean.length === 14) {
      return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // KPIs
  const totalCount = suppliers.length;
  const materiaisCount = suppliers.filter((s) => s.category === 'materiais_construcao').length;
  const subempreiteirasCount = suppliers.filter((s) => s.category === 'subempreiteira').length;
  const activeCount = suppliers.filter((s) => s.is_active).length;

  return (
    <div className="space-y-6">
      {/* Título & Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Catálogo Geral</span>
            <span>/</span>
            <span className="text-emerald-400 font-medium">Fornecedores & Subempreiteiras</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Fornecedores e Parceiros
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Gestão de distribuidores de insumos, prestadores terceirizados e subempreiteiras de obras.
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
          Novo Fornecedor
        </button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <span className="text-xs font-medium text-slate-400">Total de Parceiros</span>
          <p className="text-2xl font-bold text-white mt-1">{totalCount}</p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <span className="text-xs font-medium text-slate-400">Materiais de Obra</span>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{materiaisCount}</p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <span className="text-xs font-medium text-slate-400">Subempreiteiras</span>
          <p className="text-2xl font-bold text-teal-400 mt-1">{subempreiteirasCount}</p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <span className="text-xs font-medium text-slate-400">Fornecedores Ativos</span>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{activeCount}</p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por razão social, nome fantasia, documento ou contato..."
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
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tabela de Fornecedores */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Fornecedor</th>
                <th className="py-3 px-4">CNPJ / CPF</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Contato / Contratação</th>
                <th className="py-3 px-4">Localização</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-400 mb-2" />
                    Carregando fornecedores do tenant...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-red-400">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-400" />
                    {error instanceof Error ? error.message : 'Falha ao consultar fornecedores.'}
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Nenhum fornecedor cadastrado. Clique no botão acima para adicionar.
                  </td>
                </tr>
              ) : (
                suppliers.map((sup) => (
                  <tr
                    key={sup.id}
                    onClick={() => setSelectedSupplier(sup)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white group-hover:text-emerald-300 transition-colors">{sup.name}</div>
                      {sup.trade_name && (
                        <div className="text-xs text-slate-400">{sup.trade_name}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <span>{formatDocument(sup.document, sup.person_type)}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(sup.document, sup.id);
                          }}
                          className="text-slate-500 hover:text-emerald-400 transition-colors"
                          title="Copiar documento limpo"
                        >
                          {copiedId === sup.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-500 block uppercase">
                        {sup.person_type === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {CATEGORIES.find((c) => c.value === sup.category)?.label || sup.category || 'Geral'}
                        </span>
                        {sup.specialties && sup.specialties.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {sup.specialties.map((spec: string) => (
                              <span
                                key={spec}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              >
                                {spec}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {sup.contact_name && (
                        <div className="text-xs font-medium text-slate-200">{sup.contact_name}</div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                        {sup.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500" />
                            {sup.phone}
                          </span>
                        )}
                        {sup.email && (
                          <span className="flex items-center gap-1 truncate max-w-[160px]">
                            <Mail className="w-3 h-3 text-slate-500" />
                            {sup.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {sup.address_city && sup.address_state ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {sup.address_city} - {sup.address_state}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          sup.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            sup.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                          }`}
                        />
                        {sup.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Cadastro de Fornecedor */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-[#0b101b] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Cadastrar Novo Fornecedor</h3>
                  <p className="text-xs text-slate-400">Preencha os dados do parceiro comercial.</p>
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

              {/* Tipo de Pessoa */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Tipo de Pessoa</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setValue('person_type', 'PJ')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      selectedPersonType === 'PJ'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    Pessoa Jurídica (CNPJ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('person_type', 'PF')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      selectedPersonType === 'PF'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    Pessoa Física (CPF)
                  </button>
                </div>
              </div>

              {/* Razão Social e Fantasia */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {selectedPersonType === 'PJ' ? 'Razão Social *' : 'Nome Completo *'}
                  </label>
                  <input
                    {...register('name')}
                    placeholder={selectedPersonType === 'PJ' ? 'Ex: Distribuidora Silva Ltda' : 'Ex: João da Silva'}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  {errors.name && <p className="text-red-400 text-[11px] mt-1">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Nome Fantasia</label>
                  <input
                    {...register('trade_name')}
                    placeholder="Ex: Comercial Silva"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              {/* Documento e Categoria */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {selectedPersonType === 'PJ' ? 'CNPJ (14 dígitos) *' : 'CPF (11 dígitos) *'}
                  </label>
                  <input
                    {...register('document')}
                    placeholder={selectedPersonType === 'PJ' ? '12.345.678/0001-90' : '123.456.789-00'}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  {errors.document && <p className="text-red-400 text-[11px] mt-1">{errors.document.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Categoria de Fornecimento</label>
                  <select
                    {...register('category')}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bloco de Subcontratação e Especialidades Técnicas (Eletricista, etc) */}
              <div className="p-4 rounded-xl border border-teal-500/30 bg-gradient-to-r from-teal-950/20 via-slate-900/40 to-slate-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardHat className="w-4 h-4 text-teal-400" />
                    <div>
                      <span className="text-xs font-bold text-white block">É Subcontratado / Mão de Obra de Canteiro?</span>
                      <span className="text-[11px] text-slate-400 block">
                        Habilita alocação direta em Obras, boletins de medição e conta corrente.
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('is_subcontractor')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                  </label>
                </div>

                {/* Seleção de Especialidades se for Subcontratado ou Subempreiteiro */}
                {(isSubcontractorChecked || watch('category') === 'subempreiteira') && (
                  <div className="pt-3 border-t border-slate-800/80 space-y-2 animate-fade-in">
                    <label className="block text-xs font-semibold text-teal-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" />
                        Especialidades / Campos de Atuação:
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        Clique para selecionar ou desmarcar
                      </span>
                    </label>

                    <div className="flex flex-wrap gap-1.5">
                      {specialtiesList.map((spec) => {
                        const isSelected = selectedSpecialtyIds.includes(spec.id);
                        return (
                          <button
                            key={spec.id}
                            type="button"
                            onClick={() => {
                              const current = selectedSpecialtyIds;
                              if (isSelected) {
                                setValue(
                                  'specialty_ids',
                                  current.filter((id) => id !== spec.id)
                                );
                              } else {
                                setValue('specialty_ids', [...current, spec.id]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                              isSelected
                                ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20'
                                : 'bg-slate-900/90 text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white'
                            }`}
                          >
                            <Zap className={`w-3 h-3 ${isSelected ? 'text-slate-950' : 'text-teal-400'}`} />
                            {spec.name}
                            {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Contatos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Responsável / Contato</label>
                  <input
                    {...register('contact_name')}
                    placeholder="Ex: Carlos Eduardo"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">E-mail Comercial</label>
                  <input
                    {...register('email')}
                    type="email"
                    placeholder="comercial@fornecedor.com.br"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Telefone / WhatsApp</label>
                  <input
                    {...register('phone')}
                    placeholder="(11) 98888-7777"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              {/* Seção de Endereço Completo */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    Endereço Completo & Localização
                  </span>
                  {loadingCep && (
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Buscando CEP...
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {/* CEP e Logradouro */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">CEP</label>
                      <input
                        {...register('address_zip_code')}
                        placeholder="00000-000"
                        onBlur={(e) => handleCepLookup(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Logradouro / Rua / Av.</label>
                      <input
                        {...register('address_street')}
                        placeholder="Ex: Av. Paulista"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    </div>
                  </div>

                  {/* Número, Complemento e Bairro */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Número</label>
                      <input
                        {...register('address_number')}
                        placeholder="1000"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Complemento</label>
                      <input
                        {...register('address_complement')}
                        placeholder="Sala 12, Galpão A"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Bairro</label>
                      <input
                        {...register('address_neighborhood')}
                        placeholder="Bela Vista"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    </div>
                  </div>

                  {/* Cidade e UF */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Cidade</label>
                      <input
                        {...register('address_city')}
                        placeholder="São Paulo"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Estado (UF)</label>
                      <input
                        {...register('address_state')}
                        maxLength={2}
                        placeholder="SP"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white uppercase placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    </div>
                  </div>
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
                    'Salvar Fornecedor'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Fornecedor / Subempreiteiro */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-[#0b101b] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedSupplier.name}</h3>
                  <p className="text-xs text-slate-400">
                    {selectedSupplier.trade_name || (selectedSupplier.person_type === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSupplier(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
              {/* Documento, Categoria e Status */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <div>
                  <span className="text-[11px] text-slate-400 block">Documento</span>
                  <span className="text-xs font-mono font-semibold text-white">
                    {formatDocument(selectedSupplier.document, selectedSupplier.person_type)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Categoria</span>
                  <span className="text-xs font-semibold text-emerald-400">
                    {CATEGORIES.find((c) => c.value === selectedSupplier.category)?.label || selectedSupplier.category || 'Geral'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Tipo de Parceiro</span>
                  <span className="text-xs font-semibold text-teal-300">
                    {selectedSupplier.is_subcontractor ? 'Subempreiteiro / Obra' : 'Fornecedor Padrão'}
                  </span>
                </div>
              </div>

              {/* Especialidades Técnicas */}
              {selectedSupplier.specialties && selectedSupplier.specialties.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-teal-400" />
                    Especialidades Técnicas / Mão de Obra
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSupplier.specialties.map((spec: string) => (
                      <span
                        key={spec}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                      >
                        <Check className="w-3 h-3 text-emerald-400" />
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Contato Comercial */}
              <div>
                <h4 className="text-xs font-semibold text-slate-300 mb-2">Contato & Comunicação</h4>
                <div className="space-y-2 text-xs text-slate-300">
                  {selectedSupplier.contact_name && (
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>Responsável: <strong>{selectedSupplier.contact_name}</strong></span>
                    </div>
                  )}
                  {selectedSupplier.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      <a href={`mailto:${selectedSupplier.email}`} className="text-emerald-400 hover:underline">
                        {selectedSupplier.email}
                      </a>
                    </div>
                  )}
                  {selectedSupplier.phone && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>{selectedSupplier.phone}</span>
                      </div>
                      <a
                        href={`https://wa.me/55${selectedSupplier.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-sm"
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-white" />
                        Conversar no WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Endereço Completo */}
              <div className="pt-3 border-t border-slate-800">
                <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  Localização & Endereço
                </h4>
                <div className="text-xs text-slate-400 space-y-1">
                  <p>
                    {selectedSupplier.address_street
                      ? `${selectedSupplier.address_street}, ${selectedSupplier.address_number || 'S/N'}${selectedSupplier.address_complement ? ` - ${selectedSupplier.address_complement}` : ''}`
                      : 'Logradouro não informado'}
                  </p>
                  <p>
                    {selectedSupplier.address_neighborhood ? `Bairro: ${selectedSupplier.address_neighborhood} | ` : ''}
                    {selectedSupplier.address_city || '—'} - {selectedSupplier.address_state || '—'}
                  </p>
                  {selectedSupplier.address_zip_code && (
                    <p className="font-mono text-[11px] text-slate-500">CEP: {selectedSupplier.address_zip_code}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSupplier(null)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
