import React from 'react';
import {
  X,
  Download,
  ExternalLink,
  Trash2,
  RefreshCw,
  FileText,
  Calendar,
  Building,
  Key,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { CertidaoDocument } from '../types/domain';

interface PdfViewerModalProps {
  isOpen: boolean;
  doc: CertidaoDocument | null;
  companyName?: string;
  onClose: () => void;
  onDownload: (doc: CertidaoDocument) => void;
  onRequestReplace: (doc: CertidaoDocument) => void;
  onRequestDeletePdf: (doc: CertidaoDocument) => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  doc,
  companyName,
  onClose,
  onDownload,
  onRequestReplace,
  onRequestDeletePdf,
}) => {
  if (!isOpen || !doc) return null;

  const fileData = doc.fileData || '';
  const fileUrl = doc.fileUrl || '';
  const hasFile = Boolean(fileData || fileUrl);
  const isImage = fileData.startsWith('data:image/') || fileUrl.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i);
  const isPdf = fileData.startsWith('data:application/pdf') || fileUrl.match(/\.pdf($|\?)/i) || (!isImage && hasFile);

  const previewSource = fileData || fileUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-5xl h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white truncate max-w-md">{doc.name}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {doc.issuer}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 truncate mt-0.5">
                {companyName && (
                  <span className="flex items-center gap-1">
                    <Building className="w-3 h-3 text-slate-500" />
                    {companyName}
                  </span>
                )}
                {(doc.expirationDate || doc.validUntil) && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    Vence em: {doc.expirationDate || doc.validUntil}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDownload(doc)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
              title="Baixar cópia do arquivo"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Baixar</span>
            </button>

            <button
              onClick={() => onRequestReplace(doc)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-xs font-medium text-blue-300 border border-blue-500/30 transition"
              title="Substituir PDF por nova versão"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Substituir</span>
            </button>

            <button
              onClick={() => onRequestDeletePdf(doc)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-xs font-medium text-rose-300 border border-rose-500/30 transition"
              title="Excluir apenas o PDF anexado"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excluir PDF</span>
            </button>

            <div className="w-px h-6 bg-slate-800 mx-1" />

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Metadata Bar */}
        {Boolean(doc.certificateNumber || doc.documentNumber || doc.controlCode || doc.authenticityCode || doc.protocolNumber) && (
          <div className="px-5 py-2 bg-slate-900 border-b border-slate-800/80 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
            {(doc.certificateNumber || doc.documentNumber) && (
              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Nº Certidão:</span>{' '}
                <span className="text-slate-200">{doc.certificateNumber || doc.documentNumber}</span>
              </div>
            )}
            {(doc.controlCode || doc.authenticityCode) && (
              <div className="flex items-center gap-1">
                <Key className="w-3 h-3 text-emerald-400" />
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Chave / Autenticidade:</span>{' '}
                <span className="text-emerald-400 select-all">{doc.controlCode || doc.authenticityCode}</span>
              </div>
            )}
            {doc.protocolNumber && (
              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Protocolo:</span>{' '}
                <span className="text-slate-200">{doc.protocolNumber}</span>
              </div>
            )}
            {doc.pdfAnalysisConfidence && (
              <div className="ml-auto flex items-center gap-1 text-[11px] text-slate-400">
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                Confiança OCR: <span className="text-cyan-300">{Math.round(doc.pdfAnalysisConfidence * 100)}%</span>
              </div>
            )}
          </div>
        )}

        {/* Content Viewer Body */}
        <div className="flex-1 bg-slate-950 p-2 sm:p-4 overflow-hidden flex flex-col items-center justify-center">
          {!hasFile ? (
            <div className="text-center p-8 max-w-md">
              <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">Nenhum arquivo digital vinculado</p>
              <p className="text-xs text-slate-500 mt-1">
                Esta certidão possui apenas os dados de controle cadastrados. Utilize o botão "Substituir" ou "Anexar PDF" para carregar o arquivo.
              </p>
            </div>
          ) : isImage ? (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-2">
              <img
                src={previewSource}
                alt={doc.name}
                className="max-w-full max-h-full object-contain rounded-lg border border-slate-800 shadow-xl"
              />
            </div>
          ) : previewSource.startsWith('data:') ? (
            <iframe
              src={previewSource}
              title={doc.name}
              className="w-full h-full rounded-lg border border-slate-800 bg-white"
            />
          ) : (
            <div className="text-center p-8 max-w-md bg-slate-900 border border-slate-800 rounded-2xl">
              <FileText className="w-12 h-12 text-blue-400 mx-auto mb-3" />
              <h4 className="text-base font-semibold text-white">Arquivo em Armazenamento Remoto</h4>
              <p className="text-xs text-slate-400 mt-1 mb-5">
                O arquivo está salvo em link externo ({previewSource.substring(0, 40)}...). Para visualizar, abra no portal ou baixe para seu computador.
              </p>
              <a
                href={previewSource}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-lg shadow-blue-600/20"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir Link Externo
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
