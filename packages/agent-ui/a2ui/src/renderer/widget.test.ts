import { describe, it, expect, beforeAll } from 'vitest'
import { effect, inspect, whenFlushed } from '@agent-ui/components'
import { makeCreateWidget } from './widget.ts'
import type { WidgetDeps } from './widget.ts'
import { createSurface, disposeSurface } from './surface.ts'
import { resolve } from './binding.ts'
import type { Surface } from './surface.ts'
import type { CreateWidget } from './types.ts'
import type { A2uiComponent, A2uiError } from '../protocol.ts'
import type { CatalogEntry, CatalogRegistry, WidgetFactory } from '../catalog/types.ts'
// The REAL default factories (which import + self-define the `@agent-ui/components` control family) — used by
// the render-integration block to prove the LLD-C8 two-way wiring end-to-end against a live `ui-*` control.
import { defaultFactories } from '../catalog/default/factories.ts'
import { defaultCatalog } from '../catalog/default/index.ts'

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
    submitGateSelector: () => '',
  }
}

/**
 * A single-segment value dispatcher — stands in for LLD-C10 (ADR-0026): routes a `{path}` binding
 * through a flat `surface.data` read (so the effect tracks `data` reactively), and returns any other
 * value as-is (literal pass-through). The real dispatcher also handles `{call}` via `functions.ts`;
 * those are tested in `functions.test.ts` and `renderer.test.ts` respectively.
 */
const resolveValue: WidgetDeps['resolveValue'] = (value, surface) => {
  if (typeof value === 'object' && value !== null && !Array.isArray(value) && 'path' in value) {
    const data = surface.data.value as Record<string, unknown> | undefined
    return data?.[(value as { path: string }).path.replace(/^\//, '')]
  }
  return value
}

const init = { id: 's1', catalogId: 'demo', version: 'v1.0' }

function harness(factories: Record<string, WidgetFactory>, registryCatalogId = 'demo') {
  const errors: A2uiError[] = []
  const registry = stubRegistry(registryCatalogId, factories)
  const createWidget = makeCreateWidget({ registry, emitError: (e) => void errors.push(e), resolveValue })
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

// ── render-integration: the LLD-C8 two-way wiring, end-to-end against the REAL default factories ──
//
// The s12 integration assertion (the deferred render-integration the wide fan-out could not run): widget
// resolution now installs the generic input controller (`installInputBinding`, LLD-C8/ADR-0019) right after
// the bound props. This block proves it through the REAL catalog factory + a live `ui-*` control (no stub):
// a container payload resolves to its real control, and a value commit writes BACK into surface.data with no
// per-component code. `defaultFactories` import self-defines the control family, so `create()` yields the
// upgraded element; the resolveBinding stub is the single-segment reader (the bound paths here are flat).
describe('widget resolution — two-way input binding wired (render-integration, s12 / LLD-C8)', () => {
  it('a container payload resolves a live ui-* control and a value commit writes the data model', () => {
    const { createWidget } = harness(defaultFactories)
    const surface = createSurface(init)
    surface.data.value = { tab: 'one' }

    // A Tabs container node, `selected` two-way-bound to /tab (the default catalog marks value:{selected,select}).
    const el = createWidget(comp({ id: 't1', component: 'Tabs', selected: { path: '/tab' } }), surface)
    expect(el.tagName.toLowerCase()).toBe('ui-tabs') // the REAL upgraded control, not a placeholder
    expect((el as { selected?: unknown }).selected).toBe('one') // the data→control bound prop applied on mount

    // A user gesture commits a new selection: the control's `selected` carries it; its `select` event fires.
    ;(el as { selected?: unknown }).selected = 'two'
    el.dispatchEvent(new Event('select'))

    // The generic controller wrote it back into surface.data at the bound path — the control→data direction (N2).
    expect((surface.data.peek() as { tab: unknown }).tab).toBe('two')
  })

  it('a non-input container (Row) installs no writeback listener — opt-in by the factory mark', () => {
    const { createWidget } = harness(defaultFactories)
    const surface = createSurface(init)
    surface.data.value = { x: 1 }

    const el = createWidget(comp({ id: 'r1', component: 'Row', gap: 'md' }), surface)
    expect(el.tagName.toLowerCase()).toBe('ui-row')

    // `Row`'s factory carries no `value` mark, so no listener was installed: a stray commit event is inert.
    el.dispatchEvent(new Event('select'))
    el.dispatchEvent(new Event('change'))
    expect(surface.data.peek()).toEqual({ x: 1 }) // data model untouched
  })
})

// ── ADR-0101 — the ticket #28 fix, proven end-to-end against a REAL `ui-menu` + a REAL A2UI open-bind ──
//
// jsdom has no native Popover API (showPopover/hidePopover, ToggleEvent) — stub it on
// HTMLElement.prototype exactly like the component-layer suites do (overlay.test.ts / menu.test.ts),
// scoped to this file's beforeAll. Guarded so a real-engine run (browser mode) leaves the platform alone.
const popoverOpen = new WeakMap<HTMLElement, boolean>()
function fireToggle(el: HTMLElement, newState: 'open' | 'closed'): void {
  const ev = new Event('toggle')
  Object.defineProperty(ev, 'newState', { value: newState })
  el.dispatchEvent(ev)
}
beforeAll(() => {
  const proto = HTMLElement.prototype as unknown as { showPopover?: () => void; hidePopover?: () => void }
  if (typeof proto.showPopover === 'function') return // real engine — leave the platform alone
  proto.showPopover = function (this: HTMLElement): void {
    if (popoverOpen.get(this)) return
    popoverOpen.set(this, true)
    fireToggle(this, 'open')
  }
  proto.hidePopover = function (this: HTMLElement): void {
    if (!popoverOpen.get(this)) return
    popoverOpen.set(this, false)
    fireToggle(this, 'closed')
  }
})

/** Mirrors input.test.ts's `bindCounting` — a scope-owned counting effect on ONE path, via the REAL
 *  `resolve()` (binding.ts), so a wake here proves the underlying `surface.data` value actually changed
 *  (not merely that some other effect ran). */
function bindCounting(surface: Surface, path: string): { count: number; value: unknown } {
  const c = { count: 0, value: undefined as unknown }
  surface.scope.run(() => {
    effect(() => {
      c.value = resolve({ path }, surface)
      c.count++
    })
  })
  return c
}

/** Build a REAL `<ui-menu>` (via `createWidget`) with a trigger + one committable item attached
 *  BEFORE connecting it — mirrors menu.ts's positional-child contract (`#ensureParts`). Returns the
 *  element un-connected; the caller appends it to `document.body` to fire `connectedCallback`. */
function buildMenuWithItem(createWidget: CreateWidget, surface: Surface): { el: HTMLElement; item: HTMLElement } {
  const el = createWidget(
    comp({ id: 'menu1', component: 'Menu', open: { path: '/menuOpen' } }),
    surface,
  )
  const trigger = document.createElement('button')
  trigger.textContent = 'Open menu'
  const item = document.createElement('div')
  item.setAttribute('data-value', 'a')
  item.textContent = 'Item A'
  el.append(trigger, item)
  return { el, item }
}

describe('widget resolution — Menu open-bind converges after commit (ADR-0101, ticket #28 fix, end-to-end)', () => {
  it('committing a MenuItem writes open:false into surface.data — the panel stays closed, not a phantom reopen', async () => {
    const registry: CatalogRegistry = {
      register: () => {},
      get: (id) => (id === 'agent-ui' ? ({ catalog: defaultCatalog, factories: defaultFactories } as CatalogEntry) : undefined),
      supportedCatalogIds: () => ['agent-ui'],
      submitGateSelector: () => '',
    }
    const createWidget = makeCreateWidget({ registry, emitError: () => {}, resolveValue })
    const surface = createSurface({ id: 's', catalogId: 'agent-ui', version: 'v1.0' })
    surface.data.value = { menuOpen: true }

    const { el, item } = buildMenuWithItem(createWidget, surface)
    expect(el.tagName.toLowerCase()).toBe('ui-menu') // the REAL upgraded control, not a placeholder

    document.body.append(el) // connect — #ensureParts runs, the overlay handle wires up
    await whenFlushed()
    expect((el as { open?: boolean }).open).toBe(true) // the bound-prop effect applied the initial model value

    item.click() // the REAL control's #commit: emits `select`, then `open = false`
    await whenFlushed()

    expect((el as { open?: boolean }).open).toBe(false) // the panel closed (pre-ADR-0101 behaviour, unchanged)
    // The ticket #28 fix: the trait's close() now announces `toggle` after `open` settles, so the
    // generic input binding (installInputBinding, LLD-C8) writes the closed state BACK into surface.data —
    // "the data model converges to open:false" with no agent round-trip involved.
    expect((surface.data.peek() as { menuOpen: boolean }).menuOpen).toBe(false)

    // The re-assert probe (ADR-0101 Consequences / clause 4): a subsequent UNRELATED, FULL data-model
    // reassignment (not a per-path setPointer — the shape `updateDataModel` without a `path` produces,
    // renderer.ts) re-applies EVERY top-level bound prop from `surface.data`. Pre-fix, the model still
    // held the stale `true` (the write-back never happened), so this re-application visibly reopened the
    // panel — the exact ticket #28 symptom. Post-fix the model itself holds `false`, so it stays closed.
    surface.data.value = { ...(surface.data.peek() as Record<string, unknown>), unrelated: 1 }
    await whenFlushed()
    expect((el as { open?: boolean }).open).toBe(false) // stayed closed — the model was NOT lying
    expect(document.body.contains(el)).toBe(true)

    el.remove()
    disposeSurface(surface)
  })

  it('the loop probe: one commit-close transition wakes the bound path exactly once — no re-entrant write-back (ADR-0101 cl.4)', async () => {
    const registry: CatalogRegistry = {
      register: () => {},
      get: (id) => (id === 'agent-ui' ? ({ catalog: defaultCatalog, factories: defaultFactories } as CatalogEntry) : undefined),
      supportedCatalogIds: () => ['agent-ui'],
      submitGateSelector: () => '',
    }
    const createWidget = makeCreateWidget({ registry, emitError: () => {}, resolveValue })
    const surface = createSurface({ id: 's', catalogId: 'agent-ui', version: 'v1.0' })
    surface.data.value = { menuOpen: true }

    const openTrack = bindCounting(surface, '/menuOpen')
    expect(openTrack.count).toBe(1) // the mount-time synchronous first run

    const { el, item } = buildMenuWithItem(createWidget, surface)
    document.body.append(el)
    await whenFlushed()
    expect((el as { open?: boolean }).open).toBe(true)

    let toggles = 0
    el.addEventListener('toggle', () => toggles++)

    item.click() // the ONE user transition
    await whenFlushed()

    // Exactly one announce for the one real transition (ADR-0101) — a re-entrant loop (the bound-prop
    // effect re-running close() a second time) would show up here as toggles > 1.
    expect(toggles).toBe(1)
    expect((surface.data.peek() as { menuOpen: boolean }).menuOpen).toBe(false)
    // Exactly one wake of the bound path (1 mount + 1 real change) — the widget's OWN bound-prop effect
    // re-running (from the write-back) does NOT cause a second close()/toggle cycle: `el.open` is already
    // `false` when that effect re-applies it, so the props-signal Object.is cutoff stops the control's
    // internal effect from re-running `handle.close()` (ADR-0101 clause 4 — the loop-termination proof).
    expect(openTrack.count).toBe(2)
    expect((el as { open?: boolean }).open).toBe(false)

    el.remove()
    disposeSurface(surface)
  })

  it('the MOUSE-driven leg (ADR-0101 erratum): clicking the REAL trigger opens it, then a commit converges the model to open:false — the exact path the audit reproduced', async () => {
    // Every leg above drives OPEN via the bound-prop effect (a model write, `surface.data.value =
    // { menuOpen: true }`) — it never exercises the trigger's own click handler. Before the erratum
    // fix, a mouse-click open called `handle.toggle()` directly and never wrote `this.open`, so the
    // panel was really open while the prop (and therefore the model, via the two-way input binding)
    // stayed `false` — and the LATER commit-close's `this.open = false` was a same-value no-op: the
    // trait's `close()` never ran, no `toggle` announced, no write-back, and the model kept lying
    // `open: false` while the panel stayed visibly open. This leg starts the model at `false` (no
    // agent-driven open at all) and drives the open itself through a real mouse click on the real
    // trigger button, exactly reproducing the ticket #28 residual the live re-audit found.
    const registry: CatalogRegistry = {
      register: () => {},
      get: (id) => (id === 'agent-ui' ? ({ catalog: defaultCatalog, factories: defaultFactories } as CatalogEntry) : undefined),
      supportedCatalogIds: () => ['agent-ui'],
      submitGateSelector: () => '',
    }
    const createWidget = makeCreateWidget({ registry, emitError: () => {}, resolveValue })
    const surface = createSurface({ id: 's', catalogId: 'agent-ui', version: 'v1.0' })
    surface.data.value = { menuOpen: false } // NOT model-driven open — the mouse gesture drives it

    const { el, item } = buildMenuWithItem(createWidget, surface)
    document.body.append(el) // connect — #ensureParts runs, the overlay handle wires up
    await whenFlushed()
    expect((el as { open?: boolean }).open).toBe(false) // starts closed, matching the model

    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    trigger.click() // the REAL mouse gesture the audit reproduced — NOT `el.open = true`
    await whenFlushed()

    expect((el as { open?: boolean }).open, 'a mouse-click open must set the reflected open prop').toBe(true)
    expect((surface.data.peek() as { menuOpen: boolean }).menuOpen, 'the mouse-open itself round-trips into the model via the toggle bind').toBe(true)

    item.click() // commit a selection (menu's #commit sets this.open = false)
    await whenFlushed()

    expect((el as { open?: boolean }).open, 'the panel must report closed after a post-mouse-open commit').toBe(false)
    expect((surface.data.peek() as { menuOpen: boolean }).menuOpen, 'the data model must converge to open:false — not keep lying true').toBe(false)
    expect(document.body.contains(el)).toBe(true) // the panel is gone from the top layer, the host stays mounted

    el.remove()
    disposeSurface(surface)
  })
})

describe('widget resolution — catalog enum enforcement (skips a non-member literal)', () => {
  // A registry entry carrying a REAL catalog def: `Box.align` is a closed enum [start,end,stretch] (NO
  // center); `gap` is an unconstrained string (no enum). Proves the resolver honors the catalog's declared
  // enum — a value the enum forbids is never applied, an unconstrained prop is untouched.
  //
  // LAYERING (ADR-0098): the shared validator (`catalog/conformance.ts`) now ALSO rejects a non-member
  // ENUM LITERAL with a `CATALOG` failure at validate-then-stream time — the FIRST line of defense; an
  // invalid payload never reaches widget resolution at all. This describe block covers the SECOND line
  // of defense: a bound value resolving to a non-member at render (never seen by the static validator,
  // which only judges literals) and any payload that bypasses validation. Both suites stay load-bearing.
  function enumRegistry(factories: Record<string, WidgetFactory>): CatalogRegistry {
    const catalog = {
      catalogId: 'demo',
      protocolVersion: 'v1.0',
      components: {
        Box: {
          name: 'Box',
          properties: {
            align: { type: { type: 'string', enum: ['start', 'end', 'stretch'] }, mapsTo: 'align' },
            gap: { type: { type: 'string' }, mapsTo: 'gap' },
          },
        },
      },
      functions: {},
    }
    const entry = { catalog, factories } as unknown as CatalogEntry
    return {
      register: () => {},
      get: (id) => (id === 'demo' ? entry : undefined),
      supportedCatalogIds: () => ['demo'],
      submitGateSelector: () => '',
    }
  }

  it('skips a literal the PropDef enum does not list; applies a declared member + unconstrained props', () => {
    const { factory, applied } = stubFactory('ui-column')
    const createWidget = makeCreateWidget({ registry: enumRegistry({ Box: factory }), emitError: () => {}, resolveValue })
    const surface = createSurface(init)

    createWidget(comp({ id: 'x', component: 'Box', align: 'center', gap: '2rem' }), surface)
    expect(applied.some((a) => a.prop === 'align')).toBe(false) // 'center' ∉ enum → dropped at the catalog boundary
    expect(applied.some((a) => a.prop === 'gap' && a.value === '2rem')).toBe(true) // unconstrained prop → untouched

    applied.length = 0
    createWidget(comp({ id: 'y', component: 'Box', align: 'end' }), surface)
    expect(applied.some((a) => a.prop === 'align' && a.value === 'end')).toBe(true) // a declared member → applied
  })

  it('with the REAL default catalog: a Column align="center" renders NO align attribute; justify="center" stays', () => {
    // End-to-end for Kim's directive: `center` is not in the (narrowed) Column.align enum, so the resolver
    // never applies it → the live ui-column carries no stray `align="center"` (it renders at its stretch
    // default). `justify` still lists `center`, so a valid value on a DIFFERENT prop is applied normally.
    const registry: CatalogRegistry = {
      register: () => {},
      get: (id) => (id === 'agent-ui' ? ({ catalog: defaultCatalog, factories: defaultFactories } as CatalogEntry) : undefined),
      supportedCatalogIds: () => ['agent-ui'],
      submitGateSelector: () => '',
    }
    const createWidget = makeCreateWidget({ registry, emitError: () => {}, resolveValue })
    const surface = createSurface({ id: 's', catalogId: 'agent-ui', version: 'v1.0' })

    const el = createWidget(comp({ id: 'root', component: 'Column', align: 'center', justify: 'center' }), surface)
    expect(el.tagName.toLowerCase()).toBe('ui-column')
    expect(el.getAttribute('align')).toBeNull() // center ∉ Column.align enum → never applied → no stray attribute
    expect(el.getAttribute('justify')).toBe('center') // justify DOES list center → applied (gate is selective, not blanket)
  })
})
