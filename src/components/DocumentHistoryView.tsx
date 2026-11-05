import React, { useState, useMemo } from 'react';
import {
  Clock,
  Eye,
  Download,
  RotateCcw,
  FileText,
  Search,
  Building2,
  Trash2,
} from 'lucide-react';
import { CompanyProfile, DocumentHistoryEntry } from '../types/domain';

interface DocumentHistoryViewProps {
  historyEntries: DocumentHistoryEntry[];
  companies: CompanyProfile[];
  selectedCompanyId: string;
  filterDocumentId?: string | null;
  onClearDocFilter?: () => void;
  onViewHistoryAttachment: (entry: DocumentHistoryEntry) => void;
  onDownloadHistoryAttachment: (entry: DocumentHistoryEntry) => void;
  onRestoreHistoryVersion: (entry: DocumentHistoryEntry) => void;
  onDeleteHistoryEntry: (historyId: string) => void;
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatDateTimeBR(isoStr: string): string {
  if (!isoStr) return '—';
  try {
    const dt = new Date(isoStr);
    return dt.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

export const DocumentHistoryView: React.FC<DocumentHistoryViewProps> = ({
  historyEntries,
  companies,
  selectedCompanyId,
  filterDocumentId,
  onClearDocFilter,
  onViewHistoryAttachment,
  onDownloadHistoryAttachment,
  onRestoreHistoryVersion,
  onDeleteHistoryEntry,
}) => {
  const [search, setSearch] = useState('');

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return historyEntries
      .filter((entry) => {
        if (selectedCompanyId !== 'all' && entry.companyId !== selectedCompanyId) {
          return false;
        }
        if (filterDocumentId && entry.documentId !== filterDocumentId) {
          return false;
        }
        if (q) {
          const hay = `${entry.documentName} ${entry.companyName} ${entry.issuer} ${entry.controlCode || ''} ${entry.certificateNumber || ''} ${entry.replacementReason}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
  }, [historyEntries, selectedCompanyId, filterDocumentId, search]);

  return (
    <section className="space-y-4">
      <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Histórico de Certidões e Versões Anteriores ({filteredHistory.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Sempre que uma certidão nova é importada ou renovada, a versão anterior e o respectivo arquivo PDF permanecem arquivados aqui para auditoria, visualização ou restauração.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filterDocumentId && onClearDocFilter && (
            <button
              type="button"
              onClick={onClearDocFilter}
              className="px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer"
            >
              Mostrar Histórico de Todos os Documentos
            </button>
          )}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar no histórico por certidão, código..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
        {filteredHistory.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Clock className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Nenhum registro no histórico de substituições ainda
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Ao renovar uma certidão ou importar um novo PDF sobre uma certidão existente, os dados e o PDF anterior aparecerão automaticamente nesta lista.
            </p>
          </div>
        ) : (
          filteredHistory.map((entry) => {
            const comp = companies.find((c) => c.id === entry.companyId);
            return (
              <div
                key={entry.id}
                className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {entry.documentName}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                      {entry.replacementReason}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-400">
                      <Building2 className="w-3 h-3" />
                      {comp?.companyName || entry.companyName}
                    </span>
                    <span>·</span>
                    <span>Órgão: {entry.issuer || '—'}</span>
                    <span>·</span>
                    <span className="font-mono">
                      Emissão: {formatDateBR(entry.issueDate)} | Vencimento:{' '}
                      {formatDateBR(entry.expirationDate)}
                    </span>
                    {entry.controlCode && (
                      <>
                        <span>·</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          Autenticidade: {entry.controlCode}
                        </span>
                      </>
                    )}
                    {entry.documentSituation && (
                      <>
                        <span>·</span>
                        <span>Situação: {entry.documentSituation}</span>
                      </>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono">
                    Arquivado no sistema em: {formatDateTimeBR(entry.archivedAt)}
                    {entry.fileName ? ` · Arquivo PDF: ${entry.fileName}` : ''}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {(entry.attachmentHistoryKey || entry.driveUrl) && (
                    <>
                      <button
                        type="button"
                        onClick={() => onViewHistoryAttachment(entry)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 rounded-lg cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver PDF Anterior
                      </button>
                      {entry.attachmentHistoryKey && (
                        <button
                          type="button"
                          onClick={() => onDownloadHistoryAttachment(entry)}
                          className="p-1.5 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg cursor-pointer"
                          title="Baixar PDF anterior"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => onRestoreHistoryVersion(entry)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer"
                    title="Restaurar esta versão como a certidão ativa"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Recuperar Versão
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteHistoryEntry(entry.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                    title="Remover registro do histórico"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
