// a2ui-activity.ts: the A2UI adapter for ui-conversation's step mode (T-0016, ADR-0159 amendment,
// proposed). It turns one A2UI turn's producer signals into the neutral `ActivityStep` rows the control
// renders: the live progress stages (ADR-0146's closed vocabulary), the runtime `TurnTrace` (rounds,
// failure codes, token usage, model; ADR-0088 §2 + ADR-0234), and the shipped wire lines.
//
// It lives at the SITE layer on purpose: it is the one layer that may read both the a2ui producer's types
// and the app control's model, and the control itself stays A2UI-free (a non-A2UI host writes its own
// adapter against the same model). It changes nothing on the wire: it only reads what the stream already
// carries (T-0019 added one additive field to that stream, the failure `codes` on the `retry` progress
// event, so a failed round says why while it is live).
//
// Honesty rules, carried over from the narration it replaces for opted-in hosts:
// - Labels come from the closed stage table below (ADR-0146 F2, ADR-0159 §1's live/done pairs), never
//   from model text. A step that never finished keeps its live label.
// - Summaries are counts and verbs from message KIND only ("3 components", "4 keys"); a component type,
//   catalog id or surface id never reaches a label or summary. They reach a step's `details` (T-0022), the
//   expand a reader opens on purpose, and only as the names the wire itself carried.
// - Times are what this client observed between stage signals. Missing data renders nothing.
// - Raw output is attached ONCE: the shipped lines (or, for a failed turn, the last candidate).
// - Reasoning text (T-0021, ADR-0240) is the one place model text enters a step, and only as the
//   step's `reasoning` field, never a label or summary: the bounded excerpts the producer puts on `reasoning`
//   progress events under its raw-reasoning opt-in (ADR-0146 F3), concatenated and capped. A stream without
//   the opt-in carries no excerpt, and the step has no `reasoning` key at all.

import type { TurnProgress, TurnProgressStage, TurnTrace } from '../../packages/agent-ui/a2ui/src/agent/meta-line.ts'
import type { ActivityStep, ActivityStatus, ActivityFooter } from '@agent-ui/app/conversation'
import { ACTIVITY_REASONING_CAP } from '../../packages/agent-ui/app/src/controls/conversation/activity-step.ts'

/** The closed stage → step table. `retry` and `done` are transitions, not rows; `tool` rows are numbered. */
const STAGE_STEP: Partial<Record<TurnProgressStage, { id: string; live: string; done: string; failed?: string }>> = {
  sent: { id: 'request', live: 'Request sent', done: 'Request sent' },
  // `started` (the model began) and `content` (the answer text arrived) are one stretch of model time to a
  // reader: two rows, "Generated" then "Wrote the response", said the same thing twice (T-0022). Both stages
  // now fold into the ONE `generate` row; a `content` that follows a `reasoning` pass re-enters it and its time
  // accumulates (the same re-entry a retry round already uses).
  started: { id: 'generate', live: 'Generating…', done: 'Generated' },
  reasoning: { id: 'reasoning', live: 'Reasoning…', done: 'Reasoned' },
  content: { id: 'generate', live: 'Generating…', done: 'Generated' },
  validating: { id: 'validate', live: 'Validating…', done: 'Validated', failed: 'Validation failed' },
}

/** One step's mutable state while the turn runs. `kind` is the step id's family (`tool-2` is a `tool`). */
interface StepState {
  id: string
  kind: string
  live: string
  done: string
  failed?: string
  status: ActivityStatus
  /** Whether the step is timed (a stage step) or not (an output step, whose lines land in one burst). */
  timed: boolean
  /** Total time spent running so far, over every round that re-entered the step. */
  spentMs: number
  /** When the current running span began. */
  spanStart: number
  summary?: string
  raw?: string
  /** Failed rounds this step went through (the neutral `ActivityStep.retries`). */
  retries?: number
  /** The reasoning step's accumulated excerpt text (the neutral `ActivityStep.reasoning`). */
  reasoning?: string
  /** Plain-words lines for the row's expand (the neutral `ActivityStep.details`). */
  details?: string[]
  /** Set when the step is re-entered in a later round: the next excerpt starts a new paragraph. */
  reasoningBreak?: boolean
}

export interface A2uiActivity {
  /** Fold one progress event; returns the steps it changed (closed and/or opened), in that order. */
  progress(ev: TurnProgress): ActivityStep[]
  /** Fold the runtime trace (it rides the meta-line after `done`); returns the steps it changed. */
  trace(trace: TurnTrace): ActivityStep[]
  /** Record one shipped A2UI wire line (counted and kept as raw output at `end()`). */
  line(line: string): void
  /** The turn finished: closes any running step, adds the counted output steps and the raw output, and
   *  returns every changed step plus the footer (present only when a trace arrived). */
  end(): { steps: ActivityStep[]; footer?: ActivityFooter }
  /** The turn failed: the running step settles `failed`; returns the changed steps. */
  fail(): ActivityStep[]
}

/** Message-kind tallies over the shipped lines. Only counts: never a type, catalog or surface name. */
interface Tally {
  opened: number
  components: number
  dataKeys: number
  dataWrites: number
  closed: number
  other: number
  /** Names the wire carried, for the rows' `details` only (T-0022): surface ids per message kind, the
   *  component types in first-seen order with their counts, and the data keys written. */
  surfaces: { opened: Set<string>; components: Set<string>; data: Set<string>; closed: Set<string> }
  types: Map<string, number>
  keys: Set<string>
}

function tally(lines: readonly string[]): Tally {
  const t: Tally = {
    opened: 0,
    components: 0,
    dataKeys: 0,
    dataWrites: 0,
    closed: 0,
    other: 0,
    surfaces: { opened: new Set(), components: new Set(), data: new Set(), closed: new Set() },
    types: new Map(),
    keys: new Set(),
  }
  const surface = (into: Set<string>, body: unknown): void => {
    const id = (body as { surfaceId?: unknown } | null)?.surfaceId
    if (typeof id === 'string' && id !== '') into.add(id)
  }
  for (const line of lines) {
    let msg: unknown
    try {
      msg = JSON.parse(line)
    } catch {
      continue // the runner only forwards validated lines; a non-JSON line is simply not counted
    }
    if (typeof msg !== 'object' || msg === null) continue
    const m = msg as Record<string, unknown>
    if ('createSurface' in m) {
      t.opened += 1
      surface(t.surfaces.opened, m.createSurface)
    } else if ('updateComponents' in m) {
      const body = m.updateComponents as { components?: unknown } | null
      const list = body?.components
      t.components += Array.isArray(list) ? list.length : 0
      surface(t.surfaces.components, body)
      if (Array.isArray(list)) {
        for (const c of list) {
          const type = (c as { component?: unknown } | null)?.component
          if (typeof type === 'string' && type !== '') t.types.set(type, (t.types.get(type) ?? 0) + 1)
        }
      }
    } else if ('updateDataModel' in m) {
      // A whole-object write counts its top-level keys; a path write (or a scalar) is one key.
      const body = m.updateDataModel as { value?: unknown; path?: unknown } | null
      const value = body?.value
      const whole = typeof value === 'object' && value !== null && !Array.isArray(value)
      t.dataKeys += whole ? Object.keys(value).length : 1
      t.dataWrites += 1
      surface(t.surfaces.data, body)
      if (whole) for (const k of Object.keys(value)) t.keys.add(k)
      else t.keys.add(typeof body?.path === 'string' && body.path !== '' ? body.path : '(value)')
    } else if ('deleteSurface' in m) {
      t.closed += 1
      surface(t.surfaces.closed, m.deleteSurface)
    } else t.other += 1
  }
  return t
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** The trace facts this adapter reads, sanitized: `readMetaLine` checks only that `trace` is an object
 *  (its inner shape is runtime-assembled, never wire-validated), so every field is checked here and a
 *  malformed one is simply absent. */
interface TraceFacts {
  rounds?: number
  codes: string[]
  inputTokens?: number
  outputTokens?: number
  model?: string
}

const count = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined)

function traceFacts(trace: TurnTrace): TraceFacts {
  const t = trace as Partial<Record<keyof TurnTrace, unknown>>
  const rounds = count(t.rounds)
  const usage = typeof t.usage === 'object' && t.usage !== null ? (t.usage as Record<string, unknown>) : undefined
  const inputTokens = count(usage?.inputTokens)
  const outputTokens = count(usage?.outputTokens)
  return {
    ...(rounds !== undefined && Number.isInteger(rounds) && rounds >= 1 ? { rounds } : {}),
    codes: Array.isArray(t.failureCodes) ? t.failureCodes.filter((c): c is string => typeof c === 'string' && c !== '') : [],
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(typeof t.model === 'string' && t.model !== '' ? { model: t.model } : {}),
  }
}

/** The closed validator codes (protocol.ts `ErrorCode`) in plain words, completing "Model output ...". A code
 *  outside this table is shown by name (never invented a meaning for): the failure codes are validator names,
 *  never model text, so a closed table keeps the honesty rule. */
const CODE_WORDS: Readonly<Record<string, string>> = {
  PARSE: 'did not parse',
  SCHEMA: 'broke the message schema',
  CATALOG: 'used a component the catalog does not have',
  CATALOG_UNKNOWN: 'named an unknown catalog',
  IDGRAPH: 'had a broken component tree',
  POINTER: 'pointed at data that does not exist',
  FUNCTION: 'called an unknown function',
  DEPTH_EXCEEDED: 'nested components too deeply',
  CONTAINMENT: 'put a component in the wrong parent',
}

/** "Model output did not parse": what failed, in one clause. One known code names itself; several say how
 *  many checks failed (the row's expand lists each); an unknown code is named, never explained. */
function failureWords(codes: readonly string[]): string {
  if (codes.length === 0) return 'Model output failed validation'
  if (codes.length === 1) {
    const words = CODE_WORDS[codes[0]!]
    return words !== undefined ? `Model output ${words}` : `Model output failed a check (${codes[0]})`
  }
  return `Model output failed ${codes.length} checks`
}

/** The one-line summary of a validate step that failed a round: "Model output did not parse, retrying" while
 *  the next round runs, "..., retried" once it passed. */
function retrySummary(codes: readonly string[], settled: boolean): string {
  return `${failureWords(codes)}, ${settled ? 'retried' : 'retrying'}`
}

/** The validate row's expand: the failed checks by code with their plain words, then one repair line. */
function validateDetails(codes: readonly string[], rounds: number, settled: boolean): string[] {
  const checks = codes.map((c) => (CODE_WORDS[c] !== undefined ? `${c} (model output ${CODE_WORDS[c]})` : c))
  const failed = rounds === 2 ? 'Round 1 failed' : `Rounds 1 to ${rounds - 1} failed`
  return [
    checks.length > 0 ? `Failed checks: ${checks.join('; ')}` : 'No failure codes were reported.',
    settled
      ? `${failed}. The model was sent the failures and its rewrite passed in round ${rounds}.`
      : `${failed}. The model was sent the failures and is trying again in round ${rounds}.`,
  ]
}

const CHECKING = ['Checking the response against the component catalog.']
const NO_REASONING = ['No reasoning captured']

export function createA2uiActivity(now: () => number = () => Date.now()): A2uiActivity {
  const steps = new Map<string, StepState>()
  const lines: string[] = []
  let current: StepState | undefined
  let round = 1
  let tools = 0
  let lastCandidate: string | undefined
  let traced: TraceFacts | undefined
  /** The failure codes the live `retry` events carried, in first-seen order: why each failed round failed,
   *  known the moment it fails (before any trace). The trace's own codes win once it arrives. */
  const liveCodes: string[] = []

  const view = (s: StepState): ActivityStep => {
    const running = s.status === 'running'
    const label = running ? s.live : s.status === 'failed' ? (s.failed ?? s.live) : s.done
    return {
      id: s.id,
      kind: s.kind,
      label,
      status: s.status,
      ...(running ? { startedAt: s.spanStart - s.spentMs } : s.timed ? { durationMs: s.spentMs } : {}),
      ...(s.summary !== undefined ? { summary: s.summary } : {}),
      ...(s.retries !== undefined && s.retries > 0 ? { retries: s.retries } : {}),
      ...(s.raw !== undefined ? { raw: s.raw } : {}),
      ...(s.reasoning !== undefined ? { reasoning: s.reasoning } : {}),
      ...(s.details !== undefined ? { details: s.details } : {}),
    }
  }

  /** Fold one `reasoning` excerpt onto its step. Returns whether the text changed. Empty and non-string
   *  excerpts add nothing, whitespace before any text is dropped, a delta that is only whitespace between
   *  words is kept, and growth stops once the text passes the cap (a later excerpt then changes nothing). */
  const addReasoning = (s: StepState, excerpt: unknown): boolean => {
    if (typeof excerpt !== 'string' || excerpt === '') return false
    const have = s.reasoning ?? ''
    if (have === '' && excerpt.trim() === '') return false
    if (have.length > ACTIVITY_REASONING_CAP) return false
    s.reasoning = have === '' ? excerpt : s.reasoningBreak === true ? `${have}\n\n${excerpt}` : have + excerpt
    s.reasoningBreak = false
    delete s.details // the text is the expand now; the "no reasoning" placeholder is out of date
    return true
  }

  /** Stop the running step's clock and settle it to `status`. */
  const close = (status: ActivityStatus, t: number): StepState | undefined => {
    const s = current
    if (s === undefined) return undefined
    s.spentMs += Math.max(0, t - s.spanStart)
    s.status = status
    current = undefined
    return s
  }

  /** (Re)open a stage step as the running one. A step re-entered in a later round keeps its spent time. */
  const open = (id: string, kind: string, labels: { live: string; done: string; failed?: string }, t: number): StepState => {
    const known = steps.get(id)
    const s = known ?? { id, kind, ...labels, status: 'running' as ActivityStatus, timed: true, spentMs: 0, spanStart: t }
    if (known !== undefined && s.reasoning !== undefined) s.reasoningBreak = true // a later round's thoughts are a new paragraph
    s.status = 'running'
    s.spanStart = t
    steps.set(id, s)
    current = s
    return s
  }

  /** The validate step's settled face from what is known: the live round count, refined by the trace.
   *  Returns the step only when that face actually changed. */
  const settleValidate = (): StepState | undefined => {
    const v = steps.get('validate')
    if (v === undefined || v.status === 'running') return undefined
    const face = (): string => `${v.status}|${v.summary ?? ''}|${v.retries ?? 0}|${v.details?.join('\n') ?? ''}`
    const before = face()
    const rounds = traced?.rounds ?? round
    const codes = traced !== undefined && traced.codes.length > 0 ? traced.codes : liveCodes
    if (rounds > 1) {
      v.status = 'repaired'
      v.summary = retrySummary(codes, true)
      v.details = validateDetails(codes, rounds, true)
      v.retries = rounds - 1
    } else if (v.status !== 'failed') {
      v.status = 'ok'
      if (codes.length > 0) v.summary = `Noted: ${codes.join(', ')}`
      v.details = ['Passed on the first attempt.', ...(codes.length > 0 ? [`Noted: ${codes.join(', ')}`] : [])]
    }
    return face() === before ? undefined : v
  }

  const outputStep = (id: string, label: string, summary?: string, details?: string[]): StepState => {
    const s: StepState = { id, kind: 'output', live: label, done: label, status: 'ok', timed: false, spentMs: 0, spanStart: 0 }
    if (summary !== undefined) s.summary = summary
    if (details !== undefined && details.length > 0) s.details = details
    steps.set(id, s)
    return s
  }

  return {
    progress(ev) {
      const t = now()
      if (ev.source !== undefined && ev.source !== '' && (ev.stage === 'validating' || ev.stage === 'retry')) lastCandidate = ev.source
      if (ev.stage === 'retry') {
        // The previous round failed validation: settle it failed now, visibly, before the next round starts.
        const changed = new Set<StepState>()
        const closed = close('ok', t)
        if (closed !== undefined) changed.add(closed)
        round = ev.round ?? round + 1
        for (const c of ev.codes ?? []) if (c !== '' && !liveCodes.includes(c)) liveCodes.push(c)
        const v = steps.get('validate')
        if (v !== undefined) {
          v.status = 'failed'
          v.summary = retrySummary(liveCodes, false)
          v.details = validateDetails(liveCodes, round, false)
          v.retries = round - 1
          changed.add(v)
        }
        return [...changed].map(view)
      }
      if (ev.stage === 'done') {
        const closed = close('ok', t)
        const v = settleValidate()
        return [...new Set([closed, v].filter((s): s is StepState => s !== undefined))].map(view)
      }
      let target: { id: string; kind: string; live: string; done: string; failed?: string }
      if (ev.stage === 'tool') {
        tools += 1
        const name = ev.detail !== undefined && ev.detail !== '' ? ev.detail : undefined
        target = {
          id: `tool-${tools}`,
          kind: 'tool',
          live: name === undefined ? 'Calling a tool…' : `Calling tool ${name}…`,
          done: name === undefined ? 'Called a tool' : `Called tool ${name}`,
        }
      } else {
        const row = STAGE_STEP[ev.stage]
        if (row === undefined) return [] // an unknown stage renders nothing (the F2 honesty guard)
        target = { ...row, kind: row.id }
      }
      if (current?.id === target.id) {
        // The same stage again (repeated reasoning): a change only when it brought new excerpt text.
        return ev.stage === 'reasoning' && addReasoning(current, ev.detail) ? [view(current)] : []
      }
      const closed = close('ok', t)
      const opened = open(target.id, target.kind, target, t)
      if (ev.stage === 'reasoning') {
        addReasoning(opened, ev.detail) // the row is born carrying its first excerpt
        if (opened.reasoning === undefined) opened.details = NO_REASONING // an expand needs a row born with one
      } else if (ev.stage === 'validating' && opened.details === undefined) opened.details = CHECKING
      return (closed === undefined ? [opened] : [closed, opened]).map(view)
    },

    trace(trace) {
      traced = traceFacts(trace)
      const v = settleValidate()
      return v === undefined ? [] : [view(v)]
    },

    line(line) {
      lines.push(line)
    },

    end() {
      const changed = new Set<StepState>()
      const closed = close('ok', now())
      if (closed !== undefined) changed.add(closed)
      const v = settleValidate()
      if (v !== undefined) changed.add(v)
      const t = tally(lines)
      const outputs: StepState[] = []
      const ids = (set: ReadonlySet<string>): string[] => (set.size === 0 ? [] : [`${set.size === 1 ? 'Surface' : 'Surfaces'}: ${[...set].join(', ')}`])
      const types = [...t.types].map(([type, n]) => (n === 1 ? type : `${type} (${n})`))
      if (t.opened > 0) outputs.push(outputStep('open', t.opened === 1 ? 'Opened a new surface' : 'Opened new surfaces', t.opened === 1 ? undefined : plural(t.opened, 'surface', 'surfaces'), ids(t.surfaces.opened)))
      if (t.components > 0) outputs.push(outputStep('components', 'Updated the surface', plural(t.components, 'component', 'components'), [...ids(t.surfaces.components), ...(types.length > 0 ? [`Components: ${types.join(', ')}`] : [])]))
      if (t.dataWrites > 0) outputs.push(outputStep('data', 'Updated data', plural(t.dataKeys, 'key', 'keys'), [...ids(t.surfaces.data), `Keys: ${[...t.keys].join(', ')}`]))
      if (t.closed > 0) outputs.push(outputStep('close', t.closed === 1 ? 'Closed the surface' : 'Closed surfaces', t.closed === 1 ? undefined : plural(t.closed, 'surface', 'surfaces'), ids(t.surfaces.closed)))
      if (t.other > 0) outputs.push(outputStep('other', 'Sent other messages', plural(t.other, 'message', 'messages')))
      for (const o of outputs) changed.add(o)
      // The raw output, once: the shipped lines, on the validate step (or the first output step without one).
      const holder = steps.get('validate') ?? outputs[0]
      if (holder !== undefined && lines.length > 0) {
        holder.raw = lines.join('\n')
        changed.add(holder)
      }
      // The footer exists only when a trace arrived (a meta-line ships only with a note or an ask).
      let footer: ActivityFooter | undefined
      if (traced !== undefined) {
        const { codes: _codes, ...facts } = traced
        if (Object.keys(facts).length > 0) footer = facts
      }
      return { steps: [...changed].map(view), ...(footer === undefined ? {} : { footer }) }
    },

    fail() {
      const changed = new Set<StepState>()
      const failed = close('failed', now())
      if (failed !== undefined) changed.add(failed)
      if (failed?.id === 'validate') {
        failed.details = ['The turn ended before validation passed.', ...(liveCodes.length > 0 ? [`Earlier failed checks: ${liveCodes.join(', ')}`] : [])]
      }
      // A failed turn shipped nothing valid: its one raw block is the last candidate the producer attached.
      const v = steps.get('validate')
      const raw = lines.length > 0 ? lines.join('\n') : lastCandidate
      if (v !== undefined && raw !== undefined) {
        v.raw = raw
        changed.add(v)
      }
      return [...changed].map(view)
    },
  }
}
