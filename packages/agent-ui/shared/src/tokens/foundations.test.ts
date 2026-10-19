import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { CFG, check, resolve, type Resolved } from './scale.mjs'
import { BRIDGE_REL, LEGACY, OUT_REL, ROOT_DEFAULT, renderBridgeCss, renderFoundationsCss } from '../../../../../scripts/generate-foundations.mjs'
import { DERIVED, GLYPH_FLOOR, RENAMED, ROOT_REGISTER, STEP, glyphBox, isDerived } from '../../../../../scripts/lib/foundations-rules.mjs'
import { anchors, checkAnchors, checkEmitted, resolve as resolveEmitted, type Anchors } from '../../../../../scripts/lib/foundations-model.mjs'
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
/** T-0372 parity: both sheets byte for byte. A change that moves an emitted token changes these on purpose, never as
 *  a side effect of where an input is read. T-0373 moved both, with no computed value changed: the sheet's header now
 *  names foundations-model.mjs, and the section and group labels take the skill's kicker names (`--md-sys-type-
 *  {section,group}-kicker`), the bridge aliasing the old names to them and resetting them in the legacy opt-out.
 *  T-0374 moves them again with each visible change. */
const PARITY_SHA = {
  foundations: '43026888f51a7e82381b607f6850148fd97fc8ce0145eba08d8bb2122f5e8f15',
  bridge: '25d6ef166aa308a181d043210295a5ff19f93057c2c2e934f3363afc79917ac1',
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

  it('T-0372 parity: both sheets render byte-identical to the pinned tokens (moved once by the T-0373 renames)', () => {
    expect(textSha(renderFoundationsCss())).toBe(PARITY_SHA.foundations)
    expect(textSha(renderBridgeCss())).toBe(PARITY_SHA.bridge)
  })

  it('the parity pin bites: every anchor read from the vendored resolver moves a sheet, or refuses it, when nudged', () => {
    // A nudge either renders a different sheet or trips a guard (a role that no longer nests, a fractional px), and a
    // refused sheet has moved too: it is not the pinned one.
    const shas = (a: Anchors): string[] | null => {
      try {
        return [textSha(renderFoundationsCss({ anchors: a })), textSha(renderBridgeCss({ anchors: a }))]
      } catch {
        return null
      }
    }
    const nudges: Record<string, (a: Anchors) => void> = {
      slotPerN: (a) => { a.slotPerN += 1 },
      marginPerN: (a) => { a.marginPerN += 0.5 },
      iconPerN: (a) => { a.iconPerN += 1 },
      marginReference: (a) => { a.marginReference += 4 },
      'roles.page': (a) => { a.roles.page += 25 },
      'roles.container': (a) => { a.roles.container += 25 },
      'roles.group': (a) => { a.roles.group -= 25 },
      'roles.control': (a) => { a.roles.control -= 25 },
      'Q[0]': (a) => { a.Q[0] += 0.01 },
      'Q[1]': (a) => { a.Q[1] += 0.01 },
      floor: (a) => { a.floor += 1 },
      'titleBump.md': (a) => { a.titleBump.md += 1 },
      kicker: (a) => { a.kicker -= 0.0625 },
      'linear.body': (a) => { a.linear.body = [a.linear.body[0] + 1, a.linear.body[1]] },
      'linear.control': (a) => { a.linear.control = [a.linear.control[0] + 1, a.linear.control[1]] },
    }
    let rendered = 0
    for (const [name, nudge] of Object.entries(nudges)) {
      const a = anchors()
      nudge(a)
      const got = shas(a)
      expect(got === null || got[0] !== PARITY_SHA.foundations || got[1] !== PARITY_SHA.bridge, name).toBe(true)
      if (got) rendered++
    }
    expect(rendered, 'anti-vacuous: most nudges render a moved sheet rather than refuse').toBeGreaterThan(Object.keys(nudges).length / 2)
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

  it('the generator refuses to emit on a broken vendored anchor (a falling heading ratio, a non-finite slot)', () => {
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
    broken.slotPerN = Number.NaN
    expect(() => renderFoundationsCss({ anchors: broken })).toThrow(/A1/)
    const flat = anchors()
    flat.roles.container = flat.roles.group
    expect(checkAnchors(flat).some((f) => f.startsWith('A4'))).toBe(true)
  })

  it('T-0373 spacing roles: the roomy levels are one margin reference (the section\'s 4d) at the skill\'s role percentages', () => {
    const a = anchors()
    expect(a.marginReference).toBe(4)
    expect(a.roles).toEqual({ page: 100, container: 75, group: 50, control: 25 })
    const e = resolveEmitted()
    expect([e.widget, e.card, e.layout].map((l) => [l.margin / e.m, l.gutter / e.m])).toEqual([[2, 1], [3, 2], [4, 3]])
  })

  it('T-0373 control surface: the 3n slot plus two n/2 margins is the 4n control, the 2n icon centered in its slot', () => {
    const a = anchors()
    expect([a.slotPerN, a.marginPerN, a.iconPerN]).toEqual([3, 0.5, 2])
    const e = resolveEmitted()
    expect(e.surface).toEqual({ slot: 24, margin: 4, height: 32, icon: 16, iconInset: 4, glyph: 12, glyphInset: 6 })
    expect(e.surface.slot + 2 * e.surface.margin).toBe(e.height)
  })

  it('T-0373 emit-time whole px: every emitted length is whole px and type sits on the 0.5px grid; M7 no longer refuses', () => {
    expect(checkEmitted()).toEqual([])
    const half = anchors()
    half.iconPerN += 0.5 // 2.5n: fractional at every odd n
    expect(checkEmitted(half).some((f) => f.startsWith('E1') && f.includes('iconBox'))).toBe(true)
    expect(() => renderFoundationsCss({ anchors: half })).toThrow(/E1 .* iconBox .* is not whole px/)
    const slope = CFG.linear.groupLabel[1]
    try {
      CFG.linear.groupLabel[1] = 0.25 // the group kicker steps a quarter px: off the 0.5px grid at odd n
      expect(check().some((f) => f.startsWith('M7'))).toBe(true)
      const refusal = (() => {
        try {
          renderFoundationsCss()
          return ''
        } catch (err) {
          return String(err)
        }
      })()
      expect(refusal).toMatch(/E1 .* type groupKicker .* is off the 0.5px grid/) // the emitted value refuses
      expect(refusal).not.toMatch(/\bM7 /) // the model-level rule does not
      expect(() => renderBridgeCss()).toThrow(/E1/)
    } finally {
      CFG.linear.groupLabel[1] = slope
    }
    expect(checkEmitted()).toEqual([])
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
        // The skill's role names (T-0373): the kickers carry the former section and group labels' values.
        const { sectionLabel, groupLabel, ...rest } = r.type
        expect(e.type, at).toEqual({ ...rest, sectionKicker: sectionLabel, groupKicker: groupLabel })
        expect(e.surface, at).toEqual({
          slot: 3 * r.n, margin: r.n / 2, height: r.h, icon: r.icon, iconInset: r.n / 2, glyph: glyphBox(r), glyphInset: (3 * r.n - glyphBox(r)) / 2,
        })
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

  it('declares every ADR-0245 clause 1 output name (Amendment 3: m; T-0373: the section and group kickers; Amendment 4: the label inset and the chip level; Amendment 5: the control pill and the checkbox radius)', () => {
    const names = [
      'n', 'm', 'c', 'height', 'inset', 'label-inset', 'radius', 'control-radius', 'checkbox-radius', 'icon-box', 'glyph-box', 'glyph-stroke', 'corner-shape',
      ...['display', 'heading', 'subhead', 'section-kicker', 'title', 'body', 'control', 'field-label', 'group-kicker'].map((r) => `type-${r}`),
      ...['chip', 'group', 'widget', 'card', 'layout'].flatMap((l) => ['margin', 'gutter', 'radius'].map((q) => `${l}-${q}`)),
    ]
    for (const name of names) expect(committed, `--md-sys-${name}`).toMatch(new RegExp(`\\n  --md-sys-${name}: `))
    // T-0373: the labels are bridge aliases of the kickers only, never declared by the derived sheet, and reset in the
    // legacy opt-out so a consumer's fallback wins there; the lints still read them as derived.
    expect(committed).not.toMatch(/--md-sys-type-(?:section|group)-label/)
    for (const [old, name] of Object.entries(RENAMED)) {
      expect(bridge.match(new RegExp(`\\n  ${old}: [^;]*;`, 'g')), old).toEqual([`\n  ${old}: var(${name});`, `\n  ${old}: initial;`])
      expect([DERIVED.has(old), isDerived(old), DERIVED.has(name)], old).toEqual([false, true, true])
    }
    // the legacy opt-out resets the new names too, so a control's `var(--md-sys-label-inset, 0px)` reads 0 there
    for (const name of ['label-inset', 'chip-margin', 'chip-gutter', 'chip-radius', 'control-radius', 'checkbox-radius']) expect(bridge).toContain(`  --md-sys-${name}: initial;`)
  })
})
