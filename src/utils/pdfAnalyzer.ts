import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import Tesseract from 'tesseract.js';
import {
  onlyDigits,
  formatCNPJ,
  formatCPF,
  formatCEP,
  isValidCNPJ,
  isValidCPF,
  parseBrDateToISO,
} from './validators';
import { CompanyBasicProfile } from './portalAdapters';

// Configure PDF.js worker locally
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type DocumentCategoryType =
  | 'Fiscais e Trabalhistas'
  | 'Alvarás, Licenças e Conselhos'
  | 'Societário, Contábil e Qualificação Técnica';

export interface SmartExtractedDocument {
  documentTitle: string;
  matchedTemplateKey: string;
  category: DocumentCategoryType;
  issuer: string;
  issueDate: string;
  validityDays: number;
  expirationDate: string;
  isPermanent: boolean;
  certificateNumber: string;
  controlCode: string;
  documentSituation: string;
  summaryNotes: string;
  extractionEngine: 'pdfjs-local' | 'tesseract-ocr' | 'hybrid-gemini';
  rawTextSample: string;
  isUnreadable: boolean;
  warnings: string[];
  cnpjValid: boolean | null;
  companyData: Partial<CompanyBasicProfile>;
}

function addDaysISO(dateStr: string, days: number): string {
  if (!dateStr || isNaN(days) || days <= 0) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return '';
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  dt.setDate(dt.getDate() + Number(days));
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function diffDaysISO(startISO: string, endISO: string): number {
  if (!startISO || !endISO) return 0;
  const p1 = startISO.split('-').map(Number);
  const p2 = endISO.split('-').map(Number);
  if (p1.length !== 3 || p2.length !== 3) return 0;
  const d1 = new Date(p1[0], p1[1] - 1, p1[2]).getTime();
  const d2 = new Date(p2[0], p2[1] - 1, p2[2]).getTime();
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

// ============================================================================
// STEP 1: EXTRACT TEXT LOCALLY FROM PDF (PDF.JS) OR SCANNED IMAGE (TESSERACT)
// ============================================================================

export async function extractTextLocallyFromFile(
  file: File,
  onProgress?: (statusText: string) => void
): Promise<{ text: string; engine: 'pdfjs-local' | 'tesseract-ocr' }> {
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    onProgress?.('Extraindo texto do PDF com PDF.js (processamento local gratuito)...');
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 12);

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageLines: string[] = [];
      let lastY: number | null = null;
      let currentLine = '';

      for (const item of textContent.items) {
        if ('str' in item) {
          const y = Array.isArray(item.transform) ? item.transform[5] : null;
          if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
            if (currentLine.trim()) pageLines.push(currentLine.trim());
            currentLine = item.str;
          } else {
            currentLine += (currentLine.endsWith(' ') || !currentLine ? '' : ' ') + item.str;
          }
          if (y !== null) lastY = y;
        }
      }
      if (currentLine.trim()) pageLines.push(currentLine.trim());
      fullText += pageLines.join('\n') + '\n\n';
    }

    const cleaned = fullText.trim();
    if (cleaned.length >= 35) {
      return { text: cleaned, engine: 'pdfjs-local' };
    }

    // Se o PDF for digitalizado (imagem escaneada sem camada de texto), renderiza a 1ª página e usa Tesseract OCR!
    onProgress?.('PDF digitalizado detectado: executando OCR local com Tesseract.js...');
    try {
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        const ocrResult = await Tesseract.recognize(canvas, 'por');
        return {
          text: (ocrResult.data.text || '').trim(),
          engine: 'tesseract-ocr',
        };
      }
    } catch (ocrErr) {
      console.warn('Falha no OCR de PDF digitalizado:', ocrErr);
    }

    return { text: cleaned, engine: 'pdfjs-local' };
  }

  // Caso seja imagem (PNG, JPG, WEBP)
  onProgress?.('Executando OCR local na imagem com Tesseract.js...');
  const ocrResult = await Tesseract.recognize(file, 'por');
  return {
    text: (ocrResult.data.text || '').trim(),
    engine: 'tesseract-ocr',
  };
}

// ============================================================================
// STEP 2: LOCAL RULES & REGEX PARSER FOR BRAZILIAN & PIAUÍ CERTIFICATES
// ============================================================================

interface CertificateRuleSpec {
  templateKey: string;
  title: string;
  category: DocumentCategoryType;
  issuer: string;
  defaultValidityDays: number;
  isPermanent?: boolean;
  keywords: RegExp[];
}

const CERTIFICATE_RULES: CertificateRuleSpec[] = [
  {
    templateKey: 'tpl-01-cndt',
    title: 'CNDT (Certidão Negativa de Débitos Trabalhistas)',
    category: 'Fiscais e Trabalhistas',
    issuer: 'TST - Tribunal Superior do Trabalho',
    defaultValidityDays: 180,
    keywords: [
      /certid[aã]o\s+negativa\s+de\s+d[eé]bitos\s+trabalhistas/i,
      /certid[aã]o\s+positiva\s+de\s+d[eé]bitos\s+trabalhistas/i,
      /\bcndt\b/i,
      /poder\s+judici[aá]rio\s+justi[cç]a\s+do\s+trabalho/i,
    ],
  },
  {
    templateKey: 'tpl-02-cnpj',
    title: 'Cartão CNPJ (Comprovante de Inscrição e Situação Cadastral)',
    category: 'Fiscais e Trabalhistas',
    issuer: 'Receita Federal',
    defaultValidityDays: 90,
    keywords: [
      /comprovante\s+de\s+inscri[cç][aã]o\s+e\s+de\s+situa[cç][aã]o\s+cadastral/i,
      /cadastro\s+nacional\s+da\s+pessoa\s+jur[ií]dica/i,
    ],
  },
  {
    templateKey: 'tpl-03-cnd-federal',
    title: 'Dívida Ativa da União (CND Federal Conjunta RFB/PGFN)',
    category: 'Fiscais e Trabalhistas',
    issuer: 'Receita Federal / PGFN',
    defaultValidityDays: 180,
    keywords: [
      /cr[eé]ditos\s+tribut[aá]rios\s+federais\s+e\s+[aà]\s+d[ií]vida\s+ativa\s+da\s+uni[aã]o/i,
      /procuradoria[- ]geral\s+da\s+fazenda\s+nacional/i,
      /secretaria\s+especial\s+da\s+receita\s+federal/i,
    ],
  },
  {
    templateKey: 'tpl-04-pge-pi',
    title: 'Dívida Ativa do Estado do Piauí (PGE-PI / SEFAZ-PI)',
    category: 'Fiscais e Trabalhistas',
    issuer: 'SEFAZ-PI / PGE-PI',
    defaultValidityDays: 60,
    keywords: [
      /certid[aã]o\s+negativa\s+da\s+d[ií]vida\s+ativa\s+estadual/i,
      /certid[aã]o\s+de\s+d[ií]vida\s+ativa\s+do\s+estado/i,
      /procuradoria\s+geral\s+do\s+estado\s+do\s+piau[ií]/i,
    ],
  },
  {
    templateKey: 'tpl-05-sefaz-pi',
    title: 'Certidão Fiscal e Tributária Estadual (SEFAZ-PI)',
    category: 'Fiscais e Trabalhistas',
    issuer: 'SEFAZ-PI (Secretaria da Fazenda do Piauí)',
    defaultValidityDays: 60,
    keywords: [
      /situa[cç][aã]o\s+fiscal\s+e\s+tribut[aá]ria/i,
      /secretaria\s+da\s+fazenda\s+do\s+estado\s+do\s+piau[ií]/i,
      /sefaz[- /]*pi/i,
    ],
  },
  {
    templateKey: 'tpl-06-prefeitura-pi',
    title: 'Dívida Ativa do Município (CND Municipal / ISS)',
    category: 'Fiscais e Trabalhistas',
    issuer: 'Prefeitura Municipal (SEMF Teresina / PI)',
    defaultValidityDays: 90,
    keywords: [
      /secretaria\s+municipal\s+de\s+finan[cç]as/i,
      /certid[aã]o\s+negativa\s+de\s+d[eé]bitos\s+municipais/i,
      /tributos\s+municipais/i,
      /d[ií]vida\s+ativa\s+do\s+munic[ií]pio/i,
      /\bsemf\b/i,
    ],
  },
  {
    templateKey: 'tpl-07-falencia-tjpi',
    title: 'Certidão Negativa de Falência e Concordata (TJPI)',
    category: 'Fiscais e Trabalhistas',
    issuer: 'TJPI - Tribunal de Justiça do Piauí',
    defaultValidityDays: 90,
    keywords: [
      /fal[eê]ncia.*concordata/i,
      /recupera[cç][aã]o\s+judicial/i,
      /tribunal\s+de\s+justi[cç]a\s+do\s+estado\s+do\s+piau[ií]/i,
      /\btjpi\b/i,
    ],
  },
  {
    templateKey: 'tpl-08-fgts',
    title: 'CRF - Certificado de Regularidade do FGTS',
    category: 'Fiscais e Trabalhistas',
    issuer: 'Caixa Econômica Federal',
    defaultValidityDays: 30,
    keywords: [
      /certificado\s+de\s+regularidade\s+do\s+fgts/i,
      /fundo\s+de\s+garantia\s+do\s+tempo\s+de\s+servi[cç]o/i,
      /\bcrf\b.*caixa/i,
    ],
  },
  {
    templateKey: 'tpl-09-jucepi',
    title: 'Certidão Simplificada e Específica (JUCEPI - Junta Comercial PI)',
    category: 'Fiscais e Trabalhistas',
    issuer: 'JUCEPI - Junta Comercial do Estado do Piauí',
    defaultValidityDays: 90,
    keywords: [
      /certid[aã]o\s+simplificada/i,
      /certid[aã]o\s+espec[ií]fica/i,
      /junta\s+comercial\s+do\s+estado\s+do\s+piau[ií]/i,
      /\bjucepi\b/i,
    ],
  },
  {
    templateKey: 'tpl-10-alvara',
    title: 'Alvará de Funcionamento',
    category: 'Alvarás, Licenças e Conselhos',
    issuer: 'Prefeitura Municipal (Teresina / PI)',
    defaultValidityDays: 365,
    keywords: [
      /alvar[aá]\s+de\s+funcionamento/i,
      /alvar[aá]\s+de\s+localiza[cç][aã]o/i,
    ],
  },
  {
    templateKey: 'tpl-11-bombeiros-pi',
    title: 'Licença / Certificado do Corpo de Bombeiros (CBMEPI)',
    category: 'Alvarás, Licenças e Conselhos',
    issuer: 'CBMEPI - Corpo de Bombeiros Militar do Piauí',
    defaultValidityDays: 365,
    keywords: [
      /corpo\s+de\s+bombeiros/i,
      /\bcbmepi\b/i,
      /atestado\s+de\s+regularidade.*bombeiros/i,
      /avcb/i,
    ],
  },
  {
    templateKey: 'tpl-12-ambiental-pi',
    title: 'Licença Ambiental (SEMARH-PI / Secretaria Municipal)',
    category: 'Alvarás, Licenças e Conselhos',
    issuer: 'Órgão Ambiental (SEMARH-PI / SEMAM)',
    defaultValidityDays: 365,
    keywords: [
      /licen[cç]a\s+ambiental/i,
      /licen[cç]a\s+de\s+opera[cç][aã]o/i,
      /\bsemarh\b/i,
      /\bsemam\b/i,
    ],
  },
  {
    templateKey: 'tpl-13-vigilancia-pi',
    title: 'Licença / Alvará de Vigilância Sanitária (DIVISA-PI / GVS)',
    category: 'Alvarás, Licenças e Conselhos',
    issuer: 'Vigilância Sanitária (DIVISA-PI / GVS Teresina)',
    defaultValidityDays: 365,
    keywords: [
      /vigil[aâ]ncia\s+sanit[aá]ria/i,
      /alvar[aá]\s+sanit[aá]rio/i,
      /licen[cç]a\s+sanit[aá]ria/i,
      /\bdivisa\b/i,
    ],
  },
  {
    templateKey: 'tpl-14-aft',
    title: 'AFT (Autorização de Funcionamento / Atestado)',
    category: 'Alvarás, Licenças e Conselhos',
    issuer: 'ANVISA / Órgão Regulador',
    defaultValidityDays: 365,
    keywords: [
      /autoriza[cç][aã]o\s+de\s+funcionamento/i,
      /\banvisa\b/i,
    ],
  },
  {
    templateKey: 'tpl-15-conselho',
    title: 'Certidão de Quitação e Regularidade (Conselho - CRQ/CRBio/CREA-PI)',
    category: 'Alvarás, Licenças e Conselhos',
    issuer: 'Conselho de Classe (CRQ / CRBio / CREA-PI)',
    defaultValidityDays: 365,
    keywords: [
      /conselho\s+regional\s+de\s+engenharia/i,
      /conselho\s+regional\s+de\s+qu[ií]mica/i,
      /conselho\s+regional\s+de\s+biologia/i,
      /certid[aã]o\s+de\s+registro\s+e\s+quita[cç][aã]o/i,
      /\bcrea[- ]*pi\b/i,
    ],
  },
  {
    templateKey: 'tpl-16-trt-art',
    title: 'CTD de Anotação Técnica e Termo de Responsabilidade Técnica (TRT/ART)',
    category: 'Alvarás, Licenças e Conselhos',
    issuer: 'Conselho de Classe (CRQ / CRBio / CREA-PI)',
    defaultValidityDays: 365,
    keywords: [
      /anota[cç][aã]o\s+de\s+responsabilidade\s+t[eé]cnica/i,
      /termo\s+de\s+responsabilidade\s+t[eé]cnica/i,
      /certid[aã]o\s+de\s+acervo\s+t[eé]cnico/i,
    ],
  },
  {
    templateKey: 'tpl-18-contrato-social',
    title: 'Contrato Social e Aditivo Assinado',
    category: 'Societário, Contábil e Qualificação Técnica',
    issuer: 'JUCEPI - Junta Comercial do Estado do Piauí',
    defaultValidityDays: 0,
    isPermanent: true,
    keywords: [
      /contrato\s+social/i,
      /altera[cç][aã]o\s+contratual/i,
      /consolida[cç][aã]o\s+contratual/i,
    ],
  },
  {
    templateKey: 'tpl-19-qsa',
    title: 'QSA (Quadro de Sócios e Administradores)',
    category: 'Societário, Contábil e Qualificação Técnica',
    issuer: 'Receita Federal / Redesim',
    defaultValidityDays: 0,
    isPermanent: true,
    keywords: [
      /quadro\s+de\s+s[oó]cios\s+e\s+administradores/i,
      /\bqsa\b/i,
    ],
  },
  {
    templateKey: 'tpl-20-cnh',
    title: 'CNH-e (Sócios / Representantes)',
    category: 'Societário, Contábil e Qualificação Técnica',
    issuer: 'DETRAN-PI / SENATRAN',
    defaultValidityDays: 1825,
    keywords: [
      /carteira\s+nacional\s+de\s+habilita[cç][aã]o/i,
      /\bcnh\b/i,
      /senatran/i,
    ],
  },
  {
    templateKey: 'tpl-21-ie-im',
    title: 'Inscrição Estadual (IE - SEFAZ-PI) e Inscrição Municipal (IM)',
    category: 'Societário, Contábil e Qualificação Técnica',
    issuer: 'SEFAZ-PI / Prefeitura Municipal',
    defaultValidityDays: 0,
    isPermanent: true,
    keywords: [
      /sintegra/i,
      /ficha\s+de\s+inscri[cç][aã]o\s+cadastral/i,
      /cadastro\s+mercantil\s+de\s+contribuintes/i,
    ],
  },
  {
    templateKey: 'tpl-22-balanco',
    title: 'Balanços Patrimoniais e Índices Contábeis',
    category: 'Societário, Contábil e Qualificação Técnica',
    issuer: 'Contabilidade / SPED ECD / JUCEPI',
    defaultValidityDays: 365,
    keywords: [
      /balan[cç]o\s+patrimonial/i,
      /demonstra[cç][aã]o\s+do\s+resultado\s+do\s+exerc[ií]cio/i,
      /sped\s+cont[aá]bil/i,
    ],
  },
  {
    templateKey: 'tpl-23-atestados',
    title: 'Atestados de Capacidade Técnica',
    category: 'Societário, Contábil e Qualificação Técnica',
    issuer: 'Clientes Contratantes / Acervo Técnico',
    defaultValidityDays: 0,
    isPermanent: true,
    keywords: [
      /atestado\s+de\s+capacidade\s+t[eé]cnica/i,
    ],
  },
];

export function parseDocumentTextLocally(
  rawText: string,
  fileName: string,
  registeredCompanies: CompanyBasicProfile[],
  engine: 'pdfjs-local' | 'tesseract-ocr'
): SmartExtractedDocument {
  const warnings: string[] = [];
  const text = rawText.replace(/\r/g, '\n');
  const normText = text.replace(/[ \t]+/g, ' ');

  if (!normText || normText.trim().length < 20) {
    warnings.push(
      'O arquivo PDF parece ilegível, protegido ou não contém texto reconhecível. Confira os campos manualmente.'
    );
  }

  // 1. Identificar Tipo de Certidão pelas regras (Texto + Nome do Arquivo)
  const combinedForClassification = `${normText}\n${fileName}`;
  let matchedRule: CertificateRuleSpec | null = null;

  // Se for Cartão CNPJ mas também tiver QSA explícito, diferencia
  for (const rule of CERTIFICATE_RULES) {
    if (rule.keywords.some((rx) => rx.test(combinedForClassification))) {
      matchedRule = rule;
      break;
    }
  }

  // 2. Extrair CNPJs e validar dígitos verificadores
  const cnpjMatches = Array.from(
    normText.matchAll(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g)
  ).map((m) => m[0]);

  const validCnpjs: string[] = [];
  let hasInvalidCnpjInText = false;

  for (const rawCnpj of cnpjMatches) {
    const digits = onlyDigits(rawCnpj);
    if (digits.length === 14) {
      if (isValidCNPJ(digits)) {
        const fmt = formatCNPJ(digits);
        if (!validCnpjs.includes(fmt)) validCnpjs.push(fmt);
      } else {
        hasInvalidCnpjInText = true;
      }
    }
  }

  // Priorizar CNPJ que já pertence a alguma empresa cadastrada no Mago das Licitações
  let chosenCnpj = '';
  for (const candidate of validCnpjs) {
    const matchComp = registeredCompanies.find(
      (c) => onlyDigits(c.cnpj) === onlyDigits(candidate)
    );
    if (matchComp) {
      chosenCnpj = formatCNPJ(matchComp.cnpj);
      break;
    }
  }
  if (!chosenCnpj && validCnpjs.length > 0) {
    chosenCnpj = validCnpjs[0];
  }

  if (!chosenCnpj && hasInvalidCnpjInText) {
    warnings.push(
      'Foi encontrado um número com formato de CNPJ no documento, porém os dígitos verificadores são inválidos.'
    );
  }

  // 3. Extrair CPFs válidos
  const cpfMatches = Array.from(
    normText.matchAll(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g)
  ).map((m) => m[0]);
  const validCpfs = cpfMatches.filter((c) => isValidCPF(c)).map((c) => formatCPF(c));

  // 4. Extrair Razão Social e Nome Fantasia
  let companyName = '';
  const razaoPatterns = [
    /(?:NOME\s+EMPRESARIAL|RAZ[AÃ]O\s+SOCIAL|CONTRIBUINTE|NOME\s*\/\s*RAZ[AÃ]O\s+SOCIAL|EMPRESA|INTERESSADO)\s*[:\-]?\s*([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 .,&/\-]{3,85}?)(?=\n|CNPJ|CPF|INSCRI|ENDERE|TÍTULO|NOME\s+FANTASIA|$)/i,
  ];
  for (const rx of razaoPatterns) {
    const m = normText.match(rx);
    if (m && m[1]) {
      const candidate = m[1].trim().replace(/\s{2,}/g, ' ');
      if (
        candidate.length >= 4 &&
        !/REP[UÚ]BLICA|MINIST[EÉ]RIO|SECRETARIA|TRIBUNAL|PREFEITURA/i.test(candidate)
      ) {
        companyName = candidate;
        break;
      }
    }
  }

  // Se já conhecemos a empresa pelo CNPJ, podemos usar a razão social caso não extraída
  if (!companyName && chosenCnpj) {
    const known = registeredCompanies.find(
      (c) => onlyDigits(c.cnpj) === onlyDigits(chosenCnpj)
    );
    if (known) companyName = known.companyName;
  }

  let tradeName = '';
  const fantasiaMatch = normText.match(
    /(?:T[IÍ]TULO\s+DO\s+ESTABELECIMENTO\s*\(NOME\s+DE\s+FANTASIA\)|NOME\s+DE\s+FANTASIA|NOME\s+FANTASIA)\s*[:\-]?\s*([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 .,&/\-]{2,70}?)(?=\n|PORTE|CÓDIGO|ATIVIDADE|CNPJ|$)/i
  );
  if (fantasiaMatch && fantasiaMatch[1] && !/\*{3,}/.test(fantasiaMatch[1])) {
    tradeName = fantasiaMatch[1].trim();
  }

  // 5. Extrair Inscrição Estadual (IE), Inscrição Municipal (IM/CMC) e NIRE
  let stateRegistration = '';
  const ieMatch = normText.match(
    /(?:INSCRI[CÇ][AÃ]O\s+ESTADUAL|I\.?\s*E\.?|CGF)\s*[:\-º°]?\s*([\d.\-]{7,15})/i
  );
  if (ieMatch && ieMatch[1]) {
    stateRegistration = ieMatch[1].trim();
  }

  let municipalRegistration = '';
  const imMatch = normText.match(
    /(?:INSCRI[CÇ][AÃ]O\s+MUNICIPAL|C\.?\s*M\.?\s*C\.?|CADASTRO\s+MERCANTIL)\s*[:\-º°]?\s*([\d.\-]{4,14})/i
  );
  if (imMatch && imMatch[1]) {
    municipalRegistration = imMatch[1].trim();
  }

  let nire = '';
  const nireMatch = normText.match(/\bNIRE\s*[:\-º°]?\s*(22\d{9}|\d{11})\b/i);
  if (nireMatch && nireMatch[1]) {
    nire = nireMatch[1].trim();
  }

  // 6. Extrair CNAE, CEP, Endereço, Município/UF, E-mail, Telefone, Representante
  let cnaeMain = '';
  const cnaeMatch = normText.match(
    /(\d{2}\.\d{2}-\d-\d{2}\s*-\s*[^\n]{5,90})/
  );
  if (cnaeMatch && cnaeMatch[1]) {
    cnaeMain = cnaeMatch[1].trim();
  }

  let cep = '';
  const cepMatch = normText.match(/\b(64\d{3}-?\d{3}|\d{2}\.?\d{3}-\d{3})\b/);
  if (cepMatch && cepMatch[1]) {
    cep = formatCEP(cepMatch[1]);
  }

  let email = '';
  const emailMatch = normText.match(
    /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/
  );
  if (emailMatch && emailMatch[1] && !/gov\.br|jus\.br/i.test(emailMatch[1])) {
    email = emailMatch[1].toLowerCase();
  }

  let phone = '';
  const phoneMatch = normText.match(/(\(\d{2}\)\s*\d{4,5}-?\d{4})/);
  if (phoneMatch && phoneMatch[1]) {
    phone = phoneMatch[1].trim();
  }

  let cityState = '';
  if (/TERESINA/i.test(normText)) {
    cityState = 'Teresina - PI';
  } else if (/PARNA[IÍ]BA/i.test(normText)) {
    cityState = 'Parnaíba - PI';
  } else if (/PICOS/i.test(normText)) {
    cityState = 'Picos - PI';
  } else if (/FLORIANO/i.test(normText)) {
    cityState = 'Floriano - PI';
  }

  let partnerName = '';
  const socioMatch = normText.match(
    /(?:S[OÓ]CIO[- ]*ADMINISTRADOR|REPRESENTANTE\s+LEGAL|ADMINISTRADOR)\s*[:\-]?\s*([A-ZÀ-Ú][A-ZÀ-Ú ]{5,60})(?=\n|CPF|,|$)/i
  );
  if (socioMatch && socioMatch[1]) {
    partnerName = socioMatch[1].trim();
  }

  // 7. Extrair Datas (Emissão, Vencimento e Prazo de Validade)
  let issueDate = '';
  let expirationDate = '';
  let validityDays = matchedRule?.defaultValidityDays ?? 90;

  const issueRegexes = [
    /(?:DATA\s+DE\s+EMISS[AÃ]O|EMITIDA?\s+EM|EXPEDI[CÇ][AÃ]O|EMISS[AÃ]O|DATA\s+DA\s+CONSULTA)\s*[:\-]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i,
    /(?:EMITIDA?\s+EM|TERESINA\s*,|BRAS[IÍ]LIA\s*,)\s*(\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4})/i,
  ];
  for (const rx of issueRegexes) {
    const m = normText.match(rx);
    if (m && m[1]) {
      const parsed = parseBrDateToISO(m[1]);
      if (parsed) {
        issueDate = parsed;
        break;
      }
    }
  }

  const expRegexes = [
    /(?:V[AÁ]LIDA?\s+AT[EÉ]|DATA\s+DE\s+VALIDADE|VALIDADE\s*AT[EÉ]?|VENCIMENTO|EXPIRA\s+EM)\s*[:\-]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i,
    /VALIDADE\s*:\s*\d{1,2}[/.-]\d{1,2}[/.-]\d{4}\s*a\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i,
  ];
  for (const rx of expRegexes) {
    const m = normText.match(rx);
    if (m && m[1]) {
      const parsed = parseBrDateToISO(m[1]);
      if (parsed) {
        expirationDate = parsed;
        break;
      }
    }
  }

  // Caso especial FGTS: "Validade: 02/07/2026 a 01/08/2026"
  const fgtsPeriodMatch = normText.match(
    /VALIDADE\s*:\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s*(?:A|AT[EÉ])\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i
  );
  if (fgtsPeriodMatch) {
    const d1 = parseBrDateToISO(fgtsPeriodMatch[1]);
    const d2 = parseBrDateToISO(fgtsPeriodMatch[2]);
    if (d1 && !issueDate) issueDate = d1;
    if (d2) expirationDate = d2;
  }

  // Extrair prazo explícito em dias no texto (ex: "válida por 180 dias", "validade de 60 dias")
  const validityMatch = normText.match(
    /(?:V[AÁ]LIDA?\s+POR|PRAZO\s+DE\s+VALIDADE\s+DE|VALIDADE\s+DE)\s*(\d{1,3})\s*(?:\([a-zç ]+\)\s*)?DIAS/i
  );
  if (validityMatch && validityMatch[1]) {
    const daysNum = Number(validityMatch[1]);
    if (daysNum > 0 && daysNum <= 3650) {
      validityDays = daysNum;
    }
  }

  // Se não achou issueDate com label específico, procura todas as datas no texto
  if (!issueDate && !expirationDate) {
    const allDates = Array.from(
      normText.matchAll(/\b(\d{2}[/.-]\d{2}[/.-]\d{4})\b/g)
    )
      .map((m) => parseBrDateToISO(m[1]))
      .filter(Boolean);

    if (allDates.length >= 2) {
      const sorted = [...new Set(allDates)].sort();
      issueDate = sorted[0];
      expirationDate = sorted[sorted.length - 1];
    } else if (allDates.length === 1) {
      issueDate = allDates[0];
    }
  }

  const isPermanent = Boolean(matchedRule?.isPermanent);

  // Calcula vencimento automático se tiver emissão + prazo
  if (!isPermanent && issueDate && !expirationDate && validityDays > 0) {
    expirationDate = addDaysISO(issueDate, validityDays);
  }

  // Se tiver emissão e vencimento, recalcula validityDays real
  if (!isPermanent && issueDate && expirationDate) {
    const diff = diffDaysISO(issueDate, expirationDate);
    if (diff < 0) {
      warnings.push(
        `Atenção: A data de vencimento (${expirationDate}) parece anterior à data de emissão (${issueDate}). Confira as datas antes de salvar.`
      );
    } else if (diff > 0) {
      validityDays = diff;
    }
  }

  // 8. Extrair Número da Certidão e Código de Autenticidade / Controle
  let certificateNumber = '';
  const certNumMatch = normText.match(
    /(?:CERTID[AÃ]O\s+N[º°o.]*|N[UÚ]MERO\s+DA\s+CERTID[AÃ]O|CERTIFICADO\s+N[º°o.]*|LICEN[CÇ]A\s+N[º°o.]*)\s*[:\-]?\s*([A-Z0-9./\-]{4,30})/i
  );
  if (certNumMatch && certNumMatch[1]) {
    certificateNumber = certNumMatch[1].trim();
  }

  let controlCode = '';
  const controlPatterns = [
    /(?:C[OÓ]DIGO\s+DE\s+CONTROLE(?:\s+DA\s+CERTID[AÃ]O)?|C[OÓ]DIGO\s+DE\s+AUTENTICIDADE|CHAVE\s+DE\s+AUTENTICIDADE|C[OÓ]DIGO\s+DE\s+VALIDA[CÇ][AÃ]O|SELO\s+DIGITAL)\s*[:\-]?\s*([A-Z0-9]{4}(?:[.\-][A-Z0-9]{4}){2,4}|[A-Z0-9.\-]{6,32})/i,
    /\b([A-F0-9]{4}\.[A-F0-9]{4}\.[A-F0-9]{4}\.[A-F0-9]{4})\b/i,
  ];
  for (const rx of controlPatterns) {
    const m = normText.match(rx);
    if (m && m[1]) {
      controlCode = m[1].trim();
      break;
    }
  }
  if (!controlCode && certificateNumber) {
    controlCode = certificateNumber;
  }

  // 9. Identificar Situação Descrita no Documento
  let documentSituation = 'Regular / Vigente';
  if (/POSITIVA\s+COM\s+EFEITOS?\s+DE\s+NEGATIVA/i.test(normText)) {
    documentSituation = 'Certidão Positiva com Efeitos de Negativa (Regular)';
  } else if (/CERTID[AÃ]O\s+NEGATIVA|N[AÃ]O\s+CONSTA(?:M)?\s+D[EÉ]BITOS/i.test(normText)) {
    documentSituation = 'Certidão Negativa (Sem Pendências)';
  } else if (/SITUA[CÇ][AÃ]O\s+CADASTRAL\s*[:\-]?\s*ATIVA/i.test(normText)) {
    documentSituation = 'Situação Cadastral: ATIVA';
  } else if (/ENCONTRA[- ]SE\s+EM\s+SITUA[CÇ][AÃ]O\s+REGULAR/i.test(normText)) {
    documentSituation = 'Em Situação Regular perante o Órgão';
  } else if (/CERTID[AÃ]O\s+POSITIVA/i.test(normText)) {
    documentSituation = 'Atenção: Certidão Positiva';
    warnings.push('O texto do documento menciona "Certidão Positiva". Verifique a situação.');
  }

  const summaryParts = [
    documentSituation,
    certificateNumber ? `Nº: ${certificateNumber}` : '',
    controlCode && controlCode !== certificateNumber ? `Autenticidade: ${controlCode}` : '',
  ].filter(Boolean);

  return {
    documentTitle:
      matchedRule?.title || fileName.replace(/\.[^.]+$/, '') || 'Documento Empresarial',
    matchedTemplateKey: matchedRule?.templateKey || '',
    category: matchedRule?.category || 'Fiscais e Trabalhistas',
    issuer: matchedRule?.issuer || 'Órgão Identificado no PDF',
    issueDate,
    validityDays: isPermanent ? 0 : validityDays,
    expirationDate: isPermanent ? '' : expirationDate,
    isPermanent,
    certificateNumber,
    controlCode,
    documentSituation,
    summaryNotes: summaryParts.join(' · '),
    extractionEngine: engine,
    rawTextSample: normText.slice(0, 600),
    isUnreadable: normText.trim().length < 20,
    warnings,
    cnpjValid: chosenCnpj ? isValidCNPJ(chosenCnpj) : null,
    companyData: {
      companyName: companyName || undefined,
      tradeName: tradeName || undefined,
      cnpj: chosenCnpj || undefined,
      stateRegistration: stateRegistration || undefined,
      municipalRegistration: municipalRegistration || undefined,
      nire: nire || undefined,
      cnaeMain: cnaeMain || undefined,
      cep: cep || undefined,
      cityState: cityState || undefined,
      email: email || undefined,
      phone: phone || undefined,
      partnerName: partnerName || undefined,
      partnerCpf: validCpfs[0] || undefined,
    },
  };
}

// ============================================================================
// STEP 3: HYBRID ANALYZER (FREE LOCAL FIRST + OPTIONAL GEMINI COMPLEMENT)
// ============================================================================

export async function analyzeDocumentSmart(
  file: File,
  dataUrl: string,
  registeredCompanies: CompanyBasicProfile[],
  options?: {
    useGeminiComplement?: boolean;
    mode?: 'certificate' | 'company_profile' | 'auto_match';
    onProgress?: (msg: string) => void;
  }
): Promise<SmartExtractedDocument> {
  // 1. Extração 100% Gratuita e Local via PDF.js / Tesseract.js
  const { text, engine } = await extractTextLocallyFromFile(file, options?.onProgress);
  const localParsed = parseDocumentTextLocally(text, file.name, registeredCompanies, engine);

  // 2. Complemento opcional com Gemini (apenas se solicitado ou se faltar dado crítico e a API estiver disponível)
  const needsComplement =
    options?.useGeminiComplement ||
    localParsed.isUnreadable ||
    (!localParsed.matchedTemplateKey && !localParsed.issueDate && !localParsed.companyData.cnpj);

  if (needsComplement) {
    try {
      options?.onProgress?.('Complementando leitura com análise inteligente (IA)...');
      const res = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataUrl,
          fileName: file.name,
          mode: options?.mode || 'auto_match',
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const aiData = json.data;
        if (aiData) {
          const aiCnpj = aiData.companyData?.cnpj
            ? formatCNPJ(aiData.companyData.cnpj)
            : '';
          const finalCnpj =
            localParsed.companyData.cnpj ||
            (aiCnpj && isValidCNPJ(aiCnpj) ? aiCnpj : aiCnpj);

          const mergedIssue = localParsed.issueDate || aiData.issueDate || '';
          const mergedExp = localParsed.expirationDate || aiData.expirationDate || '';
          const mergedValidity =
            localParsed.validityDays || aiData.validityDays || 90;

          return {
            ...localParsed,
            documentTitle:
              localParsed.matchedTemplateKey
                ? localParsed.documentTitle
                : aiData.documentTitle || localParsed.documentTitle,
            matchedTemplateKey:
              localParsed.matchedTemplateKey || aiData.matchedTemplateKey || '',
            category: aiData.category || localParsed.category,
            issuer:
              localParsed.matchedTemplateKey
                ? localParsed.issuer
                : aiData.issuer || localParsed.issuer,
            issueDate: mergedIssue,
            validityDays: mergedValidity,
            expirationDate: mergedExp,
            isPermanent:
              localParsed.isPermanent || Boolean(aiData.isPermanent),
            certificateNumber:
              localParsed.certificateNumber || aiData.certificateNumber || '',
            controlCode:
              localParsed.controlCode || aiData.controlCode || '',
            documentSituation:
              aiData.documentSituation || localParsed.documentSituation,
            summaryNotes:
              aiData.summaryNotes || localParsed.summaryNotes,
            extractionEngine: 'hybrid-gemini',
            isUnreadable:
              localParsed.isUnreadable && !mergedIssue && !finalCnpj,
            cnpjValid: finalCnpj ? isValidCNPJ(finalCnpj) : null,
            companyData: {
              companyName:
                localParsed.companyData.companyName || aiData.companyData?.companyName,
              tradeName:
                localParsed.companyData.tradeName || aiData.companyData?.tradeName,
              cnpj: finalCnpj || undefined,
              stateRegistration:
                localParsed.companyData.stateRegistration ||
                aiData.companyData?.stateRegistration,
              municipalRegistration:
                localParsed.companyData.municipalRegistration ||
                aiData.companyData?.municipalRegistration,
              nire: localParsed.companyData.nire || aiData.companyData?.nire,
              cnaeMain:
                localParsed.companyData.cnaeMain || aiData.companyData?.cnaeMain,
              cityState:
                localParsed.companyData.cityState || aiData.companyData?.cityState,
              cep: localParsed.companyData.cep || aiData.companyData?.cep,
              address:
                localParsed.companyData.address || aiData.companyData?.address,
              email: localParsed.companyData.email || aiData.companyData?.email,
              phone: localParsed.companyData.phone || aiData.companyData?.phone,
              partnerName:
                localParsed.companyData.partnerName || aiData.companyData?.partnerName,
              partnerCpf:
                localParsed.companyData.partnerCpf || aiData.companyData?.partnerCpf,
              techResponsibleName:
                localParsed.companyData.techResponsibleName ||
                aiData.companyData?.techResponsibleName,
              techResponsibleCouncil:
                localParsed.companyData.techResponsibleCouncil ||
                aiData.companyData?.techResponsibleCouncil,
            },
          };
        }
      }
    } catch {
      // Silenciosamente mantém o resultado gratuito local caso a API não esteja configurada
    }
  }

  return localParsed;
}
