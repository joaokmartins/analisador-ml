export function renderCategories(containerId, groupedData) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; // Limpa

    // Ordena categorias por média de ROI
    const sortedCategories = Object.keys(groupedData).sort((a, b) => {
        const roiA = groupedData[a].reduce((acc, i) => acc + i.roi, 0) / groupedData[a].length;
        const roiB = groupedData[b].reduce((acc, i) => acc + i.roi, 0) / groupedData[b].length;
        return roiB - roiA; // Maior ROI primeiro
    });

    sortedCategories.forEach(category => {
        const products = groupedData[category].sort((a, b) => b.roi - a.roi); // Ordena produtos dentro da categoria

        // HTML do Componente de Categoria
        const sectionHtml = `
            <div class="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
                <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 class="text-lg font-bold text-gray-800 flex items-center">
                        <span class="bg-blue-600 w-3 h-8 rounded-sm mr-3"></span>
                        ${category} 
                        <span class="ml-3 bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full">${products.length} itens</span>
                    </h2>
                    <span class="text-sm text-gray-500">Maior ROI: ${products[0].roi.toFixed(0)}%</span>
                </div>
                
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left text-gray-500">
                        <thead class="text-xs text-gray-700 uppercase bg-white border-b">
                            <tr>
                                <th class="px-6 py-3">Produto / SKU</th>
                                <th class="px-6 py-3">Custo</th>
                                <th class="px-6 py-3">Mercado (Mediana)</th>
                                <th class="px-6 py-3 font-bold text-green-700">Lucro Líq.</th>
                                <th class="px-6 py-3 text-center">ROI</th>
                                <th class="px-6 py-3 text-center">Validação</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${products.map(p => `
                                <tr class="bg-white border-b hover:bg-blue-50 transition duration-150">
                                    <td class="px-6 py-4 font-medium text-gray-900">
                                        ${p.produto}
                                        <div class="text-xs text-gray-400 mt-1">${p.sku}</div>
                                    </td>
                                    <td class="px-6 py-4">R$ ${p.custo.toFixed(2)}</td>
                                    <td class="px-6 py-4">R$ ${p.venda.toFixed(2)}</td>
                                    <td class="px-6 py-4 font-bold text-green-600">R$ ${p.lucro.toFixed(2)}</td>
                                    <td class="px-6 py-4 text-center">
                                        <span class="${getRoiBadge(p.roi)}">
                                            ${p.roi.toFixed(0)}%
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 text-center">
                                        ${p.validacao === 'ALTA' 
                                            ? '<span class="text-green-500"><i class="fas fa-check-circle"></i> Alta</span>' 
                                            : '<span class="text-yellow-500"><i class="fas fa-exclamation-triangle"></i> Baixa</span>'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.innerHTML += sectionHtml;
    });
}

function getRoiBadge(roi) {
    if (roi > 100) return 'bg-green-100 text-green-800 px-2 py-1 rounded font-bold';
    if (roi > 30) return 'bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-bold';
    return 'bg-red-100 text-red-800 px-2 py-1 rounded font-bold';
}