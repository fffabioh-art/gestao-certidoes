import {
  AppSettings,
  CertidaoDocument,
  CertidaoFieldConfig,
  CompanyFieldConfig,
  CompanyFormSectionKey,
  CompanyProfile,
  CustomFieldDefinition,
  DocumentModelConfig,
  TableColumnConfig,
} from '../types/domain';

export const COMPANY_SECTION_LABELS: Record<CompanyFormSectionKey, string> = {
  dados_empresariais: '1. Dados Empresariais e Fiscais',
  endereco_contato: '2. Endereço e Contato',
  representante_legal: '3. Representante Legal / Sócio Administrador',
  responsavel_tecnico: '4. Responsável Técnico (Conselhos)',
  informacoes_adicionais: '5. Informações Adicionais e Acessos',
};

export const DEFAULT_COMPANY_FIELDS: CompanyFieldConfig[] = [
  // 1. Dados Empresariais
  {
    key: 'companyName',
    defaultLabel: 'Razão Social',
    label: 'Razão Social',
    section: 'dados_empresariais',
    visible: true,
    required: true,
    order: 1,
    showInSummary: true,
    essential: true,
    placeholder: 'Ex: Desinfecta Serviços Ltda',
  },
  {
    key: 'tradeName',
    defaultLabel: 'Nome Fantasia',
    label: 'Nome Fantasia',
    section: 'dados_empresariais',
    visible: true,
    required: false,
    order: 2,
    showInSummary: true,
    placeholder: 'Ex: Desinfecta Controle de Pragas',
  },
  {
    key: 'cnpj',
    defaultLabel: 'CNPJ',
    label: 'CNPJ',
    section: 'dados_empresariais',
    visible: true,
    required: true,
    order: 3,
    showInSummary: true,
    essential: true,
    placeholder: '00.000.000/0001-00',
  },
  {
    key: 'stateRegistration',
    defaultLabel: 'Inscrição Estadual (IE - SEFAZ-PI)',
    label: 'Inscrição Estadual (IE - SEFAZ-PI)',
    section: 'dados_empresariais',
    visible: true,
    required: false,
    order: 4,
    showInSummary: true,
    placeholder: 'Ex: 19.456.789-0',
  },
  {
    key: 'municipalRegistration',
    defaultLabel: 'Inscrição Municipal (CMC Prefeitura)',
    label: 'Inscrição Municipal (CMC Prefeitura)',
    section: 'dados_empresariais',
    visible: true,
    required: false,
    order: 5,
    showInSummary: true,
    placeholder: 'Ex: 458920-1',
  },
  {
    key: 'nire',
    defaultLabel: 'NIRE (JUCEPI)',
    label: 'NIRE (JUCEPI)',
    section: 'dados_empresariais',
    visible: true,
    required: false,
    order: 6,
    showInSummary: true,
    placeholder: 'Ex: 22200123456',
  },
  {
    key: 'cnaeMain',
    defaultLabel: 'CNAE Principal',
    label: 'CNAE Principal',
    section: 'dados_empresariais',
    visible: true,
    required: false,
    order: 7,
    showInSummary: false,
    placeholder: 'Ex: 81.22-2-00 - Imunização e controle de pragas',
  },
  {
    key: 'legalNature',
    defaultLabel: 'Natureza Jurídica',
    label: 'Natureza Jurídica',
    section: 'dados_empresariais',
    visible: false,
    required: false,
    order: 8,
    showInSummary: false,
    placeholder: 'Ex: 206-2 - Sociedade Empresária Limitada',
  },
  {
    key: 'openingDate',
    defaultLabel: 'Data de Abertura',
    label: 'Data de Abertura',
    section: 'dados_empresariais',
    visible: false,
    required: false,
    order: 9,
    showInSummary: false,
    placeholder: 'AAAA-MM-DD',
  },
  {
    key: 'shareCapital',
    defaultLabel: 'Capital Social',
    label: 'Capital Social',
    section: 'dados_empresariais',
    visible: false,
    required: false,
    order: 10,
    showInSummary: false,
    placeholder: 'Ex: R$ 100.000,00',
  },
  {
    key: 'companySize',
    defaultLabel: 'Porte da Empresa',
    label: 'Porte da Empresa',
    section: 'dados_empresariais',
    visible: false,
    required: false,
    order: 11,
    showInSummary: false,
    placeholder: 'Ex: ME / EPP / Demais',
  },
  {
    key: 'cadastralSituation',
    defaultLabel: 'Situação Cadastral',
    label: 'Situação Cadastral',
    section: 'dados_empresariais',
    visible: false,
    required: false,
    order: 12,
    showInSummary: false,
    placeholder: 'Ex: ATIVA',
  },

  // 2. Endereço e Contato
  {
    key: 'cep',
    defaultLabel: 'CEP',
    label: 'CEP',
    section: 'endereco_contato',
    visible: true,
    required: false,
    order: 13,
    showInSummary: false,
    placeholder: '64000-000',
  },
  {
    key: 'address',
    defaultLabel: 'Logradouro / Endereço',
    label: 'Logradouro / Endereço',
    section: 'endereco_contato',
    visible: true,
    required: false,
    order: 14,
    showInSummary: false,
    placeholder: 'Rua, Avenida...',
  },
  {
    key: 'addressNumber',
    defaultLabel: 'Número',
    label: 'Número',
    section: 'endereco_contato',
    visible: false,
    required: false,
    order: 15,
    showInSummary: false,
    placeholder: 'Ex: 1250',
  },
  {
    key: 'addressComplement',
    defaultLabel: 'Complemento',
    label: 'Complemento',
    section: 'endereco_contato',
    visible: false,
    required: false,
    order: 16,
    showInSummary: false,
    placeholder: 'Sala, Bloco...',
  },
  {
    key: 'neighborhood',
    defaultLabel: 'Bairro',
    label: 'Bairro',
    section: 'endereco_contato',
    visible: false,
    required: false,
    order: 17,
    showInSummary: false,
    placeholder: 'Ex: Centro',
  },
  {
    key: 'cityState',
    defaultLabel: 'Município / UF',
    label: 'Município / UF',
    section: 'endereco_contato',
    visible: true,
    required: false,
    order: 18,
    showInSummary: true,
    placeholder: 'Ex: Teresina - PI',
  },
  {
    key: 'uf',
    defaultLabel: 'UF',
    label: 'UF',
    section: 'endereco_contato',
    visible: false,
    required: false,
    order: 19,
    showInSummary: false,
    placeholder: 'PI',
  },
  {
    key: 'phone',
    defaultLabel: 'Telefone',
    label: 'Telefone',
    section: 'endereco_contato',
    visible: true,
    required: false,
    order: 20,
    showInSummary: true,
    placeholder: '(86) 99999-0000',
  },
  {
    key: 'whatsapp',
    defaultLabel: 'WhatsApp',
    label: 'WhatsApp',
    section: 'endereco_contato',
    visible: false,
    required: false,
    order: 21,
    showInSummary: false,
    placeholder: '(86) 99999-0000',
  },
  {
    key: 'email',
    defaultLabel: 'E-mail para Certidões',
    label: 'E-mail para Certidões',
    section: 'endereco_contato',
    visible: true,
    required: false,
    order: 22,
    showInSummary: true,
    placeholder: 'licitacoes@empresa.com.br',
  },
  {
    key: 'website',
    defaultLabel: 'Site',
    label: 'Site',
    section: 'endereco_contato',
    visible: false,
    required: false,
    order: 23,
    showInSummary: false,
    placeholder: 'https://...',
  },

  // 3. Representante Legal
  {
    key: 'partnerName',
    defaultLabel: 'Nome do Representante Legal / Sócio',
    label: 'Nome do Representante Legal / Sócio',
    section: 'representante_legal',
    visible: true,
    required: false,
    order: 24,
    showInSummary: true,
    placeholder: 'Nome completo',
  },
  {
    key: 'partnerCpf',
    defaultLabel: 'CPF do Representante Legal',
    label: 'CPF do Representante Legal',
    section: 'representante_legal',
    visible: true,
    required: false,
    order: 25,
    showInSummary: true,
    placeholder: '000.000.000-00',
  },
  {
    key: 'partnerRg',
    defaultLabel: 'RG do Representante',
    label: 'RG do Representante',
    section: 'representante_legal',
    visible: true,
    required: false,
    order: 26,
    showInSummary: false,
    placeholder: '0.000.000 SSP-PI',
  },
  {
    key: 'partnerBirthDate',
    defaultLabel: 'Data de Nascimento do Sócio',
    label: 'Data de Nascimento do Sócio',
    section: 'representante_legal',
    visible: true,
    required: false,
    order: 27,
    showInSummary: false,
  },
  {
    key: 'partnerRole',
    defaultLabel: 'Cargo do Representante',
    label: 'Cargo do Representante',
    section: 'representante_legal',
    visible: false,
    required: false,
    order: 28,
    showInSummary: false,
    placeholder: 'Ex: Sócio-Administrador',
  },
  {
    key: 'partnerPhone',
    defaultLabel: 'Telefone do Representante',
    label: 'Telefone do Representante',
    section: 'representante_legal',
    visible: false,
    required: false,
    order: 29,
    showInSummary: false,
  },
  {
    key: 'partnerEmail',
    defaultLabel: 'E-mail do Representante',
    label: 'E-mail do Representante',
    section: 'representante_legal',
    visible: false,
    required: false,
    order: 30,
    showInSummary: false,
  },

  // 4. Responsável Técnico
  {
    key: 'techResponsibleName',
    defaultLabel: 'Nome do Responsável Técnico (RT)',
    label: 'Nome do Responsável Técnico (RT)',
    section: 'responsavel_tecnico',
    visible: true,
    required: false,
    order: 31,
    showInSummary: false,
  },
  {
    key: 'techResponsibleCpf',
    defaultLabel: 'CPF do Responsável Técnico',
    label: 'CPF do Responsável Técnico',
    section: 'responsavel_tecnico',
    visible: true,
    required: false,
    order: 32,
    showInSummary: false,
  },
  {
    key: 'techResponsibleCouncil',
    defaultLabel: 'Conselho Profissional / Registro (CREA-PI / CRQ / CRBio)',
    label: 'Conselho Profissional / Registro (CREA-PI / CRQ / CRBio)',
    section: 'responsavel_tecnico',
    visible: true,
    required: false,
    order: 33,
    showInSummary: true,
  },
  {
    key: 'techResponsibleRegNumber',
    defaultLabel: 'Número de Registro no Conselho',
    label: 'Número de Registro no Conselho',
    section: 'responsavel_tecnico',
    visible: false,
    required: false,
    order: 34,
    showInSummary: false,
  },
  {
    key: 'techResponsibleSpecialty',
    defaultLabel: 'Especialidade Técnica',
    label: 'Especialidade Técnica',
    section: 'responsavel_tecnico',
    visible: false,
    required: false,
    order: 35,
    showInSummary: false,
    placeholder: 'Ex: Engenheiro Químico / Agrônomo / Biólogo',
  },
  {
    key: 'techResponsibleValidUntil',
    defaultLabel: 'Data de Validade do Registro RT',
    label: 'Data de Validade do Registro RT',
    section: 'responsavel_tecnico',
    visible: false,
    required: false,
    order: 36,
    showInSummary: false,
  },

  // 5. Informações Adicionais
  {
    key: 'portalAccessNotes',
    defaultLabel: 'Dados Específicos de Portais (SIAT, SEFAZ-PI, JUCEPI)',
    label: 'Dados Específicos de Portais (SIAT, SEFAZ-PI, JUCEPI)',
    section: 'informacoes_adicionais',
    visible: true,
    required: false,
    order: 37,
    showInSummary: false,
  },
  {
    key: 'generalNotes',
    defaultLabel: 'Observações Gerais da Empresa',
    label: 'Observações Gerais da Empresa',
    section: 'informacoes_adicionais',
    visible: false,
    required: false,
    order: 38,
    showInSummary: false,
  },
  {
    key: 'adminNotes',
    defaultLabel: 'Informações Administrativas Internas',
    label: 'Informações Administrativas Internas',
    section: 'informacoes_adicionais',
    visible: false,
    required: false,
    order: 39,
    showInSummary: false,
  },
];

export const DEFAULT_CERTIDAO_FIELDS: CertidaoFieldConfig[] = [
  {
    key: 'name',
    defaultLabel: 'Nome da Certidão / Licença',
    label: 'Nome da Certidão / Licença',
    visible: true,
    required: true,
    order: 1,
    essential: true,
  },
  {
    key: 'category',
    defaultLabel: 'Categoria',
    label: 'Categoria',
    visible: true,
    required: true,
    order: 2,
    essential: true,
  },
  {
    key: 'issuer',
    defaultLabel: 'Órgão Emissor',
    label: 'Órgão Emissor',
    visible: true,
    required: false,
    order: 3,
  },
  {
    key: 'certificateNumber',
    defaultLabel: 'Número do Documento / Certidão',
    label: 'Número do Documento / Certidão',
    visible: true,
    required: false,
    order: 4,
  },
  {
    key: 'controlCode',
    defaultLabel: 'Código de Autenticidade / Controle',
    label: 'Código de Autenticidade / Controle',
    visible: true,
    required: false,
    order: 5,
  },
  {
    key: 'protocolNumber',
    defaultLabel: 'Número de Protocolo',
    label: 'Número de Protocolo',
    visible: true,
    required: false,
    order: 6,
  },
  {
    key: 'issueDate',
    defaultLabel: 'Data de Emissão',
    label: 'Data de Emissão',
    visible: true,
    required: false,
    order: 7,
  },
  {
    key: 'validityDays',
    defaultLabel: 'Prazo de Validade (Dias)',
    label: 'Prazo de Validade (Dias)',
    visible: true,
    required: false,
    order: 8,
  },
  {
    key: 'expirationDate',
    defaultLabel: 'Data de Vencimento',
    label: 'Data de Vencimento',
    visible: true,
    required: false,
    order: 9,
    essential: true,
  },
  {
    key: 'documentSituation',
    defaultLabel: 'Situação da Certidão',
    label: 'Situação da Certidão',
    visible: true,
    required: false,
    order: 10,
  },
  {
    key: 'emitterUrl',
    defaultLabel: 'Link Oficial do Portal Emissor',
    label: 'Link Oficial do Portal Emissor',
    visible: true,
    required: false,
    order: 11,
  },
  {
    key: 'primaryAutoFillField',
    defaultLabel: 'Dado Principal para Emissão Assistida',
    label: 'Dado Principal para Emissão Assistida',
    visible: true,
    required: false,
    order: 12,
  },
  {
    key: 'notes',
    defaultLabel: 'Observações',
    label: 'Observações',
    visible: true,
    required: false,
    order: 13,
  },
  {
    key: 'pdfAttachment',
    defaultLabel: 'Arquivo PDF Anexado',
    label: 'Arquivo PDF Anexado',
    visible: true,
    required: false,
    order: 14,
  },
];

export const DEFAULT_TABLE_COLUMNS: TableColumnConfig[] = [
  {
    key: 'index',
    defaultLabel: 'Nº',
    label: 'Nº',
    visible: true,
    order: 1,
    width: 'compact',
  },
  {
    key: 'status',
    defaultLabel: 'Status / Contagem',
    label: 'Status / Contagem',
    visible: true,
    order: 2,
    width: 'normal',
  },
  {
    key: 'name',
    defaultLabel: 'Certidão / Documento',
    label: 'Certidão / Documento',
    visible: true,
    order: 3,
    width: 'wide',
  },
  {
    key: 'company',
    defaultLabel: 'Empresa',
    label: 'Empresa',
    visible: true,
    order: 4,
    width: 'normal',
  },
  {
    key: 'issuer',
    defaultLabel: 'Órgão Emissor',
    label: 'Órgão Emissor',
    visible: true,
    order: 5,
    width: 'normal',
  },
  {
    key: 'controlCode',
    defaultLabel: 'Código Autenticidade / Nº',
    label: 'Código Autenticidade / Nº',
    visible: true,
    order: 6,
    width: 'normal',
  },
  {
    key: 'protocolNumber',
    defaultLabel: 'Protocolo',
    label: 'Protocolo',
    visible: false,
    order: 7,
    width: 'compact',
  },
  {
    key: 'situation',
    defaultLabel: 'Situação',
    label: 'Situação',
    visible: false,
    order: 8,
    width: 'normal',
  },
  {
    key: 'dates',
    defaultLabel: 'Emissão / Prazo / Vencimento',
    label: 'Emissão / Prazo / Vencimento',
    visible: true,
    order: 9,
    width: 'normal',
  },
  {
    key: 'portalAction',
    defaultLabel: 'Emissão Assistida',
    label: 'Emissão Assistida',
    visible: true,
    order: 10,
    width: 'normal',
  },
  {
    key: 'pdfAction',
    defaultLabel: 'Arquivo PDF',
    label: 'Arquivo PDF',
    visible: true,
    order: 11,
    width: 'normal',
  },
  {
    key: 'actions',
    defaultLabel: 'Ações',
    label: 'Ações',
    visible: true,
    order: 12,
    width: 'compact',
  },
];

export const DEFAULT_DOCUMENT_MODELS: DocumentModelConfig[] = [
  {
    templateKey: 'tpl-01-cndt',
    name: 'CNDT (Certidão Negativa de Débitos Trabalhistas)',
    category: 'Fiscais e Trabalhistas',
    issuer: 'TST - Tribunal Superior do Trabalho',
    emitterUrl: 'https://cndt-certidao.tst.jus.br/',
    primaryAutoFillField: 'cnpj_num',
    portalFieldsHint: 'Pede: CNPJ (somente números) + Captcha da imagem',
    isPermanent: false,
    defaultValidityDays: 180,
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 1,
  },
  {
    templateKey: 'tpl-02-cnpj',
    name: 'Cartão CNPJ (Comprovante de Inscrição e Situação Cadastral)',
    category: 'Fiscais e Trabalhistas',
    issuer: 'Receita Federal',
    emitterUrl: 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp',
    primaryAutoFillField: 'cnpj_num',
    portalFieldsHint: 'Pede: CNPJ (14 dígitos sem pontos) + Captcha Sou Humano',
    isPermanent: false,
    defaultValidityDays: 90,
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 2,
  },
  {
    templateKey: 'tpl-03-cnd-federal',
    name: 'Dívida Ativa da União (CND Federal Conjunta RFB/PGFN)',
    category: 'Fiscais e Trabalhistas',
    issuer: 'Receita Federal / PGFN',
    emitterUrl: 'https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir',
    primaryAutoFillField: 'cnpj_num',
    portalFieldsHint: 'Pede: NI/CNPJ (somente números) + Captcha',
    isPermanent: false,
    defaultValidityDays: 180,
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 3,
  },
  {
    templateKey: 'tpl-04-pge-pi',
    name: 'Dívida Ativa do Estado do Piauí (PGE-PI / SEFAZ-PI)',
    category: 'Fiscais e Trabalhistas',
    issuer: 'SEFAZ-PI / PGE-PI',
    emitterUrl: 'https://webas.sefaz.pi.gov.br/certidaonft-web/index.xhtml',
    primaryAutoFillField: 'cnpj_num',
    portalFieldsHint: 'Pede: CNPJ ou Inscrição Estadual (IE SEFAZ-PI) + Captcha',
    isPermanent: false,
    defaultValidityDays: 60,
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 4,
  },
  {
    templateKey: 'tpl-05-sefaz-pi',
    name: 'Certidão Fiscal e Tributária Estadual (SEFAZ-PI)',
    category: 'Fiscais e Trabalhistas',
    issuer: 'SEFAZ-PI (Secretaria da Fazenda do Piauí)',
    emitterUrl: 'https://webas.sefaz.pi.gov.br/certidaonft-web/index.xhtml',
    primaryAutoFillField: 'cnpj_num',
    portalFieldsHint: 'Pede: CNPJ ou IE (19...) + Código da Imagem (Captcha)',
    isPermanent: false,
    defaultValidityDays: 60,
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 5,
  },
  {
    templateKey: 'tpl-06-prefeitura-pi',
    name: 'Dívida Ativa do Município (CND Municipal / ISS)',
    category: 'Fiscais e Trabalhistas',
    issuer: 'Prefeitura Municipal (SEMF Teresina / PI)',
    emitterUrl: 'https://semf.pmt.pi.gov.br/',
    primaryAutoFillField: 'im_num',
    portalFieldsHint: 'Pede: Inscrição Municipal (CMC) ou CNPJ + Captcha',
    isPermanent: false,
    defaultValidityDays: 90,
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 6,
  },
  {
    templateKey: 'tpl-07-falencia-tjpi',
    name: 'Certidão Negativa de Falência e Concordata (TJPI)',
    category: 'Fiscais e Trabalhistas',
    issuer: 'TJPI - Tribunal de Justiça do Piauí',
    emitterUrl: 'https://www.tjpi.jus.br/portaltjpi/certidoes/',
    primaryAutoFillField: 'cnpj_num',
    portalFieldsHint: 'Pede: CNPJ + Razão Social + CPF/Nome do Solicitante + E-mail + Captcha',
    isPermanent: false,
    defaultValidityDays: 90,
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 7,
  },
  {
    templateKey: 'tpl-08-fgts',
    name: 'CRF - Certificado de Regularidade do FGTS',
    category: 'Fiscais e Trabalhistas',
    issuer: 'Caixa Econômica Federal',
    emitterUrl: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf',
    primaryAutoFillField: 'cnpj_num',
    portalFieldsHint: 'Pede: Inscrição CNPJ (só números) + UF (PI) + Captcha',
    isPermanent: false,
    defaultValidityDays: 30,
    customWarningDays: 15,
    enabled: true,
    includeOnNewCompany: true,
    order: 8,
  },
  {
    templateKey: 'tpl-09-jucepi',
    name: 'Certidão Simplificada e Específica (JUCEPI - Junta Comercial PI)',
    category: 'Fiscais e Trabalhistas',
    issuer: 'JUCEPI - Junta Comercial do Estado do Piauí',
    emitterUrl: 'https://www.pi.gov.br/orgaos/junta-comercial-do-estado-do-piaui-jucepi/',
    primaryAutoFillField: 'cnpj_num',
    portalFieldsHint: 'Pede: CNPJ ou NIRE + Login Gov.br',
    isPermanent: false,
    defaultValidityDays: 90,
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 9,
  },
  {
    templateKey: 'tpl-10-alvara',
    name: 'Alvará de Funcionamento',
    category: 'Alvarás, Licenças e Conselhos',
    issuer: 'Prefeitura Municipal (Teresina / PI)',
    emitterUrl: 'https://semf.pmt.pi.gov.br/',
    primaryAutoFillField: 'im_num',
    portalFieldsHint: 'Pede: Inscrição Municipal (CMC) ou CNPJ',
    isPermanent: false,
    defaultValidityDays: 365,
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 10,
  },
  {
    templateKey: 'tpl-11-bombeiros-pi',
    name: 'Licença / Certificado do Corpo de Bombeiros (CBMEPI)',
    category: 'Alvarás, Licenças e Conselhos',
    issuer: 'CBMEPI - Corpo de Bombeiros Militar do Piauí',
    emitterUrl: 'https://www.bombeiros.pi.gov.br/',
    primaryAutoFillField: 'cnpj_num',
    portalFieldsHint: 'Pede: CNPJ + Protocolo de Vistoria CBMEPI',
    isPermanent: false,
    defaultValidityDays: 365,
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 11,
  },
  {
    templateKey: 'tpl-12-ambiental-pi',
    name: 'Licença Ambiental (SEMARH-PI / Secretaria Municipal)',
    category: 'Alvarás, Licenças e Conselhos',
    issuer: 'Órgão Ambiental (SEMARH-PI / SEMAM)',
    emitterUrl: 'https://www.semarh.pi.gov.br/',
    primaryAutoFillField: 'cnpj_num',
    portalFieldsHint: 'Pede: CNPJ + CPF Representante Legal',
    isPermanent: false,
    defaultValidityDays: 365,
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 12,
  },
  {
    templateKey: 'tpl-13-vigilancia-pi',
    name: 'Licença / Alvará de Vigilância Sanitária (DIVISA-PI / GVS)',
    category: 'Alvarás, Licenças e Conselhos',
    issuer: 'Vigilância Sanitária (DIVISA-PI / GVS Teresina)',
    emitterUrl: 'https://www.saude.pi.gov.br/',
    primaryAutoFillField: 'cnpj_num',
    portalFieldsHint: 'Pede: CNPJ + Inscrição Municipal + Dados do RT',
    isPermanent: false,
    defaultValidityDays: 365,
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 13,
  },
  {
    templateKey: 'tpl-14-aft',
    name: 'AFT (Autorização de Funcionamento / Atestado)',
    category: 'Alvarás, Licenças e Conselhos',
    issuer: 'ANVISA / Órgão Regulador',
    emitterUrl: 'https://consultas.anvisa.gov.br/',
    primaryAutoFillField: 'cnpj_num',
    portalFieldsHint: 'Pede: CNPJ da Empresa',
    isPermanent: false,
    defaultValidityDays: 365,
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 14,
  },
  {
    templateKey: 'tpl-15-conselho',
    name: 'Certidão de Quitação e Regularidade (Conselho - CRQ/CRBio/CREA-PI)',
    category: 'Alvarás, Licenças e Conselhos',
    issuer: 'Conselho de Classe (CRQ / CRBio / CREA-PI)',
    emitterUrl: 'https://www.crea-pi.org.br/',
    primaryAutoFillField: 'council',
    portalFieldsHint: 'Pede: CNPJ ou Registro no Conselho + CPF do RT',
    isPermanent: false,
    defaultValidityDays: 365,
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 15,
  },
  {
    templateKey: 'tpl-16-trt-art',
    name: 'CTD de Anotação Técnica e Termo de Responsabilidade Técnica (TRT/ART)',
    category: 'Alvarás, Licenças e Conselhos',
    issuer: 'Conselho de Classe (CRQ / CRBio / CREA-PI)',
    emitterUrl: 'https://www.crea-pi.org.br/',
    primaryAutoFillField: 'council',
    portalFieldsHint: 'Pede: Registro no Conselho / CPF do RT',
    isPermanent: false,
    defaultValidityDays: 365,
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 16,
  },
  {
    templateKey: 'tpl-17-descarte',
    name: 'Certificado de Descarte Regular de Resíduos',
    category: 'Alvarás, Licenças e Conselhos',
    issuer: 'Operador Credenciado / SEMARH-PI',
    emitterUrl: 'https://sinir.gov.br/',
    primaryAutoFillField: 'cnpj_num',
    portalFieldsHint: 'Pede: CNPJ + Login SINIR/MTR',
    isPermanent: false,
    defaultValidityDays: 365,
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 17,
  },
  {
    templateKey: 'tpl-18-contrato-social',
    name: 'Contrato Social e Aditivo 3 Assinado',
    category: 'Societário, Contábil e Qualificação Técnica',
    issuer: 'JUCEPI - Junta Comercial do Estado do Piauí',
    emitterUrl: 'https://www.pi.gov.br/orgaos/junta-comercial-do-estado-do-piaui-jucepi/',
    primaryAutoFillField: 'nire',
    portalFieldsHint: 'Pede: NIRE ou CNPJ',
    isPermanent: true,
    defaultValidityDays: '',
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 18,
  },
  {
    templateKey: 'tpl-19-qsa',
    name: 'QSA (Quadro de Sócios e Administradores)',
    category: 'Societário, Contábil e Qualificação Técnica',
    issuer: 'Receita Federal / Redesim',
    emitterUrl: 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp',
    primaryAutoFillField: 'cnpj_num',
    portalFieldsHint: 'Emitido junto ao Cartão CNPJ na Receita Federal',
    isPermanent: true,
    defaultValidityDays: '',
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 19,
  },
  {
    templateKey: 'tpl-20-cnh',
    name: 'CNH-e (Sócios / Representantes)',
    category: 'Societário, Contábil e Qualificação Técnica',
    issuer: 'DETRAN-PI / SENATRAN',
    emitterUrl: 'https://www.detran.pi.gov.br/',
    primaryAutoFillField: 'cpf_num',
    portalFieldsHint: 'Pede: CPF do Sócio Administrador',
    isPermanent: false,
    defaultValidityDays: 1825,
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 20,
  },
  {
    templateKey: 'tpl-21-ie-im',
    name: 'Inscrição Estadual (IE - SEFAZ-PI) e Inscrição Municipal (IM)',
    category: 'Societário, Contábil e Qualificação Técnica',
    issuer: 'SEFAZ-PI / Prefeitura Municipal',
    emitterUrl: 'https://webas.sefaz.pi.gov.br/sintegra/',
    primaryAutoFillField: 'ie_num',
    portalFieldsHint: 'Pede: Inscrição Estadual (IE) ou CNPJ + Captcha',
    isPermanent: true,
    defaultValidityDays: '',
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 21,
  },
  {
    templateKey: 'tpl-22-balanco',
    name: 'Balanços Patrimoniais e Índices Contábeis (2023, 2024, 2025)',
    category: 'Societário, Contábil e Qualificação Técnica',
    issuer: 'Contabilidade / SPED ECD / JUCEPI',
    emitterUrl: 'https://sped.rfb.gov.br/',
    primaryAutoFillField: 'cnpj_num',
    portalFieldsHint: 'Pede: CNPJ + Recibo SPED',
    isPermanent: false,
    defaultValidityDays: 365,
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 22,
  },
  {
    templateKey: 'tpl-23-atestados',
    name: 'Atestados de Capacidade Técnica (1, 2, 3 e Completo)',
    category: 'Societário, Contábil e Qualificação Técnica',
    issuer: 'Clientes Contratantes / Acervo Técnico',
    emitterUrl: '',
    primaryAutoFillField: 'cnpj_num',
    portalFieldsHint: 'Acervo interno da empresa',
    isPermanent: true,
    defaultValidityDays: '',
    customWarningDays: '',
    enabled: true,
    includeOnNewCompany: true,
    order: 23,
  },
];

export function buildDefaultAppSettings(): AppSettings {
  return {
    version: 1,
    globalWarningDays: 30,
    companyFields: DEFAULT_COMPANY_FIELDS.map((f) => ({ ...f })),
    certidaoFields: DEFAULT_CERTIDAO_FIELDS.map((f) => ({ ...f })),
    customFields: [],
    tableColumns: DEFAULT_TABLE_COLUMNS.map((c) => ({ ...c })),
    documentModels: DEFAULT_DOCUMENT_MODELS.map((m) => ({ ...m })),
    pdfReader: {
      autoReadOnAttach: true,
      enableOcr: true,
      autoIdentifyCompany: true,
      suggestCompanyUpdates: true,
      detectDuplicates: true,
      useGeminiWhenAvailable: false,
      requireReviewBeforeSave: true,
    },
    appearance: {
      theme: 'dark',
      density: 'compact',
      pageSize: 50,
      defaultSortBy: 'priority',
      detailLevel: 'detalhado',
      showQuickCompanyBar: true,
      showDashboardShortcuts: true,
      showBatchDropzoneOnDashboard: true,
    },
    companyOverrides: {},
  };
}

export function mergeWithDefaultSettings(raw: Partial<AppSettings> | null | undefined): AppSettings {
  const defaults = buildDefaultAppSettings();
  if (!raw || typeof raw !== 'object') return defaults;

  const savedCompMap = new Map(
    Array.isArray(raw.companyFields) ? raw.companyFields.map((f) => [f.key, f]) : []
  );
  const mergedCompanyFields = DEFAULT_COMPANY_FIELDS.map((def) => {
    const saved = savedCompMap.get(def.key);
    if (!saved) return { ...def };
    return {
      ...def,
      ...saved,
      key: def.key,
      defaultLabel: def.defaultLabel,
      essential: def.essential,
      visible: def.essential ? true : Boolean(saved.visible),
      required: def.essential ? true : Boolean(saved.required),
    };
  }).sort((a, b) => a.order - b.order);

  const savedCertMap = new Map(
    Array.isArray(raw.certidaoFields) ? raw.certidaoFields.map((f) => [f.key, f]) : []
  );
  const mergedCertidaoFields = DEFAULT_CERTIDAO_FIELDS.map((def) => {
    const saved = savedCertMap.get(def.key);
    if (!saved) return { ...def };
    return {
      ...def,
      ...saved,
      key: def.key,
      defaultLabel: def.defaultLabel,
      essential: def.essential,
      visible: def.essential ? true : Boolean(saved.visible),
    };
  }).sort((a, b) => a.order - b.order);

  const savedColMap = new Map(
    Array.isArray(raw.tableColumns) ? raw.tableColumns.map((c) => [c.key, c]) : []
  );
  const mergedTableColumns = DEFAULT_TABLE_COLUMNS.map((def) => {
    const saved = savedColMap.get(def.key);
    if (!saved) return { ...def };
    return {
      ...def,
      ...saved,
      key: def.key,
      defaultLabel: def.defaultLabel,
    };
  }).sort((a, b) => a.order - b.order);

  // Merge standard 23 document models + any custom user-created models
  const savedModels = Array.isArray(raw.documentModels) ? raw.documentModels : [];
  const savedModelMap = new Map(savedModels.map((m) => [m.templateKey, m]));
  const mergedStandardModels = DEFAULT_DOCUMENT_MODELS.map((def) => {
    const saved = savedModelMap.get(def.templateKey);
    return saved ? { ...def, ...saved, templateKey: def.templateKey } : { ...def };
  });
  const customModels = savedModels.filter(
    (m) => m.isCustomModel && !DEFAULT_DOCUMENT_MODELS.some((d) => d.templateKey === m.templateKey)
  );
  const mergedDocumentModels = [...mergedStandardModels, ...customModels].sort(
    (a, b) => a.order - b.order
  );

  return {
    version: 1,
    globalWarningDays: Number(raw.globalWarningDays) || defaults.globalWarningDays,
    companyFields: mergedCompanyFields,
    certidaoFields: mergedCertidaoFields,
    customFields: Array.isArray(raw.customFields) ? raw.customFields : [],
    tableColumns: mergedTableColumns,
    documentModels: mergedDocumentModels,
    pdfReader: {
      ...defaults.pdfReader,
      ...(raw.pdfReader || {}),
    },
    appearance: {
      ...defaults.appearance,
      ...(raw.appearance || {}),
    },
    companyOverrides:
      raw.companyOverrides && typeof raw.companyOverrides === 'object' ? raw.companyOverrides : {},
  };
}

/**
 * Resolve os campos do cadastro de empresas respeitando configuração global + override individual por empresa
 */
export function getEffectiveCompanyFields(
  settings: AppSettings,
  companyId?: string
): CompanyFieldConfig[] {
  const override = companyId ? settings.companyOverrides[companyId] : undefined;
  return [...settings.companyFields]
    .map((f) => {
      if (f.essential) return { ...f, visible: true, required: true };
      let visible = f.visible;
      let required = f.required;
      if (override) {
        if (override.hiddenCompanyFields?.includes(f.key)) visible = false;
        if (override.visibleCompanyFields?.includes(f.key)) visible = true;
        if (override.requiredCompanyFields?.includes(f.key)) required = true;
      }
      return { ...f, visible, required };
    })
    .sort((a, b) => a.order - b.order);
}

/**
 * Resolve os campos personalizados aplicáveis a todas as empresas ou a uma empresa específica
 */
export function getEffectiveCustomFields(
  settings: AppSettings,
  target: 'company' | 'certificate',
  companyId?: string
): CustomFieldDefinition[] {
  return settings.customFields
    .filter((cf) => {
      if (!cf.visible) return false;
      if (cf.target !== target) return false;
      if (cf.companyScope === 'all') return true;
      return Boolean(companyId && cf.companyScope === companyId);
    })
    .sort((a, b) => a.order - b.order);
}

/**
 * Calcula o prazo de alerta efetivo para uma certidão (respeitando modelo específico, empresa ou alerta global)
 */
export function getEffectiveWarningDaysForDoc(
  doc: CertidaoDocument,
  settings: AppSettings,
  fallbackWarningDays: number
): number {
  if (doc.templateKey) {
    const model = settings.documentModels.find((m) => m.templateKey === doc.templateKey);
    if (model && model.customWarningDays !== undefined && model.customWarningDays !== '') {
      const n = Number(model.customWarningDays);
      if (n > 0) return n;
    }
  }
  const compOverride = settings.companyOverrides[doc.companyId];
  if (compOverride?.customWarningDays && compOverride.customWarningDays > 0) {
    return compOverride.customWarningDays;
  }
  return fallbackWarningDays || settings.globalWarningDays || 30;
}

/**
 * Gera documentos para uma nova empresa com base nos modelos configurados em MODELOS DE CERTIDÕES
 */
export function buildDocumentsFromConfiguredModels(
  company: CompanyProfile,
  settings: AppSettings
): CertidaoDocument[] {
  const now = new Date().toISOString();
  const activeModels = settings.documentModels
    .filter((m) => m.enabled && m.includeOnNewCompany)
    .sort((a, b) => a.order - b.order);

  return activeModels.map((model, idx) => ({
    id: `${company.id}-doc-${String(idx + 1).padStart(2, '0')}-${Date.now().toString(36)}`,
    companyId: company.id,
    templateKey: model.templateKey,
    name: model.name,
    category: model.category,
    issuer: model.issuer,
    emitterUrl: model.emitterUrl,
    registrationCode:
      model.primaryAutoFillField === 'ie_num'
        ? company.stateRegistration || company.cnpj
        : model.primaryAutoFillField === 'im_num'
        ? company.municipalRegistration || company.cnpj
        : model.primaryAutoFillField === 'nire'
        ? company.nire || company.cnpj
        : model.primaryAutoFillField === 'council'
        ? company.techResponsibleCouncil || company.cnpj
        : model.primaryAutoFillField === 'cpf_num'
        ? company.partnerCpf || company.cnpj
        : company.cnpj,
    primaryAutoFillField: model.primaryAutoFillField,
    portalFieldsHint: model.portalFieldsHint,
    issueDate: '',
    validityDays: model.isPermanent ? '' : model.defaultValidityDays,
    expirationDate: '',
    isPermanent: model.isPermanent,
    notes: '',
    fileType: 'none',
    updatedAt: now,
  }));
}
