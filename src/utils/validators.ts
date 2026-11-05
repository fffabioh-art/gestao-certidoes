// ============================================================================
// BRAZILIAN DOCUMENT VALIDATORS (CNPJ, CPF, DATES & DUPLICATE FINGERPRINTS)
// ============================================================================

export function onlyDigits(val: string | undefined | null): string {
  return (val || '').replace(/\D+/g, '');
}

export function formatCNPJ(val: string | undefined | null): string {
  const digits = onlyDigits(val).slice(0, 14);
  if (digits.length !== 14) return val || '';
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

export function formatCPF(val: string | undefined | null): string {
  const digits = onlyDigits(val).slice(0, 11);
  if (digits.length !== 11) return val || '';
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export function formatCEP(val: string | undefined | null): string {
  const digits = onlyDigits(val).slice(0, 8);
  if (digits.length !== 8) return val || '';
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

export function formatPhone(val: string | undefined | null): string {
  const digits = onlyDigits(val).slice(0, 11);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  return val || '';
}

export const isValidCnpj = isValidCNPJ;
export const formatCnpj = formatCNPJ;
export const formatCep = formatCEP;
export const isValidCpf = isValidCPF;
export const formatCpf = formatCPF;

/**
 * Valida CNPJ matematicamente (14 dígitos + dígitos verificadores módulo 11).
 */
export function isValidCNPJ(raw: string | undefined | null): boolean {
  const cnpj = onlyDigits(raw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcDigit = (slice: string, weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += Number(slice[i]) * weights[i];
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcDigit(cnpj.slice(0, 12), w1);
  const d2 = calcDigit(cnpj.slice(0, 12) + String(d1), w2);

  return Number(cnpj[12]) === d1 && Number(cnpj[13]) === d2;
}

/**
 * Valida CPF matematicamente (11 dígitos + dígitos verificadores módulo 11).
 */
export function isValidCPF(raw: string | undefined | null): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(cpf[i]) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(cpf[i]) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  return rev === Number(cpf[10]);
}

/**
 * Converte datas brasileiras DD/MM/AAAA ou DD.MM.AAAA ou por extenso ("14 de setembro de 2026")
 * para ISO YYYY-MM-DD, validando se a data realmente existe no calendário.
 */
export function parseBrDateToISO(raw: string): string {
  if (!raw) return '';
  const clean = raw.trim();

  // Caso já seja YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    if (isValidCalendarDate(Number(y), Number(m), Number(d))) {
      return `${y}-${m}-${d}`;
    }
  }

  // Caso DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
  const brMatch = clean.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
  if (brMatch) {
    const d = Number(brMatch[1]);
    const m = Number(brMatch[2]);
    const y = Number(brMatch[3]);
    if (isValidCalendarDate(y, m, d)) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Caso por extenso: "14 de setembro de 2026"
  const months: Record<string, number> = {
    janeiro: 1,
    fevereiro: 2,
    marco: 3,
    março: 3,
    abril: 4,
    maio: 5,
    junho: 6,
    julho: 7,
    agosto: 8,
    setembro: 9,
    outubro: 10,
    novembro: 11,
    dezembro: 12,
  };
  const extMatch = clean
    .toLowerCase()
    .match(/\b(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})\b/);
  if (extMatch) {
    const d = Number(extMatch[1]);
    const m = months[extMatch[2]];
    const y = Number(extMatch[3]);
    if (m && isValidCalendarDate(y, m, d)) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return '';
}

export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1950 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const dt = new Date(year, month - 1, day);
  return (
    dt.getFullYear() === year &&
    dt.getMonth() === month - 1 &&
    dt.getDate() === day
  );
}

/**
 * Gera impressão digital (hash leve) para detectar documentos PDF duplicados.
 */
export function computeDocumentFingerprint(
  fileName: string,
  fileSize: number,
  controlCode?: string,
  issueDate?: string,
  templateKey?: string,
  cnpj?: string
): string {
  const normCode = (controlCode || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (normCode.length >= 6 && templateKey) {
    return `code:${onlyDigits(cnpj)}:${templateKey}:${normCode}:${issueDate || ''}`;
  }
  return `file:${fileName.toLowerCase().trim()}:${fileSize}:${issueDate || ''}`;
}
