import { describe, it, expect, afterEach } from 'vitest'

// container.browser.test.ts — the ADR-0100 WHOLE-SHAPE acceptance legs (the Acceptance section's named
// toolbar/tiles/reflow-preserved/non-locality/grid-guard legs), each with its own negative control. Runs in
// BOTH Chromium and WebKit (vitest.browser.config.ts → the two playwright instances) — jsdom cannot compute
// layout at all, so every claim here is a REAL rendered bounding box, never a per-part CSS-text assertion.
//
// The compositions mirror the two audited defects exactly (the `document-row-toolbar` and
// `pattern-dashboard-tiles` shipped seeds — packages/agent-ui/a2ui/src/examples/{catalog-coverage,patterns}.ts)
// and the numbers below were measured directly against this repo's shipped CSS (Chromium + WebKit,
// `defect-probe.{html,mjs}`, the ADR's own cited proof) — engine-loose bounds per the ADR's own acceptance
// text (info 100-130px / actions 110-160px at default type; Chromium measured 115.6/136.2, WebKit ~115.6/124.7).
//
// CSS wiring: side-effect imports, foundation FIRST, then the shared surface seam (which — post ADR-0100 —
// declares NO container-type on any element), then each primitive's own sheet, then the self-defining modules.
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container.css'
import '../row/row.css'
import '../row/row.ts'
import '../column/column.css'
import '../column/column.ts'
import '../grid/grid.css'
import '../grid/grid.ts'
import '../card/card.css'
import '../card/card.ts'
import '../card/card-content.ts'
import '../text/text.css'
import '../text/text.ts'

const mounted: HTMLElement[] = []
/** An EXTERNALLY-SIZED boundary div (ADR-0100 cl.2's law: definite inline-size) that establishes the query
 *  container the mounted fleet primitives resolve `@container` against — never the primitives themselves. */
const boundary = (widthPx: number): HTMLElement => {
  const el = document.createElement('div')
  el.style.containerType = 'inline-size'
  el.style.inlineSize = `${widthPx}px`
  el.style.boxSizing = 'border-box'
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const rect = (el: Element): DOMRect => el.getBoundingClientRect()

describe('ADR-0100 — toolbar leg (document-row-toolbar shape)', () => {
  it('nested rows render content-sized under an established 600px boundary, justify=between honored', () => {
    const b = boundary(600)
    b.innerHTML = `
      <ui-row justify="between" align="center" gap="md">
        <ui-row gap="sm" align="center"><span>Q3 roadmap.pdf</span></ui-row>
        <ui-row gap="sm" align="center"><button>Info</button><button>Share</button><button>More</button></ui-row>
      </ui-row>`
    const toolbar = b.querySelector('ui-row') as HTMLElement
    const [info, actions] = Array.from(toolbar.children) as HTMLElement[]

    const infoW = rect(info).width
    const actionsW = rect(actions).width
    // Engine-loose bounds, per the ADR's own acceptance text (Chromium 115.6/136.2, WebKit 115.6/124.7).
    expect(infoW).toBeGreaterThan(100)
    expect(infoW).toBeLessThan(130)
    expect(actionsW).toBeGreaterThan(110)
    expect(actionsW).toBeLessThan(160)
    // Anti-vacuous: neither nested row collapsed to 0 (the exact defect ADR-0100 fixes).
    expect(infoW).toBeGreaterThan(0)
    expect(actionsW).toBeGreaterThan(0)
    // justify="between" honored: the actions cluster's right edge ≈ the toolbar's right edge.
    expect(rect(actions).right).toBeCloseTo(rect(toolbar).right, 0)
  })

  it('NEGATIVE CONTROL — re-adding container-type to a nested row fails the leg (0px)', () => {
    const b = boundary(600)
    b.innerHTML = `
      <ui-row justify="between" align="center" gap="md">
        <ui-row gap="sm" align="center"><span>Q3 roadmap.pdf</span></ui-row>
        <ui-row gap="sm" align="center"><button>Info</button><button>Share</button><button>More</button></ui-row>
      </ui-row>`
    const toolbar = b.querySelector('ui-row') as HTMLElement
    const [info, actions] = Array.from(toolbar.children) as HTMLElement[]
    // Reproduce the deleted ADR-0016 cl.4 blanket rule by hand, on ONE nested row — the exact mechanism
    // ADR-0100 cl.1 removed fleet-wide.
    info.style.containerType = 'inline-size'
    actions.style.containerType = 'inline-size'

    expect(rect(info).width).toBeCloseTo(0, 0)
    expect(rect(actions).width).toBeCloseTo(0, 0)
  })
})

describe('ADR-0100 — tiles leg (pattern-dashboard-tiles shape)', () => {
  const tile = (label: string, value: string, delta: string): string => `
    <ui-card elevation="1">
      <ui-card-content>
        <ui-column gap="xs">
          <ui-text variant="label">${label}</ui-text>
          <ui-text variant="title" size="lg">${value}</ui-text>
          <ui-text variant="label">${delta}</ui-text>
        </ui-column>
      </ui-card-content>
    </ui-card>`

  it('three tile cards in a ~600px established wrap row render content-sized, disjoint, single line', () => {
    const b = boundary(600)
    b.innerHTML = `<ui-row gap="md" wrap>${tile('Revenue', '128.4k€', '+12% vs last month')}${tile('Active users', '8,204', '+3.1% vs last month')}${tile('Churn', '1.8%', '−0.4% vs last month')}</ui-row>`
    const cards = Array.from(b.querySelectorAll('ui-card')) as HTMLElement[]
    expect(cards).toHaveLength(3)

    const rects = cards.map(rect)
    const REM8 = 128 // 8rem at the default 16px root
    for (const r of rects) expect(r.width).toBeGreaterThanOrEqual(REM8)
    // single line: all three share the same top offset.
    expect(rects[1].top).toBeCloseTo(rects[0].top, 0)
    expect(rects[2].top).toBeCloseTo(rects[0].top, 0)
    // disjoint x-ranges: each card starts at/after the previous one's right edge.
    expect(rects[1].left).toBeGreaterThanOrEqual(rects[0].right - 1)
    expect(rects[2].left).toBeGreaterThanOrEqual(rects[1].right - 1)
  })

  it('in a 320px established container the row (default reflow) stacks the tiles, none crushed', () => {
    const b = boundary(320)
    b.innerHTML = `<ui-row gap="md" wrap>${tile('Revenue', '128.4k€', '+12% vs last month')}${tile('Active users', '8,204', '+3.1% vs last month')}${tile('Churn', '1.8%', '−0.4% vs last month')}</ui-row>`
    const row = b.querySelector('ui-row') as HTMLElement
    const cards = Array.from(b.querySelectorAll('ui-card')) as HTMLElement[]

    // Under 24rem (384px) the row's default `reflow="auto"` flips it to a column (ADR-0016 cl.4, resolving
    // against the ESTABLISHED boundary, ADR-0100) — the tiles stack, one per line.
    expect(getComputedStyle(row).flexDirection).toBe('column')
    const rects = cards.map(rect)
    expect(rects[1].top).toBeGreaterThan(rects[0].bottom - 1) // stacked below, not beside
    expect(rects[2].top).toBeGreaterThan(rects[1].bottom - 1)
    // THE REGRESSION GUARD (Decision cl.3 — "the crush class cannot silently return"): each tile still renders
    // at a real content width, never the ~36px chrome-only crush the audit measured pre-fix.
    for (const r of rects) expect(r.width).toBeGreaterThan(100)
  })
})

describe('ADR-0100 — reflow-preserved legs (the 0096 gated selectors, unchanged, now resolving against a boundary)', () => {
  it('default ui-row computes column + stacks children in a 300px established boundary', () => {
    const b = boundary(300)
    b.innerHTML = `<ui-row><div>a</div><div>b</div></ui-row>`
    const row = b.querySelector('ui-row') as HTMLElement
    const [a, bEl] = Array.from(row.children) as HTMLElement[]
    expect(getComputedStyle(row).flexDirection).toBe('column')
    expect(rect(bEl).top).toBeGreaterThan(rect(a).bottom - 1)
  })

  it('ui-row[reflow="locked"] stays row even in a 300px established boundary', () => {
    const b = boundary(300)
    b.innerHTML = `<ui-row reflow="locked"><div>a</div><div>b</div></ui-row>`
    const row = b.querySelector('ui-row') as HTMLElement
    expect(getComputedStyle(row).flexDirection).toBe('row')
  })

  it('ui-column[reflow="auto"] computes row in a 600px established boundary', () => {
    const b = boundary(600)
    b.innerHTML = `<ui-column reflow="auto"><div>one</div><div>two</div></ui-column>`
    const col = b.querySelector('ui-column') as HTMLElement
    expect(getComputedStyle(col).flexDirection).toBe('row')
  })

  it('default ui-column (reflow="locked") stays column in a 600px established boundary', () => {
    const b = boundary(600)
    b.innerHTML = `<ui-column><div>one</div><div>two</div></ui-column>`
    const col = b.querySelector('ui-column') as HTMLElement
    expect(getComputedStyle(col).flexDirection).toBe('column')
  })
})

describe('ADR-0100 — non-locality leg (a contained primitive corrupts every content-sized ancestor)', () => {
  it('a card in a wrap row renders at ≈ its standalone content width', () => {
    const b = boundary(600)
    b.innerHTML = `
      <ui-row gap="md" wrap>
        <ui-card>
          <ui-card-content>
            <ui-column gap="xs">
              <ui-text variant="label">Revenue</ui-text>
              <ui-text variant="title" size="lg">128.4k€</ui-text>
              <ui-text variant="label">+12% vs last month</ui-text>
            </ui-column>
          </ui-card-content>
        </ui-card>
      </ui-row>`
    const card = b.querySelector('ui-card') as HTMLElement
    expect(rect(card).width).toBeGreaterThan(100) // real content width, not the ~36px chrome-only crush
  })

  it('NEGATIVE CONTROL — container-type on the inner column collapses the card to chrome-only width (~36px)', () => {
    const b = boundary(600)
    b.innerHTML = `
      <ui-row gap="md" wrap>
        <ui-card>
          <ui-card-content>
            <ui-column gap="xs">
              <ui-text variant="label">Revenue</ui-text>
              <ui-text variant="title" size="lg">128.4k€</ui-text>
              <ui-text variant="label">+12% vs last month</ui-text>
            </ui-column>
          </ui-card-content>
        </ui-card>
      </ui-row>`
    const card = b.querySelector('ui-card') as HTMLElement
    const innerColumn = b.querySelector('ui-card-content > ui-column') as HTMLElement
    // Reproduce the deleted ADR-0016 cl.4 blanket rule by hand, on the card's OWN inner column — the exact
    // non-local mechanism ADR-0100 cl.1 removed fleet-wide (the harm sits INSIDE the card, a position no
    // selector at the row-nesting level could ever repair).
    innerColumn.style.containerType = 'inline-size'
    expect(rect(card).width).toBeLessThan(60) // chrome-only: border + region margin/padding, ~36-45px
  })
})

describe('ADR-0100 — grid-guard leg (cl.3: the retained card min-inline-size:0 protects a grid track)', () => {
  it('a card with unbreakable content renders at exactly the grid track width — no blowout', () => {
    const grid = document.createElement('ui-grid')
    grid.setAttribute('min', '10rem')
    grid.style.inlineSize = '400px'
    grid.style.boxSizing = 'border-box'
    grid.innerHTML = `
      <ui-card><ui-card-content><ui-text>AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA</ui-text></ui-card-content></ui-card>
      <ui-card><ui-card-content><ui-text>short</ui-text></ui-card-content></ui-card>`
    document.body.append(grid)
    mounted.push(grid)

    const [long, short] = Array.from(grid.querySelectorAll('ui-card')) as HTMLElement[]
    const trackW = rect(short).width // the short card can't be blown out — reads the real track width
    expect(rect(long).width).toBeCloseTo(trackW, 0) // holds the SAME track width, no blowout
    expect(rect(long).width).toBeLessThan(trackW + 5)
  })

  it('NEGATIVE CONTROL — min-inline-size:min-content on the card blows the track (~2.4x at this geometry)', () => {
    const grid = document.createElement('ui-grid')
    grid.setAttribute('min', '10rem')
    grid.style.inlineSize = '400px'
    grid.style.boxSizing = 'border-box'
    grid.innerHTML = `
      <ui-card><ui-card-content><ui-text>AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA</ui-text></ui-card-content></ui-card>
      <ui-card><ui-card-content><ui-text>short</ui-text></ui-card-content></ui-card>`
    document.body.append(grid)
    mounted.push(grid)

    const [long, short] = Array.from(grid.querySelectorAll('ui-card')) as HTMLElement[]
    const trackW = rect(short).width
    long.style.minInlineSize = 'min-content' // the REJECTED alternative (ADR-0100 cl.3's "Alternatives")
    expect(rect(long).width).toBeGreaterThan(trackW * 1.5) // blows well past the track (measured 484px vs 200px)
  })
})
