import { describe, it, expect } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIChoiceGroupElement } from './choice-group.ts'
import { UIChoiceCardElement } from '../choice-card/choice-card.ts'
import type { FormValue, ValidityResult } from '../../dom/index.ts'

// jsdom probes — ui-choice-group (ADR-0220 GH #1368). A committed choice over agent-composed
// ui-choice-card option cards, single or multi. jsdom reality: the `ElementInternals`
// form-association surface (setFormValue / setValidity) is absent in jsdom — stub it per-instance
// BEFORE connect (the multi-select.test.ts / select.test.ts precedent). NAMED DEBT: the whole-shape
// geometry + forced-colors + non-color signifier + keyboard-vs-pointer byte-identity proofs a real
// `.browser.test.ts` shard would carry are DEFERRED, not yet written — tracked as a blocking
// precondition of the ADR-0220 wire-integration lane (GH #1398).
//
// Named probes: cg-upgrade · cg-typed · cg-define-guard · cg-single-exclusive · cg-multi-toggle ·
// cg-required-empty-single · cg-required-empty-multi · cg-required-cleared · cg-form-value-single ·
// cg-form-value-multi · cg-form-reset · cg-value-external-write · cg-aria-listbox ·
// cg-aria-multiselectable · cg-keyboard-space · cg-keyboard-enter · cg-roving-arrow ·
// cg-disabled-card-skipped · cg-disabled-card-never-commits · cg-group-disabled-cascade ·
// cg-group-disabled-blocks-commit · cg-discovery-nested-group-boundary · cg-c10-residue ·
// cg-late-card-observer · cg-declarative-initial-value

// ── Form-association stub (jsdom lacks setFormValue / setValidity) ──────────────────────────────────

function stubFormAssoc(internals: ElementInternals): void {
  const i = internals as unknown as Record<string, unknown>
  if (typeof i['setFormValue'] !== 'function') {
    i['setFormValue'] = (): void => {}
    i['setValidity'] = (): void => {}
  }
}

class ProbeChoiceGroup extends UIChoiceGroupElement {
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
customElements.define('ui-choice-group-probe', ProbeChoiceGroup)

// ── Helpers ─────────────────────────────────────────────────────────────────────────────────────────

const STD_CARDS = `
  <ui-choice-card value="standard">Standard</ui-choice-card>
  <ui-choice-card value="deluxe">Deluxe</ui-choice-card>
  <ui-choice-card value="suite">Suite</ui-choice-card>
`

function makeChoiceGroup(innerHTML = STD_CARDS): { el: ProbeChoiceGroup } {
  const el = new ProbeChoiceGroup()
  el.innerHTML = innerHTML
  stubFormAssoc(el.probeInternals) // stub BEFORE connect — form effects run on connectedCallback
  document.body.append(el) // ← connect fires here
  return { el }
}

const getCard = (el: HTMLElement, value: string): UIChoiceCardElement =>
  el.querySelector<UIChoiceCardElement>(`ui-choice-card[value="${value}"]`)!

// `internals` is `protected` on UIChoiceCardElement; a card retrieved off a real (non-probe) tag has
// no probe subclass to expose it through (custom-element tag registration is fixed 1:1) — a narrow,
// test-only cast reads the committed `aria-selected` fact the same way choice-card.test.ts's own
// ProbeChoiceCard getter does.
const ariaSelectedOf = (card: UIChoiceCardElement): string | null =>
  (card as unknown as { internals: ElementInternals }).internals.ariaSelected

const click = (el: Element): void => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

const keydown = (el: Element, key: string): void => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

// ── Upgrade + typed prop surface ───────────────────────────────────────────────────────────────────

describe('ui-choice-group — upgrade + typed prop surface (cg-upgrade)', () => {
  it('cg-upgrade: upgrades to UIChoiceGroupElement with default prop values (no connect needed)', () => {
    const el = document.createElement('ui-choice-group') as UIChoiceGroupElement
    expect(el).toBeInstanceOf(UIChoiceGroupElement)
    expect(el.multiple).toBe(false)
    expect(el.value).toBe('')
    expect(el.values).toEqual([])
    expect(el.min).toBe('')
    expect(el.gap).toBe('md')
    expect(el.label).toBe('')
    expect(el.name).toBe('')
    expect(el.disabled).toBe(false)
    expect(el.required).toBe(false)
  })

  it('cg-typed: props have the correct types (compile-time NCs)', () => {
    const fn = (): void => {
      const el = new UIChoiceGroupElement()
      el.multiple = true
      el.value = 'standard'
      el.values = ['a', 'b']
      el.min = '14rem'
      el.gap = 'lg'
      el.label = 'Room type'
      // @ts-expect-error — multiple is boolean, not a string
      el.multiple = 'yes'
      // @ts-expect-error — gap is a literal union, not a bare string
      el.gap = 'huge'
      // @ts-expect-error — values is string[], not a bare string
      el.values = 'a'
    }
    expect(typeof fn).toBe('function') // never invoked — the @ts-expect-error lines are the assertion
  })

  it('cg-define-guard: self-defines ui-choice-group, guarded against a double-define', () => {
    expect(customElements.get('ui-choice-group')).toBe(UIChoiceGroupElement)
    expect(() => {
      if (!customElements.get('ui-choice-group')) customElements.define('ui-choice-group', UIChoiceGroupElement)
    }).not.toThrow()
  })
})

// ── Single-mode exclusivity ─────────────────────────────────────────────────────────────────────────

describe('ui-choice-group — single-mode exclusivity (cg-single-exclusive)', () => {
  it('cg-single-exclusive: clicking a card commits it and its own value; a later click REPLACES', async () => {
    const { el } = makeChoiceGroup()
    click(getCard(el, 'standard'))
    await whenFlushed()
    expect(el.value).toBe('standard')
    expect(ariaSelectedOf(getCard(el, 'standard'))).toBe('true')

    click(getCard(el, 'deluxe'))
    await whenFlushed()
    expect(el.value).toBe('deluxe')
    expect(ariaSelectedOf(getCard(el, 'standard'))).toBe('false')
    expect(ariaSelectedOf(getCard(el, 'deluxe'))).toBe('true')
    el.remove()
  })
})

// ── Multi-mode toggle ───────────────────────────────────────────────────────────────────────────────

describe('ui-choice-group — multi-mode toggle (cg-multi-toggle)', () => {
  it('cg-multi-toggle: clicking toggles membership; no modifier keys consulted (LLD-C4)', async () => {
    const el = new ProbeChoiceGroup()
    el.multiple = true
    el.innerHTML = STD_CARDS
    stubFormAssoc(el.probeInternals)
    document.body.append(el)

    click(getCard(el, 'standard'))
    await whenFlushed()
    expect(el.values).toEqual(['standard'])

    click(getCard(el, 'deluxe'))
    await whenFlushed()
    expect(el.values).toEqual(['standard', 'deluxe'])

    click(getCard(el, 'standard')) // toggle OFF
    await whenFlushed()
    expect(el.values).toEqual(['deluxe'])
    el.remove()
  })
})

// ── Required validity ───────────────────────────────────────────────────────────────────────────────

describe('ui-choice-group — required validity (cg-required-empty-single · cg-required-empty-multi · cg-required-cleared)', () => {
  it('cg-required-empty-single: required + no selection → valueMissing (single mode)', () => {
    const { el } = makeChoiceGroup()
    el.required = true
    const result = el.formValidityProbe()
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.flags.valueMissing).toBe(true)
    el.remove()
  })

  it('cg-required-empty-multi: required + [] → valueMissing (multi mode)', () => {
    const el = new ProbeChoiceGroup()
    el.multiple = true
    el.required = true
    el.innerHTML = STD_CARDS
    stubFormAssoc(el.probeInternals)
    document.body.append(el)
    const result = el.formValidityProbe()
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.flags.valueMissing).toBe(true)
    el.remove()
  })

  it('cg-required-cleared: required + a committed selection → valid', async () => {
    const { el } = makeChoiceGroup()
    el.required = true
    click(getCard(el, 'standard'))
    await whenFlushed()
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })

  it('cg-required-cleared: NOT required + no selection → valid', () => {
    const { el } = makeChoiceGroup()
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })
})

// ── Form value ──────────────────────────────────────────────────────────────────────────────────────

describe('ui-choice-group — form value (cg-form-value-single · cg-form-value-multi · cg-form-reset)', () => {
  it('cg-form-value-single: formValue() returns the committed key, or null when empty', async () => {
    const { el } = makeChoiceGroup()
    expect(el.formValueProbe()).toBeNull()
    click(getCard(el, 'deluxe'))
    await whenFlushed()
    expect(el.formValueProbe()).toBe('deluxe')
    el.remove()
  })

  it('cg-form-value-multi: formValue() contributes MULTIPLE entries under `name` (multi mode)', async () => {
    const el = new ProbeChoiceGroup()
    el.multiple = true
    el.name = 'amenities'
    el.innerHTML = STD_CARDS
    stubFormAssoc(el.probeInternals)
    document.body.append(el)
    click(getCard(el, 'standard'))
    click(getCard(el, 'suite'))
    await whenFlushed()

    const fd = el.formValueProbe() as FormData
    expect(fd).toBeInstanceOf(FormData)
    expect(fd.getAll('amenities')).toEqual(['standard', 'suite'])
    el.remove()
  })

  it('cg-form-value-multi: zero selections submits an EMPTY FormData', () => {
    const el = new ProbeChoiceGroup()
    el.multiple = true
    el.innerHTML = STD_CARDS
    stubFormAssoc(el.probeInternals)
    document.body.append(el)
    const fd = el.formValueProbe() as FormData
    expect([...fd.entries()]).toEqual([])
    el.remove()
  })

  it('cg-form-reset: formReset() restores value to the attribute held at connect time', async () => {
    const el = new ProbeChoiceGroup()
    el.setAttribute('value', 'standard')
    el.innerHTML = STD_CARDS
    stubFormAssoc(el.probeInternals)
    document.body.append(el)
    await whenFlushed()

    click(getCard(el, 'suite'))
    await whenFlushed()
    expect(el.value).toBe('suite')

    el.formResetProbe()
    expect(el.value).toBe('standard') // back to the connect-time attribute baseline
    el.remove()
  })
})

// ── External value write ───────────────────────────────────────────────────────────────────────────

describe('ui-choice-group — external value write (cg-value-external-write)', () => {
  it('cg-value-external-write: el.value = "…" externally reflects the selected card (no self-emit)', async () => {
    const { el } = makeChoiceGroup()
    let selectEvents = 0
    el.addEventListener('select', () => { selectEvents += 1 })

    el.value = 'suite'
    await whenFlushed()
    expect(ariaSelectedOf(getCard(el, 'suite'))).toBe('true')
    expect(ariaSelectedOf(getCard(el, 'standard'))).toBe('false')
    expect(selectEvents).toBe(0) // a programmatic write never self-emits
    el.remove()
  })

  it('cg-value-external-write: el.values = [...] externally reflects the checked set (multi mode)', async () => {
    const el = new ProbeChoiceGroup()
    el.multiple = true
    el.innerHTML = STD_CARDS
    stubFormAssoc(el.probeInternals)
    document.body.append(el)

    el.values = ['standard', 'suite']
    await whenFlushed()
    expect(ariaSelectedOf(getCard(el, 'standard'))).toBe('true')
    expect(ariaSelectedOf(getCard(el, 'deluxe'))).toBe('false')
    expect(ariaSelectedOf(getCard(el, 'suite'))).toBe('true')
    el.remove()
  })
})

// ── ARIA ────────────────────────────────────────────────────────────────────────────────────────────

describe('ui-choice-group — ARIA (cg-aria-listbox · cg-aria-multiselectable)', () => {
  it('cg-aria-listbox: role=listbox via internals, never a host attribute', () => {
    const { el } = makeChoiceGroup()
    expect(el.probeInternals.role).toBe('listbox')
    expect(el.getAttribute('role')).toBeNull()
    el.remove()
  })

  it('cg-aria-multiselectable: set only in multi mode', () => {
    const single = makeChoiceGroup().el
    expect(single.probeInternals.ariaMultiSelectable).not.toBe('true')
    single.remove()

    const el = new ProbeChoiceGroup()
    el.multiple = true
    el.innerHTML = STD_CARDS
    stubFormAssoc(el.probeInternals)
    document.body.append(el)
    expect(el.probeInternals.ariaMultiSelectable).toBe('true')
    el.remove()
  })
})

// ── Keyboard ────────────────────────────────────────────────────────────────────────────────────────

describe('ui-choice-group — keyboard (cg-keyboard-space · cg-keyboard-enter · cg-roving-arrow)', () => {
  it('cg-keyboard-enter: Enter commits the currently roving-focused card', async () => {
    const { el } = makeChoiceGroup()
    getCard(el, 'deluxe').focus()
    keydown(el, 'Enter')
    await whenFlushed()
    expect(el.value).toBe('deluxe')
    el.remove()
  })

  it('cg-keyboard-space: Space commits/toggles the currently roving-focused card', async () => {
    const { el } = makeChoiceGroup()
    getCard(el, 'suite').focus()
    keydown(el, ' ')
    await whenFlushed()
    expect(el.value).toBe('suite')
    el.remove()
  })

  it('cg-roving-arrow: ArrowDown moves roving focus to the next card (rovingFocus)', () => {
    const { el } = makeChoiceGroup()
    const standard = getCard(el, 'standard')
    const deluxe = getCard(el, 'deluxe')
    standard.focus()
    keydown(el, 'ArrowDown')
    expect(document.activeElement).toBe(deluxe)
    el.remove()
  })
})

// ── Disabled ────────────────────────────────────────────────────────────────────────────────────────

describe('ui-choice-group — disabled (cg-disabled-card-skipped · cg-disabled-card-never-commits · cg-group-disabled-cascade · cg-group-disabled-blocks-commit)', () => {
  it('cg-disabled-card-skipped: a per-card disabled card is skipped by roving (ArrowDown jumps over it)', () => {
    const { el } = makeChoiceGroup()
    getCard(el, 'deluxe').disabled = true
    const standard = getCard(el, 'standard')
    const suite = getCard(el, 'suite')
    standard.focus()
    keydown(el, 'ArrowDown')
    expect(document.activeElement).toBe(suite) // deluxe skipped
    el.remove()
  })

  it('cg-disabled-card-never-commits: clicking a disabled card does not commit', async () => {
    const { el } = makeChoiceGroup()
    getCard(el, 'deluxe').disabled = true
    click(getCard(el, 'deluxe'))
    await whenFlushed()
    expect(el.value).toBe('')
    el.remove()
  })

  it('cg-group-disabled-cascade: the whole group being disabled cascades disabled onto non-individually-disabled cards', async () => {
    const { el } = makeChoiceGroup()
    el.disabled = true
    await whenFlushed()
    expect(getCard(el, 'standard').disabled).toBe(true)
    expect(getCard(el, 'deluxe').disabled).toBe(true)

    // re-enabling clears ONLY the group-forced marks
    el.disabled = false
    await whenFlushed()
    expect(getCard(el, 'standard').disabled).toBe(false)
    el.remove()
  })

  it('cg-group-disabled-cascade: re-enabling never clears an AUTHOR-set per-card disabled', async () => {
    const { el } = makeChoiceGroup()
    getCard(el, 'suite').disabled = true // author-set, BEFORE the group disables
    el.disabled = true
    await whenFlushed()
    el.disabled = false
    await whenFlushed()
    expect(getCard(el, 'suite').disabled).toBe(true) // still disabled — the group never forced this one off
    expect(getCard(el, 'standard').disabled).toBe(false)
    el.remove()
  })

  it('cg-group-disabled-blocks-commit: a click on any card commits nothing while the group is disabled', async () => {
    const { el } = makeChoiceGroup()
    el.disabled = true
    await whenFlushed()
    click(getCard(el, 'standard'))
    await whenFlushed()
    expect(el.value).toBe('')
    el.remove()
  })
})

// ── Discovery — nearest-group-scoped descendants (ADR-0220 cl.7) ──────────────────────────────────

describe('ui-choice-group — nearest-group-scoped discovery (cg-discovery-nested-group-boundary)', () => {
  it('cg-discovery-nested-group-boundary: an INNER group\'s cards are never roved or committed by the OUTER group', async () => {
    // Built via createElement (not innerHTML) so BOTH groups' internals can be stubbed BEFORE either
    // connects — the raw (non-probe) `ui-choice-group` tag only exposes `internals` as `protected`, so
    // the inner group's stub reaches it via a narrow, test-only cast (the multi-select.ts precedent's
    // probe-subclass trick isn't available here since custom-element tag registration is fixed 1:1).
    const outer = new ProbeChoiceGroup()
    const outerCard = document.createElement('ui-choice-card') as UIChoiceCardElement
    outerCard.setAttribute('value', 'outer-a')

    const inner = document.createElement('ui-choice-group') as UIChoiceGroupElement
    const innerCard = document.createElement('ui-choice-card') as UIChoiceCardElement
    innerCard.setAttribute('value', 'inner-a')
    inner.append(innerCard)

    outer.append(outerCard, inner)
    stubFormAssoc(outer.probeInternals)
    stubFormAssoc((inner as unknown as { internals: ElementInternals }).internals)

    document.body.append(outer) // connects the whole subtree

    click(innerCard)
    await whenFlushed()

    // The OUTER group must NOT have committed the inner card's value — the inner group owns it.
    expect(outer.value).toBe('')
    expect(inner.value).toBe('inner-a')
    outer.remove()
  })
})

// ── Late-adopted card observer (MAJOR-1, the TKT-0026 pattern) ────────────────────────────────────────

describe('ui-choice-group — late-adopted card observer (cg-late-card-observer)', () => {
  it('cg-late-card-observer: a card appended AFTER commit whose value matches the ALREADY-committed selection paints selected immediately — no further value write required', async () => {
    const { el } = makeChoiceGroup()
    // Committed BEFORE any matching card exists in the DOM — no STD_CARDS card carries this value.
    el.value = 'penthouse'
    await whenFlushed()

    const late = document.createElement('ui-choice-card') as UIChoiceCardElement
    late.setAttribute('value', 'penthouse')
    el.append(late) // late-adopted — a catalog partial rebuild / streamed-in option, the multi-select.ts precedent
    await whenFlushed()

    // No further `el.value` write follows the append — the MutationObserver alone must re-run
    // syncCardState() and paint the newly-adopted card.
    expect(ariaSelectedOf(late)).toBe('true')
    el.remove()
  })

  it('cg-late-card-observer: a card appended AFTER commit whose value does NOT match stays unselected', async () => {
    const { el } = makeChoiceGroup()
    el.value = 'penthouse'
    await whenFlushed()

    const late = document.createElement('ui-choice-card') as UIChoiceCardElement
    late.setAttribute('value', 'garden-view')
    el.append(late)
    await whenFlushed()

    expect(ariaSelectedOf(late)).toBe('false')
    el.remove()
  })

  it('cg-late-card-observer: a card appended nested inside a wrapper (any nesting depth, cl.7) still gets painted', async () => {
    const { el } = makeChoiceGroup()
    el.values = ['wifi'] // exercised in single mode too — cl.7 discovery has no mode dependency
    el.multiple = true
    await whenFlushed()

    const wrapper = document.createElement('div')
    const late = document.createElement('ui-choice-card') as UIChoiceCardElement
    late.setAttribute('value', 'wifi')
    wrapper.append(late)
    el.append(wrapper) // NOT a direct child — subtree:true must still catch it
    await whenFlushed()

    expect(ariaSelectedOf(late)).toBe('true')
    el.remove()
  })
})

// ── Declarative initial value (NIT-7) ──────────────────────────────────────────────────────────────

describe('ui-choice-group — declarative initial value (cg-declarative-initial-value)', () => {
  it('cg-declarative-initial-value: a declarative value="…" attribute paints aria-selected at first flush', async () => {
    const el = new ProbeChoiceGroup()
    el.setAttribute('value', 'deluxe')
    el.innerHTML = STD_CARDS
    stubFormAssoc(el.probeInternals)
    document.body.append(el)
    await whenFlushed()

    expect(ariaSelectedOf(getCard(el, 'deluxe'))).toBe('true')
    expect(ariaSelectedOf(getCard(el, 'standard'))).toBe('false')
    el.remove()
  })
})

// ── C10 zero-residue ────────────────────────────────────────────────────────────────────────────────

describe('ui-choice-group — C10 zero-residue (cg-c10-residue)', () => {
  it('cg-c10-residue: after disconnect, a click does not commit (listeners removed)', async () => {
    const { el } = makeChoiceGroup()
    el.remove() // disconnect → AbortSignal aborted → listeners removed
    click(getCard(el, 'standard'))
    await whenFlushed()
    expect(el.value).toBe('')
  })
})
