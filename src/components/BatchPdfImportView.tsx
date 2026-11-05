import React, { useState } from 'react';
import {
  UploadCloud,
  FileScan,
  CheckCircle2,
  Loader2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface BatchPdfImportViewProps {
  isProcessing: boolean;
  progressText: string;
  onSelectFiles: (files: FileList | File[], useGeminiComplement: boolean) => void;
}

export const BatchPdfImportView: React.FC<BatchPdfImportViewProps> = ({
  isProcessing,
  progressText,
  onSelectFiles,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [useAiComplement, setUseAiComplement] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onSelectFiles(e.dataTransfer.files, useAiComplement);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`rounded-xl border-2 border-dashed p-5 transition-all ${
        isDragging
          ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30'
          : 'border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
            {isProcessing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <UploadCloud className="w-6 h-6" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
              <span>Importar Vários PDFs em Lote (Arraste e Solte Aqui)</span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                100% Gratuito · PDF.js + OCR Local
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isProcessing
                ? progressText || 'Analisando documentos individualmente...'
                : 'Arraste 1 ou vários PDFs de certidões ou Cartão CNPJ. O sistema identifica o CNPJ, a empresa, o tipo de certidão, emissão, vencimento e código de autenticidade e abre a tela de Conferência antes de salvar.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={useAiComplement}
              onChange={(e) => setUseAiComplement(e.target.checked)}
              className="rounded text-blue-600"
            />
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Complementar com IA (Opcional)</span>
          </label>

          <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow cursor-pointer whitespace-nowrap">
            <FileScan className="w-4 h-4" />
            Selecionar Vários PDFs
            <input
              type="file"
              accept=".pdf,image/*"
              multiple
              disabled={isProcessing}
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onSelectFiles(e.target.files, useAiComplement);
                }
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          Identifica a empresa pelo CNPJ (com validação de dígito verificador)
        </span>
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          Detecta duplicados e preserva o PDF anterior no Histórico
        </span>
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
          Exibe tela de Conferência antes de gravar qualquer alteração
        </span>
      </div>
    </div>
  );
};
