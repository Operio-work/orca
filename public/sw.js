// ORCA service worker: caches the app shell, shows phone alerts and
// opens the right agent when one is tapped. /api/* is always live, never cached.
const CACHE = 'operio-orca-shell-v22';
const SHELL = ['/', '/index.html', '/tokens.css', '/style.css', '/theme-boot.js', '/lang-boot.js', '/sound.js', '/app.js', '/chat.js', '/templates.js', '/skills.js', '/agents.js', '/browser-asks.js', '/admin.js', '/kb.js', '/reader.js', '/jtext.js', '/journal.html', '/journal.css', '/journal.js', '/cron.js', '/routines.js', '/demo.js', '/manifest.webmanifest',
  '/fonts/inter-latin-400-normal.woff2', '/fonts/inter-latin-600-normal.woff2',
  '/fonts/jetbrains-mono-latin-400-normal.woff2', '/fonts/jetbrains-mono-latin-600-normal.woff2',
  '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network first, cache fallback.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/healthz') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/index.html')))
  );
});

// ─── Alerts ───────────────────────────────────────────────────────────────────
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(data.title || 'ORCA', {
    body: data.body || '',
    tag: data.tag || 'operio-orca',          // one alert per pane: a newer one replaces the older
    renotify: true,
    requireInteraction: data.kind === 'blocked',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  // Relative to where the panel lives: "/" here, "/c/<client>/panel/" behind ORCA Host.
  const scope = self.registration.scope;
  const url = new URL(String(e.notification.data?.url || '').replace(/^\/+/, ''), scope);
  const pane = decodeURIComponent(url.hash.slice(1));
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins.find(w => w.url.startsWith(scope));
    if (win) {
      await win.focus();
      if (pane.startsWith('chat-')) win.postMessage({ type: 'chat', thread: pane.slice(5) });
      else if (pane) win.postMessage({ type: 'open', pane });
      return;
    }
    await self.clients.openWindow(url.href);
  })());
});
