import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Clock,
  FileWarning,
  Building2,
  Zap,
  RefreshCw,
  Upload,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { CertidaoDocument, CompanyProfile, ComputedStatus } from '../types/domain';
import { isValidCNPJ, isValidCPF } from '../utils/validators';
import { buildCleanTargetUrl } from '../utils/portalAdapters';

interface EnrichedDocItem {
  doc: CertidaoDocument;
  company: CompanyProfile;
  eval: {
    status: ComputedStatus;
    daysRemaining: number | null;
    label: string;
    countdownText: string;
  };
}

interface PendenciasCenterViewProps {
  enrichedDocuments: EnrichedDocItem[];
  companies: CompanyProfile[];
  warningThresholdDays: number;
  onStartAssistedEmission: (doc: CertidaoDocument, comp: CompanyProfile) => void;
  onOpenQuickRenew: (doc: CertidaoDocument) => void;
  onAttachFileToDoc: (docId: string, file: File) => void;
  onApproveReviewDoc: (docId: string) => void;
  onGoToCompanyDb: (companyId: string) => void;
}

export const PendenciasCenterView: React.FC<PendenciasCenterViewProps> = ({
  enrichedDocuments,
  companies,
  warningThresholdDays,
  onStartAssistedEmission,
  onOpenQuickRenew,
  onAttachFileToDoc,
  onApproveReviewDoc,
  onGoToCompanyDb,
}) => {
  const vencidos = enrichedDocuments.filter((i) => i.eval.status === 'vencido');
  const aVencer = enrichedDocuments.filter((i) => i.eval.status === 'atencao');
  const semData = enrichedDocuments.filter((i) => i.eval.status === 'sem_data');
  const aguardandoConferencia = enrichedDocuments.filter(
    (i) => i.eval.status === 'aguardando_conferencia'
  );
  const semPdfAnexo = enrichedDocuments.filter((i) => i.doc.fileType === 'none');

  // Verificar pendências nos cadastros das empresas
  const companyIssues = companies
    .map((c) => {
      const missing: string[] = [];
      if (!c.cnpj || !isValidCNPJ(c.cnpj)) missing.push('CNPJ com dígito verificador pendente');
      if (!c.stateRegistration) missing.push('Inscrição Estadual (IE)');
      if (!c.municipalRegistration) missing.push('Inscrição Municipal (IM)');
      if (!c.partnerCpf || !isValidCPF(c.partnerCpf)) missing.push('CPF do Sócio válido');
      if (!c.email) missing.push('E-mail');
      return { company: c, missing };
    })
    .filter((item) => item.missing.length > 0);

  return (
    <section className="space-y-5">
      <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Central de Pendências e Ação Rápida
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Acompanhamento consolidado de certidões vencidas, prestes a vencer (alerta de {warningThresholdDays} dias), documentos sem data informada, documentos aguardando conferência ou sem PDF anexado.
        </p>
      </div>

      {/* 1. VENCIDOS E PRESTES A VENCER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-900/70 overflow-hidden">
          <div className="px-4 py-3 bg-red-50/70 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/60 flex items-center justify-between">
            <span className="text-xs font-bold text-red-800 dark:text-red-300 flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4 text-red-600" />
              Certidões Vencidas ({vencidos.length})
            </span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
            {vencidos.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Nenhuma certidão vencida no momento.
              </div>
            ) : (
              vencidos.map(({ doc, company, eval: ev }) => (
                <div
                  key={doc.id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {doc.name}
                    </div>
                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {company.companyName}
                      </span>
                      <span>·</span>
                      <span className="font-mono text-red-600 dark:text-red-400 font-semibold">
                        {ev.countdownText}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {doc.emitterUrl && (
                      <a
                        href={buildCleanTargetUrl(doc.emitterUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => onStartAssistedEmission(doc, company)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Renovar no Portal
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenQuickRenew(doc)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Importar Renovada
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-900/70 overflow-hidden">
          <div className="px-4 py-3 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/60 flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Próximas do Vencimento — até {warningThresholdDays} dias ({aVencer.length})
            </span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
            {aVencer.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Nenhuma certidão vencendo nos próximos {warningThresholdDays} dias.
              </div>
            ) : (
              aVencer.map(({ doc, company, eval: ev }) => (
                <div
                  key={doc.id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {doc.name}
                    </div>
                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {company.companyName}
                      </span>
                      <span>·</span>
                      <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold">
                        {ev.countdownText}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {doc.emitterUrl && (
                      <a
                        href={buildCleanTargetUrl(doc.emitterUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => onStartAssistedEmission(doc, company)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-900 bg-amber-400 hover:bg-amber-300 rounded-lg"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Emitir Certidão
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenQuickRenew(doc)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Renovar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 2. DOCUMENTOS SEM DATA INFORMADA & AGUARDANDO CONFERÊNCIA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-500" />
              Documentos Sem Data de Vencimento Informada ({semData.length})
            </span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
            {semData.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Todos os documentos já possuem data de vencimento configurada.
              </div>
            ) : (
              semData.map(({ doc, company }) => (
                <div
                  key={doc.id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {doc.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Empresa: <strong>{company.companyName}</strong> · Órgão: {doc.issuer}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {doc.emitterUrl && (
                      <a
                        href={buildCleanTargetUrl(doc.emitterUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => onStartAssistedEmission(doc, company)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 rounded-lg"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Emitir no Portal
                      </a>
                    )}
                    <label className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      Ler PDF
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onAttachFileToDoc(doc.id, f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <FileWarning className="w-4 h-4 text-blue-500" />
              Aguardando Conferência ({aguardandoConferencia.length}) & Sem Anexo ({semPdfAnexo.length})
            </span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
            {aguardandoConferencia.map(({ doc, company }) => (
              <div
                key={doc.id}
                className="p-3.5 flex items-center justify-between gap-2 bg-blue-50/30 dark:bg-blue-950/20"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {doc.name}
                  </div>
                  <div className="text-[11px] text-blue-600 dark:text-blue-400">
                    {company.companyName} · Aguardando confirmação de conferência
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onApproveReviewDoc(doc.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Marcar Conferido
                </button>
              </div>
            ))}

            {semPdfAnexo.slice(0, 12).map(({ doc, company }) => (
              <div key={doc.id} className="p-3.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {doc.name}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {company.companyName} · Sem arquivo PDF anexado
                  </div>
                </div>
                <label className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white rounded-lg cursor-pointer shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  Anexar PDF
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onAttachFileToDoc(doc.id, f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. PENDÊNCIAS NO CADASTRO DE EMPRESAS */}
      {companyIssues.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-amber-500" />
            Verificação de Dados Cadastrais para Emissão Assistida
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {companyIssues.map(({ company, missing }) => (
              <div
                key={company.id}
                className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {company.companyName}
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                    Revisar: {missing.join(', ')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onGoToCompanyDb(company.id)}
                  className="self-start px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 rounded cursor-pointer"
                >
                  Abrir Ficha da Empresa
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
