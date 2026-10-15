// agent-trace.test.ts (T-0151): the dev proxy's per-turn trace log (`tools/agent/trace-log.ts`) and its
// reader (`tools/agent/traces-cli.ts`). The unit half pins the line shape and the redaction with no
// filesystem; the route half drives the REAL dev-proxy middleware (the dev-proxy-abort.test.ts harness,
// provider dispatch mocked) with a temp trace dir and proves a failed turn writes its full upstream error,
// with the key redacted, while the chat line carries the dev reason.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { a2uiDevProxyPlugin } from '../../tools/agent/dev-proxy-plugin.ts'
import { GENERIC_FAILURE_MESSAGE } from '../../tools/agent/chat-validation.ts'
import {
  TurnTraceCollector,
  agentLabel,
  catalogRouting,
  defaultTracing,
  describeFailure,
  devFailureReason,
  diagnoseParse,
  readUpstreamError,
  redactSecrets,
  serializeTraceLine,
  tracesEnabled,
} from '../../tools/agent/trace-log.ts'
import type { AgentTraceLine } from '../../tools/agent/trace-log.ts'
import { newRunId, readRunId, RUN_ID_HEADER, withRunId } from '../../tools/agent/run-id.ts'
import { runCli } from '../../tools/agent/traces-cli.ts'
import type { AgentProvider, ProviderEvent } from '../agent/agent-transport.ts'

declare const process: { cwd(): string; env: Record<string, string | undefined> }

const KEY = 'sk-ant-api03-test-key-value-0123456789'
const UPSTREAM_401 = `anthropicProvider: upstream error 401: {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"echo":"${KEY}"}`

const state = vi.hoisted(() => ({ error: undefined as unknown, script: [] as string[] }))

// A scripted round yields its text (with one empty thinking delta, the shape the API streams when thinking
// display is omitted); with no script left the call throws `state.error`.
vi.mock('../../tools/agent/providers/index.ts', () => ({
  providerFor: () => ({
    ok: true,
    provider: {
      async *stream(req: { onEvent?: (ev: { kind: string; text?: string; usage?: unknown }) => void }) {
        const next = state.script.shift()
        if (next === undefined) throw state.error
        req.onEvent?.({ kind: 'thinking', text: '' })
        req.onEvent?.({ kind: 'usage', usage: { inputTokens: 1000, outputTokens: 100 } })
        yield next
      },
    },
  }),
}))

describe('trace line shape (T-0151)', () => {
  it('records steps, retries with their failures, raw output per round, the surface and usage', async () => {
    let clock = 1_000
    const trace = new TurnTraceCollector(
      { route: 'produce', provider: 'anthropic', model: 'claude-haiku-5-5', user: 'a submit button', agent: 'croupier', effort: 'low', catalogId: 'agent-ui--croupier' },
      () => clock,
    )
    const rounds = ['{"version":"v0.9","createSurface":', '{"a2uiMeta":{"note":"ok"}}\n{"version":"v0.9","createSurface":{"surfaceId":"s1"}}']
    let call = 0
    const fake: AgentProvider = {
      async *stream(req) {
        const text = rounds[call++]!
        clock += 50
        req.onEvent?.({ kind: 'usage', usage: { inputTokens: 100, outputTokens: 20 } } satisfies ProviderEvent)
        await req.executeTool?.('render_surface', { lines: 1 })
        yield text
      },
    }
    const seen: ProviderEvent[] = []
    const provider = trace.wrapProvider(fake)
    for (let r = 0; r < 2; r++) {
      let out = ''
      for await (const f of provider.stream({ model: 'm', system: 's', messages: [], onEvent: (e) => seen.push(e), executeTool: async () => 'ok' })) out += f
      expect(out).toBe(rounds[r]) // the tee changes nothing the caller sees
    }
    expect(seen.filter((e) => e.kind === 'usage')).toHaveLength(2) // events still reach the caller
    expect(trace.onRepairRound({ round: 2, failures: [{ code: 'PARSE', path: '', detail: 'unexpected end' } as { code: string; path: string }] })).toBeUndefined()
    trace.observeLine('{"a2uiMeta":{"progress":{"stage":"sent"}}}')
    trace.observeLine('{"a2uiMeta":{"progress":{"stage":"retry","round":2,"codes":["PARSE"]}}}')
    trace.observeLine('{"a2uiMeta":{"note":"Here it is.","trace":{"turnIndex":0,"query":{"intent":"x","k":3},"exemplarIds":["e1"],"rounds":2,"healed":0,"failureCodes":["PARSE"],"model":"m","usage":{"inputTokens":200,"outputTokens":40}}}}')
    trace.observeLine('{"version":"v0.9","createSurface":{"surfaceId":"s1","catalogId":"agent-ui"}}')
    trace.observeLine('{"version":"v0.9","updateComponents":{"surfaceId":"s1","components":[{"id":"root"},{"id":"b"}]}}')
    const line = trace.finish()

    expect(line).toMatchObject({
      v: 1,
      route: 'produce',
      agent: 'croupier',
      provider: 'anthropic',
      model: 'claude-haiku-5-5',
      effort: 'low',
      user: 'a submit button',
      outcome: 'ok',
      reply: 'Here it is.',
      usage: { inputTokens: 200, outputTokens: 40 },
      surface: { lines: 2, ops: { createSurface: 1, updateComponents: 1 }, components: 2, surfaceIds: ['s1'] },
      trace: { rounds: 2, healed: 0, failureCodes: ['PARSE'], exemplarIds: ['e1'] },
    })
    expect(line.steps.map((s) => s.stage)).toEqual(['sent', 'retry'])
    expect(line.steps[1]).toMatchObject({ round: 2, codes: ['PARSE'] })
    expect(line.retries).toEqual([{ round: 2, failures: [{ code: 'PARSE', path: '', detail: 'unexpected end' }] }])
    expect(line.rounds.map((r) => r.text)).toEqual(rounds)
    expect(line.rounds[0]).toMatchObject({ round: 1, ms: 50, usage: { inputTokens: 100, outputTokens: 20 }, tools: [{ name: 'render_surface', input: { lines: 1 } }] })
    expect(line.warnings).toEqual(['retried as round 2: PARSE'])
    expect(line.error).toBeUndefined()
    expect(JSON.parse(serializeTraceLine(line))).toEqual(line) // one JSON object, round-trips
  })

  it('classifies a halt and an upstream error, and a pre-model rejection', () => {
    const halt = new TurnTraceCollector({ route: 'produce', provider: 'anthropic', model: 'm', user: 'u' })
    const err = Object.assign(new Error('produce: no valid surface within the round bound (PARSE)'), { name: 'ProduceHalt', failures: [{ code: 'PARSE', path: '' }] })
    halt.fail(err)
    expect(halt.finish()).toMatchObject({ outcome: 'halt', error: { name: 'ProduceHalt', failures: [{ code: 'PARSE', path: '' }] } })

    const upstream = new TurnTraceCollector({ route: 'chat', provider: 'anthropic', model: 'm', user: 'u' })
    upstream.fail(new Error(UPSTREAM_401))
    expect(upstream.finish()).toMatchObject({ outcome: 'error', error: { status: 401 } })

    const rejected = new TurnTraceCollector({ route: 'produce', provider: 'anthropic', model: 'm', user: 'u' })
    rejected.reject(503, 'no-key')
    expect(rejected.finish()).toMatchObject({ outcome: 'rejected', error: { status: 503, message: 'no-key' } })
  })

  it('redacts configured key values and key-shaped strings from every string in the line', () => {
    const trace = new TurnTraceCollector({ route: 'chat', provider: 'anthropic', model: 'm', user: `my key is ${KEY}` })
    trace.fail(new Error(UPSTREAM_401))
    trace.setReply('Authorization: Bearer abcdefghijklmnop and sk-proj-ABCDEFGHIJKLMNOPQRSTU and opaque-secret-1234')
    const text = serializeTraceLine(trace.finish(), ['opaque-secret-1234'])
    expect(text).not.toContain(KEY)
    expect(text).not.toContain('abcdefghijklmnop')
    expect(text).not.toContain('sk-proj-ABCDEFGHIJKLMNOPQRSTU')
    expect(text).not.toContain('opaque-secret-1234')
    expect(text).toContain('[redacted]')
    expect(text).toContain('invalid x-api-key') // the provider's sentence survives; only the key goes
    // A short value is never treated as a secret (it would shred ordinary words).
    expect(redactSecrets('the cat sat', ['cat'])).toBe('the cat sat')
  })

  it('reads the upstream status and the provider sentence; the dev reason never carries the raw body', () => {
    expect(readUpstreamError(new Error(UPSTREAM_401))).toMatchObject({ status: 401 })
    expect(readUpstreamError(new Error('something else'))).toEqual({})
    expect(devFailureReason(new Error(UPSTREAM_401), [KEY])).toBe('upstream 401: invalid x-api-key')
    expect(devFailureReason(new Error('anthropicProvider: upstream error 500: {"secret":"x"}'))).toBe('upstream 500')
    expect(devFailureReason(new TypeError(`bad ${KEY}`))).toBe('TypeError: bad [redacted]')
  })

  it('names the agent from the body, else the persona segment of the catalog id', () => {
    expect(agentLabel('Croupier', 'agent-ui--croupier')).toBe('Croupier')
    expect(agentLabel(undefined, 'agent-ui--croupier')).toBe('croupier')
    expect(agentLabel(undefined, 'agent-ui')).toBeUndefined()
    expect(agentLabel(42, undefined)).toBeUndefined()
  })

  it('the env flag defaults on, turns off with 0/false/off, and never traces under Vitest by default', () => {
    expect(tracesEnabled({})).toBe(true)
    for (const off of ['0', 'false', 'OFF']) expect(tracesEnabled({ A2UI_AGENT_TRACES: off })).toBe(false)
    expect(tracesEnabled({ A2UI_AGENT_TRACES: '1' })).toBe(true)
    expect(defaultTracing({})).toBe(false) // VITEST is set in this process
  })
})

// ── the route half ──────────────────────────────────────────────────────────────────────────────────

type Middleware = (req: unknown, res: unknown) => void
let handler: Middleware
let dir: string
let previousKey: string | undefined

beforeAll(() => {
  previousKey = process.env['ANTHROPIC_API_KEY']
  process.env['ANTHROPIC_API_KEY'] = KEY
  dir = mkdtempSync(join(tmpdir(), 'agent-traces-'))
  const plugin = a2uiDevProxyPlugin({ traces: { dir } })
  const server = { middlewares: { use: (_mount: string, fn: Middleware) => (handler = fn) } }
  ;(plugin.configureServer as unknown as (s: unknown) => void)(server)
})

afterAll(() => {
  if (previousKey === undefined) delete process.env['ANTHROPIC_API_KEY']
  else process.env['ANTHROPIC_API_KEY'] = previousKey
  rmSync(dir, { recursive: true, force: true })
})

/** Run one POST turn to its end; return everything written to the response. */
async function post(url: string, body: unknown, headers?: Record<string, string>): Promise<{ status: number; text: string }> {
  const listeners: Record<string, Array<(arg?: unknown) => void>> = {}
  const req = {
    method: 'POST',
    url,
    ...(headers !== undefined ? { headers } : {}),
    on(event: string, cb: (arg?: unknown) => void) {
      ;(listeners[event] ??= []).push(cb)
      if (event === 'end')
        queueMicrotask(() => {
          for (const fn of listeners['data'] ?? []) fn(JSON.stringify(body))
          for (const fn of listeners['end'] ?? []) fn()
        })
    },
  }
  const chunks: string[] = []
  let settle: () => void = () => {}
  const done = new Promise<void>((r) => (settle = r))
  const res = {
    statusCode: 0,
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    setHeader: () => {},
    on: () => {},
    write: (c: string) => chunks.push(c) > 0,
    end: (c?: string) => {
      if (c !== undefined) chunks.push(c)
      res.writableEnded = true
      settle()
    },
  }
  handler(req, res)
  await done
  return { status: res.statusCode, text: chunks.join('') }
}

function writtenLines(): AgentTraceLine[] {
  return readdirSync(dir)
    .filter((n) => n.endsWith('.jsonl'))
    .flatMap((n) => readFileSync(join(dir, n), 'utf8').split('\n').filter(Boolean))
    .map((l) => JSON.parse(l) as AgentTraceLine)
}

function rawLog(): string {
  return readdirSync(dir)
    .map((n) => readFileSync(join(dir, n), 'utf8'))
    .join('')
}

describe('a failed live turn writes its upstream error to the trace log (T-0151)', () => {
  it('produce: the line holds the status and full body, redacted; the chat shows the dev reason', async () => {
    state.error = new Error(UPSTREAM_401)
    const before = writtenLines().length
    const out = await post('/produce', {
      input: { kind: 'intent', text: 'a submit button', session: { turns: [] } },
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
      catalogId: 'agent-ui--croupier',
    })
    expect(out.status).toBe(200)
    expect(out.text).toContain(GENERIC_FAILURE_MESSAGE)
    expect(out.text).toContain('[dev: upstream 401: invalid x-api-key]')
    expect(out.text).not.toContain(KEY)

    const lines = writtenLines()
    expect(lines).toHaveLength(before + 1)
    const line = lines.at(-1)!
    expect(line).toMatchObject({ route: 'produce', outcome: 'error', agent: 'croupier', model: 'claude-sonnet-5-5', user: 'a submit button', error: { status: 401 } })
    expect(line.error?.body).toContain('authentication_error')
    expect(line.error?.body).toContain('invalid x-api-key')
    expect(line.rounds[0]?.error).toContain('upstream error 401')
    expect(rawLog()).not.toContain(KEY)
  })

  it('/chat: the line holds the upstream error; the 500 body carries the dev reason, never the raw body', async () => {
    state.error = new Error(UPSTREAM_401)
    const before = writtenLines().length
    const out = await post('/chat', { system: 'be helpful', model: 'claude-sonnet-5-5', messages: [{ role: 'user', content: 'hi there' }] })
    expect(out.status).toBe(500)
    const body = JSON.parse(out.text) as { error: string }
    expect(body.error).toBe(`${GENERIC_FAILURE_MESSAGE} [dev: upstream 401: invalid x-api-key]`)
    expect(out.text).not.toMatch(/anthropicProvider|authentication_error/)

    const line = writtenLines().at(-1)!
    expect(writtenLines()).toHaveLength(before + 1)
    expect(line).toMatchObject({ route: 'chat', outcome: 'error', user: 'hi there', error: { status: 401 } })
    expect(line.error?.body).toContain('invalid x-api-key')
    expect(rawLog()).not.toContain(KEY)
  })

  it('a rejected pair is recorded too, and npm run traces reads the log', async () => {
    const out = await post('/produce', { input: { kind: 'intent', text: 'x', session: { turns: [] } }, provider: 'anthropic', model: 'not-a-model' })
    expect(out.status).toBe(400)
    expect(writtenLines().at(-1)).toMatchObject({ outcome: 'rejected', error: { status: 400 } })

    const logs: string[] = []
    const io = { log: (t: string) => logs.push(t) }
    expect(runCli(['--dir', dir, '--last', '5'], io)).toBe(0)
    const table = logs.join('\n')
    expect(table).toMatch(/^#\s+time \(UTC\)/)
    expect(table).toContain('rejected')
    expect(table).toContain('401 anthropicProvider: upstream error 401')
    expect(table).not.toContain(KEY)

    logs.length = 0
    expect(runCli(['--dir', dir, '--full', '2'], io)).toBe(0) // #2 is the /chat failure
    expect(logs.join('\n')).toContain('invalid x-api-key')
    expect(runCli(['--dir', dir, '--full', '99'], io)).toBe(1)
    expect(runCli(['--bogus'], io)).toBe(2)
    expect(runCli(['--dir', join(dir, 'absent')], io)).toBe(0)
  })
})

// ── the Croupier case (Kim, 2026-10-14) ─────────────────────────────────────────────────────────────
// Sonnet 5 at medium. Turn 1 "hello" failed PARSE in round 1 and passed round 2. Turn 2 (the guest picked
// Blackjack) failed IDGRAPH in rounds 1 and 2 and passed round 3, whose payload only updated greet-1 with a
// Text and a Row: no CardTable, so no table appeared. Driven through the real dev proxy and the real
// produce() loop; only the provider is scripted.

const V = '"version":"v1.0"'
const GREETING_TREE =
  `{${V},"updateComponents":{"surfaceId":"greet-1","components":[` +
  '{"id":"root","component":"Column","children":["greeting","games"]},' +
  '{"id":"greeting","component":"Text","text":"Welcome to the table."},' +
  '{"id":"games","component":"Row","children":["bj"]},' +
  '{"id":"bj","component":"Button","label":"Blackjack","action":{"action":"pick"}}]}}'
const CREATE = `{${V},"createSurface":{"surfaceId":"greet-1","catalogId":"agent-ui--croupier"}}`
const TURN1_ROUND1 = `{"a2uiMeta":{"note":"Welcome."}}\n${CREATE}\n${GREETING_TREE.slice(0, -1)}` // the closing brace is missing
const TURN1_ROUND2 = `{"a2uiMeta":{"note":"Welcome."}}\n${CREATE}\n${GREETING_TREE}`
const TURN2_ROUND1 = `{"a2uiMeta":{"note":"Blackjack it is."}}\n{${V},"updateComponents":{"surfaceId":"greet-1","components":[{"id":"games","component":"Row","children":["bj","table"]}]}}`
const TURN2_ROUND2 = `{"a2uiMeta":{"note":"Blackjack it is."}}\n{${V},"updateComponents":{"surfaceId":"greet-1","components":[{"id":"root","component":"Column","children":["greeting","table"]}]}}`
const TURN2_ROUND3 =
  `{"a2uiMeta":{"note":"Blackjack it is."}}\n{${V},"updateComponents":{"surfaceId":"greet-1","components":[` +
  '{"id":"greeting","component":"Text","text":"Blackjack it is. Place your bet."},{"id":"games","component":"Row","children":["bj"]}]}}'

const produceBody = (input: unknown) => ({ input, provider: 'anthropic', model: 'claude-sonnet-5-5', effort: 'medium', catalogId: 'agent-ui--croupier', progressDetail: 'source' })

describe('the Croupier case is readable from the trace file (T-0151)', () => {
  it('turn 1: round 1 PARSE with the parser error and position, round 2 passed', async () => {
    state.script = [TURN1_ROUND1, TURN1_ROUND2]
    const out = await post('/produce', produceBody({ kind: 'intent', text: 'hello', session: { turns: [] } }))
    expect(out.status).toBe(200)
    const line = writtenLines().at(-1)!
    expect(line).toMatchObject({ outcome: 'ok', agent: 'croupier', effort: 'medium', user: 'hello' })
    expect(line.rounds.map((r) => r.status)).toEqual(['failed', 'passed'])
    const r1 = line.rounds[0]!
    expect(r1.text).toBe(TURN1_ROUND1) // the failed round's raw output, verbatim
    expect(r1.failures?.map((f) => f.code)).toEqual(['PARSE'])
    expect(r1.parse).toMatchObject({ line: 2 })
    expect(r1.parse?.message).toMatch(/JSON/)
    expect(r1.parse?.column).toBeGreaterThan(1)
    expect(line.rounds[1]!.text).toBe(TURN1_ROUND2)
    expect(line.surface).toMatchObject({ ops: { createSurface: 1, updateComponents: 1 }, surfaceIds: ['greet-1'], types: { Column: 1, Text: 1, Row: 1, Button: 1 } })
    // Thinking was streamed with no text: the API omitted it (thinking display), not the proxy.
    expect(r1.thinking).toEqual({ deltas: 1, chars: 0 })

    // The dev build's retry line carries the account the Validated step shows.
    const retry = out.text.split('\n').map((l) => (l ? (JSON.parse(l) as { a2uiMeta?: { progress?: { stage: string; detail?: string } } }) : {})).find((m) => m.a2uiMeta?.progress?.stage === 'retry')
    expect(retry?.a2uiMeta?.progress?.detail).toMatch(/^Round 1 failed:\n {2}PARSE: .*\n {2}parse error at payload line 2, column \d+: /)
  })

  it('turn 2: rounds 1 and 2 IDGRAPH with the dangling id (round 2 resends root, an upsert since T-0172, still naming "table"), round 3 only a Text and a Row', async () => {
    state.script = [TURN2_ROUND1, TURN2_ROUND2, TURN2_ROUND3]
    const session = { turns: [{ role: 'user', content: 'hello' }, { role: 'assistant', content: `${CREATE}\n${GREETING_TREE}` }] }
    const out = await post('/produce', produceBody({ kind: 'intent', text: 'I pick Blackjack', session }))
    expect(out.status).toBe(200)
    const line = writtenLines().at(-1)!
    expect(line.outcome).toBe('ok')
    expect(line.rounds.map((r) => r.status)).toEqual(['failed', 'failed', 'passed'])
    expect(line.rounds.map((r) => r.text)).toEqual([TURN2_ROUND1, TURN2_ROUND2, TURN2_ROUND3])
    expect(line.rounds[0]!.failures).toContainEqual(expect.objectContaining({ code: 'IDGRAPH', path: 'games->table', message: expect.stringContaining('"table"') }))
    expect(line.rounds[1]!.failures).toEqual([expect.objectContaining({ code: 'IDGRAPH', path: 'root->table' })])
    expect(line.retries.map((r) => r.round)).toEqual([2, 3])
    // The shipped payload: one updateComponents on greet-1, a Text and a Row, and no CardTable.
    expect(line.surface).toMatchObject({ ops: { updateComponents: 1 }, surfaceIds: ['greet-1'], components: 2, types: { Text: 1, Row: 1 } })
    expect(line.surface.types['CardTable']).toBeUndefined()

    // `npm run traces -- --full 1` reads the same story.
    const logs: string[] = []
    expect(runCli(['--dir', dir, '--full', '1'], { log: (t) => logs.push(t) })).toBe(0)
    const full = logs.join('\n')
    expect(full).toContain('round 1 (failed')
    expect(full).toContain('dangling id')
    expect(full).toContain('types Text 1, Row 1')
  })

  it('describes each IDGRAPH shape and locates a parse error without the proxy', () => {
    expect(describeFailure({ code: 'IDGRAPH', path: 'greet-1:root-missing' })).toContain('no component with id "root"')
    expect(describeFailure({ code: 'IDGRAPH', path: 'greet-1:cycle' })).toContain('cycle')
    expect(diagnoseParse('{"a2uiMeta":{"note":"x"}}\n{"ok":1}\n{"broken":')).toMatchObject({ line: 2 })
    expect(diagnoseParse('{"ok":1}')).toBeUndefined()
  })
})

// ── per-turn routing (T-0239) ───────────────────────────────────────────────────────────────────────
// The trace line records how the turn's context was routed: the catalog's persona and domains, the selected
// mini-skills, each system-prompt section with its cache side, and every capability entry the context named
// with its load mode. Driven through the real dev proxy and produce(); only the provider is scripted.

const INDEX_TEACHING = 'The capability lists below are an INDEX: one line per item, its name and a short description.'
const CONCIERGE_PERSONA = [
  'You are the Concierge of a small hotel.',
  INDEX_TEACHING,
  '## Resources available to you\n- property-knowledge-base \u2014 Facilities, hours and policies.\n- curated-local-guides',
  '## Workflows available to you\n- booking-flow \u2014 Book a spa slot, a table or a tour.',
].join('\n\n')
const BOOKING_FRAMED = '## Referenced for this message\n### booking-flow (workflow)\nBook a spa slot.\n\n1. Ask the day.\n\nBook me a massage.'
const BLACKJACK_FRAMED = '## Referenced for this message\n### blackjack (resource)\nthe classic house game\n\nTwo cards each.\n\nLet\'s play blackjack.'

describe('the trace line records per-turn routing (T-0239)', () => {
  it('a croupier turn: persona catalog, mini-skills, sections with the cache boundary, a framed resource loaded in full', async () => {
    state.script = [TURN1_ROUND2]
    const out = await post('/produce', { ...produceBody({ kind: 'intent', text: BLACKJACK_FRAMED, session: { turns: [] } }), personaSystem: 'You are the Croupier.\n\n' + INDEX_TEACHING + '\n\n## Skills available to you\n- house-voice \u2014 Warm and brief.' })
    expect(out.status).toBe(200)
    const line = writtenLines().at(-1)!
    expect(line.outcome).toBe('ok')
    const routing = line.routing!
    expect(routing.catalog).toEqual({ id: 'agent-ui--croupier', base: 'agent-ui', persona: 'croupier', domains: [] })
    expect(routing.references).toEqual([
      { kind: 'skill', name: 'house-voice', load: 'index-only', via: 'index' },
      { kind: 'resource', name: 'blackjack', load: 'full', via: 'message' },
    ])
    expect(routing.miniSkills).toEqual(expect.arrayContaining([expect.any(String)]))
    const sections = routing.sections!
    expect(sections.map((s) => s.id).slice(0, 3)).toEqual(['grammar', 'components', 'functions'])
    expect(sections.filter((s) => s.cache === 'stable').map((s) => s.id)).toEqual(['grammar', 'components', 'functions'])
    expect(sections.at(-1)).toMatchObject({ id: 'persona', cache: 'volatile' })
    expect(routing.cacheBoundary).toBe(sections.slice(0, 3).reduce((n, s) => n + s.chars, 0))
    expect(sections.reduce((n, s) => n + s.chars, 0)).toBe(line.trace?.promptChars)
    // Names and kinds only: no entry content reaches the routing block.
    expect(JSON.stringify(routing)).not.toContain('Two cards each')
  })

  it('a concierge turn: the knowledge base is index-only, the booking flow loaded in full from history', async () => {
    state.script = ['{"a2uiMeta":{"note":"The pool opens at 06:00."}}']
    const session = { turns: [{ role: 'user', content: BOOKING_FRAMED }, { role: 'assistant', content: '{"a2uiMeta":{"note":"Which day?"}}' }] }
    const out = await post('/produce', { ...produceBody({ kind: 'intent', text: 'What are the pool hours?', session }), catalogId: 'agent-ui--concierge', personaSystem: CONCIERGE_PERSONA })
    expect(out.status).toBe(200)
    const line = writtenLines().at(-1)!
    expect(line).toMatchObject({ agent: 'concierge', outcome: 'ok' })
    const routing = line.routing!
    expect(routing.catalog).toEqual({ id: 'agent-ui--concierge', base: 'agent-ui', persona: 'concierge', domains: [] })
    expect(routing.references).toEqual([
      { kind: 'resource', name: 'property-knowledge-base', load: 'index-only', via: 'index' },
      { kind: 'resource', name: 'curated-local-guides', load: 'index-only', via: 'index' },
      { kind: 'workflow', name: 'booking-flow', load: 'index-only', via: 'index' },
      { kind: 'workflow', name: 'booking-flow', load: 'full', via: 'history' },
    ])
    expect(Array.isArray(routing.miniSkills)).toBe(true)
    expect(routing.sections?.find((s) => s.id === 'persona')).toMatchObject({ cache: 'volatile' })
  })

  it('reads a domain catalog id and keeps the host-known routing on a failed turn', () => {
    expect(catalogRouting('agent-ui')).toEqual({ id: 'agent-ui', base: 'agent-ui', domains: [] })
    expect(catalogRouting('agent-ui--design+games')).toEqual({ id: 'agent-ui--design+games', base: 'agent-ui', domains: ['design', 'games'] })
    const failed = new TurnTraceCollector({ route: 'produce', provider: 'anthropic', model: 'm', user: BLACKJACK_FRAMED })
    failed.noteRouting('agent-ui--croupier', undefined)
    failed.fail(new Error(UPSTREAM_401))
    expect(failed.finish().routing).toEqual({ catalog: { id: 'agent-ui--croupier', base: 'agent-ui', persona: 'croupier', domains: [] }, references: [{ kind: 'resource', name: 'blackjack', load: 'full', via: 'message' }] })
  })
})

describe('the trace line carries the probe run id (T-0259)', () => {
  const quick = (): void => {
    state.script = ['{"a2uiMeta":{"note":"The pool opens at 06:00."}}']
  }
  const body = (): Record<string, unknown> => ({ input: { kind: 'intent', text: 'pool hours', session: { turns: [] } }, provider: 'anthropic', model: 'claude-sonnet-5-5', catalogId: 'agent-ui--concierge' })

  it('a produce turn sent with x-a2ui-run-id writes it as runId; a turn without the header writes none', async () => {
    quick()
    expect((await post('/produce', body(), { [RUN_ID_HEADER]: 'concierge-spa-haiku-1-a1b2c3d4' })).status).toBe(200)
    expect(writtenLines().at(-1)).toMatchObject({ route: 'produce', outcome: 'ok', runId: 'concierge-spa-haiku-1-a1b2c3d4' })
    quick()
    await post('/produce', body())
    expect(writtenLines().at(-1)).not.toHaveProperty('runId')
  })

  it('a header that is not an id is dropped, never trimmed into another id', async () => {
    for (const bad of ['', 'has space', '../etc', 'x'.repeat(81), '-leading-dash']) {
      quick()
      await post('/produce', body(), { [RUN_ID_HEADER]: bad })
      expect(writtenLines().at(-1)).not.toHaveProperty('runId')
    }
  })

  it('a turn that reached its final meta-line states its exemplar list is complete; a rejected turn does not', async () => {
    quick()
    await post('/produce', body(), { [RUN_ID_HEADER]: 'r-1' })
    expect(writtenLines().at(-1)?.trace).toMatchObject({ exemplarsComplete: true })
    const rejected = new TurnTraceCollector({ route: 'produce', provider: 'anthropic', model: 'm', user: 'u', runId: 'r-2' })
    rejected.reject(400, 'bad pair')
    expect(rejected.finish()).toMatchObject({ outcome: 'rejected', runId: 'r-2' })
    expect(rejected.finish().trace).toBeUndefined()
  })

  it('the id grammar: readRunId accepts a header list, newRunId stays inside the grammar', () => {
    expect(readRunId(['a-1', 'b'])).toBe('a-1')
    expect(readRunId(undefined)).toBeUndefined()
    expect(readRunId(42)).toBeUndefined()
    const id = newRunId('concierge spa/booking!', 'deadbeef')
    expect(id).toBe('concierge-spa-booking--deadbeef')
    expect(readRunId(id)).toBe(id)
    expect(readRunId(newRunId('', 'deadbeef'))).toBe('run-deadbeef')
    expect(readRunId(newRunId('n'.repeat(200), 'deadbeef'))).toBeDefined()
    // The probe forwards the page's headers and adds its id, replacing a page-sent one of any casing.
    expect(withRunId({ 'content-type': 'application/json', 'X-A2UI-Run-Id': 'stale' }, 'r-9')).toEqual({ 'content-type': 'application/json', [RUN_ID_HEADER]: 'r-9' })
  })
})
