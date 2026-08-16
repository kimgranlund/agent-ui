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

  it('drilling forward (a real click on a data-role="drill-trigger" element) self-mutates + shows the next panel', async () => {
    const el = makeTree()
    const onChange = vi.fn()
    el.addEventListener('change', onChange)
    await click(el.querySelector('[data-drill-key="settings"]')!)
    expect(el.effectivePath).toEqual(['root', 'settings'])
    expect(el.querySelector('[key="settings"]')?.hasAttribute('hidden')).toBe(false)
    expect(el.querySelector('[key="root"]')?.hasAttribute('hidden')).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect((onChange.mock.calls[0]![0] as CustomEvent<string[]>).detail).toEqual(['root', 'settings'])
    el.remove()
  })

  it('drilling into a HIDDEN (inactive) panel\'s trigger does nothing (only the active panel\'s triggers fire)', async () => {
    const el = makeTree()
    // the "appearance" trigger lives inside the "settings" panel, which is not yet active
    const appearanceTrigger = el.querySelector('[key="settings"] [data-drill-key="appearance"]')
    await click(appearanceTrigger!)
    expect(el.effectivePath).toEqual(['root'])
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
