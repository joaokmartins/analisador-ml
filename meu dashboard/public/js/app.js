import { renderKPIs } from './components/KPIComponent.js';
import { renderCategories } from './components/CategorySection.js';
// Importe o ChartComponent se criar, ou faça inline aqui

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/produtos');
        const rawData = await response.json();

        // 1. Processamento de Dados (ETL no Frontend)
        const processedData = rawData.map(item => {
            const financeiro = item.analise_financeira || {};
            let roi = 0;
            if (financeiro.roi) {
                // Limpa string "1.000%" para float
                roi = parseFloat(String(financeiro.roi).replace('%', '').replace('.', '').replace(',', '.'));
            }
            
            return {
                sku: item.sku,
                produto: item.produto,
                categoria: categorizarProduto(item.produto),
                custo: parseFloat(financeiro.custo) || 0,
                venda: parseFloat(financeiro.mediana_mercado) || 0,
                lucro: parseFloat(financeiro.lucro_liquido) || 0,
                roi: isNaN(roi) ? 0 : roi,
                validacao: financeiro.validacao || 'BAIXA'
            };
        });

        // 2. Agrupamento por Categoria
        const groupedByCat = processedData.reduce((acc, item) => {
            if (!acc[item.categoria]) acc[item.categoria] = [];
            acc[item.categoria].push(item);
            return acc;
        }, {});

        // 3. Renderização
        renderKPIs('kpi-container', processedData);
        renderCategories('categories-container', groupedByCat);
        renderCharts(processedData, groupedByCat);

        document.getElementById('last-update').innerText = `Atualizado: ${new Date().toLocaleDateString()}`;

    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
        document.body.innerHTML = `<h1 class="text-center text-red-500 mt-10">Erro ao carregar dados. Verifique se o servidor está rodando.</h1>`;
    }
});

// Helper de Categorização (A mesma lógica do Python)
function categorizarProduto(nome) {
    const n = nome.toLowerCase();
    if (n.includes('luminária') || n.includes('led') || n.includes('fio de luz')) return 'Iluminação';
    if (n.includes('ferramenta') || n.includes('chave') || n.includes('broca')) return 'Ferramentas';
    if (n.includes('pet') || n.includes('gato') || n.includes('coleira')) return 'Pet Shop';
    if (n.includes('cozinha') || n.includes('faca') || n.includes('pote')) return 'Cozinha';
    if (n.includes('cinta') || n.includes('corretor') || n.includes('massageador')) return 'Saúde & Beleza';
    if (n.includes('adesivo') || n.includes('espelho')) return 'Decoração';
    return 'Outros';
}

function renderCharts(data, grouped) {
    // Gráfico de Top Produtos
    const top10 = [...data].sort((a,b) => b.roi - a.roi).slice(0, 10);
    new Chart(document.getElementById('chartRoi'), {
        type: 'bar',
        data: {
            labels: top10.map(d => d.produto.substring(0, 15) + '...'),
            datasets: [{
                label: 'ROI (%)',
                data: top10.map(d => d.roi),
                backgroundColor: '#2563eb',
                borderRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: true, text: 'Top 10 Produtos (ROI)' } } }
    });

    // Gráfico de Categorias
    const catLabels = Object.keys(grouped);
    const catValues = Object.values(grouped).map(arr => arr.length);
    new Chart(document.getElementById('chartCategory'), {
        type: 'doughnut',
        data: {
            labels: catLabels,
            datasets: [{
                data: catValues,
                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Mix de Produtos por Categoria' } } }
    });
}