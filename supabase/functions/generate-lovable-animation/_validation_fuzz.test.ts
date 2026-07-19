import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseMp4DurationSeconds, validateMp4Buffer } from "./_validation.ts";

// Deterministic PRNG so failures reproduce.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBytes(rng: () => number, len: number): Uint8Array {
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = Math.floor(rng() * 256);
  return out;
}

function box(type: string, payload: Uint8Array): Uint8Array {
  const size = 8 + payload.byteLength;
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  view.setUint32(0, size);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(payload, 8);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.byteLength; }
  return out;
}

// --- Fuzz: pure random bytes never crash and never claim a duration --------

Deno.test("fuzz: parseMp4DurationSeconds never throws on random bytes", () => {
  const rng = mulberry32(0xdeadbeef);
  for (let i = 0; i < 500; i++) {
    const len = Math.floor(rng() * 4096);
    const buf = randomBytes(rng, len);
    // Must return a finite non-negative number. Never throw.
    const d = parseMp4DurationSeconds(buf);
    assert(Number.isFinite(d), `non-finite duration for iteration ${i}`);
    assert(d >= 0, `negative duration for iteration ${i}`);
  }
});

Deno.test("fuzz: parseMp4DurationSeconds handles tiny/short buffers (0..16 bytes)", () => {
  const rng = mulberry32(1);
  for (let len = 0; len <= 16; len++) {
    for (let trial = 0; trial < 20; trial++) {
      const buf = randomBytes(rng, len);
      const d = parseMp4DurationSeconds(buf);
      assertEquals(d, 0, `expected 0 for garbage len=${len}`);
    }
  }
});

// --- Fuzz: malformed box sizes -------------------------------------------

Deno.test("fuzz: rejects box with size < 8 without infinite loop", () => {
  // Craft a header claiming size=0 followed by moov marker — parser must bail.
  const buf = new Uint8Array(64);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0);            // invalid size
  buf[4] = 0x6d; buf[5] = 0x6f; buf[6] = 0x6f; buf[7] = 0x76; // "moov"
  const start = performance.now();
  const d = parseMp4DurationSeconds(buf);
  const elapsed = performance.now() - start;
  assertEquals(d, 0);
  assert(elapsed < 100, `parser too slow on malformed size: ${elapsed}ms`);
});

Deno.test("fuzz: rejects box whose size exceeds buffer length", () => {
  const buf = new Uint8Array(32);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0xffffffff);   // absurd size
  buf[4] = 0x6d; buf[5] = 0x6f; buf[6] = 0x6f; buf[7] = 0x76;
  const d = parseMp4DurationSeconds(buf);
  assertEquals(d, 0);
});

// --- Fuzz: malformed moov / mvhd -----------------------------------------

Deno.test("fuzz: moov present but mvhd missing → duration 0", () => {
  const junk = new Uint8Array(40); // no mvhd inside
  const moov = box("moov", junk);
  const d = parseMp4DurationSeconds(moov);
  assertEquals(d, 0);
});

Deno.test("fuzz: mvhd truncated before timescale field → duration 0", () => {
  // mvhd payload only 4 bytes long — parser reads past end via DataView, but
  // must not throw and must not return NaN/Infinity.
  const shortMvhd = box("mvhd", new Uint8Array([0, 0, 0, 0]));
  const moov = box("moov", shortMvhd);
  const d = parseMp4DurationSeconds(moov);
  assert(Number.isFinite(d));
  assertEquals(d, 0);
});

Deno.test("fuzz: mvhd with random version byte never throws", () => {
  const rng = mulberry32(42);
  for (let i = 0; i < 100; i++) {
    const payload = randomBytes(rng, 120);
    payload[0] = Math.floor(rng() * 256); // arbitrary version
    const moov = box("moov", box("mvhd", payload));
    const d = parseMp4DurationSeconds(moov);
    assert(Number.isFinite(d), `non-finite for random mvhd version iter ${i}`);
    assert(d >= 0);
  }
});

Deno.test("fuzz: mvhd v0 with timescale=0 → duration 0 (no divide-by-zero)", () => {
  const payload = new Uint8Array(100);
  const view = new DataView(payload.buffer);
  payload[0] = 0;
  view.setUint32(12, 0);      // timescale
  view.setUint32(16, 999999); // duration
  const moov = box("moov", box("mvhd", payload));
  assertEquals(parseMp4DurationSeconds(moov), 0);
});

Deno.test("fuzz: mvhd v1 (64-bit duration) parsed without overflow", () => {
  const payload = new Uint8Array(120);
  const view = new DataView(payload.buffer);
  payload[0] = 1;              // version 1
  view.setUint32(20, 1000);    // timescale
  view.setUint32(24, 0);       // durHi
  view.setUint32(28, 60_000);  // durLo → 60s
  const moov = box("moov", box("mvhd", payload));
  const d = parseMp4DurationSeconds(moov);
  assertEquals(d, 60);
});

Deno.test("fuzz: mvhd v1 with huge 64-bit duration stays finite", () => {
  const payload = new Uint8Array(120);
  const view = new DataView(payload.buffer);
  payload[0] = 1;
  view.setUint32(20, 1);              // timescale=1
  view.setUint32(24, 0xffffffff);     // durHi max
  view.setUint32(28, 0xffffffff);     // durLo max
  const moov = box("moov", box("mvhd", payload));
  const d = parseMp4DurationSeconds(moov);
  assert(Number.isFinite(d));
  assert(d > 0);
});

// --- Fuzz: validateMp4Buffer robustness ----------------------------------

Deno.test("fuzz: validateMp4Buffer rejects random buffers without crashing", () => {
  const rng = mulberry32(7);
  let rejected = 0;
  for (let i = 0; i < 200; i++) {
    const buf = randomBytes(rng, Math.floor(rng() * 512) + 8).buffer as ArrayBuffer;
    try {
      validateMp4Buffer(buf, "video/mp4", i);
    } catch {
      rejected++;
    }
  }
  // Vanishingly unlikely for random noise to satisfy ftyp + valid mvhd.
  assertEquals(rejected, 200);
});

Deno.test("fuzz: validateMp4Buffer with ftyp signature but garbage moov → rejected", () => {
  const rng = mulberry32(99);
  for (let i = 0; i < 50; i++) {
    const ftyp = box("ftyp", new TextEncoder().encode("isom\x00\x00\x02\x00mp42isom"));
    const junk = randomBytes(rng, 256);
    const buf = concat(ftyp, junk).buffer as ArrayBuffer;
    let threw = false;
    try { validateMp4Buffer(buf, "video/mp4", i); } catch { threw = true; }
    assert(threw, `expected rejection for ftyp+garbage iter ${i}`);
  }
});

Deno.test("fuzz: parser terminates on adversarial nested boxes (size=8 loop bait)", () => {
  // Fill buffer with back-to-back 8-byte empty boxes labeled "moov". Parser
  // must advance by `size` each iteration and not spin.
  const boxes: Uint8Array[] = [];
  for (let i = 0; i < 1000; i++) {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setUint32(0, 8);
    b[4] = 0x6d; b[5] = 0x6f; b[6] = 0x6f; b[7] = 0x76;
    boxes.push(b);
  }
  const buf = concat(...boxes);
  const start = performance.now();
  const d = parseMp4DurationSeconds(buf);
  const elapsed = performance.now() - start;
  assertEquals(d, 0);
  assert(elapsed < 200, `parser slow on nested empty moov: ${elapsed}ms`);
});
