// dogfood-contrast.ts: the colour-compositing helper the dogfood render lint's contrast rules read (T-0144,
// .claude/docs/references/dogfood-lint.md). Pure and DOM-less: the render test resolves each painted layer
// (a computed background-color, a flat gradient layer, a border, an ink) to a string, and this module turns the
// stack into one opaque colour and the WCAG 2.x ratio. Parsing takes the computed forms both engines hand back:
// rgb() and rgba() in comma or space syntax, plus hex and oklch() through the ContrastPair's parser (stylist
// contrast.ts, which also owns the luminance and the gamma-encoded source-over the browser paints). Anything
// else (lab(), color-mix(), color(display-p3 ...)) returns null here; the browser side resolves it on a canvas.

import { parseColor, relativeLuminance } from '../../packages/agent-ui/a2ui/src/catalog/personas/stylist/contrast.ts'
import type { Rgba } from '../../packages/agent-ui/a2ui/src/catalog/personas/stylist/contrast.ts'

export type { Rgba }

/** The browser's canvas colours (light and dark), the backdrop when no ancestor paints an opaque layer. */
export const CANVAS_LIGHT: Rgba = { r: 1, g: 1, b: 1, a: 1 }
export const CANVAS_DARK: Rgba = { r: 18 / 255, g: 18 / 255, b: 18 / 255, a: 1 }

const NUM = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?'
const RGB_RE = new RegExp(
  `^rgba?\\(\\s*(${NUM}%?)\\s*[,\\s]\\s*(${NUM}%?)\\s*[,\\s]\\s*(${NUM}%?)\\s*(?:[,/]\\s*(${NUM}%?)\\s*)?\\)$`,
  'i',
)
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))
const unit = (raw: string, full: number): number => clamp01(raw.endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw) / full)

/** A computed colour string to channels 0 to 1, or null when this module cannot read it. */
export function parseCss(value: string): Rgba | null {
  const v = value.trim().toLowerCase()
  if (v === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
  const m = RGB_RE.exec(v)
  if (m !== null) return { r: unit(m[1]!, 255), g: unit(m[2]!, 255), b: unit(m[3]!, 255), a: m[4] === undefined ? 1 : unit(m[4], 1) }
  return parseColor(v)
}

/** `top` source-over `bottom` (either may be translucent), in gamma-encoded sRGB as the browser paints it. */
export function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a + bottom.a * (1 - top.a)
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 }
  const mix = (t: number, b: number): number => (t * top.a + b * bottom.a * (1 - top.a)) / a
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a }
}

/** A layer stack, topmost first, flattened onto `base`; an opaque base gives an opaque result. */
export function flatten(layers: readonly Rgba[], base: Rgba = CANVAS_LIGHT): Rgba {
  return layers.reduceRight((below, layer) => over(layer, below), base)
}

/** The WCAG 2.x contrast ratio of two colours, each flattened onto the canvas first if translucent. */
export function contrast(a: Rgba, b: Rgba): number {
  const la = relativeLuminance(a.a < 1 ? over(a, CANVAS_LIGHT) : a)
  const lb = relativeLuminance(b.a < 1 ? over(b, CANVAS_LIGHT) : b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** `ink` over its opaque `fill`, against that fill: the ratio a reader sees. */
export function inkContrast(ink: Rgba, fill: Rgba): number {
  return contrast(over(ink, fill), fill)
}

/** Split a CSS list at its top-level commas (commas inside parentheses stay). */
export function splitTopLevel(list: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < list.length; i++) {
    const ch = list[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) {
      out.push(list.slice(start, i).trim())
      start = i + 1
    }
  }
  const last = list.slice(start).trim()
  if (last !== '') out.push(last)
  return out
}

/** A computed background-image as colour layers, topmost first: `[]` for none, each flat gradient (every stop
 *  the same colour, as ui-avatar paints its plane) as that colour's string, and null when any layer is a real
 *  image or a gradient with distinct stops, which no single colour stands for. */
export function flatLayers(backgroundImage: string): string[] | null {
  const v = backgroundImage.trim()
  if (v === '' || v === 'none') return []
  const out: string[] = []
  for (const layer of splitTopLevel(v)) {
    if (layer === 'none') continue // a layer with no image (the colour layer of a `background` shorthand list)
    const m = /^(?:repeating-)?(?:linear|radial|conic)-gradient\((.*)\)$/i.exec(layer)
    if (m === null) return null
    const stops = splitTopLevel(m[1]!)
      .filter((s) => !/^(?:to\s|from\s|at\s|[+-]?[\d.]+(?:deg|turn|rad|grad)\b|circle|ellipse|closest|farthest)/i.test(s))
      .map((s) => s.replace(/\s+[+-]?[\d.]+(?:%|px|em|rem)?(?:\s+[+-]?[\d.]+(?:%|px|em|rem)?)?$/i, '').trim())
    if (stops.length === 0 || stops.some((s) => s !== stops[0])) return null
    out.push(stops[0]!)
  }
  return out
}
