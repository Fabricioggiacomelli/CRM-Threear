// ====== CONFIG LOGIN MULTIUSUÁRIO ======
const USERS = [
  { user: "Ricardo", pass: "Ricardo" },
  { user: "Kondo", pass: "Kondo" },
  { user: "Ronaldo", pass: "Ronaldo" },
  { user: "Fabricio", pass: "Fabricio" },
];

// Dados principais
let registros = [];
let clientes = [];
let representadas = [];
let contatosTemp = [];



// Paginação de clientes
let clientesCurrentPage = 1;
const clientesPageSize = 5;

let editId = null; // oferta
let editClienteId = null; // cliente
let editRepresentadaId = null; // representada
let editContatoIndex = null; // contato do cliente
let currentPage = 1;
const pageSize = 5;
let backupImportMode = null; // "json" ou "excel"

// ====== INICIALIZAÇÃO GERAL ======
window.addEventListener("load", () => {
  registros = JSON.parse(localStorage.getItem("registros")) || [];
  clientes = JSON.parse(localStorage.getItem("clientes")) || [];
  representadas = JSON.parse(localStorage.getItem("representadas")) || [];

  const savedTheme = localStorage.getItem("theme") || "light";
  applyTheme(savedTheme);

  initLogin();
  initForm();
  initFiltrosEPaginacao();
  initMoneyMask();
  initPhoneMask();
  initCnpjMask();
  initClientesUI();
  initRepresentadasUI();
  initLigacaoClienteOferta();
  initBackupUI();

  if (localStorage.getItem("loggedUser")) {
    mostrarApp();
  }
});

// ====== LOGIN ======
function initLogin() {
  const btnLogin = document.getElementById("btnLogin");
  if (!btnLogin) return;

  btnLogin.addEventListener("click", () => {
    const u = document.getElementById("loginUser").value.trim();
    const p = document.getElementById("loginPass").value.trim();

    const encontrado = USERS.find((x) => x.user === u && x.pass === p);

    if (!encontrado) {
      alert("Usuário ou senha incorretos.");
      return;
    }

    localStorage.setItem("loggedUser", encontrado.user);
    mostrarApp();
  });
}

function mostrarApp() {
  const loginContainer = document.getElementById("loginContainer");
  const appContainer = document.getElementById("appContainer");

  if (loginContainer) loginContainer.classList.add("hidden");
  if (appContainer) appContainer.classList.remove("hidden");

  const user = localStorage.getItem("loggedUser");
  const userInfo = document.getElementById("userInfo");
  if (userInfo) {
    userInfo.textContent = "Logado como: " + user;
  }

  preencherSelectRepresentadas();
  renderTabela();
  renderTabelaClientes();
  renderTabelaRepresentadas();
}

function logout() {
  localStorage.removeItem("loggedUser");
  location.reload();
}

// ===== MODAL GENÉRICO =====
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

function verOferta(id) {
  const reg = registros.find((r) => r.id === id);
  if (!reg) return;

  const pedido = reg.pedido || {};
  const usuario = reg.atualizadoPor || reg.criadoPor || "-";

  let html = `
  <div class="modal-grid">
    <div class="modal-card">
      <div class="modal-card-title">Dados do Cliente</div>
      <div class="modal-section"><strong>Razão Social:</strong> ${
        reg.razao || "-"
      }</div>
      <div class="modal-section"><strong>CNPJ:</strong> ${
        reg.cnpj_cliente || "-"
      }</div>
      <div class="modal-section"><strong>B.U:</strong> ${reg.bu || "-"}</div>
    </div>

    <div class="modal-card">
      <div class="modal-card-title">Projeto & Representada</div>
      <div class="modal-section"><strong>Projeto:</strong> ${
        reg.nome_projeto || "-"
      }</div>
      <div class="modal-section"><strong>Representada:</strong> ${
        reg.representadaNome || "-"
      }</div>
    </div>
  </div>

  <div class="modal-card">
    <div class="modal-card-title">Oferta</div>
    <div class="modal-section"><strong>N° Oferta:</strong> ${
      reg.oferta || "-"
    }</div>
    <div class="modal-section"><strong>Valor Total:</strong> ${
      reg.valor_total || "-"
    }</div>
    <div class="modal-section"><strong>Oportunidade:</strong> ${
      reg.oportunidade || "-"
    }</div>
    <div class="modal-section"><strong>Status:</strong> ${
      reg.status || "-"
    }</div>
  </div>

  <div class="modal-card">
    <div class="modal-card-title">Usuário</div>
    <div class="modal-section"><strong>Responsável:</strong> ${usuario}</div>
  </div>
`;

  if (reg.possuiPedido === "sim") {
    html += `
            <hr>
            <div class="modal-section">
                <strong>Pedido?</strong> Sim<br>
                <strong>N° Pedido:</strong> ${pedido.numero_pedido || "-"}<br>
                <strong>Data P.O:</strong> ${pedido.data_po || "-"}<br>
                <strong>Valor Pedido:</strong> ${pedido.valor_pedido || "-"}<br>
                <strong>Condição de Pagamento:</strong> ${
                  pedido.cond_pagamento || "-"
                }<br>
                <strong>Ref./Projeto:</strong> ${pedido.ref_projeto || "-"}<br>
                <strong>Tipo de Produto:</strong> ${
                  pedido.tipo_produto || "-"
                }<br>
                <strong>Obs:</strong> ${pedido.obs || "-"}
            </div>
        `;
  } else {
    html += `
            <div class="modal-section">
                <strong>Pedido?</strong> Não
            </div>
        `;
  }

  html += `
        <hr>
        <div class="modal-section">
            <strong>Usuário :</strong> ${usuario}
        </div>
    `;

  abrirModal(`Oferta ${reg.oferta || ""}`, html);
}

function verCliente(id) {
  const cli = clientes.find((c) => c.id === id);
  if (!cli) return;

  const usuario = cli.atualizadoPor || cli.criadoPor || "-";

  let html = `
        <div class="modal-section">
            <strong>Razão Social:</strong> ${cli.razao || "-"}<br>
            <strong>CNPJ:</strong> ${cli.cnpj || "-"}<br>
            <strong>Inscrição Estadual:</strong> ${cli.ie || "-"}<br>
            <strong>Segmento:</strong> ${cli.segmento || "-"}<br>
            <strong>Endereço:</strong> ${cli.endereco || "-"}
        </div>
    `;

  if (cli.contatos && cli.contatos.length) {
    html += `<hr><div class="modal-section"><strong>Contatos:</strong><br><br>`;
    cli.contatos.forEach((ct) => {
      html += `
                <div style="margin-bottom:6px;">
                    <strong>${ct.nome || "-"}</strong>
                    ${
                      ct.principal
                        ? '<span class="modal-badge">Principal</span>'
                        : ""
                    }
                    <br>
                    Função: ${ct.funcao || "-"}<br>
                    Tel: ${ct.telefone || "-"}<br>
                    E-mail: ${ct.email || "-"}
                </div>
            `;
    });
    html += `</div>`;
  } else {
    html += `
            <div class="modal-section">
                <strong>Contatos:</strong> nenhum cadastrado.
            </div>
        `;
  }

  html += `
        <hr>
        <div class="modal-section">
            <strong>Usuário :</strong> ${usuario}
        </div>
    `;

  abrirModal(`Cliente - ${cli.razao || ""}`, html);
}

function verRepresentada(id) {
  const rep = representadas.find((r) => r.id === id);
  if (!rep) return;

  const usuario = rep.atualizadoPor || rep.criadoPor || "-";
  const qtdOfertas = registros.filter((r) => r.representadaId === id).length;

  let html = `
        <div class="modal-section">
            <strong>Nome da Representada:</strong> ${rep.nome || "-"}</div>
        <div class="modal-section">
            <strong>Ofertas vinculadas:</strong> ${qtdOfertas}</div>
        <hr>
        <div class="modal-section">
            <strong>Usuário :</strong> ${usuario}
        </div>
    `;

  abrirModal(`Representada - ${rep.nome || ""}`, html);
}

// ====== TEMA (DARK/LIGHT) ======
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

// ====== SIDEBAR (COLAPSÁVEL / MOBILE) ======
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  if (window.innerWidth <= 780) {
    sidebar.classList.toggle("open");
  } else {
    sidebar.classList.toggle("collapsed");
  }
}

// ====== MÁSCARA MONETÁRIA ======
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

function parseMoneyToNumber(str) {
  if (!str) return 0;
  let clean = String(str)
    .replace(/R\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

// ====== MÁSCARA DE TELEFONE ======
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

// ====== MÁSCARA DE CNPJ ======
function initCnpjMask() {
  const campos = [
    document.getElementById("cli_cnpj"),
    document.getElementById("cnpj_cliente"),
  ].filter(Boolean);

  campos.forEach((input) => {
    input.addEventListener("input", onCnpjInput);
    input.addEventListener("paste", onCnpjPaste);
    input.addEventListener("blur", onCnpjBlur);
  });
}

function formatCnpjValue(value) {
  value = value.replace(/\D/g, "");
  value = value.slice(0, 14);

  if (value.length >= 3) {
    value = value.replace(/^(\d{2})(\d)/, "$1.$2");
  }
  if (value.length >= 7) {
    value = value.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
  }
  if (value.length >= 11) {
    value = value.replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4");
  }
  if (value.length >= 15) {
    value = value.replace(
      /^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/,
      "$1.$2.$3/$4-$5"
    );
  }

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

function onCnpjBlur(e) {
  const digits = e.target.value.replace(/\D/g, "");
  if (digits && digits.length !== 14) {
    alert("CNPJ inválido. Deve conter 14 dígitos.");
    e.target.focus();
  }
}

// ====== FORMULÁRIO PRINCIPAL (OFERTA) ======
function initForm() {
  const radiosPedido = document.querySelectorAll("input[name='pedido']");
  radiosPedido.forEach((radio) => {
    radio.addEventListener("change", () => {
      document
        .getElementById("secaoPedido")
        .classList.toggle("hidden", radio.value !== "sim");
    });
  });

  const btnAdicionar = document.getElementById("btnAdicionar");
  if (!btnAdicionar) return;

  btnAdicionar.addEventListener("click", () => {
    const bu = document.getElementById("bu");
    const razao = document.getElementById("razao");
    const cnpj_cliente = document.getElementById("cnpj_cliente");
    const solicitante = document.getElementById("solicitante");
    const telefone = document.getElementById("telefone");
    const email = document.getElementById("email");
    const oferta = document.getElementById("oferta");
    const nome_projeto = document.getElementById("nome_projeto");
    const representadaSelect = document.getElementById("representada");
    const valor_total = document.getElementById("valor_total");
    const oportunidade = document.getElementById("oportunidade");
    const data_entrada = document.getElementById("data_entrada");
    const status = document.getElementById("status");
    const data_envio = document.getElementById("data_envio");

    const possuiPedido = document.querySelector(
      "input[name='pedido']:checked"
    ).value;
    const currentUser = localStorage.getItem("loggedUser") || "Desconhecido";

    // Validação CNPJ (se preenchido, tem que ter 14 dígitos)
    const cnpjDigits = cnpj_cliente.value.replace(/\D/g, "");
    if (cnpjDigits && cnpjDigits.length !== 14) {
      alert("CNPJ inválido. Verifique antes de salvar.");
      cnpj_cliente.focus();
      return;
    }

    // Validação telefone (se preenchido, mínimo DDD + 8 dígitos = 10)
    const telDigits = telefone.value.replace(/\D/g, "");
    if (telDigits && telDigits.length < 10) {
      alert("Telefone inválido. Informe DDD + 8 ou 9 dígitos.");
      telefone.focus();
      return;
    }

    const registroBase = {
      bu: bu.value,
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
      valor_total: valor_total.value,
      oportunidade: oportunidade.value,
      data_entrada: data_entrada.value,
      status: status.value,
      data_envio: data_envio.value,
      possuiPedido,
    };

    if (possuiPedido === "sim") {
      const numero_pedido = document.getElementById("numero_pedido");
      const data_po = document.getElementById("data_po");
      const valor_pedido = document.getElementById("valor_pedido");
      const cond_pagamento = document.getElementById("cond_pagamento");
      const ref_projeto = document.getElementById("ref_projeto");
      const tipo_produto = document.getElementById("tipo_produto");
      const obs = document.getElementById("obs");

      registroBase.pedido = {
        numero_pedido: numero_pedido.value,
        data_po: data_po.value,
        valor_pedido: valor_pedido.value,
        cond_pagamento: cond_pagamento.value,
        ref_projeto: ref_projeto.value,
        tipo_produto: tipo_produto.value,
        obs: obs.value,
      };
    } else {
      registroBase.pedido = null;
    }

    if (!editId) {
      const registro = {
        id: gerarId(),
        ...registroBase,
        criadoPor: currentUser,
        atualizadoPor: currentUser,
      };
      registros.push(registro);
      alert("Registro adicionado!");
    } else {
      const idx = registros.findIndex((r) => r.id === editId);
      const antigo = registros[idx] || {};
      if (idx !== -1) {
        registros[idx] = {
          id: editId,
          ...registroBase,
          criadoPor: antigo.criadoPor || currentUser,
          atualizadoPor: currentUser,
        };
        alert("Registro atualizado!");
      }
      editId = null;
      btnAdicionar.textContent = "Adicionar";
    }

    salvarRegistros();

    document.getElementById("formOferta").reset();
    document.getElementById("secaoPedido").classList.add("hidden");
    const radioNao = document.querySelector(
      "input[name='pedido'][value='nao']"
    );
    if (radioNao) radioNao.checked = true;
    cnpj_cliente.dataset.clienteId = "";

    currentPage = 1;
    renderTabela();
  });
}

// ====== CLIENTES ======
function initClientesUI() {
  const btnAddContato = document.getElementById("btnAddContato");
  const btnSalvarCliente = document.getElementById("btnSalvarCliente");

  if (!btnAddContato || !btnSalvarCliente) return;

  btnAddContato.addEventListener("click", () => {
    const nome = document.getElementById("ct_nome").value.trim();
    const telefone = document.getElementById("ct_tel").value.trim();
    const email = document.getElementById("ct_email").value.trim();
    const funcao = document.getElementById("ct_funcao").value.trim();
    const principalChecked = document.getElementById("ct_principal").checked;

    if (!nome) {
      alert("Informe pelo menos o nome do contato.");
      return;
    }

    // Validação telefone contato (se preenchido, min 10 dígitos)
    const telDigits = telefone.replace(/\D/g, "");
    if (telefone && telDigits.length < 10) {
      alert("Telefone do contato inválido. Informe DDD + 8 ou 9 dígitos.");
      document.getElementById("ct_tel").focus();
      return;
    }

    const contatoBase = {
      nome,
      telefone,
      email,
      funcao,
      principal: principalChecked,
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
    }

    document.getElementById("ct_nome").value = "";
    document.getElementById("ct_tel").value = "";
    document.getElementById("ct_email").value = "";
    document.getElementById("ct_funcao").value = "";
    document.getElementById("ct_principal").checked = false;

    renderListaContatos();
  });

  btnSalvarCliente.addEventListener("click", () => {
    const razao = document.getElementById("cli_razao").value.trim();
    const cnpj = document.getElementById("cli_cnpj").value.trim();
    const ie = document.getElementById("cli_ie").value.trim();
    const endereco = document.getElementById("cli_endereco").value.trim();
    const segmento = document.getElementById("cli_segmento").value.trim();
    const currentUser = localStorage.getItem("loggedUser") || "Desconhecido";

    if (!razao || !cnpj) {
      alert("Razão Social e CNPJ são obrigatórios.");
      return;
    }

    const cnpjDigits = cnpj.replace(/\D/g, "");
    if (cnpjDigits.length !== 14) {
      alert("CNPJ do cliente inválido. Deve conter 14 dígitos.");
      document.getElementById("cli_cnpj").focus();
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
      contatos: contatosTemp.slice(),
    };

    if (!editClienteId) {
      const cliente = {
        id: gerarId(),
        ...clienteBase,
        criadoPor: currentUser,
        atualizadoPor: currentUser,
      };
      clientes.push(cliente);
      alert("Cliente salvo!");
    } else {
      const idx = clientes.findIndex((c) => c.id === editClienteId);
      const antigo = clientes[idx] || {};
      if (idx !== -1) {
        clientes[idx] = {
          id: editClienteId,
          ...clienteBase,
          criadoPor: antigo.criadoPor || currentUser,
          atualizadoPor: currentUser,
        };
      }
      alert("Cliente atualizado!");
      editClienteId = null;
      btnSalvarCliente.textContent = "Salvar Cliente";
    }

    salvarClientes();
    contatosTemp = [];
    editContatoIndex = null;
    document.getElementById("btnAddContato").textContent = "Adicionar Contato";
    renderListaContatos();
    renderTabelaClientes();

    document.getElementById("cli_razao").value = "";
    document.getElementById("cli_cnpj").value = "";
    document.getElementById("cli_ie").value = "";
    document.getElementById("cli_endereco").value = "";
    document.getElementById("cli_segmento").value = "";
  });

  // Render inicial
  renderTabelaClientes();

  // === PAGINAÇÃO DOS CLIENTES ===
  const btnPrevClientes = document.getElementById("btnPrevClientes");
  const btnNextClientes = document.getElementById("btnNextClientes");

  if (btnPrevClientes) {
    btnPrevClientes.addEventListener("click", () => {
      if (clientesCurrentPage > 1) {
        clientesCurrentPage--;
        renderTabelaClientes();
      }
    });
  }

  if (btnNextClientes) {
    btnNextClientes.addEventListener("click", () => {
      const total = clientes.length;
      const totalPages = Math.max(1, Math.ceil(total / clientesPageSize));
      if (clientesCurrentPage < totalPages) {
        clientesCurrentPage++;
        renderTabelaClientes();
      }
    });
  }
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
            ${
              ct.principal
                ? '<span class="tag-principal">(Principal)</span>'
                : ""
            }
            <br>
            ${ct.funcao || ""}
            <br>
            Tel: ${ct.telefone || ""} • E-mail: ${ct.email || ""}
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

  editContatoIndex = index;

  const btnAdd = document.getElementById("btnAddContato");
  btnAdd.textContent = "Salvar Edição";
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

  const total = clientes.length;
  const totalPages = Math.max(1, Math.ceil(total / clientesPageSize));

  if (clientesCurrentPage > totalPages) {
    clientesCurrentPage = totalPages;
  }

  const start = (clientesCurrentPage - 1) * clientesPageSize;
  const end = start + clientesPageSize;
  const pageData = clientes.slice(start, end);

  if (pageData.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6; // qtde de colunas da tabela de clientes
    td.textContent = "Nenhum cliente encontrado.";
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    pageData.forEach((cli) => {
      const tr = document.createElement("tr");

      const qtdContatos = cli.contatos ? cli.contatos.length : 0;
      const usuario = cli.atualizadoPor || cli.criadoPor || "-";

      tr.innerHTML = `
                <td>${cli.razao || ""}</td>
                <td>${cli.cnpj || ""}</td>
                <td>${cli.segmento || ""}</td>
                <td>${qtdContatos}</td>
                <td>${usuario}</td>
                <td>
                    <button class="btn-sm" onclick="verCliente('${
                      cli.id
                    }')">Ver</button>
                    <button class="btn-sm" onclick="abrirPainelCliente('${
                      cli.id
                    }')">Contatos</button>
                    <button class="btn-sm" onclick="editarCliente('${
                      cli.id
                    }')">Editar</button>
                    <button class="btn-sm btn-danger" onclick="excluirCliente('${
                      cli.id
                    }')">Excluir</button>
                </td>
            `;

      tbody.appendChild(tr);
    });
  }

  if (pageInfoClientes) {
    pageInfoClientes.textContent = `Página ${clientesCurrentPage} de ${totalPages}`;
  }
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

  contatosTemp = (cli.contatos || []).map((ct) => ({ ...ct }));
  editContatoIndex = null;
  document.getElementById("btnAddContato").textContent = "Adicionar Contato";
  renderListaContatos();

  const btnSalvarCliente = document.getElementById("btnSalvarCliente");
  if (btnSalvarCliente) btnSalvarCliente.textContent = "Salvar Edição";

  document.getElementById("secClientes").scrollIntoView({ behavior: "smooth" });
}

function excluirCliente(id) {
  if (!confirm("Tem certeza que deseja excluir este cliente?")) return;

  clientes = clientes.filter((c) => c.id !== id);
  salvarClientes();
  renderTabelaClientes();
}

function salvarClientes() {
  localStorage.setItem("clientes", JSON.stringify(clientes));
}

// Painel lateral do cliente
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
            ${
              ct.principal
                ? '<span class="tag-principal">(Principal)</span>'
                : ""
            }
            <br>
            ${ct.funcao || ""}
            <br>
            Tel: ${ct.telefone || ""} • E-mail: ${ct.email || ""}
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
    const telefone = document.getElementById("telefone");
    const email = document.getElementById("email");
    const solicitante = document.getElementById("solicitante");

    razao.value = cli.razao;
    if (cli.contatos && cli.contatos.length > 0) {
      const principal =
        cli.contatos.find((c) => c.principal) || cli.contatos[0];
      telefone.value = principal.telefone || "";
      email.value = principal.email || "";
      solicitante.value = principal.nome || "";
    }
  });
}

// ====== REPRESENTADAS ======
function initRepresentadasUI() {
  const btn = document.getElementById("btnSalvarRepresentada");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const nome = document.getElementById("rep_nome").value.trim();
    const currentUser = localStorage.getItem("loggedUser") || "Desconhecido";

    if (!nome) {
      alert("Informe o nome da representada.");
      return;
    }

    if (!editRepresentadaId) {
      representadas.push({
        id: gerarId(),
        nome,
        criadoPor: currentUser,
        atualizadoPor: currentUser,
      });
      alert("Representada salva!");
    } else {
      const idx = representadas.findIndex((r) => r.id === editRepresentadaId);
      const antigo = representadas[idx] || {};
      if (idx !== -1) {
        representadas[idx] = {
          id: editRepresentadaId,
          nome,
          criadoPor: antigo.criadoPor || currentUser,
          atualizadoPor: currentUser,
        };
      }

      registros.forEach((reg) => {
        if (reg.representadaId === editRepresentadaId) {
          reg.representadaNome = nome;
        }
      });
      salvarRegistros();

      alert("Representada atualizada!");
      editRepresentadaId = null;
      btn.textContent = "Salvar Representada";
    }

    salvarRepresentadas();
    document.getElementById("rep_nome").value = "";
    renderTabelaRepresentadas();
    preencherSelectRepresentadas();
  });

  renderTabelaRepresentadas();
  preencherSelectRepresentadas();
}

function renderTabelaRepresentadas() {
  const tbody = document.querySelector("#tabelaRepresentadas tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  representadas.forEach((rep) => {
    const usuario = rep.atualizadoPor || rep.criadoPor || "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td>${rep.nome}</td>
            <td>${usuario}</td>
            <td>
                <button class="btn-sm" onclick="verRepresentada('${rep.id}')">Ver</button>
                <button class="btn-sm" onclick="editarRepresentada('${rep.id}')">Editar</button>
                <button class="btn-sm btn-danger" onclick="excluirRepresentada('${rep.id}')">Excluir</button>
            </td>
        `;
    tbody.appendChild(tr);
  });
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
}

function excluirRepresentada(id) {
  if (!confirm("Tem certeza que deseja excluir esta representada?")) return;

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

function salvarRepresentadas() {
  localStorage.setItem("representadas", JSON.stringify(representadas));
}

// ====== FILTROS, PAGINAÇÃO, EXPORT ======
function initFiltrosEPaginacao() {
  const searchTerm = document.getElementById("searchTerm");
  const filterField = document.getElementById("filterField");
  const statusFilter = document.getElementById("statusFilter");
  const pedidoFilter = document.getElementById("pedidoFilter");
  const btnVerTudo = document.getElementById("btnVerTudo");
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");
  const btnExportExcel = document.getElementById("btnExportExcel");
  const btnExportPdf = document.getElementById("btnExportPdf");

  if (searchTerm) {
    searchTerm.addEventListener("input", () => {
      currentPage = 1;
      renderTabela();
    });
  }

  if (filterField) {
    filterField.addEventListener("change", () => {
      currentPage = 1;
      renderTabela();
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener("input", () => {
      currentPage = 1;
      renderTabela();
    });
  }

  if (pedidoFilter) {
    pedidoFilter.addEventListener("change", () => {
      currentPage = 1;
      renderTabela();
    });
  }

  if (btnVerTudo) {
    btnVerTudo.addEventListener("click", () => {
      if (searchTerm) searchTerm.value = "";
      if (statusFilter) statusFilter.value = "";
      if (filterField) filterField.value = "todos";
      if (pedidoFilter) pedidoFilter.value = "todos";
      currentPage = 1;
      renderTabela();
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        renderTabela();
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener("click", () => {
      const totalFiltrados = getRegistrosFiltrados().length;
      const totalPages = Math.max(1, Math.ceil(totalFiltrados / pageSize));
      if (currentPage < totalPages) {
        currentPage++;
        renderTabela();
      }
    });
  }

  if (btnExportExcel) {
    btnExportExcel.addEventListener("click", exportExcel);
  }

  if (btnExportPdf) {
    btnExportPdf.addEventListener("click", exportPdf);
  }
}

// ====== FILTRO DE REGISTROS ======
function getRegistrosFiltrados() {
  const termInput = document.getElementById("searchTerm");
  const fieldSelect = document.getElementById("filterField");
  const statusFilterInput = document.getElementById("statusFilter");
  const pedidoFilterSelect = document.getElementById("pedidoFilter");

  const term = termInput ? termInput.value.trim().toLowerCase() : "";
  const field = fieldSelect ? fieldSelect.value : "todos";
  const statusFilter = statusFilterInput
    ? statusFilterInput.value.trim().toLowerCase()
    : "";
  const pedidoFilter = pedidoFilterSelect ? pedidoFilterSelect.value : "todos";

  return registros.filter((reg) => {
    if (term) {
      if (field === "todos") {
        const textos = [
          reg.bu,
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
        ];

        if (reg.pedido) {
          textos.push(
            reg.pedido.numero_pedido,
            reg.pedido.valor_pedido,
            reg.pedido.ref_projeto,
            reg.pedido.tipo_produto,
            reg.pedido.obs
          );
        }

        const textoUnico = textos.filter(Boolean).join(" ").toLowerCase();

        if (!textoUnico.includes(term)) {
          return false;
        }
      } else {
        let valorCampo = "";
        switch (field) {
          case "bu":
            valorCampo = reg.bu || "";
            break;
          case "razao":
            valorCampo = reg.razao || "";
            break;
          case "solicitante":
            valorCampo = reg.solicitante || "";
            break;
          case "status":
            valorCampo = reg.status || "";
            break;
          case "oferta":
            valorCampo = reg.oferta || "";
            break;
          case "representada":
            valorCampo = reg.representadaNome || "";
            break;
          default:
            valorCampo = "";
            break;
        }
        if (!valorCampo.toLowerCase().includes(term)) {
          return false;
        }
      }
    }

    if (statusFilter) {
      if (!reg.status || !reg.status.toLowerCase().includes(statusFilter)) {
        return false;
      }
    }

    if (pedidoFilter === "com" && reg.possuiPedido !== "sim") {
      return false;
    }
    if (pedidoFilter === "sem" && reg.possuiPedido !== "nao") {
      return false;
    }

    return true;
  });
}

// ====== TABELA + PAGINAÇÃO (OFERTAS) ======
function renderTabela() {
  const tbody = document.querySelector("#tabelaRegistros tbody");
  const pageInfo = document.getElementById("pageInfo");

  if (!tbody) return;

  tbody.innerHTML = "";

  const filtrados = getRegistrosFiltrados();
  const total = filtrados.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

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
      const usuario = reg.atualizadoPor || reg.criadoPor || "";
      const tr = document.createElement("tr");

      tr.innerHTML = `
                <td>${start + index + 1}</td>
                <td>${reg.bu || ""}</td>
                <td>${reg.razao || ""}</td>
                <td>${reg.cnpj_cliente || ""}</td>
                <td>${reg.nome_projeto || ""}</td>
                <td>${reg.representadaNome || ""}</td>
                <td>${reg.oferta || ""}</td>
                <td>${reg.status || ""}</td>
                <td>${reg.valor_total || ""}</td>
                <td>${reg.possuiPedido === "sim" ? "Sim" : "Não"}</td>
                <td>${usuario}</td>
                <td>
                    <button class="btn-sm" onclick="verOferta('${
                      reg.id
                    }')">Ver</button>
                    <button class="btn-sm" onclick="editarRegistro('${
                      reg.id
                    }')">Editar</button>
                    <button class="btn-sm btn-danger" onclick="excluirRegistro('${
                      reg.id
                    }')">Excluir</button>
                </td>
            `;

      tbody.appendChild(tr);
    });
  }

  if (pageInfo) {
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
  }
}

// ====== EDITAR / EXCLUIR OFERTA ======
function editarRegistro(id) {
  const reg = registros.find((r) => r.id === id);
  if (!reg) return;

  editId = id;

  document.getElementById("bu").value = reg.bu || "";
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
  document.getElementById("oportunidade").value = reg.oportunidade || "";
  document.getElementById("data_entrada").value = reg.data_entrada || "";
  document.getElementById("status").value = reg.status || "";
  document.getElementById("data_envio").value = reg.data_envio || "";

  const representadaSelect = document.getElementById("representada");
  if (representadaSelect && reg.representadaId) {
    representadaSelect.value = reg.representadaId;
  } else if (representadaSelect) {
    representadaSelect.value = "";
  }

  const radio = document.querySelector(
    `input[name="pedido"][value="${reg.possuiPedido}"]`
  );
  if (radio) radio.checked = true;

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
  } else {
    document.getElementById("secaoPedido").classList.add("hidden");
    document.getElementById("numero_pedido").value = "";
    document.getElementById("data_po").value = "";
    document.getElementById("valor_pedido").value = "";
    document.getElementById("cond_pagamento").value = "";
    document.getElementById("ref_projeto").value = "";
    document.getElementById("tipo_produto").value = "";
    document.getElementById("obs").value = "";
  }

  document.getElementById("btnAdicionar").textContent = "Salvar Edição";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function excluirRegistro(id) {
  if (!confirm("Tem certeza que deseja excluir este registro?")) return;

  const idx = registros.findIndex((r) => r.id === id);
  if (idx !== -1) {
    registros.splice(idx, 1);
    salvarRegistros();
    renderTabela();
  }
}

// ====== EXPORTAR REGISTROS PARA EXCEL ======
function exportExcel() {
  const filtrados = getRegistrosFiltrados();
  if (filtrados.length === 0) {
    alert("Nenhum registro para exportar.");
    return;
  }

  const dados = filtrados.map((reg, i) => {
    const pedido = reg.pedido || {};
    const usuario = reg.atualizadoPor || reg.criadoPor || "";
    return {
      "#": i + 1,
      "B.U": reg.bu || "",
      "Razão Social": reg.razao || "",
      CNPJ: reg.cnpj_cliente || "",
      Projeto: reg.nome_projeto || "",
      Representada: reg.representadaNome || "",
      Solicitante: reg.solicitante || "",
      Telefone: reg.telefone || "",
      "E-mail": reg.email || "",
      "N° Oferta": reg.oferta || "",
      "Vl. Total": reg.valor_total || "",
      Oportunidade: reg.oportunidade || "",
      "Data Entrada": reg.data_entrada || "",
      Status: reg.status || "",
      "Data Envio": reg.data_envio || "",
      "Pedido?": reg.possuiPedido === "sim" ? "Sim" : "Não",
      "N° Pedido": pedido.numero_pedido || "",
      "Vl. Total Pedido": pedido.valor_pedido || "",
      "Ref./Projeto": pedido.ref_projeto || "",
      "Tipo Produto": pedido.tipo_produto || "",
      "Cond. Pagamento": pedido.cond_pagamento || "",
      Obs: pedido.obs || "",
      Usuário: usuario,
    };
  });

  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Registros");
  XLSX.writeFile(wb, "registros_ofertas.xlsx");
}

// ====== GERAR PDF (via impressão) ======
function exportPdf() {
  const filtrados = getRegistrosFiltrados();
  if (filtrados.length === 0) {
    alert("Nenhum registro para exportar.");
    return;
  }

  let html = `
        <html>
        <head>
            <title>Registros de Ofertas</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 11px; }
                h2 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #000; padding: 3px; }
                th { background: #eee; }
            </style>
        </head>
        <body>
            <h2>Registros de Ofertas</h2>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>B.U</th>
                        <th>Razão Social</th>
                        <th>CNPJ</th>
                        <th>Projeto</th>
                        <th>Representada</th>
                        <th>Solicitante</th>
                        <th>Telefone</th>
                        <th>E-mail</th>
                        <th>N° Oferta</th>
                        <th>Vl. Total</th>
                        <th>Oportunidade</th>
                        <th>Data Entrada</th>
                        <th>Status</th>
                        <th>Data Envio</th>
                        <th>Pedido?</th>
                        <th>N° Pedido</th>
                        <th>Vl. Total Pedido</th>
                        <th>Ref./Projeto</th>
                        <th>Tipo Produto</th>
                        <th>Cond. Pagamento</th>
                        <th>Obs</th>
                        <th>Usuário</th>
                    </tr>
                </thead>
                <tbody>
    `;

  filtrados.forEach((reg, i) => {
    const pedido = reg.pedido || {};
    const usuario = reg.atualizadoPor || reg.criadoPor || "";
    html += `
            <tr>
                <td>${i + 1}</td>
                <td>${reg.bu || ""}</td>
                <td>${reg.razao || ""}</td>
                <td>${reg.cnpj_cliente || ""}</td>
                <td>${reg.nome_projeto || ""}</td>
                <td>${reg.representadaNome || ""}</td>
                <td>${reg.solicitante || ""}</td>
                <td>${reg.telefone || ""}</td>
                <td>${reg.email || ""}</td>
                <td>${reg.oferta || ""}</td>
                <td>${reg.valor_total || ""}</td>
                <td>${reg.oportunidade || ""}</td>
                <td>${reg.data_entrada || ""}</td>
                <td>${reg.status || ""}</td>
                <td>${reg.data_envio || ""}</td>
                <td>${reg.possuiPedido === "sim" ? "Sim" : "Não"}</td>
                <td>${pedido.numero_pedido || ""}</td>
                <td>${pedido.valor_pedido || ""}</td>
                <td>${pedido.ref_projeto || ""}</td>
                <td>${pedido.tipo_produto || ""}</td>
                <td>${pedido.cond_pagamento || ""}</td>
                <td>${pedido.obs || ""}</td>
                <td>${usuario}</td>
            </tr>
        `;
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

// ====== BACKUP (JSON + EXCEL) UNIFICADO ======
function initBackupUI() {
  const btnBackupExport = document.getElementById("btnBackupExport");
  const btnBackupImport = document.getElementById("btnBackupImport");
  const inputBackupFile = document.getElementById("inputBackupFile");

  if (btnBackupExport) {
    btnBackupExport.addEventListener("click", () => {
      const tipo = (
        prompt("Exportar backup em qual formato? Digite 'json' ou 'excel':") ||
        ""
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
  }

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

// ====== BACKUP EXCEL (4 ABAS) ======
function exportBackupExcel() {
  const wb = XLSX.utils.book_new();

  // Clientes
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
      : [{ Mensagem: "Sem clientes" }]
  );
  XLSX.utils.book_append_sheet(wb, wsClientes, "Clientes");

  // Contatos
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
      });
    });
  });
  const wsContatos = XLSX.utils.json_to_sheet(
    contatosSheetData.length
      ? contatosSheetData
      : [{ Mensagem: "Sem contatos" }]
  );
  XLSX.utils.book_append_sheet(wb, wsContatos, "Contatos");

  // Representadas
  const repsData = representadas.map((r) => ({
    ID: r.id,
    Nome: r.nome,
    CriadoPor: r.criadoPor || "",
    AtualizadoPor: r.atualizadoPor || "",
  }));
  const wsRep = XLSX.utils.json_to_sheet(
    repsData.length ? repsData : [{ Mensagem: "Sem representadas" }]
  );
  XLSX.utils.book_append_sheet(wb, wsRep, "Representadas");

  // Ofertas
  const ofertasData = registros.map((r) => ({
    ID: r.id,
    ClienteID: r.clienteId,
    ClienteCNPJ: r.cnpj_cliente,
    RazaoSocial: r.razao,
    BU: r.bu,
    Projeto: r.nome_projeto,
    RepresentadaID: r.representadaId,
    RepresentadaNome: r.representadaNome,
    Solicitante: r.solicitante,
    Telefone: r.telefone,
    Email: r.email,
    NumeroOferta: r.oferta,
    ValorTotal: r.valor_total,
    Oportunidade: r.oportunidade,
    DataEntrada: r.data_entrada,
    Status: r.status,
    DataEnvio: r.data_envio,
    PossuiPedido: r.possuiPedido,
    NumeroPedido: r.pedido?.numero_pedido || "",
    ValorPedido: r.pedido?.valor_pedido || "",
    DataPO: r.pedido?.data_po || "",
    CondicaoPagamento: r.pedido?.cond_pagamento || "",
    RefProjetoPedido: r.pedido?.ref_projeto || "",
    TipoProduto: r.pedido?.tipo_produto || "",
    Obs: r.pedido?.obs || "",
    CriadoPor: r.criadoPor || "",
    AtualizadoPor: r.atualizadoPor || "",
  }));
  const wsOfertas = XLSX.utils.json_to_sheet(
    ofertasData.length ? ofertasData : [{ Mensagem: "Sem ofertas" }]
  );
  XLSX.utils.book_append_sheet(wb, wsOfertas, "Ofertas");

  XLSX.writeFile(wb, "backup_crm.xlsx");
}

// ====== IMPORTAR BACKUP EXCEL ======
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
              (c) => (c.cnpj || "").replace(/\D/g, "") === clean
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
          });
        });
      }

      const shOfertas = wb.Sheets["Ofertas"];
      if (shOfertas) {
        const dadosOf = XLSX.utils.sheet_to_json(shOfertas);
        registros = dadosOf
          .filter((row) => row.NumeroOferta || row.RazaoSocial)
          .map((row) => {
            const pedido =
              row.NumeroPedido ||
              row.ValorPedido ||
              row.RefProjetoPedido ||
              row.TipoProduto ||
              row.CondicaoPagamento ||
              row.Obs
                ? {
                    numero_pedido: row.NumeroPedido || "",
                    valor_pedido: row.ValorPedido || "",
                    data_po: row.DataPO || "",
                    cond_pagamento: row.CondicaoPagamento || "",
                    ref_projeto: row.RefProjetoPedido || "",
                    tipo_produto: row.TipoProduto || "",
                    obs: row.Obs || "",
                  }
                : null;

            return {
              id: row.ID || gerarId(),
              clienteId: row.ClienteID || null,
              cnpj_cliente: row.ClienteCNPJ || "",
              razao: row.RazaoSocial || "",
              bu: row.BU || "",
              nome_projeto: row.Projeto || "",
              representadaId: row.RepresentadaID || null,
              representadaNome: row.RepresentadaNome || "",
              solicitante: row.Solicitante || "",
              telefone: row.Telefone || "",
              email: row.Email || "",
              oferta: row.NumeroOferta || "",
              valor_total: row.ValorTotal || "",
              oportunidade: row.Oportunidade || "",
              data_entrada: row.DataEntrada || "",
              status: row.Status || "",
              data_envio: row.DataEnvio || "",
              possuiPedido: row.PossuiPedido || "",
              pedido,
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

// ====== UTIL ======
function gerarId() {
  return Date.now().toString() + "_" + Math.random().toString(16).slice(2);
}

function salvarRegistros() {
  localStorage.setItem("registros", JSON.stringify(registros));
}
function irPara(tela) {
  if (tela === "cadastro") {
    document
      .getElementById("secCadastro")
      .scrollIntoView({ behavior: "smooth" });
  }
  if (tela === "registros") {
    document
      .getElementById("secRegistros")
      .scrollIntoView({ behavior: "smooth" });
  }
  if (tela === "clientes") {
    document
      .getElementById("secClientes")
      .scrollIntoView({ behavior: "smooth" });
  }
  if (tela === "representadas") {
    document
      .getElementById("secRepresentadas")
      .scrollIntoView({ behavior: "smooth" });
  }
}
