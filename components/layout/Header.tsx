'use client';

import React from 'react';
import Link from 'next/link';
import {
  Menu,
  Search,
  Bell,
  Receipt,
  HardHat,
  LogOut,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';
import { logout } from '@/app/actions/auth';

interface HeaderProps {
  tenantName?: string;
  isSuperAdmin?: boolean;
  onOpenMobileSidebar?: () => void;
}

export function Header({
  onOpenMobileSidebar,
}: HeaderProps) {
  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
      {/* Esquerda: Botão Menu Hambúrguer (Mobile) e Barra de Busca Rápida */}
      <div className="flex items-center gap-3 flex-1 max-w-lg">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition-all duration-200 ease-in-out"
          title="Abrir Menu de Navegação"
          aria-label="Abrir Menu Lateral"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Campo de Busca Rápida Global */}
        <div className="relative w-full hidden sm:block">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar obras, contratos, notas fiscais ou insumos (Ctrl + K)..."
            className="w-full bg-slate-950 text-xs text-slate-200 placeholder-slate-500 rounded-xl pl-9 pr-4 py-2 border border-slate-800 focus:outline-none focus:border-slate-700 transition-all duration-200 ease-in-out"
          />
        </div>
      </div>

      {/* Direita: Ações Rápidas, Notificações, Ajuda e Perfil/Logout */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Botão Ação Rápida: + Nova Obra */}
        <Link
          href="/dashboard/obras"
          className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-800 transition-all duration-200 ease-in-out"
          title="Cadastrar Nova Obra"
        >
          <HardHat className="w-3.5 h-3.5 text-slate-400" />
          <span>+ Nova Obra</span>
        </Link>

        {/* Botão Ação Rápida: + Emitir NF */}
        <Link
          href="/dashboard/fiscal/emitir-nfse"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all duration-200 ease-in-out"
          title="Faturar / Emitir Nova Nota Fiscal"
        >
          <Receipt className="w-3.5 h-3.5 text-slate-300" />
          <span>+ Emitir NF</span>
        </Link>

        {/* Central de Ajuda Rápida */}
        <Link
          href="/dashboard/ajuda"
          className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent hover:border-slate-800 transition-all duration-200 ease-in-out"
          title="Central de Ajuda & FAQ"
        >
          <BookOpen className="w-4 h-4 text-slate-400" />
          <span className="hidden xl:inline">Ajuda</span>
        </Link>

        {/* Notificações / Alertas */}
        <button
          type="button"
          className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-800 transition-all duration-200 ease-in-out"
          title="Notificações do Sistema"
        >
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 rounded-full bg-emerald-400 absolute top-2 right-2" />
        </button>

        {/* Badge RLS Ativo */}
        <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>RLS Ativo</span>
        </div>

        <div className="h-6 w-[1px] bg-slate-800 mx-1 hidden sm:block" />

        {/* Botão Sair (Logout) */}
        <form action={logout}>
          <button
            type="submit"
            title="Sair do sistema (Logout)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:text-rose-300 bg-slate-950 hover:bg-slate-800 border border-slate-800 transition-all duration-200 ease-in-out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </form>
      </div>
    </header>
  );
}
