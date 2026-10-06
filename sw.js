// Ko'cha Qiroli — saytdan (masalan, GitHub Pages) bir marta ochilgandan keyin internetsiz ishlashi uchun kesh.
// Fayllar ro'yxatini tools/build-offline.mjs yangilaydi.
const CACHE = 'kocha-qiroli-281ec263';
const FILES = ["./","index.html","manifest.webmanifest","icons/icon-180.png","icons/icon-192.png","icons/icon-512.png","lib/fonts.css","lib/three.min.js","lib/GLTFLoader.js","lib/meshopt_decoder.js","models/gls.js","models/charger.js","models/police.js","models/person.js","models/cobalt.js","models/gentra.js","models/nexia.js","models/spark.js","models/lacetti.js","models/malibu.js","models/damas.js","models/bus.js","models/moto.js","models/timur.js","js/core.js","js/world.js","js/landmarks.js","js/weather.js","js/radio.js","js/cars.js","js/models.js","js/vehicles.js","js/cockpit.js","js/people.js","js/fx.js","js/hud.js","js/missions.js","js/shop.js","js/touch.js","js/progress.js","js/settings.js","js/mapui.js","js/taxi.js","js/garage.js","js/police.js","lib/qrcode.js","lib/jsQR.js","js/net.js","js/multiplayer.js","js/game.js","js/loop.js"];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Avval keshdan beramiz (tez va internetsiz), orqada esa yangilab qo'yamiz
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => {
    const net = fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => hit);
    return hit || net;
  }));
});
