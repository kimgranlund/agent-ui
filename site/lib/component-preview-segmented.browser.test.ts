import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { userEvent } from 'vitest/browser'

// component-preview-segmented.browser.test.ts — re-keyed from the retired component-preview-radio-segmented.
// browser.test.ts (ADR-0095 supersedes ADR-0086's ui-radio-group[variant="segmented"] with the standalone
// ui-segmented-control/ui-segment pair). An enum knob renders a real `<ui-segmented-control>` ONLY when the
// member set fits the knob column as one horizontal row (component-preview.ts's fitsSegmented: ≤3 members,
// ≤5-char labels); anything wider or longer-labelled renders `ui-select` — the former vertical-stack fallback
// read as a permanently-open dropdown on the a2ui-catalog page and was retired (Kim 2026-08-18, the List card
// review). jsdom cannot prove any of this (no @scope grid layout, no `::before` geometry/transform, no
// computed cell widths) — this is the REAL-ENGINE proof, both engines, that:
//   (1) the knob renders a REAL `ui-segmented-control` (+ the resolved `orientation`) — not just the tag, but
//       the real grid layout it drives;
//   (2) a short 3-member set (`size`) renders HORIZONTAL — equal-width cells in a row, fitting the knob panel
//       with no overflow — and the TIGHTEST horizontal case (`variant`: solid/soft/ghost, 3×5-char labels,
//       clearing the ≤6-char threshold by the thinnest margin) still fits with no overflow either;
//   (3) a wider 5-member set (`align`) renders VERTICAL — equal-height cells in a stack, fitting the knob
//       panel with no overflow either axis;
//   (4) the shared moving indicator actually MOVES (not just paints — opacity alone is already 1 from the
//       seeded selection before any click) between the seeded member and a newly-clicked one, sized to one
//       cell throughout (the "test the whole shape, and bite" law — a pinned or wrongly-sized indicator must
//       fail this, not merely a hidden one).
// Runs in BOTH Chromium and WebKit (vitest.browser.config.ts).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import './component-preview.ts'

// GH #347 — REAL-TIMING HEADROOM. This file awaits real elapsed time (rAF frame settles + real-input
// driver round trips), so its duration is set by the browser's scheduling, which stretches under load.
// Class definition + why this is not a global raise: vitest.browser.config.ts, REAL-TIMING HEADROOM.
vi.setConfig({ testTimeout: 30_000 })

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

let root: HTMLElement
beforeEach(() => {
  root = document.createElement('div')
  document.body.append(root)
})
afterEach(() => {
  root.remove()
})

async function mountPreview(mode: string, target: string): Promise<HTMLElement> {
  const preview = document.createElement('component-preview')
  preview.setAttribute('mode', mode)
  preview.setAttribute('target', target)
  root.append(preview)
  await raf()
  return preview
}

/** The knob ROW (label + control) for a named prop — the panel bound a segmented knob must fit inside. */
const knobRow = (preview: HTMLElement, name: string): HTMLElement | undefined =>
  Array.from(preview.querySelectorAll<HTMLElement>('.knob')).find(
    (row) => row.querySelector('.knob-label')?.textContent === name,
  )

const knobSegmentedControl = (preview: HTMLElement, name: string): HTMLElement | undefined =>
  knobRow(preview, name)?.querySelector('ui-segmented-control') as HTMLElement | undefined

const segmentsOf = (group: HTMLElement): HTMLElement[] => [...group.querySelectorAll<HTMLElement>('ui-segment')]

const px = (v: string): number => Number.parseFloat(v)
const before = (el: Element): CSSStyleDeclaration => getComputedStyle(el, '::before')

/** Parse a `matrix(a, b, c, d, tx, ty)` transform string into its translate components (0,0 for 'none') —
 *  mirrors the control's OWN segmented-control.browser.test.ts probe (the ground truth for this shape). */
const translateOf = (transform: string): { tx: number; ty: number } => {
  const m = /matrix\(([^)]+)\)/.exec(transform)
  if (!m) return { tx: 0, ty: 0 }
  const parts = m[1].split(',').map((s) => Number.parseFloat(s.trim()))
  return { tx: parts[4] ?? 0, ty: parts[5] ?? 0 }
}

describe('component-preview — batch-A enum knobs render as a real ui-segmented-control (both engines)', () => {
  it('a short 3-member set (ui-button `size`) renders HORIZONTAL: equal-width adjoining cells, no overflow', async () => {
    const preview = await mountPreview('component', 'ui-button')
    const row = knobRow(preview, 'size')!
    const group = knobSegmentedControl(preview, 'size')!
    expect(group.getAttribute('orientation'), 'the size knob should resolve-and-reflect the horizontal default').toBe('horizontal')

    const segments = segmentsOf(group)
    expect(segments.length).toBe(3) // sm/md/lg

    const cs = getComputedStyle(group)
    expect(cs.display, 'ui-segmented-control must repoint display:grid (segmented-control.css)').toBe('grid')

    const groupRect = group.getBoundingClientRect()
    const rowRect = row.getBoundingClientRect()
    // the whole group fits INSIDE its knob row — no horizontal blowout past the panel column.
    expect(groupRect.right).toBeLessThanOrEqual(rowRect.right + 1)
    expect(groupRect.width).toBeGreaterThan(0)

    const rects = segments.map((r) => r.getBoundingClientRect())
    for (const r of rects) expect(r.width).toBeCloseTo(rects[0]!.width, 0) // equal-width cells
    for (let i = 1; i < rects.length; i++) expect(rects[i]!.left).toBeCloseTo(rects[i - 1]!.right, 0) // adjoining, no gap
    // every segment stays within the row's own bounds (no per-cell clipping/overflow either)
    for (const r of rects) {
      expect(r.left).toBeGreaterThanOrEqual(rowRect.left - 1)
      expect(r.right).toBeLessThanOrEqual(rowRect.right + 1)
    }

    // The shared moving indicator: NOT just opacity (the seeded 'md' selection already makes opacity 1 BEFORE
    // any click — an opacity-only check passes even if the indicator never moves). Prove it is sized to ONE
    // cell and actually TRANSLATES from the seeded index to a newly-clicked one (a pinned indicator fails this).
    const cellWidth = rects[0]!.width
    const seededIndex = segments.findIndex((r) => (r as unknown as { checked: boolean }).checked)
    expect(seededIndex, 'no segment pre-checked from the seeded size default (md)').toBe(1) // sm=0, md=1, lg=2
    const seededTx = translateOf(before(group).transform).tx
    expect(seededTx, 'the indicator is not positioned over the seeded (md) segment before any click').toBeCloseTo(
      seededIndex * cellWidth,
      0,
    )
    expect(px(before(group).width), 'the indicator is not sized to one cell').toBeCloseTo(cellWidth, 0)

    await userEvent.click(segments[2]!) // 'lg' — a real commit AWAY from the seeded 'md' (index 1 → 2)
    // the ::before transitions `transform` over --md-sys-motion-duration-fast — poll until it SETTLES on the new index's
    // translate rather than sampling a mid-fade interpolated value (the bite: this fails if the indicator is
    // pinned at the seeded position, or sized/placed for the wrong cell).
    await expect
      .poll(() => translateOf(before(group).transform).tx, { timeout: 1500 })
      .toBeCloseTo(2 * cellWidth, 0)
    const afterTx = translateOf(before(group).transform).tx
    expect(afterTx, 'the indicator did not move off its seeded position — it is pinned').not.toBeCloseTo(seededTx, 0)
    expect(px(before(group).opacity)).toBe(1)
    expect(px(before(group).width), 'the indicator is still sized to one cell after moving').toBeCloseTo(cellWidth, 0)
  })

  it('the tightest horizontal case (ui-button `variant`: solid/soft/ghost, 3×5-char labels) still fits the knob row with no overflow', async () => {
    // The reviewer's flagged risk: `variant` clears the ≤3-member/≤6-char threshold by the thinnest margin
    // (5-char labels vs the 6-char cutoff) — this is the real overflow candidate, not the roomier `size` case
    // above. Measure the WHOLE rendered shape, not just the tag: if this actually overflows, the ≤6-char
    // threshold is too loose for a 3-member set and `variant` should bucket vertical instead.
    const preview = await mountPreview('component', 'ui-button')
    const row = knobRow(preview, 'variant')!
    const group = knobSegmentedControl(preview, 'variant')!
    expect(group.getAttribute('orientation'), '3-member ≤6-char labels should resolve-and-reflect horizontal').toBe('horizontal')

    const segments = segmentsOf(group)
    expect(segments.length).toBe(3) // solid/soft/ghost

    expect(getComputedStyle(group).display, 'ui-segmented-control must repoint display:grid').toBe('grid')

    const groupRect = group.getBoundingClientRect()
    const rowRect = row.getBoundingClientRect()
    const rects = segments.map((r) => r.getBoundingClientRect())

    // (a) the DOM-level overflow check: the group's own scroll box must not exceed its client box.
    expect(
      group.scrollWidth,
      `group.scrollWidth=${group.scrollWidth}px > clientWidth=${group.clientWidth}px — real horizontal overflow`,
    ).toBeLessThanOrEqual(group.clientWidth + 1)

    // (b) the box-geometry check: the whole group, and every individual segment, stays within the knob row.
    expect(
      groupRect.right,
      `groupRect.right=${groupRect.right.toFixed(1)} rowRect.right=${rowRect.right.toFixed(1)}`,
    ).toBeLessThanOrEqual(rowRect.right + 1)
    for (const r of rects) expect(r.width).toBeCloseTo(rects[0]!.width, 0) // equal-width cells
    for (let i = 1; i < rects.length; i++) expect(rects[i]!.left).toBeCloseTo(rects[i - 1]!.right, 0) // adjoining, no gap
    for (const r of rects) {
      expect(r.left).toBeGreaterThanOrEqual(rowRect.left - 1)
      expect(
        r.right,
        `segment right=${r.right.toFixed(1)} rowRect.right=${rowRect.right.toFixed(1)} (cellWidth=${r.width.toFixed(1)})`,
      ).toBeLessThanOrEqual(rowRect.right + 1)
    }
  })

  it('a wider 5-member set (ui-row `align`) renders a ui-select, not a vertical segmented stack', async () => {
    // The 5-member set used to stack vertical — retired: on the catalog page the stack read as a
    // permanently-open dropdown (the 2026-08-18 List card review). An unfit set is a ui-select now.
    const preview = await mountPreview('component', 'ui-row')
    const row = knobRow(preview, 'align')!
    expect(knobSegmentedControl(preview, 'align') ?? null, 'a 5-member set must not render segmented at all').toBeNull()
    const select = row.querySelector('ui-select') as HTMLElement | null
    expect(select, 'the unfit enum knob renders ui-select').not.toBeNull()
    // the knob carries every member (+ the KNOB_UNSET "—" sentinel) as [role=option] entries
    const options = [...select!.querySelectorAll('[role=option]')].map((o) => o.getAttribute('value'))
    for (const member of ['start', 'center', 'end', 'stretch', 'baseline']) expect(options).toContain(member)
    // and it fits the knob row closed — no overflow past the panel
    const selRect = select!.getBoundingClientRect()
    const rowRect = row.getBoundingClientRect()
    expect(selRect.right).toBeLessThanOrEqual(rowRect.right + 1)
  })

  it('a short-but-wide-labelled 2-member set (ui-radio-group’s own `orientation` knob) also renders ui-select', async () => {
    // 2 members, but a long label ("horizontal"/"vertical") that would clip a 2-cell horizontal row;
    // fitsSegmented's label-length branch routes it to ui-select (the vertical stack is retired).
    const preview = await mountPreview('component', 'ui-radio-group')
    expect(knobSegmentedControl(preview, 'orientation') ?? null).toBeNull()
    const select = knobRow(preview, 'orientation')!.querySelector('ui-select')
    expect(select).not.toBeNull()
  })
})
