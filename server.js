const express = require('express');
const app = express(); // Cria a aplicação ANTES de usar
const PORT = 3000;

// Rota da Página Inicial (O teste visual)
app.get('/', (req, res) => {
    res.send(`
        <h1 style="color: green; text-align: center; margin-top: 50px;">
            ✅ SUCESSO!
        </h1>
        <p style="text-align: center;">
            A porta 3000 está aberta e funcionando.
        </p>
    `);
});

// Liga o servidor
app.listen(PORT, () => {
    console.log(`🔌 Servidor ligado. Acesse: http://localhost:${PORT}`);
});