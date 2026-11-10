// Witty Bible: the search runs here, beside the page, so typing never waits. Everything is read from the app's own
// files: the Bible texts, the verse index, the word index and the AI model (run with ONNX Runtime, WebAssembly).
import { Tokenizer } from './tokenizer.js';
import { Books } from './refs.js';
import { Engine, readMatrix, clean } from './search.js';
import * as ort from '../ort/ort.wasm.min.mjs';

const ROOT = new URL('../', import.meta.url);
const DATA = new URL('data/', ROOT);
let engine = null, books = null, tok = null, sess = null, extra = null;

// ------------------------------------------------------------------ the Ethiopian Bible's other books (non-biblical)
// Shown apart from the Bible: their own section after the results, and their own chapters in Read.
const fold = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();
function Extra(data, mat) {
  const rows = [];                                     // vector row → [book index, chapter, verse label, text]
  data.books.forEach((b, bi) => b.chapters.forEach((ch, ci) => ch.forEach(([v, t]) => rows.push([bi, b.first + ci, v, t]))));
  if (rows.length !== mat.rows) throw new Error('extra books: vectors do not match');
  const names = data.books.flatMap((b, bi) => b.alias.map((a) => [fold(a), bi])).sort((x, y) => y[0].length - x[0].length);
  return { books: data.books, rows, mat, names };
}
const extraBook = (b) => ({ id: b.id, en: b.en, fr: b.fr, tr: b.tr, first: b.first, chapters: b.chapters.length });
function extraVerse(r, score) {
  const b = extra.books[r[0]];
  return { x: b.id, c: r[1], v: r[2], text: r[3], score };
}
// "Tobit 4:15", "1 Enoch 6", "Hénoch 1:9-10", "Susanna 45" → the verses, or null
function extraRef(text) {
  const s = fold(text).replace(/(\d)\s*[:.,]\s*(\d)/g, '$1:$2').replace(/\.$/, '');
  for (const [name, bi] of extra.names) {
    if (!s.startsWith(name)) continue;
    const m = /^ ?(\d+)?(?::(\d+)(?:\s*[-–]\s*(\d+))?)?$/.exec(s.slice(name.length));
    if (!m || (!m[1] && s.length !== name.length)) continue;
    if (!m[1] && !/[ 0-9]/.test(name)) continue;       // "wisdom", "enoch" alone are ordinary searches; "1 enoch" opens the book
    const b = extra.books[bi];
    let c = m[1] ? +m[1] : b.first, v1 = m[2] ? +m[2] : 0, v2 = m[3] ? +m[3] : v1;
    if (b.chapters.length === 1 && m[1] && !m[2] && +m[1] > 1) { v1 = v2 = +m[1]; c = b.first; }   // "Susanna 45"
    if (c < b.first || c >= b.first + b.chapters.length) return null;
    const ch = b.chapters[c - b.first];
    const pick = v1 ? ch.filter(([v]) => parseInt(v, 10) >= v1 && parseInt(v, 10) <= v2) : ch.slice(0, 3);
    if (!pick.length) return null;
    return { x: b.id, c, v1, v2, whole: !v1, verses: pick.map(([v, t]) => ({ x: b.id, c, v, text: t, score: 1 })) };
  }
  return null;
}
// the verses nearest in meaning to the question (q: its AI vector)
function extraSearch(q, limit) {
  const { mat, rows } = extra, d = mat.data, sc = mat.scale, n = mat.rows, out = [];
  for (let r = 0; r < n; r++) {
    let s = 0;
    const o = r * 384;
    for (let k = 0; k < 384; k++) s += d[o + k] * q[k];
    out.push([s * sc[r], r]);
  }
  out.sort((a, b) => b[0] - a[0]);
  return out.slice(0, limit).map(([s, r]) => extraVerse(rows[r], s));
}
let aiError = null;
const waiting = [];

const bin = async (name) => {
  const r = await fetch(new URL(name, DATA));
  if (!r.ok) throw new Error(`${name}: ${r.status}`);
  return r.arrayBuffer();
};
const json = async (name) => JSON.parse(new TextDecoder().decode(await bin(name)));
const strip = (s) => (s || '').replace(/<\/?[inj]>/g, '').replace(/[\n\t]/g, ' ').replace(/ {2,}/g, ' ').trim();
const say = (m) => self.postMessage(m);

async function loadData() {
  const t0 = Date.now();
  const [meta, kjv, bsb, lsg, pop, topics, xb, heads, words, themes, aliasTheme, segVerse] = await Promise.all([
    json('meta.json'), json('kjv.json'), json('bsb.json'), json('lsg.json'), bin('pop.bin'), json('topics.json'), bin('xrefs.bin'),
    json('heads-index.json'), bin('words.bin'), json('themes.json'), json('alias-theme.json'), bin('seg-verse.bin')
  ]);
  say({ type: 'progress', stage: 'texts' });
  const [ek, eb, el, et, eh, ea, es, ex] = await Promise.all(['emb-kjv.bin', 'emb-bsb.bin', 'emb-lsg.bin', 'emb-topic.bin', 'emb-head.bin',
    'emb-alias.bin', 'emb-seg.bin', 'emb-extra.bin'].map(bin));
  extra = Extra(await json('extra.json'), readMatrix(ex));
  books = new Books(meta);
  const dv = new DataView(xb);
  const n = dv.getUint32(0, true), m = dv.getUint32(4, true);
  engine = new Engine({
    books, kjvPlain: kjv.text.map(strip), bsbPlain: bsb.text.map(strip), lsgPlain: lsg.text.map(strip),
    pop: new Uint8Array(pop), kjv: readMatrix(ek), bsb: readMatrix(eb), lsg: readMatrix(el), topic: readMatrix(et),
    head: readMatrix(eh), alias: readMatrix(ea), seg: readMatrix(es), segVerse: new Uint16Array(segVerse),
    topicNames: topics.names, topicPassages: topics.passages, headIdx: heads, themes: themes.themes,
    aliasTheme, words: Engine.readWords(words),
    xrefs: { offsets: new Uint32Array(xb, 8, n + 1), data: new Uint16Array(xb, 8 + 4 * (n + 1), 3 * m) }
  });
  say({ type: 'ready', ms: Date.now() - t0 });
}

async function loadAI() {
  try {
    const t0 = Date.now();
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmPaths = new URL('ort/', ROOT).href;
    ort.env.wasm.proxy = false;
    const [vocab, model] = await Promise.all([bin('vocab.bin'), bin('model.onnx')]);
    tok = new Tokenizer(vocab);
    sess = await ort.InferenceSession.create(new Uint8Array(model), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    await embed('query: hello');                         // warm up
    say({ type: 'ai', ms: Date.now() - t0 });
  } catch (e) {
    aiError = String(e && e.message || e);
    say({ type: 'ai-error', message: aiError });
  }
}

async function embed(text) {
  const ids = tok.encode(text);
  const n = ids.length;
  const out = await sess.run({
    input_ids: new ort.Tensor('int64', BigInt64Array.from(ids, (x) => BigInt(x)), [1, n]),
    attention_mask: new ort.Tensor('int64', new BigInt64Array(n).fill(1n), [1, n]),
    token_type_ids: new ort.Tensor('int64', new BigInt64Array(n), [1, n])
  });
  const h = out.last_hidden_state.data, v = new Float32Array(384);
  for (let t = 0; t < n; t++) for (let d = 0; d < 384; d++) v[d] += h[t * 384 + d];
  let s = 0;
  for (let d = 0; d < 384; d++) s += v[d] * v[d];
  s = Math.sqrt(s) || 1;
  for (let d = 0; d < 384; d++) v[d] /= s;
  return v;
}

let latest = 0;
async function handle(m) {
  if (m.type === 'search') {
    if (m.id < latest) return;                          // a newer search came in meanwhile
    latest = m.id;
    const text = clean(m.text);
    const q = sess ? await embed('query: ' + text) : null;
    if (m.id < latest) return;
    const t0 = performance.now();
    const ref = extraRef(m.text);
    if (ref) {
      say({ type: 'results', id: m.id, verses: [], topics: [], themes: [], ai: true, extra: ref.verses, extraRef: ref, ms: 0 });
      return;
    }
    engine.lastZ = null;
    const r = engine.search(text, q, { lang: m.lang, limit: m.limit || 60 });
    // The extra books come after the Bible's results; before them only when they match clearly better (Tobit, Susanna…),
    // and not at all when the Bible matches far better. (Measured on questions about both; French questions meet only
    // English texts there, so they get more room.)
    let ex = [], place = null;
    if (q && m.extra !== false && engine.lastZ) {
      const all = extraSearch(q, 6), diff = all[0].score - engine.lastZ.max;
      place = diff >= 0.01 ? 'top' : diff >= (m.lang === 'fr' ? -0.07 : -0.04) ? 'bottom' : null;
      if (place) ex = all.filter((x) => x.score >= all[0].score - 0.012).slice(0, place === 'top' ? 5 : 3);
    }
    say({ type: 'results', id: m.id, verses: r.verses, topics: r.topics, themes: r.themes, ai: !!q, extra: ex, extraPlace: place,
      ms: Math.round(performance.now() - t0) });
  } else if (m.type === 'theme') {
    const r = engine.theme(m.theme, m.limit || 60);
    say({ type: 'results', id: m.id, verses: r.verses, topics: [], themes: [{ id: m.theme, sim: 1 }], ai: true, theme: m.theme });
  } else if (m.type === 'extraBooks') {
    say({ type: 'extraBooks', id: m.id, books: extra.books.map(extraBook) });
  } else if (m.type === 'extraChapter') {
    const b = extra.books.find((x) => x.id === m.x);
    const ch = b && b.chapters[m.c - b.first];
    say({ type: 'extraChapter', id: m.id, book: b ? extraBook(b) : null, c: m.c, verses: ch || [] });
  } else if (m.type === 'related') {
    say({ type: 'related', id: m.id, list: engine.related(m.i, 16) });
  }
}

self.onmessage = (e) => {
  const m = e.data || {};
  if (!engine) { waiting.push(m); return; }
  handle(m).catch((err) => say({ type: 'error', id: m.id, message: String(err && err.message || err) }));
};

loadData().then(() => {
  for (const m of waiting.splice(0)) handle(m).catch((err) => say({ type: 'error', id: m.id, message: String(err && err.message || err) }));
}).catch((err) => say({ type: 'fatal', message: String(err && err.message || err) }));
loadAI();
