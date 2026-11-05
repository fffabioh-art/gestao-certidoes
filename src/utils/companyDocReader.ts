import { extractTextLocallyFromFile } from './pdfAnalyzer';
import { CompanyBasicProfile } from './portalAdapters';
import {
  onlyDigits,
  formatCNPJ,
  formatCPF,
  formatCEP,
  formatPhone,
  isValidCNPJ,
  isValidCPF,
  parseBrDateToISO,
} from './validators';

export type CompanyDocType =
  | 'cnpj'
  | 'cnh_socio'
  | 'rg_socio'
  | 'contrato_social'
  | 'ie_sefaz'
  | 'im_prefeitura'
  | 'outro';

export interface CompanyDocReadResult {
  detectedType: CompanyDocType;
  detectedTitle: string;
  extractedFields: Partial<CompanyBasicProfile>;
  populatedFieldLabels: string[];
  summary: string;
  rawTextSample: string;
}

/**
 * Normaliza quebras de linha e múltiplos espaços para busca confiável
 */
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

/**
 * Localiza com altíssima precisão qualquer CPF válido em um texto,
 * mesmo com espaçamentos incomuns do OCR, falta de pontuação ou caracteres OCR ruidosos.
 */
export function findBestCPF(text: string, excludeCnpjDigits?: string): string | null {
  if (!text) return null;

  const excludePrefix = excludeCnpjDigits ? onlyDigits(excludeCnpjDigits) : '';

  // 1. Busca por rótulos explícitos (CPF, C.P.F., CADASTRO DE PESSOAS FÍSICAS)
  // Suporta mesmo na mesma linha ou na linha seguinte
  const labeledRegex =
    /(?:(?:^|\n|[\s,;])(?:C\.?\s*P\.?\s*F\.?|CADASTRO\s+DE\s+PESSOAS?\s+F[IÍ]SICAS?)\s*[:\-º°]?\s*(?:\n\s*)?)([0-9\.\-\s]{11,20})/gi;
  let match: RegExpExecArray | null;
  while ((match = labeledRegex.exec(text)) !== null) {
    const rawCandidate = match[1];
    const digits = onlyDigits(rawCandidate).slice(0, 11);
    if (digits.length === 11 && isValidCPF(digits)) {
      if (!excludePrefix || !excludePrefix.includes(digits)) {
        return formatCPF(digits);
      }
    }
  }

  // 1.1 Trata pequenas falhas de OCR perto do rótulo CPF (ex: O em vez de 0, l/I em vez de 1)
  const ocrNoiseLabeledRegex =
    /(?:(?:^|\n|[\s,;])(?:C\.?\s*P\.?\s*F\.?)\s*[:\-º°]?\s*(?:\n\s*)?)([0-9A-Za-z\.\-\s]{11,22})/gi;
  while ((match = ocrNoiseLabeledRegex.exec(text)) !== null) {
    let candidate = match[1]
      .replace(/[Oo]/g, '0')
      .replace(/[Il|]/g, '1')
      .replace(/[B]/g, '8')
      .replace(/[S]/g, '5');
    const digits = onlyDigits(candidate).slice(0, 11);
    if (digits.length === 11 && isValidCPF(digits)) {
      if (!excludePrefix || !excludePrefix.includes(digits)) {
        return formatCPF(digits);
      }
    }
  }

  // 2. Busca por padrão clássico pontuado com flexibilidade de espaços: 000.000.000-00 ou 000 000 000 00
  const formattedRegex = /\b(\d{3}[\s\.]+\d{3}[\s\.]+\d{3}[\s\-\/]+\d{2})\b/g;
  while ((match = formattedRegex.exec(text)) !== null) {
    const digits = onlyDigits(match[1]);
    if (digits.length === 11 && isValidCPF(digits)) {
      if (!excludePrefix || !excludePrefix.includes(digits)) {
        return formatCPF(digits);
      }
    }
  }

  // 3. Busca por sequências de 11 dígitos corridos isolados
  const raw11Regex = /\b\d{11}\b/g;
  while ((match = raw11Regex.exec(text)) !== null) {
    const digits = match[0];
    if (isValidCPF(digits)) {
      if (!excludePrefix || !excludePrefix.includes(digits)) {
        return formatCPF(digits);
      }
    }
  }

  return null;
}

/**
 * Localiza CNPJ válido no texto
 */
export function findBestCNPJ(text: string): string | null {
  if (!text) return null;

  // Formatado
  const fmtMatch = text.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
  if (fmtMatch && isValidCNPJ(fmtMatch[0])) {
    return fmtMatch[0];
  }

  // Com pequenas variações de espaço ou traço
  const flexFmtMatch = text.match(/\b\d{2}[\s\.]*\d{3}[\s\.]*\d{3}[\s\/]*\d{4}[\s\-]*\d{2}\b/);
  if (flexFmtMatch) {
    const d = onlyDigits(flexFmtMatch[0]);
    if (d.length === 14 && isValidCNPJ(d)) {
      return formatCNPJ(d);
    }
  }

  // 14 dígitos corridos
  const raw14 = text.match(/\b\d{14}\b/g);
  if (raw14) {
    for (const d of raw14) {
      if (isValidCNPJ(d)) return formatCNPJ(d);
    }
  }

  return null;
}

const STOP_WORDS_NAME = [
  'REPUBLICA',
  'FEDERATIVA',
  'BRASIL',
  'MINISTERIO',
  'SECRETARIA',
  'INFRAESTRUTURA',
  'SEGURANCA',
  'PUBLICA',
  'SENATRAN',
  'DENATRAN',
  'DETRAN',
  'CARTEIRA',
  'NACIONAL',
  'HABILITACAO',
  'VALIDADE',
  'ASSINATURA',
  'PORTADOR',
  'CONDUTOR',
  'TITULAR',
  'CATEGORIA',
  'PERMISSAO',
  'DIRIGIR',
  'IDENTIDADE',
  'FILIACAO',
  'NASCIMENTO',
  'LOCAL',
  'REGISTRO',
  'NUMERO',
  'OBSERVACOES',
  'DEPARTAMENTO',
  'ESTADO',
  'TRANSITO',
  'DIGITAL',
];

function sanitizeCandidateName(str: string): string | null {
  if (!str) return null;
  let clean = str
    .replace(/[0-9.:,;!?"'#$*()_+=/\\[\]{}<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove acentos para checagem de stop words
  const unaccented = clean
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  const words = unaccented.split(' ').filter((w) => w.length > 1);
  if (words.length < 2) return null; // nome tem que ter pelo menos 2 palavras (Nome e Sobrenome)

  // Verifica se não é cabeçalho governamental
  const matchedStopWords = words.filter((w) => STOP_WORDS_NAME.includes(w));
  if (matchedStopWords.length >= 2) return null;

  // Tamanho razoável
  if (clean.length < 5 || clean.length > 70) return null;

  // Caixa alta adequada ou capitalizada
  return clean.toUpperCase();
}

/**
 * Localiza o Nome do Sócio / Condutor / Administrador
 */
export function findPartnerName(text: string, docHint?: CompanyDocType): string | null {
  if (!text) return null;

  // 1. Em CNH / RG: Busca campo "NOME" ou "CONDUTOR" na mesma linha ou linha seguinte
  const cnhNamePatterns = [
    /(?:(?:^|\n|\s)(?:1\.\s*)?NOME(?:\s+DO\s+CONDUTOR|\s+COMPLETO)?\s*[:\-]?\s*)([A-ZÀ-Úa-zà-ú\s]{5,70})(?=\n|\r|DOC|FILIA|IDENTIDADE|CPF|DATA|$)/i,
    /(?:(?:^|\n)\s*(?:1\.\s*)?NOME\s*[:\-]?\s*\n\s*)([A-ZÀ-Úa-zà-ú\s]{5,70})(?=\n|\r|DOC|FILIA|IDENTIDADE|CPF|DATA|$)/i,
    /(?:(?:CONDUTOR|TITULAR)\s*[:\-]?\s*)([A-ZÀ-Úa-zà-ú\s]{5,70})(?=\n|\r|DOC|FILIA|IDENTIDADE|CPF|DATA|$)/i,
  ];

  for (const regex of cnhNamePatterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const candidate = sanitizeCandidateName(match[1]);
      if (candidate) return candidate;
    }
  }

  // 2. Em Contrato Social / Alteração Contratual / JUCEPI
  const legalPreambleRegex =
    /\b([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]{4,55}),\s*(?:brasileir[oa]|solteir[oa]|casad[oa]|divorciad[oa]|empresári[oa]|administrador[a]?|residente|domiciliad[oa]|portador)/i;
  const preambleMatch = text.match(legalPreambleRegex);
  if (preambleMatch && preambleMatch[1]) {
    const candidate = sanitizeCandidateName(preambleMatch[1]);
    if (candidate) return candidate;
  }

  const socioAdminRegex =
    /(?:(?:S[OÓ]CIO[- ]*ADMINISTRADOR|ADMINISTRADOR|ADMINISTRA[CÇ][AÃ]O|REPRESENTANTE\s+LEGAL)\s*[:\-]?\s*(?:\n\s*)?)([A-ZÀ-Úa-zà-ú\s]{5,60})/i;
  const socioMatch = text.match(socioAdminRegex);
  if (socioMatch && socioMatch[1]) {
    const candidate = sanitizeCandidateName(socioMatch[1]);
    if (candidate) return candidate;
  }

  // 3. Fallback inteligente quando for CNH ou RG:
  // Procura linha antes de "DOC. IDENTIDADE" ou "FILIAÇÃO" ou "DATA NASCIMENTO"
  if (docHint === 'cnh_socio' || docHint === 'rg_socio' || /HABILITA|DETRAN|CONDUTOR/i.test(text)) {
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^(?:1\.\s*)?NOME/i.test(line)) {
        // Se a própria linha tem o nome após NOME
        const rest = line.replace(/^(?:1\.\s*)?NOME\s*[:\-]?\s*/i, '').trim();
        const cand = sanitizeCandidateName(rest);
        if (cand) return cand;

        // Se o nome estiver na linha de baixo
        if (i + 1 < lines.length) {
          const nextCand = sanitizeCandidateName(lines[i + 1]);
          if (nextCand) return nextCand;
        }
      }
    }
  }

  return null;
}

/**
 * Localiza RG do Sócio Administrador
 */
export function findPartnerRG(text: string): string | null {
  if (!text) return null;

  const rgMatch = text.match(
    /(?:(?:DOC\.?\s*(?:DE\s*)?IDENTIDADE|RG|R\.G\.|REGISTRO\s+GERAL|IDENTIDADE|C[EÉ]DULA\s+DE\s+IDENTIDADE)\s*[:\-º°]?\s*(?:\n\s*)?)([0-9A-Za-z\.\-\/\s]{4,25})/i
  );
  if (rgMatch && rgMatch[1]) {
    let clean = rgMatch[1].trim().replace(/\s+(?:ORG|EMISSOR|UF|DATA|VIA|ASSINATURA).*$/i, '');
    if (clean.length >= 4) {
      if (!/SSP|DETRAN|PC|DIC/i.test(clean) && /PI\b|PIAUI|TERESINA/i.test(text)) {
        clean = `${clean} SSP-PI`;
      }
      return clean;
    }
  }

  // Padrão numérico isolado de RG comum no Piauí (6 a 8 dígitos)
  const numRg = text.match(/\b\d{1,2}\.?\d{3}\.?\d{3}[- ]?[0-9Xx]?\s+(?:SSP[- /]?PI|PC[- /]?PI)\b/i);
  if (numRg) {
    return numRg[0].trim();
  }

  return null;
}

/**
 * Localiza Data de Nascimento do Sócio
 */
export function findPartnerBirthDate(text: string): string | null {
  if (!text) return null;

  const birthMatch = text.match(
    /(?:(?:DATA\s+(?:DE\s+)?NASCIMENTO|NASC(?:IMENTO|\.)?|DT\.?\s*NASC\.?)\s*[:\-]?\s*(?:\n\s*)?)(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i
  );
  if (birthMatch) {
    const iso = parseBrDateToISO(birthMatch[1]);
    if (iso) {
      const year = parseInt(iso.substring(0, 4), 10);
      if (year >= 1920 && year <= 2012) {
        return iso;
      }
    }
  }

  return null;
}

/**
 * Lê e analisa documentos cadastrais da empresa (Cartão CNPJ, CNH, Contrato Social, etc.)
 * e extrai automaticamente os dados para pré-preenchimento.
 */
export async function readCompanyDocument(
  file: File,
  onProgress?: (msg: string) => void,
  hintDocType?: CompanyDocType
): Promise<CompanyDocReadResult> {
  onProgress?.('Extraindo texto do documento com PDF.js / OCR...');
  const { text } = await extractTextLocallyFromFile(file, onProgress);
  const normText = cleanText(text);

  const extracted: Partial<CompanyBasicProfile> = {};
  const populatedLabels: string[] = [];
  let detectedType: CompanyDocType = hintDocType || 'outro';
  let detectedTitle = 'Documento da Empresa';

  const fileNameLower = file.name.toLowerCase();

  // --------------------------------------------------------------------------
  // IDENTIFICAÇÃO DO TIPO DE DOCUMENTO
  // --------------------------------------------------------------------------
  const isCartaoCnpj =
    hintDocType === 'cnpj' ||
    fileNameLower.includes('cnpj') ||
    fileNameLower.includes('comprovante') ||
    /COMPROVANTE\s+DE\s+INSCRI[CÇ][AÃ]O\s+E\s+DE\s+SITUA[CÇ][AÃ]O\s+CADASTRAL/i.test(normText) ||
    (/CADASTRO\s+NACIONAL\s+DA\s+PESSOA\s+JUR[IÍ]DICA/i.test(normText) && /RECEITA\s+FEDERAL/i.test(normText));

  const isCnh =
    hintDocType === 'cnh_socio' ||
    fileNameLower.includes('cnh') ||
    fileNameLower.includes('habilitacao') ||
    fileNameLower.includes('condutor') ||
    /CARTEIRA\s+NACIONAL\s+DE\s+HABILITA[CÇ][AÃ]O/i.test(normText) ||
    /CARTEIRA\s+DIGITAL\s+DE\s+TR[AÂ]NSITO/i.test(normText) ||
    /HABILITA[CÇ][AÃ]O/i.test(normText) ||
    /SENATRAN/i.test(normText) ||
    /DENATRAN/i.test(normText) ||
    (/CONDUTOR/i.test(normText) && /DETRAN/i.test(normText)) ||
    /PERMISS[AÃ]O\s+PARA\s+DIRIGIR/i.test(normText) ||
    /CAT\.\s*HAB/i.test(normText);

  const isRg =
    hintDocType === 'rg_socio' ||
    fileNameLower.includes('rg') ||
    fileNameLower.includes('identidade') ||
    /REGISTRO\s+GERAL/i.test(normText) ||
    /CARTEIRA\s+DE\s+IDENTIDADE/i.test(normText) ||
    /SECRETARIA\s+DE\s+SEGURAN[CÇ]A\s+P[UÚ]BLICA/i.test(normText) ||
    /SSP[- /]?[A-Z]{2}/i.test(normText);

  const isContratoSocial =
    hintDocType === 'contrato_social' ||
    fileNameLower.includes('contrato') ||
    fileNameLower.includes('jucepi') ||
    fileNameLower.includes('alteracao') ||
    /CONTRATO\s+SOCIAL/i.test(normText) ||
    /ALTERA[CÇ][AÃ]O\s+CONTRATUAL/i.test(normText) ||
    /REQUERIMENTO\s+DE\s+EMPRES[AÁ]RIO/i.test(normText) ||
    /ESTATUTO\s+SOCIAL/i.test(normText) ||
    /JUNTA\s+COMERCIAL/i.test(normText) ||
    /\bJUCEPI\b/i.test(normText);

  const isIeSefaz =
    hintDocType === 'ie_sefaz' ||
    /SECRETARIA\s+DA\s+FAZENDA/i.test(normText) ||
    /\bSEFAZ\b/i.test(normText) ||
    /CADASTRO\s+DE\s+CONTRIBUINTES/i.test(normText) ||
    /SITUA[CÇ][AÃ]O\s+FISCAL\s+ESTADUAL/i.test(normText);

  const isImPrefeitura =
    hintDocType === 'im_prefeitura' ||
    /PREFEITURA\s+MUNICIPAL/i.test(normText) ||
    /SECRETARIA\s+MUNICIPAL/i.test(normText) ||
    /\bSEMF\b/i.test(normText) ||
    /\bSIAT\b/i.test(normText) ||
    /CADASTRO\s+MERCANTIL/i.test(normText);

  // --------------------------------------------------------------------------
  // EXTRAÇÃO ESPECÍFICA POR TIPO
  // --------------------------------------------------------------------------
  if (isCartaoCnpj) {
    detectedType = 'cnpj';
    detectedTitle = 'Cartão CNPJ (Receita Federal)';

    const cnpj = findBestCNPJ(normText);
    if (cnpj) {
      extracted.cnpj = cnpj;
      populatedLabels.push('CNPJ');
    }

    // Data de Abertura
    const aberturaMatch = normText.match(
      /(?:DATA\s+DE\s+ABERTURA|ABERTURA)\s*[:\-]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i
    );
    if (aberturaMatch) {
      const iso = parseBrDateToISO(aberturaMatch[1]);
      if (iso) {
        extracted.openingDate = iso;
        populatedLabels.push('Data de Abertura');
      }
    }

    // Nome Empresarial (Razão Social)
    const razaoMatch = normText.match(
      /(?:NOME\s+EMPRESARIAL|RAZ[AÃ]O\s+SOCIAL)\s*[:\-]?\s*([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 .,&/\-]{3,80}?)(?=\n|T[IÍ]TULO|NOME\s+FANTASIA|PORTE|CÓDIGO|$)/i
    );
    if (razaoMatch && razaoMatch[1]) {
      const r = razaoMatch[1].trim();
      if (!/REP[UÚ]BLICA|MINIST[EÉ]RIO/i.test(r)) {
        extracted.companyName = r;
        populatedLabels.push('Razão Social');
      }
    }

    // Nome Fantasia
    const fantasiaMatch = normText.match(
      /(?:T[IÍ]TULO\s+DO\s+ESTABELECIMENTO\s*\(NOME\s+DE\s+FANTASIA\)|NOME\s+FANTASIA)\s*[:\-]?\s*([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 .,&/\-]{2,70}?)(?=\n|PORTE|CÓDIGO|ATIVIDADE|CNPJ|$)/i
    );
    if (fantasiaMatch && fantasiaMatch[1] && !/\*{3,}/.test(fantasiaMatch[1])) {
      extracted.tradeName = fantasiaMatch[1].trim();
      populatedLabels.push('Nome Fantasia');
    }

    // Porte
    const porteMatch = normText.match(/PORTE\s*[:\-]?\s*(ME|EPP|DEMAIS|MICROEMPRESA)/i);
    if (porteMatch) {
      extracted.companySize = porteMatch[1].toUpperCase();
      populatedLabels.push('Porte');
    }

    // CNAE Principal
    const cnaeMatch = normText.match(/(\d{2}\.\d{2}-\d-\d{2}\s*-\s*[^\n]{5,90})/);
    if (cnaeMatch) {
      extracted.cnaeMain = cnaeMatch[1].trim();
      populatedLabels.push('CNAE Principal');
    }

    // Natureza Jurídica
    const natMatch = normText.match(
      /(?:C[OÓ]DIGO\s+E\s+DESCRI[CÇ][AÃ]O\s+DA\s+NATUREZA\s+JUR[IÍ]DICA)\s*[:\-]?\s*([^\n]{5,80})/i
    );
    if (natMatch) {
      extracted.legalNature = natMatch[1].trim();
      populatedLabels.push('Natureza Jurídica');
    }

    // Endereço
    const logrMatch = normText.match(/LOGRADOURO\s*[:\-]?\s*([^\n]{3,70})/i);
    const numMatch = normText.match(/N[UÚ]MERO\s*[:\-]?\s*([^\n]{1,20})/i);
    const complMatch = normText.match(/COMPLEMENTO\s*[:\-]?\s*([^\n]{2,40})/i);
    const bairroMatch = normText.match(/BAIRRO(?:\/DISTRITO)?\s*[:\-]?\s*([^\n]{2,50})/i);
    const cepMatch = normText.match(/\b(64\d{3}-?\d{3}|\d{2}\.?\d{3}-\d{3})\b/);
    const municMatch = normText.match(/MUNIC[IÍ]PIO\s*[:\-]?\s*([A-ZÀ-Ú ]{3,35})\s+UF\s*[:\-]?\s*([A-Z]{2})/i);

    if (logrMatch) {
      const parts = [logrMatch[1].trim()];
      if (numMatch && numMatch[1] && !/S\/N|SEM\s+NUMERO/i.test(numMatch[1])) {
        parts.push(numMatch[1].trim());
      }
      if (complMatch && complMatch[1] && !/^\s*$/i.test(complMatch[1])) {
        parts.push(complMatch[1].trim());
      }
      extracted.address = parts.join(', ');
      populatedLabels.push('Endereço');
    }

    if (bairroMatch) {
      extracted.neighborhood = bairroMatch[1].trim();
      populatedLabels.push('Bairro');
    }

    if (cepMatch) {
      extracted.cep = formatCEP(cepMatch[1]);
      populatedLabels.push('CEP');
    }

    if (municMatch) {
      extracted.cityState = `${municMatch[1].trim()} - ${municMatch[2].trim().toUpperCase()}`;
      extracted.uf = municMatch[2].trim().toUpperCase();
      populatedLabels.push('Cidade/UF');
    } else if (/TERESINA/i.test(normText)) {
      extracted.cityState = 'Teresina - PI';
      extracted.uf = 'PI';
      populatedLabels.push('Cidade/UF');
    }

    // Situação Cadastral
    const sitMatch = normText.match(/SITUA[CÇ][AÃ]O\s+CADASTRAL\s*[:\-]?\s*(ATIVA|SUSPENSA|INAPTA|BAIXADA)/i);
    if (sitMatch) {
      extracted.cadastralSituation = sitMatch[1].toUpperCase();
      populatedLabels.push('Situação Cadastral');
    }

    // E-mail e Telefone
    const emailMatch = normText.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
    if (emailMatch && !/receita|fazenda|gov\.br/i.test(emailMatch[1])) {
      extracted.email = emailMatch[1].toLowerCase();
      populatedLabels.push('E-mail');
    }

    const phoneMatch = normText.match(/(\(\d{2}\)\s*\d{4,5}-?\d{4})/);
    if (phoneMatch) {
      extracted.phone = phoneMatch[1].trim();
      populatedLabels.push('Telefone');
    }
  } else if (isCnh) {
    detectedType = 'cnh_socio';
    detectedTitle = 'CNH do Sócio Administrador';

    // CPF DO SÓCIO
    const partnerCpf = findBestCPF(normText, extracted.cnpj);
    if (partnerCpf) {
      extracted.partnerCpf = partnerCpf;
      populatedLabels.push('CPF do Sócio');
    }

    // NOME DO SÓCIO
    const partnerName = findPartnerName(normText, 'cnh_socio');
    if (partnerName) {
      extracted.partnerName = partnerName;
      populatedLabels.push('Nome do Sócio');
    }

    // DATA DE NASCIMENTO
    const birthDate = findPartnerBirthDate(normText);
    if (birthDate) {
      extracted.partnerBirthDate = birthDate;
      populatedLabels.push('Data de Nascimento do Sócio');
    }

    // RG
    const rg = findPartnerRG(normText);
    if (rg) {
      extracted.partnerRg = rg;
      populatedLabels.push('RG do Sócio');
    }
  } else if (isRg) {
    detectedType = 'rg_socio';
    detectedTitle = 'RG do Sócio Administrador';

    const partnerCpf = findBestCPF(normText, extracted.cnpj);
    if (partnerCpf) {
      extracted.partnerCpf = partnerCpf;
      populatedLabels.push('CPF do Sócio');
    }

    const partnerName = findPartnerName(normText, 'rg_socio');
    if (partnerName) {
      extracted.partnerName = partnerName;
      populatedLabels.push('Nome do Sócio');
    }

    const birthDate = findPartnerBirthDate(normText);
    if (birthDate) {
      extracted.partnerBirthDate = birthDate;
      populatedLabels.push('Data de Nascimento do Sócio');
    }

    const rg = findPartnerRG(normText);
    if (rg) {
      extracted.partnerRg = rg;
      populatedLabels.push('RG do Sócio');
    }
  } else if (isContratoSocial) {
    detectedType = 'contrato_social';
    detectedTitle = 'Contrato Social / JUCEPI';

    // NIRE (11 dígitos, no Piauí começa com 22)
    const nireMatch = normText.match(/\bNIRE\s*[:\-º°]?\s*(22\d{9}|\d{11})\b/i);
    if (nireMatch) {
      extracted.nire = nireMatch[1].trim();
      populatedLabels.push('NIRE (JUCEPI)');
    }

    // CNPJ no Contrato
    const cnpj = findBestCNPJ(normText);
    if (cnpj) {
      extracted.cnpj = cnpj;
      populatedLabels.push('CNPJ');
    }

    // Razão Social
    const razaoMatch = normText.match(
      /(?:DENOMINA[CÇ][AÃ]O\s+SOCIAL|RAZ[AÃ]O\s+SOCIAL|NOME\s+EMPRESARIAL)\s*[:\-]?\s*([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 .,&/\-]{3,80}?)(?=\n|COM\s+SEDE|CLÁUSULA|$)/i
    );
    if (razaoMatch) {
      extracted.companyName = razaoMatch[1].trim();
      populatedLabels.push('Razão Social');
    }

    // Capital Social
    const capMatch = normText.match(/CAPITAL\s+SOCIAL[^\n\d]{1,40}(?:R\$\s*)?([\d.,]+)/i);
    if (capMatch) {
      extracted.shareCapital = `R$ ${capMatch[1].trim()}`;
      populatedLabels.push('Capital Social');
    }

    // Sócio Administrador
    const partnerName = findPartnerName(normText, 'contrato_social');
    if (partnerName) {
      extracted.partnerName = partnerName;
      populatedLabels.push('Sócio Administrador');
    }

    // CPF do Sócio
    const partnerCpf = findBestCPF(normText, extracted.cnpj);
    if (partnerCpf) {
      extracted.partnerCpf = partnerCpf;
      populatedLabels.push('CPF do Sócio');
    }
  } else if (isIeSefaz) {
    detectedType = 'ie_sefaz';
    detectedTitle = 'Inscrição Estadual (SEFAZ-PI)';

    const ieMatch = normText.match(
      /(?:INSCRI[CÇ][AÃ]O\s+ESTADUAL|I\.?\s*E\.?|CGF)\s*[:\-º°]?\s*([\d.\-]{7,15})/i
    );
    if (ieMatch) {
      extracted.stateRegistration = ieMatch[1].trim();
      populatedLabels.push('Inscrição Estadual');
    }

    const cnpj = findBestCNPJ(normText);
    if (cnpj) {
      extracted.cnpj = cnpj;
      populatedLabels.push('CNPJ');
    }
  } else if (isImPrefeitura) {
    detectedType = 'im_prefeitura';
    detectedTitle = 'Inscrição Municipal (Prefeitura / SIAT)';

    const imMatch = normText.match(
      /(?:INSCRI[CÇ][AÃ]O\s+MUNICIPAL|C\.?\s*M\.?\s*C\.?|CADASTRO\s+MERCANTIL)\s*[:\-º°]?\s*([\d.\-]{4,14})/i
    );
    if (imMatch) {
      extracted.municipalRegistration = imMatch[1].trim();
      populatedLabels.push('Inscrição Municipal');
    }

    const cnpj = findBestCNPJ(normText);
    if (cnpj) {
      extracted.cnpj = cnpj;
      populatedLabels.push('CNPJ');
    }
  }

  // --------------------------------------------------------------------------
  // UNIVERSAL EXTRACTION PASS (FALLBACK TOTAL)
  // Garante que, independentemente do tipo ou botão clicado, se houver
  // CPF do sócio, Nome, RG, Nascimento ou CNPJ no documento, eles serão lidos!
  // --------------------------------------------------------------------------

  // 1. CPF do Sócio (se ainda não extraído)
  if (!extracted.partnerCpf) {
    const fallbackCpf = findBestCPF(normText, extracted.cnpj);
    if (fallbackCpf) {
      extracted.partnerCpf = fallbackCpf;
      if (!populatedLabels.includes('CPF do Sócio')) {
        populatedLabels.push('CPF do Sócio');
      }
    }
  }

  // 2. Nome do Sócio (se ainda não extraído)
  if (!extracted.partnerName) {
    const fallbackName = findPartnerName(normText, hintDocType);
    if (fallbackName) {
      extracted.partnerName = fallbackName;
      if (!populatedLabels.includes('Nome do Sócio')) {
        populatedLabels.push('Nome do Sócio');
      }
    }
  }

  // 3. Data de Nascimento do Sócio (se ainda não extraída)
  if (!extracted.partnerBirthDate) {
    const fallbackBirth = findPartnerBirthDate(normText);
    if (fallbackBirth) {
      extracted.partnerBirthDate = fallbackBirth;
      if (!populatedLabels.includes('Data de Nascimento do Sócio')) {
        populatedLabels.push('Data de Nascimento do Sócio');
      }
    }
  }

  // 4. RG do Sócio (se ainda não extraído)
  if (!extracted.partnerRg) {
    const fallbackRg = findPartnerRG(normText);
    if (fallbackRg) {
      extracted.partnerRg = fallbackRg;
      if (!populatedLabels.includes('RG do Sócio')) {
        populatedLabels.push('RG do Sócio');
      }
    }
  }

  // 5. CNPJ (se ainda não extraído)
  if (!extracted.cnpj) {
    const fallbackCnpj = findBestCNPJ(normText);
    if (fallbackCnpj) {
      extracted.cnpj = fallbackCnpj;
      if (!populatedLabels.includes('CNPJ')) {
        populatedLabels.push('CNPJ');
      }
    }
  }

  // 6. CEP (se ainda não extraído)
  if (!extracted.cep) {
    const cepMatch = normText.match(/\b(64\d{3}-?\d{3}|\d{2}\.?\d{3}-\d{3})\b/);
    if (cepMatch) {
      extracted.cep = formatCEP(cepMatch[1]);
      if (!populatedLabels.includes('CEP')) {
        populatedLabels.push('CEP');
      }
    }
  }

  // 7. Telefone (se ainda não extraído)
  if (!extracted.phone) {
    const phoneMatch = normText.match(/(\(\d{2}\)\s*\d{4,5}-?\d{4})/);
    if (phoneMatch) {
      extracted.phone = formatPhone(phoneMatch[1]);
      if (!populatedLabels.includes('Telefone')) {
        populatedLabels.push('Telefone');
      }
    }
  }

  // Montar Resumo da Análise
  let summary = '';
  if (populatedLabels.length > 0) {
    summary = `Identificado: ${detectedTitle}. Campos preenchidos automaticamente: ${populatedLabels.join(', ')}.`;
  } else {
    summary = `Documento anexado (${file.name}). Preencha os campos adicionais manualmente caso necessário.`;
  }

  return {
    detectedType,
    detectedTitle,
    extractedFields: extracted,
    populatedFieldLabels: populatedLabels,
    summary,
    rawTextSample: normText.slice(0, 300),
  };
}
