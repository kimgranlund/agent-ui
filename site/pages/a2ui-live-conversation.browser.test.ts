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
    // (`agent-runtime.ts` re-exports the one `src/agent/session.ts` implementation) — not a reimplemented
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
    // `[data-part="send"]`, not the bare `ui-button` descendant selector (the a2ui-chat.browser.test.ts
    // code-reviewer BLOCKER finding, promoted here): `ui-conversation-composer`'s hidden mic button sits
    // BEFORE send in DOM order, so a bare `ui-button` match resolves to the wrong (inert) button.
    const sendBtn = document.querySelector('.chat-composer [data-part="send"]') as HTMLElement
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

    // A visible turn happened: the agent's turn-2 response followed — a new "Agent" row carrying turn 2's
    // OWN note — proving the absent-wantResponse click was NOT silently swallowed by the routing predicate
    // (an explicit `wantResponse:false` would `shouldRunTurn===false` and no turn would run at all, so NO
    // agent row would ever appear). The recorded backbone's turn 2 is the "confirmation" surface whose Text
    // reports the click back — see `transcript.ts` TURN2 — so both the chat row AND the canvas re-render are
    // asserted below as the "full visible turn" this test's title names.
    await waitUntil(() => chatMessages('agent').length > agentRowsBefore)
    expect(chatMessages('agent').length, 'the agent never continued — turn 2 did not run (the click was silently suppressed)').toBeGreaterThan(agentRowsBefore)
    expect(chatMessages('agent').at(-1)?.textContent, "the new agent row should carry turn 2's own note").toContain('second surface')

    // The canvas re-rendered turn 2's continuation — the confirmation surface's Text — into the same host.
    await waitUntil(() => (document.querySelector("ui-surface-host [data-part='surface']")?.textContent ?? '').includes('turn 2'))
    expect(document.querySelector("ui-surface-host [data-part='surface']")?.textContent, "turn 2's confirmation surface should render into the canvas").toContain('The agent continues')

    // TKT-0094 contract: a client-action click drives the next turn WITHOUT adding a synthetic "↳ clicked …"
    // echo row to the chat (the click is the surface interaction, not a typed user message — `handleClient
    // Message` no longer calls `addMessage('user', …)`). The user-row count must therefore stay UNCHANGED
    // across the click — asserting this actively locks in the post-TKT-0094 behavior and guards against the
    // echo bubble being re-introduced (this test previously asserted the OPPOSITE, which is why it was stale).
    expect(chatMessages('user').length, 'a client-action click must NOT add a synthetic user echo row (TKT-0094)').toBe(userRowsBefore)
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
    const sendBtn = document.querySelector('.chat-composer [data-part="send"]') as HTMLElement
    sendBtn.click()
    await waitUntil(() => document.querySelector("ui-surface-host [data-part='surface'] ui-button") !== null)
    expect(document.querySelector("ui-surface-host [data-part='surface'] ui-button")).not.toBeNull()
  })
})

// ── this modernization — the composer/narration widgets (Figma chat-input refactor + ADR-0146 F1/GH #239),
// composed standalone (ADR-0129 Fork B: a2ui-live never adopts `<ui-conversation>`; its ask-freeze lifecycle
// in `ask-registry.ts` is untouched by this build, proven elsewhere — this block exercises only the two
// NEW widgets in a REAL engine, both chromium and webkit). ──────────────────────────────────────────────
describe('a2ui-live composer + narration modernization — standalone widgets, ADR-0129 Fork B (never <ui-conversation>)', () => {
  it('the chat composer is the modern <ui-conversation-composer> — the legacy <form>/<ui-text-field> pair is gone, and the opt-in mic stays hidden (never "the composer\'s first ui-button")', async () => {
    await raf()
    const composer = document.querySelector('.chat-composer')!
    expect(composer.tagName, 'the composer element itself is the modern widget, not a wrapper <form>').toBe('UI-CONVERSATION-COMPOSER')
    expect(composer.querySelector('ui-text-field'), 'the legacy raw field is gone').toBeNull()
    expect(composer.querySelector('[data-part="mic"]')?.hasAttribute('hidden'), 'a2ui-live never registers onMicClick — the mic stays hidden by default').toBe(true)
    expect(composer.querySelector('[data-part="send"]')?.hasAttribute('hidden'), 'send is always visible').toBe(false)
    expect(document.querySelector('ui-conversation'), 'a2ui-live must never instantiate <ui-conversation> (ADR-0129 Fork B)').toBeNull()
  })

  it('a REAL user interaction — typing into the editor + a real click on [data-part="send"] — drives a full visible turn AND renders the standalone narration strip with the receipt pattern (oneline + receipt + header)', async () => {
    await raf()
    const editor = document.querySelector('.chat-composer [data-part="editor"]') as HTMLElement
    const agentRowsBefore = chatMessages('agent').length
    editor.textContent = 'show me a button'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    const sendBtn = document.querySelector('.chat-composer [data-part="send"]') as HTMLElement
    sendBtn.click()

    await waitUntil(() => chatMessages('agent').length > agentRowsBefore)
    expect(chatMessages('agent').length, 'the real click drove a full turn through the existing turn loop').toBeGreaterThan(agentRowsBefore)

    const strips = document.querySelectorAll<HTMLElement>('.chat-log .narration-strip')
    expect(strips.length, 'a fresh narration strip was appended for this turn').toBeGreaterThan(0)
    const strip = strips[strips.length - 1]!
    expect(strip.tagName).toBe('UI-STATUS-STREAM')
    expect(strip.hasAttribute('oneline')).toBe(true)
    expect(strip.hasAttribute('receipt')).toBe(true)
    expect(strip.hasAttribute('header')).toBe(true)
  })
})
