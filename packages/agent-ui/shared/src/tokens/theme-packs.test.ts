import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

// theme-packs.test.ts — ADR-0141/TKT-0087's STANDING parity gate: every `[theme='<name>']` pack under
// `src/tokens/themes/*.css` must carry the CORE `--md-sys-color-*` role/primitive surface the default
// (tokens.css) does — the promise that selecting a theme never leaves a component reading an
// undeclared role. "Core" is the default's full property set MINUS the 16 hand-authored roles NO
// stock Ultimate Tokens export produces (TKT-0087's investigation, verified against the repo's real
// 11-palette config — every one of these 16 is independently named there, not a rounded-off count):
// focus-ring, the six neutral-tint-* roles, neutral-track/-hover, primary-selected, and the six raw
// 050/950 alpha-triple primitives feeding the tint roles. A pack omitting one of these 16 is CORRECT
// (not a gap to close) — an element inside the themed subtree inherits it from :root via ordinary CSS
// custom-property cascade, since a `[theme]` block is always a :root descendant.
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
