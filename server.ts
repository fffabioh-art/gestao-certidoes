import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Increase body limit to support PDF / Image Base64 uploads up to 25MB
app.use(express.json({ limit: '25mb' }));

function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Endpoint: Read & Extract structured data from an attached PDF or Image (Certidão, Cartão CNPJ, Contrato Social, Alvará, etc.)
app.post('/api/analyze-document', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(200).json({
        success: false,
        available: false,
        data: null,
        message: 'Extração local gratuita ativa (PDF.js + Tesseract.js).',
      });
      return;
    }

    const { dataUrl, fileName, mode } = req.body as {
      dataUrl?: string;
      fileName?: string;
      mode?: 'certificate' | 'company_profile' | 'auto_match';
    };

    if (!dataUrl || typeof dataUrl !== 'string') {
      res.status(400).json({ error: 'Arquivo PDF ou imagem não fornecido.' });
      return;
    }

    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      res.status(400).json({ error: 'Formato Base64 inválido.' });
      return;
    }

    const mimeType = match[1] || 'application/pdf';
    const base64Data = match[2];

    const ai = getGeminiClient();

    const promptText = `Você é um especialista jurídico e contábil em licitações públicas brasileiras (especialmente do Estado do Piauí - SEFAZ-PI, PGE-PI, JUCEPI, TJPI, Prefeituras, Receita Federal, TST, FGTS/Caixa, CREA/CRQ/CRBio).
Analise o documento anexo (${fileName || 'documento.pdf'}) no modo "${mode || 'auto_match'}" e extraia TODOS os dados com máxima precisão.

Regras importantes:
1. Converta todas as datas para o formato ISO "YYYY-MM-DD" (ex: "14/09/2026" -> "2026-09-14").
2. Se o documento informar a Data de Emissão e disser "Válida por X dias" (ex: 30, 60, 90, 180 dias) sem exibir a data final explícita, calcule a Data de Vencimento somando os dias à Data de Emissão.
3. Se for Contrato Social, QSA, Cartão de Inscrição Estadual/Municipal sem vencimento ou Atestado de Capacidade Técnica, marque isPermanent como true.
4. Se o documento estiver ilegível ou contraditório, não invente dados — deixe os campos incertos vazios.
5. Extraia Número da Certidão, Código de Autenticidade/Controle, Situação descrita no documento (ex: Negativa, Positiva com Efeito de Negativa, Regular, Ativa) e todos os dados cadastrais da empresa.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: promptText,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            documentTitle: {
              type: Type.STRING,
              description:
                'Nome identificado da certidão ou documento (ex: CNDT, Cartão CNPJ, CND Federal RFB/PGFN, Certidão Fiscal SEFAZ-PI, CRF FGTS, Contrato Social, Alvará).',
            },
            matchedTemplateKey: {
              type: Type.STRING,
              description:
                'Chave do modelo correspondente entre: tpl-01-cndt, tpl-02-cnpj, tpl-03-cnd-federal, tpl-04-pge-pi, tpl-05-sefaz-pi, tpl-06-prefeitura-pi, tpl-07-falencia-tjpi, tpl-08-fgts, tpl-09-jucepi, tpl-10-alvara, tpl-11-bombeiros-pi, tpl-12-ambiental-pi, tpl-13-vigilancia-pi, tpl-14-aft, tpl-15-conselho, tpl-16-trt-art, tpl-17-descarte, tpl-18-contrato-social, tpl-19-qsa, tpl-20-cnh, tpl-21-ie-im, tpl-22-balanco, tpl-23-atestados, ou vazio se for outro documento.',
            },
            category: {
              type: Type.STRING,
              description:
                'Uma das 3 categorias exatas: "Fiscais e Trabalhistas", "Alvarás, Licenças e Conselhos" ou "Societário, Contábil e Qualificação Técnica".',
            },
            issuer: {
              type: Type.STRING,
              description: 'Órgão emissor do documento (ex: Receita Federal, TST, SEFAZ-PI, Caixa, TJPI, JUCEPI).',
            },
            issueDate: {
              type: Type.STRING,
              description: 'Data de emissão no formato YYYY-MM-DD, ou vazio se não constar.',
            },
            validityDays: {
              type: Type.INTEGER,
              description: 'Prazo de validade em dias (ex: 30, 60, 90, 180, 365), ou 0 se permanente/não informado.',
            },
            expirationDate: {
              type: Type.STRING,
              description: 'Data de vencimento/validade no formato YYYY-MM-DD, ou vazio se permanente.',
            },
            isPermanent: {
              type: Type.BOOLEAN,
              description: 'True se o documento for de prazo indeterminado (Contrato Social, QSA, Atestado Técnico, IE/IM).',
            },
            certificateNumber: {
              type: Type.STRING,
              description: 'Número da certidão, licença ou documento se constar.',
            },
            controlCode: {
              type: Type.STRING,
              description: 'Código de controle, autenticidade ou chave de validação.',
            },
            documentSituation: {
              type: Type.STRING,
              description: 'Situação descrita no documento (ex: Certidão Negativa, Positiva com Efeito de Negativa, Regular, Ativa).',
            },
            summaryNotes: {
              type: Type.STRING,
              description: 'Resumo curto da situação do documento.',
            },
            companyData: {
              type: Type.OBJECT,
              properties: {
                companyName: { type: Type.STRING, description: 'Razão Social da empresa' },
                tradeName: { type: Type.STRING, description: 'Nome Fantasia' },
                cnpj: { type: Type.STRING, description: 'CNPJ formatado 00.000.000/0001-00' },
                stateRegistration: { type: Type.STRING, description: 'Inscrição Estadual (IE)' },
                municipalRegistration: { type: Type.STRING, description: 'Inscrição Municipal (IM / CMC)' },
                nire: { type: Type.STRING, description: 'NIRE (Junta Comercial)' },
                cnaeMain: { type: Type.STRING, description: 'CNAE / Atividade econômica principal' },
                cityState: { type: Type.STRING, description: 'Município e UF (ex: Teresina - PI)' },
                cep: { type: Type.STRING, description: 'CEP' },
                address: { type: Type.STRING, description: 'Logradouro, número, complemento e bairro' },
                email: { type: Type.STRING, description: 'E-mail da empresa se constar' },
                phone: { type: Type.STRING, description: 'Telefone da empresa se constar' },
                partnerName: { type: Type.STRING, description: 'Nome do Sócio Administrador ou Representante Legal' },
                partnerCpf: { type: Type.STRING, description: 'CPF do Sócio Administrador ou Representante' },
                partnerRg: { type: Type.STRING, description: 'RG do Sócio Administrador se constar' },
                partnerBirthDate: { type: Type.STRING, description: 'Data de nascimento do sócio YYYY-MM-DD se constar' },
                techResponsibleName: { type: Type.STRING, description: 'Nome do Responsável Técnico (Químico, Engenheiro, Biólogo)' },
                techResponsibleCouncil: { type: Type.STRING, description: 'Registro no Conselho (CREA, CRQ, CRBio)' },
                techResponsibleCpf: { type: Type.STRING, description: 'CPF do Responsável Técnico' },
              },
            },
          },
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const extracted = JSON.parse(rawText);
    res.json({ success: true, available: true, data: extracted });
  } catch (error: unknown) {
    console.error('Erro ao analisar documento no servidor:', error);
    const message =
      error instanceof Error ? error.message : 'Erro desconhecido ao processar o PDF.';
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mago das Licitações server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
