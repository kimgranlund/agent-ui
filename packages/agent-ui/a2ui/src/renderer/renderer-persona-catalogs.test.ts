// renderer-persona-catalogs.test.ts — SPEC-R2's constructor-time derive-then-register step
// (`persona-catalog-composition.spec.md`), driven through the REAL `Renderer` constructor — every other
// compose/derive coverage (`catalog/compose.test.ts`) exercises `composePersonaCatalogs` against
// synthetic registries/arrays, never `createRenderer()`'s own wiring (`renderer.ts`'s constructor).
// `RendererHost` exposes no direct registry read, so registration is proven the same BLACK-BOX way
// `renderer.test.ts`'s own CATALOG_UNKNOWN test proves an id is UNRESOLVED: feed a real `createSurface`
// naming the derived id and assert NO `CATALOG_UNKNOWN`/`VALIDATION_FAILED` fires, then a real
// `FixtureBanner` root actually renders as a real `<div>` under the mount.

import { describe, it, expect } from 'vitest'
import { createRenderer } from './renderer.ts'
import type { A2uiClientMessage, RendererHost } from './renderer.ts'
import type { A2uiServerMessage } from '../protocol.ts'

const line = (message: A2uiServerMessage): string => JSON.stringify(message)
const isError = (m: A2uiClientMessage): m is Extract<A2uiClientMessage, { error: unknown }> => 'error' in m

function harness(): { r: RendererHost; mount: HTMLElement; sent: A2uiClientMessage[]; cleanup: () => void } {
  const sent: A2uiClientMessage[] = []
  const r = createRenderer()
  r.onClientMessage((m) => void sent.push(m))
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  r.mount(mount)
  return { r, mount, sent, cleanup: () => { r.dispose(); mount.remove() } }
}

describe('createRenderer — SPEC-R2 derive-then-register wiring, real constructor', () => {
  it('agent-ui--fixture-demo resolves: no CATALOG_UNKNOWN, and a real FixtureBanner <div> renders', () => {
    const { r, mount, sent, cleanup } = harness()
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui--fixture-demo' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'FixtureBanner', text: 'from the fixture' }] },
      }),
    )
    expect(sent.filter(isError)).toEqual([]) // no CATALOG_UNKNOWN — the derived catalog really registered
    const banner = mount.querySelector('div')
    expect(banner, 'the derived catalog\'s own FixtureBanner factory really rendered').not.toBeNull()
    expect(banner!.textContent).toBe('from the fixture')
    cleanup()
  })

  it('a2ui-basic--fixture-demo resolves too — the SAME fragment composed independently over the OTHER base', () => {
    const { r, mount, sent, cleanup } = harness()
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's2', catalogId: 'a2ui-basic--fixture-demo' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 's2', components: [{ id: 'root', component: 'FixtureBanner', text: 'basic base too' }] },
      }),
    )
    expect(sent.filter(isError)).toEqual([])
    const banner = mount.querySelector('div')
    expect(banner).not.toBeNull()
    expect(banner!.textContent).toBe('basic base too')
    cleanup()
  })

  it('a2ui-basic--fixture-demo ALSO resolves the base catalog\'s own component types (the union, SPEC-R2 AC2)', () => {
    const { r, mount, sent, cleanup } = harness()
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's3', catalogId: 'a2ui-basic--fixture-demo' } }))
    r.ingest(
      line({ version: 'v1.0', updateComponents: { surfaceId: 's3', components: [{ id: 'root', component: 'Text', text: 'base type' }] } }),
    )
    expect(sent.filter(isError)).toEqual([])
    expect(mount.querySelector('ui-text')).not.toBeNull()
    cleanup()
  })

  it('the a2ui-basic canonical-URI alias itself is untouched — it never gained a --fixture-demo derived pairing', () => {
    const { r, mount, sent, cleanup } = harness()
    const CANONICAL_URI = 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json'
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's4', catalogId: `${CANONICAL_URI}--fixture-demo` } }))
    r.ingest(line({ version: 'v1.0', updateComponents: { surfaceId: 's4', components: [{ id: 'root', component: 'FixtureBanner' }] } }))
    // ADR-0031: CATALOG_UNKNOWN (internal) maps to VALIDATION_FAILED on the wire.
    expect(sent.filter(isError).map((m) => m.error.code)).toEqual(['VALIDATION_FAILED'])
    expect(mount.querySelector('div')).toBeNull()
    cleanup()
  })
})
