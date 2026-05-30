const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// 1. Servir arquivos estáticos (HTML, CSS, JS) da pasta 'public'
app.use(express.static('public'));

// 2. API para entregar os dados tratados
app.get('/api/produtos', (req, res) => {
    const caminhoArquivo = path.join(__dirname, 'data', 'resultado_final_completo.json');
    
    if (!fs.existsSync(caminhoArquivo)) {
        return res.status(404).json({ error: "Arquivo de dados não encontrado." });
    }

    try {
        const rawData = fs.readFileSync(caminhoArquivo, 'utf8');
        const produtos = JSON.parse(rawData);
        
        // Vamos enviar o JSON bruto, o frontend processa (poupando CPU do servidor)
        res.json(produtos);
    } catch (error) {
        res.status(500).json({ error: "Erro ao processar dados" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Dashboard rodando em: http://localhost:${PORT}`);
});