// plan-runner.test.ts — SPEC-R21 AC1-AC6 + SPEC-R22 AC1-AC4 (a2ui-live-agent.spec.md §3.2c, ADR-0174
// cl.1/cl.3/cl.4/cl.6): scripted-transport unit coverage for the plan-runner, no key, no live model, no
// DOM (pure driver logic — a jsdom `site` project test, but nothing here touches the document).

import { describe, expect, it } from 'vitest'
import type { AgentTransport, Session, TurnInput } from './agent-runtime.ts'
import type { PlanDeclaration, PlanStep } from '@agent-ui/a2ui/agent/meta-line'
import {
  DEFAULT_PLAN_STEP_CAP,
  PLAN_SYNTHESIS_GROUP_KEY,
  consumePlan,
  frameStepInstruction,
  framePlanRequest,
  frameSynthesis,
  planStepGroupKey,
  runPlan,
  runPlannerTurn,
  sanitizeFailureReason,
} from './plan-runner.ts'

// ── the scripted transport harness ──────────────────────────────────────────────────────────────────────

/** One scripted call's raw yield — plain content lines, or a `{meta}` object merged onto the leading
 *  meta-line (`note`/`plan`/`ask`/`progress`/`error`), or an array of raw lines interleaving both. */
interface ScriptedTurn {
  /** #602 — content lines yielded BEFORE anything else this call scripts (progress/meta/`throws`/`lines`):
   *  the "already streamed, already rendered" content a mid-stream fault (either arm) leaves behind. */
  preLines?: string[]
  meta?: { note?: string; plan?: PlanDeclaration; ask?: { surfaceId: string }; error?: string }
  progress?: Array<{ stage: string }>
  lines?: string[]
  /** Fires synchronously right before this call yields anything — used to script a mid-run abort. */
  onCall?: () => void
  /** Throw instead of yielding — the "genuinely thrown exception" leg (SPEC-R22). Fires AFTER `preLines`. */
  throws?: boolean
  /** Throw with this exact message (default: 'scripted transport failure') — #602's sanitizer-case tests
   *  need to script specific (long/multiline/key-shaped) fault text. */
  throwMessage?: string
}

/** Builds an `AgentTransport` whose `turn()` behavior is scripted call-by-call (1-indexed by dispatch
 *  order — the plan-request turn is call 1, each step/synthesis dispatch the next). `calls` records every
 *  `TurnInput` actually dispatched, in order, for shape assertions (AC2's "nothing plan-shaped crosses the
 *  seam" — every recorded input is inspected for `.kind === 'intent'`). `concurrentPeak` proves dispatches
 *  never overlap (the suppression-by-construction proof) even under a deliberately delayed script. */
function scriptedTransport(script: ScriptedTurn[]): { transport: AgentTransport; calls: TurnInput[]; peak: { value: number } } {
  const calls: TurnInput[] = []
  let inFlight = 0
  const peak = { value: 0 } // an object, not a primitive — so callers reading `.value` AFTER the run see live state
  let index = 0
  const transport: AgentTransport = {
    async *turn(input: TurnInput): AsyncIterable<string> {
      calls.push(input)
      inFlight += 1
      peak.value = Math.max(peak.value, inFlight)
      const turn = script[index]
      index += 1
      try {
        if (turn === undefined) return
        turn.onCall?.()
        await Promise.resolve() // force a real microtask hop — a same-tick script would never expose overlap
        for (const line of turn.preLines ?? []) yield line // #602 — pre-fault content, before anything else
        if (turn.throws) throw new Error(turn.throwMessage ?? 'scripted transport failure')
        for (const p of turn.progress ?? []) yield JSON.stringify({ a2uiMeta: { progress: p } })
        if (turn.meta) yield JSON.stringify({ a2uiMeta: turn.meta })
        for (const line of turn.lines ?? []) yield line
      } finally {
        inFlight -= 1
      }
    },
  }
  return { transport, calls, peak }
}

function step(id: string, description = `do ${id}`): PlanStep {
  return { id, description }
}

const EMPTY_SESSION: Session = { turns: [] }

// ── pure framing (AC3) ──────────────────────────────────────────────────────────────────────────────────

describe('pure framing — byte-deterministic, no I/O (SPEC-R21 AC3)', () => {
  it('framePlanRequest is pure (called twice with the same intent → byte-identical)', () => {
    expect(framePlanRequest('build me a dashboard')).toBe(framePlanRequest('build me a dashboard'))
  })

  it('frameStepInstruction embeds the declared id + description verbatim, and is pure', () => {
    const s = step('gather-reqs', 'Gather the user requirements')
    const framed = frameStepInstruction(s)
    expect(framed).toContain('gather-reqs')
    expect(framed).toContain('Gather the user requirements')
    expect(framed).toBe(frameStepInstruction(s))
  })

  it('frameStepInstruction folds the SPEC-R22 failure acknowledgment when priorFailure is supplied', () => {
    const failed = step('step-1', 'Build the header')
    const framed = frameStepInstruction(step('step-2'), failed)
    expect(framed).toContain('step-1')
    expect(framed).toMatch(/failed/i)
    expect(framed).toContain('step-2') // this dispatch's OWN step id still present
  })

  it('frameSynthesis is pure and folds the failure acknowledgment for a failed LAST step', () => {
    const plan: PlanDeclaration = { steps: [step('a'), step('b')] }
    expect(frameSynthesis(plan)).toBe(frameSynthesis(plan))
    const framed = frameSynthesis(plan, step('b', 'Build the footer'))
    expect(framed).toContain('b')
    expect(framed).toMatch(/failed/i)
  })

  it('the plan-request framing never itself declares a plan-shaped payload (it is trigger TEXT only)', () => {
    expect(framePlanRequest('x')).not.toMatch(/"plan":\{/)
  })
})

// ── consumePlan (SPEC-R21 Consumption + Bounds) ─────────────────────────────────────────────────────────

describe('consumePlan — the pure cap/well-formedness decision', () => {
  it('no declared plan ⇒ {consumed:false, reason:"none"}', () => {
    expect(consumePlan(undefined)).toEqual({ consumed: false, reason: 'none' })
  })

  it('within cap ⇒ consumed', () => {
    const plan: PlanDeclaration = { steps: [step('a'), step('b')] }
    expect(consumePlan(plan, 8)).toEqual({ consumed: true, plan })
  })

  it('over cap ⇒ NOT consumed, naming the declared count + cap (never truncated/rewritten)', () => {
    const plan: PlanDeclaration = { steps: [step('a'), step('b'), step('c')] }
    expect(consumePlan(plan, 2)).toEqual({ consumed: false, reason: 'over-cap', declaredSteps: 3, cap: 2 })
  })

  it('the shipped default cap is 8 (SPEC-R21 Bounds — indicative, tunable)', () => {
    expect(DEFAULT_PLAN_STEP_CAP).toBe(8)
  })

  // M1 — a vacuous {steps:[]} declaration used to read as `consumed:true`, which would drive a K=0 run
  // whose only dispatch is a lone, contextless synthesis turn. Treated as "no consumable plan" instead.
  it('a ZERO-step declaration is NOT consumed — reads as "none", the SAME outcome an absent plan gets', () => {
    expect(consumePlan({ steps: [] })).toEqual({ consumed: false, reason: 'none' })
  })

  // M2 — duplicate declared step ids would collide onto ONE `planStepGroupKey`, corrupting the projection
  // (two steps silently sharing one status-stream group). Rejected, never deduped/renamed (the host never
  // rewrites a declaration it didn't author — the SAME ground the over-cap refusal stands on).
  it('duplicate declared step ids are REJECTED (never deduped/renamed) — they would collide onto one group key', () => {
    const plan: PlanDeclaration = { steps: [step('a'), step('b'), step('a')] }
    expect(consumePlan(plan, 8)).toEqual({ consumed: false, reason: 'duplicate-ids', duplicateId: 'a' })
  })

  it('a duplicate-id check runs BEFORE the cap check (a malformed plan is rejected regardless of length)', () => {
    const plan: PlanDeclaration = { steps: [step('a'), step('a'), step('b')] }
    expect(consumePlan(plan, 1)).toEqual({ consumed: false, reason: 'duplicate-ids', duplicateId: 'a' })
  })
})

// ── AC1 — planner mode OFF/absent: byte-identical to today's single-turn path ──────────────────────────

describe('SPEC-R21 AC1 — planner mode OFF/absent', () => {
  it('a plan declared on the ONLY dispatched turn is never consumed — zero further dispatches', async () => {
    const { transport, calls } = scriptedTransport([
      { meta: { note: 'hi', plan: { steps: [step('a'), step('b')] } }, lines: ['{"version":"v1.0","createSurface":{"surfaceId":"s"}}'] },
    ])
    const session = await runPlannerTurn({ transport, session: EMPTY_SESSION, intent: 'build a form', plannerEnabled: false })
    expect(calls).toHaveLength(1) // ZERO further dispatches beyond the one ordinary turn
    expect(calls[0]!.kind).toBe('intent')
    expect((calls[0] as { text: string }).text).toBe('build a form') // untouched — no plan-request framing
    expect(session.turns).toHaveLength(2) // one user + one assistant turn, exactly today's shape
    expect(session.turns[1]!.content).toBe('{"version":"v1.0","createSurface":{"surfaceId":"s"}}') // meta peeled, content unchanged
  })
})

// ── AC2 — planner mode ON: K steps + synthesis, or decline ─────────────────────────────────────────────

describe('SPEC-R21 AC2 — planner mode ON', () => {
  it('a consumed 3-step plan drives exactly 3 step dispatches + 1 synthesis, in declared order, plain intent inputs only', async () => {
    const plan: PlanDeclaration = { steps: [step('s1', 'first'), step('s2', 'second'), step('s3', 'third')] }
    const { transport, calls } = scriptedTransport([
      { meta: { note: 'planning', plan } }, // 1. plan-request
      { lines: ['{"version":"v1.0","createSurface":{"surfaceId":"s1"}}'] }, // 2. step s1
      { lines: ['{"version":"v1.0","createSurface":{"surfaceId":"s2"}}'] }, // 3. step s2
      { lines: ['{"version":"v1.0","createSurface":{"surfaceId":"s3"}}'] }, // 4. step s3
      { lines: ['{"version":"v1.0","createSurface":{"surfaceId":"final"}}'] }, // 5. synthesis
    ])
    const session = await runPlannerTurn({ transport, session: EMPTY_SESSION, intent: 'do three things', plannerEnabled: true })

    expect(calls).toHaveLength(5) // K+2 total (the plan turn + K steps + synthesis)
    for (const c of calls) expect(c.kind).toBe('intent') // nothing plan-shaped ever crosses the seam
    // Declared order: step texts appear in s1, s2, s3 order across calls 2-4.
    expect((calls[1] as { text: string }).text).toContain('s1')
    expect((calls[2] as { text: string }).text).toContain('s2')
    expect((calls[3] as { text: string }).text).toContain('s3')
    // step N's dispatched session contains every prior turn (the plan turn included) — call 3 (step s2)
    // must already see the plan-request pair + step s1's pair (4 turns) before its own dispatch.
    expect((calls[2] as { text: string; session: Session }).session.turns).toHaveLength(4)
    expect((calls[3] as { text: string; session: Session }).session.turns).toHaveLength(6)
    // Final session: (plan-request + 3 steps + synthesis) × 2 turns each = 10.
    expect(session.turns).toHaveLength(10)
  })

  it('the model declining to plan (no `plan` field) ⇒ zero further dispatches, the turn stands as ordinary output', async () => {
    const { transport, calls } = scriptedTransport([
      { meta: { note: 'just building it' }, lines: ['{"version":"v1.0","createSurface":{"surfaceId":"s"}}'] },
    ])
    const session = await runPlannerTurn({ transport, session: EMPTY_SESSION, intent: 'build a form', plannerEnabled: true })
    expect(calls).toHaveLength(1)
    expect(session.turns).toHaveLength(2)
    expect(session.turns[1]!.content).toBe('{"version":"v1.0","createSurface":{"surfaceId":"s"}}')
  })
})

// ── AC4 — the cap refusal + the exact K+1 budget + no-recursion ────────────────────────────────────────

describe('SPEC-R21 AC4 — bounds + no-recursion', () => {
  it('an over-cap plan is NOT consumed: zero step dispatches, exactly one refusal reported', async () => {
    const plan: PlanDeclaration = { steps: [step('a'), step('b'), step('c')] }
    const { transport, calls } = scriptedTransport([{ meta: { plan } }])
    const refusals: Array<{ declaredSteps: number; cap: number }> = []
    const session = await runPlannerTurn({
      transport,
      session: EMPTY_SESSION,
      intent: 'x',
      plannerEnabled: true,
      stepCap: 2,
      onRefused: (info) => refusals.push(info),
    })
    expect(calls).toHaveLength(1) // only the plan-request turn — zero step dispatches
    expect(refusals).toEqual([{ declaredSteps: 3, cap: 2 }])
    expect(session.turns).toHaveLength(2) // the plan-request turn still stands as ordinary output
  })

  it('a consumed K-step plan costs EXACTLY K+1 further dispatches (runPlan itself, K=4)', async () => {
    const plan: PlanDeclaration = { steps: [step('a'), step('b'), step('c'), step('d')] }
    const { transport, calls } = scriptedTransport([{ lines: [] }, { lines: [] }, { lines: [] }, { lines: [] }, { lines: [] }])
    await runPlan({ transport, session: EMPTY_SESSION, plan })
    expect(calls).toHaveLength(5) // K + 1 synthesis, never more
  })

  it('a `plan` declared on a STEP turn mid-run is never consumed — the running step list is unchanged', async () => {
    const plan: PlanDeclaration = { steps: [step('a'), step('b')] }
    const nested: PlanDeclaration = { steps: [step('x'), step('y'), step('z')] }
    const { transport, calls } = scriptedTransport([
      { meta: { plan: nested }, lines: [] }, // step "a" volunteers ANOTHER plan — must be ignored
      { lines: [] }, // step "b"
      { lines: [] }, // synthesis
    ])
    await runPlan({ transport, session: EMPTY_SESSION, plan })
    expect(calls).toHaveLength(3) // still exactly K+1 for the ORIGINAL 2-step plan — no recursion
    expect((calls[1] as { text: string }).text).toContain('b') // step "b" still dispatched, per the ORIGINAL plan
  })
})

// ── AC5 — K+1 groups seed, progress projects under its own group, terminal states ─────────────────────

describe('SPEC-R21 AC5 — status-stream projection (groups, never a new component/stage)', () => {
  it('seeds K+1 groups pending up front, transitions running→terminal per group, routes progress under its OWN group', async () => {
    const plan: PlanDeclaration = { steps: [step('s1'), step('s2')] }
    const { transport } = scriptedTransport([
      { progress: [{ stage: 'started' }, { stage: 'done' }], lines: [] }, // step s1
      { progress: [{ stage: 'started' }], lines: [] }, // step s2
      { lines: [] }, // synthesis
    ])
    const states: Array<[string, string]> = []
    const progressCalls: Array<[string, string]> = []
    await runPlan({
      transport,
      session: EMPTY_SESSION,
      plan,
      onStepState: (groupKey, state) => states.push([groupKey, state]),
      onProgress: (groupKey, progress) => progressCalls.push([groupKey, progress.stage]),
    })

    const s1 = planStepGroupKey('s1')
    const s2 = planStepGroupKey('s2')
    // Seeded pending, K+1 = 3 groups, BEFORE any dispatch (the first three entries).
    expect(states.slice(0, 3)).toEqual([
      [s1, 'pending'],
      [s2, 'pending'],
      [PLAN_SYNTHESIS_GROUP_KEY, 'pending'],
    ])
    // Every group reaches exactly one terminal state.
    expect(states).toContainEqual([s1, 'done'])
    expect(states).toContainEqual([s2, 'done'])
    expect(states).toContainEqual([PLAN_SYNTHESIS_GROUP_KEY, 'done'])
    // Progress events land under their OWN dispatch's group — never cross-attributed.
    expect(progressCalls).toEqual([
      [s1, 'started'],
      [s1, 'done'],
      [s2, 'started'],
    ])
  })
})

// ── AC6 — an ask on a runner-dispatched turn degrades to prose; the run proceeds uninterrupted ────────

describe('SPEC-R21 AC6 — ask on a step turn degrades (never a pending ask), run proceeds', () => {
  it('no crash, no special handling — the step still ends done and the run reaches synthesis', async () => {
    const plan: PlanDeclaration = { steps: [step('s1')] }
    const askLine = '{"version":"v1.0","createSurface":{"surfaceId":"ask-1"}}'
    const { transport, calls } = scriptedTransport([
      { meta: { note: 'pick one', ask: { surfaceId: 'ask-1' } }, lines: [askLine] }, // step s1 volunteers an ask
      { lines: [] }, // synthesis — MUST still be reached
    ])
    const states: Array<[string, string]> = []
    const session = await runPlan({ transport, session: EMPTY_SESSION, plan, onStepState: (g, s) => states.push([g, s]) })
    expect(calls).toHaveLength(2) // step + synthesis both dispatched — uninterrupted
    expect(states).toContainEqual([planStepGroupKey('s1'), 'done']) // an ask is not a failure
    expect(states).toContainEqual([PLAN_SYNTHESIS_GROUP_KEY, 'done'])
    // The ask's own payload line rides through as ordinary content — never specially intercepted/dropped
    // (the ADR-0097 degrade: "render the ask's lines as an ordinary canvas surface").
    expect(session.turns.some((t) => t.content.includes('ask-1'))).toBe(true)
  })
})

// ── SPEC-R22 AC1 — a step's failure folds into the NEXT dispatch, never a separate one ────────────────

describe('SPEC-R22 AC1 — a mid-run step failure continues the run, fold-in acknowledgment', () => {
  it('step j fails; j+1..K and synthesis still dispatch; the NEXT dispatch carries the acknowledgment; no extra dispatch', async () => {
    const plan: PlanDeclaration = { steps: [step('s1'), step('s2', 'Build the footer'), step('s3')] }
    const { transport, calls } = scriptedTransport([
      { lines: [] }, // s1 — ok
      { meta: { error: 'validator exhausted' } }, // s2 — FAILS
      { lines: [] }, // s3 — must still dispatch
      { lines: [] }, // synthesis — must still dispatch
    ])
    const states: Array<[string, string]> = []
    await runPlan({ transport, session: EMPTY_SESSION, plan, onStepState: (g, s) => states.push([g, s]) })

    expect(calls).toHaveLength(4) // K+1 exactly — the acknowledgment rides s3's dispatch, no extra call
    const s3Text = (calls[2] as { text: string }).text // calls: [s1, s2(fails), s3, synthesis]
    expect(s3Text).toContain('s2') // names the failed step
    expect(s3Text).toMatch(/failed/i)
    expect(states).toContainEqual([planStepGroupKey('s2'), 'failed'])
    expect(states).toContainEqual([planStepGroupKey('s3'), 'done'])
    expect(states).toContainEqual([PLAN_SYNTHESIS_GROUP_KEY, 'done'])
  })

  // M3 — driver-level regression: the pure `frameSynthesis(plan, priorFailure)` fold is unit-tested above,
  // but this proves `runPlan` ITSELF actually wires a failed LAST step's acknowledgment onto the synthesis
  // dispatch (SPEC-R22: "a failed LAST step's acknowledgment rides the synthesis dispatch") — not merely
  // that the pure function CAN do it.
  it('the LAST step fails ⇒ the SYNTHESIS dispatch text (not a step) carries the acknowledgment', async () => {
    const plan: PlanDeclaration = { steps: [step('s1'), step('s2', 'Build the footer')] }
    const { transport, calls } = scriptedTransport([
      { lines: [] }, // s1 — ok
      { meta: { error: 'validator exhausted' } }, // s2 (LAST step) — FAILS
      { lines: [] }, // synthesis — must carry the fold-in
    ])
    await runPlan({ transport, session: EMPTY_SESSION, plan })
    expect(calls).toHaveLength(3) // K+1 exactly — no extra dispatch for the acknowledgment itself
    const synthesisText = (calls[2] as { text: string }).text
    expect(synthesisText).toContain('s2')
    expect(synthesisText).toMatch(/failed/i)
  })
})

// ── SPEC-R22 AC2 — a synthesis failure leaves every step's content standing, returns cleanly ──────────

describe('SPEC-R22 AC2 — a synthesis failure leaves step content standing, returns cleanly', () => {
  it('every step turn survives in the session; the synthesis group ends failed/warning; no throw', async () => {
    const plan: PlanDeclaration = { steps: [step('s1'), step('s2')] }
    const { transport } = scriptedTransport([
      { lines: ['{"version":"v1.0","createSurface":{"surfaceId":"s1"}}'] },
      { lines: ['{"version":"v1.0","createSurface":{"surfaceId":"s2"}}'] },
      { meta: { error: 'synthesis validator exhausted' } },
    ])
    const states: Array<[string, string]> = []
    const session = await runPlan({ transport, session: EMPTY_SESSION, plan, onStepState: (g, s) => states.push([g, s]) })
    expect(session.turns.some((t) => t.content.includes('s1'))).toBe(true) // nothing rolled back
    expect(session.turns.some((t) => t.content.includes('s2'))).toBe(true)
    expect(states).toContainEqual([PLAN_SYNTHESIS_GROUP_KEY, 'failed'])
  })
})

// ── GH #592 — a THROWN transport.turn() folds into the SAME failed-tier as an error meta-line ──────────
// (a genuine dispatch throw used to escape `runPlan`'s loop entirely, rejecting the whole run's promise
// before every seeded group reached a terminal state — contradicting SPEC-R22's "a step's failure does
// NOT abort the run." `drainStepTurn` now catches it; these mirror the SPEC-R22 AC1/AC2 error-meta-line
// tests above, byte-for-byte, but with `throws: true` instead of `meta: { error: ... }`.)

describe('GH #592 — a thrown step dispatch does not abort the run (folds into the SAME failed-tier)', () => {
  it('step j THROWS; j+1..K and synthesis still dispatch; the NEXT dispatch carries the acknowledgment; no extra dispatch', async () => {
    const plan: PlanDeclaration = { steps: [step('s1'), step('s2', 'Build the footer'), step('s3')] }
    const { transport, calls } = scriptedTransport([
      { lines: [] }, // s1 — ok
      { throws: true }, // s2 — THROWS (a genuine transport/network fault, not an error meta-line)
      { lines: [] }, // s3 — must still dispatch
      { lines: [] }, // synthesis — must still dispatch
    ])
    const states: Array<[string, string]> = []
    const session = await runPlan({ transport, session: EMPTY_SESSION, plan, onStepState: (g, s) => states.push([g, s]) })

    expect(calls).toHaveLength(4) // K+1 exactly — the run COMPLETES, no abort
    const s3Text = (calls[2] as { text: string }).text // calls: [s1, s2(throws), s3, synthesis]
    expect(s3Text).toContain('s2') // names the failed step
    expect(s3Text).toMatch(/failed/i)
    expect(states).toContainEqual([planStepGroupKey('s1'), 'done'])
    expect(states).toContainEqual([planStepGroupKey('s2'), 'failed']) // thrown ⇒ same terminal state an error meta-line gets
    expect(states).toContainEqual([planStepGroupKey('s3'), 'done'])
    expect(states).toContainEqual([PLAN_SYNTHESIS_GROUP_KEY, 'done'])
    expect(session.turns).toHaveLength(8) // (s1+s2+s3+synthesis) × 2 turns each — the run reaches completion
  })

  it('a thrown LAST step ⇒ the SYNTHESIS dispatch (not a step) carries the acknowledgment', async () => {
    const plan: PlanDeclaration = { steps: [step('s1'), step('s2', 'Build the footer')] }
    const { transport, calls } = scriptedTransport([
      { lines: [] }, // s1 — ok
      { throws: true }, // s2 (LAST step) — THROWS
      { lines: [] }, // synthesis — must carry the fold-in
    ])
    await runPlan({ transport, session: EMPTY_SESSION, plan })
    expect(calls).toHaveLength(3) // K+1 exactly — no extra dispatch for the acknowledgment itself
    const synthesisText = (calls[2] as { text: string }).text
    expect(synthesisText).toContain('s2')
    expect(synthesisText).toMatch(/failed/i)
  })

  it('the SYNTHESIS dispatch itself THROWS ⇒ every step surface stands, the synthesis group ends failed, no throw escapes', async () => {
    const plan: PlanDeclaration = { steps: [step('s1'), step('s2')] }
    const { transport } = scriptedTransport([
      { lines: ['{"version":"v1.0","createSurface":{"surfaceId":"s1"}}'] },
      { lines: ['{"version":"v1.0","createSurface":{"surfaceId":"s2"}}'] },
      { throws: true }, // synthesis — THROWS
    ])
    const states: Array<[string, string]> = []
    const session = await runPlan({ transport, session: EMPTY_SESSION, plan, onStepState: (g, s) => states.push([g, s]) })
    expect(session.turns.some((t) => t.content.includes('s1'))).toBe(true) // nothing rolled back
    expect(session.turns.some((t) => t.content.includes('s2'))).toBe(true)
    expect(states).toContainEqual([PLAN_SYNTHESIS_GROUP_KEY, 'failed']) // thrown ⇒ same terminal state an error meta-line gets
  })

  it('a thrown step does not abort the run at the runPlannerTurn seam either (full plan→step→synthesis path)', async () => {
    const plan: PlanDeclaration = { steps: [step('s1'), step('s2')] }
    const { transport, calls } = scriptedTransport([
      { meta: { plan } }, // 1. plan-request
      { throws: true }, // 2. step s1 — THROWS
      { lines: [] }, // 3. step s2
      { lines: [] }, // 4. synthesis
    ])
    const session = await runPlannerTurn({ transport, session: EMPTY_SESSION, intent: 'do it', plannerEnabled: true })
    expect(calls).toHaveLength(4) // the full K+2 run completes — no abort
    expect(session.turns).toHaveLength(8)
  })

  it('the PLAN-REQUEST turn throwing is still the ONE TRUE ABORT (SPEC-R22 tier 1) — unchanged by this fix', async () => {
    const { transport, calls } = scriptedTransport([{ throws: true }])
    await expect(runPlannerTurn({ transport, session: EMPTY_SESSION, intent: 'x', plannerEnabled: true })).rejects.toThrow(
      'scripted transport failure',
    )
    expect(calls).toHaveLength(1) // only the plan-request turn ever dispatched — no loop ever started
  })
})

// ── GH #602 leg 1 — render-vs-record consistency: a throw keeps pre-throw lines, same as the meta-line arm
// (a mid-stream throw used to discard `content:''` even when lines had already streamed — and already
// painted the canvas through the page's `renderingTransport` wrapper — while a mid-stream `error` meta-line
// already kept them. Ruled keep-both-consistent TOWARD the meta-line arm: SPEC-R22's Advisory Law text is
// explicit that "whatever validated content it did emit renders as ordinary output," unconditional on the
// call's terminal state — so retaining pre-fault content on failure is spec-consistent, not spec-silent.)

describe('GH #602 leg 1 — a mid-stream THROW keeps pre-throw content, consistent with the meta-line arm', () => {
  const PRE_LINES = ['{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"agent-ui"}}']

  it('arm consistency: a throw-with-pre-lines step and a meta-line-error-with-pre-lines step record BYTE-IDENTICAL content', async () => {
    const plan: PlanDeclaration = { steps: [step('s1')] }

    const { transport: metaTransport } = scriptedTransport([
      { preLines: PRE_LINES, meta: { error: 'boom' } }, // the pre-existing, correct arm
      { lines: [] }, // synthesis
    ])
    const metaSession = await runPlan({ transport: metaTransport, session: EMPTY_SESSION, plan })

    const { transport: throwTransport } = scriptedTransport([
      { preLines: PRE_LINES, throws: true }, // the #602-fixed arm — SAME pre-fault content
      { lines: [] }, // synthesis
    ])
    const throwSession = await runPlan({ transport: throwTransport, session: EMPTY_SESSION, plan })

    // session.turns: [user(step), assistant(step), user(synthesis), assistant(synthesis)] — index 1 is the
    // step's own recorded content.
    const metaStepContent = metaSession.turns[1]!.content
    const throwStepContent = throwSession.turns[1]!.content
    expect(metaStepContent).toContain('s1') // the pre-fault line really is retained on the meta-line arm
    expect(throwStepContent).toBe(metaStepContent) // …and now BYTE-IDENTICAL on the throw arm too
  })

  it('a thrown step with pre-fault content records that content (not empty) while still ending failed', async () => {
    const plan: PlanDeclaration = { steps: [step('s1'), step('s2')] }
    const { transport } = scriptedTransport([
      { preLines: PRE_LINES, throws: true }, // s1 — streams a real surface, THEN faults
      { lines: [] }, // s2
      { lines: [] }, // synthesis
    ])
    const states: Array<[string, string]> = []
    const session = await runPlan({ transport, session: EMPTY_SESSION, plan, onStepState: (g, s) => states.push([g, s]) })
    expect(session.turns[1]!.content).toContain('s1') // pre-fault content survived, never emptied to ''
    expect(states).toContainEqual([planStepGroupKey('s1'), 'failed']) // still ends failed — content ≠ success
  })

  it('a thrown step with NO pre-fault content still records empty content (nothing to keep, nothing invented)', async () => {
    const plan: PlanDeclaration = { steps: [step('s1')] }
    const { transport } = scriptedTransport([{ throws: true }, { lines: [] }])
    const session = await runPlan({ transport, session: EMPTY_SESSION, plan })
    expect(session.turns[1]!.content).toBe('')
  })
})

// ── GH #602 leg 2 — display honesty: a sanitized failure reason, status-label-only, never a dispatch ──────

describe('GH #602 leg 2 — sanitizeFailureReason (pure)', () => {
  it('collapses a multiline message to ONE line', () => {
    expect(sanitizeFailureReason('validator exhausted\nafter 3 rounds\r\ngiving up')).toBe(
      'validator exhausted after 3 rounds giving up',
    )
  })

  it('truncates to ≤120 chars, trailing an ellipsis marker', () => {
    const long = 'x'.repeat(200)
    const sanitized = sanitizeFailureReason(long)
    expect(sanitized.length).toBe(120)
    expect(sanitized.endsWith('…')).toBe(true)
    expect(sanitized.startsWith('x'.repeat(119))).toBe(true)
  })

  it('a short message is returned untouched (well under the 120-char cap, no ellipsis)', () => {
    expect(sanitizeFailureReason('validator exhausted')).toBe('validator exhausted')
  })

  it('strips a KEY-shaped substring ("api_key=<long value>")', () => {
    const sanitized = sanitizeFailureReason('upstream rejected: api_key=sk-ABC123DEF456GHI789JKL is invalid')
    expect(sanitized).not.toContain('sk-ABC123DEF456GHI789JKL')
    expect(sanitized).toContain('[redacted]')
  })

  it('strips a TOKEN-shaped substring ("token: <long value>")', () => {
    const sanitized = sanitizeFailureReason('fetch failed, token: abcDEF123456ghi789 expired mid-call')
    expect(sanitized).not.toContain('abcDEF123456ghi789')
    expect(sanitized).toContain('[redacted]')
  })

  it('strips a BEARER-shaped substring ("Bearer <token>", no separator)', () => {
    const sanitized = sanitizeFailureReason('401 Unauthorized — Authorization: Bearer sk-live-9f8e7d6c5b4a3210')
    expect(sanitized).not.toContain('sk-live-9f8e7d6c5b4a3210')
    expect(sanitized).toContain('[redacted]')
  })

  it('strips a bare JWT-shaped substring even with no keyword context', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dGhpc2lzbm90YXJlYWxzaWduYXR1cmU'
    const sanitized = sanitizeFailureReason(`upstream fault while validating: ${jwt}`)
    expect(sanitized).not.toContain(jwt)
    expect(sanitized).toContain('[redacted]')
  })

  it('does NOT redact a plain English word that happens to follow a keyword ("token expired")', () => {
    expect(sanitizeFailureReason('token expired, please retry')).toBe('token expired, please retry')
  })

  it('an empty/whitespace-only message degrades to a fixed fallback, never an empty label', () => {
    expect(sanitizeFailureReason('')).toBe('unspecified error')
    expect(sanitizeFailureReason('   \n\t  ')).toBe('unspecified error')
  })

  it('is pure — called twice with the same input, byte-identical output', () => {
    const msg = 'validator exhausted after 3 rounds'
    expect(sanitizeFailureReason(msg)).toBe(sanitizeFailureReason(msg))
  })
})

describe('GH #602 leg 2 — runPlan surfaces the sanitized reason on onStepState, never on a dispatch', () => {
  it('a step failing via an error meta-line carrying a key-shaped message surfaces a SANITIZED reason to onStepState', async () => {
    const plan: PlanDeclaration = { steps: [step('s1'), step('s2')] }
    const secret = 'sk-ABC123DEF456GHI789JKL'
    const { transport, calls } = scriptedTransport([
      { meta: { error: `upstream rejected api_key=${secret}` } }, // s1 — fails, carries a key-shaped message
      { lines: [] }, // s2 — must carry the fold-in, must NEVER see the secret
      { lines: [] }, // synthesis
    ])
    const reasons: Array<[string, string, string | undefined]> = []
    await runPlan({
      transport,
      session: EMPTY_SESSION,
      plan,
      onStepState: (g, s, reason) => reasons.push([g, s, reason]),
    })

    const failedEntry = reasons.find(([g, s]) => g === planStepGroupKey('s1') && s === 'failed')
    expect(failedEntry, 'a failed group carries a reason').toBeDefined()
    expect(failedEntry![2]).toBeDefined()
    expect(failedEntry![2]).not.toContain(secret) // the SANITIZED reason, never the raw secret
    expect(failedEntry![2]).toContain('[redacted]')

    // Every non-failed onStepState call carries NO reason (pending/running/done never get one).
    for (const [, s, reason] of reasons) {
      if (s !== 'failed') expect(reason).toBeUndefined()
    }

    // The dispatch-leak negative: the NEXT dispatch's text is the fixed fold-in wording ONLY — the raw
    // secret AND the sanitized reason string alike never ride any dispatch (SPEC-R21's own leak analysis).
    const s2Text = (calls[1] as { text: string }).text
    expect(s2Text).not.toContain(secret)
    expect(s2Text).not.toContain('[redacted]')
    expect(s2Text).toContain('s1')
    expect(s2Text).toMatch(/failed/i)
  })

  it('a step failing via a genuine THROW carrying a key-shaped message ALSO surfaces a sanitized reason (both arms alike)', async () => {
    const plan: PlanDeclaration = { steps: [step('s1'), step('s2')] }
    const secret = 'Bearer sk-live-9f8e7d6c5b4a3210'
    const { transport, calls } = scriptedTransport([
      { throws: true, throwMessage: `transport fault: ${secret}` }, // s1 — throws, carries a bearer-shaped message
      { lines: [] }, // s2
      { lines: [] }, // synthesis
    ])
    const reasons: Array<[string, string, string | undefined]> = []
    await runPlan({
      transport,
      session: EMPTY_SESSION,
      plan,
      onStepState: (g, s, reason) => reasons.push([g, s, reason]),
    })

    const failedEntry = reasons.find(([g, s]) => g === planStepGroupKey('s1') && s === 'failed')
    expect(failedEntry![2]).toBeDefined()
    expect(failedEntry![2]).not.toContain('sk-live-9f8e7d6c5b4a3210')
    expect(failedEntry![2]).toContain('[redacted]')

    const s2Text = (calls[1] as { text: string }).text
    expect(s2Text).not.toContain('sk-live-9f8e7d6c5b4a3210')
    expect(s2Text).not.toContain('[redacted]')
  })

  it('a synthesis failure ALSO surfaces a sanitized reason on its own group', async () => {
    const plan: PlanDeclaration = { steps: [step('s1')] }
    const { transport } = scriptedTransport([
      { lines: [] }, // s1 — ok
      { meta: { error: 'token: verylongsecretvalue123456' } }, // synthesis — fails, key-shaped
    ])
    const reasons: Array<[string, string, string | undefined]> = []
    await runPlan({
      transport,
      session: EMPTY_SESSION,
      plan,
      onStepState: (g, s, reason) => reasons.push([g, s, reason]),
    })
    const synthEntry = reasons.find(([g, s]) => g === PLAN_SYNTHESIS_GROUP_KEY && s === 'failed')
    expect(synthEntry![2]).toBeDefined()
    expect(synthEntry![2]).not.toContain('verylongsecretvalue123456')
    expect(synthEntry![2]).toContain('[redacted]')
  })
})

// ── SPEC-R22 AC3 — abandon: no further dispatch, remaining groups end not-run ──────────────────────────

describe('SPEC-R22 AC3 — an aborted run dispatches nothing further', () => {
  it('after step j completes, an abort stops the run — later steps + synthesis end not-run, undispatched', async () => {
    const controller = new AbortController()
    const plan: PlanDeclaration = { steps: [step('s1'), step('s2'), step('s3')] }
    const { transport, calls } = scriptedTransport([
      { lines: [], onCall: () => controller.abort() }, // s1 completes, THEN the signal fires
      { lines: [] }, // s2 — must never dispatch
      { lines: [] }, // s3 — must never dispatch
      { lines: [] }, // synthesis — must never dispatch
    ])
    const states: Array<[string, string]> = []
    await runPlan({ transport, session: EMPTY_SESSION, plan, signal: controller.signal, onStepState: (g, s) => states.push([g, s]) })
    expect(calls).toHaveLength(1) // only s1 ever actually dispatched
    expect(states).toContainEqual([planStepGroupKey('s1'), 'done'])
    expect(states).toContainEqual([planStepGroupKey('s2'), 'not-run'])
    expect(states).toContainEqual([planStepGroupKey('s3'), 'not-run'])
    expect(states).toContainEqual([PLAN_SYNTHESIS_GROUP_KEY, 'not-run'])
  })
})

// ── SPEC-R22 AC4 — the advisory law: no declaration-vs-output check, ever ──────────────────────────────

describe('SPEC-R22 AC4 — the advisory law (divergence from the declaration is legal)', () => {
  it('a step whose output is unrelated to its declaration, and one emitting a note only, both close done', async () => {
    const plan: PlanDeclaration = {
      steps: [step('s1', 'Build a login form'), step('s2', 'Build a settings page')],
    }
    const { transport } = scriptedTransport([
      { lines: ['{"version":"v1.0","createSurface":{"surfaceId":"totally-unrelated-dashboard"}}'] }, // s1: unrelated output
      { meta: { note: 'nothing to show' }, lines: [] }, // s2: note only, zero A2UI content
    ])
    const states: Array<[string, string]> = []
    await runPlan({ transport, session: EMPTY_SESSION, plan, onStepState: (g, s) => states.push([g, s]) })
    expect(states).toContainEqual([planStepGroupKey('s1'), 'done']) // no content-vs-declaration check
    expect(states).toContainEqual([planStepGroupKey('s2'), 'done'])
  })
})

// ── Suppression-by-construction + the SPEC-R8 cap exemption ────────────────────────────────────────────

describe('mid-run suppression is true by construction; runner dispatches are exempt from any external turn cap', () => {
  it('every dispatch is a plain {kind:"intent"} input — no client-message seam exists for a mid-run click to enter', async () => {
    const plan: PlanDeclaration = { steps: [step('a'), step('b')] }
    const { transport, calls } = scriptedTransport([{ lines: [] }, { lines: [] }, { lines: [] }])
    await runPlan({ transport, session: EMPTY_SESSION, plan })
    expect(calls.every((c) => c.kind === 'intent')).toBe(true) // never 'client' — nothing external can join a run
  })

  it('dispatches never overlap, even under a transport with a real microtask hop per call (at-most-one-run true by construction)', async () => {
    const plan: PlanDeclaration = { steps: [step('a'), step('b'), step('c')] }
    const { transport, peak } = scriptedTransport([{ lines: [] }, { lines: [] }, { lines: [] }, { lines: [] }])
    await runPlan({ transport, session: EMPTY_SESSION, plan })
    expect(peak.value).toBe(1) // sequential K+1 accounting holds exactly — never two calls in flight
  })

  it('a 6-step plan still drives all 7 dispatches — runner dispatches are exempt from any external turn-count cap', async () => {
    const plan: PlanDeclaration = { steps: Array.from({ length: 6 }, (_, i) => step(`s${i}`)) }
    const script: ScriptedTurn[] = Array.from({ length: 7 }, () => ({ lines: [] })) // 6 steps + synthesis
    const { transport, calls } = scriptedTransport(script)
    await runPlan({ transport, session: EMPTY_SESSION, plan }) // this module reads/enforces no external cap at all
    expect(calls).toHaveLength(7)
  })
})
