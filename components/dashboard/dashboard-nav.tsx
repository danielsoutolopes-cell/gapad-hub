'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  LayoutDashboard,
  Scale,
  WalletCards,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  Receipt,
  FileCheck2,
  FileText,
  Plus,
} from 'lucide-react';
import { logout } from '@/app/actions/auth';

interface DashboardNavProps {
  tenantName?: string;
  isSuperAdmin?: boolean;
}

export function DashboardNav({ tenantName = 'Empresa Teste', isSuperAdmin = false }: DashboardNavProps) {
  const pathname = usePathname();
  const [financeMenuOpen, setFinanceMenuOpen] = useState(false);
  const [fiscalMenuOpen, setFiscalMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fiscalDropdownRef = useRef<HTMLDivElement>(null);

  // Fecha dropdowns se clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setFinanceMenuOpen(false);
      }
      if (fiscalDropdownRef.current && !fiscalDropdownRef.current.contains(event.target as Node)) {
        setFiscalMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const isFinanceActive = pathname?.startsWith('/dashboard/financeiro');
  const isFiscalActive = pathname?.startsWith('/dashboard/fiscal');

  const mainNavItems = [
    {
      href: '/dashboard',
      label: 'Executivo',
      icon: LayoutDashboard,
    },
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
      href: '/dashboard/fiscal/simulador-reforma',
      label: 'IVA Dual',
      icon: Scale,
    },
    {
      href: '/dashboard/academy',
      label: 'Academy',
      icon: GraduationCap,
    },
  ];

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo e Nome da Empresa */}
          <div className="flex items-center gap-4 xl:gap-5 flex-shrink-0">
            <Link href="/dashboard/obras" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform flex-shrink-0">
                <Building2 className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                  GADAP <span className="text-emerald-400 font-semibold">Hub</span>
                </span>
                <span className="text-[10px] text-slate-400 block -mt-1 font-medium truncate max-w-[120px] sm:max-w-none">
                  {tenantName}
                </span>
              </div>
            </Link>

            {/* Abas de Navegação Desktop */}
            <nav className="hidden xl:flex items-center gap-1">
              {/* Item 1: Executivo */}
              <Link
                href="/dashboard"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  pathname === '/dashboard'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <LayoutDashboard className={`w-3.5 h-3.5 ${pathname === '/dashboard' ? 'text-emerald-400' : 'text-slate-500'}`} />
                Executivo
              </Link>

              {/* CATEGORIA FINANCEIRO EM DESTAQUE COM SUBMENUS */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setFinanceMenuOpen(!financeMenuOpen)}
                  onMouseEnter={() => setFinanceMenuOpen(true)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isFinanceActive
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                      : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20'
                  }`}
                >
                  <WalletCards className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>Financeiro</span>
                  <ChevronDown className={`w-3 h-3 text-emerald-400 transition-transform ${financeMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu Subcategorias */}
                {financeMenuOpen && (
                  <div
                    onMouseLeave={() => setFinanceMenuOpen(false)}
                    className="absolute left-0 mt-1 w-52 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-1.5 z-50 animate-fade-in backdrop-blur-xl"
                  >
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800/80 mb-1">
                      Central Financeira
                    </div>
                    <Link
                      href="/dashboard/financeiro/receber"
                      onClick={() => setFinanceMenuOpen(false)}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/dashboard/financeiro/receber'
                          ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                        <span>Contas a Receber</span>
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                        Entradas
                      </span>
                    </Link>

                    <Link
                      href="/dashboard/financeiro/pagar"
                      onClick={() => setFinanceMenuOpen(false)}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/dashboard/financeiro/pagar'
                          ? 'bg-rose-500/15 text-rose-300 font-bold border border-rose-500/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <ArrowDownRight className="w-4 h-4 text-rose-400" />
                        <span>Contas a Pagar</span>
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold">
                        Saídas
                      </span>
                    </Link>
                  </div>
                )}
              </div>

              {/* CATEGORIA FISCAL EM DESTAQUE COM SUBMENUS */}
              <div className="relative" ref={fiscalDropdownRef}>
                <button
                  type="button"
                  onClick={() => setFiscalMenuOpen(!fiscalMenuOpen)}
                  onMouseEnter={() => setFiscalMenuOpen(true)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isFiscalActive
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/20'
                      : 'text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 border border-purple-500/20'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5 text-purple-400" />
                  <span>Fiscal</span>
                  <ChevronDown className={`w-3 h-3 text-purple-400 transition-transform ${fiscalMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu Subcategorias Fiscais */}
                {fiscalMenuOpen && (
                  <div
                    onMouseLeave={() => setFiscalMenuOpen(false)}
                    className="absolute left-0 mt-1 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-1.5 z-50 animate-fade-in backdrop-blur-xl"
                  >
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800/80 mb-1 flex items-center justify-between">
                      <span>Central Fiscal Hub</span>
                      <span className="text-purple-400 font-mono text-[9px] bg-purple-500/10 px-1 rounded">Backoffice</span>
                    </div>
                    <Link
                      href="/dashboard/fiscal"
                      onClick={() => setFiscalMenuOpen(false)}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/dashboard/fiscal'
                          ? 'bg-purple-500/15 text-purple-300 font-bold border border-purple-500/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <FileCheck2 className="w-4 h-4 text-purple-400" />
                        <span>Painel de Notas</span>
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold">
                        Hub
                      </span>
                    </Link>

                    <Link
                      href="/dashboard/fiscal/emitir-nfse"
                      onClick={() => setFiscalMenuOpen(false)}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/dashboard/fiscal/emitir-nfse'
                          ? 'bg-teal-500/15 text-teal-300 font-bold border border-teal-500/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-teal-400" />
                        <span>Emitir NFS-e (Serviço)</span>
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400 font-bold">
                        Nacional
                      </span>
                    </Link>

                    <Link
                      href="/dashboard/fiscal/emitir-nfe"
                      onClick={() => setFiscalMenuOpen(false)}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/dashboard/fiscal/emitir-nfe'
                          ? 'bg-sky-500/15 text-sky-300 font-bold border border-sky-500/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-sky-400" />
                        <span>Emitir NF-e (Material)</span>
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-bold">
                        Insumos
                      </span>
                    </Link>

                    <div className="border-t border-slate-800/60 my-1 pt-1">
                      <Link
                        href="/dashboard/fiscal/simulador-reforma"
                        onClick={() => setFiscalMenuOpen(false)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          pathname === '/dashboard/fiscal/simulador-reforma'
                            ? 'bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Scale className="w-3.5 h-3.5 text-amber-400" />
                          <span>Simulador Reforma (IVA)</span>
                        </span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Demais Itens */}
              {mainNavItems.slice(1).map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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

          {/* Lado Direito: Atalho Global Faturar / Nova NF, Ações e Botão Sair Sempre Visível */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* BOTÃO ATALHO GLOBAL RÁPIDO: FATURAR / NOVA NF */}
            <Link
              href="/dashboard/fiscal/emitir-nfse"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-600/25 border border-purple-400/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              title="Faturar / Emitir Nova Nota Fiscal de qualquer lugar do sistema"
            >
              <Receipt className="w-3.5 h-3.5 text-purple-200" />
              <span>Nova NF</span>
            </Link>

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
              href="/dashboard/ajuda/guia-rapido"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all hover:scale-[1.02]"
              title="Guia Rápido de 1ª Utilização"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Guia Rápido</span>
            </Link>

            <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>RLS Hermético</span>
            </div>

            <form action={logout}>
              <button
                type="submit"
                title="Sair do sistema (Logout)"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-white bg-red-500/10 hover:bg-red-600/80 border border-red-500/30 transition-all shadow-sm"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair</span>
              </button>
            </form>
          </div>
        </div>

        {/* Abas de Navegação Mobile (rolagem horizontal) */}
        <div className="md:hidden flex items-center gap-2 py-2.5 overflow-x-auto border-t border-slate-900 no-scrollbar">
          {/* Submenus Financeiros destacados no mobile */}
          <Link
            href="/dashboard/financeiro/receber"
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
              pathname === '/dashboard/financeiro/receber'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Contas a Receber
          </Link>
          <Link
            href="/dashboard/financeiro/pagar"
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
              pathname === '/dashboard/financeiro/pagar'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
            }`}
          >
            <ArrowDownRight className="w-3.5 h-3.5" />
            Contas a Pagar
          </Link>

          {/* Submenus Fiscais destacados no mobile */}
          <Link
            href="/dashboard/fiscal"
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
              pathname === '/dashboard/fiscal'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-purple-400 bg-purple-500/10 border border-purple-500/20'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            Painel Fiscal
          </Link>
          <Link
            href="/dashboard/fiscal/emitir-nfse"
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
              pathname === '/dashboard/fiscal/emitir-nfse'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'text-teal-400 bg-teal-500/10 border border-teal-500/20'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Emitir NFS-e
          </Link>
          <Link
            href="/dashboard/fiscal/emitir-nfe"
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
              pathname === '/dashboard/fiscal/emitir-nfe'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-sky-400 bg-sky-500/10 border border-sky-500/20'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            Emitir NF-e
          </Link>

          {mainNavItems.map((item) => {
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
