import { describe, it, expect, afterEach } from 'vitest'
import { page, server } from 'vitest/browser'

// super-shell.visual.browser.test.ts — GH #383 finding 3: the DARK-SCHEME pixel witness for the floating
// overlay card's edge (GH #381/#382, `--ui-super-shell-overlay-outline`).
//
// WHY THIS EXISTS AT ALL, given super-shell-bar-seam.browser.test.ts already measures the border
// cross-engine. That suite reads computed properties — four widths, four colours, a repoint. It proves the
// declaration lands. It cannot prove the resulting card is VISIBLE, and visibility is the entire bug: #381
// was `neutral-surface` on `neutral-surface` in the dark scheme, an edge that computed correctly and could
// not be seen. The two existing pixel baselines for this surface are both LIGHT-scheme
// (`docs-chrome-narrow-open`, `nav-rail-menu-flyout-card`), so the one scheme the defect lived in had no
// pixel coverage. This is that coverage: one leg, one baseline.
//
// DARK IS SET LOCALLY, on the stage's own `color-scheme`, not on the document root. `light-dark()` resolves
// against the element's USED color-scheme and `color-scheme` inherits, so a stage-level declaration darkens
// exactly this subtree and needs no global teardown — a root-level flip would leak into any sibling file
// sharing the page. The leg asserts the dark arm actually resolved before it compares a pixel; a scheme
// that silently stayed light would otherwise store a light baseline under a dark name, forever.
//
// FOCUS IS BLURRED BEFORE THE CAPTURE, and that is the #382 build's own hard-won lesson rather than
// housekeeping: `#openOverlay` moves focus into the pane's landing box, so a programmatic open paints a
// focus ring straight along the card's edge — the very pixels this baseline exists to witness. Measured on
// this campaign's own evidence captures: with focus left in place the card's right edge read
// `rgb(53,123,205)` (the ring), not the neutral hairline.
//
// Chromium-only, per ADR-0110 Decision 2 and the nav-rail visual precedent; WebKit's sanctioned proof for
// this surface stays the computed-style suite.
//
// Side-effect imports — CSS load order (ADR-0003): foundation roles + dimensional ramp FIRST, then the
// components barrel, then this family's CSS.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import './super-shell.css'
import { UISuperShellElement } from './super-shell.ts'

const mounted: HTMLElement[] = []
afterEach(() => { for (const el of mounted.splice(0)) el.remove() })

const SHELL_INLINE = 320 // < the 40rem/640px narrow line, so the band overlay arm is the one under test
const SHELL_BLOCK = 260

/** Layout, the shell's own band/fit observers, and the queued overlay state, all settled before capture. */
async function settle(): Promise<void> {
  await new Promise((r) => requestAnimationFrame(() => r(undefined)))
  await new Promise((r) => setTimeout(r, 0))
  await new Promise((r) => requestAnimationFrame(() => r(undefined)))
}

describe('ui-super-shell — the floating overlay card in the DARK scheme, pinned (GH #383, ADR-0110 harness)', () => {
  it.skipIf(server.browser !== 'chromium')(
    'the narrow overlay card reads as a bounded card against the dark canvas, not an unbounded bleed',
    async () => {
      const el = document.createElement('ui-super-shell') as UISuperShellElement
      el.style.position = 'fixed'
      el.style.inset = '0 auto auto 0'
      el.style.inlineSize = `${SHELL_INLINE}px`
      el.style.blockSize = `${SHELL_BLOCK}px`
      el.style.colorScheme = 'dark'
      // The canvas region paints nothing of its own, so without this the harness page's UA-white body
      // shows through it and the scrim washes that to mid-grey — a card sitting on a LIGHT backdrop under a
      // dark-named baseline, which is the opposite of the claim. Caught on the first generated artifact.
      // A fixture backdrop in the component's own surface role (nav-rail.visual's stage precedent), so the
      // card↔canvas pairing under test is the real `neutral-surface`-on-`neutral-surface` one from #381.
      el.style.background = 'var(--md-sys-color-neutral-surface)'
      el.setAttribute('narrow-start', 'collapse')
      for (const slot of ['header', 'nav-pane', 'content'] as const) {
        const child = document.createElement('div')
        child.setAttribute('data-slot', slot)
        child.textContent = slot
        el.append(child)
      }
      document.body.append(el)
      mounted.push(el)
      await settle()

      // (1) The scheme really is dark. A probe painted with the surface role, read as a colour: the light
      // arm of this role is near-white, the dark arm near-black, so a mean channel well under mid-grey is
      // an unambiguous statement that `light-dark()` took the dark branch here.
      const probe = document.createElement('div')
      probe.style.color = 'var(--md-sys-color-neutral-surface)'
      el.append(probe)
      const surface = getComputedStyle(probe).color
      probe.remove()
      const channels = surface.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? []
      expect(channels.length, `the surface role must resolve to a real colour, got ${surface}`).toBe(3)
      expect(
        channels.reduce((a, b) => a + b, 0) / 3,
        `the stage did not resolve the DARK arm — this baseline would silently be a light-scheme shot (${surface})`,
      ).toBeLessThan(96)

      // (2) The overlay is really open, really floating, and really bordered — three anti-vacuity gates, in
      // the order they can fail. A closed or in-flow card would give a perfectly stable, perfectly useless
      // baseline.
      const toggle = el.querySelector<HTMLElement>('[data-part="side-toggle"][data-side="start"]')!
      expect(toggle, 'the collapse side must compose a toggle, or nothing can open').not.toBeNull()
      toggle.click()
      await settle()
      expect(el.getAttribute('data-narrow-open'), 'the overlay never opened').toBe('start')
      const card = el.querySelector<HTMLElement>('[data-part="pane"][data-side="start"]')!
      expect(getComputedStyle(card).position, 'the card is in flow — the floating arm is not live').toBe('absolute')
      expect(getComputedStyle(card).borderInlineEndWidth, 'the card draws no edge — nothing to witness').toBe('1px')

      // (3) The frame is mostly card, or the comparator's whole-shot ratio absorbs a real change
      // (nav-rail.visual.browser.test.ts's measured lesson, same tolerance).
      const cardRect = card.getBoundingClientRect()
      const frameRect = el.getBoundingClientRect()
      expect(
        (cardRect.width * cardRect.height) / (frameRect.width * frameRect.height),
        'the shot is mostly dead space — the comparator would absorb a real visual change',
      ).toBeGreaterThan(0.5)

      // (4) Blur before the shutter — see the header. Asserted, not assumed: `blur()` on a focused element
      // inside the pane returns focus to <body>, and a stray ring is exactly the artifact that made the
      // existing light baseline unusable as evidence.
      ;(document.activeElement as HTMLElement | null)?.blur()
      await settle()
      expect(
        card.contains(document.activeElement),
        'focus is still inside the card — the capture would paint a focus ring along the very edge under test',
      ).toBe(false)

      await expect.element(page.elementLocator(el)).toMatchScreenshot('super-shell-overlay-card-dark', {
        // GH #383 — THE PROJECT DEFAULTS CANNOT SEE A HAIRLINE, measured on this very leg. The negative
        // control (repoint `--ui-super-shell-overlay-outline` to the card's own surface colour: the #381
        // defect exactly, an edge that still computes 1px and cannot be seen) reported, at zero tolerance:
        //   includeAA: false, threshold: 0.1  ->    1 pixel  · the project default. Blind.
        //   includeAA: true,  threshold: 0.1  ->    7 pixels · AA discard was only half the story.
        //   includeAA: true,  threshold: 0.02 ->  997 pixels · the whole perimeter, 2*(252+236) as predicted.
        // Two independent absorbers, so both must be lifted: pixelmatch classifies a 1px line between two
        // different fills as ANTIALIASING and drops it, and the surviving colour delta (dark
        // outline-variant vs surface — the 1.50:1 pairing GH #383 finding 4 is about) sits under the 0.1
        // per-pixel YIQ threshold. This is the same family as nav-rail.visual's measured "small-text
        // typography does NOT police" note, one step further: THIN INK does not police either.
        // The tolerance is then set BELOW the measured signal rather than at the project default (0.01,
        // which 0.012 would clear by a hair): 0.004 leaves ~3x margin, and the stability of that margin was
        // checked, not assumed — three consecutive check-mode runs, zero mismatched pixels each.
        comparatorOptions: { includeAA: true, threshold: 0.02, allowedMismatchedPixelRatio: 0.004 },
      })
    },
  )
})
