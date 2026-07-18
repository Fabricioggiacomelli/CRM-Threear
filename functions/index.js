const { onRequest } = require("firebase-functions/v2/https");

const express = require("express");
const helmet = require("helmet");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const rateLimit = require("express-rate-limit");
const admin = require("firebase-admin");

const { registrarRotasMfa } = require("./mfaCore");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Origens permitidas (produção + previews do Firebase Hosting).
const ALLOWED_ORIGINS = [
  "https://crm-three-ar.web.app",
  "https://crm-three-ar.firebaseapp.com",
];

const app = express();
app.use(helmet());
app.use(express.json());

// Rate limit contra brute-force de TOTP. Por instância da função — não é global,
// mas reduz drasticamente a superfície de força-bruta. (Antes: nenhum limite.)
const mfaLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

app.get("/", (_, res) => res.send("OK - Backend TOTP (Firebase Functions)"));

registrarRotasMfa(app, { admin, db, speakeasy, qrcode, limiter: mfaLimiter });

// CORS liberado para qualquer origem. Restringir estava BLOQUEANDO o domínio real de
// produção ("Failed to fetch" no login). Aqui o CORS agrega pouca segurança: os
// endpoints MFA já exigem ID token do Firebase (Authorization) + e-mail conferido +
// rate limit + TOTP, e um site malicioso não consegue o token do usuário para forjar a
// chamada. Para RE-restringir depois, troque `true` por `ALLOWED_ORIGINS` incluindo
// TODOS os domínios reais (inclusive o customizado da empresa).
exports.api = onRequest(
  { region: "southamerica-east1", cors: true },
  app,
);
