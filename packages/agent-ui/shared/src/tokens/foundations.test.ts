import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { CFG, check } from './scale.mjs'
import { BRIDGE_REL, LEGACY, OUT_REL, ROOT_DEFAULT, renderBridgeCss, renderFoundationsCss } from '../../../../../scripts/generate-foundations.mjs'

// ADR-0245 clause 1, 10a and 10c: the config gate, the generated-file drift gate, the cut and the bridge.
// The 36-cell computed leg (tokens equal resolve() in both engines) is foundations.browser.test.ts.
declare const process: { cwd(): string }

const ROOT = process.cwd()
const read = (rel: string): string => readFileSync(`${ROOT}/${rel}`, 'utf8') as string
const sha = (rel: string): string => createHash('sha256').update(readFileSync(`${ROOT}/${rel}`)).digest('hex')
const committed = read(OUT_REL)
const bridge = read(BRIDGE_REL)

/** Every top-level selector list in a flat sheet (the generated sheet has no at-rules or nesting). */
const selectorsOf = (css: string): string[] =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('}')
    .map((chunk) => chunk.split('{')[0]?.trim() ?? '')
    .filter(Boolean)
    .flatMap((list) => list.split(/,(?![^(]*\))/).map((s) => s.trim()))

describe('foundations: the vendored config and its contract (ADR-0245 clause 1)', () => {
  it('scale.mjs is a byte copy of the ADR derivation copy (the skill reference implementation)', () => {
    expect(sha('packages/agent-ui/shared/src/tokens/scale.mjs')).toBe(
      sha('.claude/docs/references/foundations-derivation/scale.mjs'),
    )
  })

  it('check() returns no failure (M1 to M10)', () => {
    expect(check()).toEqual([])
  })

  it('the generator refuses to emit when check() fails (a widget step that no longer grows trips M2)', () => {
    const saved = [...CFG.tiers.widget] as [number, number, number, number]
    CFG.tiers.widget[2] = 0
    try {
      expect(check().some((f) => f.startsWith('M2'))).toBe(true)
      expect(() => renderFoundationsCss()).toThrow(/check\(\) failed/)
    } finally {
      CFG.tiers.widget = saved
    }
    expect(check()).toEqual([])
  })
})

describe('foundations: generated-file drift and the cut (ADR-0245 clause 10a)', () => {
  it('foundations.gen.css is byte-identical to the generator output (run node scripts/generate-foundations.mjs)', () => {
    expect(committed).toBe(renderFoundationsCss())
  })

  it('foundations-bridge.gen.css is byte-identical to the generator output', () => {
    expect(bridge).toBe(renderBridgeCss())
  })

  it('at the cut, ROOT_DEFAULT is true: :root takes product at scale sm and the axes are unscoped', () => {
    expect(ROOT_DEFAULT).toBe(true)
    const selectors = selectorsOf(committed)
    expect(selectors).toContain(':root')
    expect(selectors).toContain("[data-scale='sm']")
    expect(committed).toMatch(/:root \{ --md-sys-tier-n0: 9; --md-sys-tier-a: 2; --md-sys-tier-k: 2; --md-sys-tier-g: 1;[^}]*--md-sys-scale-s: -1; \}/)
  })

  it('the rollback predicate bites: the pre-cut form keeps every selector on or inside a [data-tier] region', () => {
    const dark = renderFoundationsCss({ rootDefault: false })
    expect(selectorsOf(dark).filter((s) => !s.startsWith('[data-tier'))).toEqual([])
    expect(dark.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/:root/)
  })

  it('the bridge aliases every legacy name, maps every [scale] value and pins today in the legacy opt-out', () => {
    const alias = bridge.slice(bridge.indexOf(':root,'), bridge.indexOf("[data-foundations='legacy'] {"))
    const legacy = bridge.slice(bridge.indexOf("[data-foundations='legacy'] {"))
    for (const name of Object.keys(LEGACY)) {
      expect(alias, name).toMatch(new RegExp(`\\n  ${name}: `))
      expect(legacy, name).toContain(`  ${name}: ${LEGACY[name as keyof typeof LEGACY]};`)
    }
    // the retired attribute name is built, not spelled, so this proof is not itself a use of the axis
    const legacyAxis = 'scale'
    const values = ['ui-sm', 'ui-md', 'ui-lg', 'content-sm', 'content-md', 'content-lg']
    expect(selectorsOf(bridge)).toEqual(expect.arrayContaining(values.map((v) => `[${legacyAxis}='${v}']`)))
    expect(legacy).toContain('  --md-sys-n: initial;')
    expect(legacy).toContain('  --md-sys-tier-n0: initial;')
  })

  it('declares every ADR-0245 clause 1 output name', () => {
    const names = [
      'n', 'c', 'height', 'inset', 'radius', 'icon-box', 'glyph-box', 'glyph-stroke', 'corner-shape',
      ...['display', 'heading', 'subhead', 'section-kicker', 'title', 'body', 'control', 'field-label', 'group-kicker'].map((r) => `type-${r}`),
      ...['group', 'widget', 'card', 'layout'].flatMap((l) => ['margin', 'gutter', 'radius'].map((q) => `${l}-${q}`)),
    ]
    for (const name of names) expect(committed, `--md-sys-${name}`).toMatch(new RegExp(`\\n  --md-sys-${name}: `))
  })
})
