import { describe, it, expect } from 'vitest'
// We read the CSS as text. vite strips `.css?raw` to empty (its CSS pipeline intercepts), so the
// trip-wire's `?raw` glob can't be used for stylesheets. Node GLOBALS stay out of the root graph
// (`types` lists only vite/client), so declare the one global we touch.
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// tok-focus (ADR-0009) — the shared focus-ring COLOUR role. A STATIC structural check on tokens.css: the
// DEDICATED --md-sys-color-focus-ring role resolves via light-dark() like every other role (NOT --md-sys-color-primary reused,
// which would tint each control's ring by its own family), and carries the forced-colors (WHCM) mapping
// → Highlight so the keyboard ring survives forced-colors for free. (The RENDERED ring is the wave-2
// cross-engine smoke; jsdom can't compute a focus outline.)

// vitest runs from the repo root; read the source CSS as text.
const css = readFileSync(`${process.cwd()}/packages/agent-ui/shared/src/tokens/tokens.css`, 'utf8') as string
const flat = css.replace(/\s+/g, ' ') // whitespace-insensitive matching
const bare = flat.replace(/\/\*.*?\*\//g, '') // comment-free, single-spaced

// The top-level :root block. Custom-property values hold no `}` (light-dark()/oklch() carry only `)`), so on
// the comment-free text `[^}]*` cleanly captures one block; `.match` (non-global) returns the FIRST :root —
// the top-level roles block — not the forced-colors `:root` nested in the @media below.
const rootBlock = (bare.match(/:root\s*\{[^}]*\}/) ?? [''])[0]

describe('tokens.css — the shared focus-ring role (ADR-0009)', () => {
  it('declares a DEDICATED --md-sys-color-focus-ring role resolved via light-dark() (not --md-sys-color-primary reused)', () => {
    expect(css.length).toBeGreaterThan(0) // anti-vacuous: the CSS was actually read
    expect(rootBlock.length).toBeGreaterThan(0) // anti-vacuous: the :root block was isolated
    expect(rootBlock).toMatch(/--md-sys-color-focus-ring:\s*light-dark\(/)
  })

  it('maps --md-sys-color-focus-ring → Highlight under forced-colors (the WHCM ring survives for free)', () => {
    // a forced-colors media query repoints --md-sys-color-focus-ring to the system focus colour `Highlight`. `[^@]*`
    // keeps the match inside the media block (does not cross into another at-rule).
    expect(bare).toMatch(/@media\s*\(\s*forced-colors:\s*active\s*\)\s*\{[^@]*--md-sys-color-focus-ring:\s*Highlight\s*;/)
  })
})

// tok-surface (ADR-0015 cl.3) — the elevation×brightness composition. STRUCTURAL pins: the brightness
// tonal-wash roles exist (translucent white/near-black, resolved via light-dark() like every role, over
// the new alpha primitives), and drop to `transparent` under forced-colors so the UA-forced Canvas base
// survives. The RENDERED composite is the cross-engine browser smoke; the AA MATH is the next describe.
describe('tokens.css — the brightness tonal-wash roles (ADR-0015 cl.3)', () => {
  const DIM = ['dim', 'dimmer', 'dimmest']
  const BRIGHT = ['bright', 'brighter', 'brightest']

  it('declares the wash alpha primitives — translucent white (050) + near-black (950) at 5/10/14%', () => {
    for (const stop of ['050', '950']) {
      expect(rootBlock).toMatch(new RegExp(`--md-sys-color-neutral-${stop}-50:\\s*oklch\\([^)]*/\\s*5%\\)`))
      expect(rootBlock).toMatch(new RegExp(`--md-sys-color-neutral-${stop}-100:\\s*oklch\\([^)]*/\\s*10%\\)`))
      expect(rootBlock).toMatch(new RegExp(`--md-sys-color-neutral-${stop}-140:\\s*oklch\\([^)]*/\\s*14%\\)`))
    }
  })

  it('declares the six --md-sys-color-neutral-tint-* roles via light-dark() over the alpha primitives (dim→950, bright→050)', () => {
    for (const r of DIM) {
      expect(rootBlock).toMatch(new RegExp(`--md-sys-color-neutral-tint-${r}:\\s*light-dark\\(\\s*var\\(--md-sys-color-neutral-950-\\d+\\)`))
    }
    for (const r of BRIGHT) {
      expect(rootBlock).toMatch(new RegExp(`--md-sys-color-neutral-tint-${r}:\\s*light-dark\\(\\s*var\\(--md-sys-color-neutral-050-\\d+\\)`))
    }
  })

  it('drops every tint role to transparent under forced-colors (the overlay defers to the system Canvas)', () => {
    // inside the one forced-colors @media block ([^@] stays inside it), each tint role → transparent
    for (const r of [...DIM, ...BRIGHT]) {
      expect(bare).toMatch(new RegExp(`@media\\s*\\(\\s*forced-colors:\\s*active\\s*\\)\\s*\\{[^@]*--md-sys-color-neutral-tint-${r}:\\s*transparent\\s*;`))
    }
  })
})

// tok-surface AA (ADR-0015 cl.3, s1 acceptance) — the contrast trip-wire. jsdom paints nothing, so we
// recompute WCAG contrast from the DECLARED token values: OKLCH→OKLab→linear sRGB→gamma sRGB, the wash
// composited alpha-over the elevation base-plane in gamma sRGB (CSS source-over), then WCAG luminance.
// The gate: --md-sys-color-neutral-on-surface (and the muted -on-surface-variant) stays ≥ AA across the composed
// 7×7 extremes in BOTH schemes. The values are PARSED from tokens.css, so any alpha bump re-runs the math.
describe('tokens.css — the composed surface stays WCAG-AA (ADR-0015 cl.3 — the AA surface)', () => {
  const AA = 4.5
  // --- parse helpers ---
  const oklchOf = (stop: string): [number, number, number] => {
    const m = bare.match(new RegExp(`--md-sys-color-neutral-${stop}:\\s*oklch\\(([-\\d.]+)\\s+([-\\d.]+)\\s+([-\\d.]+)`))
    if (!m) throw new Error(`primitive --md-sys-color-neutral-${stop} not found`)
    return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]
  }
  const alphaOf = (stop: string, suffix: number): number => {
    const m = bare.match(new RegExp(`--md-sys-color-neutral-${stop}-${suffix}:\\s*oklch\\([^/]*/\\s*([\\d.]+)%\\)`))
    if (!m) throw new Error(`alpha primitive --md-sys-color-neutral-${stop}-${suffix} not found`)
    return parseFloat(m[1]) / 100
  }
  // --- colour math ---
  const oklchToLin = ([L, C, H]: [number, number, number]): number[] => {
    const h = (H * Math.PI) / 180, a = C * Math.cos(h), b = C * Math.sin(h)
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
  const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
  const toGamma = (c: number) => { c = clamp01(c); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055 }
  const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const gammaOf = (stop: string) => oklchToLin(oklchOf(stop)).map(toGamma)
  const lum = (g: number[]) => { const [r, gg, b] = g.map(toLin); return 0.2126 * r + 0.7152 * gg + 0.0722 * b }
  const contrast = (f: number[], b: number[]) => { const a = lum(f), c = lum(b), hi = Math.max(a, c), lo = Math.min(a, c); return (hi + 0.05) / (lo + 0.05) }
  const over = (src: number[], a: number, dst: number[]) => src.map((s, i) => a * s + (1 - a) * dst[i])

  // the elevation base-planes per scheme (-lowest…-highest), the wash anchors, the inks — all by NAME
  const elev = { light: ['050', '075', '100', '125', '150', '175', '200'], dark: ['950', '925', '900', '875', '850', '825', '800'] }
  const ink = { light: { on: '950', variant: '750' }, dark: { on: '050', variant: '250' } }
  const washAlphas = [alphaOf('950', 50), alphaOf('950', 100), alphaOf('950', 140)] // == 050 alphas (symmetric)
  const whiteG = () => gammaOf('050'), blackG = () => gammaOf('950')

  // worst composed contrast for an ink role, over (7 planes × the 6 washes) in both schemes
  function worst(role: 'on' | 'variant', brightAlphas = washAlphas, dimAlphas = washAlphas) {
    let w = Infinity, where = ''
    for (const scheme of ['light', 'dark'] as const) {
      const inkG = gammaOf(ink[scheme][role])
      for (const stop of elev[scheme]) {
        const base = gammaOf(stop)
        for (let i = 0; i < 3; i++) {
          for (const [anchor, alphas] of [[blackG(), dimAlphas], [whiteG(), brightAlphas]] as const) {
            const r = contrast(inkG, over(anchor, alphas[i], base))
            if (r < w) { w = r; where = `${scheme} n-${stop} step${i}` }
          }
        }
      }
    }
    return { ratio: w, where }
  }

  it('keeps --md-sys-color-neutral-on-surface ≥ AA across the composed 7×7 extremes in BOTH schemes', () => {
    expect(washAlphas).toEqual([0.05, 0.1, 0.14]) // anti-vacuous: the declared alphas were actually parsed
    const w = worst('on')
    expect(w.ratio, `worst on-surface cell: ${w.where} = ${w.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA)
  })

  it('also keeps the muted --md-sys-color-neutral-on-surface-variant ≥ AA (the standing tokens.md surface-text gate)', () => {
    const w = worst('variant')
    expect(w.ratio, `worst on-surface-variant cell: ${w.where} = ${w.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA)
  })

  it('NEGATIVE control: a 20%-brightest wash drops the dark binding cell BELOW AA — the 14% ceiling is the real budget', () => {
    // The muted -on-surface-variant on the brightest dark plane (white wash over n-800) is the BINDING cell —
    // on-surface itself has slack (≈7.9:1 at 14%), so the budget is set by the variant. Bumping the brightest
    // wash to 20% pushes that cell below AA (proves the math has teeth); the declared 14% clears it.
    const broken = worst('variant', [0.05, 0.1, 0.2])
    expect(broken.ratio, `over-strong (20%) cell: ${broken.where} = ${broken.ratio.toFixed(2)}:1`).toBeLessThan(AA)
    expect(worst('variant').ratio).toBeGreaterThanOrEqual(AA) // the declared 14% ceiling holds
  })
})

// tok-selected (ADR-0048) — the AA-guaranteed persistent-SELECTED accent fill. The accent ANCHOR pair
// (--md-sys-color-primary + --md-sys-color-primary-on-primary/white) is report-only and drops to 3.32:1 in dark — fine for a GLYPH
// at the 3:1 non-text bar (the checkmark/thumb of every prior solid control), but BELOW the 4.5:1 bar for real
// TEXT. The ui-calendar selected-day NUMERAL is text, so it reads a DEDICATED --md-sys-color-primary-selected whose BOTH
// light-dark() legs clear AA against --md-sys-color-primary-on-primary. This probe re-derives the contrast from the
// DECLARED role legs (not hardcoded stops), so a future repoint re-runs the math. Same OKLCH→sRGB→WCAG path
// as the surface-AA block above (jsdom paints nothing — the contrast is recomputed from the token values).
describe('tokens.css — the AA-guaranteed --md-sys-color-primary-selected fill (ADR-0048)', () => {
  const AA = 4.5
  // parse a primitive --md-sys-color-primary-NNN OKLCH triple from the comment-free CSS
  const oklchOfPrimary = (stop: string): [number, number, number] => {
    const m = bare.match(new RegExp(`--md-sys-color-primary-${stop}:\\s*oklch\\(([-\\d.]+)\\s+([-\\d.]+)\\s+([-\\d.]+)`))
    if (!m) throw new Error(`primitive --md-sys-color-primary-${stop} not found`)
    return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]
  }
  const oklchToLin = ([L, C, H]: [number, number, number]): number[] => {
    const h = (H * Math.PI) / 180, a = C * Math.cos(h), b = C * Math.sin(h)
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
  const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
  const toGamma = (c: number) => { c = clamp01(c); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055 }
  const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const gammaOf = (stop: string) => oklchToLin(oklchOfPrimary(stop)).map(toGamma)
  const lum = (g: number[]) => { const [r, gg, b] = g.map(toLin); return 0.2126 * r + 0.7152 * gg + 0.0722 * b }
  const contrast = (f: number[], b: number[]) => { const a = lum(f), c = lum(b), hi = Math.max(a, c), lo = Math.min(a, c); return (hi + 0.05) / (lo + 0.05) }

  // the two primitive legs of a --md-sys-color-{role} declared as light-dark(var(--md-sys-color-primary-X), var(--md-sys-color-primary-Y))
  const legsOf = (role: string): [string, string] => {
    const m = rootBlock.match(new RegExp(`--md-sys-color-${role}:\\s*light-dark\\(\\s*var\\(--md-sys-color-primary-(\\d+)\\)\\s*,\\s*var\\(--md-sys-color-primary-(\\d+)\\)\\s*\\)`))
    if (!m) throw new Error(`role --md-sys-color-${role} not found as a two-leg primary light-dark()`)
    return [m[1], m[2]]
  }

  it('declares --md-sys-color-primary-selected as a two-leg primary light-dark() role', () => {
    expect(rootBlock).toMatch(/--md-sys-color-primary-selected:\s*light-dark\(\s*var\(--md-sys-color-primary-\d+\)\s*,\s*var\(--md-sys-color-primary-\d+\)\s*\)/)
  })

  it('clears WCAG-AA (≥4.5:1) against --md-sys-color-primary-on-primary TEXT in BOTH light and dark', () => {
    const [fillL, fillD] = legsOf('primary-selected')
    const [inkL, inkD] = legsOf('primary-on-primary')
    const light = contrast(gammaOf(inkL), gammaOf(fillL))
    const dark = contrast(gammaOf(inkD), gammaOf(fillD))
    expect(light, `light: on-primary(${inkL}) on selected(${fillL}) = ${light.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA)
    expect(dark, `dark: on-primary(${inkD}) on selected(${fillD}) = ${dark.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA)
  })

  it('NEGATIVE control: the plain --md-sys-color-primary anchor pair FAILS the 4.5:1 TEXT bar in dark (why the dedicated role exists)', () => {
    const [, anchorD] = legsOf('primary') // --md-sys-color-primary dark leg = the report-only 450
    const [, inkD] = legsOf('primary-on-primary')
    const dark = contrast(gammaOf(inkD), gammaOf(anchorD))
    expect(dark, `dark: on-primary(${inkD}) on --md-sys-color-primary(${anchorD}) = ${dark.toFixed(2)}:1 (report-only)`).toBeLessThan(AA)
  })
})

// tok-dialog-backdrop (TKT-0019) — the fleet-wide ui-modal ::backdrop scrim role, Kim-specified verbatim: black
// at 80% opacity, SCHEME-INVARIANT by design (a backdrop isolates the dialog from the busy page behind it in
// EITHER scheme, not tinted by the surface ramp) — resolved via light-dark() with identical legs, the sheet's
// own idiom for every semantic role (including the other scheme-invariant hand-authored roles above it).
describe('tokens.css — the dialog-backdrop scrim role (TKT-0019)', () => {
  it('declares --md-sys-color-dialog-backdrop as scheme-invariant black 80% opacity', () => {
    // Generator-native since Kim's ultimate-tokens rework: a single bare black role (no light-dark()
    // wrapper — a scheme-invariant scrim needs none; the prior light-dark()-with-identical-legs form was
    // equivalent). 80% either as `0.8` or `80%`.
    expect(rootBlock).toMatch(
      /--md-sys-color-dialog-backdrop:\s*oklch\(0 0 0\s*\/\s*(?:0\.8|80%)\)/,
    )
  })
})

// tok-system — the SYSTEMATIC per-family role grammar of Kim's ultimate-tokens generator. The migration
// replaced ad-hoc, per-need roles with a uniform grammar: eight intent families (neutral + the accent set
// + the status set) each carry the IDENTICAL semantic-role ladder, every role resolved via light-dark(),
// plus a `-scrim-NNN` alpha series (ADR-016 in the ultimate-tokens generator, adopted 2026-07-17 — was
// `-500-NNN`). This block DERIVES the family × role matrix and asserts completeness +
// light-dark() pairing, so a regenerated sheet that drops a rung or de-pairs a role (emits a flat value
// where a light-dark() belongs) fails HERE — the state-ladder-completeness gate the new system earns. It
// does NOT re-check the hand-authored wash/track/selected roles above (those have their own blocks); it
// verifies the generator's own promise across every family at once.
describe('tokens.css — the systematic per-family role grammar (ultimate-tokens generator)', () => {
  const FAMILIES = ['neutral', 'primary', 'secondary', 'accent', 'info', 'success', 'warning', 'danger'] as const
  // every semantic role a family MUST carry, each a light-dark() pair. `{f}` = the family's own name
  // (the self-referential on-{family} rungs). '' = the base --md-sys-color-{family} role.
  const LD_ROLES = [
    '', '-dim', '-bright', '-low', '-high', '-hover', '-active', '-disabled',
    '-on-{f}', '-on-{f}-variant', '-on-{f}-hover', '-on-{f}-active', '-on-{f}-disabled',
    '-on-surface', '-on-surface-variant', '-on-surface-hover', '-on-surface-active', '-on-surface-disabled',
    '-placeholder',
    '-outline', '-outline-variant', '-outline-hover', '-outline-active', '-outline-disabled',
    '-container', '-container-low', '-container-high', '-container-hover', '-container-active', '-container-disabled',
    '-inverse-surface', '-inverse-on-surface', '-background', '-surface',
    '-surface-dimmest', '-surface-dimmer', '-surface-dim', '-surface-bright', '-surface-brighter', '-surface-brightest',
    '-surface-lowest', '-surface-lower', '-surface-low', '-surface-high', '-surface-higher', '-surface-highest',
    '-scrim-weakest', '-scrim-weaker', '-scrim-weak', '-scrim', '-scrim-strong', '-scrim-stronger', '-scrim-strongest',
  ]
  const ALPHAS = ['050', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']

  it('every family declares every semantic role, each resolved via light-dark()', () => {
    expect(FAMILIES.length).toBe(8) // anti-vacuous
    expect(LD_ROLES.length).toBeGreaterThan(50) // anti-vacuous: the full ladder, not an empty loop
    const missing: string[] = []
    for (const f of FAMILIES) {
      for (const r of LD_ROLES) {
        const name = `--md-sys-color-${f}${r.replace('{f}', f)}`
        if (!new RegExp(`${name}:\\s*light-dark\\(`).test(rootBlock)) missing.push(name)
      }
    }
    expect(missing, `roles missing a light-dark() declaration: ${missing.join(', ')}`).toEqual([])
  })

  it('every family declares the scrim-step alpha series (5%…95%) as flat oklch primitives', () => {
    const missing: string[] = []
    for (const f of FAMILIES) {
      for (const a of ALPHAS) {
        const name = `--md-sys-color-${f}-scrim-${a}`
        if (!new RegExp(`${name}:\\s*oklch\\([^/]*/\\s*[\\d.]+%\\)`).test(rootBlock)) missing.push(name)
      }
    }
    expect(missing, `scrim-step alpha primitives missing: ${missing.join(', ')}`).toEqual([])
  })
})
