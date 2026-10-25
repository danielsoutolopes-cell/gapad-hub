'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  HardHat,
  Calculator,
  Users,
  Truck,
  Package,
  Wrench,
  LogOut,
  ShieldCheck,
  BookOpen,
  GraduationCap,
  Crown,
  Sparkles,
} from 'lucide-react';
import { logout } from '@/app/actions/auth';

interface DashboardNavProps {
  tenantName?: string;
  isSuperAdmin?: boolean;
}

export function DashboardNav({ tenantName = 'Empresa Teste', isSuperAdmin = false }: DashboardNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/dashboard/obras',
      label: 'Obras',
      icon: HardHat,
    },
    {
      href: '/dashboard/orcamentos',
      label: 'Orçamentos',
      icon: Calculator,
    },
    {
      href: '/dashboard/clientes',
      label: 'Clientes',
      icon: Users,
    },
    {
      href: '/dashboard/fornecedores',
      label: 'Fornecedores',
      icon: Truck,
    },
    {
      href: '/dashboard/produtos',
      label: 'Produtos / Insumos',
      icon: Package,
    },
    {
      href: '/dashboard/servicos',
      label: 'Serviços',
      icon: Wrench,
    },
    {
      href: '/dashboard/inteligencia',
      label: 'Tax Intelligence',
      icon: Sparkles,
    },
    {
      href: '/dashboard/academy',
      label: 'Academy',
      icon: GraduationCap,
    },
  ];

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo e Nome da Empresa */}
          <div className="flex items-center gap-6">
            <Link href="/dashboard/obras" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <Building2 className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                  GADAP <span className="text-emerald-400 font-semibold">Hub</span>
                </span>
                <span className="text-[10px] text-slate-400 block -mt-1 font-medium truncate max-w-[140px] sm:max-w-none">
                  {tenantName}
                </span>
              </div>
            </Link>

            {/* Abas de Navegação Desktop */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Lado Direito: Badge RLS, Guia Rápido e Botão Sair */}
          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <Link
                href="/backoffice"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all hover:scale-[1.02]"
                title="Painel Master • God Mode"
              >
                <Crown className="w-3.5 h-3.5 text-red-400" />
                <span className="hidden sm:inline">God Mode</span>
              </Link>
            )}

            <Link
              href="/dashboard/academy"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 transition-all hover:scale-[1.02]"
              title="Academy - Curso Prático"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Academy</span>
            </Link>

            <Link
              href="/dashboard/ajuda/guia-rapido"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all hover:scale-[1.02]"
              title="Guia Rápido de 1ª Utilização"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Guia Rápido</span>
            </Link>

            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>RLS Hermético Ativo</span>
            </div>

            <form action={logout}>
              <button
                type="submit"
                title="Sair do sistema"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-800 hover:border-red-500/30 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </form>
          </div>
        </div>

        {/* Abas de Navegação Mobile (rolagem horizontal) */}
        <div className="md:hidden flex items-center gap-2 py-2.5 overflow-x-auto border-t border-slate-900 no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
