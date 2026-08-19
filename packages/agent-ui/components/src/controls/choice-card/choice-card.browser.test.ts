import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// choice-card.browser.test.ts — the real-engine proof for ui-choice-card (ADR-0220, GH #1368; the
// pinned browser-shard debt named in choice-card.test.ts/choice-card.ts's NAMED DEBT comments,
// blocking precondition of GH #1398). jsdom has no CustomStateSet, computes no @scope rules, and does
// not emulate forced-colors — this file proves what jsdom structurally cannot: the selected frame +
// non-color check-badge genuinely PAINT via `:state(selected)` (both `light-dark()` branches, since
// the selected border/wash tokens — `--md-sys-color-primary`/`-primary-surface` — genuinely differ by
// scheme; the idle `neutral-outline-variant` frame does not, so only the SELECTED assertions carry a
// real light-vs-dark distinction), the forced-colors WHCM leg (Chromium CDP emulation; WebKit baseline),
// and the `[disabled]` pointer-inert CSS truth (`@scope` rules are inert under jsdom entirely).
//
// Runs in BOTH Chromium and WebKit (vitest.browser.config.ts → the `packages` project's two instances).
//
// Side-effect imports — the load-bearing CSS order (ADR-0003): foundation roles + dimensional ramp
// FIRST, then this control's own sheet (direct, pre-barrel — the checkbox/rating precedent), then the
// self-defining module.
import '@agent-ui/components/foundation-styles.css'
import './choice-card.css'
import './choice-card.ts'
import type { UIChoiceCardElement } from './choice-card.ts'

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/** Mount a populated card (realistic content — the whole-shape law needs non-trivial children, never a
 *  bare empty host) inside an OPTIONAL colour-scheme wrapper (the `button-states.browser.test.ts`/
 *  `segmented-control.browser.test.ts` `mountThemed` precedent) so every `light-dark()` token in the
 *  chain resolves against a KNOWN branch, not the ambient page theme. */
function mount(scheme?: 'light' | 'dark'): { wrap: HTMLElement; card: UIChoiceCardElement } {
  const wrap = document.createElement('div')
  if (scheme) wrap.style.colorScheme = scheme
  const card = document.createElement('ui-choice-card') as UIChoiceCardElement
  card.setAttribute('value', 'deluxe')
  card.innerHTML = '<strong>Deluxe</strong><span>$185/night</span>'
  wrap.append(card)
  document.body.append(wrap)
  mounted.push(wrap)
  return { wrap, card }
}

const px = (v: string): number => Number.parseFloat(v)
const after = (el: Element): CSSStyleDeclaration => getComputedStyle(el, '::after')
const before = (el: Element): CSSStyleDeclaration => getComputedStyle(el, '::before')

/** Resolve a `--ui-choice-card-*`/`--md-sys-color-*` token to its serialized colour on a throwaway
 *  probe scoped to `host`'s own cascade — the `segmented-control.browser.test.ts` `resolveToken`
 *  precedent (colour-scheme forced on the probe itself, not the ambient page). */
const resolveToken = (host: HTMLElement, tokenVar: string, scheme: 'light' | 'dark'): string => {
  const probe = document.createElement('span')
  probe.style.colorScheme = scheme
  probe.style.background = `var(${tokenVar})`
  host.append(probe)
  const c = getComputedStyle(probe).backgroundColor
  probe.remove()
  return c
}

/** Resolve a forced-colors SYSTEM KEYWORD to its serialized computed colour via a throwaway probe
 *  (the `segmented-control.browser.test.ts` `resolveKeyword` precedent) — must be called WHILE
 *  forced-colors emulation is active. */
const resolveKeyword = (host: HTMLElement, keyword: string, channel: 'color' | 'background'): string => {
  const probe = document.createElement('span')
  probe.style.setProperty(channel, keyword)
  host.append(probe)
  const c = channel === 'color' ? getComputedStyle(probe).color : getComputedStyle(probe).backgroundColor
  probe.remove()
  return c
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] Whole-shape geometry — a populated card is a non-collapsed box (test-the-whole-shape)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-choice-card — whole-shape geometry (both engines)', () => {
  // ADR-0223 (Fill-by-Default) posture: pin geometry CONTAINER-relatively, never against the card's
  // own intrinsic pixel width — a block-level card fills whatever wrapper it sits in (choice-card.css
  // `:scope { display: block }`), so the durable proof is "the card's box relates to its OWN container",
  // never a bare page-default px reading that would go stale the moment S1 flips host-fill postures.
  it('a populated card fills its own container width (never a bare intrinsic px reading) and paints a non-collapsed box', () => {
    const { wrap, card } = mount()
    wrap.style.inlineSize = '320px' // an explicit, arbitrary container — the geometry is read RELATIVE to this
    const wrapRect = wrap.getBoundingClientRect()
    const rect = card.getBoundingClientRect()

    expect(rect.width, `${server.browser}: card collapsed to zero width`).toBeGreaterThan(0)
    expect(rect.height, `${server.browser}: card collapsed to zero height`).toBeGreaterThan(0)
    // container-relative, not a pixel pin: a block-level card spans its own containing block's width.
    expect(rect.width, `${server.browser}: a block-level card must fill its own container width`).toBeCloseTo(wrapRect.width, 0)

    expect(getComputedStyle(card).borderStyle).toBe('solid')
    expect(px(getComputedStyle(card).borderWidth)).toBeGreaterThan(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] Selected frame + non-color check indicator PAINT via :state(selected) — light AND dark
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-choice-card — selected frame + check indicator paint via :state(selected) (both engines, light + dark)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    it(`${scheme}: idle → no state, transparent badge/tick, scale(0); setSelected(true) arms :state(selected), repaints the frame, and scales the badge+tick to 1`, async () => {
      const { card } = mount(scheme)

      // ── idle ──
      expect(card.matches(':state(selected)'), 'selected must not flash before setSelected()').toBe(false)
      const idleBorder = getComputedStyle(card).borderColor
      expect(idleBorder, `${server.browser}/${scheme}: idle border must resolve to the real token`).toBe(
        resolveToken(card, '--ui-choice-card-border', scheme),
      )
      expect(after(card).transform, 'the badge circle must be scaled to 0 (absent) at idle').toMatch(/matrix\(0, 0, 0, 0, 0, 0\)|none/)
      expect(after(card).backgroundColor, 'the idle badge must be transparent').toBe('rgba(0, 0, 0, 0)')

      // ── selected ── the frame/wash/badge/tick all TRANSITION over --md-sys-motion-duration-fast
      // (choice-card.css) — a synchronous read right after setSelected(true) can catch a MID-FADE
      // colour (the browser's own oklab colour-interpolation, the `button-states.browser.test.ts`
      // motion-aware-read precedent). Poll until each repaint SETTLES on the exact target token.
      card.setSelected(true)
      expect(card.matches(':state(selected)'), `${server.browser}/${scheme}: :state(selected) did not arm`).toBe(true)

      const wantBorder = resolveToken(card, '--ui-choice-card-border-selected', scheme)
      await expect.poll(() => getComputedStyle(card).borderColor, { timeout: 1500 }).toBe(wantBorder)
      expect(getComputedStyle(card).borderColor, `${server.browser}/${scheme}: the selected frame did not repaint`).not.toBe(idleBorder)

      const wantBg = resolveToken(card, '--ui-choice-card-bg-selected', scheme)
      await expect.poll(() => getComputedStyle(card).backgroundColor, { timeout: 1500 }).toBe(wantBg)

      // the non-color check badge (::after, the circle) — genuinely scales up AND paints a real colour.
      expect(after(card).transform, 'the badge circle must scale up on selection').not.toMatch(/matrix\(0, 0, 0, 0, 0, 0\)/)
      const wantBadgeBg = resolveToken(card, '--ui-choice-card-badge-bg', scheme)
      await expect.poll(() => after(card).backgroundColor, { timeout: 1500 }).toBe(wantBadgeBg)

      // the tick (::before) — same scale-up + its own ink colour.
      expect(before(card).transform, 'the tick must scale up on selection').not.toMatch(/matrix\(0, 0, 0, 0, 0, 0\)/)
      const wantTickBg = resolveToken(card, '--ui-choice-card-badge-ink', scheme)
      await expect.poll(() => before(card).backgroundColor, { timeout: 1500 }).toBe(wantTickBg)

      // ── back to idle ──
      card.setSelected(false)
      expect(card.matches(':state(selected)')).toBe(false)
      await expect.poll(() => getComputedStyle(card).borderColor, { timeout: 1500 }).toBe(idleBorder)
    })
  }

  it('the light and dark selected paints are genuinely DIFFERENT colours (anti-vacuous — the light-dark() branch is truly resolving, not incidentally identical)', async () => {
    const { card: lightCard } = mount('light')
    lightCard.setSelected(true)
    const wantLightBorder = resolveToken(lightCard, '--ui-choice-card-border-selected', 'light')
    await expect.poll(() => getComputedStyle(lightCard).borderColor, { timeout: 1500 }).toBe(wantLightBorder)
    const lightBorder = getComputedStyle(lightCard).borderColor
    const lightBg = getComputedStyle(lightCard).backgroundColor

    const { card: darkCard } = mount('dark')
    darkCard.setSelected(true)
    const wantDarkBorder = resolveToken(darkCard, '--ui-choice-card-border-selected', 'dark')
    await expect.poll(() => getComputedStyle(darkCard).borderColor, { timeout: 1500 }).toBe(wantDarkBorder)
    const darkBorder = getComputedStyle(darkCard).borderColor
    const darkBg = getComputedStyle(darkCard).backgroundColor

    expect(darkBorder, `${server.browser}: light vs dark selected border must differ`).not.toBe(lightBorder)
    expect(darkBg, `${server.browser}: light vs dark selected background must differ`).not.toBe(lightBg)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] Disabled — pointer-inert CSS truth (@scope rules are inert under jsdom entirely)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-choice-card — [disabled] is pointer-inert (real @scope CSS, both engines)', () => {
  it('a disabled card renders pointer-events:none + cursor:default; an idle card stays pointer-interactive', () => {
    const { card } = mount()
    expect(getComputedStyle(card).pointerEvents, 'idle card must accept pointer interaction').not.toBe('none')
    expect(getComputedStyle(card).cursor).toBe('pointer')

    card.disabled = true
    expect(getComputedStyle(card).pointerEvents, `${server.browser}: a disabled card must be pointer-inert`).toBe('none')
    expect(getComputedStyle(card).cursor).toBe('default')
  })

  it('a disabled + selected card mutes the frame/badge/tick colours (the [disabled] TOKEN-block re-point)', async () => {
    const { card } = mount()
    card.disabled = true
    card.setSelected(true)
    // border-color transitions (choice-card.css) — poll past the fade before comparing (motion-aware read).
    const wantMuted = resolveToken(card, '--ui-choice-card-border-selected', 'light')
    await expect.poll(() => getComputedStyle(card).borderColor, { timeout: 1500 }).toBe(wantMuted)
    const mutedBorder = getComputedStyle(card).borderColor

    // anti-vacuous: the muted (disabled) selected border must differ from the ACTIVE selected border.
    card.disabled = false
    const wantActive = resolveToken(card, '--ui-choice-card-border-selected', 'light')
    await expect.poll(() => getComputedStyle(card).borderColor, { timeout: 1500 }).toBe(wantActive)
    const activeBorder = getComputedStyle(card).borderColor
    expect(activeBorder, `${server.browser}: disabled must genuinely mute the selected frame colour`).not.toBe(mutedBorder)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] Forced-colors (WHCM) — Chromium emulates via CDP; WebKit gets the baseline paint check
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-choice-card — forced-colors (Chromium CDP emulation; WebKit baseline)', () => {
  it('idle frame → ButtonText; selected frame → Highlight; badge → Highlight; tick → HighlightText', async () => {
    const { card } = mount()

    if (server.browser !== 'chromium') {
      // headless WebKit/Firefox do not emulate forced-colors — the checkbox/rating/multi-select
      // precedent: verify the element still computes real styles without error (baseline paint).
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      const rect = card.getBoundingClientRect()
      expect(rect.width, `${server.browser}: baseline paint collapsed`).toBeGreaterThan(0)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)

      // Flipping forced-colors mid-test itself changes the resolved border-color (idle non-forced →
      // ButtonText), which re-triggers choice-card.css's own `transition: border-color …` — poll past
      // that fade too (the same motion-aware-read law the selected-paint assertions below already use).
      const wantIdleBorder = resolveKeyword(card, 'ButtonText', 'color')
      await expect.poll(() => getComputedStyle(card).borderColor, { timeout: 1500 }).toBe(wantIdleBorder)

      // The frame/badge/tick colour transitions still ride choice-card.css's own
      // `transition: border-color/background-color/transform …` under forced-colors (only the PALETTE
      // is forced, not the cascade) — poll past the fade, the same motion-aware-read law as the light/
      // dark paint proof above.
      card.setSelected(true)
      const wantSelectedBorder = resolveKeyword(card, 'Highlight', 'color')
      await expect.poll(() => getComputedStyle(card).borderColor, { timeout: 1500 }).toBe(wantSelectedBorder)

      const wantBadgeBg = resolveKeyword(card, 'Highlight', 'background')
      await expect.poll(() => after(card).backgroundColor, { timeout: 1500 }).toBe(wantBadgeBg)

      const wantTickBg = resolveKeyword(card, 'HighlightText', 'background')
      await expect.poll(() => before(card).backgroundColor, { timeout: 1500 }).toBe(wantTickBg)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
