'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Building2,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { login } from '@/app/actions/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Helper para preenchimento rápido com o usuário do seed
  const handleQuickFill = () => {
    setEmail('admin@teste.com');
    setPassword('Gadap2026!');
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const result = await login(formData);
        if (result?.error) {
          setErrorMessage(result.error);
        }
      } catch (err: any) {
        // Redirecionamentos disparados por redirect() são capturados internamente pelo Next.js
        if (err?.message && !err.message.includes('NEXT_REDIRECT')) {
          setErrorMessage(err.message || 'Erro inesperado ao realizar autenticação.');
        }
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Luzes de fundo dinâmicas */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Card Principal */}
      <div className="w-full max-w-md glass-panel p-8 rounded-2xl border border-slate-800/90 shadow-2xl relative z-10 backdrop-blur-xl">
        {/* Header do Card */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Building2 className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
                <span>GADAP Hub</span>
              </h1>
              <span className="text-[10px] text-slate-400 block -mt-1 tracking-wider uppercase font-medium">
                Autenticação Corporativa
              </span>
            </div>
          </Link>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            V0 Seed Ativo
          </span>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-bold text-white mb-1">Acesso ao Sistema</h2>
          <p className="text-xs text-slate-400">
            Insira suas credenciais corporativas vinculadas ao tenant da sua empresa.
          </p>
        </div>

        {/* Banner de Erro */}
        {errorMessage && (
          <div className="p-3.5 mb-5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-red-400 text-xs animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Formulário com Server Action */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="login-email">
              E-mail Corporativo
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="admin@teste.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-300" htmlFor="login-password">
                Senha de Acesso
              </label>
              <a
                href="#recuperar"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Para redefinir credenciais em ambiente de testes, execute "npm run seed" no terminal.');
                }}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
              >
                Esqueceu a senha?
              </a>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all duration-200 disabled:opacity-60 active:scale-[0.99]"
          >
            {isPending ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                Autenticando sessão...
              </span>
            ) : (
              <>
                Entrar no Sistema
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        {/* Card Auxiliar de Seed de Testes */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <KeyRound className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-white block">Credencial de Teste</span>
                <span className="text-[10px] text-slate-400 font-mono">admin@teste.com</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleQuickFill}
              className="px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:text-white bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-lg transition-colors flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              Preencher
            </button>
          </div>
        </div>

        {/* Rodapé de Segurança */}
        <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 text-center">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Isolamento por tenant_id validado via JWT + RLS</span>
        </div>
      </div>
    </div>
  );
}
