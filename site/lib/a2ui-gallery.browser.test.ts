import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { userEvent } from 'vitest/browser'

// a2ui-gallery.browser.test.ts — the SCOPED cross-engine layout smoke for the A2UI composition gallery
// (site/lib/a2ui-gallery.ts). The jsdom drift gate (a2ui-gallery.test.ts) proves the cards are DERIVED
// from the shelf and every surface renders clean; it cannot prove LAYOUT — jsdom resolves no @scope, no
// dimensional ramp, no computed geometry, no top-layer. This file pins exactly the four things the layout
// review flagged as unprovable in jsdom, and NOTHING the seeds' own gates already own (this is not a
// per-seed interaction suite):
//   (a) every `.seed-surface` has a non-zero box AND is bounded by the 30rem cap (the a2ui-patterns
//       height-cap contract — a tall composition scrolls IN-frame, it never stretches the card);
//   (b) the `.seed-gallery` actually computes `display: grid` (the responsive auto-fill layout is live);
//   (c) at least one known-tall seed scrolls INSIDE its frame (scrollHeight > clientHeight) — proving the
//       cap+overflow engaged rather than the frame silently growing;
//   (d) an overlay seed's panel, once opened, ESCAPES its frame rect — pinning the top-layer no-clip
//       ruling (an `overflow: auto` frame must NOT clip a promoted popover/menu panel).
// Runs in BOTH Chromium and WebKit (vitest.browser.config.ts → the `site` project's two playwright
// instances), co-located with the module it tests, following component-preview.browser.test.ts.
//
// The foundation CSS cascade (ADR-0003) + the self-defining controls + the icon pack are imported
// explicitly (exactly what _page.ts does for the real page) so the rendered surfaces carry REAL geometry;
// the lib module itself side-effect-imports its own page-local CSS.
import '@agent-ui/components/foundation-styles.css' // foundation tokens + dimensional ramp (FIRST — geometry source)
import '@agent-ui/components/component-styles.css' // per-control CSS (so a surface has real geometry, not 0×0)
import '@agent-ui/components/components' // self-defining ui-* controls (the renderer mounts these by tag)
import '@agent-ui/icons/phosphor' // the Phosphor default pack (document-row-toolbar renders an Icon)
import { buildSeedGallery, buildSeedCard } from './a2ui-gallery.ts'
import { documentRowToolbarSeed } from '@agent-ui/a2ui/examples'

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
