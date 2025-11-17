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
const pageSize = 5; // registros por página

// ====== INICIALIZAÇÃO GERAL ======
window.addEventListener("load", () => {
    // Carrega registros salvos
    registros = JSON.parse(localStorage.getItem("registros")) || [];

    // Aplica tema salvo
    const savedTheme = localStorage.getItem("theme") || "light";
    applyTheme(savedTheme);

    initLogin();
    initForm();
    initFiltrosEPaginacao();

    // Se já tiver login salvo, pula tela de login
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

        const encontrado = USERS.find(x => x.user === u && x.pass === p);

        if (!encontrado) {
            alert("Usuário ou senha incorretos.");
            return;
        }

        // Salva usuário logado
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

    renderTabela();
}

function logout() {
    localStorage.removeItem("loggedUser");
    location.reload();
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
        // Mobile: abre/fecha
        sidebar.classList.toggle("open");
    } else {
        // Desktop: colapsa/expande
        sidebar.classList.toggle("collapsed");
    }
}

// ====== FORMULÁRIO PRINCIPAL ======
function initForm() {
    // Mostrar / esconder seção do pedido
    const radiosPedido = document.querySelectorAll("input[name='pedido']");
    radiosPedido.forEach(radio => {
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
        const solicitante = document.getElementById("solicitante");
        const telefone = document.getElementById("telefone");
        const email = document.getElementById("email");
        const oferta = document.getElementById("oferta");
        const valor_total = document.getElementById("valor_total");
        const oportunidade = document.getElementById("oportunidade");
        const data_entrada = document.getElementById("data_entrada");
        const status = document.getElementById("status");
        const data_envio = document.getElementById("data_envio");

        const possuiPedido = document.querySelector("input[name='pedido']:checked").value;

        const registro = {
            id: editId || gerarId(),
            bu: bu.value,
            razao: razao.value,
            solicitante: solicitante.value,
            telefone: telefone.value,
            email: email.value,
            oferta: oferta.value,
            valor_total: valor_total.value,
            oportunidade: oportunidade.value,
            data_entrada: data_entrada.value,
            status: status.value,
            data_envio: data_envio.value,
            possuiPedido
        };

        if (possuiPedido === "sim") {
            const numero_pedido = document.getElementById("numero_pedido");
            const data_po = document.getElementById("data_po");
            const valor_pedido = document.getElementById("valor_pedido");
            const ref_projeto = document.getElementById("ref_projeto");
            const tipo_produto = document.getElementById("tipo_produto");
            const obs = document.getElementById("obs");

            registro.pedido = {
                numero_pedido: numero_pedido.value,
                data_po: data_po.value,
                valor_pedido: valor_pedido.value,
                ref_projeto: ref_projeto.value,
                tipo_produto: tipo_produto.value,
                obs: obs.value
            };
        } else {
            registro.pedido = null;
        }

        if (!editId) {
            registros.push(registro);
            alert("Registro adicionado!");
        } else {
            const idx = registros.findIndex(r => r.id === editId);
            if (idx !== -1) {
                registros[idx] = registro;
                alert("Registro atualizado!");
            }
            editId = null;
            btnAdicionar.textContent = "Adicionar";
        }

        salvarRegistros();

        document.getElementById("formOferta").reset();
        document.getElementById("secaoPedido").classList.add("hidden");
        const radioNao = document.querySelector("input[name='pedido'][value='nao']");
        if (radioNao) radioNao.checked = true;

        currentPage = 1;
        renderTabela();
    });
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
    const statusFilter = statusFilterInput ? statusFilterInput.value.trim().toLowerCase() : "";
    const pedidoFilter = pedidoFilterSelect ? pedidoFilterSelect.value : "todos";

    return registros.filter(reg => {
        // Busca geral ou por campo específico
        if (term) {
            if (field === "todos") {
                const textos = [
                    reg.bu,
                    reg.razao,
                    reg.solicitante,
                    reg.telefone,
                    reg.email,
                    reg.oferta,
                    reg.valor_total,
                    reg.oportunidade,
                    reg.data_entrada,
                    reg.status,
                    reg.data_envio
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

                const textoUnico = textos
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                if (!textoUnico.includes(term)) {
                    return false;
                }
            } else {
                let valorCampo = "";
                switch (field) {
                    case "bu": valorCampo = reg.bu || ""; break;
                    case "razao": valorCampo = reg.razao || ""; break;
                    case "solicitante": valorCampo = reg.solicitante || ""; break;
                    case "status": valorCampo = reg.status || ""; break;
                    case "oferta": valorCampo = reg.oferta || ""; break;
                    default: valorCampo = ""; break;
                }
                if (!valorCampo.toLowerCase().includes(term)) {
                    return false;
                }
            }
        }

        // Filtro status
        if (statusFilter) {
            if (!reg.status || !reg.status.toLowerCase().includes(statusFilter)) {
                return false;
            }
        }

        // Filtro pedido
        if (pedidoFilter === "com" && reg.possuiPedido !== "sim") {
            return false;
        }
        if (pedidoFilter === "sem" && reg.possuiPedido !== "nao") {
            return false;
        }

        return true;
    });
}

// ====== TABELA + PAGINAÇÃO ======
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
        td.colSpan = 9;
        td.textContent = "Nenhum registro encontrado.";
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        pageData.forEach((reg, index) => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${start + index + 1}</td>
                <td>${reg.bu || ""}</td>
                <td>${reg.razao || ""}</td>
                <td>${reg.solicitante || ""}</td>
                <td>${reg.oferta || ""}</td>
                <td>${reg.status || ""}</td>
                <td>${reg.valor_total || ""}</td>
                <td>${reg.possuiPedido === "sim" ? "Sim" : "Não"}</td>
                <td>
                    <button class="btn-sm" onclick="editarRegistro('${reg.id}')">Editar</button>
                    <button class="btn-sm btn-danger" onclick="excluirRegistro('${reg.id}')">Excluir</button>
                </td>
            `;

            tbody.appendChild(tr);
        });
    }

    if (pageInfo) {
        pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    }
}

// ====== EDITAR / EXCLUIR ======
function editarRegistro(id) {
    const reg = registros.find(r => r.id === id);
    if (!reg) return;

    editId = id;

    document.getElementById("bu").value = reg.bu || "";
    document.getElementById("razao").value = reg.razao || "";
    document.getElementById("solicitante").value = reg.solicitante || "";
    document.getElementById("telefone").value = reg.telefone || "";
    document.getElementById("email").value = reg.email || "";
    document.getElementById("oferta").value = reg.oferta || "";
    document.getElementById("valor_total").value = reg.valor_total || "";
    document.getElementById("oportunidade").value = reg.oportunidade || "";
    document.getElementById("data_entrada").value = reg.data_entrada || "";
    document.getElementById("status").value = reg.status || "";
    document.getElementById("data_envio").value = reg.data_envio || "";

    const radio = document.querySelector(`input[name="pedido"][value="${reg.possuiPedido}"]`);
    if (radio) radio.checked = true;

    if (reg.possuiPedido === "sim" && reg.pedido) {
        document.getElementById("secaoPedido").classList.remove("hidden");
        document.getElementById("numero_pedido").value = reg.pedido.numero_pedido || "";
        document.getElementById("data_po").value = reg.pedido.data_po || "";
        document.getElementById("valor_pedido").value = reg.pedido.valor_pedido || "";
        document.getElementById("ref_projeto").value = reg.pedido.ref_projeto || "";
        document.getElementById("tipo_produto").value = reg.pedido.tipo_produto || "";
        document.getElementById("obs").value = reg.pedido.obs || "";
    } else {
        document.getElementById("secaoPedido").classList.add("hidden");
        document.getElementById("numero_pedido").value = "";
        document.getElementById("data_po").value = "";
        document.getElementById("valor_pedido").value = "";
        document.getElementById("ref_projeto").value = "";
        document.getElementById("tipo_produto").value = "";
        document.getElementById("obs").value = "";
    }

    document.getElementById("btnAdicionar").textContent = "Salvar Edição";

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function excluirRegistro(id) {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;

    const idx = registros.findIndex(r => r.id === id);
    if (idx !== -1) {
        registros.splice(idx, 1);
        salvarRegistros();
        renderTabela();
    }
}

// ====== EXPORTAR EXCEL (CSV) ======
function exportExcel() {
    const filtrados = getRegistrosFiltrados();
    if (filtrados.length === 0) {
        alert("Nenhum registro para exportar.");
        return;
    }

    let csv = "B.U;Razão Social;Solicitante;Telefone;E-mail;N° Oferta;Vl. Total;Oportunidade;Data Entrada;Status;Data Envio;Possui Pedido;N° Pedido;Vl. Total Pedido;Ref./Projeto;Tipo Produto;Obs\n";

    filtrados.forEach(reg => {
        const pedido = reg.pedido || {};
        const linha = [
            reg.bu || "",
            reg.razao || "",
            reg.solicitante || "",
            reg.telefone || "",
            reg.email || "",
            reg.oferta || "",
            reg.valor_total || "",
            reg.oportunidade || "",
            reg.data_entrada || "",
            reg.status || "",
            reg.data_envio || "",
            reg.possuiPedido || "",
            pedido.numero_pedido || "",
            pedido.valor_pedido || "",
            pedido.ref_projeto || "",
            pedido.tipo_produto || "",
            (pedido.obs || "").replace(/(\r\n|\n|\r)/gm, " ")
        ].join(";");

        csv += linha + "\n";
    });

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "registros_ofertas.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
                body { font-family: Arial, sans-serif; font-size: 12px; }
                h2 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #000; padding: 4px; }
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
                        <th>Obs</th>
                    </tr>
                </thead>
                <tbody>
    `;

    filtrados.forEach((reg, i) => {
        const pedido = reg.pedido || {};
        html += `
            <tr>
                <td>${i + 1}</td>
                <td>${reg.bu || ""}</td>
                <td>${reg.razao || ""}</td>
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
                <td>${pedido.obs || ""}</td>
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
    win.print(); // usuário escolhe "Salvar como PDF"
}

// ====== UTIL ======
function gerarId() {
    return Date.now().toString() + "_" + Math.random().toString(16).slice(2);
}

function salvarRegistros() {
    localStorage.setItem("registros", JSON.stringify(registros));
}

// Navegação via sidebar
function irPara(tela) {
    if (tela === "cadastro") {
        document.getElementById("secCadastro").scrollIntoView({ behavior: "smooth" });
    }
    if (tela === "registros") {
        document.getElementById("secRegistros").scrollIntoView({ behavior: "smooth" });
    }
}
