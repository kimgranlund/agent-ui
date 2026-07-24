// gen-ui-live.test.ts — jsdom coverage for the recorded-mode TURN SELECTION (a FIXED ROTATION, mirroring
// a2ui-live's own `createRecordedTransport` selection logic exactly: `TurnInput` is ignored entirely, so a
// genuinely different typed message still advances to the SAME next canned turn) and the render-pane
// wiring driven end to end through the REAL committed `genuiTranscript` — no scripted transport stub here,
// unlike a2ui-live.ask-lifecycle.test.ts's own suite: this page has no ask-freeze/collision edge cases to
// script around (Kim's ruling — no AskRegistry precedent), so the actual recorded backbone IS the thing
// under test. Real-engine containment / live theme-flip / the action-bridge round-trip's OWN cross-engine
// proof live in gen-ui-live.browser.test.ts (sandbox-frame's real-engine-only law — jsdom cannot navigate a
// sandboxed srcdoc iframe at all); this file only proves THIS page's own turn-advance + DOM wiring.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

beforeAll(async () => {
  // A DEFERRED (dynamic) import — the a2ui-live.ask-lifecycle.test.ts precedent: `gen-ui-live.ts`'s own
  // module-scope code mounts the real page (shell, composer, narration wiring) as a side effect of import,
  // so this runs it at test-setup time rather than racing any hoisted static import.
  await import('./gen-ui-live.ts')
})

function chatMessages(role: 'user' | 'agent' | 'system'): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.chat-log .msg')].filter((m) => m.dataset.role === role)
}

function surfaceCards(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.surface-card')]
}

function surfaceIdOf(card: HTMLElement): string | null | undefined {
  return card.querySelector('.surface-card-id')?.textContent
}

async function waitUntil(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now()
  for (;;) {
    if (predicate()) return
    if (Date.now() - start > timeoutMs) throw new Error('waitUntil: condition never became true within the timeout')
    await new Promise((r) => setTimeout(r, 0))
  }
}

async function sendMessage(text: string): Promise<void> {
  const editor = document.querySelector('.chat-composer [data-part="editor"]') as HTMLElement
  editor.textContent = text
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  // `[data-part="send"]`, not a bare `ui-button` descendant selector (the a2ui-chat.browser.test.ts /
  // a2ui-live.ask-lifecycle.test.ts precedent — the composer's own icon-only affordances sit in DOM order
  // before Send, so a bare `ui-button` match can resolve to the wrong control).
  const sendBtn = document.querySelector('.chat-composer [data-part="send"]') as HTMLElement
  sendBtn.click()
}

function clickReset(): void {
  const resetBtn = [...document.querySelectorAll<HTMLElement>('ui-button')].find((b) => b.textContent?.trim() === 'Reset')
  resetBtn?.click()
}

beforeEach(() => {
  clickReset() // restart the recorded backbone from turn 1, every test (the ask-lifecycle.test.ts precedent)
})

describe('gen-ui-live — the recorded/stub mode is stated honestly (Kim\'s ruling)', () => {
  it('an opening system message names this a recorded demo, not a live producer', () => {
    const systemMsgs = chatMessages('system')
    expect(systemMsgs.length).toBeGreaterThan(0)
    expect(systemMsgs[0]!.textContent).toMatch(/recorded/i)
  })

  it('the render pane carries a persistent "Recorded demo" badge', () => {
    const badge = document.querySelector('.render-pane .demo-badge')
    expect(badge?.textContent).toBe('Recorded demo')
  })
})

describe('gen-ui-live — recorded-mode turn selection is a FIXED ROTATION (mirrors a2ui-live\'s own transport)', () => {
  it('turn 1 renders on ANY first message — the transcript ignores what was typed', async () => {
    await sendMessage('completely unrelated gibberish xyz123')
    await waitUntil(() => surfaceCards().length === 1)
    expect(surfaceIdOf(surfaceCards()[0]!)).toBe('q3-revenue')
    const agentMsgs = chatMessages('agent')
    expect(agentMsgs.length).toBeGreaterThan(0)
    expect(agentMsgs[0]!.querySelector('.msg-body')!.textContent).toMatch(/revenue/i)
  })

  it('a SECOND, differently-worded message still advances to the SAME next canned turn', async () => {
    await sendMessage('first message, ignored content')
    await waitUntil(() => surfaceCards().length === 1)
    await sendMessage('a totally different second message')
    await waitUntil(() => surfaceCards().length === 2)
    expect(surfaceIdOf(surfaceCards()[1]!)).toBe('feedback-widget')
  })

  it('negative control: the SAME two messages in a FRESH session (post-Reset) replay the identical turn order — proves the rotation is index-driven, not content-driven', async () => {
    await sendMessage('abc')
    await waitUntil(() => surfaceCards().length === 1) // `busy` guards re-entrancy — wait for turn 1 to settle before turn 2
    await sendMessage('def')
    await waitUntil(() => surfaceCards().length === 2)
    const firstRunIds = surfaceCards().map((c) => surfaceIdOf(c))
    clickReset()
    await sendMessage('completely different text this time')
    await waitUntil(() => surfaceCards().length === 1)
    await sendMessage('and again, still different')
    await waitUntil(() => surfaceCards().length === 2)
    const secondRunIds = surfaceCards().map((c) => surfaceIdOf(c))
    expect(secondRunIds).toEqual(firstRunIds)
  })
})

describe('gen-ui-live — the action-event round trip (SPEC-R8, demo-scale: "the agent continues")', () => {
  it('a received action from a rendered surface is shown in chat AND advances to the next turn', async () => {
    await sendMessage('turn 1')
    await waitUntil(() => surfaceCards().length === 1) // `busy` guards re-entrancy — wait for turn 1 to settle before turn 2
    await sendMessage('turn 2') // mounts the feedback-widget surface, whose card is index 1
    await waitUntil(() => surfaceCards().length === 2)

    const feedbackHost = surfaceCards()[1]!.querySelector('ui-sandbox-frame')!
    const systemCountBefore = chatMessages('system').length
    feedbackHost.dispatchEvent(new CustomEvent('action', { detail: { surfaceId: 'feedback-widget', name: 'rate', payload: { stars: 5 } } }))

    await waitUntil(() => chatMessages('system').length > systemCountBefore)
    const received = chatMessages('system').at(-1)!
    expect(received.querySelector('.msg-body')!.textContent).toMatch(/rate/i)
    expect(received.querySelector('.msg-body')!.textContent).toMatch(/feedback-widget/)

    await waitUntil(() => surfaceCards().length === 3)
    expect(surfaceIdOf(surfaceCards()[2]!)).toBe('flow-explainer')
  })

  it('negative control: an action from an UNKNOWN surfaceId still advances the SAME fixed rotation (the page never inspects payload content to pick a turn)', async () => {
    await sendMessage('turn 1')
    await waitUntil(() => surfaceCards().length === 1)
    const anyHost = surfaceCards()[0]!.querySelector('ui-sandbox-frame')!
    anyHost.dispatchEvent(new CustomEvent('action', { detail: { surfaceId: 'not-a-real-surface', name: 'whatever', payload: null } }))
    await waitUntil(() => surfaceCards().length === 2)
    expect(surfaceIdOf(surfaceCards()[1]!)).toBe('feedback-widget')
  })
})

describe('gen-ui-live — Reset restarts the recorded backbone from turn 1', () => {
  it('clears every surface card + the chat log, then replays turn 1 identically', async () => {
    await sendMessage('hello')
    await waitUntil(() => surfaceCards().length === 1)

    clickReset()
    expect(surfaceCards().length).toBe(0)
    expect(chatMessages('agent').length).toBe(0)

    await sendMessage('hello again')
    await waitUntil(() => surfaceCards().length === 1)
    expect(surfaceIdOf(surfaceCards()[0]!)).toBe('q3-revenue')
  })
})

describe('gen-ui-live — the recorded transcript is exhausted gracefully (no further turns)', () => {
  it('after every canned turn plays, the NEXT message shows the "no further turns" system notice, not an error', async () => {
    await sendMessage('t1')
    await waitUntil(() => surfaceCards().length === 1)
    await sendMessage('t2')
    await waitUntil(() => surfaceCards().length === 2)
    await sendMessage('t3')
    await waitUntil(() => surfaceCards().length === 3)
    await sendMessage('t4')
    await waitUntil(() => surfaceCards().length === 4)

    const systemCountBefore = chatMessages('system').length
    await sendMessage('t5 — past the end of the transcript')
    await waitUntil(() => chatMessages('system').length > systemCountBefore)
    expect(chatMessages('system').at(-1)!.textContent).toMatch(/no further turns/i)
    expect(surfaceCards().length).toBe(4) // no fifth surface — nothing new to render
  })
})
