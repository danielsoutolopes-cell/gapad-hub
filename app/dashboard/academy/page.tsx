import React from 'react';
import NextLink from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import {
  FilePlus2,
  Truck,
  BrainCircuit,
  QrCode,
  HelpCircle,
  BookOpen,
  Download,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { AcademyClient } from './academy-client';

export const dynamic = 'force-dynamic';

const NEW_BIBLE_MODULES = [
  {
    id: 'aditivos',
    badge: 'Fase 19 • Contratos B2B',
    title: 'Gestão de Aditivos (Change Orders)',
    description:
      'Domine o fluxo de serviços extras de cliente (CLIENT_EXTRA) e aditivos de subempreiteiros (SUBCONTRACTOR_EXTRA). Aprenda a recalibrar automaticamente o teto contratual, proteger o BDI e emitir Termos Aditivos com assinatura Gov.br e disparo via WhatsApp.',
    highlights: [
      'Recalibração automática do valor do contrato e Contas a Receber/Pagar',
      'Assinatura eletrônica Gov.br com hash de auditoria em PDF',
      'Proteção do Farol de Risco em contratos de subempreiteiros',
    ],
    href: '/dashboard/obras',
    ctaLabel: 'Acessar Obras & Aditivos',
    icon: FilePlus2,
  },
  {
    id: 'portaria-logistica',
    badge: 'Fase 19 • Canteiro & Almoxarifado',
    title: 'Portaria Digital e Termos de Logística',
    description:
      'Padronize o recebimento físico de materiais e equipamentos no canteiro. Gere Termos de Responsabilidade e Recebimento para motoristas de aplicativos (Lalamove/Uber Flash) e transportadoras com registro fotográfico da carga.',
    highlights: [
      'Emissão instantânea de Termo de Recebimento de Material em PDF',
      'Check-in fotográfico de cargas, placas e documentos de motoristas',
      'Integração direta com o saldo de estoque (inventory_items)',
    ],
    href: '/dashboard/suprimentos',
    ctaLabel: 'Acessar Logística & Suprimentos',
    icon: Truck,
  },
  {
    id: 'smart-procurement',
    badge: 'Fase 20 • IA & Engenharia de Custos',
    title: 'Smart Procurement (OCR, IA e Categorização Curva ABC)',
    description:
      'Extraia cotações de PDFs, fotos e mensagens de WhatsApp com trava obrigatória Human-in-the-Loop (nenhum dado é gravado sem revisão humana). Agrupe insumos automaticamente por família (ELÉTRICA, HIDRÁULICA, REVESTIMENTOS, ESTRUTURAL) na Curva ABC.',
    highlights: [
      'Trava Human-in-the-Loop (HITL) com revisão de preços e categoria deduzida',
      'Mapas Sequenciais por Obra (MAPA-001-LORENA) e Contas a Pagar Duplo',
      'PDF executivo agrupado com subtotais por família e Gráfico Curva ABC',
    ],
    href: '/dashboard/suprimentos',
    ctaLabel: 'Abrir Smart Procurement',
    icon: BrainCircuit,
  },
  {
    id: 'faturamento-pix',
    badge: 'Fase 20 • Billing & Fiscal',
    title: 'Faturamento e Renovação PIX',
    description:
      'Gerencie sua assinatura SaaS, renove benefícios comerciais PLG/Founder e liquide faturas via QR Code PIX dinâmico com liberação imediata de módulos por Webhook, além da emissão de NF-e/NFS-e com Certificado A1.',
    highlights: [
      'Checkout instantâneo via QR Code PIX e Copia-e-Cola (Asaas/Stripe)',
      'Desbloqueio automático de módulos via Webhook sem espera',
      'Renovação de benefício comercial de 50% e histórico de faturas',
    ],
    href: '/dashboard/configuracoes/faturamento',
    ctaLabel: 'Ir para Faturamento & PIX',
    icon: QrCode,
  },
];

const QUICK_FAQS = [
  {
    question: 'Como aprovar uma cotação gerada pela Inteligência Artificial?',
    answer:
      'Por segurança (premissa Human-in-the-Loop), a Inteligência Artificial nunca grava valores diretamente no banco de dados. Na tela de Smart Procurement (Matriz de Cotação), faça o upload do PDF/Foto ou cole o texto do WhatsApp e clique em "Ler com IA (Revisão HITL)". O sistema abrirá o Modal Obrigatório de Revisão Humana exibindo os preços extraídos e a Categoria deduzida pela IA (ex.: ELÉTRICA ou REVESTIMENTOS) em estado de rascunho (Draft). Confira ou edite os valores, valide a categoria e clique em "Confirmar e Injetar na Matriz". Por fim, marque a cotação com o Selo de Recomendação e clique em "Aprovar Cotação Vencedora".',
  },
  {
    question:
      'Como gerar um termo de recebimento de material para transportadoras (Lalamove/Uber)?',
    answer:
      'Ao receber insumos ou equipamentos no canteiro via Lalamove, Uber Flash ou transportadora tradicional, acesse a Portaria Digital / Transferências da Obra (ou a aba de Compras Diretas em Suprimentos). Selecione a entrega correspondente, confira os itens físicos, anexe a foto do material/recibo descarregado e clique em "Gerar Termo de Logística / Recebimento (PDF)". O documento é emitido na hora com identificação do entregador, horário e responsável pelo recebimento no canteiro.',
  },
];

export default async function AcademyPage() {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login?redirect=/dashboard/academy');
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-10">
        {/* Seção 1: Bíblia do GADAP v2.0 — Novos Módulos das Fases 19 e 20 */}
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Bíblia do GADAP v2.0 • Atualização Global (Prompt 88)</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                <BookOpen className="w-7 h-7 text-emerald-400" />
                <span>Novas Aulas & Manuais Operacionais (Fases 19 e 20)</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-3xl">
                Documentação viva atualizada com os novos fluxos de Governança de Aditivos, Portaria
                Digital, Smart Procurement com IA/Curva ABC e Renovação Instantânea via PIX.
              </p>
            </div>

            <a
              href="/docs/biblia_do_gadap_v2.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all self-start md:self-auto whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Bíblia do GADAP v2.0 (PDF)</span>
            </a>
          </div>

          {/* Grid de Cards dos 4 Novos Módulos Obrigatórios */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {NEW_BIBLE_MODULES.map((mod) => {
              const IconComponent = mod.icon;
              return (
                <div
                  key={mod.id}
                  className="rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 p-5 flex flex-col justify-between gap-4 transition-all duration-200 ease-in-out"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-900 text-emerald-400 border border-slate-800">
                        {mod.badge}
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400">
                        <IconComponent className="w-5 h-5" />
                      </div>
                    </div>

                    <h2 className="text-base sm:text-lg font-bold text-white">{mod.title}</h2>
                    <p className="text-xs text-slate-300 leading-relaxed">{mod.description}</p>

                    <ul className="space-y-1.5 pt-2 border-t border-slate-800/80">
                      {mod.highlights.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-xs text-slate-400"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-2">
                    <NextLink
                      href={mod.href}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <span>{mod.ctaLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </NextLink>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Seção 2: FAQ Rápido de Canteiro & IA */}
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 space-y-5">
          <div className="border-b border-slate-800 pb-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
              Respostas Diretas de Operação
            </span>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2 mt-1">
              <HelpCircle className="w-5 h-5 text-amber-400" />
              <span>FAQ Rápido — Dúvidas Críticas de Canteiro e IA</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {QUICK_FAQS.map((faq) => (
              <div
                key={faq.question}
                className="rounded-xl bg-slate-950 border border-slate-800 p-5 space-y-2.5"
              >
                <h3 className="text-sm font-bold text-amber-300 flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>{faq.question}</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Seção 3: Trilha Interativa Completa (Checklists Módulos 1 a 13 + Área Master) */}
        <AcademyClient isSuperAdmin={isSuperAdmin} />
      </main>
    </div>
  );
}
