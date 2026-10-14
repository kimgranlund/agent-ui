// disabled-recipe.fixture.ts: the probe behind the fleet disabled recipe tests (T-0139) for button, switch,
// checkbox, radio, toggle and pagination. The *-disabled and *-outline-variant roles are translucent scrims,
// so a colour string alone says nothing about how loud a part reads: every colour is painted, bottom layer
// first, onto one canvas pixel and the WCAG contrast is taken from the composited sRGB.

type Rgb = [number, number, number]

let pen: CanvasRenderingContext2D | null = null
const ctx = (): CanvasRenderingContext2D => {
  if (pen) return pen
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  pen = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  return pen
}

/** Paint `layers` (CSS colours, bottom first) onto one opaque pixel and read the sRGB result. */
export const composite = (...layers: string[]): Rgb => {
  const c = ctx()
  c.clearRect(0, 0, 1, 1)
  for (const layer of layers) {
    c.fillStyle = layer
    c.fillRect(0, 0, 1, 1)
  }
  const [r, g, b] = c.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}

const lin = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const luminance = ([r, g, b]: Rgb): number => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255)

/** WCAG contrast ratio of two painted pixels. */
export const contrast = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Ink contrast as painted: `ink` over `fills` over `page`, against `fills` over `page`. */
export const inkContrast = (page: string, fills: string[], ink: string): number =>
  contrast(composite(page, ...fills, ink), composite(page, ...fills))

/** Alpha of a computed colour, read from the painted pixel: paint it over black and over white. */
export const alphaOf = (color: string): number => {
  const [k] = composite('#000', color)
  const [w] = composite('#fff', color)
  return 1 - (w - k) / 255
}

/** A wrapper in one colour scheme on the opaque neutral surface; `page` is that surface as computed. */
export const schemeWrap = (scheme: 'light' | 'dark', markup: string): { wrap: HTMLElement; page: string } => {
  const wrap = document.createElement('div')
  wrap.style.colorScheme = scheme
  wrap.style.background = 'var(--md-sys-color-neutral-surface)'
  wrap.innerHTML = markup
  document.body.append(wrap)
  return { wrap, page: getComputedStyle(wrap).backgroundColor }
}

export const SCHEMES = ['light', 'dark'] as const
