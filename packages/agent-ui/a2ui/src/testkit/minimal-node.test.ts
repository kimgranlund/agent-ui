// minimal-node.test.ts: the per-type minimal surface derivation (tools/testkit/minimal-node.ts, T-0011).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from '../../tools/testkit/offline.ts'
import { minimalMessages, MinimalUnderivable } from '../../tools/testkit/minimal-node.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import type { Catalog } from '../catalog/catalog.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const componentsOf = (catalog: Catalog, type: string): Record<string, unknown>[] =>
  (minimalMessages(catalog, type)[1] as unknown as { updateComponents: { components: Record<string, unknown>[] } }).updateComponents.components

describe('minimalMessages', () => {
  it('Image gets its required alt', () => {
    expect(defaultCatalog.components.Image!.properties.alt!.required).toBe(true)
    expect(componentsOf(defaultCatalog, 'Image')[0]).toMatchObject({ id: 'root', component: 'Image', alt: 'x' })
  })

  it('CardHeader is wrapped in a Card root', () => {
    const comps = componentsOf(defaultCatalog, 'CardHeader')
    expect(comps[0]).toMatchObject({ id: 'root', component: 'Card' })
    expect(comps.find((c) => c.component === 'CardHeader')).toMatchObject({ id: 'cell' })
  })

  it('Menu gets a Text child', () => {
    const comps = componentsOf(defaultCatalog, 'Menu')
    expect(comps).toContainEqual({ id: 'leaf', component: 'Text', text: 'x' })
    expect(comps[0]).toMatchObject({ id: 'root', component: 'Menu', children: ['leaf'] })
  })

  it('a planted required prop with an unsupported schema raises MINIMAL_UNDERIVABLE', () => {
    const planted: Catalog = {
      ...defaultCatalog,
      components: {
        ...defaultCatalog.components,
        Ghost: { name: 'Ghost', properties: { shape: { type: { oneOf: [{ type: 'string' }, { type: 'number' }] }, mapsTo: 'shape', required: true } } },
      },
    }
    let caught: unknown
    try {
      minimalMessages(planted, 'Ghost')
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(MinimalUnderivable)
    expect((caught as MinimalUnderivable).finding).toMatchObject({ layer: 'catalog', code: 'MINIMAL_UNDERIVABLE' })
  })
})
