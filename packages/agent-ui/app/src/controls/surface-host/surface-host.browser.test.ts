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

// ── TKT-0084 — [wrap]: content-hugging artboard, cross-engine ──────────────────────────────────────────

/** An unsized host (no fixed width/height style) — the [wrap] contract: the artboard sizes to its
 *  mounted content, not a consumer-imposed box (unlike `mountHost` above). */
function mountWrapHost(): UISurfaceHostElement {
  const el = document.createElement('ui-surface-host') as UISurfaceHostElement
  el.wrap = true
  document.body.append(el)
  mounted.push(el)
  return el
}

describe('ui-surface-host [wrap] — content-hugging artboard (TKT-0084)', () => {
  it('a small surface sizes to its content, not a fixed/fill box — no scroll needed', () => {
    const el = mountWrapHost()
    el.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'w1', catalogId: 'agent-ui' } }))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'w1',
          components: [
            { id: 'root', component: 'Column', children: ['t1', 'btn'] },
            { id: 't1', component: 'Text', variant: 'body', text: 'Small surface' },
            { id: 'btn', component: 'Button', variant: 'solid', label: 'Go', action: { action: 'go' } },
          ],
        },
      }),
    )
    el.finalize()
    const stage = el.querySelector('[data-part="stage"]') as HTMLElement
    const hostRect = el.getBoundingClientRect()
    // Content-hugging: nowhere near the 32rem (512px) wrap cap, and far smaller than mountHost's fixed 400px.
    expect(hostRect.height).toBeLessThan(200)
    expect(hostRect.height).toBeGreaterThan(0)
    // No overflow to reach — content fits entirely within the stage's own box.
    expect(stage.scrollHeight).toBeLessThanOrEqual(stage.clientHeight + 1) // +1: sub-pixel rounding
  })

  it('an empty wrapped surface collapses to the placeholder line, not a huge fixed box', () => {
    const el = mountWrapHost()
    const hostRect = el.getBoundingClientRect()
    expect(hostRect.height).toBeGreaterThan(0)
    expect(hostRect.height).toBeLessThan(100) // one placeholder line + 1rem padding, nowhere near a fixed artboard
  })

  it('component-reviewer CRITICAL regression pin: content taller than the wrap cap stays FULLY scroll-reachable — no `align-items: center` split that strands content above scrollTop 0', () => {
    const el = mountWrapHost()
    el.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'w2', catalogId: 'agent-ui' } }))
    const children: string[] = []
    const components: unknown[] = []
    for (let i = 0; i < 40; i++) {
      const id = `t${i}`
      children.push(id)
      components.push({ id, component: 'Text', variant: 'body', text: `Line ${i} of a long surface` })
    }
    components.push({ id: 'btn', component: 'Button', variant: 'solid', label: 'Stand', action: { action: 'stand' } })
    children.push('btn')
    components.unshift({ id: 'root', component: 'Column', children })
    el.ingest(line({ version: 'v1.0', updateComponents: { surfaceId: 'w2', components } }))
    el.finalize()

    const stage = el.querySelector('[data-part="stage"]') as HTMLElement
    const firstText = el.querySelector('ui-text') as HTMLElement
    const lastButton = el.querySelector('ui-button') as HTMLElement
    expect(stage.scrollHeight).toBeGreaterThan(stage.clientHeight) // genuinely over the cap — the regression's precondition

    // At scrollTop 0, the FIRST content element must be visible at/below the stage's own top edge —
    // NEVER clipped above it (the align-items:center defect rendered it negative-offset and
    // unreachable, since scrollTop cannot go negative to compensate).
    stage.scrollTop = 0
    const stageRectAtTop = stage.getBoundingClientRect()
    const firstRectAtTop = firstText.getBoundingClientRect()
    expect(firstRectAtTop.top).toBeGreaterThanOrEqual(stageRectAtTop.top - 1) // -1: sub-pixel rounding

    // Scrolled to the max, the LAST content element (the action button) must be reachable — its
    // bottom edge at/above the stage's own bottom edge, never permanently below it.
    stage.scrollTop = stage.scrollHeight
    const stageRectAtBottom = stage.getBoundingClientRect()
    const lastRectAtBottom = lastButton.getBoundingClientRect()
    expect(lastRectAtBottom.bottom).toBeLessThanOrEqual(stageRectAtBottom.bottom + 1)
  })
})

// ── GH #241 — [bare]: the chromeless mount, cross-engine ───────────────────────────────────────────────

/** A definite-width column standing in for a chat message column; the host mounts inside it with
 *  BOTH `wrap` (the chat path's TKT-0084 block-axis behavior) and `bare` (GH #241) set — exactly the
 *  pair conversation.ts sets on every inline bubble mount. */
function mountBareHost(): { host: UISurfaceHostElement; column: HTMLDivElement } {
  const column = document.createElement('div')
  column.style.width = '480px'
  document.body.append(column)
  mounted.push(column)
  const host = document.createElement('ui-surface-host') as UISurfaceHostElement
  host.wrap = true
  host.bare = true
  column.append(host)
  return { host, column }
}

const BARE_PAYLOAD = [
  line({ version: 'v1.0', createSurface: { surfaceId: 'b1', catalogId: 'agent-ui' } }),
  line({
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'b1',
      components: [
        { id: 'root', component: 'Column', children: ['t1', 'btn'] },
        { id: 't1', component: 'Text', variant: 'body', text: 'A bare chat surface' },
        { id: 'btn', component: 'Button', variant: 'solid', label: 'Go', action: { action: 'go' } },
      ],
    },
  }),
]

describe('ui-surface-host [bare] — the chromeless chat mount (GH #241)', () => {
  it('strips ALL wrapper chrome: no checker/background image, no background color, zero padding', () => {
    const { host } = mountBareHost()
    for (const l of BARE_PAYLOAD) host.ingest(l)
    host.finalize()
    const stage = host.querySelector('[data-part="stage"]') as HTMLElement
    const surface = host.querySelector('[data-part="surface"]') as HTMLElement
    const stageStyle = getComputedStyle(stage)
    expect(stageStyle.backgroundImage, 'the checker gradients survived [bare]').toBe('none')
    expect(alphaOf(stageStyle.backgroundColor), 'the stage color survived [bare]').toBe(0)
    const surfaceStyle = getComputedStyle(surface)
    // longhands, not the `padding` shorthand — cross-engine computed-shorthand serialization differs.
    for (const side of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const) {
      expect(surfaceStyle[side], `the surface ${side} survived [bare]`).toBe('0px')
    }
  })

  it('full available width: the host AND the surface content box span the column (rect-compared), and the mount boundary is restored', () => {
    const { host, column } = mountBareHost()
    for (const l of BARE_PAYLOAD) host.ingest(l)
    host.finalize()
    const surface = host.querySelector('[data-part="surface"]') as HTMLElement
    const columnWidth = column.getBoundingClientRect().width
    expect(host.getBoundingClientRect().width, 'the host does not span the column').toBeCloseTo(columnWidth, 0)
    // zero padding ⇒ the surface's border-box IS its content box — the rect compare covers both.
    expect(surface.getBoundingClientRect().width, 'the surface does not span the column').toBeCloseTo(columnWidth, 0)
    // ADR-0100 cl.2 — an externally-definite 100% inline-size QUALIFIES as the query container again:
    // [bare] restores what plain [wrap] had to drop.
    expect(getComputedStyle(surface).containerType).toBe('inline-size')
  })

  it('negative control: WITHOUT [bare] the checkered docs-preview artboard is untouched', () => {
    const el = mountHost()
    const stage = el.querySelector('[data-part="stage"]') as HTMLElement
    const surface = el.querySelector('[data-part="surface"]') as HTMLElement
    expect(getComputedStyle(stage).backgroundImage, 'the docs-preview checker vanished fleet-wide').not.toBe('none')
    expect(getComputedStyle(surface).paddingTop).not.toBe('0px')
  })
})
