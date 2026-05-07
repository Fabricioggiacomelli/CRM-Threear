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

function escapeHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
let _currentFiltered = [];
let _dashUserRole = "user";

// =============================================================
// SIDEBAR
// =============================================================

function bindSidebar() {
  $("btnDashboard")?.addEventListener("click", (e) => { e.preventDefault(); window.location.href = "dashboard.html"; });
  $("btnVoltar")?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); window.location.href = "index.html"; });
  $("btnSair")?.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      window.limparSistemaAlertas?.();
      await auth.signOut();
      window.location.href = "index.html";
    }
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

  const selBU = $("dashBU");
  if (selBU) {
    const bus = [...new Set(ofertasDB.map(o => String(o.bu || "").trim()))].filter(Boolean).sort((a, b) => a.localeCompare(b));
    selBU.innerHTML = `<option value="all">Todas</option>` + bus.map(b => `<option value="${b}">${b}</option>`).join("");
  }

  const selCliente = $("dashCliente");
  if (selCliente) {
    const nomes = [...new Set(ofertasDB.map(getClienteLabel).filter(c => c !== "Sem cliente"))].sort((a, b) => a.localeCompare(b));
    selCliente.innerHTML = `<option value="all">Todos</option>` + nomes.map(c => `<option value="${c}">${c}</option>`).join("");
  }

  const selProjeto = $("dashProjeto");
  if (selProjeto) {
    const projs = [...new Set(ofertasDB.map(getProjetoLabel))].filter(Boolean).sort((a, b) => a.localeCompare(b));
    selProjeto.innerHTML = `<option value="all">Todos</option>` + projs.map(p => `<option value="${p}">${p}</option>`).join("");
  }
}

function getFilterState() {
  const periodo = $("dashPeriodo")?.value || "30";
  const rep = $("dashRep")?.value || "all";
  const user = $("dashUser")?.value || "all";
  const st = $("dashStatus")?.value || "all";
  const bu = $("dashBU")?.value || "all";
  const cliente = $("dashCliente")?.value || "all";
  const projeto = $("dashProjeto")?.value || "all";
  const ini = $("dashIni")?.value ? parseDateAny($("dashIni").value) : null;
  const fim = $("dashFim")?.value ? parseDateAny($("dashFim").value) : null;
  return { ini, fim, rep, user, st, bu, cliente, projeto };
}

function applyDashboardFilters() {
  const { ini, fim, rep, user, st, bu, cliente, projeto } = getFilterState();
  return ofertasDB.filter(o => {
    if (rep !== "all" && getRepNameFromOferta(o) !== rep) return false;
    if (user !== "all" && getUserNameFromOferta(o) !== user) return false;
    if (st !== "all" && getStatusText(o) !== st) return false;
    if (bu !== "all" && String(o.bu || "").trim() !== bu) return false;
    if (cliente !== "all" && getClienteLabel(o) !== cliente) return false;
    if (projeto !== "all" && getProjetoLabel(o) !== projeto) return false;
    const dt = getOfertaDate(o);
    if (ini && dt && dt < ini) return false;
    if (fim && dt) { const end = new Date(fim.getTime() + 86400000 - 1); if (dt > end) return false; }
    return true;
  });
}

function applyFiltersComDatas(ini, fim) {
  const { rep, user, st, bu, cliente, projeto } = getFilterState();
  return ofertasDB.filter(o => {
    if (rep !== "all" && getRepNameFromOferta(o) !== rep) return false;
    if (user !== "all" && getUserNameFromOferta(o) !== user) return false;
    if (st !== "all" && getStatusText(o) !== st) return false;
    if (bu !== "all" && String(o.bu || "").trim() !== bu) return false;
    if (cliente !== "all" && getClienteLabel(o) !== cliente) return false;
    if (projeto !== "all" && getProjetoLabel(o) !== projeto) return false;
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
    iniAnt: new Date(ini.getTime() - dur),
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
  if (anterior == null) { el.style.display = "none"; return; }
  el.style.display = "";
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

  setTrend("kpiPropostasTrend",     k.propostas,    ka?.propostas    ?? null);
  setTrend("kpiPedidosTrend",       k.pedidos,      ka?.pedidos      ?? null);
  setTrend("kpiConvQtdTrend",       k.convQtd,      ka?.convQtd      ?? null, true);
  setTrend("kpiConvValorTrend",     k.convValor,    ka?.convValor    ?? null, true);
  setTrend("kpiValorPropostasTrend",k.vProp,        ka?.vProp        ?? null);
  setTrend("kpiValorPedidosTrend",  k.vPed,         ka?.vPed         ?? null);
  setTrend("kpiTicketPropTrend",    k.ticketProp,   ka?.ticketProp   ?? null);
  setTrend("kpiTicketPedTrend",     k.ticketPed,    ka?.ticketPed    ?? null);
  setTrend("kpiClientesAtivosTrend",k.clientesAtivos,ka?.clientesAtivos ?? null);
  setTrend("kpiRepsAtivasTrend",    k.repsAtivas,   ka?.repsAtivas   ?? null);

  const alerts = [];
  if (k.aguardando > 0) alerts.push({ type: "warn", text: `<strong>${escapeHtml(String(k.aguardando))}</strong> oferta(s) aguardando pedido.` });
  if (k.propostas === 0) alerts.push({ type: "danger", text: "Nenhuma proposta encontrada com os filtros atuais." });
  if (k.pedidos > 0) alerts.push({ type: "ok", text: `<strong>${escapeHtml(String(k.pedidos))}</strong> pedido(s) e taxa de conversão de <strong>${escapeHtml(k.convQtd.toFixed(1))}%</strong> (qtd) / <strong>${escapeHtml(k.convValor.toFixed(1))}%</strong> (valor) no período.` });
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

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

// =============================================================
// KPI DETAIL MODAL
// =============================================================

function getStatusPillHtml(status, hasPed) {
  const s = norm(status);
  let cls;
  if (hasPed || s.includes("ganho") || s.includes("atendido") || s.includes("producao") || s.includes("faturado")) {
    cls = "kpi-pill--green";
  } else if (s.includes("perdido") || s.includes("declinado") || s.includes("cancelado")) {
    cls = "kpi-pill--red";
  } else if (s.includes("aguard") || s.includes("parcial")) {
    cls = "kpi-pill--amber";
  } else if (s.includes("enviada") || s.includes("negociac") || s.includes("avaliacao") || s.includes("concorrencia") || s.includes("prysmian") || s.includes("liberacao")) {
    cls = "kpi-pill--blue";
  } else {
    cls = "kpi-pill--gray";
  }
  return `<span class="kpi-pill ${cls}">${escapeHtml(status)}</span>`;
}

let _kpiNavStack   = [];  // stack of { title, sub, hasSearch, renderFn }
let _kpiCurrentRows = []; // rows being shown in current offer table

function _kpiShowSearch(visible) {
  const row = $("kpiModalSearch")?.closest(".kpi-modal-search-row");
  if (row) row.style.display = visible ? "" : "none";
}

function _kpiShowFilters(visible) {
  const row = $("kpiModalFilterRow");
  if (row) row.style.display = visible ? "" : "none";
}

function _kpiPopulateFilters(rows) {
  const statuses = [...new Set(rows.map(o => getStatusText(o)).filter(s => s && s !== "Sem status"))].sort();
  const reps     = [...new Set(rows.map(o => getRepNameFromOferta(o)).filter(Boolean))].sort();
  const fs = $("kpiFilterStatus");
  if (fs) {
    const cur = fs.value;
    fs.innerHTML = '<option value="">Todos os status</option>' +
      statuses.map(s => `<option value="${escapeHtml(s)}"${s === cur ? " selected" : ""}>${escapeHtml(s)}</option>`).join("");
  }
  const fr = $("kpiFilterRep");
  if (fr) {
    const cur = fr.value;
    fr.innerHTML = '<option value="">Todas as representadas</option>' +
      reps.map(r => `<option value="${escapeHtml(r)}"${r === cur ? " selected" : ""}>${escapeHtml(r)}</option>`).join("");
  }
}

function _kpiResetFilterValues() {
  const fs = $("kpiFilterStatus"); if (fs) fs.value = "";
  const fr = $("kpiFilterRep");    if (fr) fr.value = "";
  const fp = $("kpiFilterPedido"); if (fp) fp.value = "";
}

function closeKpiModal() {
  const m = $("kpiModal");
  if (m) m.style.display = "none";
  _kpiNavStack = [];
  _kpiShowSearch(true);
  _kpiShowFilters(false);
  _kpiResetFilterValues();
  const back = $("kpiModalBack");
  if (back) back.style.display = "none";
}

// =============================================================
// EXPORTAÇÃO
// =============================================================

function bindExportBtn() {
  const btn = $("btnExport");
  const menu = $("exportMenu");
  if (!btn || !menu) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("open");
  });
  document.addEventListener("click", () => menu.classList.remove("open"));

  $("btnExportExcel")?.addEventListener("click", () => { menu.classList.remove("open"); exportExcel(); });
  $("btnExportPdf")?.addEventListener("click",   () => { menu.classList.remove("open"); exportPdf();   });
  $("btnExportCsv")?.addEventListener("click",   () => { menu.classList.remove("open"); exportCsv();   });
}

function exportExcel() {
  if (_dashUserRole !== "admin" && _dashUserRole !== "supervisor") {
    if (typeof showToast === "function") showToast("Apenas administradores e supervisores podem exportar.", "error");
    else alert("Apenas administradores e supervisores podem exportar.");
    return;
  }
  if (typeof XLSX === "undefined") { alert("Biblioteca Excel não carregada. Tente recarregar a página."); return; }

  const periodo = $("dashPeriodo")?.options[$("dashPeriodo")?.selectedIndex]?.text || "";
  const ini = $("dashIni")?.value || "";
  const fim = $("dashFim")?.value || "";
  const periodoLabel = ini && fim ? `${ini} a ${fim}` : periodo;
  const now = new Date();
  const geradoEm = `${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Resumo de KPIs ──────────────────────────────
  const kpiRows = [
    ["Dashboard CRM Three Ar"],
    [`Período: ${periodoLabel}`],
    [`Gerado em: ${geradoEm}`],
    [],
    ["KPI", "Valor"],
    ["Propostas",            $("kpiPropostas")?.textContent?.trim()       || "—"],
    ["Pedidos",              $("kpiPedidos")?.textContent?.trim()         || "—"],
    ["R$ Propostas",         $("kpiValorPropostas")?.textContent?.trim()  || "—"],
    ["R$ Pedidos",           $("kpiValorPedidos")?.textContent?.trim()    || "—"],
    ["Conversão (qtd)",      $("kpiConvQtd")?.textContent?.trim()         || "—"],
    ["Conversão (valor)",    $("kpiConvValor")?.textContent?.trim()       || "—"],
    ["Ticket médio proposta",$("kpiTicketProp")?.textContent?.trim()      || "—"],
    ["Ticket médio pedido",  $("kpiTicketPed")?.textContent?.trim()       || "—"],
    ["Clientes ativos",      $("kpiClientesAtivos")?.textContent?.trim()  || "—"],
    ["Representadas ativas", $("kpiRepsAtivas")?.textContent?.trim()      || "—"],
    ["Projetos ativos",      $("kpiProjetosAtivos")?.textContent?.trim()  || "—"],
    ["Aguardando pedido",    $("kpiAguardando")?.textContent?.trim()      || "—"],
  ];
  const wsKpi = XLSX.utils.aoa_to_sheet(kpiRows);
  wsKpi["!cols"] = [{ wch: 28 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsKpi, "Resumo");

  // ── Sheet 2: Ofertas ─────────────────────────────────────
  const ofertas = _currentFiltered;
  const ofertaHeader = ["Nº Oferta","Cliente","Representada","Status","Data Entrada","R$ Proposto","Possui Pedido","R$ Pedido","BU","Segmento","Tipo","Projeto","Criado por","Atualizado por"];
  const ofertaRows = ofertas.map(o => {
    const dt = getOfertaDate(o);
    const dtStr = dt ? `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}` : "";
    const hasPed = isPedidoSim(o);
    return [
      String(o.oferta || o.numero_oferta || o.numeroOferta || "").trim(),
      getClienteLabel(o),
      getRepNameFromOferta(o),
      getStatusText(o),
      dtStr,
      getValorProposta(o),
      hasPed ? "Sim" : "Não",
      hasPed ? getValorPedidoReal(o) : 0,
      String(o.bu || "").trim(),
      String(o.segmento || "").trim(),
      String(o.tipo_oferta || "").trim(),
      String(o.nome_projeto || "").trim(),
      String(o.criadoPor || "").trim(),
      String(o.atualizadoPor || "").trim(),
    ];
  });
  const wsOfertas = XLSX.utils.aoa_to_sheet([ofertaHeader, ...ofertaRows]);
  wsOfertas["!cols"] = [16,32,24,22,14,16,14,16,12,18,18,24,20,20].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsOfertas, "Ofertas");

  // ── Sheet 3: Por Cliente ─────────────────────────────────
  const cliMap = {};
  ofertas.forEach(o => {
    const k = getClienteLabel(o);
    if (!cliMap[k]) cliMap[k] = { propostas: 0, pedidos: 0, vProp: 0, vPed: 0 };
    cliMap[k].propostas++;
    cliMap[k].vProp += getValorProposta(o);
    if (isPedidoSim(o)) { cliMap[k].pedidos++; cliMap[k].vPed += getValorPedidoReal(o); }
  });
  const cliHeader = ["Cliente","Propostas","Pedidos","R$ Proposto","R$ Pedido","Conversão %"];
  const cliRows = Object.entries(cliMap)
    .sort((a,b) => b[1].vProp - a[1].vProp)
    .map(([nome, v]) => [nome, v.propostas, v.pedidos, v.vProp, v.vPed, v.propostas ? +(v.pedidos/v.propostas*100).toFixed(1) : 0]);
  const wsCli = XLSX.utils.aoa_to_sheet([cliHeader, ...cliRows]);
  wsCli["!cols"] = [{ wch: 36 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsCli, "Por Cliente");

  // ── Sheet 4: Por Representada ────────────────────────────
  const repMap = {};
  ofertas.forEach(o => {
    const k = getRepNameFromOferta(o) || "Sem representada";
    if (!repMap[k]) repMap[k] = { propostas: 0, pedidos: 0, vProp: 0, vPed: 0 };
    repMap[k].propostas++;
    repMap[k].vProp += getValorProposta(o);
    if (isPedidoSim(o)) { repMap[k].pedidos++; repMap[k].vPed += getValorPedidoReal(o); }
  });
  const repHeader = ["Representada","Propostas","Pedidos","R$ Proposto","R$ Pedido","Conversão %"];
  const repRows = Object.entries(repMap)
    .sort((a,b) => b[1].vProp - a[1].vProp)
    .map(([nome, v]) => [nome, v.propostas, v.pedidos, v.vProp, v.vPed, v.propostas ? +(v.pedidos/v.propostas*100).toFixed(1) : 0]);
  const wsRep = XLSX.utils.aoa_to_sheet([repHeader, ...repRows]);
  wsRep["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsRep, "Por Representada");

  // ── Download ─────────────────────────────────────────────
  const fileName = `dashboard-crm-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function exportCsv() {
  if (_dashUserRole !== "admin" && _dashUserRole !== "supervisor") {
    if (typeof showToast === "function") showToast("Apenas administradores e supervisores podem exportar.", "error");
    else alert("Apenas administradores e supervisores podem exportar.");
    return;
  }
  if (typeof XLSX === "undefined") { alert("Biblioteca Excel não carregada. Tente recarregar a página."); return; }

  const ofertas = _currentFiltered;
  const header = ["Nº Oferta","Cliente","Representada","Status","Data Entrada","R$ Proposto","Possui Pedido","R$ Pedido","BU","Segmento","Tipo","Projeto","Criado por","Atualizado por"];
  const rows = ofertas.map(o => {
    const dt = getOfertaDate(o);
    const dtStr = dt ? `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}` : "";
    const hasPed = isPedidoSim(o);
    return [
      String(o.oferta || o.numero_oferta || o.numeroOferta || "").trim(),
      getClienteLabel(o),
      getRepNameFromOferta(o),
      getStatusText(o),
      dtStr,
      getValorProposta(o),
      hasPed ? "Sim" : "Não",
      hasPed ? getValorPedidoReal(o) : 0,
      String(o.bu || "").trim(),
      String(o.segmento || "").trim(),
      String(o.tipo_oferta || "").trim(),
      String(o.nome_projeto || "").trim(),
      String(o.criadoPor || "").trim(),
      String(o.atualizadoPor || "").trim(),
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

  // Semicolon separator (padrão brasileiro) + BOM UTF-8 para acentos no Excel
  const csvString = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
  const blob = new Blob(["﻿" + csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const fileName = `ofertas-crm-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}.csv`;
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPdf() {
  if (_dashUserRole !== "admin" && _dashUserRole !== "supervisor") {
    if (typeof showToast === "function") showToast("Apenas administradores e supervisores podem exportar.", "error");
    else alert("Apenas administradores e supervisores podem exportar.");
    return;
  }
  window.print();
}

function bindKpiModal() {
  $("kpiModalClose")?.addEventListener("click", closeKpiModal);
  $("kpiModalBack")?.addEventListener("click", _kpiGoBack);
  $("kpiModal")?.addEventListener("click", (e) => {
    if (e.target.id === "kpiModal") closeKpiModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const m = $("kpiModal");
    if (m && m.style.display !== "none") {
      if (_kpiNavStack.length) _kpiGoBack();
      else closeKpiModal();
    }
  });
  ["kpiFilterStatus", "kpiFilterRep", "kpiFilterPedido"].forEach(id => {
    $(id)?.addEventListener("change", () => {
      const searchEl = $("kpiModalSearch");
      if (searchEl) searchEl.dispatchEvent(new Event("input"));
    });
  });
  $("kpiFilterClear")?.addEventListener("click", () => {
    _kpiResetFilterValues();
    const searchEl = $("kpiModalSearch");
    if (searchEl) { searchEl.value = ""; searchEl.dispatchEvent(new Event("input")); }
  });
}

function _kpiGoBack() {
  if (!_kpiNavStack.length) return;
  const { title, sub, hasSearch, hasFilters, fStatus, fRep, fPedido, renderFn } = _kpiNavStack.pop();
  $("kpiModalTitle").textContent = title || "";
  $("kpiModalSub").textContent   = sub  || "";
  _kpiShowSearch(hasSearch !== false);
  _kpiShowFilters(!!hasFilters);
  const fs = $("kpiFilterStatus"); if (fs) fs.value = fStatus || "";
  const fr = $("kpiFilterRep");    if (fr) fr.value = fRep    || "";
  const fp = $("kpiFilterPedido"); if (fp) fp.value = fPedido || "";
  if (!_kpiNavStack.length) $("kpiModalBack").style.display = "none";
  const searchEl = $("kpiModalSearch");
  if (searchEl) { searchEl.value = ""; searchEl.oninput = (ev) => renderFn(ev.target.value); }
  renderFn("");
}

function _kpiPushLevel(title, sub, hasSearch, renderFn) {
  const filterRow = $("kpiModalFilterRow");
  _kpiNavStack.push({
    title, sub, hasSearch, renderFn,
    hasFilters: !!(filterRow && filterRow.style.display !== "none"),
    fStatus:  $("kpiFilterStatus")?.value || "",
    fRep:     $("kpiFilterRep")?.value    || "",
    fPedido:  $("kpiFilterPedido")?.value || "",
  });
  $("kpiModalBack").style.display = "";
}

function openOfertaDetail(oferta) {
  const schema = window.OFERTA_SCHEMA || [];
  const schemaMap = Object.fromEntries(schema.map(f => [f.key, f]));

  function getField(key) {
    if (key.includes(".")) {
      const [parent, child] = key.split(".");
      return oferta[parent]?.[child];
    }
    return oferta[key];
  }

  function fmtVal(val, type) {
    if (val === null || val === undefined || val === "") return null;
    const s = String(val).trim();
    if (!s) return null;
    if (type === "money")    return moneyBR(parseMoneyBR(val));
    if (type === "date")     { const d = parseDateAny(val); return d ? `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}` : s; }
    if (type === "datetime") { const d = parseDateAny(val); return d ? `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}` : s; }
    if (type === "yesno")    { const v = s.toLowerCase(); return (v === "sim" || v === "true") ? "Sim" : (v === "não" || v === "nao" || v === "false") ? "Não" : s; }
    return s;
  }

  const SECTIONS = [
    { title: "Identificação",
      keys: ["oferta","bu","segmento","tipo_oferta","atendimentoSpot","data_entrada","data_envio"] },
    { title: "Cliente",
      keys: ["razao","cnpj_cliente","solicitante","telefone","email","ref_cliente"] },
    { title: "Proposta",
      keys: ["representadaNome","unidade","nome_projeto","valor_total","status","motivo_perda","obs_geral"] },
    { title: "Pedido",
      show: isPedidoSim(oferta),
      keys: ["possuiPedido","pedido.numero_pedido","pedido.data_po","pedido.valor_pedido","pedido.cond_pagamento","pedido.ref_projeto","pedido.tipo_produto","pedido.prazo_entrega_contratual","pedido.sov","pedido.ref_ov","pedido.data_implantacao","pedido.obs"] },
    { title: "Revisão",
      show: isRevisaoSim(oferta),
      keys: ["possuiRevisao","revisao.numero_oferta_anterior","revisao.mudou"] },
    { title: "Histórico",
      keys: ["criadoEm","criadoPor","atualizadoEm","atualizadoPor"] },
  ];

  const sections = SECTIONS
    .filter(s => s.show !== false)
    .map(s => ({
      title: s.title,
      items: s.keys.map(key => {
        const def = schemaMap[key];
        const raw = getField(key);
        const val = fmtVal(raw, def?.type);
        if (!val) return null;
        return { label: def?.label || key, value: val };
      }).filter(Boolean)
    }))
    .filter(s => s.items.length > 0);

  const numOferta = String(oferta.oferta || oferta.numero_oferta || oferta.numeroOferta || "").trim();
  const cliente   = getClienteLabel(oferta);
  const rep       = getRepNameFromOferta(oferta);
  const status    = getStatusText(oferta);

  // Save current state for back navigation
  const prevTitle     = $("kpiModalTitle")?.textContent || "";
  const prevSub       = $("kpiModalSub")?.textContent   || "";
  const capturedRows  = [..._kpiCurrentRows];
  const prevRenderFn  = (q) => renderOfertasModal($("kpiModalBody"), $("kpiModalSub"), capturedRows, q);
  _kpiPushLevel(prevTitle, prevSub, true, prevRenderFn);

  // Navigate to detail view
  $("kpiModalTitle").textContent = numOferta ? `Oferta ${numOferta}` : "Detalhes da Oferta";
  $("kpiModalSub").textContent   = [cliente, rep, status].filter(Boolean).join(" · ");
  _kpiShowSearch(false);
  _kpiShowFilters(false);

  const bodyEl = $("kpiModalBody");
  if (bodyEl) {
    bodyEl.innerHTML = sections.length
      ? sections.map(sec => `
          <div class="kpi-detail-section">
            <div class="kpi-detail-section-title">${escapeHtml(sec.title)}</div>
            <div class="kpi-detail-grid">
              ${sec.items.map(item => `
                <div class="kpi-detail-field">
                  <div class="kpi-detail-field-label">${escapeHtml(item.label)}</div>
                  <div class="kpi-detail-field-value">${escapeHtml(item.value)}</div>
                </div>`).join("")}
            </div>
          </div>`).join("")
      : `<div class="dash-empty">Nenhum campo preenchido nesta oferta.</div>`;
  }
}

function _kpiGroupOfertas(ofertas, getKey) {
  const map = {};
  ofertas.forEach(o => {
    const key = getKey(o);
    if (!key) return;
    if (!map[key]) map[key] = { propostas: 0, pedidos: 0, vProp: 0, vPed: 0 };
    map[key].propostas++;
    map[key].vProp += getValorProposta(o);
    if (isPedidoSim(o)) { map[key].pedidos++; map[key].vPed += getValorPedidoReal(o); }
  });
  return Object.entries(map).sort((a, b) => b[1].vProp - a[1].vProp);
}

function _kpiGroupTable(bodyEl, subEl, entries, entityLabel, onDrill) {
  if (!entries.length) {
    bodyEl.innerHTML = `<div class="dash-empty">Nenhum ${entityLabel} encontrado.</div>`;
    if (subEl) subEl.textContent = "";
    return;
  }
  const plural = entries.length !== 1;
  if (subEl) subEl.textContent = `${entries.length} ${entityLabel}${plural ? "s" : ""} encontrado${plural ? "s" : ""}`;
  const label0 = entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1);

  bodyEl.innerHTML = `
    <table class="dash-inner-table kpi-modal-table">
      <thead><tr>
        <th>${label0}</th>
        <th style="text-align:right">Propostas</th>
        <th style="text-align:right">Pedidos</th>
        <th style="text-align:right">R$ Proposto</th>
        <th style="text-align:right">R$ Pedido</th>
        <th style="text-align:right">Conv.%</th>
        <th></th>
      </tr></thead>
      <tbody>
        ${entries.map(([nome, v]) => {
          const conv = v.propostas ? (v.pedidos / v.propostas * 100).toFixed(1) : "0.0";
          const convN = parseFloat(conv);
          const convClass = convN >= 30 ? "dash-tag-ok" : convN >= 10 ? "dash-tag-warn" : "dash-tag-danger";
          const nomeCurto = nome.length > 32 ? nome.slice(0, 30) + "…" : nome;
          return `<tr class="dash-row-clickable" data-drill="${escapeHtml(nome)}" title="${escapeHtml(nome)}">
            <td>${escapeHtml(nomeCurto)}</td>
            <td style="text-align:right">${v.propostas}</td>
            <td style="text-align:right">${v.pedidos}</td>
            <td style="text-align:right">${moneyBRShort(v.vProp)}</td>
            <td style="text-align:right">${moneyBRShort(v.vPed)}</td>
            <td style="text-align:right"><span class="${convClass}">${conv}%</span></td>
            <td style="width:32px"><button class="kpi-row-link kpi-row-drill" data-drill="${escapeHtml(nome)}" title="Ver ofertas" tabindex="-1">↗</button></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;

  bodyEl.querySelectorAll(".dash-row-clickable[data-drill]").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".kpi-row-drill")) return;
      if (onDrill) onDrill(row.dataset.drill);
    });
  });
  bodyEl.querySelectorAll(".kpi-row-drill").forEach(btn => {
    btn.addEventListener("click", () => { if (onDrill) onDrill(btn.dataset.drill); });
  });
}

let _kpiShownOferts = [];

function renderOfertasModal(bodyEl, subEl, rows, q) {
  _kpiCurrentRows = rows;

  const fStatus = $("kpiFilterStatus")?.value || "";
  const fRep    = $("kpiFilterRep")?.value    || "";
  const fPedido = $("kpiFilterPedido")?.value || "";

  let filtered = rows;
  if (fStatus) filtered = filtered.filter(o => getStatusText(o) === fStatus);
  if (fRep)    filtered = filtered.filter(o => getRepNameFromOferta(o) === fRep);
  if (fPedido === "sim") filtered = filtered.filter(isPedidoSim);
  if (fPedido === "nao") filtered = filtered.filter(o => !isPedidoSim(o));

  const sq = norm(q);
  if (sq) filtered = filtered.filter(o =>
    norm(getClienteLabel(o)).includes(sq) ||
    norm(getRepNameFromOferta(o)).includes(sq) ||
    norm(getStatusText(o)).includes(sq) ||
    norm(String(o.oferta || o.numero_oferta || o.numeroOferta || "")).includes(sq)
  );

  const shown = filtered.slice(0, 250);
  _kpiShownOferts = shown;
  const extra = filtered.length - shown.length;
  const plural = filtered.length !== 1;
  if (subEl) subEl.textContent = `${filtered.length} oferta${plural ? "s" : ""} encontrada${plural ? "s" : ""}`;

  if (!filtered.length) {
    bodyEl.innerHTML = `<div class="dash-empty">Nenhuma oferta encontrada.</div>`;
    return;
  }

  bodyEl.innerHTML = `
    <table class="dash-inner-table kpi-modal-table">
      <thead><tr>
        <th style="text-align:left">Nº Oferta</th>
        <th style="text-align:left">Cliente</th>
        <th>Representada</th>
        <th>Status</th>
        <th style="text-align:right">R$ Proposto</th>
        <th style="text-align:right">R$ Pedido</th>
        <th style="text-align:right">Data</th>
        <th></th>
      </tr></thead>
      <tbody>
        ${shown.map((o, i) => {
          const numRaw = String(o.oferta || o.numero_oferta || o.numeroOferta || "").trim();
          const numOferta = numRaw ? (numRaw.length > 15 ? numRaw.slice(0, 14) + "…" : numRaw) : "Sem nº de oferta";
          const cliente = getClienteLabel(o);
          const clienteCurto = cliente.length > 26 ? cliente.slice(0, 24) + "…" : cliente;
          const rep = getRepNameFromOferta(o);
          const repCurto = rep.length > 20 ? rep.slice(0, 18) + "…" : rep;
          const status = getStatusText(o);
          const vProp = getValorProposta(o);
          const hasPed = isPedidoSim(o);
          const vPed = hasPed ? getValorPedidoReal(o) : null;
          const dt = getOfertaDate(o);
          const dtStr = dt ? `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}` : "—";
          return `<tr class="dash-row-clickable" data-idx="${i}" title="${escapeHtml(cliente)} — ${escapeHtml(status)}">
            <td class="kpi-col-num">${escapeHtml(numOferta)}</td>
            <td>${escapeHtml(clienteCurto)}</td>
            <td class="kpi-col-rep">${escapeHtml(repCurto)}</td>
            <td>${getStatusPillHtml(status, hasPed)}</td>
            <td style="text-align:right;font-variant-numeric:tabular-nums">${moneyBRShort(vProp)}</td>
            <td style="text-align:right;font-variant-numeric:tabular-nums">${vPed !== null ? moneyBRShort(vPed) : '<span class="kpi-col-dash">—</span>'}</td>
            <td class="kpi-col-date">${dtStr}</td>
            <td style="width:32px"><button class="kpi-row-link kpi-row-detail" data-idx="${i}" title="Ver detalhes" tabindex="-1">⊞</button></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
    ${extra > 0 ? `<div class="dash-empty" style="padding:10px 16px;font-size:11.5px">+${extra} resultado${extra !== 1 ? "s" : ""} não exibido${extra !== 1 ? "s" : ""} — refine a busca.</div>` : ""}`;

  bodyEl.querySelectorAll(".dash-row-clickable[data-idx]").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".kpi-row-detail")) return;
      const o = _kpiShownOferts[parseInt(row.dataset.idx, 10)];
      if (o) openOfertaDetail(o);
    });
  });
  bodyEl.querySelectorAll(".kpi-row-detail").forEach(btn => {
    btn.addEventListener("click", () => {
      const o = _kpiShownOferts[parseInt(btn.dataset.idx, 10)];
      if (o) openOfertaDetail(o);
    });
  });
}

function openKpiModal(type) {
  const ofertas = _currentFiltered;
  const modal = $("kpiModal");
  if (!modal) return;

  _kpiNavStack = [];
  $("kpiModalBack").style.display = "none";
  _kpiShowSearch(true);
  _kpiShowFilters(false);
  _kpiResetFilterValues();

  const CFGS = {
    propostas:  { title: "Propostas no período",        getRows: f => [...f].sort((a,b) => +(getOfertaDate(b)||0) - +(getOfertaDate(a)||0)) },
    pedidos:    { title: "Pedidos confirmados",          getRows: f => f.filter(isPedidoSim).sort((a,b) => +(getOfertaDate(b)||0) - +(getOfertaDate(a)||0)) },
    rProp:      { title: "R$ Proposto — propostas",      getRows: f => [...f].sort((a,b) => getValorProposta(b) - getValorProposta(a)) },
    rPed:       { title: "R$ Pedido — pedidos",          getRows: f => f.filter(isPedidoSim).sort((a,b) => getValorPedidoReal(b) - getValorPedidoReal(a)) },
    convQtd:    { title: "Conversão — por quantidade",   getRows: f => [...f].sort((a,b) => Number(isPedidoSim(b)) - Number(isPedidoSim(a))) },
    convValor:  { title: "Conversão — por valor",        getRows: f => [...f].sort((a,b) => Number(isPedidoSim(b)) - Number(isPedidoSim(a))) },
    ticketProp: { title: "Ticket médio — propostas",     getRows: f => [...f].sort((a,b) => getValorProposta(b) - getValorProposta(a)) },
    ticketPed:  { title: "Ticket médio — pedidos",       getRows: f => f.filter(isPedidoSim).sort((a,b) => getValorPedidoReal(b) - getValorPedidoReal(a)) },
    clientes:   { title: "Clientes ativos no período",   mode: "clientes" },
    reps:       { title: "Representadas ativas",         mode: "reps" },
    projetos:   { title: "Projetos com propostas",       mode: "projetos" },
    aguardando: { title: "Aguardando pedido",            getRows: f => f.filter(o => !isPedidoSim(o) && norm(getStatusText(o)).includes("aguard")) },
  };

  const cfg = CFGS[type] || { title: "Detalhes", getRows: f => f };
  const mode = cfg.mode || "ofertas";
  const baseRows = mode !== "ofertas" ? ofertas : (cfg.getRows ? cfg.getRows(ofertas) : ofertas);

  $("kpiModalTitle").textContent = cfg.title;
  $("kpiModalSub").textContent   = "";
  const searchEl = $("kpiModalSearch");
  searchEl.value = "";

  function makeDrillFn(getKey) {
    return (nome) => {
      const prevTitle      = $("kpiModalTitle").textContent;
      const prevSub        = $("kpiModalSub").textContent;
      const capturedRender = render;
      _kpiPushLevel(prevTitle, prevSub, true, capturedRender);
      $("kpiModalTitle").textContent = nome;
      $("kpiModalSub").textContent   = "";
      searchEl.value = "";
      _kpiResetFilterValues();
      const entityRows = baseRows.filter(o => getKey(o) === nome);
      _kpiPopulateFilters(entityRows);
      _kpiShowFilters(true);
      const newRender = (q) => renderOfertasModal($("kpiModalBody"), $("kpiModalSub"), entityRows, q);
      searchEl.oninput = (ev) => newRender(ev.target.value);
      newRender("");
    };
  }

  function render(q) {
    const bodyEl = $("kpiModalBody");
    const subEl  = $("kpiModalSub");
    if (!bodyEl) return;
    const sq = norm(q);
    if (mode === "clientes") {
      _kpiShowFilters(false);
      let entries = _kpiGroupOfertas(baseRows, getClienteLabel).filter(([n]) => n !== "Sem cliente");
      if (sq) entries = entries.filter(([n]) => norm(n).includes(sq));
      _kpiGroupTable(bodyEl, subEl, entries, "cliente", makeDrillFn(getClienteLabel));
    } else if (mode === "reps") {
      _kpiShowFilters(false);
      let entries = _kpiGroupOfertas(baseRows, getRepNameFromOferta).filter(([n]) => !!n);
      if (sq) entries = entries.filter(([n]) => norm(n).includes(sq));
      _kpiGroupTable(bodyEl, subEl, entries, "representada", makeDrillFn(getRepNameFromOferta));
    } else if (mode === "projetos") {
      _kpiShowFilters(false);
      let entries = _kpiGroupOfertas(baseRows, getProjetoLabel).filter(([n]) => !!n);
      if (sq) entries = entries.filter(([n]) => norm(n).includes(sq));
      _kpiGroupTable(bodyEl, subEl, entries, "projeto", makeDrillFn(getProjetoLabel));
    } else {
      _kpiShowFilters(true);
      renderOfertasModal(bodyEl, subEl, baseRows, q);
    }
  }

  searchEl.oninput = (ev) => render(ev.target.value);
  if (mode === "ofertas") _kpiPopulateFilters(baseRows);
  render("");
  modal.style.display = "flex";
  requestAnimationFrame(() => searchEl.focus());
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

function _comparativoPlaceholder(canvasId, msg) {
  const el = $(canvasId);
  if (!el) return;
  const ctx = el.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, el.width, el.height);
  ctx.fillStyle = isDark() ? "#94A3B8" : "#64748B";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(msg || "Defina um período para ver a comparação", el.width / 2, el.height / 2);
}

function buildComparativoChart(ofertasFiltradas, ofertasAnteriores, semComparacao = false) {
  if (!ofertasAnteriores) {
    const msg = semComparacao ? "Período anterior sem dados suficientes para comparar" : "Defina um período para ver a comparação";
    _comparativoPlaceholder("chartComparativo", msg);
    _comparativoPlaceholder("chartComparativoValores", msg);
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
  const box = $("chartTopClientesPedido")?.parentElement;
  box?.querySelectorAll(".dash-empty").forEach(el => el.remove());
  if (!top.length) { if (box) box.insertAdjacentHTML("beforeend", '<div class="dash-empty">Sem pedidos no período.</div>'); return; }

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
          return `<tr class="dash-row-clickable" data-search="${escapeHtml(nome)}" title="${escapeHtml(nome)}">
            <td>${escapeHtml(nomeCurto)}</td>
            <td style="text-align:right">${v.propostas}</td>
            <td style="text-align:right">${v.pedidos}</td>
            <td style="text-align:right">${moneyBRShort(v.vProp)}</td>
            <td style="text-align:right"><span class="dash-tag-danger">${conv}%</span></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;
  box.querySelectorAll(".dash-row-clickable[data-search]").forEach(row => {
    row.addEventListener("click", () => drillDown({ searchTerm: row.dataset.search }));
  });
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

function buildWinRateRepsChart(ofertasFiltradas) {
  const map = {};
  ofertasFiltradas.forEach(o => {
    const r = getRepNameFromOferta(o) || "Sem representada";
    if (!map[r]) map[r] = { total: 0, ganhas: 0 };
    map[r].total++;
    const s = norm(getStatusText(o));
    if (isPedidoSim(o) || s.includes("ganho")) map[r].ganhas++;
  });

  const arr = Object.entries(map)
    .filter(([, v]) => v.total >= 2)
    .map(([rep, v]) => ({ rep, rate: (v.ganhas / v.total) * 100, ganhas: v.ganhas, total: v.total }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 15);

  const winRateBox = $("winRateRepsBox");
  if (!arr.length) {
    if (winRateBox) winRateBox.innerHTML = `<div class="dash-empty">Sem dados suficientes no período.</div>`;
    return;
  }

  const colors = arr.map(x =>
    x.rate >= 60 ? paletteAlpha("#10B981", 0.8) :
    x.rate >= 35 ? paletteAlpha("#F59E0B", 0.8) :
                   paletteAlpha("#EF4444", 0.8)
  );

  charts.winRateReps = safeChart("chartWinRateReps", {
    type: "bar",
    data: {
      labels: arr.map(x => x.rep.length > 22 ? x.rep.slice(0, 20) + "…" : x.rep),
      datasets: [{
        label: "Win Rate %",
        data: arr.map(x => Number(x.rate.toFixed(1))),
        backgroundColor: colors,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const d = arr[ctx.dataIndex];
              return ` ${ctx.parsed.x.toFixed(1)}%  (${d.ganhas} ganhas / ${d.total} total)`;
            }
          }
        }
      },
      scales: {
        x: { ticks: { maxRotation: 40, minRotation: 40, font: { size: 10 } }, grid: { display: false } },
        y: { min: 0, max: 100, ticks: { callback: v => v + "%" } }
      }
    }
  });

  if (winRateBox) {
    winRateBox.innerHTML = `
      <table class="dash-inner-table">
        <thead><tr>
          <th>Representada</th>
          <th style="text-align:right">Ganhas</th>
          <th style="text-align:right">Total</th>
          <th style="text-align:right">Win Rate</th>
        </tr></thead>
        <tbody>
          ${arr.map(x => `
            <tr>
              <td>${x.rep}</td>
              <td style="text-align:right">${x.ganhas}</td>
              <td style="text-align:right">${x.total}</td>
              <td style="text-align:right;font-weight:600;color:${x.rate >= 60 ? "#10B981" : x.rate >= 35 ? "#F59E0B" : "#EF4444"}">${x.rate.toFixed(1)}%</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  }
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
          return `<tr class="dash-row-clickable" data-search="${escapeHtml(rep)}" title="${escapeHtml(rep)}">
            <td>${escapeHtml(nome)}</td>
            <td style="text-align:right">${moneyBRShort(v.vProp)}</td>
            <td style="text-align:right">${moneyBRShort(v.vPed)}</td>
            <td style="text-align:right">${conv}%</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;
  box.querySelectorAll(".dash-row-clickable[data-search]").forEach(row => {
    row.addEventListener("click", () => drillDown({ searchTerm: row.dataset.search }));
  });
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
  const card = $("chartProjetosVolume")?.closest(".d-card");
  card?.querySelectorAll(".dash-empty").forEach(el => el.remove());
  if (!top.length) { if (card) card.insertAdjacentHTML("beforeend", '<div class="dash-empty">Nenhum projeto vinculado às ofertas do período.</div>'); return; }

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

function buildDashboardVisuals(ofertasFiltradas, ofertasAnteriores, semComparacao = false) {
  destroyCharts();
  applyChartTheme();

  // Performance
  buildFunilChart(ofertasFiltradas);
  buildEvolucaoChart(ofertasFiltradas);
  buildComparativoChart(ofertasFiltradas, ofertasAnteriores, semComparacao);

  // Clientes
  buildTopClientesPedidoChart(ofertasFiltradas);
  buildTopClientesPropostaChart(ofertasFiltradas);
  buildClientesRiscoTable(ofertasFiltradas);

  // Representadas
  buildRepsPropPedChart(ofertasFiltradas);
  buildConversaoChart(ofertasFiltradas);
  buildWinRateRepsChart(ofertasFiltradas);
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
  bindKpiModal();
  bindExportBtn();

  setStatus("Carregando Firebase...");
  await esperarFirebase();

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      setStatus("Você precisa fazer login. Redirecionando...");
      window.location.href = "index.html";
      return;
    }

    const ADMIN_EMAILS_DASH = [
      "fabricio.giacomelli@threear.com.br",
      "ronaldo.giacomelli@threear.com.br",
    ];
    const emailNorm = String(user.email || "").toLowerCase().trim();

    try {
      const doc = await window.db.collection("usuarios").doc(user.uid).get();
      const dados = doc.exists ? (doc.data() || {}) : {};
      _dashUserRole = dados.role || (ADMIN_EMAILS_DASH.includes(emailNorm) ? "admin" : "user");
    } catch (_) {
      _dashUserRole = ADMIN_EMAILS_DASH.includes(emailNorm) ? "admin" : "user";
    }

    const podeExportar = _dashUserRole === "admin" || _dashUserRole === "supervisor";
    const exportWrap = $("exportWrap");
    if (exportWrap) exportWrap.style.display = podeExportar ? "" : "none";

    $("userInfo").textContent =
      (typeof getCurrentUserName === "function" && getCurrentUserName()) ||
      user.displayName || user.email || "Usuário";

    setStatus("Carregando dados...");

    let ofertas, clientes, reps, projetos;
    try {
      [ofertas, clientes, reps, projetos] = await Promise.all([
        carregarColecao("ofertas"),
        carregarColecao("clientes"),
        carregarColecao("representadas"),
        carregarColecao("projetos"),
      ]);
    } catch (err) {
      console.error("Erro ao carregar dados do Firestore:", err);
      setStatus("Erro ao carregar dados. Recarregue a página.");
      return;
    }

    ofertasDB = ofertas;
    clientesDB = clientes;
    repsDB = reps;
    projetosDB = projetos;

    buildFilterOptions();

    const run = () => {
      const filtered = applyDashboardFilters();
      const { ini, fim } = getFilterState();
      const periodoAnt = calcularPeriodoAnterior(ini, fim);
      const anteriorRaw = periodoAnt ? applyFiltersComDatas(periodoAnt.iniAnt, periodoAnt.fimAnt) : null;
      const minParaComparar = Math.max(5, Math.ceil(filtered.length * 0.1));
      const anterior = anteriorRaw?.length >= minParaComparar ? anteriorRaw : null;
      const semComparacao = periodoAnt && anteriorRaw !== null && anterior === null;
      _currentFiltered = filtered;
      renderKPIs(filtered, anterior);
      buildDashboardVisuals(filtered, anterior, semComparacao);
      setStatus(`OK — ${filtered.length} oferta(s) no filtro`);
    };

    window._dashRun = run;

    let _runDebounce = null;
    $("btnAplicarFiltros")?.addEventListener("click", () => {
      clearTimeout(_runDebounce);
      _runDebounce = setTimeout(run, 200);
    });
    $("dashPeriodo")?.addEventListener("change", (e) => { if (e.target.value !== "custom") setPresetDates(e.target.value); run(); });
    $("dashIni")?.addEventListener("change", () => { $("dashPeriodo").value = "custom"; run(); });
    $("dashFim")?.addEventListener("change", () => { $("dashPeriodo").value = "custom"; run(); });
    $("dashRep")?.addEventListener("change", run);
    $("dashUser")?.addEventListener("change", run);
    $("dashStatus")?.addEventListener("change", run);
    $("dashBU")?.addEventListener("change", run);
    $("dashCliente")?.addEventListener("change", run);
    $("dashProjeto")?.addEventListener("change", run);
    $("btnLimparFiltros")?.addEventListener("click", () => {
      $("dashPeriodo").value = "30";
      setPresetDates("30");
      $("dashRep").value = "all";
      $("dashUser").value = "all";
      $("dashStatus").value = "all";
      if ($("dashBU")) $("dashBU").value = "all";
      if ($("dashCliente")) $("dashCliente").value = "all";
      if ($("dashProjeto")) $("dashProjeto").value = "all";
      run();
    });

    setPresetDates($("dashPeriodo")?.value || "30");
    run();
  });
}

window.addEventListener("DOMContentLoaded", () => {
  initDashboard().catch(err => { console.error(err); setStatus("Erro ao inicializar. Veja o console."); });
});

