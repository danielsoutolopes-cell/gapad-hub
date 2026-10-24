'use client';

import React, { useState } from 'react';
import {
  Building2,
  ShieldCheck,
  Calculator,
  MessageSquare,
  ArrowRight,
  Lock,
  Mail,
  CheckCircle2,
  Sparkles,
  Layers,
  FileSpreadsheet
} from 'lucide-react';

export default function HomePage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFeedbackMessage(null);

    // Simulação visual de envio de autenticação
    setTimeout(() => {
      setIsLoading(false);
      setFeedbackMessage('Credenciais validadas. Redirecionando para o painel de obras...');
    }, 1200);
  };

  return (
    <main className="min-h-screen flex flex-col justify-between">
      {/* Barra de Navegação Superior */}
      <header className="border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Building2 className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                GADAP <span className="text-emerald-400 font-semibold">Hub</span>
              </span>
              <span className="text-[10px] text-slate-400 block -mt-1 tracking-wider uppercase font-medium">
                Gestão & Inteligência Fiscal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              V0 Baseline Operacional
            </span>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal / Grid de Entrada */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Coluna da Esquerda: Proposta de Valor e Pilares */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/60 text-xs font-medium text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Construção Civil & Serviços Técnicos
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
                Ação Operacional é{' '}
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                  Fato Gerador Fiscal.
                </span>
              </h1>
              <p className="text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
                Ecossistema SaaS multi-tenant definitivo para construtoras, empreiteiras e prestadores. Conectamos com rigor orçamentos, medições de campo, retenções técnicas e emissões fiscais em tempo real.
              </p>
            </div>

            {/* Três Pilares Corporativos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="glass-panel p-4 rounded-xl border border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">RLS Hermético</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Isolamento compulsório por empresa no PostgreSQL 16.
                </p>
              </div>

              <div className="glass-panel p-4 rounded-xl border border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center mb-3">
                  <Calculator className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">Medição & Fiscal</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Retenção técnica determinística e conformidade NF-e/NFS-e.
                </p>
              </div>

              <div className="glass-panel p-4 rounded-xl border border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">WhatsApp Nativo</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Notificações e laudos via microserviço Evolution API.
                </p>
              </div>
            </div>

            {/* Destaque de Integração */}
            <div className="flex items-center gap-6 pt-4 text-xs text-slate-500 border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Supabase PostgreSQL 16</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Next.js 14 App Router</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>FastAPI Microservice</span>
              </div>
            </div>
          </div>

          {/* Coluna da Direita: Card de Acesso / Login */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-md glass-panel p-8 rounded-2xl shadow-2xl relative overflow-hidden border border-slate-800/90">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

              <div className="mb-6">
                <h2 className="text-xl font-bold text-white tracking-tight">Portal do Operador</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Acesse sua empresa e controle suas obras e medições.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="email-input">
                    E-mail Corporativo
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="email-input"
                      type="email"
                      required
                      placeholder="engenharia@construtora.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="password-input">
                    Senha de Acesso
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="password-input"
                      type="password"
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" defaultChecked className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0" />
                    Lembrar credencial
                  </label>
                  <a href="#recuperar" className="text-emerald-400 hover:underline">
                    Esqueceu a senha?
                  </a>
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
                      Entrar no Sistema
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </>
                  )}
                </button>

                {feedbackMessage && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs text-center animate-fade-in">
                    {feedbackMessage}
                  </div>
                )}
              </form>

              <div className="mt-6 pt-5 border-t border-slate-800 text-center">
                <span className="text-xs text-slate-500">
                  Primeiro acesso? Contate o Administrador da sua Empresa para obter seu convite.
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Rodapé Corporativo */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 GADAP Hub ERP. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              API: Online (/api/v1/health)
            </span>
            <span>•</span>
            <span>PostgreSQL 16 RLS Ativo</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
