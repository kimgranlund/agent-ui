import { describe, it, expect, afterEach } from 'vitest'
import { html, render, type TemplateResult } from './template.ts'
import { repeat } from './repeat.ts'

// G3 S1 — the `repeat` directive (rubric template.md D4). `repeat` is a NO_COMMIT child directive that
// reconciles a keyed list via per-item sub-`ChildPart`s: reuse-by-key, move-by-identity, dup-key throw, and
// ZERO moves of existing nodes for an append / remove-tail / a stable prefix. These probes drive it through
// the bare `render` engine (it owns no effect, so no host is needed). Named probes: repeat-keyed ·
// repeat-move-identity · repeat-dup-throw · repeat-zero-move. Each gate ships a negative control whose
// described mutation turns it RED, anchored on a unique token (dupKey9 · keepFocusC · tailZ).

function mount(): HTMLElement {
  const c = document.createElement('div')
  document.body.append(c)
  return c
}

afterEach(() => {
  document.body.replaceChildren()
})

/** One list item: a `<li data-k>` whose text is its key — a SINGLE template per item (the `repeat` norm). */
const li = (k: string): TemplateResult => html`<li data-k=${k}>${k}</li>`

/** A keyed list of `<li>` items, keyed by identity. */
const list = (keys: string[]): TemplateResult => html`<ul>${repeat(keys, (k) => k, li)}</ul>`

/** The `data-k` order of the rendered `<li>`s — the committed DOM order. */
function order(c: HTMLElement): (string | null)[] {
  return Array.from(c.querySelectorAll('li')).map((l) => l.getAttribute('data-k'))
}

/** Run `fn` and return the set of nodes a childList MutationObserver saw added/removed under `target`. */
function trackMoves(target: Node, fn: () => void): Set<Node> {
  const obs = new MutationObserver(() => {})
  obs.observe(target, { childList: true, subtree: true })
  fn()
  const touched = new Set<Node>()
  for (const record of obs.takeRecords()) {
    record.addedNodes.forEach((n) => touched.add(n))
    record.removedNodes.forEach((n) => touched.add(n))
  }
  obs.disconnect()
  return touched
}

describe('repeat — add / remove / clear (the basic keyed lifecycle, D4)', () => {
  it('repeat-keyed: renders, appends, removes a head, and clears a keyed list', () => {
    const c = mount()
    render(list([]), c) // start empty
    expect(c.querySelector('li')).toBe(null)

    render(list(['a', 'b', 'c']), c)
    expect(order(c)).toEqual(['a', 'b', 'c'])

    render(list(['a', 'b', 'c', 'd']), c) // append
    expect(order(c)).toEqual(['a', 'b', 'c', 'd'])

    render(list(['b', 'c', 'd']), c) // remove the head
    expect(order(c)).toEqual(['b', 'c', 'd'])

    render(list([]), c) // clear
    expect(order(c)).toEqual([])
    expect(c.querySelector('ul')?.textContent).toBe('')
  })
})

describe('repeat — reuse by key (D4)', () => {
  it('repeat-keyed: a surviving key REUSES its node across a data change (identity stable)', () => {
    const c = mount()
    render(list(['a', 'b', 'c']), c)
    const liB = c.querySelector('[data-k="b"]')

    render(list(['a', 'b', 'c', 'd']), c) // `b` survives the append
    expect(c.querySelector('[data-k="b"]')).toBe(liB) // the SAME node — reused by key, not re-created
  })

  it('repeat-keyed: prepend keeps the existing suffix nodes in place (tail trim)', () => {
    const c = mount()
    render(list(['b', 'c']), c)
    const liB = c.querySelector('[data-k="b"]')
    const liC = c.querySelector('[data-k="c"]')

    render(list(['a', 'b', 'c']), c) // tails [b,c] match → trimmed in place; only `a` is created
    expect(order(c)).toEqual(['a', 'b', 'c'])
    expect(c.querySelector('[data-k="b"]')).toBe(liB)
    expect(c.querySelector('[data-k="c"]')).toBe(liC)
  })

  it('repeat-keyed: a full shuffle (the key-map branch) preserves every node identity + order', () => {
    const c = mount()
    render(list(['a', 'b', 'c', 'd']), c)
    const nodes = Object.fromEntries(['a', 'b', 'c', 'd'].map((k) => [k, c.querySelector(`[data-k="${k}"]`)]))

    render(list(['c', 'd', 'a', 'b']), c) // a rotation the head/tail trim can't resolve → the key→index map
    expect(order(c)).toEqual(['c', 'd', 'a', 'b'])
    for (const k of ['a', 'b', 'c', 'd']) expect(c.querySelector(`[data-k="${k}"]`)).toBe(nodes[k])
  })

  it('repeat-keyed: removes middle keys and inserts a new one (map branch), reusing survivors', () => {
    const c = mount()
    render(list(['a', 'b', 'c', 'd']), c)
    const liA = c.querySelector('[data-k="a"]')
    const liD = c.querySelector('[data-k="d"]')

    render(list(['a', 'x', 'd']), c) // b,c removed via the map; x created; a,d reused
    expect(order(c)).toEqual(['a', 'x', 'd'])
    expect(c.querySelector('[data-k="a"]')).toBe(liA)
    expect(c.querySelector('[data-k="d"]')).toBe(liD)
    expect(c.querySelector('[data-k="b"]')).toBe(null)
    expect(c.querySelector('[data-k="c"]')).toBe(null)
  })
})

describe('repeat — move by identity on a reorder (D4 = 5)', () => {
  it('repeat-move-identity: a reorder MOVES surviving sub-parts by identity (nodes preserved, not re-created)', () => {
    const c = mount()
    // Each item is an `<input data-k>` so the moved node is a focusable, stateful element. `keepFocusC` is the
    // item moved to the front (the worst case — a relative-order break that MUST move that node).
    const view = (keys: string[]): TemplateResult =>
      html`<ul>${repeat(keys, (k) => k, (k) => html`<li><input data-k=${k} /></li>`)}</ul>`

    render(view(['a', 'b', 'keepFocusC']), c)
    const inA = c.querySelector('[data-k="a"]')
    const inB = c.querySelector('[data-k="b"]')
    const inC = c.querySelector('[data-k="keepFocusC"]') as HTMLInputElement
    inC.focus() // the input whose NODE must survive the reorder — the property focus-preservation builds on

    render(view(['keepFocusC', 'a', 'b']), c) // reorder — `keepFocusC` moves to the front
    expect(Array.from(c.querySelectorAll('input')).map((i) => i.getAttribute('data-k'))).toEqual(['keepFocusC', 'a', 'b'])
    // The discriminating guarantee: each surviving input is the SAME node, relocated by `moveBefore`, not a
    // fresh node created by index. NC: replace move-by-identity with dispose+re-create → these `===` checks
    // (the `keepFocusC` node included) go RED. (jsdom's `before()`-based `moveBefore` blurs activeElement on
    // the detach+reinsert, so focus survival itself is a native-atomic-moveBefore property — see the handoff
    // escalation; node identity, asserted here, is what `repeat` guarantees at this seam.)
    expect(c.querySelector('[data-k="a"]')).toBe(inA)
    expect(c.querySelector('[data-k="b"]')).toBe(inB)
    expect(c.querySelector('[data-k="keepFocusC"]')).toBe(inC)
  })
})

describe('repeat — duplicate key throws (D4)', () => {
  it('repeat-dup-throw: a duplicate key throws rather than silently overwriting', () => {
    const c = mount()
    // Two `dupKey9` keys in one render → the dup-key Set guard throws BEFORE any DOM mutation.
    const dup = (): TemplateResult => html`<ul>${repeat(['x', 'dupKey9', 'dupKey9'], (k) => k, li)}</ul>`
    // NC: remove the `seen.has(key)` throw in `RepeatDirective.update` → no throw → this `toThrow` goes RED.
    expect(() => render(dup(), c)).toThrow(/duplicate key/)
    expect(c.querySelector('li')).toBe(null) // threw in the build pass — no item was mounted
  })
})

describe('repeat — zero moves of existing nodes (D4 = 5)', () => {
  it('repeat-zero-move: append / remove-tail move ZERO existing nodes (a `tailZ` append touches no survivor)', () => {
    const c = mount()
    render(list(['a', 'b', 'c']), c)
    const ul = c.querySelector('ul')!
    const liA = c.querySelector('[data-k="a"]')!
    const liB = c.querySelector('[data-k="b"]')!
    const liC = c.querySelector('[data-k="c"]')!

    // APPEND — the head trim leaves a,b,c untouched; only the new `tailZ` node enters the DOM.
    // NC: make the reconcile re-insert every node each update → a,b,c appear in the move set → RED.
    let moved = trackMoves(ul, () => render(list(['a', 'b', 'c', 'tailZ']), c))
    expect(order(c)).toEqual(['a', 'b', 'c', 'tailZ'])
    expect(moved.has(liA)).toBe(false)
    expect(moved.has(liB)).toBe(false)
    expect(moved.has(liC)).toBe(false)

    // REMOVE-TAIL — a,b survive untouched (the removed `tailZ`/`c` nodes are expected, not survivor moves).
    moved = trackMoves(ul, () => render(list(['a', 'b']), c))
    expect(order(c)).toEqual(['a', 'b'])
    expect(moved.has(liA)).toBe(false)
    expect(moved.has(liB)).toBe(false)
  })
})
