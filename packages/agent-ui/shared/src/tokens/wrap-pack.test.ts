// wrap-pack.test.ts — exercises `../../tools/themes/wrap-pack.ts` from `src/` (the mini-skills.ts /
// produce-loop.test.ts precedent: the vitest `packages` project only globs `src/**/*.test.ts`, so a
// `tools/`-side script's logic is co-tested from its nearest `src/` sibling, never from inside `tools/`
// itself, which the standing run never collects).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { extractRootBody, wrapPack, repointFill, repointText } from '../../tools/themes/wrap-pack.ts'

const VALID_EXPORT = `:root {
  color-scheme: light dark;
  --md-sys-color-neutral-100: oklch(0.95 0 0);
  --md-sys-color-primary-on-surface: light-dark(var(--md-sys-color-primary-700), var(--md-sys-color-primary-300));
}
`

describe('extractRootBody', () => {
  it('extracts the :root block body, trimmed', () => {
    const body = extractRootBody(VALID_EXPORT)
    expect(body).toContain('--md-sys-color-neutral-100:')
    expect(body.startsWith('color-scheme')).toBe(true)
  })

  it('throws on missing :root', () => {
    expect(() => extractRootBody('.foo { color: red; }')).toThrow(/no `:root` block/)
  })

  it('throws on missing color-scheme (not scheme-complete)', () => {
    expect(() => extractRootBody(':root { --md-sys-color-neutral-100: oklch(0.95 0 0); }')).toThrow(/color-scheme/)
  })

  it('throws on a foreign (non-md-sys-color) custom property', () => {
    const foreign = ':root { color-scheme: light dark; --ui-button-height: 28px; }'
    expect(() => extractRootBody(foreign)).toThrow(/non-`--md-sys-color-\*`/)
  })

  it('throws on zero declared properties (scheme-complete but otherwise empty)', () => {
    expect(() => extractRootBody(':root { color-scheme: light dark; }')).toThrow(/zero custom properties/)
  })
})

describe('wrapPack', () => {
  it('wraps the export body under [theme=\'<name>\']', () => {
    const pack = wrapPack('ocean', VALID_EXPORT)
    expect(pack).toMatch(/\[theme='ocean'\]\s*\{/)
    expect(pack).toContain('--md-sys-color-neutral-100:')
    expect(pack.trim().endsWith('}')).toBe(true)
  })

  it('rejects an illegal theme name', () => {
    expect(() => wrapPack('Bad Name!', VALID_EXPORT)).toThrow(/not a legal theme name/)
    expect(() => wrapPack('', VALID_EXPORT)).toThrow(/not a legal theme name/)
  })

  it('accepts kebab-case names', () => {
    expect(() => wrapPack('cool-blue-2', VALID_EXPORT)).not.toThrow()
  })

  it('is idempotent: wrapping the same (name, export) pair twice yields byte-identical output', () => {
    expect(wrapPack('ocean', VALID_EXPORT)).toBe(wrapPack('ocean', VALID_EXPORT))
  })

  it('propagates extractRootBody\'s validation (a foreign export never silently wraps)', () => {
    expect(() => wrapPack('ocean', '.foo { color: red; }')).toThrow(/no `:root` block/)
  })
})

// T-0340: repointFill derives the primary fill ladder from the body's own primary ramp.
describe('repointFill', () => {
  // a grey ramp: L only, so the AA crossing is easy to reason about
  const ramp = (ls: Record<string, number>) => Object.entries(ls).map(([st, l]) => `--md-sys-color-primary-${st}: oklch(${l} 0 0);`).join('\n')
  const roles = (ink = '050') => `
--md-sys-color-primary: light-dark(var(--md-sys-color-primary-550), var(--md-sys-color-primary-450));
--md-sys-color-primary-dim: light-dark(var(--md-sys-color-primary-650), var(--md-sys-color-primary-700));
--md-sys-color-primary-high: light-dark(var(--md-sys-color-primary-650), var(--md-sys-color-primary-400));
--md-sys-color-primary-active: light-dark(var(--md-sys-color-primary-750), var(--md-sys-color-primary-250));
--md-sys-color-primary-on-primary: light-dark(var(--md-sys-color-primary-050), var(--md-sys-color-primary-${ink}));
--md-sys-color-primary-on-primary-hover: light-dark(var(--md-sys-color-primary-050), var(--md-sys-color-primary-${ink}));
--md-sys-color-primary-on-primary-active: light-dark(var(--md-sys-color-primary-050), var(--md-sys-color-primary-${ink}));`
  const STOPS = { '050': 1, '250': 0.82, '300': 0.78, '350': 0.74, '400': 0.69, '450': 0.65, '500': 0.6, '550': 0.56, '600': 0.52, '650': 0.47, '700': 0.43, '750': 0.38, '800': 0.33, '950': 0.15 }
  const fill = (out: string, role: string) => out.match(new RegExp(`--md-sys-color-${role}: light-dark\\(var\\(--md-sys-color-primary-(\\d+)\\), var\\(--md-sys-color-primary-(\\d+)\\)\\);`))?.slice(1)

  it('adds the fill roles after -active: light legs from primary / -dim / -active, dark 600 / 700 / 750 for a light ink', () => {
    const out = repointFill(ramp(STOPS) + roles())
    expect(fill(out, 'primary-fill')).toEqual(['550', '600'])
    expect(fill(out, 'primary-fill-hover')).toEqual(['650', '700'])
    expect(fill(out, 'primary-fill-active')).toEqual(['750', '750'])
    expect(out.indexOf('--md-sys-color-primary-fill:')).toBeGreaterThan(out.indexOf('--md-sys-color-primary-active:'))
    expect(out).toContain('--md-sys-color-primary: light-dark(var(--md-sys-color-primary-550), var(--md-sys-color-primary-450));') // primary untouched
  })

  it('walks darker when 600 fails AA on that ramp (rest 650, hover 750, pressed 800)', () => {
    const out = repointFill(ramp({ ...STOPS, '600': 0.6 }) + roles())
    expect(fill(out, 'primary-fill')?.[1]).toBe('650')
    expect(fill(out, 'primary-fill-hover')?.[1]).toBe('750')
    expect(fill(out, 'primary-fill-active')?.[1]).toBe('800')
  })

  it('walks LIGHTER for a dark on-primary ink (rest 400, hover 300, pressed 250)', () => {
    const out = repointFill(ramp(STOPS) + roles('950'))
    expect(fill(out, 'primary-fill')?.[1]).toBe('400')
    expect(fill(out, 'primary-fill-hover')?.[1]).toBe('300')
    expect(fill(out, 'primary-fill-active')?.[1]).toBe('250')
  })

  it('is idempotent, replaces existing fill roles in place, and leaves a body with no primary role untouched', () => {
    const once = repointFill(ramp(STOPS) + roles())
    expect(repointFill(once)).toBe(once)
    const stale = once.replace('var(--md-sys-color-primary-600));', 'var(--md-sys-color-primary-450));')
    expect(repointFill(stale)).toBe(once)
    expect(repointFill('--md-sys-color-neutral-100: oklch(0.95 0 0);')).toBe('--md-sys-color-neutral-100: oklch(0.95 0 0);')
  })

  it('refuses with a clear error when no stop clears AA, or a ladder step is missing', () => {
    const flat = Object.fromEntries(Object.entries(STOPS).map(([st, l]) => [st, st === '050' ? l : 0.9]))
    expect(() => repointFill(ramp(flat) + roles())).toThrow(/clears 4.5:1 .*hand-picked fill/)
    const { '700': _gone, ...holed } = STOPS
    expect(() => repointFill(ramp(holed) + roles())).toThrow(/no 700 stop for the fill ladder/)
  })

  it('checks every LIGHT leg against its on-primary leg too, and refuses a light fill below 4.5:1', () => {
    const paleLight = ramp({ ...STOPS, '550': 0.8 }) + roles() // light rest = primary's light leg 550, now too pale
    expect(() => repointFill(paleLight)).toThrow(/primary-fill light leg primary-550 is .* under primary-on-primary/)
  })

  it('checks each dark leg against its OWN on-primary leg (a pressed ink that fails is refused)', () => {
    const body = ramp(STOPS) + roles().replace(
      '--md-sys-color-primary-on-primary-active: light-dark(var(--md-sys-color-primary-050), var(--md-sys-color-primary-050));',
      '--md-sys-color-primary-on-primary-active: light-dark(var(--md-sys-color-primary-050), var(--md-sys-color-primary-650));',
    )
    expect(() => repointFill(body)).toThrow(/primary-fill-active dark leg .* under primary-on-primary-active/)
  })

  it('refuses a pack that declares only some of the three fill roles', () => {
    const partial = repointFill(ramp(STOPS) + roles()).replace(/^--md-sys-color-primary-fill-hover:[^;]*;\n/m, '')
    expect(() => repointFill(partial)).toThrow(/declares .* but not primary-fill-hover; a fill ladder is all three roles or none/)
  })
})

// T-0567: repointText walks primary-high from its stock 650 / 400 legs to the first stop that clears 4.5:1 as text on
// every plane of its scheme (darker for light, lighter for dark), on two committed packs' own ramps.
describe('repointText: primary-high', () => {
  const pack = (name: string) => readFileSync(`${process.cwd()}/packages/agent-ui/shared/src/tokens/themes/${name}.css`, 'utf8')
  const withHigh = (css: string, light: string, dark: string) =>
    css.replace(/--md-sys-color-primary-high: light-dark\([^;]*;/, `--md-sys-color-primary-high: light-dark(var(--md-sys-color-primary-${light}), var(--md-sys-color-primary-${dark}));`)
  const high = (css: string) => css.match(/--md-sys-color-primary-high: light-dark\(var\(--md-sys-color-primary-(\d+)\), var\(--md-sys-color-primary-(\d+)\)\);/)?.slice(1)

  it('walks the dark leg lighter (400 to 350) where 400 misses on n-800, and keeps a light 650 that clears (ruby)', () => {
    expect(high(repointText(withHigh(pack('ruby'), '650', '400')))).toEqual(['650', '350'])
  })
  it('walks the light leg darker (650 to 700) where 650 misses on n-200, and keeps a dark 400 that clears (lagoon)', () => {
    expect(high(repointText(withHigh(pack('lagoon'), '650', '400')))).toEqual(['700', '400'])
  })
  it('lands on the FIRST passing stop from the start, not any passing stop (a hand-set 800 / 250 is walked back)', () => {
    expect(high(repointText(withHigh(pack('ruby'), '800', '250')))).toEqual(['650', '350'])
  })
})
