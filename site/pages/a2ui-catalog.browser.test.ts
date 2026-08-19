import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the page module builds the whole A2UI Catalog page into document.body (mountPage appends
// to `#app ?? document.body`) and self-imports the foundation cascade + self-defining ui-* controls (_page.ts).
import './a2ui-catalog.ts'

// GH #347 — REAL-TIMING HEADROOM. This file awaits real elapsed time (rAF frame settles),
// so its duration is set by the browser's scheduling, which stretches under concurrent host load.
// Class definition + why this is not a global raise: vitest.browser.config.ts, REAL-TIMING HEADROOM.
vi.setConfig({ testTimeout: 30_000 })

// a2ui-catalog.browser.test.ts — the field→filter smoke for the dogfooded search box (ADR-0077 dogfooding wave).
// The catalog page's filter is now a `ui-text-field type=search` (was a native <input>), so this proves — in a
// real engine — that the migrated control's OWN input wire (editor → value → re-emitted `input`) still drives
// the page's live section filter. Runs in BOTH Chromium and WebKit (the `site` browser project).

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

// ── GH #1339 helpers — the FormPopover card's panel-near-trigger pin ────────────────────────────

/** Click a tier tab by its `key` (the page-level strip's own tab, scoped exactly like the shape tests). */
function clickTierTab(tier: string): void {
  const strip = document.querySelector('ui-tabs.catalog-tabs')?.querySelector(':scope > [data-part="tablist"]')
  const tab = strip?.querySelector<HTMLElement>(`:scope > ui-tab[key="${tier}"]`)
  expect(tab, `no ${tier} tier tab found in the tablist strip`).not.toBeFalsy()
  tab!.click()
}

/** Reveal the FormPopover card (PATTERN tier) and return its live specimen parts. Clears any query an
 * earlier test left in the shared page's filter first — a hidden `.catalog-item` section would leave
 * the card unrendered regardless of which tier tab is selected. */
async function revealFormPopoverCard(): Promise<{ fp: HTMLElement & { open: boolean }; trigger: HTMLElement; panel: HTMLElement }> {
  const filterEditor = document.querySelector('.catalog-filter-input [data-part="editor"]') as HTMLElement | null
  if (filterEditor && filterEditor.textContent !== '') {
    filterEditor.textContent = ''
    filterEditor.dispatchEvent(new Event('input', { bubbles: true }))
    await raf()
  }
  clickTierTab('PATTERN')
  await raf()
  const preview = document.querySelector('component-preview[target="FormPopover"]')
  expect(preview, 'no FormPopover preview card on the catalog page').not.toBeNull()
  const fp = preview!.querySelector('ui-form-popover') as (HTMLElement & { open: boolean }) | null
  expect(fp, 'no ui-form-popover specimen inside the FormPopover preview').not.toBeNull()
  const trigger = fp!.querySelector<HTMLElement>(':scope > [data-part="trigger"]')
  const panel = fp!.querySelector<HTMLElement>(':scope > [data-part="panel"]')
  expect(trigger, 'no control-created trigger part on the specimen').not.toBeNull()
  expect(panel, 'no panel part on the specimen').not.toBeNull()
  return { fp: fp!, trigger: trigger!, panel: panel! }
}

/** True iff the panel sits at one of the four anchored candidates for the control's `bottom-start`
 * default — side: one 0.25rem gap below (or, flipped, above) the trigger; align: start- (or,
 * flipped, end-) edge aligned. Expected edges carry the overlay's own `max(0px, …)` clamp law
 * (GH #134): a trigger hugging or overhanging a viewport edge legitimately pins the panel's
 * matching edge to the viewport (measured live: WebKit's wider "Filter" label overhangs the 414px
 * viewport by ~5px, pinning the panel's right edge to 414 — an anchored render, not a detachment).
 * A detached static-position render (GH #1339) fails BOTH axes by whole element-widths; EPS only
 * absorbs sub-pixel layout rounding. */
function panelIsAnchoredToTrigger(panel: HTMLElement, trigger: HTMLElement): boolean {
  const gap = 0.25 * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)
  const vw = document.documentElement.clientWidth || window.innerWidth
  const vh = document.documentElement.clientHeight || window.innerHeight
  const t = trigger.getBoundingClientRect()
  const p = panel.getBoundingClientRect()
  if (p.width === 0 && p.height === 0) return false // no box — nothing anchored
  const EPS = 3
  const sideOk =
    Math.abs(p.top - Math.max(0, t.bottom + gap)) <= EPS || Math.abs(p.bottom - Math.min(vh, t.top - gap)) <= EPS
  const alignOk =
    Math.abs(p.left - Math.max(0, t.left)) <= EPS || Math.abs(p.right - Math.min(vw, t.right)) <= EPS
  return sideOk && alignOk
}

function rectOf(el: HTMLElement): string {
  const r = el.getBoundingClientRect()
  return `[${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}]`
}

describe('a2ui-catalog — the dogfooded ui-text-field filter narrows the section list (both engines)', () => {
  it('typing a component name into the ui-text-field type=search hides the non-matching sections', async () => {
    await raf()
    const filter = document.querySelector('.catalog-filter-input') as (HTMLElement & { value: string }) | null
    expect(filter, 'no catalog filter found').not.toBeNull()
    expect(filter!.tagName.toLowerCase(), 'the filter should be the dogfooded ui-text-field').toBe('ui-text-field')

    const sections = [...document.querySelectorAll<HTMLElement>('.catalog-item')]
    expect(sections.length, 'expected multiple catalog sections').toBeGreaterThan(1)
    const visibleBefore = sections.filter((s) => !s.hidden).length

    // Drive the field's REAL input wire: type into its editor PART → the field stops the raw editor input and
    // re-emits ONE `input` on the host → the page's filter listener reads `filter.value` and hides non-matches.
    const name = sections[0].querySelector('.catalog-item-title')!.textContent!.toLowerCase()
    const editor = filter!.querySelector('[data-part="editor"]') as HTMLElement
    editor.textContent = name
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    await raf()

    const visibleAfter = sections.filter((s) => !s.hidden).length
    expect(filter!.value, 'the ui-text-field value did not track the typed text').toBe(name)
    expect(visibleAfter, 'the filter did not narrow the section list').toBeLessThan(visibleBefore)
    expect(visibleAfter, 'the matching section should remain visible').toBeGreaterThan(0)
    expect(sections[0].hidden, 'the typed-name section should stay visible').toBe(false)
  })
})

// GH #1002 — the tab-strip SHAPE: five tier tabs (WIDGET/PRIMITIVE/PATTERN/FEATURE/INPUT,
// `site/lib/a2ui-catalog-tiers.ts`'s TIERS), exactly one unhidden panel at a time (ui-tabs' own
// roving-visibility contract), and the "see it in real use" cross-links resolving to the gallery's
// per-seed hash anchors — plus the label-count LIVE-update regression the code-checker flagged (the
// counts used to be built once at mount from `tierNames.length` and never revisited under a filter).
describe('a2ui-catalog — the tab-strip shape (five tier tabs, one visible panel, gallery cross-links)', () => {
  it('renders exactly five ui-tab elements, one per tier', async () => {
    await raf()
    // ui-tabs REPARENTS its `ui-tab` children into a control-created `[data-part=tablist]` strip
    // (`role=tablist`, tabs.ts). Scoped with `:scope >` at every level (NOT a bare descendant
    // selector) because the catalog's own panels can nest a LIVE `<component-preview target="Tabs">`
    // specimen — its own inner `ui-tab`s would otherwise be double-counted as part of the page-level strip.
    const stripTabs = document.querySelector('ui-tabs.catalog-tabs')?.querySelector(':scope > [data-part="tablist"]')
    expect(stripTabs, 'no tablist strip found on ui-tabs.catalog-tabs').not.toBeNull()
    const tabs = [...stripTabs!.querySelectorAll(':scope > ui-tab')]
    expect(tabs.length, 'expected exactly 5 tier tabs (WIDGET/PRIMITIVE/PATTERN/FEATURE/INPUT)').toBe(5)
  })

  it('exactly one ui-tab-panel is unhidden at a time', async () => {
    await raf()
    const panels = [...document.querySelectorAll<HTMLElement>('ui-tabs.catalog-tabs > ui-tab-panel')]
    expect(panels.length, 'expected 5 tier panels').toBe(5)
    const unhidden = panels.filter((p) => !p.hidden)
    expect(unhidden.length, 'exactly one tab panel should be unhidden').toBe(1)
  })

  it('every "see it in real use" cross-link resolves to a gallery per-seed hash anchor', async () => {
    await raf()
    const links = [...document.querySelectorAll<HTMLAnchorElement>('.catalog-item-uses a')]
    expect(links.length, 'expected at least one cross-link to the gallery').toBeGreaterThan(0)
    for (const a of links) {
      expect(a.getAttribute('href'), `cross-link should target a gallery seed anchor: ${a.getAttribute('href')}`).toMatch(
        /^\.\/a2ui-gallery\.html#seed-/,
      )
    }
  })

  it('GH #1339: the FormPopover card preview panel opens ANCHORED to its control-created Filter trigger', async () => {
    await raf()
    const { fp, trigger, panel } = await revealFormPopoverCard()
    // Scroll the card into view FIRST — the user's own vantage (the reported screenshot shows the
    // trigger in-canvas). With the anchor far below the fold the overlay's `max(0px, …)` inset
    // clamps legitimately pin a flipped panel to the viewport edge — off-screen-anchor behavior,
    // not the detachment under test.
    trigger.scrollIntoView({ block: 'center' })
    await raf()

    trigger.click() // the disclosure interaction — flips fp.open, the model→overlay effect opens the panel
    await raf()
    expect(panel.matches(':popover-open'), 'the panel did not open on trigger click').toBe(true)
    expect(
      panelIsAnchoredToTrigger(panel, trigger),
      `the open panel must sit at one of the four anchored placements adjacent to its trigger — a mismatch is ` +
        `GH #1339's detached static-position render (panel ${rectOf(panel)}, trigger ${rectOf(trigger)})`,
    ).toBe(true)

    fp.open = false // leave the shared page closed for the next test
    await raf()
  })

  it('GH #1339: opened while its tier panel is hidden, then revealed by the tab switch — the panel still ends anchored', async () => {
    await raf()
    const { fp, trigger, panel } = await revealFormPopoverCard()
    fp.open = false
    await raf()

    // Hide the PATTERN tier (the catalog's hidden-card build shape — most cards live in hidden tab
    // panels), open the popover while nothing renders, then reveal via the tab switch.
    clickTierTab('WIDGET')
    await raf()
    fp.open = true // model-driven open inside a display:none subtree — no box, anchor() unresolvable
    await raf()
    clickTierTab('PATTERN') // the reveal
    await raf()
    trigger.scrollIntoView({ block: 'center' }) // the user's vantage — see the anchored-open test above

    // Poll: the overlay's reveal guard (or an engine that force-closed the popover across the
    // display transition, spec-legal — re-opened here once visible) must end with the panel
    // anchored, never left at its static position.
    const deadline = performance.now() + 5000
    let anchored = false
    while (performance.now() < deadline && !anchored) {
      await raf()
      if (!panel.matches(':popover-open')) {
        fp.open = true
        continue
      }
      anchored = panelIsAnchoredToTrigger(panel, trigger)
    }
    expect(
      anchored,
      `the revealed panel never anchored to its trigger — GH #1339's detached render (panel ${rectOf(panel)}, trigger ${rectOf(trigger)})`,
    ).toBe(true)

    fp.open = false
    await raf()
  })

  it('a tab label count updates LIVE from the filter, not the static build-time total', async () => {
    await raf()
    const filter = document.querySelector('.catalog-filter-input') as (HTMLElement & { value: string }) | null
    expect(filter, 'no catalog filter found').not.toBeNull()
    // Scoped the same way as the shape test above — the page-level strip's OWN first tab, not a
    // nested `<component-preview target="Tabs">` specimen's inner tab.
    const strip = document.querySelector('ui-tabs.catalog-tabs')?.querySelector(':scope > [data-part="tablist"]')
    const firstTab = strip?.querySelector(':scope > ui-tab') as HTMLElement | undefined
    expect(firstTab, 'no ui-tab found in the tablist strip').not.toBeUndefined()
    const labelBefore = firstTab!.textContent

    // Type an unmatchable query — every tier's live count should collapse toward 0, changing every label
    // that isn't already "(0)" at mount (the WIDGET tab, first in tab order, always starts non-zero).
    const editor = filter!.querySelector('[data-part="editor"]') as HTMLElement
    editor.textContent = 'zzz-no-such-component-zzz'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    await raf()

    const labelAfter = firstTab!.textContent
    expect(labelAfter, 'the tab label should change once the filter narrows matches').not.toBe(labelBefore)
    expect(labelAfter, 'the collapsed tab label should read a zero count').toMatch(/\(0\)$/)
  })
})
