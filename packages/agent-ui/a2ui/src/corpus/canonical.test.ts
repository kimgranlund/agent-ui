import { describe, it, expect } from 'vitest'
import { canonicalize, CanonicalizeError } from './canonical.ts'
import type { A2uiOutput, A2uiComponent } from '../protocol.ts'

const V = 'v1.0'

const createSurfaceMsg = (): A2uiOutput[number] => ({ version: V, createSurface: { surfaceId: 's1', catalogId: 'demo' } })
const updateComponentsMsg = (components: A2uiComponent[]): A2uiOutput[number] => ({
  version: V,
  updateComponents: { surfaceId: 's1', components },
})
const updateDataModelMsg = (value: unknown, path?: string): A2uiOutput[number] => ({
  version: V,
  updateDataModel: { surfaceId: 's1', path, value },
})

// A small representative tree: root (Column) -> [b1 (Button, bound label), b2 (Text)].
const basicTree = (): A2uiComponent[] => [
  { id: 'root', component: 'Column', children: ['b1', 'b2'] },
  { id: 'b1', component: 'Button', label: { path: '/cta' } },
  { id: 'b2', component: 'Text', text: 'static' },
]

describe('canonicalize — order / whitespace / id-spelling invariance (SPEC-R6 AC1)', () => {
  it('component declaration order (within one updateComponents.components array) does not change the hash', async () => {
    const forward: A2uiOutput = [createSurfaceMsg(), updateComponentsMsg(basicTree())]
    const reversed: A2uiOutput = [createSurfaceMsg(), updateComponentsMsg([...basicTree()].reverse())]

    const a = await canonicalize(forward)
    const b = await canonicalize(reversed)

    expect(a.serialized).toBe(b.serialized)
    expect(a.hash).toBe(b.hash)
  })

  it('splitting the same components across multiple updateComponents deliveries does not change the hash', async () => {
    const [root, b1, b2] = basicTree() as [A2uiComponent, A2uiComponent, A2uiComponent]
    const oneShot: A2uiOutput = [createSurfaceMsg(), updateComponentsMsg([root, b1, b2])]
    const split: A2uiOutput = [
      createSurfaceMsg(),
      updateComponentsMsg([b2]),
      updateComponentsMsg([root]),
      updateComponentsMsg([b1]),
    ]

    const a = await canonicalize(oneShot)
    const b = await canonicalize(split)

    expect(a.hash).toBe(b.hash)
  })

  it('object key-insertion order (the parsed-JSON analogue of insignificant whitespace) does not change the hash', async () => {
    // Same content, different property-declaration order on the wire component object.
    const declOrderA: A2uiComponent = { id: 'b1', component: 'Button', label: { path: '/cta' } }
    const declOrderB: A2uiComponent = { label: { path: '/cta' }, component: 'Button', id: 'b1' }

    const a = await canonicalize([createSurfaceMsg(), updateComponentsMsg([{ id: 'root', component: 'Column', children: ['b1'] }, declOrderA])])
    const b = await canonicalize([createSurfaceMsg(), updateComponentsMsg([{ id: 'root', component: 'Column', children: ['b1'] }, declOrderB])])

    expect(a.serialized).toBe(b.serialized)
    expect(a.hash).toBe(b.hash)
  })

  it('the original component-id spelling does not change the hash — only structure/content do', async () => {
    const spelledA: A2uiOutput = [
      createSurfaceMsg(),
      updateComponentsMsg([
        { id: 'root', component: 'Column', children: ['myButton', 'myText'] },
        { id: 'myButton', component: 'Button', label: { path: '/cta' } },
        { id: 'myText', component: 'Text', text: 'static' },
      ]),
    ]
    const spelledB: A2uiOutput = [
      createSurfaceMsg(),
      updateComponentsMsg([
        { id: 'root', component: 'Column', children: ['cta-button', 'legend'] },
        { id: 'cta-button', component: 'Button', label: { path: '/cta' } },
        { id: 'legend', component: 'Text', text: 'static' },
      ]),
    ]

    const a = await canonicalize(spelledA)
    const b = await canonicalize(spelledB)

    expect(a.serialized).toBe(b.serialized)
    expect(a.hash).toBe(b.hash)
    // Canonical ids are the DFS numbering, never the original spelling.
    expect(a.form.components.map((c) => c.id)).toEqual(['c0', 'c1', 'c2'])
  })
})

describe('canonicalize — structural / content changes change the hash (SPEC-R6 AC2)', () => {
  it('a changed bound path changes the hash', async () => {
    const base: A2uiOutput = [createSurfaceMsg(), updateComponentsMsg(basicTree())]
    const changedPath: A2uiOutput = [
      createSurfaceMsg(),
      updateComponentsMsg([
        { id: 'root', component: 'Column', children: ['b1', 'b2'] },
        { id: 'b1', component: 'Button', label: { path: '/other' } },
        { id: 'b2', component: 'Text', text: 'static' },
      ]),
    ]

    const a = await canonicalize(base)
    const b = await canonicalize(changedPath)
    expect(a.hash).not.toBe(b.hash)
  })

  it('a changed component type changes the hash', async () => {
    const base: A2uiOutput = [createSurfaceMsg(), updateComponentsMsg(basicTree())]
    const changedType: A2uiOutput = [
      createSurfaceMsg(),
      updateComponentsMsg([
        { id: 'root', component: 'Column', children: ['b1', 'b2'] },
        { id: 'b1', component: 'Text', label: { path: '/cta' } }, // was Button
        { id: 'b2', component: 'Text', text: 'static' },
      ]),
    ]

    const a = await canonicalize(base)
    const b = await canonicalize(changedType)
    expect(a.hash).not.toBe(b.hash)
  })

  it('a changed child order changes the hash — order within a container is semantic', async () => {
    const base: A2uiOutput = [createSurfaceMsg(), updateComponentsMsg(basicTree())]
    const swapped: A2uiOutput = [
      createSurfaceMsg(),
      updateComponentsMsg([
        { id: 'root', component: 'Column', children: ['b2', 'b1'] }, // swapped
        { id: 'b1', component: 'Button', label: { path: '/cta' } },
        { id: 'b2', component: 'Text', text: 'static' },
      ]),
    ]

    const a = await canonicalize(base)
    const b = await canonicalize(swapped)
    expect(a.hash).not.toBe(b.hash)
  })

  it('a changed folded data model changes the hash even when the bound tree is identical', async () => {
    const withA: A2uiOutput = [createSurfaceMsg(), updateComponentsMsg(basicTree()), updateDataModelMsg({ cta: 'Go' })]
    const withB: A2uiOutput = [createSurfaceMsg(), updateComponentsMsg(basicTree()), updateDataModelMsg({ cta: 'Stop' })]

    const a = await canonicalize(withA)
    const b = await canonicalize(withB)
    expect(a.hash).not.toBe(b.hash)
  })
})

describe('canonicalize — updateDataModel path:"/" is the root alias, same as path omitted (ADR-0099)', () => {
  it('folds path:"/" and omitted-path to the identical whole-model dataModel — same hash (renderer/corpus parity)', async () => {
    const omitted: A2uiOutput = [
      createSurfaceMsg(),
      updateComponentsMsg(basicTree()),
      updateDataModelMsg({ cta: 'Go' }), // path omitted — the corpus idiom
    ]
    const slashRoot: A2uiOutput = [
      createSurfaceMsg(),
      updateComponentsMsg(basicTree()),
      updateDataModelMsg({ cta: 'Go' }, '/'), // the spec's documented root-alias spelling
    ]

    const a = await canonicalize(omitted)
    const b = await canonicalize(slashRoot)
    expect(b.form.dataModel).toEqual({ cta: 'Go' }) // NOT nested under a spurious {"":...} key
    expect(a.serialized).toBe(b.serialized)
    expect(a.hash).toBe(b.hash)
  })
})

describe('canonicalize — children-template componentId rewrite (v1.0 dynamic list, LLD §4 step 4)', () => {
  it('rewrites the template componentId to its canonical id and keeps it reachable', async () => {
    const out: A2uiOutput = [
      createSurfaceMsg(),
      updateComponentsMsg([
        { id: 'root', component: 'Column', children: { path: '/items', componentId: 'itemTpl' } },
        { id: 'itemTpl', component: 'Text', text: { path: 'name' } }, // relative binding, list-item scope
      ]),
      updateDataModelMsg({ items: [{ name: 'a' }, { name: 'b' }] }),
    ]

    const result = await canonicalize(out)

    expect(result.disconnected).toEqual([])
    expect(result.componentsUsed).toEqual(['Column', 'Text'])
    const root = result.form.components.find((c) => c.component === 'Column')!
    expect(root.children).toEqual({ path: '/items', componentId: 'c1' })
    // the template's target is itself present in the canonical component list (reachable).
    expect(result.form.components.some((c) => c.id === 'c1' && c.component === 'Text')).toBe(true)
  })
})

describe('canonicalize — disconnected components (LLD §4 edge case)', () => {
  it('drops a declared-but-unreachable component from the canonical form and reports it', async () => {
    const out: A2uiOutput = [
      createSurfaceMsg(),
      updateComponentsMsg([
        { id: 'root', component: 'Column', children: ['b1'] },
        { id: 'b1', component: 'Button', label: { path: '/cta' } },
        { id: 'orphan', component: 'Text', text: 'never linked' },
      ]),
    ]

    const result = await canonicalize(out)

    expect(result.disconnected).toEqual(['orphan'])
    expect(result.form.components.some((c) => c.component === 'Text')).toBe(false)
    expect(result.componentsUsed).toEqual(['Button', 'Column'])
  })
})

describe('canonicalize — hash stability (SPEC-N6)', () => {
  it('computes the hash via crypto.subtle and is stable across repeated calls on the same input', async () => {
    const out: A2uiOutput = [createSurfaceMsg(), updateComponentsMsg(basicTree()), updateDataModelMsg({ cta: 'Go' })]

    const first = await canonicalize(out)
    const second = await canonicalize(out)

    expect(first.hash).toBe(second.hash)
    expect(first.hash).toMatch(/^[0-9a-f]{64}$/) // SHA-256 hex digest
  })
})

describe('canonicalize — defensive root/cycle guard (LLD §4 step 2)', () => {
  it('rejects when no root component is present', async () => {
    const out: A2uiOutput = [createSurfaceMsg(), updateComponentsMsg([{ id: 'b1', component: 'Button' }])]

    await expect(canonicalize(out)).rejects.toBeInstanceOf(CanonicalizeError)
    await expect(canonicalize(out)).rejects.toMatchObject({ code: 'IDGRAPH' })
  })

  it('rejects on a cycle in the child/children graph', async () => {
    const out: A2uiOutput = [
      createSurfaceMsg(),
      updateComponentsMsg([
        { id: 'root', component: 'Column', child: 'a' },
        { id: 'a', component: 'Column', child: 'b' },
        { id: 'b', component: 'Column', child: 'root' }, // cycles back to root
      ]),
    ]

    await expect(canonicalize(out)).rejects.toBeInstanceOf(CanonicalizeError)
    await expect(canonicalize(out)).rejects.toMatchObject({ code: 'IDGRAPH' })
  })
})
