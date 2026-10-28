// Service worker: permite instalar o Dias como aplicativo e abre a tela
// mesmo enquanto o servidor ainda está iniciando. A API nunca é guardada.
const CACHE = "dias-v1";
const ARQUIVOS = ["/", "/index.html", "/style.css", "/app.js", "/manifest.webmanifest", "/icone.svg", "/icone-192.png"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);
  if (evento.request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  // Rede primeiro (sempre a versão mais nova); cache se o servidor não responder.
  evento.respondWith(
    fetch(evento.request)
      .then((resposta) => {
        const copia = resposta.clone();
        caches.open(CACHE).then((c) => c.put(evento.request, copia));
        return resposta;
      })
      .catch(() => caches.match(evento.request))
  );
});
