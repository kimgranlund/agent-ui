import { describe, it, expect, beforeAll } from 'vitest'
import { UIIconElement } from './icon.ts'
import { ICON_NAMES, iconRegistry, type IconName, type IconPack } from '@agent-ui/icons'

// LLD-C5 (icon-adapter.lld.md) — UIIconElement (Display-class leaf; glyph/label props; two connected()
// effects; void render; self-define). A deterministic in-file IconPack is registered + activated so the
// svg-injection assertions don't depend on whether the Phosphor subpath happened to self-register
// elsewhere in the same test run (ADR-0065/0066 — pack registration is app-owned, not implicit).

const bodies = Object.fromEntries(ICON_NAMES.map((n) => [n, `<path data-icon="${n}"/>`])) as Record<IconName, string>
const TEST_PACK: IconPack = { id: 'ui-icon-test-pack', viewBox: '0 0 16 16', icons: bodies }

beforeAll(() => {
  iconRegistry.registerPack(TEST_PACK)
  iconRegistry.setActivePack(TEST_PACK.id)
})

// A throwaway subclass re-exposing the protected `internals`, so a probe can read role/ariaLabel/ariaHidden
// set via ElementInternals (the FACE pattern — never a host attribute).
class ProbeIcon extends UIIconElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-icon-probe', ProbeIcon)

describe('UIIconElement — upgrade + typed props', () => {
  it('upgrades to the class; glyph and label default to empty string', () => {
    const el = document.createElement('ui-icon') as UIIconElement
    expect(el).toBeInstanceOf(UIIconElement)
    expect(el.glyph).toBe('')
    expect(el.label).toBe('')
  })

  it('self-defines as ui-icon, guarded against double-define', () => {
    expect(customElements.get('ui-icon')).toBe(UIIconElement)
    expect(() => {
      if (!customElements.get('ui-icon')) customElements.define('ui-icon', UIIconElement)
    }).not.toThrow()
  })
})

describe('UIIconElement — glyph-driven svg injection (LLD-C5)', () => {
  it('a set glyph resolves + injects the pack svg synchronously on connect', () => {
    const el = new ProbeIcon()
    el.glyph = 'caret-down'
    document.body.append(el)
    const svg = el.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('fill')).toBe('currentColor')
    expect(el.querySelector('path')?.getAttribute('data-icon')).toBe('caret-down')
    el.remove()
  })

  it('an empty glyph renders nothing (no svg child)', () => {
    const el = new ProbeIcon()
    document.body.append(el)
    expect(el.querySelector('svg')).toBeNull()
    expect(el.childElementCount).toBe(0)
    el.remove()
  })

  it('changing glyph re-resolves to the new icon (reactive effect)', async () => {
    const el = new ProbeIcon()
    el.glyph = 'x'
    document.body.append(el)
    expect(el.querySelector('path')?.getAttribute('data-icon')).toBe('x')

    el.glyph = 'eye'
    await el.updateComplete
    expect(el.querySelector('path')?.getAttribute('data-icon')).toBe('eye')
    el.remove()
  })

  it('clearing glyph back to empty removes the injected svg (reactive)', async () => {
    const el = new ProbeIcon()
    el.glyph = 'check'
    document.body.append(el)
    expect(el.querySelector('svg')).not.toBeNull()

    el.glyph = ''
    await el.updateComplete
    expect(el.querySelector('svg')).toBeNull()
    el.remove()
  })

  it('an unregistered glyph resolves to a non-throwing data-icon-missing svg (resolve.ts contract)', () => {
    const el = new ProbeIcon()
    el.glyph = 'not-a-real-icon'
    expect(() => document.body.append(el)).not.toThrow()
    expect(el.querySelector('svg')?.getAttribute('data-icon-missing')).toBe('not-a-real-icon')
    el.remove()
  })
})

describe('UIIconElement — label-driven ARIA via internals (LLD-C5)', () => {
  it('default (label empty): decorative — no role/ariaLabel, ariaHidden="true"; NO host attribute', () => {
    const el = new ProbeIcon()
    document.body.append(el)
    expect(el.probeInternals.role).toBeNull()
    expect(el.probeInternals.ariaLabel).toBeNull()
    expect(el.probeInternals.ariaHidden).toBe('true')
    expect(el.getAttribute('role')).toBeNull()
    expect(el.hasAttribute('aria-hidden')).toBe(false) // ARIA via internals only — never a host attribute
    expect(el.hasAttribute('aria-label')).toBe(false)
    el.remove()
  })

  it('a non-empty label makes the icon meaningful: role=img + ariaLabel; ariaHidden CLEARED', () => {
    const el = new ProbeIcon()
    el.label = 'Hide password'
    document.body.append(el)
    expect(el.probeInternals.role).toBe('img')
    expect(el.probeInternals.ariaLabel).toBe('Hide password')
    expect(el.probeInternals.ariaHidden).toBeNull()
    el.remove()
  })

  it('label change is reactive both directions: set → clear → set again', async () => {
    const el = new ProbeIcon()
    document.body.append(el)
    expect(el.probeInternals.ariaHidden).toBe('true') // starts decorative

    el.label = 'Close'
    await el.updateComplete
    expect(el.probeInternals.role).toBe('img')
    expect(el.probeInternals.ariaLabel).toBe('Close')
    expect(el.probeInternals.ariaHidden).toBeNull()

    el.label = ''
    await el.updateComplete
    expect(el.probeInternals.role).toBeNull()
    expect(el.probeInternals.ariaLabel).toBeNull()
    expect(el.probeInternals.ariaHidden).toBe('true') // decorative again — the toggle-back this leaf must get right
    el.remove()
  })
})

describe('UIIconElement — zero residue across connect/disconnect', () => {
  it('both effects die on disconnect; reconnect re-installs exactly once (not stacked)', async () => {
    const el = new ProbeIcon()
    el.glyph = 'check'
    el.label = 'Done'
    document.body.append(el)
    await el.updateComplete
    expect(el.querySelector('svg')).not.toBeNull()
    expect(el.probeInternals.role).toBe('img')

    el.remove() // disconnect → the connection scope is disposed → both effects die with it
    el.glyph = 'x' // mutate WHILE disconnected
    el.label = ''
    await el.updateComplete // give any leaked effect a chance to flush

    document.body.append(el) // reconnect → connected() re-runs → exactly one fresh pair of effects installs
    expect(el.querySelector('path')?.getAttribute('data-icon')).toBe('x') // re-applied from the now-current name
    expect(el.probeInternals.role).toBeNull() // re-applied from the now-current (empty) label
    expect(el.probeInternals.ariaHidden).toBe('true')
    el.remove()
  })
})

describe('UIIconElement — no light-DOM content model (the name effect OWNS the host children)', () => {
  it('unlike ui-text (void render), ui-icon actively manages its children: connecting with an empty name clears any pre-existing content', () => {
    // render() itself stays the inherited void no-op (no template) — but the name effect (LLD-C5) runs
    // `this.replaceChildren()` for an empty name, so a stray light-DOM child does NOT survive connect the
    // way it would on a true host-as-content leaf (ui-text). ui-icon's only legitimate child is the
    // control-injected <svg>; there is no author-slotted content model (icon.md `slots: []`).
    const el = new UIIconElement()
    el.innerHTML = '<span>stray</span>'
    document.body.append(el) // connect → the name effect runs synchronously → empty name → replaceChildren()
    expect(el.querySelector('span')).toBeNull()
    expect(el.childElementCount).toBe(0)
    el.remove()
  })
})
