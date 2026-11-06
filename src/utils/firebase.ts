import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';
import { CompanyBasicProfile } from './portalAdapters';
import { CertidaoDocument, DocumentHistoryEntry, AppSettings } from '../types/domain';
import { onlyDigits } from './validators';

// ----------------------------------------------------------------------------
// 1. CONFIGURAÇÃO E INICIALIZAÇÃO DO FIREBASE (Plano Spark - Free)
// ----------------------------------------------------------------------------
export const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey || "AIzaSyDyUMgOtwlUEdqzE98w97KAo09R6XyA7rg",
  authDomain: firebaseConfigData.authDomain || "project-eabbdbd1-77b4-41c6-ac1.firebaseapp.com",
  projectId: firebaseConfigData.projectId || "project-eabbdbd1-77b4-41c6-ac1",
  storageBucket: firebaseConfigData.storageBucket || "project-eabbdbd1-77b4-41c6-ac1.firebasestorage.app",
  messagingSenderId: firebaseConfigData.messagingSenderId || "299853424209",
  appId: firebaseConfigData.appId || "1:299853424209:web:7b7147e4a998f9e1fa3a70",
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// ----------------------------------------------------------------------------
// 2. TRATAMENTO PADRÃO DE ERROS DO FIRESTORE (Skill Guideline)
// ----------------------------------------------------------------------------
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      providerInfo: auth.currentUser?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ----------------------------------------------------------------------------
// 3. MÉTODOS DE AUTENTICAÇÃO COM GOOGLE
// ----------------------------------------------------------------------------
export async function signInWithGoogle(): Promise<{ user: User | null; error: string | null }> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (err: any) {
    console.error('Erro ao realizar login com Google:', err);
    let msg = 'Falha ao autenticar com Google. Tente novamente.';
    if (err.code === 'auth/popup-closed-by-user') {
      msg = 'O pop-up de login foi fechado antes de concluir a autenticação.';
    } else if (err.code === 'auth/popup-blocked') {
      msg = 'O pop-up de login foi bloqueado pelo navegador. Permita pop-ups para este site.';
    } else if (err.code === 'auth/unauthorized-domain') {
      msg = `Domínio não autorizado no Firebase Console (${window.location.hostname}). Adicione este domínio nas configurações do Firebase Authentication.`;
    }
    return { user: null, error: msg };
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    if (!auth.currentUser) return false;
    await getDocFromServer(doc(db, 'users', auth.currentUser.uid, 'settings', 'ping'));
    return true;
  } catch (e) {
    return false;
  }
}

// ----------------------------------------------------------------------------
// 4. ESTRUTURAS DE SINCRONIZAÇÃO E PREVENÇÃO DE CONFLITOS
// ----------------------------------------------------------------------------

export interface LocalAppData {
  companies: CompanyBasicProfile[];
  documents: CertidaoDocument[];
  history: DocumentHistoryEntry[];
  settings?: AppSettings | null;
  activeCompanyId?: string;
  warningThresholdDays?: number;
}

export interface CloudUserData {
  companies: CompanyBasicProfile[];
  documents: CertidaoDocument[];
  history: DocumentHistoryEntry[];
  settings?: AppSettings | null;
  activeCompanyId?: string;
  warningThresholdDays?: number;
  lastSyncedAt?: string;
}

export interface SyncConflictItem {
  id: string;
  type: 'company' | 'document' | 'settings';
  title: string;
  localUpdatedAt?: string;
  cloudUpdatedAt?: string;
  winner: 'local' | 'cloud';
  reason: string;
}

export interface SyncPreview {
  companiesToUpload: CompanyBasicProfile[];
  companiesToDownload: CompanyBasicProfile[];
  companiesMerged: CompanyBasicProfile[];

  documentsToUpload: CertidaoDocument[];
  documentsToDownload: CertidaoDocument[];
  documentsMerged: CertidaoDocument[];

  historyToUpload: DocumentHistoryEntry[];
  historyToDownload: DocumentHistoryEntry[];
  historyMerged: DocumentHistoryEntry[];

  settingsWinner: 'local' | 'cloud' | 'none';
  conflicts: SyncConflictItem[];

  totalUploadCount: number;
  totalDownloadCount: number;
  totalMergedCount: number;
}

// ----------------------------------------------------------------------------
// 5. CARREGAMENTO DOS DADOS DO CLOUD FIRESTORE (Isolados por UID)
// ----------------------------------------------------------------------------
export async function fetchCloudUserData(userId: string): Promise<CloudUserData> {
  const result: CloudUserData = {
    companies: [],
    documents: [],
    history: [],
    settings: null,
  };

  if (!userId) return result;

  try {
    // 1. Empresas
    const compCol = collection(db, 'users', userId, 'companies');
    const compSnap = await getDocs(compCol);
    result.companies = compSnap.docs.map((d) => d.data() as CompanyBasicProfile);

    // 2. Certidões (metadados)
    const docCol = collection(db, 'users', userId, 'documents');
    const docSnap = await getDocs(docCol);
    result.documents = docSnap.docs.map((d) => d.data() as CertidaoDocument);

    // 3. Histórico
    const histCol = collection(db, 'users', userId, 'history');
    const histSnap = await getDocs(histCol);
    result.history = histSnap.docs.map((d) => d.data() as DocumentHistoryEntry);

    // 4. Configurações
    const setCol = collection(db, 'users', userId, 'settings');
    const setSnap = await getDocs(setCol);
    setSnap.forEach((d) => {
      if (d.id === 'general_settings') {
        result.settings = d.data() as AppSettings;
      } else if (d.id === 'preferences') {
        const data = d.data();
        if (data.activeCompanyId) result.activeCompanyId = data.activeCompanyId;
        if (data.warningThresholdDays) result.warningThresholdDays = data.warningThresholdDays;
      }
    });

    return result;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${userId}`);
    return result;
  }
}

// ----------------------------------------------------------------------------
// 6. GERADOR DE PRÉVIA E PREVENÇÃO DE CONFLITOS (Lógica Bidirecional)
// Regra: Registros mais recentes PREVALECEM. Dados antigos NUNCA sobrescrevem novos.
// ----------------------------------------------------------------------------
export function generateSyncPreview(
  localData: LocalAppData,
  cloudData: CloudUserData
): SyncPreview {
  const conflicts: SyncConflictItem[] = [];

  // ==========================================================================
  // EMPRESAS (Deduplicação por CNPJ e por ID)
  // ==========================================================================
  const companiesToUpload: CompanyBasicProfile[] = [];
  const companiesToDownload: CompanyBasicProfile[] = [];
  const companiesMergedMap = new Map<string, CompanyBasicProfile>();

  // Indexar cloud por CNPJ limpo e por ID
  const cloudCompByCnpj = new Map<string, CompanyBasicProfile>();
  const cloudCompById = new Map<string, CompanyBasicProfile>();

  cloudData.companies.forEach((c) => {
    cloudCompById.set(c.id, c);
    const cleanCnpj = onlyDigits(c.cnpj || '');
    if (cleanCnpj) cloudCompByCnpj.set(cleanCnpj, c);
  });

  const matchedCloudCompIds = new Set<string>();

  localData.companies.forEach((loc) => {
    const cleanCnpj = onlyDigits(loc.cnpj || '');
    const cloudMatch = (cleanCnpj && cloudCompByCnpj.get(cleanCnpj)) || cloudCompById.get(loc.id);

    if (!cloudMatch) {
      // Existe apenas no local -> Enviar para nuvem
      companiesToUpload.push(loc);
      companiesMergedMap.set(loc.id, loc);
    } else {
      matchedCloudCompIds.add(cloudMatch.id);
      // Conflito / Comparação de timestamps
      const localTime = new Date(loc.updatedAt || '1970-01-01').getTime();
      const cloudTime = new Date(cloudMatch.updatedAt || '1970-01-01').getTime();

      if (localTime > cloudTime) {
        // Local é mais recente -> enviar atualização para a nuvem
        companiesToUpload.push(loc);
        companiesMergedMap.set(loc.id, loc);
        conflicts.push({
          id: loc.id,
          type: 'company',
          title: `Empresa ${loc.companyName}`,
          localUpdatedAt: loc.updatedAt,
          cloudUpdatedAt: cloudMatch.updatedAt,
          winner: 'local',
          reason: 'A versão local possui modificação mais recente e atualizará a nuvem.',
        });
      } else if (cloudTime > localTime) {
        // Nuvem é mais recente -> baixar da nuvem para o local
        companiesToDownload.push(cloudMatch);
        companiesMergedMap.set(cloudMatch.id, cloudMatch);
        conflicts.push({
          id: cloudMatch.id,
          type: 'company',
          title: `Empresa ${cloudMatch.companyName}`,
          localUpdatedAt: loc.updatedAt,
          cloudUpdatedAt: cloudMatch.updatedAt,
          winner: 'cloud',
          reason: 'A versão na nuvem possui modificação mais recente e atualizará o navegador.',
        });
      } else {
        // Iguais -> Manter qualquer uma
        companiesMergedMap.set(loc.id, loc);
      }
    }
  });

  // Empresas que existem na nuvem mas não no local
  cloudData.companies.forEach((c) => {
    if (!matchedCloudCompIds.has(c.id)) {
      companiesToDownload.push(c);
      companiesMergedMap.set(c.id, c);
    }
  });

  // ==========================================================================
  // CERTIDÕES (Deduplicação por companyId + templateKey e por ID)
  // PDFs NUNCA SÃO ENVIADOS PARA A NUVEM — APENAS METADADOS
  // ==========================================================================
  const documentsToUpload: CertidaoDocument[] = [];
  const documentsToDownload: CertidaoDocument[] = [];
  const documentsMergedMap = new Map<string, CertidaoDocument>();

  const cloudDocsByKey = new Map<string, CertidaoDocument>();
  const cloudDocsById = new Map<string, CertidaoDocument>();

  cloudData.documents.forEach((d) => {
    cloudDocsById.set(d.id, d);
    if (d.companyId && d.templateKey) {
      cloudDocsByKey.set(`${d.companyId}_${d.templateKey}`, d);
    }
  });

  const matchedCloudDocIds = new Set<string>();

  localData.documents.forEach((locDoc) => {
    // Garantir que não trafegue binário nem base64 no Firestore
    const safeDoc: CertidaoDocument = {
      ...locDoc,
      fileData: undefined, // Preservar 100% no IndexedDB
    };

    const docKey = locDoc.companyId && locDoc.templateKey ? `${locDoc.companyId}_${locDoc.templateKey}` : '';
    const cloudMatch = (docKey && cloudDocsByKey.get(docKey)) || cloudDocsById.get(locDoc.id);

    if (!cloudMatch) {
      documentsToUpload.push(safeDoc);
      documentsMergedMap.set(safeDoc.id, safeDoc);
    } else {
      matchedCloudDocIds.add(cloudMatch.id);
      const localTime = new Date(locDoc.updatedAt || '1970-01-01').getTime();
      const cloudTime = new Date(cloudMatch.updatedAt || '1970-01-01').getTime();

      if (localTime > cloudTime) {
        documentsToUpload.push(safeDoc);
        documentsMergedMap.set(safeDoc.id, safeDoc);
        conflicts.push({
          id: safeDoc.id,
          type: 'document',
          title: `Certidão: ${safeDoc.name}`,
          localUpdatedAt: locDoc.updatedAt,
          cloudUpdatedAt: cloudMatch.updatedAt,
          winner: 'local',
          reason: 'Modificações locais mais recentes prevalecem.',
        });
      } else if (cloudTime > localTime) {
        // Manter referências de arquivo local se existirem
        const mergedCloudDoc: CertidaoDocument = {
          ...cloudMatch,
          fileType: locDoc.fileType !== 'none' ? locDoc.fileType : cloudMatch.fileType,
          fileName: locDoc.fileName || cloudMatch.fileName,
          fileSize: locDoc.fileSize || cloudMatch.fileSize,
        };
        documentsToDownload.push(mergedCloudDoc);
        documentsMergedMap.set(mergedCloudDoc.id, mergedCloudDoc);
        conflicts.push({
          id: mergedCloudDoc.id,
          type: 'document',
          title: `Certidão: ${mergedCloudDoc.name}`,
          localUpdatedAt: locDoc.updatedAt,
          cloudUpdatedAt: cloudMatch.updatedAt,
          winner: 'cloud',
          reason: 'Modificações na nuvem mais recentes prevalecem.',
        });
      } else {
        documentsMergedMap.set(safeDoc.id, safeDoc);
      }
    }
  });

  cloudData.documents.forEach((d) => {
    if (!matchedCloudDocIds.has(d.id)) {
      documentsToDownload.push(d);
      documentsMergedMap.set(d.id, d);
    }
  });

  // ==========================================================================
  // HISTÓRICO DE DOCUMENTOS
  // ==========================================================================
  const historyToUpload: DocumentHistoryEntry[] = [];
  const historyToDownload: DocumentHistoryEntry[] = [];
  const historyMergedMap = new Map<string, DocumentHistoryEntry>();

  const cloudHistById = new Map<string, DocumentHistoryEntry>();
  cloudData.history.forEach((h) => cloudHistById.set(h.id, h));

  localData.history.forEach((h) => {
    if (!cloudHistById.has(h.id)) {
      historyToUpload.push(h);
    }
    historyMergedMap.set(h.id, h);
  });

  cloudData.history.forEach((h) => {
    if (!localData.history.some((lh) => lh.id === h.id)) {
      historyToDownload.push(h);
      historyMergedMap.set(h.id, h);
    }
  });

  // ==========================================================================
  // CONFIGURAÇÕES
  // ==========================================================================
  let settingsWinner: 'local' | 'cloud' | 'none' = 'none';
  if (localData.settings && !cloudData.settings) {
    settingsWinner = 'local';
  } else if (!localData.settings && cloudData.settings) {
    settingsWinner = 'cloud';
  } else if (localData.settings && cloudData.settings) {
    // Ambos existem, manter local por padrão a menos que nuvem seja mais recente
    settingsWinner = 'local';
  }

  return {
    companiesToUpload,
    companiesToDownload,
    companiesMerged: Array.from(companiesMergedMap.values()),

    documentsToUpload,
    documentsToDownload,
    documentsMerged: Array.from(documentsMergedMap.values()),

    historyToUpload,
    historyToDownload,
    historyMerged: Array.from(historyMergedMap.values()),

    settingsWinner,
    conflicts,

    totalUploadCount: companiesToUpload.length + documentsToUpload.length + historyToUpload.length,
    totalDownloadCount: companiesToDownload.length + documentsToDownload.length + historyToDownload.length,
    totalMergedCount: companiesMergedMap.size + documentsMergedMap.size,
  };
}

// ----------------------------------------------------------------------------
// 7. APLICAÇÃO DA SINCRONIZAÇÃO NO CLOUD FIRESTORE
// ----------------------------------------------------------------------------
export async function applySync(
  userId: string,
  localData: LocalAppData,
  cloudData: CloudUserData,
  preview: SyncPreview
): Promise<{
  success: boolean;
  mergedData: LocalAppData;
  error?: string;
}> {
  if (!userId) {
    return { success: false, mergedData: localData, error: 'Usuário não autenticado.' };
  }

  try {
    const batch = writeBatch(db);
    let operationCount = 0;

    // 1. Salvar Empresas no Firestore
    for (const comp of preview.companiesToUpload) {
      const ref = doc(db, 'users', userId, 'companies', comp.id);
      batch.set(ref, comp, { merge: true });
      operationCount++;
    }

    // 2. Salvar Documentos no Firestore (sem dados binários de arquivos)
    for (const d of preview.documentsToUpload) {
      const safeDoc = { ...d, fileData: null };
      const ref = doc(db, 'users', userId, 'documents', safeDoc.id);
      batch.set(ref, safeDoc, { merge: true });
      operationCount++;
    }

    // 3. Salvar Histórico no Firestore
    for (const h of preview.historyToUpload) {
      const ref = doc(db, 'users', userId, 'history', h.id);
      batch.set(ref, h, { merge: true });
      operationCount++;
    }

    // 4. Salvar Configurações no Firestore se necessário
    if (preview.settingsWinner === 'local' && localData.settings) {
      const setRef = doc(db, 'users', userId, 'settings', 'general_settings');
      batch.set(setRef, localData.settings, { merge: true });
      operationCount++;
    }

    if (localData.activeCompanyId || localData.warningThresholdDays) {
      const prefRef = doc(db, 'users', userId, 'settings', 'preferences');
      batch.set(
        prefRef,
        {
          activeCompanyId: localData.activeCompanyId || '',
          warningThresholdDays: localData.warningThresholdDays || 15,
          lastSyncedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      operationCount++;
    }

    // Commit no Firestore caso haja gravações pendentes
    if (operationCount > 0) {
      await batch.commit();
    }

    // Montar dataset local resultante para armazenamento seguro no localStorage
    const mergedData: LocalAppData = {
      companies: preview.companiesMerged,
      documents: preview.documentsMerged,
      history: preview.historyMerged,
      settings: preview.settingsWinner === 'cloud' && cloudData.settings ? cloudData.settings : localData.settings,
      activeCompanyId: localData.activeCompanyId || cloudData.activeCompanyId,
      warningThresholdDays: localData.warningThresholdDays || cloudData.warningThresholdDays,
    };

    return {
      success: true,
      mergedData,
    };
  } catch (err: any) {
    console.error('Erro ao sincronizar com Firestore:', err);
    return {
      success: false,
      mergedData: localData,
      error: err.message || 'Falha ao sincronizar dados com o Cloud Firestore.',
    };
  }
}

// ----------------------------------------------------------------------------
// 8. MONITORAMENTO DE CONEXÃO E MODO OFFLINE
// ----------------------------------------------------------------------------
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function subscribeNetworkStatus(callback: (online: boolean) => void) {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
