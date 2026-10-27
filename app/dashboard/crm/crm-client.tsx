'use client';

import React, { useState } from 'react';
import { 
  Users, 
  Target, 
  DollarSign, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Plus, 
  Search, 
  PhoneCall, 
  Building2, 
  Calendar,
  Wrench,
  ShieldAlert,
  ChevronRight,
  Flame
} from 'lucide-react';
import PaywallBlocker from '@/components/ui/paywall-blocker';

interface Lead {
  id: string;
  name: string;
  contact_name: string;
  phone: string;
  stage: 'NOVO' | 'QUALIFICACAO' | 'PROPOSTA' | 'FECHADO';
  estimated_value: number;
  project_type: string;
  probability: number;
}

interface ServiceTicket {
  id: string;
  project_name: string;
  unit_number: string;
  client_name: string;
  title: string;
  category: 'INFILTRACAO' | 'ELETRICA' | 'PINTURA' | 'ESTRUTURAL';
  priority: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  sla_status: 'DENTRO_PRAZO' | 'RISCO' | 'ESTOURADO';
  days_open: number;
}

const INITIAL_LEADS: Lead[] = [
  {
    id: 'lead-1',
    name: 'Condomínio Residencial Horizon',
    contact_name: 'Dr. Roberto Farias (Síndico)',
    phone: '(11) 98745-1234',
    stage: 'NOVO',
    estimated_value: 1250000,
    project_type: 'Reforma Estrutural e Fachada',
    probability: 20
  },
  {
    id: 'lead-2',
    name: 'Clínica Bella Vita',
    contact_name: 'Dra. Vanessa Martins',
    phone: '(11) 99123-5566',
    stage: 'QUALIFICACAO',
    estimated_value: 680000,
    project_type: 'Construção Comercial / Saúde',
    probability: 45
  },
  {
    id: 'lead-3',
    name: 'Galpão Logístico Cajamar V',
    contact_name: 'Marcio Souza (Diretor de Expansão)',
    phone: '(11) 97654-9988',
    stage: 'PROPOSTA',
    estimated_value: 4300000,
    project_type: 'Galpão Pré-Moldado',
    probability: 80
  },
  {
    id: 'lead-4',
    name: 'Residência Alphaville Lote 14',
    contact_name: 'Carlos e Helena Peixoto',
    phone: '(11) 98112-4433',
    stage: 'FECHADO',
    estimated_value: 2150000,
    project_type: 'Casa de Alto Padrão (650m²)',
    probability: 100
  }
];

const INITIAL_TICKETS: ServiceTicket[] = [
  {
    id: 'tkt-01',
    project_name: 'Residencial Alpha Tower',
    unit_number: 'Apto 142',
    client_name: 'Mariana Duarte',
    title: 'Infiltração na junta de dilatação da sacada gourmet',
    category: 'INFILTRACAO',
    priority: 'CRITICA',
    sla_status: 'RISCO',
    days_open: 2
  },
  {
    id: 'tkt-02',
    project_name: 'Residencial Alpha Tower',
    unit_number: 'Apto 61',
    client_name: 'Felipe Queiroz',
    title: 'Desarme recorrente do disjuntor DR no chuveiro suíte',
    category: 'ELETRICA',
    priority: 'ALTA',
    sla_status: 'DENTRO_PRAZO',
    days_open: 1
  },
  {
    id: 'tkt-03',
    project_name: 'Edifício Infinity Plaza',
    unit_number: 'Sala 904',
    client_name: 'Advocacia Pinheiro',
    title: 'Retoque de pintura no teto pós-vazamento de ar-condicionado',
    category: 'PINTURA',
    priority: 'MEDIA',
    sla_status: 'DENTRO_PRAZO',
    days_open: 4
  },
  {
    id: 'tkt-04',
    project_name: 'Condomínio Grand Village',
    unit_number: 'Casa 18',
    client_name: 'Eduardo Silveira',
    title: 'Fissura aparente no rodapé do muro de arrimo',
    category: 'ESTRUTURAL',
    priority: 'CRITICA',
    sla_status: 'ESTOURADO',
    days_open: 7
  }
];

export default function CRMClient() {
  const [activeTab, setActiveTab] = useState<'KANBAN' | 'TICKETS'>('KANBAN');
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [tickets] = useState<ServiceTicket[]>(INITIAL_TICKETS);
  const [searchTerm, setSearchTerm] = useState('');

  // Move Lead entre os estágios do Kanban
  const moveLead = (leadId: string, targetStage: Lead['stage']) => {
    setLeads(prev => prev.map(lead => {
      if (lead.id === leadId) {
        let prob = 20;
        if (targetStage === 'QUALIFICACAO') prob = 45;
        if (targetStage === 'PROPOSTA') prob = 80;
        if (targetStage === 'FECHADO') prob = 100;
        return { ...lead, stage: targetStage, probability: prob };
      }
      return lead;
    }));
  };

  const stages: { key: Lead['stage']; title: string; color: string }[] = [
    { key: 'NOVO', title: 'Novos Contatos', color: 'border-blue-500' },
    { key: 'QUALIFICACAO', title: 'Em Qualificação Técnica', color: 'border-amber-500' },
    { key: 'PROPOSTA', title: 'Proposta Comercial Apresentada', color: 'border-purple-500' },
    { key: 'FECHADO', title: 'Contrato Assinado / Ganho', color: 'border-emerald-500' }
  ];

  const totalPipeline = leads.reduce((acc, curr) => acc + curr.estimated_value, 0);
  const totalGarantiasCriticas = tickets.filter(t => t.priority === 'CRITICA').length;

  return (
    <PaywallBlocker moduleName="CRM">
      <div className="space-y-6">
        {/* Header Executivo */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                CRM & Pós-Obra
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                Fase 17 • Garantia & Vendas
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Funil comercial de novos empreendimentos e central de assistência técnica com SLA de garantia.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button className="px-3 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm">
              <Plus className="w-4 h-4" />
              {activeTab === 'KANBAN' ? 'Novo Lead Comercial' : 'Abrir Chamado Pós-Obra'}
            </button>
          </div>
        </div>

        {/* Métricas Topo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Pipeline Total</span>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-2">
              R$ {totalPipeline.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-emerald-600 font-medium">
              {leads.length} oportunidades em andamento
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Taxa de Conversão</span>
              <Target className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-2">
              34.8%
            </div>
            <span className="text-[11px] text-slate-500">
              Média do último trimestre
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Chamados Ativos</span>
              <Wrench className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-2">
              {tickets.length}
            </div>
            <span className="text-[11px] text-blue-600 font-medium">
              Assistência pós-entrega
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">SLA Crítico / Alerta</span>
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-black text-rose-600 mt-2">
              {totalGarantiasCriticas} chamado(s)
            </div>
            <span className="text-[11px] text-rose-500 font-medium">
              Exigem visita técnica imediata
            </span>
          </div>
        </div>

        {/* Abas */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('KANBAN')}
              className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
                activeTab === 'KANBAN'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              Funil Comercial (Kanban)
            </button>
            <button
              onClick={() => setActiveTab('TICKETS')}
              className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
                activeTab === 'TICKETS'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Wrench className="w-4 h-4" />
              Chamados de Garantia (Pós-Obra)
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {tickets.length}
              </span>
            </button>
          </div>

          <div className="relative pb-2">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar cliente ou chamado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Conteúdo Aba 1: Kanban Funil Comercial */}
        {activeTab === 'KANBAN' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {stages.map((stage) => {
              const stageLeads = leads.filter(l => l.stage === stage.key);
              const stageTotal = stageLeads.reduce((acc, c) => acc + c.estimated_value, 0);

              return (
                <div 
                  key={stage.key}
                  className="bg-slate-50/70 dark:bg-slate-900/40 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 flex flex-col min-h-[500px]"
                >
                  <div className={`border-t-4 ${stage.color} pt-2 mb-3`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        {stage.title}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {stageLeads.length}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                      R$ {stageTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                    </div>
                  </div>

                  {/* Cards de Leads */}
                  <div className="space-y-3 flex-1">
                    {stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-2 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                            {lead.name}
                          </h4>
                          {lead.probability >= 80 && (
                            <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          )}
                        </div>

                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          {lead.project_type}
                        </div>

                        <div className="text-xs font-black text-purple-600 dark:text-purple-400">
                          R$ {lead.estimated_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <PhoneCall className="w-3 h-3 text-slate-400" />
                            {lead.contact_name.split(' ')[0]}
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {lead.probability}%
                          </span>
                        </div>

                        {/* Botões de Transição Rápida */}
                        <div className="pt-1 flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          {stage.key !== 'NOVO' && (
                            <button
                              onClick={() => {
                                const prevIdx = stages.findIndex(s => s.key === stage.key) - 1;
                                moveLead(lead.id, stages[prevIdx].key);
                              }}
                              className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300"
                            >
                              ← Voltar
                            </button>
                          )}
                          {stage.key !== 'FECHADO' && (
                            <button
                              onClick={() => {
                                const nextIdx = stages.findIndex(s => s.key === stage.key) + 1;
                                moveLead(lead.id, stages[nextIdx].key);
                              }}
                              className="text-[10px] px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/80 hover:bg-purple-200 text-purple-700 dark:text-purple-300 font-semibold"
                            >
                              Avançar →
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Conteúdo Aba 2: Chamados de Garantia Pós-Obra */}
        {activeTab === 'TICKETS' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Matriz de Atendimento & SLA de Garantia (Norma ABNT NBR 15575)
                </h3>
                <p className="text-xs text-slate-500">
                  Acompanhamento de prazos legais de atendimento técnico por tipo de patologia construtiva.
                </p>
              </div>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-900">
                  <th className="p-3.5">Chamado / Empreendimento</th>
                  <th className="p-3.5">Cliente / Unidade</th>
                  <th className="p-3.5">Patologia / Categoria</th>
                  <th className="p-3.5">Prioridade</th>
                  <th className="p-3.5">Status SLA</th>
                  <th className="p-3.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {tickets.map((tkt) => (
                  <tr key={tkt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {tkt.title}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {tkt.project_name}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {tkt.client_name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {tkt.unit_number}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {tkt.category}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        tkt.priority === 'CRITICA'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : tkt.priority === 'ALTA'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      }`}>
                        {tkt.priority}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        {tkt.sla_status === 'ESTOURADO' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                            <AlertCircle className="w-3 h-3" />
                            Prazo Estourado ({tkt.days_open}d)
                          </span>
                        ) : tkt.sla_status === 'RISCO' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            <Clock className="w-3 h-3" />
                            Vence em 24h ({tkt.days_open}d)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            No Prazo ({tkt.days_open}d)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 text-right">
                      <button className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 text-xs transition-colors">
                        Agendar Vistoria
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PaywallBlocker>
  );
}
