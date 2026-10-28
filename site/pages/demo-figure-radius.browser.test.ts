import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts its .demo-figure specimens and its .event-log into the document
// (the swatch-demo.browser.test.ts precedent).
import './swatch-demo.ts'

vi.setConfig({ testTimeout: 30_000 }) // REAL-TIMING HEADROOM (GH #347): rAF settles stretch under host load

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

/** The card-level corner in px, resolved by the engine from the same token a ui-card paints (ADR-0245). */
function cardRadius(host: Element): number {
  const probe = document.createElement('div')
  probe.style.cssText = 'border-radius: var(--md-sys-card-radius); inline-size: 100px; block-size: 100px; position: absolute; visibility: hidden'
  host.parentElement!.append(probe)
  const px = parseFloat(getComputedStyle(probe).borderTopLeftRadius)
  probe.remove()
  return px
}

describe('site demo frames take the card-level radius (T-0497)', () => {
  // A frame that holds controls or text directly is a leaf container: its own level's radius, not the concentric
  // card radius plus margin a wrapper around an inner card takes (ADR-0245 Amendment 5 clause 3, Kim 2026-10-28).
  for (const selector of ['.demo-figure', '.event-log']) {
    it(`${selector} reads the card radius at regular density`, async () => {
      await raf()
      const el = document.querySelector(selector)
      expect(el, `no ${selector} on the swatch demo`).not.toBeNull()
      const want = cardRadius(el!)
      expect(want).toBeGreaterThan(0)
      expect(want).toBeCloseTo(12, 0)
      expect(parseFloat(getComputedStyle(el!).borderTopLeftRadius)).toBeCloseTo(want, 1)
    })
  }
})
