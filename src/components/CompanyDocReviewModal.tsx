import React, { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Building,
  UserCheck,
  Check,
  X,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Info,
  Maximize2,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { CompanyProfile } from '../types/domain';
import {
  CompanyDocFieldItem,
  CompanyDocType,
  FieldConfidence,
} from '../utils/companyDocReader';

interface CompanyDocReviewModalProps {
  isOpen: boolean;
  fileName: string;
  fileMimeType: string;
  dataUrl: string;
  detectedType: CompanyDocType;
  detectedTitle: string;
  initialItems: CompanyDocFieldItem[];
  currentCompany: Partial<CompanyProfile>;
  companies: CompanyProfile[];
  onConfirm: (selectedUpdates: Record<string, string>, applyTargetCompanyId?: string) => void;
  onRetry: () => void;
  onCancel: () => void;
}

export const CompanyDocReviewModal: React.FC<CompanyDocReviewModalProps> = ({
  isOpen,
  fileName,
  fileMimeType,
  dataUrl,
  detectedType,
  detectedTitle,
  initialItems,
  currentCompany,
  companies,
  onConfirm,
  onRetry,
  onCancel,
}) => {
  const [items, setItems] = useState<CompanyDocFieldItem[]>(initialItems);
  const [targetCompanyId, setTargetCompanyId] = useState<string>(currentCompany.id || '');
  const [selectedGroup, setSelectedGroup] = useState<string>('todos');
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  if (!isOpen) return null;

  const isPdf = fileMimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');

  // Identifica se há divergência crítica no CNPJ ou CPF
  const cnpjItem = items.find((i) => i.key === 'cnpj');
  const partnerCpfItem = items.find((i) => i.key === 'partnerCpf');

  const hasCnpjDivergence = Boolean(
    cnpjItem &&
      currentCompany.cnpj &&
      cnpjItem.extractedValue &&
      currentCompany.cnpj.replace(/\D/g, '') !== cnpjItem.extractedValue.replace(/\D/g, '')
  );

  const hasPartnerCpfDivergence = Boolean(
    partnerCpfItem &&
      currentCompany.partnerCpf &&
      partnerCpfItem.extractedValue &&
      currentCompany.partnerCpf.replace(/\D/g, '') !== partnerCpfItem.extractedValue.replace(/\D/g, '')
  );

  // Procura se o CNPJ do documento pertence a outra empresa já cadastrada
  const matchingOtherCompany = cnpjItem?.extractedValue
    ? companies.find(
        (c) =>
          c.id !== currentCompany.id &&
          c.cnpj.replace(/\D/g, '') === cnpjItem.extractedValue.replace(/\D/g, '')
      )
    : undefined;

  const handleToggleAccept = (key: string) => {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, accepted: !item.accepted } : item))
    );
  };

  const handleValueChange = (key: string, newVal: string) => {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, extractedValue: newVal } : item))
    );
  };

  const handleSelectAll = (accept: boolean) => {
    setItems((prev) =>
      prev.map((item) => {
        // Se for divergente em CNPJ/CPF e estiver mandando aceitar tudo, aceita com ciência
        return { ...item, accepted: accept };
      })
    );
  };

  const handleConfirmSelected = () => {
    const updates: Record<string, string> = {};
    items.forEach((item) => {
      if (item.accepted && item.extractedValue !== undefined) {
        updates[item.key] = item.extractedValue;
      }
    });

    onConfirm(updates, targetCompanyId);
  };

  const acceptedCount = items.filter((i) => i.accepted).length;
  const divergentCount = items.filter((i) => i.isDivergent).length;

  const getConfidenceBadge = (confidence: FieldConfidence) => {
    switch (confidence) {
      case 'alta':
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
            Confiança Alta
          </span>
        );
      case 'media':
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
            Confiança Média
          </span>
        );
      case 'baixa':
      default:
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-700 animate-pulse">
            Baixa / Conferir
          </span>
        );
    }
  };

  const filteredItems = selectedGroup === 'todos' ? items : items.filter((i) => i.group === selectedGroup);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-7xl w-full h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* MODAL HEADER */}
        <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 shrink-0">
              {detectedType === 'cnh_socio' ? <UserCheck className="w-5 h-5" /> : <Building className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  Conferência Inteligente — {detectedTitle}
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {detectedType.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                Arquivo: <strong className="text-slate-700 dark:text-slate-200">{fileName}</strong> · Compare os dados com o documento original antes de confirmar.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors shrink-0"
            title="Cancelar e fechar sem alterar o cadastro"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ALERTA DE DIVERGÊNCIA DE CNPJ OU CPF */}
        {hasCnpjDivergence && (
          <div className="px-6 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200 shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <strong className="font-bold">Atenção — Divergência de CNPJ:</strong> O CNPJ do comprovante (
              <span className="font-mono font-bold">{cnpjItem?.extractedValue}</span>) é diferente do CNPJ cadastrado nesta empresa (
              <span className="font-mono font-bold">{currentCompany.cnpj}</span>).
              {matchingOtherCompany && (
                <div className="mt-1 text-[11px] text-amber-800 dark:text-amber-300">
                  💡 Este CNPJ coincide exatamente com a empresa <strong>{matchingOtherCompany.companyName}</strong>. Deseja vinculá-lo a ela?
                  <button
                    type="button"
                    onClick={() => setTargetCompanyId(matchingOtherCompany.id)}
                    className="ml-2 font-bold underline hover:text-amber-950 dark:hover:text-white cursor-pointer"
                  >
                    Vincular a {matchingOtherCompany.companyName}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {hasPartnerCpfDivergence && (
          <div className="px-6 py-2.5 bg-purple-50 dark:bg-purple-950/40 border-b border-purple-200 dark:border-purple-800 flex items-start gap-2.5 text-xs text-purple-900 dark:text-purple-200 shrink-0">
            <UserCheck className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <strong className="font-bold">Atenção — CNH de Titular Divergente:</strong> O titular desta CNH (
              <strong>{items.find((i) => i.key === 'partnerName')?.extractedValue || 'Titular'}</strong> — CPF{' '}
              <span className="font-mono font-bold">{partnerCpfItem?.extractedValue}</span>) diverge do sócio registrado atualmente no cadastro (
              <strong>{currentCompany.partnerName || 'Não informado'}</strong> — CPF{' '}
              <span className="font-mono font-bold">{currentCompany.partnerCpf || 'Sem CPF'}</span>).
              <div className="mt-1 text-[11px] text-purple-800 dark:text-purple-300">
                Por segurança, o CPF divergente <strong>NÃO</strong> vem marcado por padrão. Marque manualmente apenas se este for o novo sócio-administrador.
              </div>
            </div>
          </div>
        )}

        {/* TWO-COLUMN BODY */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* COLUNA ESQUERDA: VISUALIZAÇÃO DO DOCUMENTO ORIGINAL */}
          <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-100 dark:bg-slate-950/60 overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 shrink-0">
              <span className="font-bold flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                Documento Original Anexado
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.15))}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded cursor-pointer"
                  title="Diminuir Zoom"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono px-1">{(zoomLevel * 100).toFixed(0)}%</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(2.0, z + 0.15))}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded cursor-pointer"
                  title="Aumentar Zoom"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-3 overflow-auto flex items-center justify-center">
              {isPdf ? (
                <iframe
                  src={dataUrl}
                  title="Visualização do Documento"
                  className="w-full h-full min-h-[480px] bg-white border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm"
                  style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
                />
              ) : (
                <div className="overflow-auto max-h-full flex items-center justify-center">
                  <img
                    src={dataUrl}
                    alt="Documento Original"
                    className="max-w-full max-h-[75vh] object-contain rounded-lg border border-slate-300 dark:border-slate-700 shadow-sm"
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* COLUNA DIREITA: DADOS EXTRAÍDOS, CONFIDÊNCIAS E SELEÇÃO */}
          <div className="w-full md:w-1/2 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
            {/* TOOLBAR DA COLUNA DIREITA */}
            <div className="px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex items-center justify-between flex-wrap gap-2 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Campos Reconhecidos ({acceptedCount} de {items.length} selecionados):
                </span>
                {divergentCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                    {divergentCount} divergência(s)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer"
                >
                  Marcar Todos
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
                >
                  Desmarcar Todos
                </button>
              </div>
            </div>

            {/* LISTA SCROLLÁVEL DE CAMPOS */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {filteredItems.map((item) => {
                const isSelected = item.accepted;

                return (
                  <div
                    key={item.key}
                    className={`p-3 rounded-xl border transition-all ${
                      isSelected
                        ? item.isDivergent
                          ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/80 shadow-2xs'
                          : 'bg-white dark:bg-slate-900 border-emerald-300/80 dark:border-emerald-800/80 shadow-2xs'
                        : 'bg-slate-50/50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800 opacity-60'
                    }`}
                  >
                    {/* CABEÇALHO DO CAMPO */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label className="flex items-center gap-2 cursor-pointer select-none min-w-0">
                        <input
                          type="checkbox"
                          checked={item.accepted}
                          onChange={() => handleToggleAccept(item.key)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {item.label}
                        </span>
                      </label>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.isDivergent ? (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            Divergência
                          </span>
                        ) : !item.currentValue ? (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            Novo Dado
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Sem alteração
                          </span>
                        )}
                        {getConfidenceBadge(item.confidence)}
                      </div>
                    </div>

                    {/* VALOR ATUAL VS VALOR IDENTIFICADO */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Valor no Cadastro Atual:
                        </div>
                        <div className="text-slate-600 dark:text-slate-300 font-mono text-[11px] truncate mt-0.5">
                          {item.currentValue ? item.currentValue : <em className="text-slate-400">Vazio / Não informado</em>}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                          Valor Identificado no Documento (Editável):
                        </div>
                        {item.key === 'cnaeSecondaryText' ? (
                          <textarea
                            rows={3}
                            value={item.extractedValue}
                            onChange={(e) => handleValueChange(item.key, e.target.value)}
                            className="w-full mt-1 px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                          />
                        ) : (
                          <input
                            type="text"
                            value={item.extractedValue}
                            onChange={(e) => handleValueChange(item.key, e.target.value)}
                            className="w-full mt-0.5 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* BARRA INFERIOR DE CONFIRMAÇÃO */}
            <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Apenas os <strong className="text-emerald-600 dark:text-emerald-400">{acceptedCount} campos marcados</strong> serão atualizados no cadastro da empresa.
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar sem Alterar
                </button>
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Repetir a leitura do documento com OCR"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Repetir Leitura
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSelected}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Confirmar Dados Selecionados
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
