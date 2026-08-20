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
  get parts(): { back: HTMLButtonElement | null; heading: HTMLHeadingElement | null } {
    return this.headerPartsSeam
  }
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-drill-probe', ProbeDrill)

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
