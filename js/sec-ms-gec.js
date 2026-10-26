"use strict";
// Port of rany2/edge-tts drm.generate_sec_ms_gec_v2
const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WIN_EPOCH = 11644473600;
const S_TO_NS = 1e9;
const MASK = 0xFFFFFFFFn;
const SHA256_INITIAL = [0x6A09E667n,0xBB67AE85n,0x3C6EF372n,0xA54FF53An,0x510E527Fn,0x9B05688Cn,0x1F83D9ABn,0x5BE0CD19n];
const SHA256_STATE = [0xFD9FBEA2n,0x91243CE7n,0xBE499094n,0xCD2E1E0An,0x6C006F49n,0x04BD35ABn,0xFEB0A7E4n,0x03EFFBD2n];
const SHA256_SCHEDULE = [0xEB24BF9En,0x1558691Fn,0xA0C09EE2n,0x0CFA32BAn,0xA622EE8Cn,0xD1DD9491n,0xC0DD25A0n,0xF9E70AB6n,0xF0C31573n,0x7058CE4En,0x7188E606n,0x00E5AB33n,0xD258B060n,0x72766564n];
const K = [0x428A2F98n,0x71374491n,0xB5C0FBCFn,0xE9B5DBA5n,0x3956C25Bn,0x59F111F1n,0x923F82A4n,0xAB1C5ED5n,0xD807AA98n,0x12835B01n,0x243185BEn,0x550C7DC3n,0x72BE5D74n,0x80DEB1FEn,0x9BDC06A7n,0xC19BF174n,0xE49B69C1n,0xEFBE4786n,0x0FC19DC6n,0x240CA1CCn,0x2DE92C6Fn,0x4A7484AAn,0x5CB0A9DCn,0x76F988DAn,0x983E5152n,0xA831C66Dn,0xB00327C8n,0xBF597FC7n,0xC6E00BF3n,0xD5A79147n,0x06CA6351n,0x14292967n,0x27B70A85n,0x2E1B2138n,0x4D2C6DFCn,0x53380D13n,0x650A7354n,0x766A0ABBn,0x81C2C92En,0x92722C85n,0xA2BFE8A1n,0xA81A664Bn,0xC24B8B70n,0xC76C51A3n,0xD192E819n,0xD6990624n,0xF40E3585n,0x106AA070n,0x19A4C116n,0x1E376C08n,0x2748774Cn,0x34B0BCB5n,0x391C0CB3n,0x4ED8AA4An,0x5B9CCA4Fn,0x682E6FF3n,0x748F82EEn,0x78A5636Fn,0x84C87814n,0x8CC70208n,0x90BEFFFAn,0xA4506CEBn,0xBEF9A3F7n,0xC67178F2n];
const SHA256_ADJUSTMENT = 0xC9DC06A7n;
const BLOCK_K = (() => { const a = K.slice(); a[14] = SHA256_ADJUSTMENT; return a; })();
const SIGMA0_ADJ = 0x059C0B80n;
const SIGMA1_ADJ = 0x000B92C0n;
const CS64_COEFFICIENTS = [[0xE82E91B1n,0xB32700D0n],[0x44DE24C6n,0x88DFF51Dn],[0x3BEB65BCn,0x29514038n],[0xC89C5933n,0xB328CBDFn],[0x8D1EC211n,0xD405B4D5n],[0x314EF5D5n,0x26E55F3Cn],[0xE92491B1n,0x607801C6n],[0xF0A5B9D5n,0x82B2C1FBn],[0x06064CF3n,0xFA51A3DAn],[0xDA79FA60n,0x207CC464n],[0xBED20560n,0x3C3C74F3n],[0x89F9C9F8n,0xD2D14B61n],[0x35FA38C6n,0xBB04A2C1n],[0xCB49E3C6n,0xC5626167n]];
const CS64_FACTOR = 0x82893933n;
const CS64_ADJ0 = 0xF2F90B1An;
const CS64_ADJ1 = 0x0B1A0000n;
const SEC_MS_GEC_VERSION = "2-143.0.3650.75";

function u32(x) { return x & MASK; }
function rol16(v) { v = u32(v); return u32((v << 16n) | (v >> 16n)); }
function sigma0(v) { return u32((v >> 7n) ^ (v << 25n) ^ (v >> 18n) ^ (v << 14n) ^ (v >> 3n)); }
function sigma1(v) { return u32((v >> 17n) ^ (v << 15n) ^ (v >> 19n) ^ (v << 13n) ^ (v >> 10n)); }

function wordsLe4Even(data) {
  const pad = (4 - (data.length % 4)) % 4;
  const buf = new Uint8Array(data.length + pad);
  buf.set(data);
  const words = [];
  for (let i = 0; i < buf.length; i += 4) {
    words.push(BigInt(buf[i]) | (BigInt(buf[i+1]) << 8n) | (BigInt(buf[i+2]) << 16n) | (BigInt(buf[i+3]) << 24n));
  }
  if (words.length % 2) words.push(0n);
  return words;
}

function sha256Rounds(state, words, firstRound = 0) {
  let a = state[0], b = state[1], c = state[2], d = state[3], e = state[4], f = state[5], g = state[6], h = state[7];
  const constants = firstRound === 14 ? BLOCK_K : K;
  const aligned = Math.min(64, Math.floor((firstRound + 7) / 8) * 8);
  for (let index = firstRound; index < aligned; index++) {
    const rotE = e * 0x100000001n;
    const rotA = a * 0x100000001n;
    const t1 = h + ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) + (g ^ (e & (f ^ g))) + constants[index] + words[index];
    const t2 = ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((a & b) | (c & (a | b)));
    const na = u32(t1 + t2);
    const ne = u32(d + t1);
    h = g; g = f; f = e; e = ne; d = c; c = b; b = a; a = na;
  }
  for (let index = aligned; index < 64; index += 8) {
    let rotE = e * 0x100000001n;
    let rotA = a * 0x100000001n;
    let t1 = h + ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) + (g ^ (e & (f ^ g))) + constants[index] + words[index];
    d = u32(d + t1);
    h = u32(t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((a & b) | (c & (a | b))));
    rotE = d * 0x100000001n; rotA = h * 0x100000001n;
    t1 = g + ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) + (f ^ (d & (e ^ f))) + constants[index+1] + words[index+1];
    c = u32(c + t1);
    g = u32(t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((h & a) | (b & (h | a))));
    rotE = c * 0x100000001n; rotA = g * 0x100000001n;
    t1 = f + ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) + (e ^ (c & (d ^ e))) + constants[index+2] + words[index+2];
    b = u32(b + t1);
    f = u32(t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((g & h) | (a & (g | h))));
    rotE = b * 0x100000001n; rotA = f * 0x100000001n;
    t1 = e + ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) + (d ^ (b & (c ^ d))) + constants[index+3] + words[index+3];
    a = u32(a + t1);
    e = u32(t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((f & g) | (h & (f | g))));
    rotE = a * 0x100000001n; rotA = e * 0x100000001n;
    t1 = d + ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) + (c ^ (a & (b ^ c))) + constants[index+4] + words[index+4];
    h = u32(h + t1);
    d = u32(t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((e & f) | (g & (e | f))));
    rotE = h * 0x100000001n; rotA = d * 0x100000001n;
    t1 = c + ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) + (b ^ (h & (a ^ b))) + constants[index+5] + words[index+5];
    g = u32(g + t1);
    c = u32(t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((d & e) | (f & (d | e))));
    rotE = g * 0x100000001n; rotA = c * 0x100000001n;
    t1 = b + ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) + (a ^ (g & (h ^ a))) + constants[index+6] + words[index+6];
    f = u32(f + t1);
    b = u32(t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((c & d) | (e & (c | d))));
    rotE = f * 0x100000001n; rotA = b * 0x100000001n;
    t1 = a + ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) + (h ^ (f & (g ^ h))) + constants[index+7] + words[index+7];
    e = u32(e + t1);
    a = u32(t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((b & c) | (d & (b | c))));
  }
  return [a,b,c,d,e,f,g,h];
}

function expandSha256Schedule(words, firstWord = 16) {
  for (let index = firstWord; index < 64; index++) {
    const x = words[index - 2], y = words[index - 15];
    const s1 = (x >> 17n) ^ (x << 15n) ^ (x >> 19n) ^ (x << 13n) ^ (x >> 10n);
    const s0 = (y >> 7n) ^ (y << 25n) ^ (y >> 18n) ^ (y << 14n) ^ (y >> 3n);
    words.push(u32(s1 + words[index - 7] + s0 + words[index - 16]));
  }
}

function sha256Init(data) {
  const words = new Array(14).fill(0n);
  words.push((BigInt(data[0]) << 16n) | (BigInt(data[1]) << 8n) | BigInt(data[2]));
  words.push((BigInt(data[3]) << 24n) | (BigInt(data[4]) << 16n) | (BigInt(data[5]) << 8n) | BigInt(data[6]));
  for (let index = 16; index < 30; index++) {
    let value = SHA256_SCHEDULE[index - 16];
    if (index - 2 >= 14) {
      value += (index === 16) ? (sigma1(words[index - 2]) ^ SIGMA1_ADJ) : sigma1(words[index - 2]);
    }
    if (index - 7 >= 14) value += words[index - 7];
    if (index - 15 >= 14) {
      value += (index === 29) ? (sigma0(words[index - 15]) ^ SIGMA0_ADJ) : sigma0(words[index - 15]);
    }
    words.push(u32(value));
  }
  words.push(u32(sigma1(words[28]) + words[23] + sigma0(words[15]) + words[14] + SHA256_ADJUSTMENT - K[14]));
  expandSha256Schedule(words, 31);
  const working = sha256Rounds(SHA256_STATE.slice(), words, 14);
  return SHA256_INITIAL.map((x, i) => u32(x + working[i]));
}

function sha256Digest(data) {
  if (data.length < 7) throw new Error("Token salt must contain at least seven bytes");
  const length = 57 + data.length;
  const zeroPad = ((55 - (length % 64)) % 64 + 64) % 64;
  const padded = new Uint8Array(data.length - 7 + 1 + zeroPad + 8);
  padded.set(data.slice(7), 0);
  padded[data.length - 7] = 0x80;
  const bitLen = BigInt(length) * 8n;
  for (let i = 0; i < 8; i++) padded[padded.length - 1 - i] = Number((bitLen >> BigInt(8 * i)) & 0xffn);
  let state = sha256Init(data.slice(0, 7));
  for (let offset = 0; offset < padded.length; offset += 64) {
    const words = [];
    for (let i = 0; i < 16; i++) {
      const o = offset + i * 4;
      words.push((BigInt(padded[o]) << 24n) | (BigInt(padded[o+1]) << 16n) | (BigInt(padded[o+2]) << 8n) | BigInt(padded[o+3]));
    }
    expandSha256Schedule(words, 16);
    const working = sha256Rounds(state, words, 0);
    state = state.map((x, i) => u32(x + working[i]));
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    const v = state[i];
    out[i*4] = Number((v >> 24n) & 0xffn);
    out[i*4+1] = Number((v >> 16n) & 0xffn);
    out[i*4+2] = Number((v >> 8n) & 0xffn);
    out[i*4+3] = Number(v & 0xffn);
  }
  return out;
}

function cs64Digest(data, digest) {
  let keyA = BigInt(digest[0]) | (BigInt(digest[1]) << 8n) | (BigInt(digest[2]) << 16n) | (BigInt(digest[3]) << 24n);
  let keyB = BigInt(digest[4]) | (BigInt(digest[5]) << 8n) | (BigInt(digest[6]) << 16n) | (BigInt(digest[7]) << 24n);
  keyA |= 1n; keyB |= 1n;
  const factors = [u32(keyA * CS64_FACTOR), u32(keyB * CS64_FACTOR)];
  const terms = [];
  const offsets = [];
  for (let i = 0; i < CS64_COEFFICIENTS.length; i++) {
    terms.push(u32(CS64_COEFFICIENTS[i][0] * factors[i % 2]));
    offsets.push(CS64_COEFFICIENTS[i][1]);
  }
  const prefixed = new Uint8Array(1 + data.length);
  prefixed.set(data, 1);
  const dataWords = wordsLe4Even(prefixed);
  for (let index = 0; index < dataWords.length; index++) {
    const word = dataWords[index];
    let term = word * (index % 2 === 0 ? keyA : keyB);
    let offset = rol16(word) * (index % 2 === 0 ? 0xEF0569FBn : 0xC31713DBn);
    if (index === 0) { term += CS64_ADJ0 * factors[0]; offset += CS64_ADJ1; }
    terms.push(u32(term));
    offsets.push(u32(offset));
  }
  let swapAcc = 0n, swapLast = 0n, state = 0n, acc = 0n;
  for (let index = 0; index < terms.length; index += 2) {
    const x = terms[index], y = terms[index + 1];
    let t = rol16(u32(offsets[index] + x));
    let q = u32(t * 0x76F50F34n);
    swapAcc = u32(swapAcc + u32(rol16(q) * 0xC3EFEA97n + q));
    t = rol16(u32(offsets[index + 1] + y));
    q = u32(t * 0x1881CE3Cn);
    swapLast = u32(rol16(q) * 0x35BD1EC9n + q);
    swapAcc = u32(swapAcc + swapLast);
    state = u32(state * keyA + x);
    state = u32(rol16(state) * 0xCF98B111n);
    state = u32(rol16(state) * 0x87085B9Fn);
    state = u32(rol16(state) * 0x12CEB96Dn);
    state = u32(rol16(state) * 0x257E1D83n);
    acc += state;
    t = u32(state * keyB + y);
    t = u32(rol16(t) * 0xA27416F5n);
    t = u32(rol16(t) * 0xD38396FFn);
    state = u32(rol16(u32(rol16(t) * 0x7C932B89n)) * 0xBFA49F69n);
    acc = u32(acc + state);
  }
  return [swapLast ^ state, swapAcc ^ acc];
}

function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function generateSecMsGecV2(unixTimestamp) {
  let ticks = unixTimestamp !== undefined && unixTimestamp !== null ? unixTimestamp : Date.now() / 1000;
  ticks += WIN_EPOCH;
  ticks -= ticks % 300;
  ticks *= S_TO_NS / 100;
  const strToHash = `${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`;
  const data = new TextEncoder().encode(strToHash);
  const digest = sha256Digest(data);
  const [w0, w1] = cs64Digest(data, digest);
  const cs64 = (
    Number(w0 & 0xffn).toString(16).padStart(2,"0") +
    Number((w0 >> 8n) & 0xffn).toString(16).padStart(2,"0") +
    Number((w0 >> 16n) & 0xffn).toString(16).padStart(2,"0") +
    Number((w0 >> 24n) & 0xffn).toString(16).padStart(2,"0") +
    Number(w1 & 0xffn).toString(16).padStart(2,"0") +
    Number((w1 >> 8n) & 0xffn).toString(16).padStart(2,"0") +
    Number((w1 >> 16n) & 0xffn).toString(16).padStart(2,"0") +
    Number((w1 >> 24n) & 0xffn).toString(16).padStart(2,"0")
  ).toUpperCase();
  return `${cs64}-${toHex(digest)}`;
}

function generateSecMsGec() { return generateSecMsGecV2(Date.now() / 1000); }

if (typeof module !== "undefined" && module.exports) {
  module.exports = { generateSecMsGec, generateSecMsGecV2, SEC_MS_GEC_VERSION };
}
if (typeof globalThis !== "undefined") {
  globalThis.EdgeSecMsGec = { generateSecMsGec, generateSecMsGecV2, SEC_MS_GEC_VERSION };
}
