const fs = require('fs');

console.log("--------------------------------------------------");
console.log("🧹 INICIANDO DEDUPLICAÇÃO DE CATÁLOGO");
console.log("--------------------------------------------------");

// CONFIGURAÇÃO
const ARQUIVO_ENTRADA = 'catalogo_completo_1000.json';
const ARQUIVO_SAIDA = 'catalogo_deduplicado.json';

// Lógica de Deduplicação
function removerDuplicatas(listaProdutos) {
    const unicos = [];
    const assinaturasVistas = new Set();
    let duplicados = 0;

    listaProdutos.forEach(produto => {
        const nome = produto["nome do produto"] || "";
        const preco = produto["preço do produto"] || "";
        
        // Cria a assinatura única (Nome + Preço)
        // Normaliza para minúsculas e remove espaços extras
        const assinatura = `${nome.trim().toLowerCase()}|${preco.trim()}`;

        if (assinaturasVistas.has(assinatura)) {
            duplicados++;
            // Opcional: Logar quais estão sendo removidos para conferência
            // console.log(`   Duplicate: ${nome}`);
        } else {
            assinaturasVistas.add(assinatura);
            unicos.push(produto);
        }
    });

    return { unicos, duplicados };
}

// Execução
if (!fs.existsSync(ARQUIVO_ENTRADA)) {
    console.error(`❌ Erro: O arquivo '${ARQUIVO_ENTRADA}' não existe.`);
    process.exit(1);
}

const raw = fs.readFileSync(ARQUIVO_ENTRADA);
const catalogoCompleto = JSON.parse(raw);

console.log(`📊 Total Original: ${catalogoCompleto.length} itens.`);

const resultado = removerDuplicatas(catalogoCompleto);

console.log(`🚫 Removidos: ${resultado.duplicados} itens repetidos.`);
console.log(`✅ Restantes: ${resultado.unicos.length} itens únicos.`);

fs.writeFileSync(ARQUIVO_SAIDA, JSON.stringify(resultado.unicos, null, 2));

console.log(`\n💾 Arquivo limpo salvo em: '${ARQUIVO_SAIDA}'`);