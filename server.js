require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { PromptTemplate } = require("@langchain/core/prompts");

const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. CONFIGURAÇÃO IA ---
const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash", 
    temperature: 0,
    apiKey: process.env.GOOGLE_API_KEY
});

// --- 2. FUNÇÕES ---
async function otimizarBusca(produto) {
    const prompt = PromptTemplate.fromTemplate(
        `Atue como expert em E-commerce. Converta "{produto}" em uma busca otimizada (max 4 palavras). Saída: texto puro.`
    );
    const chain = prompt.pipe(llm);
    const res = await chain.invoke({ produto });
    return res.content.trim();
}

// --- 3. ROTAS ---
app.get('/', (req, res) => res.send("<h1>🤖 Servidor Online (Modo Autenticado)</h1>"));

app.get('/analisar-produto', async (req, res) => {
    const produto = req.query.produto;
    if(!produto) return res.send("Erro: Informe ?produto=Nome");

    try {
        console.log(`\n🚀 1. Recebido: "${produto}"`);
        
        // Passo A: IA
        const keywords = await otimizarBusca(produto);
        console.log(`🤖 2. IA Sugeriu: "${keywords}"`);

        // Passo B: Busca no ML (COM TOKEN - OBRIGATÓRIO PARA NÃO DAR 403)
        const token = process.env.ML_ACCESS_TOKEN; // Pega do seu .env
        
        if (!token) {
            console.error("❌ ERRO: ML_ACCESS_TOKEN não está no .env");
            return res.status(500).json({erro: "Token de acesso não configurado no servidor"});
        }

        const mlUrl = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(keywords)}&limit=50`;
        
        console.log("📡 3. Buscando no Mercado Livre (Usando Token)...");
        
        const mlRes = await fetch(mlUrl, {
            method: 'GET',
            headers: {
                // Aqui está o passe VIP que evita o erro 403
                "Authorization": `Bearer ${token}`
            }
        });
        
        const mlData = await mlRes.json();

        // Tratamento de erro
        if (mlRes.status !== 200) {
            console.error("❌ ERRO ML:", mlData);
            return res.status(mlRes.status).json({ 
                erro: "Mercado Livre recusou o acesso", 
                status: mlRes.status,
                motivo: mlData 
            });
        }

        if (!mlData.results || mlData.results.length === 0) {
            return res.json({ mensagem: "Nenhum produto encontrado.", busca: keywords });
        }

        // Sucesso!
        const precos = mlData.results.map(i => i.price);
        const media = precos.reduce((a, b) => a + b, 0) / precos.length;

        res.json({
            status: "SUCESSO",
            produto_solicitado: produto,
            modelo_ia: "gemini-2.5-flash",
            busca_otimizada: keywords,
            mercado_livre: {
                anuncios_encontrados: mlData.results.length,
                preco_medio: media.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                menor_preco: Math.min(...precos).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                maior_preco: Math.max(...precos).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            },
            // Link para o primeiro produto encontrado para você conferir
            exemplo_link: mlData.results[0].permalink
        });

    } catch (error) {
        console.error("💥 ERRO GERAL:", error.message);
        res.status(500).json({ erro: error.message });
    }
});

app.listen(PORT, () => console.log(`Rodando em http://localhost:${PORT}`));