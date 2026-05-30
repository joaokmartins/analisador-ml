require('dotenv').config();
const fs = require('fs');
const fetch = require('node-fetch');
const { GoogleGenerativeAI } = require("@google/generative-ai");

console.log("--------------------------------------------------");
console.log("🚀 PILOTO SERPER (DADOS LIMPOS + LINKS VISÍVEIS)");
console.log("--------------------------------------------------");

// --- CONFIGURAÇÃO ---
const ARQUIVO_LIMPO = 'catalogo_deduplicado.json'; // O arquivo gerado pelo deduplicador
const ARQUIVO_RELATORIO = 'relatorio_piloto_final.json';
const QUANTIDADE_TESTE = 5; // Testa os 5 primeiros produtos únicos

// Validações
if (!process.env.SERPER_API_KEY || !process.env.GOOGLE_API_KEY) {
    console.error("❌ Erro: Verifique suas chaves no .env");
    process.exit(1);
}

if (!fs.existsSync(ARQUIVO_LIMPO)) {
    console.error(`❌ Erro: O arquivo '${ARQUIVO_LIMPO}' não existe.`);
    console.log("👉 Dica: Rode o 'deduplicador.js' antes.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

// --- UTILITÁRIOS ---
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function limparPreco(valorStr) {
    if (!valorStr) return 0;
    const limpo = String(valorStr)
        .replace("R$", "")
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(",", ".");
    return parseFloat(limpo) || 0;
}

function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
    const magB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
    return dotProduct / (magA * magB);
}

// --- AGENTES ---
async function buscarSerper(termo) {
    console.log(`   📡 [SERPER] Gastando 1 crédito: "${termo}"...`);
    const myHeaders = { "X-API-KEY": process.env.SERPER_API_KEY, "Content-Type": "application/json" };
    // num: 5 resultados do Google Shopping
    const raw = JSON.stringify({ "q": termo, "gl": "br", "hl": "pt-br", "num": 5 });
    
    try {
        const res = await fetch("https://google.serper.dev/shopping", {
            method: 'POST', headers: myHeaders, body: raw, redirect: 'follow'
        });
        const json = await res.json();
        return json.shopping || [];
    } catch (e) { return []; }
}

async function vetorizar(texto) {
    try {
        const res = await embeddingModel.embedContent(texto);
        return res.embedding.values;
    } catch (e) { return null; }
}

// --- EXECUÇÃO ---
async function iniciar() {
    const raw = fs.readFileSync(ARQUIVO_LIMPO);
    const catalogo = JSON.parse(raw);
    
    // Pega os primeiros 5 itens JÁ DEDUPLICADOS
    const lote = catalogo.slice(0, QUANTIDADE_TESTE);
    console.log(`📊 Testando com os primeiros ${lote.length} produtos da lista limpa.\n`);

    const resultados = [];

    for (const produto of lote) {
        console.log(`🔹 PRODUTO: ${produto["nome do produto"]}`);

        // 1. Termo de Busca
        const termo = (produto.titulos_otimizados_ia && produto.titulos_otimizados_ia[0]) 
            ? produto.titulos_otimizados_ia[0] : produto["nome do produto"];
            
        // 2. Vetor Referência
        const vetorRef = await vetorizar(termo);
        if(!vetorRef) { console.log("   ⚠️ Falha vetorização."); continue; }

        // 3. Busca Serper
        const itensSerper = await buscarSerper(termo);
        const validados = [];

        // 4. Match & Links
        if (itensSerper.length > 0) {
            for (const item of itensSerper) {
                const vetorItem = await vetorizar(item.title);
                if(vetorItem) {
                    const score = cosineSimilarity(vetorRef, vetorItem);
                    
                    if(score > 0.82) {
                        const preco = limparPreco(item.price);
                        
                        // IMPRIME LINK NA HORA (Para verificar)
                        console.log(`      ✅ MATCH ${(score*100).toFixed(0)}%: ${item.title}`);
                        console.log(`         🔗 LINK: ${item.link}`);
                        console.log(`         💰 R$ ${preco.toFixed(2)}`);

                        validados.push({
                            titulo: item.title,
                            preco: preco,
                            link: item.link,
                            match: (score*100).toFixed(0)+"%"
                        });
                    }
                }
            }
        } else {
            console.log("   🔸 Sem resultados no Google.");
        }

        // 5. Análise Financeira
        let status = "Sem dados";
        if(validados.length > 0) {
            const custo = limparPreco(produto["preço do produto"]);
            const media = validados.reduce((a,b)=>a+b.preco,0)/validados.length;
            const margem = custo > 0 ? ((media - custo)/media)*100 : 0;
            
            status = `Margem ${margem.toFixed(0)}%`;
            console.log(`   💵 CONCLUSÃO: Custo R$${custo} vs Venda R$${media.toFixed(2)} -> ${status}`);
        }

        resultados.push({ produto, status, concorrentes: validados });
        console.log("--------------------------------------------------");
        await sleep(1000); // Pausa gentil
    }

    fs.writeFileSync(ARQUIVO_RELATORIO, JSON.stringify(resultados, null, 2));
    console.log(`\n🏁 Relatório salvo em '${ARQUIVO_RELATORIO}'`);
}

iniciar();