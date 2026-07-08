// a2ui-live.ask-lifecycle.test.ts — post-ship independent-review follow-up (findings 2 + 3 on the just-landed
// ADR-0097 feed-embedded-asks build). SPEC §6 named this exact gap: the ~85 lines of NEW ask orchestration
// `a2ui-live.ts` gained (ask-line buffering, collision/fail-closed resolution, freeze ordering, dataModel-
// carrying dispatch) had NO page-level test, because the page's `transport` binding is module-private — only
// `wireLiveOverlay()` (the real, dev-only live-key probe) ever reassigns it. This drives the REAL page module
// (side-effect import, the `a2ui-live-conversation.browser.test.ts` precedent) end to end through a SCRIPTED
// stub `AgentTransport` injected via the new test-only seam (`__setTransportForTest`, a2ui-live.ts) — no key,
// no live model, jsdom-covered (the ADR-0097 build's own `ask-registry.test.ts` precedent: what jsdom CAN
// prove faithfully — DOM state/attribute mutation, dispatch, real custom-element behavior — not real `inert`
// tab-order/focus semantics, which `ask-registry.browser.test.ts` already covers in a real engine).
//
// Finding 3's regression leg (the "one-turn-late frozen-drop" gap) lives in the LAST describe block below.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { AgentTransport, TurnInput } from '../lib/agent-runtime.ts'
import type { A2uiActionMessage } from '@agent-ui/a2ui'

// `a2ui-live.ts`'s test-only injection seam — bound in `beforeAll` below via a DEFERRED (dynamic) import,
// never a static one; see the comment there for why ordering is load-bearing here.
let __setTransportForTest: (next: AgentTransport) => void

beforeAll(async () => {
  // jsdom reality (the `a2ui-gallery.test.ts`/`provider-switcher.test.ts` precedent): `ElementInternals.
  // setFormValue`/`setValidity` are ABSENT in jsdom, and this suite mounts REAL default-catalog form
  // controls (RadioGroup + Radio, for the ask's own commit surface) through the REAL renderer, which builds
  // each via `document.createElement(tag)` with no per-instance hook available. Stub ONCE at the shared
  // prototype — additive, a no-op if a future jsdom ships the real method.
  if (typeof ElementInternals.prototype.setFormValue !== 'function') {
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
  }
  // A DEFERRED import, deliberately not a static `import './a2ui-live.ts'` at the top of this file: static
  // imports are hoisted and evaluate BEFORE any of this module's own top-level code, including the stub
  // above — and `a2ui-live.ts`'s OWN module-scope code eagerly builds + connects the chat composer's real
  // `ui-text-field` (itself form-associated) as a side effect of import, well before any `it()` runs. A
  // static import would race the stub and reproduce the same "ElementInternals.setFormValue is not a
  // function" fault on the composer field itself. The dynamic `import()` here runs the page module only
  // AFTER the stub above has already landed, side-effects included (mounts the real live-agent page — the
  // `a2ui-live-conversation.browser.test.ts` precedent, just deferred to test-run time).
  const mod = await import('./a2ui-live.ts')
  __setTransportForTest = mod.__setTransportForTest
})

// ── scripting helpers ───────────────────────────────────────────────────────────────────────────────────

/** The reserved leading meta-line envelope (ADR-0088 §1 / ADR-0097 §1) — hand-built here rather than
 * importing `formatMetaLine` (a `tools/agent/produce.ts`-private helper) since the wire shape is tiny and
 * public (`readMetaLine`'s own contract, re-exported by `agent-runtime.ts`). */
function metaLine(fields: { note?: string; ask?: { surfaceId: string } }): string {
  return JSON.stringify({ a2uiMeta: fields })
}

/** A per-turn scripted `AgentTransport`: `byTurn(turnIndex, input)` returns the raw lines turn `turnIndex`
 * emits, or THROWS to simulate a `ProduceHalt`/transport error on that turn (never reaching any `yield`). */
function scriptedTransport(byTurn: (turnIndex: number, input: TurnInput) => string[]): AgentTransport {
  let turnIndex = 0
  return {
    async *turn(input: TurnInput): AsyncIterable<string> {
      turnIndex += 1
      const lines = byTurn(turnIndex, input) // may throw — the ProduceHalt/transport-error leg depends on this
      for (const line of lines) yield line
    },
  }
}

async function waitUntil(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now()
  for (;;) {
    if (predicate()) return
    if (Date.now() - start > timeoutMs) throw new Error('waitUntil: condition never became true within the timeout')
    await new Promise((r) => setTimeout(r, 0))
  }
}

function chatMessages(role: 'user' | 'agent' | 'system'): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.chat-log .msg')].filter((m) => m.dataset.role === role)
}

function askBubble(surfaceId: string): HTMLElement | null {
  return document.querySelector(`.msg[data-ask="${surfaceId}"]`)
}

async function sendIntent(text: string): Promise<void> {
  const editor = document.querySelector('.chat-composer [data-part="editor"]') as HTMLElement
  editor.textContent = text
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  const sendBtn = document.querySelector('.chat-composer ui-button') as HTMLElement
  sendBtn.click()
}

function resetPage(): void {
  const resetBtn = [...document.querySelectorAll<HTMLElement>('ui-button')].find((b) => b.textContent?.trim() === 'Reset')
  resetBtn?.click()
}

/** The JSON tab's rendered text (`shown ≡ produced`, SPEC-R10) — the 2nd `ui-tab-panel` by DOM order
 * (canvas · json · html, `a2ui-live.ts`'s own append order), read regardless of the `hidden` attribute. */
function jsonTabText(): string {
  const panel = document.querySelectorAll('.canvas-tabs ui-tab-panel')[1] as HTMLElement | undefined
  return panel?.textContent ?? ''
}

// A minimal, real, feed-in-scope ask surface: a Column of a question Text, a data-bound RadioGroup (two
// Radio options, preselected via updateDataModel) and one commit Button (`wantResponse` omitted — the
// ADR-0097 §4 mechanics spine) — the "closed single-choice" archetype (ADR-0097 Decision §4).
function askAskOneLines(surfaceId: string): string[] {
  return [
    `{"version":"v1.0","createSurface":{"surfaceId":"${surfaceId}","catalogId":"agent-ui","sendDataModel":true}}`,
    `{"version":"v1.0","updateComponents":{"surfaceId":"${surfaceId}","components":[` +
      `{"id":"root","component":"Column","children":["q","choice","commit"]},` +
      `{"id":"q","component":"Text","text":"Plan A or Plan B?"},` +
      `{"id":"choice","component":"RadioGroup","value":{"path":"/choice"},"children":["optA","optB"]},` +
      `{"id":"optA","component":"Radio","value":"A","label":"Plan A"},` +
      `{"id":"optB","component":"Radio","value":"B","label":"Plan B"},` +
      `{"id":"commit","component":"Button","label":"Confirm","action":{"action":"confirm"}}` +
      `]}}`,
    `{"version":"v1.0","updateDataModel":{"surfaceId":"${surfaceId}","path":"/choice","value":"A"}}`,
  ]
}

beforeEach(() => {
  resetPage()
})

describe('a2ui-live ask lifecycle (ADR-0097 §2, post-ship review finding 2) — a scripted transport drives the REAL page', () => {
  it('a valid feed-types ask renders inline, mounted, and interactive (pending — no data-state, not inert)', async () => {
    __setTransportForTest(
      scriptedTransport((turn) => (turn === 1 ? [metaLine({ note: 'Plan A or Plan B?', ask: { surfaceId: 'ask-1' } }), ...askAskOneLines('ask-1')] : [])),
    )

    await sendIntent('help me decide')
    await waitUntil(() => askBubble('ask-1') !== null)

    const bubble = askBubble('ask-1')!
    expect(bubble.querySelector('ui-button'), 'the ask must be a REAL, clickable createRenderer()-hosted control tree').not.toBeNull()
    expect(bubble.querySelector('ui-radio-group')).not.toBeNull()
    expect(bubble.dataset.state, 'a fresh ask has no data-state yet — pending is the ABSENCE of the attribute').toBeUndefined()
    // jsdom does not implement the `inert` IDL attribute's default (an un-set `.inert` reads `undefined`,
    // not the spec's `false` — the `ask-registry.test.ts` precedent); assert the ATTRIBUTE instead, which
    // `freeze()` is the only thing that ever sets.
    expect(bubble.hasAttribute('inert'), 'a pending ask must stay interactive (no inert attribute yet)').toBe(false)
    expect(
      chatMessages('agent').some((m) => m.textContent?.includes('Plan A or Plan B?')),
      'the note-standalone rule: the question must ALSO show as prose in the chat',
    ).toBe(true)
  })

  it("answering the ask freezes it 'answered', is inert, annotated, and the commit dispatches a turn carrying the ask surface's data model", async () => {
    let capturedTurn2Input: TurnInput | undefined
    __setTransportForTest(
      scriptedTransport((turn, input) => {
        if (turn === 1) return [metaLine({ note: 'Plan A or Plan B?', ask: { surfaceId: 'ask-1' } }), ...askAskOneLines('ask-1')]
        capturedTurn2Input = input
        return [
          '{"version":"v1.0","createSurface":{"surfaceId":"confirm","catalogId":"agent-ui"}}',
          '{"version":"v1.0","updateComponents":{"surfaceId":"confirm","components":[{"id":"root","component":"Text","text":"Got it."}]}}',
        ]
      }),
    )

    await sendIntent('help me decide')
    // NOTE: `!!(x?.y)`, never `x?.y !== null` — optional chaining short-circuits to `undefined`, and
    // `undefined !== null` is `true`, so that comparison would be vacuously satisfied before the bubble
    // even exists.
    await waitUntil(() => !!askBubble('ask-1')?.querySelector('ui-button'))
    ;(askBubble('ask-1')!.querySelector('ui-button') as HTMLElement).click()

    await waitUntil(() => askBubble('ask-1')?.dataset.state === 'answered')
    const bubble = askBubble('ask-1')!
    expect(bubble.inert, 'a frozen ask must be inert').toBe(true)
    expect(bubble.querySelector('.ask-annotation')?.textContent).toBe('Answered.')

    // The round trip: turn 2 was framed as a CLIENT input carrying the ask's action + its full data model
    // (`sendDataModel`, ADR-0097 §1) — the existing action arm, zero round-trip extension.
    expect(capturedTurn2Input?.kind).toBe('client')
    const message = (capturedTurn2Input as { kind: 'client'; message: A2uiActionMessage }).message
    expect(message.action.surfaceId).toBe('ask-1')
    expect(message.action.dataModel).toEqual({ choice: 'A' })

    // And the agent's turn-2 response rendered into the shared canvas (the conversation genuinely continued).
    await waitUntil(() => document.querySelector('.canvas-surface')?.textContent?.includes('Got it.') === true)
  })

  it('a DIFFERENT turn (typed prose) freezes the pending ask "bypassed", not "answered"', async () => {
    __setTransportForTest(
      scriptedTransport((turn) =>
        turn === 1
          ? [metaLine({ note: 'Plan A or Plan B?', ask: { surfaceId: 'ask-1' } }), ...askAskOneLines('ask-1')]
          : ['{"version":"v1.0","createSurface":{"surfaceId":"aside","catalogId":"agent-ui"}}',
             '{"version":"v1.0","updateComponents":{"surfaceId":"aside","components":[{"id":"root","component":"Text","text":"Sure."}]}}'],
      ),
    )

    await sendIntent('help me decide')
    await waitUntil(() => askBubble('ask-1') !== null)

    await sendIntent("actually, let's talk about something else")
    await waitUntil(() => askBubble('ask-1')?.dataset.state !== undefined)

    expect(askBubble('ask-1')?.dataset.state).toBe('bypassed')
    expect(askBubble('ask-1')!.querySelector('.ask-annotation')?.textContent).toBe('No longer pending — the conversation moved on.')
  })

  it('a ProduceHalt/transport error on the freezing turn leaves the prior pending ask pending and interactive', async () => {
    __setTransportForTest(
      scriptedTransport((turn) => {
        if (turn === 1) return [metaLine({ note: 'Plan A or Plan B?', ask: { surfaceId: 'ask-1' } }), ...askAskOneLines('ask-1')]
        throw new Error('ProduceHalt: exhausted self-correct rounds')
      }),
    )

    await sendIntent('help me decide')
    await waitUntil(() => askBubble('ask-1') !== null)

    await sendIntent('actually, tell me a joke') // turn 2 throws
    await waitUntil(() => chatMessages('system').some((m) => m.textContent?.includes('⚠')))

    const bubble = askBubble('ask-1')!
    expect(bubble.dataset.state, 'a failed turn must NOT freeze the prior pending ask').toBeUndefined()
    expect(bubble.hasAttribute('inert'), 'a failed turn must NOT freeze — still interactive').toBe(false)
  })

  it('an out-of-scope ask payload (Modal) fail-closed-drops to the note: no ask bubble, note still shown, lines still reach the JSON tab', async () => {
    __setTransportForTest(
      scriptedTransport((turn) =>
        turn === 1
          ? [
              metaLine({ note: 'Want a walkthrough modal?', ask: { surfaceId: 'ask-bad' } }),
              '{"version":"v1.0","createSurface":{"surfaceId":"ask-bad","catalogId":"agent-ui","sendDataModel":true}}',
              '{"version":"v1.0","updateComponents":{"surfaceId":"ask-bad","components":[{"id":"root","component":"Modal","children":["t"]},{"id":"t","component":"Text","text":"hi"}]}}',
            ]
          : [],
      ),
    )

    await sendIntent('walk me through it')
    await waitUntil(() => chatMessages('agent').some((m) => m.textContent?.includes('Want a walkthrough modal?')))

    expect(askBubble('ask-bad'), 'an out-of-scope ask must render NO bubble at all').toBeNull()
    expect(jsonTabText(), 'shown ≡ produced: the JSON tab must still show what the agent actually emitted').toContain('Modal')
  })

  it('Reset disposes every ask host and clears the registry — no ask bubble survives', async () => {
    __setTransportForTest(scriptedTransport((turn) => (turn === 1 ? [metaLine({ note: 'Plan A or Plan B?', ask: { surfaceId: 'ask-1' } }), ...askAskOneLines('ask-1')] : [])))

    await sendIntent('help me decide')
    await waitUntil(() => askBubble('ask-1') !== null)

    resetPage()
    await waitUntil(() => chatMessages('system').some((m) => m.textContent?.includes('New conversation')))
    expect(document.querySelectorAll('.msg[data-ask]')).toHaveLength(0)
  })
})

// ── Finding 3: the one-turn-late frozen-drop gap ────────────────────────────────────────────────────────
// Completion-freeze (SPEC-R8/ADR-0097 §2) means a pending ask is still `pending` — not yet `frozen` — for
// the WHOLE DURATION of the very turn that is about to freeze it (freeze fires only AFTER that turn
// completes). A stale/rogue line aimed at that still-pending ask's surfaceId, arriving mid-stream during
// THAT turn, used to pass the old `isFrozen()`-only check and mis-route into the shared canvas host. The
// fix drops any line targeting an ask-REGISTRY-KNOWN surface (pending OR frozen) that is not the CURRENT
// turn's own ask.
describe('a2ui-live — finding 3: a stale line targeting a still-PENDING (not yet frozen) ask is dropped, never mis-routed to canvas', () => {
  it('a rogue canvas-routed line reusing the pending ask\'s surfaceId never reaches the canvas, even before that turn freezes it', async () => {
    __setTransportForTest(
      scriptedTransport((turn) => {
        if (turn === 1) return [metaLine({ note: 'Plan A or Plan B?', ask: { surfaceId: 'ask-1' } }), ...askAskOneLines('ask-1')]
        // Turn 2 (a typed prose reply — a "bypass" turn per ADR-0097 §2) carries NO `ask` of its own, but
        // ROGUE-ly emits a plain canvas line reusing 'ask-1' — the id of the ask that is, at this exact
        // moment, still `pending` (freeze happens only after THIS turn completes). Pre-fix this line would
        // pass `isFrozen('ask-1') === false` and mis-route into the canvas host.
        return [
          '{"version":"v1.0","createSurface":{"surfaceId":"ask-1","catalogId":"agent-ui"}}',
          '{"version":"v1.0","updateComponents":{"surfaceId":"ask-1","components":[{"id":"root","component":"Text","text":"STALE-MARKER-XYZ"}]}}',
        ]
      }),
    )

    await sendIntent('help me decide')
    await waitUntil(() => askBubble('ask-1') !== null)

    await sendIntent("actually, let's talk about something else") // turn 2 — the rogue reuse of 'ask-1'
    await waitUntil(() => askBubble('ask-1')?.dataset.state !== undefined) // the turn still completes + freezes normally

    expect(askBubble('ask-1')?.dataset.state, 'the ask itself must still freeze normally').toBe('bypassed')
    expect(document.querySelector('.canvas-surface')?.textContent, 'the stale line must NEVER reach the canvas').not.toContain('STALE-MARKER-XYZ')
    expect(jsonTabText(), 'a dropped line is never ingested anywhere — not even the JSON tab').not.toContain('STALE-MARKER-XYZ')
  })
})
