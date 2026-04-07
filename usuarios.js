const USUARIOS_CRM = [
  {
    email: "fabricio.giacomelli@threear.com.br",
    nome: "Fabricio Giacomelli",
    role: "admin",
    podeVerDe: ["*"]
  },
  {
    email: "ronaldo.giacomelli@threear.com.br",
    nome: "Ronaldo Giacomelli",
    role: "admin",
    podeVerDe: ["*"]
  },

  {
    email: "anderson.kondo@threear.com.br",
    nome: "Anderson Kondo",
    role: "supervisor",
    podeVerDe: [
      "anderson.kondo@threear.com.br",
      "araujo.souza@threear.com.br",
      "cassia.reis@threear.com.br",
      "joao.batista@threear.com.br",
      "pedro.santos@threear.com.br",
      "renan.naves@threear.com.br",
      "silvia.sarmento@threear.com.br"
    ]
  },
  {
    email: "assis.mentor@threear.com.br",
    nome: "Assis Mentor",
    role: "supervisor",
    podeVerDe: [
      "assis.mentor@threear.com.br",
      "araujo.souza@threear.com.br",
      "cassia.reis@threear.com.br",
      "joao.batista@threear.com.br",
      "pedro.santos@threear.com.br",
      "renan.naves@threear.com.br",
      "silvia.sarmento@threear.com.br"
    ]
  },
  {
    email: "ricardo.cruz@threear.com.br",
    nome: "Ricardo Cruz",
    role: "supervisor",
    podeVerDe: [
      "ricardo.cruz@threear.com.br",
      "araujo.souza@threear.com.br",
      "cassia.reis@threear.com.br",
      "joao.batista@threear.com.br",
      "pedro.santos@threear.com.br",
      "renan.naves@threear.com.br",
      "silvia.sarmento@threear.com.br",
      "junior.oliveira@threear.com.br"
    ]
  },

  // supervisores com ações de supervisor, mas vendo só os próprios alertas
  {
    email: "dennis.borges@threear.com.br",
    nome: "Dennis Borges",
    role: "supervisor",
    podeVerDe: ["dennis.borges@threear.com.br"]
  },
  {
    email: "leandro.souza@threear.com.br",
    nome: "Leandro Souza",
    role: "supervisor",
    podeVerDe: ["leandro.souza@threear.com.br"]
  },

  {
    email: "araujo.souza@threear.com.br",
    nome: "Araujo Souza",
    role: "user",
    podeVerDe: ["araujo.souza@threear.com.br"]
  },
  {
    email: "cassia.reis@threear.com.br",
    nome: "Cassia Reis",
    role: "user",
    podeVerDe: ["cassia.reis@threear.com.br"]
  },
  {
    email: "joao.batista@threear.com.br",
    nome: "João Batista",
    role: "user",
    podeVerDe: ["joao.batista@threear.com.br"]
  },
  {
    email: "pedro.santos@threear.com.br",
    nome: "Pedro Santos",
    role: "user",
    podeVerDe: ["pedro.santos@threear.com.br"]
  },
  {
    email: "renan.naves@threear.com.br",
    nome: "Renan Naves",
    role: "user",
    podeVerDe: ["renan.naves@threear.com.br"]
  },
  {
    email: "silvia.sarmento@threear.com.br",
    nome: "Silvia Sarmento",
    role: "user",
    podeVerDe: ["silvia.sarmento@threear.com.br"]
  },
  {
    email: "junior.oliveira@threear.com.br",
    nome: "Junior Oliveira",
    role: "user",
    podeVerDe: ["junior.oliveira@threear.com.br"]
  }
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
  let naoEncontrados = [];

  for (const regra of USUARIOS_CRM) {
    const emailRegra = String(regra.email || "").toLowerCase().trim();

    const usuarioExistente = docs.find(
      (u) => String(u.email || "").toLowerCase().trim() === emailRegra
    );

    if (!usuarioExistente) {
      naoEncontrados.push(emailRegra);
      continue;
    }

    const ref = window.db.collection("usuarios").doc(usuarioExistente.id);

    batch.set(
      ref,
      {
        email: emailRegra,
        nome: regra.nome,
        role: regra.role,
        podeVerDe: (regra.podeVerDe || []).map((e) => String(e).toLowerCase()),
        atualizadoEm: new Date().toISOString()
      },
      { merge: true }
    );

    encontrados++;
  }

  await batch.commit();

  console.log("Cargos sincronizados com sucesso.");
  console.log("Usuários atualizados:", encontrados);

  if (naoEncontrados.length) {
    console.warn("E-mails não encontrados na coleção usuarios:", naoEncontrados);
  }
}