import { AutoFillFieldKey, CompanyBasicProfile } from '../utils/portalAdapters';

export type DocumentCategory =
  | 'Fiscais e Trabalhistas'
  | 'Alvarás, Licenças e Conselhos'
  | 'Societário, Contábil e Qualificação Técnica';

export type ComputedStatus =
  | 'vigente'
  | 'atencao'
  | 'vencido'
  | 'permanente'
  | 'sem_data'
  | 'aguardando_conferencia';

export type CompanyProfile = CompanyBasicProfile;

export interface CertidaoDocument {
  id: string;
  companyId: string;
  templateKey?: string;
  name: string;
  category: DocumentCategory;
  issuer: string;
  emitterUrl: string;
  registrationCode: string;
  primaryAutoFillField?: AutoFillFieldKey;
  portalFieldsHint?: string;
  issueDate: string; // YYYY-MM-DD or ''
  validityDays: number | '';
  expirationDate: string; // YYYY-MM-DD or ''
  isPermanent: boolean;
  certificateNumber?: string;
  controlCode?: string;
  documentSituation?: string;
  awaitingReview?: boolean;
  notes: string;
  fileType: 'none' | 'local' | 'drive';
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;
  driveUrl?: string;
  updatedAt: string;
}

export interface DocumentHistoryEntry {
  id: string;
  documentId: string;
  companyId: string;
  companyName: string;
  documentName: string;
  templateKey?: string;
  category: DocumentCategory;
  issuer: string;
  issueDate: string;
  validityDays: number | '';
  expirationDate: string;
  certificateNumber?: string;
  controlCode?: string;
  documentSituation?: string;
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;
  attachmentHistoryKey?: string; // chave no IndexedDB (hist-att-{id})
  driveUrl?: string;
  archivedAt: string; // Data de inclusão/arquivamento no histórico
  replacementReason: string; // Ex: "Renovação de certidão", "Substituição via leitura de PDF"
}

export interface CompanyFieldDiff {
  field: keyof CompanyProfile;
  label: string;
  currentValue: string;
  proposedValue: string;
  selected: boolean;
  isValidDocumentNumber?: boolean | null;
}

export interface PendingPdfReviewItem {
  tempId: string;
  fileName: string;
  fileSize: number;
  fileMimeType: string;
  dataUrl: string;
  selectedToSave: boolean;
  isDuplicate: boolean;
  duplicateReason?: string;
  isUnidentified: boolean;
  isUnreadable: boolean;
  warnings: string[];
  extractionEngine: 'pdfjs-local' | 'tesseract-ocr' | 'hybrid-gemini';
  // Target matching
  matchedCompanyId: string;
  matchedDocId: string; // '' means create new document
  // Editable extracted fields
  documentTitle: string;
  matchedTemplateKey: string;
  category: DocumentCategory;
  issuer: string;
  issueDate: string;
  validityDays: number | '';
  expirationDate: string;
  isPermanent: boolean;
  certificateNumber: string;
  controlCode: string;
  documentSituation: string;
  notes: string;
  extractedCnpj: string;
  cnpjValid: boolean | null;
  // Proposed company profile diffs
  companyDiffs: CompanyFieldDiff[];
}
