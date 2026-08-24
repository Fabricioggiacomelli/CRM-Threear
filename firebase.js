const firebaseConfig = {
  apiKey: "AIzaSyCyjpwTht572LFot2sqqi-83yOgp000POQ",
  authDomain: "crm-three-ar.firebaseapp.com",
  projectId: "crm-three-ar",
  storageBucket: "crm-three-ar.appspot.com",
  messagingSenderId: "261822606732",
  appId: "1:261822606732:web:f6331eee541477af2fbaa9",
  measurementId: "G-3BLVZMFGP2",
};
firebase.initializeApp(firebaseConfig);

// ─── Firebase App Check ──────────────────────────────────────────────────────
// Protege Firestore/Functions contra uso da apiKey pública FORA do app (scripts,
// Postman). Para ATIVAR: no console do Firebase → App Check → registre o app com
// reCAPTCHA v3, copie a "site key" e cole abaixo. Vazio = desativado (nada quebra).
// Depois de testar, marque "Enforce" no console para exigir o token.
const APP_CHECK_SITE_KEY = ""; // TODO: colar a reCAPTCHA v3 site key
if (APP_CHECK_SITE_KEY && typeof firebase.appCheck === "function") {
  try {
    firebase.appCheck().activate(APP_CHECK_SITE_KEY, /* autoRefresh */ true);
  } catch (e) {
    console.warn("App Check não ativado:", e && e.message);
  }
}

window.db = firebase.firestore();

// Cache local (IndexedDB). Precisa vir ANTES de qualquer leitura.
// Na primeira vez os dados vêm da rede; nas seguintes saem do disco do próprio
// aparelho — é o que faz o app reabrir rápido em vez de rebaixar tudo de novo.
// Falha silenciosa de propósito: sem cache o app funciona igual, só mais lento.
window.db.enablePersistence({ synchronizeTabs: true }).catch((e) => {
  console.warn("Cache local do Firestore indisponível:", e && e.code);
});
window.auth = firebase.auth();
