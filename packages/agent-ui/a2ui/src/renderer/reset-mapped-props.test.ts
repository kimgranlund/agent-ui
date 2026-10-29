// reset-mapped-props.test.ts: the ADR-0128 reset capability for non-identity `mapsTo` props (T-0556). An
// `updateComponents` that drops a prop resets it: identity-mapped props from a pristine element's own value
// (`tree.ts` `#resetOmittedProps`), non-identity ones (`Stat.value -> figure`, `Button.label -> textContent`) through
// the factory's optional `resetProp`. The table is read from every shipped catalog with a non-identity row, so a new
// one with no reset reds here instead of leaving a dropped value on screen.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import '@agent-ui/components/all' // self-defines the ui-* controls (the real catalog factories)
import { whenFlushed } from '@agent-ui/components'
import { createRenderer } from './renderer.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { defaultFactories } from '../catalog/default/factories.ts'
import { a2uiBasicCatalog } from '../catalog/a2ui-basic/index.ts'
import { a2uiBasicFactories } from '../catalog/a2ui-basic/factories.ts'
import { fixtureDemoFragment, fixtureDemoFactories } from '../catalog/personas/fixture-demo/index.ts'
import { factoriesOf } from '../catalog/variant.ts'
import type { VariantDispatch, WidgetFactory } from '../catalog/types.ts'
import type { ComponentDef, PropDef } from '../catalog/catalog.ts'

// jsdom has no `setFormValue`/`setValidity`; the form controls (TextField, Checkbox, Select) call both on connect.
const proto = ElementInternals.prototype as unknown as Record<string, unknown>
const saved = { setFormValue: proto['setFormValue'], setValidity: proto['setValidity'] }
beforeAll(() => {
  for (const k of ['setFormValue', 'setValidity'] as const) if (typeof proto[k] !== 'function') proto[k] = function (): void {}
})
afterAll(() => Object.assign(proto, saved))

const TABLES: readonly [string, Readonly<Record<string, ComponentDef>>, Readonly<Record<string, WidgetFactory | VariantDispatch>>][] = [
  ['agent-ui', defaultCatalog.components, defaultFactories],
  ['a2ui-basic', a2uiBasicCatalog.components, a2uiBasicFactories],
  ['fixture-demo', fixtureDemoFragment.components, fixtureDemoFactories],
]

/** Every non-identity row, as `[catalog, type, prop, def]`. */
const ROWS = TABLES.flatMap(([catalog, components]) =>
  Object.entries(components).flatMap(([type, def]) =>
    Object.entries(def.properties)
      .filter(([prop, p]) => p.mapsTo !== prop)
      .map(([prop, p]) => [catalog, type, prop, p] as const),
  ),
)

/** Candidate wire values for one prop, so at least one changes the control. */
function samples(def: PropDef): unknown[] {
  const t = def.type as { type?: string; enum?: readonly unknown[] }
  if (t.enum !== undefined) return [...t.enum]
  if (t.type === 'boolean') return [true]
  if (t.type === 'number' || t.type === 'integer') return [3]
  if (def.mapsTo === 'src') return ['https://example.com/a.png']
  if (def.mapsTo === 'color') return ['#ff0000']
  return ['star']
}

/** What the mapping writes, plus the host's own attributes and child elements (a factory may stamp either). */
function snapshot(el: HTMLElement, target: string): string {
  const own = target === 'textContent' ? el.textContent : target in el ? (el as unknown as Record<string, unknown>)[target] : null
  const attrs = [...el.attributes].filter((a) => a.name !== 'id').map((a) => `${a.name}=${a.value}`).sort()
  const kids = [...el.children].map((c) => `${c.localName}${c.hasAttribute('data-role') ? `[${c.getAttribute('data-role')}]` : ''}`)
  return JSON.stringify([own ?? null, target === 'textContent' ? null : el.getAttribute(target), attrs, kids])
}

/** A control the way the renderer mints one: created, its static props applied, then connected. */
async function connected(factory: WidgetFactory, prop?: string, value?: unknown): Promise<HTMLElement> {
  const el = factory.create()
  if (prop !== undefined) factory.applyProp(el, prop, value)
  document.body.append(el)
  await whenFlushed()
  return el
}

describe('non-identity mapsTo props reset when an update drops them (T-0556, ADR-0128)', () => {
  it('the table is the shipped non-identity rows (anti-vacuity: 31 at T-0556)', () => {
    expect(ROWS.length).toBeGreaterThanOrEqual(31)
  })

  for (const [catalog, type, prop, def] of ROWS) {
    it(`${catalog} ${type}.${prop} -> ${def.mapsTo}: resetProp restores the pristine control`, async () => {
      const slot = TABLES.find(([c]) => c === catalog)![2][type]!
      let changedAny = false
      for (const factory of factoriesOf(slot)) {
        expect(typeof factory.resetProp, `${factory.tag} has resetProp`).toBe('function')
        const pristine = await connected(factory)
        const before = snapshot(pristine, def.mapsTo)
        for (const value of samples(def)) {
          const el = await connected(factory, prop, value)
          const applied = snapshot(el, def.mapsTo)
          if (applied === before) {
            el.remove()
            continue
          }
          changedAny = true
          factory.resetProp!(el, prop)
          await whenFlushed()
          expect(snapshot(el, def.mapsTo), `${factory.tag} after reset from ${JSON.stringify(value)}`).toBe(before)
          el.remove()
        }
        pristine.remove()
      }
      expect(changedAny, 'anti-vacuity: some sample changed the control').toBe(true)
    })
  }
})

describe('the renderer resets a dropped non-identity prop on the same element', () => {
  type Node = { component: string } & Record<string, unknown>
  async function run(catalogId: string, first: Node, second: Node, tag: string) {
    const r = createRenderer()
    await r.preload(catalogId)
    const mount = document.createElement('div')
    document.body.append(mount)
    r.mount(mount)
    r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId } })
    r.ingestMessage({ version: 'v1.0', updateComponents: { surfaceId: 's1', components: [{ id: 'root', ...first }] } })
    await whenFlushed()
    const el = mount.querySelector(tag) as HTMLElement
    const mid = { el, text: el.textContent, figure: (el as unknown as { figure?: unknown }).figure, type: (el as unknown as { type?: unknown }).type }
    r.ingestMessage({ version: 'v1.0', updateComponents: { surfaceId: 's1', components: [{ id: 'root', ...second }] } })
    await whenFlushed()
    const after = mount.querySelector(tag) as HTMLElement
    const out = { mid, after, same: after === el }
    return { ...out, done: () => (r.dispose(), mount.remove()) }
  }

  it('Stat.value -> figure', async () => {
    const pristine = (document.createElement('ui-stat') as unknown as { figure?: unknown }).figure
    const res = await run('agent-ui', { component: 'Stat', label: 'Revenue', value: '$42k' }, { component: 'Stat', label: 'Revenue' }, 'ui-stat')
    expect(res.mid.figure).toBe('$42k')
    expect(res.same).toBe(true)
    expect((res.after as unknown as { figure?: unknown }).figure).toBe(pristine)
    res.done()
  })

  it('Button.label -> textContent', async () => {
    const res = await run('agent-ui', { component: 'Button', label: 'Send' }, { component: 'Button' }, 'ui-button')
    expect(res.mid.text).toContain('Send')
    expect(res.same).toBe(true)
    expect(res.after.textContent).not.toContain('Send')
    res.done()
  })

  it('a2ui-basic DateTimeInput.enableTime -> type', async () => {
    const res = await run('a2ui-basic', { component: 'DateTimeInput', enableTime: true }, { component: 'DateTimeInput' }, 'ui-text-field')
    expect(res.mid.type).toBe('time')
    expect(res.same).toBe(true)
    expect((res.after as unknown as { type?: unknown }).type).toBe('date')
    res.done()
  })
})
