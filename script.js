let currentUserName = null;
function getCurrentUserName() {
  return currentUserName || "Desconhecido";
}
const ADMIN_EMAIL = "fabricio.giacomelli@threear.com.br";
function isAdminEmail(email) {
  return (
    String(email || "")
      .trim()
      .toLowerCase() === ADMIN_EMAIL
  );
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
  initClientesUI();
  initRepresentadasUI();
  initLigacaoClienteOferta();
  initBackupUI();
  initBuSegmento();
  initUnidadesMantex();

  initAuthTabs();
  initForgotPassword();
  initSignup();
  initResendEmailVerification();

  initAprovacaoUsuariosUI();
  initUsuariosExistentesUI();

  await esperarFirebase();

  console.log("Firebase OK:", { temAuth: !!window.auth, temDb: !!window.db });

  auth.onAuthStateChanged(async (user) => {
    try {
      if (!user) {
        totpOk = false;
        totpIsActive = false;
        totpUserEmail = null;
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
        alert("Verifique seu e-mail antes de acessar.");
        mostrarLogin();
        return;
      }

      const snap2 = await userRef.get();
      const udata = snap2.data() || {};
      const aprovado = !!udata.aprovado;
      const ativo = udata.ativo === undefined ? true : !!udata.ativo;

      if (!aprovado || !ativo) {
        alert("Usuário ainda não autorizado.");
        await auth.signOut();
        mostrarLogin();
        return;
      }

      function mostrarTelaBloqueada() {
        document.getElementById("appContainer")?.classList.add("hidden");
        document.getElementById("loginContainer")?.classList.add("hidden");
      }

      if (!totpOk) {
        await iniciarFluxoTOTP(user);
        mostrarTelaBloqueada();
        return;
      }

      await carregarDadosDoFirebase();
      atualizarSugestoesCnpj();
      mostrarApp();
    } catch (e) {
      console.error("Erro no onAuthStateChanged:", e);
      alert("Erro ao inicializar login. Veja o console.");
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

async function carregarDadosDoFirebase() {
  try {
    await Promise.all([
      carregarClientesFirebase(),
      carregarRepresentadasFirebase(),
      carregarRegistrosFirebase(),
      carregarUsuariosFirebase(),
    ]);

    preencherSelectRepresentadas();
    preencherSelectResponsaveisContato();

    renderTabela();
    renderTabelaClientes();
    renderTabelaRepresentadas();
    initAutoCompleteCnpjSimples();
  } catch (err) {
    console.error("carregarDadosDoFirebase falhou:", err);
    throw err;
  }
}

async function carregarClientesFirebase() {
  const snap = await db.collection("clientes").get();
  clientes = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function carregarUsuariosFirebase() {
  try {
    const snap = await db.collection("usuarios").get();
    usuarios = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    console.log("Usuarios carregados:", usuarios.length);
  } catch (e) {
    console.error("ERRO ao carregar usuarios:", e);
    usuarios = [];
  }
}

async function carregarRepresentadasFirebase() {
  const snap = await db.collection("representadas").get();
  representadas = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function carregarRegistrosFirebase() {
  const snap = await db.collection("ofertas").get();
  registros = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
  renderTabela();
  renderTabelaClientes();
  renderTabelaRepresentadas();
  initFiltrosEPaginacao();
}

function logout() {
  auth.signOut().catch((err) => {
    console.error(err);
    alert("Erro ao sair: " + err.message);
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
      alert("Preencha e-mail e senha.");
      return;
    }

    if (!senhaForteLogin(pass)) {
      alert(msgSenhaForteLogin());

      try {
        setLoginMsg("Senha fraca. Enviando e-mail para troca de senha...");
        await auth.sendPasswordResetEmail(email);
        setLoginMsg("✅ Enviamos um e-mail para você trocar a senha.");
        alert("Enviamos um e-mail para trocar a senha.");
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

      const cred = await auth.signInWithEmailAndPassword(email, pass);

      console.log("Login OK:", cred.user?.uid);
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

      alert(msg);
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
    alert("Para acessar o sistema, confirme o código do Google Authenticator.");
    return;
  }

  m.classList.add("hidden");
}

function setTotpStatus(msg) {
  const el = document.getElementById("totp_status");
  if (el) el.textContent = msg || "";
}
function formatarNomeUsuario(raw) {
  if (!raw) return "";

  let nome = raw.split("@")[0];

  nome = nome.split(".")[0];

  return nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase();
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
      setTotpStatus("Código OK ✅ Entrando...");
    } else {
      await apiActivate(totpUserEmail, clean);
      totpIsActive = true;
      totpOk = true;
      setTotpStatus("2FA ativado ✅ Entrando...");
    }

    setTimeout(async () => {
      fecharModalTOTP(true);

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

function abrirModal(titulo, html) {
  const modal = document.getElementById("modalDetalhes");
  const tituloEl = document.getElementById("modalTitulo");
  const corpoEl = document.getElementById("modalCorpo");
  if (!modal || !tituloEl || !corpoEl) return;
  tituloEl.textContent = titulo;
  corpoEl.innerHTML = html;
  modal.classList.remove("hidden");
}

function fecharModalDetalhes() {
  const modal = document.getElementById("modalDetalhes");
  if (modal) modal.classList.add("hidden");
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

  if (window.innerWidth <= 780) sidebar.classList.toggle("open");
  else sidebar.classList.toggle("collapsed");
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
  const telPrincipal = document.getElementById("telefone");
  const telContato = document.getElementById("ct_tel");

  if (telPrincipal) {
    telPrincipal.addEventListener("input", onPhoneInput);
    telPrincipal.addEventListener("paste", onPhonePaste);
  }
  if (telContato) {
    telContato.addEventListener("input", onPhoneInput);
    telContato.addEventListener("paste", onPhonePaste);
  }
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
function onCnpjInput(e) {
  e.target.value = formatCnpjValue(e.target.value);
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
      alert("CNPJ inválido. Deve conter 14 dígitos.");
      setTimeout(() => input.focus(), 50);
    }, 50);
  }
}

function onCnpjInput(e) {
  e.target.dataset.invalidAlertShown = "0";
  e.target.value = formatCnpjValue(e.target.value);
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

    const cnpjDigits = (cnpj_cliente.value || "").replace(/\D/g, "");
    if (cnpjDigits && cnpjDigits.length !== 14) {
      alert("CNPJ inválido. Verifique antes de salvar.");
      cnpj_cliente.focus();
      return;
    }

    const telDigits = (telefone.value || "").replace(/\D/g, "");
    if (telDigits && telDigits.length < 10) {
      alert("Telefone inválido. Informe DDD + 8 ou 9 dígitos.");
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
      representadaId: representadaSelect.value || null,
      representadaNome:
        representadaSelect.options[representadaSelect.selectedIndex]?.text ||
        "",
      unidade: unidade,
      valor_total: valor_total.value,
      ref_cliente: ref_cliente?.value?.trim() || "",
      data_entrada: data_entrada.value,
      status: status.value,
      data_envio: data_envio.value,
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

      const data_nf = document.getElementById("data_nf");
      const valor_nf = document.getElementById("valor_nf");
      const prazo_entrega_contratual = document.getElementById(
        "prazo_entrega_contratual",
      );

      const solicitacao_oc =
        document.querySelector("input[name='sol_oc']:checked")?.value || "nao";
      const ref_oc = document.getElementById("ref_oc");
      const data_implantacao = document.getElementById("data_implantacao");
      const numero_nf = document.getElementById("numero_nf");

      registroBase.pedido = {
        numero_pedido: numero_pedido?.value || "",
        data_po: data_po?.value || "",
        valor_pedido: valor_pedido?.value || "",
        cond_pagamento: cond_pagamento?.value || "",
        ref_projeto: ref_projeto?.value || "",
        tipo_produto: tipo_produto?.value || "",
        obs: obs?.value || "",
        data_nf: data_nf?.value || "",
        valor_nf: valor_nf?.value || "",
        prazo_entrega_contratual: prazo_entrega_contratual?.value || "",
        solicitacao_oc,
        ref_oc: ref_oc?.value || "",
        data_implantacao: data_implantacao?.value || "",
        numero_nf: numero_nf?.value || "",
      };
    } else {
      registroBase.pedido = null;
    }

    if (possuiRevisao === "sim") {
      const rev_num_oferta = document.getElementById("rev_num_oferta");
      const rev_mudou = document.getElementById("rev_mudou");

      if (!rev_num_oferta.value.trim()) {
        alert("Informe o número da oferta anterior (revisão).");
        rev_num_oferta.focus();
        return;
      }
      if (!rev_mudou.value.trim()) {
        alert("Descreva o que mudou na revisão.");
        rev_mudou.focus();
        return;
      }

      registroBase.revisao = {
        numero_oferta_anterior: rev_num_oferta.value.trim(),
        mudou: rev_mudou.value.trim(),
      };
    } else {
      registroBase.revisao = null;
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
      };
      await db.collection("ofertas").doc(id).set(registro);
      registros.push(registro);
      alert("Registro adicionado!");
    } else {
      const idx = registros.findIndex((r) => r.id === editId);
      const antigo = registros[idx] || {};
      if (idx !== -1) {
        const registro = {
          id: editId,
          ...registroBase,
          criadoPor: antigo.criadoPor || currentUser,
          atualizadoPor: currentUser,
          criadoEm: antigo.criadoEm || nowIso,
          atualizadoEm: nowIso,
        };
        await db.collection("ofertas").doc(editId).set(registro);
        registros[idx] = registro;
        alert("Registro atualizado!");
      }
      editId = null;
      btnAdicionar.textContent = "Adicionar";
      document.getElementById("btnCancelarEdicao")?.classList.add("hidden");
    }

    salvarRegistros();

    document.getElementById("formOferta").reset();
    document.getElementById("secaoPedido").classList.add("hidden");
    document.getElementById("secaoRevisao").classList.add("hidden");

    document.querySelector("input[name='revisao'][value='nao']")?.click();
    document.querySelector("input[name='pedido'][value='nao']")?.click();
    document.querySelector("input[name='sol_oc'][value='nao']")?.click();

    cnpj_cliente.dataset.clienteId = "";
    currentPage = 1;
    renderTabela();
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

let actionsMenuState = { open: false, type: null, id: null };

function ensureActionsMenu() {
  let menu = document.getElementById("actionsMenu");
  if (menu) return menu;

  menu = document.createElement("div");
  menu.id = "actionsMenu";
  menu.innerHTML = `
    <button id="actVer" type="button">Ver</button>
    <button id="actVerContatos" type="button">Ver contatos</button>
    <button id="actEditar" type="button">Editar</button>
    <button id="actExcluir" type="button" class="danger">Excluir</button>
  `;
  document.body.appendChild(menu);

  document.addEventListener("click", () => closeActionsMenu());
  window.addEventListener("scroll", () => closeActionsMenu(), true);
  window.addEventListener("resize", () => closeActionsMenu());
  menu.addEventListener("click", (e) => e.stopPropagation());

  return menu;
}

function openActionsMenu(ev, type, id) {
  ev.preventDefault();
  ev.stopPropagation();

  const menu = ensureActionsMenu();
  actionsMenuState = { open: true, type, id };

  const btnVer = document.getElementById("actVer");
  const btnVerContatos = document.getElementById("actVerContatos");
  const btnEditar = document.getElementById("actEditar");
  const btnExcluir = document.getElementById("actExcluir");

  btnVer.onclick = () => {
    closeActionsMenu();
    if (type === "oferta") verOferta(id);
    if (type === "cliente") verCliente(id);
    if (type === "rep") verRepresentada(id);
  };

  if (btnVerContatos) {
    const isCliente = type === "cliente";
    btnVerContatos.style.display = isCliente ? "block" : "none";
    btnVerContatos.onclick = () => {
      closeActionsMenu();
      verContatosCliente(id);
    };
  }

  btnEditar.onclick = () => {
    closeActionsMenu();
    if (type === "oferta") editarRegistro(id);
    if (type === "cliente") editarCliente(id);
    if (type === "rep") editarRepresentada(id);
  };

  btnExcluir.onclick = () => {
    closeActionsMenu();
    if (type === "oferta") excluirRegistro(id);
    if (type === "cliente") excluirCliente(id);
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

  if (btnVerTudo) {
    btnVerTudo.addEventListener("click", () => {
      if (searchTerm) searchTerm.value = "";
      if (statusFilter) statusFilter.value = "";
      if (filterField) filterField.value = "todos";
      if (pedidoFilter) pedidoFilter.value = "todos";
      if (revisaoFilter) revisaoFilter.value = "todos";
      currentPage = 1;
      renderTabela();
    });
  }

  if (window.__paginacaoRegistrosBound) return;
  window.__paginacaoRegistrosBound = true;

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
  btnExportPdf?.addEventListener("click", exportPdf);
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
      return normalizeCNPJ(reg.cnpj_cliente);
    case "nome_projeto":
      return reg.nome_projeto || "";
    case "representadaNome":
      return reg.representadaNome || "";
    case "tipo_oferta":
      return reg.tipo_oferta || "";
    case "status":
      return reg.status || "";
    case "usuario":
      return formatarNomeUsuario(reg.atualizadoPor || reg.criadoPor || "");
    case "todos":
    default:
      return "";
  }
}

function getRegistrosFiltrados() {
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

  const isEmptyKeyword = (t) => ["vazio", "em branco", "sem"].includes(t);

  return registros.filter((reg) => {
    if (filtros.length > 0) {
      const textoTodos = getTextoRegistroTodosCampos(reg);

      for (const f of filtros) {
        const wantEmpty = isEmptyKeyword(f.term);

        if (wantEmpty) {
          // só faz sentido com campo específico
          if (f.field === "todos") return false;

          if (!isEmptyByFieldRegistro(reg, f.field)) return false;
          continue;
        }

        // normal (como já está)
        if (f.field === "todos") {
          if (!textoTodos.includes(f.term)) return false;
        } else {
          const v = (getValorCampoRegistro(reg, f.field) || "")
            .toString()
            .toLowerCase();

          if (f.field === "cnpj_cliente") {
            if (!normalizeCNPJ(v).includes(normalizeCNPJ(f.term))) return false;
          } else {
            if (!v.includes(f.term)) return false;
          }
        }
      }
    }

    if (statusFilter) {
      if (!reg.status || !reg.status.toLowerCase().includes(statusFilter))
        return false;
    }

    if (pedidoFilter === "com" && reg.possuiPedido !== "sim") return false;
    if (pedidoFilter === "sem" && reg.possuiPedido !== "nao") return false;

    if (revisaoFilter === "com" && reg.possuiRevisao !== "sim") return false;
    if (revisaoFilter === "sem" && reg.possuiRevisao !== "nao") return false;

    return true;
  });
}

function getClientesFiltrados() {
  const term = (document.getElementById("searchClientes")?.value || "")
    .trim()
    .toLowerCase();

  const field =
    document.getElementById("filterClientesField")?.value || "todos";

  return clientes.filter((cli) => {
    if (!term) return true;

    const usuario = formatarNomeUsuario(
      cli.atualizadoPor || cli.criadoPor || "",
    );

    if (field === "todos") {
      const texto = [cli.razao, cli.cnpj, cli.sap, cli.segmento, usuario]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return texto.includes(term);
    }

    let v = "";
    if (field === "razao") v = cli.razao || "";
    if (field === "cnpj") v = cli.cnpj || "";
    if (field === "segmento") v = cli.segmento || "";
    if (field === "sap") v = cli.sap || "";
    if (field === "usuario") v = usuario || "";

    return v.toLowerCase().includes(term);
  });
}

function renderTabela() {
  const tbody = document.querySelector("#tabelaRegistros tbody");
  const pageInfo = document.getElementById("pageInfo");
  if (!tbody) return;

  tbody.innerHTML = "";

  const filtrados = getRegistrosFiltrados();
  const total = filtrados.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageData = filtrados.slice(start, end);

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
        <td>${start + index + 1}</td>
        <td>${reg.bu || ""}</td>
        <td>${reg.razao || ""}</td>
        <td>${reg.cnpj_cliente || ""}</td>
        <td>${reg.nome_projeto || ""}</td>
        <td>${reg.representadaNome || ""}</td>
        <td>${reg.tipo_oferta || ""}</td>
        <td>${reg.status || ""}</td>
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

  document.getElementById("solicitante").value = reg.solicitante || "";
  document.getElementById("telefone").value = reg.telefone || "";
  document.getElementById("email").value = reg.email || "";
  document.getElementById("oferta").value = reg.oferta || "";
  document.getElementById("nome_projeto").value = reg.nome_projeto || "";
  document.getElementById("valor_total").value = reg.valor_total || "";
  document.getElementById("ref_cliente").value = reg.ref_cliente || "";
  document.getElementById("data_entrada").value = reg.data_entrada || "";
  document.getElementById("status").value = reg.status || "";
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

  document
    .querySelector(`input[name="pedido"][value="${reg.possuiPedido || "nao"}"]`)
    ?.click();
  document
    .querySelector(
      `input[name="revisao"][value="${reg.possuiRevisao || "nao"}"]`,
    )
    ?.click();

  document
    .querySelector(
      `input[name="spot"][value="${reg.atendimentoSpot || "nao"}"]`,
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

    document.getElementById("data_nf").value = reg.pedido.data_nf || "";
    document.getElementById("valor_nf").value = reg.pedido.valor_nf || "";
    document.getElementById("prazo_entrega_contratual").value =
      reg.pedido.prazo_entrega_contratual || "";
    document.getElementById("ref_oc").value = reg.pedido.ref_oc || "";
    document.getElementById("data_implantacao").value =
      reg.pedido?.data_implantacao || "";
    document.getElementById("numero_nf").value = reg.pedido?.numero_nf || "";

    document
      .querySelector(
        `input[name="sol_oc"][value="${reg.pedido.solicitacao_oc || "nao"}"]`,
      )
      ?.click();
  } else {
    document.getElementById("secaoPedido").classList.add("hidden");
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
  if (!confirm("Tem certeza que deseja excluir este registro?")) return;

  try {
    await db.collection("ofertas").doc(id).delete();
  } catch (e) {
    console.error(e);
    alert("Erro ao excluir do Firebase (ofertas).");
  }

  registros = registros.filter((r) => r.id !== id);
  salvarRegistros();
  renderTabela();
}

function exportExcel() {
  const filtrados = getRegistrosFiltrados();
  if (filtrados.length === 0) {
    alert("Nenhum registro para exportar.");
    return;
  }

  console.log("DEBUG EXPORT", {
    registrosLen: registros?.length,
    filtradosLen: getRegistrosFiltrados()?.length,
    term: document.getElementById("searchTerm")?.value,
    field: document.getElementById("filterField")?.value,
    status: document.getElementById("statusFilter")?.value,
    pedido: document.getElementById("pedidoFilter")?.value,
    revisao: document.getElementById("revisaoFilter")?.value,
    schemaLen: (window.OFERTA_SCHEMA || []).length,
    schemaSample: (window.OFERTA_SCHEMA || [])[0],
    sampleRegistro: (getRegistrosFiltrados() || [])[0],
  });

  const linhas = filtrados.map((reg, i) => {
    const row = {};
    row["#"] = i + 1;

    (window.OFERTA_SCHEMA || []).forEach((c) => {
      let val = getByPath(reg, c.key);

      if (c.type === "yesno") val = asYesNo(val);
      if (c.type === "date") val = formatDateBR(val);
      if (c.type === "datetime") val = formatDateTimeBR(val);

      row[c.label] = val ?? "";
    });

    return row;
  });

  const ws = XLSX.utils.json_to_sheet(linhas);
  ws["!cols"] = Object.keys(linhas[0]).map((k) => ({
    wch: Math.max(12, k.length + 2),
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
    alert("Nenhum registro para exportar.");
    return;
  }

  const cols = ["#", ...(window.OFERTA_SCHEMA || []).map((c) => c.label)];

  let html = `
    <html>
      <head>
        <title>Registros de Ofertas</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 10px; }
          h2 { text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #000; padding: 3px; vertical-align: top; }
          th { background: #eee; }
        </style>
      </head>
      <body>
        <h2>Registros de Ofertas</h2>
        <table>
          <thead><tr>
            ${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}
          </tr></thead>
          <tbody>
  `;

  filtrados.forEach((reg, i) => {
    const tds = [];
    tds.push(`<td>${i + 1}</td>`);

    (window.OFERTA_SCHEMA || []).forEach((c) => {
      let val = getByPath(reg, c.key);

      if (c.type === "yesno") val = asYesNo(val);
      if (c.type === "date") val = formatDateBR(val);

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
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
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

function initBackupUI() {
  const btnBackupExport = document.getElementById("btnBackupExport");
  const btnBackupImport = document.getElementById("btnBackupImport");
  const inputBackupFile = document.getElementById("inputBackupFile");

  btnBackupExport?.addEventListener("click", () => {
    const tipo = (
      prompt("Exportar backup em qual formato? Digite 'json' ou 'excel':") || ""
    )
      .trim()
      .toLowerCase();

    if (tipo === "json") {
      const data = { registros, clientes, representadas };
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
    } else if (tipo) {
      alert("Opção inválida. Use 'json' ou 'excel'.");
    }
  });

  if (btnBackupImport && inputBackupFile) {
    btnBackupImport.addEventListener("click", () => {
      const tipo = (
        prompt("Importar backup de qual formato? Digite 'json' ou 'excel':") ||
        ""
      )
        .trim()
        .toLowerCase();

      if (tipo !== "json" && tipo !== "excel") {
        if (tipo) alert("Opção inválida. Use 'json' ou 'excel'.");
        return;
      }

      backupImportMode = tipo;
      inputBackupFile.value = "";
      inputBackupFile.accept = tipo === "json" ? ".json" : ".xlsx";
      inputBackupFile.click();
    });

    inputBackupFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file || !backupImportMode) return;

      if (backupImportMode === "json") {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            registros = data.registros || [];
            clientes = data.clientes || [];
            representadas = data.representadas || [];

            salvarRegistros();
            salvarClientes();
            salvarRepresentadas();

            renderTabela();
            renderTabelaClientes();
            renderTabelaRepresentadas();
            preencherSelectRepresentadas();

            alert("Backup JSON restaurado com sucesso!");
          } catch (err) {
            console.error(err);
            alert("Arquivo de backup JSON inválido.");
          }
        };
        reader.readAsText(file);
      } else if (backupImportMode === "excel") {
        importBackupExcel(file);
      }

      backupImportMode = null;
    });
  }
}

function exportBackupExcel() {
  const wb = XLSX.utils.book_new();

  const clientesSheetData = clientes.map((c) => ({
    ID: c.id,
    RazaoSocial: c.razao,
    CNPJ: c.cnpj,
    IE: c.ie,
    Endereco: c.endereco,
    Segmento: c.segmento,
    CriadoPor: c.criadoPor || "",
    AtualizadoPor: c.atualizadoPor || "",
  }));
  const wsClientes = XLSX.utils.json_to_sheet(
    clientesSheetData.length
      ? clientesSheetData
      : [{ Mensagem: "Sem clientes" }],
  );
  XLSX.utils.book_append_sheet(wb, wsClientes, "Clientes");

  const contatosSheetData = [];
  clientes.forEach((c) => {
    (c.contatos || []).forEach((ct) => {
      contatosSheetData.push({
        ClienteID: c.id,
        ClienteCNPJ: c.cnpj,
        Nome: ct.nome,
        Telefone: ct.telefone,
        Email: ct.email,
        Funcao: ct.funcao,
        Principal: ct.principal ? "Sim" : "Não",
        ResponsavelId: ct.responsavelId || "",
        ResponsavelNome: ct.responsavelNome || "",
      });
    });
  });
  const wsContatos = XLSX.utils.json_to_sheet(
    contatosSheetData.length
      ? contatosSheetData
      : [{ Mensagem: "Sem contatos" }],
  );
  XLSX.utils.book_append_sheet(wb, wsContatos, "Contatos");

  const repsData = representadas.map((r) => ({
    ID: r.id,
    Nome: r.nome,
    CriadoPor: r.criadoPor || "",
    AtualizadoPor: r.atualizadoPor || "",
  }));
  const wsRep = XLSX.utils.json_to_sheet(
    repsData.length ? repsData : [{ Mensagem: "Sem representadas" }],
  );
  XLSX.utils.book_append_sheet(wb, wsRep, "Representadas");

  const ofertasData = registros.map((r) => ({
    ID: r.id,
    ClienteID: r.clienteId || null,
    ClienteCNPJ: r.cnpj_cliente || "",
    RazaoSocial: r.razao || "",
    BU: r.bu || "",
    Segmento: r.segmento || "",
    Projeto: r.nome_projeto || "",
    RepresentadaID: r.representadaId || null,
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
    DataNF: r.pedido?.data_nf || "",
    ValorNF: r.pedido?.valor_nf || "",
    PrazoEntregaContratual: r.pedido?.prazo_entrega_contratual || "",
    SolicitacaoOC: r.pedido?.solicitacao_oc || "",
    RefOC: r.pedido?.ref_oc || "",
    CriadoPor: r.criadoPor || "",
    AtualizadoPor: r.atualizadoPor || "",
  }));

  const wsOfertas = XLSX.utils.json_to_sheet(
    ofertasData.length ? ofertasData : [{ Mensagem: "Sem ofertas" }],
  );
  XLSX.utils.book_append_sheet(wb, wsOfertas, "Ofertas");

  XLSX.writeFile(wb, "backup_crm.xlsx");
}

function importBackupExcel(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: "array" });

      registros = [];
      clientes = [];
      representadas = [];

      const shClientes = wb.Sheets["Clientes"];
      if (shClientes) {
        const dados = XLSX.utils.sheet_to_json(shClientes);
        clientes = dados
          .filter((row) => row.RazaoSocial || row.CNPJ)
          .map((row) => ({
            id: row.ID || gerarId(),
            razao: row.RazaoSocial || "",
            cnpj: row.CNPJ || "",
            ie: row.IE || "",
            endereco: row.Endereco || "",
            segmento: row.Segmento || "",
            contatos: [],
            criadoPor: row.CriadoPor || "",
            atualizadoPor: row.AtualizadoPor || row.CriadoPor || "",
          }));
      }

      const shRep = wb.Sheets["Representadas"];
      if (shRep) {
        const dadosRep = XLSX.utils.sheet_to_json(shRep);
        representadas = dadosRep
          .filter((row) => row.Nome)
          .map((row) => ({
            id: row.ID || gerarId(),
            nome: row.Nome || "",
            criadoPor: row.CriadoPor || "",
            atualizadoPor: row.AtualizadoPor || row.CriadoPor || "",
          }));
      }

      const shContatos = wb.Sheets["Contatos"];
      if (shContatos) {
        const dadosC = XLSX.utils.sheet_to_json(shContatos);
        dadosC.forEach((row) => {
          const cid = row.ClienteID;
          const cnpj = row.ClienteCNPJ ? String(row.ClienteCNPJ) : "";

          let cliente = null;
          if (cid) cliente = clientes.find((c) => c.id == cid);
          if (!cliente && cnpj) {
            const clean = cnpj.replace(/\D/g, "");
            cliente = clientes.find(
              (c) => (c.cnpj || "").replace(/\D/g, "") === clean,
            );
          }
          if (!cliente) return;

          if (!cliente.contatos) cliente.contatos = [];
          cliente.contatos.push({
            nome: row.Nome || "",
            telefone: row.Telefone || "",
            email: row.Email || "",
            funcao: row.Funcao || "",
            principal: String(row.Principal || "").toLowerCase() === "sim",
            responsavelId: row.ResponsavelId || "",
            responsavelNome: row.ResponsavelNome || "",
          });
        });
      }

      const shOfertas = wb.Sheets["Ofertas"];
      if (shOfertas) {
        const dadosOf = XLSX.utils.sheet_to_json(shOfertas);
        registros = dadosOf
          .filter((row) => row.NumeroOferta || row.RazaoSocial)
          .map((row) => {
            const pedidoExiste =
              row.NumeroPedido ||
              row.ValorPedido ||
              row.RefProjetoPedido ||
              row.TipoProduto ||
              row.CondicaoPagamento ||
              row.ObsPedido ||
              row.DataNF ||
              row.ValorNF ||
              row.PrazoEntregaContratual ||
              row.SolicitacaoOC ||
              row.RefOC;

            const pedido = pedidoExiste
              ? {
                  numero_pedido: row.NumeroPedido || "",
                  valor_pedido: row.ValorPedido || "",
                  data_po: row.DataPO || "",
                  cond_pagamento: row.CondicaoPagamento || "",
                  ref_projeto: row.RefProjetoPedido || "",
                  tipo_produto: row.TipoProduto || "",
                  obs: row.ObsPedido || "",
                  data_nf: row.DataNF || "",
                  valor_nf: row.ValorNF || "",
                  prazo_entrega_contratual: row.PrazoEntregaContratual || "",
                  solicitacao_oc:
                    (row.SolicitacaoOC || "").toString().toLowerCase() || "",
                  ref_oc: row.RefOC || "",
                }
              : null;

            const possuiRevisao = (row.PossuiRevisao || "nao")
              .toString()
              .toLowerCase();
            const revisao =
              possuiRevisao === "sim" ||
              row.RevisaoOfertaAnterior ||
              row.RevisaoMudou
                ? {
                    numero_oferta_anterior: row.RevisaoOfertaAnterior || "",
                    mudou: row.RevisaoMudou || "",
                  }
                : null;

            const possuiPedido = (
              row.PossuiPedido || (pedidoExiste ? "sim" : "nao")
            )
              .toString()
              .toLowerCase();

            return {
              id: row.ID || gerarId(),
              clienteId: row.ClienteID || null,
              cnpj_cliente: row.ClienteCNPJ || "",
              razao: row.RazaoSocial || "",
              bu: row.BU || "",
              segmento: row.Segmento || "",
              nome_projeto: row.Projeto || "",
              representadaId: row.RepresentadaID || null,
              representadaNome: row.RepresentadaNome || "",
              solicitante: row.Solicitante || "",
              telefone: row.Telefone || "",
              email: row.Email || "",
              oferta: row.NumeroOferta || "",
              tipo_oferta: row.TipoNegocio || "",
              valor_total: row.ValorTotal || "",
              oportunidade: row.Oportunidade || "",
              data_entrada: row.DataEntrada || "",
              status: row.Status || "",
              data_envio: row.DataEnvio || "",
              obs_geral: row.ObservacoesGerais || "",
              possuiPedido,
              pedido: possuiPedido === "sim" ? pedido : null,
              possuiRevisao,
              revisao,
              criadoPor: row.CriadoPor || "",
              atualizadoPor: row.AtualizadoPor || row.CriadoPor || "",
            };
          });
      }

      salvarRegistros();
      salvarClientes();
      salvarRepresentadas();

      renderTabela();
      renderTabelaClientes();
      renderTabelaRepresentadas();
      preencherSelectRepresentadas();

      alert("Backup Excel importado com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao importar Excel. Verifique o modelo da planilha.");
    }
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

  document.getElementById("searchClientes")?.addEventListener("input", () => {
    clientesCurrentPage = 1;
    renderTabelaClientes();
  });
  document
    .getElementById("filterClientesField")
    ?.addEventListener("change", () => {
      clientesCurrentPage = 1;
      renderTabelaClientes();
    });

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
      Math.ceil(clientes.length / clientesPageSize),
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

    if (!nome) {
      alert("Informe pelo menos o nome do contato.");
      return;
    }

    const telDigits = telefone.replace(/\D/g, "");
    if (telefone && telDigits.length < 10) {
      alert("Telefone do contato inválido. Informe DDD + 8 ou 9 dígitos.");
      document.getElementById("ct_tel")?.focus();
      return;
    }

    const contatoBase = {
      nome,
      telefone,
      email,
      funcao,
      principal: principalChecked,
      responsavelId,
      responsavelNome,
    };

    if (contatoBase.principal) {
      contatosTemp = contatosTemp.map((c) => ({ ...c, principal: false }));
    }

    if (editContatoIndex === null) {
      contatosTemp.push(contatoBase);
    } else {
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

    if (!razao || !cnpj) {
      alert("Razão Social e CNPJ são obrigatórios.");
      return;
    }

    const cnpjDigits = cnpj.replace(/\D/g, "");
    if (cnpjDigits.length !== 14) {
      alert("CNPJ do cliente inválido. Deve conter 14 dígitos.");
      document.getElementById("cli_cnpj")?.focus();
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
      contatos: contatosTemp.slice(),
    };

    try {
      if (!editClienteId) {
        const id = gerarId();
        const cliente = {
          id,
          ...clienteBase,
          criadoPor: currentUser,
          atualizadoPor: currentUser,
          criadoEm: nowIso,
          atualizadoEm: nowIso,
        };
        await db.collection("clientes").doc(id).set(cliente);
        clientes.push(cliente);
        alert("Cliente salvo!");
      } else {
        const idx = clientes.findIndex((c) => c.id === editClienteId);
        const antigo = clientes[idx] || {};

        if (idx !== -1) {
          const cliente = {
            id: editClienteId,
            ...clienteBase,
            criadoPor: antigo.criadoPor || currentUser,
            atualizadoPor: currentUser,
            criadoEm: antigo.criadoEm || nowIso,
            atualizadoEm: nowIso,
          };
          await db.collection("clientes").doc(editClienteId).set(cliente);
          clientes[idx] = cliente;
          atualizarSugestoesCnpj();
        }

        alert("Cliente atualizado!");
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
      alert("Erro ao salvar cliente: " + (e?.message || e));
    }
  });

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

  lista.innerHTML = "";
  if (contatosTemp.length === 0) {
    lista.innerHTML = "<p>Nenhum contato adicionado.</p>";
    return;
  }

  contatosTemp.forEach((ct, index) => {
    const div = document.createElement("div");
    div.className = "contato-item";
    div.innerHTML = `
      <strong>${ct.nome}</strong>
      ${ct.principal ? '<span class="tag-principal">(Principal)</span>' : ""}
      <br>
      ${ct.funcao || ""}
      <br>
      Tel: ${ct.telefone || ""} • E-mail: ${ct.email || ""}
      ${
        ct.responsavelNome
          ? `<br><strong>Responsável:</strong> ${primeiroNome(
              ct.responsavelNome,
            )}`
          : ""
      }
      <br>
      <button class="btn-sm" onclick="editarContato(${index})">Editar</button>
      <button class="btn-sm btn-danger" onclick="excluirContato(${index})">Excluir</button>
      <hr>
    `;
    lista.appendChild(div);
  });
}

function editarContato(index) {
  const ct = contatosTemp[index];
  if (!ct) return;

  document.getElementById("ct_nome").value = ct.nome || "";
  document.getElementById("ct_tel").value = ct.telefone || "";
  document.getElementById("ct_email").value = ct.email || "";
  document.getElementById("ct_funcao").value = ct.funcao || "";
  document.getElementById("ct_principal").checked = !!ct.principal;
  document.getElementById("ct_responsavel").value = ct.responsavelId || "";

  editContatoIndex = index;
  document.getElementById("btnAddContato").textContent = "Salvar Edição";
  document
    .getElementById("btnCancelarEdicaoContato")
    ?.classList.remove("hidden");
}

function excluirContato(index) {
  if (!confirm("Tem certeza que deseja excluir este contato?")) return;
  contatosTemp.splice(index, 1);
  editContatoIndex = null;
  document.getElementById("btnAddContato").textContent = "Adicionar Contato";
  renderListaContatos();
}

function renderTabelaClientes() {
  const tbody = document.querySelector("#tabelaClientes tbody");
  const pageInfoClientes = document.getElementById("pageInfoClientes");
  if (!tbody) return;

  tbody.innerHTML = "";

  const filtrados = getClientesFiltrados();
  const totalPages = Math.max(
    1,
    Math.ceil(filtrados.length / clientesPageSize),
  );
  if (clientesCurrentPage > totalPages) clientesCurrentPage = totalPages;

  const start = (clientesCurrentPage - 1) * clientesPageSize;
  const end = start + clientesPageSize;
  const pageData = filtrados.slice(start, end);

  if (pageData.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.textContent = "Nenhum cliente encontrado.";
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    pageData.forEach((cli) => {
      console.log("SAP DEBUG:", cli.razao, cli.sap, cli);
      const tr = document.createElement("tr");
      const qtdContatos = cli.contatos ? cli.contatos.length : 0;
      const usuario = formatarNomeUsuario(
        cli.atualizadoPor || cli.criadoPor || "-",
      );

      const cnpjClean = (cli.cnpj || "").replace(/\D/g, "");
      const qtdOfertas = registros.filter(
        (r) => (r.cnpj_cliente || "").replace(/\D/g, "") === cnpjClean,
      ).length;

      tr.innerHTML = `
        <td>${cli.razao || ""}</td>
        <td>${cli.cnpj || ""}</td>
        <td>${cli.segmento || ""}</td>
        <td>${cli.sap || ""}</td>
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

  const btnSalvarCliente = document.getElementById("btnSalvarCliente");
  if (btnSalvarCliente) btnSalvarCliente.textContent = "Salvar Edição";

  document.getElementById("secClientes").scrollIntoView({ behavior: "smooth" });
  document
    .getElementById("btnCancelarEdicaoCliente")
    ?.classList.remove("hidden");
}

async function excluirCliente(id) {
  if (!confirm("Tem certeza que deseja excluir este cliente?")) return;

  try {
    await db.collection("clientes").doc(id).delete();
  } catch (e) {
    console.error(e);
    alert("Erro ao excluir cliente no Firebase.");
  }

  clientes = clientes.filter((c) => c.id !== id);
  salvarClientes();
  renderTabelaClientes();
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
      <strong>${ct.nome}</strong>
      ${ct.principal ? '<span class="tag-principal">(Principal)</span>' : ""}
      <br>
      ${ct.funcao || ""}
      <br>
      Tel: ${ct.telefone || ""} • E-mail: ${ct.email || ""}
      ${
        ct.responsavelNome
          ? `<br><strong>Responsável:</strong> ${primeiroNome(
              ct.responsavelNome,
            )}`
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

function initLigacaoClienteOferta() {
  const cnpjInput = document.getElementById("cnpj_cliente");
  if (!cnpjInput) return;

  cnpjInput.addEventListener("blur", () => {
    const cli = buscarClientePorCnpj(cnpjInput.value);
    if (!cli) {
      cnpjInput.dataset.clienteId = "";
      return;
    }

    cnpjInput.dataset.clienteId = cli.id;

    const razao = document.getElementById("razao");
    if (razao) razao.value = cli.razao || "";
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
      alert("Informe o nome da representada.");
      return;
    }

    if (!editRepresentadaId) {
      const id = gerarId();
      const rep = {
        id,
        nome,
        criadoPor: currentUser,
        atualizadoPor: currentUser,
        criadoEm: nowIso,
        atualizadoEm: nowIso,
      };
      await db.collection("representadas").doc(id).set(rep);
      representadas.push(rep);
      alert("Representada salva!");
    } else {
      const idx = representadas.findIndex((r) => r.id === editRepresentadaId);
      const antigo = representadas[idx] || {};
      if (idx !== -1) {
        const rep = {
          id: editRepresentadaId,
          nome,
          criadoPor: antigo.criadoPor || currentUser,
          atualizadoPor: currentUser,
          criadoEm: antigo.criadoEm || nowIso,
          atualizadoEm: nowIso,
        };
        await db.collection("representadas").doc(editRepresentadaId).set(rep);
        representadas[idx] = rep;
      }

      registros.forEach((reg) => {
        if (reg.representadaId === editRepresentadaId)
          reg.representadaNome = nome;
      });
      salvarRegistros();

      alert("Representada atualizada!");
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
    ?.addEventListener("input", () => {
      representadasCurrentPage = 1;
      renderTabelaRepresentadas();
    });

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
}

function renderTabelaRepresentadas() {
  const tbody = document.querySelector("#tabelaRepresentadas tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const filtrados = getRepresentadasFiltradas();
  const totalPages = Math.max(
    1,
    Math.ceil(filtrados.length / representadasPageSize),
  );
  if (representadasCurrentPage > totalPages)
    representadasCurrentPage = totalPages;

  const start = (representadasCurrentPage - 1) * representadasPageSize;
  const end = start + representadasPageSize;
  const pageData = filtrados.slice(start, end);

  if (!pageData.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "Nenhuma representada encontrada.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  pageData.forEach((rep) => {
    const usuario = formatarNomeUsuario(
      rep.atualizadoPor || rep.criadoPor || "",
    );
    const qtdOfertas = registros.filter(
      (r) => r.representadaId === rep.id,
    ).length;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rep.nome}</td>
      <td class="col-center">${qtdOfertas}</td>
      <td>${usuario}</td>
      <td style="text-align:center;">
        <button class="btn-kebab" onclick="openActionsMenu(event,'rep','${rep.id}')">...</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const pageInfo = document.getElementById("pageInfoRepresentadas");
  if (pageInfo)
    pageInfo.textContent = `Página ${representadasCurrentPage} de ${totalPages}`;
}

function preencherSelectRepresentadas() {
  const select = document.getElementById("representada");
  if (!select) return;

  select.innerHTML = '<option value="">Selecione</option>';
  representadas.forEach((rep) => {
    const opt = document.createElement("option");
    opt.value = rep.id;
    opt.textContent = rep.nome;
    select.appendChild(opt);
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
  if (!confirm("Tem certeza que deseja excluir esta representada?")) return;

  try {
    await db.collection("representadas").doc(id).delete();
  } catch (e) {
    console.error(e);
    alert("Erro ao excluir representada no Firebase.");
  }

  representadas = representadas.filter((r) => r.id !== id);
  salvarRepresentadas();

  registros.forEach((reg) => {
    if (reg.representadaId === id) {
      reg.representadaId = null;
      reg.representadaNome = "";
    }
  });
  salvarRegistros();

  renderTabela();
  renderTabelaRepresentadas();
  preencherSelectRepresentadas();
}

function verOferta(id) {
  const reg = registros.find((r) => r.id === id);
  console.log("DEBUG tipo_oferta:", {
    tipo_oferta: reg.tipo_oferta,
    raw: JSON.stringify(reg.tipo_oferta),
    typeof: typeof reg.tipo_oferta,
  });
  if (!reg) return;

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

  let html = `
    <div class="modal-grid">
      <div class="modal-card">
        <div class="modal-card-title">Dados do Cliente</div>
        <div class="modal-section"><strong>Razão Social:</strong> ${reg.razao || "-"}</div>
        <div class="modal-section"><strong>CNPJ:</strong> ${reg.cnpj_cliente || "-"}</div>
        <div class="modal-section"><strong>B.U:</strong> ${reg.bu || "-"}</div>
        <div class="modal-section"><strong>Segmento:</strong> ${reg.segmento || "-"}</div>
      </div>

      <div class="modal-card">
        <div class="modal-card-title">Projeto & Representada</div>
        <div class="modal-section"><strong>Projeto:</strong> ${reg.nome_projeto || "-"}</div>
        <div class="modal-section"><strong>Representada:</strong> ${reg.representadaNome || "-"}</div>
         ${
           String(reg.representadaNome || "")
             .toLowerCase()
             .includes("mantex") && reg.unidade
             ? `<div class="modal-section"><strong>Unidade:</strong> ${reg.unidade}</div>`
             : ""
         }
      </div>
    </div>

<div class="modal-card">
      <div class="modal-card-title">Oferta</div>

      <div class="modal-section"><strong>N° Oferta:</strong> ${reg.oferta || "-"}</div>

      <div class="modal-section"><strong>Solicitante:</strong> ${reg.solicitante || "-"}</div>
      <div class="modal-section"><strong>Telefone:</strong> ${reg.telefone || "-"}</div>
      <div class="modal-section"><strong>E-mail:</strong> ${reg.email || "-"}</div>

      <div class="modal-section"><strong>Tipo:</strong> ${tipoTexto}</div>
      <div class="modal-section"><strong>Valor:</strong> ${reg.valor_total || "-"}</div>
      <div class="modal-section"><strong>Status:</strong> ${reg.status || "-"}</div>
      <div class="modal-section"><strong>Atendimento spot?</strong> ${reg.atendimentoSpot === "sim" ? "Sim" : "Não"}</div>
      <div class="modal-section"><strong>Referência:</strong> ${reg.ref_cliente || "-"}</div>

      <div class="modal-section"><strong>Data Entrada:</strong> ${formatDateBR(reg.data_entrada) || "-"}</div>
      <div class="modal-section"><strong>Data Envio:</strong> ${formatDateBR(reg.data_envio) || "-"}</div>
    </div>

    <div class="modal-card">
      <div class="modal-card-title">Usuário</div>
      <div class="modal-section"><strong>Responsável:</strong> ${usuario}</div>
      <div class="modal-section"><strong>Criado em:</strong> ${formatDateTimeBR(reg.criadoEm)}</div>
<div class="modal-section"><strong>Atualizado em:</strong> ${formatDateTimeBR(reg.atualizadoEm)}</div>
    </div>
  `;

  if (reg.obs_geral && String(reg.obs_geral).trim()) {
    html += `
      <div class="modal-card">
        <div class="modal-card-title">Observações Gerais</div>
        <div class="modal-section">${String(reg.obs_geral).replace(/\n/g, "<br>")}</div>
      </div>
    `;
  }

  if (reg.possuiPedido === "sim") {
    html += `
    <hr>
    <div class="modal-card">
      <div class="modal-card-title">Pedido</div>
      <div class="modal-section">
        <strong>N° Pedido:</strong> ${pedido.numero_pedido || "-"}<br>
        <strong>Data P.O:</strong> ${formatDateBR(pedido.data_po)}<br>
        <strong>Valor Pedido:</strong> ${pedido.valor_pedido || "-"}<br>
        <strong>Condição de Pagamento:</strong> ${pedido.cond_pagamento || "-"}<br>
        <strong>Ref./Projeto:</strong> ${pedido.ref_projeto || "-"}<br>
        <strong>Tipo de Produto:</strong> ${pedido.tipo_produto || "-"}<br>
        <strong>Obs:</strong> ${pedido.obs || "-"}<br><br>

        <strong>Data NF:</strong> ${formatDateBR(pedido.data_nf)}<br>
        <strong>Número NF:</strong> ${pedido.numero_nf || "-"}<br>
        <strong>Valor NF:</strong> ${pedido.valor_nf || "-"}<br>
        <strong>Prazo entrega contratual:</strong> ${formatDateBR(pedido.prazo_entrega_contratual)}<br>
        <strong>SOV?</strong> ${pedido.solicitacao_oc === "sim" ? "Sim" : "Não"}<br>
        <strong>Ref. OV:</strong> ${pedido.ref_oc || "-"}<br>
        <strong>Data de Implantação:</strong> ${formatDateBR(pedido.data_implantacao)}<br>
      </div>
    </div>
  `;
  } else {
    html += `<div class="modal-section"><strong>Pedido?</strong> Não</div>`;
  }

  if (reg.possuiRevisao === "sim") {
    html += `
      <hr>
      <div class="modal-card">
        <div class="modal-card-title">Revisão</div>
        <div class="modal-section"><strong>N° Oferta anterior:</strong> ${revisao.numero_oferta_anterior || "-"}</div>
        <div class="modal-section"><strong>O que mudou:</strong> ${(revisao.mudou || "-").toString().replace(/\n/g, "<br>")}</div>
      </div>
    `;
  }

  html += `<hr><div class="modal-section"><strong>Usuário:</strong> ${usuario}</div>`;
  abrirModal(`Oferta ${reg.oferta || ""}`, html);
}

function verCliente(id) {
  const cli = clientes.find((c) => c.id === id);
  if (!cli) return;

  // Contar ofertas desse cliente
  const totalOfertas = registros.filter(
    (r) =>
      (r.clienteId && r.clienteId === cli.id) ||
      (!r.clienteId && r.cnpj_cliente === cli.cnpj),
  ).length;

  const usuario = formatarNomeUsuario(
    cli.atualizadoPor || cli.criadoPor || "-",
  );

  let html = `
    <div class="modal-section">
      <strong>Razão Social:</strong> ${cli.razao || "-"}<br>
      <strong>CNPJ:</strong> ${cli.cnpj || "-"}<br>
      <strong>Inscrição Estadual:</strong> ${cli.ie || "-"}<br>
      <strong>Segmento:</strong> ${cli.segmento || "-"}<br>
      <strong>Endereço:</strong> ${cli.endereco || "-"}<br>
      <strong>Codigo SAP:</strong> ${cli.codigo_sap || "-"}<br>
      <br><strong>Ofertas cadastradas:</strong> ${totalOfertas}
    </div>
  `;

  if (cli.contatos && cli.contatos.length) {
    html += `<hr><div class="modal-section"><strong>Contatos:</strong><br><br>`;
    cli.contatos.forEach((ct) => {
      html += `
        <div style="margin-bottom:6px;">
          <strong>${ct.nome || "-"}</strong>
          ${ct.principal ? '<span class="modal-badge">Principal</span>' : ""}
          <br>
          Função: ${ct.funcao || "-"}<br>
          Tel: ${ct.telefone || "-"}<br>
          E-mail: ${ct.email || "-"}
          ${
            ct.responsavelNome
              ? `<br><strong>Responsável:</strong> ${primeiroNome(
                  ct.responsavelNome,
                )}`
              : ""
          }
        </div>
      `;
    });
    html += `</div>`;
  } else {
    html += `<div class="modal-section"><strong>Contatos:</strong> nenhum cadastrado.</div>`;
  }

  html += `<hr><div class="modal-section"><strong>Usuário:</strong> ${usuario}</div>`;
  html += `<strong>Criado em:</strong> ${formatDateTimeBR(cli.criadoEm)}`;
  html += `<br><strong>Atualizado em:</strong> ${formatDateTimeBR(cli.atualizadoEm)}`;
  abrirModal(`Cliente - ${cli.razao || ""}`, html);
}

function verRepresentada(id) {
  const rep = representadas.find((r) => r.id === id);
  if (!rep) return;

  const usuario = formatarNomeUsuario(
    rep.atualizadoPor || rep.criadoPor || "-",
  );
  const qtdOfertas = registros.filter((r) => r.representadaId === id).length;

  const html = `
    <div class="modal-section"><strong>Nome da Representada:</strong> ${
      rep.nome || "-"
    }</div>
    <div class="modal-section"><strong>Ofertas vinculadas:</strong> ${qtdOfertas}</div>
    <hr>
    <div class="modal-section"><strong>Usuário:</strong> ${usuario}</div>
    <div class="modal-section"><strong>Criado em:</strong> ${formatDateTimeBR(rep.criadoEm)}</div>
    <div class="modal-section"><strong>Atualizado em:</strong> ${formatDateTimeBR(rep.atualizadoEm)}</div>
  `;

  abrirModal(`Representada - ${rep.nome || ""}`, html);
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
  const input = document.getElementById("cnpj_cliente");
  const box = document.getElementById("cnpjAuto");
  if (!input || !box) return;

  const razaoEl = document.getElementById("razao");

  function hide() {
    box.classList.add("hidden");
    box.innerHTML = "";
  }

  function showMatches(prefix) {
    const p = String(prefix || "").replace(/\D/g, "");
    if (p.length < 4) return hide();

    const matches = clientes
      .filter((c) => (c.cnpj || "").replace(/\D/g, "").startsWith(p))
      .slice(0, 10);

    if (!matches.length) return hide();

    box.innerHTML = matches
      .map((cli) => {
        const cnpjDigits = (cli.cnpj || "").replace(/\D/g, "");
        return `
          <div class="autocomplete-item" data-id="${cli.id}">
            <div class="razao">${(cli.razao || "").trim() || "-"}</div>
            <div class="cnpj">${formatCnpjMask(cnpjDigits)}</div>
          </div>
        `;
      })
      .join("");

    box.classList.remove("hidden");
  }

  input.addEventListener("input", () => showMatches(input.value));

  box.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".autocomplete-item");
    if (!item) return;

    e.preventDefault();

    const id = item.dataset.id;
    const cli = clientes.find((c) => c.id === id);
    if (!cli) return;

    const cnpjDigits = (cli.cnpj || "").replace(/\D/g, "");

    input.dataset.skipBlurValidation = "1";
    input.value = formatCnpjMask(cnpjDigits);
    input.dataset.clienteId = cli.id;

    if (razaoEl) razaoEl.value = cli.razao || "";
    hide();
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete-wrap")) hide();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
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
      "infra",
      "Renew (PV)",
      "Renew (Wind)",
      "Mining",
      "Cranes",
      "Marine",
      "Rolling Stock",
      "Raiways",
      "Water",
      "Nuclear",
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
  if (tela === "cadastro")
    document
      .getElementById("secCadastro")
      ?.scrollIntoView({ behavior: "smooth" });
  if (tela === "registros")
    document
      .getElementById("secRegistros")
      ?.scrollIntoView({ behavior: "smooth" });
  if (tela === "clientes")
    document
      .getElementById("secClientes")
      ?.scrollIntoView({ behavior: "smooth" });
  if (tela === "representadas")
    document
      .getElementById("secRepresentadas")
      ?.scrollIntoView({ behavior: "smooth" });
  if (tela === "aprovacao")
    document
      .getElementById("secAprovacaoUsuarios")
      .scrollIntoView({ behavior: "smooth" });
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
    .map((cnpj) => `<option value="${cnpj}"></option>`)
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
  }
  function showSignup() {
    panelSignup?.classList.remove("hidden");
    panelLogin?.classList.add("hidden");
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
      alert("E-mail de redefinição enviado!");
    } catch (e) {
      console.error(e);
      setLoginMsg(
        "❌ Não consegui enviar. Verifique se o e-mail está correto.",
      );
      alert("Erro ao enviar e-mail: " + (e?.message || e));
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
      alert("Digite seu e-mail no campo de login primeiro.");
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
        alert("Digite sua senha para reenviar a verificação.");
        return;
      }

      const cred = await auth.signInWithEmailAndPassword(email, pass);
      await cred.user.reload();

      if (cred.user.emailVerified) {
        setLoginMsg("✅ Seu e-mail já está verificado. Você já pode entrar.");
        alert("Seu e-mail já está verificado.");
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
      alert(
        "E-mail de verificação reenviado! Verifique Caixa de entrada/Spam.",
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
      alert(msg);
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
      alert(msgSenhaForteLogin());
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
        alert(
          "Conta criada! Enviamos um e-mail para verificação. Verifique a caixa de entrada e SPAM.",
        );
      } catch (errMail) {
        console.error("Falha ao enviar email de verificação:", errMail);
        setSignupMsg(
          "✅ Conta criada! (Não consegui enviar o e-mail agora). Use 'Reenviar verificação' no login.",
        );
        alert(
          "Conta criada, mas não consegui enviar o e-mail agora. Tente reenviar no login.",
        );
      }

      await auth.signOut();
      mostrarLogin();
    } catch (e) {
      console.error("ERRO SIGNUP:", e?.code, e?.message, e);
      alert("ERRO SIGNUP: " + (e?.code || "") + " - " + (e?.message || e));

      const msg =
        e?.code === "auth/email-already-in-use"
          ? "Esse e-mail já está cadastrado."
          : e?.code === "auth/invalid-email"
            ? "E-mail inválido."
            : e?.code === "auth/weak-password"
              ? "Senha fraca."
              : "Erro ao cadastrar: " + (e?.message || e);

      setSignupMsg("❌ " + msg);
      alert(msg);
    } finally {
      btn.disabled = false;
      btn.textContent = "Criar conta";
    }
  });
}
function initAprovacaoUsuariosUI() {
  const btnReload = document.getElementById("btnReloadUsuariosPendentes");
  if (btnReload) btnReload.addEventListener("click", carregarUsuariosPendentes);

  auth.onAuthStateChanged((user) => {
    const menu = document.getElementById("menuAprovacao");
    const sec = document.getElementById("secAprovacaoUsuarios");

    const isAdmin = !!user && isAdminEmail(user.email);

    if (menu) menu.classList.toggle("hidden", !isAdmin);
    if (sec) sec.classList.toggle("hidden", !isAdmin);

    if (isAdmin) carregarUsuariosPendentes();
  });
}

async function carregarUsuariosPendentes() {
  const tbody = document.querySelector("#tabelaUsuariosPendentes tbody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5">Carregando...</td></tr>`;

  try {
    console.log("Carregando usuários pendentes...");
    const snap = await db.collection("usuarios").get();
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    console.log("Total usuarios no Firestore:", all.length, all);

    console.table(
      all.map((u) => ({
        id: u.id,
        uid: u.uid,
        email: u.email,
        aprovado: u.aprovado,
        ativo: u.ativo,
        criadoEm: u.criadoEm,
      })),
    );

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

    console.log("Pendentes:", pendentes.length, pendentes);

    if (!pendentes.length) {
      tbody.innerHTML = `<tr><td colspan="5">Nenhum usuário pendente 🎉</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    pendentes.forEach((u) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${u.nome || "-"}</td>
        <td>${u.email || "-"}</td>
        <td>${u.ativo === false ? "Inativo" : "Pendente"}</td>
        <td>${u.criadoEm || u.atualizadoEm || "-"}</td>
        <td>
          <button class="btn-sm" type="button" onclick="aprovarUsuario('${
            u.id
          }')">Aprovar</button>
          <button class="btn-sm btn-danger" type="button" onclick="bloquearUsuario('${
            u.id
          }')">Bloquear</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error("ERRO carregarUsuariosPendentes:", e);
    alert("ERRO ao carregar usuários: " + (e?.message || e));
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
        <td style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn-sm" type="button" onclick="toggleAtivoUsuario('${
            u.id
          }', ${u.ativo ? "false" : "true"})">
            ${u.ativo ? "Desativar" : "Ativar"}
          </button>

          <button class="btn-sm btn-danger" type="button" onclick="excluirUsuarioFirestore('${
            u.id
          }')">
            Excluir (Firestore)
          </button>
        </td>
      `;
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
    alert("Apenas o administrador pode alterar usuários.");
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
    alert("Apenas o administrador pode excluir usuários.");
    return;
  }

  const ok = confirm(
    "Tem certeza?\n\nIsso vai apagar o usuário do Firestore.\n⚠️ Ele pode continuar existindo no Firebase Authentication.",
  );
  if (!ok) return;

  await db.collection("usuarios").doc(docId).delete();

  await carregarUsuariosPendentes();
  await carregarUsuariosExistentes(
    document.getElementById("searchUsuariosExistentes")?.value || "",
  );
}

async function aprovarUsuario(uid) {
  const user = auth.currentUser;
  if (!user || !isAdminEmail(user.email)) {
    alert("Apenas o administrador pode aprovar.");
    return;
  }

  if (!confirm("Aprovar este usuário?")) return;

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
    alert("Apenas o administrador pode bloquear.");
    return;
  }

  if (!confirm("Bloquear este usuário?")) return;

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

  document.getElementById("secaoPedido")?.classList.add("hidden");
  document.getElementById("secaoRevisao")?.classList.add("hidden");

  document.querySelector("input[name='pedido'][value='nao']")?.click();
  document.querySelector("input[name='revisao'][value='nao']")?.click();
  document.querySelector("input[name='sol_oc'][value='nao']")?.click();
  document.querySelector("input[name='spot'][value='nao']")?.click();

  document.getElementById("wrapUnidade")?.classList.add("hidden");
  const unidadeEl = document.getElementById("unidade");
  if (unidadeEl) unidadeEl.value = "";

  const btnAdicionar = document.getElementById("btnAdicionar");
  if (btnAdicionar) btnAdicionar.textContent = "Adicionar";

  document.getElementById("btnCancelarEdicao")?.classList.add("hidden");

  window.scrollTo({ top: 0, behavior: "smooth" });
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

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelarEdicaoRepresentada() {
  editRepresentadaId = null;
  document.getElementById("rep_nome").value = "";

  const btn = document.getElementById("btnSalvarRepresentada");
  if (btn) btn.textContent = "Salvar Representada";

  document
    .getElementById("btnCancelarEdicaoRepresentada")
    ?.classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document
  .getElementById("btnCancelarEdicaoRepresentada")
  ?.addEventListener("click", cancelarEdicaoRepresentada);

function getRepresentadasFiltradas() {
  const term = (document.getElementById("searchRepresentadas")?.value || "")
    .trim()
    .toLowerCase();

  if (!term) return representadas.slice();

  return representadas.filter((r) =>
    String(r.nome || "")
      .toLowerCase()
      .includes(term),
  );
}

function verContatosCliente(id) {
  const cli = clientes.find((c) => c.id === id);
  if (!cli) return;

  let html = `<div class="modal-section">
    <strong>${cli.razao || "-"}</strong><br>
    CNPJ: ${cli.cnpj || "-"}
  </div><hr>`;

  const contatos = cli.contatos || [];
  if (!contatos.length) {
    html += `<div class="modal-section">Nenhum contato cadastrado.</div>`;
    return abrirModal("Contatos do Cliente", html);
  }

  html += contatos
    .map(
      (ct) => `
    <div class="modal-section">
      <strong>${ct.nome || "-"}</strong>
      ${ct.principal ? ` <span class="modal-badge">Principal</span>` : ``}
      <br>Função: ${ct.funcao || "-"}
      <br>Tel: ${ct.telefone || "-"}
      <br>E-mail: ${ct.email || "-"}
      ${ct.responsavelNome ? `<br><strong>Responsável:</strong> ${primeiroNome(ct.responsavelNome)}` : ""}
    </div>
    <hr>
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

function formatDateTimeBR(v) {
  if (!v) return "-";

  // Firestore Timestamp (compat) ou objeto com toDate()
  if (typeof v === "object") {
    if (typeof v.toDate === "function") v = v.toDate();
    else if (typeof v.seconds === "number") v = new Date(v.seconds * 1000);
  }

  // Date
  if (v instanceof Date) {
    const dd = String(v.getDate()).padStart(2, "0");
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    const yy = v.getFullYear();
    const hh = String(v.getHours()).padStart(2, "0");
    const mi = String(v.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yy} ${hh}:${mi}`;
  }

  const s = String(v).trim();
  if (!s) return "-";

  // "2026-02-27T15:24:00.000Z" ou parecido
  const d = new Date(s);
  if (!isNaN(d.getTime())) return formatDateTimeBR(d);

  return s;
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
  return REGISTROS_FILTER_FIELDS.map(
    (f) =>
      `<option value="${f.value}" ${f.value === selected ? "selected" : ""}>${f.label}</option>`,
  ).join("");
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

    <input class="multiTerm" type="text" placeholder="Digite para filtrar..." value="${term || ""}" />

    <button type="button" class="secondary btn-remove">Remover</button>
  `;

  div.querySelector(".btn-remove")?.addEventListener("click", () => {
    div.remove();
    const rest = document.querySelectorAll("#filtersRegistros .filter-item");

    currentPage = 1;
    renderTabela();
  });

  div.querySelector(".multiField")?.addEventListener("change", () => {
    currentPage = 1;
    renderTabela();
  });

  div.querySelector(".multiTerm")?.addEventListener("input", () => {
    renderTabelaDebounced();
  });
  wrap.appendChild(div);
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

    registrosCurrentPage = 1;
    renderTabelaRegistros();
  });
}

function debounce(fn, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const renderTabelaDebounced = debounce(() => {
  currentPage = 1;
  renderTabela();
}, 250);

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
    tag.innerHTML = `${f.term} ✕`;
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

  // regra especial pro CNPJ
  if (field === "cnpj_cliente") {
    return normalizeCNPJ(value || "").length === 0;
  }

  return isEmptyValue(value);
}
