"use strict";

// ============================================================================
// Correlação de Cabos Prysmian — lookup determinístico na TABELA USO INTERNO.
// Carrega o .xlsx em memória e indexa por (produto, condutor, classe, seção).
// O código SEMPRE sai daqui (coluna G) — o Claude só fornece os atributos.
// ============================================================================

const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");

// Caminho da planilha: env TABELA_PATH, ou o "TABELA USO INTERNO*.xlsx" mais
// recente na raiz do projeto — assim trocar a planilha (JUNHO26, JULHO26...) só
// exige soltar o arquivo na pasta e recarregar, sem mexer no código.
function _resolverCaminhoTabela() {
  if (process.env.TABELA_PATH) return process.env.TABELA_PATH;
  const raiz = path.join(__dirname, "..");
  try {
    const cands = fs.readdirSync(raiz)
      .filter((f) => /^TABELA USO INTERNO.*\.xlsx$/i.test(f) && !f.startsWith("~$"))
      .map((f) => ({ f, t: fs.statSync(path.join(raiz, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    if (cands.length) return path.join(raiz, cands[0].f);
  } catch (e) { /* ignora */ }
  return path.join(raiz, "TABELA USO INTERNO_JUNHO26.xlsx");
}
const TABELA_PATH = _resolverCaminhoTabela();

// Mapeia os índices das colunas pelo CABEÇALHO (que contém CONDUTOR, CÓDIGO, PRODUTO,
// CLASSE, SEÇÃO...). Assim o sistema funciona com qualquer layout — se a planilha vier
// com as colunas deslocadas ou o cabeçalho em outra linha, ele se adapta sozinho.
function _mapearColunas(rows) {
  let hi = -1;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const up = (rows[i] || []).map((c) => normTexto(c));
    if (up.includes("CONDUTOR") && up.some((c) => c.includes("CÓDIGO") || c.includes("CODIGO"))) { hi = i; break; }
  }
  if (hi < 0) return null;
  const hdr = (rows[hi] || []).map((c) => normTexto(c));
  const achar = (...termos) => hdr.findIndex((h) => h && termos.some((t) => h.includes(t)));
  return {
    headerRow: hi,
    condutor:  achar("CONDUTOR"),
    codigo:    achar("CÓDIGO", "CODIGO"),
    familia:   achar("LINHA", "FAMÍLIA", "FAMILIA"),
    produto:   achar("PRODUTO"),
    classe:    achar("CLASSE"),
    secao:     achar("SEÇÃO", "SECAO", "TAMAN"),
    blindagem: achar("BLINDAGEM"),
    embalagem: achar("EMBALAGEM"),
    cor:       achar("COR"),
    unidade:   achar("UNIDADE"),
  };
}

// ── Normalização ──────────────────────────────────────────────────────────────
// Seção: MAIÚSCULAS, sem espaços, mm²→MM2, tira ",0" final (6,0→6) mas mantém 1,5.
function normSecao(s) {
  return String(s == null ? "" : s)
    .toUpperCase()
    .replace(/MM²/g, "MM2")
    .replace(/,0(?=\D|$)/g, "")
    .replace(/\s+/g, "");
}
// Texto (produto, condutor, classe, cor): sem acento, MAIÚSCULAS, espaços colapsados.
// Remover acento é essencial: a planilha grava "ALUMÍNIO" e o modelo manda "ALUMINIO".
function normTexto(s) {
  return String(s == null ? "" : s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/\s+/g, " ").trim();
}
function chave(produto, condutor, classe, secao) {
  return [normTexto(produto), normTexto(condutor), normTexto(classe), normSecao(secao)].join("|");
}

// ── Estado em memória ─────────────────────────────────────────────────────────
let _indice = new Map();   // chave -> [registros]
let _meta = { carregadaEm: null, totalLinhas: 0, totalIndexadas: 0, arquivo: TABELA_PATH };

function carregarTabela(caminho) {
  caminho = caminho || _resolverCaminhoTabela();
  if (!fs.existsSync(caminho)) {
    throw new Error(`Tabela não encontrada: ${caminho}`);
  }
  const wb = XLSX.readFile(caminho);
  const ws = wb.Sheets["TABELA USO INTERNO"] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });

  const COL = _mapearColunas(rows);
  if (!COL || COL.codigo < 0 || COL.produto < 0) {
    throw new Error("Cabeçalho da tabela não localizado (não achei colunas CONDUTOR/CÓDIGO/PRODUTO).");
  }
  const get = (r, idx) => (idx >= 0 && r[idx] != null) ? String(r[idx]).trim() : "";

  const indice = new Map();
  let totalIndexadas = 0;

  // Dados a partir da linha seguinte ao cabeçalho detectado.
  for (let i = COL.headerRow + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const codigo = get(r, COL.codigo);
    const produto = get(r, COL.produto);
    if (!codigo || !produto) continue; // linha sem código/produto não entra no índice

    const reg = {
      codigo,
      condutor:  get(r, COL.condutor),
      familia:   get(r, COL.familia),
      produto,
      classe:    get(r, COL.classe),
      secao:     get(r, COL.secao),
      blindagem: get(r, COL.blindagem),
      embalagem: get(r, COL.embalagem),
      cor:       get(r, COL.cor),
      unidade:   get(r, COL.unidade),
    };

    const k = chave(reg.produto, reg.condutor, reg.classe, reg.secao);
    if (!indice.has(k)) indice.set(k, []);
    indice.get(k).push(reg);
    totalIndexadas++;
  }

  _indice = indice;
  _meta = {
    carregadaEm: new Date().toISOString(),
    totalLinhas: rows.length,
    totalIndexadas,
    chavesUnicas: indice.size,
    colunas: COL,
    arquivo: caminho,
  };
  return _meta;
}

// ── Lookup ────────────────────────────────────────────────────────────────────
// attrs: { produto, condutor, classe, secao, cor?, embalagem?, blindagem? }
// Retorna: { status: "OK"|"PENDENCIA"|"AMBIGUO", codigo, candidatos, observacao }
// Fallback quando o nome do produto não bate exato: a planilha pode ter um sufixo
// que o modelo não soube (ex.: "COBRE NU 1/2 DURO 7F" vs "COBRE NU 1/2 DURO"). Casa
// por prefixo de produto + MESMA seção (e condutor/classe quando ambos têm valor) —
// é o "ofertar pela seção correta" quando o detalhe (nº de fios) não é certeiro.
function _buscarPorPrefixoProduto(attrs) {
  const pProd = normTexto(attrs.produto);
  const pSecao = normSecao(attrs.secao);
  if (pProd.length < 5 || !pSecao) return []; // âncoras fracas -> evita match espúrio
  const pCond = normTexto(attrs.condutor);
  const pClasse = normTexto(attrs.classe);
  const res = [];
  for (const regs of _indice.values()) {
    for (const r of regs) {
      if (normSecao(r.secao) !== pSecao) continue;
      const rCond = normTexto(r.condutor);
      const rClasse = normTexto(r.classe);
      if (pCond && rCond && pCond !== rCond) continue;
      if (pClasse && rClasse && pClasse !== rClasse) continue;
      const rProd = normTexto(r.produto);
      if (rProd.startsWith(pProd) || pProd.startsWith(rProd)) res.push(r);
    }
  }
  return res;
}

function lookup(attrs = {}) {
  const k = chave(attrs.produto, attrs.condutor, attrs.classe, attrs.secao);
  let candidatos = _indice.get(k) || [];
  let viaSecao = false;

  if (!candidatos.length) {
    candidatos = _buscarPorPrefixoProduto(attrs);
    viaSecao = candidatos.length > 0;
  }

  if (!candidatos.length) {
    return { status: "PENDENCIA", codigo: "", candidatos: [],
      observacao: "Nenhum código encontrado na TABELA USO INTERNO para esses atributos." };
  }
  const notaSecao = viaSecao ? "código pela seção (variação do produto não confirmada — confira)" : "";

  if (candidatos.length === 1) {
    return { status: "OK", codigo: candidatos[0].codigo, candidatos, observacao: notaSecao };
  }

  // Mais de um candidato — tenta desambiguar por cor, embalagem e blindagem.
  let filtrados = candidatos;
  const aplicarFiltro = (campo, valor) => {
    if (!valor) return;
    const v = normTexto(valor);
    const sub = filtrados.filter((c) => normTexto(c[campo]) === v);
    if (sub.length) filtrados = sub;
  };
  aplicarFiltro("cor", attrs.cor);
  aplicarFiltro("embalagem", attrs.embalagem);
  aplicarFiltro("blindagem", attrs.blindagem);

  // Preferência global do cliente: unidade METRO (cabo é cotado por metro; KG é granel).
  if (filtrados.length > 1) {
    const metro = filtrados.filter((c) => normTexto(c.unidade) === "METRO");
    if (metro.length) filtrados = metro;
  }

  if (filtrados.length === 1) {
    return { status: "OK", codigo: filtrados[0].codigo, candidatos: filtrados, observacao: notaSecao };
  }
  return { status: "AMBIGUO", codigo: "", candidatos: filtrados,
    observacao: `${filtrados.length} códigos possíveis — refine cor/embalagem/blindagem.` };
}

function getMeta() { return _meta; }

module.exports = { carregarTabela, lookup, getMeta, normSecao, normTexto, chave, TABELA_PATH };

// ── CLI de teste: `node correlacao.js` carrega a tabela e roda lookups de exemplo ──
if (require.main === module) {
  console.log("Carregando:", TABELA_PATH);
  const meta = carregarTabela();
  console.log("Meta:", JSON.stringify(meta, null, 2));
  const exemplos = [
    { produto: "AFUMEX GREEN", condutor: "COBRE", classe: "1kV", secao: "120 mm²" },
    { produto: "G7 SUPER EASY", condutor: "COBRE", classe: "1kV", secao: "3x2,5mm²" },
  ];
  for (const ex of exemplos) {
    console.log("\nLookup:", JSON.stringify(ex));
    console.log(" ->", JSON.stringify(lookup(ex)));
  }
  // Amostra de 5 chaves do índice para inspeção
  console.log("\nAmostra de chaves indexadas:");
  let n = 0;
  for (const [k, regs] of _indice) { console.log("  ", k, "=>", regs[0].codigo); if (++n >= 5) break; }
}
