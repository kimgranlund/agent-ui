// stream/from-fetch-stream.ts — SPEC-R13 (a): `fromFetchStream`, a `Streamed<Frame>` adapter over
// `fetch` + `ReadableStream` — POST- and header-capable, three frame modes.

import type { Streamed } from '../core/types.ts'
import { readNdjsonLines } from './ndjson-lines.ts'
import type { FetchLike } from '../gateway/client.ts'

export type StreamFrame = 'ndjson' | 'sse' | 'lines'

export interface SseEvent {
  data: string
  event?: string
  id?: string
  retry?: number
}

export interface FromFetchStreamInit extends RequestInit {
  frame: StreamFrame
  fetch?: FetchLike
}

async function* linesOf(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncIterable<string> {
  // Shares the exact same buffer-split-on-'\n' idiom as `readNdjsonLines`, minus the non-empty
  // filter (SPEC-R13 a's "lines" mode is raw lines, not NDJSON's non-empty-trimmed convention).
  // Cancels via THIS reader (never `body.cancel()` — a locked stream's own `.cancel()` throws;
  // only the reader that holds the lock may cancel it, AC3's "reader's cancel spy" requirement).
  const reader = body.getReader()
  const onAbort = () => {
    void reader.cancel()
  }
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl = buffer.indexOf('\n')
      while (nl !== -1) {
        yield buffer.slice(0, nl)
        buffer = buffer.slice(nl + 1)
        nl = buffer.indexOf('\n')
      }
    }
    if (buffer.length > 0) yield buffer
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}

async function* sseFramesOf(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncIterable<SseEvent> {
  let pendingData: string[] = []
  let pendingEvent: string | undefined
  let pendingId: string | undefined
  let pendingRetry: number | undefined

  function flush(): SseEvent | undefined {
    if (pendingData.length === 0 && pendingEvent === undefined && pendingId === undefined) return undefined
    const evt: SseEvent = { data: pendingData.join('\n') }
    if (pendingEvent !== undefined) evt.event = pendingEvent
    if (pendingId !== undefined) evt.id = pendingId
    if (pendingRetry !== undefined) evt.retry = pendingRetry
    pendingData = []
    pendingEvent = undefined
    pendingId = undefined
    return evt
  }

  for await (const line of linesOf(body, signal)) {
    if (line === '') {
      const evt = flush()
      if (evt) yield evt
      continue
    }
    if (line.startsWith(':')) continue // comment — ignored
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
    if (field === 'data') pendingData.push(value)
    else if (field === 'event') pendingEvent = value
    else if (field === 'id') pendingId = value
    else if (field === 'retry') pendingRetry = Number(value)
  }
  const last = flush()
  if (last) yield last
}

/** `fromFetchStream(input, init & { frame })` — SPEC-R13 (a). */
export function fromFetchStream(input: string, init: FromFetchStreamInit): Streamed<unknown> {
  const doFetch = init.fetch ?? fetch
  const { frame, fetch: _fetch, ...requestInit } = init
  void _fetch

  async function* generate(): AsyncGenerator<unknown> {
    const res = await doFetch(new Request(input, requestInit))
    const body = res.body
    if (!body) return
    const signal = requestInit.signal ?? undefined
    if (frame === 'sse') {
      yield* sseFramesOf(body, signal)
    } else if (frame === 'ndjson') {
      // `readNdjsonLines` is the HOISTED, signature-pinned function (site parity, SPEC-R13 a) — it
      // owns its own reader internally and takes no signal, so an abort here does not force an
      // early reader.cancel() the way 'lines'/'sse' do; it still ends once the source stream itself
      // closes or errors (a real `fetch()`'s platform-level abort already closes the body for it).
      yield* readNdjsonLines(body)
    } else {
      yield* linesOf(body, signal)
    }
  }

  return { [Symbol.asyncIterator]: () => generate()[Symbol.asyncIterator]() }
}
