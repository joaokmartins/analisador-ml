require('dotenv').config();
const fs = require('fs');
const { PDFDocument } = require('pdf-lib'); 
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { HumanMessage } = require("@langchain/core/messages");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

// --- CONFIGURAÇÃO ---
const API_KEY = process.env.GOOGLE_API_KEY;

// 1. MUDANÇA DE MODELO (Mais limites gratuitos)
const GEMINI_MODEL_NAME = "gemini-2.5-flash-lite"; 

const ARQUIVO_PDF = "catalogo.pdf";
const ARQUIVO_SAIDA = "catalogo_completo_1000.json";

// 2. MUDANÇA DE LOTE (Menos chamadas à API)
const PAGINAS_POR_LOTE = 20; 

// Inicializações
const fileManager = new GoogleAIFileManager(API_KEY);
const llm = new ChatGoogleGenerativeAI({
    model: GEMINI_MODEL_NAME,
    temperature: 0,
    apiKey: API_KEY
});

// --- FUNÇÃO CORE ---
async function processarLote(caminhoPdfTemp, numeroLote) {
    console.log(`   📤 [Lote ${numeroLote}] Enviando para a IA (Vision Analysis)...`);
    
    // 1. Upload
    const uploadResult = await fileManager.uploadFile(caminhoPdfTemp, {
        mimeType: "application/pdf",
        displayName: `Lote ${numeroLote}`,
    });
    
    // Espera um pouco mais para garantir que o arquivo grande foi processado
    await new Promise(r => setTimeout(r, 4000)); 

    // 2. O PROMPT TURBINADO COM VISÃO
    const promptText = `
    Atue como Especialista em Cadastro de Produtos.
    Analise estas 20 páginas do catálogo. Extraia TODOS os produtos visíveis.
    
    SCHEMA OBRIGATÓRIO (JSON Array):
    [{
        "nome do produto": "Texto exato encontrado",
        "é kit": boolean (true se nome disser Kit/Conjunto ou a FOTO mostrar vários itens iguais),
        "categoria do produto": "Leia o cabeçalho da página",
        "código do produto": "SKU/COD perto da imagem",
        "preço do produto": "Valor monetário",
        "titulos_otimizados_ia": ["Titulo 1", "Titulo 2", "Titulo 3"]
    }]
    
    REGRA CRUCIAL PARA TÍTULOS (VISION SEO):
    Não copie apenas o nome. OLHE PARA A FOTO DE CADA PRODUTO.
    Os títulos DEVEM incluir características visuais explícitas, como:
    - Material (Ex: Inox, Vidro, Silicone, Madeira, Plástico)
    - Cor (Ex: Prata, Dourado, Preto Fosco, Transparente)
    - Acabamento (Ex: Liso, Texturizado, Com Alça)
    
    Exemplo: Se o texto diz "Garrafa" e a foto é cinza metálica, o título DEVE ser "Garrafa Térmica Aço Inox Prata".
        
    SAÍDA: Apenas JSON. Certifique-se de listar TODOS os itens dessas páginas.
    `;

    const message = new HumanMessage({
        content: [
            { type: "text", text: promptText },
            { type: "media", mimeType: "application/pdf", fileUri: uploadResult.file.uri }
        ]
    });

    try {
        const res = await llm.invoke([message]);
        
        let jsonStr = res.content.replace(/```json/g, '').replace(/```/g, '').trim();
        const inicio = jsonStr.indexOf('[');
        const fim = jsonStr.lastIndexOf(']');
        
        if (inicio !== -1 && fim !== -1) {
            jsonStr = jsonStr.substring(inicio, fim + 1);
            return JSON.parse(jsonStr);
        }
        return [];
    } catch (e) {
        console.error(`   ❌ Erro no Lote ${numeroLote}:`, e.message);
        return [];
    }
}

// --- ORQUESTRADOR ---
async function iniciarProcessamentoEmMassa() {
    console.log(`🚀 INICIANDO RE-EXTRAÇÃO COM ${GEMINI_MODEL_NAME} (Lotes de ${PAGINAS_POR_LOTE} págs)...`);

    if (!fs.existsSync(ARQUIVO_PDF)) {
        console.error("❌ PDF não encontrado.");
        return;
    }

    const pdfBuffer = fs.readFileSync(ARQUIVO_PDF);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const totalPaginas = pdfDoc.getPageCount();

    console.log(`📄 Total de Páginas: ${totalPaginas}`);
    
    let listaMestraProdutos = [];

    // Loop Otimizado
    let loteAtual = 1;
    for (let i = 0; i < totalPaginas; i += PAGINAS_POR_LOTE) {
        const subPdf = await PDFDocument.create();
        const paginasParaCopiar = [];
        for (let j = 0; j < PAGINAS_POR_LOTE; j++) {
            if (i + j < totalPaginas) paginasParaCopiar.push(i + j);
        }
        
        const copiedPages = await subPdf.copyPages(pdfDoc, paginasParaCopiar);
        copiedPages.forEach((page) => subPdf.addPage(page));

        const nomeArquivoTemp = `temp_lote_${loteAtual}.pdf`;
        const pdfBytes = await subPdf.save();
        fs.writeFileSync(nomeArquivoTemp, pdfBytes);

        console.log(`\n✂️  Processando Lote ${loteAtual} (Páginas ${i+1} a ${i+paginasParaCopiar.length})...`);

        const produtosDoLote = await processarLote(nomeArquivoTemp, loteAtual);
        
        if (produtosDoLote.length > 0) {
            console.log(`   ✅ Extraídos: ${produtosDoLote.length} produtos.`);
            if(produtosDoLote[0].titulos_otimizados_ia) {
                console.log(`   👀 Exemplo Vision: "${produtosDoLote[0].titulos_otimizados_ia[0]}"`);
            }
            listaMestraProdutos = listaMestraProdutos.concat(produtosDoLote);
        } else {
            console.log("   ⚠️ Nenhum produto encontrado neste lote.");
        }

        fs.unlinkSync(nomeArquivoTemp);
        loteAtual++;
    }

    console.log("\n==================================================");
    console.log(`🏁 FINALIZADO! Total: ${listaMestraProdutos.length} produtos.`);
    
    fs.writeFileSync(ARQUIVO_SAIDA, JSON.stringify(listaMestraProdutos, null, 2));
    console.log(`💾 Salvo em '${ARQUIVO_SAIDA}'`);
}

iniciarProcessamentoEmMassa();