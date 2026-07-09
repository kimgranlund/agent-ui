import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// badge.browser.test.ts — cross-engine (Chromium + WebKit) browser-truth probes for ui-badge
// (report-family.lld.md LLD-C7/C8; SPEC-R12…R17; ADR-0041; ADR-0057; ADR-0111 cl.5). jsdom cannot prove
// paint/geometry/WHCM/RTL/contrast (SPEC-N2) — this is the authoritative rendered-px + rendered-colour
// proof: the compact-realm geometry law (box/pad/pill/density-split), the glyph pairwise-distinctness
// (ADR-0057's checkable predicate), forced-colors, RTL glyph placement, and the AA contrast probe per
// intent × colour-scheme (SPEC-R14 AC3 — the build-time gate the LLD named as likely to fail; this file
// reports the MEASURED verdict, not the prediction).
//
// Direct (pre-barrel) imports — controls/badge/ is not yet wired into controls/index.ts /
// component-styles.css (the LLD-C10 serial-integration wave, out of this folder-only build's fence).
import '@agent-ui/components/foundation-styles.css'
import './badge.css'
import './badge.ts'

const mounted: HTMLElement[] = []
const mount = (markup: string, opts?: { dir?: 'ltr' | 'rtl'; density?: 'compact' | 'comfortable' | 'spacious' }): HTMLElement => {
  const wrap = document.createElement('div')
  if (opts?.dir) wrap.dir = opts.dir
  if (opts?.density) wrap.setAttribute('density', opts.density)
  wrap.style.display = 'flex'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.querySelector('ui-badge') as HTMLElement
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

/** Alpha of a computed colour — 0 ⇒ vanished/transparent, > 0 ⇒ painted (a bare system-colour keyword is opaque). */
const alphaOf = (color: string): number => {
  if (color === 'transparent' || color === 'none') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

// ── whole-shape + compact-realm geometry (SPEC-R13, ADR-0041) ────────────────────────────────────────

describe('ui-badge whole-shape (SPEC-R13/R14 AC1, test-the-whole-shape)', () => {
  it('a bare labeled badge in an unstyled flex row paints a non-collapsed box == --ui-compact-lg (18px default)', () => {
    const el = mount('<ui-badge label="status"></ui-badge>')
    const cs = getComputedStyle(el)
    expect(px(cs.blockSize), 'block-size must equal the compact-realm box (--ui-compact-lg, 18px default)').toBeCloseTo(18, 0)
    const rect = el.getBoundingClientRect()
    expect(rect.width, 'the host collapsed instead of painting a real pill').toBeGreaterThan(0)
    expect(rect.height, 'the host painted a zero-height box').toBeGreaterThan(0)
  })

  it('an EMPTY label still floors at min-inline-size == the box (a filled dot/pill, never a sliver — SPEC-R13 AC2)', () => {
    const el = mount('<ui-badge></ui-badge>') // no label, neutral intent (no glyph either)
    const rect = el.getBoundingClientRect()
    expect(rect.width, 'empty-label badge collapsed below the box floor').toBeGreaterThanOrEqual(18 - 0.5)
    expect(rect.height).toBeGreaterThan(0)
  })

  it('border-radius resolves to box/2 (the pill — the compact realm\'s "count pill" case)', () => {
    const el = mount('<ui-badge label="status"></ui-badge>')
    const cs = getComputedStyle(el)
    const box = px(cs.blockSize)
    // getComputedStyle serializes border-radius as a length (px); a pill on an 18px box → 9px.
    expect(px(cs.borderTopLeftRadius)).toBeCloseTo(box / 2, 0)
  })

  it('padding-block is ZERO (block-size is the vertical lever, never block-padding — geometry.md)', () => {
    const el = mount('<ui-badge label="status"></ui-badge>')
    const cs = getComputedStyle(el)
    expect(px(cs.paddingBlockStart)).toBe(0)
    expect(px(cs.paddingBlockEnd)).toBe(0)
  })
})

describe('ui-badge geometry — the compact pad law, NOT h/2 (SPEC-R13 AC1, ADR-0041)', () => {
  it('padding-inline == 2px + box·0.375·density (density=1 default); the BOX stays fixed at every density', () => {
    const el = mount('<ui-badge label="status"></ui-badge>')
    const box = px(getComputedStyle(el).blockSize)
    const padInline = px(getComputedStyle(el).paddingInlineStart)
    const expectedPad = 2 + box * 0.375 * 1
    expect(padInline, `padding-inline (${padInline}) != the compact pad law (${expectedPad})`).toBeCloseTo(expectedPad, 1)
  })

  it('[density] on an ancestor changes the PAD only — the box (block-size) is density-invariant (SPEC-R17 AC1)', () => {
    const compact = mount('<ui-badge label="status"></ui-badge>', { density: 'compact' })
    const spacious = mount('<ui-badge label="status"></ui-badge>', { density: 'spacious' })

    const boxCompact = px(getComputedStyle(compact).blockSize)
    const boxSpacious = px(getComputedStyle(spacious).blockSize)
    expect(boxCompact, 'the box must NOT move with density').toBeCloseTo(boxSpacious, 0)

    const padCompact = px(getComputedStyle(compact).paddingInlineStart)
    const padSpacious = px(getComputedStyle(spacious).paddingInlineStart)
    expect(padCompact, 'compact density must shrink the pad').toBeLessThan(padSpacious)
  })

  it('no [size] attribute repoints the box (SPEC-R13 AC3 — v1 ships no size axis)', () => {
    const el = mount('<ui-badge label="status" size="lg"></ui-badge>') // an author-supplied size attr is inert
    const box = px(getComputedStyle(el).blockSize)
    expect(box, 'a stray [size] attribute must not change the box — badge has no size prop/CSS hook').toBeCloseTo(18, 0)
  })
})

// ── glyph pairwise distinctness (SPEC-R12 AC1/AC2, ADR-0057) ─────────────────────────────────────────

describe('ui-badge intent glyph — pairwise-distinct shapes, colour-independent (SPEC-R12, ADR-0057)', () => {
  const INTENTS = ['info', 'success', 'warning', 'danger'] as const

  it('every non-neutral intent glyph has a real, non-empty clip-path', () => {
    for (const intent of INTENTS) {
      const el = mount(`<ui-badge intent="${intent}" label="x"></ui-badge>`)
      const glyph = el.querySelector('[data-part="glyph"]') as HTMLElement
      const clip = getComputedStyle(glyph).clipPath
      expect(clip, `${intent} glyph has no clip-path`).not.toBe('none')
    }
  })

  it('every PAIR of non-neutral intents has a DIFFERENT clip-path (the shape channel, independent of colour — SPEC-R12 AC1/AC2)', () => {
    const clipOf = (intent: string): string => {
      const el = mount(`<ui-badge intent="${intent}" label="x"></ui-badge>`)
      return getComputedStyle(el.querySelector('[data-part="glyph"]') as HTMLElement).clipPath
    }
    const clips = INTENTS.map((i) => [i, clipOf(i)] as const)
    for (let i = 0; i < clips.length; i++) {
      for (let j = i + 1; j < clips.length; j++) {
        expect(clips[i][1], `${clips[i][0]} and ${clips[j][0]} share the same clip-path`).not.toBe(clips[j][1])
      }
    }
  })

  it('"neutral" renders NO glyph at all — absence is its own signifier (SPEC-R12)', () => {
    const el = mount('<ui-badge intent="neutral" label="x"></ui-badge>')
    const glyph = el.querySelector('[data-part="glyph"]') as HTMLElement
    expect(getComputedStyle(glyph).display).toBe('none')
  })

  it('an out-of-enum [intent] ATTRIBUTE (a plain-author typo, not a bound-property write) renders NO glyph — never a stray shapeless square (component-review finding: the base glyph rule must be default-off, since a raw attribute mismatch is reachable and outside what the property-level hardening effect can catch)', () => {
    const el = mount('<ui-badge intent="neutral" label="x"></ui-badge>')
    el.setAttribute('intent', 'bogus') // bypasses the typed property setter entirely — a literal attribute write
    const glyph = el.querySelector('[data-part="glyph"]') as HTMLElement
    expect(getComputedStyle(glyph).display, 'an unrecognized [intent] attribute must degrade to no-glyph, matching the neutral/unknown fallback').toBe('none')
  })

  it('the glyph is aria-hidden and text-free — the label alone carries the announced message (SPEC-R12 AC3)', () => {
    const el = mount('<ui-badge intent="danger" label="3 failing"></ui-badge>')
    const glyph = el.querySelector('[data-part="glyph"]') as HTMLElement
    expect(glyph.getAttribute('aria-hidden')).toBe('true')
    expect(glyph.textContent).toBe('')
    expect(el.textContent).toBe('3 failing') // the WHOLE host's announced text is exactly the label
  })
})

// ── RTL (SPEC-R16) — glyph at inline-start of the label in BOTH directions ───────────────────────────

describe('ui-badge RTL (SPEC-R16 AC1) — the glyph sits at inline-start in both directions', () => {
  it('under dir="ltr", the glyph is physically LEFT of the label', () => {
    const el = mount('<ui-badge intent="danger" label="x"></ui-badge>', { dir: 'ltr' })
    const glyph = el.querySelector('[data-part="glyph"]') as HTMLElement
    const label = el.querySelector('[data-part="label"]') as HTMLElement
    expect(glyph.getBoundingClientRect().left).toBeLessThan(label.getBoundingClientRect().left)
  })

  it('under dir="rtl", the glyph is physically RIGHT of the label (inline-start mirrors — SPEC-R16 AC1)', () => {
    const el = mount('<ui-badge intent="danger" label="x"></ui-badge>', { dir: 'rtl' })
    const glyph = el.querySelector('[data-part="glyph"]') as HTMLElement
    const label = el.querySelector('[data-part="label"]') as HTMLElement
    expect(glyph.getBoundingClientRect().left).toBeGreaterThan(label.getBoundingClientRect().left)
  })
})

// ── forced-colors (SPEC-R15 AC1) ──────────────────────────────────────────────────────────────────────

describe('ui-badge forced-colors (SPEC-R15 AC1)', () => {
  it('the boxed identity (border) + the glyph survive under forced-colors — Chromium emulates (CDP); WebKit asserts baseline', async () => {
    const el = mount('<ui-badge intent="danger" label="x"></ui-badge>')

    // Baseline (BOTH engines): the host paints a real fill/border/ink; the glyph paints a real fill.
    expect(alphaOf(getComputedStyle(el).backgroundColor), 'baseline host fill is invisible').toBeGreaterThan(0)
    expect(alphaOf(getComputedStyle(el).borderTopColor), 'baseline host border is invisible').toBeGreaterThan(0)
    const glyph = el.querySelector('[data-part="glyph"]') as HTMLElement
    expect(alphaOf(getComputedStyle(glyph).backgroundColor), 'baseline glyph fill is invisible').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      expect(alphaOf(getComputedStyle(el).borderTopColor), 'the boxed identity (border) vanished under forced-colors').toBeGreaterThan(0)
      expect(alphaOf(getComputedStyle(glyph).backgroundColor), 'the glyph vanished under forced-colors (the bar-chart fill lesson)').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ── AA contrast probe — badge ink : fill (SPEC-R14 AC3) ──────────────────────────────────────────────
// The LLD flagged the shipped default pairing (-on-surface-variant ink over -container fill) as a
// PREDICTED probe casualty. This section measures the REAL rendered ratio, per intent × colour-scheme,
// and reports the verdict honestly — a failing cell is a token repoint (LLD-C8 failure mode #13), never
// a mechanism change.

const toLin = (c: number): number => {
  const s = c <= 0 ? 0 : c >= 1 ? 1 : c
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const toGamma = (c: number): number => {
  const s = c <= 0 ? 0 : c >= 1 ? 1 : c
  return s <= 0.0031308 ? s * 12.92 : 1.055 * s ** (1 / 2.4) - 0.055
}
/** OKLCH → linear sRGB (Björn Ottosson's oklab matrices — the slider.browser.test.ts precedent). */
const oklchToLinearSrgb = (L: number, C: number, hDeg: number): [number, number, number] => {
  const h = (hDeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

/** Parse a computed colour string (`rgb()`/`rgba()`/`oklch()`, with or without an alpha channel) into
 *  LINEAR-light [r,g,b] + alpha (0-1). Engines differ on which form they serialize (the slider precedent). */
function parseColor(color: string): { rgb: [number, number, number]; a: number } {
  const rgbM = color.match(/rgba?\(([^)]+)\)/i)
  if (rgbM) {
    const parts = rgbM[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    const [r, g, b] = parts
    const a = parts.length >= 4 ? parts[3] : 1
    return { rgb: [toLin(r / 255), toLin(g / 255), toLin(b / 255)], a }
  }
  const okM = color.match(/oklch\(([^)]+)\)/i)
  if (okM) {
    const raw = okM[1].trim()
    // "L C H" or "L C H / A" or "L C H / A%"
    const [head, alphaPart] = raw.split('/').map((s) => s.trim())
    const [L, C, H] = head.split(/\s+/).filter(Boolean).map(Number)
    const a = alphaPart === undefined ? 1 : alphaPart.endsWith('%') ? Number.parseFloat(alphaPart) / 100 : Number(alphaPart)
    return { rgb: oklchToLinearSrgb(L, C, H), a }
  }
  throw new Error(`unrecognized colour format (expected rgb()/rgba()/oklch()): "${color}"`)
}

/** Composite `fg` (possibly translucent) OVER an OPAQUE `bg`, blending in GAMMA (encoded) space — the
 *  conventional "over" operator a real engine paints, not a physically-linear-light mix. Returns LINEAR rgb. */
function compositeOverGamma(fg: { rgb: [number, number, number]; a: number }, bg: [number, number, number]): [number, number, number] {
  const fgGamma = fg.rgb.map(toGamma)
  const bgGamma = bg.map(toGamma)
  return fgGamma.map((f, i) => toLin(fg.a * f + (1 - fg.a) * bgGamma[i])) as [number, number, number]
}

const relativeLuminance = ([r, g, b]: [number, number, number]): number => {
  const cl = (x: number): number => Math.max(0, Math.min(1, x))
  return 0.2126 * cl(r) + 0.7152 * cl(g) + 0.0722 * cl(b)
}
const contrastOf = (a: [number, number, number], b: [number, number, number]): number => {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Read the badge's OWN rendered ink/fill + its ambient backdrop, all resolved at ONE colour-scheme
 *  (set on the WRAPPER; `color-scheme` inherits, so the badge resolves every `light-dark()` in its token
 *  chain against the SAME branch). The backdrop is the fleet's own page-background role, so the
 *  composited fill matches what a real consumer actually sees behind the badge. */
function measure(intent: string, scheme: 'light' | 'dark'): { ink: [number, number, number]; fill: [number, number, number] } {
  const wrap = document.createElement('div')
  wrap.style.colorScheme = scheme
  wrap.style.backgroundColor = 'var(--md-sys-color-neutral-background)'
  wrap.innerHTML = `<ui-badge intent="${intent}" label="x"></ui-badge>`
  document.body.append(wrap)
  const badge = wrap.querySelector('ui-badge') as HTMLElement
  const bgStr = getComputedStyle(wrap).backgroundColor
  const inkStr = getComputedStyle(badge).color
  const fillStr = getComputedStyle(badge).backgroundColor
  wrap.remove()

  const bg = parseColor(bgStr)
  const ink = parseColor(inkStr)
  const fill = parseColor(fillStr)
  // The backdrop (the fleet's own page-background role) must itself be opaque — anti-vacuous guard.
  if (bg.a < 0.999) throw new Error(`backdrop token resolved translucent (a=${bg.a}) — the fixture assumption broke`)
  return {
    ink: ink.a >= 0.999 ? ink.rgb : compositeOverGamma(ink, bg.rgb),
    fill: fill.a >= 0.999 ? fill.rgb : compositeOverGamma(fill, bg.rgb),
  }
}

describe('ui-badge AA contrast probe — ink:fill ≥ 4.5:1 per intent × colour-scheme (SPEC-R14 AC3)', () => {
  const INTENTS = ['info', 'success', 'warning', 'danger'] as const
  const SCHEMES = ['light', 'dark'] as const

  for (const intent of INTENTS) {
    for (const scheme of SCHEMES) {
      it(`[${intent}] [${scheme}] ink:fill clears 4.5:1 (the LLD-flagged -on-surface-variant/-container pairing, MEASURED)`, () => {
        const { ink, fill } = measure(intent, scheme)
        const ratio = contrastOf(ink, fill)
        expect(
          ratio,
          `[${intent}][${scheme}] measured ${ratio.toFixed(2)}:1 — below the 4.5:1 AA bar; SPEC-R14 AC3/LLD-C8 failure mode #13 calls for an ink-token repoint (never a mechanism change) if this ever regresses`,
        ).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  it('neutral (the default, no [intent] repoint applied) also clears 4.5:1 in both schemes', () => {
    for (const scheme of SCHEMES) {
      const { ink, fill } = measure('neutral', scheme)
      const ratio = contrastOf(ink, fill)
      expect(ratio, `[neutral][${scheme}] measured ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })
})

// ── zero residue ─────────────────────────────────────────────────────────────────────────────────────

describe('ui-badge cross-engine — zero residue across connect/disconnect', () => {
  it('reconnect rebuilds exactly one glyph + one label (no stacking)', () => {
    const el = mount('<ui-badge label="x" intent="danger"></ui-badge>')
    const wrap = el.parentElement as HTMLElement
    expect(el.children.length).toBe(2)
    el.remove()
    wrap.append(el)
    expect(el.children.length).toBe(2)
  })
})
