// a2ui-chat.browser.test.ts — the cross-engine whole-shape proof (Chromium + WebKit via vitest-browser) for
// the page RE-HOSTED onto `ui-conversation` (app-surfaces-m2.spec.md SPEC-R9). Side-effect-imports the REAL
// page module (`import './a2ui-chat.ts'` genuinely drives this page's own wiring) and plays the real,
// unmodified `recordedTranscript` end to end: real non-zero geometry for the inline surfaces (the "test the
// whole shape" law — a jsdom pass proves routing correctness, not that anything actually rendered with real
// size), the conversation log's stick-to-bottom behavior independent of an embedded ui-status-stream
// (SPEC-R4), and the opt-in wire disclosure opening to real JSON (SPEC-R6/ADR-0129 clause 3).
//
// Selector idiom (site-canon dead-role guard): bubble roles (`user`/`agent`/`system`) are page-timeline
// roles, matched via `.dataset.role` in JS — never a `[data-role="…"]` CSS-selector STRING the guard flags.
import { describe, it, expect } from 'vitest'
import './a2ui-chat.ts' // side-effect import — mounts the real a2ui-chat page into document.body

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

/** Poll `predicate` across animation frames until it's true (or fail after `timeoutMs`) — the async turn
 *  loop (narration pacing + the renderer's own microtask-batched effects) crosses several boundaries per
 *  turn, so a single fixed double-`raf()` isn't a reliable bound. */
async function waitUntil(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now()
  for (;;) {
    if (predicate()) return
    if (Date.now() - start > timeoutMs) throw new Error('waitUntil: condition never became true within the timeout')
    await raf()
  }
}

/** Hold `el.scrollTop` at `target` until it STAYS there for `stableFrames` consecutive frames. Self-correcting
 *  against a still-running fire-and-forget tail-follow: `ui-conversation`'s own `finalize()` keeps re-asserting
 *  scroll-to-bottom for up to ~1s after a turn lands (internal, not awaited by the page's `busy`), so a fixed
 *  handful of `scrollTop=0` writes can be immediately fought back. Re-asserting until it genuinely sticks
 *  waits that window out deterministically without hardcoding its duration (the `tailFollowLog` settle-loop
 *  discipline, observed rather than asserted). */
async function forceScrollTopStable(el: HTMLElement, target = 0, stableFrames = 3, timeoutMs = 3000): Promise<void> {
  const start = Date.now()
  let stable = 0
  for (;;) {
    el.scrollTop = target
    await raf()
    if (el.scrollTop === target) {
      stable += 1
      if (stable >= stableFrames) return
    } else {
      stable = 0
    }
    if (Date.now() - start > timeoutMs) throw new Error(`scrollTop never held at ${target} (still being tail-followed?)`)
  }
}

function bubbles(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('ui-conversation [data-part="bubble"]')]
}
function agentBubbles(): HTMLElement[] {
  return bubbles().filter((m) => m.dataset.role === 'agent')
}
function statusText(): string {
  return (document.querySelector('.chat-status') as HTMLElement | null)?.textContent ?? ''
}

/** The page's own busy signal (`shell.dataset.busy`) — set synchronously on send, cleared once the turn's
 *  transport stream is finalized; wait for genuine idle before queuing the next turn. */
async function waitUntilIdle(): Promise<void> {
  const shell = document.querySelector('.chat-shell') as HTMLElement
  await waitUntil(() => shell.dataset.busy !== '1')
}

async function sendIntent(text: string): Promise<void> {
  await waitUntilIdle()
  const editor = document.querySelector('ui-conversation [data-part="composer"] [data-part="editor"]') as HTMLElement
  editor.textContent = text
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  const sendBtn = document.querySelector('ui-conversation [data-part="composer"] ui-button') as HTMLElement
  sendBtn.click()
}

function resetPage(): Promise<void> {
  const resetBtn = [...document.querySelectorAll<HTMLElement>('ui-button')].find((b) => b.textContent?.trim() === 'Reset')
  resetBtn?.click()
  return waitUntil(() => statusText().includes('New conversation'))
}

describe('a2ui-chat on ui-conversation — real-engine whole-shape arc (SPEC-R4/R6/R7) — the real shipped 5-turn transcript', () => {
  it('open (real geometry) -> restructure+react route into the SAME host, no new bubble -> data-only react -> close tears down + annotates, canvas untouched', async () => {
    await raf()
    await resetPage()

    await sendIntent('turn 1')
    await waitUntil(() => document.querySelector('ui-conversation [data-part="mounts"] ui-surface-host ui-button') !== null)
    const canvasButton = document.querySelector('ui-conversation [data-part="mounts"] ui-surface-host ui-button') as HTMLElement
    // "test the whole shape" — the surface actually RENDERED with real, non-zero size in a real engine.
    expect(canvasButton.getBoundingClientRect().width, 'the mounted canvas surface must have real width').toBeGreaterThan(0)
    expect(canvasButton.getBoundingClientRect().height, 'the mounted canvas surface must have real height').toBeGreaterThan(0)
    const bubble1 = agentBubbles()[0]!

    await sendIntent('turn 2')
    await waitUntil(() => agentBubbles().length === 2)
    const bubble2 = agentBubbles()[1]!
    await waitUntil(() => bubble2.textContent?.includes('turn 2 of the conversation') === true)
    const confirmationText = bubble2.querySelector('ui-surface-host ui-text') as HTMLElement
    expect(confirmationText, "confirmation's Text must render into turn 2's own bubble").not.toBeNull()
    expect(confirmationText.getBoundingClientRect().width).toBeGreaterThan(0)
    const confirmationHost = bubble2.querySelector('[data-part="mounts"] ui-surface-host')

    // SPEC-R7: resent lines land at confirmation's ORIGINAL host (same node, never a second one).
    await sendIntent('turn 3') // updateComponents (+trailing updateDataModel) on "confirmation"
    await waitUntil(() => agentBubbles().length === 3)
    await waitUntilIdle()
    const bubble3 = agentBubbles()[2]!
    expect(bubble3.querySelector('[data-part="mounts"]')?.children.length ?? 0, "turn 3's own bubble carries NO surface host").toBe(0)
    expect(bubble2.querySelector('[data-part="mounts"] ui-surface-host'), "confirmation's host is the SAME node — never re-created").toBe(confirmationHost)
    expect(bubble1.querySelector('ui-surface-host ui-button'), 'canvas (turn 1) is untouched by turn 3').not.toBeNull()

    await sendIntent('turn 4') // data-ONLY update
    await waitUntil(() => agentBubbles().length === 4)
    await waitUntilIdle()
    const bubble4 = agentBubbles()[3]!
    expect(bubble4.querySelector('[data-part="mounts"]')?.children.length ?? 0).toBe(0)
    expect(bubble2.querySelector('[data-part="mounts"] ui-surface-host'), "confirmation's host is STILL the same node after turn 4").toBe(confirmationHost)

    await sendIntent('turn 5') // deleteSurface "confirmation"
    await waitUntil(() => agentBubbles().length === 5)
    await waitUntil(() => bubble2.dataset.state === 'closed')
    expect(bubble2.querySelector('[data-part="annotation"]')?.textContent).toBe('Closed.')
    expect(bubble2.querySelector('ui-surface-host ui-column, ui-surface-host ui-text'), 'confirmation DOM is torn down').toBeNull()
    expect(bubble1.querySelector('ui-surface-host ui-button'), 'canvas survives the whole arc').not.toBeNull()
  })
})

describe('a2ui-chat on ui-conversation — the log tail-follows independently of an embedded ui-status-stream (SPEC-R4)', () => {
  it("the log auto-scrolls to the newest bubble by default, stops once the user scrolls up, and never touches an embedded stream's own scroll position", async () => {
    await resetPage()
    const chatLog = document.querySelector('ui-conversation [data-part="log"]') as HTMLElement

    for (let i = 0; i < 5; i++) {
      await sendIntent(`turn ${i + 1}`)
      await waitUntil(() => agentBubbles().length === i + 1)
      await waitUntilIdle()
    }
    expect(chatLog.scrollHeight, 'the log must genuinely overflow for this leg to mean anything').toBeGreaterThan(chatLog.clientHeight)
    await waitUntil(() => chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight <= 24)

    const stream = document.querySelector('[data-part="narration"]') as HTMLElement
    const streamScrollBefore = stream.scrollTop

    // Scroll UP to read history — breaks the log's OWN stick-to-bottom guard. Re-assert until it genuinely
    // sticks (waiting out turn 5's still-running internal tail-follow window, which the page's `busy` no
    // longer tracks now that the follow lives inside the primitive).
    await forceScrollTopStable(chatLog, 0)
    expect(chatLog.scrollTop).toBe(0)

    // The transcript is exhausted (only 5 turns) — a 6th send appends a NEW (empty) agent bubble + a status
    // notice; the log must NOT be yanked back to the bottom by it (the user is still reading history).
    await sendIntent('turn 6 — past the end')
    await waitUntil(() => statusText().includes('no further turns'))
    await raf()
    expect(chatLog.scrollTop, 'a scrolled-up reader must not be yanked to the bottom by new content').toBe(0)

    // Independence: the log's own tail-follow touches ONLY the log's scrollTop — an embedded stream's own
    // scroll position (its own guard) is never reached into from the conversation's outer follow.
    expect(stream.scrollTop, "the log's tail-follow must never touch an embedded stream's own scroll state").toBe(streamScrollBefore)
  })
})

describe('a2ui-chat on ui-conversation — wire disclosure (SPEC-R6 / ADR-0129 clause 3, opt-in)', () => {
  it("opening a bubble's disclosure reveals the REAL raw A2UI line(s) that turn's transport emitted, as real JSON", async () => {
    await resetPage()
    await sendIntent('turn 1')
    await waitUntil(() => agentBubbles().length === 1)
    await waitUntilIdle() // the disclosure is appended after the turn's narration/finalize settle
    const bubble1 = agentBubbles()[0]!

    const details = bubble1.querySelector('[data-part="disclosure"]') as HTMLDetailsElement
    expect(details, 'every agent bubble must carry a wire disclosure (disclosure opted in)').not.toBeNull()
    details.open = true
    const wireText = details.querySelector('[data-part="wire"]')?.textContent ?? ''
    expect(wireText).toContain('"createSurface"')
    expect(wireText).toContain('"canvas"')
    // sanity: the disclosure's pretty-printed blocks (each turn's JSON.stringify(…, null, 2) joined by a
    // single '\n', so consecutive blocks abut a `}`/`{` boundary) are each genuinely parseable JSON.
    const blocks = wireText.trim().split(/(?<=\})\n(?=\{)/)
    expect(blocks.length, 'the seed turn carries at least one A2UI line').toBeGreaterThan(0)
    for (const block of blocks) expect(() => JSON.parse(block)).not.toThrow()
  })
})
