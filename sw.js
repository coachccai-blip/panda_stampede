// Service worker — rend le jeu installable (« Ajouter à l'écran d'accueil »
// avec une vraie invite d'installation sur Android) et jouable hors-ligne.
//
// Stratégie : réseau d'abord, cache en secours. On reste ainsi toujours à jour
// quand il y a du réseau, et le jeu se lance quand même sans. La version dans
// le nom du cache force la purge des anciens fichiers à chaque déploiement.

const VERSION = 'panda-stampede-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './vendor/phaser.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
