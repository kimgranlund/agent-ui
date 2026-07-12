// surface-registry.test.ts — a2ui-chat.lld.md LLD-C2/LLD-C8: the per-surface lifecycle mechanism, jsdom-
// covered (the `ask-registry.test.ts` precedent). Proves create()/get()/has()/close()/disposeAll()'s
// contract in isolation from the page's routing/transport pipeline.

import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/components' // self-defines ui-* controls so the renderer's nodes upgrade
import { SurfaceRegistry } from './surface-registry.ts'

describe('SurfaceRegistry (a2ui-chat LLD-C2)', () => {
  const mounted: HTMLElement[] = []
  afterEach(() => {
    while (mounted.length) mounted.pop()?.remove()
  })

  function fixture(): { bubble: HTMLElement; mount: HTMLElement } {
    const bubble = document.createElement('div')
    const mount = document.createElement('div')
    bubble.append(mount)
    document.body.append(bubble)
    mounted.push(bubble)
    return { bubble, mount }
  }

  it("create() mounts a fresh host as 'open'; get()/has() see it; a duplicate surfaceId THROWS (collision guard is the caller's job)", () => {
    const registry = new SurfaceRegistry()
    const { bubble, mount } = fixture()
    const entry = registry.create('canvas', bubble, mount, () => {})
    expect(entry.state).toBe('open')
    expect(entry.bubble).toBe(bubble)
    expect(entry.mount).toBe(mount)
    expect(registry.get('canvas')).toBe(entry)
    expect(registry.has('canvas')).toBe(true)
    expect(registry.size).toBe(1)

    const { bubble: bubble2, mount: mount2 } = fixture()
    expect(() => registry.create('canvas', bubble2, mount2, () => {})).toThrow(/already known/)
  })

  it('a real surface (Button) renders into `mount` via the created host', () => {
    const registry = new SurfaceRegistry()
    const { mount } = fixture()
    const entry = registry.create('canvas', document.createElement('div'), mount, () => {})
    entry.host.ingest('{"version":"v1.0","createSurface":{"surfaceId":"canvas","catalogId":"agent-ui"}}')
    entry.host.ingest(
      '{"version":"v1.0","updateComponents":{"surfaceId":"canvas","components":[{"id":"root","component":"Button","label":"Go","action":{"action":"submit"}}]}}',
    )
    entry.host.finalize()
    expect(mount.querySelector('ui-button')).not.toBeNull()
  })

  it("close() disposes exactly that surface's host (its mount's DOM is torn down) and annotates exactly its own bubble 'Closed.' — a SIBLING surface's bubble/mount are untouched", () => {
    const registry = new SurfaceRegistry()
    const { bubble: canvasBubble, mount: canvasMount } = fixture()
    const { bubble: confirmBubble, mount: confirmMount } = fixture()
    const canvas = registry.create('canvas', canvasBubble, canvasMount, () => {})
    registry.create('confirmation', confirmBubble, confirmMount, () => {})
    canvas.host.ingest('{"version":"v1.0","createSurface":{"surfaceId":"canvas","catalogId":"agent-ui"}}')
    canvas.host.ingest('{"version":"v1.0","updateComponents":{"surfaceId":"canvas","components":[{"id":"root","component":"Text","text":"hi"}]}}')
    canvas.host.finalize()
    expect(canvasMount.querySelector('ui-text')).not.toBeNull()

    expect(registry.close('confirmation')).toBe(true)

    expect(registry.get('confirmation')!.state).toBe('closed')
    expect(confirmBubble.dataset.state).toBe('closed')
    expect(confirmBubble.querySelector('.surface-annotation')?.textContent).toBe('Closed.')

    // the SIBLING surface (canvas) is completely untouched
    expect(registry.get('canvas')!.state).toBe('open')
    expect(canvasBubble.dataset.state).toBeUndefined()
    expect(canvasMount.querySelector('ui-text'), "canvas's rendered DOM must survive confirmation's close").not.toBeNull()
  })

  it('close() is idempotent (a second close call is a no-op, never re-appends the annotation) and false on an unknown id', () => {
    const registry = new SurfaceRegistry()
    const { bubble, mount } = fixture()
    registry.create('confirmation', bubble, mount, () => {})

    expect(registry.close('confirmation')).toBe(true)
    expect(bubble.querySelectorAll('.surface-annotation')).toHaveLength(1)

    expect(registry.close('confirmation')).toBe(false)
    expect(bubble.querySelectorAll('.surface-annotation'), 'a second close() must not append a second annotation').toHaveLength(1)

    expect(registry.close('nope')).toBe(false)
  })

  it('disposeAll() disposes every host and clears the registry — get()/has() see nothing after, including an already-closed entry', () => {
    const registry = new SurfaceRegistry()
    const { bubble: b1, mount: m1 } = fixture()
    const { bubble: b2, mount: m2 } = fixture()
    registry.create('canvas', b1, m1, () => {})
    const confirmation = registry.create('confirmation', b2, m2, () => {})
    registry.close('confirmation')
    expect(registry.size).toBe(2)

    registry.disposeAll()

    expect(registry.size).toBe(0)
    expect(registry.get('canvas')).toBeUndefined()
    expect(registry.get('confirmation')).toBeUndefined()
    expect(registry.has('canvas')).toBe(false)
    // the already-closed entry's host was disposed a SECOND time by disposeAll — dispose() is idempotent-safe
    expect(() => confirmation.host.finalize()).not.toThrow()
  })
})
