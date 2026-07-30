import { describe, it, expect, afterEach } from 'vitest'
import { page, server, userEvent } from 'vitest/browser'
import './nav-rail.ts'

// nav-rail.visual.browser.test.ts — the PIXEL gate for `collapse="menu"`'s open flyout card (GH #368,
// Kim's ruling 2; the ADR-0110 harness, calendar.visual.browser.test.ts's precedent).
//
// FIRST visual test in `@agent-ui/app`: the `visual` project globs `**/*.visual.browser.test.ts` from the
// repo root, so no config edit is needed — but the run is checked for a NON-ZERO collected test count
// rather than assumed, because a silently unmatched file would look exactly like a pass.
//
// WHY pixels here at all, when nav-rail.browser.test.ts already measures the card: those assertions each
// read ONE property. The defect GH #368 reported was a GESTALT — a full-bleed band whose side borders sat
// on the rail's own edges and therefore read as the shell's edge rather than the menu's own outline. That
// is a "does it look like a card" claim, and only a baseline can hold it. Two legs:
//   (a) card    — the open flyout below its trigger: four borders, content-driven width, the anchor offset.
//   (b) clipper — the same panel opened inside a 44px `overflow: hidden` ancestor, escaping it. The pixels
//                 of SPEC-R5 AC3; a `position: absolute` panel would be sliced off at the clipper's edge.
//
// Chromium-only (ADR-0110 Decision 2): the `visual` project still launches from a chromium-only instance
// list, and `it.skipIf(server.browser !== 'chromium')` is the ADR's named belt-and-braces fallback. WebKit
// keeps the computed-style/whole-shape legs in nav-rail.browser.test.ts as its sanctioned proof.
//
// DETERMINISM. Three things are pinned deliberately:
//   1. No clock, no random, no network — the fixture is a literal item list.
//   2. The stage is mounted at the TOP of the viewport and is tall enough to contain the panel, so
//      overlay()'s flip/shift always resolves `bottom-start` and the shot always frames trigger + card.
//      (Measured on the live docs page, a rail low in a tall document legitimately flips to `top-start` —
//      correct behaviour, but it would make an unpinned fixture's framing position-dependent.)
//   3. The trigger's chevron carries a `transform` transition, so every leg settles past its duration
//      before capture; a mid-rotation chevron is sub-tolerance churn on every run.
//
// The trailing `data-role="tag"` cell is deliberately ABSENT from the selected row: the trigger's label
// derives from the selected item's whole `textContent`, which today concatenates label + tag ("Buttonnew").
// That is a pre-existing defect in that derivation, reported rather than fixed in this wave — and a
// baseline must not freeze it in as the reference.
//
// Side-effect imports — CSS load order (ADR-0003): foundation roles + dimensional ramp FIRST, then the
// components barrel, then this family's CSS.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import './nav-rail.css'

const mounted: HTMLElement[] = []

afterEach(() => {
  while (mounted.length) {
    const stage = mounted.pop()!
    for (const panel of stage.querySelectorAll<HTMLElement>('[data-part="list"][popover]')) {
      try {
        panel.hidePopover()
      } catch {
        /* already hidden */
      }
    }
    stage.remove()
  }
})

/** Settle layout, the band observer's arming callback, the queued popover ToggleEvent, and the chevron's
 *  own transform transition — everything that can still be moving at capture time. */
async function settle(): Promise<void> {
  await new Promise((r) => requestAnimationFrame(() => r(undefined)))
  await new Promise((r) => setTimeout(r, 0))
  await new Promise((r) => requestAnimationFrame(() => r(undefined)))
  await new Promise((r) => setTimeout(r, 400)) // > --md-sys-motion-duration-fast, the chevron rotation
}

/**
 * A fixed 300px × `blockSize` stage pinned to the TOP-LEFT of the viewport. Absolute placement is what
 * makes the framing reproducible: the trigger always lands at a known y, so the panel always resolves
 * `bottom-start` and always falls inside the stage's own rect — which is the box the screenshot clips to.
 */
function stage(blockSize: string, extra?: (el: HTMLElement) => void): HTMLElement {
  const el = document.createElement('div')
  el.style.position = 'fixed'
  el.style.inset = '0 auto auto 0'
  el.style.inlineSize = '300px'
  el.style.blockSize = blockSize
  el.style.background = 'var(--md-sys-color-neutral-surface-lowest)'
  extra?.(el)
  document.body.append(el)
  mounted.push(el)
  return el
}

/** The grouped, link-shaped menu rail both baselines frame — SPEC-R6 anatomy, no tag on the selected row. */
function menuRail(): HTMLElement {
  const rail = document.createElement('ui-nav-rail')
  rail.setAttribute('collapse', 'menu')
  const groups: [string, [string, boolean][]][] = [
    [
      'Components',
      [
        ['Button', true],
        ['Select', false],
        ['Text Field', false],
      ],
    ],
    ['Guides', [['Theming', false]]],
  ]
  for (const [label, items] of groups) {
    const group = document.createElement('ui-nav-rail-group')
    group.setAttribute('label', label)
    for (const [text, selected] of items) {
      const item = document.createElement('ui-nav-rail-item')
      item.setAttribute('href', `#${text.toLowerCase().replace(/ /g, '-')}`)
      if (selected) item.setAttribute('selected', '')
      item.textContent = text
      group.append(item)
    }
    rail.append(group)
  }
  return rail
}

describe('ui-nav-rail collapse="menu" — the open flyout card, pinned (GH #368, ADR-0110 harness)', () => {
  it.skipIf(server.browser !== 'chromium')(
    '(a) card: the open panel is a content-sized, four-side-bordered card offset below its trigger',
    async () => {
      const host = stage('320px')
      const rail = menuRail()
      host.append(rail)
      await settle()

      const trigger = rail.querySelector<HTMLElement>(':scope > [data-part="trigger"]')!
      const list = rail.querySelector<HTMLElement>(':scope > [data-part="list"]')!
      // Anti-vacuous: a baseline of a CLOSED rail would pass forever. Prove the card is really open, really
      // in the top layer, and really narrower than the rail before a single pixel is compared.
      expect(list.getAttribute('popover'), `${server.browser}: the narrow band did not arm the overlay`).toBe('auto')
      await userEvent.click(trigger)
      await settle()
      expect(list.matches(':popover-open'), `${server.browser}: the card never opened`).toBe(true)
      expect(list.getAttribute('data-placement'), `${server.browser}: the fixture did not resolve bottom-start`).toBe(
        'bottom-start',
      )
      expect(
        list.getBoundingClientRect().width,
        `${server.browser}: the card is full-bleed against the rail — the GH #368 defect`,
      ).toBeLessThan(rail.getBoundingClientRect().width)

      await expect.element(page.elementLocator(host)).toMatchScreenshot('nav-rail-menu-flyout-card')
    },
  )

  it.skipIf(server.browser !== 'chromium')(
    '(b) clipper: the same card opened inside a 44px overflow:hidden ancestor escapes it (SPEC-R5 AC3)',
    async () => {
      // The stage is the SHOT frame; the clipper inside it is the 44px box that would slice a
      // position:absolute panel off at its own bottom edge.
      const host = stage('320px')
      const clipper = document.createElement('div')
      clipper.style.inlineSize = '300px'
      clipper.style.blockSize = '44px'
      clipper.style.overflow = 'hidden'
      // A FIXTURE marker, not a component style: a literal-colour dashed outline draws on the clipper's own
      // border box and is itself unclipped, so the baseline SHOWS where the clip boundary is and shows the
      // card crossing it. Without it these pixels come out byte-identical to leg (a) — which is a true and
      // rather elegant statement of AC3 (a clipping ancestor changes NOTHING about how the card renders),
      // but it stores the same bytes twice and tells a reviewer nothing they can see.
      clipper.style.outline = '2px dashed #c0392b'
      const rail = menuRail()
      clipper.append(rail)
      host.append(clipper)
      await settle()

      const trigger = rail.querySelector<HTMLElement>(':scope > [data-part="trigger"]')!
      const list = rail.querySelector<HTMLElement>(':scope > [data-part="list"]')!
      await userEvent.click(trigger)
      await settle()
      expect(list.matches(':popover-open'), `${server.browser}: the card never opened`).toBe(true)
      // Anti-vacuous: the panel must GENUINELY extend past the clipper, or these pixels prove nothing.
      expect(
        list.getBoundingClientRect().bottom,
        `${server.browser}: the panel does not extend past the clipper, so this baseline would be vacuous`,
      ).toBeGreaterThan(clipper.getBoundingClientRect().bottom + 4)

      await expect.element(page.elementLocator(host)).toMatchScreenshot('nav-rail-menu-flyout-unclipped')
    },
  )
})
