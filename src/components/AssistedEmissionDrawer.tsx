import React from 'react';
import {
  Zap,
  ExternalLink,
  Copy,
  Check,
  FileScan,
  ShieldCheck,
  AlertTriangle,
  X,
} from 'lucide-react';
import { CertidaoDocument, CompanyProfile } from '../types/domain';
import {
  AutoFillFieldKey,
  buildCleanTargetUrl,
  dispatchAutofillBridgeEvent,
  findPortalAdapterForDoc,
  resolveCompanyFieldMap,
} from '../utils/portalAdapters';

interface AssistedEmissionDrawerProps {
  doc: CertidaoDocument;
  company: CompanyProfile;
  copiedFieldLabel: string;
  copiedValue: string;
  copiedId: string | null;
  onCopyText: (id: string, text: string, label: string) => void;
  onAttachEmittedPdf: (docId: string, file: File) => void;
  onOpenTampermonkeyGuide: () => void;
  onClose: () => void;
}

export const AssistedEmissionDrawer: React.FC<AssistedEmissionDrawerProps> = ({
  doc,
  company,
  copiedFieldLabel,
  copiedValue,
  copiedId,
  onCopyText,
  onAttachEmittedPdf,
  onOpenTampermonkeyGuide,
  onClose,
}) => {
  const adapter = findPortalAdapterForDoc(doc.templateKey, doc.emitterUrl);
  const fieldMap = resolveCompanyFieldMap(company);
  const cleanUrl = buildCleanTargetUrl(doc.emitterUrl || adapter?.officialUrl || '');

  const fieldsToShow: AutoFillFieldKey[] = adapter?.requiredFields?.length
    ? adapter.requiredFields
    : ['cnpj_num', 'ie_num', 'im_num', 'cpf_num', 'nire', 'email', 'razao'];

  return (
    <div className="bg-blue-950 text-white border-b border-blue-800 shadow-lg">
      <div className="max-w-[1440px] mx-auto px-6 py-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-amber-300 flex items-center gap-1">
                <Zap className="w-4 h-4" />
                EMISSÃO ASSISTIDA DE CERTIDÃO:
              </span>
              <span className="font-bold text-white text-sm">{doc.name}</span>
              <span className="text-blue-400">·</span>
              <span className="text-blue-200">
                Empresa: <strong className="text-white">{company.companyName}</strong> ({company.cnpj})
              </span>
              {adapter && (
                <span className="px-2 py-0.5 rounded bg-blue-900 border border-blue-700 text-[11px] text-emerald-300 font-semibold">
                  Adaptador Oficial: {adapter.agency}
                </span>
              )}
            </div>

            <div className="text-xs text-blue-200 flex flex-wrap items-center gap-2">
              <span className="text-emerald-300 font-semibold">
                ✓ {copiedFieldLabel} (<span className="font-mono">{copiedValue}</span>) já copiado para o Ctrl+V!
              </span>
              {adapter && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 text-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    Intervenção necessária apenas em: {adapter.securityDescription}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {cleanUrl && (
              <a
                href={cleanUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => dispatchAutofillBridgeEvent(company, doc.templateKey)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Reabrir Portal Oficial
              </a>
            )}

            <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer whitespace-nowrap shadow">
              <FileScan className="w-4 h-4" />
              Já Emiti! Importar e Conferir PDF
              <input
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    onAttachEmittedPdf(doc.id, f);
                  }
                  e.target.value = '';
                }}
              />
            </label>

            <button
              type="button"
              onClick={onOpenTampermonkeyGuide}
              className="px-2.5 py-2 text-xs font-semibold text-blue-200 hover:text-white bg-blue-900/70 border border-blue-800 rounded-lg cursor-pointer"
            >
              Configurar AutoPreencher
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-blue-300 hover:text-white cursor-pointer"
              title="Fechar assistente"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CAMPOS PARA CÓPIA RÁPIDA + PASSO A PASSO DO PORTAL */}
        <div className="pt-2.5 border-t border-blue-900 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-blue-300 font-medium mr-1">
              Campos desta empresa para o portal:
            </span>
            {fieldsToShow.map((key) => {
              const item = fieldMap[key];
              if (!item || !item.value) return null;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onCopyText(`assist-${key}`, item.value, item.label)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-blue-900/90 hover:bg-blue-800 border border-blue-700 rounded-md text-white cursor-pointer"
                >
                  {copiedId === `assist-${key}` ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-blue-300" />
                  )}
                  <span>
                    {item.label}: <strong>{item.value.slice(0, 22)}</strong>
                  </span>
                </button>
              );
            })}
          </div>

          {adapter && adapter.steps.length > 0 && (
            <div className="text-[11px] text-blue-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Passo no Portal: {adapter.steps[0]}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
