// scripts/e2e-admin/record.ts: record mode. The same runner against a key-bearing `vite dev`, with the
// model routes passed through and teed into a scenario.
//
// `/status` and `/integrations` go to the real dev proxy; produce and chat go out with `route.fetch()`,
// and each observed response is fulfilled to the page and teed into `turns`. Request bodies are never
// stored (only `builderMission` and `input.kind`, as the turn's `match`), so `personaSystem` never lands in
// a fixture. The finished scenario passes `scrubScenario` before anything is written; a refusal writes
// nothing. The live leg needs a key and is a manual run; the selftest proves the tee and the scrub.

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Browser } from 'playwright'
import { setDefaultWaitMs } from './admin-page.ts'
import {
  classifyRequest,
  parseBody,
  type FulfillLike,
  type RouteLike,
  type WireEndpoint,
  type WireEntry,
  type WireLog,
  type WireOutcome,
} from './intercept.ts'
import {
  bootVite,
  launchChromium,
  loadScenario,
  runOneFlow,
  stopVite,
  FIXTURES_DIR,
  type AdminFlow,
  type DevServerKit,
  type ViteHandle,
} from './runner.ts'
import { parseScenario, scrubScenario, ScrubRefusal, type AdminScenario, type ScriptedTurn } from './scenario.ts'

export interface ResponseLike {
  status(): number
  headers(): Record<string, string>
  text(): Promise<string>
}

export interface RecordRouteLike extends RouteLike {
  fetch(options?: { timeout?: number }): Promise<ResponseLike>
}

export interface RecordableContext {
  route(url: string, handler: (route: RecordRouteLike) => unknown): Promise<unknown>
}

const LIVE_FETCH_TIMEOUT_MS = 180_000
const RECORD_WAIT_MS = 150_000
const RECORD_FLOW_TIMEOUT_MS = 600_000

export interface RecorderState {
  origin: string
  entries: WireEntry[]
  turns: ScriptedTurn[]
  pending: Set<Promise<void>>
  seq: number
}

export function createRecorderState(origin: string): RecorderState {
  return { origin, entries: [], turns: [], pending: new Set(), seq: 0 }
}

/** The recorded turn for one observed response. Reads only `builderMission` and `input.kind` from the
 *  request; the body itself is never kept. */
export function teeTurn(endpoint: 'produce' | 'chat', requestBody: unknown, status: number, text: string): ScriptedTurn {
  const b = (requestBody ?? {}) as { builderMission?: unknown; input?: { kind?: unknown } }
  const match: NonNullable<ScriptedTurn['match']> = {}
  if (typeof b.builderMission === 'boolean') match.mission = b.builderMission
  if (b.input?.kind === 'intent' || b.input?.kind === 'client') match.inputKind = b.input.kind
  const withMatch = Object.keys(match).length > 0 ? { match } : {}
  if (status < 200 || status >= 300) {
    let error = `HTTP ${status}`
    try {
      const parsed = JSON.parse(text) as { error?: unknown }
      if (typeof parsed.error === 'string') error = parsed.error
    } catch {
      // keep the status line
    }
    return { endpoint, ...withMatch, respond: { status, error } }
  }
  if (endpoint === 'produce') {
    return { endpoint, ...withMatch, respond: { lines: text.split('\n').filter((line) => line.trim() !== '') } }
  }
  let reply = ''
  try {
    const parsed = JSON.parse(text) as { text?: unknown }
    if (typeof parsed.text === 'string') reply = parsed.text
  } catch {
    // a malformed chat body records as an empty reply
  }
  return { endpoint, ...withMatch, respond: { text: reply } }
}

/** Route one request in record mode: model calls go out and are teed; everything else keeps the run's
 *  network edge (external aborted, unknown `/__a2ui/` answered 404). */
export async function teeRoute(state: RecorderState, route: RecordRouteLike): Promise<void> {
  const request = route.request()
  const method = request.method()
  const url = request.url()
  const endpoint: WireEndpoint | undefined = classifyRequest(state.origin, method, url)
  if (endpoint === undefined) {
    await route.continue()
    return
  }
  const body = parseBody(request)
  const b = (body ?? {}) as { builderMission?: unknown; input?: { kind?: unknown } }
  const projected =
    endpoint === 'produce' ? { builderMission: b.builderMission, input: { kind: b.input?.kind } } : undefined
  const log = (outcome: WireOutcome, turnIndex?: number): void => {
    state.seq += 1
    state.entries.push({
      seq: state.seq,
      at: Date.now(),
      endpoint,
      method,
      url,
      ...(projected !== undefined ? { request: projected } : {}),
      outcome,
      ...(turnIndex !== undefined ? { turnIndex } : {}),
    })
  }
  if (endpoint === 'external') {
    log('aborted')
    await route.abort()
    return
  }
  if (endpoint === 'status' || endpoint === 'integrations') {
    log('fulfilled')
    await route.continue()
    return
  }
  if (endpoint === 'other-a2ui') {
    log('fulfilled')
    const answer: FulfillLike = { status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'e2e-admin record: not recorded' }) }
    await route.fulfill(answer)
    return
  }
  const turnIndex = state.turns.length
  state.turns.push({ endpoint, respond: { abort: true } }) // placeholder keeps arrival order
  let response: ResponseLike
  try {
    response = await route.fetch({ timeout: LIVE_FETCH_TIMEOUT_MS })
  } catch {
    log('aborted', turnIndex)
    await route.abort()
    return
  }
  const text = await response.text()
  const status = response.status()
  state.turns[turnIndex] = teeTurn(endpoint, body, status, text)
  log('fulfilled', turnIndex)
  await route.fulfill({ status, contentType: response.headers()['content-type'] ?? 'application/octet-stream', body: text })
}

export interface Recorder {
  wire: WireLog
  state: RecorderState
  /** Resolves once every in-flight tee has finished. */
  settled(): Promise<void>
}

export function installRecorder(context: RecordableContext, origin: string): Recorder {
  const state = createRecorderState(origin)
  const ready = context.route('**/*', (route) => {
    const job = teeRoute(state, route).catch(() => {})
    state.pending.add(job)
    void job.finally(() => state.pending.delete(job))
    return job
  })
  const wire: WireLog = { entries: state.entries, consumed: [], ready }
  return {
    wire,
    state,
    settled: async () => {
      while (state.pending.size > 0) await Promise.all([...state.pending])
    },
  }
}

/** Assemble the recorded scenario: the flow fixture's `seed` and `status` plus the recorded turns. */
export function recordedScenario(name: string, fixture: AdminScenario, turns: readonly ScriptedTurn[]): AdminScenario {
  return {
    kind: 'agent-ui-admin-scenario',
    version: 1,
    name,
    ...(fixture.seed !== undefined ? { seed: fixture.seed } : {}),
    ...(fixture.status !== undefined ? { status: fixture.status } : {}),
    turns: [...turns],
  }
}

/** Record one flow against the live dev proxy and write the scrubbed scenario to `out` (cwd-relative).
 *  Exit codes: 0 written, 1 scrub refusal or unverified teardown, 2 setup or an unavailable live status. */
export async function recordFlow(flow: AdminFlow, out: string, kit: DevServerKit, root: string, cwd: string): Promise<number> {
  const fixture = loadScenario(path.join(FIXTURES_DIR, flow.fixture))
  let vite: ViteHandle
  try {
    vite = await bootVite(kit, root)
  } catch (err) {
    console.log(`[e2e-admin] setup failed: ${err instanceof Error ? err.message : String(err)}`)
    return 2
  }
  let code = 0
  let browser: Browser | undefined
  try {
    const status = (await (await fetch(`${vite.base}/__a2ui/agent/status`)).json().catch(() => ({}))) as { available?: unknown }
    if (status.available !== true) {
      console.log('[e2e-admin] record needs a live model: /__a2ui/agent/status is not available (set a provider key in .env)')
      code = 2
    } else {
      setDefaultWaitMs(RECORD_WAIT_MS)
      browser = await launchChromium()
      let recorder: Recorder | undefined
      const { outcome } = await runOneFlow(
        browser,
        { flow, scenario: fixture, fixtureLabel: flow.fixture },
        vite.base,
        RECORD_FLOW_TIMEOUT_MS,
        (context, _scenario, origin) => {
          recorder = installRecorder(context, origin)
          return recorder.wire
        },
        () => {},
      )
      await recorder?.settled()
      console.log(`[e2e-admin] record: flow ${flow.name} ${outcome.kind === 'pass' ? 'passed' : `did not pass (${outcome.kind}: ${outcome.message.split('\n')[0]})`}; not gating`)
      const scenario = recordedScenario(flow.name, fixture, recorder?.state.turns ?? [])
      try {
        scrubScenario(scenario, process.env)
        const text = `${JSON.stringify(scenario, null, 2)}\n`
        parseScenario(text) // the written file must load as a fixture
        const target = path.resolve(cwd, out)
        mkdirSync(path.dirname(target), { recursive: true })
        writeFileSync(target, text)
        console.log(`[e2e-admin] recorded ${scenario.turns.length} turn(s) to ${out}`)
      } catch (err) {
        code = 1
        console.log(`FAIL scrub: ${err instanceof ScrubRefusal ? err.message : err instanceof Error ? err.message : String(err)}; nothing written`)
      }
    }
  } catch (err) {
    code = 2
    console.log(`[e2e-admin] setup failed: ${err instanceof Error ? err.message : String(err)}`)
  }
  let teardownOk = true
  try {
    if (browser !== undefined) await browser.close()
    await stopVite(kit, vite)
  } catch (err) {
    teardownOk = false
    console.log(`[e2e-admin] teardown FAILED: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (teardownOk) console.log('[e2e-admin] teardown verified: process tree dead, port released')
  return code === 0 && !teardownOk ? 1 : code
}
