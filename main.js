// Witty Bible: the app (search, themes, reader, my verses, settings). Same page on Windows and Android.
import { host } from './host.js';
import { t, tIn, setLang, getLang } from './i18n.js';
import { Books } from './engine/refs.js';
import { THEMES, GROUPS } from './engine/themes.js';
import { VERSION } from './version.js';
import { pwa, startPWA, firstStart, keepAll } from './pwa.js';

// ------------------------------------------------------------------ storage and settings
const store = {
  get(k, d) { try { const v = localStorage.getItem('wb.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('wb.' + k, JSON.stringify(v)); } catch (e) { /* storage full or blocked: not important */ } }
};
const DEFAULTS = { lang: 'auto', theme: 'auto', size: 19, version: 'KJV', red: true, italics: true, headings: true, yvKey: '', extra: true, strong: true };
const set = Object.assign({}, DEFAULTS, store.get('settings', {}));
const saveSettings = () => store.set('settings', set);

const S = {
  view: 'search', books: null, meta: null, texts: {}, results: null, shown: 20, saved: store.get('saved', []), recent: store.get('recent', []),
  read: store.get('read', { b: 42, c: 3 }), sel: new Set(), flash: -1, list: 'all', ready: false, ai: 'loading', votd: null,
  extraBooks: null, xflash: null, xchap: null
};
const OFFLINE = ['KJV', 'BSB', 'UKJV', 'NHEB', 'DBY', 'LSG', 'JND', 'MAR', 'CRA', 'PGR'];
const ALL = ['KJV', 'NKJV', 'NIV', 'BSB', 'UKJV', 'NHEB', 'DBY', 'LSG', 'JND', 'MAR', 'CRA', 'PGR'];
const FRENCH = new Set(['LSG', 'JND', 'MAR', 'CRA', 'PGR']);     // French Bibles: with one, the themes are in French too
const STRONG = new Set(['DBY', 'JND']);                         // with Strong's numbers: tap a word for its Hebrew or Greek
const BIBLE_COM = { KJV: 1, NKJV: 114, NIV: 111, BSB: 3034, LSG: 93 };
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ small helpers
function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;                       // only for the app's own icons
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const ICON = {
  search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  read: '<svg viewBox="0 0 24 24"><path d="M12 6.5C10 5 7 4.5 3.5 4.8v13.4c3.5-.3 6.5.2 8.5 1.7 2-1.5 5-2 8.5-1.7V4.8C17 4.5 14 5 12 6.5zM12 6.5v13.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  saved: '<svg viewBox="0 0 24 24"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.7 7.7 0 0 0-2.6-1.5L14 2.4h-4l-.4 2.5A7.7 7.7 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.7 7.7 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.7 7.7 0 0 0 2.6-1.5l2.4.9 2-3.4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8.5" y="8.5" width="11" height="11" rx="2.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 8.5V6.2A1.7 1.7 0 0 0 13.8 4.5H6.2a1.7 1.7 0 0 0-1.7 1.7v7.6a1.7 1.7 0 0 0 1.7 1.7h2.3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  versions: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  chapter: '<svg viewBox="0 0 24 24"><path d="M12 6.5C10 5 7 4.5 3.5 4.8v13.4c3.5-.3 6.5.2 8.5 1.7 2-1.5 5-2 8.5-1.7V4.8C17 4.5 14 5 12 6.5zM12 6.5v13.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  related: '<svg viewBox="0 0 24 24"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  open: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  note: '<svg viewBox="0 0 24 24"><path d="M5 4.5h14v11l-4.5 4.5H5z M14.5 20v-4.5H19" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  iosShare: '<svg viewBox="0 0 24 24"><path d="M12 3.5v11M8 7.5l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 10H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
};
const svg = (name) => { const s = el('span', { html: ICON[name] }); return s.firstChild; };

let toastTimer = 0;
function toast(msg) {
  const tb = $('toast');
  tb.textContent = msg; tb.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { tb.hidden = true; }, 2600);
}

// ------------------------------------------------------------------ language and look
function applyLang() {
  const l = set.lang === 'auto' ? (/^fr/i.test(navigator.language || '') ? 'fr' : 'en') : set.lang;
  setLang(l);
  document.documentElement.lang = l;
}
function applyLook() {
  document.documentElement.dataset.theme = set.theme === 'auto' ? '' : set.theme;
  if (set.theme === 'auto') delete document.documentElement.dataset.theme;
  document.documentElement.style.setProperty('--size', set.size + 'px');
  document.body.classList.toggle('no-red', !set.red);
  document.body.classList.toggle('no-italics', !set.italics);
  const dark = set.theme === 'dark' || (set.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  host.setTheme(set.theme, { bar: '#1C2A47', nav: dark ? '#1A2640' : '#FFFFFF', dark });   // status bar: the navy header; navigation bar: the bottom bar
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyLook);

// ------------------------------------------------------------------ Bible texts
async function getJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
}
const loading = {};
function text(ver) {                     // offline versions: { text[], titles{}, heads{}, para Set }
  if (S.texts[ver]) return Promise.resolve(S.texts[ver]);
  if (!loading[ver]) {
    loading[ver] = getJSON(`data/${ver.toLowerCase()}.json`).then((d) => {
      d.paraSet = new Set(d.para);
      S.texts[ver] = d;
      return d;
    });
  }
  return loading[ver];
}
const lab = (a, z) => S.books.label(a, z === undefined ? a : z, getLang());
const plainOf = (s) => (s || '').replace(/<\/?s[^>]*>|<\/?[ij]>/g, '').replace(/<n>(.*?)<\/n>/g, (_, x) => x.toUpperCase()).replace(/\n\t?/g, ' ').replace(/ {2,}/g, ' ').trim();

// Verse markup → nodes: <i>added</i> <n>LORD</n> <j>words of Jesus</j>, "\n" new line, "\n\t" indented line,
// <v>6a</v> a verse number inside a verse (1 Enoch, as R. H. Charles numbers it),
// <s H7225>word</s> a word with its Strong's numbers (a tappable word when strong is on, plain text otherwise)
function verseNodes(markup, strong = false) {
  const frag = document.createDocumentFragment();
  const stack = [frag];
  const top = () => stack[stack.length - 1];
  const re = /<v>([^<]*)<\/v>|<(\/?)([inj])>|<s((?: [^>]*)?)>|(<\/s>)|\n(\t?)/g;
  let pos = 0, m;
  const push = (s) => { if (s) top().append(document.createTextNode(s)); };
  while ((m = re.exec(markup))) {
    push(markup.slice(pos, m.index));
    pos = re.lastIndex;
    if (m[1] !== undefined) {
      top().append(el('span', { class: 'vn sub', text: m[1] }));
      continue;
    }
    if (m[4] !== undefined) {
      if (strong && m[4].trim()) { const e = el('span', { class: 'sw', 'data-s': m[4].trim() }); top().append(e); stack.push(e); }
      continue;
    }
    if (m[5]) {
      if (strong) {                                    // close the last word (older phones lack findLastIndex)
        let k = stack.length - 1;
        while (k > 0 && !(stack[k].classList && stack[k].classList.contains('sw'))) k--;
        if (k > 0) stack.length = k;
      }
      continue;
    }
    m = [m[0], m[2], m[3], m[6]];
    if (m[2]) {
      if (m[1]) { if (stack.length > 1) stack.pop(); }
      else {
        const e = m[2] === 'i' ? el('i', { class: 'add' }) : el('span', { class: m[2] === 'n' ? 'nd' : 'wj' });
        top().append(e); stack.push(e);
      }
    } else {
      top().append(el('br'));
      if (m[3]) top().append(el('span', { class: 'ind', style: 'display:inline-block;width:1.6em' }));
    }
  }
  push(markup.slice(pos));
  return frag;
}

// ------------------------------------------------------------------ YouVersion (NIV, NKJV)
const YV = {
  info: store.get('yv', null),           // { NIV: { id, title, copyright } | null, NKJV: …, checked, state }
  cache: new Map(),                      // passage texts, only while the app is open
  enc: (s) => s.replace(/\[/g, '%5B').replace(/\]/g, '%5D'),
  has(ver) { return !!(set.yvKey && this.info && this.info[ver] && this.info[ver].id); },
  busy: 0, line: [],
  async get(path) {
    if (this.busy >= 4) await new Promise((r) => this.line.push(r));
    this.busy++;
    try { return await host.youversion(this.enc(path), set.yvKey.trim()); }
    finally { this.busy--; const next = this.line.shift(); if (next) next(); }
  },
  async check() {
    const fields = '&fields[]=id&fields[]=abbreviation&fields[]=localized_title&page_size=*';
    const r = await this.get('/v1/bibles?language_ranges[]=en' + fields);
    if (!r.ok) return { state: r.status === 401 || r.status === 403 ? 'bad' : r.status === 0 ? 'offline' : 'error', status: r.status };
    const list = (r.data && r.data.data) || [];
    const pick = (ab, title) => list.find((x) => (x.abbreviation || '').toUpperCase() === ab) ||
      list.find((x) => (x.localized_title || '').toLowerCase() === title);
    const info = { state: 'ok', checked: Date.now() };
    let all = null;
    for (const [ver, title] of [['NIV', 'new international version'], ['NKJV', 'new king james version']]) {
      const v = pick(ver, title);
      if (v) {
        const meta = await this.get(`/v1/bibles/${v.id}`);
        const d = meta.ok ? meta.data : {};
        info[ver] = { id: v.id, title: d.localized_title || v.localized_title || ver, copyright: ((d.copyright || '').trim() || (d.promotional_content || '').trim()).slice(0, 600) };
      } else {
        if (!all) {
          const a = await this.get('/v1/bibles?language_ranges[]=en&all_available=true' + fields);
          all = a.ok ? (a.data && a.data.data) || [] : [];
        }
        const exists = all.find((x) => (x.abbreviation || '').toUpperCase() === ver);
        info[ver] = { id: 0, missing: exists ? 'licence' : 'offered' };
      }
    }
    this.info = info;
    store.set('yv', info);
    return info;
  },
  // → { ok, text } plain text of a passage (one chapter at a time)
  async passage(ver, a, z) {
    const key = ver + ':' + a + '-' + z;
    if (this.cache.has(key)) return this.cache.get(key);
    const usfm = S.books.usfm(a, z);
    const r = await this.get(`/v1/bibles/${this.info[ver].id}/passages/${usfm}?format=text`);
    const out = r.ok && r.data && typeof r.data.content === 'string'
      ? { ok: true, text: r.data.content.replace(/\s+/g, ' ').trim() }
      : { ok: false, status: r.status };
    if (out.ok) this.cache.set(key, out);
    return out;
  },
  // A chapter for the reader → { ok, verses: Map(n → { text, head }) }
  async chapter(ver, b, c) {
    const key = ver + ':ch:' + b + ':' + c;
    if (this.cache.has(key)) return this.cache.get(key);
    const r = await this.get(`/v1/bibles/${this.info[ver].id}/passages/${S.books.list[b].usfm}.${c}?format=html&include_headings=true&include_notes=false`);
    if (!(r.ok && r.data && typeof r.data.content === 'string')) return { ok: false, status: r.status };
    const doc = new DOMParser().parseFromString(r.data.content, 'text/html');
    const verses = new Map();
    let cur = 0, head = '', brk = null;        // brk: a block began → the next words start a new line or paragraph
    const add = (s) => {
      if (!cur) return;
      const v = verses.get(cur) || { text: '', head: '' };
      if (brk && s.trim()) {
        if (v.text.trim()) v.text += '\n' + (brk.level >= 2 ? '\t' : '');
        else if (brk.para) v.para = true;
        else v.start = brk.level;
        brk = null;
      }
      v.text += s;
      verses.set(cur, v);
    };
    const walk = (node) => {
      for (const ch of node.childNodes) {
        if (ch.nodeType === 3) { add(ch.nodeValue); continue; }
        if (ch.nodeType !== 1) continue;
        const cls = ch.className || '';
        if (/\byv-vlbl\b|\byv-n\b|\bnote\b|\bf\b|\bx\b/.test(cls) || ch.tagName === 'SCRIPT' || ch.tagName === 'STYLE') continue;
        if (/\b(s\d?|ms\d?|mr|sp|qa|yv-h)\b/.test(cls)) { head = ch.textContent.trim(); continue; }
        if (/\br\b/.test(cls)) continue;
        if (ch.matches('.yv-v[v]')) {
          cur = parseInt(ch.getAttribute('v'), 10) || cur;
          const v = verses.get(cur) || { text: '', head: '' };
          if (head) { v.head = head; head = ''; }
          verses.set(cur, v);
          walk(ch);
          continue;
        }
        if (/^(DIV|P)$/.test(ch.tagName) && cls) {
          const poetry = /\b(q\d?|qm\d?|li\d?|qr|qc|pi\d?)\b/.test(cls);
          brk = { para: !poetry, level: /\b(q[2-4]|qm[2-4]|li[2-4])\b/.test(cls) ? 2 : 1 };
        }
        walk(ch);
      }
    };
    walk(doc.body);
    for (const v of verses.values()) v.text = v.text.replace(/[  ]+/g, ' ').replace(/ *\n */g, '\n').trim();
    const out = { ok: true, verses };
    this.cache.set(key, out);
    return out;
  },
  credit(ver) {
    const i = this.info && this.info[ver];
    return i && i.copyright ? i.copyright : '';
  },
  link(ver, a, z) {
    const id = BIBLE_COM[ver] || 1;
    return `https://www.bible.com/bible/${id}/${S.books.usfm(a, z)}.${ver === 'LSG' ? 'LSG' : ver}`;
  }
};

// The text of verses a…z in a version → { ver, markup | plain, note, missing }
async function verseText(ver, a, z) {
  if (OFFLINE.includes(ver)) {
    const d = await text(ver);
    const parts = [];
    for (let i = a; i <= z; i++) {
      const s = d.text[i];
      if (s) parts.push(z > a ? `\u0000${S.books.locate(i).v}\u0000` + s : s);
    }
    if (!parts.length) {
      if (ver === 'BSB') { const k = await text('KJV'); return { ver: 'KJV', markup: k.text[a], note: t('notInBSB') }; }
      if (ver === 'LSG') { const k = await text('KJV'); return { ver: 'KJV', markup: k.text[a], note: t('notInLSG') }; }
      if (ver !== 'KJV') {
        const alt = FRENCH.has(ver) ? 'LSG' : 'KJV';
        const k = await text(alt);
        return { ver: alt, markup: k.text[a], note: t('notInVer', { v: ver, alt }) };
      }
    }
    return { ver, markup: parts.join(' ') };
  }
  const alt = getLang() === 'fr' ? 'LSG' : 'BSB';
  const fallback = async (note, reason) => { const r = await verseText(alt, a, z); r.note = note; r.reason = reason; r.link = YV.link(ver, a, z); return r; };
  if (!set.yvKey) return fallback(t('needKey', { v: ver }), 'key');
  if (!YV.has(ver)) return fallback(t('notLicensed', { v: ver, alt }), 'licence');
  // one chapter at a time (the API's rule)
  const pieces = [];
  let i = a;
  while (i <= z) {
    const loc = S.books.locate(i);
    const end = Math.min(z, S.books.chapterRange(loc.b, loc.c)[1]);
    const r = await YV.passage(ver, i, end);
    if (!r.ok) return fallback(r.status === 0 ? t('needNet', { v: ver, alt }) : t('notLicensed', { v: ver, alt }), r.status === 0 ? 'net' : 'licence');
    pieces.push(r.text);
    i = end + 1;
  }
  return { ver, plain: pieces.join(' '), credit: YV.credit(ver) };
}
function fillText(box, r) {
  box.textContent = '';
  box.classList.remove('pending');
  if (r.markup !== undefined) {
    const parts = String(r.markup || '').split('\u0000');
    for (let k = 0; k < parts.length; k++) {
      if (k % 2 === 1) box.append(el('span', { class: 'vn', text: parts[k] }));
      else box.append(verseNodes(parts[k]));
    }
  } else box.textContent = r.plain || '';
}
const copyLine = (r, a, z) => {
  const body = r.markup !== undefined ? plainOf(String(r.markup).replace(/\u0000\d+\u0000/g, '')) : r.plain;
  return `“${body}” — ${lab(a, z)} (${r.ver})`;
};

// ------------------------------------------------------------------ the search worker
let worker = null;
const asks = new Map(), early = [];                     // early: what is asked before the search has started
let askId = 0;
function ask(msg) {
  const id = ++askId;
  return new Promise((resolve) => {
    asks.set(id, resolve);
    const m = Object.assign({ id }, msg);
    if (worker) worker.postMessage(m); else early.push(m);
  });
}
function startWorker() {
  worker = new Worker('engine/worker.js', { type: 'module' });
  worker.onmessage = (e) => {
    const m = e.data || {};
    if (m.type === 'ready') { S.ready = true; status(); if (!S.votd) loadVotd(); ask({ type: 'extraBooks' }).then((r) => { S.extraBooks = r.books || []; }); }
    else if (m.type === 'ai') { S.ai = 'ok'; status(); if (S.lastQuery && S.results && !S.results.ai) runSearch(S.lastQuery, false); }
    else if (m.type === 'ai-error') { S.ai = 'off'; status(); console.warn('AI search off:', m.message); }
    else if (m.type === 'fatal') { $('status').textContent = m.message; }
    else if (m.id && asks.has(m.id)) { asks.get(m.id)(m); asks.delete(m.id); }
  };
  worker.onerror = (e) => { console.error('worker', e.message); };
  for (const m of early.splice(0)) worker.postMessage(m);
}
// The search starts at once. Only the web app's very first start from the Home Screen waits a moment for its service
// worker, so the Bible data the search loads is kept on the phone as it comes (not downloaded twice).
firstStart().then(startWorker);
function status(extra) {
  const st = $('status');
  st.textContent = '';
  const msg = extra || (!S.ready ? t('loadingData') : S.ai === 'loading' ? t('loadingAI') : S.ai === 'off' ? t('aiOff') : '');
  if (!msg) return;
  if (!extra && S.ai === 'loading') st.append(el('span', { class: 'dot' }));
  st.append(msg);
}

// ------------------------------------------------------------------ navigation
const TABS = [['search', 'tabSearch', 'search'], ['read', 'tabRead', 'read'], ['saved', 'tabSaved', 'saved'], ['settings', 'tabSettings', 'settings']];
function renderTabs() {
  const top = $('tabs'), bot = $('bottom');
  top.textContent = ''; bot.textContent = '';
  for (const [v, key, ic] of TABS) {
    if (v !== 'settings') top.append(el('button', { type: 'button', role: 'tab', 'aria-selected': String(S.view === v), onclick: () => setView(v) }, svg(ic), t(key)));
    bot.append(el('button', { type: 'button', role: 'tab', 'aria-selected': String(S.view === v), onclick: () => setView(v) }, el('span', { class: 'ic' }, svg(ic)), t(key)));
  }
}
function setView(v, opts = {}) {
  S.view = v;
  for (const sec of document.querySelectorAll('.view')) sec.hidden = sec.dataset.view !== v;
  renderTabs();
  if (v === 'read') renderReader(opts);
  else if (v === 'saved') renderSaved();
  else if (v === 'settings') renderSettings();
  else if (v === 'search' && opts.focus) $('q').focus();
  if (!opts.keepScroll) window.scrollTo(0, 0);
  closeSheet();
}

// ------------------------------------------------------------------ sheets (version picker, versions, related, books)
function openSheet(title, ...body) {
  const sh = $('sheet');
  sh.textContent = '';
  sh.append(el('div', { class: 'shead' }, el('h2', { text: title }), el('button', { class: 'icon', type: 'button', 'aria-label': t('close'), onclick: closeSheet }, svg('close'))), ...body);
  sh.hidden = false; $('scrim').hidden = false;
  sh.scrollTop = 0;
  return sh;
}
function closeSheet() { $('sheet').hidden = true; $('scrim').hidden = true; }
$('scrim').addEventListener('click', closeSheet);

function versionPicker() {
  const body = el('div');
  for (const [title, list] of [[t('verEnglish'), ALL.filter((v) => !FRENCH.has(v))], [t('verFrench'), ALL.filter((v) => FRENCH.has(v))]]) {
    body.append(el('h3', { class: 'vgroup', text: title }));
    for (const v of list) {
      const online = !OFFLINE.includes(v);
      const ready = !online || YV.has(v);
      body.append(el('button', { class: 'opt' + (set.version === v ? ' on' : ''), type: 'button', onclick: () => {
        set.version = v; saveSettings(); $('verName').textContent = v; closeSheet(); refresh();
        if (online && !ready) toast(t('needKey', { v }));
      } }, el('b', { text: v }), el('span', { class: 'd' }, t('versionNames')[v],
        el('small', { text: online ? `${t('online')} · YouVersion${ready ? '' : ' · ' + t('setUp')}` : t('offline') + (STRONG.has(v) ? ' · ' + t('withStrong') : '') }))));
    }
  }
  if (!set.yvKey) body.append(el('div', { class: 'more-row' }, el('button', { class: 'btn small', type: 'button', onclick: () => setView('settings') }, t('setUp'))));
  openSheet(t('chooseVersion'), body);
}

async function showVersions(a, z) {
  const box = el('div', { class: 'vers' });
  openSheet(t('versionsTitle') + ' · ' + lab(a, z), box);
  for (const v of ALL) {
    const row = el('div', { class: 'vrow' });
    const txt = el('div', { class: 'vt pending', text: t('loadingVerse', { v }) });
    const head = el('div', { class: 'vh' }, el('b', { text: v }), el('span', { text: t('versionNames')[v] }));
    row.append(head, txt);
    box.append(row);
    verseText(v, a, z).then((r) => {
      if (r.ver !== v && !OFFLINE.includes(v)) {
        // not available here: say why, and offer YouVersion; never another version's words under this name
        txt.className = 'note-line';
        txt.textContent = t(r.reason === 'key' ? 'needKey' : r.reason === 'net' ? 'needNetHere' : 'notLicensedHere', { v });
        txt.append(el('button', { class: 'linkish', type: 'button', onclick: () => host.open(YV.link(v, a, z)) }, t('openYV')));
        if (!set.yvKey) txt.append(el('button', { class: 'linkish', type: 'button', onclick: () => setView('settings') }, t('setUp')));
        return;
      }
      fillText(txt, r);
      if (r.ver !== v) txt.prepend(el('div', { class: 'note-line', text: r.note || '' }));
      head.append(el('button', { class: 'act', type: 'button', onclick: async () => { await host.copy(copyLine(r, a, z)); toast(t('copied')); } }, svg('copy'), el('span', { text: t('copy') })));
      if (!OFFLINE.includes(v)) head.append(el('button', { class: 'act', type: 'button', title: t('openYV'), onclick: () => host.open(YV.link(v, a, z)) }, svg('open')));
      if (r.credit) row.append(el('div', { class: 'credit', text: r.credit }));
    });
  }
}

async function showRelated(a, z) {
  const r = await ask({ type: 'related', i: a });
  const items = (r.list || []).map((x) => ({ a: x.a, z: x.z }));
  const box = el('div', { class: 'list' });
  openSheet(t('relatedTitle') + ' · ' + lab(a, z), items.length ? box : el('p', { class: 'empty', text: t('relatedNone') }));
  for (const it of items) box.append(card(it, { compact: true }));
}

// ------------------------------------------------------------------ verse cards
const savedKey = (a, z) => a + '-' + z;
const isSaved = (a, z) => S.saved.some((s) => s.a === a && s.z === z);
function toggleSave(a, z, btn) {
  const k = S.saved.findIndex((s) => s.a === a && s.z === z);
  if (k >= 0) { S.saved.splice(k, 1); toast(t('removed')); }
  else { S.saved.unshift({ a, z, note: '', lists: [], t: Date.now() }); toast(t('saved')); }
  store.set('saved', S.saved);
  if (btn) { const on = k < 0; btn.classList.toggle('on', on); btn.querySelector('span').textContent = on ? t('saved') : t('save'); }
}
function card(it, opts = {}) {
  const { a, z } = it;
  const box = el('div', { class: 'vt pending', text: '…' });
  const ver = opts.version || set.version;
  const tag = el('span', { class: 'tag', text: ver });
  const head = el('div', { class: 'ref' }, el('h3', { text: lab(a, z) }), tag, el('span', { class: 'grow' }),
    it.hint ? el('span', { class: 'hint', text: it.hint }) : null);
  const note = el('div', { class: 'note-line', hidden: true });
  const on = isSaved(a, z);
  const saveBtn = el('button', { class: 'act' + (on ? ' on' : ''), type: 'button', onclick: (e) => toggleSave(a, z, e.currentTarget) }, svg('heart'), el('span', { text: on ? t('saved') : t('save') }));
  let last = null;
  const acts = el('div', { class: 'actions' },
    saveBtn,
    el('button', { class: 'act', type: 'button', onclick: async () => { if (last) { await host.copy(copyLine(last, a, z)); toast(t('copied')); } } }, svg('copy'), el('span', { text: t('copy') })),
    el('button', { class: 'act', type: 'button', onclick: () => showVersions(a, z) }, svg('versions'), el('span', { text: t('versions') })),
    el('button', { class: 'act', type: 'button', onclick: () => openAt(a, z) }, svg('chapter'), el('span', { text: t('read') })),
    opts.compact ? null : el('button', { class: 'act', type: 'button', onclick: () => showRelated(a, z) }, svg('related'), el('span', { text: t('related') })),
    host.canShare ? el('button', { class: 'act', type: 'button', onclick: () => { if (last) host.share(copyLine(last, a, z)); } }, svg('share'), el('span', { text: t('share') })) : null
  );
  const c = el('div', { class: 'card' + (opts.cls ? ' ' + opts.cls : '') }, opts.title ? el('div', { class: 'section-title', style: 'margin:0 0 6px', text: opts.title }) : null, head, note, box, acts);
  verseText(ver, a, z).then((r) => {
    last = r;
    fillText(box, r);
    tag.textContent = r.ver;
    if (r.note) {
      note.hidden = false; note.textContent = r.note;
      if (r.link) note.append(el('button', { class: 'linkish', type: 'button', onclick: () => host.open(r.link) }, t('openYV')));
      if (!set.yvKey && !OFFLINE.includes(ver)) note.append(el('button', { class: 'linkish', type: 'button', onclick: () => setView('settings') }, t('setUp')));
    }
  }).catch((err) => { box.textContent = String(err); });
  return c;
}

// ------------------------------------------------------------------ search
let searchSeq = 0;
function groupResults(verses, limit = 120) {
  // neighbouring verses that both come out near the top are shown together (Philippians 4:6–7)
  const top = verses.slice(0, limit);
  const score = new Map(top.map((x) => [x.i, x.score]));
  const used = new Set(), out = [];
  for (const x of top) {
    if (used.has(x.i)) continue;
    let a = x.i, z = x.i;
    const loc = S.books.locate(x.i);
    const [cs, ce] = S.books.chapterRange(loc.b, loc.c);
    while (z + 1 <= ce && z - a < 2 && !used.has(z + 1) && (score.get(z + 1) || 0) >= 0.72 * x.score) z++;
    while (a - 1 >= cs && z - a < 2 && !used.has(a - 1) && (score.get(a - 1) || 0) >= 0.85 * x.score) a--;
    for (let i = a; i <= z; i++) used.add(i);
    out.push({ a, z, score: x.score, why: x.why });
  }
  return out;
}
async function runSearch(q, remember = true) {
  q = q.trim();
  if (!q) { clearSearch(); return; }
  const sn = q.match(/^([HG])0*(\d{1,4})$/i);
  if (sn) {
    const n = sn[1].toUpperCase() + sn[2];
    const d = await strongData();
    if (d[n]) { strongVerses(n, STRONG.has(set.version) ? set.version : FRENCH.has(set.version) || getLang() === 'fr' ? 'JND' : 'DBY', d[n]); return; }
  }
  S.lastQuery = q;
  const my = ++searchSeq;
  document.body.classList.add('results-mode');
  const ref = S.books.parse(q, getLang());
  if (remember) {
    S.recent = [q, ...S.recent.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8);
    store.set('recent', S.recent);
  }
  if (ref && !ref.book && ref.v && /\d/.test(q) && q.replace(/[^a-zà-ÿ]/gi, '').length < 24) {
    // a reference: the verses themselves, then verses linked to them
    S.results = { query: q, ref, items: [{ a: ref.a, z: ref.z }], related: true, ai: true };
    renderResults();
    const r = await ask({ type: 'related', i: ref.a });
    if (my !== searchSeq) return;
    S.results.items.push(...(r.list || []).map((x) => ({ a: x.a, z: x.z })));
    renderResults();
    return;
  }
  if (ref && !ref.v && ref.c && /\d/.test(q) && q.split(/\s+/).length <= 3) {
    // a chapter ("Psalm 23"): Enter opens it; while typing, a card offers it
    if (remember) { openChapter(ref.b, ref.c); return; }
    S.results = { query: q, ref, items: [], chapter: true, ai: true };
    renderResults();
    return;
  }
  const r = await ask({ type: 'search', text: q, lang: getLang(), extra: set.extra !== false });
  if (my !== searchSeq) return;
  if (r.type === 'error') { $('status').textContent = r.message; return; }
  S.results = { query: q, ref: ref && ref.book ? ref : null, items: groupResults(r.verses), themes: r.themes || [], ai: r.ai,
    extra: r.extra || [], extraPlace: r.extraPlace || null, extraRef: r.extraRef || null };
  S.shown = 20;
  renderResults();
}
const THEME_MAX = 400;                  // a theme lists all its verses (Sin: 368), 20 at a time
async function runTheme(id) {
  const th = THEMES.find((x) => x.id === id);
  if (!th) return;
  const my = ++searchSeq;
  document.body.classList.add('results-mode');
  $('q').value = themeName(th);
  $('qClear').hidden = false;
  const r = await ask({ type: 'theme', theme: id, limit: THEME_MAX });
  if (my !== searchSeq) return;
  S.results = { query: '', theme: id, items: groupResults(r.verses, THEME_MAX), themes: [], ai: true };
  S.shown = 20;
  renderResults();
  window.scrollTo(0, 0);
}
function clearSearch() {
  searchSeq++;
  S.results = null; S.lastQuery = '';
  $('q').value = ''; $('qClear').hidden = true;
  document.body.classList.remove('results-mode');
  renderHome();
}
// the themes speak the Bible's language: French with a French Bible (and in the French app), English otherwise
const themeLang = () => (getLang() === 'fr' || FRENCH.has(set.version) ? 'fr' : 'en');
const themeName = (th) => (themeLang() === 'fr' ? th.fr : th.en);
function renderResults() {
  const R = S.results;
  const box = $('results');
  $('home').hidden = true; box.hidden = false;
  box.textContent = '';
  const th = R.theme ? THEMES.find((x) => x.id === R.theme) : null;
  const head = el('div', { class: 'rhead' },
    el('button', { class: 'linkish', type: 'button', onclick: clearSearch }, '‹ ', t('back')),
    el('h2', { text: th ? themeName(th) : R.strong ? t('strongResults', { n: R.strong.n, w: R.strong.lemma, c: R.strong.count, v: R.strong.ver }) : R.extraRef ? xlab(R.extraRef.x, R.extraRef.c, R.extraRef.v1, R.extraRef.v2) : R.ref && R.ref.v ? lab(R.ref.a, R.ref.z) : t('resultsFor', { q: R.query }) }));
  if (R.themes && R.themes.length) {
    const chips = el('div', { class: 'chips' });
    for (const x of R.themes.slice(0, 3)) {
      const tt = THEMES.find((y) => y.id === x.id);
      if (tt) chips.append(el('button', { class: 'chip soft', type: 'button', onclick: () => runTheme(tt.id) }, themeName(tt)));
    }
    head.append(chips);
  }
  box.append(head);
  if (R.ref && R.ref.book) {
    const b = R.ref.b;
    box.append(el('div', { class: 'banner' }, el('span', { class: 'grow', text: S.books.bookName(b, getLang()) }),
      el('button', { class: 'btn small primary', type: 'button', onclick: () => openChapter(b, 1) }, t('openBook', { book: S.books.bookName(b, getLang()) }))));
  }
  if (R.chapter) {
    const name = S.books.chapterLabel(R.ref.b, R.ref.c, getLang());
    box.append(el('div', { class: 'banner' }, el('span', { class: 'grow', text: name }),
      el('button', { class: 'btn small primary', type: 'button', onclick: () => openChapter(R.ref.b, R.ref.c) }, t('goTo', { ref: name }))));
    return;
  }
  const xs = R.extra && R.extra.length ? xsection(R) : null;
  if (R.extraRef) { box.append(xs); return; }
  if (xs && R.extraPlace === 'top') box.append(xs);
  if (!R.items.length) { box.append(el('p', { class: 'empty', text: t('noResults') })); if (xs && R.extraPlace !== 'top') box.append(xs); return; }
  const list = el('div', { class: 'list' });
  R.items.slice(0, S.shown).forEach((it, k) => list.append(card(it, { title: R.related && k === 1 ? t('relatedTitle') : null })));
  box.append(list);
  if (R.items.length > S.shown) {
    box.append(el('div', { class: 'more-row' }, el('button', { class: 'btn', type: 'button', onclick: () => { S.shown += 20; renderResults(); } }, t('showMore'))));
  }
  if (!OFFLINE.includes(set.version) && YV.has(set.version)) box.append(el('p', { class: 'credit', text: t('yvCredit', { v: set.version }) + ' ' + YV.credit(set.version) }));
  if (xs && R.extraPlace !== 'top') box.append(xs);
}

// ------------------------------------------------------------------ the Ethiopian Bible's other books (non-biblical, shown apart)
const xbook = (id) => (S.extraBooks || []).find((b) => b.id === id);
const xname = (b) => (getLang() === 'fr' ? b.fr : b.en);
const xtr = (b) => (b ? b.tr[getLang() === 'fr' ? 1 : 0] : '');
const xplain = (s) => String(s).replace(/<v>[^<]*<\/v>/g, '').replace(/\n/g, ' ').replace(/ {2,}/g, ' ').trim();
function xlab(x, c, v1, v2) {
  const b = xbook(x), n = b ? xname(b) : x;
  return `${n} ${c}` + (v1 ? `:${v1}` + (v2 && String(v2) !== String(v1) ? `–${v2}` : '') : '');
}
function xcard(it) {
  const label = xlab(it.x, it.c, it.v);
  const line = () => `“${xplain(it.text)}” — ${label} (${xtr(xbook(it.x))})`;
  const body = el('div', { class: 'vt' });
  body.append(verseNodes(it.text));
  return el('div', { class: 'card xcard' },
    el('div', { class: 'ref' }, el('h3', { text: label }), el('span', { class: 'tag xtag', text: t('nonBiblical') }), el('span', { class: 'grow' })),
    body,
    el('div', { class: 'actions' },
      el('button', { class: 'act', type: 'button', onclick: async () => { await host.copy(line()); toast(t('copied')); } }, svg('copy'), el('span', { text: t('copy') })),
      el('button', { class: 'act', type: 'button', onclick: () => openExtra(it.x, it.c, it.v) }, svg('chapter'), el('span', { text: t('read') })),
      host.canShare ? el('button', { class: 'act', type: 'button', onclick: () => host.share(line()) }, svg('share'), el('span', { text: t('share') })) : null));
}
function xsection(R) {
  const sec = el('section', { class: 'xsec' + (R.extraPlace === 'top' && !R.extraRef ? ' xtop' : '') },
    el('div', { class: 'xhead' }, el('span', { class: 'badge', text: t('nonBiblical') }), el('h3', { text: t('xTitle') })),
    el('p', { class: 'xnote', text: t('xNote') }));
  const list = el('div', { class: 'list' });
  R.extra.forEach((it) => list.append(xcard(it)));
  sec.append(list);
  if (R.extraRef) {
    const f = R.extraRef;
    sec.append(el('div', { class: 'more-row' }, el('button', { class: 'btn', type: 'button', onclick: () => openExtra(f.x, f.c, f.v1 ? String(f.v1) : null) }, t('readChapter'))));
  }
  return sec;
}
function openExtra(x, c, v) {
  S.read = { x, c }; S.sel = new Set(); S.xflash = v || null;
  store.set('read', S.read);
  setView('read');
}
async function renderExtraReader(my) {
  const { x, c } = S.read;
  const r = await ask({ type: 'extraChapter', x, c });
  if (my !== readSeq) return;
  if (!r.book) { S.read = { b: 42, c: 3 }; store.set('read', S.read); renderReader(); return; }
  const b = r.book, name = `${xname(b)} ${c}`;
  $('bookBtn').textContent = name;
  $('prevCh').title = t('prevChapter'); $('nextCh').title = t('nextChapter');
  const art = $('chapter');
  art.textContent = '';
  art.append(el('h2', { text: name }), el('div', { class: 'vname', text: xtr(b) }),
    el('div', { class: 'banner xbanner' }, el('span', { class: 'badge', text: t('nonBiblical') }), el('span', { class: 'grow', text: t('xBanner') })));
  const body = el('div', { class: 'body' });
  art.append(body);
  let p = el('p');
  body.append(p);
  r.verses.forEach(([v, text], k) => {
    const poem = text.includes('\n');
    if (poem && p.childNodes.length) { p = el('p'); body.append(p); }
    const span = el('span', { class: 'v', 'data-k': k }, el('span', { class: 'vn', text: v }));
    span.append(verseNodes(text), ' ');
    if (S.sel.has(k)) span.classList.add('sel');
    if (S.xflash && v === String(S.xflash)) span.classList.add('flash');
    span.addEventListener('click', () => toggleSel(k));
    p.append(span);
    if (poem) { p = el('p'); body.append(p); }
  });
  art.append(el('p', { class: 'readhint', text: t('readHintX') }));
  S.xchap = { x, c, verses: r.verses };
  if (S.xflash) {
    const target = art.querySelector('.v.flash');
    if (target) setTimeout(() => target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
    setTimeout(() => { art.querySelectorAll('.v.flash').forEach((e) => e.classList.remove('flash')); }, 2400);
    S.xflash = null;
  }
  renderSelbar();
}

// ------------------------------------------------------------------ home: verse of the day, recent searches, themes
async function loadVotd() {
  const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
  const ids = ['peace', 'hope', 'love', 'strength', 'trust', 'faith', 'joy', 'courage', 'grace', 'faithful', 'protect', 'provision', 'plan',
    'rest', 'thanks', 'prayer', 'wisdom', 'persevere', 'forgive', 'salvation', 'healing', 'worship', 'heaven', 'new', 'patience'];
  const th = THEMES.find((x) => x.id === ids[day % ids.length]);
  const r = await ask({ type: 'theme', theme: th.id, limit: 8 });
  const pick = r.verses[Math.floor(day / ids.length) % Math.min(4, r.verses.length)];
  if (!pick) return;
  const g = groupResults([pick, ...r.verses.filter((x) => Math.abs(x.i - pick.i) === 1)]).find((x) => x.a <= pick.i && x.z >= pick.i);
  S.votd = { a: g ? g.a : pick.i, z: g ? g.z : pick.i, theme: th };
  if (!S.results) renderHome();
}
function renderHome() {
  const home = $('home');
  $('results').hidden = true; home.hidden = false;
  home.textContent = '';
  const pb = pwaHome();
  if (pb) home.append(pb);
  if (S.votd) home.append(card({ a: S.votd.a, z: S.votd.z, hint: themeName(S.votd.theme) }, { title: t('votd'), cls: 'votd' }));
  if (S.recent.length) {
    home.append(el('div', { class: 'section-title' }, t('recent'), ' ', el('button', { class: 'linkish', type: 'button', onclick: () => { S.recent = []; store.set('recent', []); renderHome(); } }, t('clearRecent'))));
    home.append(el('div', { class: 'chips' }, S.recent.map((q) => el('button', { class: 'chip', type: 'button', onclick: () => { $('q').value = q; $('qClear').hidden = false; runSearch(q); } }, q))));
  }
  home.append(el('div', { class: 'section-title', text: tIn(themeLang(), 'themesTitle') }));
  const groups = el('div', { class: 'groups' });
  for (const g of GROUPS) {
    const chips = el('div', { class: 'chips' });
    for (const th of THEMES.filter((x) => x.g === g.id)) chips.append(el('button', { class: 'chip', type: 'button', onclick: () => runTheme(th.id) }, themeName(th)));
    groups.append(el('div', { class: 'group' }, el('h3', { text: themeLang() === 'fr' ? g.fr : g.en }), chips));
  }
  home.append(groups);
}

// ------------------------------------------------------------------ the web app (iPhone): Home Screen, offline, updates
const mb = (b) => Math.max(1, Math.round(b / 1e6));
const pct = () => (pwa.total ? Math.min(100, Math.floor((100 * pwa.have) / pwa.total)) : 0);
function pwaSteps() {
  const [a, b] = t('pwaSteps').split('{share}');
  return el('p', { class: 'small', style: 'margin:4px 0 0' }, a, el('span', { class: 'iosshare' }, svg('iosShare')), b || '');
}
function pwaProgress() {
  const p = pct();
  return el('div', { class: 'pwaprog' }, el('div', { class: 'small', text: pwa.state === 'paused' ? t('pwaPaused') : t('pwaSaving', { p }) }),
    el('div', { class: 'bar' }, el('i', { style: `width:${p}%` })));
}
function pwaTick() {
  const p = pct();
  for (const box of document.querySelectorAll('.pwaprog')) {
    box.firstChild.textContent = pwa.state === 'paused' ? t('pwaPaused') : t('pwaSaving', { p });
    box.querySelector('i').style.width = p + '%';
  }
}
// on Search: how the saving goes (app on the Home Screen), or how to put the app there (iPhone, in Safari)
function pwaHome() {
  if (!pwa.on) return null;
  if (pwa.standalone && (pwa.state === 'saving' || pwa.state === 'paused')) return el('div', { class: 'banner pwa' }, pwaProgress());
  if (pwa.ios && !pwa.standalone && !store.get('pwaHintOff')) {
    return el('div', { class: 'banner pwa' }, el('div', { class: 'grow' }, el('b', { text: t('pwaInstall') }), pwaSteps()),
      el('button', { class: 'icon', type: 'button', title: t('pwaLater'), 'aria-label': t('pwaLater'), onclick: () => { store.set('pwaHintOff', true); renderHome(); } }, svg('close')));
  }
  return null;
}
// in Settings: what is on the device, and a button to save it all (a browser other than Safari on the iPhone)
function pwaPanel() {
  if (!pwa.on) return null;
  const box = el('div', { class: 'panel' }, el('h2', { text: t('pwaTitle') }));
  if (pwa.ios && !pwa.standalone) {                     // Safari on the iPhone: the app on the Home Screen keeps its own files
    box.append(el('p', { class: 'small', style: 'font-weight:600;margin:0', text: t('pwaInstall') }), pwaSteps());
    return box;
  }
  if (pwa.state === 'ready') box.append(el('p', { class: 'small', style: 'margin:0', text: '✓ ' + t('pwaReady', { mb: mb(pwa.total) }) }));
  else if (pwa.state === 'saving' || pwa.state === 'paused') box.append(pwaProgress());
  else if (pwa.total) {
    box.append(el('p', { class: 'small', style: 'margin:0', text: t('pwaPart', { p: pct(), mb: mb(pwa.total) }) }));
    box.append(el('div', { class: 'more-row' }, el('button', { class: 'btn small', type: 'button', onclick: () => keepAll() }, t('pwaSave', { mb: mb(pwa.total) }))));
  }
  return box;
}
function pwaUpdateBar() {
  if (document.querySelector('.pwaupdate')) return;
  const bar = el('div', { class: 'pwaupdate', role: 'status' }, el('span', { text: t('pwaUpdate') }),
    el('button', { class: 'btn small', type: 'button', onclick: () => pwa.restart() }, t('pwaRestart')));
  bar.append(el('button', { class: 'icon', type: 'button', title: t('pwaLater'), 'aria-label': t('pwaLater'), onclick: () => bar.remove() }, svg('close')));
  document.body.append(bar);
}
pwa.onChange((what) => {
  if (what === 'progress') { pwaTick(); return; }
  if (what === 'update') { pwaUpdateBar(); return; }
  if (what === 'done') toast(t('pwaDone'));
  if (S.view === 'search' && !S.results && S.meta) renderHome();
  if (S.view === 'settings') renderSettings();
});

// ------------------------------------------------------------------ Strong's numbers (Darby, English and French)
let strongDict = null;
const strongData = () => strongDict || (strongDict = getJSON('data/strongs.json'));
async function openStrong(nums, word, ver) {
  const box = el('div', { class: 'strong' }, el('p', { class: 'muted', text: t('strongLoading') }));
  openSheet(`${word.trim()} · ${nums.join(' ')}`, box);
  const d = await strongData();
  box.textContent = '';
  for (const n of nums) {
    const e = d[n];
    if (!e) continue;
    const heb = n[0] === 'H';
    const rend = FRENCH.has(ver) ? e.fr : e.en;
    box.append(el('div', { class: 'sentry' },
      el('div', { class: 'stitle' },
        el('span', { class: 'lemma', dir: heb ? 'rtl' : 'ltr', lang: heb ? 'he' : 'grc', text: e.lemma }),
        el('span', { class: 'xlit', text: [e.xlit, e.pron ? `(${e.pron})` : ''].filter(Boolean).join(' ') }),
        el('span', { class: 'snum', text: `${t(heb ? 'hebrew' : 'greek')} · ${n}` })),
      rend && rend.length ? el('p', { class: 'srend' }, el('b', { text: t('strongIn', { v: t('versionNames')[ver] }) + ' ' }), rend.map(([w, k]) => `${w} (${k})`).join(', ')) : null,
      e.def ? el('p', { class: 'sdef' }, el('b', { text: t('strongDef') + ' ' }), e.def) : null,
      e.kjv ? el('p', { class: 'small' }, el('b', { text: t('strongKjv') + ' ' }), e.kjv) : null,
      e.from ? el('p', { class: 'small muted' }, el('b', { text: t('strongFrom') + ' ' }), e.from) : null,
      el('div', { class: 'more-row' }, el('button', { class: 'btn small', type: 'button', onclick: () => strongVerses(n, ver, e) }, t('strongVerses')))));
  }
  if (FRENCH.has(ver) && t('strongEnglish')) box.append(el('p', { class: 'small muted', text: t('strongEnglish') }));
}
// every verse where a Bible has this Strong's number (a concordance), as search results
async function strongVerses(n, ver, e) {
  const d = await text(ver);
  const re = new RegExp(`<s [^>]*\\b${n}\\b`);
  const verses = [];
  for (let i = 0; i < d.text.length; i++) if (d.text[i] && re.test(d.text[i])) verses.push({ i, score: 1 });
  searchSeq++;
  document.body.classList.add('results-mode');
  $('q').value = n;
  $('qClear').hidden = false;
  if (S.view !== 'search') setView('search');
  closeSheet();
  S.results = { query: '', strong: { n, ver, lemma: e.lemma, count: verses.length }, items: groupResults(verses, 4000), themes: [], ai: true };
  S.shown = 20;
  renderResults();
  window.scrollTo(0, 0);
}

// ------------------------------------------------------------------ reader
function openAt(a, z) {
  const p = S.books.locate(a);
  S.read = { b: p.b, c: p.c };
  S.sel = new Set();
  S.flash = a;
  S.flashEnd = z;
  store.set('read', S.read);
  setView('read');
}
function openChapter(b, c) {
  S.read = { b, c }; S.sel = new Set(); S.flash = -1;
  store.set('read', S.read);
  setView('read');
}
function moveChapter(d) {
  if (S.read.x) {
    const list = S.extraBooks || [];
    let bi = list.findIndex((y) => y.id === S.read.x);
    if (bi < 0) return;
    let xb = list[bi], xc = S.read.c + d;
    if (xc < xb.first) { bi = (bi - 1 + list.length) % list.length; xb = list[bi]; xc = xb.first + xb.chapters - 1; }
    else if (xc >= xb.first + xb.chapters) { bi = (bi + 1) % list.length; xb = list[bi]; xc = xb.first; }
    openExtra(xb.id, xc);
    return;
  }
  let { b, c } = S.read;
  c += d;
  if (c < 1) { b = (b + 65) % 66; c = S.books.list[b].chapters.length; }
  else if (c > S.books.list[b].chapters.length) { b = (b + 1) % 66; c = 1; }
  openChapter(b, c);
}
let readSeq = 0;
async function renderReader() {
  const my = ++readSeq;
  if (S.read.x) { await renderExtraReader(my); return; }
  const { b, c } = S.read;
  const ver = set.version;
  $('bookBtn').textContent = S.books.chapterLabel(b, c, getLang());
  $('prevCh').title = t('prevChapter'); $('nextCh').title = t('nextChapter');
  const art = $('chapter');
  art.textContent = '';
  art.append(el('h2', { text: S.books.chapterLabel(b, c, getLang()) }));
  const vlabel = el('span', { text: t('versionNames')[ver] });
  const vname = el('div', { class: 'vname' }, vlabel);
  art.append(vname);
  const strongOn = STRONG.has(ver) && set.strong;
  if (STRONG.has(ver)) {
    vname.append(' ', el('button', { class: 'chip strongbtn' + (strongOn ? ' on' : ''), type: 'button', 'aria-pressed': String(strongOn),
      title: t('strongTip'), onclick: () => { set.strong = !set.strong; saveSettings(); renderReader(); } }, t('strongBtn')));
  }
  const [s, e] = S.books.chapterRange(b, c);
  const body = el('div', { class: 'body' });
  art.append(body);
  let source = null, useVer = ver;
  if (!OFFLINE.includes(ver)) {
    if (YV.has(ver)) {
      body.append(el('p', { class: 'muted', text: t('loadingVerse', { v: ver }) }));
      const r = await YV.chapter(ver, b, c);
      if (my !== readSeq) return;
      body.textContent = '';
      if (r.ok) source = { online: r.verses };
      else { useVer = getLang() === 'fr' ? 'LSG' : 'BSB'; body.append(el('div', { class: 'banner', text: t(r.status === 0 ? 'needNet' : 'notLicensed', { v: ver, alt: useVer }) })); }
    } else {
      useVer = getLang() === 'fr' ? 'LSG' : 'BSB';
      body.append(el('div', { class: 'banner' }, el('span', { class: 'grow', text: t('needKey', { v: ver }) }), el('button', { class: 'btn small', type: 'button', onclick: () => setView('settings') }, t('setUp'))));
    }
  }
  if (!source) {
    source = await text(useVer);
    if (my !== readSeq) return;
    vlabel.textContent = t('versionNames')[useVer];
  }
  let p = el('p');
  body.append(p);
  for (let i = s; i <= e; i++) {
    const v = i - s + 1;
    let markup = '', plain = null, head = '', title = '';
    if (source.online) {
      const x = source.online.get(v);
      plain = x ? x.text : '';
      head = x ? x.head : '';
    } else {
      markup = source.text[i] || '';
      head = set.headings ? (source.heads && source.heads[i]) || '' : '';
      title = (source.titles && source.titles[i]) || '';
    }
    const x = source.online ? source.online.get(v) || {} : null;
    if (head) { body.append(el('div', { class: 'head', text: head })); p = el('p'); body.append(p); }
    if (title) { body.append(el('div', { class: 'ptitle', text: title })); p = el('p'); body.append(p); }
    else if (!source.online && source.paraSet && source.paraSet.has(i) && p.childNodes.length) { p = el('p'); body.append(p); }
    else if (x && x.para && p.childNodes.length) { p = el('p'); body.append(p); }
    else if (x && x.start && p.childNodes.length) { p.append(el('br')); if (x.start >= 2) p.append(el('span', { style: 'display:inline-block;width:1.6em' })); }
    const span = el('span', { class: 'v', 'data-i': i }, el('span', { class: 'vn', text: v }));
    if (plain !== null) span.append(verseNodes(plain));
    else if (markup) span.append(verseNodes(markup, strongOn));
    else span.append(el('span', { class: 'missing', text: '—' }));
    span.append(' ');
    if (S.sel.has(i)) span.classList.add('sel');
    if (S.flash >= 0 && i >= S.flash && i <= (S.flashEnd || S.flash)) span.classList.add('flash');
    span.addEventListener('click', (ev) => {
      const w = strongOn && ev.target.closest ? ev.target.closest('.sw') : null;
      if (w) { ev.stopPropagation(); openStrong(w.dataset.s.split(' '), w.textContent, ver); return; }
      toggleSel(i);
    });
    p.append(span);
  }
  if (source.online) art.append(el('p', { class: 'credit', text: t('yvCredit', { v: ver }) + ' ' + YV.credit(ver) }));
  art.append(el('p', { class: 'readhint', text: t(strongOn ? 'readHintStrong' : 'readHint') }));
  if (S.flash >= 0) {
    const target = art.querySelector(`.v[data-i="${S.flash}"]`);
    if (target) setTimeout(() => target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
    setTimeout(() => { art.querySelectorAll('.v.flash').forEach((x) => x.classList.remove('flash')); }, 2400);
    S.flash = -1;
  }
  renderSelbar();
}
function toggleSel(i) {
  if (S.sel.has(i)) S.sel.delete(i); else S.sel.add(i);
  // keep the choice one run of verses
  const list = [...S.sel].sort((x, y) => x - y);
  if (list.length > 1 && list[list.length - 1] - list[0] !== list.length - 1) { S.sel = new Set([i]); }
  document.querySelectorAll('#chapter .v').forEach((x) => x.classList.toggle('sel', S.sel.has(+(x.dataset.i ?? x.dataset.k))));
  renderSelbar();
}
function renderSelbar() {
  const bar = $('selbar');
  bar.textContent = '';
  if (!S.sel.size || S.view !== 'read') { bar.hidden = true; return; }
  const list = [...S.sel].sort((x, y) => x - y);
  const a = list[0], z = list[list.length - 1];
  if (S.read.x) {                                        // the Ethiopian Bible's other books: copy and share only
    const X = S.xchap;
    if (!X || X.x !== S.read.x || X.c !== S.read.c) { bar.hidden = true; return; }
    const label = xlab(X.x, X.c, X.verses[a][0], X.verses[z][0]);
    const line = () => `“${X.verses.slice(a, z + 1).map(([, tx]) => xplain(tx)).join(' ')}” — ${label} (${xtr(xbook(X.x))})`;
    bar.append(...[el('span', { class: 'label', text: label }),
      el('button', { class: 'act', type: 'button', onclick: async () => { await host.copy(line()); toast(t('copied')); } }, svg('copy'), el('span', { text: t('copy') })),
      host.canShare ? el('button', { class: 'act', type: 'button', onclick: () => host.share(line()) }, svg('share')) : null,
      el('button', { class: 'act', type: 'button', 'aria-label': t('close'), onclick: () => { S.sel = new Set(); renderReader(); } }, svg('close'))].filter(Boolean));
    bar.hidden = false;
    return;
  }
  const on = isSaved(a, z);
  bar.append(...[el('span', { class: 'label', text: lab(a, z) }),
    el('button', { class: 'act' + (on ? ' on' : ''), type: 'button', onclick: (e) => toggleSave(a, z, e.currentTarget) }, svg('heart'), el('span', { text: on ? t('saved') : t('save') })),
    el('button', { class: 'act', type: 'button', onclick: async () => { const r = await verseText(set.version, a, z); await host.copy(copyLine(r, a, z)); toast(t('copied')); } }, svg('copy'), el('span', { text: t('copy') })),
    el('button', { class: 'act', type: 'button', onclick: () => showVersions(a, z) }, svg('versions'), el('span', { text: t('versions') })),
    el('button', { class: 'act', type: 'button', onclick: () => showRelated(a, z) }, svg('related'), el('span', { text: t('related') })),
    host.canShare ? el('button', { class: 'act', type: 'button', onclick: async () => { const r = await verseText(set.version, a, z); host.share(copyLine(r, a, z)); } }, svg('share')) : null,
    el('button', { class: 'act', type: 'button', 'aria-label': t('close'), onclick: () => { S.sel = new Set(); renderReader(); } }, svg('close'))].filter(Boolean));
  bar.hidden = false;
}
function bookPicker() {
  const lang = getLang();
  const wrap = el('div', { class: 'books' });
  const grid = (from, to) => {
    const g = el('div', { class: 'bookgrid' });
    for (let b = from; b < to; b++) g.append(el('button', { class: !S.read.x && b === S.read.b ? 'on' : '', type: 'button', onclick: () => chapters(b) }, S.books.bookName(b, lang)));
    return g;
  };
  wrap.append(el('h3', { text: t('ot') }), grid(0, 39), el('h3', { text: t('nt') }), grid(39, 66));
  if (S.extraBooks && S.extraBooks.length) {
    const g = el('div', { class: 'bookgrid' });
    for (const xb of S.extraBooks) g.append(el('button', { class: S.read.x === xb.id ? 'on' : '', type: 'button', onclick: () => xchapters(xb) }, xname(xb)));
    wrap.append(el('h3', { class: 'xgroup' }, el('span', { class: 'badge', text: t('nonBiblical') }), ' ', t('xGroup')), el('p', { class: 'xnote', text: t('xNote') }), g);
  }
  openSheet(t('chooseBook'), wrap);
  function xchapters(xb) {
    if (xb.chapters === 1) { openExtra(xb.id, xb.first); return; }
    const g = el('div', { class: 'chgrid' });
    for (let c = xb.first; c < xb.first + xb.chapters; c++) {
      g.append(el('button', { class: S.read.x === xb.id && S.read.c === c ? 'on' : '', type: 'button', onclick: () => openExtra(xb.id, c) }, String(c)));
    }
    openSheet(xname(xb), g);
  }
  function chapters(b) {
    const n = S.books.list[b].chapters.length;
    if (n === 1) { openChapter(b, 1); return; }
    const g = el('div', { class: 'chgrid' });
    for (let c = 1; c <= n; c++) g.append(el('button', { class: !S.read.x && b === S.read.b && c === S.read.c ? 'on' : '', type: 'button', onclick: () => openChapter(b, c) }, String(c)));
    openSheet(S.books.bookName(b, lang), g);
  }
}

// ------------------------------------------------------------------ my verses
function allLists() { return [...new Set(S.saved.flatMap((s) => s.lists || []))].sort((a, b) => a.localeCompare(b)); }
function renderSaved() {
  const v = $('view-saved');
  v.textContent = '';
  v.append(el('h1', { class: 'page-title', text: t('tabSaved') }), el('p', { class: 'page-sub', text: S.saved.length ? t('savedCount', { n: S.saved.length }) : t('savedEmpty') }));
  const lists = allLists();
  const bar = el('div', { class: 'toolbar' });
  const chips = el('div', { class: 'chips grow' });
  if (lists.length) {
    chips.append(el('button', { class: 'chip' + (S.list === 'all' ? ' on' : ''), type: 'button', onclick: () => { S.list = 'all'; renderSaved(); } }, t('allSaved')));
    for (const l of lists) chips.append(el('button', { class: 'chip' + (S.list === l ? ' on' : ''), type: 'button', onclick: () => { S.list = l; renderSaved(); } }, l, el('small', { text: String(S.saved.filter((s) => (s.lists || []).includes(l)).length) })));
  }
  bar.append(chips);
  if (S.saved.length) bar.append(el('button', { class: 'btn small', type: 'button', onclick: copyAll }, t('copyAll')), el('button', { class: 'btn small', type: 'button', onclick: exportSaved }, t('exportBtn')));
  bar.append(el('button', { class: 'btn small', type: 'button', onclick: importSaved }, t('importBtn')));
  v.append(bar);
  const items = S.saved.filter((s) => S.list === 'all' || (s.lists || []).includes(S.list));
  const list = el('div', { class: 'list' });
  for (const s of items) {
    const c = card({ a: s.a, z: s.z });
    const noteBox = el('textarea', { class: 'field', placeholder: t('notePh'), rows: 2 });
    noteBox.value = s.note || '';
    noteBox.addEventListener('change', () => { s.note = noteBox.value.trim(); store.set('saved', S.saved); });
    const listRow = el('div', { class: 'chips', style: 'margin-top:8px' });
    for (const l of s.lists || []) listRow.append(el('button', { class: 'chip soft', type: 'button', title: t('remove'), onclick: () => { s.lists = s.lists.filter((x) => x !== l); store.set('saved', S.saved); renderSaved(); } }, l, ' ×'));
    listRow.append(el('button', { class: 'chip', type: 'button', onclick: () => pickList(s) }, '+ ', t('addToList')));
    c.insertBefore(el('div', { style: 'margin:6px 0 4px' }, noteBox, listRow), c.querySelector('.actions'));
    list.append(c);
  }
  v.append(list);
  if (S.saved.length) v.append(el('p', { class: 'credit', text: t('savedHint') }));
}
function pickList(s) {
  const body = el('div');
  for (const l of allLists()) body.append(el('button', { class: 'opt' + ((s.lists || []).includes(l) ? ' on' : ''), type: 'button', onclick: () => {
    s.lists = (s.lists || []).includes(l) ? s.lists.filter((x) => x !== l) : [...(s.lists || []), l];
    store.set('saved', S.saved); closeSheet(); renderSaved();
  } }, svg('list'), el('span', { class: 'd', text: l })));
  const inp = el('input', { class: 'field', placeholder: t('listName'), maxlength: 40 });
  const add = () => { const n = inp.value.trim(); if (!n) return; s.lists = [...new Set([...(s.lists || []), n])]; store.set('saved', S.saved); closeSheet(); renderSaved(); };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  body.append(el('div', { class: 'keyrow' }, inp, el('button', { class: 'btn primary', type: 'button', onclick: add }, t('newList').replace('…', ''))));
  openSheet(t('lists') + ' · ' + lab(s.a, s.z), body);
}
async function copyAll() {
  const items = S.saved.filter((s) => S.list === 'all' || (s.lists || []).includes(S.list));
  const lines = [];
  for (const s of items) { const r = await verseText(set.version, s.a, s.z); lines.push(copyLine(r, s.a, s.z) + (s.note ? `\n${s.note}` : '')); }
  await host.copy(lines.join('\n\n'));
  toast(t('copiedAll', { n: items.length }));
}
async function exportSaved() {
  const data = { app: 'Witty Bible', kind: 'saved-verses', version: 1, exported: new Date().toISOString(),
    verses: S.saved.map((s) => ({ ref: lab(s.a, s.z), usfm: S.books.usfm(s.a, s.z), a: s.a, z: s.z, note: s.note || '', lists: s.lists || [], t: s.t })) };
  const name = `witty-bible-verses-${new Date().toISOString().slice(0, 10)}.json`;
  const r = await host.saveText(name, JSON.stringify(data, null, 2));
  if (r && r.ok) toast(t('exported', { n: S.saved.length, name: r.name || name }));
}
async function importSaved() {
  const r = await host.openText();
  if (!r || !r.ok) return;
  let d;
  try { d = JSON.parse(r.text); } catch (e) { d = null; }
  if (!d || d.kind !== 'saved-verses' || !Array.isArray(d.verses)) { toast(t('importBad')); return; }
  let n = 0;
  for (const v of d.verses) {
    const a = +v.a, z = +v.z;
    if (!(a >= 0 && z >= a && z < S.books.count)) continue;
    const old = S.saved.find((s) => s.a === a && s.z === z);
    if (old) { old.lists = [...new Set([...(old.lists || []), ...(v.lists || [])])]; if (!old.note && v.note) old.note = String(v.note).slice(0, 2000); continue; }
    S.saved.push({ a, z, note: String(v.note || '').slice(0, 2000), lists: (v.lists || []).map(String).slice(0, 20), t: +v.t || Date.now() });
    n++;
  }
  S.saved.sort((x, y) => y.t - x.t);
  store.set('saved', S.saved);
  toast(t('imported', { n }));
  renderSaved();
}

// ------------------------------------------------------------------ settings
function seg(options, value, onpick) {
  const s = el('div', { class: 'seg', role: 'radiogroup' });
  for (const [v, label] of options) s.append(el('button', { class: v === value ? 'on' : '', type: 'button', role: 'radio', 'aria-checked': String(v === value), onclick: () => onpick(v) }, label));
  return s;
}
function sw(value, onchange) {
  const i = el('input', { class: 'switch', type: 'checkbox' });
  i.checked = !!value;
  i.addEventListener('change', () => onchange(i.checked));
  return i;
}
function yvStatusBox(info) {
  const box = el('div', { class: 'ystat' + (info && info.state === 'ok' ? ' ok' : ''), hidden: !info });
  if (!info) return box;
  if (info.state === 'ok') {
    box.append(el('div', { text: t('yvOk') }));
    for (const v of ['NIV', 'NKJV']) {
      const x = info[v] || {};
      box.append(el('div', { text: x.id ? '✓ ' + t('yvHas', { v }) : x.missing === 'licence' ? '• ' + t('yvNoLicence', { v }) : '• ' + t('yvNotOffered', { v }) }));
    }
  } else box.append(el('div', { text: info.state === 'bad' ? t('yvBad') : info.state === 'offline' ? t('yvOffline') : `${t('yvBad')} (${info.status || ''})` }));
  return box;
}
function renderSettings() {
  const v = $('view-settings');
  v.textContent = '';
  const redo = () => { saveSettings(); applyLang(); applyLook(); refresh(); renderSettings(); };
  v.append(el('h1', { class: 'page-title', text: t('tabSettings') }));
  // display
  const size = el('input', { type: 'range', min: 15, max: 26, step: 1, value: set.size });
  size.addEventListener('input', () => { set.size = +size.value; applyLook(); saveSettings(); });
  v.append(el('div', { class: 'panel' },
    el('div', { class: 'row' }, el('span', { class: 'lab', text: t('language') }), seg([['auto', t('langAuto')], ['en', 'English'], ['fr', 'Français']], set.lang, (x) => { set.lang = x; redo(); })),
    el('div', { class: 'row' }, el('span', { class: 'lab', text: t('appearance') }), seg([['auto', t('themeAuto')], ['light', t('themeLight')], ['dark', t('themeDark')]], set.theme, (x) => { set.theme = x; redo(); })),
    el('div', { class: 'row' }, el('span', { class: 'lab', text: t('textSize') }), size),
    el('div', { class: 'row' }, el('span', { class: 'lab', text: t('versionShown') }), el('button', { class: 'ver', type: 'button', onclick: versionPicker }, set.version, svg('versions'))),
    el('label', { class: 'row' }, el('span', { class: 'lab', text: t('redLetters') }), sw(set.red, (x) => { set.red = x; saveSettings(); applyLook(); })),
    el('label', { class: 'row' }, el('span', { class: 'lab', text: t('italics') }), sw(set.italics, (x) => { set.italics = x; saveSettings(); applyLook(); })),
    el('label', { class: 'row' }, el('span', { class: 'lab', text: t('headings') }), sw(set.headings, (x) => { set.headings = x; saveSettings(); })),
    el('label', { class: 'row' }, el('span', { class: 'lab' }, t('xSetting'), el('small', { class: 'sub', text: t('xSettingSub') })),
      sw(set.extra !== false, (x) => { set.extra = x; saveSettings(); }))
  ));
  // NIV and NKJV
  const key = el('input', { class: 'field', type: 'text', placeholder: t('yvKeyPh'), spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off' });
  key.value = set.yvKey;
  let stat = yvStatusBox(set.yvKey ? YV.info : null);
  const check = el('button', { class: 'btn primary', type: 'button', onclick: async () => {
    set.yvKey = key.value.trim(); saveSettings();
    YV.cache.clear();
    if (!set.yvKey) return;
    check.disabled = true; check.textContent = t('yvChecking');
    const info = await YV.check();
    check.disabled = false; check.textContent = t('yvCheck');
    const nb = yvStatusBox(info); stat.replaceWith(nb); stat = nb;
    if (info.state !== 'ok' && info.state !== 'offline') { YV.info = null; store.set('yv', null); }
  } }, t('yvCheck'));
  const remove = el('button', { class: 'btn', type: 'button', onclick: () => { set.yvKey = ''; saveSettings(); YV.info = null; store.set('yv', null); YV.cache.clear(); renderSettings(); } }, t('yvRemove'));
  v.append(el('div', { class: 'panel' },
    el('h2', { text: t('yvTitle') }),
    el('p', { class: 'small muted', style: 'margin:0', text: t('yvExplain') }),
    el('div', { class: 'keyrow' }, key, check, set.yvKey ? remove : null),
    stat,
    el('details', { open: !set.yvKey }, el('summary', { style: 'cursor:pointer;font-weight:600;margin-top:12px', text: t('yvSteps') }),
      el('ol', { class: 'steps' }, el('li', { text: t('yvStep1') }), el('li', { text: t('yvStep2') }), el('li', { text: t('yvStep3') }), el('li', { text: t('yvStep4') })),
      el('button', { class: 'btn small', type: 'button', onclick: () => host.open('https://platform.youversion.com/') }, svg('open'), ' ', t('yvOpenPortal')))
  ));
  // the web app: use without internet
  const pp = pwaPanel();
  if (pp) v.append(pp);
  if (pwa.on && !pwa.total && pwa.state === 'idle' && !(pwa.ios && !pwa.standalone)) pwa.measure();
  // about
  v.append(el('div', { class: 'panel' }, el('h2', { text: t('about') }), el('p', { class: 'small', style: 'margin:0 0 6px', text: t('aboutText', { ver: VERSION }) }),
    el('div', { class: 'small', style: 'font-weight:600', text: t('licences') }), el('ul', { class: 'credits' }, t('credits').map((c) => el('li', { text: c })))));
}

// ------------------------------------------------------------------ everything that shows text again after a change
function refresh() {
  $('heroTitle').textContent = t('heroTitle');
  $('heroSub').textContent = t('heroSub');
  $('q').placeholder = matchMedia('(max-width: 760px)').matches ? t('placeholderShort') : t('placeholder');
  $('q').setAttribute('aria-label', t('heroTitle'));
  $('qGo').textContent = t('searchBtn');
  $('qClear').title = t('clear');
  $('themeBtn').title = t('appearance');
  $('setBtn').title = t('tabSettings');
  $('verBtn').title = t('chooseVersion');
  $('verName').textContent = set.version;
  renderTabs();
  status();
  if (S.view === 'search') { if (S.results) renderResults(); else renderHome(); }
  else if (S.view === 'read') renderReader();
  else if (S.view === 'saved') renderSaved();
}

// ------------------------------------------------------------------ events
$('searchForm').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(typing); $('q').blur(); runSearch($('q').value); });
let typing = 0;
$('q').addEventListener('input', () => {
  $('qClear').hidden = !$('q').value;
  clearTimeout(typing);
  const q = $('q').value;
  if (!q.trim()) { clearSearch(); return; }
  typing = setTimeout(() => runSearch(q, false), q.trim().length < 3 ? 600 : 350);
});
$('q').addEventListener('keydown', (e) => { if (e.key === 'Escape') clearSearch(); });
$('qClear').addEventListener('click', () => { clearSearch(); $('q').focus(); });
$('verBtn').addEventListener('click', versionPicker);
$('setBtn').addEventListener('click', () => setView('settings'));
$('themeBtn').addEventListener('click', () => {
  const dark = set.theme === 'dark' || (set.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  set.theme = dark ? 'light' : 'dark'; saveSettings(); applyLook();
});
$('brand').addEventListener('click', (e) => { e.preventDefault(); setView('search'); clearSearch(); });
$('bookBtn').addEventListener('click', bookPicker);
$('prevCh').addEventListener('click', () => moveChapter(-1));
$('nextCh').addEventListener('click', () => moveChapter(1));
document.addEventListener('keydown', (e) => {
  const typingIn = /^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '');
  if (e.key === 'Escape' && !$('sheet').hidden) { closeSheet(); return; }
  if ((e.key === '/' && !typingIn) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); setView('search', { focus: true }); return; }
  if (S.view === 'read' && !typingIn && $('sheet').hidden) {
    if (e.key === 'ArrowLeft') moveChapter(-1);
    if (e.key === 'ArrowRight') moveChapter(1);
  }
});
// Android back button: close what is open, then go back to Search; false = leave the app
window.WBAndroid._back = () => {
  if (!$('sheet').hidden) { closeSheet(); return true; }
  if (S.view === 'read' && S.sel.size) { S.sel = new Set(); renderReader(); return true; }
  if (S.view !== 'search') { setView('search'); return true; }
  if (S.results) { clearSearch(); return true; }
  return false;
};
window.WBAndroid._system = () => applyLook();

// ------------------------------------------------------------------ start
(async function start() {
  applyLang();
  applyLook();
  S.meta = await getJSON('data/meta.json');
  S.books = new Books(S.meta);
  refresh();
  document.documentElement.classList.remove('booting');
  host.ready();
  startPWA();
  text(set.version === 'LSG' ? 'LSG' : 'KJV');
  if (OFFLINE.includes(set.version)) text(set.version);
  // a key saved earlier: check it again now and then (licences can change), quietly
  if (set.yvKey && (!YV.info || Date.now() - (YV.info.checked || 0) > 7 * 864e5)) YV.check().catch(() => {});
  // for automated tests
  window.WB = { S, set, runSearch, runTheme, openAt, openChapter, setView, YV, ask, pwa };
})();
