'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  UploadCloud,
  Lock,
  FileKey2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  CalendarClock,
  RefreshCw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface CertificateStatusData {
  tenant_id?: string;
  company_name?: string;
  cnpj?: string;
  cert_status: 'VALID' | 'EXPIRED' | 'MISSING' | string;
  cert_expiration: string | null;
  formatted_expiration: string | null;
  is_valid: boolean;
  common_name?: string;
}

export default function CertificadoDigitalPage() {
  const [statusData, setStatusData] = useState<CertificateStatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchCertificateStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/v1/fiscal/certificate/status', {
        method: 'GET',
        headers,
        cache: 'no-store',
      });

      if (response.ok) {
        const data: CertificateStatusData = await response.json();
        setStatusData(data);
      } else {
        setStatusData({
          cert_status: 'MISSING',
          cert_expiration: null,
          formatted_expiration: null,
          is_valid: false,
        });
      }
    } catch {
      setStatusData({
        cert_status: 'MISSING',
        cert_expiration: null,
        formatted_expiration: null,
        is_valid: false,
      });
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchCertificateStatus();
  }, [fetchCertificateStatus]);

  const validateAndSetFile = (file: File | undefined | null) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.pfx') && !lowerName.endsWith('.p12')) {
      setErrorMessage(
        'Formato de ficheiro não permitido. Selecione exclusivamente ficheiros .pfx ou .p12 (ICP-Brasil A1).'
      );
      setSelectedFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('O ficheiro excede o tamanho máximo permitido de 5MB.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedFile) {
      setErrorMessage('Selecione ou arraste o ficheiro do Certificado A1 (.pfx ou .p12).');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Informe a senha de proteção do Certificado Digital A1.');
      return;
    }

    setIsUploading(true);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('password', password);

      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/v1/fiscal/certificate/upload', {
        method: 'POST',
        headers,
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.detail || 'Senha inválida para este certificado');
      }

      setSuccessMessage(
        payload.message ||
          `Certificado validado com sucesso! Válido até ${payload.formatted_expiration}.`
      );
      setStatusData({
        cert_status: payload.cert_status || 'VALID',
        cert_expiration: payload.cert_expiration || null,
        formatted_expiration: payload.formatted_expiration || null,
        is_valid: payload.cert_status === 'VALID',
        common_name: payload.common_name,
      });
      setPassword('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Senha inválida para este certificado';
      setErrorMessage(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const isCertValid =
    statusData?.cert_status === 'VALID' && Boolean(statusData?.formatted_expiration);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Lock className="w-3.5 h-3.5" />
            <span>Segurança Fiscal &bull; ICP-Brasil PKCS#12</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Cofre Digital &mdash; Certificado A1 (.pfx / .p12)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Importe e valide o Certificado Digital A1 da sua construtora para assinatura mTLS e
            emissão automática de NFS-e Nacional e NF-e.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchCertificateStatus}
          disabled={loadingStatus}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
          <span>Atualizar Estado</span>
        </button>
      </div>

      {/* Card Visual de Estado Atual do Certificado */}
      <div
        className={`rounded-2xl border p-6 transition-all shadow-lg ${
          loadingStatus
            ? 'bg-slate-900/60 border-slate-800'
            : isCertValid
            ? 'bg-emerald-950/25 border-emerald-500/40 shadow-emerald-950/20'
            : 'bg-rose-950/25 border-rose-500/40 shadow-rose-950/20'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border ${
                loadingStatus
                  ? 'bg-slate-800 border-slate-700 text-slate-400'
                  : isCertValid
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
              }`}
            >
              {loadingStatus ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : isCertValid ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Estado Atual no Cofre Multi-Tenant
              </span>

              {loadingStatus ? (
                <h2 className="text-lg font-bold text-slate-200 mt-1">
                  A verificar estado do Certificado Digital...
                </h2>
              ) : isCertValid ? (
                <h2 className="text-lg sm:text-xl font-bold text-emerald-400 mt-0.5">
                  Status: Válido até {statusData?.formatted_expiration}
                </h2>
              ) : (
                <h2 className="text-lg sm:text-xl font-bold text-rose-400 mt-0.5">
                  Certificado Ausente/Expirado
                </h2>
              )}

              <p className="text-xs text-slate-400 mt-1">
                {isCertValid
                  ? 'Chave privada validada e encriptada com Fernet (AES-128-CBC + HMAC-SHA256) no bucket privado tenant-certificates.'
                  : 'Nenhum certificado A1 ativo localizado ou vigência expirada. Envie um ficheiro .pfx ou .p12 abaixo para habilitar emissões fiscais.'}
              </p>
            </div>
          </div>

          {!loadingStatus && (
            <div className="flex items-center gap-2 self-start sm:self-center">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                  isCertValid
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                }`}
              >
                <CalendarClock className="w-3.5 h-3.5" />
                {isCertValid ? 'ATIVO & CRIPTOGRAFADO' : 'REQUER IMPORTAÇÃO'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Formulário de Upload com Drag-and-Drop e Senha */}
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6 sm:p-8 shadow-xl">
        <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
          <FileKey2 className="w-4 h-4 text-emerald-400" />
          <span>Importar Novo Certificado Digital A1</span>
        </h3>
        <p className="text-xs text-slate-400 mb-6">
          A validação da chave privada ocorre estritamente em memória RAM. A senha é cifrada com{' '}
          <code className="text-emerald-300 bg-slate-950 px-1.5 py-0.5 rounded">Fernet</code> antes
          do armazenamento.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Zona de Drag and Drop (.pfx / .p12) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Ficheiro do Certificado (.pfx ou .p12)
            </label>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                isDragging
                  ? 'border-emerald-400 bg-emerald-500/10'
                  : selectedFile
                  ? 'border-emerald-500/50 bg-emerald-950/20'
                  : 'border-slate-700 hover:border-slate-500 bg-slate-950/50 hover:bg-slate-950/80'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pfx,.p12,application/x-pkcs12"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center space-y-3">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${
                    selectedFile
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <UploadCloud className="w-7 h-7" />
                </div>

                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-emerald-300">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB &bull; Clique ou arraste outro
                      ficheiro para substituir
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-200">
                      Arraste e solte o seu certificado{' '}
                      <span className="text-emerald-400 font-bold">.pfx</span> ou{' '}
                      <span className="text-emerald-400 font-bold">.p12</span> aqui
                    </p>
                    <p className="text-xs text-slate-400">
                      ou clique para selecionar do seu computador (Máx. 5MB)
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Input de Senha do Certificado */}
          <div>
            <label
              htmlFor="cert-password"
              className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2"
            >
              Senha de Proteção do Certificado A1
            </label>
            <div className="relative">
              <div className=" inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none absolute">
                <Lock className="w-4 h-4 text-slate-500" />
              </div>
              <input
                id="cert-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha da chave privada (.pfx / .p12)"
                disabled={isUploading}
                className="w-full pl-10 pr-11 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Feedback de Erro */}
          {errorMessage && (
            <div className="rounded-xl bg-rose-950/40 border border-rose-500/40 p-4 flex items-start gap-3 text-rose-300 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Feedback de Sucesso */}
          {successMessage && (
            <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/40 p-4 flex items-start gap-3 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="font-medium">{successMessage}</div>
            </div>
          )}

          {/* Indicador de Loading Obrigatório + Botão de Submissão */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>
                Isolamento garantido por RLS no bucket privado{' '}
                <code className="text-slate-300">tenant-certificates</code>.
              </span>
            </div>

            <button
              type="submit"
              disabled={isUploading}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/60 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>A validar chaves de segurança...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Validar e Guardar no Cofre Digital</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

