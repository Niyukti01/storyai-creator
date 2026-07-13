import { assertEquals, assertThrows, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateMp4Buffer, parseMp4DurationSeconds, isFailureStatus, isSuccessStatus } from "./_validation.ts";

// --- Fixture builders ---------------------------------------------------

function box(type: string, payload: Uint8Array): Uint8Array {
  const size = 8 + payload.byteLength;
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  view.setUint32(0, size);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
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

// Build an mvhd v0 payload with given timescale + duration (both u32).
function mvhdV0(timescale: number, duration: number): Uint8Array {
  const payload = new Uint8Array(100); // plenty of room
  const view = new DataView(payload.buffer);
  payload[0] = 0; // version 0
  // bytes 1-3 flags = 0
  // creation_time (u32) @4, modification_time (u32) @8
  view.setUint32(12, timescale); // @ offset 12 in payload => byte 20 in box
  view.setUint32(16, duration);  // @ offset 16 in payload => byte 24 in box
  return payload;
}

function buildMp4(timescale: number, duration: number): ArrayBuffer {
  const ftyp = box("ftyp", new TextEncoder().encode("isom\x00\x00\x02\x00mp42isom"));
  const mvhd = box("mvhd", mvhdV0(timescale, duration));
  const moov = box("moov", mvhd);
  return concat(ftyp, moov).buffer as ArrayBuffer;
}

// --- validateMp4Buffer tests --------------------------------------------

Deno.test("validateMp4Buffer: accepts a well-formed 5s MP4 with video/mp4 mime", () => {
  const mp4 = buildMp4(1000, 5000); // 5.0s
  const dur = validateMp4Buffer(mp4, "video/mp4", 1);
  assertEquals(dur, 5);
});

Deno.test("validateMp4Buffer: rejects empty buffer (0 bytes)", () => {
  assertThrows(
    () => validateMp4Buffer(new ArrayBuffer(0), "video/mp4", 2),
    Error,
    "empty",
  );
});

Deno.test("validateMp4Buffer: rejects non-video MIME (image/png)", () => {
  const mp4 = buildMp4(1000, 5000);
  assertThrows(
    () => validateMp4Buffer(mp4, "image/png", 3),
    Error,
    "MIME type",
  );
});

Deno.test("validateMp4Buffer: rejects non-video MIME (application/json error body)", () => {
  const jsonErr = new TextEncoder().encode('{"error":"rate limited"}').buffer;
  assertThrows(
    () => validateMp4Buffer(jsonErr, "application/json", 4),
    Error,
    "MIME type",
  );
});

Deno.test("validateMp4Buffer: rejects buffer missing ftyp signature (PNG bytes)", () => {
  // PNG magic then random padding — no ftyp at bytes 4-7
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).buffer;
  assertThrows(
    () => validateMp4Buffer(png, "video/mp4", 5), // lie about MIME to isolate signature check
    Error,
    "ftyp",
  );
});

Deno.test("validateMp4Buffer: rejects MP4 with zero-duration mvhd", () => {
  const zeroDur = buildMp4(1000, 0);
  assertThrows(
    () => validateMp4Buffer(zeroDur, "video/mp4", 6),
    Error,
    "zero duration",
  );
});

Deno.test("validateMp4Buffer: rejects MP4 whose timescale is 0 (undefined duration)", () => {
  const badTs = buildMp4(0, 5000);
  assertThrows(
    () => validateMp4Buffer(badTs, "video/mp4", 7),
    Error,
    "zero duration",
  );
});

Deno.test("validateMp4Buffer: allows null MIME as long as ftyp + duration are valid", () => {
  const mp4 = buildMp4(24, 240); // 10s at 24 timescale
  const dur = validateMp4Buffer(mp4, null, 8);
  assertEquals(dur, 10);
});

Deno.test("parseMp4DurationSeconds: returns 0 for garbage input", () => {
  const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assertEquals(parseMp4DurationSeconds(garbage), 0);
});

// --- Runway status classifier tests -------------------------------------

Deno.test("isSuccessStatus: recognises SUCCEEDED and COMPLETED (any case)", () => {
  assert(isSuccessStatus("SUCCEEDED"));
  assert(isSuccessStatus("succeeded"));
  assert(isSuccessStatus("Completed"));
  assertEquals(isSuccessStatus("RUNNING"), false);
  assertEquals(isSuccessStatus(undefined), false);
});

Deno.test("isFailureStatus: recognises FAILED / TIMEOUT / ERROR / CANCELLED", () => {
  assert(isFailureStatus("FAILED"));
  assert(isFailureStatus("timeout"));
  assert(isFailureStatus("TIMED_OUT"));
  assert(isFailureStatus("Error"));
  assert(isFailureStatus("cancelled"));
  assertEquals(isFailureStatus("PENDING"), false);
  assertEquals(isFailureStatus(""), false);
});

// --- Integration: simulated Runway response flow ------------------------
// Simulates the pipeline decision: given a mocked Runway "download" response,
// the pipeline should accept only real MP4s and reject everything else.

async function simulateRunwayDownload(response: Response, sceneNumber: number): Promise<number> {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get("content-type");
  const buf = await response.arrayBuffer();
  return validateMp4Buffer(buf, contentType, sceneNumber);
}

Deno.test("integration: mocked Runway MP4 response is accepted", async () => {
  const mp4 = buildMp4(1000, 3000); // 3s
  const resp = new Response(mp4, { status: 200, headers: { "content-type": "video/mp4" } });
  const dur = await simulateRunwayDownload(resp, 100);
  assertEquals(dur, 3);
});

Deno.test("integration: mocked Runway JSON error response is rejected", async () => {
  const resp = new Response('{"error":"quota exceeded"}', {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  let threw = false;
  try {
    await simulateRunwayDownload(resp, 101);
  } catch (e) {
    threw = true;
    assert((e as Error).message.includes("MIME type"));
  }
  assert(threw, "expected JSON response to be rejected");
});

Deno.test("integration: mocked Runway PNG (image fallback) is rejected", async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const resp = new Response(png, { status: 200, headers: { "content-type": "image/png" } });
  let threw = false;
  try {
    await simulateRunwayDownload(resp, 102);
  } catch (e) {
    threw = true;
    assert((e as Error).message.includes("MIME type"));
  }
  assert(threw, "expected PNG response to be rejected — no image fallback allowed");
});

Deno.test("integration: mocked Runway MP4 with 0-duration mvhd is rejected", async () => {
  const mp4 = buildMp4(1000, 0);
  const resp = new Response(mp4, { status: 200, headers: { "content-type": "video/mp4" } });
  let threw = false;
  try {
    await simulateRunwayDownload(resp, 103);
  } catch (e) {
    threw = true;
    assert((e as Error).message.includes("zero duration"));
  }
  assert(threw, "expected zero-duration MP4 to be rejected");
});

Deno.test("integration: mocked Runway empty body is rejected", async () => {
  const resp = new Response(new ArrayBuffer(0), { status: 200, headers: { "content-type": "video/mp4" } });
  let threw = false;
  try {
    await simulateRunwayDownload(resp, 104);
  } catch (e) {
    threw = true;
    assert((e as Error).message.includes("empty"));
  }
  assert(threw, "expected empty body to be rejected");
});
