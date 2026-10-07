// dev-proxy-reasoning.test.ts (T-0021, ADR-0240 proposed): the dev proxy honors the client's
// `progressReasoning` request EXACTLY when it is the boolean `true`, so bounded reasoning excerpts ride the
// `reasoning` progress events only then, and independently of `progressDetail:'source'`. Drives the REAL
// dev-proxy middleware with the provider dispatch module mocked (the dev-proxy-abort.test.ts precedent) and
// a provider stub that emits one thinking delta through the `onEvent` seam. No key, no network.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { a2uiDevProxyPlugin } from '../../tools/agent/dev-proxy-plugin.ts'
import { readMetaLine } from '../agent/meta-line.ts'

declare const process: { env: Record<string, string | undefined> }

const THOUGHT = 'weighing the layout options'

vi.mock('../../tools/agent/providers/index.ts', () => ({
  providerFor: () => ({
    ok: true,
    provider: {
      async *stream(req: { onEvent?: (ev: { kind: string; text?: string }) => void }) {
        req.onEvent?.({ kind: 'thinking', text: 'weighing the layout options' })
        yield '{"a2uiMeta":{"note":"ok"}}'
      },
    },
  }),
}))

type Middleware = (req: unknown, res: unknown) => void

let handler: Middleware
let previousKey: string | undefined

beforeAll(() => {
  previousKey = process.env['ANTHROPIC_API_KEY']
  process.env['ANTHROPIC_API_KEY'] = 'sk-test-value'
  const plugin = a2uiDevProxyPlugin()
  ;(plugin.configureServer as unknown as (s: unknown) => void)({
    middlewares: {
      use: (_mount: string, fn: Middleware) => {
        handler = fn
      },
    },
  })
})

afterAll(() => {
  if (previousKey === undefined) delete process.env['ANTHROPIC_API_KEY']
  else process.env['ANTHROPIC_API_KEY'] = previousKey
})

let writes: string[]
beforeEach(() => {
  writes = []
})

/** POST one produce turn and return the NDJSON lines the route wrote. */
async function turn(extra: Record<string, unknown>): Promise<string[]> {
  const body = { input: { kind: 'intent', text: 'a submit button', session: { turns: [] } }, provider: 'anthropic', model: 'claude-sonnet-5', ...extra }
  const listeners: Record<string, Array<(arg?: unknown) => void>> = {}
  const req = {
    method: 'POST',
    url: '/produce',
    on(event: string, cb: (arg?: unknown) => void) {
      ;(listeners[event] ??= []).push(cb)
      if (event === 'end') {
        queueMicrotask(() => {
          for (const fn of listeners['data'] ?? []) fn(JSON.stringify(body))
          for (const fn of listeners['end'] ?? []) fn()
        })
      }
    },
  }
  let settle: () => void = () => {}
  const done = new Promise<void>((resolve) => {
    settle = resolve
  })
  const res = {
    statusCode: 0,
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    setHeader: () => {},
    on: () => {},
    write: (chunk: string) => {
      writes.push(chunk)
      return true
    },
    end: () => {
      res.writableEnded = true
      settle()
    },
  }
  handler(req, res)
  await done
  return writes.join('').split('\n').filter((l) => l !== '')
}

const reasoningEvent = (lines: string[]) =>
  lines.map((l) => readMetaLine(l)?.a2uiMeta.progress).find((p) => p?.stage === 'reasoning')

describe('dev proxy honors progressReasoning (T-0021, ADR-0240)', () => {
  it('progressReasoning:true puts the bounded excerpt on the reasoning event', async () => {
    expect(reasoningEvent(await turn({ progressReasoning: true }))?.detail).toBe(THOUGHT)
  })

  it('it combines with progressDetail:"source": the reasoning text and the raw-source gate are independent', async () => {
    const lines = await turn({ progressDetail: 'source', progressReasoning: true })
    expect(reasoningEvent(lines)?.detail).toBe(THOUGHT)
  })

  it('absent, false, or a crafted non-boolean value keeps the fail-closed default: the stage shows, no text', async () => {
    for (const extra of [{}, { progressReasoning: false }, { progressReasoning: 'true' }, { progressReasoning: 1 }, { progressDetail: 'source' }]) {
      const ev = reasoningEvent(await turn(extra))
      expect(ev, JSON.stringify(extra)).toBeDefined()
      expect(ev!.detail, JSON.stringify(extra)).toBeUndefined()
    }
  })

  it("'full' is still never client-granted: progressDetail:'full' alone puts no thinking text on the wire", async () => {
    expect(reasoningEvent(await turn({ progressDetail: 'full' }))!.detail).toBeUndefined()
  })
})
