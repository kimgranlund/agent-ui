import { describe, it, expect } from 'vitest'
import { composeDocPage, renderMarkdownBody, renderPartsTable } from './doc-page.ts'
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

  // button.md declares `parts: []` — the real part-less control; its page must ship no Parts section.
  it('ui-button (parts: []) renders NO Parts section', () => {
    const content = document.createElement('div')
    const { descriptor, body } = loadButtonDoc()
    composeDocPage(content, descriptor, body)
    expect(partsSection(content)).toBeUndefined()
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
