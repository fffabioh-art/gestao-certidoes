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
  SlidersHorizontal
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type DocumentCategory =
  | 'Fiscais e Trabalhistas'
  | 'Alvarás, Licenças e Conselhos'
  | 'Societário, Contábil e Qualificação Técnica';

export type ComputedStatus = 'vigente' | 'atencao' | 'vencido' | 'permanente';

export interface CompanyProfile {
  id: string;
  companyName: string;
  cnpj: string;
  stateRegistration: string;
  municipalRegistration: string;
  cityState: string;
}

export interface CertidaoDocument {
  id: string;
  companyId: string;
  templateKey?: string; // Links same certificate type across Piauí companies
  name: string;
  category: DocumentCategory;
  issuer: string;
  emitterUrl: string;
  registrationCode: string; // CNPJ, IE, IM, Protocolo ou Ref
  issueDate: string; // YYYY-MM-DD or ''
  validityDays: number | ''; // Ex: 30, 60, 90, 180, 365
  expirationDate: string; // YYYY-MM-DD or ''
  isPermanent: boolean;
  notes: string;
  fileType: 'none' | 'local' | 'drive';
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;
  driveUrl?: string;
  updatedAt: string;
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
    cnpj: '12.345.678/0001-90',
    stateRegistration: '19.456.789-0',
    municipalRegistration: '458920-1',
    cityState: 'Teresina - PI',
  },
  {
    id: 'comp-piaui-2',
    companyName: 'Empresa 02 - Piauí (Clique em Empresas para renomear)',
    cnpj: '23.456.789/0001-11',
    stateRegistration: '19.888.111-2',
    municipalRegistration: '512300-4',
    cityState: 'Teresina - PI',
  },
  {
    id: 'comp-piaui-3',
    companyName: 'Empresa 03 - Piauí (Clique em Empresas para renomear)',
    cnpj: '34.567.890/0001-22',
    stateRegistration: '19.777.222-3',
    municipalRegistration: '619800-7',
    cityState: 'Parnaíba / Teresina - PI',
  },
];

function buildInitialDocumentsForCompany(
  company: CompanyProfile,
  useSampleDates: boolean
): CertidaoDocument[] {
  const prefix = company.id;
  const now = new Date().toISOString();

  return [
    // A. Certidões Fiscais e Trabalhistas (Com Vencimento)
    {
      id: `${prefix}-doc-01`,
      companyId: company.id,
      templateKey: 'tpl-01-cndt',
      name: 'CNDT (Certidão Negativa de Débitos Trabalhistas)',
      category: 'Fiscais e Trabalhistas',
      issuer: 'TST - Tribunal Superior do Trabalho',
      emitterUrl: 'https://cndt-certidao.tst.jus.br/',
      registrationCode: company.cnpj,
      issueDate: useSampleDates ? '2026-03-18' : '',
      validityDays: 180,
      expirationDate: useSampleDates ? '2026-09-14' : '',
      isPermanent: false,
      notes: 'Emissão gratuita online pelo portal do TST.',
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
      issueDate: useSampleDates ? '2026-01-17' : '',
      validityDays: 90,
      expirationDate: useSampleDates ? '2026-04-17' : '',
      isPermanent: false,
      notes: 'Comprovante de inscrição cadastral na Receita Federal.',
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
      issueDate: useSampleDates ? '2026-04-23' : '',
      validityDays: 180,
      expirationDate: useSampleDates ? '2026-10-20' : '',
      isPermanent: false,
      notes: 'Abrange tributos federais, previdenciários (INSS) e Dívida Ativa da União.',
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
      registrationCode: company.cnpj,
      issueDate: '',
      validityDays: 60,
      expirationDate: '',
      isPermanent: false,
      notes: 'Certidão Negativa da Dívida Ativa Estadual do Piauí (configurar data).',
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
      registrationCode: company.cnpj,
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
      registrationCode: company.cnpj,
      issueDate: useSampleDates ? '2025-08-08' : '',
      validityDays: 90,
      expirationDate: useSampleDates ? '2025-11-06' : '',
      isPermanent: false,
      notes: 'Emitida pela JUCEPI / Portal Gov.pi.',
      fileType: 'none',
      updatedAt: now,
    },

    // B. Alvarás, Licenças e Conselhos (Com Vencimento)
    {
      id: `${prefix}-doc-10`,
      companyId: company.id,
      templateKey: 'tpl-10-alvara',
      name: 'Alvará de Funcionamento',
      category: 'Alvarás, Licenças e Conselhos',
      issuer: 'Prefeitura Municipal (Teresina / PI)',
      emitterUrl: 'https://semf.pmt.pi.gov.br/',
      registrationCode: company.companyName,
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
      registrationCode: company.cnpj,
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
      registrationCode: company.cnpj,
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
      issueDate: useSampleDates ? '2026-02-01' : '',
      validityDays: 365,
      expirationDate: useSampleDates ? '2027-02-01' : '',
      isPermanent: false,
      notes: 'Destinação final ambientalmente adequada de resíduos e embalagens.',
      fileType: 'none',
      updatedAt: now,
    },

    // C. Societário, Contábil e Qualificação Técnica (Permanentes ou Anuais)
    {
      id: `${prefix}-doc-18`,
      companyId: company.id,
      templateKey: 'tpl-18-contrato-social',
      name: 'Contrato Social e Aditivo 3 Assinado',
      category: 'Societário, Contábil e Qualificação Técnica',
      issuer: 'JUCEPI - Junta Comercial do Estado do Piauí',
      emitterUrl: 'https://www.pi.gov.br/orgaos/junta-comercial-do-estado-do-piaui-jucepi/',
      registrationCode: company.cnpj,
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
      registrationCode: company.cnpj,
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

  if (days === null) {
    return {
      status: 'vencido',
      daysRemaining: null,
      label: 'Sem Data',
      countdownText: 'Configurar vencimento',
      sortWeight: -99999,
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
      label: 'A Vencer',
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
// MAIN APPLICATION COMPONENT
// ============================================================================

const STORAGE_KEY_COMPANIES = 'mago_licitacoes_companies_v2';
const STORAGE_KEY_ACTIVE_COMPANY = 'mago_licitacoes_active_comp_v2';
const STORAGE_KEY_DOCS = 'mago_licitacoes_docs_v2';
const STORAGE_KEY_WARNING_DAYS = 'mago_licitacoes_warning_days_v2';
const STORAGE_KEY_THEME = 'mago_licitacoes_theme_v1';

export default function App() {
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

  // Multi-company state (Piauí companies)
  const [companies, setCompanies] = useState<CompanyProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COMPANIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_COMPANIES;
    } catch {
      return INITIAL_COMPANIES;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_COMPANIES, JSON.stringify(companies));
  }, [companies]);

  // Selected Company Filter ('all' or specific company.id)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_COMPANY);
    return saved || INITIAL_COMPANIES[0].id;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ACTIVE_COMPANY, selectedCompanyId);
  }, [selectedCompanyId]);

  const activeCompany = useMemo(() => {
    return companies.find((c) => c.id === selectedCompanyId) || companies[0];
  }, [companies, selectedCompanyId]);

  // Warning threshold days (15, 30, 45)
  const [warningThresholdDays, setWarningThresholdDays] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_WARNING_DAYS);
    return saved ? Number(saved) || 30 : 30;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WARNING_DAYS, String(warningThresholdDays));
  }, [warningThresholdDays]);

  // Documents state
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

  // Filtering, search & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ComputedStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | DocumentCategory>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'name' | 'category' | 'expiration'>('priority');
  const [activeSection, setActiveSection] = useState<'dashboard' | 'links' | 'companies' | 'backup'>('dashboard');

  // Copy & Toast feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // Inline cell editing state (including emitterUrl!)
  const [inlineEdit, setInlineEdit] = useState<{
    docId: string;
    field: 'name' | 'issuer' | 'registrationCode' | 'emitterUrl' | 'issueDate' | 'validityDays' | 'expirationDate';
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
    newDriveUrl: string;
    newFile?: File | null;
  } | null>(null);
  const [previewModal, setPreviewModal] = useState<{
    doc: CertidaoDocument;
    dataUrl: string | null;
  } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // New Company Modal state
  const [companyModal, setCompanyModal] = useState<{
    isNew: boolean;
    profile: CompanyProfile;
    cloneStandardDocs: boolean;
  } | null>(null);

  const fileInputImportRef = useRef<HTMLInputElement | null>(null);

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

  // Executive Summary counts (for currently selected company or all)
  const summaryCounts = useMemo(() => {
    const counts = {
      total: enrichedDocuments.length,
      vigente: 0,
      atencao: 0,
      vencido: 0,
      permanente: 0,
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
        const hay = `${doc.name} ${doc.issuer} ${doc.category} ${doc.registrationCode} ${doc.notes} ${comp?.companyName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'priority') {
        const rankOrder: Record<ComputedStatus, number> = {
          vencido: 1,
          atencao: 2,
          vigente: 3,
          permanente: 4,
        };
        if (rankOrder[a.eval.status] !== rankOrder[b.eval.status]) {
          return rankOrder[a.eval.status] - rankOrder[b.eval.status];
        }
        if (a.eval.sortWeight !== b.eval.sortWeight) {
          return a.eval.sortWeight - b.eval.sortWeight;
        }
        return a.doc.name.localeCompare(b.doc.name, 'pt-BR');
      }
      if (sortBy === 'name') {
        return a.doc.name.localeCompare(b.doc.name, 'pt-BR');
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
  // HANDLERS
  // ============================================================================

  const handleCopyText = async (id: string, text: string, label: string) => {
    const valueToCopy = text || activeCompany.cnpj;
    try {
      await navigator.clipboard.writeText(valueToCopy);
      setCopiedId(id);
      showToast(`${label} copiado: ${valueToCopy}`);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 2000);
    } catch {
      showToast('Não foi possível copiar automaticamente.');
    }
  };

  // Commit inline edit with intelligent date calculation and optional link sync across all companies
  const commitInlineEdit = () => {
    if (!inlineEdit) return;
    const { docId, field, value, syncAllCompanies } = inlineEdit;
    const targetDoc = documents.find((d) => d.id === docId);

    setDocuments((prev) =>
      prev.map((d) => {
        // If editing emitterUrl and syncAllCompanies is true, update all docs with same name or templateKey
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
          if (value && updated.validityDays !== '' && Number(updated.validityDays) > 0 && !updated.isPermanent) {
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
      field === 'emitterUrl' && syncAllCompanies
        ? 'Link de emissão atualizado para todas as empresas!'
        : 'Alteração salva automaticamente.'
    );
  };

  // Update emitter link across all companies from Central de Links
  const handleUpdatePortalLinkEverywhere = (doc: CertidaoDocument, newUrl: string, newIssuer?: string) => {
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
          updatedAt: new Date().toISOString(),
        };
      })
    );
    showToast(`Link de "${doc.name}" salvo para todas as empresas!`);
  };

  // Open 1-Click Renewal Modal
  const openQuickRenew = (doc: CertidaoDocument) => {
    const today = getTodayDateString();
    const defaultValidity = doc.validityDays !== '' && Number(doc.validityDays) > 0 ? Number(doc.validityDays) : 90;
    const nextExp = addDaysToDateString(today, defaultValidity);
    setRenewingDoc({
      doc,
      newIssueDate: today,
      newValidityDays: defaultValidity,
      newExpirationDate: nextExp,
      newDriveUrl: doc.driveUrl || '',
      newFile: null,
    });
  };

  const confirmQuickRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingDoc) return;
    const { doc, newIssueDate, newValidityDays, newExpirationDate, newDriveUrl, newFile } = renewingDoc;

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

    setDocuments((prev) =>
      prev.map((item) =>
        item.id === doc.id
          ? {
              ...item,
              isPermanent: false,
              issueDate: newIssueDate,
              validityDays: newValidityDays,
              expirationDate: newExpirationDate,
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
    showToast(`Certidão "${doc.name}" renovada até ${formatDateBR(newExpirationDate)}!`);
  };

  // Open Full Create / Edit Document Modal
  const openCreateModal = () => {
    const today = getTodayDateString();
    const targetCompany = selectedCompanyId === 'all' ? companies[0] : activeCompany;
    setIsNewDocModal(true);
    setEditingDoc({
      id: `doc-${Date.now()}`,
      companyId: targetCompany.id,
      name: '',
      category: 'Fiscais e Trabalhistas',
      issuer: '',
      emitterUrl: '',
      registrationCode: targetCompany.cnpj,
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

  // Direct file upload from list row or modal
  const handleAttachFileToDoc = async (docId: string, file: File) => {
    try {
      const dataUrl = await readFileAsDataURL(file);
      await saveAttachmentData(docId, dataUrl);
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? {
                ...d,
                fileType: 'local',
                fileName: file.name,
                fileMimeType: file.type || 'application/pdf',
                fileSize: file.size,
                updatedAt: new Date().toISOString(),
              }
            : d
        )
      );
      if (editingDoc && editingDoc.id === docId) {
        setEditingDoc((prev) =>
          prev
            ? {
                ...prev,
                fileType: 'local',
                fileName: file.name,
                fileMimeType: file.type || 'application/pdf',
                fileSize: file.size,
              }
            : null
        );
      }
      showToast(`Arquivo "${file.name}" anexado com sucesso!`);
    } catch {
      showToast('Erro ao salvar o arquivo anexo no navegador.');
    }
  };

  // View PDF / Attachment
  const handleViewAttachment = async (doc: CertidaoDocument) => {
    if (doc.fileType === 'drive' && doc.driveUrl) {
      setPreviewModal({ doc, dataUrl: null });
      return;
    }
    if (doc.fileType === 'local') {
      const dataUrl = await getAttachmentData(doc.id);
      setPreviewModal({ doc, dataUrl });
      return;
    }
    openEditModal(doc);
  };

  // Download PDF / Attachment
  const handleDownloadAttachment = async (doc: CertidaoDocument) => {
    if (doc.fileType === 'local') {
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
    } else if (doc.fileType === 'drive' && doc.driveUrl) {
      setPreviewModal({ doc, dataUrl: null });
    }
  };

  // Delete Document
  const confirmDeleteDocument = async () => {
    if (!deleteConfirmId) return;
    await deleteAttachmentData(deleteConfirmId);
    setDocuments((prev) => prev.filter((d) => d.id !== deleteConfirmId));
    setDeleteConfirmId(null);
    showToast('Documento removido.');
  };

  // Save or Create Company (with automatic 23 Piauí certificates generation)
  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyModal) return;
    const { isNew, profile, cloneStandardDocs } = companyModal;
    if (!profile.companyName.trim()) return;

    if (isNew) {
      setCompanies((prev) => [...prev, profile]);
      if (cloneStandardDocs) {
        const newDocs = buildInitialDocumentsForCompany(profile, false).map((nd) => {
          // Inherit any customized emitterUrl that the user already edited in existing docs!
          const existingWithSameKey = documents.find(
            (ed) => ed.templateKey && ed.templateKey === nd.templateKey && ed.emitterUrl
          );
          return existingWithSameKey
            ? { ...nd, emitterUrl: existingWithSameKey.emitterUrl, issuer: existingWithSameKey.issuer }
            : nd;
        });
        setDocuments((prev) => [...prev, ...newDocs]);
      }
      setSelectedCompanyId(profile.id);
      showToast(`Empresa "${profile.companyName}" criada e selecionada!`);
    } else {
      setCompanies((prev) => prev.map((c) => (c.id === profile.id ? profile : c)));
      showToast(`Dados da empresa "${profile.companyName}" atualizados!`);
    }
    setCompanyModal(null);
  };

  // Delete Company
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

  // Export Backup JSON
  const handleExportJSON = async () => {
    const attachments = await getAllAttachmentsMap();
    const payload = {
      app: 'Mago das Licitações - Multi-Empresas Piauí',
      exportedAt: new Date().toISOString(),
      warningThresholdDays,
      companies,
      documents,
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
    showToast('Backup completo JSON exportado com sucesso!');
  };

  // Export CSV / Excel
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
      'CNPJ / Inscrição Vinculada',
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
      doc.isPermanent ? 'Indeterminado' : doc.expirationDate ? formatDateBR(doc.expirationDate) : '',
      doc.registrationCode,
      doc.emitterUrl,
      doc.fileType === 'local' ? doc.fileName || 'PDF Local' : doc.fileType === 'drive' ? doc.driveUrl || '' : 'Sem anexo',
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

  // Import Backup JSON
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

  // Restore Initial Data
  const handleResetToInitialData = () => {
    setCompanies(INITIAL_COMPANIES);
    setSelectedCompanyId(INITIAL_COMPANIES[0].id);
    setDocuments(buildAllInitialDocuments());
    setResetConfirmOpen(false);
    showToast('Dados padrão do Piauí restaurados.');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-150">
      {/* ====================================================================
          TOP BAR CONTRACT: 3 Zones separated by gap-8
      ==================================================================== */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <a
          href="#lista"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('dashboard');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          Mago das Licitações
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
          <button
            type="button"
            onClick={() => setActiveSection('dashboard')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeSection === 'dashboard'
                ? 'border-blue-600 text-slate-900 dark:text-white dark:border-blue-400'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Lista de Certidões
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('links')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeSection === 'links'
                ? 'border-blue-600 text-slate-900 dark:text-white dark:border-blue-400'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Gerenciar Links (PI)
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('companies')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeSection === 'companies'
                ? 'border-blue-600 text-slate-900 dark:text-white dark:border-blue-400'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Empresas ({companies.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('backup')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeSection === 'backup'
                ? 'border-blue-600 text-slate-900 dark:text-white dark:border-blue-400'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Backup e Planilha
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Certidão
          </button>
        </div>
      </header>

      {/* ====================================================================
          BARRA DE SELEÇÃO DE EMPRESA (PIAUÍ) + COPIAR CNPJ + CONTROLES
      ==================================================================== */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/70">
        <div className="max-w-[1440px] mx-auto px-6 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Company Filter Selector + Quick Copy */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Empresa:</span>
            </div>

            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName} — CNPJ: {c.cnpj}
                </option>
              ))}
              <option value="all">📋 Ver Todas as Empresas Juntas ({companies.length})</option>
            </select>

            {selectedCompanyId !== 'all' && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText('bar-cnpj', activeCompany.cnpj, `CNPJ (${activeCompany.companyName})`)
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono tabular-nums font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/80 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="Copiar CNPJ da empresa selecionada"
                >
                  {copiedId === 'bar-cnpj' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedId === 'bar-cnpj' ? 'CNPJ Copiado!' : `Copiar CNPJ: ${activeCompany.cnpj}`}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setCompanyModal({
                      isNew: false,
                      profile: { ...activeCompany },
                      cloneStandardDocs: false,
                    })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                  title="Editar nome, CNPJ ou inscrições desta empresa"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Editar Empresa
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() =>
                setCompanyModal({
                  isNew: true,
                  profile: {
                    id: `comp-${Date.now()}`,
                    companyName: '',
                    cnpj: '',
                    stateRegistration: '',
                    municipalRegistration: '',
                    cityState: 'Teresina - PI',
                  },
                  cloneStandardDocs: true,
                })
              }
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 rounded-lg hover:bg-emerald-100 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              + Cadastrar Empresa (PI)
            </button>
          </div>

          {/* Right: Quick Nav (mobile) + Alert Threshold + Theme Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex md:hidden items-center gap-1 bg-slate-200/80 dark:bg-slate-800 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveSection('dashboard')}
                className={`px-2 py-1 text-xs font-medium rounded ${
                  activeSection === 'dashboard' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white' : ''
                }`}
              >
                Lista
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('links')}
                className={`px-2 py-1 text-xs font-medium rounded ${
                  activeSection === 'links' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white' : ''
                }`}
              >
                Links
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('companies')}
                className={`px-2 py-1 text-xs font-medium rounded ${
                  activeSection === 'companies' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white' : ''
                }`}
              >
                Empresas
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('backup')}
                className={`px-2 py-1 text-xs font-medium rounded ${
                  activeSection === 'backup' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white' : ''
                }`}
              >
                Backup
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Alerta:</span>
              <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-md">
                {[15, 30, 45].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => {
                      setWarningThresholdDays(days);
                      showToast(`Alerta amarelo ajustado para ${days} dias.`);
                    }}
                    className={`px-2 py-0.5 text-xs font-mono tabular-nums rounded cursor-pointer ${
                      warningThresholdDays === days
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {days}d
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveSection('links')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap shrink-0"
              title="Conferir ou editar todos os links de emissão"
            >
              <Link2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Editar Todos os Links</span>
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap shrink-0"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
            </button>
          </div>
        </div>
      </div>

      {/* ====================================================================
          MAIN VIEWPORT
      ==================================================================== */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-5 space-y-5">
        {/* RESUMO EXECUTIVO COMPACTO (Clicável para Filtrar) */}
        <section aria-label="Resumo de Status">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setActiveSection('dashboard');
              }}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                statusFilter === 'all'
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
              className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${
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
              className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                statusFilter === 'atencao'
                  ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-600 dark:border-amber-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-500/50'
              }`}
            >
              <div>
                <div className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  A Vencer (1-{warningThresholdDays}d)
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
              className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                statusFilter === 'vencido'
                  ? 'bg-red-50/80 dark:bg-red-950/30 border-red-600 dark:border-red-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-red-500/50'
              }`}
            >
              <div>
                <div className="text-xs font-medium text-red-700 dark:text-red-400">
                  Vencidos / Sem Data
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
                setStatusFilter(statusFilter === 'permanente' ? 'all' : 'permanente');
                setActiveSection('dashboard');
              }}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all cursor-pointer col-span-2 sm:col-span-1 ${
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
            VIEW 1: LISTA COMPACTA E DIRETA DE CERTIDÕES
        ==================================================================== */}
        {activeSection === 'dashboard' && (
          <section className="space-y-3">
            {/* Barra de Busca e Filtro Rápido */}
            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar lista por nome da certidão, SEFAZ-PI, JUCEPI, TJPI, Prefeitura, CNPJ..."
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
                    onClick={() => setCategoryFilter('Societário, Contábil e Qualificação Técnica')}
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

            {/* ================================================================
                LISTA EM LINHAS COMPACTAS (List View)
            ================================================================ */}
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
                  const isEditingThisUrl =
                    inlineEdit?.docId === doc.id && inlineEdit.field === 'emitterUrl';

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

                          {/* Status Badge Icon + Countdown */}
                          <div className="w-[130px] shrink-0 flex items-center gap-1.5">
                            {isVencido && (
                              <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                            )}
                            {isAtencao && (
                              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            )}
                            {isVigente && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            )}
                            {ev.status === 'permanente' && (
                              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                            )}
                            <div className="leading-tight">
                              <div
                                className={`text-xs font-bold ${
                                  isVencido
                                    ? 'text-red-700 dark:text-red-400'
                                    : isAtencao
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : isVigente
                                    ? 'text-emerald-700 dark:text-emerald-400'
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

                          {/* Nome da Certidão & Metadados em Linha */}
                          <div className="min-w-0 flex-1">
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
                              <div className="flex flex-wrap items-baseline gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setInlineEdit({ docId: doc.id, field: 'name', value: doc.name })
                                  }
                                  className="text-left text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                                  title="Clique para editar o nome da certidão"
                                >
                                  {doc.name}
                                </button>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {selectedCompanyId === 'all' && docCompany && (
                                <>
                                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                                    {docCompany.companyName}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setInlineEdit({
                                    docId: doc.id,
                                    field: 'issuer',
                                    value: doc.issuer,
                                  })
                                }
                                className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                title="Clique para editar o órgão emissor"
                              >
                                {doc.issuer || 'Definir órgão'}
                              </button>
                              <span aria-hidden="true">·</span>
                              <span>{doc.category}</span>
                              {doc.notes && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-slate-400 dark:text-slate-500 truncate max-w-xs" title={doc.notes}>
                                    {doc.notes}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* COLUNA 2: Datas em Linha + Botões de Portal/Editar Link + PDF + Renovar */}
                        <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2 sm:gap-3 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100 dark:border-slate-800/70">
                          {/* Bloco de Datas Compacto (Emissão | Prazo | Vencimento) */}
                          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950/90 px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs">
                            {/* Emissão */}
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
                                  title="Clique para editar Data de Emissão"
                                >
                                  {doc.issueDate ? formatDateBR(doc.issueDate) : 'Definir'}
                                </button>
                              )}
                            </div>

                            <span className="text-slate-300 dark:text-slate-700">/</span>

                            {/* Prazo */}
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
                                  title="Clique para alterar o prazo em dias"
                                >
                                  {doc.validityDays ? `${doc.validityDays}d` : '—'}
                                </button>
                              )}
                            </div>

                            <span className="text-slate-300 dark:text-slate-700">/</span>

                            {/* Vencimento */}
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
                                  title="Clique para editar Data de Vencimento"
                                >
                                  {doc.expirationDate
                                    ? formatDateBR(doc.expirationDate)
                                    : 'Configurar'}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Bloco Site Emissor + Editar Link Rápido + Copiar CNPJ */}
                          <div className="flex items-center gap-1">
                            {doc.emitterUrl ? (
                              <a
                                href={doc.emitterUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/70 rounded-lg transition-colors whitespace-nowrap shrink-0"
                                title={`Abrir site emissor: ${doc.emitterUrl}`}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Emitir
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
                                  : 'text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                              }`}
                              title="Editar link do site emissor diretamente na lista"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleCopyText(
                                  doc.id,
                                  doc.registrationCode || docCompany?.cnpj || activeCompany.cnpj,
                                  'CNPJ'
                                )
                              }
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                              title={`Copiar CNPJ/Inscrição: ${
                                doc.registrationCode || docCompany?.cnpj || activeCompany.cnpj
                              }`}
                            >
                              {copiedId === doc.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span className="hidden sm:inline">
                                {copiedId === doc.id ? 'Copiado' : 'CNPJ'}
                              </span>
                            </button>
                          </div>

                          {/* Bloco PDF (Ver / Baixar / Anexar) */}
                          <div className="flex items-center gap-1">
                            {doc.fileType !== 'none' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleViewAttachment(doc)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                                  title="Visualizar PDF/Anexo"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  PDF
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
                              </>
                            ) : (
                              <label className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap shrink-0">
                                <Upload className="w-3.5 h-3.5" />
                                PDF
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

                          {/* Ações: Renovar + Editar + Excluir */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openQuickRenew(doc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                              title="Renovar certidão em 1 clique"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Renovar
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(doc)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                              title="Abrir edição completa"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(doc.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                              title="Excluir certidão"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* BARRA EXPANSÍVEL INLINE PARA EDITAR O LINK DO SITE EMISSOR NA HORA */}
                      {isEditingThisUrl && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-2 bg-blue-50/40 dark:bg-blue-950/20 p-2.5 rounded-lg">
                          <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 whitespace-nowrap">
                            Link para Emissão:
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
                            placeholder="Cole aqui o link correto do site emissor (https://...)"
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
                              className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer"
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
          </section>
        )}

        {/* ====================================================================
            VIEW 2: GERENCIAR TODOS OS LINKS DE EMISSÃO (LISTA RÁPIDA DE LINKS)
        ==================================================================== */}
        {activeSection === 'links' && (
          <section className="space-y-4">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Lista Geral de Links para Emissão de Certidões (Piauí e Federal)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Cole ou altere qualquer link abaixo. Ao alterar um link aqui, ele é atualizado automaticamente para todas as suas empresas do Piauí.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('dashboard')}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                Voltar para Lista de Certidões
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
              {enrichedDocuments.map(({ doc }, idx) => (
                <PortalLinkRowEditor
                  key={doc.id}
                  index={idx + 1}
                  doc={doc}
                  cnpjToCopy={activeCompany.cnpj}
                  onCopy={() =>
                    handleCopyText(`link-tab-${doc.id}`, activeCompany.cnpj, 'CNPJ')
                  }
                  isCopied={copiedId === `link-tab-${doc.id}`}
                  onSaveLink={(newUrl, newIssuer) =>
                    handleUpdatePortalLinkEverywhere(doc, newUrl, newIssuer)
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* ====================================================================
            VIEW 3: GERENCIAR EMPRESAS DO PIAUÍ
        ==================================================================== */}
        {activeSection === 'companies' && (
          <section className="space-y-4">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Empresas Cadastradas (Piauí)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Selecione qual empresa deseja gerenciar no painel ou cadastre novas empresas já com as 23 certidões padrão pré-configuradas.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setCompanyModal({
                    isNew: true,
                    profile: {
                      id: `comp-${Date.now()}`,
                      companyName: '',
                      cnpj: '',
                      stateRegistration: '',
                      municipalRegistration: '',
                      cityState: 'Teresina - PI',
                    },
                    cloneStandardDocs: true,
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Nova Empresa
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
              {companies.map((comp) => {
                const compDocs = documents.filter((d) => d.companyId === comp.id);
                const isSelected = selectedCompanyId === comp.id;
                return (
                  <div
                    key={comp.id}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {comp.companyName}
                        </span>
                        {isSelected && (
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                            · Empresa Ativa no Filtro
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        <span>CNPJ: {comp.cnpj || 'Não informado'}</span>
                        <span>·</span>
                        <span>IE (SEFAZ-PI): {comp.stateRegistration || '—'}</span>
                        <span>·</span>
                        <span>IM: {comp.municipalRegistration || '—'}</span>
                        <span>·</span>
                        <span>{comp.cityState}</span>
                        <span>·</span>
                        <span>{compDocs.length} certidões</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCompanyId(comp.id);
                          setActiveSection('dashboard');
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                      >
                        Abrir Certidões
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCompanyModal({
                            isNew: false,
                            profile: { ...comp },
                            cloneStandardDocs: false,
                          })
                        }
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg cursor-pointer"
                      >
                        Editar Dados
                      </button>
                      {companies.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCompany(comp.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                          title="Excluir empresa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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
                    Salva todas as empresas do Piauí, certidões, links customizados e PDFs anexados em arquivo único.
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
          MODAL: CRIAR OU EDITAR EMPRESA DO PIAUÍ
      ==================================================================== */}
      {companyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {companyModal.isNew ? 'Cadastrar Nova Empresa (Piauí)' : 'Editar Dados da Empresa'}
              </h3>
              <button
                type="button"
                onClick={() => setCompanyModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Razão Social / Nome Fantasia *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Limpadora Piauí Serviços Ltda"
                  value={companyModal.profile.companyName}
                  onChange={(e) =>
                    setCompanyModal({
                      ...companyModal,
                      profile: { ...companyModal.profile, companyName: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    CNPJ *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="00.000.000/0001-00"
                    value={companyModal.profile.cnpj}
                    onChange={(e) =>
                      setCompanyModal({
                        ...companyModal,
                        profile: { ...companyModal.profile, cnpj: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Município / UF
                  </label>
                  <input
                    type="text"
                    placeholder="Teresina - PI"
                    value={companyModal.profile.cityState}
                    onChange={(e) =>
                      setCompanyModal({
                        ...companyModal,
                        profile: { ...companyModal.profile, cityState: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Inscrição Estadual (SEFAZ-PI)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 19.000.000-0"
                    value={companyModal.profile.stateRegistration}
                    onChange={(e) =>
                      setCompanyModal({
                        ...companyModal,
                        profile: { ...companyModal.profile, stateRegistration: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Inscrição Municipal (Prefeitura)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 458920-1"
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
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
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
                    Criar automaticamente a lista padrão das <strong>23 certidões do Piauí</strong> para esta empresa (já aproveitando seus links salvos).
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
          MODAL: 1-CLICK QUICK RENEWAL ("🔄 Renovar Certidão")
      ==================================================================== */}
      {renewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Renovar Certidão em 1 Clique
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

              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Anexar PDF / Imagem da Nova Certidão (Opcional)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) =>
                      setRenewingDoc({
                        ...renewingDoc,
                        newFile: e.target.files?.[0] || null,
                      })
                    }
                    className="w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-950 dark:file:text-blue-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ou Link no Google Drive / Nuvem (Opcional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/..."
                    value={renewingDoc.newDriveUrl}
                    onChange={(e) =>
                      setRenewingDoc({ ...renewingDoc, newDriveUrl: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
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
                {isNewDocModal ? 'Cadastrar Nova Certidão / Licença' : 'Editar Certidão / Link / Datas'}
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

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nome da Certidão / Licença / Documento *
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
                    placeholder="Ex: SEFAZ-PI, TJPI, JUCEPI, Receita Federal"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    CNPJ / Inscrição / Referência
                  </label>
                  <input
                    type="text"
                    value={editingDoc.registrationCode}
                    onChange={(e) =>
                      setEditingDoc({ ...editingDoc, registrationCode: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
                    Link do Site Emissor (URL para Emissão da Certidão)
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

              {/* Attachment & Cloud Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Upload de Arquivo (PDF ou Imagem)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleAttachFileToDoc(editingDoc.id, f);
                    }}
                    className="w-full text-xs text-slate-600 dark:text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-950 dark:file:text-blue-300"
                  />
                  {editingDoc.fileName && (
                    <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                      Anexo atual: {editingDoc.fileName}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ou Link no Google Drive / Nuvem
                  </label>
                  <input
                    type="url"
                    value={editingDoc.driveUrl || ''}
                    onChange={(e) =>
                      setEditingDoc({
                        ...editingDoc,
                        driveUrl: e.target.value,
                        fileType: e.target.value.trim()
                          ? 'drive'
                          : editingDoc.fileName
                          ? 'local'
                          : 'none',
                      })
                    }
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Observações
                </label>
                <textarea
                  rows={2}
                  value={editingDoc.notes}
                  onChange={(e) => setEditingDoc({ ...editingDoc, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                />
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
                {previewModal.doc.driveUrl && (
                  <a
                    href={previewModal.doc.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir no Drive
                  </a>
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
              ) : previewModal.doc.driveUrl ? (
                <div className="text-center space-y-4 max-w-md p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <ExternalLink className="w-10 h-10 text-blue-600 dark:text-blue-400 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Documento Armazenado na Nuvem
                  </h4>
                  <p className="text-xs text-slate-500 break-all">{previewModal.doc.driveUrl}</p>
                  <a
                    href={previewModal.doc.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Abrir em Nova Aba
                  </a>
                </div>
              ) : (
                <div className="text-xs text-slate-500">Nenhum anexo carregado.</div>
              )}
            </div>
          </div>
        </div>
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

      {/* FLOATING TOAST */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-slate-900 dark:bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 py-4 px-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Mago das Licitações — Gestão Multi-Empresas de Certidões e Licenças (Piauí)
          </span>
          <span>Dados salvos automaticamente no navegador</span>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENT: INLINE PORTAL LINK EDITOR ROW (FOR "GERENCIAR LINKS (PI)" TAB)
// ============================================================================

function PortalLinkRowEditor({
  index,
  doc,
  cnpjToCopy,
  onCopy,
  isCopied,
  onSaveLink,
}: {
  index: number;
  doc: CertidaoDocument;
  cnpjToCopy: string;
  onCopy: () => void;
  isCopied: boolean;
  onSaveLink: (url: string, issuer: string) => void;
}) {
  const [urlValue, setUrlValue] = useState(doc.emitterUrl || '');
  const [issuerValue, setIssuerValue] = useState(doc.issuer || '');
  const isDirty = urlValue !== (doc.emitterUrl || '') || issuerValue !== (doc.issuer || '');

  useEffect(() => {
    setUrlValue(doc.emitterUrl || '');
    setIssuerValue(doc.issuer || '');
  }, [doc.emitterUrl, doc.issuer]);

  return (
    <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
      <div className="min-w-0 lg:w-1/3">
        <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="font-mono text-slate-400">{String(index).padStart(2, '0')}.</span>
          <span className="truncate">{doc.name}</span>
        </div>
        <div className="mt-1 pl-6 flex items-center gap-2">
          <input
            type="text"
            value={issuerValue}
            onChange={(e) => setIssuerValue(e.target.value)}
            placeholder="Órgão Emissor (Ex: SEFAZ-PI, TJPI)"
            className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-slate-600 dark:text-slate-300"
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
        <input
          type="url"
          value={urlValue}
          onChange={(e) => setUrlValue(e.target.value)}
          placeholder="Cole aqui o link de emissão desta certidão (https://...)"
          className="flex-1 px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
        />

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onSaveLink(urlValue, issuerValue)}
            disabled={!isDirty}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              isDirty
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-default'
            }`}
          >
            Salvar Link
          </button>

          {urlValue && (
            <a
              href={urlValue}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 rounded-lg whitespace-nowrap"
              title="Testar abertura do link em nova aba"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir Site
            </a>
          )}

          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap"
            title={`Copiar CNPJ: ${cnpjToCopy}`}
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            CNPJ
          </button>
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
