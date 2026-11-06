import React, { useState } from 'react';
import {
  Settings,
  Sliders,
  Layers,
  Table,
  Building2,
  FileCheck2,
  Bell,
  Eye,
  FileScan,
  DownloadCloud,
  UploadCloud,
  RotateCcw,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  Info,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  Cloud,
  CloudUpload,
  CloudOff,
  ShieldCheck,
  Lock,
  Copy,
} from 'lucide-react';
import {
  AppSettings,
  CertidaoFieldConfig,
  CompanyFieldConfig,
  CompanyFormSectionKey,
  CompanyProfile,
  CustomFieldDefinition,
  CustomFieldType,
  DocumentCategory,
  DocumentModelConfig,
  TableColumnConfig,
} from '../types/domain';
import {
  COMPANY_SECTION_LABELS,
  buildDefaultAppSettings,
} from '../utils/settingsConfig';

interface SettingsCenterViewProps {
  settings: AppSettings;
  companies: CompanyProfile[];
  onUpdateSettings: (newSettings: AppSettings) => void;
  onResetSettingsToDefault?: () => void;
  onResetSettings?: () => void;
  onBackToDashboard?: () => void;
  onClose?: () => void;
  showToast?: (msg: string) => void;
  initialTab?: string;
  user?: any;
  onOpenSyncModal?: () => void;
  onLoginGoogle?: () => void;
  onLogoutGoogle?: () => void;
  isOnline?: boolean;
  lastSyncTime?: string | null;
}

type SettingsTab =
  | 'company_fields'
  | 'custom_fields'
  | 'certidao_fields'
  | 'table_columns'
  | 'company_overrides'
  | 'document_models'
  | 'alerts'
  | 'appearance'
  | 'pdf_reader'
  | 'backup_settings'
  | 'cloud_sync';

export const SettingsCenterView: React.FC<SettingsCenterViewProps> = ({
  settings,
  companies,
  onUpdateSettings,
  onResetSettingsToDefault,
  onResetSettings,
  onBackToDashboard,
  onClose,
  showToast = () => {},
  initialTab,
  user,
  onOpenSyncModal,
  onLoginGoogle,
  onLogoutGoogle,
  isOnline = true,
  lastSyncTime,
}) => {
  const handleResetToDefault = onResetSettings || onResetSettingsToDefault || (() => {});
  const handleBack = onClose || onBackToDashboard || (() => {});

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (initialTab && typeof initialTab === 'string') {
      const tabMap: Record<string, SettingsTab> = {
        companyFields: 'company_fields',
        company_fields: 'company_fields',
        customFields: 'custom_fields',
        custom_fields: 'custom_fields',
        certidaoFields: 'certidao_fields',
        certidao_fields: 'certidao_fields',
        tableColumns: 'table_columns',
        table_columns: 'table_columns',
        companyOverrides: 'company_overrides',
        company_overrides: 'company_overrides',
        documentModels: 'document_models',
        document_models: 'document_models',
        alerts: 'alerts',
        appearance: 'appearance',
        pdfReader: 'pdf_reader',
        pdf_reader: 'pdf_reader',
        backup: 'backup_settings',
        backup_settings: 'backup_settings',
        cloud: 'cloud_sync',
        cloud_sync: 'cloud_sync',
        firebase: 'cloud_sync',
      };
      if (tabMap[initialTab]) return tabMap[initialTab];
    }
    return 'company_fields';
  });
  const [copiedRules, setCopiedRules] = useState(false);
  const [editingCustomField, setEditingCustomField] = useState<CustomFieldDefinition | null>(null);
  const [isNewCustomFieldModal, setIsNewCustomFieldModal] = useState(false);
  const [deleteCustomFieldConfirm, setDeleteCustomFieldConfirm] = useState<CustomFieldDefinition | null>(null);
  const [editingModel, setEditingModel] = useState<DocumentModelConfig | null>(null);
  const [isNewModelModal, setIsNewModelModal] = useState(false);
  const [deleteModelConfirm, setDeleteModelConfirm] = useState<DocumentModelConfig | null>(null);
  const [selectedOverrideCompanyId, setSelectedOverrideCompanyId] = useState<string>(
    companies[0]?.id || ''
  );
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // --------------------------------------------------------------------------
  // Tab 1: Company Fields Helpers
  // --------------------------------------------------------------------------
  const updateCompanyField = (
    key: keyof CompanyProfile,
    updater: (f: CompanyFieldConfig) => CompanyFieldConfig
  ) => {
    const updated = settings.companyFields.map((f) => (f.key === key ? updater(f) : f));
    onUpdateSettings({ ...settings, companyFields: updated });
  };

  const moveCompanyField = (key: keyof CompanyProfile, direction: 'up' | 'down') => {
    const fields = [...settings.companyFields].sort((a, b) => a.order - b.order);
    const idx = fields.findIndex((f) => f.key === key);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= fields.length) return;

    const currentOrder = fields[idx].order;
    fields[idx].order = fields[targetIdx].order;
    fields[targetIdx].order = currentOrder;

    const resorted = fields.sort((a, b) => a.order - b.order).map((f, i) => ({ ...f, order: i + 1 }));
    onUpdateSettings({ ...settings, companyFields: resorted });
  };

  // --------------------------------------------------------------------------
  // Tab 2: Custom Fields Helpers
  // --------------------------------------------------------------------------
  const handleSaveCustomField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomField || !editingCustomField.name.trim()) return;

    if (isNewCustomFieldModal) {
      const newField: CustomFieldDefinition = {
        ...editingCustomField,
        id: `cf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        order: settings.customFields.length + 1,
      };
      onUpdateSettings({
        ...settings,
        customFields: [...settings.customFields, newField],
      });
      showToast(`Campo personalizado "${newField.name}" criado com sucesso!`);
    } else {
      onUpdateSettings({
        ...settings,
        customFields: settings.customFields.map((cf) =>
          cf.id === editingCustomField.id ? editingCustomField : cf
        ),
      });
      showToast(`Campo personalizado "${editingCustomField.name}" atualizado!`);
    }
    setEditingCustomField(null);
  };

  const handleDeleteCustomField = (id: string) => {
    onUpdateSettings({
      ...settings,
      customFields: settings.customFields.filter((cf) => cf.id !== id),
    });
    setDeleteCustomFieldConfirm(null);
    showToast('Campo personalizado excluído.');
  };

  // --------------------------------------------------------------------------
  // Tab 3: Certidao Fields Helpers
  // --------------------------------------------------------------------------
  const updateCertidaoField = (
    key: string,
    updater: (f: CertidaoFieldConfig) => CertidaoFieldConfig
  ) => {
    const updated = settings.certidaoFields.map((f) => (f.key === key ? updater(f) : f));
    onUpdateSettings({ ...settings, certidaoFields: updated });
  };

  const moveCertidaoField = (key: string, direction: 'up' | 'down') => {
    const fields = [...settings.certidaoFields].sort((a, b) => a.order - b.order);
    const idx = fields.findIndex((f) => f.key === key);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= fields.length) return;

    const currentOrder = fields[idx].order;
    fields[idx].order = fields[targetIdx].order;
    fields[targetIdx].order = currentOrder;

    const resorted = fields.sort((a, b) => a.order - b.order).map((f, i) => ({ ...f, order: i + 1 }));
    onUpdateSettings({ ...settings, certidaoFields: resorted });
  };

  // --------------------------------------------------------------------------
  // Tab 4: Table Columns Helpers
  // --------------------------------------------------------------------------
  const updateTableColumn = (
    key: string,
    updater: (c: TableColumnConfig) => TableColumnConfig
  ) => {
    const updated = settings.tableColumns.map((c) => (c.key === key ? updater(c) : c));
    onUpdateSettings({ ...settings, tableColumns: updated });
  };

  const moveTableColumn = (key: string, direction: 'up' | 'down') => {
    const cols = [...settings.tableColumns].sort((a, b) => a.order - b.order);
    const idx = cols.findIndex((c) => c.key === key);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= cols.length) return;

    const currentOrder = cols[idx].order;
    cols[idx].order = cols[targetIdx].order;
    cols[targetIdx].order = currentOrder;

    const resorted = cols.sort((a, b) => a.order - b.order).map((c, i) => ({ ...c, order: i + 1 }));
    onUpdateSettings({ ...settings, tableColumns: resorted });
  };

  // --------------------------------------------------------------------------
  // Tab 6: Document Models Helpers
  // --------------------------------------------------------------------------
  const handleSaveModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModel || !editingModel.name.trim()) return;

    if (isNewModelModal) {
      const newModel: DocumentModelConfig = {
        ...editingModel,
        templateKey:
          editingModel.templateKey || `tpl-custom-${Date.now().toString(36)}`,
        isCustomModel: true,
        order: settings.documentModels.length + 1,
      };
      onUpdateSettings({
        ...settings,
        documentModels: [...settings.documentModels, newModel],
      });
      showToast(`Modelo de certidão "${newModel.name}" cadastrado!`);
    } else {
      onUpdateSettings({
        ...settings,
        documentModels: settings.documentModels.map((m) =>
          m.templateKey === editingModel.templateKey ? editingModel : m
        ),
      });
      showToast(`Modelo "${editingModel.name}" atualizado!`);
    }
    setEditingModel(null);
  };

  const handleDeleteModel = (templateKey: string) => {
    onUpdateSettings({
      ...settings,
      documentModels: settings.documentModels.filter((m) => m.templateKey !== templateKey),
    });
    setDeleteModelConfirm(null);
    showToast('Modelo personalizado excluído.');
  };

  // --------------------------------------------------------------------------
  // Tab 10: Export / Import Settings
  // --------------------------------------------------------------------------
  const handleExportSettingsOnly = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `configuracoes-mago-licitacoes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Configurações exportadas em arquivo JSON!');
  };

  const handleImportSettingsOnly = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') {
        showToast('Arquivo JSON de configurações inválido.');
        return;
      }
      onUpdateSettings(parsed);
      showToast('Configurações importadas e aplicadas com sucesso!');
    } catch {
      showToast('Falha ao ler o arquivo de configurações.');
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <img
              src="/assets/aistudio/Wizard_Hat_and_Spellbook_Stack_8d8be742.png"
              alt="Mago das Licitações"
              className="w-8 h-8 object-contain shrink-0"
            />
            <span>Central de Configurações do Sistema</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Personalize quais campos aparecem no cadastro de empresas e certidões, crie campos personalizados, configure as colunas da tabela, ajuste modelos de documentos e gerencie alertas sem alterar código.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer whitespace-nowrap"
          >
            ← Voltar para Lista
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold scrollbar-none">
        {[
          { id: 'company_fields', label: 'Campos do Cadastro', icon: Sliders },
          { id: 'custom_fields', label: 'Campos Personalizados', icon: Plus },
          { id: 'certidao_fields', label: 'Campos das Certidões', icon: FileCheck2 },
          { id: 'table_columns', label: 'Personalizar Tabela', icon: Table },
          { id: 'company_overrides', label: 'Por Empresa', icon: Building2 },
          { id: 'document_models', label: 'Modelos de Certidões', icon: Layers },
          { id: 'alerts', label: 'Alertas de Vencimento', icon: Bell },
          { id: 'appearance', label: 'Aparência e Navegação', icon: Eye },
          { id: 'pdf_reader', label: 'Leitura de PDFs', icon: FileScan },
          { id: 'backup_settings', label: 'Backup das Configurações', icon: DownloadCloud },
          { id: 'cloud_sync', label: 'Nuvem & Firebase', icon: Cloud },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg whitespace-nowrap cursor-pointer transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
              {tab.id === 'custom_fields' && settings.customFields.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 text-[10px] font-mono rounded bg-blue-500/30 text-white">
                  {settings.customFields.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ====================================================================
          TAB 1: CAMPOS DO CADASTRO DE EMPRESAS
      ==================================================================== */}
      {activeTab === 'company_fields' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                Configurar Campos do Cadastro de Empresas
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Ative ou desative campos, defina obrigatoriedade, altere o nome exibido e escolha se o campo aparece na barra rápida resumida.
                <strong className="text-slate-700 dark:text-slate-300"> Ocultar um campo não apaga dados já cadastrados.</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsNewCustomFieldModal(true);
                  setEditingCustomField({
                    id: '',
                    target: 'company',
                    name: '',
                    fieldType: 'texto',
                    section: 'dados_empresariais',
                    required: false,
                    visible: true,
                    order: settings.customFields.length + 1,
                    showInSummary: false,
                    companyScope: 'all',
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                + Criar Campo Personalizado
              </button>
            </div>
          </div>

          {/* Grouped by Section */}
          {(['dados_empresariais', 'endereco_contato', 'representante_legal', 'responsavel_tecnico', 'informacoes_adicionais'] as CompanyFormSectionKey[]).map((secKey) => {
            const sectionFields = settings.companyFields
              .filter((f) => f.section === secKey)
              .sort((a, b) => a.order - b.order);

            return (
              <div key={secKey} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    {COMPANY_SECTION_LABELS[secKey]}
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {sectionFields.filter((f) => f.visible).length} de {sectionFields.length} campos visíveis
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-950/30">
                  {sectionFields.map((field) => (
                    <div
                      key={field.key}
                      className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-white dark:hover:bg-slate-900/60 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveCompanyField(field.key, 'up')}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            title="Mover para cima"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveCompanyField(field.key, 'down')}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            title="Mover para baixo"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) =>
                                updateCompanyField(field.key, (f) => ({ ...f, label: e.target.value }))
                              }
                              className="px-2 py-1 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 w-64 max-w-full"
                            />
                            {field.essential && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                Essencial (Sempre Ativo)
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 mt-0.5 block truncate">
                            Identificador interno: <code className="font-mono">{field.key}</code>
                          </span>
                        </div>
                      </div>

                      {/* Controls: Visible, Required, Summary, Section */}
                      <div className="flex flex-wrap items-center gap-3 text-xs shrink-0">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={field.essential}
                            checked={field.visible}
                            onChange={(e) =>
                              updateCompanyField(field.key, (f) => ({
                                ...f,
                                visible: e.target.checked,
                              }))
                            }
                            className="rounded text-blue-600 cursor-pointer disabled:opacity-50"
                          />
                          <span className={field.visible ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-400'}>
                            Visível
                          </span>
                        </label>

                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={field.essential}
                            checked={field.required}
                            onChange={(e) =>
                              updateCompanyField(field.key, (f) => ({
                                ...f,
                                required: e.target.checked,
                              }))
                            }
                            className="rounded text-blue-600 cursor-pointer disabled:opacity-50"
                          />
                          <span className={field.required ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-slate-400'}>
                            Obrigatório
                          </span>
                        </label>

                        <label className="inline-flex items-center gap-1.5 cursor-pointer" title="Exibe este campo na barra rápida da empresa ativa no topo da tela">
                          <input
                            type="checkbox"
                            checked={field.showInSummary}
                            onChange={(e) =>
                              updateCompanyField(field.key, (f) => ({
                                ...f,
                                showInSummary: e.target.checked,
                              }))
                            }
                            className="rounded text-blue-600 cursor-pointer"
                          />
                          <span className={field.showInSummary ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}>
                            Ficha Resumo
                          </span>
                        </label>

                        <select
                          value={field.section}
                          onChange={(e) =>
                            updateCompanyField(field.key, (f) => ({
                              ...f,
                              section: e.target.value as CompanyFormSectionKey,
                            }))
                          }
                          className="px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300"
                        >
                          <option value="dados_empresariais">Seção 1: Dados Empresariais</option>
                          <option value="endereco_contato">Seção 2: Endereço e Contato</option>
                          <option value="representante_legal">Seção 3: Representante Legal</option>
                          <option value="responsavel_tecnico">Seção 4: Responsável Técnico</option>
                          <option value="informacoes_adicionais">Seção 5: Adicionais e Acessos</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ====================================================================
          TAB 2: CAMPOS PERSONALIZADOS
      ==================================================================== */}
      {activeTab === 'custom_fields' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                Campos Personalizados (Empresas e Certidões)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Crie novos campos (número de alvará sanitário, registro ANVISA, código de convênio, valores, etc.) sem alterar o código. Escolha se o campo é global ou para uma empresa específica.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsNewCustomFieldModal(true);
                setEditingCustomField({
                  id: '',
                  target: 'company',
                  name: '',
                  fieldType: 'texto',
                  section: 'dados_empresariais',
                  required: false,
                  visible: true,
                  order: settings.customFields.length + 1,
                  showInSummary: false,
                  companyScope: 'all',
                });
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              + Criar Campo Personalizado
            </button>
          </div>

          {settings.customFields.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <Info className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Nenhum campo personalizado criado ainda
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Você pode criar campos extras como "Nº Registro Vigilância Sanitária", "Código de Fornecedor", "Data de Homologação", etc.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
              {settings.customFields.map((cf) => {
                const targetComp = companies.find((c) => c.id === cf.companyScope);
                return (
                  <div
                    key={cf.id}
                    className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {cf.name}
                        </span>
                        <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {cf.fieldType}
                        </span>
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          {cf.target === 'company' ? 'Cadastro da Empresa' : 'Certidão'}
                        </span>
                        {cf.companyScope !== 'all' && (
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                            Específico: {targetComp?.companyName || cf.companyScope}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Seção: {cf.section} · {cf.required ? 'Obrigatório' : 'Opcional'} · {cf.visible ? 'Visível' : 'Oculto'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewCustomFieldModal(false);
                          setEditingCustomField({ ...cf });
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded cursor-pointer"
                        title="Editar campo"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteCustomFieldConfirm(cf)}
                        className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-100 dark:bg-slate-800 rounded cursor-pointer"
                        title="Excluir campo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          TAB 3: CAMPOS DAS CERTIDÕES
      ==================================================================== */}
      {activeTab === 'certidao_fields' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-blue-600" />
              Configurar Campos e Informações das Certidões
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Escolha quais informações deseja controlar no formulário de cada certidão (número de protocolo, autenticidade, link do portal, órgão emissor, situação). Os campos essenciais de cálculo de validade permanecem protegidos.
            </p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            {settings.certidaoFields
              .sort((a, b) => a.order - b.order)
              .map((field) => (
                <div
                  key={field.key}
                  className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveCertidaoField(field.key, 'up')}
                        className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveCertidaoField(field.key, 'down')}
                        className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) =>
                          updateCertidaoField(field.key, (f) => ({ ...f, label: e.target.value }))
                        }
                        className="px-2 py-1 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white w-72 max-w-full"
                      />
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Padrão: {field.defaultLabel}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs shrink-0">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={field.essential}
                        checked={field.visible}
                        onChange={(e) =>
                          updateCertidaoField(field.key, (f) => ({
                            ...f,
                            visible: e.target.checked,
                          }))
                        }
                        className="rounded text-blue-600 cursor-pointer disabled:opacity-50"
                      />
                      <span>{field.visible ? 'Visível' : 'Oculto'}</span>
                    </label>

                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={field.essential}
                        checked={field.required}
                        onChange={(e) =>
                          updateCertidaoField(field.key, (f) => ({
                            ...f,
                            required: e.target.checked,
                          }))
                        }
                        className="rounded text-blue-600 cursor-pointer disabled:opacity-50"
                      />
                      <span className={field.required ? 'font-semibold text-amber-600' : 'text-slate-400'}>
                        Obrigatório
                      </span>
                    </label>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 4: PERSONALIZAR TABELA
      ==================================================================== */}
      {activeTab === 'table_columns' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Table className="w-4 h-4 text-blue-600" />
              Personalizar Colunas da Tabela de Certidões
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Selecione quais colunas aparecem na lista principal, reordene sua apresentação e defina larguras. Suas preferências permanecem salvas ao fechar e recarregar a página.
            </p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            {settings.tableColumns
              .sort((a, b) => a.order - b.order)
              .map((col) => (
                <div
                  key={col.key}
                  className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveTableColumn(col.key, 'up')}
                        className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTableColumn(col.key, 'down')}
                        className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={col.label}
                        onChange={(e) =>
                          updateTableColumn(col.key, (c) => ({ ...c, label: e.target.value }))
                        }
                        className="px-2 py-1 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white w-64 max-w-full"
                      />
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Coluna padrão: {col.defaultLabel}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs shrink-0">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={(e) =>
                          updateTableColumn(col.key, (c) => ({
                            ...c,
                            visible: e.target.checked,
                          }))
                        }
                        className="rounded text-blue-600 cursor-pointer"
                      />
                      <span className={col.visible ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-400'}>
                        {col.visible ? 'Exibir Coluna' : 'Oculta'}
                      </span>
                    </label>

                    <select
                      value={col.width}
                      onChange={(e) =>
                        updateTableColumn(col.key, (c) => ({
                          ...c,
                          width: e.target.value as 'compact' | 'normal' | 'wide',
                        }))
                      }
                      className="px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300"
                    >
                      <option value="compact">Largura Compacta</option>
                      <option value="normal">Largura Normal</option>
                      <option value="wide">Largura Ampla</option>
                    </select>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 5: CONFIGURAÇÕES POR EMPRESA
      ==================================================================== */}
      {activeTab === 'company_overrides' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              Configurações Específicas por Empresa
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Personalize campos ou prazos de alertas que se aplicam exclusivamente à empresa selecionada sem afetar as demais.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Selecione a Empresa:
            </label>
            <select
              value={selectedOverrideCompanyId}
              onChange={(e) => setSelectedOverrideCompanyId(e.target.value)}
              className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white max-w-md"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName} (CNPJ: {c.cnpj})
                </option>
              ))}
            </select>
          </div>

          {selectedOverrideCompanyId && (
            <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20 space-y-4">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Sobrescritas para: {companies.find((c) => c.id === selectedOverrideCompanyId)?.companyName}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Prazo de Alerta de Vencimento Específico desta Empresa:
                  </label>
                  <select
                    value={
                      settings.companyOverrides[selectedOverrideCompanyId]?.customWarningDays || ''
                    }
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      const current = settings.companyOverrides[selectedOverrideCompanyId] || {
                        companyId: selectedOverrideCompanyId,
                      };
                      onUpdateSettings({
                        ...settings,
                        companyOverrides: {
                          ...settings.companyOverrides,
                          [selectedOverrideCompanyId]: {
                            ...current,
                            customWarningDays: val,
                          },
                        },
                      });
                      showToast('Prazo de alerta individual da empresa atualizado!');
                    }}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="">Usar Padrão Global ({settings.globalWarningDays} dias)</option>
                    <option value="60">60 dias antes de vencer</option>
                    <option value="45">45 dias antes de vencer</option>
                    <option value="30">30 dias antes de vencer</option>
                    <option value="15">15 dias antes de vencer</option>
                    <option value="7">7 dias antes de vencer</option>
                    <option value="1">1 dia antes de vencer</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          TAB 6: MODELOS DE CERTIDÕES
      ==================================================================== */}
      {activeTab === 'document_models' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                Modelos de Certidões do Sistema ({settings.documentModels.length} modelos)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Ative ou desative modelos padrão, edite nomes, links de portais oficiais, prazos padrão e defina quais modelos serão incluídos ao cadastrar uma nova empresa.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsNewModelModal(true);
                setEditingModel({
                  templateKey: '',
                  name: '',
                  category: 'Fiscais e Trabalhistas',
                  issuer: '',
                  emitterUrl: '',
                  primaryAutoFillField: 'cnpj_num',
                  portalFieldsHint: '',
                  isPermanent: false,
                  defaultValidityDays: 90,
                  customWarningDays: '',
                  enabled: true,
                  includeOnNewCompany: true,
                  order: settings.documentModels.length + 1,
                  isCustomModel: true,
                });
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              + Criar Novo Modelo de Certidão
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            {settings.documentModels
              .sort((a, b) => a.order - b.order)
              .map((model, idx) => (
                <div
                  key={model.templateKey}
                  className={`p-3.5 flex flex-col xl:flex-row xl:items-center justify-between gap-3 transition-colors ${
                    !model.enabled ? 'bg-slate-50/50 dark:bg-slate-950/40 opacity-60' : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="text-xs font-mono text-slate-400 pt-0.5">
                      {String(idx + 1).padStart(2, '0')}.
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {model.name}
                        </span>
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {model.category}
                        </span>
                        {model.isCustomModel && (
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                            Personalizado
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                        <span>Órgão: {model.issuer || '—'}</span>
                        <span>·</span>
                        <span>
                          {model.isPermanent
                            ? 'Prazo Permanente'
                            : `Validade: ${model.defaultValidityDays || 90}d`}
                        </span>
                        {model.customWarningDays && (
                          <>
                            <span>·</span>
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              Alerta específico: {model.customWarningDays}d
                            </span>
                          </>
                        )}
                        {model.emitterUrl && (
                          <>
                            <span>·</span>
                            <a
                              href={model.emitterUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              Link oficial <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs shrink-0">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={model.enabled}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...settings,
                            documentModels: settings.documentModels.map((m) =>
                              m.templateKey === model.templateKey
                                ? { ...m, enabled: e.target.checked }
                                : m
                            ),
                          })
                        }
                        className="rounded text-blue-600 cursor-pointer"
                      />
                      <span>{model.enabled ? 'Ativo' : 'Desativado'}</span>
                    </label>

                    <label className="inline-flex items-center gap-1.5 cursor-pointer" title="Se marcado, gera automaticamente esta certidão quando uma nova empresa for cadastrada">
                      <input
                        type="checkbox"
                        checked={model.includeOnNewCompany}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...settings,
                            documentModels: settings.documentModels.map((m) =>
                              m.templateKey === model.templateKey
                                ? { ...m, includeOnNewCompany: e.target.checked }
                                : m
                            ),
                          })
                        }
                        className="rounded text-blue-600 cursor-pointer"
                      />
                      <span className="text-slate-600 dark:text-slate-400">
                        Nova Empresa
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setIsNewModelModal(false);
                        setEditingModel({ ...model });
                      }}
                      className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded cursor-pointer"
                      title="Editar modelo"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {model.isCustomModel && (
                      <button
                        type="button"
                        onClick={() => setDeleteModelConfirm(model)}
                        className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-100 dark:bg-slate-800 rounded cursor-pointer"
                        title="Excluir modelo personalizado"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 7: ALERTAS DE VENCIMENTO
      ==================================================================== */}
      {activeTab === 'alerts' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              Configuração dos Alertas de Vencimento
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Defina com quantos dias de antecedência uma certidão deve mudar de status para "A Vencer / Próxima do Vencimento" (Amarelo).
            </p>
          </div>

          <div className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Prazo Global Padrão de Alerta:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[60, 30, 15, 7, 1].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => {
                      onUpdateSettings({ ...settings, globalWarningDays: days });
                      showToast(`Alerta global ajustado para ${days} dias.`);
                    }}
                    className={`py-2 px-3 text-xs font-mono font-bold rounded-lg border cursor-pointer ${
                      settings.globalWarningDays === days
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-500'
                    }`}
                  >
                    {days} dias
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ou digite um prazo personalizado em dias:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={settings.globalWarningDays}
                  onChange={(e) => {
                    const n = Math.max(1, parseInt(e.target.value, 10) || 30);
                    onUpdateSettings({ ...settings, globalWarningDays: n });
                  }}
                  className="w-32 px-3 py-1.5 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
                <span className="text-xs text-slate-500">dias antes do vencimento</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 8: APARÊNCIA E NAVEGAÇÃO
      ==================================================================== */}
      {activeTab === 'appearance' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600" />
              Preferências de Aparência e Navegação
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Ajuste densidade de linhas, tema, ordenação inicial e atalhos na tela.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Densidade Visual da Tabela:
              </label>
              <select
                value={settings.appearance.density}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    appearance: {
                      ...settings.appearance,
                      density: e.target.value as 'compact' | 'comfortable',
                    },
                  })
                }
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="compact">Compacto (Mais linhas visíveis por tela)</option>
                <option value="comfortable">Confortável (Espaçamento arejado)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Ordenação Padrão ao Abrir:
              </label>
              <select
                value={settings.appearance.defaultSortBy}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    appearance: {
                      ...settings.appearance,
                      defaultSortBy: e.target.value as 'priority' | 'expiration' | 'name' | 'category',
                    },
                  })
                }
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="priority">Prioridade (Vencidos e a vencer no topo)</option>
                <option value="expiration">Data de Vencimento</option>
                <option value="name">Ordem Alfabética</option>
                <option value="category">Por Categoria</option>
              </select>
            </div>

            <div className="space-y-3 md:col-span-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={settings.appearance.showQuickCompanyBar}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      appearance: {
                        ...settings.appearance,
                        showQuickCompanyBar: e.target.checked,
                      },
                    })
                  }
                  className="rounded text-blue-600"
                />
                Exibir barra rápida de CNPJ, IE, IM e CPF da empresa ativa
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={settings.appearance.showBatchDropzoneOnDashboard}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      appearance: {
                        ...settings.appearance,
                        showBatchDropzoneOnDashboard: e.target.checked,
                      },
                    })
                  }
                  className="rounded text-blue-600"
                />
                Exibir barra de arrastar PDFs em lote no topo da Lista de Certidões
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 9: LEITURA INTELIGENTE DE PDFs
      ==================================================================== */}
      {activeTab === 'pdf_reader' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileScan className="w-4 h-4 text-emerald-600" />
              Configurar Leitor Inteligente de PDFs e OCR
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              O leitor do Mago das Licitações é 100% gratuito e local (PDF.js + Tesseract.js em Português). Ajuste quais verificações automáticas você deseja que ele faça.
            </p>
          </div>

          <div className="space-y-4 max-w-2xl text-xs text-slate-700 dark:text-slate-300">
            {[
              {
                key: 'autoReadOnAttach' as const,
                title: 'Leitura automática ao anexar PDF',
                desc: 'Ao enviar um PDF, tenta extrair imediatamente as datas e o código de autenticidade.',
              },
              {
                key: 'enableOcr' as const,
                title: 'OCR local para PDFs digitalizados (Tesseract.js)',
                desc: 'Caso o PDF seja uma foto/escaneamento sem texto selecionável, usa OCR gratuito no navegador.',
              },
              {
                key: 'autoIdentifyCompany' as const,
                title: 'Identificação da empresa pelo CNPJ do documento',
                desc: 'Localiza a empresa correspondente no banco pelo CNPJ verificado com dígito verificador.',
              },
              {
                key: 'suggestCompanyUpdates' as const,
                title: 'Sugestão de atualização de dados cadastrais',
                desc: 'Compara Razão Social, IE, IM e endereço com o cadastro e oferece atualização na tela de conferência.',
              },
              {
                key: 'detectDuplicates' as const,
                title: 'Detecção de duplicidade de documentos',
                desc: 'Alerta se o mesmo arquivo ou mesmo código de controle já estiver cadastrado.',
              },
              {
                key: 'requireReviewBeforeSave' as const,
                title: 'Exigir tela "Conferir Dados" antes de salvar',
                desc: 'Apresenta a tela de revisão humana com avisos e edições antes de gravar qualquer alteração.',
              },
              {
                key: 'useGeminiWhenAvailable' as const,
                title: 'Refinamento opcional com Gemini AI',
                desc: 'Usa a chave de API Gemini configurada apenas como complemento para documentos complexos.',
              },
            ].map((opt) => (
              <label
                key={opt.key}
                className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={settings.pdfReader[opt.key]}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      pdfReader: {
                        ...settings.pdfReader,
                        [opt.key]: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 rounded text-emerald-600"
                />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {opt.title}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                    {opt.desc}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 10: BACKUP E RESTAURAÇÃO DAS CONFIGURAÇÕES
      ==================================================================== */}
      {activeTab === 'backup_settings' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DownloadCloud className="w-4 h-4 text-blue-600" />
              Backup, Exportação e Restauração das Configurações
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Exporte somente suas personalizações (campos, colunas, modelos, alertas) para transferir entre dispositivos. Restaurar as configurações padrão não apaga suas empresas nem seus documentos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Exportar Configurações (.JSON)
              </div>
              <p className="text-xs text-slate-500">
                Baixa um arquivo JSON contendo todos os campos personalizados, ordem das colunas, modelos de certidões e regras.
              </p>
              <button
                type="button"
                onClick={handleExportSettingsOnly}
                className="w-full py-2 px-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
              >
                Exportar Arquivo de Configurações
              </button>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Importar Configurações (.JSON)
              </div>
              <p className="text-xs text-slate-500">
                Aplica as personalizações salvas anteriormente sem substituir suas empresas e certidões existentes.
              </p>
              <label className="block w-full text-center py-2 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
                Selecionar Arquivo de Configurações
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportSettingsOnly(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-3xl">
            <div>
              <div className="text-xs font-bold text-red-900 dark:text-red-200">
                Restaurar Configurações Originais de Fábrica
              </div>
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                Restaura os campos, colunas, modelos e alertas padrão do Piauí. Suas empresas, certidões e arquivos PDFs anexados são 100% preservados.
              </p>
            </div>

            {resetConfirmOpen ? (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    handleResetToDefault();
                    setResetConfirmOpen(false);
                    showToast('Configurações originais restauradas!');
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
                >
                  Confirmar Restauração
                </button>
                <button
                  type="button"
                  onClick={() => setResetConfirmOpen(false)}
                  className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setResetConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-300 bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-100 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restaurar Padrão
              </button>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 11: SINCRONIZAÇÃO EM NUVEM (FIREBASE AUTH & CLOUD FIRESTORE)
      ==================================================================== */}
      {activeTab === 'cloud_sync' && (
        <div className="space-y-6">
          {/* Card 1: Status da Conta e Projeto */}
          <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 shrink-0">
                  <img
                    src="/assets/aistudio/Wizard_Hat_and_Spellbook_Stack_8d8be742.png"
                    alt="Mago das Licitações"
                    className="w-8 h-8 object-contain"
                  />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Sincronização em Nuvem (Cloud Firestore)
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Plano Gratuito Spark
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Projeto Firebase: <code className="font-mono text-blue-600 dark:text-blue-400 font-semibold">project-eabbdbd1-77b4-41c6-ac1</code>
                  </p>
                </div>
              </div>

              {/* Ações de Login/Logout/Sincronizar */}
              <div className="flex flex-wrap items-center gap-2">
                {!user ? (
                  <button
                    type="button"
                    onClick={onLoginGoogle}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm cursor-pointer transition-colors"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    Conectar Conta Google
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={onOpenSyncModal}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm cursor-pointer transition-colors"
                    >
                      <CloudUpload className="w-4 h-4" />
                      Revisar e Sincronizar Agora
                    </button>
                    <button
                      type="button"
                      onClick={onLogoutGoogle}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-red-500 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                    >
                      Desconectar
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Informações da Conta e Conexão */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Usuário Autenticado:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {user ? `${user.displayName || 'Usuário'} (${user.email})` : 'Nenhum (Modo Local Ativo)'}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Conectividade:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mt-0.5">
                  {isOnline ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Online (Acesso à nuvem habilitado)
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Offline (Dados gravados localmente)
                    </>
                  )}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Última Sincronização:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {lastSyncTime || 'Ainda não sincronizado nesta sessão'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Esclarecimento sobre PDFs e Plano Spark */}
          <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Arquitetura Segura e Isolamento de Arquivos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 space-y-1.5">
                <p className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  📁 Arquivos PDF (Armazenamento Local)
                </p>
                <p>
                  Os PDFs de certidões, CNH e CNPJ ficam armazenados <strong>exclusivamente no banco IndexedDB deste navegador</strong>. Eles não são transferidos para servidores externos, respeitando o limite do plano gratuito Spark (custo zero) e mantendo seus documentos sob seu controle.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-200 space-y-1.5">
                <p className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                  ☁️ Cadastros e Metadados (Cloud Firestore)
                </p>
                <p>
                  As informações de empresas, datas de validade, histórico e configurações são salvas no caminho <code className="font-mono text-blue-700 dark:text-blue-300">users/{'{uid}'}/*</code>. Apenas o seu usuário tem permissão matemática de acesso.
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Regras de Segurança do Firestore (Prontas para Publicação) */}
          <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-500" />
                  Regras de Segurança do Firestore (firestore.rules)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Isolamento total por UID: nenhum dado de licitações é público.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const rulesText = `rules_version = '2';\n\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if false;\n    }\n    match /users/{userId}/{allSubcollections=**} {\n      allow read, write: if request.auth != null && request.auth.uid == userId;\n    }\n  }\n}`;
                  navigator.clipboard.writeText(rulesText);
                  setCopiedRules(true);
                  showToast('Regras de segurança copiadas para a área de transferência!');
                  setTimeout(() => setCopiedRules(false), 2500);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
              >
                {copiedRules ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedRules ? 'Copiado!' : 'Copiar Regras'}
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto leading-relaxed">
{`rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Bloqueio padrão para todas as coleções não declaradas
    match /{document=**} {
      allow read, write: if false;
    }

    // Acesso isolado estritamente por UID do usuário autenticado
    match /users/{userId}/{allSubcollections=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}`}
            </pre>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: CRIAR / EDITAR CAMPO PERSONALIZADO
      ==================================================================== */}
      {editingCustomField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isNewCustomFieldModal ? 'Criar Novo Campo Personalizado' : 'Editar Campo Personalizado'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingCustomField(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomField} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Campo *
                </label>
                <input
                  type="text"
                  required
                  value={editingCustomField.name}
                  onChange={(e) =>
                    setEditingCustomField({ ...editingCustomField, name: e.target.value })
                  }
                  placeholder="Ex: Registro na Vigilância Sanitária"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Onde o campo será utilizado?
                  </label>
                  <select
                    value={editingCustomField.target}
                    onChange={(e) =>
                      setEditingCustomField({
                        ...editingCustomField,
                        target: e.target.value as 'company' | 'certificate',
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="company">Cadastro de Empresas</option>
                    <option value="certificate">Cadastro de Certidões</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tipo de Informação
                  </label>
                  <select
                    value={editingCustomField.fieldType}
                    onChange={(e) =>
                      setEditingCustomField({
                        ...editingCustomField,
                        fieldType: e.target.value as CustomFieldType,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="texto">Texto Curto</option>
                    <option value="numero">Número</option>
                    <option value="data">Data</option>
                    <option value="telefone">Telefone</option>
                    <option value="email">E-mail</option>
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="sim_nao">Sim / Não (Checkbox)</option>
                    <option value="texto_longo">Texto Longo (Observações)</option>
                    <option value="link">Link / URL</option>
                    <option value="valor_monetario">Valor Monetário (R$)</option>
                  </select>
                </div>
              </div>

              {editingCustomField.target === 'company' && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Em qual seção do formulário aparecerá?
                  </label>
                  <select
                    value={editingCustomField.section}
                    onChange={(e) =>
                      setEditingCustomField({
                        ...editingCustomField,
                        section: e.target.value as CompanyFormSectionKey,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="dados_empresariais">1. Dados Empresariais e Fiscais</option>
                    <option value="endereco_contato">2. Endereço e Contato</option>
                    <option value="representante_legal">3. Representante Legal</option>
                    <option value="responsavel_tecnico">4. Responsável Técnico</option>
                    <option value="informacoes_adicionais">5. Informações Adicionais</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Disponibilidade nas Empresas:
                </label>
                <select
                  value={editingCustomField.companyScope}
                  onChange={(e) =>
                    setEditingCustomField({
                      ...editingCustomField,
                      companyScope: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="all">Disponível em TODAS as empresas</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      Apenas para: {c.companyName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={editingCustomField.visible}
                    onChange={(e) =>
                      setEditingCustomField({
                        ...editingCustomField,
                        visible: e.target.checked,
                      })
                    }
                    className="rounded text-blue-600"
                  />
                  <span>Campo Ativo e Visível</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={editingCustomField.required}
                    onChange={(e) =>
                      setEditingCustomField({
                        ...editingCustomField,
                        required: e.target.checked,
                      })
                    }
                    className="rounded text-blue-600"
                  />
                  <span>Preenchimento Obrigatório</span>
                </label>

                {editingCustomField.target === 'company' && (
                  <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={Boolean(editingCustomField.showInSummary)}
                      onChange={(e) =>
                        setEditingCustomField({
                          ...editingCustomField,
                          showInSummary: e.target.checked,
                        })
                      }
                      className="rounded text-blue-600"
                    />
                    <span>Mostrar na Ficha Resumo do Topo</span>
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCustomField(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  Salvar Campo Personalizado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: CONFIRMAR EXCLUSÃO DE CAMPO PERSONALIZADO
      ==================================================================== */}
      {deleteCustomFieldConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              Excluir Campo Personalizado?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Tem certeza que deseja excluir o campo <strong>"{deleteCustomFieldConfirm.name}"</strong>? Caso alguma empresa tenha preenchido dados neste campo, eles não serão mais exibidos.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteCustomFieldConfirm(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCustomField(deleteCustomFieldConfirm.id)}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                Sim, Excluir Campo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: CRIAR / EDITAR MODELO DE CERTIDÃO
      ==================================================================== */}
      {editingModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isNewModelModal ? 'Criar Novo Modelo de Certidão' : 'Editar Modelo de Certidão'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingModel(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModel} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome da Certidão / Licença *
                </label>
                <input
                  type="text"
                  required
                  value={editingModel.name}
                  onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Categoria
                  </label>
                  <select
                    value={editingModel.category}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        category: e.target.value as DocumentCategory,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="Fiscais e Trabalhistas">Fiscais e Trabalhistas</option>
                    <option value="Alvarás, Licenças e Conselhos">Alvarás, Licenças e Conselhos</option>
                    <option value="Societário, Contábil e Qualificação Técnica">
                      Societário, Contábil e Qualificação Técnica
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Órgão Emissor
                  </label>
                  <input
                    type="text"
                    value={editingModel.issuer}
                    onChange={(e) => setEditingModel({ ...editingModel, issuer: e.target.value })}
                    placeholder="Ex: SEFAZ-PI, Receita Federal..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Link Oficial do Portal de Emissão
                </label>
                <input
                  type="url"
                  value={editingModel.emitterUrl}
                  onChange={(e) => setEditingModel({ ...editingModel, emitterUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Prazo Padrão (Dias)
                  </label>
                  <input
                    type="number"
                    min={1}
                    disabled={editingModel.isPermanent}
                    value={editingModel.defaultValidityDays}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        defaultValidityDays: Number(e.target.value) || 90,
                      })
                    }
                    className="w-full px-3 py-2 font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Alerta Específico (Dias)
                  </label>
                  <input
                    type="number"
                    min={1}
                    placeholder="Global"
                    value={editingModel.customWarningDays || ''}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        customWarningDays: e.target.value ? Number(e.target.value) : '',
                      })
                    }
                    className="w-full px-3 py-2 font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex items-end pb-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={editingModel.isPermanent}
                      onChange={(e) =>
                        setEditingModel({
                          ...editingModel,
                          isPermanent: e.target.checked,
                        })
                      }
                      className="rounded text-blue-600"
                    />
                    <span>Permanente (Fixo)</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={editingModel.enabled}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        enabled: e.target.checked,
                      })
                    }
                    className="rounded text-blue-600"
                  />
                  <span>Modelo Ativo</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={editingModel.includeOnNewCompany}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        includeOnNewCompany: e.target.checked,
                      })
                    }
                    className="rounded text-blue-600"
                  />
                  <span>Incluir ao cadastrar nova empresa</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingModel(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  Salvar Modelo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
