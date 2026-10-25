'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import {
  Sparkles,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Info,
  RefreshCw,
  Eye,
  FileCheck,
  DollarSign,
  Calendar,
  Building,
  Hash,
  Scale,
  BrainCircuit,
  ArrowRight,
  Layers,
  X,
} from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';

interface LegislationAlert {
  id: string;
  source: string;
  title: string;
  summary: string;
  law_reference?: string;
  category: string;
  impact_level: 'critical' | 'warning' | 'info';
  effective_date?: string;
  details?: Record<string, any>;
  detected_at: string;
}

interface OcrItem {
  item_numero?: number;
  codigo?: string;
  descricao: string;
  unidade?: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

interface OcrParsedPayload {
  fornecedor: {
    razao_social: string;
    nome_fantasia?: string;
    cnpj: string;
    inscricao_estadual?: string;
    cidade?: string;
    uf?: string;
  };
  data_emissao?: string;
  data_vencimento?: string;
  numero_nota?: string;
  serie?: string;
  chave_acesso?: string;
  tipo_documento?: string;
  valor_total: number;
  valor_produtos?: number;
  valor_frete?: number;
  valor_desconto?: number;
  itens: OcrItem[];
  tributos?: Record<string, any>;
  observacoes?: string;
}

interface OcrResponse {
  success: boolean;
  confidence_score: number;
  parsed_payload: OcrParsedPayload;
  processing_time_seconds?: number;
  file_info?: {
    filename: string;
    content_type: string;
    size_bytes: number;
  };
}

export function InteligenciaClient() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Estados locais
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResponse | null>(null);
  const [isHumanReviewed, setIsHumanReviewed] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  // Formulário editável de Contas a Pagar
  const [formData, setFormData] = useState({
    razaoSocial: '',
    cnpj: '',
    cidade: '',
    uf: '',
    descricao: '',
    categoria: 'insumos',
    dataEmissao: '',
    dataVencimento: '',
    numeroNota: '',
    serie: '1',
    chaveAcesso: '',
    valorTotal: 0,
    valorFrete: 0,
    valorDesconto: 0,
  });

  const [formItems, setFormItems] = useState<OcrItem[]>([]);

  // 1. Query: Alertas Legislativos de Tax Intelligence
  const {
    data: alertsData,
    isLoading: isLoadingAlerts,
    refetch: refetchAlerts,
    isFetching: isFetchingAlerts,
  } = useQuery({
    queryKey: ['legislation-alerts'],
    queryFn: async () => {
      const resp = await fetch('/api/v1/intelligence/legislation/alerts?limit=15');
      if (!resp.ok) {
        throw new Error('Falha ao carregar alertas de Tax Intelligence');
      }
      return resp.json();
    },
  });

  // Mutação para forçar varredura no IBPT / Receita Federal
  const syncMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch('/api/v1/intelligence/legislation/sync', {
        method: 'POST',
      });
      if (!resp.ok) {
        throw new Error('Falha ao sincronizar fontes tributárias');
      }
      return resp.json();
    },
    onSuccess: () => {
      refetchAlerts();
    },
  });

  // 2. Mutação de OCR Preditivo com LLM (Gemini 2.5 Flash)
  const ocrMutation = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append('file', file);

      const resp = await fetch('/api/v1/intelligence/ocr/parse', {
        method: 'POST',
        body,
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Falha ao processar OCR do comprovante');
      }

      return resp.json() as Promise<OcrResponse>;
    },
    onSuccess: (data) => {
      setOcrResult(data);
      setIsHumanReviewed(false);
      setIsSavedSuccess(false);

      const payload = data.parsed_payload;
      setFormData({
        razaoSocial: payload.fornecedor.razao_social || '',
        cnpj: payload.fornecedor.cnpj || '',
        cidade: payload.fornecedor.cidade || '',
        uf: payload.fornecedor.uf || '',
        descricao: `Compra de Insumos - NF ${payload.numero_nota || 'S/N'} (${payload.fornecedor.razao_social || 'Fornecedor'})`,
        categoria: 'insumos',
        dataEmissao: payload.data_emissao || new Date().toISOString().split('T')[0],
        dataVencimento: payload.data_vencimento || new Date().toISOString().split('T')[0],
        numeroNota: payload.numero_nota || '',
        serie: payload.serie || '1',
        chaveAcesso: payload.chave_acesso || '',
        valorTotal: payload.valor_total || 0,
        valorFrete: payload.valor_frete || 0,
        valorDesconto: payload.valor_desconto || 0,
      });

      setFormItems(payload.itens || []);
    },
  });

  // 3. Mutação de Gravação no Contas a Pagar
  const savePayableMutation = useMutation({
    mutationFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const tenantId = session?.user?.user_metadata?.tenant_id || session?.user?.app_metadata?.tenant_id;
      if (!tenantId) {
        throw new Error('Tenant não identificado na sessão do operador.');
      }

      const entryPayload = {
        tenant_id: tenantId,
        entry_type: 'payable',
        category: formData.categoria,
        description: formData.descricao,
        nominal_amount: formData.valorTotal,
        discount_amount: formData.valorDesconto,
        net_amount: formData.valorTotal - formData.valorDesconto,
        status: 'pendente',
        due_date: formData.dataVencimento,
        document_number: formData.numeroNota || null,
        document_type: 'nfe',
        notes: `Lançamento via Tax Intelligence OCR (Confiança: ${Math.round(
          (ocrResult?.confidence_score || 0.95) * 100
        )}%). Fornecedor: ${formData.razaoSocial} (CNPJ: ${formData.cnpj}). Total de itens: ${formItems.length}.`,
      };

      const { data, error } = await supabase
        .from('financial_entries')
        .insert(entryPayload)
        .select('id')
        .single();

      if (error) {
        throw new Error(error.message || 'Falha ao gravar lançamento no Contas a Pagar.');
      }

      return data;
    },
    onSuccess: (data) => {
      setIsSavedSuccess(true);
      setSavedEntryId(data.id);
    },
  });

  // Configuração do react-dropzone
  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);
      ocrMutation.mutate(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
    },
    multiple: false,
  });

  // Filtragem dos alertas legislativos
  const alerts: LegislationAlert[] = alertsData?.alerts || [];
  const filteredAlerts = alerts.filter((a) => {
    if (activeFilter === 'all') return true;
    return a.impact_level === activeFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Header com Badges de Governança */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/5">
              <Sparkles className="w-3.5 h-3.5" />
              Tax Intelligence Ativa
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <BrainCircuit className="w-3.5 h-3.5" />
              Gemini 2.5 Flash
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Inteligência Fiscal & Auditoria de Insumos
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Monitoramento proativo de normas e alíquotas (IBPT e NFS-e Nacional) e ingestão preditiva
            de notas fiscais via IA para abastecimento do Contas a Pagar.
          </p>
        </div>

        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending || isFetchingAlerts}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${syncMutation.isPending || isFetchingAlerts ? 'animate-spin text-emerald-400' : ''}`}
          />
          {syncMutation.isPending ? 'Varrendo Fontes...' : 'Sincronizar Radar Legal'}
        </button>
      </div>

      {/* ==================================================================== */}
      {/* ÁREA 1: ALERTAS DE MONITORAMENTO LEGISLATIVO (SHADCN UI ALERT)       */}
      {/* ==================================================================== */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Radar Tributário da Construção Civil
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-normal">
                  {alerts.length} normas vigentes
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Alterações na LC 116/2003, tabela IBPT e retenções de ISS/INSS auditadas pelo robô
              </p>
            </div>
          </div>

          {/* Filtros de Criticidade */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900/80 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                activeFilter === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas ({alerts.length})
            </button>
            <button
              onClick={() => setActiveFilter('critical')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                activeFilter === 'critical' ? 'bg-red-500/20 text-red-300 shadow-sm' : 'text-slate-400 hover:text-red-300'
              }`}
            >
              Críticas
            </button>
            <button
              onClick={() => setActiveFilter('warning')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                activeFilter === 'warning' ? 'bg-amber-500/20 text-amber-300 shadow-sm' : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              Avisos
            </button>
            <button
              onClick={() => setActiveFilter('info')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                activeFilter === 'info' ? 'bg-cyan-500/20 text-cyan-300 shadow-sm' : 'text-slate-400 hover:text-cyan-300'
              }`}
            >
              Info
            </button>
          </div>
        </div>

        {isLoadingAlerts ? (
          <div className="p-8 rounded-2xl border border-slate-800/80 bg-slate-900/40 text-center animate-pulse">
            <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-400">Consultando base de conformidade fiscal do Supabase...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/30 text-center">
            <p className="text-xs text-slate-400">Nenhum alerta localizado para o filtro selecionado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {filteredAlerts.map((alert) => {
              const variantMap = {
                critical: 'destructive' as const,
                warning: 'warning' as const,
                info: 'info' as const,
              };

              const iconMap = {
                critical: ShieldAlert,
                warning: AlertTriangle,
                info: Info,
              };

              const AlertIcon = iconMap[alert.impact_level] || Info;

              return (
                <Alert key={alert.id} variant={variantMap[alert.impact_level]}>
                  <AlertIcon className="w-5 h-5" />
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <AlertTitle className="text-sm font-bold tracking-tight">
                        {alert.title}
                      </AlertTitle>
                      <div className="flex items-center gap-2">
                        {alert.law_reference && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold bg-slate-800/80 border border-slate-700/60 text-slate-300">
                            {alert.law_reference}
                          </span>
                        )}
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-900/70 text-slate-400">
                          {alert.source}
                        </span>
                      </div>
                    </div>
                    <AlertDescription className="text-xs text-slate-300/90 leading-relaxed">
                      {alert.summary}
                    </AlertDescription>

                    {/* Regra de validação se houver */}
                    {alert.details && alert.details.validation && (
                      <div className="mt-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 font-mono text-[11px] text-emerald-400 flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Regra Automática: {alert.details.validation}</span>
                      </div>
                    )}
                  </div>
                </Alert>
              );
            })}
          </div>
        )}
      </section>

      {/* ==================================================================== */}
      {/* ÁREA 2: DRAG-AND-DROP DE NOTAS E COMPROVANTES (REACT-DROPZONE)       */}
      {/* ==================================================================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <UploadCloud className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Ingestão Inteligente de Comprovantes e Notas de Insumos
            </h2>
            <p className="text-xs text-slate-400">
              Faça upload de NF-e, recibos ou romaneios para leitura automática dos itens e do fornecedor
            </p>
          </div>
        </div>

        {/* Zona de Drop */}
        <div
          {...getRootProps()}
          className={`relative p-8 sm:p-12 rounded-3xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
            isDragActive
              ? 'border-emerald-500 bg-emerald-950/20 shadow-2xl shadow-emerald-500/20 scale-[1.01]'
              : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/60'
          }`}
        >
          <input {...getInputProps()} />

          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600/20 to-teal-400/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-500/10">
            {ocrMutation.isPending ? (
              <RefreshCw className="w-8 h-8 animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8" />
            )}
          </div>

          <div className="space-y-1 max-w-md">
            <p className="text-sm font-bold text-white">
              {isDragActive
                ? 'Solte o arquivo da nota fiscal aqui...'
                : 'Arraste e solte o comprovante ou nota fiscal aqui'}
            </p>
            <p className="text-xs text-slate-400">
              Suporta PDF ou Imagens (PNG, JPEG, WebP) de até 20 MB
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-400 border border-slate-700/60 font-mono">
              NF-e Mod 55
            </span>
            <span className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-400 border border-slate-700/60 font-mono">
              NFC-e
            </span>
            <span className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-400 border border-slate-700/60 font-mono">
              Recibos de Materiais
            </span>
            <span className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-400 border border-slate-700/60 font-mono">
              Romaneios
            </span>
          </div>

          {selectedFile && !ocrMutation.isPending && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>{selectedFile.name}</span>
              <span className="text-slate-500">
                ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          )}
        </div>

        {/* Feedback visual durante processamento de OCR */}
        {ocrMutation.isPending && (
          <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 space-y-3 animate-pulse">
            <div className="flex items-center gap-3">
              <BrainCircuit className="w-5 h-5 text-emerald-400 animate-spin" />
              <div>
                <p className="text-sm font-bold text-white">
                  Auditoria Fiscal e Extração Preditiva em Andamento...
                </p>
                <p className="text-xs text-emerald-300/80">
                  O modelo Gemini 2.5 Flash está lendo o arquivo temporário, extraindo o CNPJ do fornecedor,
                  discriminando itens e calculando impostos aproximados.
                </p>
              </div>
            </div>
          </div>
        )}

        {ocrMutation.isError && (
          <Alert variant="destructive">
            <AlertTriangle className="w-5 h-5" />
            <AlertTitle>Falha no Processamento da Nota Fiscal</AlertTitle>
            <AlertDescription>
              {(ocrMutation.error as Error)?.message || 'Não foi possível processar o documento.'}
            </AlertDescription>
          </Alert>
        )}
      </section>

      {/* ==================================================================== */}
      {/* ÁREA 3 & 4: FORMULÁRIO DO CONTAS A PAGAR & REVISÃO HUMANA COMPULSÓRIA */}
      {/* ==================================================================== */}
      {ocrResult && (
        <section className="p-6 sm:p-8 rounded-3xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-md space-y-8">
          {/* Cabeçalho do OCR com Score de Confiança */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Score de Confiança: {Math.round(ocrResult.confidence_score * 100)}% (Alta Precisão)
                </span>
                {ocrResult.processing_time_seconds && (
                  <span className="text-xs text-slate-500 font-mono">
                    Inferência em {ocrResult.processing_time_seconds}s
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                Prévia Estruturada para Lançamento no Contas a Pagar
              </h3>
              <p className="text-xs text-slate-400">
                Revise visualmente os campos extraídos antes de homologar a gravação no módulo financeiro.
              </p>
            </div>

            <button
              onClick={() => {
                setOcrResult(null);
                setSelectedFile(null);
                setIsSavedSuccess(false);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Limpar / Novo Upload
            </button>
          </div>

          {/* Sucesso na Gravação */}
          {isSavedSuccess && (
            <Alert variant="success">
              <CheckCircle2 className="w-5 h-5" />
              <AlertTitle>Lançamento Gravado com Sucesso no Contas a Pagar!</AlertTitle>
              <AlertDescription>
                A despesa de insumos foi registrada sob o ID{' '}
                <strong className="font-mono text-emerald-300">{savedEntryId}</strong> com status{' '}
                <strong>pendente</strong> e vinculada ao fornecedor {formData.razaoSocial}.
              </AlertDescription>
            </Alert>
          )}

          {/* Grid do Formulário */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Fornecedor */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                Fornecedor (Razão Social)
              </label>
              <input
                type="text"
                value={formData.razaoSocial}
                onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* CNPJ */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                CNPJ do Fornecedor
              </label>
              <input
                type="text"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Cidade / UF */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Município / UF do Emitente
              </label>
              <input
                type="text"
                value={`${formData.cidade}${formData.uf ? ` - ${formData.uf}` : ''}`}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Descrição da Conta */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Descrição do Lançamento no Contas a Pagar
              </label>
              <input
                type="text"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Categoria */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Centro de Custo / Categoria
              </label>
              <select
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="insumos">Insumos e Materiais de Construção</option>
                <option value="locacao_equipamentos">Locação de Máquinas e Andaimes</option>
                <option value="mao_de_obra">Empreiteiro / Cessão de Mão-de-Obra</option>
                <option value="combustivel">Combustível & Transporte</option>
                <option value="geral">Geral / Administrativo</option>
              </select>
            </div>

            {/* Data Emissão */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Data de Emissão da Nota
              </label>
              <input
                type="date"
                value={formData.dataEmissao}
                onChange={(e) => setFormData({ ...formData, dataEmissao: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Data Vencimento */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                Data de Vencimento (Contas a Pagar)
              </label>
              <input
                type="date"
                value={formData.dataVencimento}
                onChange={(e) => setFormData({ ...formData, dataVencimento: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-emerald-500/50 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Número da Nota */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Número do Documento / NF
              </label>
              <input
                type="text"
                value={formData.numeroNota}
                onChange={(e) => setFormData({ ...formData, numeroNota: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Valor Total */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Valor Total do Título (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.valorTotal}
                onChange={(e) => setFormData({ ...formData, valorTotal: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-emerald-500/50 text-base font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Frete */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Valor do Frete Destacado (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.valorFrete}
                onChange={(e) => setFormData({ ...formData, valorFrete: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Descontos */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Valor de Descontos (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.valorDesconto}
                onChange={(e) => setFormData({ ...formData, valorDesconto: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* Tabela de Itens Extraídos pela IA */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                Itens & Insumos Discriminados na Nota ({formItems.length})
              </h4>
              <span className="text-xs text-slate-400">
                Total dos Itens: R${' '}
                {formItems.reduce((acc, curr) => acc + curr.valor_total, 0).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Cód / NCM</th>
                    <th className="px-4 py-3">Descrição do Insumo</th>
                    <th className="px-4 py-3 text-center">Unid</th>
                    <th className="px-4 py-3 text-right">Qtd</th>
                    <th className="px-4 py-3 text-right">Preço Unit</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {formItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-2.5 text-slate-500 font-mono">
                        {item.item_numero || idx + 1}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-400">
                        {item.codigo || '-'}
                      </td>
                      <td className="px-4 py-2.5 text-white font-medium">
                        {item.descricao}
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono text-slate-400">
                        {item.unidade || 'UN'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                        {item.quantidade}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                        R$ {item.valor_unitario.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-400">
                        R$ {item.valor_total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ==================================================================== */}
          {/* REVISÃO VISUAL HUMANA COMPULSÓRIA (GOVERNANÇA & HUMAN-IN-THE-LOOP)    */}
          {/* ==================================================================== */}
          <div className="p-5 rounded-2xl border border-amber-500/40 bg-amber-950/20 backdrop-blur-md space-y-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="human-review-checkbox"
                checked={isHumanReviewed}
                onChange={(e) => setIsHumanReviewed(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-amber-500/60 text-amber-500 focus:ring-amber-500/30 bg-slate-950 cursor-pointer"
              />
              <label htmlFor="human-review-checkbox" className="cursor-pointer text-xs leading-relaxed text-slate-200">
                <span className="font-bold text-amber-300 block text-sm mb-0.5">
                  Revisão Visual Humana Obrigatória (Governança Financeira)
                </span>
                Declaro que conferi visualmente os dados extraídos pelo robô de IA contra o documento fiscal
                original (CNPJ do fornecedor, valor total e itens). A homologação manual é compulsória para evitar
                pagamentos indevidos e garantir conformidade fiscal com o SPED/Contabilidade.
              </label>
            </div>
          </div>

          {/* Botão de Ação */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
            {!isHumanReviewed && (
              <span className="text-xs text-amber-400/90 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Marque a caixa de revisão visual acima para liberar a gravação
              </span>
            )}

            <button
              onClick={() => savePayableMutation.mutate()}
              disabled={!isHumanReviewed || savePayableMutation.isPending || isSavedSuccess}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-emerald-600 disabled:hover:to-teal-500"
            >
              <FileCheck className="w-4 h-4" />
              {savePayableMutation.isPending
                ? 'Efetivando no Contas a Pagar...'
                : isSavedSuccess
                ? 'Lançamento Gravado!'
                : 'Salvar no Contas a Pagar'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
