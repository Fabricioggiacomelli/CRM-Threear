const express = require("express");
const cors = require("cors");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const admin = require("firebase-admin");

const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3001;

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

const mfaLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require("./serviceAccount.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const mfaRef = db.collection("usuarios_mfa");

const normUser = (u) =>
  String(u || "")
    .trim()
    .toLowerCase();
const cleanToken = (t) => String(t || "").replace(/\D/g, "");

function verifyTotp(secret, token) {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 1,
  });
}

app.get("/", (_, res) => {
  res.send("OK - Backend TOTP com Firestore rodando");
});

app.get("/mfa/status", async (req, res) => {
  try {
    const user = normUser(req.query.user);
    if (!user)
      return res.status(400).json({ ok: false, error: "Informe ?user=..." });

    const snap = await mfaRef.doc(user).get();
    if (!snap.exists)
      return res.json({ ok: true, enabled: false, hasSecret: false });

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

app.get("/mfa/qr", async (req, res) => {
  try {
    const user = normUser(req.query.user);
    if (!user)
      return res.status(400).json({ ok: false, error: "Informe ?user=..." });

    const docRef = mfaRef.doc(user);
    const snap = await docRef.get();

    if (snap.exists && (snap.data() || {}).mfaEnabled) {
      return res.json({ ok: true, message: "Se o usuário existir, o QR foi gerado." });
    }

    let secretBase32 = snap.exists ? (snap.data() || {}).mfaSecret : null;

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
        { merge: true },
      );
    }

    const otpauth_url = speakeasy.otpauthURL({
      secret: secretBase32,
      label: `CRM-ThreeAr:${user}`,
      issuer: "CRM-ThreeAr",
      encoding: "base32",
    });

    const qrDataUrl = await QRCode.toDataURL(otpauth_url, {
      width: 240,
      margin: 1,
    });

    res.json({ ok: true, user, qrDataUrl });
  } catch (e) {
    console.error("QR ERROR:", e);
    res.status(500).json({ ok: false, error: "Erro ao gerar QR" });
  }
});

app.post("/mfa/activate", mfaLimiter, async (req, res) => {
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

    if (!valid)
      return res.status(401).json({ ok: false, error: "Código inválido" });

    await docRef.set(
      {
        mfaEnabled: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    res.json({ ok: true, activated: true });
  } catch (e) {
    console.error("ACTIVATE ERROR:", e);
    res.status(500).json({ ok: false, error: "Erro interno" });
  }
});

app.post("/mfa/verify", mfaLimiter, async (req, res) => {
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
    if (!valid)
      return res.status(401).json({ ok: false, error: "Código inválido" });

    // Setar Custom Claims para que o token carregue role/status nas próximas sessões
    try {
      const userRecord = await admin.auth().getUserByEmail(user);
      const usuarioSnap = await db.collection("usuarios")
        .where("email", "==", user).limit(1).get();

      if (!usuarioSnap.empty) {
        const ud = usuarioSnap.docs[0].data();
        await admin.auth().setCustomUserClaims(userRecord.uid, {
          role: ud.role || "user",
          aprovado: ud.aprovado === true,
          ativo: ud.ativo !== false,
        });
      }
    } catch (claimsErr) {
      console.warn("setCustomUserClaims falhou (não fatal):", claimsErr.message);
    }

    res.json({ ok: true, verified: true });
  } catch (e) {
    console.error("VERIFY ERROR:", e);
    res.status(500).json({ ok: false, error: "Erro interno" });
  }
});

app.post("/mfa/reset", mfaLimiter, async (req, res) => {
  try {
    const user = normUser(req.body.user);
    const adminToken = String(req.body.adminToken || "").trim();

    if (!user || !adminToken) {
      return res.status(400).json({ ok: false, error: "user e adminToken são obrigatórios" });
    }

    // Verifica o token Firebase do solicitante
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(adminToken);
    } catch {
      return res.status(401).json({ ok: false, error: "Token de autenticação inválido" });
    }

    // Confirma que o solicitante é admin no Firestore
    const adminSnap = await db.collection("usuarios")
      .where("email", "==", decoded.email)
      .limit(1)
      .get();

    if (adminSnap.empty || (adminSnap.docs[0].data() || {}).role !== "admin") {
      return res.status(403).json({ ok: false, error: "Apenas administradores podem resetar 2FA" });
    }

    const docRef = mfaRef.doc(user);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.json({ ok: true, message: "Usuário não possuía 2FA configurado" });
    }

    await docRef.update({
      mfaEnabled: false,
      mfaSecret: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      resetBy: decoded.email,
    });

    res.json({ ok: true, reset: true });
  } catch (e) {
    console.error("RESET MFA ERROR:", e);
    res.status(500).json({ ok: false, error: "Erro interno" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend TOTP com Firestore em http://127.0.0.1:${PORT}`);
});
