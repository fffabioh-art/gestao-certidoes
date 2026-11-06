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

export type FieldConfidence = 'alta' | 'media' | 'baixa';

export interface CompanyDocFieldItem {
  key: string;
  label: string;
  group: 'identificacao' | 'atividades' | 'endereco' | 'contato' | 'cnh_dados';
  extractedValue: string;
  currentValue: string;
  confidence: FieldConfidence;
  confidenceReason?: string;
  accepted: boolean;
  isDivergent: boolean;
  isValid?: boolean;
}

export interface CnpjCardExtractionResult {
  detected: boolean;
  fields: Partial<CompanyBasicProfile>;
  confidences: Record<string, FieldConfidence>;
  secondaryCnaes: Array<{ code: string; description: string }>;
  populatedLabels: string[];
  rawText: string;
}

export interface CnhExtractionResult {
  detected: boolean;
  fields: Partial<CompanyBasicProfile>;
  confidences: Record<string, FieldConfidence>;
  populatedLabels: string[];
  rawText: string;
}

export interface CompanyDocReadResult {
  detectedType: CompanyDocType;
  detectedTitle: string;
  extractedFields: Partial<CompanyBasicProfile>;
  fieldItems: CompanyDocFieldItem[];
  populatedFieldLabels: string[];
  summary: string;
  rawTextSample: string;
  isCnhPartnerPriority?: boolean;
  cnpjDivergenceWithCurrent?: boolean;
  cnhDivergenceWithCurrent?: boolean;
}

/**
 * Normaliza quebras de linha e múltiplos espaços para busca confiável
 */
export function cleanText(text: string): string {
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
    const candidate = match[1]
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

  // Formatado oficial
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
  'MINISTRO',
  'DIRETOR',
];

function sanitizeCandidateName(str: string): string | null {
  if (!str) return null;
  const clean = str
    .replace(/[0-9.:,;!?"'#$*()_+=/\\[\]{}<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove acentos para checagem de stop words
  const unaccented = clean
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  const words = unaccented.split(' ').filter((w) => w.length > 1);
  if (words.length < 2) return null; // nome deve ter pelo menos 2 palavras

  // Verifica se não é cabeçalho governamental
  const matchedStopWords = words.filter((w) => STOP_WORDS_NAME.includes(w));
  if (matchedStopWords.length >= 2) return null;

  // Tamanho razoável
  if (clean.length < 5 || clean.length > 70) return null;

  return clean.toUpperCase();
}

/**
 * ============================================================================
 * EXTRATOR ESPECIALIZADO 1: CARTÃO CNPJ (RECEITA FEDERAL DO BRASIL)
 * ============================================================================
 */
export function extractCnpjCardData(text: string): CnpjCardExtractionResult {
  const normText = cleanText(text);
  const fields: Partial<CompanyBasicProfile> = {};
  const confidences: Record<string, FieldConfidence> = {};
  const populatedLabels: string[] = [];
  const secondaryCnaes: Array<{ code: string; description: string }> = [];

  const isCartao =
    /COMPROVANTE\s+DE\s+INSCRI[CÇ][AÃ]O\s+E\s+DE\s+SITUA[CÇ][AÃ]O\s+CADASTRAL/i.test(normText) ||
    (/CADASTRO\s+NACIONAL\s+DA\s+PESSOA\s+JUR[IÍ]DICA/i.test(normText) && /RECEITA\s+FEDERAL/i.test(normText));

  // 1. CNPJ
  const cnpj = findBestCNPJ(normText);
  if (cnpj) {
    fields.cnpj = cnpj;
    confidences.cnpj = 'alta';
    populatedLabels.push('CNPJ');
  }

  // 2. Data de Abertura (NÃO confundir com emissão do comprovante nem situação cadastral!)
  const aberturaMatch = normText.match(
    /DATA\s+DE\s+ABERTURA\s*[:\-]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i
  );
  if (aberturaMatch) {
    const iso = parseBrDateToISO(aberturaMatch[1]);
    if (iso) {
      fields.openingDate = iso;
      confidences.openingDate = 'alta';
      populatedLabels.push('Data de Abertura');
    }
  }

  // 3. Razão Social (Nome Empresarial)
  const razaoMatch = normText.match(
    /(?:NOME\s+EMPRESARIAL|RAZ[AÃ]O\s+SOCIAL)\s*[:\-]?\s*([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 .,&/\-]{3,80}?)(?=\n|T[IÍ]TULO|NOME\s+FANTASIA|PORTE|CÓDIGO|DATA|$)/i
  );
  if (razaoMatch && razaoMatch[1]) {
    const r = razaoMatch[1].trim();
    if (!/REP[UÚ]BLICA|MINIST[EÉ]RIO|CADASTRO/i.test(r)) {
      fields.companyName = r;
      confidences.companyName = 'alta';
      populatedLabels.push('Razão Social');
    }
  }

  // 4. Nome Fantasia (Título do Estabelecimento)
  // Regra Obrigatória: Se tiver ***** ou vazio, NUNCA salvar ***** como nome fantasia!
  const fantasiaMatch = normText.match(
    /(?:T[IÍ]TULO\s+DO\s+ESTABELECIMENTO\s*\(NOME\s+DE\s+FANTASIA\)|NOME\s+FANTASIA)\s*[:\-]?\s*([^\n]{2,70}?)(?=\n|PORTE|CÓDIGO|ATIVIDADE|CNPJ|$)/i
  );
  if (fantasiaMatch && fantasiaMatch[1]) {
    const rawFantasia = fantasiaMatch[1].trim();
    if (
      !/^\*+$/.test(rawFantasia) &&
      !/n[aã]o\s+informado/i.test(rawFantasia) &&
      !/t[ií]tulo\s+do\s+estabelecimento/i.test(rawFantasia) &&
      rawFantasia.length >= 2
    ) {
      fields.tradeName = rawFantasia;
      confidences.tradeName = 'alta';
      populatedLabels.push('Nome Fantasia');
    } else {
      fields.tradeName = ''; // Limpo expressamente se for ausente
    }
  }

  // 5. Porte da Empresa
  const porteMatch = normText.match(
    /PORTE\s*[:\-]?\s*(ME|EPP|DEMAIS|MICROEMPRESA|EMPRESA\s+DE\s+PEQUENO\s+PORTE)/i
  );
  if (porteMatch) {
    fields.companySize = porteMatch[1].toUpperCase();
    confidences.companySize = 'alta';
    populatedLabels.push('Porte');
  }

  // 6. CNAE Principal (Código e Descrição)
  const cnaePrincipalMatch = normText.match(
    /(?:ATIVIDADE\s+ECON[OÔ]MICA\s+PRINCIPAL)\s*[:\-]?\s*(\d{2}\.\d{2}-\d-\d{2}\s*-\s*[^\n]{5,100})/i
  );
  if (cnaePrincipalMatch) {
    fields.cnaeMain = cnaePrincipalMatch[1].trim();
    confidences.cnaeMain = 'alta';
    populatedLabels.push('CNAE Principal');
  } else {
    // Fallback padrão código CNAE
    const fallbackCnae = normText.match(/(\d{2}\.\d{2}-\d-\d{2}\s*-\s*[^\n]{5,100})/);
    if (fallbackCnae) {
      fields.cnaeMain = fallbackCnae[1].trim();
      confidences.cnaeMain = 'media';
      populatedLabels.push('CNAE Principal');
    }
  }

  // 7. CNAEs Secundários (TODOS os códigos e descrições existentes)
  const secundariasHeaderIndex = normText.search(/ATIVIDADES\s+ECON[OÔ]MICAS\s+SECUND[AÁ]RIAS/i);
  if (secundariasHeaderIndex !== -1) {
    const textAfterSecundarias = normText.slice(secundariasHeaderIndex);
    const stopIndex = textAfterSecundarias.search(/C[OÓ]DIGO\s+E\s+DESCRI[CÇ][AÃ]O\s+DA\s+NATUREZA\s+JUR[IÍ]DICA/i);
    const secundariasSection = stopIndex !== -1 ? textAfterSecundarias.slice(0, stopIndex) : textAfterSecundarias.slice(0, 1500);

    const cnaeRegex = /(\d{2}\.\d{2}-\d-\d{2})\s*-\s*([^\n]{5,120})/g;
    let m: RegExpExecArray | null;
    const cnaeList: string[] = [];
    while ((m = cnaeRegex.exec(secundariasSection)) !== null) {
      const code = m[1].trim();
      const desc = m[2].trim();
      // Não duplicar o principal
      if (fields.cnaeMain && fields.cnaeMain.startsWith(code)) continue;

      secondaryCnaes.push({ code, description: desc });
      cnaeList.push(`${code} - ${desc}`);
    }

    if (cnaeList.length > 0) {
      fields.cnaeSecondary = cnaeList;
      fields.cnaeSecondaryText = cnaeList.join('\n');
      confidences.cnaeSecondary = 'alta';
      populatedLabels.push(`CNAEs Secundários (${cnaeList.length})`);
    }
  }

  // 8. Natureza Jurídica
  const natMatch = normText.match(
    /(?:NATUREZA\s+JUR[IÍ]DICA)\s*[:\-]?\s*([^\n]{5,80})/i
  );
  if (natMatch) {
    fields.legalNature = natMatch[1].trim();
    confidences.legalNature = 'alta';
    populatedLabels.push('Natureza Jurídica');
  }

  // 9. Situação Cadastral e Data
  const sitMatch = normText.match(/SITUA[CÇ][AÃ]O\s+CADASTRAL\s*[:\-]?\s*(ATIVA|SUSPENSA|INAPTA|BAIXADA|NULA)/i);
  if (sitMatch) {
    fields.cadastralSituation = sitMatch[1].toUpperCase();
    confidences.cadastralSituation = 'alta';
    populatedLabels.push('Situação Cadastral');
  }

  const dataSitMatch = normText.match(
    /DATA\s+DA\s+SITUA[CÇ][AÃ]O\s+CADASTRAL\s*[:\-]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i
  );
  if (dataSitMatch) {
    const iso = parseBrDateToISO(dataSitMatch[1]);
    if (iso) {
      fields.cadastralSituationDate = iso;
      confidences.cadastralSituationDate = 'alta';
      populatedLabels.push('Data da Situação Cadastral');
    }
  }

  // 10. Motivo de Situação Cadastral
  const motivoMatch = normText.match(/MOTIVO\s+DE\s+SITUA[CÇ][AÃ]O\s+CADASTRAL\s*[:\-]?\s*([^\n]+)/i);
  if (motivoMatch && !/^\*+$/.test(motivoMatch[1].trim()) && motivoMatch[1].trim().length > 2) {
    fields.cadastralSituationReason = motivoMatch[1].trim();
    confidences.cadastralSituationReason = 'alta';
    populatedLabels.push('Motivo da Situação');
  }

  // 11. Ente Federativo Responsável (EFR)
  const efrMatch = normText.match(/ENTE\s+FEDERATIVO\s+RESPONS[AÁ]VEL\s*(?:\(EFR\))?\s*[:\-]?\s*([^\n]+)/i);
  if (efrMatch && !/^\*+$/.test(efrMatch[1].trim()) && efrMatch[1].trim().length > 2) {
    fields.responsibleFederativeEntity = efrMatch[1].trim();
    confidences.responsibleFederativeEntity = 'alta';
    populatedLabels.push('Ente Federativo (EFR)');
  }

  // 12. Endereço Completo
  const logrMatch = normText.match(/LOGRADOURO\s*[:\-]?\s*([^\n]{3,70})/i);
  // Procurar NÚMERO apenas após o logradouro ou excluindo expressamente NÚMERO DE INSCRIÇÃO
  const numMatch =
    normText.match(/(?:LOGRADOURO[\s\S]*?)(?:^|\n|\s)N[UÚ]MERO(?!\s+DE\s+INSCRI[CÇ][AÃ]O)\s*[:\-]?\s*([^\n]{1,20})/i) ||
    normText.match(/(?:^|\n)\s*N[UÚ]MERO(?!\s+DE\s+INSCRI[CÇ][AÃ]O)\s*[:\-]?\s*([^\n]{1,20})/i);
  const complMatch = normText.match(/COMPLEMENTO\s*[:\-]?\s*([^\n]{2,40})/i);
  const bairroMatch = normText.match(/BAIRRO(?:\/DISTRITO)?\s*[:\-]?\s*([^\n]{2,50})/i);
  const cepMatch = normText.match(/\b(64\d{3}-?\d{3}|\d{2}\.?\d{3}-\d{3})\b/);
  const municMatch = normText.match(/MUNIC[IÍ]PIO\s*[:\-]?\s*([A-ZÀ-Ú ]{3,35})\s+UF\s*[:\-]?\s*([A-Z]{2})/i);

  if (logrMatch) {
    const parts = [logrMatch[1].trim()];
    if (
      numMatch &&
      numMatch[1] &&
      !/S\/N|SEM\s+NUMERO|DE\s+INSCRI/i.test(numMatch[1])
    ) {
      parts.push(numMatch[1].trim());
    }
    if (complMatch && complMatch[1] && !/^\s*$/i.test(complMatch[1]) && !/^\*+$/.test(complMatch[1].trim())) {
      parts.push(complMatch[1].trim());
    }
    fields.address = parts.join(', ');
    confidences.address = 'alta';
    populatedLabels.push('Endereço');
  }

  if (bairroMatch && !/^\*+$/.test(bairroMatch[1].trim())) {
    fields.neighborhood = bairroMatch[1].trim();
    confidences.neighborhood = 'alta';
    populatedLabels.push('Bairro');
  }

  if (cepMatch) {
    fields.cep = formatCEP(cepMatch[1]);
    confidences.cep = 'alta';
    populatedLabels.push('CEP');
  }

  if (municMatch) {
    fields.cityState = `${municMatch[1].trim()} - ${municMatch[2].trim().toUpperCase()}`;
    fields.uf = municMatch[2].trim().toUpperCase();
    confidences.cityState = 'alta';
    populatedLabels.push('Cidade/UF');
  } else if (/TERESINA/i.test(normText)) {
    fields.cityState = 'Teresina - PI';
    fields.uf = 'PI';
    confidences.cityState = 'media';
    populatedLabels.push('Cidade/UF');
  }

  // 13. Telefone e E-mail
  const emailMatch = normText.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  if (emailMatch && !/receita|fazenda|gov\.br/i.test(emailMatch[1])) {
    fields.email = emailMatch[1].toLowerCase();
    confidences.email = 'alta';
    populatedLabels.push('E-mail');
  }

  const phoneMatch = normText.match(/(\(\d{2}\)\s*\d{4,5}-?\d{4})/);
  if (phoneMatch) {
    fields.phone = phoneMatch[1].trim();
    confidences.phone = 'alta';
    populatedLabels.push('Telefone');
  }

  return {
    detected: Boolean(isCartao || fields.cnpj),
    fields,
    confidences,
    secondaryCnaes,
    populatedLabels,
    rawText: normText,
  };
}

/**
 * ============================================================================
 * EXTRATOR ESPECIALIZADO 2: CNH (CARTEIRA NACIONAL DE HABILITAÇÃO / CNH DIGITAL)
 * ============================================================================
 */
export function extractCnhData(text: string): CnhExtractionResult {
  const normText = cleanText(text);
  const fields: Partial<CompanyBasicProfile> = {};
  const confidences: Record<string, FieldConfidence> = {};
  const populatedLabels: string[] = [];

  const isCnh =
    /CARTEIRA\s+NACIONAL\s+DE\s+HABILITA[CÇ][AÃ]O/i.test(normText) ||
    /CARTEIRA\s+DIGITAL\s+DE\s+TR[AÂ]NSITO/i.test(normText) ||
    /HABILITA[CÇ][AÃ]O/i.test(normText) ||
    /SENATRAN/i.test(normText) ||
    /DENATRAN/i.test(normText) ||
    (/CONDUTOR/i.test(normText) && /DETRAN/i.test(normText)) ||
    /PERMISS[AÃ]O\s+PARA\s+DIRIGIR/i.test(normText) ||
    /CAT\.\s*HAB/i.test(normText) ||
    /N[º°]?\s*REGISTRO/i.test(normText);

  // 1. CPF (Validado matematicamente com dígitos verificadores)
  const cpf = findBestCPF(normText);
  if (cpf && isValidCPF(cpf)) {
    fields.partnerCpf = cpf;
    confidences.partnerCpf = 'alta';
    populatedLabels.push('CPF do Titular');
  }

  // 2. Número de Registro da CNH (11 dígitos, distindo do CPF!)
  const registroMatch = normText.match(
    /(?:(?:6\.\s*)?N[º°]?\s*REGISTRO|REGISTRO\s+CNH|REGISTRO\s+NACIONAL)\s*[:\-]?\s*(\d{9,12})\b/i
  );
  if (registroMatch) {
    const rawReg = registroMatch[1];
    // Garantir que não é idêntico ao CPF
    if (!cpf || onlyDigits(cpf) !== rawReg) {
      fields.partnerCnhNumber = rawReg;
      confidences.partnerCnhNumber = 'alta';
      populatedLabels.push('Nº Registro CNH');
    }
  }

  // 3. Nome Completo do Titular (Cuidado para NUNCA pegar a filiação!)
  const nameMatch = normText.match(
    /(?:(?:^|\n|\s)(?:1\.\s*)?NOME(?:\s+DO\s+CONDUTOR|\s+COMPLETO)?\s*[:\-]?\s*)([A-ZÀ-Úa-zà-ú\s]{5,70})(?=\n|\r|DOC|FILIA|IDENTIDADE|CPF|DATA|$)/i
  );
  if (nameMatch && nameMatch[1]) {
    const candidate = sanitizeCandidateName(nameMatch[1]);
    if (candidate) {
      fields.partnerName = candidate;
      confidences.partnerName = 'alta';
      populatedLabels.push('Nome do Titular');
    }
  } else {
    // Procura linha seguinte ao rótulo NOME
    const multilineName = normText.match(
      /(?:(?:^|\n)\s*(?:1\.\s*)?NOME\s*[:\-]?\s*\n\s*)([A-ZÀ-Úa-zà-ú\s]{5,70})(?=\n|\r|DOC|FILIA|IDENTIDADE|CPF|DATA|$)/i
    );
    if (multilineName && multilineName[1]) {
      const candidate = sanitizeCandidateName(multilineName[1]);
      if (candidate) {
        fields.partnerName = candidate;
        confidences.partnerName = 'alta';
        populatedLabels.push('Nome do Titular');
      }
    }
  }

  // 4. Documento de Identidade (RG) e Órgão Emissor / UF
  const rgMatch = normText.match(
    /(?:(?:2\.\s*)?DOC\.?\s*(?:DE\s*)?IDENTIDADE\s*(?:\/\s*[OÓ]RG\.?\s*EMISSOR\s*\/\s*UF)?)\s*[:\-]?\s*([0-9A-Za-z\.\-\/\s]{4,30})(?=\n|CPF|DATA|FILIA|$)/i
  );
  if (rgMatch && rgMatch[1]) {
    let cleanRg = rgMatch[1]
      .split(/\r?\n/)[0]
      .replace(/\s+(?:\d\.\s*)?(?:CPF|DATA|FILIA|NASC).*$/i, '')
      .replace(/\s+\d+\.?$/, '')
      .trim();
    if (cleanRg.length >= 4) {
      if (!/SSP|DETRAN|PC|DIC/i.test(cleanRg) && /PI\b|PIAUI|TERESINA/i.test(normText)) {
        cleanRg = `${cleanRg} SSP-PI`;
      }
      fields.partnerRg = cleanRg;
      confidences.partnerRg = 'alta';
      populatedLabels.push('RG do Titular');
    }
  }

  // 5. Quatro Datas Distintas na CNH:
  // a) DATA DE NASCIMENTO
  const birthMatch = normText.match(
    /(?:(?:4\.\s*)?DATA\s+(?:DE\s+)?NASCIMENTO|NASC(?:IMENTO|\.)?)\s*[:\-]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i
  );
  if (birthMatch) {
    const iso = parseBrDateToISO(birthMatch[1]);
    if (iso) {
      const year = parseInt(iso.substring(0, 4), 10);
      if (year >= 1920 && year <= 2007) {
        fields.partnerBirthDate = iso;
        confidences.partnerBirthDate = 'alta';
        populatedLabels.push('Data de Nascimento');
      }
    }
  }

  // b) DATA DA 1ª HABILITAÇÃO
  const firstLicenseMatch = normText.match(
    /(?:(?:8\.\s*)?1[ªa]?\s*HABILITA[CÇ][AÃ]O|PRIMEIRA\s+HABILITA[CÇ][AÃ]O)\s*[:\-]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i
  );
  if (firstLicenseMatch) {
    const iso = parseBrDateToISO(firstLicenseMatch[1]);
    if (iso) {
      fields.partnerCnhFirstLicenseDate = iso;
      confidences.partnerCnhFirstLicenseDate = 'alta';
      populatedLabels.push('1ª Habilitação');
    }
  }

  // c) DATA DE VALIDADE (Extraída DIRETAMENTE do documento, NUNCA calculada automaticamente!)
  const validityMatch = normText.match(
    /(?:(?:7\.\s*)?VALIDADE)\s*[:\-]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i
  );
  if (validityMatch) {
    const iso = parseBrDateToISO(validityMatch[1]);
    if (iso) {
      fields.partnerCnhExpirationDate = iso;
      confidences.partnerCnhExpirationDate = 'alta';
      populatedLabels.push('Validade da CNH');
    }
  }

  // d) DATA DE EMISSÃO DA CNH
  const issueMatch = normText.match(
    /(?:(?:9\.\s*)?DATA\s+(?:DE\s+)?EMISS[AÃ]O|EMISS[AÃ]O)\s*[:\-]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i
  );
  if (issueMatch) {
    const iso = parseBrDateToISO(issueMatch[1]);
    if (iso) {
      fields.partnerCnhIssueDate = iso;
      confidences.partnerCnhIssueDate = 'alta';
      populatedLabels.push('Data de Emissão CNH');
    }
  }

  // 6. Categoria de Habilitação
  const catMatch = normText.match(
    /(?:(?:5\.\s*)?CAT\.?\s*HAB\.?|CATEGORIA)\s*[:\-]?\s*(ACC|AB|A|B|C|D|E)\b/i
  );
  if (catMatch) {
    fields.partnerCnhCategory = catMatch[1].toUpperCase();
    confidences.partnerCnhCategory = 'alta';
    populatedLabels.push('Categoria CNH');
  }

  // 7. Filiação
  const filiacaoMatch = normText.match(
    /FILIA[CÇ][AÃ]O\s*[:\-]?\s*([\s\S]{10,120}?)(?=(?:PERMISS|ACC|CAT|REGISTRO|VALIDADE|LOCAL|\d+\.))/i
  );
  if (filiacaoMatch) {
    const parents = filiacaoMatch[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 3 && !/REP[UÚ]BLICA|MINIST|CARTEIRA/i.test(l))
      .slice(0, 2)
      .join(' / ');
    if (parents) {
      fields.partnerParents = parents.toUpperCase();
      confidences.partnerParents = 'media';
      populatedLabels.push('Filiação');
    }
  }

  // 8. Local / Nacionalidade
  const localMatch = normText.match(/LOCAL\s*[:\-]?\s*([A-ZÀ-Ú ]{3,30}[,/ -]+[A-Z]{2})/i);
  if (localMatch) {
    fields.partnerNationality = localMatch[1].trim();
    confidences.partnerNationality = 'alta';
    populatedLabels.push('Local CNH');
  }

  return {
    detected: Boolean(isCnh || fields.partnerCpf || fields.partnerCnhNumber),
    fields,
    confidences,
    populatedLabels,
    rawText: normText,
  };
}

/**
 * ============================================================================
 * CONSTRUTOR DE ITENS PARA A TELA DE CONFERÊNCIA (DIFFS E CONFIDÊNCIAS)
 * ============================================================================
 */
export function buildCompanyDocFieldItems(
  extracted: Partial<CompanyBasicProfile>,
  currentCompany: Partial<CompanyBasicProfile>,
  detectedType: CompanyDocType,
  confidences: Record<string, FieldConfidence> = {}
): CompanyDocFieldItem[] {
  const items: CompanyDocFieldItem[] = [];

  const addField = (
    key: keyof CompanyBasicProfile,
    label: string,
    group: 'identificacao' | 'atividades' | 'endereco' | 'contato' | 'cnh_dados',
    overrideConfidence?: FieldConfidence
  ) => {
    const extVal = (extracted[key] as string) || '';
    if (!extVal && extVal !== '') return; // Skip if no value extracted at all

    const curVal = (currentCompany[key] as string) || '';
    const isDivergent = Boolean(curVal && extVal && curVal.trim().toLowerCase() !== extVal.trim().toLowerCase());
    const confidence = overrideConfidence || confidences[key as string] || 'alta';

    // Regra de segurança: se divergir em CNPJ ou CPF, NÃO aceitar automaticamente!
    const defaultAccepted = !(isDivergent && (key === 'cnpj' || key === 'partnerCpf'));

    items.push({
      key: key as string,
      label,
      group,
      extractedValue: extVal,
      currentValue: curVal,
      confidence,
      accepted: defaultAccepted,
      isDivergent,
      isValid: key === 'cnpj' ? isValidCNPJ(extVal) : key === 'partnerCpf' ? isValidCPF(extVal) : true,
    });
  };

  if (detectedType === 'cnpj') {
    addField('cnpj', 'CNPJ da Empresa', 'identificacao');
    addField('companyName', 'Razão Social (Nome Empresarial)', 'identificacao');
    addField('tradeName', 'Nome Fantasia', 'identificacao');
    addField('openingDate', 'Data de Abertura', 'identificacao');
    addField('cadastralSituation', 'Situação Cadastral', 'identificacao');
    addField('cadastralSituationDate', 'Data da Situação Cadastral', 'identificacao');
    addField('cadastralSituationReason', 'Motivo da Situação', 'identificacao');
    addField('legalNature', 'Natureza Jurídica', 'identificacao');
    addField('companySize', 'Porte da Empresa', 'identificacao');
    addField('responsibleFederativeEntity', 'Ente Federativo (EFR)', 'identificacao');

    addField('cnaeMain', 'CNAE Principal', 'atividades');
    addField('cnaeSecondaryText', 'CNAEs Secundários', 'atividades');

    addField('address', 'Logradouro e Número', 'endereco');
    addField('neighborhood', 'Bairro / Distrito', 'endereco');
    addField('cep', 'CEP', 'endereco');
    addField('cityState', 'Município / UF', 'endereco');

    addField('phone', 'Telefone', 'contato');
    addField('email', 'E-mail Oficial', 'contato');
  } else if (detectedType === 'cnh_socio' || detectedType === 'rg_socio') {
    addField('partnerName', 'Nome Completo do Titular', 'cnh_dados');
    addField('partnerCpf', 'CPF do Titular', 'cnh_dados');
    addField('partnerBirthDate', 'Data de Nascimento', 'cnh_dados');
    addField('partnerRg', 'Documento de Identidade (RG)', 'cnh_dados');
    addField('partnerCnhNumber', 'Nº Registro da CNH', 'cnh_dados');
    addField('partnerCnhCategory', 'Categoria da Habilitação', 'cnh_dados');
    addField('partnerCnhExpirationDate', 'Data de Validade da CNH', 'cnh_dados');
    addField('partnerCnhFirstLicenseDate', 'Data da 1ª Habilitação', 'cnh_dados');
    addField('partnerCnhIssueDate', 'Data de Emissão da CNH', 'cnh_dados');
    addField('partnerParents', 'Filiação', 'cnh_dados');
    addField('partnerNationality', 'Local / Nacionalidade', 'cnh_dados');
  } else {
    // Genérico / Outro
    addField('companyName', 'Razão Social', 'identificacao');
    addField('cnpj', 'CNPJ', 'identificacao');
    addField('partnerName', 'Nome do Sócio / Representante', 'cnh_dados');
    addField('partnerCpf', 'CPF do Sócio', 'cnh_dados');
    addField('address', 'Endereço', 'endereco');
  }

  return items;
}

/**
 * Função principal de leitura com fluxo por etapas e extratores especializados
 */
export async function readCompanyDocument(
  file: File,
  onProgress?: (msg: string) => void,
  hintDocType?: CompanyDocType,
  currentCompany?: Partial<CompanyBasicProfile>
): Promise<CompanyDocReadResult> {
  onProgress?.('Extraindo texto nativo com PDF.js / OCR Tesseract...');
  const { text } = await extractTextLocallyFromFile(file, onProgress);
  const normText = cleanText(text);

  let detectedType: CompanyDocType = hintDocType || 'outro';
  let detectedTitle = 'Documento da Empresa';
  let isCnhPartnerPriority = false;

  const fileNameLower = file.name.toLowerCase();

  // ETAPA 1 — IDENTIFICAÇÃO DO DOCUMENTO
  const cnpjCheck = extractCnpjCardData(normText);
  const cnhCheck = extractCnhData(normText);

  if (hintDocType === 'cnh_socio' || (cnhCheck.detected && !cnpjCheck.detected)) {
    detectedType = 'cnh_socio';
    detectedTitle = 'CNH do Sócio Administrador';
    isCnhPartnerPriority = true;
  } else if (hintDocType === 'cnpj' || cnpjCheck.detected) {
    detectedType = 'cnpj';
    detectedTitle = 'Cartão CNPJ (Receita Federal)';
  } else if (
    hintDocType === 'contrato_social' ||
    fileNameLower.includes('contrato') ||
    fileNameLower.includes('jucepi') ||
    /CONTRATO\s+SOCIAL/i.test(normText)
  ) {
    detectedType = 'contrato_social';
    detectedTitle = 'Contrato Social / JUCEPI';
  } else if (cnhCheck.detected) {
    detectedType = 'cnh_socio';
    detectedTitle = 'CNH do Sócio Administrador';
    isCnhPartnerPriority = true;
  }

  // ETAPA 2 — INTERPRETAÇÃO ESTRUTURADA COM EXTRATORES DEDICADOS
  let extractedFields: Partial<CompanyBasicProfile> = {};
  let populatedLabels: string[] = [];
  let confidences: Record<string, FieldConfidence> = {};

  if (detectedType === 'cnpj') {
    extractedFields = cnpjCheck.fields;
    populatedLabels = cnpjCheck.populatedLabels;
    confidences = cnpjCheck.confidences;
  } else if (detectedType === 'cnh_socio' || detectedType === 'rg_socio') {
    extractedFields = cnhCheck.fields;
    populatedLabels = cnhCheck.populatedLabels;
    confidences = cnhCheck.confidences;
  } else {
    // Fallback genérico
    if (cnpjCheck.fields.cnpj) {
      extractedFields.cnpj = cnpjCheck.fields.cnpj;
      populatedLabels.push('CNPJ');
    }
    if (cnhCheck.fields.partnerCpf) {
      extractedFields.partnerCpf = cnhCheck.fields.partnerCpf;
      populatedLabels.push('CPF do Sócio');
    }
    if (cnhCheck.fields.partnerName) {
      extractedFields.partnerName = cnhCheck.fields.partnerName;
      populatedLabels.push('Nome do Sócio');
    }
  }

  // ETAPA 3 — DIVERGÊNCIA E CONFERÊNCIA
  let cnpjDivergenceWithCurrent = false;
  if (
    currentCompany?.cnpj &&
    extractedFields.cnpj &&
    onlyDigits(currentCompany.cnpj) !== onlyDigits(extractedFields.cnpj)
  ) {
    cnpjDivergenceWithCurrent = true;
  }

  let cnhDivergenceWithCurrent = false;
  if (
    currentCompany?.partnerCpf &&
    extractedFields.partnerCpf &&
    onlyDigits(currentCompany.partnerCpf) !== onlyDigits(extractedFields.partnerCpf)
  ) {
    cnhDivergenceWithCurrent = true;
  }

  const fieldItems = buildCompanyDocFieldItems(
    extractedFields,
    currentCompany || {},
    detectedType,
    confidences
  );

  let summary = '';
  if (populatedLabels.length > 0) {
    summary = `Identificado: ${detectedTitle}. Campos reconhecidos: ${populatedLabels.join(', ')}.`;
  } else {
    summary = `Documento anexado (${file.name}). Nenhum campo automático identificado com certeza; confira manualmente.`;
  }

  return {
    detectedType,
    detectedTitle,
    extractedFields,
    fieldItems,
    populatedFieldLabels: populatedLabels,
    summary,
    rawTextSample: normText.slice(0, 300),
    isCnhPartnerPriority,
    cnpjDivergenceWithCurrent,
    cnhDivergenceWithCurrent,
  };
}
