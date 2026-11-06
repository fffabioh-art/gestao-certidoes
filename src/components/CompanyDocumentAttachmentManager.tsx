import React, { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Eye,
  Download,
  Trash2,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Loader2,
  AlertCircle,
  FileCheck,
  UserCheck,
  Building,
  CreditCard,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { CompanyProfile, CompanyDocumentAttachment } from '../types/domain';
import {
  readCompanyDocument,
  CompanyDocType,
  CompanyDocReadResult,
} from '../utils/companyDocReader';
import { CompanyDocReviewModal } from './CompanyDocReviewModal';

interface CompanyDocumentAttachmentManagerProps {
  company: Partial<CompanyProfile>;
  companies?: CompanyProfile[];
  onUpdateCompany: (updated: Partial<CompanyProfile>) => void;
  onSaveAttachmentDataUrl: (key: string, dataUrl: string) => Promise<void>;
  onGetAttachmentDataUrl: (key: string) => Promise<string | null>;
  onDeleteAttachmentDataUrl: (key: string) => Promise<void>;
  onPreviewDoc?: (title: string, dataUrl: string, mimeType: string, fileName: string) => void;
}

interface PendingReviewSession {
  file: File;
  dataUrl: string;
  result: CompanyDocReadResult;
  replaceIndex: number | null;
}

export const CompanyDocumentAttachmentManager: React.FC<CompanyDocumentAttachmentManagerProps> = ({
  company,
  companies = [],
  onUpdateCompany,
  onSaveAttachmentDataUrl,
  onGetAttachmentDataUrl,
  onDeleteAttachmentDataUrl,
  onPreviewDoc,
}) => {
  const [isReading, setIsReading] = useState(false);
  const [readingStatus, setReadingStatus] = useState('');
  const [successBanner, setSuccessBanner] = useState<{ title: string; fields: string[] } | null>(null);
  const [targetDocType, setTargetDocType] = useState<CompanyDocType | null>(null);
  const [reviewSession, setReviewSession] = useState<PendingReviewSession | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceIndexRef = useRef<number | null>(null);

  const documents = company.companyDocuments || [];

  const getDocTypeIcon = (type: CompanyDocType) => {
    switch (type) {
      case 'cnpj':
        return <Building className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'cnh_socio':
      case 'rg_socio':
        return <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'contrato_social':
        return <FileCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      default:
        return <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    }
  };

  const getDocTypeBadge = (type: CompanyDocType) => {
    switch (type) {
      case 'cnpj':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'cnh_socio':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'rg_socio':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800';
      case 'contrato_social':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'ie_sefaz':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'im_prefeitura':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const handleSelectFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setIsReading(true);
    setReadingStatus(`Lendo ${file.name} com OCR e PDF.js...`);

    try {
      const result = await readCompanyDocument(
        file,
        (msg) => setReadingStatus(msg),
        targetDocType || undefined,
        company
      );
      const dataUrl = await readFileAsDataUrl(file);

      // Abre a tela intuitiva de conferência humana para o usuário validar os dados
      setReviewSession({
        file,
        dataUrl,
        result,
        replaceIndex: replaceIndexRef.current,
      });
    } catch (err) {
      console.error('Erro ao ler documento da empresa:', err);
      alert('Não foi possível ler o documento automaticamente. Você pode anexar e preencher manualmente.');
    } finally {
      setIsReading(false);
      setReadingStatus('');
      setTargetDocType(null);
      replaceIndexRef.current = null;
    }
  };

  const handleConfirmReview = async (selectedUpdates: Record<string, string>, targetCompanyId?: string) => {
    if (!reviewSession) return;

    const { file, dataUrl, result, replaceIndex } = reviewSession;

    try {
      const docId =
        replaceIndex !== null && replaceIndex >= 0 && documents[replaceIndex]
          ? documents[replaceIndex].id
          : `compdoc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      await onSaveAttachmentDataUrl(docId, dataUrl);

      const effectiveType: CompanyDocType = result.detectedType;
      const effectiveTitle = result.detectedTitle;

      const newAttachment: CompanyDocumentAttachment = {
        id: docId,
        docType: effectiveType,
        title: effectiveTitle,
        fileName: file.name,
        fileMimeType: file.type || 'application/pdf',
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        extractedSummary:
          Object.keys(selectedUpdates).length > 0
            ? `Confirmado: ${Object.keys(selectedUpdates).length} campo(s) atualizado(s)`
            : 'Documento arquivado sem alteração de campos',
      };

      const updatedDocs = [...documents];
      if (replaceIndex !== null && replaceIndex >= 0) {
        updatedDocs[replaceIndex] = newAttachment;
      } else {
        updatedDocs.push(newAttachment);
      }

      // Aplica APENAS os campos confirmados e selecionados pelo usuário
      const updatedProfile: Partial<CompanyProfile> = {
        ...company,
        companyDocuments: updatedDocs,
      };

      Object.entries(selectedUpdates).forEach(([k, v]) => {
        (updatedProfile as any)[k] = v;
        // Aliases para máxima compatibilidade
        if (k === 'partnerCpf') (updatedProfile as any).representativeCpf = v;
        if (k === 'partnerName') (updatedProfile as any).representativeName = v;
        if (k === 'companyName') (updatedProfile as any).corporateName = v;
      });

      onUpdateCompany(updatedProfile);

      setSuccessBanner({
        title: `Dados confirmados com sucesso (${effectiveTitle})!`,
        fields: Object.keys(selectedUpdates),
      });

      setReviewSession(null);
    } catch (saveErr) {
      console.error('Erro ao salvar anexo confirmado:', saveErr);
    }
  };

  const handleRetryReview = async () => {
    if (!reviewSession) return;
    const file = reviewSession.file;
    setIsReading(true);
    setReadingStatus(`Re-executando leitura de ${file.name}...`);
    try {
      const refreshedResult = await readCompanyDocument(
        file,
        (msg) => setReadingStatus(msg),
        reviewSession.result.detectedType,
        company
      );
      setReviewSession((prev) => (prev ? { ...prev, result: refreshedResult } : null));
    } finally {
      setIsReading(false);
      setReadingStatus('');
    }
  };

  const triggerUpload = (docType?: CompanyDocType, replaceIndex?: number) => {
    setTargetDocType(docType || null);
    replaceIndexRef.current = replaceIndex !== undefined ? replaceIndex : null;
    fileInputRef.current?.click();
  };

  const handlePreview = async (doc: CompanyDocumentAttachment) => {
    const dataUrl = await onGetAttachmentDataUrl(doc.id);
    if (dataUrl && onPreviewDoc) {
      onPreviewDoc(doc.title, dataUrl, doc.fileMimeType, doc.fileName);
    } else if (dataUrl) {
      const win = window.open();
      if (win) {
        win.document.write(
          `<iframe src="${dataUrl}" frameborder="0" style="border:0; top:0; left:0; bottom:0; right:0; width:100%; height:100%;" allowfullscreen></iframe>`
        );
      }
    }
  };

  const handleDownload = async (doc: CompanyDocumentAttachment) => {
    const dataUrl = await onGetAttachmentDataUrl(doc.id);
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = doc.fileName || `${doc.title}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = async (index: number) => {
    const docToDelete = documents[index];
    if (!docToDelete) return;
    await onDeleteAttachmentDataUrl(docToDelete.id).catch(() => {});
    const updated = documents.filter((_, idx) => idx !== index);
    onUpdateCompany({
      ...company,
      companyDocuments: updated,
    });
  };

  const handleReopenReview = async (doc: CompanyDocumentAttachment, index: number) => {
    const dataUrl = await onGetAttachmentDataUrl(doc.id);
    if (!dataUrl) return;

    // Converte dataUrl de volta para blob/file para reabrir a conferência
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], doc.fileName || `${doc.title}.pdf`, {
        type: doc.fileMimeType || 'application/pdf',
      });

      setIsReading(true);
      setReadingStatus(`Reabrindo conferência de ${doc.title}...`);
      const result = await readCompanyDocument(file, undefined, doc.docType, company);
      setIsReading(false);
      setReadingStatus('');

      setReviewSession({
        file,
        dataUrl,
        result,
        replaceIndex: index,
      });
    } catch (err) {
      setIsReading(false);
      console.error('Falha ao reabrir conferência:', err);
    }
  };

  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 space-y-3.5">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={(e) => {
          handleSelectFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* MODAL DE CONFERÊNCIA INTELIGENTE EM DUAS COLUNAS */}
      {reviewSession && (
        <CompanyDocReviewModal
          isOpen={Boolean(reviewSession)}
          fileName={reviewSession.file.name}
          fileMimeType={reviewSession.file.type}
          dataUrl={reviewSession.dataUrl}
          detectedType={reviewSession.result.detectedType}
          detectedTitle={reviewSession.result.detectedTitle}
          initialItems={reviewSession.result.fieldItems}
          currentCompany={company}
          companies={companies}
          onConfirm={handleConfirmReview}
          onRetry={handleRetryReview}
          onCancel={() => setReviewSession(null)}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-2.5">
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Documentação da Empresa (Cartão CNPJ, CNH do Sócio, Contrato Social)
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Anexe os documentos para <strong>conferência e preenchimento inteligente</strong> com comparação lado a lado.
          </p>
        </div>

        {isReading && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 rounded-lg border border-blue-200 dark:border-blue-800 shrink-0 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
            <span>{readingStatus || 'Lendo documento...'}</span>
          </div>
        )}
      </div>

      {/* Botões Rápidos para Anexar Documentos Chave */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          type="button"
          disabled={isReading}
          onClick={() => triggerUpload('cnpj')}
          className="flex items-center justify-center gap-1.5 p-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
          title="Anexar Cartão CNPJ da Receita Federal: lê CNPJ, Razão Social, CNAEs, Endereço e Situação"
        >
          <Building className="w-3.5 h-3.5" />
          <span>+ Cartão CNPJ</span>
        </button>

        <button
          type="button"
          disabled={isReading}
          onClick={() => triggerUpload('cnh_socio')}
          className="flex items-center justify-center gap-1.5 p-2 text-xs font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-100/90 hover:bg-emerald-200/90 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 border-2 border-emerald-500/80 dark:border-emerald-500/80 rounded-lg transition-all cursor-pointer shadow-xs"
          title="Anexar CNH do Sócio: FONTE PRIORITÁRIA para CPF, Nome do Sócio, RG e Data de Nascimento"
        >
          <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>+ CNH do Sócio</span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-600 text-white font-extrabold uppercase tracking-tight">
            Prioritário
          </span>
        </button>

        <button
          type="button"
          disabled={isReading}
          onClick={() => triggerUpload('contrato_social')}
          className="flex items-center justify-center gap-1.5 p-2 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50/80 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
          title="Anexar Contrato Social / JUCEPI: lê NIRE, Capital Social e dados societários"
        >
          <FileCheck className="w-3.5 h-3.5" />
          <span>+ Contrato Social</span>
        </button>

        <button
          type="button"
          disabled={isReading}
          onClick={() => triggerUpload('outro')}
          className="flex items-center justify-center gap-1.5 p-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors cursor-pointer shadow-2xs"
          title="Anexar qualquer outro documento societário ou comprovante"
        >
          <Plus className="w-3.5 h-3.5 text-slate-500" />
          <span>+ Outro Doc</span>
        </button>
      </div>

      {/* Banner de Sucesso de Auto-Preenchimento */}
      {successBanner && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-start gap-2.5 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold text-emerald-900 dark:text-emerald-200">
              {successBanner.title}
            </div>
            <div className="text-emerald-800 dark:text-emerald-300 mt-0.5">
              Campos confirmados e atualizados:{' '}
              <span className="font-semibold">{successBanner.fields.length} campo(s)</span>.
            </div>
            <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-1">
              Todos os dados permanecem 100% editáveis no formulário.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 p-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Lista de Documentos Já Anexados */}
      {documents.length > 0 ? (
        <div className="space-y-2 pt-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Documentos Armazenados ({documents.length}):
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {documents.map((doc, idx) => (
              <div
                key={doc.id || idx}
                className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-start justify-between gap-2 shadow-2xs"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                    {getDocTypeIcon(doc.docType)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {doc.title}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 text-[10px] font-semibold rounded border ${getDocTypeBadge(
                          doc.docType
                        )}`}
                      >
                        {doc.docType.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5" title={doc.fileName}>
                      {doc.fileName} {doc.fileSize ? `· ${(doc.fileSize / 1024).toFixed(0)} KB` : ''}
                    </p>
                    {doc.extractedSummary && (
                      <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 truncate mt-0.5">
                        ✓ {doc.extractedSummary}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleReopenReview(doc, idx)}
                    className="p-1 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
                    title="Reabrir tela de conferência de dados extraídos"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePreview(doc)}
                    className="p-1 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
                    title="Visualizar documento"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(doc)}
                    className="p-1 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
                    title="Baixar arquivo"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerUpload(doc.docType, idx)}
                    className="p-1 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
                    title="Substituir por nova versão do arquivo"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(idx)}
                    className="p-1 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
                    title="Excluir este documento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-2 px-3 bg-white/60 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-500 dark:text-slate-400">
          Nenhum documento da empresa anexado ainda. Clique nos botões acima para anexar o Cartão CNPJ ou a CNH do Sócio e abrir a conferência automática!
        </div>
      )}
    </div>
  );
};
