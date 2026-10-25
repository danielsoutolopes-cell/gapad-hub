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

export function AcademyClient() {
  // Estado de progresso dos 3 módulos salvo no localStorage
  const [completedModules, setCompletedModules] = useState<ModuleChecklist>({
    modulo1: false,
    modulo2: false,
    modulo3: false,
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
    const resetState = { modulo1: false, modulo2: false, modulo3: false };
    setCompletedModules(resetState);
    try {
      localStorage.setItem('gadap_academy_progress', JSON.stringify(resetState));
    } catch {
      // Ignore
    }
  };

  const completedCount = Object.values(completedModules).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / 3) * 100);

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
        </Accordion>
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

      {/* Rodapé com Links de Apoio */}
      <div className="border-t border-slate-800/80 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>Precisa de um passo a passo guiado para iniciantes?</span>
          <Link
            href="/dashboard/ajuda/guia-rapido"
            className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1"
          >
            Abrir Guia Rápido de 1ª Utilização
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <span className="text-[11px] text-slate-400">
          GADAP Hub • Educação Contínua &amp; Sucesso do Cliente
        </span>
      </div>
    </div>
  );
}
