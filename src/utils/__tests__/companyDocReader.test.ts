import {
  extractCnpjCardData,
  extractCnhData,
  findBestCPF,
  findBestCNPJ,
  buildCompanyDocFieldItems,
} from '../companyDocReader';
import { isValidCNPJ, isValidCPF } from '../validators';

console.log('================================================================');
console.log('SUÍTE DE TESTES: LEITURA INTELIGENTE CNH & CARTÃO CNPJ');
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
// TESTE 1: Cartão CNPJ com texto selecionável e dados completos
// ============================================================================
console.log('\n--- 1. Cartão CNPJ Padrão da Receita Federal ---');
const cnpjCardSample1 = `
REPÚBLICA FEDERATIVA DO BRASIL
CADASTRO NACIONAL DA PESSOA JURÍDICA
NÚMERO DE INSCRIÇÃO
07.526.557/0001-00
MATRIZ
DATA DE ABERTURA
15/07/2005
NOME EMPRESARIAL
DESINFECTA SERVICOS LTDA
TÍTULO DO ESTABELECIMENTO (NOME DE FANTASIA)
DESINFECTA
PORTE
EPP
CÓDIGO E DESCRIÇÃO DA ATIVIDADE ECONÔMICA PRINCIPAL
81.22-2-00 - Imunização e controle de pragas urbanas
CÓDIGO E DESCRIÇÃO DAS ATIVIDADES ECONÔMICAS SECUNDÁRIAS
81.21-4-00 - Limpeza em prédios e em domicílios
81.29-0-00 - Atividades de limpeza não especificadas anteriormente
CÓDIGO E DESCRIÇÃO DA NATUREZA JURÍDICA
206-2 - Sociedade Empresária Limitada
LOGRADOURO
RUA SENADOR TEOFILO DOS SANTOS
NÚMERO
1234
COMPLEMENTO
SALA 02
CEP
64.000-000
BAIRRO/DISTRITO
CENTRO
MUNICÍPIO
TERESINA
UF
PI
ENDEREÇO ELETRÔNICO
CONTATO@DESINFECTA.COM.BR
TELEFONE
(86) 3221-4500
SITUAÇÃO CADASTRAL
ATIVA
DATA DA SITUAÇÃO CADASTRAL
03/11/2005
MOTIVO DE SITUAÇÃO CADASTRAL
SEM MOTIVO
ENTE FEDERATIVO RESPONSÁVEL (EFR)
MUNICIPIO DE TERESINA - PI
Emitido no dia 05/01/2026 às 10:15:00
`;

const cnpjResult1 = extractCnpjCardData(cnpjCardSample1);
assert(cnpjResult1.detected, 'Identificou documento como Cartão CNPJ');
assert(cnpjResult1.fields.cnpj === '07.526.557/0001-00', 'Extraiu CNPJ formatado');
assert(isValidCNPJ(cnpjResult1.fields.cnpj), 'CNPJ extraído é matematicamente válido');
assert(cnpjResult1.fields.companyName === 'DESINFECTA SERVICOS LTDA', 'Extraiu Razão Social');
assert(cnpjResult1.fields.tradeName === 'DESINFECTA', 'Extraiu Nome Fantasia corretamente');
assert(cnpjResult1.fields.openingDate === '2005-07-15', 'Extraiu Data de Abertura correta');
assert(cnpjResult1.fields.openingDate !== '2026-01-05', 'Não confundiu com data de emissão do comprovante');
assert(cnpjResult1.fields.cadastralSituation === 'ATIVA', 'Extraiu Situação Cadastral ATIVA');
assert(cnpjResult1.fields.cadastralSituationDate === '2005-11-03', 'Extraiu Data da Situação Cadastral');
assert(cnpjResult1.fields.companySize === 'EPP', 'Extraiu Porte EPP');
assert(cnpjResult1.fields.legalNature === '206-2 - Sociedade Empresária Limitada', 'Extraiu Natureza Jurídica');
assert(cnpjResult1.fields.cnaeMain === '81.22-2-00 - Imunização e controle de pragas urbanas', 'Extraiu CNAE Principal');
assert(cnpjResult1.secondaryCnaes.length === 2, 'Extraiu 2 CNAEs Secundários');
assert(
  cnpjResult1.fields.address === 'RUA SENADOR TEOFILO DOS SANTOS, 1234, SALA 02',
  'Extraiu Endereço composto',
  `Esperado 'RUA SENADOR TEOFILO DOS SANTOS, 1234, SALA 02', obtido: '${cnpjResult1.fields.address}'`
);
assert(cnpjResult1.fields.cep === '64000-000', 'Extraiu CEP formatado');
assert(cnpjResult1.fields.cityState === 'TERESINA - PI', 'Extraiu Município e UF');
assert(cnpjResult1.fields.email === 'contato@desinfecta.com.br', 'Extraiu E-mail oficial');
assert(cnpjResult1.fields.phone === '(86) 3221-4500', 'Extraiu Telefone com DDD');
assert(cnpjResult1.fields.responsibleFederativeEntity === 'MUNICIPIO DE TERESINA - PI', 'Extraiu Ente Federativo Responsável');

// ============================================================================
// TESTE 2: Cartão CNPJ com Nome Fantasia Ausente (*****)
// ============================================================================
console.log('\n--- 2. Cartão CNPJ com Nome Fantasia Ausente (*****) ---');
const cnpjCardSample2 = `
REPÚBLICA FEDERATIVA DO BRASIL
CADASTRO NACIONAL DA PESSOA JURÍDICA
NÚMERO DE INSCRIÇÃO
07.526.557/0001-00
DATA DE ABERTURA
15/07/2005
NOME EMPRESARIAL
DESINFECTA SERVICOS LTDA
TÍTULO DO ESTABELECIMENTO (NOME DE FANTASIA)
*****
PORTE
ME
CÓDIGO E DESCRIÇÃO DA ATIVIDADE ECONÔMICA PRINCIPAL
81.22-2-00 - Imunização e controle de pragas urbanas
`;

const cnpjResult2 = extractCnpjCardData(cnpjCardSample2);
assert(cnpjResult2.fields.tradeName === '', 'Não gravou ***** como nome fantasia quando ausente');
assert(cnpjResult2.fields.companyName === 'DESINFECTA SERVICOS LTDA', 'Razão social mantida intacta');

// ============================================================================
// TESTE 3: CNH Digital / Física com datas distintas e números distintos
// ============================================================================
console.log('\n--- 3. CNH Digital com Quatro Datas Distintas e Três Números Distintos ---');
const cnhSample = `
REPÚBLICA FEDERATIVA DO BRASIL
MINISTÉRIO DA INFRAESTRUTURA
SECRETARIA NACIONAL DE TRÂNSITO - SENATRAN
CARTEIRA NACIONAL DE HABILITAÇÃO
1. NOME COMPLETO
FABIO HENRIQUE DOS SANTOS
2. DOC. IDENTIDADE / ÓRG. EMISSOR / UF
1234567 SSP PI
3. CPF
012.345.678-90
4. DATA NASCIMENTO
15/08/1985
FILIAÇÃO
MARIA APARECIDA DOS SANTOS
JOSE DOS SANTOS
5. CAT. HAB.
AB
6. Nº REGISTRO
04567891234
7. VALIDADE
15/08/2030
8. 1ª HABILITAÇÃO
20/09/2005
LOCAL
TERESINA, PI
9. DATA EMISSÃO
15/08/2020
`;

// Usamos um CPF que passa no algoritmo oficial
// Ex: 111.444.777-35 é um CPF válido para testes
const cnhWithValidCpf = cnhSample.replace('012.345.678-90', '111.444.777-35');
const cnhResult = extractCnhData(cnhWithValidCpf);

assert(cnhResult.detected, 'Identificou documento como CNH');
assert(cnhResult.fields.partnerName === 'FABIO HENRIQUE DOS SANTOS', 'Extraiu Nome Completo do Titular');
assert(!cnhResult.fields.partnerName?.includes('MARIA'), 'Não confundiu nome do titular com mãe');
assert(!cnhResult.fields.partnerName?.includes('JOSE'), 'Não confundiu nome do titular com pai');
assert(cnhResult.fields.partnerCpf === '111.444.777-35', 'Extraiu CPF do titular');
assert(isValidCPF(cnhResult.fields.partnerCpf), 'CPF do titular é matematicamente válido');
assert(cnhResult.fields.partnerCnhNumber === '04567891234', 'Extraiu Nº de Registro da CNH (11 dígitos)');
assert(cnhResult.fields.partnerCnhNumber !== cnhResult.fields.partnerCpf?.replace(/\D/g, ''), 'Distinguiu Registro da CNH de CPF');
assert(
  cnhResult.fields.partnerRg === '1234567 SSP PI',
  'Extraiu RG com Órgão Emissor e UF',
  `Esperado '1234567 SSP PI', obtido: '${cnhResult.fields.partnerRg}'`
);
assert(cnhResult.fields.partnerBirthDate === '1985-08-15', 'Extraiu Data de Nascimento');
assert(cnhResult.fields.partnerCnhFirstLicenseDate === '2005-09-20', 'Extraiu 1ª Habilitação');
assert(cnhResult.fields.partnerCnhIssueDate === '2020-08-15', 'Extraiu Data de Emissão da CNH');
assert(cnhResult.fields.partnerCnhExpirationDate === '2030-08-15', 'Extraiu Validade da CNH diretamente');
assert(cnhResult.fields.partnerBirthDate !== cnhResult.fields.partnerCnhExpirationDate, 'Não confundiu nascimento com validade');
assert(cnhResult.fields.partnerCnhFirstLicenseDate !== cnhResult.fields.partnerCnhIssueDate, 'Não confundiu 1ª habilitação com emissão');
assert(cnhResult.fields.partnerCnhCategory === 'AB', 'Extraiu Categoria de Habilitação AB');
assert(Boolean(cnhResult.fields.partnerParents?.includes('MARIA') && cnhResult.fields.partnerParents?.includes('JOSE')), 'Extraiu Filiação');

// ============================================================================
// TESTE 4: Diffs e Detecção de Divergência
// ============================================================================
console.log('\n--- 4. Construtor de Itens para Conferência Humana (Divergências) ---');
const currentCompanyMock = {
  id: 'comp-1',
  cnpj: '07.526.557/0001-00',
  companyName: 'DESINFECTA LTDA',
  partnerName: 'FRANCISCO SILVA',
  partnerCpf: '000.000.000-00',
};

const diffItems = buildCompanyDocFieldItems(
  cnhResult.fields,
  currentCompanyMock as any,
  'cnh_socio',
  cnhResult.confidences
);

const partnerCpfDiff = diffItems.find((i) => i.key === 'partnerCpf');
assert(Boolean(partnerCpfDiff), 'Item de CPF do titular presente na conferência');
assert(partnerCpfDiff?.isDivergent === true, 'Marcou divergência no CPF quando titular difere do cadastro');
assert(partnerCpfDiff?.accepted === false, 'Por segurança, CPF divergente NÃO vem pré-marcado');

console.log('\n================================================================');
console.log(`RESULTADO FINAL DOS TESTES: ${passCount} PASSOU, ${failCount} FALHOU`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
