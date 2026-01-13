// index.js
// Backend TOTP (Google Authenticator) com Firestore
// Porta: http://localhost:3001

const express = require("express");
const cors = require("cors");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const admin = require("firebase-admin");

const app = express();
const PORT = process.env.PORT || 3001;

// ===== MIDDLEWARE =====
// CORS liberado para dev (Live Server e etc.)
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options("*", cors());
app.use(express.json());

// ===== FIREBASE ADMIN =====
const serviceAccount = require("./serviceAccount.json");

// evita erro caso reinicie com nodemon etc.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const mfaRef = db.collection("usuarios_mfa");

// ===== HELPERS =====
const normUser = (u) => String(u || "").trim().toLowerCase();
const cleanToken = (t) => String(t || "").replace(/\D/g, "");

function verifyTotp(secret, token) {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 1, // tolerância ~30s antes/depois
  });
}

// ===== HEALTH =====
app.get("/", (_, res) => {
  res.send("OK - Backend TOTP com Firestore rodando");
});

// ===== STATUS =====
// GET /mfa/status?user=email@dominio.com
app.get("/mfa/status", async (req, res) => {
  try {
    const user = normUser(req.query.user);
    if (!user) return res.status(400).json({ ok: false, error: "Informe ?user=..." });

    const snap = await mfaRef.doc(user).get();
    if (!snap.exists) return res.json({ ok: true, enabled: false, hasSecret: false });

    const data = snap.data() || {};
    return res.json({
      ok: true,
      enabled: !!data.mfaEnabled,
      hasSecret: !!data.mfaSecret,
    });
  } catch (e) {
    console.error("STATUS ERROR:", e);
    res.status(500).json({ ok: false, error: "Erro interno" });
  }
});

// ===== GERAR QR CODE =====
// GET /mfa/qr?user=email@dominio.com
app.get("/mfa/qr", async (req, res) => {
  try {
    const user = normUser(req.query.user);
    if (!user) return res.status(400).json({ ok: false, error: "Informe ?user=..." });

    const docRef = mfaRef.doc(user);
    const snap = await docRef.get();

    // Já ativo → não gera outro QR
    if (snap.exists && (snap.data() || {}).mfaEnabled) {
      return res.json({ ok: true, alreadyActive: true });
    }

    let secretBase32 = snap.exists ? (snap.data() || {}).mfaSecret : null;

    // se não tem segredo, cria e salva
    if (!secretBase32) {
      const secret = speakeasy.generateSecret({
        length: 20,
        name: `CRM-ThreeAr (${user})`,
        issuer: "CRM-ThreeAr",
      });

      secretBase32 = secret.base32;

      await docRef.set(
        {
          email: user,
          mfaSecret: secretBase32,
          mfaEnabled: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    const otpauth_url = speakeasy.otpauthURL({
      secret: secretBase32,
      label: `CRM-ThreeAr:${user}`,
      issuer: "CRM-ThreeAr",
      encoding: "base32",
    });

    const qrDataUrl = await QRCode.toDataURL(otpauth_url, { width: 240, margin: 1 });

    res.json({ ok: true, user, qrDataUrl });
  } catch (e) {
    console.error("QR ERROR:", e);
    res.status(500).json({ ok: false, error: "Erro ao gerar QR" });
  }
});

// ===== ATIVAR TOTP =====
// POST /mfa/activate  body: { user, token }
app.post("/mfa/activate", async (req, res) => {
  try {
    const user = normUser(req.body.user);
    const token = cleanToken(req.body.token);

    if (!user || token.length !== 6) {
      return res.status(400).json({ ok: false, error: "User/token inválidos" });
    }

    const docRef = mfaRef.doc(user);
    const snap = await docRef.get();

    if (!snap.exists || !(snap.data() || {}).mfaSecret) {
      return res.status(400).json({ ok: false, error: "QR não gerado" });
    }

    const { mfaSecret } = snap.data();
    const valid = verifyTotp(mfaSecret, token);

    if (!valid) return res.status(401).json({ ok: false, error: "Código inválido" });

    await docRef.set(
      {
        mfaEnabled: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.json({ ok: true, activated: true });
  } catch (e) {
    console.error("ACTIVATE ERROR:", e);
    res.status(500).json({ ok: false, error: "Erro interno" });
  }
});

// ===== VALIDAR LOGIN =====
// POST /mfa/verify body: { user, token }
app.post("/mfa/verify", async (req, res) => {
  try {
    const user = normUser(req.body.user);
    const token = cleanToken(req.body.token);

    if (!user || token.length !== 6) {
      return res.status(400).json({ ok: false, error: "User/token inválidos" });
    }

    const snap = await mfaRef.doc(user).get();
    if (!snap.exists || !(snap.data() || {}).mfaEnabled) {
      return res.status(403).json({ ok: false, error: "2FA não ativo" });
    }

    const valid = verifyTotp((snap.data() || {}).mfaSecret, token);
    if (!valid) return res.status(401).json({ ok: false, error: "Código inválido" });

    res.json({ ok: true, verified: true });
  } catch (e) {
    console.error("VERIFY ERROR:", e);
    res.status(500).json({ ok: false, error: "Erro interno" });
  }
});

// ===== START =====
app.listen(PORT, () => {
  console.log(`✅ Backend TOTP com Firestore em http://127.0.0.1:${PORT}`);
});
