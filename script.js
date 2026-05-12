// ─────────────────────────────────────────────────────────
// UTILITÁRIOS GLOBAIS
// ─────────────────────────────────────────────────────────

/**
 * Timestamp do Firestore — use APENAS em campos de nível raiz do documento
 * que NÃO precisam ser lidos imediatamente após o write.
 *
 * NÃO use em: arrays (historico, contatos), campos lidos logo após salvar,
 * ou campos comparados via string. Nesses casos use new Date().toISOString().
 */
const serverTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();

/** Previne addEventListener duplicado: marca o elemento com dataset após bind */
function addListenerOnce(el, event, handler, key) {
  if (!el) return;
  const flag = `bound_${key || event}`;
  if (el.dataset[flag]) return;
  el.dataset[flag] = "1";
  el.addEventListener(event, handler);
}

/**
 * Paginação unificada — elimina a duplicação em renderTabela*
 * @returns {{ pageData, totalPages, start }}
 */
function getPaginatedData(list, page, pageSize) {
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    pageData: list.slice(start, start + pageSize),
    totalPages,
    start,
    safePage,
  };
}

/** Alias curto para escapeHtml — use em template literals com dados do usuário */
const esc = (s) => String(s || "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

// ─────────────────────────────────────────────────────────
// CACHE DE ELEMENTOS DOM FIXOS
// Populado em mostrarApp() após #appContainer ficar visível.
// Use DOM.xxx em vez de document.querySelector/getElementById
// dentro de renderTabela*, evitando re-query a cada render.
// ─────────────────────────────────────────────────────────
const DOM = {};

function initDOMCache() {
  DOM.tabelaRegistrosTbody    = document.querySelector("#tabelaRegistros tbody");
  DOM.pageInfo                = document.getElementById("pageInfo");
  DOM.tabelaClientesTbody     = document.querySelector("#tabelaClientes tbody");
  DOM.pageInfoClientes        = document.getElementById("pageInfoClientes");
  DOM.clientesCount           = document.getElementById("clientesCount");
  DOM.tabelaRepresentadasTbody= document.querySelector("#tabelaRepresentadas tbody");
  DOM.pageInfoRepresentadas   = document.getElementById("pageInfoRepresentadas");
  DOM.tabelaProjetosTbody     = document.querySelector("#tabelaProjetos tbody");
  DOM.pageInfoProjetos        = document.getElementById("pageInfoProjetos");
  DOM.projetosCount           = document.getElementById("projetosCount");
  DOM.tbodyLixeira            = document.getElementById("tbodyLixeira");
  DOM.pageInfoLixeira         = document.getElementById("pageInfoLixeira");
  DOM.btnPrevLixeira          = document.getElementById("btnPrevLixeira");
  DOM.btnNextLixeira          = document.getElementById("btnNextLixeira");
}

// ─────────────────────────────────────────────────────────

let currentUserName = null;

function getCurrentUserName() {
  return currentUserName || "Desconhecido";
}

const ADMIN_EMAILS = [
  "fabricio.giacomelli@threear.com.br",
  "ronaldo.giacomelli@threear.com.br",
];

function isAdminEmail(email) {
  const emailNormalizado = String(email || "")
    .trim()
    .toLowerCase();
  return ADMIN_EMAILS.includes(emailNormalizado);
}

function isAdmin() {
  return usuarioEhAdmin() || isAdminEmail(window.auth?.currentUser?.email || "");
}

function getUserEmailAtual() {
  return window.auth?.currentUser?.email || "";
}

function getUserNomeAtual() {
  return (
    getCurrentUserName() ||
    window.auth?.currentUser?.displayName ||
    getUserEmailAtual() ||
    "Usuário"
  );
}

function normalizarDataFirestore(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === "function") return valor.toDate();
  if (valor instanceof Date) return valor;
  return null;
}

function formatarDataHoraBR(data) {
  if (!data) return "-";
  return data.toLocaleString("pt-BR");
}

function diasDesdeData(data) {
  if (!data) return 0;
  const diff = Date.now() - data.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

const RESPONSAVEIS_FIXOS = [
  "Anderson",
  "Araújo",
  "Assis",
  "Cassia",
  "Dennis",
  "Fabricio",
  "João",
  "Junior",
  "Leandro",
  "Pedro",
  "Renan",
  "Ricardo",
  "Ronaldo",
  "Silvia",
].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

const OFERTA_SCHEMA_RESUMIDO = [
  { key: "bu", label: "B.U" },
  { key: "razao", label: "Razão Social" },
  { key: "cnpj_cliente", label: "CNPJ" },
  { key: "nome_projeto", label: "Projeto" },
  { key: "representadaNome", label: "Representada" },
  { key: "tipo_oferta", label: "Tipo" },
  { key: "status", label: "Status" },
  { key: "motivo_perda", label: "Motivo da Perda" },
  { key: "valor_total", label: "Valor Total" },
  { key: "data_entrada", label: "Data Entrada", type: "date" },
  { key: "data_envio", label: "Data Envio", type: "date" },
  { key: "possuiPedido", label: "Pedido?", type: "yesno" },
  { key: "possuiRevisao", label: "Revisão?", type: "yesno" },
  { key: "atualizadoPor", label: "Usuário" },
];

window.STATUS_OPTIONS = [
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

window.SEGMENTO_OPTIONS = [
  "Aeroportos",
  "BESS",
  "Construção Civil",
  "Data Center",
  "Engenharia",
  "EPCista",
  "Eólico",
  "Floating",
  "Hidrogênio",
  "Hospitais",
  "Industrial",
  "Infraestrutura",
  "Instalador",
  "Linha de Transmissão",
  "Mineração e Siderurgia",
  "OGP (Óleo, Gás e Petroquímica)",
  "Papel & Celulose",
  "Portos",
  "Revendas e Distribuidores",
  "RMT (Rede de Média Tensão)",
  "Rodovias",
  "Saneamento",
  "Solar",
  "Subestações",
  "Transporte",
  "UHE, UTE e PCH",
];

window.TIPO_PROJETO_OPTIONS = [
  "Aeroportos",
  "BESS",
  "Construção Civil",
  "Data Center",
  "Engenharia",
  "EPCista",
  "Eólico",
  "Floating",
  "Hidrogênio",
  "Hospitais",
  "Industrial",
  "Infraestrutura",
  "Instalador",
  "Linha de Transmissão",
  "Mineração e Siderurgia",
  "OGP (Óleo, Gás e Petroquímica)",
  "Papel & Celulose",
  "Portos",
  "Revendas e Distribuidores",
  "RMT (Rede de Média Tensão)",
  "Rodovias",
  "Saneamento",
  "Solar",
  "Subestações",
  "Transporte",
  "UHE, UTE e PCH",
];

window.STATUS_PROJETO_OPTIONS = [
  "Anúncio Oficial",
  "Em andamento",
  "Em avaliação",
  "Em Licitação",
  "Processos em Andamento",
];

window.usuarioLogadoCRM = null;
window.permissoesCRM = null;

let projetos = [];
let projetoContatosTemp = [];
let projetoAtualizacoesTemp = [];
let editProjetoId = null;
let editContatoProjetoIndex = null;
let editAtualizacaoProjetoIndex = null;
let ordemProjetos = "asc";
let projetosCurrentPage = 1;
let projetosPageSize = 5;
let historicoAtualModal = [];

function abrirHistoricoAtual(titulo) {
  abrirModalHistorico(titulo, historicoAtualModal || []);
}

let ordemRegistros = "asc";
let ordemClientes = "asc";
let ordemRepresentadas = "asc";
let clienteContatoAtualId = null;
let registros = [];
let clientes = [];
let usuarios = [];
let representadas = [];
let contatosTemp = [];
let editId = null;
let editClienteId = null;
let editRepresentadaId = null;
let editContatoIndex = null;
let currentPage = 1;
let pageSize = 5;
let clientesSearchPageSize = 5;
let representadasCurrentPage = 1;
let representadasPageSize = 5;
let clientesCurrentPage = 1;
let clientesPageSize = 5;
let backupImportMode = null;
let itensLixeira = [];
let itensLixeiraFiltrados = [];
let paginaLixeiraAtual = 1;
let ITENS_POR_PAGINA_LIXEIRA = 5;

async function abrirLixeira() {
  await carregarLixeira();

  const btn = document.getElementById("btnLimparLixeira");
  if (btn) {
    btn.style.display = isAdmin() ? "inline-block" : "none";
  }

  const input = document.getElementById("pageSizeLixeira");
  if (input) {
    input.value = ITENS_POR_PAGINA_LIXEIRA;
  }
}

async function carregarLixeira() {
  itensLixeira = await buscarItensLixeira();
  aplicarFiltrosLixeira();
}

async function carregarPermissoesUsuarioLogado() {
  const authUser = window.auth?.currentUser;

  if (!authUser?.uid) {
    console.warn("Usuário não autenticado.");
    return null;
  }

  const emailFallback = String(authUser.email || "").toLowerCase();

  try {
    // Documentos de usuário usam UID como chave — NÃO use email aqui
    const doc = await window.db.collection("usuarios").doc(authUser.uid).get();

    const dados = doc.exists ? (doc.data() || {}) : {};

    const permissoes = {
      uid: authUser.uid,
      email: String(dados.email || authUser.email || "").toLowerCase(),
      nome: dados.nome || authUser.displayName || authUser.email || "Usuário",
      role: dados.role || (isAdminEmail(authUser.email) ? "admin" : "user"),
      podeVerDe: Array.isArray(dados.podeVerDe)
        ? dados.podeVerDe.map((e) => String(e).toLowerCase())
        : [emailFallback],
      representadasPermitidas: Array.isArray(dados.representadasPermitidas)
        ? dados.representadasPermitidas
        : null,
      alertasDeUsuarios: Array.isArray(dados.alertasDeUsuarios)
        ? dados.alertasDeUsuarios
        : null,
      ativo: dados.ativo !== false,
    };

    if (!doc.exists) {
      console.warn("Usuário sem cadastro na coleção usuarios:", authUser.uid);
    }

    window.usuarioLogadoCRM = permissoes;
    window.permissoesCRM = permissoes;
    return permissoes;
  } catch (error) {
    console.error("Erro ao carregar permissões:", error);
    return null;
  }
}

function getApiBase() {
  const p = new URLSearchParams(location.search);
  const forced = p.get("api");

  if (forced === "local") return "http://127.0.0.1:3001";
  if (forced === "prod")
    return "https://southamerica-east1-crm-three-ar.cloudfunctions.net/api";

  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    return "http://127.0.0.1:3001";
  }

  return "https://southamerica-east1-crm-three-ar.cloudfunctions.net/api";
}

const API_BASE = getApiBase();
let totpUserEmail = null;
let totpIsActive = false;
let totpOk = false;
let totpFlowLock = false;

window.addEventListener("load", async () => {
  const savedTheme = localStorage.getItem("theme") || "light";
  applyTheme(savedTheme);

  initLogin();
  initTotpUI();

  initForm();
  initNotasFiscaisUI();

  document
    .getElementById("btnCancelarEdicao")
    ?.addEventListener("click", cancelarEdicao);
  document
    .getElementById("btnCancelarCliente")
    ?.addEventListener("click", cancelarEdicaoCliente);
  document
    .getElementById("btnCancelarRepresentada")
    ?.addEventListener("click", cancelarEdicaoRepresentada);

  document.getElementById("btnDashboard")?.addEventListener("click", () => {
    window.location.href = "dashboard.html";
  });

  initFiltrosEPaginacao();
  initMoneyMask();
  initPhoneMask();
  initCnpjMask();
  initValidacaoVisualCampos();
  initClientesUI();
  initProjetosUI();
  initRepresentadasUI();
  initLigacaoClienteOferta();
  initAutoCompleteProjetoOferta();
  initBackupUI();
  initBuSegmento();
  initUnidadesMantex();

  initAuthTabs();
  initForgotPassword();
  initSignup();
  initResendEmailVerification();

  initAprovacaoUsuariosUI();
  initUsuariosExistentesUI();
  initTecladoAtalhos();

  await esperarFirebase();


  auth.onAuthStateChanged(async (user) => {
    try {
      if (!user) {
        totpOk = false;
        totpIsActive = false;
        totpUserEmail = null;
        sessionStorage.removeItem("totpVerified");
        fecharModalTOTP(true);
        mostrarLogin();
        return;
      }

      currentUserName = user.displayName || user.email || "Desconhecido";

      const userRef = db.collection("usuarios").doc(user.uid);
      const snap = await userRef.get();

      if (!snap.exists) {
        await userRef.set(
          {
            uid: user.uid,
            email: (user.email || "").toLowerCase(),
            nome:
              user.displayName ||
              (user.email ? user.email.split("@")[0] : "Usuário"),
            aprovado: false,
            ativo: true,
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
          },
          { merge: true },
        );
      } else {
        const data = snap.data() || {};
        await userRef.set(
          {
            uid: user.uid,
            email: (user.email || "").toLowerCase(),
            nome:
              user.displayName ||
              (user.email ? user.email.split("@")[0] : data.nome || "Usuário"),
            atualizadoEm: new Date().toISOString(),
          },
          { merge: true },
        );
      }

      await user.reload();
      if (!user.emailVerified) {
        await auth.signOut();
        showToast("Verifique seu e-mail antes de acessar.", "info");
        mostrarLogin();
        return;
      }

      const snap2 = await userRef.get();
      const udata = snap2.data() || {};
      const aprovado = !!udata.aprovado;
      const ativo = udata.ativo === undefined ? true : !!udata.ativo;

      if (!aprovado || !ativo) {
        showToast("Usuário ainda não autorizado.", "error");
        await auth.signOut();
        mostrarLogin();
        return;
      }

      function mostrarTelaBloqueada() {
        document.getElementById("appContainer")?.classList.add("hidden");
        document.getElementById("loginContainer")?.classList.add("hidden");
      }

      if (!totpOk) {
        if (sessionStorage.getItem("totpVerified") === "1") {
          totpOk = true;
        } else {
          await iniciarFluxoTOTP(user);
          mostrarTelaBloqueada();
          return;
        }
      }

      await carregarPermissoesUsuarioLogado();
      await carregarDadosDoFirebase();
      atualizarSugestoesCnpj();
      mostrarApp();
    } catch (e) {
      console.error("Erro no onAuthStateChanged:", e);
      showToast("Erro ao inicializar login. Veja o console.", "error");
      mostrarLogin();
    }
  });
});

function esperarFirebase(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      if (window.auth && window.db) {
        clearInterval(t);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(t);
        reject(
          new Error(
            "Firebase não carregou: auth/db indefinidos (ordem dos scripts).",
          ),
        );
      }
    }, 50);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await esperarFirebase();
    await Promise.allSettled([
      verificarBackupAutomatico().then(() => atualizarInfoUltimoBackupAutomatico()),
      limparLixeiraExpirada(),
    ]);
  } catch (error) {
    console.error("Falha nas rotinas de inicialização:", error);
  }
});

async function carregarDadosDoFirebase() {
  const colecoes = [
    { fn: carregarClientesFirebase,      nome: "clientes" },
    { fn: carregarRepresentadasFirebase, nome: "representadas" },
    { fn: carregarRegistrosFirebase,     nome: "ofertas" },
    { fn: carregarUsuariosFirebase,      nome: "usuarios" },
    { fn: carregarProjetosFirebase,      nome: "projetos" },
  ];

  const resultados = await Promise.allSettled(colecoes.map((c) => c.fn()));

  resultados.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`Falha ao carregar "${colecoes[i].nome}":`, r.reason);
    }
  });

  preencherSelectRepresentadas();
  preencherSelectResponsaveisContato();
  preencherSelectResponsaveisProjeto();
  renderTabela();
  renderTabelaClientes();
  renderTabelaRepresentadas();
  renderTabelaProjetos();
  initAutoCompleteCnpjSimples();
  initAutoCompleteProjetoOferta();
}

async function carregarClientesFirebase() {
  const snap = await db.collection("clientes").get();
  clientes = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((c) => !c.deletado);
}

async function carregarUsuariosFirebase() {
  try {
    const snap = await db.collection("usuarios").get();
    usuarios = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((u) => !u.deletado);
  } catch (e) {
    console.error("ERRO ao carregar usuarios:", e);
    usuarios = [];
  }
}

async function carregarRepresentadasFirebase() {
  const snap = await db.collection("representadas").get();
  representadas = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((r) => !r.deletado);
}

async function carregarRegistrosFirebase() {
  try {
    const snap = await db.collection("ofertas").get();
    registros = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((r) => !r.deletado);
    console.log(`[Ofertas] ${registros.length} ofertas carregadas.`);
  } catch (e) {
    console.error("[Ofertas] Falha ao carregar:", e.code, e.message);
    registros = [];
  }
}

async function carregarProjetosFirebase() {
  const snap = await db.collection("projetos").get();
  projetos = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((p) => !p.deletado);
}

function mostrarLogin() {
  const loginContainer = document.getElementById("loginContainer");
  const appContainer = document.getElementById("appContainer");
  if (appContainer) appContainer.classList.add("hidden");
  if (loginContainer) loginContainer.classList.remove("hidden");
}

function mostrarApp() {
  const loginContainer = document.getElementById("loginContainer");
  const appContainer = document.getElementById("appContainer");

  if (loginContainer) loginContainer.classList.add("hidden");
  if (appContainer) appContainer.classList.remove("hidden");

  const userInfo = document.getElementById("userInfo");
  if (userInfo) userInfo.textContent = "Logado como: " + getCurrentUserName();


  preencherSelectRepresentadas();
  initUnidadesMantex();

  preencherSelectPadrao("status", STATUS_OPTIONS, "");
  preencherSelectPadrao("cli_segmento", SEGMENTO_OPTIONS, "");

  document.getElementById("status")?.addEventListener("change", function () {
    const bloco = document.getElementById("blocoMotivoPerda");
    if (!bloco) return;
    if (this.value === "Perdido") {
      bloco.classList.remove("hidden");
    } else {
      bloco.classList.add("hidden");
      const sel = document.getElementById("motivo_perda");
      if (sel) sel.value = "";
    }
  });

  renderTabela();
  renderTabelaClientes();
  renderTabelaRepresentadas();
  initFiltrosEPaginacao();
  preencherSelectPadrao("proj_tipo", TIPO_PROJETO_OPTIONS, "");
  preencherSelectPadrao("proj_status", STATUS_PROJETO_OPTIONS, "");
  renderTabelaProjetos();
  iniciarSistemaAlertas();
  initDOMCache();
  initFiltrosPersistidos();

  const _podeExportar =
    (typeof isAdmin === "function" && isAdmin()) ||
    (typeof usuarioEhSupervisor === "function" && usuarioEhSupervisor());
  const _btnExp = document.getElementById("btnBackupExport");
  if (_btnExp) _btnExp.style.display = _podeExportar ? "" : "none";

  // Sincroniza permissões do usuarios.js → Firestore silenciosamente quando admin ou supervisor faz login
  if (
    typeof sincronizarUsuariosCRM === "function" &&
    (
      (typeof isAdmin === "function" && isAdmin()) ||
      (typeof usuarioEhSupervisor === "function" && usuarioEhSupervisor())
    )
  ) {
    sincronizarUsuariosCRM().catch(console.error);
  }

  // Drill-down vindo do dashboard
  try {
    const _drill = sessionStorage.getItem("crmDrillFilter");
    if (_drill) {
      sessionStorage.removeItem("crmDrillFilter");
      const _p = JSON.parse(_drill);
      const _sfEl = document.getElementById("statusFilter");
      const _pfEl = document.getElementById("pedidoFilter");
      const _stEl = document.getElementById("searchTerm");
      const grupoMap = {
        "Perdidas":   { statusFilter: "perd" },
        "Canceladas": { statusFilter: "cancelad" },
        "Aguardando": { statusFilter: "aguard" },
        "Ativas":     { statusFilter: "" },
        "Ganhas":     { pedidoFilter: "com" },
      };
      if (_p.statusGrupo && grupoMap[_p.statusGrupo]) {
        const m = grupoMap[_p.statusGrupo];
        if (_sfEl && m.statusFilter !== undefined) _sfEl.value = m.statusFilter;
        if (_pfEl && m.pedidoFilter) _pfEl.value = m.pedidoFilter;
      } else {
        if (_p.status && _sfEl) _sfEl.value = _p.status;
        if (_p.searchTerm && _stEl) _stEl.value = _p.searchTerm;
      }
      renderTabela();
    }
  } catch (_e) {}
}

function logout() {
  window.limparSistemaAlertas?.();
  window.alertasCache = [];
  auth.signOut().catch((err) => {
    console.error(err);
    showToast("Erro ao sair: " + err.message, "error");
  });
}

function initLogin() {
  const btnLogin = document.getElementById("btnLogin");
  if (!btnLogin) return;

  btnLogin.addEventListener("click", async () => {
    const uEl = document.getElementById("loginUser");
    const pEl = document.getElementById("loginPass");
    const email = (uEl?.value || "").trim().toLowerCase();
    const pass = (pEl?.value || "").trim();

    setLoginMsg("");

    if (!email || !pass) {
      showToast("Preencha e-mail e senha.", "error");
      return;
    }

    if (!senhaForteLogin(pass)) {
      showToast(msgSenhaForteLogin(), "error");

      try {
        setLoginMsg("Senha fraca. Enviando e-mail para troca de senha...");
        await auth.sendPasswordResetEmail(email);
        setLoginMsg("✅ Enviamos um e-mail para você trocar a senha.");
        showToast("Enviamos um e-mail para trocar a senha.", "success");
      } catch (e) {
        console.error(e);
        setLoginMsg(
          "❌ Não consegui enviar o e-mail de troca. Verifique o e-mail digitado.",
        );
      }

      pEl?.focus();
      return;
    }

    try {
      btnLogin.disabled = true;
      btnLogin.textContent = "Entrando...";

      await auth.signInWithEmailAndPassword(email, pass);

    } catch (err) {
      console.error(err);

      const msg =
        err?.code === "auth/user-not-found"
          ? "Usuário não encontrado."
          : err?.code === "auth/wrong-password"
            ? "Senha incorreta."
            : err?.code === "auth/invalid-email"
              ? "Email inválido."
              : "Erro ao fazer login: " + (err?.message || err);

      showToast(msg, "error");
    } finally {
      btnLogin.disabled = false;
      btnLogin.textContent = "Entrar";
    }
  });
}

function initTotpUI() {
  const btn = document.getElementById("btnTotpConfirm");
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = "1";
    btn.addEventListener("click", confirmarTotpNoModal);
  }
}

function abrirModalTOTP() {
  const m = document.getElementById("modalTOTP");
  if (!m) return;

  m.classList.remove("hidden");

  const st = document.getElementById("totp_status");
  const code = document.getElementById("totp_code");
  const img = document.getElementById("imgQrTotp");
  const msg = document.getElementById("totp_qr_msg");

  if (st) st.textContent = "";
  if (code) code.value = "";

  if (img) {
    img.src = "";
    img.style.display = "none";
  }
  if (msg) msg.textContent = "Carregando QR Code...";

  code?.focus();
}

function fecharModalTOTP(forceClose = false) {
  const m = document.getElementById("modalTOTP");
  if (!m) return;

  if (!forceClose && !totpOk) {
    showToast("Para acessar o sistema, confirme o código do Google Authenticator.", "info");
    return;
  }

  m.classList.add("hidden");
}

function setTotpStatus(msg) {
  const el = document.getElementById("totp_status");
  if (el) el.textContent = msg || "";
}

async function apiGetQr(userEmail) {
  const r = await fetch(
    `${API_BASE}/mfa/qr?user=${encodeURIComponent(userEmail)}`,
  );
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok)
    throw new Error(j.error || j.message || "Falha ao gerar QR");
  return j;
}

async function apiActivate(userEmail, token) {
  const r = await fetch(`${API_BASE}/mfa/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: userEmail, token }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok)
    throw new Error(j.error || j.message || "Falha ao ativar");
  return j;
}

async function apiVerify(userEmail, token) {
  const r = await fetch(`${API_BASE}/mfa/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: userEmail, token }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok)
    throw new Error(j.error || j.message || "Falha ao validar");
  return j;
}

async function apiResetMfa(targetEmail) {
  const adminToken = await auth.currentUser.getIdToken();
  const r = await fetch(`${API_BASE}/mfa/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: targetEmail, adminToken }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok)
    throw new Error(j.error || j.message || "Falha ao resetar 2FA");
  return j;
}

async function resetarMfaUsuario(email) {
  if (!isAdmin()) {
    showToast("Apenas administradores podem resetar o 2FA.", "error");
    return;
  }

  const ok = await showConfirm(
    `Isso vai apagar o código 2FA de ${email}.\nNa próxima vez que ele fizer login, precisará escanear um novo QR code.`,
    { title: "Resetar 2FA", confirmText: "Resetar", danger: true }
  );
  if (!ok) return;

  try {
    await apiResetMfa(email);
    showToast({ title: "2FA resetado", description: `${email} precisará escanear o QR na próxima vez.` }, "success");
  } catch (e) {
    showToast({ title: "Erro ao resetar 2FA", description: e.message }, "error");
  }
}

async function iniciarFluxoTOTP(user) {
  if (!user) return false;
  if (totpOk) return true;
  if (totpFlowLock) return false;

  totpFlowLock = true;

  try {
    totpUserEmail = (user.email || "").trim().toLowerCase();
    if (!totpUserEmail) throw new Error("Usuário sem email.");

    abrirModalTOTP();
    setTotpStatus("Gerando QR...");

    const qr = await apiGetQr(totpUserEmail);

    totpIsActive = !!qr.alreadyActive;

    const img = document.getElementById("imgQrTotp");
    const msg = document.getElementById("totp_qr_msg");

    if (totpIsActive) {
      if (img) img.style.display = "none";
      if (msg)
        msg.textContent =
          "Usuário já tem 2FA ativo. Digite o código do Google Authenticator.";
    } else {
      if (img) {
        img.src = qr.qrDataUrl;
        img.style.display = "block";
      }
      if (msg)
        msg.textContent =
          "Escaneie o QR no Google Authenticator e digite o código.";
    }

    setTotpStatus("");
    document.getElementById("totp_code")?.focus();
    return false;
  } catch (e) {
    console.error("iniciarFluxoTOTP erro:", e);

    setTotpStatus(
      "❌ Erro no 2FA: " +
      (e?.message || e) +
      " (verifique se o backend está ligado)",
    );

    const msg = document.getElementById("totp_qr_msg");
    if (msg)
      msg.textContent =
        "Backend do 2FA não respondeu. Ligue o servidor e clique em 'Tentar novamente'.";

    let btnRetry = document.getElementById("btnTotpRetry");
    if (!btnRetry) {
      btnRetry = document.createElement("button");
      btnRetry.id = "btnTotpRetry";
      btnRetry.type = "button";
      btnRetry.className = "btn-sm";
      btnRetry.textContent = "Tentar novamente";
      btnRetry.style.marginTop = "10px";
      btnRetry.onclick = async () => iniciarFluxoTOTP(user);
      document
        .getElementById("modalTOTP")
        ?.querySelector(".modal-body")
        ?.appendChild(btnRetry);
    }

    return false;
  } finally {
    totpFlowLock = false;
  }
}

async function confirmarTotpNoModal() {
  const btn = document.getElementById("btnTotpConfirm");
  const token = String(
    document.getElementById("totp_code")?.value || "",
  ).trim();
  const clean = token.replace(/\D/g, "");

  if (clean.length !== 6) {
    setTotpStatus("Digite o código de 6 dígitos.");
    return;
  }

  try {
    if (btn) btn.disabled = true;
    setTotpStatus("Validando...");

    if (totpIsActive) {
      await apiVerify(totpUserEmail, clean);
      totpOk = true;
      sessionStorage.setItem("totpVerified", "1");
      setTotpStatus("Código OK ✅ Entrando...");
    } else {
      await apiActivate(totpUserEmail, clean);
      totpIsActive = true;
      totpOk = true;
      sessionStorage.setItem("totpVerified", "1");
      setTotpStatus("2FA ativado ✅ Entrando...");
    }

    setTimeout(async () => {
      fecharModalTOTP(true);

      await carregarPermissoesUsuarioLogado();
      await carregarDadosDoFirebase();
      atualizarSugestoesCnpj();
      mostrarApp();
    }, 250);
  } catch (e) {
    console.error("confirmarTotpNoModal erro:", e);
    setTotpStatus(
      "Código inválido/expirado. Verifique o relógio do PC/celular e tente novamente.",
    );
  } finally {
    if (btn) btn.disabled = false;
  }
}

function abrirModal(titulo, html, editFn = null) {
  const modal = document.getElementById("modalDetalhes");
  const tituloEl = document.getElementById("modalTitulo");
  const corpoEl = document.getElementById("modalCorpo");
  if (!modal || !tituloEl || !corpoEl) return;
  tituloEl.textContent = titulo;
  corpoEl.innerHTML = html;
  modal.classList.remove("hidden");

  const btnEditar = document.getElementById("modalDetalhesEditar");
  if (btnEditar) {
    if (editFn) {
      window.modalDetalhesEditarFn = editFn;
      btnEditar.classList.remove("hidden");
    } else {
      window.modalDetalhesEditarFn = null;
      btnEditar.classList.add("hidden");
    }
  }
}

function fecharModalDetalhes() {
  const modal = document.getElementById("modalDetalhes");
  if (modal) modal.classList.add("hidden");
  if (window._voltarParaAlertas) {
    window._voltarParaAlertas = false;
    if (typeof abrirModalAlertas === "function") abrirModalAlertas();
  }
}

function applyTheme(theme) {
  const body = document.body;
  const label = document.getElementById("themeLabel");

  if (theme === "dark") {
    body.classList.add("dark");
    if (label) label.textContent = "Modo claro";
  } else {
    body.classList.remove("dark");
    if (label) label.textContent = "Modo escuro";
  }
}

function toggleTheme() {
  const isDark = document.body.classList.contains("dark");
  const newTheme = isDark ? "light" : "dark";
  localStorage.setItem("theme", newTheme);
  applyTheme(newTheme);
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  if (window.innerWidth <= 780) {
    const isOpen = sidebar.classList.toggle("open");
    const overlay = document.getElementById("sidebarOverlay");
    if (overlay) overlay.classList.toggle("hidden", !isOpen);
  } else {
    sidebar.classList.toggle("collapsed");
  }
}

function fecharSidebarMobile() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  if (sidebar) sidebar.classList.remove("open");
  if (overlay) overlay.classList.add("hidden");
}

function initMoneyMask() {
  document.querySelectorAll(".money").forEach((input) => {
    input.addEventListener("input", formatMoney);
  });
}
function formatMoney(e) {
  let value = e.target.value.replace(/\D/g, "");
  if (!value) {
    e.target.value = "";
    return;
  }
  value = (parseInt(value, 10) / 100).toFixed(2) + "";
  value = value.replace(".", ",");
  value = value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  e.target.value = "R$ " + value;
}

function initPhoneMask() {
  const camposTelefone = [
    document.getElementById("telefone"),
    document.getElementById("ct_tel"),
    document.getElementById("proj_ct_tel"),
  ].filter(Boolean);

  camposTelefone.forEach((campo) => {
    if (campo.dataset.phoneBound === "1") return;
    campo.dataset.phoneBound = "1";

    campo.addEventListener("input", onPhoneInput);
    campo.addEventListener("paste", onPhonePaste);

    if (campo.id === "proj_ct_tel") {
      campo.addEventListener("input", validarTelefoneProjetoVisual);
      campo.addEventListener("blur", validarTelefoneProjetoVisual);
    }
  });
}

function onPhoneInput(e) {
  let value = e.target.value.replace(/\D/g, "");
  if (value.length > 11) value = value.slice(0, 11);

  if (value.length <= 10) {
    value = value.replace(/^(\d{2})(\d{0,4})(\d{0,4}).*/, (m, a, b, c) => {
      if (!b) return `(${a}`;
      if (!c) return `(${a}) ${b}`;
      return `(${a}) ${b}-${c}`;
    });
  } else {
    value = value.replace(/^(\d{2})(\d{0,5})(\d{0,4}).*/, (m, a, b, c) => {
      if (!b) return `(${a}`;
      if (!c) return `(${a}) ${b}`;
      return `(${a}) ${b}-${c}`;
    });
  }

  e.target.value = value;
}

function onPhonePaste(e) {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData("text");
  const digits = text.replace(/\D/g, "");
  e.target.value = digits;
  onPhoneInput(e);
}

function initCnpjMask() {
  const campos = [
    document.getElementById("cli_cnpj"),
    document.getElementById("cnpj_cliente"),
  ].filter(Boolean);

  campos.forEach((input) => {
    if (input.dataset.cnpjBound === "1") return;
    input.dataset.cnpjBound = "1";

    input.addEventListener("input", onCnpjInput);
    input.addEventListener("paste", onCnpjPaste);
    input.addEventListener("blur", onCnpjBlur);
  });
}

function formatCnpjValue(value) {
  value = value.replace(/\D/g, "");
  value = value.slice(0, 14);

  if (value.length >= 3) value = value.replace(/^(\d{2})(\d)/, "$1.$2");
  if (value.length >= 7)
    value = value.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
  if (value.length >= 11)
    value = value.replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4");
  if (value.length >= 15)
    value = value.replace(
      /^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/,
      "$1.$2.$3/$4-$5",
    );

  return value;
}

function onCnpjPaste(e) {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData("text");
  e.target.value = formatCnpjValue(text);
}

let cnpjBlurLock = false;

function onCnpjBlur(e) {
  const input = e.target;

  if (input.dataset.skipBlurValidation === "1") {
    input.dataset.skipBlurValidation = "0";
    return;
  }

  const digits = (input.value || "").replace(/\D/g, "");

  if (input.dataset.invalidAlertShown === "1") return;

  if (digits && digits.length !== 14) {
    input.dataset.invalidAlertShown = "1";

    setTimeout(() => {
      showToast("CNPJ inválido. Deve conter 14 dígitos.", "error");
      setTimeout(() => input.focus(), 50);
    }, 50);
  }
}

function onCnpjInput(e) {
  e.target.dataset.invalidAlertShown = "0";
  e.target.value = formatCnpjValue(e.target.value);
}

function initTecladoAtalhos() {
  // ── Enter nos campos de login ────────────────────────────────
  ["loginUser", "loginPass"].forEach((id) => {
    document.getElementById(id)?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); document.getElementById("btnLogin")?.click(); }
    });
  });

  // ── Enter no código TOTP ─────────────────────────────────────
  document.getElementById("totp_code")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); document.getElementById("btnTotpConfirm")?.click(); }
  });

  // ── ESC global — fecha o modal mais superficial visível ──────
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    // Não interfere quando showConfirm estiver ativo (ele trata o próprio ESC)
    if (window._confirmAtivo) return;

    // Actions menu flutuante
    if (actionsMenuState?.open) { closeActionsMenu(); return; }

    // TOTP — ESC cancela o login
    const totp = document.getElementById("modalTOTP");
    if (totp && !totp.classList.contains("hidden")) {
      logout();
      return;
    }

    // Modal de importação
    const importacao = document.getElementById("modalImportacao");
    if (importacao && !importacao.classList.contains("hidden")) {
      importacao.classList.add("hidden");
      return;
    }

    // Modal de alertas
    const alertas = document.getElementById("modalAlertas");
    if (alertas && !alertas.classList.contains("hidden")) {
      if (typeof fecharModalAlertas === "function") fecharModalAlertas();
      return;
    }

    // Modal de detalhes / ver ofertas
    const detalhes = document.getElementById("modalDetalhes");
    if (detalhes && !detalhes.classList.contains("hidden")) {
      if (typeof fecharModalDetalhes === "function") fecharModalDetalhes();
      return;
    }

    // Modal de histórico
    const historico = document.getElementById("modalHistorico");
    if (historico && historico.classList.contains("show")) {
      if (typeof fecharModalHistorico === "function") fecharModalHistorico();
      return;
    }
  });
}

function initForm() {
  const radiosPedido = document.querySelectorAll("input[name='pedido']");
  radiosPedido.forEach((radio) => {
    radio.addEventListener("change", () => {
      document
        .getElementById("secaoPedido")
        .classList.toggle("hidden", radio.value !== "sim");
    });
  });

  const radiosRevisao = document.querySelectorAll("input[name='revisao']");
  radiosRevisao.forEach((radio) => {
    radio.addEventListener("change", () => {
      document
        .getElementById("secaoRevisao")
        .classList.toggle("hidden", radio.value !== "sim");
    });
  });

  const btnAdicionar = document.getElementById("btnAdicionar");
  if (!btnAdicionar) return;

  const mapaCamposOferta = {
    bu: "B.U",
    segmento: "segmento",
    razao: "razão social",
    cnpj_cliente: "CNPJ",
    solicitante: "solicitante",
    telefone: "telefone",
    email: "e-mail",
    oferta: "nº da oferta",
    nome_projeto: "projeto",
    representadaNome: "representada",
    unidade: "unidade",
    valor_total: "valor total",
    ref_cliente: "ref. cliente",
    data_entrada: "data entrada",
    status: "status",
    data_envio: "data envio",
    tipo_oferta: "tipo",
    atendimentoSpot: "atendimento spot",
    possuiPedido: "possui pedido",
    possuiRevisao: "possui revisão",
    obs_geral: "observações gerais",
  };

  const mapaCamposPedido = {
    "pedido.numero_pedido": "nº pedido",
    "pedido.data_po": "data P.O.",
    "pedido.valor_pedido": "valor pedido",
    "pedido.cond_pagamento": "condição de pagamento",
    "pedido.ref_projeto": "ref./projeto do pedido",
    "pedido.tipo_produto": "tipo de produto",
    "pedido.obs": "obs do pedido",
    "pedido.data_nf": "data NF",
    "pedido.numero_nf": "número NF",
    "pedido.valor_nf": "valor NF",
    "pedido.prazo_entrega_contratual": "prazo entrega contratual",
    "pedido.solicitacao_oc": "SOV",
    "pedido.ref_oc": "ref. OV",
    "pedido.data_implantacao": "data de implantação",
  };

  const mapaCamposRevisao = {
    "revisao.numero_oferta_anterior": "nº oferta anterior",
    "revisao.mudou": "o que mudou na revisão",
  };

  btnAdicionar.addEventListener("click", async () => {
    const bu = document.getElementById("bu");
    const razao = document.getElementById("razao");
    const cnpj_cliente = document.getElementById("cnpj_cliente");
    const solicitante = document.getElementById("solicitante");
    const telefone = document.getElementById("telefone");
    const email = document.getElementById("email");
    const oferta = document.getElementById("oferta");
    const nome_projeto = document.getElementById("nome_projeto");
    const representadaSelect = document.getElementById("representada");
    const unidadeEl = document.getElementById("unidade");
    const unidade = unidadeEl?.value || "";
    const valor_total = document.getElementById("valor_total");
    const ref_cliente = document.getElementById("ref_cliente");
    const oportunidade = document.getElementById("oportunidade");
    const data_entrada = document.getElementById("data_entrada");
    const status = document.getElementById("status");
    const data_envio = document.getElementById("data_envio");
    const obsGeral = document.getElementById("obs_geral");
    const tipoNegocio = document.getElementById("tipo_oferta");
    const segmentoEl = document.getElementById("segmento");

    const atendimentoSpot =
      document.querySelector("input[name='spot']:checked")?.value || "nao";
    const possuiPedido =
      document.querySelector("input[name='pedido']:checked")?.value || "nao";
    const possuiRevisao =
      document.querySelector("input[name='revisao']:checked")?.value || "nao";

    const currentUser = getCurrentUserName();

    const nowIso = new Date().toISOString();

    const segmentoVisivel = segmentoEl && segmentoEl.offsetParent !== null;

    const motivoPerdaEl = document.getElementById("motivo_perda");
    const valido = validarCamposObrigatorios([
      { el: bu, nome: "B.U" },
      { el: segmentoEl, nome: "Segmento", condicao: segmentoVisivel },
      { el: razao, nome: "Razão Social" },
      { el: solicitante, nome: "Solicitante" },
      { el: telefone, nome: "Telefone" },
      { el: email, nome: "E-mail" },
      { el: representadaSelect, nome: "Representada" },
      { el: valor_total, nome: "Valor Total" },
      { el: data_entrada, nome: "Data Entrada" },
      { el: status, nome: "Status" },
      { el: tipoNegocio, nome: "Tipo" },
      { el: motivoPerdaEl, nome: "Motivo da Perda", condicao: status.value === "Perdido" },
    ]);

    if (!valido) return;

    if (cnpj_cliente.value && !validarCNPJ(cnpj_cliente.value)) {
      marcarErroCampo(cnpj_cliente);
      showToast("CNPJ inválido. Verifique os números informados.", "error");
      cnpj_cliente.focus();
      return;
    }

    const telDigits = (telefone.value || "").replace(/\D/g, "");
    if (telDigits && (telDigits.length < 10 || telDigits.length > 11)) {
      marcarErroCampo(telefone);
      showToast("Telefone inválido. Informe DDD + 8 ou 9 dígitos.", "error");
      telefone.focus();
      return;
    }
    const registroBase = {
      bu: bu.value,
      segmento: segmentoEl ? segmentoEl.value || "" : "",
      razao: razao.value,
      cnpj_cliente: cnpj_cliente.value,
      clienteId: cnpj_cliente.dataset.clienteId || null,
      solicitante: solicitante.value,
      telefone: telefone.value,
      email: email.value,
      oferta: oferta.value,
      nome_projeto: nome_projeto.value,
      projetoId: nome_projeto.dataset.projetoId || null,
      representadaId: representadaSelect.value || null,
      representadaNome:
        representadaSelect.options[representadaSelect.selectedIndex]?.text ||
        "",
      unidade: unidade,
      valor_total: valor_total.value,
      ref_cliente: ref_cliente?.value?.trim() || "",
      data_entrada: data_entrada.value,
      status: status.value,
      motivo_perda: status.value === "Perdido"
        ? (document.getElementById("motivo_perda")?.value || "")
        : "",
      data_envio: data_envio.value,
      responsavelEmail: (window.auth?.currentUser?.email || "").toLowerCase(),
      possuiPedido,
      possuiRevisao,
      atendimentoSpot,
      tipo_oferta: tipoNegocio ? tipoNegocio.value : "",
      obs_geral: obsGeral ? obsGeral.value.trim() : "",
    };

    if (possuiPedido === "sim") {
      const numero_pedido = document.getElementById("numero_pedido");
      const data_po = document.getElementById("data_po");
      const valor_pedido = document.getElementById("valor_pedido");
      const cond_pagamento = document.getElementById("cond_pagamento");
      const ref_projeto = document.getElementById("ref_projeto");
      const tipo_produto = document.getElementById("tipo_produto");
      const obs = document.getElementById("obs");
      const notasFiscais = Array.from(
        document.querySelectorAll("#blocoNotasFiscais .nf-item"),
      )
        .map((item) => {
          const data = item.querySelector(".nf-data")?.value || "";
          const numero = item.querySelector(".nf-numero")?.value?.trim() || "";
          const valor = item.querySelector(".nf-valor")?.value || "";

          return { data, numero, valor };
        })
        .filter((nf) => nf.data || nf.numero || nf.valor);
      const prazo_entrega_contratual = document.getElementById(
        "prazo_entrega_contratual",
      );
      const solicitacao_oc =
        document.querySelector("input[name='sol_oc']:checked")?.value || "nao";
      const ref_oc = document.getElementById("ref_oc");
      const data_implantacao = document.getElementById("data_implantacao");

      const validoPedido = validarCamposObrigatorios([
        { el: valor_pedido, nome: "Valor Total Pedido" },
        { el: cond_pagamento, nome: "Condição de Pagamento" },
        { el: ref_projeto, nome: "Ref./Projeto" },
      ]);

      if (!validoPedido) return;

      registroBase.pedido = {
        numero_pedido: numero_pedido?.value || "",
        data_po: data_po?.value || "",
        valor_pedido: valor_pedido?.value || "",
        cond_pagamento: cond_pagamento?.value || "",
        ref_projeto: ref_projeto?.value || "",
        tipo_produto: tipo_produto?.value || "",
        obs: obs?.value || "",
        data_nf: notasFiscais[0]?.data || "",
        numero_nf: notasFiscais[0]?.numero || "",
        valor_nf: notasFiscais[0]?.valor || "",
        notas_fiscais: notasFiscais,
        prazo_entrega_contratual: prazo_entrega_contratual?.value || "",
        entregue: document.querySelector("input[name='entregue']:checked")?.value || "nao",
        solicitacao_oc,
        ref_oc: ref_oc?.value || "",
        data_implantacao: data_implantacao?.value || "",
      };
    } else {
      registroBase.pedido = null;
    }

    if (possuiRevisao === "sim") {
      const rev_num_oferta = document.getElementById("rev_num_oferta");
      const rev_mudou = document.getElementById("rev_mudou");

      const validoRevisao = validarCamposObrigatorios([
        { el: rev_num_oferta, nome: "Nº da Oferta Anterior" },
        { el: rev_mudou, nome: "O que mudou?" },
      ]);

      if (!validoRevisao) return;

      registroBase.revisao = {
        numero_oferta_anterior: rev_num_oferta.value.trim(),
        mudou: rev_mudou.value.trim(),
      };
    } else {
      registroBase.revisao = null;
    }

    // Detecção de duplicata (CNPJ + N° Oferta)
    const _cnpj   = (registroBase.cnpj_cliente || "").replace(/\D/g, "");
    const _oferta = (registroBase.oferta || "").trim().toLowerCase();
    const _duplicatas = registros.filter((r) => {
      if (r.id === editId || r.deletado) return false;
      const mesmoCnpj   = _cnpj   && (r.cnpj_cliente || "").replace(/\D/g, "") === _cnpj;
      const mesmaOferta = _oferta && (r.oferta || "").trim().toLowerCase() === _oferta;
      return mesmoCnpj && mesmaOferta;
    });
    if (_duplicatas.length) {
      const ref = _duplicatas[0];
      const msg =
        `CNPJ e N° da oferta já existem em outro registro.\n\n` +
        `Oferta: ${ref.oferta || "s/n"}\n` +
        `Cliente: ${ref.razao || "-"}\n` +
        `Status: ${ref.status || "-"}`;
      const acao = await showDuplicataAviso(msg, { title: "Possível duplicata detectada" });
      if (acao === "ver") {
        verOferta(ref.id);
        return;
      }
    }

    if (!editId) {
      const id = gerarId();
      const registro = {
        id,
        ...registroBase,
        criadoPor: currentUser,
        atualizadoPor: currentUser,
        criadoEm: nowIso,
        atualizadoEm: nowIso,
        historico: [
          criarEventoHistorico({
            usuario: currentUser,
            acao: "Criou",
            campo: "registro",
            de: "",
            para: registroBase.oferta || "nova oferta",
          }),
        ],
      };
      await db.collection("ofertas").doc(id).set(registro);
      registros.push(registro);
      showToast("Registro adicionado!", "success");
    } else {
      const idx = registros.findIndex((r) => r.id === editId);
      const antigo = registros[idx] || {};
      const eventosHistoricoBase = montarEventosHistorico(
        antigo,
        registroBase,
        currentUser,
        mapaCamposOferta,
      );

      const eventosHistoricoPedido = montarHistoricoAlteracoesPath(
        antigo,
        registroBase,
        currentUser,
        mapaCamposPedido,
      );

      const eventosHistoricoRevisao = montarHistoricoAlteracoesPath(
        antigo,
        registroBase,
        currentUser,
        mapaCamposRevisao,
      );

      const notasAntigas = resumoNotasFiscaisHistorico(antigo.pedido || {});
      const notasNovas = resumoNotasFiscaisHistorico(registroBase.pedido || {});

      const eventosHistoricoNotasFiscais = [];
      if (notasAntigas !== notasNovas) {
        eventosHistoricoNotasFiscais.push(
          criarEventoHistorico({
            usuario: currentUser,
            acao: "alterou",
            campo: "notas fiscais",
            de: notasAntigas,
            para: notasNovas,
          }),
        );
      }

      const eventosHistorico = [
        ...eventosHistoricoBase,
        ...eventosHistoricoPedido,
        ...eventosHistoricoRevisao,
        ...eventosHistoricoNotasFiscais,
      ];
      if (idx !== -1) {
        const registro = {
          id: editId,
          ...registroBase,
          criadoPor: antigo.criadoPor || currentUser,
          atualizadoPor: currentUser,
          criadoEm: antigo.criadoEm || nowIso,
          atualizadoEm: nowIso,
          historico: [...(antigo.historico || []), ...eventosHistorico],
        };
        await db.collection("ofertas").doc(editId).set(registro);
        registros[idx] = registro;
        // Resolve/solicita aprovação dos alertas de follow-up
        if (typeof onRegistroSalvoReset === "function") {
          onRegistroSalvoReset(editId).catch(console.error);
        }
        showToast("Registro atualizado!", "success");
      }
      editId = null;
      btnAdicionar.textContent = "Adicionar";
      document.getElementById("btnCancelarEdicao")?.classList.add("hidden");
    }

    salvarRegistros();

    document.getElementById("formOferta").reset();
    document.getElementById("nome_projeto").dataset.projetoId = "";
    resetNotasFiscaisUI();
    document.getElementById("secaoPedido").classList.add("hidden");
    document.getElementById("secaoRevisao").classList.add("hidden");

    document.querySelector("input[name='revisao'][value='nao']")?.click();
    document.querySelector("input[name='pedido'][value='nao']")?.click();
    document.querySelector("input[name='sol_oc'][value='nao']")?.click();

    cnpj_cliente.dataset.clienteId = "";
    currentPage = 1;
    renderTabela();
    await verificarAlertasSistema();
  });

  initFiltrosRegistrosUI();

  bindGotoPage(
    "gotoPageRegistros",
    () => Math.max(1, Math.ceil(getRegistrosFiltrados().length / pageSize)),
    (page) => {
      currentPage = page;
      renderTabela();
    },
  );
}

let actionsMenuState = { open: false, type: null, id: null, extra: null };

function ensureActionsMenu() {
  let menu = document.getElementById("actionsMenu");
  if (menu) return menu;

  menu = document.createElement("div");
  menu.id = "actionsMenu";
  menu.innerHTML = `
  <button id="actVer" type="button">Ver</button>
  <button id="actVerContatos" type="button">Ver contatos</button>
  <button id="actVerOfertas" type="button">Ver ofertas</button>
  <button id="actExportar" type="button">Exportar</button>
  <button id="actEditar" type="button">Editar</button>
  <button id="actExcluir" type="button" class="danger">Excluir</button>
  <button id="actAprovar" type="button">Aprovar</button>
  <button id="actBloquear" type="button" class="danger">Bloquear</button>
  <button id="actToggleAtivo" type="button">Ativar</button>
  <button id="actResetMfa" type="button">Resetar 2FA</button>
  <button id="actExcluirFirestore" type="button" class="danger">Excluir (Firestore)</button>
  <button id="actRestaurar" type="button">Restaurar</button>
  <button id="actExcluirDefinitivo" type="button" class="danger">Excluir definitivo</button>
`;
  document.body.appendChild(menu);

  document.addEventListener("click", () => closeActionsMenu());
  window.addEventListener("scroll", () => closeActionsMenu(), true);
  window.addEventListener("resize", () => closeActionsMenu());
  menu.addEventListener("click", (e) => e.stopPropagation());

  return menu;
}

function openActionsMenu(ev, type, id, extra = null) {
  ev.preventDefault();
  ev.stopPropagation();

  const menu = ensureActionsMenu();
  actionsMenuState = { open: true, type, id, extra };

  const btnVer = document.getElementById("actVer");
  const btnVerContatos = document.getElementById("actVerContatos");
  const btnVerOfertas = document.getElementById("actVerOfertas");
  const btnExportar = document.getElementById("actExportar");
  const btnEditar = document.getElementById("actEditar");
  const btnExcluir = document.getElementById("actExcluir");
  const btnAprovar = document.getElementById("actAprovar");
  const btnBloquear = document.getElementById("actBloquear");
  const btnToggleAtivo = document.getElementById("actToggleAtivo");
  const btnExcluirFirestore = document.getElementById("actExcluirFirestore");
  const btnResetMfa = document.getElementById("actResetMfa");
  const btnRestaurar = document.getElementById("actRestaurar");
  const btnExcluirDefinitivo = document.getElementById("actExcluirDefinitivo");

  const isUsuario = type === "usuario_pendente" || type === "usuario_existente";
  const isLixeira = type === "lixeira_item";

  // Botões de lixeira
  if (btnRestaurar) {
    btnRestaurar.style.display = isLixeira ? "block" : "none";
    btnRestaurar.onclick = () => { closeActionsMenu(); restaurarItemLixeira(extra?.colecao, id); };
  }
  if (btnExcluirDefinitivo) {
    btnExcluirDefinitivo.style.display = isLixeira && isAdmin() ? "block" : "none";
    btnExcluirDefinitivo.onclick = () => { closeActionsMenu(); excluirItemDefinitivo(extra?.colecao, id); };
  }

  if (isLixeira) {
    if (btnVer) btnVer.style.display = "none";
    if (btnVerContatos) btnVerContatos.style.display = "none";
    if (btnVerOfertas) btnVerOfertas.style.display = "none";
    if (btnExportar) btnExportar.style.display = "none";
    if (btnEditar) btnEditar.style.display = "none";
    if (btnExcluir) btnExcluir.style.display = "none";
    if (btnAprovar) btnAprovar.style.display = "none";
    if (btnBloquear) btnBloquear.style.display = "none";
    if (btnToggleAtivo) btnToggleAtivo.style.display = "none";
    if (btnExcluirFirestore) btnExcluirFirestore.style.display = "none";
    if (btnResetMfa) btnResetMfa.style.display = "none";

    const r = ev.currentTarget.getBoundingClientRect();
    const margin = 10;
    menu.classList.add("open");
    menu.style.left = "0px";
    menu.style.top = "0px";
    menu.style.transformOrigin = "top center";
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    let left = r.left + r.width / 2 - mw / 2;
    let top = r.bottom + margin;
    if (left < margin) left = margin;
    if (left + mw > window.innerWidth - margin) left = window.innerWidth - mw - margin;
    if (top + mh > window.innerHeight - margin) { top = r.top - mh - margin; menu.setAttribute("data-placement", "top"); }
    else menu.setAttribute("data-placement", "bottom");
    menu.style.left = left + "px";
    menu.style.top = top + "px";
    return;
  }

  // Botões gerais só aparecem fora das seções de usuário e lixeira
  if (btnVer) {
    const showVer = !isUsuario || type === "usuario_existente";
    btnVer.style.display = showVer ? "block" : "none";
  }
  if (btnVerContatos) btnVerContatos.style.display = "none";
  if (btnVerOfertas) btnVerOfertas.style.display = "none";
  if (btnEditar) btnEditar.style.display = isUsuario ? "none" : "block";
  if (btnExcluir) btnExcluir.style.display = isUsuario ? "none" : "block";

  // Botões de usuário pendente
  if (btnAprovar) btnAprovar.style.display = type === "usuario_pendente" ? "block" : "none";
  if (btnBloquear) btnBloquear.style.display = type === "usuario_pendente" ? "block" : "none";

  // Botões de usuário existente
  if (btnToggleAtivo) {
    btnToggleAtivo.style.display = type === "usuario_existente" ? "block" : "none";
    btnToggleAtivo.textContent = extra?.ativo ? "Desativar" : "Ativar";
  }
  if (btnExcluirFirestore) btnExcluirFirestore.style.display = type === "usuario_existente" ? "block" : "none";
  if (btnResetMfa) {
    btnResetMfa.style.display = type === "usuario_existente" && isAdmin() ? "block" : "none";
    btnResetMfa.onclick = () => { closeActionsMenu(); resetarMfaUsuario(extra?.email || ""); };
  }

  if (btnAprovar) {
    btnAprovar.onclick = () => { closeActionsMenu(); aprovarUsuario(id); };
  }
  if (btnBloquear) {
    btnBloquear.onclick = () => { closeActionsMenu(); bloquearUsuario(id); };
  }
  if (btnToggleAtivo) {
    btnToggleAtivo.onclick = () => { closeActionsMenu(); toggleAtivoUsuario(id, !extra?.ativo); };
  }
  if (btnExcluirFirestore) {
    btnExcluirFirestore.onclick = () => { closeActionsMenu(); excluirUsuarioFirestore(id); };
  }

  btnVer.onclick = () => {
    closeActionsMenu();
    if (type === "oferta") verOferta(id);
    if (type === "cliente") verCliente(id);
    if (type === "projeto") verProjeto(id);
    if (type === "rep") verRepresentada(id);
    if (type === "usuario_existente") verUsuario(id);
  };

  if (btnVerContatos) {
    const mostrarContatos = type === "cliente" || type === "projeto";
    btnVerContatos.style.display = mostrarContatos ? "block" : "none";

    btnVerContatos.onclick = () => {
      closeActionsMenu();
      if (type === "cliente") verContatosCliente(id);
      if (type === "projeto") verContatosProjeto(id);
    };
  }

  if (btnVerOfertas) {
    const mostrarOfertas =
      type === "cliente" || type === "projeto" || type === "rep";
    btnVerOfertas.style.display = mostrarOfertas ? "block" : "none";

    btnVerOfertas.onclick = () => {
      closeActionsMenu();
      if (type === "cliente") verOfertasCliente(id);
      if (type === "projeto") verOfertasProjeto(id);
      if (type === "rep") verOfertasRepresentada(id);
    };
  }

  if (btnExportar) {
    btnExportar.style.display = type === "projeto" ? "block" : "none";
    btnExportar.onclick = () => { closeActionsMenu(); exportarProjeto(id); };
  }

  btnEditar.onclick = () => {
    closeActionsMenu();
    if (type === "oferta") editarRegistro(id);
    if (type === "cliente") editarCliente(id);
    if (type === "projeto") editarProjeto(id);
    if (type === "rep") editarRepresentada(id);
  };

  btnExcluir.onclick = () => {
    closeActionsMenu();
    if (type === "oferta") excluirRegistro(id);
    if (type === "cliente") excluirCliente(id);
    if (type === "projeto") excluirProjeto(id);
    if (type === "rep") excluirRepresentada(id);
  };

  const r = ev.currentTarget.getBoundingClientRect();
  const margin = 10;

  menu.classList.add("open");
  menu.style.left = "0px";
  menu.style.top = "0px";
  menu.style.transformOrigin = "top center";

  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;

  let left = r.left + r.width / 2 - mw / 2;
  let top = r.bottom + margin;

  if (left < margin) left = margin;
  if (left + mw > window.innerWidth - margin) {
    left = window.innerWidth - mw - margin;
  }

  let abrirEmCima = false;
  if (top + mh > window.innerHeight - margin) {
    top = r.top - mh - margin;
    abrirEmCima = true;
  }
  if (top < margin) top = margin;

  menu.dataset.placement = abrirEmCima ? "top" : "bottom";

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function closeActionsMenu() {
  const menu = document.getElementById("actionsMenu");
  if (!menu) return;
  menu.classList.remove("open");
  actionsMenuState.open = false;
}

function initFiltrosEPaginacao() {
  // ✅ trava LOGO NO COMEÇO
  if (window.__filtrosEPaginacaoRegistrosBound) return;
  window.__filtrosEPaginacaoRegistrosBound = true;

  const searchTerm = document.getElementById("searchTerm");
  const filterField = document.getElementById("filterField");
  const statusFilter = document.getElementById("statusFilter");
  const pedidoFilter = document.getElementById("pedidoFilter");
  const revisaoFilter = document.getElementById("revisaoFilter");
  const btnVerTudo = document.getElementById("btnVerTudo");
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");
  const btnExportExcel = document.getElementById("btnExportExcel");
  const btnExportPdf = document.getElementById("btnExportPdf");
  const pageSizeInput = document.getElementById("pageSizeInput");

  if (pageSizeInput) {
    const saved = parseInt(localStorage.getItem("pageSize") || "", 10);
    if (!isNaN(saved) && saved > 0) pageSize = saved;

    pageSizeInput.value = String(pageSize);

    const apply = () => {
      const v = parseInt(pageSizeInput.value, 10);
      if (!v || v < 1) return;

      pageSize = Math.min(Math.max(v, 1), 200);
      localStorage.setItem("pageSize", String(pageSize));
      currentPage = 1;
      renderTabela();
    };

    pageSizeInput.addEventListener("change", apply);
    pageSizeInput.addEventListener("blur", apply);
    pageSizeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") apply();
    });
  }

  searchTerm?.addEventListener("input", () => renderTabelaDebounced());
  filterField?.addEventListener("change", () => renderTabelaDebounced());
  statusFilter?.addEventListener("input", () => renderTabelaDebounced());
  pedidoFilter?.addEventListener("change", () => renderTabelaDebounced());
  revisaoFilter?.addEventListener("change", () => renderTabelaDebounced());

  btnVerTudo?.addEventListener("click", () => {
    if (searchTerm) searchTerm.value = "";
    if (statusFilter) statusFilter.value = "";
    if (filterField) filterField.value = "todos";
    if (pedidoFilter) pedidoFilter.value = "todos";
    if (revisaoFilter) revisaoFilter.value = "todos";
    currentPage = 1;
    renderTabela();
  });

  btnPrev?.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderTabela();
    }
  });

  btnNext?.addEventListener("click", () => {
    const totalFiltrados = getRegistrosFiltrados().length;
    const totalPages = Math.max(1, Math.ceil(totalFiltrados / pageSize));
    if (currentPage < totalPages) {
      currentPage++;
      renderTabela();
    }
  });

  btnExportExcel?.addEventListener("click", exportExcel);
  document.getElementById("btnExportPdfResumo")?.addEventListener("click", exportPdfResumo);
  document.getElementById("btnExportPdfCompleto")?.addEventListener("click", exportPdfCompleto);
}

function getTextoRegistroTodosCampos(reg) {
  const textos = [
    reg.bu,
    reg.segmento,
    reg.razao,
    reg.cnpj_cliente,
    reg.nome_projeto,
    reg.representadaNome,
    reg.solicitante,
    reg.telefone,
    reg.email,
    reg.oferta,
    reg.valor_total,
    reg.oportunidade,
    reg.data_entrada,
    reg.status,
    reg.data_envio,
    reg.obs_geral,
    reg.tipo_oferta,
    reg.atendimentoSpot,
  ];

  if (reg.pedido) {
    textos.push(
      reg.pedido.numero_pedido,
      reg.pedido.data_po,
      reg.pedido.valor_pedido,
      reg.pedido.cond_pagamento,
      reg.pedido.ref_projeto,
      reg.pedido.tipo_produto,
      reg.pedido.obs,
      reg.pedido.data_nf,
      reg.pedido.numero_nf,
      reg.pedido.valor_nf,
      reg.pedido.prazo_entrega_contratual,
      reg.pedido.solicitacao_oc,
      reg.pedido.ref_oc,
      reg.pedido.data_implantacao,
    );
  }

  if (reg.revisao) {
    textos.push(reg.revisao.numero_oferta_anterior, reg.revisao.mudou);
  }

  const usuario = formatarNomeUsuario(reg.atualizadoPor || reg.criadoPor || "");
  textos.push(usuario);

  return textos.filter(Boolean).join(" ").toLowerCase();
}

function getValorCampoRegistro(reg, field) {
  switch (field) {
    case "bu":
      return reg.bu || "";
    case "razao":
      return reg.razao || "";
    case "cnpj_cliente":
      return reg.cnpj_cliente || "";
    case "projeto":
      return reg.nome_projeto || "";
    case "representada":
      return reg.representadaNome || "";
    case "tipo_oferta":
      return reg.tipo_oferta || "";
    case "status":
      return reg.status || "";
    case "usuario":
      return formatarNomeUsuario(reg.atualizadoPor || reg.criadoPor || "");
    default:
      return "";
  }
}

function getClientesFiltrados() {
  const base = clientes;

  const filtros = Array.from(
    document.querySelectorAll("#filtersClientes .filter-item"),
  )
    .map((row) => {
      const field = row.querySelector(".multiField")?.value || "todos";
      const term = (row.querySelector(".multiTerm")?.value || "")
        .trim()
        .toLowerCase();
      return { field, term };
    })
    .filter((f) => f.term);

  const filtrosPorCampo = filtros.reduce((acc, f) => {
    if (!acc[f.field]) acc[f.field] = [];
    acc[f.field].push(f.term);
    return acc;
  }, {});

  return base.filter((cli) => {
    const usuario = formatarNomeUsuario(
      cli.atualizadoPor || cli.criadoPor || "",
    ).toLowerCase();

    const textoTodos = [cli.razao, cli.cnpj, cli.sap, cli.segmento, usuario]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    for (const field in filtrosPorCampo) {
      const termos = filtrosPorCampo[field];

      const passouNoGrupo = termos.some((term) => {
        const wantEmpty =
          term === "vazio" || term === "em branco" || term === "sem";

        if (field === "todos") {
          if (wantEmpty) return false;
          return textoTodos.includes(term);
        }

        let value = "";

        if (field === "razao") value = cli.razao || "";
        if (field === "cnpj") value = cli.cnpj || "";
        if (field === "sap") value = cli.sap || "";
        if (field === "segmento") value = cli.segmento || "";
        if (field === "usuario") value = usuario;

        if (wantEmpty) {
          if (field === "cnpj") {
            return normalizeCNPJ(value).length === 0;
          }
          return isEmptyValue(value);
        }

        if (field === "cnpj") {
          return normalizeCNPJ(value).includes(normalizeCNPJ(term));
        }

        return String(value).toLowerCase().includes(term);
      });

      if (!passouNoGrupo) return false;
    }

    return true;
  });
}

function renderTabela() {
  const tbody = DOM.tabelaRegistrosTbody || document.querySelector("#tabelaRegistros tbody");
  const pageInfo = DOM.pageInfo || document.getElementById("pageInfo");
  if (!tbody) return;

  tbody.innerHTML = "";

  const filtrados = getRegistrosFiltrados();
  const listaOrdenada =
    ordemRegistros === "asc" ? [...filtrados] : [...filtrados].reverse();
  const total = listaOrdenada.length;

  const { pageData, totalPages, start, safePage } = getPaginatedData(listaOrdenada, currentPage, pageSize);
  currentPage = safePage;

  if (pageData.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 12;
    td.textContent = "Nenhum registro encontrado.";
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    pageData.forEach((reg, index) => {
      const usuario = formatarNomeUsuario(
        reg.atualizadoPor || reg.criadoPor || "",
      );
      const pedidoIcon = reg.possuiPedido === "sim" ? "✅" : "—";
      const revisaoIcon = reg.possuiRevisao === "sim" ? "✅" : "—";

      const tr = document.createElement("tr");
      tr.innerHTML = `
<td>${ordemRegistros === "asc" ? start + index + 1 : total - (start + index)
        }</td>
        <td>${esc(reg.bu)}</td>
        <td>${esc(reg.razao)}</td>
        <td>${esc(reg.cnpj_cliente)}</td>
        <td>${esc(reg.nome_projeto)}</td>
        <td>${esc(reg.representadaNome)}</td>
        <td>${esc(reg.tipo_oferta)}</td>
        <td>${esc(reg.status)}</td>
        <td>${pedidoIcon}</td>
        <td>${revisaoIcon}</td>
        <td>${usuario}</td>
<td style="text-align:center;">
  <button class="btn-kebab" onclick="openActionsMenu(event,'oferta','${reg.id}')">...</button>
</td>
      `;
      tbody.appendChild(tr);
    });
  }

  if (pageInfo) pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;

  document.querySelectorAll("#tabelaRegistros tbody tr").forEach((tr) => {
    tr.classList.add("fade-enter");
    requestAnimationFrame(() => {
      tr.classList.add("fade-enter-active");
    });
  });
  const countEl = document.getElementById("registrosCount");
  if (countEl) {
    countEl.textContent = `${filtrados.length} registro(s) encontrado(s)`;
  }

  const seta = document.getElementById("setaOrdemRegistros");
  if (seta) seta.textContent = ordemRegistros === "asc" ? "↑" : "↓";

  renderActiveFilterTags();
}

function editarRegistro(id) {
  const reg = registros.find((r) => r.id === id);
  if (!reg) return;

  editId = id;

  document.getElementById("bu").value = reg.bu || "";

  setTimeout(() => {
    document.getElementById("bu")?.dispatchEvent(new Event("change"));
    const segEl = document.getElementById("segmento");
    if (segEl) segEl.value = reg.segmento || "";
  }, 0);

  document.getElementById("razao").value = reg.razao || "";

  const cnpjInput = document.getElementById("cnpj_cliente");
  cnpjInput.value = reg.cnpj_cliente || "";
  cnpjInput.dataset.clienteId = reg.clienteId || "";
  popularDatalistsCamposContato(reg.cnpj_cliente || "");

  document.getElementById("solicitante").value = reg.solicitante || "";
  document.getElementById("telefone").value = reg.telefone || "";
  document.getElementById("email").value = reg.email || "";
  document.getElementById("oferta").value = reg.oferta || "";
  document.getElementById("nome_projeto").value = reg.nome_projeto || "";
  document.getElementById("nome_projeto").dataset.projetoId =
    reg.projetoId || "";
  document.getElementById("valor_total").value = reg.valor_total || "";
  document.getElementById("ref_cliente").value = reg.ref_cliente || "";
  document.getElementById("data_entrada").value = reg.data_entrada || "";
  document.getElementById("status").value = reg.status || "";
  const _blocoPerda = document.getElementById("blocoMotivoPerda");
  const _motivoSel = document.getElementById("motivo_perda");
  if (_blocoPerda && _motivoSel) {
    if (reg.status === "Perdido") {
      _blocoPerda.classList.remove("hidden");
      _motivoSel.value = reg.motivo_perda || "";
    } else {
      _blocoPerda.classList.add("hidden");
      _motivoSel.value = "";
    }
  }
  document.getElementById("data_envio").value = reg.data_envio || "";
  document.getElementById("obs_geral").value = reg.obs_geral || "";

  const tipoNegocio = document.getElementById("tipo_oferta");
  if (tipoNegocio) tipoNegocio.value = reg.tipo_oferta || "";

  const representadaSelect = document.getElementById("representada");
  if (representadaSelect && reg.representadaId) {
    representadaSelect.value = reg.representadaId;
  }

  setTimeout(() => {
    initUnidadesMantex();

    const unidadeEl = document.getElementById("unidade");
    if (unidadeEl) {
      unidadeEl.value = reg.unidade || "";
    }
  }, 0);

  const _valPedido = (reg.possuiPedido || "nao").replace(/["\\]/g, "");
  document
    .querySelector(`input[name="pedido"][value="${_valPedido}"]`)
    ?.click();
  const _valRevisao = (reg.possuiRevisao || "nao").replace(/["\\]/g, "");
  document
    .querySelector(
      `input[name="revisao"][value="${_valRevisao}"]`,
    )
    ?.click();

  const _valSpot = (reg.atendimentoSpot || "nao").replace(/["\\]/g, "");
  document
    .querySelector(
      `input[name="spot"][value="${_valSpot}"]`,
    )
    ?.click();

  if (reg.possuiPedido === "sim" && reg.pedido) {
    document.getElementById("secaoPedido").classList.remove("hidden");
    document.getElementById("numero_pedido").value =
      reg.pedido.numero_pedido || "";
    document.getElementById("data_po").value = reg.pedido.data_po || "";
    document.getElementById("valor_pedido").value =
      reg.pedido.valor_pedido || "";
    document.getElementById("cond_pagamento").value =
      reg.pedido.cond_pagamento || "";
    document.getElementById("ref_projeto").value = reg.pedido.ref_projeto || "";
    document.getElementById("tipo_produto").value =
      reg.pedido.tipo_produto || "";
    document.getElementById("obs").value = reg.pedido.obs || "";
    preencherNotasFiscaisUI(reg.pedido);
    document.getElementById("prazo_entrega_contratual").value =
      reg.pedido.prazo_entrega_contratual || "";
    document.getElementById("ref_oc").value = reg.pedido.ref_oc || "";
    document.getElementById("data_implantacao").value =
      reg.pedido?.data_implantacao || "";

    const _valSolOc = (reg.pedido.solicitacao_oc || "nao").replace(/["\\]/g, "");
    document
      .querySelector(
        `input[name="sol_oc"][value="${_valSolOc}"]`,
      )
      ?.click();
    const _valEntregue = (reg.pedido?.entregue || "nao").replace(/["\\]/g, "");
    document
      .querySelector(
        `input[name="entregue"][value="${_valEntregue}"]`,
      )
      ?.click();
  } else {
    document.getElementById("secaoPedido").classList.add("hidden");
    resetNotasFiscaisUI();
  }

  if (reg.possuiRevisao === "sim" && reg.revisao) {
    document.getElementById("secaoRevisao").classList.remove("hidden");
    document.getElementById("rev_num_oferta").value =
      reg.revisao.numero_oferta_anterior || "";
    document.getElementById("rev_mudou").value = reg.revisao.mudou || "";
  } else {
    document.getElementById("secaoRevisao").classList.add("hidden");
  }

  document.getElementById("btnAdicionar").textContent = "Salvar Edição";
  document.getElementById("btnCancelarEdicao")?.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function excluirRegistro(id) {
  const registro = registros.find((r) => r.id === id);
  if (!registro) return;

  const nomeExibicao =
    `${registro.oferta || "Sem nº"} - ${registro.razao || "Sem razão social"}`;

  if (!await showConfirm("Tem certeza que deseja mover este registro para a lixeira?\n\nVocê poderá restaurá-lo em até 7 dias.", { title: "Mover para Lixeira", confirmText: "Mover" })) return;

  try {
    await moverParaLixeira({
      colecao: "ofertas",
      id,
      tipo: "registro",
      nomeExibicao,
    });

    registros = registros.filter((r) => r.id !== id);
    renderTabela();

    mostrarToastDesfazer({
      mensagem: "Registro movido para a lixeira.",
      onUndo: async () => {
        await restaurarDaLixeira("ofertas", id);
        await recarregarDadosPrincipais();
      },
    });
  } catch (e) {
    console.error(e);
    showToast("Erro ao mover registro para a lixeira.", "error");
  }
}

function exportExcel() {
  const filtrados = getRegistrosFiltrados();
  if (filtrados.length === 0) {
    showToast("Nenhum registro para exportar.", "info");
    return;
  }

  const schemaBase = window.OFERTA_SCHEMA || [];
  const maxNFs = getMaxNotasFiscais(filtrados);
  const schemaFinal = buildSchemaComNotas(schemaBase, maxNFs);

  const linhas = filtrados.map((reg, i) => {
    const row = {};
    row["#"] = i + 1;

    schemaFinal.forEach((c) => {
      let val;

      if (c.key.startsWith("nf_")) {
        const partes = c.key.split("_"); // nf_1_data
        const idx = parseInt(partes[1]) - 1;
        const campo = partes[2];

        const notas = getNotasFiscaisPedido(reg.pedido || {});
        val = notas[idx]?.[campo] || "";
      } else {
        val = getByPath(reg, c.key);
      }

      if (c.type === "yesno") val = asYesNo(val);
      if (c.type === "date") val = formatDateBR(val);
      if (c.type === "datetime") val = formatDateTimeBR(val);

      row[c.label] = val ?? "";
    });

    const notas = getNotasFiscaisPedido(reg.pedido || {});

    for (let j = 0; j < maxNFs; j++) {
      const nf = notas[j] || {};
      row[`Data NF ${j + 1}`] = formatDateBR(nf.data || "");
      row[`Número NF ${j + 1}`] = nf.numero || "";
      row[`Valor NF ${j + 1}`] = nf.valor || "";
    }

    return row;
  });

  const ws = XLSX.utils.json_to_sheet(linhas);

  ws["!cols"] = Object.keys(linhas[0]).map((k) => ({
    wch: Math.max(14, k.length + 2),
  }));

  const range = XLSX.utils.decode_range(ws["!ref"]);
  const border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };

  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell) continue;

      cell.s = cell.s || {};
      cell.s.border = border;

      if (R === 0) {
        cell.s.font = { bold: true };
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Registros");
  XLSX.writeFile(wb, "registros_ofertas.xlsx");
}

function exportPdf() {
  const filtrados = getRegistrosFiltrados();
  if (filtrados.length === 0) {
    showToast("Nenhum registro para exportar.", "info");
    return;
  }

  const schemaBase = window.OFERTA_SCHEMA || [];
  const maxNFs = getMaxNotasFiscais(filtrados);
  const schemaFinal = buildSchemaComNotas(schemaBase, maxNFs);

  const cols = ["#", ...schemaFinal.map((c) => c.label)];
  const totalCols = cols.length;

  const fontSize = totalCols > 22 ? 7 : totalCols > 16 ? 8 : 9;
  const padding = totalCols > 22 ? 2 : 3;

  let html = `
    <html>
      <head>
        <title>Registros de Ofertas</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            font-family: Arial, sans-serif;
            font-size: ${fontSize}px;
            margin: 0;
            color: #000;
          }

          h2 {
            text-align: center;
            margin: 0 0 10px 0;
            font-size: 14px;
          }

          .meta {
            margin-bottom: 8px;
            font-size: ${Math.max(fontSize - 1, 7)}px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          th, td {
            border: 1px solid #000;
            padding: ${padding}px;
            vertical-align: top;
            word-break: break-word;
            overflow-wrap: anywhere;
          }

          th {
            background: #eee;
            font-weight: bold;
            text-align: left;
          }

          tbody tr:nth-child(even) {
            background: #fafafa;
          }

          .col-index {
            width: 28px;
            text-align: center;
          }

          .nowrap {
            white-space: nowrap;
          }

          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <h2>Registros de Ofertas</h2>
        <div class="meta">Total de registros: ${filtrados.length}</div>
        <table>
          <thead>
            <tr>
              ${cols
      .map((c, i) =>
        i === 0
          ? `<th class="col-index">${escapeHtml(c)}</th>`
          : `<th>${escapeHtml(c)}</th>`,
      )
      .join("")}
            </tr>
          </thead>
          <tbody>
  `;

  filtrados.forEach((reg, i) => {
    const tds = [];
    tds.push(`<td class="col-index">${i + 1}</td>`);

    schemaFinal.forEach((c) => {
      let val;

      if (c.key.startsWith("nf_")) {
        const partes = c.key.split("_"); // nf_1_data
        const idx = parseInt(partes[1], 10) - 1;
        const campo = partes[2];

        const notas = getNotasFiscaisPedido(reg.pedido || {});
        val = notas[idx]?.[campo] || "";
      } else {
        val = getByPath(reg, c.key);
      }

      if (c.type === "yesno") val = asYesNo(val);
      if (c.type === "date") val = formatDateBR(val);
      if (c.type === "datetime") val = formatDateTimeBR(val);

      tds.push(`<td>${String(val ?? "").replace(/\n/g, "<br>")}</td>`);
    });

    html += `<tr>${tds.join("")}</tr>`;
  });

  html += `
          </tbody>
        </table>
      </body>
    </html>
  `;

  const win = window.open("", "_blank");
  if (!win) {
    showToast("Não foi possível abrir a janela. Desbloqueie popups no navegador e tente novamente.", "error");
    return;
  }
  try {
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  } catch (err) {
    console.error("Erro ao gerar PDF:", err);
    showToast("Erro ao gerar PDF.", "error");
  }
}

function getByPath(obj, path) {
  return path
    .split(".")
    .reduce((acc, k) => (acc && acc[k] != null ? acc[k] : ""), obj);
}

function asYesNo(v) {
  if (v === "sim") return "Sim";
  if (v === "nao") return "Não";
  if (v === true) return "Sim";
  if (v === false) return "Não";
  return v ? String(v) : "";
}

function formatDateBR(v) {
  if (!v) return "-";

  if (typeof v === "object") {
    if (typeof v.toDate === "function") {
      v = v.toDate();
    } else if (typeof v.seconds === "number") {
      v = new Date(v.seconds * 1000);
    }
  }

  if (v instanceof Date) {
    const dd = String(v.getDate()).padStart(2, "0");
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    const yy = v.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }

  const s = String(v).trim();
  if (!s) return "-";

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const [ymd] = s.split("T");
    const [y, m, d] = ymd.split("-");
    return `${d}/${m}/${y}`;
  }

  return s;
}

function escolherFormatoBackup(titulo) {
  return new Promise(function (resolve) {
    const overlay = document.createElement("div");
    overlay.className = "crm-formato-overlay";

    const card = document.createElement("div");
    card.className = "crm-formato-card";

    const titleEl = document.createElement("div");
    titleEl.className = "crm-formato-title";
    titleEl.textContent = titulo;

    const msgEl = document.createElement("div");
    msgEl.className = "crm-formato-msg";
    msgEl.textContent = "Escolha o formato do arquivo:";

    const row = document.createElement("div");
    row.className = "crm-formato-row";

    const btnCancel = document.createElement("button");
    btnCancel.textContent = "Cancelar";
    btnCancel.className = "secondary";

    const btnJson = document.createElement("button");
    btnJson.textContent = "JSON";

    const btnExcel = document.createElement("button");
    btnExcel.textContent = "Excel";
    btnExcel.className = "crm-formato-btn-excel";

    const close = (result) => {
      overlay.style.opacity = "0";
      overlay.style.transition = "opacity 0.18s";
      setTimeout(() => { overlay.remove(); }, 200);
      resolve(result);
    };

    btnCancel.addEventListener("click", () => close(null));
    btnJson.addEventListener("click",   () => close("json"));
    btnExcel.addEventListener("click",  () => close("excel"));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });
    document.addEventListener("keydown", function handler(e) {
      if (e.key === "Escape") { document.removeEventListener("keydown", handler); close(null); }
    });

    row.appendChild(btnCancel);
    row.appendChild(btnJson);
    row.appendChild(btnExcel);
    card.appendChild(titleEl);
    card.appendChild(msgEl);
    card.appendChild(row);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => { btnExcel.focus(); });
  });
}

function initBackupUI() {
  const btnBackupExport = document.getElementById("btnBackupExport");
  const btnBackupImport = document.getElementById("btnBackupImport");
  const btnModeloImportacao = document.getElementById("btnModeloImportacao");
  const inputBackupFile = document.getElementById("inputBackupFile");

  if (!btnBackupExport || !btnBackupImport || !inputBackupFile) return;
  if (btnBackupImport.dataset.bound === "1") return;

  btnBackupImport.dataset.bound = "1";
  btnBackupExport.dataset.bound = "1";
  inputBackupFile.dataset.bound = "1";
  if (btnModeloImportacao) btnModeloImportacao.dataset.bound = "1";

  btnBackupExport.addEventListener("click", async () => {
    const podeExportar =
      (typeof isAdmin === "function" && isAdmin()) ||
      (typeof usuarioEhSupervisor === "function" && usuarioEhSupervisor());
    if (!podeExportar) {
      showToast("Apenas administradores e supervisores podem exportar o backup.", "error");
      return;
    }
    const tipo = await escolherFormatoBackup("Exportar Backup");
    if (!tipo) return;

    if (tipo === "json") {
      const data = { registros, clientes, representadas, projetos };
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "backup_crm.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } else if (tipo === "excel") {
      exportBackupExcel();
    }
  });

  btnBackupImport.addEventListener("click", async () => {
    const tipo = await escolherFormatoBackup("Importar Backup");
    if (!tipo) return;

    backupImportMode = tipo;
    inputBackupFile.value = "";
    inputBackupFile.accept = tipo === "json" ? ".json" : ".xlsx,.xls";
    inputBackupFile.click();
  });

  if (btnModeloImportacao) {
    btnModeloImportacao.addEventListener("click", () => {
      baixarModeloImportacaoExcel();
    });
  }

  inputBackupFile.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file || !backupImportMode) return;

    if (backupImportMode === "json") {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const data = JSON.parse(ev.target.result);

          registros = data.registros || [];
          clientes = data.clientes || [];
          representadas = data.representadas || [];
          projetos = data.projetos || [];

          await Promise.all([
            salvarRegistros(),
            salvarClientes(),
            salvarRepresentadas(),
            typeof salvarProjetos === "function" ? salvarProjetos() : Promise.resolve(),
          ]);

          renderTabela();
          renderTabelaClientes();
          renderTabelaRepresentadas();
          if (typeof renderTabelaProjetos === "function") renderTabelaProjetos();
          preencherSelectRepresentadas();

          showToast("Backup JSON restaurado com sucesso!", "success");
        } catch (err) {
          console.error(err);
          showToast("Arquivo de backup JSON inválido.", "error");
        } finally {
          backupImportMode = null;
          inputBackupFile.value = "";
        }
      };
      reader.readAsText(file);
    } else if (backupImportMode === "excel") {
      try {
        await importBackupExcelFirebase(e);
      } finally {
        backupImportMode = null;
        inputBackupFile.value = "";
      }
    }
  });
}

function exportBackupExcel() {
  const wb = XLSX.utils.book_new();

  const listaClientes = Array.isArray(clientes) ? clientes : [];
  const listaRepresentadas = Array.isArray(representadas) ? representadas : [];
  const listaRegistros = Array.isArray(registros) ? registros : [];
  const listaProjetos = Array.isArray(projetos) ? projetos : [];

  // =========================
  // CLIENTES
  // =========================
  const clientesSheetData = listaClientes.map((c) => ({
    ID: c.id || "",
    RazaoSocial: c.razao || "",
    CNPJ: c.cnpj || "",
    IE: c.ie || "",
    Endereco: c.endereco || "",
    Segmento: c.segmento || "",
    SAP: c.sap || c.codigo_sap || c.cli_sap || "",
    CriadoPor: c.criadoPor || "",
    AtualizadoPor: c.atualizadoPor || "",
  }));

  const wsClientes = XLSX.utils.json_to_sheet(
    clientesSheetData.length ? clientesSheetData : [{ Mensagem: "Sem clientes" }]
  );
  XLSX.utils.book_append_sheet(wb, wsClientes, "Clientes");

  // =========================
  // CONTATOS DE CLIENTES
  // =========================
  const contatosSheetData = [];

  listaClientes.forEach((c) => {
    const contatosCliente = Array.isArray(c.contatos) ? c.contatos : [];

    contatosCliente.forEach((ct, index) => {
      contatosSheetData.push({
        ClienteID: c.id || "",
        ClienteRazaoSocial: c.razao || "",
        ClienteCNPJ: c.cnpj || "",
        ContatoIndex: index + 1,
        Nome: ct.nome || "",
        Telefone: ct.telefone || ct.tel || "",
        Email: ct.email || "",
        Funcao: ct.funcao || ct.cargo || "",
        Principal: ct.principal ? "Sim" : "Não",
        ResponsavelId: ct.responsavelId || "",
        ResponsavelNome: ct.responsavelNome || "",
        CriadoPor: ct.criadoPor || c.criadoPor || "",
        AtualizadoPor: ct.atualizadoPor || c.atualizadoPor || "",
      });
    });
  });

  const wsContatos = XLSX.utils.json_to_sheet(
    contatosSheetData.length ? contatosSheetData : [{ Mensagem: "Sem contatos de clientes" }]
  );
  XLSX.utils.book_append_sheet(wb, wsContatos, "ContatosClientes");

  // =========================
  // REPRESENTADAS
  // =========================
  const repsData = listaRepresentadas.map((r) => ({
    ID: r.id || "",
    Nome: r.nome || "",
    CriadoPor: r.criadoPor || "",
    AtualizadoPor: r.atualizadoPor || "",
  }));

  const wsRep = XLSX.utils.json_to_sheet(
    repsData.length ? repsData : [{ Mensagem: "Sem representadas" }]
  );
  XLSX.utils.book_append_sheet(wb, wsRep, "Representadas");

  // =========================
  // OFERTAS
  // =========================
  const ofertasData = listaRegistros.map((r) => ({
    ID: r.id || "",
    ClienteID: r.clienteId || "",
    ClienteCNPJ: r.cnpj_cliente || "",
    RazaoSocial: r.razao || "",
    BU: r.bu || "",
    Segmento: r.segmento || "",
    Projeto: r.nome_projeto || "",
    RepresentadaID: r.representadaId || "",
    RepresentadaNome: r.representadaNome || "",
    Solicitante: r.solicitante || "",
    Telefone: r.telefone || "",
    Email: r.email || "",
    NumeroOferta: r.oferta || "",
    TipoNegocio: r.tipo_oferta || "",
    ValorTotal: r.valor_total || "",
    Oportunidade: r.oportunidade || "",
    DataEntrada: r.data_entrada || "",
    Status: r.status || "",
    DataEnvio: r.data_envio || "",
    AtendimentoSpot: r.spot || r.atendimento_spot || "nao",
    PossuiPedido: r.possuiPedido || "nao",
    ObservacoesGerais: r.obs_geral || "",
    PossuiRevisao: r.possuiRevisao || "nao",
    RevisaoOfertaAnterior: r.revisao?.numero_oferta_anterior || "",
    RevisaoMudou: r.revisao?.mudou || "",
    NumeroPedido: r.pedido?.numero_pedido || "",
    ValorPedido: r.pedido?.valor_pedido || "",
    DataPO: r.pedido?.data_po || "",
    CondicaoPagamento: r.pedido?.cond_pagamento || "",
    RefProjetoPedido: r.pedido?.ref_projeto || "",
    TipoProduto: r.pedido?.tipo_produto || "",
    ObsPedido: r.pedido?.obs || "",
    NotasFiscais: formatarNotasFiscaisTexto(r.pedido),
    PrazoEntregaContratual: r.pedido?.prazo_entrega_contratual || "",
    SolicitacaoOC: r.pedido?.solicitacao_oc || r.pedido?.sol_oc || "",
    RefOC: r.pedido?.ref_oc || "",
    DataImplantacao: r.pedido?.data_implantacao || "",
    CriadoPor: r.criadoPor || "",
    AtualizadoPor: r.atualizadoPor || "",
  }));

  const wsOfertas = XLSX.utils.json_to_sheet(
    ofertasData.length ? ofertasData : [{ Mensagem: "Sem ofertas" }]
  );
  XLSX.utils.book_append_sheet(wb, wsOfertas, "Ofertas");

  // =========================
  // PROJETOS
  // =========================
  const projetosData = listaProjetos.map((p) => ({
    ID: p.id || "",
    NomeProjeto: p.nome || p.nome_projeto || "",
    TipoProjeto: p.tipo || p.tipo_projeto || "",
    Status: p.status || "",
    NumeroReferencia: p.referencia || p.numero_referencia || p.proj_referencia || "",
    PrazoFinal: p.prazo_final || p.proj_prazo_final || "",
    ValorInvestimento: p.valor_investimento || p.proj_valor_investimento || "",
    PrevFechamento: p.prev_fechamento || p.proj_prev_fechamento || "",
    InicioEntregas: p.inicio_entregas || p.proj_inicio_entregas || "",
    FimEntregas: p.fim_entregas || p.proj_fim_entregas || "",
    Observacoes: p.obs || p.proj_obs || "",
    CriadoPor: p.criadoPor || "",
    AtualizadoPor: p.atualizadoPor || "",
  }));

  const wsProjetos = XLSX.utils.json_to_sheet(
    projetosData.length ? projetosData : [{ Mensagem: "Sem projetos" }]
  );
  XLSX.utils.book_append_sheet(wb, wsProjetos, "Projetos");

  // =========================
  // ATUALIZAÇÕES DE PROJETOS
  // =========================
  const atualizacoesProjetosData = [];

  listaProjetos.forEach((p) => {
    const atualizacoes =
      Array.isArray(p.atualizacoes)
        ? p.atualizacoes
        : Array.isArray(p.updates)
          ? p.updates
          : Array.isArray(p.historico)
            ? p.historico
            : [];

    atualizacoes.forEach((at, index) => {
      if (typeof at === "string") {
        atualizacoesProjetosData.push({
          ProjetoID: p.id || "",
          ProjetoNome: p.nome || p.nome_projeto || "",
          ProjetoReferencia: p.referencia || p.numero_referencia || p.proj_referencia || "",
          AtualizacaoIndex: index + 1,
          Texto: at,
          Data: "",
          CriadoPor: p.criadoPor || "",
          AtualizadoPor: p.atualizadoPor || "",
        });
      } else {
        atualizacoesProjetosData.push({
          ProjetoID: p.id || "",
          ProjetoNome: p.nome || p.nome_projeto || "",
          ProjetoReferencia: p.referencia || p.numero_referencia || p.proj_referencia || "",
          AtualizacaoIndex: index + 1,
          Texto: at.texto || at.descricao || at.update || "",
          Data: at.data || at.criadoEm || at.updatedAt || "",
          CriadoPor: at.criadoPor || p.criadoPor || "",
          AtualizadoPor: at.atualizadoPor || p.atualizadoPor || "",
        });
      }
    });
  });

  const wsAtualizacoesProjetos = XLSX.utils.json_to_sheet(
    atualizacoesProjetosData.length
      ? atualizacoesProjetosData
      : [{ Mensagem: "Sem atualizações de projetos" }]
  );
  XLSX.utils.book_append_sheet(wb, wsAtualizacoesProjetos, "AtualizacoesProjetos");

  // =========================
  // CONTATOS DE PROJETOS
  // =========================
  const contatosProjetosData = [];

  listaProjetos.forEach((p) => {
    const contatosProjeto =
      Array.isArray(p.contatos)
        ? p.contatos
        : Array.isArray(p.contatosProjeto)
          ? p.contatosProjeto
          : [];

    contatosProjeto.forEach((ct, index) => {
      contatosProjetosData.push({
        ProjetoID: p.id || "",
        ProjetoNome: p.nome || p.nome_projeto || "",
        ProjetoReferencia: p.referencia || p.numero_referencia || p.proj_referencia || "",
        ContatoIndex: index + 1,
        Nome: ct.nome || "",
        Telefone: ct.telefone || ct.tel || "",
        Email: ct.email || "",
        Funcao: ct.funcao || ct.cargo || "",
        Principal: ct.principal ? "Sim" : "Não",
        ResponsavelId: ct.responsavelId || "",
        ResponsavelNome: ct.responsavelNome || "",
        CriadoPor: ct.criadoPor || p.criadoPor || "",
        AtualizadoPor: ct.atualizadoPor || p.atualizadoPor || "",
      });
    });
  });

  const wsContatosProjetos = XLSX.utils.json_to_sheet(
    contatosProjetosData.length
      ? contatosProjetosData
      : [{ Mensagem: "Sem contatos de projetos" }]
  );
  XLSX.utils.book_append_sheet(wb, wsContatosProjetos, "ContatosProjetos");

  // =========================
  // AJUSTE DE LARGURA DAS COLUNAS
  // =========================
  function autoFitColumns(ws, data) {
    const colWidths = [];
    if (!data.length) return;

    const headers = Object.keys(data[0]);

    headers.forEach((header, colIndex) => {
      let maxLength = String(header).length;

      data.forEach((row) => {
        const cellValue = row[header] == null ? "" : String(row[header]);
        if (cellValue.length > maxLength) {
          maxLength = cellValue.length;
        }
      });

      colWidths[colIndex] = { wch: Math.min(maxLength + 2, 40) };
    });

    ws["!cols"] = colWidths;
  }

  autoFitColumns(wsClientes, clientesSheetData.length ? clientesSheetData : [{ Mensagem: "Sem clientes" }]);
  autoFitColumns(wsContatos, contatosSheetData.length ? contatosSheetData : [{ Mensagem: "Sem contatos de clientes" }]);
  autoFitColumns(wsRep, repsData.length ? repsData : [{ Mensagem: "Sem representadas" }]);
  autoFitColumns(wsOfertas, ofertasData.length ? ofertasData : [{ Mensagem: "Sem ofertas" }]);
  autoFitColumns(wsProjetos, projetosData.length ? projetosData : [{ Mensagem: "Sem projetos" }]);
  autoFitColumns(wsAtualizacoesProjetos, atualizacoesProjetosData.length ? atualizacoesProjetosData : [{ Mensagem: "Sem atualizações de projetos" }]);
  autoFitColumns(wsContatosProjetos, contatosProjetosData.length ? contatosProjetosData : [{ Mensagem: "Sem contatos de projetos" }]);


  XLSX.writeFile(wb, "backup_crm.xlsx");
}

function abrirModalImportacao() {
  document.getElementById("modalImportacao")?.classList.remove("hidden");
}

function fecharModalImportacao() {
  document.getElementById("modalImportacao")?.classList.add("hidden");
}

function iniciarStatusImportacao(titulo = "Importação") {
  const modal = document.getElementById("modalImportacao");
  const tituloEl = document.getElementById("modalImportacaoTitulo");
  const loaderWrap = document.getElementById("importLoaderWrap");
  const resultadoWrap = document.getElementById("importResultadoWrap");
  const statusTexto = document.getElementById("importStatusTexto");
  const progressBar = document.getElementById("importProgressBar");
  const progressLabel = document.getElementById("importProgressLabel");

  if (tituloEl) tituloEl.textContent = titulo;
  if (loaderWrap) loaderWrap.classList.remove("hidden");
  if (resultadoWrap) resultadoWrap.classList.add("hidden");
  if (statusTexto) statusTexto.textContent = "Importando arquivo...";
  if (progressBar) progressBar.style.width = "0%";
  if (progressLabel) progressLabel.textContent = "0%";
  if (modal) modal.classList.remove("hidden");
}

function atualizarStatusImportacao(percentual, texto = "Importando arquivo...") {
  const progressBar = document.getElementById("importProgressBar");
  const progressLabel = document.getElementById("importProgressLabel");
  const statusTexto = document.getElementById("importStatusTexto");

  const valor = Math.max(0, Math.min(100, Number(percentual) || 0));
  if (progressBar) progressBar.style.width = `${valor}%`;
  if (progressLabel) progressLabel.textContent = `${valor}%`;
  if (statusTexto) statusTexto.textContent = texto;
}

function mostrarResultadoImportacao(titulo, mensagem, tipo = "sucesso", erros = [], ignoradosDetalhes = []) {
  const modal = document.getElementById("modalImportacao");
  const tituloEl = document.getElementById("modalImportacaoTitulo");
  const loaderWrap = document.getElementById("importLoaderWrap");
  const resultadoWrap = document.getElementById("importResultadoWrap");
  const resumo = document.getElementById("importResultadoResumo");
  const btnRelatorio = document.getElementById("btnBaixarRelatorioImportacao");

  if (tituloEl) {
    tituloEl.textContent = titulo;
    tituloEl.style.color = tipo === "erro" ? "#dc2626" : "#16a34a";
  }

  if (loaderWrap) loaderWrap.classList.add("hidden");
  if (resultadoWrap) resultadoWrap.classList.remove("hidden");
  if (resumo) resumo.innerHTML = mensagem;
  if (modal) modal.classList.remove("hidden");

  if (btnRelatorio) {
    const temConteudo = (Array.isArray(erros) && erros.length) || (Array.isArray(ignoradosDetalhes) && ignoradosDetalhes.length);
    if (temConteudo) {
      btnRelatorio.classList.remove("hidden");
      btnRelatorio.onclick = () => baixarRelatorioErrosImportacao(erros, ignoradosDetalhes);
    } else {
      btnRelatorio.classList.add("hidden");
      btnRelatorio.onclick = null;
    }
  }
}

function baixarRelatorioErrosImportacao(erros, ignoradosDetalhes = []) {
  const linhas = [
    "Relatório Completo de Importação",
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    "",
  ];

  if (ignoradosDetalhes.length) {
    linhas.push(`=== REGISTROS IGNORADOS (${ignoradosDetalhes.length} — duplicatas já cadastradas) ===`);
    ignoradosDetalhes.forEach((d, i) => linhas.push(`${i + 1}. ${d}`));
    linhas.push("");
  }

  if (erros.length) {
    linhas.push(`=== ERROS (${erros.length}) ===`);
    erros.forEach((e, i) => linhas.push(`${i + 1}. ${e}`));
    linhas.push("");
  }

  if (!ignoradosDetalhes.length && !erros.length) {
    linhas.push("Nenhum erro ou registro ignorado.");
  }

  const blob = new Blob([linhas.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "relatorio_importacao.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

function importBackupExcelFirebase(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  const nomeArquivo = file.name.toLowerCase();
  if (!nomeArquivo.endsWith(".xlsx") && !nomeArquivo.endsWith(".xls")) {
    mostrarResultadoImportacao(
      "Arquivo inválido",
      "Selecione um arquivo Excel válido (.xlsx ou .xls).",
      "erro",
      ["O arquivo selecionado não é uma planilha Excel válida."]
    );
    event.target.value = "";
    return;
  }

  iniciarStatusImportacao("Importando planilha");
  atualizarStatusImportacao(2, "Preparando Firebase...");

  const reader = new FileReader();

  reader.onload = async function (e) {
    try {
      if (!window.db) {
        throw new Error("Firestore não está disponível.");
      }

      atualizarStatusImportacao(6, "Lendo arquivo Excel...");

      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: "array" });

      const sheetToJson = (name) =>
        wb.Sheets[name]
          ? XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "" })
          : [];

      const clientesPlan = sheetToJson("Clientes");
      const contatosClientesPlan = sheetToJson("ContatosClientes");
      const representadasPlan = sheetToJson("Representadas");
      const ofertasPlan = sheetToJson("Ofertas");
      const projetosPlan = sheetToJson("Projetos");
      const contatosProjetosPlan = sheetToJson("ContatosProjetos");
      const atualizacoesProjetosPlan = sheetToJson("AtualizacoesProjetos");

      const totalLinhas =
        clientesPlan.length +
        contatosClientesPlan.length +
        representadasPlan.length +
        ofertasPlan.length +
        projetosPlan.length +
        contatosProjetosPlan.length +
        atualizacoesProjetosPlan.length;

      if (totalLinhas === 0) {
        mostrarResultadoImportacao(
          "Planilha vazia",
          "Nenhuma linha válida foi encontrada nas abas esperadas.",
          "erro",
          ["A planilha não possui dados nas abas do modelo."]
        );
        event.target.value = "";
        return;
      }

      atualizarStatusImportacao(12, "Carregando dados atuais do Firebase...");

      const [
        snapClientes,
        snapRepresentadas,
        snapOfertas,
        snapProjetos,
      ] = await Promise.all([
        db.collection("clientes").get(),
        db.collection("representadas").get(),
        db.collection("ofertas").get(),
        db.collection("projetos").get(),
      ]);

      const clientesExistentes = snapClientes.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const representadasExistentes = snapRepresentadas.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const ofertasExistentes = snapOfertas.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const projetosExistentes = snapProjetos.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const clientesPorCnpj = new Map(
        clientesExistentes.map((c) => [normalizarCNPJ(c.cnpj), c])
      );

      const representadasPorNome = new Map(
        representadasExistentes.map((r) => [normalizarTexto(r.nome).toLowerCase(), r])
      );

      const projetosPorChave = new Map(
        projetosExistentes.map((p) => [
          chaveProjetoImport(
            p.nome || p.nome_projeto,
            p.numero_referencia || p.referencia || p.proj_referencia
          ),
          p
        ])
      );

      const ofertasPorChave = new Map(
        ofertasExistentes.map((o) => [
          chaveOfertaImport(o.oferta, o.cnpj_cliente),
          o
        ])
      );

      const currentUser =
        typeof getCurrentUserName === "function"
          ? getCurrentUserName()
          : "Importação";
      const nowIso = new Date().toISOString();

      const relatorio = {
        clientes: { importados: 0, ignorados: 0, falhas: 0 },
        representadas: { importados: 0, ignorados: 0, falhas: 0 },
        ofertas: { importados: 0, ignorados: 0, falhas: 0 },
        projetos: { importados: 0, ignorados: 0, falhas: 0 },
        contatosClientes: { importados: 0, ignorados: 0, falhas: 0 },
        contatosProjetos: { importados: 0, ignorados: 0, falhas: 0 },
        atualizacoesProjetos: { importados: 0, ignorados: 0, falhas: 0 },
        erros: [],
        avisos: [],
        ignoradosDetalhes: [],
      };

      // Detectar colunas ausentes ou com nome errado em cada aba
      const _abasEColunas = [
        { aba: "Clientes",             rows: clientesPlan,             colunas: ["RazaoSocial", "CNPJ", "Segmento"] },
        { aba: "ContatosClientes",     rows: contatosClientesPlan,     colunas: ["ClienteCNPJ", "Nome", "Telefone", "Email"] },
        { aba: "Representadas",        rows: representadasPlan,        colunas: ["Nome"] },
        { aba: "Projetos",             rows: projetosPlan,             colunas: ["NomeProjeto", "TipoProjeto", "Status"] },
        { aba: "ContatosProjetos",     rows: contatosProjetosPlan,     colunas: ["ProjetoNome", "Nome", "Telefone", "Email"] },
        { aba: "AtualizacoesProjetos", rows: atualizacoesProjetosPlan, colunas: ["ProjetoNome", "Texto"] },
        { aba: "Ofertas",              rows: ofertasPlan,              colunas: ["BU", "RazaoSocial", "Solicitante", "Telefone", "Email", "RepresentadaNome", "ValorTotal", "Status", "TipoNegocio", "NumeroOferta"] },
      ];
      for (const { aba, rows, colunas } of _abasEColunas) {
        if (!rows.length) continue;
        for (const col of colunas) {
          if (!(col in rows[0])) {
            relatorio.avisos.push(`Aba "${aba}": coluna "${col}" não encontrada — verifique o nome exato no arquivo`);
          }
        }
      }

      let linhasProcessadas = 0;

      function atualizarProgressoReal(texto) {
        const percentualBase = 15;
        const percentualMaximo = 92;

        let percentual = percentualBase;
        if (totalLinhas > 0) {
          percentual =
            percentualBase +
            Math.round((linhasProcessadas / totalLinhas) * (percentualMaximo - percentualBase));
        }

        atualizarStatusImportacao(percentual, texto);
      }

      // =========================================
      // IMPORTAÇÃO DE CLIENTES
      // =========================================
      const clientesNovosMap = new Map();

      clientesPlan.forEach((row, i) => {
        linhasProcessadas++;
        atualizarProgressoReal(`Validando clientes (${linhasProcessadas}/${totalLinhas})...`);

        const linha = i + 2;
        const erros = validarObrigatoriosLinha(
          row,
          ["RazaoSocial", "CNPJ", "Segmento"],
          `Clientes linha ${linha}`
        );

        const cnpjNormalizado = normalizarCNPJ(row.CNPJ);
        if (!cnpjNormalizado) {
          erros.push(`Clientes linha ${linha}: CNPJ inválido`);
        }

        if (erros.length) {
          relatorio.clientes.falhas++;
          relatorio.erros.push(...erros);
          return;
        }

        if (clientesPorCnpj.has(cnpjNormalizado) || clientesNovosMap.has(cnpjNormalizado)) {
          relatorio.clientes.ignorados++;
          relatorio.ignoradosDetalhes.push(`Clientes linha ${linha}: CNPJ ${row.CNPJ} (${normalizarTexto(row.RazaoSocial)}) já cadastrado`);
          return;
        }

        const id = row.ID || gerarIdSeguroImportacao();

        clientesNovosMap.set(cnpjNormalizado, {
          id,
          razao: normalizarTexto(row.RazaoSocial),
          cnpj: normalizarTexto(row.CNPJ),
          ie: normalizarTexto(row.IE),
          endereco: normalizarTexto(row.Endereco),
          segmento: normalizarTexto(row.Segmento),
          sap: normalizarTexto(row.SAP),
          contatos: [],
          criadoPor: currentUser,
          atualizadoPor: currentUser,
          criadoEm: nowIso,
          atualizadoEm: nowIso,
          historico: typeof criarEventoHistorico === "function"
            ? [
              criarEventoHistorico({
                usuario: currentUser,
                acao: "Criou",
                campo: "cliente",
                de: "",
                para: normalizarTexto(row.RazaoSocial) || "novo cliente",
              }),
            ]
            : [],
        });
      });

      // CONTATOS DE CLIENTES PARA NOVOS E EXISTENTES
      contatosClientesPlan.forEach((row, i) => {
        linhasProcessadas++;
        atualizarProgressoReal(`Processando contatos de clientes (${linhasProcessadas}/${totalLinhas})...`);

        const linha = i + 2;
        const erros = validarObrigatoriosLinha(
          row,
          ["ClienteCNPJ", "Nome", "Telefone", "Email"],
          `ContatosClientes linha ${linha}`
        );

        const clienteCnpj = normalizarCNPJ(row.ClienteCNPJ);
        if (!clienteCnpj) {
          erros.push(`ContatosClientes linha ${linha}: ClienteCNPJ inválido`);
        }

        if (erros.length) {
          relatorio.contatosClientes.falhas++;
          relatorio.erros.push(...erros);
          return;
        }

        const contato = {
          nome: normalizarTexto(row.Nome),
          telefone: normalizarTexto(row.Telefone),
          email: normalizarEmail(row.Email),
          funcao: normalizarTexto(row.Funcao),
          principal: normalizarTexto(row.Principal).toLowerCase() === "sim",
          responsavelId: normalizarTexto(row.ResponsavelId),
          responsavelNome: normalizarTexto(row.ResponsavelNome),
          criadoEm: nowIso,
          atualizadoEm: nowIso,
          criadoPor: currentUser,
          atualizadoPor: currentUser,
        };

        const clienteNovo = clientesNovosMap.get(clienteCnpj);
        if (clienteNovo) {
          const existeContato = (clienteNovo.contatos || []).some(
            (ct) =>
              normalizarTexto(ct.nome).toLowerCase() === normalizarTexto(contato.nome).toLowerCase() &&
              normalizarEmail(ct.email) === normalizarEmail(contato.email)
          );

          if (existeContato) {
            relatorio.contatosClientes.ignorados++;
            relatorio.ignoradosDetalhes.push(`ContatosClientes linha ${linha}: ${contato.nome} (${contato.email}) já existe neste cliente`);
            return;
          }

          if (contato.principal) {
            clienteNovo.contatos = clienteNovo.contatos.map((c) => ({ ...c, principal: false }));
          }
          clienteNovo.contatos.push(contato);
          relatorio.contatosClientes.importados++;
          return;
        }

        const clienteExistente = clientesPorCnpj.get(clienteCnpj);
        if (!clienteExistente) {
          relatorio.contatosClientes.falhas++;
          relatorio.erros.push(`ContatosClientes linha ${linha}: cliente não encontrado pelo CNPJ`);
          return;
        }

        if (!Array.isArray(clienteExistente.contatos)) clienteExistente.contatos = [];

        const existeContato = clienteExistente.contatos.some(
          (ct) =>
            normalizarTexto(ct.nome).toLowerCase() === normalizarTexto(contato.nome).toLowerCase() &&
            normalizarEmail(ct.email) === normalizarEmail(contato.email)
        );

        if (existeContato) {
          relatorio.contatosClientes.ignorados++;
          relatorio.ignoradosDetalhes.push(`ContatosClientes linha ${linha}: ${contato.nome} (${contato.email}) já existe neste cliente`);
          return;
        }

        if (contato.principal) {
          clienteExistente.contatos = clienteExistente.contatos.map((c) => ({ ...c, principal: false }));
        }

        clienteExistente.contatos.push(contato);
        clienteExistente.atualizadoPor = currentUser;
        clienteExistente.atualizadoEm = nowIso;
        clienteExistente.__precisaSalvar = true;
        relatorio.contatosClientes.importados++;
      });

      // GARANTIR CONTATO PRINCIPAL NOS CLIENTES NOVOS
      clientesNovosMap.forEach((cliente) => {
        if (cliente.contatos.length > 0 && !cliente.contatos.some((c) => c.principal)) {
          cliente.contatos[0].principal = true;
        }
      });

      atualizarStatusImportacao(40, "Salvando clientes no Firebase...");

      for (const cliente of clientesNovosMap.values()) {
        await db.collection("clientes").doc(cliente.id).set(cliente);
        clientesPorCnpj.set(normalizarCNPJ(cliente.cnpj), cliente);
        relatorio.clientes.importados++;
      }

      for (const cliente of clientesExistentes) {
        if (cliente.__precisaSalvar) {
          const copia = { ...cliente };
          delete copia.__precisaSalvar;
          await db.collection("clientes").doc(cliente.id).set(copia);
        }
      }

      // =========================================
      // REPRESENTADAS
      // =========================================
      representadasPlan.forEach((row, i) => {
        linhasProcessadas++;
        atualizarProgressoReal(`Validando representadas (${linhasProcessadas}/${totalLinhas})...`);

        const linha = i + 2;
        const erros = validarObrigatoriosLinha(
          row,
          ["Nome"],
          `Representadas linha ${linha}`
        );

        if (erros.length) {
          relatorio.representadas.falhas++;
          relatorio.erros.push(...erros);
          return;
        }

        const nomeKey = normalizarTexto(row.Nome).toLowerCase();
        if (representadasPorNome.has(nomeKey)) {
          relatorio.representadas.ignorados++;
          relatorio.ignoradosDetalhes.push(`Representadas linha ${linha}: "${normalizarTexto(row.Nome)}" já cadastrada`);
          return;
        }

        const id = row.ID || gerarIdSeguroImportacao();
        const representada = {
          id,
          nome: normalizarTexto(row.Nome),
          criadoPor: currentUser,
          atualizadoPor: currentUser,
          responsavelEmail: (window.auth?.currentUser?.email || "").toLowerCase(),
          criadoEm: nowIso,
          atualizadoEm: nowIso,
        };

        representadasPorNome.set(nomeKey, representada);
        representada.__nova = true;
      });

      atualizarStatusImportacao(52, "Salvando representadas no Firebase...");

      for (const representada of representadasPorNome.values()) {
        if (representada.__nova) {
          const copia = { ...representada };
          delete copia.__nova;
          await db.collection("representadas").doc(copia.id).set(copia);
          relatorio.representadas.importados++;
        }
      }

      // =========================================
      // PROJETOS
      // =========================================
      const projetosNovosMap = new Map();

      projetosPlan.forEach((row, i) => {
        linhasProcessadas++;
        atualizarProgressoReal(`Validando projetos (${linhasProcessadas}/${totalLinhas})...`);

        const linha = i + 2;
        const erros = validarObrigatoriosLinha(
          row,
          ["NomeProjeto", "TipoProjeto", "Status"],
          `Projetos linha ${linha}`
        );

        if (erros.length) {
          relatorio.projetos.falhas++;
          relatorio.erros.push(...erros);
          return;
        }

        const chave = chaveProjetoImport(row.NomeProjeto, row.NumeroReferencia);

        if (projetosPorChave.has(chave) || projetosNovosMap.has(chave)) {
          relatorio.projetos.ignorados++;
          relatorio.ignoradosDetalhes.push(`Projetos linha ${linha}: "${normalizarTexto(row.NomeProjeto)}"${row.NumeroReferencia ? ` (ref. ${row.NumeroReferencia})` : ""} já cadastrado`);
          return;
        }

        const id = row.ID || gerarIdSeguroImportacao();

        projetosNovosMap.set(chave, {
          id,
          nome: normalizarTexto(row.NomeProjeto),
          tipo: normalizarTexto(row.TipoProjeto),
          status: normalizarTexto(row.Status),
          numero_referencia: normalizarTexto(row.NumeroReferencia),
          prazo_final: normalizarTexto(row.PrazoFinal),
          valor_investimento: normalizarTexto(row.ValorInvestimento),
          prev_fechamento: normalizarTexto(row.PrevFechamento),
          inicio_entregas: normalizarTexto(row.InicioEntregas),
          fim_entregas: normalizarTexto(row.FimEntregas),
          obs: normalizarTexto(row.Observacoes),
          responsavelEmail: (window.auth?.currentUser?.email || "").toLowerCase(),
          contatos: [],
          atualizacoes: [],
          criadoPor: currentUser,
          atualizadoPor: currentUser,
          criadoEm: nowIso,
          atualizadoEm: nowIso,
          historico: typeof criarEventoHistorico === "function"
            ? [
              criarEventoHistorico({
                usuario: currentUser,
                acao: "Criou",
                campo: "projeto",
                de: "",
                para: normalizarTexto(row.NomeProjeto) || "novo projeto",
              }),
            ]
            : [],
        });
      });

      // CONTATOS DE PROJETOS
      contatosProjetosPlan.forEach((row, i) => {
        linhasProcessadas++;
        atualizarProgressoReal(`Processando contatos de projetos (${linhasProcessadas}/${totalLinhas})...`);

        const linha = i + 2;
        const erros = validarObrigatoriosLinha(
          row,
          ["ProjetoNome", "Nome", "Telefone", "Email"],
          `ContatosProjetos linha ${linha}`
        );

        if (erros.length) {
          relatorio.contatosProjetos.falhas++;
          relatorio.erros.push(...erros);
          return;
        }

        const chave = chaveProjetoImport(row.ProjetoNome, row.ProjetoReferencia);

        const contato = {
          nome: normalizarTexto(row.Nome),
          telefone: normalizarTexto(row.Telefone),
          email: normalizarEmail(row.Email),
          funcao: normalizarTexto(row.Funcao),
          principal: normalizarTexto(row.Principal).toLowerCase() === "sim",
          responsavelId: normalizarTexto(row.ResponsavelId),
          responsavelNome: normalizarTexto(row.ResponsavelNome),
          criadoEm: nowIso,
          atualizadoEm: nowIso,
          criadoPor: currentUser,
          atualizadoPor: currentUser,
        };

        const projetoNovo = projetosNovosMap.get(chave);
        if (projetoNovo) {
          const existeContato = (projetoNovo.contatos || []).some(
            (ct) =>
              normalizarTexto(ct.nome).toLowerCase() === normalizarTexto(contato.nome).toLowerCase() &&
              normalizarEmail(ct.email) === normalizarEmail(contato.email)
          );

          if (existeContato) {
            relatorio.contatosProjetos.ignorados++;
            relatorio.ignoradosDetalhes.push(`ContatosProjetos linha ${linha}: ${contato.nome} (${contato.email}) já existe neste projeto`);
            return;
          }

          if (contato.principal) {
            projetoNovo.contatos = projetoNovo.contatos.map((c) => ({ ...c, principal: false }));
          }
          projetoNovo.contatos.push(contato);
          relatorio.contatosProjetos.importados++;
          return;
        }

        const projetoExistente = projetosPorChave.get(chave);
        if (!projetoExistente) {
          relatorio.contatosProjetos.falhas++;
          relatorio.erros.push(`ContatosProjetos linha ${linha}: projeto não encontrado`);
          return;
        }

        if (!Array.isArray(projetoExistente.contatos)) projetoExistente.contatos = [];

        const existeContato = projetoExistente.contatos.some(
          (ct) =>
            normalizarTexto(ct.nome).toLowerCase() === normalizarTexto(contato.nome).toLowerCase() &&
            normalizarEmail(ct.email) === normalizarEmail(contato.email)
        );

        if (existeContato) {
          relatorio.contatosProjetos.ignorados++;
          relatorio.ignoradosDetalhes.push(`ContatosProjetos linha ${linha}: ${contato.nome} (${contato.email}) já existe neste projeto`);
          return;
        }

        if (contato.principal) {
          projetoExistente.contatos = projetoExistente.contatos.map((c) => ({ ...c, principal: false }));
        }

        projetoExistente.contatos.push(contato);
        projetoExistente.atualizadoPor = currentUser;
        projetoExistente.atualizadoEm = nowIso;
        projetoExistente.__precisaSalvar = true;
        relatorio.contatosProjetos.importados++;
      });

      // ATUALIZAÇÕES DE PROJETOS
      atualizacoesProjetosPlan.forEach((row, i) => {
        linhasProcessadas++;
        atualizarProgressoReal(`Processando atualizações de projetos (${linhasProcessadas}/${totalLinhas})...`);

        const linha = i + 2;
        const erros = validarObrigatoriosLinha(
          row,
          ["ProjetoNome", "Texto"],
          `AtualizacoesProjetos linha ${linha}`
        );

        if (erros.length) {
          relatorio.atualizacoesProjetos.falhas++;
          relatorio.erros.push(...erros);
          return;
        }

        const chave = chaveProjetoImport(row.ProjetoNome, row.ProjetoReferencia);

        const atualizacao = {
          texto: normalizarTexto(row.Texto),
          data: normalizarTexto(row.Data),
          criadoPor: currentUser,
          atualizadoPor: currentUser,
          criadoEm: nowIso,
          atualizadoEm: nowIso,
        };

        const projetoNovo = projetosNovosMap.get(chave);
        if (projetoNovo) {
          const existeAtualizacao = (projetoNovo.atualizacoes || []).some(
            (at) =>
              normalizarTexto(at.texto).toLowerCase() === normalizarTexto(atualizacao.texto).toLowerCase() &&
              normalizarTexto(at.data) === normalizarTexto(atualizacao.data)
          );

          if (existeAtualizacao) {
            relatorio.atualizacoesProjetos.ignorados++;
            relatorio.ignoradosDetalhes.push(`AtualizacoesProjetos linha ${linha}: texto idêntico já existe neste projeto`);
            return;
          }

          projetoNovo.atualizacoes.push(atualizacao);
          relatorio.atualizacoesProjetos.importados++;
          return;
        }

        const projetoExistente = projetosPorChave.get(chave);
        if (!projetoExistente) {
          relatorio.atualizacoesProjetos.falhas++;
          relatorio.erros.push(`AtualizacoesProjetos linha ${linha}: projeto não encontrado`);
          return;
        }

        if (!Array.isArray(projetoExistente.atualizacoes)) projetoExistente.atualizacoes = [];

        const existeAtualizacao = projetoExistente.atualizacoes.some(
          (at) =>
            normalizarTexto(at.texto).toLowerCase() === normalizarTexto(atualizacao.texto).toLowerCase() &&
            normalizarTexto(at.data) === normalizarTexto(atualizacao.data)
        );

        if (existeAtualizacao) {
          relatorio.atualizacoesProjetos.ignorados++;
          relatorio.ignoradosDetalhes.push(`AtualizacoesProjetos linha ${linha}: texto idêntico já existe neste projeto`);
          return;
        }

        projetoExistente.atualizacoes.push(atualizacao);
        projetoExistente.atualizadoPor = currentUser;
        projetoExistente.atualizadoEm = nowIso;
        projetoExistente.__precisaSalvar = true;
        relatorio.atualizacoesProjetos.importados++;
      });

      atualizarStatusImportacao(68, "Salvando projetos no Firebase...");

      for (const projeto of projetosNovosMap.values()) {
        await db.collection("projetos").doc(projeto.id).set(projeto);
        projetosPorChave.set(
          chaveProjetoImport(projeto.nome, projeto.numero_referencia),
          projeto
        );
        relatorio.projetos.importados++;
      }

      for (const projeto of projetosExistentes) {
        if (projeto.__precisaSalvar) {
          const copia = { ...projeto };
          delete copia.__precisaSalvar;
          await db.collection("projetos").doc(projeto.id).set(copia);
        }
      }

      // =========================================
      // OFERTAS
      // =========================================
      atualizarStatusImportacao(76, "Validando ofertas...");

      for (let i = 0; i < ofertasPlan.length; i++) {
        const row = ofertasPlan[i];
        linhasProcessadas++;
        atualizarProgressoReal(`Importando ofertas (${linhasProcessadas}/${totalLinhas})...`);

        const linha = i + 2;
        const erros = validarObrigatoriosLinha(
          row,
          ["BU", "RazaoSocial", "Solicitante", "Telefone", "Email", "RepresentadaNome", "ValorTotal", "Status", "TipoNegocio"],
          `Ofertas linha ${linha}`
        );

        if (!normalizarTexto(row.NumeroOferta)) {
          erros.push(`Ofertas linha ${linha}: campo obrigatório "NumeroOferta" não preenchido`);
        }

        if (deveExigirSegmentoImportacao(row.BU) && !normalizarTexto(row.Segmento)) {
          erros.push(`Ofertas linha ${linha}: campo obrigatório "Segmento" não preenchido para a B.U informada`);
        }

        if (erros.length) {
          relatorio.ofertas.falhas++;
          relatorio.erros.push(...erros);
          continue;
        }

        const chave = chaveOfertaImport(row.NumeroOferta, row.ClienteCNPJ);
        if (ofertasPorChave.has(chave)) {
          relatorio.ofertas.ignorados++;
          relatorio.ignoradosDetalhes.push(`Ofertas linha ${linha}: N° ${row.NumeroOferta} / CNPJ ${row.ClienteCNPJ} já cadastrada`);
          continue;
        }

        const clienteRelacionado = clientesPorCnpj.get(normalizarCNPJ(row.ClienteCNPJ));
        const representadaRelacionada = representadasPorNome.get(normalizarTexto(row.RepresentadaNome).toLowerCase());

        const id = row.ID || gerarIdSeguroImportacao();

        const oferta = {
          id,
          bu: normalizarTexto(row.BU),
          segmento: normalizarTexto(row.Segmento),
          razao: normalizarTexto(row.RazaoSocial),
          cnpj_cliente: normalizarTexto(row.ClienteCNPJ),
          clienteId: clienteRelacionado?.id || normalizarTexto(row.ClienteID) || null,
          solicitante: normalizarTexto(row.Solicitante),
          telefone: normalizarTexto(row.Telefone),
          email: normalizarEmail(row.Email),
          oferta: normalizarTexto(row.NumeroOferta),
          nome_projeto: normalizarTexto(row.Projeto),
          projetoId: null,
          representadaId: representadaRelacionada?.id || normalizarTexto(row.RepresentadaID) || null,
          representadaNome: normalizarTexto(row.RepresentadaNome),
          unidade: normalizarTexto(row.Unidade),
          valor_total: normalizarTexto(row.ValorTotal),
          ref_cliente: normalizarTexto(row.RefCliente),
          oportunidade: normalizarTexto(row.Oportunidade),
          data_entrada: normalizarTexto(row.DataEntrada),
          status: normalizarTexto(row.Status),
          data_envio: normalizarTexto(row.DataEnvio),
          possuiPedido: normalizarTexto(row.PossuiPedido || "nao"),
          possuiRevisao: normalizarTexto(row.PossuiRevisao || "nao"),
          atendimentoSpot: normalizarTexto(row.AtendimentoSpot || "nao"),
          tipo_oferta: normalizarTexto(row.TipoNegocio),
          obs_geral: normalizarTexto(row.ObservacoesGerais),
          pedido: normalizarTexto(row.PossuiPedido || "nao") === "sim"
            ? {
              numero_pedido: normalizarTexto(row.NumeroPedido),
              data_po: normalizarTexto(row.DataPO),
              valor_pedido: normalizarTexto(row.ValorPedido),
              cond_pagamento: normalizarTexto(row.CondicaoPagamento),
              ref_projeto: normalizarTexto(row.RefProjetoPedido),
              tipo_produto: normalizarTexto(row.TipoProduto),
              obs: normalizarTexto(row.ObsPedido),
              data_nf: "",
              numero_nf: "",
              valor_nf: "",
              notas_fiscais: [],
              prazo_entrega_contratual: normalizarTexto(row.PrazoEntregaContratual),
              solicitacao_oc: normalizarTexto(row.SolicitacaoOC),
              ref_oc: normalizarTexto(row.RefOC),
              data_implantacao: normalizarTexto(row.DataImplantacao),
            }
            : null,
          revisao: normalizarTexto(row.PossuiRevisao || "nao") === "sim"
            ? {
              numero_oferta_anterior: normalizarTexto(row.RevisaoOfertaAnterior),
              mudou: normalizarTexto(row.RevisaoMudou),
            }
            : null,
          criadoPor: currentUser,
          atualizadoPor: currentUser,
          criadoEm: nowIso,
          atualizadoEm: nowIso,
          historico: typeof criarEventoHistorico === "function"
            ? [
              criarEventoHistorico({
                usuario: currentUser,
                acao: "Criou",
                campo: "registro",
                de: "",
                para: normalizarTexto(row.NumeroOferta) || "nova oferta",
              }),
            ]
            : [],
        };

        await db.collection("ofertas").doc(id).set(oferta);
        ofertasPorChave.set(chave, oferta);
        relatorio.ofertas.importados++;
      }

      atualizarStatusImportacao(95, "Recarregando dados do Firebase...");

      if (typeof carregarDadosDoFirebase === "function") {
        await carregarDadosDoFirebase();
      } else {
        if (typeof carregarClientesFirebase === "function") await carregarClientesFirebase();
        if (typeof carregarRepresentadasFirebase === "function") await carregarRepresentadasFirebase();
        if (typeof carregarRegistrosFirebase === "function") await carregarRegistrosFirebase();
        if (typeof carregarProjetosFirebase === "function") await carregarProjetosFirebase();
      }

      if (typeof preencherSelectRepresentadas === "function") preencherSelectRepresentadas();
      if (typeof preencherSelectResponsaveisContato === "function") preencherSelectResponsaveisContato();
      if (typeof preencherSelectResponsaveisProjeto === "function") preencherSelectResponsaveisProjeto();
      if (typeof renderTabela === "function") renderTabela();
      if (typeof renderTabelaClientes === "function") renderTabelaClientes();
      if (typeof renderTabelaRepresentadas === "function") renderTabelaRepresentadas();
      if (typeof renderTabelaProjetos === "function") renderTabelaProjetos();

      atualizarStatusImportacao(100, "Importação concluída.");

      const mensagem = montarMensagemRelatorioImportacao(relatorio);

      mostrarResultadoImportacao(
        "Importação concluída",
        mensagem,
        "sucesso",
        [...(relatorio.avisos || []), ...relatorio.erros],
        relatorio.ignoradosDetalhes || []
      );
    } catch (error) {
      console.error("Erro ao importar via Firebase:", error);

      mostrarResultadoImportacao(
        "Falha na importação",
        "Falha ao importar a planilha no Firebase.",
        "erro",
        [error?.message || "Erro inesperado durante a importação."]
      );
    } finally {
      event.target.value = "";
    }
  };

  reader.onerror = function () {
    mostrarResultadoImportacao(
      "Falha na leitura",
      "Não foi possível ler o arquivo selecionado.",
      "erro",
      ["O navegador não conseguiu ler o arquivo Excel."]
    );
    event.target.value = "";
  };

  reader.readAsArrayBuffer(file);
}

function initClientesUI() {
  document
    .getElementById("btnCancelarEdicaoCliente")
    ?.addEventListener("click", cancelarEdicaoCliente);

  document
    .getElementById("btnCancelarEdicaoContato")
    ?.addEventListener("click", cancelarEdicaoContato);

  const pageSizeClientesInput = document.getElementById("pageSizeClientes");
  if (pageSizeClientesInput) {
    const saved = parseInt(localStorage.getItem("pageSizeClientes") || "", 10);
    if (!isNaN(saved) && saved > 0) clientesPageSize = saved;

    pageSizeClientesInput.value = String(clientesPageSize);

    const apply = () => {
      const v = parseInt(pageSizeClientesInput.value, 10);
      if (!v || v < 1) return;

      clientesPageSize = Math.min(Math.max(v, 1), 200);
      localStorage.setItem("pageSizeClientes", String(clientesPageSize));
      clientesCurrentPage = 1;
      renderTabelaClientes();
    };

    pageSizeClientesInput.addEventListener("change", apply);
    pageSizeClientesInput.addEventListener("blur", apply);
    pageSizeClientesInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") apply();
    });
  }

  document.getElementById("btnPrevClientes")?.addEventListener("click", () => {
    if (clientesCurrentPage > 1) {
      clientesCurrentPage--;
      renderTabelaClientes();
    }
  });

  document.getElementById("btnNextClientes")?.addEventListener("click", () => {
    const totalPages = Math.max(
      1,
      Math.ceil(getClientesFiltrados().length / clientesPageSize),
    );
    if (clientesCurrentPage < totalPages) {
      clientesCurrentPage++;
      renderTabelaClientes();
    }
  });

  const btnAddContato = document.getElementById("btnAddContato");
  const btnSalvarCliente = document.getElementById("btnSalvarCliente");
  if (!btnAddContato || !btnSalvarCliente) {
    renderTabelaClientes();
    return;
  }

  if (btnAddContato.dataset.bound === "1") {
    renderTabelaClientes();
    return;
  }
  btnAddContato.dataset.bound = "1";

  btnAddContato.addEventListener("click", () => {
    const nome = document.getElementById("ct_nome")?.value.trim() || "";
    const telefone = document.getElementById("ct_tel")?.value.trim() || "";
    const email = document.getElementById("ct_email")?.value.trim() || "";
    const funcao = document.getElementById("ct_funcao")?.value.trim() || "";
    const principalChecked = !!document.getElementById("ct_principal")?.checked;

    const selResp = document.getElementById("ct_responsavel");
    const responsavelNome = selResp ? selResp.value : "";
    const responsavelId = responsavelNome;

    const ctNome = document.getElementById("ct_nome");
    const ctTel = document.getElementById("ct_tel");
    const ctEmail = document.getElementById("ct_email");

    const validoContato = validarCamposObrigatorios([
      { el: ctNome, nome: "Nome" },
      { el: ctTel, nome: "Telefone" },
      { el: ctEmail, nome: "E-mail" },
    ]);

    if (!validoContato) return;

    const telDigits = telefone.replace(/\D/g, "");
    if (telefone && (telDigits.length < 10 || telDigits.length > 11)) {
      const campoTel = document.getElementById("ct_tel");
      marcarErroCampo(campoTel);
      showToast("Telefone do contato inválido. Informe DDD + 8 ou 9 dígitos.", "error");
      campoTel?.focus();
      return;
    }

    const nowIso = new Date().toISOString();

    const contatoBase = {
      nome,
      telefone,
      email,
      funcao,
      principal: principalChecked,
      responsavelId,
      responsavelNome,
      criadoEm: nowIso,
      atualizadoEm: nowIso,
    };

    if (contatoBase.principal) {
      contatosTemp = contatosTemp.map((c) => ({ ...c, principal: false }));
    }

    const currentUser = getCurrentUserName();

    if (editContatoIndex === null) {
      contatoBase.historico = [
        criarEventoHistorico({
          usuario: currentUser,
          acao: "criou",
          campo: "contato",
          de: "",
          para: contatoBase.nome || "novo contato",
        }),
      ];

      contatosTemp.push(contatoBase);
    } else {
      const antigoContato = contatosTemp[editContatoIndex] || {};

      contatoBase.criadoEm = antigoContato.criadoEm || nowIso;
      contatoBase.atualizadoEm = nowIso;

      contatoBase.historico = [
        ...(antigoContato.historico || []),
        ...montarHistoricoAlteracoesContato(
          antigoContato,
          contatoBase,
          currentUser,
        ),
      ];

      contatosTemp[editContatoIndex] = contatoBase;

      editContatoIndex = null;
      btnAddContato.textContent = "Adicionar Contato";
      document
        .getElementById("btnCancelarEdicaoContato")
        ?.classList.add("hidden");
    }

    document.getElementById("ct_nome").value = "";
    document.getElementById("ct_tel").value = "";
    document.getElementById("ct_email").value = "";
    document.getElementById("ct_funcao").value = "";
    document.getElementById("ct_principal").checked = false;
    document.getElementById("ct_responsavel").value = "";

    renderListaContatos();
  });

  const mapaCamposCliente = {
    razao: "razão social",
    cnpj: "CNPJ",
    ie: "inscrição estadual",
    endereco: "endereço",
    segmento: "segmento",
    sap: "código SAP",
  };

  btnSalvarCliente.addEventListener("click", async () => {
    const razao = document.getElementById("cli_razao")?.value.trim() || "";
    const cnpj = document.getElementById("cli_cnpj")?.value.trim() || "";
    const ie = document.getElementById("cli_ie")?.value.trim() || "";
    const endereco =
      document.getElementById("cli_endereco")?.value.trim() || "";
    const segmento =
      document.getElementById("cli_segmento")?.value.trim() || "";
    const sap = document.getElementById("cli_sap")?.value.trim() || "";
    const currentUser = getCurrentUserName();
    const nowIso = new Date().toISOString();

    const cliRazao = document.getElementById("cli_razao");
    const cliCnpj = document.getElementById("cli_cnpj");
    const cliSegmento = document.getElementById("cli_segmento");

    const validoCliente = validarCamposObrigatorios([
      { el: cliRazao, nome: "Razão Social" },
      { el: cliCnpj, nome: "CNPJ" },
      { el: cliSegmento, nome: "Segmento" },
    ]);

    if (!validoCliente) return;

    const cliCnpjEl = document.getElementById("cli_cnpj");
    if (!validarCNPJ(cnpj)) {
      marcarErroCampo(cliCnpjEl);
      showToast("CNPJ inválido. Verifique os números informados.", "error");
      cliCnpjEl?.focus();
      return;
    }

    if (contatosTemp.length > 0 && !contatosTemp.some((c) => c.principal)) {
      contatosTemp[0].principal = true;
    }

    const clienteBase = {
      razao,
      cnpj,
      ie,
      endereco,
      segmento,
      sap,
      responsavelEmail: (window.auth?.currentUser?.email || "").toLowerCase(),
      contatos: obterItensTemporariosAtivos(contatosTemp).map((ct) => ({ ...ct })),
    };

    try {
      if (!editClienteId) {
        // Detecção de CNPJ duplicado em clientes
        const _cnpjCliente = (cnpj || "").replace(/\D/g, "");
        const _clienteDup = clientes.find(
          (c) => !c.deletado && (c.cnpj || "").replace(/\D/g, "") === _cnpjCliente,
        );
        if (_clienteDup) {
          const msg =
            `Este CNPJ já está cadastrado em outro cliente.\n\n` +
            `Razão Social: ${_clienteDup.razao || "-"}\n` +
            `CNPJ: ${_clienteDup.cnpj || "-"}`;
          const acao = await showDuplicataAviso(msg, { title: "CNPJ já cadastrado" });
          if (acao === "ver") {
            verCliente(_clienteDup.id);
            return;
          }
        }

        const id = gerarId();
        const cliente = {
          id,
          ...clienteBase,
          criadoPor: currentUser,
          atualizadoPor: currentUser,
          criadoEm: nowIso,
          atualizadoEm: nowIso,
          historico: [
            criarEventoHistorico({
              usuario: currentUser,
              acao: "Criou",
              campo: "cliente",
              de: "",
              para: clienteBase.razao || "novo cliente",
            }),
          ],
        };
        await db.collection("clientes").doc(id).set(cliente);
        clientes.push(cliente);
        showToast("Cliente salvo!", "success");
      } else {
        const idx = clientes.findIndex((c) => c.id === editClienteId);
        const antigo = clientes[idx] || {};

        const eventosHistoricoBase = montarEventosHistorico(
          antigo,
          clienteBase,
          currentUser,
          mapaCamposCliente,
        );

        const eventosHistorico = [...eventosHistoricoBase];

        if (idx !== -1) {
          const cliente = {
            id: editClienteId,
            ...clienteBase,
            criadoPor: antigo.criadoPor || currentUser,
            atualizadoPor: currentUser,
            criadoEm: antigo.criadoEm || nowIso,
            atualizadoEm: nowIso,
            historico: [...(antigo.historico || []), ...eventosHistorico],
          };
          await db.collection("clientes").doc(editClienteId).set(cliente);
          clientes[idx] = cliente;
          atualizarSugestoesCnpj();
        }

        showToast("Cliente atualizado!", "success");
        editClienteId = null;
        btnSalvarCliente.textContent = "Salvar Cliente";
        document
          .getElementById("btnCancelarEdicaoCliente")
          ?.classList.add("hidden");
      }

      salvarClientes();

      contatosTemp = [];
      editContatoIndex = null;

      btnAddContato.textContent = "Adicionar Contato";
      document
        .getElementById("btnCancelarEdicaoContato")
        ?.classList.add("hidden");

      renderListaContatos();
      renderTabelaClientes();

      document.getElementById("cli_razao").value = "";
      document.getElementById("cli_cnpj").value = "";
      document.getElementById("cli_ie").value = "";
      document.getElementById("cli_endereco").value = "";
      document.getElementById("cli_segmento").value = "";
      document.getElementById("cli_sap").value = "";
    } catch (e) {
      console.error(e);
      showToast("Erro ao salvar cliente: " + (e?.message || e), "error");
    }
  });

  document
    .getElementById("btnAddFiltroCliente")
    ?.addEventListener("click", () => {
      addFiltroClienteRow();
    });

  document
    .getElementById("btnLimparFiltrosClientes")
    ?.addEventListener("click", () => {
      const wrap = document.getElementById("filtersClientes");
      if (wrap) wrap.innerHTML = "";
      clientesCurrentPage = 1;
      renderTabelaClientes();
    });

  if (!document.querySelector("#filtersClientes .filter-item")) {
    addFiltroClienteRow();
  }

  renderTabelaClientes();

  bindGotoPage(
    "gotoPageClientes",
    () =>
      Math.max(1, Math.ceil(getClientesFiltrados().length / clientesPageSize)),
    (page) => {
      clientesCurrentPage = page;
      renderTabelaClientes();
    },
  );
}

function renderListaContatos() {
  const lista = document.getElementById("listaContatos");
  if (!lista) return;

  const contatosAtivos = obterItensTemporariosAtivos(contatosTemp);

  lista.innerHTML = "";

  contatosAtivos.forEach((ct, index) => {
    const div = document.createElement("div");
    div.innerHTML = `
      <span>${esc(ct.nome)} - ${esc(ct.email)}</span>
      <button type="button" onclick="editarContato(${index})">Editar</button>
      <button type="button" onclick="excluirContato(${index})">Excluir</button>
    `;
    lista.appendChild(div);
  });

  renderMiniLixeiraContatos();
}

function editarContato(index) {
  const ativos = obterItensTemporariosAtivos(contatosTemp);
  const ct = ativos[index];
  if (!ct) return;

  const indiceReal = contatosTemp.indexOf(ct);
  if (indiceReal < 0) return;

  document.getElementById("ct_nome").value = ct.nome || "";
  document.getElementById("ct_tel").value = ct.telefone || "";
  document.getElementById("ct_email").value = ct.email || "";
  document.getElementById("ct_funcao").value = ct.funcao || "";
  document.getElementById("ct_principal").checked = !!ct.principal;
  document.getElementById("ct_responsavel").value = ct.responsavelId || "";

  editContatoIndex = indiceReal;
  document.getElementById("btnAddContato").textContent = "Salvar Edição";
  document.getElementById("btnCancelarEdicaoContato")?.classList.remove("hidden");
}

/**
 * Lógica unificada de exclusão de contato temporário.
 * Usada por excluirContato (clientes) e excluirContatoProjeto (projetos).
 */
async function excluirContatoGenerico({ lista, indiceAtivo, labelTipo, btnId, renderFn, renderLixeiraFn, resetEditIndex }) {
  const ativos = obterItensTemporariosAtivos(lista);
  const ct = ativos[indiceAtivo];
  if (!ct) return;

  const indiceReal = lista.indexOf(ct);
  if (indiceReal < 0) return;

  if (!await showConfirm(`Tem certeza que deseja mover este ${labelTipo} para a mini lixeira?`, { title: "Mover para Lixeira", confirmText: "Mover" })) return;

  const currentUser = getCurrentUserName();
  marcarItemTemporarioComoRemovido(lista, indiceReal, labelTipo);

  lista.historicoRemocoes = lista.historicoRemocoes || [];
  lista.historicoRemocoes.push(
    criarEventoHistorico({ usuario: currentUser, acao: "removeu", campo: labelTipo, de: resumoContatoHistorico(ct), para: "" }),
  );

  resetEditIndex();
  const btnEl = document.getElementById(btnId);
  if (btnEl) btnEl.textContent = "Adicionar Contato";

  renderFn();
  renderLixeiraFn();
}

function excluirContato(index) {
  excluirContatoGenerico({
    lista: contatosTemp,
    indiceAtivo: index,
    labelTipo: "contato",
    btnId: "btnAddContato",
    renderFn: renderListaContatos,
    renderLixeiraFn: renderMiniLixeiraContatos,
    resetEditIndex: () => { editContatoIndex = null; },
  });
}

function renderTabelaClientes() {
  const tbody = DOM.tabelaClientesTbody || document.querySelector("#tabelaClientes tbody");
  const pageInfoClientes = DOM.pageInfoClientes || document.getElementById("pageInfoClientes");
  if (!tbody) return;

  tbody.innerHTML = "";

  const filtrados = getClientesFiltrados();
  const listaOrdenada =
    ordemClientes === "asc" ? [...filtrados] : [...filtrados].reverse();
  const countEl = DOM.clientesCount || document.getElementById("clientesCount");
  if (countEl) countEl.textContent = `${filtrados.length} cliente(s) encontrado(s)`;

  const { pageData, totalPages, start, safePage } = getPaginatedData(listaOrdenada, clientesCurrentPage, clientesPageSize);
  clientesCurrentPage = safePage;

  if (pageData.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 9;
    td.textContent = "Nenhum cliente encontrado.";
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    const ofertasPorCnpj = {};
    filtrarPorPermissao(registros).forEach((r) => {
      const cnpj = (r.cnpj_cliente || "").replace(/\D/g, "");
      if (cnpj) ofertasPorCnpj[cnpj] = (ofertasPorCnpj[cnpj] || 0) + 1;
    });

    pageData.forEach((cli, index) => {
      const tr = document.createElement("tr");
      const qtdContatos = cli.contatos ? cli.contatos.length : 0;
      const usuario = formatarNomeUsuario(
        cli.atualizadoPor || cli.criadoPor || "-",
      );

      const cnpjClean = (cli.cnpj || "").replace(/\D/g, "");
      const qtdOfertas = ofertasPorCnpj[cnpjClean] || 0;

      tr.innerHTML = `
<td>${ordemClientes === "asc"
          ? start + index + 1
          : listaOrdenada.length - (start + index)
        }</td>
        <td>${esc(cli.razao)}</td>
        <td>${esc(cli.cnpj)}</td>
        <td>${esc(cli.segmento)}</td>
        <td>${esc(cli.sap)}</td>
        <td class="col-center">${qtdOfertas}</td>
        <td class="col-center">${qtdContatos}</td>
        <td>${usuario}</td>
        <td style="text-align:center;">
          <button class="btn-kebab" onclick="openActionsMenu(event,'cliente','${cli.id}')">...</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  if (pageInfoClientes)
    pageInfoClientes.textContent = `Página ${clientesCurrentPage} de ${totalPages}`;

  const seta = document.getElementById("setaOrdemClientes");
  if (seta) seta.textContent = ordemClientes === "asc" ? "↑" : "↓";
}

function bindGotoPage(inputId, getTotalPages, setPageAndRender) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const go = () => {
    const page = parseInt(input.value, 10);
    if (!page || page < 1) return;

    const total = getTotalPages();
    const target = Math.min(page, total);

    setPageAndRender(target);
    input.value = "";
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") go();
  });

  input.addEventListener("blur", () => {
    if (input.value.trim() !== "") go();
  });
}

function editarCliente(id) {
  const cli = clientes.find((c) => c.id === id);
  if (!cli) return;

  editClienteId = id;

  document.getElementById("cli_razao").value = cli.razao || "";
  document.getElementById("cli_cnpj").value = cli.cnpj || "";
  document.getElementById("cli_ie").value = cli.ie || "";
  document.getElementById("cli_endereco").value = cli.endereco || "";
  document.getElementById("cli_segmento").value = cli.segmento || "";
  document.getElementById("cli_sap").value = cli.sap || "";

  contatosTemp = (cli.contatos || []).map((ct) => ({ ...ct }));
  editContatoIndex = null;

  document.getElementById("btnAddContato").textContent = "Adicionar Contato";
  renderListaContatos();
  renderMiniLixeiraContatos();

  const btnSalvarCliente = document.getElementById("btnSalvarCliente");
  if (btnSalvarCliente) btnSalvarCliente.textContent = "Salvar Edição";

  document.getElementById("secClientes").scrollIntoView({ behavior: "smooth" });
  document
    .getElementById("btnCancelarEdicaoCliente")
    ?.classList.remove("hidden");
}

async function excluirCliente(id) {
  const cliente = clientes.find((c) => c.id === id);
  if (!cliente) return;

  const nomeExibicao = cliente.razao || cliente.nome || "Cliente";

  const ofertasAtivas = registros.filter((r) =>
    !r.deletado &&
    ((r.clienteId && r.clienteId === id) || (!r.clienteId && r.cnpj_cliente === cliente.cnpj))
  );
  if (ofertasAtivas.length > 0) {
    const lista = ofertasAtivas.slice(0, 3)
      .map((r) => `• ${r.razao || r.cnpj_cliente} — Oferta ${r.oferta || r.id}`)
      .join("\n");
    const mais = ofertasAtivas.length > 3 ? `\n...e mais ${ofertasAtivas.length - 3} oferta(s)` : "";
    await showConfirm(
      `Não é possível mover "${nomeExibicao}" para a lixeira.\n\nHá ${ofertasAtivas.length} oferta(s) ativa(s) vinculada(s):\n${lista}${mais}\n\nMova ou finalize essas ofertas primeiro.`,
      { title: "Cliente com Ofertas Ativas", confirmText: "Entendido" }
    );
    return;
  }

  if (!await showConfirm("Tem certeza que deseja mover este cliente para a lixeira?\n\nVocê poderá restaurá-lo em até 7 dias.", { title: "Mover para Lixeira", confirmText: "Mover" })) return;

  try {
    await moverParaLixeira({
      colecao: "clientes",
      id,
      tipo: "cliente",
      nomeExibicao,
    });

    clientes = clientes.filter((c) => c.id !== id);
    salvarClientes?.();
    renderTabelaClientes?.();

    mostrarToastDesfazer({
      mensagem: "Cliente movido para a lixeira.",
      onUndo: async () => {
        await restaurarDaLixeira("clientes", id);
        await recarregarDadosPrincipais();
      },
    });
  } catch (e) {
    console.error(e);
    showToast("Erro ao mover cliente para a lixeira.", "error");
  }
}

function abrirPainelCliente(id) {
  const cli = clientes.find((c) => c.id === id);
  if (!cli) return;

  const painel = document.getElementById("painelCliente");
  document.getElementById("painelClienteNome").textContent = cli.razao || "";
  document.getElementById("painelClienteCnpj").textContent = cli.cnpj || "";
  document.getElementById("painelClienteSegmento").textContent =
    cli.segmento || "";
  document.getElementById("painelClienteEndereco").textContent =
    cli.endereco || "";

  const divContatos = document.getElementById("painelClienteContatos");
  divContatos.innerHTML = "";

  (cli.contatos || []).forEach((ct) => {
    const div = document.createElement("div");
    div.className = "contato-item";
    div.innerHTML = `
      <strong>${esc(ct.nome)}</strong>
      ${ct.principal ? '<span class="tag-principal">(Principal)</span>' : ""}
      <br>
      ${esc(ct.funcao || "")}
      <br>
      Tel: ${esc(ct.telefone || "")} • E-mail: ${esc(ct.email || "")}
      ${ct.responsavelNome
        ? `<br><strong>Responsável:</strong> ${esc(primeiroNome(ct.responsavelNome))}`
        : ""
      }
      <hr>
    `;
    divContatos.appendChild(div);
  });

  painel.classList.remove("hidden");
}

function fecharPainelCliente() {
  const painel = document.getElementById("painelCliente");
  if (painel) painel.classList.add("hidden");
}

function buscarClientePorCnpj(cnpj) {
  const clean = (cnpj || "").replace(/\D/g, "");
  return clientes.find((c) => (c.cnpj || "").replace(/\D/g, "") === clean);
}

function popularDatalistsCamposContato(cnpj) {
  const nomes = new Set();
  const telefones = new Set();
  const emails = new Set();

  const cnpjClean = (cnpj || "").replace(/\D/g, "");

  // Contatos cadastrados do cliente
  if (cnpjClean) {
    const cli = buscarClientePorCnpj(cnpj);
    if (cli && Array.isArray(cli.contatos)) {
      cli.contatos.forEach((ct) => {
        if (ct.nome) nomes.add(ct.nome.trim());
        if (ct.telefone) telefones.add(ct.telefone.trim());
        if (ct.email) emails.add(ct.email.trim().toLowerCase());
      });
    }
  }

  // Valores de ofertas anteriores (filtradas pelo cliente se CNPJ informado)
  const base = cnpjClean
    ? registros.filter((r) => (r.cnpj_cliente || "").replace(/\D/g, "") === cnpjClean)
    : registros;

  base.forEach((r) => {
    if (r.solicitante) nomes.add(r.solicitante.trim());
    if (r.telefone) telefones.add(r.telefone.trim());
    if (r.email) emails.add(r.email.trim().toLowerCase());
  });

  const preencher = (id, valores) => {
    const dl = document.getElementById(id);
    if (!dl) return;
    dl.innerHTML = [...valores].map((v) => `<option value="${esc(v)}">`).join("");
  };

  preencher("listSolicitantes", nomes);
  preencher("listTelefones", telefones);
  preencher("listEmails", emails);
}

function initLigacaoClienteOferta() {
  const cnpjInput = document.getElementById("cnpj_cliente");
  if (!cnpjInput || cnpjInput.dataset.bound_blur) return;
  cnpjInput.dataset.bound_blur = "1";

  cnpjInput.addEventListener("blur", () => {
    const cli = buscarClientePorCnpj(cnpjInput.value);
    if (!cli) {
      cnpjInput.dataset.clienteId = "";
      popularDatalistsCamposContato("");
      return;
    }
    cnpjInput.dataset.clienteId = cli.id;
    const razao = document.getElementById("razao");
    if (razao) razao.value = cli.razao || "";
    popularDatalistsCamposContato(cnpjInput.value);
  });
}

function initRepresentadasUI() {
  const btn = document.getElementById("btnSalvarRepresentada");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const nome = document.getElementById("rep_nome").value.trim();
    const currentUser = getCurrentUserName();
    const nowIso = new Date().toISOString();

    if (!nome) {
      showToast("Informe o nome da representada.", "error");
      return;
    }

    if (!editRepresentadaId) {
      const id = gerarId();
      const rep = {
        id,
        nome,
        criadoPor: currentUser,
        atualizadoPor: currentUser,
        responsavelEmail: (window.auth?.currentUser?.email || "").toLowerCase(),
        criadoEm: nowIso,
        atualizadoEm: nowIso,
        historico: [
          criarEventoHistorico({
            usuario: currentUser,
            acao: "Criou",
            campo: "representada",
            de: "",
            para: nome,
          }),
        ],
      };
      await db.collection("representadas").doc(id).set(rep);
      representadas.push(rep);
      showToast("Representada salva!", "success");
    } else {
      const idx = representadas.findIndex((r) => r.id === editRepresentadaId);
      const antigo = representadas[idx] || {};
      const eventosHistorico = [];

      if (compararValoresHistorico(antigo.nome, nome)) {
        eventosHistorico.push(
          criarEventoHistorico({
            usuario: currentUser,
            acao: "alterou",
            campo: "nome",
            de: antigo.nome,
            para: nome,
          }),
        );
      }

      if (idx !== -1) {
        const rep = {
          id: editRepresentadaId,
          nome,
          criadoPor: antigo.criadoPor || currentUser,
          atualizadoPor: currentUser,
          responsavelEmail:
            antigo.responsavelEmail ||
            (window.auth?.currentUser?.email || "").toLowerCase(),
          criadoEm: antigo.criadoEm || nowIso,
          atualizadoEm: nowIso,
          historico: [...(antigo.historico || []), ...eventosHistorico],
        };
        await db.collection("representadas").doc(editRepresentadaId).set(rep);
        representadas[idx] = rep;
      }

      registros.forEach((reg) => {
        if (reg.representadaId === editRepresentadaId)
          reg.representadaNome = nome;
      });
      salvarRegistros();

      showToast("Representada atualizada!", "success");
      editRepresentadaId = null;
      btn.textContent = "Salvar Representada";
      document
        .getElementById("btnCancelarEdicaoRepresentada")
        ?.classList.add("hidden");
    }

    salvarRepresentadas();
    document.getElementById("rep_nome").value = "";
    renderTabelaRepresentadas();
    preencherSelectRepresentadas();
  });
  document
    .getElementById("searchRepresentadas")
    ?.addEventListener("input", renderTabelaRepresentadasDebounced);

  const pageSizeRepInput = document.getElementById("pageSizeRepresentadas");
  if (pageSizeRepInput) {
    const saved = parseInt(
      localStorage.getItem("pageSizeRepresentadas") || "",
      10,
    );
    if (!isNaN(saved) && saved > 0) representadasPageSize = saved;
    pageSizeRepInput.value = String(representadasPageSize);

    const apply = () => {
      const v = parseInt(pageSizeRepInput.value, 10);
      if (!v || v < 1) return;
      representadasPageSize = Math.min(Math.max(v, 1), 200);
      localStorage.setItem(
        "pageSizeRepresentadas",
        String(representadasPageSize),
      );
      representadasCurrentPage = 1;
      renderTabelaRepresentadas();
    };

    pageSizeRepInput.addEventListener("change", apply);
    pageSizeRepInput.addEventListener("blur", apply);
    pageSizeRepInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") apply();
    });
  }

  document
    .getElementById("btnPrevRepresentadas")
    ?.addEventListener("click", () => {
      if (representadasCurrentPage > 1) {
        representadasCurrentPage--;
        renderTabelaRepresentadas();
      }
    });

  document
    .getElementById("btnNextRepresentadas")
    ?.addEventListener("click", () => {
      const totalPages = Math.max(
        1,
        Math.ceil(getRepresentadasFiltradas().length / representadasPageSize),
      );

      if (representadasCurrentPage < totalPages) {
        representadasCurrentPage++;
        renderTabelaRepresentadas();
      }
    });
}

function renderTabelaRepresentadas() {
  const tbody = DOM.tabelaRepresentadasTbody || document.querySelector("#tabelaRepresentadas tbody");
  if (!tbody) return;

  representadas.sort((a, b) =>
    String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", {
      sensitivity: "base",
    }),
  );

  tbody.innerHTML = "";

  const filtrados = getRepresentadasFiltradas();
  const listaOrdenada =
    ordemRepresentadas === "asc" ? [...filtrados] : [...filtrados].reverse();

  const { pageData, totalPages, start, safePage } = getPaginatedData(listaOrdenada, representadasCurrentPage, representadasPageSize);
  representadasCurrentPage = safePage;

  if (!pageData.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent = "Nenhuma representada encontrada.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  pageData.forEach((rep, index) => {
    const usuario = formatarNomeUsuario(
      rep.atualizadoPor || rep.criadoPor || "",
    );
    const qtdOfertas = filtrarPorPermissao(registros).filter(
      (r) => r.representadaId === rep.id,
    ).length;

    const tr = document.createElement("tr");
    tr.innerHTML = `
<td>${ordemRepresentadas === "asc"
        ? start + index + 1
        : listaOrdenada.length - (start + index)
      }</td>
      <td>${esc(rep.nome)}</td>
      <td class="col-center">${qtdOfertas}</td>
      <td>${esc(usuario)}</td>
      <td style="text-align:center;">
        <button class="btn-kebab" onclick="openActionsMenu(event,'rep','${rep.id}')">...</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const pageInfo = DOM.pageInfoRepresentadas || document.getElementById("pageInfoRepresentadas");
  if (pageInfo)
    pageInfo.textContent = `Página ${representadasCurrentPage} de ${totalPages}`;

  const seta = document.getElementById("setaOrdemRepresentadas");
  if (seta) seta.textContent = ordemRepresentadas === "asc" ? "↑" : "↓";
}

function preencherSelectRepresentadas() {
  const select = document.getElementById("representada");
  if (!select) return;

  select.innerHTML = `<option value="">Selecione</option>`;

  const representadasOrdenadas = [...representadas].sort((a, b) =>
    String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", {
      sensitivity: "base",
    }),
  );

  representadasOrdenadas.forEach((rep) => {
    const option = document.createElement("option");
    option.value = rep.id;
    option.textContent = rep.nome;
    select.appendChild(option);
  });
}

function editarRepresentada(id) {
  const rep = representadas.find((r) => r.id === id);
  if (!rep) return;

  editRepresentadaId = id;
  document.getElementById("rep_nome").value = rep.nome || "";

  const btn = document.getElementById("btnSalvarRepresentada");
  if (btn) btn.textContent = "Salvar Edição";

  document
    .getElementById("secRepresentadas")
    .scrollIntoView({ behavior: "smooth" });
  document
    .getElementById("btnCancelarEdicaoRepresentada")
    ?.classList.remove("hidden");
}

async function excluirRepresentada(id) {
  const representada = representadas.find((r) => r.id === id);
  if (!representada) return;

  const nomeExibicao =
    representada.nome || representada.razao || "Representada";

  const ofertasAtivas = registros.filter((r) => !r.deletado && r.representadaId === id);
  if (ofertasAtivas.length > 0) {
    const lista = ofertasAtivas.slice(0, 3)
      .map((r) => `• ${r.razao || r.cnpj_cliente} — Oferta ${r.oferta || r.id}`)
      .join("\n");
    const mais = ofertasAtivas.length > 3 ? `\n...e mais ${ofertasAtivas.length - 3} oferta(s)` : "";
    await showConfirm(
      `Não é possível mover "${nomeExibicao}" para a lixeira.\n\nHá ${ofertasAtivas.length} oferta(s) ativa(s) vinculada(s):\n${lista}${mais}\n\nMova ou finalize essas ofertas primeiro.`,
      { title: "Representada com Ofertas Ativas", confirmText: "Entendido" }
    );
    return;
  }

  if (!await showConfirm("Tem certeza que deseja mover esta representada para a lixeira?\n\nVocê poderá restaurá-la em até 7 dias.", { title: "Mover para Lixeira", confirmText: "Mover" })) return;

  try {
    await moverParaLixeira({
      colecao: "representadas",
      id,
      tipo: "representada",
      nomeExibicao,
    });

    representadas = representadas.filter((r) => r.id !== id);
    salvarRepresentadas?.();
    renderTabelaRepresentadas?.();
    preencherSelectRepresentadas?.();

    mostrarToastDesfazer({
      mensagem: "Representada movida para a lixeira.",
      onUndo: async () => {
        await restaurarDaLixeira("representadas", id);
        await recarregarDadosPrincipais();
      },
    });
  } catch (e) {
    console.error(e);
    showToast("Erro ao mover representada para a lixeira.", "error");
  }
}

function verOferta(id) {
  const reg = registros.find((r) => r.id === id);
  if (!reg) return;


  historicoAtualModal = reg.historico || [];

  const pedido = reg.pedido || {};
  const revisao = reg.revisao || {};
  const usuario = formatarNomeUsuario(
    reg.atualizadoPor || reg.criadoPor || "-",
  );

  const tipoRaw = String(reg.tipo_oferta ?? "")
    .trim()
    .toLowerCase();

  const tipoNorm = tipoRaw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const tipoTexto =
    tipoNorm === "compra"
      ? "Compra"
      : tipoNorm === "orcamento"
        ? "Orçamento"
        : tipoRaw
          ? reg.tipo_oferta
          : "-";

  const criadoPor = formatarNomeUsuario(reg.criadoPor || "-");
  const atualizadoPor = formatarNomeUsuario(reg.atualizadoPor || reg.criadoPor || "-");

  function field(label, value, full) {
    if (!value && value !== 0) return "";
    return '<div class="md-detail-field' + (full ? ' md-detail-field--full' : '') + '">' +
      '<div class="md-detail-field-label">' + label + '</div>' +
      '<div class="md-detail-field-value">' + value + '</div>' +
      '</div>';
  }
  function section(title, fieldsHtml) {
    if (!fieldsHtml.trim()) return "";
    return '<div class="md-detail-section">' +
      '<div class="md-detail-section-title">' + title + '</div>' +
      '<div class="md-detail-grid">' + fieldsHtml + '</div>' +
      '</div>';
  }

  let html = section("Identificação",
    field("N° Oferta", esc(reg.oferta) || "-") +
    field("Tipo", esc(tipoTexto)) +
    field("Atendimento Spot?", reg.atendimentoSpot === "sim" ? "Sim" : "Não") +
    field("Data Entrada", formatDateBR(reg.data_entrada) || "-") +
    field("Data Envio", formatDateBR(reg.data_envio) || "") +
    field("B.U.", esc(reg.bu) || "") +
    field("Segmento", esc(reg.segmento) || "")
  );

  html += section("Cliente",
    field("Razão Social", esc(reg.razao) || "-") +
    field("CNPJ", esc(reg.cnpj_cliente) || "-") +
    field("Solicitante", esc(reg.solicitante) || "") +
    field("Telefone", esc(reg.telefone) || "") +
    field("E-mail", esc(reg.email) || "") +
    field("Ref. do Cliente", esc(reg.ref_cliente) || "")
  );

  html += section("Proposta",
    field("Representada", esc(reg.representadaNome) || "-") +
    field("Valor Total", esc(reg.valor_total) || "-") +
    field("Status", esc(reg.status) || "-") +
    (reg.status === "Perdido" && reg.motivo_perda ? field("Motivo da Perda", esc(reg.motivo_perda), true) : "") +
    field("Projeto", esc(reg.nome_projeto) || "") +
    (String(reg.representadaNome || "").toLowerCase().includes("mantex") && reg.unidade ? field("Unidade", esc(reg.unidade)) : "") +
    (reg.obs_geral && String(reg.obs_geral).trim() ? field("Observações Gerais", esc(reg.obs_geral).replace(/\n/g, "<br>"), true) : "")
  );

  if (reg.possuiPedido === "sim") {
    const nfHtml = formatarNotasFiscaisHtml(pedido);
    html += section("Pedido",
      field("N° Pedido", pedido.numero_pedido || "") +
      field("Data P.O.", formatDateBR(pedido.data_po) || "") +
      field("Valor Pedido", pedido.valor_pedido || "") +
      field("Cond. Pagamento", pedido.cond_pagamento || "") +
      field("Ref./Projeto", pedido.ref_projeto || "") +
      field("Tipo de Produto", pedido.tipo_produto || "") +
      field("Prazo Entrega Contratual", formatDateBR(pedido.prazo_entrega_contratual) || "") +
      field("Entregue", pedido.entregue === "sim" ? "Sim" : "Não") +
      field("SOV?", pedido.solicitacao_oc === "sim" ? "Sim" : "Não") +
      field("Ref. OV", pedido.ref_oc || "") +
      field("Data Implantação", formatDateBR(pedido.data_implantacao) || "") +
      (pedido.obs ? field("Obs. Pedido", esc(pedido.obs).replace(/\n/g, "<br>"), true) : "") +
      (nfHtml ? '<div class="md-detail-field md-detail-field--full"><div class="md-detail-field-label">Notas Fiscais</div><div class="md-detail-field-value">' + nfHtml + '</div></div>' : "")
    );
  }

  if (reg.possuiRevisao === "sim") {
    html += section("Revisão",
      field("N° Oferta Anterior", revisao.numero_oferta_anterior || "") +
      field("O que mudou", (revisao.mudou || "-").toString().replace(/\n/g, "<br>"), true)
    );
  }

  html += section("Histórico",
    field("Criado em", formatDateTimeBR(reg.criadoEm)) +
    field("Criado por", criadoPor) +
    field("Atualizado em", formatDateTimeBR(reg.atualizadoEm)) +
    field("Atualizado por", atualizadoPor)
  );

  const _ofertaLabel = escapeHtml(reg.oferta || "");
  html += '<div class="md-history-section"><button type="button" class="secondary" onclick="abrirHistoricoAtual(\'' + 'Histórico da Oferta ' + _ofertaLabel + '\')">' +
    'Visualizar histórico de atividades</button></div>';
  abrirModal(`Oferta ${reg.oferta || ""}`, html, () => editarRegistro(id));
}

function verCliente(id) {
  const cli = clientes.find((c) => c.id === id);
  if (!cli) return;

  historicoAtualModal = cli.historico || [];

  const totalOfertas = registros.filter(
    (r) =>
      (r.clienteId && r.clienteId === cli.id) ||
      (!r.clienteId && r.cnpj_cliente === cli.cnpj),
  ).length;

  const usuario = formatarNomeUsuario(
    cli.atualizadoPor || cli.criadoPor || "-",
  );

  function field(label, value, full) {
    if (!value && value !== 0) return "";
    return '<div class="md-detail-field' + (full ? ' md-detail-field--full' : '') + '">' +
      '<div class="md-detail-field-label">' + label + '</div>' +
      '<div class="md-detail-field-value">' + value + '</div>' +
      '</div>';
  }
  function section(title, fieldsHtml) {
    if (!fieldsHtml.trim()) return "";
    return '<div class="md-detail-section">' +
      '<div class="md-detail-section-title">' + title + '</div>' +
      '<div class="md-detail-grid">' + fieldsHtml + '</div>' +
      '</div>';
  }

  let html = section("Cadastro",
    field("Razão Social", esc(cli.razao) || "-") +
    field("CNPJ", esc(cli.cnpj) || "-") +
    field("Inscrição Estadual", esc(cli.ie) || "") +
    field("Segmento", esc(cli.segmento) || "") +
    field("Endereço", esc(cli.endereco) || "") +
    field("Código SAP", esc(cli.codigo_sap || cli.sap) || "") +
    field("Ofertas Cadastradas", String(totalOfertas))
  );

  if (cli.contatos && cli.contatos.length) {
    html += '<div class="md-detail-section"><div class="md-detail-section-title">Contatos</div>';
    cli.contatos.forEach((ct) => {
      html += '<div class="md-contact-card">' +
        '<div class="md-contact-name">' + (esc(ct.nome) || "-") +
          (ct.principal ? '<span class="modal-badge">Principal</span>' : "") +
        '</div>' +
        '<div class="md-contact-detail">' +
          (ct.funcao ? 'Função: ' + esc(ct.funcao) + '<br>' : "") +
          (ct.telefone ? 'Tel: ' + esc(ct.telefone) + '<br>' : "") +
          (ct.email ? 'E-mail: ' + esc(ct.email) + '<br>' : "") +
          (ct.responsavelNome ? 'Responsável: ' + esc(primeiroNome(ct.responsavelNome)) : "") +
        '</div></div>';
    });
    html += '</div>';
  } else {
    html += section("Contatos", field("Status", "Nenhum contato cadastrado.", true));
  }

  html += section("Histórico",
    field("Responsável", formatarNomeUsuario(cli.atualizadoPor || cli.criadoPor || "-")) +
    field("Criado em", formatDateTimeBR(cli.criadoEm)) +
    field("Atualizado em", formatDateTimeBR(cli.atualizadoEm))
  );

  const _cliLabel = escapeHtml(cli.razao || "");
  html += '<div class="md-history-section"><button type="button" class="secondary" onclick="abrirHistoricoAtual(\'' + 'Histórico do Cliente ' + _cliLabel + '\')">' +
    'Visualizar histórico de atividades</button></div>';
  abrirModal(`Cliente - ${cli.razao || ""}`, html, () => editarCliente(id));
}

function verRepresentada(id) {
  const rep = representadas.find((r) => r.id === id);
  if (!rep) return;

  historicoAtualModal = rep.historico || [];

  const usuario = formatarNomeUsuario(
    rep.atualizadoPor || rep.criadoPor || "-",
  );
  const qtdOfertas = registros.filter((r) => r.representadaId === id).length;

  function field(label, value, full) {
    if (!value && value !== 0) return "";
    return '<div class="md-detail-field' + (full ? ' md-detail-field--full' : '') + '">' +
      '<div class="md-detail-field-label">' + label + '</div>' +
      '<div class="md-detail-field-value">' + value + '</div>' +
      '</div>';
  }
  function section(title, fieldsHtml) {
    if (!fieldsHtml.trim()) return "";
    return '<div class="md-detail-section">' +
      '<div class="md-detail-section-title">' + title + '</div>' +
      '<div class="md-detail-grid">' + fieldsHtml + '</div>' +
      '</div>';
  }

  const html = section("Cadastro",
    field("Nome da Representada", esc(rep.nome) || "-") +
    field("Ofertas Vinculadas", String(qtdOfertas)) +
    field("Responsável", esc(usuario)) +
    field("Criado em", formatDateTimeBR(rep.criadoEm)) +
    field("Atualizado em", formatDateTimeBR(rep.atualizadoEm))
  ) +
  '<div class="md-history-section"><button type="button" class="secondary" onclick="abrirHistoricoAtual(\'' + 'Histórico da Representada ' + escapeHtml(rep.nome || '') + '\')">' +
  'Visualizar histórico de atividades</button></div>';
  abrirModal(`Representada - ${rep.nome || ""}`, html, () => editarRepresentada(id));
}

function formatCnpjMask(digits) {
  const v = String(digits || "")
    .replace(/\D/g, "")
    .slice(0, 14);
  if (v.length <= 2) return v;
  if (v.length <= 5) return v.replace(/^(\d{2})(\d+)/, "$1.$2");
  if (v.length <= 8) return v.replace(/^(\d{2})(\d{3})(\d+)/, "$1.$2.$3");
  if (v.length <= 12)
    return v.replace(/^(\d{2})(\d{3})(\d{3})(\d+)/, "$1.$2.$3/$4");
  return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, "$1.$2.$3/$4-$5");
}

function initAutoCompleteCnpjSimples() {
  const cnpjInput = document.getElementById("cnpj_cliente");
  const cnpjBox   = document.getElementById("cnpjAuto");
  const razaoInput = document.getElementById("razao");
  const razaoBox   = document.getElementById("razaoAuto");

  function preencherCliente(cli) {
    const cnpjDigits = (cli.cnpj || "").replace(/\D/g, "");
    if (cnpjInput) {
      cnpjInput.dataset.skipBlurValidation = "1";
      cnpjInput.value = formatCnpjMask(cnpjDigits);
      cnpjInput.dataset.clienteId = cli.id;
    }
    if (razaoInput) razaoInput.value = cli.razao || "";
    popularDatalistsCamposContato(cnpjInput?.value || "");
  }

  // ── Autocomplete de CNPJ ────────────────────────────────────────
  if (cnpjInput && cnpjBox) {
    const hideCnpj = () => { cnpjBox.classList.add("hidden"); cnpjBox.innerHTML = ""; };

    cnpjInput.addEventListener("input", () => {
      const p = String(cnpjInput.value || "").replace(/\D/g, "");
      if (p.length < 4) return hideCnpj();

      const matches = clientes
        .filter((c) => (c.cnpj || "").replace(/\D/g, "").startsWith(p))
        .slice(0, 10);

      if (!matches.length) return hideCnpj();

      cnpjBox.innerHTML = matches.map((cli) => {
        const cnpjDigits = (cli.cnpj || "").replace(/\D/g, "");
        return `<div class="autocomplete-item" data-id="${cli.id}">
          <div class="razao">${esc((cli.razao || "").trim()) || "-"}</div>
          <div class="cnpj">${formatCnpjMask(cnpjDigits)}</div>
        </div>`;
      }).join("");
      cnpjBox.classList.remove("hidden");
    });

    cnpjBox.addEventListener("mousedown", (e) => {
      const item = e.target.closest(".autocomplete-item");
      if (!item) return;
      e.preventDefault();
      const cli = clientes.find((c) => c.id === item.dataset.id);
      if (cli) preencherCliente(cli);
      hideCnpj();
    });

    cnpjInput.addEventListener("keydown", (e) => { if (e.key === "Escape") hideCnpj(); });
  }

  // ── Autocomplete de Razão Social ────────────────────────────────
  if (razaoInput && razaoBox) {
    const hideRazao = () => { razaoBox.classList.add("hidden"); razaoBox.innerHTML = ""; };

    razaoInput.addEventListener("input", () => {
      const q = (razaoInput.value || "").trim().toLowerCase();
      if (q.length < 2) return hideRazao();

      const matches = clientes
        .filter((c) => (c.razao || "").toLowerCase().includes(q))
        .slice(0, 10);

      if (!matches.length) return hideRazao();

      razaoBox.innerHTML = matches.map((cli) => {
        const cnpjDigits = (cli.cnpj || "").replace(/\D/g, "");
        return `<div class="autocomplete-item" data-id="${cli.id}">
          <div class="razao">${esc((cli.razao || "").trim()) || "-"}</div>
          <div class="cnpj">${formatCnpjMask(cnpjDigits)}</div>
        </div>`;
      }).join("");
      razaoBox.classList.remove("hidden");
    });

    razaoBox.addEventListener("mousedown", (e) => {
      const item = e.target.closest(".autocomplete-item");
      if (!item) return;
      e.preventDefault();
      const cli = clientes.find((c) => c.id === item.dataset.id);
      if (cli) preencherCliente(cli);
      hideRazao();
    });

    razaoInput.addEventListener("keydown", (e) => { if (e.key === "Escape") hideRazao(); });
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete-wrap")) {
      cnpjBox?.classList.add("hidden");
      razaoBox?.classList.add("hidden");
    }
  });
}

function initBuSegmento() {
  const buEl = document.getElementById("bu");
  const segWrap = document.getElementById("segmentoWrap");
  const segEl = document.getElementById("segmento");

  if (!buEl || !segWrap || !segEl) return;

  const SEGMENTOS_POR_BU = {
    "T&I": [],
    OGP: ["On Shore", "Off Shore", "DW"],
    OEM: [
      "Cranes",
      "infra",
      "Industrial",
      "Marine",
      "Mining",
      "Nuclear",
      "Papel & Celulose",
      "Raiways",
      "Renew (PV)",
      "Renew (Wind)",
      "Rolling Stock",
      "Water"
    ],
    "High Voltage": [],
    OHTL: [],
    Telecom: [],
    "Power Distribution": [],
    Acessórios: [],
    MMS: [],
    Renováveis: [],
    Serviços: ["HV", "PV", "Infra", "Industrial", "Data Center"],
  };

  function renderSegmentos(buValue) {
    const lista = SEGMENTOS_POR_BU[buValue] || [];
    segEl.innerHTML = `<option value="">Selecione</option>`;

    if (!lista.length) {
      segEl.value = "";
      segWrap.classList.add("hidden");
      return;
    }

    lista.forEach((seg) => {
      const opt = document.createElement("option");
      opt.value = seg;
      opt.textContent = seg;
      segEl.appendChild(opt);
    });

    segWrap.classList.remove("hidden");
  }

  buEl.addEventListener("change", () => renderSegmentos(buEl.value));
  renderSegmentos(buEl.value);
}

function senhaForteLogin(s) {
  const senha = String(s || "");
  const min8 = senha.length >= 8;
  const numero = /\d/.test(senha);
  const simbolo = /[^A-Za-z0-9]/.test(senha);
  const maiuscula = /[A-Z]/.test(senha);
  return min8 && numero && simbolo && maiuscula;
}

function msgSenhaForteLogin() {
  return "Senha fraca. Para acessar, você precisa trocar a senha.\n\nRegras: mínimo 8 caracteres, 1 letra MAIÚSCULA, 1 número e 1 símbolo.";
}

function gerarId() {
  return Date.now().toString() + "_" + Math.random().toString(16).slice(2);
}

function primeiroNome(texto) {
  if (!texto) return "";
  let nome = String(texto).trim();

  if (nome.includes("@")) {
    nome = nome.split("@")[0];
    nome = nome.split(".")[0];
  }

  nome = nome.split(" ")[0];
  return nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase();
}

function salvarRegistros() {
  localStorage.setItem("registros", JSON.stringify(registros));
}

function salvarClientes() {
  localStorage.setItem("clientes", JSON.stringify(clientes));
}

function salvarRepresentadas() {
  localStorage.setItem("representadas", JSON.stringify(representadas));
}

function irPara(tela) {
  if (window.innerWidth <= 780) fecharSidebarMobile();
  const _restaurar = window._restaurarFiltrosPorSecao;

  if (tela === "cadastro") {
    document.getElementById("secCadastro")?.scrollIntoView({ behavior: "smooth" });
    return;
  }

  if (tela === "registros") {
    _restaurar?.registros?.();
    currentPage = 1;
    renderTabela();
    document.getElementById("secRegistros")?.scrollIntoView({ behavior: "smooth" });
    return;
  }

  if (tela === "clientes") {
    _restaurar?.clientes?.();
    clientesCurrentPage = 1;
    renderTabelaClientes();
    document.getElementById("secClientes")?.scrollIntoView({ behavior: "smooth" });
    return;
  }

  if (tela === "projetos") {
    _restaurar?.projetos?.();
    projetosCurrentPage = 1;
    renderTabelaProjetos();
    document.getElementById("secProjetos")?.scrollIntoView({ behavior: "smooth" });
    return;
  }

  if (tela === "representadas") {
    _restaurar?.representadas?.();
    representadasCurrentPage = 1;
    renderTabelaRepresentadas();
    document.getElementById("secRepresentadas")?.scrollIntoView({ behavior: "smooth" });
    return;
  }

  if (tela === "backup") {
    document.getElementById("secBackup")?.scrollIntoView({ behavior: "smooth" });
    return;
  }

  if (tela === "lixeira") {
    const sec = document.getElementById("secaoLixeira");
    if (sec) {
      sec.classList.remove("hidden");
      sec.scrollIntoView({ behavior: "smooth" });
    }
    abrirLixeira();
    return;
  }

  if (tela === "aprovacao") {
    document.getElementById("secAprovacaoUsuarios")?.scrollIntoView({ behavior: "smooth" });
  }
}

function preencherSelectResponsaveisContato() {
  const select = document.getElementById("ct_responsavel");
  if (!select) return;

  select.innerHTML = '<option value="">Selecione</option>';

  RESPONSAVEIS_FIXOS.forEach((nome) => {
    const opt = document.createElement("option");
    opt.value = nome;
    opt.textContent = nome;
    select.appendChild(opt);
  });
}

function formatarNomeUsuario(valor) {
  if (!valor) return "-";
  const v = String(valor).trim();
  if (!v) return "-";

  if (!v.includes("@") && v.includes(" ")) return primeiroNome(v);
  if (v.includes("@")) return primeiroNome(v);

  const u = usuarios.find((x) => (x.uid || x.id) === v);
  if (u) return primeiroNome(u.nome || u.email || v);

  return v;
}

function atualizarSugestoesCnpj() {
  const dl = document.getElementById("cnpjSugestoes");
  if (!dl) return;

  const lista = [
    ...clientes.map((c) => c.cnpj || ""),
    ...registros.map((r) => r.cnpj_cliente || ""),
  ]
    .map((v) => String(v).replace(/\D/g, ""))
    .filter(Boolean);

  const unicos = Array.from(new Set(lista));
  dl.innerHTML = unicos
    .map((cnpj) => `<option value="${esc(cnpj)}"></option>`)
    .join("");
}

function initAuthTabs() {
  const tabLogin = document.getElementById("tabLogin");
  const tabSignup = document.getElementById("tabSignup");
  const panelLogin = document.getElementById("panelLogin");
  const panelSignup = document.getElementById("panelSignup");

  function showLogin() {
    panelLogin?.classList.remove("hidden");
    panelSignup?.classList.add("hidden");
    tabLogin?.classList.add("active");
    tabSignup?.classList.remove("active");
  }
  function showSignup() {
    panelSignup?.classList.remove("hidden");
    panelLogin?.classList.add("hidden");
    tabSignup?.classList.add("active");
    tabLogin?.classList.remove("active");
  }

  tabLogin?.addEventListener("click", showLogin);
  tabSignup?.addEventListener("click", showSignup);

  showLogin();
}

function setLoginMsg(msg) {
  const el = document.getElementById("loginMsg");
  if (el) el.textContent = msg || "";
}

function initForgotPassword() {
  const btn = document.getElementById("btnForgot");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const email = String(
      prompt("Digite seu e-mail para enviar o link de troca de senha:") || "",
    ).trim();

    if (!email) return;

    try {
      btn.disabled = true;
      setLoginMsg("Enviando e-mail de redefinição...");

      await auth.sendPasswordResetEmail(email);

      setLoginMsg(
        "✅ Enviamos um e-mail para você trocar a senha (verifique spam/promoções).",
      );
      showToast("E-mail de redefinição enviado!", "success");
    } catch (e) {
      console.error(e);
      setLoginMsg(
        "❌ Não consegui enviar. Verifique se o e-mail está correto.",
      );
      showToast("Erro ao enviar e-mail: " + (e?.message || e), "error");
    } finally {
      btn.disabled = false;
    }
  });
}

function initResendEmailVerification() {
  const btn = document.getElementById("btnResendVerify");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const email = String(document.getElementById("loginUser")?.value || "")
      .trim()
      .toLowerCase();

    if (!email) {
      showToast("Digite seu e-mail no campo de login primeiro.", "info");
      return;
    }

    try {
      btn.disabled = true;
      setLoginMsg("Enviando e-mail de verificação...");

      const pass = String(
        document.getElementById("loginPass")?.value || "",
      ).trim();
      if (!pass) {
        setLoginMsg("Digite sua senha também (para reenviar a verificação).");
        showToast("Digite sua senha para reenviar a verificação.", "info");
        return;
      }

      const cred = await auth.signInWithEmailAndPassword(email, pass);
      await cred.user.reload();

      if (cred.user.emailVerified) {
        setLoginMsg("✅ Seu e-mail já está verificado. Você já pode entrar.");
        showToast("Seu e-mail já está verificado.", "info");
        return;
      }

      const actionCodeSettings = {
        url: window.location.origin,
        handleCodeInApp: false,
      };

      await cred.user.sendEmailVerification(actionCodeSettings);

      setLoginMsg(
        "✅ E-mail de verificação reenviado! Verifique Caixa de entrada/Spam.",
      );
      showToast(
        "E-mail de verificação reenviado! Verifique Caixa de entrada/Spam.",
        "success",
      );

      await auth.signOut();
      mostrarLogin();
    } catch (e) {
      console.error("Erro ao reenviar verificação:", e);

      const msg =
        e?.code === "auth/wrong-password"
          ? "Senha incorreta."
          : e?.code === "auth/user-not-found"
            ? "Usuário não encontrado."
            : e?.code === "auth/too-many-requests"
              ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
              : "Não consegui reenviar. Erro: " + (e?.message || e);

      setLoginMsg("❌ " + msg);
      showToast(msg, "error");
    } finally {
      btn.disabled = false;
      setLoginMsg("");
    }
  });
}

function setSignupMsg(msg) {
  const el = document.getElementById("signupMsg");
  if (el) el.textContent = msg || "";
}

function initSignup() {
  const btn = document.getElementById("btnSignup");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const email = String(document.getElementById("signupEmail")?.value || "")
      .trim()
      .toLowerCase();

    const pass = String(
      document.getElementById("signupPass")?.value || "",
    ).trim();

    setSignupMsg("");

    if (!email || !pass) {
      setSignupMsg("❌ Preencha e-mail e senha.");
      return;
    }

    if (!senhaForteLogin(pass)) {
      showToast(msgSenhaForteLogin(), "error");
      setSignupMsg("❌ " + msgSenhaForteLogin());
      return;
    }

    try {
      btn.disabled = true;
      btn.textContent = "Criando...";

      const cred = await auth.createUserWithEmailAndPassword(email, pass);

      await db
        .collection("usuarios")
        .doc(cred.user.uid)
        .set(
          {
            uid: cred.user.uid,
            email: cred.user.email,
            nome: primeiroNome(cred.user.email),
            aprovado: false,
            ativo: true,
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
          },
          { merge: true },
        );

      try {
        const actionCodeSettings = {
          url: window.location.origin,
          handleCodeInApp: false,
        };

        await cred.user.sendEmailVerification(actionCodeSettings);

        setSignupMsg(
          "✅ Conta criada! Enviamos um e-mail para verificação. Depois, aguarde aprovação.",
        );
        showToast(
          "Conta criada! Enviamos um e-mail para verificação. Verifique a caixa de entrada e SPAM.",
          "success",
        );
      } catch (errMail) {
        console.error("Falha ao enviar email de verificação:", errMail);
        setSignupMsg(
          "✅ Conta criada! (Não consegui enviar o e-mail agora). Use 'Reenviar verificação' no login.",
        );
        showToast(
          "Conta criada, mas não consegui enviar o e-mail agora. Tente reenviar no login.",
          "warning",
        );
      }

      await auth.signOut();
      mostrarLogin();
    } catch (e) {
      console.error("ERRO SIGNUP:", e?.code, e?.message, e);
      showToast("ERRO SIGNUP: " + (e?.code || "") + " - " + (e?.message || e), "error");

      const msg =
        e?.code === "auth/email-already-in-use"
          ? "Esse e-mail já está cadastrado."
          : e?.code === "auth/invalid-email"
            ? "E-mail inválido."
            : e?.code === "auth/weak-password"
              ? "Senha fraca."
              : "Erro ao cadastrar: " + (e?.message || e);

      setSignupMsg("❌ " + msg);
      showToast(msg, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Criar conta";
    }
  });
}

function initAprovacaoUsuariosUI() {
  const btnReload = document.getElementById("btnReloadUsuariosPendentes");
  if (btnReload) btnReload.addEventListener("click", carregarUsuariosPendentes);

  initPermissoesUI();

  auth.onAuthStateChanged((user) => {
    const menu = document.getElementById("menuAprovacao");
    const sec = document.getElementById("secAprovacaoUsuarios");

    const isAdmin = !!user && isAdminEmail(user.email);

    if (menu) menu.classList.toggle("hidden", !isAdmin);
    if (sec) sec.classList.toggle("hidden", !isAdmin);

    if (isAdmin) {
      carregarUsuariosPendentes();
      carregarTabelaPermissoes();
    }
  });
}

const ROLE_LABELS = {
  admin:      { label: "Admin",      cls: "badge-role-admin" },
  supervisor: { label: "Supervisor", cls: "badge-role-supervisor" },
  user:       { label: "User",       cls: "badge-role-user" },
};

function initPermissoesUI() {
  const btn = document.getElementById("btnReloadPermissoes");
  if (btn) btn.addEventListener("click", carregarTabelaPermissoes);
}

async function carregarTabelaPermissoes() {
  const tbody = document.querySelector("#tabelaPermissoes tbody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">Carregando...</td></tr>`;

  try {
    const snap = await db.collection("usuarios").get();
    const todos = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.aprovado === true && u.uid)
      .map(u => ({
        id: u.id,
        email: (u.email || "").toLowerCase().trim(),
        nome: u.nome || u.email || "-",
        role: u.role || null,
        ativo: u.ativo !== false,
        representadasPermitidas: Array.isArray(u.representadasPermitidas) ? u.representadasPermitidas : null,
        alertasDeUsuarios: Array.isArray(u.alertasDeUsuarios) ? u.alertasDeUsuarios : null,
      }))
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

    if (!todos.length) {
      tbody.innerHTML = `<tr><td colspan="5">Nenhum usuário aprovado encontrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    todos.forEach(u => {
      const roleMeta = ROLE_LABELS[u.role] || { label: "Sem cargo", cls: "badge-role-none" };
      const isAdmin = u.role === "admin";

      let repsHtml;
      if (isAdmin || u.representadasPermitidas?.includes("*")) {
        repsHtml = '<span class="perm-badge perm-badge-total">Todas</span>';
      } else if (u.representadasPermitidas?.length) {
        repsHtml = u.representadasPermitidas
          .map(id => {
            const rep = representadas.find(r => r.id === id);
            return `<span class="perm-badge">${escapeHtml(rep?.nome || id)}</span>`;
          }).join(" ");
      } else {
        repsHtml = '<span class="perm-badge perm-badge-none">Nenhuma</span>';
      }

      let alertasHtml;
      if (isAdmin || u.alertasDeUsuarios?.includes("*")) {
        alertasHtml = '<span class="perm-badge perm-badge-total">Todos</span>';
      } else if (u.alertasDeUsuarios?.length) {
        alertasHtml = u.alertasDeUsuarios
          .map(email => {
            const usr = todos.find(t => t.email === email);
            return `<span class="perm-badge">${escapeHtml(usr?.nome || email)}</span>`;
          }).join(" ");
      } else {
        alertasHtml = '<span class="perm-badge perm-badge-none">Apenas próprios</span>';
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <div style="font-weight:500;">${escapeHtml(u.nome)}</div>
          <div style="font-size:11px;color:var(--text-muted);">${escapeHtml(u.email)}</div>
        </td>
        <td><span class="badge-role ${roleMeta.cls}">${roleMeta.label}</span></td>
        <td class="perm-cell">${repsHtml}</td>
        <td class="perm-cell">${alertasHtml}</td>
        <td style="text-align:center;">
          <button class="secondary perm-edit-btn" data-uid="${escapeHtml(u.id)}">Editar</button>
        </td>
      `;
      tr.querySelector(".perm-edit-btn").addEventListener("click", () => verPermissoesUsuario(u.id));
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error("ERRO carregarTabelaPermissoes:", e);
    tbody.innerHTML = `<tr><td colspan="5">Erro ao carregar permissões.</td></tr>`;
  }
}

async function verUsuario(uid) {
  let uDoc;
  try {
    uDoc = await db.collection("usuarios").doc(uid).get();
  } catch (e) {
    showToast("Erro ao carregar usuário.", "error");
    return;
  }
  if (!uDoc.exists) return;
  const u = { id: uid, ...uDoc.data() };

  function field(label, value, full) {
    if (!value && value !== 0) return "";
    return '<div class="md-detail-field' + (full ? ' md-detail-field--full' : '') + '">' +
      '<div class="md-detail-field-label">' + label + '</div>' +
      '<div class="md-detail-field-value">' + value + '</div>' +
      '</div>';
  }
  function section(title, fieldsHtml) {
    if (!fieldsHtml.trim()) return "";
    return '<div class="md-detail-section">' +
      '<div class="md-detail-section-title">' + title + '</div>' +
      '<div class="md-detail-grid">' + fieldsHtml + '</div>' +
      '</div>';
  }

  const roleMeta = ROLE_LABELS[u.role] || { label: "Sem cargo", cls: "badge-role-none" };
  const roleBadge = `<span class="badge-role ${roleMeta.cls}">${escapeHtml(roleMeta.label)}</span>`;
  const statusBadge = u.ativo !== false
    ? '<span style="color:#16a34a;font-weight:600;">● Ativo</span>'
    : '<span style="color:#dc2626;font-weight:600;">● Inativo</span>';

  // Representadas visíveis
  let repsHtml;
  if (u.role === "admin" || (Array.isArray(u.representadasPermitidas) && u.representadasPermitidas.includes("*"))) {
    repsHtml = "Acesso total — todas as representadas";
  } else if (Array.isArray(u.representadasPermitidas) && u.representadasPermitidas.length) {
    repsHtml = u.representadasPermitidas
      .map(id => {
        const rep = representadas.find(r => r.id === id);
        return '<span class="perm-badge">' + escapeHtml(rep?.nome || id) + '</span>';
      })
      .join(" ");
  } else {
    repsHtml = '<span style="color:var(--text-muted);font-style:italic;">Nenhuma configurada</span>';
  }

  // Alertas monitorados
  let alertasHtml;
  if (u.role === "admin" || (Array.isArray(u.alertasDeUsuarios) && u.alertasDeUsuarios.includes("*"))) {
    alertasHtml = "Acesso total — todos os usuários";
  } else if (Array.isArray(u.alertasDeUsuarios) && u.alertasDeUsuarios.length) {
    alertasHtml = u.alertasDeUsuarios
      .map(email => '<span class="perm-badge">' + escapeHtml(email) + '</span>')
      .join(" ");
  } else {
    alertasHtml = '<span style="color:var(--text-muted);font-style:italic;">Apenas os próprios alertas</span>';
  }

  let html = section("Dados do Usuário",
    field("Nome", escapeHtml(u.nome || "-")) +
    field("Email", escapeHtml(u.email || "-")) +
    field("Cargo", roleBadge) +
    field("Status", statusBadge)
  );

  html += section("Permissões",
    field("Representadas visíveis", repsHtml, true) +
    field("Alertas monitorados", alertasHtml, true)
  );

  html += section("Histórico",
    field("Criado em", formatDateTimeBR(u.criadoEm) || "-") +
    field("Atualizado em", formatDateTimeBR(u.atualizadoEm) || "-") +
    (u.atualizadoPorAdmin ? field("Editado por", escapeHtml(u.atualizadoPorAdmin)) : "")
  );

  abrirModal(
    `Usuário — ${escapeHtml(u.nome || u.email || "")}`,
    html,
    isAdmin() ? () => verPermissoesUsuario(uid) : null
  );
}

async function verPermissoesUsuario(uid) {
  let uDoc, todosSnap;
  try {
    [uDoc, todosSnap] = await Promise.all([
      db.collection("usuarios").doc(uid).get(),
      db.collection("usuarios").get(),
    ]);
  } catch (e) {
    showToast("Erro ao carregar dados do usuário.", "error");
    return;
  }

  if (!uDoc.exists) return;
  const u = { id: uid, ...uDoc.data() };

  const todosUsuarios = todosSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(d => d.aprovado === true && d.uid && d.email)
    .map(d => ({ id: d.id, email: (d.email || "").toLowerCase(), nome: d.nome || d.email }))
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

  const todasReps = representadas
    .filter(r => !r.deletado)
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

  const adminLogado = isAdmin();
  const emailUsuario = (u.email || "").toLowerCase();
  const nomeUsuario = u.nome || u.email || "-";
  const currentRole = u.role || "";
  const currentReps = new Set(Array.isArray(u.representadasPermitidas) ? u.representadasPermitidas : []);
  const currentAlertas = new Set(Array.isArray(u.alertasDeUsuarios) ? u.alertasDeUsuarios : []);

  document.getElementById("modalPermissoes")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "modalPermissoes";
  overlay.className = "crm-formato-overlay";
  overlay.style.zIndex = "2147483641";

  const card = document.createElement("div");
  card.className = "crm-formato-card perm-modal-card";

  // Header zone
  const headerZone = document.createElement("div");
  headerZone.className = "perm-modal-header";

  const headerEl = document.createElement("div");
  headerEl.className = "crm-formato-title";
  headerEl.textContent = nomeUsuario;

  const emailEl = document.createElement("p");
  emailEl.style.cssText = "font-size:13px;color:var(--text-muted);margin:2px 0 0;";
  emailEl.textContent = emailUsuario;

  headerZone.appendChild(headerEl);
  headerZone.appendChild(emailEl);

  // Scrollable body zone
  const bodyZone = document.createElement("div");
  bodyZone.className = "perm-modal-body";

  function makeSection(labelText, descText) {
    const wrap = document.createElement("div");
    wrap.className = "perm-section";
    const lbl = document.createElement("div");
    lbl.className = "perm-section-label";
    lbl.textContent = labelText;
    const desc = document.createElement("div");
    desc.className = "perm-section-desc";
    desc.textContent = descText;
    wrap.appendChild(lbl);
    wrap.appendChild(desc);
    return wrap;
  }

  // --- Cargo ---
  const cargoSection = makeSection("Cargo", "Define o nível de acesso geral no sistema.");
  const roleDiv = document.createElement("div");
  roleDiv.className = "cargo-modal-roles";
  [
    { value: "admin", label: "Admin" },
    { value: "supervisor", label: "Supervisor" },
    { value: "user", label: "User" },
    { value: "", label: "Sem cargo" },
  ].forEach(r => {
    const lbl = document.createElement("label");
    lbl.className = "cargo-role-option";
    const inp = document.createElement("input");
    inp.type = "radio";
    inp.name = "perm_role_" + uid;
    inp.value = r.value;
    inp.checked = currentRole === r.value;
    inp.disabled = !adminLogado;
    lbl.appendChild(inp);
    lbl.append(" " + r.label);
    roleDiv.appendChild(lbl);
  });
  cargoSection.appendChild(roleDiv);

  // --- Ofertas ---
  const ofertasSection = makeSection(
    "Ofertas — Representadas visíveis",
    "Quais representadas este usuário pode ver nas ofertas."
  );
  const repsDiv = document.createElement("div");
  repsDiv.className = "cargo-modal-checks perm-checks-grid";
  if (!todasReps.length) {
    const p = document.createElement("p");
    p.style.cssText = "font-size:12px;color:var(--text-muted);margin:4px 0;font-style:italic;";
    p.textContent = "Nenhuma representada cadastrada.";
    repsDiv.appendChild(p);
  } else {
    todasReps.forEach(rep => {
      const item = document.createElement("label");
      item.className = "cargo-check-item";
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.value = rep.id;
      chk.checked = currentReps.has("*") || currentReps.has(rep.id);
      chk.disabled = !adminLogado;
      const span = document.createElement("span");
      span.textContent = rep.nome || rep.id;
      item.appendChild(chk);
      item.appendChild(span);
      repsDiv.appendChild(item);
    });
  }
  ofertasSection.appendChild(repsDiv);

  // --- Alertas ---
  const alertasSection = makeSection(
    "Alertas — Usuários monitorados",
    "De quais usuários este usuário pode ver os alertas."
  );
  const alertasDiv = document.createElement("div");
  alertasDiv.className = "cargo-modal-checks";
  todosUsuarios.forEach(usr => {
    const item = document.createElement("label");
    item.className = "cargo-check-item";
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.value = usr.email;
    chk.checked = currentAlertas.has("*") || currentAlertas.has(usr.email);
    chk.disabled = !adminLogado;
    const span = document.createElement("span");
    span.textContent = usr.nome || usr.email;
    item.appendChild(chk);
    item.appendChild(span);
    alertasDiv.appendChild(item);
  });
  alertasSection.appendChild(alertasDiv);

  // --- Footer buttons ---
  const footerZone = document.createElement("div");
  footerZone.className = "perm-modal-footer";

  const close = () => overlay.remove();

  const btnCancel = document.createElement("button");
  btnCancel.textContent = adminLogado ? "Cancelar" : "Fechar";
  btnCancel.className = "secondary";
  btnCancel.addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", function handler(e) {
    if (e.key === "Escape") { document.removeEventListener("keydown", handler); close(); }
  });
  footerZone.appendChild(btnCancel);

  if (adminLogado) {
    const btnSave = document.createElement("button");
    btnSave.textContent = "Salvar";
    btnSave.addEventListener("click", async () => {
      const novoRole = roleDiv.querySelector(`input[name="perm_role_${uid}"]:checked`)?.value || "";
      const repIds = Array.from(repsDiv.querySelectorAll("input[type=checkbox]:checked")).map(c => c.value);
      const alertaEmails = Array.from(alertasDiv.querySelectorAll("input[type=checkbox]:checked")).map(c => c.value);
      btnSave.disabled = true;
      btnSave.textContent = "Salvando...";
      try {
        await salvarPermissoesUsuario(uid, emailUsuario, novoRole, repIds, alertaEmails);
        close();
      } catch (err) {
        showToast({ title: "Erro ao salvar", description: err.message }, "error");
        btnSave.disabled = false;
        btnSave.textContent = "Salvar";
      }
    });
    footerZone.appendChild(btnSave);
  }

  // Assemble body
  const sep1 = document.createElement("hr");
  sep1.className = "perm-sep";
  const sep2 = document.createElement("hr");
  sep2.className = "perm-sep";

  bodyZone.appendChild(cargoSection);
  bodyZone.appendChild(sep1);
  bodyZone.appendChild(ofertasSection);
  bodyZone.appendChild(sep2);
  bodyZone.appendChild(alertasSection);

  card.appendChild(headerZone);
  card.appendChild(bodyZone);
  card.appendChild(footerZone);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

async function salvarPermissoesUsuario(uid, email, novoRole, repIds, alertaEmails) {
  const extra = novoRole === "admin"
    ? { representadasPermitidas: ["*"], alertasDeUsuarios: ["*"] }
    : { representadasPermitidas: repIds, alertasDeUsuarios: alertaEmails };

  await db.collection("usuarios").doc(uid).set({
    role: novoRole || null,
    ...extra,
    atualizadoEm: new Date().toISOString(),
    atualizadoPorAdmin: auth.currentUser?.email || "",
  }, { merge: true });

  showToast({ title: "Permissões atualizadas", description: `${email} salvo com sucesso.` }, "success");
  await Promise.all([
    carregarTabelaPermissoes(),
    carregarUsuariosExistentes(document.getElementById("searchUsuariosExistentes")?.value || ""),
  ]);
}

async function carregarUsuariosPendentes() {
  const tbody = document.querySelector("#tabelaUsuariosPendentes tbody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5">Carregando...</td></tr>`;

  try {
    const snap = await db.collection("usuarios").get();
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const pendentes = all

      .filter((u) => {
        const temUid = !!u.uid;
        const aprovado = u.aprovado;

        const naoAprovado =
          aprovado === false ||
          aprovado === "false" ||
          aprovado === 0 ||
          aprovado === undefined ||
          aprovado === null;

        const ativo = u.ativo === undefined ? true : !!u.ativo;

        return temUid && naoAprovado && ativo;
      })

      .sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""));


    if (!pendentes.length) {
      tbody.innerHTML = `<tr><td colspan="5">Nenhum usuário pendente 🎉</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    pendentes.forEach((u) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(u.nome || "-")}</td>
        <td>${escapeHtml(u.email || "-")}</td>
        <td>${u.ativo === false ? "Inativo" : "Pendente"}</td>
        <td>${escapeHtml(u.criadoEm || u.atualizadoEm || "-")}</td>
        <td style="text-align:center;">
          <button class="btn-kebab" type="button" data-uid="${u.id}" data-type="usuario_pendente">...</button>
        </td>
      `;
      tr.querySelector(".btn-kebab").addEventListener("click", (ev) => {
        const btn = ev.currentTarget;
        openActionsMenu(ev, btn.dataset.type, btn.dataset.uid);
      });
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error("ERRO carregarUsuariosPendentes:", e);
    showToast("ERRO ao carregar usuários: " + (e?.message || e), "error");
    tbody.innerHTML = `<tr><td colspan="5">Erro ao carregar usuários.</td></tr>`;
  }
}

function initUsuariosExistentesUI() {
  const btn = document.getElementById("btnReloadUsuariosExistentes");
  const search = document.getElementById("searchUsuariosExistentes");

  btn?.addEventListener("click", carregarUsuariosExistentes);
  search?.addEventListener("input", () =>
    carregarUsuariosExistentes(search.value),
  );

  auth.onAuthStateChanged((user) => {
    if (user && isAdminEmail(user.email)) {
      carregarUsuariosExistentes();
    }
  });
}

async function carregarUsuariosExistentes(filtroTexto = "") {
  const tbody = document.querySelector("#tabelaUsuariosExistentes tbody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5">Carregando...</td></tr>`;

  try {
    const snap = await db.collection("usuarios").get();
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    let existentes = all
      .filter(
        (u) =>
          !!u.uid &&
          (u.aprovado === true || u.aprovado === "true" || u.aprovado === 1),
      )
      .map((u) => ({
        ...u,
        nome: u.nome || primeiroNome(u.email || ""),
        email: (u.email || "").toLowerCase(),
        ativo: u.ativo === undefined ? true : !!u.ativo,
      }));

    const ft = String(filtroTexto || "")
      .trim()
      .toLowerCase();
    if (ft) {
      existentes = existentes.filter(
        (u) =>
          (u.nome || "").toLowerCase().includes(ft) ||
          (u.email || "").toLowerCase().includes(ft),
      );
    }

    existentes.sort((a, b) =>
      (a.nome || "").localeCompare(b.nome || "", "pt-BR", {
        sensitivity: "base",
      }),
    );

    if (!existentes.length) {
      tbody.innerHTML = `<tr><td colspan="5">Nenhum usuário aprovado encontrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    existentes.forEach((u) => {
      const statusTxt = u.ativo ? "Ativo" : "Inativo";
      const criado = u.criadoEm || u.atualizadoEm || "-";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(u.nome || "-")}</td>
        <td>${escapeHtml(u.email || "-")}</td>
        <td>${statusTxt}</td>
        <td>${escapeHtml(criado)}</td>
        <td style="text-align:center;">
          <button class="btn-kebab" type="button" data-uid="${u.id}" data-type="usuario_existente" data-ativo="${u.ativo}" data-email="${escapeHtml(u.email)}">...</button>
        </td>
      `;
      tr.querySelector(".btn-kebab").addEventListener("click", (ev) => {
        const btn = ev.currentTarget;
        openActionsMenu(ev, btn.dataset.type, btn.dataset.uid, { ativo: btn.dataset.ativo === "true", email: btn.dataset.email });
      });
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error("ERRO carregarUsuariosExistentes:", e);
    tbody.innerHTML = `<tr><td colspan="5">Erro ao carregar usuários existentes.</td></tr>`;
  }
}

async function toggleAtivoUsuario(docId, novoAtivo) {
  const user = auth.currentUser;
  if (!user || !isAdminEmail(user.email)) {
    showToast("Apenas o administrador pode alterar usuários.", "error");
    return;
  }

  await db.collection("usuarios").doc(docId).set(
    {
      ativo: !!novoAtivo,
      atualizadoEm: new Date().toISOString(),
      atualizadoPorAdmin: user.email,
    },
    { merge: true },
  );

  await carregarUsuariosExistentes(
    document.getElementById("searchUsuariosExistentes")?.value || "",
  );
}

async function excluirUsuarioFirestore(docId) {
  const user = auth.currentUser;
  if (!user || !isAdminEmail(user.email)) {
    showToast("Apenas o administrador pode excluir usuários.", "error");
    return;
  }

  if (!await showConfirm("Isso vai apagar o usuário do Firestore.\n⚠️ Ele pode continuar existindo no Firebase Authentication.", { title: "Excluir Usuário", confirmText: "Excluir" })) return;

  await db.collection("usuarios").doc(docId).delete();

  await carregarUsuariosPendentes();
  await carregarUsuariosExistentes(
    document.getElementById("searchUsuariosExistentes")?.value || "",
  );
}

async function aprovarUsuario(uid) {
  const user = auth.currentUser;
  if (!user || !isAdminEmail(user.email)) {
    showToast("Apenas o administrador pode aprovar.", "error");
    return;
  }

  if (!await showConfirm("Tem certeza que deseja aprovar este usuário?", { title: "Aprovar Usuário", confirmText: "Aprovar", danger: false })) return;

  const snapVerif = await db.collection("usuarios").doc(uid).get();
  if (!snapVerif.exists || snapVerif.data()?.aprovado === true) {
    showToast("Usuário já foi aprovado ou não existe.", "warning");
    return;
  }

  await db.collection("usuarios").doc(uid).set(
    {
      aprovado: true,
      ativo: true,
      aprovadoPor: user.email,
      aprovadoEm: new Date().toISOString(),
    },
    { merge: true },
  );

  await carregarUsuariosPendentes();
  await carregarUsuariosExistentes(
    document.getElementById("searchUsuariosExistentes")?.value || "",
  );
}

async function bloquearUsuario(uid) {
  const user = auth.currentUser;
  if (!user || !isAdminEmail(user.email)) {
    showToast("Apenas o administrador pode bloquear.", "error");
    return;
  }

  if (!await showConfirm("Tem certeza que deseja bloquear este usuário?", { title: "Bloquear Usuário", confirmText: "Bloquear" })) return;

  await db.collection("usuarios").doc(uid).set(
    {
      aprovado: false,
      ativo: false,
      bloqueadoPor: user.email,
      bloqueadoEm: new Date().toISOString(),
    },
    { merge: true },
  );

  await carregarUsuariosPendentes();
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initUnidadesMantex() {
  const repEl = document.getElementById("representada");
  const wrap = document.getElementById("wrapUnidade");
  const unidadeEl = document.getElementById("unidade");

  if (!repEl || !unidadeEl) return;

  const unidades = ["Mantex (matriz)", "Mantex (filial)", "Sierra"];

  function atualizar() {
    const repNome =
      repEl.options[repEl.selectedIndex]?.text?.trim().toLowerCase() || "";

    const isMantex = repNome.includes("mantex");

    if (!isMantex) {
      if (wrap) wrap.classList.add("hidden");
      unidadeEl.innerHTML = `<option value="">Selecione...</option>`;
      unidadeEl.value = "";
      return;
    }

    if (wrap) wrap.classList.remove("hidden");

    unidadeEl.innerHTML =
      `<option value="">Selecione...</option>` +
      unidades.map((u) => `<option value="${u}">${u}</option>`).join("");
  }

  if (!repEl.dataset.mantexBound) {
    repEl.dataset.mantexBound = "1";
    repEl.addEventListener("change", atualizar);
  }

  atualizar();
}

function cancelarEdicao() {
  editId = null;

  const form = document.getElementById("formOferta");
  if (form) form.reset();

  // Limpa datasets que form.reset() não toca
  const cnpjInput = document.getElementById("cnpj_cliente");
  if (cnpjInput) cnpjInput.dataset.clienteId = "";
  document.getElementById("nome_projeto").dataset.projetoId = "";

  // Esconde seções condicionais
  document.getElementById("secaoPedido")?.classList.add("hidden");
  document.getElementById("secaoRevisao")?.classList.add("hidden");
  document.getElementById("blocoMotivoPerda")?.classList.add("hidden");
  document.getElementById("wrapUnidade")?.classList.add("hidden");

  // Reseta todos os radio buttons para "nao" disparando change
  // (garante que os change listeners escondam as seções corretamente)
  ["pedido", "revisao", "sol_oc", "spot", "entregue"].forEach((name) => {
    const radio = document.querySelector(`input[name='${name}'][value='nao']`);
    if (!radio) return;
    if (!radio.checked) {
      radio.checked = true;
      radio.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  // Limpa campos não cobertos pelo form.reset()
  const unidadeEl = document.getElementById("unidade");
  if (unidadeEl) unidadeEl.value = "";
  const motivoEl = document.getElementById("motivo_perda");
  if (motivoEl) motivoEl.value = "";

  // Reseta NFs para estado inicial (form.reset não restaura campos dinâmicos)
  if (typeof resetNotasFiscaisUI === "function") resetNotasFiscaisUI();

  const btnAdicionar = document.getElementById("btnAdicionar");
  if (btnAdicionar) btnAdicionar.textContent = "Adicionar";

  document.getElementById("btnCancelarEdicao")?.classList.add("hidden");

  // Restaura datalists com sugestões de todas as ofertas
  popularDatalistsCamposContato("");
}

function cancelarEdicaoCliente() {
  editClienteId = null;
  contatosTemp = [];
  editContatoIndex = null;

  document.getElementById("cli_razao").value = "";
  document.getElementById("cli_cnpj").value = "";
  document.getElementById("cli_ie").value = "";
  document.getElementById("cli_endereco").value = "";
  document.getElementById("cli_segmento").value = "";
  document.getElementById("cli_sap").value = "";

  document.getElementById("btnSalvarCliente").textContent = "Salvar Cliente";
  document.getElementById("btnAddContato").textContent = "Adicionar Contato";

  document.getElementById("btnCancelarEdicaoCliente")?.classList.add("hidden");

  renderListaContatos();
  renderMiniLixeiraContatos();
}

function cancelarEdicaoRepresentada() {
  editRepresentadaId = null;
  document.getElementById("rep_nome").value = "";

  const btn = document.getElementById("btnSalvarRepresentada");
  if (btn) btn.textContent = "Salvar Representada";

  document
    .getElementById("btnCancelarEdicaoRepresentada")
    ?.classList.add("hidden");
}

document
  .getElementById("btnCancelarEdicaoRepresentada")
  ?.addEventListener("click", cancelarEdicaoRepresentada);

function getRepresentadasFiltradas() {
  const base = representadas;

  const term = (document.getElementById("searchRepresentadas")?.value || "")
    .trim()
    .toLowerCase();

  if (!term) return representadas.slice();

  return base.filter((r) =>
    String(r.nome || "")
      .toLowerCase()
      .includes(term),
  );
}

function verContatosCliente(id) {
  clienteContatoAtualId = id;
  const cli = clientes.find((c) => c.id === id);
  if (!cli) return;

  let html = `<div class="modal-section">
    <strong>${esc(cli.razao) || "-"}</strong><br>
    CNPJ: ${esc(cli.cnpj) || "-"}
  </div><hr>`;

  const contatos = cli.contatos || [];
  if (!contatos.length) {
    html += `<div class="modal-section">Nenhum contato cadastrado.</div>`;
    return abrirModal("Contatos do Cliente", html);
  }

  html += contatos
    .map(
      (ct, index) => `
    <div class="modal-section">
<br>
      <strong>${esc(ct.nome) || "-"}</strong>
      ${ct.principal ? ` <span class="modal-badge">Principal</span>` : ``}

      <br>Função: ${esc(ct.funcao) || "-"}
      <br>Tel: ${esc(ct.telefone) || "-"}
      <br>E-mail: ${esc(ct.email) || "-"}

      ${ct.responsavelNome
          ? `<br><strong>Responsável:</strong> ${esc(primeiroNome(ct.responsavelNome))}`
          : ""
        }

      <br><br>
      <hr>
      <br>
        Criado em: ${formatDateTimeBR(ct.criadoEm)}<br>
        Atualizado em: ${formatDateTimeBR(ct.atualizadoEm)}
        <br><br>
        <hr>

      <button
        class="secondary"
        onclick='abrirHistoricoContato(${index}, "${escapeHtml(ct.nome || "Contato")}")'
      >
        Visualizar histórico
      </button>

    </div>
  `,
    )
    .join("");

  abrirModal("Contatos do Cliente", html);
}

function cancelarEdicaoContato() {
  editContatoIndex = null;

  document.getElementById("ct_nome").value = "";
  document.getElementById("ct_tel").value = "";
  document.getElementById("ct_email").value = "";
  document.getElementById("ct_funcao").value = "";
  document.getElementById("ct_principal").checked = false;
  document.getElementById("ct_responsavel").value = "";

  document.getElementById("btnAddContato").textContent = "Adicionar Contato";
  document.getElementById("btnCancelarEdicaoContato")?.classList.add("hidden");
}

function enableHorizontalWheel(selector = ".table-scroll") {
  document.querySelectorAll(selector).forEach((el) => {
    let scrollAmount = 0;
    let animationFrame;

    el.addEventListener(
      "wheel",
      (e) => {
        const canScrollX = el.scrollWidth > el.clientWidth;
        if (!canScrollX) return;

        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

        e.preventDefault();

        scrollAmount += e.deltaY * 0.8;

        if (!animationFrame) {
          animationFrame = requestAnimationFrame(function smoothScroll() {
            el.scrollLeft += scrollAmount * 0.2;
            scrollAmount *= 0.8;

            if (Math.abs(scrollAmount) > 0.5) {
              animationFrame = requestAnimationFrame(smoothScroll);
            } else {
              animationFrame = null;
              scrollAmount = 0;
            }
          });
        }
      },
      { passive: false },
    );
  });
}

enableHorizontalWheel(".table-scroll");

const REGISTROS_FILTER_FIELDS = [
  { value: "todos", label: "Buscar em todos os campos" },
  { value: "bu", label: "B.U" },
  { value: "razao", label: "Razão Social" },
  { value: "cnpj_cliente", label: "CNPJ" },
  { value: "nome_projeto", label: "Projeto" },
  { value: "representadaNome", label: "Representada" },
  { value: "tipo_oferta", label: "Tipo (Compra/Orçamento)" },
  { value: "status", label: "Status" },
  { value: "usuario", label: "Usuário" },
];

function buildRegistrosFieldOptions(selected = "todos") {
  const opts = [
    { value: "todos", label: "Buscar em todos os campos" },
    { value: "bu", label: "B.U" },
    { value: "razao", label: "Razão Social" },
    { value: "cnpj_cliente", label: "CNPJ" },
    { value: "projeto", label: "Projeto" },
    { value: "representada", label: "Representada" },
    { value: "tipo_oferta", label: "Tipo (Compra/Orçamento)" },
    { value: "status", label: "Status" },
    { value: "usuario", label: "Usuário" },
  ];

  return opts
    .map(
      (o) =>
        `<option value="${o.value}" ${o.value === selected ? "selected" : ""}>${o.label}</option>`,
    )
    .join("");
}

function addFiltroRegistroRow({ field = "todos", term = "" } = {}) {
  const wrap = document.getElementById("filtersRegistros");
  if (!wrap) return;

  const div = document.createElement("div");
  div.className = "filter-item";
  div.innerHTML = `
    <select class="multiField">
      ${buildRegistrosFieldOptions(field)}
    </select>

    <div class="multiTermWrap"></div>

    <button type="button" class="secondary btn-remove">Remover</button>
  `;

  wrap.appendChild(div);

  const fieldEl = div.querySelector(".multiField");
  if (fieldEl) fieldEl.value = field;

  renderFiltroRegistroValor(div, field, term);

  div.querySelector(".btn-remove")?.addEventListener("click", () => {
    div.remove();
    currentPage = 1;
    renderTabela();
  });

  fieldEl?.addEventListener("change", (e) => {
    renderFiltroRegistroValor(div, e.target.value, "");
    currentPage = 1;
    renderTabela();
  });
}

function renderFiltroRegistroValor(row, field = "todos", term = "") {
  const wrap = row.querySelector(".multiTermWrap");
  if (!wrap) return;

  const camposComSelect = [
    "bu",
    "representada",
    "tipo_oferta",
    "status",
    "usuario",
  ];

  let options = [];

  if (field === "bu") {
    options = [
      "T&I",
      "OGP",
      "OEM",
      "High Voltage",
      "OHTL",
      "Telecom",
      "Power Distribution",
      "Acessórios",
      "MMS",
      "Renováveis",
      "Serviços",
    ];
  }

  if (field === "representada") {
    options = Array.from(
      new Set(
        representadas.map((r) => String(r.nome || "").trim()).filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }

  if (field === "tipo_oferta") {
    options = ["Compra", "Orçamento"];
  }

  if (field === "status") {
    options = (window.STATUS_OPTIONS || []).slice();
  }

  if (field === "usuario") {
    options = getUsuariosComRegistrosOptions();
  }

  if (camposComSelect.includes(field)) {
    wrap.innerHTML = `
  <select class="multiTerm">
    <option value="">Selecione</option>
    ${options
        .map(
          (opt) =>
            `<option value="${esc(opt)}" ${String(opt).toLowerCase() === String(term).toLowerCase() ? "selected" : ""}>${esc(opt)}</option>`,
        )
        .join("")}
    <option value="vazio" ${String(term).toLowerCase() === "vazio" ? "selected" : ""}>Vazio</option>
  </select>
`;

    wrap.querySelector(".multiTerm")?.addEventListener("change", () => {
      currentPage = 1;
      renderTabela();
    });
  } else {
    wrap.innerHTML = `
      <input
        class="multiTerm"
        type="text"
        placeholder="Digite para filtrar... (ou 'vazio')"
        value="${term || ""}"
      />
    `;

    wrap.querySelector(".multiTerm")?.addEventListener("input", () => {
      renderTabelaDebounced();
    });
  }
}

function initFiltrosRegistrosUI() {
  const wrap = document.getElementById("filtersRegistros");
  if (wrap && wrap.children.length === 0) addFiltroRegistroRow();
  document.getElementById("btnAddFiltro")?.addEventListener("click", () => {
    addFiltroRegistroRow({ field: "todos", term: "" });
  });
  document.getElementById("btnLimparFiltros")?.addEventListener("click", () => {
    const wrap = document.getElementById("filtersRegistros");
    if (!wrap) return;
    wrap.innerHTML = "";
    addFiltroRegistroRow({ field: "todos", term: "" });
    const status = document.getElementById("statusFilter");
    if (status) status.value = "";

    const ped = document.getElementById("pedidoFilter");
    if (ped) ped.value = "todos";

    const rev = document.getElementById("revisaoFilter");
    if (rev) rev.value = "todos";

    currentPage = 1;
    renderTabela();
  });
}

function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const renderTabelaDebounced = debounce(() => {
  currentPage = 1;
  renderTabela();
}, 300);

const renderTabelaClientesDebounced = debounce(() => {
  clientesCurrentPage = 1;
  renderTabelaClientes();
}, 300);

const renderTabelaProjetosDebounced = debounce(() => {
  projetosCurrentPage = 1;
  renderTabelaProjetos();
}, 300);

const renderTabelaRepresentadasDebounced = debounce(() => {
  representadasCurrentPage = 1;
  renderTabelaRepresentadas();
}, 300);

function renderActiveFilterTags() {
  const container = document.getElementById("activeFiltersTags");
  if (!container) return;

  container.innerHTML = "";

  const filtros = Array.from(
    document.querySelectorAll("#filtersRegistros .filter-item"),
  )
    .map((row) => ({
      field: row.querySelector(".multiField")?.value,
      term: row.querySelector(".multiTerm")?.value?.trim(),
    }))
    .filter((f) => f.term);

  filtros.forEach((f, index) => {
    const tag = document.createElement("span");
    tag.className = "filter-tag";
    tag.innerHTML = `${esc(f.term)} ✕`;
    tag.onclick = () => {
      document
        .querySelectorAll("#filtersRegistros .filter-item")
      [index]?.remove();
      renderTabelaDebounced();
      renderActiveFilterTags();
    };
    container.appendChild(tag);
  });
}

function normalizeCNPJ(value) {
  return String(value || "").replace(/\D/g, "");
}

function isEmptyValue(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

function isEmptyByFieldRegistro(reg, field) {
  const value = getValorCampoRegistro(reg, field);

  if (field === "cnpj_cliente") {
    return normalizeCNPJ(value || "").length === 0;
  }

  return isEmptyValue(value);
}

function preencherSelectPadrao(selectId, optionsArray, placeholder) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = "";

  const optDefault = document.createElement("option");
  optDefault.value = "";
  optDefault.textContent = placeholder || "Selecione";
  select.appendChild(optDefault);

  optionsArray.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt;
    option.textContent = opt;
    select.appendChild(option);
  });
}

function getUsuariosFiltroOptions() {
  const nomes = usuarios
    .map((u) => primeiroNome(u.nome || u.email || ""))
    .filter(Boolean);

  return Array.from(new Set(nomes)).sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
  );
}

function getRepresentadasFiltroOptions() {
  const nomes = representadas
    .map((r) => String(r.nome || "").trim())
    .filter(Boolean);

  return Array.from(new Set(nomes)).sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
  );
}

function getBUFiltroOptions() {
  return [
    "T&I",
    "OGP",
    "OEM",
    "High Voltage",
    "OHTL",
    "Telecom",
    "Power Distribution",
    "Acessórios",
    "MMS",
    "Renováveis",
    "Serviços",
  ];
}

function getTipoOfertaFiltroOptions() {
  return ["compra", "orcamento"];
}

function getStatusFiltroOptions() {
  return (window.STATUS_OPTIONS || []).slice();
}

function campoRegistroUsaSelect(field) {
  return ["bu", "representada", "tipo_oferta", "status", "usuario"].includes(
    field,
  );
}

function getOpcoesCampoRegistro(field) {
  switch (field) {
    case "bu":
      return getBUFiltroOptions();
    case "representada":
      return getRepresentadasFiltroOptions();
    case "tipo_oferta":
      return getTipoOfertaFiltroOptions();
    case "status":
      return getStatusFiltroOptions();
    case "usuario":
      return getUsuariosFiltroOptions();
    default:
      return [];
  }
}

function campoClienteUsaSelect(field) {
  return ["segmento", "usuario"].includes(field);
}

function getUsuariosClientesFiltroOptions() {
  const nomes = clientes
    .map((c) => formatarNomeUsuario(c.atualizadoPor || c.criadoPor || ""))
    .filter((v) => v && v !== "-");

  return Array.from(new Set(nomes)).sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
  );
}

function getSegmentosClientesFiltroOptions() {
  return [...(window.SEGMENTO_OPTIONS || []), "vazio"];
}

function getOpcoesCampoCliente(field) {
  switch (field) {
    case "segmento":
      return getSegmentosClientesFiltroOptions();
    case "usuario":
      return getUsuariosClientesFiltroOptions();
    default:
      return [];
  }
}

function renderClienteTermInput(
  row,
  selectedField = "todos",
  selectedValue = "",
) {
  const wrap = row.querySelector(".multiTermWrap");
  if (!wrap) return;

  if (campoClienteUsaSelect(selectedField)) {
    const options = getOpcoesCampoCliente(selectedField);

    wrap.innerHTML = `
      <select class="multiTerm">
        <option value="">Selecione</option>
        ${options
        .map(
          (opt) =>
            `<option value="${esc(opt)}" ${opt === selectedValue ? "selected" : ""}>${esc(opt)}</option>`,
        )
        .join("")}

      </select>
    `;
  } else {
    wrap.innerHTML = `
      <input
        class="multiTerm"
        type="text"
        placeholder="Digite para filtrar... (ou 'vazio')"
        value="${selectedValue || ""}"
      />
    `;
  }

  const termEl = row.querySelector(".multiTerm");
  if (!termEl) return;

  if (termEl.tagName === "SELECT") {
    termEl.addEventListener("change", () => {
      clientesCurrentPage = 1;
      renderTabelaClientes();
    });
  } else {
    termEl.addEventListener("input", renderTabelaClientesDebounced);
  }
}

function addFiltroClienteRow(field = "todos", term = "") {
  const wrap = document.getElementById("filtersClientes");
  if (!wrap) return;

  const div = document.createElement("div");
  div.className = "filter-item";
  div.innerHTML = `
    <select class="multiField">
      <option value="todos">Todos</option>
      <option value="razao">Razão Social</option>
      <option value="cnpj">CNPJ</option>
      <option value="sap">SAP</option>
      <option value="segmento">Segmento</option>
      <option value="usuario">Usuário</option>
    </select>

    <div class="multiTermWrap"></div>

    <button type="button" class="btn-remove">Remover</button>
  `;

  wrap.appendChild(div);

  const fieldEl = div.querySelector(".multiField");
  fieldEl.value = field;

  renderClienteTermInput(div, field, term);

  fieldEl.addEventListener("change", (e) => {
    renderClienteTermInput(div, e.target.value, "");
    clientesCurrentPage = 1;
    renderTabelaClientes();
  });

  div.querySelector(".btn-remove")?.addEventListener("click", () => {
    div.remove();
    clientesCurrentPage = 1;
    renderTabelaClientes();
  });
}

function getUsuariosComRegistrosOptions() {
  const nomes = registros
    .map((r) => formatarNomeUsuario(r.atualizadoPor || r.criadoPor || ""))
    .filter((nome) => nome && nome !== "-" && nome !== "Desconhecido");

  return Array.from(new Set(nomes)).sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
  );
}

function normalizarValorHistorico(valor) {
  if (valor === null || valor === undefined || valor === "") return "(vazio)";
  if (typeof valor === "string") return valor.trim() || "(vazio)";
  return String(valor);
}

function criarEventoHistorico({ usuario, acao, campo, de = "", para = "" }) {
  return {
    dataHora: new Date().toISOString(),
    usuario: usuario || "Desconhecido",
    acao: acao || "alterou",
    campo: campo || "",
    de: normalizarValorHistorico(de),
    para: normalizarValorHistorico(para),
  };
}

function compararValoresHistorico(a, b) {
  return normalizarValorHistorico(a) !== normalizarValorHistorico(b);
}

/**
 * Função unificada de histórico.
 * @param {object} objAntigo
 * @param {object} objNovo
 * @param {string} usuario
 * @param {object} mapaCampos  — { "campo.path": "Label legível" }
 * @param {object} [formatadores] — { "campo": (valor) => string }
 * @param {boolean} [usarPath]  — true = usa getByPath (para campos aninhados)
 */
function montarEventosHistorico(objAntigo, objNovo, usuario, mapaCampos, formatadores = {}, usarPath = false) {
  return Object.keys(mapaCampos).flatMap((path) => {
    const antigo = usarPath
      ? getByPath(objAntigo || {}, path)
      : (objAntigo?.[path]);
    const novo = usarPath
      ? getByPath(objNovo || {}, path)
      : (objNovo?.[path]);

    const fmt = formatadores[path];
    const antigoFmt = fmt ? fmt(antigo) : antigo;
    const novoFmt   = fmt ? fmt(novo)   : novo;

    if (!compararValoresHistorico(antigoFmt, novoFmt)) return [];

    return [criarEventoHistorico({
      usuario,
      acao: "alterou",
      campo: mapaCampos[path],
      de: antigoFmt,
      para: novoFmt,
    })];
  });
}


function formatDateTimeBR(v) {
  if (!v) return "-";

  let d = v;

  if (typeof v === "object") {
    if (typeof v.toDate === "function") d = v.toDate();
    else if (typeof v.seconds === "number") d = new Date(v.seconds * 1000);
  } else {
    d = new Date(v);
  }

  if (!(d instanceof Date) || isNaN(d.getTime())) return String(v);

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

function renderHistoricoHtml(historico = []) {
  if (!historico.length) {
    return `<div class="historico-vazio">Nenhuma atividade registrada.</div>`;
  }

  const itens = historico
    .slice()
    .sort((a, b) =>
      String(a.dataHora || "").localeCompare(String(b.dataHora || "")),
    )
    .map((ev) => {
      const acao = (ev.acao || "").toLowerCase();

      let classeAcao = "historico-acao-alterou";
      if (acao.includes("criou")) classeAcao = "historico-acao-criou";
      if (acao.includes("removeu") || acao.includes("excluiu"))
        classeAcao = "historico-acao-removeu";

      return `
        <div class="historico-item">

          <div class="historico-topo">
            <span class="historico-data">[${formatDateTimeBR(ev.dataHora)}]</span>
            <span class="historico-usuario">${escapeHtml(formatarNomeUsuario(ev.usuario || "Desconhecido"))}</span>
          </div>

          <div class="historico-texto">
            <span class="historico-acao ${classeAcao}">
              ${escapeHtml(ev.acao || "")}
            </span>
            <strong>${escapeHtml(ev.campo || "")}</strong>
          </div>

          <div class="historico-valores">
            <span class="historico-de">${escapeHtml(ev.de || "(vazio)")}</span>
            <span class="historico-seta">→</span>
            <span class="historico-para">${escapeHtml(ev.para || "(vazio)")}</span>
          </div>

        </div>
      `;
    })
    .join("");

  return `<div class="historico-lista">${itens}</div>`;
}

function abrirModalHistorico(titulo, historico = []) {
  const modal = document.getElementById("modalHistorico");
  const tituloEl = document.getElementById("modalHistoricoTitulo");
  const corpoEl = document.getElementById("modalHistoricoCorpo");

  if (!modal || !tituloEl || !corpoEl) return;

  tituloEl.textContent = titulo || "Histórico";
  corpoEl.innerHTML = renderHistoricoHtml(historico);

  modal.classList.remove("hidden");

  requestAnimationFrame(() => {
    modal.classList.add("show");
  });
}

function fecharModalHistorico() {
  const modal = document.getElementById("modalHistorico");
  if (!modal) return;

  modal.classList.remove("show");

  setTimeout(() => {
    modal.classList.add("hidden");
  }, 180);
}

function montarHistoricoAlteracoesPath(objAntigo, objNovo, usuario, mapaCampos) {
  return montarEventosHistorico(objAntigo, objNovo, usuario, mapaCampos, {}, true);
}

function resumoContatoHistorico(ct = {}) {
  const nome = ct.nome || "(sem nome)";
  const funcao = ct.funcao || "(sem função)";
  const email = ct.email || "(sem e-mail)";
  const telefone = ct.telefone || "(sem telefone)";
  return `${nome} | ${funcao} | ${email} | ${telefone}`;
}

function montarHistoricoAlteracoesContato(contatoAntigo, contatoNovo, usuario) {
  const mapaCamposContato = {
    nome: "nome do contato",
    funcao: "função do contato",
    email: "e-mail do contato",
    telefone: "telefone do contato",
    responsavelNome: "responsável do contato",
    principal: "contato principal",
  };

  return montarEventosHistorico(
    contatoAntigo,
    contatoNovo,
    usuario,
    mapaCamposContato,
    { principal: (v) => (v ? "Sim" : "Não") },
  );
}

function abrirHistoricoContato(index, nomeContato) {
  const cliente = clientes.find((c) => c.id === clienteContatoAtualId);
  if (!cliente) return;

  const contato = cliente.contatos?.[index];
  if (!contato) return;

  abrirModalHistorico(
    `Histórico do Contato - ${nomeContato}`,
    contato.historico || [],
  );
}

function toggleOrdemRegistros() {
  ordemRegistros = ordemRegistros === "asc" ? "desc" : "asc";
  renderTabela();
}

function toggleOrdemClientes() {
  ordemClientes = ordemClientes === "asc" ? "desc" : "asc";
  renderTabelaClientes();
}

function toggleOrdemRepresentadas() {
  ordemRepresentadas = ordemRepresentadas === "asc" ? "desc" : "asc";
  renderTabelaRepresentadas();
}

function getRegistrosFiltrados() {
  const base = filtrarPorPermissao(registros);

  const statusFilter = (document.getElementById("statusFilter")?.value || "")
    .trim()
    .toLowerCase();

  const pedidoFilter =
    document.getElementById("pedidoFilter")?.value || "todos";
  const revisaoFilter =
    document.getElementById("revisaoFilter")?.value || "todos";

  const filtros = Array.from(
    document.querySelectorAll("#filtersRegistros .filter-item"),
  )
    .map((row) => {
      const field = row.querySelector(".multiField")?.value || "todos";
      const term = (row.querySelector(".multiTerm")?.value || "")
        .trim()
        .toLowerCase();
      return { field, term };
    })
    .filter((f) => f.term);

  const filtrosPorCampo = filtros.reduce((acc, f) => {
    if (!acc[f.field]) acc[f.field] = [];
    acc[f.field].push(f.term);
    return acc;
  }, {});

  return base.filter((reg) => {
    const textoTodos = getTextoRegistroTodosCampos(reg);

    for (const field in filtrosPorCampo) {
      const termos = filtrosPorCampo[field];

      const passouNoGrupo = termos.some((term) => {
        const wantEmpty =
          term === "vazio" || term === "em branco" || term === "sem";

        if (field === "todos") {
          if (wantEmpty) return false;
          return textoTodos.includes(term);
        }

        const valorCampo = (getValorCampoRegistro(reg, field) || "")
          .toString()
          .toLowerCase();

        if (wantEmpty) {
          return isEmptyByFieldRegistro(reg, field);
        }

        if (field === "cnpj_cliente") {
          return normalizeCNPJ(valorCampo).includes(normalizeCNPJ(term));
        }

        return valorCampo.includes(term);
      });

      if (!passouNoGrupo) return false;
    }

    if (statusFilter) {
      if (
        !String(reg.status || "")
          .toLowerCase()
          .includes(statusFilter)
      ) {
        return false;
      }
    }

    if (pedidoFilter === "com" && reg.possuiPedido !== "sim") return false;
    if (pedidoFilter === "sem" && reg.possuiPedido !== "nao") return false;

    if (revisaoFilter === "com" && reg.possuiRevisao !== "sim") return false;
    if (revisaoFilter === "sem" && reg.possuiRevisao !== "nao") return false;

    return true;
  });
}

function validarCNPJ(cnpj) {
  const cnpjLimpo = String(cnpj || "").replace(/\D/g, "");

  if (cnpjLimpo.length !== 14) return false;

  // rejeita sequências repetidas
  if (/^(\d)\1{13}$/.test(cnpjLimpo)) return false;

  const calcularDigito = (base, pesos) => {
    const soma = base
      .split("")
      .reduce((acc, num, i) => acc + Number(num) * pesos[i], 0);

    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const base12 = cnpjLimpo.slice(0, 12);
  const digito1 = calcularDigito(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const digito2 = calcularDigito(
    base12 + digito1,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );

  return cnpjLimpo === base12 + String(digito1) + String(digito2);
}

function limparErrosCampos() {
  document.querySelectorAll(".input-erro").forEach((el) => {
    el.classList.remove("input-erro");
  });
}

function marcarErroCampo(campo) {
  if (!campo) return;

  campo.classList.add("input-erro");

  const validarNovamente = () => {
    const id = campo.id;

    if (id === "cli_cnpj" || id === "cnpj_cliente") {
      const valor = campo.value.trim();
      if (!valor) {
        campo.classList.remove("input-erro");
        return;
      }
      if (validarCNPJ(valor)) {
        campo.classList.remove("input-erro");
      }
      return;
    }

    if (id === "telefone" || id === "ct_tel") {
      const digits = campo.value.replace(/\D/g, "");
      if (!campo.value.trim()) {
        campo.classList.remove("input-erro");
        return;
      }
      if (digits.length >= 10 && digits.length <= 11) {
        campo.classList.remove("input-erro");
      }
      return;
    }

    if (String(campo.value || "").trim()) {
      campo.classList.remove("input-erro");
    }
  };

  campo.addEventListener("input", validarNovamente);
  campo.addEventListener("blur", validarNovamente);
  campo.addEventListener("change", validarNovamente);
}

function validarCamposObrigatorios(campos) {
  limparErrosCampos();

  const invalidos = [];

  campos.forEach(({ el, nome, condicao = true }) => {
    if (!el || !condicao) return;

    const valor =
      el.type === "radio" || el.type === "checkbox"
        ? el.checked
        : String(el.value || "").trim();

    const vazio = el.tagName === "SELECT" ? !el.value : !valor;

    if (vazio) {
      marcarErroCampo(el);
      invalidos.push({ el, nome });
    }
  });

  if (invalidos.length) {
    invalidos[0].el.focus();
    showToast("Preencha todos os campos obrigatórios destacados em vermelho.", "error");
    return false;
  }

  return true;
}

function initValidacaoVisualCampos() {
  const cnpjOferta = document.getElementById("cnpj_cliente");
  const cnpjCliente = document.getElementById("cli_cnpj");
  const telOferta = document.getElementById("telefone");
  const telContato = document.getElementById("ct_tel");

  [cnpjOferta, cnpjCliente].forEach((campo) => {
    if (!campo) return;

    campo.addEventListener("blur", () => {
      const valor = campo.value.trim();
      if (!valor) {
        campo.classList.remove("input-erro");
        return;
      }

      if (!validarCNPJ(valor)) {
        campo.classList.add("input-erro");
      } else {
        campo.classList.remove("input-erro");
      }
    });
  });

  [telOferta, telContato].forEach((campo) => {
    if (!campo) return;

    campo.addEventListener("blur", () => {
      const valor = campo.value.trim();
      const digits = valor.replace(/\D/g, "");

      if (!valor) {
        campo.classList.remove("input-erro");
        return;
      }

      if (digits.length < 10 || digits.length > 11) {
        campo.classList.add("input-erro");
      } else {
        campo.classList.remove("input-erro");
      }
    });
  });
}

function initNotasFiscaisUI() {
  const btn = document.getElementById("btnAdicionarNF");
  const container = document.getElementById("blocoNotasFiscais");

  if (!btn || !container) return;
  if (btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";

  btn.addEventListener("click", () => {
    const total = container.querySelectorAll(".nf-item").length;
    const indice = total + 1;

    const div = document.createElement("div");
    div.className = "nf-item";
    div.dataset.index = indice;

    div.innerHTML = `
      <hr class="nf-divider">

      <div class="nf-header-row">
        <strong class="nf-title">NF ${indice}</strong>
        <button type="button" class="btn-sm btn-danger btn-remover-nf">Remover</button>
      </div>

      <label for="data_nf_${indice}">Data da Nota Fiscal ${indice}</label>
      <input type="date" id="data_nf_${indice}" class="nf-data">

      <label for="numero_nf_${indice}">Número da NF ${indice}</label>
      <input type="text" id="numero_nf_${indice}" class="nf-numero">

      <label for="valor_nf_${indice}">Valor da Nota Fiscal ${indice}</label>
      <input type="text" id="valor_nf_${indice}" class="money nf-valor" placeholder="R$">
    `;

    container.appendChild(div);

    const btnRemover = div.querySelector(".btn-remover-nf");
    btnRemover?.addEventListener("click", () => {
      div.remove();
      reindexarNotasFiscais();
      initMoneyMask();
    });

    initMoneyMask();
  });
}

function reindexarNotasFiscais() {
  const container = document.getElementById("blocoNotasFiscais");
  if (!container) return;

  const itens = container.querySelectorAll(".nf-item");

  itens.forEach((item, i) => {
    const indice = i + 1;
    item.dataset.index = indice;

    if (indice === 1) {
      const lblData = item.querySelector('label[for^="data_nf"]');
      const inpData =
        item.querySelector(".nf-data") || document.getElementById("data_nf");
      const lblNumero = item.querySelector('label[for^="numero_nf"]');
      const inpNumero =
        item.querySelector(".nf-numero") ||
        document.getElementById("numero_nf");
      const lblValor = item.querySelector('label[for^="valor_nf"]');
      const inpValor =
        item.querySelector(".nf-valor") || document.getElementById("valor_nf");

      if (lblData) {
        lblData.setAttribute("for", "data_nf");
        lblData.textContent = "Data da Nota Fiscal";
      }
      if (inpData) {
        inpData.id = "data_nf";
        inpData.classList.add("nf-data");
      }

      if (lblNumero) {
        lblNumero.setAttribute("for", "numero_nf");
        lblNumero.textContent = "Número da NF";
      }
      if (inpNumero) {
        inpNumero.id = "numero_nf";
        inpNumero.classList.add("nf-numero");
      }

      if (lblValor) {
        lblValor.setAttribute("for", "valor_nf");
        lblValor.textContent = "Valor da Nota Fiscal";
      }
      if (inpValor) {
        inpValor.id = "valor_nf";
        inpValor.classList.add("nf-valor");
      }

      const header = item.querySelector(".nf-header-row");
      const divider = item.querySelector(".nf-divider");
      header?.remove();
      divider?.remove();
    } else {
      let header = item.querySelector(".nf-header-row");
      if (!header) {
        header = document.createElement("div");
        header.className = "nf-header-row";
        header.innerHTML = `
          <strong class="nf-title"></strong>
          <button type="button" class="btn-sm btn-danger btn-remover-nf">Remover</button>
        `;
        item.prepend(header);

        header
          .querySelector(".btn-remover-nf")
          ?.addEventListener("click", () => {
            item.remove();
            reindexarNotasFiscais();
            initMoneyMask();
          });
      }

      let divider = item.querySelector(".nf-divider");
      if (!divider) {
        divider = document.createElement("hr");
        divider.className = "nf-divider";
        item.prepend(divider);
      }

      const lblData = item.querySelector('label[for^="data_nf"]');
      const inpData = item.querySelector(".nf-data");
      const lblNumero = item.querySelector('label[for^="numero_nf"]');
      const inpNumero = item.querySelector(".nf-numero");
      const lblValor = item.querySelector('label[for^="valor_nf"]');
      const inpValor = item.querySelector(".nf-valor");
      const title = item.querySelector(".nf-title");

      if (title) title.textContent = `NF ${indice}`;

      if (lblData) {
        lblData.setAttribute("for", `data_nf_${indice}`);
        lblData.textContent = `Data da Nota Fiscal ${indice}`;
      }
      if (inpData) inpData.id = `data_nf_${indice}`;

      if (lblNumero) {
        lblNumero.setAttribute("for", `numero_nf_${indice}`);
        lblNumero.textContent = `Número da NF ${indice}`;
      }
      if (inpNumero) inpNumero.id = `numero_nf_${indice}`;

      if (lblValor) {
        lblValor.setAttribute("for", `valor_nf_${indice}`);
        lblValor.textContent = `Valor da Nota Fiscal ${indice}`;
      }
      if (inpValor) inpValor.id = `valor_nf_${indice}`;
    }
  });
}

function resetNotasFiscaisUI() {
  const container = document.getElementById("blocoNotasFiscais");
  if (!container) return;

  container.innerHTML = `
    <div class="nf-item" data-index="1">
      <label for="data_nf">Data da Nota Fiscal</label>
      <input type="date" id="data_nf" class="nf-data">

      <label for="numero_nf">Número da NF</label>
      <input type="text" id="numero_nf" class="nf-numero">

      <label for="valor_nf">Valor da Nota Fiscal</label>
      <input type="text" id="valor_nf" class="money nf-valor" placeholder="R$">
    </div>
  `;

  initMoneyMask();
}

function getNotasFiscaisPedido(pedido = {}) {
  if (Array.isArray(pedido?.notas_fiscais) && pedido.notas_fiscais.length) {
    return pedido.notas_fiscais.map((nf) => ({
      data: nf?.data || "",
      numero: nf?.numero || "",
      valor: nf?.valor || "",
    }));
  }

  const primeira = {
    data: pedido?.data_nf || "",
    numero: pedido?.numero_nf || "",
    valor: pedido?.valor_nf || "",
  };

  if (primeira.data || primeira.numero || primeira.valor) {
    return [primeira];
  }

  return [];
}

function formatarNotasFiscaisTexto(pedido = {}) {
  const notas = getNotasFiscaisPedido(pedido);
  if (!notas.length) return "-";

  return notas
    .map((nf, i) => {
      return `NF ${i + 1}: Nº ${nf.numero || "-"} | Data: ${formatDateBR(nf.data)} | Valor: ${nf.valor || "-"}`;
    })
    .join(" || ");
}

function formatarNotasFiscaisHtml(pedido = {}) {
  const notas = getNotasFiscaisPedido(pedido);
  if (!notas.length) {
    return `<div class="modal-section"><strong>Notas Fiscais:</strong> -</div>`;
  }

  return `
    <div class="modal-section">
      <strong>Notas Fiscais:</strong><br><br>
      ${notas
      .map(
        (nf, i) => `
            <div style="margin-bottom:10px;">
              <strong>NF ${i + 1}</strong><br>
              Data: ${formatDateBR(nf.data)}<br>
              Número: ${nf.numero || "-"}<br>
              Valor: ${nf.valor || "-"}
            </div>
          `,
      )
      .join("")}
    </div>
  `;
}

function resumoNotasFiscaisHistorico(pedido = {}) {
  const notas = getNotasFiscaisPedido(pedido);
  if (!notas.length) return "(vazio)";

  return notas
    .map(
      (nf, i) =>
        `NF${i + 1}[${nf.numero || "-"} | ${formatDateBR(nf.data)} | ${nf.valor || "-"}]`,
    )
    .join(" ; ");
}

function preencherNotasFiscaisUI(pedido = {}) {
  const container = document.getElementById("blocoNotasFiscais");
  if (!container) return;

  const notas = getNotasFiscaisPedido(pedido);
  const lista = notas.length ? notas : [{ data: "", numero: "", valor: "" }];

  container.innerHTML = "";

  lista.forEach((nf, idx) => {
    const indice = idx + 1;
    const isPrimeira = indice === 1;

    const div = document.createElement("div");
    div.className = "nf-item";
    div.dataset.index = indice;

    div.innerHTML = `
      ${!isPrimeira ? '<hr class="nf-divider">' : ""}
      ${!isPrimeira
        ? `
        <div class="nf-header-row">
          <strong class="nf-title">NF ${indice}</strong>
          <button type="button" class="btn-sm btn-danger btn-remover-nf">Remover</button>
        </div>
      `
        : ""
      }

      <label for="${isPrimeira ? "data_nf" : `data_nf_${indice}`}">
        Data da Nota Fiscal${isPrimeira ? "" : ` ${indice}`}
      </label>
      <input
        type="date"
        id="${isPrimeira ? "data_nf" : `data_nf_${indice}`}"
        class="nf-data"
        value="${nf.data || ""}"
      >

      <label for="${isPrimeira ? "numero_nf" : `numero_nf_${indice}`}">
        Número da NF${isPrimeira ? "" : ` ${indice}`}
      </label>
      <input
        type="text"
        id="${isPrimeira ? "numero_nf" : `numero_nf_${indice}`}"
        class="nf-numero"
        value="${nf.numero || ""}"
      >

      <label for="${isPrimeira ? "valor_nf" : `valor_nf_${indice}`}">
        Valor da Nota Fiscal${isPrimeira ? "" : ` ${indice}`}
      </label>
      <input
        type="text"
        id="${isPrimeira ? "valor_nf" : `valor_nf_${indice}`}"
        class="money nf-valor"
        placeholder="R$"
        value="${nf.valor || ""}"
      >
    `;

    container.appendChild(div);

    div.querySelector(".btn-remover-nf")?.addEventListener("click", () => {
      div.remove();
      reindexarNotasFiscais();
      initMoneyMask();
    });
  });

  initMoneyMask();
}

function getMaxNotasFiscais(registrosLista = []) {
  return Math.max(
    1,
    ...registrosLista.map(
      (reg) => getNotasFiscaisPedido(reg.pedido || {}).length,
    ),
  );
}

function buildNotasFiscaisColumns(maxNFs) {
  const cols = [];

  for (let i = 1; i <= maxNFs; i++) {
    cols.push(
      { key: `nf_${i}_data`, label: `Data NF ${i}` },
      { key: `nf_${i}_numero`, label: `Número NF ${i}` },
      { key: `nf_${i}_valor`, label: `Valor NF ${i}` },
    );
  }

  return cols;
}

function buildSchemaComNotas(schemaBase, maxNFs) {
  const novoSchema = [];

  schemaBase.forEach((c) => {
    novoSchema.push(c);

    // 👇 ponto onde entra NF (depois de obs do pedido)
    if (c.key === "pedido.obs") {
      for (let i = 1; i <= maxNFs; i++) {
        novoSchema.push(
          { key: `nf_${i}_data`, label: `Data NF ${i}`, type: "date" },
          { key: `nf_${i}_numero`, label: `Número NF ${i}` },
          { key: `nf_${i}_valor`, label: `Valor NF ${i}` },
        );
      }
    }
  });

  return novoSchema;
}

function initProjetosUI() {
  preencherSelectPadrao("proj_tipo", TIPO_PROJETO_OPTIONS, "");
  preencherSelectPadrao("proj_status", STATUS_PROJETO_OPTIONS, "");
  preencherSelectResponsaveisProjeto();

  const pageSizeProjetosInput = document.getElementById("pageSizeProjetos");
  if (pageSizeProjetosInput) {
    const saved = parseInt(localStorage.getItem("pageSizeProjetos") || "", 10);
    if (!isNaN(saved) && saved > 0) projetosPageSize = saved;
    pageSizeProjetosInput.value = String(projetosPageSize);

    const apply = () => {
      const v = parseInt(pageSizeProjetosInput.value, 10);
      if (!v || v < 1) return;
      projetosPageSize = Math.min(Math.max(v, 1), 200);
      localStorage.setItem("pageSizeProjetos", String(projetosPageSize));
      projetosCurrentPage = 1;
      renderTabelaProjetos();
    };

    pageSizeProjetosInput.addEventListener("change", apply);
    pageSizeProjetosInput.addEventListener("blur", apply);
    pageSizeProjetosInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") apply();
    });
  }

  document.getElementById("btnPrevProjetos")?.addEventListener("click", () => {
    if (projetosCurrentPage > 1) {
      projetosCurrentPage--;
      renderTabelaProjetos();
    }
  });

  document.getElementById("btnNextProjetos")?.addEventListener("click", () => {
    const totalPages = Math.max(
      1,
      Math.ceil(getProjetosFiltrados().length / projetosPageSize),
    );
    if (projetosCurrentPage < totalPages) {
      projetosCurrentPage++;
      renderTabelaProjetos();
    }
  });

  bindGotoPage(
    "gotoPageProjetos",
    () =>
      Math.max(1, Math.ceil(getProjetosFiltrados().length / projetosPageSize)),
    (page) => {
      projetosCurrentPage = page;
      renderTabelaProjetos();
    },
  );

  document
    .getElementById("btnCancelarEdicaoProjeto")
    ?.addEventListener("click", cancelarEdicaoProjeto);

  document
    .getElementById("btnCancelarEdicaoContatoProjeto")
    ?.addEventListener("click", cancelarEdicaoContatoProjeto);

  document
    .getElementById("btnCancelarEdicaoAtualizacaoProjeto")
    ?.addEventListener("click", cancelarEdicaoAtualizacaoProjeto);

  initContatosProjetoUI();
  initAtualizacoesProjetoUI();
  initSalvarProjetoUI();
  initFiltrosProjetosUI();
  initValidacaoContatoProjetoVisual();
  renderTabelaProjetos();
}

function preencherSelectResponsaveisProjeto() {
  const select = document.getElementById("proj_ct_responsavel");
  if (!select) return;

  select.innerHTML = '<option value="">Selecione</option>';
  RESPONSAVEIS_FIXOS.forEach((nome) => {
    const opt = document.createElement("option");
    opt.value = nome;
    opt.textContent = nome;
    select.appendChild(opt);
  });
}

function initContatosProjetoUI() {
  const btn = document.getElementById("btnAddContatoProjeto");
  if (!btn || btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";

  btn.addEventListener("click", () => {
    const nomeEl = document.getElementById("proj_ct_nome");
    const telEl = document.getElementById("proj_ct_tel");
    const emailEl = document.getElementById("proj_ct_email");
    const funcaoEl = document.getElementById("proj_ct_funcao");
    const responsavelEl = document.getElementById("proj_ct_responsavel");
    const principalEl = document.getElementById("proj_ct_principal");

    const valido = validarCamposObrigatorios([
      { el: nomeEl, nome: "Nome" },
      { el: telEl, nome: "Telefone" },
      { el: emailEl, nome: "E-mail" },
    ]);

    if (!valido) return;

    const telDigits = (telEl.value || "").replace(/\D/g, "");
    if (telDigits.length < 10 || telDigits.length > 11) {
      marcarErroCampo(telEl);
      showToast("Telefone inválido. Informe DDD + 8 ou 9 dígitos.", "error");
      telEl.focus();
      return;
    }

    const nowIso = new Date().toISOString();
    const contatoBase = {
      nome: nomeEl.value.trim(),
      telefone: telEl.value.trim(),
      email: emailEl.value.trim(),
      funcao: funcaoEl.value.trim(),
      responsavelId: responsavelEl.value || "",
      responsavelNome: responsavelEl.value || "",
      principal: !!principalEl.checked,
      criadoEm: nowIso,
      atualizadoEm: nowIso,
    };

    const currentUser = getCurrentUserName();

    if (editContatoProjetoIndex === null) {
      contatoBase.historico = [
        criarEventoHistorico({
          usuario: currentUser,
          acao: "criou",
          campo: "contato do projeto",
          de: "",
          para: contatoBase.nome || "novo contato",
        }),
      ];
      projetoContatosTemp.push(contatoBase);
    } else {
      const antigo = projetoContatosTemp[editContatoProjetoIndex] || {};
      contatoBase.criadoEm = antigo.criadoEm || nowIso;
      contatoBase.atualizadoEm = nowIso;
      contatoBase.historico = [
        ...(antigo.historico || []),
        ...montarHistoricoAlteracoesContato(antigo, contatoBase, currentUser),
      ];
      projetoContatosTemp[editContatoProjetoIndex] = contatoBase;
      editContatoProjetoIndex = null;
      btn.textContent = "Adicionar Contato";
      document
        .getElementById("btnCancelarEdicaoContatoProjeto")
        ?.classList.add("hidden");
    }

    nomeEl.value = "";
    telEl.value = "";
    emailEl.value = "";
    funcaoEl.value = "";
    responsavelEl.value = "";
    principalEl.checked = false;

    renderListaContatosProjeto();
  });
}

function renderListaContatosProjeto() {
  const lista = document.getElementById("listaContatosProjeto");
  if (!lista) return;

  const contatosAtivos = obterItensTemporariosAtivos(projetoContatosTemp);

  lista.innerHTML = "";

  if (!contatosAtivos.length) {
    lista.innerHTML = "<p>Nenhum contato adicionado.</p>";
    renderMiniLixeiraContatosProjeto();
    return;
  }

  contatosAtivos.forEach((ct, index) => {
    const div = document.createElement("div");
    div.className = "contato-item";
    div.innerHTML = `
      <strong>${escapeHtml(ct.nome)}</strong>
      ${ct.principal ? '<span class="tag-principal">(Principal)</span>' : ""}
      <br>
      ${escapeHtml(ct.funcao || "")}
      <br>
      Tel: ${escapeHtml(ct.telefone || "")} • E-mail: ${escapeHtml(ct.email || "")}
      ${ct.responsavelNome
        ? `<br><strong>Responsável:</strong> ${escapeHtml(primeiroNome(ct.responsavelNome))}`
        : ""
      }
      <br>
      <button class="btn-sm" onclick="editarContatoProjeto(${index})">Editar</button>
      <button class="btn-sm btn-danger" onclick="excluirContatoProjeto(${index})">Excluir</button>
      <hr>
    `;
    lista.appendChild(div);
  });

  renderMiniLixeiraContatosProjeto();
}

function editarContatoProjeto(index) {
  const ativos = obterItensTemporariosAtivos(projetoContatosTemp);
  const ct = ativos[index];
  if (!ct) return;

  const indiceReal = projetoContatosTemp.indexOf(ct);
  if (indiceReal < 0) return;

  document.getElementById("proj_ct_nome").value = ct.nome || "";
  document.getElementById("proj_ct_tel").value = ct.telefone || "";
  document.getElementById("proj_ct_email").value = ct.email || "";
  document.getElementById("proj_ct_funcao").value = ct.funcao || "";
  document.getElementById("proj_ct_principal").checked = !!ct.principal;
  document.getElementById("proj_ct_responsavel").value = ct.responsavelId || "";

  editContatoProjetoIndex = indiceReal;
  document.getElementById("btnAddContatoProjeto").textContent = "Salvar Edição";
  document.getElementById("btnCancelarEdicaoContatoProjeto")?.classList.remove("hidden");
}

function excluirContatoProjeto(index) {
  excluirContatoGenerico({
    lista: projetoContatosTemp,
    indiceAtivo: index,
    labelTipo: "contato do projeto",
    btnId: "btnAddContatoProjeto",
    renderFn: renderListaContatosProjeto,
    renderLixeiraFn: renderMiniLixeiraContatosProjeto,
    resetEditIndex: () => { editContatoProjetoIndex = null; },
  });
}

function cancelarEdicaoContatoProjeto() {
  editContatoProjetoIndex = null;
  document.getElementById("proj_ct_nome").value = "";
  document.getElementById("proj_ct_tel").value = "";
  document.getElementById("proj_ct_email").value = "";
  document.getElementById("proj_ct_funcao").value = "";
  document.getElementById("proj_ct_responsavel").value = "";
  document.getElementById("proj_ct_principal").checked = false;
  document.getElementById("btnAddContatoProjeto").textContent =
    "Adicionar Contato";
  document
    .getElementById("btnCancelarEdicaoContatoProjeto")
    ?.classList.add("hidden");
}

function initAtualizacoesProjetoUI() {
  const btn = document.getElementById("btnAddAtualizacaoProjeto");
  if (!btn || btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";

  btn.addEventListener("click", () => {
    const textoEl = document.getElementById("proj_update_texto");
    const texto = textoEl?.value.trim() || "";

    if (!texto) {
      marcarErroCampo(textoEl);
      showToast("Digite o texto da atualização.", "error");
      textoEl?.focus();
      return;
    }

    const currentUser = getCurrentUserName();
    const nowIso = new Date().toISOString();

    if (editAtualizacaoProjetoIndex === null) {
      projetoAtualizacoesTemp.push({
        texto,
        criadoEm: nowIso,
        atualizadoEm: nowIso,
        criadoPor: currentUser,
        atualizadoPor: currentUser,
      });
    } else {
      const antiga = projetoAtualizacoesTemp[editAtualizacaoProjetoIndex] || {};
      projetoAtualizacoesTemp[editAtualizacaoProjetoIndex] = {
        ...antiga,
        texto,
        atualizadoEm: nowIso,
        atualizadoPor: currentUser,
      };
      editAtualizacaoProjetoIndex = null;
      btn.textContent = "Adicionar Atualização";
      document
        .getElementById("btnCancelarEdicaoAtualizacaoProjeto")
        ?.classList.add("hidden");
    }

    textoEl.value = "";
    renderListaAtualizacoesProjeto();
  });
}

function renderListaAtualizacoesProjeto() {
  const lista = document.getElementById("listaAtualizacoesProjeto");
  if (!lista) return;

  const atualizacoesAtivas = obterItensTemporariosAtivos(projetoAtualizacoesTemp);

  lista.innerHTML = "";

  atualizacoesAtivas.forEach((item, index) => {
    const texto = item.texto || item.descricao || item.status || "Atualização";

    const div = document.createElement("div");
    div.innerHTML = `
      <span>${esc(texto)}</span>
      <button type="button" onclick="editarAtualizacaoProjeto(${index})">Editar</button>
      <button type="button" onclick="excluirAtualizacaoProjeto(${index})">Excluir</button>
    `;
    lista.appendChild(div);
  });

  renderMiniLixeiraAtualizacoesProjeto();
}

function editarAtualizacaoProjeto(index) {
  const ativas = obterItensTemporariosAtivos(projetoAtualizacoesTemp);
  const item = ativas[index];
  if (!item) return;

  const indiceReal = projetoAtualizacoesTemp.indexOf(item);
  if (indiceReal < 0) return;

  document.getElementById("proj_update_texto").value =
    item.texto || item.descricao || "";

  editAtualizacaoProjetoIndex = indiceReal;
  document.getElementById("btnAddAtualizacaoProjeto").textContent =
    "Salvar Edição";
  document.getElementById("btnCancelarEdicaoAtualizacaoProjeto")?.classList.remove("hidden");
}

async function excluirAtualizacaoProjeto(index) {
  const ativas = obterItensTemporariosAtivos(projetoAtualizacoesTemp);
  const item = ativas[index];
  if (!item) return;

  const indiceReal = projetoAtualizacoesTemp.indexOf(item);
  if (indiceReal < 0) return;

  if (!await showConfirm("Tem certeza que deseja mover esta atualização para a mini lixeira?", { title: "Mover para Lixeira", confirmText: "Mover" })) return;

  marcarItemTemporarioComoRemovido(projetoAtualizacoesTemp, indiceReal, "atualização");

  editAtualizacaoProjetoIndex = null;
  document.getElementById("btnAddAtualizacaoProjeto").textContent =
    "Adicionar Atualização";

  renderListaAtualizacoesProjeto();
  renderMiniLixeiraAtualizacoesProjeto();
}

function cancelarEdicaoAtualizacaoProjeto() {
  editAtualizacaoProjetoIndex = null;
  document.getElementById("proj_update_texto").value = "";
  document.getElementById("btnAddAtualizacaoProjeto").textContent =
    "Adicionar Atualização";
  document
    .getElementById("btnCancelarEdicaoAtualizacaoProjeto")
    ?.classList.add("hidden");
}

function initSalvarProjetoUI() {
  const btn = document.getElementById("btnSalvarProjeto");

  if (!btn || btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";

  const mapaCamposProjeto = {
    nome: "nome do projeto",
    tipo: "tipo do projeto",
    status: "status",
    numero_referencia: "número de referência",
    prazo_final: "prazo final",
    valor_investimento: "valor do investimento",
    prev_fechamento: "previsão de fechamento",
    inicio_entregas: "início das entregas",
    fim_entregas: "fim das entregas",
    obs: "observações",
  };

  btn.addEventListener("click", async () => {
    const nomeEl = document.getElementById("proj_nome");
    const tipoEl = document.getElementById("proj_tipo");
    const statusEl = document.getElementById("proj_status");
    const refEl = document.getElementById("proj_referencia");
    const prazoEl = document.getElementById("proj_prazo_final");
    const valorEl = document.getElementById("proj_valor_investimento");
    const prevEl = document.getElementById("proj_prev_fechamento");
    const inicioEl = document.getElementById("proj_inicio_entregas");
    const fimEl = document.getElementById("proj_fim_entregas");
    const obsEl = document.getElementById("proj_obs");

    const valido = validarCamposObrigatorios([
      { el: nomeEl, nome: "Nome do Projeto" },
      { el: tipoEl, nome: "Tipo de Projeto" },
      { el: statusEl, nome: "Status" },
    ]);

    if (!valido) return;

    const currentUser = getCurrentUserName();
    const nowIso = new Date().toISOString();

    const projetoBase = {
      nome: nomeEl.value.trim(),
      tipo: tipoEl.value,
      status: statusEl.value,
      numero_referencia: refEl.value.trim(),
      prazo_final: prazoEl.value,
      valor_investimento: valorEl.value,
      prev_fechamento: prevEl.value,
      inicio_entregas: inicioEl.value,
      fim_entregas: fimEl.value,
      obs: obsEl.value.trim(),
      responsavelEmail: (window.auth?.currentUser?.email || "").toLowerCase(),
      contatos: obterItensTemporariosAtivos(projetoContatosTemp).map((ct) => ({ ...ct })),
      atualizacoes: obterItensTemporariosAtivos(projetoAtualizacoesTemp).map((at) => ({ ...at })),
    };

    try {
      if (!editProjetoId) {
        const id = gerarId();
        const projeto = {
          id,
          ...projetoBase,
          criadoPor: currentUser,
          atualizadoPor: currentUser,
          criadoEm: nowIso,
          atualizadoEm: nowIso,
          historico: [
            criarEventoHistorico({
              usuario: currentUser,
              acao: "Criou",
              campo: "projeto",
              de: "",
              para: projetoBase.nome || "novo projeto",
            }),
          ],
        };

        await db.collection("projetos").doc(id).set(projeto);
        projetos.push(projeto);
        showToast("Projeto salvo!", "success");
      } else {
        const idx = projetos.findIndex((p) => p.id === editProjetoId);
        const antigo = projetos[idx] || {};

        const eventosHistoricoBase = montarEventosHistorico(
          antigo,
          projetoBase,
          currentUser,
          mapaCamposProjeto,
        );

        if (antigo.status !== projetoBase.status) {
          eventosHistoricoBase.push(
            criarEventoHistorico({
              usuario: currentUser,
              acao: "alterou",
              campo: "status do projeto",
              de: antigo.status,
              para: projetoBase.status,
            }),
          );
        }

        const projeto = {
          id: editProjetoId,
          ...projetoBase,
          criadoPor: antigo.criadoPor || currentUser,
          atualizadoPor: currentUser,
          criadoEm: antigo.criadoEm || nowIso,
          atualizadoEm: nowIso,
          historico: [...(antigo.historico || []), ...eventosHistoricoBase],
        };

        await db.collection("projetos").doc(editProjetoId).set(projeto);
        projetos[idx] = projeto;

        showToast("Projeto atualizado!", "success");
      }

      cancelarEdicaoProjeto();
      renderTabelaProjetos();
      atualizarSugestoesProjetosOferta();
    } catch (e) {
      console.error(e);
      showToast("Erro ao salvar projeto: " + (e?.message || e), "error");
    }
  });
}

function getProjetosFiltrados() {
  const base = projetos;
  const filtros = Array.from(
    document.querySelectorAll("#filtersProjetos .filter-item"),
  )
    .map((row) => {
      const field = row.querySelector(".multiField")?.value || "todos";
      const term = (row.querySelector(".multiTerm")?.value || "")
        .trim()
        .toLowerCase();
      return { field, term };
    })
    .filter((f) => f.term);

  const filtrosPorCampo = filtros.reduce((acc, f) => {
    if (!acc[f.field]) acc[f.field] = [];
    acc[f.field].push(f.term);
    return acc;
  }, {});

  return base.filter((proj) => {
    const usuario = formatarNomeUsuario(
      proj.atualizadoPor || proj.criadoPor || "",
    ).toLowerCase();
    const textoTodos = [
      proj.nome,
      proj.tipo,
      proj.status,
      proj.numero_referencia,
      usuario,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    for (const field in filtrosPorCampo) {
      const termos = filtrosPorCampo[field];

      const passouNoGrupo = termos.some((term) => {
        if (field === "todos") return textoTodos.includes(term);

        let value = "";
        if (field === "nome") value = proj.nome || "";
        if (field === "tipo") value = proj.tipo || "";
        if (field === "status") value = proj.status || "";
        if (field === "numero_referencia") value = proj.numero_referencia || "";
        if (field === "usuario") value = usuario;

        return String(value).toLowerCase().includes(term);
      });

      if (!passouNoGrupo) return false;
    }

    return true;
  });
}

function renderTabelaProjetos() {
  const tbody = DOM.tabelaProjetosTbody || document.querySelector("#tabelaProjetos tbody");
  const pageInfo = DOM.pageInfoProjetos || document.getElementById("pageInfoProjetos");
  const countEl = DOM.projetosCount || document.getElementById("projetosCount");
  if (!tbody) return;

  tbody.innerHTML = "";

  const filtrados = getProjetosFiltrados();
  const listaOrdenada =
    ordemProjetos === "asc" ? [...filtrados] : [...filtrados].reverse();

  if (countEl) countEl.textContent = `${filtrados.length} projeto(s) encontrado(s)`;

  const { pageData, totalPages, start, safePage } = getPaginatedData(listaOrdenada, projetosCurrentPage, projetosPageSize);
  projetosCurrentPage = safePage;

  if (!pageData.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.textContent = "Nenhum projeto encontrado.";
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    pageData.forEach((proj, index) => {
      const usuario = formatarNomeUsuario(
        proj.atualizadoPor || proj.criadoPor || "-",
      );
      const qtdOfertas = filtrarPorPermissao(registros).filter(
        (r) => r.projetoId === proj.id,
      ).length;
      const atrasado =
        proj.prazo_final &&
        new Date(proj.prazo_final) <
        new Date(new Date().toISOString().slice(0, 10));

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${ordemProjetos === "asc" ? start + index + 1 : listaOrdenada.length - (start + index)}</td>
        <td>
          ${esc(proj.nome)}
          ${atrasado ? '<span class="badge-atrasado">Atrasado</span>' : ""}
        </td>
        <td>${esc(proj.tipo)}</td>
        <td>${esc(proj.status)}</td>
        <td>${esc(proj.numero_referencia)}</td>
        <td class="col-center">${qtdOfertas}</td>
        <td>${esc(usuario)}</td>
        <td style="text-align:center;">
          <button class="btn-kebab" onclick="openActionsMenu(event,'projeto','${proj.id}')">...</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  if (pageInfo)
    pageInfo.textContent = `Página ${projetosCurrentPage} de ${totalPages}`;
  const seta = document.getElementById("setaOrdemProjetos");
  if (seta) seta.textContent = ordemProjetos === "asc" ? "↑" : "↓";
}

function toggleOrdemProjetos() {
  ordemProjetos = ordemProjetos === "asc" ? "desc" : "asc";
  renderTabelaProjetos();
}

function addFiltroProjetoRow(field = "todos", term = "") {
  const wrap = document.getElementById("filtersProjetos");
  if (!wrap) return;

  const div = document.createElement("div");
  div.className = "filter-item";
  div.innerHTML = `
    <select class="multiField">
      <option value="todos">Todos</option>
      <option value="nome">Nome do Projeto</option>
      <option value="tipo">Tipo</option>
      <option value="status">Status</option>
      <option value="numero_referencia">Número de Referência</option>
      <option value="usuario">Usuário</option>
    </select>
    <div class="multiTermWrap"></div>
    <button type="button" class="btn-remove">Remover</button>
  `;

  wrap.appendChild(div);

  const fieldEl = div.querySelector(".multiField");
  fieldEl.value = field;

  renderProjetoTermInput(div, field, term);

  fieldEl.addEventListener("change", (e) => {
    renderProjetoTermInput(div, e.target.value, "");
    projetosCurrentPage = 1;
    renderTabelaProjetos();
  });

  div.querySelector(".btn-remove")?.addEventListener("click", () => {
    div.remove();
    projetosCurrentPage = 1;
    renderTabelaProjetos();
  });
}

function renderProjetoTermInput(
  row,
  selectedField = "todos",
  selectedValue = "",
) {
  const wrap = row.querySelector(".multiTermWrap");
  if (!wrap) return;

  if (["tipo", "status", "usuario"].includes(selectedField)) {
    let options = [];
    if (selectedField === "tipo") options = window.TIPO_PROJETO_OPTIONS || [];
    if (selectedField === "status")
      options = window.STATUS_PROJETO_OPTIONS || [];
    if (selectedField === "usuario") {
      options = Array.from(
        new Set(
          projetos
            .map((p) =>
              formatarNomeUsuario(p.atualizadoPor || p.criadoPor || ""),
            )
            .filter((v) => v && v !== "-"),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    }

    wrap.innerHTML = `
      <select class="multiTerm">
        <option value="">Selecione</option>
        ${options
        .map(
          (opt) =>
            `<option value="${esc(opt)}" ${opt === selectedValue ? "selected" : ""}>${esc(opt)}</option>`,
        )
        .join("")}
      </select>
    `;

    wrap.querySelector(".multiTerm")?.addEventListener("change", () => {
      projetosCurrentPage = 1;
      renderTabelaProjetos();
    });
  } else {
    wrap.innerHTML = `
      <input class="multiTerm" type="text" placeholder="Digite para filtrar..." value="${selectedValue || ""}" />
    `;

    wrap.querySelector(".multiTerm")?.addEventListener("input", renderTabelaProjetosDebounced);
  }
}

function initFiltrosProjetosUI() {
  document
    .getElementById("btnAddFiltroProjeto")
    ?.addEventListener("click", () => {
      addFiltroProjetoRow();
    });

  document
    .getElementById("btnLimparFiltrosProjetos")
    ?.addEventListener("click", () => {
      const wrap = document.getElementById("filtersProjetos");
      if (wrap) wrap.innerHTML = "";
      addFiltroProjetoRow();
      projetosCurrentPage = 1;
      renderTabelaProjetos();
    });

  if (!document.querySelector("#filtersProjetos .filter-item")) {
    addFiltroProjetoRow();
  }
}

function editarProjeto(id) {
  const proj = projetos.find((p) => p.id === id);
  if (!proj) return;

  editProjetoId = id;

  document.getElementById("proj_nome").value = proj.nome || "";
  document.getElementById("proj_tipo").value = proj.tipo || "";
  document.getElementById("proj_status").value = proj.status || "";
  document.getElementById("proj_referencia").value =
    proj.numero_referencia || "";
  document.getElementById("proj_prazo_final").value = proj.prazo_final || "";
  document.getElementById("proj_valor_investimento").value =
    proj.valor_investimento || "";
  document.getElementById("proj_prev_fechamento").value =
    proj.prev_fechamento || "";
  document.getElementById("proj_inicio_entregas").value =
    proj.inicio_entregas || "";
  document.getElementById("proj_fim_entregas").value = proj.fim_entregas || "";
  document.getElementById("proj_obs").value = proj.obs || "";

  projetoContatosTemp = (proj.contatos || []).map((c) => ({ ...c }));
  projetoAtualizacoesTemp = (proj.atualizacoes || []).map((u) => ({ ...u }));

  renderListaContatosProjeto();
  renderMiniLixeiraContatosProjeto();

  renderListaAtualizacoesProjeto();
  renderMiniLixeiraAtualizacoesProjeto();

  document.getElementById("btnSalvarProjeto").textContent = "Salvar Edição";
  document
    .getElementById("btnCancelarEdicaoProjeto")
    ?.classList.remove("hidden");

  document
    .getElementById("secProjetos")
    ?.scrollIntoView({ behavior: "smooth" });
}

function cancelarEdicaoProjeto() {
  editProjetoId = null;
  editContatoProjetoIndex = null;
  editAtualizacaoProjetoIndex = null;
  projetoContatosTemp = [];
  projetoAtualizacoesTemp = [];

  document.getElementById("proj_nome").value = "";
  document.getElementById("proj_tipo").value = "";
  document.getElementById("proj_status").value = "";
  document.getElementById("proj_referencia").value = "";
  document.getElementById("proj_prazo_final").value = "";
  document.getElementById("proj_valor_investimento").value = "";
  document.getElementById("proj_prev_fechamento").value = "";
  document.getElementById("proj_inicio_entregas").value = "";
  document.getElementById("proj_fim_entregas").value = "";
  document.getElementById("proj_obs").value = "";

  cancelarEdicaoContatoProjeto();
  cancelarEdicaoAtualizacaoProjeto();

  renderListaContatosProjeto();
  renderListaAtualizacoesProjeto();

  document.getElementById("btnSalvarProjeto").textContent = "Salvar Projeto";
  document.getElementById("btnCancelarEdicaoProjeto")?.classList.add("hidden");
}

function verProjeto(id) {
  const proj = projetos.find((p) => p.id === id);
  if (!proj) return;

  historicoAtualModal = proj.historico || [];

  const usuario = formatarNomeUsuario(proj.atualizadoPor || proj.criadoPor || "-");
  const ofertasDoProjeto = registros.filter((r) => r.projetoId === proj.id);
  const qtdOfertas = ofertasDoProjeto.length;
  const contatos = proj.contatos || [];
  const atualizacoes = proj.atualizacoes || [];

  function field(label, value, full) {
    if (!value && value !== 0) return "";
    return '<div class="md-detail-field' + (full ? ' md-detail-field--full' : '') + '">' +
      '<div class="md-detail-field-label">' + label + '</div>' +
      '<div class="md-detail-field-value">' + value + '</div>' +
      '</div>';
  }
  function section(title, fieldsHtml) {
    if (!fieldsHtml.trim()) return "";
    return '<div class="md-detail-section">' +
      '<div class="md-detail-section-title">' + title + '</div>' +
      '<div class="md-detail-grid">' + fieldsHtml + '</div>' +
      '</div>';
  }

  // --- Tab Ver (Projeto) ---
  let tabVer = section("Dados do Projeto",
    field("Nome do Projeto", esc(proj.nome) || "-") +
    field("Tipo", esc(proj.tipo) || "") +
    field("Status", esc(proj.status) || "-") +
    field("N° Referência", esc(proj.numero_referencia) || "") +
    field("Prazo Final", formatDateBR(proj.prazo_final) || "") +
    field("Valor do Investimento", esc(proj.valor_investimento) || "") +
    field("Prev. Fechamento", formatDateBR(proj.prev_fechamento) || "") +
    field("Início das Entregas", formatDateBR(proj.inicio_entregas) || "") +
    field("Fim das Entregas", formatDateBR(proj.fim_entregas) || "") +
    field("Qtd. Ofertas", String(qtdOfertas)) +
    (proj.obs ? field("Observações", esc(proj.obs), true) : "")
  );

  if (atualizacoes.length) {
    tabVer += '<div class="md-detail-section"><div class="md-detail-section-title">Atualizações do Projeto</div>';
    atualizacoes.forEach((up) => {
      tabVer += '<div class="md-contact-card">' +
        '<div class="md-contact-name">' + esc(primeiroNome(up.atualizadoPor || up.criadoPor || "-")) +
          ' <span style="font-weight:400;font-size:11px;opacity:.5">— ' + formatDateTimeBR(up.atualizadoEm || up.criadoEm) + '</span>' +
        '</div>' +
        '<div class="md-contact-detail">' + esc(up.texto || "-").replace(/\n/g, "<br>") + '</div>' +
        '</div>';
    });
    tabVer += '</div>';
  }

  tabVer += section("Histórico",
    field("Responsável", esc(usuario)) +
    field("Criado em", formatDateTimeBR(proj.criadoEm)) +
    field("Atualizado em", formatDateTimeBR(proj.atualizadoEm))
  );

  const _projLabel = escapeHtml(proj.nome || "");
  tabVer += '<div class="md-history-section"><button type="button" class="secondary" onclick="abrirHistoricoAtual(\'Histórico do Projeto ' + _projLabel + '\')">' +
    'Visualizar histórico de atividades</button></div>';

  // --- Tab Contatos ---
  let tabContatos = "";
  if (!contatos.length) {
    tabContatos = '<div class="proj-tab-empty">Nenhum contato cadastrado.</div>';
  } else {
    contatos.forEach((ct) => {
      tabContatos += '<div class="md-contact-card">' +
        '<div class="md-contact-name">' + (esc(ct.nome) || "-") +
          (ct.principal ? '<span class="modal-badge">Principal</span>' : "") +
        '</div>' +
        '<div class="md-contact-detail">' +
          (ct.funcao ? 'Função: ' + esc(ct.funcao) + '<br>' : "") +
          (ct.telefone ? 'Tel: ' + esc(ct.telefone) + '<br>' : "") +
          (ct.email ? 'E-mail: ' + esc(ct.email) + '<br>' : "") +
          (ct.responsavelNome ? 'Responsável: ' + esc(primeiroNome(ct.responsavelNome)) : "") +
        '</div></div>';
    });
  }

  // --- Tab Ofertas ---
  let tabOfertas = "";
  if (!ofertasDoProjeto.length) {
    tabOfertas = '<div class="proj-tab-empty">Nenhuma oferta vinculada a este projeto.</div>';
  } else {
    ofertasDoProjeto.forEach((reg) => {
      const usuarioOferta = formatarNomeUsuario(reg.atualizadoPor || reg.criadoPor || "-");
      const temPedido = reg.possuiPedido === "sim" ? "Sim" : "Não";
      const criadoEm = reg.criadoEm ? new Date(reg.criadoEm).toLocaleDateString("pt-BR") : "-";
      tabOfertas += '<div class="md-contact-card">' +
        '<div class="md-contact-name">' + escapeHtml(reg.oferta || "-") + '</div>' +
        '<div class="md-contact-detail">' +
          '<strong>Razão Social:</strong> ' + escapeHtml(reg.razao || "-") + '<br>' +
          '<strong>Representada:</strong> ' + escapeHtml(reg.representadaNome || "-") + '<br>' +
          '<strong>Status:</strong> ' + escapeHtml(reg.status || "-") + '<br>' +
          '<strong>Tipo:</strong> ' + escapeHtml(reg.tipo_oferta || "-") + '<br>' +
          '<strong>Tem pedido:</strong> ' + temPedido + '<br>' +
          '<strong>Valor total:</strong> ' + escapeHtml(reg.valor_total || "-") + '<br>' +
          '<strong>Criado em:</strong> ' + criadoEm + '<br>' +
          '<strong>Usuário:</strong> ' + escapeHtml(usuarioOferta) +
          '<div style="margin-top:10px"><button type="button" class="btn-ver-oferta" onclick="verOferta(\'' + escapeHtml(reg.id) + '\')">Ver oferta completa →</button></div>' +
        '</div></div>';
    });
  }

  const html = `
    <div class="proj-tabs-bar">
      <button type="button" class="proj-tab active" data-tab="ver" onclick="trocarAbaProjeto('ver')">Projeto</button>
      <button type="button" class="proj-tab" data-tab="contatos" onclick="trocarAbaProjeto('contatos')">Contatos${contatos.length ? ' (' + contatos.length + ')' : ''}</button>
      <button type="button" class="proj-tab" data-tab="ofertas" onclick="trocarAbaProjeto('ofertas')">Ofertas${qtdOfertas ? ' (' + qtdOfertas + ')' : ''}</button>
    </div>
    <div id="projTabVer" class="proj-tab-content">${tabVer}</div>
    <div id="projTabContatos" class="proj-tab-content hidden">${tabContatos}</div>
    <div id="projTabOfertas" class="proj-tab-content hidden">${tabOfertas}</div>
  `;

  abrirModal(`Projeto - ${proj.nome || ""}`, html, () => editarProjeto(id));
}

function trocarAbaProjeto(aba) {
  document.querySelectorAll(".proj-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === aba);
  });
  ["ver", "contatos", "ofertas"].forEach((a) => {
    const el = document.getElementById("projTab" + a.charAt(0).toUpperCase() + a.slice(1));
    if (el) el.classList.toggle("hidden", a !== aba);
  });
}

async function excluirProjeto(id) {
  const projeto = projetos.find((p) => p.id === id);
  if (!projeto) return;

  const nomeExibicao = projeto.nome || projeto.titulo || "Projeto";

  if (!await showConfirm("Tem certeza que deseja mover este projeto para a lixeira?\n\nVocê poderá restaurá-lo em até 7 dias.", { title: "Mover para Lixeira", confirmText: "Mover" })) return;

  try {
    await moverParaLixeira({
      colecao: "projetos",
      id,
      tipo: "projeto",
      nomeExibicao,
    });

    projetos = projetos.filter((p) => p.id !== id);
    renderTabelaProjetos?.();
    atualizarSugestoesProjetosOferta?.();

    mostrarToastDesfazer({
      mensagem: "Projeto movido para a lixeira.",
      onUndo: async () => {
        await restaurarDaLixeira("projetos", id);
        await recarregarDadosPrincipais();
      },
    });
  } catch (e) {
    console.error(e);
    showToast("Erro ao mover projeto para a lixeira.", "error");
  }
}

function atualizarSugestoesProjetosOferta() {
  initAutoCompleteProjetoOferta();
}

function initAutoCompleteProjetoOferta() {
  const input = document.getElementById("nome_projeto");
  const box = document.getElementById("projetoAuto");
  if (!input || !box) return;
  if (input.dataset.projetoBound === "1") return;
  input.dataset.projetoBound = "1";

  function hide() {
    box.classList.add("hidden");
    box.innerHTML = "";
  }

  function showMatches(term) {
    const t = String(term || "")
      .trim()
      .toLowerCase();
    if (!t) return hide();

    const matches = projetos
      .filter((p) =>
        String(p.nome || "")
          .toLowerCase()
          .includes(t),
      )
      .slice(0, 10);

    const exact = projetos.some(
      (p) =>
        String(p.nome || "")
          .trim()
          .toLowerCase() === t,
    );

    let html = matches
      .map(
        (proj) => `
          <div class="autocomplete-item" data-id="${proj.id}" data-nome="${escapeHtml(proj.nome || "")}">
            <div class="razao">${escapeHtml(proj.nome || "-")}</div>
            <div class="cnpj">${escapeHtml(proj.tipo || "-")} • ${escapeHtml(proj.status || "-")}</div>
          </div>
        `,
      )
      .join("");

    if (!exact && t) {
      html += `
        <div class="autocomplete-item" data-cadastrar="1" data-nome="${escapeHtml(input.value.trim())}">
          <div class="razao">Cadastrar projeto?</div>
          <div class="cnpj">${escapeHtml(input.value.trim())}</div>
        </div>
      `;
    }

    if (!html) return hide();

    box.innerHTML = html;
    box.classList.remove("hidden");
  }

  input.addEventListener("input", () => {
    input.dataset.projetoId = "";
    showMatches(input.value);
  });

  box.addEventListener("mousedown", async (e) => {
    const item = e.target.closest(".autocomplete-item");
    if (!item) return;
    e.preventDefault();

    if (item.dataset.cadastrar === "1") {
      const nome = item.dataset.nome || input.value.trim();
      input.value = nome;
      input.dataset.projetoId = "";

      hide();
      const ir = await showConfirm(`Projeto "${nome}" não encontrado. Deseja cadastrá-lo agora?`, { title: "Projeto não encontrado", confirmText: "Cadastrar", danger: false });

      if (ir) {
        irPara("projetos");
        document.getElementById("proj_nome").value = nome;
        document.getElementById("proj_nome").focus();
      }
      return;
    }

    const id = item.dataset.id;
    const nome = item.dataset.nome || "";
    input.value = nome;
    input.dataset.projetoId = id || "";
    hide();
  });

  document.addEventListener("click", (e) => {
    if (
      !e.target.closest("#nome_projeto") &&
      !e.target.closest("#projetoAuto")
    ) {
      hide();
    }
  });

  input.addEventListener("blur", () => {
    const nomeDigitado = String(input.value || "").trim();
    if (!nomeDigitado) {
      input.dataset.projetoId = "";
      return;
    }

    const proj = projetos.find(
      (p) =>
        String(p.nome || "")
          .trim()
          .toLowerCase() === nomeDigitado.toLowerCase(),
    );

    if (proj) {
      input.dataset.projetoId = proj.id;
      input.value = proj.nome;
    } else {
      input.dataset.projetoId = "";
    }
  });
}

function verContatosProjeto(id) {
  const proj = projetos.find((p) => p.id === id);
  if (!proj) return;

  let html = `
    <div class="modal-section">
      <strong>${proj.nome || "-"}</strong><br>
      Tipo: ${proj.tipo || "-"}<br>
      Status: ${proj.status || "-"}
    </div>
    <hr>
  `;

  const contatos = proj.contatos || [];

  if (!contatos.length) {
    html += `<div class="modal-section">Nenhum contato cadastrado.</div>`;
    return abrirModal("Contatos do Projeto", html);
  }

  html += contatos
    .map(
      (ct) => `
        <div class="modal-section">
          <strong>${ct.nome || "-"}</strong>
          ${ct.principal ? '<span class="modal-badge">Principal</span>' : ""}
          <br>
          Função: ${ct.funcao || "-"}<br>
          Tel: ${ct.telefone || "-"}<br>
          E-mail: ${ct.email || "-"}
          ${ct.responsavelNome
          ? `<br><strong>Responsável:</strong> ${primeiroNome(ct.responsavelNome)}`
          : ""
        }
        </div>
        <hr>
      `,
    )
    .join("");

  abrirModal("Contatos do Projeto", html);
}

function verOfertasProjeto(id) {
  const proj = projetos.find((p) => p.id === id);
  if (!proj) return;

  const ofertasProjeto = registros.filter((r) => r.projetoId === id);

  let html = `
    <div class="modal-section">
      <strong>Projeto:</strong> ${proj.nome || "-"}<br>
      <strong>Quantidade de ofertas:</strong> ${ofertasProjeto.length}
    </div>
    <hr>
  `;

  if (!ofertasProjeto.length) {
    html += `<div class="modal-section">Nenhuma oferta vinculada a este projeto.</div>`;
    return abrirModal("Ofertas do Projeto", html);
  }

  html += ofertasProjeto
    .map((reg) => {
      const usuario = formatarNomeUsuario(
        reg.atualizadoPor || reg.criadoPor || "-",
      );
      const temPedido = reg.possuiPedido === "sim" ? "Sim" : "Não";
      const criadoEm = reg.criadoEm
        ? new Date(reg.criadoEm).toLocaleDateString("pt-BR")
        : "-";
      return `
        <div class="modal-section">
          <strong>Oferta:</strong> ${escapeHtml(reg.oferta || "-")}<br>
          <strong>Razão Social:</strong> ${escapeHtml(reg.razao || "-")}<br>
          <strong>Representada:</strong> ${escapeHtml(reg.representadaNome || "-")}<br>
          <strong>Status:</strong> ${escapeHtml(reg.status || "-")}<br>
          <strong>Tipo:</strong> ${escapeHtml(reg.tipo_oferta || "-")}<br>
          <strong>Tem pedido:</strong> ${temPedido}<br>
          <strong>Valor total:</strong> ${escapeHtml(reg.valor_total || "-")}<br>
          <strong>Criado em:</strong> ${criadoEm}<br>
          <strong>Usuário:</strong> ${escapeHtml(usuario)}
          <div style="margin-top:10px">
            <button type="button" class="btn-ver-oferta" onclick="verOferta('${escapeHtml(reg.id)}')">Ver oferta completa →</button>
          </div>
        </div>
        <hr>
      `;
    })
    .join("");

  abrirModal("Ofertas do Projeto", html);
}

function verOfertasCliente(id) {
  const cli = clientes.find((c) => c.id === id);
  if (!cli) return;

  const cnpjClean = (cli.cnpj || "").replace(/\D/g, "");
  const ofertasCliente = registros.filter(
    (r) => (r.cnpj_cliente || "").replace(/\D/g, "") === cnpjClean,
  );

  let html = `
    <div class="modal-section">
      <strong>Cliente:</strong> ${cli.razao || "-"}<br>
      <strong>Quantidade de ofertas:</strong> ${ofertasCliente.length}
    </div>
    <hr>
  `;

  if (!ofertasCliente.length) {
    html += `<div class="modal-section">Nenhuma oferta vinculada a este cliente.</div>`;
    return abrirModal("Ofertas do Cliente", html);
  }

  html += ofertasCliente
    .map((reg) => {
      const usuario = formatarNomeUsuario(
        reg.atualizadoPor || reg.criadoPor || "-",
      );
      const temPedido = reg.possuiPedido === "sim" ? "Sim" : "Não";
      const criadoEm = reg.criadoEm
        ? new Date(reg.criadoEm).toLocaleDateString("pt-BR")
        : "-";
      return `
        <div class="modal-section">
          <strong>Oferta:</strong> ${escapeHtml(reg.oferta || "-")}<br>
          <strong>Projeto:</strong> ${escapeHtml(reg.nome_projeto || "-")}<br>
          <strong>Representada:</strong> ${escapeHtml(reg.representadaNome || "-")}<br>
          <strong>Status:</strong> ${escapeHtml(reg.status || "-")}<br>
          <strong>Tipo:</strong> ${escapeHtml(reg.tipo_oferta || "-")}<br>
          <strong>Tem pedido:</strong> ${temPedido}<br>
          <strong>Valor total:</strong> ${escapeHtml(reg.valor_total || "-")}<br>
          <strong>Criado em:</strong> ${criadoEm}<br>
          <strong>Usuário:</strong> ${escapeHtml(usuario)}
          <div style="margin-top:10px">
            <button type="button" class="btn-ver-oferta" onclick="verOferta('${escapeHtml(reg.id)}')">Ver oferta completa →</button>
          </div>
        </div>
        <hr>
      `;
    })
    .join("");

  abrirModal("Ofertas do Cliente", html);
}

function verOfertasRepresentada(id) {
  const rep = representadas.find((r) => r.id === id);
  if (!rep) return;

  const ofertasRep = registros.filter((r) => r.representadaId === id);

  let html = `
    <div class="modal-section">
      <strong>Representada:</strong> ${rep.nome || "-"}<br>
      <strong>Quantidade de ofertas:</strong> ${ofertasRep.length}
    </div>
    <hr>
  `;

  if (!ofertasRep.length) {
    html += `<div class="modal-section">Nenhuma oferta vinculada a esta representada.</div>`;
    return abrirModal("Ofertas da Representada", html);
  }

  html += ofertasRep
    .map((reg) => {
      const usuario = formatarNomeUsuario(
        reg.atualizadoPor || reg.criadoPor || "-",
      );
      const temPedido = reg.possuiPedido === "sim" ? "Sim" : "Não";
      const criadoEm = reg.criadoEm
        ? new Date(reg.criadoEm).toLocaleDateString("pt-BR")
        : "-";
      return `
        <div class="modal-section">
          <strong>Oferta:</strong> ${escapeHtml(reg.oferta || "-")}<br>
          <strong>Razão Social:</strong> ${escapeHtml(reg.razao || "-")}<br>
          <strong>Projeto:</strong> ${escapeHtml(reg.nome_projeto || "-")}<br>
          <strong>Tipo:</strong> ${escapeHtml(reg.tipo_oferta || "-")}<br>
          <strong>Status:</strong> ${escapeHtml(reg.status || "-")}<br>
          <strong>Tem pedido:</strong> ${temPedido}<br>
          <strong>Valor total:</strong> ${escapeHtml(reg.valor_total || "-")}<br>
          <strong>Criado em:</strong> ${criadoEm}<br>
          <strong>Usuário:</strong> ${escapeHtml(usuario)}
          <div style="margin-top:10px">
            <button type="button" class="btn-ver-oferta" onclick="verOferta('${escapeHtml(reg.id)}')">Ver oferta completa →</button>
          </div>
        </div>
        <hr>
      `;
    })
    .join("");

  abrirModal("Ofertas da Representada", html);
}

function validarContatoProjeto() {
  const nomeEl = document.getElementById("proj_ct_nome");
  const telEl = document.getElementById("proj_ct_tel");
  const emailEl = document.getElementById("proj_ct_email");

  limparErrosCampos();

  let ok = true;

  if (!String(nomeEl?.value || "").trim()) {
    marcarErroCampo(nomeEl);
    ok = false;
  }

  const telDigits = String(telEl?.value || "").replace(/\D/g, "");
  if (!telDigits || telDigits.length < 10 || telDigits.length > 11) {
    marcarErroCampo(telEl);
    ok = false;
  }

  const email = String(emailEl?.value || "").trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    marcarErroCampo(emailEl);
    ok = false;
  }

  if (!ok) {
    document.querySelector(".input-erro")?.focus();
    showToast(
      "Preencha corretamente os campos obrigatórios destacados em vermelho.",
      "error",
    );
  }

  return ok;
}

function validarTelefoneProjetoVisual() {
  const telEl = document.getElementById("proj_ct_tel");
  if (!telEl) return;

  const valor = String(telEl.value || "").trim();
  const digits = valor.replace(/\D/g, "");

  if (!valor) {
    telEl.classList.remove("input-erro");
    return;
  }

  if (digits.length < 10 || digits.length > 11) {
    marcarErroCampo(telEl);
  } else {
    telEl.classList.remove("input-erro");
  }
}

function initValidacaoContatoProjetoVisual() {
  const nomeEl = document.getElementById("proj_ct_nome");
  const telEl = document.getElementById("proj_ct_tel");
  const emailEl = document.getElementById("proj_ct_email");

  if (nomeEl && nomeEl.dataset.valBound !== "1") {
    nomeEl.dataset.valBound = "1";
    nomeEl.addEventListener("input", () => {
      if (String(nomeEl.value || "").trim()) {
        nomeEl.classList.remove("input-erro");
      }
    });
    nomeEl.addEventListener("blur", () => {
      if (!String(nomeEl.value || "").trim()) {
        nomeEl.classList.add("input-erro");
      }
    });
  }

  if (emailEl && emailEl.dataset.valBound !== "1") {
    emailEl.dataset.valBound = "1";
    emailEl.addEventListener("input", () => {
      const email = String(emailEl.value || "").trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!email || !emailRegex.test(email)) {
        emailEl.classList.add("input-erro");
      } else {
        emailEl.classList.remove("input-erro");
      }
    });

    emailEl.addEventListener("blur", () => {
      const email = String(emailEl.value || "").trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!email || !emailRegex.test(email)) {
        emailEl.classList.add("input-erro");
      } else {
        emailEl.classList.remove("input-erro");
      }
    });
  }
}

function gerarPdfPorSchema(titulo, schema, usarNotasFiscais = false) {
  const filtrados = getRegistrosFiltrados();
  if (filtrados.length === 0) {
    showToast("Nenhum registro para exportar.", "info");
    return;
  }

  let schemaFinal = [...schema];

  if (usarNotasFiscais) {
    const maxNFs = getMaxNotasFiscais(filtrados);
    schemaFinal = buildSchemaComNotas(schema, maxNFs);
  }

  const cols = ["#", ...schemaFinal.map((c) => c.label)];
  const totalCols = cols.length;

  const fontSize = totalCols > 22 ? 7 : totalCols > 16 ? 8 : 9;
  const padding = totalCols > 22 ? 2 : 3;
  const orientation = totalCols > 12 ? "landscape" : "portrait";

  let html = `
    <html>
      <head>
        <title>${escapeHtml(titulo)}</title>
        <style>
          @page {
            size: A4 ${orientation};
            margin: 8mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            font-family: Arial, sans-serif;
            font-size: ${fontSize}px;
            margin: 0;
            color: #000;
          }

          h2 {
            text-align: center;
            margin: 0 0 10px 0;
            font-size: 14px;
          }

          .meta {
            margin-bottom: 8px;
            font-size: ${Math.max(fontSize - 1, 7)}px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          th, td {
            border: 1px solid #000;
            padding: ${padding}px;
            vertical-align: top;
            word-break: break-word;
            overflow-wrap: anywhere;
          }

          th {
            background: #eee;
            font-weight: bold;
            text-align: left;
          }

          tbody tr:nth-child(even) {
            background: #fafafa;
          }

          .col-index {
            width: 28px;
            text-align: center;
          }

          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <h2>${escapeHtml(titulo)}</h2>
        <div class="meta">Total de registros: ${filtrados.length}</div>
        <table>
          <thead>
            <tr>
              ${cols
      .map((c, i) =>
        i === 0
          ? `<th class="col-index">${escapeHtml(c)}</th>`
          : `<th>${escapeHtml(c)}</th>`,
      )
      .join("")}
            </tr>
          </thead>
          <tbody>
  `;

  filtrados.forEach((reg, i) => {
    const tds = [];
    tds.push(`<td class="col-index">${i + 1}</td>`);

    schemaFinal.forEach((c) => {
      let val;

      if (c.key.startsWith("nf_")) {
        const partes = c.key.split("_");
        const idx = parseInt(partes[1], 10) - 1;
        const campo = partes[2];
        const notas = getNotasFiscaisPedido(reg.pedido || {});
        val = notas[idx]?.[campo] || "";
      } else {
        val = getByPath(reg, c.key);
      }

      if (c.key === "atualizadoPor") {
        val = formatarNomeUsuario(val);
      }

      if (c.type === "yesno") val = asYesNo(val);
      if (c.type === "date") val = formatDateBR(val);
      if (c.type === "datetime") val = formatDateTimeBR(val);

      tds.push(`<td>${String(val ?? "").replace(/\n/g, "<br>")}</td>`);
    });

    html += `<tr>${tds.join("")}</tr>`;
  });

  html += `
          </tbody>
        </table>
      </body>
    </html>
  `;

  const win = window.open("", "_blank");
  if (!win) {
    showToast("Não foi possível abrir a janela. Desbloqueie popups no navegador e tente novamente.", "error");
    return;
  }
  try {
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  } catch (err) {
    console.error("Erro ao gerar PDF completo:", err);
    showToast("Erro ao gerar PDF.", "error");
  }
}

function exportPdfResumo() {
  gerarPdfPorSchema("Registros de Ofertas - Resumido", OFERTA_SCHEMA_RESUMIDO, false);
}

function exportPdfCompleto() {
  const filtrados = getRegistrosFiltrados();
  if (filtrados.length === 0) {
    showToast("Nenhum registro para exportar.", "info");
    return;
  }

  const schemaBase = window.OFERTA_SCHEMA || [];
  const maxNFs = getMaxNotasFiscais(filtrados);
  const schemaFinal = buildSchemaComNotas(schemaBase, maxNFs);

  let html = `
    <html>
      <head>
        <title>Registros de Ofertas - Completo</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            font-family: Arial, sans-serif;
            font-size: 11px;
            color: #000;
            margin: 0;
            line-height: 1.35;
          }

          h1 {
            text-align: center;
            font-size: 18px;
            margin: 0 0 12px 0;
          }

          .meta-geral {
            margin-bottom: 16px;
            font-size: 11px;
          }

          .registro {
            border: 1px solid #000;
            border-radius: 6px;
            padding: 10px;
            margin-bottom: 14px;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .registro-header {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 8px;
            border-bottom: 1px solid #000;
            padding-bottom: 4px;
          }

          .grid {
            display: grid;
            grid-template-columns: 220px 1fr;
            gap: 4px 10px;
          }

          .label {
            font-weight: bold;
          }

          .valor {
            word-break: break-word;
            overflow-wrap: anywhere;
          }

          .vazio {
            color: #666;
            font-style: italic;
          }

          .nf-bloco {
            margin-top: 6px;
            padding-top: 6px;
            border-top: 1px dashed #999;
          }

          .nf-item {
            margin-bottom: 6px;
            padding: 6px 8px;
            background: #f7f7f7;
            border: 1px solid #ccc;
            border-radius: 4px;
          }

          .quebra {
            page-break-before: always;
          }
        </style>
      </head>
      <body>
        <h1>Registros de Ofertas - Completo</h1>
        <div class="meta-geral">Total de registros: ${filtrados.length}</div>
  `;

  filtrados.forEach((reg, i) => {
    let camposHtml = "";

    schemaFinal.forEach((c) => {
      // NFs dinâmicas não entram aqui como campos simples
      if (c.key.startsWith("nf_")) return;

      let val = getByPath(reg, c.key);

      if (c.key === "atualizadoPor" || c.key === "criadoPor") {
        val = formatarNomeUsuario(val);
      }

      if (c.type === "yesno") val = asYesNo(val);
      if (c.type === "date") val = formatDateBR(val);
      if (c.type === "datetime") val = formatDateTimeBR(val);

      const texto = String(val ?? "").trim();

      camposHtml += `
        <div class="label">${escapeHtml(c.label)}</div>
        <div class="valor ${!texto || texto === "-" ? "vazio" : ""}">
          ${texto ? escapeHtml(texto).replace(/\n/g, "<br>") : "-"}
        </div>
      `;
    });

    const notas = getNotasFiscaisPedido(reg.pedido || {});
    let notasHtml = "";

    if (notas.length) {
      notasHtml = `
        <div class="nf-bloco">
          <div class="label" style="margin-bottom: 6px;">Notas Fiscais</div>
          ${notas
          .map(
            (nf, idx) => `
                <div class="nf-item">
                  <strong>NF ${idx + 1}</strong><br>
                  Data: ${escapeHtml(formatDateBR(nf.data || ""))}<br>
                  Número: ${escapeHtml(nf.numero || "-")}<br>
                  Valor: ${escapeHtml(nf.valor || "-")}
                </div>
              `,
          )
          .join("")}
        </div>
      `;
    }

    html += `
      <div class="registro ${i > 0 ? "quebra" : ""}">
        <div class="registro-header">
          Registro #${i + 1} — Oferta ${escapeHtml(reg.oferta || "-")}
        </div>
        <div class="grid">
          ${camposHtml}
        </div>
        ${notasHtml}
      </div>
    `;
  });

  html += `
      </body>
    </html>
  `;

  const win = window.open("", "_blank");
  if (!win) {
    showToast("Não foi possível abrir a janela. Desbloqueie popups no navegador e tente novamente.", "error");
    return;
  }
  try {
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  } catch (err) {
    console.error("Erro ao gerar PDF:", err);
    showToast("Erro ao gerar PDF.", "error");
  }
}

function baixarModeloImportacaoExcel() {
  const wb = XLSX.utils.book_new();

  // ── INSTRUCOES ────────────────────────────────────────────────────────────
  const instrucoes = [
    { "Regra": "NÃO renomeie as abas nem altere os nomes das colunas — eles são sensíveis a maiúsculas/minúsculas." },
    { "Regra": "Colunas marcadas com (*) são obrigatórias. Linhas sem elas serão ignoradas com erro." },
    { "Regra": "Clientes com mesmo CNPJ já existente no sistema são ignorados (sem erro)." },
    { "Regra": "Representadas com mesmo Nome já existente no sistema são ignoradas." },
    { "Regra": "Projetos com mesmo NomeProjeto + NumeroReferencia já existentes são ignorados." },
    { "Regra": "Ofertas com mesmo NumeroOferta + ClienteCNPJ já existentes são ignoradas." },
    { "Regra": "" },
    { "Regra": "ABA: Clientes — Obrigatórios: RazaoSocial, CNPJ, Segmento" },
    { "Regra": "ABA: ContatosClientes — Obrigatórios: ClienteCNPJ, Nome, Telefone, Email" },
    { "Regra": "ABA: Representadas — Obrigatório: Nome" },
    { "Regra": "ABA: Projetos — Obrigatórios: NomeProjeto, TipoProjeto, Status" },
    { "Regra": "ABA: ContatosProjetos — Obrigatórios: ProjetoNome, Nome, Telefone, Email" },
    { "Regra": "ABA: AtualizacoesProjetos — Obrigatórios: ProjetoNome, Texto" },
    { "Regra": "ABA: Ofertas — Obrigatórios: BU, RazaoSocial, Solicitante, Telefone, Email, RepresentadaNome, ValorTotal, Status, TipoNegocio, NumeroOferta" },
    { "Regra": "" },
    { "Regra": "Valores aceitos para TipoNegocio: compra | orcamento" },
    { "Regra": "Valores aceitos para PossuiPedido / PossuiRevisao / AtendimentoSpot: sim | nao" },
    { "Regra": "Principal (contatos): Sim | Não  (apenas um contato por cliente/projeto deve ser Sim)" },
  ];

  // ── CLIENTES ──────────────────────────────────────────────────────────────
  const clientesModelo = [
    {
      RazaoSocial: "Empresa Exemplo Ltda",
      CNPJ: "12.345.678/0001-99",
      IE: "123.456.789.000",
      Endereco: "Rua das Indústrias, 100 — São Paulo/SP",
      Segmento: "Industrial",
      SAP: "",
    },
    {
      RazaoSocial: "Indústria Modelo S.A.",
      CNPJ: "98.765.432/0001-11",
      IE: "",
      Endereco: "Av. Central, 456 — Rio de Janeiro/RJ",
      Segmento: "OGP",
      SAP: "SAP-9001",
    },
  ];

  // ── CONTATOS DE CLIENTES ──────────────────────────────────────────────────
  const contatosClientesModelo = [
    {
      ClienteCNPJ: "12.345.678/0001-99",
      Nome: "João da Silva",
      Telefone: "(11) 99999-9999",
      Email: "joao@empresa.com",
      Funcao: "Comprador",
      Principal: "Sim",
      ResponsavelId: "",
      ResponsavelNome: "",
    },
    {
      ClienteCNPJ: "12.345.678/0001-99",
      Nome: "Ana Costa",
      Telefone: "(11) 98888-8888",
      Email: "ana@empresa.com",
      Funcao: "Engenheira",
      Principal: "Não",
      ResponsavelId: "",
      ResponsavelNome: "",
    },
    {
      ClienteCNPJ: "98.765.432/0001-11",
      Nome: "Carlos Souza",
      Telefone: "(21) 97777-7777",
      Email: "carlos@industria.com",
      Funcao: "Gerente de Compras",
      Principal: "Sim",
      ResponsavelId: "",
      ResponsavelNome: "",
    },
  ];

  // ── REPRESENTADAS ─────────────────────────────────────────────────────────
  const representadasModelo = [
    { Nome: "Fabricante Exemplo" },
    { Nome: "Distribuidora Modelo" },
  ];

  // ── PROJETOS ──────────────────────────────────────────────────────────────
  const projetosModelo = [
    {
      NomeProjeto: "Projeto Expansão Planta",
      TipoProjeto: "Expansão",
      Status: "Em andamento",
      NumeroReferencia: "REF-2026-001",
      PrazoFinal: "2026-12-31",
      ValorInvestimento: "R$ 2.500.000,00",
      PrevFechamento: "2026-09-30",
      InicioEntregas: "2026-06-01",
      FimEntregas: "2026-11-30",
      Observacoes: "Projeto prioritário.",
    },
    {
      NomeProjeto: "Projeto Modernização Linha 3",
      TipoProjeto: "Retrofit",
      Status: "Em análise",
      NumeroReferencia: "REF-2026-002",
      PrazoFinal: "2027-03-31",
      ValorInvestimento: "",
      PrevFechamento: "",
      InicioEntregas: "",
      FimEntregas: "",
      Observacoes: "",
    },
  ];

  // ── CONTATOS DE PROJETOS ──────────────────────────────────────────────────
  const contatosProjetosModelo = [
    {
      ProjetoNome: "Projeto Expansão Planta",
      ProjetoReferencia: "REF-2026-001",
      Nome: "Pedro Lima",
      Telefone: "(11) 96666-6666",
      Email: "pedro@empresa.com",
      Funcao: "Responsável Técnico",
      Principal: "Sim",
      ResponsavelId: "",
      ResponsavelNome: "",
    },
    {
      ProjetoNome: "Projeto Modernização Linha 3",
      ProjetoReferencia: "REF-2026-002",
      Nome: "Fernanda Rocha",
      Telefone: "(21) 95555-5555",
      Email: "fernanda@industria.com",
      Funcao: "Coordenadora",
      Principal: "Sim",
      ResponsavelId: "",
      ResponsavelNome: "",
    },
  ];

  // ── ATUALIZAÇÕES DE PROJETOS ──────────────────────────────────────────────
  const atualizacoesProjetosModelo = [
    {
      ProjetoNome: "Projeto Expansão Planta",
      ProjetoReferencia: "REF-2026-001",
      Texto: "Reunião de kickoff realizada. Cronograma aprovado por todas as partes.",
      Data: "2026-03-28",
    },
    {
      ProjetoNome: "Projeto Expansão Planta",
      ProjetoReferencia: "REF-2026-001",
      Texto: "Revisão de escopo solicitada pelo cliente. Aguardando aprovação interna.",
      Data: "2026-04-15",
    },
  ];

  // ── OFERTAS ───────────────────────────────────────────────────────────────
  const ofertasModelo = [
    {
      // Oferta simples sem pedido
      BU: "OEM",
      Segmento: "Cranes",
      RazaoSocial: "Empresa Exemplo Ltda",
      ClienteCNPJ: "12.345.678/0001-99",
      RepresentadaNome: "Fabricante Exemplo",
      Solicitante: "João da Silva",
      Telefone: "(11) 99999-9999",
      Email: "joao@empresa.com",
      NumeroOferta: "OF-2026-001",
      TipoNegocio: "orcamento",
      ValorTotal: "R$ 150.000,00",
      RefCliente: "",
      Oportunidade: "",
      DataEntrada: "2026-03-28",
      Status: "Em andamento",
      DataEnvio: "2026-03-29",
      Unidade: "",
      Projeto: "Projeto Expansão Planta",
      AtendimentoSpot: "nao",
      ObservacoesGerais: "",
      PossuiPedido: "nao",
      NumeroPedido: "",
      ValorPedido: "",
      DataPO: "",
      CondicaoPagamento: "",
      RefProjetoPedido: "",
      TipoProduto: "",
      ObsPedido: "",
      PrazoEntregaContratual: "",
      SolicitacaoOC: "",
      RefOC: "",
      DataImplantacao: "",
      PossuiRevisao: "nao",
      RevisaoOfertaAnterior: "",
      RevisaoMudou: "",
    },
    {
      // Oferta com pedido
      BU: "OGP",
      Segmento: "On Shore",
      RazaoSocial: "Indústria Modelo S.A.",
      ClienteCNPJ: "98.765.432/0001-11",
      RepresentadaNome: "Distribuidora Modelo",
      Solicitante: "Carlos Souza",
      Telefone: "(21) 97777-7777",
      Email: "carlos@industria.com",
      NumeroOferta: "OF-2026-002",
      TipoNegocio: "compra",
      ValorTotal: "R$ 320.000,00",
      RefCliente: "RC-4521",
      Oportunidade: "OP-2026-012",
      DataEntrada: "2026-02-10",
      Status: "Pedido",
      DataEnvio: "2026-02-12",
      Unidade: "Mantex",
      Projeto: "Projeto Modernização Linha 3",
      AtendimentoSpot: "nao",
      ObservacoesGerais: "Cliente solicitou entrega parcelada.",
      PossuiPedido: "sim",
      NumeroPedido: "PO-98765",
      ValorPedido: "R$ 320.000,00",
      DataPO: "2026-02-20",
      CondicaoPagamento: "30/60/90",
      RefProjetoPedido: "PROJ-MOD-001",
      TipoProduto: "Equipamento",
      ObsPedido: "Frete incluso.",
      PrazoEntregaContratual: "2026-08-30",
      SolicitacaoOC: "SOC-2026-045",
      RefOC: "",
      DataImplantacao: "",
      PossuiRevisao: "nao",
      RevisaoOfertaAnterior: "",
      RevisaoMudou: "",
    },
  ];

  // ── MONTAR WORKBOOK ───────────────────────────────────────────────────────
  const sheets = [
    { data: instrucoes,                nome: "Instrucoes" },
    { data: clientesModelo,            nome: "Clientes" },
    { data: contatosClientesModelo,    nome: "ContatosClientes" },
    { data: representadasModelo,       nome: "Representadas" },
    { data: projetosModelo,            nome: "Projetos" },
    { data: contatosProjetosModelo,    nome: "ContatosProjetos" },
    { data: atualizacoesProjetosModelo,nome: "AtualizacoesProjetos" },
    { data: ofertasModelo,             nome: "Ofertas" },
  ];

  for (const { data, nome } of sheets) {
    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-largura de colunas
    if (data.length) {
      const headers = Object.keys(data[0]);
      ws["!cols"] = headers.map((h) => {
        const maxLen = data.reduce((m, row) => Math.max(m, String(row[h] ?? "").length), h.length);
        return { wch: Math.min(maxLen + 2, 50) };
      });
    }

    XLSX.utils.book_append_sheet(wb, ws, nome);
  }

  XLSX.writeFile(wb, "modelo_importacao_crm.xlsx");
}

function normalizarTexto(v) {
  return String(v ?? "").trim();
}

function normalizarEmail(v) {
  return String(v ?? "").trim().toLowerCase();
}

function normalizarCNPJ(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function gerarIdSeguroImportacao() {
  if (typeof gerarId === "function") return gerarId();
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return "id_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
}

function validarObrigatoriosLinha(obj, obrigatorios, contexto) {
  const erros = [];

  obrigatorios.forEach((campo) => {
    if (!normalizarTexto(obj[campo])) {
      erros.push(`${contexto}: campo obrigatório "${campo}" não preenchido`);
    }
  });

  return erros;
}

function chaveProjetoImport(nome, referencia) {
  return `${normalizarTexto(nome).toLowerCase()}|${normalizarTexto(referencia).toLowerCase()}`;
}

function chaveOfertaImport(numeroOferta, clienteCnpj) {
  return `${normalizarTexto(numeroOferta).toLowerCase()}|${normalizarCNPJ(clienteCnpj)}`;
}

function deveExigirSegmentoImportacao(bu) {
  if (!normalizarTexto(bu)) return false;
  if (typeof window.buTemSegmento === "function") {
    return !!window.buTemSegmento(normalizarTexto(bu));
  }
  return false;
}

function montarMensagemRelatorioImportacao(relatorio) {
  const categorias = [
    { label: "Clientes",               stats: relatorio.clientes },
    { label: "Representadas",          stats: relatorio.representadas },
    { label: "Projetos",               stats: relatorio.projetos },
    { label: "Ofertas",                stats: relatorio.ofertas },
    { label: "Contatos de Clientes",   stats: relatorio.contatosClientes },
    { label: "Contatos de Projetos",   stats: relatorio.contatosProjetos },
    { label: "Atualizações de Projetos", stats: relatorio.atualizacoesProjetos },
  ];

  const totalImportados = categorias.reduce((s, c) => s + c.stats.importados, 0);
  const totalFalhas     = categorias.reduce((s, c) => s + c.stats.falhas, 0);
  const totalAvisos     = (relatorio.avisos || []).length;
  const totalErros      = relatorio.erros.length;

  const catRows = categorias
    .filter(({ stats }) => stats.importados + stats.ignorados + stats.falhas > 0)
    .map(({ label, stats }) => {
      const partes = [];
      if (stats.importados) partes.push(`<span class="ir-ok">✓ ${stats.importados} importado${stats.importados !== 1 ? "s" : ""}</span>`);
      if (stats.ignorados)  partes.push(`<span class="ir-skip">↷ ${stats.ignorados} ignorado${stats.ignorados !== 1 ? "s" : ""}</span>`);
      if (stats.falhas)     partes.push(`<span class="ir-err">✕ ${stats.falhas} falha${stats.falhas !== 1 ? "s" : ""}</span>`);
      return `<div class="ir-cat-row"><span class="ir-cat-label">${esc(label)}</span><span class="ir-cat-stats">${partes.join("")}</span></div>`;
    })
    .join("");

  let avisosHtml = "";
  if (totalAvisos) {
    const items = (relatorio.avisos || []).map((a) => `<li>${esc(a)}</li>`).join("");
    avisosHtml = `
      <div class="ir-secao ir-avisos-wrap">
        <div class="ir-secao-titulo">⚠ ${totalAvisos} aviso${totalAvisos !== 1 ? "s" : ""} de coluna</div>
        <ul class="ir-lista">${items}</ul>
      </div>`;
  }

  let errosHtml = "";
  if (totalErros) {
    const MAX_INLINE = 30;
    const items = relatorio.erros.slice(0, MAX_INLINE).map((e) => `<li>${esc(e)}</li>`).join("");
    const restante = totalErros > MAX_INLINE
      ? `<li class="ir-mais">… e mais ${totalErros - MAX_INLINE} erro(s). Baixe o relatório completo.</li>`
      : "";
    errosHtml = `
      <div class="ir-secao ir-erros-wrap">
        <div class="ir-secao-titulo">✕ ${totalErros} erro${totalErros !== 1 ? "s" : ""} encontrado${totalErros !== 1 ? "s" : ""}</div>
        <ul class="ir-lista">${items}${restante}</ul>
      </div>`;
  }

  const semErros = !totalFalhas && !totalAvisos && !totalErros
    ? `<div class="ir-sem-erros">Nenhum erro encontrado.</div>`
    : "";

  return `
    <div class="import-relatorio">
      <div class="ir-resumo-geral">
        <strong>${totalImportados}</strong> registro${totalImportados !== 1 ? "s" : ""} importado${totalImportados !== 1 ? "s" : ""}
        ${totalFalhas ? ` · <span class="ir-err">${totalFalhas} falha${totalFalhas !== 1 ? "s" : ""}</span>` : ""}
      </div>
      <div class="ir-cats">${catRows || '<span style="opacity:.6">Nenhum dado processado.</span>'}</div>
      ${avisosHtml}
      ${errosHtml}
      ${semErros}
    </div>
  `;
}

function obterTimestampBackupAutomatico() {
  return localStorage.getItem("ultimoBackupAutomaticoEm") || "";
}

function salvarTimestampBackupAutomatico(valor) {
  localStorage.setItem("ultimoBackupAutomaticoEm", valor);
}

function deveExecutarBackupAutomatico() {
  const ultimo = obterTimestampBackupAutomatico();
  if (!ultimo) return true;

  const ultimoMs = new Date(ultimo).getTime();
  const agoraMs = Date.now();

  if (Number.isNaN(ultimoMs)) return true;

  const intervalo24h = 24 * 60 * 60 * 1000;
  return agoraMs - ultimoMs >= intervalo24h;
}

async function criarBackupAutomaticoFirebase() {
  if (!window.db) {
    throw new Error("Firestore não está disponível.");
  }

  const agora = new Date();
  const timestamp = agora.toISOString();

  const currentUser =
    typeof getCurrentUserName === "function"
      ? getCurrentUserName()
      : "Sistema";

  const [snapClientes, snapRepresentadas, snapProjetos, snapOfertas] =
    await Promise.all([
      db.collection("clientes").get(),
      db.collection("representadas").get(),
      db.collection("projetos").get(),
      db.collection("ofertas").get(),
    ]);

  const clientesBackup = snapClientes.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const representadasBackup = snapRepresentadas.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const projetosBackup = snapProjetos.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const ofertasBackup = snapOfertas.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const backupId = `backup_${agora.getFullYear()}-${String(
    agora.getMonth() + 1
  ).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}_${String(
    agora.getHours()
  ).padStart(2, "0")}-${String(agora.getMinutes()).padStart(2, "0")}-${String(
    agora.getSeconds()
  ).padStart(2, "0")}`;

  const backupRef = db.collection("backups").doc(backupId);

  const grupos = {
    clientes: clientesBackup,
    representadas: representadasBackup,
    projetos: projetosBackup,
    ofertas: ofertasBackup,
  };

  const resumo = {
    clientes: clientesBackup.length,
    representadas: representadasBackup.length,
    projetos: projetosBackup.length,
    ofertas: ofertasBackup.length,
  };

  await backupRef.set({
    id: backupId,
    tipo: "automatico",
    criadoEm: timestamp,
    criadoPor: currentUser,
    resumo,
  });

  for (const [nomeColecao, items] of Object.entries(grupos)) {
    const lotes = dividirEmLotes(items, 100);

    await backupRef.collection("colecoes").doc(nomeColecao).set({
      total: items.length,
      totalLotes: lotes.length,
      atualizadoEm: timestamp,
    });

    for (let i = 0; i < lotes.length; i++) {
      await backupRef
        .collection("colecoes")
        .doc(nomeColecao)
        .collection("lotes")
        .doc(`parte_${String(i + 1).padStart(3, "0")}`)
        .set({
          indice: i + 1,
          totalLotes: lotes.length,
          items: lotes[i],
          atualizadoEm: timestamp,
        });
    }
  }

  salvarTimestampBackupAutomatico(timestamp);
  atualizarInfoUltimoBackupAutomatico();

  await manterApenasUltimos7BackupsAutomaticos();

  return { id: backupId, resumo };
}

async function verificarBackupAutomatico() {
  try {
    if (!deveExecutarBackupAutomatico()) return;
    await criarBackupAutomaticoFirebase();
  } catch (error) {
    console.error("Erro ao executar backup automático:", error);
  }
}

function atualizarInfoUltimoBackupAutomatico() {
  const el = document.getElementById("ultimoBackupAutoInfo");
  if (!el) return;

  const ultimo = obterTimestampBackupAutomatico();

  if (!ultimo) {
    el.textContent = "Último backup automático: ainda não executado.";
    return;
  }

  const data = new Date(ultimo);
  el.textContent = `Último backup automático: ${data.toLocaleString("pt-BR")}`;
}

function dividirEmLotes(array, tamanhoLote = 100) {
  const lotes = [];
  for (let i = 0; i < array.length; i += tamanhoLote) {
    lotes.push(array.slice(i, i + tamanhoLote));
  }
  return lotes;
}

async function apagarBackupCompletoFirebase(backupId) {
  const backupRef = db.collection("backups").doc(backupId);
  const colecoesSnap = await backupRef.collection("colecoes").get();

  for (const colecaoDoc of colecoesSnap.docs) {
    const lotesSnap = await backupRef
      .collection("colecoes")
      .doc(colecaoDoc.id)
      .collection("lotes")
      .get();

    if (!lotesSnap.empty) {
      const batchLotes = db.batch();
      lotesSnap.docs.forEach((doc) => batchLotes.delete(doc.ref));
      await batchLotes.commit();
    }
  }

  if (!colecoesSnap.empty) {
    const batchColecoes = db.batch();
    colecoesSnap.docs.forEach((doc) => batchColecoes.delete(doc.ref));
    await batchColecoes.commit();
  }

  await backupRef.delete();
}

async function manterApenasUltimos7BackupsAutomaticos() {
  const snap = await db
    .collection("backups")
    .orderBy("criadoEm", "desc")
    .get();

  const backups = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  if (backups.length <= 7) return;

  const excedentes = backups.slice(7);
  await Promise.all(excedentes.map((b) => apagarBackupCompletoFirebase(b.id)));
}

async function moverParaLixeira({ colecao, id, tipo, nomeExibicao = "" }) {
  await db.collection(colecao).doc(id).update({
    deletado: true,
    deletadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    deletadoPor: getUserNomeAtual(),
    deletadoPorEmail: getUserEmailAtual(),
    tipoLixeira: tipo,
    nomeLixeira: nomeExibicao || "",
  });

  // Arquiva alertas abertos da entidade — aparecem na aba "Arquivados"
  if (typeof arquivarAlertasDeEntidade === "function") {
    arquivarAlertasDeEntidade(id).catch(console.error);
  }
}

async function restaurarDaLixeira(colecao, id) {
  const del = firebase.firestore.FieldValue.delete();
  await db.collection(colecao).doc(id).update({
    deletado: del,
    deletadoEm: del,
    deletadoPor: del,
    deletadoPorEmail: del,
    tipoLixeira: del,
    nomeLixeira: del,
  });
}

async function excluirDefinitivamente(colecao, id) {
  if (!isAdmin()) {
    showToast("Apenas administradores podem excluir definitivamente.", "error");
    return;
  }

  await db.collection(colecao).doc(id).delete();
}

function mostrarToastDesfazer({ mensagem, onUndo }) {
  const antigo = document.getElementById("toastLixeira");
  if (antigo) antigo.remove();

  // Usa o mesmo container dos toasts normais (topo direito)
  let toastContainer = document.getElementById("crm-toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "crm-toast-container";
    toastContainer.setAttribute("style",
      "position:fixed;top:20px;right:20px;z-index:2147483647;" +
      "width:380px;max-width:calc(100vw - 32px);" +
      "pointer-events:none;display:block;margin:0;padding:0;border:none;background:none;"
    );
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement("div");
  toast.id = "toastLixeira";
  toast.style.cssText = "display:block;width:100%;box-sizing:border-box;";

  // card
  const card = document.createElement("div");
  card.style.cssText =
    "position:relative;box-sizing:border-box;width:100%;" +
    "padding:14px 14px 14px 56px;" +
    "background:#1a1f2e;border:1px solid #2d3650;border-radius:10px;" +
    "box-shadow:0 8px 24px rgba(0,0,0,0.55),0 2px 8px rgba(0,0,0,0.3);" +
    "pointer-events:all;" +
    "opacity:0;transform:translateX(16px);" +
    "transition:opacity 0.22s ease,transform 0.22s ease;";

  // ícone lixeira
  const iconWrap = document.createElement("div");
  iconWrap.style.cssText =
    "position:absolute;left:14px;top:50%;transform:translateY(-50%);" +
    "width:28px;height:28px;border-radius:7px;" +
    "background:#172554;display:flex;align-items:center;justify-content:center;color:#60a5fa;";
  iconWrap.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">' +
    '<path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"/>' +
    '</svg>';

  // texto
  const txt = document.createElement("div");
  txt.style.cssText =
    "font-size:13px;font-weight:500;color:#dbeafe;line-height:1.4;" +
    "display:inline;margin-right:12px;";
  txt.textContent = mensagem;

  // botão desfazer
  const btn = document.createElement("button");
  btn.textContent = "Desfazer";
  btn.style.cssText =
    "display:inline-block;padding:5px 14px;border-radius:6px;border:none;" +
    "background:#2563eb;color:#fff;font-size:12px;font-weight:700;" +
    "cursor:pointer;vertical-align:middle;width:auto;box-shadow:none;" +
    "transition:background 0.15s;letter-spacing:0.02em;";
  btn.addEventListener("mouseenter", () => { btn.style.background = "#1d4ed8"; });
  btn.addEventListener("mouseleave", () => { btn.style.background = "#2563eb"; });

  // barra de progresso
  const bar = document.createElement("div");
  bar.style.cssText =
    "position:absolute;bottom:0;left:0;height:3px;border-radius:0 0 10px 10px;" +
    "background:#2563eb;width:100%;transform-origin:left;" +
    "transition:width 8s linear;";

  const row = document.createElement("div");
  row.style.cssText = "display:flex;align-items:center;gap:0;flex-wrap:nowrap;";
  row.appendChild(txt);
  row.appendChild(btn);

  card.appendChild(iconWrap);
  card.appendChild(row);
  card.appendChild(bar);
  toast.appendChild(card);
  toastContainer.appendChild(toast);

  // entrada
  requestAnimationFrame(() => requestAnimationFrame(() => {
    card.style.opacity = "1";
    card.style.transform = "translateX(0)";
    bar.style.width = "0%";
  }));

  const fechar = () => {
    card.style.opacity = "0";
    card.style.transform = "translateX(16px)";
    setTimeout(() => toast.remove(), 260);
  };

  btn.onclick = async () => {
    try {
      btn.disabled = true;
      btn.textContent = "...";
      await onUndo();
      fechar();
    } catch (e) {
      console.error("Erro no DESFAZER:", e);
      showToast("Erro ao desfazer exclusão.", "error");
      btn.disabled = false;
      btn.textContent = "Desfazer";
    }
  };

  setTimeout(fechar, 8000);
}

const LIXEIRA_LIMIT_POR_COLECAO = 500;

async function buscarItensLixeira() {
  const colecoes = [
    { nome: "ofertas",       tipoPadrao: "registro" },
    { nome: "clientes",      tipoPadrao: "cliente" },
    { nome: "representadas", tipoPadrao: "representada" },
    { nome: "projetos",      tipoPadrao: "projeto" },
  ];

  // Queries em paralelo + limit para evitar carregar volumes desnecessários
  // Sem .orderBy() no Firestore — ordering é feito em JS abaixo (evita exigir índice composto)
  const snaps = await Promise.all(
    colecoes.map((col) =>
      db.collection(col.nome)
        .where("deletado", "==", true)
        .limit(LIXEIRA_LIMIT_POR_COLECAO)
        .get()
        .then((snap) => ({ snap, col }))
    )
  );

  const itens = snaps.flatMap(({ snap, col }) =>
    snap.docs.map((d) => ({
      id: d.id,
      colecao: col.nome,
      ...d.data(),
      tipoLixeira: d.data().tipoLixeira || col.tipoPadrao,
    }))
  );

  return itens.sort((a, b) => {
    const da  = normalizarDataFirestore(a.deletadoEm)?.getTime?.() || 0;
    const dbb = normalizarDataFirestore(b.deletadoEm)?.getTime?.() || 0;
    return dbb - da;
  });
}

function renderResumoLixeira(itens) {
  const resumo = {
    registro: 0,
    cliente: 0,
    representada: 0,
    projeto: 0,
  };

  itens.forEach((item) => {
    if (resumo[item.tipoLixeira] != null) {
      resumo[item.tipoLixeira]++;
    }
  });

  const el = document.getElementById("resumoLixeira");
  if (!el) return;

  el.innerHTML = `
  <div class="resumo-inline">
    <span><strong>Total:</strong> ${itens.length}</span>
    <span><strong>Registros:</strong> ${resumo.registro}</span>
    <span><strong>Clientes:</strong> ${resumo.cliente}</span>
    <span><strong>Representadas:</strong> ${resumo.representada}</span>
    <span><strong>Projetos:</strong> ${resumo.projeto}</span>
  </div>
`;
}

function alternarDataPersonalizadaLixeira() {
  const valor = document.getElementById("filtroDataLixeira")?.value || "";
  const wrapInicio = document.getElementById("wrapDataInicioLixeira");
  const wrapFim = document.getElementById("wrapDataFimLixeira");

  const exibir = valor === "personalizado";

  if (wrapInicio) wrapInicio.style.display = exibir ? "flex" : "none";
  if (wrapFim) wrapFim.style.display = exibir ? "flex" : "none";
}

function aplicarFiltrosLixeira() {
  const tipo = (document.getElementById("filtroTipoLixeira")?.value || "").toLowerCase();
  const usuario = (document.getElementById("filtroUsuarioLixeira")?.value || "").toLowerCase();
  const busca = (document.getElementById("buscaLixeira")?.value || "").toLowerCase();
  const filtroData = document.getElementById("filtroDataLixeira")?.value || "";
  const dataInicio = document.getElementById("filtroDataInicioLixeira")?.value || "";
  const dataFim = document.getElementById("filtroDataFimLixeira")?.value || "";

  itensLixeiraFiltrados = itensLixeira.filter((item) => {
    const nome = String(item.nomeLixeira || "").toLowerCase();
    const tipoItem = String(item.tipoLixeira || "").toLowerCase();
    const user = String(item.deletadoPor || item.deletadoPorEmail || "").toLowerCase();
    const data = normalizarDataFirestore(item.deletadoEm);

    if (tipo && tipoItem !== tipo) return false;
    if (usuario && !user.includes(usuario)) return false;

    if (busca) {
      const textoBusca = [
        item.nomeLixeira || "",
        item.deletadoPor || "",
        item.deletadoPorEmail || "",
        item.tipoLixeira || "",
      ].join(" ").toLowerCase();

      if (!textoBusca.includes(busca)) return false;
    }

    if (filtroData && data) {
      const hoje = new Date();
      const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

      if (filtroData === "hoje") {
        if (data < inicioHoje) return false;
      } else if (["1", "3", "7"].includes(filtroData)) {
        const dias = Number(filtroData);
        const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
        if (data < limite) return false;
      } else if (filtroData === "personalizado") {
        if (dataInicio) {
          const dtIni = new Date(dataInicio + "T00:00:00");
          if (data < dtIni) return false;
        }
        if (dataFim) {
          const dtFim = new Date(dataFim + "T23:59:59");
          if (data > dtFim) return false;
        }
      }
    }

    return true;
  });

  paginaLixeiraAtual = 1;
  renderResumoLixeira(itensLixeiraFiltrados);
  renderTabelaLixeira();
}

function renderTabelaLixeira() {
  const tbody = DOM.tbodyLixeira || document.getElementById("tbodyLixeira");
  const pageInfo = DOM.pageInfoLixeira || document.getElementById("pageInfoLixeira");
  const btnPrev = DOM.btnPrevLixeira || document.getElementById("btnPrevLixeira");
  const btnNext = DOM.btnNextLixeira || document.getElementById("btnNextLixeira");

  if (!tbody) return;

  tbody.innerHTML = "";

  const { pageData: itensPagina, totalPages: totalPaginas, safePage } = getPaginatedData(
    itensLixeiraFiltrados, paginaLixeiraAtual, ITENS_POR_PAGINA_LIXEIRA
  );
  paginaLixeiraAtual = safePage;

  if (!itensPagina.length) {
    tbody.innerHTML = `<tr><td colspan="6">Nenhum item encontrado.</td></tr>`;
  } else {
    itensPagina.forEach((item) => {
      const dataExc = normalizarDataFirestore(item.deletadoEm);
      const diasPassados = diasDesdeData(dataExc);
      const diasRestantes = Math.max(0, 7 - diasPassados);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.nomeLixeira || "-"}</td>
        <td>${item.tipoLixeira || "-"}</td>
        <td>${item.deletadoPor || item.deletadoPorEmail || "-"}</td>
        <td>${formatarDataHoraBR(dataExc)}</td>
        <td>${diasRestantes}</td>
        <td style="text-align:center;">
          <button class="btn-kebab" type="button" onclick="openActionsMenu(event,'lixeira_item','${item.id}',{colecao:'${item.colecao}'})">...</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  if (pageInfo) {
    pageInfo.textContent = `Página ${paginaLixeiraAtual} de ${totalPaginas}`;
  }

  if (btnPrev) btnPrev.disabled = paginaLixeiraAtual <= 1;
  if (btnNext) btnNext.disabled = paginaLixeiraAtual >= totalPaginas;
}

function trocarPaginaLixeira(pagina) {
  paginaLixeiraAtual = pagina;
  renderTabelaLixeira();
}

async function restaurarItemLixeira(colecao, id) {
  try {
    await restaurarDaLixeira(colecao, id);
    await carregarLixeira();

    await carregarClientesFirebase?.();
    await carregarRepresentadasFirebase?.();
    await carregarRegistrosFirebase?.();
    await carregarProjetosFirebase?.();

    renderTabela?.();
    renderTabelaClientes?.();
    renderTabelaRepresentadas?.();
    renderTabelaProjetos?.();
    preencherSelectRepresentadas?.();
  } catch (e) {
    console.error(e);
    showToast("Erro ao restaurar item.", "error");
  }
}

async function excluirItemDefinitivo(colecao, id) {
  if (!isAdmin()) {
    showToast("Apenas administradores podem excluir definitivamente.", "error");
    return;
  }

  if (!await showConfirm("Esta ação não pode ser desfeita. O item será removido permanentemente.", { title: "Excluir Definitivamente", confirmText: "Excluir" })) return;

  try {
    const alertasSnap = await db.collection("alertas")
      .where("entidadeId", "==", id).get();

    const batch = db.batch();
    alertasSnap.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(db.collection(colecao).doc(id));
    await batch.commit();

    await carregarLixeira();
  } catch (e) {
    console.error(e);
    showToast("Erro ao excluir definitivamente.", "error");
  }
}

async function limparLixeiraManual() {
  if (!isAdmin()) {
    showToast("Apenas administradores podem limpar a lixeira.", "error");
    return;
  }

  if (!await showConfirm("Todos os itens da lixeira serão removidos permanentemente. Esta ação não pode ser desfeita.", { title: "Limpar Lixeira", confirmText: "Excluir Tudo" })) return;

  try {
    const itens = await buscarItensLixeira();

    for (const item of itens) {
      const alertasSnap = await db.collection("alertas")
        .where("entidadeId", "==", item.id).get();

      const batch = db.batch();
      alertasSnap.docs.forEach((doc) => batch.delete(doc.ref));
      batch.delete(db.collection(item.colecao).doc(item.id));
      await batch.commit();
    }

    await carregarLixeira();
    showToast("Lixeira limpa com sucesso.", "success");
  } catch (e) {
    console.error(e);
    showToast("Erro ao limpar lixeira.", "error");
  }
}

async function limparLixeiraExpirada() {
  const agora = Date.now();
  const seteDiasMs = 7 * 24 * 60 * 60 * 1000;
  const colecoes = ["ofertas", "clientes", "representadas", "projetos"];

  for (const colecao of colecoes) {
    const snap = await db.collection(colecao).where("deletado", "==", true).get();

    for (const docSnap of snap.docs) {
      const dados = docSnap.data();
      const deletadoEm = normalizarDataFirestore(dados.deletadoEm);
      if (!deletadoEm) continue;

      if (agora - deletadoEm.getTime() >= seteDiasMs) {
        const alertasSnap = await db.collection("alertas")
          .where("entidadeId", "==", docSnap.id).get();

        const batch = db.batch();
        alertasSnap.docs.forEach((doc) => batch.delete(doc.ref));
        batch.delete(docSnap.ref);
        await batch.commit();
      }
    }
  }
}

function marcarItemTemporarioComoRemovido(lista, index, tipo = "item") {
  const item = lista[index];
  if (!item) return;

  item._removido = true;
  item._removidoEm = new Date().toISOString();
  item._removidoPor = getUserNomeAtual();
  item._tipoRemovido = tipo;
}

function restaurarItemTemporario(lista, index) {
  const item = lista[index];
  if (!item) return;

  item._removido = false;
  item._removidoEm = null;
  item._removidoPor = null;
  item._tipoRemovido = null;
}

function obterItensTemporariosAtivos(lista) {
  return (lista || []).filter((item) => !item?._removido);
}

function obterItensTemporariosRemovidos(lista) {
  return (lista || []).filter((item) => item?._removido);
}

function renderMiniLixeiraContatos() {
  const el = document.getElementById("miniLixeiraContatos");
  if (!el) return;

  const removidos = obterItensTemporariosRemovidos(contatosTemp);

  if (!removidos.length) {
    el.innerHTML = "";
    return;
  }

  el.innerHTML = `
    <h4>Mini lixeira de contatos (${removidos.length})</h4>
    ${removidos.map((ct) => {
    const indiceReal = contatosTemp.indexOf(ct);
    return `
        <div class="item-mini-lixeira">
          <span>${ct.nome || ""} - ${ct.email || ""}</span>
          <button type="button" class="btn-sm" onclick="restaurarContatoMiniLixeira(${indiceReal})">Restaurar</button>
        </div>
      `;
  }).join("")}
  `;
}

function restaurarContatoMiniLixeira(index) {
  restaurarItemTemporario(contatosTemp, index);
  renderListaContatos();
  renderMiniLixeiraContatos();
}

function renderMiniLixeiraContatosProjeto() {
  const el = document.getElementById("miniLixeiraContatosProjeto");
  if (!el) return;

  const removidos = obterItensTemporariosRemovidos(projetoContatosTemp);

  if (!removidos.length) {
    el.innerHTML = "";
    return;
  }

  el.innerHTML = `
    <h4>Mini lixeira de contatos do projeto (${removidos.length})</h4>
    ${removidos.map((ct) => {
    const indiceReal = projetoContatosTemp.indexOf(ct);
    return `
        <div class="item-mini-lixeira">
          <span>${ct.nome || ""} - ${ct.email || ""}</span>
          <button type="button" class="btn-sm" onclick="restaurarContatoProjetoMiniLixeira(${indiceReal})">Restaurar</button>
        </div>
      `;
  }).join("")}
  `;
}

function restaurarContatoProjetoMiniLixeira(index) {
  restaurarItemTemporario(projetoContatosTemp, index);
  renderListaContatosProjeto();
  renderMiniLixeiraContatosProjeto();
}

function renderMiniLixeiraAtualizacoesProjeto() {
  const el = document.getElementById("miniLixeiraAtualizacoesProjeto");
  if (!el) return;

  const removidos = obterItensTemporariosRemovidos(projetoAtualizacoesTemp);

  if (!removidos.length) {
    el.innerHTML = "";
    return;
  }

  el.innerHTML = `
    <h4>Mini lixeira de atualizações (${removidos.length})</h4>
    ${removidos.map((item) => {
    const indiceReal = projetoAtualizacoesTemp.indexOf(item);
    return `
        <div class="item-mini-lixeira">
          <span>${item.titulo || item.status || item.descricao || item.texto || "Atualização"}</span>
          <button type="button" class="btn-sm" onclick="restaurarAtualizacaoProjetoMiniLixeira(${indiceReal})">Restaurar</button>
        </div>
      `;
  }).join("")}
  `;
}

function restaurarAtualizacaoProjetoMiniLixeira(index) {
  restaurarItemTemporario(projetoAtualizacoesTemp, index);
  renderListaAtualizacoesProjeto();
  renderMiniLixeiraAtualizacoesProjeto();
}

function aplicarPageSizeLixeira() {
  const input = document.getElementById("pageSizeLixeira");
  if (!input) return;

  const valor = parseInt(input.value, 10);

  if (isNaN(valor) || valor < 1) {
    input.value = ITENS_POR_PAGINA_LIXEIRA;
    return;
  }

  ITENS_POR_PAGINA_LIXEIRA = Math.min(Math.max(valor, 1), 200);
  localStorage.setItem("pageSizeLixeira", String(ITENS_POR_PAGINA_LIXEIRA));
  paginaLixeiraAtual = 1;
  renderTabelaLixeira();
}

function irParaPaginaLixeira() {
  const input = document.getElementById("gotoPageLixeira");
  if (!input) return;

  const valor = parseInt(input.value, 10);
  if (!valor || valor < 1) return;

  const totalPaginas = Math.max(
    1,
    Math.ceil(itensLixeiraFiltrados.length / ITENS_POR_PAGINA_LIXEIRA)
  );

  paginaLixeiraAtual = Math.min(valor, totalPaginas);
  renderTabelaLixeira();
  input.value = "";
}

async function recarregarDadosPrincipais() {
  await Promise.all([
    carregarRegistrosFirebase(),
    carregarClientesFirebase(),
    carregarRepresentadasFirebase(),
    carregarProjetosFirebase(),
  ]);

  renderTabela?.();
  renderTabelaClientes?.();
  renderTabelaRepresentadas?.();
  renderTabelaProjetos?.();
  preencherSelectRepresentadas?.();
}

function usuarioEhAdmin() {
  return window.permissoesCRM?.role === "admin";
}

function usuarioEhSupervisor() {
  return window.permissoesCRM?.role === "supervisor";
}

function usuarioPodeVerResponsavel(emailResponsavel) {
  const permissoes = window.permissoesCRM;
  if (!permissoes) return false;

  const email = String(emailResponsavel || "").toLowerCase().trim();

  if (permissoes.role === "admin") return true;
  if (Array.isArray(permissoes.podeVerDe) && permissoes.podeVerDe.includes("*")) return true;

  // Sempre vê o que ele mesmo criou
  const meuEmail = String(window.auth?.currentUser?.email || "").toLowerCase().trim();
  if (email && email === meuEmail) return true;

  return Array.isArray(permissoes.podeVerDe)
    ? permissoes.podeVerDe.includes(email)
    : false;
}

function obterEmailResponsavelItem(item) {
  const email = String(
    item?.responsavelEmail ||
    item?.emailResponsavel ||
    item?.criadoPorEmail ||
    item?.criadoPor ||
    ""
  ).toLowerCase().trim();

  if (email) return email;

  return String(window.auth?.currentUser?.email || "").toLowerCase().trim();
}

function filtrarPorPermissao(lista) {
  if (!Array.isArray(lista)) return [];
  const p = window.permissoesCRM;
  if (!p || p.role === "admin") return lista;

  // Filtra apenas ofertas (possuem representadaId); clientes/projetos/representadas são catálogos compartilhados
  if (lista.length === 0 || !("representadaId" in lista[0])) return lista;

  // representadasPermitidas configuradas → filtra por ID de representada
  if (Array.isArray(p.representadasPermitidas)) {
    if (p.representadasPermitidas.includes("*")) return lista;
    return lista.filter(item => !item.representadaId || p.representadasPermitidas.includes(item.representadaId));
  }

  // Sem configuração → mostra apenas ofertas do próprio usuário
  const myEmail = String(window.auth?.currentUser?.email || "").toLowerCase().trim();
  return lista.filter(item => {
    const resp = String(item.responsavelEmail || item.emailResponsavel || item.criadoPorEmail || item.criadoPor || "").toLowerCase().trim();
    return resp === myEmail;
  });
}

// Aliases — mesma lógica de permissão para todos os tipos
const filtrarRegistrosPorPermissao     = filtrarPorPermissao;
const filtrarClientesPorPermissao      = filtrarPorPermissao;
const filtrarProjetosPorPermissao      = filtrarPorPermissao;
const filtrarRepresentadasPorPermissao = filtrarPorPermissao;

// ================================================================
// FILTROS PERSISTIDOS POR SESSÃO (sessionStorage)
// ================================================================

const FILTROS_KEYS = {
  registros:     "crm_filtros_registros",
  clientes:      "crm_filtros_clientes",
  projetos:      "crm_filtros_projetos",
  representadas: "crm_filtros_representadas",
};

function _lerLinhasFiltros(containerId) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return [];
  return Array.from(wrap.querySelectorAll(".filter-item")).map((row) => ({
    field: row.querySelector(".multiField")?.value || "todos",
    term:  row.querySelector(".multiTerm")?.value  || "",
  }));
}

function _salvarFiltrosRegistros() {
  try {
    sessionStorage.setItem(FILTROS_KEYS.registros, JSON.stringify({
      rows:    _lerLinhasFiltros("filtersRegistros"),
      status:  document.getElementById("statusFilter")?.value  || "",
      pedido:  document.getElementById("pedidoFilter")?.value  || "todos",
      revisao: document.getElementById("revisaoFilter")?.value || "todos",
    }));
  } catch (_) {}
}

function _salvarFiltrosClientes() {
  try {
    sessionStorage.setItem(FILTROS_KEYS.clientes, JSON.stringify({
      rows: _lerLinhasFiltros("filtersClientes"),
    }));
  } catch (_) {}
}

function _salvarFiltrosProjetos() {
  try {
    sessionStorage.setItem(FILTROS_KEYS.projetos, JSON.stringify({
      rows: _lerLinhasFiltros("filtersProjetos"),
    }));
  } catch (_) {}
}

function _salvarFiltrosRepresentadas() {
  try {
    sessionStorage.setItem(FILTROS_KEYS.representadas, JSON.stringify({
      search: document.getElementById("searchRepresentadas")?.value || "",
    }));
  } catch (_) {}
}

function _restaurarFiltrosRegistros() {
  try {
    const raw = sessionStorage.getItem(FILTROS_KEYS.registros);
    if (!raw) return;
    const state = JSON.parse(raw);

    const wrap = document.getElementById("filtersRegistros");
    if (wrap) {
      wrap.innerHTML = "";
      const rows = state.rows || [];
      rows.forEach((r) => addFiltroRegistroRow({ field: r.field, term: r.term }));
      if (!wrap.children.length) addFiltroRegistroRow();
    }

    const sf = document.getElementById("statusFilter");
    if (sf) sf.value = state.status || "";
    const pf = document.getElementById("pedidoFilter");
    if (pf) pf.value = state.pedido || "todos";
    const rf = document.getElementById("revisaoFilter");
    if (rf) rf.value = state.revisao || "todos";
  } catch (_) {}
}

function _restaurarFiltrosClientes() {
  try {
    const raw = sessionStorage.getItem(FILTROS_KEYS.clientes);
    if (!raw) return;
    const state = JSON.parse(raw);
    const wrap = document.getElementById("filtersClientes");
    if (!wrap) return;
    wrap.innerHTML = "";
    const rows = state.rows || [];
    rows.forEach((r) => addFiltroClienteRow(r.field, r.term));
    if (!wrap.children.length) addFiltroClienteRow();
  } catch (_) {}
}

function _restaurarFiltrosProjetos() {
  try {
    const raw = sessionStorage.getItem(FILTROS_KEYS.projetos);
    if (!raw) return;
    const state = JSON.parse(raw);
    const wrap = document.getElementById("filtersProjetos");
    if (!wrap) return;
    wrap.innerHTML = "";
    const rows = state.rows || [];
    rows.forEach((r) => addFiltroProjetoRow(r.field, r.term));
    if (!wrap.children.length) addFiltroProjetoRow();
  } catch (_) {}
}

function _restaurarFiltrosRepresentadas() {
  try {
    const raw = sessionStorage.getItem(FILTROS_KEYS.representadas);
    if (!raw) return;
    const state = JSON.parse(raw);
    const el = document.getElementById("searchRepresentadas");
    if (el && state.search) el.value = state.search;
  } catch (_) {}
}

function initFiltrosPersistidos() {
  // Auto-salva em qualquer mudança nos containers de filtro
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.closest("#filtersRegistros") ||
        t.id === "statusFilter" || t.id === "pedidoFilter" || t.id === "revisaoFilter") {
      _salvarFiltrosRegistros();
    }
    if (t.closest("#filtersClientes"))  _salvarFiltrosClientes();
    if (t.closest("#filtersProjetos"))  _salvarFiltrosProjetos();
    if (t.id === "searchRepresentadas") _salvarFiltrosRepresentadas();
  });
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.closest("#filtersRegistros") || t.id === "statusFilter") _salvarFiltrosRegistros();
    if (t.closest("#filtersClientes"))  _salvarFiltrosClientes();
    if (t.closest("#filtersProjetos"))  _salvarFiltrosProjetos();
    if (t.id === "searchRepresentadas") _salvarFiltrosRepresentadas();
  });

  // Limpar sessionStorage quando o usuário pressiona "Limpar filtros"
  document.addEventListener("click", (e) => {
    const id = e.target?.id;
    if (id === "btnLimparFiltros" || id === "btnVerTudo")
      sessionStorage.removeItem(FILTROS_KEYS.registros);
    if (id === "btnLimparFiltrosClientes")
      sessionStorage.removeItem(FILTROS_KEYS.clientes);
    if (id === "btnLimparFiltrosProjetos")
      sessionStorage.removeItem(FILTROS_KEYS.projetos);
  });
}

// ─── Export de Projeto ───────────────────────────────────────────────────────

function exportarProjeto(id) {
  window._exportProjetoId = id;
  const proj = projetos.find((p) => p.id === id);
  const titulo = document.getElementById("modalExportarProjetoTitulo");
  if (titulo) titulo.textContent = "Exportar — " + (proj?.nome || "Projeto");
  const modal = document.getElementById("modalExportarProjeto");
  if (modal) modal.classList.remove("hidden");
}

function fecharModalExportarProjeto() {
  const modal = document.getElementById("modalExportarProjeto");
  if (modal) modal.classList.add("hidden");
}

function exportarProjetoExcel(id) {
  const proj = projetos.find((p) => p.id === id);
  if (!proj) return;
  const ofertasDoProjeto = registros.filter((r) => r.projetoId === id);
  const wb = XLSX.utils.book_new();

  // Aba Projeto
  const dadosProjeto = [{
    "Nome": proj.nome || "",
    "Tipo": proj.tipo || "",
    "Status": proj.status || "",
    "N° Referência": proj.numero_referencia || "",
    "Prazo Final": formatDateBR(proj.prazo_final) || "",
    "Valor do Investimento": proj.valor_investimento || "",
    "Prev. Fechamento": formatDateBR(proj.prev_fechamento) || "",
    "Início das Entregas": formatDateBR(proj.inicio_entregas) || "",
    "Fim das Entregas": formatDateBR(proj.fim_entregas) || "",
    "Observações": proj.obs || "",
    "Responsável": formatarNomeUsuario(proj.atualizadoPor || proj.criadoPor || ""),
    "Criado em": formatDateTimeBR(proj.criadoEm) || "",
    "Atualizado em": formatDateTimeBR(proj.atualizadoEm) || "",
  }];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dadosProjeto), "Projeto");

  // Aba Contatos
  const dadosContatos = (proj.contatos || []).map((ct) => ({
    "Nome": ct.nome || "",
    "Função": ct.funcao || "",
    "Telefone": ct.telefone || "",
    "E-mail": ct.email || "",
    "Principal": ct.principal ? "Sim" : "Não",
    "Responsável CRM": ct.responsavelNome || "",
  }));
  if (dadosContatos.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dadosContatos), "Contatos");

  // Aba Atualizações
  const dadosAtualizacoes = (proj.atualizacoes || []).map((up) => ({
    "Responsável": primeiroNome(up.atualizadoPor || up.criadoPor || ""),
    "Data": formatDateTimeBR(up.atualizadoEm || up.criadoEm) || "",
    "Texto": up.texto || "",
  }));
  if (dadosAtualizacoes.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dadosAtualizacoes), "Atualizações");

  // Aba Ofertas
  const dadosOfertas = ofertasDoProjeto.map((reg) => ({
    "Oferta": reg.oferta || "",
    "Razão Social": reg.razao || "",
    "Representada": reg.representadaNome || "",
    "Status": reg.status || "",
    "Tipo": reg.tipo_oferta || "",
    "Tem Pedido": reg.possuiPedido === "sim" ? "Sim" : "Não",
    "Valor Total": reg.valor_total || "",
    "Usuário": formatarNomeUsuario(reg.atualizadoPor || reg.criadoPor || ""),
    "Criado em": reg.criadoEm ? new Date(reg.criadoEm).toLocaleDateString("pt-BR") : "",
  }));
  if (dadosOfertas.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dadosOfertas), "Ofertas");

  XLSX.writeFile(wb, "projeto_" + (proj.nome || id).replace(/[^a-z0-9]/gi, "_") + ".xlsx");
  fecharModalExportarProjeto();
}

function exportarProjetoExcelResumo(id) {
  const proj = projetos.find((p) => p.id === id);
  if (!proj) return;
  const wb = XLSX.utils.book_new();
  const dados = [{
    "Nome": proj.nome || "",
    "Tipo": proj.tipo || "",
    "Status": proj.status || "",
    "N° Referência": proj.numero_referencia || "",
    "Prazo Final": formatDateBR(proj.prazo_final) || "",
    "Valor do Investimento": proj.valor_investimento || "",
    "Qtd. Contatos": (proj.contatos || []).length,
    "Qtd. Ofertas": registros.filter((r) => r.projetoId === id).length,
    "Responsável": formatarNomeUsuario(proj.atualizadoPor || proj.criadoPor || ""),
    "Atualizado em": formatDateTimeBR(proj.atualizadoEm) || "",
  }];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados), "Resumo");
  XLSX.writeFile(wb, "projeto_resumo_" + (proj.nome || id).replace(/[^a-z0-9]/gi, "_") + ".xlsx");
  fecharModalExportarProjeto();
}

function _gerarHtmlPdfProjeto(proj, incluirDetalhes) {
  const ofertasDoProjeto = registros.filter((r) => r.projetoId === proj.id);
  const contatos = proj.contatos || [];
  const atualizacoes = proj.atualizacoes || [];
  const usuario = formatarNomeUsuario(proj.atualizadoPor || proj.criadoPor || "");

  const row = (label, val) => val
    ? `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(String(val))}</td></tr>`
    : "";

  let body = `
    <h2>${escapeHtml(proj.nome || "Projeto")}</h2>
    <p class="meta">Gerado em: ${new Date().toLocaleString("pt-BR")}</p>
    <h3>Dados do Projeto</h3>
    <table>
      ${row("Tipo", proj.tipo)}
      ${row("Status", proj.status)}
      ${row("N° Referência", proj.numero_referencia)}
      ${row("Prazo Final", formatDateBR(proj.prazo_final))}
      ${row("Valor do Investimento", proj.valor_investimento)}
      ${row("Prev. Fechamento", formatDateBR(proj.prev_fechamento))}
      ${row("Início das Entregas", formatDateBR(proj.inicio_entregas))}
      ${row("Fim das Entregas", formatDateBR(proj.fim_entregas))}
      ${row("Qtd. Ofertas", String(ofertasDoProjeto.length))}
      ${proj.obs ? row("Observações", proj.obs) : ""}
      ${row("Responsável", usuario)}
      ${row("Criado em", formatDateTimeBR(proj.criadoEm))}
      ${row("Atualizado em", formatDateTimeBR(proj.atualizadoEm))}
    </table>
  `;

  if (incluirDetalhes && contatos.length) {
    body += `<h3>Contatos (${contatos.length})</h3><table><thead><tr><th>Nome</th><th>Função</th><th>Telefone</th><th>E-mail</th><th>Principal</th></tr></thead><tbody>`;
    contatos.forEach((ct) => {
      body += `<tr>
        <td>${escapeHtml(ct.nome || "-")}</td>
        <td>${escapeHtml(ct.funcao || "-")}</td>
        <td>${escapeHtml(ct.telefone || "-")}</td>
        <td>${escapeHtml(ct.email || "-")}</td>
        <td>${ct.principal ? "Sim" : "Não"}</td>
      </tr>`;
    });
    body += "</tbody></table>";
  }

  if (incluirDetalhes && atualizacoes.length) {
    body += `<h3>Atualizações (${atualizacoes.length})</h3>`;
    atualizacoes.forEach((up) => {
      body += `<div class="update-card">
        <div class="update-meta">${escapeHtml(primeiroNome(up.atualizadoPor || up.criadoPor || "-"))} — ${escapeHtml(formatDateTimeBR(up.atualizadoEm || up.criadoEm) || "")}</div>
        <div class="update-texto">${escapeHtml(up.texto || "").replace(/\n/g, "<br>")}</div>
      </div>`;
    });
  }

  if (incluirDetalhes && ofertasDoProjeto.length) {
    body += `<h3>Ofertas vinculadas (${ofertasDoProjeto.length})</h3><table><thead><tr><th>Oferta</th><th>Razão Social</th><th>Representada</th><th>Status</th><th>Tem Pedido</th><th>Valor Total</th></tr></thead><tbody>`;
    ofertasDoProjeto.forEach((reg) => {
      body += `<tr>
        <td>${escapeHtml(reg.oferta || "-")}</td>
        <td>${escapeHtml(reg.razao || "-")}</td>
        <td>${escapeHtml(reg.representadaNome || "-")}</td>
        <td>${escapeHtml(reg.status || "-")}</td>
        <td>${reg.possuiPedido === "sim" ? "Sim" : "Não"}</td>
        <td>${escapeHtml(reg.valor_total || "-")}</td>
      </tr>`;
    });
    body += "</tbody></table>";
  }

  return `<html><head><title>${escapeHtml(proj.nome || "Projeto")}</title><style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: Arial, sans-serif; font-size: 9px; color: #000; margin: 0; }
    h2 { font-size: 14px; margin: 0 0 4px; }
    h3 { font-size: 11px; margin: 14px 0 4px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
    .meta { font-size: 8px; color: #666; margin: 0 0 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th, td { border: 1px solid #ccc; padding: 3px 5px; vertical-align: top; text-align: left; }
    thead th { background: #eee; font-weight: bold; }
    tbody tr:nth-child(even) { background: #fafafa; }
    .update-card { border: 1px solid #ddd; border-radius: 4px; padding: 6px 8px; margin-bottom: 6px; }
    .update-meta { font-size: 8px; color: #666; margin-bottom: 3px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style></head><body>${body}</body></html>`;
}

function exportarProjetoPdf(id) {
  const proj = projetos.find((p) => p.id === id);
  if (!proj) return;
  const win = window.open("", "_blank");
  if (!win) { showToast("Desbloqueie popups no navegador.", "error"); return; }
  win.document.write(_gerarHtmlPdfProjeto(proj, true));
  win.document.close();
  win.focus();
  win.print();
  fecharModalExportarProjeto();
}

function exportarProjetoPdfResumo(id) {
  const proj = projetos.find((p) => p.id === id);
  if (!proj) return;
  const win = window.open("", "_blank");
  if (!win) { showToast("Desbloqueie popups no navegador.", "error"); return; }
  win.document.write(_gerarHtmlPdfProjeto(proj, false));
  win.document.close();
  win.focus();
  win.print();
  fecharModalExportarProjeto();
}

// ─── Fim Export de Projeto ───────────────────────────────────────────────────

// Expõe as funções de restauração para irPara()
window._restaurarFiltrosPorSecao = {
  registros:     _restaurarFiltrosRegistros,
  clientes:      _restaurarFiltrosClientes,
  projetos:      _restaurarFiltrosProjetos,
  representadas: _restaurarFiltrosRepresentadas,
};


