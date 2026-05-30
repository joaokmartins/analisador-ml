require('dotenv').config();
const fs = require('fs');
const fetch = require('node-fetch');
const { GoogleGenerativeAI } = require("@google/generative-ai");

console.log("--------------------------------------------------");
console.log("🔄 PIPELINE FINAL: MODO RETENTATIVA INTELIGENTE");
console.log("--------------------------------------------------");

// --- CONFIGURAÇÃO ---
const ARQUIVO_ENTRADA = 'catalogo_deduplicado.json'; 
const ARQUIVO_SAIDA = 'resultado_final_completo.json'; 
const MATCH_MINIMO = 0.82; 

// --- GESTÃO DE CHAVES MÚLTIPLAS ---
const SERPER_KEYS = (process.env.SERPER_API_KEY || "").split(',').map(k => k.trim()).filter(k => k.length > 0);
let currentKeyIndex = 0; 

// Validações
if (SERPER_KEYS.length === 0 || !process.env.GOOGLE_API_KEY) {
    console.error("❌ ERRO: Verifique chaves no .env");
    process.exit(1);
}

if (!fs.existsSync(ARQUIVO_ENTRADA)) {
    console.error(`❌ ERRO: Arquivo '${ARQUIVO_ENTRADA}' não encontrado.`);
    process.exit(1);
}

console.log(`💳 Chaves Serper Carregadas: ${SERPER_KEYS.length}`);
console.log(`👉 Usando Chave Inicial: ...${SERPER_KEYS[currentKeyIndex].slice(-4)}`);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

// --- 1. MATEMÁTICA FINANCEIRA ---
function calcularMediana(listaPrecos) {
    if (listaPrecos.length === 0) return 0;
    const sorted = [...listaPrecos].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function estimarTaxas(precoVenda, canal) {
    let comissao = 0.18; let taxaFixa = 0; let freteEstimado = 0; let marketing = 0.10; let imposto = 0.06;
    const canalStr = (canal || "").toLowerCase();

    if (canalStr.includes('mercadolivre')) {
        comissao = 0.18;
        if (precoVenda < 79) taxaFixa = 6.00;
        else freteEstimado = 20.00;
    } else if (canalStr.includes('shopee')) {
        comissao = 0.14; taxaFixa = 3.00;
    } else if (canalStr.includes('amazon')) {
        comissao = 0.15;
    }

    const totalDescontos = (precoVenda * comissao) + taxaFixa + freteEstimado + (precoVenda * marketing) + (precoVenda * imposto);
    return { total_taxas: totalDescontos, sobra_liquida: precoVenda - totalDescontos };
}

// --- 2. UTILITÁRIOS ---
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function limparPreco(valorStr) {
    if (!valorStr) return 0;
    const limpo = String(valorStr).replace("R$", "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    return parseFloat(limpo) || 0;
}

function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
    const magB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
    return dotProduct / (magA * magB);
}

// --- 3. BUSCA COM ROTAÇÃO E DEBUG ---
async function buscarSerper(termo) {
    return await executarBuscaComRetry(termo, 0); 
}

async function executarBuscaComRetry(termo, tentativas) {
    if (tentativas >= SERPER_KEYS.length) {
        console.error("   ❌ FATAL: Todas as chaves falharam/esgotaram.");
        return [];
    }

    const chaveAtual = SERPER_KEYS[currentKeyIndex];
    const myHeaders = { "X-API-KEY": chaveAtual, "Content-Type": "application/json" };
    const raw = JSON.stringify({ "q": termo, "gl": "br", "hl": "pt-br", "num": 10 });

    try {
        const response = await fetch("https://google.serper.dev/shopping", {
            method: 'POST', headers: myHeaders, body: raw, redirect: 'follow'
        });

        // Troca chave se der erro de crédito (401, 402, 403)
        if ([401, 402, 403].includes(response.status)) {
            console.warn(`   ⚠️ Chave ${currentKeyIndex + 1} Esgotada (Status ${response.status}). Trocando...`);
            currentKeyIndex++;
            if (currentKeyIndex >= SERPER_KEYS.length) {
                console.error("   ⛔ FIM DAS CHAVES DISPONÍVEIS.");
                throw new Error("SEM_CREDITOS");
            }
            console.log(`   🔄 Ativando Chave ${currentKeyIndex + 1}...`);
            return await executarBuscaComRetry(termo, tentativas + 1);
        }

        // Se der erro 429 (Muitas requisições), espera e tenta mesma chave
        if (response.status === 429) {
            console.warn("   ⏳ Rate Limit (429). Esperando 5s...");
            await sleep(5000);
            return await executarBuscaComRetry(termo, tentativas);
        }

        if (!response.ok) {
            console.error(`   ❌ Erro API Serper: Status ${response.status}`);
            return [];
        }

        const result = await response.json();
        return result.shopping || [];

    } catch (e) {
        if (e.message === "SEM_CREDITOS") throw e;
        console.error("   ❌ Erro de Rede:", e.message);
        return [];
    }
}

async function vetorizar(texto) {
    try {
        const res = await embeddingModel.embedContent(texto);
        return res.embedding.values;
    } catch (e) { 
        console.error("   ⚠️ Erro Google AI (Embed):", e.message);
        return null; 
    }
}

// --- 4. ORQUESTRADOR ---
async function iniciar() {
    console.log(`📂 Lendo entrada...`);
    const catalogoCompleto = JSON.parse(fs.readFileSync(ARQUIVO_ENTRADA));
    
    // --- LÓGICA DE CHECKPOINT MELHORADA ---
    let relatorioMap = new Map(); // Usar Map para fácil acesso por SKU
    
    // Carrega progresso anterior
    if (fs.existsSync(ARQUIVO_SAIDA)) {
        try {
            const dadosAntigos = JSON.parse(fs.readFileSync(ARQUIVO_SAIDA));
            dadosAntigos.forEach(item => {
                relatorioMap.set(item.sku, item);
            });
            console.log(`📦 Carregados ${relatorioMap.size} itens do arquivo anterior.`);
        } catch (e) {
            console.log("⚠️ Arquivo anterior inválido ou vazio.");
        }
    }

    let novosProcessados = 0;
    
    console.log(`📊 Iniciando processamento de ${catalogoCompleto.length} produtos.\n`);

    for (let i = 0; i < catalogoCompleto.length; i++) {
        const produto = catalogoCompleto[i];
        const sku = produto["código do produto"];
        
        // VERIFICA SE JÁ FOI PROCESSADO COM SUCESSO
        const itemExistente = relatorioMap.get(sku);
        
        // Se já existe E tem dados válidos (não é "Sem dados"), PULA
        if (itemExistente && 
            itemExistente.analise_financeira && 
            itemExistente.analise_financeira.status !== "Sem dados" && 
            itemExistente.concorrentes && 
            itemExistente.concorrentes.length > 0) {
            continue; 
        }

        // Se chegou aqui, é porque não existe OU falhou na última vez (Sem dados)
        console.log(`\n🔹 [${i+1}/${catalogoCompleto.length}] Processando: ${produto["nome do produto"]}`);

        const termo = (produto.titulos_otimizados_ia && produto.titulos_otimizados_ia[0]) 
            ? produto.titulos_otimizados_ia[0] : produto["nome do produto"];

        try {
            // 1. Vetorização
            const vetorRef = await vetorizar(termo);
            if (!vetorRef) {
                console.log("   ⚠️ Falha ao vetorizar (Google API). Tentando próximo...");
                await sleep(2000); // Espera extra por segurança
                continue; 
            }

            // 2. Busca
            const itensSerper = await buscarSerper(termo);
            let candidatosTotal = [];

            // 3. Match
            if (itensSerper.length > 0) {
                for (let idx = 0; idx < itensSerper.length; idx++) {
                    const item = itensSerper[idx];
                    const vetorItem = await vetorizar(item.title);
                    if(vetorItem) {
                        const score = cosineSimilarity(vetorRef, vetorItem);
                        if(score > MATCH_MINIMO) {
                            candidatosTotal.push({
                                posicao_google: idx + 1,
                                canal: item.source,
                                titulo: item.title,
                                preco: limparPreco(item.price),
                                match_percent: (score*100).toFixed(0)+"%",
                                match_raw: score,
                                avaliacoes: item.ratingCount || item.reviewCount || 0
                            });
                        }
                    }
                }
            }

            // 4. Ordenação
            candidatosTotal.sort((a, b) => {
                if (a.avaliacoes > 0 && b.avaliacoes === 0) return -1;
                if (a.avaliacoes === 0 && b.avaliacoes > 0) return 1;
                if (a.avaliacoes !== b.avaliacoes) return b.avaliacoes - a.avaliacoes;
                return b.match_raw - a.match_raw;
            });

            const listaFinal = candidatosTotal.slice(0, 8);

            // Exibe
            if(listaFinal.length > 0) {
                listaFinal.forEach(c => {
                    const stars = c.avaliacoes > 0 ? `⭐(${c.avaliacoes})` : `🌑(0)`;
                    console.log(`      ✅ #${c.posicao_google} | ${c.match_percent} | R$ ${c.preco.toFixed(2)} | ${stars} @ ${c.canal}`);
                });
            } else {
                console.log("      🔸 Sem concorrentes compatíveis encontrados.");
            }

            // 5. Análise
            let dadosFinanceiros = { status: "Sem dados" };
            if (listaFinal.length > 0) {
                const medianaMercado = calcularMediana(listaFinal.map(c => c.preco));
                const custoFornecedor = limparPreco(produto["preço do produto"]);
                const canalBase = listaFinal[0].canal || "Outros";
                const calculoTaxas = estimarTaxas(medianaMercado, canalBase);
                const lucroLiquido = calculoTaxas.sobra_liquida - custoFornecedor;
                const roi = custoFornecedor > 0 ? (lucroLiquido / custoFornecedor) * 100 : 0;

                dadosFinanceiros = {
                    custo: custoFornecedor,
                    mediana_mercado: medianaMercado,
                    lucro_liquido: lucroLiquido.toFixed(2),
                    roi: roi.toFixed(1) + "%",
                    validacao: listaFinal.some(c => c.avaliacoes > 0) ? "ALTA" : "BAIXA",
                    status: roi > 20 ? "🔥 APROVADO" : "❄️ REPROVADO"
                };
                console.log(`   💵 Lucro Líquido: R$ ${lucroLiquido.toFixed(2)} (${dadosFinanceiros.status})`);
            }

            // Atualiza o Map e Salva
            const novoItem = {
                sku: sku,
                produto: produto["nome do produto"],
                analise_financeira: dadosFinanceiros,
                concorrentes: listaFinal
            };
            
            relatorioMap.set(sku, novoItem);

            novosProcessados++;
            if (novosProcessados % 5 === 0) {
                // Converte Map para Array para salvar
                const arrayFinal = Array.from(relatorioMap.values());
                fs.writeFileSync(ARQUIVO_SAIDA, JSON.stringify(arrayFinal, null, 2));
                console.log(`   💾 Progresso salvo (${relatorioMap.size} itens).`);
            }

            await sleep(1500); // Pausa um pouco maior para evitar rate limit do Google

        } catch (erro) {
            if (erro.message === "SEM_CREDITOS") {
                console.log("🛑 CRÉDITOS ESGOTADOS EM TODAS AS CHAVES.");
                break;
            }
            console.error("   ❌ Erro inesperado:", erro);
        }
    }

    // Salva final
    const arrayFinal = Array.from(relatorioMap.values());
    fs.writeFileSync(ARQUIVO_SAIDA, JSON.stringify(arrayFinal, null, 2));
    console.log(`\n🏁 FINALIZADO! Relatório completo em: '${ARQUIVO_SAIDA}'`);
}

iniciar();