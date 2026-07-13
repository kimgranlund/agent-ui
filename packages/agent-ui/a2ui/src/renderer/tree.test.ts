import { describe, it, expect } from 'vitest'
import { inspect, whenFlushed } from '@agent-ui/components'
import type { A2uiComponent, A2uiError } from '../protocol.ts'
import type { CreateWidget, CreateOnly, RewireNode, ResetProp, ComponentDefOf } from './types.ts'
import { createSurface, disposeSurface } from './surface.ts'
import { resolve, setPointer } from './binding.ts'
import { create as widgetCreate, wireProps, makeCreateWidget } from './widget.ts'
import type { WidgetDeps } from './widget.ts'
import type { CatalogEntry, CatalogRegistry, WidgetFactory } from '../catalog/types.ts'
import { SurfaceTree, type UpdateComponentsMessage } from './tree.ts'

/** A stub `TreeDeps.create`/`rewireNode`/`resetProp`/`componentDefOf` no test in THIS describe block
 *  exercises (the buffer/render-on-root/id-graph/out-of-order suites never resend an already-mounted
 *  id) — present only because `TreeDeps` now requires them (RSR-C1..C7, ADR-0128). */
const inertReconcileDeps = {
  create: (() => document.createElement('div')) as CreateOnly,
  rewireNode: (() => {}) as RewireNode,
  resetProp: (() => {}) as ResetProp,
  componentDefOf: (() => undefined) as ComponentDefOf,
}

// — harness ————————————————————————————————————————————————————————————————————
// A stub `createWidget` (renderer LLD-C7) that records calls and returns an identifiable element, so
// the tree slice is proven decoupled from the real widget factory (B-widget).
function harness() {
  const calls: A2uiComponent[] = []
  const createWidget: CreateWidget = (node) => {
    calls.push(node)
    const el = document.createElement('div')
    el.setAttribute('data-id', node.id)
    el.setAttribute('data-component', node.component)
    return el
  }
  const errors: A2uiError[] = []
  const onError = (e: A2uiError): void => void errors.push(e)
  const surface = createSurface({ id: 's1', catalogId: 'demo', version: 'v1.0' })
  const tree = new SurfaceTree(surface, { createWidget, ...inertReconcileDeps, onError })
  return { calls, errors, surface, tree }
}

const msg = (components: A2uiComponent[]): UpdateComponentsMessage => ({
  version: 'v1.0',
  updateComponents: { surfaceId: 's1', components },
})

const childIds = (el: HTMLElement): (string | null)[] =>
  [...el.children].map((c) => c.getAttribute('data-id'))

describe('buffer + render-on-root (renderer LLD-C4, SPEC-R3)', () => {
  it('buffers components by id and mounts the tree once a valid root exists', () => {
    const { calls, surface, tree } = harness()
    tree.apply(
      msg([
        { id: 'root', component: 'Column', children: ['a', 'b'] },
        { id: 'a', component: 'Text' },
        { id: 'b', component: 'Text' },
      ]),
    )

    // buffered by id
    expect(surface.components.size).toBe(3)
    expect([...surface.components.keys()].sort()).toEqual(['a', 'b', 'root'])

    // mounted: root + both children, created in declaration order via the stub factory
    expect(tree.isMounted).toBe(true)
    expect(calls.map((c) => c.id)).toEqual(['root', 'a', 'b'])
    const root = tree.rootElement!
    expect(root.getAttribute('data-id')).toBe('root')
    expect(childIds(root)).toEqual(['a', 'b'])
    expect(surface.widgets.size).toBe(3)
  })

  it('reconstructs via child then children, preserving semantic order (DFS)', () => {
    const { calls, tree } = harness()
    tree.apply(
      msg([
        { id: 'root', component: 'Card', child: 'c0', children: ['c1', 'c2'] },
        { id: 'c0', component: 'Text' },
        { id: 'c1', component: 'Text' },
        { id: 'c2', component: 'Text' },
      ]),
    )
    expect(calls.map((c) => c.id)).toEqual(['root', 'c0', 'c1', 'c2'])
    expect(childIds(tree.rootElement!)).toEqual(['c0', 'c1', 'c2'])
  })

  it('does not render until the root component arrives (no "begin" signal, SPEC-R3)', () => {
    const { calls, surface, tree } = harness()
    tree.apply(msg([{ id: 'a', component: 'Text' }])) // root absent
    expect(tree.isMounted).toBe(false)
    expect(calls).toEqual([])
    expect(surface.components.has('a')).toBe(true) // buffered, inert

    tree.apply(msg([{ id: 'root', component: 'Column', children: ['a'] }]))
    expect(tree.isMounted).toBe(true)
    expect(calls.map((c) => c.id)).toEqual(['root', 'a'])
    expect(childIds(tree.rootElement!)).toEqual(['a'])
  })

  it('leaves an unreferenced buffered component inert until referenced', () => {
    const { calls, surface, tree } = harness()
    tree.apply(
      msg([
        { id: 'root', component: 'Column', children: ['a'] },
        { id: 'a', component: 'Text' },
        { id: 'orphan', component: 'Text' }, // delivered but unreachable from root
      ]),
    )
    expect(surface.components.has('orphan')).toBe(true) // buffered
    expect(surface.widgets.has('orphan')).toBe(false) // not mounted
    expect(calls.map((c) => c.id)).toEqual(['root', 'a'])
  })
})

describe('eager id-graph guard (LLD-C4 / SPEC-R3 AC2)', () => {
  it('emits IDGRAPH on a second root and keeps the existing root (does not replace)', () => {
    const { errors, surface, tree } = harness()
    tree.apply(msg([{ id: 'root', component: 'Column' }]))
    const firstRootEl = tree.rootElement
    expect(firstRootEl?.getAttribute('data-component')).toBe('Column')

    tree.apply(msg([{ id: 'root', component: 'Button' }])) // second root → error
    expect(errors).toHaveLength(1)
    expect(errors[0].code).toBe('IDGRAPH')
    expect(errors[0].surfaceId).toBe('s1')
    // existing root unchanged in both the buffer and the live widget
    expect(surface.components.get('root')?.component).toBe('Column')
    expect(tree.rootElement).toBe(firstRootEl)
  })

  it('emits IDGRAPH on a cycle (back-edge) in-stream and refuses to mount', () => {
    const { calls, errors, tree } = harness()
    tree.apply(
      msg([
        { id: 'root', component: 'Column', children: ['a'] },
        { id: 'a', component: 'Column', children: ['root'] }, // a → root: back-edge
      ]),
    )
    expect(errors).toHaveLength(1)
    expect(errors[0].code).toBe('IDGRAPH')
    expect(errors[0].path).toBe('s1:cycle')
    expect(tree.isMounted).toBe(false)
    expect(calls).toEqual([]) // did not mount into the invalid graph
  })

  it('detects a self-cycle (node referencing itself)', () => {
    const { errors, tree } = harness()
    tree.apply(msg([{ id: 'root', component: 'Column', child: 'root' }]))
    expect(errors.map((e) => e.code)).toEqual(['IDGRAPH'])
  })

  it('a dangling (not-yet-delivered) reference is NOT a cycle — it is an out-of-order hold', () => {
    const { errors, tree } = harness()
    tree.apply(msg([{ id: 'root', component: 'Column', children: ['later'] }]))
    expect(errors).toEqual([]) // dangling ref tolerated, mounts what is available
    expect(tree.isMounted).toBe(true)
  })
})

describe('out-of-order child held + patched (SPEC-R4 AC1)', () => {
  it('holds a missing child in a slot and patches it in when it arrives — no root re-render', () => {
    const { calls, tree } = harness()
    // root references `x` which has not been delivered yet
    tree.apply(msg([{ id: 'root', component: 'Column', children: ['x'] }]))
    const root = tree.rootElement!
    expect(calls.map((c) => c.id)).toEqual(['root']) // only root mounted
    expect(root.children.length).toBe(0) // the slot is a (non-element) comment anchor
    expect(root.firstChild?.nodeType).toBe(8) // Node.COMMENT_NODE — position-preserving anchor

    // `x` arrives in a later batch → patched into place
    tree.apply(msg([{ id: 'x', component: 'Text' }]))
    expect(calls.map((c) => c.id)).toEqual(['root', 'x']) // root NOT re-created
    expect(childIds(root)).toEqual(['x'])
    expect(root.firstChild?.nodeType).toBe(1) // anchor swapped for the real element
  })

  it('preserves sibling order when an earlier sibling is patched in late', () => {
    const { tree } = harness()
    tree.apply(
      msg([
        { id: 'root', component: 'Column', children: ['a', 'b'] },
        { id: 'b', component: 'Text' }, // `a` still missing
      ]),
    )
    const root = tree.rootElement!
    expect(childIds(root)).toEqual(['b']) // only the present element shows; `a`'s slot is an anchor

    tree.apply(msg([{ id: 'a', component: 'Text' }]))
    expect(childIds(root)).toEqual(['a', 'b']) // patched into its original position
  })

  it('patches a multi-level out-of-order subtree (grandchild before child)', () => {
    const { calls, tree } = harness()
    tree.apply(msg([{ id: 'root', component: 'Column', children: ['p'] }])) // p missing
    tree.apply(msg([{ id: 'p', component: 'Column', children: ['q'] }])) // p arrives, q missing
    tree.apply(msg([{ id: 'q', component: 'Text' }])) // q arrives

    expect(calls.map((c) => c.id)).toEqual(['root', 'p', 'q'])
    const root = tree.rootElement!
    expect(childIds(root)).toEqual(['p'])
    const p = root.children[0] as HTMLElement
    expect(childIds(p)).toEqual(['q'])
  })

  it('child delivered before its parent (parent arrives later) mounts under the parent', () => {
    const { calls, tree } = harness()
    // child `c` buffered first; root references not-yet-present `mid`
    tree.apply(msg([{ id: 'c', component: 'Text' }]))
    tree.apply(msg([{ id: 'root', component: 'Column', children: ['mid'] }]))
    expect(childIds(tree.rootElement!)).toEqual([]) // `mid` missing → anchor only

    // `mid` arrives referencing the already-buffered `c` → both wire up in one patch
    tree.apply(msg([{ id: 'mid', component: 'Column', children: ['c'] }]))
    expect(calls.map((c) => c.id)).toEqual(['root', 'mid', 'c'])
    const mid = tree.rootElement!.children[0] as HTMLElement
    expect(mid.getAttribute('data-id')).toBe('mid')
    expect(childIds(mid)).toEqual(['c'])
  })
})

// A children-TEMPLATE container routes to the positional list (renderer LLD-C6 / ADR-0024) instead of
// the static childRefs DFS. Uses the REAL widget factory path so the list's per-element instantiation +
// length reactivity are proven through the actual `createWidget`, against a stub catalog factory.
describe('children-template routes to the positional dynamic list (LLD-C6)', () => {
  function listHarness() {
    const applied: { el: HTMLElement; value: unknown }[] = []
    const factory: WidgetFactory = {
      tag: 'ui-text',
      create: () => document.createElement('ui-text'),
      applyProp: (el, _prop, value) => void applied.push({ el, value }),
    }
    const entry = { factories: { List: factory, Item: factory } } as unknown as CatalogEntry
    const registry: CatalogRegistry = {
      register: () => {},
      get: (id) => (id === 'demo' ? entry : undefined),
      supportedCatalogIds: () => ['demo'],
      submitGateSelector: () => '',
    }
    const createWidget = makeCreateWidget({ registry, emitError: () => {}, resolveValue: (v) => v })
    const surface = createSurface({ id: 's1', catalogId: 'demo', version: 'v1.0' })
    const tree = new SurfaceTree(surface, { createWidget, ...inertReconcileDeps, onError: () => {} })
    return { surface, tree, applied }
  }

  it('renders one instance per array element under the container and grows on a length change', async () => {
    const { surface, tree } = listHarness()
    surface.data.value = { items: [{ label: 'a' }, { label: 'b' }] }
    tree.apply(
      msg([
        { id: 'root', component: 'List', children: { path: '/items', componentId: 'item' } },
        { id: 'item', component: 'Item', text: { path: 'label' } },
      ]),
    )
    const root = tree.rootElement!
    expect(root.children.length).toBe(2) // two item instances — NOT a single childRefs/anchor mount
    expect([...root.children].every((c) => c.tagName.toLowerCase() === 'ui-text')).toBe(true)

    surface.data.value = setPointer(surface.data.peek(), '/items', [{ label: 'a' }, { label: 'b' }, { label: 'c' }])
    await whenFlushed()
    expect(root.children.length).toBe(3) // grew to the new length, positionally
  })

  // ── subtree/container tests — verify #mountChildrenInto recursion (ADR-0024 amendment) ─────────
  //
  // These use the REAL binding resolver so relative-path resolution can be asserted end-to-end.
  // They are NON-VACUOUS: the descendant-renders-to-/items/{index} proof FAILS on the pre-patch tree
  // (createWidget was never called for descendants — no subtree walk existed).
  function subtreeHarness(factoryTags: Record<string, string>) {
    const applied: { el: HTMLElement; prop: string; value: unknown }[] = []
    const factories: Record<string, WidgetFactory> = {}
    for (const [name, tag] of Object.entries(factoryTags)) {
      factories[name] = {
        tag,
        create: () => document.createElement(tag),
        applyProp: (el, prop, value) => void applied.push({ el, prop, value }),
      }
    }
    const entry = { factories } as unknown as CatalogEntry
    const registry: CatalogRegistry = {
      register: () => {},
      get: (id) => (id === 'demo' ? entry : undefined),
      supportedCatalogIds: () => ['demo'],
      submitGateSelector: () => '',
    }
    const createWidget = makeCreateWidget({
      registry,
      emitError: () => {},
      resolveValue: (v, s, itemScope) => (typeof v === 'object' && v !== null && !Array.isArray(v) && 'path' in v ? resolve(v as { path: string }, s, itemScope) : v),
    })
    const surface = createSurface({ id: 's1', catalogId: 'demo', version: 'v1.0' })
    const tree = new SurfaceTree(surface, { createWidget, ...inertReconcileDeps, onError: () => {} })
    const latestProp = (el: Element, prop: string): unknown =>
      [...applied].reverse().find((a) => a.el === el && a.prop === prop)?.value
    return { surface, tree, latestProp }
  }

  it('a CONTAINER template renders its full subtree; a relative descendant binding resolves to /items/{index}/... (NON-VACUOUS)', () => {
    const { surface, tree, latestProp } = subtreeHarness({ List: 'ui-list', Card: 'ui-card', Text: 'ui-text' })
    surface.data.value = { items: [{ label: 'item0' }, { label: 'item1' }] }
    tree.apply(
      msg([
        { id: 'root', component: 'List', children: { path: '/items', componentId: 'card' } },
        { id: 'card', component: 'Card', child: 'text-node' },
        { id: 'text-node', component: 'Text', text: { path: 'label' } },
      ]),
    )
    const root = tree.rootElement!
    expect(root.children.length).toBe(2)
    const [card0, card1] = [...root.children] as HTMLElement[]
    expect(card0.tagName.toLowerCase()).toBe('ui-card')
    // descendants rendered — fails on the pre-patch tree (no subtree walk)
    const text0 = card0.firstElementChild as HTMLElement
    const text1 = card1.firstElementChild as HTMLElement
    expect(text0?.tagName.toLowerCase()).toBe('ui-text')
    expect(text1?.tagName.toLowerCase()).toBe('ui-text')
    // relative 'label' threaded through itemScope → /items/0/label and /items/1/label
    expect(latestProp(text0, 'text')).toBe('item0')
    expect(latestProp(text1, 'text')).toBe('item1')
  })

  it('an ABSOLUTE descendant binding resolves from the data root (not the item)', () => {
    const { surface, tree, latestProp } = subtreeHarness({ List: 'ui-list', Card: 'ui-card', Text: 'ui-text' })
    surface.data.value = { title: 'ROOT', items: [{ label: 'a' }, { label: 'b' }] }
    tree.apply(
      msg([
        { id: 'root', component: 'List', children: { path: '/items', componentId: 'card' } },
        { id: 'card', component: 'Card', child: 'text-node' },
        { id: 'text-node', component: 'Text', text: { path: 'label' }, heading: { path: '/title' } },
      ]),
    )
    const root = tree.rootElement!
    const [card0, card1] = [...root.children] as HTMLElement[]
    const text0 = card0.firstElementChild as HTMLElement
    const text1 = card1.firstElementChild as HTMLElement
    // relative resolves per-item; absolute resolves from data root regardless of depth
    expect(latestProp(text0, 'text')).toBe('a')
    expect(latestProp(text0, 'heading')).toBe('ROOT')
    expect(latestProp(text1, 'text')).toBe('b')
    expect(latestProp(text1, 'heading')).toBe('ROOT')
  })

  it('a NESTED list: inner relative resolves to /items/{i}/sublist/{j}/...; outer item removal disposes inner scopes (inner DOM gone)', async () => {
    const { surface, tree, latestProp } = subtreeHarness({ List: 'ui-list', Card: 'ui-card', Text: 'ui-text' })
    surface.data.value = {
      items: [
        { sublist: [{ name: 'a0' }, { name: 'a1' }] },
        { sublist: [{ name: 'b0' }] },
      ],
    }
    tree.apply(
      msg([
        { id: 'root', component: 'List', children: { path: '/items', componentId: 'outer' } },
        { id: 'outer', component: 'Card', children: { path: 'sublist', componentId: 'inner' } },
        { id: 'inner', component: 'Text', text: { path: 'name' } },
      ]),
    )
    const root = tree.rootElement!
    const [outerEl0, outerEl1] = [...root.children] as HTMLElement[]

    // two outer items with the correct inner child counts
    expect(outerEl0.children.length).toBe(2)
    expect(outerEl1.children.length).toBe(1)

    // inner relative path 'name' resolves through nested itemScopes → /items/{i}/sublist/{j}/name
    const inner00 = outerEl0.children[0] as HTMLElement
    const inner01 = outerEl0.children[1] as HTMLElement
    const inner10 = outerEl1.children[0] as HTMLElement
    expect(latestProp(inner00, 'text')).toBe('a0') // /items/0/sublist/0/name
    expect(latestProp(inner01, 'text')).toBe('a1') // /items/0/sublist/1/name
    expect(latestProp(inner10, 'text')).toBe('b0') // /items/1/sublist/0/name

    // remove outer item 1 (the trailing item); its child scope disposes the inner list's
    // parentScope effects (teardown carrier → disposes inner item scopes)
    surface.data.value = setPointer(surface.data.peek(), '/items', [{ sublist: [{ name: 'a0' }, { name: 'a1' }] }])
    await whenFlushed()

    expect(root.children.length).toBe(1)
    expect(outerEl1.isConnected).toBe(false) // outer item 1 detached
    expect(inner10.isConnected).toBe(false)  // inner DOM under outer-1 gone (parent detached)

    // full surface teardown: path signals (owned by surface.scope) release surface.data → 0 subscribers
    disposeSurface(surface)
    expect(inspect(surface.data).subscribers).toBe(0)
  })
})

// ── structural-resend reconciliation (RSR-C1..C7, ADR-0128 / renderer-structural-resend.spec.md) ──────
//
// A dedicated harness composing the REAL `widget.ts` create/wire split (not a stub that merely records
// calls) — this suite must prove reconciliation against REAL prop application (textContent, attributes),
// matching the SPEC's own acceptance language ("status's content renders", not "was recorded").

/** `data-{prop}` attribute reflection, mirroring `catalog/default/factories.ts`'s own `setAttr` (null/
 *  undefined/false clear it, true sets the boolean form, else string-coerced) — the harness's stand-in
 *  for a real reflecting DOM property, so an omitted-prop reset (SPEC-R2 AC3) is observable as absence. */
function setAttr(el: HTMLElement, prop: string, value: unknown): void {
  const name = `data-${prop}`
  if (value == null || value === false) el.removeAttribute(name)
  else if (value === true) el.setAttribute(name, '')
  else el.setAttribute(name, String(value))
}

function reconcileHarness() {
  const errors: A2uiError[] = []
  const rewireCalls: A2uiComponent[] = []

  const containerFactory = (tag: string): WidgetFactory => ({
    tag,
    create: () => document.createElement(tag),
    applyProp: (el, prop, value) => setAttr(el, prop, value),
  })
  // `text` is identity-mapped (mapsTo:'text'); `label` is BESPOKE (mapsTo:'caption' ≠ 'label') — the
  // `Button.label`/`Checkbox.label` non-identity precedent this harness needs for SPEC-R2 AC3's narrowed,
  // honest arm (a dropped non-identity prop is NOT reset, and this test proves it stays that way).
  const textFactory: WidgetFactory = {
    tag: 'span',
    create: () => document.createElement('span'),
    applyProp: (el, prop, value) => {
      if (prop === 'text') el.textContent = value == null ? '' : String(value)
      else setAttr(el, prop, value)
    },
  }
  const factories: Record<string, WidgetFactory> = { Column: containerFactory('div'), Row: containerFactory('div'), Text: textFactory }

  const catalog = {
    catalogId: 'demo',
    protocolVersion: 'v1.0',
    components: {
      Column: { name: 'Column', properties: { gap: { type: { type: 'string' }, mapsTo: 'gap' } } },
      Row: { name: 'Row', properties: { gap: { type: { type: 'string' }, mapsTo: 'gap' } } },
      Text: {
        name: 'Text',
        properties: {
          text: { type: { type: 'string' }, mapsTo: 'text' }, // identity — the common (accessorFactory) case
          gap: { type: { type: 'string' }, mapsTo: 'gap' }, // ALSO identity — the omitted-prop-resets leg's prop
          label: { type: { type: 'string' }, mapsTo: 'caption' }, // NON-identity — never reset (SPEC-R2 AC3 narrowed)
        },
      },
    },
    functions: {},
  }
  const entry: CatalogEntry = { catalog, factories }
  const registry: CatalogRegistry = {
    register: () => {},
    get: (id) => (id === 'demo' ? entry : undefined),
    supportedCatalogIds: () => ['demo'],
    submitGateSelector: () => '',
  }

  const resolveValue: WidgetDeps['resolveValue'] = (value, surface) => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && 'path' in value) {
      const data = surface.data.value as Record<string, unknown> | undefined
      return data?.[(value as { path: string }).path.replace(/^\//, '')]
    }
    return value
  }

  const deps: WidgetDeps = { registry, emitError: (e) => void errors.push(e), resolveValue }
  const createWidget = makeCreateWidget(deps)
  const create: CreateOnly = (node, surface) => widgetCreate(node, surface, deps)
  const rewireNode: RewireNode = (el, node, surface, scope, itemScope, ac) => {
    rewireCalls.push(node)
    wireProps(el, node, surface, scope, itemScope, ac, deps)
  }
  const resetProp: ResetProp = (el, node, surface, prop, value) => {
    registry.get(surface.catalogId)?.factories[node.component]?.applyProp(el, prop, value)
  }
  const componentDefOf: ComponentDefOf = (node, surface) => registry.get(surface.catalogId)?.catalog?.components?.[node.component]

  const surface = createSurface({ id: 's1', catalogId: 'demo', version: 'v1.0' })
  const tree = new SurfaceTree(surface, {
    createWidget,
    create,
    rewireNode,
    resetProp,
    componentDefOf,
    onError: (e) => void errors.push(e),
  })
  return { surface, tree, errors, rewireCalls }
}

describe("the ticket's own repro, permanent (TKT-0024 / SPEC-R1 AC1)", () => {
  it('a resent container\'s grown children list renders the new child; the survivor\'s element reference is untouched — not merely the buffered record', () => {
    const { surface, tree } = reconcileHarness()
    tree.apply(
      msg([
        { id: 'root', component: 'Column', children: ['group'] },
        { id: 'group', component: 'Row', children: ['msg'] },
        { id: 'msg', component: 'Text', text: 'hello' },
      ]),
    )
    const root = tree.rootElement!
    const group = root.children[0] as HTMLElement
    const msgEl = group.children[0] as HTMLElement
    expect(root.textContent).toBe('hello')
    expect(root.textContent).not.toContain('READY-MARKER')

    // The repro's own second batch: `group` resent WHOLE with a grown `children`, plus the new `status`
    // node, in the SAME message (message-lifecycle SPEC-R2's whole-record-upsert shape).
    tree.apply(
      msg([
        { id: 'group', component: 'Row', children: ['msg', 'status'] },
        { id: 'status', component: 'Text', text: 'READY-MARKER' },
      ]),
    )

    expect(root.textContent).toContain('hello') // survivor's content untouched
    expect(root.textContent).toContain('READY-MARKER') // the bug this SPEC closes: the new child NOW renders
    expect(group.children).toHaveLength(2)
    expect(group.children[0]).toBe(msgEl) // SAME element reference before/after (SPEC-R1 AC1)
    expect(surface.components.get('status')?.text).toBe('READY-MARKER') // buffered too (was already true pre-fix)
  })
})

describe('children id-diff reconcile (RSR-C5, SPEC-R1)', () => {
  it('a shrunk children list disposes the removed id leak-free — DOM gone, node scope disposed, buffered record cleared (SPEC-R1 AC2 / SPEC-N1)', () => {
    const { surface, tree } = reconcileHarness()
    surface.data.value = { flag: 'x' }
    tree.apply(
      msg([
        { id: 'root', component: 'Column', children: ['group'] },
        { id: 'group', component: 'Row', children: ['msg', 'status'] },
        { id: 'msg', component: 'Text', text: 'hello' },
        { id: 'status', component: 'Text', text: { path: '/flag' } },
      ]),
    )
    const root = tree.rootElement!
    const group = root.children[0] as HTMLElement
    expect(group.children).toHaveLength(2)
    expect(inspect(surface.data).subscribers).toBe(1) // status's bound-prop effect

    tree.apply(msg([{ id: 'group', component: 'Row', children: ['msg'] }]))

    expect(group.children).toHaveLength(1)
    expect(surface.widgets.has('status')).toBe(false)
    expect(surface.components.has('status')).toBe(false) // a LATER re-add behaves like a first-ever arrival
    expect(inspect(surface.data).subscribers).toBe(0) // status's bound-prop effect disposed — no leak (SPEC-N1)
  })

  it('a new id inserted in the MIDDLE of an existing children array lands at the correct DOM position (not merely appended)', () => {
    const { tree } = reconcileHarness()
    tree.apply(
      msg([
        { id: 'root', component: 'Column', children: ['group'] },
        { id: 'group', component: 'Row', children: ['a', 'c'] },
        { id: 'a', component: 'Text', text: 'A' },
        { id: 'c', component: 'Text', text: 'C' },
      ]),
    )
    const group = tree.rootElement!.children[0] as HTMLElement
    const [aEl, cEl] = [...group.children] as HTMLElement[]

    tree.apply(
      msg([
        { id: 'group', component: 'Row', children: ['a', 'b', 'c'] },
        { id: 'b', component: 'Text', text: 'B' },
      ]),
    )

    expect([...group.children].map((c) => c.textContent)).toEqual(['A', 'B', 'C'])
    expect(group.children[0]).toBe(aEl) // survivors untouched, in their original elements
    expect(group.children[2]).toBe(cEl)
  })

  it('a pure reorder of an already-fully-present children set moves nothing and disposes nothing (SPEC-R5, deferred)', () => {
    const { tree, rewireCalls } = reconcileHarness()
    tree.apply(
      msg([
        { id: 'root', component: 'Column', children: ['group'] },
        { id: 'group', component: 'Row', children: ['a', 'b'] },
        { id: 'a', component: 'Text', text: 'A' },
        { id: 'b', component: 'Text', text: 'B' },
      ]),
    )
    const group = tree.rootElement!.children[0] as HTMLElement
    const [aEl, bEl] = [...group.children] as HTMLElement[]

    tree.apply(msg([{ id: 'group', component: 'Row', children: ['b', 'a'] }])) // reorder only — no add/remove

    // SPEC-R5 AC1: no DOM node moves, no node scope disposed — survivors keep their CURRENT DOM position.
    expect(group.children[0]).toBe(aEl)
    expect(group.children[1]).toBe(bEl)
    expect(rewireCalls).toEqual([]) // no prop reconcile fired either — `group`'s own props are unchanged
  })
})

describe('no reconcile without an actual delta (RSR-C4, SPEC-R1 AC3 / SPEC-R3)', () => {
  it('a byte-identical resend is inert — no children mount/unmount, no prop rewire', () => {
    const { surface, tree, rewireCalls } = reconcileHarness()
    surface.data.value = { label: 'x' }
    tree.apply(
      msg([
        { id: 'root', component: 'Column', children: ['group'] },
        { id: 'group', component: 'Row', gap: 'sm', children: ['msg'] },
        { id: 'msg', component: 'Text', text: { path: '/label' } },
      ]),
    )
    const group = tree.rootElement!.children[0] as HTMLElement
    const msgEl = group.children[0] as HTMLElement
    expect(rewireCalls).toEqual([])

    tree.apply(msg([{ id: 'group', component: 'Row', gap: 'sm', children: ['msg'] }])) // byte-identical
    expect(rewireCalls).toEqual([])
    expect(group.children[0]).toBe(msgEl)
  })

  it('a resend re-delivering the SAME {path} binding as a NEW object reference is STILL inert — deep, not reference, equality (the first draft\'s Object.is gate would have failed this)', () => {
    const { surface, tree, rewireCalls } = reconcileHarness()
    surface.data.value = { label: 'x' }
    tree.apply(
      msg([
        { id: 'root', component: 'Column', children: ['msg'] },
        { id: 'msg', component: 'Text', text: { path: '/label' } },
      ]),
    )
    expect(rewireCalls).toEqual([])

    tree.apply(msg([{ id: 'msg', component: 'Text', text: { path: '/label' } }]))
    expect(rewireCalls).toEqual([]) // structurally identical binding, fresh object reference — still a no-op
  })
})

describe('prop reconcile onto the SAME existing element (RSR-C6, SPEC-R2)', () => {
  it('a literal change and a {path} rebind-target change both land on the SAME element (AC1/AC2); an omitted IDENTITY-mapped prop resets to default (AC3); an omitted NON-identity-mapped prop LINGERS (AC3\'s narrowed, honest scope)', async () => {
    const { surface, tree } = reconcileHarness()
    surface.data.value = { a: 'AA', b: 'BB' }
    tree.apply(
      msg([
        { id: 'root', component: 'Column', children: ['t'] },
        { id: 't', component: 'Text', text: { path: '/a' }, label: 'Caption', gap: 'sm' },
      ]),
    )
    const el = tree.rootElement!.children[0] as HTMLElement
    expect(el.textContent).toBe('AA')
    expect(el.getAttribute('data-label')).toBe('Caption')

    // AC2: rebind the SAME prop to a DIFFERENT path — tracks the new target, not the old (the old effect
    // is disposed, not left subscribed to a target the record no longer names).
    tree.apply(msg([{ id: 't', component: 'Text', text: { path: '/b' }, label: 'Caption', gap: 'sm' }]))
    expect(el.textContent).toBe('BB')
    surface.data.value = { ...(surface.data.peek() as Record<string, unknown>), a: 'STALE-IF-LEAKED' }
    await whenFlushed()
    expect(el.textContent).toBe('BB') // '/a' is no longer the bound path — a stale subscription would revert this

    // AC3 (narrowed): drop `gap`, IDENTITY-mapped (mapsTo:'gap') — resets to the factory's declared default.
    tree.apply(msg([{ id: 't', component: 'Text', text: { path: '/b' }, label: 'Caption' }]))
    expect(el.hasAttribute('data-gap')).toBe(false) // reset — does not linger for an identity-mapped prop

    // Same AC3, NON-identity `label` (mapsTo:'caption' ≠ 'label'): dropping it is NOT reset — the
    // documented, honest gap this wave ships (ADR-0128 Consequences / SPEC-R2 AC3's narrowed arm).
    tree.apply(msg([{ id: 't', component: 'Text', text: { path: '/b' } }]))
    expect(el.getAttribute('data-label')).toBe('Caption') // LINGERS
  })

  it('a resent element is never re-minted — the SAME element reference persists across a prop-only resend', () => {
    const { tree } = reconcileHarness()
    tree.apply(
      msg([
        { id: 'root', component: 'Column', children: ['t'] },
        { id: 't', component: 'Text', text: 'first' },
      ]),
    )
    const el = tree.rootElement!.children[0]
    tree.apply(msg([{ id: 't', component: 'Text', text: 'second' }]))
    expect(tree.rootElement!.children[0]).toBe(el)
    expect(el.textContent).toBe('second')
  })
})

describe('whole-surface teardown after structural resends (RSR-C1 carrier — no per-node leak)', () => {
  it('disposeSurface disposes every static node\'s own scope, not only the surface\'s top-level scope', () => {
    const { surface, tree } = reconcileHarness()
    surface.data.value = { a: '1', b: '2' }
    tree.apply(
      msg([
        { id: 'root', component: 'Column', children: ['group'] },
        { id: 'group', component: 'Row', children: ['x'] },
        { id: 'x', component: 'Text', text: { path: '/a' } },
      ]),
    )
    tree.apply(
      msg([
        { id: 'group', component: 'Row', children: ['x', 'y'] }, // children reconcile
        { id: 'y', component: 'Text', text: { path: '/b' } },
      ]),
    )
    tree.apply(msg([{ id: 'x', component: 'Text', text: { path: '/a' }, label: 'renamed' }])) // prop reconcile
    expect(inspect(surface.data).subscribers).toBe(2) // x's + y's bound-prop effects, both still live

    disposeSurface(surface)
    expect(inspect(surface.data).subscribers).toBe(0) // every static node's own scope disposed — no leak
  })
})

describe('H1 review fix: a PROP-ONLY resend must not freeze a nested dynamic-list TEMPLATE (RSR-C1 propsScope/childrenScope split)', () => {
  it('resending a templated container\'s OWN non-structural prop (children unchanged) leaves the list live — it still GROWS and SHRINKS on a later data write', async () => {
    const { surface, tree } = reconcileHarness()
    surface.data.value = { rows: [{ label: 'a' }, { label: 'b' }] }
    tree.apply(
      msg([
        { id: 'root', component: 'Column', children: ['grid'] },
        { id: 'grid', component: 'Row', gap: 'sm', children: { path: '/rows', componentId: 'item' } },
        { id: 'item', component: 'Text', text: { path: 'label' } },
      ]),
    )
    const grid = tree.rootElement!.children[0] as HTMLElement
    expect(grid.children).toHaveLength(2)

    // A resend of `grid` whose `children` TEMPLATE is byte-identical (so `#reconcileChildren` never runs —
    // `childRefs()` returns `[]` for a template either way, SPEC-R1's own non-goal) but whose `gap` changed —
    // MUST route through `#reconcileProps` alone. Before the H1 fix, disposing a single combined scope here
    // would kill the list's reconcile-loop effect + teardown carrier (rooted in this node's OWN scope) and
    // `rewireNode` never re-invokes `renderList` — the list would silently freeze, still showing 2 forever.
    tree.apply(msg([{ id: 'grid', component: 'Row', gap: 'lg', children: { path: '/rows', componentId: 'item' } }]))
    expect(grid.getAttribute('data-gap')).toBe('lg') // the prop reconcile itself DID run
    expect(grid.children).toHaveLength(2) // the list survived the prop-only reconcile, unfrozen

    // The reviewer's exact probe: grow AFTER the prop reconcile — it must still react.
    surface.data.value = { rows: [{ label: 'a' }, { label: 'b' }, { label: 'c' }] }
    await whenFlushed()
    expect(grid.children).toHaveLength(3)

    // ...and shrink too.
    surface.data.value = { rows: [{ label: 'a' }] }
    await whenFlushed()
    expect(grid.children).toHaveLength(1)
  })
})

describe('M1 review fix: an unresolved-type resend must not re-emit CATALOG from the reconcile path (SPEC-N3)', () => {
  it('a dropped-prop resend of an UNKNOWN-component (placeholder) node does not re-resolve the factory or re-emit CATALOG', () => {
    const { tree, errors } = reconcileHarness()
    tree.apply(
      msg([
        { id: 'root', component: 'Column', children: ['x'] },
        { id: 'x', component: 'Nope', foo: 'a', bar: 'b' }, // 'Nope' names no factory in this harness's catalog
      ]),
    )
    expect(errors).toHaveLength(1) // the one, expected CATALOG emission at first mount
    expect(errors[0].code).toBe('CATALOG')
    const before = errors.length

    tree.apply(msg([{ id: 'x', component: 'Nope', foo: 'a' }])) // `bar` dropped — a prop-only resend
    expect(errors.length).toBe(before) // #resetOmittedProps must not re-resolve create() and re-emit
  })
})
