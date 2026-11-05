import { AutoFillFieldKey, CompanyBasicProfile } from '../utils/portalAdapters';

export type { CompanyBasicProfile };

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
  validUntil?: string; // alias for expirationDate
  daysUntilExpiration?: number;
  status?: string;
  isPermanent: boolean;
  certificateNumber?: string;
  documentNumber?: string; // alias for certificateNumber
  controlCode?: string;
  authenticityCode?: string; // alias for controlCode
  protocolNumber?: string;
  documentSituation?: string;
  awaitingReview?: boolean;
  notes: string;
  fileType: 'none' | 'local' | 'drive';
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;
  fileData?: string;
  fileUrl?: string;
  driveUrl?: string;
  pdfAnalysisConfidence?: number;
  customFields?: Record<string, string>;
  pdfPopulatedFields?: string[]; // campos preenchidos exclusivamente pelo PDF anexado
  isArchived?: boolean;
  archivedAt?: string;
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
  protocolNumber?: string;
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
  rawFile?: File;
  selectedToSave: boolean;
  isDuplicate: boolean;
  duplicateReason?: string;
  isUnidentified: boolean;
  isUnreadable: boolean;
  hasCompanyMismatch?: boolean;
  companyMismatchReason?: string;
  warnings: string[];
  extractionEngine: 'pdfjs-local' | 'tesseract-ocr' | 'hybrid-gemini';
  // Target matching
  matchedCompanyId: string; // '' when no reliable company match was found
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
  protocolNumber?: string;
  documentSituation: string;
  notes: string;
  extractedCnpj: string;
  extractedCompanyName?: string;
  cnpjValid: boolean | null;
  // Proposed company profile diffs
  companyDiffs: CompanyFieldDiff[];
}

// ============================================================================
// CENTRAL DE CONFIGURAÇÕES — PERSONALIZAÇÃO COMPLETA
// ============================================================================

export type CompanyFormSectionKey =
  | 'dados_empresariais'
  | 'endereco_contato'
  | 'representante_legal'
  | 'responsavel_tecnico'
  | 'informacoes_adicionais';

export type CustomFieldType =
  | 'texto'
  | 'numero'
  | 'data'
  | 'telefone'
  | 'email'
  | 'cpf'
  | 'cnpj'
  | 'lista'
  | 'sim_nao'
  | 'texto_longo'
  | 'link'
  | 'valor_monetario';

export interface CompanyFieldConfig {
  key: keyof CompanyProfile;
  id?: string; // alias for key
  defaultLabel: string;
  label: string;
  section: CompanyFormSectionKey | string;
  visible: boolean;
  required: boolean;
  order: number;
  showInSummary: boolean;
  essential?: boolean; // ex: companyName, cnpj
  placeholder?: string;
}

export interface CustomFieldDefinition {
  id: string;
  target: 'company' | 'certificate';
  name: string;
  label?: string;
  fieldType: CustomFieldType;
  dataType?: CustomFieldType;
  placeholder?: string;
  options?: string[]; // usado quando fieldType === 'lista'
  section: CompanyFormSectionKey | 'certidao_geral';
  required: boolean;
  visible: boolean;
  order: number;
  showInSummary?: boolean;
  companyScope: 'all' | string; // 'all' ou ID de uma empresa específica
}

export type CertidaoFieldKey =
  | 'name'
  | 'category'
  | 'issuer'
  | 'certificateNumber'
  | 'controlCode'
  | 'protocolNumber'
  | 'issueDate'
  | 'validityDays'
  | 'expirationDate'
  | 'documentSituation'
  | 'emitterUrl'
  | 'primaryAutoFillField'
  | 'notes'
  | 'pdfAttachment';

export interface CertidaoFieldConfig {
  key: CertidaoFieldKey;
  defaultLabel: string;
  label: string;
  visible: boolean;
  required: boolean;
  order: number;
  essential?: boolean; // ex: name, expirationDate
}

export type TableColumnKey =
  | 'index'
  | 'status'
  | 'name'
  | 'company'
  | 'issuer'
  | 'dates'
  | 'controlCode'
  | 'protocolNumber'
  | 'situation'
  | 'portalAction'
  | 'pdfAction'
  | 'actions';

export interface TableColumnConfig {
  key: TableColumnKey;
  defaultLabel: string;
  label: string;
  visible: boolean;
  order: number;
  width: 'compact' | 'normal' | 'wide';
}

export interface DocumentModelConfig {
  templateKey: string;
  name: string;
  category: DocumentCategory;
  issuer: string;
  emitterUrl: string;
  primaryAutoFillField: AutoFillFieldKey;
  portalFieldsHint: string;
  isPermanent: boolean;
  defaultValidityDays: number | '';
  customWarningDays?: number | ''; // Alerta específico por modelo de certidão
  enabled: boolean;
  includeOnNewCompany: boolean;
  order: number;
  isCustomModel?: boolean;
}

export interface PdfReaderSettings {
  autoReadOnAttach: boolean;
  enableOcr: boolean;
  autoIdentifyCompany: boolean;
  suggestCompanyUpdates: boolean;
  detectDuplicates: boolean;
  useGeminiWhenAvailable: boolean;
  requireReviewBeforeSave: boolean;
}

export interface AppearanceSettings {
  theme: 'dark' | 'light';
  density: 'compact' | 'comfortable';
  pageSize: 10 | 25 | 50 | 100 | 9999;
  defaultSortBy: 'priority' | 'expiration' | 'name' | 'category';
  detailLevel: 'resumido' | 'detalhado';
  showQuickCompanyBar: boolean;
  showDashboardShortcuts: boolean;
  showBatchDropzoneOnDashboard: boolean;
}

export interface CompanySpecificOverride {
  companyId: string;
  hiddenCompanyFields?: (keyof CompanyProfile)[];
  requiredCompanyFields?: (keyof CompanyProfile)[];
  visibleCompanyFields?: (keyof CompanyProfile)[];
  disabledTemplateKeys?: string[];
  customWarningDays?: number;
}

export interface AppSettings {
  version: number;
  globalWarningDays: number;
  companyFields: CompanyFieldConfig[];
  certidaoFields: CertidaoFieldConfig[];
  customFields: CustomFieldDefinition[];
  tableColumns: TableColumnConfig[];
  documentModels: DocumentModelConfig[];
  pdfReader: PdfReaderSettings;
  appearance: AppearanceSettings;
  companyOverrides: Record<string, CompanySpecificOverride>;
}
