import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Upload,
  Eye,
  Download,
  Plus,
  Search,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ShieldCheck,
  Building2,
  Sun,
  Moon,
  DownloadCloud,
  UploadCloud,
  FileSpreadsheet,
  X,
  Calendar,
  Clock,
  Link2,
  FolderOpen,
  RotateCcw,
  ArrowUpDown,
  SlidersHorizontal,
  Zap,
  Database,
  Code2,
  UserCheck,
  KeyRound,
  Sparkles,
  FileScan,
  Loader2,
  History,
  ListChecks,
  Settings,
  MoreVertical,
  FileX,
  Tag,
  ChevronDown,
  Edit2,
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  HardDrive,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  CertidaoDocument,
  CompanyFieldDiff,
  CompanyProfile,
  CompanyBasicProfile,
  ComputedStatus,
  DocumentCategory,
  DocumentHistoryEntry,
  PendingPdfReviewItem,
  AppSettings,
} from './types/domain';
import {
  onlyDigits,
  formatCNPJ,
  formatCPF,
  isValidCNPJ,
  isValidCPF,
  computeDocumentFingerprint,
} from './utils/validators';
import {
  AutoFillFieldKey,
  OFFICIAL_PORTAL_ADAPTERS,
  buildCleanTargetUrl,
  dispatchAutofillBridgeEvent,
  generateSafeBookmarkletCode,
  generateSafeTampermonkeyScript,
  resolveCompanyFieldMap,
} from './utils/portalAdapters';
import { analyzeDocumentSmart } from './utils/pdfAnalyzer';
import { ReviewExtractionModal } from './components/ReviewExtractionModal';
import { DocumentHistoryView } from './components/DocumentHistoryView';
import { PendenciasCenterView } from './components/PendenciasCenterView';
import { BatchPdfImportView } from './components/BatchPdfImportView';
import { AssistedEmissionDrawer } from './components/AssistedEmissionDrawer';
import { SettingsCenterView } from './components/SettingsCenterView';
import { CompanyManagementView } from './components/CompanyManagementView';
import { DeletePdfModal } from './components/DeletePdfModal';
import { PdfViewerModal } from './components/PdfViewerModal';
import { CompanyDocumentAttachmentManager } from './components/CompanyDocumentAttachmentManager';
import { FirebaseSyncModal } from './components/FirebaseSyncModal';
import {
  signInWithGoogle,
  signOutUser,
  onAuthChange,
  fetchCloudUserData,
  generateSyncPreview,
  applySync,
  isOnline,
  subscribeNetworkStatus,
  SyncPreview,
  LocalAppData,
} from './utils/firebase';
import {
  mergeWithDefaultSettings,
  buildDefaultAppSettings,
  buildDocumentsFromConfiguredModels,
} from './utils/settingsConfig';

export type {
  DocumentCategory,
  ComputedStatus,
  AutoFillFieldKey,
  CompanyProfile,
  CompanyBasicProfile,
  CertidaoDocument,
  AppSettings,
};

function buildAutoFillTargetUrl(rawUrl: string, _comp?: CompanyProfile): string {
  return buildCleanTargetUrl(rawUrl);
}

function generateBookmarkletCode(comp: CompanyProfile): string {
  return generateSafeBookmarkletCode(comp);
}

function generateTampermonkeyScript(): string {
  return generateSafeTampermonkeyScript();
}

// ============================================================================
// INDEXED-DB STORAGE FOR PDF / IMAGE ATTACHMENTS
// ============================================================================

const DB_NAME = 'MagoLicitacoesAttachmentsDB';
const STORE_NAME = 'attachments';

function openAttachmentDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveAttachmentData(docId: string, dataUrl: string): Promise<void> {
  const db = await openAttachmentDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(dataUrl, docId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAttachmentData(docId: string): Promise<string | null> {
  const db = await openAttachmentDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(docId);
    req.onsuccess = () => resolve((req.result as string) || null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteAttachmentData(docId: string): Promise<void> {
  const db = await openAttachmentDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(docId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllAttachmentsMap(): Promise<Record<string, string>> {
  const db = await openAttachmentDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const map: Record<string, string> = {};
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        map[String(cursor.key)] = String(cursor.value);
        cursor.continue();
      } else {
        resolve(map);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

// ============================================================================
// INITIAL PIAUÍ COMPANIES & 23 CERTIDÕES TEMPLATE
// ============================================================================

const INITIAL_COMPANIES: CompanyProfile[] = [
  {
    id: 'comp-desinfecta',
    companyName: 'Desinfecta Serviços Ltda',
    tradeName: 'Desinfecta Controle de Pragas e Higienização',
    cnpj: '12.345.678/0001-90',
    stateRegistration: '19.456.789-0',
    municipalRegistration: '458920-1',
    nire: '22200123456',
    cnaeMain: '81.22-2-00 - Imunização e controle de pragas urbanas',
    cityState: 'Teresina - PI',
    cep: '64000-000',
    address: 'Av. Frei Serafim, Centro, Teresina - PI',
    email: 'licitacoes@desinfecta.com.br',
    phone: '(86) 99999-0000',
    partnerName: 'Sócio Administrador (Editar na Ficha)',
    partnerCpf: '111.222.333-44',
    partnerRg: '1.234.567 SSP-PI',
    partnerBirthDate: '1985-05-15',
    techResponsibleName: 'Responsável Técnico Habilitado',
    techResponsibleCouncil: 'CRQ / CREA-PI 001234',
    techResponsibleCpf: '222.333.444-55',
    portalAccessNotes: 'Portal SEMF Teresina / SIAT: Login com CNPJ | JUCEPI via Gov.br',
  },
  {
    id: 'comp-piaui-2',
    companyName: 'Empresa 02 - Piauí (Clique em Banco de Dados para editar)',
    tradeName: 'Empresa 02 Serviços',
    cnpj: '23.456.789/0001-11',
    stateRegistration: '19.888.111-2',
    municipalRegistration: '512300-4',
    nire: '22200654321',
    cnaeMain: '81.21-4-00 - Limpeza em prédios e em domicílios',
    cityState: 'Teresina - PI',
    cep: '64001-000',
    address: 'Teresina - PI',
    email: 'documentos@empresa02.com.br',
    phone: '(86) 98888-1111',
    partnerName: 'Representante Legal Empresa 02',
    partnerCpf: '333.444.555-66',
    partnerRg: '2.345.678 SSP-PI',
    partnerBirthDate: '1982-10-20',
    techResponsibleName: 'Engenheiro / Químico Responsável',
    techResponsibleCouncil: 'CREA-PI 998877',
    techResponsibleCpf: '444.555.666-77',
    portalAccessNotes: '',
  },
  {
    id: 'comp-piaui-3',
    companyName: 'Empresa 03 - Piauí (Clique em Banco de Dados para editar)',
    tradeName: 'Empresa 03 Conservação',
    cnpj: '34.567.890/0001-22',
    stateRegistration: '19.777.222-3',
    municipalRegistration: '619800-7',
    nire: '22200987654',
    cnaeMain: '43.30-4-99 - Obras de acabamento e serviços',
    cityState: 'Parnaíba / Teresina - PI',
    cep: '64200-000',
    address: 'Piauí - PI',
    email: 'contato@empresa03.com.br',
    phone: '(86) 97777-2222',
    partnerName: 'Representante Legal Empresa 03',
    partnerCpf: '555.666.777-88',
    partnerRg: '3.456.789 SSP-PI',
    partnerBirthDate: '1990-02-12',
    techResponsibleName: 'Responsável Técnico Empresa 03',
    techResponsibleCouncil: 'CREA-PI 554433',
    techResponsibleCpf: '666.777.888-99',
    portalAccessNotes: '',
  },
];

function buildInitialDocumentsForCompany(
  company: CompanyProfile,
  useSampleDates: boolean
): CertidaoDocument[] {
  const prefix = company.id;
  const now = new Date().toISOString();

  return [
    {
      id: `${prefix}-doc-01`,
      companyId: company.id,
      templateKey: 'tpl-01-cndt',
      name: 'CNDT (Certidão Negativa de Débitos Trabalhistas)',
      category: 'Fiscais e Trabalhistas',
      issuer: 'TST - Tribunal Superior do Trabalho',
      emitterUrl: 'https://cndt-certidao.tst.jus.br/',
      registrationCode: company.cnpj,
      primaryAutoFillField: 'cnpj_num',
      portalFieldsHint: 'Pede: CNPJ (somente números) + Captcha da imagem',
      issueDate: useSampleDates ? '2026-03-18' : '',
      validityDays: 180,
      expirationDate: useSampleDates ? '2026-09-14' : '',
      isPermanent: false,
      notes: 'Ao anexar o PDF emitido, o sistema lê as datas e o código automaticamente.',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-02`,
      companyId: company.id,
      templateKey: 'tpl-02-cnpj',
      name: 'Cartão CNPJ (Comprovante de Inscrição e Situação Cadastral)',
      category: 'Fiscais e Trabalhistas',
      issuer: 'Receita Federal',
      emitterUrl:
        'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp',
      registrationCode: company.cnpj,
      primaryAutoFillField: 'cnpj_num',
      portalFieldsHint: 'Pede: CNPJ (14 dígitos sem pontos) + Captcha Sou Humano',
      issueDate: useSampleDates ? '2026-01-17' : '',
      validityDays: 90,
      expirationDate: useSampleDates ? '2026-04-17' : '',
      isPermanent: false,
      notes: 'Anexar o Cartão CNPJ aqui também preenche os dados da empresa automaticamente.',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-03`,
      companyId: company.id,
      templateKey: 'tpl-03-cnd-federal',
      name: 'Dívida Ativa da União (CND Federal Conjunta RFB/PGFN)',
      category: 'Fiscais e Trabalhistas',
      issuer: 'Receita Federal / PGFN',
      emitterUrl:
        'https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir',
      registrationCode: company.cnpj,
      primaryAutoFillField: 'cnpj_num',
      portalFieldsHint: 'Pede: NI/CNPJ (somente números) + Captcha',
      issueDate: useSampleDates ? '2026-04-23' : '',
      validityDays: 180,
      expirationDate: useSampleDates ? '2026-10-20' : '',
      isPermanent: false,
      notes: 'Abrange tributos federais, INSS e Dívida Ativa da União.',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-04`,
      companyId: company.id,
      templateKey: 'tpl-04-pge-pi',
      name: 'Dívida Ativa do Estado do Piauí (PGE-PI / SEFAZ-PI)',
      category: 'Fiscais e Trabalhistas',
      issuer: 'SEFAZ-PI / PGE-PI',
      emitterUrl: 'https://webas.sefaz.pi.gov.br/certidaonft-web/index.xhtml',
      registrationCode: company.stateRegistration || company.cnpj,
      primaryAutoFillField: 'cnpj_num',
      portalFieldsHint: 'Pede: CNPJ ou Inscrição Estadual (IE SEFAZ-PI) + Captcha',
      issueDate: '',
      validityDays: 60,
      expirationDate: '',
      isPermanent: false,
      notes: 'Certidão Negativa da Dívida Ativa Estadual do Piauí.',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-05`,
      companyId: company.id,
      templateKey: 'tpl-05-sefaz-pi',
      name: 'Certidão Fiscal e Tributária Estadual (SEFAZ-PI)',
      category: 'Fiscais e Trabalhistas',
      issuer: 'SEFAZ-PI (Secretaria da Fazenda do Piauí)',
      emitterUrl: 'https://webas.sefaz.pi.gov.br/certidaonft-web/index.xhtml',
      registrationCode: company.stateRegistration || company.cnpj,
      primaryAutoFillField: 'cnpj_num',
      portalFieldsHint: 'Pede: CNPJ ou IE (19...) + Código da Imagem (Captcha)',
      issueDate: useSampleDates ? '2026-03-12' : '',
      validityDays: 60,
      expirationDate: useSampleDates ? '2026-05-11' : '',
      isPermanent: false,
      notes: 'Certidão de Situação Fiscal e Tributária Estadual - Piauí.',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-06`,
      companyId: company.id,
      templateKey: 'tpl-06-prefeitura-pi',
      name: 'Dívida Ativa do Município (CND Municipal / ISS)',
      category: 'Fiscais e Trabalhistas',
      issuer: 'Prefeitura Municipal (SEMF Teresina / PI)',
      emitterUrl: 'https://semf.pmt.pi.gov.br/',
      registrationCode: company.municipalRegistration || company.cnpj,
      primaryAutoFillField: 'im_num',
      portalFieldsHint: 'Pede: Inscrição Municipal (CMC) ou CNPJ + Captcha',
      issueDate: useSampleDates ? '2026-07-06' : '',
      validityDays: 90,
      expirationDate: useSampleDates ? '2026-10-04' : '',
      isPermanent: false,
      notes: 'Regularidade fiscal municipal e Dívida Ativa do Município.',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-07`,
      companyId: company.id,
      templateKey: 'tpl-07-falencia-tjpi',
      name: 'Certidão Negativa de Falência e Concordata (TJPI)',
      category: 'Fiscais e Trabalhistas',
      issuer: 'TJPI - Tribunal de Justiça do Piauí',
      emitterUrl: 'https://www.tjpi.jus.br/portaltjpi/certidoes/',
      registrationCode: company.cnpj,
      primaryAutoFillField: 'cnpj_num',
      portalFieldsHint: 'Pede: CNPJ + Razão Social + CPF/Nome do Solicitante + E-mail + Captcha',
      issueDate: useSampleDates ? '2026-06-14' : '',
      validityDays: 90,
      expirationDate: useSampleDates ? '2026-09-12' : '',
      isPermanent: false,
      notes: useSampleDates
        ? 'Vencimento principal em 12/09/2026 (segunda via em 15/05/2026).'
        : 'Certidão Cível de Falência e Recuperação Judicial - TJPI.',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-08`,
      companyId: company.id,
      templateKey: 'tpl-08-fgts',
      name: 'CRF - Certificado de Regularidade do FGTS',
      category: 'Fiscais e Trabalhistas',
      issuer: 'Caixa Econômica Federal',
      emitterUrl:
        'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf',
      registrationCode: company.cnpj,
      primaryAutoFillField: 'cnpj_num',
      portalFieldsHint: 'Pede: Inscrição CNPJ (só números) + UF (PI) + Captcha',
      issueDate: useSampleDates ? '2026-07-02' : '',
      validityDays: 30,
      expirationDate: useSampleDates ? '2026-08-01' : '',
      isPermanent: false,
      notes: 'Validade padrão de 30 dias.',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-09`,
      companyId: company.id,
      templateKey: 'tpl-09-jucepi',
      name: 'Certidão Simplificada e Específica (JUCEPI - Junta Comercial PI)',
      category: 'Fiscais e Trabalhistas',
      issuer: 'JUCEPI - Junta Comercial do Estado do Piauí',
      emitterUrl: 'https://www.pi.gov.br/orgaos/junta-comercial-do-estado-do-piaui-jucepi/',
      registrationCode: company.nire || company.cnpj,
      primaryAutoFillField: 'cnpj_num',
      portalFieldsHint: 'Pede: CNPJ ou NIRE + Login Gov.br',
      issueDate: useSampleDates ? '2025-08-08' : '',
      validityDays: 90,
      expirationDate: useSampleDates ? '2025-11-06' : '',
      isPermanent: false,
      notes: 'Emitida pela JUCEPI / Portal Gov.pi.',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-10`,
      companyId: company.id,
      templateKey: 'tpl-10-alvara',
      name: 'Alvará de Funcionamento',
      category: 'Alvarás, Licenças e Conselhos',
      issuer: 'Prefeitura Municipal (Teresina / PI)',
      emitterUrl: 'https://semf.pmt.pi.gov.br/',
      registrationCode: company.municipalRegistration || company.cnpj,
      primaryAutoFillField: 'im_num',
      portalFieldsHint: 'Pede: Inscrição Municipal (CMC) ou CNPJ',
      issueDate: useSampleDates ? '2026-01-15' : '',
      validityDays: 365,
      expirationDate: useSampleDates ? '2027-01-15' : '',
      isPermanent: false,
      notes: `Empresa: ${company.companyName}`,
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-11`,
      companyId: company.id,
      templateKey: 'tpl-11-bombeiros-pi',
      name: 'Licença / Certificado do Corpo de Bombeiros (CBMEPI)',
      category: 'Alvarás, Licenças e Conselhos',
      issuer: 'CBMEPI - Corpo de Bombeiros Militar do Piauí',
      emitterUrl: 'https://www.bombeiros.pi.gov.br/',
      registrationCode: company.cnpj,
      primaryAutoFillField: 'cnpj_num',
      portalFieldsHint: 'Pede: CNPJ + Protocolo de Vistoria CBMEPI',
      issueDate: useSampleDates ? '2026-02-10' : '',
      validityDays: 365,
      expirationDate: useSampleDates ? '2027-02-10' : '',
      isPermanent: false,
      notes: 'Atestado de Regularidade do Corpo de Bombeiros Militar do Piauí.',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-12`,
      companyId: company.id,
      templateKey: 'tpl-12-ambiental-pi',
      name: 'Licença Ambiental (SEMARH-PI / Secretaria Municipal)',
      category: 'Alvarás, Licenças e Conselhos',
      issuer: 'Órgão Ambiental (SEMARH-PI / SEMAM)',
      emitterUrl: 'https://www.semarh.pi.gov.br/',
      registrationCode: company.cnpj,
      primaryAutoFillField: 'cnpj_num',
      portalFieldsHint: 'Pede: CNPJ + CPF Representante Legal',
      issueDate: useSampleDates ? '2026-01-01' : '',
      validityDays: 365,
      expirationDate: useSampleDates ? '2026-12-31' : '',
      isPermanent: false,
      notes: 'Licença Ambiental de Operação vigente.',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-13`,
      companyId: company.id,
      templateKey: 'tpl-13-vigilancia-pi',
      name: 'Licença / Alvará de Vigilância Sanitária (DIVISA-PI / GVS)',
      category: 'Alvarás, Licenças e Conselhos',
      issuer: 'Vigilância Sanitária (DIVISA-PI / GVS Teresina)',
      emitterUrl: 'https://www.saude.pi.gov.br/',
      registrationCode: company.cnpj,
      primaryAutoFillField: 'cnpj_num',
      portalFieldsHint: 'Pede: CNPJ + Inscrição Municipal + Dados do RT',
      issueDate: useSampleDates ? '2026-01-01' : '',
      validityDays: 365,
      expirationDate: useSampleDates ? '2026-12-31' : '',
      isPermanent: false,
      notes: 'Alvará Sanitário anual.',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-14`,
      companyId: company.id,
      templateKey: 'tpl-14-aft',
      name: 'AFT (Autorização de Funcionamento / Atestado)',
      category: 'Alvarás, Licenças e Conselhos',
      issuer: 'ANVISA / Órgão Regulador',
      emitterUrl: 'https://consultas.anvisa.gov.br/',
      registrationCode: 'Ref: 009.2025',
      primaryAutoFillField: 'cnpj_num',
      portalFieldsHint: 'Pede: CNPJ da Empresa',
      issueDate: useSampleDates ? '2025-11-15' : '',
      validityDays: 365,
      expirationDate: useSampleDates ? '2026-11-15' : '',
      isPermanent: false,
      notes: 'Ref: 009.2025.',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-15`,
      companyId: company.id,
      templateKey: 'tpl-15-conselho',
      name: 'Certidão de Quitação e Regularidade (Conselho - CRQ/CRBio/CREA-PI)',
      category: 'Alvarás, Licenças e Conselhos',
      issuer: 'Conselho de Classe (CRQ / CRBio / CREA-PI)',
      emitterUrl: 'https://www.crea-pi.org.br/',
      registrationCode: company.techResponsibleCouncil || company.cnpj,
      primaryAutoFillField: 'council',
      portalFieldsHint: 'Pede: CNPJ ou Registro no Conselho + CPF do RT',
      issueDate: useSampleDates ? '2026-03-01' : '',
      validityDays: 365,
      expirationDate: useSampleDates ? '2027-03-01' : '',
      isPermanent: false,
      notes: 'Regularidade da empresa e do profissional responsável no Conselho.',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-16`,
      companyId: company.id,
      templateKey: 'tpl-16-trt-art',
      name: 'CTD de Anotação Técnica e Termo de Responsabilidade Técnica (TRT/ART)',
      category: 'Alvarás, Licenças e Conselhos',
      issuer: 'Conselho de Classe (CRQ / CRBio / CREA-PI)',
      emitterUrl: 'https://www.crea-pi.org.br/',
      registrationCode: company.techResponsibleCouncil || company.cnpj,
      primaryAutoFillField: 'council',
      portalFieldsHint: 'Pede: Registro no Conselho / CPF do RT',
      issueDate: useSampleDates ? '2026-03-10' : '',
      validityDays: 365,
      expirationDate: useSampleDates ? '2027-03-10' : '',
      isPermanent: false,
      notes: 'Certidão de Responsabilidade Técnica vigente.',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-17`,
      companyId: company.id,
      templateKey: 'tpl-17-descarte',
      name: 'Certificado de Descarte Regular de Resíduos',
      category: 'Alvarás, Licenças e Conselhos',
      issuer: 'Operador Credenciado / SEMARH-PI',
      emitterUrl: 'https://sinir.gov.br/',
      registrationCode: company.cnpj,
      primaryAutoFillField: 'cnpj_num',
      portalFieldsHint: 'Pede: CNPJ + Login SINIR/MTR',
      issueDate: useSampleDates ? '2026-02-01' : '',
      validityDays: 365,
      expirationDate: useSampleDates ? '2027-02-01' : '',
      isPermanent: false,
      notes: 'Destinação final ambientalmente adequada de resíduos e embalagens.',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-18`,
      companyId: company.id,
      templateKey: 'tpl-18-contrato-social',
      name: 'Contrato Social e Aditivo 3 Assinado',
      category: 'Societário, Contábil e Qualificação Técnica',
      issuer: 'JUCEPI - Junta Comercial do Estado do Piauí',
      emitterUrl: 'https://www.pi.gov.br/orgaos/junta-comercial-do-estado-do-piaui-jucepi/',
      registrationCode: company.nire || company.cnpj,
      primaryAutoFillField: 'nire',
      portalFieldsHint: 'Pede: NIRE ou CNPJ',
      issueDate: '2024-05-10',
      validityDays: '',
      expirationDate: '',
      isPermanent: true,
      notes: 'Documento societário permanente.',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-19`,
      companyId: company.id,
      templateKey: 'tpl-19-qsa',
      name: 'QSA (Quadro de Sócios e Administradores)',
      category: 'Societário, Contábil e Qualificação Técnica',
      issuer: 'Receita Federal / Redesim',
      emitterUrl:
        'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp',
      registrationCode: company.cnpj,
      primaryAutoFillField: 'cnpj_num',
      portalFieldsHint: 'Emitido junto ao Cartão CNPJ na Receita Federal',
      issueDate: '2025-11-06',
      validityDays: '',
      expirationDate: '',
      isPermanent: true,
      notes: 'Data ref: 06/11/2025.',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-20`,
      companyId: company.id,
      templateKey: 'tpl-20-cnh',
      name: 'CNH-e (Sócios / Representantes)',
      category: 'Societário, Contábil e Qualificação Técnica',
      issuer: 'DETRAN-PI / SENATRAN',
      emitterUrl: 'https://www.detran.pi.gov.br/',
      registrationCode: company.partnerCpf,
      primaryAutoFillField: 'cpf_num',
      portalFieldsHint: 'Pede: CPF do Sócio Administrador',
      issueDate: useSampleDates ? '2023-08-15' : '',
      validityDays: 1825,
      expirationDate: useSampleDates ? '2028-08-14' : '',
      isPermanent: false,
      notes: 'Documento de identificação dos sócios/representantes com controle de vencimento.',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-21`,
      companyId: company.id,
      templateKey: 'tpl-21-ie-im',
      name: 'Inscrição Estadual (IE - SEFAZ-PI) e Inscrição Municipal (IM)',
      category: 'Societário, Contábil e Qualificação Técnica',
      issuer: 'SEFAZ-PI / Prefeitura Municipal',
      emitterUrl: 'https://webas.sefaz.pi.gov.br/sintegra/',
      registrationCode: `IE: ${company.stateRegistration} | IM: ${company.municipalRegistration}`,
      primaryAutoFillField: 'ie_num',
      portalFieldsHint: 'Pede: Inscrição Estadual (IE) ou CNPJ + Captcha',
      issueDate: '2022-03-01',
      validityDays: '',
      expirationDate: '',
      isPermanent: true,
      notes: 'Ficha cadastral estadual (SINTEGRA/SEFAZ-PI) e municipal (CMC).',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-22`,
      companyId: company.id,
      templateKey: 'tpl-22-balanco',
      name: 'Balanços Patrimoniais e Índices Contábeis (2023, 2024, 2025)',
      category: 'Societário, Contábil e Qualificação Técnica',
      issuer: 'Contabilidade / SPED ECD / JUCEPI',
      emitterUrl: 'https://sped.rfb.gov.br/',
      registrationCode: company.cnpj,
      primaryAutoFillField: 'cnpj_num',
      portalFieldsHint: 'Pede: CNPJ + Recibo SPED',
      issueDate: useSampleDates ? '2026-04-30' : '',
      validityDays: 365,
      expirationDate: useSampleDates ? '2027-04-30' : '',
      isPermanent: false,
      notes: 'Renovação anual com cálculo de índices contábeis (ILC, ILG, SG).',
      fileType: 'none',
      updatedAt: now,
    },
    {
      id: `${prefix}-doc-23`,
      companyId: company.id,
      templateKey: 'tpl-23-atestados',
      name: 'Atestados de Capacidade Técnica (1, 2, 3 e Completo)',
      category: 'Societário, Contábil e Qualificação Técnica',
      issuer: 'Clientes Contratantes / Acervo Técnico',
      emitterUrl: '',
      registrationCode: company.cnpj,
      primaryAutoFillField: 'cnpj_num',
      portalFieldsHint: 'Acervo interno da empresa',
      issueDate: '2025-06-01',
      validityDays: '',
      expirationDate: '',
      isPermanent: true,
      notes: 'Acervo de atestados de capacidade técnica (permanente).',
      fileType: 'none',
      updatedAt: now,
    },
  ];
}

function buildAllInitialDocuments(): CertidaoDocument[] {
  return INITIAL_COMPANIES.flatMap((comp, idx) =>
    buildInitialDocumentsForCompany(comp, idx === 0)
  );
}

// ============================================================================
// DATE & STATUS CALCULATION HELPERS
// ============================================================================

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysToDateString(dateStr: string, days: number): string {
  if (!dateStr || isNaN(days)) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return '';
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  dt.setDate(dt.getDate() + Number(days));
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function diffDaysFromToday(expirationDateStr: string): number | null {
  if (!expirationDateStr) return null;
  const parts = expirationDateStr.split('-').map(Number);
  if (parts.length !== 3) return null;
  const exp = new Date(parts[0], parts[1] - 1, parts[2]);
  exp.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = exp.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

interface StatusEvaluation {
  status: ComputedStatus;
  daysRemaining: number | null;
  label: string;
  countdownText: string;
  sortWeight: number;
}

function evaluateDocumentStatus(
  doc: CertidaoDocument,
  warningThresholdDays: number
): StatusEvaluation {
  if (doc.awaitingReview) {
    return {
      status: 'aguardando_conferencia',
      daysRemaining: diffDaysFromToday(doc.expirationDate),
      label: 'Aguard. Conferência',
      countdownText: doc.expirationDate
        ? `Venc: ${formatDateBR(doc.expirationDate)}`
        : 'Revisar dados',
      sortWeight: -50000,
    };
  }

  if (doc.isPermanent) {
    return {
      status: 'permanente',
      daysRemaining: null,
      label: 'Permanente',
      countdownText: doc.issueDate ? `Ref: ${formatDateBR(doc.issueDate)}` : 'Prazo indeterminado',
      sortWeight: 100000,
    };
  }

  const days = diffDaysFromToday(doc.expirationDate);

  // Um documento sem data de vencimento NÃO deve ser classificado automaticamente como vencido!
  if (days === null) {
    return {
      status: 'sem_data',
      daysRemaining: null,
      label: 'Sem Data Informada',
      countdownText: 'Informar vencimento',
      sortWeight: 50000,
    };
  }

  if (days < 0) {
    return {
      status: 'vencido',
      daysRemaining: days,
      label: 'Vencido',
      countdownText: `Vencido há ${Math.abs(days)}d`,
      sortWeight: days,
    };
  }

  if (days === 0) {
    return {
      status: 'vencido',
      daysRemaining: 0,
      label: 'Vence Hoje!',
      countdownText: 'Vence hoje!',
      sortWeight: 0,
    };
  }

  if (days <= warningThresholdDays) {
    return {
      status: 'atencao',
      daysRemaining: days,
      label: 'Próximo ao Venc.',
      countdownText: `Faltam ${days}d`,
      sortWeight: days,
    };
  }

  return {
    status: 'vigente',
    daysRemaining: days,
    label: 'Vigente',
    countdownText: `Faltam ${days}d`,
    sortWeight: days,
  };
}

// ============================================================================
// HELPER: COMPUTE DIFFS BETWEEN CURRENT COMPANY PROFILE AND EXTRACTED PDF DATA
// ============================================================================

const COMPANY_FIELD_LABELS: { field: keyof CompanyProfile; label: string }[] = [
  { field: 'companyName', label: 'Razão Social' },
  { field: 'tradeName', label: 'Nome Fantasia' },
  { field: 'cnpj', label: 'CNPJ' },
  { field: 'stateRegistration', label: 'Inscrição Estadual (IE)' },
  { field: 'municipalRegistration', label: 'Inscrição Municipal (IM)' },
  { field: 'nire', label: 'NIRE (JUCEPI)' },
  { field: 'cnaeMain', label: 'CNAE Principal' },
  { field: 'cityState', label: 'Município / UF' },
  { field: 'cep', label: 'CEP' },
  { field: 'address', label: 'Endereço' },
  { field: 'email', label: 'E-mail' },
  { field: 'phone', label: 'Telefone' },
  { field: 'partnerName', label: 'Representante Legal / Sócio' },
  { field: 'partnerCpf', label: 'CPF do Sócio' },
  { field: 'techResponsibleName', label: 'Responsável Técnico' },
  { field: 'techResponsibleCouncil', label: 'Registro no Conselho' },
];

function buildCompanyFieldDiffs(
  company: CompanyProfile,
  extractedData: Partial<CompanyProfile> | undefined
): CompanyFieldDiff[] {
  if (!extractedData) return [];
  const diffs: CompanyFieldDiff[] = [];

  for (const { field, label } of COMPANY_FIELD_LABELS) {
    const proposed = String(extractedData[field] ?? '').trim();
    if (!proposed) continue;

    const current = String(company[field] ?? '').trim();
    const isSameDigits =
      (field === 'cnpj' || field === 'partnerCpf' || field === 'cep') &&
      onlyDigits(current) === onlyDigits(proposed);

    if (current.toLowerCase() === proposed.toLowerCase() || isSameDigits) {
      continue;
    }

    const isPlaceholder =
      !current ||
      current.includes('Empresa 0') ||
      current.includes('Clique') ||
      current.includes('Editar na Ficha') ||
      current.includes('Representante Legal Empresa');

    diffs.push({
      field,
      label,
      currentValue: current,
      proposedValue: proposed,
      // Sugere marcado por padrão apenas se o campo atual estiver vazio ou com texto placeholder inicial
      selected: isPlaceholder,
      isValidDocumentNumber:
        field === 'cnpj'
          ? isValidCNPJ(proposed)
          : field === 'partnerCpf'
          ? isValidCPF(proposed)
          : null,
    });
  }

  return diffs;
}

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================

const STORAGE_KEY_COMPANIES = 'mago_licitacoes_companies_v2';
const STORAGE_KEY_ACTIVE_COMPANY = 'mago_licitacoes_active_comp_v2';
const STORAGE_KEY_DOCS = 'mago_licitacoes_docs_v2';
const STORAGE_KEY_HISTORY = 'mago_licitacoes_history_v1';
const STORAGE_KEY_WARNING_DAYS = 'mago_licitacoes_warning_days_v2';
const STORAGE_KEY_THEME = 'mago_licitacoes_theme_v1';
const STORAGE_KEY_SETTINGS = 'mago_licitacoes_settings_v1';

export default function App() {
  // App Settings (Central de Configurações)
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      return mergeWithDefaultSettings(saved ? JSON.parse(saved) : null);
    } catch {
      return buildDefaultAppSettings();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn('Falha ao salvar configurações no localStorage:', e);
    }
  }, [settings]);

  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    return saved ? saved === 'dark' : true;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem(STORAGE_KEY_THEME, 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem(STORAGE_KEY_THEME, 'light');
    }
  }, [darkMode]);

  // Multi-company state (preservando integralmente os dados existentes sem recriar mock se usuário apagou)
  const [companies, setCompanies] = useState<CompanyProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COMPANIES);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // If the user intentionally emptied the list, parsed is [] -> return empty array!
          if (parsed.length === 0) return [];
          return parsed.map((c: Partial<CompanyProfile>, idx: number) => ({
            ...INITIAL_COMPANIES[idx % INITIAL_COMPANIES.length],
            ...c,
          }));
        }
      }
      return INITIAL_COMPANIES;
    } catch {
      return INITIAL_COMPANIES;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_COMPANIES, JSON.stringify(companies));
  }, [companies]);

  // Selected Company Filter
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_COMPANY);
    return saved || (companies[0]?.id ?? '');
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ACTIVE_COMPANY, selectedCompanyId);
  }, [selectedCompanyId]);

  const activeCompany = useMemo<CompanyProfile>(() => {
    const found = companies.find((c) => c.id === selectedCompanyId) || companies[0];
    if (found) return found;
    return {
      id: 'comp-empty',
      companyName: 'Nenhuma Empresa Cadastrada',
      tradeName: '',
      cnpj: '',
      stateRegistration: '',
      municipalRegistration: '',
      nire: '',
      cnaeMain: '',
      cityState: 'Teresina - PI',
      cep: '64000-000',
      address: '',
      email: '',
      phone: '',
      partnerName: '',
      partnerCpf: '',
      partnerRg: '',
      partnerBirthDate: '',
      techResponsibleName: '',
      techResponsibleCouncil: '',
      techResponsibleCpf: '',
      portalAccessNotes: '',
    };
  }, [companies, selectedCompanyId]);

  // Warning threshold days (60, 30, 15, 7, 1 dia)
  const [warningThresholdDays, setWarningThresholdDays] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_WARNING_DAYS);
    return saved ? Number(saved) || 30 : 30;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WARNING_DAYS, String(warningThresholdDays));
  }, [warningThresholdDays]);

  // Documents state (preservando integralmente os registros existentes)
  const [documents, setDocuments] = useState<CertidaoDocument[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DOCS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
      return buildAllInitialDocuments();
    } catch {
      return buildAllInitialDocuments();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(documents));
  }, [documents]);

  // Document History state (preserva versões e PDFs anteriores)
  const [documentHistory, setDocumentHistory] = useState<DocumentHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(documentHistory));
  }, [documentHistory]);

  // Filtering, search & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ComputedStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | DocumentCategory>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'name' | 'category' | 'expiration'>('priority');
  const [activeSection, setActiveSection] = useState<
    | 'dashboard'
    | 'companies'
    | 'settings'
    | 'batch_import'
    | 'pendencias'
    | 'history'
    | 'company_db'
    | 'links'
    | 'backup'
  >('dashboard');
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>(undefined);
  const [historyFilterDocId, setHistoryFilterDocId] = useState<string | null>(null);

  // Dedicated PDF Modals State
  const [deletingPdfDoc, setDeletingPdfDoc] = useState<CertidaoDocument | null>(null);
  const [viewingPdfDoc, setViewingPdfDoc] = useState<CertidaoDocument | null>(null);

  // PDF Reading & Review Queue State ("CONFERIR DADOS")
  const [analyzingDocId, setAnalyzingDocId] = useState<string | null>(null);
  const [isSmartReadingBatch, setIsSmartReadingBatch] = useState(false);
  const [readingProgressText, setReadingProgressText] = useState('');
  const [pendingReviewItems, setPendingReviewItems] = useState<PendingPdfReviewItem[]>([]);
  const [lastExtractionSummary, setLastExtractionSummary] = useState<{
    fileName: string;
    documentTitle: string;
    companyName: string;
    issueDate: string;
    expirationDate: string;
    controlCode: string;
    fieldsUpdatedInCompany: string[];
  } | null>(null);

  // Copy & Toast feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  // ============================================================================
  // FIREBASE AUTH & CLOUD FIRESTORE SYNC
  // ============================================================================
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [isOnlineState, setIsOnlineState] = useState<boolean>(() => isOnline());
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncPreview, setSyncPreview] = useState<SyncPreview | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem('mago_last_sync_time');
  });

  useEffect(() => {
    const unsub = onAuthChange((user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeNetworkStatus((online) => {
      setIsOnlineState(online);
      if (!online) {
        showToast('Você está em modo offline. As modificações continuarão sendo salvas localmente.');
      } else {
        showToast('Conexão com a internet restabelecida.');
      }
    });
    return () => unsub();
  }, []);

  const handleGoogleLogin = async () => {
    const { user, error } = await signInWithGoogle();
    if (error) {
      showToast(error);
      return;
    }
    if (user) {
      showToast(`Bem-vindo, ${user.displayName || user.email}!`);
      // Exigência 3: Primeira sincronização com prévia e confirmação
      handleOpenSyncModal(user);
    }
  };

  const handleGoogleLogout = async () => {
    await signOutUser();
    setCurrentUser(null);
    showToast('Você saiu da sua conta Google. Seus dados locais permanecem salvos.');
  };

  const handleOpenSyncModal = async (overrideUser?: User | null) => {
    const targetUser = overrideUser || currentUser;
    if (!targetUser) {
      await handleGoogleLogin();
      return;
    }
    if (!isOnlineState) {
      showToast('Você está offline. Conecte-se à internet para sincronizar com o Firestore.');
      return;
    }

    try {
      setIsSyncing(true);
      const cloudData = await fetchCloudUserData(targetUser.uid);
      const localData: LocalAppData = {
        companies,
        documents,
        history: documentHistory,
        settings,
        activeCompanyId: selectedCompanyId,
        warningThresholdDays: settings.globalWarningDays,
      };
      const preview = generateSyncPreview(localData, cloudData);
      setSyncPreview(preview);
      setIsSyncModalOpen(true);
    } catch (err: any) {
      console.error('Falha ao consultar dados do Cloud Firestore:', err);
      showToast('Não foi possível obter dados da nuvem. Verifique sua conexão.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfirmSync = async () => {
    if (!currentUser || !syncPreview) return;
    setIsSyncing(true);
    try {
      const cloudData = await fetchCloudUserData(currentUser.uid);
      const localData: LocalAppData = {
        companies,
        documents,
        history: documentHistory,
        settings,
        activeCompanyId: selectedCompanyId,
        warningThresholdDays: settings.globalWarningDays,
      };
      const res = await applySync(currentUser.uid, localData, cloudData, syncPreview);
      if (res.success) {
        setCompanies(res.mergedData.companies);
        setDocuments(res.mergedData.documents);
        setDocumentHistory(res.mergedData.history);
        if (res.mergedData.settings) {
          setSettings(res.mergedData.settings);
        }
        const nowStr = new Date().toLocaleString('pt-BR');
        setLastSyncTime(nowStr);
        localStorage.setItem('mago_last_sync_time', nowStr);
        setIsSyncModalOpen(false);
        showToast('Sincronização com o Cloud Firestore concluída com sucesso!');
      } else {
        showToast(res.error || 'Erro durante a sincronização com o Firestore.');
      }
    } catch (err: any) {
      console.error('Erro na sincronização:', err);
      showToast('Falha na sincronização.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Active Emission Assistant Drawer
  const [activeEmissionSession, setActiveEmissionSession] = useState<{
    doc: CertidaoDocument;
    company: CompanyProfile;
    copiedFieldLabel: string;
    copiedValue: string;
    targetUrl: string;
  } | null>(null);

  // Navigation dropdown and confirmation states
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [companyToDeleteConfirm, setCompanyToDeleteConfirm] = useState<CompanyProfile | null>(null);

  // Inline cell editing state
  const [inlineEdit, setInlineEdit] = useState<{
    docId: string;
    field:
      | 'highlightName'
      | 'name'
      | 'issuer'
      | 'registrationCode'
      | 'emitterUrl'
      | 'issueDate'
      | 'validityDays'
      | 'expirationDate';
    value: string;
    syncAllCompanies?: boolean;
  } | null>(null);

  // Modals state
  const [editingDoc, setEditingDoc] = useState<CertidaoDocument | null>(null);
  const [isNewDocModal, setIsNewDocModal] = useState(false);
  const [renewingDoc, setRenewingDoc] = useState<{
    doc: CertidaoDocument;
    newIssueDate: string;
    newValidityDays: number;
    newExpirationDate: string;
    newControlCode: string;
    newCertificateNumber: string;
    newDocumentSituation: string;
    newDriveUrl: string;
    newFile?: File | null;
    extractedInfo?: string;
  } | null>(null);
  const [previewModal, setPreviewModal] = useState<{
    doc: { name: string; fileName?: string; fileMimeType?: string; driveUrl?: string; id?: string };
    dataUrl: string | null;
  } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [showTampermonkeyModal, setShowTampermonkeyModal] = useState(false);

  // New Company Modal state
  const [companyModal, setCompanyModal] = useState<{
    isNew: boolean;
    profile: CompanyProfile;
    cloneStandardDocs: boolean;
  } | null>(null);

  const fileInputImportRef = useRef<HTMLInputElement | null>(null);
  const smartPdfInputRef = useRef<HTMLInputElement | null>(null);
  const companyPdfInputRef = useRef<HTMLInputElement | null>(null);

  // Filter documents by selected company first
  const companyScopedDocuments = useMemo(() => {
    if (selectedCompanyId === 'all') return documents;
    return documents.filter((d) => d.companyId === selectedCompanyId);
  }, [documents, selectedCompanyId]);

  // Enrich documents with real-time status evaluation and company info
  const enrichedDocuments = useMemo(() => {
    const companyMap = new Map(companies.map((c) => [c.id, c]));
    return companyScopedDocuments.map((doc) => ({
      doc,
      company: companyMap.get(doc.companyId) || activeCompany,
      eval: evaluateDocumentStatus(doc, warningThresholdDays),
    }));
  }, [companyScopedDocuments, companies, activeCompany, warningThresholdDays]);

  // Executive Summary counts (incluindo sem_data e aguardando_conferencia separados de vencido!)
  const summaryCounts = useMemo(() => {
    const counts = {
      total: enrichedDocuments.length,
      vigente: 0,
      atencao: 0,
      vencido: 0,
      permanente: 0,
      sem_data: 0,
      aguardando_conferencia: 0,
    };
    for (const item of enrichedDocuments) {
      counts[item.eval.status]++;
    }
    return counts;
  }, [enrichedDocuments]);

  // Filtered and Sorted documents
  const filteredDocuments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = enrichedDocuments.filter(({ doc, company: comp, eval: ev }) => {
      if (statusFilter !== 'all' && ev.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && doc.category !== categoryFilter) return false;
      if (q) {
        const hay = `${doc.highlightName || ''} ${doc.name} ${doc.issuer} ${doc.category} ${doc.registrationCode} ${doc.controlCode || ''} ${doc.certificateNumber || ''} ${doc.notes} ${comp?.companyName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // Helper to get sort name prioritizing highlightName (apelido de destaque)
    const getDocSortName = (doc: CertidaoDocument) => (doc.highlightName?.trim() || doc.name);

    list.sort((a, b) => {
      if (sortBy === 'priority') {
        const rankOrder: Record<ComputedStatus, number> = {
          vencido: 1,
          atencao: 2,
          aguardando_conferencia: 3,
          sem_data: 4,
          vigente: 5,
          permanente: 6,
        };
        if (rankOrder[a.eval.status] !== rankOrder[b.eval.status]) {
          return rankOrder[a.eval.status] - rankOrder[b.eval.status];
        }
        if (a.eval.sortWeight !== b.eval.sortWeight) {
          return a.eval.sortWeight - b.eval.sortWeight;
        }
        return getDocSortName(a.doc).localeCompare(getDocSortName(b.doc), 'pt-BR');
      }
      if (sortBy === 'name') {
        return getDocSortName(a.doc).localeCompare(getDocSortName(b.doc), 'pt-BR');
      }
      if (sortBy === 'category') {
        const c = a.doc.category.localeCompare(b.doc.category, 'pt-BR');
        return c !== 0 ? c : a.eval.sortWeight - b.eval.sortWeight;
      }
      if (sortBy === 'expiration') {
        return a.eval.sortWeight - b.eval.sortWeight;
      }
      return 0;
    });

    return list;
  }, [enrichedDocuments, searchQuery, statusFilter, categoryFilter, sortBy]);

  // ============================================================================
  // HELPER: ARCHIVE PREVIOUS DOCUMENT VERSION INTO HISTORY BEFORE UPDATING
  // ============================================================================

  const archiveDocumentVersionToHistory = async (
    existingDoc: CertidaoDocument,
    reason: string
  ): Promise<void> => {
    // Arquiva apenas se a certidão anterior já tinha uma data de emissão, código ou PDF anexado
    if (
      !existingDoc.issueDate &&
      !existingDoc.expirationDate &&
      existingDoc.fileType === 'none' &&
      !existingDoc.controlCode
    ) {
      return;
    }

    const histId = `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let attachmentHistoryKey: string | undefined;

    if (existingDoc.fileType === 'local') {
      const prevDataUrl = await getAttachmentData(existingDoc.id);
      if (prevDataUrl) {
        attachmentHistoryKey = `hist-att-${histId}`;
        await saveAttachmentData(attachmentHistoryKey, prevDataUrl);
      }
    }

    const comp = companies.find((c) => c.id === existingDoc.companyId);

    const entry: DocumentHistoryEntry = {
      id: histId,
      documentId: existingDoc.id,
      companyId: existingDoc.companyId,
      companyName: comp?.companyName || 'Empresa',
      documentName: existingDoc.name,
      templateKey: existingDoc.templateKey,
      category: existingDoc.category,
      issuer: existingDoc.issuer,
      issueDate: existingDoc.issueDate,
      validityDays: existingDoc.validityDays,
      expirationDate: existingDoc.expirationDate,
      certificateNumber: existingDoc.certificateNumber,
      controlCode: existingDoc.controlCode,
      documentSituation: existingDoc.documentSituation,
      fileName: existingDoc.fileName,
      fileMimeType: existingDoc.fileMimeType,
      fileSize: existingDoc.fileSize,
      attachmentHistoryKey,
      driveUrl: existingDoc.driveUrl,
      archivedAt: new Date().toISOString(),
      replacementReason: reason,
    };

    setDocumentHistory((prev) => [entry, ...prev]);
  };

  // ============================================================================
  // HANDLERS: FREE SMART PDF READING + BATCH IMPORT + REVIEW ("CONFERIR DADOS")
  // ============================================================================

  /**
   * Processa 1 ou vários PDFs/imagens usando PDF.js + Tesseract.js local gratuito
   * (e opcionalmente Gemini), identifica empresa + certidão, detecta duplicados
   * e abre a tela de CONFERÊNCIA antes de salvar!
   */
  const processFilesForReviewQueue = async (
    rawFiles: FileList | File[],
    options?: {
      forceDocId?: string;
      forceCompanyId?: string;
      useGeminiComplement?: boolean;
      mode?: 'certificate' | 'company_profile' | 'auto_match';
    }
  ) => {
    const fileArray = Array.from(rawFiles);
    if (fileArray.length === 0) return;

    setIsSmartReadingBatch(true);
    if (options?.forceDocId) {
      setAnalyzingDocId(options.forceDocId);
    }

    const newReviewItems: PendingPdfReviewItem[] = [];
    const seenFingerprintsInBatch = new Set<string>();

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setReadingProgressText(
        `Lendo arquivo ${i + 1} de ${fileArray.length}: "${file.name}"...`
      );

      try {
        const dataUrl = await readFileAsDataURL(file);
        const extracted = await analyzeDocumentSmart(file, dataUrl, companies, {
          useGeminiComplement: options?.useGeminiComplement,
          mode: options?.mode || 'auto_match',
          onProgress: (msg) =>
            setReadingProgressText(`(${i + 1}/${fileArray.length}) ${file.name}: ${msg}`),
        });

        // 1. Localizar empresa correspondente pelo CNPJ ou Razão Social
        let matchedCompany: CompanyProfile | undefined;
        let hasCompanyMismatch = false;
        let companyMismatchReason = '';

        if (options?.forceCompanyId) {
          matchedCompany = companies.find((c) => c.id === options.forceCompanyId);
        }
        if (!matchedCompany && extracted.companyData.cnpj) {
          const extDigits = onlyDigits(extracted.companyData.cnpj);
          matchedCompany = companies.find((c) => onlyDigits(c.cnpj) === extDigits);
        }
        if (!matchedCompany && extracted.companyData.companyName) {
          const normName = extracted.companyData.companyName.toLowerCase().slice(0, 14);
          matchedCompany = companies.find((c) =>
            c.companyName.toLowerCase().includes(normName)
          );
        }

        // Se o documento tem um CNPJ específico e esse CNPJ não bate com a empresa:
        if (extracted.companyData.cnpj) {
          const extDigits = onlyDigits(extracted.companyData.cnpj);
          if (matchedCompany && onlyDigits(matchedCompany.cnpj) !== extDigits) {
            hasCompanyMismatch = true;
            companyMismatchReason = `O documento contém o CNPJ ${extracted.companyData.cnpj}, que diverge da empresa selecionada (${matchedCompany.cnpj}).`;
          } else if (!matchedCompany) {
            hasCompanyMismatch = true;
            companyMismatchReason = `O documento contém o CNPJ ${extracted.companyData.cnpj}, que não pertence a nenhuma empresa cadastrada. Selecione a empresa ou cadastre uma nova.`;
            matchedCompany = activeCompany;
          }
        }

        if (!matchedCompany) {
          matchedCompany = activeCompany;
        }

        // 2. Localizar documento correspondente dentro da empresa
        const companyDocs = documents.filter((d) => d.companyId === matchedCompany!.id);
        let matchedDoc: CertidaoDocument | undefined;

        if (options?.forceDocId) {
          matchedDoc = documents.find((d) => d.id === options.forceDocId);
          if (matchedDoc) {
            matchedCompany =
              companies.find((c) => c.id === matchedDoc!.companyId) || matchedCompany;
          }
        }
        if (!matchedDoc && extracted.matchedTemplateKey) {
          matchedDoc = companyDocs.find(
            (d) => d.templateKey === extracted.matchedTemplateKey
          );
        }
        if (!matchedDoc && extracted.documentTitle) {
          const tLower = extracted.documentTitle.toLowerCase();
          matchedDoc = companyDocs.find((d) =>
            d.name.toLowerCase().includes(tLower.slice(0, 12))
          );
        }

        // 3. Verificar duplicidade (no lote atual ou nos documentos já cadastrados)
        const fp = computeDocumentFingerprint(
          file.name,
          file.size,
          extracted.controlCode,
          extracted.issueDate,
          extracted.matchedTemplateKey || matchedDoc?.templateKey,
          extracted.companyData.cnpj || matchedCompany.cnpj
        );

        let isDuplicate = false;
        let duplicateReason = '';

        if (seenFingerprintsInBatch.has(fp)) {
          isDuplicate = true;
          duplicateReason = 'Este mesmo documento aparece mais de uma vez na seleção atual.';
        } else {
          seenFingerprintsInBatch.add(fp);
          const existingSame = companyDocs.find(
            (d) =>
              (extracted.controlCode &&
                d.controlCode &&
                d.controlCode.toLowerCase() === extracted.controlCode.toLowerCase()) ||
              (d.fileName === file.name &&
                d.fileSize === file.size &&
                d.issueDate === extracted.issueDate &&
                Boolean(extracted.issueDate))
          );
          if (existingSame) {
            isDuplicate = true;
            duplicateReason = `Já existe cadastro com o mesmo arquivo/código em "${existingSame.name}" (Emissão: ${formatDateBR(existingSame.issueDate)}).`;
          }
        }

        // 4. Comparar dados cadastrais da empresa com o banco atual
        const companyDiffs = buildCompanyFieldDiffs(matchedCompany, extracted.companyData);

        const isUnidentified = !matchedDoc && !extracted.matchedTemplateKey;

        newReviewItems.push({
          tempId: `rev-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          fileName: file.name,
          fileSize: file.size,
          fileMimeType: file.type || 'application/pdf',
          dataUrl,
          selectedToSave: !isDuplicate && !hasCompanyMismatch,
          isDuplicate,
          duplicateReason,
          isUnidentified,
          isUnreadable: extracted.isUnreadable,
          hasCompanyMismatch,
          companyMismatchReason,
          warnings: extracted.warnings,
          extractionEngine: extracted.extractionEngine,
          matchedCompanyId: matchedCompany.id,
          matchedDocId: matchedDoc ? matchedDoc.id : '',
          documentTitle: matchedDoc ? matchedDoc.name : extracted.documentTitle,
          matchedTemplateKey:
            matchedDoc?.templateKey || extracted.matchedTemplateKey || '',
          category: matchedDoc ? matchedDoc.category : extracted.category,
          issuer: matchedDoc ? matchedDoc.issuer : extracted.issuer,
          issueDate: extracted.issueDate || matchedDoc?.issueDate || '',
          validityDays:
            extracted.validityDays > 0
              ? extracted.validityDays
              : matchedDoc?.validityDays || 90,
          expirationDate:
            extracted.expirationDate || matchedDoc?.expirationDate || '',
          isPermanent: matchedDoc ? matchedDoc.isPermanent : extracted.isPermanent,
          certificateNumber: extracted.certificateNumber || '',
          controlCode: extracted.controlCode || '',
          documentSituation: extracted.documentSituation || 'Regular / Vigente',
          notes: extracted.summaryNotes || matchedDoc?.notes || '',
          extractedCnpj: extracted.companyData.cnpj || '',
          cnpjValid: extracted.cnpjValid,
          companyDiffs,
        });
      } catch (fileErr: unknown) {
        // A falha de leitura de um arquivo não interrompe os demais!
        const errMsg =
          fileErr instanceof Error
            ? fileErr.message
            : 'Erro ao ler a estrutura do arquivo.';
        let fallbackDataUrl = '';
        try {
          fallbackDataUrl = await readFileAsDataURL(file);
        } catch {
          // ignore
        }

        newReviewItems.push({
          tempId: `rev-err-${Date.now()}-${i}`,
          fileName: file.name,
          fileSize: file.size,
          fileMimeType: file.type || 'application/pdf',
          dataUrl: fallbackDataUrl,
          selectedToSave: false,
          isDuplicate: false,
          isUnidentified: true,
          isUnreadable: true,
          warnings: [
            `Não foi possível ler automaticamente este arquivo (${errMsg}). Você pode preencher manualmente abaixo se desejar salvar.`,
          ],
          extractionEngine: 'pdfjs-local',
          matchedCompanyId: options?.forceCompanyId || activeCompany.id,
          matchedDocId: options?.forceDocId || '',
          documentTitle: file.name.replace(/\.[^.]+$/, ''),
          matchedTemplateKey: '',
          category: 'Fiscais e Trabalhistas',
          issuer: '',
          issueDate: '',
          validityDays: 90,
          expirationDate: '',
          isPermanent: false,
          certificateNumber: '',
          controlCode: '',
          documentSituation: '',
          notes: '',
          extractedCnpj: '',
          cnpjValid: null,
          companyDiffs: [],
        });
      }
    }

    setPendingReviewItems((prev) => [...prev, ...newReviewItems]);
    setIsSmartReadingBatch(false);
    setAnalyzingDocId(null);
    setReadingProgressText('');
  };

  const handleAttachFileToDoc = async (docId: string, file: File) => {
    const targetDoc = documents.find((d) => d.id === docId);
    await processFilesForReviewQueue([file], {
      forceDocId: docId,
      forceCompanyId: targetDoc?.companyId || activeCompany.id,
      mode: 'certificate',
    });
  };

  const handleSmartUploadAndMatch = async (
    files: FileList | File[] | null,
    useGeminiComplement = false
  ) => {
    if (!files || files.length === 0) return;
    await processFilesForReviewQueue(files, {
      useGeminiComplement,
      mode: 'auto_match',
    });
  };

  const handlePopulateCompanyFromPdf = async (file: File) => {
    await processFilesForReviewQueue([file], {
      forceCompanyId: activeCompany.id,
      mode: 'company_profile',
    });
  };

  /**
   * Permite refinar um item específico da tela de conferência usando a IA complementar (Gemini)
   */
  const handleRunGeminiEnrichItem = async (tempId: string) => {
    const target = pendingReviewItems.find((i) => i.tempId === tempId);
    if (!target || !target.dataUrl) return;

    setIsSmartReadingBatch(true);
    setReadingProgressText(`Refinando "${target.fileName}" com IA...`);
    try {
      const res = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataUrl: target.dataUrl,
          fileName: target.fileName,
          mode: 'auto_match',
        }),
      });
      const json = await res.json();
      if (!json.available || !json.data) {
        showToast('Leitura local ativa (IA complementar não configurada ou sem dados adicionais).');
        return;
      }
      const ai = json.data;
      const comp =
        companies.find((c) => c.id === target.matchedCompanyId) || activeCompany;
      const diffs = buildCompanyFieldDiffs(comp, ai.companyData);

      setPendingReviewItems((prev) =>
        prev.map((item) => {
          if (item.tempId !== tempId) return item;
          return {
            ...item,
            extractionEngine: 'hybrid-gemini',
            documentTitle: ai.documentTitle || item.documentTitle,
            issuer: ai.issuer || item.issuer,
            issueDate: ai.issueDate || item.issueDate,
            validityDays: ai.validityDays || item.validityDays,
            expirationDate: ai.expirationDate || item.expirationDate,
            certificateNumber: ai.certificateNumber || item.certificateNumber,
            controlCode: ai.controlCode || item.controlCode,
            documentSituation: ai.documentSituation || item.documentSituation,
            notes: ai.summaryNotes || item.notes,
            companyDiffs: diffs.length > 0 ? diffs : item.companyDiffs,
          };
        })
      );
      showToast('Dados refinados com IA complementar!');
    } catch {
      showToast('Mantendo dados extraídos localmente.');
    } finally {
      setIsSmartReadingBatch(false);
      setReadingProgressText('');
    }
  };

  /**
   * Confirma e salva todos os itens marcados na janela "CONFERIR DADOS":
   * 1. Arquiva a versão anterior e seu PDF no Histórico de Documentos.
   * 2. Salva o novo PDF no IndexedDB.
   * 3. Atualiza as datas, código de autenticidade e situação da certidão.
   * 4. Atualiza no Banco de Empresas APENAS os campos que o usuário marcou!
   */
  const handleConfirmPendingReviews = async () => {
    const selectedItems = pendingReviewItems.filter((i) => i.selectedToSave);
    if (selectedItems.length === 0) {
      setPendingReviewItems([]);
      return;
    }

    const updatedFieldsSummary: string[] = [];

    for (const item of selectedItems) {
      // 1. Aplicar apenas as alterações cadastrais da empresa confirmadas pelo usuário
      const confirmedDiffs = item.companyDiffs.filter((d) => d.selected);
      if (confirmedDiffs.length > 0) {
        setCompanies((prev) =>
          prev.map((c) => {
            if (c.id !== item.matchedCompanyId) return c;
            const updatedComp = { ...c };
            for (const diff of confirmedDiffs) {
              (updatedComp as any)[diff.field] = diff.proposedValue;
              if (!updatedFieldsSummary.includes(diff.label)) {
                updatedFieldsSummary.push(diff.label);
              }
            }
            return updatedComp;
          })
        );
      }

      // 2. Atualizar documento existente ou criar novo documento na empresa
      if (item.matchedDocId) {
        const existingDoc = documents.find((d) => d.id === item.matchedDocId);
        if (existingDoc) {
          await archiveDocumentVersionToHistory(
            existingDoc,
            'Substituição confirmada via Leitura Inteligente de PDF'
          );
        }

        if (item.dataUrl) {
          await saveAttachmentData(item.matchedDocId, item.dataUrl);
        }

        const noteParts = [
          item.documentSituation ? `Situação: ${item.documentSituation}` : '',
          item.certificateNumber ? `Nº: ${item.certificateNumber}` : '',
          item.controlCode ? `Autenticidade: ${item.controlCode}` : '',
          item.notes || '',
        ].filter(Boolean);

        setDocuments((prev) =>
          prev.map((d) => {
            if (d.id !== item.matchedDocId) return d;
            return {
              ...d,
              name: item.documentTitle || d.name,
              category: item.category || d.category,
              issuer: item.issuer || d.issuer,
              issueDate: item.issueDate,
              validityDays: item.isPermanent ? '' : item.validityDays,
              expirationDate: item.isPermanent ? '' : item.expirationDate,
              isPermanent: item.isPermanent,
              certificateNumber: item.certificateNumber || d.certificateNumber,
              controlCode: item.controlCode || d.controlCode,
              documentSituation: item.documentSituation || d.documentSituation,
              awaitingReview: false,
              notes: noteParts.join(' · ') || d.notes,
              fileType: item.dataUrl ? 'local' : d.fileType,
              fileName: item.fileName || d.fileName,
              fileMimeType: item.fileMimeType || d.fileMimeType,
              fileSize: item.fileSize || d.fileSize,
              updatedAt: new Date().toISOString(),
            };
          })
        );
      } else {
        const newDocId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        if (item.dataUrl) {
          await saveAttachmentData(newDocId, item.dataUrl);
        }
        const comp =
          companies.find((c) => c.id === item.matchedCompanyId) || activeCompany;

        const newDoc: CertidaoDocument = {
          id: newDocId,
          companyId: item.matchedCompanyId,
          templateKey: item.matchedTemplateKey || undefined,
          name: item.documentTitle || item.fileName.replace(/\.[^.]+$/, ''),
          category: item.category || 'Fiscais e Trabalhistas',
          issuer: item.issuer || 'Órgão Emissor',
          emitterUrl: '',
          registrationCode: item.extractedCnpj || comp.cnpj,
          primaryAutoFillField: 'cnpj_num',
          issueDate: item.issueDate,
          validityDays: item.isPermanent ? '' : item.validityDays,
          expirationDate: item.isPermanent ? '' : item.expirationDate,
          isPermanent: item.isPermanent,
          certificateNumber: item.certificateNumber,
          controlCode: item.controlCode,
          documentSituation: item.documentSituation,
          awaitingReview: false,
          notes:
            [
              item.documentSituation ? `Situação: ${item.documentSituation}` : '',
              item.controlCode ? `Autenticidade: ${item.controlCode}` : '',
              item.notes,
            ]
              .filter(Boolean)
              .join(' · ') || 'Importado via Leitura Inteligente de PDF.',
          fileType: item.dataUrl ? 'local' : 'none',
          fileName: item.fileName,
          fileMimeType: item.fileMimeType,
          fileSize: item.fileSize,
          updatedAt: new Date().toISOString(),
        };

        setDocuments((prev) => [newDoc, ...prev]);
      }
    }

    const last = selectedItems[selectedItems.length - 1];
    const lastComp =
      companies.find((c) => c.id === last.matchedCompanyId) || activeCompany;

    setLastExtractionSummary({
      fileName:
        selectedItems.length === 1
          ? last.fileName
          : `${selectedItems.length} arquivos importados`,
      documentTitle:
        selectedItems.length === 1
          ? last.documentTitle
          : `${selectedItems.length} Certidões Conferidas e Atualizadas`,
      companyName: lastComp.companyName,
      issueDate: last.issueDate || '—',
      expirationDate: last.expirationDate || '—',
      controlCode: last.controlCode || '—',
      fieldsUpdatedInCompany: updatedFieldsSummary,
    });

    setPendingReviewItems([]);
    showToast(
      `✓ ${selectedItems.length} ${
        selectedItems.length === 1 ? 'documento conferido e salvo' : 'documentos conferidos e salvos'
      } com sucesso! Versões anteriores preservadas no Histórico.`
    );
  };

  // ============================================================================
  // OTHER HANDLERS (EMISSION, INLINE EDIT, RENEW, HISTORY, BACKUP)
  // ============================================================================

  const handleCopyText = async (id: string, text: string, label: string) => {
    const valueToCopy = text || onlyDigits(activeCompany.cnpj);
    try {
      await navigator.clipboard.writeText(valueToCopy);
      setCopiedId(id);
      showToast(`${label} copiado para o Ctrl+V: ${valueToCopy}`);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 2200);
    } catch {
      showToast('Não foi possível copiar automaticamente.');
    }
  };

  const handleSmartEmitClick = async (doc: CertidaoDocument, comp: CompanyProfile) => {
    const fieldMap = resolveCompanyFieldMap(comp);
    const preferredKey: AutoFillFieldKey = doc.primaryAutoFillField || 'cnpj_num';
    const chosenField = fieldMap[preferredKey] || fieldMap.cnpj_num;
    const valueToCopy = chosenField.value || onlyDigits(comp.cnpj) || comp.cnpj;

    try {
      await navigator.clipboard.writeText(valueToCopy);
      setCopiedId(`emit-${doc.id}`);
    } catch {
      // ignore
    }

    // Dispara ponte segura local para o Tampermonkey (sem enviar dados sensíveis na URL!)
    dispatchAutofillBridgeEvent(comp, doc.templateKey);

    const targetUrl = buildCleanTargetUrl(doc.emitterUrl);

    setActiveEmissionSession({
      doc,
      company: comp,
      copiedFieldLabel: chosenField.label,
      copiedValue: valueToCopy,
      targetUrl,
    });

    showToast(
      `⚡ Emissão Assistida iniciada! ${chosenField.label} (${valueToCopy}) copiado para o Ctrl+V.`
    );
  };

  const commitInlineEdit = () => {
    if (!inlineEdit) return;
    const { docId, field, value, syncAllCompanies } = inlineEdit;
    const targetDoc = documents.find((d) => d.id === docId);

    setDocuments((prev) =>
      prev.map((d) => {
        if (
          field === 'emitterUrl' &&
          syncAllCompanies &&
          targetDoc &&
          ((targetDoc.templateKey && d.templateKey === targetDoc.templateKey) ||
            d.name === targetDoc.name)
        ) {
          return { ...d, emitterUrl: value.trim(), updatedAt: new Date().toISOString() };
        }

        if (d.id !== docId) return d;
        const updated: CertidaoDocument = { ...d, updatedAt: new Date().toISOString() };

        if (field === 'issueDate') {
          updated.issueDate = value;
          if (
            value &&
            updated.validityDays !== '' &&
            Number(updated.validityDays) > 0 &&
            !updated.isPermanent
          ) {
            updated.expirationDate = addDaysToDateString(value, Number(updated.validityDays));
          }
        } else if (field === 'validityDays') {
          const num = value === '' ? '' : Math.max(1, parseInt(value, 10) || 0);
          updated.validityDays = num;
          if (num !== '' && updated.issueDate && !updated.isPermanent) {
            updated.expirationDate = addDaysToDateString(updated.issueDate, Number(num));
          }
        } else if (field === 'expirationDate') {
          updated.expirationDate = value;
          if (value) {
            updated.isPermanent = false;
          }
        } else if (field === 'highlightName') {
          updated.highlightName = value.trim() ? value.trim().toUpperCase() : undefined;
        } else if (field === 'name') {
          if (value.trim()) updated.name = value.trim();
        } else if (field === 'issuer') {
          updated.issuer = value.trim();
        } else if (field === 'registrationCode') {
          updated.registrationCode = value.trim();
        } else if (field === 'emitterUrl') {
          updated.emitterUrl = value.trim();
        }
        return updated;
      })
    );
    setInlineEdit(null);
    showToast(
      field === 'highlightName'
        ? 'Nome de destaque / apelido atualizado com sucesso!'
        : field === 'emitterUrl' && syncAllCompanies
        ? 'Link de emissão atualizado para todas as empresas!'
        : 'Alteração salva automaticamente.'
    );
  };

  const handleUpdatePortalLinkEverywhere = (
    doc: CertidaoDocument,
    newUrl: string,
    newIssuer?: string,
    newPrimaryField?: AutoFillFieldKey
  ) => {
    const cleanUrl = newUrl.trim();
    setDocuments((prev) =>
      prev.map((d) => {
        const isSameCert =
          (doc.templateKey && d.templateKey === doc.templateKey) ||
          d.name === doc.name ||
          d.id === doc.id;
        if (!isSameCert) return d;
        return {
          ...d,
          emitterUrl: cleanUrl,
          issuer: newIssuer !== undefined ? newIssuer : d.issuer,
          primaryAutoFillField:
            newPrimaryField !== undefined ? newPrimaryField : d.primaryAutoFillField,
          updatedAt: new Date().toISOString(),
        };
      })
    );
    showToast(`Configuração de emissão de "${doc.name}" salva para todas as empresas!`);
  };

  const openQuickRenew = (doc: CertidaoDocument) => {
    const today = getTodayDateString();
    const defaultValidity =
      doc.validityDays !== '' && Number(doc.validityDays) > 0 ? Number(doc.validityDays) : 90;
    const nextExp = addDaysToDateString(today, defaultValidity);
    setRenewingDoc({
      doc,
      newIssueDate: today,
      newValidityDays: defaultValidity,
      newExpirationDate: nextExp,
      newControlCode: '',
      newCertificateNumber: '',
      newDocumentSituation: 'Certidão Negativa / Regular',
      newDriveUrl: doc.driveUrl || '',
      newFile: null,
    });
  };

  // Quando o usuário seleciona um PDF dentro do modal Renovar, usa o motor gratuito PDF.js + OCR!
  const handleRenewModalFileSelect = async (file: File | null) => {
    if (!renewingDoc || !file) return;
    setRenewingDoc((prev) =>
      prev
        ? {
            ...prev,
            newFile: file,
            extractedInfo: 'Lendo datas e autenticidade do PDF localmente (PDF.js / OCR)...',
          }
        : null
    );
    try {
      const dataUrl = await readFileAsDataURL(file);
      const extracted = await analyzeDocumentSmart(file, dataUrl, companies, {
        mode: 'certificate',
      });
      setRenewingDoc((prev) => {
        if (!prev) return null;
        const issue = extracted.issueDate || prev.newIssueDate;
        const valDays =
          extracted.validityDays && extracted.validityDays > 0
            ? extracted.validityDays
            : prev.newValidityDays;
        const exp =
          extracted.expirationDate || addDaysToDateString(issue, valDays);
        return {
          ...prev,
          newIssueDate: issue,
          newValidityDays: valDays,
          newExpirationDate: exp,
          newControlCode: extracted.controlCode || prev.newControlCode,
          newCertificateNumber:
            extracted.certificateNumber || prev.newCertificateNumber,
          newDocumentSituation:
            extracted.documentSituation || prev.newDocumentSituation,
          extractedInfo: `✓ Dados extraídos (${extracted.extractionEngine === 'pdfjs-local' ? 'PDF.js Local' : 'OCR/Híbrido'}): Emissão ${formatDateBR(issue)} · Vencimento ${formatDateBR(exp)}${extracted.controlCode ? ` · Autenticidade: ${extracted.controlCode}` : ''}`,
        };
      });
    } catch {
      setRenewingDoc((prev) =>
        prev
          ? { ...prev, extractedInfo: 'Arquivo anexado (confira as datas antes de confirmar).' }
          : null
      );
    }
  };

  const confirmQuickRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingDoc) return;
    const {
      doc,
      newIssueDate,
      newValidityDays,
      newExpirationDate,
      newControlCode,
      newCertificateNumber,
      newDocumentSituation,
      newDriveUrl,
      newFile,
    } = renewingDoc;

    // Preserva a versão anterior e seu PDF no Histórico!
    await archiveDocumentVersionToHistory(doc, 'Renovação de Certidão');

    let fileType = doc.fileType;
    let fileName = doc.fileName;
    let fileMimeType = doc.fileMimeType;
    let fileSize = doc.fileSize;
    let driveUrl = newDriveUrl.trim();

    if (newFile) {
      const dataUrl = await readFileAsDataURL(newFile);
      await saveAttachmentData(doc.id, dataUrl);
      fileType = 'local';
      fileName = newFile.name;
      fileMimeType = newFile.type || 'application/pdf';
      fileSize = newFile.size;
    } else if (driveUrl) {
      fileType = 'drive';
    }

    const noteParts = [
      newDocumentSituation ? `Situação: ${newDocumentSituation}` : '',
      newCertificateNumber ? `Nº: ${newCertificateNumber}` : '',
      newControlCode ? `Autenticidade: ${newControlCode}` : '',
    ].filter(Boolean);

    setDocuments((prev) =>
      prev.map((item) =>
        item.id === doc.id
          ? {
               ...item,
              isPermanent: false,
              issueDate: newIssueDate,
              validityDays: newValidityDays,
              expirationDate: newExpirationDate,
              controlCode: newControlCode || item.controlCode,
              certificateNumber: newCertificateNumber || item.certificateNumber,
              documentSituation: newDocumentSituation || item.documentSituation,
              awaitingReview: false,
              notes: noteParts.length > 0 ? noteParts.join(' · ') : item.notes,
              fileType,
              fileName,
              fileMimeType,
              fileSize,
              driveUrl,
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );
    setRenewingDoc(null);
    setActiveEmissionSession(null);
    showToast(
      `Certidão "${doc.name}" renovada até ${formatDateBR(newExpirationDate)}! Versão anterior salva no Histórico.`
    );
  };

  // ============================================================================
  // HISTORY HANDLERS (VIEW, DOWNLOAD, RESTORE PREVIOUS VERSIONS)
  // ============================================================================

  const handleViewHistoryAttachment = async (entry: DocumentHistoryEntry) => {
    if (entry.attachmentHistoryKey) {
      const dataUrl = await getAttachmentData(entry.attachmentHistoryKey);
      setPreviewModal({
        doc: {
          name: `${entry.documentName} (Versão de ${formatDateBR(entry.issueDate)})`,
          fileName: entry.fileName,
          fileMimeType: entry.fileMimeType,
        },
        dataUrl,
      });
    } else if (entry.driveUrl) {
      setPreviewModal({
        doc: {
          name: entry.documentName,
          driveUrl: entry.driveUrl,
        },
        dataUrl: null,
      });
    }
  };

  const handleDownloadHistoryAttachment = async (entry: DocumentHistoryEntry) => {
    if (!entry.attachmentHistoryKey) return;
    const dataUrl = await getAttachmentData(entry.attachmentHistoryKey);
    if (!dataUrl) {
      showToast('Arquivo PDF anterior não encontrado no armazenamento local.');
      return;
    }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = entry.fileName || `${entry.documentName}-historico.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRestoreHistoryVersion = async (entry: DocumentHistoryEntry) => {
    const currentDoc = documents.find((d) => d.id === entry.documentId);
    if (currentDoc) {
      await archiveDocumentVersionToHistory(
        currentDoc,
        'Arquivado antes de restaurar versão anterior'
      );
    }

    if (entry.attachmentHistoryKey) {
      const prevDataUrl = await getAttachmentData(entry.attachmentHistoryKey);
      if (prevDataUrl) {
        await saveAttachmentData(entry.documentId, prevDataUrl);
      }
    }

    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== entry.documentId) return d;
        return {
          ...d,
          issueDate: entry.issueDate,
          validityDays: entry.validityDays,
          expirationDate: entry.expirationDate,
          certificateNumber: entry.certificateNumber,
          controlCode: entry.controlCode,
          documentSituation: entry.documentSituation,
          fileType: entry.attachmentHistoryKey
            ? 'local'
            : entry.driveUrl
            ? 'drive'
            : d.fileType,
          fileName: entry.fileName || d.fileName,
          fileMimeType: entry.fileMimeType || d.fileMimeType,
          fileSize: entry.fileSize || d.fileSize,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    showToast(`Versão de ${formatDateBR(entry.issueDate)} restaurada com sucesso!`);
  };

  const handleDeleteHistoryEntry = async (historyId: string) => {
    const target = documentHistory.find((h) => h.id === historyId);
    if (target?.attachmentHistoryKey) {
      await deleteAttachmentData(target.attachmentHistoryKey);
    }
    setDocumentHistory((prev) => prev.filter((h) => h.id !== historyId));
    showToast('Registro removido do histórico.');
  };

  const openCreateCompanyModal = () => {
    const newComp: CompanyProfile = {
      id: `comp-${Date.now()}`,
      companyName: '',
      tradeName: '',
      cnpj: '',
      stateRegistration: '',
      municipalRegistration: '',
      nire: '',
      cnaeMain: '',
      cityState: 'Teresina - PI',
      cep: '',
      address: '',
      neighborhood: '',
      phone: '',
      email: '',
      partnerName: '',
      partnerCpf: '',
      partnerRg: '',
      partnerBirthDate: '',
      techResponsibleName: '',
      techResponsibleCouncil: '',
      techResponsibleCpf: '',
      portalAccessNotes: '',
    };
    setCompanyModal({
      isNew: true,
      profile: newComp,
      cloneStandardDocs: true,
    });
  };

  const openEditCurrentCompanyModal = () => {
    if (selectedCompanyId === 'all') {
      showToast('Selecione uma empresa específica para editar seus dados.');
      return;
    }
    setCompanyModal({
      isNew: false,
      profile: { ...activeCompany },
      cloneStandardDocs: false,
    });
  };

  const handleRequestDeleteCurrentCompany = () => {
    if (selectedCompanyId === 'all') {
      showToast('Selecione uma empresa específica para excluir.');
      return;
    }
    if (companies.length <= 1) {
      showToast('Mantenha pelo menos uma empresa cadastrada no sistema.');
      return;
    }
    setCompanyToDeleteConfirm(activeCompany);
  };

  const openCreateModal = () => {
    const today = getTodayDateString();
    const targetCompany = selectedCompanyId === 'all' ? companies[0] : activeCompany;
    setIsNewDocModal(true);
    setEditingDoc({
      id: `doc-${Date.now()}`,
      companyId: targetCompany.id,
      name: '',
      highlightName: '',
      category: 'Fiscais e Trabalhistas',
      issuer: '',
      emitterUrl: '',
      registrationCode: targetCompany.cnpj,
      primaryAutoFillField: 'cnpj_num',
      portalFieldsHint: 'CNPJ (somente números) + Captcha',
      issueDate: today,
      validityDays: 90,
      expirationDate: addDaysToDateString(today, 90),
      isPermanent: false,
      notes: '',
      fileType: 'none',
      updatedAt: new Date().toISOString(),
    });
  };

  const openEditModal = (doc: CertidaoDocument) => {
    setIsNewDocModal(false);
    setEditingDoc({ ...doc });
  };

  const handleViewAttachment = async (doc: CertidaoDocument) => {
    let dataUrl = doc.fileData;
    if (!dataUrl && doc.fileType === 'local') {
      dataUrl = (await getAttachmentData(doc.id)) || undefined;
    }
    setViewingPdfDoc({ ...doc, fileData: dataUrl });
  };

  const handleConfirmDeletePdf = async (docId: string, clearExtractedFields: boolean) => {
    try {
      await deleteAttachmentData(docId);
      setDocuments((prev) =>
        prev.map((d) => {
          if (d.id !== docId) return d;
          const updated: CertidaoDocument = {
            ...d,
            fileName: undefined,
            fileMimeType: undefined,
            fileSize: undefined,
            fileData: undefined,
            fileUrl: undefined,
            fileType: 'none',
            pdfAnalysisConfidence: undefined,
            updatedAt: new Date().toISOString(),
          };

          if (clearExtractedFields) {
            updated.controlCode = '';
            updated.authenticityCode = '';
            updated.certificateNumber = '';
            updated.protocolNumber = '';
            updated.issueDate = '';
            updated.expirationDate = '';
            updated.pdfPopulatedFields = [];
          }

          return updated;
        })
      );
      showToast(
        clearExtractedFields
          ? 'Arquivo PDF removido e dados extraídos limpos com sucesso.'
          : 'Arquivo PDF removido com sucesso. Certidão e prazos mantidos.'
      );
    } catch (err) {
      console.error('Erro ao excluir PDF:', err);
      showToast('Falha ao excluir o arquivo PDF.');
    }
  };

  const handleSaveCompanyFromManagement = (comp: CompanyBasicProfile, isNew: boolean) => {
    const profileComp: CompanyProfile = {
      ...comp,
      companyName: comp.companyName || (comp as any).corporateName || 'Nova Empresa',
    };

    if (isNew) {
      setCompanies((prev) => [...prev, profileComp]);
      const newDocs = buildDocumentsFromConfiguredModels(profileComp, settings);
      setDocuments((prev) => [...prev, ...newDocs]);
      setSelectedCompanyId(profileComp.id);
      showToast(`Empresa "${profileComp.companyName}" cadastrada com sucesso!`);
    } else {
      setCompanies((prev) => prev.map((c) => (c.id === profileComp.id ? profileComp : c)));
      showToast(`Empresa "${profileComp.companyName}" atualizada com sucesso!`);
    }
  };

  const handleDeleteCompanyFromManagement = async (companyId: string) => {
    const compDocs = documents.filter((d) => d.companyId === companyId);
    for (const doc of compDocs) {
      await deleteAttachmentData(doc.id).catch(() => {});
    }
    setDocuments((prev) => prev.filter((d) => d.companyId !== companyId));
    setCompanies((prev) => {
      const nextList = prev.filter((c) => c.id !== companyId);
      if (selectedCompanyId === companyId) {
        setSelectedCompanyId(nextList[0]?.id || '');
      }
      return nextList;
    });
    setDocumentHistory((prev) => prev.filter((h) => h.companyId !== companyId));
    showToast('Empresa e todos os seus registros foram excluídos definitivamente.');
  };

  const handleArchiveCompanyFromManagement = (companyId: string, archive: boolean) => {
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === companyId
          ? {
              ...c,
              isArchived: archive,
              archivedAt: archive ? new Date().toISOString() : undefined,
            }
          : c
      )
    );
    showToast(archive ? 'Empresa arquivada.' : 'Empresa restaurada com sucesso!');
  };

  const handleDownloadAttachment = async (doc: {
    id?: string;
    name: string;
    fileType?: 'none' | 'local' | 'drive';
    fileName?: string;
    driveUrl?: string;
  }) => {
    if (doc.id) {
      const dataUrl = await getAttachmentData(doc.id);
      if (!dataUrl) {
        showToast('Arquivo não encontrado no armazenamento local.');
        return;
      }
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = doc.fileName || `${doc.name}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`Download iniciado: ${doc.fileName || doc.name}`);
    }
  };

  const confirmDeleteDocument = async () => {
    if (!deleteConfirmId) return;
    await deleteAttachmentData(deleteConfirmId);
    setDocuments((prev) => prev.filter((d) => d.id !== deleteConfirmId));
    setDeleteConfirmId(null);
    showToast('Documento removido.');
  };

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyModal) return;
    const { isNew, profile, cloneStandardDocs } = companyModal;
    if (!profile.companyName.trim()) return;

    if (onlyDigits(profile.cnpj).length === 14 && !isValidCNPJ(profile.cnpj)) {
      showToast('Atenção: O CNPJ informado possui dígitos verificadores inválidos.');
    }

    if (isNew) {
      setCompanies((prev) => [...prev, profile]);
      if (cloneStandardDocs) {
        const newDocs = buildInitialDocumentsForCompany(profile, false).map((nd) => {
          const existingWithSameKey = documents.find(
            (ed) => ed.templateKey && ed.templateKey === nd.templateKey && ed.emitterUrl
          );
          return existingWithSameKey
            ? {
                ...nd,
                emitterUrl: existingWithSameKey.emitterUrl,
                issuer: existingWithSameKey.issuer,
                primaryAutoFillField:
                  existingWithSameKey.primaryAutoFillField || nd.primaryAutoFillField,
              }
            : nd;
        });
        setDocuments((prev) => [...prev, ...newDocs]);
      }
      setSelectedCompanyId(profile.id);
      showToast(`Empresa "${profile.companyName}" cadastrada com banco de dados completo!`);
    } else {
      setCompanies((prev) => prev.map((c) => (c.id === profile.id ? profile : c)));
      showToast(`Banco de dados da empresa "${profile.companyName}" atualizado!`);
    }
    setCompanyModal(null);
  };

  const updateActiveCompanyField = (field: keyof CompanyProfile, value: string) => {
    setCompanies((prev) =>
      prev.map((c) => (c.id === activeCompany.id ? { ...c, [field]: value } : c))
    );
  };

  const handleDeleteCompany = (companyId: string) => {
    if (companies.length <= 1) {
      showToast('Mantenha pelo menos uma empresa cadastrada.');
      return;
    }
    const remaining = companies.filter((c) => c.id !== companyId);
    setCompanies(remaining);
    setDocuments((prev) => prev.filter((d) => d.companyId !== companyId));
    if (selectedCompanyId === companyId) {
      setSelectedCompanyId(remaining[0].id);
    }
    showToast('Empresa e documentos vinculados removidos.');
  };

  const handleExportJSON = async () => {
    const attachments = await getAllAttachmentsMap();
    const payload = {
      app: 'Mago das Licitações - Multi-Empresas Piauí',
      version: '3.0',
      exportedAt: new Date().toISOString(),
      warningThresholdDays,
      companies,
      documents,
      documentHistory,
      attachments,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-mago-licitacoes-piaui-${getTodayDateString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup completo JSON (empresas, certidões, histórico e PDFs) exportado!');
  };

  const handleExportCSV = () => {
    const headers = [
      'Empresa',
      'CNPJ da Empresa',
      'Nome do Documento',
      'Categoria',
      'Órgão Emissor',
      'Status Atual',
      'Situação / Dias',
      'Data de Emissão',
      'Prazo (Dias)',
      'Data de Vencimento',
      'Código de Autenticidade',
      'Dado Principal AutoPreenchimento',
      'Link do Site Emissor',
      'Arquivo Anexo / Nuvem',
      'Observações',
    ];

    const rows = filteredDocuments.map(({ doc, company: comp, eval: ev }) => [
      comp?.companyName || '',
      comp?.cnpj || '',
      doc.name,
      doc.category,
      doc.issuer,
      ev.label,
      ev.countdownText,
      doc.issueDate ? formatDateBR(doc.issueDate) : '',
      doc.isPermanent ? 'Permanente' : String(doc.validityDays || ''),
      doc.isPermanent
        ? 'Indeterminado'
        : doc.expirationDate
        ? formatDateBR(doc.expirationDate)
        : '',
      doc.controlCode || '',
      doc.primaryAutoFillField || 'cnpj_num',
      doc.emitterUrl,
      doc.fileType === 'local'
        ? doc.fileName || 'PDF Local'
        : doc.fileType === 'drive'
        ? doc.driveUrl || ''
        : 'Sem anexo',
      doc.notes,
    ]);

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certidoes-piaui-${getTodayDateString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Planilha CSV/Excel exportada com sucesso!');
  };

  const handleImportJSON = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.documents)) {
        showToast('Arquivo JSON inválido.');
        return;
      }
      if (Array.isArray(parsed.companies) && parsed.companies.length > 0) {
        setCompanies(parsed.companies);
        setSelectedCompanyId(parsed.companies[0].id);
      }
      if (parsed.warningThresholdDays) {
        setWarningThresholdDays(Number(parsed.warningThresholdDays) || 30);
      }
      setDocuments(parsed.documents);
      if (Array.isArray(parsed.documentHistory)) {
        setDocumentHistory(parsed.documentHistory);
      }
      if (parsed.attachments && typeof parsed.attachments === 'object') {
        for (const [docId, dataUrl] of Object.entries(parsed.attachments)) {
          if (typeof dataUrl === 'string') {
            await saveAttachmentData(docId, dataUrl);
          }
        }
      }
      showToast(`Backup restaurado com ${parsed.documents.length} documentos!`);
    } catch {
      showToast('Falha ao ler o arquivo de backup JSON.');
    }
  };

  const handleResetToInitialData = () => {
    setCompanies(INITIAL_COMPANIES);
    setSelectedCompanyId(INITIAL_COMPANIES[0].id);
    setDocuments(buildAllInitialDocuments());
    setResetConfirmOpen(false);
    showToast('Dados padrão do Piauí restaurados.');
  };

  const activeCompanyFieldMap = useMemo(
    () => resolveCompanyFieldMap(activeCompany),
    [activeCompany]
  );

  const bookmarkletHref = useMemo(
    () => generateBookmarkletCode(activeCompany),
    [activeCompany]
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-150">
      {/* ====================================================================
          TOP BAR CONTRACT: 3 Zones separated by gap-6
      ==================================================================== */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-6 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <a
          href="#lista"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('dashboard');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 flex items-center gap-2.5 group"
        >
          <img
            src="/assets/aistudio/Wizard_Hat_and_Spellbook_Stack_8d8be742.png"
            alt="Mago das Licitações"
            className="w-8 h-8 object-contain rounded-lg drop-shadow-sm group-hover:scale-110 transition-transform duration-200"
          />
          <span>Mago das Licitações</span>
        </a>

        <nav className="hidden lg:flex items-center gap-1.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveSection('dashboard')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'dashboard'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Certidões</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('companies')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'companies'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Empresas ({companies.filter((c) => !c.isArchived).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('batch_import')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'batch_import'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileScan className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Importar PDFs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('pendencias')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'pendencias'
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ListChecks className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Pendências</span>
            {summaryCounts.vencido + summaryCounts.atencao > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {summaryCounts.vencido + summaryCounts.atencao}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setSettingsInitialTab(undefined);
              setActiveSection('settings');
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'settings'
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Settings className="w-4 h-4 text-amber-500" />
            <span>Configurações</span>
          </button>

          {/* Dropdown "Mais Ferramentas" para diminuir a poluição visual */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreMenuOpen((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                ['history', 'company_db', 'links', 'backup'].includes(activeSection)
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>Mais</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {moreMenuOpen && (
              <div
                className="absolute left-0 mt-1 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 z-40"
                onClick={() => setMoreMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => {
                    setHistoryFilterDocId(null);
                    setActiveSection('history');
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200"
                >
                  <History className="w-4 h-4 text-blue-500" />
                  <span>Histórico ({documentHistory.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('company_db')}
                  className="w-full px-3.5 py-2 text-left text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200"
                >
                  <Database className="w-4 h-4 text-purple-500" />
                  <span>Ficha Cadastral Completa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('links')}
                  className="w-full px-3.5 py-2 text-left text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200"
                >
                  <ExternalLink className="w-4 h-4 text-teal-500" />
                  <span>Portais & Links de Emissão</span>
                </button>
                <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                <button
                  type="button"
                  onClick={() => setActiveSection('backup')}
                  className="w-full px-3.5 py-2 text-left text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                  <span>Backup & Exportar Planilha</span>
                </button>
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={openCreateCompanyModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            title="Cadastrar uma nova empresa no sistema"
          >
            <Plus className="w-3.5 h-3.5" />
            + Incluir Empresa
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Certidão
          </button>

          {/* GOOGLE AUTH & CLOUD SYNC WIDGET */}
          {!currentUser ? (
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={!isAuthReady}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors cursor-pointer shadow-xs shrink-0"
              title="Conectar com o Google para sincronizar com o Cloud Firestore"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span className="hidden sm:inline">Entrar com Google</span>
              <span className="text-[10px] px-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
                Local
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-lg p-1 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenSyncModal()}
                disabled={isSyncing}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  !isOnlineState
                    ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                    : isSyncing
                    ? 'bg-blue-500/10 text-blue-500'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                }`}
                title={
                  !isOnlineState
                    ? 'Modo Offline: Suas alterações estão salvas localmente.'
                    : 'Conectado ao Cloud Firestore. Clique para revisar ou sincronizar agora.'
                }
              >
                {!isOnlineState ? (
                  <>
                    <CloudOff className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Offline</span>
                  </>
                ) : isSyncing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span className="hidden sm:inline">Sincronizando...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="hidden sm:inline">Nuvem</span>
                  </>
                )}
              </button>
              <div className="flex items-center gap-1.5 pl-1.5 pr-1 border-l border-slate-300 dark:border-slate-700">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'Google User'}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                    {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
                  </div>
                )}
                <span
                  className="text-xs font-medium text-slate-700 dark:text-slate-200 max-w-[85px] truncate hidden md:inline"
                  title={currentUser.email || ''}
                >
                  {currentUser.displayName?.split(' ')[0] || currentUser.email?.split('@')[0]}
                </span>
                <button
                  type="button"
                  onClick={handleGoogleLogout}
                  className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                  title="Desconectar do Google (dados locais permanecem)"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Alternar tema claro/escuro"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setSettingsInitialTab(undefined);
              setActiveSection('settings');
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Abrir Central de Configurações"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ====================================================================
          BARRA DE SELEÇÃO DE EMPRESA + AÇÕES DIRETAS (INCLUIR / EDITAR / EXCLUIR)
      ==================================================================== */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/70">
        <div className="max-w-[1440px] mx-auto px-6 py-2.5 space-y-2">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Left: Company Selector + Unmissable Inclusion / Exclusion Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Empresa Ativa:</span>
              </div>

              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 cursor-pointer shadow-xs max-w-[280px] sm:max-w-md truncate"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} — CNPJ: {c.cnpj}
                  </option>
                ))}
                <option value="all">Ver Todas as Empresas Juntas ({companies.length})</option>
              </select>

              {/* BOTAO CLARO: + INCLUIR EMPRESA */}
              <button
                type="button"
                onClick={openCreateCompanyModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition cursor-pointer"
                title="Cadastrar uma nova empresa no sistema"
              >
                <Plus className="w-3.5 h-3.5" />
                + Incluir Empresa
              </button>

              {/* BOTAO CLARO: EDITAR EMPRESA ATUAL */}
              <button
                type="button"
                disabled={selectedCompanyId === 'all'}
                onClick={openEditCurrentCompanyModal}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-xs cursor-pointer disabled:opacity-40"
                title="Editar dados da empresa ativa"
              >
                <Edit2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Editar Dados
              </button>

              {/* BOTAO CLARO: EXCLUIR EMPRESA ATUAL */}
              <button
                type="button"
                disabled={selectedCompanyId === 'all' || companies.length <= 1}
                onClick={handleRequestDeleteCurrentCompany}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/70 rounded-lg shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title={companies.length <= 1 ? 'Mantenha ao menos 1 empresa cadastrada' : 'Excluir ou desativar esta empresa do sistema'}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                Excluir Empresa
              </button>

              {/* LINK RAPIDO PARA A CENTRAL DE EMPRESAS */}
              <button
                type="button"
                onClick={() => setActiveSection('companies')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                title="Abrir Central Completa de Gestão de Empresas"
              >
                <span>Todas ({companies.length})</span>
              </button>
            </div>

            {/* Right: Leitor PDF rápido + AutoPreenchimento + Alerta Vencimento */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={smartPdfInputRef}
                type="file"
                accept=".pdf,image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleSmartUploadAndMatch(e.target.files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={isSmartReadingBatch}
                onClick={() => smartPdfInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-lg shadow-xs transition cursor-pointer disabled:opacity-60"
                title="Importar PDFs para conferência automática"
              >
                {isSmartReadingBatch ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <FileScan className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>Importar PDFs</span>
              </button>

              <button
                type="button"
                onClick={() => setShowTampermonkeyModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-lg hover:bg-amber-200/70 cursor-pointer"
                title="Como funciona o preenchimento automático nos sites"
              >
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span>AutoPreenchimento</span>
              </button>

              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Alerta:</span>
                <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-md">
                  {[60, 30, 15, 7, 1].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => {
                        setWarningThresholdDays(days);
                        showToast(`Alerta de proximidade ajustado para ${days} dias.`);
                      }}
                      className={`px-1.5 py-0.5 text-xs font-mono tabular-nums rounded cursor-pointer ${
                        warningThresholdDays === days
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* BARRA RÁPIDA DE DADOS DA EMPRESA ATIVA */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/70 dark:border-slate-800/80 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium mr-1">
              Dados Rápidos ({activeCompany.companyName}):
            </span>

            <button
              type="button"
              onClick={() =>
                handleCopyText(
                  'quick-cnpj-num',
                  onlyDigits(activeCompany.cnpj),
                  'CNPJ (Só Números)'
                )
              }
              className="inline-flex items-center gap-1 px-2 py-1 font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:border-blue-500 transition-colors cursor-pointer"
            >
              {copiedId === 'quick-cnpj-num' ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3 text-blue-500" />
              )}
              <span>CNPJ limpo: {onlyDigits(activeCompany.cnpj)}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleCopyText('quick-cnpj-fmt', activeCompany.cnpj, 'CNPJ Formatado')
              }
              className="inline-flex items-center gap-1 px-2 py-1 font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:border-blue-500 transition-colors cursor-pointer"
            >
              {copiedId === 'quick-cnpj-fmt' ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3 text-slate-400" />
              )}
              <span>CNPJ: {activeCompany.cnpj}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleCopyText(
                  'quick-ie',
                  onlyDigits(activeCompany.stateRegistration),
                  'IE (SEFAZ-PI)'
                )
              }
              className="inline-flex items-center gap-1 px-2 py-1 font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:border-blue-500 transition-colors cursor-pointer"
            >
              {copiedId === 'quick-ie' ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3 text-slate-400" />
              )}
              <span>IE: {activeCompany.stateRegistration || '—'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleCopyText(
                  'quick-im',
                  onlyDigits(activeCompany.municipalRegistration),
                  'IM (Prefeitura)'
                )
              }
              className="inline-flex items-center gap-1 px-2 py-1 font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:border-blue-500 transition-colors cursor-pointer"
            >
              {copiedId === 'quick-im' ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3 text-slate-400" />
              )}
              <span>IM: {activeCompany.municipalRegistration || '—'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleCopyText(
                  'quick-cpf',
                  onlyDigits(activeCompany.partnerCpf),
                  'CPF do Sócio'
                )
              }
              className="inline-flex items-center gap-1 px-2 py-1 font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:border-blue-500 transition-colors cursor-pointer"
            >
              {copiedId === 'quick-cpf' ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3 text-slate-400" />
              )}
              <span>CPF Sócio: {activeCompany.partnerCpf || '—'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ====================================================================
          BANNER DE CONFIRMAÇÃO DE LEITURA AUTOMÁTICA DO PDF (Quando um PDF é salvo)
      ==================================================================== */}
      {lastExtractionSummary && (
        <div className="bg-emerald-950 text-white border-b border-emerald-800">
          <div className="max-w-[1440px] mx-auto px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <FileScan className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-bold text-emerald-300">PDF Conferido e Salvo:</span>
              <span className="font-semibold">{lastExtractionSummary.documentTitle}</span>
              <span className="text-emerald-400">·</span>
              <span>Empresa: {lastExtractionSummary.companyName}</span>
              <span className="text-emerald-400">·</span>
              <span className="font-mono">
                Emissão: {formatDateBR(lastExtractionSummary.issueDate)} | Vencimento:{' '}
                {formatDateBR(lastExtractionSummary.expirationDate)}
              </span>
              {lastExtractionSummary.controlCode !== '—' && (
                <>
                  <span className="text-emerald-400">·</span>
                  <span className="font-mono">Controle: {lastExtractionSummary.controlCode}</span>
                </>
              )}
              {lastExtractionSummary.fieldsUpdatedInCompany.length > 0 && (
                <span className="text-amber-300 font-medium">
                  (+ Atualizado na Ficha da Empresa:{' '}
                  {lastExtractionSummary.fieldsUpdatedInCompany.join(', ')})
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setLastExtractionSummary(null)}
              className="p-1 text-emerald-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          PAINEL ASSISTENTE DE EMISSÃO ATIVA (Aparece ao clicar em "EMITIR CERTIDÃO")
      ==================================================================== */}
      {activeEmissionSession && (
        <AssistedEmissionDrawer
          doc={activeEmissionSession.doc}
          company={activeEmissionSession.company}
          copiedFieldLabel={activeEmissionSession.copiedFieldLabel}
          copiedValue={activeEmissionSession.copiedValue}
          copiedId={copiedId}
          onCopyText={(id, val, label) => handleCopyText(id, val, label)}
          onAttachEmittedPdf={(docId, file) => {
            handleAttachFileToDoc(docId, file);
            setActiveEmissionSession(null);
          }}
          onOpenTampermonkeyGuide={() => setShowTampermonkeyModal(true)}
          onClose={() => setActiveEmissionSession(null)}
        />
      )}

      {/* ====================================================================
          MAIN VIEWPORT
      ==================================================================== */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-5 space-y-5">
        {/* RESUMO EXECUTIVO COMPACTO (6 CARDS COM SEPARAÇÃO DE SEM DATA INFORMADA) */}
        <section aria-label="Resumo de Status">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setActiveSection('dashboard');
              }}
              className={`flex items-center justify-between px-3.5 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                statusFilter === 'all' && activeSection === 'dashboard'
                  ? 'bg-white dark:bg-slate-900 border-blue-600 dark:border-blue-500 ring-1 ring-blue-600/20'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Total na Lista</div>
                <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                  {summaryCounts.total}
                </div>
              </div>
              <FileText className="w-5 h-5 text-slate-400 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter(statusFilter === 'vigente' ? 'all' : 'vigente');
                setActiveSection('dashboard');
              }}
              className={`flex items-center justify-between px-3.5 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                statusFilter === 'vigente'
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-600 dark:border-emerald-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-500/50'
              }`}
            >
              <div>
                <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  Vigentes (&gt;{warningThresholdDays}d)
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {summaryCounts.vigente}
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter(statusFilter === 'atencao' ? 'all' : 'atencao');
                setActiveSection('dashboard');
              }}
              className={`flex items-center justify-between px-3.5 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                statusFilter === 'atencao'
                  ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-600 dark:border-amber-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-500/50'
              }`}
            >
              <div>
                <div className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  Próximas (1-{warningThresholdDays}d)
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400 mt-0.5">
                  {summaryCounts.atencao}
                </div>
              </div>
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter(statusFilter === 'vencido' ? 'all' : 'vencido');
                setActiveSection('dashboard');
              }}
              className={`flex items-center justify-between px-3.5 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                statusFilter === 'vencido'
                  ? 'bg-red-50/80 dark:bg-red-950/30 border-red-600 dark:border-red-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-red-500/50'
              }`}
            >
              <div>
                <div className="text-xs font-medium text-red-700 dark:text-red-400">
                  Vencidas
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-red-700 dark:text-red-400 mt-0.5">
                  {summaryCounts.vencido}
                </div>
              </div>
              <AlertOctagon className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter(statusFilter === 'sem_data' ? 'all' : 'sem_data');
                setActiveSection('dashboard');
              }}
              className={`flex items-center justify-between px-3.5 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                statusFilter === 'sem_data'
                  ? 'bg-slate-200/80 dark:bg-slate-800 border-slate-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400'
              }`}
            >
              <div>
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Sem Data Informada
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-slate-700 dark:text-slate-200 mt-0.5">
                  {summaryCounts.sem_data + summaryCounts.aguardando_conferencia}
                </div>
              </div>
              <Clock className="w-5 h-5 text-slate-500 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter(statusFilter === 'permanente' ? 'all' : 'permanente');
                setActiveSection('dashboard');
              }}
              className={`flex items-center justify-between px-3.5 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                statusFilter === 'permanente'
                  ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-600 dark:border-blue-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-500/50'
              }`}
            >
              <div>
                <div className="text-xs font-medium text-blue-700 dark:text-blue-400">
                  Permanentes
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-blue-700 dark:text-blue-400 mt-0.5">
                  {summaryCounts.permanente}
                </div>
              </div>
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            </button>
          </div>
        </section>

        {/* ====================================================================
            VIEW 1: LISTA COMPACTA DE CERTIDÕES COM LEITURA AUTOMÁTICA DE PDF
        ==================================================================== */}
        {activeSection === 'dashboard' && (
          <section className="space-y-3">
            {companies.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl shadow-sm">
                <Building2 className="w-16 h-16 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Nenhuma empresa cadastrada no sistema
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-6">
                  Você removeu as empresas anteriores. O sistema está limpo e pronto para o cadastro das suas empresas reais.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveSection('companies')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/20 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  + Cadastrar Primeira Empresa
                </button>
              </div>
            ) : (
              <>
                {/* Barra de Importação em Lote Drag & Drop */}
                <BatchPdfImportView
                  isProcessing={isSmartReadingBatch}
                  progressText={readingProgressText}
                  onSelectFiles={(files, useAi) => handleSmartUploadAndMatch(files, useAi)}
                />

            {/* Barra de Busca e Filtro Rápido */}
            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar lista por certidão, órgão (SEFAZ-PI, JUCEPI, TJPI, Prefeitura), CNPJ..."
                  className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('all')}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      categoryFilter === 'all'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Todas ({summaryCounts.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('Fiscais e Trabalhistas')}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      categoryFilter === 'Fiscais e Trabalhistas'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Fiscais/Trab.
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('Alvarás, Licenças e Conselhos')}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      categoryFilter === 'Alvarás, Licenças e Conselhos'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Alvarás/Licenças
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCategoryFilter('Societário, Contábil e Qualificação Técnica')
                    }
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      categoryFilter === 'Societário, Contábil e Qualificação Técnica'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Societário/Técnico
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <option value="priority">Prioridade (Vencidos no topo)</option>
                    <option value="expiration">Data de Vencimento</option>
                    <option value="name">Ordem Alfabética</option>
                    <option value="category">Por Categoria</option>
                  </select>
                </div>
              </div>
            </div>

            {/* LISTA EM LINHAS COMPACTAS */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200/80 dark:divide-slate-800">
              {filteredDocuments.length === 0 ? (
                <div className="p-10 text-center space-y-3">
                  <FolderOpen className="w-8 h-8 text-slate-400 mx-auto" />
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    Nenhum documento encontrado para este filtro
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                      setCategoryFilter('all');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 underline cursor-pointer"
                  >
                    Mostrar todos os documentos
                  </button>
                </div>
              ) : (
                filteredDocuments.map(({ doc, company: docCompany, eval: ev }, index) => {
                  const isVencido = ev.status === 'vencido';
                  const isAtencao = ev.status === 'atencao';
                  const isVigente = ev.status === 'vigente';
                  const isSemData = ev.status === 'sem_data';
                  const isAguardandoConferencia = ev.status === 'aguardando_conferencia';
                  const isEditingThisUrl =
                    inlineEdit?.docId === doc.id && inlineEdit.field === 'emitterUrl';
                  const isAnalyzingThis = analyzingDocId === doc.id;
                  const compForDoc = docCompany || activeCompany;
                  const targetAutoUrl = buildAutoFillTargetUrl(doc.emitterUrl, compForDoc);
                  const docHistCount = documentHistory.filter((h) => h.documentId === doc.id).length;

                  return (
                    <div
                      key={doc.id}
                      className={`px-4 py-3 transition-colors ${
                        isVencido
                          ? 'bg-red-50/25 dark:bg-red-950/15 hover:bg-red-50/50 dark:hover:bg-red-950/25'
                          : isAtencao
                          ? 'bg-amber-50/20 dark:bg-amber-950/10 hover:bg-amber-50/40 dark:hover:bg-amber-950/20'
                          : 'hover:bg-slate-50/90 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                        {/* COLUNA 1: Número + Semáforo + Nome da Certidão + Órgão */}
                        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                          <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500 w-6 shrink-0 pt-0.5 sm:pt-0">
                            {String(index + 1).padStart(2, '0')}.
                          </span>

                          {/* Status Icon + Countdown */}
                          <div className="w-[140px] shrink-0 flex items-center gap-1.5">
                            {isVencido && (
                              <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                            )}
                            {(isAtencao || isAguardandoConferencia) && (
                              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            )}
                            {isVigente && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            )}
                            {isSemData && (
                              <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                            )}
                            {ev.status === 'permanente' && (
                              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                            )}
                            <div className="leading-tight">
                              <div
                                className={`text-xs font-bold ${
                                  isVencido
                                    ? 'text-red-700 dark:text-red-400'
                                    : isAtencao || isAguardandoConferencia
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : isVigente
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : isSemData
                                    ? 'text-slate-600 dark:text-slate-300'
                                    : 'text-blue-700 dark:text-blue-400'
                                }`}
                              >
                                {ev.label}
                              </div>
                              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                {ev.countdownText}
                              </div>
                            </div>
                          </div>

                          {/* Nome da Certidão & Metadados */}
                          <div className="min-w-0 flex-1">
                            {/* Editor Inline do Nome de Destaque / Apelido */}
                            {inlineEdit?.docId === doc.id && inlineEdit.field === 'highlightName' ? (
                              <div className="flex items-center gap-2 py-1 mb-1.5 bg-amber-50 dark:bg-amber-950/60 p-2 rounded-lg border border-amber-300 dark:border-amber-800">
                                <span className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wide shrink-0">
                                  Apelido / Destaque:
                                </span>
                                <input
                                  type="text"
                                  autoFocus
                                  placeholder="Ex: ESPECÍFICA, SIMPLIFICADA..."
                                  value={inlineEdit.value}
                                  onChange={(e) =>
                                    setInlineEdit({ ...inlineEdit, value: e.target.value })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitInlineEdit();
                                    if (e.key === 'Escape') setInlineEdit(null);
                                  }}
                                  className="flex-1 px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-white dark:bg-slate-900 border border-amber-500 rounded text-amber-950 dark:text-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={commitInlineEdit}
                                  className="px-2.5 py-1 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded cursor-pointer"
                                >
                                  Salvar
                                </button>
                                {doc.highlightName && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDocuments((prev) =>
                                        prev.map((d) =>
                                          d.id === doc.id
                                            ? { ...d, highlightName: undefined, updatedAt: new Date().toISOString() }
                                            : d
                                        )
                                      );
                                      setInlineEdit(null);
                                      showToast('Nome de destaque removido.');
                                    }}
                                    className="px-2 py-1 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/50 rounded cursor-pointer"
                                  >
                                    Remover
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setInlineEdit(null)}
                                  className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : doc.highlightName ? (
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/15 border-2 border-amber-500/40 text-amber-900 dark:text-amber-200 font-black text-sm tracking-wide uppercase shadow-xs">
                                  <Tag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span>{doc.highlightName}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setInlineEdit({
                                      docId: doc.id,
                                      field: 'highlightName',
                                      value: doc.highlightName || '',
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 hover:text-amber-700 dark:text-slate-400 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded transition cursor-pointer"
                                  title="Editar apelido de destaque"
                                >
                                  <Edit2 className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                  <span>Renomear Destaque</span>
                                </button>
                              </div>
                            ) : null}

                            {/* Nome Oficial / Legal da Certidão */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {inlineEdit?.docId === doc.id && inlineEdit.field === 'name' ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={inlineEdit.value}
                                  onChange={(e) =>
                                    setInlineEdit({ ...inlineEdit, value: e.target.value })
                                  }
                                  onBlur={commitInlineEdit}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitInlineEdit();
                                    if (e.key === 'Escape') setInlineEdit(null);
                                  }}
                                  className="w-full px-2 py-0.5 text-sm font-semibold bg-white dark:bg-slate-950 border border-blue-600 rounded text-slate-900 dark:text-white"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setInlineEdit({ docId: doc.id, field: 'name', value: doc.name })
                                  }
                                  className={`text-left cursor-pointer ${
                                    doc.highlightName
                                      ? 'text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-300'
                                      : 'text-sm font-bold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400'
                                  }`}
                                  title="Clique para editar o nome oficial"
                                >
                                  {doc.name}
                                </button>
                              )}

                              {/* Botão de Adicionar Apelido de Destaque quando não houver */}
                              {!doc.highlightName && inlineEdit?.docId !== doc.id && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setInlineEdit({
                                      docId: doc.id,
                                      field: 'highlightName',
                                      value: '',
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 border border-amber-300/80 dark:border-amber-700/60 rounded-md transition-colors cursor-pointer"
                                  title="Definir apelido / nome de destaque (ex: ESPECÍFICA, SIMPLIFICADA)"
                                >
                                  <Tag className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                  <span>+ Apelido</span>
                                </button>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {selectedCompanyId === 'all' && docCompany && (
                                <>
                                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                                    {docCompany.companyName}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                </>
                              )}
                              <span>{doc.issuer || 'Definir órgão'}</span>
                              {doc.controlCode && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono text-emerald-700 dark:text-emerald-400">
                                    Cód: {doc.controlCode}
                                  </span>
                                </>
                              )}
                              {doc.notes && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span
                                    className="text-slate-400 dark:text-slate-500 truncate max-w-md"
                                    title={doc.notes}
                                  >
                                    {doc.notes}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* COLUNA 2: Datas Compactas + EMITIR CERTIDÃO + Anexar/Ler PDF + Renovar + Histórico */}
                        <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2 sm:gap-2.5 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100 dark:border-slate-800/70">
                          {/* Bloco de Datas (Emissão | Prazo | Vencimento) */}
                          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950/90 px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 block leading-none">
                                Emissão
                              </span>
                              {inlineEdit?.docId === doc.id && inlineEdit.field === 'issueDate' ? (
                                <input
                                  type="date"
                                  autoFocus
                                  value={inlineEdit.value}
                                  onChange={(e) =>
                                    setInlineEdit({ ...inlineEdit, value: e.target.value })
                                  }
                                  onBlur={commitInlineEdit}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitInlineEdit();
                                    if (e.key === 'Escape') setInlineEdit(null);
                                  }}
                                  className="mt-0.5 px-1 py-0 text-xs font-mono tabular-nums bg-white dark:bg-slate-900 border border-blue-600 rounded"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setInlineEdit({
                                      docId: doc.id,
                                      field: 'issueDate',
                                      value: doc.issueDate || getTodayDateString(),
                                    })
                                  }
                                  className="font-mono tabular-nums text-slate-700 dark:text-slate-300 hover:text-blue-600 cursor-pointer mt-0.5 block"
                                >
                                  {doc.issueDate ? formatDateBR(doc.issueDate) : 'Definir'}
                                </button>
                              )}
                            </div>

                            <span className="text-slate-300 dark:text-slate-700">/</span>

                            <div className="text-center">
                              <span className="text-[10px] text-slate-400 block leading-none">
                                Prazo
                              </span>
                              {doc.isPermanent ? (
                                <span className="font-mono text-slate-400 mt-0.5 block">Fixo</span>
                              ) : inlineEdit?.docId === doc.id &&
                                inlineEdit.field === 'validityDays' ? (
                                <input
                                  type="number"
                                  min={1}
                                  autoFocus
                                  value={inlineEdit.value}
                                  onChange={(e) =>
                                    setInlineEdit({ ...inlineEdit, value: e.target.value })
                                  }
                                  onBlur={commitInlineEdit}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitInlineEdit();
                                    if (e.key === 'Escape') setInlineEdit(null);
                                  }}
                                  className="w-14 mt-0.5 px-1 py-0 text-xs font-mono tabular-nums bg-white dark:bg-slate-900 border border-blue-600 rounded"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setInlineEdit({
                                      docId: doc.id,
                                      field: 'validityDays',
                                      value: String(doc.validityDays || 90),
                                    })
                                  }
                                  className="font-mono tabular-nums text-slate-700 dark:text-slate-300 hover:text-blue-600 cursor-pointer mt-0.5 block"
                                >
                                  {doc.validityDays ? `${doc.validityDays}d` : '—'}
                                </button>
                              )}
                            </div>

                            <span className="text-slate-300 dark:text-slate-700">/</span>

                            <div>
                              <span className="text-[10px] text-slate-400 block leading-none">
                                Vencimento
                              </span>
                              {doc.isPermanent ? (
                                <span className="text-blue-600 dark:text-blue-400 font-medium mt-0.5 block">
                                  Permanente
                                </span>
                              ) : inlineEdit?.docId === doc.id &&
                                inlineEdit.field === 'expirationDate' ? (
                                <input
                                  type="date"
                                  autoFocus
                                  value={inlineEdit.value}
                                  onChange={(e) =>
                                    setInlineEdit({ ...inlineEdit, value: e.target.value })
                                  }
                                  onBlur={commitInlineEdit}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitInlineEdit();
                                    if (e.key === 'Escape') setInlineEdit(null);
                                  }}
                                  className="mt-0.5 px-1 py-0 text-xs font-mono tabular-nums bg-white dark:bg-slate-900 border border-blue-600 rounded"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setInlineEdit({
                                      docId: doc.id,
                                      field: 'expirationDate',
                                      value: doc.expirationDate || getTodayDateString(),
                                    })
                                  }
                                  className={`font-mono tabular-nums font-bold mt-0.5 block cursor-pointer ${
                                    isVencido
                                      ? 'text-red-700 dark:text-red-400 hover:underline'
                                      : isAtencao
                                      ? 'text-amber-700 dark:text-amber-400 hover:underline'
                                      : 'text-slate-900 dark:text-white hover:text-blue-600'
                                  }`}
                                >
                                  {doc.expirationDate
                                    ? formatDateBR(doc.expirationDate)
                                    : 'Sem data'}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Bloco ⚡ EMITIR CERTIDÃO + Editar Link */}
                          <div className="flex items-center gap-1">
                            {doc.emitterUrl ? (
                              <a
                                href={targetAutoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => handleSmartEmitClick(doc, compForDoc)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-950/70 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                                title="Abre o portal oficial e aciona o Assistente de Emissão com os dados da empresa selecionada"
                              >
                                <Zap className="w-3.5 h-3.5 text-amber-500" />
                                Emitir Certidão
                                <ExternalLink className="w-3 h-3 opacity-70" />
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setInlineEdit({
                                    docId: doc.id,
                                    field: 'emitterUrl',
                                    value: '',
                                    syncAllCompanies: true,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white border border-dashed border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                + Link
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                setInlineEdit(
                                  isEditingThisUrl
                                    ? null
                                    : {
                                        docId: doc.id,
                                        field: 'emitterUrl',
                                        value: doc.emitterUrl || '',
                                        syncAllCompanies: true,
                                      }
                                )
                              }
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isEditingThisUrl
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'text-slate-500 dark:text-slate-400 hover:text-blue-600 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                              }`}
                              title="Editar link do site emissor"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Bloco PDF (Anexar e Ler Automaticamente / Visualizar / Baixar) */}
                          <div className="flex items-center gap-1">
                            {isAnalyzingThis ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg whitespace-nowrap">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Lendo PDF...
                              </span>
                            ) : doc.fileType !== 'none' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleViewAttachment(doc)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                                  title="Visualizar PDF anexado"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Ver PDF
                                </button>
                                {doc.fileType === 'local' && (
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadAttachment(doc)}
                                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                                    title="Baixar PDF"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <label
                                  className="p-1.5 text-slate-500 hover:text-emerald-600 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                                  title="Substituir PDF (preserva o anterior no Histórico e abre Conferir Dados)"
                                >
                                  <Upload className="w-3.5 h-3.5" />
                                  <input
                                    type="file"
                                    accept=".pdf,image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) handleAttachFileToDoc(doc.id, f);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setDeletingPdfDoc(doc)}
                                  className="p-1.5 text-slate-400 hover:text-rose-500 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer transition"
                                  title="Excluir apenas o arquivo PDF (mantém certidão e prazos)"
                                >
                                  <FileX className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <label
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                                title="Anexar PDF: leitura gratuita e conferência de dados antes de salvar!"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                Anexar PDF
                                <input
                                  type="file"
                                  accept=".pdf,image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleAttachFileToDoc(doc.id, f);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            )}
                          </div>

                          {/* Ações: Renovar + Histórico + Editar + Excluir */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openQuickRenew(doc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Renovar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setHistoryFilterDocId(doc.id);
                                setActiveSection('history');
                              }}
                              className={`p-1.5 rounded-lg cursor-pointer flex items-center gap-0.5 ${
                                docHistCount > 0
                                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100'
                                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800'
                              }`}
                              title="Histórico de versões desta certidão"
                            >
                              <History className="w-3.5 h-3.5" />
                              {docHistCount > 0 && (
                                <span className="text-[10px] font-mono font-bold">
                                  {docHistCount}
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(doc)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                              title="Editar detalhes"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(doc.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* BARRA INLINE PARA EDITAR O LINK DO SITE EMISSOR */}
                      {isEditingThisUrl && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-2 bg-blue-50/40 dark:bg-blue-950/20 p-2.5 rounded-lg">
                          <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 whitespace-nowrap">
                            Link do Site:
                          </span>
                          <input
                            type="url"
                            autoFocus
                            value={inlineEdit.value}
                            onChange={(e) =>
                              setInlineEdit({ ...inlineEdit, value: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitInlineEdit();
                              if (e.key === 'Escape') setInlineEdit(null);
                            }}
                            placeholder="https://..."
                            className="flex-1 px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-blue-500 rounded-lg text-slate-900 dark:text-white focus:outline-none"
                          />
                          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(inlineEdit.syncAllCompanies)}
                              onChange={(e) =>
                                setInlineEdit({
                                  ...inlineEdit,
                                  syncAllCompanies: e.target.checked,
                                })
                              }
                              className="rounded text-blue-600"
                            />
                            Aplicar em todas as empresas
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={commitInlineEdit}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer whitespace-nowrap"
                            >
                              Salvar Link
                            </button>
                            <button
                              type="button"
                              onClick={() => setInlineEdit(null)}
                              className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </section>
    )}

        {/* ====================================================================
            VIEW: CENTRAL DE GERENCIAMENTO DE EMPRESAS
        ==================================================================== */}
        {activeSection === 'companies' && (
          <section className="space-y-4">
            <CompanyManagementView
              companies={companies}
              documents={documents}
              activeCompanyId={selectedCompanyId}
              settings={settings}
              onSelectCompany={(compId) => {
                setSelectedCompanyId(compId);
                setActiveSection('dashboard');
              }}
              onSaveCompany={handleSaveCompanyFromManagement}
              onDeleteCompany={handleDeleteCompanyFromManagement}
              onArchiveCompany={handleArchiveCompanyFromManagement}
              onOpenSettings={(tab) => {
                setSettingsInitialTab(tab);
                setActiveSection('settings');
              }}
              onSaveAttachmentDataUrl={saveAttachmentData}
              onGetAttachmentDataUrl={getAttachmentData}
              onDeleteAttachmentDataUrl={deleteAttachmentData}
              onPreviewDoc={(title, dataUrl, mimeType, fileName) =>
                setPreviewModal({
                  doc: { name: title, fileName, fileMimeType: mimeType },
                  dataUrl,
                })
              }
            />
          </section>
        )}

        {/* ====================================================================
            VIEW: CENTRAL DE CONFIGURAÇÕES (PERSONALIZAÇÃO COMPLETA)
        ==================================================================== */}
        {activeSection === 'settings' && (
          <section className="space-y-4">
            <SettingsCenterView
              settings={settings}
              companies={companies}
              onUpdateSettings={(updated) => {
                setSettings(updated);
                if (updated.appearance.theme === 'dark' || updated.appearance.theme === 'light') {
                  setDarkMode(updated.appearance.theme === 'dark');
                }
                showToast('Configurações atualizadas com sucesso!');
              }}
              onResetSettings={() => {
                const fresh = buildDefaultAppSettings();
                setSettings(fresh);
                showToast('Configurações restauradas para o padrão de fábrica.');
              }}
              onClose={() => setActiveSection('dashboard')}
              initialTab={settingsInitialTab as any}
              user={currentUser}
              onOpenSyncModal={handleOpenSyncModal}
              onLoginGoogle={handleGoogleLogin}
              onLogoutGoogle={handleGoogleLogout}
              isOnline={isOnlineState}
              lastSyncTime={lastSyncTime}
            />
          </section>
        )}

        {/* ====================================================================
            VIEW 1B: IMPORTAR VÁRIOS PDFS EM LOTE
        ==================================================================== */}
        {activeSection === 'batch_import' && (
          <section className="space-y-4">
            <BatchPdfImportView
              isProcessing={isSmartReadingBatch}
              progressText={readingProgressText}
              onSelectFiles={(files, useAi) => handleSmartUploadAndMatch(files, useAi)}
            />
          </section>
        )}

        {/* ====================================================================
            VIEW 1C: CENTRAL DE PENDÊNCIAS E ALERTAS
        ==================================================================== */}
        {activeSection === 'pendencias' && (
          <PendenciasCenterView
            enrichedDocuments={enrichedDocuments}
            companies={companies}
            warningThresholdDays={warningThresholdDays}
            onStartAssistedEmission={(doc, comp) => handleSmartEmitClick(doc, comp)}
            onOpenQuickRenew={(doc) => openQuickRenew(doc)}
            onAttachFileToDoc={(docId, file) => handleAttachFileToDoc(docId, file)}
            onApproveReviewDoc={(docId) => {
              setDocuments((prev) =>
                prev.map((d) =>
                  d.id === docId
                    ? { ...d, awaitingReview: false, updatedAt: new Date().toISOString() }
                    : d
                )
              );
              showToast('Documento marcado como conferido!');
            }}
            onGoToCompanyDb={(companyId) => {
              setSelectedCompanyId(companyId);
              setActiveSection('company_db');
            }}
          />
        )}

        {/* ====================================================================
            VIEW 1D: HISTÓRICO DE CERTIDÕES E DOCUMENTOS SUBSTITUÍDOS
        ==================================================================== */}
        {activeSection === 'history' && (
          <DocumentHistoryView
            historyEntries={documentHistory}
            companies={companies}
            selectedCompanyId={selectedCompanyId}
            filterDocumentId={historyFilterDocId}
            onClearDocFilter={() => setHistoryFilterDocId(null)}
            onViewHistoryAttachment={(entry) => handleViewHistoryAttachment(entry)}
            onDownloadHistoryAttachment={(entry) => handleDownloadHistoryAttachment(entry)}
            onRestoreHistoryVersion={(entry) => handleRestoreHistoryVersion(entry)}
            onDeleteHistoryEntry={(entryId) => handleDeleteHistoryEntry(entryId)}
          />
        )}

        {/* ====================================================================
            VIEW 2: BANCO DE DADOS COMPLETO DE CADA EMPRESA (COM LEITURA DE PDF)
        ==================================================================== */}
        {activeSection === 'company_db' && (
          <section className="space-y-5">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Banco de Dados das Empresas para Autopreenchimento de Portais
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Você pode digitar os dados abaixo ou clicar em <strong>Preencher Ficha Lendo PDF</strong> (enviando o Cartão CNPJ, Contrato Social ou Certidão da JUCEPI/SEFAZ-PI) para o sistema extrair tudo sozinho!
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {companies.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCompanyId(c.id)}
                    className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                      activeCompany.id === c.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-500'
                    }`}
                  >
                    {c.companyName}
                  </button>
                ))}

                <input
                  ref={companyPdfInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handlePopulateCompanyFromPdf(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  disabled={isSmartReadingBatch}
                  onClick={() => companyPdfInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer disabled:opacity-60"
                >
                  {isSmartReadingBatch ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileScan className="w-3.5 h-3.5" />
                  )}
                  Preencher Ficha Lendo PDF (Cartão CNPJ / Contrato Social)
                </button>
              </div>
            </div>

            {/* DOCUMENTOS BASE DA EMPRESA (CARTÃO CNPJ, CNH DO SÓCIO, CONTRATO SOCIAL) */}
            <CompanyDocumentAttachmentManager
              company={activeCompany}
              companies={companies}
              onUpdateCompany={(updated) => {
                setCompanies((prev) =>
                  prev.map((c) => (c.id === activeCompany.id ? { ...c, ...updated } : c))
                );
                showToast('Ficha e documentos da empresa sincronizados!');
              }}
              onSaveAttachmentDataUrl={saveAttachmentData}
              onGetAttachmentDataUrl={getAttachmentData}
              onDeleteAttachmentDataUrl={deleteAttachmentData}
              onPreviewDoc={(title, dataUrl, mimeType, fileName) =>
                setPreviewModal({
                  doc: { name: title, fileName, fileMimeType: mimeType },
                  dataUrl,
                })
              }
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Bloco 1: Identificação Fiscal e Cadastral */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    1. Dados Fiscais, Estaduais (SEFAZ-PI) e Municipais ({activeCompany.companyName})
                  </h3>
                  {companies.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCompany(activeCompany.id)}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir esta empresa
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Razão Social Completa
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={activeCompany.companyName}
                        onChange={(e) => updateActiveCompanyField('companyName', e.target.value)}
                        className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText('db-razao', activeCompany.companyName, 'Razão Social')
                        }
                        className="px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      CNPJ (Com pontuação)
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={activeCompany.cnpj}
                        onChange={(e) => updateActiveCompanyField('cnpj', e.target.value)}
                        placeholder="00.000.000/0001-00"
                        className="flex-1 px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(
                            'db-cnpj-num',
                            onlyDigits(activeCompany.cnpj),
                            'CNPJ (Só Números)'
                          )
                        }
                        className="px-2.5 py-2 text-xs font-mono bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        Só Nº
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Inscrição Estadual - IE (SEFAZ-PI)
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={activeCompany.stateRegistration}
                        onChange={(e) =>
                          updateActiveCompanyField('stateRegistration', e.target.value)
                        }
                        placeholder="Ex: 19.456.789-0"
                        className="flex-1 px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(
                            'db-ie-num',
                            onlyDigits(activeCompany.stateRegistration),
                            'IE (Só Números)'
                          )
                        }
                        className="px-2.5 py-2 text-xs font-mono bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        Só Nº
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Inscrição Municipal / CMC (Prefeitura)
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={activeCompany.municipalRegistration}
                        onChange={(e) =>
                          updateActiveCompanyField('municipalRegistration', e.target.value)
                        }
                        placeholder="Ex: 458920-1"
                        className="flex-1 px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(
                            'db-im-num',
                            onlyDigits(activeCompany.municipalRegistration),
                            'IM (Só Números)'
                          )
                        }
                        className="px-2.5 py-2 text-xs font-mono bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        Só Nº
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      NIRE (Junta Comercial - JUCEPI)
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={activeCompany.nire}
                        onChange={(e) => updateActiveCompanyField('nire', e.target.value)}
                        className="flex-1 px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyText('db-nire', activeCompany.nire, 'NIRE')}
                        className="px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      E-mail para Recebimento de Certidões
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="email"
                        value={activeCompany.email}
                        onChange={(e) => updateActiveCompanyField('email', e.target.value)}
                        className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyText('db-email', activeCompany.email, 'E-mail')}
                        className="px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Telefone / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={activeCompany.phone}
                      onChange={(e) => updateActiveCompanyField('phone', e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      CEP
                    </label>
                    <input
                      type="text"
                      value={activeCompany.cep}
                      onChange={(e) => updateActiveCompanyField('cep', e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Município / UF
                    </label>
                    <input
                      type="text"
                      value={activeCompany.cityState}
                      onChange={(e) => updateActiveCompanyField('cityState', e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Endereço Completo da Sede
                    </label>
                    <input
                      type="text"
                      value={activeCompany.address}
                      onChange={(e) => updateActiveCompanyField('address', e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Sócio Administrador & Responsável Técnico */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    2. Sócio Administrador e Responsável Técnico
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Nome do Sócio Administrador
                      </label>
                      <input
                        type="text"
                        value={activeCompany.partnerName}
                        onChange={(e) => updateActiveCompanyField('partnerName', e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        CPF do Sócio
                      </label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={activeCompany.partnerCpf}
                          onChange={(e) => updateActiveCompanyField('partnerCpf', e.target.value)}
                          className="flex-1 px-2.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(
                              'db-cpf-num',
                              onlyDigits(activeCompany.partnerCpf),
                              'CPF Sócio (Só Números)'
                            )
                          }
                          className="px-2 py-1 text-xs font-mono bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-lg cursor-pointer"
                        >
                          Só Nº
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Nascimento do Sócio
                      </label>
                      <input
                        type="date"
                        value={activeCompany.partnerBirthDate}
                        onChange={(e) =>
                          updateActiveCompanyField('partnerBirthDate', e.target.value)
                        }
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Nº Registro CNH
                      </label>
                      <input
                        type="text"
                        value={activeCompany.partnerCnhNumber || ''}
                        onChange={(e) => updateActiveCompanyField('partnerCnhNumber', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                        placeholder="01234567890"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Cat. & Validade CNH
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={activeCompany.partnerCnhCategory || ''}
                          onChange={(e) => updateActiveCompanyField('partnerCnhCategory', e.target.value.toUpperCase())}
                          className="w-14 px-2 py-2 text-xs font-mono uppercase bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                          placeholder="AB"
                        />
                        <input
                          type="date"
                          value={activeCompany.partnerCnhExpirationDate || ''}
                          onChange={(e) => updateActiveCompanyField('partnerCnhExpirationDate', e.target.value)}
                          className="flex-1 px-2.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Responsável Técnico (RT)
                      </label>
                      <input
                        type="text"
                        value={activeCompany.techResponsibleName}
                        onChange={(e) =>
                          updateActiveCompanyField('techResponsibleName', e.target.value)
                        }
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Nº Conselho (CREA-PI / CRQ / CRBio)
                      </label>
                      <input
                        type="text"
                        value={activeCompany.techResponsibleCouncil}
                        onChange={(e) =>
                          updateActiveCompanyField('techResponsibleCouncil', e.target.value)
                        }
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        CPF do Responsável Técnico
                      </label>
                      <input
                        type="text"
                        value={activeCompany.techResponsibleCpf}
                        onChange={(e) =>
                          updateActiveCompanyField('techResponsibleCpf', e.target.value)
                        }
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Senhas / Credenciais de Portais */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="block text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-amber-500" />
                    3. Anotações de Senhas / Acessos nos Portais (SIAT Teresina, SEFAZ-PI, Conselhos)
                  </label>
                  <textarea
                    rows={2}
                    value={activeCompany.portalAccessNotes}
                    onChange={(e) =>
                      updateActiveCompanyField('portalAccessNotes', e.target.value)
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Bloco Lateral: Favorito Mágico + Fichário de Cópia */}
              <div className="space-y-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-900 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Botão Mágico de AutoPreenchimento
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Arraste o botão azul abaixo para a <strong>Barra de Favoritos</strong> do seu navegador. Quando abrir qualquer site de certidão, clique nele nos seus favoritos: ele preenche <strong>CNPJ, IE, IM, CPF e E-mail sozinho</strong> e já posiciona o cursor direto no <strong>Captcha</strong>!
                  </p>
                  <div className="pt-1">
                    <a
                      href={bookmarkletHref}
                      onClick={(e) => {
                        e.preventDefault();
                        showToast(
                          'Arraste este botão com o mouse até a Barra de Favoritos do seu navegador!'
                        );
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow cursor-grab active:cursor-grabbing"
                    >
                      <Zap className="w-4 h-4 text-amber-300" />
                      ⚡ AutoPreencher: {activeCompany.companyName.slice(0, 22)}
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTampermonkeyModal(true)}
                    className="w-full py-2 px-3 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 rounded-lg cursor-pointer"
                  >
                    Ver Script 100% Automático (Tampermonkey)
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Fichário de Cópia em 1 Clique ({activeCompany.companyName})
                  </h3>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {(Object.entries(activeCompanyFieldMap) as [
                      AutoFillFieldKey,
                      { label: string; value: string; description: string }
                    ][]).map(([key, item]) => (
                      <div key={key} className="py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-700 dark:text-slate-300">
                            {item.label}
                          </div>
                          <div className="font-mono text-slate-500 dark:text-slate-400 truncate">
                            {item.value || 'Não preenchido'}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!item.value}
                          onClick={() => handleCopyText(`card-${key}`, item.value, item.label)}
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white rounded transition-colors cursor-pointer shrink-0 disabled:opacity-40"
                        >
                          {copiedId === `card-${key}` ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ====================================================================
            VIEW 3: GERENCIAR LINKS & DADO AUTOMÁTICO POR SITE
        ==================================================================== */}
        {activeSection === 'links' && (
          <section className="space-y-4">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Configuração dos Links de Emissão e Dado Automático por Site
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Escolha qual dado do Banco de Dados da Empresa (CNPJ limpo, IE SEFAZ-PI, IM Prefeitura, CPF do Sócio, NIRE) deve ser copiado e injetado automaticamente ao clicar em <strong>Emitir Auto</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('dashboard')}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                Voltar para Lista
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
              {enrichedDocuments.map(({ doc, company: comp }, idx) => (
                <PortalLinkRowEditor
                  key={doc.id}
                  index={idx + 1}
                  doc={doc}
                  company={comp}
                  onEmit={() => handleSmartEmitClick(doc, comp)}
                  onSaveLink={(newUrl, newIssuer, newPrimaryField) =>
                    handleUpdatePortalLinkEverywhere(doc, newUrl, newIssuer, newPrimaryField)
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* ====================================================================
            VIEW 4: BACKUP, IMPORTAÇÃO E PLANILHA
        ==================================================================== */}
        {activeSection === 'backup' && (
          <section className="max-w-4xl space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <DownloadCloud className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Exportar Backup Completo (JSON)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Salva o banco de dados de todas as empresas do Piauí, certidões, links e PDFs anexados.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="w-full py-2 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  Baixar Backup (.JSON)
                </button>
              </div>

              <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Exportar Planilha (Excel / CSV)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Exporta a lista atual para planilha compatível com Excel e Google Planilhas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="w-full py-2 px-4 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
                >
                  Exportar Planilha (.CSV)
                </button>
              </div>

              <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <UploadCloud className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Importar Backup (JSON)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Restaure um backup salvo anteriormente com todas as suas empresas e documentos.
                  </p>
                </div>
                <div>
                  <input
                    ref={fileInputImportRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImportJSON(f);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputImportRef.current?.click()}
                    className="w-full py-2 px-4 text-xs font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    Selecionar Arquivo (.JSON)
                  </button>
                </div>
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Restaurar Configuração Inicial
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Recarrega a lista original de empresas e as 23 certidões padrão do Piauí.
                </p>
              </div>
              {resetConfirmOpen ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetToInitialData}
                    className="px-3 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
                  >
                    Confirmar Restauração
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetConfirmOpen(false)}
                    className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setResetConfirmOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restaurar Padrão
                </button>
              )}
            </div>
          </section>
        )}
      </main>

      {/* ====================================================================
          MODAL: AUTOMAÇÃO DE PREENCHIMENTO NOS PORTAIS
      ==================================================================== */}
      {showTampermonkeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  Como funciona o Preenchimento Automático nos Sites do Governo
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Deixe tudo preenchido automaticamente para você só digitar o código do Captcha!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTampermonkeyModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="font-bold text-slate-900 dark:text-white">
                  1. Automático ao Clicar em "⚡ Emitir Auto" + Leitura de PDF
                </div>
                <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
                  <li>
                    Ao clicar em <strong>⚡ Emitir Auto</strong>, o sistema já copia automaticamente o CNPJ/IE/IM exato daquela certidão para o seu <strong>Ctrl+V</strong>.
                  </li>
                  <li>
                    Assim que baixar o PDF da certidão, basta clicar em <strong>Anexar PDF</strong>: o programa lê o PDF sozinho e preenche a Data de Emissão, Data de Vencimento e o Código de Autenticidade automaticamente!
                  </li>
                </ul>
              </div>

              <div className="p-4 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 space-y-2.5">
                <div className="font-bold text-slate-900 dark:text-white">
                  2. Favorito Mágico de 1 Clique (Sem instalar extensão)
                </div>
                <p>
                  Arraste o botão abaixo para a sua <strong>Barra de Favoritos</strong> do Chrome/Edge. Quando o site da SEFAZ-PI, TJPI, Receita ou Prefeitura abrir, clique nesse favorito: ele preenche todos os campos na tela e <strong>já deixa o cursor piscando no Captcha</strong>:
                </p>
                <div>
                  <a
                    href={bookmarkletHref}
                    onClick={(e) => {
                      e.preventDefault();
                      showToast('Arraste este botão até a sua Barra de Favoritos do navegador!');
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow cursor-grab"
                  >
                    <Zap className="w-4 h-4 text-amber-300" />
                    ⚡ AutoPreencher {activeCompany.companyName}
                  </a>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-blue-600" />
                    3. Preenchimento 100% Sozinho ao Abrir a Aba (Tampermonkey)
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(
                        'copy-userscript',
                        generateTampermonkeyScript(),
                        'Script de Autopreenchimento'
                      )
                    }
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copiar Script Automático
                  </button>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Se você usa a extensão gratuita <strong>Tampermonkey</strong>, cole este script nela: ele lê os dados enviados pelo botão Emitir e preenche o site do governo sozinho assim que a página carrega!
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowTampermonkeyModal(false)}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
              >
                Entendi, Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: CRIAR NOVA EMPRESA DO PIAUÍ
      ==================================================================== */}
      {companyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {companyModal.isNew ? 'Cadastrar Nova Empresa (Piauí)' : 'Editar Cadastro da Empresa'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Anexe os documentos (CNPJ, CNH, Contrato) para preenchimento automático inteligente.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompanyModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Gerenciador de Anexos Base com Auto-Leitura de CNPJ e CNH */}
              <CompanyDocumentAttachmentManager
                company={companyModal.profile}
                companies={companies}
                onUpdateCompany={(updated) =>
                  setCompanyModal({
                    ...companyModal,
                    profile: { ...companyModal.profile, ...updated },
                  })
                }
                onSaveAttachmentDataUrl={saveAttachmentData}
                onGetAttachmentDataUrl={getAttachmentData}
                onDeleteAttachmentDataUrl={deleteAttachmentData}
                onPreviewDoc={(title, dataUrl, mimeType, fileName) =>
                  setPreviewModal({
                    doc: { name: title, fileName, fileMimeType: mimeType },
                    dataUrl,
                  })
                }
              />

              {/* Seção 1: Dados Empresariais */}
              <div className="p-3.5 bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 rounded-xl space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  1. Dados Empresariais e Fiscais
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Razão Social Completa *
                    </label>
                    <input
                      type="text"
                      required
                      value={companyModal.profile.companyName}
                      onChange={(e) =>
                        setCompanyModal({
                          ...companyModal,
                          profile: { ...companyModal.profile, companyName: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      placeholder="Ex: Desinfecta Serviços Ltda"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nome Fantasia
                    </label>
                    <input
                      type="text"
                      value={companyModal.profile.tradeName || ''}
                      onChange={(e) =>
                        setCompanyModal({
                          ...companyModal,
                          profile: { ...companyModal.profile, tradeName: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      placeholder="Nome de Fachada / Fantasia"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      CNPJ *
                    </label>
                    <input
                      type="text"
                      required
                      value={companyModal.profile.cnpj}
                      onChange={(e) =>
                        setCompanyModal({
                          ...companyModal,
                          profile: { ...companyModal.profile, cnpj: formatCNPJ(e.target.value) },
                        })
                      }
                      className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      placeholder="00.000.000/0001-00"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Inscrição Estadual (SEFAZ-PI)
                    </label>
                    <input
                      type="text"
                      value={companyModal.profile.stateRegistration}
                      onChange={(e) =>
                        setCompanyModal({
                          ...companyModal,
                          profile: {
                            ...companyModal.profile,
                            stateRegistration: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      placeholder="Ex: 19.456.789-0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Inscrição Municipal (CMC Prefeitura)
                    </label>
                    <input
                      type="text"
                      value={companyModal.profile.municipalRegistration}
                      onChange={(e) =>
                        setCompanyModal({
                          ...companyModal,
                          profile: {
                            ...companyModal.profile,
                            municipalRegistration: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      placeholder="Ex: 458920-1"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      NIRE (JUCEPI)
                    </label>
                    <input
                      type="text"
                      value={companyModal.profile.nire}
                      onChange={(e) =>
                        setCompanyModal({
                          ...companyModal,
                          profile: { ...companyModal.profile, nire: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      placeholder="Ex: 22200123456"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      CNAE Principal
                    </label>
                    <input
                      type="text"
                      value={companyModal.profile.cnaeMain || ''}
                      onChange={(e) =>
                        setCompanyModal({
                          ...companyModal,
                          profile: { ...companyModal.profile, cnaeMain: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      placeholder="Ex: 81.22-2-00"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Situação Cadastral & Abertura
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={companyModal.profile.cadastralSituation || ''}
                        onChange={(e) =>
                          setCompanyModal({
                            ...companyModal,
                            profile: { ...companyModal.profile, cadastralSituation: e.target.value.toUpperCase() },
                          })
                        }
                        className="w-24 px-3 py-2 text-sm font-semibold uppercase bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        placeholder="ATIVA"
                      />
                      <input
                        type="date"
                        value={companyModal.profile.openingDate || ''}
                        onChange={(e) =>
                          setCompanyModal({
                            ...companyModal,
                            profile: { ...companyModal.profile, openingDate: e.target.value },
                          })
                        }
                        className="flex-1 px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        title="Data de Abertura da Empresa"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      CNAEs Secundários (Atividades Econômicas)
                    </label>
                    <textarea
                      rows={2}
                      value={companyModal.profile.cnaeSecondaryText || ''}
                      onChange={(e) =>
                        setCompanyModal({
                          ...companyModal,
                          profile: { ...companyModal.profile, cnaeSecondaryText: e.target.value },
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      placeholder="Códigos e descrições dos CNAEs secundários"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 2: Endereço e Contato */}
              <div className="p-3.5 bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 rounded-xl space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  2. Endereço e Contato
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Endereço / Logradouro
                    </label>
                    <input
                      type="text"
                      value={companyModal.profile.address || ''}
                      onChange={(e) =>
                        setCompanyModal({
                          ...companyModal,
                          profile: { ...companyModal.profile, address: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      placeholder="Rua, Avenida, Número"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Bairro
                    </label>
                    <input
                      type="text"
                      value={companyModal.profile.neighborhood || ''}
                      onChange={(e) =>
                        setCompanyModal({
                          ...companyModal,
                          profile: { ...companyModal.profile, neighborhood: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      placeholder="Bairro"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      CEP
                    </label>
                    <input
                      type="text"
                      value={companyModal.profile.cep || ''}
                      onChange={(e) =>
                        setCompanyModal({
                          ...companyModal,
                          profile: { ...companyModal.profile, cep: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      placeholder="64000-000"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Município / UF
                    </label>
                    <input
                      type="text"
                      value={companyModal.profile.cityState || ''}
                      onChange={(e) =>
                        setCompanyModal({
                          ...companyModal,
                          profile: { ...companyModal.profile, cityState: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      placeholder="Teresina - PI"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Telefone / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={companyModal.profile.phone || ''}
                      onChange={(e) =>
                        setCompanyModal({
                          ...companyModal,
                          profile: { ...companyModal.profile, phone: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      placeholder="(86) 99999-0000"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      E-mail para Emissão de Certidões
                    </label>
                    <input
                      type="email"
                      value={companyModal.profile.email}
                      onChange={(e) =>
                        setCompanyModal({
                          ...companyModal,
                          profile: { ...companyModal.profile, email: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      placeholder="contato@empresa.com.br"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 3: Sócio Administrador e CNH */}
              <div className="p-3.5 bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-2">
                    <span>3. Sócio Administrador & Representante Legal</span>
                    <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-300 rounded border border-emerald-300 dark:border-emerald-700 uppercase">
                      Prioridade: CNH do Sócio
                    </span>
                  </div>
                  {companyModal.profile.companyDocuments?.some((d) => d.docType === 'cnh_socio') && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3 h-3" /> CNH Oficial Vinculada
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nome Completo do Sócio Administrador
                    </label>
                    <input
                      type="text"
                      value={companyModal.profile.partnerName || ''}
                      onChange={(e) =>
                        setCompanyModal({
                          ...companyModal,
                          profile: { ...companyModal.profile, partnerName: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      placeholder="Nome conforme CNH ou RG"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      CPF do Sócio Administrador
                    </label>
                    <input
                      type="text"
                      value={companyModal.profile.partnerCpf}
                      onChange={(e) =>
                        setCompanyModal({
                          ...companyModal,
                          profile: { ...companyModal.profile, partnerCpf: formatCPF(e.target.value) },
                        })
                      }
                      className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      placeholder="000.000.000-00"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      RG do Sócio Administrador
                    </label>
                    <input
                      type="text"
                      value={companyModal.profile.partnerRg || ''}
                      onChange={(e) =>
                        setCompanyModal({
                          ...companyModal,
                          profile: { ...companyModal.profile, partnerRg: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      placeholder="1.234.567 SSP-PI"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Data de Nascimento do Sócio
                    </label>
                    <input
                      type="date"
                      value={companyModal.profile.partnerBirthDate || ''}
                      onChange={(e) =>
                        setCompanyModal({
                          ...companyModal,
                          profile: { ...companyModal.profile, partnerBirthDate: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nº de Registro da CNH
                    </label>
                    <input
                      type="text"
                      value={companyModal.profile.partnerCnhNumber || ''}
                      onChange={(e) =>
                        setCompanyModal({
                          ...companyModal,
                          profile: { ...companyModal.profile, partnerCnhNumber: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      placeholder="Ex: 01234567890"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Categoria & Validade da CNH
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={companyModal.profile.partnerCnhCategory || ''}
                        onChange={(e) =>
                          setCompanyModal({
                            ...companyModal,
                            profile: { ...companyModal.profile, partnerCnhCategory: e.target.value.toUpperCase() },
                          })
                        }
                        className="w-20 px-3 py-2 text-sm font-mono uppercase bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        placeholder="AB"
                      />
                      <input
                        type="date"
                        value={companyModal.profile.partnerCnhExpirationDate || ''}
                        onChange={(e) =>
                          setCompanyModal({
                            ...companyModal,
                            profile: { ...companyModal.profile, partnerCnhExpirationDate: e.target.value },
                          })
                        }
                        className="flex-1 px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        title="Data de Validade da CNH (extraída diretamente do documento)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {companyModal.isNew && (
                <label className="flex items-center gap-2 p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={companyModal.cloneStandardDocs}
                    onChange={(e) =>
                      setCompanyModal({
                        ...companyModal,
                        cloneStandardDocs: e.target.checked,
                      })
                    }
                    className="rounded text-blue-600"
                  />
                  <span>
                    Criar automaticamente as <strong>23 certidões padrão do Piauí</strong> para esta empresa.
                  </span>
                </label>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCompanyModal(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  Salvar Empresa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: 1-CLICK QUICK RENEWAL (COM LEITURA AUTOMÁTICA DO PDF ANEXADO)
      ==================================================================== */}
      {renewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Renovar Certidão (Leitura Automática de PDF)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {renewingDoc.doc.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRenewingDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={confirmQuickRenew} className="space-y-4">
              <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-blue-900 dark:text-blue-200">
                  1. Anexe o PDF da Certidão (O sistema lerá a Emissão e Vencimento sozinho)
                </label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => handleRenewModalFileSelect(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                />
                {renewingDoc.extractedInfo && (
                  <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 pt-1">
                    {renewingDoc.extractedInfo}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nova Emissão
                  </label>
                  <input
                    type="date"
                    required
                    value={renewingDoc.newIssueDate}
                    onChange={(e) => {
                      const newIssue = e.target.value;
                      const nextExp = addDaysToDateString(newIssue, renewingDoc.newValidityDays);
                      setRenewingDoc({
                        ...renewingDoc,
                        newIssueDate: newIssue,
                        newExpirationDate: nextExp,
                      });
                    }}
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Prazo (Dias)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={renewingDoc.newValidityDays}
                    onChange={(e) => {
                      const days = Math.max(1, parseInt(e.target.value, 10) || 30);
                      const nextExp = addDaysToDateString(renewingDoc.newIssueDate, days);
                      setRenewingDoc({
                        ...renewingDoc,
                        newValidityDays: days,
                        newExpirationDate: nextExp,
                      });
                    }}
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Novo Vencimento
                  </label>
                  <input
                    type="date"
                    required
                    value={renewingDoc.newExpirationDate}
                    onChange={(e) =>
                      setRenewingDoc({ ...renewingDoc, newExpirationDate: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums font-semibold bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg text-emerald-900 dark:text-emerald-300"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-500 mr-1">Prazos rápidos:</span>
                {[30, 60, 90, 180, 365].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      const nextExp = addDaysToDateString(renewingDoc.newIssueDate, d);
                      setRenewingDoc({
                        ...renewingDoc,
                        newValidityDays: d,
                        newExpirationDate: nextExp,
                      });
                    }}
                    className={`px-2.5 py-1 text-xs font-mono tabular-nums rounded border cursor-pointer ${
                      renewingDoc.newValidityDays === d
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-transparent'
                    }`}
                  >
                    +{d} dias
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setRenewingDoc(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Confirmar Renovação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: COMPLETE CREATE / EDIT DOCUMENT MODAL
      ==================================================================== */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-xl my-8">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isNewDocModal ? 'Cadastrar Nova Certidão / Licença' : 'Editar Certidão / Automação'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editingDoc.name.trim()) return;
                setDocuments((prev) => {
                  const exists = prev.some((d) => d.id === editingDoc.id);
                  if (exists) {
                    return prev.map((d) =>
                      d.id === editingDoc.id
                        ? { ...editingDoc, updatedAt: new Date().toISOString() }
                        : d
                    );
                  }
                  return [{ ...editingDoc, updatedAt: new Date().toISOString() }, ...prev];
                });
                setEditingDoc(null);
                showToast(
                  isNewDocModal
                    ? 'Nova certidão adicionada com sucesso!'
                    : 'Dados da certidão atualizados!'
                );
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Empresa Vinculada
                  </label>
                  <select
                    value={editingDoc.companyId}
                    onChange={(e) => {
                      const comp = companies.find((c) => c.id === e.target.value);
                      setEditingDoc({
                        ...editingDoc,
                        companyId: e.target.value,
                        registrationCode: comp ? comp.cnpj : editingDoc.registrationCode,
                      });
                    }}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName} ({c.cnpj})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Categoria
                  </label>
                  <select
                    value={editingDoc.category}
                    onChange={(e) =>
                      setEditingDoc({
                        ...editingDoc,
                        category: e.target.value as DocumentCategory,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="Fiscais e Trabalhistas">A. Certidões Fiscais e Trabalhistas</option>
                    <option value="Alvarás, Licenças e Conselhos">B. Alvarás, Licenças e Conselhos</option>
                    <option value="Societário, Contábil e Qualificação Técnica">
                      C. Societário, Contábil e Qualificação Técnica
                    </option>
                  </select>
                </div>

                {/* Campo de Destaque / Apelido Rápido */}
                <div className="sm:col-span-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      Nome de Destaque / Apelido Rápido (Opcional)
                    </label>
                    <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      Ex: ESPECÍFICA, SIMPLIFICADA
                    </span>
                  </div>
                  <input
                    type="text"
                    value={editingDoc.highlightName || ''}
                    onChange={(e) =>
                      setEditingDoc({
                        ...editingDoc,
                        highlightName: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="Ex: ESPECIFICA (deixe em branco se preferir usar apenas o nome oficial)"
                    className="w-full px-3 py-2 text-sm font-bold uppercase tracking-wider bg-white dark:bg-slate-900 border border-amber-400 dark:border-amber-600 rounded-lg text-amber-950 dark:text-amber-100 placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    💡 Quando preenchido, a certidão exibirá este nome em destaque e a <strong>ordem alfabética</strong> da lista será organizada por ele!
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nome Oficial da Certidão / Licença / Documento *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingDoc.name}
                    onChange={(e) => setEditingDoc({ ...editingDoc, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Órgão Emissor
                  </label>
                  <input
                    type="text"
                    value={editingDoc.issuer}
                    onChange={(e) => setEditingDoc({ ...editingDoc, issuer: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Qual dado copiar/usar ao clicar em "Emitir Auto"?
                  </label>
                  <select
                    value={editingDoc.primaryAutoFillField || 'cnpj_num'}
                    onChange={(e) =>
                      setEditingDoc({
                        ...editingDoc,
                        primaryAutoFillField: e.target.value as AutoFillFieldKey,
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-semibold bg-blue-50/50 dark:bg-slate-950 border border-blue-300 dark:border-blue-800 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="cnpj_num">CNPJ (Somente Números - Receita, TST, Caixa, SEFAZ)</option>
                    <option value="cnpj_fmt">CNPJ (Com Pontuação 00.000.000/0001-00)</option>
                    <option value="ie_num">Inscrição Estadual SEFAZ-PI (Somente Números)</option>
                    <option value="im_num">Inscrição Municipal Prefeitura (Somente Números)</option>
                    <option value="cpf_num">CPF do Sócio Administrador (Somente Números)</option>
                    <option value="nire">NIRE (JUCEPI)</option>
                    <option value="council">Registro no Conselho (CREA-PI / CRQ / CRBio)</option>
                    <option value="email">E-mail da Empresa</option>
                    <option value="razao">Razão Social</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
                    Link do Site Emissor
                  </label>
                  <input
                    type="url"
                    value={editingDoc.emitterUrl}
                    onChange={(e) => setEditingDoc({ ...editingDoc, emitterUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-sm font-mono bg-blue-50/40 dark:bg-slate-950 border border-blue-300 dark:border-blue-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Permanent toggle + Automated Date Calculation */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingDoc.isPermanent}
                    onChange={(e) =>
                      setEditingDoc({
                        ...editingDoc,
                        isPermanent: e.target.checked,
                        expirationDate: e.target.checked ? '' : editingDoc.expirationDate,
                      })
                    }
                    className="rounded border-slate-300 text-blue-600"
                  />
                  Documento com Prazo Indeterminado / Permanente
                </label>

                {!editingDoc.isPermanent && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Data de Emissão
                      </label>
                      <input
                        type="date"
                        value={editingDoc.issueDate}
                        onChange={(e) => {
                          const newIssue = e.target.value;
                          const nextExp =
                            newIssue && editingDoc.validityDays !== ''
                              ? addDaysToDateString(newIssue, Number(editingDoc.validityDays))
                              : editingDoc.expirationDate;
                          setEditingDoc({
                            ...editingDoc,
                            issueDate: newIssue,
                            expirationDate: nextExp,
                          });
                        }}
                        className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Validade (em dias)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={editingDoc.validityDays}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const days = raw === '' ? '' : Math.max(1, parseInt(raw, 10) || 0);
                          const nextExp =
                            days !== '' && editingDoc.issueDate
                              ? addDaysToDateString(editingDoc.issueDate, Number(days))
                              : editingDoc.expirationDate;
                          setEditingDoc({
                            ...editingDoc,
                            validityDays: days,
                            expirationDate: nextExp,
                          });
                        }}
                        className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Data de Vencimento
                      </label>
                      <input
                        type="date"
                        value={editingDoc.expirationDate}
                        onChange={(e) =>
                          setEditingDoc({ ...editingDoc, expirationDate: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs font-mono tabular-nums font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  Salvar Documento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: PDF / IMAGE PREVIEW
      ==================================================================== */}
      {previewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {previewModal.doc.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {previewModal.doc.fileName || previewModal.doc.driveUrl}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {previewModal.dataUrl && (
                  <button
                    type="button"
                    onClick={() => handleDownloadAttachment(previewModal.doc)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar Arquivo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-auto p-4">
              {previewModal.dataUrl ? (
                previewModal.doc.fileMimeType?.startsWith('image/') ? (
                  <img
                    src={previewModal.dataUrl}
                    alt={previewModal.doc.name}
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full object-contain rounded shadow"
                  />
                ) : (
                  <iframe
                    src={previewModal.dataUrl}
                    title={previewModal.doc.name}
                    className="w-full h-full rounded border border-slate-200 dark:border-slate-800 bg-white"
                  />
                )
              ) : (
                <div className="text-xs text-slate-500">Nenhum anexo carregado.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: CONFERIR DADOS EXTRAÍDOS DE PDF (AVULSO OU EM LOTE)
      ==================================================================== */}
      {pendingReviewItems.length > 0 && (
        <ReviewExtractionModal
          items={pendingReviewItems}
          companies={companies}
          documents={documents}
          isProcessingMore={isSmartReadingBatch}
          processingStatusText={readingProgressText}
          onUpdateItem={(tempId, updater) =>
            setPendingReviewItems((prev) =>
              prev.map((it) => (it.tempId === tempId ? updater(it) : it))
            )
          }
          onRunGeminiEnrichItem={(tempId) => handleRunGeminiEnrichItem(tempId)}
          onAddMoreFiles={(files) => handleSmartUploadAndMatch(files)}
          onConfirmAllSelected={() => handleConfirmPendingReviews()}
          onCancel={() => setPendingReviewItems([])}
        />
      )}

      {/* ====================================================================
          MODAL: DELETE CONFIRMATION
      ==================================================================== */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Excluir Certidão?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Tem certeza que deseja remover este documento da lista desta empresa?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteDocument}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: CONFIRMAR EXCLUSÃO / ARQUIVAMENTO DE EMPRESA (DO PAINEL PRINCIPAL)
      ==================================================================== */}
      {companyToDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Excluir ou Desativar Cadastro de Empresa?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Empresa: <strong className="text-slate-800 dark:text-slate-200">{companyToDeleteConfirm.companyName}</strong> (CNPJ: {companyToDeleteConfirm.cnpj})
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Impacto da Exclusão:
              </div>
              <p>
                Esta empresa possui <strong>{documents.filter((d) => d.companyId === companyToDeleteConfirm.id).length} certidão(ões)</strong> cadastradas no sistema.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  handleArchiveCompanyFromManagement(companyToDeleteConfirm.id, true);
                  setCompanyToDeleteConfirm(null);
                }}
                className="w-full py-2.5 px-4 text-xs font-bold text-amber-800 dark:text-amber-200 bg-amber-100/80 hover:bg-amber-200/80 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 rounded-xl border border-amber-300 dark:border-amber-800 transition cursor-pointer text-left flex items-center justify-between"
              >
                <div>
                  <div className="font-bold">1. Arquivar Empresa (Recomendado)</div>
                  <div className="text-[11px] font-normal text-amber-700/90 dark:text-amber-300/80">
                    Oculta a empresa do seletor principal, preservando todas as certidões e histórico caso precise restaurá-la depois.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleDeleteCompanyFromManagement(companyToDeleteConfirm.id);
                  setCompanyToDeleteConfirm(null);
                }}
                className="w-full py-2.5 px-4 text-xs font-bold text-rose-700 dark:text-rose-200 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 rounded-xl border border-rose-200 dark:border-rose-900 transition cursor-pointer text-left flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-rose-600 dark:text-rose-400">2. Excluir Definitivamente</div>
                  <div className="text-[11px] font-normal text-rose-700/80 dark:text-rose-300/80">
                    Remove permanentemente o cadastro da empresa, certidões e anexos vinculados.
                  </div>
                </div>
              </button>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCompanyToDeleteConfirm(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      <DeletePdfModal
        isOpen={Boolean(deletingPdfDoc)}
        doc={deletingPdfDoc}
        onClose={() => setDeletingPdfDoc(null)}
        onConfirm={(docId, clearExtracted) => handleConfirmDeletePdf(docId, clearExtracted)}
      />

      {/* ====================================================================
          MODAL: VISUALIZADOR INTEGRADO DE PDF (PREVIEW + AÇÕES)
      ==================================================================== */}
      <PdfViewerModal
        isOpen={Boolean(viewingPdfDoc)}
        doc={viewingPdfDoc}
        companyName={companies.find((c) => c.id === viewingPdfDoc?.companyId)?.companyName}
        onClose={() => setViewingPdfDoc(null)}
        onDownload={(doc) => handleDownloadAttachment(doc)}
        onRequestReplace={(doc) => {
          setViewingPdfDoc(null);
          openQuickRenew(doc);
        }}
        onRequestDeletePdf={(doc) => {
          setViewingPdfDoc(null);
          setDeletingPdfDoc(doc);
        }}
      />

      {/* ====================================================================
          MODAL: SINCRONIZAÇÃO EM NUVEM FIREBASE (PRÉVIA + CONFLITOS)
      ==================================================================== */}
      <FirebaseSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        user={currentUser}
        preview={syncPreview}
        isSyncing={isSyncing}
        onConfirmSync={handleConfirmSync}
      />

      {/* FLOATING TOAST */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-slate-900 dark:bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-w-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 py-4 px-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/aistudio/Wizard_Hat_and_Spellbook_Stack_8d8be742.png"
              alt="Mago das Licitações"
              className="w-5 h-5 object-contain shrink-0"
            />
            <span>
              Mago das Licitações — Emissão Assistida, Leitura Gratuita de PDFs (PDF.js + OCR), Lote e Histórico (Piauí)
            </span>
          </div>
          <span>Banco de dados local sincronizado automaticamente</span>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENT: PORTAL LINK & AUTOFILL CONFIG ROW EDITOR
// ============================================================================

function PortalLinkRowEditor({
  index,
  doc,
  company,
  onEmit,
  onSaveLink,
}: {
  index: number;
  doc: CertidaoDocument;
  company: CompanyProfile;
  onEmit: () => void;
  onSaveLink: (url: string, issuer: string, primaryField: AutoFillFieldKey) => void;
}) {
  const [urlValue, setUrlValue] = useState(doc.emitterUrl || '');
  const [issuerValue, setIssuerValue] = useState(doc.issuer || '');
  const [fieldKey, setFieldKey] = useState<AutoFillFieldKey>(
    doc.primaryAutoFillField || 'cnpj_num'
  );

  const isDirty =
    urlValue !== (doc.emitterUrl || '') ||
    issuerValue !== (doc.issuer || '') ||
    fieldKey !== (doc.primaryAutoFillField || 'cnpj_num');

  useEffect(() => {
    setUrlValue(doc.emitterUrl || '');
    setIssuerValue(doc.issuer || '');
    setFieldKey(doc.primaryAutoFillField || 'cnpj_num');
  }, [doc.emitterUrl, doc.issuer, doc.primaryAutoFillField]);

  const targetUrl = buildAutoFillTargetUrl(urlValue, company);

  return (
    <div className="p-3.5 flex flex-col xl:flex-row xl:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
      <div className="min-w-0 xl:w-1/3">
        <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="font-mono text-slate-400">{String(index).padStart(2, '0')}.</span>
          <span className="truncate">{doc.name}</span>
        </div>
        <div className="mt-1 pl-6 flex items-center gap-2">
          <input
            type="text"
            value={issuerValue}
            onChange={(e) => setIssuerValue(e.target.value)}
            placeholder="Órgão Emissor"
            className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-slate-600 dark:text-slate-300"
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
        <select
          value={fieldKey}
          onChange={(e) => setFieldKey(e.target.value as AutoFillFieldKey)}
          className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 shrink-0"
        >
          <option value="cnpj_num">Auto: CNPJ (Só Nº)</option>
          <option value="cnpj_fmt">Auto: CNPJ (Com Pontos)</option>
          <option value="ie_num">Auto: IE SEFAZ-PI (Só Nº)</option>
          <option value="im_num">Auto: IM Prefeitura (Só Nº)</option>
          <option value="cpf_num">Auto: CPF do Sócio</option>
          <option value="nire">Auto: NIRE JUCEPI</option>
          <option value="council">Auto: Nº Conselho</option>
          <option value="email">Auto: E-mail</option>
        </select>

        <input
          type="url"
          value={urlValue}
          onChange={(e) => setUrlValue(e.target.value)}
          placeholder="Cole aqui o link de emissão (https://...)"
          className="flex-1 px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
        />

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onSaveLink(urlValue, issuerValue, fieldKey)}
            disabled={!isDirty}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              isDirty
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-default'
            }`}
          >
            Salvar
          </button>

          {urlValue && (
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onEmit}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 rounded-lg whitespace-nowrap"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Testar Emitir Auto
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper to convert File to Base64 DataURL
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
