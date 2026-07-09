import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { userEvent } from 'vitest/browser'

// a2ui-gallery.browser.test.ts — the SCOPED cross-engine layout smoke for the A2UI composition gallery
// (site/lib/a2ui-gallery.ts). The jsdom drift gate (a2ui-gallery.test.ts) proves the cards are DERIVED
// from the shelf and every surface renders clean; it cannot prove LAYOUT — jsdom resolves no @scope, no
// dimensional ramp, no computed geometry, no top-layer. This file pins exactly the five things the layout
// review flagged as unprovable in jsdom, and NOTHING the seeds' own gates already own (this is not a
// per-seed interaction suite):
//   (a) every `.seed-surface` has a non-zero box AND is bounded by the 30rem cap (the a2ui-patterns
//       height-cap contract — a tall composition scrolls IN-frame, it never stretches the card);
//   (b) the `.seed-gallery` actually computes `display: grid` (the responsive auto-fill layout is live);
//   (c) at least one known-tall seed scrolls INSIDE its frame (scrollHeight > clientHeight) — proving the
//       cap+overflow engaged rather than the frame silently growing;
//   (d) an overlay seed's panel, once opened, ESCAPES its frame rect — pinning the top-layer no-clip
//       ruling (an `overflow: auto` frame must NOT clip a promoted popover/menu panel).
//
// (e) RETIRED (feed-family.lld.md LLD-C15, M2, SPEC-R22): the document-row-toolbar title cell this leg
// pinned (`Text truncate`/`emphasis`, ADR-0106/ADR-0109) was the seed's hand-composed Row[Icon,Text] file
// card, upgraded to a real `Attachment` — the seed no longer carries an unmodified `Text[truncate]` node
// to assert against. `Text`'s own `truncate`/`emphasis` contract stays fully covered at the component
// level (text.test.ts/text-css.test.ts/text.browser.test.ts/text.visual.browser.test.ts); only the
// "real-seed reference use" angle retires with the assembly it was pinned to, the same trade the seed
// shelf's own former Icon pin made (examples.test.ts).
// Runs in BOTH Chromium and WebKit (vitest.browser.config.ts → the `site` project's two playwright
// instances), co-located with the module it tests, following component-preview.browser.test.ts.
//
// The foundation CSS cascade (ADR-0003) + the self-defining controls + the icon pack are imported
// explicitly (exactly what _page.ts does for the real page) so the rendered surfaces carry REAL geometry;
// the lib module itself side-effect-imports its own page-local CSS.
import '@agent-ui/components/foundation-styles.css' // foundation tokens + dimensional ramp (FIRST — geometry source)
import '@agent-ui/components/component-styles.css' // per-control CSS (so a surface has real geometry, not 0×0)
import '@agent-ui/components/components' // self-defining ui-* controls (the renderer mounts these by tag)
import { buildSeedGallery, buildSeedCard } from './a2ui-gallery.ts'
import { documentRowToolbarSeed, bookingReservationSeed, patternSettingsSeed } from '@agent-ui/a2ui/examples'

// The renderer's mount + each ui-* control's first render settle across frames — await a few rAFs so
// computed geometry (and any lazily-imported control, e.g. the Calendar) is available before asserting.
const settle = (): Promise<void> =>
  new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => r()))))

const remPx = (): number => parseFloat(getComputedStyle(document.documentElement).fontSize)

let mount: HTMLElement
beforeEach(() => {
  mount = document.createElement('div')
  document.body.append(mount)
})
afterEach(() => {
  mount.remove()
})

describe('a2ui-gallery — the layout contract the drift gate cannot see (both engines)', () => {
  it('(a) every seed surface has a non-zero box bounded by the 30rem height cap', async () => {
    const { root } = buildSeedGallery()
    mount.append(root)
    await settle()

    // 30rem cap + the frame's own block padding (1rem top + 1rem bottom) + a small slack for the border/
    // scrollbar gutter — a surface may reach the cap, it must NEVER exceed it (the card-stretch failure).
    const cap = remPx() * 30 + remPx() * 2 + 8
    const surfaces = [...root.querySelectorAll<HTMLElement>('.seed-surface')]
    expect(surfaces.length, 'no seed surfaces rendered').toBeGreaterThan(0)
    for (const surface of surfaces) {
      const seedName = surface.closest<HTMLElement>('.seed-card')?.dataset.seed
      const rect = surface.getBoundingClientRect()
      expect(rect.width, `seed "${seedName}" surface collapsed to ~0 width`).toBeGreaterThan(0)
      expect(rect.height, `seed "${seedName}" surface collapsed to ~0 height`).toBeGreaterThan(0)
      expect(rect.height, `seed "${seedName}" surface blew past the 30rem cap (${rect.height}px)`).toBeLessThanOrEqual(cap)
    }
  })

  it('(b) the gallery computes display:grid (the responsive auto-fill layout is live)', async () => {
    const { root } = buildSeedGallery()
    mount.append(root)
    await settle()
    expect(getComputedStyle(root).display).toBe('grid')
  })

  it('(c) a known-tall seed scrolls INSIDE its frame — cap + overflow engaged (booking-reservation)', async () => {
    const { root } = buildSeedGallery()
    mount.append(root)
    await settle()
    const surface = root.querySelector<HTMLElement>('.seed-card[data-seed="booking-reservation"] .seed-surface')
    expect(surface, 'no booking-reservation surface found').not.toBeNull()
    // The booking form (name + guest fields + a range Calendar + a budget Slider) exceeds the 30rem cap, so
    // it must scroll inside its own frame rather than growing the card.
    expect(
      surface!.scrollHeight,
      `booking-reservation did not overflow its frame (scrollHeight ${surface!.scrollHeight} ≤ clientHeight ${surface!.clientHeight}) — the cap/overflow never engaged`,
    ).toBeGreaterThan(surface!.clientHeight + 1)
  })

  it('(d) an opened overlay panel ESCAPES the frame rect — top-layer no-clip (document-row-toolbar)', async () => {
    // Mount this one seed standalone (no grid-row stretch) so the frame is content-height and a popover
    // opening below its trigger provably extends past the frame bottom.
    const { card, surface } = buildSeedCard(documentRowToolbarSeed)
    mount.append(card)
    await settle()

    const trigger = card.querySelector<HTMLElement>('ui-popover [data-part="trigger"]')
    expect(trigger, 'no ui-popover trigger rendered in the document-row-toolbar surface').not.toBeNull()
    await userEvent.click(trigger!)
    await settle()

    const panel = card.querySelector<HTMLElement>('ui-popover [data-part="panel"]')
    expect(panel, 'no ui-popover panel found').not.toBeNull()
    const panelRect = panel!.getBoundingClientRect()
    expect(panelRect.height, 'the popover panel did not open (zero-height rect)').toBeGreaterThan(0)

    // The frame clips its own overflow (overflow: auto) — a promoted top-layer panel must NOT be confined
    // by it. The panel opens below the toolbar trigger, so its bottom edge sits below the short frame's.
    const frameRect = surface.getBoundingClientRect()
    expect(
      panelRect.bottom,
      `the opened panel is confined to the frame (panel.bottom ${panelRect.bottom} ≤ frame.bottom ${frameRect.bottom}) — top-layer no-clip failed`,
    ).toBeGreaterThan(frameRect.bottom)
  })
})

// ── ADR-0101 erratum — the mouse-click-open never sets `open`, so a commit's close was a no-op ───────────
// (ticket #28's residual, live re-audit, cross-engine reproduced). Both legs below drive a REAL mouse
// click on the REAL trigger (not a programmatic `el.open = true` — the gap that let this ship) on the
// unmodified gallery seeds the audit named: the document-row-toolbar's overflow Menu and the
// settings-form's plan Select. Runs in both Chromium and WebKit (vitest.browser.config.ts).
describe('a2ui-gallery — ADR-0101 erratum: click-open then commit actually closes the panel (both engines)', () => {
  it('document-row-toolbar Menu: click the overflow trigger, pick an item, the panel is visibly closed (:popover-open false)', async () => {
    const { card } = buildSeedCard(documentRowToolbarSeed)
    mount.append(card)
    await settle()

    const menu = card.querySelector('ui-menu')!
    const trigger = menu.querySelector<HTMLElement>('[data-part="trigger"]')
    expect(trigger, 'no ui-menu trigger rendered in the document-row-toolbar surface').not.toBeNull()

    await userEvent.click(trigger!)
    await settle()

    const panel = menu.querySelector<HTMLElement>('[data-part="panel"]')
    expect(panel, 'no ui-menu panel found').not.toBeNull()
    expect(panel!.matches(':popover-open'), 'the menu did not visibly open on a mouse-click trigger').toBe(true)
    expect((menu as unknown as { open: boolean }).open, 'a mouse-click open must set the reflected open prop').toBe(true)

    const item = panel!.querySelector<HTMLElement>('[role="menuitem"]')!
    await userEvent.click(item)
    await settle()

    expect(panel!.matches(':popover-open'), 'the panel stuck open after a post-mouse-open commit — the ticket #28 residual').toBe(false)
    expect((menu as unknown as { open: boolean }).open, 'open must settle to false after commit').toBe(false)
  })

  it('settings-form Select: click the trigger, pick a plan option, the panel is visibly closed (:popover-open false)', async () => {
    const { card } = buildSeedCard(patternSettingsSeed)
    mount.append(card)
    await settle()

    const select = card.querySelector('ui-select')!
    const trigger = select.querySelector<HTMLElement>('[data-part="trigger"]')
    expect(trigger, 'no ui-select trigger rendered in the settings-form surface').not.toBeNull()

    await userEvent.click(trigger!)
    await settle()

    const listbox = select.querySelector<HTMLElement>('[data-part="listbox"]')
    expect(listbox, 'no ui-select listbox found').not.toBeNull()
    expect(listbox!.matches(':popover-open'), 'the select did not visibly open on a mouse-click trigger').toBe(true)
    expect((select as unknown as { open: boolean }).open, 'a mouse-click open must set the reflected open prop').toBe(true)

    const option = listbox!.querySelector<HTMLElement>('[role="option"]')!
    await userEvent.click(option)
    await settle()

    expect(listbox!.matches(':popover-open'), 'the panel stuck open after a post-mouse-open commit — the ticket #28 residual').toBe(false)
    expect((select as unknown as { open: boolean }).open, 'open must settle to false after commit').toBe(false)
  })
})

// ── ADR-0103 — the rental-filter-panel crash site, on the REAL (unmodified) A2UI mount ──────────────────
// ticket #31: the rental-filter-panel seed's `RadioGroup` (`orientation="horizontal"`, catalog-coverage.ts)
// used to mash its three property-type radios together (zero gap, either orientation — ui-radio's own host
// is inline-flex). `ui-radio-group` now owns its interior layout (radio-group.css's `@scope` block); this
// proves it on the SAME unmodified seed the ticket reported, through the real renderer, in BOTH colour
// schemes (layout is scheme-invariant — the point is that the fix survives the exact page a user sees it on,
// under either scheme, not that colour affects geometry).
describe('a2ui-gallery — rental-filter-panel RadioGroup renders with visible gaps (ADR-0103, both schemes)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    it(`[color-scheme=${scheme}] the property-type RadioGroup's radios are visibly separated, not mashed`, async () => {
      const { root } = buildSeedGallery()
      mount.style.colorScheme = scheme
      mount.append(root)
      await settle()

      const card = root.querySelector<HTMLElement>('.seed-card[data-seed="rental-filter-panel"]')
      expect(card, 'no rental-filter-panel card rendered').not.toBeNull()
      expect(card!.dataset.rendered, 'the seed did not render clean (a validator rejection or empty surface)').toBe('true')

      const group = card!.querySelector('ui-radio-group') as HTMLElement | null
      expect(group, 'no ui-radio-group rendered in the rental-filter-panel surface').not.toBeNull()
      expect(group!.getAttribute('orientation'), 'the seed drives orientation="horizontal" — the reported crash axis').toBe('horizontal')

      const radios = [...group!.children] as HTMLElement[]
      expect(radios.length, 'the property-type group needs ≥ 2 radios to prove a gap').toBeGreaterThanOrEqual(2)

      const cs = getComputedStyle(group!)
      const gap = Number.parseFloat(cs.columnGap)
      expect(gap, `[color-scheme=${scheme}] the group computed a zero/absent gap — the pre-ADR-0103 mash`).toBeGreaterThan(0)

      // Anti-vacuous: the actual rendered rects are separated by at least the computed gap, not just the
      // token value in the abstract (the ticket's bug was rects touching despite `orientation` being set).
      for (let i = 0; i < radios.length - 1; i++) {
        const a = radios[i]!.getBoundingClientRect()
        const b = radios[i + 1]!.getBoundingClientRect()
        expect(
          b.left - a.right,
          `[color-scheme=${scheme}] radio #${i} and #${i + 1} are touching/overlapping (mashed) despite the shipped gap`,
        ).toBeGreaterThanOrEqual(gap - 1)
      }
    })
  }
})

// ── ADR-0105 — the booking-reservation Calendar fills its given width, on the REAL (unmodified)
// A2UI mount — ticket #30: the range Calendar (`cal_dates`, catalog-coverage.ts) sat fixed-width in
// the inline-start corner of its Field/Column-stretched panel, half the bordered panel empty. The
// grid's tracks are now fluid (`minmax(cell-size, 1fr)`, calendar.css); this proves the fix through
// the REAL renderer + REAL catalog factory + the REAL `Column(stretch) > Field(flex column) >
// Calendar` composition chain, at both a wide and a narrow card width, in both colour schemes
// (layout is scheme-invariant; proving both matches the ADR's acceptance line item).
describe('a2ui-gallery — booking-reservation Calendar fills its field width (ADR-0105, wide + narrow, both schemes)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const { label, widthPx } of [
      { label: 'wide', widthPx: 700 },
      { label: 'narrow', widthPx: 320 },
    ]) {
      it(`[color-scheme=${scheme}, ${label}] the Calendar grid fills its Field's content width, not just its old fixed track`, async () => {
        const { card, surface } = buildSeedCard(bookingReservationSeed)
        mount.style.colorScheme = scheme
        mount.style.width = `${widthPx}px`
        mount.append(card)
        await settle()

        expect(card.dataset.rendered, 'the booking-reservation seed did not render clean').toBe('true')

        const calendar = surface.querySelector('ui-calendar') as HTMLElement | null
        expect(calendar, 'no ui-calendar rendered in the booking-reservation surface').not.toBeNull()
        const field = calendar!.closest('ui-field') as HTMLElement | null
        expect(field, 'the Calendar is not wrapped in its ui-field (f_dates)').not.toBeNull()

        const grid = calendar!.querySelector<HTMLElement>('[data-part="grid"]')!
        const gridRect  = grid.getBoundingClientRect()
        const fieldRect = field!.getBoundingClientRect()

        // The compact (pre-ADR-0105) floor is ~230px (7 × ~32px + gaps at the default md size) — a
        // wide card must grow well past it; a narrow card may sit AT the floor (nothing to spend),
        // which is itself the correct degrade (ADR-0105 §Consequences: fluid, not force-grown).
        if (label === 'wide') {
          expect(
            gridRect.width,
            `[${scheme}, ${label}] grid (${gridRect.width}px) did not grow past the compact floor — the fill regression`,
          ).toBeGreaterThan(280)
        }

        // Whichever width it lands at, the grid must never OVER-claim the field's own content box
        // (the fill contract is "fill what you're given," not "escape your container").
        expect(
          gridRect.width - fieldRect.width,
          `[${scheme}, ${label}] grid (${gridRect.width}px) overflowed its field (${fieldRect.width}px)`,
        ).toBeLessThanOrEqual(2)

        // And it should be CLOSE to the field's width (small remainder = the panel's own box-model
        // insets), not stranded at a small fraction of it — the "half-empty panel" ticket #30 shape.
        expect(
          fieldRect.width - gridRect.width,
          `[${scheme}, ${label}] grid (${gridRect.width}px) is far narrower than its field (${fieldRect.width}px) — panel still half-empty`,
        ).toBeLessThan(40)
      })
    }
  }
})
