// ndjson-lines.ts — LLD-C1 (SPEC-R17/R18 carriage): the shared streaming-NDJSON line reader. Extracted
// verbatim (behavioral no-op) from `live-proxy-transport.ts`'s inline reader — getReader → decode stream →
// buffer-split on '\n' → trimmed non-empty yields → tail flush. This is the ONE line-reading idiom for
// every dev-only live transport (`live-proxy-transport.ts` today; the arena streaming client (C3) and the
// feed transport (C10) build on it later) — a chunk boundary landing mid-line, mid-decode, or at EOF is
// this module's whole job, so it stays a single pure function, tested against adversarial re-chunking once
// here rather than re-proven per consumer.

/** Read a byte stream as NDJSON: decode incrementally, split on '\n', yield each trimmed non-empty line as
 * it completes, and flush a trailing partial line (no closing newline) once the stream ends. A line split
 * across chunk boundaries is held in the internal buffer until the newline that completes it arrives — the
 * caller sees only whole, trimmed lines, never a partial. */
export async function* readNdjsonLines(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl = buffer.indexOf('\n')
    while (nl !== -1) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (line.length > 0) yield line
      nl = buffer.indexOf('\n')
    }
  }
  const tail = buffer.trim()
  if (tail.length > 0) yield tail
}
