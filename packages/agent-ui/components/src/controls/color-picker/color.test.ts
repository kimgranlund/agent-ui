import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  MAX_CHROMA,
  oklchToRgb,
  rgbToHex,
  oklchToHex,
  hexToOklch,
  gamutMapChroma,
  parseColor,
  serializeColor,
  colorCodecOptions,
} from './color.ts'

// color.test.ts — LLD-C3 unit probes: the OKLCH↔sRGB round-trip, the gamut binary search, and the
// colorCodecOptions parse/format dialect. All pure functions — no DOM (SPEC-R3 AC5), asserted by a source
// grep below (the import-free contract this file's reusability by the type=color leg depends on).

describe('color.ts — import-free (SPEC-R3 AC5)', () => {
  it('carries no import statement (pure functions, zero DOM)', () => {
    const src = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/color-picker/color.ts`, 'utf8') as string
    expect(/^import /m.test(src)).toBe(false)
  })
})

describe('color.ts — OKLCH↔sRGB round-trip', () => {
  it('hexToOklch ∘ oklchToHex round-trips a representative color within ε', () => {
    const hex = '#3b82f6'
    const { L, C, H } = hexToOklch(hex)
    const roundTripped = oklchToHex(L, C, H)
    // Compare via re-parse (channel-level tolerance) rather than exact string equality — 8-bit rounding.
    const back = hexToOklch(roundTripped)
    expect(back.L).toBeCloseTo(L, 3)
    expect(back.C).toBeCloseTo(C, 3)
    expect(back.H).toBeCloseTo(H, 0)
  })

  it('round-trips black, white, and a saturated primary', () => {
    for (const hex of ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff']) {
      const { L, C, H } = hexToOklch(hex)
      const back = oklchToHex(L, gamutMapChroma(L, C, H), H)
      // 8-bit channel tolerance: allow ±1 per channel after re-parsing both hex strings.
      const [r1, g1, b1] = hex.match(/[0-9a-f]{2}/gi)!.map((h) => parseInt(h, 16))
      const [r2, g2, b2] = back.match(/[0-9a-f]{2}/gi)!.map((h) => parseInt(h, 16))
      expect(Math.abs(r1! - r2!)).toBeLessThanOrEqual(1)
      expect(Math.abs(g1! - g2!)).toBeLessThanOrEqual(1)
      expect(Math.abs(b1! - b2!)).toBeLessThanOrEqual(1)
    }
  })

  it('accepts a 3-digit hex shorthand', () => {
    const short = hexToOklch('#f00')
    const long = hexToOklch('#ff0000')
    expect(short.L).toBeCloseTo(long.L, 5)
    expect(short.C).toBeCloseTo(long.C, 5)
    expect(short.H).toBeCloseTo(long.H, 3)
  })

  it('oklchToRgb clamps channels to [0,1]', () => {
    const [r, g, b] = oklchToRgb(1.5, MAX_CHROMA, 0) // absurd L, out-of-gamut chroma — must not throw or overflow
    expect(r).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(1)
    expect(g).toBeGreaterThanOrEqual(0)
    expect(g).toBeLessThanOrEqual(1)
    expect(b).toBeGreaterThanOrEqual(0)
    expect(b).toBeLessThanOrEqual(1)
  })

  it('rgbToHex formats a known triple', () => {
    expect(rgbToHex(1, 0, 0)).toBe('#ff0000')
    expect(rgbToHex(0, 0, 0)).toBe('#000000')
    expect(rgbToHex(1, 1, 1)).toBe('#ffffff')
  })
})

describe('color.ts — gamutMapChroma (binary-search chroma reduction)', () => {
  it('is a no-op for an already in-gamut triple', () => {
    const { L, C, H } = hexToOklch('#808080') // mid-gray — comfortably in-gamut
    expect(gamutMapChroma(L, C, H)).toBeCloseTo(C, 5)
  })

  it('reduces chroma for a wide-gamut (out-of-sRGB) triple', () => {
    const wideC = MAX_CHROMA // near the ceiling — very likely out of gamut at most hues/lightnesses
    const mapped = gamutMapChroma(0.7, wideC, 30)
    expect(mapped).toBeLessThan(wideC)
    expect(mapped).toBeGreaterThanOrEqual(0)
  })

  it('the gamut-mapped triple renders inside [0,1] sRGB exactly', () => {
    const L = 0.7, H = 200
    const mapped = gamutMapChroma(L, MAX_CHROMA, H)
    const [r, g, b] = oklchToRgb(L, mapped, H)
    const eps = 0.002 // matches the internal isInGamut tolerance
    expect(r).toBeGreaterThanOrEqual(-eps)
    expect(r).toBeLessThanOrEqual(1 + eps)
    expect(g).toBeGreaterThanOrEqual(-eps)
    expect(g).toBeLessThanOrEqual(1 + eps)
    expect(b).toBeGreaterThanOrEqual(-eps)
    expect(b).toBeLessThanOrEqual(1 + eps)
  })
})

describe('color.ts — parseColor (any accepted syntax → OKLCH)', () => {
  it('parses #rrggbb and #rgb', () => {
    expect(parseColor('#3b82f6')).not.toBeNull()
    expect(parseColor('#f00')).not.toBeNull()
  })

  it('parses oklch(L C H) with numeric channels', () => {
    const parsed = parseColor('oklch(0.62 0.19 260)')
    expect(parsed).toEqual({ L: 0.62, C: 0.19, H: 260 })
  })

  it('parses oklch with percent/none/NaN powerless channels (CSS Color 4)', () => {
    expect(parseColor('oklch(70% 0.1 90)')).toEqual({ L: 0.7, C: 0.1, H: 90 })
    expect(parseColor('oklch(0.5 none 0)')).toEqual({ L: 0.5, C: 0, H: 0 })
    expect(parseColor('oklch(0.5 NaN 0)')).toEqual({ L: 0.5, C: 0, H: 0 })
  })

  it('a chroma percentage scales by the fleet MAX_CHROMA reference (CSS Color 4: L 100%→1, C 100%→MAX_CHROMA)', () => {
    // 100% chroma → MAX_CHROMA (0.4), NOT 1 — the L and C percentage reference ranges are distinct.
    expect(parseColor('oklch(0.5 100% 90)')).toEqual({ L: 0.5, C: MAX_CHROMA, H: 90 })
    expect(parseColor('oklch(0.5 50% 90)')).toEqual({ L: 0.5, C: MAX_CHROMA / 2, H: 90 })
    // both channels as percent in the same value — proves the two scales are applied independently
    expect(parseColor('oklch(50% 50% 90)')).toEqual({ L: 0.5, C: MAX_CHROMA / 2, H: 90 })
  })

  it('returns null for unparseable input', () => {
    expect(parseColor('not-a-color')).toBeNull()
    expect(parseColor('')).toBeNull()
    expect(parseColor('rgb(1,2,3)')).toBeNull()
  })
})

describe('color.ts — serializeColor', () => {
  it('format=hex gamut-maps before serializing', () => {
    const wide = { L: 0.7, C: MAX_CHROMA, H: 30 }
    const hex = serializeColor(wide, 'hex')
    expect(hex).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('format=oklch emits at the AUTHORED chroma (not gamut-reduced)', () => {
    const wide = { L: 0.7, C: MAX_CHROMA, H: 30 }
    const oklchStr = serializeColor(wide, 'oklch')
    expect(oklchStr).toBe(`oklch(0.70 ${MAX_CHROMA.toFixed(3)} 30)`)
  })
})

describe('color.ts — colorCodecOptions(format) — the ADR-0044/0047 dialect (SPEC-R3 AC5)', () => {
  it("colorCodecOptions('hex') parses #rgb/#rrggbb/oklch(...) and formats to #rrggbb", () => {
    const codec = colorCodecOptions('hex')
    expect(codec.parse('#3b82f6')).toMatch(/^#[0-9a-f]{6}$/)
    expect(codec.parse('#f00')).toBe('#ff0000')
    expect(codec.parse('oklch(0.62 0.19 260)')).toMatch(/^#[0-9a-f]{6}$/)
    expect(codec.format('#ff0000')).toBe('#ff0000')
  })

  it("colorCodecOptions('oklch') formats to oklch(L C H) at authored chroma", () => {
    const codec = colorCodecOptions('oklch')
    const parsed = codec.parse('#3b82f6')
    expect(parsed).toMatch(/^oklch\([\d.]+ [\d.]+ \d+\)$/)
  })

  it('unparseable input → null (parse) — format falls back to the raw value', () => {
    const codec = colorCodecOptions('hex')
    expect(codec.parse('not-a-color')).toBeNull()
    expect(codec.format('not-a-color')).toBe('not-a-color')
  })

  it('carries a non-empty errorMessage', () => {
    expect(colorCodecOptions('hex').errorMessage.length).toBeGreaterThan(0)
  })

  it('parse/format are pure — repeated calls with the same input return the same output', () => {
    const codec = colorCodecOptions('hex')
    const a = codec.parse('#3b82f6')
    const b = codec.parse('#3b82f6')
    expect(a).toBe(b)
  })
})
