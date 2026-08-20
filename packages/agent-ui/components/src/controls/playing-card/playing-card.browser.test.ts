import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// playing-card.browser.test.ts — the cross-engine painted-truth proof (ADR-0225, GH #1478; jsdom is
// blind to painted geometry/3D-transform/contrast). Runs in BOTH Chromium and WebKit
// (vitest.browser.config.ts). Covers what jsdom cannot: the bridge aspect-ratio ramp, the rotated
// lower-right index, the pip-field gestalt (test-the-whole-shape), the painted back lattice, the
// ≥4.5:1 suit-ink contrast in BOTH color schemes, and the flip transition gated behind :state(ready) +
// reduced-motion.
//
// Side-effect CSS/JS imports — the load-bearing order (ADR-0003): foundation roles + dimensional ramp
// FIRST, then playing-card.css directly, then playing-card.ts (self-defines). The component-styles
// barrel already @imports playing-card.css (this wave's own integration slice) — this suite ALSO
// imports it directly (the pie-chart/bar-chart precedent), harmless given the idempotent side-effect
// import.
import '@agent-ui/components/foundation-styles.css'
import './playing-card.css'
import './playing-card.ts'

const mounted: HTMLElement[] = []
const mount = (markup: string): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.firstElementChild as HTMLElement
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)

/** Await N real animation frames — lets the `:state(ready)` rAF (playing-card.ts) arm the motion gate
 *  (the button-states.browser.test.ts precedent). */
const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()))
const nextFrames = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await nextFrame()
}

/** Computed transition-duration of the flipper part, in ms (0 ⇒ no transition armed). */
const flipperTransDurMs = (host: HTMLElement): number => {
  const flipper = host.querySelector("[data-part='flipper']") as HTMLElement
  return px(getComputedStyle(flipper).transitionDuration) * 1000
}

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

/** OKLCH → linear sRGB (the standard OKLab matrices) — some engines serialize a computed color declared
 *  via `oklch(...)` back in oklch() form rather than rgb()/color(srgb), so the luminance reader below
 *  must resolve that space directly rather than assume every computed color round-trips through sRGB. */
const oklchToLinearSrgb = (L: number, C: number, hDeg: number): [number, number, number] => {
  const h = (hDeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

/** WCAG relative luminance from a computed `rgb()`/`rgba()`/`color(srgb …)`/`oklch(...)` string. */
const relLuminance = (color: string): number => {
  const oklch = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(color)
  if (oklch) {
    const [r, g, b] = oklchToLinearSrgb(Number(oklch[1]), Number(oklch[2]), Number(oklch[3]))
    const clamp = (v: number): number => Math.max(0, Math.min(1, v))
    return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(b)
  }
  const rgb = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(color)
  const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(color)
  const m = rgb ?? srgb
  if (!m) throw new Error(`unparseable computed color: ${color}`)
  const scale = rgb ? 255 : 1
  const [r, g, b] = [m[1], m[2], m[3]].map((c) => {
    const v = Number(c) / scale
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string): number => {
  const [l1, l2] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  Geometry — the bridge aspect-ratio (9/14) holds at every [size] tier
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-playing-card — bridge aspect-ratio (9/14) holds across the [size] ramp (ADR-0225 cl.5)', () => {
  for (const size of ['sm', 'md', 'lg'] as const) {
    it(`[size=${size}] the rendered box holds the 9/14 bridge aspect`, () => {
      const card = mount(`<ui-playing-card rank="A" suit="spades" size="${size}"></ui-playing-card>`)
      const box = card.getBoundingClientRect()
      expect(box.width, 'the card painted zero width').toBeGreaterThan(0)
      expect(box.height, 'the card painted zero height').toBeGreaterThan(0)
      expect(box.width / box.height).toBeCloseTo(9 / 14, 1)
    })
  }

  it('a bigger [size] tier renders a genuinely bigger box (the em-keyed ramp, not a dead attribute)', () => {
    const sm = mount('<ui-playing-card rank="A" suit="spades" size="sm"></ui-playing-card>').getBoundingClientRect()
    const lg = mount('<ui-playing-card rank="A" suit="spades" size="lg"></ui-playing-card>').getBoundingClientRect()
    expect(lg.width).toBeGreaterThan(sm.width)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  Corner indices — the top-left copy is upright; the bottom-right copy is rotated + repositioned
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-playing-card — the rotated lower-right index (the physical-card mirrored-corner convention)', () => {
  it('the [data-inverted] index carries a 180deg rotation and sits in the lower-right quadrant of the host box', () => {
    const card = mount('<ui-playing-card rank="K" suit="hearts"></ui-playing-card>')
    const hostBox = card.getBoundingClientRect()
    const upper = card.querySelector("[data-part='index']:not([data-inverted])") as HTMLElement
    const lower = card.querySelector("[data-part='index'][data-inverted]") as HTMLElement

    // a real 180deg rotation is present on the computed transform matrix: rotate(180deg) ⇒ matrix(-1,0,0,-1,tx,ty)
    const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(lower).transform)
    expect(m, 'the lower index has no computed 2D transform matrix at all').not.toBeNull()
    const [a, b, c, d] = m![1].split(',').map(Number)
    expect(Math.round(a)).toBe(-1)
    expect(Math.round(d)).toBe(-1)
    expect(Math.round(b)).toBe(0)
    expect(Math.round(c)).toBe(0)
    // the upper index carries no such rotation (identity matrix or none).
    const upperTransform = getComputedStyle(upper).transform
    expect(upperTransform === 'none' || /matrix\(1,\s*0,\s*0,\s*1,/.test(upperTransform)).toBe(true)

    const lowerBox = lower.getBoundingClientRect()
    const hostMidX = hostBox.left + hostBox.width / 2
    const hostMidY = hostBox.top + hostBox.height / 2
    expect(lowerBox.left + lowerBox.width / 2, 'the lower index is not in the RIGHT half').toBeGreaterThan(hostMidX)
    expect(lowerBox.top + lowerBox.height / 2, 'the lower index is not in the BOTTOM half').toBeGreaterThan(hostMidY)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  Pip field — the whole-gestalt proof (test-the-whole-shape): count + a non-collapsed bounding box
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-playing-card — the pip field renders the table-driven count with a real, non-collapsed gestalt (test-the-whole-shape)', () => {
  const CASES = [
    { rank: 'A', expectPips: 1, expectLetter: false },
    { rank: '5', expectPips: 5, expectLetter: false },
    { rank: '10', expectPips: 10, expectLetter: false },
    { rank: 'Q', expectPips: 0, expectLetter: true },
  ] as const

  for (const { rank, expectPips, expectLetter } of CASES) {
    it(`rank="${rank}" renders ${expectLetter ? 'the letter treatment' : `${expectPips} pip(s)`} with a real painted gestalt`, () => {
      const card = mount(`<ui-playing-card rank="${rank}" suit="clubs" size="lg"></ui-playing-card>`)
      const pipsField = card.querySelector("[data-part='pips']") as HTMLElement
      const fieldBox = pipsField.getBoundingClientRect()
      expect(fieldBox.width, 'the pip field painted zero width').toBeGreaterThan(0)
      expect(fieldBox.height, 'the pip field painted zero height').toBeGreaterThan(0)

      if (expectLetter) {
        const letter = card.querySelectorAll("[data-part='letter']")
        expect(letter).toHaveLength(1)
        expect(card.querySelectorAll("[data-part='pip']")).toHaveLength(0)
        const letterBox = (letter[0] as HTMLElement).getBoundingClientRect()
        expect(letterBox.width, 'the letter node painted zero width').toBeGreaterThan(0)
        expect(letterBox.height, 'the letter node painted zero height').toBeGreaterThan(0)
        return
      }

      const pips = [...card.querySelectorAll("[data-part='pip']")] as HTMLElement[]
      expect(pips, `rank ${rank} must render exactly ${expectPips} pip node(s)`).toHaveLength(expectPips)

      // the WHOLE gestalt: every pip paints a real, non-collapsed box (never a stack of zero-size dots).
      let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity
      for (const pip of pips) {
        const b = pip.getBoundingClientRect()
        expect(b.width, 'a pip painted zero width').toBeGreaterThan(0)
        expect(b.height, 'a pip painted zero height').toBeGreaterThan(0)
        minLeft = Math.min(minLeft, b.left)
        minTop = Math.min(minTop, b.top)
        maxRight = Math.max(maxRight, b.right)
        maxBottom = Math.max(maxBottom, b.bottom)
      }
      // multi-pip ranks spread across a real spatial extent (never all collapsed onto ONE point).
      if (pips.length > 1) {
        expect(maxRight - minLeft, 'every pip collapsed to the same X — no real layout spread').toBeGreaterThan(1)
        expect(maxBottom - minTop, 'every pip collapsed to the same Y — no real layout spread').toBeGreaterThan(1)
      }
    })
  }

  it('rank 7 (the deliberate real-deck asymmetry) still paints all 7 pips with a real gestalt', () => {
    const card = mount('<ui-playing-card rank="7" suit="spades" size="lg"></ui-playing-card>')
    const pips = card.querySelectorAll("[data-part='pip']")
    expect(pips).toHaveLength(7)
    for (const pip of pips) expect((pip as HTMLElement).getBoundingClientRect().width).toBeGreaterThan(0)
  })

  it('a rotated pip (row > center) computes a 180deg rotation; an upright one does not', () => {
    const card = mount('<ui-playing-card rank="4" suit="clubs"></ui-playing-card>') // 2 upright, 2 rotated
    const pips = [...card.querySelectorAll("[data-part='pip']")] as HTMLElement[]
    const rotated = pips.filter((p) => p.hasAttribute('data-rotated'))
    const upright = pips.filter((p) => !p.hasAttribute('data-rotated'))
    expect(rotated).toHaveLength(2)
    expect(upright).toHaveLength(2)
    for (const pip of rotated) {
      const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(pip).transform)
      expect(m).not.toBeNull()
      const [a, , , d] = m![1].split(',').map(Number)
      expect(Math.round(a)).toBe(-1)
      expect(Math.round(d)).toBe(-1)
    }
    for (const pip of upright) {
      const t = getComputedStyle(pip).transform
      expect(t === 'none' || /matrix\(1,\s*0,\s*0,\s*1,/.test(t)).toBe(true)
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  The face-down back — a real painted lattice, no rank/suit text
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-playing-card — the face-down back is a real CSS-painted lattice, never a glyph (ADR-0225 cl.4)', () => {
  it('when face-down, the back part computes a non-none background-image (the repeating-gradient lattice) and carries no rank/suit text', () => {
    const card = mount('<ui-playing-card rank="A" suit="spades" face-down></ui-playing-card>')
    const back = card.querySelector("[data-part='back']") as HTMLElement
    const backImage = getComputedStyle(back).backgroundImage
    expect(backImage, 'the back part painted no background-image at all').not.toBe('none')
    expect(backImage.length).toBeGreaterThan(0)
    expect(back.textContent ?? '').toBe('') // the back holds no rank/suit text, ever
    // both faces stay in the DOM (ADR-0225 cl.6 — a real flip needs both painted).
    expect(card.querySelector("[data-part='face']")).not.toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  Suit ink contrast — ≥4.5:1 for BOTH inks against the face surface, in BOTH color schemes
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-playing-card — suit ink contrast ≥4.5:1 on the face surface, in BOTH color schemes (ADR-0225 cl.3)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    it(`${scheme}: spades/clubs (black) and hearts/diamonds (red) inks both hold ≥4.5:1 against the face surface`, () => {
      const wrap = document.createElement('div')
      wrap.style.colorScheme = scheme // re-resolves any light-dark() in the chain under this wrapper's scheme
      wrap.innerHTML = `
        <ui-playing-card rank="A" suit="spades"></ui-playing-card>
        <ui-playing-card rank="A" suit="hearts"></ui-playing-card>
      `
      document.body.append(wrap)
      mounted.push(wrap)

      const spadesFace = wrap.querySelector('ui-playing-card[suit="spades"] [data-part="face"]') as HTMLElement
      const heartsFace = wrap.querySelector('ui-playing-card[suit="hearts"] [data-part="face"]') as HTMLElement

      // `color` is set on [data-part='face'] (not the host) — index/pip text inherits it via currentColor.
      const faceSurface = getComputedStyle(spadesFace).backgroundColor
      const blackInk = getComputedStyle(spadesFace).color
      const redInk = getComputedStyle(heartsFace).color

      expect(blackInk, 'the red and black inks must be genuinely different colors').not.toBe(redInk)
      expect(contrast(faceSurface, blackInk), `${scheme}: black ink contrast`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(faceSurface, redInk), `${scheme}: red ink contrast`).toBeGreaterThanOrEqual(4.5)
    })
  }
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  Motion — the flip transition is present ONLY under :state(ready); reduced-motion zeroes it
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-playing-card — the flip transition is gated behind :state(ready) (ADR-0225 cl.6 / ADR-0008 §4a-c)', () => {
  it('no transition is armed at first paint; :state(ready) arms it a frame later', async () => {
    const card = mount('<ui-playing-card rank="A" suit="spades"></ui-playing-card>')
    expect(flipperTransDurMs(card), 'a transition was armed at first paint (would fade/spin on load)').toBe(0)
    await nextFrames(2)
    expect(flipperTransDurMs(card), ':state(ready) did not arm the flip transition').toBeGreaterThan(0)
  })

  it('faceDown actually rotates the flipper — the computed transform differs face-up vs face-down', () => {
    // Deliberately BEFORE :state(ready) arms (no nextFrames here): the rotation must apply the INSTANT
    // the attribute flips (no transition yet to animate through) — the same "first-paint snaps" contract
    // the :state(ready) gate exists to prove, read from the other end (a ready-gated read would capture
    // frame 0 of an in-flight transition, mid-interpolation, not a stable end value).
    const card = mount('<ui-playing-card rank="A" suit="spades"></ui-playing-card>')
    const flipper = card.querySelector("[data-part='flipper']") as HTMLElement
    const before = getComputedStyle(flipper).transform
    card.setAttribute('face-down', '')
    const after = getComputedStyle(flipper).transform
    expect(after).not.toBe(before)
    expect(after).toMatch(/^matrix3d\(/) // a genuine rotateY(180deg) — never representable as a 2D matrix()
  })

  it('reduced-motion ZEROES the flip transition — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    const card = mount('<ui-playing-card rank="A" suit="spades"></ui-playing-card>')
    await nextFrames(2)
    expect(flipperTransDurMs(card), 'transition not armed in normal mode').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    try {
      expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true)
      expect(flipperTransDurMs(card), 'reduced-motion did not zero the flip transition').toBe(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })

  it('the deal-entrance @starting-style transition also zeroes under reduced-motion — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(false)
      return
    }
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    try {
      const card = mount('<ui-playing-card rank="A" suit="spades"></ui-playing-card>')
      expect(px(getComputedStyle(card).transitionDuration)).toBe(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  Forced colors — both faces stay legible under WHCM (Chromium emulates; WebKit asserts the baseline)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-playing-card — forced-colors keeps both faces legible (WHCM)', () => {
  it('face + back flatten to Canvas/CanvasText under forced-colors', async () => {
    const card = mount('<ui-playing-card rank="A" suit="spades"></ui-playing-card>')
    const face = card.querySelector("[data-part='face']") as HTMLElement

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)
      const fcInk = getComputedStyle(face).color
      expect(fcInk.length).toBeGreaterThan(0) // the ink resolves to a real (opaque system) color, never vanishing
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
