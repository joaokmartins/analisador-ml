export function renderKPIs(containerId, data) {
    const container = document.getElementById(containerId);
    
    // Cálculos
    const total = data.length;
    const lucrativos = data.filter(i => i.roi > 100).length;
    const mediaRoi = data.reduce((acc, curr) => acc + curr.roi, 0) / total;
    
    const cards = [
        { title: "Total Produtos", value: total, color: "blue", icon: "fa-box" },
        { title: "ROI Médio", value: mediaRoi.toFixed(0) + "%", color: "green", icon: "fa-chart-line" },
        { title: "Super Lucrativos", value: lucrativos, color: "yellow", icon: "fa-star" },
        { title: "Validados (Reviews)", value: data.filter(i => i.validacao === "ALTA").length, color: "purple", icon: "fa-check-circle" }
    ];

    container.innerHTML = cards.map(card => `
        <div class="bg-white overflow-hidden shadow-sm rounded-lg border-l-4 border-${card.color}-500 p-5">
            <div class="flex items-center">
                <div class="flex-shrink-0 bg-${card.color}-100 rounded-md p-3">
                    <i class="fas ${card.icon} text-${card.color}-600 text-xl"></i>
                </div>
                <div class="ml-5 w-0 flex-1">
                    <dl>
                        <dt class="text-sm font-medium text-gray-500 truncate">${card.title}</dt>
                        <dd class="text-2xl font-bold text-gray-900">${card.value}</dd>
                    </dl>
                </div>
            </div>
        </div>
    `).join('');
}