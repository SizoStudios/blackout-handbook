const V = 'bh-v28'; // bump on every release so installed copies refresh
const FILES = ['./', 'style.css', 'app.js', 'map.js', 'route.js', 'meds.js', 'ency.js', 'medical/medicines.js', 'medical/conditions.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png',
  'content/00-core.js', 'content/01-security.js', 'content/02-water-air.js', 'content/03-food-shelter.js', 'content/04-health.js',
  'content/05-tech.js', 'content/06-chem-storage.js', 'content/07-nature.js', 'content/08-weapons-ordnance.js', 'content/09-community.js', 'content/10-more.js', 'content/phrases.js'];

// Chrome refuses to show a cached response that came from a redirect, so store a clean copy.
const clean = r => r.redirected ? new Response(r.body, { status: r.status, statusText: r.statusText, headers: r.headers }) : r;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    await Promise.all(FILES.map(async f => {
      const res = await fetch(f, { cache: 'reload' });
      if (!res.ok) throw new Error('cache failed: ' + f);
      await c.put(f, clean(res));
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== V).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith((async () => {
    const c = await caches.open(V);
    if (req.mode === 'navigate') { const page = await c.match('./'); if (page) return page; }
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && new URL(req.url).origin === location.origin) c.put(req, clean(res.clone()));
      return res;
    } catch (err) {
      return (await c.match('./')) || Response.error();
    }
  })());
});
