import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logout } from '@/app/actions/auth';
import {
  ShieldAlert,
  Crown,
  Building2,
  HardHat,
  LogOut,
  ExternalLink,
  Flame,
  LayoutDashboard,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // 1. Redireciona usuários deslogados
  if (authError || !user) {
    redirect('/login?redirect=/backoffice');
  }

  // 2. Validação rigorosa de SuperAdmin (God Mode)
  const isSuperAdminMeta =
    user.app_metadata?.is_superadmin === true ||
    user.user_metadata?.is_superadmin === true ||
    user.app_metadata?.role === 'superadmin';

  let isSuperAdminDb = false;
  const { data: dbUser } = await supabase
    .from('users')
    .select('is_superadmin, role')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (dbUser?.is_superadmin === true || dbUser?.role === 'superadmin') {
    isSuperAdminDb = true;
  }

  // Se não for SuperAdmin, bloqueia e redireciona para o dashboard padrão
  if (!isSuperAdminMeta && !isSuperAdminDb) {
    redirect('/dashboard/obras');
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-red-500/30 selection:text-red-200">
      {/* Header God Mode com Estética Black & Crimson Ultra-Premium */}
      <header className="border-b border-red-950/60 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo do Backoffice MASTER */}
            <div className="flex items-center gap-4">
              <Link href="/backoffice" className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-red-600/30 group-hover:scale-105 transition-transform">
                  <Crown className="w-4 h-4 text-white stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold text-white tracking-tight">
                      GADAP <span className="text-red-400">Master</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                      God Mode
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block -mt-0.5 font-medium">
                    SaaS Owner Control Tower
                  </span>
                </div>
              </Link>
            </div>

            {/* Ações Rápidas & Usuário MASTER */}
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/obras"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all"
                title="Acessar visão de canteiro do cliente"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
                <span>Dashboard de Obras</span>
                <ExternalLink className="w-3 h-3 text-slate-500" />
              </Link>

              <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-300 font-medium truncate max-w-[200px]">
                  {user.email}
                </span>
              </div>

              <form action={logout}>
                <button
                  type="submit"
                  title="Encerrar sessão Master"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-800 hover:border-red-500/30 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {children}
      </main>
    </div>
  );
}
