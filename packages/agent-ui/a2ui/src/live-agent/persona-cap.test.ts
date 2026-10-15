// persona-cap.test.ts (T-0224): a persona over the 16,384-character runaway cap fails loudly on both produce
// routes, a 400 with a dev reason (and, in the dev proxy, a trace line), where it used to be dropped so the
// turn ran without it. The dev proxy leg drives the REAL middleware with the provider dispatch mocked (the
// dev-proxy-response-preference.test.ts precedent). The Worker route is not importable under vitest (its
// `.json`/`.jsonl` raw imports are Wrangler-only, chat-route.test.ts), so its leg pins the shared validator
// and its call in `handleProduce` (the chat-route.test.ts structural parity precedent).

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { a2uiDevProxyPlugin } from '../../tools/agent/dev-proxy-plugin.ts'
import { PERSONA_SYSTEM_MAX_CHARS, validatePersonaSystem } from '../../tools/agent/chat-validation.ts'

declare const process: { cwd(): string; env: Record<string, string | undefined> }

const state = vi.hoisted(() => ({ requests: [] as Array<Record<string, unknown>> }))

// vitest hoists vi.mock above the imports; the factory may only close over `vi.hoisted` state.
vi.mock('../../tools/agent/providers/index.ts', () => ({
  providerFor: () => ({
    ok: true,
    provider: {
      async *stream(req: Record<string, unknown>) {
        state.requests.push(req)
        yield '{"a2uiMeta":{"note":"ok"}}'
      },
    },
  }),
}))

type Middleware = (req: unknown, res: unknown) => void

let handler: Middleware
let previousKey: string | undefined
let traceDir: string

beforeAll(() => {
  previousKey = process.env['ANTHROPIC_API_KEY']
  process.env['ANTHROPIC_API_KEY'] = 'sk-test-value'
  traceDir = mkdtempSync(join(tmpdir(), 'persona-cap-traces-'))
  const plugin = a2uiDevProxyPlugin({ traces: { dir: traceDir } })
  const server = {
    middlewares: {
      use: (_mount: string, fn: Middleware) => {
        handler = fn
      },
    },
  }
  ;(plugin.configureServer as unknown as (s: unknown) => void)(server)
})

afterAll(() => {
  if (previousKey === undefined) delete process.env['ANTHROPIC_API_KEY']
  else process.env['ANTHROPIC_API_KEY'] = previousKey
  rmSync(traceDir, { recursive: true, force: true })
})

beforeEach(() => {
  state.requests.length = 0
})

/** POST one produce turn with `personaSystem`; return the status and the body the proxy ended with. */
async function produceTurn(personaSystem: string): Promise<{ status: number; body: string }> {
  const body = { input: { kind: 'intent', text: 'a submit button', session: { turns: [] } }, provider: 'anthropic', model: 'claude-sonnet-5-5', personaSystem }
  const reqListeners: Record<string, Array<(arg?: unknown) => void>> = {}
  const req = {
    method: 'POST',
    url: '/produce',
    on(event: string, cb: (arg?: unknown) => void) {
      ;(reqListeners[event] ??= []).push(cb)
      if (event === 'end') {
        queueMicrotask(() => {
          for (const fn of reqListeners['data'] ?? []) fn(JSON.stringify(body))
          for (const fn of reqListeners['end'] ?? []) fn()
        })
      }
    },
  }
  let settle: () => void = () => {}
  const done = new Promise<void>((resolve) => {
    settle = resolve
  })
  let ended = ''
  const res = {
    statusCode: 0,
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    setHeader: () => {},
    on: () => {},
    write: () => true,
    end: (chunk?: string) => {
      ended = chunk ?? ''
      res.writableEnded = true
      settle()
    },
  }
  handler(req, res)
  await done
  return { status: res.statusCode, body: ended }
}

const traceLines = (): Array<{ outcome: string; error?: { message: string; status?: number } }> =>
  readdirSync(traceDir).flatMap((f) =>
    readFileSync(join(traceDir, f), 'utf8')
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l) as { outcome: string; error?: { message: string; status?: number } }),
  )

describe('the shared persona validator', () => {
  it('passes a persona at the cap, absents a non-string, and rejects one character over with a reason', () => {
    expect(PERSONA_SYSTEM_MAX_CHARS).toBe(16_384)
    expect(validatePersonaSystem('x'.repeat(16_384))).toEqual({ ok: true, persona: 'x'.repeat(16_384) })
    expect(validatePersonaSystem(undefined)).toEqual({ ok: true, persona: undefined })
    expect(validatePersonaSystem(42)).toEqual({ ok: true, persona: undefined })
    const over = validatePersonaSystem('x'.repeat(16_385))
    expect(over.ok).toBe(false)
    expect(!over.ok && over.error).toMatch(/^persona-too-long: 16385 characters/)
  })
})

describe('dev proxy produce route', () => {
  it('a 16,385-character persona answers 400 with the reason and a rejected trace line, and calls no model', async () => {
    const { status, body } = await produceTurn('p'.repeat(16_385))
    expect(status).toBe(400)
    expect((JSON.parse(body) as { error: string }).error).toMatch(/^persona-too-long/)
    expect(state.requests).toHaveLength(0)
    const rejected = traceLines().filter((l) => l.outcome === 'rejected')
    expect(rejected).toHaveLength(1)
    expect(rejected[0]!.error).toMatchObject({ status: 400 })
    expect(rejected[0]!.error!.message).toMatch(/^persona-too-long/)
  })

  it('a persona at the cap still reaches the model (control)', async () => {
    const persona = `PERSONA-MARKER ${'p'.repeat(16_384 - 15)}`
    expect(persona.length).toBe(16_384)
    const { status } = await produceTurn(persona)
    expect(status).toBe(200)
    expect(String(state.requests[0]?.['system'])).toContain('PERSONA-MARKER')
  })
})

describe('Worker produce route (structural: the route is not importable under vitest)', () => {
  const source = readFileSync(`${process.cwd()}/packages/agent-ui/a2ui/tools/agent/worker/index.ts`, 'utf8') as string
  const handleProduce = source.slice(source.indexOf('async function handleProduce('))

  it('handleProduce answers an over-cap persona with the shared validator and a 400 before the stream starts', () => {
    expect(handleProduce).toContain('validatePersonaSystem(personaSystem)')
    expect(handleProduce).toMatch(/if \(!personaCheck\.ok\) return json\(400, \{ error: personaCheck\.error \}\)/)
    expect(handleProduce.indexOf('personaCheck.ok')).toBeLessThan(handleProduce.indexOf("'application/x-ndjson'"))
    expect(source).not.toMatch(/personaSystem\.length <= 16_384/)
  })
})
