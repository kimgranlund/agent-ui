// color.ts — pure OKLCH↔sRGB numerics + gamut mapping + the colorCodecOptions codec factory (LLD-C3,
// color-picker.lld.md · ADR-0123 cl.2/cl.7 / SPEC-R3). Promoted from the adia `color-picker.class.js`
// prior art (Björn Ottosson's OKLCH↔sRGB constants + its binary-search gamut map) — NEVER ported: no
// app-specific generation-constraint math (maxChroma/minL/hueDriftMax/baseHue stay out of the fleet API,
// ADR-0123 Alternatives).
//
// Import-free (no DOM) — unit-testable without a DOM and reusable by the `type=color` text-field leg
// (SPEC-R3 AC5).

export const MAX_CHROMA = 0.4

export interface Oklch {
  L: number
  C: number
  H: number
}

// ── OKLCH ↔ sRGB conversion (Björn Ottosson's constants) ────────────────────────────────────────

function oklchToOklab(L: number, C: number, H: number): { L: number; a: number; b: number } {
  const hRad = (H * Math.PI) / 180
  return { L, a: C * Math.cos(hRad), b: C * Math.sin(hRad) }
}

function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** Convert an OKLCH triple to sRGB (0–1, clamped) — no gamut mapping applied. */
export function oklchToRgb(L: number, C: number, H: number): [number, number, number] {
  const { a, b } = oklchToOklab(L, C, H)
  const [lr, lg, lb] = oklabToLinearSrgb(L, a, b)
  return [
    Math.max(0, Math.min(1, linearToSrgb(lr))),
    Math.max(0, Math.min(1, linearToSrgb(lg))),
    Math.max(0, Math.min(1, linearToSrgb(lb))),
  ]
}

/** Format sRGB (0–1 channels) as a `#rrggbb` hex string. */
export function rgbToHex(r: number, g: number, b: number): string {
  const h = (c: number): string => Math.round(c * 255).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/** Convert an OKLCH triple directly to a `#rrggbb` hex string (no gamut mapping — call gamutMapChroma first). */
export function oklchToHex(L: number, C: number, H: number): string {
  const [r, g, b] = oklchToRgb(L, C, H)
  return rgbToHex(r, g, b)
}

/** Parse a `#rgb`/`#rrggbb` hex string to an OKLCH triple. Assumes a well-formed 3/6-digit hex (validated by the caller). */
export function hexToOklch(hex: string): Oklch {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!
  const r = srgbToLinear(parseInt(h.slice(0, 2), 16) / 255)
  const g = srgbToLinear(parseInt(h.slice(2, 4), 16) / 255)
  const b = srgbToLinear(parseInt(h.slice(4, 6), 16) / 255)
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const bv = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  const C = Math.sqrt(a * a + bv * bv)
  let H = (Math.atan2(bv, a) * 180) / Math.PI
  if (H < 0) H += 360
  return { L, C, H }
}

// ── Gamut mapping (binary-search chroma reduction, the adia mechanism) ──────────────────────────

function isInGamut(r: number, g: number, b: number): boolean {
  const e = 0.001
  return r >= -e && r <= 1 + e && g >= -e && g <= 1 + e && b >= -e && b <= 1 + e
}

/**
 * Reduce chroma until the OKLCH triple falls inside the sRGB gamut (8-iteration binary search — a
 * ~MAX_CHROMA/256 chroma resolution, imperceptible and deterministic; the adia constant, LLD §12 risk).
 * A no-op (returns `C` unchanged) when the triple is already in-gamut.
 */
export function gamutMapChroma(L: number, C: number, H: number): number {
  const { a, b } = oklchToOklab(L, C, H)
  const [lr, lg, lb] = oklabToLinearSrgb(L, a, b)
  if (isInGamut(linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb))) return C
  let lo = 0
  let hi = C
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2
    const { a: ma, b: mb } = oklchToOklab(L, mid, H)
    const [mr, mg, mbb] = oklabToLinearSrgb(L, ma, mb)
    if (isInGamut(linearToSrgb(mr), linearToSrgb(mg), linearToSrgb(mbb))) lo = mid
    else hi = mid
  }
  return lo
}

// ── Parsing helpers ──────────────────────────────────────────────────────────────────────────────

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i
// Accepts numeric, percent, `NaN`, and `none` (CSS Color 4 "powerless") channels — the adia lenient parser.
const OKLCH_RE = /^oklch\(\s*([\d.]+%?|NaN|none)\s+([\d.]+%?|NaN|none)\s+([\d.]+|NaN|none)\s*\)$/i

// CSS Color 4 percentage reference ranges for oklch(): L 100% → 1; C 100% → this fleet's MAX_CHROMA
// (0.4, the adia convention — chroma has no fixed real-world ceiling, so the spec leaves the 100%
// reference implementation-defined). H never takes a percentage (an angle) — OKLCH_RE's third group
// has no `%?`, so this function is never called with isL semantics for hue.
function parseOklchChannel(s: string, isL: boolean): number {
  if (s === 'none' || /^NaN$/i.test(s)) return 0
  if (s.endsWith('%')) return (+s.slice(0, -1) / 100) * (isL ? 1 : MAX_CHROMA)
  return +s
}

/** Parse any accepted color syntax (`#rgb`/`#rrggbb`/`oklch(L C H)`) into an OKLCH triple, or `null` if unparseable. */
export function parseColor(input: string): Oklch | null {
  const trimmed = input.trim()
  if (HEX_RE.test(trimmed)) return hexToOklch(trimmed)
  const m = OKLCH_RE.exec(trimmed)
  if (m) {
    return {
      L: parseOklchChannel(m[1]!, true),
      C: parseOklchChannel(m[2]!, false),
      H: parseOklchChannel(m[3]!, false),
    }
  }
  return null
}

// ── colorCodecOptions — the ADR-0044/0047-dialect codec (SPEC-R3 AC5, LLD-C3) ───────────────────

/** The color-codec dialect: parse (any accepted syntax → the `format`-serialized canonical) / format
 *  (idempotent re-normalization) / errorMessage. Mirrors traits/value-codec.ts's `ValueCodecOptions` shape
 *  (LLD-C4/C5 frozen-interface table) without importing it — pure, zero-DOM (SPEC-R3 AC5). */
export interface ColorCodecOptions {
  parse(display: string): string | null
  format(value: string): string
  errorMessage: string
}

/** Serialize an OKLCH triple through `format` — gamut-mapped sRGB hex for `'hex'`, authored-chroma `oklch(L C H)` for `'oklch'`. */
export function serializeColor(oklch: Oklch, format: 'hex' | 'oklch'): string {
  if (format === 'oklch') {
    return `oklch(${oklch.L.toFixed(2)} ${oklch.C.toFixed(3)} ${Math.round(oklch.H)})`
  }
  const mappedC = gamutMapChroma(oklch.L, oklch.C, oklch.H)
  return oklchToHex(oklch.L, mappedC, oklch.H)
}

/**
 * The color-codec dialect factory (LLD-C3): `parse(display) → canonical | null` accepts any recognized
 * syntax and re-serializes into the requested `format`; `format(canonical) → canonical` re-normalizes
 * (idempotent — parses then re-serializes in the same format). Pure — no DOM (SPEC-R3 AC5); reused as
 * plain functions by the standalone control AND wired through the `valueCodec` trait by the `type=color`
 * text-field leg (LLD-C9).
 */
export function colorCodecOptions(format: 'hex' | 'oklch'): ColorCodecOptions {
  return {
    parse(display: string): string | null {
      const oklch = parseColor(display)
      return oklch ? serializeColor(oklch, format) : null
    },
    format(value: string): string {
      const oklch = parseColor(value)
      return oklch ? serializeColor(oklch, format) : value
    },
    errorMessage: 'Please enter a valid color.',
  }
}
