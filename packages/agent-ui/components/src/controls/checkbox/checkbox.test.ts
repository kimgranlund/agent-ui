import { describe, it, expect } from 'vitest'
import { UICheckboxElement } from './checkbox.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
} from '../../descriptor/component-descriptor.ts'
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// S1 jsdom probes — ui-checkbox (decomp S1 · ADR-0042 · ADR-0041).
//
// jsdom reality (verified at the base, indicator-element.test.ts + form.test.ts): the ElementInternals
// form-association surface (setFormValue / setValidity) is ABSENT in jsdom and CustomStateSet is absent.
// The base tests cover the complete indicator behaviour through a minimal test leaf; this suite re-verifies
// the S1 contract at the leaf level (role='checkbox' · size prop · formValue round-trip · the descriptor
// trip-wire) — the jsdom probes the integration-host hands back evidence for before running the cross-engine
// browser smoke and the component-reviewer.

// ── jsdom stub — form-association surface (setFormValue/setValidity) is absent in jsdom ──────────

function stubFormAssoc(internals: ElementInternals): void {
  const i = internals as unknown as Record<string, unknown>
  if (typeof i['setFormValue'] !== 'function') {
    i['setFormValue'] = (): void => {}
    i['setValidity'] = (): void => {}
  }
}

// ── probe subclass — re-exposes the protected internals + formValue seams ──────────────────────

class ProbeCheckbox extends UICheckboxElement {
  /** Re-expose the protected `internals` so probes can read ariaChecked / role / states. */
  get probeInternals(): ElementInternals {
    return this.internals
  }
  /** Re-expose the protected formValue() for direct assertion (cast removes the `protected` guard). */
  formValueProbe(): string | null {
    return (this as unknown as { formValue(): string | null }).formValue.call(this)
  }
}
customElements.define('ui-checkbox-probe', ProbeCheckbox)

function make(): ProbeCheckbox {
  const el = new ProbeCheckbox()
  stubFormAssoc(el.probeInternals) // stub BEFORE connect — form effects run synchronously on connectedCallback
  return el
}

const key = (el: Element, type: 'keydown' | 'keyup', k: string): KeyboardEvent => {
  const event = new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true })
  el.dispatchEvent(event)
  return event
}

// ── upgrade + typed prop surface ──────────────────────────────────────────────────────────────────

describe('UICheckboxElement — upgrade + typed props', () => {
  it('upgrades to the class; props default to checked=false, value="on", size="md", disabled=false', () => {
    const el = document.createElement('ui-checkbox') as UICheckboxElement
    expect(el).toBeInstanceOf(UICheckboxElement)
    expect(el.checked).toBe(false)
    expect(el.value).toBe('on')
    expect(el.size).toBe('md')
    expect(el.disabled).toBe(false)
    expect(el.required).toBe(false)
    expect(el.indeterminate).toBe(false)
  })

  it('size is a literal union — compile-time narrowing (negative control)', () => {
    const fn = (): void => {
      const el = new UICheckboxElement()
      el.size = 'sm'
      el.size = 'lg'
      // @ts-expect-error — 'xl' is not a size member
      el.size = 'xl'
      // @ts-expect-error — a bare string is wider than the union
      el.size = 'x' as string
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors are the assertion
  })

  it('self-defines as ui-checkbox, guarded against double-define', () => {
    expect(customElements.get('ui-checkbox')).toBe(UICheckboxElement)
    expect(() => {
      if (!customElements.get('ui-checkbox')) customElements.define('ui-checkbox', UICheckboxElement)
    }).not.toThrow()
  })
})

// ── ARIA role (LLD-C2) ────────────────────────────────────────────────────────────────────────────

describe('UICheckboxElement — ARIA role (LLD-C2)', () => {
  it('internals.role is "checkbox"; no host role/aria-* attribute (FACE — ARIA via internals only)', () => {
    const el = make()
    document.body.append(el)
    expect(el.probeInternals.role).toBe('checkbox')
    expect(el.getAttribute('role')).toBeNull()
    for (const attr of Array.from(el.attributes)) expect(attr.name.startsWith('aria-')).toBe(false)
    el.remove()
  })
})

// ── checked / indeterminate round-trip (LLD-C1) ──────────────────────────────────────────────────

describe('UICheckboxElement — checked/indeterminate round-trip (LLD-C1)', () => {
  it('checked round-trips: false → true → false', () => {
    const el = make()
    document.body.append(el)
    expect(el.checked).toBe(false)
    el.checked = true
    expect(el.checked).toBe(true)
    el.checked = false
    expect(el.checked).toBe(false)
    el.remove()
  })

  it('indeterminate round-trips: false → true → false (property-only, never reflected)', () => {
    const el = make()
    document.body.append(el)
    expect(el.indeterminate).toBe(false)
    el.indeterminate = true
    expect(el.indeterminate).toBe(true)
    expect(el.hasAttribute('indeterminate')).toBe(false) // property-only, NOT a reflected attribute
    el.indeterminate = false
    expect(el.indeterminate).toBe(false)
    el.remove()
  })

  it('checked reflects to/from the attribute (boolean presence)', () => {
    const el = make()
    document.body.append(el)
    el.checked = true
    expect(el.getAttribute('checked')).toBe('') // boolean prop → empty-string presence
    el.checked = false
    expect(el.getAttribute('checked')).toBeNull()
    // attribute → prop round-trip
    el.setAttribute('checked', '')
    expect(el.checked).toBe(true)
    el.removeAttribute('checked')
    expect(el.checked).toBe(false)
    el.remove()
  })
})

// ── formValue() (LLD-C1) ─────────────────────────────────────────────────────────────────────────

describe('UICheckboxElement — formValue() (LLD-C1)', () => {
  it('unchecked → null (contributes no form entry; HTML checkbox semantics)', () => {
    const el = make()
    document.body.append(el)
    expect(el.formValueProbe()).toBeNull()
    el.remove()
  })

  it('checked → "on" (the default value prop string)', () => {
    const el = make()
    document.body.append(el)
    el.checked = true
    expect(el.formValueProbe()).toBe('on')
    el.remove()
  })

  it('checked + custom value → that value string', () => {
    const el = make()
    document.body.append(el)
    el.value = 'yes'
    el.checked = true
    expect(el.formValueProbe()).toBe('yes')
    el.remove()
  })

  it('indeterminate does NOT affect formValue (checked still drives it)', () => {
    const el = make()
    document.body.append(el)
    el.indeterminate = true
    el.checked = true
    expect(el.formValueProbe()).toBe('on') // checked=true → submits value despite indeterminate
    el.checked = false
    expect(el.formValueProbe()).toBeNull() // checked=false → null (indeterminate is display-only)
    el.remove()
  })
})

// ── ariaChecked (LLD-C2) ─────────────────────────────────────────────────────────────────────────

describe('UICheckboxElement — ariaChecked (LLD-C2)', () => {
  it('"false" on connect (unchecked + determinate; the state effect runs synchronously)', () => {
    const el = make()
    document.body.append(el)
    expect(el.probeInternals.ariaChecked).toBe('false')
    el.remove()
  })

  it('"true" when checked=true', async () => {
    const el = make()
    document.body.append(el)
    el.checked = true
    await el.updateComplete // effects are microtask-batched
    expect(el.probeInternals.ariaChecked).toBe('true')
    el.remove()
  })

  it('"false" when checked flips back to false', async () => {
    const el = make()
    document.body.append(el)
    el.checked = true
    await el.updateComplete
    el.checked = false
    await el.updateComplete
    expect(el.probeInternals.ariaChecked).toBe('false')
    el.remove()
  })

  it('"mixed" when indeterminate=true (overrides checked=false)', async () => {
    const el = make()
    document.body.append(el)
    el.indeterminate = true
    await el.updateComplete
    expect(el.probeInternals.ariaChecked).toBe('mixed')
    el.remove()
  })

  it('"mixed" when indeterminate=true even if checked=true (indeterminate wins)', async () => {
    const el = make()
    document.body.append(el)
    el.checked = true
    el.indeterminate = true
    await el.updateComplete
    expect(el.probeInternals.ariaChecked).toBe('mixed')
    el.remove()
  })
})

// ── :state(checked) / :state(indeterminate) (LLD-C2, capability-gated) ──────────────────────────

describe('UICheckboxElement — custom states (LLD-C2, capability-gated)', () => {
  it(':state(checked) present when checked; :state(indeterminate) when indeterminate', async () => {
    const el = make()
    document.body.append(el)
    el.checked = true
    await el.updateComplete
    if (el.probeInternals.states) {
      expect(el.probeInternals.states.has('checked')).toBe(true)
      expect(el.probeInternals.states.has('indeterminate')).toBe(false)
    }
    el.checked = false
    el.indeterminate = true
    await el.updateComplete
    if (el.probeInternals.states) {
      expect(el.probeInternals.states.has('checked')).toBe(false)
      expect(el.probeInternals.states.has('indeterminate')).toBe(true)
    }
    el.remove()
  })

  it(':state(checked) absent when unchecked + determinate', async () => {
    const el = make()
    document.body.append(el)
    await el.updateComplete
    if (el.probeInternals.states) {
      expect(el.probeInternals.states.has('checked')).toBe(false)
      expect(el.probeInternals.states.has('indeterminate')).toBe(false)
    }
    el.remove()
  })
})

// ── click/Space toggle + Enter blocked (LLD-C3) ──────────────────────────────────────────────────

describe('UICheckboxElement — toggle (click + Space; Enter blocked) (LLD-C3)', () => {
  it('click toggles checked false → true → false', () => {
    const el = make()
    document.body.append(el)
    expect(el.checked).toBe(false)
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.checked).toBe(true)
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.checked).toBe(false)
    el.remove()
  })

  it('Space keyup toggles checked (keydown does NOT)', () => {
    const el = make()
    document.body.append(el)
    key(el, 'keydown', ' ') // keydown alone does not activate
    expect(el.checked).toBe(false)
    key(el, 'keyup', ' ') // keyup activates (pressActivation trait)
    expect(el.checked).toBe(true)
    el.remove()
  })

  it('Enter does NOT toggle checked (platform checkbox parity — the guard suppresses the click)', () => {
    const el = make()
    document.body.append(el)
    expect(el.checked).toBe(false)
    key(el, 'keydown', 'Enter') // pressActivation fires host.click(), but the Enter-guard swallows it
    expect(el.checked).toBe(false)
    el.remove()
  })

  it('click emits input + change in order', () => {
    const el = make()
    document.body.append(el)
    const seen: string[] = []
    el.addEventListener('input', () => seen.push('input'))
    el.addEventListener('change', () => seen.push('change'))
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(seen).toEqual(['input', 'change'])
    el.remove()
  })

  it('Space keyup emits input + change', () => {
    const el = make()
    document.body.append(el)
    let inputCount = 0
    let changeCount = 0
    el.addEventListener('input', () => inputCount++)
    el.addEventListener('change', () => changeCount++)
    key(el, 'keydown', ' ')
    key(el, 'keyup', ' ')
    expect(inputCount).toBe(1)
    expect(changeCount).toBe(1)
    el.remove()
  })

  it('click on indeterminate clears indeterminate and toggles checked (platform parity)', () => {
    const el = make()
    document.body.append(el)
    el.indeterminate = true
    el.checked = false
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.indeterminate).toBe(false) // cleared first
    expect(el.checked).toBe(true) // then toggled
    el.remove()
  })
})

// ── disabled-inert (LLD-C3) ──────────────────────────────────────────────────────────────────────

describe('UICheckboxElement — disabled-inert (LLD-C3)', () => {
  it('disabled click does not toggle checked', () => {
    const el = make()
    document.body.append(el)
    el.disabled = true
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.checked).toBe(false)
    el.remove()
  })

  it('disabled Space does not toggle checked', () => {
    const el = make()
    document.body.append(el)
    el.disabled = true
    key(el, 'keydown', ' ')
    key(el, 'keyup', ' ')
    expect(el.checked).toBe(false)
    el.remove()
  })

  it('disabled removes the host from the tab order (async — tabbable effect is reactive)', async () => {
    const el = make()
    document.body.append(el)
    expect(el.getAttribute('tabindex')).toBe('0') // focusable by default
    el.disabled = true
    await el.updateComplete
    expect(el.hasAttribute('tabindex')).toBe(false) // out of tab order while disabled
    el.remove()
  })

  it('disabled reflects to a [disabled] attribute', () => {
    const el = make()
    document.body.append(el)
    el.disabled = true
    expect(el.hasAttribute('disabled')).toBe(true)
    el.disabled = false
    expect(el.hasAttribute('disabled')).toBe(false)
    el.remove()
  })
})

// ── size prop ────────────────────────────────────────────────────────────────────────────────────

describe('UICheckboxElement — size prop', () => {
  it('size reflects JS-set value to the attribute (the CSS [size] hook)', () => {
    const el = make()
    document.body.append(el)
    el.size = 'sm'
    expect(el.getAttribute('size')).toBe('sm')
    el.size = 'lg'
    expect(el.getAttribute('size')).toBe('lg')
    el.size = 'md'
    expect(el.getAttribute('size')).toBe('md')
    el.remove()
  })
})

// ── zero residue (connect / disconnect) ──────────────────────────────────────────────────────────

describe('UICheckboxElement — zero residue across connect/disconnect', () => {
  it('disconnect removes listeners; reconnect re-arms exactly once (not stacked)', () => {
    const el = make()
    document.body.append(el)
    key(el, 'keydown', ' ')
    key(el, 'keyup', ' ')
    expect(el.checked).toBe(true) // listener live while connected

    el.remove() // disconnect → ac.abort() removes all listeners
    el.checked = false // reset
    key(el, 'keydown', ' ')
    key(el, 'keyup', ' ')
    expect(el.checked).toBe(false) // listeners gone — no toggle

    document.body.append(el) // reconnect → connected() re-runs fresh AbortController
    key(el, 'keydown', ' ')
    key(el, 'keyup', ' ')
    expect(el.checked).toBe(true) // exactly one toggle — not a stacked double
    el.remove()
  })

  it('ARIA effect re-runs on reconnect with the current checked value', async () => {
    const el = make()
    el.checked = true
    document.body.append(el)
    expect(el.probeInternals.ariaChecked).toBe('true') // initial sync run

    el.remove()
    document.body.append(el) // reconnect → effect reinstalls + runs synchronously
    expect(el.probeInternals.ariaChecked).toBe('true') // re-applied from the live signal value
    el.remove()
  })
})

// ── descriptor trip-wire (contract↔props) ────────────────────────────────────────────────────────
//
// Two layers: (a) STRUCTURAL — validateComponentDescriptor reports ZERO failures.
//             (b) CONTRACT↔PROPS — compareDescriptorToProps finds ZERO drift with UICheckboxElement.props.

const CBX_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/checkbox`
const md = readFileSync(`${CBX_DIR}/checkbox.md`, 'utf8') as string
const { fence } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
// Attribute names in the order declared in checkbox.md frontmatter (used as anti-vacuous anchor).
const ATTR_NAMES = ['checked', 'value', 'size', 'name', 'disabled', 'required']

describe('checkbox.md descriptor — structural validity (s10 part a)', () => {
  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-checkbox, extends=UIIndicatorElement, tier=indicator, face.formAssociated=true', () => {
    expect(/^tag:\s*ui-checkbox\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIIndicatorElement\b/m.test(fence)).toBe(true) // the TRUE chain is UICheckboxElement → UIIndicatorElement → UIFormElement
    expect(/^tier:\s*indicator\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*true/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    // anti-vacuous: all 6 attributes parse before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('checkbox.md descriptor — contract↔props trip-wire (s10 part b)', () => {
  it('attributes[] is a faithful bijection with UICheckboxElement.props (0 drift)', () => {
    // anti-vacuous: all 6 attribute names parse before the trip-wire is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UICheckboxElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    const flipReflect = parsed.attributes.map((a) => (a.name === 'size' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UICheckboxElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.size.reflect' }),
    )
    const flipDefault = parsed.attributes.map((a) => (a.name === 'value' ? { ...a, default: 'off' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UICheckboxElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.value.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    const dropChecked = parsed.attributes.filter((a) => a.name !== 'checked')
    expect(compareDescriptorToProps(dropChecked, UICheckboxElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.checked' }),
    )
    const addBogus = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UICheckboxElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
