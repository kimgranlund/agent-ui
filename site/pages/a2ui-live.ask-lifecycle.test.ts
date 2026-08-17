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
// This modernization (ADR-0146 F1, GH #239/ADR-0159) — the closed live-turn progress vocabulary, imported
// TYPE-ONLY the SAME way a2ui-live.ts itself does (it erases at build; meta-line.ts's own file-header
// precedent). `agent-runtime.ts` re-exports the OTHER meta-line types (TurnTrace/A2uiMetaEnvelope/
// AskDeclaration) but not this one, so this test goes straight to the owning subpath.
import type { TurnProgress } from '@agent-ui/a2ui/agent/meta-line'

// `a2ui-live.ts`'s test-only injection seam — bound in `beforeAll` below via a DEFERRED (dynamic) import,
// never a static one; see the comment there for why ordering is load-bearing here. The optional second arg
// (GH #408) declares which backbone the injected stub STANDS FOR; every call below that omits it gets the
// recorded default, exactly as before.
let __setTransportForTest: (next: AgentTransport, live?: boolean) => void

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
 * importing `formatMetaLine` (a `src/agent/produce.ts`-private helper) since the wire shape is tiny and
 * public (`readMetaLine`'s own contract, re-exported by `agent-runtime.ts`). `progress` is an ADDITIVE
 * optional field (this modernization, ADR-0146 F1) — every existing call site above omits it and is
 * byte-unaffected. `error` (GH #144/#408) is the transport-composed TERMINAL failure field, the same shape
 * `formatErrorLine` composes on the wire. */
function metaLine(fields: { note?: string; ask?: { surfaceId: string }; progress?: TurnProgress; error?: string }): string {
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

// ── this modernization's own helpers (ADR-0146 F1, GH #239/ADR-0159) — a2ui-live keeps every turn's own
// narration strip as VISIBLE history in the log (never removed, mirroring the ask/message bubble
// discipline), so a multi-turn scenario reads the LAST one (the conversation.test.ts "read the LAST one,
// not the first" precedent, promoted here).
function lastNarrationStrip(): HTMLElement | null {
  const strips = document.querySelectorAll<HTMLElement>('.chat-log .narration-strip')
  return strips.length > 0 ? strips[strips.length - 1]! : null
}
function narrationLabel(key: string): string | null | undefined {
  return lastNarrationStrip()?.querySelector(`[data-key="${key}"] [data-role="label"]`)?.textContent
}

async function sendIntent(text: string): Promise<void> {
  const editor = document.querySelector('.chat-composer [data-part="editor"]') as HTMLElement
  editor.textContent = text
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  // `[data-part="send"]`, not the bare `ui-button` descendant selector (the a2ui-chat.browser.test.ts
  // code-reviewer BLOCKER finding, promoted here): `ui-conversation-composer`'s hidden mic button sits
  // BEFORE send in DOM order, so a bare `ui-button` match resolves to the wrong (inert) button.
  const sendBtn = document.querySelector('.chat-composer [data-part="send"]') as HTMLElement
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
    // ADR-0196 (supersedes the original blanket-inert leg): an ANSWERED ask SETTLES — never inert (the
    // Edit-anchor law needs a live anchor), controls carry answered=true, and the annotation is the
    // compact summary row + Edit affordance.
    // NON-VACUOUS form (a2ui-mechanism review, GH #1065): jsdom's `inert` is an expando that never
    // reflects to the attribute — assert the expando's absence, not the attribute's.
    expect((bubble as HTMLElement & { inert?: boolean }).inert, 'an answered ask settles — it must NOT go inert (ADR-0196 cl.4)').toBeUndefined()
    expect((bubble.querySelector('ui-radio-group') as HTMLElement & { answered?: boolean }).answered).toBe(true)
    expect(bubble.querySelector('.ask-settle-summary')?.textContent).toBe('Answered — Plan A.')
    expect(bubble.querySelector('button.ask-edit')?.textContent).toBe('Edit')

    // The round trip: turn 2 was framed as a CLIENT input carrying the ask's action + its full data model
    // (`sendDataModel`, ADR-0097 §1) — the existing action arm, zero round-trip extension.
    expect(capturedTurn2Input?.kind).toBe('client')
    const message = (capturedTurn2Input as { kind: 'client'; message: A2uiActionMessage }).message
    expect(message.action.surfaceId).toBe('ask-1')
    expect(message.action.dataModel).toEqual({ choice: 'A' })

    // And the agent's turn-2 response rendered into the shared canvas (the conversation genuinely continued).
    await waitUntil(() => document.querySelector("ui-surface-host [data-part='surface']")?.textContent?.includes('Got it.') === true)
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
    expect(document.querySelector("ui-surface-host [data-part='surface']")?.textContent, 'the stale line must NEVER reach the canvas').not.toContain('STALE-MARKER-XYZ')
    expect(jsonTabText(), 'a dropped line is never ingested anywhere — not even the JSON tab').not.toContain('STALE-MARKER-XYZ')
  })
})

// ── this modernization (ADR-0146 F1, GH #239/ADR-0159) — the standalone narration strip routes REAL
// `progress` meta-lines a2ui-live used to drop entirely (the removed "this canvas page has no narration
// strip to route progress INTO" comment). Promoted 1:1 from conversation.ts's own GH #238/#239 jsdom
// coverage (conversation.test.ts's "done-form labels stamp on the settle transition" describe block) —
// same closed label table, same key/settle discipline — proven here against a2ui-live's OWN standalone
// `<ui-status-stream>` instead of `<ui-conversation>`'s internally-composed one (ADR-0129 Fork B: a2ui-live
// never adopts `<ui-conversation>`). The ask-freeze/askRegistry machinery above is completely untouched by
// this describe block — it exercises a DIFFERENT turn-loop leg (the progress meta-line arm), never the ask
// buffering/collision code.
describe('a2ui-live narration (this modernization) — the standalone ui-status-stream routes real progress meta-lines', () => {
  it('a progress stage narrates live, then settles to its done form as the next stage begins — "Validating…" → "Validated"', async () => {
    __setTransportForTest(
      scriptedTransport((turn) =>
        turn === 1
          ? [
              metaLine({ progress: { stage: 'validating' } }),
              metaLine({ progress: { stage: 'content' } }),
              metaLine({ progress: { stage: 'done' }, note: 'Here you go.' }),
              '{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"agent-ui"}}',
              '{"version":"v1.0","updateComponents":{"surfaceId":"s1","components":[{"id":"root","component":"Text","text":"hi"}]}}',
            ]
          : [],
      ),
    )

    await sendIntent('build something')
    await waitUntil(() => narrationLabel('progress-validating') === 'Validated')

    expect(narrationLabel('progress-validating'), 'the done checkmark never wears an "-ing…" label again').toBe('Validated')
    expect(narrationLabel('progress-content'), 'the last live stage before "done" also settles to its done form').toBe('Wrote the response')
  })

  it('the factual retry/tool suffix rides BOTH forms of the pair: "Self-correcting… (round 2)" settles to "Self-corrected (round 2)"', async () => {
    __setTransportForTest(
      scriptedTransport((turn) =>
        turn === 1
          ? [
              metaLine({ progress: { stage: 'retry', round: 2 } }),
              metaLine({ progress: { stage: 'tool', detail: 'fetch' } }),
              metaLine({ progress: { stage: 'done' }, note: 'Done.' }),
            ]
          : [],
      ),
    )

    await sendIntent('try again')
    await waitUntil(() => narrationLabel('progress-tool-fetch') === 'Ran an integration (fetch)')

    expect(narrationLabel('progress-retry-2'), 'the composed round ordinal survives the settle').toBe('Self-corrected (round 2)')
    expect(narrationLabel('progress-tool-fetch')).toBe('Ran an integration (fetch)')
  })

  it('a turn that throws mid-stream truncates narration with a visible error entry, forcing the header to error (ADR-0146 F8) — the SAME fail() path conversation.ts\'s own composed strip uses', async () => {
    __setTransportForTest(
      scriptedTransport((turn) => {
        if (turn === 1) throw new Error('ProduceHalt: exhausted self-correct rounds')
        return []
      }),
    )

    await sendIntent('anything')
    await waitUntil(() => (lastNarrationStrip()?.querySelector('[data-part="header"]')?.getAttribute('data-status') ?? '') === 'error')

    const strip = lastNarrationStrip()!
    expect(strip.querySelector('[data-key="progress-error"] [data-role="label"]')?.textContent, 'a visible, factual error entry — never a silently torn stream').toContain('Turn failed')
    expect(chatMessages('system').some((m) => m.textContent?.includes('⚠')), 'the existing system-bubble failure path is unaffected').toBe(true)
  })
})

// ── GH #239/ADR-0159 — the receipt pattern is UNCONDITIONAL on a2ui-live's standalone stream (item 3 of
// this task): the SAME two opt-in props `agent-admin.ts` sets on its conversation-owned strip
// (`conversation.receipt = true`), set directly on this standalone instance instead — proving the props
// belong to `ui-status-stream` itself, not to `<ui-conversation>`, exactly as ADR-0159 documents.
describe('a2ui-live narration — the receipt pattern (GH #239/ADR-0159) on the standalone stream', () => {
  it('every fresh turn narration strip carries oneline + receipt + the ADR-0146 F8 header, unconditionally', async () => {
    __setTransportForTest(scriptedTransport(() => []))
    await sendIntent('hello')
    await waitUntil(() => lastNarrationStrip() !== null)

    const strip = lastNarrationStrip()!
    expect(strip.hasAttribute('oneline'), 'the live one-morphing-line mode').toBe(true)
    expect(strip.hasAttribute('receipt'), 'the terminal one-line receipt').toBe(true)
    expect(strip.hasAttribute('header'), 'the ADR-0146 F8 header opt-in').toBe(true)
  })

  it('a settled turn with zero narrated steps still collapses to the receipt line — fail-closed, never fabricates progress that never happened', async () => {
    __setTransportForTest(scriptedTransport(() => []))
    await sendIntent('hello')
    await waitUntil(() => lastNarrationStrip() !== null)

    const header = () => lastNarrationStrip()!.querySelector('[data-part="header"]')
    await waitUntil(() => header()?.getAttribute('aria-expanded') === 'false')
    expect(header()?.getAttribute('data-status'), 'finalized with zero entries reads the neutral escalation, never a fabricated status').toBe('')
  })
})

// ── GH #408 — the terminal error meta-line + the transport-honest empty turn ─────────────────────────────
// A proxy whose stream headers already committed 200 reports a `ProduceHalt`/upstream fault as ONE terminal
// `{"a2uiMeta":{"error":…}}` line (`formatErrorLine`, meta-line.ts). It PARSES cleanly — it is a valid
// meta-line, never a malformed one — so the consume loop's own `if (meta) … continue` used to drop it with
// zero telemetry: the async generator then completed NORMALLY (nothing throws client-side, so the catch
// block never ran), the turn held zero lines, and the page printed the RECORDED transcript's exhaustion
// message over a live failure. These assertions pin both halves of the fix: the error becomes visible, and
// the exhaustion wording is reserved for the transport that actually has a transcript.
// The `.some(...)` predicates below are deliberate (never `.at(-1)`): `resetPage()` in `beforeEach` kicks a
// real async `wireLiveOverlay()` probe whose own fallback system message can land at any moment.
describe('a2ui-live — a terminal transport error is VISIBLE, and the exhaustion message is transport-honest (GH #408)', () => {
  const HALT = 'Live agent failed: exhausted 3 self-correct rounds without a valid surface.'

  it("a terminal error meta-line surfaces as a ⚠ system message + a failed narration — never the recorded transcript's exhaustion message", async () => {
    __setTransportForTest(scriptedTransport(() => [metaLine({ error: HALT })]), true)

    await sendIntent('build me a blackjack table')
    await waitUntil(() => chatMessages('system').some((m) => m.textContent?.includes('⚠')))

    expect(chatMessages('system').some((m) => m.textContent?.includes(HALT)), "the transport's own reason, shown verbatim").toBe(true)
    await waitUntil(() => (lastNarrationStrip()?.querySelector('[data-part="header"]')?.getAttribute('data-status') ?? '') === 'error')
    expect(
      lastNarrationStrip()!.querySelector('[data-key="progress-error"] [data-role="label"]')?.textContent,
      'the same visible error entry a client-thrown turn gets — never a green-reading strip over a failed turn',
    ).toContain('Turn failed')
    expect(chatMessages('system').some((m) => /no further turns|recorded transcript/i.test(m.textContent ?? '')), 'the misdiagnosis this issue is about').toBe(false)
  })

  it('a LIVE turn that produced nothing at all (no error line) says exactly that — never "no further turns in this recorded transcript"', async () => {
    __setTransportForTest(scriptedTransport(() => []), true)

    await sendIntent('anything')
    await waitUntil(() => chatMessages('system').some((m) => /produced no renderable output/i.test(m.textContent ?? '')))

    expect(chatMessages('system').some((m) => /recorded transcript/i.test(m.textContent ?? '')), 'a live transport has no transcript to exhaust').toBe(false)
  })

  it('negative control: the RECORDED backbone keeps the exhaustion message byte-identical', async () => {
    __setTransportForTest(scriptedTransport(() => [])) // `live` omitted ⇒ recorded, the pre-#408 default

    await sendIntent('anything')
    await waitUntil(() => chatMessages('system').some((m) => m.textContent?.includes('The agent has no further turns in this recorded transcript. Reset to start over.')))

    expect(chatMessages('system').some((m) => /produced no renderable output/i.test(m.textContent ?? '')), 'the live wording never reaches the recorded backbone').toBe(false)
  })
})

// ════════════════ ADR-0196 (GH #1065) — the questionnaire card's settle/edit-amend flow ═════════════════
// The answered card settles (summary + Edit, options collapsed via CSS — the DOM stays, the Edit-anchor
// law); Edit re-opens; a CHANGED re-commit appends the "Changed: X → Y" amendment turn (a plain user turn
// the agent reconciles forward); a SAME-answer re-commit appends nothing — the card simply re-settles.
describe('a2ui-live — ADR-0196 settle/edit-amend (GH #1065)', () => {
  it('Edit re-opens; a changed re-commit appends the amendment turn; a same-answer re-commit appends nothing', async () => {
    const turnInputs: TurnInput[] = []
    __setTransportForTest(
      scriptedTransport((turn, input) => {
        turnInputs.push(input)
        if (turn === 1) return [metaLine({ note: 'Plan A or Plan B?', ask: { surfaceId: 'ask-1' } }), ...askAskOneLines('ask-1')]
        return []
      }),
    )

    await sendIntent('help me decide')
    await waitUntil(() => !!askBubble('ask-1')?.querySelector('ui-button'))
    ;(askBubble('ask-1')!.querySelector('ui-button') as HTMLElement).click()
    await waitUntil(() => askBubble('ask-1')?.dataset.state === 'answered')
    const bubble = askBubble('ask-1')!
    const group = bubble.querySelector('ui-radio-group') as HTMLElement & { answered?: boolean }
    expect(group.answered, 'settling sets the ADR-0196 answered prop').toBe(true)
    expect(bubble.querySelector('.ask-settle-summary')?.textContent).toBe('Answered — Plan A.')

    // ── Edit re-opens: answered clears for the edit's duration, data-editing re-expands the options ──
    ;(bubble.querySelector('button.ask-edit') as HTMLElement).click()
    expect(bubble.dataset.editing, 'Edit marks the bubble as editing').toBeDefined()
    expect(group.answered, 'Edit clears answered on the controls for the duration of the edit').toBe(false)

    // ── A CHANGED answer (Plan A → Plan B), re-committed via the card's own Confirm ──────────────────
    const optB = [...bubble.querySelectorAll<HTMLElement>('ui-radio')].find((r) => r.textContent?.includes('Plan B'))!
    optB.click()
    await waitUntil(() => optB.hasAttribute('checked'))
    const turnsBeforeAmend = turnInputs.length
    ;(bubble.querySelector('ui-button') as HTMLElement).click()
    await waitUntil(() => chatMessages('user').some((m) => m.textContent?.includes('Changed: Plan A → Plan B')))
    await waitUntil(() => turnInputs.length === turnsBeforeAmend + 1)
    const amend = turnInputs[turnInputs.length - 1]!
    expect(amend.kind, 'the amendment is a plain USER turn, reconciled forward — never an action replay').toBe('intent')
    expect((amend as { kind: 'intent'; text: string }).text).toContain('Changed: Plan A → Plan B')
    // …and the card RE-settled to the updated answer.
    expect(bubble.dataset.editing).toBeUndefined()
    expect(group.answered).toBe(true)
    expect(bubble.querySelector('.ask-settle-summary')?.textContent).toBe('Answered — Plan B.')
    expect(bubble.dataset.state, 'the entry stays frozen for line-routing — prior turns are never rewritten').toBe('answered')

    // ── A SAME-answer re-commit appends NOTHING: no user turn, no transport turn, just a re-settle ────
    ;(bubble.querySelector('button.ask-edit') as HTMLElement).click()
    const userMessagesBefore = chatMessages('user').length
    const turnsBefore = turnInputs.length
    ;(bubble.querySelector('ui-button') as HTMLElement).click()
    await waitUntil(() => askBubble('ask-1')?.dataset.editing === undefined)
    expect(chatMessages('user').length, 're-confirming the same answer appends no user turn').toBe(userMessagesBefore)
    expect(turnInputs.length, 're-confirming the same answer dispatches no transport turn').toBe(turnsBefore)
    expect(group.answered).toBe(true)
  })
})
