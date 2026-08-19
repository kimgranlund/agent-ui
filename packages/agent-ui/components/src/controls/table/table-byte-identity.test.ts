import { describe, it, expect, afterEach } from 'vitest'
import { UITableElement } from './table.ts'
import { TABLE_BASELINE } from './table-baseline.fixture.ts'
import '../checkbox/checkbox.ts'

// table-byte-identity.test.ts — the SPEC-R2 / ADR-0163 cl.10 migration proof: "with every capability at its
// default (off) value, the rendered DOM is byte-identical to the pre-widening control." Builds the SAME three
// cases the fixture was captured from (table-baseline.fixture.ts, frozen from commit d6a93cb — the last
// pre-widening table.ts), in the SAME order, leaving every new capability prop at its default: `selectable=''`,
// no `sortable`/`searchable` column overrides, `page-size=0`, `search=''`, `filter=[]`. `outerHTML` equality
// is the byte-identity assertion proper — anything the widening stamped unconditionally (a selection column,
// a sort button, a footer) would show up here as a diff.
//
// jsdom reality (the checkbox.test.ts/indicator-element.test.ts precedent, `stubFormAssoc`): the
// ElementInternals form-association surface (setFormValue/setValidity) is ABSENT in jsdom. Every existing
// form-associated-control jsdom test stubs its OWN constructed instance's internals before connecting — but
// the ADR-0163 amendment (GH #1445) test below connects a `ui-table` whose `selectable='multi'` INTERNALLY
// constructs a composed `ui-checkbox` this file never gets a handle to before it connects. `ElementInternals`
// is one shared prototype across this file's jsdom `window`, so the fix generalizes one level: patch the
// PROTOTYPE once (guarded, same `typeof … !== 'function'` check every per-instance stub already uses) rather
// than a per-instance object this file cannot reach in time.
if (typeof (ElementInternals.prototype as unknown as Record<string, unknown>)['setFormValue'] !== 'function') {
  const proto = ElementInternals.prototype as unknown as Record<string, unknown>
  proto['setFormValue'] = (): void => {}
  proto['setValidity'] = (): void => {}
}

const mounted: HTMLElement[] = []
function mount(el: HTMLElement): HTMLElement {
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('ui-table — byte-identity at defaults (SPEC-R2, ADR-0163 cl.10)', () => {
  it('labeled table with two columns (one number) and two rows — outerHTML matches the frozen pre-widening baseline', () => {
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
    expect(el.outerHTML).toBe(TABLE_BASELINE.withData)
  })

  it('a bare, empty table — outerHTML matches the frozen pre-widening baseline', () => {
    const el = new UITableElement()
    mount(el)
    expect(el.outerHTML).toBe(TABLE_BASELINE.empty)
  })

  it('an unlabeled, single-column table — outerHTML matches the frozen pre-widening baseline', () => {
    const el = new UITableElement()
    el.columns = [{ key: 'a', label: 'A', type: 'string' }]
    el.rows = [{ a: 1 }]
    mount(el)
    expect(el.outerHTML).toBe(TABLE_BASELINE.noLabel)
  })

  it('every new capability prop actually defaults to its documented off value (anti-vacuous)', () => {
    const el = new UITableElement()
    expect(el.selectable).toBe('')
    expect(el.rowKey).toBe('')
    expect(el.selected).toEqual([])
    expect(el.sort).toBeNull()
    expect(el.search).toBe('')
    expect(el.filter).toEqual([])
    expect(el.pageSize).toBe(0)
    expect(el.page).toBe(1)
  })

  it('NEGATIVE control: turning on selectable actually changes the DOM (the probe above is not vacuous)', () => {
    const el = new UITableElement()
    el.columns = [{ key: 'a', label: 'A', type: 'string' }]
    el.rows = [{ a: 1 }]
    el.selectable = 'multi'
    mount(el)
    expect(el.outerHTML).not.toBe(TABLE_BASELINE.noLabel)
  })
})
