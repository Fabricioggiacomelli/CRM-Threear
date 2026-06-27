"use strict";

// ── State ────────────────────────────────────────────────────────────────────
let _genClientes      = [];
let _genRepresentadas = [];
let _genProjetos      = [];
let _genCurrentUser   = null;
let _genCurrentEmail  = "";
let _genItens         = [];
let _genItemCounter   = 0;

const SEGMENTOS_POR_BU = {
  "T&I":              [],
  OGP:                ["On Shore", "Off Shore", "DW"],
  OEM:                ["Cranes","infra","Industrial","Marine","Mining","Nuclear",
                       "Papel & Celulose","Raiways","Renew (PV)","Renew (Wind)",
                       "Rolling Stock","Water"],
  "High Voltage":     [],
  OHTL:               [],
  Telecom:            [],
  "Power Distribution":[],
  "Acessórios":       [],
  MMS:                [],
  "Renováveis":       [],
  "Serviços":         ["HV","PV","Infra","Industrial","Data Center"],
};

// ── Bootstrap ────────────────────────────────────────────────────────────────
(function waitFirebase() {
  if (window.db && window.auth) {
    try { _genBoot(); }
    catch(err) {
      console.error("[Gerador] Erro ao inicializar:", err);
      document.body.insertAdjacentHTML("afterbegin",
        `<div style="background:#ef4444;color:#fff;padding:14px 20px;font-family:monospace;font-size:13px;position:fixed;top:0;left:0;right:0;z-index:99999;">
          ❌ Erro JS: ${err.message} <button onclick="this.parentElement.remove()" style="float:right;background:none;border:none;color:#fff;font-size:16px;cursor:pointer;">✕</button>
        </div>`);
    }
    return;
  }
  setTimeout(waitFirebase, 80);
})();

function _genBoot() {
  // Navigation
  document.getElementById("btnVoltar").addEventListener("click",
    () => window.location.href = "index.html");
  document.getElementById("btnSair").addEventListener("click", () => {
    window.auth.signOut().then(() => window.location.href = "index.html");
  });

  // Theme
  const saved = localStorage.getItem("theme") || "light";
  if (saved === "dark") document.body.classList.add("dark");
  _genUpdateThemeLabel();

  // Date default
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("gen_data_entrada").value = today;

  // Money mask
  const valEl = document.getElementById("gen_valor_total");
  valEl.addEventListener("input", () => {
    let raw = valEl.value.replace(/\D/g, "");
    if (!raw) { valEl.value = ""; return; }
    let n = parseInt(raw, 10) / 100;
    valEl.value = n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  });

  // Autocompletes — wired here; data fills in after auth
  const _genSelectCliente = c => {
    document.getElementById("gen_razao").value       = c.razao || c.nome || "";
    document.getElementById("gen_cnpj").value        = c.cnpj            || "";
    document.getElementById("gen_solicitante").value = c.solicitante || c.contato || "";
    document.getElementById("gen_telefone").value    = c.telefone        || "";
    document.getElementById("gen_email").value       = c.email           || "";
    document.getElementById("gen_razao").dataset.clienteId = c.id || "";
  };

  const _genRenderCliente = (c, q) => {
    const nome  = _genHighlight(c.razao || c.nome || "", q);
    const cnpj  = c.cnpj     ? `<div class="ac-sub">${_genEscape(c.cnpj)}</div>` : "";
    const end   = c.endereco ? `<div class="ac-sub ac-end">${_genEscape(c.endereco)}</div>` : "";
    return `<div class="ac-nome">${nome}</div>${cnpj}${end}`;
  };

  _genInitAutoComplete({
    inputId:    "gen_razao",
    boxId:      "gen_razaoAuto",
    getData:    () => _genClientes,
    filterFn:   (c, q) => {
      const razao  = (c.razao || c.nome || "").toLowerCase();
      const digits = q.replace(/\D/g, "");
      return razao.includes(q) ||
        (digits.length > 0 && (c.cnpj||"").replace(/\D/g,"").includes(digits));
    },
    renderItem: _genRenderCliente,
    onSelect:   _genSelectCliente,
  });

  _genInitAutoComplete({
    inputId:    "gen_cnpj",
    boxId:      "gen_cnpjAuto",
    getData:    () => _genClientes,
    filterFn:   (c, q) => {
      const digits = q.replace(/\D/g,"");
      return digits.length > 0 && (c.cnpj||"").replace(/\D/g,"").includes(digits);
    },
    renderItem: (c, q) => {
      const cnpjH = _genHighlight(c.cnpj || "", q);
      const nome  = _genEscape(c.razao || c.nome || "");
      const end   = c.endereco ? `<div class="ac-sub ac-end">${_genEscape(c.endereco)}</div>` : "";
      return `<div class="ac-sub" style="font-weight:700">${cnpjH}</div><div class="ac-nome">${nome}</div>${end}`;
    },
    onSelect:   _genSelectCliente,
  });

  _genInitAutoComplete({
    inputId:    "gen_nome_projeto",
    boxId:      "gen_projetoAuto",
    getData:    () => _genProjetos,
    filterFn:   (p, q) => (p.nome||"").toLowerCase().includes(q),
    renderItem: (p, q) => {
      const nomeH = _genHighlight(p.nome || "", q);
      const extra = [p.tipo, p.status].filter(Boolean).join(" • ");
      return `<div class="ac-nome">${nomeH}</div>` +
             (extra ? `<div class="ac-sub">${_genEscape(extra)}</div>` : "");
    },
    onSelect: p => {
      document.getElementById("gen_nome_projeto").value = p.nome || "";
      document.getElementById("gen_nome_projeto").dataset.projetoId = p.id || "";
    },
  });

  // Auth gate
  window.auth.onAuthStateChanged(user => {
    if (!user) { window.location.href = "index.html"; return; }
    _genCurrentEmail = user.email || "";
    _genCurrentUser  = user;
    _genCarregarDados();
  });
}

// ── Generic Autocomplete Engine ───────────────────────────────────────────────
function _genInitAutoComplete(opts) {
  const input = document.getElementById(opts.inputId);
  const box   = document.getElementById(opts.boxId);
  if (!input || !box) return;

  let _mouseInBox = false;

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { box.classList.add("hidden"); return; }

    const results = opts.getData().filter(item => opts.filterFn(item, q)).slice(0, 12);
    if (!results.length) { box.classList.add("hidden"); return; }

    box.innerHTML = results.map((item, i) => {
      const html = opts.renderItem
        ? opts.renderItem(item, q)
        : (opts.highlight
            ? _genHighlight(opts.getLabel(item), q)
            : _genEscape(opts.getLabel(item)));
      return `<div class="autocomplete-item" data-idx="${i}">${html}</div>`;
    }).join("");

    box.querySelectorAll(".autocomplete-item").forEach((el, i) => {
      el.addEventListener("mousedown", e => {
        e.preventDefault();
        _mouseInBox = true;
        opts.onSelect(results[i]);
        box.classList.add("hidden");
        _mouseInBox = false;
      });
    });

    box.classList.remove("hidden");
  });

  input.addEventListener("blur", () => {
    if (!_mouseInBox) box.classList.add("hidden");
  });

  input.addEventListener("focus", () => {
    if (input.value.trim()) input.dispatchEvent(new Event("input"));
  });

  input.addEventListener("keydown", e => {
    if (e.key === "Escape") box.classList.add("hidden");
  });
}

function _genHighlight(text, q) {
  const esc = _genEscape(text);
  const re  = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + ")", "gi");
  return esc.replace(re, "<strong>$1</strong>");
}

function _genEscape(str) {
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

// ── Load Data ─────────────────────────────────────────────────────────────────
async function _genCarregarDados() {
  try {
    const [snapC, snapR, snapP] = await Promise.all([
      window.db.collection("clientes").get(),
      window.db.collection("representadas").get(),
      window.db.collection("projetos").get(),
    ]);

    _genClientes      = snapC.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => !c.deletado);
    _genProjetos      = snapP.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.deletado);
    _genRepresentadas = snapR.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => (a.nome||"").localeCompare(b.nome||""));

    _genPopularRepresentadas();
  } catch(e) {
    console.error("Erro ao carregar dados:", e);
    if (window.showToast) showToast("Erro ao carregar dados do banco.", "error");
  }
}

function _genPopularRepresentadas() {
  const sel = document.getElementById("gen_representada");
  const cur = sel.value;
  sel.innerHTML = '<option value="">Selecione...</option>';
  _genRepresentadas.forEach(r => {
    const op = document.createElement("option");
    op.value       = r.id;
    op.textContent = r.nome || r.id;
    sel.appendChild(op);
  });
  if (cur) sel.value = cur;
}

// ── BU → Segmento ─────────────────────────────────────────────────────────────
function _genOnBuChange() {
  const bu      = document.getElementById("gen_bu").value;
  const segSel  = document.getElementById("gen_segmento");
  const segWrap = document.getElementById("gen_segmentoWrap");
  const segs    = SEGMENTOS_POR_BU[bu] || [];

  if (segs.length > 0) {
    segSel.innerHTML = '<option value="">Selecione</option>' +
      segs.map(s => `<option value="${_genEscape(s)}">${_genEscape(s)}</option>`).join("");
    segWrap.style.display = "";
  } else {
    segWrap.style.display = "none";
    segSel.value = "";
  }
}

// ── Representada → Mantex ─────────────────────────────────────────────────────
function _genOnRepresentadaChange() {
  const sel  = document.getElementById("gen_representada");
  const nome = sel.options[sel.selectedIndex]?.text || "";
  const wrap = document.getElementById("gen_unidadeWrap");
  const isMantex = nome.toLowerCase().includes("mantex");
  wrap.style.display = isMantex ? "" : "none";
  if (!isMantex) document.getElementById("gen_unidade").value = "";
}

// ── Itens da Oferta ───────────────────────────────────────────────────────────
function _genNovoItem(id) {
  return {
    id,
    descricao:        "",
    cod_material:     "",
    qtde:             "",
    unidade:          "",
    preco_unit:       "",
    valor_total_item: "",
    icms:             "",
    ipi:              "",
    pis_cofins:       "9,25",
    prazo_entrega:    "",
    classif_fiscal:   "",
    filial:           "",
  };
}

function _genAdicionarItem() {
  const id = ++_genItemCounter;
  _genItens.push(_genNovoItem(id));
  _genRenderItens();
  setTimeout(() => {
    const el = document.getElementById(`gen_desc_${id}`);
    if (el) el.focus();
  }, 30);
}

function _genRemoverItem(id) {
  _genItens = _genItens.filter(i => i.id !== id);
  _genRenderItens();
  _genAtualizarTotalGeral();
}

function _genItemField(id, field, value) {
  const item = _genItens.find(i => i.id === id);
  if (item) item[field] = value;
}

function _genItemMoney(id, field, el) {
  let raw = el.value.replace(/\D/g, "");
  if (!raw) {
    el.value = "";
    _genItemField(id, field, "");
  } else {
    const n   = parseInt(raw, 10) / 100;
    const str = n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
    el.value  = str;
    _genItemField(id, field, str);
  }
  _genCalcItemTotal(id);
}

function _genParseMoneyBR(str) {
  return parseFloat((str || "").replace(/[^\d,]/g,"").replace(",",".")) || 0;
}

function _genCalcItemTotal(id) {
  const item = _genItens.find(i => i.id === id);
  if (!item) return;
  const qtde  = parseFloat((item.qtde || "").replace(",",".")) || 0;
  const preco = _genParseMoneyBR(item.preco_unit);
  const total = qtde * preco;
  const str   = total > 0
    ? total.toLocaleString("pt-BR", { style:"currency", currency:"BRL" })
    : "";
  item.valor_total_item = str;
  const el = document.getElementById(`gen_vtotal_${id}`);
  if (el) el.value = str;
  _genAtualizarTotalGeral();
}

function _genAtualizarTotalGeral() {
  const total = _genItens.reduce((s, i) => s + _genParseMoneyBR(i.valor_total_item), 0);
  if (total > 0) {
    const el = document.getElementById("gen_valor_total");
    if (el) el.value = total.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  }
}

function _genRenderItens() {
  const lista = document.getElementById("gen_itens_lista");

  if (!_genItens.length) {
    lista.innerHTML = `
      <div class="gen-itens-empty">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
          <path d="M7 15h2m4 0h4"/>
        </svg>
        <span>Nenhum item adicionado.<br>Clique em <strong>+ Adicionar Item</strong> ou use <strong>📋 Colar da extensão</strong>.</span>
      </div>`;
    return;
  }

  lista.innerHTML = _genItens.map((item, idx) => `
    <div class="gen-item-card">

      <!-- Header -->
      <div class="gen-item-header">
        <span class="gen-item-badge">Item ${String(idx+1).padStart(2,"0")}</span>
        <button type="button" class="gen-item-remove" onclick="_genRemoverItem(${item.id})" title="Remover item" aria-label="Remover item">
          ✕
        </button>
      </div>

      <div class="gen-item-body">

        <!-- Seção 1: Identificação -->
        <div class="gen-item-row">
          <div class="gen-item-field" style="flex:1 1 280px;">
            <label>Descrição do Produto</label>
            <input type="text" id="gen_desc_${item.id}"
              placeholder="Nome / descrição do produto ou serviço..."
              value="${_genEscape(item.descricao)}"
              oninput="_genItemField(${item.id},'descricao',this.value)">
          </div>
          <div class="gen-item-field" style="flex:0 0 180px;">
            <label>Cód. Material Cliente</label>
            <input type="text" placeholder="ex: 23881402"
              value="${_genEscape(item.cod_material)}"
              oninput="_genItemField(${item.id},'cod_material',this.value)">
          </div>
        </div>

        <!-- Seção 2: Quantidade & Preço (destaque visual) -->
        <div class="gen-item-row price-row">
          <div class="gen-item-field" style="flex:0 0 82px;">
            <label>Qtde</label>
            <input type="text" inputmode="decimal" placeholder="0"
              value="${_genEscape(item.qtde)}"
              oninput="_genItemField(${item.id},'qtde',this.value);_genCalcItemTotal(${item.id})">
          </div>
          <div class="gen-item-field" style="flex:0 0 88px;">
            <label>Unidade</label>
            <input type="text" placeholder="m / un / kg"
              value="${_genEscape(item.unidade)}"
              oninput="_genItemField(${item.id},'unidade',this.value)">
          </div>
          <div class="gen-item-field" style="flex:0 0 148px;">
            <label>Preço R$/Un</label>
            <input type="text" placeholder="R$ 0,00"
              value="${_genEscape(item.preco_unit)}"
              oninput="_genItemMoney(${item.id},'preco_unit',this)">
          </div>
          <div class="gen-item-field" style="flex:1 1 160px;">
            <label>Valor Total R$ (c/ impostos)</label>
            <input type="text" readonly class="vtotal-display" placeholder="—"
              id="gen_vtotal_${item.id}"
              value="${_genEscape(item.valor_total_item)}">
          </div>
        </div>

        <!-- Seção 3: Dados Fiscais -->
        <div class="gen-item-section-label">Dados Fiscais</div>
        <div class="gen-item-row">
          <div class="gen-item-field" style="flex:0 0 82px;">
            <label>ICMS %</label>
            <input type="text" placeholder="ex: 18"
              value="${_genEscape(item.icms)}"
              oninput="_genItemField(${item.id},'icms',this.value)">
          </div>
          <div class="gen-item-field" style="flex:0 0 82px;">
            <label>IPI %</label>
            <input type="text" placeholder="ex: 0"
              value="${_genEscape(item.ipi)}"
              oninput="_genItemField(${item.id},'ipi',this.value)">
          </div>
          <div class="gen-item-field" style="flex:0 0 108px;">
            <label>PIS/COFINS %</label>
            <input type="text" placeholder="ex: 9,25"
              value="${_genEscape(item.pis_cofins)}"
              oninput="_genItemField(${item.id},'pis_cofins',this.value)">
          </div>
          <div class="gen-item-field" style="flex:0 0 108px;">
            <label>Prazo Entrega (dias)</label>
            <input type="text" placeholder="ex: 30"
              value="${_genEscape(item.prazo_entrega)}"
              oninput="_genItemField(${item.id},'prazo_entrega',this.value)">
          </div>
          <div class="gen-item-field" style="flex:1 1 130px;">
            <label>Classif. Fiscal (NCM)</label>
            <input type="text" placeholder="ex: 8544.42.00"
              value="${_genEscape(item.classif_fiscal)}"
              oninput="_genItemField(${item.id},'classif_fiscal',this.value)">
          </div>
          <div class="gen-item-field" style="flex:1 1 120px;">
            <label>Filial de Faturamento</label>
            <input type="text" placeholder="ex: São Paulo"
              value="${_genEscape(item.filial)}"
              oninput="_genItemField(${item.id},'filial',this.value)">
          </div>
        </div>

      </div><!-- /body -->
    </div>
  `).join("");
}

// ── Collect & Validate ────────────────────────────────────────────────────────
function _genColetarDados() {
  const v = id => (document.getElementById(id)?.value || "").trim();

  const repSel  = document.getElementById("gen_representada");
  const repNome = repSel.options[repSel.selectedIndex]?.text || "";
  const repId   = repSel.value || "";

  const segWrap    = document.getElementById("gen_segmentoWrap");
  const segmento   = segWrap.style.display !== "none" ? v("gen_segmento") : "";

  const unidadeWrap = document.getElementById("gen_unidadeWrap");
  const unidade    = unidadeWrap.style.display !== "none" ? v("gen_unidade") : "";

  const itens = _genItens.filter(i => (i.descricao || "").trim() !== "");

  let valorNum = 0;
  const valorStr = v("gen_valor_total");
  if (valorStr) {
    const digits = valorStr.replace(/[^\d,]/g,"").replace(",",".");
    valorNum = parseFloat(digits) || 0;
  }

  return {
    clienteId:        document.getElementById("gen_razao")?.dataset.clienteId || "",
    razao:            v("gen_razao"),
    cnpj:             v("gen_cnpj"),
    solicitante:      v("gen_solicitante"),
    telefone:         v("gen_telefone"),
    email:            v("gen_email"),
    oferta:           v("gen_oferta"),
    dataEntrada:      v("gen_data_entrada"),
    dataEnvio:        v("gen_data_envio"),
    tipoOferta:       v("gen_tipo_oferta"),
    status:           v("gen_status"),
    bu:               v("gen_bu"),
    segmento,
    representadaId:   repId,
    representadaNome: repNome,
    unidade,
    valorTotal:       valorNum,
    valorTotalStr:    valorStr,
    nomeProjeto:      v("gen_nome_projeto"),
    projetoId:        document.getElementById("gen_nome_projeto")?.dataset.projetoId || "",
    refCliente:       v("gen_ref_cliente"),
    obsGeral:         v("gen_obs_geral"),
    itens,
  };
}

function _genValidar(d) {
  const erros = [];
  if (!d.razao)          erros.push("Razão Social é obrigatória.");
  if (!d.solicitante)    erros.push("Solicitante é obrigatório.");
  if (!d.telefone)       erros.push("Telefone é obrigatório.");
  if (!d.email)          erros.push("E-mail é obrigatório.");
  if (!d.oferta)         erros.push("Nº da Oferta é obrigatório.");
  if (!d.dataEntrada)    erros.push("Data Entrada é obrigatória.");
  if (!d.tipoOferta)     erros.push("Tipo é obrigatório.");
  if (!d.status)         erros.push("Status é obrigatório.");
  if (!d.bu)             erros.push("B.U. é obrigatório.");
  if (!d.representadaId) erros.push("Representada é obrigatória.");
  if (!d.valorTotal)     erros.push("Valor Total é obrigatório.");

  const segsParaBu = SEGMENTOS_POR_BU[d.bu] || [];
  if (segsParaBu.length > 0 && !d.segmento)
    erros.push("Segmento é obrigatório para a BU selecionada.");

  if ((d.representadaNome||"").toLowerCase().includes("mantex") && !d.unidade)
    erros.push("Unidade Mantex é obrigatória.");

  if (d.cnpj && !_genValidarCNPJ(d.cnpj))
    erros.push("CNPJ inválido.");

  return erros;
}

// ── Firestore Save ────────────────────────────────────────────────────────────
async function criarRegistroAutomaticoGerador(d) {
  const id  = _genId();
  const now = firebase.firestore.FieldValue.serverTimestamp();

  const registro = {
    id,
    // field names must match exactly what script.js reads from ofertas collection
    razao:              d.razao,
    cnpj_cliente:       d.cnpj,
    solicitante:        d.solicitante,
    telefone:           d.telefone,
    email:              d.email,
    oferta:             d.oferta,
    data_entrada:       d.dataEntrada,
    data_envio:         d.dataEnvio || "",
    tipo_oferta:        d.tipoOferta,
    status:             d.status,
    bu:                 d.bu,
    segmento:           d.segmento || "",
    representadaNome:   d.representadaNome,
    representadaId:     d.representadaId,
    unidade:            d.unidade || "",
    valor_total:        d.valorTotalStr,
    nome_projeto:       d.nomeProjeto || "",
    projetoId:          d.projetoId   || "",
    ref_cliente:        d.refCliente  || "",
    obs_geral:          d.obsGeral    || "",
    itens_oferta:       d.itens,
    clienteId:          d.clienteId   || "",
    responsavelEmail:   _genCurrentEmail,
    criadoPor:          _genCurrentEmail,
    possuiPedido:       "nao",
    possuiRevisao:      "nao",
    atendimentoSpot:    "nao",
    criadoEm:           now,
    atualizadoEm:       now,
    deletado:           false,
    origem:             "gerador",
  };

  await window.db.collection("ofertas").doc(id).set(registro);

  try {
    await window.db.collection("auditoria").add({
      acao:       "criar_via_gerador",
      registroId: id,
      usuario:    _genCurrentEmail,
      timestamp:  now,
    });
  } catch(_) {}

  return id;
}

// ── PDF Generation ────────────────────────────────────────────────────────────
function gerarPdfComercial(d) {
  const w = window.open("","_blank","width=960,height=760");
  if (!w) { showToast("Pop-up bloqueado. Permita pop-ups para este site.", "warning"); return; }
  w.document.write(_buildProposta(d, "comercial"));
  w.document.close();
}

function gerarPdfTecnico(d) {
  const w = window.open("","_blank","width=960,height=760");
  if (!w) return;
  w.document.write(_buildProposta(d, "tecnica"));
  w.document.close();
}

function _buildProposta(d, tipo) {
  const isCom    = tipo === "comercial";
  const cor      = isCom ? "#1a56db" : "#0d9488";
  const corLight = isCom ? "#eef3ff" : "#f0fafa";
  const titulo   = isCom ? "PROPOSTA COMERCIAL" : "PROPOSTA TÉCNICA";
  const hoje     = new Date();
  const dataLonga = hoje.toLocaleDateString("pt-BR", { day:"2-digit", month:"long", year:"numeric" });
  const dataCurta = hoje.toLocaleDateString("pt-BR");
  const segStr   = d.segmento ? ` / ${d.segmento}` : "";
  const logoUrl  = window.location.origin +
                   window.location.pathname.replace(/\/[^/]*$/, "/") + "Imagens/Logo.png";
  const userName = (_genCurrentUser && _genCurrentUser.displayName) || _genCurrentEmail;

  // ── Items table ──
  const temItens = d.itens && d.itens.length > 0;
  let itensTable = "";

  if (temItens) {
    if (isCom) {
      itensTable = `
      <h3 class="sec-title">PLANILHA DE PREÇOS</h3>
      <table>
        <thead>
          <tr>
            <th style="width:36px;text-align:center">Item</th>
            <th>Descrição Produto / Cód. Material Cliente</th>
            <th style="width:44px;text-align:center">Qtde</th>
            <th style="width:44px;text-align:center">Unid.</th>
            <th style="width:80px;text-align:right">Preço R$/Un</th>
            <th style="width:90px;text-align:right">Valor Total R$<br>c/ICMS+PIS+Cofins</th>
            <th style="width:40px;text-align:center">ICMS %</th>
            <th style="width:36px;text-align:center">IPI %</th>
            <th style="width:50px;text-align:center">PIS/COFINS</th>
            <th style="width:52px;text-align:center">Prazo<br>(dias)</th>
            <th style="width:70px;text-align:center">Classif.<br>Fiscal</th>
            <th style="width:64px;text-align:center">Filial de<br>Fatur.</th>
          </tr>
        </thead>
        <tbody>
          ${d.itens.map((item, i) => `
            <tr class="${i%2===0?"":"alt"}">
              <td style="text-align:center;font-weight:700;color:${cor}">${String((i+1)*10).padStart(3,"0")}</td>
              <td>
                <div style="font-weight:600">${_genEscape(item.descricao||"")}</div>
                ${item.cod_material ? `<div style="font-size:9px;color:#777;margin-top:2px">${_genEscape(item.cod_material)}</div>` : ""}
              </td>
              <td style="text-align:center">${_genEscape(item.qtde||"—")}</td>
              <td style="text-align:center">${_genEscape(item.unidade||"—")}</td>
              <td style="text-align:right">${_genEscape(item.preco_unit||"—")}</td>
              <td style="text-align:right;font-weight:600">${_genEscape(item.valor_total_item||"—")}</td>
              <td style="text-align:center">${_genEscape(item.icms||"—")}</td>
              <td style="text-align:center">${_genEscape(item.ipi||"—")}</td>
              <td style="text-align:center">${_genEscape(item.pis_cofins||"—")}</td>
              <td style="text-align:center">${_genEscape(item.prazo_entrega||"—")}</td>
              <td style="text-align:center">${_genEscape(item.classif_fiscal||"—")}</td>
              <td style="text-align:center">${_genEscape(item.filial||"—")}</td>
            </tr>`).join("")}
          <tr class="total-row">
            <td colspan="11" style="text-align:right;padding-right:10px;font-size:10px;color:#555">VALOR TOTAL (c/ impostos)</td>
            <td style="text-align:right;font-size:13px;font-weight:700;color:${cor};white-space:nowrap">${_genEscape(d.valorTotalStr)}</td>
          </tr>
        </tbody>
      </table>`;
    } else {
      itensTable = `
      <h3 class="sec-title">PLANILHA DE ITENS</h3>
      <table>
        <thead>
          <tr>
            <th style="width:36px;text-align:center">Item</th>
            <th>Descrição Produto / Cód. Material Cliente</th>
            <th style="width:44px;text-align:center">Qtde</th>
            <th style="width:50px;text-align:center">Unid.</th>
            <th style="width:60px;text-align:center">Prazo<br>(dias)</th>
            <th style="width:80px;text-align:center">Classif.<br>Fiscal</th>
            <th style="width:80px;text-align:center">Filial de<br>Fatur.</th>
          </tr>
        </thead>
        <tbody>
          ${d.itens.map((item, i) => `
            <tr class="${i%2===0?"":"alt"}">
              <td style="text-align:center;font-weight:700;color:${cor}">${String((i+1)*10).padStart(3,"0")}</td>
              <td>
                <div style="font-weight:600">${_genEscape(item.descricao||"")}</div>
                ${item.cod_material ? `<div style="font-size:9px;color:#777;margin-top:2px">${_genEscape(item.cod_material)}</div>` : ""}
              </td>
              <td style="text-align:center">${_genEscape(item.qtde||"—")}</td>
              <td style="text-align:center">${_genEscape(item.unidade||"—")}</td>
              <td style="text-align:center">${_genEscape(item.prazo_entrega||"—")}</td>
              <td style="text-align:center">${_genEscape(item.classif_fiscal||"—")}</td>
              <td style="text-align:center">${_genEscape(item.filial||"—")}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
    }
  } else if (isCom) {
    itensTable = `
    <h3 class="sec-title">VALOR DA PROPOSTA</h3>
    <div style="font-size:22px;font-weight:700;color:${cor};margin:10px 0">${_genEscape(d.valorTotalStr)}</div>`;
  }

  // ── Info grid ──
  const infoItems = [
    { label:"Representada",    value: d.representadaNome },
    { label:"B.U.",            value: d.bu + segStr },
    d.unidade   ? { label:"Unidade Mantex", value: d.unidade }    : null,
    d.nomeProjeto ? { label:"Projeto",      value: d.nomeProjeto } : null,
    { label:"Tipo",            value: d.tipoOferta },
    { label:"Status",          value: d.status },
    d.refCliente ? { label:"Ref. Cliente",  value: d.refCliente }  : null,
    { label:"Data Entrada",    value: _genFmtDate(d.dataEntrada) },
    d.dataEnvio ? { label:"Data Envio",     value: _genFmtDate(d.dataEnvio) } : null,
  ].filter(Boolean);

  const infoGrid = `
    <h3 class="sec-title">${isCom ? "CONDIÇÕES COMERCIAIS" : "INFORMAÇÕES DA PROPOSTA"}</h3>
    <div class="info-grid">
      ${infoItems.map(it => `
        <div class="info-cell">
          <div class="info-label">${it.label}</div>
          <div class="info-value">${_genEscape(it.value)}</div>
        </div>`).join("")}
    </div>`;

  // ── Observations ──
  const obsSection = d.obsGeral ? `
    <h3 class="sec-title">${isCom ? "OBSERVAÇÕES COMERCIAIS" : "COMENTÁRIOS TÉCNICOS"}</h3>
    <div class="obs-box">${_genEscape(d.obsGeral).replace(/\n/g,"<br>")}</div>` : "";

  // ── Cover letter ──
  const coverText = isCom
    ? "Agradecemos a sua solicitação e temos a satisfação de apresentar nossa proposta comercial para o fornecimento dos materiais de nossa linha de produtos e soluções."
    : "Agradecemos a sua solicitação e temos a satisfação de apresentar nossa proposta técnica para o fornecimento dos materiais de nossa linha de fabricação.";

  return `<!DOCTYPE html><html><head>
  <meta charset="UTF-8">
  <title>${titulo} ${_genEscape(d.oferta)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1a1a1a;
         background:#fff;padding:28px 32px 72px;}

    /* ── Header ── */
    .page-header{display:flex;justify-content:space-between;align-items:flex-end;
                 border-bottom:3px solid ${cor};padding-bottom:10px;margin-bottom:22px;}
    .logo-side{display:flex;align-items:center;gap:12px;}
    .logo-img{height:46px;object-fit:contain;}
    .company-name{font-size:14px;font-weight:700;color:${cor};}
    .company-sub{font-size:9px;color:#888;margin-top:2px;}
    .prop-side{text-align:right;}
    .prop-num{font-size:13px;font-weight:700;color:#111;}
    .prop-ver{font-size:9px;color:#777;margin-top:1px;line-height:1.6;}
    .prop-badge{display:inline-block;background:${cor};color:#fff;font-size:9px;
                font-weight:700;padding:3px 12px;border-radius:20px;margin-top:5px;}

    /* ── Body ── */
    .city-date{font-size:11px;color:#333;margin-bottom:16px;}

    .client-block{margin-bottom:16px;line-height:1.75;}
    .client-a{font-weight:700;font-size:10px;color:#777;letter-spacing:.5px;}
    .client-name{font-size:14px;font-weight:700;color:#111;margin-top:1px;}
    .client-sub{color:#444;font-size:10.5px;}

    .cover{line-height:1.8;color:#333;margin-bottom:20px;}
    .cover p+p{margin-top:10px;}

    /* ── Section title ── */
    .sec-title{font-size:11px;font-weight:700;text-transform:uppercase;
               color:${cor};border-bottom:2px solid ${cor};
               padding-bottom:4px;margin:20px 0 10px;}

    /* ── Table ── */
    table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:4px;}
    th{background:${cor};color:#fff;padding:7px 9px;font-size:10px;font-weight:600;}
    td{padding:6px 9px;border-bottom:1px solid #e8ecf1;vertical-align:top;}
    tr.alt td{background:${corLight};}
    tr.total-row td{background:#f0f4ff !important;border-top:2px solid ${cor};padding:10px 12px;}

    /* ── Info grid ── */
    .info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:8px 0 4px;}
    .info-cell{}
    .info-label{font-size:8.5px;text-transform:uppercase;letter-spacing:.5px;color:#888;margin-bottom:2px;}
    .info-value{font-size:11px;font-weight:600;color:#222;}

    /* ── Obs ── */
    .obs-box{background:#f7f9ff;border-left:3px solid ${cor};padding:10px 14px;
             font-size:10.5px;line-height:1.7;border-radius:0 4px 4px 0;margin-top:4px;}

    /* ── Signature ── */
    .signature{margin-top:30px;padding-top:16px;border-top:1px solid #e0e5ee;}
    .sig-close{margin-bottom:16px;color:#333;font-size:11px;}
    .sig-company{font-size:13px;font-weight:700;color:${cor};margin-bottom:10px;}
    .sig-name{font-size:11px;font-weight:700;}
    .sig-contact{font-size:10px;color:#555;line-height:1.8;margin-top:2px;}

    /* ── Footer ── */
    .page-footer{position:fixed;bottom:0;left:0;right:0;background:#fff;
                 border-top:1px solid #e0e5ee;padding:6px 32px;
                 display:flex;justify-content:space-between;
                 align-items:center;font-size:9px;color:#aaa;}

    @media print{body{padding:20px 28px 62px;}}
  </style>
  </head><body>

  <!-- Header -->
  <div class="page-header">
    <div class="logo-side">
      <img src="${logoUrl}" class="logo-img" alt="Three Ar"
           onerror="this.style.display='none'">
      <div>
        <div class="company-name">Three Ar Representações</div>
        <div class="company-sub">Representação Comercial e Técnica</div>
      </div>
    </div>
    <div class="prop-side">
      <div class="prop-num">PROPOSTA ${_genEscape(d.oferta)}</div>
      <div class="prop-ver">
        Versão 00<br>
        Impresso em: ${dataCurta}
      </div>
      <div class="prop-badge">${titulo}</div>
    </div>
  </div>

  <!-- City + Date -->
  <div class="city-date">São Paulo, ${dataLonga}</div>

  <!-- Client block -->
  <div class="client-block">
    <div class="client-a">A</div>
    <div class="client-name">${_genEscape(d.razao)}</div>
    ${d.cnpj ? `<div class="client-sub">CNPJ: ${_genEscape(d.cnpj)}</div>` : ""}
    <br>
    <div class="client-sub">A/C: ${_genEscape(d.solicitante)}</div>
    ${d.telefone ? `<div class="client-sub">Tel.: ${_genEscape(d.telefone)}</div>` : ""}
    ${d.email    ? `<div class="client-sub">E-mail: ${_genEscape(d.email)}</div>`  : ""}
    ${d.refCliente  ? `<div class="client-sub">Referência: ${_genEscape(d.refCliente)}</div>`  : ""}
    ${d.nomeProjeto ? `<div class="client-sub">Projeto: ${_genEscape(d.nomeProjeto)}</div>`    : ""}
  </div>

  <!-- Cover letter -->
  <div class="cover">
    <p>Prezado Cliente,</p>
    <p>${coverText}</p>
  </div>

  <!-- Items -->
  ${itensTable}

  <!-- Info grid -->
  ${infoGrid}

  <!-- Observations -->
  ${obsSection}

  <!-- Signature -->
  <div class="signature">
    <p class="sig-close">Atenciosamente,</p>
    <p class="sig-company">THREE AR REPRESENTAÇÕES</p>
    <div>
      <div style="font-size:9.5px;color:#888;margin-bottom:4px;">Responsável pelo atendimento:</div>
      <div class="sig-name">${_genEscape(userName)}</div>
      <div class="sig-contact">
        E-mail: ${_genEscape(_genCurrentEmail)}
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="page-footer">
    <span>Three Ar Representações</span>
    <span>Proposta ${_genEscape(d.oferta)} — Emitido em ${dataCurta}</span>
  </div>

  <script>window.onload=function(){window.print();};<\/script>
  </body></html>`;
}

// ── Main Action ───────────────────────────────────────────────────────────────
async function gerarOferta(modo) {
  // modo: 'comercial' | 'tecnica' | 'ambas'
  const btnMap = {
    comercial: document.getElementById("btnGerarComercial"),
    tecnica:   document.getElementById("btnGerarTecnico"),
    ambas:     document.getElementById("btnGerarAmbas"),
  };
  const btn = btnMap[modo];
  const d   = _genColetarDados();
  const erros = _genValidar(d);

  if (erros.length) {
    showToast({
      title: "Corrija os seguintes erros",
      description: erros.map(e => `• ${e}`).join("<br>")
    }, "error");
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = "⏳ Gerando..."; }

  try {
    if (modo === "comercial") {
      gerarPdfComercial(d);
    } else if (modo === "tecnica") {
      gerarPdfTecnico(d);
    } else {
      // ambas: abre uma de cada vez (evita bloqueio de popup)
      gerarPdfComercial(d);
      await _genDelay(800);
      gerarPdfTecnico(d);
      await criarRegistroAutomaticoGerador(d);
      exibirModalSucessoGerador();
      _genResetarFormulario();
    }
  } catch(e) {
    console.error("Erro ao gerar oferta:", e);
    showToast({ title: "Erro ao gerar", description: e.message || String(e) }, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = modo === "comercial" ? "📄 Oferta Comercial"
                      : modo === "tecnica"   ? "📋 Oferta Técnica"
                      : "⬇ Gerar Ambas + Salvar";
    }
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function exibirModalSucessoGerador() {
  document.getElementById("modalGeradorSucesso").style.display = "flex";
}
function fecharModalSucessoGerador() {
  document.getElementById("modalGeradorSucesso").style.display = "none";
}

// ── Reset ─────────────────────────────────────────────────────────────────────
function _genResetarFormulario() {
  ["gen_razao","gen_cnpj","gen_solicitante","gen_telefone","gen_email",
   "gen_oferta","gen_data_envio","gen_tipo_oferta","gen_bu","gen_segmento",
   "gen_representada","gen_unidade","gen_valor_total","gen_nome_projeto",
   "gen_ref_cliente","gen_obs_geral"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.tagName === "SELECT" ? (el.selectedIndex = 0) : (el.value = "");
  });

  document.getElementById("gen_status").value = "Proposta enviada";
  document.getElementById("gen_data_entrada").value = new Date().toISOString().split("T")[0];
  document.getElementById("gen_segmentoWrap").style.display  = "none";
  document.getElementById("gen_unidadeWrap").style.display   = "none";
  document.getElementById("gen_razao").dataset.clienteId     = "";
  document.getElementById("gen_nome_projeto").dataset.projetoId = "";

  _genItens         = [];
  _genItemCounter   = 0;
  _genRenderItens();
  _genAtualizarTotalGeral();
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function _genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function _genValidarCNPJ(cnpj) {
  const s = cnpj.replace(/\D/g, "");
  if (s.length !== 14) return false;
  if (/^(\d)\1+$/.test(s)) return false;
  const calc = len => {
    let n = 0, p = len - 7;
    for (let i = 0; i < len; i++) {
      n += +s[i] * p--;
      if (p < 2) p = 9;
    }
    return n % 11 < 2 ? 0 : 11 - (n % 11);
  };
  return calc(12) === +s[12] && calc(13) === +s[13];
}

function _genFmtDate(iso) {
  if (!iso) return "";
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function _genDelay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Colar Itens (Smart Paste) ─────────────────────────────────────────────────
let _genPasteItens = [];

function abrirModalColar() {
  document.getElementById("modalColarDados").style.display   = "flex";
  document.getElementById("gen_paste_preview").style.display = "none";
  document.getElementById("btnAplicarCola").disabled         = true;
  document.getElementById("gen_paste_area").value            = "";
  setTimeout(() => document.getElementById("gen_paste_area").focus(), 100);
}

function fecharModalColar() {
  document.getElementById("modalColarDados").style.display = "none";
}

function _genAnalisarCola() {
  const texto = (document.getElementById("gen_paste_area").value || "").trim();
  if (!texto) { return; }

  _genPasteItens = _genParsearItens(texto);

  const tituloEl = document.getElementById("gen_paste_preview_titulo");
  const itensEl  = document.getElementById("gen_paste_itens_preview");
  const preview  = document.getElementById("gen_paste_preview");

  if (!_genPasteItens.length) {
    tituloEl.textContent = "Nenhum item identificado.";
    itensEl.innerHTML    = "";
    document.getElementById("btnAplicarCola").disabled = true;
  } else {
    tituloEl.textContent = `${_genPasteItens.length} item(s) detectado(s):`;
    itensEl.innerHTML    = _genPasteItens.map((it, i) => `
      <div style="background:var(--bg-muted,#f5f7ff);border-radius:8px;padding:8px 12px;font-size:12px;display:flex;gap:10px;align-items:flex-start">
        <span style="font-weight:700;color:var(--primary);flex-shrink:0">${String(i+1).padStart(2,"0")}</span>
        <div>
          <div style="font-weight:600;color:var(--text-main)">${_genEscape(it.descricao)}</div>
          ${(it.qtde || it.unidade || it.cod_material) ? `
            <div style="color:var(--text-muted);margin-top:2px">
              ${it.qtde       ? `Qtde: <strong>${_genEscape(it.qtde)}</strong> ` : ""}
              ${it.unidade    ? _genEscape(it.unidade) + " " : ""}
              ${it.cod_material ? `· Cód: <strong>${_genEscape(it.cod_material)}</strong>` : ""}
            </div>` : ""}
        </div>
      </div>`).join("");
    document.getElementById("btnAplicarCola").disabled = false;
  }

  preview.style.display = "";
}

function _genAplicarCola() {
  if (!_genPasteItens.length) return;

  _genPasteItens.forEach(it => {
    const id = ++_genItemCounter;
    _genItens.push({ ..._genNovoItem(id), ...it, id }); // id sempre por último para não ser sobrescrito
  });

  _genRenderItens();
  _genAtualizarTotalGeral();
  fecharModalColar();
  showToast({
    title: `${_genPasteItens.length} item(s) adicionado(s)`,
    description: "Confira e preencha os demais campos de cada item."
  }, "success");
}

// ── Item Text Parser ──────────────────────────────────────────────────────────
function _genParsearItens(texto) {
  // Try catalog format (extension with material code + price details)
  const catalogo = _genParseCatalogoItens(texto);
  if (catalogo.length) return catalogo;

  // Fallback: one description per line
  const itens = [];
  const RE_SKIP = /^(item|produto|descri[çc][aã]o|material|itens|lista|#|n[º°]\.?)\s*$/i;
  for (const raw of texto.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length < 2) continue;
    if (RE_SKIP.test(trimmed)) continue;
    const it = _genParseItemSimples(trimmed);
    if (it.descricao.length > 1) itens.push(it);
  }
  return itens;
}

// Catalog format: blocks starting with "N  XXXXXXXX  PRODUCT NAME"
// followed by category, quantity, price and tax lines
function _genParseCatalogoItens(texto) {
  const itens  = [];
  const linhas = texto.split(/\r?\n/);

  // Item block start: "1  00000000023881402  AFUMEX FLEX GREEN 120mm²..."
  // Number ≥1 digit, then whitespace, then material code (any length of digits), then name
  const RE_INICIO = /^\s*(\d+)\s+(\d{5,})\s+(.+)/;

  // Lines to ignore entirely
  const RE_CATEGORIA = /^(BOBINA|METRO|METROS|ROLO|ROLOS|UNIDADE|UNIDADES|PE[ÇC]AS?|KG|CONJUNTO|JOGO)$/i;
  const RE_SKIP_HDR  = /^(item|cod|produto|descri|material|qtde|un\b)/i;

  let cur = null;
  const flush = () => { if (cur?.descricao) { itens.push(cur); cur = null; } };

  for (const raw of linhas) {
    const t = raw.trim();
    if (!t) { flush(); continue; }

    // ── New item header ──
    const mInicio = t.match(RE_INICIO);
    if (mInicio) {
      flush();
      const [, , cod, resto] = mInicio;
      const codLimpo = cod.replace(/^0+/, "") || cod; // remove zeros à esquerda
      cur = { ..._genNovoItem(0), cod_material: codLimpo, descricao: resto.trim() };
      continue;
    }

    if (!cur) continue;

    // ── Category subtitle (BOBINA, METRO…) — append to description ──
    if (RE_CATEGORIA.test(t)) {
      if (!cur.descricao.toUpperCase().includes(t.toUpperCase()))
        cur.descricao += " — " + t;
      continue;
    }

    // ── Quantidade: 5.000,000 M ──
    const mQtde = t.match(/quantidade\s*:\s*([\d\.,]+)\s*([A-Z]{1,3})?/i);
    if (mQtde && !cur.qtde) {
      cur.qtde    = mQtde[1];
      cur.unidade = (mQtde[2] || "").toLowerCase();
      continue;
    }

    // ── Preço unitário ──
    const mPreco = t.match(/pre[çc]o\s*unit[^:]*:\s*R\$\s*([\d\.,]+)/i);
    if (mPreco && !cur.preco_unit) {
      cur.preco_unit = "R$ " + mPreco[1];
      _genCalcItemTotalObj(cur);
      continue;
    }

    // ── ICMS % e IPI % (mesma linha: "ICMS: 18% IPI: 0%") ──
    const mIcms = t.match(/ICMS\s*:\s*(\d+[\.,]?\d*)\s*%/i);
    const mIpi  = t.match(/IPI\s*:\s*(\d+[\.,]?\d*)\s*%/i);
    if (mIcms) cur.icms = mIcms[1] + "%";
    if (mIpi)  cur.ipi  = mIpi[1]  + "%";

    // ── PIS/COFINS % ──
    const mPis = t.match(/PIS[\s\/]?COFINS\s*:\s*(\d+[\.,]?\d*)\s*%/i);
    if (mPis) cur.pis_cofins = mPis[1] + "%";

    // ── Valor total c/ todos impostos ──
    // "Valor (PIS/COFINS, ICMS, IPI e ICMS-ST): R$ 1.096.221,00"
    const mVtotal = t.match(/Valor\s*\([^)]*(?:IPI|ICMS-ST)[^)]*\)\s*:\s*R\$\s*([\d\.,]+)/i);
    if (mVtotal && !cur.valor_total_item)
      cur.valor_total_item = "R$ " + mVtotal[1];
  }
  flush();
  return itens;
}

// Calculate item total from qty × unit price (on the item object directly)
function _genCalcItemTotalObj(item) {
  const qtde  = parseFloat((item.qtde || "").replace(".","").replace(",",".")) || 0;
  const preco = _genParseMoneyBR(item.preco_unit);
  const total = qtde * preco;
  if (total > 0 && !item.valor_total_item) {
    item.valor_total_item = total.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  }
}

function _genParseItemSimples(linha) {
  let limpa = linha.replace(/^\d+[\.\)\-:\s]+\s*/, "").trim();
  const RE_QTDE = /\b(\d+[\.,]?\d*)\s*(m\b|metros?\b|un\b|unid\.?\b|kg\b|pc\b|pç\b|pçs?\b|rolos?\b|mt\b)\s*$/i;
  const mQtde  = limpa.match(RE_QTDE);
  let qtde = "", unidade = "";
  if (mQtde) {
    limpa   = limpa.slice(0, mQtde.index).trim();
    qtde    = mQtde[1];
    unidade = mQtde[2].toLowerCase();
  }
  return { ..._genNovoItem(0), descricao: limpa, qtde, unidade };
}

// ── Theme & Sidebar ───────────────────────────────────────────────────────────
function toggleTheme() {
  const isDark = document.body.classList.contains("dark");
  const newTheme = isDark ? "light" : "dark";
  localStorage.setItem("theme", newTheme);
  if (newTheme === "dark") document.body.classList.add("dark");
  else document.body.classList.remove("dark");
  _genUpdateThemeLabel();
}

function _genUpdateThemeLabel() {
  const lbl = document.getElementById("themeLabel");
  if (lbl) lbl.textContent = document.body.classList.contains("dark")
    ? "Modo claro" : "Modo escuro";
}

function toggleSidebar() {
  const sb  = document.getElementById("sidebar");
  const btn = sb?.querySelector(".collapse-btn");
  if (!sb) return;
  sb.classList.toggle("collapsed");
  if (btn) btn.textContent = sb.classList.contains("collapsed") ? "⮜" : "⮞";
}
