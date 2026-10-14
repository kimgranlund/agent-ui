// scripts/e2e-admin/probe/model.ts: the chat probe's pure core (T-0174). The probe fixture format, the
// per-turn record, the wire-line readers and the named checks. No browser, no filesystem, no network, so
// the fast selftest drives every check over canned records.
//
// A check reads one turn record and returns pass, fail, warn or skip. `fail` makes the probe exit 1;
// `warn` is reported only (the reasoning check stays warn-level until T-0172 lands).

import { heal } from '../../../packages/agent-ui/a2ui/src/corpus/heal.ts'
import { readMetaLine } from '../../../packages/agent-ui/a2ui/src/agent/meta-line.ts'

// ── the probe fixture (`agent-ui-chat-probe` v1) ──────────────────────────────────────────────────────

export type ProbeStep = { say: string } | { click: string }

/** One provider call as the trace log records it: the raw text and the tool calls (`render_surface`
 *  carries the payload on a capture round). */
export interface ProbeRound {
  text: string
  tools: Array<{ name: string; input: unknown }>
}

/** One produce request's scripted answer: the wire lines the page receives and, when known, the model
 *  rounds behind them (what the no-surface-loss check compares against). */
export interface ProbeTurn {
  lines: string[]
  rounds?: ProbeRound[]
  /** The produce input the rounds answered (the trace's user text or action), for the offline replay. */
  input?: { kind: 'intent'; text: string } | { kind: 'client'; message: unknown }
}

export interface ProbeFixture {
  kind: 'agent-ui-chat-probe'
  version: 1
  name: string
  /** The preset id the page starts on (`agent-admin-app.activePreset`). */
  agent: string
  model?: string
  effort?: string
  /** Where the fixture came from (trace ids), for the reader. */
  source?: string
  steps: ProbeStep[]
  turns: ProbeTurn[]
  expect?: { components?: string[] }
}

export class FixtureError extends Error {
  override name = 'FixtureError'
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function strings(v: unknown, path: string): string[] {
  if (!Array.isArray(v) || v.some((s) => typeof s !== 'string')) throw new FixtureError(`${path} must be an array of strings`)
  return v as string[]
}

/** Parse and validate one probe fixture text. Throws `FixtureError` naming the first bad field. */
export function parseProbeFixture(text: string): ProbeFixture {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (err) {
    throw new FixtureError(`not valid JSON (${err instanceof Error ? err.message : String(err)})`)
  }
  if (!isObject(raw)) throw new FixtureError('$ must be an object')
  for (const key of Object.keys(raw)) {
    if (!['kind', 'version', 'name', 'agent', 'model', 'effort', 'source', 'steps', 'turns', 'expect'].includes(key)) throw new FixtureError(`${key}: unknown field`)
  }
  if (raw.kind !== 'agent-ui-chat-probe') throw new FixtureError('kind must be "agent-ui-chat-probe"')
  if (raw.version !== 1) throw new FixtureError('version must be 1')
  if (typeof raw.name !== 'string' || raw.name === '') throw new FixtureError('name must be a non-empty string')
  if (typeof raw.agent !== 'string' || raw.agent === '') throw new FixtureError('agent must be a non-empty string')
  for (const key of ['model', 'effort', 'source'] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== 'string') throw new FixtureError(`${key} must be a string`)
  }
  if (!Array.isArray(raw.steps) || raw.steps.length === 0) throw new FixtureError('steps must be a non-empty array')
  const steps = raw.steps.map((s, i): ProbeStep => {
    if (isObject(s) && typeof s.say === 'string' && Object.keys(s).length === 1) return { say: s.say }
    if (isObject(s) && typeof s.click === 'string' && Object.keys(s).length === 1) return { click: s.click }
    throw new FixtureError(`steps[${i}] must be {"say": string} or {"click": string}`)
  })
  if (!Array.isArray(raw.turns)) throw new FixtureError('turns must be an array')
  const turns = raw.turns.map((t, i): ProbeTurn => {
    if (!isObject(t)) throw new FixtureError(`turns[${i}] must be an object`)
    const turn: ProbeTurn = { lines: strings(t.lines, `turns[${i}].lines`) }
    if (t.rounds !== undefined) {
      if (!Array.isArray(t.rounds)) throw new FixtureError(`turns[${i}].rounds must be an array`)
      turn.rounds = t.rounds.map((r, j) => {
        if (!isObject(r) || typeof r.text !== 'string' || !Array.isArray(r.tools)) throw new FixtureError(`turns[${i}].rounds[${j}] must be {text, tools}`)
        return { text: r.text, tools: (r.tools as Array<{ name: string; input: unknown }>).map((x) => ({ name: String(x.name), input: x.input })) }
      })
    }
    if (t.input !== undefined) {
      const input = t.input
      if (isObject(input) && input.kind === 'intent' && typeof input.text === 'string') turn.input = { kind: 'intent', text: input.text }
      else if (isObject(input) && input.kind === 'client' && input.message !== undefined) turn.input = { kind: 'client', message: input.message }
      else throw new FixtureError(`turns[${i}].input must be {kind: "intent", text} or {kind: "client", message}`)
    }
    return turn
  })
  const fixture: ProbeFixture = { kind: 'agent-ui-chat-probe', version: 1, name: raw.name, agent: raw.agent, steps, turns }
  if (typeof raw.model === 'string') fixture.model = raw.model
  if (typeof raw.effort === 'string') fixture.effort = raw.effort
  if (typeof raw.source === 'string') fixture.source = raw.source
  if (raw.expect !== undefined) {
    if (!isObject(raw.expect)) throw new FixtureError('expect must be an object')
    fixture.expect = raw.expect.components !== undefined ? { components: strings(raw.expect.components, 'expect.components') } : {}
  }
  return fixture
}

// ── the wire-line readers ─────────────────────────────────────────────────────────────────────────────

/** The A2UI messages in one wire line (non-meta), or none. */
function messagesOf(line: string): Array<Record<string, unknown>> {
  if (readMetaLine(line) !== undefined) return []
  const healed = heal(line)
  if (!healed.ok) return []
  const out = healed.messages as unknown
  return (Array.isArray(out) ? out : [out]).filter(isObject)
}

const surfaceOf = (msg: Record<string, unknown>, op: string): string | undefined => {
  const body = msg[op]
  return isObject(body) && typeof body.surfaceId === 'string' ? body.surfaceId : undefined
}

/** Surface ids the shipped lines create, minus the ones they delete, in creation order. */
export function shippedSurfaces(lines: readonly string[]): string[] {
  const open: string[] = []
  for (const line of lines) {
    for (const msg of messagesOf(line)) {
      const created = surfaceOf(msg, 'createSurface')
      if (created !== undefined && !open.includes(created)) open.push(created)
      const deleted = surfaceOf(msg, 'deleteSurface')
      if (deleted !== undefined && open.includes(deleted)) open.splice(open.indexOf(deleted), 1)
    }
  }
  return open
}

/** Every component type the shipped `updateComponents` lines carry. */
export function shippedTypes(lines: readonly string[]): string[] {
  const types = new Set<string>()
  for (const line of lines) {
    for (const msg of messagesOf(line)) {
      const body = msg.updateComponents
      if (!isObject(body) || !Array.isArray(body.components)) continue
      for (const c of body.components) if (isObject(c) && typeof c.component === 'string') types.add(c.component)
    }
  }
  return [...types]
}

/** The shipped component with this id (the label a click step reads), across the given lines. */
export function shippedComponent(lines: readonly string[], id: string): Record<string, unknown> | undefined {
  let found: Record<string, unknown> | undefined
  for (const line of lines) {
    for (const msg of messagesOf(line)) {
      const body = msg.updateComponents
      if (!isObject(body) || !Array.isArray(body.components)) continue
      for (const c of body.components) if (isObject(c) && c.id === id) found = c
    }
  }
  return found
}

/** What the meta-lines say about the turn: the terminal error, the runtime trace, the prose shown
 *  (note and streamed text deltas), and whether reasoning excerpts rode the progress channel. */
export function metaOf(lines: readonly string[]): {
  error?: string
  rounds?: number
  failureCodes: string[]
  prose: string[]
  reasoningChars: number
} {
  const out: ReturnType<typeof metaOf> = { failureCodes: [], prose: [], reasoningChars: 0 }
  let delta = ''
  for (const line of lines) {
    const meta = readMetaLine(line)?.a2uiMeta as Record<string, unknown> | undefined
    if (meta === undefined) continue
    if (typeof meta.error === 'string') out.error = meta.error
    if (typeof meta.note === 'string') out.prose.push(meta.note)
    if (typeof meta.textDelta === 'string') delta += meta.textDelta
    const trace = meta.trace
    if (isObject(trace)) {
      if (typeof trace.rounds === 'number') out.rounds = trace.rounds
      if (Array.isArray(trace.failureCodes)) out.failureCodes = trace.failureCodes.map(String)
    }
    const progress = meta.progress
    if (isObject(progress) && typeof progress.reasoning === 'string') out.reasoningChars += progress.reasoning.length
  }
  if (delta !== '') out.prose.push(delta)
  return out
}

const CREATE_RE = /"createSurface"\s*:\s*\{\s*"surfaceId"\s*:\s*"([^"]+)"/g

/** Surface ids a model round tried to create: its text lines and every `render_surface` payload. Lines
 *  the healer reads are parsed; a line it rejects (a PARSE round) falls back to the createSurface shape. */
export function createdInRound(round: ProbeRound): string[] {
  const texts = [round.text]
  for (const tool of round.tools) {
    const input = tool.input as { jsonl?: unknown } | undefined
    if (tool.name === 'render_surface' && typeof input?.jsonl === 'string') texts.push(input.jsonl)
  }
  const ids = new Set<string>()
  for (const text of texts) {
    for (const line of text.split('\n')) {
      if (!line.includes('createSurface')) continue
      const parsed = messagesOf(line)
      const found = parsed.map((m) => surfaceOf(m, 'createSurface')).filter((s): s is string => s !== undefined)
      if (found.length > 0) found.forEach((s) => ids.add(s))
      else for (const m of line.matchAll(CREATE_RE)) ids.add(m[1]!)
    }
  }
  return [...ids]
}

// ── A2UI JSON in prose ────────────────────────────────────────────────────────────────────────────────

const A2UI_IN_PROSE: readonly RegExp[] = [
  /"(?:createSurface|updateComponents|updateDataModel|deleteSurface|surfaceUpdate|beginRendering|dataModelUpdate)"\s*:/,
  /\{\s*"version"\s*:\s*"v\d/,
  /"component"\s*:\s*"[A-Z][A-Za-z]+"\s*,/,
]

/** The first A2UI-shaped fragment in a prose text, or undefined. */
export function a2uiInProse(text: string): string | undefined {
  for (const re of A2UI_IN_PROSE) {
    const m = re.exec(text)
    if (m) return text.slice(Math.max(0, m.index - 20), m.index + 60).replace(/\s+/g, ' ')
  }
  return undefined
}

// ── the turn record and the checks ────────────────────────────────────────────────────────────────────

export interface TraceRef {
  /** `<day file>:<1-based line>` inside `.agent-traces/`. */
  id: string
  outcome: string
  retries: Array<{ round: number; codes: string[] }>
  /** Thinking characters per round, as the trace counted them. */
  thinkingChars: number[]
}

export interface TurnRecord {
  index: number
  step: ProbeStep
  /** What the page sent (the model pick lands here). `personaSystem` and `messages` are never kept. */
  request?: { model?: string; effort?: string; agent?: string; catalogId?: string; inputKind?: string }
  httpStatus?: number
  lines: string[]
  rounds?: ProbeRound[]
  roundsSource: 'trace' | 'fixture' | 'none'
  trace?: TraceRef
  /** Surface hosts in the chat pane after the turn; undefined offline (no DOM). */
  domHosts?: number
  /** The chat log's visible text outside every surface host after the turn; offline, the meta prose. */
  proseText: string
  lint?: Array<{ rule: string; detail: string }>
  lintNotRun?: string[]
  screenshot?: string
}

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'skip'

export interface CheckResult {
  check: string
  turn?: number
  status: CheckStatus
  detail: string
}

export interface CheckOptions {
  expectComponents: readonly string[]
  /** The requested pick; checked against what the page sent. */
  model?: string
  effort?: string
}

/** The named checks, in report order. */
export const CHECK_NAMES = ['model-pick', 'no-halt', 'no-json-as-prose', 'no-surface-loss', 'expect-component', 'render-lint', 'reasoning'] as const

/** Run every named check over the turn records. Per-turn checks report one row per turn; the run-level
 *  ones (expect-component) one row. */
export function runChecks(turns: readonly TurnRecord[], opts: CheckOptions): CheckResult[] {
  const out: CheckResult[] = []
  const shippedSoFar: string[] = []
  for (const t of turns) {
    const meta = metaOf(t.lines)
    // model-pick: the page sent the model and effort the probe asked for.
    if (opts.model === undefined && opts.effort === undefined) out.push({ check: 'model-pick', turn: t.index, status: 'skip', detail: 'no --model or --effort asked' })
    else if (t.request === undefined) out.push({ check: 'model-pick', turn: t.index, status: 'skip', detail: 'no request body observed' })
    else {
      const bad: string[] = []
      if (opts.model !== undefined && t.request.model !== opts.model) bad.push(`model ${JSON.stringify(t.request.model)} != ${opts.model}`)
      if (opts.effort !== undefined && t.request.effort !== opts.effort) bad.push(`effort ${JSON.stringify(t.request.effort)} != ${opts.effort}`)
      out.push({ check: 'model-pick', turn: t.index, status: bad.length ? 'fail' : 'pass', detail: bad.length ? bad.join('; ') : `${t.request.model ?? '-'} / ${t.request.effort ?? '-'}` })
    }
    // no-halt: no terminal error line, no halt or error outcome in the trace, no non-2xx answer.
    const halted =
      meta.error !== undefined ? `error line: ${meta.error.slice(0, 160)}` :
      t.trace !== undefined && (t.trace.outcome === 'halt' || t.trace.outcome === 'error') ? `trace outcome ${t.trace.outcome}` :
      t.httpStatus !== undefined && (t.httpStatus < 200 || t.httpStatus >= 300) ? `HTTP ${t.httpStatus}` : undefined
    out.push({ check: 'no-halt', turn: t.index, status: halted ? 'fail' : 'pass', detail: halted ?? `outcome ${t.trace?.outcome ?? 'ok'}` })
    // no-json-as-prose: the chat log's prose (outside surface hosts) carries no A2UI JSON.
    const leak = a2uiInProse(t.proseText)
    out.push({ check: 'no-json-as-prose', turn: t.index, status: leak ? 'fail' : 'pass', detail: leak ? `A2UI JSON in the chat prose: ...${leak}...` : `${t.proseText.length} chars of prose, clean` })
    // no-surface-loss: every surface a round created is open after the turn (shipped, and mounted).
    for (const s of shippedSurfaces(t.lines)) if (!shippedSoFar.includes(s)) shippedSoFar.push(s)
    if (t.rounds === undefined || t.rounds.length === 0) {
      out.push({ check: 'no-surface-loss', turn: t.index, status: 'skip', detail: 'no round data (roundsSource none)' })
    } else if (halted !== undefined) {
      out.push({ check: 'no-surface-loss', turn: t.index, status: 'skip', detail: 'the turn halted (see no-halt): nothing shipped to compare' })
    } else {
      const created = [...new Set(t.rounds.flatMap(createdInRound))]
      const lost = created.filter((s) => !shippedSoFar.includes(s))
      const unmounted = t.domHosts !== undefined && t.domHosts < shippedSoFar.length ? `${shippedSoFar.length} surfaces shipped, ${t.domHosts} hosts mounted` : undefined
      const bad = [lost.length ? `created in a round but never shipped: ${lost.join(', ')}` : '', unmounted ?? ''].filter(Boolean)
      out.push({
        check: 'no-surface-loss',
        turn: t.index,
        status: bad.length ? 'fail' : 'pass',
        detail: bad.length ? bad.join('; ') : `rounds created [${created.join(', ')}], open [${shippedSoFar.join(', ')}] (${t.roundsSource})`,
      })
    }
    // render-lint: the dogfood render rules over the turn's surfaces.
    if (t.lint === undefined) out.push({ check: 'render-lint', turn: t.index, status: 'skip', detail: 'no DOM (offline replay)' })
    else {
      const notRun = t.lintNotRun?.length ? ` (not run: ${t.lintNotRun.join(', ')})` : ''
      out.push({
        check: 'render-lint',
        turn: t.index,
        status: t.lint.length ? 'fail' : 'pass',
        detail: t.lint.length ? `${t.lint.slice(0, 5).map((f) => `${f.rule}: ${f.detail}`).join('; ')}${notRun}` : `clean${notRun}`,
      })
    }
    // reasoning (warn until T-0172): thinking on (effort above low) should leave thinking text behind.
    const effort = t.request?.effort ?? opts.effort
    if (effort === undefined || effort === 'low' || effort === 'none') out.push({ check: 'reasoning', turn: t.index, status: 'skip', detail: `effort ${effort ?? 'unknown'}` })
    else if (t.trace === undefined && meta.reasoningChars === 0) out.push({ check: 'reasoning', turn: t.index, status: 'skip', detail: 'no trace and no reasoning excerpts to read' })
    else {
      const chars = (t.trace?.thinkingChars.reduce((a, b) => a + b, 0) ?? 0) + meta.reasoningChars
      out.push({ check: 'reasoning', turn: t.index, status: chars > 0 ? 'pass' : 'warn', detail: chars > 0 ? `${chars} thinking chars` : `effort ${effort} but no thinking text captured` })
    }
  }
  if (opts.expectComponents.length > 0) {
    const types = new Set(turns.flatMap((t) => shippedTypes(t.lines)))
    const missing = opts.expectComponents.filter((c) => !types.has(c))
    out.push({ check: 'expect-component', status: missing.length ? 'fail' : 'pass', detail: missing.length ? `missing ${missing.join(', ')} (shipped ${[...types].join(', ') || 'none'})` : `found ${opts.expectComponents.join(', ')}` })
  } else {
    out.push({ check: 'expect-component', status: 'skip', detail: 'no --expect-component' })
  }
  return out
}

/** The short table the probe prints: one row per turn, then the failing and warning checks. */
export function formatTable(turns: readonly TurnRecord[], checks: readonly CheckResult[]): string {
  const rows = turns.map((t) => {
    const meta = metaOf(t.lines)
    const step = 'say' in t.step ? `say "${t.step.say.slice(0, 30)}"` : `click "${t.step.click}"`
    const retries = t.trace ? t.trace.retries.map((r) => r.codes.join('+')).join(' ') || '0' : meta.failureCodes.join('+') || '0'
    return [String(t.index + 1), step, t.trace?.outcome ?? (meta.error ? 'error' : 'ok'), retries, shippedSurfaces(t.lines).join(',') || '-', shippedTypes(t.lines).slice(0, 6).join(',') || '-', t.trace?.id ?? '-']
  })
  const header = ['#', 'step', 'outcome', 'retries', 'surfaces', 'types', 'trace']
  const widths = header.map((h, c) => Math.max(h.length, ...rows.map((r) => r[c]!.length)))
  const render = (cells: string[]): string => cells.map((cell, c) => cell.padEnd(widths[c]!)).join('  ').trimEnd()
  const lines = [render(header), ...rows.map(render)]
  const notable = checks.filter((c) => c.status === 'fail' || c.status === 'warn')
  for (const c of notable) lines.push(`${c.status.toUpperCase()} ${c.check}${c.turn !== undefined ? ` turn ${c.turn + 1}` : ''}: ${c.detail}`)
  const fails = checks.filter((c) => c.status === 'fail').length
  lines.push(`chat-probe: ${checks.filter((c) => c.status === 'pass').length} passed, ${fails} failed, ${checks.filter((c) => c.status === 'warn').length} warned`)
  return lines.join('\n')
}
