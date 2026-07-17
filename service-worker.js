// アプリシェルをキャッシュしてオフライン起動を可能にする。API 呼び出しと config.json はキャッシュしない。
const CACHE = "chat-playground-v2";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./styles/theme.css", "./app.config.js",
  "./src/ui/app.js", "./src/ui/sidebar.js", "./src/ui/onboarding-view.js", "./src/ui/toast.js", "./src/ui/chat-view.js", "./src/ui/settings-view.js",
  "./src/ui/system-prompts-view.js", "./src/ui/artifacts-view.js", "./src/ui/markdown.js",
  "./src/core/config.js", "./src/core/runtime-config.js", "./src/core/schema.js",
  "./src/core/crypto.js", "./src/core/store.js",
  "./src/storage/storage-interface.js", "./src/storage/local-adapter.js", "./src/storage/gdrive-adapter.js",
  "./src/providers/provider-client.js", "./src/guardrails/guardrail.js",
  "./icons/icon-192.png", "./icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET") return;                // API POST 等は素通し
  if (url.origin !== self.location.origin) return; // 外部（プロバイダ/Google）は素通し
  if (url.pathname.endsWith("/config.json")) return;

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => hit))
  );
});
