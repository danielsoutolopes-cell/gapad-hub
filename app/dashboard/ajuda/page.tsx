import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import {
  HelpCircle,
  MessageCircle,
  PhoneCall,
  FileQuestion,
  BookOpen,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  Building2,
  Receipt,
  Layers,
  ArrowRight,
  Calculator,
} from 'lucide-react';
import Link from 'next/link';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

export const dynamic = 'force-dynamic';

export default async function HelpCenterPage() {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login?redirect=/dashboard/ajuda');
  }

  const tenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
  let tenantName = 'Empresa Teste';

  if (tenantId) {
    const { data: company } = await supabase
      .from('companies')
      .select('trade_name')
      .eq('id', tenantId)
      .maybeSingle();
    if (company?.trade_name) {
      tenantName = company.trade_name;
    }
  }

  let isSuperAdmin = false;
  if (user) {
    const { data: dbUser } = await supabase
      .from('users')
      .select('is_superadmin')
      .eq('id', user.id)
      .maybeSingle();
    isSuperAdmin = !!dbUser?.is_superadmin;
  }

  const faqs = [
    {
      id: 'faq-1',
      question: 'Como funciona o Modelo Farol de Subcontratados e a Política Zero Travas?',
      answer:
        'O GADAP Hub não bloqueia pagamentos ou operações em campo. O Modelo Farol correlaciona o total pago com o total medido: Verde (equilibrado), Amarelo (pagamento > medição, mas < 80% do contrato) e Vermelho (pagamento > medição e >= 80% do contrato global). Assim, o gestor tem visibilidade total do risco financeiro sem paralisar o canteiro.',
    },
    {
      id: 'faq-2',
      question: 'Como importar extratos bancários OFX e conciliar títulos D+0?',
      answer:
        'Acesse a Central Financeira em /dashboard/financeiro/pagar ou /dashboard/financeiro/receber. Você pode conectar diretamente via Open Finance (Pluggy) ou arrastar arquivos OFX. O motor de Auto-Match identifica os títulos pelo valor e data de vencimento com 1 clique para conciliação em lote.',
    },
    {
      id: 'faq-3',
      question: 'Como é calculada a alíquota do IVA Dual (CBS + IBS) na Reforma Tributária?',
      answer:
        'No menu "Simulador IVA Dual" (/dashboard/fiscal/simulador-reforma), você simula a transição constitucional 2026-2032. O sistema calcula a desoneração de insumos construtivos e o split-payment automático, informando a carga efetiva líquida da sua construtora.',
    },
    {
      id: 'faq-4',
      question: 'Como assinar contratos e medições eletronicamente via Gov.br?',
      answer:
        'Dentro do detalhe de qualquer subcontrato ou medição, clique em "Assinar com Gov.br". O sistema integra o fluxo de autenticação ICP-Brasil padrão OID do Governo Federal, gerando o PDF com carimbo de tempo e hash SHA-256 infalsificável.',
    },
    {
      id: 'faq-5',
      question: 'O envio de fotos de canteiro consome muito tráfego ou storage?',
      answer:
        'Não! O módulo de Engenharia de Campo aplica compressão inteligente WebP e redimensionamento local antes do upload para o Supabase Storage, reduzindo em até 85% o peso do arquivo sem perder nitidez técnica das vistorias.',
    },
    {
      id: 'faq-6',
      question: 'Como configurar a Logo da Construtora e identidade visual via CNPJ?',
      answer:
        'Em Configurações da Empresa, basta informar seu CNPJ. O robô busca automaticamente os dados na Receita Federal e permite upload do logotipo oficial da empresa, que sairá impresso no cabeçalho de todas as propostas, orçamentos e relatórios de medição.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      <DashboardNav tenantName={tenantName} isSuperAdmin={isSuperAdmin} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8 animate-in fade-in duration-300">
        {/* Banner Central de Ajuda */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800 p-6 sm:p-8 shadow-xl">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              <span>Central de Ajuda & FAQ do GADAP Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Como podemos ajudar a sua obra hoje?
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Consulte as perguntas frequentes operacionais, acesse a documentação prática ou fale diretamente com nossos especialistas em engenharia e tributação.
            </p>
          </div>
        </div>

        {/* Canais de Suporte Rápido */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="https://wa.me/5511999999999?text=Ol%C3%A1%2C+preciso+de+suporte+no+GADAP+Hub"
            target="_blank"
            rel="noopener noreferrer"
            className="group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition-all hover:scale-[1.01] flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Suporte WhatsApp
                </h3>
                <p className="text-xs text-slate-400">Atendimento prioritário para canteiro</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </a>

          <Link
            href="/dashboard/academy"
            className="group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-teal-500/40 transition-all hover:scale-[1.01] flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 group-hover:scale-105 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors">
                  GADAP Academy
                </h3>
                <p className="text-xs text-slate-400">13 módulos práticos de capacitação</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
          </Link>

          <Link
            href="/dashboard/ajuda/guia-rapido"
            className="group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 transition-all hover:scale-[1.01] flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                <FileQuestion className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                  Guia de 1ª Utilização
                </h3>
                <p className="text-xs text-slate-400">Passo a passo do zero à 1ª medição</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
          </Link>
        </div>

        {/* Seção FAQ (Perguntas Frequentes Expansíveis) */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileQuestion className="w-5 h-5 text-emerald-400" />
                Perguntas Frequentes (FAQ)
              </h2>
              <p className="text-xs text-slate-400">
                Tire dúvidas imediatas sobre o fluxo de engenharia, finanças e conformidade tributária
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              6 Tópicos Essenciais
            </span>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq) => (
              <AccordionItem
                key={faq.id}
                value={faq.id}
                className="border border-slate-800 rounded-2xl bg-slate-900/40 px-4 transition-all data-[state=open]:border-emerald-500/30 data-[state=open]:bg-slate-900/80"
              >
                <AccordionTrigger className="text-sm font-semibold text-slate-200 hover:text-emerald-400 text-left py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-sm text-slate-400 pb-4 leading-relaxed border-t border-slate-800/60 pt-3">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>
    </div>
  );
}
