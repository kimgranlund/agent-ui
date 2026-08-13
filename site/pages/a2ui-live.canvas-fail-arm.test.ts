// a2ui-live.canvas-fail-arm.test.ts — GH #810 (PR #809's own review follow-up): PR #809's disable-on-action
// mechanism lives at the `ui-surface-host` grain (self-wired, `surface-host.ts`), so `canvasHost` — the
// persistent shared Canvas tab this page composes standalone (ADR-0129 Fork B, never through `<ui-
// conversation>`) — already inherits the DISABLE half for free. The fail-path RE-ENABLE arm is this page's
// own job (`ui-conversation`'s equivalent `AgentTurnHandle.fail()` has no standalone-canvas analogue here):
// `runTurn`'s two failure legs (the GH #408 transportError branch and the thrown-exception catch block) each
// call `canvasHost.setInteractiveDisabled(false)` — Kim's 2026-08-13 ruling (fail arm everywhere, no
// click-once carve-out).
//
// Same scripted-transport idiom as `a2ui-live.ask-lifecycle.test.ts` (its own file header explains the
// deferred-import ordering requirement and why jsdom is the right tier here — DOM state/attribute mutation,
// not real `pointer-events`/computed-style truth, which is `agent-admin-click-turn.browser.test.ts`'s job for
// the SAME underlying surface-host mechanism).
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { AgentTransport, TurnInput } from '../lib/agent-runtime.ts'

let __setTransportForTest: (next: AgentTransport, live?: boolean) => void

beforeAll(async () => {
  const mod = await import('./a2ui-live.ts')
  __setTransportForTest = mod.__setTransportForTest
})

function scriptedTransport(byTurn: (turnIndex: number, input: TurnInput) => string[]): AgentTransport {
  let turnIndex = 0
  return {
    async *turn(input: TurnInput): AsyncIterable<string> {
      turnIndex += 1
      const lines = byTurn(turnIndex, input) // may throw — the failure leg depends on this
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

async function sendIntent(text: string): Promise<void> {
  const editor = document.querySelector('.chat-composer [data-part="editor"]') as HTMLElement
  editor.textContent = text
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  const sendBtn = document.querySelector('.chat-composer [data-part="send"]') as HTMLElement
  sendBtn.click()
}

function resetPage(): void {
  const resetBtn = [...document.querySelectorAll<HTMLElement>('ui-button')].find((b) => b.textContent?.trim() === 'Reset')
  resetBtn?.click()
}

/** The persistent canvas's own mounted button (the ONE `ui-surface-host` tag on this page — ask bubbles
 *  mount a bare `createRenderer()` into a plain `div.ask-surface`, never a `<ui-surface-host>`, so this
 *  selector can never collide with an ask card). */
function canvasButton(): (HTMLElement & { disabled: boolean }) | null {
  return document.querySelector("ui-surface-host [data-part='surface'] ui-button")
}

function canvasLines(surfaceId: string, label: string): string[] {
  return [
    `{"version":"v1.0","createSurface":{"surfaceId":"${surfaceId}","catalogId":"agent-ui"}}`,
    `{"version":"v1.0","updateComponents":{"surfaceId":"${surfaceId}","components":[{"id":"root","component":"Button","variant":"solid","label":"${label}","action":{"action":"go"}}]}}`,
  ]
}

beforeEach(() => {
  resetPage()
})

describe('a2ui-live — GH #810: the persistent canvas re-enables after its own action turn fails', () => {
  it('a thrown turn (the catch-block leg) re-enables the canvas — never a stranded disabled card', async () => {
    __setTransportForTest(
      scriptedTransport((turn) => {
        if (turn === 1) return canvasLines('canvas-1', 'Go')
        throw new Error('boom')
      }),
    )

    await sendIntent('render a button')
    await waitUntil(() => canvasButton() !== null)
    const btn = canvasButton()!
    expect(btn.disabled).toBe(false)

    btn.click() // the real onClientMessage round-trip → runTurn(turn 2), which throws
    expect(btn.disabled, "surface-host.ts's own self-wired listener disables synchronously on click").toBe(true)

    await waitUntil(() => chatMessages('system').some((m) => m.textContent?.includes('⚠')))
    expect(btn.disabled, 'GH #810: a thrown turn must re-enable the canvas, not strand it disabled').toBe(false)
  })

  it('a transport-composed error line (GH #408, the transportError leg — never reaching a JS throw) also re-enables the canvas', async () => {
    __setTransportForTest(
      scriptedTransport((turn) => {
        if (turn === 1) return canvasLines('canvas-2', 'Go')
        return [JSON.stringify({ a2uiMeta: { error: 'ProduceHalt: exhausted self-correct rounds' } })]
      }),
    )

    await sendIntent('render a button')
    await waitUntil(() => canvasButton() !== null)
    const btn = canvasButton()!

    btn.click()
    expect(btn.disabled).toBe(true)

    await waitUntil(() => chatMessages('system').some((m) => m.textContent?.includes('⚠')))
    expect(btn.disabled, 'GH #810: a transport-composed error must ALSO re-enable the canvas (the transportError leg is a distinct code path from the catch block)').toBe(false)
  })

  it('a SUCCESSFUL turn that re-renders the canvas already re-enables it via ingest() — the fail-arm is a no-op there (no double-fire)', async () => {
    __setTransportForTest(
      scriptedTransport((turn) => (turn === 1 ? canvasLines('canvas-3', 'Go') : canvasLines('canvas-3', 'Go again')))
    )

    await sendIntent('render a button')
    await waitUntil(() => canvasButton() !== null)
    const btn = canvasButton()!

    btn.click()
    expect(btn.disabled).toBe(true)

    await waitUntil(() => canvasButton()?.textContent?.trim() === 'Go again')
    expect(canvasButton()?.disabled, "ingest()'s own re-enable-on-entry already covers the success path (surface-host.ts)").toBe(false)
  })
})
