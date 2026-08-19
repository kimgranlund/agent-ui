import { describe, it, expect } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIMultiSelectElement } from './multi-select.ts'
import type { FormValue, ValidityResult } from '../../dom/index.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  type ParsedAttribute,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// M-F jsdom probes — ui-multi-select (multi-select-field.lld.md LLD-C1..C6 · multi-select-field.spec.md
// SPEC-R1..R8 · ADR-0175).
//
// jsdom reality: the `ElementInternals` form-association surface (setFormValue / setValidity) is absent
// in jsdom 29 — stub it per-instance BEFORE connect (the checkbox.test.ts / select.test.ts precedent).
// Form-value and validity are asserted via probe hooks that call the protected methods directly. The
// REAL whole-shape geometry + axe-core + keyboard-vs-pointer byte-identity proofs live in
// multi-select.browser.test.ts (Chromium + WebKit).
//
// Named probes: ms-upgrade · ms-typed · ms-define-guard · ms-value-default · ms-toggle-add ·
// ms-toggle-remove · ms-toggle-order · ms-modifiers-ignored · ms-select-event · ms-required-empty ·
// ms-required-cleared · ms-form-value · ms-form-value-multiple · ms-form-reset · ms-value-external-write ·
// ms-aria-listbox · ms-aria-multiselectable · ms-keyboard-space · ms-keyboard-enter · ms-disabled ·
// ms-dynamic-options · ms-c10-residue · ms-label-bare · ms-label-fielded · ms-descriptor-schema ·
// ms-descriptor-bijection · ms-descriptor-negative

// ── Form-association stub (jsdom lacks setFormValue / setValidity) ────────────────────────────────

function stubFormAssoc(internals: ElementInternals): void {
  const i = internals as unknown as Record<string, unknown>
  if (typeof i['setFormValue'] !== 'function') {
    i['setFormValue'] = (): void => {}
    i['setValidity'] = (): void => {}
  }
}

// ── Probe subclass ──────────────────────────────────────────────────────────────────────────────────

class ProbeMultiSelect extends UIMultiSelectElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
  formValueProbe(): FormValue {
    return (this as unknown as { formValue(): FormValue }).formValue.call(this)
  }
  formValidityProbe(): ValidityResult {
    return (this as unknown as { formValidity(): ValidityResult }).formValidity.call(this)
  }
  formResetProbe(): void {
    ;(this as unknown as { formReset(): void }).formReset.call(this)
  }
}
customElements.define('ui-multi-select-probe', ProbeMultiSelect)

// ── Helpers ─────────────────────────────────────────────────────────────────────────────────────────

const STD_OPTIONS = `
  <div role="option" value="apple">Apple</div>
  <div role="option" value="banana">Banana</div>
  <div role="option" value="cherry">Cherry</div>
`

function makeMultiSelect(innerHTML = STD_OPTIONS): { el: ProbeMultiSelect } {
  const el = new ProbeMultiSelect()
  el.innerHTML = innerHTML
  stubFormAssoc(el.probeInternals) // stub BEFORE connect — form effects run on connectedCallback
  document.body.append(el) // ← connect fires here
  return { el }
}

const getOption = (el: HTMLElement, value: string): HTMLElement =>
  el.querySelector<HTMLElement>(`[role="option"][value="${value}"]`)!

const click = (el: Element, mods?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }): void => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...mods }))
}

const keydown = (el: Element, key: string): void => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

// ── Upgrade + typed prop surface ───────────────────────────────────────────────────────────────────

describe('ui-multi-select — upgrade + typed prop surface (ms-upgrade)', () => {
  it('ms-upgrade: upgrades to UIMultiSelectElement with default prop values (no connect needed)', () => {
    const el = document.createElement('ui-multi-select') as UIMultiSelectElement
    expect(el).toBeInstanceOf(UIMultiSelectElement)
    expect(el.value).toEqual([])
    expect(el.label).toBe('')
    expect(el.size).toBe('md')
    expect(el.name).toBe('')
    expect(el.disabled).toBe(false)
    expect(el.required).toBe(false)
  })

  it('ms-typed: props have the correct types (compile-time NCs)', () => {
    const fn = (): void => {
      const el = new UIMultiSelectElement()
      el.value = ['a', 'b']
      el.label = 'Skills'
      el.size = 'sm'
      el.size = 'lg'
      el.name = 'skills'
      el.disabled = false
      el.required = true
      // @ts-expect-error — value is string[], not a bare string
      el.value = 'a'
      // @ts-expect-error — disabled is boolean, not number
      el.disabled = 1
      // @ts-expect-error — size is a literal union (sm/md/lg), not a bare string
      el.size = 'xl'
    }
    expect(typeof fn).toBe('function') // never invoked — the @ts-expect-error lines are the assertion
  })

  it('ms-define-guard: self-defines ui-multi-select, guarded against a double-define', () => {
    expect(customElements.get('ui-multi-select')).toBe(UIMultiSelectElement)
    expect(() => {
      if (!customElements.get('ui-multi-select')) customElements.define('ui-multi-select', UIMultiSelectElement)
    }).not.toThrow()
  })
})

// ── SPEC-R4 — value never null/undefined ───────────────────────────────────────────────────────────

describe('ui-multi-select — value defaults [] and is never null/undefined (ms-value-default)', () => {
  it('ms-value-default: a freshly connected, unconfigured control reads value === []', () => {
    const { el } = makeMultiSelect()
    expect(el.value).toEqual([])
    el.remove()
  })

  it('ms-value-default: a malformed value attribute falls back to [] (never throws)', () => {
    const el = new ProbeMultiSelect()
    el.setAttribute('value', 'not json{{{')
    el.innerHTML = STD_OPTIONS
    stubFormAssoc(el.probeInternals)
    expect(() => document.body.append(el)).not.toThrow()
    expect(el.value).toEqual([])
    el.remove()
  })

  it('ms-value-default: a declarative value attribute seeds the initial array', () => {
    const el = new ProbeMultiSelect()
    el.setAttribute('value', '["apple","cherry"]')
    el.innerHTML = STD_OPTIONS
    stubFormAssoc(el.probeInternals)
    document.body.append(el)
    expect(el.value).toEqual(['apple', 'cherry'])
    el.remove()
  })
})

// ── SPEC-R3 — commit granularity: toggle-on appends, toggle-off removes, exact array order ───────────

describe('ui-multi-select — toggle commits (ms-toggle-add · ms-toggle-remove · ms-toggle-order)', () => {
  it('ms-toggle-add: clicking an unselected option APPENDS its key to value, preserving existing order', async () => {
    const { el } = makeMultiSelect()
    click(getOption(el, 'apple'))
    await whenFlushed()
    expect(el.value).toEqual(['apple'])

    click(getOption(el, 'cherry'))
    await whenFlushed()
    expect(el.value).toEqual(['apple', 'cherry']) // existing preserved, new appended (SPEC-R3 AC1)
    el.remove()
  })

  it('ms-toggle-remove: clicking an already-selected option REMOVES it, one select commit', async () => {
    const { el } = makeMultiSelect()
    click(getOption(el, 'apple'))
    click(getOption(el, 'banana'))
    await whenFlushed()
    expect(el.value).toEqual(['apple', 'banana'])

    let selectCount = 0
    el.addEventListener('select', () => { selectCount++ })
    click(getOption(el, 'apple')) // toggle off
    await whenFlushed()
    expect(el.value).toEqual(['banana']) // SPEC-R3 AC2
    expect(selectCount).toBe(1) // exactly one commit, never a partial/delta payload
    el.remove()
  })

  it('ms-toggle-order: aria-selected reflects the toggled state on every option', async () => {
    const { el } = makeMultiSelect()
    click(getOption(el, 'apple'))
    click(getOption(el, 'cherry'))
    await whenFlushed()
    expect(getOption(el, 'apple').getAttribute('aria-selected')).toBe('true')
    expect(getOption(el, 'banana').getAttribute('aria-selected')).toBe('false')
    expect(getOption(el, 'cherry').getAttribute('aria-selected')).toBe('true')
    el.remove()
  })
})

describe('ui-multi-select — modifier keys are ignored (ms-modifiers-ignored, LLD-C4)', () => {
  it('ms-modifiers-ignored: Shift/Ctrl-click still just toggles the ONE clicked option — never range/replace', async () => {
    const { el } = makeMultiSelect()
    click(getOption(el, 'apple'))
    click(getOption(el, 'banana'))
    await whenFlushed()
    expect(el.value).toEqual(['apple', 'banana'])

    click(getOption(el, 'cherry'), { shiftKey: true })
    await whenFlushed()
    expect(el.value).toEqual(['apple', 'banana', 'cherry']) // toggled ON, not a range-replace

    click(getOption(el, 'apple'), { ctrlKey: true })
    await whenFlushed()
    expect(el.value).toEqual(['banana', 'cherry']) // toggled OFF, not a Ctrl-anchor move
    el.remove()
  })
})

describe('ui-multi-select — the select event (ms-select-event)', () => {
  it('ms-select-event: detail is the committed ReadonlySet<string>', async () => {
    const { el } = makeMultiSelect()
    let detail: unknown
    el.addEventListener('select', (e) => { detail = (e as CustomEvent).detail })
    click(getOption(el, 'apple'))
    await whenFlushed()
    expect(detail).toEqual(new Set(['apple']))
    el.remove()
  })
})

// ── SPEC-R6 — required/valueMissing ────────────────────────────────────────────────────────────────

describe('ui-multi-select — required validity (ms-required-empty · ms-required-cleared)', () => {
  it('ms-required-empty: required + [] → valueMissing', () => {
    const { el } = makeMultiSelect()
    el.required = true
    const result = el.formValidityProbe()
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.flags.valueMissing).toBe(true)
    el.remove()
  })

  it('ms-required-cleared: required + ≥1 selected → valid', async () => {
    const { el } = makeMultiSelect()
    el.required = true
    click(getOption(el, 'apple'))
    await whenFlushed()
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })

  it('ms-required-cleared: NOT required + [] → valid', () => {
    const { el } = makeMultiSelect()
    expect(el.required).toBe(false)
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })
})

// ── SPEC-R5 — FormData multiplicity + the bindable aggregate ──────────────────────────────────────

describe('ui-multi-select — form value (ms-form-value · ms-form-value-multiple · ms-form-reset)', () => {
  it('ms-form-value: formValue() returns an EMPTY FormData when nothing is selected', () => {
    const { el } = makeMultiSelect()
    const fd = el.formValueProbe()
    expect(fd).toBeInstanceOf(FormData)
    expect([...(fd as FormData).entries()]).toEqual([])
    el.remove()
  })

  it('ms-form-value-multiple: formValue() contributes MULTIPLE entries under `name`, one per selected value', async () => {
    const { el } = makeMultiSelect()
    el.name = 'tags'
    click(getOption(el, 'apple'))
    click(getOption(el, 'cherry'))
    await whenFlushed()

    const fd = el.formValueProbe() as FormData
    expect(fd.getAll('tags')).toEqual(['apple', 'cherry'])
    el.remove()
  })

  it('ms-form-value-multiple: a real <form> submission carries multiple entries (new FormData(form))', async () => {
    const form = document.createElement('form')
    const el = new ProbeMultiSelect()
    el.setAttribute('name', 'tags')
    el.innerHTML = STD_OPTIONS
    stubFormAssoc(el.probeInternals)
    form.append(el)
    document.body.append(form)
    click(getOption(el, 'apple'))
    click(getOption(el, 'banana'))
    await whenFlushed()

    // jsdom's real FormData(form) walk relies on the platform's own form-associated element protocol
    // (absent for a jsdom-stubbed internals) — assert via the SAME mechanism the base class publishes
    // through (formValue(), the single source `internals.setFormValue` is fed from) instead, the
    // select.test.ts precedent for probing form participation without the real platform surface.
    const fd = el.formValueProbe() as FormData
    expect(fd.getAll('tags')).toEqual(['apple', 'banana'])
    form.remove()
  })

  it('ms-form-reset: formReset() restores value to the array the value ATTRIBUTE held at connect time', async () => {
    const el = new ProbeMultiSelect()
    el.setAttribute('value', '["apple"]')
    el.innerHTML = STD_OPTIONS
    stubFormAssoc(el.probeInternals)
    document.body.append(el)
    await whenFlushed()

    click(getOption(el, 'cherry'))
    await whenFlushed()
    expect(el.value).toEqual(['apple', 'cherry'])

    el.formResetProbe()
    expect(el.value).toEqual(['apple']) // back to the connect-time attribute baseline, not []
    el.remove()
  })
})

// ── SPEC-R5 AC2 — external value write round-trips + re-paints ────────────────────────────────────

describe('ui-multi-select — external value write (ms-value-external-write)', () => {
  it('ms-value-external-write: el.value = [...] externally reflects the checked set (no page-side aggregation)', async () => {
    const { el } = makeMultiSelect()
    el.value = ['apple', 'banana']
    await whenFlushed()

    expect(el.value).toEqual(['apple', 'banana'])
    expect(getOption(el, 'apple').getAttribute('aria-selected')).toBe('true')
    expect(getOption(el, 'banana').getAttribute('aria-selected')).toBe('true')
    expect(getOption(el, 'cherry').getAttribute('aria-selected')).toBe('false')
    el.remove()
  })
})

// ── SPEC-R8 — ARIA (real ARIAMixin members, never a bespoke invention) ─────────────────────────────

describe('ui-multi-select — ARIA (ms-aria-listbox · ms-aria-multiselectable)', () => {
  it('ms-aria-listbox: internals.role === "listbox" (never a host role attribute)', () => {
    const { el } = makeMultiSelect()
    expect(el.probeInternals.role).toBe('listbox')
    expect(el.getAttribute('role')).toBeNull()
    el.remove()
  })

  it('ms-aria-multiselectable: internals.ariaMultiSelectable === "true"', () => {
    const { el } = makeMultiSelect()
    expect(el.probeInternals.ariaMultiSelectable).toBe('true')
    el.remove()
  })
})

// ── Keyboard: Space / Enter toggle (byte-identical to click, SPEC-R8 AC1) ──────────────────────────

describe('ui-multi-select — keyboard toggles (ms-keyboard-space · ms-keyboard-enter)', () => {
  it('ms-keyboard-enter: Enter on the focused option toggles membership, identical to a click', async () => {
    const { el } = makeMultiSelect()
    const banana = getOption(el, 'banana')
    banana.focus()
    keydown(banana, 'Enter')
    await whenFlushed()
    expect(el.value).toEqual(['banana'])
    expect(banana.getAttribute('aria-selected')).toBe('true')

    keydown(banana, 'Enter') // toggles back off
    await whenFlushed()
    expect(el.value).toEqual([])
    el.remove()
  })
})

// ── Disabled (the whole control) ───────────────────────────────────────────────────────────────────

describe('ui-multi-select — disabled (ms-disabled)', () => {
  it('ms-disabled: every option is marked aria-disabled while the control is disabled', async () => {
    const { el } = makeMultiSelect()
    el.disabled = true
    await whenFlushed()
    expect(getOption(el, 'apple').getAttribute('aria-disabled')).toBe('true')
    expect(getOption(el, 'banana').getAttribute('aria-disabled')).toBe('true')
    expect(getOption(el, 'cherry').getAttribute('aria-disabled')).toBe('true')
    el.remove()
  })

  it('ms-disabled: a disabled option is non-committable (the shared selectionCommit backstop)', async () => {
    const { el } = makeMultiSelect()
    el.disabled = true
    await whenFlushed()
    click(getOption(el, 'apple'))
    await whenFlushed()
    expect(el.value).toEqual([])
    el.remove()
  })

  it('ms-disabled: re-enabling clears ONLY the host-forced aria-disabled marks, not an author-set one', async () => {
    const el = new ProbeMultiSelect()
    el.innerHTML = `
      <div role="option" value="apple">Apple</div>
      <div role="option" value="banana" aria-disabled="true">Banana</div>
    `
    stubFormAssoc(el.probeInternals)
    document.body.append(el)
    el.disabled = true
    await whenFlushed()
    expect(getOption(el, 'apple').getAttribute('aria-disabled')).toBe('true')
    expect(getOption(el, 'banana').getAttribute('aria-disabled')).toBe('true')

    el.disabled = false
    await whenFlushed()
    expect(getOption(el, 'apple').hasAttribute('aria-disabled')).toBe(false) // host-forced mark cleared
    expect(getOption(el, 'banana').getAttribute('aria-disabled')).toBe('true') // author's own mark survives
    el.remove()
  })

  it('ms-disabled: :state(disabled) mirrors effectiveDisabled (own OR ancestor <fieldset disabled>) — CustomStateSet is absent in jsdom (capability-gated, the checkbox.test.ts precedent); the real :state() paint is a browser-leg proof', async () => {
    const { el } = makeMultiSelect()
    el.formDisabledCallback(true) // an ancestor <fieldset disabled> — the platform calls this directly
    await whenFlushed()
    if (el.probeInternals.states) expect(el.probeInternals.states.has('disabled')).toBe(true)

    el.formDisabledCallback(false)
    await whenFlushed()
    if (el.probeInternals.states) expect(el.probeInternals.states.has('disabled')).toBe(false)
    el.remove()
  })
})

// ── answered/settled choice state (ADR-0196, GH #1065) ───────────────────────────────────────────

describe('ui-multi-select — :state(answered) (ADR-0196)', () => {
  it('ms-answered-state: setting `answered` adds the custom state; clearing it removes it (capability-gated)', async () => {
    const { el } = makeMultiSelect()
    el.answered = true
    await whenFlushed()
    if (el.probeInternals.states) expect(el.probeInternals.states.has('answered')).toBe(true)

    el.answered = false
    await whenFlushed()
    if (el.probeInternals.states) expect(el.probeInternals.states.has('answered')).toBe(false)
    el.remove()
  })

  it('ms-answered-default: `answered` defaults to false', () => {
    const { el } = makeMultiSelect()
    expect(el.answered).toBe(false)
    el.remove()
  })
})

// ── Dynamic options (§8 — late-adopted option paint sync) ─────────────────────────────────────────

describe('ui-multi-select — dynamic options (ms-dynamic-options)', () => {
  it('ms-dynamic-options: a late-appended option matching the CURRENT value is immediately painted aria-selected', async () => {
    const { el } = makeMultiSelect()
    el.value = ['date']
    await whenFlushed()

    const late = document.createElement('div')
    late.setAttribute('role', 'option')
    late.setAttribute('value', 'date')
    late.textContent = 'Date'
    el.append(late)
    await Promise.resolve() // MutationObserver callback is microtask-deferred
    await Promise.resolve()

    expect(late.getAttribute('aria-selected')).toBe('true')
    el.remove()
  })

  it('ms-dynamic-options: a late-appended option is immediately selectable (click toggles it)', async () => {
    const { el } = makeMultiSelect()
    const late = document.createElement('div')
    late.setAttribute('role', 'option')
    late.setAttribute('value', 'date')
    late.textContent = 'Date'
    el.append(late)
    await Promise.resolve()
    await Promise.resolve()

    click(late)
    await whenFlushed()
    expect(el.value).toEqual(['date'])
    el.remove()
  })
})

// ── C10 zero-residue ────────────────────────────────────────────────────────────────────────────────

describe('ui-multi-select — C10 zero-residue (ms-c10-residue)', () => {
  it('ms-c10-residue: after disconnect, a click does not commit (listeners removed)', async () => {
    const { el } = makeMultiSelect()
    el.remove() // disconnect → scope.dispose() → AC aborts → listeners dead

    click(getOption(el, 'apple'))
    await whenFlushed()
    expect(el.value).toEqual([])
  })

  it('ms-c10-residue: reconnect does not stack listeners — one click, one commit', async () => {
    const { el } = makeMultiSelect()
    el.remove()
    document.body.append(el)
    await whenFlushed()

    let selectCount = 0
    el.addEventListener('select', () => { selectCount++ })
    click(getOption(el, 'apple'))
    await whenFlushed()
    expect(selectCount).toBe(1)
    el.remove()
  })
})

// ── ADR-0085 — the bare/fielded labelling seam ─────────────────────────────────────────────────────

describe('ui-multi-select — labelling (ms-label-bare · ms-label-fielded)', () => {
  it('ms-label-bare: no label set → internals.ariaLabel stays null (back-compat, zero drift)', () => {
    const { el } = makeMultiSelect()
    expect(el.probeInternals.ariaLabel).toBeNull()
    el.remove()
  })

  it('ms-label-bare: label set (bare, unfielded) → internals.ariaLabel === the label text', async () => {
    const { el } = makeMultiSelect()
    el.label = 'Skills'
    await whenFlushed()
    expect(el.probeInternals.ariaLabel).toBe('Skills')
    el.remove()
  })

  it('ms-label-bare: clearing label back to \'\' clears internals.ariaLabel again', async () => {
    const { el } = makeMultiSelect()
    el.label = 'Skills'
    await whenFlushed()
    el.label = ''
    await whenFlushed()
    expect(el.probeInternals.ariaLabel).toBeNull()
    el.remove()
  })

  it('ms-label-fielded: setFieldLabelling associates via the BASE default (ariaLabelledByElements), bare aria-label yields', async () => {
    const { el } = makeMultiSelect()
    el.label = 'Skills' // a consumer-set bare label — must yield the moment the control is fielded
    await whenFlushed()
    expect(el.probeInternals.ariaLabel).toBe('Skills')

    const fieldLabel = document.createElement('div')
    fieldLabel.id = 'field-label-1'
    el.setFieldLabelling({ label: fieldLabel, description: null, error: null })
    await whenFlushed()

    // The base UIFormElement's own guarded applyFieldLabelling default owns naming while fielded — the
    // bare-usage effect above (this control's OWN code) must not have overwritten it AFTER association.
    const internals = el.probeInternals as unknown as { ariaLabelledByElements?: HTMLElement[] | null }
    if ('ariaLabelledByElements' in internals) {
      expect(internals.ariaLabelledByElements).toEqual([fieldLabel])
    }
    el.remove()
  })

  it('ms-label-fielded: dissociation (setFieldLabelling(null)) reverts to the bare-mode aria-label state', async () => {
    const { el } = makeMultiSelect()
    el.label = 'Skills'
    await whenFlushed()

    const fieldLabel = document.createElement('div')
    fieldLabel.id = 'field-label-2'
    el.setFieldLabelling({ label: fieldLabel, description: null, error: null })
    await whenFlushed()

    el.setFieldLabelling(null)
    await whenFlushed()
    expect(el.probeInternals.ariaLabel).toBe('Skills') // reverted to the SAME bare state
    el.remove()
  })
})

// ── Descriptor trip-wire ─────────────────────────────────────────────────────────────────────────────

const MULTI_SELECT_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/multi-select`
const md = readFileSync(`${MULTI_SELECT_DIR}/multi-select.md`, 'utf8') as string
const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

// ADR-0223 (Fill by Default, slice 1): `inline` added after `answered` — the ONE sizing opt-out boolean.
const ATTR_NAMES = ['name', 'disabled', 'required', 'value', 'label', 'size', 'answered', 'inline']

describe('multi-select.md descriptor — frontmatter parses + schema-valid (ms-descriptor-schema)', () => {
  it('ms-descriptor-schema: has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-multi-select')
  })

  it('ms-descriptor-schema: carries the ADR-0004 / plan §10 descriptor field set', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
  })

  it('ms-descriptor-schema: tag=ui-multi-select, tier=pattern, extends=UIFormElement, formAssociated=true', () => {
    expect(/^tag:\s*ui-multi-select\s*$/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIFormElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*true/.test(fence)).toBe(true)
  })

  it('ms-descriptor-schema: records the bindable `value` (json, NOT reflected) + the select event', () => {
    const value = parsed.attributes.find((a) => a.name === 'value')
    expect(value?.type).toBe('json')
    expect(value?.reflect).toBe(false)
    const events = (parsed.sequences.get('events') ?? []).map((i) => i.get('name'))
    expect(events).toContain('select')
  })

  it('ms-descriptor-schema: validates with zero structural failures', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    const failures = validateComponentDescriptor(parsed)
    expect(failures).toEqual([])
  })
})

describe('multi-select.md descriptor — contract↔props trip-wire (ms-descriptor-bijection · ms-descriptor-negative)', () => {
  it('ms-descriptor-bijection: attributes[] is a faithful bijection with UIMultiSelectElement.props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    expect(compareDescriptorToProps(parsed.attributes, UIMultiSelectElement.props)).toEqual([])
  })

  it('ms-descriptor-negative: a drifted reflect FAILS the trip-wire', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'label' ? { ...a, reflect: false } : { ...a },
    )
    expect(compareDescriptorToProps(flipReflect, UIMultiSelectElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.label.reflect' }),
    )
  })

  it('ms-descriptor-negative: a removed attribute FAILS the trip-wire (bijection both ways)', () => {
    const dropSize: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'size')
    expect(compareDescriptorToProps(dropSize, UIMultiSelectElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.size' }),
    )
  })

  it('ms-descriptor-negative: an added attribute FAILS the trip-wire (extra in descriptor)', () => {
    const addBogus: ParsedAttribute[] = [
      ...parsed.attributes,
      { name: 'bogus', type: 'string', default: '', reflect: false },
    ]
    expect(compareDescriptorToProps(addBogus, UIMultiSelectElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

// ── Geometry trip-wire (SPEC-R7 AC1 — own *-DIM source probe) ──────────────────────────────────────

const multiSelectCss = readFileSync(`${MULTI_SELECT_DIR}/multi-select.css`, 'utf8') as string

describe('multi-select.css — geometry trip-wire (ms-geometry-tokens)', () => {
  it('ms-geometry-tokens: the virtual lever resolves off the §1-row ramp (ADR-0038), no ad hoc size value', () => {
    expect(multiSelectCss).toMatch(/--ui-multi-select-height:\s*var\(--md-sys-height-md\)/)
    expect(multiSelectCss).toMatch(/--ui-multi-select-font:\s*var\(--md-sys-font-md\)/)
    expect(multiSelectCss).toMatch(/--ui-multi-select-icon:\s*var\(--md-sys-icon-md\)/)
    expect(multiSelectCss).toMatch(/--ui-multi-select-glyph:\s*var\(--ui-multi-select-font\)/) // = font, §4.1
  })

  it('ms-geometry-tokens: [size=sm]/[size=lg] repoint the SAME three tokens (the ramp, not a multiplier)', () => {
    expect(multiSelectCss).toMatch(/ui-multi-select\[size='sm'\][\s\S]{0,200}--ui-multi-select-height:\s*var\(--md-sys-height-sm\)/)
    expect(multiSelectCss).toMatch(/ui-multi-select\[size='lg'\][\s\S]{0,200}--ui-multi-select-height:\s*var\(--md-sys-height-lg\)/)
  })

  it('ms-geometry-tokens: option padding is DERIVED off the lever (the legacy item-pad formula, not a literal)', () => {
    expect(multiSelectCss).toMatch(
      /--ui-multi-select-option-block:\s*calc\(\(var\(--ui-multi-select-height\) - var\(--ui-multi-select-font\)\) \/ 2\)/,
    )
    expect(multiSelectCss).toMatch(/--ui-multi-select-option-inline:\s*calc\(var\(--ui-multi-select-height\) \/ 4\)/)
  })

  it('ms-geometry-tokens: tokens declared in the :where() token block, consumed only in @scope', () => {
    // Search for the REAL rule openers (a trailing `{`), not the header comment's backtick-quoted
    // prose mentions of the same two strings.
    const tokenBlock = multiSelectCss.slice(0, multiSelectCss.indexOf('@scope (ui-multi-select) {'))
    const scopeBlock = multiSelectCss.slice(multiSelectCss.indexOf('@scope (ui-multi-select) {'))
    expect(tokenBlock).toMatch(/:where\(ui-multi-select\)\s*\{/)
    expect(scopeBlock).toMatch(/@scope \(ui-multi-select\)\s*\{/)
    // the styles block reads ONLY --ui-multi-select-* + the sanctioned fleet constants (focus-ring/motion)
    expect(scopeBlock).not.toMatch(/var\(--ui-space-/)
    expect(scopeBlock).not.toMatch(/var\(--ui-font-/)
    expect(scopeBlock).not.toMatch(/var\(--ui-radius-base/)
  })
})

// ── multi-select.css — :state(answered) block (ADR-0196) ────────────────────────────────────────

describe('multi-select.css — :state(answered) block (ADR-0196)', () => {
  it('declares --ui-multi-select-bg-answered/-ink-answered aliasing the fleet answered pair', () => {
    expect(multiSelectCss).toMatch(/--ui-multi-select-bg-answered:\s*var\(--ui-answered-bg\)/)
    expect(multiSelectCss).toMatch(/--ui-multi-select-ink-answered:\s*var\(--ui-answered-ink\)/)
  })

  it('repoints the frame + unselected rows, excluding disabled + pending (mutual exclusion)', () => {
    const m = /:scope:state\(answered\)([^{]*)\{([^}]*)\}/.exec(multiSelectCss)
    expect(m, 'no :scope:state(answered) ... { ... } rule found').not.toBeNull()
    const [, selector, rule] = m as unknown as [string, string, string]
    expect(selector).toMatch(/:not\(:state\(pending\)\)/)
    expect(selector).toMatch(/:not\(:is\(\[disabled\], :state\(disabled\)\)\)/)
    expect(rule).toMatch(/background-color:\s*var\(--ui-multi-select-bg-answered\)/)
    expect(multiSelectCss).toMatch(
      /:scope:state\(answered\):not\(:state\(pending\)\):not\(:is\(\[disabled\], :state\(disabled\)\)\) > \[role='option'\]:not\(\[aria-selected='true'\]\)/,
    )
  })

  it('the hover/focus repaint rules exclude :state(answered)', () => {
    expect(multiSelectCss).toMatch(/:scope:where\(:not\(:state\(answered\)\)\) > \[role='option'\]:hover/)
    expect(multiSelectCss).toMatch(/:scope:where\(:not\(:state\(answered\)\)\) > \[role='option'\]:focus-visible/)
  })
})
