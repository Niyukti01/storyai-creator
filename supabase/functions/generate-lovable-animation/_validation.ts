// Runway MP4 validation helpers. Extracted so unit tests can import them
// without booting the full edge function (which calls serve() at load).

// Parse MP4 mvhd atom to extract duration (seconds). Returns 0 if not found.
export function parseMp4DurationSeconds(buf: Uint8Array): number {
  try {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    let i = 0
    while (i + 8 <= buf.byteLength) {
      const size = view.getUint32(i)
      const type = String.fromCharCode(buf[i + 4], buf[i + 5], buf[i + 6], buf[i + 7])
      if (size < 8) break
      if (type === 'moov') {
        let j = i + 8
        const end = i + size
        while (j + 8 <= end) {
          const s2 = view.getUint32(j)
          const t2 = String.fromCharCode(buf[j + 4], buf[j + 5], buf[j + 6], buf[j + 7])
          if (s2 < 8) break
          if (t2 === 'mvhd') {
            const version = buf[j + 8]
            if (version === 0) {
              const timescale = view.getUint32(j + 20)
              const duration = view.getUint32(j + 24)
              return timescale > 0 ? duration / timescale : 0
            } else {
              const timescale = view.getUint32(j + 28)
              const durHi = view.getUint32(j + 32)
              const durLo = view.getUint32(j + 36)
              const duration = durHi * 2 ** 32 + durLo
              return timescale > 0 ? duration / timescale : 0
            }
          }
          j += s2
        }
      }
      i += size
    }
  } catch (e) {
    console.error('parseMp4DurationSeconds error:', e)
  }
  return 0
}

// Verify a downloaded buffer is a real playable MP4: MIME video/*, ftyp signature,
// and mvhd-reported duration > 0 seconds. Throws on any failure.
export function validateMp4Buffer(
  buf: ArrayBuffer,
  contentType: string | null,
  sceneNumber: number
): number {
  if (!buf || buf.byteLength === 0) {
    throw new Error(`Scene ${sceneNumber} Runway output was empty (0 bytes)`)
  }
  if (contentType && !contentType.toLowerCase().startsWith('video/')) {
    throw new Error(`Scene ${sceneNumber} Runway output MIME type is "${contentType}", expected video/*`)
  }
  const bytes = new Uint8Array(buf)
  const ftyp = String.fromCharCode(bytes[4] ?? 0, bytes[5] ?? 0, bytes[6] ?? 0, bytes[7] ?? 0)
  if (ftyp !== 'ftyp') {
    throw new Error(`Scene ${sceneNumber} Runway output is not a valid MP4 (missing ftyp signature)`)
  }
  const durationSec = parseMp4DurationSeconds(bytes)
  if (!(durationSec > 0)) {
    throw new Error(`Scene ${sceneNumber} Runway MP4 has zero duration — treating as failed`)
  }
  console.log(
    `Scene ${sceneNumber} MP4 validated: ${(buf.byteLength / 1024).toFixed(0)}KB, duration ${durationSec.toFixed(2)}s, mime ${contentType || 'n/a'}`
  )
  return durationSec
}

// Runway task status classifiers — also exported for tests.
export function isFailureStatus(status: string | undefined): boolean {
  const n = (status || '').toUpperCase()
  return n === 'FAILED' || n === 'TIMEOUT' || n === 'TIMED_OUT' || n === 'ERROR' || n === 'CANCELLED'
}

export function isSuccessStatus(status: string | undefined): boolean {
  const n = (status || '').toUpperCase()
  return n === 'SUCCEEDED' || n === 'COMPLETED'
}
