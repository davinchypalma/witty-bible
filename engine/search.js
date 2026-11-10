// Witty Bible: the search. Finds verses for a theme, a situation or words remembered, by combining:
//  - meaning: the AI vector of the question against every verse (KJV and BSB wording, the closer one counts)
//  - themes: OpenBible.info themes close to the question, and the verses people voted best for them
//  - headings: BSB section headings close to the question ("Do Not Worry") and the well-known verses under them
//  - words: verses that contain the words typed (any form: forgive, forgiven, forgiveness), the exact phrase above all
//  - how well known a verse is (votes), so the verse people mean comes before a lookalike
// Runs in the search worker and in Node (tests). No screen code here.

const DIM = 384;

export function readMatrix(buffer) {         // 'WEMB' | rows | dims | scale[rows] | int8[rows*dims]
  const dv = new DataView(buffer);
  if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'WEMB') throw new Error('bad index file');
  const rows = dv.getUint32(4, true), dims = dv.getUint32(8, true);
  if (dims !== DIM) throw new Error('unexpected vector size');
  const scale = new Float32Array(buffer.slice(12, 12 + 4 * rows));
  const data = new Int8Array(buffer, 12 + 4 * rows, rows * dims);
  return { rows, scale, data };
}

// all rows · q  (q: Float32Array of 384)
function dots(m, q, out) {
  const d = m.data, s = m.scale;
  for (let r = 0, o = 0; r < m.rows; r++, o += DIM) {
    let a = 0;
    for (let k = 0; k < DIM; k += 8) {
      a += d[o + k] * q[k] + d[o + k + 1] * q[k + 1] + d[o + k + 2] * q[k + 2] + d[o + k + 3] * q[k + 3]
        + d[o + k + 4] * q[k + 4] + d[o + k + 5] * q[k + 5] + d[o + k + 6] * q[k + 6] + d[o + k + 7] * q[k + 7];
    }
    out[r] = a * s[r];
  }
  return out;
}

function topK(arr, k, min = -Infinity) {     // indices of the k largest values
  const idx = [];
  let floor = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v < min || (idx.length >= k && v <= floor)) continue;
    idx.push(i);
    if (idx.length > k * 4) { idx.sort((a, b) => arr[b] - arr[a]); idx.length = k; floor = arr[idx[k - 1]]; }
  }
  idx.sort((a, b) => arr[b] - arr[a]);
  if (idx.length > k) idx.length = k;
  return idx;
}

// ------------------------------------------------------------------ words
const STOP = new Set(('a an the and or of to in on at for with by from as is are was were be been am i me my mine we us our you your ' +
  'he him his she her it its they them their this that these those what which who whom whose when where why how do does did ' +
  'not no yes so if then than there here about into over under up down out off again just very can could would should will ' +
  'shall may might must have has had having all any some such only own same too also more most other verse verses bible ' +
  'scripture scriptures passage passages say says said about want need feel feeling find show give me something ' +
  'le la les un une des du de d l et ou au aux a en dans sur pour par avec sans ce cet cette ces je j me m moi tu te t toi il ' +
  'elle on nous vous ils elles leur leurs mon ma mes ton ta tes son sa ses notre nos votre vos qui que qu quoi dont ou est sont ' +
  'etre ai as avons avez ont suis es sommes etes fait faire plus moins tres pas ne n y verset versets parle parlent ' +
  'quand comment pourquoi').split(' '));
const deaccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function words(text) {
  return deaccent(String(text).toLowerCase()).replace(/[’'`]/g, ' ').match(/[a-z0-9]+/g) || [];
}

// A rough stem, English and French, KJV included: forgiveness → forgiv, believeth → believ, inquiétez → inquiet
export function stem(w) {
  if (w.length <= 3) return w;
  const rules = [
    [/(iveness|fulness|lessness)$/, ''], [/(ments?)$/, ''], [/(ations?|ition|itions)$/, ''], [/(nesses|ness)$/, ''],
    [/(ingly|edly)$/, ''], [/(ings?|eth|est|edst|ed|ers?|ly|ies|es|s)$/, ''],
    [/(eront|erons|erez|eraient|erait|ions|iez|aient|ait|ant|ent|ez|er|ee?s?|ais)$/, ''], [/(eux|euse|euses|ite|ites)$/, ''],
    [/(e|x)$/, '']
  ];
  let s = w;
  for (const [re, r] of rules) {
    const t = s.replace(re, r);
    if (t !== s && t.length >= 3) { s = t; break; }
  }
  if (s.length > 4 && /(e|y|i)$/.test(s)) s = s.slice(0, -1);
  return s;
}

// What people add around what they look for: "a verse about…", "what does the Bible say about…", "un verset sur…"
const FILLER = [
  /^(please\s+)?(can you\s+|could you\s+)?(find|show|give|tell)(\s+me)?\s+/i,
  /^(i\s+(need|want|am looking for|'m looking for)|looking for|search(ing)? for)\s+/i,
  /^what does the (bible|scripture|word of god) (say|teach) (about|on)\s+/i,
  /^((a|an|the|some|any)\s+)?(bible\s+|scripture\s+)?(verses?|scriptures?|passages?)(\s+in the bible)?(\s+(about|on|for|that (says|talks about|speaks about)|where|when|to read when|to read for|of|with))?\s+/i,
  /^(the\s+)?(one|verse)\s+(that says|where|about)\s+/i,
  /^(trouve(-moi)?|donne(-moi)?|montre(-moi)?|cherche)\s+/i,
  /^(j'ai besoin d'|je cherche)\s*/i,
  /^que (dit|enseigne) la bible (sur|à propos de|au sujet de)\s+/i,
  /^((un|le|les|des|quelques)\s+)?(versets?|passages?)(\s+bibliques?)?(\s+(sur|pour|qui (dit|parle de|parlent de)|où|quand|à lire quand|à propos de|au sujet de|de))?\s+/i
];
export function clean(text) {
  let s = String(text).trim().replace(/[?!.]+$/, '').trim();
  for (let k = 0; k < 3; k++) {
    const before = s;
    for (const re of FILLER) s = s.replace(re, '');
    if (s === before) break;
  }
  return s.trim() || String(text).trim();
}

export class Engine {
  constructor(d) {
    // d: { books, kjvPlain[], bsbPlain[], pop: Uint8Array, kjv, bsb, topic, head: matrices,
    //      topicNames[], topicPassages[][], headIdx[] }
    Object.assign(this, d);
    this.n = d.kjvPlain.length;
    this.semK = new Float32Array(this.n);
    this.semB = new Float32Array(this.n);
    this.semL = new Float32Array(this.n);
    this.tsim = new Float32Array(d.topic.rows);
    this.hsim = new Float32Array(d.head.rows);
    this.asim = d.alias ? new Float32Array(d.alias.rows) : null;
    this.ssim = d.seg ? new Float32Array(d.seg.rows) : null;
    this.topicMax = d.topicPassages.map((p) => (p.length ? p[2] : 1));
    this.topicKey = d.topicNames.map((nm) => words(nm).filter((w) => !STOP.has(w)).map(stem).sort().join(' '));
    // where each heading's section ends (the next heading, the end of the chapter, or 40 verses)
    this.headEnd = new Int32Array(d.head.rows);
    for (let h = 0; h < d.head.rows; h++) {
      const a = d.headIdx[h];
      const next = h + 1 < d.head.rows ? d.headIdx[h + 1] - 1 : this.n - 1;
      const loc = d.books.locate(a);
      const chEnd = d.books.chapterRange(loc.b, loc.c)[1];
      this.headEnd[h] = Math.min(next, chEnd, a + 39);
    }
    this.buildWordIndex();
    this.weights = Object.assign({}, Engine.WEIGHTS);
  }

  static WEIGHTS = { sem: 1.0, topic: 0.55, head: 0.25, lex: 0.45, phrase: 0.9, pop: 0.18, topicFloor: 0.84, topicFull: 0.95,
    namedTheme: 0.965, namedBoost: 1.4, namedLex: 0.35, oneWord: 0.5, headFloor: 0.85, zFloor: 2.0, aliasFloor: 0.86, themeWeight: 0.8, segPenalty: 0.005 };

  // words.bin (tools/build_words.mjs): the same index, made ahead of time
  static readWords(buffer) {
    const dv = new DataView(buffer);
    const ns = dv.getUint32(4, true), total = dv.getUint32(8, true);
    const offsets = new Uint32Array(buffer, 12, ns + 1);
    const post = new Uint16Array(buffer, 12 + 4 * (ns + 1), total);
    const names = new TextDecoder().decode(new Uint8Array(buffer, 12 + 4 * (ns + 1) + 2 * total)).split('\n');
    const map = new Map();
    for (let j = 0; j < ns; j++) map.set(names[j], post.subarray(offsets[j], offsets[j + 1]));
    return map;
  }

  // exact phrases: every verse's words in a row, made the first time a phrase is searched
  phraseText() {
    if (this.norm) return this.norm;
    this.norm = new Array(this.n);
    for (let i = 0; i < this.n; i++) {
      this.norm[i] = ' ' + words(this.kjvPlain[i]).join(' ') + ' ~ ' + words(this.bsbPlain[i]).join(' ') + ' ~ ' +
        (this.lsgPlain ? words(this.lsgPlain[i]).join(' ') : '') + ' ';
    }
    return this.norm;
  }

  buildWordIndex() {
    if (this.words) { this.index = this.words; return; }
    const map = new Map();
    const add = (w, i) => {
      let a = map.get(w);
      if (!a) map.set(w, (a = []));
      if (a[a.length - 1] !== i) a.push(i);
    };
    this.norm = new Array(this.n);           // lower case, no accents or punctuation: for exact phrases
    for (let i = 0; i < this.n; i++) {
      const wk = words(this.kjvPlain[i]), wb = words(this.bsbPlain[i]), wl = this.lsgPlain ? words(this.lsgPlain[i]) : [];
      const ws = wk.concat(wb, wl);
      this.norm[i] = ' ' + wk.join(' ') + ' ~ ' + wb.join(' ') + ' ~ ' + wl.join(' ') + ' ';
      const seen = new Set();
      for (const w of ws) {
        const s = stem(w);
        if (seen.has(s)) continue;
        seen.add(s);
        add(s, i);
      }
    }
    this.index = map;
  }

  // q: the question's AI vector (Float32Array 384), or null while the AI is still loading (words and themes only).
  search(text, q, opts = {}) {
    const W = Object.assign({}, this.weights, opts.weights || {});
    const n = this.n;
    const score = new Float32Array(n);
    const why = new Uint8Array(n);            // 1 meaning, 2 theme, 4 heading, 8 words, 16 phrase
    let topics = [];
    const themes = [];
    let named = false;
    const cand = new Set();

    // meaning
    if (q) {
      dots(this.kjv, q, this.semK);
      dots(this.bsb, q, this.semB);
      if (this.lsg) dots(this.lsg, q, this.semL);
      let sum = 0, sum2 = 0, max = -1;
      const sem = this.semK;                   // reused: the closest of the wordings (KJV, BSB, LSG)
      for (let i = 0; i < n; i++) {
        let v = this.semB[i] > sem[i] ? this.semB[i] : sem[i];
        if (this.lsg && this.semL[i] > v) v = this.semL[i];
        sem[i] = v;
      }
      if (this.seg) {                          // a part of a long, well-known verse can stand for the verse
        dots(this.seg, q, this.ssim);
        for (let r = 0; r < this.seg.rows; r++) {
          const i = this.segVerse[r], v = this.ssim[r] - W.segPenalty;
          if (v > sem[i]) sem[i] = v;
        }
      }
      for (let i = 0; i < n; i++) { const v = sem[i]; sum += v; sum2 += v * v; if (v > max) max = v; }
      const mean = sum / n, sd = Math.sqrt(Math.max(1e-9, sum2 / n - mean * mean));
      const zmax = (max - mean) / sd;
      const z0 = Math.min(W.zFloor + 0.35 * Math.max(0, zmax - 4), zmax - 0.5);
      for (const i of topK(sem, 400)) {
        const z = (sem[i] - mean) / sd;
        const v = Math.max(0, (z - z0) / Math.max(0.5, zmax - z0));
        if (v <= 0) continue;
        score[i] += W.sem * v;
        why[i] |= 1;
        cand.add(i);
      }
      this.lastZ = { mean, sd, zmax, max };

      // themes
      dots(this.topic, q, this.tsim);
      // near-identical theme names count once ("struggle", "struggles", "struggling"), so others get a place
      const tt = [], seenNames = new Set();
      for (const t of topK(this.tsim, 24)) {
        const k = this.topicKey[t];
        if (seenNames.has(k)) continue;
        seenNames.add(k);
        tt.push(t);
        if (tt.length >= 8) break;
      }
      const best = this.tsim[tt[0]];
      named = best >= W.namedTheme;              // the question is a theme's name ("grief", "anxiety")
      const floor = Math.max(W.topicFloor, best - 0.06);
      for (const t of tt) {
        const s = this.tsim[t];
        if (s < floor) break;
        const w = Math.min(1, (s - W.topicFloor) / (W.topicFull - W.topicFloor)) * (s === best ? 1 : 0.8) * (named ? W.namedBoost : 1);
        topics.push({ t, name: this.topicNames[t], sim: s, w });
        this.addTopic(t, w, score, why, cand, W);
      }

      // the home screen's themes, by their English and French names and what people type for them
      if (this.alias) {
        dots(this.alias, q, this.asim);
        const bestOf = new Map();
        for (let r = 0; r < this.alias.rows; r++) {
          const k = this.aliasTheme[r];
          if (!(bestOf.get(k) >= this.asim[r])) bestOf.set(k, this.asim[r]);
        }
        const ranked = [...bestOf].sort((a, b) => b[1] - a[1]).slice(0, 3);
        const top = ranked.length ? ranked[0][1] : 0;
        if (top >= W.namedTheme) named = true;
        for (const [k, sim] of ranked) {
          if (sim < Math.max(W.aliasFloor, top - 0.04)) break;
          const w = Math.min(1, (sim - W.aliasFloor) / (W.topicFull - W.aliasFloor)) * (sim === top ? 1 : 0.75);
          themes.push({ id: this.themes[k].id, sim });
          this.themes[k].topics.forEach((t, j) => this.addTopic(t, w * W.themeWeight * Math.pow(0.85, j) * (named ? W.namedBoost : 1), score, why, cand, W));
        }
      }

      // headings
      dots(this.head, q, this.hsim);
      const hh = topK(this.hsim, 5);
      const hbest = this.hsim[hh[0]];
      const hfloor = Math.max(W.headFloor, hbest - 0.05);
      for (const h of hh) {
        const s = this.hsim[h];
        if (s < hfloor) break;
        const w = (s - hfloor + 0.02) / (1 - hfloor + 0.02);
        for (let i = this.headIdx[h]; i <= this.headEnd[h]; i++) {
          score[i] += W.head * w * (0.35 + 0.65 * this.pop[i] / 255);
          why[i] |= 4;
          cand.add(i);
        }
      }
    }

    // words and exact phrase
    const ws = words(text).filter((w) => !STOP.has(w));
    const terms = [...new Set(ws.map(stem))].filter((s) => s.length >= 2);
    if (terms.length) {
      const hits = new Map(), rare = new Map();
      let idfSum = 0;
      for (const s of terms) {
        const list = this.index.get(s);
        if (!list || list.length > 6000) continue;      // a word in every other verse says nothing
        const idf = Math.log(n / list.length) / Math.log(n);
        idfSum += idf;
        for (const i of list) {
          hits.set(i, (hits.get(i) || 0) + idf);
          if (list.length <= 80) rare.set(i, (rare.get(i) || 0) + 1);
        }
      }
      const lexW = W.lex * (terms.length === 1 ? W.oneWord : 1) * (named ? W.namedLex : 1);
      if (idfSum > 0) {
        for (const [i, h] of hits) {
          const f = h / idfSum;
          if (f < 0.5 && terms.length > 1 && !(rare.get(i) && f >= 0.25)) continue;
          score[i] += lexW * f * f;
          why[i] |= 8;
          cand.add(i);
        }
      }
    }
    const all = words(text);
    if (all.length >= 3) {
      const phrase = ' ' + all.join(' ') + ' ';
      const norm = this.phraseText();
      for (let i = 0; i < n; i++) {
        if (norm[i].includes(phrase)) { score[i] += W.phrase; why[i] |= 16; cand.add(i); }
      }
    }

    // how well known
    for (const i of cand) score[i] += W.pop * this.pop[i] / 255 * (why[i] & 30 ? 1 : 0.6);

    const list = [...cand].sort((a, b) => score[b] - score[a]).slice(0, opts.limit || 60);
    return {
      verses: list.map((i) => ({ i, score: score[i], why: why[i] })),
      topics: topics.map((x) => ({ name: x.name, sim: x.sim })),
      themes
    };
  }

  // the verses people voted for a theme, weighted by how close the theme is (w)
  addTopic(t, w, score, why, cand, W) {
    const p = this.topicPassages[t], mx = this.topicMax[t];
    for (let k = 0; k < p.length && k < 120; k += 3) {
      const a = p[k], z = p[k + 1], votes = p[k + 2];
      const b = w * Math.sqrt(votes / mx);
      if (b < 0.04) break;
      for (let i = a; i <= z && i < a + 4; i++) {
        score[i] += W.topic * b * (i === a ? 1 : 0.85);
        why[i] |= 2;
        cand.add(i);
      }
    }
  }

  // A home screen theme: its best verses, in order (no question typed)
  theme(id, limit = 60) {
    const k = this.themes.findIndex((t) => t.id === id);
    if (k < 0) return { verses: [], topics: [] };
    const score = new Float32Array(this.n), why = new Uint8Array(this.n), cand = new Set();
    const W = Object.assign({}, this.weights, { topic: 1 });
    this.themes[k].topics.forEach((t, j) => this.addTopic(t, Math.pow(0.8, j), score, why, cand, W));
    for (const i of cand) score[i] += 0.12 * this.pop[i] / 255;
    const list = [...cand].sort((a, b) => score[b] - score[a]).slice(0, limit);
    return { verses: list.map((i) => ({ i, score: score[i], why: 2 })), topics: [] };
  }

  related(i, max = 12) {                      // cross references of a verse: [{ a, z, votes }]
    const x = this.xrefs;
    if (!x) return [];
    const out = [];
    for (let k = x.offsets[i]; k < x.offsets[i + 1] && out.length < max; k++) {
      out.push({ a: x.data[3 * k], z: x.data[3 * k] + x.data[3 * k + 1], votes: x.data[3 * k + 2] });
    }
    return out;
  }
}
