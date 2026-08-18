// a2ui-chat.test.ts — jsdom coverage for the page RE-HOSTED onto `ui-conversation` (app-surfaces-m2.spec.md
// SPEC-R9). The routing/persistent-identity rule (SPEC-R7), narration honesty (SPEC-R6), and clean recovery
// on a thrown turn (SPEC-R6 AC3) are now the PRIMITIVE's contract — proven in its own package suite
// (packages/agent-ui/app/src/controls/conversation/conversation.test.ts). This file proves the PAGE wires
// the shipped primitive correctly end to end, driven through the REAL page module (side-effect import, the
// `a2ui-live.ask-lifecycle.test.ts` precedent), replaying the real shipped 5-turn `recordedTranscript`. The
// real-engine whole-shape proof (real geometry, tail-follow, wire disclosure) lives in
// `a2ui-chat.browser.test.ts` (the "jsdom-green ≠ done" discipline).
//
// Selector idiom (site-canon dead-role guard): bubble roles (`user`/`agent`/`system`) are this page's own
// timeline roles, NOT the fleet's canonical `[data-role]` vocabulary, so they are matched via `.dataset.role`
// in JS — never embedded in a `[data-role="…"]` CSS-selector STRING the guard would statically flag (the
// `a2a-artifact-feed-live.browser.test.ts` idiom). `[data-role="label"]` (a real ui-status-stream role) is
// canonical and safe to select.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (sitemap.test.ts precedent)
import { readFileSync } from 'node:fs'
import type { AgentTransport, TurnInput } from '../lib/agent-runtime.ts'
declare const process: { cwd(): string }

// The page's test-only injection seam. The optional second arg (GH #415) declares which backbone the
// injected stub STANDS FOR; every call below that omits it gets the recorded default, exactly as before.
let __setTransportForTest: (next: AgentTransport, live?: boolean) => void

beforeAll(async () => {
  // jsdom reality (the `a2ui-live.ask-lifecycle.test.ts` precedent): `ElementInternals.setFormValue`/
  // `setValidity` are ABSENT in jsdom, and this page mounts real form-associated controls — the
  // composer's ui-buttons (its editor is the composer's OWN contenteditable part since TKT-0058, not a
  // ui-text-field) + real default-catalog controls through the real registry. Stub ONCE at the shared
  // prototype — additive.
  if (typeof ElementInternals.prototype.setFormValue !== 'function') {
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
  }
  // A DEFERRED import (never a static one at file top) — a static import is hoisted and would evaluate the
  // page module's eager side effects (mounting the real composer) BEFORE the stub above lands.
  const mod = await import('./a2ui-chat.ts')
  __setTransportForTest = mod.__setTransportForTest
})

function scriptedTransport(byTurn: (turnIndex: number, input: TurnInput) => string[]): AgentTransport {
  let turnIndex = 0
  return {
    async *turn(input: TurnInput): AsyncIterable<string> {
      turnIndex += 1
      const lines = byTurn(turnIndex, input) // may throw — the transport-error leg depends on this
      for (const line of lines) yield line
    },
  }
}

async function waitUntil(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now()
  for (;;) {
    if (predicate()) return
    if (Date.now() - start > timeoutMs) throw new Error('waitUntil: condition never became true within the timeout')
    await new Promise((r) => setTimeout(r, 0))
  }
}

function bubbles(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('ui-conversation [data-part="bubble"]')]
}
function agentBubbles(): HTMLElement[] {
  return bubbles().filter((m) => m.dataset.role === 'agent')
}
function systemBubbles(): HTMLElement[] {
  return bubbles().filter((m) => m.dataset.role === 'system')
}
// GH #1221 — Gen-UI/A2UI cards mount into `[data-part="mounts"]`, a SIBLING of the bubble under the
// owning `[data-part="turn"]` wrapper, never the bubble's own descendant anymore.
function mountsOf(bubble: HTMLElement): HTMLElement {
  return (bubble.parentElement as HTMLElement).querySelector('[data-part="mounts"]') as HTMLElement
}
function statusText(): string {
  return (document.querySelector('.chat-status') as HTMLElement | null)?.textContent ?? ''
}

/** The page's own busy signal (`shell.dataset.busy`) — the composer lives inside the primitive, so the page
 *  reflects busy on the shell. The turn loop sets it synchronously on send and clears it once the turn's
 *  transport stream is finalized; wait for genuine idle before queuing the NEXT turn. */
async function waitUntilIdle(): Promise<void> {
  const shell = document.querySelector('.chat-shell') as HTMLElement
  await waitUntil(() => shell.dataset.busy !== '1')
}

async function sendIntent(text: string): Promise<void> {
  await waitUntilIdle()
  // Scoped through `ui-conversation-composer` (TKT-0058 — the old `[data-part="composer"]` form wrapper is
  // gone; the editor is the composer's OWN part now; the scope hop keeps this clear of any
  // `[data-part="editor"]` inside an A2UI-mounted surface in the log).
  const editor = document.querySelector('ui-conversation ui-conversation-composer [data-part="editor"]') as HTMLElement
  editor.textContent = text
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  // `[data-part="send"]`, not the bare `ui-button` descendant selector (code-reviewer BLOCKER finding):
  // the composer's options row can also carry an opt-in, hidden-by-default mic button BEFORE send in DOM
  // order (the Figma chat-input refactor) — `hidden` doesn't remove an element from `querySelector`'s
  // reach, so the old selector silently picked the mic instead once one existed.
  const sendBtn = document.querySelector('ui-conversation ui-conversation-composer [data-part="send"]') as HTMLElement
  sendBtn.click()
}

function resetPage(): void {
  const resetBtn = [...document.querySelectorAll<HTMLElement>('ui-button')].find((b) => b.textContent?.trim() === 'Reset')
  resetBtn?.click()
}

beforeEach(() => {
  resetPage()
})

// The default transport (createRecordedTransport) ignores its TurnInput entirely and advances through the
// SHIPPED `recordedTranscript` (transcript.ts) sequentially — so 5 plain `sendIntent` calls play the real,
// unmodified 5-turn arc end to end (SPEC-N4: no new transcript authored).
describe('a2ui-chat routing on ui-conversation (SPEC-R7) — the real shipped 5-turn recordedTranscript', () => {
  it("turn 1 opens canvas in a fresh bubble; turn 2 opens confirmation in a fresh bubble; turns 3/4 route into confirmation's EXISTING host (no new one); turn 5 closes confirmation in place, canvas untouched throughout", async () => {
    await sendIntent('turn 1')
    await waitUntil(() => agentBubbles().length === 1)
    const bubble1 = agentBubbles()[0]!
    await waitUntil(() => mountsOf(bubble1).querySelector('ui-surface-host ui-button') !== null)

    await sendIntent('turn 2')
    await waitUntil(() => agentBubbles().length === 2)
    const bubble2 = agentBubbles()[1]!
    await waitUntil(() => bubble2.textContent?.includes('turn 2 of the conversation') === true)
    // GH #1221 — the card is a SIBLING of the bubble now (never its descendant): "turn 2's own bubble"
    // means turn 2's own TURN wrapper, so the check goes through `mountsOf`, not `bubble2` directly.
    expect(mountsOf(bubble2).querySelector('ui-surface-host ui-text'), "confirmation's Text must render into turn 2's own mounts").not.toBeNull()
    const confirmationHost = mountsOf(bubble2).querySelector('ui-surface-host')
    expect(confirmationHost).not.toBeNull()

    // Routing + persistent identity (SPEC-R7 AC1): a later turn resending against a known surfaceId routes
    // to the SAME inline ui-surface-host at its ORIGINAL turn — never a new mount for the same id.
    await sendIntent('turn 3') // updateComponents (+trailing updateDataModel) on "confirmation"
    await waitUntil(() => agentBubbles().length === 3)
    const bubble3 = agentBubbles()[2]!
    await waitUntilIdle()
    expect(
      mountsOf(bubble3)?.children.length ?? 0,
      "turn 3's OWN mounts must carry NO surface host — it routed into turn 2's",
    ).toBe(0)
    expect(mountsOf(bubble2).querySelector('ui-surface-host'), "confirmation's host must be the SAME node — never re-created").toBe(confirmationHost)
    expect(mountsOf(bubble1).querySelector('ui-surface-host ui-button'), 'canvas (turn 1) must be untouched by turn 3').not.toBeNull()

    await sendIntent('turn 4') // data-ONLY update on "confirmation"
    await waitUntil(() => agentBubbles().length === 4)
    const bubble4 = agentBubbles()[3]!
    await waitUntilIdle()
    expect(mountsOf(bubble4)?.children.length ?? 0, "turn 4's OWN mounts must also carry NO surface host").toBe(0)
    expect(mountsOf(bubble2).querySelector('ui-surface-host'), "confirmation's host is STILL the same node after turn 4").toBe(confirmationHost)

    await sendIntent('turn 5') // deleteSurface "confirmation"
    await waitUntil(() => agentBubbles().length === 5)
    await waitUntil(() => bubble2.dataset.state === 'closed')
    // GH #1221 — the "Closed." annotation now lands in `mounts`, right after the closed host itself.
    expect(mountsOf(bubble2).querySelector('[data-part="annotation"]')?.textContent).toBe('Closed.')
    expect(
      mountsOf(bubble2).querySelector('ui-surface-host ui-column, ui-surface-host ui-text'),
      "confirmation's rendered DOM must be torn down once closed",
    ).toBeNull()

    // canvas (turn 1) survives the whole arc, never annotated/closed
    expect(bubble1.dataset.state).toBeUndefined()
    expect(mountsOf(bubble1).querySelector('ui-surface-host ui-button')).not.toBeNull()
  })

  it('a sixth send past the transcript end shows the "no further turns" status notice, not a crash', async () => {
    for (let i = 0; i < 5; i++) {
      await sendIntent(`turn ${i + 1}`)
      await waitUntil(() => agentBubbles().length === i + 1)
    }
    await sendIntent('turn 6 — past the end')
    await waitUntil(() => statusText().includes('no further turns'))
  })
})

// ── narration honesty (SPEC-R6 AC1) — never a fabricated sentence ──────────────────────────────────────
// The category table (LLD-C5) PLUS the ADR-0146 F1 progress stage-label table — both closed, code-owned,
// never model text. The recorded demo turns now author `progress` (ADR-0146), routed to handle.progress,
// so a bubble's narration legitimately mixes category entries and progress-stage entries.
const KNOWN_LABELS = new Set([
  // the live forms (mid-turn) + the done forms (stamped on the settle transition — GH #238/ADR-0159's
  // label-pair table; a settled category entry reads quiet past-tense, never a checked-off "-ing…")
  'Opening a new surface…',
  'Opened a new surface',
  'Updating the surface…',
  'Updated the surface',
  'Updating data…',
  'Updated data',
  'Closing the surface…',
  'Closed the surface',
  // the ADR-0146 progress stage labels (conversation.ts PROGRESS_LABEL), live + done forms
  'Request sent',
  'Generating…',
  'Generated',
  'Reasoning…',
  'Reasoned',
  'Writing the response…',
  'Wrote the response',
  'Validating…',
  'Validated',
])

function narrationLabels(bubble: HTMLElement): string[] {
  // GH #306/ADR-0160 amendment — the narration strip is the OWNING `[data-part="turn"]` wrapper's own
  // child now, a sibling of the bubble (not the bubble's own child) — scope through the parent instead.
  const turn = bubble.parentElement ?? bubble
  return [...turn.querySelectorAll('[data-part="narration"] [data-role="label"]')].map((n) => n.textContent ?? '')
}

describe('a2ui-chat narration on ui-conversation (SPEC-R6 AC1) — never a fabricated sentence', () => {
  it("every recorded-turn narration entry's label is drawn ONLY from closed code-owned tables (category + ADR-0146 progress) — turn 3 shows BOTH categories its lines touch, turn 4 shows only ONE", async () => {
    await sendIntent('turn 1')
    await waitUntil(() => agentBubbles().length === 1)
    await sendIntent('turn 2')
    await waitUntil(() => agentBubbles().length === 2)
    await sendIntent('turn 3')
    await waitUntil(() => agentBubbles().length === 3)
    // turn 3's transcript lines touch BOTH updateComponents (restructure) and updateDataModel (react).
    const bubble3 = agentBubbles()[2]!
    await waitUntil(() => narrationLabels(bubble3).length === 2)
    // GH #238/ADR-0159 — once the turn settles, each category entry re-stamps to its DONE form (the
    // label-pair table): quiet past-tense, never a checked-off "-ing…".
    await waitUntil(() => narrationLabels(bubble3).every((l) => !l.endsWith('…')))
    expect(narrationLabels(bubble3).sort()).toEqual(['Updated data', 'Updated the surface'].sort())

    await sendIntent('turn 4') // data-ONLY — the single-category check
    await waitUntil(() => agentBubbles().length === 4)
    const bubble4 = agentBubbles()[3]!
    await waitUntil(() => narrationLabels(bubble4).length === 1)
    await waitUntil(() => narrationLabels(bubble4).every((l) => !l.endsWith('…')))
    expect(narrationLabels(bubble4)).toEqual(['Updated data'])

    // anti-vacuous: every label seen across the whole arc so far is one of the known, honest strings
    for (const b of agentBubbles()) for (const label of narrationLabels(b)) expect(KNOWN_LABELS.has(label)).toBe(true)
  })
})

// ── SPEC-R6 AC3 — a thrown transport still lets the conversation recover cleanly ───────────────────────
describe('a2ui-chat on ui-conversation — a thrown transport is surfaced + the composer recovers', () => {
  it('a turn whose transport throws mid-stream is caught, announced as a system bubble, and does NOT wedge the page for the next turn', async () => {
    __setTransportForTest(
      scriptedTransport((turn) => {
        if (turn === 1) throw new Error('boom — simulated transport fault')
        return ['{"version":"v1.0","createSurface":{"surfaceId":"ok","catalogId":"agent-ui"}}', '{"version":"v1.0","updateComponents":{"surfaceId":"ok","components":[{"id":"root","component":"Text","text":"fine"}]}}']
      }),
    )

    await sendIntent('trigger the fault')
    await waitUntil(() => systemBubbles().some((b) => b.textContent?.includes('boom') ?? false))

    // busy releases in the turn loop's `finally` — wait for genuine idle rather than asserting synchronously.
    await waitUntilIdle()
    const shell = document.querySelector('.chat-shell') as HTMLElement
    expect(shell.dataset.busy, 'the page must recover — busy must be released even after a throw').not.toBe('1')

    // a subsequent turn must proceed normally — proves the turn loop recovered on the throw path too
    await sendIntent('continue')
    await waitUntil(() => agentBubbles().some((b) => b.textContent?.includes('fine') ?? false))
  })
})

// ── GH #415 — the terminal error meta-line + the transport-honest empty turn ───────────────────────────
// A proxy whose stream headers already committed 200 reports a `ProduceHalt`/upstream fault as ONE terminal
// `{"a2uiMeta":{"error":…}}` line (`formatErrorLine`, meta-line.ts). It PARSES cleanly — it is a valid
// meta-line, never a malformed one — so this page's own `if (meta) … continue` used to drop it with zero
// telemetry: the async generator then completed NORMALLY (nothing throws client-side, so the catch block
// never ran), the turn held zero lines, and the page printed the RECORDED transcript's exhaustion notice
// over a live failure. These assertions pin both halves of the fix: the error becomes visible (the page's
// own `handle.fail()` idiom + the status line), and the exhaustion wording is reserved for the transport
// that actually has a transcript. Same coverage PR #414 landed for the sibling pages (GH #408).
/** The wire shape a transport composes — `formatErrorLine`'s exact bytes for the `error` case. Hand-built
 *  rather than imported (the a2ui-live.ask-lifecycle.test.ts precedent): the envelope is tiny and public. */
function metaLine(fields: { note?: string; error?: string }): string {
  return JSON.stringify({ a2uiMeta: fields })
}

/** `beforeEach`'s `resetPage()` kicks a REAL async `wireLiveOverlay()` probe, and its own fallback status
 *  write (no live key in jsdom) lands at an arbitrary later tick — latest-wins on a single status line. Wait
 *  it out BEFORE injecting a transport, so no assertion below races the probe's own notice. The probe never
 *  reassigns `transport`/`isLive` here (that branch needs `available: true`), only the status text. */
async function waitForLiveProbeSettled(): Promise<void> {
  await waitUntil(() => /Recorded transcript/.test(statusText()))
}

function lastNarration(): HTMLElement | null {
  const strips = document.querySelectorAll<HTMLElement>('ui-conversation [data-part="narration"]')
  return strips.length > 0 ? strips[strips.length - 1]! : null
}

const EXHAUSTED = 'The agent has no further turns in this recorded transcript. Reset to start over.'

describe('a2ui-chat — a terminal transport error is VISIBLE, and the exhaustion notice is transport-honest (GH #415)', () => {
  const HALT = 'Live agent failed: exhausted 3 self-correct rounds without a valid surface.'

  it("a terminal error meta-line surfaces as a ⚠ system bubble + a failed narration + an error status — never the recorded transcript's exhaustion notice", async () => {
    await waitForLiveProbeSettled()
    __setTransportForTest(scriptedTransport(() => [metaLine({ error: HALT })]), true)

    await sendIntent('build me a blackjack table')
    await waitUntil(() => systemBubbles().some((b) => b.textContent?.includes(HALT) ?? false))

    // SPEC-R6 AC3's own face: the primitive truncates narration, stamps an error entry, and forces the
    // strip header to `error` (ADR-0146 F8) — the SAME visible pair a client-thrown turn gets, never a
    // green-reading strip over a turn that genuinely failed.
    await waitUntil(() => lastNarration()?.querySelector('[data-part="header"]')?.getAttribute('data-status') === 'error')
    expect(lastNarration()!.querySelector('ui-timeline-item[status="error"] [data-role="label"]')?.textContent).toContain('Turn failed')

    expect(statusText(), "the transport's own reason, on the page's own aria-live notice line").toContain(HALT)
    expect(statusText(), 'the misdiagnosis this issue is about').not.toMatch(/no further turns|recorded transcript/i)
    await waitUntilIdle()
  })

  it('a LIVE turn that produced nothing at all (no error line) says exactly that — never "no further turns in this recorded transcript"', async () => {
    await waitForLiveProbeSettled()
    __setTransportForTest(scriptedTransport(() => []), true)

    await sendIntent('anything')
    await waitUntil(() => /produced no renderable output/.test(statusText()))

    expect(statusText(), 'a live transport has no transcript to exhaust — and no Reset to rewind it to').not.toMatch(/recorded transcript/i)
    await waitUntilIdle()
  })

  it('negative control: the RECORDED backbone keeps the exhaustion notice byte-identical', async () => {
    await waitForLiveProbeSettled()
    __setTransportForTest(scriptedTransport(() => [])) // `live` omitted ⇒ recorded, the pre-#415 default

    await sendIntent('anything')
    await waitUntil(() => statusText() === EXHAUSTED)

    expect(statusText(), 'the live wording never reaches the recorded backbone').not.toMatch(/produced no renderable output/)
    await waitUntilIdle()
  })
})

// ── the live overlay is dynamically imported (kept code-split, never a static-chunk dependency) — SPEC-R8/
// N2 superseded: production now carries a Cloudflare Worker port of the dev proxy (worker/index.ts,
// `/__a2ui/agent`), so the overlay is no longer DEV-gated at the module level. It still degrades cleanly
// (recorded transcript) whenever `GET /status` reports no live provider available, in every environment —
// that runtime probe is what now enforces the no-browser-held-key boundary ADR-0073 clause 5 requires,
// where a build-time tree-shake used to. A source-level proxy for the sibling pages' own verified contract.
describe('a2ui-chat — the live overlay stays dynamically imported and degrades gracefully with no live key', () => {
  const source = readFileSync(`${process.cwd()}/site/pages/a2ui-chat.ts`, 'utf8') as string

  it('never statically imports live-proxy-transport.ts or provider-switcher.ts at module scope', () => {
    const staticImportLines = source.split('\n').filter((l) => /^import /.test(l))
    for (const line of staticImportLines) {
      expect(line).not.toMatch(/live-proxy-transport/)
      expect(line).not.toMatch(/provider-switcher/)
    }
  })

  it('wireLiveOverlay attempts the live probe unconditionally (no import.meta.env.DEV gate before it)', () => {
    const fnStart = source.indexOf('function wireLiveOverlay')
    expect(fnStart, 'wireLiveOverlay() was not found').toBeGreaterThan(-1)
    const fnBody = source.slice(fnStart)
    const dynImportIdx = fnBody.indexOf("import('../lib/live-proxy-transport.ts')")
    expect(dynImportIdx, 'the dynamic import was not found in wireLiveOverlay').toBeGreaterThan(-1)
    // DEV is still read for WORDING (dev vs prod fallback copy) on the no-live-key branch, but only
    // AFTER the probe's dynamic import — never gating whether the probe is attempted at all.
    const devGuardIdx = fnBody.indexOf('import.meta.env.DEV')
    expect(devGuardIdx, 'import.meta.env.DEV must only appear after the dynamic import, never before it').toBeGreaterThan(dynImportIdx)
  })
})
