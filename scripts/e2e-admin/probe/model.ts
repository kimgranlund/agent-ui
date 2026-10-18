// scripts/e2e-admin/probe/model.ts: the chat probe's pure core (T-0174). The probe fixture format, the
// per-turn record, the wire-line readers and the named checks. No browser, no filesystem, no network, so
// the fast selftest drives every check over canned records.
//
// A check reads one turn record and returns pass, fail, warn or skip. `fail` makes the probe exit 1;
// `warn` is reported only (the reasoning check stays warn-level until a live probe confirms T-0172's
// `display: 'summarized'` yields thinking text).

import { heal } from '../../../packages/agent-ui/a2ui/src/corpus/heal.ts'
import { readMetaLine } from '../../../packages/agent-ui/a2ui/src/agent/meta-line.ts'
import { renderSurfaceJsonl } from '../../../packages/agent-ui/a2ui/src/agent/response-type.ts'
import { readPointer } from '../../../packages/agent-ui/a2ui/src/catalog/semantic-check.ts'
import type { A2uiComponent } from '../../../packages/agent-ui/a2ui/src/protocol.ts'
import { applyComponentBatch } from '../../../packages/agent-ui/a2ui/src/renderer/component-merge.ts'

// ── the probe fixture (`agent-ui-chat-probe` v1) ──────────────────────────────────────────────────────

/** `expect` (T-0222, `--expect-turn`): component types this step's turn must leave on a surface it updates.
 *  `expectRouting` (T-0260, `--expect-routing`): the routing this step's turn must get, read against its trace.
 *  `skipIfPhase` (T-0347, `--skip-if-phase`): an in-hand step the probe does not play while the newest table is in
 *  this phase (a natural settled the hand on the deal); see `stepSkip`.
 *  `page` (T-0222): a turn the page fired itself (an error turn after a renderer rejection), recorded as its own
 *  row; a replay never plays it, the page fires it again. */
export type ProbeStep = ({ say: string } | { click: string } | { page: string }) & { expect?: string[]; expectRouting?: RoutingExpect; skipIfPhase?: string }

/** T-0260: the routing a step's turn should get. `domains`: each is the turn's catalog persona or one of its
 *  domains. `exemplars`: ids the turn's framed exemplars must hold (`include`) or must not (`exclude`).
 *  `sections`: system prompt section ids that must be composed. `references`: entries that must reach the turn,
 *  at `load` when given (`full` when an index-only doc must be fetched). */
export interface RoutingExpect {
  domains?: string[]
  exemplars?: { include?: string[]; exclude?: string[] }
  sections?: string[]
  references?: Array<{ name: string; load?: 'full' | 'index-only' }>
}

/** T-0260: what the turn's trace line recorded about its routing (`routing`, `events`), flattened for the check. */
export interface RoutingSeen {
  /** The catalog persona, then its domains. */
  domains: string[]
  exemplars: string[]
  sections: string[]
  references: Array<{ name: string; load: string }>
}

/** The probe argv for one step, in the order the CLI reads it: the `--say` or `--click`, then every flag that attaches
 *  to it (`--expect-turn`, `--expect-routing`, `--skip-if-phase`). The one place a scenario's steps become flags, so a
 *  flag a step carries reaches every round (T-0347: round3Argv dropped `--skip-if-phase`). A `page` step has none. */
export function stepArgv(s: ProbeStep): string[] {
  return [
    ...('say' in s ? ['--say', s.say] : 'click' in s ? ['--click', s.click] : []),
    ...(s.expect ?? []).flatMap((c) => ['--expect-turn', c]),
    ...(s.expectRouting !== undefined ? ['--expect-routing', JSON.stringify(s.expectRouting)] : []),
    ...(s.skipIfPhase !== undefined ? ['--skip-if-phase', s.skipIfPhase] : []),
  ]
}

/** The scenario modules' step builders (T-0343): a `--say` or `--click` whose `expect` types become its `--expect-turn`
 *  (any-of), and the routed forms that also carry an `--expect-routing` oracle (T-0260). */
export const say = (text: string, ...expect: string[]): ProbeStep => (expect.length ? { say: text, expect } : { say: text })
export const click = (label: string, ...expect: string[]): ProbeStep => (expect.length ? { click: label, expect } : { click: label })
export const sayRouted = (text: string, routing?: RoutingExpect, ...expect: string[]): ProbeStep => ({ ...say(text, ...expect), ...(routing !== undefined ? { expectRouting: routing } : {}) })
export const clickRouted = (label: string, routing?: RoutingExpect, ...expect: string[]): ProbeStep => ({ ...click(label, ...expect), ...(routing !== undefined ? { expectRouting: routing } : {}) })

/** One argument as a shell word of a generated `live-commands.sh`: bare when safe, else double-quoted. */
export const quote = (arg: string): string => (/^[A-Za-z0-9_./:-]+$/.test(arg) ? arg : `"${arg.replace(/(["\\$`])/g, '\\$1')}"`)

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
  /** T-0260: the routing the trace recorded for this turn, so `routing-expect` judges a replay keyless. */
  routing?: RoutingSeen
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

function nonEmpty(v: unknown, path: string): string {
  if (typeof v !== 'string' || v === '') throw new FixtureError(`${path} must be a non-empty string`)
  return v
}

function strings(v: unknown, path: string): string[] {
  if (!Array.isArray(v) || v.some((s) => typeof s !== 'string')) throw new FixtureError(`${path} must be an array of strings`)
  return v as string[]
}

/** T-0260: validate an `expectRouting` value. Throws `FixtureError` naming the first bad field. */
export function parseRoutingExpect(v: unknown, path: string): RoutingExpect {
  if (!isObject(v)) throw new FixtureError(`${path} must be an object`)
  for (const key of Object.keys(v)) if (!['domains', 'exemplars', 'sections', 'references'].includes(key)) throw new FixtureError(`${path}.${key}: unknown field`)
  const out: RoutingExpect = {}
  if (v.domains !== undefined) out.domains = strings(v.domains, `${path}.domains`)
  if (v.sections !== undefined) out.sections = strings(v.sections, `${path}.sections`)
  if (v.exemplars !== undefined) {
    const ex = v.exemplars
    if (!isObject(ex) || Object.keys(ex).some((k) => k !== 'include' && k !== 'exclude')) throw new FixtureError(`${path}.exemplars must be {include?, exclude?}`)
    out.exemplars = {
      ...(ex.include !== undefined ? { include: strings(ex.include, `${path}.exemplars.include`) } : {}),
      ...(ex.exclude !== undefined ? { exclude: strings(ex.exclude, `${path}.exemplars.exclude`) } : {}),
    }
  }
  if (v.references !== undefined) {
    if (!Array.isArray(v.references)) throw new FixtureError(`${path}.references must be an array`)
    out.references = v.references.map((r, i) => {
      if (!isObject(r) || typeof r.name !== 'string' || (r.load !== undefined && r.load !== 'full' && r.load !== 'index-only'))
        throw new FixtureError(`${path}.references[${i}] must be {name, load?: "full" | "index-only"}`)
      return r.load !== undefined ? { name: r.name, load: r.load } : { name: r.name }
    })
  }
  if (Object.keys(out).length === 0) throw new FixtureError(`${path} names no routing to expect`)
  return out
}

function parseRoutingSeen(v: unknown, path: string): RoutingSeen {
  if (!isObject(v) || !Array.isArray(v.references)) throw new FixtureError(`${path} must be {domains, exemplars, sections, references}`)
  return {
    domains: strings(v.domains, `${path}.domains`),
    exemplars: strings(v.exemplars, `${path}.exemplars`),
    sections: strings(v.sections, `${path}.sections`),
    references: v.references.map((r, i) => {
      if (!isObject(r) || typeof r.name !== 'string' || typeof r.load !== 'string') throw new FixtureError(`${path}.references[${i}] must be {name, load}`)
      return { name: r.name, load: r.load }
    }),
  }
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
    const bad = (): FixtureError => new FixtureError(`steps[${i}] must be {"say": string}, {"click": string} or {"page": string}, with an optional "expect" string array and "expectRouting"`)
    if (!isObject(s) || Object.keys(s).some((k) => !['say', 'click', 'page', 'expect', 'expectRouting', 'skipIfPhase'].includes(k))) throw bad()
    const expect = {
      ...(s.expect !== undefined ? { expect: strings(s.expect, `steps[${i}].expect`) } : {}),
      ...(s.expectRouting !== undefined ? { expectRouting: parseRoutingExpect(s.expectRouting, `steps[${i}].expectRouting`) } : {}),
      ...(s.skipIfPhase !== undefined ? { skipIfPhase: nonEmpty(s.skipIfPhase, `steps[${i}].skipIfPhase`) } : {}),
    }
    const kinds = (['say', 'click', 'page'] as const).filter((k) => s[k] !== undefined)
    if (kinds.length !== 1 || typeof s[kinds[0]!] !== 'string') throw bad()
    const kind = kinds[0]!
    return kind === 'say' ? { say: s.say as string, ...expect } : kind === 'click' ? { click: s.click as string, ...expect } : { page: s.page as string, ...expect }
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
    if (t.routing !== undefined) turn.routing = parseRoutingSeen(t.routing, `turns[${i}].routing`)
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

/** Every surface id a shipped content line names (any message kind), in first-named order. */
export function touchedSurfaces(lines: readonly string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    for (const msg of messagesOf(line)) {
      for (const op of ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface']) {
        const sid = surfaceOf(msg, op)
        if (sid !== undefined && !out.includes(sid)) out.push(sid)
      }
    }
  }
  return out
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

/** Set `value` at an absolute pointer without mutating `doc` (only the nodes along the path are copied). */
function setPointer(doc: unknown, pointer: string, value: unknown): unknown {
  const tokens = pointer.slice(1).split('/').map((t) => t.replace(/~1/g, '/').replace(/~0/g, '~'))
  const set = (node: unknown, i: number): unknown => {
    if (i === tokens.length) return value
    const key = tokens[i]!
    if (Array.isArray(node)) {
      const copy = node.slice()
      copy[Number(key)] = set(node[Number(key)], i + 1)
      return copy
    }
    const base = isObject(node) ? node : {}
    return { ...base, [key]: set(base[key], i + 1) }
  }
  return set(doc, 0)
}

/** T-0347: the wire lines folded, one batch at a time, into each surface's components and data model the way the
 *  renderer applies them (`applyComponentBatch`, `updateDataModel` at a pointer), so the probe can read the phase of
 *  the newest table. `feed` takes only the lines not yet folded; a live run feeds each turn once. */
export class TablePhase {
  #views = new Map<string, { components: Map<string, A2uiComponent>; model: unknown }>()

  feed(lines: readonly string[]): this {
    for (const line of lines) {
      for (const msg of messagesOf(line)) {
        const created = surfaceOf(msg, 'createSurface')
        if (created !== undefined) {
          this.#views.delete(created) // a re-created surface is the newest again
          this.#views.set(created, { components: new Map(), model: undefined })
        }
        const deleted = surfaceOf(msg, 'deleteSurface')
        if (deleted !== undefined) this.#views.delete(deleted)
        const comps = msg.updateComponents
        if (isObject(comps) && typeof comps.surfaceId === 'string' && Array.isArray(comps.components)) {
          const view = this.#view(comps.surfaceId)
          applyComponentBatch(view.components, comps.components)
        }
        const data = msg.updateDataModel
        if (isObject(data) && typeof data.surfaceId === 'string') {
          const view = this.#view(data.surfaceId)
          const path = data.path
          if (path === undefined || path === '' || path === '/') view.model = data.value
          else if (typeof path === 'string' && path.startsWith('/')) view.model = setPointer(view.model, path, data.value)
        }
      }
    }
    return this
  }

  #view(surfaceId: string): { components: Map<string, A2uiComponent>; model: unknown } {
    let view = this.#views.get(surfaceId)
    if (view === undefined) {
      view = { components: new Map(), model: undefined }
      this.#views.set(surfaceId, view)
    }
    return view
  }

  /** The phase of the newest surface that holds a CardTable (the factory's reading: the literal or the bound value,
   *  anything but `betting` and `settled` is `playing`); undefined when no surface holds one. */
  phase(): string | undefined {
    for (const view of [...this.#views.values()].reverse()) {
      const table = [...view.components.values()].find((c) => c.component === 'CardTable')
      if (table === undefined) continue
      const raw = table.phase
      const path = isObject(raw) && typeof raw.path === 'string' ? raw.path : undefined
      const value = path === undefined ? raw : readPointer(view.model, path)
      return value === 'betting' || value === 'settled' ? value : 'playing'
    }
    return undefined
  }
}

/** The newest table's phase after these lines, folded from scratch (a test's one-shot form of `TablePhase`). */
export const newestTablePhase = (lines: readonly string[]): string | undefined => new TablePhase().feed(lines).phase()

/** T-0347 (live round 10 cluster D): a natural settles the hand on the deal, so the scripted Stand, Twist or Stick
 *  that follows finds no button, or a model that answers one in prose opens a new table the next Deal again misses.
 *  A step marked `skipIfPhase` is not played while the newest table is in that phase, however it got there. */
export const stepSkip = (step: ProbeStep, phase: string | undefined): boolean => step.skipIfPhase !== undefined && phase === step.skipIfPhase

/** What the meta-lines say about the turn: the terminal error, the runtime trace, the prose shown
 *  (the note, else the streamed text deltas), and whether reasoning excerpts rode the progress channel. */
export function metaOf(lines: readonly string[]): {
  error?: string
  rounds?: number
  failureCodes: string[]
  prose: string[]
  reasoningChars: number
  /** T-0214: the open surface the turn's meta-line declares it changes (`target`, ADR-0206). */
  target?: string
} {
  const out: ReturnType<typeof metaOf> = { failureCodes: [], prose: [], reasoningChars: 0 }
  let delta = ''
  for (const line of lines) {
    const meta = readMetaLine(line)?.a2uiMeta as Record<string, unknown> | undefined
    if (meta === undefined) continue
    if (typeof meta.error === 'string') out.error = meta.error
    if (typeof meta.note === 'string') out.prose.push(meta.note)
    if (typeof meta.textDelta === 'string') delta += meta.textDelta
    if (isObject(meta.target) && typeof meta.target.surfaceId === 'string') out.target = meta.target.surfaceId
    const trace = meta.trace
    if (isObject(trace)) {
      if (typeof trace.rounds === 'number') out.rounds = trace.rounds
      if (Array.isArray(trace.failureCodes)) out.failureCodes = trace.failureCodes.map(String)
    }
    const progress = meta.progress
    if (isObject(progress) && typeof progress.reasoning === 'string') out.reasoningChars += progress.reasoning.length
  }
  // T-0234: the chat paints streamed text until a note replaces it (conversation.ts `textDelta`), so a repaired
  // turn's final note is what the user reads; the streamed text counts only when no note arrived.
  if (delta !== '' && out.prose.length === 0) out.prose.push(delta)
  return out
}

const CREATE_RE = /"createSurface"\s*:\s*\{\s*"surfaceId"\s*:\s*"([^"]+)"/g

/** Surface ids a model round tried to create: its text lines and every `render_surface` payload. Lines
 *  the healer reads are parsed; a line it rejects (a PARSE round) falls back to the createSurface shape. */
export function createdInRound(round: ProbeRound): string[] {
  const texts = [round.text]
  for (const tool of round.tools) {
    const input = tool.input
    // T-0172: the structured `messages` array, or the legacy `jsonl` string.
    if (tool.name === 'render_surface' && input !== null && typeof input === 'object') texts.push(renderSurfaceJsonl(input as Record<string, unknown>))
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
  /\{\s*"a2uiMeta"\s*:/, // T-0213: a meta-line shown as the reply
]

/** T-0235: the first match of `patterns` in `text` that `before` holds fewer times, so a fragment the turn added
 *  to a cumulative chat log. With no `before`, the first match. Counting, not a prefix cut: the page re-renders
 *  earlier bubbles (a page-fired turn replaces the note, tkt-0079), so the log does not only grow at its end. */
function firstNewMatch(text: string, patterns: readonly RegExp[], before?: string): RegExpExecArray | undefined {
  const count = (s: string, re: RegExp, hit: string): number => [...s.matchAll(re)].filter((m) => m[0] === hit).length
  for (const re of patterns) {
    const all = new RegExp(re.source, `${re.flags.replace('g', '')}g`)
    for (const m of text.matchAll(all)) {
      if (before === undefined || count(text, all, m[0]) > count(before, all, m[0])) return m as RegExpExecArray
    }
  }
  return undefined
}

/** The first A2UI-shaped fragment in a prose text (one `before` does not already hold), or undefined. */
export function a2uiInProse(text: string, before?: string): string | undefined {
  const m = firstNewMatch(text, A2UI_IN_PROSE, before)
  return m === undefined ? undefined : text.slice(Math.max(0, m.index - 20), m.index + 60).replace(/\s+/g, ' ')
}

/** T-0217: a repair round's correction note, or a surface id, in the chat prose. */
const INTERNAL_IN_PROSE: readonly RegExp[] = [/\b(?:Corrected|Correction)\s*:/, /^\s*Fixed\b[.:!]/m, /\b(?:table|ask)-\d+\b/i]

/** The first internal fragment (correction note or surface id) in a prose text (one `before` does not already
 *  hold), or undefined. */
export function internalInProse(text: string, before?: string): string | undefined {
  return firstNewMatch(text, INTERNAL_IN_PROSE, before)?.[0].trim()
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
  request?: { model?: string; effort?: string; agent?: string; catalogId?: string; inputKind?: string; actionSurface?: string; inputError?: string }
  httpStatus?: number
  lines: string[]
  rounds?: ProbeRound[]
  roundsSource: 'trace' | 'fixture' | 'none'
  trace?: TraceRef
  /** Surface hosts in the chat pane after the turn; undefined offline (no DOM). */
  domHosts?: number
  /** The chat log's visible text outside every surface host after the turn; offline, the meta prose. */
  proseText: string
  /** T-0235: `log` when `proseText` is the whole chat log (live); the prose checks then judge only what the turn
   *  added over the previous `log` record. Absent: the turn's own prose (offline). */
  proseScope?: 'log'
  /** T-0172: a `--click` that played no turn; the run stops there and still reports. */
  clickMissing?: ClickMissing
  lint?: Array<{ rule: string; detail: string }>
  lintNotRun?: string[]
  /** T-0256: absolute path in the local evidence cache (`evidence.ts`); local only, may be gone. */
  screenshot?: string
  /** T-0260: the routing the turn's trace line recorded (live: the line with this run's id; replay: the fixture). */
  routing?: RoutingSeen
}

/** T-0260: every way `seen` misses `want`, in plain words; empty when the routing matches. */
export function routingMisses(want: RoutingExpect, seen: RoutingSeen): string[] {
  const out: string[] = []
  for (const d of want.domains ?? []) if (!seen.domains.includes(d)) out.push(`domain ${d} not routed (got ${seen.domains.join(', ') || 'none'})`)
  for (const id of want.exemplars?.include ?? []) if (!seen.exemplars.includes(id)) out.push(`exemplar ${id} not framed`)
  for (const id of want.exemplars?.exclude ?? []) if (seen.exemplars.includes(id)) out.push(`exemplar ${id} framed but excluded`)
  for (const id of want.sections ?? []) if (!seen.sections.includes(id)) out.push(`section ${id} not composed`)
  for (const r of want.references ?? []) {
    const got = seen.references.filter((x) => x.name === r.name)
    if (got.length === 0) out.push(`reference ${r.name} not routed`)
    else if (r.load !== undefined && !got.some((x) => x.load === r.load)) out.push(`reference ${r.name} loaded ${got.map((x) => x.load).join('+')}, not ${r.load}`)
  }
  return out
}

/** T-0222: the index of the exchange that answers `step` among the produce requests seen since it was played:
 *  the first intent for a say, the first action (a client message with no error) for a click; -1 while none has
 *  landed. Every other exchange is page-fired (the admin's error turn after a renderer rejection). */
export function ownExchange(step: ProbeStep, seen: ReadonlyArray<{ inputKind?: string; inputError?: string }>): number {
  if ('say' in step) return seen.findIndex((s) => s.inputKind === 'intent')
  if ('click' in step) return seen.findIndex((s) => s.inputKind === 'client' && s.inputError === undefined)
  return -1
}

/** The step a page-fired exchange is recorded under: its error code, else its input kind. */
export const pageStep = (seen: { inputKind?: string; inputError?: string }): ProbeStep => ({ page: seen.inputError ?? seen.inputKind ?? 'unknown' })

/** T-0172: a `--click` step that played no turn: `available` is the visible surface buttons after it. T-0271: absent
 *  `clicked`, no button carried the label; set, the button was clicked (`inNewestSurface` false: a history surface's)
 *  and no action request followed, or one did (`requested`) and its turn never settled. */
export interface ClickMissing {
  label: string
  available: string[]
  clicked?: boolean
  inNewestSurface?: boolean
  requested?: boolean
}

/** The click-target detail for a click that played no turn. */
export function clickMissingDetail(m: ClickMissing): string {
  const buttons = `(buttons: ${m.available.join(', ') || 'none'})`
  if (m.clicked !== true) return `no surface button reading "${m.label}" ${buttons}`
  const where = m.inNewestSurface === false ? ' on an older surface in the log, not the newest' : ''
  const after = m.requested === true ? 'its action request went out, but the turn never settled' : 'but no produce request followed'
  return `clicked "${m.label}"${where}, ${after} ${buttons}`
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
  /** T-0260: a live run's id (`x-a2ui-run-id`). Set, a turn with a routing oracle and no routing read from its
   *  trace line fails `routing-expect`: the routing is unknown, and a skip would hide the trace gap. */
  runId?: string
}

/** The named checks, in report order. */
export const CHECK_NAMES = ['model-pick', 'click-target', 'no-halt', 'no-json-as-prose', 'no-internal-leak', 'reply-text', 'no-surface-loss', 'action-updates-surface', 'expect-component', 'routing-expect', 'render-lint', 'reasoning'] as const

/** Apply these lines to `held`, each open surface's component types (a deleted surface drops out). */
export function holdTypes(held: Map<string, Set<string>>, lines: readonly string[]): void {
  for (const line of lines) {
    for (const msg of messagesOf(line)) {
      const deleted = surfaceOf(msg, 'deleteSurface')
      if (deleted !== undefined) held.delete(deleted)
      const body = msg.updateComponents
      if (!isObject(body) || typeof body.surfaceId !== 'string' || !Array.isArray(body.components)) continue
      const types = held.get(body.surfaceId) ?? new Set<string>()
      for (const c of body.components) if (isObject(c) && typeof c.component === 'string') types.add(c.component)
      held.set(body.surfaceId, types)
    }
  }
}

/** Run every named check over the turn records. Per-turn checks report one row per turn; expect-component
 *  reports one row per turn (judged only on a step with its own `expect`, T-0222) and one run-level row. */
export function runChecks(turns: readonly TurnRecord[], opts: CheckOptions): CheckResult[] {
  const out: CheckResult[] = []
  const shippedSoFar: string[] = []
  const held = new Map<string, Set<string>>()
  let logBefore: string | undefined
  for (const t of turns) {
    const meta = metaOf(t.lines)
    const before = t.proseScope === 'log' ? (logBefore ?? '') : undefined
    if (t.proseScope === 'log') logBefore = t.proseText
    // model-pick: the page sent the model and effort the probe asked for.
    if (opts.model === undefined && opts.effort === undefined) out.push({ check: 'model-pick', turn: t.index, status: 'skip', detail: 'no --model or --effort asked' })
    else if (t.request === undefined) out.push({ check: 'model-pick', turn: t.index, status: 'skip', detail: 'no request body observed' })
    else {
      const bad: string[] = []
      if (opts.model !== undefined && t.request.model !== opts.model) bad.push(`model ${JSON.stringify(t.request.model)} != ${opts.model}`)
      if (opts.effort !== undefined && t.request.effort !== opts.effort) bad.push(`effort ${JSON.stringify(t.request.effort)} != ${opts.effort}`)
      out.push({ check: 'model-pick', turn: t.index, status: bad.length ? 'fail' : 'pass', detail: bad.length ? bad.join('; ') : `${t.request.model ?? '-'} / ${t.request.effort ?? '-'}` })
    }
    // click-target (T-0172): a `--click` found its button and started its turn. A missing one (the hand ended on 21,
    // so no Stand) or a dead click (T-0271) fails here by name and the run still writes its report, never an abort.
    if (!('click' in t.step)) out.push({ check: 'click-target', turn: t.index, status: 'skip', detail: 'not a click turn' })
    else if (t.clickMissing !== undefined)
      out.push({ check: 'click-target', turn: t.index, status: 'fail', detail: clickMissingDetail(t.clickMissing) })
    else out.push({ check: 'click-target', turn: t.index, status: 'pass', detail: `clicked "${t.step.click}"` })
    // no-halt: no terminal error line, no halt or error outcome in the trace, no non-2xx answer.
    const halted =
      meta.error !== undefined ? `error line: ${meta.error.slice(0, 160)}` :
      t.trace !== undefined && (t.trace.outcome === 'halt' || t.trace.outcome === 'error') ? `trace outcome ${t.trace.outcome}` :
      t.httpStatus !== undefined && (t.httpStatus < 200 || t.httpStatus >= 300) ? `HTTP ${t.httpStatus}` : undefined
    out.push({ check: 'no-halt', turn: t.index, status: halted ? 'fail' : 'pass', detail: halted ?? `outcome ${t.trace?.outcome ?? 'ok'}` })
    // no-json-as-prose: the turn's prose (outside surface hosts; live, what it added to the log) carries no A2UI JSON.
    const leak = a2uiInProse(t.proseText, before)
    out.push({ check: 'no-json-as-prose', turn: t.index, status: leak ? 'fail' : 'pass', detail: leak ? `A2UI JSON in the chat prose: ...${leak}...` : `${t.proseText.length} chars of prose, clean` })
    // no-internal-leak (T-0217): the chat prose shows no repair round ("Corrected:") and no surface id ("table-3").
    const internal = internalInProse(t.proseText, before)
    out.push({ check: 'no-internal-leak', turn: t.index, status: internal ? 'fail' : 'pass', detail: internal ? `internal text in the chat prose: "${internal}"` : 'no correction note or surface id' })
    // reply-text (T-0194): a turn that ships A2UI carries reply text on its own wire (note or text deltas), and
    // the chat never shows the "Emitted N A2UI message(s)" tally (a Sonnet 5.5 hello shipped only that).
    const content = t.lines.filter((l) => readMetaLine(l) === undefined && l.trim() !== '').length
    const replyText = meta.prose.join('').trim()
    const tallyShown = firstNewMatch(t.proseText, [/Emitted \d+ A2UI message\(s\)/], before) !== undefined
    if (halted !== undefined) out.push({ check: 'reply-text', turn: t.index, status: 'skip', detail: 'the turn halted (see no-halt)' })
    else if (content === 0) out.push({ check: 'reply-text', turn: t.index, status: 'skip', detail: 'no A2UI lines shipped (a text turn)' })
    else if (replyText === '' || tallyShown)
      out.push({ check: 'reply-text', turn: t.index, status: 'fail', detail: tallyShown ? 'the chat shows the message tally in place of a reply' : `${content} A2UI line(s) shipped with no reply text` })
    else out.push({ check: 'reply-text', turn: t.index, status: 'pass', detail: `${replyText.length} chars of reply beside ${content} A2UI line(s)` })
    // no-surface-loss: every surface a round created is open after the turn (shipped, and mounted). T-0264: only the
    // last round ships, so a surface a rejected round created and the shipped round replaced (ask-1 rejected, table-1
    // shipped in its place) was dropped by the repair, never shown. A round's surface is lost when the turn creates
    // fewer surfaces than that round made, so a surface fell out, or none at all.
    for (const s of shippedSurfaces(t.lines)) if (!shippedSoFar.includes(s)) shippedSoFar.push(s)
    if (t.rounds === undefined || t.rounds.length === 0) {
      out.push({ check: 'no-surface-loss', turn: t.index, status: 'skip', detail: 'no round data (roundsSource none)' })
    } else if (halted !== undefined) {
      out.push({ check: 'no-surface-loss', turn: t.index, status: 'skip', detail: 'the turn halted (see no-halt): nothing shipped to compare' })
    } else {
      const created = [...new Set(t.rounds.flatMap(createdInRound))]
      const shippedCount = shippedSurfaces(t.lines).length
      const lost = [...new Set(t.rounds.flatMap((r) => {
        const made = createdInRound(r)
        return made.length > shippedCount ? made.filter((s) => !shippedSoFar.includes(s)) : []
      }))]
      const replaced = created.filter((s) => !shippedSoFar.includes(s) && !lost.includes(s))
      const unmounted = t.domHosts !== undefined && t.domHosts < shippedSoFar.length ? `${shippedSoFar.length} surfaces shipped, ${t.domHosts} hosts mounted` : undefined
      const bad = [lost.length ? `created in a round but never shipped: ${lost.join(', ')}` : '', unmounted ?? ''].filter(Boolean)
      out.push({
        check: 'no-surface-loss',
        turn: t.index,
        status: bad.length ? 'fail' : 'pass',
        detail: bad.length
          ? bad.join('; ')
          : `rounds created [${created.join(', ')}], open [${shippedSoFar.join(', ')}]${replaced.length ? `, replaced by the repair [${replaced.join(', ')}]` : ''} (${t.roundsSource})`,
      })
    }
    // action-updates-surface (T-0172): a turn that answers a click updates the surface it came from, or hands the
    // flow on to a surface it creates (a Deal again that opens the next round's table). A click answered by
    // prose alone (the Haiku 5.5 deal of 2026-10-14 narrated the cards and sent no update) fails. T-0214: a say turn
    // whose meta-line targets an open surface is judged the same way ("Bet 50." settled in prose, 2026-10-15.jsonl:48).
    // T-0363: a click on an answered ask that settles the open surface its meta-line targets (a game's HUD at its end)
    // passes: the ask stays history and the flow moved to that target.
    const sayTarget = 'say' in t.step ? meta.target : undefined
    const clicked = 'click' in t.step ? t.request?.actionSurface : sayTarget
    if (!('click' in t.step) && sayTarget === undefined) out.push({ check: 'action-updates-surface', turn: t.index, status: 'skip', detail: 'not a click turn or a targeted say turn' })
    else if (t.clickMissing !== undefined) out.push({ check: 'action-updates-surface', turn: t.index, status: 'skip', detail: 'nothing was clicked (see click-target)' })
    else if (clicked === undefined) out.push({ check: 'action-updates-surface', turn: t.index, status: 'skip', detail: 'the clicked surface id was not observed' })
    else if (halted !== undefined) out.push({ check: 'action-updates-surface', turn: t.index, status: 'skip', detail: 'the turn halted (see no-halt)' })
    else {
      const touched = touchedSurfaces(t.lines)
      const created = shippedSurfaces(t.lines).filter((s) => s !== clicked)
      out.push(
        touched.includes(clicked)
          ? { check: 'action-updates-surface', turn: t.index, status: 'pass', detail: `${clicked} updated` }
          : created.length > 0
            ? { check: 'action-updates-surface', turn: t.index, status: 'pass', detail: `${clicked} left as history; the flow moved to ${created.join(', ')}` }
            : 'click' in t.step && meta.target !== undefined && touched.includes(meta.target)
              ? { check: 'action-updates-surface', turn: t.index, status: 'pass', detail: `${clicked} left as history; the turn settled its target ${meta.target}` }
              : { check: 'action-updates-surface', turn: t.index, status: 'fail', detail: `the ${sayTarget !== undefined ? 'say turn targeting' : 'click on'} ${clicked} was answered with no update to it and no new surface` },
      )
    }
    // expect-component, per turn (T-0222): a step that names its component (`--expect-turn`) updates a surface
    // holding it. Hold'em Haiku dealt its opening hand in prose and passed the run-level row on a later turn.
    // A step without one is not judged: a refused illegal move is answered in prose on purpose.
    holdTypes(held, t.lines)
    const want = t.step.expect ?? []
    const holding = touchedSurfaces(t.lines).filter((s) => want.some((c) => held.get(s)?.has(c)))
    if (want.length === 0) out.push({ check: 'expect-component', turn: t.index, status: 'skip', detail: 'no --expect-turn on this step' })
    else if (t.clickMissing !== undefined) out.push({ check: 'expect-component', turn: t.index, status: 'skip', detail: 'nothing was clicked (see click-target)' })
    else if (halted !== undefined) out.push({ check: 'expect-component', turn: t.index, status: 'skip', detail: 'the turn halted (see no-halt)' })
    else
      out.push(
        holding.length > 0
          ? { check: 'expect-component', turn: t.index, status: 'pass', detail: `${holding.join(', ')} holds ${want.join(' or ')}` }
          : { check: 'expect-component', turn: t.index, status: 'fail', detail: `no surface this turn updated holds ${want.join(' or ')} (touched ${touchedSurfaces(t.lines).join(', ') || 'none'})` },
      )
    // routing-expect (T-0260): a step that declares its routing (`--expect-routing`) got it, read from the turn's
    // trace line. Judged on a halted turn too: the routing is fixed before the model answers.
    const routing = t.step.expectRouting
    if (routing === undefined) out.push({ check: 'routing-expect', turn: t.index, status: 'skip', detail: 'no --expect-routing on this step' })
    else if (t.routing === undefined && opts.runId !== undefined)
      out.push({ check: 'routing-expect', turn: t.index, status: 'fail', detail: t.trace === undefined ? `no trace line for runId ${opts.runId}` : `trace line ${t.trace.id} has no routing block` })
    else if (t.routing === undefined) out.push({ check: 'routing-expect', turn: t.index, status: 'skip', detail: 'no routing recorded for this replayed turn (the fixture turn has no routing)' })
    else {
      const misses = routingMisses(routing, t.routing)
      out.push({ check: 'routing-expect', turn: t.index, status: misses.length ? 'fail' : 'pass', detail: misses.length ? misses.join('; ') : 'routing as expected' })
    }
    // render-lint: the dogfood render rules over the turn's surfaces.
    if (t.lint === undefined) out.push({ check: 'render-lint', turn: t.index, status: 'skip', detail: 'page' in t.step ? 'a page-fired row (the step row lints the page)' : 'no DOM (offline replay)' })
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
    const step = 'say' in t.step ? `say "${t.step.say.slice(0, 30)}"` : 'click' in t.step ? `click "${t.step.click}"` : `page ${t.step.page}`
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
