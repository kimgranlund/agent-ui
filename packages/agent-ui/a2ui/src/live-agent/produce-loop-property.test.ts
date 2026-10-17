// produce-loop-property.test.ts: T-0314 (P2 as revised, Kim 2026-10-16). The repair loop's turn invariant, tested as a
// property over every round sequence a small menu of round shapes can make, against the real `produce()` with a scripted
// provider. Test only: the loop is not refactored unless a property reds.
// - I1, scoped to the turn: every surface an earlier round of this turn created is kept, updated or explicitly deleted
//   in the round that ships. A turn that halts or degrades to text ships no round, so I1 holds there trivially.
//   T-0328 (Kim 2026-10-17, amends T-0317): a surface rebuilt under a new id is not a drop. One that a failure naming
//   it alone flagged in every round that created it is retired by a later round that creates an id no earlier round
//   created, one per new id, earliest created first; narration and a genui failure flag nothing.
// - I2: the shipped lines never update a surface that neither the session nor the shipped lines created (T-0305).
// - The T-0302 pin: when the last round fails and an earlier round of the turn validated with nothing dropped, that
//   round's lines ship and the trace ends with EARLIER_ROUND_SHIPPED. T-0321 (Kim 2026-10-16): never a round a semantic
//   check failed, so in the single-surface family below (where every valid round is flagged) the turn ships no payload.
// Each round reaches the loop as legacy text, as a `render_surface` call, or as the live shapes of round 7 (:16, :69):
// `messages` as one JSON string and `target` as a string holding JSON. Every round's texts carry its index, so the
// round that shipped is read off the lines, never assumed.
// T-0317 (Kim's L1 ruling, 2026-10-16): the three I1 classes this enumeration found (a failure-named surface dropped,
// an id-graph fault blamed on the wrong surface, a round sent back for SURFACE_DROPPED keeping none of its own) are
// fixed, so no counterexample is allowed. T-0328 narrows the first class to a surface no new id retired; the flag table
// below is written from the shapes, not from produce(). The T-0328 shapes run in 2-round sequences only.

import { describe, expect, it } from 'vitest'
import { produce, ProduceHalt } from '../agent/produce.ts'
import type { AgentProvider, Session, TurnInput } from '../agent/agent-transport.ts'
import { readMetaLine } from '../agent/meta-line.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import type { SemanticCheck } from '../catalog/semantic-check.ts'
import type { A2uiServerMessage } from '../protocol.ts'

const V = 'v1.0'
const OPEN = 'open-1'
const A = 'ask-1'
const B = 'ask-2'
const C = 'ask-3'

const create = (sid: string): A2uiServerMessage => ({ version: V, createSurface: { surfaceId: sid, catalogId: 'agent-ui' } })
const root = (sid: string, text: string): A2uiServerMessage =>
  ({ version: V, updateComponents: { surfaceId: sid, components: [{ id: 'root', component: 'Text', text }] } }) as A2uiServerMessage
/** A root that lists a child no component defines: IDGRAPH `root->gone`, a path naming no surface. */
const broken = (sid: string): A2uiServerMessage =>
  ({ version: V, updateComponents: { surfaceId: sid, components: [{ id: 'root', component: 'Column', children: ['gone'] }] } }) as A2uiServerMessage

const session: Session = {
  turns: [
    { role: 'user', content: 'Start.' },
    { role: 'assistant', content: [create(OPEN), root(OPEN, 'open r-1')].map((m) => JSON.stringify(m)).join('\n') },
  ],
}
const input: TurnInput = { kind: 'intent', text: 'Show me the next step.', session }

/** A round's payload, by shape; `undefined` is a round with no payload (prose), `null` an unparseable one. */
const SHAPES = {
  prose: () => undefined,
  parse: () => null,
  A: (r: number) => [create(A), root(A, `A r${r}`)],
  Aflag: (r: number) => [create(A), root(A, `flagged A r${r}`)],
  Abroken: () => [create(A), broken(A)],
  AB: (r: number) => [create(A), root(A, `A r${r}`), create(B), root(B, `B r${r}`)],
  AbrokenB: (r: number) => [create(A), broken(A), create(B), root(B, `B r${r}`)],
  ABbroken: (r: number) => [create(A), root(A, `A r${r}`), create(B), broken(B)],
  B: (r: number) => [create(B), root(B, `B r${r}`)],
  // T-0328 shapes (2-round sequences only).
  /** A valid, but the reply names ask-1 (NARRATED_MECHANICS, which flags no surface). */
  Anarr: (r: number) => [create(A), root(A, `A r${r}`)],
  /** ABbroken plus a genui line with no html (GENUI_ENVELOPE, no surface path) on the text transport. */
  AgenuiBbroken: (r: number) => [create(A), root(A, `A r${r}`), create(B), broken(B)],
  /** A third id, so a rename can take two repair rounds (Cbroken, then C). */
  C: (r: number) => [create(C), root(C, `C r${r}`)],
  Cbroken: () => [create(C), broken(C)],
  O: (r: number) => [root(OPEN, `open r${r}`)],
  Aorphan: (r: number) => [root(A, `A r${r}`)],
  delA: () => [{ version: V, deleteSurface: { surfaceId: A } } as A2uiServerMessage],
} as const satisfies Record<string, (r: number) => A2uiServerMessage[] | undefined | null>
type Shape = keyof typeof SHAPES
const ALL_SHAPES = Object.keys(SHAPES) as Shape[]
const T0328_SHAPES: readonly Shape[] = ['Anarr', 'AgenuiBbroken', 'C', 'Cbroken']
const BASE_SHAPES = ALL_SHAPES.filter((s) => !T0328_SHAPES.includes(s))

const TRANSPORTS = ['text', 'tool', 'toolString'] as const
type Transport = (typeof TRANSPORTS)[number]

/** A test-only check: any Text that says "flagged" is a finding, so a valid round can still be sent back. */
const flagCheck: SemanticCheck = {
  id: 'flag',
  check: ({ surfaces }) =>
    surfaces.flatMap((v) => [...v.components.values()].filter((c) => typeof c['text'] === 'string' && c['text'].startsWith('flagged')).map((c) => ({ code: 'FLAGGED', path: `${v.surfaceId}:${c.id}`, message: `${c.id} is flagged: drop the word.` }))),
}

interface Scripted {
  provider: AgentProvider
  calls: () => number
}

function scripted(shapes: readonly Shape[], transport: Transport): Scripted {
  let n = 0
  const provider: AgentProvider = {
    async *stream(req) {
      const r = Math.min(n, shapes.length - 1)
      n += 1
      const shape = shapes[r]!
      const payload = SHAPES[shape](r)
      const reply = shape === 'Anarr' ? `Step ${r}. The board is on ${A}.` : `Step ${r}.`
      const note = `{"a2uiMeta":{"note":"${reply}"}}`
      if (transport === 'text' || payload === undefined || req.executeTool === undefined) {
        const genui = shape === 'AgenuiBbroken' ? '{"genui":{"surfaceId":"x"}}\n' : ''
        if (payload === undefined) yield note
        else yield `${note}\n${genui}${payload === null ? '{"version":"v1.0","createSurface":' : payload.map((m) => JSON.stringify(m)).join('\n')}`
        return
      }
      const target = shape === 'O' ? (transport === 'toolString' ? JSON.stringify({ surfaceId: OPEN }) : OPEN) : undefined
      const messages = payload === null ? '[{"version":"v1.0","createSurface":' : transport === 'toolString' ? JSON.stringify(payload) : payload
      await req.executeTool('render_surface', { reply, messages, ...(target !== undefined ? { target } : {}) }, req.signal)
    },
  }
  return { provider, calls: () => n }
}

type Outcome =
  | { kind: 'halt' }
  | { kind: 'shipped'; content: A2uiServerMessage[]; failureCodes: string[]; rounds: number }

async function runTurn(shapes: readonly Shape[], transport: Transport, checks: readonly SemanticCheck[] = [flagCheck]): Promise<Outcome> {
  const { provider } = scripted(shapes, transport)
  const lines: string[] = []
  try {
    for await (const l of produce(input, { provider, retrieve: () => [], catalog: defaultCatalog, semanticChecks: checks }, { maxRounds: shapes.length })) lines.push(l)
  } catch (e) {
    if (e instanceof ProduceHalt) return { kind: 'halt' }
    throw e
  }
  const trace = lines.map((l) => readMetaLine(l)?.a2uiMeta.trace).find((t) => t !== undefined)
  const content = lines.filter((l) => readMetaLine(l) === undefined).map((l) => JSON.parse(l) as A2uiServerMessage)
  return { kind: 'shipped', content, failureCodes: trace?.failureCodes ?? [], rounds: trace?.rounds ?? 0 }
}

const sidOf = (m: A2uiServerMessage): string | undefined => {
  const body = Object.values(m).find((v) => typeof v === 'object' && v !== null) as { surfaceId?: unknown } | undefined
  return typeof body?.surfaceId === 'string' ? body.surfaceId : undefined
}
const HELD = new Set([OPEN])

/** The surfaces a round's payload creates that the session does not hold and the round does not delete. */
function createdBy(shape: Shape, r: number): string[] {
  const payload = SHAPES[shape](r)
  if (!payload) return []
  const deleted = new Set(payload.flatMap((m) => ('deleteSurface' in m ? [m.deleteSurface.surfaceId] : [])))
  return payload.flatMap((m) => ('createSurface' in m && !HELD.has(m.createSurface.surfaceId) && !deleted.has(m.createSurface.surfaceId) ? [m.createSurface.surfaceId] : []))
}

/** T-0328: the surfaces a shape's own defect failure names: the flagCheck finding or the `root->gone` id-graph fault.
 *  Anarr's narration and AgenuiBbroken's genui failure name no defect, so they flag nothing more. */
const FLAGGED: Partial<Record<Shape, string[]>> = { Aflag: [A], Abroken: [A], AbrokenB: [A], ABbroken: [B], AgenuiBbroken: [B], Cbroken: [C] }

/** The round whose lines shipped. The last round run, unless an earlier round shipped (T-0302): then the latest round
 *  whose payload is the shipped content (each round's texts carry its index; only index-free shapes can tie). */
function shippedRound(shapes: readonly Shape[], outcome: Extract<Outcome, { kind: 'shipped' }>): number | undefined {
  if (!outcome.failureCodes.includes('EARLIER_ROUND_SHIPPED')) return outcome.rounds - 1
  const key = JSON.stringify(outcome.content)
  return shapes.flatMap((s, r) => (JSON.stringify(SHAPES[s](r) ?? []) === key ? [r] : [])).at(-1)
}

/** The last round before `k` that created `sid`. */
const createdIn = (shapes: readonly Shape[], k: number, sid: string): number => shapes.slice(0, k).flatMap((s, j) => (createdBy(s, j).includes(sid) ? [j] : [])).at(-1)!

/** Every violation of I1 and I2 one turn shows, as readable lines. */
function violations(shapes: readonly Shape[], outcome: Outcome): string[] {
  if (outcome.kind === 'halt' || outcome.failureCodes.includes('SURFACE_DEGRADED')) return []
  const out: string[] = []
  const k = shippedRound(shapes, outcome)
  if (k === undefined) return [`shipped lines match no single round: ${JSON.stringify(outcome.content)}`]
  const named = new Set(outcome.content.map(sidOf))
  // T-0328, round by round: the tracked surfaces in creation order, the ids ever created, and those created unflagged.
  const tracked: string[] = []
  const ever = new Set<string>()
  const clean = new Set<string>()
  for (let j = 0; j <= k; j++) {
    const made = createdBy(shapes[j]!, j)
    const fresh = made.filter((sid) => !ever.has(sid)).length
    const retire = tracked.filter((sid) => !made.includes(sid) && !clean.has(sid)).slice(0, fresh)
    for (const sid of retire) tracked.splice(tracked.indexOf(sid), 1)
    if (j === k) break
    for (const sid of made) {
      if (!tracked.includes(sid)) tracked.push(sid)
      ever.add(sid)
      if (!(FLAGGED[shapes[j]!] ?? []).includes(sid)) clean.add(sid)
    }
  }
  for (const sid of tracked) if (!named.has(sid)) out.push(`I1: ${sid} (created in round ${createdIn(shapes, k, sid)}) is missing from shipped round ${k}`)
  const known = new Set(HELD)
  for (const m of outcome.content) {
    if ('createSurface' in m) known.add(m.createSurface.surfaceId)
    else if (('updateComponents' in m || 'updateDataModel' in m) && !known.has(sidOf(m)!)) out.push(`I2: shipped an update to ${sidOf(m)}, which nothing created`)
  }
  return [...new Set(out)]
}

function* sequences(length: number, menu: readonly Shape[] = ALL_SHAPES): Generator<Shape[]> {
  if (length === 0) {
    yield []
    return
  }
  for (const head of sequences(length - 1, menu)) for (const s of menu) yield [...head, s]
}

/** The I1 and I2 counterexamples over every sequence of `length` rounds, one line each. */
async function counterexamples(length: number, transport: Transport, menu: readonly Shape[]): Promise<{ checked: number; shipped: number; failures: string[] }> {
  const failures: string[] = []
  let checked = 0
  let shipped = 0
  for (const shapes of sequences(length, menu)) {
    const outcome = await runTurn(shapes, transport)
    checked += 1
    if (outcome.kind === 'shipped' && !outcome.failureCodes.includes('SURFACE_DEGRADED')) shipped += 1
    for (const v of violations(shapes, outcome)) failures.push(`${transport} [${shapes.join(' > ')}] ${v}`)
  }
  return { checked, shipped, failures }
}

describe('T-0314: the repair loop keeps the turn invariant over every enumerated round sequence', () => {
  for (const transport of TRANSPORTS) {
    it(`I1 and I2 hold for every 2- and 3-round sequence (${transport})`, { timeout: 600_000 }, async () => {
      const all: string[] = []
      for (const length of [2, 3]) {
        const menu = length === 2 ? ALL_SHAPES : BASE_SHAPES
        const { checked, shipped, failures } = await counterexamples(length, transport, menu)
        expect(checked).toBe(menu.length ** length)
        expect(shipped).toBeGreaterThan(checked / 4) // anti-vacuity: most turns ship a round the invariant judges
        all.push(...failures)
      }
      expect(all).toEqual([])
    })
  }

  it('the oracle bites: a loop that shipped the last valid round whatever it dropped would red I1', () => {
    const lost: Outcome = { kind: 'shipped', content: SHAPES.B(1), failureCodes: [], rounds: 2 }
    expect(violations(['AB', 'B'], lost)).toEqual(['I1: ask-1 (created in round 0) is missing from shipped round 1'])
    // T-0328: a new id excuses only a surface that never shipped; one an earlier round built unflagged still counts.
    expect(violations(['A', 'B'], lost)).toEqual(['I1: ask-1 (created in round 0) is missing from shipped round 1'])
    expect(violations(['Aflag', 'B'], lost)).toEqual([])
    // T-0328: a new id retires one flagged surface; narration flags nothing; no new id retires nothing.
    expect(violations(['Anarr', 'B'], lost)).toEqual(['I1: ask-1 (created in round 0) is missing from shipped round 1'])
    expect(violations(['AbrokenB', 'B'], lost)).toEqual(['I1: ask-1 (created in round 0) is missing from shipped round 1'])
    const renamed: Outcome = { kind: 'shipped', content: SHAPES.C(2), failureCodes: [], rounds: 3 }
    expect(violations(['Aflag', 'Cbroken', 'C'], renamed)).toEqual([])
    expect(violations(['Aflag', 'B', 'C'], renamed)).toEqual(['I1: ask-2 (created in round 1) is missing from shipped round 2'])
    const orphan: Outcome = { kind: 'shipped', content: SHAPES.Aorphan(0), failureCodes: [], rounds: 1 }
    expect(violations(['Aorphan'], orphan)).toEqual(['I2: shipped an update to ask-1, which nothing created'])
  })
})

describe('T-0314: the T-0302 pin, as narrowed by T-0321: a flagged earlier round never ships when the last round fails', () => {
  // The single-surface family: no round can drop a surface the loop keeps (every failure names ask-1, or none is
  // attributable), so a round "validated with nothing dropped" is exactly an Aflag round (valid, sent back by a finding).
  // T-0302 shipped the last of them; T-0321 rules a round a check failed out of the fallback, so these turns halt or
  // degrade to text. The positive case (a clean earlier round ships) is pinned in produce-forced-surface.test.ts.
  const FAMILY: Shape[] = ['parse', 'Aflag', 'Abroken', 'prose']
  const FAILING_LAST: Shape[] = ['parse', 'Abroken']

  for (const transport of TRANSPORTS) {
    it(`no flagged earlier round ships and nothing is tallied EARLIER_ROUND_SHIPPED (${transport})`, { timeout: 600_000 }, async () => {
      let pinned = 0
      for (const length of [2, 3, 4]) {
        for (const head of sequences(length - 1, FAMILY)) {
          for (const last of FAILING_LAST) {
            const shapes = [...head, last]
            const valid = head.flatMap((s, r) => (s === 'Aflag' ? [r] : []))
            // A prose round before any surface is a turn answered in prose: it ships at once, so no later round runs.
            const firstSurface = head.findIndex((s) => s === 'Aflag' || s === 'Abroken')
            if (valid.length === 0 || head.slice(0, firstSurface).includes('prose')) continue
            pinned += 1
            const outcome = await runTurn(shapes, transport)
            const where = `${transport} [${shapes.join(' > ')}]`
            if (outcome.kind !== 'shipped') continue // a halt ships nothing
            expect(outcome.content, where).toEqual([])
            expect(outcome.failureCodes, where).toContain('SURFACE_DEGRADED')
            expect(outcome.failureCodes, where).not.toContain('EARLIER_ROUND_SHIPPED')
          }
        }
      }
      expect(pinned).toBeGreaterThan(50)
    })
  }

  it('with no valid earlier round the turn does not ship a payload', async () => {
    for (const transport of TRANSPORTS) {
      const outcome = await runTurn(['Abroken', 'parse'], transport)
      if (outcome.kind === 'shipped') {
        expect(outcome.content, transport).toEqual([])
        expect(outcome.failureCodes, transport).not.toContain('EARLIER_ROUND_SHIPPED')
      }
    }
  })
})
