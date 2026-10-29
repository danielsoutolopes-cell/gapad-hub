'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Truck,
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Share2,
  Send,
  ExternalLink,
  Plus,
  Clock,
  User,
  ShieldCheck,
  Building2,
  X,
  Phone,
  FileCheck,
} from 'lucide-react';
import { SignaturePad } from '@/components/logistics/SignaturePad';

interface MaterialTransferRecord {
  id: string;
  type: string;
  description: string;
  carrier_name: string;
  carrier_document: string;
  license_plate?: string;
  pdf_url?: string;
  created_at: string;
}

interface MaterialTransfersClientProps {
  projectId: string;
  projectName: string;
  recentTransfers: MaterialTransferRecord[];
}

export function MaterialTransfersClient({
  projectId,
  projectName,
  recentTransfers,
}: MaterialTransfersClientProps) {
  const router = useRouter();

  // Formulário Principal
  const [transferType, setTransferType] = useState<'RECEIPT' | 'WITHDRAWAL'>('RECEIPT');
  const [description, setDescription] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [carrierDocument, setCarrierDocument] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal de Compartilhamento Premium
  const [showShareModal, setShowShareModal] = useState(false);
  const [activeTransferId, setActiveTransferId] = useState<string | null>(null);
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null);

  // 3 inputs flexíveis de WhatsApp
  const [phoneDriver, setPhoneDriver] = useState('');
  const [phoneSupplier, setPhoneSupplier] = useState('');
  const [phoneEngineer, setPhoneEngineer] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notifySuccessMessage, setNotifySuccessMessage] = useState<string | null>(null);

  // Upload e conversão de fotos para Base64
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotos((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit do Termo de Retirada/Recebimento
  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signatureBase64) {
      setFeedback({
        type: 'error',
        message: 'A assinatura digital na tela é obrigatória para emissão do termo.',
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    // Capturar GPS
    let geolocationPayload: { latitude?: number; longitude?: number; accuracy?: number } = {};
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: true,
          });
        });
        geolocationPayload = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
      } catch (geoErr) {
        console.warn('GPS não obtido ou negado:', geoErr);
      }
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const token = ''; // Backend extrairá via cookie ou auth headers

      const payload = {
        type: transferType,
        description,
        carrier_name: carrierName,
        carrier_document: carrierDocument,
        license_plate: licensePlate || undefined,
        signature_base64: signatureBase64,
        photos_base64: photos,
        geolocation: geolocationPayload,
      };

      const res = await fetch(`${apiUrl}/api/v1/projects/${projectId}/transfers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Erro ao registrar termo no servidor.');
      }

      // UX Premium: NÃO dispara automaticamente. Abre o Modal de Compartilhamento!
      setActiveTransferId(data.transfer_id);
      setActivePdfUrl(data.pdf_url);
      setShowShareModal(true);

      // Limpa os campos do formulário para o próximo lançamento
      setDescription('');
      setCarrierName('');
      setCarrierDocument('');
      setLicensePlate('');
      setSignatureBase64(null);
      setPhotos([]);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na comunicação com o servidor.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Disparo Manual via WhatsApp (Rota 2)
  const handleSendWhatsAppReceipts = async () => {
    if (!activeTransferId) return;

    const phonesToSend = [phoneDriver, phoneSupplier, phoneEngineer]
      .map((p) => p.trim())
      .filter((p) => p.length >= 8);

    if (phonesToSend.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Informe ao menos um número de WhatsApp válido para envio.',
      });
      return;
    }

    setSendingNotification(true);
    setNotifySuccessMessage(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${apiUrl}/api/v1/transfers/${activeTransferId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones: phonesToSend }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Falha ao despachar mensagens via WhatsApp.');
      }

      setNotifySuccessMessage(`Termo formal enviado com sucesso para ${data.dispatched_count} destinatário(s)!`);
      setTimeout(() => {
        setShowShareModal(false);
        setNotifySuccessMessage(null);
        setPhoneDriver('');
        setPhoneSupplier('');
        setPhoneEngineer('');
      }, 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao enviar notificações.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setSendingNotification(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-16">
      {/* Header Mobile-First */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <Truck className="w-3 h-3" /> Portaria Digital &bull; Suprimentos
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
            Logística de Canteiro: {projectName}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Emissão de Termos de Retirada (Saída) e Recebimento (Entrada) com custódia jurídica, carimbo GPS e assinatura em touchscreen.
          </p>
        </div>

        <Link
          href={`/dashboard/obras/${projectId}/subcontratos`}
          className="text-xs font-semibold px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors self-start sm:self-auto"
        >
          Voltar à Obra
        </Link>
      </div>

      {/* Alerta de Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs underline opacity-80 hover:opacity-100">
            Fechar
          </button>
        </div>
      )}

      {/* Grid Principal: Formulário de Registro (Mobile-First) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Formulário (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <form onSubmit={handleSubmitTransfer} className="space-y-6">
            {/* 1. Tipo da Operação */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Tipo da Movimentação:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTransferType('RECEIPT')}
                  className={`py-3.5 px-4 rounded-2xl border text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    transferType === 'RECEIPT'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                  <span>Recebimento (Entrada)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTransferType('WITHDRAWAL')}
                  className={`py-3.5 px-4 rounded-2xl border text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    transferType === 'WITHDRAWAL'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 text-amber-400" />
                  <span>Retirada (Saída)</span>
                </button>
              </div>
            </div>

            {/* 2. Discriminação dos Materiais */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Discriminação dos Materiais / Carga / Equipamentos: <strong className="text-red-400">*</strong>
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: 50 sacos de cimento CP-II, 12 barras de aço CA-50 10mm, 01 betoneira 400L locada. Carga conferida e sem avarias."
                className="w-full p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* 3. Dados do Transportador / Motorista */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nome do Portador / Motorista: <strong className="text-red-400">*</strong>
                </label>
                <input
                  type="text"
                  required
                  value={carrierName}
                  onChange={(e) => setCarrierName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo de Oliveira"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Documento (CPF / RG): <strong className="text-red-400">*</strong>
                </label>
                <input
                  type="text"
                  required
                  value={carrierDocument}
                  onChange={(e) => setCarrierDocument(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Placa do Veículo / Caminhão: (Opcional)
              </label>
              <input
                type="text"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                placeholder="Ex: BRA2E19"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-white uppercase font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* 4. Fotos da Carga / Portaria */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  Fotos da Carga / Placa / NF (Câmera do Celular):
                </span>
                <span className="text-[11px] text-slate-500">{photos.length} foto(s) anexada(s)</span>
              </label>

              <div className="flex flex-wrap gap-3 items-center">
                <label className="cursor-pointer border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl w-24 h-24 flex flex-col items-center justify-center text-slate-400 hover:text-white transition-colors bg-slate-950/40">
                  <Camera className="w-6 h-6 mb-1 text-slate-500" />
                  <span className="text-[10px] font-semibold text-center">Tirar Foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>

                {photos.map((src, idx) => (
                  <div key={idx} className="relative w-24 h-24 rounded-2xl overflow-hidden border border-slate-700 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-slate-950/80 text-red-400 opacity-90 hover:opacity-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Assinatura Touchscreen (Mobile-First Canvas) */}
            <div className="pt-2">
              <SignaturePad onSignatureChange={setSignatureBase64} />
            </div>

            {/* Botão de Emissão do Termo */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-6 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:opacity-95 text-slate-950 shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <FileCheck className="w-5 h-5 stroke-[2.5]" />
              <span>{isSubmitting ? 'Gerando Termo Formal com GPS...' : 'Salvar Termo e Gerar PDF Formal'}</span>
            </button>
          </form>
        </div>

        {/* Histórico Recente de Transferências (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Movimentações Recentes
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Portaria</span>
          </div>

          <div className="space-y-3 max-h-[580px] overflow-y-auto no-scrollbar pr-1">
            {recentTransfers.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                Nenhum termo de transferência emitido para esta obra ainda.
              </div>
            ) : (
              recentTransfers.map((item) => {
                const isWithdrawal = item.type === 'WITHDRAWAL';
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          isWithdrawal
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {isWithdrawal ? 'Retirada (Saída)' : 'Recebimento (Entrada)'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(item.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 font-medium line-clamp-2">
                      {item.description}
                    </p>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                      <span className="truncate max-w-[140px] flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-500" />
                        {item.carrier_name}
                      </span>
                      {item.pdf_url && (
                        <a
                          href={item.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-md"
                        >
                          <FileText className="w-3 h-3" /> Ver PDF
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE COMPARTILHAMENTO PREMIUM ("Termo Gerado!") */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#0b101d] border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">Termo Formal Gerado!</h3>
                  <p className="text-xs text-slate-400">PDF assinado com GPS e pronto para envio</p>
                </div>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {notifySuccessMessage && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{notifySuccessMessage}</span>
              </div>
            )}

            {/* Opção de visualizar o PDF */}
            {activePdfUrl && (
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>Termo_Custodia_{activeTransferId?.slice(0, 8)}.pdf</span>
                </div>
                <a
                  href={activePdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir PDF
                </a>
              </div>
            )}

            {/* Inputs Flexíveis de WhatsApp */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-emerald-400" />
                Enviar Recibos via WhatsApp (Até 3 Números):
              </label>

              {/* Destinatário 1: Motorista */}
              <div>
                <span className="text-[11px] text-slate-400 font-medium mb-1 block">
                  1. Motorista / Portador (Touchscreen):
                </span>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="tel"
                    placeholder="(11) 99999-1111"
                    value={phoneDriver}
                    onChange={(e) => setPhoneDriver(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Destinatário 2: Fornecedor */}
              <div>
                <span className="text-[11px] text-slate-400 font-medium mb-1 block">
                  2. Fornecedor / Empresa Emitente:
                </span>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="tel"
                    placeholder="(11) 98888-2222"
                    value={phoneSupplier}
                    onChange={(e) => setPhoneSupplier(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Destinatário 3: Engenheiro / Fiscal */}
              <div>
                <span className="text-[11px] text-slate-400 font-medium mb-1 block">
                  3. Engenheiro Responsável / Fiscal da Obra:
                </span>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="tel"
                    placeholder="(11) 97777-3333"
                    value={phoneEngineer}
                    onChange={(e) => setPhoneEngineer(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Ações do Modal */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-800 hover:bg-slate-800 text-xs font-bold text-slate-300 transition-colors"
              >
                Concluir sem Enviar
              </button>

              <button
                type="button"
                onClick={handleSendWhatsAppReceipts}
                disabled={sendingNotification}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all"
              >
                <Send className="w-4 h-4" />
                <span>{sendingNotification ? 'Disparando...' : 'Enviar Recibos'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
