// ====== Carregar dados do localStorage ======
const registros = JSON.parse(localStorage.getItem("registros")) || [];

// ====== Máscara de moeda (conversão para número) ======
function parseMoneyToNumber(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/\./g, "").replace(",", "."));
}

// ====== STATUS - Contagem ======
function getStatusData() {
    const statusCount = {};
    registros.forEach(reg => {
        statusCount[reg.status] = (statusCount[reg.status] || 0) + 1;
    });
    return statusCount;
}

// ====== FATURAMENTO por status ======
function getFaturamentoPorStatus() {
    const faturamento = {};
    registros.forEach(reg => {
        faturamento[reg.status] = (faturamento[reg.status] || 0) + parseMoneyToNumber(reg.valor_total);
    });
    return faturamento;
}

// ====== Renderizar gráfico de Status ======
const statusData = getStatusData();
new Chart(document.getElementById("chartStatus"), {
    type: "pie",
    data: {
        labels: Object.keys(statusData),
        datasets: [{
            data: Object.values(statusData)
        }]
    },
    options: { plugins: { title: { display: true, text: 'Distribuição de Status' } } }
});

// ====== Renderizar gráfico de Faturamento ======
const faturamentoData = getFaturamentoPorStatus();
new Chart(document.getElementById("chartFaturamento"), {
    type: "bar",
    data: {
        labels: Object.keys(faturamentoData),
        datasets: [{
            label: "Faturamento (R$)",
            data: Object.values(faturamentoData)
        }]
    },
    options: {
        plugins: { title: { display: true, text: 'Faturamento por Status' } },
        scales: { y: { beginAtZero: true } }
    }
});

// ====== Sidebar e tema (reuso do index) ======
function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (window.innerWidth <= 780) sidebar.classList.toggle("open");
    else sidebar.classList.toggle("collapsed");
}

function applyTheme(theme) {
    const body = document.body;
    if (theme === "dark") body.classList.add("dark");
    else body.classList.remove("dark");
}

function toggleTheme() {
    const isDark = document.body.classList.contains("dark");
    localStorage.setItem("theme", isDark ? "light" : "dark");
    applyTheme(isDark ? "light" : "dark");
}

applyTheme(localStorage.getItem("theme") || "light");
// ====== Exportar Dashboard como PDF ======
document.getElementById("btnDownloadPDF").addEventListener("click", () => {
    const element = document.querySelector(".container");

    const opt = {
        margin:       [5, 5, 5, 5],
        filename:     'dashboard-ofertas.pdf',
        image:        { type: 'jpeg', quality: 1 },
        html2canvas:  { scale: 4, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(element).save();
});
