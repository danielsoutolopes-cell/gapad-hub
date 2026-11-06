'use client';

import React, { useState } from 'react';
import NextLink from 'next/link';
import {
  Sparkles,
  ArrowLeft,
  Share2,
  Copy,
  MessageSquare,
  CheckCircle2,
  Package,
  MapPin,
  Send,
  ExternalLink,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface RecognizedItem {
  raw_input: string;
  catalog_name: string;
  category: string;
  unit: string;
  quantity: number;
  confidence_score: number;
  matched_catalog: boolean;
}

export default function RequisicaoMateriaisPage() {
  const [rawText, setRawText] = useState(
    '20 sacos de cimento cp2\n50m de fio 2.5mm verde\n5 tubos pvc 100mm\n1 lata tinta acrilica branca'
  );
  const [targetLocation, setTargetLocation] = useState('Canteiro Lorena - Torre A');
  const [isLoading, setIsLoading] = useState(false);
  const [recognizedItems, setRecognizedItems] = useState<RecognizedItem[]>([]);
  const [supplierLinkHash, setSupplierLinkHash] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

  const handleParseText = async () => {
    if (!rawText.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/procurement/requests/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_text: rawText,
          target_location: targetLocation,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRecognizedItems(data.recognized_items);
        setSupplierLinkHash(data.supplier_link_hash);
      }
    } catch (err) {
      console.error('Erro ao interpretar texto:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getPublicUrl = () => {
    if (!supplierLinkHash) return '';
    return `${window.location.origin}/fornecedor/cotacao/${supplierLinkHash}`;
  };

  const copyLinkToClipboard = () => {
    navigator.clipboard.writeText(getPublicUrl());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const shareViaWhatsApp = () => {
    const text = `*SOLICITAÇÃO DE COTAÇÃO - GADAP Hub*\nLocal de Entrega: ${targetLocation}\n\nFavor preencher sua proposta pelo link:\n${getPublicUrl()}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <NextLink
            href="/dashboard/suprimentos"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar para Suprimentos</span>
          </NextLink>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <Package className="w-6 h-6 text-emerald-400" />
            <span>Nova Requisição com IA & Catálogo Mestre</span>
          </h1>
          <p className="text-xs text-slate-400">
            Digite ou cole pedidos informais do canteiro. A IA cruza com o Catálogo Mestre de 50 insumos e gera links dinâmicos para fornecedores.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <NextLink
            href="/dashboard/suprimentos"
            className="px-4 py-2 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-semibold text-slate-200"
          >
            Ver Mapa de Cotações
          </NextLink>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Coluna Esquerda: Entrada de Dados e NLP */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>Local de Entrega / Canteiro</span>
              </label>
              <input
                type="text"
                value={targetLocation}
                onChange={(e) => setTargetLocation(e.target.value)}
                placeholder="Ex: Canteiro Lorena - Bloco B"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Itens Desejados (Texto Livre ou Lista)</span>
                </label>
                <span className="text-[10px] text-slate-500">Reconhecimento NLP Ativo</span>
              </div>
              <textarea
                rows={6}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Cole mensagens de WhatsApp ou digite os insumos..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              onClick={handleParseText}
              disabled={isLoading || !rawText.trim()}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
            >
              {isLoading ? (
                <span>Reconhecendo no Catálogo Mestre...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Processar com IA & Gerar RFQ</span>
                </>
              )}
            </button>
          </div>

          {/* Dica Contextual */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
            <HelpCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              O motor de IA identifica automaticamente insumos elétricos, hidráulicos, civis e EPIs vinculando à base SINAPI/Catálogo Mestre pré-semeada.
            </p>
          </div>
        </div>

        {/* Coluna Direita: Itens Reconhecidos & Portal do Fornecedor */}
        <div className="lg:col-span-7 space-y-6">
          {recognizedItems.length > 0 ? (
            <div className="space-y-6">
              {/* Card de Disparo e Compartilhamento */}
              {supplierLinkHash && (
                <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold text-emerald-300">Link Dinâmico de Cotação Ativo</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">{supplierLinkHash}</span>
                  </div>

                  <p className="text-xs text-slate-300">
                    Compartilhe este link com lojas e fornecedores. Eles poderão preencher preços unitários, descontos e fretes sem precisar de login.
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={shareViaWhatsApp}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{copiedWhatsApp ? 'Abrindo WhatsApp...' : 'Enviar via WhatsApp'}</span>
                    </button>

                    <button
                      onClick={copyLinkToClipboard}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border border-slate-700"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link de Cotação'}</span>
                    </button>

                    <a
                      href={getPublicUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-800"
                    >
                      <span>Testar Visão Fornecedor</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Tabela de Itens Reconhecidos */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>Itens Mapeados no Catálogo ({recognizedItems.length})</span>
                  </h2>
                  <span className="text-xs text-slate-400">Entrega: {targetLocation}</span>
                </div>

                <div className="space-y-3">
                  {recognizedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-emerald-400 border border-slate-800">
                            {item.category}
                          </span>
                          <span className="text-xs font-bold text-white">{item.catalog_name}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 italic">
                          Texto original: &ldquo;{item.raw_input}&rdquo;
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="text-sm font-extrabold text-white">
                          {item.quantity} {item.unit}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-emerald-400 justify-end">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Mapeado</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500 space-y-3">
              <Package className="w-12 h-12 text-slate-700" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-400">Nenhum item processado</p>
                <p className="text-xs text-slate-600 max-w-sm">
                  Digite a lista de insumos ao lado e clique em &ldquo;Processar com IA & Gerar RFQ&rdquo; para estruturar os dados e gerar os links de cotação.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

