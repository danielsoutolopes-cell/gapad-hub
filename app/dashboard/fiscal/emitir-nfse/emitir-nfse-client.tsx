'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Receipt,
  Building2,
  Users,
  HardHat,
  DollarSign,
  ShieldCheck,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Send,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function EmitirNfseClient() {
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();

  // Estados do formulário
  const [projectId, setProjectId] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [measurementId, setMeasurementId] = useState<string>('');
  const [serviceDescription, setServiceDescription] = useState<string>(
    'Serviços técnicos especializados de engenharia civil, reforma e acompanhamento de obra.'
  );
  const [grossAmount, setGrossAmount] = useState<number>(5000);
  const [issRate, setIssRate] = useState<number>(5.0);
  const [deductionsAmount, setDeductionsAmount] = useState<number>(0);
  const [whatsappNotification, setWhatsappNotification] = useState<boolean>(true);
  const [whatsappRecipient, setWhatsappRecipient] = useState<string>('');
  const [environment, setEnvironment] = useState<'homologacao' | 'producao'>('homologacao');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successModalData, setSuccessModalData] = useState<any | null>(null);

  // 1. Busca lista de Obras do Tenant
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['fiscal_form_projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, code, client_id, city_ibge')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // 2. Busca lista de Clientes
  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['fiscal_form_clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, tax_id, phone, email')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // 3. Busca medições aprovadas da obra selecionada
  const { data: measurements = [] } = useQuery({
    queryKey: ['fiscal_form_measurements', projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medicoes')
        .select('id, numero_sequencial, valor_medido, status')
        .eq('project_id', projectId)
        .in('status', ['aprovada', 'pendente'])
        .order('numero_sequencial', { ascending: false });
      if (error) return [];
      return data || [];
    },
  });

  // Seleção de obra sincroniza cliente e telefone
  const handleSelectProject = (pId: string) => {
    setProjectId(pId);
    setMeasurementId('');
    const proj = projects.find((p: any) => p.id === pId);
    if (proj?.client_id) {
      setClientId(proj.client_id);
      const cli = clients.find((c: any) => c.id === proj.client_id);
      if (cli?.phone && !whatsappRecipient) {
        setWhatsappRecipient(cli.phone);
      }
    }
  };

  // Seleção de medição sincroniza valor
  const handleSelectMeasurement = (mId: string) => {
    setMeasurementId(mId);
    const m = measurements.find((item: any) => item.id === mId);
    if (m?.valor_medido) {
      setGrossAmount(Number(m.valor_medido));
    }
  };

  // Cálculos simulados em tela
  const baseCalculo = Math.max(0, grossAmount - deductionsAmount);
  const valorIss = (baseCalculo * issRate) / 100;
  const valorInss = (grossAmount * 5) / 100;
  const valorLiquido = grossAmount - valorInss;

  // Mutation de Emissão de NFS-e Nacional
  const issueMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Sessão expirada. Efetue login novamente.');
      }

      const payload: any = {
        project_id: projectId || null,
        client_id: clientId || null,
        measurement_id: measurementId || null,
        serie_dps: '1',
        codigo_tributacao_lc116: '07.02',
        codigo_tributacao_nacional: '070201',
        discriminacao_servicos: serviceDescription,
        valores: {
          valor_servicos: Number(grossAmount),
          valor_deducoes: Number(deductionsAmount),
          aliquota_iss: Number(issRate),
          iss_retido: null, // Validação territorial automática no backend
          aliquota_inss: 5.0,
        },
        whatsapp_notification: whatsappNotification,
        whatsapp_recipient: whatsappRecipient || undefined,
        environment: environment,
      };

      const res = await fetch('/api/v1/fiscal/invoices/issue-nfse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          'x-tenant-id':
            session.user.app_metadata?.tenant_id || session.user.user_metadata?.tenant_id || '',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.title || 'Falha ao emitir NFS-e.');
      }
      return data;
    },
    onSuccess: (data) => {
      setSuccessModalData(data);
      queryClient.invalidateQueries({ queryKey: ['fiscal_invoices_hub'] });
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Erro inesperado na transmissão da nota.');
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
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-500/15 text-teal-400 border border-teal-500/30">
            NFS-e Padrão Nacional (DPS 07.02)
          </span>
        </div>
      </div>

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <Receipt className="w-6 h-6 text-teal-400" />
          Emissão Rápida de NFS-e (Serviços)
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Emita notas fiscais de serviço diretamente do escritório, com validação automática de competência territorial do ISS (Art. 3º, III da LC 116/2003) e despacho via WhatsApp.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-rose-300">Erro na Emissão Fiscal</h4>
            <p className="text-xs text-rose-200 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* FORMULÁRIO DE EMISSÃO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda/Centro: Dados da Emissão */}
        <div className="lg:col-span-2 space-y-5 rounded-2xl bg-slate-900/60 border border-slate-800 p-6 shadow-xl">
          {/* Seção 1: Vinculação de Obra e Tomador */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              1. Tomador e Vínculo Operacional
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Obra */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Obra / Canteiro (Opcional)
                </label>
                <select
                  value={projectId}
                  onChange={(e) => handleSelectProject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="">Nenhuma (Emissão Avulsa Backoffice)</option>
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.code ? `(${p.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cliente */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Cliente / Tomador do Serviço *
                </label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="">Selecione o Cliente...</option>
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.tax_id ? `(${c.tax_id})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Medição (Se houver obra selecionada) */}
              {projectId && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Medição Aprovada Vinculada (Opcional)
                  </label>
                  <select
                    value={measurementId}
                    onChange={(e) => handleSelectMeasurement(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="">Faturamento sem vínculo direto a medição</option>
                    {measurements.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        Medição #{m.numero_sequencial} — R${' '}
                        {Number(m.valor_medido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (
                        {m.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Seção 2: Discriminação dos Serviços */}
          <div className="border-t border-slate-800/80 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              2. Discriminação dos Serviços de Engenharia
            </h3>
            <textarea
              rows={3}
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
              placeholder="Descreva detalhadamente as etapas executadas, mão de obra empregada e medições..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Seção 3: Valores e Alíquotas */}
          <div className="border-t border-slate-800/80 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              3. Valores e Tributação
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Valor Bruto (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={grossAmount}
                  onChange={(e) => setGrossAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Deduções Legais de Materiais (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={deductionsAmount}
                  onChange={(e) => setDeductionsAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Alíquota ISS (%) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="2"
                  max="5"
                  value={issRate}
                  onChange={(e) => setIssRate(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Seção 4: Notificação WhatsApp */}
          <div className="border-t border-slate-800/80 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              4. Notificação via WhatsApp
            </h3>
            <div className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                id="wa_check"
                checked={whatsappNotification}
                onChange={(e) => setWhatsappNotification(e.target.checked)}
                className="w-4 h-4 accent-teal-500 rounded"
              />
              <label htmlFor="wa_check" className="text-xs text-slate-300 cursor-pointer">
                Enviar DANFSE (PDF) e resumo de faturamento via WhatsApp para o cliente
              </label>
            </div>
            {whatsappNotification && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Telefone / WhatsApp com DDD (Ex: 11999998888)
                </label>
                <input
                  type="text"
                  value={whatsappRecipient}
                  onChange={(e) => setWhatsappRecipient(e.target.value)}
                  placeholder="5511999998888"
                  className="w-full sm:w-72 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-teal-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Coluna Direita: Card Resumo Financeiro & Disparo */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-5 shadow-xl space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              Resumo Tributário da Emissão
            </h4>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                <span>Valor Bruto:</span>
                <span className="font-mono font-semibold text-white">
                  R$ {grossAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {deductionsAmount > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                  <span>Deduções Legais:</span>
                  <span className="font-mono text-amber-400">
                    - R$ {deductionsAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                <span>Base ISS:</span>
                <span className="font-mono">
                  R$ {baseCalculo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                <span>ISS Estimado ({issRate}%):</span>
                <span className="font-mono text-purple-300">
                  R$ {valorIss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                <span>Retenção INSS (5%):</span>
                <span className="font-mono text-rose-400">
                  - R$ {valorInss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between pt-2 text-sm font-bold">
                <span className="text-emerald-400">Valor Líquido:</span>
                <span className="font-mono text-emerald-400">
                  R$ {valorLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Ambiente de Transmissão:
              </label>
              <select
                value={environment}
                onChange={(e: any) => setEnvironment(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none"
              >
                <option value="homologacao">Homologação (Simulação Fiscal)</option>
                <option value="producao">Produção (SEFAZ / Receita)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => issueMutation.mutate()}
              disabled={issueMutation.isPending || grossAmount <= 0}
              className="w-full py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 shadow-lg shadow-teal-500/25 border border-teal-400/30 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {issueMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Assinando e Transmitindo...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Autorizar e Emitir NFS-e
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE SUCESSO DA EMISSÃO */}
      {successModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">NFS-e Emitida com Sucesso!</h3>
                <p className="text-xs text-slate-400">
                  Nota Fiscal autorizada no Padrão Nacional da Receita Federal.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Número da Nota:</span>
                <span className="font-bold text-white">#{successModalData.number} (Série {successModalData.series})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Chave de Acesso:</span>
                <span className="font-mono text-slate-300 text-[11px] truncate max-w-[200px]" title={successModalData.access_key}>
                  {successModalData.access_key}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Valor Líquido:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  R$ {Number(successModalData.net_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {successModalData.whatsapp_dispatched && (
                <div className="text-[11px] text-teal-400 flex items-center gap-1.5 pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  DANFSE despachado com sucesso via WhatsApp
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              {successModalData.pdf_url && (
                <a
                  href={successModalData.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-sky-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition-all flex items-center gap-1.5"
                >
                  <FileText className="w-4 h-4 text-sky-400" />
                  Abrir DANFSE (PDF)
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  setSuccessModalData(null);
                  router.push('/dashboard/fiscal');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all"
              >
                Concluir e Ir ao Painel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
