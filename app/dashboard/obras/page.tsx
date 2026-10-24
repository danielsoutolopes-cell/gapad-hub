import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  HardHat,
  Plus,
  Search,
  Filter,
  DollarSign,
  Calendar,
  AlertCircle,
  FileCheck2,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  ArrowLeft
} from 'lucide-react';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';

interface Project {
  id: string;
  tenant_id: string;
  client_id?: string;
  code?: string | null;
  name: string;
  description?: string | null;
  cno?: string | null;
  art_rrt?: string | null;
  contract_value: number;
  technical_retention_perc: number;
  status: 'planejamento' | 'em_andamento' | 'paralisada' | 'concluida' | 'cancelada';
  start_date?: string | null;
  expected_end_date?: string | null;
  created_at: string;
  clients?: {
    name: string;
    document: string;
  } | null;
}

export const dynamic = 'force-dynamic';

export default async function ObrasPage() {
  const cookieStore = cookies();

  // 1. Leitura dos cookies de autenticação usando @supabase/ssr
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Em Server Component a mutação de cookies é segura/no-op
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Em Server Component a mutação de cookies é segura/no-op
          }
        },
      },
    }
  );

  // Verificação de autenticação
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // 5. Se o usuário não estiver logado, redireciona para /login
  if (authError || !user) {
    redirect('/login');
  }

  // 2. Extração do tenant_id do usuário logado
  const tenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id || 'Não Vinculado';

  // 3. Consulta ao banco de dados com cliente autenticado (RLS compulsório ativo no PostgreSQL)
  const { data: rawProjects, error: queryError } = await supabase
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
      expected_end_date,
      created_at
    `)
    .order('created_at', { ascending: false });

  const projects = (rawProjects as Project[]) || [];

  // Métricas Consolidadas
  const totalProjects = projects.length;
  const totalContractValue = projects.reduce(
    (acc, curr) => acc + Number(curr.contract_value || 0),
    0
  );
  const activeProjectsCount = projects.filter(
    (p) => p.status === 'em_andamento'
  ).length;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Não informada';
    return new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  const getStatusBadge = (status: Project['status']) => {
    switch (status) {
      case 'em_andamento':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Em Andamento
          </span>
        );
      case 'planejamento':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Planejamento
          </span>
        );
      case 'concluida':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
            Concluída
          </span>
        );
      case 'paralisada':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Paralisada
          </span>
        );
      case 'cancelada':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            Cancelada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      <DashboardNav />

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        
        {/* Cabeçalho de Título & Ações Rápidas */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <span>Gestão de Obras</span>
              <ChevronRight className="w-3 h-3 text-slate-600" />
              <span className="text-emerald-400 font-medium">Contratos Civis</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Obras & Projetos
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Painel operacional e financeiro de obras protegidas por Row-Level Security.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all duration-200"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Cadastrar Nova Obra
            </button>
          </div>
        </div>

        {/* Alerta de Erro de Consulta (se houver) */}
        {queryError && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs sm:text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
            <div>
              <p className="font-semibold">Erro ao consultar projetos no PostgreSQL:</p>
              <p className="text-red-300/80 font-mono text-xs mt-1">{queryError.message}</p>
            </div>
          </div>
        )}

        {/* Cards de Métricas de Engenharia */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Total de Obras Cadastradas</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-white mt-3">
              {totalProjects}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Isolamento hermético multi-tenant ativo
            </span>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Valor Total Contratado</span>
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-3">
              {formatCurrency(totalContractValue)}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Soma de todos os contratos da carteira
            </span>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Obras em Execução Ativa</span>
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-white mt-3">
              {activeProjectsCount}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Aptas para emissão de medições parciais
            </span>
          </div>
        </div>

        {/* 4. Tabela Estilizada com Tailwind CSS */}
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
          {/* Barra de Filtros e Busca */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome da obra ou CNO..."
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
              >
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                Filtrar Status
              </button>
            </div>
          </div>

          {/* Renderização da Tabela */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  <th scope="col" className="py-3.5 px-4 sm:px-6">Nome da Obra & Registro</th>
                  <th scope="col" className="py-3.5 px-4 sm:px-6">Status Operacional</th>
                  <th scope="col" className="py-3.5 px-4 sm:px-6 text-right">Valor do Contrato</th>
                  <th scope="col" className="py-3.5 px-4 sm:px-6 text-center">Retenção Técnica</th>
                  <th scope="col" className="py-3.5 px-4 sm:px-6">Previsão de Término</th>
                  <th scope="col" className="py-3.5 px-4 sm:px-6 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs sm:text-sm text-slate-300">
                {projects.length > 0 ? (
                  projects.map((project) => (
                    <tr
                      key={project.id}
                      className="hover:bg-slate-800/30 transition-colors duration-150"
                    >
                      {/* Nome da Obra + CNO */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white text-sm">
                            {project.name}
                          </span>
                          <div className="flex items-center gap-2 text-slate-400 text-xs mt-0.5">
                            {project.code && (
                              <span className="font-mono text-emerald-400/90 font-medium">
                                [{project.code}]
                              </span>
                            )}
                            {project.cno ? (
                              <span>CNO: {project.cno}</span>
                            ) : (
                              <span className="text-slate-600">Sem CNO</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 sm:px-6">
                        {getStatusBadge(project.status)}
                      </td>

                      {/* Valor do Contrato */}
                      <td className="py-4 px-4 sm:px-6 text-right font-mono font-bold text-white">
                        {formatCurrency(Number(project.contract_value))}
                      </td>

                      {/* Retenção Técnica */}
                      <td className="py-4 px-4 sm:px-6 text-center font-mono text-slate-300">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-xs border border-slate-700">
                          {Number(project.technical_retention_perc || 5).toFixed(1)}%
                        </span>
                      </td>

                      {/* Datas */}
                      <td className="py-4 px-4 sm:px-6 text-slate-400 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>{formatDate(project.expected_end_date)}</span>
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-4 sm:px-6 text-center">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            title="Gerar Medição de Obra"
                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          >
                            <FileCheck2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Notificar Engenheiro via WhatsApp"
                            className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  /* Tratamento de Estado Vazio (Empty State) */
                  <tr>
                    <td colSpan={6} className="py-12 px-4 text-center">
                      <div className="max-w-sm mx-auto flex flex-col items-center justify-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                          <Building2 className="w-6 h-6 stroke-[1.5]" />
                        </div>
                        <h3 className="text-sm font-bold text-white">
                          Nenhuma obra cadastrada
                        </h3>
                        <p className="text-xs text-slate-400">
                          Não foram encontrados projetos para este tenant. O Row-Level Security garante que apenas as obras da sua empresa são exibidas aqui.
                        </p>
                        <button
                          type="button"
                          className="mt-2 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          Cadastrar Primeira Obra
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Rodapé da Tabela */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 text-xs text-slate-500 flex items-center justify-between">
            <span>Exibindo {projects.length} registros</span>
            <span className="font-mono text-[11px] text-slate-600">
              PostgreSQL 16 RLS Filter: public.projects.tenant_id = get_current_tenant()
            </span>
          </div>
        </div>

      </main>
    </div>
  );
}
