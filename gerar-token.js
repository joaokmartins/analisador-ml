require('dotenv').config();
const fetch = require('node-fetch');

async function gerarTokens() {
    console.log("------------------------------------------------");
    console.log("🔐 GERADOR DE TOKENS (Via ML_TEMP_CODE)");
    console.log("------------------------------------------------");

    // 1. Pega o código que você colou no .env
    const code = process.env.ML_TEMP_CODE;
    
    // Pega as credenciais
    const appId = process.env.ML_APP_ID;
    const secret = process.env.ML_CLIENT_SECRET;
    const redirect = process.env.ML_REDIRECT_URI; // Deve ser https://www.google.com

    if (!code) {
        console.error("❌ ERRO: 'ML_TEMP_CODE' está vazio no arquivo .env");
        return;
    }

    console.log(`🔄 Trocando código: ${code.substring(0, 10)}...`);

    // 2. Monta o pacote para o Mercado Livre
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', appId);
    params.append('client_secret', secret);
    params.append('code', code);
    params.append('redirect_uri', redirect);

    try {
        // 3. Faz a requisição
        const response = await fetch('https://api.mercadolibre.com/oauth/token', {
            method: 'POST',
            headers: { 
                'accept': 'application/json', 
                'content-type': 'application/x-www-form-urlencoded' 
            },
            body: params
        });

        const data = await response.json();

        // 4. Mostra o resultado
        if (data.error) {
            console.error("\n❌ ERRO DO MERCADO LIVRE:");
            console.error(JSON.stringify(data, null, 2));
            console.log("\n⚠️ Motivo provável: O código expirou ou a URL de Redirect não bate.");
        } else {
            console.log("\n✅ SUCESSO! CÓDIGO TROCADO POR TOKENS:");
            console.log("================================================");
            console.log("ACCESS TOKEN (Copia e usa já):");
            console.log('\x1b[32m%s\x1b[0m', data.access_token); 
            console.log("\nREFRESH TOKEN (Guarde este para o futuro):");
            console.log('\x1b[36m%s\x1b[0m', data.refresh_token);
            console.log("================================================");
        }

    } catch (err) {
        console.error("Erro técnico:", err.message);
    }
}

gerarTokens();