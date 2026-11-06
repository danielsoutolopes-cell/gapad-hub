import React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import {
  Building2,
  TrendingUp,
  Image as ImageIcon,
  FileCheck,
  ShieldCheck,
  LogOut,
  Phone,
  HardHat,
  Sparkles,
} from 'lucide-react';
import { PaywallBlocker } from '@/components/ui/paywall-blocker';

export const dynamic = 'force-dynamic';

export default async function PortalClienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // Em modo de visualização livre de desenvolvimento ou usuário logado
  const tenantId = user?.app_metadata?.tenant_id || user?.user_metadata?.tenant_id;
  let tenantName = 'Construtora Lorena Engenharia';
  let logoUrl = '';
  let activeModules: string[] = ['CORE', 'PORTAL_CLIENTE'];

  if (tenantId) {
    const { data: company } = await supabase
      .from('companies')
      .select('trade_name, logo_url, active_modules')
      .eq('id', tenantId)
      .maybeSingle();

    if (company?.trade_name) tenantName = company.trade_name;
    if (company?.logo_url) logoUrl = company.logo_url;
    if (company?.active_modules) activeModules = company.active_modules;
  }

  // Validação do Bloqueio Premium (PORTAL_CLIENTE - Prompt 68 / 93)
  if (!activeModules.includes('PORTAL_CLIENTE')) {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-xl w-full">
          <PaywallBlocker
            moduleName="Portal do Cliente (Transparência & Assinaturas)"
            description="Ambiente White-Label exclusivo e imutável para seus clientes acompanharem a Curva S física e financeira, galeria diária de fotos da obra e assinarem aditivos via Gov.br."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30">
      {/* NAVBAR SUPERIOR MINIMALISTA WHITE-LABEL */}
      <header className="sticky top-0 z-40 bg-[#07090e]/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={tenantName} className="h-8 max-w-[140px] object-contain rounded" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black text-sm shadow-md shadow-amber-500/20">
              L
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-sm tracking-tight">{tenantName}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Portal de Transparência
              </span>
            </div>
            <span className="text-[11px] text-slate-400 block">
              Área Exclusiva do Proprietário • Visualização Imutável
            </span>
          </div>
        </div>

        {/* CONTROLES E CANAL DIRETO */}
        <div className="flex items-center gap-3 text-xs">
          <div className="hidden md:flex items-center gap-2 text-slate-400 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Assinaturas Jurídicas Gov.br ICP-Brasil</span>
          </div>

          <a
            href="https://wa.me/5511999990000"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Falar com o Engenheiro</span>
          </a>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL ISOLADO */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {children}
      </main>

      {/* RODAPÉ INSTITUCIONAL DISCRETO */}
      <footer className="border-t border-slate-800/80 py-6 px-4 text-center text-xs text-slate-500">
        <p>
          © {new Date().getFullYear()} {tenantName} • Painel de Acompanhamento Seguro e Transparência de Obras.
        </p>
        <p className="text-[11px] text-slate-600 mt-1">
          Garantia de integridade técnica conforme normas ABNT NBR 12.721 e Lei Federal nº 14.063/2020 (Assinatura Eletrônica).
        </p>
      </footer>
    </div>
  );
}

