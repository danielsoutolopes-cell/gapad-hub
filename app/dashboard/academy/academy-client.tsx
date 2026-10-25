'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  CheckCircle2,
  Circle,
  HardHat,
  Calculator,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  BookOpen,
  Sparkles,
  Award,
  Clock,
  RotateCcw,
  Layers,
  FileCheck2,
  Building,
  CheckSquare,
  Crown,
  Flame,
  ShieldAlert,
  KeyRound,
  Database,
  Scale,
  BrainCircuit,
  Zap,
  Users,
  CreditCard,
  AlertTriangle,
  Tag,
} from 'lucide-react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

interface ModuleChecklist {
  [key: string]: boolean;
}

interface AcademyClientProps {
  isSuperAdmin?: boolean;
}

export function AcademyClient({ isSuperAdmin = false }: AcademyClientProps) {
  // Estado de progresso dos módulos salvo no localStorage
  const [completedModules, setCompletedModules] = useState<ModuleChecklist>({
    modulo1: false,
    modulo2: false,
    modulo3: false,
    modulo6: false,
    modulo7: false,
    modulo8: false,
  });

  const [activeAccordion, setActiveAccordion] = useState<string>('modulo1');
  const [isLoaded, setIsLoaded] = useState(false);

  // Carregar progresso salvo
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gadap_academy_progress');
      if (saved) {
        setCompletedModules(JSON.parse(saved));
      }
    } catch {
      // Caso localStorage não esteja acessível
    }
    setIsLoaded(true);
  }, []);

  // Salvar progresso no localStorage
  const toggleModuleCompletion = (moduleId: string) => {
    const updated = {
      ...completedModules,
      [moduleId]: !completedModules[moduleId],
    };
    setCompletedModules(updated);
    try {
      localStorage.setItem('gadap_academy_progress', JSON.stringify(updated));
    } catch {
      // Ignore write errors
    }
  };

  const resetProgress = () => {
    const resetState = {
      modulo1: false,
      modulo2: false,
      modulo3: false,
      modulo6: false,
      modulo7: false,
      modulo8: false,
    };
    setCompletedModules(resetState);
    try {
      localStorage.setItem('gadap_academy_progress', JSON.stringify(resetState));
    } catch {
      // Ignore
    }
  };

  const totalModules = 6;
  const completedCount = Object.values(completedModules).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / totalModules) * 100);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Banner Principal com Apresentação do Curso */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-teal-950/40 border border-slate-800 p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-64 h-64 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <GraduationCap className="w-4 h-4 text-emerald-400" />
              <span>GADAP Academy • Treinamento Prático Integrado</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
              Dominando a Gestão de Obras no{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                GADAP Hub
              </span>
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              Capacitação prática desenhada para engenheiros de campo, orçamentistas e gestores de obras.
              Aprenda a eliminar retrabalho em planilhas paralelas, padronizar medições e garantir conformidade fiscal com o cliente.
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-400" />
                Duração estimada: 15 minutos
              </span>
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                3 Módulos com ações práticas
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-300" />
                Foco: Produtividade e Compliance
              </span>
              <a
                href="#area-restrita-master"
                className="flex items-center gap-1.5 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5 text-red-400" />
                Área Restrita (Master)
              </a>
            </div>
          </div>

          {/* Card de Progresso Geral */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 min-w-[260px] shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-semibold text-slate-200">Seu Progresso no Curso</span>
                <span className="text-emerald-400 font-bold">{progressPercent}%</span>
              </div>

              {/* Barra de Progresso Animada */}
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 ease-out shadow-sm shadow-emerald-500/50"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="text-[11px] text-slate-400 mt-2">
                {completedCount} de 3 módulos concluídos
              </p>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center justify-between">
              {progressPercent === 100 ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-semibold">
                  <Award className="w-4 h-4 text-emerald-400" />
                  <span>Curso Completo!</span>
                </div>
              ) : (
                <span className="text-[11px] text-slate-400">Complete os checklists abaixo</span>
              )}

              {completedCount > 0 && (
                <button
                  type="button"
                  onClick={resetProgress}
                  title="Reiniciar progresso do curso"
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reiniciar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Banner Expresso para Autônomos, MEI e Arquitetos */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-amber-500/5">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 rounded-xl bg-amber-500/20 text-amber-300 ring-2 ring-amber-500/30">
            <Zap className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-bold text-white">
                É Arquiteto Solo, Engenheiro Autônomo ou MEI?
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider">
                Novo
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Acesse o <strong>Onboarding Expresso em 3 Passos</strong>: Orce com margem direta (Markup), crie a obra e fature sem retenções fiscais em menos de 5 minutos.
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/academy/mei"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all self-start sm:self-auto whitespace-nowrap"
        >
          <Zap className="w-4 h-4 stroke-[2.5]" />
          Acessar Guia Expresso
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Accordion Interativo dos 3 Módulos Práticos */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            Estrutura do Treinamento
          </h2>
          <span className="text-xs text-slate-400">
            Clique no módulo para expandir o conteúdo e as ações práticas
          </span>
        </div>

        <Accordion
          type="single"
          collapsible
          value={activeAccordion}
          onValueChange={(val) => setActiveAccordion(val)}
          className="space-y-4"
        >
          {/* MÓDULO 1 */}
          <AccordionItem value="modulo1">
            <AccordionTrigger className="hover:bg-slate-900/60 transition-colors">
              <div className="flex items-start sm:items-center gap-3.5">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleModuleCompletion('modulo1');
                  }}
                  title={completedModules.modulo1 ? 'Concluído' : 'Marcar como concluído'}
                  className={`mt-0.5 sm:mt-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
                    completedModules.modulo1
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                      : 'bg-slate-800/80 text-slate-400 border border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {completedModules.modulo1 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </div>

                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                      Módulo 1
                    </span>
                    {completedModules.modulo1 && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                        Concluído
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-white">
                    Navegando no Dashboard e Visão Geral da Obra
                  </h3>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent>
              <div className="space-y-6 pt-2">
                {/* 1. Contexto e Objetivos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-1">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      1. Painel 360° sem Planilhas
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Chega de procurar em dezenas de abas de Excel. O painel central consolida o valor contratado, o montante medido e o saldo restante em um único lugar seguro.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center mb-1">
                      <Building className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      2. Filtros por Cliente e Status
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Localize obras ativas, em planejamento ou finalizadas em segundos. Você e sua equipe têm visibilidade imediata de quem é o tomador de cada contrato.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-300 flex items-center justify-center mb-1">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      3. Previsibilidade de Caixa
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Antecipe recebíveis e identifique quais canteiros estão com medições pendentes de faturamento antes do fechamento contábil do mês.
                    </p>
                  </div>
                </div>

                {/* Checklist Prático do Módulo 1 */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                    Ações Práticas Recomendadas:
                  </h4>
                  <div className="space-y-2 text-xs text-slate-300">
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={completedModules.modulo1}
                        onChange={() => toggleModuleCompletion('modulo1')}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-950 w-4 h-4"
                      />
                      <span>Acesse a listagem de obras e confira os cards de Valor do Contrato e Status</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={completedModules.modulo1}
                        onChange={() => toggleModuleCompletion('modulo1')}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-950 w-4 h-4"
                      />
                      <span>Filtre as obras por cliente e status de execução</span>
                    </label>
                  </div>
                </div>

                {/* Botões de Ação do Módulo */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href="/dashboard/obras"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20"
                    >
                      <HardHat className="w-4 h-4" />
                      Explorar Painel de Obras
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      href="/dashboard/clientes"
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                    >
                      Consultar Clientes
                    </Link>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleModuleCompletion('modulo1')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      completedModules.modulo1
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                        : 'text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {completedModules.modulo1 ? 'Módulo 1 Concluído' : 'Marcar Módulo 1 como Concluído'}
                  </button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* MÓDULO 2 */}
          <AccordionItem value="modulo2">
            <AccordionTrigger className="hover:bg-slate-900/60 transition-colors">
              <div className="flex items-start sm:items-center gap-3.5">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleModuleCompletion('modulo2');
                  }}
                  title={completedModules.modulo2 ? 'Concluído' : 'Marcar como concluído'}
                  className={`mt-0.5 sm:mt-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
                    completedModules.modulo2
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                      : 'bg-slate-800/80 text-slate-400 border border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {completedModules.modulo2 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </div>

                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">
                      Módulo 2
                    </span>
                    {completedModules.modulo2 && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                        Concluído
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-white">
                    O Ciclo de Vida de uma Obra (do Cadastro à Primeira Medição)
                  </h3>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent>
              <div className="space-y-6 pt-2">
                {/* 3 Etapas Fundamentais */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center mb-1">
                      <FileCheck2 className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      1. Vínculo Contratual Perfeito
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Ao cadastrar uma obra, vincule o Cliente tomador, o Valor Global do Contrato e o cronograma previsto. A seleção do município garante cálculo fiscal exato.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-1">
                      <Calculator className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      2. Orçamento Integrado (BDI)
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      O orçamento já nasce protegido com a fórmula oficial do BDI, garantindo que custos diretos e margem de segurança estejam em conformidade antes da execução.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-300 flex items-center justify-center mb-1">
                      <HardHat className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      3. Apontamento de Campo
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      O engenheiro de campo acessa a aba de Medições da obra e registra o boletim do período mensal sem intermediários ou retrabalho de digitação.
                    </p>
                  </div>
                </div>

                {/* Checklist Prático do Módulo 2 */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-teal-400" />
                    Ações Práticas Recomendadas:
                  </h4>
                  <div className="space-y-2 text-xs text-slate-300">
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={completedModules.modulo2}
                        onChange={() => toggleModuleCompletion('modulo2')}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-950 w-4 h-4"
                      />
                      <span>Cadastre uma Obra de teste vinculada a um cliente existente</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={completedModules.modulo2}
                        onChange={() => toggleModuleCompletion('modulo2')}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-950 w-4 h-4"
                      />
                      <span>Acesse a página de Medições da obra recém-criada</span>
                    </label>
                  </div>
                </div>

                {/* Botões de Ação do Módulo */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href="/dashboard/obras"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-all shadow-md shadow-teal-500/20"
                    >
                      <Building className="w-4 h-4" />
                      Cadastrar ou Gerenciar Obra
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      href="/dashboard/orcamentos/novo"
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                    >
                      Criar Orçamento BDI
                    </Link>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleModuleCompletion('modulo2')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      completedModules.modulo2
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                        : 'text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {completedModules.modulo2 ? 'Módulo 2 Concluído' : 'Marcar Módulo 2 como Concluído'}
                  </button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* MÓDULO 3 */}
          <AccordionItem value="modulo3">
            <AccordionTrigger className="hover:bg-slate-900/60 transition-colors">
              <div className="flex items-start sm:items-center gap-3.5">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleModuleCompletion('modulo3');
                  }}
                  title={completedModules.modulo3 ? 'Concluído' : 'Marcar como concluído'}
                  className={`mt-0.5 sm:mt-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
                    completedModules.modulo3
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                      : 'bg-slate-800/80 text-slate-400 border border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {completedModules.modulo3 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </div>

                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                      Módulo 3
                    </span>
                    {completedModules.modulo3 && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                        Concluído
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-white">
                    Entendendo a Mágica Matemática por trás do Faturamento (Retenções)
                  </h3>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent>
              <div className="space-y-6 pt-2">
                {/* 3 Pilares do Faturamento Seguro */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-1">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      1. O que é a Retenção Técnica?
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Uma garantia contratual (usualmente 5% a 10%) retida pelo cliente para caucionar a entrega definitiva da obra. Ela não é desconto comercial: é dinheiro da sua construtora devolvido após o Termo de Recebimento.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-300 flex items-center justify-center mb-1">
                      <Calculator className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      2. Cálculo Automático sem Divergências
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Você informa apenas o valor bruto e a taxa acordada. O motor do GADAP calcula a retenção e o valor líquido exato em tempo real. Adeus divergências na emissão da nota fiscal de serviço!
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-1">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      3. Trava de Proteção dos 100%
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      O sistema monitora o saldo contratual restante a cada boletim. Se o canteiro tentar medir além de 100% do contrato original, a operação é travada até a formalização de um aditivo contratual seguro.
                    </p>
                  </div>
                </div>

                {/* Exemplo Prático Visual */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-emerald-500/20 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Simulação Visual de uma Medição Típica:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[11px] text-slate-400 block mb-0.5">Valor Medido Bruto</span>
                      <span className="text-base font-bold text-white">R$ 100.000,00</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[11px] text-amber-400 block mb-0.5">Retenção Técnica (5%)</span>
                      <span className="text-base font-bold text-amber-400">- R$ 5.000,00</span>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                      <span className="text-[11px] text-emerald-400 block mb-0.5">Valor Líquido a Receber</span>
                      <span className="text-base font-bold text-emerald-300">R$ 95.000,00</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 text-center">
                    O valor líquido alimenta o faturamento financeiro e o módulo fiscal sem digitação manual.
                  </p>
                </div>

                {/* Checklist Prático do Módulo 3 */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-amber-400" />
                    Ações Práticas Recomendadas:
                  </h4>
                  <div className="space-y-2 text-xs text-slate-300">
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={completedModules.modulo3}
                        onChange={() => toggleModuleCompletion('modulo3')}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-950 w-4 h-4"
                      />
                      <span>Abra uma obra e clique em &quot;Lançar Medição&quot; para testar a prévia ao vivo</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={completedModules.modulo3}
                        onChange={() => toggleModuleCompletion('modulo3')}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-950 w-4 h-4"
                      />
                      <span>Verifique o cálculo da retenção técnica de 5% e o valor líquido gerado</span>
                    </label>
                  </div>
                </div>

                {/* Botões de Ação do Módulo */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href="/dashboard/obras"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20"
                    >
                      <HardHat className="w-4 h-4" />
                      Acessar Medições e Testar Simulação
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleModuleCompletion('modulo3')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      completedModules.modulo3
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                        : 'text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {completedModules.modulo3 ? 'Módulo 3 Concluído' : 'Marcar Módulo 3 como Concluído'}
                  </button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* MÓDULO 6: INTELIGÊNCIA ARTIFICIAL A SEU FAVOR */}
          <AccordionItem value="modulo6">
            <AccordionTrigger className="hover:bg-slate-900/60 transition-colors">
              <div className="flex items-start sm:items-center gap-3.5">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleModuleCompletion('modulo6');
                  }}
                  title={completedModules.modulo6 ? 'Concluído' : 'Marcar como concluído'}
                  className={`mt-0.5 sm:mt-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
                    completedModules.modulo6
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                      : 'bg-slate-800/80 text-slate-400 border border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {completedModules.modulo6 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </div>

                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      Módulo 6
                    </span>
                    {completedModules.modulo6 && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                        Concluído
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-white">
                    Inteligência Artificial a seu favor: Autonomia Fiscal &amp; Radar Tributário
                  </h3>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent>
              <div className="space-y-6 pt-2">
                {/* 3 Pilares da IA no GADAP Hub */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-1">
                      <Scale className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      1. Não Dependa do Contador para Saber de Alíquotas
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      O radar legislativo do GADAP monitora o IBPT e o Portal Nacional da NFS-e diariamente. Quando uma prefeitura altera a alíquota de ISS da obra (Item 07.02) ou o governo atualiza a tabela de transparência, a IA avisa seu canteiro instantaneamente.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-300 flex items-center justify-center mb-1">
                      <BrainCircuit className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      2. OCR Preditivo com Gemini 2.5 Flash
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Chega de digitar notas de insumos manualmente. Arraste a foto ou PDF do romaneio de cimento, ferro ou tintas: a IA extrai CNPJ do fornecedor, datas, totais e itens discriminados em segundos, preparando o título do Contas a Pagar.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-1">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      3. Governança Human-in-the-Loop
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      A tecnologia agiliza o trabalho braçal, mas o controle financeiro continua sob custódia humana. O GADAP exige que o operador revise visualmente o comprovante e homologue o lançamento antes de gravar no Contas a Pagar.
                    </p>
                  </div>
                </div>

                {/* Checklist Prático do Módulo 6 */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-cyan-400" />
                    Ações Práticas Recomendadas:
                  </h4>
                  <div className="space-y-2 text-xs text-slate-300">
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={completedModules.modulo6}
                        onChange={() => toggleModuleCompletion('modulo6')}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-950 w-4 h-4"
                      />
                      <span>Acesse a tela de Tax Intelligence e confira os alertas tributários em tempo real</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={completedModules.modulo6}
                        onChange={() => toggleModuleCompletion('modulo6')}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-950 w-4 h-4"
                      />
                      <span>Faça o upload de uma nota fiscal de compras para testar o OCR preditivo com LLM</span>
                    </label>
                  </div>
                </div>

                {/* Botões de Ação do Módulo */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href="/dashboard/inteligencia"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 text-slate-950 transition-all shadow-md shadow-emerald-500/20"
                    >
                      <Sparkles className="w-4 h-4" />
                      Abrir Painel de Tax Intelligence e Testar OCR
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleModuleCompletion('modulo6')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      completedModules.modulo6
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                        : 'text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {completedModules.modulo6 ? 'Módulo 6 Concluído' : 'Marcar Módulo 6 como Concluído'}
                  </button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* MÓDULO 7: PREPARANDO SUA CONSTRUTORA PARA O IBS E CBS */}
          <AccordionItem value="modulo7">
            <AccordionTrigger className="hover:bg-slate-900/60 transition-colors">
              <div className="flex items-start sm:items-center gap-3.5">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleModuleCompletion('modulo7');
                  }}
                  title={completedModules.modulo7 ? 'Concluído' : 'Marcar como concluído'}
                  className={`mt-0.5 sm:mt-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
                    completedModules.modulo7
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                      : 'bg-slate-800/80 text-slate-400 border border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {completedModules.modulo7 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </div>

                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                      <Scale className="w-3 h-3 text-emerald-400" />
                      Módulo 7
                    </span>
                    {completedModules.modulo7 && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                        Concluído
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-white">
                    Preparando sua construtora para o IBS e CBS (Reforma Tributária &amp; Período de Convivência)
                  </h3>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent>
              <div className="space-y-6 pt-2">
                {/* 3 Pilares da Reforma Tributária no GADAP Hub */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-1">
                      <Scale className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      1. Fim do Efeito Cascata &amp; Não-Cumulatividade Plena
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      No IVA Dual (CBS Federal + IBS Estadual/Municipal), cada nota de material (cimento, areia, ferro, maquinário) gera crédito financeiro automático. Esse saldo abate diretamente o imposto devido na medição de serviços, eliminando a bitributação histórica da construção.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center mb-1">
                      <Layers className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      2. Redutor Setorial de 40% da Construção Civil
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      O PLP 68/2024 e a EC nº 132/2023 asseguram um desconto de 40% na alíquota padrão do IBS/CBS para obras de engenharia e incorporações imobiliárias. Uma alíquota estimada de ~27,97% passa para ~16,78% efetiva sobre a medição.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-1">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      3. Convivência 2026-2032 &amp; Bypass MEI
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Durante a transição (2026 a 2032), o GADAP Hub apura ambos os regimes em paralelo sem risco de não-conformidade. E para engenheiros solo e pequenos empreiteiros, o Bypass Fiscal do SIMEI desonera retenções na fonte de INSS (11%), IRRF e CSRF automaticamente.
                    </p>
                  </div>
                </div>

                {/* Checklist Prático do Módulo 7 */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                    Ações Práticas Recomendadas:
                  </h4>
                  <div className="space-y-2 text-xs text-slate-300">
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={completedModules.modulo7}
                        onChange={() => toggleModuleCompletion('modulo7')}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-950 w-4 h-4"
                      />
                      <span>Acesse o Simulador da Reforma e simule uma medição alternando entre 2026, 2027 e 2033</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={completedModules.modulo7}
                        onChange={() => toggleModuleCompletion('modulo7')}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-950 w-4 h-4"
                      />
                      <span>Cadastre uma nota fiscal de materiais para validar o abatimento de créditos financeiros de CBS/IBS</span>
                    </label>
                  </div>
                </div>

                {/* Botões de Ação do Módulo */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href="/dashboard/fiscal/simulador-reforma"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 text-slate-950 transition-all shadow-md shadow-emerald-500/20"
                    >
                      <Scale className="w-4 h-4" />
                      Abrir Simulador da Reforma Tributária (IVA Dual &amp; Bypass MEI)
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleModuleCompletion('modulo7')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      completedModules.modulo7
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                        : 'text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {completedModules.modulo7 ? 'Módulo 7 Concluído' : 'Marcar Módulo 7 como Concluído'}
                  </button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* MÓDULO 8: PAGANDO TERCEIRIZADOS SEM BUROCRACIA (MODELO FAROL & ZERO TRAVAS) */}
          <AccordionItem value="modulo8">
            <AccordionTrigger className="hover:bg-slate-900/60 transition-colors">
              <div className="flex items-start sm:items-center gap-3.5">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleModuleCompletion('modulo8');
                  }}
                  title={completedModules.modulo8 ? 'Concluído' : 'Marcar como concluído'}
                  className={`mt-0.5 sm:mt-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
                    completedModules.modulo8
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm shadow-amber-500/20'
                      : 'bg-slate-800/80 text-slate-400 border border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {completedModules.modulo8 ? (
                    <CheckCircle2 className="w-5 h-5 text-amber-400" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </div>

                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                      <Users className="w-3 h-3 text-amber-400" />
                      Módulo 8
                    </span>
                    {completedModules.modulo8 && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-medium">
                        Concluído
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-white">
                    Pagando Terceirizados sem Burocracia (Modelo Farol &amp; Campos de Atuação)
                  </h3>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent>
              <div className="space-y-6 pt-2">
                {/* 3 Cartões de Princípios do Módulo 8 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-1">
                      <Tag className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      1. Subcontratados &amp; Campos de Atuação
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      No cadastro de fornecedores, sinalize o parceiro como <strong>Subcontratado</strong> (<code className="text-amber-400 font-mono text-[11px]">is_subcontractor = true</code>) e atribua seus <strong>Campos de Atuação</strong> (ex: <em>Elétrica, Hidráulica, Alvenaria, Pintura, Gesso, Climatização</em>). Isso confere visibilidade instantânea no canteiro sobre quais equipes respondem por cada etapa da obra.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-1">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      2. Política Zero Travas (Vida Real da Obra)
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      A rotina do canteiro não pode parar à espera de validações burocráticas para pagar vales semanais, compras de cabos ou diárias combinadas por WhatsApp. O GADAP Hub <strong>nunca bloqueia pagamentos</strong>: com o botão rápido <strong>&quot;Lançar Pagamento&quot;</strong>, o valor é registrado na hora e pode gerar despesa automática no Contas a Pagar sem exigir medição vinculada.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center mb-1">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      3. O Modelo Farol de Governança
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Para evitar prejuízos e abandono de obra, o sistema monitora em tempo real a proporção entre o <strong>Total Desembolsado</strong> e o <strong>Avanço Físico Medido</strong>. A borda do card e o indicador visual mudam de cor para orientar os diretores e engenheiros com clareza cristalina.
                    </p>
                  </div>
                </div>

                {/* Tabela Explicativa do Diagnóstico do Farol */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    Como Interpretar o Farol de Risco Físico-Financeiro:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-1">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
                        🟢 Farol Verde (Equilibrado)
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        <strong>Pagamentos &le; Medição Aprovada:</strong> O empreiteiro já executou e comprovou mais serviços do que recebeu. Risco financeiro nulo para a construtora.
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-1">
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
                        🟡 Farol Amarelo (Atenção)
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        <strong>Pagamentos &gt; Medição (&lt; 80% do contrato):</strong> Foi concedido adiantamento financeiro sem cobertura física ainda. Alerta o engenheiro a cobrar o avanço da equipe.
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 space-y-1">
                      <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse shadow-[0_0_10px_#f43f5e]" />
                        🔴 Farol Vermelho (Risco Crítico)
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        <strong>Pagamentos &gt; Medição E desembolso &ge; 80% do valor global:</strong> O parceiro recebeu quase a totalidade do contrato sem entregar a medição correspondente. Risco severo de abandono!
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2.5 mt-2">
                    <Scale className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-cyan-300">Como regularizar o parceiro?</strong> Basta clicar no botão <strong>&quot;Registrar Medição&quot;</strong> na tela da obra. O apontamento do avanço físico abate a exposição financeira e retorna o status imediatamente para o <strong>Farol Verde</strong>.
                    </div>
                  </div>
                </div>

                {/* Checklist Prático do Módulo 8 */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-amber-400" />
                    Ações Práticas Recomendadas:
                  </h4>
                  <div className="space-y-2 text-xs text-slate-300">
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={completedModules.modulo8}
                        onChange={() => toggleModuleCompletion('modulo8')}
                        className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-950 w-4 h-4"
                      />
                      <span>Acesse a listagem de Obras (/dashboard/obras) e clique no botão &quot;Terceirizados&quot; de um canteiro</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={completedModules.modulo8}
                        onChange={() => toggleModuleCompletion('modulo8')}
                        className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-950 w-4 h-4"
                      />
                      <span>Abra o gerenciador de Especialidades e vincule campos de atuação (ex: Elétrica, Hidráulica) a um fornecedor</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={completedModules.modulo8}
                        onChange={() => toggleModuleCompletion('modulo8')}
                        className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-950 w-4 h-4"
                      />
                      <span>Lance um adiantamento no botão &quot;Lançar Pagamento&quot; (Zero Travas) e observe a alteração da cor da borda do card</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={completedModules.modulo8}
                        onChange={() => toggleModuleCompletion('modulo8')}
                        className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-950 w-4 h-4"
                      />
                      <span>Aponte o serviço entregue em &quot;Registrar Medição&quot; para abater o saldo devedor e reequilibrar o Farol</span>
                    </label>
                  </div>
                </div>

                {/* Botões de Ação do Módulo */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href="/dashboard/obras"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-400 to-amber-300 hover:brightness-110 text-slate-950 transition-all shadow-md shadow-amber-400/20"
                    >
                      <Users className="w-4 h-4" />
                      Acessar Gestão de Obras &amp; Terceirizados (Modelo Farol)
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleModuleCompletion('modulo8')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      completedModules.modulo8
                        ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30'
                        : 'text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {completedModules.modulo8 ? 'Módulo 8 Concluído' : 'Marcar Módulo 8 como Concluído'}
                  </button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* ===================================================================== */}
      {/* BLOCO: 🎯 MVP CONCLUÍDO & DECLARAÇÃO DE PRÓXIMO PASSO                 */}
      {/* ===================================================================== */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950/90 via-slate-900 to-teal-950/90 border-2 border-emerald-500/50 p-6 sm:p-8 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm shadow-emerald-500/10">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            🎯 MVP CONCLUÍDO &amp; CORE SELADO
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
            Fase 13 Concluída [x]
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/40">
            Fase 12 Concluída [x]
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
            Modelo Farol &amp; Subcontratos
          </span>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Fase 13 Concluída com Sucesso! Gestão de Terceirizados &amp; Modelo Farol Operando no Canteiro.
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed mt-2 max-w-3xl">
            Toda a esteira operacional do GADAP Hub — orçamentos analíticos com BDI e Markup rápido, medições com retenção técnica, automação de NFS-e Padrão Nacional, isolamento hermético multi-tenant, OCR preditivo via IA, preparação completa para o IVA Dual (IBS/CBS e Bypass Fiscal MEI) e a <strong>Gestão de Subcontratos Desburocratizada (Zero Travas &amp; Modelo Farol)</strong> — atingiu maturidade plena de produção.
          </p>
        </div>

        <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-950/40 -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 p-4 sm:p-6 rounded-b-3xl">
          <div className="flex items-start sm:items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wider text-[10px] flex-shrink-0">
              Próximo Passo
            </span>
            <span className="text-slate-200">
              O core do negócio está selado para o futuro e a próxima etapa é a <strong>FASE 11: BILLING E MONETIZAÇÃO SAAS</strong>.
            </span>
          </div>

          <div className="text-[11px] text-slate-400 font-mono flex-shrink-0">
            Fase 11 &bull; Stripe/Asaas &bull; Planos &bull; Checkout
          </div>
        </div>
      </div>

      {/* Card de Conquista / Certificado ao Concluir os 3 Módulos */}
      {progressPercent === 100 && (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 border border-emerald-500/40 shadow-xl shadow-emerald-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-5 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Parabéns! Você concluiu o treinamento oficial!
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Você agora domina a gestão de obras, orçamentos e medições físico-financeiras no GADAP Hub.
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/obras"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 hover:brightness-110 transition-all shadow-lg shadow-emerald-500/20"
          >
            Ir para Gestão de Obras
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* SEÇÃO: ÁREA RESTRITA (MASTER) - GOVERNANÇA DA PLATAFORMA */}
      <section
        id="area-restrita-master"
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-red-950/30 border border-red-500/30 p-6 sm:p-8 shadow-2xl space-y-6"
      >
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-72 h-72 rounded-full bg-red-600/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-16 w-60 h-60 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-300 border border-red-500/30">
              <Crown className="w-3.5 h-3.5 text-red-400" />
              <span>Manual Vivo • Área Restrita (Master)</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              Governança de Instâncias e Botão &quot;Zerar Dados&quot;
            </h2>

            <p className="text-sm text-slate-300 leading-relaxed">
              Guia oficial para o Administrador da Plataforma (Super Admin) sobre o gerenciamento multi-tenant,
              expurgo seguro de dados operacionais e preparação de ambientes para demonstração comercial.
            </p>
          </div>

          {isSuperAdmin ? (
            <Link
              href="/backoffice"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/20 transition-all flex-shrink-0"
            >
              <Crown className="w-4 h-4" />
              <span>Acessar Painel Master (God Mode)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 bg-slate-900 border border-slate-800 flex-shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>Acesso restrito ao Dono do SaaS</span>
            </div>
          )}
        </div>

        {/* 3 Cartões de Orientação Estratégica */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Card 1: Finalidade da Ferramenta */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              1. Finalidade do Reset
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              O botão <strong className="text-amber-300">&quot;Zerar Dados / Reset Ambiente&quot;</strong> foi
              projetado especificamente para sanitizar ambientes de teste, demonstrações comerciais (presales) e workshops guiados.
              Ele limpa dados legados e permite recomeçar o onboarding com números limpos em poucos segundos.
            </p>
          </div>

          {/* Card 2: Ação Irreversível nos Dados Operacionais */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-red-500/40 space-y-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-red-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>2. Ação Irreversível</span>
              <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded font-mono font-bold">CRÍTICO</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              A ação é <strong className="text-red-300">irreversível para todos os dados operacionais</strong> do Tenant.
              São expurgados permanentemente: todas as Obras (Projetos), Boletins de Medição Físico-Financeira,
              Lançamentos Financeiros (Contas a Pagar e Receber), Clientes, Fornecedores e Orçamentos com BDI.
            </p>
          </div>

          {/* Card 3: Preservação de Logins e Contas */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-emerald-500/40 space-y-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
              3. Preserva Logins e Acessos
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-emerald-300">Segurança de Acesso Garantida:</strong> O registro da empresa raiz
              (Tenant) e todas as contas de usuários (e-mails e senhas no Supabase Auth) permanecem 100% preservados.
              A equipe da construtora continua com suas credenciais ativas, sem necessidade de recadastramento ou novos convites.
            </p>
          </div>
        </div>

        {/* Box de Ajuda Contextual Shadcn UI */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2.5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Ajuda Contextual e Salvaguarda Operacional
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                No painel Backoffice, o botão &quot;Zerar Dados&quot; conta com um <strong>Tooltip (Shadcn UI)</strong> de ajuda contextual rápida:
              </p>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-amber-300/90 my-1.5 inline-block">
                &ldquo;Limpa todos os clientes, orçamentos, medições e dados financeiros deste Tenant. Ideal para resetar ambientes de Demonstração e Tutoriais.&rdquo;
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Além do Tooltip, a operação requer confirmação em um modal destrutivo (AlertDialog), garantindo que nenhum expurgo ocorra de forma acidental.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Rodapé com Links de Apoio */}
      <div className="border-t border-slate-800/80 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span>Precisa de um passo a passo guiado para iniciantes?</span>
            <Link
              href="/dashboard/ajuda/guia-rapido"
              className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1"
            >
              Abrir Guia Rápido de 1ª Utilização
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {isSuperAdmin && (
            <Link
              href="/backoffice"
              className="text-red-400 hover:text-red-300 font-semibold inline-flex items-center gap-1 border-l border-slate-800 pl-3"
            >
              <Crown className="w-3 h-3" />
              Painel Backoffice (Master)
            </Link>
          )}
        </div>

        <span className="text-[11px] text-slate-400">
          GADAP Hub • Educação Contínua &amp; Sucesso do Cliente
        </span>
      </div>
    </div>
  );
}
