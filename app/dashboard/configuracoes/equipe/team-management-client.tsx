'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  Phone,
  HardHat,
  Scale,
  DollarSign,
  Briefcase,
  KeyRound,
  X,
} from 'lucide-react';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export function TeamManagementClient() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('engenheiro');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Busca lista de membros do tenant
  const { data, isLoading } = useQuery<{ items: TeamMember[] }>({
    queryKey: ['team_members'],
    queryFn: async () => {
      const res = await fetch('/api/v1/team');
      if (!res.ok) throw new Error('Falha ao consultar equipe');
      return res.json();
    },
  });

  // Mutação para convidar/adicionar membro
  const addMemberMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, email, phone, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.title || 'Falha ao convidar membro');
      return data;
    },
    onSuccess: () => {
      setIsModalOpen(false);
      setFullName('');
      setEmail('');
      setPhone('');
      setRole('engenheiro');
      setActionMessage({ type: 'success', text: 'Membro convidado e credenciado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['team_members'] });
    },
    onError: (err: any) => {
      setActionMessage({ type: 'error', text: err.message || 'Erro ao convidar membro' });
    },
  });

  // Mutação para revogar acesso
  const revokeMemberMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/team/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao revogar acesso');
      return res.json();
    },
    onSuccess: () => {
      setActionMessage({ type: 'success', text: 'Acesso revogado com sucesso.' });
      queryClient.invalidateQueries({ queryKey: ['team_members'] });
    },
    onError: (err: any) => {
      setActionMessage({ type: 'error', text: err.message || 'Erro ao revogar acesso' });
    },
  });

  // Se a lista estiver vazia, exibe mock ilustrativo do PROMPT 62
  const members = data?.items && data.items.length > 0 ? data.items : [
    {
      id: 'demo-1',
      full_name: 'Eng. Carlos Silva',
      email: 'carlos@gadap.com.br',
      phone: '(11) 98765-4321',
      role: 'engenheiro',
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'demo-2',
      full_name: 'Dra. Beatriz Santos',
      email: 'beatriz.financeiro@gadap.com.br',
      phone: '(11) 97654-3210',
      role: 'financeiro',
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'demo-3',
      full_name: 'Marcos Oliveira',
      email: 'marcos.fiscal@gadap.com.br',
      phone: '(11) 96543-2109',
      role: 'fiscal',
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ];

  const getRoleBadge = (roleName: string) => {
    switch (roleName) {
      case 'admin':
      case 'diretor':
        return {
          label: 'Administrador / Diretor',
          bg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
          icon: KeyRound,
        };
      case 'engenheiro':
      case 'engenheiro_campo':
      case 'Engenheiro_Campo':
        return {
          label: 'Engenheiro de Campo',
          bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          icon: HardHat,
        };
      case 'financeiro':
        return {
          label: 'Financeiro',
          bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          icon: DollarSign,
        };
      case 'fiscal':
        return {
          label: 'Fiscal & Tributário',
          bg: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
          icon: Scale,
        };
      default:
        return {
          label: roleName,
          bg: 'bg-slate-700/40 text-slate-300 border-slate-600',
          icon: Briefcase,
        };
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              Controle de Acesso & RBAC
            </span>
            <span className="text-xs text-slate-400">• Multi-tenant Hermético</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-indigo-400" />
            Gestão da Equipe & Permissões (RBAC)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Gerencie os colaboradores da construtora, atribua papéis operacionais (Engenharia, Financeiro, Fiscal) e garanta que cada membro acesse exclusivamente o que precisa.
          </p>
        </div>

        {/* BOTÃO CONVIDAR MEMBRO */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/25 border border-indigo-400/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Convidar Membro</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK DE AÇÃO */}
      {actionMessage && (
        <div
          className={`rounded-xl p-3.5 flex items-center justify-between text-xs border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <span className="flex items-center gap-2 font-medium">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            {actionMessage.text}
          </span>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* TABELA DE MEMBROS E PERMISSÕES */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="p-4">Nome do Colaborador</th>
                <th className="p-4">E-mail de Acesso</th>
                <th className="p-4">Telefone</th>
                <th className="p-4">Perfil de Acesso (RBAC)</th>
                <th className="p-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-400 mb-2" />
                    Carregando equipe do tenant...
                  </td>
                </tr>
              ) : (
                members.map((m) => {
                  const roleBadge = getRoleBadge(m.role);
                  const Icon = roleBadge.icon;
                  return (
                    <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-bold text-white flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
                          {m.full_name.charAt(0)}
                        </div>
                        <div>
                          <span>{m.full_name}</span>
                          <span className="block text-[10px] text-slate-500 font-normal">
                            Criado em {new Date(m.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </td>

                      <td className="p-4 text-slate-300 font-mono text-[11px]">
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          {m.email}
                        </span>
                      </td>

                      <td className="p-4 text-slate-400 text-xs">
                        {m.phone || '—'}
                      </td>

                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg border ${roleBadge.bg}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {roleBadge.label}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Tem certeza que deseja revogar o acesso de ${m.full_name}?`)) {
                              revokeMemberMutation.mutate(m.id);
                            }
                          }}
                          disabled={revokeMemberMutation.isPending}
                          className="text-xs text-rose-400 hover:text-rose-300 font-semibold hover:underline inline-flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Revogar Acesso</span>
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

      {/* MODAL CONVIDAR MEMBRO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                Convidar Membro para a Equipe
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Nome Completo *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Eng. Ricardo Albuquerque"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">E-mail Corporativo *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ricardo@construtora.com.br"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 98888-7777"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Perfil de Acesso (RBAC) *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="engenheiro">Engenheiro de Campo (Obras & Medições)</option>
                  <option value="financeiro">Financeiro (Contas a Pagar, Receber e DFe)</option>
                  <option value="fiscal">Fiscal (Emissão de NFS-e, NF-e e Simulação)</option>
                  <option value="diretor">Diretoria / Gestão Geral</option>
                  <option value="admin">Administrador do Tenant</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => addMemberMutation.mutate()}
                disabled={addMemberMutation.isPending || !fullName || !email}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {addMemberMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Convidando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Convidar e Conceder Acesso</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
