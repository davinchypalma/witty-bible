// Witty Bible as a web app (iPhone Home Screen, or any browser): keeps the app's files on the device so it opens and
// searches with no connection, like the Windows and Android apps. Only the web app has this file: the Windows program
// and the Android app carry their files inside them. tools/build_app.py fills in the version and the list of files.
const VERSION = "1.5.0";
const FILES = {"data/alias-theme.json":"f4f15b69428dd7062300339f358a962dac27198a3bedc9d522c251515146dc75","data/bsb.json":"10df94035191854e402bc74ae47593d5138a3d013fa6949c4ad26ab714785ffe","data/cra.json":"b72e2adfa17d8a1b7a874a934cb6d70fea749785dfd704f47bf2f9b59e438c03","data/dby.json":"c6e4caacd701724605c070564253e197245fc856dc769c9d01749fbb11ead3e7","data/emb-alias.bin":"18bac83f7d6b68b9cc317e04aacc0f8e6628f1a6406037620ede22c787b33566","data/emb-bsb.bin":"b89d433878b9af3040a7947667480a73ae2126039dacec90dcb0034d810ef169","data/emb-extra.bin":"9e798be1098e38dc15937739b4df2f071025740246dde66e6bb72fa5ccfa54ff","data/emb-head.bin":"06e135cf96f4b0fe39e66958b393863ab0e2025793f95403db0fe45c1d208cbc","data/emb-kjv.bin":"f0e71f7cc19198ebfb4daf400933e8a6df8c1acd92b03fceb25987dd065a5dc3","data/emb-lsg.bin":"fb3aa55fe6a9133f5cb7074f06f71c4f957ed4dd64386a81f7b5fc99888315ae","data/emb-rv1909.bin":"aacc0e21fa70667a662af26a15b5ed92996ef5665ad540fb88472e9798cba25d","data/emb-seg.bin":"fc32d1065adb68bdb825c3a711c492d73788b3bde030dc3e2d2cb8e39873e605","data/emb-topic.bin":"6f71e93e148b68d4434a01251d57ac54bbe969341bb1aff49fd7027e0277c9ae","data/extra.json":"63703bf09f611f93b57c265c679f941ffcd9b11945343f6c627a6ff07c323e53","data/heads-index.json":"587f244f462a0bcdd254006db2dec59c2e67d524aa1d695ff4886b3ab3609e9b","data/jnd.json":"6a56ca988392fff070c418e97fc55e3e28662f1312831e635cd5df517509b799","data/kjv.json":"48cef4af7d79cc412333defcb7e39d7372caccc98cf1a86a496ff9b27df41d56","data/lsg.json":"7c1a3516ba07cb294cec83fe360e249ef7edc3c874f6280de467cedb537488bc","data/mar.json":"c19883f4d8703c7ca96b235f079af6ec2d499edc2b6736f473d8d9e05112f9f4","data/meta.json":"6201405ab5b99d5598894780b2a4df8b39b39e72d34209525e896c0aed8bfe86","data/model.onnx":"1db1d2be78cfa242a9bf23915559d80cced9b4b4bd85223262c9150c5db06439","data/nheb.json":"534a8250edd72526c10b95c78fba4e7a3e8c6b7a60e0f540762974ea275d2c9c","data/pgr.json":"c4f77dcfc45fe6dbd8aab9a4be79963715a26082143780209e8ec5cdbdf7d2f9","data/pop.bin":"a067ffe9a23047a57cc894f2fdecf498d10a3d180856b814531f06821ff71a44","data/rv1865.json":"568155bd09c610cb6582f8c3ee8849c2cf9940cebd78d18845bded0260a6b46e","data/rv1909.json":"f6ddaeb68ac115de5cbcd7970b77b32d307c3c89cf66f042e4b9e511a7394e9e","data/seg-verse.bin":"12e4173b74451cd83ec680b8db4d705c8a2031d4daef86db50bef8375a10b68c","data/strongs.json":"1bb651b6c0af3eea1ce3e418e72d27ac3740ca5743862e359c47bbadf5287db4","data/themes.json":"80a8d373acdb8989c368cf45c319bc5b90cfa15d1ae12e147d7c9579c65dc874","data/topics.json":"1c7a232af621b586db8a4dd48461e5ffd67bf9947c82f5fb15535cc1ce05293d","data/ukjv.json":"737228f3f9c58a2e6fad45058ad0a219c2f1d50c46b6c27235dbf87fff329c66","data/vocab.bin":"eca09036f9daddc2dbf1a5017dee3cbb5cbea2bc381665b3186f020cfed10c6b","data/words-es.bin":"c75114fdf915f800cec3e04d290494c462d92f7755eca25d770a6edb8dddfc20","data/words.bin":"72fb3089dbfcaba83351266190cd8cd1651abec78a3600bc3a9a7e72fae36908","data/xrefs.bin":"96155834dfdc1402403b2f12ebca7bf0bde86475c939fddb097758034ebe8202","engine/refs.js":"a4ade75ff7214df200cec4a2cf9cf436528ad41e3c21fdcf7fd2e80d08366b66","engine/search.js":"be9fe2bf1de6cb5a97ca3fc9c1930ba0a67889384d915d1b3a15847b757a1809","engine/themes.js":"8c35faa7dc029edf18287a564b9f05b9567b8f375df525d615ffa889f311168b","engine/tokenizer.js":"f67980c4dff5fe59ac78e5c2c7ead062225b6670d9f00ccf8178896779c4e80c","engine/worker.js":"65a011db1570b79b45149101002dfc220ea43232fff943207df65366027f1680","fonts/figtree-latin-400-normal.woff2":"8f98dd642986f1fa39c45b89665a57372897c235b36028e0e4a136e43dc5f8ab","fonts/figtree-latin-500-normal.woff2":"953a6a4294b1205a1b4d4b9e5529478e8c9e1c5a67a9aa24a551414cd85b6f51","fonts/figtree-latin-600-normal.woff2":"367d713287918784702563518f59239989da815c80d3c7337686b9816635a08b","fonts/figtree-latin-700-normal.woff2":"7ec4f08d09f91d349917dd6592f6aaae66d8fe1bbd58fa24707961e79236616e","fonts/figtree-latin-ext-400-normal.woff2":"3f58126100ed4da09c54adcfb8fa9f642be69101d1e18dc4c0a5489ee9b904c5","fonts/poppins-latin-500-normal.woff2":"cd36de204aca2d5fa263a731f7c20009b5e3d754ba1f1e03c33e93a48f3e7446","fonts/poppins-latin-600-normal.woff2":"f4e80d9dfd374d02989b87a27b5ed4cb78fbb177c27f1478e9a8b0afb7513149","fonts/poppins-latin-700-normal.woff2":"9338e65fc077355c7a87ae0d64cc101e23b9bf8ad78ae65f0f319c857311b526","fonts/source-serif-4-latin-400-italic.woff2":"882b7c150c29f29d4f8daae6b8dcae8662aac7f28ca34b34615305154136ecfd","fonts/source-serif-4-latin-400-normal.woff2":"02194deb92d3975dd30e11a3824a1f1db32b48c93654e60560cb81ce8e7b5f95","fonts/source-serif-4-latin-600-normal.woff2":"f2b7e1cf1d277b7608231868135648f8ad8e2b58d8e97ca088bee15dc357bee7","fonts/source-serif-4-latin-ext-400-normal.woff2":"78ff74ea29d0cc5594ff9efd5c0a30911691b89e9021e7bcf118b95e285e007f","host.js":"1b1036ab05294ebdefbf7ba1c06c6fb4523948c84582000a6db25c61aa193f41","i18n.js":"e9e365bc6a55c9d2daceebe96b07cc324e9052ed11742948d9de58c848d6bfb5","icons/apple-touch-icon.png":"79ae5743621b6c8eb559cb39e972f996665ddd8812af55681f6fd4e713546eb0","icons/icon-192.png":"8dc312d921b74e5b6dfae5b2e8eb3bbdaf0f42051a4220dce1b25096477474e8","icons/icon-512.png":"538e9ae8340a5e4d02d13e00de31fa1addf6bdfcf75d6f30f37abe313a0416d1","icons/icon.svg":"177b5c9b49b96001e3cbcf8b468affb00c07d689886b699b4ff00db28ae99cb9","icons/maskable-512.png":"4624fdc9c3a7be646ea798bd3ad8404ec1c0b5bc3ff044bcd6c3e78ca5549203","index.html":"a25968b9e7ec1354f7612075978daa721f6163604bb212eb6ac9f1559347105f","main.js":"c36479a029b846a1dc17244f46baf712a7b489e18a4a73cfbff224d7be2156da","manifest.webmanifest":"a819808824a3ec353e61b26a73c714a277cfb894761d6860114ecb3f52132f46","ort/ort-wasm-simd-threaded.mjs":"30ed0b5cd1182ede931fea448afb567d4dc705ec957af09f108a2be5f770dac3","ort/ort-wasm-simd-threaded.wasm":"4b884c203b0fa48d057be3332c65513ff85aa3c5bddd6946acc0fab7ecda001d","ort/ort.wasm.min.mjs":"c21d9c326d453a4a61398270c804d5979e118540597cb0c07f7b3d64e6098234","pwa.js":"881464925ae15d2faeab27a1af23fd09fa3513ce8d88e5c96ba4724522d1d577","style.css":"1a3d3d6accacd4ce5328b6160445c901dea11aad1dbeeaa902badd52330b10a8","version.js":"4590f1f30d0c7cd572840cb918f1a17ab5d66a2b45cf43a43b5037db141a7eb9","files.json":"fa5e10c3c51271d4acce5da47dce897881e6d3d3851ea2084196799f306a6880"};            // every file of the app → its SHA-256 (a file is kept only if it matches)
const SHELL = ["engine/refs.js","engine/search.js","engine/themes.js","engine/tokenizer.js","engine/worker.js","files.json","fonts/figtree-latin-400-normal.woff2","fonts/figtree-latin-500-normal.woff2","fonts/figtree-latin-600-normal.woff2","fonts/figtree-latin-700-normal.woff2","fonts/figtree-latin-ext-400-normal.woff2","fonts/poppins-latin-500-normal.woff2","fonts/poppins-latin-600-normal.woff2","fonts/poppins-latin-700-normal.woff2","fonts/source-serif-4-latin-400-italic.woff2","fonts/source-serif-4-latin-400-normal.woff2","fonts/source-serif-4-latin-600-normal.woff2","fonts/source-serif-4-latin-ext-400-normal.woff2","host.js","i18n.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","main.js","manifest.webmanifest","pwa.js","style.css","version.js"];            // what the app needs to open: kept at once; the rest is kept as it is used, or all
                                    // together when the app asks for it (the app on the Home Screen does, by itself)
const CACHE = 'witty-bible-' + VERSION;
const BASE = new URL('./', self.location).href;
const PATH = new URL(BASE).pathname;
const at = (p) => BASE + p;
const TYPES = { html: 'text/html', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json',
  wasm: 'application/wasm', svg: 'image/svg+xml', png: 'image/png', woff2: 'font/woff2', webmanifest: 'application/manifest+json' };
const type = (p) => TYPES[p.split('.').pop()] || 'application/octet-stream';

async function sha(buf) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
  return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('');
}
// one file from the site, checked against its fingerprint (the second try skips the browser's own copy)
async function download(p) {
  for (const mode of ['default', 'reload']) {
    const r = await fetch(at(p), { cache: mode });
    if (!r.ok) throw new Error(`${p}: ${r.status}`);
    const buf = await r.arrayBuffer();
    if (await sha(buf) === FILES[p]) return buf;
  }
  throw new Error(`${p}: not the expected file (a new version is being put up)`);
}
const going = new Map();                                // files on their way: asked for twice at once, downloaded once
function fetched(p) {
  if (!going.has(p)) going.set(p, download(p).finally(() => going.delete(p)));
  return going.get(p);
}
const answer = (p, buf) => new Response(buf, { headers: { 'Content-Type': type(p), 'X-WB-Sha': FILES[p] } });

self.addEventListener('install', (e) => e.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  const older = (await caches.keys()).filter((k) => k.startsWith('witty-bible-') && k !== CACHE);
  for (const p of Object.keys(FILES)) {
    if (await cache.match(at(p))) continue;                         // an install that was cut off, starting again
    let before = null;
    for (const k of older) if ((before = await (await caches.open(k)).match(at(p)))) break;
    if (before && before.headers.get('X-WB-Sha') === FILES[p]) await cache.put(at(p), before);     // unchanged: keep it
    else if (before || SHELL.includes(p)) await cache.put(at(p), answer(p, await fetched(p)));    // new or changed
  }
})()));

self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('witty-bible-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

// the app's "Restart" button, when a new version is ready
self.addEventListener('message', (e) => { if (e.data === 'restart') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(BASE)) return;   // the NIV and NKJV (YouVersion) go to the internet
  let p = decodeURIComponent(new URL(req.url).pathname.slice(PATH.length));
  if (req.mode === 'navigate' && (p === '' || p === 'index.html')) p = 'index.html';
  if (!(p in FILES)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const kept = await cache.match(at(p));
    if (kept) return kept;
    try {
      const buf = await fetched(p);
      await cache.put(at(p), answer(p, buf));
      return answer(p, buf);
    } catch (err) {
      return fetch(req);                                            // no connection: the browser says so as usual
    }
  })());
});
