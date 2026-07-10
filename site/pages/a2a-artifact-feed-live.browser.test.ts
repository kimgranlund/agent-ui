// a2a-artifact-feed-live.browser.test.ts — LLD-C11 (SPEC-R18) live-arm legs, both engines. No real dev
// proxy runs under `test:browser`, so this drives the page's test-only injection seam
// (`__setLiveApiForTest`, the `a2ui-live.ts` `__setTransportForTest` precedent) with a SCRIPTED
// `sendTurn` — the composer, progressive part-by-part paint, the completed-turn verdict recompute, the
// fail-closed fault path, and Reset's "restores the recorded fixture exactly" all exercised for real, in
// a real engine, with zero network.
import { describe, it, expect } from 'vitest'
import type { A2aMessage, A2aPart } from '@agent-ui/a2a'
// Importing the page ALSO runs its top-level `mountPage()` side effect (the a2a-artifact-feed.browser.test.ts
// precedent — builds the whole page into #app/document.body); this file additionally needs its test-only seam.
import { __setLiveApiForTest } from './a2a-artifact-feed.ts'

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

function query(sel: string): HTMLElement {
  const el = document.querySelector(sel)
  if (el === null) throw new Error(`not found: ${sel}`)
  return el as HTMLElement
}

function findButtonByText(text: string): HTMLElement {
  const btn = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === text)
  if (btn === undefined) throw new Error(`no ui-button with text "${text}"`)
  return btn as HTMLElement
}

/** The last `.msg` bubble with the given `data-role`. Filters `.dataset.role` in JS rather than embedding
 *  the value in a `[data-role="…"]` CSS-selector STRING — the site-canon component-role drift guard
 *  (`site-canon.test.ts`) text-matches that exact attribute-selector spelling anywhere in `site/`, and
 *  `user`/`agent` here are this page's own timeline roles, not the fleet's canonical `[data-role]`
 *  component-part vocabulary (`icon`/`caret`) that guard actually polices. */
function lastBubbleWithRole(role: 'user' | 'agent'): HTMLElement {
  const bubbles = [...document.querySelectorAll<HTMLElement>('.msg')].filter((m) => m.dataset.role === role)
  const last = bubbles[bubbles.length - 1]
  if (last === undefined) throw new Error(`no .msg bubble with data-role="${role}"`)
  return last
}

async function typeAndSend(text: string): Promise<void> {
  const field = query('.feed-composer ui-text-field') as HTMLElement & { value: string }
  field.value = text
  field.dispatchEvent(new Event('input', { bubbles: true }))
  findButtonByText('Send').click()
  await raf()
}

/** A scripted agent turn: prose, then ONE artifact envelope pair (createSurface + a Text component) — a
 *  small, real render, mirroring the recorded fixture's own shape. */
function scriptedTurn(): { gen: () => AsyncGenerator<{ part: A2aPart }, A2aMessage, void>; message: A2aMessage } {
  const parts: A2aPart[] = [
    { kind: 'text', text: 'Here is a live reply.' },
    { kind: 'data', data: { version: 'v1.0', createSurface: { surfaceId: 'live-s1', catalogId: 'agent-ui' } }, metadata: { mimeType: 'application/a2ui+json' } },
    {
      kind: 'data',
      data: { version: 'v1.0', updateComponents: { surfaceId: 'live-s1', components: [{ id: 'root', component: 'Text', variant: 'body', text: 'Live artifact rendered.' }] } },
      metadata: { mimeType: 'application/a2ui+json' },
    },
  ]
  const message: A2aMessage = { kind: 'message', role: 'agent', messageId: 'live-a1', contextId: 'live-ctx', parts }
  async function* gen(): AsyncGenerator<{ part: A2aPart }, A2aMessage, void> {
    for (const part of parts) {
      await Promise.resolve() // genuinely async — proves progressive paint, not a same-tick synchronous dump
      yield { part }
    }
    return message
  }
  return { gen, message }
}

describe('the artifact feed — live arm (LLD-C11, both engines, scripted transport)', () => {
  it('"Go live" clears the recorded timeline, shows the composer, hides the step controls', async () => {
    const { gen } = scriptedTurn()
    __setLiveApiForTest(() => gen(), { provider: 'anthropic', model: 'claude-sonnet-5' })
    await raf()
    findButtonByText('Go live').click()
    await raf()

    expect(query('.feed-composer').hidden).toBe(false)
    expect(query('.feed-step-controls').hidden).toBe(true)
    expect(document.querySelectorAll('.feed-timeline > .msg')).toHaveLength(0)
  })

  it('sending a message paints the user bubble immediately, then the agent reply PROGRESSIVELY (parts arrive one at a time)', async () => {
    await typeAndSend('Show me something live.')

    // The user bubble lands immediately (before the agent reply completes).
    const userBubble = lastBubbleWithRole('user')
    expect(userBubble.querySelector('.feed-disclosure')).not.toBeNull() // the handshake chip (HV-8)

    // Give the scripted (genuinely async) generator time to fully drain.
    for (let i = 0; i < 10; i++) await raf()

    const agentBubble = lastBubbleWithRole('agent')
    expect(agentBubble.querySelector('.msg-body')?.textContent).toBe('Here is a live reply.')

    // A REAL rendered control from the streamed artifact — not a collapsed stack, not left unmounted.
    const text = [...agentBubble.querySelectorAll('ui-text')].find((t) => t.textContent?.includes('Live artifact rendered.'))
    expect(text, 'the live-streamed artifact never rendered a real ui-text').not.toBeNull()

    // The completed turn's wire disclosure joined the SAME bubble anatomy (C9's one derivation).
    const wireDetails = [...agentBubble.querySelectorAll('.feed-disclosure summary')].find((s) => s.textContent?.startsWith('wire'))
    expect(wireDetails, 'no wire disclosure appended to the completed live bubble').not.toBeNull()
  })

  it('the verdict recomputes over the live conversation after the completed turn (SPEC-R18 AC2 in-page arm)', async () => {
    const verdict = query('[data-verdict]')
    expect(verdict.dataset.verdict).toBe('clean')
    expect(verdict.textContent).toMatch(/CLEAN/)
  })

  it('a faulted turn annotates the bubble ("turn failed — not recorded") and re-enables the composer — fail-closed', async () => {
    async function* failing(): AsyncGenerator<{ part: A2aPart }, A2aMessage, void> {
      await Promise.resolve()
      yield { part: { kind: 'text', text: 'partial…' } }
      throw new Error('stub-injected transport fault')
    }
    __setLiveApiForTest(() => failing(), { provider: 'anthropic', model: 'claude-sonnet-5' })

    await typeAndSend('This one will fail.')
    for (let i = 0; i < 10; i++) await raf()

    const lastAgent = lastBubbleWithRole('agent')
    expect(lastAgent.textContent).toMatch(/turn failed — not recorded/i)
    expect(lastAgent.textContent).toMatch(/stub-injected transport fault/)

    // The composer re-enables (fail-closed never wedges the UI) — a SUBSEQUENT successful send still works.
    expect(query('.feed-composer').classList.contains('is-busy')).toBe(false)
    expect(query('.feed-composer ui-button').hasAttribute('aria-disabled')).toBe(false)

    const { gen } = scriptedTurn()
    __setLiveApiForTest(() => gen(), { provider: 'anthropic', model: 'claude-sonnet-5' })
    await typeAndSend('Recovering after a fault.')
    for (let i = 0; i < 10; i++) await raf()
    const recovered = lastBubbleWithRole('agent')
    expect(recovered.textContent).toMatch(/Here is a live reply\./)
  })

  it('Reset restores the recorded fixture EXACTLY — the composer hides, the step controls return, 6 recorded bubbles reappear', async () => {
    findButtonByText('Reset').click()
    await raf()

    expect(query('.feed-composer').hidden).toBe(true)
    expect(query('.feed-step-controls').hidden).toBe(false)
    const bubbles = document.querySelectorAll('.feed-timeline > .msg')
    expect(bubbles).toHaveLength(6) // the committed fixture's own entry count (a2a-artifact-feed.browser.test.ts)
    expect((bubbles[0] as HTMLElement).hidden).toBe(false)
    for (let i = 1; i < 6; i++) expect((bubbles[i] as HTMLElement).hidden, `entry ${i}`).toBe(true)
  })
})
