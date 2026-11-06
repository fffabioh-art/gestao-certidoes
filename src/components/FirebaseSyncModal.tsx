import React from 'react';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  AlertTriangle,
  HardDrive,
  CheckCircle2,
  X,
  RefreshCw,
  ShieldCheck,
  Building2,
  FileText,
  Clock,
} from 'lucide-react';
import { SyncPreview, SyncConflictItem } from '../utils/firebase';
import { User } from 'firebase/auth';

interface FirebaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  preview: SyncPreview | null;
  isSyncing: boolean;
  onConfirmSync: () => void;
}

export const FirebaseSyncModal: React.FC<FirebaseSyncModalProps> = ({
  isOpen,
  onClose,
  user,
  preview,
  isSyncing,
  onConfirmSync,
}) => {
  if (!isOpen || !preview) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Sincronização em Nuvem (Cloud Firestore)
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Plano Spark Free
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Conectado como <strong className="text-slate-200">{user?.email}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSyncing}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Aviso Obrigatório de PDFs no IndexedDB */}
          <div className="flex items-start gap-3.5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
            <HardDrive className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed space-y-1">
              <p className="font-semibold text-amber-300">
                Armazenamento de Arquivos PDF (Local no Navegador)
              </p>
              <p className="text-amber-200/90">
                Os arquivos binários de PDF (certidões baixadas, CNH e Cartão CNPJ) permanecem <strong>exclusivamente no IndexedDB deste navegador</strong>. 
                A nuvem sincroniza os cadastros, datas de validade, campos de portais e metadados, respeitando o plano gratuito Spark e a sua privacidade.
              </p>
            </div>
          </div>

          {/* Resumo de Transferência */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Local -> Nuvem */}
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between text-sm font-semibold text-blue-400">
                <span className="flex items-center gap-2">
                  <CloudUpload className="w-4 h-4" />
                  Enviar para a Nuvem
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                  {preview.companiesToUpload.length + preview.documentsToUpload.length + preview.historyToUpload.length} registros
                </span>
              </div>
              <ul className="text-xs text-slate-300 space-y-1.5">
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Building2 className="w-3.5 h-3.5" /> Empresas:
                  </span>
                  <span className="font-semibold text-white">{preview.companiesToUpload.length}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <FileText className="w-3.5 h-3.5" /> Certidões (Metadados):
                  </span>
                  <span className="font-semibold text-white">{preview.documentsToUpload.length}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="w-3.5 h-3.5" /> Histórico:
                  </span>
                  <span className="font-semibold text-white">{preview.historyToUpload.length}</span>
                </li>
              </ul>
            </div>

            {/* Nuvem -> Local */}
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between text-sm font-semibold text-emerald-400">
                <span className="flex items-center gap-2">
                  <CloudDownload className="w-4 h-4" />
                  Baixar da Nuvem
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                  {preview.companiesToDownload.length + preview.documentsToDownload.length + preview.historyToDownload.length} registros
                </span>
              </div>
              <ul className="text-xs text-slate-300 space-y-1.5">
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Building2 className="w-3.5 h-3.5" /> Empresas:
                  </span>
                  <span className="font-semibold text-white">{preview.companiesToDownload.length}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <FileText className="w-3.5 h-3.5" /> Certidões (Metadados):
                  </span>
                  <span className="font-semibold text-white">{preview.documentsToDownload.length}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="w-3.5 h-3.5" /> Histórico:
                  </span>
                  <span className="font-semibold text-white">{preview.historyToDownload.length}</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Prevenção de Conflitos e Resoluções */}
          {preview.conflicts.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Resolução Automática de Conflitos ({preview.conflicts.length})
              </div>
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {preview.conflicts.map((conf, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50 flex items-start justify-between text-xs"
                  >
                    <div>
                      <p className="font-medium text-white">{conf.title}</p>
                      <p className="text-slate-400 text-[11px] mt-0.5">{conf.reason}</p>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold shrink-0 ml-3 ${
                        conf.winner === 'local'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {conf.winner === 'local' ? 'Local Prevalece' : 'Nuvem Prevalece'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Nenhum conflito de versão detectado. Os dados serão consolidados bidirecionalmente sem perdas.
              </span>
            </div>
          )}

          {/* Garantia de Segurança */}
          <div className="p-3.5 rounded-xl bg-slate-800/30 border border-slate-700/40 text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Regra de Segurança do Firestore
            </p>
            <p>
              Os dados são gravados exclusivamente no caminho <code className="text-blue-300">users/{user?.uid}/*</code>. 
              As regras de segurança garantem matematicamente que apenas a sua conta Google autenticada tem permissão de leitura ou escrita.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-850">
          <button
            type="button"
            onClick={onClose}
            disabled={isSyncing}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancelar sem Alterar
          </button>
          
          <button
            type="button"
            onClick={onConfirmSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Sincronizando com Firestore...
              </>
            ) : (
              <>
                <CloudUpload className="w-4 h-4" />
                Confirmar e Sincronizar Agora
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
