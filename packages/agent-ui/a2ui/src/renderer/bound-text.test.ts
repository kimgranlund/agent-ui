// bound-text.test.ts — TKT-0077 regression probe: a BOUND `Text.text` (the one non-identity
// `mapsTo: textContent` prop with a bindable path) renders its data-model value when the data lands
// BEFORE updateComponents — the exact card-tile shape the game mini-skills teach. The live empty-tile
// defect this diagnosed was payload variance (a bound path the same turn never set), not this seam;
// this pin keeps the renderer half of that claim honest.
import { describe, it, expect } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { createRenderer } from './renderer.ts'
import type { A2uiServerMessage } from '../protocol.ts'

const line = (m: A2uiServerMessage): string => JSON.stringify(m)

describe('bound Text.text — the TKT-0077 empty card tile', () => {
  it('data-first: a Text bound to /dealer/c1 renders the glyph', async () => {
    const r = createRenderer()
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    r.mount(mount)

    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'table', catalogId: 'agent-ui' } }))
    r.ingest(line({ version: 'v1.0', updateDataModel: { surfaceId: 'table', value: { dealer: { c1: '9♣' } } } } as unknown as A2uiServerMessage))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'table',
          components: [
            { id: 'root', component: 'Card', elevation: '1', children: ['t'] },
            { id: 't', component: 'Text', variant: 'h3', emphasis: true, text: { path: '/dealer/c1' } },
          ],
        },
      } as unknown as A2uiServerMessage),
    )
    await whenFlushed()
    const text = mount.querySelector('ui-text')
    expect(text?.textContent?.trim()).toBe('9♣')
    r.dispose()
    mount.remove()
  })

  it('components-FIRST: a Text bound to a path set by a LATER updateDataModel repaints with the glyph', async () => {
    const r = createRenderer()
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    r.mount(mount)

    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'table', catalogId: 'agent-ui' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'table',
          components: [
            { id: 'root', component: 'Card', elevation: '1', children: ['t'] },
            { id: 't', component: 'Text', variant: 'h3', emphasis: true, text: { path: '/dealer/c1' } },
          ],
        },
      } as unknown as A2uiServerMessage),
    )
    await whenFlushed()
    r.ingest(line({ version: 'v1.0', updateDataModel: { surfaceId: 'table', value: { dealer: { c1: '9♣' } } } } as unknown as A2uiServerMessage))
    await whenFlushed()
    const text = mount.querySelector('ui-text')
    expect(text?.textContent?.trim()).toBe('9♣')
    r.dispose()
    mount.remove()
  })

  it('components-FIRST + the PER-PATH updateDataModel form also repaints the bound Text', async () => {
    const r = createRenderer()
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    r.mount(mount)

    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'table', catalogId: 'agent-ui' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'table',
          components: [
            { id: 'root', component: 'Card', elevation: '1', children: ['t'] },
            { id: 't', component: 'Text', variant: 'h3', emphasis: true, text: { path: '/dealer/c1' } },
          ],
        },
      } as unknown as A2uiServerMessage),
    )
    await whenFlushed()
    r.ingest(line({ version: 'v1.0', updateDataModel: { surfaceId: 'table', path: '/dealer/c1', value: '9♣' } } as unknown as A2uiServerMessage))
    await whenFlushed()
    const text = mount.querySelector('ui-text')
    expect(text?.textContent?.trim()).toBe('9♣')
    r.dispose()
    mount.remove()
  })

  // TKT-0080 — the LIVE empty-tile root cause, pinned from the captured Croupier wire: a ChildList
  // template item binding item fields. RELATIVE `{"path":"glyph"}` resolves per-item (scopedPointer
  // rewrites it to `/hand/{i}/glyph`); a LEADING-SLASH `{"path":"/glyph"}` is ABSOLUTE by contract
  // (binding.ts:118) and reads the whole-model `/glyph` — nothing there ⇒ an empty tile. The second
  // probe is the negative control DOCUMENTING the trap the producer grammar now teaches against.
  it('a ChildList template item binds item fields with RELATIVE paths — {"path":"glyph"} renders per-item', async () => {
    const r = createRenderer()
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    r.mount(mount)

    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'table', catalogId: 'agent-ui' } }))
    r.ingest(line({ version: 'v1.0', updateDataModel: { surfaceId: 'table', value: { hand: [{ glyph: '9♠' }, { glyph: '7♦' }] } } } as unknown as A2uiServerMessage))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'table',
          components: [
            { id: 'root', component: 'Row', gap: 'sm', children: { path: '/hand', componentId: 'tile' } },
            { id: 'tile', component: 'Text', variant: 'h3', text: { path: 'glyph' } },
          ],
        },
      } as unknown as A2uiServerMessage),
    )
    await whenFlushed()
    const texts = [...mount.querySelectorAll('ui-text')].map((t) => t.textContent?.trim())
    expect(texts).toEqual(['9♠', '7♦'])
    r.dispose()
    mount.remove()
  })

  it('negative control — a LEADING-SLASH {"path":"/glyph"} inside a template is ABSOLUTE and renders empty', async () => {
    const r = createRenderer()
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    r.mount(mount)

    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'table', catalogId: 'agent-ui' } }))
    r.ingest(line({ version: 'v1.0', updateDataModel: { surfaceId: 'table', value: { hand: [{ glyph: '9♠' }] } } } as unknown as A2uiServerMessage))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'table',
          components: [
            { id: 'root', component: 'Row', gap: 'sm', children: { path: '/hand', componentId: 'tile' } },
            { id: 'tile', component: 'Text', variant: 'h3', text: { path: '/glyph' } },
          ],
        },
      } as unknown as A2uiServerMessage),
    )
    await whenFlushed()
    const texts = [...mount.querySelectorAll('ui-text')].map((t) => t.textContent?.trim())
    expect(texts).toEqual(['']) // stamped, but the absolute path reads whole-model /glyph — nothing there
    r.dispose()
    mount.remove()
  })
})
