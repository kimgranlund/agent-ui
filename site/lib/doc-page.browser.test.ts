import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
// The GLOBAL inline-code chip rule lives in the page sheet (`_page.css`'s `code { … }`); `doc-page.ts`
// imports its OWN `doc-page.css` on import, below. Both are needed: the two GH #369 mechanisms live one in
// each file, and the whole point is that they compose on a real page.
import '../pages/_page.css'
import { renderApiTable, renderEventsTable, renderMarkdownBody } from './doc-page.ts'
import { parseDoc } from './frontmatter.ts'

// doc-page.browser.test.ts — the standing trip-wire for GH #369, the docs-site API-table chip contract.
// A REAL browser file, never jsdom: both facts are RESOLVED LAYOUT + RESOLVED CASCADE (a flex item's
// cross-axis size, and a computed `font-weight` inherited-or-not through a bolded ancestor). jsdom models
// neither — it reports 0-width boxes and would pass vacuously in both directions.
//
// The two mechanisms this pins, both measured on the real page before the fix (button-doc.html, Chromium
// 1400x1000) and both previously guarded by NOTHING (`grep fontWeight site/` returned zero matches):
//
//  (a) THE CHIP HUG. `.api-field` is a COLUMN FLEX, so its default cross-axis `stretch` sized every `code`
//      chip to the width of its widest sibling — the uppercase `.api-field-label` above it. Measured: the
//      `md` chip under "DEFAULT" rendered 50.73px wide around 14.72px of text, byte-identical to its
//      label's 50.73px. `align-items: flex-start` (doc-page.css) is the fix. This leg is RED-THEN-GREEN
//      PROVEN: with that one line reverted, `chipWidth < labelWidth` fails on both engines (measured
//      2026-07-30 — the chip snaps back to exactly the label's width), and passes with it restored.
//      GH #881 RETARGET: the Attributes table (the ORIGINAL site of this measurement, button-doc's `size`
//      row) no longer uses `.api-field` at all — it renders a real shared-column-track grid instead
//      (doc-page.ts's `attributeRow`), so `.api-field`/`.api-field-label` don't exist there anymore. The
//      mechanism itself is still live for the sibling sequence tables that keep the flowing Form-B design
//      (Events' "Detail" column is the one surviving `.api-field` consumer, per `renderEventsTable`), so
//      this leg now measures a synthetic Events fixture instead of `renderApiTable`'s `size` attribute.
//
//  (b) THE CHIP WEIGHT. Kim's ruling: "mono font weight should be 400". The global rule declared no
//      `font-weight`, so a chip inherited one from a bolded ancestor (measured: three `strong > code`
//      spans at 700 in button-doc's slots prose), and `.api-row-name code` deliberately carried 650. Both
//      are 400 now; this asserts it at BOTH sites, because they fail independently — the global
//      declaration fixes the inherited case, and only the more-specific rule fixes the name rail.
//
// Every assertion is a synchronous layout/style read (no rAF, no real-input driver), so this file is
// deliberately NOT a GH #347 REAL-TIMING member — see that class's definition in vitest.browser.config.ts.

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/** A realistic page column — the `.api-row` grid is `minmax(9rem, 13rem) 1fr`, so a too-narrow host would
 *  collapse the meta strip and make a width comparison meaningless. 900px is a normal docs reading column. */
function mount(node: HTMLElement): HTMLElement {
  const host = document.createElement('div')
  host.style.inlineSize = '900px'
  host.append(node)
  document.body.append(host)
  mounted.push(host)
  return host
}

/** The rendered width of an element's own TEXT (not its box) — a Range over its contents. */
function textWidth(el: Element): number {
  const range = document.createRange()
  range.selectNodeContents(el)
  return range.getBoundingClientRect().width
}

// GH #881 retarget: a synthetic Events fixture with a deliberately SHORT `detail` value ("x") under the
// wider "DETAIL" label — the same shape Kim's original report measured (a short value, a wider uppercase
// label), now on the one sequence-table column that still renders through `.api-field`.
const CHIP_HUG_FENCE = `---
tag: ui-fixture-chip-hug
events:
  - name: ping
    detail: 'x'
    description: A fixture event for the GH #369 chip-hug regression, retargeted onto Events post GH #881.
---
Body.`

// Kim's original reported row (button-doc's `size` attribute — a short `default` ("md") under a wider
// "DEFAULT" label): still the fixture for the font-weight leg below, which reads `.api-row-name code`
// directly (a structural hook the GH #881 redesign left untouched).
const SIZE_ATTR = { name: 'size', type: 'string', values: ['sm', 'md', 'lg'], default: 'md', reflect: true }

describe('GH #369 — the API-table code chip hugs its text (a `.api-field` column-flex contract)', () => {
  it('the DETAIL chip is materially NARROWER than its own uppercase label sibling', () => {
    const { descriptor } = parseDoc(CHIP_HUG_FENCE)
    const section = renderEventsTable(descriptor) as HTMLElement
    mount(section)

    const field = [...section.querySelectorAll('.api-field')].find(
      (f) => f.querySelector('.api-field-label')?.textContent === 'Detail',
    ) as HTMLElement
    expect(field, 'the Detail field never rendered').toBeTruthy()

    const label = field.querySelector('.api-field-label') as HTMLElement
    const chip = field.querySelector('code') as HTMLElement
    expect(chip.textContent, 'anti-vacuous: this is the deliberately short detail value').toBe('x')

    const labelWidth = label.getBoundingClientRect().width
    const chipWidth = chip.getBoundingClientRect().width

    // ANTI-VACUOUS: the leg only means something while the label is genuinely the wider sibling — that
    // asymmetry IS the stretch bug's fuel. If a future label shortened past the chip, this test would pass
    // for the wrong reason, so it fails loudly instead.
    expect(labelWidth, 'the uppercase label must be the wider sibling for this leg to discriminate').toBeGreaterThan(
      textWidth(chip) + 10,
    )

    // THE CONTRACT: the chip is sized by its own content, not by the flex line. Measured delta with the fix
    // is ~25.7px (25.03 vs 50.73); reverting `align-items: flex-start` makes these EQUAL. A 6px floor is far
    // inside that margin while tolerating font-metric differences between Chromium and WebKit.
    expect(chipWidth, `chip ${chipWidth.toFixed(2)}px vs label ${labelWidth.toFixed(2)}px`).toBeLessThan(labelWidth - 6)

    // …and it really is hugging: the box exceeds its text only by its own padding + border, never by a
    // stretch. 10.31px measured; a 16px ceiling leaves room for cross-engine rounding.
    expect(chipWidth - textWidth(chip), 'the box should exceed its text only by padding + border').toBeLessThan(16)
  })
})

// ── GH #881 — the Attributes table's shared column tracks ──────────────────────────────────────────────────
// The reported defect: TYPE/DEFAULT columns "rag vertically" — each row previously sized its own fields off
// its OWN content (a flex-wrap meta strip), so a row with a wide name or a wide enum chip-set pushed its
// Type/Default fields to a different x-offset than the row above/below it. jsdom cannot discriminate this
// (it reports 0-width boxes for everything), so — like the #369 chip-hug leg above — this is a REAL browser
// layout read: every row's Type/Default/Flags cell must start at the SAME resolved x-offset as every other
// row's (and the header's), regardless of how wide that row's own Name/Type content is.
const RAGGED_ATTRS = [
  // a short name, no chips — the narrow case
  { name: 'id', type: 'string', reflect: true },
  // a long name AND a wide enum chip-set — the wide case that used to drag its OWN Type/Default rightward
  // under the old per-row-sized design, independent of the short row above
  { name: 'a-very-long-attribute-name-indeed', type: 'enum', values: ['start', 'center', 'end', 'stretch', 'baseline'], default: 'start' },
  { name: 'x', type: 'number', default: '0' },
]

describe('GH #881 — the Attributes table lays out on shared column tracks (never per-row-sized)', () => {
  it('every row\'s Type/Default/Flags cell starts at the SAME x-offset as every other row\'s AND the header\'s', () => {
    const section = renderApiTable(RAGGED_ATTRS)
    mount(section)

    const header = section.querySelector('.api-header') as HTMLElement
    const rows = [...section.querySelectorAll('.api-row')] as HTMLElement[]
    expect(rows, 'anti-vacuous: all three fixture rows must render').toHaveLength(3)

    const headerCellFor: Record<string, number> = { '.api-row-name': 0, '.api-row-type': 1, '.api-row-default': 2, '.api-row-flags': 3 }
    for (const cellClass of ['.api-row-name', '.api-row-type', '.api-row-default', '.api-row-flags']) {
      const headerCell = header.children[headerCellFor[cellClass]] as HTMLElement
      const lefts = [headerCell, ...rows.map((r) => r.querySelector(cellClass) as HTMLElement)].map(
        (el) => el.getBoundingClientRect().left,
      )
      const [first, ...rest] = lefts
      for (const left of rest) {
        expect(left, `${cellClass} left-offsets: ${lefts.map((n) => n.toFixed(1)).join(', ')}`).toBeCloseTo(first, 0)
      }
    }

    // ANTI-VACUOUS: the fixture's raw name TEXT genuinely varies in width — this is what would have dragged
    // Type/Default/Flags to different x-offsets under the OLD per-row-sized design (each row's fields sized
    // off that row's own content). The assertion above only means something because this disparity is real;
    // a fixture where every row happened to render identically wide would pass vacuously either way. The
    // CELL widths themselves are expected to be equal now (that IS the fix — shared tracks, not per-row
    // sizing), so the anti-vacuous check reads the intrinsic TEXT width, not the rendered cell box.
    const nameTextWidths = rows.map((r) => textWidth(r.querySelector('.api-row-name code') as HTMLElement))
    expect(Math.max(...nameTextWidths) - Math.min(...nameTextWidths)).toBeGreaterThan(20)
  })
})

describe('GH #369 — every inline code chip computes font-weight 400 (Kim: "mono font weight should be 400")', () => {
  it('the row-NAME rail chip is 400 (it deliberately carried 650 until Kim ruled)', () => {
    const section = renderApiTable([SIZE_ATTR])
    mount(section)
    const nameChip = section.querySelector('.api-row-name code') as HTMLElement
    expect(nameChip?.textContent, 'the name-rail chip never rendered').toBe('size')
    expect(getComputedStyle(nameChip).fontWeight, 'GH #369 — the name rail is 400, prominence rides SIZE').toBe('400')
  })

  it('a chip inside BOLD prose is 400, not the 700 it used to inherit', () => {
    // The real markdown path: `**`code`**` routes through appendInline's bold branch, which recurses, so
    // this is the exact `strong > code` shape button-doc's slots prose produces (measured there at 700).
    const body = renderMarkdownBody('The **`slot="leading"`** adornment sits in the start cell.')
    mount(body)

    const boldChip = body.querySelector('strong > code') as HTMLElement
    expect(boldChip, 'the markdown renderer no longer emits `strong > code` — this leg needs re-aiming').toBeTruthy()
    expect(getComputedStyle(boldChip.parentElement as HTMLElement).fontWeight, 'anti-vacuous: the ancestor really is bold').toBe('700')
    expect(getComputedStyle(boldChip).fontWeight, 'GH #369 — the chip owns its weight, never inherits it').toBe('400')
  })
})
