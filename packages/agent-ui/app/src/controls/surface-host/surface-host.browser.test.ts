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

// ── GH #241 → GH #1150 — [bare]: the chat mount (no artboard chrome; structural card containment) ─────

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

describe('ui-surface-host [bare] — the chat mount: no artboard chrome, STRUCTURAL card containment (GH #241 → GH #1150)', () => {
  it('strips the ARTBOARD chrome (no checker image, no stage color) but the surface carries its own card chrome — real padding, a painted background, a real border (GH #1150)', () => {
    const { host } = mountBareHost()
    for (const l of BARE_PAYLOAD) host.ingest(l)
    host.finalize()
    const stage = host.querySelector('[data-part="stage"]') as HTMLElement
    const surface = host.querySelector('[data-part="surface"]') as HTMLElement
    const stageStyle = getComputedStyle(stage)
    expect(stageStyle.backgroundImage, 'the checker gradients survived [bare]').toBe('none')
    expect(alphaOf(stageStyle.backgroundColor), 'the stage color survived [bare]').toBe(0)
    // GH #1150 — the structural card: containment is the HOST's, never producer-dependent.
    const surfaceStyle = getComputedStyle(surface)
    // longhands, not the `padding` shorthand — cross-engine computed-shorthand serialization differs.
    for (const side of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const) {
      expect(Number.parseFloat(surfaceStyle[side]), `the bare surface lost its card ${side} (GH #1150 regressed)`).toBeGreaterThan(0)
    }
    expect(alphaOf(surfaceStyle.backgroundColor), 'the bare surface lost its card background (GH #1150 regressed)').toBeGreaterThan(0)
    expect(Number.parseFloat(surfaceStyle.borderTopWidth), 'the bare surface lost its card border (GH #1150 regressed)').toBeGreaterThan(0)
    expect(Number.parseFloat(surfaceStyle.borderTopLeftRadius), 'the bare surface lost its card radius (GH #1150 regressed)').toBeGreaterThan(0)
  })

  it('GH #1150 regression — a bare-Column-rooted payload (no Card) is still CONTAINED: content sits inset from every surface edge by at least the card padding', () => {
    const { host } = mountBareHost()
    for (const l of BARE_PAYLOAD) host.ingest(l)
    host.finalize()
    const surface = host.querySelector('[data-part="surface"]') as HTMLElement
    const root = surface.firstElementChild as HTMLElement
    expect(root, 'no root mounted').not.toBeNull()
    const s = surface.getBoundingClientRect()
    const r = root.getBoundingClientRect()
    const pad = Number.parseFloat(getComputedStyle(surface).paddingTop)
    expect(pad).toBeGreaterThan(0)
    expect(r.top - s.top, 'content flush to the top edge (GH #1150)').toBeGreaterThanOrEqual(pad)
    expect(r.left - s.left, 'content flush to the left edge (GH #1150)').toBeGreaterThanOrEqual(pad)
    expect(s.right - r.right, 'content flush to the right edge (GH #1150)').toBeGreaterThanOrEqual(pad)
    expect(s.bottom - r.bottom, 'content flush to the bottom edge (GH #1150)').toBeGreaterThanOrEqual(pad)
  })

  it('full available width: the host AND the surface border box span the column (rect-compared), and the mount boundary is restored', () => {
    const { host, column } = mountBareHost()
    for (const l of BARE_PAYLOAD) host.ingest(l)
    host.finalize()
    const surface = host.querySelector('[data-part="surface"]') as HTMLElement
    const columnWidth = column.getBoundingClientRect().width
    expect(host.getBoundingClientRect().width, 'the host does not span the column').toBeCloseTo(columnWidth, 0)
    // border-box sizing (box-sizing: border-box on the surface) ⇒ the border box spans the column;
    // the card padding lives INSIDE it (GH #1150).
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

// ── GH #892 — a rendered surface's ROOT fills its container's available width, cross-engine ────────────
//
// `applyRootStretch`'s ui-column-only check left every OTHER layout-primitive root (Row/Card/List/Grid)
// shrink-wrapped to content under the mount's `align-items: center` — the reported symptom ("cards in the
// test-chat bubbles don't use the available width"). These measure the two mount shapes the fix touches:
// the chromeless in-bubble mount ([wrap][bare], conversation.ts's exact composition) and the chromed
// checkered artboard (the docs-preview/canvas shape, unbare) — plus the named exception (an intrinsic
// control root stays its own natural width in EITHER shape).

/** The surface's own CONTENT-box width — subtracts its own padding AND border (GH #1150: the bare chat
 *  surface carries structural card chrome now) so a Row/Card root's rect is compared against the box it
 *  actually has to fill, not the padding/border-inclusive border box. */
const contentWidth = (el: HTMLElement): number => {
  const cs = getComputedStyle(el)
  return (
    el.getBoundingClientRect().width -
    parseFloat(cs.paddingLeft) -
    parseFloat(cs.paddingRight) -
    parseFloat(cs.borderLeftWidth) -
    parseFloat(cs.borderRightWidth)
  )
}

describe('ui-surface-host — GH #892: a Row/Card root fills the mount, an intrinsic root does not', () => {
  it('[wrap][bare] in-bubble mount: a Row root fills the message column width (conversation.ts shape)', () => {
    const { host, column } = mountBareHost()
    host.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'r1', catalogId: 'agent-ui' } }))
    host.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'r1',
          components: [
            { id: 'root', component: 'Row', gap: 'md', children: ['b1', 'b2'] },
            { id: 'b1', component: 'Button', variant: 'soft', label: 'One' },
            { id: 'b2', component: 'Button', variant: 'soft', label: 'Two' },
          ],
        },
      }),
    )
    host.finalize()
    const surface = host.querySelector('[data-part="surface"]') as HTMLElement
    const root = surface.firstElementChild as HTMLElement
    expect(root.tagName.toLowerCase()).toBe('ui-row')
    // GH #1150 — the surface's border box spans the column; the root fills the surface's CONTENT box
    // (inside the structural card padding/border), never flush to the column edge anymore.
    const columnWidth = column.getBoundingClientRect().width
    expect(surface.getBoundingClientRect().width, 'the surface does not span the bubble column').toBeCloseTo(columnWidth, 0)
    expect(root.getBoundingClientRect().width, 'the Row root did not fill the surface content box').toBeCloseTo(contentWidth(surface), 0)
  })

  it('chromed checkered artboard (unbare): a Card root fills the artboard content box, up to its 32rem cap', () => {
    const el = mountHost('700px', '400px') // wider than the 32rem/512px cap — proves the cap, not the host, bounds it
    el.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'c1', catalogId: 'agent-ui' } }))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'c1',
          components: [
            { id: 'root', component: 'Card', children: ['s_content'] },
            { id: 's_content', component: 'CardContent', children: ['s_text'] },
            { id: 's_text', component: 'Text', variant: 'body', text: 'A rendered card.' },
          ],
        },
      }),
    )
    el.finalize()
    const surface = el.querySelector('[data-part="surface"]') as HTMLElement
    const root = surface.firstElementChild as HTMLElement
    expect(root.tagName.toLowerCase()).toBe('ui-card')
    expect(root.getBoundingClientRect().width, 'the Card root did not fill the artboard').toBeCloseTo(contentWidth(surface), 0)
  })

  it('negative control: a lone Button root (an intrinsic control) stays its own natural width in BOTH mount shapes', () => {
    // Chromed artboard shape.
    const canvas = mountHost()
    canvas.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'btn1', catalogId: 'agent-ui' } }))
    canvas.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 'btn1', components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Go' }] },
      }),
    )
    canvas.finalize()
    const canvasSurface = canvas.querySelector('[data-part="surface"]') as HTMLElement
    const canvasBtn = canvasSurface.firstElementChild as HTMLElement
    expect(canvasBtn.getBoundingClientRect().width, 'a lone Button root was force-stretched in the artboard').toBeLessThan(
      contentWidth(canvasSurface) * 0.5,
    )

    // In-bubble shape.
    const { host: bubble, column } = mountBareHost()
    bubble.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'btn2', catalogId: 'agent-ui' } }))
    bubble.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 'btn2', components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Go' }] },
      }),
    )
    bubble.finalize()
    const bubbleSurface = bubble.querySelector('[data-part="surface"]') as HTMLElement
    const bubbleBtn = bubbleSurface.firstElementChild as HTMLElement
    const columnWidth = column.getBoundingClientRect().width
    expect(bubbleBtn.getBoundingClientRect().width, 'a lone Button root was force-stretched in the bubble').toBeLessThan(
      columnWidth * 0.5,
    )
  })
})

// ── GH #742/ADR-0183 Amendment — view transitions on RE-RENDERS, real platform (the jsdom half stubs
// the API; this is the genuine startViewTransition where the engine ships it, and the feature-detect
// honesty where it does not — the router probe's established split) ───────────────────────────────────
describe('ui-surface-host — viewTransitions against the real platform (GH #742)', () => {
  const hasApi = typeof (document as { startViewTransition?: unknown }).startViewTransition === 'function'

  const CREATE = (id: string): string => line({ version: 'v1.0', createSurface: { surfaceId: id, catalogId: 'agent-ui' } })
  const ROOT = (id: string, label: string): string =>
    line({
      version: 'v1.0',
      updateComponents: {
        surfaceId: id,
        components: [
          { id: 'root', component: 'Column', children: ['t1'] },
          { id: 't1', component: 'Text', text: label },
        ],
      },
    })

  it(`${server.browser}: an opted-in RE-RENDER still lands the update (API ${hasApi ? 'present — through a real transition' : 'ABSENT — the sync fallback, byte-identical behavior'})`, async () => {
    const el = mountHost()
    el.viewTransitions = true
    el.ingest(CREATE('vt-live'))
    el.ingest(ROOT('vt-live', 'first paint'))
    // first paint is synchronous BY CONTRACT even opted-in (pre-settle) — no polling, which IS the assertion
    expect(el.textContent).toContain('first paint')
    el.finalize()

    el.ingest(ROOT('vt-live', 'second paint')) // the re-render — through a real transition where the API exists
    el.finalize()
    for (let i = 0; i < 40 && !el.textContent!.includes('second paint'); i++) await new Promise((r) => requestAnimationFrame(r))
    expect(el.textContent).toContain('second paint')
  })

  it(`${server.browser}: reduced motion forces the SYNC path even where the API exists (Chromium CDP; WebKit asserts its own real availability)`, async () => {
    if (server.browser !== 'chromium') {
      const { viewTransitionAvailable } = await import('@agent-ui/components')
      expect(viewTransitionAvailable()).toBe(hasApi)
      return
    }
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    try {
      const el = mountHost()
      el.viewTransitions = true
      el.ingest(CREATE('vt-reduced'))
      el.ingest(ROOT('vt-reduced', 'first'))
      el.finalize()
      el.ingest(ROOT('vt-reduced', 'reduced update'))
      // the SYNC path commits immediately — no polling needed, which IS the assertion
      expect(el.textContent, 'reduced motion: the re-render applied synchronously (no transition ran)').toContain('reduced update')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ── ADR-0187 / GH 829 clause 6 — the terminal-empty brace, PAINTED ────────────────────────────────────
//
// jsdom cannot resolve generated `content`, so the jsdom suite can only assert the `data-empty-final`
// state the stylesheet keys off. The copy swap itself — the thing a person actually sees instead of a
// silently blank card (GH 802) — is only provable in a real engine. This asserts the rendered
// `::after` content on the real surface box, in BOTH Chromium and WebKit.

describe('ui-surface-host — terminal-empty copy actually paints (ADR-0187)', () => {
  const CREATE_ONLY = line({ version: 'v1.0', createSurface: { surfaceId: 'abandoned', catalogId: 'agent-ui' } })
  const afterContent = (el: HTMLElement): string =>
    getComputedStyle(el.querySelector('[data-part="surface"]') as HTMLElement, '::after').content

  it(`${server.browser}: the ANTICIPATORY placeholder paints before finalize, the TERMINAL copy after`, () => {
    const el = mountHost()
    el.ingest(CREATE_ONLY)
    // Mid-stream: content may still arrive (runtime SPEC-R4), so the anticipatory copy is honest.
    expect(afterContent(el)).toContain('appears here')
    expect(el.dataset.emptyFinal).toBeUndefined()

    el.finalize()
    // Post-finalize with nothing mounted: the copy must change, or the card is silently blank.
    expect(el.dataset.emptyFinal).toBe('')
    const terminal = afterContent(el)
    expect(terminal).toContain('Nothing was rendered')
    expect(terminal, 'the anticipatory copy must be REPLACED, not appended to').not.toContain('appears here')
  })

  it(`${server.browser}: a surface that renders content paints NEITHER placeholder`, () => {
    const el = mountHost()
    el.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'ok', catalogId: 'agent-ui' } }))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'ok',
          components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Go', action: { action: 'go' } }],
        },
      }),
    )
    el.finalize()
    expect(el.dataset.emptyFinal).toBeUndefined()
    // `:empty` no longer matches once the root is mounted, so the ::after rule does not apply at all.
    const content = afterContent(el)
    expect(content).not.toContain('appears here')
    expect(content).not.toContain('Nothing was rendered')
    // Anti-vacuity: the real control genuinely painted (a zero-area button would make the above trivial).
    const rect = (el.querySelector('ui-button') as HTMLElement).getBoundingClientRect()
    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)
  })

  it(`${server.browser}: a later real update returns the host to the no-placeholder state`, () => {
    const el = mountHost()
    el.ingest(CREATE_ONLY)
    el.finalize()
    expect(afterContent(el)).toContain('Nothing was rendered')

    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'abandoned',
          components: [{ id: 'root', component: 'Text', text: 'arrived late' }],
        },
      }),
    )
    el.finalize()
    expect(el.textContent).toContain('arrived late')
    expect(afterContent(el)).not.toContain('Nothing was rendered')
  })
})

// ── GH #1124 — mid-stream FIRST PAINT: the surface must be full-width BEFORE finalize() ────────────────
// jsdom cannot see this class of defect (it computes no flex/overflow geometry) — real-engine only.
// Live symptom (two reproductions on the chat surface): a streamed card first-paints offset RIGHT and
// clipped at the bubble edge. Root cause (proven cross-engine in conversation.browser.test.ts's GH #1124
// block): ADR-0199 flipped the [wrap] surface arm from `position: static` to `relative`, which brought
// the base rule's dormant `top: 50%; left: 50%` centering offsets ALIVE while `transform: none` had
// removed the compensating translate — the surface box shifted right+down by half the stage. Fixed by
// `inset: auto` in the wrap arm (surface-host.css). These pins hold the aligned-geometry law at the
// standalone-host level, mid-stream AND at finalize.
describe('ui-surface-host GH #1124 — mid-stream first paint is full-width (no offset/clip before finalize)', () => {
  /** A realistic radio-card-ish turn whose intrinsic (max-content) width far exceeds the 480px bubble:
   *  a Row of wide buttons — the non-wrapping inline overflow shape from the live reproductions. */
  const WIDE_STREAM = [
    line({ version: 'v1.0', createSurface: { surfaceId: 'fp1', catalogId: 'agent-ui' } }),
    line({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 'fp1',
        components: [
          { id: 'root', component: 'Column', children: ['title', 'row'] },
          { id: 'title', component: 'Text', variant: 'title', text: 'Which option would you like to proceed with today?' },
          { id: 'row', component: 'Row', children: ['b1', 'b2', 'b3', 'b4'] },
          { id: 'b1', component: 'Button', variant: 'outline', label: 'Continue with the recommended option', action: { action: 'a1' } },
          { id: 'b2', component: 'Button', variant: 'outline', label: 'Review the alternatives first', action: { action: 'a2' } },
          { id: 'b3', component: 'Button', variant: 'outline', label: 'Ask a clarifying question', action: { action: 'a3' } },
          { id: 'b4', component: 'Button', variant: 'outline', label: 'Cancel this flow entirely', action: { action: 'a4' } },
        ],
      },
    }),
  ]

  it(`${server.browser}: MID-STREAM (no finalize yet) the root is not offset/clipped left — its start edge sits at the surface's start edge`, () => {
    const { host, column } = mountBareHost()
    // One ingest per JSONL line, exactly like conversation.ts's streaming path — and STOP before
    // finalize(): this is the first-paint state the live bug was photographed in.
    for (const l of WIDE_STREAM) host.ingest(l)
    const surface = host.querySelector('[data-part="surface"]') as HTMLElement
    const root = surface.firstElementChild as HTMLElement
    expect(root).not.toBeNull()
    const surfaceRect = surface.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    const columnRect = column.getBoundingClientRect()
    // GH #1124's exact signature: the surface box shifted right of its column (the live `left: 50%`
    // offset) — compare against the COLUMN's edges, not just surface-relative deltas (the surface and
    // its content shift TOGETHER, so a surface-relative compare is blind to this defect).
    expect(surfaceRect.left, 'mid-stream surface is offset right of the bubble column').toBeCloseTo(columnRect.left, 0)
    expect(surfaceRect.right, 'mid-stream surface overflows the bubble column right edge').toBeLessThanOrEqual(columnRect.right + 0.5)
    expect(rootRect.left, 'mid-stream root start edge is clipped left of the surface').toBeGreaterThanOrEqual(surfaceRect.left - 0.5)
    // ADR-0160 full-width law at first paint: the root spans the surface's CONTENT box (GH #1150 — the
    // structural card padding/border sit between the root and the column edge now).
    expect(rootRect.width, 'mid-stream root does not span the surface content box').toBeCloseTo(contentWidth(surface), 0)
  })

  it(`${server.browser}: NARROW bubble (fleet 414px default → sub-24rem container): the ui-row reflows to column MID-STREAM, not only after settle`, () => {
    const column = document.createElement('div')
    column.style.width = '360px' // < 24rem (384px): row.css's @container rule must stack the row
    document.body.append(column)
    mounted.push(column)
    const host = document.createElement('ui-surface-host') as UISurfaceHostElement
    host.wrap = true
    host.bare = true
    column.append(host)
    for (const l of WIDE_STREAM) host.ingest(l)
    const row = host.querySelector('ui-row') as HTMLElement
    expect(row).not.toBeNull()
    expect(getComputedStyle(row).flexDirection, 'mid-stream the row did not resolve its <24rem container query').toBe('column')
    const surfaceRect = (host.querySelector('[data-part="surface"]') as HTMLElement).getBoundingClientRect()
    const rootRect = (host.querySelector('[data-part="surface"]')!.firstElementChild as HTMLElement).getBoundingClientRect()
    expect(rootRect.right, 'mid-stream the root overflows the bubble right edge').toBeLessThanOrEqual(surfaceRect.right + 0.5)
    expect(rootRect.left).toBeGreaterThanOrEqual(surfaceRect.left - 0.5)
  })

  it(`${server.browser}: finalize() keeps the same geometry (no next-turn jump)`, () => {
    const { host, column } = mountBareHost()
    for (const l of WIDE_STREAM) host.ingest(l)
    const surface = host.querySelector('[data-part="surface"]') as HTMLElement
    const beforeLeft = (surface.firstElementChild as HTMLElement).getBoundingClientRect().left
    host.finalize()
    const root = surface.firstElementChild as HTMLElement
    const after = root.getBoundingClientRect()
    expect(after.left, 'finalize moved the root — first paint and settled state disagree').toBeCloseTo(beforeLeft, 0)
    const columnRect = column.getBoundingClientRect()
    // GH #1150 — the SURFACE spans the column; the root sits inset by the structural card chrome.
    const surfaceRect = surface.getBoundingClientRect()
    expect(surfaceRect.left, 'settled surface is offset right of the bubble column (GH #1124)').toBeCloseTo(columnRect.left, 0)
    expect(surfaceRect.width).toBeCloseTo(columnRect.width, 0)
    expect(after.width).toBeCloseTo(contentWidth(surface), 0)
  })
})
