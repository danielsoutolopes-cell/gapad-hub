'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Receipt,
  FileCheck2,
  FileText,
  DollarSign,
  Building2,
  Calendar,
  Search,
  Filter,
  ExternalLink,
  ShieldCheck,
  Percent,
  Download,
  AlertCircle,
  Plus,
  Loader2,
  Scale,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface FiscalInvoiceItem {
  id: string;
  number: number;
  series: string;
  access_key: string;
  invoice_type: string;
  environment: string;
  status: string;
  protocol_number?: string;
  authorized_at: string;
  taker_name: string;
  taker_document: string;
  project_name: string;
  project_code?: string;
  client_name: string;
  service_description: string;
  gross_amount: number;
  net_amount: number;
  iss_rate: number;
  iss_amount: number;
  iss_retained: boolean;
  iss_retained_amount: number;
  inss_retained_amount: number;
  xml_url?: string;
  pdf_url?: string;
}

interface FiscalTotals {
  total_gross: number;
  total_net: number;
  total_iss_retained: number;
  total_iss_own: number;
  total_inss_retained: number;
  total_federal_retained: number;
  total_taxes_retained: number;
}

interface FiscalApiResponse {
  items: FiscalInvoiceItem[];
  total_count: number;
  totals: FiscalTotals;
}

export function FiscalHubClient() {
  const supabase = createClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);

  // Busca lista de notas fiscais com totalizadores
  const { data, isLoading, refetch } = useQuery<FiscalApiResponse>({
    queryKey: ['fiscal_invoices_hub', selectedType, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedType !== 'all') params.append('type', selectedType);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);

      const res = await fetch(`/api/v1/fiscal/invoices?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Falha ao consultar painel fiscal');
      }
      return res.json();
    },
  });

  const invoices = data?.items || [];
  const totals = data?.totals || {
    total_gross: 0,
    total_net: 0,
    total_iss_retained: 0,
    total_iss_own: 0,
    total_inss_retained: 0,
    total_federal_retained: 0,
    total_taxes_retained: 0,
  };

  // Filtro client-side por texto (número, chave, tomador, obra)
  const filteredInvoices = invoices.filter((inv) => {
    const term = searchTerm.toLowerCase();
    const matchNumber = String(inv.number).includes(term);
    const matchKey = inv.access_key?.toLowerCase().includes(term);
    const matchTaker = inv.taker_name?.toLowerCase().includes(term);
    const matchProject = inv.project_name?.toLowerCase().includes(term);
    return matchNumber || matchKey || matchTaker || matchProject;
  });

  // Helper para abrir PDF com Presigned URL do Supabase Storage
  const handleOpenPdf = async (inv: FiscalInvoiceItem) => {
    try {
      setLoadingPdfId(inv.id);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const tenantId =
        session?.user?.app_metadata?.tenant_id || session?.user?.user_metadata?.tenant_id;

      if (inv.access_key && tenantId) {
        const filePath = `${tenantId}/${inv.access_key}.pdf`;
        const { data: signed, error: signError } = await supabase.storage
          .from('xml-fiscais')
          .createSignedUrl(filePath, 3600);

        if (!signError && signed?.signedUrl) {
          window.open(signed.signedUrl, '_blank', 'noopener,noreferrer');
          setLoadingPdfId(null);
          return;
        }
      }

      if (inv.pdf_url) {
        window.open(inv.pdf_url, '_blank', 'noopener,noreferrer');
      } else {
        alert('URL do PDF não disponível no momento.');
      }
    } catch (e: any) {
      console.error('Falha ao abrir PDF da nota:', e);
      if (inv.pdf_url) {
        window.open(inv.pdf_url, '_blank', 'noopener,noreferrer');
      }
    } finally {
      setLoadingPdfId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER DA CENTRAL FISCAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
              Backoffice Fiscal & Faturamento
            </span>
            <span className="text-xs text-slate-400">• Padrão Nacional & Reforma Tributária</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Receipt className="w-7 h-7 text-purple-400" />
            Central Fiscal
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Painel unificado de emissão, acompanhamento e conformidade fiscal de todas as obras,
            retenções tributárias na fonte (ISS, INSS, Federais) e créditos da Reforma Tributária.
          </p>
        </div>

        {/* AÇÕES DE EMISSÃO RÁPIDA */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/dashboard/fiscal/emitir-nfse"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-600/25 border border-purple-400/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Emitir NFS-e (Serviço)</span>
          </Link>

          <Link
            href="/dashboard/fiscal/emitir-nfe"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-sky-200 bg-sky-950/60 hover:bg-sky-900/60 border border-sky-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <FileText className="w-4 h-4 text-sky-400" />
            <span>Emitir NF-e (Material)</span>
          </Link>

          <Link
            href="/dashboard/fiscal/simulador-reforma"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 transition-all"
            title="Simulador IVA Dual"
          >
            <Scale className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Simulador IVA</span>
          </Link>
        </div>
      </div>

      {/* TOTALIZADORES FISCAIS EM CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Faturamento Bruto */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800 p-4 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all" />
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-2">
            <span>Faturamento Bruto Emitido</span>
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            R$ {totals.total_gross.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <span className="font-semibold text-purple-300">{data?.total_count || 0}</span> documentos autorizados
          </div>
        </div>

        {/* Card 2: Valor Líquido Realizado */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800 p-4 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-2">
            <span>Valor Líquido Realizado</span>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileCheck2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            R$ {totals.total_net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Após retenções legais na fonte
          </div>
        </div>

        {/* Card 3: Total Retenções na Fonte */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800 p-4 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all" />
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-2">
            <span>Total Impostos Retidos</span>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
            R$ {totals.total_taxes_retained.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5 truncate">
            <span>ISS: R$ {totals.total_iss_retained.toFixed(0)}</span> • <span>INSS: R$ {totals.total_inss_retained.toFixed(0)}</span>
          </div>
        </div>

        {/* Card 4: ISS Próprio a Recolher */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800 p-4 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-2xl group-hover:bg-sky-500/10 transition-all" />
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-2">
            <span>ISS Próprio (Sede)</span>
            <span className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-sky-300 font-mono">
            R$ {totals.total_iss_own.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Competência territorial do prestador
          </div>
        </div>
      </div>

      {/* FILTROS E BUSCA */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Barra de Pesquisa */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por Nº da Nota, Chave, Tomador ou Obra..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
          />
        </div>

        {/* Controles de Filtro */}
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-purple-400" />
            <span>Filtros:</span>
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-purple-500"
          >
            <option value="all">Todos os Tipos</option>
            <option value="NFSE_NACIONAL">NFS-e Nacional (Serviço)</option>
            <option value="NFE_MATERIAL">NF-e (Materiais)</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-purple-500"
          >
            <option value="all">Todos os Status</option>
            <option value="autorizada">Autorizada</option>
            <option value="transmitindo">Transmitindo</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
      </div>

      {/* TABELA UNIFICADA DE NOTAS FISCAIS */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Documento / Tipo</th>
                <th className="py-3 px-4">Data Emissão</th>
                <th className="py-3 px-4">Obra / Tomador</th>
                <th className="py-3 px-4 text-right">Valor Bruto</th>
                <th className="py-3 px-4 text-right">Retenções (ISS/INSS)</th>
                <th className="py-3 px-4 text-right">Valor Líquido</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-400 mb-2" />
                    Carregando documentos fiscais unificados...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold text-slate-300">Nenhum documento fiscal encontrado</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {searchTerm
                        ? 'Nenhum resultado para os termos da busca.'
                        : 'Comece emitindo uma nota através dos botões de ação acima.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* Documento / Tipo */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 flex-shrink-0">
                          <Receipt className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>Nº {inv.number}</span>
                            <span className="text-[10px] font-normal text-slate-400">
                              (Série {inv.series})
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono truncate max-w-[130px]" title={inv.access_key}>
                            {inv.access_key}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Data Emissão */}
                    <td className="py-3 px-4 text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          {inv.authorized_at
                            ? new Date(inv.authorized_at).toLocaleDateString('pt-BR')
                            : '—'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {inv.authorized_at
                          ? new Date(inv.authorized_at).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </td>

                    {/* Obra / Tomador */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-200 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="truncate max-w-[180px]" title={inv.project_name}>
                          {inv.project_name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[180px]" title={inv.taker_name}>
                        {inv.taker_name}
                      </div>
                    </td>

                    {/* Valor Bruto */}
                    <td className="py-3 px-4 text-right font-mono font-medium text-white">
                      R$ {inv.gross_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Retenções */}
                    <td className="py-3 px-4 text-right font-mono">
                      {inv.iss_retained_amount > 0 || inv.inss_retained_amount > 0 ? (
                        <div>
                          <div className="text-amber-400 font-semibold">
                            - R$ {(inv.iss_retained_amount + inv.inss_retained_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {inv.iss_retained ? `ISS: ${inv.iss_rate}%` : ''}{' '}
                            {inv.inss_retained_amount > 0 ? '• INSS: 5%' : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Sem retenção</span>
                      )}
                    </td>

                    {/* Valor Líquido */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      R$ {inv.net_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.status === 'autorizada'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : inv.status === 'cancelada'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {inv.status}
                      </span>
                    </td>

                    {/* Ações */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenPdf(inv)}
                          disabled={loadingPdfId === inv.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-sky-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition-all disabled:opacity-50"
                          title="Visualizar DANFSE (PDF)"
                        >
                          {loadingPdfId === inv.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <FileText className="w-3 h-3 text-sky-400" />
                          )}
                          <span>PDF</span>
                        </button>

                        {inv.xml_url && (
                          <a
                            href={inv.xml_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800/60 text-purple-300 hover:bg-slate-700 hover:text-white border border-slate-700/80 transition-all"
                            title="Download XML"
                          >
                            <Download className="w-3 h-3 text-purple-400" />
                            <span>XML</span>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
