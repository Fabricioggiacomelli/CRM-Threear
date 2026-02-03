// =======================
// Helpers
// =======================
function norm(s) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim();
}

function setStatus(msg) {
  const el = document.getElementById("dashStatusText");
  if (el) el.textContent = msg || "";
}

function parseMoneyBR(v) {
  if (typeof v === "number") return v;
  const s = String(v || "").trim();
  if (!s) return 0;
  const clean = s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function getValorProposta(o) {
  // pega tanto número quanto "R$ 1.234,56"
  const v = o.valorTotal ?? o.vl_total ?? o.valor_total ?? 0;
  return parseMoneyBR(v);
}

function getValorPedido(o) {
  const vp = parseMoneyBR(o.vlTotalPedido ?? o.vl_total_pedido ?? 0);
  const vt = getValorProposta(o);
  return (vp && vp > 0) ? vp : vt;
}

function moneyBR(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseDateAny(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);
  if (typeof v === "object" && v.seconds) return new Date(v.seconds * 1000); // Timestamp Firestore

  const s = String(v).trim();
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function statusGroup(rawStatus, pedido, revisao) {
  const s = norm(rawStatus);

  if (s.includes("perd") || s.includes("cancel") || s.includes("sem retorno") || s.includes("recus"))
    return "perdida";

  if (s.includes("ganh") || s.includes("fech") || s.includes("aprov") || s.includes("pedido"))
    return "ganha";

  if (s.includes("aguard") || s.includes("pend") || s.includes("esper"))
    return "aguardando";

  const pedidoSim = norm(pedido) === "sim" || pedido === true;
  if (pedidoSim) return "ganha";

  const revSim = norm(revisao) === "sim" || revisao === true;
  if (revSim) return "em_revisao";

  return s ? "em_andamento" : "sem_status";
}

// =======================
// Firebase guard
// =======================
function esperarFirebase(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      if (window.firebase && window.auth && window.db) {
        clearInterval(t);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(t);
        reject(new Error("Firebase não carregou (auth/db indefinidos). Verifique firebase.js + ordem dos scripts."));
      }
    }, 50);
  });
}

async function carregarColecao(nome) {
  const snap = await db.collection(nome).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// =======================
// Estado
// =======================
let ofertasDB = [];
let clientesDB = [];
let repsDB = [];

let charts = { status: null, evolucao: null, top3: null, conv: null };

// =======================
// Sidebar nav
// =======================
document.getElementById("btnDashboard")?.addEventListener("click", () => window.location.href = "html.html");
document.getElementById("btnSair")?.addEventListener("click", () => window.location.href = "html.html");

// =======================
// Filters UI
// =======================
function buildFilterOptions() {
  // Representadas
  const selRep = document.getElementById("dashRep");
  const repNames = [...new Set(ofertasDB.map(o => (o.representada || o.representadaNome || o.rep || "").trim()))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  selRep.innerHTML =
    `<option value="all">Todas</option`> +
    repNames.map(r => `<option value="${r}">${r}</option>`).join("");

  // Usuários
  const selUser = document.getElementById("dashUser");
  const users = [...new Set(ofertasDB.map(o => (o.usuario || o.criadoPor || o.user || "").trim()))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  selUser.innerHTML =
    `<option value="all">Todos</option>` +
    users.map(u => `<option value="${u}">${u}</option>`).join("");
}

function applyDashboardFilters() {
  const periodo = document.getElementById("dashPeriodo")?.value || "30";
  const rep = document.getElementById("dashRep")?.value || "all";
  const user = document.getElementById("dashUser")?.value || "all";
  const st = document.getElementById("dashStatusGroup")?.value || "all";

  const now = new Date();
  let minDate = null;
  if (periodo !== "all") {
    const days = parseInt(periodo, 10);
    minDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  return ofertasDB.filter(o => {
    const repNome = String(o.representada || o.representadaNome || o.rep || "").trim();
    const usuario = String(o.usuario || o.criadoPor || o.user || "").trim();
    const grp = statusGroup(o.status, o.pedido, o.revisao);

    // ajuste aqui caso seu campo de data tenha outro nome
    const dt = parseDateAny(o.data || o.dataCadastro || o.createdAt || o.dataCriacao);

    if (rep !== "all" && repNome !== rep) return false;
    if (user !== "all" && usuario !== user) return false;
    if (st !== "all" && grp !== st) return false;

    // se não tem data, deixa passar
    if (minDate && dt && dt < minDate) return false;

    return true;
  });
}

// =======================
// KPIs + Alerts
// =======================
function renderKPIs(ofertasFiltradas) {
  const totalPropostas = ofertasFiltradas.length;

  const pedidos = ofertasFiltradas.filter(o => statusGroup(o.status, o.pedido, o.revisao) === "ganha");
  const revisoes = ofertasFiltradas.filter(o => statusGroup(o.status, o.pedido, o.revisao) === "em_revisao");
  const aguardando = ofertasFiltradas.filter(o => statusGroup(o.status, o.pedido, o.revisao) === "aguardando");
  const perdidas = ofertasFiltradas.filter(o => statusGroup(o.status, o.pedido, o.revisao) === "perdida");

  const vProp = ofertasFiltradas.reduce((acc, o) => acc + getValorProposta(o), 0);
  const vPed = ofertasFiltradas.reduce((acc, o) => acc + getValorPedido(o), 0);

  document.getElementById("kpiPropostas").textContent = String(totalPropostas);
  document.getElementById("kpiPedidos").textContent = String(pedidos.length);
  document.getElementById("kpiRevisoes").textContent = String(revisoes.length);
  document.getElementById("kpiAguardando").textContent = String(aguardando.length);

  document.getElementById("kpiValorPropostas").textContent = moneyBR(vProp);
  document.getElementById("kpiValorPedidos").textContent = moneyBR(vPed);

  document.getElementById("kpiClientes").textContent = String(clientesDB.length);
  document.getElementById("kpiRepresentadas").textContent = String(repsDB.length);

  const alerts = [];
  if (aguardando.length > 0) alerts.push({ type: "warn", text: `Tem <strong>${aguardando.length}</strong> ofertas aguardando pedido. `});
  if (perdidas.length > 0) alerts.push({ type: "danger", text: `Existem <strong>${perdidas.length}</strong> ofertas perdidas no período filtrado. `});
  if (totalPropostas === 0) alerts.push({ type: "danger", text: `Nenhuma proposta encontrada com os filtros atuais. `});
  if (pedidos.length > 0) alerts.push({ type: "ok", text: `Você tem <strong>${pedidos.length}</strong> pedidos (ganhos) no período filtrado. `});

  const box = document.getElementById("dashAlerts");
  if (box) box.innerHTML = alerts.map(a => `<div class="alert ${a.type}">${a.text}</div>`).join("");
}

// =======================
// Charts
// =======================
function destroyCharts() {
  Object.values(charts).forEach(c => c && c.destroy());
  charts = { status: null, evolucao: null, top3: null, conv: null };
}

function buildCharts(ofertasFiltradas) {
  destroyCharts();

  // 1) Status (grupo)
  const groups = ["ganha", "aguardando", "em_revisao", "em_andamento", "perdida", "sem_status"];
  const statusCount = Object.fromEntries(groups.map(g => [g, 0]));

  ofertasFiltradas.forEach(o => {
    const g = statusGroup(o.status, o.pedido, o.revisao);
    statusCount[g] = (statusCount[g] || 0) + 1;
  });

  charts.status = new Chart(document.getElementById("chartStatus"), {
    type: "bar",
    data: {
      labels: groups,
      datasets: [{ label: "Qtde", data: groups.map(g => statusCount[g] || 0) }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // 2) Top 3 representadas (R$ pedidos)
  const repMap = {};
  ofertasFiltradas.forEach(o => {
    const rep = String(o.representada || o.representadaNome || o.rep || "Sem representada").trim() || "Sem representada";
    repMap[rep] = (repMap[rep] || 0) + getValorPedido(o);
  });

  const top = Object.entries(repMap).sort((a, b) => b[1] - a[1]).slice(0, 3);

  charts.top3 = new Chart(document.getElementById("chartTop3"), {
    type: "bar",
    data: {
      labels: top.map(x => x[0]),
      datasets: [{ label: "R$ pedidos", data: top.map(x => x[1]) }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // 3) Conversão por representada
  const conv = {};
  ofertasFiltradas.forEach(o => {
    const rep = String(o.representada || o.representadaNome || o.rep || "Sem representada").trim() || "Sem representada";
    const g = statusGroup(o.status, o.pedido, o.revisao);
    if (!conv[rep]) conv[rep] = { total: 0, ganha: 0 };
    conv[rep].total++;
    if (g === "ganha") conv[rep].ganha++;
  });

  const convArr = Object.entries(conv)
    .map(([k, v]) => [k, v.total ? (v.ganha / v.total) * 100 : 0])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  charts.conv = new Chart(document.getElementById("chartConversao"), {
    type: "bar",
    data: {
      labels: convArr.map(x => x[0]),
      datasets: [{ label: "% conversão", data: convArr.map(x => Number(x[1].toFixed(1))) }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // 4) Evolução por mês
  const byMonth = {};
  ofertasFiltradas.forEach(o => {
    const dt = parseDateAny(o.data || o.dataCadastro || o.createdAt || o.dataCriacao);
    if (!dt) return;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { prop: 0, ped: 0 };
    byMonth[key].prop++;
    if (statusGroup(o.status, o.pedido, o.revisao) === "ganha") byMonth[key].ped++;
  });

  const months = Object.keys(byMonth).sort();

  charts.evolucao = new Chart(document.getElementById("chartEvolucao"), {
    type: "line",
    data: {
      labels: months,
      datasets: [
        { label: "Propostas", data: months.map(m => byMonth[m].prop) },
        { label: "Pedidos", data: months.map(m => byMonth[m].ped) },
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

// =======================
// Init
// =======================
async function initDashboard() {
  setStatus("Carregando Firebase...");
  await esperarFirebase();

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      setStatus("Você não está logado. Volte para o CRM e faça login.");
      return;
    }

    // topo (se existir no seu app.js)
    try {
      document.getElementById("userInfo").textContent = (getCurrentUserName?.() || user.email || "");
    } catch (e) {}

    setStatus("Carregando dados do Firestore...");

    const [ofertas, clientes, reps] = await Promise.all([
      carregarColecao("ofertas"),
      carregarColecao("clientes"),
      carregarColecao("representadas"),
    ]);

    ofertasDB = ofertas;
    clientesDB = clientes;
    repsDB = reps;

    buildFilterOptions();

    const run = () => {
      const filtered = applyDashboardFilters();
      renderKPIs(filtered);
      buildCharts(filtered);
      setStatus(`OK — ${filtered.length} ofertas no filtro`);
    };

    document.getElementById("btnAplicarFiltros")?.addEventListener("click", run);
    run();
  });
}

window.addEventListener("DOMContentLoaded", () => {
  initDashboard().catch(err => {
    console.error(err);
    setStatus("Erro ao carregar. Veja o console.");
    alert("Erro ao carregar Dashboard. Veja o console.");
  });
});