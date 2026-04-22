// =============================================================
// dashboard.js — Dashboard Premium CRM Three Ar
// =============================================================

function $(id) { return document.getElementById(id); }

function setStatus(msg) {
  const el = $("dashStatusText");
  if (el) el.textContent = msg || "";
}

window.addEventListener("error", (e) => {
  const msg = e?.message || "Erro desconhecido";
  const where = e?.filename ? ` (${e.filename.split("/").pop()}:${e.lineno})` : "";
  setStatus(`ERRO: ${msg}${where}`);
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = e?.reason?.message || String(e?.reason || "Promise rejeitada");
  setStatus(`ERRO (promise): ${msg}`);
});

// =============================================================
// UTILITÁRIOS
// =============================================================

function norm(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function moneyBR(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function moneyBRShort(v) {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
  return moneyBR(n);
}

function parseMoneyBR(v) {
  if (typeof v === "number") return v;
  const s = String(v || "").trim();
  if (!s) return 0;
  const clean = s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function parseDateAny(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);
  if (typeof v === "object" && v.seconds) return new Date(v.seconds * 1000);
  const s = String(v).trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (m) {
    const dd = parseInt(m[1], 10), mm = parseInt(m[2], 10) - 1;
    let yy = parseInt(m[3], 10);
    if (yy < 100) yy += 2000;
    const d = new Date(yy, mm, dd, m[4] ? parseInt(m[4], 10) : 0, m[5] ? parseInt(m[5], 10) : 0);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function setText(id, val) {
  const el = $(id);
  if (el) el.textContent = val;
}

function isDark() {
  return document.body.classList.contains("dark");
}

// =============================================================
// DATA HELPERS
// =============================================================

function getOfertaDate(o) {
  return parseDateAny(o.data_entrada) || parseDateAny(o.dataEntrada) ||
    parseDateAny(o.createdAt) || parseDateAny(o.data) || null;
}

function getValorProposta(o) {
  return parseMoneyBR(o.valor_total ?? o.valorTotal ?? o.vl_total ?? 0);
}

function getValorPedido(o) {
  const p = o.pedido || {};
  const vp = p.valor_pedido ?? p.valorPedido ?? o.vlTotalPedido ?? o.vl_total_pedido ?? 0;
  const n = parseMoneyBR(vp);
  return n > 0 ? n : getValorProposta(o);
}

function getValorPedidoReal(o) {
  if (!isPedidoSim(o)) return 0;
  return getValorPedido(o);
}

function isPedidoSim(o) {
  const pp = o.possuiPedido ?? o.possui_pedido ?? o.pedidoSim ?? o.pedido;
  if (typeof pp === "boolean") return pp;
  if (typeof pp === "string") return norm(pp) === "sim";
  const p = o.pedido || {};
  return !!(p.numero_pedido || p.numeroPedido || p.data_po || p.valor_pedido);
}

function isRevisaoSim(o) {
  const pr = o.possuiRevisao ?? o.possui_revisao ?? o.revisaoSim ?? o.revisao;
  if (typeof pr === "boolean") return pr;
  if (typeof pr === "string") return norm(pr) === "sim";
  const r = o.revisao || {};
  return !!(r.numero_oferta_anterior || r.numeroOfertaAnterior || r.mudou);
}

function getUserNameFromOferta(o) {
  return String(o.atualizadoPor || o.criadoPor || o.usuario || o.user || "").trim();
}

function getRepNameFromOferta(o) {
  return String(o.representadaNome || o.representada || o.rep || "").trim();
}

function getStatusText(o) {
  return String(o.status || "").trim() || "Sem status";
}

function getClienteLabel(o) {
  return String(o.razao || o.clienteId || "").trim() || "Sem cliente";
}

function getProjetoLabel(o) {
  return String(o.nome_projeto || o.projetoId || "").trim();
}

function classificarStatusFunil(o) {
  if (isPedidoSim(o)) return "Ganhas";
  const s = norm(getStatusText(o));
  if (s.includes("perd") || s.includes("recusad") || s.includes("declina")) return "Perdidas";
  if (s.includes("cancelad") || s.includes("desistiu") || s.includes("fora do escopo")) return "Canceladas";
  if (s.includes("faturad") || (s.includes("conclu") && !s.includes("desistiu") && !s.includes("fora"))) return "Concluídas";
  if (s.includes("aguard") || s.includes("falta info") || s.includes("falta informacao")) return "Aguardando";
  return "Em andamento";
}

// =============================================================
// FIREBASE
// =============================================================

function esperarFirebase(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      if (window.firebase && window.auth && window.db) { clearInterval(t); resolve(true); }
      else if (Date.now() - start > timeoutMs) { clearInterval(t); reject(new Error("Firebase não carregou.")); }
    }, 50);
  });
}

async function carregarColecao(nome) {
  const snap = await db.collection(nome).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(d => !d.deletado);
}

// =============================================================
// TEMA
// =============================================================

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  document.body.classList.toggle("light", theme === "light");
  const label = $("temaLabel");
  if (label) label.textContent = theme === "dark" ? "Modo claro" : "Modo escuro";
  localStorage.setItem("dash_theme", theme);
}

function initTheme() {
  const saved = localStorage.getItem("dash_theme");
  applyTheme(saved === "light" ? "light" : "dark");
  $("btnTema")?.addEventListener("click", () => {
    const current = document.body.classList.contains("dark") ? "dark" : "light";
    applyTheme(current === "dark" ? "light" : "dark");
    if (window._dashRun) window._dashRun();
  });
}

// =============================================================
// GLOBALS
// =============================================================

let ofertasDB = [];
let clientesDB = [];
let repsDB = [];
let projetosDB = [];
let charts = {};

// =============================================================
// SIDEBAR
// =============================================================

function bindSidebar() {
  $("btnDashboard")?.addEventListener("click", (e) => { e.preventDefault(); window.location.href = "dashboard.html"; });
  $("btnVoltar")?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); window.location.href = "index.html"; });
  $("btnSair")?.addEventListener("click", async (e) => {
    e.preventDefault();
    try { await auth.signOut(); window.location.href = "index.html"; }
    catch (err) { console.error(err); setStatus("Erro ao sair."); }
  });
}

// =============================================================
// FILTROS
// =============================================================

function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function setPresetDates(preset) {
  const ini = $("dashIni"), fim = $("dashFim");
  if (!ini || !fim) return;
  const now = new Date();
  if (preset === "all") { ini.value = ""; fim.value = ""; return; }
  if (preset === "custom") return;
  const days = parseInt(preset, 10);
  ini.value = toISODate(new Date(now.getTime() - days * 86400000));
  fim.value = toISODate(now);
}

function buildFilterOptions() {
  const selRep = $("dashRep");
  if (selRep) {
    const names = [...new Set([
      ...ofertasDB.map(getRepNameFromOferta),
      ...repsDB.map(r => String(r.nome || r.representada || r.nomeRepresentada || "").trim())
    ])].filter(Boolean).sort((a, b) => a.localeCompare(b));
    selRep.innerHTML = `<option value="all">Todas</option>` + names.map(r => `<option value="${r}">${r}</option>`).join("");
  }

  const selUser = $("dashUser");
  if (selUser) {
    const users = [...new Set(ofertasDB.map(getUserNameFromOferta))].filter(Boolean).sort((a, b) => a.localeCompare(b));
    selUser.innerHTML = `<option value="all">Todos</option>` + users.map(u => `<option value="${u}">${u}</option>`).join("");
  }

  const selStatus = $("dashStatus");
  if (selStatus) {
    const freq = {};
    ofertasDB.forEach(o => { const s = getStatusText(o); freq[s] = (freq[s] || 0) + 1; });
    const list = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([s]) => s);
    selStatus.innerHTML = `<option value="all">Todos</option>` + list.map(s => `<option value="${s}">${s}</option>`).join("");
  }
}

function getFilterState() {
  const periodo = $("dashPeriodo")?.value || "30";
  if (periodo !== "custom") setPresetDates(periodo);
  const rep = $("dashRep")?.value || "all";
  const user = $("dashUser")?.value || "all";
  const st = $("dashStatus")?.value || "all";
  const ini = $("dashIni")?.value ? parseDateAny($("dashIni").value) : null;
  const fim = $("dashFim")?.value ? parseDateAny($("dashFim").value) : null;
  return { ini, fim, rep, user, st };
}

function applyDashboardFilters() {
  const { ini, fim, rep, user, st } = getFilterState();
  return ofertasDB.filter(o => {
    if (rep !== "all" && getRepNameFromOferta(o) !== rep) return false;
    if (user !== "all" && getUserNameFromOferta(o) !== user) return false;
    if (st !== "all" && getStatusText(o) !== st) return false;
    const dt = getOfertaDate(o);
    if (ini && dt && dt < ini) return false;
    if (fim && dt) { const end = new Date(fim.getTime() + 86400000 - 1); if (dt > end) return false; }
    return true;
  });
}

function applyFiltersComDatas(ini, fim) {
  const { rep, user, st } = getFilterState();
  return ofertasDB.filter(o => {
    if (rep !== "all" && getRepNameFromOferta(o) !== rep) return false;
    if (user !== "all" && getUserNameFromOferta(o) !== user) return false;
    if (st !== "all" && getStatusText(o) !== st) return false;
    const dt = getOfertaDate(o);
    if (!dt) return false;
    if (ini && dt < ini) return false;
    if (fim) { const end = new Date(fim.getTime() + 86400000 - 1); if (dt > end) return false; }
    return true;
  });
}

// =============================================================
// PERÍODO ANTERIOR
// =============================================================

function calcularPeriodoAnterior(ini, fim) {
  if (!ini || !fim) return null;
  const dur = fim.getTime() - ini.getTime();
  return {
    iniAnt: new Date(ini.getTime() - dur - 1),
    fimAnt: new Date(ini.getTime() - 1)
  };
}

function calcularKPIs(ofertas) {
  const pedidos = ofertas.filter(isPedidoSim);
  const vProp = ofertas.reduce((s, o) => s + getValorProposta(o), 0);
  const vPed = pedidos.reduce((s, o) => s + getValorPedidoReal(o), 0);
  return {
    propostas: ofertas.length,
    pedidos: pedidos.length,
    convQtd: ofertas.length ? (pedidos.length / ofertas.length) * 100 : 0,
    convValor: vProp > 0 ? (vPed / vProp) * 100 : 0,
    vProp, vPed,
    ticketProp: ofertas.length ? vProp / ofertas.length : 0,
    ticketPed: pedidos.length ? vPed / pedidos.length : 0,
    clientesAtivos: new Set(ofertas.map(getClienteLabel).filter(c => c !== "Sem cliente")).size,
    repsAtivas: new Set(ofertas.map(getRepNameFromOferta).filter(Boolean)).size,
    aguardando: ofertas.filter(o => !isPedidoSim(o) && norm(getStatusText(o)).includes("aguard")).length,
  };
}

// =============================================================
// KPIs
// =============================================================

function setTrend(id, atual, anterior, isPercent = false) {
  const el = $(id);
  if (!el) return;
  if (anterior === null || anterior === undefined) { el.textContent = ""; return; }
  if (anterior === 0) {
    el.textContent = atual > 0 ? "↑ novo" : "—";
    el.className = "kpi-trend " + (atual > 0 ? "kpi-trend-up" : "kpi-trend-neutral");
    return;
  }
  if (isPercent) {
    const diff = atual - anterior;
    const sign = diff >= 0 ? "↑" : "↓";
    el.textContent = `${sign} ${Math.abs(diff).toFixed(1)} pts`;
    el.className = `kpi-trend ${diff >= 0 ? "kpi-trend-up" : "kpi-trend-down"}`;
  } else {
    const diff = ((atual - anterior) / Math.abs(anterior)) * 100;
    const sign = diff >= 0 ? "↑" : "↓";
    el.textContent = `${sign} ${Math.abs(diff).toFixed(1)}%`;
    el.className = `kpi-trend ${diff >= 0 ? "kpi-trend-up" : "kpi-trend-down"}`;
  }
}

function renderKPIs(ofertasFiltradas, ofertasAnteriores) {
  const k = calcularKPIs(ofertasFiltradas);
  const ka = ofertasAnteriores ? calcularKPIs(ofertasAnteriores) : null;

  const projetosNoPeriodo = new Set(ofertasFiltradas.map(getProjetoLabel).filter(Boolean)).size;

  setText("kpiPropostas", String(k.propostas));
  setText("kpiPedidos", String(k.pedidos));
  setText("kpiConvQtd", k.convQtd.toFixed(1) + "%");
  setText("kpiConvValor", k.convValor.toFixed(1) + "%");
  setText("kpiValorPropostas", moneyBR(k.vProp));
  setText("kpiValorPedidos", moneyBR(k.vPed));
  setText("kpiTicketProp", moneyBR(k.ticketProp));
  setText("kpiTicketPed", moneyBR(k.ticketPed));
  setText("kpiClientesAtivos", String(k.clientesAtivos));
  setText("kpiRepsAtivas", String(k.repsAtivas));
  setText("kpiProjetosAtivos", String(projetosNoPeriodo));
  setText("kpiAguardando", String(k.aguardando));

  if (ka) {
    setTrend("kpiPropostasTrend", k.propostas, ka.propostas);
    setTrend("kpiPedidosTrend", k.pedidos, ka.pedidos);
    setTrend("kpiConvQtdTrend", k.convQtd, ka.convQtd, true);
    setTrend("kpiConvValorTrend", k.convValor, ka.convValor, true);
    setTrend("kpiValorPropostasTrend", k.vProp, ka.vProp);
    setTrend("kpiValorPedidosTrend", k.vPed, ka.vPed);
    setTrend("kpiTicketPropTrend", k.ticketProp, ka.ticketProp);
    setTrend("kpiTicketPedTrend", k.ticketPed, ka.ticketPed);
    setTrend("kpiClientesAtivosTrend", k.clientesAtivos, ka.clientesAtivos);
    setTrend("kpiRepsAtivasTrend", k.repsAtivas, ka.repsAtivas);
  }

  const alerts = [];
  if (k.aguardando > 0) alerts.push({ type: "warn", text: `<strong>${k.aguardando}</strong> oferta(s) aguardando pedido.` });
  if (k.propostas === 0) alerts.push({ type: "danger", text: "Nenhuma proposta encontrada com os filtros atuais." });
  if (k.pedidos > 0) alerts.push({ type: "ok", text: `<strong>${k.pedidos}</strong> pedido(s) e taxa de conversão de <strong>${k.convQtd.toFixed(1)}%</strong> (qtd) / <strong>${k.convValor.toFixed(1)}%</strong> (valor) no período.` });
  const box = $("dashAlerts");
  if (box) box.innerHTML = alerts.map(a => `<div class="alert ${a.type}">${a.text}</div>`).join("");
}

// =============================================================
// CHART HELPERS
// =============================================================

function applyChartTheme() {
  if (!window.Chart) return;
  const dark = isDark();
  Chart.defaults.color = dark ? "#94A3B8" : "#64748B";
  Chart.defaults.borderColor = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";
  Chart.defaults.font = { family: "'Plus Jakarta Sans', sans-serif", size: 12 };
}

function destroyCharts() {
  Object.values(charts).forEach(c => c && c.destroy && c.destroy());
  charts = {};
}

function safeChart(canvasId, config) {
  if (!window.Chart) return null;
  const el = $(canvasId);
  if (!el) return null;
  return new Chart(el, config);
}

const PALETTE = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#06B6D4","#84CC16","#F97316","#6366F1","#14B8A6","#F43F5E"];

function paletteAlpha(color, alpha) {
  const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// =============================================================
// DRILL-DOWN
// =============================================================

function drillDown(params) {
  sessionStorage.setItem("crmDrillFilter", JSON.stringify(params));
  window.open("index.html", "_blank");
}

// =============================================================
// SEÇÃO: PERFORMANCE COMERCIAL
// =============================================================

function buildFunilChart(ofertasFiltradas) {
  const STATUS_LIST = [
    "Aguardando cliente",
    "Aguardando liberação de crédito",
    "Aguardando pagamento",
    "Aguardando proposta",
    "Apresentado parcial",
    "Atendido",
    "Concorrência",
    "Declinado",
    "Em avaliação técnica",
    "Em negociação",
    "Em produção",
    "Faturado parcial",
    "Ganho",
    "Liberação Prysmian",
    "Perdido",
    "Proposta enviada",
    "Revisão Prysmian",
  ];

  const colorMap = {
    "Ganho":                            "#10B981",
    "Atendido":                         "#34D399",
    "Faturado parcial":                 "#6EE7B7",
    "Em produção":                      "#06B6D4",
    "Em negociação":                    "#3B82F6",
    "Em avaliação técnica":             "#60A5FA",
    "Proposta enviada":                 "#818CF8",
    "Apresentado parcial":              "#A78BFA",
    "Concorrência":                     "#F59E0B",
    "Aguardando cliente":               "#FCD34D",
    "Aguardando pagamento":             "#FBBF24",
    "Aguardando liberação de crédito":  "#F97316",
    "Aguardando proposta":              "#FB923C",
    "Liberação Prysmian":               "#94A3B8",
    "Revisão Prysmian":                 "#CBD5E1",
    "Declinado":                        "#F87171",
    "Perdido":                          "#EF4444",
  };

  const counts = Object.fromEntries(STATUS_LIST.map(s => [s, 0]));
  ofertasFiltradas.forEach(o => {
    const s = getStatusText(o);
    if (counts[s] !== undefined) counts[s]++;
  });

  const sorted = STATUS_LIST
    .map(s => ({ label: s, count: counts[s] }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count);

  const labels = sorted.map(x => x.label);
  const data   = sorted.map(x => x.count);
  const colors = labels.map(l => colorMap[l] || "#64748B");

  const isDark = document.body.classList.contains("dark");
  const gridColor   = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
  const tickColor   = isDark ? "rgba(196,208,238,0.5)"  : "rgba(30,41,64,0.5)";

  charts.funil = safeChart("chartFunil", {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Ofertas",
        data,
        backgroundColor: colors,
        borderRadius: 5,
        barThickness: 22,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "x",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `  ${ctx.parsed.y} oferta${ctx.parsed.y !== 1 ? "s" : ""}`,
          }
        }
      },
      scales: {
        x: {
          ticks: { color: tickColor, font: { size: 11 }, maxRotation: 45, minRotation: 45 },
          grid:  { display: false },
          border: { display: false },
        },
        y: {
          ticks: { stepSize: 1, precision: 0, color: tickColor, font: { size: 11 } },
          grid:  { color: gridColor },
          border: { display: false },
        }
      },
      onClick: (_, elements) => {
        if (!elements.length) return;
        drillDown({ searchTerm: labels[elements[0].index] });
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? "pointer" : "default";
      }
    }
  });
}

function buildEvolucaoChart(ofertasFiltradas) {
  const byMonth = {};
  ofertasFiltradas.forEach(o => {
    const dt = getOfertaDate(o);
    if (!dt) return;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { prop: 0, ped: 0 };
    byMonth[key].prop++;
    if (isPedidoSim(o)) byMonth[key].ped++;
  });

  const months = Object.keys(byMonth).sort();
  const labels = months.map(m => { const [y, mm] = m.split("-"); return `${mm}/${y}`; });

  charts.evolucao = safeChart("chartEvolucao", {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Propostas", data: months.map(m => byMonth[m].prop), borderColor: "#3B82F6", backgroundColor: paletteAlpha("#3B82F6", 0.12), fill: true, tension: 0.3, pointRadius: 4 },
        { label: "Pedidos", data: months.map(m => byMonth[m].ped), borderColor: "#10B981", backgroundColor: paletteAlpha("#10B981", 0.12), fill: true, tension: 0.3, pointRadius: 4 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } }
  });
}

function _comparativoPlaceholder(canvasId) {
  const el = $(canvasId);
  if (!el) return;
  const ctx = el.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, el.width, el.height);
  ctx.fillStyle = isDark() ? "#94A3B8" : "#64748B";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Defina um período para ver a comparação", el.width / 2, el.height / 2);
}

function buildComparativoChart(ofertasFiltradas, ofertasAnteriores) {
  if (!ofertasAnteriores) {
    _comparativoPlaceholder("chartComparativo");
    _comparativoPlaceholder("chartComparativoValores");
    return;
  }

  const ka = calcularKPIs(ofertasFiltradas);
  const kb = calcularKPIs(ofertasAnteriores);
  const isDk = isDark();
  const tickColor = isDk ? "rgba(196,208,238,0.5)" : "rgba(30,41,64,0.5)";
  const gridColor = isDk ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";

  const baseOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: "top", labels: { font: { size: 11 }, boxWidth: 12 } } },
    scales: {
      x: { ticks: { color: tickColor, font: { size: 11 } }, grid: { display: false }, border: { display: false } },
      y: { ticks: { color: tickColor, font: { size: 11 } }, grid: { color: gridColor }, border: { display: false } }
    }
  };

  charts.comparativo = safeChart("chartComparativo", {
    type: "bar",
    data: {
      labels: ["Propostas", "Pedidos"],
      datasets: [
        { label: "Atual",    data: [ka.propostas, ka.pedidos], backgroundColor: paletteAlpha("#3B82F6", 0.8), borderRadius: 5, barThickness: 28 },
        { label: "Anterior", data: [kb.propostas, kb.pedidos], backgroundColor: paletteAlpha("#94A3B8", 0.45), borderRadius: 5, barThickness: 28 }
      ]
    },
    options: {
      ...baseOpts,
      plugins: { ...baseOpts.plugins, tooltip: { callbacks: { label: ctx => `  ${ctx.parsed.y}` } } }
    }
  });

  charts.comparativoValores = safeChart("chartComparativoValores", {
    type: "bar",
    data: {
      labels: ["R$ Proposto", "R$ Pedido"],
      datasets: [
        { label: "Atual",    data: [ka.vProp / 1000, ka.vPed / 1000], backgroundColor: paletteAlpha("#10B981", 0.8), borderRadius: 5, barThickness: 28 },
        { label: "Anterior", data: [kb.vProp / 1000, kb.vPed / 1000], backgroundColor: paletteAlpha("#94A3B8", 0.45), borderRadius: 5, barThickness: 28 }
      ]
    },
    options: {
      ...baseOpts,
      plugins: { ...baseOpts.plugins, tooltip: { callbacks: { label: ctx => `  R$ ${(ctx.parsed.y * 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` } } },
      scales: {
        ...baseOpts.scales,
        y: { ...baseOpts.scales.y, ticks: { ...baseOpts.scales.y.ticks, callback: v => `${v}k` } }
      }
    }
  });
}

function buildStatusChart(ofertasFiltradas) {
  const freq = {};
  ofertasFiltradas.forEach(o => { const s = getStatusText(o); freq[s] = (freq[s] || 0) + 1; });
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 10);
  const rest = sorted.slice(10);
  const labels = top.map(x => x[0]);
  const data = top.map(x => x[1]);
  if (rest.length) { labels.push("Outros"); data.push(rest.reduce((acc, x) => acc + x[1], 0)); }

  charts.status = safeChart("chartStatus", {
    type: "bar",
    data: { labels, datasets: [{ label: "Qtde", data, backgroundColor: PALETTE.map(c => paletteAlpha(c, 0.75)), borderRadius: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: "y",
      plugins: { legend: { display: false } },
      onClick: (_, elements) => {
        if (!elements.length) return;
        drillDown({ status: labels[elements[0].index] });
      },
      onHover: (event, elements) => { event.native.target.style.cursor = elements.length ? "pointer" : "default"; }
    }
  });
}

// =============================================================
// SEÇÃO: CLIENTES
// =============================================================

function buildTopClientesPedidoChart(ofertasFiltradas) {
  const map = {};
  ofertasFiltradas.filter(isPedidoSim).forEach(o => {
    const c = getClienteLabel(o);
    map[c] = (map[c] || 0) + getValorPedidoReal(o);
  });
  const top = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (!top.length) { const box = $("chartTopClientesPedido")?.parentElement; if (box) box.innerHTML += '<div class="dash-empty">Sem pedidos no período.</div>'; return; }

  const labels = top.map(x => x[0].length > 20 ? x[0].slice(0, 18) + "…" : x[0]);
  const fullLabels = top.map(x => x[0]);

  charts.topClientesPedido = safeChart("chartTopClientesPedido", {
    type: "bar",
    data: { labels, datasets: [{ label: "R$ Pedido", data: top.map(x => x[1]), backgroundColor: paletteAlpha("#10B981", 0.75), borderRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${moneyBR(ctx.parsed.y)}` } }
      },
      scales: { x: { ticks: { maxRotation: 40, minRotation: 40, font: { size: 10 } }, grid: { display: false } }, y: { ticks: { callback: v => moneyBRShort(v) } } },
      onClick: (_, elements) => {
        if (!elements.length) return;
        drillDown({ searchTerm: fullLabels[elements[0].index] });
      },
      onHover: (event, elements) => { event.native.target.style.cursor = elements.length ? "pointer" : "default"; }
    }
  });
}

function buildTopClientesPropostaChart(ofertasFiltradas) {
  const map = {};
  ofertasFiltradas.forEach(o => {
    const c = getClienteLabel(o);
    map[c] = (map[c] || 0) + getValorProposta(o);
  });
  const top = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (!top.length) return;

  const labels = top.map(x => x[0].length > 20 ? x[0].slice(0, 18) + "…" : x[0]);
  const fullLabels = top.map(x => x[0]);

  charts.topClientesProposta = safeChart("chartTopClientesProposta", {
    type: "bar",
    data: { labels, datasets: [{ label: "R$ Proposto", data: top.map(x => x[1]), backgroundColor: paletteAlpha("#3B82F6", 0.75), borderRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${moneyBR(ctx.parsed.y)}` } }
      },
      scales: { x: { ticks: { maxRotation: 40, minRotation: 40, font: { size: 10 } }, grid: { display: false } }, y: { ticks: { callback: v => moneyBRShort(v) } } },
      onClick: (_, elements) => {
        if (!elements.length) return;
        drillDown({ searchTerm: fullLabels[elements[0].index] });
      },
      onHover: (event, elements) => { event.native.target.style.cursor = elements.length ? "pointer" : "default"; }
    }
  });
}

function buildClientesRiscoTable(ofertasFiltradas) {
  const box = $("clientesRiscoBox");
  if (!box) return;

  const map = {};
  ofertasFiltradas.forEach(o => {
    const c = getClienteLabel(o);
    if (c === "Sem cliente") return;
    if (!map[c]) map[c] = { propostas: 0, pedidos: 0, vProp: 0 };
    map[c].propostas++;
    map[c].vProp += getValorProposta(o);
    if (isPedidoSim(o)) map[c].pedidos++;
  });

  const risco = Object.entries(map)
    .filter(([, v]) => v.propostas >= 2 && (v.pedidos / v.propostas) < 0.2 && v.vProp > 0)
    .sort((a, b) => b[1].vProp - a[1].vProp)
    .slice(0, 10);

  if (!risco.length) {
    box.innerHTML = `<div class="dash-empty">Nenhum cliente em situação de risco no período.</div>`;
    return;
  }

  box.innerHTML = `
    <table class="dash-inner-table">
      <thead><tr>
        <th>Cliente</th><th style="text-align:right">Prop.</th><th style="text-align:right">Ped.</th>
        <th style="text-align:right">R$ Proposto</th><th style="text-align:right">Conv.</th>
      </tr></thead>
      <tbody>
        ${risco.map(([nome, v]) => {
          const conv = (v.pedidos / v.propostas * 100).toFixed(0);
          const nomeCurto = nome.length > 22 ? nome.slice(0, 20) + "…" : nome;
          return `<tr class="dash-row-clickable" onclick="drillDown({searchTerm:'${nome.replace(/'/g,"\\'")}'})" title="${nome}">
            <td>${nomeCurto}</td>
            <td style="text-align:right">${v.propostas}</td>
            <td style="text-align:right">${v.pedidos}</td>
            <td style="text-align:right">${moneyBRShort(v.vProp)}</td>
            <td style="text-align:right"><span class="dash-tag-danger">${conv}%</span></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;
}

// =============================================================
// SEÇÃO: REPRESENTADAS
// =============================================================

function buildRepsPropPedChart(ofertasFiltradas) {
  const map = {};
  ofertasFiltradas.forEach(o => {
    const r = getRepNameFromOferta(o) || "Sem representada";
    if (!map[r]) map[r] = { vProp: 0, vPed: 0 };
    map[r].vProp += getValorProposta(o);
    map[r].vPed += getValorPedidoReal(o);
  });

  const top = Object.entries(map).sort((a, b) => b[1].vProp - a[1].vProp).slice(0, 10);
  const labels = top.map(x => x[0].length > 18 ? x[0].slice(0, 16) + "…" : x[0]);
  const fullLabels = top.map(x => x[0]);

  charts.repsPropPed = safeChart("chartRepsPropPed", {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "R$ Proposto", data: top.map(x => x[1].vProp), backgroundColor: paletteAlpha("#3B82F6", 0.75), borderRadius: 4 },
        { label: "R$ Pedido",   data: top.map(x => x[1].vPed),  backgroundColor: paletteAlpha("#10B981", 0.75), borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" },
        tooltip: { callbacks: { label: ctx => ` ${moneyBR(ctx.parsed.y)}` } }
      },
      scales: { x: { ticks: { maxRotation: 40, minRotation: 40, font: { size: 10 } }, grid: { display: false } }, y: { ticks: { callback: v => moneyBRShort(v) } } },
      onClick: (_, elements) => {
        if (!elements.length) return;
        drillDown({ searchTerm: fullLabels[elements[0].dataIndex] });
      },
      onHover: (event, elements) => { event.native.target.style.cursor = elements.length ? "pointer" : "default"; }
    }
  });
}

function buildConversaoChart(ofertasFiltradas) {
  const map = {};
  ofertasFiltradas.forEach(o => {
    const r = getRepNameFromOferta(o) || "Sem representada";
    if (!map[r]) map[r] = { vProp: 0, vPed: 0 };
    map[r].vProp += getValorProposta(o);
    map[r].vPed += getValorPedidoReal(o);
  });

  const arr = Object.entries(map)
    .map(([rep, v]) => ({ rep, conv: v.vProp > 0 ? (v.vPed / v.vProp) * 100 : 0 }))
    .sort((a, b) => b.conv - a.conv)
    .slice(0, 12);

  charts.conv = safeChart("chartConversao", {
    type: "bar",
    data: {
      labels: arr.map(x => x.rep.length > 22 ? x.rep.slice(0, 20) + "…" : x.rep),
      datasets: [{ label: "% conversão (valor)", data: arr.map(x => Number(x.conv.toFixed(1))), backgroundColor: arr.map((_, i) => paletteAlpha(PALETTE[i % PALETTE.length], 0.75)), borderRadius: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y.toFixed(1)}%` } } },
      scales: { x: { ticks: { maxRotation: 40, minRotation: 40, font: { size: 10 } }, grid: { display: false } }, y: { ticks: { callback: v => v + "%" } } }
    }
  });
}

function buildTopRepsTable(ofertasFiltradas) {
  const box = $("topRepsBox");
  if (!box) return;

  const map = {};
  ofertasFiltradas.forEach(o => {
    const r = getRepNameFromOferta(o) || "Sem representada";
    if (!map[r]) map[r] = { vProp: 0, vPed: 0 };
    map[r].vProp += getValorProposta(o);
    map[r].vPed += getValorPedidoReal(o);
  });

  const top = Object.entries(map).sort((a, b) => b[1].vPed - a[1].vPed).slice(0, 10);

  if (!top.length) { box.innerHTML = `<div class="dash-empty">Sem dados no período.</div>`; return; }

  box.innerHTML = `
    <table class="dash-inner-table">
      <thead><tr>
        <th>Representada</th>
        <th style="text-align:right">R$ Proposto</th>
        <th style="text-align:right">R$ Pedido</th>
        <th style="text-align:right">Conv. %</th>
      </tr></thead>
      <tbody>
        ${top.map(([rep, v]) => {
          const conv = v.vProp > 0 ? (v.vPed / v.vProp * 100).toFixed(1) : "0.0";
          const nome = rep.length > 22 ? rep.slice(0, 20) + "…" : rep;
          return `<tr class="dash-row-clickable" onclick="drillDown({searchTerm:'${rep.replace(/'/g,"\\'")}'})" title="${rep}">
            <td>${nome}</td>
            <td style="text-align:right">${moneyBRShort(v.vProp)}</td>
            <td style="text-align:right">${moneyBRShort(v.vPed)}</td>
            <td style="text-align:right">${conv}%</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;
}

// =============================================================
// SEÇÃO: PROJETOS
// =============================================================

function buildProjetosVolumeChart(ofertasFiltradas) {
  const map = {};
  ofertasFiltradas.forEach(o => {
    const p = getProjetoLabel(o);
    if (!p) return;
    map[p] = (map[p] || 0) + getValorProposta(o);
  });

  const top = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (!top.length) { const el = $("chartProjetosVolume"); if (el) { const ctx = el.getContext("2d"); if (ctx) { ctx.clearRect(0,0,el.width,el.height); } } const card = el?.closest(".dash-card"); if (card) card.innerHTML += '<div class="dash-empty">Nenhum projeto vinculado às ofertas do período.</div>'; return; }

  const labels = top.map(x => x[0].length > 20 ? x[0].slice(0, 18) + "…" : x[0]);

  charts.projetosVolume = safeChart("chartProjetosVolume", {
    type: "bar",
    data: { labels, datasets: [{ label: "R$ Proposto", data: top.map(x => x[1]), backgroundColor: paletteAlpha("#8B5CF6", 0.75), borderRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${moneyBR(ctx.parsed.y)}` } }
      },
      scales: { x: { ticks: { maxRotation: 40, minRotation: 40, font: { size: 10 } }, grid: { display: false } }, y: { ticks: { callback: v => moneyBRShort(v) } } }
    }
  });
}

function buildProjetosStatusChart() {
  const freq = {};
  projetosDB.forEach(p => {
    const s = String(p.status || "Sem status").trim();
    freq[s] = (freq[s] || 0) + 1;
  });

  const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return;

  charts.projetosStatus = safeChart("chartProjetosStatus", {
    type: "doughnut",
    data: {
      labels: entries.map(x => x[0]),
      datasets: [{ data: entries.map(x => x[1]), backgroundColor: PALETTE.slice(0, entries.length), borderWidth: 2 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "right", labels: { boxWidth: 12, padding: 10 } } }
    }
  });
}

function buildProjetosParadosTable() {
  const box = $("projetosParadosBox");
  if (!box) return;

  const agora = Date.now();
  const LIMITE_MS = 30 * 86400000;
  const excluidos = ["encerrado", "suspenso"];

  const parados = projetosDB
    .filter(p => {
      const s = norm(p.status || "");
      if (excluidos.some(e => s.includes(e))) return false;
      const dt = parseDateAny(p.atualizadoEm || p.criadoEm);
      if (!dt) return false;
      return (agora - dt.getTime()) > LIMITE_MS;
    })
    .map(p => {
      const dt = parseDateAny(p.atualizadoEm || p.criadoEm);
      const dias = Math.floor((agora - dt.getTime()) / 86400000);
      return { nome: p.nome || "Sem nome", status: p.status || "—", dias, dt };
    })
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 10);

  if (!parados.length) {
    box.innerHTML = `<div class="dash-empty">Nenhum projeto parado no momento.</div>`;
    return;
  }

  box.innerHTML = `
    <table class="dash-inner-table">
      <thead><tr>
        <th>Projeto</th><th>Status</th><th style="text-align:right">Dias parado</th>
      </tr></thead>
      <tbody>
        ${parados.map(p => {
          const nome = p.nome.length > 24 ? p.nome.slice(0, 22) + "…" : p.nome;
          const cls = p.dias > 60 ? "dash-tag-danger" : p.dias > 30 ? "dash-tag-warn" : "";
          return `<tr>
            <td title="${p.nome}">${nome}</td>
            <td>${p.status}</td>
            <td style="text-align:right"><span class="${cls}">${p.dias}d</span></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;
}

// =============================================================
// ORQUESTRAÇÃO
// =============================================================

function buildDashboardVisuals(ofertasFiltradas, ofertasAnteriores) {
  destroyCharts();
  applyChartTheme();

  // Performance
  buildFunilChart(ofertasFiltradas);
  buildEvolucaoChart(ofertasFiltradas);
  buildComparativoChart(ofertasFiltradas, ofertasAnteriores);

  // Clientes
  buildTopClientesPedidoChart(ofertasFiltradas);
  buildTopClientesPropostaChart(ofertasFiltradas);
  buildClientesRiscoTable(ofertasFiltradas);

  // Representadas
  buildRepsPropPedChart(ofertasFiltradas);
  buildConversaoChart(ofertasFiltradas);
  buildTopRepsTable(ofertasFiltradas);

  // Projetos
  buildProjetosVolumeChart(ofertasFiltradas);
  buildProjetosStatusChart();
  buildProjetosParadosTable();
}

// =============================================================
// INIT
// =============================================================

async function initDashboard() {
  initTheme();
  bindSidebar();

  setStatus("Carregando Firebase...");
  await esperarFirebase();

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      setStatus("Você precisa fazer login. Redirecionando...");
      window.location.href = "index.html";
      return;
    }

    $("userInfo").textContent =
      (typeof getCurrentUserName === "function" && getCurrentUserName()) ||
      user.displayName || user.email || "Usuário";

    setStatus("Carregando dados...");

    const [ofertas, clientes, reps, projetos] = await Promise.all([
      carregarColecao("ofertas"),
      carregarColecao("clientes"),
      carregarColecao("representadas"),
      carregarColecao("projetos"),
    ]);

    ofertasDB = ofertas;
    clientesDB = clientes;
    repsDB = reps;
    projetosDB = projetos;

    buildFilterOptions();

    const run = () => {
      const filtered = applyDashboardFilters();
      const { ini, fim } = getFilterState();
      const periodoAnt = calcularPeriodoAnterior(ini, fim);
      const anterior = periodoAnt ? applyFiltersComDatas(periodoAnt.iniAnt, periodoAnt.fimAnt) : null;
      renderKPIs(filtered, anterior);
      buildDashboardVisuals(filtered, anterior);
      setStatus(`OK — ${filtered.length} oferta(s) no filtro`);
    };

    window._dashRun = run;

    $("btnAplicarFiltros")?.addEventListener("click", run);
    $("dashPeriodo")?.addEventListener("change", (e) => { if (e.target.value !== "custom") setPresetDates(e.target.value); run(); });
    $("dashIni")?.addEventListener("change", () => { $("dashPeriodo").value = "custom"; run(); });
    $("dashFim")?.addEventListener("change", () => { $("dashPeriodo").value = "custom"; run(); });
    $("dashRep")?.addEventListener("change", run);
    $("dashUser")?.addEventListener("change", run);
    $("dashStatus")?.addEventListener("change", run);
    $("btnLimparFiltros")?.addEventListener("click", () => {
      $("dashPeriodo").value = "30";
      setPresetDates("30");
      $("dashRep").value = "all";
      $("dashUser").value = "all";
      $("dashStatus").value = "all";
      run();
    });

    setPresetDates($("dashPeriodo")?.value || "30");
    run();
  });
}

window.addEventListener("DOMContentLoaded", () => {
  initDashboard().catch(err => { console.error(err); setStatus("Erro ao inicializar. Veja o console."); });
});
