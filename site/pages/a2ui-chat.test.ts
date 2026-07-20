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

let __setTransportForTest: (next: AgentTransport) => void

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
    await waitUntil(() => bubble1.querySelector('ui-surface-host ui-button') !== null)

    await sendIntent('turn 2')
    await waitUntil(() => agentBubbles().length === 2)
    const bubble2 = agentBubbles()[1]!
    await waitUntil(() => bubble2.textContent?.includes('turn 2 of the conversation') === true)
    expect(bubble2.querySelector('ui-surface-host ui-text'), "confirmation's Text must render into turn 2's own bubble").not.toBeNull()
    const confirmationHost = bubble2.querySelector('[data-part="mounts"] ui-surface-host')
    expect(confirmationHost).not.toBeNull()

    // Routing + persistent identity (SPEC-R7 AC1): a later turn resending against a known surfaceId routes
    // to the SAME inline ui-surface-host at its ORIGINAL bubble — never a new mount for the same id.
    await sendIntent('turn 3') // updateComponents (+trailing updateDataModel) on "confirmation"
    await waitUntil(() => agentBubbles().length === 3)
    const bubble3 = agentBubbles()[2]!
    await waitUntilIdle()
    expect(
      bubble3.querySelector('[data-part="mounts"]')?.children.length ?? 0,
      "turn 3's OWN bubble must carry NO surface host — it routed into turn 2's",
    ).toBe(0)
    expect(bubble2.querySelector('[data-part="mounts"] ui-surface-host'), "confirmation's host must be the SAME node — never re-created").toBe(confirmationHost)
    expect(bubble1.querySelector('ui-surface-host ui-button'), 'canvas (turn 1) must be untouched by turn 3').not.toBeNull()

    await sendIntent('turn 4') // data-ONLY update on "confirmation"
    await waitUntil(() => agentBubbles().length === 4)
    const bubble4 = agentBubbles()[3]!
    await waitUntilIdle()
    expect(bubble4.querySelector('[data-part="mounts"]')?.children.length ?? 0, "turn 4's OWN bubble must also carry NO surface host").toBe(0)
    expect(bubble2.querySelector('[data-part="mounts"] ui-surface-host'), "confirmation's host is STILL the same node after turn 4").toBe(confirmationHost)

    await sendIntent('turn 5') // deleteSurface "confirmation"
    await waitUntil(() => agentBubbles().length === 5)
    await waitUntil(() => bubble2.dataset.state === 'closed')
    expect(bubble2.querySelector('[data-part="annotation"]')?.textContent).toBe('Closed.')
    expect(
      bubble2.querySelector('ui-surface-host ui-column, ui-surface-host ui-text'),
      "confirmation's rendered DOM must be torn down once closed",
    ).toBeNull()

    // canvas (turn 1) survives the whole arc, never annotated/closed
    expect(bubble1.dataset.state).toBeUndefined()
    expect(bubble1.querySelector('ui-surface-host ui-button')).not.toBeNull()
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
  'Opening a new surface…',
  'Updating the surface…',
  'Updating data…',
  'Closing the surface…',
  // the ADR-0146 progress stage labels (conversation.ts PROGRESS_LABEL)
  'Request sent',
  'Generating…',
  'Reasoning…',
  'Writing the response…',
  'Validating…',
])

function narrationLabels(bubble: HTMLElement): string[] {
  return [...bubble.querySelectorAll('[data-part="narration"] [data-role="label"]')].map((n) => n.textContent ?? '')
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
    expect(narrationLabels(bubble3).sort()).toEqual(['Updating data…', 'Updating the surface…'].sort())

    await sendIntent('turn 4') // data-ONLY — the single-category check
    await waitUntil(() => agentBubbles().length === 4)
    const bubble4 = agentBubbles()[3]!
    await waitUntil(() => narrationLabels(bubble4).length === 1)
    expect(narrationLabels(bubble4)).toEqual(['Updating data…'])

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
