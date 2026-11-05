import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Archive,
  ArchiveRestore,
  Trash2,
  Edit3,
  Copy,
  ExternalLink,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ChevronRight,
  Info,
  X,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Save,
} from 'lucide-react';
import { CompanyProfile, CertidaoDocument, AppSettings } from '../types/domain';
import { getEffectiveCompanyFields, getEffectiveCustomFields } from '../utils/settingsConfig';
import { isValidCnpj, formatCnpj, formatPhone, formatCep, formatCpf } from '../utils/validators';
import { CompanyDocumentAttachmentManager } from './CompanyDocumentAttachmentManager';

interface CompanyManagementViewProps {
  companies: CompanyProfile[];
  documents: CertidaoDocument[];
  activeCompanyId: string;
  settings: AppSettings;
  onSelectCompany: (companyId: string) => void;
  onSaveCompany: (company: CompanyProfile, isNew: boolean) => void;
  onDeleteCompany: (companyId: string) => void;
  onArchiveCompany: (companyId: string, archive: boolean) => void;
  onOpenSettings: (initialTab?: string) => void;
  onSaveAttachmentDataUrl?: (key: string, dataUrl: string) => Promise<void>;
  onGetAttachmentDataUrl?: (key: string) => Promise<string | null>;
  onDeleteAttachmentDataUrl?: (key: string) => Promise<void>;
  onPreviewDoc?: (title: string, dataUrl: string, mimeType: string, fileName: string) => void;
}

export const CompanyManagementView: React.FC<CompanyManagementViewProps> = ({
  companies,
  documents,
  activeCompanyId,
  settings,
  onSelectCompany,
  onSaveCompany,
  onDeleteCompany,
  onArchiveCompany,
  onOpenSettings,
  onSaveAttachmentDataUrl = async () => {},
  onGetAttachmentDataUrl = async () => null,
  onDeleteAttachmentDataUrl = async () => {},
  onPreviewDoc,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingCompany, setEditingCompany] = useState<Partial<CompanyProfile> | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Delete confirmation modal state
  const [companyToDelete, setCompanyToDelete] = useState<CompanyProfile | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');

  // Filtered companies
  const filteredCompanies = companies.filter((comp) => {
    const isArchived = Boolean(comp.isArchived);
    if (statusFilter === 'active' && isArchived) return false;
    if (statusFilter === 'archived' && !isArchived) return false;

    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const name = (comp.companyName || (comp as any).corporateName || '').toLowerCase();
    const trade = (comp.tradeName || '').toLowerCase();
    const city = (comp.cityState || (comp as any).city || '').toLowerCase();
    return (
      name.includes(term) ||
      trade.includes(term) ||
      comp.cnpj.replace(/\D/g, '').includes(term.replace(/\D/g, '')) ||
      city.includes(term)
    );
  });

  // Calculate metrics for a company
  const getCompanyMetrics = (companyId: string) => {
    const docs = documents.filter((d) => d.companyId === companyId);
    const total = docs.length;
    const valid = docs.filter((d) => d.status === 'vigente').length;
    const expiring = docs.filter((d) => d.status === 'vencendo' || d.status === 'atencao').length;
    const expired = docs.filter((d) => d.status === 'vencida' || d.status === 'vencido').length;
    const noPdf = docs.filter((d) => !d.fileData && !d.fileUrl).length;
    return { total, valid, expiring, expired, noPdf };
  };

  const handleOpenCreateModal = () => {
    setEditingCompany({
      id: `comp-${Date.now()}`,
      companyName: '',
      tradeName: '',
      cnpj: '',
      stateRegistration: '',
      municipalRegistration: '',
      nire: '',
      cnaeMain: '',
      cityState: 'Teresina - PI',
      uf: 'PI',
      cep: '64000-000',
      address: '',
      email: '',
      phone: '',
      partnerName: '',
      partnerCpf: '',
      partnerRg: '',
      partnerBirthDate: '',
      techResponsibleName: '',
      techResponsibleCouncil: '',
      techResponsibleCpf: '',
      portalAccessNotes: '',
      isArchived: false,
      customFields: {},
    });
    setFormErrors({});
    setModalMode('create');
  };

  const handleOpenEditModal = (comp: CompanyProfile) => {
    setEditingCompany({ ...comp, customFields: comp.customFields || {} });
    setFormErrors({});
    setModalMode('edit');
  };

  const handleDuplicateCompany = (comp: CompanyProfile) => {
    // Duplicates fields without CNPJ and without documents
    setEditingCompany({
      ...comp,
      id: `comp-${Date.now()}`,
      companyName: `${comp.companyName || (comp as any).corporateName} (Cópia)`,
      tradeName: comp.tradeName ? `${comp.tradeName} (Filial/Cópia)` : '',
      cnpj: '', // must fill in new CNPJ
      isArchived: false,
    });
    setFormErrors({});
    setModalMode('create');
  };

  const validateForm = (): boolean => {
    if (!editingCompany) return false;
    const errors: Record<string, string> = {};

    const effectiveFields = getEffectiveCompanyFields(settings, editingCompany.id);

    // Validate companyName
    const corporateField = effectiveFields.find((f) => f.id === 'companyName');
    const compName = editingCompany.companyName || (editingCompany as any).corporateName;
    if ((corporateField?.required || !compName?.trim()) && !compName?.trim()) {
      errors.companyName = 'Razão Social é obrigatória.';
    }

    // Validate CNPJ
    const rawCnpj = (editingCompany.cnpj || '').replace(/\D/g, '');
    if (!rawCnpj) {
      errors.cnpj = 'CNPJ é obrigatório.';
    } else if (rawCnpj.length !== 14 || !isValidCnpj(rawCnpj)) {
      errors.cnpj = 'CNPJ inválido (verifique os dígitos verificadores).';
    } else {
      // Check duplicate
      const duplicate = companies.find(
        (c) => c.id !== editingCompany.id && c.cnpj.replace(/\D/g, '') === rawCnpj
      );
      if (duplicate) {
        errors.cnpj = `Este CNPJ já está cadastrado para "${duplicate.companyName || (duplicate as any).corporateName}".`;
      }
    }

    // Validate other required configured fields
    effectiveFields.forEach((field) => {
      const fieldKey = (field.id || field.key) as string;
      if (field.required && fieldKey !== 'companyName' && fieldKey !== 'cnpj') {
        const val = (editingCompany as any)[fieldKey];
        if (val === undefined || val === null || String(val).trim() === '') {
          errors[fieldKey] = `${field.label} é de preenchimento obrigatório.`;
        }
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !editingCompany) return;

    onSaveCompany(editingCompany as CompanyProfile, modalMode === 'create');
    setModalMode(null);
    setEditingCompany(null);
  };

  const confirmDeleteAction = () => {
    if (!companyToDelete) return;
    onDeleteCompany(companyToDelete.id);
    setCompanyToDelete(null);
    setDeleteConfirmationInput('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/60 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Building2 className="w-6 h-6 text-emerald-400" />
              Central de Empresas
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono">
              {companies.filter((c) => !c.isArchived).length} Ativas
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gerencie perfis societários, inscrições estaduais e municipais, certidões vinculadas e configurações exclusivas por empresa.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => onOpenSettings('companyFields')}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
            title="Personalizar campos que aparecem no formulário de empresas"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            Configurar Campos
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            + Nova Empresa
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por Razão Social, Nome Fantasia, CNPJ ou Cidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-500 ml-1" />
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            Ativas ({companies.filter((c) => !c.isArchived).length})
          </button>
          <button
            onClick={() => setStatusFilter('archived')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              statusFilter === 'archived'
                ? 'bg-amber-600 text-white'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            Arquivadas ({companies.filter((c) => c.isArchived).length})
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              statusFilter === 'all'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            Todas ({companies.length})
          </button>
        </div>
      </div>

      {/* Empty State when no companies */}
      {companies.length === 0 ? (
        <div className="text-center p-12 bg-slate-900 border border-dashed border-slate-800 rounded-2xl">
          <Building2 className="w-14 h-14 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">Nenhuma empresa cadastrada no sistema</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-6">
            Você removeu todas as empresas anteriores. O sistema está limpo e pronto para o cadastro das suas empresas reais.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            + Adicionar Primeira Empresa
          </button>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="text-center p-8 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-400 text-xs">
          Nenhuma empresa encontrada com os filtros aplicados.
        </div>
      ) : (
        /* Companies Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCompanies.map((comp) => {
            const metrics = getCompanyMetrics(comp.id);
            const isActiveCompany = comp.id === activeCompanyId;
            const isArchived = Boolean(comp.isArchived);

            return (
              <div
                key={comp.id}
                className={`relative flex flex-col justify-between rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isActiveCompany
                    ? 'bg-slate-900/90 border-emerald-500/50 ring-1 ring-emerald-500/30 shadow-xl'
                    : isArchived
                    ? 'bg-slate-900/40 border-slate-800/80 opacity-75'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:shadow-lg'
                }`}
              >
                {/* Top Badge */}
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isActiveCompany && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Selecionada
                          </span>
                        )}
                        {isArchived && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Arquivada
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-400">
                          {comp.uf || 'PI'}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white truncate mt-1" title={comp.companyName || (comp as any).corporateName}>
                        {comp.companyName || (comp as any).corporateName}
                      </h3>
                      {comp.tradeName && (
                        <p className="text-xs text-slate-400 truncate" title={comp.tradeName}>
                          {comp.tradeName}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* CNPJ and Key Identifiers */}
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1 font-mono text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500 text-[10px] uppercase">CNPJ:</span>
                      <span className="font-semibold select-all">{formatCnpj(comp.cnpj)}</span>
                    </div>
                    {comp.stateRegistration && (
                      <div className="flex items-center justify-between text-slate-400 text-[11px]">
                        <span className="text-slate-500 text-[10px] uppercase">Insc. Estadual:</span>
                        <span>{comp.stateRegistration}</span>
                      </div>
                    )}
                    {(comp.municipalRegistration || (comp as any).cityRegistration) && (
                      <div className="flex items-center justify-between text-slate-400 text-[11px]">
                        <span className="text-slate-500 text-[10px] uppercase">Insc. Municipal:</span>
                        <span>{comp.municipalRegistration || (comp as any).cityRegistration}</span>
                      </div>
                    )}
                  </div>

                  {/* Summary Indicators */}
                  <div className="mt-3 grid grid-cols-4 gap-1.5 text-center text-xs">
                    <div className="p-1.5 rounded-lg bg-slate-800/60 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Total</div>
                      <div className="font-bold text-white text-xs mt-0.5">{metrics.total}</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="text-[10px] text-emerald-400 uppercase">Válidas</div>
                      <div className="font-bold text-emerald-400 text-xs mt-0.5">{metrics.valid}</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <div className="text-[10px] text-amber-400 uppercase">Alertas</div>
                      <div className="font-bold text-amber-400 text-xs mt-0.5">{metrics.expiring}</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                      <div className="text-[10px] text-rose-400 uppercase">Vencidas</div>
                      <div className="font-bold text-rose-400 text-xs mt-0.5">{metrics.expired}</div>
                    </div>
                  </div>

                  {metrics.noPdf > 0 && (
                    <div className="mt-2 text-[11px] text-amber-300 flex items-center gap-1.5 bg-amber-500/10 px-2 py-1 rounded-lg">
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      <span>{metrics.noPdf} certidões sem arquivo PDF anexado</span>
                    </div>
                  )}

                  {comp.companyDocuments && comp.companyDocuments.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-medium">Docs Base:</span>
                      {comp.companyDocuments.map((cd, i) => (
                        <span
                          key={cd.id || i}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700/80"
                        >
                          {cd.docType === 'cnpj'
                            ? '📄 Cartão CNPJ'
                            : cd.docType === 'cnh_socio'
                            ? '🪪 CNH Sócio'
                            : cd.docType === 'contrato_social'
                            ? '📑 Contrato Social'
                            : '📎 ' + cd.title.slice(0, 14)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Action Buttons */}
                <div className="p-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onSelectCompany(comp.id)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      isActiveCompany
                        ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                    }`}
                  >
                    Abrir Painel
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(comp)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      title="Editar cadastro da empresa"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDuplicateCompany(comp)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition"
                      title="Duplicar cadastro (sem documentos/CNPJ)"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {isArchived ? (
                      <button
                        onClick={() => onArchiveCompany(comp.id, false)}
                        className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 transition"
                        title="Restaurar empresa"
                      >
                        <ArchiveRestore className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onArchiveCompany(comp.id, true)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition"
                        title="Arquivar empresa"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setCompanyToDelete(comp);
                        setDeleteConfirmationInput('');
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      title="Excluir empresa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {modalMode && editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div 
            className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {modalMode === 'create' ? 'Cadastrar Nova Empresa' : 'Editar Dados da Empresa'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Preencha as informações conforme o cartão CNPJ ou Contrato Social.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalMode(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Gerenciador e Leitor Inteligente de Documentação da Empresa (CNPJ, CNH, Contrato Social) */}
              <CompanyDocumentAttachmentManager
                company={editingCompany as any}
                onUpdateCompany={(updated) => setEditingCompany((prev) => ({ ...prev, ...updated }))}
                onSaveAttachmentDataUrl={onSaveAttachmentDataUrl}
                onGetAttachmentDataUrl={onGetAttachmentDataUrl}
                onDeleteAttachmentDataUrl={onDeleteAttachmentDataUrl}
                onPreviewDoc={onPreviewDoc}
              />

              {/* Dynamic Sections Based on Configuration */}
              {(() => {
                const effectiveFields = getEffectiveCompanyFields(settings, editingCompany.id);
                const customFields = getEffectiveCustomFields(settings, 'company', editingCompany.id);

                const sections = [
                  { id: 'corporate', label: '1. Dados Empresariais e Fiscais' },
                  { id: 'address', label: '2. Endereço e Contato' },
                  { id: 'partner', label: '3. Representante Legal e Sócios' },
                  { id: 'technical', label: '4. Responsável Técnico' },
                  { id: 'admin', label: '5. Observações Internas' },
                ];

                return (
                  <>
                    {sections.map((sec) => {
                      const fieldsInSection = effectiveFields.filter((f) => f.section === sec.id);
                      if (fieldsInSection.length === 0) return null;

                      return (
                        <div key={sec.id} className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-4">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                              {sec.label}
                            </h4>
                            {sec.id === 'partner' && (
                              <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-950/80 text-emerald-300 rounded border border-emerald-700/60 uppercase">
                                Prioridade: CNH do Sócio
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                            {fieldsInSection.map((field) => {
                              const fieldKey = (field.id || field.key) as string;
                              const value = (editingCompany as any)[fieldKey] || '';
                              const error = formErrors[fieldKey];

                              return (
                                <div
                                  key={fieldKey}
                                  className={
                                    fieldKey === 'companyName' || fieldKey === 'corporateName' || fieldKey === 'generalNotes' || fieldKey === 'adminNotes'
                                      ? 'sm:col-span-2 md:col-span-3'
                                      : ''
                                  }
                                >
                                  <label className="block text-xs font-medium text-slate-300 mb-1">
                                    {field.label} {field.required && <span className="text-rose-400">*</span>}
                                  </label>

                                  {fieldKey === 'generalNotes' || fieldKey === 'adminNotes' ? (
                                    <textarea
                                      rows={2}
                                      value={value}
                                      onChange={(e) =>
                                        setEditingCompany({ ...editingCompany, [fieldKey]: e.target.value })
                                      }
                                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                      placeholder={field.placeholder}
                                    />
                                  ) : (
                                    <input
                                      type={fieldKey === 'email' ? 'email' : 'text'}
                                      value={value}
                                      onChange={(e) => {
                                        let val = e.target.value;
                                        if (fieldKey === 'cnpj') val = formatCnpj(val);
                                        else if (fieldKey === 'partnerCpf' || fieldKey === 'techResponsibleCpf' || fieldKey === 'representativeCpf') val = formatCpf(val);
                                        else if (fieldKey === 'phone' || fieldKey === 'whatsapp' || fieldKey === 'partnerPhone') val = formatPhone(val);
                                        else if (fieldKey === 'cep' || fieldKey === 'zipCode') val = formatCep(val);

                                        setEditingCompany({ ...editingCompany, [fieldKey]: val });
                                        if (formErrors[fieldKey]) {
                                          setFormErrors({ ...formErrors, [fieldKey]: '' });
                                        }
                                      }}
                                      placeholder={field.placeholder}
                                      className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 ${
                                        error ? 'border-rose-500' : 'border-slate-700/80'
                                      }`}
                                    />
                                  )}

                                  {error && <p className="text-[11px] text-rose-400 mt-0.5">{error}</p>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* Custom Fields (if configured) */}
                    {customFields.length > 0 && (
                      <div className="p-4 rounded-xl bg-slate-950/40 border border-cyan-800/40 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                            Campos Personalizados do Sistema
                          </h4>
                          <span className="text-[10px] text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-700/40">
                            {customFields.length} campos
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                          {customFields.map((cf) => {
                            const currentVal = editingCompany.customFields?.[cf.id] ?? '';
                            const fieldType = cf.dataType || cf.fieldType;
                            const fieldLabel = cf.label || cf.name;

                            return (
                              <div key={cf.id} className={fieldType === 'texto_longo' ? 'sm:col-span-2 md:col-span-3' : ''}>
                                <label className="block text-xs font-medium text-slate-300 mb-1">
                                  {fieldLabel} {cf.required && <span className="text-rose-400">*</span>}
                                </label>

                                {fieldType === 'sim_nao' ? (
                                  <select
                                    value={String(currentVal)}
                                    onChange={(e) =>
                                      setEditingCompany({
                                        ...editingCompany,
                                        customFields: {
                                          ...(editingCompany.customFields || {}),
                                          [cf.id]: e.target.value,
                                        },
                                      })
                                    }
                                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-100"
                                  >
                                    <option value="">Selecione...</option>
                                    <option value="true">Sim</option>
                                    <option value="false">Não</option>
                                  </select>
                                ) : fieldType === 'lista' ? (
                                  <select
                                    value={String(currentVal)}
                                    onChange={(e) =>
                                      setEditingCompany({
                                        ...editingCompany,
                                        customFields: {
                                          ...(editingCompany.customFields || {}),
                                          [cf.id]: e.target.value,
                                        },
                                      })
                                    }
                                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-100"
                                  >
                                    <option value="">Selecione uma opção...</option>
                                    {cf.options?.map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                ) : fieldType === 'texto_longo' ? (
                                  <textarea
                                    rows={2}
                                    value={String(currentVal)}
                                    onChange={(e) =>
                                      setEditingCompany({
                                        ...editingCompany,
                                        customFields: {
                                          ...(editingCompany.customFields || {}),
                                          [cf.id]: e.target.value,
                                        },
                                      })
                                    }
                                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-100"
                                    placeholder={cf.placeholder}
                                  />
                                ) : (
                                  <input
                                    type={fieldType === 'numero' ? 'number' : fieldType === 'data' ? 'date' : 'text'}
                                    value={String(currentVal)}
                                    onChange={(e) =>
                                      setEditingCompany({
                                        ...editingCompany,
                                        customFields: {
                                          ...(editingCompany.customFields || {}),
                                          [cf.id]: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder={cf.placeholder}
                                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-100"
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/20"
                >
                  <Save className="w-4 h-4" />
                  {modalMode === 'create' ? 'Salvar Empresa' : 'Atualizar Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE IMPACT ASSESSMENT MODAL */}
      {companyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div 
            className="relative w-full max-w-lg bg-slate-900 border border-rose-500/40 rounded-2xl shadow-2xl p-6 text-slate-100"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-3 text-rose-400 pb-3 border-b border-slate-800">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-white">Excluir Empresa</h3>
                <p className="text-xs text-rose-300">Avaliação de impacto no banco de dados</p>
              </div>
            </div>

            <div className="mt-4 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-xs text-slate-400">Empresa alvo:</div>
              <div className="text-sm font-bold text-white mt-0.5">{companyToDelete.companyName || (companyToDelete as any).corporateName}</div>
              <div className="text-xs font-mono text-emerald-400 mt-0.5">CNPJ: {formatCnpj(companyToDelete.cnpj)}</div>
            </div>

            {/* Impact stats */}
            {(() => {
              const metrics = getCompanyMetrics(companyToDelete.id);
              return (
                <div className="mt-4 p-3 rounded-xl bg-rose-950/30 border border-rose-800/40 space-y-2 text-xs">
                  <div className="font-semibold text-rose-300">Registros que serão afetados:</div>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    <li>
                      <strong>{metrics.total} certidões</strong> vinculadas a esta empresa.
                    </li>
                    <li>
                      <strong>{metrics.total - metrics.noPdf} arquivos PDF</strong> armazenados localmente.
                    </li>
                    <li>Todo o histórico de emissões e análises registradas.</li>
                  </ul>
                </div>
              );
            })()}

            {/* Alternative suggestion: Archive */}
            <div className="mt-4 p-3 rounded-xl bg-amber-950/20 border border-amber-800/40 flex items-start gap-2.5 text-xs text-amber-200">
              <Archive className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Dica:</strong> Em vez de excluir, você pode <em>Arquivar</em> a empresa. Ela sairá da listagem principal sem que você perca nenhum arquivo ou histórico para auditorias futuras.
              </div>
            </div>

            {/* Explicit confirmation safety */}
            <div className="mt-5 space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Para confirmar a exclusão definitiva, digite <span className="font-bold text-rose-400">EXCLUIR</span> abaixo:
              </label>
              <input
                type="text"
                value={deleteConfirmationInput}
                onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                placeholder="Digite EXCLUIR"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setCompanyToDelete(null);
                  setDeleteConfirmationInput('');
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => {
                  onArchiveCompany(companyToDelete.id, true);
                  setCompanyToDelete(null);
                  setDeleteConfirmationInput('');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-sm transition"
              >
                <Archive className="w-3.5 h-3.5" />
                Arquivar em vez de excluir
              </button>

              <button
                type="button"
                disabled={deleteConfirmationInput.trim().toUpperCase() !== 'EXCLUIR'}
                onClick={confirmDeleteAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs transition shadow-lg shadow-rose-600/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
