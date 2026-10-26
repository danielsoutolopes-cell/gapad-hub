'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Building2,
  User,
  Plus,
  Search,
  Mail,
  Phone,
  FileText,
  MapPin,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  Loader2,
  Filter,
  Check,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';

// -----------------------------------------------------------------------------
// 1. Schema de Validação com Zod
// -----------------------------------------------------------------------------
const clientFormSchema = z
  .object({
    person_type: z.enum(['PF', 'PJ'], {
      required_error: 'Selecione o tipo de pessoa.',
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
          message: 'Documento inválido. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).',
        }
      ),
    name: z
      .string()
      .min(3, 'O Nome ou Razão Social deve conter no mínimo 3 caracteres.')
      .max(255),
    trade_name: z.string().max(255).optional(),
    email: z.string().email('E-mail corporativo inválido.').or(z.literal('')).optional(),
    phone: z.string().min(8, 'Telefone inválido.').or(z.literal('')).optional(),
    state_registration: z.string().max(30).optional(),
    municipal_registration: z.string().max(30).optional(),
    address_street: z.string().max(255).optional(),
    address_number: z.string().max(30).optional(),
    address_city: z.string().max(100).optional(),
    address_state: z.string().max(2).optional(),
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

type ClientFormData = z.infer<typeof clientFormSchema>;

interface ClientItem {
  id: string;
  tenant_id: string;
  person_type: 'PF' | 'PJ';
  document: string;
  name: string;
  trade_name?: string | null;
  email?: string | null;
  phone?: string | null;
  state_registration?: string | null;
  municipal_registration?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  is_active: boolean;
  created_at: string;
}

// -----------------------------------------------------------------------------
// 2. Client Component Principal
// -----------------------------------------------------------------------------
export default function ClientesPage() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Hook Form com Zod Resolver
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      person_type: 'PJ',
      document: '',
      name: '',
      trade_name: '',
      email: '',
      phone: '',
      state_registration: '',
      municipal_registration: '',
      address_city: '',
      address_state: '',
      is_active: true,
    },
  });

  const selectedPersonType = watch('person_type');

  // Helper para obter o token JWT do usuário ativo no Supabase
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
  // 3. TanStack Query: Fetch da listagem (/api/v1/clients) com Fallback Supabase
  // ---------------------------------------------------------------------------
  const {
    data: clients = [],
    isLoading,
    isError,
    error,
  } = useQuery<ClientItem[]>({
    queryKey: ['clients', searchTerm],
    queryFn: async () => {
      const token = await getAuthToken();
      const url = new URL('/api/v1/clients', window.location.origin);
      if (searchTerm.trim()) {
        url.searchParams.set('search', searchTerm.trim());
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
        console.warn('FastAPI /api/v1/clients retornou status não-200. Ativando fallback Supabase...');
      } catch (e) {
        console.warn('Falha de rede ao conectar com FastAPI. Ativando fallback Supabase...', e);
      }

      // 2. Fallback resiliente via Supabase Client (com isolamento RLS por tenant)
      let query = supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchTerm.trim()) {
        query = query.or(`name.ilike.%${searchTerm.trim()}%,document.ilike.%${searchTerm.trim()}%`);
      }

      const { data, error: supaErr } = await query;
      if (supaErr) {
        throw new Error(`Falha ao carregar clientes: ${supaErr.message}`);
      }
      return (data || []) as ClientItem[];
    },
  });

  // ---------------------------------------------------------------------------
  // 4. TanStack Query: Mutation de Criação com Invalidação de Cache
  // ---------------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: async (formData: ClientFormData) => {
      const token = await getAuthToken();

      try {
        const response = await fetch('/api/v1/clients', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          return await response.json();
        }
      } catch (e) {
        console.warn('Erro na rota FastAPI, acionando fallback Supabase...', e);
      }

      // Fallback Supabase
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const tenantId = session?.user?.app_metadata?.tenant_id || session?.user?.user_metadata?.tenant_id;
      const { data, error: insertErr } = await supabase
        .from('clients')
        .insert([{ ...formData, tenant_id: tenantId }])
        .select()
        .single();

      if (insertErr) throw new Error(insertErr.message || 'Falha ao salvar cliente.');
      return data;
    },
    onSuccess: () => {
      // Invalidação compulsória do cache do TanStack Query
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      reset();
      setIsModalOpen(false);
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Erro inesperado ao cadastrar cliente.');
    },
  });

  const onSubmit = (data: ClientFormData) => {
    setErrorMessage(null);
    createMutation.mutate(data);
  };

  // Funções de Máscara e Formatação
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

  const formatPhone = (phone?: string | null) => {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 11) {
      return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    if (clean.length === 10) {
      return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  };

  // Métricas Consolidadas
  const totalCount = clients.length;
  const pjCount = clients.filter((c) => c.person_type === 'PJ').length;
  const pfCount = clients.filter((c) => c.person_type === 'PF').length;
  const activeCount = clients.filter((c) => c.is_active).length;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      <DashboardNav />

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* Cabeçalho de Título & Ações */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <span>Gestão Comercial</span>
              <ChevronRight className="w-3 h-3 text-slate-600" />
              <span className="text-emerald-400 font-medium">Clientes & Tomadores</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Carteira de Clientes
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Tomadores de serviço para vinculação a contratos de obras e emissões fiscais.
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
            Cadastrar Novo Cliente
          </button>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800">
            <span className="text-xs font-medium text-slate-400">Total de Clientes</span>
            <div className="text-2xl font-black text-white mt-2">{totalCount}</div>
            <span className="text-[11px] text-slate-500 block mt-1">Isolados por RLS</span>
          </div>

          <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800">
            <span className="text-xs font-medium text-slate-400">Pessoas Jurídicas (PJ)</span>
            <div className="text-2xl font-black text-emerald-400 mt-2">{pjCount}</div>
            <span className="text-[11px] text-slate-500 block mt-1">Construtoras & Empresas</span>
          </div>

          <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800">
            <span className="text-xs font-medium text-slate-400">Pessoas Físicas (PF)</span>
            <div className="text-2xl font-black text-teal-400 mt-2">{pfCount}</div>
            <span className="text-[11px] text-slate-500 block mt-1">Reformas e Obras Particulares</span>
          </div>

          <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800">
            <span className="text-xs font-medium text-slate-400">Cadastros Ativos</span>
            <div className="text-2xl font-black text-cyan-400 mt-2">{activeCount}</div>
            <span className="text-[11px] text-slate-500 block mt-1">Aptos para faturamento</span>
          </div>
        </div>

        {/* Tabela Shadcn UI-Styled */}
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
          {/* Barra de Filtros */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome, razão social ou CPF/CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-1.5 self-end sm:self-auto">
              <span>TanStack Query:</span>
              <span className="text-emerald-400 font-mono">Cache Automático Ativo</span>
            </div>
          </div>

          {/* Estado de Carregamento */}
          {isLoading && (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <span className="text-xs font-medium">Carregando carteira de clientes...</span>
            </div>
          )}

          {/* Erro */}
          {isError && (
            <div className="p-8 text-center text-red-400 text-xs sm:text-sm">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
              <p className="font-semibold">Erro ao carregar clientes:</p>
              <p className="font-mono mt-1 text-slate-400">{(error as any)?.message}</p>
            </div>
          )}

          {/* Tabela de Dados */}
          {!isLoading && !isError && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    <th className="py-3.5 px-4 sm:px-6">Tomador / Razão Social</th>
                    <th className="py-3.5 px-4 sm:px-6">Documento</th>
                    <th className="py-3.5 px-4 sm:px-6 text-center">Tipo</th>
                    <th className="py-3.5 px-4 sm:px-6">Contato</th>
                    <th className="py-3.5 px-4 sm:px-6">Localização</th>
                    <th className="py-3.5 px-4 sm:px-6 text-center">Status</th>
                    <th className="py-3.5 px-4 sm:px-6 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs sm:text-sm text-slate-300">
                  {clients.length > 0 ? (
                    clients.map((client) => (
                      <tr
                        key={client.id}
                        className="hover:bg-slate-800/30 transition-colors duration-150"
                      >
                        {/* Nome & Fantasia */}
                        <td className="py-4 px-4 sm:px-6">
                          <div className="flex flex-col">
                            <span className="font-semibold text-white text-sm">
                              {client.name}
                            </span>
                            {client.trade_name && (
                              <span className="text-xs text-slate-400">
                                {client.trade_name}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Documento */}
                        <td className="py-4 px-4 sm:px-6 font-mono text-xs text-slate-300">
                          {formatDocument(client.document, client.person_type)}
                        </td>

                        {/* Tipo (Badge) */}
                        <td className="py-4 px-4 sm:px-6 text-center">
                          {client.person_type === 'PJ' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              <Building2 className="w-3 h-3" />
                              PJ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                              <User className="w-3 h-3" />
                              PF
                            </span>
                          )}
                        </td>

                        {/* Contato */}
                        <td className="py-4 px-4 sm:px-6 text-xs space-y-1">
                          {client.email && (
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <Mail className="w-3.5 h-3.5 text-slate-500" />
                              <span className="truncate max-w-[180px]">{client.email}</span>
                            </div>
                          )}
                          {client.phone && (
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <Phone className="w-3.5 h-3.5 text-slate-500" />
                              <span>{formatPhone(client.phone)}</span>
                            </div>
                          )}
                        </td>

                        {/* Localização */}
                        <td className="py-4 px-4 sm:px-6 text-xs text-slate-400">
                          {client.address_city ? (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-500" />
                              <span>
                                {client.address_city}
                                {client.address_state ? `/${client.address_state}` : ''}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-600">Não informado</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 sm:px-6 text-center">
                          {client.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-500">
                              Inativo
                            </span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="py-4 px-4 sm:px-6 text-center">
                          <div className="inline-flex items-center gap-2">
                            {client.phone && (
                              <a
                                href={`https://wa.me/55${client.phone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Enviar mensagem via WhatsApp"
                                className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </a>
                            )}
                            <Link
                              href="/dashboard/obras"
                              title="Ver obras vinculadas"
                              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-16 px-4 text-center">
                        <div className="max-w-sm mx-auto flex flex-col items-center justify-center space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                            <Users className="w-6 h-6 stroke-[1.5]" />
                          </div>
                          <h3 className="text-sm font-bold text-white">Nenhum cliente encontrado</h3>
                          <p className="text-xs text-slate-400">
                            Cadastre seu primeiro tomador de serviço para vincular a novas obras e emitir NFS-e.
                          </p>
                          <button
                            type="button"
                            onClick={() => setIsModalOpen(true)}
                            className="mt-2 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            Cadastrar Primeiro Cliente
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Rodapé da Tabela */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 text-xs text-slate-500 flex items-center justify-between">
            <span>Exibindo {clients.length} clientes</span>
            <span className="font-mono text-[11px] text-slate-600">
              Endpoint: GET /api/v1/clients (Tenant Isolado)
            </span>
          </div>
        </div>
      </main>

      {/* -----------------------------------------------------------------------
          5. Modal / Dialog Shadcn-Style de "Cadastrar Novo Cliente"
         ----------------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-xl rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto">
            {/* Botão Fechar */}
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                Cadastrar Novo Cliente
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Preencha os dados do tomador. O registro será vinculado automaticamente à sua empresa.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 mb-5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Seletor de Tipo: PF ou PJ */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Tipo de Tomador
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setValue('person_type', 'PJ');
                      setValue('document', '');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      selectedPersonType === 'PJ'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-sm shadow-emerald-500/20'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    Pessoa Jurídica (CNPJ)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setValue('person_type', 'PF');
                      setValue('document', '');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      selectedPersonType === 'PF'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-sm shadow-emerald-500/20'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    Pessoa Física (CPF)
                  </button>
                </div>
              </div>

              {/* Documento (CPF / CNPJ) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="client-document">
                  {selectedPersonType === 'PJ' ? 'CNPJ (14 dígitos)' : 'CPF (11 dígitos)'} *
                </label>
                <input
                  id="client-document"
                  type="text"
                  placeholder={selectedPersonType === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                  {...register('document')}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                {errors.document && (
                  <p className="text-[11px] text-red-400 mt-1">{errors.document.message}</p>
                )}
              </div>

              {/* Razão Social / Nome */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="client-name">
                  {selectedPersonType === 'PJ' ? 'Razão Social' : 'Nome Completo'} *
                </label>
                <input
                  id="client-name"
                  type="text"
                  placeholder={selectedPersonType === 'PJ' ? 'Construtora Exemplo Ltda' : 'João da Silva'}
                  {...register('name')}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                {errors.name && (
                  <p className="text-[11px] text-red-400 mt-1">{errors.name.message}</p>
                )}
              </div>

              {/* Nome Fantasia (para PJ) */}
              {selectedPersonType === 'PJ' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="client-trade-name">
                    Nome Fantasia
                  </label>
                  <input
                    id="client-trade-name"
                    type="text"
                    placeholder="Exemplo Engenharia"
                    {...register('trade_name')}
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              )}

              {/* Contatos: E-mail e Telefone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="client-email">
                    E-mail Corporativo
                  </label>
                  <input
                    id="client-email"
                    type="email"
                    placeholder="financeiro@tomador.com"
                    {...register('email')}
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  {errors.email && (
                    <p className="text-[11px] text-red-400 mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="client-phone">
                    Telefone / WhatsApp
                  </label>
                  <input
                    id="client-phone"
                    type="text"
                    placeholder="(11) 99999-8888"
                    {...register('phone')}
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  {errors.phone && (
                    <p className="text-[11px] text-red-400 mt-1">{errors.phone.message}</p>
                  )}
                </div>
              </div>

              {/* Cidade e Estado */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="client-city">
                    Cidade
                  </label>
                  <input
                    id="client-city"
                    type="text"
                    placeholder="São Paulo"
                    {...register('address_city')}
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="client-state">
                    UF
                  </label>
                  <input
                    id="client-state"
                    type="text"
                    maxLength={2}
                    placeholder="SP"
                    {...register('address_state')}
                    className="w-full uppercase bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              {/* Botões de Submissão */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-60"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando na API...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      Confirmar Cadastro
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
