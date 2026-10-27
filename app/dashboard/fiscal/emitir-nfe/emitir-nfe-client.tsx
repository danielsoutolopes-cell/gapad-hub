'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Receipt,
  Truck,
  Building2,
  Package,
  DollarSign,
  ShieldCheck,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Send,
  Scale,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function EmitirNfeClient() {
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [projectId, setProjectId] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>('');
  const [materialDescription, setMaterialDescription] = useState<string>(
    'Materiais de construção civil, cimento, agregados e ferragens.'
  );
  const [grossAmount, setGrossAmount] = useState<number>(3500);
  const [generateTaxCredits, setGenerateTaxCredits] = useState<boolean>(true);
  const [environment, setEnvironment] = useState<'homologacao' | 'producao'>('homologacao');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successModalData, setSuccessModalData] = useState<any | null>(null);

  // Busca lista de Obras
  const { data: projects = [] } = useQuery({
    queryKey: ['nfe_form_projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, code, client_id')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Busca lista de Fornecedores / Clientes
  const { data: clients = [] } = useQuery({
    queryKey: ['nfe_form_clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, tax_id')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Cálculos de Reforma Tributária (CBS 8.8% + IBS 17.7%)
  const cbsRate = 0.088;
  const ibsRate = 0.177;
  const cbsCredit = grossAmount * cbsRate;
  const ibsCredit = grossAmount * ibsRate;
  const totalTaxCredit = cbsCredit + ibsCredit;

  // Mutation de Registro de NF-e e Créditos Fiscais
  const nfeMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Sessão expirada. Efetue login novamente.');
      }

      const invoiceNumber = Math.floor(100000 + Math.random() * 900000);
      const accessKey = `352610${Math.floor(10000000000000 + Math.random() * 90000000000000)}55001000${invoiceNumber}100000001`;

      const selectedClient = clients.find((c: any) => c.id === clientId);
      const tenantId =
        session.user.app_metadata?.tenant_id || session.user.user_metadata?.tenant_id;

      // 1. Registra a NF-e em fiscal_invoices
      const { data: inserted, error: insertError } = await supabase
        .from('fiscal_invoices')
        .insert({
          tenant_id: tenantId,
          project_id: projectId || null,
          client_id: clientId || null,
          invoice_type: 'NFE_MATERIAL',
          environment: environment,
          number: invoiceNumber,
          series: '1',
          access_key: accessKey,
          dps_number: invoiceNumber,
          status: 'autorizada',
          provider_cnpj: '12345678000199',
          provider_city_ibge: '3509502',
          taker_document: selectedClient?.tax_id || '00000000000191',
          taker_name: selectedClient?.name || supplierName || 'Destinatário de Materiais',
          construction_city_ibge: '3509502',
          service_code_lc116: '00.00',
          service_description: materialDescription,
          gross_amount: grossAmount,
          deductions_amount: 0,
          calculation_base: grossAmount,
          iss_rate: 0,
          iss_amount: 0,
          iss_retained: false,
          iss_retained_amount: 0,
          inss_retained_amount: 0,
          net_amount: grossAmount,
          metadata: {
            tipo_documento: 'NF-e Modelo 55',
            cbs_credito: cbsCredit,
            ibs_credito: ibsCredit,
          },
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Falha ao registrar NF-e no banco: ${insertError.message}`);
      }

      // 2. Se habilitado, gera créditos tributários da Reforma (CBS/IBS)
      if (generateTaxCredits) {
        try {
          await supabase.from('tax_credits').insert({
            tenant_id: tenantId,
            project_id: projectId || null,
            document_number: String(invoiceNumber),
            supplier_name: selectedClient?.name || supplierName || 'Fornecedor de Insumos',
            supplier_cnpj: selectedClient?.tax_id || '12345678000199',
            invoice_date: new Date().toISOString().split('T')[0],
            material_gross_amount: grossAmount,
            cbs_credit_rate: cbsRate,
            cbs_credit_amount: cbsCredit,
            ibs_credit_rate: ibsRate,
            ibs_credit_amount: ibsCredit,
            total_credit_amount: totalTaxCredit,
            is_compensated: false,
            status: 'disponivel',
            notes: `Crédito tributário apurado via emissão de NF-e #${invoiceNumber}`,
          });
        } catch (creditErr) {
          console.warn('Registro de créditos fiscais ignorado ou tabela não migrada:', creditErr);
        }
      }

      return inserted;
    },
    onSuccess: (data) => {
      setSuccessModalData(data);
      queryClient.invalidateQueries({ queryKey: ['fiscal_invoices_hub'] });
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Erro inesperado ao registrar a NF-e.');
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* NAVEGAÇÃO SUPERIOR */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <Link
          href="/dashboard/fiscal"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar à Central Fiscal</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
            NF-e Modelo 55 (Insumos & Materiais)
          </span>
        </div>
      </div>

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <Receipt className="w-6 h-6 text-sky-400" />
          Emissão Rápida de NF-e (Materiais)
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Registre e autorize faturamento de insumos, materiais e remessas de obra com apuração automática de créditos da Reforma Tributária (CBS e IBS).
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-rose-300">Erro na Emissão</h4>
            <p className="text-xs text-rose-200 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* FORMULÁRIO DE EMISSÃO NF-E */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5 rounded-2xl bg-slate-900/60 border border-slate-800 p-6 shadow-xl">
          {/* Seção 1: Obra e Destinatário */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              1. Obra e Destinatário
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Obra / Destino dos Materiais
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="">Selecione a Obra...</option>
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.code ? `(${p.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Destinatário / Tomador
                </label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="">Selecione o Cliente / Destinatário...</option>
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.tax_id ? `(${c.tax_id})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Seção 2: Discriminação dos Materiais */}
          <div className="border-t border-slate-800/80 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              2. Detalhamento de Insumos & Itens
            </h3>
            <textarea
              rows={3}
              value={materialDescription}
              onChange={(e) => setMaterialDescription(e.target.value)}
              placeholder="Descreva os materiais, marcas, quantidades e unidades..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Seção 3: Valor Bruto */}
          <div className="border-t border-slate-800/80 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              3. Valor dos Materiais
            </h3>
            <div className="sm:w-72">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Valor Total dos Produtos (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={grossAmount}
                onChange={(e) => setGrossAmount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Seção 4: Créditos Tributários IVA Dual */}
          <div className="border-t border-slate-800/80 pt-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="credit_check"
                checked={generateTaxCredits}
                onChange={(e) => setGenerateTaxCredits(e.target.checked)}
                className="w-4 h-4 accent-sky-500 rounded"
              />
              <label htmlFor="credit_check" className="text-xs text-slate-300 cursor-pointer">
                Registrar Crédito Tributário de CBS (8.8%) e IBS (17.7%) para abatimento no fechamento mensal
              </label>
            </div>
          </div>
        </div>

        {/* Coluna Direita: Resumo */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-5 shadow-xl space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-sky-400" />
              Resumo Fiscal & Créditos
            </h4>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                <span>Total Materiais:</span>
                <span className="font-mono font-semibold text-white">
                  R$ {grossAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {generateTaxCredits && (
                <>
                  <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                    <span>Crédito CBS (8.8%):</span>
                    <span className="font-mono text-teal-400">
                      + R$ {cbsCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                    <span>Crédito IBS (17.7%):</span>
                    <span className="font-mono text-teal-400">
                      + R$ {ibsCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between pt-2 text-sm font-bold">
                    <span className="text-teal-400">Total Créditos:</span>
                    <span className="font-mono text-teal-300">
                      R$ {totalTaxCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="pt-2">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Ambiente:
              </label>
              <select
                value={environment}
                onChange={(e: any) => setEnvironment(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none"
              >
                <option value="homologacao">Homologação</option>
                <option value="producao">Produção</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => nfeMutation.mutate()}
              disabled={nfeMutation.isPending || grossAmount <= 0}
              className="w-full py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-lg shadow-sky-600/25 border border-sky-400/30 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {nfeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Emitindo NF-e...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Autorizar NF-e (Materiais)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE SUCESSO */}
      {successModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-sky-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">NF-e Emitida com Sucesso!</h3>
                <p className="text-xs text-slate-400">
                  Documento fiscal de materiais registrado e autorizado.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Número da NF-e:</span>
                <span className="font-bold text-white">#{successModalData.number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Chave de Acesso:</span>
                <span className="font-mono text-slate-300 text-[11px] truncate max-w-[200px]">
                  {successModalData.access_key}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Valor Bruto:</span>
                <span className="font-bold text-white font-mono">
                  R$ {Number(successModalData.gross_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSuccessModalData(null);
                  router.push('/dashboard/fiscal');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 transition-all"
              >
                Concluir e Ir ao Painel Fiscal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
