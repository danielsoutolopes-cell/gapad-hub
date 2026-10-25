'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Crown,
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  HardHat,
  Flame,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  ShieldCheck,
  MapPin,
  Mail,
  Phone,
  FileSpreadsheet,
  Layers,
  ArrowUpRight,
  Loader2,
  Trash2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface TenantStats {
  total_users: number;
  total_active_projects: number;
  total_projects: number;
  total_measurements: number;
  total_clients: number;
}

interface TenantItem {
  id: string;
  legal_name: string;
  trade_name?: string | null;
  cnpj: string;
  email?: string | null;
  phone?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  is_active: boolean;
  created_at: string;
  stats: TenantStats;
}

interface BackofficeData {
  total_tenants: number;
  total_users_global: number;
  total_active_projects_global: number;
  tenants: TenantItem[];
}

export function BackofficeClient() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTenantForReset, setSelectedTenantForReset] = useState<TenantItem | null>(null);
  const [isResetAlertOpen, setIsResetAlertOpen] = useState(false);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // 1. Consulta Global dos Tenants via TanStack Query
  // ---------------------------------------------------------------------------
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<BackofficeData>({
    queryKey: ['backoffice-tenants'],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch('/api/v1/backoffice/tenants', {
        headers: {
          Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
        },
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || `Erro HTTP ${response.status} ao carregar backoffice`);
      }

      return await response.json();
    },
    staleTime: 1000 * 30, // 30 segundos
  });

  // ---------------------------------------------------------------------------
  // 2. Mutation Destrutiva: Reset do Tenant via TanStack Query
  // ---------------------------------------------------------------------------
  const resetMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`/api/v1/backoffice/tenants/${tenantId}/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
        },
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || `Erro ao resetar tenant: ${response.status}`);
      }

      return await response.json();
    },
    onSuccess: (res) => {
      setIsResetAlertOpen(false);
      setSelectedTenantForReset(null);
      setActionSuccessNotice(res.message);
      queryClient.invalidateQueries({ queryKey: ['backoffice-tenants'] });
    },
  });

  const tenants = data?.tenants || [];
  const filteredTenants = tenants.filter((t) => {
    const term = searchTerm.toLowerCase();
    return (
      t.legal_name.toLowerCase().includes(term) ||
      (t.trade_name && t.trade_name.toLowerCase().includes(term)) ||
      t.cnpj.includes(term) ||
      (t.email && t.email.toLowerCase().includes(term))
    );
  });

  const mrrFicticio = (data?.total_tenants || 1) * 4950;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Banner de Boas-Vindas God Mode */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-red-950/40 border border-red-500/20 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-red-600/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-300 border border-red-500/30">
              <Crown className="w-3.5 h-3.5 text-red-400" />
              <span>Painel do Dono do SaaS • Acesso Restrito Absoluto</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Torre de Controle Global{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-rose-300 to-amber-300">
                (God Mode)
              </span>
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              Monitore a infraestrutura multi-tenant, gerencie instâncias corporativas e execute rotinas
              administrativas de alta criticidade com governança centralizada.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all shadow-md disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin text-red-400' : 'text-slate-400'}`} />
              <span>Atualizar Métricas</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notificação de Ação Concluída */}
      {actionSuccessNotice && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-200 flex items-start justify-between gap-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-xs uppercase tracking-wider block text-emerald-300">
                Operação Concluída com Sucesso
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">{actionSuccessNotice}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessNotice(null)}
            className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1"
          >
            Fechar
          </button>
        </div>
      )}

      {/* 2. Cards com Métricas Globais do SaaS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total de Empresas */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/90 space-y-3 relative overflow-hidden group hover:border-red-500/30 transition-all shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total de Empresas
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {isLoading ? '...' : data?.total_tenants ?? 0}
            </span>
            <span className="text-xs text-slate-400 block mt-1">
              Instâncias Multi-tenant Isoladas
            </span>
          </div>
        </div>

        {/* Card 2: MRR Estimado Fictício */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/90 space-y-3 relative overflow-hidden group hover:border-emerald-500/30 transition-all shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              MRR SaaS (Recorrente)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-emerald-300 tracking-tight">
              {isLoading ? '...' : `R$ ${mrrFicticio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            </span>
            <span className="text-xs text-slate-400 block mt-1">
              Ticket Médio R$ 4.950 / tenant
            </span>
          </div>
        </div>

        {/* Card 3: Total de Usuários Globais */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/90 space-y-3 relative overflow-hidden group hover:border-blue-500/30 transition-all shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Usuários Globais
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {isLoading ? '...' : data?.total_users_global ?? 0}
            </span>
            <span className="text-xs text-slate-400 block mt-1">
              Engenheiros, Faturistas e Admins
            </span>
          </div>
        </div>

        {/* Card 4: Obras em Execução Física */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/90 space-y-3 relative overflow-hidden group hover:border-amber-500/30 transition-all shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              Obras em Execução
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <HardHat className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {isLoading ? '...' : data?.total_active_projects_global ?? 0}
            </span>
            <span className="text-xs text-slate-400 block mt-1">
              Canteiros ativos no ecossistema
            </span>
          </div>
        </div>
      </div>

      {/* 3. Tabela de Tenants (Empresas Cadastradas) */}
      <div className="rounded-3xl bg-slate-950/80 border border-slate-800/90 shadow-xl overflow-hidden">
        {/* Cabeçalho da Tabela com Busca */}
        <div className="p-5 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-red-400" />
              Empresas Contratantes do SaaS (Tenants)
            </h2>
            <p className="text-xs text-slate-400">
              Cada linha representa um banco de dados logicamente isolado via RLS (Row Level Security).
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por razão, CNPJ ou email..."
              className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-900/80 border border-slate-800 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-red-500/50"
            />
          </div>
        </div>

        {/* Corpo da Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th scope="col" className="px-6 py-3.5">Empresa / CNPJ</th>
                <th scope="col" className="px-6 py-3.5">Localização</th>
                <th scope="col" className="px-6 py-3.5 text-center">Usuários</th>
                <th scope="col" className="px-6 py-3.5 text-center">Obras Ativas</th>
                <th scope="col" className="px-6 py-3.5 text-center">Medições</th>
                <th scope="col" className="px-6 py-3.5">Status</th>
                <th scope="col" className="px-6 py-3.5 text-right">Ação Master</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-red-400 mb-2" />
                    Carregando instâncias do SaaS...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-red-400">
                    <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-400" />
                    Falha ao carregar tenants: {(error as Error)?.message}
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    Nenhuma empresa encontrada com o termo pesquisado.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => {
                  const isTestCompany =
                    tenant.trade_name?.toLowerCase().includes('teste') ||
                    tenant.legal_name.toLowerCase().includes('teste') ||
                    tenant.cnpj === '12345678000199';

                  return (
                    <tr
                      key={tenant.id}
                      className="hover:bg-slate-900/40 transition-colors group"
                    >
                      {/* Empresa / CNPJ */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-white text-sm">
                          {tenant.trade_name || tenant.legal_name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          CNPJ: {tenant.cnpj}
                        </div>
                        {tenant.email && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-500" />
                            <span>{tenant.email}</span>
                          </div>
                        )}
                      </td>

                      {/* Localização */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span>
                            {tenant.address_city || 'São Paulo'} - {tenant.address_state || 'SP'}
                          </span>
                        </div>
                      </td>

                      {/* Usuários */}
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {tenant.stats?.total_users ?? 0}
                        </span>
                      </td>

                      {/* Obras Ativas */}
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {tenant.stats?.total_active_projects ?? 0} / {tenant.stats?.total_projects ?? 0}
                        </span>
                      </td>

                      {/* Medições */}
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {tenant.stats?.total_measurements ?? 0}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Ativo
                        </span>
                      </td>

                      {/* Ação Master (Botão Vermelho de Perigo) */}
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTenantForReset(tenant);
                            setIsResetAlertOpen(true);
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            isTestCompany
                              ? 'text-red-300 bg-red-950/60 hover:bg-red-600 hover:text-white border border-red-500/40 shadow-sm shadow-red-500/10'
                              : 'text-slate-400 hover:text-red-400 hover:bg-red-950/30 border border-slate-800 hover:border-red-500/30'
                          }`}
                          title="Zerar todas as obras, medições e dados financeiros deste tenant"
                        >
                          <Flame className="w-3.5 h-3.5 text-red-400" />
                          <span>Zerar Dados / Reset Ambiente</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. AlertDialog de Confirmação Destrutiva */}
      <AlertDialog open={isResetAlertOpen} onOpenChange={setIsResetAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center mb-2 shadow-lg shadow-red-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <AlertDialogTitle className="text-red-400">
              ⚠️ Ação Destrutiva Irreversível (God Mode)
            </AlertDialogTitle>

            <AlertDialogDescription className="space-y-3 pt-2">
              <p>
                Você está prestes a expurgar <strong>TODOS os dados operacionais</strong> da empresa{' '}
                <span className="text-white font-bold underline">
                  {selectedTenantForReset?.trade_name || selectedTenantForReset?.legal_name}
                </span>{' '}
                (CNPJ: <code className="text-red-300">{selectedTenantForReset?.cnpj}</code>).
              </p>

              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-200 space-y-1.5">
                <span className="font-bold uppercase tracking-wider block text-red-300">
                  O que será excluído permanentemente:
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                  <li>Todas as Obras (Projetos de Engenharia)</li>
                  <li>Todos os Boletins de Medição Físico-Financeira</li>
                  <li>Todos os Lançamentos Financeiros (Contas a Pagar e Receber)</li>
                  <li>Todos os Clientes e Fornecedores vinculados</li>
                  <li>Todos os Orçamentos e composições de BDI</li>
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                <span className="text-emerald-400 font-semibold">✓ Preservados com segurança:</span> O cadastro da
                empresa raiz e os usuários/senhas do Supabase Auth permanecerão intactos.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={resetMutation.isPending}
              onClick={() => {
                setIsResetAlertOpen(false);
                setSelectedTenantForReset(null);
              }}
            >
              Cancelar Operação
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={resetMutation.isPending}
              onClick={() => {
                if (selectedTenantForReset) {
                  resetMutation.mutate(selectedTenantForReset.id);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5"
            >
              {resetMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Expurgando Dados...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Sim, Zerar Todos os Dados Operacionais</span>
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
