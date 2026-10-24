'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      if (data?.session) {
        // Redireciona diretamente para o painel de obras protegidas
        router.push('/dashboard/obras');
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado ao realizar login.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md glass-panel p-8 rounded-2xl border border-slate-800/90 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Building2 className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
              GADAP <span className="text-emerald-400 font-semibold">Hub</span>
            </h1>
            <span className="text-[10px] text-slate-400 block -mt-1 tracking-wider uppercase font-medium">
              Autenticação Corporativa
            </span>
          </div>
        </div>

        <h2 className="text-xl font-bold text-white mb-1">Acesso ao Sistema</h2>
        <p className="text-xs text-slate-400 mb-6">
          Insira suas credenciais para acessar o painel de obras do seu tenant.
        </p>

        {errorMessage && (
          <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="login-email">
              E-mail
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-email"
                type="email"
                required
                placeholder="operador@construtora.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="login-password">
              Senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-password"
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all duration-200 disabled:opacity-60"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                Autenticando...
              </span>
            ) : (
              <>
                Entrar
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Sessão protegida por JWT e PostgreSQL Row-Level Security</span>
        </div>
      </div>
    </div>
  );
}
