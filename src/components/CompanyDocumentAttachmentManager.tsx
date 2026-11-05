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
} from 'lucide-react';
import { CompanyProfile, CompanyDocumentAttachment } from '../types/domain';
import { readCompanyDocument, CompanyDocType } from '../utils/companyDocReader';

interface CompanyDocumentAttachmentManagerProps {
  company: Partial<CompanyProfile>;
  onUpdateCompany: (updated: Partial<CompanyProfile>) => void;
  onSaveAttachmentDataUrl: (key: string, dataUrl: string) => Promise<void>;
  onGetAttachmentDataUrl: (key: string) => Promise<string | null>;
  onDeleteAttachmentDataUrl: (key: string) => Promise<void>;
  onPreviewDoc?: (title: string, dataUrl: string, mimeType: string, fileName: string) => void;
}

export const CompanyDocumentAttachmentManager: React.FC<CompanyDocumentAttachmentManagerProps> = ({
  company,
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
      const result = await readCompanyDocument(file, (msg) => setReadingStatus(msg), targetDocType || undefined);
      const dataUrl = await readFileAsDataUrl(file);

      const docId = `compdoc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await onSaveAttachmentDataUrl(docId, dataUrl);

      const effectiveType: CompanyDocType = targetDocType || result.detectedType;
      const effectiveTitle = targetDocType === 'cnpj'
        ? 'Cartão CNPJ (Receita Federal)'
        : targetDocType === 'cnh_socio'
        ? 'CNH do Sócio Administrador'
        : targetDocType === 'contrato_social'
        ? 'Contrato Social / JUCEPI'
        : result.detectedTitle;

      const newAttachment: CompanyDocumentAttachment = {
        id: docId,
        docType: effectiveType,
        title: effectiveTitle,
        fileName: file.name,
        fileMimeType: file.type || 'application/pdf',
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        extractedSummary: result.populatedFieldLabels.length > 0
          ? `Preencheu: ${result.populatedFieldLabels.join(', ')}`
          : 'Documento cadastrado',
      };

      let updatedDocs = [...documents];
      if (replaceIndexRef.current !== null && replaceIndexRef.current >= 0) {
        const oldDoc = updatedDocs[replaceIndexRef.current];
        if (oldDoc) {
          await onDeleteAttachmentDataUrl(oldDoc.id).catch(() => {});
        }
        updatedDocs[replaceIndexRef.current] = newAttachment;
      } else {
        updatedDocs.push(newAttachment);
      }

      // ======================================================================
      // REGRA MESTRA: CNH É A FONTE PRIORITÁRIA ABSOLUTA PARA CPF E DADOS DO SÓCIO
      // (CPF, Nome do Sócio Administrador, RG e Data de Nascimento).
      // ======================================================================
      const isCnhUpload = effectiveType === 'cnh_socio' || result.isCnhPartnerPriority;
      const partnerFields = ['partnerCpf', 'partnerName', 'partnerRg', 'partnerBirthDate'];
      const hasCnhInAttachments = updatedDocs.some((d) => d.docType === 'cnh_socio');

      // Atualiza o perfil da empresa aplicando estritamente a prioridade da CNH
      const updatedProfile: Partial<CompanyProfile> = {
        ...company,
        companyDocuments: updatedDocs,
      };

      Object.entries(result.extractedFields).forEach(([k, v]) => {
        if (v !== undefined && v !== '') {
          if (partnerFields.includes(k)) {
            // Se o upload atual for CNH: SEMPRE sobrepõe e define com PRIORIDADE MÁXIMA!
            if (isCnhUpload) {
              (updatedProfile as any)[k] = v;
              if (k === 'partnerCpf') (updatedProfile as any).representativeCpf = v;
              if (k === 'partnerName') (updatedProfile as any).representativeName = v;
            } else {
              // Se o upload NÃO for CNH:
              // Se a empresa já possui CNH anexada ou o campo já foi preenchido,
              // NÃO permite que outro documento sobrescreva os dados de sócio da CNH!
              const currentVal = (company as any)[k];
              if (!hasCnhInAttachments && (!currentVal || currentVal === '')) {
                (updatedProfile as any)[k] = v;
                if (k === 'partnerCpf') (updatedProfile as any).representativeCpf = v;
                if (k === 'partnerName') (updatedProfile as any).representativeName = v;
              }
            }
          } else {
            // Campos corporativos (CNPJ, Razão Social, Endereço, etc.) são atualizados normalmente
            (updatedProfile as any)[k] = v;
            if (k === 'companyName') (updatedProfile as any).corporateName = v;
          }
        }
      });

      onUpdateCompany(updatedProfile);

      if (result.populatedFieldLabels.length > 0) {
        setSuccessBanner({
          title: isCnhUpload
            ? `⭐ Prioridade CNH Aplicada: Dados do Sócio extraídos com máxima prioridade da CNH!`
            : `Leitura concluída com sucesso (${effectiveTitle})!`,
          fields: result.populatedFieldLabels,
        });
      }
    } catch (err) {
      console.error('Erro ao ler documento da empresa:', err);
    } finally {
      setIsReading(false);
      setReadingStatus('');
      setTargetDocType(null);
      replaceIndexRef.current = null;
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-2.5">
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Documentação da Empresa (CNPJ, CNH do Sócio, Contrato Social)
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Anexe os documentos para <strong>preenchimento automático inteligente</strong> dos dados. 100% editável a qualquer momento.
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
          title="Anexar Cartão CNPJ: lê CNPJ, Razão Social, CNAE, Endereço e CEP"
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
          title="Anexar qualquer outro documento societário ou certidão base"
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
              Campos preenchidos automaticamente no formulário:{' '}
              <span className="font-semibold">{successBanner.fields.join(', ')}</span>.
            </div>
            <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-1">
              Você pode conferir ou alterar qualquer campo livremente abaixo.
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
          Nenhum documento da empresa anexado ainda. Clique nos botões acima para anexar o Cartão CNPJ ou a CNH do Sócio e preencher os dados automaticamente!
        </div>
      )}
    </div>
  );
};
