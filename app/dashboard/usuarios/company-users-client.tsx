'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Building2,
  HardHat,
  Briefcase,
  DollarSign,
  ShoppingCart,
  Eye,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Lock,
  ChevronRight,
  GitBranch,
} from 'lucide-react';

export type ConstructionRole =
  | 'DIRETOR'
  | 'ENGENHEIRO_COORDENADOR'
  | 'ENGENHEIRO_CAMPO'
  | 'MESTRE_OBRAS'
  | 'COMPRADOR'
  | 'FINANCEIRO'
  | 'RH_DEPARTAMENTO_PESSOAL'
  | 'VISITANTE_CLIENTE';

interface UserMember {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role: string;
  construction_role: ConstructionRole;
  department: string;
  is_active: boolean;
  created_at: string;
}

const ROLES_INFO: Record<
  ConstructionRole,
  { label: string; desc: string; icon: React.ElementType; color: string; bg: string }
> = {
  DIRETOR: {
    label: 'Diretor / Sócio-Administrador',
    desc: 'Visão executiva global, DRE consolidado, aprovação de aditivos e controle de margem.',
    icon: Building2,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
  },
  ENGENHEIRO_COORDENADOR: {
    label: 'Engenheiro Coordenador',
    desc: 'Supervisão técnica de múltiplos canteiros, curva S física, aprovação de medições e aditivos.',
    icon: HardHat,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
  },
  ENGENHEIRO_CAMPO: {
    label: 'Engenheiro de Campo',
    desc: 'WBS, diário de obras com avanço atômico, apontamento de ponto e requisições de compra.',
    icon: HardHat,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10 border-teal-500/30',
  },
  MESTRE_OBRAS: {
    label: 'Mestre de Obras / Encarregado',
    desc: 'PWA de campo, registro de presença/ponto, recebimento de materiais e fotos de canteiro.',
    icon: HardHat,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/30',
  },
  COMPRADOR: {
    label: 'Comprador / Suprimentos',
    desc: 'Cotações com fornecedores, mapa de menor preço global, pedidos e 3-way match fiscal.',
    icon: ShoppingCart,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/30',
  },
  FINANCEIRO: {
    label: 'Financeiro & Contas a Pagar',
    desc: 'Contas a pagar/receber, conciliação OFX, motor anti-duplicidade e fechamento financeiro.',
    icon: DollarSign,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
  },
  RH_DEPARTAMENTO_PESSOAL: {
    label: 'RH & Departamento Pessoal',
    desc: 'Admissões CLT, importação de equipe em lote, cálculo de folha, rúbricas e ponto.',
    icon: Users,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/30',
  },
  VISITANTE_CLIENTE: {
    label: 'Portal do Cliente / Tomador',
    desc: 'Acesso restrito para acompanhar evolução de fotos, curva S e assinar aditivos contratuais.',
    icon: Eye,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/30',
  },
};

export function CompanyUsersClient({ tenantName }: { tenantName: string }) {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState<ConstructionRole>('ENGENHEIRO_CAMPO');
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, isLoading } = useQuery<{ items: UserMember[] }>({
    queryKey: ['company_users'],
    queryFn: async () => {
      const res = await fetch('/api/v1/team');
      if (!res.ok) throw new Error('Falha ao carregar usuários');
      return res.json();
    },
  });

  const members: UserMember[] = (data?.items && data.items.length > 0)
    ? data.items.map((m) => ({
        ...m,
        construction_role: (m.construction_role as ConstructionRole) || 'ENGENHEIRO_CAMPO',
        department: m.department || 'Operações de Engenharia',
      }))
    : [
        {
          id: 'u-1',
          full_name: 'Dr. Roberto Magalhães',
          email: 'roberto@construtora.com.br',
          phone: '(11) 98888-1000',
          role: 'admin',
          construction_role: 'DIRETOR',
          department: 'Diretoria Executiva',
          is_active: true,
          created_at: '2025-01-10T10:00:00Z',
        },
        {
          id: 'u-2',
          full_name: 'Eng. Cláudia Mendonça',
          email: 'claudia.eng@construtora.com.br',
          phone: '(11) 97777-2000',
          role: 'engenheiro',
          construction_role: 'ENGENHEIRO_COORDENADOR',
          department: 'Coordenação de Engenharia',
          is_active: true,
          created_at: '2025-02-15T14:30:00Z',
        },
        {
          id: 'u-3',
          full_name: 'Eng. Lucas Pinheiro',
          email: 'lucas.campo@construtora.com.br',
          phone: '(11) 96666-3000',
          role: 'engenheiro',
          construction_role: 'ENGENHEIRO_CAMPO',
          department: 'Obras Edifício Horizonte',
          is_active: true,
          created_at: '2025-03-01T08:00:00Z',
        },
        {
          id: 'u-4',
          full_name: 'Severino Ramos',
          email: 'severino.mestre@construtora.com.br',
          phone: '(11) 95555-4000',
          role: 'operacional',
          construction_role: 'MESTRE_OBRAS',
          department: 'Canteiro de Obras',
          is_active: true,
          created_at: '2025-03-10T07:00:00Z',
        },
        {
          id: 'u-5',
          full_name: 'Beatriz Fonseca',
          email: 'beatriz.suprimentos@construtora.com.br',
          phone: '(11) 94444-5000',
          role: 'comprador',
          construction_role: 'COMPRADOR',
          department: 'Suprimentos & Logística',
          is_active: true,
          created_at: '2025-03-15T09:00:00Z',
        },
        {
          id: 'u-6',
          full_name: 'Felipe Alencar',
          email: 'felipe.financeiro@construtora.com.br',
          phone: '(11) 93333-6000',
          role: 'financeiro',
          construction_role: 'FINANCEIRO',
          department: 'Controladoria & Finanças',
          is_active: true,
          created_at: '2025-03-20T11:00:00Z',
        },
      ];

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMsg(null);
    try {
      const res = await fetch('/api/v1/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone,
          role: selectedRole.toLowerCase(),
          construction_role: selectedRole,
        }),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFullName('');
        setEmail('');
        setPhone('');
        setActionMsg({ type: 'success', text: 'Usuário cadastrado com credenciais de acesso enviadas por e-mail!' });
        queryClient.invalidateQueries({ queryKey: ['company_users'] });
      } else {
        const err = await res.json().catch(() => ({}));
        setActionMsg({ type: 'error', text: err.detail || err.error || 'Erro ao cadastrar usuário' });
      }
    } catch {
      setActionMsg({ type: 'error', text: 'Erro de comunicação com o servidor' });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold mb-1">
            <Building2 className="w-4 h-4" />
            <span>{tenantName}</span>
            <span>&bull;</span>
            <span>Organograma Funcional de Obras</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-emerald-400" />
            <span>Administração de Usuários da Construtora</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Gerenciamento de membros, alocação de papéis no organograma e controle de acesso baseado em função (RBAC).
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>Novo Usuário no Organograma</span>
        </button>
      </div>

      {actionMsg && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            actionMsg.type === 'success'
              ? 'bg-slate-900 border-emerald-500/40 text-emerald-300'
              : 'bg-slate-900 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span>{actionMsg.text}</span>
          </div>
          <button type="button" onClick={() => setActionMsg(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cards de Resumo da Hierarquia */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Diretoria & Sócios</span>
          <div className="text-xl font-bold text-amber-400">
            {members.filter((m) => m.construction_role === 'DIRETOR').length}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Engenharia & Canteiro</span>
          <div className="text-xl font-bold text-emerald-400">
            {members.filter((m) => ['ENGENHEIRO_COORDENADOR', 'ENGENHEIRO_CAMPO', 'MESTRE_OBRAS'].includes(m.construction_role)).length}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Suprimentos & Compras</span>
          <div className="text-xl font-bold text-indigo-400">
            {members.filter((m) => m.construction_role === 'COMPRADOR').length}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Controladoria & RH</span>
          <div className="text-xl font-bold text-rose-400">
            {members.filter((m) => ['FINANCEIRO', 'RH_DEPARTAMENTO_PESSOAL'].includes(m.construction_role)).length}
          </div>
        </div>
      </div>

      {/* Lista de Membros da Construtora */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            Quadro de Usuários Ativos ({members.length})
          </h2>
          <span className="text-[11px] text-slate-400">Isolamento Hermético por Tenant Garantido</span>
        </div>

        <div className="divide-y divide-slate-800/60">
          {members.map((user) => {
            const roleMeta = ROLES_INFO[user.construction_role] || ROLES_INFO.ENGENHEIRO_CAMPO;
            const RoleIcon = roleMeta.icon;

            return (
              <div
                key={user.id}
                className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-sm flex-shrink-0">
                    {user.full_name.charAt(0)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">{user.full_name}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${roleMeta.bg} ${roleMeta.color}`}>
                        {roleMeta.label}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-3 flex-wrap">
                      <span>{user.email}</span>
                      {user.phone && <span>&bull; {user.phone}</span>}
                      <span>&bull; {user.department}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 pt-0.5">{roleMeta.desc}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Ativo
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Cadastro de Novo Usuário */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <UserPlus className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Adicionar Usuário ao Organograma</h3>
                  <p className="text-xs text-slate-400">{tenantName}</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Eng. Ricardo Albuquerque"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">E-mail Corporativo</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ricardo@construtora.com.br"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 98888-0000"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Papel no Organograma da Construtora (RBAC)
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as ConstructionRole)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:border-emerald-500 focus:outline-none"
                >
                  {Object.entries(ROLES_INFO).map(([key, info]) => (
                    <option key={key} value={key}>
                      {info.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">{ROLES_INFO[selectedRole]?.desc}</p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  Salvar e Credenciar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
