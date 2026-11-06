import { generateSyncPreview, LocalAppData, CloudUserData } from '../firebase';
import { CompanyBasicProfile } from '../portalAdapters';
import { CertidaoDocument } from '../../types/domain';

console.log('================================================================');
console.log('SUÍTE DE TESTES: SINCRONIZAÇÃO FIREBASE, DEDUPLICAÇÃO E CONFLITOS');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`✓ [PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`✗ [FAIL] ${testName}`);
    if (details) console.error(`  Detalhes: ${details}`);
    failCount++;
  }
}

// ============================================================================
// TESTE 1: Deduplicação de Empresa por CNPJ e Resolução de Conflito por Timestamp
// ============================================================================
console.log('--- 1. Deduplicação e Resolução de Conflito em Empresas ---');

const localCompany1 = {
  id: 'comp-local-1',
  cnpj: '07.526.557/0001-00',
  companyName: 'DESINFECTA SERVICOS LTDA - NOME ATUALIZADO NOVO',
  tradeName: 'DESINFECTA',
  updatedAt: '2026-11-06T13:00:00.000Z',
} as unknown as CompanyBasicProfile;

const cloudCompany1 = {
  id: 'comp-cloud-1',
  cnpj: '07526557000100', // mesmo CNPJ sem pontuação
  companyName: 'DESINFECTA SERVICOS LTDA - NOME ANTIGO',
  tradeName: 'DESINFECTA',
  updatedAt: '2026-11-06T10:00:00.000Z', // mais antigo
} as unknown as CompanyBasicProfile;

const localDataSample: LocalAppData = {
  companies: [localCompany1],
  documents: [],
  history: [],
};

const cloudDataSample: CloudUserData = {
  companies: [cloudCompany1],
  documents: [],
  history: [],
};

const preview1 = generateSyncPreview(localDataSample, cloudDataSample);

assert(preview1.companiesMerged.length === 1, 'Deduplicou empresas com mesmo CNPJ (resultado tem exatamente 1 registro)');
assert(preview1.companiesToUpload.length === 1, 'Versão local mais recente foi agendada para upload na nuvem');
assert(preview1.companiesMerged[0].companyName.includes('NOME ATUALIZADO NOVO'), 'Versão mais recente prevaleceu na mesclagem');
assert(preview1.conflicts.length === 1, 'Registrou 1 item no relatório de conflitos');
assert(preview1.conflicts[0].winner === 'local', 'Conflito marcou local como vencedor pela data mais recente');

// ============================================================================
// TESTE 2: Nuvem com Versão Mais Recente (Dados Antigos Locais Não Sobrescrevem)
// ============================================================================
console.log('\n--- 2. Nuvem Mais Recente Não é Sobrescrita por Dado Local Antigo ---');

const localOldCompany = {
  id: 'comp-2',
  cnpj: '12.345.678/0001-90',
  companyName: 'EMPRESA VERSAO LOCAL ANTIGA',
  updatedAt: '2026-11-01T10:00:00.000Z',
} as unknown as CompanyBasicProfile;

const cloudNewCompany = {
  id: 'comp-2',
  cnpj: '12.345.678/0001-90',
  companyName: 'EMPRESA VERSAO NUVEM RECENTE',
  updatedAt: '2026-11-06T12:00:00.000Z',
} as unknown as CompanyBasicProfile;

const preview2 = generateSyncPreview(
  { companies: [localOldCompany], documents: [], history: [] },
  { companies: [cloudNewCompany], documents: [], history: [] }
);

assert(preview2.companiesToUpload.length === 0, 'Dado local antigo NÃO foi enviado para sobrescrever a nuvem');
assert(preview2.companiesToDownload.length === 1, 'Dado mais recente da nuvem foi agendado para atualizar o navegador');
assert(preview2.companiesMerged[0].companyName === 'EMPRESA VERSAO NUVEM RECENTE', 'Nome mais recente da nuvem preservado');
assert(preview2.conflicts[0].winner === 'cloud', 'Conflito marcou a nuvem como vencedora');

// ============================================================================
// TESTE 3: Certidões e Isolamento de Arquivos Binários (PDFs no IndexedDB)
// ============================================================================
console.log('\n--- 3. Certidões e Isolamento de Arquivos Binários ---');

const localDocWithBinary: CertidaoDocument = {
  id: 'doc-1',
  companyId: 'comp-local-1',
  templateKey: 'federal_conjunta',
  name: 'Certidão Negativa Federal',
  category: 'Fiscais e Trabalhistas',
  issuer: 'Receita Federal',
  emitterUrl: 'https://receita.gov.br',
  registrationCode: 'CNPJ',
  issueDate: '2026-11-01',
  validityDays: 180,
  expirationDate: '2027-04-30',
  isPermanent: false,
  notes: 'Emitida sem pendências',
  fileType: 'local',
  fileName: 'CND_Federal_Desinfecta.pdf',
  fileData: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp...', // DADOS BINÁRIOS
  updatedAt: '2026-11-06T12:30:00.000Z',
};

const preview3 = generateSyncPreview(
  { companies: [], documents: [localDocWithBinary], history: [] },
  { companies: [], documents: [], history: [] }
);

assert(preview3.documentsToUpload.length === 1, 'Agendou metadados da certidão para upload');
assert(preview3.documentsToUpload[0].fileData === undefined, 'Removeu fileData (dados binários de PDF NÃO trafegam para o Firestore)');
assert(preview3.documentsToUpload[0].fileName === 'CND_Federal_Desinfecta.pdf', 'Preservou metadados de nome do arquivo');
assert(preview3.documentsToUpload[0].expirationDate === '2027-04-30', 'Preservou data de validade');

// ============================================================================
// TESTE 4: Registros Exclusivos de Cada Lado (Consolidação Bidirecional)
// ============================================================================
console.log('\n--- 4. Consolidação Bidirecional sem Perdas ---');

const companyOnlyLocal = {
  id: 'only-local',
  cnpj: '11.111.111/0001-11',
  companyName: 'SOMENTE NO LOCAL LTDA',
  updatedAt: '2026-11-06T10:00:00.000Z',
} as unknown as CompanyBasicProfile;

const companyOnlyCloud = {
  id: 'only-cloud',
  cnpj: '22.222.222/0001-22',
  companyName: 'SOMENTE NA NUVEM LTDA',
  updatedAt: '2026-11-06T11:00:00.000Z',
} as unknown as CompanyBasicProfile;

const preview4 = generateSyncPreview(
  { companies: [companyOnlyLocal], documents: [], history: [] },
  { companies: [companyOnlyCloud], documents: [], history: [] }
);

assert(preview4.companiesToUpload.length === 1 && preview4.companiesToUpload[0].id === 'only-local', 'Local exclusivo agendado para envio');
assert(preview4.companiesToDownload.length === 1 && preview4.companiesToDownload[0].id === 'only-cloud', 'Nuvem exclusiva agendada para download');
assert(preview4.companiesMerged.length === 2, 'Total consolidado mantém ambas as empresas sem perdas');

console.log('\n================================================================');
console.log(`RESULTADO FINAL DOS TESTES: ${passCount} PASSOU, ${failCount} FALHOU`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
