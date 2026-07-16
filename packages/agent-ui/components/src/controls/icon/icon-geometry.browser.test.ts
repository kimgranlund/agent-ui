import { describe, it, expect, beforeAll, afterEach } from 'vitest'

// s-ui-icon-tests (icon-adapter.decomp.json) — the CELL-FIT PROOF (LLD §3, ADR-0065/0066). A jsdom test
// can assert "an svg was injected"; only a real engine can prove the CONTENT-INTO-CELL geometry
// reconciliation: the SAME resolved `<svg width=100% height=100%>` asset renders at TWO DIFFERENT sizes
// depending on which existing cell it lands in, with ZERO edit to button.css. This is the sole proof of
// LLD §3's claim — jsdom-green ≠ done for anything geometry-adjacent (this repo's standing discipline).
//
// Vehicle: `ui-button`'s own [data-role='icon']/[data-role='caret'] adornment cells (button.css:118-140,
// ADR-0006/0012) — the ONE existing control whose "content-into-cell" contract is exercised through its
// PUBLIC content model (slotted children), already proven generically with plain spans/svgs in
// button-geometry.browser.test.ts's "REVERSED anatomy" leg. `ui-select`'s caret is NOT used here: its
// caret span is created internally by select.ts (not an author-slotted cell) — reaching into it would
// mean bypassing encapsulation rather than testing the shipped content model; that becomes the natural
// home for a select-specific proof once a later wave migrates select onto `setIcon` (LLD §1 audit row 1).
//
// Side-effect imports — same load-bearing CSS order as the s12/s13 harness (ADR-0003): foundation roles +
// dimensional ramp FIRST, then the component sheet, then the self-defining family barrel (registers BOTH
// ui-button and ui-icon — icon.ts already joins controls/index.ts).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'
import { iconRegistry, type IconName, type IconPack } from '@agent-ui/icons'

// A deterministic, in-file pack — registered against the module-singleton `iconRegistry` (what `ui-icon`
// reads by default, LLD-C5) so the probe does not depend on whether the Phosphor subpath happened to
// self-register elsewhere in this browser context (pack registration is app-owned, not implicit).
const TEST_PACK: IconPack = {
  id: 'icon-geometry-test-pack',
  viewBox: '0 0 32 32',
  icons: { 'caret-down': '<path d="M4 4h24v24H4z"/>' } as Record<IconName, string>,
}
beforeAll(() => {
  iconRegistry.registerPack(TEST_PACK)
  iconRegistry.setActivePack(TEST_PACK.id)
})

const mounted: HTMLElement[] = []
const mount = (markup: string): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.querySelector('ui-button') as HTMLElement
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)
const tokenPx = (btn: HTMLElement, name: string): number => px(getComputedStyle(btn).getPropertyValue(name))

describe('ui-icon cell-fit geometry (s-ui-icon-tests, LLD §3) — cross-engine', () => {
  it('an ui-icon in a [data-role="icon"] cell fills it: rendered svg box == --ui-button-icon (NO CSS edit)', () => {
    const btn = mount(
      '<ui-button><ui-icon slot="leading" data-role="icon" glyph="caret-down"></ui-icon>Label</ui-button>',
    )
    const cell = btn.querySelector('[data-role="icon"]') as HTMLElement
    const svg = cell.querySelector('svg') as SVGSVGElement
    expect(svg, 'ui-icon did not inject an svg into the icon cell').not.toBeNull()

    const iconToken = tokenPx(btn, '--ui-button-icon')
    const box = svg.getBoundingClientRect()
    expect(iconToken, 'anti-vacuous: --ui-button-icon must resolve to a real px value').toBeGreaterThan(0)
    expect(box.width, 'rendered svg width != --ui-button-icon').toBeCloseTo(iconToken, 0)
    expect(box.height, 'rendered svg height != --ui-button-icon').toBeCloseTo(iconToken, 0)
  })

  it('an ui-icon in a [data-role="caret"] cell insets to font-rhythm: rendered svg box == --ui-button-glyph (NO CSS edit)', () => {
    const btn = mount(
      '<ui-button>Label<ui-icon slot="trailing" data-role="caret" glyph="caret-down"></ui-icon></ui-button>',
    )
    const cell = btn.querySelector('[data-role="caret"]') as HTMLElement
    const svg = cell.querySelector('svg') as SVGSVGElement
    expect(svg, 'ui-icon did not inject an svg into the caret cell').not.toBeNull()

    const glyphToken = tokenPx(btn, '--ui-button-glyph') // == font, the §4.1 caret law
    const box = svg.getBoundingClientRect()
    expect(glyphToken, 'anti-vacuous: --ui-button-glyph must resolve to a real px value').toBeGreaterThan(0)
    expect(box.width, 'rendered svg width != --ui-button-glyph (font-rhythm)').toBeCloseTo(glyphToken, 0)
    expect(box.height, 'rendered svg height != --ui-button-glyph (font-rhythm)').toBeCloseTo(glyphToken, 0)
  })

  it('anti-vacuous: the SAME icon asset renders at two genuinely DIFFERENT sizes purely from ambient cell geometry', () => {
    const btn = mount(
      '<ui-button><ui-icon slot="leading" data-role="icon" glyph="caret-down"></ui-icon>Label<ui-icon slot="trailing" data-role="caret" glyph="caret-down"></ui-icon></ui-button>',
    )
    const iconSvg = btn.querySelector('[data-role="icon"] svg') as SVGSVGElement
    const caretSvg = btn.querySelector('[data-role="caret"] svg') as SVGSVGElement
    const iconW = iconSvg.getBoundingClientRect().width
    const caretW = caretSvg.getBoundingClientRect().width

    // Same-asset proof: both cells were injected via the identical resolveIcon('caret-down') content —
    // only the CONSUMING cell's pre-existing geometry differs (icon cell pads 0; caret cell pads
    // (icon−glyph)/2), with zero edits to button.css to make either fit.
    expect(iconW, 'the icon cell and caret cell rendered the same px — the cell-size distinction is vacuous').toBeGreaterThan(caretW)
    expect(iconW).toBeCloseTo(tokenPx(btn, '--ui-button-icon'), 0)
    expect(caretW).toBeCloseTo(tokenPx(btn, '--ui-button-glyph'), 0)
  })
})
