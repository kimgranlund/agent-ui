import { describe, it, expect, afterEach } from 'vitest'
import { UITableElement } from './table.ts'

// table.test.ts — jsdom behaviour probes (LLD-C2, report-family.lld.md §2; SPEC-R1…R6). jsdom is blind to
// painted geometry/scroll (SPEC-N2) — the scroll-preservation/overflow/RTL/WHCM legs are
// table.browser.test.ts's job. This file covers: prop typing/defaults, the stamped DOM shape, the
// SPEC-R3 value-degeneracy strip, node-identity across rows-only/columns/label updates, NO host ARIA
// (SPEC-R6 AC2), and zero residue across connect/disconnect.

// A throwaway subclass re-exposing the protected `internals` (the bar-chart/icon precedent), so a probe
// can prove ElementInternals is NEVER touched (SPEC-R6 — native <table> semantics carry it).
class ProbeTable extends UITableElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-table-probe', ProbeTable)

const mounted: HTMLElement[] = []
function mount(el: HTMLElement): HTMLElement {
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('UITableElement — upgrade + typed props', () => {
  it('upgrades to the class; columns/rows default to [], label defaults to empty string', () => {
    const el = document.createElement('ui-table') as UITableElement
    expect(el).toBeInstanceOf(UITableElement)
    expect(el.columns).toEqual([])
    expect(el.rows).toEqual([])
    expect(el.label).toBe('')
  })

  it('self-defines as ui-table, guarded against double-define', () => {
    expect(customElements.get('ui-table')).toBe(UITableElement)
    expect(() => {
      if (!customElements.get('ui-table')) customElements.define('ui-table', UITableElement)
    }).not.toThrow()
  })

  it('JSON `columns`/`rows` attributes parse to the typed arrays on connect (the ADR-0111 cl.2 example)', () => {
    const el = document.createElement('ui-table') as UITableElement
    el.setAttribute('columns', JSON.stringify([{ key: 'region', label: 'Region' }, { key: 'revenue', label: 'Revenue', type: 'number' }]))
    el.setAttribute('rows', JSON.stringify([{ region: 'EMEA', revenue: 42000 }, { region: 'APAC', revenue: 31000 }]))
    mount(el)
    expect(el.columns).toEqual([
      { key: 'region', label: 'Region', type: 'string' },
      { key: 'revenue', label: 'Revenue', type: 'number' },
    ])
    expect(el.rows).toEqual([
      { region: 'EMEA', revenue: 42000 },
      { region: 'APAC', revenue: 31000 },
    ])
  })

  it('malformed `columns`/`rows` attribute JSON never throws — falls back to [] (SPEC-R1 AC3)', () => {
    const el = document.createElement('ui-table') as UITableElement
    expect(() => el.setAttribute('columns', 'not json')).not.toThrow()
    expect(() => el.setAttribute('rows', '{also not json')).not.toThrow()
    mount(el)
    expect(el.columns).toEqual([])
    expect(el.rows).toEqual([])
  })
})

describe('UITableElement — the native <table> stamp (SPEC-R2 AC1)', () => {
  it('two columns (one type="number") + two rows renders caption? + thead>tr>th[scope=col]x2 + tbody>tr x2 > td x2', () => {
    const el = new UITableElement()
    el.label = 'Revenue by region'
    el.columns = [
      { key: 'region', label: 'Region', type: 'string' },
      { key: 'revenue', label: 'Revenue', type: 'number' },
    ]
    el.rows = [
      { region: 'EMEA', revenue: 42000 },
      { region: 'APAC', revenue: 31000 },
    ]
    mount(el)
    const table = el.querySelector('table')
    expect(table).not.toBeNull()
    expect(el.querySelector('caption')?.textContent).toBe('Revenue by region')
    const ths = el.querySelectorAll('thead th')
    expect(ths).toHaveLength(2)
    for (const th of ths) expect(th.getAttribute('scope')).toBe('col')
    expect(ths[0].textContent).toBe('Region')
    expect(ths[1].textContent).toBe('Revenue')
    expect(ths[0].hasAttribute('data-type')).toBe(false)
    expect(ths[1].getAttribute('data-type')).toBe('number')
    const rows = el.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(2)
    for (const row of rows) expect(row.querySelectorAll('td')).toHaveLength(2)
  })

  it('number cells are Intl-formatted with data-type="number"; string cells are plain, no data-type', () => {
    const el = new UITableElement()
    el.columns = [
      { key: 'region', label: 'Region', type: 'string' },
      { key: 'revenue', label: 'Revenue', type: 'number' },
    ]
    el.rows = [{ region: 'EMEA', revenue: 42000 }]
    mount(el)
    const cells = el.querySelectorAll('tbody td')
    expect(cells[0].textContent).toBe('EMEA')
    expect(cells[0].hasAttribute('data-type')).toBe(false)
    expect(cells[1].textContent).toBe(new Intl.NumberFormat().format(42000))
    expect(cells[1].getAttribute('data-type')).toBe('number')
  })

  it('the SPEC-R3 AC2 four-cell strip over a number column: [42000, "n/a", NaN, null]', () => {
    const el = new UITableElement()
    el.columns = [{ key: 'v', label: 'V', type: 'number' }]
    el.rows = [{ v: 42000 }, { v: 'n/a' }, { v: Number.NaN }, { v: null }]
    mount(el)
    const cells = [...el.querySelectorAll('tbody td')]
    expect(cells.map((c) => c.textContent)).toEqual([new Intl.NumberFormat().format(42000), 'n/a', '—', ''])
    for (const c of cells) expect(c.getAttribute('data-type')).toBe('number') // alignment is column-driven, regardless of cell value
  })
})

describe('UITableElement — degenerate columns/rows (SPEC-R3 rows 1/2)', () => {
  it('empty columns → no table is stamped (empty scroll container); the host renders no <table>', () => {
    const el = mount(new UITableElement()) as UITableElement
    expect(el.querySelector('table')).toBeNull()
    expect(el.querySelector('[data-part="scroll"]')).not.toBeNull() // the scroll container still exists
  })

  it('valid columns, zero rows → caption + thead render; tbody is empty (the honest empty state)', () => {
    const el = new UITableElement()
    el.label = 'Empty'
    el.columns = [{ key: 'a', label: 'A', type: 'string' }]
    mount(el)
    expect(el.querySelector('caption')?.textContent).toBe('Empty')
    expect(el.querySelectorAll('thead th')).toHaveLength(1)
    expect(el.querySelectorAll('tbody tr')).toHaveLength(0)
  })

  it('a property write of mixed garbage columns/rows never reaches the render path (SPEC-R3 case-3 sibling rule)', () => {
    const el = new UITableElement()
    // @ts-expect-error — deliberately garbage at the property boundary, exactly what cleanColumns must guard
    el.columns = [{ key: 'ok', label: 'OK' }, { key: 'bad' }, null, 42]
    // @ts-expect-error — deliberately garbage at the property boundary, exactly what cleanRows must guard
    el.rows = [{ ok: 1 }, null, 'garbage', ['x']]
    mount(el)
    expect(el.querySelectorAll('thead th')).toHaveLength(1)
    expect(el.querySelectorAll('tbody tr')).toHaveLength(1)
  })

  it('a non-array property write (e.g. null) never throws and renders no table', () => {
    const el = new UITableElement()
    // @ts-expect-error — a non-array write, the codec's inbound counterpart (property path, not attribute)
    expect(() => (el.columns = null)).not.toThrow()
    mount(el)
    expect(el.querySelector('table')).toBeNull()
  })
})

describe('UITableElement — the re-render contract: node identity (SPEC-R4.3)', () => {
  it('a rows-only update leaves <table>/<thead> node identity untouched; only <tbody> content rebuilds', async () => {
    const el = new UITableElement()
    el.columns = [{ key: 'v', label: 'V' }]
    el.rows = [{ v: 1 }]
    mount(el)
    const table = el.querySelector('table')
    const thead = el.querySelector('thead')
    const headerRow = el.querySelector('thead tr')

    el.rows = [{ v: 2 }, { v: 3 }] // rows-only — columns unchanged
    await el.updateComplete

    expect(el.querySelector('table')).toBe(table)
    expect(el.querySelector('thead')).toBe(thead)
    expect(el.querySelector('thead tr')).toBe(headerRow) // the header row itself was never rebuilt
    expect(el.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  it('an ORDINARY disconnect/reconnect keeps the WHOLE skeleton — scroll/table/thead/tbody node identity survives (TKT-0067 regression)', async () => {
    // The bug this pins: connected() previously rebuilt the skeleton unconditionally on EVERY connect,
    // discarding the prior nodes — and with them the scroll offset SPEC-R4.1 claims "survives by
    // omission" (jsdom has no layout, so scrollLeft itself is the browser leg's job; node identity is
    // the jsdom-provable half — the same nodes ⇒ the same live scroll state in a real engine).
    const el = new UITableElement()
    el.columns = [{ key: 'v', label: 'V' }]
    el.rows = [{ v: 1 }]
    mount(el)
    const scroll = el.querySelector('[data-part="scroll"]')
    const table = el.querySelector('table')
    const thead = el.querySelector('thead')
    const tbody = el.querySelector('tbody')

    el.remove() // an ordinary detach — NOT moveBefore
    document.body.append(el) // reconnect — connected() re-runs; the guard must NOT rebuild
    await el.updateComplete

    expect(el.querySelector('[data-part="scroll"]'), 'the scroll region was re-minted on reconnect').toBe(scroll)
    expect(el.querySelector('table'), 'the <table> was re-minted on reconnect').toBe(table)
    expect(el.querySelector('thead')).toBe(thead)
    expect(el.querySelector('tbody')).toBe(tbody)
    expect(el.querySelectorAll('[data-part="scroll"]'), 'a second scroll region appeared').toHaveLength(1)
    el.remove()
  })

  it('a columns change rebuilds the header row (thead content, not the thead ELEMENT itself)', async () => {
    const el = new UITableElement()
    el.columns = [{ key: 'a', label: 'A' }]
    el.rows = [{ a: 1 }]
    mount(el)
    const thead = el.querySelector('thead')
    const table = el.querySelector('table')

    el.columns = [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]
    await el.updateComplete

    expect(el.querySelector('table')).toBe(table) // the <table> element itself persists
    expect(el.querySelector('thead')).toBe(thead) // the <thead> element itself persists
    expect(el.querySelectorAll('thead th')).toHaveLength(2) // its CONTENT rebuilt
  })

  it('a label change touches only the <caption> — thead/tbody are untouched', async () => {
    const el = new UITableElement()
    el.columns = [{ key: 'a', label: 'A' }]
    el.rows = [{ a: 1 }]
    el.label = 'First'
    mount(el)
    const thead = el.querySelector('thead')
    const tbody = el.querySelector('tbody')
    const headerRow = el.querySelector('thead tr')
    const bodyRow = el.querySelector('tbody tr')

    el.label = 'Second'
    await el.updateComplete

    expect(el.querySelector('caption')?.textContent).toBe('Second')
    expect(el.querySelector('thead')).toBe(thead)
    expect(el.querySelector('tbody')).toBe(tbody)
    expect(el.querySelector('thead tr')).toBe(headerRow)
    expect(el.querySelector('tbody tr')).toBe(bodyRow)
  })

  it('clearing the label removes the caption and the scroll region aria-labelledby', async () => {
    const el = new UITableElement()
    el.columns = [{ key: 'a', label: 'A' }]
    el.label = 'Has a name'
    mount(el)
    const scroll = el.querySelector('[data-part="scroll"]') as HTMLElement
    expect(el.querySelector('caption')).not.toBeNull()
    expect(scroll.getAttribute('aria-labelledby')).toBe(el.querySelector('caption')?.id)

    el.label = ''
    await el.updateComplete
    expect(el.querySelector('caption')).toBeNull()
    expect(scroll.hasAttribute('aria-labelledby')).toBe(false)
  })

  it('the scroll container node identity persists across a columns AND a rows update', async () => {
    const el = new UITableElement()
    el.columns = [{ key: 'a', label: 'A' }]
    el.rows = [{ a: 1 }]
    mount(el)
    const scroll = el.querySelector('[data-part="scroll"]')

    el.columns = [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]
    el.rows = [{ a: 1, b: 2 }]
    await el.updateComplete

    expect(el.querySelector('[data-part="scroll"]')).toBe(scroll)
  })

  it('the empty↔non-empty columns transition re-attaches the SAME <table> node, never a fresh one', async () => {
    const el = new UITableElement()
    el.columns = [{ key: 'a', label: 'A' }]
    mount(el)
    const table = el.querySelector('table')
    expect(table).not.toBeNull()

    el.columns = [] // detach
    await el.updateComplete
    expect(el.querySelector('table')).toBeNull()

    el.columns = [{ key: 'a', label: 'A' }] // reattach
    await el.updateComplete
    expect(el.querySelector('table')).toBe(table) // the SAME node, never re-created
  })
})

describe('UITableElement — the interior scroll region (SPEC-R5 AC2)', () => {
  it('the scroll container carries role=region + tabindex=0', () => {
    const el = mount(new UITableElement()) as UITableElement
    const scroll = el.querySelector('[data-part="scroll"]') as HTMLElement
    expect(scroll.getAttribute('role')).toBe('region')
    expect(scroll.getAttribute('tabindex')).toBe('0')
  })

  it('an unlabeled table yields an unnamed scroll region — accepted residual, not a violation', () => {
    const el = mount(new UITableElement()) as UITableElement
    const scroll = el.querySelector('[data-part="scroll"]') as HTMLElement
    expect(scroll.hasAttribute('aria-labelledby')).toBe(false)
  })
})

describe('UITableElement — NO host ARIA at all (SPEC-R6 AC2)', () => {
  it('internals.role stays null and no host role/aria-* attribute appears, even with a label + rendered rows', () => {
    const el = mount(new ProbeTable()) as ProbeTable
    el.label = 'Revenue by region'
    el.columns = [{ key: 'a', label: 'A' }]
    el.rows = [{ a: 1 }]
    expect(el.probeInternals.role).toBeNull()
    expect(el.getAttribute('role')).toBeNull()
    expect(el.hasAttribute('aria-label')).toBe(false)
    expect(el.hasAttribute('aria-labelledby')).toBe(false)
  })
})

describe('UITableElement — zero residue across connect/disconnect', () => {
  it('effects die on disconnect; reconnect re-installs exactly once (not stacked)', async () => {
    const el = mount(new ProbeTable()) as ProbeTable
    el.columns = [{ key: 'a', label: 'A' }]
    el.rows = [{ a: 1 }]
    await el.updateComplete
    expect(el.querySelectorAll('tbody tr')).toHaveLength(1)

    el.remove() // disconnect → the connection scope is disposed → all three effects die with it
    el.rows = [{ a: 1 }, { a: 2 }] // mutate WHILE disconnected
    el.label = 'Later'
    await el.updateComplete // give any leaked effect a chance to flush

    document.body.append(el) // reconnect → connected() re-runs → exactly one fresh skeleton + effect triple
    await el.updateComplete
    expect(el.querySelectorAll('tbody tr')).toHaveLength(2) // re-applied from the now-current data
    expect(el.querySelector('caption')?.textContent).toBe('Later')
    expect(el.probeInternals.role).toBeNull()
    el.remove()
  })
})
