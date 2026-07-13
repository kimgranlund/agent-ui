import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// LLD-C3's cross-engine leg — jsdom cannot resolve painted CSS Grid/checkered-background/forced-colors
// geometry. Runs in BOTH Chromium and WebKit (vitest.browser.config.ts). Covers: whole-shape (non-zero
// stage/surface boxes, SPEC-R2 AC1), a REAL A2UI stream rendering a real interactive control, and
// forced-colors legibility of the mounted control (SPEC-R11 AC2) — the decorative checkered stage itself
// is allowed to simplify.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import './surface-host.css'
import { UISurfaceHostElement } from './surface-host.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const line = (obj: unknown): string => JSON.stringify(obj)

function mountHost(width = '400px', height = '400px'): UISurfaceHostElement {
  const el = document.createElement('ui-surface-host') as UISurfaceHostElement
  el.style.display = 'block'
  el.style.width = width
  el.style.height = height
  document.body.append(el)
  mounted.push(el)
  return el
}

/** Alpha of a computed colour — 0 ⇒ vanished, > 0 ⇒ painted (the card.browser.test.ts/app-shell.browser.test.ts helper). */
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

describe('ui-surface-host cross-engine smoke — whole-shape (SPEC-R2 AC1)', () => {
  it('the stage/surface pair are real, non-zero-area boxes filling the host', () => {
    const el = mountHost()
    const stage = el.querySelector('[data-part="stage"]') as HTMLElement
    const surface = el.querySelector('[data-part="surface"]') as HTMLElement
    const hostRect = el.getBoundingClientRect()
    const stageRect = stage.getBoundingClientRect()
    expect(stageRect.width).toBeCloseTo(hostRect.width, 0)
    expect(stageRect.height).toBeCloseTo(hostRect.height, 0)
    expect(surface.getBoundingClientRect().width).toBeGreaterThan(0)
  })

  it('a REAL A2UI stream renders a real interactive ui-button inside the surface, click round-trips a client message', () => {
    const el = mountHost()
    const received: unknown[] = []
    el.onClientMessage((m) => received.push(m))
    el.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } }))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's1',
          components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Go', action: { action: 'go' } }],
        },
      }),
    )
    el.finalize()
    const btn = el.querySelector('ui-button') as HTMLElement
    expect(btn).not.toBeNull()
    const rect = btn.getBoundingClientRect()
    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)
    btn.click()
    expect(received).toHaveLength(1)
  })
})

describe('ui-surface-host cross-engine smoke — forced-colors legibility (SPEC-R11 AC2)', () => {
  it('the mounted control stays legible under forced-colors — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    const el = mountHost()
    el.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's2', catalogId: 'agent-ui' } }))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's2',
          components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Go' }],
        },
      }),
    )
    el.finalize()
    const btn = el.querySelector('ui-button') as HTMLElement

    // Baseline (BOTH engines): the button paints a visible background.
    expect(alphaOf(getComputedStyle(btn).backgroundColor), 'baseline button is invisible').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      const rect = btn.getBoundingClientRect()
      expect(rect.width).toBeGreaterThan(0)
      expect(rect.height).toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
