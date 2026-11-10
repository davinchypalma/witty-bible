// Witty Bible: the AI model's tokenizer (SentencePiece "Unigram", as in multilingual-e5-small / XLM-R),
// written out so the app needs no library: it cuts text into the word pieces the model knows.
// Same results as the Hugging Face tokenizer for ordinary text (checked by test/tokenizer.mjs).
//
// vocab.bin: 'WVOC' | uint32 count | float32 score[count] | UTF-8 pieces joined by '\n'

const UNK = 3, BOS = 0, EOS = 2;
const UNK_PENALTY = 10;

export class Tokenizer {
  constructor(buffer) {
    const dv = new DataView(buffer);
    const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
    if (magic !== 'WVOC') throw new Error('not a vocabulary file');
    const n = dv.getUint32(4, true);
    this.scores = new Float32Array(buffer.slice(8, 8 + 4 * n));
    const pieces = new TextDecoder('utf-8').decode(new Uint8Array(buffer, 8 + 4 * n)).split('\n');
    if (pieces.length !== n) throw new Error('vocabulary file is damaged');
    this.map = new Map();
    let min = Infinity, maxLen = 1;
    for (let i = 4; i < n; i++) {                       // 0-3 are <s> <pad> </s> <unk>: never matched in text
      const p = pieces[i];
      this.map.set(p, i);
      const len = [...p].length;
      if (len > maxLen) maxLen = len;
      if (this.scores[i] < min) min = this.scores[i];
    }
    this.maxLen = Math.min(maxLen, 48);
    this.unkScore = min - UNK_PENALTY;
    this.size = n;
  }

  // Like SentencePiece's nmt_nfkc normaliser: compatibility forms, no control characters, one kind of space.
  static normalize(text) {
    let s = String(text).normalize('NFKC');
    s = s.replace(/[\u0000-\u0008\u000B\u000E-\u001F\u007F-\u009F\u200B\u200C\u200D\u2060\uFEFF]/g, '');
    s = s.replace(/[\t\n\r\f\v\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, ' ');
    return s.replace(/ {2,}/g, ' ');
  }

  // One word ('▁peace'): the best cut into known pieces (Viterbi), unknown characters become <unk>.
  word(chars, out) {
    const n = chars.length;
    const best = new Float64Array(n + 1).fill(-Infinity);
    const from = new Int32Array(n + 1).fill(-1);
    const piece = new Int32Array(n + 1).fill(-1);
    best[0] = 0;
    for (let i = 0; i < n; i++) {
      if (best[i] === -Infinity) continue;
      let single = false;
      let s = '';
      for (let len = 1; len <= this.maxLen && i + len <= n; len++) {
        s += chars[i + len - 1];
        const id = this.map.get(s);
        if (id === undefined) continue;
        if (len === 1) single = true;
        const sc = best[i] + this.scores[id];
        if (sc > best[i + len]) { best[i + len] = sc; from[i + len] = i; piece[i + len] = id; }
      }
      if (!single) {
        const sc = best[i] + this.unkScore;
        if (sc > best[i + 1]) { best[i + 1] = sc; from[i + 1] = i; piece[i + 1] = UNK; }
      }
    }
    const ids = [];
    for (let j = n; j > 0; j = from[j]) ids.push(piece[j]);
    ids.reverse();
    for (const id of ids) {                             // unknown characters next to each other: one <unk>
      if (id === UNK && out.length && out[out.length - 1] === UNK) continue;
      out.push(id);
    }
  }

  // Text → token ids with <s> … </s>, at most `max` tokens.
  encode(text, max = 256) {
    const s = Tokenizer.normalize(text);
    const out = [BOS];
    if (!s) return [BOS, EOS];
    let m = s.replace(/ /g, '▁');
    if (!m.startsWith('▁')) m = '▁' + m;              // Metaspace, add_prefix_space
    const meta = m.split(/(?=▁)/u);
    for (const w of meta) {
      if (!w) continue;
      this.word([...w], out);
      if (out.length >= max - 1) break;
    }
    if (out.length > max - 1) out.length = max - 1;
    out.push(EOS);
    return out;
  }
}
