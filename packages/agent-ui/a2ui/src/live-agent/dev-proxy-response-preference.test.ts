// dev-proxy-response-preference.test.ts (T-0060 step 6, RTS-R6 AC3 and RTS-R7): the dev proxy's produce
// route validates `responsePreference` and `prefers` and threads each into produce() only when valid.
// Drives the REAL dev-proxy middleware with the provider dispatch module mocked (the
// dev-proxy-abort.test.ts precedent) and asserts on the request the mocked provider receives.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { a2uiDevProxyPlugin } from '../../tools/agent/dev-proxy-plugin.ts'
import { RENDER_SURFACE_TOOL_NAME } from '../agent/response-type.ts'

declare const process: { cwd(): string; env: Record<string, string | undefined> }

const state = vi.hoisted(() => ({ requests: [] as Array<Record<string, unknown>> }))

// vitest hoists vi.mock above the imports; the factory may only close over `vi.hoisted` state.
vi.mock('../../tools/agent/providers/index.ts', () => ({
  providerFor: () => ({
    ok: true,
    provider: {
      // One note-only meta-line: a clean one-round produce success (dev-proxy-abort.test.ts `complete`).
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

beforeAll(() => {
  // The plugin's `config` hook (the `loadEnv` merge) is deliberately NOT invoked: the real `.env` is never read.
  previousKey = process.env['ANTHROPIC_API_KEY']
  process.env['ANTHROPIC_API_KEY'] = 'sk-test-value'
  const plugin = a2uiDevProxyPlugin()
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
})

beforeEach(() => {
  state.requests.length = 0
})

/** POST one produce turn to completion; return the first request the mocked provider received. */
async function produceTurn(extra: Record<string, unknown>): Promise<Record<string, unknown>> {
  const body = { input: { kind: 'intent', text: 'a submit button', session: { turns: [] } }, provider: 'anthropic', model: 'claude-sonnet-5', ...extra }
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
  const res = {
    statusCode: 0,
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    setHeader: () => {},
    on: () => {},
    write: () => true,
    end: () => {
      res.writableEnded = true
      settle()
    },
  }
  handler(req, res)
  await done
  expect(res.statusCode).toBe(200)
  expect(state.requests.length).toBeGreaterThan(0)
  return state.requests[0] as Record<string, unknown>
}

const toolNames = (req: Record<string, unknown>): string[] => ((req['tools'] as Array<{ name: string }> | undefined) ?? []).map((t) => t.name)
const SURFACE_PARAGRAPH = readFileSync(`${process.cwd()}/packages/agent-ui/a2ui/src/agent/prompts/response-preference-surface.md`, 'utf8').trim()

describe('host threading', () => {
  it("responsePreference: 'text' reaches the provider with no render_surface tool", async () => {
    const req = await produceTurn({ responsePreference: 'text' })
    expect(toolNames(req)).not.toContain(RENDER_SURFACE_TOOL_NAME)
  })

  it("prefers: 'surface' puts the surface paragraph in system and still offers the tool", async () => {
    const req = await produceTurn({ prefers: 'surface' })
    expect(String(req['system'])).toContain(SURFACE_PARAGRAPH)
    expect(toolNames(req)).toContain(RENDER_SURFACE_TOOL_NAME)
  })

  it("responsePreference: 'TEXT' is dropped, so the tool is still offered (negative control)", async () => {
    const req = await produceTurn({ responsePreference: 'TEXT' })
    expect(toolNames(req)).toContain(RENDER_SURFACE_TOOL_NAME)
    state.requests.length = 0
    const plain = await produceTurn({})
    expect(String(plain['system'])).not.toContain(SURFACE_PARAGRAPH)
  })
})
