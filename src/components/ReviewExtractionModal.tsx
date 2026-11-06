import React from 'react';
import {
  FileScan,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Building2,
  FileText,
  Sparkles,
  Check,
  X,
  Copy,
  ShieldCheck,
} from 'lucide-react';
import {
  CertidaoDocument,
  CompanyProfile,
  DocumentCategory,
  PendingPdfReviewItem,
} from '../types/domain';
import { isValidCNPJ, isValidCPF } from '../utils/validators';

interface ReviewExtractionModalProps {
  items: PendingPdfReviewItem[];
  companies: CompanyProfile[];
  documents: CertidaoDocument[];
  isProcessingMore: boolean;
  processingStatusText: string;
  onUpdateItem: (tempId: string, updater: (item: PendingPdfReviewItem) => PendingPdfReviewItem) => void;
  onRunGeminiEnrichItem: (tempId: string) => void;
  onAddMoreFiles: (files: FileList | null) => void;
  onConfirmAllSelected: () => void;
  onCancel: () => void;
}

function addDaysToDate(dateStr: string, days: number): string {
  if (!dateStr || isNaN(days) || days <= 0) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return '';
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  dt.setDate(dt.getDate() + Number(days));
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const ReviewExtractionModal: React.FC<ReviewExtractionModalProps> = ({
  items,
  companies,
  documents,
  isProcessingMore,
  processingStatusText,
  onUpdateItem,
  onRunGeminiEnrichItem,
  onAddMoreFiles,
  onConfirmAllSelected,
  onCancel,
}) => {
  const selectedCount = items.filter((i) => i.selectedToSave).length;
  const unidentifiedCount = items.filter((i) => i.isUnidentified).length;
  const duplicateCount = items.filter((i) => i.isDuplicate).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl my-auto">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileScan className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Conferir Dados Extraídos dos PDFs ({items.length}{' '}
              {items.length === 1 ? 'arquivo' : 'arquivos'})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Confira e ajuste se necessário as datas, código de autenticidade, empresa vinculada e alterações propostas antes de salvar. O PDF anterior será preservado no Histórico.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 cursor-pointer">
              + Adicionar Mais PDFs
              <input
                type="file"
                accept=".pdf,image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  onAddMoreFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SUMMARY STRIP */}
        <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Selecionados para salvar: <strong className="text-emerald-600 dark:text-emerald-400">{selectedCount}</strong> de {items.length}
            </span>
            {duplicateCount > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                <Copy className="w-3.5 h-3.5" />
                {duplicateCount} possível(is) duplicado(s) detectado(s)
              </span>
            )}
            {unidentifiedCount > 0 && (
              <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                {unidentifiedCount} documento(s) requer(em) seleção manual do tipo
              </span>
            )}
          </div>
          {isProcessingMore && (
            <span className="text-blue-600 dark:text-blue-400 font-medium animate-pulse">
              {processingStatusText || 'Processando arquivos...'}
            </span>
          )}
        </div>

        {/* SCROLLABLE BODY OF ITEMS */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {items.map((item, idx) => {
            const companyDocs = documents.filter((d) => d.companyId === item.matchedCompanyId);

            return (
              <div
                key={item.tempId}
                className={`rounded-xl border p-4 space-y-4 transition-colors ${
                  !item.selectedToSave
                    ? 'bg-slate-50/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 opacity-65'
                    : item.isDuplicate
                    ? 'bg-amber-50/20 dark:bg-amber-950/15 border-amber-300 dark:border-amber-800'
                    : item.isUnreadable || item.warnings.length > 0
                    ? 'bg-red-50/15 dark:bg-red-950/10 border-red-300 dark:border-red-900'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* ITEM TOP BAR */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={item.selectedToSave}
                      onChange={(e) =>
                        onUpdateItem(item.tempId, (prev) => ({
                          ...prev,
                          selectedToSave: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 rounded text-emerald-600 cursor-pointer"
                    />
                    <span className="text-xs font-mono font-bold text-slate-400">
                      #{String(idx + 1).padStart(2, '0')}
                    </span>
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-sm font-bold text-slate-900 dark:text-white break-all">
                      {item.fileName}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      ({Math.max(1, Math.round(item.fileSize / 1024))} KB)
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 text-[11px] font-medium rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      Motor:{' '}
                      {item.extractionEngine === 'pdfjs-local'
                        ? 'PDF.js Local (Gratuito)'
                        : item.extractionEngine === 'tesseract-ocr'
                        ? 'Tesseract OCR Local (Gratuito)'
                        : 'Híbrido (Local + IA)'}
                    </span>

                    {item.extractionEngine !== 'hybrid-gemini' && (
                      <button
                        type="button"
                        onClick={() => onRunGeminiEnrichItem(item.tempId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded hover:bg-amber-200 cursor-pointer"
                        title="Usar IA complementar para refinar campos caso o documento tenha layout complexo"
                      >
                        <Sparkles className="w-3 h-3" />
                        Refinar com IA
                      </button>
                    )}
                  </div>
                </div>

                {/* WARNINGS / DUPLICATE ALERTS */}
                {(item.isDuplicate || item.warnings.length > 0 || item.isUnidentified) && (
                  <div className="space-y-1.5">
                    {item.isDuplicate && (
                      <div className="p-2.5 rounded-lg bg-amber-100/80 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          <strong>Documento Duplicado Detectado:</strong> {item.duplicateReason}
                        </span>
                      </div>
                    )}
                    {item.isUnidentified && (
                      <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>
                          <strong>Certidão não reconhecida automaticamente nas 23 padrão:</strong> Selecione abaixo qual certidão deseja atualizar ou mantenha como "Criar Novo Documento".
                        </span>
                      </div>
                    )}
                    {item.warnings.map((w, wIdx) => (
                      <div
                        key={wIdx}
                        className="p-2.5 rounded-lg bg-red-100/70 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-xs text-red-800 dark:text-red-200 flex items-center gap-2"
                      >
                        <AlertOctagon className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* TARGET COMPANY & TARGET DOCUMENT SELECTION */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        1. Empresa Identificada
                      </span>
                      {item.extractedCnpj && (
                        <span
                          className={`font-mono text-[11px] ${
                            item.cnpjValid
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          CNPJ no PDF: {item.extractedCnpj}{' '}
                          {item.cnpjValid ? '✓ DV Válido' : '⚠ DV Inválido'}
                        </span>
                      )}
                    </label>
                    {item.hasCompanyMismatch && (
                      <div className="mb-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Divergência de Empresa:</strong> {item.companyMismatchReason || 'O CNPJ lido neste arquivo diverge da empresa atualmente selecionada.'}
                        </div>
                      </div>
                    )}
                    <select
                      value={item.matchedCompanyId}
                      onChange={(e) => {
                        const newCompId = e.target.value;
                        const docsOfNewComp = documents.filter((d) => d.companyId === newCompId);
                        const sameTplDoc = docsOfNewComp.find(
                          (d) =>
                            item.matchedTemplateKey &&
                            d.templateKey === item.matchedTemplateKey
                        );
                        onUpdateItem(item.tempId, (prev) => ({
                          ...prev,
                          matchedCompanyId: newCompId,
                          matchedDocId: sameTplDoc ? sameTplDoc.id : '',
                        }));
                      }}
                      className="w-full px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    >
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.companyName} — CNPJ: {c.cnpj}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      2. Registro de Documento a Atualizar
                    </label>
                    <select
                      value={item.matchedDocId}
                      onChange={(e) => {
                        const docId = e.target.value;
                        const targetDoc = companyDocs.find((d) => d.id === docId);
                        onUpdateItem(item.tempId, (prev) => ({
                          ...prev,
                          matchedDocId: docId,
                          isUnidentified: false,
                          documentTitle: targetDoc ? targetDoc.name : prev.documentTitle,
                          category: targetDoc ? targetDoc.category : prev.category,
                          issuer: targetDoc ? targetDoc.issuer : prev.issuer,
                        }));
                      }}
                      className="w-full px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    >
                      <option value="">
                        + Criar como Novo Documento nesta Empresa
                      </option>
                      {companyDocs.map((d) => (
                        <option key={d.id} value={d.id}>
                          Atualizar: {d.name} ({d.issuer})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* EXTRACTED CERTIFICATE FIELDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Tipo / Nome da Certidão
                    </label>
                    <input
                      type="text"
                      value={item.documentTitle}
                      onChange={(e) =>
                        onUpdateItem(item.tempId, (prev) => ({
                          ...prev,
                          documentTitle: e.target.value,
                        }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Órgão Emissor
                    </label>
                    <input
                      type="text"
                      value={item.issuer}
                      onChange={(e) =>
                        onUpdateItem(item.tempId, (prev) => ({
                          ...prev,
                          issuer: e.target.value,
                        }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Categoria
                    </label>
                    <select
                      value={item.category}
                      onChange={(e) =>
                        onUpdateItem(item.tempId, (prev) => ({
                          ...prev,
                          category: e.target.value as DocumentCategory,
                        }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                    >
                      <option value="Fiscais e Trabalhistas">Fiscais e Trabalhistas</option>
                      <option value="Alvarás, Licenças e Conselhos">Alvarás, Licenças e Conselhos</option>
                      <option value="Societário, Contábil e Qualificação Técnica">
                        Societário, Contábil e Qualificação Técnica
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Data de Emissão
                    </label>
                    <input
                      type="date"
                      value={item.issueDate}
                      onChange={(e) => {
                        const newIssue = e.target.value;
                        onUpdateItem(item.tempId, (prev) => {
                          const nextExp =
                            !prev.isPermanent &&
                            newIssue &&
                            prev.validityDays !== '' &&
                            Number(prev.validityDays) > 0
                              ? addDaysToDate(newIssue, Number(prev.validityDays))
                              : prev.expirationDate;
                          return {
                            ...prev,
                            issueDate: newIssue,
                            expirationDate: nextExp,
                          };
                        });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Prazo de Validade (Dias)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        disabled={item.isPermanent}
                        value={item.isPermanent ? '' : item.validityDays}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          onUpdateItem(item.tempId, (prev) => {
                            const nextExp =
                              !prev.isPermanent && prev.issueDate && val !== '' && val > 0
                                ? addDaysToDate(prev.issueDate, val)
                                : prev.expirationDate;
                            return {
                              ...prev,
                              validityDays: val,
                              expirationDate: nextExp,
                            };
                          });
                        }}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white disabled:opacity-50"
                      />
                      <label className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.isPermanent}
                          onChange={(e) =>
                            onUpdateItem(item.tempId, (prev) => ({
                              ...prev,
                              isPermanent: e.target.checked,
                              expirationDate: e.target.checked ? '' : prev.expirationDate,
                            }))
                          }
                          className="rounded text-blue-600"
                        />
                        Fixo
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Data de Vencimento
                    </label>
                    <input
                      type="date"
                      disabled={item.isPermanent}
                      value={item.isPermanent ? '' : item.expirationDate}
                      onChange={(e) =>
                        onUpdateItem(item.tempId, (prev) => ({
                          ...prev,
                          expirationDate: e.target.value,
                        }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-lg text-emerald-900 dark:text-emerald-300 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Situação no Documento
                    </label>
                    <input
                      type="text"
                      value={item.documentSituation}
                      onChange={(e) =>
                        onUpdateItem(item.tempId, (prev) => ({
                          ...prev,
                          documentSituation: e.target.value,
                        }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Número da Certidão
                    </label>
                    <input
                      type="text"
                      value={item.certificateNumber}
                      onChange={(e) =>
                        onUpdateItem(item.tempId, (prev) => ({
                          ...prev,
                          certificateNumber: e.target.value,
                        }))
                      }
                      placeholder="Ex: 0123456/2026"
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Código de Autenticidade / Controle
                    </label>
                    <input
                      type="text"
                      value={item.controlCode}
                      onChange={(e) =>
                        onUpdateItem(item.tempId, (prev) => ({
                          ...prev,
                          controlCode: e.target.value,
                        }))
                      }
                      placeholder="Ex: A1B2.C3D4.E5F6.G7H8"
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Observações
                    </label>
                    <input
                      type="text"
                      value={item.notes}
                      onChange={(e) =>
                        onUpdateItem(item.tempId, (prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* PROPOSED COMPANY DATABASE UPDATES (CONFIRMATION DIFF TABLE) */}
                {item.companyDiffs.length > 0 && (
                  <div className="p-3.5 rounded-lg bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-blue-600" />
                        Dados Cadastrais Encontrados no PDF — Escolha quais atualizar no Banco de Empresas:
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Nenhum dado importante é substituído sem sua marcação
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {item.companyDiffs.map((diff, dIdx) => {
                        const isDocField = diff.field === 'cnpj' || diff.field === 'partnerCpf';
                        const validBadge =
                          diff.field === 'cnpj'
                            ? isValidCNPJ(diff.proposedValue)
                            : diff.field === 'partnerCpf'
                            ? isValidCPF(diff.proposedValue)
                            : null;

                        return (
                          <label
                            key={diff.field}
                            className="flex items-start gap-2 p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={diff.selected}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                onUpdateItem(item.tempId, (prev) => {
                                  const nextDiffs = [...prev.companyDiffs];
                                  nextDiffs[dIdx] = { ...nextDiffs[dIdx], selected: checked };
                                  return { ...prev, companyDiffs: nextDiffs };
                                });
                              }}
                              className="mt-0.5 rounded text-blue-600"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <span>{diff.label}</span>
                                {isDocField && validBadge !== null && (
                                  <span
                                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                                      validBadge
                                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                                    }`}
                                  >
                                    {validBadge ? 'DV Válido' : 'DV Inválido'}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                Atual: <span className="font-mono">{diff.currentValue || '(vazio)'}</span>
                              </div>
                              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium truncate">
                                Novo no PDF: <span className="font-mono">{diff.proposedValue}</span>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950 rounded-b-xl">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Os PDFs anteriores das certidões atualizadas serão arquivados automaticamente no <strong>Histórico de Documentos</strong>.
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={onConfirmAllSelected}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Confirmar e Atualizar {selectedCount}{' '}
              {selectedCount === 1 ? 'Registro' : 'Registros'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
