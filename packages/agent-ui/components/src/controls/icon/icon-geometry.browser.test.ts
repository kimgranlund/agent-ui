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

// ── GH #1508 — missing-glyph HONESTY: the host box is intrinsic (icon.css §1), NOT content-derived ────
// Kim's /command-modal-demo screenshot read as "icon-less rows with drifted indentation". The desk
// root-cause was the missing sign-out/share vendoring (fixed above this file, in the icons package) —
// but the dispatch also asks: does an UNRESOLVABLE glyph collapse ui-icon's OWN box, which would be a
// SEPARATE bug (a `data-icon-missing` empty <svg> carries no width/height of its own — icon.ts/
// resolve.ts). icon.css's token block fixes `--md-sys-icon-size: 1em` on `:where(ui-icon)` and the
// styles block sizes `:scope` (the host) to it UNCONDITIONALLY — the box comes from the HOST's own CSS,
// never from the injected child's intrinsic size. This is the "reserve its geometry" law already, by
// construction; this is the MEASURED proof (jsdom cannot compute real layout/getBoundingClientRect).
describe('ui-icon missing-glyph HONESTY (GH #1508) — the host box is intrinsic, never content-collapsed', () => {
  it('a resolved and an unresolvable glyph render the EXACT SAME host box size (same --md-sys-icon-size)', () => {
    const wrap = document.createElement('div')
    wrap.innerHTML =
      '<ui-icon glyph="caret-down"></ui-icon><ui-icon glyph="not-a-real-icon-gh-1508"></ui-icon>'
    document.body.append(wrap)
    mounted.push(wrap)

    const [resolved, missing] = [...wrap.querySelectorAll('ui-icon')] as HTMLElement[]
    // anti-vacuous: prove the two really did resolve differently (one real svg, one data-icon-missing)
    expect(resolved.querySelector('svg')?.getAttribute('data-icon-missing')).toBeNull()
    expect(missing.querySelector('svg')?.getAttribute('data-icon-missing')).toBe('not-a-real-icon-gh-1508')

    const resolvedBox = resolved.getBoundingClientRect()
    const missingBox = missing.getBoundingClientRect()
    // --md-sys-icon-size is `1em` (a relative token, icon.css §1) — getComputedStyle's custom-property
    // read returns the literal string "1em", not a resolved px value; the resolved host's own computed
    // `font-size` IS that resolved px (1em == font-size), the anti-vacuous real-px anchor.
    const emPx = px(getComputedStyle(resolved).fontSize)
    expect(emPx, 'anti-vacuous: the 1em icon size must resolve to a real px value').toBeGreaterThan(0)
    expect(resolvedBox.width).toBeCloseTo(emPx, 0)
    expect(missingBox.width, 'an unresolvable glyph must NOT collapse the ui-icon host box').toBeCloseTo(resolvedBox.width, 0)
    expect(missingBox.height, 'an unresolvable glyph must NOT collapse the ui-icon host box').toBeCloseTo(resolvedBox.height, 0)
  })

  it('in a realistic flex row (the command-modal option-row shape), a missing icon does NOT shift the label — same left offset as a resolved sibling row', () => {
    const row = (glyph: string): HTMLElement =>
      el(
        `<div style="display:flex;align-items:center;gap:8px;inline-size:12rem">
           <ui-icon data-role="icon" glyph="${glyph}"></ui-icon>
           <span data-role="label">Log out</span>
         </div>`,
      )
    const okRow = mount2(row('caret-down'))
    const missingRow = mount2(row('sign-out-was-never-vendored-gh-1508'))

    const okLabel = okRow.querySelector('[data-role="label"]') as HTMLElement
    const missingLabel = missingRow.querySelector('[data-role="label"]') as HTMLElement
    expect(missingLabel.getBoundingClientRect().left, 'the row-authored label must not drift when its leading icon fails to resolve').toBeCloseTo(
      okLabel.getBoundingClientRect().left,
      0,
    )
  })
})

function el(markup: string): HTMLElement {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  return wrap.firstElementChild as HTMLElement
}
function mount2(node: HTMLElement): HTMLElement {
  document.body.append(node)
  mounted.push(node)
  return node
}
