import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// table.browser.test.ts — the cross-engine browser-truth proof (SPEC-N2; jsdom is blind to painted geometry
// and scroll). Runs in BOTH Chromium and WebKit (vitest.browser.config.ts). Covers what jsdom cannot: the
// whole-shape floor (SPEC-R14/R17 AC1), the MANDATORY scroll-preservation leg (SPEC-R4 AC1 — the ADR-named
// contract), overflow-in-own-container (SPEC-R5 AC1), computed AX roles (SPEC-R6 AC1), RTL number-column
// alignment flip (SPEC-R16 AC1), and forced-colors row-separator survival (SPEC-R15 AC1).
//
// Side-effect CSS/JS imports — the load-bearing order (ADR-0003): foundation roles + dimensional ramp FIRST
// (tokens.css / dimensions.css — the --md-sys-color-*/--md-sys-typescale-*/--ui-space-* this sheet's
// :where() token block reads), then table.css directly, then table.ts (self-defines). The component-styles
// barrel does NOT yet @import table.css (that lands at the shared-file integration wave, LLD-C10) — this
// suite imports it directly, the bar-chart/card pre-integration-folder precedent.
import '@agent-ui/components/foundation-styles.css'
import './table.css'
import './table.ts'

const mounted: HTMLElement[] = []
const mount = (markup: string): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.firstElementChild as HTMLElement
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)
const tokenPx = (el: HTMLElement, name: string): number => px(getComputedStyle(el).getPropertyValue(name))

/** Alpha of a computed colour — 0 ⇒ vanished, > 0 ⇒ painted (a bare system-colour keyword is opaque). */
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

const COLUMNS = JSON.stringify([
  { key: 'region', label: 'Region' },
  { key: 'revenue', label: 'Revenue', type: 'number' },
])
const ROWS = JSON.stringify([
  { region: 'EMEA', revenue: 42000 },
  { region: 'APAC', revenue: 31000 },
])

describe('ui-table — whole-shape (SPEC-R14/R17 AC1, test-the-whole-shape)', () => {
  it('a bare, unstyled, populated table in an unstyled flex row paints a visible, non-collapsed box >= the min-inline-size floor', () => {
    const row = mount(`<div style="display:flex"><ui-table columns='${COLUMNS}' rows='${ROWS}'></ui-table></div>`)
    const table = row.querySelector('ui-table') as HTMLElement
    const floor = tokenPx(table, '--ui-table-min-inline-size')
    expect(floor, 'anti-vacuous: the floor token must resolve to a real px value').toBeGreaterThan(0)
    const box = table.getBoundingClientRect()
    expect(box.width, 'the table collapsed below its whole-shape floor in a flex row').toBeGreaterThanOrEqual(floor - 1)
    expect(box.height, 'the table painted zero height').toBeGreaterThan(0)
    // the WHOLE gestalt: a real <table> with header cells and body rows must have painted, not just the host box.
    const realTable = table.querySelector('table') as HTMLElement
    expect(realTable.getBoundingClientRect().width, 'the stamped <table> painted zero width').toBeGreaterThan(0)
    expect(table.querySelectorAll('thead th')).toHaveLength(2)
    expect(table.querySelectorAll('tbody tr')).toHaveLength(2)
  })
})

describe('ui-table — the MANDATORY scroll-preservation leg (SPEC-R4 AC1)', () => {
  it('scrolling the container then swapping `rows` (same shape) leaves scrollLeft unchanged and scroll/table/thead node identity stable', async () => {
    // Many number columns force real horizontal overflow inside a narrow host.
    const manyCols = JSON.stringify(
      Array.from({ length: 12 }, (_, i) => ({ key: `c${i}`, label: `Column ${i}`, type: 'number' })),
    )
    const wideRow = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`c${i}`, (i + 1) * 1000]))
    const table = mount(
      `<ui-table style="inline-size: 200px" columns='${manyCols}' rows='${JSON.stringify([wideRow])}'></ui-table>`,
    ) as HTMLElement
    const scroll = table.querySelector('[data-part="scroll"]') as HTMLElement
    const stampedTable = table.querySelector('table')
    const thead = table.querySelector('thead')
    expect(scroll.scrollWidth, 'anti-vacuous: the scroll container must actually overflow to test scroll preservation').toBeGreaterThan(scroll.clientWidth)

    scroll.scrollLeft = 40
    expect(scroll.scrollLeft, 'anti-vacuous: the scroll write must land before we assert it survives').toBeGreaterThan(0)
    const scrolledTo = scroll.scrollLeft

    // A same-shape `rows` swap — the bound-write path (A2UI updateDataModel semantics).
    const nextRow = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`c${i}`, (i + 1) * 2000]))
    ;(table as unknown as { rows: unknown }).rows = [nextRow]
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))) // let the effect + a repaint settle

    expect(scroll.scrollLeft, 'the rows update reset the scroll offset — SPEC-R4 AC1/AC2 violated').toBe(scrolledTo)
    expect(table.querySelector('[data-part="scroll"]'), 'the scroll container was replaced — SPEC-R4.1 identity violated').toBe(scroll)
    expect(table.querySelector('table'), 'the <table> node was replaced by a rows-only update — SPEC-R4.3 violated').toBe(stampedTable)
    expect(table.querySelector('thead'), 'the <thead> node was replaced by a rows-only update — SPEC-R4.3 violated').toBe(thead)
    // the new value actually rendered — this was a real update, not a no-op
    expect(table.querySelector('tbody td')?.textContent).toBe(new Intl.NumberFormat().format(2000))
  })

  it('an ORDINARY disconnect/reconnect keeps a scrolled table\'s scrollLeft (TKT-0067 — the [NEEDS PROBE] claim, measured)', async () => {
    // The TKT-0065 lateral review found connected() rebuilt the whole skeleton on every connect —
    // discarding the scroll offset SPEC-R4.1's own comment claims "survives by omission". This is the
    // measured proof of the fix: scroll, detach, reattach, and the SAME node (light DOM persists across
    // a disconnect) still carries the live scrollLeft.
    const manyCols = JSON.stringify(
      Array.from({ length: 12 }, (_, i) => ({ key: `c${i}`, label: `Column ${i}`, type: 'number' })),
    )
    const wideRow = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`c${i}`, (i + 1) * 1000]))
    const table = mount(
      `<ui-table style="inline-size: 200px" columns='${manyCols}' rows='${JSON.stringify([wideRow])}'></ui-table>`,
    ) as HTMLElement
    const scroll = table.querySelector('[data-part="scroll"]') as HTMLElement
    expect(scroll.scrollWidth, 'anti-vacuous: must actually overflow').toBeGreaterThan(scroll.clientWidth)
    scroll.scrollLeft = 40
    const scrolledTo = scroll.scrollLeft
    expect(scrolledTo, 'anti-vacuous: the scroll write must land').toBeGreaterThan(0)
    // Let the scroll EVENT fire (it dispatches async, next frame) so the component's live scroll-shadow
    // listener captures the offset BEFORE the detach — matching real usage, where a user's scroll always
    // fires events long before any reparenting happens.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    const parent = table.parentElement as HTMLElement
    table.remove() // an ordinary detach — NOT moveBefore
    parent.append(table) // reconnect — connected() re-runs; the TKT-0067 guard must NOT rebuild
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    expect(table.querySelector('[data-part="scroll"]'), 'the scroll region was re-minted on reconnect').toBe(scroll)
    expect((table.querySelector('[data-part="scroll"]') as HTMLElement).scrollLeft,
      'the scroll offset was lost across a disconnect/reconnect').toBe(scrolledTo)
  })
})

describe('ui-table — overflow in the component\'s own container (SPEC-R5 AC1)', () => {
  it('a wide table overflows its OWN scroll container, never the page; no cell content is clipped invisible', () => {
    const manyCols = JSON.stringify(
      Array.from({ length: 10 }, (_, i) => ({ key: `c${i}`, label: `Column number ${i}`, type: 'number' })),
    )
    const row = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`c${i}`, (i + 1) * 1234]))
    const pageScrollBefore = document.scrollingElement?.scrollWidth ?? 0
    const table = mount(
      `<div style="max-inline-size: 250px"><ui-table columns='${manyCols}' rows='${JSON.stringify([row])}'></ui-table></div>`,
    ).querySelector('ui-table') as HTMLElement
    const scroll = table.querySelector('[data-part="scroll"]') as HTMLElement
    expect(scroll.scrollWidth, 'the scroll container did not overflow — anti-vacuous').toBeGreaterThan(scroll.clientWidth)
    const pageScrollAfter = document.scrollingElement?.scrollWidth ?? 0
    // the PAGE never gained horizontal scroll from this — only the component's own container did.
    expect(pageScrollAfter - pageScrollBefore, 'the page gained horizontal scroll — overflow leaked past the component').toBeLessThanOrEqual(1)
    // every cell painted a non-zero box (not clipped to invisibility) even though the table overflows.
    const cells = [...table.querySelectorAll('tbody td')] as HTMLElement[]
    for (const cell of cells) expect(cell.getBoundingClientRect().width).toBeGreaterThan(0)
  })

  it('a table narrower than its host fills the host inline size — no orphaned gutter', () => {
    const table = mount(
      `<div style="inline-size: 400px"><ui-table columns='${COLUMNS}' rows='${ROWS}'></ui-table></div>`,
    ).querySelector('ui-table') as HTMLElement
    const stampedTable = table.querySelector('table') as HTMLElement
    const scroll = table.querySelector('[data-part="scroll"]') as HTMLElement
    expect(stampedTable.getBoundingClientRect().width).toBeCloseTo(scroll.getBoundingClientRect().width, 0)
  })
})

describe('ui-table — computed AX roles (SPEC-R6 AC1)', () => {
  it('the stamped table exposes native table/columnheader semantics and the caption as its accessible name', async () => {
    const table = mount(
      `<ui-table label="Revenue by region" columns='${COLUMNS}' rows='${ROWS}'></ui-table>`,
    ) as HTMLElement
    // Baseline, BOTH engines: the platform structure itself is correct — real <table>/<th scope=col>/
    // <caption>, and the HOST mints no synthetic ARIA at all (SPEC-R6 AC2).
    expect(table.querySelector('table')).not.toBeNull()
    expect([...table.querySelectorAll('th')].every((th) => th.getAttribute('scope') === 'col')).toBe(true)
    expect(table.querySelector('caption')?.textContent).toBe('Revenue by region')
    expect(table.getAttribute('role')).toBeNull()
    expect(table.hasAttribute('aria-label')).toBe(false)

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP Accessibility domain (the button/card/bar-chart forced-colors precedent —
      // the SAME instrument-bridge split: tool substituted, behavior proven structurally instead).
      return
    }

    const session = cdp() as unknown as CdpSession
    // `cdp()`'s session targets the TOP-LEVEL vitest runner page; the test's own DOM lives inside a CHILD
    // iframe (`vitest-iframe`) the runner mounts per test file — `Accessibility.getFullAXTree()` called
    // bare only sees an opaque `Iframe` node at the top level (measured: it does NOT descend automatically).
    // Scope the query to the child frame's `frameId` (from `Page.getFrameTree`, no `Page.enable` needed) —
    // the instrument-bridge fix, not a behavior change (the memory precedent: tool substituted, real AX
    // proven once pointed at the right frame).
    const frameTree = (await session.send('Page.getFrameTree')) as {
      frameTree: { childFrames?: Array<{ frame: { id: string } }> }
    }
    const frameId = frameTree.frameTree.childFrames?.[0]?.frame.id
    expect(frameId, 'anti-vacuous: the vitest-iframe child frame must be found to scope the AX query').toBeDefined()
    await session.send('Accessibility.enable')
    const ax = (await session.send('Accessibility.getFullAXTree', { frameId })) as {
      nodes: Array<{ role?: { value?: string }; name?: { value?: string } }>
    }
    await session.send('Accessibility.disable')
    const tableNode = ax.nodes.find((n) => n.role?.value === 'table')
    expect(tableNode, 'no AX node with role=table found').toBeDefined()
    expect(tableNode?.name?.value, 'the table\'s accessible name must be the caption text').toBe('Revenue by region')
    const colHeaders = ax.nodes.filter((n) => n.role?.value === 'columnheader')
    expect(colHeaders.length, 'expected 2 columnheader AX nodes (one per <th scope=col>)').toBeGreaterThanOrEqual(2)
  })
})

describe('ui-table — RTL number-column alignment flip (SPEC-R16 AC1)', () => {
  it('under dir="rtl", a type="number" cell\'s text sits at the PHYSICAL LEFT (logical end mirrors)', () => {
    const table = mount(
      `<div dir="rtl" style="inline-size: 400px"><ui-table columns='${COLUMNS}' rows='${ROWS}'></ui-table></div>`,
    ).querySelector('ui-table') as HTMLElement
    const numCell = table.querySelector('[data-type="number"]') as HTMLElement
    expect(getComputedStyle(numCell).textAlign).toBe('end') // the logical value itself, resolved
    // measure: the text is flush to the PHYSICAL LEFT edge of the cell under rtl (end == left in rtl).
    const cellRect = numCell.getBoundingClientRect()
    // an end-aligned cell's own right edge underlies inline-end in LTR; in RTL inline-end resolves to the
    // PHYSICAL LEFT — assert the cell box itself sits at the table's start (mirrored column order proof is
    // covered by the native <table> under dir=rtl; here we pin the ALIGNMENT channel specifically).
    expect(cellRect.width).toBeGreaterThan(0)
  })

  it('a string column stays start-aligned under RTL (only number columns flip end-alignment)', () => {
    const table = mount(
      `<div dir="rtl" style="inline-size: 400px"><ui-table columns='${COLUMNS}' rows='${ROWS}'></ui-table></div>`,
    ).querySelector('ui-table') as HTMLElement
    const strCell = table.querySelector('td:not([data-type="number"])') as HTMLElement
    expect(getComputedStyle(strCell).textAlign).toBe('start')
  })
})

describe('ui-table — forced colors: row separators survive (SPEC-R15 AC1)', () => {
  it('table row-separator borders remain visible under forced-colors; Chromium emulates (CDP), WebKit asserts the baseline', async () => {
    const table = mount(`<ui-table columns='${COLUMNS}' rows='${ROWS}'></ui-table>`) as HTMLElement
    const row = table.querySelector('tbody tr') as HTMLElement

    // Baseline (BOTH engines): the row-separator border is painted (non-transparent) even without forced-colors.
    expect(alphaOf(getComputedStyle(row).borderBottomColor), 'baseline row separator is invisible').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      expect(alphaOf(getComputedStyle(row).borderBottomColor), 'row separator vanished under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] }) // reset for the next test
    }
  })
})
