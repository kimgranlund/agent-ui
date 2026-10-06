// control-loading.browser.test.ts: the renderer loads a control and its sheet on demand in a real engine
// (ADR-0233). jsdom never fires `load` on a `<link>`, so the default URL mode (the loader links the sheet)
// is proven here only.
//
// Sound with real fleet tags because importing the renderer defines no fleet tag: the catalog factory
// modules import no control, and vitest browser mode runs each test file on its own page. The first
// assertion checks that `ui-table` is undefined, so a pre-defined fleet fails loudly instead of passing.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { CONTROLS } from '@agent-ui/components/registry'
import { createControlLoader } from '@agent-ui/components/loader'
import { createRenderer } from './renderer.ts'
import type { A2uiClientMessage } from './renderer.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { defaultFactories } from '../catalog/default/factories.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('renderer control loading (real engine)', () => {
  it('a Table surface defines ui-table, links table.css once, and the sheet styles the rendered control', async () => {
    expect(customElements.get('ui-table')).toBeUndefined()

    const errors: A2uiClientMessage[] = []
    const r = createRenderer()
    r.onClientMessage((m) => {
      if ('error' in m) errors.push(m)
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {}) // "re-registered — last registration wins"
    // One entry per catalog id, the last registration wins: the default catalog, now in the loader's default
    // URL mode (it links each defined control's sheet) instead of the built-in `'host'` mode.
    r.register(defaultCatalog, defaultFactories, undefined, createControlLoader(CONTROLS))
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    r.mount(mount)

    r.ingest(JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: 't', catalogId: 'agent-ui' } }))
    r.ingest(
      JSON.stringify({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 't',
          components: [{ id: 'root', component: 'Table', columns: [{ key: 'name', label: 'Name' }], rows: [{ name: 'Ada' }] }],
        },
      }),
    )
    expect(mount.querySelector('ui-table')).toBeNull() // deferred until ui-table is defined and its sheet loaded

    await vi.waitFor(() => expect(mount.querySelector('ui-table')).not.toBeNull(), { timeout: 10_000 })

    expect(customElements.get('ui-table')).toBeDefined()
    expect(document.head.querySelectorAll('link[data-ui-control="ui-table"]')).toHaveLength(1)
    const table = mount.querySelector('ui-table')!
    expect(table).toBeInstanceOf(customElements.get('ui-table')!)
    expect(getComputedStyle(table).getPropertyValue('--ui-table-min-inline-size').trim()).toBe('16em')
    expect(errors).toEqual([])

    r.dispose()
    mount.remove()
  })
})
