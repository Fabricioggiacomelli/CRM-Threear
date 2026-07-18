"use strict";

// ============================================================================
// Núcleo COMPARTILHADO do MFA (TOTP).
// Usado por:
//   - backend/index.js       (dev local, Express)   -> require("../functions/mfaCore")
//   - functions/index.js     (produção, Functions)  -> require("./mfaCore")
//
// Mantém UMA fonte de verdade para enrollment, verificação e emissão do claim
// de sessão MFA. As dependências (admin, db, speakeasy, qrcode, limiter) são
// INJETADAS pelo chamador — assim cada backend resolve os pacotes do seu próprio
// node_modules e não há duplicação de lógica entre os dois ambientes.
// ============================================================================

// Janela de validade do "fator MFA" carregado no token (claim `mfaExp`, em ms epoch).
// Depois desse prazo o usuário precisa refazer o TOTP. Bounda a exposição de uma
// senha vazada: sem um TOTP recente, o token não passa nas regras do Firestore.
const MFA_TTL_MS = 12 * 60 * 60 * 1000; // 12h

const normUser = (u) => String(u || "").trim().toLowerCase();
const cleanToken = (t) => String(t || "").replace(/\D/g, "");

// Registra as rotas /mfa/* num app Express, com as dependências injetadas.
// deps = { admin, db, speakeasy, qrcode, limiter? }
function registrarRotasMfa(app, deps) {
  const { admin, db, speakeasy, qrcode } = deps;
  const mfaRef = db.collection("usuarios_mfa");
  const limiter = deps.limiter || ((_req, _res, next) => next()); // no-op se não passar

  const verifyTotp = (secret, token) =>
    speakeasy.totp.verify({ secret, encoding: "base32", token, window: 1 });

  // Valida o ID token do Firebase (header "Authorization: Bearer <token>" ou body.idToken).
  // Retorna o token decodificado; em falha responde 401 e retorna null.
  async function autenticar(req, res) {
    const h = String(req.headers.authorization || "");
    const m = h.match(/^Bearer\s+(.+)$/i);
    const idToken = m ? m[1] : (req.body && req.body.idToken) || null;
    if (!idToken) {
      res.status(401).json({ ok: false, error: "Autenticação necessária" });
      return null;
    }
    try {
      return await admin.auth().verifyIdToken(idToken);
    } catch {
      res.status(401).json({ ok: false, error: "Token de autenticação inválido" });
      return null;
    }
  }

  // (Re)emite os custom claims do usuário. setCustomUserClaims SUBSTITUI todos os
  // claims, então relemos role/aprovado/ativo do doc `usuarios` para preservá-los.
  // mfa=true carimba `mfaExp = agora + TTL`; mfa=false zera (usado no reset).
  async function emitirClaims(email, mfa) {
    const userRecord = await admin.auth().getUserByEmail(email);
    const snap = await db.collection("usuarios").where("email", "==", email).limit(1).get();
    const ud = snap.empty ? {} : (snap.docs[0].data() || {});
    const claims = {
      role: ud.role || "user",
      aprovado: ud.aprovado === true,
      ativo: ud.ativo !== false,
      mfa: mfa === true,
      mfaExp: mfa === true ? Date.now() + MFA_TTL_MS : 0,
    };
    await admin.auth().setCustomUserClaims(userRecord.uid, claims);
    return claims;
  }

  // ── Status (público — só revela booleans; usado antes do login) ──────────
  app.get("/mfa/status", async (req, res) => {
    try {
      const user = normUser(req.query.user);
      if (!user) return res.status(400).json({ ok: false, error: "Informe ?user=..." });
      const snap = await mfaRef.doc(user).get();
      if (!snap.exists) return res.json({ ok: true, enabled: false, hasSecret: false });
      const data = snap.data() || {};
      return res.json({ ok: true, enabled: !!data.mfaEnabled, hasSecret: !!data.mfaSecret });
    } catch (e) {
      console.error("STATUS ERROR:", e && e.message);
      res.status(500).json({ ok: false, error: "Erro interno" });
    }
  });

  // ── QR / enrollment (AUTENTICADO: só o dono do e-mail gera o próprio QR) ──
  app.get("/mfa/qr", async (req, res) => {
    try {
      const decoded = await autenticar(req, res);
      if (!decoded) return;
      const user = normUser(req.query.user);
      if (!user) return res.status(400).json({ ok: false, error: "Informe ?user=..." });
      if (normUser(decoded.email) !== user) {
        return res.status(403).json({ ok: false, error: "Só é possível configurar o próprio 2FA." });
      }

      const docRef = mfaRef.doc(user);
      const snap = await docRef.get();

      if (snap.exists && (snap.data() || {}).mfaEnabled) {
        return res.json({ ok: true, alreadyActive: true });
      }

      let secretBase32 = snap.exists ? (snap.data() || {}).mfaSecret : null;
      if (!secretBase32) {
        const secret = speakeasy.generateSecret({ length: 20, name: `CRM-ThreeAr (${user})`, issuer: "CRM-ThreeAr" });
        secretBase32 = secret.base32;
        await docRef.set(
          { email: user, mfaSecret: secretBase32, mfaEnabled: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true },
        );
      }

      const otpauth_url = speakeasy.otpauthURL({ secret: secretBase32, label: `CRM-ThreeAr:${user}`, issuer: "CRM-ThreeAr", encoding: "base32" });
      const qrDataUrl = await qrcode.toDataURL(otpauth_url, { width: 240, margin: 1 });
      res.json({ ok: true, user, qrDataUrl });
    } catch (e) {
      console.error("QR ERROR:", e && e.message);
      res.status(500).json({ ok: false, error: "Erro ao gerar QR" });
    }
  });

  // ── Ativação (AUTENTICADO + rate limit): valida TOTP e emite claim mfa ────
  app.post("/mfa/activate", limiter, async (req, res) => {
    try {
      const decoded = await autenticar(req, res);
      if (!decoded) return;
      const user = normUser(req.body.user);
      const token = cleanToken(req.body.token);
      if (!user || token.length !== 6) return res.status(400).json({ ok: false, error: "User/token inválidos" });
      if (normUser(decoded.email) !== user) {
        return res.status(403).json({ ok: false, error: "Só é possível ativar o próprio 2FA." });
      }

      const docRef = mfaRef.doc(user);
      const snap = await docRef.get();
      if (!snap.exists || !(snap.data() || {}).mfaSecret) {
        return res.status(400).json({ ok: false, error: "QR não gerado" });
      }
      if (!verifyTotp(snap.data().mfaSecret, token)) {
        return res.status(401).json({ ok: false, error: "Código inválido" });
      }

      await docRef.set({ mfaEnabled: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      await emitirClaims(user, true); // ativação prova posse do segredo → carimba o fator MFA
      res.json({ ok: true, activated: true });
    } catch (e) {
      console.error("ACTIVATE ERROR:", e && e.message);
      res.status(500).json({ ok: false, error: "Erro interno" });
    }
  });

  // ── Verificação (AUTENTICADO + rate limit): emite claim mfa da sessão ─────
  app.post("/mfa/verify", limiter, async (req, res) => {
    try {
      const decoded = await autenticar(req, res);
      if (!decoded) return;
      const user = normUser(req.body.user);
      const token = cleanToken(req.body.token);
      if (!user || token.length !== 6) return res.status(400).json({ ok: false, error: "User/token inválidos" });
      if (normUser(decoded.email) !== user) {
        return res.status(403).json({ ok: false, error: "Token não corresponde ao usuário." });
      }

      const snap = await mfaRef.doc(user).get();
      if (!snap.exists || !(snap.data() || {}).mfaEnabled) {
        return res.status(403).json({ ok: false, error: "2FA não ativo" });
      }
      if (!verifyTotp((snap.data() || {}).mfaSecret, token)) {
        return res.status(401).json({ ok: false, error: "Código inválido" });
      }

      await emitirClaims(user, true);
      res.json({ ok: true, verified: true });
    } catch (e) {
      console.error("VERIFY ERROR:", e && e.message);
      res.status(500).json({ ok: false, error: "Erro interno" });
    }
  });

  // ── Reset (ADMIN): desativa o 2FA de um usuário e limpa o claim mfa ───────
  app.post("/mfa/reset", limiter, async (req, res) => {
    try {
      const decoded = await autenticar(req, res);
      if (!decoded) return;

      const adminSnap = await db.collection("usuarios").where("email", "==", decoded.email).limit(1).get();
      if (adminSnap.empty || (adminSnap.docs[0].data() || {}).role !== "admin") {
        return res.status(403).json({ ok: false, error: "Apenas administradores podem resetar 2FA" });
      }

      const user = normUser(req.body.user);
      if (!user) return res.status(400).json({ ok: false, error: "Informe o usuário alvo" });

      const docRef = mfaRef.doc(user);
      const snap = await docRef.get();
      if (snap.exists) {
        await docRef.update({
          mfaEnabled: false,
          mfaSecret: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          resetBy: decoded.email,
        });
      }
      try { await emitirClaims(user, false); } catch (_) { /* usuário pode não existir no Auth */ }
      res.json({ ok: true, reset: true });
    } catch (e) {
      console.error("RESET MFA ERROR:", e && e.message);
      res.status(500).json({ ok: false, error: "Erro interno" });
    }
  });
}

module.exports = { MFA_TTL_MS, normUser, cleanToken, registrarRotasMfa };
