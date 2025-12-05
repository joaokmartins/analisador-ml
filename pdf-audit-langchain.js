require('dotenv').config();
const fs = require('fs');

// Importações do LangChain e Google
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { HumanMessage } = require("@langchain/core/messages");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

const API_KEY = process.env.GOOGLE_API_KEY;
// Usando o modelo mais recente que você tem acesso
const GEMINI_MODEL_NAME = "gemini-2.5-flash"; 

const fileManager = new GoogleAIFileManager(API_KEY);

const llm = new ChatGoogleGenerativeAI({
    model: GEMINI_MODEL_NAME,
    temperature: 0, // Zero criatividade para respeitar rigorosamente a extração
    apiKey: API_KEY
});

async function processPdfAuditWithLangChain() {
    console.log(`🚀 INICIANDO AUDITORIA COM PROMPT REFINADO (${GEMINI_MODEL_NAME})...`);

    const filePath = "catalogo.pdf";
    if (!fs.existsSync(filePath)) {
        console.error("❌ ERRO: Arquivo 'catalogo.pdf' não encontrado.");
        return;
    }

    try {
        // 1. Upload
        console.log("📤 Enviando PDF para análise...");
        const uploadResult = await fileManager.uploadFile(filePath, {
            mimeType: "application/pdf",
            displayName: "Catalogo Fornecedor",
        });
        
        const fileUri = uploadResult.file.uri;
        console.log(`✅ Upload OK: ${fileUri}`);
        
        // Espera o processamento do arquivo no Google
        await new Promise(r => setTimeout(r, 2000));

        // 2. O Prompt Melhorado
        console.log("🧠 LangChain analisando estrutura da página e produtos...");

        const promptText = `
        Você é um Especialista em Extração de Dados de Catálogos.
        Analise este PDF página por página.
        
        Sua missão é extrair cada produto listado seguindo RIGOROSAMENTE as regras de localização abaixo:
        
        SCHEMA DE SAÍDA (Para cada produto):
        {
            "nome do produto": "Extraia o nome exato do texto",
            "é kit": true ou false (Analise o nome do produto. Se contiver 'Kit', 'Conjunto', 'Peças' ou 'Par', marque como true),
            "categoria do produto": "Leia o cabeçalho ou o início da página onde o produto está inserido para encontrar a categoria macro",
            "código do produto": "Extraia o SKU/Código que está próximo da imagem (Geralmente precedido por COD, REF ou Q-)",
            "preço do produto": "O valor monetário encontrado próximo ao item",
            "titulos_otimizados_ia": ["Título SEO 1", "Título SEO 2", "Título SEO 3"] 
        }

        Regra para "titulos_otimizados_ia": Use a visão computacional para identificar Cor, Material e Detalhes na foto e combine com o nome para criar 3 títulos de alta conversão.
        
        SAÍDA:
        Retorne APENAS um JSON Array válido contendo todos os produtos encontrados.
        `;

        const message = new HumanMessage({
            content: [
                { type: "text", text: promptText },
                { 
                    type: "media", 
                    mimeType: "application/pdf", 
                    fileUri: fileUri 
                }
            ]
        });

        const res = await llm.invoke([message]);

        // 3. Limpeza e Salvamento
        const cleanJson = res.content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const outputFilename = 'produtos_formatados.json';
        fs.writeFileSync(outputFilename, cleanJson);
        
        console.log(`\n🏁 SUCESSO! Arquivo '${outputFilename}' gerado.`);
        console.log("---------------------------------------------------");
        console.log(cleanJson.substring(0, 500) + "...");

    } catch (error) {
        console.error("❌ ERRO:", error);
    }
}

processPdfAuditWithLangChain();