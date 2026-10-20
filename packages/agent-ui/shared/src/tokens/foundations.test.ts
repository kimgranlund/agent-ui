import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { CFG, check, resolve, type Resolved } from './scale.mjs'
import { BRIDGE_REL, EMITTED_M7, LEGACY, OUT_REL, ROOT_DEFAULT, renderBridgeCss, renderFoundationsCss } from '../../../../../scripts/generate-foundations.mjs'
import { DERIVED, RENAMED, ROOT_REGISTER, STEP, glyphBox, findingsIn } from '../../../../../scripts/lib/foundations-rules.mjs'
import { anchors, checkAnchors, checkEmitted, radiusAmounts, resolve as resolveEmitted, widgetOverGroup, type Anchors } from '../../../../../scripts/lib/foundations-model.mjs'
import { CFG as VENDORED_CFG, DENSITIES, resolveGeometry } from './vendor/mathematical-design-system/scale.mjs'

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
 *  {section,group}-kicker`); the sheet aliases the old names to them for one release (one rule beside the derived
 *  block) and the bridge resets them in the legacy opt-out.
 *  T-0374 moves them again with each visible change. Step 1: the glyph box is n + 6 and the new `--md-sys-glyph-slot`
 *  is 3n (both sheets: the bridge resets the slot in the legacy opt-out). Step 2: the field label is the skill's
 *  10 + 1 per step (the bridge's label rows alias it) and the new `--md-sys-type-small-control` is 9 + 1. Step 3: the
 *  content and brand tier rows are the skill's 11/3/2/1 and 15/4/2/1 (the sheet only: the bridge reads no tier row).
 *  Step 4: density is the skill's q (tight 2 to loose 6) and moves the new `--md-sys-control-margin`, the height and
 *  m (both sheets: the bridge resets `--md-sys-density-q` and the control margin in the legacy opt-out). Step 6: the
 *  radii take the curvature presets, balanced at the root, and `[data-radius]` sets the two amounts (both sheets: the
 *  bridge resets `--md-sys-radius-amount` and `--md-sys-control-radius-amount` in the legacy opt-out). */
const PARITY_SHA = {
  foundations: '85baff8eaa96aea6c4f2ba45c1d062fc67f05facf30359358606cc4452c92105',
  bridge: '69d828fcdb21b55f18fed9606da400da6f6d5e3d2da3c52f6c50dae680b7da2f',
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

  it('T-0372 parity: both sheets render byte-identical to the pinned tokens (moved by the T-0373 renames and the T-0374 glyph)', () => {
    expect(textSha(renderFoundationsCss())).toBe(PARITY_SHA.foundations)
    expect(textSha(renderBridgeCss())).toBe(PARITY_SHA.bridge)
  })

  it('the parity pin bites: every anchor read from the vendored resolver moves a sheet, or refuses it, when nudged', () => {
    // A nudge either renders a different sheet or trips a guard (an A code: a role that no longer nests; E1: a
    // fractional px), and a refused sheet has moved too: it is not the pinned one. Any other throw is a bug and fails.
    const shas = (a: Anchors): string[] | null => {
      try {
        return [textSha(renderFoundationsCss({ anchors: a })), textSha(renderBridgeCss({ anchors: a }))]
      } catch (err) {
        if (/\b(?:A\d|E1) /.test(String(err))) return null
        throw err
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
      'radiusPresets.balanced': (a) => { a.radiusPresets.balanced -= 10 }, // T-0374 step 6: the vendored curvature preset
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
    // The tier rows are read from the vendored CFG at render time too (T-0374 step 3): a nudged row moves the sheet.
    const n0 = VENDORED_CFG.tiers.content[0]
    try {
      VENDORED_CFG.tiers.content[0] = n0 + 1
      expect(textSha(renderFoundationsCss())).not.toBe(PARITY_SHA.foundations)
    } finally {
      VENDORED_CFG.tiers.content[0] = n0
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
    // checkAnchors never throws: a role out of 0 to 200, a negative reference and a malformed set are all A codes.
    const wild = anchors()
    wild.roles.group = 250
    wild.marginReference = -4
    expect(checkAnchors(wild)).toEqual(expect.arrayContaining(['A5 group role 250% is outside 0 to 200', 'A5 margin reference -4m is negative']))
    expect(() => renderFoundationsCss({ anchors: wild })).toThrow(/A5 /)
    const malformed = { ...anchors(), Q: undefined } as unknown as Anchors
    expect(checkAnchors(malformed)).toEqual([expect.stringMatching(/^A1 /)])
  })

  it('T-0373 spacing roles: the roomy levels are one margin reference (the section\'s 4d) at the skill\'s role percentages', () => {
    const a = anchors()
    expect(a.marginReference).toBe(4)
    expect(a.roles).toEqual({ page: 100, container: 75, group: 50, control: 25 })
    const e = resolveEmitted()
    expect([e.widget, e.card, e.layout].map((l) => [l.margin / e.m, l.gutter / e.m])).toEqual([[2, 1], [3, 2], [4, 3]])
  })

  it('T-0373 control surface: the 3n slot plus two n/2 margins is the 4n control, the 2n icon and the n + 6 glyph centered in their slots', () => {
    const a = anchors()
    expect([a.slotPerN, a.marginPerN, a.iconPerN]).toEqual([3, 0.5, 2])
    const e = resolveEmitted()
    expect(e.surface).toEqual({ slot: 24, margin: 4, height: 32, icon: 16, iconInset: 4, glyph: 14, glyphInset: 5 })
    expect([e.glyphBox, e.glyphSlot]).toEqual([14, 24])
    expect(e.surface.slot + 2 * e.surface.margin).toBe(e.height)
  })

  it('T-0374 emit-time finite and monotonic: a falling n-only value refuses, a falling title across sizes does not', () => {
    // Kim's 2026-10-19 ruling: fractional px ship, so the gate holds every emitted value finite and never falling as n
    // grows, at each density. A fractional value is no longer a finding.
    expect(checkEmitted()).toEqual([])
    const half = anchors()
    half.iconPerN += 0.5 // 2.5n: fractional at every odd n, and still rising
    expect(checkEmitted(half)).toEqual([])
    // A falling n-only value: a negative control margin falls as n grows.
    const falling = anchors()
    falling.marginPerN = -0.5
    expect(checkEmitted(falling).some((f) => /^E1 .* controlMargin falls /.test(f))).toBe(true)
    expect(() => renderFoundationsCss({ anchors: falling })).toThrow(/refusing to emit/)
    const broken = anchors()
    broken.linear.groupKicker = [Number.POSITIVE_INFINITY, 0]
    expect(checkEmitted(broken).some((f) => /^E1 .* type groupKicker .* is not finite/.test(f))).toBe(true)
    // The title is size-bumped (body + titleBump[size]): widget lg/lg is n 8 with title 17, content md/sm n 9 with
    // title 16. It falls across sizes as n grows, and the gate checks it finite only.
    const [lg, sm] = [resolveEmitted('widget', 'lg', 'lg'), resolveEmitted('content', 'md', 'sm')]
    expect([lg.n, lg.type.title, sm.n, sm.type.title]).toEqual([8, 17, 9, 16])
    expect(checkEmitted()).toEqual([])
  })

  it('T-0374 the widget margin exceeds the group margin at every density on the whole ladder; without the floor it does not', () => {
    expect(widgetOverGroup()).toEqual([])
    // the red form: m = nq/4 alone puts the widget margin 2m at n at tight, inside the group margin n + c
    const bare = widgetOverGroup(anchors(), (n, d) => (n * DENSITIES[d]) / DENSITIES.regular)
    expect(bare).toContain('A6 n 8 tight: the widget margin 8 does not exceed the group margin 10')
    expect(resolveEmitted('product', 'md', 'md', 'tight').widget.margin).toBe(12)
  })

  it('T-0373 M7: the level and type forms are dropped from the refusal (fractional px ship, T-0374), the component-part form still refuses', () => {
    // scale.mjs is sha-pinned, so its three M7 message forms cannot drift from these; the anti-vacuous line proves it.
    const src = read('packages/agent-ui/shared/src/tokens/scale.mjs')
    for (const form of ['`M7 h${4 * n}: ${l} not whole px`', '`M7 h${4 * n}: type off the 0.5px grid`', '`M7 h${4 * n}: a chip, control, group or component size is not whole px`']) {
      expect(src, form).toContain(form)
    }
    for (const l of ['group', 'widget', 'card', 'page']) expect(EMITTED_M7.test(`M7 h20: ${l} not whole px`), l).toBe(true)
    expect(EMITTED_M7.test('M7 h20: type off the 0.5px grid')).toBe(true)
    expect(EMITTED_M7.test('M7 h20: a chip, control, group or component size is not whole px')).toBe(false)
  })

  it('T-0373 surface: the anatomy is not gated, so no surface token is emitted until T-0374 gates it', () => {
    // resolve().surface has fractional values at odd n (the insets). A derived token named for any of them reds here
    // first. T-0374 step 4 gates the control margin (a browser EXPECTED row at every density), so it leaves this list.
    const surfaceToken = /^--md-sys-(?:slot|icon-inset|glyph-inset|surface)/
    expect([...DERIVED].filter((name) => surfaceToken.test(name))).toEqual([])
    expect(Object.keys(resolveEmitted().surface).sort()).toEqual(['glyph', 'glyphInset', 'height', 'icon', 'iconInset', 'margin', 'slot'])
  })

  it('resolve() mirrors the sheet: every emitted token equals the repo\'s resolve() on all 36 cells at every density', () => {
    const steps = ['sm', 'md', 'lg'] as const
    const A = radiusAmounts()
    expect(A, 'the root preset is balanced (T-0374 step 6)').toEqual({ container: 0.5, control: 0.5 })
    let cells = 0
    for (const tier of ['widget', 'product', 'content', 'brand'] as const) for (const s of steps) for (const z of steps) {
      for (const d of Object.keys(DENSITIES) as Array<keyof typeof DENSITIES>) {
        const e = resolveEmitted(tier, s, z, d)
        const at = `${tier}/${s}/${z} ${d}`
        cells++
        // T-0374 step 4: density is the skill's. The control margin and height are its surface at d, m its d floored.
        const v = resolveGeometry(tier, s, z, d)
        expect([e.n, e.controlMargin, e.height, e.surface.margin, e.surface.height], at)
          .toEqual([v.n, v.surface.margin, v.surface.height, v.surface.margin, v.surface.height])
        expect(e.m, at).toBe(Math.max(v.d, Math.floor((v.n + Math.ceil(v.n / 4)) / 2) + 1))
        expect([e.widget, e.card, e.layout].map((l) => [l.margin / e.m, l.gutter / e.m]), at).toEqual([[2, 1], [3, 2], [4, 3]])
        // T-0374 step 3: the content and brand rows are the skill's (11/3/2/1, 15/4/2/1), not the frozen resolver's
        // (10/2/2/1, 14/2/2/1), so n and every field derived from it leave the legacy comparison on those tiers.
        if (tier === 'content' || tier === 'brand') continue
        // The frozen resolver has the three legacy densities; its default is the skill's regular, and density moves
        // nothing else, so every other field equals it at default.
        const r = resolve(tier, s, z, 'default')
        // T-0374 step 6: the radii are the balanced preset's, half the frozen resolver's (its radius is the margin and
        // its control the pill h/2): the container family A x margin, the control family A x h/2.
        if (d === 'regular') {
          expect([e.m, e.height, e.controlRadius], at).toEqual([r.m, r.h, A.control * r.h / 2])
          const level = (l: { margin: number; gutter: number; radius: number }) => ({ ...l, radius: A.container * l.radius })
          expect([e.widget, e.card, e.layout], at).toEqual([level(r.widget), level(r.card), level(r.page)])
        }
        expect([e.n, e.c, e.inset, e.labelInset, e.radius, e.iconBox, e.checkboxRadius], at)
          .toEqual([r.n, r.c, r.n, r.labelMargin, A.container * r.n, r.icon, r.parts.checkboxRadius])
        // T-0374: the glyph is the skill's n + 6 in its 3n slot, the model's own beside the frozen resolver.
        expect([e.glyphBox, e.glyphSlot], at).toEqual([r.n + 6, 3 * r.n])
        // The skill's role names (T-0373): the kickers carry the former section and group labels' values. T-0374
        // step 2: the field label (n + 5) and the small control role (n + 4) are the skill's, on the 9px floor.
        const { sectionLabel, groupLabel, ...rest } = r.type
        expect(e.type, at).toEqual({
          ...rest, sectionKicker: sectionLabel, groupKicker: groupLabel, fieldLabel: Math.max(9, r.n + 5), smallControl: Math.max(9, r.n + 4),
        })
        expect(e.surface, at).toEqual({
          slot: 3 * r.n, margin: v.surface.margin, height: v.surface.height, icon: r.icon, iconInset: r.n / 2, glyph: r.n + 6, glyphInset: (3 * r.n - (r.n + 6)) / 2,
        })
        expect(e.group, at).toEqual({ ...r.group, radius: A.container * r.group.radius })
        // The chip's h/2 n + c (Amendment 5) and the control's h/2, each at the control amount, are the sheet's own.
        expect(e.chip, at).toEqual({ margin: r.chip.margin, gutter: r.chip.gutter, radius: A.control * (r.n + r.c) })
        expect(e.controlRadius, at).toBe(A.control * e.height / 2)
      }
    }
    expect(cells).toBe(180)
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

  it('the radio dot is the icon box - 2c - 2 (not the n + 6 glyph minus 2) and never shrinks as n grows (the skill M14); the retired 2n - 4c did', () => {
    const steps = ['sm', 'md', 'lg']
    const rungs = Object.keys(CFG.tiers).flatMap((t) => steps.flatMap((s) => steps.map((z) => resolve(t, s, z))))
    const shrinks = (size: (r: Resolved) => number): boolean =>
      rungs.some((a) => rungs.some((b) => a.n < b.n && size(b) < size(a)))
    for (const r of rungs) expect(r.parts.radioDot, `n ${r.n}`).toBe(r.icon - 2 * r.c - 2)
    expect(shrinks((r) => r.parts.radioDot)).toBe(false)
    expect(shrinks((r) => r.icon - 4 * r.c)).toBe(true) // the control: 8 to 6 at n 8 to 9
  })

  it('the glyph box token is glyphBox(r) = n + 6 in its 3n slot (T-0374): at least 10 on the whole ladder, so no floor binds', () => {
    const steps = ['sm', 'md', 'lg']
    const rungs = Object.keys(CFG.tiers).flatMap((t) => steps.flatMap((s) => steps.map((z) => resolve(t, s, z))))
    for (const r of rungs) expect(glyphBox(r), `n ${r.n}`).toBe(r.n + 6)
    for (const r of rungs) expect(glyphBox(r), `n ${r.n}: fits its 3n slot`).toBeLessThanOrEqual(3 * r.n)
    const [lo] = CFG.ladder
    expect(lo + 6, 'the retired 8px floor never binds on the ladder').toBeGreaterThanOrEqual(10)
    expect(rungs.some((r) => r.n === 5 && glyphBox(r) === 11), 'anti-vacuous: an n 5 rung, where the glyph outgrows the 2n icon box').toBe(true)
    expect(glyphBox(resolve('product', 'md', 'md'))).toBe(14) // the root register
    expect(committed).toContain('--md-sys-glyph-box: calc(var(--md-sys-n) * 1px + 6px);')
    expect(committed).toContain('--md-sys-glyph-slot: calc(var(--md-sys-n) * 3px);')
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
    expect(legacy).toContain('  --md-sys-density-q: initial;')
    expect(legacy).toContain('  --md-sys-control-margin: initial;')
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
    expect(declared, 'T-0374: the 3n glyph slot is derived').toContain('--md-sys-glyph-slot')
    expect(declared, 'T-0374 step 2: the small control role is derived').toContain('--md-sys-type-small-control')
  })

  it('declares every ADR-0245 clause 1 output name (Amendment 3: m; T-0373: the section and group kickers; Amendment 4: the label inset and the chip level; Amendment 5: the control pill and the checkbox radius)', () => {
    const names = [
      'n', 'm', 'c', 'height', 'inset', 'label-inset', 'radius', 'control-radius', 'checkbox-radius', 'icon-box', 'glyph-box', 'glyph-slot', 'glyph-stroke', 'corner-shape',
      ...['display', 'heading', 'subhead', 'section-kicker', 'title', 'body', 'control', 'field-label', 'group-kicker'].map((r) => `type-${r}`),
      ...['chip', 'group', 'widget', 'card', 'layout'].flatMap((l) => ['margin', 'gutter', 'radius'].map((q) => `${l}-${q}`)),
    ]
    for (const name of names) expect(committed, `--md-sys-${name}`).toMatch(new RegExp(`\\n  --md-sys-${name}: `))
    // T-0373: the old labels alias the kickers in foundations.gen.css for one release (so a foundations-only importer
    // keeps them), outside the derived block, and the bridge resets them in the legacy opt-out so a fallback wins there.
    // They are not derived: the census flags a read of one.
    for (const [old, name] of Object.entries(RENAMED)) {
      expect(committed.match(new RegExp(`${old}: [^;]*;`, 'g')), old).toEqual([`${old}: var(${name});`])
      expect(bridge.match(new RegExp(`${old}: [^;]*;`, 'g')), old).toEqual([`${old}: initial;`])
      expect([DERIVED.has(old), DERIVED.has(name)], old).toEqual([false, true])
      expect(findingsIn('a.css', `x { font-size: var(${old}, 12px); }`).tokens.map((f) => f.text), old).toEqual([old])
    }
    // the legacy opt-out resets the new names too, so a control's `var(--md-sys-label-inset, 0px)` reads 0 there
    for (const name of ['label-inset', 'chip-margin', 'chip-gutter', 'chip-radius', 'control-radius', 'checkbox-radius']) expect(bridge).toContain(`  --md-sys-${name}: initial;`)
  })
})
