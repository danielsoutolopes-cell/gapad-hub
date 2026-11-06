'use client';

import React, { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Truck,
  DollarSign,
  PackageCheck,
  Send,
  AlertCircle,
  Calendar,
  MapPin,
} from 'lucide-react';

interface PageProps {
  params: {
    hash: string;
  };
}

export default function SupplierPublicQuotePage({ params }: PageProps) {
  const hash = params.hash;
  const [supplierName, setSupplierName] = useState('');
  const [supplierDocument, setSupplierDocument] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Boleto 28 dias');
  const [deliveryDays, setDeliveryDays] = useState(3);
  const [subtotal, setSubtotal] = useState(1500.0);
  const [discountAmount, setDiscountAmount] = useState(50.0);
  const [freightAmount, setFreightAmount] = useState(80.0);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const netTotal = Math.max(0, subtotal - discountAmount + freightAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/procurement/suppliers/quotes/${hash}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_name: supplierName,
          supplier_document: supplierDocument,
          supplier_phone: supplierPhone,
          unit_price: subtotal,
          total_amount: subtotal,
          discount_amount: discountAmount,
          freight_amount: freightAmount,
          delivery_days: deliveryDays,
          payment_terms: paymentTerms,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      }
    } catch (err) {
      console.error('Falha ao enviar proposta:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-emerald-500/30 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-extrabold text-white">Proposta Enviada com Sucesso!</h1>
          <p className="text-xs text-slate-300">
            Agradecemos a sua cotação, <span className="font-bold text-white">{supplierName}</span>. O time de compras da construtora já recebeu a sua proposta comercial e o valor líquido total de{' '}
            <span className="font-bold text-emerald-400">
              {netTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>.
          </p>
          <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 font-mono">
            Código do Mapa: {hash}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header Institucional */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Portal do Fornecedor • Solicitação de Cotação</h1>
                <p className="text-xs text-slate-400">Construtora: TESTE Engenharia</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
              {hash}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Local de Entrega: Canteiro Lorena - Jardins</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Prazo Desejado: Até 3 dias úteis</span>
            </div>
          </div>
        </div>

        {/* Formulário Comercial do Fornecedor */}
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white border-b border-slate-800 pb-3 flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-emerald-400" />
            <span>Dados da Sua Empresa & Proposta Comercial</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Razão Social / Nome Fantasia *</label>
              <input
                type="text"
                required
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Ex: Comercial Elétrica Aliança Ltda"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">CNPJ / CPF</label>
              <input
                type="text"
                value={supplierDocument}
                onChange={(e) => setSupplierDocument(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">WhatsApp / Telefone de Contato</label>
              <input
                type="text"
                value={supplierPhone}
                onChange={(e) => setSupplierPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Condições de Pagamento</label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="Ex: À Vista PIX ou Boleto 28 dias"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Matemática Comercial: Subtotal, Desconto (-) e Frete (+) */}
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Composição de Valores da Proposta
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Subtotal dos Itens (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={subtotal}
                  onChange={(e) => setSubtotal(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-emerald-400">Desconto Comercial (-) (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-emerald-500/40 rounded-xl px-3.5 py-2 text-xs text-emerald-300 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-amber-400">Valor do Frete (+) (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={freightAmount}
                  onChange={(e) => setFreightAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3.5 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-xs font-bold text-slate-300">Valor Líquido Total Proposto:</span>
              <span className="text-lg font-extrabold text-white">
                {netTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !supplierName.trim()}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
          >
            {isSubmitting ? (
              <span>Transmitindo Proposta...</span>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Enviar Cotação para a Construtora</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
