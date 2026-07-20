import { describe, it, expect } from 'vitest'
import { composeDocPage, renderApiTable, renderMarkdownBody, renderPartsTable } from './doc-page.ts'
import { parseDoc, loadSparklineDoc, loadBarChartDoc, loadButtonDoc, loadCardDoc } from './frontmatter.ts'

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
//
// Rows render as Form-B (TKT-0033: `.api-row` name-rail + flowing detail, not a `<table>`) — the helpers below
// read that shape (`.api-row`/`.api-row-name code`/`.api-row-description`) rather than `<table>`/`<tr>`/`<td>`.

/** The composed page's Parts <section> (its titled by an <h2>Parts</h2>), or undefined when none was rendered. */
function partsSection(content: HTMLElement): HTMLElement | undefined {
  return [...content.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent === 'Parts')
}

/** The name-rail code text of every Form-B row in a rendered Parts section. */
function partNames(section: HTMLElement): string[] {
  return [...section.querySelectorAll('.api-row')].map((row) => row.querySelector('.api-row-name code')?.textContent ?? '')
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
    expect(partNames(section!)).toEqual(['track', 'fill'])
    // the description is rendered as real text derived straight from the parse (not hand-copied), in the
    // Form-B row's prose paragraph — not a table cell
    expect([...section!.querySelectorAll('.api-row-description')].map((p) => p.textContent)).toEqual([
      'The decorative rail.',
      'The proportional bar inside the track.',
    ])
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

  // button.md declares one part (ADR-0133's label wrapper) and button-doc.ts renders it via
  // renderPartsTable directly (it is hand-authored, not composeDocPage) — this pins the parse AND the
  // render the same way the sparkline/bar-chart legs above do.
  it('ui-button (1 part, ADR-0133) renders its label-wrapper part as a Parts table', () => {
    const content = document.createElement('div')
    const { descriptor } = loadButtonDoc()
    const section = renderPartsTable(descriptor)
    expect(section).toBeDefined()
    expect(partNames(section!)).toEqual(['label'])
    content.append(section!) // exercise the DOM attach path too, matching the other real-descriptor legs
  })
})

// ── renderApiTable — enum chip DISPLAY order (GH #92) ───────────────────────────────────────────────────────
// A numeric enum's descriptor `values[]` is declared FALLBACK-FIRST (container.ts's `SURFACE_STEPS`, index 0
// = the live snap target for an out-of-range attribute — order-significant to the component-descriptor drift
// trip-wire's `enumMembersMatch`, which this file never touches). The docs table wants ascending numeric order
// regardless (a reader scans a signed axis left to right) — `apiChipset`'s `sortedForDisplay` sorts a COPY for
// rendering only. This pins: the chip text itself now reads ascending on the real ui-card corpus (whose
// elevation/brightness `values:` are declared `[0, 1, 2, 3, -1, -2, -3]`, exactly the reported bug shape), a
// non-numeric enum stays untouched (word enums have no natural numeric reading), and a signed-single-digit
// synthetic fence proves the general case beyond the one real corpus shape.

/** The Type field's chip text, in DOM order, for the row named `name` — or undefined if no such row. */
function chipTexts(section: HTMLElement, name: string): string[] | undefined {
  const row = [...section.querySelectorAll('.api-row')].find((r) => r.querySelector('.api-row-name code')?.textContent === name)
  const chips = row?.querySelectorAll('.api-chipset .api-chip')
  return chips ? [...chips].map((c) => c.textContent ?? '') : undefined
}

describe('renderApiTable — numeric enum chips render ASCENDING, not declaration order (GH #92)', () => {
  it('ui-card (real corpus): elevation/brightness — declared [0,1,2,3,-1,-2,-3] — render as -3…3', () => {
    const { descriptor } = loadCardDoc()
    const section = renderApiTable(descriptor.attributes)
    expect(chipTexts(section, 'elevation')).toEqual(['-3', '-2', '-1', '0', '1', '2', '3'])
    expect(chipTexts(section, 'brightness')).toEqual(['-3', '-2', '-1', '0', '1', '2', '3'])
  })

  it('a synthetic signed-numeric enum sorts ascending regardless of declared order', () => {
    const doc = parseDoc(`---
tag: ui-fixture-enum
attributes:
  - name: step
    type: enum
    values: [2, 0, -1, 1, -2]
    default: 0
---
Body.`)
    const section = renderApiTable(doc.descriptor.attributes)
    expect(chipTexts(section, 'step')).toEqual(['-2', '-1', '0', '1', '2'])
  })

  it('a non-numeric (word) enum is left in its declared order — sorting it has no natural reading', () => {
    const doc = parseDoc(`---
tag: ui-fixture-word-enum
attributes:
  - name: align
    type: enum
    values: [start, center, end, stretch, baseline]
    default: start
---
Body.`)
    const section = renderApiTable(doc.descriptor.attributes)
    expect(chipTexts(section, 'align')).toEqual(['start', 'center', 'end', 'stretch', 'baseline'])
  })
})

// ── renderMarkdownBody — the TKT-0036 prose reading design ─────────────────────────────────────────────────
// The DISPLAY-plane build: the `.doc-body` wrapper class the CSS keys on (measure/typescale/chip-split/quote
// all scoped to it, doc-page.css), and the new `>`-blockquote construct the tiny parser now supports. These
// pin the two things a test CAN decide about a display design: the structural hook the CSS depends on exists,
// and the parser change is correct (including its biting negative control — a fenced `>` stays literal code).

describe('renderMarkdownBody — the .doc-body wrapper (the reading-design CSS hook)', () => {
  it('returns an <article class="doc-body"> — the class site/lib/doc-page.css scopes every prose rule to', () => {
    const article = renderMarkdownBody('Just one paragraph.')
    expect(article.tagName).toBe('ARTICLE')
    expect(article.classList.contains('doc-body')).toBe(true)
  })
})

describe('renderMarkdownBody — blockquote parsing (TKT-0036: the card.md `>` decision-log convention)', () => {
  it('a contiguous `>` line run renders ONE <blockquote> with the joined, inline-parsed text', () => {
    const src = [
      '> **The HOLD:** the gradient fully occludes through the band, by design — the ramp',
      '> starts at the `--ui-box-head-hold` offset, not at the edge.',
      '',
      'An ordinary paragraph after the aside.',
    ].join('\n')
    const article = renderMarkdownBody(src)
    const quotes = article.querySelectorAll('blockquote')
    expect(quotes).toHaveLength(1)
    // the two `>` lines join as ONE block (space-joined, matching a wrapped paragraph's own line-join rule)
    expect(quotes[0].textContent).toBe(
      'The HOLD: the gradient fully occludes through the band, by design — the ramp starts at the --ui-box-head-hold offset, not at the edge.',
    )
    // inline markdown inside the quote is still parsed (bold + code), same grammar as a paragraph
    expect(quotes[0].querySelector('strong')?.textContent).toBe('The HOLD:')
    expect(quotes[0].querySelector('code')?.textContent).toBe('--ui-box-head-hold')
    // the trailing paragraph renders as an ordinary <p>, not folded into the quote
    expect(article.querySelectorAll('p')).toHaveLength(1)
    expect(article.querySelector('p')?.textContent).toBe('An ordinary paragraph after the aside.')
  })

  it('two `>` runs separated by a blank line render as TWO separate blockquotes', () => {
    const src = ['> First aside.', '> still first.', '', '> Second aside.'].join('\n')
    const article = renderMarkdownBody(src)
    const quotes = [...article.querySelectorAll('blockquote')]
    expect(quotes).toHaveLength(2)
    expect(quotes[0].textContent).toBe('First aside. still first.')
    expect(quotes[1].textContent).toBe('Second aside.')
  })

  // The BITING negative control: a `>` line inside a fenced code block must stay literal CODE text, never
  // get parsed as a blockquote — the fence-consuming inner loop must run before the blockquote regex ever
  // sees that line. Fails if blockquote detection were hoisted above (or run independent of) fence handling.
  it('a lone `>` inside a fenced code block is NOT parsed as a blockquote', () => {
    const src = ['```', '> not a quote — a diff/heredoc marker inside the fence', '```'].join('\n')
    const article = renderMarkdownBody(src)
    expect(article.querySelectorAll('blockquote')).toHaveLength(0)
    const code = article.querySelector('.code-block code')
    expect(code?.textContent).toBe('> not a quote — a diff/heredoc marker inside the fence')
  })

  it('card.md — the real corpus: its two decision-log asides render as two <blockquote> elements', () => {
    const { body } = loadCardDoc()
    const article = renderMarkdownBody(body)
    const quotes = article.querySelectorAll('blockquote')
    expect(quotes.length).toBe(2)
    expect(quotes[0].textContent).toMatch(/^Why this keeps the running mid-scroll fade/)
    expect(quotes[1].textContent).toMatch(/^The HOLD/)
  })
})
