import React, { useState } from 'react';
import { AlertTriangle, FileX, Trash2, X, RefreshCw } from 'lucide-react';
import { CertidaoDocument } from '../types/domain';

interface DeletePdfModalProps {
  isOpen: boolean;
  doc: CertidaoDocument | null;
  onClose: () => void;
  onConfirm: (docId: string, clearExtractedFields: boolean) => void;
}

export const DeletePdfModal: React.FC<DeletePdfModalProps> = ({
  isOpen,
  doc,
  onClose,
  onConfirm,
}) => {
  const [selectedOption, setSelectedOption] = useState<'keep_data' | 'clear_extracted'>('keep_data');

  if (!isOpen || !doc) return null;

  const fileName = doc.fileName || 'documento.pdf';
  const hasExtractedFields = Boolean(
    doc.pdfPopulatedFields && doc.pdfPopulatedFields.length > 0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 text-slate-100"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <FileX className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Excluir Arquivo PDF</h3>
              <p className="text-xs text-slate-400">Certidão: <span className="font-semibold text-slate-300">{doc.name}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target File Info */}
        <div className="mt-4 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
          <div className="min-w-0 pr-3">
            <div className="text-xs text-slate-400">Arquivo atual vinculado:</div>
            <div className="text-sm font-mono text-emerald-400 truncate">{fileName}</div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-700 text-slate-300 whitespace-nowrap">
            {doc.status || doc.category}
          </span>
        </div>

        {/* Notice of Difference */}
        <div className="mt-4 p-3.5 rounded-xl bg-blue-950/40 border border-blue-800/40 text-xs text-blue-200 leading-relaxed flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <strong>Atenção:</strong> Esta ação remove <em>apenas o arquivo digital (PDF)</em> vinculado. 
            A certidão continuará existindo no sistema para controle e prazos. Caso queira excluir a certidão por completo, use a opção <em>Excluir Certidão</em> no menu da linha.
          </div>
        </div>

        {/* Choices */}
        <div className="mt-5 space-y-2.5">
          <label 
            onClick={() => setSelectedOption('keep_data')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
              selectedOption === 'keep_data'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-100 ring-1 ring-emerald-500/20'
                : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800/70'
            }`}
          >
            <input
              type="radio"
              name="delete_pdf_mode"
              checked={selectedOption === 'keep_data'}
              onChange={() => setSelectedOption('keep_data')}
              className="mt-1 accent-emerald-500"
            />
            <div className="text-xs">
              <span className="font-semibold block text-sm text-white">Remover apenas o arquivo PDF (Recomendado)</span>
              <p className="text-slate-400 mt-0.5">
                Mantém todas as datas (emissão, validade, vencimento), código de autenticidade, número do documento e observações já cadastradas. O status passará a indicar ausência de arquivo.
              </p>
            </div>
          </label>

          <label 
            onClick={() => setSelectedOption('clear_extracted')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
              selectedOption === 'clear_extracted'
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-100 ring-1 ring-rose-500/20'
                : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800/70'
            }`}
          >
            <input
              type="radio"
              name="delete_pdf_mode"
              checked={selectedOption === 'clear_extracted'}
              onChange={() => setSelectedOption('clear_extracted')}
              className="mt-1 accent-rose-500"
            />
            <div className="text-xs">
              <span className="font-semibold block text-sm text-white">Remover PDF e limpar dados extraídos dele</span>
              <p className="text-slate-400 mt-0.5">
                Remove o arquivo e limpa os campos preenchidos automaticamente pelo leitor de PDF (número, chave de autenticidade e datas de validade). Apenas o nome e órgão emissor permanecem.
                {hasExtractedFields && (
                  <span className="block mt-1 text-rose-300 font-mono">
                    Campos afetados: {doc.pdfPopulatedFields?.join(', ')}
                  </span>
                )}
              </p>
            </div>
          </label>
        </div>

        {/* Footer actions */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(doc.id, selectedOption === 'clear_extracted');
              onClose();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-lg shadow-rose-600/20"
          >
            <Trash2 className="w-4 h-4" />
            Confirmar Exclusão do PDF
          </button>
        </div>
      </div>
    </div>
  );
};
