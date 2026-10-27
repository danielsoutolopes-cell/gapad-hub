'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  LayoutDashboard,
  HardHat,
  Calculator,
  ShoppingCart,
  UserCheck,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Landmark,
  FileCheck2,
  FileText,
  Receipt,
  Scale,
  Kanban,
  Users,
  Truck,
  Package,
  Wrench,
  Building,
  History,
  GraduationCap,
  ChevronDown,
  X,
  Crown,
  BookOpen,
} from 'lucide-react';

interface SidebarProps {
  tenantName?: string;
  isSuperAdmin?: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

export function Sidebar({
  tenantName = 'Empresa Teste',
  isSuperAdmin = false,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();

  // Grupos de navegação por categoria (Enterprise ERP Pattern)
  const navGroups: NavGroup[] = [
    {
      id: 'engenharia',
      label: 'Engenharia',
      icon: HardHat,
      items: [
        { label: 'Obras & Canteiros', href: '/dashboard/obras', icon: HardHat },
        { label: 'Orçamentos & BDI', href: '/dashboard/orcamentos', icon: Calculator },
        { label: 'Suprimentos & Compras', href: '/dashboard/suprimentos', icon: ShoppingCart },
        { label: 'RH & Canteiro', href: '/dashboard/rh', icon: UserCheck },
      ],
    },
    {
      id: 'financeiro',
      label: 'Financeiro',
      icon: CreditCard,
      items: [
        { label: 'Contas a Pagar', href: '/dashboard/financeiro/pagar', icon: ArrowDownRight },
        { label: 'Contas a Receber', href: '/dashboard/financeiro/receber', icon: ArrowUpRight },
        { label: 'Conciliação Bancária', href: '/dashboard/financeiro/pagar', icon: Landmark },
      ],
    },
    {
      id: 'fiscal',
      label: 'Fiscal',
      icon: Receipt,
      items: [
        { label: 'Painel de Notas', href: '/dashboard/fiscal', icon: FileCheck2 },
        { label: 'Emitir NFS-e (Serviço)', href: '/dashboard/fiscal/emitir-nfse', icon: FileText },
        { label: 'Emitir NF-e (Material)', href: '/dashboard/fiscal/emitir-nfe', icon: Receipt },
        { label: 'Simulador IVA Dual', href: '/dashboard/fiscal/simulador-reforma', icon: Scale },
      ],
    },
    {
      id: 'relacionamento',
      label: 'Relacionamento',
      icon: Kanban,
      items: [
        { label: 'CRM & Pós-Obra', href: '/dashboard/crm', icon: Kanban },
      ],
    },
    {
      id: 'cadastros',
      label: 'Cadastros Base',
      icon: Package,
      items: [
        { label: 'Clientes', href: '/dashboard/clientes', icon: Users },
        { label: 'Fornecedores', href: '/dashboard/fornecedores', icon: Truck },
        { label: 'Produtos / Insumos', href: '/dashboard/produtos', icon: Package },
        { label: 'Serviços & Frentes', href: '/dashboard/servicos', icon: Wrench },
      ],
    },
    {
      id: 'configuracoes',
      label: 'Configurações',
      icon: Building,
      items: [
        { label: 'Equipe & RBAC', href: '/dashboard/configuracoes/equipe', icon: Users },
        { label: 'Auditoria & Logs', href: '/dashboard/configuracoes/auditoria', icon: History },
        { label: 'GADAP Academy', href: '/dashboard/academy', icon: GraduationCap },
        { label: 'Guia de 1ª Utilização', href: '/dashboard/ajuda/guia-rapido', icon: BookOpen },
      ],
    },
  ];

  // Identifica automaticamente grupos abertos com base na rota atual
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    engenharia: true,
    financeiro: pathname.includes('/financeiro'),
    fiscal: pathname.includes('/fiscal'),
    relacionamento: pathname.includes('/crm'),
    cadastros: ['/clientes', '/fornecedores', '/produtos', '/servicos'].some((path) =>
      pathname.includes(path)
    ),
    configuracoes: ['/configuracoes', '/academy', '/ajuda'].some((path) =>
      pathname.includes(path)
    ),
  });

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const isLinkActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {/* Overlay Escuro para Mobile */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm md:hidden animate-fade-in"
        />
      )}

      {/* Container Principal da Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-[#070b13] border-r border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header da Sidebar (Logo & Empresa) */}
        <div className="h-16 px-4 border-b border-slate-800/80 flex items-center justify-between flex-shrink-0 bg-slate-950/40">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Building2 className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold text-white tracking-tight flex items-center gap-1">
                GADAP <span className="text-emerald-400 font-semibold">Hub</span>
              </span>
              <span className="text-[10px] text-slate-400 block -mt-0.5 font-medium truncate max-w-[140px]">
                {tenantName}
              </span>
            </div>
          </Link>

          {/* Botão Fechar no Mobile */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Links de Navegação com Scroll Vertical Independente */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 text-xs no-scrollbar">
          {/* Categoria: Visão Geral */}
          <div>
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Visão Geral
            </div>
            <Link
              href="/dashboard"
              onClick={onCloseMobile}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl font-semibold transition-all ${
                pathname === '/dashboard'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900/80'
              }`}
            >
              <LayoutDashboard
                className={`w-4 h-4 ${pathname === '/dashboard' ? 'text-emerald-400' : 'text-slate-400'}`}
              />
              <span>Executivo</span>
            </Link>
          </div>

          {/* Categorias Expansíveis (Accordions) */}
          {navGroups.map((group) => {
            const GroupIcon = group.icon;
            const isOpen = !!openGroups[group.id];
            const hasActiveChild = group.items.some((item) => isLinkActive(item.href));

            return (
              <div key={group.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                    hasActiveChild
                      ? 'text-emerald-400 bg-emerald-500/5'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <GroupIcon className={`w-4 h-4 ${hasActiveChild ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span>{group.label}</span>
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-slate-300' : 'text-slate-500'
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="pl-6 pr-1 py-1 space-y-0.5 border-l border-slate-800/80 ml-4 animate-fade-in">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const active = isLinkActive(item.href);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onCloseMobile}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                            active
                              ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                          }`}
                        >
                          <ItemIcon className={`w-3.5 h-3.5 ${active ? 'text-emerald-400' : 'text-slate-500'}`} />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Rodapé da Sidebar */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 space-y-2">
          {isSuperAdmin && (
            <Link
              href="/backoffice"
              className="flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all"
            >
              <span className="flex items-center gap-2">
                <Crown className="w-3.5 h-3.5" />
                <span>God Mode</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/20 uppercase font-mono">Master</span>
            </Link>
          )}

          <div className="text-[10px] text-slate-500 text-center font-medium">
            GADAP Hub &bull; Enterprise v2.4
          </div>
        </div>
      </aside>
    </>
  );
}
