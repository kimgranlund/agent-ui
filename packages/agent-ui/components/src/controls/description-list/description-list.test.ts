import { describe, it, expect, afterEach } from 'vitest'
import { UIDescriptionListElement } from './description-list.ts'
import { cleanDescriptionRows, formatRowValue, descriptionRowsProp } from './description-list-model.ts'
import { whenFlushed } from '../../reactive/index.ts'

// description-list.test.ts — jsdom behaviour probes for the key–value receipt primitive (ADR-0201).
// jsdom is blind to painted geometry and computed-style ink — the receipt rhythm (adjacency, baseline,
// gaps) lives in description-list.browser.test.ts; this file covers everything jsdom CAN see: the
// hardening/omission law (model), the codec, and the DOM structure the render effect builds.

const mounted: HTMLElement[] = []
const mount = (): UIDescriptionListElement => {
  const el = document.createElement('ui-description-list') as UIDescriptionListElement
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('cleanDescriptionRows — the empty-value omission law, by construction (ADR-0201 cl.3)', () => {
  it('a non-array input yields []', () => {
    for (const input of [null, undefined, 'x', 42, true, {}]) expect(cleanDescriptionRows(input)).toEqual([])
  })

  it('a well-formed row survives verbatim (string and finite-number values)', () => {
    expect(cleanDescriptionRows([
      { label: 'Room', value: 'Deluxe King' },
      { label: 'Nights', value: 3 },
    ])).toEqual([
      { label: 'Room', value: 'Deluxe King' },
      { label: 'Nights', value: 3 },
    ])
  })

  it('DROPS every valueless/degenerate row — never coerces, never renders an empty row', () => {
    const rows = cleanDescriptionRows([
      { label: 'A' }, // value absent
      { label: 'B', value: null },
      { label: 'C', value: '' }, // empty string
      { label: 'D', value: '   ' }, // whitespace-only
      { label: 'E', value: true }, // boolean — humanization is the PRODUCER's job; no silent Yes/No repair
      { label: 'F', value: Number.NaN },
      { label: 'G', value: Number.POSITIVE_INFINITY },
      { label: 'H', value: { nested: 1 } },
      { label: 'I', value: ['x'] },
      { label: '', value: 'orphan' }, // empty label
      { label: '  ', value: 'orphan' }, // whitespace label
      { value: 'no label' },
      'not an object',
      null,
      ['label', 'value'],
      { label: 'Kept', value: 'yes' },
    ])
    expect(rows).toEqual([{ label: 'Kept', value: 'yes' }])
  })

  it('preserves order; duplicate labels both survive (no key identity imposed)', () => {
    expect(cleanDescriptionRows([
      { label: 'Guest', value: 'Ada' },
      { label: 'Guest', value: 'Grace' },
    ])).toEqual([
      { label: 'Guest', value: 'Ada' },
      { label: 'Guest', value: 'Grace' },
    ])
  })
})

describe('formatRowValue — verbatim strings, Intl numbers (ADR-0201 cl.3)', () => {
  it('a string passes through VERBATIM (humanization is the producer’s job)', () => {
    expect(formatRowValue('deluxe-king')).toBe('deluxe-king') // never title-cased here
    expect(formatRowValue('$1.2M')).toBe('$1.2M')
  })

  it('a finite number prints via the shared default-locale Intl.NumberFormat', () => {
    expect(formatRowValue(48200)).toBe(new Intl.NumberFormat().format(48200))
  })
})

describe('descriptionRowsProp — the safe JSON codec (the tableRowsProp shape)', () => {
  it('from(null) → [] (attribute absent/removed), never null', () => {
    expect(descriptionRowsProp.type.from(null)).toEqual([])
  })

  it('malformed attribute JSON falls back to [] — no throw reaches attributeChangedCallback', () => {
    expect(descriptionRowsProp.type.from('{not json')).toEqual([])
  })

  it('well-formed JSON is HARDENED on the way in (the property never carries an un-hardened array)', () => {
    expect(descriptionRowsProp.type.from('[{"label":"A","value":""},{"label":"B","value":"kept"}]'))
      .toEqual([{ label: 'B', value: 'kept' }])
  })

  it('to() round-trips as JSON text', () => {
    expect(descriptionRowsProp.type.to([{ label: 'A', value: 1 }])).toBe('[{"label":"A","value":1}]')
  })
})

describe('UIDescriptionListElement — upgrade + typed props', () => {
  it('defaults: rows=[]; renders nothing', () => {
    const el = mount()
    expect(el).toBeInstanceOf(UIDescriptionListElement)
    expect(el.rows).toEqual([])
    expect(el.querySelector('[data-part="row"]')).toBeNull()
  })

  it('self-defines as ui-description-list, guarded against double-define', () => {
    expect(customElements.get('ui-description-list')).toBe(UIDescriptionListElement)
    expect(() => {
      if (!customElements.get('ui-description-list')) customElements.define('ui-description-list', UIDescriptionListElement)
    }).not.toThrow()
  })
})

describe('UIDescriptionListElement — the DOM the render effect builds (ADR-0201 cl.4)', () => {
  it('one row per surviving entry: div[data-part=row] › span[data-part=label] + span[data-part=value], DOM order label → value', async () => {
    const el = mount()
    el.rows = [
      { label: 'Room', value: 'Deluxe King' },
      { label: 'Nights', value: 3 },
    ]
    await whenFlushed()
    const rows = [...el.querySelectorAll('[data-part="row"]')]
    expect(rows.length).toBe(2)
    const [first, second] = rows as HTMLElement[]
    const firstParts = [...first.children].map((c) => c.getAttribute('data-part'))
    expect(firstParts).toEqual(['label', 'value']) // reading order IS DOM order
    expect(first.querySelector('[data-part="label"]')?.textContent).toBe('Room')
    expect(first.querySelector('[data-part="value"]')?.textContent).toBe('Deluxe King')
    // the number prints via the shared Intl formatter
    expect(second.querySelector('[data-part="value"]')?.textContent).toBe(new Intl.NumberFormat().format(3))
  })

  it('the omission law holds on the PROPERTY path too (the render effect re-hardens a direct write)', async () => {
    const el = mount()
    // a direct property write bypasses the codec — the effect's own cleanDescriptionRows pass must drop these
    el.rows = [
      { label: 'Kept', value: 'yes' },
      { label: 'Empty', value: '' },
      { label: 'Absent' } as never,
      { label: 'Bool', value: true } as never,
    ]
    await whenFlushed()
    const rows = [...el.querySelectorAll('[data-part="row"]')]
    expect(rows.length).toBe(1)
    expect(rows[0]?.querySelector('[data-part="label"]')?.textContent).toBe('Kept')
  })

  it('the omission law holds on the ATTRIBUTE path (codec hardening)', async () => {
    const el = mount()
    el.setAttribute('rows', '[{"label":"Breakfast","value":"Included"},{"label":"Parking","value":null}]')
    await whenFlushed()
    expect(el.rows).toEqual([{ label: 'Breakfast', value: 'Included' }]) // the property NEVER holds the valueless row
    expect(el.querySelectorAll('[data-part="row"]').length).toBe(1)
  })

  it('a rows swap re-renders whole (whole-swap semantics); clearing renders nothing', async () => {
    const el = mount()
    el.rows = [{ label: 'A', value: '1' }]
    await whenFlushed()
    expect(el.querySelectorAll('[data-part="row"]').length).toBe(1)
    el.rows = [
      { label: 'B', value: '2' },
      { label: 'C', value: '3' },
    ]
    await whenFlushed()
    expect([...el.querySelectorAll('[data-part="label"]')].map((n) => n.textContent)).toEqual(['B', 'C'])
    el.rows = []
    await whenFlushed()
    expect(el.querySelector('[data-part="row"]')).toBeNull()
  })

  it('no heading elements, no host role attribute, no aria-* host attributes (ADR-0201 cl.5)', async () => {
    const el = mount()
    el.rows = [{ label: 'Total', value: '$412' }]
    await whenFlushed()
    expect(el.querySelector('h1,h2,h3,h4,h5,h6')).toBeNull()
    expect(el.hasAttribute('role')).toBe(false)
    expect([...el.attributes].some((a) => a.name.startsWith('aria-'))).toBe(false)
  })

  it('values render as TEXT, never markup (textContent assignment — no injection surface)', async () => {
    const el = mount()
    el.rows = [{ label: 'Note', value: '<img src=x onerror=alert(1)>' }]
    await whenFlushed()
    expect(el.querySelector('img')).toBeNull()
    expect(el.querySelector('[data-part="value"]')?.textContent).toBe('<img src=x onerror=alert(1)>')
  })
})
