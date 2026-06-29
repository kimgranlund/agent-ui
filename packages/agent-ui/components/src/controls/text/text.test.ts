import { describe, it, expect } from 'vitest'
import { UITextElement } from './text.ts'

// ADR-0025 / text.md — UITextElement (Display-class leaf; variant prop + heading role; void render;
// self-define). Four named probes: text-upgrades · text-variant-typed · text-heading-role ·
// text-void-render.

// A throwaway subclass re-exposing the protected `internals`, so a probe can read the role/ariaLevel
// set via ElementInternals (the FACE pattern — never a host attribute).
class ProbeText extends UITextElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-text-probe', ProbeText)

describe('UITextElement — define/upgrade + props (text-upgrades / text-variant-typed)', () => {
  it('text-upgrades: <ui-text> upgrades to UITextElement; variant defaults to body', () => {
    const el = document.createElement('ui-text') as UITextElement
    document.body.append(el)
    expect(el).toBeInstanceOf(UITextElement)
    expect(el.variant).toBe('body') // the prop signal holds the default
    // The attribute is NOT pre-reflected for the default (same as ui-button's variant default);
    // body is the default in the `:where(ui-text)` token block so no [variant=body] selector is needed.
    el.remove()
  })

  it('text-variant-typed: variant is a literal union, not a bare string (compile-time)', () => {
    const fn = (): void => {
      const el = new UITextElement()
      el.variant = 'h1'
      el.variant = 'h5'
      el.variant = 'caption'
      el.variant = 'body'
      // @ts-expect-error — 'xl' is not a variant member: proves the literal union, NOT string
      el.variant = 'xl'
      // @ts-expect-error — a bare string is wider than the union
      el.variant = 'x' as string
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors above are the assertion
  })

  it('text-variant-reflect: a JS-set variant reflects to the attribute (the CSS [variant] hook)', () => {
    const el = new UITextElement()
    document.body.append(el)
    el.variant = 'h3'
    expect(el.getAttribute('variant')).toBe('h3')
    el.variant = 'caption'
    expect(el.getAttribute('variant')).toBe('caption')
    el.remove()
  })

  it('text-self-define: registered as ui-text, guarded against double-define', () => {
    expect(customElements.get('ui-text')).toBe(UITextElement)
    expect(() => {
      if (!customElements.get('ui-text')) customElements.define('ui-text', UITextElement)
    }).not.toThrow() // the get() guard prevents a duplicate-registration throw
  })
})

describe('UITextElement — heading role/level via internals (text-heading-role)', () => {
  it('h1-h5: role=heading + ariaLevel 1-5 set via internals; NO host role/aria-* attribute', async () => {
    const cases: Array<[UITextElement['variant'], string]> = [
      ['h1', '1'],
      ['h2', '2'],
      ['h3', '3'],
      ['h4', '4'],
      ['h5', '5'],
    ]
    for (const [v, expectedLevel] of cases) {
      const el = new ProbeText()
      el.variant = v
      document.body.append(el)
      await el.updateComplete
      expect(el.probeInternals.role, `${v}: role`).toBe('heading')
      expect(el.probeInternals.ariaLevel, `${v}: ariaLevel`).toBe(expectedLevel)
      expect(el.getAttribute('role'), `${v}: no host role attr`).toBeNull()
      expect(el.hasAttribute('aria-level'), `${v}: no host aria-level attr`).toBe(false)
      el.remove()
    }
  })

  it('body/caption: role and ariaLevel cleared (generic styled text — no implicit role)', async () => {
    for (const v of ['body', 'caption'] as const) {
      const el = new ProbeText()
      document.body.append(el)
      // First set to a heading to confirm the effect actually clears it (not vacuously null from start)
      el.variant = 'h2'
      await el.updateComplete
      expect(el.probeInternals.role).toBe('heading') // pre-condition: heading was set

      el.variant = v
      await el.updateComplete
      expect(el.probeInternals.role, `${v}: role cleared`).toBeNull()
      expect(el.probeInternals.ariaLevel, `${v}: ariaLevel cleared`).toBeNull()
      el.remove()
    }
  })

  it('variant change h1→body clears role/ariaLevel reactively', async () => {
    const el = new ProbeText()
    document.body.append(el)
    el.variant = 'h1'
    await el.updateComplete
    expect(el.probeInternals.role).toBe('heading')
    expect(el.probeInternals.ariaLevel).toBe('1')

    el.variant = 'body'
    await el.updateComplete
    expect(el.probeInternals.role).toBeNull()
    expect(el.probeInternals.ariaLevel).toBeNull()
    el.remove()
  })

  it('text-heading-role: the default variant (body) starts with no role (generic text)', () => {
    const el = new ProbeText()
    document.body.append(el)
    // Default variant is body — the effect runs synchronously in connected(); role stays null
    expect(el.probeInternals.role).toBeNull()
    expect(el.probeInternals.ariaLevel).toBeNull()
    el.remove()
  })
})

describe('UITextElement — zero residue across connect/disconnect (C10)', () => {
  // The heading effect (text.ts connected() this.effect()) is the SOLE signal subscription; this probe
  // proves it dies on disconnect and does NOT leak — mirroring button.test.ts:175-193 (button-effects-residue).
  it('text-effects-residue: the heading effect dies on disconnect; reconnect re-installs exactly once', async () => {
    const el = new ProbeText()
    el.variant = 'h1'
    document.body.append(el) // connect → connected() installs the heading effect; variant=h1 → role=heading
    await el.updateComplete
    expect(el.probeInternals.role).toBe('heading') // heading effect live: role set to heading
    expect(el.probeInternals.ariaLevel).toBe('1')

    el.remove() // disconnect → the connection scope is disposed → the heading effect dies with it
    el.variant = 'body' // mutate the variant signal WHILE disconnected
    await el.updateComplete // give any leaked effect a chance to flush
    // A LEAKED effect would have re-run and cleared role + ariaLevel to null. The correct outcome is:
    // the effect is gone — the stale heading state remains unchanged (the scope is dead, no re-run).
    expect(el.probeInternals.role).toBe('heading') // NOT null — a leaked effect would have cleared it
    expect(el.probeInternals.ariaLevel).toBe('1') // NOT null — same: the effect is dead

    document.body.append(el) // reconnect → connected() re-runs → exactly ONE fresh effect installs (sync)
    // The fresh effect reads the NOW-CURRENT variant ('body') → clears both (body has no role)
    expect(el.probeInternals.role).toBeNull() // re-applied from the now-body signal — effect cleared it
    expect(el.probeInternals.ariaLevel).toBeNull() // cleared — not stacked from the old dead effect
    el.remove()
  })
})

describe('UITextElement — void render + slotted textContent (text-void-render)', () => {
  it("text-void-render: render() is void — the user's light-DOM children are NOT clobbered", () => {
    const el = new UITextElement()
    el.textContent = 'Hello world'
    document.body.append(el) // connect → render effect runs render() → void → no commit
    expect(el.textContent).toBe('Hello world')
    el.remove()
  })

  it('slotted child nodes survive connect + disconnect cycle (host-as-content, ADR-0006)', () => {
    const el = new UITextElement()
    el.innerHTML = '<span>Display text</span>'
    document.body.append(el)
    expect(el.querySelector('span')?.textContent).toBe('Display text')
    expect(el.childElementCount).toBe(1) // untouched
    el.remove()
  })
})
