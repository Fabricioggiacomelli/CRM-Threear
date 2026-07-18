"use strict";

// ============================================================================
// Correlação de Cabos — camada de IA. Chama a Messages API da Anthropic com o
// SKILL como system prompt (com prompt caching) para interpretar as descrições
// em ATRIBUTOS. O código nunca vem do modelo — sai do lookup em correlacao.js.
// ============================================================================

const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const { lookup } = require("./correlacao");

const RULES_PATH = process.env.RULES_PATH ||
  path.join(__dirname, "..", "rules", "correlacao_cabos_rules.md");

// Estratégia de custo: o modelo RÁPIDO (Haiku, barato) faz a 1ª passada de todo o
// lote; o modelo FORTE (Sonnet) só re-processa os itens que o rápido não resolveu
// (pendência/ambíguo). Assim a maioria sai barata e só os difíceis usam o caro.
const MODELO_RAPIDO = process.env.CLAUDE_MODEL_RAPIDO || "claude-haiku-4-5-20251001";
const MODELO_FORTE  = process.env.CLAUDE_MODEL_FORTE || process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const MODEL = MODELO_FORTE; // compat. com o export

// Instruções de formato anexadas ao system, depois do SKILL (bloco curto, variável).
const INSTRUCOES_SAIDA = `
─────────────────────────────────────────────
FORMATO DE SAÍDA (obrigatório)
Para CADA descrição numerada na mensagem do usuário, aplique as regras acima e
identifique os atributos do cabo/acessório. Você NÃO retorna código — apenas
atributos que permitam a busca determinística na TABELA USO INTERNO.

Responda APENAS com um array JSON (nada antes ou depois), um objeto por descrição:
[{"linha":1,"produto":"<PRODUTO como na coluna I da tabela, ex: AFUMEX GREEN, G7 SUPER EASY>","condutor":"COBRE|ALUMINIO","classe":"<classe de tensão como na tabela, ex: 1kV, 750V, 15kV>","secao":"<seção na notação EXATA da planilha, ex: 3G2,5mm², 120mm², 3x25mm²+16mm²>","cor":"<cor ou null>","embalagem":"<Caixa|Bobina|Carretel|Rolo ou null>","blindagem":"<texto ou null>","confianca":"alta|media|baixa","observacao":"<nota curta ou null>"}]

- Aplique TODAS as regras do SKILL acima — em especial a seção "Regras de calibracao" (condutor Cobre padrão; cor Preto / embalagem Bobina ou Caixa; XLPE→VOLTALENE vs EPR/HEPR→EPRO COMPACT; MT alumínio = "EPRO COMPACT Al"; atox/LSZH→AFUMEX; classe MT pela tensão maior; cobre nu).
- "produto", "condutor", "classe" e "secao" devem casar com as colunas da tabela (notação exata).
- JSON VÁLIDO: NUNCA use aspas duplas (") dentro de um valor de texto (use apóstrofo ' se precisar). Aspas duplas quebram o lote inteiro.
- Mantenha a ordem e o campo "linha" igual ao número da descrição.
- "cor" e "embalagem": só preencha se a descrição DISSER explicitamente. Se a descrição NÃO menciona, deixe null e NÃO presuma o padrão você mesmo — o backend deste sistema aplica os padrões de forma determinística (Preto; Bobina, ou Caixa p/ 750V 2,5-6mm²). Não reduza a confiança por deixar null.
- Se não tiver certeza, use confianca "baixa". NUNCA escreva códigos em "observacao" (o sistema preenche); use observacao só para notas curtas de interpretação.
`.trim();

let _skill = null;
function getSkill() {
  if (_skill == null) _skill = fs.readFileSync(RULES_PATH, "utf-8");
  return _skill;
}

let _client = null;
function getClient() {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY não configurada (crie backend/.env).");
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

// Extrai o array JSON da resposta do modelo, tolerando texto/cercas ao redor.
function parseAtributos(texto) {
  let s = String(texto || "").trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch (e) {
    // O modelo às vezes coloca aspas duplas não escapadas dentro de "observacao",
    // quebrando o JSON do lote inteiro. Recupera extraindo os campos por regex.
    return _extrairAtributosTolerante(s);
  }
}

// Parser tolerante: lê os campos de cada objeto por regex. Ignora "observacao"
// (campo de texto livre, o que costuma trazer aspas e quebrar o JSON).
function _extrairAtributosTolerante(s) {
  const objs = [];
  const blocos = s.match(/\{[^{}]*\}/g) || [];
  for (const b of blocos) {
    const campo = (nome) => {
      const m = b.match(new RegExp('"' + nome + '"\\s*:\\s*"([^"]*)"'));
      return m ? m[1] : null;
    };
    const num = (nome) => {
      const m = b.match(new RegExp('"' + nome + '"\\s*:\\s*(\\d+)'));
      return m ? Number(m[1]) : null;
    };
    objs.push({
      linha: num("linha"),
      produto: campo("produto"),
      condutor: campo("condutor"),
      classe: campo("classe"),
      secao: campo("secao"),
      cor: campo("cor"),
      embalagem: campo("embalagem"),
      blindagem: campo("blindagem"),
      confianca: campo("confianca"),
      observacao: null,
    });
  }
  return objs;
}

// Chama o Claude para um lote de descrições -> array de atributos.
async function interpretarLote(descricoes, modelo) {
  const lista = descricoes.map((d, i) => `${i + 1}. ${d.descricao}`).join("\n");
  const client = getClient();
  const msg = await client.messages.create({
    model: modelo || MODELO_FORTE,
    max_tokens: 16000,
    system: [
      { type: "text", text: getSkill(), cache_control: { type: "ephemeral" } },
      { type: "text", text: INSTRUCOES_SAIDA },
    ],
    messages: [{ role: "user", content: lista }],
  });
  const texto = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return parseAtributos(texto);
}

// Padrões de oferta quando a descrição NÃO especifica (regra de negócio do cliente):
// - cor ausente        -> Preto
// - embalagem ausente  -> Bobina; exceto 750V unipolar de 2,5 a 6mm² -> Caixa
function _embalagemPadrao(classe, secao) {
  const cls = String(classe || "").toUpperCase().replace(/\s+/g, "");
  const sec = String(secao || "").toUpperCase();
  if (cls.includes("750V") && !/[XG]/.test(sec)) { // unipolar (sem "x" nem "G")
    const m = sec.match(/(\d+(?:[.,]\d+)?)/);
    if (m) {
      const v = parseFloat(m[1].replace(",", "."));
      if (v >= 2.5 && v <= 6) return "Caixa";
    }
  }
  return "Bobina";
}

// Resolve UM item: aplica padrões de negócio + lookup determinístico + status.
function _resolverUm(d, a) {
  a = a || {};
  // Padrões quando a descrição não trouxe: condutor -> Cobre; cor -> Preto; embalagem -> regra.
  const condutorUsado = a.condutor || "COBRE";
  const corUsada = a.cor || "Preto";
  const embUsada = a.embalagem || _embalagemPadrao(a.classe, a.secao);

  const r = lookup({
    produto: a.produto, condutor: condutorUsado, classe: a.classe,
    secao: a.secao, cor: corUsada, embalagem: embUsada, blindagem: a.blindagem,
  });
  // Só rebaixa para AMBÍGUO em confiança BAIXA (incerteza real). "média" com match único fica OK.
  let status = r.status;
  if (status === "OK" && a.confianca && /baix/i.test(String(a.confianca))) status = "AMBIGUO";

  const padroes = [];
  if (!a.cor) padroes.push("cor padrão: Preto");
  if (!a.embalagem) padroes.push("embalagem padrão: " + embUsada);
  const partes = [];
  if (r.observacao) partes.push(r.observacao);                       // ex.: "código pela seção…"
  if (status === "OK" && padroes.length) partes.push(padroes.join(" · "));
  const observacao = partes.length ? partes.join(" · ") : (a.observacao || "");

  return {
    linhaOriginal: d.linhaOriginal,
    descricao: d.descricao,
    codigo: r.codigo || "",
    status,
    observacao,
    atributos: { ...a, cor: corUsada, embalagem: embUsada },
  };
}

// Pipeline de um lote em DUAS passadas: modelo rápido (barato) em tudo, depois o
// modelo forte só nos itens que ficaram PENDÊNCIA/AMBÍGUO.
async function processarLote(descricoes) {
  if (!descricoes.length) return [];

  let atributos;
  try {
    atributos = await interpretarLote(descricoes, MODELO_RAPIDO);
  } catch (e) {
    console.warn("[correlacao] modelo rápido falhou, usando o forte:", e.message);
    atributos = await interpretarLote(descricoes, MODELO_FORTE);
  }
  const resultados = descricoes.map((d, i) =>
    _resolverUm(d, atributos.find((x) => Number(x.linha) === i + 1) || atributos[i] || {}));

  // 2ª passada: reprocessa com o modelo forte só o que o rápido não resolveu.
  const refazer = [];
  resultados.forEach((r, i) => { if (r.status === "PENDENCIA" || r.status === "AMBIGUO") refazer.push(i); });
  if (refazer.length && MODELO_FORTE !== MODELO_RAPIDO) {
    try {
      const subset = refazer.map((i) => descricoes[i]);
      const fortes = await interpretarLote(subset, MODELO_FORTE);
      refazer.forEach((origIdx, j) => {
        const a = fortes.find((x) => Number(x.linha) === j + 1) || fortes[j] || {};
        const novo = _resolverUm(descricoes[origIdx], a);
        // Aceita o resultado forte se melhorou (virou OK) ou se o rápido nem tinha código.
        if (novo.status === "OK" || !resultados[origIdx].codigo) resultados[origIdx] = novo;
      });
    } catch (e) {
      console.warn("[correlacao] 2ª passada (modelo forte) falhou:", e.message);
    }
  }
  return resultados;
}

module.exports = { interpretarLote, processarLote, getSkill, MODEL, RULES_PATH };
