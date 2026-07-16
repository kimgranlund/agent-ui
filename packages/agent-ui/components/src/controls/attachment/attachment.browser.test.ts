import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// attachment.browser.test.ts — the cross-engine browser-truth proof for ui-attachment (SPEC-N2: jsdom is
// blind to painted geometry and computed-style ink). Covers what jsdom cannot: the whole-shape floor
// (SPEC-R18 AC1), single-line ellipsis truncation in a narrow container incl. RTL (SPEC-R9 AC3), and
// forced-colors (SPEC-R19).
//
// Side-effect CSS/JS imports — the load-bearing order (ADR-0003): foundation roles + dimensional ramp
// FIRST, then this control's own sheet, then the self-defining module (which itself imports icon.ts as a
// side effect). controls/attachment/ is not yet exported from controls/index.ts (that barrel edit is the
// LLD-C11 shared-file integration slice, a separate wave from this folder) — direct (pre-barrel) imports,
// the stat/sparkline/bar-chart precedent.
import '@agent-ui/components/foundation-styles.css'
import '../icon/icon.css'
import './attachment.css'
import './attachment.ts'
import { iconRegistry, ICON_NAMES, type IconName, type IconPack } from '@agent-ui/icons'

// A deterministic in-file IconPack (the icon.test.ts precedent) — the glyph-derivation/rendering
// assertions below don't depend on whether the Phosphor subpath happened to self-register elsewhere in
// the same test run (ADR-0065/0066 — pack registration is app-owned, not implicit).
const bodies = Object.fromEntries(ICON_NAMES.map((n) => [n, `<path data-icon="${n}"/>`])) as Record<IconName, string>
iconRegistry.registerPack({ id: 'ui-attachment-test-pack', viewBox: '0 0 16 16', icons: bodies } satisfies IconPack)
iconRegistry.setActivePack('ui-attachment-test-pack')

const mounted: HTMLElement[] = []
const mount = (markup: string, style?: Partial<CSSStyleDeclaration>): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  Object.assign(wrap.style, style)
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.querySelector('ui-attachment') as HTMLElement
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)
const tokenPx = (el: HTMLElement, name: string): number => px(getComputedStyle(el).getPropertyValue(name))

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

describe('ui-attachment — whole-shape floor (SPEC-R18 AC1, test-the-whole-shape)', () => {
  it('a bare, populated attachment in an unstyled flex row paints a visible, non-collapsed box >= the min-inline-size floor', () => {
    const el = mount('<ui-attachment filename="report.pdf" mime-type="application/pdf" size-bytes="48200"></ui-attachment>')
    const floor = tokenPx(el, '--ui-attachment-min-inline-size')
    expect(floor, 'anti-vacuous: the floor token must resolve to a real px value').toBeGreaterThan(0)
    const box = el.getBoundingClientRect()
    expect(box.width, 'the card collapsed below its whole-shape floor in a flex row').toBeGreaterThanOrEqual(floor - 1)
    expect(box.height, 'the card painted zero height').toBeGreaterThan(0)
    // the WHOLE gestalt: glyph + name + meta all actually painted, not just the host box.
    for (const part of ['glyph', 'name', 'meta']) {
      const node = el.querySelector(`[data-part="${part}"]`) as HTMLElement
      expect(node.getBoundingClientRect().width, `${part} painted zero width`).toBeGreaterThan(0)
    }
  })

  it('a minimal attachment (unknown mime, no size) still paints — meta absent, not zero-size', () => {
    const el = mount('<ui-attachment filename="mystery.bin"></ui-attachment>')
    const box = el.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
    expect(el.querySelector('[data-part="meta"]')).toBeNull()
  })
})

describe('ui-attachment — truncation (SPEC-R9 AC3)', () => {
  it('a long name in a narrow container shows single-line ellipsis and the card never grows past its container', () => {
    // Narrower than the card's own whole-shape floor (12em, SPEC-R18 AC1) would just re-prove the floor —
    // this container sits ABOVE the floor so the truncation mechanism itself (not the floor) is on trial.
    const el = mount(
      '<ui-attachment filename="a-very-long-descriptive-filename-that-should-truncate.pdf" mime-type="application/pdf"></ui-attachment>',
      { width: '16em' },
    )
    const name = el.querySelector('[data-part="name"]') as HTMLElement
    const style = getComputedStyle(name)
    expect(style.whiteSpace).toBe('nowrap')
    expect(style.textOverflow).toBe('ellipsis')
    expect(style.overflow).not.toBe('visible')
    expect(el.getBoundingClientRect().width, 'the card grew past its 10em container').toBeLessThanOrEqual(
      el.parentElement!.getBoundingClientRect().width + 1,
    )
    // the full name remains the accessible/selectable text (SPEC-R9) — truncation is visual only.
    expect(name.textContent).toBe('a-very-long-descriptive-filename-that-should-truncate.pdf')
  })

  it('RTL: the glyph still leads visually (grid column order follows the writing direction)', () => {
    const el = mount('<ui-attachment filename="a.pdf" mime-type="application/pdf" dir="rtl"></ui-attachment>')
    const glyph = el.querySelector('[data-part="glyph"]') as HTMLElement
    const body = el.querySelector('[data-part="body"]') as HTMLElement
    // logical grid-template-columns (auto 1fr) — in RTL the glyph's inline-start edge is the card's RIGHT edge.
    expect(glyph.getBoundingClientRect().right).toBeGreaterThanOrEqual(body.getBoundingClientRect().right - 1)
  })
})

describe('ui-attachment — forced colors (SPEC-R19)', () => {
  it('the card border survives in a system ink under forced-colors — Chromium emulates (CDP); WebKit asserts baseline', async () => {
    const el = mount('<ui-attachment filename="report.pdf" mime-type="application/pdf" size-bytes="48200"></ui-attachment>')

    // Baseline (BOTH engines): the border paints a non-transparent color.
    expect(getComputedStyle(el).borderColor).not.toBe('rgba(0, 0, 0, 0)')

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      const borderColor = getComputedStyle(el).borderColor
      expect(borderColor, 'the card border vanished under forced-colors').not.toBe('rgba(0, 0, 0, 0)')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
