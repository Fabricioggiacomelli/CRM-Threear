require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const admin = require("firebase-admin");
const rateLimit = require("express-rate-limit");

const { registrarRotasMfa } = require("../functions/mfaCore");
const correlacaoTabela = require("./correlacao");
const correlacaoApi = require("./correlacao_api");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || [
  "http://127.0.0.1:3001",
  "http://localhost:3001",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://127.0.0.1:5501",
  "http://localhost:5501",
  "https://crm-three-ar.web.app",
  "https://crm-three-ar.firebaseapp.com",
].join(",")).split(",");
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origin === "null" || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error("CORS: origem não permitida"));
  },
  methods: ["GET", "POST"],
}));
app.options("*", cors());
app.use(express.json());

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require("./serviceAccount.json");

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

app.get("/", (_, res) => {
  res.send("OK - Backend TOTP com Firestore rodando");
});

// Rotas MFA — mesma lógica de produção (módulo compartilhado functions/mfaCore.js).
const mfaLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
registrarRotasMfa(app, { admin, db, speakeasy, qrcode, limiter: mfaLimiter });

// ─── Correlação de Cabos Prysmian ──────────────────────────────────────────
// Carrega a TABELA USO INTERNO em memória na inicialização (indexada para lookup).
try {
  const meta = correlacaoTabela.carregarTabela();
  console.log(`✅ TABELA USO INTERNO carregada: ${meta.totalIndexadas} produtos indexados.`);
} catch (e) {
  console.warn("⚠️ TABELA USO INTERNO não carregada:", e.message);
}

app.get("/correlacao/status", (_, res) => {
  res.json({ ok: true, ...correlacaoTabela.getMeta() });
});

app.post("/correlacao/reload", async (_req, res) => {
  try {
    const meta = correlacaoTabela.carregarTabela();
    res.json({ ok: true, meta });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const correlacaoLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
app.post("/correlacao/lote", correlacaoLimiter, async (req, res) => {
  try {
    const descricoes = Array.isArray(req.body.descricoes) ? req.body.descricoes : [];
    if (!descricoes.length) {
      return res.status(400).json({ ok: false, error: "Envie 'descricoes': [{ linhaOriginal, descricao }]" });
    }
    if (descricoes.length > 50) {
      return res.status(400).json({ ok: false, error: "Máximo 50 descrições por lote." });
    }
    const resultados = await correlacaoApi.processarLote(descricoes);
    res.json({ ok: true, resultados });
  } catch (e) {
    console.error("CORRELACAO LOTE ERROR:", e);
    res.status(500).json({ ok: false, error: e.message || "Erro ao processar lote" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend TOTP com Firestore em http://127.0.0.1:${PORT}`);
});
