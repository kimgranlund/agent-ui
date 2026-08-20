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

// ── GH #497 content personas — concierge (BookingForm/BookingConfirmation) + croupier (PlayingCard) ──
//
// jsdom reality (verified — see `concierge/factories.test.ts`'s header): a REAL `UIFormElement`-based
// control's `connectedCallback` runs ElementInternals form-association effects jsdom does not implement.
// The BookingForm leg below deliberately uses `fields: []` (no inner ui-calendar/ui-select/ui-checkbox
// ever gets created, let alone connected) so it stays jsdom-safe while still proving SPEC-R2's
// derive-then-register wiring end-to-end for `BookingForm` itself (`ui-form-provider` carries no form
// association of its own — form-provider.ts extends `UIElement` directly, never `UIFormElement`). Full
// connected/submit/gating/aggregation behavior is proven in a real browser —
// `catalog/personas/concierge/concierge.browser.test.ts`. `PlayingCard` (`ui-card`+`ui-text`, neither
// form-associated) has no such gap and is proven fully connected here.

describe('createRenderer — GH #497 concierge/croupier content personas (SPEC-R2 derive-then-register wiring, real constructor)', () => {
  it('agent-ui--concierge resolves BookingForm as a real ui-form-provider (fields: [] — jsdom-safe)', () => {
    const { r, mount, sent, cleanup } = harness()
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's5', catalogId: 'agent-ui--concierge' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 's5', components: [{ id: 'root', component: 'BookingForm', title: 'Book your stay', fields: [] }] },
      }),
    )
    expect(sent.filter(isError)).toEqual([])
    const form = mount.querySelector('ui-form-provider')
    expect(form, 'the derived catalog\'s own BookingForm factory really rendered').not.toBeNull()
    expect(form!.querySelector('[data-part="title"]')?.textContent).toBe('Book your stay')
    cleanup()
  })

  it('agent-ui--concierge resolves BookingConfirmation as a real ui-card, rows bound to a live data-model object', () => {
    const { r, mount, sent, cleanup } = harness()
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's6', catalogId: 'agent-ui--concierge' } }))
    r.ingest(line({ version: 'v1.0', updateDataModel: { surfaceId: 's6', path: '/booking', value: { checkIn: '2026-08-10' } } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's6',
          components: [
            {
              id: 'root',
              component: 'BookingConfirmation',
              title: 'Your booking',
              rows: [{ label: 'Check-in', path: 'checkIn' }],
              data: { path: '/booking' },
            },
          ],
        },
      }),
    )
    expect(sent.filter(isError)).toEqual([])
    const card = mount.querySelector('ui-card')
    expect(card).not.toBeNull()
    // Never a producer literal — this text can ONLY have come from the bound `/booking` path (§1 argument b).
    expect(card!.querySelector('[data-a2ui-confirmation-row] [data-part="value"]')?.textContent).toBe('2026-08-10')
    cleanup()
  })

  it('a2ui-basic--concierge resolves too — the SAME fragment composed independently over the OTHER base', () => {
    const { r, mount, sent, cleanup } = harness()
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's7', catalogId: 'a2ui-basic--concierge' } }))
    r.ingest(line({ version: 'v1.0', updateComponents: { surfaceId: 's7', components: [{ id: 'root', component: 'BookingForm', fields: [] }] } }))
    expect(sent.filter(isError)).toEqual([])
    expect(mount.querySelector('ui-form-provider')).not.toBeNull()
    cleanup()
  })

  it('agent-ui--croupier resolves PlayingCard as a real, fully-connected ui-playing-card (ADR-0225 retarget)', () => {
    const { r, mount, sent, cleanup } = harness()
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's8', catalogId: 'agent-ui--croupier' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 's8', components: [{ id: 'root', component: 'PlayingCard', rank: 'K', suit: 'spades' }] },
      }),
    )
    expect(sent.filter(isError)).toEqual([])
    const card = mount.querySelector('ui-playing-card')
    expect(card).not.toBeNull()
    expect((card as unknown as { rank: string }).rank).toBe('K')
    expect((card as unknown as { suit: string }).suit).toBe('spades')
    cleanup()
  })

  it('a2ui-basic--croupier resolves too — the SAME fragment composed independently over the OTHER base', () => {
    const { r, mount, sent, cleanup } = harness()
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's9', catalogId: 'a2ui-basic--croupier' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 's9', components: [{ id: 'root', component: 'PlayingCard', rank: 'A', suit: 'hearts', faceDown: false }] },
      }),
    )
    expect(sent.filter(isError)).toEqual([])
    const card = mount.querySelector('ui-playing-card')
    expect(card).not.toBeNull()
    expect((card as unknown as { rank: string }).rank).toBe('A')
    expect((card as unknown as { suit: string }).suit).toBe('hearts')
    expect((card as unknown as { faceDown: boolean }).faceDown).toBe(false)
    cleanup()
  })

  // GH #497's own "byte-compatible" acceptance criterion: a persona with NO local set (the plain base
  // catalogId, no `--<persona>` suffix) composes/renders IDENTICALLY to today's default, even with
  // concierge/croupier now registered alongside it — `composeCatalog` never mutates `base` (compose.ts),
  // it only ever produces NEW derived catalogs, so the plain `agent-ui`/`a2ui-basic` entries are
  // untouched by the two new personas' presence.
  it('byte-compat: a plain "agent-ui" surface (no persona suffix) still renders an ordinary Button exactly as before', () => {
    const { r, mount, sent, cleanup } = harness()
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's10', catalogId: 'agent-ui' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 's10', components: [{ id: 'root', component: 'Button', label: 'Book now' }] },
      }),
    )
    expect(sent.filter(isError)).toEqual([])
    const button = mount.querySelector('ui-button')
    expect(button).not.toBeNull()
    expect(button!.textContent).toBe('Book now')
    // The two new persona types are NOT part of the plain base — proving the base's own component set
    // (not merely "still renders SOMETHING") is untouched.
    expect(mount.querySelector('ui-form-provider')).toBeNull()
    cleanup()
  })

  it('byte-compat: a plain "a2ui-basic" surface (no persona suffix) still renders its own base types exactly as before', () => {
    const { r, mount, sent, cleanup } = harness()
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's11', catalogId: 'a2ui-basic' } }))
    r.ingest(line({ version: 'v1.0', updateComponents: { surfaceId: 's11', components: [{ id: 'root', component: 'Text', text: 'base type' }] } }))
    expect(sent.filter(isError)).toEqual([])
    expect(mount.querySelector('ui-text')).not.toBeNull()
    cleanup()
  })
})
