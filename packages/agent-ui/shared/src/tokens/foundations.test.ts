import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { CFG, check, resolve, type Resolved } from './scale.mjs'
import { BRIDGE_REL, LEGACY, OUT_REL, ROOT_DEFAULT, renderBridgeCss, renderFoundationsCss } from '../../../../../scripts/generate-foundations.mjs'
import { DERIVED, GLYPH_FLOOR, ROOT_REGISTER, STEP, glyphBox } from '../../../../../scripts/lib/foundations-rules.mjs'
import { anchors, checkAnchors, resolve as resolveEmitted, type Anchors } from '../../../../../scripts/lib/foundations-model.mjs'
import { CFG as VENDORED_CFG } from './vendor/mathematical-design-system/scale.mjs'

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

/** The skill's former revision, frozen as the repo's own scale.mjs (ADR-0245 Amendment 3, T-0372). */
const VENDORED_SHA = '3c319761e5c8221e500077d62db65a555b95a85145cd022b58255b6e6057ba5b'
/** The skill's current resolver and radius policy, vendored untouched (`scripts/lib/{scale,curvature}.mjs`, T-0372).
 *  Re-vendoring is a deliberate change of these lines. */
const VENDOR = 'packages/agent-ui/shared/src/tokens/vendor/mathematical-design-system'
const CURRENT_SCALE_SHA = '5b370bdd0b6dda206db29f34c7f9aecaed00972ccdd4de41804d3117e68dd2b8'
const CURRENT_CURVATURE_SHA = 'cc1639f495299070ac02f86825589e970aff9286933fe6a3b0435e71fba84a2f'
/** T-0372 parity: both sheets as they stood before the re-vendor. A change that moves an emitted token changes these
 *  on purpose (T-0373, T-0374), never as a side effect of where an input is read. */
const PARITY_SHA = {
  foundations: '5a0dd7eef81aed81231a89c889f5c87a6c451c43c9406aa7fddf1516128d2aef',
  bridge: '1ad5621277876b1f3c4073e5438a9fb50ead1bece8b708b98c74b403378f8952',
}
const textSha = (text: string): string => createHash('sha256').update(text).digest('hex')

describe('foundations: the vendored config and its contract (ADR-0245 clause 1)', () => {
  it('scale.mjs is the frozen former skill revision, byte for byte, and so is the ADR derivation copy', () => {
    expect(sha('packages/agent-ui/shared/src/tokens/scale.mjs')).toBe(VENDORED_SHA)
    expect(sha('.claude/docs/references/foundations-derivation/scale.mjs')).toBe(VENDORED_SHA)
  })

  it('the vendored scale.mjs and curvature.mjs are the skill\'s current files, byte for byte (T-0372)', () => {
    expect(sha(`${VENDOR}/scale.mjs`)).toBe(CURRENT_SCALE_SHA)
    expect(sha(`${VENDOR}/curvature.mjs`)).toBe(CURRENT_CURVATURE_SHA)
  })

  it('T-0372 parity: both sheets render byte-identical to the pre-re-vendor tokens', () => {
    expect(textSha(renderFoundationsCss())).toBe(PARITY_SHA.foundations)
    expect(textSha(renderBridgeCss())).toBe(PARITY_SHA.bridge)
  })

  it('the parity pin bites: every anchor read from the vendored resolver moves a sheet when nudged', () => {
    const nudges: Record<string, (a: Anchors) => void> = {
      heightPerN: (a) => { a.heightPerN += 1 },
      iconPerN: (a) => { a.iconPerN += 0.5 },
      'containers.widget': (a) => { a.containers.widget += 0.5 },
      'containers.card': (a) => { a.containers.card += 0.5 },
      'containers.layout': (a) => { a.containers.layout += 0.5 },
      'Q[0]': (a) => { a.Q[0] += 0.01 },
      'Q[1]': (a) => { a.Q[1] += 0.01 },
      floor: (a) => { a.floor += 1 },
      'titleBump.md': (a) => { a.titleBump.md += 1 },
      kicker: (a) => { a.kicker -= 0.0625 },
      'linear.body': (a) => { a.linear.body = [a.linear.body[0] + 1, a.linear.body[1]] },
      'linear.control': (a) => { a.linear.control = [a.linear.control[0] + 1, a.linear.control[1]] },
    }
    for (const [name, nudge] of Object.entries(nudges)) {
      const a = anchors()
      nudge(a)
      const moved = textSha(renderFoundationsCss({ anchors: a })) !== PARITY_SHA.foundations || textSha(renderBridgeCss({ anchors: a })) !== PARITY_SHA.bridge
      expect(moved, name).toBe(true)
    }
    // Read at render time: a nudge of the vendored CFG itself reaches the next render, with no injection.
    const q = VENDORED_CFG.Q[0]
    try {
      VENDORED_CFG.Q[0] = q + 0.01
      expect(textSha(renderFoundationsCss())).not.toBe(PARITY_SHA.foundations)
    } finally {
      VENDORED_CFG.Q[0] = q
    }
    expect(textSha(renderFoundationsCss())).toBe(PARITY_SHA.foundations)
  })

  it('the generator refuses to emit on a broken vendored anchor (a falling heading ratio, a non-finite height)', () => {
    expect(checkAnchors()).toEqual([])
    const slope = VENDORED_CFG.Q[1]
    try {
      VENDORED_CFG.Q[1] = -0.1
      expect(checkAnchors().some((f) => f.startsWith('A2'))).toBe(true)
      expect(() => renderFoundationsCss()).toThrow(/refusing to emit/)
      expect(() => renderBridgeCss()).toThrow(/refusing to emit/)
    } finally {
      VENDORED_CFG.Q[1] = slope
    }
    const broken = anchors()
    broken.heightPerN = Number.NaN
    expect(() => renderFoundationsCss({ anchors: broken })).toThrow(/A1/)
    const flat = anchors()
    flat.containers.card = flat.containers.widget
    expect(checkAnchors(flat).some((f) => f.startsWith('A4'))).toBe(true)
  })

  it('resolve() mirrors the sheet: every emitted token equals the repo\'s resolve() on all 36 cells at every density', () => {
    const steps = ['sm', 'md', 'lg'] as const
    let cells = 0
    for (const tier of ['widget', 'product', 'content', 'brand'] as const) for (const s of steps) for (const z of steps) {
      for (const d of ['compact', 'default', 'spacious'] as const) {
        const e = resolveEmitted(tier, s, z, d)
        const r = resolve(tier, s, z, d)
        const at = `${tier}/${s}/${z} ${d}`
        expect([e.n, e.m, e.c, e.height, e.inset, e.labelInset, e.radius, e.iconBox, e.checkboxRadius], at)
          .toEqual([r.n, r.m, r.c, r.h, r.n, r.labelMargin, r.n, r.icon, r.parts.checkboxRadius])
        expect(e.glyphBox, at).toBe(glyphBox(r))
        expect(e.type, at).toEqual(r.type)
        expect([e.group, e.widget, e.card, e.layout], at).toEqual([r.group, r.widget, r.card, r.page])
        // The chip pill n + c (Amendment 5) and the control pill h/2 are the sheet's own, beside the resolver.
        expect(e.chip, at).toEqual({ margin: r.chip.margin, gutter: r.chip.gutter, radius: r.n + r.c })
        expect(e.controlRadius, at).toBe(r.h / 2)
        cells++
      }
    }
    expect(cells).toBe(108)
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
