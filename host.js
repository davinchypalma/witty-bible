// Witty Bible: what the page asks of the program it runs in (Windows program, Android app, or a browser: the web app
// for the iPhone, or a plain browser while developing). In the programs the page never goes on the internet: the only
// online request, for the NIV and NKJV, is made by the program, to api.youversion.com only. The web app makes that same
// request itself (its page allows api.youversion.com and nothing else).

const desktop = window.wittyDesktop;
const android = window.WittyNative;
const IOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let seq = 0;
const pending = new Map();

// Android answers through window.WBAndroid._done(id, json)
window.WBAndroid = window.WBAndroid || {};
window.WBAndroid._done = (id, json) => {
  const p = pending.get(id);
  if (!p) return;
  pending.delete(id);
  try { p(typeof json === 'string' ? JSON.parse(json) : json); } catch (e) { p({ ok: false, error: String(e) }); }
};
function androidCall(method, ...args) {
  return new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    try { android[method](id, ...args); } catch (e) { pending.delete(id); resolve({ ok: false, error: String(e) }); }
  });
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export const host = {
  kind: desktop ? 'desktop' : android ? 'android' : 'web',

  // GET https://api.youversion.com/v1/… with the app key → { ok, status, data } (data: parsed JSON)
  async youversion(path, key) {
    if (!/^\/v1\/[\w./?=&%[\]*,-]+$/.test(path)) return { ok: false, status: 0, error: 'bad request' };
    if (desktop) return desktop.youversion(path, key);
    if (android) return androidCall('youversion', path, key);
    try {                                               // the web app (iPhone), and a browser while developing
      const r = await fetch('https://api.youversion.com' + path, { headers: { 'X-YVP-App-Key': key, Accept: 'application/json' } });
      return { ok: r.ok, status: r.status, data: r.ok ? await r.json() : null };
    } catch (e) { return { ok: false, status: 0, error: 'offline' }; }
  },

  open(url) {
    if (!/^(https:\/\/|mailto:)/.test(url)) return;
    if (desktop) desktop.openExternal(url);
    else if (android) android.openUrl(url);
    else window.open(url, '_blank', 'noopener');
  },

  async copy(text) {
    if (android) { android.copy(text); return true; }
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall back below */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  },

  // the phone's own Share sheet (Android app; iPhone and other browsers that have one)
  canShare: !!android || (!desktop && !!navigator.share),
  share(text) {
    if (android) android.share(text);
    else if (navigator.share) navigator.share({ text }).catch(() => {});
  },

  // Save a text file the person names (export of saved verses) → { ok, name }
  async saveText(name, text) {
    if (desktop) return desktop.saveText(name, text);
    if (android) return androidCall('saveText', name, text);
    // iPhone: the Share sheet saves it to Files (or sends it); a download would only show the text
    const file = typeof File === 'function' ? new File([text], name, { type: 'application/json' }) : null;
    if (IOS && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return { ok: true, name }; } catch (e) { return { ok: false }; }
    }
    download(name, text, 'application/json');
    return { ok: true, name };
  },

  // Pick a text file to read (import) → { ok, text }
  async openText() {
    if (desktop) return desktop.openText();
    if (android) return androidCall('openText');
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = async () => { const f = inp.files[0]; resolve(f ? { ok: true, text: await f.text() } : { ok: false }); };
      inp.click();
    });
  },

  setTheme(theme, colors) {
    if (desktop) desktop.setTheme(theme);
    if (android && android.setBars) android.setBars(colors.bar, colors.nav || colors.bar, colors.dark);
    const meta = document.querySelector('meta[name="theme-color"]');   // the web app: the browser's bar
    if (meta && colors && colors.bar) meta.content = colors.bar;
  },

  ready() { if (android && android.ready) android.ready(); },
  version: (desktop && desktop.version) || (android && android.version && android.version()) || 'dev'
};
