import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// ADR-0199 / GH #1104 — the :state(working) breathing treatment's real-engine leg (S4 of the
// working-state decomp). jsdom has no CustomStateSet in every environment and never computes
// animations, so BOTH halves of the contract are proven here, cross-engine (Chromium + WebKit):
//   (1) with `working` set, the surface part's ::before overlay carries the breathe animation
//       (computed animation-name) and its computed OPACITY genuinely changes across rAF samples —
//       the animation actually runs, not merely parses;
//   (2) under emulated `prefers-reduced-motion: reduce` (CDP, Chromium leg only — WebKit exposes no
//       CDP media emulation, the button-states.browser.test.ts documented split) the animation is
//       OFF and the overlay is held STATIC at the max rung (0.55) — "static, never nothing"
//       (ADR-0199 cl.3).
import '@agent-ui/shared/tokens.css'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import './surface-host.css'
import { UISurfaceHostElement } from './surface-host.ts'
import { whenFlushed } from '@agent-ui/components'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

function mountHost(): UISurfaceHostElement {
  const el = document.createElement('ui-surface-host') as UISurfaceHostElement
  el.style.display = 'block'
  el.style.width = '400px'
  el.style.height = '300px'
  document.body.append(el)
  mounted.push(el)
  return el
}

const surfaceOf = (el: UISurfaceHostElement): HTMLElement => el.querySelector('[data-part="surface"]') as HTMLElement

const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()))
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

describe('ui-surface-host — :state(working) breathes for real (ADR-0199, cross-engine)', () => {
  it('setting `working` applies the custom state and the ::before overlay runs the breathe animation (opacity delta across samples)', async () => {
    const el = mountHost()
    el.working = true
    await whenFlushed()
    expect(el.matches(':state(working)'), 'the internals custom state is selector-visible').toBe(true)

    const overlay = () => getComputedStyle(surfaceOf(el), '::before')
    expect(overlay().animationName, 'the breathe keyframes are the computed animation').toBe('ui-surface-host-breathe')
    expect(overlay().boxShadow, 'the diffused INNER shadow is painted').toContain('inset')
    // GH #1104 refinement — the overlay carries a real rounded radius (the fleet shape chain via
    // --ui-surface-host-working-radius), in BOTH mount modes: the plain docs-preview mount here...
    expect(parseFloat(overlay().borderRadius), 'square overlay in the plain mount').toBeGreaterThan(0)
    // ...and the chat-composition mount shape ([wrap][bare] — what conversation.ts sets inline).
    el.setAttribute('wrap', '')
    el.setAttribute('bare', '')
    await whenFlushed()
    expect(parseFloat(overlay().borderRadius), 'square overlay in the [wrap][bare] mount').toBeGreaterThan(0)

    // The animation genuinely RUNS: computed opacity moves between the rungs across real frames.
    // 1600ms/half-cycle over a 0.15→0.55 range ⇒ ~0.075 over 300ms; assert a conservative delta.
    await nextFrame()
    const first = Number(overlay().opacity)
    await wait(300)
    await nextFrame()
    const second = Number(overlay().opacity)
    expect(Math.abs(second - first), `opacity did not move (first=${first}, second=${second})`).toBeGreaterThan(0.02)
    // Both samples sit inside the two rungs (the keyframes animate opacity ONLY, between min and max).
    for (const v of [first, second]) {
      expect(v).toBeGreaterThanOrEqual(0.15 - 0.001)
      expect(v).toBeLessThanOrEqual(0.55 + 0.001)
    }
  })

  it('clearing `working` removes the state and the overlay animation with it', async () => {
    const el = mountHost()
    el.working = true
    await whenFlushed()
    expect(el.matches(':state(working)')).toBe(true)
    el.working = false
    await whenFlushed()
    expect(el.matches(':state(working)')).toBe(false)
    expect(getComputedStyle(surfaceOf(el), '::before').animationName).toBe('none')
  })

  it('prefers-reduced-motion: reduce ⇒ STATIC, never nothing — animation off, overlay held at the max rung (Chromium CDP leg)', async () => {
    const el = mountHost()
    el.working = true
    await whenFlushed()

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP media emulation (the documented split) — assert we are genuinely NOT in
      // reduced-motion (so the Chromium proof is not silently faked), and stop.
      expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    try {
      expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true)
      await nextFrame()
      const overlay = getComputedStyle(surfaceOf(el), '::before')
      expect(overlay.animationName, 'reduced motion did not stop the breathe loop').toBe('none')
      // "static, never nothing": the vignette is HELD at the max rung — a constant visible indicator.
      expect(Number(overlay.opacity)).toBeCloseTo(0.55, 2)
      expect(overlay.boxShadow, 'the static vignette is still painted').toContain('inset')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
