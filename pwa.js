// Witty Bible as a web app (the iPhone version: Safari → Share → Add to Home Screen). Starts the service worker
// (sw.js) that keeps the app's files on the device, keeps all of them when the app runs from the Home Screen, and says
// when a new version is ready. Does nothing in the Windows program or the Android app, which carry their files.
import { host } from './host.js';
import { VERSION } from './version.js';

const nav = navigator;
export const pwa = {
  site: false,                                          // the web app's page (dist/pwa), in a browser
  on: false,                                            // a service worker keeps the files (web app only)
  // inside another app's browser (Messenger, Facebook, Instagram): it can't put the page on the Home Screen
  inApp: /FBAN|FBAV|FB_IAB|Instagram|Messenger/i.test(nav.userAgent),
  ios: /iP(hone|od|ad)/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1),
  standalone: matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
  state: 'idle',                                        // idle → saving → ready, or paused (no connection)
  total: 0, have: 0,                                    // bytes of the whole app, and kept so far
  waiting: null,                                        // a new version, ready to start
  listeners: new Set(),
  onChange(f) { this.listeners.add(f); }
};
const changed = (what) => {
  document.documentElement.dataset.offline = pwa.state;  // for automated tests: idle, saving, ready, paused
  for (const f of pwa.listeners) { try { f(what); } catch (e) { /* a view that went away */ } }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let started = false;
export function startPWA() {
  if (started) return;
  started = true;
  // only the web app's page names its manifest (dist/pwa): not the programs' page, nor a browser while developing
  if (host.kind !== 'web' || !document.querySelector('link[rel="manifest"]')) return;
  pwa.site = true;
  if (!('serviceWorker' in nav) || !window.isSecureContext || !window.caches) return;   // (other apps' browsers)
  pwa.on = true;
  document.documentElement.dataset.offline = pwa.state;
  let restarting = false;
  nav.serviceWorker.addEventListener('controllerchange', () => { if (restarting) location.reload(); });
  pwa.restart = () => { if (pwa.waiting) { restarting = true; pwa.waiting.postMessage('restart'); } else location.reload(); };
  nav.serviceWorker.register('sw.js').then((reg) => {
    const ready = (w) => { if (w && nav.serviceWorker.controller) { pwa.waiting = w; changed('update'); } };
    ready(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') ready(w); });
    });
    // the app on the Home Screen is often resumed, not reopened: look for a new version when it comes back
    let looked = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - looked > 3600e3) { looked = Date.now(); reg.update().catch(() => {}); }
    });
    if (pwa.standalone) keepAll();
    else if (!pwa.ios) measure();
  }).catch(() => { pwa.on = false; changed('state'); });
}

// The web app's first start from the Home Screen: wait (at most 20 s) for the service worker to take over before the
// search loads the Bible data, so the data is kept as it comes. Any other start: at once.
export function firstStart() {
  startPWA();
  if (!pwa.on || !pwa.standalone || nav.serviceWorker.controller) return Promise.resolve();
  return Promise.race([controlled(), sleep(20e3)]);
}
async function controlled() {
  await nav.serviceWorker.ready;
  if (nav.serviceWorker.controller) return;
  await new Promise((r) => nav.serviceWorker.addEventListener('controllerchange', r, { once: true }));
}
async function listing() {
  const r = await fetch('files.json');
  const d = await r.json();
  return { cache: await caches.open('witty-bible-' + d.version), files: Object.entries(d.files), version: d.version };
}
// how much of the app is on the device already
async function measure() {
  try {
    await controlled();
    const { cache, files } = await listing();
    pwa.total = 0; pwa.have = 0;
    for (const [p, f] of files) { pwa.total += f.bytes; if (await cache.match(new URL(p, location.href))) pwa.have += f.bytes; }
    if (pwa.state === 'idle' && pwa.have >= pwa.total) pwa.state = 'ready';
    changed('state');
  } catch (e) { /* asked again when the settings open */ }
}
pwa.measure = measure;

// keep every file of the app on the device (three at a time); the service worker checks each one and keeps it
let running = null;
export function keepAll() {
  if (!pwa.on) return Promise.resolve();
  if (!running) running = keepEverything().finally(() => { running = null; });
  return running;
}
async function keepEverything() {
  for (;;) {
    try {
      await controlled();
      if (nav.storage && nav.storage.persist) nav.storage.persist().catch(() => {});
      const { cache, files, version } = await listing();
      if (version !== VERSION) return;                   // a new version is starting: it keeps its own files
      let total = 0, have = 0;
      const todo = [];
      for (const [p, f] of files) {
        total += f.bytes;
        if (await cache.match(new URL(p, location.href))) have += f.bytes; else todo.push([p, f.bytes]);
      }
      pwa.total = total; pwa.have = have;
      if (!todo.length) { pwa.state = 'ready'; changed('state'); return; }
      pwa.state = 'saving'; changed('state');
      const one = async () => {
        for (let job; (job = todo.shift());) {
          const [p, bytes] = job;
          const r = await fetch(p);
          if (!r.ok) throw new Error(p);
          await r.arrayBuffer();
          if (!(await cache.match(new URL(p, location.href)))) throw new Error('not kept: ' + p);
          pwa.have += bytes; changed('progress');
        }
      };
      await Promise.all([one(), one(), one()]);
      pwa.state = 'ready'; changed('done');
      return;
    } catch (e) {
      pwa.state = 'paused'; changed('state');
      // try again once the connection is back (or in a minute)
      await Promise.race([new Promise((r) => window.addEventListener('online', r, { once: true })), sleep(60e3)]);
    }
  }
}
