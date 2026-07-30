import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
// The GLOBAL inline-code chip rule lives in the page sheet (`_page.css`'s `code { … }`); `doc-page.ts`
// imports its OWN `doc-page.css` on import, below. Both are needed: the two GH #369 mechanisms live one in
// each file, and the whole point is that they compose on a real page.
import '../pages/_page.css'
import { renderApiTable, renderMarkdownBody } from './doc-page.ts'

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

// Kim's exact reported row: a short `default` ("md") under a wider label ("DEFAULT"). The chipset on the
// Type field is incidental — `renderApiTable` builds it from `values[]`.
const SIZE_ATTR = { name: 'size', type: 'string', values: ['sm', 'md', 'lg'], default: 'md', reflect: true }

describe('GH #369 — the API-table code chip hugs its text (a `.api-field` column-flex contract)', () => {
  it('the DEFAULT chip is materially NARROWER than its own uppercase label sibling', () => {
    const section = renderApiTable([SIZE_ATTR])
    mount(section)

    const field = [...section.querySelectorAll('.api-field')].find(
      (f) => f.querySelector('.api-field-label')?.textContent === 'Default',
    ) as HTMLElement
    expect(field, 'the Default field never rendered').toBeTruthy()

    const label = field.querySelector('.api-field-label') as HTMLElement
    const chip = field.querySelector('code') as HTMLElement
    expect(chip.textContent, 'anti-vacuous: this is the short-default row the bug was reported on').toBe('md')

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
