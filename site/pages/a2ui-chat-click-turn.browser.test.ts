// a2ui-chat-click-turn.browser.test.ts — GH #42: the click→turn e2e for a2ui-chat, mirroring the
// ADR-0088 §3 pattern a2ui-live-conversation.browser.test.ts establishes. Side-effect-imports the REAL
// page module in its OWN file (the zero-blast-radius law that precedent documents: the sibling arc test
// sequences the positional transcript via typed sendIntent — a click leg sharing its file would consume
// its turns), so this genuinely proves a2ui-chat's OWN handleClientMessage routing: a REAL click on the
// rendered canvas Button (the shipped canvas-button seed — `wantResponse` absent) drives a full visible
// turn, with NO synthetic user echo row (the TKT-0094 contract this issue's sweep was about).
import { describe, it, expect } from 'vitest'
import './a2ui-chat.ts' // side-effect import — mounts the real chat page

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

async function waitUntil(predicate: () => boolean, timeoutMs = 4000): Promise<void> {
  const start = Date.now()
  for (;;) {
    if (predicate()) return
    if (Date.now() - start > timeoutMs) throw new Error('waitUntil: condition never became true within the timeout')
    await raf()
  }
}

function bubbles(role: 'user' | 'agent'): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('ui-conversation [data-part="bubble"]')].filter(
    (b) => b.dataset.role === role,
  )
}

describe('a2ui-chat — GH #42: a REAL canvas click drives a full visible turn', () => {
  it('click on the seed Button (wantResponse absent) → the next transcript turn renders; user rows unchanged (TKT-0094)', async () => {
    await raf()

    // Turn 1 via the composer — the recorded backbone replays the canvas-button seed.
    const editor = document.querySelector('ui-conversation ui-conversation-composer [data-part="editor"]') as HTMLElement
    expect(editor, 'composer editor not found').not.toBeNull()
    editor.textContent = 'show me a button'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    ;(document.querySelector('ui-conversation ui-conversation-composer [data-part="send"]') as HTMLElement).click()

    await waitUntil(() => document.querySelector('ui-conversation [data-part="mounts"] ui-surface-host ui-button') !== null)
    const canvasButton = [...document.querySelectorAll<HTMLElement>('ui-conversation [data-part="mounts"] ui-surface-host ui-button')].find(
      (b) => b.textContent?.trim() === 'Click me',
    )
    expect(canvasButton, 'the seed Button did not render into the canvas').not.toBeUndefined()
    expect(canvasButton!.getBoundingClientRect().width, 'whole-shape: the button renders with real size').toBeGreaterThan(0)

    const userBefore = bubbles('user').length
    const agentBefore = bubbles('agent').length

    // The scripted interaction: a REAL click dispatches a REAL A2uiAction (wantResponse absent) into the
    // page's handleClientMessage — the exact wiring under test.
    canvasButton!.click()

    // A visible turn happened: a NEW agent bubble carries turn 2's confirmation surface.
    await waitUntil(() => bubbles('agent').length > agentBefore)
    const latest = bubbles('agent').at(-1)!
    await waitUntil(() => latest.querySelector('ui-surface-host') !== null)
    expect(latest.querySelector('ui-surface-host'), "turn 2's confirmation surface renders in its own bubble").not.toBeNull()

    // TKT-0094: the click is the surface interaction, not a typed message — NO synthetic user echo row.
    expect(bubbles('user').length, 'a client-action click must NOT add a user echo row').toBe(userBefore)
  })
})
