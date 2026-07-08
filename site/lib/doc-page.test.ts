import { describe, it, expect } from 'vitest'
import { composeDocPage, renderPartsTable } from './doc-page.ts'
import { parseDoc, loadSparklineDoc, loadBarChartDoc, loadButtonDoc } from './frontmatter.ts'

// doc-page.test.ts — the DERIVATION gate for the descriptor `parts[]` surface (LLD-C7: a control's
// control-created interior anatomy nodes, `[data-part='X']`). A descriptor declares `parts[]` the same way it
// declares slots/events; composeDocPage's renderPartsTable is the SECOND consumer of that parse (the {name}.md
// contract trip-wire is the first), so a documented part cannot drift from the descriptor. This file PINS two
// invariants + a biting negative control:
//   • a parts-BEARING descriptor renders a "Parts" section, one row per declared part (fails if the parts leg is
//     dropped from composeDocPage — the exact gap this wave closed: parts were parsed but never rendered);
//   • a parts-LESS descriptor renders NO Parts section (fails if the table were rendered unconditionally — the
//     "no empty section" discipline the other sequence tables already follow).
// Real descriptors (sparkline/bar-chart declare parts, button declares `parts: []`) anchor the page-level legs;
// synthetic fences give the precise unit + the negative control.

/** The composed page's Parts <section> (its titled by an <h2>Parts</h2>), or undefined when none was rendered. */
function partsSection(content: HTMLElement): HTMLElement | undefined {
  return [...content.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent === 'Parts')
}

/** The first-column (`name`) code text of every body row in a rendered Parts section. */
function partNames(section: HTMLElement): string[] {
  return [...section.querySelectorAll('tbody tr')].map((tr) => tr.querySelector('code')?.textContent ?? '')
}

// A parts-bearing fence (two declared parts) and a parts-less one (`parts: []`) — the minimum descriptor pair
// that exercises both branches of the "render only when declared" rule.
const WITH_PARTS = `---
tag: ui-fixture-parts
parts:
  - name: track
    description: The decorative rail.
  - name: fill
    description: The proportional bar inside the track.
---
Body prose under the fence.`

const WITHOUT_PARTS = `---
tag: ui-fixture-bare
parts: []
---
Body prose under the fence.`

const NO_PARTS_KEY = `---
tag: ui-fixture-nokey
attributes: []
---
Body prose under the fence.`

describe('renderPartsTable — the descriptor parts[] surface', () => {
  it('renders a titled Parts table, one row per declared part, name as a code cell', () => {
    const { descriptor } = parseDoc(WITH_PARTS)
    const section = renderPartsTable(descriptor)
    expect(section).toBeDefined()
    expect(section!.querySelector('h2')?.textContent).toBe('Parts')
    expect([...section!.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Name', 'Description'])
    expect(partNames(section!)).toEqual(['track', 'fill'])
    // the description is rendered as real text derived straight from the parse (not hand-copied)
    expect(section!.textContent).toContain('The decorative rail.')
  })

  it('renders NOTHING for a parts-LESS descriptor (parts: []) — no empty Parts section', () => {
    expect(renderPartsTable(parseDoc(WITHOUT_PARTS).descriptor)).toBeUndefined()
  })

  it('renders NOTHING when the descriptor omits the parts key entirely', () => {
    expect(renderPartsTable(parseDoc(NO_PARTS_KEY).descriptor)).toBeUndefined()
  })
})

describe('composeDocPage — the parts table joins the derived-surface order', () => {
  it('a parts-bearing descriptor gets a Parts section in the composed page', () => {
    const content = document.createElement('div')
    const { descriptor, body } = parseDoc(WITH_PARTS)
    composeDocPage(content, descriptor, body)
    const section = partsSection(content)
    expect(section).toBeDefined()
    expect(partNames(section!)).toEqual(['track', 'fill'])
  })

  // The BITING negative control: if composeDocPage rendered the parts table unconditionally, this fails.
  it('a parts-LESS descriptor gets NO Parts section in the composed page', () => {
    const content = document.createElement('div')
    const { descriptor, body } = parseDoc(WITHOUT_PARTS)
    composeDocPage(content, descriptor, body)
    expect(partsSection(content)).toBeUndefined()
  })
})

describe('composeDocPage — real chart descriptors derive their declared parts', () => {
  it('ui-sparkline renders its two data-part nodes (line · area) as a Parts table', () => {
    const content = document.createElement('div')
    const { descriptor, body } = loadSparklineDoc()
    composeDocPage(content, descriptor, body)
    const section = partsSection(content)
    expect(section).toBeDefined()
    expect(partNames(section!)).toEqual(['line', 'area'])
  })

  it('ui-bar-chart renders its four data-part nodes (label · track · fill · value) as a Parts table', () => {
    const content = document.createElement('div')
    const { descriptor, body } = loadBarChartDoc()
    composeDocPage(content, descriptor, body)
    const section = partsSection(content)
    expect(section).toBeDefined()
    expect(partNames(section!)).toEqual(['label', 'track', 'fill', 'value'])
  })

  // button.md declares `parts: []` — the real part-less control; its page must ship no Parts section.
  it('ui-button (parts: []) renders NO Parts section', () => {
    const content = document.createElement('div')
    const { descriptor, body } = loadButtonDoc()
    composeDocPage(content, descriptor, body)
    expect(partsSection(content)).toBeUndefined()
  })
})
