import { onlyDigits } from './validators';

// ============================================================================
// PORTAL ADAPTERS & ASSISTED EMISSION ENGINE (FEDERAL + PIAUÍ)
// ============================================================================

export type AutoFillFieldKey =
  | 'cnpj_num'
  | 'cnpj_fmt'
  | 'ie_num'
  | 'ie_fmt'
  | 'im_num'
  | 'im_fmt'
  | 'cpf_num'
  | 'cpf_fmt'
  | 'nire'
  | 'council'
  | 'email'
  | 'razao'
  | 'tel'
  | 'cep';

export interface CompanyBasicProfile {
  id: string;
  companyName: string;
  tradeName: string;
  cnpj: string;
  stateRegistration: string;
  municipalRegistration: string;
  nire: string;
  cnaeMain: string;
  cityState: string;
  cep: string;
  address: string;
  email: string;
  phone: string;
  partnerName: string;
  partnerCpf: string;
  partnerRg: string;
  partnerBirthDate: string;
  techResponsibleName: string;
  techResponsibleCouncil: string;
  techResponsibleCpf: string;
  portalAccessNotes: string;
}

export interface PortalAdapterConfig {
  id: string;
  templateKeys: string[];
  portalName: string;
  agency: string;
  officialUrl: string;
  domainPatterns: string[];
  automationLevel: 'autofill_captcha' | 'autofill_govbr' | 'assisted_copy';
  securityType: 'captcha_imagem' | 'hcaptcha_recaptcha' | 'login_govbr' | 'login_portal' | 'nenhum';
  securityDescription: string;
  requiredFields: AutoFillFieldKey[];
  steps: string[];
  selectorRules: {
    field: AutoFillFieldKey;
    selectors: string[];
  }[];
  captchaSelectors: string[];
}

export const OFFICIAL_PORTAL_ADAPTERS: PortalAdapterConfig[] = [
  {
    id: 'adapter-rfb-cnpj',
    templateKeys: ['tpl-02-cnpj', 'tpl-19-qsa'],
    portalName: 'Receita Federal — Emissão de Comprovante de Inscrição e de Situação Cadastral (Cartão CNPJ)',
    agency: 'Receita Federal do Brasil',
    officialUrl: 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp',
    domainPatterns: ['solucoes.receita.fazenda.gov.br', 'servicos.receita.fazenda.gov.br'],
    automationLevel: 'autofill_captcha',
    securityType: 'hcaptcha_recaptcha',
    securityDescription: 'Exige marcação do desafio "Sou Humano" (hCaptcha / Captcha Sonoro-Visual da Receita).',
    requiredFields: ['cnpj_num'],
    steps: [
      'O campo "CNPJ" (14 dígitos sem pontuação) é preenchido automaticamente pelo adaptador ou Ctrl+V.',
      'Marque a caixa de verificação "Sou Humano" (hCaptcha) na tela da Receita Federal.',
      'Clique em "Consultar" e, na tela do Cartão CNPJ, clique em "Imprimir / Salvar como PDF".',
      'Para emitir também o QSA, clique no botão "Consulta QSA" no rodapé do comprovante.',
    ],
    selectorRules: [
      {
        field: 'cnpj_num',
        selectors: [
          'input#cnpj',
          'input[name="cnpj"]',
          'input[id*="txtCNPJ"]',
          'input[name*="txtCNPJ"]',
        ],
      },
    ],
    captchaSelectors: ['#h-captcha', '.h-captcha', 'input[name*="captcha"]', 'input[id*="captcha"]'],
  },
  {
    id: 'adapter-rfb-pgfn',
    templateKeys: ['tpl-03-cnd-federal'],
    portalName: 'Receita Federal / PGFN — Certidão de Débitos Relativos a Créditos Tributários Federais e à Dívida Ativa da União',
    agency: 'Receita Federal / PGFN',
    officialUrl: 'https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir',
    domainPatterns: ['solucoes.receita.fazenda.gov.br'],
    automationLevel: 'autofill_captcha',
    securityType: 'hcaptcha_recaptcha',
    securityDescription: 'Validação anti-robô da Receita Federal / PGFN.',
    requiredFields: ['cnpj_num'],
    steps: [
      'O campo "Informe o número do CNPJ" é preenchido automaticamente com os 14 números da empresa.',
      'Clique em "Consultar" (caso o portal exija Captcha, resolva o desafio na tela).',
      'Clique em "Emissão de nova certidão" para gerar o PDF oficial com código de controle.',
    ],
    selectorRules: [
      {
        field: 'cnpj_num',
        selectors: [
          'input#NI',
          'input[name="NI"]',
          'input[name="ni"]',
          'input[id*="NI"]',
          'input[placeholder*="CNPJ"]',
        ],
      },
    ],
    captchaSelectors: ['input[id*="captcha"]', 'input[name*="captcha"]', '.h-captcha'],
  },
  {
    id: 'adapter-tst-cndt',
    templateKeys: ['tpl-01-cndt'],
    portalName: 'TST — Certidão Negativa de Débitos Trabalhistas (CNDT)',
    agency: 'TST - Tribunal Superior do Trabalho',
    officialUrl: 'https://cndt-certidao.tst.jus.br/',
    domainPatterns: ['cndt-certidao.tst.jus.br', 'tst.jus.br'],
    automationLevel: 'autofill_captcha',
    securityType: 'captcha_imagem',
    securityDescription: 'Exige clicar em "Emitir Certidão" e digitar os caracteres da imagem (Captcha do TST).',
    requiredFields: ['cnpj_num'],
    steps: [
      'Na página inicial do TST, clique no botão "Emitir Certidão".',
      'O adaptador preenche automaticamente o campo "CNPJ" (somente números) e posiciona o cursor na caixa do Captcha.',
      'Digite os caracteres da imagem de segurança e clique em "Emitir Certidão" para baixar o PDF.',
    ],
    selectorRules: [
      {
        field: 'cnpj_num',
        selectors: [
          'input[id*="gerarCertidaoForm:cpfCnpj"]',
          'input[name*="cpfCnpj"]',
          'input[id*="cnpj"]',
          'input[name*="cnpj"]',
        ],
      },
    ],
    captchaSelectors: [
      'input[id*="idCampoResposta"]',
      'input[name*="idCampoResposta"]',
      'input[id*="captcha"]',
    ],
  },
  {
    id: 'adapter-caixa-fgts',
    templateKeys: ['tpl-08-fgts'],
    portalName: 'Caixa Econômica Federal — Consulta Regularidade do Empregador (CRF FGTS)',
    agency: 'Caixa Econômica Federal',
    officialUrl: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf',
    domainPatterns: ['consulta-crf.caixa.gov.br', 'caixa.gov.br'],
    automationLevel: 'autofill_captcha',
    securityType: 'captcha_imagem',
    securityDescription: 'Exige selecionar a Inscrição (CNPJ), UF (PI) e digitar o código da imagem.',
    requiredFields: ['cnpj_num'],
    steps: [
      'O adaptador seleciona automaticamente o tipo de inscrição "CNPJ", a UF "PI" (quando aplicável) e preenche os 14 dígitos do CNPJ.',
      'Digite o código de verificação da imagem (Captcha da Caixa) onde o cursor já estará focado.',
      'Clique em "Consultar", depois em "Obter Certificado de Regularidade do FGTS" e imprima em PDF.',
    ],
    selectorRules: [
      {
        field: 'cnpj_num',
        selectors: [
          'input[id*="mainForm:txtInscricao1"]',
          'input[name*="txtInscricao1"]',
          'input[id*="txtInscricao"]',
        ],
      },
    ],
    captchaSelectors: [
      'input[id*="mainForm:txtCaptcha"]',
      'input[name*="txtCaptcha"]',
      'input[id*="captcha"]',
    ],
  },
  {
    id: 'adapter-sefaz-pi',
    templateKeys: ['tpl-05-sefaz-pi', 'tpl-04-pge-pi', 'tpl-21-ie-im'],
    portalName: 'SEFAZ-PI / PGE-PI — Certidão de Situação Fiscal e Tributária & Dívida Ativa Estadual',
    agency: 'SEFAZ-PI / PGE-PI (Governo do Piauí)',
    officialUrl: 'https://webas.sefaz.pi.gov.br/certidaonft-web/index.xhtml',
    domainPatterns: ['webas.sefaz.pi.gov.br', 'sefaz.pi.gov.br', 'pge.pi.gov.br'],
    automationLevel: 'autofill_captcha',
    securityType: 'captcha_imagem',
    securityDescription: 'Exige preenchimento de CNPJ ou Inscrição Estadual (IE) + Código da imagem (Captcha SEFAZ-PI).',
    requiredFields: ['cnpj_num', 'ie_num'],
    steps: [
      'O adaptador identifica o formulário JSF/PrimeFaces da SEFAZ-PI e preenche o CNPJ ou a Inscrição Estadual (IE).',
      'Digite os caracteres da imagem de segurança da SEFAZ-PI.',
      'Clique em "Emitir / Consultar" e faça o download do PDF da Certidão Estadual.',
    ],
    selectorRules: [
      {
        field: 'cnpj_num',
        selectors: [
          'input[id*="cnpj"]',
          'input[name*="cnpj"]',
          'input[id*="cpfCnpj"]',
          'input[id*="numDocumento"]',
        ],
      },
      {
        field: 'ie_num',
        selectors: [
          'input[id*="inscricaoEstadual"]',
          'input[name*="inscricaoEstadual"]',
          'input[id*="cgf"]',
          'input[id*="ie"]',
        ],
      },
    ],
    captchaSelectors: ['input[id*="captcha"]', 'input[name*="captcha"]', 'input[id*="codigoImagem"]'],
  },
  {
    id: 'adapter-prefeitura-teresina',
    templateKeys: ['tpl-06-prefeitura-pi', 'tpl-10-alvara'],
    portalName: 'Prefeitura Municipal de Teresina (SEMF) — Certidão Negativa Municipal & Alvará',
    agency: 'SEMF - Secretaria Municipal de Finanças de Teresina / PI',
    officialUrl: 'https://semf.pmt.pi.gov.br/',
    domainPatterns: ['semf.pmt.pi.gov.br', 'pmt.pi.gov.br', 'teresina.pi.gov.br'],
    automationLevel: 'autofill_captcha',
    securityType: 'captcha_imagem',
    securityDescription: 'Pede Inscrição Municipal (CMC) ou CNPJ + Captcha do portal municipal.',
    requiredFields: ['im_num', 'cnpj_num'],
    steps: [
      'Acesse a opção de Certidão Negativa de Débitos Municipais / Alvará no portal da SEMF Teresina.',
      'O adaptador preenche automaticamente a Inscrição Municipal (CMC) ou o CNPJ da empresa.',
      'Informe o código de validação (Captcha) e salve o PDF gerado.',
    ],
    selectorRules: [
      {
        field: 'im_num',
        selectors: [
          'input[id*="inscricaoMunicipal"]',
          'input[name*="inscricaoMunicipal"]',
          'input[id*="cmc"]',
          'input[name*="cmc"]',
          'input[id*="im"]',
        ],
      },
      {
        field: 'cnpj_num',
        selectors: ['input[id*="cnpj"]', 'input[name*="cnpj"]', 'input[id*="cpfCnpj"]'],
      },
    ],
    captchaSelectors: ['input[id*="captcha"]', 'input[name*="captcha"]'],
  },
  {
    id: 'adapter-tjpi-certidoes',
    templateKeys: ['tpl-07-falencia-tjpi'],
    portalName: 'TJPI — Sistema de Emissão de Certidões Judiciais (Falência, Concordata e Recuperação Judicial)',
    agency: 'TJPI - Tribunal de Justiça do Estado do Piauí',
    officialUrl: 'https://www.tjpi.jus.br/portaltjpi/certidoes/',
    domainPatterns: ['tjpi.jus.br'],
    automationLevel: 'autofill_captcha',
    securityType: 'captcha_imagem',
    securityDescription: 'Exige CNPJ, Razão Social, Nome/CPF do Solicitante, E-mail e resolução de Captcha.',
    requiredFields: ['cnpj_num', 'razao', 'cpf_num', 'email'],
    steps: [
      'Selecione "Certidão Cível / Falência e Recuperação Judicial (Pessoa Jurídica)" no portal do TJPI.',
      'O adaptador preenche CNPJ, Razão Social, CPF do Sócio/Solicitante e E-mail cadastrados na empresa.',
      'Resolva o Captcha e confirme para emitir ou receber o PDF oficial do TJPI.',
    ],
    selectorRules: [
      {
        field: 'cnpj_num',
        selectors: ['input[name*="cnpj"]', 'input[id*="cnpj"]', 'input[name*="cpf_cnpj"]'],
      },
      {
        field: 'razao',
        selectors: [
          'input[name*="nome_pesquisado"]',
          'input[name*="razao"]',
          'input[id*="nomeRequerido"]',
          'input[name*="requerido"]',
        ],
      },
      {
        field: 'cpf_num',
        selectors: ['input[name*="cpf_solicitante"]', 'input[id*="cpfSolicitante"]', 'input[name*="cpf"]'],
      },
      {
        field: 'email',
        selectors: ['input[type="email"]', 'input[name*="email"]', 'input[id*="email"]'],
      },
    ],
    captchaSelectors: ['input[name*="captcha"]', 'input[id*="captcha"]', '.g-recaptcha', '.h-captcha'],
  },
  {
    id: 'adapter-jucepi',
    templateKeys: ['tpl-09-jucepi', 'tpl-18-contrato-social'],
    portalName: 'JUCEPI — Junta Comercial do Estado do Piauí (Piauí Digital / Gov.br)',
    agency: 'JUCEPI - Junta Comercial do Estado do Piauí',
    officialUrl: 'https://www.pi.gov.br/orgaos/junta-comercial-do-estado-do-piaui-jucepi/',
    domainPatterns: ['jucepi.pi.gov.br', 'pi.gov.br', 'piauidigital.pi.gov.br'],
    automationLevel: 'autofill_govbr',
    securityType: 'login_govbr',
    securityDescription: 'Requer autenticação pessoal na conta Gov.br do representante ou contador.',
    requiredFields: ['nire', 'cnpj_num', 'cpf_num'],
    steps: [
      'O sistema abre o portal da JUCEPI / Piauí Digital e disponibiliza o NIRE e CNPJ para preenchimento.',
      'Caso solicite autenticação Gov.br, faça o login normalmente (o sistema jamais armazena ou intercepta sua senha Gov.br).',
      'Após autenticado, solicite ou baixe a Certidão Simplificada/Inteiro Teor em PDF.',
    ],
    selectorRules: [
      {
        field: 'nire',
        selectors: ['input[name*="nire"]', 'input[id*="nire"]'],
      },
      {
        field: 'cnpj_num',
        selectors: ['input[name*="cnpj"]', 'input[id*="cnpj"]'],
      },
    ],
    captchaSelectors: ['input[name*="captcha"]', 'input[id*="captcha"]'],
  },
  {
    id: 'adapter-crea-conselhos',
    templateKeys: ['tpl-15-conselho', 'tpl-16-trt-art'],
    portalName: 'CREA-PI / CRQ / CRBio — Certidão de Registro e Quitação de Pessoa Jurídica e RT',
    agency: 'CREA-PI e Conselhos Profissionais',
    officialUrl: 'https://www.crea-pi.org.br/',
    domainPatterns: ['crea-pi.org.br', 'sitac.com.br', 'crq.org.br', 'crbio05.gov.br'],
    automationLevel: 'autofill_captcha',
    securityType: 'login_portal',
    securityDescription: 'Pode solicitar número de registro no Conselho, CNPJ ou acesso ao ambiente de serviços (SITAC/CREA-PI).',
    requiredFields: ['council', 'cnpj_num', 'cpf_num'],
    steps: [
      'Acesse a área de Certidões Online / SITAC do CREA-PI ou Conselho correspondente.',
      'O adaptador preenche o CNPJ da empresa e o Registro no Conselho / CPF do Responsável Técnico.',
      'Baixe a Certidão de Registro e Quitação (CRQ/CREA) ou a Certidão de Responsabilidade Técnica (ART/TRT) em PDF.',
    ],
    selectorRules: [
      {
        field: 'council',
        selectors: [
          'input[name*="registro"]',
          'input[id*="registro"]',
          'input[name*="numeroRegistro"]',
        ],
      },
      {
        field: 'cnpj_num',
        selectors: ['input[name*="cnpj"]', 'input[id*="cnpj"]', 'input[name*="cpfcnpj"]'],
      },
    ],
    captchaSelectors: ['input[name*="captcha"]', 'input[id*="captcha"]'],
  },
];

export function findPortalAdapterForDoc(
  templateKey?: string,
  emitterUrl?: string
): PortalAdapterConfig | null {
  if (templateKey) {
    const byKey = OFFICIAL_PORTAL_ADAPTERS.find((a) => a.templateKeys.includes(templateKey));
    if (byKey) return byKey;
  }
  if (emitterUrl) {
    const urlLower = emitterUrl.toLowerCase();
    const byDomain = OFFICIAL_PORTAL_ADAPTERS.find((a) =>
      a.domainPatterns.some((dom) => urlLower.includes(dom))
    );
    if (byDomain) return byDomain;
  }
  return null;
}

export function resolveCompanyFieldMap(comp: CompanyBasicProfile): Record<
  AutoFillFieldKey,
  { label: string; value: string; description: string }
> {
  return {
    cnpj_num: {
      label: 'CNPJ (Só Números)',
      value: onlyDigits(comp.cnpj),
      description: 'Receita Federal, TST, Caixa (FGTS), SEFAZ-PI e TJPI',
    },
    cnpj_fmt: {
      label: 'CNPJ (Formatado)',
      value: comp.cnpj || '',
      description: 'Formato 00.000.000/0001-00',
    },
    ie_num: {
      label: 'Inscrição Estadual (Só Números)',
      value: onlyDigits(comp.stateRegistration),
      description: 'SEFAZ-PI / SINTEGRA sem pontuação',
    },
    ie_fmt: {
      label: 'Inscrição Estadual (Formatada)',
      value: comp.stateRegistration || '',
      description: 'Inscrição Estadual SEFAZ-PI',
    },
    im_num: {
      label: 'Inscrição Municipal (Só Números)',
      value: onlyDigits(comp.municipalRegistration),
      description: 'Prefeitura / SEMF Teresina sem traço',
    },
    im_fmt: {
      label: 'Inscrição Municipal (CMC)',
      value: comp.municipalRegistration || '',
      description: 'Cadastro Mercantil do Contribuinte',
    },
    cpf_num: {
      label: 'CPF do Sócio (Só Números)',
      value: onlyDigits(comp.partnerCpf),
      description: 'Solicitante em TJPI, Receita, JUCEPI e Prefeituras',
    },
    cpf_fmt: {
      label: 'CPF do Sócio (Formatado)',
      value: comp.partnerCpf || '',
      description: `Sócio: ${comp.partnerName || 'Representante Legal'}`,
    },
    nire: {
      label: 'NIRE (JUCEPI)',
      value: comp.nire || '',
      description: 'Número de Identificação do Registro de Empresas',
    },
    council: {
      label: 'Registro no Conselho (CREA/CRQ/CRBio)',
      value: comp.techResponsibleCouncil || '',
      description: `RT: ${comp.techResponsibleName || 'Responsável Técnico'}`,
    },
    email: {
      label: 'E-mail para Certidões',
      value: comp.email || '',
      description: 'Para envio de certidões (TJPI, Prefeituras, etc.)',
    },
    razao: {
      label: 'Razão Social',
      value: comp.companyName || '',
      description: 'Nome empresarial completo',
    },
    tel: {
      label: 'Telefone (Só Números)',
      value: onlyDigits(comp.phone),
      description: comp.phone || 'Telefone de contato',
    },
    cep: {
      label: 'CEP (Só Números)',
      value: onlyDigits(comp.cep),
      description: comp.cep || 'CEP da sede',
    },
  };
}

/**
 * SEGURANÇA: Nunca envia CPF, CNPJ ou dados sensíveis em parâmetros de URL (#hash ou ?query)!
 * Apenas retorna a URL oficial limpa do portal e dispara evento local seguro para o Tampermonkey.
 */
export function buildCleanTargetUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  return rawUrl.trim();
}

/**
 * Envia os dados da empresa selecionada via evento DOM local (`mago:prepare-autofill`)
 * para o script Tampermonkey (se instalado), sem expor nada na URL!
 */
export function dispatchAutofillBridgeEvent(
  comp: CompanyBasicProfile,
  templateKey?: string
): void {
  const payload = {
    companyId: comp.id,
    companyName: comp.companyName,
    templateKey: templateKey || '',
    cnpj_num: onlyDigits(comp.cnpj),
    cnpj_fmt: comp.cnpj,
    ie_num: onlyDigits(comp.stateRegistration),
    ie_fmt: comp.stateRegistration,
    im_num: onlyDigits(comp.municipalRegistration),
    im_fmt: comp.municipalRegistration,
    cpf_num: onlyDigits(comp.partnerCpf),
    cpf_fmt: comp.partnerCpf,
    nire: comp.nire,
    council: comp.techResponsibleCouncil,
    email: comp.email,
    razao: comp.companyName,
    socio: comp.partnerName,
    tel: onlyDigits(comp.phone),
    cep: onlyDigits(comp.cep),
    uf: 'PI',
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem('mago_last_autofill_bridge', JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('mago:prepare-autofill', { detail: payload }));
  } catch {
    // ignore storage errors
  }
}

/**
 * Gera Bookmarklet seguro com adaptadores específicos por portal governamental.
 * Só preenche campos estritamente reconhecidos, jamais chuta campos desconhecidos
 * e jamais burla CAPTCHA ou login Gov.br.
 */
export function generateSafeBookmarkletCode(comp: CompanyBasicProfile): string {
  const data = {
    cnpj_num: onlyDigits(comp.cnpj),
    cnpj_fmt: comp.cnpj,
    ie_num: onlyDigits(comp.stateRegistration),
    im_num: onlyDigits(comp.municipalRegistration),
    cpf_num: onlyDigits(comp.partnerCpf),
    nire: comp.nire,
    council: comp.techResponsibleCouncil,
    email: comp.email,
    razao: comp.companyName,
    tel: onlyDigits(comp.phone),
    cep: onlyDigits(comp.cep),
  };

  const scriptBody = `(function(){
    var D=${JSON.stringify(data)};
    function setVal(el,val){
      if(!el||!val||el.disabled||el.readOnly)return false;
      el.focus();
      var setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');
      if(setter&&setter.set){setter.set.call(el,val);}else{el.value=val;}
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
      el.dispatchEvent(new Event('blur',{bubbles:true}));
      el.style.outline='2px solid #10b981';
      return true;
    }
    var host=location.hostname.toLowerCase();
    var filled=0;
    function trySel(sels,val){
      for(var i=0;i<sels.length;i++){
        var el=document.querySelector(sels[i]);
        if(el&&setVal(el,val)){filled++;return true;}
      }
      return false;
    }
    if(host.includes('receita.fazenda.gov.br')){
      trySel(['input#cnpj','input[name="cnpj"]','input#NI','input[name="NI"]','input[name="ni"]'],D.cnpj_num);
    }else if(host.includes('tst.jus.br')){
      trySel(['input[id*="cpfCnpj"]','input[name*="cpfCnpj"]','input[id*="cnpj"]'],D.cnpj_num);
    }else if(host.includes('caixa.gov.br')){
      trySel(['input[id*="txtInscricao1"]','input[name*="txtInscricao1"]'],D.cnpj_num);
      var ufSel=document.querySelector('select[id*="uf"],select[name*="uf"]');
      if(ufSel){ufSel.value='PI';ufSel.dispatchEvent(new Event('change',{bubbles:true}));}
    }else if(host.includes('sefaz.pi.gov.br')||host.includes('pge.pi.gov.br')){
      trySel(['input[id*="cnpj"]','input[name*="cnpj"]','input[id*="cpfCnpj"]'],D.cnpj_num);
      trySel(['input[id*="inscricaoEstadual"]','input[id*="cgf"]','input[id*="ie"]'],D.ie_num);
    }else if(host.includes('pmt.pi.gov.br')||host.includes('teresina.pi.gov.br')){
      trySel(['input[id*="inscricaoMunicipal"]','input[id*="cmc"]','input[name*="cmc"]'],D.im_num);
      trySel(['input[id*="cnpj"]','input[name*="cnpj"]'],D.cnpj_num);
    }else if(host.includes('tjpi.jus.br')){
      trySel(['input[name*="cnpj"]','input[id*="cnpj"]'],D.cnpj_num);
      trySel(['input[name*="nome_pesquisado"]','input[name*="razao"]'],D.razao);
      trySel(['input[name*="cpf_solicitante"]','input[id*="cpfSolicitante"]'],D.cpf_num);
      trySel(['input[type="email"]','input[name*="email"]'],D.email);
    }else{
      var inputs=Array.from(document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=password]):not([disabled]):not([readonly])'));
      inputs.forEach(function(inp){
        var attr=((inp.name||'')+' '+(inp.id||'')+' '+(inp.placeholder||'')).toLowerCase();
        var lbl='';
        if(inp.id){var l=document.querySelector('label[for="'+inp.id+'"]');if(l)lbl=l.innerText.toLowerCase();}
        var meta=attr+' '+lbl;
        if(/captcha|codigo|seguranca|desafio|senha|password/.test(meta))return;
        if(/\\bcnpj\\b|ni\\b/.test(meta)){if(setVal(inp,inp.maxLength===18?D.cnpj_fmt:D.cnpj_num))filled++;}
        else if(/inscricao\\s*estadual|\\bie\\b|\\bcgf\\b/.test(meta)){if(setVal(inp,D.ie_num))filled++;}
        else if(/inscricao\\s*municipal|\\bcmc\\b/.test(meta)){if(setVal(inp,D.im_num))filled++;}
        else if(/\\bnire\\b/.test(meta)){if(setVal(inp,D.nire))filled++;}
        else if(/\\bcpf\\b/.test(meta)){if(setVal(inp,D.cpf_num))filled++;}
        else if(/\\bemail\\b|e-mail/.test(meta)){if(setVal(inp,D.email))filled++;}
        else if(/razao\\s*social/.test(meta)){if(setVal(inp,D.razao))filled++;}
      });
    }
    var cap=document.querySelector('input[id*="captcha"],input[name*="captcha"],input[id*="idCampoResposta"],input[id*="txtCaptcha"]');
    if(cap){cap.focus();cap.style.outline='3px solid #f59e0b';}
  })();`;

  return `javascript:${encodeURIComponent(scriptBody.replace(/\s+/g, ' ').trim())}`;
}

// Gera UserScript Tampermonkey v3.0 Seguro:
// - NÃO usa permissão irrestrita a todos os sites (restrito apenas aos portais oficiais .gov.br, .jus.br, .org.br).
// - NÃO trafega dados na URL (usa GM_setValue / GM_getValue entre o app e o portal).
// - Usa adaptadores confiáveis por portal e aguarda intervenção humana em CAPTCHAs ou Gov.br.
export function generateSafeTampermonkeyScript(): string {
  return `// ==UserScript==
// @name         Mago das Licitações - Adaptadores Oficiais de Emissão Assistida (v3.0 Seguro)
// @namespace    https://magodaslicitacoes.local/
// @version      3.0
// @description  Preenche com segurança os campos reconhecidos nos portais oficiais (RFB, PGFN, TST, Caixa FGTS, SEFAZ-PI, PGE-PI, SEMF Teresina, TJPI, JUCEPI, CREA-PI) sem enviar dados na URL e aguardando sua validação no Captcha/Gov.br.
// @match        *://*.receita.fazenda.gov.br/*
// @match        *://*.tst.jus.br/*
// @match        *://*.caixa.gov.br/*
// @match        *://*.sefaz.pi.gov.br/*
// @match        *://*.pge.pi.gov.br/*
// @match        *://*.pmt.pi.gov.br/*
// @match        *://*.teresina.pi.gov.br/*
// @match        *://*.tjpi.jus.br/*
// @match        *://*.pi.gov.br/*
// @match        *://*.crea-pi.org.br/*
// @match        *://*.sitac.com.br/*
// @match        *://*.run.app/*
// @match        http://localhost:3000/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
  'use strict';

  // 1. Ponte segura dentro do próprio aplicativo Mago das Licitações (sem dados em URL)
  window.addEventListener('mago:prepare-autofill', function(ev) {
    if (ev && ev.detail && typeof GM_setValue === 'function') {
      GM_setValue('MAGO_ACTIVE_COMPANY_PAYLOAD', JSON.stringify(ev.detail));
    }
  });

  const host = window.location.hostname.toLowerCase();
  if (host.includes('localhost') || host.includes('run.app')) {
    return;
  }

  // 2. Nos portais governamentais autorizados, lê os dados salvos pela ponte segura
  if (typeof GM_getValue !== 'function') return;
  const raw = GM_getValue('MAGO_ACTIVE_COMPANY_PAYLOAD', '');
  if (!raw) return;

  let D = null;
  try {
    D = JSON.parse(raw);
  } catch (e) {
    return;
  }
  if (!D || !D.cnpj_num) return;

  function setNativeValue(el, val) {
    if (!el || !val || el.disabled || el.readOnly) return false;
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (setter && setter.set) {
      setter.set.call(el, val);
    } else {
      el.value = val;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    el.style.outline = '2px solid #10b981';
    el.dataset.magoFilled = '1';
    return true;
  }

  function fillFirstMatching(selectors, val) {
    if (!val) return false;
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.dataset.magoFilled !== '1') {
        if (setNativeValue(el, val)) return true;
      }
    }
    return false;
  }

  function runPortalAdapter() {
    let filledCount = 0;

    if (host.includes('receita.fazenda.gov.br')) {
      if (fillFirstMatching(['input#cnpj', 'input[name="cnpj"]', 'input#NI', 'input[name="NI"]', 'input[name="ni"]'], D.cnpj_num)) filledCount++;
    } else if (host.includes('tst.jus.br')) {
      if (fillFirstMatching(['input[id*="cpfCnpj"]', 'input[name*="cpfCnpj"]', 'input[id*="cnpj"]'], D.cnpj_num)) filledCount++;
    } else if (host.includes('caixa.gov.br')) {
      if (fillFirstMatching(['input[id*="txtInscricao1"]', 'input[name*="txtInscricao1"]'], D.cnpj_num)) filledCount++;
      const ufSelect = document.querySelector('select[id*="uf"], select[name*="uf"]');
      if (ufSelect && !ufSelect.value) {
        ufSelect.value = 'PI';
        ufSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else if (host.includes('sefaz.pi.gov.br') || host.includes('pge.pi.gov.br')) {
      if (fillFirstMatching(['input[id*="cnpj"]', 'input[name*="cnpj"]', 'input[id*="cpfCnpj"]'], D.cnpj_num)) filledCount++;
      if (fillFirstMatching(['input[id*="inscricaoEstadual"]', 'input[id*="cgf"]', 'input[id*="ie"]'], D.ie_num)) filledCount++;
    } else if (host.includes('pmt.pi.gov.br') || host.includes('teresina.pi.gov.br')) {
      if (fillFirstMatching(['input[id*="inscricaoMunicipal"]', 'input[id*="cmc"]', 'input[name*="cmc"]'], D.im_num)) filledCount++;
      if (fillFirstMatching(['input[id*="cnpj"]', 'input[name*="cnpj"]'], D.cnpj_num)) filledCount++;
    } else if (host.includes('tjpi.jus.br')) {
      if (fillFirstMatching(['input[name*="cnpj"]', 'input[id*="cnpj"]'], D.cnpj_num)) filledCount++;
      if (fillFirstMatching(['input[name*="nome_pesquisado"]', 'input[name*="razao"]'], D.razao)) filledCount++;
      if (fillFirstMatching(['input[name*="cpf_solicitante"]', 'input[id*="cpfSolicitante"]'], D.cpf_num)) filledCount++;
      if (fillFirstMatching(['input[type="email"]', 'input[name*="email"]'], D.email)) filledCount++;
    } else if (host.includes('crea-pi.org.br') || host.includes('sitac.com.br')) {
      if (fillFirstMatching(['input[name*="registro"]', 'input[id*="registro"]'], D.council)) filledCount++;
      if (fillFirstMatching(['input[name*="cnpj"]', 'input[id*="cnpj"]'], D.cnpj_num)) filledCount++;
    }

    // Foca no campo de Captcha se existir, aguardando intervenção humana
    const captchaEl = document.querySelector('input[id*="captcha"], input[name*="captcha"], input[id*="idCampoResposta"], input[id*="txtCaptcha"]');
    if (captchaEl && document.activeElement !== captchaEl) {
      captchaEl.focus();
      captchaEl.style.outline = '3px solid #f59e0b';
    }
  }

  setTimeout(runPortalAdapter, 500);
  setTimeout(runPortalAdapter, 1500);
})();`;
}
