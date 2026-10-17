import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { repointFill } from '../../tools/themes/wrap-pack.ts'
declare const process: { cwd(): string }

// theme-packs.test.ts — ADR-0141/TKT-0087's STANDING parity gate: every `[theme='<name>']` pack under
// `src/tokens/themes/*.css` must carry the CORE `--md-sys-color-*` role/primitive surface the default
// (tokens.css) does — the promise that selecting a theme never leaves a component reading an
// undeclared role. "Core" is the default's full property set MINUS the 16 hand-authored roles NO
// stock Ultimate Tokens export produces (TKT-0087's investigation, verified against the repo's real
// 11-palette config — every one of these 16 is independently named there, not a rounded-off count):
// focus-ring, the six neutral-tint-* roles, neutral-track/-hover, primary-selected, the six raw
// 050/950 alpha-triple primitives feeding the tint roles, and (GH #867) the scrollbar-thumb/-thumb-hover
// pair — 18 roles now, not 16; scrollbar-thumb is an ALIAS of neutral-track/-hover (tokens.css), and an
// alias of a hand-authored role a stock export never produces is, by the same reasoning, never produced
// either. Later additions (the ADR-0196/0199 aliases, the Amendment 7 field outline) bring the set to 22, listed
// below. A pack omitting one of these 22 is CORRECT (not a gap to close): an element inside the themed
// subtree inherits it from :root via ordinary CSS custom-property cascade, since a `[theme]` block is
// always a :root descendant.
//
// Two checks: (1) property-name parity against the core set (2) scheme-completeness — wherever the
// DEFAULT pairs a role via `light-dark(...)`, the pack must too (never a flat value standing in for a
// light/dark pair) — checked per-property against what the default ACTUALLY does for that name, not a
// blanket assumption, so a legitimately-flat default primitive (e.g. `-key-dominant`) doesn't false-fail.

const ROOT = process.cwd()
const TOKENS_CSS = readFileSync(`${ROOT}/packages/agent-ui/shared/src/tokens/tokens.css`, 'utf8')
const THEMES_DIR = `${ROOT}/packages/agent-ui/shared/src/tokens/themes`

/** The 16 roles a stock Ultimate Tokens export never produces (TKT-0087 Findings) — the ONLY names a
 *  pack may legitimately omit. Any other default name missing from a pack is a real gap. */
const BESPOKE_EXEMPT = new Set([
  '--md-sys-color-focus-ring',
  '--md-sys-color-neutral-tint-bright',
  '--md-sys-color-neutral-tint-brighter',
  '--md-sys-color-neutral-tint-brightest',
  '--md-sys-color-neutral-tint-dim',
  '--md-sys-color-neutral-tint-dimmer',
  '--md-sys-color-neutral-tint-dimmest',
  '--md-sys-color-neutral-track',
  '--md-sys-color-neutral-track-hover',
  '--md-sys-color-primary-selected',
  '--md-sys-color-neutral-050-50',
  '--md-sys-color-neutral-050-100',
  '--md-sys-color-neutral-050-140',
  '--md-sys-color-neutral-950-50',
  '--md-sys-color-neutral-950-100',
  '--md-sys-color-neutral-950-140',
  // GH #867 — aliases of the neutral-track pair above (`var(--md-sys-color-neutral-track{,-hover})`,
  // tokens.css); a stock export that never produces the aliased role never produces the alias either.
  '--md-sys-color-neutral-scrollbar-thumb',
  '--md-sys-color-neutral-scrollbar-thumb-hover',
  // ADR-0196 (GH #1065) — pure aliases of core roles (`var(--md-sys-color-neutral-container-low)` /
  // `-on-surface-variant`, tokens.css ⑤); same class as the scrollbar aliases above: a pack that
  // re-themes the underlying roles re-themes these for free, and a stock export never mints --ui-*.
  '--ui-answered-bg',
  '--ui-answered-ink',
  // ADR-0199 (GH #1104) — a pure alias of the primary role (`var(--md-sys-color-primary)`, tokens.css
  // ⑥); same class as the answered aliases above: a pack that re-themes primary re-themes this for
  // free, and a stock export never mints --ui-*.
  '--ui-working-color',
  // ADR-0245 Amendment 7 (T-0143): the opaque 3:1 field-boundary outline (tokens.css ⑦), hand-authored from two
  // neutral primitive steps like neutral-track above; a stock export never produces it.
  '--md-sys-color-neutral-field-outline',
])

/** name -> declared value (the FIRST `:root`/`[theme=...]` block only — every pack + tokens.css is
 *  exactly one such block, the wrap-pack.ts / tok-system contract). */
function declaredProps(css: string): Map<string, string> {
  const open = css.indexOf('{')
  const close = css.lastIndexOf('}')
  const body = css.slice(open + 1, close)
  const out = new Map<string, string>()
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(m[1] as string, (m[2] as string).trim())
  return out
}

const defaultProps = declaredProps(TOKENS_CSS)
const CORE_NAMES = [...defaultProps.keys()].filter((n) => !BESPOKE_EXEMPT.has(n))

function packFiles(): string[] {
  return readdirSync(THEMES_DIR).filter((f) => f.endsWith('.css'))
}

/** The two real checks, extracted so the negative controls exercise the SAME logic the per-pack
 *  `describe` loop runs — a genuine proof the gate bites, not a self-referential assertion. */
function missingCoreNames(props: Map<string, string>): string[] {
  return CORE_NAMES.filter((n) => !props.has(n))
}
function flattenedRoles(props: Map<string, string>): string[] {
  const out: string[] = []
  for (const [name, value] of props) {
    const defaultValue = defaultProps.get(name)
    if (defaultValue === undefined) continue
    if (defaultValue.includes('light-dark(') && !value.includes('light-dark(')) out.push(name)
  }
  return out
}

describe('theme-packs.test.ts — the ADR-0141 parity gate', () => {
  it('the default itself carries every BESPOKE_EXEMPT name (anti-drift: the exemption list stays truthful)', () => {
    for (const name of BESPOKE_EXEMPT) expect(defaultProps.has(name), `${name} missing from tokens.css`).toBe(true)
  })

  it('CORE_NAMES is non-vacuous (anti-vacuous floor)', () => {
    expect(CORE_NAMES.length).toBeGreaterThan(900)
  })

  it('at least two real theme packs are committed', () => {
    expect(packFiles().length).toBeGreaterThanOrEqual(2)
  })

  for (const file of packFiles()) {
    describe(`themes/${file}`, () => {
      const css = readFileSync(`${THEMES_DIR}/${file}`, 'utf8')
      const props = declaredProps(css)

      it('declares every CORE (non-exempt) default property name', () => {
        const missing = missingCoreNames(props)
        expect(missing, `missing ${missing.length}: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''}`).toEqual([])
      })

      it('is scheme-complete: every property the default pairs via light-dark() is ALSO paired here', () => {
        const flattened = flattenedRoles(props)
        expect(flattened, `${flattened.length} role(s) flattened to one scheme: ${flattened.slice(0, 10).join(', ')}`).toEqual([])
      })

      it('carries the theme selector this file\'s own name implies', () => {
        const themeName = file.replace(/\.css$/, '')
        expect(css).toMatch(new RegExp(`\\[theme=['"]${themeName}['"]\\]`))
      })
    })
  }

  // Negative control: a deliberately truncated fixture (missing a real core role) must fail the SAME
  // parity check the real packs pass — proving the gate actually bites, not just that real packs happen
  // to be complete.
  it('negative control: a pack missing a CORE role fails parity (the SAME check the real packs pass)', () => {
    const aCoreName = CORE_NAMES.find((n) => n === '--md-sys-color-primary-on-surface')
    expect(aCoreName, 'the probe role must exist in the real default').toBeDefined()
    const truncated = `[theme='broken'] {\n  color-scheme: light dark;\n  --md-sys-color-neutral-100: oklch(1 0 0);\n}\n`
    const missing = missingCoreNames(declaredProps(truncated))
    expect(missing.length).toBeGreaterThan(0)
    expect(missing).toContain(aCoreName)
  })

  it('negative control: a pack that flattens a paired role to one scheme fails scheme-completeness (the SAME check the real packs pass)', () => {
    const pairedName = [...defaultProps.entries()].find(([, v]) => v.includes('light-dark('))?.[0]
    expect(pairedName, 'a light-dark()-paired default role must exist').toBeDefined()
    const flattened = `[theme='broken'] {\n  color-scheme: light dark;\n  ${pairedName}: oklch(0.5 0.1 200);\n}\n`
    const flat = flattenedRoles(declaredProps(flattened))
    expect(flat).toContain(pairedName)
  })
})

// T-0340 (Kim 2026-10-17): what each THEME PACK must satisfy (the default's own fill gates live in tokens.test.ts).
// (1) every leg of the primary FILL ladder (`--md-sys-color-primary-fill`, `-fill-hover`, `-fill-active`), light and
// dark, clears WCAG-AA 4.5:1 under its matching on-primary leg; (2) the ink and indicator roles keep the legs the
// pack was wrapped with before T-0340; (3) the pack is a fixed point of wrap-pack.ts's repointFill. The contrast math
// is a second derivation, independent of repointFill: it reads each pack's declared legs and primitives and
// recomputes OKLCH -> sRGB -> WCAG luminance itself.
describe('theme-packs.test.ts: each pack primary fill ladder clears 4.5:1 under on-primary (T-0340)', () => {
  const AA = 4.5
  const lum = ([L, C, H]: number[]): number => {
    const h = ((H as number) * Math.PI) / 180, a = (C as number) * Math.cos(h), b = (C as number) * Math.sin(h)
    const l = ((L as number) + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const m = ((L as number) - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const s = ((L as number) - 0.0894841775 * a - 1.291485548 * b) ** 3
    const lin = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ].map((c) => Math.min(1, Math.max(0, c)))
    return 0.2126 * (lin[0] as number) + 0.7152 * (lin[1] as number) + 0.0722 * (lin[2] as number)
  }
  const stopOf = (css: string, stop: string): number[] => {
    const m = css.match(new RegExp(`--md-sys-color-primary-${stop}:\\s*oklch\\(([-\\d.]+)\\s+([-\\d.]+)\\s+([-\\d.]+)`))
    if (!m) throw new Error(`primitive primary-${stop} not found`)
    return [Number(m[1]), Number(m[2]), Number(m[3])]
  }
  const legsOf = (css: string, role: string): [string, string] => {
    const m = css.match(new RegExp(`--md-sys-color-${role}:\\s*light-dark\\(\\s*var\\(--md-sys-color-primary-(\\d+)\\)\\s*,\\s*var\\(--md-sys-color-primary-(\\d+)\\)\\s*\\)`))
    if (!m) throw new Error(`role ${role} not a two-leg primary light-dark()`)
    return [m[1] as string, m[2] as string]
  }
  const ratioOf = (a: number[], b: number[]): number => {
    const x = lum(a), y = lum(b)
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
  }
  const FILL_PAIRS = [
    ['primary-fill', 'primary-on-primary'],
    ['primary-fill-hover', 'primary-on-primary-hover'],
    ['primary-fill-active', 'primary-on-primary-active'],
  ] as const
  /** Every fill leg below 4.5:1 under its matching on-primary leg, as `role scheme fill/ink = ratio`. */
  const fillMisses = (css: string): string[] => {
    const out: string[] = []
    for (const [fill, ink] of FILL_PAIRS) {
      for (const k of [0, 1] as const) {
        const f = legsOf(css, fill)[k], i = legsOf(css, ink)[k]
        const r = ratioOf(stopOf(css, f), stopOf(css, i))
        if (r < AA) out.push(`${fill} ${k ? 'dark' : 'light'} ${f}/${i} = ${r.toFixed(2)}:1`)
      }
    }
    return out
  }
  // The ink and indicator legs every pack was wrapped with before T-0340 (the stock UT export's role legs, identical
  // across all ten packs at commit 3ddba942c). T-0340 adds fill roles; it never moves these.
  const PRE_T0340_LEGS = {
    'primary': ['550', '450'],
    'primary-dim': ['650', '700'],
    'primary-high': ['650', '400'],
    'primary-hover': ['650', '350'],
    'primary-active': ['750', '250'],
  } as const

  for (const file of packFiles()) {
    describe(`themes/${file}`, () => {
      const css = readFileSync(`${THEMES_DIR}/${file}`, 'utf8')
      it('every fill leg, light and dark, clears 4.5:1 under its matching on-primary leg', () => {
        expect(fillMisses(css)).toEqual([])
      })
      it('the ink and indicator roles keep their pre-T-0340 legs', () => {
        for (const [role, was] of Object.entries(PRE_T0340_LEGS)) expect(legsOf(css, role), role).toEqual(was)
      })
      it('is a fixed point of wrap-pack.ts repointFill (the derived legs, not a hand edit)', () => {
        expect(repointFill(css)).toBe(css)
      })
    })
  }

  const sample = readFileSync(`${THEMES_DIR}/${packFiles()[0]}`, 'utf8')
  it('NEGATIVE control: a pack whose dark fill rest is the ink role (450) fails the fill check', () => {
    const bad = sample.replace(/(--md-sys-color-primary-fill: light-dark\(var\(--md-sys-color-primary-\d+\), var\(--md-sys-color-primary-)\d+/, '$1450')
    expect(bad).not.toBe(sample)
    expect(fillMisses(bad).join(' ')).toMatch(/primary-fill dark 450/)
  })
  it('NEGATIVE control: a pack with no fill roles is NOT a fixed point (repointFill adds them)', () => {
    const stock = sample.replace(/^\s*--md-sys-color-primary-fill(-hover|-active)?:[^;]*;\n/gm, '')
    expect(stock).not.toBe(sample)
    expect(repointFill(stock)).not.toBe(stock)
  })
})
