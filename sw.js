// ============================================================================
// Service worker do CRM — necessário para o app ser "instalável" na tela inicial.
//
// ESTRATÉGIA: REDE PRIMEIRO (network-first), de propósito.
// O cache serve APENAS como reserva para quando não há internet. Assim o app
// nunca fica preso numa versão antiga — que é a armadilha clássica de PWA
// (e um problema que já enfrentamos neste projeto com o cache do navegador).
// ============================================================================

const CACHE = "crm-three-ar-v1";

self.addEventListener("install", () => {
  self.skipWaiting(); // ativa a versão nova imediatamente
});

self.addEventListener("activate", (evt) => {
  evt.waitUntil(
    (async () => {
      // Remove caches de versões anteriores
      const nomes = await caches.keys();
      await Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (evt) => {
  const req = evt.request;

  // Só intercepta leitura de arquivos do próprio site. Firebase, Google Fonts e
  // CDNs passam direto — o service worker não pode atrapalhar login nem dados.
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  evt.respondWith(
    (async () => {
      try {
        const resp = await fetch(req);
        if (resp && resp.ok && resp.type === "basic") {
          const cache = await caches.open(CACHE);
          cache.put(req, resp.clone()); // guarda só como reserva
        }
        return resp;
      } catch (err) {
        // Sem internet: devolve a última versão conhecida, se houver
        const cached = await caches.match(req);
        if (cached) return cached;
        throw err;
      }
    })(),
  );
});
