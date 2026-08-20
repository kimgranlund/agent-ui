import { describe, it, expect, vi } from 'vitest'
import { UIDrillElement } from './drill.ts'
import { UIDrillPanelElement } from './drill-panel.ts'
import { UIContainerElement } from '../../dom/container.ts'
import { UIFormElement } from '../../dom/form.ts'
import { whenFlushed } from '../../reactive/index.ts'

// ADR-0195 — UIDrillElement jsdom behaviour: prop→DOM mapping, path resolution (controlled/uncontrolled),
// drill-forward delegation, Back, the change event, ARIA role + labelling, focus-move priming. jsdom has no
// real layout, so the CSS-transform/View-Transition motion split (drill.browser.test.ts's job) is out of scope
// here — this file proves the STATE MACHINE. Effects are microtask-batched (reactive/scheduler.ts) — every
// test that triggers a signal write (a click, a `path` assignment) awaits `whenFlushed()` before asserting on
// the DOM the render effect writes (the split.test.ts `await Promise.resolve()` precedent, the named seam).

class ProbeDrill extends UIDrillElement {
  get effectivePath(): string[] {
    return this.effectivePathSeam
  }
  get parts(): { back: HTMLButtonElement | null; heading: HTMLHeadingElement | null; crumbsNav: HTMLElement | null } {
    return this.headerPartsSeam
  }
  get probeInternals(): ElementInternals {
    return this.internals
  }
  // S3 (cl.A1/A8) — the RESOLVED render mapping ('stack'|'columns'); jsdom has no `@container` support, so
  // this always reads the WIDE arm — see #effectiveLayout's own comment (drill.ts).
  get effectiveLayout(): 'stack' | 'columns' {
    return this.effectiveLayoutSeam
  }
}
customElements.define('ui-drill-probe', ProbeDrill)

// S3 — read `internals.ariaLabel` off a REAL `ui-drill-panel` (the pagination.test.ts `probeInternals`
// precedent, applied via a cast rather than a probe SUBCLASS: a differently-tagged panel subclass would
// break drill.ts's own tag-based `trigger.closest('ui-drill-panel')` lookup used for click routing — the
// `UIDrillElement`/`ProbeDrill` probe-subclass shape above is safe only because nothing does a
// `closest('ui-drill')` tag lookup on the HOST). `linkHeading`'s element reflection
// (`ariaLabelledByElements`) is feature-detected absent in jsdom, but the PLAIN string property
// `labelDirect` sets (`internals.ariaLabel`) is real and testable here.
function ariaLabelOf(p: UIDrillPanelElement): string | null {
  return (p as unknown as { internals: ElementInternals }).internals.ariaLabel
}

function panel(key: string, opts: { parent?: string; heading?: string } = {}): UIDrillPanelElement {
  const p = new UIDrillPanelElement()
  p.key = key
  if (opts.parent) p.parent = opts.parent
  if (opts.heading) p.heading = opts.heading
  return p
}

function trigger(key: string, label = key): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.setAttribute('data-role', 'drill-trigger')
  btn.setAttribute('data-drill-key', key)
  btn.textContent = label
  return btn
}

/** A 3-level tree: root → settings → appearance. */
function makeTree(): ProbeDrill {
  const el = new ProbeDrill()
  const root = panel('root', { heading: 'Root' })
  root.append(trigger('settings'))
  const settings = panel('settings', { parent: 'root', heading: 'Settings' })
  settings.append(trigger('appearance'))
  const appearance = panel('appearance', { parent: 'settings', heading: 'Appearance' })
  el.append(root, settings, appearance)
  document.body.append(el)
  return el
}

/** S3 — a BRANCHING tree: root → {settings → {appearance, privacy}, notifications}. Both root and settings
 *  carry TWO triggers so a columns-mode ancestor-column click can be proven to truncate to a DIFFERENT
 *  branch, not merely re-click the key already on the path (ADR-0195 Amendment cl.A1). */
function makeBranchingTree(panelFactory: typeof panel = panel): ProbeDrill {
  const el = new ProbeDrill()
  const root = panelFactory('root', { heading: 'Root' })
  root.append(trigger('settings'), trigger('notifications'))
  const settings = panelFactory('settings', { parent: 'root', heading: 'Settings' })
  settings.append(trigger('appearance'), trigger('privacy'))
  const appearance = panelFactory('appearance', { parent: 'settings', heading: 'Appearance' })
  const privacy = panelFactory('privacy', { parent: 'settings', heading: 'Privacy' })
  const notifications = panelFactory('notifications', { parent: 'root', heading: 'Notifications' })
  el.append(root, settings, appearance, privacy, notifications)
  document.body.append(el)
  return el
}

/** Dispatch a real bubbling click and wait for the effect scheduler to settle. */
async function click(el: Element): Promise<void> {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await whenFlushed()
}

describe('UIDrillElement — upgrade + defaults', () => {
  it('upgrades to the class; is a UIContainerElement, NOT form-associated; path defaults undefined', () => {
    const el = document.createElement('ui-drill') as UIDrillElement
    document.body.append(el)
    expect(el).toBeInstanceOf(UIDrillElement)
    expect(el).toBeInstanceOf(UIContainerElement)
    expect(el).not.toBeInstanceOf(UIFormElement)
    expect(el.path).toBeUndefined()
    el.remove()
  })

  it('creates the header/back/heading parts once, prepended before author panels', () => {
    const el = makeTree()
    const header = el.querySelector(':scope > [data-part="header"]')
    expect(header).not.toBeNull()
    expect(header?.querySelector('[data-part="back"]')).not.toBeNull()
    expect(header?.querySelector('[data-part="heading"]')).not.toBeNull()
    expect(el.firstElementChild).toBe(header)
    el.remove()
  })

  it('sets internals.role = group on the host', () => {
    const el = makeTree()
    expect(el.probeInternals.role).toBe('group')
    el.remove()
  })
})

describe('UIDrillElement — uncontrolled path resolution + self-mutation', () => {
  it('resolves to the root panel by default (path seeds to [rootKey])', () => {
    const el = makeTree()
    expect(el.effectivePath).toEqual(['root'])
    expect(el.querySelector('[key="root"]')?.hasAttribute('hidden')).toBe(false)
    expect(el.querySelector('[key="settings"]')?.hasAttribute('hidden')).toBe(true)
    el.remove()
  })

  it('drilling forward (a real click on a data-role="drill-trigger" element) self-mutates + PAINTS the ancestor dimmed+inert (ADR-0195 Amendment cl.A1 — stack default)', async () => {
    const el = makeTree()
    const onChange = vi.fn()
    el.addEventListener('change', onChange)
    await click(el.querySelector('[data-drill-key="settings"]')!)
    expect(el.effectivePath).toEqual(['root', 'settings'])
    const settings = el.querySelector('[key="settings"]') as UIDrillPanelElement
    const root = el.querySelector('[key="root"]') as UIDrillPanelElement
    // the ACTIVE panel: visible, interactive, marked 'active'
    expect(settings.hasAttribute('hidden')).toBe(false)
    expect(settings.inert).toBe(false)
    expect(settings.getAttribute('data-drill-pane')).toBe('active')
    // the painted ANCESTOR (key ∈ path, not the leaf): visible (NOT hidden — this is the contract change from
    // the pre-amendment unbounded swap), dimmed via CSS off `data-drill-pane`, and `inert` (no interaction
    // surface — ADR-0124 F2's clone shape)
    expect(root.hasAttribute('hidden')).toBe(false)
    expect(root.inert).toBe(true)
    expect(root.getAttribute('data-drill-pane')).toBe('ancestor')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect((onChange.mock.calls[0]![0] as CustomEvent<string[]>).detail).toEqual(['root', 'settings'])
    el.remove()
  })

  it('an off-path panel is hidden and carries no data-drill-pane', async () => {
    const el = makeTree()
    await click(el.querySelector('[data-drill-key="settings"]')!)
    const appearance = el.querySelector('[key="appearance"]') as UIDrillPanelElement
    expect(appearance.hasAttribute('hidden')).toBe(true)
    expect(appearance.hasAttribute('data-drill-pane')).toBe(false)
    el.remove()
  })

  it('a 3-level path paints EVERY ancestor (root + settings), all inert, only the leaf active', async () => {
    const el = makeTree()
    await click(el.querySelector('[data-drill-key="settings"]')!)
    await click(el.querySelector('[key="settings"] [data-drill-key="appearance"]')!)
    expect(el.effectivePath).toEqual(['root', 'settings', 'appearance'])
    const root = el.querySelector('[key="root"]') as UIDrillPanelElement
    const settings = el.querySelector('[key="settings"]') as UIDrillPanelElement
    const appearance = el.querySelector('[key="appearance"]') as UIDrillPanelElement
    for (const ancestor of [root, settings]) {
      expect(ancestor.hasAttribute('hidden')).toBe(false)
      expect(ancestor.inert).toBe(true)
      expect(ancestor.getAttribute('data-drill-pane')).toBe('ancestor')
    }
    expect(appearance.hasAttribute('hidden')).toBe(false)
    expect(appearance.inert).toBe(false)
    expect(appearance.getAttribute('data-drill-pane')).toBe('active')
    // cl.A1's "z-ordered by PATH order" (component-checker MINOR, 2026-08-20): z-index must follow
    // resolvedPath's own index, not DOM/sibling order — root(0) < settings(1) < appearance(2), the
    // active leaf always highest regardless of where its markup sits among the author's siblings.
    expect(Number(root.style.zIndex)).toBe(1)
    expect(Number(settings.style.zIndex)).toBe(2)
    expect(Number(appearance.style.zIndex)).toBe(3)
    el.remove()
  })

  it('drilling into a HIDDEN (off-path) panel\'s trigger does nothing (only the active panel\'s triggers fire)', async () => {
    const el = makeTree()
    // the "appearance" trigger lives inside the "settings" panel, which is not yet active
    const appearanceTrigger = el.querySelector('[key="settings"] [data-drill-key="appearance"]')
    await click(appearanceTrigger!)
    expect(el.effectivePath).toEqual(['root'])
    el.remove()
  })

  it('an INERT ANCESTOR\'s own drill-trigger does nothing, even dispatched directly (cl.A1/A6 — no interaction surface)', async () => {
    const el = makeTree()
    await click(el.querySelector('[data-drill-key="settings"]')!) // root is now a painted, inert ancestor
    const rootTrigger = el.querySelector('[key="root"] [data-drill-key="settings"]')!
    await click(rootTrigger) // the SAME trigger the first click used — now living inside an inert ancestor
    expect(el.effectivePath).toEqual(['root', 'settings']) // unchanged — the inert ancestor's trigger is dead
    el.remove()
  })

  it('a nested INNER ui-drill\'s own trigger click never gets attributed to the OUTER drill (GH #1529)', async () => {
    // Outer: root -> settings -> appearance (makeTree's own shape). Drill the outer forward to "settings"
    // first so the inert-ancestor guard (cl.A1/A6) is not what's suppressing the click — the inner drill
    // lives inside the outer's now-ACTIVE "settings" pane, exactly the "inner ui-drill nested inside an
    // outer drill's panel content" shape the bug report names.
    const outer = makeTree()
    // `emit()` (element.ts) dispatches `bubbles: true, composed: true` — BY DESIGN, so a consumer can
    // delegate-listen higher up the tree. That means the INNER drill's own (correct) `change` event will
    // ALSO reach a `change` listener on the OUTER host, purely via ordinary DOM bubbling — orthogonal to
    // GH #1529 and not itself a bug. The regression this test targets is the OUTER's own `#onTriggerClick`
    // MISATTRIBUTING the click and calling ITS OWN `#commit` — so only `event.target === outer` counts as
    // an outer-OWNED commit; a bubbled descendant event must be filtered out, never conflated with it.
    const outerOwnChanges: string[][] = []
    outer.addEventListener('change', (event) => {
      if (event.target === outer) outerOwnChanges.push((event as CustomEvent<string[]>).detail)
    })
    await click(outer.querySelector('[data-drill-key="settings"]')!)
    expect(outer.effectivePath).toEqual(['root', 'settings'])
    expect(outerOwnChanges).toEqual([['root', 'settings']])

    // A second, independent drill nested inside the outer's active "settings" panel — its own 2-level tree.
    const outerSettings = outer.querySelector('[key="settings"]') as UIDrillPanelElement
    const inner = new ProbeDrill()
    const innerRoot = panel('inner-root', { heading: 'Inner Root' })
    innerRoot.append(trigger('inner-leaf'))
    const innerLeaf = panel('inner-leaf', { parent: 'inner-root', heading: 'Inner Leaf' })
    inner.append(innerRoot, innerLeaf)
    outerSettings.append(inner)
    await whenFlushed()
    expect(inner.effectivePath).toEqual(['inner-root'])

    // A click on the INNER drill's own trigger bubbles through BOTH hosts' delegated `click` listeners (the
    // inner one first, then the outer). Pre-fix, the outer's `#onTriggerClick` used a bare tag-based
    // `trigger.closest('ui-drill-panel')`, which resolved the INNER panel (the nearest match) and treated it
    // as its own live panel — misattributing the click and appending the inner trigger's key onto the OUTER
    // drill's own path (a SECOND entry would land in `outerOwnChanges`, with `event.target === outer`).
    const innerChange = vi.fn()
    inner.addEventListener('change', innerChange)
    await click(inner.querySelector('[data-drill-key="inner-leaf"]')!)

    // the INNER drill drilled forward, exactly as its own trigger names
    expect(innerChange).toHaveBeenCalledTimes(1)
    expect(inner.effectivePath).toEqual(['inner-root', 'inner-leaf'])
    // the OUTER drill's own path/state is COMPLETELY untouched by the inner drill's own click — no
    // second outer-OWNED `change` event, no path corruption
    expect(outerOwnChanges).toEqual([['root', 'settings']])
    expect(outer.effectivePath).toEqual(['root', 'settings'])

    outer.remove()
  })

  it('a nested INNER ui-drill\'s own NON-NATIVE (keyboard-activated) trigger never gets attributed to the OUTER drill\'s #onKeydown routing either (component-checker B4 asymmetry fix)', async () => {
    // The click-routing test above proves #onTriggerClick; #onKeydown had the identical bare tag-based
    // `trigger.closest('ui-drill-panel')` and was only INCIDENTALLY safe for a NATIVE <button> trigger (its
    // own `pressActivation` preventDefault()s the keydown before this listener would ever see it, and
    // #onKeydown's own `event.defaultPrevented` guard absorbs that) — a non-native trigger (a plain
    // `[tabindex]` row, drill.md's own documented shape for a non-button drill-trigger) gets no such free
    // ride, so this proves the SAME `#owningPanel` fix now applies there too.
    const outer = makeTree()
    const outerOwnChanges: string[][] = []
    outer.addEventListener('change', (event) => {
      if (event.target === outer) outerOwnChanges.push((event as CustomEvent<string[]>).detail)
    })
    await click(outer.querySelector('[data-drill-key="settings"]')!)
    expect(outerOwnChanges).toEqual([['root', 'settings']])

    const outerSettings = outer.querySelector('[key="settings"]') as UIDrillPanelElement
    const inner = new ProbeDrill()
    const innerRoot = panel('inner-root', { heading: 'Inner Root' })
    const nonNativeTrigger = document.createElement('div')
    nonNativeTrigger.tabIndex = 0
    nonNativeTrigger.setAttribute('data-role', 'drill-trigger')
    nonNativeTrigger.setAttribute('data-drill-key', 'inner-leaf')
    innerRoot.append(nonNativeTrigger)
    const innerLeaf = panel('inner-leaf', { parent: 'inner-root', heading: 'Inner Leaf' })
    inner.append(innerRoot, innerLeaf)
    outerSettings.append(inner)
    await whenFlushed()

    const innerChange = vi.fn()
    inner.addEventListener('change', innerChange)
    nonNativeTrigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await whenFlushed()

    // the INNER drill's own #onKeydown drilled forward, exactly as its own trigger names
    expect(innerChange).toHaveBeenCalledTimes(1)
    expect(inner.effectivePath).toEqual(['inner-root', 'inner-leaf'])
    // the OUTER drill's own state is untouched — no misattributed commit from its own #onKeydown
    expect(outerOwnChanges).toEqual([['root', 'settings']])
    expect(outer.effectivePath).toEqual(['root', 'settings'])

    outer.remove()
  })

  it('#owningPanel also fences the RESOLVED PANEL\'s own ownership, not just the trigger\'s (component-checker B4 residual-hole fix)', async () => {
    // A malformed but unpoliced shape: a drill-trigger authored DIRECTLY under a drill host (never wrapped in
    // one of THAT drill's own `ui-drill-panel` children), with that drill itself nested inside a GRANDPARENT
    // drill's own (non-inert, active) panel. Guarding only on the TRIGGER's owning drill (the first half of
    // `#owningPanel`) is not enough here: `node.closest('ui-drill-panel')` from the stray trigger walks PAST
    // the middle drill entirely (it wraps no panel of its own around this trigger) and lands on the
    // GRANDPARENT's own active panel — which the middle drill would otherwise treat as its own live panel.
    const grandparent = new ProbeDrill()
    const gRoot = panel('g-root', { heading: 'G Root' })
    grandparent.append(gRoot)
    document.body.append(grandparent)

    const middle = new ProbeDrill()
    const mRoot = panel('m-root', { heading: 'M Root' })
    middle.append(mRoot)
    // the stray trigger: a direct child of `middle` itself, not inside `mRoot` (or any panel of `middle`'s own)
    const strayTrigger = trigger('bogus')
    middle.append(strayTrigger)
    gRoot.append(middle) // middle nests inside the grandparent's own root (active, non-inert) panel
    await whenFlushed()
    expect(middle.effectivePath).toEqual(['m-root'])

    const middleOwnChanges: string[][] = []
    middle.addEventListener('change', (event) => {
      if (event.target === middle) middleOwnChanges.push((event as CustomEvent<string[]>).detail)
    })
    const grandparentOwnChanges: string[][] = []
    grandparent.addEventListener('change', (event) => {
      if (event.target === grandparent) grandparentOwnChanges.push((event as CustomEvent<string[]>).detail)
    })

    await click(strayTrigger)

    // neither drill ever committed off the stray, unowned trigger
    expect(middleOwnChanges).toEqual([])
    expect(grandparentOwnChanges).toEqual([])
    expect(middle.effectivePath).toEqual(['m-root'])
    expect(grandparent.effectivePath).toEqual(['g-root'])

    grandparent.remove()
  })

  it('Back pops one level; a no-op at the root', async () => {
    const el = makeTree()
    await click(el.querySelector('[data-drill-key="settings"]')!)
    expect(el.effectivePath).toEqual(['root', 'settings'])
    await click(el.parts.back!)
    expect(el.effectivePath).toEqual(['root'])
    await click(el.parts.back!) // already at root — no-op, no throw
    expect(el.effectivePath).toEqual(['root'])
    el.remove()
  })

  it('Escape is a Back alias', async () => {
    const el = makeTree()
    await click(el.querySelector('[data-drill-key="settings"]')!)
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await whenFlushed()
    expect(el.effectivePath).toEqual(['root'])
    el.remove()
  })

  it('the back button is hidden at the root and visible one level deep, with a resolvable parent-heading label', async () => {
    const el = makeTree()
    expect(el.parts.back?.hidden).toBe(true)
    await click(el.querySelector('[data-drill-key="settings"]')!)
    expect(el.parts.back?.hidden).toBe(false)
    expect(el.parts.back?.getAttribute('aria-label')).toBe('Back to Root')
    el.remove()
  })

  it('the heading part mirrors the active panel\'s heading prop', async () => {
    const el = makeTree()
    expect(el.parts.heading?.textContent).toBe('Root')
    await click(el.querySelector('[data-drill-key="settings"]')!)
    expect(el.parts.heading?.textContent).toBe('Settings')
    el.remove()
  })
})

describe('UIDrillElement — controlled path (ADR-0102 prop-as-source-of-truth, the ui-split.sizes precedent)', () => {
  it('renders the controlled `path` and does NOT self-mutate on a drill-forward commit', async () => {
    const el = makeTree()
    el.path = ['root']
    await whenFlushed()
    expect(el.effectivePath).toEqual(['root'])
    const onChange = vi.fn()
    el.addEventListener('change', onChange)
    await click(el.querySelector('[data-drill-key="settings"]')!)
    // still renders the CONTROLLED value (unchanged) — the consumer never wrote it back
    expect(el.effectivePath).toEqual(['root'])
    expect((onChange.mock.calls[0]![0] as CustomEvent<string[]>).detail).toEqual(['root', 'settings'])
    // the consumer writes the proposed value back — now it renders
    el.path = ['root', 'settings']
    await whenFlushed()
    expect(el.effectivePath).toEqual(['root', 'settings'])
    el.remove()
  })

  it('a broken/unresolvable controlled path falls back to the last resolvable entry, never throws', async () => {
    const el = makeTree()
    el.path = ['root', 'ghost-key']
    await whenFlushed()
    expect(el.effectivePath).toEqual(['root'])
    el.remove()
  })

  it('an empty controlled path ([]) resolves to the root, same as unset', async () => {
    const el = makeTree()
    el.path = []
    await whenFlushed()
    expect(el.effectivePath).toEqual(['root'])
    el.remove()
  })
})

describe('UIDrillElement — focus priming', () => {
  it('does NOT steal focus on initial mount, but focuses the heading on a later path change', async () => {
    const el = makeTree()
    expect(document.activeElement).not.toBe(el.parts.heading)
    await click(el.querySelector('[data-drill-key="settings"]')!)
    expect(document.activeElement).toBe(el.parts.heading)
    el.remove()
  })
})

// ── ADR-0195 Amendment (GH #1510), S1's load-bearing invariant ────────────────────────────────────────────
// The N-level `path` API — append-only drill-forward, pop-one-level Back, the `change` event's `detail`
// shape, controlled/uncontrolled duality — is UNCHANGED by the contained/stack render mapping. Only WHICH
// panels paint (and how) moved; the position state machine (`#drillTo`/`#back`/`#commit`/`#resolve`) is the
// exact same byte-for-byte code as pre-amendment ADR-0195. This block re-proves the full 3-level round trip
// end to end as an explicit regression anchor.
describe('UIDrillElement — path API stays byte-unchanged (ADR-0195 cl.2, the S1 load-bearing invariant)', () => {
  it('a full 3-level forward/back round trip produces the exact same path + change-event shape as pre-amendment', async () => {
    const el = makeTree()
    const onChange = vi.fn()
    el.addEventListener('change', onChange)

    await click(el.querySelector('[data-drill-key="settings"]')!)
    expect(el.effectivePath).toEqual(['root', 'settings'])
    await click(el.querySelector('[key="settings"] [data-drill-key="appearance"]')!)
    expect(el.effectivePath).toEqual(['root', 'settings', 'appearance'])

    await click(el.parts.back!)
    expect(el.effectivePath).toEqual(['root', 'settings'])
    await click(el.parts.back!)
    expect(el.effectivePath).toEqual(['root'])

    expect(onChange).toHaveBeenCalledTimes(4)
    const details = onChange.mock.calls.map((c) => (c[0] as CustomEvent<string[]>).detail)
    expect(details).toEqual([
      ['root', 'settings'],
      ['root', 'settings', 'appearance'],
      ['root', 'settings'],
      ['root'],
    ])
    el.remove()
  })

  it('controlled mode: the consumer-owned write-back still drives a 3-level path exactly as before', async () => {
    const el = makeTree()
    el.path = ['root', 'settings', 'appearance']
    await whenFlushed()
    expect(el.effectivePath).toEqual(['root', 'settings', 'appearance'])
    const onChange = vi.fn()
    el.addEventListener('change', onChange)
    await click(el.parts.back!)
    // CONTROLLED — renders unchanged until the consumer writes back
    expect(el.effectivePath).toEqual(['root', 'settings', 'appearance'])
    expect((onChange.mock.calls[0]![0] as CustomEvent<string[]>).detail).toEqual(['root', 'settings'])
    el.path = ['root', 'settings']
    await whenFlushed()
    expect(el.effectivePath).toEqual(['root', 'settings'])
    el.remove()
  })
})

// ── ADR-0195 Amendment cl.A2 — layout/chrome: shipped now, defaults implemented, non-defaults inert ────────
describe('UIDrillElement — layout/chrome (ADR-0195 Amendment cl.A2, GH #1510)', () => {
  it('both default to their S1-implemented value; a JS-set value reflects to the attribute (the button-reflect precedent)', () => {
    const el = makeTree()
    expect(el.layout).toBe('stack')
    expect(el.chrome).toBe('backbar')
    el.layout = 'stack' // an explicit set (even to the same value) goes through the reflecting setter
    el.chrome = 'backbar'
    expect(el.getAttribute('layout')).toBe('stack')
    expect(el.getAttribute('chrome')).toBe('backbar')
    el.remove()
  })

  it('a non-default value is accepted (no throw) and reflects, but S1 still renders the stack/backbar mapping', async () => {
    const el = makeTree()
    el.layout = 'columns'
    el.chrome = 'crumbs'
    await whenFlushed()
    expect(el.getAttribute('layout')).toBe('columns')
    expect(el.getAttribute('chrome')).toBe('crumbs')
    // S2/S3 not implemented yet — the render mapping is unaffected (still painted-path stack + backbar header)
    expect(el.querySelector(':scope > [data-part="header"] > [data-part="back"]')).not.toBeNull()
    expect(el.effectivePath).toEqual(['root'])
    el.remove()
  })
})

// ── ADR-0195 Amendment S2 slice (GH #1510) — chrome="crumbs": the breadcrumb trail ─────────────────────────
describe('UIDrillElement — chrome="crumbs" (ADR-0195 Amendment cl.A2/A3/A6, S2)', () => {
  it('at the root (depth 1): no ancestor crumb buttons, the heading is the trail\'s sole entry, aria-current="location"', async () => {
    const el = makeTree()
    el.chrome = 'crumbs'
    await whenFlushed()
    expect(el.parts.back?.hidden).toBe(true)
    expect(el.parts.crumbsNav?.hidden).toBe(false)
    expect(el.parts.crumbsNav?.querySelectorAll('[data-part="crumb"]')).toHaveLength(0)
    expect(el.parts.crumbsNav?.contains(el.parts.heading!)).toBe(true)
    expect(el.parts.heading?.getAttribute('aria-current')).toBe('location')
    el.remove()
  })

  it('one level deep: exactly one ancestor crumb button (root), labelled by its heading, no aria-current of its own', async () => {
    const el = makeTree()
    el.chrome = 'crumbs'
    await click(el.querySelector('[data-drill-key="settings"]')!)
    const crumbs = [...el.parts.crumbsNav!.querySelectorAll('[data-part="crumb"]')]
    expect(crumbs).toHaveLength(1)
    expect(crumbs[0]!.textContent).toBe('Root')
    expect(crumbs[0]!.hasAttribute('aria-current')).toBe(false)
    expect(crumbs[0]!.tagName).toBe('BUTTON')
    // the leaf (heading) is last in the trail, carrying aria-current — the value is "location" (ADR-0195
    // Amendment cl.A6, Forks ruled ③ — NOT "page": a drill level is a UI position, not a page)
    expect(el.parts.heading?.getAttribute('aria-current')).toBe('location')
    expect(el.parts.heading?.textContent).toBe('Settings')
    el.remove()
  })

  it('two levels deep: TWO ancestor crumbs (root, settings), z-ordered path order, neither carrying aria-current', async () => {
    const el = makeTree()
    el.chrome = 'crumbs'
    await click(el.querySelector('[data-drill-key="settings"]')!)
    await click(el.querySelector('[key="settings"] [data-drill-key="appearance"]')!)
    const crumbs = [...el.parts.crumbsNav!.querySelectorAll('[data-part="crumb"]')]
    expect(crumbs.map((c) => c.textContent)).toEqual(['Root', 'Settings'])
    for (const crumb of crumbs) expect(crumb.hasAttribute('aria-current')).toBe(false)
    expect(el.parts.heading?.textContent).toBe('Appearance')
    expect(el.parts.heading?.getAttribute('aria-current')).toBe('location')
    el.remove()
  })

  it('clicking an ancestor crumb navigates: truncates path to that ancestor (direction back), fires ONE change', async () => {
    const el = makeTree()
    el.chrome = 'crumbs'
    await click(el.querySelector('[data-drill-key="settings"]')!)
    await click(el.querySelector('[key="settings"] [data-drill-key="appearance"]')!)
    expect(el.effectivePath).toEqual(['root', 'settings', 'appearance'])
    const onChange = vi.fn()
    el.addEventListener('change', onChange)
    const rootCrumb = el.parts.crumbsNav!.querySelector('[data-part="crumb"]') as HTMLButtonElement
    expect(rootCrumb.textContent).toBe('Root')
    await click(rootCrumb)
    expect(el.effectivePath).toEqual(['root']) // truncated to the clicked ancestor, same as the fleet Back shape
    expect(onChange).toHaveBeenCalledTimes(1)
    expect((onChange.mock.calls[0]![0] as CustomEvent<string[]>).detail).toEqual(['root'])
    el.remove()
  })

  it('clicking the MIDDLE crumb of a 3-level path truncates to exactly that ancestor (not the leaf, not the root)', async () => {
    const el = makeTree()
    el.chrome = 'crumbs'
    await click(el.querySelector('[data-drill-key="settings"]')!)
    await click(el.querySelector('[key="settings"] [data-drill-key="appearance"]')!)
    const crumbs = [...el.parts.crumbsNav!.querySelectorAll('[data-part="crumb"]')] as HTMLButtonElement[]
    await click(crumbs[1]!) // "Settings"
    expect(el.effectivePath).toEqual(['root', 'settings'])
    el.remove()
  })

  it('keyboard-reachable: crumb buttons are real <button>s in native Tab order (no bespoke keyboard wiring needed)', async () => {
    const el = makeTree()
    el.chrome = 'crumbs'
    await click(el.querySelector('[data-drill-key="settings"]')!)
    const rootCrumb = el.parts.crumbsNav!.querySelector('[data-part="crumb"]') as HTMLButtonElement
    expect(rootCrumb.tagName).toBe('BUTTON')
    expect(rootCrumb.hasAttribute('tabindex')).toBe(false) // native focusability, no explicit tabindex needed
    rootCrumb.focus()
    expect(document.activeElement).toBe(rootCrumb)
  })

  it('controlled mode: a crumb click EMITS the truncated path but does not self-mutate (ADR-0102 parity with Back)', async () => {
    const el = makeTree()
    el.chrome = 'crumbs'
    el.path = ['root', 'settings', 'appearance']
    await whenFlushed()
    const onChange = vi.fn()
    el.addEventListener('change', onChange)
    const rootCrumb = el.parts.crumbsNav!.querySelector('[data-part="crumb"]') as HTMLButtonElement
    await click(rootCrumb)
    expect(el.effectivePath).toEqual(['root', 'settings', 'appearance']) // unchanged — controlled, no write-back yet
    expect((onChange.mock.calls[0]![0] as CustomEvent<string[]>).detail).toEqual(['root'])
    el.path = ['root']
    await whenFlushed()
    expect(el.effectivePath).toEqual(['root'])
    el.remove()
  })

  it('switching chrome back to "backbar" restores the Back button + heading pair, clears aria-current and the crumbs nav', async () => {
    const el = makeTree()
    el.chrome = 'crumbs'
    await click(el.querySelector('[data-drill-key="settings"]')!)
    expect(el.parts.heading?.getAttribute('aria-current')).toBe('location')

    el.chrome = 'backbar'
    await whenFlushed()
    expect(el.parts.crumbsNav?.hidden).toBe(true)
    expect(el.parts.crumbsNav?.querySelectorAll('[data-part="crumb"]')).toHaveLength(0)
    expect(el.parts.heading?.getAttribute('aria-current')).toBeNull()
    expect(el.parts.back?.hidden).toBe(false) // one level deep — Back is visible again, S1's exact shape
    expect(el.parts.back?.getAttribute('aria-label')).toBe('Back to Root')
    el.remove()
  })

  it('an unchanged trail keeps the SAME crumb node identity across an unrelated re-render (component-checker MINOR fix — the trail rebuilds only when its own content actually changes)', async () => {
    const el = makeTree()
    el.chrome = 'crumbs'
    await click(el.querySelector('[data-drill-key="settings"]')!)
    const rootCrumb = el.parts.crumbsNav!.querySelector('[data-part="crumb"]') as HTMLButtonElement
    rootCrumb.setAttribute('data-test-marker', 'the-original') // a jsdom-safe identity tag —
    // `document.activeElement` is NOT a reliable removal signal in jsdom (it doesn't reliably null out on a
    // focused node's disconnection the way a real browser does), so this asserts DOM node IDENTITY directly.
    // an unrelated structural change (a new sibling panel appended) bumps #version and re-renders — the
    // trail's own path ('root','settings') hasn't changed, so #renderCrumbs must skip its rebuild rather
    // than replaceChildren() (which would silently drop the marker on a freshly-created button).
    const extraPanel = document.createElement('ui-drill-panel')
    extraPanel.setAttribute('key', 'extra')
    extraPanel.setAttribute('parent', 'root')
    extraPanel.setAttribute('heading', 'Extra')
    el.append(extraPanel)
    // MutationObserver callbacks run in their own microtask checkpoint, which can land AFTER a bare
    // `whenFlushed()` resolves — give the observer's queued callback a real turn before asking again.
    await new Promise<void>((resolve) => queueMicrotask(resolve))
    await whenFlushed()
    const rootCrumbAfter = el.parts.crumbsNav!.querySelector('[data-part="crumb"]') as HTMLButtonElement
    expect(rootCrumbAfter).toBe(rootCrumb) // same object reference — never rebuilt
    expect(rootCrumbAfter.getAttribute('data-test-marker')).toBe('the-original') // survives, proving it
    el.remove()
  })

  it('an INERT ancestor pane\'s own drill-trigger still cannot fire under chrome="crumbs" (cl.A1/A6 unchanged — chrome never affects PANEL painting)', async () => {
    const el = makeTree()
    el.chrome = 'crumbs'
    await click(el.querySelector('[data-drill-key="settings"]')!)
    const root = el.querySelector('[key="root"]') as UIDrillPanelElement
    expect(root.inert).toBe(true) // the stack layout's painted-ancestor rule is untouched by `chrome`
    el.remove()
  })
})

// ── ADR-0195 Amendment cl.A7 — VT pairing-law correction: name on the ACTIVE pane only ─────────────────────
describe('UIDrillElement — view-transition-name sits on the resolved-ACTIVE panel only (cl.A7)', () => {
  it('when viewTransitions is opted in, only the active panel carries the shared name; ancestors are cleared', async () => {
    const el = makeTree()
    el.viewTransitions = true
    await whenFlushed()
    const root = el.querySelector('[key="root"]') as UIDrillPanelElement
    expect(root.style.viewTransitionName).not.toBe('')

    await click(el.querySelector('[data-drill-key="settings"]')!)
    const settings = el.querySelector('[key="settings"]') as UIDrillPanelElement
    // the name MOVED to the new active pane (settings); the now-ancestor (root) is cleared — never both
    // carrying the identical name in one snapshot (the pairing law cl.A7 corrects for).
    expect(settings.style.viewTransitionName).not.toBe('')
    expect(root.style.viewTransitionName).toBe('')
    el.remove()
  })

  it('when viewTransitions is off (default), no panel ever carries a view-transition-name (byte-identical when off)', async () => {
    const el = makeTree()
    await click(el.querySelector('[data-drill-key="settings"]')!)
    const root = el.querySelector('[key="root"]') as UIDrillPanelElement
    const settings = el.querySelector('[key="settings"]') as UIDrillPanelElement
    expect(root.style.viewTransitionName).toBe('')
    expect(settings.style.viewTransitionName).toBe('')
    el.remove()
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  ADR-0195 Amendment S3 slice (GH #1510) — layout="columns" (Miller columns)
// ════════════════════════════════════════════════════════════════════════════════════════════════════
// jsdom has no `@container` support, so #effectiveLayout() always reads the WIDE arm here (its own comment,
// drill.ts) — every test below proves the COLUMNS render-mapping mechanics at that arm. The narrow-degrade
// itself is real-engine-only territory (drill.browser.test.ts's container-resize leg).

describe('UIDrillElement — #effectiveLayoutSeam resolves the render mapping (cl.A1/A8)', () => {
  it('defaults to "stack"; "columns" resolves to "columns" absent any stylesheet (jsdom = the WIDE arm)', () => {
    const el = makeTree()
    expect(el.effectiveLayout).toBe('stack')
    el.layout = 'columns'
    expect(el.effectiveLayout).toBe('columns')
    el.remove()
  })
})

describe('UIDrillElement — layout="columns" paints every panel side-by-side, all interactive (cl.A1)', () => {
  it('every panel in the resolved path is visible, NONE inert, data-drill-layout="columns" on the host', async () => {
    const el = makeTree()
    el.layout = 'columns'
    await click(el.querySelector('[data-drill-key="settings"]')!)
    await click(el.querySelector('[key="settings"] [data-drill-key="appearance"]')!)
    expect(el.getAttribute('data-drill-layout')).toBe('columns')
    const root = el.querySelector('[key="root"]') as UIDrillPanelElement
    const settings = el.querySelector('[key="settings"]') as UIDrillPanelElement
    const appearance = el.querySelector('[key="appearance"]') as UIDrillPanelElement
    for (const p of [root, settings, appearance]) {
      expect(p.hasAttribute('hidden')).toBe(false)
      expect(p.inert).toBe(false) // the whole point of columns — "all interactive", unlike stack's ancestors
    }
    expect(root.getAttribute('data-drill-pane')).toBe('ancestor')
    expect(settings.getAttribute('data-drill-pane')).toBe('ancestor')
    expect(appearance.getAttribute('data-drill-pane')).toBe('active')
    // side-by-side tracks in PATH order (cl.A4), not stack's shared same-cell z-index
    expect(root.style.gridColumn).toBe('1')
    expect(settings.style.gridColumn).toBe('2')
    expect(appearance.style.gridColumn).toBe('3')
    el.remove()
  })

  it('switching a resolved-stack instance to columns clears every z-index (columns needs none — no overlap)', async () => {
    const el = makeTree()
    await click(el.querySelector('[data-drill-key="settings"]')!)
    const root = el.querySelector('[key="root"]') as UIDrillPanelElement
    expect(root.style.zIndex).not.toBe('')
    el.layout = 'columns'
    await whenFlushed()
    expect(root.style.zIndex).toBe('')
    expect(root.style.gridColumn).toBe('1')
    el.remove()
  })
})

describe('UIDrillElement — columns commit generalization: a non-rightmost column truncates+re-navigates (cl.A1, reuses #commit)', () => {
  it('clicking an ANCESTOR column\'s own trigger to a DIFFERENT branch truncates at that panel, then appends — one change event', async () => {
    const el = makeBranchingTree()
    el.layout = 'columns'
    await click(el.querySelector('[data-drill-key="settings"]')!)
    await click(el.querySelector('[key="settings"] [data-drill-key="appearance"]')!)
    expect(el.effectivePath).toEqual(['root', 'settings', 'appearance'])
    const onChange = vi.fn()
    el.addEventListener('change', onChange)
    // root is now an ANCESTOR column (non-rightmost) but fully interactive under columns — its OWN
    // "notifications" trigger names a branch that shares nothing with the current leaf.
    await click(el.querySelector('[key="root"] [data-drill-key="notifications"]')!)
    expect(el.effectivePath).toEqual(['root', 'notifications']) // truncated at root, NOT appended to the full path
    expect(onChange).toHaveBeenCalledTimes(1)
    expect((onChange.mock.calls[0]![0] as CustomEvent<string[]>).detail).toEqual(['root', 'notifications'])
    el.remove()
  })

  it('clicking the MIDDLE column\'s own trigger to a SIBLING branch truncates to exactly that ancestor, then appends', async () => {
    const el = makeBranchingTree()
    el.layout = 'columns'
    await click(el.querySelector('[data-drill-key="settings"]')!)
    await click(el.querySelector('[key="settings"] [data-drill-key="appearance"]')!)
    expect(el.effectivePath).toEqual(['root', 'settings', 'appearance'])
    // "settings" is now the MIDDLE column (root/settings/appearance); its own "privacy" trigger (a SIBLING
    // of "appearance", never yet on the path) truncates at settings then appends — not the root, not a
    // no-op re-click of the already-active leaf.
    await click(el.querySelector('[key="settings"] [data-drill-key="privacy"]')!)
    expect(el.effectivePath).toEqual(['root', 'settings', 'privacy'])
    el.remove()
  })

  it('clicking the ACTIVE (rightmost) column\'s own trigger degenerates to a plain append, same as stack', async () => {
    const el = makeBranchingTree()
    el.layout = 'columns'
    await click(el.querySelector('[data-drill-key="settings"]')!)
    expect(el.effectivePath).toEqual(['root', 'settings'])
    await click(el.querySelector('[key="settings"] [data-drill-key="appearance"]')!)
    expect(el.effectivePath).toEqual(['root', 'settings', 'appearance'])
    el.remove()
  })

  it('an ancestor trigger that was BLOCKED under stack (inert) fires once switched to columns (contrast)', async () => {
    const el = makeBranchingTree()
    await click(el.querySelector('[data-drill-key="settings"]')!) // stack default — root is now inert
    await click(el.querySelector('[key="root"] [data-drill-key="notifications"]')!) // blocked, inert ancestor
    expect(el.effectivePath).toEqual(['root', 'settings']) // unchanged
    el.layout = 'columns'
    await whenFlushed()
    await click(el.querySelector('[key="root"] [data-drill-key="notifications"]')!) // now interactive
    expect(el.effectivePath).toEqual(['root', 'notifications'])
    el.remove()
  })
})

describe('UIDrillElement — columns active-row highlight: data-drill-active (cl.A6)', () => {
  it('the ancestor\'s own trigger naming the NEXT path entry carries data-drill-active; every other trigger does not', async () => {
    const el = makeBranchingTree()
    el.layout = 'columns'
    await click(el.querySelector('[data-drill-key="settings"]')!)
    await click(el.querySelector('[key="settings"] [data-drill-key="appearance"]')!)
    const rootSettingsTrigger = el.querySelector('[key="root"] [data-drill-key="settings"]')!
    const rootNotificationsTrigger = el.querySelector('[key="root"] [data-drill-key="notifications"]')!
    const settingsAppearanceTrigger = el.querySelector('[key="settings"] [data-drill-key="appearance"]')!
    expect(rootSettingsTrigger.hasAttribute('data-drill-active')).toBe(true)
    expect(rootNotificationsTrigger.hasAttribute('data-drill-active')).toBe(false)
    expect(settingsAppearanceTrigger.hasAttribute('data-drill-active')).toBe(true)
    el.remove()
  })

  it('clears the marker when the path changes to a different branch', async () => {
    const el = makeBranchingTree()
    el.layout = 'columns'
    await click(el.querySelector('[data-drill-key="settings"]')!)
    const rootSettingsTrigger = el.querySelector('[key="root"] [data-drill-key="settings"]')!
    expect(rootSettingsTrigger.hasAttribute('data-drill-active')).toBe(true)
    await click(el.querySelector('[key="root"] [data-drill-key="notifications"]')!)
    expect(rootSettingsTrigger.hasAttribute('data-drill-active')).toBe(false)
    const rootNotificationsTrigger = el.querySelector('[key="root"] [data-drill-key="notifications"]')!
    expect(rootNotificationsTrigger.hasAttribute('data-drill-active')).toBe(true)
    el.remove()
  })

  it('never sets the marker under the resolved "stack" mapping', async () => {
    const el = makeBranchingTree()
    await click(el.querySelector('[data-drill-key="settings"]')!)
    const rootSettingsTrigger = el.querySelector('[key="root"] [data-drill-key="settings"]')!
    expect(rootSettingsTrigger.hasAttribute('data-drill-active')).toBe(false)
    el.remove()
  })
})

describe('UIDrillElement — columns a11y labelling (cl.A6): active keeps aria-labelledby, ancestors get a plain internals.ariaLabel', () => {
  it('an ancestor column gets internals.ariaLabel = its own heading; the active column keeps NO ariaLabel of its own (it uses aria-labelledby instead)', async () => {
    const el = makeBranchingTree()
    el.layout = 'columns'
    await click(el.querySelector('[data-drill-key="settings"]')!)
    const root = el.querySelector('[key="root"]') as UIDrillPanelElement
    const settings = el.querySelector('[key="settings"]') as UIDrillPanelElement
    expect(ariaLabelOf(root)).toBe('Root')
    expect(ariaLabelOf(settings)).toBeNull() // the ACTIVE column — aria-labelledby (linkHeading), not ariaLabel
    el.remove()
  })

  it('switching back to stack clears the ancestor internals.ariaLabel (no stale name left behind)', async () => {
    const el = makeBranchingTree()
    el.layout = 'columns'
    await click(el.querySelector('[data-drill-key="settings"]')!)
    const root = el.querySelector('[key="root"]') as UIDrillPanelElement
    expect(ariaLabelOf(root)).toBe('Root')
    el.layout = 'stack'
    await whenFlushed()
    expect(ariaLabelOf(root)).toBeNull()
    el.remove()
  })
})

describe('UIDrillElement — columns scoped focus law (cl.A6, the one deliberate narrowing of cl.5)', () => {
  it('does NOT move focus to the heading on drill-forward under columns (contrast: stack DOES move it)', async () => {
    const el = makeTree()
    el.layout = 'columns'
    await click(el.querySelector('[data-drill-key="settings"]')!)
    expect(document.activeElement).not.toBe(el.parts.heading)
    el.remove()
  })

  it('stack (default) still moves focus to the heading — the contrast case, cl.5 unaffected outside columns', async () => {
    const el = makeTree()
    await click(el.querySelector('[data-drill-key="settings"]')!)
    expect(document.activeElement).toBe(el.parts.heading)
    el.remove()
  })
})

// ── S3's own load-bearing invariant re-anchor: #drillTo/#back/#commit/#resolve stay byte-unchanged ─────────
describe('UIDrillElement — columns never touches the byte-unchanged path API (ADR-0195 cl.2, re-anchored for S3)', () => {
  it('Back still pops exactly one level under columns, through the SAME untouched #back/#commit', async () => {
    const el = makeBranchingTree()
    el.layout = 'columns'
    await click(el.querySelector('[data-drill-key="settings"]')!)
    await click(el.querySelector('[key="settings"] [data-drill-key="appearance"]')!)
    expect(el.effectivePath).toEqual(['root', 'settings', 'appearance'])
    await click(el.parts.back!)
    expect(el.effectivePath).toEqual(['root', 'settings'])
    el.remove()
  })

  it('a controlled path under columns still only EMITS the proposed value, never self-mutates (ADR-0102 parity)', async () => {
    const el = makeBranchingTree()
    el.layout = 'columns'
    el.path = ['root', 'settings']
    await whenFlushed()
    const onChange = vi.fn()
    el.addEventListener('change', onChange)
    await click(el.querySelector('[key="root"] [data-drill-key="notifications"]')!)
    expect(el.effectivePath).toEqual(['root', 'settings']) // unchanged — controlled, no write-back yet
    expect((onChange.mock.calls[0]![0] as CustomEvent<string[]>).detail).toEqual(['root', 'notifications'])
    el.path = ['root', 'notifications']
    await whenFlushed()
    expect(el.effectivePath).toEqual(['root', 'notifications'])
    el.remove()
  })
})
