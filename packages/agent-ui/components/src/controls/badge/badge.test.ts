import { describe, it, expect } from 'vitest'
import { UIBadgeElement } from './badge.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
  collectUsedStates,
  collectStyledSlots,
  scalarSeq,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// badge.test.ts — jsdom probes for ui-badge (report-family.lld.md LLD-C7; SPEC-R11…R13; ADR-0111 cl.1-5,
// fork F3; ADR-0057). Non-interactive display leaf: no focus/keyboard/events, no internals ARIA at all —
// so this suite covers DOM shape, the label mirror, intent reflection + BOTH hardening paths (attribute
// codec snap vs. the property-write self-correcting effect), zero residue, and the three-layer descriptor
// trip-wire (structural / contract↔props / contract↔source — the stat.md/sparkline.md pattern).
// Geometry/AA/WHCM/RTL are proven in badge.browser.test.ts (SPEC-N2 — jsdom cannot paint).

function make(): UIBadgeElement {
  return new UIBadgeElement()
}

describe('UIBadgeElement — upgrade + typed props', () => {
  it('upgrades to the class; props default to label="", intent="neutral"', () => {
    const el = document.createElement('ui-badge') as UIBadgeElement
    expect(el).toBeInstanceOf(UIBadgeElement)
    expect(el.label).toBe('')
    expect(el.intent).toBe('neutral')
  })

  it('intent is a literal union — compile-time narrowing (negative control)', () => {
    const fn = (): void => {
      const el = new UIBadgeElement()
      el.intent = 'info'
      el.intent = 'danger'
      // @ts-expect-error — 'critical' is not an intent member
      el.intent = 'critical'
      // @ts-expect-error — a bare string is wider than the union
      el.intent = 'x' as string
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors are the assertion
  })

  it('self-defines as ui-badge, guarded against double-define', () => {
    expect(customElements.get('ui-badge')).toBe(UIBadgeElement)
    expect(() => {
      if (!customElements.get('ui-badge')) customElements.define('ui-badge', UIBadgeElement)
    }).not.toThrow()
  })
})

describe('UIBadgeElement — DOM shape (LLD-C7)', () => {
  it('connect builds exactly a glyph span + a label span, once', () => {
    const el = make()
    document.body.append(el)
    expect(el.children.length).toBe(2)
    const glyph = el.children[0] as HTMLElement
    const label = el.children[1] as HTMLElement
    expect(glyph.dataset.part).toBe('glyph')
    expect(glyph.getAttribute('aria-hidden')).toBe('true')
    expect(label.dataset.part).toBe('label')
    el.remove()
  })

  it('the glyph + label nodes are NEVER replaced across a label/intent change (identity holds)', async () => {
    const el = make()
    document.body.append(el)
    const glyph = el.children[0]
    const label = el.children[1]
    el.label = 'first'
    el.intent = 'danger'
    await el.updateComplete
    el.label = 'second'
    el.intent = 'success'
    await el.updateComplete
    expect(el.children[0]).toBe(glyph)
    expect(el.children[1]).toBe(label)
    expect(el.children.length).toBe(2)
    el.remove()
  })

  it('the label span textContent mirrors the label prop, reactively', async () => {
    const el = make()
    document.body.append(el)
    expect((el.children[1] as HTMLElement).textContent).toBe('')
    el.label = '3 failing'
    await el.updateComplete
    expect((el.children[1] as HTMLElement).textContent).toBe('3 failing')
    el.remove()
  })
})

describe('UIBadgeElement — intent reflection (SPEC-R11)', () => {
  it('intent reflects JS-set values to the [intent] attribute (the CSS colour/glyph hook)', () => {
    const el = make()
    document.body.append(el)
    // The never-written DEFAULT is not auto-reflected (no setter call ever fires for it — the same
    // behaviour checkbox's `size`/`value` defaults show); neutral's CSS lives in the base :where() block
    // unconditionally, so an absent [intent] attribute is still correct for the default.
    expect(el.hasAttribute('intent')).toBe(false)
    for (const v of ['info', 'success', 'warning', 'danger', 'neutral'] as const) {
      el.intent = v
      expect(el.getAttribute('intent')).toBe(v)
    }
    el.remove()
  })

  it('an attribute round-trip (setAttribute) sets the property', () => {
    const el = make()
    document.body.append(el)
    el.setAttribute('intent', 'warning')
    expect(el.intent).toBe('warning')
    el.remove()
  })
})

describe('UIBadgeElement — bound-garbage hardening (SPEC-R11 AC2, ADR-0111 fork F3)', () => {
  it('ATTRIBUTE path: an unknown attribute value snaps to "neutral" synchronously (prop.enum codec)', () => {
    const el = make()
    document.body.append(el)
    el.setAttribute('intent', 'bogus')
    expect(el.intent).toBe('neutral') // the enumType codec's own snap — no effect flush needed
    expect(el.getAttribute('intent')).toBe('bogus') // the codec snaps the PROPERTY, not the raw attribute text itself
    el.remove()
  })

  it('PROPERTY path: a bound-garbage write snaps to "neutral" (the self-correcting connected() effect)', async () => {
    const el = make()
    document.body.append(el)
    ;(el as unknown as { intent: string }).intent = 'bogus' // simulates an untyped {path} bind resolving to garbage
    await el.updateComplete // the hardening effect is microtask-batched (checkbox ariaChecked precedent)
    expect(el.intent).toBe('neutral')
    expect(el.getAttribute('intent')).toBe('neutral') // AC2's second half — the reflected attribute agrees too
    el.remove()
  })

  it('PROPERTY path: a VALID value is never touched by the hardening effect (no false-positive snap)', async () => {
    const el = make()
    document.body.append(el)
    el.intent = 'danger'
    await el.updateComplete
    expect(el.intent).toBe('danger')
    el.remove()
  })
})

describe('UIBadgeElement — zero internals ARIA; the label IS the accessible name (SPEC-R12 AC3)', () => {
  it('no host role/aria-* attribute is ever minted', () => {
    const el = make()
    document.body.append(el)
    el.label = 'status'
    el.intent = 'success'
    expect(el.getAttribute('role')).toBeNull()
    for (const attr of Array.from(el.attributes)) expect(attr.name.startsWith('aria-')).toBe(false)
    el.remove()
  })

  it('internals.role is never set (unlike an ARIA-bearing FACE control)', () => {
    // UIBadgeElement never touches `this.internals` at all — re-expose it via a probe subclass to confirm.
    class ProbeBadge extends UIBadgeElement {
      get probeInternals(): ElementInternals {
        return (this as unknown as { internals: ElementInternals }).internals
      }
    }
    customElements.define('ui-badge-probe', ProbeBadge)
    const el = new ProbeBadge()
    document.body.append(el)
    expect(el.probeInternals.role).toBeNull()
    el.remove()
  })
})

describe('UIBadgeElement — zero residue across connect/disconnect', () => {
  it('reconnect keeps the SAME two spans — node identity, not just shape (TKT-0067 regression)', () => {
    // Tightened from a shape-only assertion (children.length === 2, which the old rebuild-every-connect
    // code also passed): the glyph/label must be the SAME node objects across an ordinary
    // disconnect/reconnect — the parts-once canon the in-file "neither node is ever replaced" comment
    // always claimed but the code didn't honor until TKT-0067.
    const el = make()
    document.body.append(el)
    expect(el.children.length).toBe(2)
    const glyph = el.querySelector('[data-part="glyph"]')
    const label = el.querySelector('[data-part="label"]')
    el.remove()
    document.body.append(el)
    expect(el.children.length).toBe(2)
    expect(el.querySelector('[data-part="glyph"]'), 'the glyph was re-minted on reconnect').toBe(glyph)
    expect(el.querySelector('[data-part="label"]'), 'the label was re-minted on reconnect').toBe(label)
    el.remove()
  })

  it('the hardening effect re-arms on reconnect (still snaps a stale bad value)', async () => {
    const el = make()
    document.body.append(el)
    el.remove()
    ;(el as unknown as { intent: string }).intent = 'bogus' // set while disconnected — no scope to run the effect
    document.body.append(el) // reconnect → connected() re-installs the effect, runs synchronously
    await el.updateComplete
    expect(el.intent).toBe('neutral')
    el.remove()
  })
})

// ── descriptor trip-wire (three-layer: structural / contract↔props / contract↔source) ──────────────

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/badge`
const md = readFileSync(`${DIR}/badge.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/badge.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/badge.css`, 'utf8') as string
const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['label', 'intent']

describe('badge.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-badge')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-badge, extends=UIElement, tier=display (SPEC-R11 AC3 site classification), face.formAssociated=false', () => {
    expect(/^tag:\s*ui-badge\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('badge.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with UIBadgeElement.props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIBadgeElement.props)).toEqual([])
  })

  it('negative control: a drifted reflect/default is caught', () => {
    const flipReflect = parsed.attributes.map((a) => (a.name === 'intent' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIBadgeElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.intent.reflect' }),
    )
    const flipDefault = parsed.attributes.map((a) => (a.name === 'label' ? { ...a, default: 'x' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIBadgeElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.label.default' }),
    )
  })

  it('negative control: a removed/extra attribute fails the bijection both ways', () => {
    const dropIntent = parsed.attributes.filter((a) => a.name !== 'intent')
    expect(compareDescriptorToProps(dropIntent, UIBadgeElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.intent' }),
    )
    const addBogus = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIBadgeElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })

  it('negative control: an enum values list containing a NON-member fails DRIFT_VALUES (a dropped-suffix list is the one documented asymmetry an opaque codec cannot see — a wrong member is what this probe catches)', () => {
    const flipValues = parsed.attributes.map((a) =>
      a.name === 'intent' ? { ...a, values: ['neutral', 'info', 'success', 'warning', 'critical'] } : a,
    )
    expect(compareDescriptorToProps(flipValues, UIBadgeElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_VALUES', path: 'attributes.intent.values' }),
    )
  })
})

describe('badge.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about badge.ts + badge.css (0 source-drift)', () => {
    // ui-badge has NO custom states (no :state() — non-interactive, nothing to transition) and NO
    // author-slotted content (no [slot=...] selector — glyph/label are both control-built spans).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real ui-badge code"
    const result = compareDescriptorToSource(parsed, { ts: syntheticTs, css })
    expect(result).toContainEqual(expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }))
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }))
  })
})
