window.alertasCache = window.alertasCache || [];
window.alertasCacheAnterior = window.alertasCacheAnterior || 0;
window.alertasIdsAnteriores = window.alertasIdsAnteriores || new Set();
window.alertasPrimeiraCargaFeita = window.alertasPrimeiraCargaFeita || false;
window.alertasLoopHandle = window.alertasLoopHandle || null;
window._alertasTabId = window._alertasTabId || Math.random().toString(36).slice(2, 10);
window._alertasBc = window._alertasBc || null;
window._alertasEhLider = window._alertasEhLider || false;

window.alertasUI = {
  aba: "todos"
};

// ATENÇÃO: mantenha DEBUG_ALERTAS = false em produção — timers mudam de horas para segundos
// true = tempos curtos para teste
const DEBUG_ALERTAS = false;

// =========================
// BASE
// =========================

function getAlertasRef() {
  return window.db.collection("alertas");
}

function normalizarEmailAlerta(valor) {
  return String(valor || "").trim().toLowerCase();
}

function agoraISOAlerta() {
  return new Date().toISOString();
}

function diferencaDiasAlerta(dataIso) {
  if (!dataIso) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const alvo = new Date(dataIso);
  if (isNaN(alvo.getTime())) return null;
  alvo.setHours(0, 0, 0, 0);

  return Math.floor((alvo.getTime() - hoje.getTime()) / 86400000);
}

function diferencaHorasDesdeAlerta(dataIso) {
  if (!dataIso) return null;
  const d = new Date(dataIso);
  if (isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / 3600000;
}

function montarChaveAlerta({ tipo, entidade, entidadeId, referencia = "" }) {
  return [tipo, entidade, entidadeId, referencia].join("_");
}

function getUsuarioAcaoAlertas() {
  return (
    window.usuarioLogadoCRM?.nome ||
    window.auth?.currentUser?.email ||
    "Usuário"
  );
}

function getEmailLogadoAlertas() {
  return normalizarEmailAlerta(window.auth?.currentUser?.email || "");
}

function usuarioEhAdminAlertas() {
  if (typeof usuarioEhAdmin === "function") return !!usuarioEhAdmin();
  return false;
}

function usuarioEhSupervisorAlertas() {
  if (typeof usuarioEhSupervisor === "function") return !!usuarioEhSupervisor();
  return false;
}

function usuarioPodeGerenciarDiretoAlerta(alerta) {
  if (usuarioEhAdminAlertas()) return true;

  // Supervisores podem gerenciar alertas que têm permissão de ver
  if (usuarioEhSupervisorAlertas()) {
    return usuarioPodeVerAlerta(alerta);
  }

  return false;
}

function usuarioPodeAprovarPendencia(alerta) {
  return usuarioPodeGerenciarDiretoAlerta(alerta);
}

function getLimiteHorasFollowUp(tipo) {
  const tipoNorm = String(tipo || "").trim().toLowerCase();

  if (DEBUG_ALERTAS) {
    if (tipoNorm === "compra") return 0.01;
    if (tipoNorm === "orcamento" || tipoNorm === "orçamento") return 0.02;
    return null;
  }

  if (tipoNorm === "compra") return 24;
  if (tipoNorm === "orcamento" || tipoNorm === "orçamento") return 48;
  return null;
}

function getIntervaloLembreteFollowUp(tipo) {
  const tipoNorm = String(tipo || "").trim().toLowerCase();

  if (DEBUG_ALERTAS) {
    if (tipoNorm === "compra") return 0.03;
    if (tipoNorm === "orcamento" || tipoNorm === "orçamento") return 0.04;
    return null;
  }

  if (tipoNorm === "compra") return 24;
  if (tipoNorm === "orcamento" || tipoNorm === "orçamento") return 48;
  return null;
}


function getLimiteHorasSemNFSemPrazo() {
  return DEBUG_ALERTAS ? 0.1 : 120; // 5 dias (quando não há data de entrega)
}

function getDiasAntesEntregaParaNF() {
  return DEBUG_ALERTAS ? 0 : 2; // apitar 2 dias antes da entrega contratual
}

function _parseMoedaBR(v) {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function _formatMoedaBR(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function _calcularSomaNFs(pedido) {
  if (Array.isArray(pedido?.notas_fiscais) && pedido.notas_fiscais.length) {
    return pedido.notas_fiscais.reduce((soma, nf) => soma + _parseMoedaBR(nf?.valor || 0), 0);
  }
  return _parseMoedaBR(pedido?.valor_nf || 0);
}

function _nfCobertaPedido(pedido) {
  const valorPedido = _parseMoedaBR(pedido?.valor_pedido);
  if (!valorPedido) return false; // sem valor de pedido, não há como validar
  return _calcularSomaNFs(pedido) >= valorPedido;
}

function formatarDataAlertaBR(valor) {
  if (!valor) return "-";
  const d = new Date(valor);
  if (isNaN(d.getTime())) return valor;
  return d.toLocaleString("pt-BR");
}

function textoTempoRelativoAlerta(dataIso) {
  if (!dataIso) return "";
  const d = new Date(dataIso);
  if (isNaN(d.getTime())) return "";

  const diffMs = Date.now() - d.getTime();
  const dias = Math.floor(Math.abs(diffMs) / 86400000);
  const horas = Math.floor(Math.abs(diffMs) / 3600000);

  if (diffMs >= 0) {
    if (dias > 0) return `há ${dias} dia(s)`;
    return `há ${horas} hora(s)`;
  }

  if (dias > 0) return `em ${dias} dia(s)`;
  return `em ${horas} hora(s)`;
}

function labelTipoAlerta(tipo) {
  const mapa = {
    followup: "Follow-up",
    prazo_entrega: "Prazo de entrega",
    prazo_entrega_atrasado: "Prazo atrasado",
    pedido_sem_nf: "Pedido sem NF"
  };

  return mapa[String(tipo || "").toLowerCase()] || tipo || "-";
}

function labelEntidadeAlerta(entidade) {
  return String(entidade || "-");
}

function textoReferenciaAlerta(alerta) {
  if (!alerta?.dataReferencia) return "-";

  const dataRef = new Date(alerta.dataReferencia);
  if (isNaN(dataRef.getTime())) return formatarDataAlertaBR(alerta.dataReferencia);

  const diffMs = dataRef.getTime() - Date.now();
  const diffDias = Math.floor(diffMs / 86400000);

  if (alerta.atraso && diffDias < 0) {
    return `atrasado há ${Math.abs(diffDias)} dia(s)`;
  }

  if (diffDias > 0) {
    return `vence em ${diffDias} dia(s)`;
  }

  if (diffDias === 0) {
    return "vence hoje";
  }

  return formatarDataAlertaBR(alerta.dataReferencia);
}

function tempoParaResolverAlerta(alerta) {
  if (!alerta?.dataCriacao || !alerta?.resolvidoEm) return "-";

  const ini = new Date(alerta.dataCriacao).getTime();
  const fim = new Date(alerta.resolvidoEm).getTime();
  if (isNaN(ini) || isNaN(fim) || fim < ini) return "-";

  const horas = Math.floor((fim - ini) / 3600000);
  const dias = Math.floor(horas / 24);

  if (dias > 0) return `${dias} dia(s)`;
  return `${horas} hora(s)`;
}

function getOrdemPrioridade(prioridade) {
  const ordem = {
    critica: 4,
    alta: 3,
    media: 2,
    baixa: 1
  };
  return ordem[String(prioridade || "").toLowerCase()] || 0;
}

function classePrioridadeAlerta(prioridade) {
  const p = String(prioridade || "baixa").toLowerCase();

  if (p === "critica") return "alerta-prioridade-critica";
  if (p === "alta") return "alerta-prioridade-alta";
  if (p === "media") return "alerta-prioridade-media";
  return "alerta-prioridade-baixa";
}

function classeStatusAlerta(status) {
  const s = String(status || "aberto").toLowerCase();

  if (s === "resolvido") return "alerta-status-resolvido";
  if (s === "ignorado") return "alerta-status-ignorado";
  if (s === "adiado") return "alerta-status-adiado";
  if (s === "aguardando_aprovacao_resolucao") return "alerta-status-aprovacao";
  if (s === "aguardando_aprovacao_ignorar") return "alerta-status-aprovacao";
  if (s === "arquivado") return "alerta-status-arquivado";
  return "alerta-status-aberto";
}

function statusExcluiAlertaOferta(status, reg) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "perdido" || s === "declinado") return true;
  if (reg?.deletado === true) return true;
  if (reg && String(reg.possuiPedido || "").trim().toLowerCase() === "sim") return true;
  return false;
}

// Chamada pelo loop quando uma oferta transitou para status excluído.
// Resolve automaticamente qualquer follow-up aberto para não deixar alertas fantasmas.
async function _resolverFollowUpObsoleto(registroId) {
  const chaveUnica = montarChaveAlerta({
    tipo: "followup",
    entidade: "oferta",
    entidadeId: registroId
  });
  const existente = await buscarAlertaPorChave(chaveUnica);
  if (!existente) return;
  // Protege alertas já finalizados, em aprovação pendente ou snoozed
  const STATUS_PROTEGIDOS = [
    "resolvido", "ignorado", "arquivado",
    "aguardando_aprovacao_resolucao", "aguardando_aprovacao_ignorar",
    "adiado"
  ];
  if (STATUS_PROTEGIDOS.includes(existente.status)) return;

  const agora = agoraISOAlerta();
  await getAlertasRef().doc(existente.id).set(
    {
      status: "resolvido",
      resolvidoPor: "system",
      resolvidoEm: agora,
      aprovadoPor: "system",
      aprovadoEm: agora,
      atualizadoEm: agora
    },
    { merge: true }
  );
  await adicionarHistoricoAlerta(existente.id, "resolvido_auto_status_excluido", {
    resolvidoPor: "system"
  });
}

function obterUltimaDataOferta(reg) {
  return reg?.ultimoFollowUpEm || reg?.atualizadoEm || reg?.criadoEm || "";
}

function getNumeroOfertaTexto(reg) {
  return reg?.oferta || reg?.numero_oferta || "sem número";
}

function getStatusLabel(status) {
  const s = String(status || "").toLowerCase();

  const mapa = {
    aberto: "aberto",
    adiado: "adiado",
    resolvido: "resolvido",
    ignorado: "ignorado",
    aguardando_aprovacao_resolucao: "pendente resolução",
    aguardando_aprovacao_ignorar: "pendente ignorar",
    arquivado: "arquivado"
  };

  return mapa[s] || s || "-";
}

// =========================
// TOAST / POPUP
// =========================

function mostrarToastAlerta(alerta) {
  let container = document.getElementById("crm-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "crm-toast-container";
    container.setAttribute("style",
      "position:fixed;top:20px;right:20px;z-index:2147483647;" +
      "width:380px;max-width:calc(100vw - 32px);pointer-events:none;" +
      "display:block;margin:0;padding:0;border:none;background:none;"
    );
    document.body.appendChild(container);
  }

  const dur = 6000;

  const spacer = document.createElement("div");
  spacer.style.cssText = "height:10px;display:block;";

  const card = document.createElement("div");
  card.className = "crm-alert-notif";
  card.style.opacity = "0";
  card.style.transform = "translateX(16px)";

  const icon = document.createElement("div");
  icon.className = "crm-alert-notif-icon";
  icon.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">' +
    '<path d="M10 2a6 6 0 00-6 6v2.586l-.707.707A1 1 0 004 13h12a1 1 0 00' +
    '.707-1.707L16 10.586V8a6 6 0 00-6-6zM10 18a2 2 0 01-2-2h4a2 2 0 01-2 2z"/></svg>';

  const btnClose = document.createElement("button");
  btnClose.className = "crm-alert-notif-close";
  btnClose.innerHTML = "&#x2715;";
  btnClose.setAttribute("aria-label", "Fechar");

  const titleEl = document.createElement("div");
  titleEl.className = "crm-alert-notif-title";
  titleEl.textContent = alerta.titulo || "Novo alerta";

  const bar = document.createElement("div");
  bar.className = "crm-alert-notif-bar";
  bar.style.transition = "width " + dur + "ms linear";

  card.appendChild(icon);
  card.appendChild(btnClose);
  card.appendChild(titleEl);

  if (alerta.descricao) {
    const bodyEl = document.createElement("div");
    bodyEl.className = "crm-alert-notif-body";
    bodyEl.textContent = alerta.descricao;
    card.appendChild(bodyEl);
  }

  card.appendChild(bar);
  container.appendChild(card);
  container.appendChild(spacer);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    card.style.opacity = "1";
    card.style.transform = "translateX(0)";
    bar.style.width = "0%";
  }));

  const close = () => {
    card.style.opacity = "0";
    card.style.transform = "translateX(16px)";
    setTimeout(() => { card.remove(); spacer.remove(); }, 260);
  };

  btnClose.addEventListener("click", (e) => { e.stopPropagation(); close(); });
  card.addEventListener("click", () => { abrirModalAlertas(); close(); });
  setTimeout(close, dur);
}

// =========================
// CRUD ALERTAS
// =========================

async function buscarAlertaPorChave(chaveUnica) {
  const snap = await getAlertasRef()
    .where("chaveUnica", "==", chaveUnica)
    .get();

  if (snap.empty) return null;

  // Caso simples: um único documento
  if (snap.docs.length === 1) {
    const doc = snap.docs[0];
    return { id: doc.id, ref: doc.ref, ...doc.data() };
  }

  // Múltiplos documentos com mesma chave (duplicatas acumuladas).
  const statusFinalizado = ["resolvido", "ignorado", "arquivado"];
  const STATUS_ATIVOS = ["aberto", "adiado", "aguardando_aprovacao_resolucao", "aguardando_aprovacao_ignorar"];
  const docs = snap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));

  const ativos = docs.filter((d) => STATUS_ATIVOS.includes(d.status));
  const finalizados = docs.filter((d) => statusFinalizado.includes(d.status));

  // Detecta falsa recriação: ativo criado dentro de 2h após resolução do finalizado.
  // Nesse caso, o "ativo" é um artefato do loop rodando antes dos guards — descarta-o.
  let preferido = null;
  if (ativos.length && finalizados.length) {
    const maisRecenteFinalizado = finalizados
      .slice()
      .sort((a, b) => new Date(b.resolvidoEm || b.atualizadoEm || 0) - new Date(a.resolvidoEm || a.atualizadoEm || 0))[0];
    const maisRecenteAtivo = ativos
      .slice()
      .sort((a, b) => new Date(b.dataCriacao || 0) - new Date(a.dataCriacao || 0))[0];

    const resolvidoEm = new Date(maisRecenteFinalizado.resolvidoEm || maisRecenteFinalizado.atualizadoEm || 0).getTime();
    const ativoCriado = new Date(maisRecenteAtivo.dataCriacao || 0).getTime();
    const horasEntreResolucaoECriacao = (ativoCriado - resolvidoEm) / 3600000;

    if (horasEntreResolucaoECriacao >= 0 && horasEntreResolucaoECriacao < 2) {
      // Ativo foi criado em até 2h após a resolução — falsa recriação pelo loop.
      // Mantém o finalizado como canônico e apaga o(s) ativo(s) falso(s).
      preferido = maisRecenteFinalizado;
      const deletar = docs.filter((d) => d.id !== preferido.id);
      if (deletar.length) {
        const batch = window.db.batch();
        deletar.forEach((d) => batch.delete(d.ref));
        batch.commit().catch(console.error);
        console.log(`[alertas] falsa recriação detectada e removida: ${deletar.length} doc(s) para chave "${chaveUnica}"`);
      }
      return preferido;
    }
  }

  // Caso normal: prefere ativo; entre iguais, o mais recente por dataCriacao.
  docs.sort((a, b) => {
    const aFin = statusFinalizado.includes(a.status);
    const bFin = statusFinalizado.includes(b.status);
    if (aFin !== bFin) return aFin ? 1 : -1; // ativo primeiro
    return new Date(b.dataCriacao || 0) - new Date(a.dataCriacao || 0);
  });

  // Apaga silenciosamente as duplicatas (mantém apenas o primeiro)
  const deletar = docs.slice(1);
  if (deletar.length) {
    const batch = window.db.batch();
    deletar.forEach((d) => batch.delete(d.ref));
    batch.commit().catch(console.error);
  }

  return docs[0];
}

function alertaEhObsoleto(payload = {}) {
  const tipo = String(payload.tipo || "").trim().toLowerCase();
  const titulo = String(payload.titulo || "").trim().toLowerCase();
  const descricao = String(payload.descricao || "").trim().toLowerCase();
  const chave = String(payload.chaveUnica || "").trim().toLowerCase();

  const termosObsoletos = ["sem_resposta", "sem resposta", "oferta sem resposta"];

  return termosObsoletos.some((termo) =>
    tipo.includes(termo) ||
    titulo.includes(termo) ||
    descricao.includes(termo) ||
    chave.includes(termo)
  );
}

// Deduplicação one-time: remove alertas legados de prazo_entrega que foram
// criados com chaveUnica diferente por marco (ex: _15, _10, _5...).
// Mantém apenas o mais recente por oferta+prazo e apaga os demais.
// Guarda flag em sessionStorage para rodar só uma vez por sessão.
async function deduplicarAlertasPrazoEntregaLegados() {
  if (sessionStorage.getItem("crm_prazo_dedup_ok")) return;

  const STATUS_ATIVOS = ["aberto", "adiado", "aguardando_aprovacao_resolucao", "aguardando_aprovacao_ignorar"];

  const snap = await window.db.collection("alertas")
    .where("tipo", "in", ["prazo_entrega"])
    .get();

  if (snap.empty) {
    sessionStorage.setItem("crm_prazo_dedup_ok", "1");
    return;
  }

  // Agrupa por entidadeId + dataReferencia (o prazo contratual)
  const grupos = {};
  snap.docs.forEach((doc) => {
    const d = doc.data();
    if (!STATUS_ATIVOS.includes(d.status)) return; // ignora finalizados
    const chave = `${d.entidadeId}_${d.dataReferencia || ""}`;
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push({ id: doc.id, ref: doc.ref, atualizadoEm: d.atualizadoEm || "" });
  });

  const paraApagar = [];
  Object.values(grupos).forEach((grupo) => {
    if (grupo.length <= 1) return;
    // Ordena por atualizadoEm desc — mantém o mais recente, apaga o resto
    grupo.sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
    paraApagar.push(...grupo.slice(1).map((g) => g.ref));
  });

  if (!paraApagar.length) {
    sessionStorage.setItem("crm_prazo_dedup_ok", "1");
    return;
  }

  for (let i = 0; i < paraApagar.length; i += 450) {
    const batch = window.db.batch();
    paraApagar.slice(i, i + 450).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  console.log(`[alertas] dedup prazo_entrega: ${paraApagar.length} alerta(s) duplicado(s) removido(s).`);
  sessionStorage.setItem("crm_prazo_dedup_ok", "1");
}

async function apagarAlertasObsoletosParaSempre() {
  if (!window.db) return;

  // Filtra apenas o tipo legado "sem_resposta" — evita full-collection scan a cada ciclo
  const TIPOS_OBSOLETOS = ["sem_resposta"];
  const snap = await window.db.collection("alertas")
    .where("tipo", "in", TIPOS_OBSOLETOS)
    .get();
  if (snap.empty) return;

  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = window.db.batch();
    snap.docs.slice(i, i + 450).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  console.log(`[alertas] ${snap.docs.length} alerta(s) obsoleto(s) removido(s).`);
}

async function criarOuAtualizarAlerta(payload) {
  if (!payload?.chaveUnica) return null;

  if (alertaEhObsoleto(payload)) {
    console.warn("[alertas] criação bloqueada para alerta obsoleto:", payload);
    return null;
  }

  // Barreira extra: nunca criar pedido_sem_nf para representada marcada como sem_nf
  if (payload.tipo === "pedido_sem_nf" && payload.entidadeId && window.repsSemNFIds?.size) {
    const _oferta = (registros || []).find(r => r.id === payload.entidadeId);
    if (_oferta && window.repsSemNFIds.has(_oferta.representadaId)) return null;
  }

  const existente = await buscarAlertaPorChave(payload.chaveUnica);

  if (existente && alertaEhObsoleto(existente)) {
    await getAlertasRef().doc(existente.id).delete();
    console.warn("[alertas] alerta obsoleto existente removido:", existente.id);
    return null;
  }

  if (
    existente &&
    existente.status !== "resolvido" &&
    existente.status !== "ignorado"
  ) {
    // Alerta adiado (snoozed) — nunca sobrescrever campos de snooze pelo loop
    if (existente.status === "adiado") return existente.id;

    // Alerta aguardando aprovação — não mexer enquanto supervisor está revisando
    if (
      existente.status === "aguardando_aprovacao_resolucao" ||
      existente.status === "aguardando_aprovacao_ignorar"
    ) return existente.id;

    await getAlertasRef().doc(existente.id).set(
      {
        ...payload,
        atualizadoEm: agoraISOAlerta()
      },
      { merge: true }
    );
    return existente.id;
  }

  // Guarda global contra recriação prematura de alerta recém-finalizado.
  // As funções de verificação têm guardas específicas por tipo, mas este é o
  // último firewall caso qualquer outra condição escorregue.
  if (existente) {
    const dataFim = existente.resolvidoEm || existente.ignoradoEm || existente.atualizadoEm;
    if (dataFim) {
      const horasDesde = (Date.now() - new Date(dataFim).getTime()) / 3600000;
      if (horasDesde < 2) {
        console.log(`[alertas] guard global: alerta ${existente.id} finalizado há ${horasDesde.toFixed(1)}h — recriação bloqueada`);
        return existente.id;
      }
    }
  }

  const ref = getAlertasRef().doc();

  await ref.set({
    ...payload,
    dataCriacao: agoraISOAlerta(),
    atualizadoEm: agoraISOAlerta(),
    lido: false,
    status: payload.status || "aberto",
    historico: [
      {
        acao: "criado",
        usuario: "system",
        dataHora: agoraISOAlerta()
      }
    ]
  });

  return ref.id;
}

async function adicionarHistoricoAlerta(alertaId, acao, extra = {}) {
  const ref = getAlertasRef().doc(alertaId);
  // arrayUnion garante append atômico — sem race condition entre abas simultâneas
  await ref.update({
    historico: firebase.firestore.FieldValue.arrayUnion({
      acao,
      usuario: getUsuarioAcaoAlertas(),
      dataHora: agoraISOAlerta(),
      ...extra
    })
  }).catch(async (err) => {
    // Se o documento não existe (raro), cria com o histórico inicial
    if (err.code === "not-found") {
      await ref.set({ historico: [{ acao, usuario: getUsuarioAcaoAlertas(), dataHora: agoraISOAlerta(), ...extra }] }, { merge: true });
    } else {
      console.error("[alertas] adicionarHistoricoAlerta falhou:", err);
    }
  });
}

// =========================
// VERIFICAÇÕES PRINCIPAIS
// =========================

async function _fecharPrazoEntregaAberto(registroId, prazo) {
  const chave = montarChaveAlerta({
    tipo: "prazo_entrega",
    entidade: "oferta",
    entidadeId: registroId,
    referencia: prazo
  });
  const existente = await buscarAlertaPorChave(chave);
  const STATUS_ATIVOS = ["aberto", "adiado", "aguardando_aprovacao_resolucao", "aguardando_aprovacao_ignorar"];
  if (!existente || !STATUS_ATIVOS.includes(existente.status)) return;
  const agora = agoraISOAlerta();
  await getAlertasRef().doc(existente.id).set({
    status: "resolvido",
    resolvidoPor: "system",
    resolvidoEm: agora,
    aprovadoPor: "system",
    aprovadoEm: agora,
    atualizadoEm: agora
  }, { merge: true });
  await adicionarHistoricoAlerta(existente.id, "resolvido_auto_prazo_vencido", { usuario: "system" });
}

async function verificarAlertasPrazoEntrega() {
  const marcos = [15, 10, 5, 3, 2, 1];
  const emailLogado = getEmailLogadoAlertas();
  const STATUS_ATIVOS = ["aberto", "adiado", "aguardando_aprovacao_resolucao", "aguardando_aprovacao_ignorar"];

  for (const reg of (registros || [])) {
    if (reg.deletado === true) continue;
    const statusReg = String(reg.status || "").trim().toLowerCase();
    if (statusReg === "perdido" || statusReg === "declinado") continue;

    const prazo = reg?.pedido?.prazo_entrega_contratual;
    const entregue = String(reg?.pedido?.entregue || "nao").toLowerCase() === "sim";

    if (!prazo || entregue) continue;

    const dias = diferencaDiasAlerta(prazo);
    if (dias === null) continue;

    const email = normalizarEmailAlerta(reg.responsavelEmail);
    if (!email) continue;

    // Cada usuário só gera alertas das suas próprias ofertas
    if (email !== emailLogado) continue;

    const numeroOferta = getNumeroOfertaTexto(reg);

    if (marcos.includes(dias)) {
      const chavePrazo = montarChaveAlerta({
        tipo: "prazo_entrega",
        entidade: "oferta",
        entidadeId: reg.id,
        referencia: prazo
      });

      // Guarda: se já foi resolvido nas últimas 24h (mesmo dia do marco), não recriar
      const existentePrazo = await buscarAlertaPorChave(chavePrazo);
      if (existentePrazo?.status === "resolvido" && existentePrazo?.resolvidoEm) {
        const horasDesdeResolucao = (Date.now() - new Date(existentePrazo.resolvidoEm).getTime()) / 3600000;
        if (horasDesdeResolucao < 24) continue;
      }

      await criarOuAtualizarAlerta({
        tipo: "prazo_entrega",
        entidade: "oferta",
        entidadeId: reg.id,
        titulo: "Prazo de entrega próximo",
        descricao: `Oferta ${numeroOferta} com ${dias} dia(s) para entrega.`,
        responsavelEmail: email,
        prioridade: dias <= 1 ? "critica" : dias <= 3 ? "alta" : "media",
        atraso: false,
        dataReferencia: prazo,
        chaveUnica: chavePrazo
      });
    }

    if (dias < 0) {
      // Fecha o prazo_entrega aberto (data já passou, não faz sentido continuar aberto)
      await _fecharPrazoEntregaAberto(reg.id, prazo);

      const chaveAtrasado = montarChaveAlerta({
        tipo: "prazo_entrega_atrasado",
        entidade: "oferta",
        entidadeId: reg.id,
        referencia: prazo
      });

      // Guarda: se foi resolvido há menos de 2h, não recriar (race condition pós-resolução)
      const existenteAtrasado = await buscarAlertaPorChave(chaveAtrasado);
      if (existenteAtrasado?.status === "resolvido" && existenteAtrasado?.resolvidoEm) {
        const horasDesdeResolucao = (Date.now() - new Date(existenteAtrasado.resolvidoEm).getTime()) / 3600000;
        if (horasDesdeResolucao < 2) continue;
      }

      await criarOuAtualizarAlerta({
        tipo: "prazo_entrega_atrasado",
        entidade: "oferta",
        entidadeId: reg.id,
        titulo: "Prazo de entrega atrasado",
        descricao: `Oferta ${numeroOferta} está atrasada há ${Math.abs(dias)} dia(s).`,
        responsavelEmail: email,
        prioridade: "critica",
        atraso: true,
        dataReferencia: prazo,
        chaveUnica: chaveAtrasado
      });
    }
  }
}

async function verificarAlertaFollowUpRegistro(reg) {
  const email = normalizarEmailAlerta(reg.responsavelEmail);
  if (!email) return;

  // Cada usuário só gera alertas das suas próprias ofertas
  if (email !== getEmailLogadoAlertas()) return;

  const tipo = String(reg.tipo_oferta || "").trim().toLowerCase();
  const status = String(reg.status || "").trim().toLowerCase();

  if (statusExcluiAlertaOferta(status, reg)) {
    // Oferta perdida, declinada, com pedido ou deletada —
    // garante que nenhum follow-up aberto fique orphão no sistema
    await _resolverFollowUpObsoleto(reg.id);
    return;
  }

  const limiteHoras = getLimiteHorasFollowUp(tipo);
  const intervaloLembrete = getIntervaloLembreteFollowUp(tipo);
  if (!limiteHoras || !intervaloLembrete) return;

  const horas = diferencaHorasDesdeAlerta(obterUltimaDataOferta(reg));
  if (horas === null || horas < limiteHoras) return;

  const numeroOferta = getNumeroOfertaTexto(reg);
  const chaveUnica = montarChaveAlerta({
    tipo: "followup",
    entidade: "oferta",
    entidadeId: reg.id
  });

  const existente = await buscarAlertaPorChave(chaveUnica);

  const numeroLembreteCalculado = Math.max(
    1,
    Math.floor(horas / intervaloLembrete)
  );

  if (!existente || existente.status === "resolvido" || existente.status === "ignorado") {
    // Guarda anti-recriaçao prematura: se foi resolvido há menos de limiteHoras,
    // a resolução em si conta como follow-up — não recriar ainda.
    if (existente?.status === "resolvido" && existente?.resolvidoEm) {
      const horasDesdeResolucao = (Date.now() - new Date(existente.resolvidoEm).getTime()) / 3600000;
      if (horasDesdeResolucao < limiteHoras) return;
    }

    await criarOuAtualizarAlerta({
      tipo: "followup",
      entidade: "oferta",
      entidadeId: reg.id,
      titulo: "Follow-up pendente",
      descricao: `Oferta ${numeroOferta} precisa de follow-up.`,
      responsavelEmail: email,
      prioridade: tipo === "compra" ? "alta" : "media",
      tipoOferta: tipo,
      atraso: true,
      dataReferencia: obterUltimaDataOferta(reg),
      lembreteNumero: 1,
      ultimoLembreteEm: agoraISOAlerta(),
      chaveUnica
    });
    return;
  }

  // Alerta adiado (snoozed) ou aguardando aprovação — não tocar
  if (existente.status === "adiado") return;
  if (
    existente.status === "aguardando_aprovacao_resolucao" ||
    existente.status === "aguardando_aprovacao_ignorar"
  ) return;

  const lembreteAtual = Number(existente.lembreteNumero || 1);

  if (numeroLembreteCalculado > lembreteAtual) {
    await getAlertasRef().doc(existente.id).set(
      {
        titulo: "Follow-up pendente",
        descricao:
          numeroLembreteCalculado <= 1
            ? `Oferta ${numeroOferta} precisa de follow-up.`
            : `Lembrete ${numeroLembreteCalculado} do alerta de follow-up: a oferta ${numeroOferta} ainda não foi resolvida.`,
        prioridade: tipo === "compra" ? "alta" : "media",
        tipoOferta: tipo,
        atraso: true,
        dataReferencia: obterUltimaDataOferta(reg),
        responsavelEmail: email,
        lembreteNumero: numeroLembreteCalculado,
        ultimoLembreteEm: agoraISOAlerta(),
        atualizadoEm: agoraISOAlerta()
      },
      { merge: true }
    );

  }
}

async function verificarAlertasFollowUp() {
  for (const reg of (registros || [])) {
    await verificarAlertaFollowUpRegistro(reg);
  }
}


async function verificarAlertasPedidoSemNF() {
  const emailLogado = getEmailLogadoAlertas();
  const diasAntesEntrega = getDiasAntesEntregaParaNF();
  const limiteHorasSemPrazo = getLimiteHorasSemNFSemPrazo();

  for (const reg of (registros || [])) {
    if (reg.deletado === true) continue;
    if (String(reg.possuiPedido || "").toLowerCase() !== "sim") continue;
    const statusReg = String(reg.status || "").trim().toLowerCase();
    if (statusReg === "perdido" || statusReg === "declinado") continue;

    // Representada marcada como "não emite NF" → nunca gerar este alerta
    // (limpeza de ativos já feita por resolverAlertasSemNFAtivos no início do ciclo)
    if (window.repsSemNFIds?.has(reg.representadaId)) continue;

    const email = normalizarEmailAlerta(reg.responsavelEmail);
    if (!email) continue;
    if (email !== emailLogado) continue;

    const pedido = reg.pedido || {};

    // Resolução real: soma das NFs cobre o valor total do pedido
    if (_nfCobertaPedido(pedido)) continue;

    // Determina se deve disparar com base no tipo de prazo
    const prazoEntrega = pedido.prazo_entrega_contratual;
    let deveDisparar = false;
    let dataReferencia;

    if (prazoEntrega) {
      // Com data de entrega: apitar a partir de D-2 (inclusive após a data)
      const dias = diferencaDiasAlerta(prazoEntrega);
      deveDisparar = dias !== null && dias <= diasAntesEntrega;
      dataReferencia = prazoEntrega;
    } else {
      // Sem data de entrega: apitar após 120h desde que foi salvo
      dataReferencia = pedido.data_po || reg.atualizadoEm || reg.criadoEm;
      const horas = diferencaHorasDesdeAlerta(dataReferencia);
      deveDisparar = horas !== null && horas >= limiteHorasSemPrazo;
    }

    if (!deveDisparar) continue;

    const chaveUnicaNF = montarChaveAlerta({
      tipo: "pedido_sem_nf",
      entidade: "oferta",
      entidadeId: reg.id
    });

    // Guarda: se foi resolvido recentemente sem valores baterem, não recriar imediatamente
    const existenteNF = await buscarAlertaPorChave(chaveUnicaNF);
    if (existenteNF?.status === "resolvido" && existenteNF?.resolvidoEm) {
      const horasDesdeResolucao = (Date.now() - new Date(existenteNF.resolvidoEm).getTime()) / 3600000;
      if (horasDesdeResolucao < 24) continue;
    }

    // Calcula valor faltante para exibir no card
    const valorPedido = _parseMoedaBR(pedido.valor_pedido);
    const somaNFs = _calcularSomaNFs(pedido);
    const valorFaltante = valorPedido > 0 ? Math.max(0, valorPedido - somaNFs) : null;

    let descricao;
    if (valorPedido > 0 && somaNFs > 0) {
      descricao = `Oferta ${getNumeroOfertaTexto(reg)}: NFs somam ${_formatMoedaBR(somaNFs)}, mas o pedido é de ${_formatMoedaBR(valorPedido)}.`;
    } else if (valorPedido > 0) {
      descricao = `Oferta ${getNumeroOfertaTexto(reg)}: pedido de ${_formatMoedaBR(valorPedido)} sem NF registrada.`;
    } else {
      descricao = `Oferta ${getNumeroOfertaTexto(reg)} possui pedido, mas ainda não tem NF registrada.`;
    }

    await criarOuAtualizarAlerta({
      tipo: "pedido_sem_nf",
      entidade: "oferta",
      entidadeId: reg.id,
      titulo: "Pedido sem NF",
      descricao,
      responsavelEmail: email,
      prioridade: "alta",
      atraso: true,
      dataReferencia,
      valorPedido,
      somaNFs,
      valorFaltante,
      chaveUnica: chaveUnicaNF
    });
  }
}

// =========================
// DISPARO GERAL
// =========================

// Reativa alertas cujo snooze já expirou (lembrarNovamenteEm no passado).
// Chamada no início de cada ciclo do loop para garantir que nenhum alerta
// fique preso em "adiado" indefinidamente.
function _ofertaTemRepSemNF(entidadeId) {
  if (!window.repsSemNFIds?.size) return false;
  const oferta = (registros || []).find(r => r.id === entidadeId);
  return oferta ? window.repsSemNFIds.has(oferta.representadaId) : false;
}

async function reativarAlertasAdiados() {
  const agora = new Date().toISOString();
  const expirados = (window.alertasCache || []).filter(
    (a) =>
      a.status === "adiado" &&
      a.lembrarNovamenteEm &&
      a.lembrarNovamenteEm <= agora &&
      // Nunca reativar pedido_sem_nf para representadas que não emitem NF
      !(a.tipo === "pedido_sem_nf" && _ofertaTemRepSemNF(a.entidadeId))
  );

  if (!expirados.length) return;

  for (const alerta of expirados) {
    await getAlertasRef().doc(alerta.id).set(
      {
        status: "aberto",
        lembrarNovamenteEm: null,
        atualizadoEm: agoraISOAlerta()
      },
      { merge: true }
    );
    await adicionarHistoricoAlerta(alerta.id, "reativado_snooze_expirado", {
      usuario: "system"
    });
  }

  console.log(`[alertas] ${expirados.length} alerta(s) reativados após snooze expirar.`);
}

async function resolverAlertasSemNFAtivos() {
  const STATUS_ATIVOS = ["aberto", "adiado", "aguardando_aprovacao_resolucao", "aguardando_aprovacao_ignorar"];
  const paraResolver = (window.alertasCache || []).filter(
    a => a.tipo === "pedido_sem_nf" &&
         STATUS_ATIVOS.includes(a.status) &&
         _ofertaTemRepSemNF(a.entidadeId)
  );
  if (!paraResolver.length) return;
  const agora = agoraISOAlerta();
  for (const alerta of paraResolver) {
    await getAlertasRef().doc(alerta.id).set(
      { status: "resolvido", resolvidoEm: agora, resolvidoPor: "Sistema — representada não emite NF", atualizadoEm: agora },
      { merge: true }
    );
  }
  if (paraResolver.length) console.log(`[alertas] ${paraResolver.length} alerta(s) pedido_sem_nf resolvido(s) automaticamente (representada sem NF).`);
}

async function verificarAlertasSistema() {
  await deduplicarAlertasPrazoEntregaLegados(); // one-time por sessão
  await resolverAlertasSemNFAtivos();           // limpa ativos de reps sem NF antes de qualquer verificação
  await reativarAlertasAdiados();
  await verificarAlertasPrazoEntrega();
  await verificarAlertasFollowUp();
  await verificarAlertasPedidoSemNF();
}

// =========================
// LISTENER / LOOP
// =========================

let unsubscribeAlertas = null;

function usuarioPodeVerAlerta(alerta) {
  const p = window.permissoesCRM;
  if (!p) return false;
  if (p.role === "admin") return true;

  const email = String(alerta?.responsavelEmail || "").toLowerCase().trim();
  const myEmail = String(window.auth?.currentUser?.email || "").toLowerCase().trim();

  // Usuário comum: vê APENAS os próprios alertas, independente do que estiver em alertasDeUsuarios
  if (p.role !== "supervisor") {
    return email === myEmail;
  }

  // Supervisor: pode ver alertas dos usuários configurados em alertasDeUsuarios
  if (Array.isArray(p.alertasDeUsuarios)) {
    if (p.alertasDeUsuarios.includes("*")) return true;
    return email === myEmail || p.alertasDeUsuarios.includes(email);
  }

  // Supervisor sem alertasDeUsuarios configurado → só os próprios
  return email === myEmail;
}

function iniciarListenerAlertas() {
  if (!window.db) return;

  if (unsubscribeAlertas) {
    unsubscribeAlertas();
    unsubscribeAlertas = null;
  }

  unsubscribeAlertas = getAlertasRef().onSnapshot((snap) => {
    const agora = Date.now();

    const listaNova = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((a) => !alertaEhObsoleto(a))
      .filter((a) => usuarioPodeVerAlerta(a));
    // Nota: alertas adiados (snoozed) são mantidos no cache.
    // A filtragem de snooze ocorre na camada de UI (getAlertasFiltradosUI).

    const idsNovos = new Set(listaNova.map((a) => a.id));

    if (window.alertasPrimeiraCargaFeita) {
      listaNova.forEach((alerta) => {
        // Adiados nunca disparam toast (estão silenciados intencionalmente)
        if (alerta.status === "adiado") return;

        const ehAtivo =
          alerta.status === "aberto" ||
          alerta.status === "aguardando_aprovacao_resolucao" ||
          alerta.status === "aguardando_aprovacao_ignorar";

        if (ehAtivo && !window.alertasIdsAnteriores.has(alerta.id)) {
          mostrarToastAlerta(alerta);
        }
      });
    }

    window.alertasCache = listaNova;
    window.alertasIdsAnteriores = idsNovos;
    window.alertasPrimeiraCargaFeita = true;

    atualizarBadgeAlertas();
    const modalAberto = !document.getElementById("modalAlertas")?.classList.contains("hidden");
    const temSelecao = window.getSelection()?.toString().length > 0;
    if (modalAberto && !temSelecao) renderListaAlertas();
    else if (!modalAberto) window._alertasRenderPendente = true;
  }, (err) => {
    console.error("[Alertas] Listener falhou:", err.code, err.message);
    if (typeof showToast === "function") {
      showToast("Sistema de alertas desconectado. Recarregue a página.", "error");
    }
  });
}

// =========================
// COORDENAÇÃO MULTI-ABA (BroadcastChannel)
// =========================

function _alertasIniciarInterval() {
  if (window.alertasLoopHandle) clearInterval(window.alertasLoopHandle);
  const intervaloMs = DEBUG_ALERTAS ? 10000 : 60000;
  window.alertasLoopHandle = setInterval(() => {
    if (!window._alertasEhLider) return;
    apagarAlertasObsoletosParaSempre().catch(console.error);
    verificarAlertasSistema().catch(console.error);
  }, intervaloMs);
}

function _alertasAssumirLideranca() {
  if (window._alertasEhLider) return;
  window._alertasEhLider = true;
  if (window._alertasBc) {
    window._alertasBc.postMessage({ type: "take-lead", tabId: window._alertasTabId });
  }
  _alertasIniciarInterval();
}

function _alertasLiberarLideranca() {
  if (!window._alertasEhLider) return;
  window._alertasEhLider = false;
  if (window.alertasLoopHandle) {
    clearInterval(window.alertasLoopHandle);
    window.alertasLoopHandle = null;
  }
  if (window._alertasBc) {
    window._alertasBc.postMessage({ type: "release-lead", tabId: window._alertasTabId });
  }
}

function iniciarAlertasBroadcastChannel() {
  if (window._alertasBc) return;
  if (!window.BroadcastChannel) return; // fallback: comportamento anterior

  window._alertasBc = new BroadcastChannel("crm-alertas-loop");

  window._alertasBc.onmessage = (e) => {
    const msg = e.data || {};
    if (msg.tabId === window._alertasTabId) return; // mensagem própria, ignorar

    if (msg.type === "take-lead") {
      // Outra aba assumiu — eu cedo
      if (window._alertasEhLider) {
        window._alertasEhLider = false;
        if (window.alertasLoopHandle) {
          clearInterval(window.alertasLoopHandle);
          window.alertasLoopHandle = null;
        }
      }
    } else if (msg.type === "release-lead") {
      // Líder saiu — assumo se esta aba estiver visível
      if (!document.hidden) {
        setTimeout(() => {
          if (!window._alertasEhLider && !document.hidden) {
            _alertasAssumirLideranca();
            apagarAlertasObsoletosParaSempre().catch(console.error);
            verificarAlertasSistema().catch(console.error);
          }
        }, Math.random() * 80 + 20); // atraso aleatório 20–100ms para evitar thundering herd
      }
    }
  };
}

function iniciarLoopAlertas() {
  if (window.alertasLoopHandle) {
    clearInterval(window.alertasLoopHandle);
    window.alertasLoopHandle = null;
  }

  iniciarAlertasBroadcastChannel();

  // Só assume liderança se esta aba estiver visível
  if (!document.hidden) {
    _alertasAssumirLideranca();
  }

  // Remove handler anterior se existir (evita duplicatas em chamadas repetidas)
  if (window._alertasVisibilityHandler) {
    document.removeEventListener("visibilitychange", window._alertasVisibilityHandler);
  }

  window._alertasVisibilityHandler = () => {
    if (!document.hidden) {
      // Aba ficou visível: tenta assumir liderança e dispara verificação imediata
      _alertasAssumirLideranca();
      apagarAlertasObsoletosParaSempre().catch(console.error);
      verificarAlertasSistema().catch(console.error);
    } else {
      // Aba foi para segundo plano: libera liderança para outras abas
      _alertasLiberarLideranca();
    }
  };
  document.addEventListener("visibilitychange", window._alertasVisibilityHandler);

  // pagehide: garante release-lead ao fechar a aba (beforeunload não é confiável)
  // Usa once:true para não acumular listeners em chamadas repetidas
  if (!window._alertasPageHideRegistrado) {
    window.addEventListener("pagehide", () => {
      _alertasLiberarLideranca();
    }, { once: true });
    window._alertasPageHideRegistrado = true;
  }
}

function limparSistemaAlertas() {
  _alertasLiberarLideranca();

  if (window.alertasLoopHandle) {
    clearInterval(window.alertasLoopHandle);
    window.alertasLoopHandle = null;
  }

  window.unsubscribeAlertas?.();
  window.unsubscribeAlertas = null;

  if (window._alertasVisibilityHandler) {
    document.removeEventListener("visibilitychange", window._alertasVisibilityHandler);
    window._alertasVisibilityHandler = null;
  }

  if (window._alertasBc) {
    window._alertasBc.close();
    window._alertasBc = null;
  }
}

window.limparSistemaAlertas = limparSistemaAlertas;

async function limparAlertasTipoObsoleto(tipo) {
  const snap = await getAlertasRef().where("tipo", "==", tipo).get();
  if (snap.empty) return;
  const batch = window.db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  console.log(`[alertas] ${snap.docs.length} alertas "${tipo}" removidos do Firestore.`);
}

function _atualizarVisibilidadeTabAdiados() {
  const tab = document.getElementById("tabAdiados");
  if (!tab) return;
  const podeVer = usuarioEhAdminAlertas() || usuarioEhSupervisorAlertas();
  tab.classList.toggle("hidden", !podeVer);
}

function iniciarSistemaAlertas() {
  iniciarListenerAlertas();
  iniciarLoopAlertas();
  _atualizarVisibilidadeTabAdiados();
  // Verificação inicial apenas se a aba está visível (evita writes redundantes em abas de fundo)
  if (!document.hidden) {
    apagarAlertasObsoletosParaSempre().catch(console.error);
    verificarAlertasSistema().catch(console.error);
  }
}

// =========================
// BADGE / MODAL
// =========================

function atualizarBadgeAlertas() {
  const badge = document.getElementById("badgeAlertas");
  const btn = document.getElementById("btnAlertas");
  if (!badge || !btn) return;

  const total = (window.alertasCache || []).filter((a) =>
    a.status === "aberto" ||
    a.status === "aguardando_aprovacao_resolucao" ||
    a.status === "aguardando_aprovacao_ignorar"
  ).length;

  const totalAnterior = window.alertasCacheAnterior || 0;

  badge.textContent = String(total);
  badge.classList.toggle("hidden", total === 0);

  if (total > totalAnterior) {
    btn.classList.remove("animar-alerta");
    void btn.offsetWidth;
    btn.classList.add("animar-alerta");
  }

  window.alertasCacheAnterior = total;
}

function abrirModalAlertas() {
  document.getElementById("modalAlertas")?.classList.remove("hidden");
  window._alertasRenderPendente = false;
  renderListaAlertas();
}

function fecharModalAlertas() {
  document.getElementById("modalAlertas")?.classList.add("hidden");
}

// =========================
// FILTROS UI
// =========================

function trocarAbaAlertas(aba) {
  window.alertasUI.aba = aba;

  document.querySelectorAll(".alerta-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === aba);
  });

  renderListaAlertas();
}

function renderBadgesAbas() {
  const cache = window.alertasCache || [];
  const defs = [
    // "todos" exclui adiados (ficam na aba "Adiados")
    { id: "badge-todos", fn: a => a.status === "aberto" || a.status === "aguardando_aprovacao_resolucao" || a.status === "aguardando_aprovacao_ignorar" },
    { id: "badge-nao_lidos", fn: a => !a.lido && a.status !== "adiado" && a.status !== "resolvido" && a.status !== "ignorado" && a.status !== "arquivado" },
    { id: "badge-pendentes_aprovacao", fn: a => a.status === "aguardando_aprovacao_resolucao" || a.status === "aguardando_aprovacao_ignorar" },
    { id: "badge-atrasados", fn: a => !!a.atraso && a.status !== "adiado" && a.status !== "resolvido" && a.status !== "ignorado" && a.status !== "arquivado" },
    { id: "badge-ignorados", fn: a => a.status === "ignorado" },
    { id: "badge-resolvidos", fn: a => a.status === "resolvido" },
    { id: "badge-arquivados", fn: a => a.status === "arquivado" },
  ];

  defs.forEach(({ id, fn }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const count = cache.filter(fn).length;
    if (count > 0) {
      el.textContent = count > 99 ? "99+" : String(count);
      el.classList.remove("hidden");
    } else {
      el.textContent = "";
      el.classList.add("hidden");
    }
  });
}

function limparFiltrosAlertas() {
  ["alertasBusca", "filtroTipoAlerta", "filtroPrioridadeAlerta", "filtroResponsavelAlerta", "filtroPeriodoAlerta", "filtroUrgenciaAlerta"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const ordem = document.getElementById("ordemAlertas");
  if (ordem) ordem.value = "prioridade";
  renderListaAlertas();
}

function nomeExibicaoResponsavel(email) {
  const local = String(email || "").split("@")[0];
  const n = local.split(/[._]/)[0];
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

function atualizarSelectResponsavel() {
  const sel = document.getElementById("filtroResponsavelAlerta");
  if (!sel) return;
  const atual = sel.value;
  const emails = [...new Set(
    (window.alertasCache || [])
      .map(a => a.responsavelEmail)
      .filter(Boolean)
  )].sort((a, b) => nomeExibicaoResponsavel(a).localeCompare(nomeExibicaoResponsavel(b)));

  sel.innerHTML = '<option value="">Responsável: todos</option>' +
    emails.map(e => `<option value="${escapeHtml(e)}"${e === atual ? " selected" : ""}>${escapeHtml(nomeExibicaoResponsavel(e))}</option>`).join("");
}

function getAlertasFiltradosUI() {
  let lista = [...(window.alertasCache || [])];

  const aba = window.alertasUI?.aba || "todos";
  const busca = String(document.getElementById("alertasBusca")?.value || "").trim().toLowerCase();
  const tipo = String(document.getElementById("filtroTipoAlerta")?.value || "").trim().toLowerCase();
  const prioridade = String(document.getElementById("filtroPrioridadeAlerta")?.value || "").trim().toLowerCase();
  const responsavel = String(document.getElementById("filtroResponsavelAlerta")?.value || "").trim().toLowerCase();

  if (aba === "nao_lidos") {
    lista = lista.filter((a) =>
      !a.lido &&
      a.status !== "adiado" &&
      a.status !== "resolvido" &&
      a.status !== "ignorado"
    );
  } else if (aba === "atrasados") {
    lista = lista.filter((a) =>
      !!a.atraso &&
      a.status !== "adiado" &&
      a.status !== "resolvido" &&
      a.status !== "ignorado" &&
      a.status !== "arquivado"
    );
  } else if (aba === "adiados") {
    // Aba exclusiva para supervisores/admins — todos com status "adiado", independente da data
    lista = lista.filter((a) => a.status === "adiado");
  } else if (aba === "resolvidos") {
    lista = lista.filter((a) => a.status === "resolvido");
  } else if (aba === "pendentes_aprovacao") {
    lista = lista.filter((a) =>
      a.status === "aguardando_aprovacao_resolucao" ||
      a.status === "aguardando_aprovacao_ignorar"
    );
  } else if (aba === "ignorados") {
    lista = lista.filter((a) => a.status === "ignorado");
  } else if (aba === "arquivados") {
    lista = lista.filter((a) => a.status === "arquivado");
  } else {
    // aba "todos" — exclui arquivados, resolvidos, ignorados e TODOS os adiados (ficam na aba "Adiados")
    lista = lista.filter((a) =>
      a.status === "aberto" ||
      a.status === "aguardando_aprovacao_resolucao" ||
      a.status === "aguardando_aprovacao_ignorar"
    );
  }

  if (busca) {
    lista = lista.filter((a) => {
      const texto = [
        a.titulo,
        a.descricao,
        a.responsavelEmail,
        a.tipo,
        a.entidade
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return texto.includes(busca);
    });
  }

  if (tipo) lista = lista.filter((a) => String(a.tipo || "").toLowerCase() === tipo);
  if (prioridade) lista = lista.filter((a) => String(a.prioridade || "").toLowerCase() === prioridade);
  if (responsavel) {
    lista = lista.filter((a) =>
      String(a.responsavelEmail || "").toLowerCase() === responsavel
    );
  }

  const periodo = String(document.getElementById("filtroPeriodoAlerta")?.value || "");
  if (periodo) {
    const agora = Date.now();
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
    lista = lista.filter((a) => {
      const criado = new Date(a.dataCriacao || 0).getTime();
      if (periodo === "hoje") return criado >= inicioDia.getTime();
      const dias = parseInt(periodo, 10);
      return criado >= agora - dias * 864e5;
    });
  }

  const urgencia = String(document.getElementById("filtroUrgenciaAlerta")?.value || "");
  if (urgencia) {
    const diasMin = parseInt(urgencia, 10);
    const agora = Date.now();
    const statusAbertos = ["aberto", "aguardando_aprovacao_resolucao", "aguardando_aprovacao_ignorar"];
    lista = lista.filter((a) => {
      if (!statusAbertos.includes(String(a.status || "").toLowerCase())) return false;
      const criado = new Date(a.dataCriacao || 0).getTime();
      const diasEmAberto = (agora - criado) / 864e5;
      return diasEmAberto >= diasMin;
    });
  }

  const ordem = String(document.getElementById("ordemAlertas")?.value || "prioridade");

  lista.sort((a, b) => {
    if (ordem === "recente") {
      return new Date(b.dataCriacao || 0) - new Date(a.dataCriacao || 0);
    }
    if (ordem === "antigo") {
      return new Date(a.dataCriacao || 0) - new Date(b.dataCriacao || 0);
    }
    // padrão: prioridade desc, depois mais recente
    const pa = getOrdemPrioridade(a.prioridade);
    const pb = getOrdemPrioridade(b.prioridade);
    if (pb !== pa) return pb - pa;
    return new Date(b.dataCriacao || 0) - new Date(a.dataCriacao || 0);
  });

  // show/hide Limpar button based on active filters
  const temFiltroAtivo = busca || tipo || prioridade || responsavel || periodo || urgencia || (ordem && ordem !== "prioridade");
  const btnLimpar = document.getElementById("btnLimparFiltrosAlertas");
  if (btnLimpar) btnLimpar.classList.toggle("hidden", !temFiltroAtivo);

  return lista;
}

// =========================
// RENDER
// =========================

function renderListaAlertas() {
  const wrap = document.getElementById("listaAlertas");
  const resumo = document.getElementById("resumoAlertas");
  if (!wrap) return;

  renderBadgesAbas();
  atualizarSelectResponsavel();
  const lista = getAlertasFiltradosUI();

  if (resumo) {
    resumo.textContent = `${lista.length} alerta(s) nesta visualização`;
  }

  if (!lista.length) {
    wrap.innerHTML = `<div class="alerta-vazio">Nenhum alerta encontrado.</div>`;
    return;
  }

  wrap.innerHTML = lista.map((a) => {
    const prioridade = String(a.prioridade || "baixa").toLowerCase();
    const status = String(a.status || "aberto").toLowerCase();

    const classePrioridade = classePrioridadeAlerta(prioridade);
    const classeStatus = classeStatusAlerta(status);

    const podeGerenciarDireto = usuarioPodeGerenciarDiretoAlerta(a);
    const podeAprovar = usuarioPodeAprovarPendencia(a);

    return `
      <div class="alerta-card ${classePrioridade} ${classeStatus}">
        <div class="alerta-topo">
          <div class="alerta-titulo-wrap">
            <div class="alerta-titulo">${escapeHtml(a.titulo || "Alerta")}</div>
            <span class="alerta-badge-status ${classeStatus}">${getStatusLabel(status)}</span>
          </div>

          <span class="alerta-badge-prioridade ${classePrioridade}">
            ${prioridade}
          </span>
        </div>

        <div class="alerta-meta">
          ${escapeHtml(a.descricao || "")}<br>
          ${status === "adiado" && a.lembrarNovamenteEm ? `<strong>🔔 Volta em:</strong> ${formatarDataAlertaBR(a.lembrarNovamenteEm)} (${textoTempoRelativoAlerta(a.lembrarNovamenteEm)})<br>` : ""}
          <strong>Tipo:</strong> ${labelTipoAlerta(a.tipo)}<br>
          ${a.tipo === "followup" && a.tipoOferta ? `<strong>Tipo de oferta:</strong> ${escapeHtml(a.tipoOferta.charAt(0).toUpperCase() + a.tipoOferta.slice(1))}<br>` : ""}
          ${a.tipo === "pedido_sem_nf" && a.valorPedido > 0 ? `<strong>Valor do pedido:</strong> ${_formatMoedaBR(a.valorPedido)}<br>` : ""}
          ${a.tipo === "pedido_sem_nf" && a.somaNFs > 0 ? `<strong>NFs registradas:</strong> ${_formatMoedaBR(a.somaNFs)}<br>` : ""}
          ${a.tipo === "pedido_sem_nf" && a.valorFaltante > 0 ? `<strong style="color:var(--danger,#ef4444);">Falta:</strong> <span style="color:var(--danger,#ef4444);font-weight:700;">${_formatMoedaBR(a.valorFaltante)}</span><br>` : ""}
          <strong>Entidade:</strong> ${labelEntidadeAlerta(a.entidade)}<br>
          <strong>Responsável:</strong> ${escapeHtml(a.responsavelEmail || "-")}<br>
          <strong>Lido:</strong> ${a.lido ? "Sim" : "Não"}<br>
          <strong>Alerta Criado em:</strong> ${formatarDataAlertaBR(a.dataCriacao)} (${textoTempoRelativoAlerta(a.dataCriacao)})<br>
          <strong>Referência:</strong> ${textoReferenciaAlerta(a)}<br>
          ${a.lembreteNumero ? `<strong>Lembrete:</strong> ${Number(a.lembreteNumero)}<br>` : ""}
          ${a.resolvidoPor ? `<strong>Resolvido por:</strong> ${escapeHtml(a.resolvidoPor)}<br>` : ""}
          ${a.resolvidoEm ? `<strong>Resolvido em:</strong> ${formatarDataAlertaBR(a.resolvidoEm)}<br>` : ""}
          ${a.resolvidoEm ? `<strong>Tempo para resolver:</strong> ${tempoParaResolverAlerta(a)}<br>` : ""}
          ${a.aprovadoPor ? `<strong>Aprovado por:</strong> ${escapeHtml(a.aprovadoPor)}<br>` : ""}
          ${a.aprovadoEm ? `<strong>Aprovado em:</strong> ${formatarDataAlertaBR(a.aprovadoEm)}<br>` : ""}
          ${a.ignoradoPor ? `<strong>Ignorado por:</strong> ${escapeHtml(a.ignoradoPor)}<br>` : ""}
          ${a.ignoradoEm ? `<strong>Ignorado em:</strong> ${formatarDataAlertaBR(a.ignoradoEm)}<br>` : ""}
        </div>

        <div class="alerta-actions">
          ${a.entidade === "oferta" && a.entidadeId
            ? `<button type="button" class="btn-ver-oferta" onclick="abrirItemDoAlerta('${a.id}')">Ver oferta →</button>`
            : ""}

          ${status === "aberto" || status === "adiado"
            ? `<button type="button" class="secondary" onclick="${podeGerenciarDireto ? `resolverAlertaDireto('${a.id}')` : `solicitarResolucaoAlerta('${a.id}')`}">Resolver</button>`
            : ""}

          ${status === "aguardando_aprovacao_resolucao" && podeAprovar
            ? `<button type="button" class="secondary" onclick="aprovarResolucaoAlerta('${a.id}')">Aprovar resolução</button>`
            : ""}

          ${status === "aguardando_aprovacao_ignorar" && podeAprovar
            ? `<button type="button" class="secondary" onclick="aprovarIgnorarAlerta('${a.id}')">Aprovar ignorar</button>`
            : ""}

          ${status === "resolvido"
            ? `<button type="button" class="secondary" onclick="reabrirAlerta('${a.id}')">Reabrir</button>`
            : ""}

          <button type="button" class="btn-alerta-mais" onclick="toggleAlertaSecondary(this)" aria-label="Mais ações">⋯</button>

          <div class="alerta-actions-secondary">
            ${status === "aberto" || status === "adiado"
              ? `<button type="button" class="secondary" onclick="lembrarDepoisAlerta('${a.id}', 1)">+1 dia</button>`
              : ""}

            ${status === "aberto" || status === "adiado"
              ? `<button type="button" class="secondary" onclick="lembrarDepoisAlerta('${a.id}', 3)">+3 dias</button>`
              : ""}

            ${status === "aberto" || status === "adiado"
              ? `<button type="button" class="secondary" onclick="lembrarDepoisAlerta('${a.id}', 7)">+7 dias</button>`
              : ""}

            ${status === "aberto" || status === "adiado"
              ? `<button type="button" class="secondary" onclick="lembrarDepoisDataAlerta('${a.id}')">Escolher data</button>`
              : ""}

            ${status === "aberto" || status === "adiado"
              ? `<button type="button" class="secondary" onclick="${podeGerenciarDireto ? `ignorarAlertaDireto('${a.id}')` : `solicitarIgnorarAlerta('${a.id}')`}">Ignorar</button>`
              : ""}

            ${status === "aguardando_aprovacao_resolucao" && podeAprovar
              ? `<button type="button" class="secondary" onclick="rejeitarResolucaoAlerta('${a.id}')">Rejeitar</button>`
              : ""}

            ${status === "aguardando_aprovacao_ignorar" && podeAprovar
              ? `<button type="button" class="secondary" onclick="rejeitarIgnorarAlerta('${a.id}')">Rejeitar</button>`
              : ""}

            <button type="button" class="secondary" onclick="verHistoricoAlerta('${a.id}')">Histórico</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// =========================
// AÇÕES
// =========================

async function solicitarResolucaoAlerta(id) {
  const usuario = getUsuarioAcaoAlertas();

  await getAlertasRef().doc(id).set(
    {
      status: "aguardando_aprovacao_resolucao",
      resolvidoPor: usuario,
      resolvidoEm: agoraISOAlerta(),
      atualizadoEm: agoraISOAlerta()
    },
    { merge: true }
  );

  await adicionarHistoricoAlerta(id, "solicitou_resolucao", {
    resolvidoPor: usuario
  });

  trocarAbaAlertas("pendentes_aprovacao");
}

// =========================
// EFEITOS COLATERAIS AO RESOLVER
// =========================

/**
 * Ao resolver um alerta, atualiza o dado subjacente no registro
 * para que o loop não recrie o alerta imediatamente.
 */
async function aplicarEfeitoResolucaoAlerta(alerta) {
  const tipo = String(alerta?.tipo || "").toLowerCase();
  const entidadeId = alerta?.entidadeId;
  if (!entidadeId) return;

  if (tipo === "prazo_entrega" || tipo === "prazo_entrega_atrasado") {
    await marcarRegistroEntregue(entidadeId);
  } else if (tipo === "followup") {
    await resetarFollowUpRegistro(entidadeId);
  }
  // pedido_sem_nf: sem efeito — só para quando NF for adicionada
}

async function marcarRegistroEntregue(registroId) {
  const agora = agoraISOAlerta();
  await window.db.collection("ofertas").doc(registroId).set(
    { pedido: { entregue: "sim", entregueEm: agora } },
    { merge: true }
  );
  const idx = (registros || []).findIndex((r) => r.id === registroId);
  if (idx !== -1) {
    registros[idx].pedido = { ...(registros[idx].pedido || {}), entregue: "sim", entregueEm: agora };
  }
}

async function resetarFollowUpRegistro(registroId) {
  const agora = agoraISOAlerta();
  await window.db.collection("ofertas").doc(registroId).set(
    { ultimoFollowUpEm: agora },
    { merge: true }
  );
  const idx = (registros || []).findIndex((r) => r.id === registroId);
  if (idx !== -1) registros[idx].ultimoFollowUpEm = agora;
}


async function resolverAlertaDireto(id) {
  const usuario = getUsuarioAcaoAlertas();

  // Busca no cache; se não encontrar, vai direto ao Firestore (evita race condition)
  let alerta = (window.alertasCache || []).find((a) => a.id === id);
  if (!alerta) {
    const snap = await getAlertasRef().doc(id).get();
    if (snap.exists) alerta = { id: snap.id, ...snap.data() };
  }

  await getAlertasRef().doc(id).set(
    {
      status: "resolvido",
      resolvidoPor: usuario,
      resolvidoEm: agoraISOAlerta(),
      aprovadoPor: usuario,
      aprovadoEm: agoraISOAlerta(),
      atualizadoEm: agoraISOAlerta()
    },
    { merge: true }
  );

  await adicionarHistoricoAlerta(id, "resolvido", {
    resolvidoPor: usuario,
    aprovadoPor: usuario
  });

  if (alerta) await aplicarEfeitoResolucaoAlerta(alerta);

  trocarAbaAlertas("resolvidos");
}

async function aprovarResolucaoAlerta(id) {
  const usuario = getUsuarioAcaoAlertas();

  let alerta = (window.alertasCache || []).find((a) => a.id === id);
  if (!alerta) {
    const snap = await getAlertasRef().doc(id).get();
    if (snap.exists) alerta = { id: snap.id, ...snap.data() };
  }

  await getAlertasRef().doc(id).set(
    {
      status: "resolvido",
      aprovadoPor: usuario,
      aprovadoEm: agoraISOAlerta(),
      atualizadoEm: agoraISOAlerta()
    },
    { merge: true }
  );

  await adicionarHistoricoAlerta(id, "aprovou_resolucao", {
    aprovadoPor: usuario
  });

  if (alerta) await aplicarEfeitoResolucaoAlerta(alerta);

  trocarAbaAlertas("resolvidos");
}

async function rejeitarResolucaoAlerta(id) {
  await getAlertasRef().doc(id).set(
    {
      status: "aberto",
      resolvidoPor: "",
      resolvidoEm: "",
      atualizadoEm: agoraISOAlerta()
    },
    { merge: true }
  );

  await adicionarHistoricoAlerta(id, "rejeitou_resolucao");

  trocarAbaAlertas("todos");
}

async function solicitarIgnorarAlerta(id) {
  await getAlertasRef().doc(id).set(
    {
      status: "aguardando_aprovacao_ignorar",
      atualizadoEm: agoraISOAlerta(),
      solicitouIgnorarPor: getUsuarioAcaoAlertas(),
      solicitouIgnorarEm: agoraISOAlerta()
    },
    { merge: true }
  );

  await adicionarHistoricoAlerta(id, "solicitou_ignorar", {
    solicitouIgnorarPor: getUsuarioAcaoAlertas()
  });

  trocarAbaAlertas("pendentes_aprovacao");
}

async function ignorarAlertaDireto(id) {
  await getAlertasRef().doc(id).set(
    {
      status: "ignorado",
      ignoradoPor: getUsuarioAcaoAlertas(),
      ignoradoEm: agoraISOAlerta(),
      aprovadoPor: getUsuarioAcaoAlertas(),
      aprovadoEm: agoraISOAlerta(),
      atualizadoEm: agoraISOAlerta()
    },
    { merge: true }
  );

  await adicionarHistoricoAlerta(id, "ignorado", {
    ignoradoPor: getUsuarioAcaoAlertas()
  });

  trocarAbaAlertas("ignorados");
}

async function aprovarIgnorarAlerta(id) {
  await getAlertasRef().doc(id).set(
    {
      status: "ignorado",
      ignoradoPor: getUsuarioAcaoAlertas(),
      ignoradoEm: agoraISOAlerta(),
      aprovadoPor: getUsuarioAcaoAlertas(),
      aprovadoEm: agoraISOAlerta(),
      atualizadoEm: agoraISOAlerta()
    },
    { merge: true }
  );

  await adicionarHistoricoAlerta(id, "aprovou_ignorar", {
    aprovadoPor: getUsuarioAcaoAlertas()
  });

  trocarAbaAlertas("ignorados");
}

async function rejeitarIgnorarAlerta(id) {
  await getAlertasRef().doc(id).set(
    {
      status: "aberto",
      atualizadoEm: agoraISOAlerta()
    },
    { merge: true }
  );

  await adicionarHistoricoAlerta(id, "rejeitou_ignorar");

  trocarAbaAlertas("todos");
}

async function reabrirAlerta(id) {
  await getAlertasRef().doc(id).set(
    {
      status: "aberto",
      resolvidoPor: "",
      resolvidoEm: "",
      aprovadoPor: "",
      aprovadoEm: "",
      ignoradoPor: "",
      ignoradoEm: "",
      atualizadoEm: agoraISOAlerta()
    },
    { merge: true }
  );

  await adicionarHistoricoAlerta(id, "reaberto");

  trocarAbaAlertas("todos");
}

async function lembrarDepoisAlerta(id, dias) {
  const data = new Date();
  data.setDate(data.getDate() + dias);

  await getAlertasRef().doc(id).set(
    {
      status: "adiado",
      lembrarNovamenteEm: data.toISOString(),
      atualizadoEm: agoraISOAlerta()
    },
    { merge: true }
  );

  await adicionarHistoricoAlerta(id, "adiado", {
    dias
  });
}

function lembrarDepoisDataAlerta(id) {
  // Modal leve com input type=date — sem prompt() nativo
  const hoje = new Date().toISOString().slice(0, 10);

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2147483647;display:flex;align-items:center;justify-content:center;";

  overlay.innerHTML = `
    <div style="background:var(--bg-container);border:1px solid var(--border-soft);border-radius:14px;padding:24px 28px;min-width:280px;box-shadow:0 8px 32px rgba(0,0,0,.25);">
      <div style="font-size:15px;font-weight:700;margin-bottom:14px;color:var(--text-main);">Lembrar novamente em</div>
      <input type="date" id="_adiarDataInput" min="${hoje}" value="${hoje}"
        style="width:100%;padding:8px 10px;border-radius:8px;border:1.5px solid var(--border-soft);background:var(--bg-body);color:var(--text-main);font-size:14px;margin-bottom:16px;">
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button id="_adiarCancelar" class="secondary" style="padding:7px 16px;">Cancelar</button>
        <button id="_adiarConfirmar" style="padding:7px 16px;">Confirmar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  const input = overlay.querySelector("#_adiarDataInput");
  input.focus();

  const fechar = () => overlay.remove();

  overlay.querySelector("#_adiarCancelar").addEventListener("click", fechar);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) fechar(); });

  overlay.querySelector("#_adiarConfirmar").addEventListener("click", async () => {
    const valor = input.value;
    if (!valor) return;
    const data = new Date(`${valor}T09:00:00`);
    if (isNaN(data.getTime())) { showToast("Data inválida.", "error"); return; }
    fechar();
    await getAlertasRef().doc(id).set(
      { status: "adiado", lembrarNovamenteEm: data.toISOString(), atualizadoEm: agoraISOAlerta() },
      { merge: true }
    );
    await adicionarHistoricoAlerta(id, "adiado_data", { dataEscolhida: data.toISOString() });
  });
}

async function marcarAlertaComoLido(id) {
  if (!id) return;

  await getAlertasRef().doc(id).set(
    {
      lido: true,
      lidoEm: agoraISOAlerta()
    },
    { merge: true }
  );
}

async function abrirItemDoAlerta(alertaId) {
  const alerta = (window.alertasCache || []).find((a) => a.id === alertaId);
  if (!alerta) return;

  await marcarAlertaComoLido(alertaId);
  fecharModalAlertas();

  const entidade = String(alerta.entidade || "").toLowerCase();
  const entidadeId = alerta.entidadeId;

  if (entidade === "oferta" && typeof verOferta === "function") {
    window._voltarParaAlertas = true;
    verOferta(entidadeId);
    return;
  }

  if (entidade === "cliente" && typeof verCliente === "function") {
    verCliente(entidadeId);
    return;
  }

  if (entidade === "projeto" && typeof verProjeto === "function") {
    verProjeto(entidadeId);
    return;
  }

  if (entidade === "representada" && typeof verRepresentada === "function") {
    verRepresentada(entidadeId);
    return;
  }

  console.warn("Nenhuma função encontrada para abrir a entidade:", entidade, entidadeId);
}

// =========================
// HISTÓRICO
// =========================

async function verHistoricoAlerta(id) {
  let alerta = (window.alertasCache || []).find((a) => a.id === id);
  if (!alerta) {
    const snap = await getAlertasRef().doc(id).get().catch(() => null);
    if (!snap?.exists) {
      if (typeof showToast === "function") showToast("Alerta não encontrado.", "error");
      return;
    }
    alerta = { id: snap.id, ...snap.data() };
  }

  const historico = Array.isArray(alerta.historico) ? alerta.historico : [];

  const html = historico.length
    ? historico.map((h) => `
        <div class="historico-item">
          <div class="historico-topo">
            <span class="historico-usuario">${escapeHtml(h.usuario || "-")}</span>
            <span class="historico-data">${formatarDataAlertaBR(h.dataHora)}</span>
          </div>
          <div class="historico-texto">
            ${escapeHtml(h.acao || "-")}
          </div>
        </div>
      `).join("")
    : `<div class="historico-vazio">Sem histórico.</div>`;

  if (typeof abrirModal === "function") {
    abrirModal("Histórico do alerta", html);
  }
}

// =========================
// CICLO DE VIDA — SAVE / LIXEIRA / EXCLUSÃO
// =========================

/**
 * Chamado após salvar/editar um registro.
 * Resolve automaticamente alertas de follow-up abertos:
 *   - admin/supervisor com permissão → resolve direto
 *   - user comum → solicita aprovação (precisa de admin/supervisor aprovar)
 */
async function onRegistroSalvoReset(registroId) {
  if (!registroId) return;

  const STATUS_IGNORAR = [
    "resolvido", "ignorado", "arquivado",
    "aguardando_aprovacao_resolucao", "aguardando_aprovacao_ignorar"
  ];

  const TIPOS_AUTO_RESET = ["followup"];

  // Se as NFs agora cobrem o valor total do pedido, auto-resolve pedido_sem_nf
  const reg = (registros || []).find((r) => r.id === registroId);
  if (reg && String(reg.possuiPedido || "").toLowerCase() === "sim") {
    if (_nfCobertaPedido(reg.pedido || {})) {
      TIPOS_AUTO_RESET.push("pedido_sem_nf");
    }
  }

  const usuario = getUsuarioAcaoAlertas();
  const agora = agoraISOAlerta();

  for (const tipo of TIPOS_AUTO_RESET) {
    const chaveUnica = montarChaveAlerta({
      tipo,
      entidade: "oferta",
      entidadeId: registroId
    });

    const alerta = await buscarAlertaPorChave(chaveUnica);
    if (!alerta) continue;
    if (STATUS_IGNORAR.includes(alerta.status)) continue;

    const podeGerenciar = usuarioPodeGerenciarDiretoAlerta(alerta);

    if (podeGerenciar) {
      // Atualiza Firestore diretamente (sem chamar resolverAlertaDireto para não mudar de aba)
      await getAlertasRef().doc(alerta.id).set(
        {
          status: "resolvido",
          resolvidoPor: usuario,
          resolvidoEm: agora,
          aprovadoPor: usuario,
          aprovadoEm: agora,
          atualizadoEm: agora
        },
        { merge: true }
      );
      await adicionarHistoricoAlerta(alerta.id, "resolvido_auto_save", { resolvidoPor: usuario });
      // Aplica efeito com o objeto já em mãos — sem depender do cache
      await aplicarEfeitoResolucaoAlerta(alerta);
    } else {
      await solicitarResolucaoAlerta(alerta.id);
    }
  }
}

/**
 * Chamado ao mover uma entidade para a lixeira (soft-delete).
 * Marca todos os alertas abertos da entidade como "arquivado".
 * Eles aparecem na aba Arquivados e somem da aba Todos.
 */
async function arquivarAlertasDeEntidade(entidadeId) {
  if (!entidadeId) return;

  const snap = await getAlertasRef()
    .where("entidadeId", "==", entidadeId)
    .get();

  if (snap.empty) return;

  const statusFinalizado = ["resolvido", "ignorado", "arquivado"];
  const agora = agoraISOAlerta();

  for (const doc of snap.docs) {
    const data = doc.data();
    if (statusFinalizado.includes(data.status)) continue;

    // Um único write: status + histórico via arrayUnion
    await doc.ref.set(
      {
        status: "arquivado",
        atualizadoEm: agora,
        historico: firebase.firestore.FieldValue.arrayUnion({
          acao: "arquivado_lixeira",
          usuario: "system",
          dataHora: agora
        })
      },
      { merge: true }
    );
  }
}

/**
 * Chamado ao excluir definitivamente uma entidade (saída da lixeira).
 * Remove permanentemente todos os alertas ligados a ela no Firestore.
 */
async function excluirAlertasDeEntidade(entidadeId) {
  if (!entidadeId) return;

  const snap = await getAlertasRef()
    .where("entidadeId", "==", entidadeId)
    .get();

  if (snap.empty) return;

  const batch = window.db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

function toggleAlertaSecondary(btn) {
  const secondary = btn.parentElement.querySelector(".alerta-actions-secondary");
  if (!secondary) return;
  const isOpen = secondary.classList.toggle("open");
  btn.textContent = isOpen ? "✕" : "⋯";
  btn.setAttribute("aria-expanded", String(isOpen));
}