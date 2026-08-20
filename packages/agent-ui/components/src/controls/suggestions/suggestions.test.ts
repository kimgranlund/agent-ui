import { describe, it, expect, afterEach } from 'vitest'
import { UISuggestionsElement } from './suggestions.ts'
import { cleanSuggestions, suggestionsProp } from './suggestions-model.ts'
import { whenFlushed } from '../../reactive/index.ts'

// suggestions.test.ts — jsdom behaviour probes for the one-shot follow-up chip set (ADR-0213). jsdom is
// blind to painted geometry/ink — the compact-realm chip rhythm lives in suggestions.browser.test.ts;
// this file covers everything jsdom CAN see: the hardening/default-value law (model), the codec, the DOM
// the render effect builds, the commit path (`select` fires ONLY from a real click), and — the load-
// bearing probe this ADR names explicitly — the SPENT-SET INERTNESS law (cl.3): once `selected` is
// non-empty, every chip goes `disabled`, the host reflects `disabled` (a real JS property, not merely an
// attribute — the renderer's GH #1164 guard reads `el.disabled === true`), and a further click commits
// nothing and fires nothing.

const mounted: HTMLElement[] = []
const mount = (): UISuggestionsElement => {
  const el = document.createElement('ui-suggestions') as UISuggestionsElement
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const SET = [
  { label: 'Book the Deluxe King' },
  { label: 'See more photos', value: 'more-photos' },
  { label: 'Compare rooms', value: 'compare' },
]

describe('cleanSuggestions — the hardened-data-prop idiom (ADR-0213 cl.2, the ADR-0201 idiom)', () => {
  it('a non-array input yields []', () => {
    for (const input of [null, undefined, 'x', 42, true, {}]) expect(cleanSuggestions(input)).toEqual([])
  })

  it('a well-formed entry survives verbatim; an absent/blank value defaults to the label', () => {
    expect(cleanSuggestions([
      { label: 'Book the Deluxe King' },
      { label: 'See more photos', value: 'more-photos' },
      { label: 'Blank value', value: '' },
      { label: 'Whitespace value', value: '   ' },
    ])).toEqual([
      { label: 'Book the Deluxe King', value: 'Book the Deluxe King' },
      { label: 'See more photos', value: 'more-photos' },
      { label: 'Blank value', value: 'Blank value' },
      { label: 'Whitespace value', value: 'Whitespace value' },
    ])
  })

  it('DROPS every label-less/degenerate entry — never coerces, never renders a label-less chip', () => {
    const items = cleanSuggestions([
      { value: 'no label' },
      { label: '', value: 'orphan' }, // empty label
      { label: '  ', value: 'orphan' }, // whitespace label
      { label: null, value: 'orphan' },
      { label: 42, value: 'orphan' },
      'not an object',
      null,
      ['label', 'value'],
      { label: 'Kept' },
    ])
    expect(items).toEqual([{ label: 'Kept', value: 'Kept' }])
  })

  it('a non-string value (object/array/number/boolean) falls back to the label, never throws/coerces raw', () => {
    expect(cleanSuggestions([{ label: 'A', value: 42 }, { label: 'B', value: { x: 1 } }, { label: 'C', value: true }]))
      .toEqual([{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }, { label: 'C', value: 'C' }])
  })

  it('preserves order; duplicate labels/values both survive (no key identity imposed)', () => {
    expect(cleanSuggestions([{ label: 'A' }, { label: 'A' }])).toEqual([{ label: 'A', value: 'A' }, { label: 'A', value: 'A' }])
  })
})

describe('suggestionsProp — the safe JSON codec (the descriptionRowsProp/tableRowsProp shape)', () => {
  it('from(null) → [] (attribute absent/removed), never null', () => {
    expect(suggestionsProp.type.from(null)).toEqual([])
  })

  it('malformed attribute JSON falls back to [] — no throw reaches attributeChangedCallback', () => {
    expect(suggestionsProp.type.from('{not json')).toEqual([])
  })

  it('well-formed JSON is HARDENED on the way in', () => {
    expect(suggestionsProp.type.from('[{"label":""},{"label":"Kept"}]')).toEqual([{ label: 'Kept', value: 'Kept' }])
  })

  it('to() round-trips as JSON text', () => {
    expect(suggestionsProp.type.to([{ label: 'A', value: 'a' }])).toBe('[{"label":"A","value":"a"}]')
  })
})

describe('UISuggestionsElement — upgrade + typed props', () => {
  it('defaults: suggestions=[], selected=""; renders no chips; not disabled', () => {
    const el = mount()
    expect(el).toBeInstanceOf(UISuggestionsElement)
    expect(el.suggestions).toEqual([])
    expect(el.selected).toBe('')
    expect(el.disabled).toBe(false)
    expect(el.querySelector('[data-part="chip"]')).toBeNull()
  })

  it('self-defines as ui-suggestions, guarded against double-define', () => {
    expect(customElements.get('ui-suggestions')).toBe(UISuggestionsElement)
    expect(() => {
      if (!customElements.get('ui-suggestions')) customElements.define('ui-suggestions', UISuggestionsElement)
    }).not.toThrow()
  })
})

describe('UISuggestionsElement — the DOM the render effect builds (ADR-0213 cl.1: a leaf, no ChildList)', () => {
  it('one <button data-part=chip> per surviving suggestion, DOM order == array order, textContent == label', async () => {
    const el = mount()
    el.suggestions = SET
    await whenFlushed()
    const chips = [...el.querySelectorAll('[data-part="chip"]')] as HTMLButtonElement[]
    expect(chips.length).toBe(3)
    expect(chips.map((c) => c.textContent)).toEqual(['Book the Deluxe King', 'See more photos', 'Compare rooms'])
    expect(chips.every((c) => c.tagName === 'BUTTON' && c.type === 'button')).toBe(true)
    expect(chips.map((c) => c.dataset.value)).toEqual(['Book the Deluxe King', 'more-photos', 'compare'])
  })

  it('the omission law holds on the PROPERTY path too (a direct write is re-hardened)', async () => {
    const el = mount()
    el.suggestions = [{ label: 'Kept' }, { label: '' } as never, { value: 'no label' } as never]
    await whenFlushed()
    const chips = [...el.querySelectorAll('[data-part="chip"]')]
    expect(chips.length).toBe(1)
    expect(chips[0]?.textContent).toBe('Kept')
  })

  it('the omission law holds on the ATTRIBUTE path (codec hardening)', async () => {
    const el = mount()
    el.setAttribute('suggestions', '[{"label":"Kept"},{"label":""}]')
    await whenFlushed()
    expect(el.suggestions).toEqual([{ label: 'Kept', value: 'Kept' }])
    expect(el.querySelectorAll('[data-part="chip"]').length).toBe(1)
  })

  it('a suggestions swap re-renders whole (whole-swap semantics); clearing renders nothing', async () => {
    const el = mount()
    el.suggestions = [{ label: 'A' }]
    await whenFlushed()
    expect(el.querySelectorAll('[data-part="chip"]').length).toBe(1)
    el.suggestions = [{ label: 'B' }, { label: 'C' }]
    await whenFlushed()
    expect([...el.querySelectorAll('[data-part="chip"]')].map((n) => n.textContent)).toEqual(['B', 'C'])
    el.suggestions = []
    await whenFlushed()
    expect(el.querySelector('[data-part="chip"]')).toBeNull()
  })

  it('values render as TEXT, never markup (textContent assignment — no injection surface)', async () => {
    const el = mount()
    el.suggestions = [{ label: '<img src=x onerror=alert(1)>' }]
    await whenFlushed()
    expect(el.querySelector('img')).toBeNull()
    expect(el.querySelector('[data-part="chip"]')?.textContent).toBe('<img src=x onerror=alert(1)>')
  })
})

describe('UISuggestionsElement — commit (the fleet commit law: select fires ONLY from a real click)', () => {
  it('clicking a live chip commits selected + fires select with the value as detail', async () => {
    const el = mount()
    el.suggestions = SET
    await whenFlushed()
    const events: unknown[] = []
    el.addEventListener('select', (e) => events.push((e as CustomEvent).detail))
    const chip = el.querySelectorAll('[data-part="chip"]')[1] as HTMLButtonElement // "See more photos" → more-photos
    chip.click()
    await whenFlushed()
    expect(el.selected).toBe('more-photos')
    expect(events).toEqual(['more-photos'])
  })

  it('a programmatic `selected` write NEVER fires select (the table.ts fleet commit law)', async () => {
    const el = mount()
    el.suggestions = SET
    await whenFlushed()
    const events: unknown[] = []
    el.addEventListener('select', (e) => events.push((e as CustomEvent).detail))
    el.selected = 'compare'
    await whenFlushed()
    expect(events).toEqual([])
  })

  it('a click on a chip with an empty resolved value is a no-op (defensive — cleanSuggestions never actually produces one)', async () => {
    const el = mount()
    el.suggestions = SET
    await whenFlushed()
    const chip = el.querySelectorAll('[data-part="chip"]')[0] as HTMLButtonElement
    delete chip.dataset.value // simulate a missing value defensively
    chip.click()
    await whenFlushed()
    expect(el.selected).toBe('')
  })

  // Fork-T1/D1 probe (the rating.test.ts "change-after-value-commit" shape, ADR-0216 cl.6) — `#onClick`
  // writes `this.selected` BEFORE emitting `select` (suggestions.ts), so a listener reading `el.selected`
  // INSIDE the handler must already observe the committed value, not the stale pre-click `''`.
  it('a listener reading `el.selected` inside "select" observes the ALREADY-COMMITTED value, not a stale one', async () => {
    const el = mount()
    el.suggestions = SET
    await whenFlushed()
    let sawDuringSelect: string | undefined
    el.addEventListener('select', () => {
      sawDuringSelect = el.selected // must already read 'more-photos' — the commit has already happened
    })
    const chip = el.querySelectorAll('[data-part="chip"]')[1] as HTMLButtonElement // "See more photos" → more-photos
    chip.click() // a real chip click — the only commit path (suggestions.ts's fleet commit law)
    await whenFlushed()
    expect(sawDuringSelect).toBe('more-photos') // NOT the stale pre-click value ('') — value-before-event ordering
    expect(el.selected).toBe('more-photos')
  })
})

describe('UISuggestionsElement — the SPENT-SET inertness law (ADR-0213 cl.3, the load-bearing probe)', () => {
  it('a commit renders the WHOLE set spent: every chip disabled, host.disabled true, [disabled] reflected', async () => {
    const el = mount()
    el.suggestions = SET
    await whenFlushed()
    const chips = [...el.querySelectorAll('[data-part="chip"]')] as HTMLButtonElement[]
    chips[1]!.click()
    await whenFlushed()

    // the renderer's GH #1164 disabled-guard reads this as a plain JS property — must be a REAL true
    expect(el.disabled).toBe(true)
    expect(el.hasAttribute('disabled')).toBe(true)

    for (const chip of [...el.querySelectorAll('[data-part="chip"]')] as HTMLButtonElement[]) {
      expect(chip.disabled, `chip "${chip.textContent}" must be disabled once the set is spent`).toBe(true)
    }
  })

  it('the taken chip stays visible and marked ([data-taken], aria-pressed=true); siblings are aria-pressed=false', async () => {
    const el = mount()
    el.suggestions = SET
    await whenFlushed()
    const chips = [...el.querySelectorAll('[data-part="chip"]')] as HTMLButtonElement[]
    chips[2]!.click() // "Compare rooms" → compare
    await whenFlushed()

    const after = [...el.querySelectorAll('[data-part="chip"]')] as HTMLButtonElement[]
    expect(after.length).toBe(3) // NEVER removed — the history record must show what was offered+taken
    const taken = after.find((c) => c.hasAttribute('data-taken'))
    expect(taken?.textContent).toBe('Compare rooms')
    expect(taken?.getAttribute('aria-pressed')).toBe('true')
    for (const c of after) {
      if (c !== taken) expect(c.getAttribute('aria-pressed')).toBe('false')
    }
  })

  it('once spent, a further click on ANY chip (including the taken one) commits nothing and fires nothing again', async () => {
    const el = mount()
    el.suggestions = SET
    await whenFlushed()
    const events: unknown[] = []
    el.addEventListener('select', (e) => events.push((e as CustomEvent).detail))
    const chips = [...el.querySelectorAll('[data-part="chip"]')] as HTMLButtonElement[]
    chips[0]!.click()
    await whenFlushed()
    expect(events).toEqual(['Book the Deluxe King'])

    // re-click the NOW-disabled taken chip and an untaken sibling — jsdom does not itself suppress
    // .click() on a disabled <button> the way a real pointer would, so the component's own defensive
    // re-guard (#onClick) is what this probe actually proves.
    for (const chip of [...el.querySelectorAll('[data-part="chip"]')] as HTMLButtonElement[]) chip.click()
    await whenFlushed()
    expect(events).toEqual(['Book the Deluxe King']) // no second commit, ever
    expect(el.selected).toBe('Book the Deluxe King')
  })

  it('spent-ness round-trips through the data model — declaring `selected` directly renders spent with zero clicks', async () => {
    const el = mount()
    el.suggestions = SET
    el.selected = 'compare'
    await whenFlushed()
    expect(el.disabled).toBe(true)
    const taken = [...el.querySelectorAll('[data-part="chip"]')].find((c) => c.hasAttribute('data-taken'))
    expect(taken?.textContent).toBe('Compare rooms')
  })

  it('`disabled` is a derived getter, not an independent author lever (assigning to it throws)', () => {
    const el = mount()
    expect(() => {
      ;(el as unknown as { disabled: boolean }).disabled = true
    }).toThrow()
  })
})

describe('UISuggestionsElement — no ARIA host attributes beyond aria-disabled (ADR-0213 aria.role=none)', () => {
  it('no host role attribute; internals-only ARIA (never a host aria-* attribute for role/name)', async () => {
    const el = mount()
    el.suggestions = SET
    await whenFlushed()
    expect(el.hasAttribute('role')).toBe(false)
    expect(el.hasAttribute('aria-label')).toBe(false)
  })
})
