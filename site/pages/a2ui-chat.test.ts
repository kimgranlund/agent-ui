// a2ui-chat.test.ts — a2ui-chat.lld.md LLD-C8: jsdom coverage for the routing rule (LLD-C3, SPEC-R3/R4)
// and the narration honesty rule (LLD-C4, SPEC-R5/N5), driven through the REAL page module (side-effect
// import, the `a2ui-live-conversation.browser.test.ts` precedent) rather than a reimplementation of its
// internals. The real-engine whole-shape proof (real geometry, tail-follow, wire disclosure) lives in
// `a2ui-chat.browser.test.ts` — what jsdom cannot prove faithfully stays there (the `component-testing`
// "jsdom-green ≠ done" discipline).
//
// NOTE on SPEC-R5 AC3 (finalize runs on every exit path): this page narrates a turn's categories only
// AFTER its line stream ends without throwing (`narrateCategories` runs after the `for await` loop) — so a
// thrown transport never leaves a category entry mid-flight (`appendEntry` for a category is never
// reached at all on that path); the catch block's own error entry is appended with a TERMINAL `status:
// 'error'`, never `'pending'`/`'active'`. `finalize()` therefore never has anything to truncate for a
// failed turn — the invariant holds by construction, not via the dramatic mid-stream-truncation case
// `ui-status-stream`'s OWN test suite already covers at the component level (status-stream.browser.test.ts
// `:state(truncated)`) — this file does not re-prove that mechanism, only that the page-level `finally`
// genuinely runs (busy/composer recovery below).
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (sitemap.test.ts precedent)
import { readFileSync } from 'node:fs'
import type { AgentTransport, TurnInput } from '../lib/agent-runtime.ts'
declare const process: { cwd(): string }

let __setTransportForTest: (next: AgentTransport) => void

beforeAll(async () => {
  // jsdom reality (the `a2ui-live.ask-lifecycle.test.ts` precedent): `ElementInternals.setFormValue`/
  // `setValidity` are ABSENT in jsdom, and this page mounts a real `ui-text-field` composer through the
  // real custom-element registry. Stub ONCE at the shared prototype — additive, a no-op if a future jsdom
  // ships the real method.
  if (typeof ElementInternals.prototype.setFormValue !== 'function') {
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
  }
  // A DEFERRED import (never a static one at this file's top) — see the a2ui-live precedent's own comment
  // for why: a static import is hoisted and would evaluate the page module's eager side effects (mounting
  // the real composer) BEFORE the stub above lands.
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

function agentBubbles(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.chat-log .msg')].filter((m) => m.dataset.role === 'agent')
}
function systemBubbles(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.chat-log .msg')].filter((m) => m.dataset.role === 'system')
}

/** A turn's narration keeps `busy` true until its paced (real-`setTimeout`) narration transitions finish —
 *  well past the point a fresh surface's mount already appeared. Wait for the composer to genuinely go
 *  idle before queuing the NEXT turn, or a fast-following `sendIntent` silently no-ops against `busy`. */
async function waitUntilIdle(): Promise<void> {
  const sendBtn = document.querySelector('.chat-composer ui-button') as HTMLElement
  await waitUntil(() => !sendBtn.hasAttribute('aria-disabled'))
}

async function sendIntent(text: string): Promise<void> {
  await waitUntilIdle()
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

beforeEach(() => {
  resetPage()
})

// The default transport (createRecordedTransport) ignores its TurnInput entirely and simply advances
// through the SHIPPED `recordedTranscript` (transcript.ts) sequentially — so driving the page with 5
// plain `sendIntent` calls plays the real, unmodified 5-turn arc end to end (SPEC-N4: no second/new
// transcript authored). This is the worked table a2ui-chat.lld.md §4 names as the acceptance evidence.
describe('a2ui-chat routing (LLD-C3, SPEC-R3/R4) — the real shipped 5-turn recordedTranscript', () => {
  it('turn 1 opens canvas in a fresh bubble; turn 2 opens confirmation in a fresh bubble; turns 3/4 route into confirmation\'s EXISTING bubble (no new one); turn 5 closes confirmation in place, canvas untouched throughout', async () => {
    await sendIntent('turn 1')
    await waitUntil(() => agentBubbles().length === 1)
    const bubble1 = agentBubbles()[0]!
    await waitUntil(() => bubble1.querySelector('.chat-surface-mounts ui-button') !== null)

    await sendIntent('turn 2')
    await waitUntil(() => agentBubbles().length === 2)
    const bubble2 = agentBubbles()[1]!
    await waitUntil(() => bubble2.textContent?.includes('turn 2 of the conversation') === true)
    expect(bubble2.querySelector('.chat-surface-mounts ui-text'), "confirmation's Text must render into turn 2's own bubble").not.toBeNull()
    const confirmationMount = bubble2.querySelector('.chat-surface-mount')
    expect(confirmationMount).not.toBeNull()

    // Routing (SPEC-R3/R4) AND visible restructure (TKT-0024 / renderer-structural-resend.spec.md
    // SPEC-R1/R2, upgraded from the prior routing-only assertion once the renderer fix landed): resending
    // an ALREADY-MOUNTED non-root id with a grown `children` list now reconciles the rendered DOM — the
    // new "status" text genuinely appears, not merely routes to the right mount.
    await sendIntent('turn 3') // updateComponents (+trailing updateDataModel) on "confirmation"
    await waitUntil(() => agentBubbles().length === 3)
    const bubble3 = agentBubbles()[2]!
    await waitUntilIdle() // let turn 3's narration/finalize genuinely finish before inspecting
    expect(
      bubble3.querySelector('.chat-surface-mounts')?.children.length ?? 0,
      "turn 3's OWN bubble must carry NO surface mount — it routed into turn 2's",
    ).toBe(0)
    expect(bubble2.querySelector('.chat-surface-mount'), "confirmation's mount must be the SAME node — never re-created").toBe(confirmationMount)
    expect(bubble1.querySelector('.chat-surface-mounts ui-button'), 'canvas (turn 1) must be untouched by turn 3').not.toBeNull()
    expect(bubble2.textContent, "turn 3's resent \"group\" container must VISIBLY restructure — the new status line renders").toContain('Ready')

    await sendIntent('turn 4') // data-ONLY update on "confirmation"
    await waitUntil(() => agentBubbles().length === 4)
    const bubble4 = agentBubbles()[3]!
    await waitUntilIdle()
    expect(bubble4.querySelector('.chat-surface-mounts')?.children.length ?? 0, "turn 4's OWN bubble must also carry NO surface mount").toBe(0)
    expect(bubble2.querySelector('.chat-surface-mount'), "confirmation's mount is STILL the same node after turn 4").toBe(confirmationMount)
    expect(bubble2.textContent, "turn 4's data-only react updates the SAME status node in place — the new value renders").toContain('Clicked again')
    expect(bubble2.textContent, "turn 3's stale \"Ready\" value is gone once turn 4's react lands").not.toContain('Ready')

    await sendIntent('turn 5') // deleteSurface "confirmation"
    await waitUntil(() => agentBubbles().length === 5)
    await waitUntil(() => bubble2.dataset.state === 'closed')
    expect(bubble2.querySelector('.surface-annotation')?.textContent).toBe('Closed.')
    expect(
      bubble2.querySelector('.chat-surface-mounts ui-column, .chat-surface-mounts ui-text'),
      "confirmation's rendered DOM must be torn down once closed",
    ).toBeNull()

    // canvas (turn 1) survives the whole arc, never annotated/closed
    expect(bubble1.dataset.state).toBeUndefined()
    expect(bubble1.querySelector('.chat-surface-mounts ui-button')).not.toBeNull()
  })

  it('a fifth send past the transcript end shows the "no further turns" system message, not a crash', async () => {
    for (let i = 0; i < 5; i++) {
      await sendIntent(`turn ${i + 1}`)
      await waitUntil(() => agentBubbles().length === i + 1)
    }
    await sendIntent('turn 6 — past the end')
    await waitUntil(() => systemBubbles().some((b) => b.textContent?.includes('no further turns') ?? false))
  })
})

// ── narration honesty (LLD-C4, SPEC-R5 AC1 / SPEC-N5) ──────────────────────────────────────────────────
const KNOWN_LABELS = new Set([
  'Opening a new surface…',
  'Updating the surface…',
  'Updating data…',
  'Closing the surface…',
])

function narrationLabels(bubble: HTMLElement): string[] {
  return [...bubble.querySelectorAll('.turn-narration [data-role="label"]')].map((n) => n.textContent ?? '')
}

describe('a2ui-chat narration (LLD-C4, SPEC-R5 AC1 / SPEC-N5) — never a fabricated sentence', () => {
  it("every recorded-turn narration entry's label is drawn ONLY from the mechanical category table — turn 3 shows BOTH categories its lines touch, turn 4 shows only ONE", async () => {
    await sendIntent('turn 1')
    await waitUntil(() => agentBubbles().length === 1)
    await sendIntent('turn 2')
    await waitUntil(() => agentBubbles().length === 2)
    await sendIntent('turn 3')
    await waitUntil(() => agentBubbles().length === 3)
    // turn 3's transcript lines touch BOTH updateComponents (restructure) and updateDataModel (react) —
    // wait for both narration entries to land in turn 3's own bubble.
    const bubble3 = agentBubbles()[2]!
    await waitUntil(() => narrationLabels(bubble3).length === 2)
    expect(narrationLabels(bubble3).sort()).toEqual(['Updating data…', 'Updating the surface…'].sort())

    await sendIntent('turn 4') // data-ONLY — SPEC-R5 AC1's literal single-category check
    await waitUntil(() => agentBubbles().length === 4)
    const bubble4 = agentBubbles()[3]!
    await waitUntil(() => narrationLabels(bubble4).length === 1)
    expect(narrationLabels(bubble4)).toEqual(['Updating data…'])

    // anti-vacuous + SPEC-N5: every label seen across the whole arc so far is one of the known, honest strings
    for (const b of agentBubbles()) for (const label of narrationLabels(b)) expect(KNOWN_LABELS.has(label)).toBe(true)
  })
})

// ── SPEC-R5 AC3 — finalize() runs on every exit path, including a thrown transport ─────────────────────
describe('a2ui-chat narration (LLD §6 risk) — a thrown transport still lets the conversation recover cleanly', () => {
  it('a turn whose transport throws mid-stream is caught, announced as a system error, and does NOT wedge the composer for the next turn', async () => {
    __setTransportForTest(
      scriptedTransport((turn) => {
        if (turn === 1) throw new Error('boom — simulated transport fault')
        return ['{"version":"v1.0","createSurface":{"surfaceId":"ok","catalogId":"agent-ui"}}', '{"version":"v1.0","updateComponents":{"surfaceId":"ok","components":[{"id":"root","component":"Text","text":"fine"}]}}']
      }),
    )

    await sendIntent('trigger the fault')
    await waitUntil(() => systemBubbles().some((b) => b.textContent?.includes('boom') ?? false))

    // `busy` releases only once the tail-follow settles (a real, rAF-deferred promise) — wait for it,
    // rather than asserting synchronously right after the error bubble appears.
    const sendBtn = document.querySelector('.chat-composer ui-button') as HTMLElement
    await waitUntil(() => !sendBtn.hasAttribute('aria-disabled'))
    expect(sendBtn.hasAttribute('aria-disabled'), 'the composer must recover — busy must be released even after a throw').toBe(false)

    // a subsequent turn must proceed normally — proves finalize()/busy-release ran on the throw path too
    await sendIntent('continue')
    await waitUntil(() => agentBubbles().some((b) => b.textContent?.includes('fine') ?? false))
  })
})

// ── SPEC-R8 AC1 — the live overlay is DEV-guarded + dynamically imported, so `vite build` tree-shakes it ──
// A source-level proxy for the sibling pages' own verified contract (neither `a2ui-live.ts` nor
// `a2a-artifact-feed.ts` carries an automated dist-grep gate for this either): confirms the CONSTRUCTION
// that causes Rolldown-Vite to tree-shake the overlay out is genuinely present, rather than trusting the
// comment. A real production `vite build` + dist-grep would prove the OUTCOME directly, but is out of
// scope for a per-file unit test's runtime budget — this proves the mechanism the outcome depends on.
describe('a2ui-chat — SPEC-R8 AC1: the live overlay is genuinely DEV-guarded + dynamically imported', () => {
  const source = readFileSync(`${process.cwd()}/site/pages/a2ui-chat.ts`, 'utf8') as string

  it('never statically imports live-proxy-transport.ts or provider-switcher.ts at module scope', () => {
    const staticImportLines = source.split('\n').filter((l) => /^import /.test(l))
    for (const line of staticImportLines) {
      expect(line).not.toMatch(/live-proxy-transport/)
      expect(line).not.toMatch(/provider-switcher/)
    }
  })

  it('the live overlay function checks `import.meta.env.DEV` BEFORE reaching either dynamic import', () => {
    const fnStart = source.indexOf('function wireLiveOverlay')
    expect(fnStart, 'wireLiveOverlay() was not found').toBeGreaterThan(-1)
    const fnBody = source.slice(fnStart)
    const devGuardIdx = fnBody.indexOf('import.meta.env.DEV')
    const dynImportIdx = fnBody.indexOf("import('../lib/live-proxy-transport.ts')")
    expect(devGuardIdx).toBeGreaterThan(-1)
    expect(dynImportIdx).toBeGreaterThan(-1)
    expect(devGuardIdx, 'the DEV guard must be checked BEFORE the dynamic import is ever reached').toBeLessThan(dynImportIdx)
  })
})
