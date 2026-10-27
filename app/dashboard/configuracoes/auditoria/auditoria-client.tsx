'use client';

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  History, 
  Search, 
  Filter, 
  Trash2, 
  Edit, 
  PlusCircle, 
  User, 
  Calendar, 
  Clock, 
  Lock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface AuditLogEntry {
  id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
  table_name: string;
  record_id: string;
  description: string;
  created_at: string;
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
}

const INITIAL_LOGS: AuditLogEntry[] = [
  {
    id: 'log-01',
    user_name: 'Daniel Lopes',
    user_email: 'daniel@engenhariagadap.com.br',
    user_role: 'Tenant_Admin',
    action: 'DELETE',
    table_name: 'quotes',
    record_id: 'cot-9912',
    description: 'Deletou o Orçamento #9912 (Fornecedor Cerâmica Sul) com valor de R$ 42.000,00',
    created_at: '27/10/2026 17:42:10',
    old_data: { quote_id: 'cot-9912', amount: 42000.0, supplier: 'Cerâmica Sul' }
  },
  {
    id: 'log-02',
    user_name: 'Mariana Duarte',
    user_email: 'mariana.fin@engenhariagadap.com.br',
    user_role: 'Financeiro',
    action: 'STATUS_CHANGE',
    table_name: 'invoices',
    record_id: 'inv-4401',
    description: 'Marcou a NF-e 4401 como PAGO via Baixa Automática Open Finance Pluggy',
    created_at: '27/10/2026 16:30:00',
    old_data: { status: 'OPEN' },
    new_data: { status: 'PAID', paid_amount: 145000.00 }
  },
  {
    id: 'log-03',
    user_name: 'Eng. Ricardo Silveira',
    user_email: 'ricardo@engenhariagadap.com.br',
    user_role: 'Engenheiro_Campo',
    action: 'UPDATE',
    table_name: 'subcontract_measurements',
    record_id: 'med-004',
    description: 'Aprovou Medição de Alvenaria Estrutural (Avanço de 35% para 42%)',
    created_at: '27/10/2026 14:15:22',
    old_data: { percentage: 35.0 },
    new_data: { percentage: 42.0 }
  },
  {
    id: 'log-04',
    user_name: 'Daniel Lopes',
    user_email: 'daniel@engenhariagadap.com.br',
    user_role: 'Tenant_Admin',
    action: 'CREATE',
    table_name: 'companies_modules',
    record_id: 'mod-sup',
    description: 'Ativou o Módulo de Suprimentos & Almoxarifado para a empresa',
    created_at: '27/10/2026 11:00:15',
    new_data: { module: 'SUPRIMENTOS', activated_by: 'Tenant_Admin' }
  }
];

export default function AuditoriaClient() {
  const [logs] = useState<AuditLogEntry[]>(INITIAL_LOGS);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter(log => 
    log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.table_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Governança */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Trilha de Auditoria (Audit Trail)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
              Role: Tenant_Admin Only
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Registro cronológico imutável com rastreabilidade de todas as mutações e exclusões no ERP.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold">
            <ShieldCheck className="w-4 h-4" />
            Rastreamento Criptográfico Ativo
          </span>
        </div>
      </div>

      {/* Barra de Filtro */}
      <div className="flex items-center justify-between gap-4 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrar por usuário, ação ou tabela (ex: deletou, quotes, Daniel)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-slate-500"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <History className="w-4 h-4 text-slate-400" />
          <span>{filteredLogs.length} eventos registrados</span>
        </div>
      </div>

      {/* Timeline de Eventos */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
        <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 space-y-8">
          {filteredLogs.map((log) => {
            const isExpanded = expandedLogId === log.id;

            return (
              <div key={log.id} className="relative pl-6 group">
                {/* Marcador do Ponto na Timeline */}
                <span className={`absolute -left-[13px] top-1 w-6 h-6 rounded-full flex items-center justify-center text-white border-2 border-white dark:border-slate-900 shadow-sm ${
                  log.action === 'DELETE'
                    ? 'bg-rose-500'
                    : log.action === 'STATUS_CHANGE'
                    ? 'bg-purple-500'
                    : log.action === 'CREATE'
                    ? 'bg-emerald-500'
                    : 'bg-blue-500'
                }`}>
                  {log.action === 'DELETE' && <Trash2 className="w-3 h-3" />}
                  {log.action === 'STATUS_CHANGE' && <Clock className="w-3 h-3" />}
                  {log.action === 'CREATE' && <PlusCircle className="w-3 h-3" />}
                  {log.action === 'UPDATE' && <Edit className="w-3 h-3" />}
                </span>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/60 transition-all">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {log.user_name}
                      </span>
                      <span className="text-xs text-slate-400">({log.user_email})</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {log.user_role}
                      </span>
                    </div>

                    <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {log.created_at}
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-2">
                    {log.description}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[11px] font-mono text-slate-400">
                      Tabela: <strong className="text-slate-600 dark:text-slate-300">{log.table_name}</strong> | ID: {log.record_id}
                    </span>

                    {(log.old_data || log.new_data) && (
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 hover:underline"
                      >
                        {isExpanded ? (
                          <>Ocultar Detalhes <ChevronUp className="w-3 h-3" /></>
                        ) : (
                          <>Ver Payload Técnico <ChevronDown className="w-3 h-3" /></>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Dropdown Payload JSON */}
                  {isExpanded && (
                    <div className="mt-3 p-3 bg-slate-950 text-slate-200 rounded-lg text-xs font-mono space-y-2 overflow-x-auto">
                      {log.old_data && (
                        <div>
                          <div className="text-rose-400 font-bold mb-1">// Estado Anterior (old_data)</div>
                          <pre>{JSON.stringify(log.old_data, null, 2)}</pre>
                        </div>
                      )}
                      {log.new_data && (
                        <div>
                          <div className="text-emerald-400 font-bold mb-1">// Novo Estado (new_data)</div>
                          <pre>{JSON.stringify(log.new_data, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
