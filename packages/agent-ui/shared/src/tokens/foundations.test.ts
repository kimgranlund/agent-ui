import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { CFG, check, resolve, type Resolved } from './scale.mjs'
import { BRIDGE_REL, LEGACY, OUT_REL, ROOT_DEFAULT, renderBridgeCss, renderFoundationsCss } from '../../../../../scripts/generate-foundations.mjs'
import { DERIVED, GLYPH_FLOOR, ROOT_REGISTER, STEP, glyphBox } from '../../../../../scripts/lib/foundations-rules.mjs'

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

/** The skill revision this repo vendors (ADR-0245 Amendment 3). Re-vendoring is a deliberate change of this line. */
const VENDORED_SHA = '3c319761e5c8221e500077d62db65a555b95a85145cd022b58255b6e6057ba5b'

describe('foundations: the vendored config and its contract (ADR-0245 clause 1)', () => {
  it('scale.mjs is the vendored skill revision, byte for byte, and so is the ADR derivation copy', () => {
    expect(sha('packages/agent-ui/shared/src/tokens/scale.mjs')).toBe(VENDORED_SHA)
    expect(sha('.claude/docs/references/foundations-derivation/scale.mjs')).toBe(VENDORED_SHA)
  })

  it('check() returns no failure (M1 to M16)', () => {
    expect(check()).toEqual([])
  })

  it('the generator refuses to emit when check() fails (a widget step that no longer grows trips M2)', () => {
    const saved = [...CFG.tiers.widget] as [number, number, number, number]
    CFG.tiers.widget[2] = 0
    try {
      expect(check().some((f) => f.startsWith('M2'))).toBe(true)
      expect(() => renderFoundationsCss()).toThrow(/check\(\) failed/)
      expect(() => renderBridgeCss()).toThrow(/check\(\) failed/)
    } finally {
      CFG.tiers.widget = saved
    }
    expect(check()).toEqual([])
  })

  it('the radio dot is the glyph minus 2 and never shrinks as n grows (the skill M14); the retired 2n - 4c did', () => {
    const steps = ['sm', 'md', 'lg']
    const rungs = Object.keys(CFG.tiers).flatMap((t) => steps.flatMap((s) => steps.map((z) => resolve(t, s, z))))
    const shrinks = (size: (r: Resolved) => number): boolean =>
      rungs.some((a) => rungs.some((b) => a.n < b.n && size(b) < size(a)))
    for (const r of rungs) expect(r.parts.radioDot, `n ${r.n}`).toBe(r.glyph - 2)
    expect(shrinks((r) => r.parts.radioDot)).toBe(false)
    expect(shrinks((r) => r.icon - 4 * r.c)).toBe(true) // the control: 8 to 6 at n 8 to 9
  })

  it('the glyph box token is glyphBox(r) = max(8, 2n - 2c): the local floor (Amendment 7) binds below n 6 only, never in scale.mjs', () => {
    const steps = ['sm', 'md', 'lg']
    const rungs = Object.keys(CFG.tiers).flatMap((t) => steps.flatMap((s) => steps.map((z) => resolve(t, s, z))))
    expect(GLYPH_FLOOR).toBe(8)
    for (const r of rungs) expect(r.glyph, `n ${r.n}: scale.mjs keeps the skill's 2n - 2c`).toBe(2 * r.n - 2 * r.c)
    for (const r of rungs) expect(glyphBox(r), `n ${r.n}`).toBe(Math.max(GLYPH_FLOOR, 2 * r.n - 2 * r.c))
    expect(rungs.some((r) => r.n === 5 && glyphBox(r) === 8 && r.glyph === 6), 'anti-vacuous: an n 5 rung, where the floor binds').toBe(true)
    expect(glyphBox(resolve('product', 'sm', 'md'))).toBe(8) // md and lg unchanged at product / sm (the root before Amendment 8)
    expect(glyphBox(resolve('product', 'sm', 'lg'))).toBe(10)
    expect(committed).toContain(`--md-sys-glyph-box: max(${GLYPH_FLOOR}px, calc(var(--md-sys-n) * 2px - 2 * var(--md-sys-c)));`)
  })
})

describe('foundations: generated-file drift and the cut (ADR-0245 clause 10a)', () => {
  it('foundations.gen.css is byte-identical to the generator output (run node scripts/generate-foundations.mjs)', () => {
    expect(committed).toBe(renderFoundationsCss())
  })

  it('foundations-bridge.gen.css is byte-identical to the generator output', () => {
    expect(bridge).toBe(renderBridgeCss())
  })

  it('at the cut, ROOT_DEFAULT is true: :root takes the root register (ROOT_REGISTER, Amendment 8) and the axes are unscoped', () => {
    expect(ROOT_DEFAULT).toBe(true)
    const selectors = selectorsOf(committed)
    expect(selectors).toContain(':root')
    expect(selectors).toContain("[data-scale='sm']")
    const [n0, a, k, g] = CFG.tiers[ROOT_REGISTER.tier]
    const root = new RegExp(`:root \\{ --md-sys-tier-n0: ${n0}; --md-sys-tier-a: ${a}; --md-sys-tier-k: ${k}; --md-sys-tier-g: ${g};[^}]*--md-sys-scale-s: ${STEP[ROOT_REGISTER.scale]}; \\}`)
    expect(committed).toMatch(root)
  })

  it('the rollback predicate bites: the pre-cut form keeps every selector on or inside a [data-tier] region', () => {
    const dark = renderFoundationsCss({ rootDefault: false })
    expect(selectorsOf(dark).filter((s) => !s.startsWith('[data-tier'))).toEqual([])
    expect(dark.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/:root/)
  })

  it('the bridge aliases every legacy name and pins today in the legacy opt-out', () => {
    const alias = bridge.slice(bridge.indexOf(':root,'), bridge.indexOf("[data-foundations='legacy'] {"))
    const legacy = bridge.slice(bridge.indexOf("[data-foundations='legacy'] {"))
    for (const name of Object.keys(LEGACY)) {
      expect(alias, name).toMatch(new RegExp(`\\n  ${name}: `))
      expect(legacy, name).toContain(`  ${name}: ${LEGACY[name as keyof typeof LEGACY]};`)
    }
    expect(legacy).toContain('  --md-sys-n: initial;')
    expect(legacy).toContain('  --md-sys-m: initial;')
    expect(legacy).toContain('  --md-sys-tier-n0: initial;')
    expect(legacy).toContain('  --md-sys-density-d: initial;')
  })

  it('T-0169: the retired [scale] and [density] axes have no selector in either sheet', () => {
    // a bare or valued selector anywhere in a compound (`[scale]`, `x [density='compact']`, `:is([scale])`)
    const retired = /\[(scale|density)[\]=]/
    for (const sheet of [committed, bridge]) {
      expect(selectorsOf(sheet).filter((sel) => retired.test(sel))).toEqual([])
    }
  })

  it('DERIVED (the lints\' derived-token set) is exactly the names the derived block declares', () => {
    const block = committed.slice(committed.lastIndexOf('{'), committed.lastIndexOf('}'))
    const declared = [...block.matchAll(/^ {2}(--md-sys-[\w-]+):/gm)].map((m) => m[1])
    expect([...DERIVED].sort()).toEqual(declared.sort())
  })

  it('declares every ADR-0245 clause 1 output name (Amendment 3: m, and the section and group labels; Amendment 4: the label inset and the chip level; Amendment 5: the control pill and the checkbox radius)', () => {
    const names = [
      'n', 'm', 'c', 'height', 'inset', 'label-inset', 'radius', 'control-radius', 'checkbox-radius', 'icon-box', 'glyph-box', 'glyph-stroke', 'corner-shape',
      ...['display', 'heading', 'subhead', 'section-label', 'title', 'body', 'control', 'field-label', 'group-label'].map((r) => `type-${r}`),
      ...['chip', 'group', 'widget', 'card', 'layout'].flatMap((l) => ['margin', 'gutter', 'radius'].map((q) => `${l}-${q}`)),
    ]
    for (const name of names) expect(committed, `--md-sys-${name}`).toMatch(new RegExp(`\\n  --md-sys-${name}: `))
    expect(`${committed}${bridge}`).not.toMatch(/--md-sys-type-(?:section|group)-kicker/) // renamed to the labels
    // the legacy opt-out resets the new names too, so a control's `var(--md-sys-label-inset, 0px)` reads 0 there
    for (const name of ['label-inset', 'chip-margin', 'chip-gutter', 'chip-radius', 'control-radius', 'checkbox-radius']) expect(bridge).toContain(`  --md-sys-${name}: initial;`)
  })
})
