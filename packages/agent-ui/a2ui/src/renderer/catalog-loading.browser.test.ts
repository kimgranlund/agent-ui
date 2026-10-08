// catalog-loading.browser.test.ts: lazy catalog bodies load by catalog id in a real engine (ADR-0241), the analog
// of `control-loading.browser.test.ts`. jsdom resolves a dynamic import in-process; here the a2ui-basic body and
// the persona compose step arrive as real module fetches, and only then does the control gate define the
// controls the surface names.
//
// Sound because importing the renderer loads neither body nor fleet tag (vitest browser mode runs each test file
// on its own page): each scenario first asserts its controls are undefined, and asserts that nothing renders in
// the tick of the ingest, so a body or control already present fails loudly instead of passing.

import { describe, it, expect, vi } from 'vitest'
import { createRenderer } from './renderer.ts'
import type { A2uiClientMessage, RendererHost } from './renderer.ts'

function host(): { r: RendererHost; mount: HTMLElement; errors: A2uiClientMessage[]; cleanup: () => void } {
  const errors: A2uiClientMessage[] = []
  const r = createRenderer()
  r.onClientMessage((m) => {
    if ('error' in m) errors.push(m)
  })
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  r.mount(mount)
  return { r, mount, errors, cleanup: () => { r.dispose(); mount.remove() } }
}

describe('renderer catalog loading (real engine)', () => {
  it('an a2ui-basic surface waits for its body chunk, then for its controls, then renders', async () => {
    expect(customElements.get('ui-text')).toBeUndefined()
    const { r, mount, errors, cleanup } = host()

    r.ingest(JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: 'b', catalogId: 'a2ui-basic' } }))
    r.ingest(
      JSON.stringify({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'b',
          components: [
            { id: 'root', component: 'Column', children: ['t'] },
            { id: 't', component: 'Text', text: 'from the lazy body' },
          ],
        },
      }),
    )
    expect(mount.children).toHaveLength(0) // deferred behind the catalog gate

    await vi.waitFor(() => expect(mount.querySelector('ui-text')?.textContent).toContain('from the lazy body'), { timeout: 10_000 })
    expect(mount.querySelector('ui-text')).toBeInstanceOf(customElements.get('ui-text')!)
    expect(errors).toEqual([])
    cleanup()
  })

  it('a derived persona id composes when its body loads: agent-ui--croupier renders a real ui-playing-card', async () => {
    expect(customElements.get('ui-playing-card')).toBeUndefined()
    const { r, mount, errors, cleanup } = host()

    r.ingest(JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: 'c', catalogId: 'agent-ui--croupier' } }))
    r.ingest(
      JSON.stringify({
        version: 'v1.0',
        updateComponents: { surfaceId: 'c', components: [{ id: 'root', component: 'PlayingCard', rank: 'Q', suit: 'diamonds' }] },
      }),
    )
    expect(mount.children).toHaveLength(0)

    await vi.waitFor(() => expect(mount.querySelector('ui-playing-card')).not.toBeNull(), { timeout: 10_000 })
    const card = mount.querySelector('ui-playing-card')!
    expect(card).toBeInstanceOf(customElements.get('ui-playing-card')!)
    expect((card as unknown as { rank: string }).rank).toBe('Q')
    expect(errors).toEqual([])
    cleanup()
  })
})
