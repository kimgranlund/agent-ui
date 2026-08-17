// stream/ndjson-lines.ts — the shared streaming-NDJSON line reader, HOISTED here from
// `site/lib/ndjson-lines.ts` verbatim (SPEC-R13 a; ADR-0192 clause 5 + Consequences' "readNdjsonLines
// moves"). `site/lib/ndjson-lines.ts` becomes a one-line re-export with the IDENTICAL exported name +
// signature — behavior parity is pinned by the site's own existing test suite running against this
// body, type parity by `tsc`. Originally extracted (behavioral no-op) from `live-proxy-transport.ts`'s
// inline reader — getReader -> decode stream -> buffer-split on '\n' -> trimmed non-empty yields ->
// tail flush.

/** Read a byte stream as NDJSON: decode incrementally, split on '\n', yield each trimmed non-empty line as
 * it completes, and flush a trailing partial line (no closing newline) once the stream ends. A line split
 * across chunk boundaries is held in the internal buffer until the newline that completes it arrives — the
 * caller sees only whole, trimmed lines, never a partial. A consumer that stops early (`break`/`return()`)
 * releases the connection: the reader this function holds is cancelled rather than left open until GC. */
export async function* readNdjsonLines(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finished = false
  try {
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
    finished = true
    const tail = buffer.trim()
    if (tail.length > 0) yield tail
  } finally {
    if (!finished) void reader.cancel().catch(() => {})
  }
}
