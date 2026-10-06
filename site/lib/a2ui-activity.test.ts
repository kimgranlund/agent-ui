import { describe, it, expect } from 'vitest'
import { createA2uiActivity } from './a2ui-activity.ts'
import type { ActivityStep } from '@agent-ui/app/conversation'
import type { TurnTrace } from '../../packages/agent-ui/a2ui/src/agent/meta-line.ts'

// T-0016 (ADR-0159 amendment, proposed): the A2UI adapter for ui-conversation's step mode. Producer stages
// + the TurnTrace + the shipped lines in, neutral ActivityStep rows out. Summaries are counts and verbs from
// message KIND only; component types, catalog ids and surface ids never reach a label or summary.

const CREATE = JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: 'quokka-board', catalogId: 'zebra-catalog' } })
const COMPONENTS = JSON.stringify({
  version: 'v1.0',
  updateComponents: {
    surfaceId: 'quokka-board',
    components: [
      { id: 'root', component: 'PangolinColumn', children: ['a', 'b'] },
      { id: 'a', component: 'NarwhalText', text: 'hi' },
      { id: 'b', component: 'AxolotlButton', label: 'go' },
    ],
  },
})
const DATA = JSON.stringify({ version: 'v1.0', updateDataModel: { surfaceId: 'quokka-board', value: { one: 1, two: 2, three: 3 } } })
const DATA_PATH = JSON.stringify({ version: 'v1.0', updateDataModel: { surfaceId: 'quokka-board', path: '/score', value: 7 } })
const TYPE_WORDS = /quokka|zebra|pangolin|narwhal|axolotl|catalog|createSurface|updateComponents|updateDataModel/i

const trace = (over: Partial<TurnTrace> = {}): TurnTrace => ({
  turnIndex: 0,
  query: { intent: 'x', k: 0 },
  exemplarIds: [],
  rounds: 1,
  healed: 0,
  failureCodes: [],
  model: 'model-x',
  ...over,
})

/** A controllable clock: `at(ms)` sets "now" for the next adapter call. */
function clock(): { now: () => number; at: (ms: number) => void } {
  let t = 1_000_000
  return { now: () => t, at: (ms) => void (t = 1_000_000 + ms) }
}

/** Last view of every step, by id, folded from everything the adapter returned (what the strip shows). */
function fold(into: Map<string, ActivityStep>, steps: readonly ActivityStep[]): Map<string, ActivityStep> {
  for (const s of steps) into.set(s.id, s)
  return into
}

describe('createA2uiActivity: a clean A2UI turn', () => {
  it('maps each stage to a timed step, the shipped lines to counted output steps, the raw once, and the trace to a footer', () => {
    const c = clock()
    const a = createA2uiActivity(c.now)
    const seen = new Map<string, ActivityStep>()
    c.at(0)
    fold(seen, a.progress({ stage: 'sent' }))
    c.at(400)
    fold(seen, a.progress({ stage: 'started' }))
    c.at(1000)
    fold(seen, a.progress({ stage: 'content' }))
    c.at(3000)
    fold(seen, a.progress({ stage: 'validating', source: `${CREATE}\n${COMPONENTS}` }))
    c.at(3100)
    fold(seen, a.progress({ stage: 'done' }))
    fold(seen, a.trace(trace({ usage: { inputTokens: 3210, outputTokens: 845 } })))
    for (const l of [CREATE, COMPONENTS, DATA, DATA_PATH]) a.line(l)
    c.at(3200)
    const end = a.end()
    fold(seen, end.steps)

    const rows = [...seen.values()]
    expect(rows.map((s) => [s.id, s.label, s.status, s.durationMs, s.summary])).toEqual([
      ['request', 'Request sent', 'ok', 400, undefined],
      ['generate', 'Generated', 'ok', 600, undefined],
      ['response', 'Wrote the response', 'ok', 2000, undefined],
      ['validate', 'Validated', 'ok', 100, undefined],
      ['open', 'Opened a new surface', 'ok', undefined, undefined],
      ['components', 'Updated the surface', 'ok', undefined, '3 components'],
      ['data', 'Updated data', 'ok', undefined, '4 keys'],
    ])
    expect(seen.get('validate')!.raw, 'the shipped lines, once, on the validate step').toBe([CREATE, COMPONENTS, DATA, DATA_PATH].join('\n'))
    expect(rows.filter((s) => s.raw !== undefined).length, 'no other step carries raw').toBe(1)
    expect(end.footer).toEqual({ rounds: 1, inputTokens: 3210, outputTokens: 845, model: 'model-x' })
  })

  it('NO TYPE NAMES: no label or summary names a component type, catalog, surface id or message key', () => {
    const a = createA2uiActivity(clock().now)
    const out: ActivityStep[] = [...a.progress({ stage: 'sent' }), ...a.progress({ stage: 'validating' }), ...a.progress({ stage: 'done' })]
    for (const l of [CREATE, COMPONENTS, DATA, JSON.stringify({ version: 'v1.0', deleteSurface: { surfaceId: 'quokka-board' } })]) a.line(l)
    out.push(...a.end().steps)
    const visible = out.map((s) => `${s.label} ${s.summary ?? ''}`).join(' | ')
    expect(visible).toContain('Closed the surface') // the delete really produced a row (anti-vacuous)
    expect(visible).not.toMatch(TYPE_WORDS)
  })

  it('a running step carries startedAt (live elapsed) and is returned only when it changes', () => {
    const c = clock()
    const a = createA2uiActivity(c.now)
    c.at(50)
    const first = a.progress({ stage: 'sent' })
    expect(first).toEqual([{ id: 'request', kind: 'request', label: 'Request sent', status: 'running', startedAt: c.now() }])
    c.at(60)
    expect(a.progress({ stage: 'sent' }), 'the same running stage again changes nothing').toEqual([])
    c.at(90)
    const next = a.progress({ stage: 'started' })
    expect(next.map((s) => [s.id, s.status])).toEqual([
      ['request', 'ok'],
      ['generate', 'running'],
    ])
  })

  it('a tool call is its own timed step, named from the closed registry detail: "Called tool search" (1.2s)', () => {
    const c = clock()
    const a = createA2uiActivity(c.now)
    c.at(0)
    a.progress({ stage: 'started' })
    c.at(100)
    const running = a.progress({ stage: 'tool', detail: 'search' })
    expect(running.at(-1)).toMatchObject({ id: 'tool-1', kind: 'tool', label: 'Calling tool search…', status: 'running' })
    c.at(1300)
    const settled = a.progress({ stage: 'content' })
    expect(settled[0]).toMatchObject({ id: 'tool-1', label: 'Called tool search', status: 'ok', durationMs: 1200 })
    c.at(1400)
    a.progress({ stage: 'tool' }) // no detail: never invents a name
    c.at(1500)
    expect(a.progress({ stage: 'validating' })[0]).toMatchObject({ id: 'tool-2', label: 'Called a tool' })
  })

  it('a note-only turn ships no lines: no output steps, no raw, and no trace means no footer', () => {
    const a = createA2uiActivity(clock().now)
    a.progress({ stage: 'sent' })
    a.progress({ stage: 'validating' })
    a.progress({ stage: 'done' })
    const end = a.end()
    expect(end.steps.map((s) => s.id)).toEqual([])
    expect(end.footer).toBeUndefined()
  })
})

describe('createA2uiActivity: a repaired turn ("Round 1 failed (code), repaired in round 2")', () => {
  function runRepair(withTrace: boolean): { live: ActivityStep[]; seen: Map<string, ActivityStep>; footer: unknown } {
    const c = clock()
    const a = createA2uiActivity(c.now)
    const seen = new Map<string, ActivityStep>()
    c.at(0)
    fold(seen, a.progress({ stage: 'sent' }))
    c.at(100)
    fold(seen, a.progress({ stage: 'content' }))
    c.at(200)
    fold(seen, a.progress({ stage: 'validating', source: 'bad candidate' }))
    c.at(250)
    const live = a.progress({ stage: 'retry', round: 2, source: 'bad candidate' })
    fold(seen, live)
    c.at(300)
    fold(seen, a.progress({ stage: 'sent' }))
    c.at(450)
    fold(seen, a.progress({ stage: 'content' }))
    c.at(600)
    fold(seen, a.progress({ stage: 'validating', source: CREATE }))
    c.at(650)
    fold(seen, a.progress({ stage: 'done' }))
    if (withTrace) fold(seen, a.trace(trace({ rounds: 2, failureCodes: ['SCHEMA'] })))
    a.line(CREATE)
    c.at(700)
    const end = a.end()
    fold(seen, end.steps)
    return { live, seen, footer: end.footer }
  }

  it('the retry flips the validate step to failed LIVE, then done settles it repaired, and the trace adds the code', () => {
    const { live, seen, footer } = runRepair(true)
    expect(live.find((s) => s.id === 'validate')).toMatchObject({
      status: 'failed',
      label: 'Validation failed',
      summary: 'Round 1 failed, retrying in round 2',
    })
    expect(seen.get('validate')).toMatchObject({
      status: 'repaired',
      label: 'Validated',
      summary: 'Round 1 failed (SCHEMA), repaired in round 2',
      durationMs: 100, // 50ms in round 1 + 50ms in round 2
    })
    expect(seen.get('request')!.durationMs, 'a stage re-entered in round 2 accumulates its time').toBe(250)
    expect(seen.get('validate')!.raw, 'raw is the shipped output, never the failed candidate too').toBe(CREATE)
    expect(footer).toEqual({ rounds: 2, model: 'model-x' })
  })

  it('trace absent: the repair is still visible from the live retry ordinal, with no code and no footer', () => {
    const { seen, footer } = runRepair(false)
    expect(seen.get('validate')).toMatchObject({ status: 'repaired', summary: 'Round 1 failed, repaired in round 2' })
    expect(footer).toBeUndefined()
  })

  it('three rounds read as a range; a clean round with tally codes notes them without claiming a repair', () => {
    const a = createA2uiActivity(clock().now)
    a.progress({ stage: 'validating' })
    a.progress({ stage: 'done' })
    expect(a.trace(trace({ rounds: 3, failureCodes: ['SCHEMA', 'REF'] }))[0]).toMatchObject({
      status: 'repaired',
      summary: 'Rounds 1 to 2 failed (SCHEMA, REF), repaired in round 3',
    })
    const b = createA2uiActivity(clock().now)
    b.progress({ stage: 'validating' })
    b.progress({ stage: 'done' })
    expect(b.trace(trace({ rounds: 1, failureCodes: ['NET_NOOP_STRIPPED'] }))[0]).toMatchObject({
      status: 'ok',
      summary: 'Noted: NET_NOOP_STRIPPED',
    })
  })
})

describe('createA2uiActivity: a malformed trace degrades to nothing', () => {
  it('a trace with wrong-typed fields never throws and never prints garbage: no repair, no footer', () => {
    const a = createA2uiActivity(clock().now)
    a.progress({ stage: 'validating' })
    a.progress({ stage: 'done' })
    const bad = { rounds: 'two', failureCodes: 'SCHEMA', usage: { inputTokens: -5, outputTokens: 'x' }, model: 7 } as unknown as TurnTrace
    expect(a.trace(bad)).toEqual([])
    expect(a.end().footer).toBeUndefined()
  })
})

describe('createA2uiActivity: a failed turn', () => {
  it('fail() settles the running step failed and keeps the last candidate as the one raw block', () => {
    const c = clock()
    const a = createA2uiActivity(c.now)
    c.at(0)
    a.progress({ stage: 'validating', source: 'bad candidate' })
    c.at(80)
    const out = a.fail()
    expect(out).toEqual([
      { id: 'validate', kind: 'validate', label: 'Validation failed', status: 'failed', durationMs: 80, raw: 'bad candidate' },
    ])
  })

  it('a step interrupted mid-stage keeps its live label (the done form is never claimed for work not completed)', () => {
    const a = createA2uiActivity(clock().now)
    a.progress({ stage: 'content' })
    expect(a.fail()[0]).toMatchObject({ id: 'response', label: 'Writing the response…', status: 'failed' })
  })
})
