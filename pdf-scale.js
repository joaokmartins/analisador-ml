require('dotenv').config();
const fs = require('fs');
const { PDFDocument } = require('pdf-lib'); // Ferramenta para cortar PDF
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { HumanMessage } = require("@langchain/core/messages");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

// --- CONFIGURAÇÃO ---
const API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_MODEL_NAME = "gemini-2.5-flash"; 
const ARQUIVO_PDF = "catalogo.pdf";
const PAGINAS_POR_LOTE = 3; // Processa 3 páginas por vez (Seguro para não estourar output)

// Inicializações
const fileManager = new GoogleAIFileManager(API_KEY);
const llm = new ChatGoogleGenerativeAI({
    model: GEMINI_MODEL_NAME,
    temperature: 0,
    apiKey: API_KEY
});

// --- FUNÇÃO CORE: Processa um pequeno PDF temporário ---
async function processarLote(caminhoPdfTemp, numeroLote) {
    console.log(`   📤 [Lote ${numeroLote}] Enviando para a IA...`);
    
    // 1. Upload
    const uploadResult = await fileManager.uploadFile(caminhoPdfTemp, {
        mimeType: "application/pdf",
        displayName: `Lote ${numeroLote}`,
    });
    
    // Espera o Google processar o arquivo
    await new Promise(r => setTimeout(r, 2000));

    // 2. Prompt (O seu prompt melhorado)
    const promptText = `
    Analise estas páginas do catálogo. Extraia TODOS os produtos.
    
    SCHEMA OBRIGATÓRIO (JSON Array):
    [{
        "nome do produto": "Texto exato",
        "é kit": boolean (true se nome tiver Kit/Conjunto),
        "categoria do produto": "Leia o cabeçalho da página",
        "código do produto": "SKU/COD perto da imagem",
        "preço do produto": "Valor monetário",
        "titulos_otimizados_ia": ["Titulo 1", "Titulo 2", "Titulo 3"]
    }]
    
    SAÍDA: Apenas JSON. Se não houver produtos nestas páginas, retorne [].
    `;

    const message = new HumanMessage({
        content: [
            { type: "text", text: promptText },
            { type: "media", mimeType: "application/pdf", fileUri: uploadResult.file.uri }
        ]
    });

    try {
        const res = await llm.invoke([message]);
        
        // Limpeza
        let jsonStr = res.content.replace(/```json/g, '').replace(/```/g, '').trim();
        // Corrige casos onde a IA devolve texto antes do JSON
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

// --- FUNÇÃO PRINCIPAL: Orquestrador de Escala ---
async function iniciarProcessamentoEmMassa() {
    console.log("🚀 INICIANDO PROCESSAMENTO EM MASSA (DIVIDIR PARA CONQUISTAR)...");

    if (!fs.existsSync(ARQUIVO_PDF)) {
        console.error("❌ PDF não encontrado.");
        return;
    }

    // 1. Carrega o PDFzão na memória
    const pdfBuffer = fs.readFileSync(ARQUIVO_PDF);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const totalPaginas = pdfDoc.getPageCount();

    console.log(`📄 Total de Páginas encontradas: ${totalPaginas}`);
    
    let listaMestraProdutos = [];

    // 2. Loop de Fatiamento
    let loteAtual = 1;
    for (let i = 0; i < totalPaginas; i += PAGINAS_POR_LOTE) {
        // Cria um novo PDF vazio (o "Lote")
        const subPdf = await PDFDocument.create();
        
        // Copia as páginas do original para o novo (ex: pág 0, 1, 2)
        // Precisamos calcular o range correto
        const paginasParaCopiar = [];
        for (let j = 0; j < PAGINAS_POR_LOTE; j++) {
            if (i + j < totalPaginas) paginasParaCopiar.push(i + j);
        }
        
        const copiedPages = await subPdf.copyPages(pdfDoc, paginasParaCopiar);
        copiedPages.forEach((page) => subPdf.addPage(page));

        // Salva o PDF temporário no disco
        const nomeArquivoTemp = `temp_lote_${loteAtual}.pdf`;
        const pdfBytes = await subPdf.save();
        fs.writeFileSync(nomeArquivoTemp, pdfBytes);

        console.log(`\n✂️  Processando Lote ${loteAtual} (Páginas ${i+1} a ${i+paginasParaCopiar.length})...`);

        // 3. Manda para a IA processar esse pedacinho
        const produtosDoLote = await processarLote(nomeArquivoTemp, loteAtual);
        
        if (produtosDoLote.length > 0) {
            console.log(`   ✅ Encontrados ${produtosDoLote.length} produtos neste lote.`);
            listaMestraProdutos = listaMestraProdutos.concat(produtosDoLote);
        } else {
            console.log("   ⚠️ Nenhum produto encontrado neste lote (ou erro).");
        }

        // Deleta o arquivo temporário para não encher o disco
        fs.unlinkSync(nomeArquivoTemp);
        
        loteAtual++;
    }

    // 4. Salva o Resultado Final Gigante
    console.log("\n==================================================");
    console.log(`🏁 FINALIZADO! Total acumulado: ${listaMestraProdutos.length} produtos.`);
    
    fs.writeFileSync('catalogo_completo_1000.json', JSON.stringify(listaMestraProdutos, null, 2));
    console.log("💾 Salvo em 'catalogo_completo_1000.json'");
}

iniciarProcessamentoEmMassa();