import { describe, it, expect } from 'vitest'
import { inspect, whenFlushed } from '@agent-ui/components'
import type { A2uiComponent, A2uiError } from '../protocol.ts'
import type { CreateWidget } from './types.ts'
import { createSurface, disposeSurface } from './surface.ts'
import { resolve, setPointer } from './binding.ts'
import { makeCreateWidget } from './widget.ts'
import type { CatalogEntry, CatalogRegistry, WidgetFactory } from '../catalog/types.ts'
import { SurfaceTree, type UpdateComponentsMessage } from './tree.ts'

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
  const tree = new SurfaceTree(surface, { createWidget, onError })
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
    }
    const createWidget = makeCreateWidget({ registry, emitError: () => {}, resolveBinding: () => undefined })
    const surface = createSurface({ id: 's1', catalogId: 'demo', version: 'v1.0' })
    const tree = new SurfaceTree(surface, { createWidget, onError: () => {} })
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
    }
    const createWidget = makeCreateWidget({
      registry,
      emitError: () => {},
      resolveBinding: (b, s, itemScope) => resolve(b, s, itemScope),
    })
    const surface = createSurface({ id: 's1', catalogId: 'demo', version: 'v1.0' })
    const tree = new SurfaceTree(surface, { createWidget, onError: () => {} })
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
