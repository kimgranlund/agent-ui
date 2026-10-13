// contrast.ts: the ContrastPair's rating (ADR-0244 cl.3, T-0090). Pure and DOM-less, so it runs in Node, a
// Worker and jsdom alike and the ratio never comes from the model. WCAG 2.x: each color's relative luminance
// from its sRGB channels, the ratio (lighter + 0.05) / (darker + 0.05), and the three floors the verdict row
// shows. The accepted inputs are the two ColorPicker formats: hex (`#rgb`, `#rrggbb`, `#rrggbbaa`) and
// `oklch(L C H [/ A])`. A translucent foreground is composited over the background in gamma-encoded sRGB (what
// the browser paints) before the luminance; a translucent background has no single ratio, so it is Unrated, as
// is any value that does not parse. The displayed ratio is truncated to two decimals, never rounded up, and each
// verdict is decided on the unrounded ratio.

/** A parsed color: gamma-encoded sRGB channels and alpha, each 0 to 1. */
export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

/** The floors the verdict row shows, in order. */
export const CONTRAST_FLOORS = [
  { id: 'aa-body', label: 'AA body', floor: 4.5 },
  { id: 'aa-large', label: 'AA large', floor: 3 },
  { id: 'aaa-body', label: 'AAA body', floor: 7 },
] as const

export type FloorId = (typeof CONTRAST_FLOORS)[number]['id']

export interface Verdict {
  id: FloorId
  label: string
  floor: number
  pass: boolean
}

export type ContrastRating =
  | { rated: true; ratio: number; display: string; verdicts: Verdict[] }
  | { rated: false; reason: 'unparseable' | 'translucent-background' }

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

// ── Parsing ──────────────────────────────────────────────────────────────────────────────────────

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const NUM = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?'
const OKLCH_RE = new RegExp(
  `^oklch\\(\\s*(${NUM}%?|none)\\s+(${NUM}%?|none)\\s+(${NUM}(?:deg)?|none)\\s*(?:\\/\\s*(${NUM}%?|none)\\s*)?\\)$`,
  'i',
)

function parseHex(hex: string): Rgba {
  const h = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
  const byte = (i: number): number => parseInt(h.slice(i, i + 2), 16) / 255
  return { r: byte(0), g: byte(2), b: byte(4), a: h.length === 8 ? byte(6) : 1 }
}

/** One oklch() channel: `none` is 0; a percentage scales by `percentOf` (L 100% is 1, C 100% is 0.4). */
function channel(raw: string, percentOf: number): number {
  if (raw.toLowerCase() === 'none') return 0
  if (raw.endsWith('%')) return (parseFloat(raw) / 100) * percentOf
  return parseFloat(raw)
}

const linearToSrgb = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)

/** OKLCH to gamma-encoded sRGB (Ottosson's constants, the ColorPicker's math), clipped to the sRGB gamut. */
function oklchToSrgb(L: number, C: number, H: number): [number, number, number] {
  const h = (H * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    clamp01(linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    clamp01(linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    clamp01(linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  ]
}

/** Parse a hex or `oklch()` color, or `null` when the value is neither. */
export function parseColor(value: string): Rgba | null {
  const v = value.trim()
  const hex = HEX_RE.exec(v)
  if (hex !== null) return parseHex(hex[1]!)
  const m = OKLCH_RE.exec(v)
  if (m === null) return null
  const [r, g, b] = oklchToSrgb(channel(m[1]!, 1), channel(m[2]!, 0.4), channel(m[3]!.replace(/deg$/i, ''), 1))
  const a = m[4] === undefined ? 1 : clamp01(channel(m[4], 1))
  if (![r, g, b, a].every(Number.isFinite)) return null
  return { r, g, b, a }
}

// ── Rating ───────────────────────────────────────────────────────────────────────────────────────

const srgbToLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

/** WCAG 2.x relative luminance of an opaque color. */
export function relativeLuminance({ r, g, b }: Rgba): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

/** `fg` over an opaque `bg`, channel by channel in gamma-encoded sRGB. */
export function compositeOver(fg: Rgba, bg: Rgba): Rgba {
  const mix = (f: number, b: number): number => f * fg.a + b * (1 - fg.a)
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a: 1 }
}

/** The ratio for display: truncated to two decimals, never rounded up ("4.4997" reads "4.49"). */
export function truncateRatio(ratio: number): string {
  const hundredths = Math.floor(ratio * 100)
  return `${Math.floor(hundredths / 100)}.${String(hundredths % 100).padStart(2, '0')}`
}

/** Rate `foreground` text on `background`: the ratio, its display form and the three verdicts, or Unrated. */
export function rateContrast(foreground: string, background: string): ContrastRating {
  const fg = parseColor(foreground)
  const bg = parseColor(background)
  if (fg === null || bg === null) return { rated: false, reason: 'unparseable' }
  if (bg.a < 1) return { rated: false, reason: 'translucent-background' }
  const ink = relativeLuminance(compositeOver(fg, bg))
  const paper = relativeLuminance(bg)
  const ratio = (Math.max(ink, paper) + 0.05) / (Math.min(ink, paper) + 0.05)
  return {
    rated: true,
    ratio,
    display: truncateRatio(ratio),
    verdicts: CONTRAST_FLOORS.map(({ id, label, floor }) => ({ id, label, floor, pass: ratio >= floor })),
  }
}
