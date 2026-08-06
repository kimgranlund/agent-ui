import { describe, it, expect } from 'vitest'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToSource,
  collectUsedStates,
  collectStyledSlots,
  scalarSeq,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// table.md descriptor — structural + contract<->source (LLD-C9, report-family.lld.md §5). The
// contract<->props layer (the former "bar-chart/text three-layer pattern"'s middle leg) RETIRED here
// (ADR-0173 cl.4c/OF4): table.ts's `static props` now IMPORTS `table.props.gen.ts`, itself GENERATED from
// this same table.md (including its 5 `codec:`-referenced bespoke props — columns/rows/selected/sort/filter,
// OF1) — the bijection is structurally true by construction. The replacement drift gate — regenerating
// in-memory and diffing against the committed generated file — lives fleet-wide in
// `descriptor/props-gen-driftwire.test.ts` (table's entry lands in the SAME commit as this retirement).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/table`
const md = readFileSync(`${DIR}/table.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/table.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/table.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = [
  'columns', 'rows', 'label', 'selectable', 'rowKey', 'selected', 'sort', 'search', 'filter', 'pageSize', 'page',
]

describe('table.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-table')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-table, extends=UIElement, tier=display, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-table\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    // anti-vacuous: all three attributes parse before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('SPEC-R17 AC2: no [size]/[scale] selector in table.css and no `size`/`scale` attribute declared', () => {
    // Display class takes no [size]/[scale] geometry row — the family-coherence A2b invariant (the inverse
    // of A2) would catch a CSS [size] selector with no backing attribute; this folder-local leg asserts the
    // SAME fact directly, without importing that fleet-wide test file.
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(/\[size\b/.test(bare)).toBe(false)
    expect(/\[scale\b/.test(bare)).toBe(false)
    expect(parsed.attributes.some((a) => a.name === 'size')).toBe(false)
  })

  it('no --md-sys-height-* declaration/consumption anywhere (Display class has no control-height lever)', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(bare).not.toMatch(/--md-sys-height-/)
  })
})

describe('table.md descriptor — ADR-0163 events/parts', () => {
  it('events declares exactly select + change, both from the §4 vocabulary', () => {
    const names = (parsed.sequences.get('events') ?? []).map((e) => e.get('name'))
    expect(names).toEqual(['select', 'change'])
  })

  it('parts declares the widened anatomy (selection/sort/footer/pagination) alongside the original scroll/table/caption/thead/tbody', () => {
    const names = new Set((parsed.sequences.get('parts') ?? []).map((p) => p.get('name')))
    for (const part of [
      'scroll', 'table', 'caption', 'thead', 'tbody',
      'select-header', 'select-all', 'sort-button', 'select-cell', 'select', 'footer', 'pagination',
    ]) {
      expect(names.has(part), `missing part: ${part}`).toBe(true)
    }
  })
})

describe('table.ts — event DELEGATION, never a per-stamped-node listener (component-checker retained-listener finding)', () => {
  it('the per-node builder methods (#bodyRow/#headerCell/#selectAllHeaderCell) attach NO listener of their own', () => {
    // A structural pin against regressing back to a per-node `this.listen(input, …)`/`this.listen(button, …)`
    // inside the methods that run on EVERY rebuild (VIEW reruns on every search keystroke/page turn/
    // selection toggle) — the exact shape that stranded a fresh closure+listener on every discarded
    // rebuild. Scoped to the #bodyRow/#headerCell/#selectAllHeaderCell method bodies specifically (not the
    // whole file — `connected()`'s three DELEGATED listeners legitimately call `this.listen` once each).
    const methodBody = (name: string): string => {
      // the DEFINITION only (`\n  #name(`, class-method indent) — NOT a `this.#name(…)` CALL site, which
      // can appear earlier in the file (e.g. VIEW calls `this.#bodyRow(…)` well before `#bodyRow`'s own
      // definition) and would otherwise be found first by a bare `#name(` search.
      const start = ts.indexOf(`\n  #${name}(`)
      expect(start, `#${name} definition not found in table.ts`).toBeGreaterThan(-1)
      const nextMethodStart = ts.indexOf('\n  #', start + 1) // the next `  #method(` at the SAME indent level
      return ts.slice(start, nextMethodStart === -1 ? ts.length : nextMethodStart)
    }
    for (const name of ['bodyRow', 'headerCell', 'selectAllHeaderCell']) {
      const body = methodBody(name)
      expect(body, `#${name} regressed to a per-node this.listen(`).not.toMatch(/this\.listen\(/)
    }
  })

  it('connected() registers exactly the two delegated listeners (#thead click + #table change), each exactly once', () => {
    // GH #455 (size diet): the select-all change (was on #thead) and the row-selection change (was on
    // #tbody) merged into ONE `change` listener on `#table` — a stable skeleton node itself that wraps
    // BOTH #thead and #tbody, so either input's `change` bubbles to it identically to the two-listener
    // shape this test used to pin. Behavior unchanged (table-interactive.browser.test.ts), listener count
    // one fewer.
    expect([...ts.matchAll(/this\.listen\(this\.#thead,/g)]).toHaveLength(1) // sort-button click
    expect([...ts.matchAll(/this\.listen\(this\.#table,/g)]).toHaveLength(1) // select-all + row-selection change
  })
})

describe('table.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about table.ts + table.css (0 source-drift)', () => {
    // ui-table has NO custom states (no :state() — a Display leaf has nothing to transition) and NO
    // [slot=...]-styled slots (every node is component-built via replaceChildren/insertBefore, never
    // author-slotted — the rows/header use real table elements + [data-part='scroll'], a different
    // selector namespace collectStyledSlots does not match).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real ui-table code"
    const result = compareDescriptorToSource(parsed, { ts: syntheticTs, css })
    expect(result).toContainEqual(expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }))
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }))
  })
})
