// ndjson-lines.test.ts — LLD-C1 (S0 checkpoint): chunk-boundary correctness for the shared reader. The
// module's whole job is surviving a byte stream chunked at arbitrary points; every case here re-chunks the
// SAME logical NDJSON differently and asserts the yielded lines are identical regardless of where the
// chunk boundaries fall — the negative controls are chunkings that would break a naive split('\n').
import { describe, it, expect } from 'vitest'
import { readNdjsonLines } from './ndjson-lines.ts'

/** Build a ReadableStream<Uint8Array> from a list of chunks (each chunk a string, encoded independently —
 * mirrors a real fetch body where TextEncoder boundaries and network chunk boundaries need not align with
 * line boundaries). */
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]))
        i += 1
      } else {
        controller.close()
      }
    },
  })
}

async function collect(body: ReadableStream<Uint8Array>): Promise<string[]> {
  const out: string[] = []
  for await (const line of readNdjsonLines(body)) out.push(line)
  return out
}

describe('readNdjsonLines — chunk-boundary correctness', () => {
  it('one line per chunk, each already newline-terminated', async () => {
    const lines = await collect(streamOf(['{"a":1}\n', '{"b":2}\n']))
    expect(lines).toEqual(['{"a":1}', '{"b":2}'])
  })

  it('multiple lines land in a single chunk', async () => {
    const lines = await collect(streamOf(['{"a":1}\n{"b":2}\n{"c":3}\n']))
    expect(lines).toEqual(['{"a":1}', '{"b":2}', '{"c":3}'])
  })

  it('a single line is split across two chunks — held until the newline arrives', async () => {
    const lines = await collect(streamOf(['{"a":1,"b"', ':2}\n']))
    expect(lines).toEqual(['{"a":1,"b":2}'])
  })

  it('a line is split across THREE chunks (the newline itself in a fourth, separate chunk)', async () => {
    const lines = await collect(streamOf(['{"a"', ':1,"b":2', '}', '\n']))
    expect(lines).toEqual(['{"a":1,"b":2}'])
  })

  it('a trailing partial line with no closing newline is flushed at stream end', async () => {
    const lines = await collect(streamOf(['{"a":1}\n{"b":2}']))
    expect(lines).toEqual(['{"a":1}', '{"b":2}'])
  })

  it('stream ends exactly on a trailing newline — no phantom empty final line', async () => {
    const lines = await collect(streamOf(['{"a":1}\n']))
    expect(lines).toEqual(['{"a":1}'])
  })

  it('a chunk boundary lands exactly AT a newline (split between the \\n and the next line)', async () => {
    const lines = await collect(streamOf(['{"a":1}\n', '{"b":2}\n']))
    expect(lines).toEqual(['{"a":1}', '{"b":2}'])
  })

  it('blank lines between records are dropped, not yielded as empty strings', async () => {
    const lines = await collect(streamOf(['{"a":1}\n\n{"b":2}\n']))
    expect(lines).toEqual(['{"a":1}', '{"b":2}'])
  })

  it('surrounding whitespace on a line is trimmed', async () => {
    const lines = await collect(streamOf(['  {"a":1}  \n']))
    expect(lines).toEqual(['{"a":1}'])
  })

  it('negative control: an empty stream yields no lines at all', async () => {
    const lines = await collect(streamOf([]))
    expect(lines).toEqual([])
  })

  it('negative control: a stream of only whitespace/newlines yields no lines', async () => {
    const lines = await collect(streamOf(['\n', '  \n', '\n']))
    expect(lines).toEqual([])
  })

  it('a multi-byte UTF-8 character is split across the chunk boundary (decoder stream:true carries it)', async () => {
    // '日本語' — encode the whole line then physically bisect the byte array mid-codepoint.
    const encoder = new TextEncoder()
    const bytes = encoder.encode('{"text":"日本語"}\n')
    const cut = 10 // lands inside a multi-byte UTF-8 sequence for one of the CJK characters
    const first = bytes.slice(0, cut)
    const second = bytes.slice(cut)
    let i = 0
    const parts = [first, second]
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i < parts.length) {
          controller.enqueue(parts[i]!)
          i += 1
        } else {
          controller.close()
        }
      },
    })
    const lines = await collect(body)
    expect(lines).toEqual(['{"text":"日本語"}'])
  })
})
