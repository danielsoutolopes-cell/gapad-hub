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
  Smartphone,
  Users2,
  ShoppingCart,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { AcademyClient } from './academy-client';

export const dynamic = 'force-dynamic';

const NEW_BIBLE_MODULES = [
  {
    id: 'pwa-field-app',
    badge: 'Módulo de Campo • PWA Offline-First',
    title: 'PWA - Field App & Apontamento no Canteiro',
    description:
      'Capacite mestres de obras e encarregados a registrar presença de operários com Geofencing GPS (cerca virtual de 300m), Diário de Obras com upload de fotos e envio de requisições de compra com reconhecimento de voz e texto NLP.',
    highlights: [
      'Validação de ponto com tolerância GPS (Haversine) e resiliência RFC 7807',
      'Diário de obra sincronizado com a galeria de transparência do cliente',
      'Envio de requisições direto do canteiro sem necessidade de catálogo impresso',
    ],
    href: '/dashboard/obras',
    ctaLabel: 'Ver Obras & Diário',
    icon: Smartphone,
  },
  {
    id: 'motor-folha-esocial',
    badge: 'RH & Departamento Pessoal • eSocial',
    title: 'Motor de Folha Avançado & eSocial',
    description:
      'Geração de holerites completos CLT com alíquotas progressivas de INSS e IRRF, dedução de dependentes, matrícula sequencial por tenant para o eSocial e fechamento atômico integrado ao Contas a Pagar (Salários, DARF e FGTS Digital).',
    highlights: [
      'Cálculo progressivo automático de INSS/IRRF deduzindo dependentes',
      'Matrícula sequencial do trabalhador (0001, 0002) para integração eSocial',
      'Fechamento atômico com rollback caso ocorra falha na emissão da DARF',
    ],
    href: '/dashboard/rh',
    ctaLabel: 'Abrir Painel de RH',
    icon: Users2,
  },
  {
    id: 'smart-procurement-completo',
    badge: 'Suprimentos & Procurement Inteligente',
    title: 'Smart Procurement & Portal do Fornecedor',
    description:
      'Fluxo de ponta a ponta desde a requisição em texto livre reconhecendo 50 itens mestre até o Mapa de Cotação Dinâmico considerando Frete (+) e Descontos (-), com geração de links públicos para fornecedores responderem sem login.',
    highlights: [
      'Catálogo mestre pré-populado com os 50 insumos e ferramentas mais comuns',
      'Links externos dinâmicos de cotação para lojas e distribuidores preencherem',
      'Matriz de cotação com recálculo automático de Desconto (-) e Frete (+)',
    ],
    href: '/dashboard/suprimentos',
    ctaLabel: 'Acessar Suprimentos & Cotações',
    icon: ShoppingCart,
  },
  {
    id: 'portal-transparencia-cliente',
    badge: 'Portal Premium • Transparência',
    title: 'Portal do Cliente & Assinatura Gov.br',
    description:
      'Ambiente exclusivo view-only com a identidade visual White-Label da construtora para o cliente final acompanhar a Curva S da obra, galeria de fotos do diário e aprovação de aditivos pendentes com assinatura Gov.br.',
    highlights: [
      'Visão isolada com restrição de permissão role CLIENT e White-Label',
      'Acompanhamento do avanço Físico-Financeiro (Curva S) em tempo real',
      'Assinatura digital de termos aditivos de escopo com carimbo eletrônico',
    ],
    href: '/portal-cliente',
    ctaLabel: 'Visualizar Portal do Cliente',
    icon: ShieldCheck,
  },
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
];

const QUICK_FAQS = [
  {
    question: 'Como aprovar o ponto do canteiro no ERP?',
    answer:
      'No menu RH > Ponto do Canteiro, o gestor visualiza os batimentos enviados pelo PWA Mobile. O sistema destaca com alerta visual os registros que ocorreram fora do raio de 300m da obra (Geofence Alert). Basta conferir a justificativa ou aceitar os registros válidos clicando em "Aprovar Ponto da Equipe". As horas são transferidas para o cálculo da folha mensal.',
  },
  {
    question: 'Como funciona o Fechamento de Folha de Pagamento?',
    answer:
      'Ao finalizar o mês em RH > Folha de Pagamento, clique em "Calcular Folha". O motor aplica as alíquotas vigentes do INSS e IRRF progressivo, subtrai os dependentes legais e gera o holerite. Ao clicar em "Fechar Folha", uma transação atômica cria automaticamente no Contas a Pagar os títulos dos Salários Líquidos, DARF Previdenciário (INSS+IRRF) e FGTS Digital. Se houver qualquer falha na integração bancária, o sistema executa rollback mantendo a integridade.',
  },
  {
    question: 'Como enviar e gerenciar o Portal do Fornecedor?',
    answer:
      'Na tela de Suprimentos > Nova Requisição, digite os insumos desejados ou cole o pedido do encarregado. O sistema cruza os itens com o catálogo de 50 insumos mestre e gera um Link Público de Cotação (RFQ Dinâmica). Você pode copiar o link ou enviar por WhatsApp para a loja. O fornecedor preenche preços, frete e descontos diretamente no formulário web, alimentando em tempo real o seu Mapa Comparativo.',
  },
  {
    question: 'Como o cliente acessa o Portal de Transparência?',
    answer:
      'O cliente final recebe um convite com a role "CLIENT". Ele tem acesso a um portal dedicado e restrito (fora do backoffice administrativo) em /portal-cliente, onde pode verificar a Curva S do cronograma, navegar pelas fotos do Diário de Obra e assinar termos aditivos com validade jurídica via Gov.br.',
  },
  {
    question: 'Como aprovar uma cotação gerada pela Inteligência Artificial?',
    answer:
      'Por segurança (premissa Human-in-the-Loop), a Inteligência Artificial nunca grava valores diretamente no banco de dados. Na tela de Smart Procurement (Matriz de Cotação), faça o upload do PDF/Foto ou cole o texto do WhatsApp e clique em "Ler com IA (Revisão HITL)". O sistema abrirá o Modal Obrigatório de Revisão Humana exibindo os preços extraídos e a Categoria deduzida pela IA (ex.: ELÉTRICA ou REVESTIMENTOS) em estado de rascunho (Draft). Confira ou edite os valores, valide a categoria e clique em "Confirmar e Injetar na Matriz". Por fim, marque a cotação com o Selo de Recomendação e clique em "Aprovar Cotação Vencedora".',
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
