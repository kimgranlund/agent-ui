// persona-controls.test.ts: a persona package's `controls` records on the derived catalog entry (ADR-0233).
//
// Vacuity rule: importing the renderer defines the whole fleet, so the base loader, the persona records and
// every rendered tag are `x-ctl-probe-*` fixtures. Each scenario first asserts its probe tags are undefined.

import { describe, it, expect, vi } from 'vitest'
import { createControlLoader } from '@agent-ui/components/loader'
import type { ControlRecord } from '@agent-ui/components/loader'
import { Registry } from './registry.ts'
import { composeControlLoaders, composePersonaCatalogs, derivedCatalogId, loadCatalogFragment } from './compose.ts'
import type { PersonaCatalogPackage } from './compose.ts'
import type { WidgetFactory } from './types.ts'
import { createRenderer } from '../renderer/renderer.ts'
import type { A2uiClientMessage } from '../renderer/renderer.ts'

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/** A fixture record whose `load()` defines `tag` and counts its calls. */
function record(tag: string): ControlRecord & { calls: () => number } {
  let calls = 0
  return {
    tag,
    load: async () => {
      calls++
      if (customElements.get(tag) === undefined) customElements.define(tag, class extends HTMLElement {})
    },
    calls: () => calls,
  }
}

const element = (tag: string): WidgetFactory => ({ tag, create: () => document.createElement(tag), applyProp: () => {} })

/** A base catalog registered under `agent-ui` (a legal composition target) with a fake loader over `boxTag`. */
function fixtureBase(name: string) {
  const boxTag = `x-ctl-probe-${name}-box`
  const baseRecord = record(boxTag)
  const baseLoader = createControlLoader({ [boxTag]: baseRecord }, { css: 'host' })
  const baseEnsure = vi.spyOn(baseLoader, 'ensure')
  const registry = new Registry()
  registry.register(
    { catalogId: 'agent-ui', protocolVersion: 'v1.0', components: { Box: { properties: {}, children: 'ChildList' } }, functions: {} },
    { Box: element(boxTag) },
    undefined,
    baseLoader,
  )
  return { boxTag, baseRecord, baseLoader, baseEnsure, registry }
}

/** A persona package whose fragment adds `ProbeCard`, rendered by a control outside components. */
function fixturePersona(name: string, withControls = true) {
  const cardTag = `x-ctl-probe-${name}-card`
  const cardRecord = record(cardTag)
  const pkg: PersonaCatalogPackage = {
    personaId: `probe-${name}`,
    fragment: loadCatalogFragment({ components: { ProbeCard: { properties: {} } } }),
    factories: { ProbeCard: element(cardTag) },
    ...(withControls ? { controls: [cardRecord] } : {}),
  }
  return { cardTag, cardRecord, pkg }
}

describe('composeControlLoaders and the derived entry (ADR-0233)', () => {
  it('routes persona-record tags to the persona loader and every other tag to the base loader', async () => {
    const base = fixtureBase('route')
    const persona = fixturePersona('route')
    expect(customElements.get(base.boxTag)).toBeUndefined()
    expect(customElements.get(persona.cardTag)).toBeUndefined()

    composePersonaCatalogs(base.registry, [persona.pkg])
    const derived = base.registry.get(derivedCatalogId('agent-ui', persona.pkg.personaId))!
    const controls = derived.controls!
    expect(controls).toBeDefined()
    expect(controls.missing([base.boxTag, persona.cardTag]).sort()).toEqual([base.boxTag, persona.cardTag].sort())

    await controls.ensure([base.boxTag, persona.cardTag])

    expect(base.baseEnsure).toHaveBeenCalledTimes(1)
    expect([...base.baseEnsure.mock.calls[0]![0]]).toEqual([base.boxTag]) // never the persona tag
    expect(persona.cardRecord.calls()).toBe(1)
    expect(base.baseRecord.calls()).toBe(1)
    expect(customElements.get(base.boxTag)).toBeDefined()
    expect(customElements.get(persona.cardTag)).toBeDefined()
    expect(controls.missing([base.boxTag, persona.cardTag])).toEqual([])
  })

  it('keeps the base loader when the persona ships no records, and is undefined when both are absent', () => {
    const base = fixtureBase('passthrough')
    const persona = fixturePersona('passthrough', false)
    expect(customElements.get(base.boxTag)).toBeUndefined()

    composePersonaCatalogs(base.registry, [persona.pkg])
    expect(base.registry.get(derivedCatalogId('agent-ui', persona.pkg.personaId))!.controls).toBe(base.baseLoader)
    expect(composeControlLoaders(base.baseLoader, [])).toBe(base.baseLoader)
    expect(composeControlLoaders(undefined, undefined)).toBeUndefined()

    const plain = new Registry()
    plain.register(
      { catalogId: 'agent-ui', protocolVersion: 'v1.0', components: { Box: { properties: {}, children: 'ChildList' } }, functions: {} },
      { Box: element(base.boxTag) },
    )
    composePersonaCatalogs(plain, [persona.pkg])
    expect('controls' in plain.get(derivedCatalogId('agent-ui', persona.pkg.personaId))!).toBe(false) // byte-identical entry
  })

  it('a persona record for a control outside components registers and renders through the derived entry', async () => {
    const base = fixtureBase('render')
    const persona = fixturePersona('render')
    expect(customElements.get(base.boxTag)).toBeUndefined()
    expect(customElements.get(persona.cardTag)).toBeUndefined()
    composePersonaCatalogs(base.registry, [persona.pkg])
    const derivedId = derivedCatalogId('agent-ui', persona.pkg.personaId)
    const derived = base.registry.get(derivedId)!

    const sent: A2uiClientMessage[] = []
    const r = createRenderer({ newId: () => 'act-1', now: () => '2026-10-05T00:00:00.000Z' })
    r.register(derived.catalog, derived.factories as Record<string, WidgetFactory>, derived.functions, derived.controls)
    r.onClientMessage((m) => void sent.push(m))
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    r.mount(mount)

    r.ingest(JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: 'p', catalogId: derivedId } }))
    r.ingest(
      JSON.stringify({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'p',
          components: [
            { id: 'root', component: 'Box', children: ['card'] },
            { id: 'card', component: 'ProbeCard' },
          ],
        },
      }),
    )
    expect(mount.children).toHaveLength(0) // deferred: neither tag is defined yet

    await settle()

    const card = mount.querySelector(persona.cardTag)
    expect(card).toBeInstanceOf(customElements.get(persona.cardTag)!)
    expect(card?.parentElement?.localName).toBe(base.boxTag)
    expect(persona.cardRecord.calls()).toBe(1)
    expect(sent.filter((m) => 'error' in m)).toEqual([])
    r.dispose()
    mount.remove()
  })
})
