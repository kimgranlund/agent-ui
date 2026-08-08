// a2ui-live.planner.test.ts — GH #579 (ADR-0174/SPEC-R21/R22): drives the REAL page's planner-stage wiring
// end to end through a SCRIPTED stub `AgentTransport` (the `a2ui-live.ask-lifecycle.test.ts` precedent —
// same dynamic-import + `__setTransportForTest` seam, no key, no live model, jsdom-covered). Adds a
// SECOND test-only seam this slice introduces, `__setPlannerEnabledForTest` (a2ui-live.ts), so the gate
// can be flipped without touching `location.search`.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { AgentTransport, TurnInput } from '../lib/agent-runtime.ts'

// `a2ui-live.ts`'s test-only injection seams — bound in `beforeAll` below via a DEFERRED (dynamic) import,
// never a static one (see the ask-lifecycle precedent's own comment for why ordering is load-bearing).
let __setTransportForTest: (next: AgentTransport, live?: boolean) => void
let __setPlannerEnabledForTest: (enabled: boolean) => void

beforeAll(async () => {
  // jsdom reality (the ask-lifecycle/`a2ui-gallery.test.ts` precedent): `ElementInternals.setFormValue`/
  // `setValidity` are ABSENT in jsdom, and importing `a2ui-live.ts` itself eagerly builds + connects the
  // chat composer's real, form-associated editor as a side effect of import — stub once at the shared
  // prototype, additive, a no-op if a future jsdom ships the real method.
  if (typeof ElementInternals.prototype.setFormValue !== 'function') {
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
  }
  const mod = await import('./a2ui-live.ts')
  __setTransportForTest = mod.__setTransportForTest
  __setPlannerEnabledForTest = mod.__setPlannerEnabledForTest
})

// ── scripting helpers (the ask-lifecycle precedent's own small, page-local duplicates) ────────────────────

/** A per-turn scripted `AgentTransport`: `byTurn(turnIndex, input)` returns the raw lines that turn emits
 *  (sync or a Promise of them, so a specific turn can be held open by the test — the mid-run composer-
 *  suppression proof needs exactly this). */
function scriptedTransport(byTurn: (turnIndex: number, input: TurnInput) => string[] | Promise<string[]>): AgentTransport {
  let turnIndex = 0
  return {
    async *turn(input: TurnInput): AsyncIterable<string> {
      turnIndex += 1
      const lines = await byTurn(turnIndex, input)
      for (const line of lines) yield line
    },
  }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

async function waitUntil(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now()
  for (;;) {
    if (predicate()) return
    if (Date.now() - start > timeoutMs) throw new Error('waitUntil: condition never became true within the timeout')
    await new Promise((r) => setTimeout(r, 0))
  }
}

function lastNarrationStrip(): HTMLElement | null {
  const strips = document.querySelectorAll<HTMLElement>('.chat-log .narration-strip')
  return strips.length > 0 ? strips[strips.length - 1]! : null
}
function narrationLabel(key: string): string | null | undefined {
  return lastNarrationStrip()?.querySelector(`[data-key="${key}"] [data-role="label"]`)?.textContent
}

function composerBusy(): boolean {
  return document.querySelector('.chat-composer')?.hasAttribute('busy') ?? false
}

async function sendIntent(text: string): Promise<void> {
  const editor = document.querySelector('.chat-composer [data-part="editor"]') as HTMLElement
  editor.textContent = text
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  const sendBtn = document.querySelector('.chat-composer [data-part="send"]') as HTMLElement
  sendBtn.click()
}

function resetPage(): void {
  const resetBtn = [...document.querySelectorAll<HTMLElement>('ui-button')].find((b) => b.textContent?.trim() === 'Reset')
  resetBtn?.click()
}

/** The reserved leading meta-line envelope (ADR-0088 §1 / ADR-0097 §1 / ADR-0174 cl.2) — hand-built (the
 *  wire shape is tiny and public, `readMetaLine`'s own contract). `plan` is this ticket's own field;
 *  `error` is the GH #144 transport-composed terminal-failure line; `ask` is ADR-0097 §1's routing field. */
function metaLine(fields: {
  note?: string
  plan?: { steps: { id: string; description: string }[] }
  error?: string
  ask?: { surfaceId: string }
}): string {
  return JSON.stringify({ a2uiMeta: fields })
}

function surfaceLines(surfaceId: string, text: string): string[] {
  return [
    `{"version":"v1.0","createSurface":{"surfaceId":"${surfaceId}","catalogId":"agent-ui"}}`,
    `{"version":"v1.0","updateComponents":{"surfaceId":"${surfaceId}","components":[{"id":"root","component":"Text","text":"${text}"}]}}`,
  ]
}

function chatMessages(role: 'user' | 'agent' | 'system'): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.chat-log .msg')].filter((m) => m.dataset.role === role)
}

function askBubble(surfaceId: string): HTMLElement | null {
  return document.querySelector(`.msg[data-ask="${surfaceId}"]`)
}

beforeEach(() => {
  resetPage()
})

describe('a2ui-live planner-stage wiring (GH #579, ADR-0174/SPEC-R21/R22) — a scripted transport drives the REAL page', () => {
  it('gate OFF (default): a volunteered plan declaration is never consumed — one ordinary dispatch, byte-identical single-turn output', async () => {
    __setPlannerEnabledForTest(false)
    let calls = 0
    __setTransportForTest(
      scriptedTransport(() => {
        calls += 1
        return [metaLine({ plan: { steps: [{ id: 'a', description: 'do a' }] } }), ...surfaceLines('s1', 'built directly')]
      }),
    )

    await sendIntent('build me something')
    await waitUntil(() => document.querySelector("ui-surface-host [data-part='surface']")?.textContent?.includes('built directly') === true)

    expect(calls, 'SPEC-R21 AC1 — a plan is never consumed while the gate is off, no further dispatches').toBe(1)
    expect(document.querySelectorAll('.chat-log .narration-strip').length, 'ONE flat strip, never K+1 groups, while the gate is off').toBe(1)
  })

  it('gate ON: a consumed 2-step plan drives K+2 total dispatches, seeds K+1 status-stream groups, suppresses the composer mid-run, and the closing synthesis renders', async () => {
    __setPlannerEnabledForTest(true)
    const stepAGate = deferred<string[]>()
    const calls: { turn: number; text: string }[] = []
    __setTransportForTest(
      scriptedTransport((turn, input) => {
        calls.push({ turn, text: input.kind === 'intent' ? input.text : '' })
        if (turn === 1) return [metaLine({ plan: { steps: [{ id: 'a', description: 'Do A' }, { id: 'b', description: 'Do B' }] } })]
        if (turn === 2) return stepAGate.promise // step "a" — held open so the test can assert mid-run state
        if (turn === 3) return surfaceLines('surf-b', 'B done')
        return surfaceLines('final', 'Synthesis done')
      }),
    )

    await sendIntent('plan this out')

    // Mid-run: the composer is suppressed (v0.11 ruling — the DISABLE presentation, `[busy]` reflects the
    // SAME mechanism an ordinary turn already uses) and the K+1 groups have seeded with the correct
    // pending/running split (SPEC-R21 Projection: all seed BEFORE any step dispatches; step "a" is the
    // only one currently running).
    await waitUntil(() => composerBusy())
    expect(composerBusy(), 'mid-run composer suppression (SPEC-R21 Mid-run user interaction)').toBe(true)
    await waitUntil(() => narrationLabel('plan-step:a') === 'Step "a" — Running…')
    expect(narrationLabel('plan-step:b'), 'seeded pending up front, before its own dispatch').toBe('Step "b" — Queued')
    expect(narrationLabel('plan-synthesis'), 'seeded pending up front, before any step or synthesis runs').toBe('Synthesis — Queued')

    stepAGate.resolve(surfaceLines('surf-a', 'A done'))

    await waitUntil(() => document.querySelector("ui-surface-host [data-part='surface']")?.textContent?.includes('Synthesis done') === true)

    // K+2 total dispatches (plan + 2 steps + synthesis), each an ordinary `{kind:'intent'}` TurnInput —
    // nothing plan-shaped crosses the AgentTransport seam (SPEC-R21 Placement/Bounds).
    expect(calls.length).toBe(4)
    expect(calls[1]!.text).toContain('Do A')
    expect(calls[2]!.text).toContain('Do B')

    expect(narrationLabel('plan-step:a')).toBe('Step "a" — Done')
    expect(narrationLabel('plan-step:b')).toBe('Step "b" — Done')
    expect(narrationLabel('plan-synthesis')).toBe('Synthesis — Done')

    // Every dispatched surface (both steps + the closing synthesis) rendered into the SAME shared canvas,
    // progressively, as the run advanced — not just the synthesis turn's own output.
    const canvasText = document.querySelector("ui-surface-host [data-part='surface']")?.textContent ?? ''
    expect(canvasText).toContain('A done')
    expect(canvasText).toContain('B done')
    expect(canvasText).toContain('Synthesis done')

    await waitUntil(() => !composerBusy())
  })

  it('gate ON: a plan declaring more steps than the cap is REFUSED — zero step/synthesis dispatches, ONE visible warning entry', async () => {
    __setPlannerEnabledForTest(true)
    let calls = 0
    const overCapSteps = Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, description: `step ${i}` })) // DEFAULT_PLAN_STEP_CAP is 8
    __setTransportForTest(
      scriptedTransport(() => {
        calls += 1
        return [metaLine({ plan: { steps: overCapSteps } })]
      }),
    )

    await sendIntent('do way too much')
    await waitUntil(() => narrationLabel('plan-refused') !== null && narrationLabel('plan-refused') !== undefined)

    // SPEC-R21 Bounds/AC4 — over cap ⇒ zero step dispatches (the plan-request turn is the ONLY call) and
    // exactly one visible warning entry naming the refusal.
    expect(calls, 'over-cap ⇒ the host never consumes, never dispatches a single step or synthesis turn').toBe(1)
    expect(narrationLabel('plan-refused')).toContain('9 step(s), over the 8-step cap')

    await waitUntil(() => !composerBusy())
  })

  it('gate ON: a step failure (transport-composed error meta-line) does NOT abort the run — the acknowledgment folds into the NEXT dispatch, the run reaches terminal states', async () => {
    __setPlannerEnabledForTest(true)
    const calls: { turn: number; text: string }[] = []
    __setTransportForTest(
      scriptedTransport((turn, input) => {
        calls.push({ turn, text: input.kind === 'intent' ? input.text : '' })
        if (turn === 1) return [metaLine({ plan: { steps: [{ id: 'a', description: 'Do A' }, { id: 'b', description: 'Do B' }] } })]
        if (turn === 2) return [metaLine({ error: 'boom' })] // SPEC-R22 tier 2 — a transport-composed terminal failure, GH #144
        if (turn === 3) return surfaceLines('surf-b', 'B done')
        return surfaceLines('final', 'Synthesis done')
      }),
    )

    await sendIntent('plan with a failing step')
    await waitUntil(() => document.querySelector("ui-surface-host [data-part='surface']")?.textContent?.includes('Synthesis done') === true)

    // SPEC-R22 — step "a"'s own failure does not abort: all K+2 dispatches still happen, in order.
    expect(calls.length).toBe(4)
    // The failure acknowledgment folds into the VERY NEXT dispatch's own user content — never a separate
    // dispatch (the SPEC-R21 budget stays exact).
    expect(calls[2]!.text).toContain('plan step "a"')
    expect(calls[2]!.text).toContain('failed')

    expect(narrationLabel('plan-step:a'), 'a failed step group closes error/failed, never stranded').toBe('Step "a" — Failed')
    expect(narrationLabel('plan-step:b')).toBe('Step "b" — Done')
    expect(narrationLabel('plan-synthesis'), 'a synthesis dispatch after a step failure still reaches done').toBe('Synthesis — Done')

    // Step "a" contributed ZERO wire content (SPEC-R5 — a failed dispatch never partially ships).
    const canvasText = document.querySelector("ui-surface-host [data-part='surface']")?.textContent ?? ''
    expect(canvasText).toContain('B done')
    expect(canvasText).toContain('Synthesis done')

    await waitUntil(() => !composerBusy())
  })

  it('gate ON: a THROWN step dispatch (GH #592, FIXED upstream) does NOT abort the run — folds into the SAME failed-tier an error meta-line already gets', async () => {
    __setPlannerEnabledForTest(true)
    const calls: { turn: number; text: string }[] = []
    __setTransportForTest(
      scriptedTransport((turn, input) => {
        calls.push({ turn, text: input.kind === 'intent' ? input.text : '' })
        if (turn === 1) return [metaLine({ plan: { steps: [{ id: 'a', description: 'Do A' }, { id: 'b', description: 'Do B' }] } })]
        if (turn === 2) throw new Error('transport fault') // a genuine exception, NOT an error meta-line
        if (turn === 3) return surfaceLines('surf-b', 'B done')
        return surfaceLines('final', 'Synthesis done')
      }),
    )

    await sendIntent('plan that explodes mid-step')
    await waitUntil(() => document.querySelector("ui-surface-host [data-part='surface']")?.textContent?.includes('Synthesis done') === true)

    // GH #592 FIXED (plan-runner.ts's `drainStepTurn`) — a genuinely THROWN step dispatch now folds into the
    // SAME failed-tier a transport-composed `error` meta-line already gets: the run COMPLETES, all K+2
    // dispatches happen in order (compare the "error meta-line" test above — byte-for-byte the same shape).
    expect(calls.length).toBe(4)
    expect(calls[2]!.text).toContain('plan step "a"')
    expect(calls[2]!.text).toContain('failed')

    expect(narrationLabel('plan-step:a'), 'a thrown step group closes failed, never stranded').toBe('Step "a" — Failed')
    expect(narrationLabel('plan-step:b')).toBe('Step "b" — Done')
    expect(narrationLabel('plan-synthesis'), 'a synthesis dispatch after a thrown step still reaches done').toBe('Synthesis — Done')

    const canvasText = document.querySelector("ui-surface-host [data-part='surface']")?.textContent ?? ''
    expect(canvasText).toContain('B done')
    expect(canvasText).toContain('Synthesis done')

    await waitUntil(() => !composerBusy())
  })

  it('gate ON: the PLAN-REQUEST turn itself throwing is still the ONE TRUE ABORT (SPEC-R22 tier 1) — the page\'s defensive catch still owns this leg, unchanged by the GH #592 fix', async () => {
    __setPlannerEnabledForTest(true)
    const calls: number[] = []
    __setTransportForTest(
      scriptedTransport((turn) => {
        calls.push(turn)
        throw new Error('plan-request transport fault') // turn 1 — before consumption, before any group seeds
      }),
    )

    await sendIntent('a plan request that never even starts')
    await waitUntil(() => chatMessages('system').some((m) => m.textContent?.includes('plan-request transport fault')))

    // Nothing ran, nothing was consumed (SPEC-R22: "the plan turn's own failure is the one true abort") —
    // `runPlan` was never reached, so no group was ever seeded; the page's defensive not-run-closing loop
    // is a no-op here (empty `groupState`), composing cleanly with the upstream fix rather than duplicating it.
    expect(calls).toEqual([1])
    expect(narrationLabel('plan-error')).toContain('plan-request transport fault')
    expect(chatMessages('system').some((m) => m.textContent?.includes('plan-request transport fault'))).toBe(true)

    await waitUntil(() => !composerBusy())
  })

  it('gate ON: an ask declared on a step turn degrades to its prose note — no ask bubble mounts, the run proceeds uninterrupted', async () => {
    __setPlannerEnabledForTest(true)
    const calls: number[] = []
    __setTransportForTest(
      scriptedTransport((turn) => {
        calls.push(turn)
        if (turn === 1) return [metaLine({ plan: { steps: [{ id: 'a', description: 'Do A' }] } })]
        if (turn === 2) return [metaLine({ note: 'Pick A or B?', ask: { surfaceId: 'ask-inline' } }), ...surfaceLines('ask-inline', 'Pick A or B?')]
        return surfaceLines('final', 'Synthesis done')
      }),
    )

    await sendIntent('plan that asks mid-step')
    await waitUntil(() => document.querySelector("ui-surface-host [data-part='surface']")?.textContent?.includes('Synthesis done') === true)

    // SPEC-R21 "Asks during a run" — NO per-ask createRenderer() host, no pending lifecycle entry.
    expect(askBubble('ask-inline'), 'a runner-dispatched ask is NEVER mounted as a pending ask').toBeNull()
    // The note-standalone rule (SPEC-R6) — the question survives as ordinary prose on this page too.
    expect(chatMessages('agent').some((m) => m.textContent?.includes('Pick A or B?'))).toBe(true)
    // The run proceeded uninterrupted: plan + step "a" + synthesis, all three dispatches happened.
    expect(calls).toEqual([1, 2, 3])
    expect(narrationLabel('plan-step:a')).toBe('Step "a" — Done')
    expect(narrationLabel('plan-synthesis')).toBe('Synthesis — Done')

    await waitUntil(() => !composerBusy())
  })

  it('gate ON: mid-run, a second submit ATTEMPT never reaches the transport or the chat log — suppression proven by the attempt, not just the [busy] attribute', async () => {
    __setPlannerEnabledForTest(true)
    const stepAGate = deferred<string[]>()
    const calls: number[] = []
    __setTransportForTest(
      scriptedTransport((turn) => {
        calls.push(turn)
        if (turn === 1) return [metaLine({ plan: { steps: [{ id: 'a', description: 'Do A' }] } })]
        if (turn === 2) return stepAGate.promise
        return surfaceLines('final', 'Synthesis done')
      }),
    )

    await sendIntent('first plan')
    // NOT bare `composerBusy()` — `setBusy(true)` is the very FIRST synchronous statement in
    // `runPlannerFlow`, so that alone races the plan turn's own dispatch. Wait for step "a" to actually be
    // RUNNING (plan dispatched, step "a" dispatched and held open) so `callsBeforeAttempt` is deterministic.
    await waitUntil(() => narrationLabel('plan-step:a') === 'Step "a" — Running…')
    const callsBeforeAttempt = calls.length
    const userMessagesBeforeAttempt = chatMessages('user').length

    // The attempted SECOND submit, while the first run is still in flight (step "a" held open).
    await sendIntent('a second prompt, mid-run')
    // Give any (wrongly) queued microtask a chance to run before asserting nothing happened.
    await new Promise((r) => setTimeout(r, 0))

    expect(calls.length, 'the attempted second submit must never reach the transport — no third dispatch').toBe(callsBeforeAttempt)
    expect(chatMessages('user').length, 'the attempted second submit must never even post its own chat message').toBe(userMessagesBeforeAttempt)

    stepAGate.resolve(surfaceLines('surf-a', 'A done'))
    await waitUntil(() => document.querySelector("ui-surface-host [data-part='surface']")?.textContent?.includes('Synthesis done') === true)
    expect(calls).toEqual([1, 2, 3])
    await waitUntil(() => !composerBusy())
  })
})
