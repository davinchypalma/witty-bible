// Witty Bible: books, verse numbers and references ("Jn 3:16", "Jean 3,16", "1 Co 13:4-7", "Psaume 23", "Salmo 23").
// Works in the page, in the search worker and in Node (tests).

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const key = (s) => strip(String(s).toLowerCase()).replace(/[.\s]+/g, '');

// Other names and abbreviations people type, English, French and Spanish (the full names come from meta.json).
const ALIASES = {
  GEN: 'gen ge gn genese genesis', EXO: 'ex exo exod exode exodo', LEV: 'lev le lv levitique levitico', NUM: 'num nu nm nb nombres numeros',
  DEU: 'deut deu dt de deuteronome deuteronomio', JOS: 'josh jos jsh josue', JDG: 'judg jdg jg jdgs juges jug jueces jue',
  RUT: 'ruth rth ru rt rut', '1SA': '1sam 1sa 1s 1samuel', '2SA': '2sam 2sa 2s 2samuel', '1KI': '1kgs 1ki 1kg 1kings 1r 1rois 1reyes 1rey',
  '2KI': '2kgs 2ki 2kg 2kings 2r 2rois 2reyes 2rey', '1CH': '1chr 1ch 1chron 1chroniques 1cronicas 1cr 1cro', '2CH': '2chr 2ch 2chron 2chroniques 2cronicas 2cr 2cro',
  EZR: 'ezra ezr esd esdras', NEH: 'neh ne nehemie nehemias', EST: 'esth est esther ester', JOB: 'job jb',
  PSA: 'ps psa psalm psalms pss psaume psaumes psm salmos salmo sal sl', PRO: 'prov pro pr prv proverbes proverbios', ECC: 'eccl ecc ec qoh ecclesiaste eccles qohelet eclesiastes ecl',
  SNG: 'song sng ss songofsongs songofsolomon canticles cantique cantiquedescantiques ct cant cantares cantar cantardeloscantares cnt',
  ISA: 'isa is isaie esaie es isaias', JER: 'jer je jr jeremie jeremias', LAM: 'lam la lm lamentations lamentaciones',
  EZK: 'ezek eze ezk ez ezechiel ezequiel', DAN: 'dan da dn daniel', HOS: 'hos ho os osee oseas', JOL: 'joel jl joe',
  AMO: 'amos am', OBA: 'obad ob oba ab abdias abd', JON: 'jonah jnh jon jonas', MIC: 'mic mi michee micah miqueas miq',
  NAM: 'nah na nam nahum', HAB: 'hab hb ha habacuc habakkuk', ZEP: 'zeph zep zp so soph sophonie sofonias sof',
  HAG: 'hag hg ag aggee hageo', ZEC: 'zech zec zc za zach zacharie zacarias zac', MAL: 'mal ml malachie malaquias',
  MAT: 'matt mat mt matthieu matth mateo', MRK: 'mark mrk mk mr marc mc marcos', LUK: 'luke luk lk lc luc lu lucas',
  JHN: 'john jhn jn jean joh juan', ACT: 'acts act ac actes hechos hch hech hechosdelosapostoles', ROM: 'rom ro rm romains romanos',
  '1CO': '1cor 1co 1corinthians 1corinthiens 1corintios', '2CO': '2cor 2co 2corinthians 2corinthiens 2corintios',
  GAL: 'gal ga galates galatas', EPH: 'eph ephes ep ephesiens efesios ef', PHP: 'phil php pp ph philippiens phi filipenses fil flp',
  COL: 'col colossiens colosenses', '1TH': '1thess 1th 1thes 1thessaloniciens 1tesalonicenses 1ts 1tes', '2TH': '2thess 2th 2thes 2thessaloniciens 2tesalonicenses 2ts 2tes',
  '1TI': '1tim 1ti 1tm 1timothee 1timoteo', '2TI': '2tim 2ti 2tm 2timothee 2timoteo', TIT: 'titus tit tt tite tito',
  PHM: 'philem phm pm phlm philemon filemon flm', HEB: 'heb he hebreux hebrews hebreos', JAS: 'jas jm jc james jacques jam santiago stg sant',
  '1PE': '1pet 1pe 1pt 1p 1pierre 1peter 1pedro', '2PE': '2pet 2pe 2pt 2p 2pierre 2peter 2pedro',
  '1JN': '1john 1jn 1jo 1jean 1jhn 1juan', '2JN': '2john 2jn 2jo 2jean 2jhn 2juan', '3JN': '3john 3jn 3jo 3jean 3jhn 3juan',
  JUD: 'jude jud jd judas', REV: 'rev re rv revelation revelations ap apoc apocalypse apocalypsis apocalipsis'
};
// Abbreviations that mean one book in English and another in French or Spanish.
const BY_LANG = { es: { fr: 'ISA', en: 'EST', es: 'EST' }, mc: { fr: 'MRK', en: 'MIC', es: 'MRK' } };
const ORDINALS = [
  [/^(1|i|1st|first|premier|premiere|1er|1re|1ere|primera|primero|primer)(?=[a-z])/, '1'],
  [/^(2|ii|2nd|second|seconde|deuxieme|2e|2eme|segunda|segundo)(?=[a-z])/, '2'],
  [/^(3|iii|3rd|third|troisieme|3e|3eme|tercera|tercero|tercer)(?=[a-z])/, '3']
];

export class Books {
  constructor(meta) {
    this.list = meta.books;
    this.first = [];                       // first[b][c] = index of chapter c (1-based), verse 1
    let k = 0;
    this.starts = [];                      // [index, book, chapter] for every chapter, in order
    meta.books.forEach((b, bi) => {
      const row = [0];
      b.chapters.forEach((nv, ci) => { row.push(k); this.starts.push([k, bi, ci + 1]); k += nv; });
      this.first.push(row);
    });
    this.count = k;
    this.byKey = new Map();
    meta.books.forEach((b, bi) => {
      for (const n of [b.en, b.fr, b.es || b.en, b.usfm, b.osis, b.en.replace(/s$/, '')]) this.byKey.set(key(n), bi);
      for (const a of (ALIASES[b.usfm] || '').split(' ')) if (a) this.byKey.set(key(a), bi);
    });
    this.byUsfm = new Map(meta.books.map((b, i) => [b.usfm, i]));
  }

  index(b, c, v) {                         // book 0-65, chapter 1-…, verse 1-… → verse index, or -1
    const bk = this.list[b];
    if (!bk || c < 1 || c > bk.chapters.length || v < 1 || v > bk.chapters[c - 1]) return -1;
    return this.first[b][c] + v - 1;
  }

  locate(i) {                              // verse index → { b, c, v }
    let lo = 0, hi = this.starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.starts[mid][0] <= i) lo = mid; else hi = mid - 1;
    }
    const [k, b, c] = this.starts[lo];
    return { b, c, v: i - k + 1 };
  }

  chapterRange(b, c) {                     // → [first index, last index]
    const s = this.first[b][c];
    return [s, s + this.list[b].chapters[c - 1] - 1];
  }

  bookName(b, lang, single) {
    const bk = this.list[b];
    let n = lang === 'fr' ? bk.fr : lang === 'es' ? bk.es || bk.en : bk.en;
    if (single && bk.usfm === 'PSA') n = lang === 'fr' ? 'Psaume' : lang === 'es' ? 'Salmo' : 'Psalm';
    return n;
  }

  // "John 3:16", "John 3:16–18", "Psalm 23:1", "Jean 3:16", "Philemon 4"
  label(a, z = a, lang = 'en') {
    const p = this.locate(a), q = this.locate(z);
    const name = this.bookName(p.b, lang, true);
    if (a === z) return `${name} ${p.c}:${p.v}`;
    if (p.c === q.c && p.b === q.b) return `${name} ${p.c}:${p.v}–${q.v}`;
    return `${name} ${p.c}:${p.v}–${q.c}:${q.v}`;
  }

  chapterLabel(b, c, lang = 'en') { return `${this.bookName(b, lang, true)} ${c}`; }

  // USFM passage id for YouVersion: JHN.3.16 or JHN.3.16-18 (one chapter at a time)
  usfm(a, z = a) {
    const p = this.locate(a), q = this.locate(z);
    const code = this.list[p.b].usfm;
    if (a === z || p.c !== q.c) return `${code}.${p.c}.${p.v}`;
    return `${code}.${p.c}.${p.v}-${q.v}`;
  }

  // Finds a book at the start of the text: → { b, rest } or null
  findBook(text, lang) {
    // Spanish: "1ra Corintios", "2da Timoteo", "1a Juan", "1° Reyes", "1ra de Juan", "Primera de Corintios" → "1 corintios"
    let t = strip(text.toLowerCase()).replace(/^\s+/, '')
      .replace(/^([123])\s*(?:(?:ra|da|ro|do|er|a|o)\b\.?|[°º])\s*(?:de\s+(?=[a-z]))?/, '$1 ').replace(/^(primera|primero|primer|segunda|segundo|tercera|tercero|tercer)\s+de\s+/, '$1 ');
    let ord = '';
    // "1 Cor", "1co", "I Cor", "1st Corinthians", "Premier Jean": a digit may touch the name, words need a space
    const m0 = /^(?:([123])\s*[.]?\s*|(i{1,3}|1st|2nd|3rd|first|second|third|premier|premiere|1er|1re|1ere|deuxieme|2e|2eme|troisieme|3e|3eme|primera|primero|primer|segunda|segundo|tercera|tercero|tercer)[.]?\s+)(?=[a-z])/.exec(t);
    if (m0) {
      const w = m0[1] || m0[2];
      for (const [re, d] of ORDINALS) if (re.test(w + 'x')) ord = d;
      if (ord) t = t.slice(m0[0].length);
    }
    // longest run of letters and spaces that is a book name ("song of songs", "cantique des cantiques")
    const m = /^([a-z]+(?:\s+[a-z]+){0,3})/.exec(t);
    if (!m) return null;
    const words = m[1].split(/\s+/);
    for (let n = words.length; n >= 1; n--) {
      const cand = ord + words.slice(0, n).join('');
      let b = this.byKey.get(cand);
      const amb = BY_LANG[cand];
      if (amb) b = this.byUsfm.get(amb[lang] || amb.en);
      if (b !== undefined) {
        const used = words.slice(0, n).join(' ');
        const at = t.indexOf(used) + used.length;
        return { b, rest: t.slice(at) };
      }
    }
    return null;
  }

  // A whole reference: → { b, c, v, a, z } (a/z: first and last verse index; v = 0 for a whole chapter) or null.
  // "John 3:16" "jn3.16" "Jean 3,16" "1 Co 13:4-7" "Ps 23" "Jude 3" "Romains 8:38-39" "John 3:16-4:2"
  parse(text, lang = 'en') {
    const q = String(text).trim().replace(/\s+(kjv|bsb|niv|nkjv|esv|nlt|lsg|web)$/i, '');
    const f = this.findBook(q, lang);
    if (!f) return null;
    const rest = f.rest.trim();
    const bk = this.list[f.b];
    if (!rest) return { b: f.b, c: 0, v: 0, a: this.first[f.b][1], z: this.first[f.b][1], book: true };
    const m = /^(\d{1,3})(?:\s*[:.,]\s*|\s+)?(\d{1,3})?(?:\s*(?:-|–|—|to|a|au)\s*(\d{1,3})(?:\s*[:.,]\s*(\d{1,3}))?)?\s*$/.exec(rest);
    if (!m) return null;
    let c = +m[1], v = m[2] ? +m[2] : 0;
    let c2 = c, v2 = 0;
    if (m[4]) { c2 = +m[3]; v2 = +m[4]; } else if (m[3]) v2 = +m[3];
    if (bk.chapters.length === 1 && !m[2]) {           // Jude 3, Philemon 4: the number is the verse
      v = c; c = 1;
      if (m[3] && !m[4]) v2 = +m[3];
      c2 = 1;
    }
    if (c < 1 || c > bk.chapters.length) return null;
    if (!v) {
      const [a, z] = this.chapterRange(f.b, c);
      return { b: f.b, c, v: 0, a, z };
    }
    v = Math.min(v, bk.chapters[c - 1]);
    const a = this.index(f.b, c, v);
    let z = a;
    if (v2) {
      c2 = Math.min(Math.max(c2, c), bk.chapters.length);
      const zz = this.index(f.b, c2, Math.min(v2, bk.chapters[c2 - 1]));
      if (zz >= a) z = zz;
    }
    if (z - a > 200) z = a + 200;
    return { b: f.b, c, v, a, z };
  }
}
