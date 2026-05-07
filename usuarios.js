const USUARIOS_CRM = [
  // ── Admins ──────────────────────────────────────────────────────
  { email: "fabricio.giacomelli@threear.com.br", nome: "Fabricio Giacomelli", role: "admin" },
  { email: "ronaldo.giacomelli@threear.com.br",  nome: "Ronaldo Giacomelli",  role: "admin" },

  // ── Supervisores ─────────────────────────────────────────────────
  { email: "anderson.kondo@threear.com.br",  nome: "Anderson Kondo",  role: "supervisor" },
  { email: "assis.mentor@threear.com.br",    nome: "Assis Mentor",    role: "supervisor" },
  { email: "ricardo.cruz@threear.com.br",    nome: "Ricardo Cruz",    role: "supervisor" },
  { email: "dennis.borges@threear.com.br",   nome: "Dennis Borges",   role: "supervisor" },
  { email: "leandro.souza@threear.com.br",   nome: "Leandro Souza",   role: "supervisor" },

  // ── Users ────────────────────────────────────────────────────────
  { email: "araujo.souza@threear.com.br",   nome: "Araujo Souza",   role: "user" },
  { email: "cassia.reis@threear.com.br",    nome: "Cassia Reis",    role: "user" },
  { email: "joao.batista@threear.com.br",   nome: "João Batista",   role: "user" },
  { email: "junior.oliveira@threear.com.br",nome: "Junior Oliveira",role: "user" },
  { email: "pedro.santos@threear.com.br",   nome: "Pedro Santos",   role: "user" },
  { email: "renan.naves@threear.com.br",    nome: "Renan Naves",    role: "user" },
  { email: "silvia.sarmento@threear.com.br",nome: "Silvia Sarmento",role: "user" },
];

async function sincronizarUsuariosCRM() {
  if (!window.db) {
    console.error("Firestore não inicializado.");
    return;
  }

  const snap = await window.db.collection("usuarios").get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const batch = window.db.batch();
  let encontrados = 0;
  const naoEncontrados = [];

  for (const regra of USUARIOS_CRM) {
    const emailRegra = String(regra.email || "").toLowerCase().trim();
    const usuario = docs.find(
      (u) => String(u.email || "").toLowerCase().trim() === emailRegra
    );

    if (!usuario) {
      naoEncontrados.push(emailRegra);
      continue;
    }

    // Sincroniza apenas nome e role — podeVerDe é gerenciado pela coleção "equipes"
    batch.set(
      window.db.collection("usuarios").doc(usuario.id),
      {
        email: emailRegra,
        nome: regra.nome,
        role: regra.role,
        atualizadoEm: new Date().toISOString(),
      },
      { merge: true }
    );

    encontrados++;
  }

  await batch.commit();
  console.log(`Cargos sincronizados: ${encontrados} usuários atualizados.`);
  if (naoEncontrados.length) {
    console.warn("E-mails não encontrados:", naoEncontrados);
  }
}
