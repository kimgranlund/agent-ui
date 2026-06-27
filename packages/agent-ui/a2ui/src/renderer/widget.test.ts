import { describe, it, expect } from 'vitest'
import { inspect, whenFlushed } from '@agent-ui/components'
import { makeCreateWidget } from './widget.ts'
import type { WidgetDeps } from './widget.ts'
import { createSurface, disposeSurface } from './surface.ts'
import type { A2uiComponent, A2uiError } from '../protocol.ts'
import type { CatalogEntry, CatalogRegistry, WidgetFactory } from '../catalog/types.ts'

// ── Synthetic stubs ───────────────────────────────────────────────────────────
// This slice is decoupled from B-factory / B-registry / binding.ts: it is proven against a stub
// factory (records every applyProp call, creates a real element), a stub registry that resolves one
// catalog id, and a stub binding resolver that reads `surface.data` so the bound-prop effect tracks
// it. The REAL factory + registry + LLD-C5 resolver are wired at the wave-3 renderer host.

const comp = (c: Record<string, unknown>): A2uiComponent => c as A2uiComponent

interface AppliedProp {
  el: HTMLElement
  prop: string
  value: unknown
}

/** A factory that creates a real `tag` element and records every prop the resolver applies. */
function stubFactory(tag = 'ui-button'): { factory: WidgetFactory; applied: AppliedProp[] } {
  const applied: AppliedProp[] = []
  const factory: WidgetFactory = {
    tag,
    create: () => document.createElement(tag),
    applyProp: (el, prop, value) => void applied.push({ el, prop, value }),
  }
  return { factory, applied }
}

/** A registry that resolves exactly `catalogId` to `factories`; every other id is unregistered. */
function stubRegistry(catalogId: string, factories: Record<string, WidgetFactory>): CatalogRegistry {
  const entry = { factories } as unknown as CatalogEntry // `catalog` is irrelevant to widget resolution
  return {
    register: () => {},
    get: (id) => (id === catalogId ? entry : undefined),
    supportedCatalogIds: () => [catalogId],
  }
}

/** A single-segment JSON-pointer reader off `surface.data` — stands in for LLD-C5 (tracks `data`). */
const resolveBinding: WidgetDeps['resolveBinding'] = (binding, surface) => {
  const data = surface.data.value as Record<string, unknown> | undefined
  return data?.[binding.path.replace(/^\//, '')]
}

const init = { id: 's1', catalogId: 'demo', version: 'v1.0' }

function harness(factories: Record<string, WidgetFactory>, registryCatalogId = 'demo') {
  const errors: A2uiError[] = []
  const registry = stubRegistry(registryCatalogId, factories)
  const createWidget = makeCreateWidget({ registry, emitError: (e) => void errors.push(e), resolveBinding })
  return { createWidget, errors }
}

describe('widget resolution — known type (renderer LLD-C7, SPEC-R9)', () => {
  it('resolves node.component to the stub factory element and applies static props', () => {
    const { factory, applied } = stubFactory('ui-button')
    const { createWidget, errors } = harness({ Button: factory })
    const surface = createSurface(init)

    const el = createWidget(comp({ id: 'b1', component: 'Button', label: 'Save', disabled: false }), surface)

    expect(el.tagName.toLowerCase()).toBe('ui-button')
    expect(errors).toEqual([])
    expect(applied).toContainEqual({ el, prop: 'label', value: 'Save' })
    expect(applied).toContainEqual({ el, prop: 'disabled', value: false })
  })

  it('never applies the reserved adjacency keys (id/component/child/children) as props', () => {
    const { factory, applied } = stubFactory()
    const { createWidget } = harness({ Button: factory })
    const surface = createSurface(init)

    createWidget(comp({ id: 'b1', component: 'Button', child: 'c1', children: ['c1'], label: 'X' }), surface)

    expect(applied.map((a) => a.prop)).toEqual(['label']) // only the catalog prop, none of the structural keys
  })

  it('a static-only widget creates no effect → no data subscriber (no leak)', () => {
    const { factory } = stubFactory()
    const { createWidget } = harness({ Button: factory })
    const surface = createSurface(init)

    createWidget(comp({ id: 'b1', component: 'Button', label: 'X' }), surface)

    expect(inspect(surface.data).subscribers).toBe(0)
  })
})

describe('widget resolution — unknown type is non-fatal (SPEC-R9 AC2)', () => {
  it('emits a CATALOG error at the node id and returns a placeholder element (no throw)', () => {
    const { createWidget, errors } = harness({}) // empty factory table
    const surface = createSurface(init)

    let el!: HTMLElement
    expect(() => {
      el = createWidget(comp({ id: 'x1', component: 'Doohickey', label: 'Nope' }), surface)
    }).not.toThrow()

    expect(el.tagName.toLowerCase()).toBe('a2ui-placeholder')
    expect(el.getAttribute('data-component')).toBe('Doohickey')
    expect(el.getAttribute('data-id')).toBe('x1')
    expect(errors).toEqual([
      { code: 'CATALOG', surfaceId: 's1', path: 'x1', message: expect.stringContaining('Doohickey') },
    ])
  })

  it('a surface whose catalog is unregistered also yields a placeholder + CATALOG (defensive)', () => {
    const { factory } = stubFactory()
    const { createWidget, errors } = harness({ Button: factory }, 'some-other-catalog')
    const surface = createSurface(init) // catalogId 'demo' is not what the registry knows

    const el = createWidget(comp({ id: 'b1', component: 'Button' }), surface)

    expect(el.tagName.toLowerCase()).toBe('a2ui-placeholder')
    expect(errors[0]?.code).toBe('CATALOG')
  })

  it('siblings still render: a known node before AND after an unknown one both resolve', () => {
    const { factory } = stubFactory('ui-button')
    const { createWidget, errors } = harness({ Button: factory })
    const surface = createSurface(init)

    const a = createWidget(comp({ id: 'b1', component: 'Button', label: 'A' }), surface)
    const x = createWidget(comp({ id: 'x', component: 'Nope' }), surface)
    const b = createWidget(comp({ id: 'b2', component: 'Button', label: 'B' }), surface)

    expect(a.tagName.toLowerCase()).toBe('ui-button')
    expect(b.tagName.toLowerCase()).toBe('ui-button')
    expect(x.tagName.toLowerCase()).toBe('a2ui-placeholder')
    expect(errors).toHaveLength(1) // only the unknown node faulted
  })
})

describe('widget resolution — bound props (scope-owned effect, SPEC-N2/R5/N3)', () => {
  it('applies the resolved value on mount and re-applies on a data-model change', async () => {
    const { factory, applied } = stubFactory()
    const { createWidget } = harness({ Button: factory })
    const surface = createSurface(init)
    surface.data.value = { label: 'first' }

    const el = createWidget(comp({ id: 'b1', component: 'Button', label: { path: '/label' } }), surface)
    expect(applied.at(-1)).toEqual({ el, prop: 'label', value: 'first' }) // effect's synchronous first run

    surface.data.value = { label: 'second' }
    await whenFlushed() // effect re-runs are microtask-batched
    expect(applied.at(-1)).toEqual({ el, prop: 'label', value: 'second' })
  })

  it('the bound-prop effect is surface.scope-owned → disposeSurface leaves 0 subscribers (N3)', () => {
    const { factory } = stubFactory()
    const { createWidget } = harness({ Button: factory })
    const surface = createSurface(init)
    surface.data.value = { label: 'x' }

    createWidget(comp({ id: 'b1', component: 'Button', label: { path: '/label' } }), surface)
    expect(inspect(surface.data).subscribers).toBe(1) // the bound-prop effect subscribes to data

    disposeSurface(surface)
    expect(inspect(surface.data).subscribers).toBe(0) // scope.dispose() removed it
  })
})
