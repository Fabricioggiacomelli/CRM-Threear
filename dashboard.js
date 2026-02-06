function $(id) {
  return document.getElementById(id);
}

function setStatus(msg) {
  const el = $("dashStatusText");
  if (el) el.textContent = msg || "";
}

window.addEventListener("error", (e) => {
  const msg = e?.message || "Erro desconhecido";
  const where = e?.filename
    ? ` (${e.filename.split("/").pop()}:${e.lineno})`
    : "";
  setStatus(`ERRO: ${msg}${where}`);
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = e?.reason?.message || String(e?.reason || "Promise rejeitada");
  setStatus(`ERRO (promise): ${msg}`);
});

function norm(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function moneyBR(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseMoneyBR(v) {
  if (typeof v === "number") return v;
  const s = String(v || "").trim();
  if (!s) return 0;
  const clean = s
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
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

  const m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?$/,
  );
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10) - 1;
    let yy = parseInt(m[3], 10);
    if (yy < 100) yy += 2000;
    const hh = m[4] ? parseInt(m[4], 10) : 0;
    const mi = m[5] ? parseInt(m[5], 10) : 0;
    const d = new Date(yy, mm, dd, hh, mi, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function getOfertaDate(o) {
  return (
    parseDateAny(o.data_entrada) ||
    parseDateAny(o.dataEntrada) ||
    parseDateAny(o.createdAt) ||
    parseDateAny(o.data) ||
    null
  );
}

function getValorProposta(o) {
  const v = o.valor_total ?? o.valorTotal ?? o.vl_total ?? 0;
  return parseMoneyBR(v);
}

function getValorPedido(o) {
  const pedido = o.pedido || {};
  const vp =
    pedido.valor_pedido ??
    pedido.valorPedido ??
    o.vlTotalPedido ??
    o.vl_total_pedido ??
    0;
  const n = parseMoneyBR(vp);
  return n && n > 0 ? n : getValorProposta(o);
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
  return String(
    o.atualizadoPor || o.criadoPor || o.usuario || o.user || "",
  ).trim();
}
function getRepNameFromOferta(o) {
  return String(o.representadaNome || o.representada || o.rep || "").trim();
}
function getStatusText(o) {
  return String(o.status || "").trim() || "Sem status";
}

function esperarFirebase(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      if (window.firebase && window.auth && window.db) {
        clearInterval(t);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(t);
        reject(
          new Error(
            "Firebase não carregou (auth/db indefinidos). Verifique firebase.js + ordem dos scripts.",
          ),
        );
      }
    }, 50);
  });
}

async function carregarColecao(nome) {
  const snap = await db.collection(nome).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  document.body.classList.toggle("light", theme === "light");

  const label = $("temaLabel");
  if (label)
    label.textContent = theme === "dark" ? "Modo claro" : "Modo escuro";

  localStorage.setItem("dash_theme", theme);
}

function initTheme() {
  const saved = localStorage.getItem("dash_theme");
  applyTheme(saved === "light" ? "light" : "dark");

  $("btnTema")?.addEventListener("click", () => {
    const current = document.body.classList.contains("dark") ? "dark" : "light";
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

let ofertasDB = [];
let clientesDB = [];
let repsDB = [];
let charts = { status: null, evolucao: null, conv: null };

function bindSidebar() {
  $("btnDashboard")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "dashboard.html";
  });

  $("btnVoltar")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = "html.html";
  });

  $("btnSair")?.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await auth.signOut();
      window.location.href = "html.html";
    } catch (err) {
      console.error(err);
      setStatus("Erro ao sair. Veja o console.");
    }
  });
}

function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function setPresetDates(preset) {
  const ini = $("dashIni");
  const fim = $("dashFim");
  if (!ini || !fim) return;

  const now = new Date();

  if (preset === "all") {
    ini.value = "";
    fim.value = "";
    return;
  }
  if (preset === "custom") return;

  const days = parseInt(preset, 10);
  const minDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  ini.value = toISODate(minDate);
  fim.value = toISODate(now);
}

function buildFilterOptions() {
  const selRep = $("dashRep");
  if (selRep) {
    const repFromOfertas = ofertasDB.map(getRepNameFromOferta);
    const repFromColecao = repsDB.map((r) =>
      String(r.nome || r.representada || r.nomeRepresentada || "").trim(),
    );
    const repNames = [...new Set([...repFromOfertas, ...repFromColecao])]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    selRep.innerHTML =
      `<option value="all">Todas</option>` +
      repNames.map((r) => `<option value="${r}">${r}</option>`).join("");
  }

  const selUser = $("dashUser");
  if (selUser) {
    const users = [...new Set(ofertasDB.map(getUserNameFromOferta))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    selUser.innerHTML =
      `<option value="all">Todos</option>` +
      users.map((u) => `<option value="${u}">${u}</option>`).join("");
  }

  const selStatus = $("dashStatus");
  if (selStatus) {
    const freq = {};
    ofertasDB.forEach((o) => {
      const s = getStatusText(o);
      freq[s] = (freq[s] || 0) + 1;
    });
    const statusList = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([s]) => s);
    selStatus.innerHTML =
      `<option value="all">Todos</option>` +
      statusList.map((s) => `<option value="${s}">${s}</option>`).join("");
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

  return ofertasDB.filter((o) => {
    const repNome = getRepNameFromOferta(o);
    const usuario = getUserNameFromOferta(o);
    const status = getStatusText(o);
    const dt = getOfertaDate(o);

    if (rep !== "all" && repNome !== rep) return false;
    if (user !== "all" && usuario !== user) return false;
    if (st !== "all" && status !== st) return false;

    if (ini && dt && dt < ini) return false;
    if (fim && dt) {
      const end = new Date(fim.getTime() + 24 * 60 * 60 * 1000 - 1);
      if (dt > end) return false;
    }
    return true;
  });
}

function renderKPIs(ofertasFiltradas) {
  const totalPropostas = ofertasFiltradas.length;
  const pedidos = ofertasFiltradas.filter(isPedidoSim);
  const revisoes = ofertasFiltradas.filter(isRevisaoSim);
  const aguardando = ofertasFiltradas.filter(
    (o) => !isPedidoSim(o) && norm(getStatusText(o)).includes("aguard"),
  );

  const vProp = ofertasFiltradas.reduce(
    (acc, o) => acc + getValorProposta(o),
    0,
  );
  const vPed = pedidos.reduce((acc, o) => acc + getValorPedido(o), 0);

  $("kpiPropostas").textContent = String(totalPropostas);
  $("kpiPedidos").textContent = String(pedidos.length);
  $("kpiRevisoes").textContent = String(revisoes.length);
  $("kpiAguardando").textContent = String(aguardando.length);

  $("kpiValorPropostas").textContent = moneyBR(vProp);
  $("kpiValorPedidos").textContent = moneyBR(vPed);

  $("kpiClientes").textContent = String(clientesDB.length);
  $("kpiRepresentadas").textContent = String(repsDB.length);

  const alerts = [];
  if (aguardando.length > 0)
    alerts.push({
      type: "warn",
      text: `Tem <strong>${aguardando.length}</strong> ofertas aguardando pedido.`,
    });
  if (totalPropostas === 0)
    alerts.push({
      type: "danger",
      text: `Nenhuma proposta encontrada com os filtros atuais.`,
    });
  if (pedidos.length > 0)
    alerts.push({
      type: "ok",
      text: `Você tem <strong>${pedidos.length}</strong> pedidos no filtro.`,
    });

  const box = $("dashAlerts");
  if (box)
    box.innerHTML = alerts
      .map((a) => `<div class="alert ${a.type}">${a.text}</div>`)
      .join("");
}

function destroyCharts() {
  Object.values(charts).forEach((c) => c && c.destroy && c.destroy());
  charts = { status: null, evolucao: null, conv: null };
}

function safeChart(canvasId, config) {
  if (!window.Chart) return null;
  const el = $(canvasId);
  if (!el) return null;
  return new Chart(el, config);
}

function buildStatusChart(ofertasFiltradas) {
  const freq = {};
  ofertasFiltradas.forEach((o) => {
    const s = getStatusText(o);
    freq[s] = (freq[s] || 0) + 1;
  });

  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 10);
  const rest = sorted.slice(10);

  const labels = top.map((x) => x[0]);
  const data = top.map((x) => x[1]);

  if (rest.length) {
    labels.push("Outros");
    data.push(rest.reduce((acc, x) => acc + x[1], 0));
  }

  charts.status = safeChart("chartStatus", {
    type: "bar",
    data: { labels, datasets: [{ label: "Qtde", data }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
}

function buildEvolucaoChart(ofertasFiltradas) {
  const byMonth = {};
  ofertasFiltradas.forEach((o) => {
    const dt = getOfertaDate(o);
    if (!dt) return;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { prop: 0, ped: 0 };
    byMonth[key].prop++;
    if (isPedidoSim(o)) byMonth[key].ped++;
  });

  const months = Object.keys(byMonth).sort();
  const labels = months.map((m) => {
    const [y, mm] = m.split("-");
    return `${mm}/${y}`;
  });

  charts.evolucao = safeChart("chartEvolucao", {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Propostas", data: months.map((m) => byMonth[m].prop) },
        { label: "Pedidos", data: months.map((m) => byMonth[m].ped) },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

function buildConversaoChart(ofertasFiltradas) {
  const map = {};
  ofertasFiltradas.forEach((o) => {
    const rep = getRepNameFromOferta(o) || "Sem representada";
    if (!map[rep]) map[rep] = { total: 0, ped: 0 };
    map[rep].total++;
    if (isPedidoSim(o)) map[rep].ped++;
  });

  const arr = Object.entries(map)
    .map(([rep, v]) => ({ rep, conv: v.total ? (v.ped / v.total) * 100 : 0 }))
    .sort((a, b) => b.conv - a.conv)
    .slice(0, 12);

  charts.conv = safeChart("chartConversao", {
    type: "bar",
    data: {
      labels: arr.map((x) => x.rep),
      datasets: [
        {
          label: "% conversão",
          data: arr.map((x) => Number(x.conv.toFixed(1))),
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

function buildTopRepsTable(ofertasFiltradas) {
  const box = $("topRepsBox");
  if (!box) return;

  const map = {};
  ofertasFiltradas.forEach((o) => {
    if (!isPedidoSim(o)) return;
    const rep = getRepNameFromOferta(o) || "Sem representada";
    map[rep] = (map[rep] || 0) + getValorPedido(o);
  });

  const top = Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (!top.length) {
    box.innerHTML = `<div style="opacity:.8;">Sem pedidos no filtro.</div>`;
    return;
  }

  box.innerHTML = `
    <table style="width:100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,.08);">Representada</th>
          <th style="text-align:right; padding:8px; border-bottom:1px solid rgba(255,255,255,.08);">R$ (Pedidos)</th>
        </tr>
      </thead>
      <tbody>
        ${top
          .map(
            ([rep, val]) => `
          <tr>
            <td style="padding:8px; border-bottom:1px solid rgba(255,255,255,.06);">${rep}</td>
            <td style="padding:8px; border-bottom:1px solid rgba(255,255,255,.06); text-align:right;">${moneyBR(val)}</td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function buildDashboardVisuals(ofertasFiltradas) {
  destroyCharts();
  buildStatusChart(ofertasFiltradas);
  buildEvolucaoChart(ofertasFiltradas);
  buildConversaoChart(ofertasFiltradas);
  buildTopRepsTable(ofertasFiltradas);
}

async function initDashboard() {
  initTheme();
  bindSidebar();

  setStatus("Carregando Firebase...");
  await esperarFirebase();

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      setStatus("Você precisa fazer login. Redirecionando...");
      $("userInfo").textContent = "—";
      window.location.href = "html.html";
      return;
    }

    $("userInfo").textContent =
      (typeof getCurrentUserName === "function" && getCurrentUserName()) ||
      user.displayName ||
      user.email ||
      "Usuário";

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
      buildDashboardVisuals(filtered);
      setStatus(`OK — ${filtered.length} ofertas no filtro`);
    };

    $("btnAplicarFiltros")?.addEventListener("click", run);

    $("dashPeriodo")?.addEventListener("change", (e) => {
      const v = e.target.value;
      if (v !== "custom") setPresetDates(v);
      run();
    });

    $("dashIni")?.addEventListener("change", () => {
      $("dashPeriodo").value = "custom";
      run();
    });

    $("dashFim")?.addEventListener("change", () => {
      $("dashPeriodo").value = "custom";
      run();
    });

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
  initDashboard().catch((err) => {
    console.error(err);
    setStatus("Erro ao inicializar. Veja o console.");
  });
});
