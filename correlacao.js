"use strict";

// ============================================================================
// Correlação de Cabos Prysmian — MVP (Etapa 1: fluxo completo com dados MOCK)
// Fluxo: upload .xlsx -> lê descrições (coluna A) -> "processa" em lotes (mock)
//        -> tabela com highlight -> bloco de texto para colar no Excel.
// A chamada real à API do Claude + lookup na TABELA USO INTERNO entram na Etapa 2.
// ============================================================================

// ── Estado ───────────────────────────────────────────────────────────────────
let _corDescricoes = [];   // [{ linhaOriginal:int, descricao:str }]
let _corResultados = [];    // [{ linhaOriginal, descricao, codigo, status, observacao }]

const COR_TAM_LOTE = 45;    // descrições por lote (lotes maiores = menos relê do SKILL)

// 2FA é exigido na camada de dados (regras do Firestore). Sem o claim `mfa` válido no
// token, volta ao app principal (index.html) para refazer o TOTP.
async function _mfaClaimOk(user) {
  try {
    const r = await user.getIdTokenResult(true);
    const c = r.claims || {};
    return c.mfa === true && Number(c.mfaExp || 0) > Date.now();
  } catch (e) { return false; }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
(function waitFirebase() {
  if (window.db && window.auth) {
    try { _corBoot(); }
    catch (err) {
      console.error("[Correlacao] Erro ao inicializar:", err);
      document.body.insertAdjacentHTML("afterbegin",
        `<div style="background:#ef4444;color:#fff;padding:14px 20px;font-family:monospace;font-size:13px;position:fixed;top:0;left:0;right:0;z-index:99999;">
          ❌ Erro JS: ${err.message}
          <button onclick="this.parentElement.remove()" style="float:right;background:none;border:none;color:#fff;font-size:16px;cursor:pointer;">✕</button>
        </div>`);
    }
    return;
  }
  setTimeout(waitFirebase, 80);
})();

function _corBoot() {
  // Navegação
  document.getElementById("btnVoltar").addEventListener("click",
    () => window.location.href = "index.html");
  document.getElementById("btnSair").addEventListener("click", () => {
    window.auth.signOut().then(() => window.location.href = "index.html");
  });

  // Tema
  const saved = localStorage.getItem("theme") || "light";
  if (saved === "dark") document.body.classList.add("dark");
  _corUpdateThemeLabel();

  // Guarda de autenticação — sem login OU sem 2FA válido, volta ao CRM
  window.auth.onAuthStateChanged(async (user) => {
    if (!user || !(await _mfaClaimOk(user))) window.location.href = "index.html";
  });

  // Upload + ações
  _corInitUpload();
  document.getElementById("corBtnProcessar").addEventListener("click", _corProcessar);
  document.getElementById("corBtnLimpar").addEventListener("click", _corLimpar);
  document.getElementById("corBtnCopiar").addEventListener("click", _corCopiar);
}

// ── Sidebar / tema (globais, chamadas via onclick no HTML) ────────────────────
function corToggleSidebar() {
  document.getElementById("sidebar").classList.toggle("collapsed");
}
function corToggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
  _corUpdateThemeLabel();
}
function _corUpdateThemeLabel() {
  const lbl = document.getElementById("themeLabel");
  if (lbl) lbl.textContent = document.body.classList.contains("dark") ? "Modo claro" : "Modo escuro";
}

// ── Upload e leitura do Excel ─────────────────────────────────────────────────
function _corInitUpload() {
  const dz = document.getElementById("corDropZone");
  const input = document.getElementById("corInputArquivo");

  dz.addEventListener("click", () => input.click());
  input.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) _corLerArquivo(file);
  });

  ["dragover", "dragenter"].forEach((ev) =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("dragover"); }));
  ["dragleave", "dragend"].forEach((ev) =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("dragover"); }));
  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    dz.classList.remove("dragover");
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) _corLerArquivo(file);
  });
}

async function _corLerArquivo(file) {
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error("Planilha vazia ou ilegível.");

    // Coluna A, uma descrição por linha, sem cabeçalho. Ignora vazias mas
    // preserva o índice original (linha real na planilha) para alinhar a colagem.
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });
    _corDescricoes = [];
    rows.forEach((row, idx) => {
      const desc = String((row && row[0] != null ? row[0] : "")).trim();
      if (!desc) return;
      _corDescricoes.push({ linhaOriginal: idx + 1, descricao: desc });
    });
    _corDescricoes = _corAgruparFormacoes(_corDescricoes);

    if (!_corDescricoes.length) {
      _corToast("Nenhuma descrição encontrada na coluna A.", "error");
      return;
    }

    // Atualiza a UI de arquivo selecionado
    document.getElementById("corFileNome").textContent = file.name;
    document.getElementById("corFileQtd").textContent =
      `${_corDescricoes.length} descriç${_corDescricoes.length === 1 ? "ão" : "ões"}`;
    document.getElementById("corArquivoInfo").style.display = "flex";
    document.getElementById("corBtnProcessar").disabled = false;
    document.getElementById("corBtnLimpar").classList.remove("cor-hidden");

    // Esconde resultado anterior, se houver
    document.getElementById("corResultado").classList.add("cor-hidden");
  } catch (e) {
    console.error("[Correlacao] Falha ao ler arquivo:", e);
    _corToast("Não foi possível ler o arquivo. Verifique se é um .xlsx válido.", "error");
  }
}

// ── Processamento (Etapa 1: MOCK em lotes, com progresso) ─────────────────────
async function _corProcessar() {
  if (!_corDescricoes.length) return;

  const btn = document.getElementById("corBtnProcessar");
  btn.disabled = true;
  document.getElementById("corResultado").classList.add("cor-hidden");

  const prog = document.getElementById("corProgresso");
  prog.style.display = "flex";

  // Cabeçalhos de grupo não vão à API — entram direto no resultado, sem código próprio.
  const processaveis = _corDescricoes.filter((d) => !d.ehCabecalho);
  const lotes = _corChunk(processaveis, COR_TAM_LOTE);
  _corResultados = _corDescricoes.filter((d) => d.ehCabecalho).map((d) => ({
    linhaOriginal: d.linhaOriginal, descricao: d.descricao,
    codigo: "", status: "CABECALHO",
    observacao: "Cabeçalho do grupo — os códigos vão nas formações abaixo.",
  }));

  try {
    for (let i = 0; i < lotes.length; i++) {
      _corSetProgresso(`Processando lote ${i + 1} de ${lotes.length}…`);
      try {
        const resp = await fetch(_corApiBase() + "/correlacao/lote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ descricoes: lotes[i] }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        data.resultados.forEach((r) => _corResultados.push(r));
      } catch (errLote) {
        // Um lote falhou (rede, rate limit, key) — marca as linhas como ERRO e segue.
        console.error(`[Correlacao] Lote ${i + 1} falhou:`, errLote);
        lotes[i].forEach((item) => _corResultados.push({
          linhaOriginal: item.linhaOriginal, descricao: item.descricao,
          codigo: "", status: "ERRO",
          observacao: `Falha ao processar: ${errLote.message}`,
        }));
      }
    }
    _corRenderResultado();
  } catch (e) {
    console.error("[Correlacao] Erro no processamento:", e);
    _corToast("Erro ao processar. Tente novamente.", "error");
  } finally {
    prog.style.display = "none";
    btn.disabled = false;
  }
}

// Base do backend: local enquanto desenvolvemos; produção via Cloud Functions (futuro).
function _corApiBase() {
  const h = location.hostname;
  if (h === "localhost" || h === "127.0.0.1" || h === "") return "http://127.0.0.1:3001";
  return "https://southamerica-east1-crm-three-ar.cloudfunctions.net/api";
}

// ── Render do resultado ───────────────────────────────────────────────────────
function _corRenderResultado() {
  const tbody = document.getElementById("corTabelaBody");
  tbody.innerHTML = "";

  const contagem = { OK: 0, PENDENCIA: 0, AMBIGUO: 0, ERRO: 0 };

  _corResultados.forEach((r) => {
    contagem[r.status] = (contagem[r.status] || 0) + 1;
    const atencao = ["PENDENCIA", "AMBIGUO", "ERRO"].includes(r.status);
    const tr = document.createElement("tr");
    if (atencao) tr.className = "cor-atencao";
    tr.innerHTML = `
      <td class="cor-col-num">${r.linhaOriginal}</td>
      <td>${_corEsc(r.descricao)}</td>
      <td class="cor-col-cod">${_corEsc(r.codigo || "—")}</td>
      <td>${_corStatusBadge(r.status)}</td>
      <td style="color:var(--text-muted);font-size:12px;">${_corEsc(r.observacao || "")}</td>`;
    tbody.appendChild(tr);
  });

  _corRenderResumo(contagem);

  // Bloco de texto: alinhado à planilha original (vazio nas linhas sem descrição).
  document.getElementById("corBlocoCodigos").value = _corMontarBloco(_corResultados);

  document.getElementById("corResultado").classList.remove("cor-hidden");
  document.getElementById("corResultado").scrollIntoView({ behavior: "smooth", block: "start" });
}

function _corRenderResumo(contagem) {
  const wrap = document.getElementById("corResumo");
  const chips = [
    { k: "OK",        cls: "ok",   dot: "#22c55e", label: "OK" },
    { k: "PENDENCIA", cls: "pend", dot: "#eab308", label: "Pendência" },
    { k: "AMBIGUO",   cls: "amb",  dot: "#f97316", label: "Ambíguo" },
    { k: "ERRO",      cls: "erro", dot: "#ef4444", label: "Erro" },
  ];
  wrap.innerHTML = `<span class="cor-chip" style="background:var(--bg-container);color:var(--text-main);border:1px solid var(--border-soft);">Total: ${_corResultados.length}</span>` +
    chips.filter((c) => contagem[c.k] > 0).map((c) =>
      `<span class="cor-chip ${c.cls}"><span class="cor-dot" style="background:${c.dot}"></span>${c.label}: ${contagem[c.k]}</span>`
    ).join("");
}

// Monta o bloco de códigos na MESMA ordem das linhas do Excel original.
// Linhas sem descrição ficam vazias; não resolvidas ficam "PENDENTE".
function _corMontarBloco(resultados) {
  if (!resultados.length) return "";
  const maxLinha = Math.max(...resultados.map((r) => r.linhaOriginal));
  const linhas = new Array(maxLinha).fill("");
  resultados.forEach((r) => {
    if (r.status === "CABECALHO") linhas[r.linhaOriginal - 1] = "";
    else linhas[r.linhaOriginal - 1] = (r.status === "OK" && r.codigo) ? r.codigo : "PENDENTE";
  });
  return linhas.join("\n");
}

// ── Copiar / Limpar ───────────────────────────────────────────────────────────
async function _corCopiar() {
  const ta = document.getElementById("corBlocoCodigos");
  try {
    await navigator.clipboard.writeText(ta.value);
    _corToast("Códigos copiados! Cole numa coluna do seu Excel.", "success");
  } catch (e) {
    // Fallback para navegadores sem Clipboard API
    ta.removeAttribute("readonly");
    ta.select();
    document.execCommand("copy");
    ta.setAttribute("readonly", "");
    _corToast("Códigos copiados!", "success");
  }
}

function _corLimpar() {
  _corDescricoes = [];
  _corResultados = [];
  document.getElementById("corInputArquivo").value = "";
  document.getElementById("corArquivoInfo").style.display = "none";
  document.getElementById("corBtnProcessar").disabled = true;
  document.getElementById("corBtnLimpar").classList.add("cor-hidden");
  document.getElementById("corResultado").classList.add("cor-hidden");
}

// ── Agrupamento de cabeçalho + formações ──────────────────────────────────────
// Padrão comum em cotações: uma linha com a descrição (sem bitola própria) seguida
// de várias linhas que são SÓ a formação (ex: "35mm2", "50mm2"). Cada formação
// pertence ao MESMO produto da descrição-cabeçalho. Aqui combinamos "cabeçalho +
// formação" e marcamos a linha de cabeçalho como tal (ela não tem código próprio).
function _corAgruparFormacoes(linhas) {
  const out = [];
  let cabecalho = null;
  for (const item of linhas) {
    const desc = item.descricao;
    if (_corEhSoFormacao(desc)) {
      if (cabecalho) out.push({ linhaOriginal: item.linhaOriginal, descricao: `${cabecalho} ${desc}` });
      else out.push(item); // formação solta, sem cabeçalho conhecido
    } else if (_corTemSecao(desc)) {
      cabecalho = null; // descrição completa = item próprio; encerra o grupo
      out.push(item);
    } else {
      cabecalho = desc; // descrição sem bitola = cabeçalho de grupo
      out.push({ linhaOriginal: item.linhaOriginal, descricao: desc, ehCabecalho: true });
    }
  }
  return out;
}
// "só formação": basicamente só a bitola, sem texto descritivo (ex: 35mm2, 3x35mm2).
function _corEhSoFormacao(s) {
  const t = String(s || "").trim().replace(/\s+/g, "");
  return !!t && /^[\d.,x×gG+()/-]*mm[²2]?$/i.test(t);
}
// "tem bitola": a descrição menciona uma seção (mm²/mm2/mm ou NxM) em algum lugar.
function _corTemSecao(s) {
  const t = String(s || "");
  return /\d\s*mm[²2]?\b/i.test(t) || /\d+\s*[x×]\s*\d+/i.test(t);
}

// ── Utilitários ───────────────────────────────────────────────────────────────
function _corStatusBadge(status) {
  const map = {
    OK:        { cls: "ok",   txt: "OK" },
    PENDENCIA: { cls: "pend", txt: "Pendência" },
    AMBIGUO:   { cls: "amb",  txt: "Ambíguo" },
    ERRO:      { cls: "erro", txt: "Erro" },
    CABECALHO: { cls: "cab",  txt: "Grupo" },
  };
  const s = map[status] || map.ERRO;
  return `<span class="cor-status-badge ${s.cls}">${s.txt}</span>`;
}

function _corChunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function _corSetProgresso(txt) {
  document.getElementById("corProgressoTexto").textContent = txt;
}

function _corEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function _corToast(msg, tipo) {
  if (typeof showToast === "function") showToast(msg, tipo);
  else console.log(`[${tipo || "info"}] ${msg}`);
}
