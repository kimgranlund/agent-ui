// a2ui-live-conversation.browser.test.ts — ADR-0088 slice 5 (page wiring): the wantResponse-routed
// click→turn. Side-effect-imports the REAL page module (the `a2ui-catalog.browser.test.ts` precedent —
// `import './a2ui-catalog.ts'` there drives that page's own real wiring, not a reimplementation of it), so
// this genuinely proves `a2ui-live.ts`'s OWN `handleClientMessage` routing, not a parallel stand-in.
//
// Kept in its OWN file, separate from `a2ui-live.browser.test.ts`: that file's chrome legs measure ABSOLUTE
// `getBoundingClientRect()` positions of hand-built `<main>` wrappers it appends to `document.body` itself;
// side-effect-importing the real page THERE would additionally mount a full `<div class="app-shell">` into
// the SAME document ahead of those wrappers, shifting their block-flow `y` offsets and breaking those exact-
// pixel assertions. Vitest's browser mode isolates each `*.browser.test.ts` file in its own page/document by
// default, so a separate file is the zero-blast-radius way to drive the real page end to end.
import { describe, it, expect } from 'vitest'
import './a2ui-live.ts' // side-effect import — mounts the real live-agent page into document.body
import { shouldRunTurn } from '../lib/agent-runtime.ts'
import type { A2uiActionMessage } from '@agent-ui/a2ui'

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

/** Poll `predicate` across animation frames until it's true (or fail after `timeoutMs`) — the async
 * `produce()`/`transport.turn()` loop crosses several microtask boundaries per turn, so a single fixed
 * double-`raf()` isn't a reliable bound; poll instead of guessing a frame count. */
async function waitUntil(predicate: () => boolean, timeoutMs = 4000): Promise<void> {
  const start = Date.now()
  for (;;) {
    if (predicate()) return
    if (Date.now() - start > timeoutMs) throw new Error('waitUntil: condition never became true within the timeout')
    await raf()
  }
}

function chatMessages(role: 'user' | 'agent' | 'system'): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.chat-log .msg')].filter((m) => m.dataset.role === role)
}

describe('a2ui-live — ADR-0088 §3: the wantResponse-routed click→turn', () => {
  it('the ROUTING PREDICATE a2ui-live.ts\'s handleClientMessage delegates to: wantResponse===false suppresses; absent/true still turn', () => {
    // The shipped recorded-backbone's OWN action button (`canvas-button.ts:27`, replayed by turn 1 below)
    // sets NO `wantResponse` — the exact real-world shape the ADR's back-compat default must not regress
    // (Context / Decision §3: "any routing rule that treats wantResponse absent ⇒ silent would kill the
    // shipped demo's turn-2"). This is the SAME `shouldRunTurn` the page's `handleClientMessage` calls
    // (`agent-runtime.ts` re-exports the one `tools/agent/session.ts` implementation) — not a reimplemented
    // rule — so this is a genuine proof of the page's own routing, at the exact seam LLD-C5/C9 split it at.
    const absent: A2uiActionMessage = {
      version: 'v1.0',
      action: { surfaceId: 'canvas', actionId: 'a1', name: 'submit', sourceComponentId: 'root', timestamp: 't', context: {} },
    }
    const explicitTrue: A2uiActionMessage = { ...absent, action: { ...absent.action, wantResponse: true } }
    const explicitFalse: A2uiActionMessage = { ...absent, action: { ...absent.action, wantResponse: false } }

    expect(shouldRunTurn(absent), 'absent wantResponse must still turn (back-compat default)').toBe(true)
    expect(shouldRunTurn(explicitTrue), 'an explicit opt-IN must still turn').toBe(true)
    expect(shouldRunTurn(explicitFalse), 'an explicit opt-OUT must suppress the turn').toBe(false)

    // Negative control — proves the predicate genuinely INSPECTS the flag rather than vacuously answering
    // `true` for every action (which would make every assertion above pass for the wrong reason).
    expect(shouldRunTurn(explicitFalse)).not.toBe(shouldRunTurn(explicitTrue))
  })

  it('END-TO-END regression: a REAL click on the shipped seed\'s button (wantResponse absent) still drives a full visible turn', async () => {
    await raf()

    // Turn 1 — send any intent; the recorded backbone ignores the text and replays the canvas-button seed
    // (a Button labelled "Click me", `action:{action:'submit'}`, no `wantResponse` — `canvas-button.ts:27`).
    const editor = document.querySelector('.chat-composer [data-part="editor"]') as HTMLElement
    expect(editor, 'the composer field editor part was not found').not.toBeNull()
    editor.textContent = 'show me a button'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    const sendBtn = document.querySelector('.chat-composer ui-button') as HTMLElement
    expect(sendBtn, 'the composer Send button was not found').not.toBeNull()
    sendBtn.click()

    await waitUntil(() => document.querySelector("ui-surface-host [data-part='surface'] ui-button") !== null)

    const realButton = [...document.querySelectorAll<HTMLElement>("ui-surface-host [data-part='surface'] ui-button")].find(
      (b) => b.textContent?.trim() === 'Click me',
    )
    expect(realButton, 'the seed Button did not render into the real canvas').not.toBeUndefined()

    const userRowsBefore = chatMessages('user').length
    const agentRowsBefore = chatMessages('agent').length

    // The scripted interaction: a REAL click dispatches a REAL A2uiAction (wantResponse absent) into
    // `handleClientMessage` — the exact wiring under test, not a synthetic call to a handler.
    realButton!.click()

    // A visible turn happened: a new "clicked" user row (handleClientMessage's own addMessage, gated by
    // `shouldRunTurn`) AND the agent's turn-2 response followed — proving the absent-wantResponse click was
    // NOT silently swallowed by the new routing.
    await waitUntil(() => chatMessages('user').length > userRowsBefore)
    await waitUntil(() => chatMessages('agent').length > agentRowsBefore)

    expect(chatMessages('user').length, 'no new user row — the click was silently suppressed').toBeGreaterThan(userRowsBefore)
    expect(chatMessages('agent').length, 'the agent never continued — turn 2 did not run').toBeGreaterThan(agentRowsBefore)
    const lastUserRow = chatMessages('user').at(-1)
    expect(lastUserRow?.textContent, 'the appended row should describe the click').toContain('submit')
  })
})

// ── ADR-0097 §2 regression: the recorded-backbone page path still works end-to-end AFTER the feed-ask
// lifecycle wiring landed (the shipped transcript carries no ask, so this proves NON-INTERFERENCE — the
// ask registry's existence must not change the ordinary canvas turn/Reset behavior at all). ──────────────
describe('a2ui-live — ADR-0097 §2: the recorded-transport page path is unaffected; Reset leaves no ask bubbles', () => {
  it('Reset clears the chat log (and, trivially, any ask bubble — none exist in the shipped transcript) with no console error', async () => {
    await raf()
    const resetBtn = [...document.querySelectorAll<HTMLElement>('ui-button')].find((b) => b.textContent?.trim() === 'Reset')
    expect(resetBtn, 'the Reset button was not found').not.toBeUndefined()

    resetBtn!.click()
    await waitUntil(() => chatMessages('system').length > 0)

    expect(document.querySelectorAll('.msg[data-ask]'), 'a Reset must leave no ask bubbles behind').toHaveLength(0)
    expect(document.querySelector("ui-surface-host [data-part='surface'] ui-button"), 'Reset must clear the canvas too').toBeNull()

    // The backbone still works post-Reset — a fresh turn 1 renders the seed again (non-interference proof).
    const editor = document.querySelector('.chat-composer [data-part="editor"]') as HTMLElement
    editor.textContent = 'show me a button again'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    const sendBtn = document.querySelector('.chat-composer ui-button') as HTMLElement
    sendBtn.click()
    await waitUntil(() => document.querySelector("ui-surface-host [data-part='surface'] ui-button") !== null)
    expect(document.querySelector("ui-surface-host [data-part='surface'] ui-button")).not.toBeNull()
  })
})
