// ====== CONFIG LOGIN MULTIUSUÁRIO ======
const USERS = [
    { user: "Ricardo", pass: "Ricardo" },
    { user: "Kondo", pass: "Kondo" },
    { user: "Ronaldo", pass: "Ronaldo" },
    { user: "Fabricio", pass: "Fabricio" },
];

// Dados principais
let registros = [];
let editId = null;
let currentPage = 1;
const pageSize = 5;

// ====== INICIALIZAÇÃO GERAL ======
window.addEventListener("load", () => {
    registros = JSON.parse(localStorage.getItem("registros")) || [];

    const savedTheme = localStorage.getItem("theme") || "light";
    applyTheme(savedTheme);

    initLogin();
    initForm();
    initFiltrosEPaginacao();
    initMoneyMask();
    initPhoneMask(); 


    if (localStorage.getItem("loggedUser")) {
        mostrarApp();
    }
});

// ====== MÁSCARA MONETÁRIA ======
function initMoneyMask() {
    document.querySelectorAll('.money').forEach(input => {
        input.addEventListener('input', formatMoney);
    });
}

function formatMoney(e) {
    let value = e.target.value.replace(/\D/g, '');
    value = (value / 100).toFixed(2) + '';
    value = value.replace('.', ',');
    value = value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    e.target.value = value;
}

// ====== MÁSCARA DE TELEFONE ======
function initPhoneMask() {
    const telInput = document.getElementById("telefone");
    if (!telInput) return;

    telInput.addEventListener("input", (e) => {
        let value = e.target.value.replace(/\D/g, ""); // remove tudo que não é número
        if (value.length > 11) value = value.slice(0, 11); // máximo 11 dígitos

        if (value.length <= 10) {
            value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
        } else {
            value = value.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
        }

        e.target.value = value;
    });

    telInput.addEventListener("blur", (e) => {
        if (e.target.value.replace(/\D/g, "").length < 10) {
            e.target.value = "";
            alert("Telefone incompleto!");
        }
    });
}


// ====== LOGIN ======
function initLogin() {
    const btnLogin = document.getElementById("btnLogin");
    if (!btnLogin) return;

    btnLogin.addEventListener("click", () => {
        const u = document.getElementById("loginUser").value.trim();
        const p = document.getElementById("loginPass").value.trim();
        const encontrado = USERS.find(x => x.user === u && x.pass === p);

        if (!encontrado) {
            alert("Usuário ou senha incorretos.");
            return;
        }

        localStorage.setItem("loggedUser", encontrado.user);
        mostrarApp();
    });
}

function mostrarApp() {
    document.getElementById("loginContainer")?.classList.add("hidden");
    document.getElementById("appContainer")?.classList.remove("hidden");

    document.getElementById("userInfo").textContent =
        "Logado como: " + localStorage.getItem("loggedUser");

    renderTabela();
}

function logout() {
    localStorage.removeItem("loggedUser");
    location.reload();
}

// ====== TEMA ======
function applyTheme(theme) {
    const body = document.body;
    const label = document.getElementById("themeLabel");

    if (theme === "dark") {
        body.classList.add("dark");
        label.textContent = "Modo claro";
    } else {
        body.classList.remove("dark");
        label.textContent = "Modo escuro";
    }
}

function toggleTheme() {
    const isDark = document.body.classList.contains("dark");
    const newTheme = isDark ? "light" : "dark";
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
}

// ====== SIDEBAR ======
function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (window.innerWidth <= 780) {
        sidebar.classList.toggle("open");
    } else {
        sidebar.classList.toggle("collapsed");
    }
}

// ====== FORMULÁRIO ======
function initForm() {
    document.querySelectorAll("input[name='pedido']").forEach(radio => {
        radio.addEventListener("change", () => {
            document
                .getElementById("secaoPedido")
                .classList.toggle("hidden", radio.value !== "sim");
        });
    });

    document.getElementById("btnAdicionar").addEventListener("click", () => {
        const registro = {
            id: editId || gerarId(),
            bu: document.getElementById("bu").value,
            razao: document.getElementById("razao").value,
            solicitante: document.getElementById("solicitante").value,
            telefone: document.getElementById("telefone").value,
            email: document.getElementById("email").value,
            oferta: document.getElementById("oferta").value,
            ref_proposta: document.getElementById("ref_proposta").value,
            valor_total: document.getElementById("valor_total").value,
            oportunidade: document.getElementById("oportunidade").value,
            data_entrada: document.getElementById("data_entrada").value,
            status: document.getElementById("status").value,
            data_envio: document.getElementById("data_envio").value,
            possuiPedido: document.querySelector("input[name='pedido']:checked").value
        };

        if (registro.possuiPedido === "sim") {
            registro.pedido = {
                numero_pedido: document.getElementById("numero_pedido").value,
                data_po: document.getElementById("data_po").value,
                valor_pedido: document.getElementById("valor_pedido").value,
                cond_pagamento: document.getElementById("cond_pagamento").value,
                ref_projeto: document.getElementById("ref_projeto").value,
                tipo_produto: document.getElementById("tipo_produto").value,
                obs: document.getElementById("obs").value
            };
        } else {
            registro.pedido = null;
        }

        if (!editId) {
            registros.push(registro);
            alert("Registro adicionado!");
        } else {
            const idx = registros.findIndex(r => r.id === editId);
            registros[idx] = registro;
            alert("Registro atualizado!");
            editId = null;
            document.getElementById("btnAdicionar").textContent = "Adicionar";
        }

        salvarRegistros();
        document.getElementById("formOferta").reset();
        document.getElementById("secaoPedido").classList.add("hidden");

        currentPage = 1;
        renderTabela();
    });
}

// ====== FILTROS, PAGINAÇÃO ======
function initFiltrosEPaginacao() {
    ["searchTerm", "filterField", "statusFilter", "pedidoFilter"].forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener("input", () => {
            currentPage = 1;
            renderTabela();
        });
    });

    document.getElementById("btnPrev").addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            renderTabela();
        }
    });

    document.getElementById("btnNext").addEventListener("click", () => {
        const totalPages = Math.ceil(getRegistrosFiltrados().length / pageSize);
        if (currentPage < totalPages) {
            currentPage++;
            renderTabela();
        }
    });
}

// ====== FILTRO DE REGISTROS ======
function getRegistrosFiltrados() {
    const term = document.getElementById("searchTerm").value.toLowerCase();
    const field = document.getElementById("filterField").value;
    const statusFilter = document.getElementById("statusFilter").value.toLowerCase();
    const pedidoFilter = document.getElementById("pedidoFilter").value;

    return registros.filter(reg => {
        if (term) {
            const texto = Object.values(reg)
                .join(" ")
                .toLowerCase();
            if (!texto.includes(term)) return false;
        }

        if (statusFilter && !reg.status?.toLowerCase().includes(statusFilter))
            return false;

        if (pedidoFilter === "com" && reg.possuiPedido !== "sim")
            return false;

        if (pedidoFilter === "sem" && reg.possuiPedido !== "nao")
            return false;

        return true;
    });
}

// ====== TABELA ======
function renderTabela() {
    const tbody = document.querySelector("#tabelaRegistros tbody");
    tbody.innerHTML = "";

    const filtrados = getRegistrosFiltrados();
    const totalPages = Math.ceil(filtrados.length / pageSize) || 1;

    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * pageSize;
    const pageData = filtrados.slice(start, start + pageSize);

    if (!pageData.length) {
        tbody.innerHTML =
            "<tr><td colspan='9'>Nenhum registro encontrado.</td></tr>";
    } else {
        pageData.forEach((reg, index) => {
            tbody.innerHTML += `
                <tr>
                    <td>${start + index + 1}</td>
                    <td>${reg.bu}</td>
                    <td>${reg.razao}</td>
                    <td>${reg.solicitante}</td>
                    <td>${reg.oferta}</td>
                    <td>${reg.ref_proposta || ""}</td>
                    <td>${reg.status}</td>
                    <td>${reg.valor_total}</td>
                    <td>${reg.possuiPedido === "sim" ? "Sim" : "Não"}</td>
                    <td>
                        <button class="btn-sm" onclick="editarRegistro('${reg.id}')">Editar</button>
                        <button class="btn-sm btn-danger" onclick="excluirRegistro('${reg.id}')">Excluir</button>
                    </td>
                </tr>
            `;
        });
    }

    document.getElementById("pageInfo").textContent =
        `Página ${currentPage} de ${totalPages}`;
}

// ====== EDITAR / EXCLUIR ======
function editarRegistro(id) {
    const reg = registros.find(r => r.id === id);
    editId = id;

    Object.keys(reg).forEach(key => {
        const el = document.getElementById(key);
        if (el) el.value = reg[key];
    });

    document.querySelector(`input[name="pedido"][value="${reg.possuiPedido}"]`).checked = true;

    if (reg.pedido) {
        document.getElementById("secaoPedido").classList.remove("hidden");
        Object.keys(reg.pedido).forEach(key => {
            const el = document.getElementById(key);
            if (el) el.value = reg.pedido[key];
        });
    }

    document.getElementById("btnAdicionar").textContent = "Salvar Edição";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function excluirRegistro(id) {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;

    registros = registros.filter(r => r.id !== id);
    salvarRegistros();
    renderTabela();
}

// ====== EXPORTAR ======
function exportExcel() {
    const filtrados = getRegistrosFiltrados();
    if (!filtrados.length) {
        alert("Nenhum registro para exportar.");
        return;
    }

    let csv = "B.U;Razão Social;Solicitante;Telefone;E-mail;N° Oferta;Ref./Projeto;Vl. Total;Status;Pedido?;N° Pedido;Cond Pagamento\n";

    filtrados.forEach(reg => {
        csv += [
            reg.bu,
            reg.razao,
            reg.solicitante,
            reg.telefone,
            reg.email,
            reg.oferta,
            reg.ref_proposta,
            reg.valor_total,
            reg.status,
            reg.possuiPedido,
            reg.pedido?.numero_pedido || "",
            reg.pedido?.cond_pagamento || ""
        ].join(";") + "\n";
    });

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "registros_ofertas.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function exportPdf() {
    window.print();
}

// ====== UTIL ======
function gerarId() {
    return Date.now().toString() + "_" + Math.random().toString(16).slice(2);
}

function salvarRegistros() {
    localStorage.setItem("registros", JSON.stringify(registros));
}

function irPara(tela) {
    document.getElementById(tela)?.scrollIntoView({ behavior: "smooth" });
}
