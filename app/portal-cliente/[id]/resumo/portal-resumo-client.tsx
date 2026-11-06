'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Building2,
  TrendingUp,
  Image as ImageIcon,
  FileCheck,
  CheckCircle2,
  Calendar,
  Clock,
  DollarSign,
  MapPin,
  HardHat,
  ChevronRight,
  Maximize2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  FileText,
  Loader2,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

export function PortalResumoClient({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState<'resumo' | 'galeria' | 'aditivos'>('resumo');
  const [summary, setSummary] = useState<any>(null);
  const [curveData, setCurveData] = useState<any>(null);
  const [gallery, setGallery] = useState<any>(null);
  const [amendments, setAmendments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de Assinatura Gov.br
  const [signingId, setSigningId] = useState<string | null>(null);
  const [signatureSuccess, setSignatureSuccess] = useState<any | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);

  const loadPortalData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, curveRes, galRes, amdRes] = await Promise.all([
        fetch(`/api/v1/portal/projects/${projectId}/summary`).catch(() => null),
        fetch(`/api/v1/portal/projects/${projectId}/curve-s`).catch(() => null),
        fetch(`/api/v1/portal/projects/${projectId}/gallery`).catch(() => null),
        fetch(`/api/v1/portal/projects/${projectId}/amendments`).catch(() => null),
      ]);

      if (sumRes && sumRes.ok) setSummary(await sumRes.json());
      if (curveRes && curveRes.ok) setCurveData(await curveRes.json());
      if (galRes && galRes.ok) setGallery(await galRes.json());
      if (amdRes && amdRes.ok) {
        const aData = await amdRes.json();
        setAmendments(aData.amendments || []);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  // Ação de Assinatura Gov.br (Prompt 71 / Prompt 93)
  const handleSignGovBr = async (amendmentId: string) => {
    setSigningId(amendmentId);
    setSignatureSuccess(null);
    try {
      const res = await fetch(
        `/api/v1/portal/projects/${projectId}/amendments/${amendmentId}/sign-govbr`,
        { method: 'POST' }
      );
      if (res.ok) {
        const data = await res.json();
        setSignatureSuccess(data);
        setAmendments((prev) =>
          prev.map((a) =>
            a.id === amendmentId
              ? {
                  ...a,
                  status: 'APROVADO',
                  signed_govbr: true,
                  govbr_signature_hash: data.govbr_certificate.hash,
                }
              : a
          )
        );
      }
    } catch {
      alert('Falha ao autenticar assinatura Gov.br. Tente novamente.');
    } finally {
      setSigningId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
        <p className="text-xs text-slate-400">Carregando painel de transparência da sua obra...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CARD DE IDENTIFICAÇÃO DO PROJETO */}
      {summary && (
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest block mb-1">
                Empreendimento em Construção
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {summary.project_name}
              </h1>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{summary.address}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono">
                {summary.engineer_in_charge}
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-semibold">
                Previsão de Entrega: {new Date(summary.expected_completion_date).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>

          {/* INDICADORES PRINCIPAIS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800/80">
            <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Avanço Físico</span>
              <span className="text-xl font-extrabold text-amber-400 font-mono mt-0.5 block">
                {summary.physical_progress_pct}%
              </span>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Avanço Financeiro</span>
              <span className="text-xl font-extrabold text-emerald-400 font-mono mt-0.5 block">
                {summary.financial_progress_pct}%
              </span>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Valor Contratado</span>
              <span className="text-base sm:text-lg font-bold text-white font-mono mt-0.5 block">
                {formatBRL(summary.total_contract_value)}
              </span>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Liquidado</span>
              <span className="text-base sm:text-lg font-bold text-white font-mono mt-0.5 block">
                {formatBRL(summary.total_paid_to_date)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SELETOR DE NAVEGAÇÃO DA VISÃO DO CLIENTE */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('resumo')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'resumo'
              ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Avanço Físico-Financeiro (Curva S)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('galeria')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'galeria'
              ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Diário de Obras & Fotos Diárias</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('aditivos')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 relative ${
            activeTab === 'aditivos'
              ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Aditivos Contratuais & Assinatura Gov.br</span>
          {amendments.some((a) => !a.signed_govbr) && (
            <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1 right-1 animate-pulse" />
          )}
        </button>
      </div>

      {/* FEEDBACK DE ASSINATURA GOV.BR */}
      {signatureSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start justify-between gap-3 text-xs text-emerald-300">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block text-emerald-200">
                Aditivo Contratual Homologado com Sucesso!
              </strong>
              <span>
                Certificado digital emitido: {signatureSuccess.govbr_certificate.hash} (Validade
                jurídica plena via ICP-Brasil).
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSignatureSuccess(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ABA 1: RESUMO & CURVA S */}
      {activeTab === 'resumo' && curveData && (
        <div className="space-y-6">
          {/* GRÁFICO DA CURVA S */}
          <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800/80 shadow-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                Evolução Comparativa da Construção (Planejado vs. Realizado)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Acompanhe o cronograma planejado (linha azul) em confronto direto com os marcos físicos e financeiros liberados (linha verde).
              </p>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={curveData.points} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="period" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} unit="%" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '12px' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                    formatter={(val: any, name: any) => [`${val}%`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Line
                    type="monotone"
                    dataKey="planned_pct"
                    name="% Planejado Contratual"
                    stroke="#38bdf8"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#38bdf8' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="realized_pct"
                    name="% Executado e Concluído"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#10b981' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* DESTAQUES RECENTES */}
          {summary?.recent_highlights && (
            <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800/80 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Últimos Marcos Técnicos Concluídos no Canteiro
              </h3>
              <div className="space-y-2 text-xs text-slate-300">
                {summary.recent_highlights.map((h: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 2: DIÁRIO DE OBRAS & GALERIA DE FOTOS */}
      {activeTab === 'galeria' && gallery && (
        <div className="space-y-6">
          {gallery.reports.map((rep: any) => (
            <div
              key={rep.id}
              className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800/80 space-y-4 shadow-xl"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                <div>
                  <span className="text-[11px] font-mono font-bold text-amber-400 block">
                    {new Date(rep.date).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                  <h3 className="text-base font-bold text-white mt-0.5">{rep.title}</h3>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-950 text-slate-400 border border-slate-800">
                  {rep.weather}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{rep.description}</p>

              {/* GRID DE FOTOS DO DIA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                {rep.photos.map((photo: any) => (
                  <div
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo)}
                    className="group relative rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950 cursor-pointer aspect-video"
                  >
                    <img
                      src={photo.url}
                      alt={photo.caption}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90 p-3 flex flex-col justify-end">
                      <span className="text-[11px] text-white font-medium line-clamp-2 drop-shadow">
                        {photo.caption}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {photo.taken_at}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ABA 3: ADITIVOS CONTRATUAIS & ASSINATURA GOV.BR */}
      {activeTab === 'aditivos' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              Todos os aditivos gerados possuem conformidade legal. A assinatura via Gov.br confere presunção de autenticidade jurídica (Art. 5º da Lei Federal nº 14.063/2020).
            </span>
          </div>

          <div className="space-y-4">
            {amendments.map((amd) => (
              <div
                key={amd.id}
                className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800/80 shadow-xl space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {amd.code}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          amd.signed_govbr
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {amd.signed_govbr ? 'ASSINADO VIA GOV.BR' : 'AGUARDANDO SUA ASSINATURA'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-2">{amd.title}</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-2xl">{amd.justification}</p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Impacto Financeiro
                    </span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">
                      +{formatBRL(amd.financial_impact)}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">
                      Prazo: +{amd.deadline_impact_days} dias
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                  <a
                    href={amd.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>Visualizar Minuta em PDF</span>
                  </a>

                  {!amd.signed_govbr ? (
                    <button
                      type="button"
                      disabled={signingId === amd.id}
                      onClick={() => handleSignGovBr(amd.id)}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 cursor-pointer transition-all disabled:opacity-50"
                    >
                      {signingId === amd.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                      <span>Assinar via Gov.br</span>
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 font-mono">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Assinado Digitalmente ({amd.govbr_signature_hash?.slice(0, 18)}...)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL DE FOTO EXPANDIDA */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.caption}
              className="w-full max-h-[70vh] object-contain bg-black"
            />
            <div className="p-5 border-t border-slate-800 space-y-1">
              <h4 className="text-sm font-bold text-white">{selectedPhoto.caption}</h4>
              <span className="text-xs text-slate-400 font-mono block">
                Registro efetuado em {selectedPhoto.taken_at}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

