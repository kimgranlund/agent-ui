#!/usr/bin/env node
// generate-foundations.mjs: writes packages/agent-ui/shared/src/tokens/foundations.gen.css and its consumer bridge
// foundations-bridge.gen.css from two resolvers (ADR-0245 clauses 1 and 10a, T-0372): the skill's current one,
// vendored untouched under tokens/vendor/mathematical-design-system/, and the repo's own `scale.mjs` beside the
// sheets (the skill's former revision, frozen) for every input the current one cannot reproduce byte for byte.
// scripts/lib/foundations-model.mjs says which input comes from where (anchors(), LEGACY_PATH) and mirrors the
// sheet as px (resolve()). Never edit a generated sheet. The generator refuses to emit when the repo's `check()`
// returns any failure but M7 (M1 to M16; M14, no size that depends on n alone shrinks as n grows, is the skill's own
// since ADR-0245 Amendment 3), checkAnchors() does (the vendored anchors) or checkEmitted() does (T-0373: the whole-px
// rule M7 held on the emitted values, not in the model), so a broken config never reaches a stylesheet.
//
// The sheet is the skill's tokens.css form under ADR-0140 names: the tier inputs on `[data-tier="…"]`,
// scale, size and density on their attributes, and one derived block (`--md-sys-n`, the container unit
// `--md-sys-m`, the box values as multiples of n or c, the label inset n - c of the control rule (Amendment 4),
// the control pill 2n (Amendment 5), the type roles under the skill's names (T-0373: the section and group
// kickers), the chip level and the four container levels) re-declared
// wherever an input changes, so each element computes its own n and m. ROOT_DEFAULT is the cut (clause 10a): true, so `:root` takes ROOT_INPUTS (product at
// scale md since Amendment 8) and the full recompute list. Set it to false to roll the cut back: every declaration then sits
// inside an opt-in `[data-tier]` region and each `var(<derived>, <today>)` resolves to today's value again.
//
// The bridge (clause 10a, one release after the cut, removed at W7) keeps the old names working: the
// hand-tabled `--md-sys-{height,font,icon,gap,compact}-{sm,md,lg}`, `--md-sys-widget-inset`,
// `--md-sys-shape-corner-base`, `--md-sys-space-*`, `--md-sys-typescale-*-size`, `--ui-bar-inline-inset` and the
// type labels the kickers were renamed from (`--md-sys-type-{section,group}-label`, T-0373)
// alias the derived values (the retired `scale` and `density` attribute mappings were removed by T-0169), and
// `[data-foundations="legacy"]` is the per-region opt-out (clause 10e): every derived token is `initial`, so the
// fleet's `var(<derived>, <today>)` fallbacks render today's geometry there, and the old names pin LEGACY.
//
// Usage:
//   node scripts/generate-foundations.mjs           rewrite the sheets when they are stale
//   node scripts/generate-foundations.mjs --check   write nothing; exit 1 when a sheet is stale or check() fails

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { check } from '../packages/agent-ui/shared/src/tokens/scale.mjs'
import { GLYPH_FLOOR, RENAMED, ROOT_REGISTER, STEP } from './lib/foundations-rules.mjs'
import { LEGACY_PATH, anchors, checkAnchors, checkEmitted, heightPerN, roomyLevels } from './lib/foundations-model.mjs'

export const OUT_REL = 'packages/agent-ui/shared/src/tokens/foundations.gen.css'
export const BRIDGE_REL = 'packages/agent-ui/shared/src/tokens/foundations-bridge.gen.css'
export const ROOT_DEFAULT = true
// The root inputs live in foundations-rules.mjs (ROOT_REGISTER), where the lints and the browser tests read them too.
export const ROOT_INPUTS = ROOT_REGISTER

const N = 'var(--md-sys-n)'
const C = 'var(--md-sys-c)'
// Both resolvers measure the linear type anchors and Q from n = 5 (their `n - 5`), independent of the ladder; the
// emitted role never drops below the floor (9px: field label and group kicker are held there at n 4).
const lin = (a, [at5, perStep], n = N) => `max(${a.floor}px, calc((${at5} + ${perStep} * (${n} - 5)) * 1px))`
const headingRole = (a, power) => `round(nearest, var(--md-sys-type-body) * pow((${a.Q[0]} + ${a.Q[1]} * (${N} - 5)), ${power}), 1px)`

const M = 'var(--md-sys-m)'

/** The derived block: every quantity the resolvers return, as a formula of this element's n (and m for the
 *  widget, card and layout levels: density moves container spacing only, never a control or the group level). */
function derivedDeclarations(a = anchors()) {
  // The roomy factors are the spacing roles of the vendored section reference 4d, emitted against m: this assumes
  // d == m, true at default density (the vendored d is n at regular, the legacy m is n at default on the ladder).
  const levels = roomyLevels(a).flatMap(([level, margin, gutter]) => [
    [`--md-sys-${level}-margin`, `calc(${M} * ${margin}px)`],
    [`--md-sys-${level}-gutter`, `calc(${M} * ${gutter}px)`],
    [`--md-sys-${level}-radius`, `calc(${M} * ${margin}px)`],
  ])
  return [
    ['--md-sys-n', 'calc(var(--md-sys-tier-n0) + var(--md-sys-tier-a) * var(--md-sys-scale-s, 0) + var(--md-sys-tier-k) * var(--md-sys-size-z, 0) + var(--md-sys-tier-g) * var(--md-sys-scale-s, 0) * var(--md-sys-size-z, 0))'],
    // m = max(n + a*d, floor((n + c) / 2) + 1): one tier step a per density step, floored so a widget out-margins a group.
    ['--md-sys-m', `max(calc(${N} + var(--md-sys-tier-a) * var(--md-sys-density-d, 0)), calc(round(down, (${N} + round(up, ${N} / 4, 1)) / 2, 1) + 1))`],
    ['--md-sys-c', `calc(round(up, ${N} / 4, 1) * 1px)`],
    // The control surface: the 3n slot plus a margin above and below (resolveControlSurface at regular density).
    ['--md-sys-height', `calc(${N} * ${heightPerN(a)}px)`],
    ['--md-sys-inset', `calc(${N} * 1px)`],
    // The control rule (Amendment 4): the text slot carries the label inset n - c, so gutter c + inset = margin n.
    ['--md-sys-label-inset', `calc(var(--md-sys-inset) - ${C})`],
    ['--md-sys-radius', `calc(${N} * 1px)`],
    // The pill (Amendment 5): every single-line control takes h/2 = 2n; a textarea takes it too, and a panel
    // takes its row's 2n plus its own inset, so rows nest concentrically.
    ['--md-sys-control-radius', 'calc(var(--md-sys-height) / 2)'],
    ['--md-sys-icon-box', `calc(${N} * ${a.iconPerN}px)`],
    // The glyph floor (ADR-0245 Amendment 7): 2n - 2c, never below GLYPH_FLOOR, so the n 5 marks stay legible. Local to
    // agent-ui (neither resolver carries it); JS and TS readers use glyphBox() from the same module.
    ['--md-sys-glyph-box', `max(${GLYPH_FLOOR}px, calc(${N} * 2px - 2 * ${C}))`],
    ['--md-sys-glyph-stroke', `max(1.5px, ${C} / 2)`],
    ['--md-sys-corner-shape', 'squircle'],
    ['--md-sys-type-display', headingRole(a, 3)],
    ['--md-sys-type-heading', headingRole(a, 2)],
    ['--md-sys-type-subhead', headingRole(a, 1)],
    ['--md-sys-type-section-kicker', 'round(nearest, var(--md-sys-type-body) * var(--md-sys-tier-ratio), 1px)'],
    ['--md-sys-type-title', `calc(var(--md-sys-type-body) + var(--md-sys-title-bump, ${a.titleBump.md}) * 1px)`],
    ['--md-sys-type-body', lin(a, a.linear.body)],
    ['--md-sys-type-control', lin(a, a.linear.control)],
    ['--md-sys-type-field-label', lin(a, a.linear.fieldLabel)],
    ['--md-sys-type-group-kicker', lin(a, a.linear.groupKicker)],
    ['--md-sys-type-floor', `${a.floor}px`],
    // The chip level (tag, badge, kbd): margin c, gutter c, and the chip pill n + c, h/2 of the 2n + 2c chip
    // (Amendment 5). The checkbox box stays a rounded square at ceil(n/2), the skill's checkboxRadius.
    ['--md-sys-chip-margin', C],
    ['--md-sys-chip-gutter', C],
    ['--md-sys-chip-radius', `calc(var(--md-sys-inset) + ${C})`],
    ['--md-sys-checkbox-radius', `calc(round(up, ${N} / 2, 1) * 1px)`],
    ['--md-sys-group-margin', `calc(var(--md-sys-inset) + ${C})`],
    ['--md-sys-group-gutter', C],
    ['--md-sys-group-radius', `calc(var(--md-sys-radius) + ${C})`],
    ...levels,
  ]
}

const tierInputs = ([n0, ta, k, g], a) =>
  `--md-sys-tier-n0: ${n0}; --md-sys-tier-a: ${ta}; --md-sys-tier-k: ${k}; --md-sys-tier-g: ${g}; --md-sys-tier-ratio: ${a.kicker};`

/** Where the derived block is declared: everywhere an input changes (the cut), or inside opt-in regions only. */
export const recomputeList = (rootDefault = ROOT_DEFAULT) =>
  rootDefault
    ? ':root, [data-tier], [data-scale], [data-size], [size], [data-density]'
    : '[data-tier], [data-tier] :is([data-scale], [data-size], [size], [data-density])'

// M7 (whole px in the model) retired in T-0373: checkEmitted() holds the rule on the emitted values instead.
const refuseOnFailure = (a) => {
  const failures = [...check().filter((f) => !f.startsWith('M7 ')), ...checkAnchors(a)]
  if (!failures.length) failures.push(...checkEmitted(a))
  if (failures.length) throw new Error(`foundations check() failed (scale.mjs check(), checkAnchors(), checkEmitted()), refusing to emit:\n  ${failures.join('\n  ')}`)
}

/** Render the whole sheet. Throws (writes nothing) when check() reports a failure. */
export function renderFoundationsCss({ rootDefault = ROOT_DEFAULT, anchors: a = anchors() } = {}) {
  refuseOnFailure(a)
  // Scoped: an attribute counts only on a region root or inside one. Unscoped (the cut): anywhere.
  const scoped = (sel) => (rootDefault ? sel : `[data-tier]${sel}, [data-tier] ${sel}`)
  const out = [
    '/* foundations.gen.css: GENERATED by scripts/generate-foundations.mjs from scripts/lib/foundations-model.mjs (ADR-0245, T-0372). DO NOT EDIT. */',
    '/* n = n0 + a*s + k*z + g*s*z per element (s = data-scale, z = data-size or a control\'s size, each -1 / 0 / +1). */',
    '/* m = max(n + a*d, floor((n + c) / 2) + 1) (d = data-density, -1 / 0 / +1): the widget, card and layout levels read m. */',
    `/* ${rootDefault ? `Root default (the cut): :root is ${ROOT_INPUTS.tier} at scale ${ROOT_INPUTS.scale} and every element derives from one n.` : 'Dark launch: tokens exist only inside an opt-in [data-tier] region; nothing is declared on :root.'} */`,
  ]
  if (rootDefault) {
    out.push(`:root { ${tierInputs(LEGACY_PATH.tiers[ROOT_INPUTS.tier], a)} --md-sys-scale-s: ${STEP[ROOT_INPUTS.scale]}; }`)
  }
  for (const [tier, constants] of Object.entries(LEGACY_PATH.tiers)) out.push(`[data-tier='${tier}'] { ${tierInputs(constants, a)} }`)
  for (const [step, s] of Object.entries(STEP)) out.push(`${scoped(`[data-scale='${step}']`)} { --md-sys-scale-s: ${s}; }`)
  for (const [step, z] of Object.entries(STEP)) {
    out.push(`${scoped(`:is([data-size='${step}'], [size='${step}'])`)} { --md-sys-size-z: ${z}; --md-sys-title-bump: ${a.titleBump[step]}; }`)
  }
  for (const [density, d] of Object.entries(LEGACY_PATH.density)) out.push(`${scoped(`[data-density='${density}']`)} { --md-sys-density-d: ${d}; }`)
  out.push(`${recomputeList(rootDefault)} {`)
  for (const [name, value] of derivedDeclarations(a)) out.push(`  ${name}: ${value};`)
  out.push('}')
  return `${out.join('\n')}\n`
}

// ---- The bridge (clause 10a) ----------------------------------------------------------------------------

/** M3 size names of the typescale rows -> the size step whose n they read. */
const M3_SIZE = { small: 'sm', medium: 'md', large: 'lg' }
/**
 * ui-text's typescale roles (ADR-0078) -> the skill role that derives them (ADR-0245 clause 7). `kicker` is an
 * alias of the group kicker, like `overline`: every consumer of the old kicker rows (nav-rail group labels, gauge
 * and select captions, ui-text itself) is a small uppercase label over a group, never an eyebrow above a heading
 * (T-0117, Amendment 3; the section kicker keeps its own token, `--md-sys-type-section-kicker`).
 */
const TYPESCALE_ROLE = {
  display: 'display', headline: 'heading', title: 'title', body: 'body', label: 'fieldLabel',
  kicker: 'groupKicker', overline: 'groupKicker', lead: 'subhead', quote: 'subhead',
}

/**
 * Today's values at the default register (no `[scale]`, no `[density]`, scale 1): the hand-tabled ramp of
 * ADR-0038 and ADR-0041, the ADR-0078 typescale sizes, the ADR-0015 corner and the 4px space ladder. This is
 * their one home after the cut; the legacy opt-out pins the old names to it.
 */
export const LEGACY = {
  '--md-sys-height-sm': '24px', '--md-sys-height-md': '28px', '--md-sys-height-lg': '36px',
  '--md-sys-font-sm': '13px', '--md-sys-font-md': '14px', '--md-sys-font-lg': '16px',
  '--md-sys-icon-sm': '16px', '--md-sys-icon-md': '18px', '--md-sys-icon-lg': '20px',
  '--md-sys-gap-sm': '6.5px', '--md-sys-gap-md': '7px', '--md-sys-gap-lg': '8px',
  '--md-sys-compact-sm': '14px', '--md-sys-compact-md': '16px', '--md-sys-compact-lg': '18px',
  '--md-sys-widget-inset': '2px',
  '--md-sys-shape-corner-base': '12px',
  '--md-sys-space-none': '0', '--md-sys-space-xs': '4px', '--md-sys-space-sm': '8px', '--md-sys-space-md': '12px',
  '--md-sys-space-lg': '16px', '--md-sys-space-xl': '24px', '--md-sys-space-2xl': '32px',
  ...typescaleLegacy({
    display: [57, 45, 36], headline: [32, 28, 24], title: [22, 16, 14], body: [16, 14, 12], label: [14, 12, 11],
    kicker: [14, 12, 11], overline: [14, 12, 11], lead: [22, 18, 16], quote: [22, 18, 16],
  }),
  '--ui-bar-inline-inset': '24px',
}

function typescaleLegacy(rows) {
  return Object.fromEntries(
    Object.entries(rows).flatMap(([role, sizes]) =>
      ['large', 'medium', 'small'].map((m3, i) => [`--md-sys-typescale-${role}-${m3}-size`, `${sizes[i]}px`]),
    ),
  )
}

/** n one size step down, at and up from the element's tier and scale (z ignored: the old names were absolute). */
const bridgeN = (z) =>
  `calc(var(--md-sys-tier-n0) + var(--md-sys-tier-a) * var(--md-sys-scale-s, 0) + (var(--md-sys-tier-k) + var(--md-sys-tier-g) * var(--md-sys-scale-s, 0)) * ${z})`

/** A type role at the bridge n of `step` (the resolvers' type roles, as CSS). */
function roleAt(role, step, a) {
  const n = `var(--md-sys-bridge-n-${step})`
  const body = `var(--md-sys-bridge-body-${step})`
  const heading = (power) => `round(nearest, ${body} * pow((${a.Q[0]} + ${a.Q[1]} * (${n} - 5)), ${power}), 1px)`
  switch (role) {
    case 'display': return heading(3)
    case 'heading': return heading(2)
    case 'subhead': return heading(1)
    case 'sectionKicker': return `round(nearest, ${body} * ${a.kicker}, 1px)`
    case 'title': return `calc(${body} + ${a.titleBump[step]}px)`
    case 'body': return body
    default: return lin(a, a.linear[role], n)
  }
}

/** The bridge aliases: old name -> its derived value at the element's tier and scale. */
function bridgeDeclarations(a) {
  const decls = []
  for (const [step, z] of Object.entries(STEP)) decls.push([`--md-sys-bridge-n-${step}`, bridgeN(z)])
  for (const step of Object.keys(STEP)) decls.push([`--md-sys-bridge-body-${step}`, lin(a, a.linear.body, `var(--md-sys-bridge-n-${step})`)])
  for (const step of Object.keys(STEP)) {
    const n = `var(--md-sys-bridge-n-${step})`
    decls.push(
      [`--md-sys-height-${step}`, `calc(${n} * ${heightPerN(a)}px)`],
      [`--md-sys-font-${step}`, roleAt('control', step, a)],
      [`--md-sys-icon-${step}`, `calc(${n} * ${a.iconPerN}px)`],
      [`--md-sys-gap-${step}`, `calc(${n} * 1px)`],
      [`--md-sys-compact-${step}`, `calc(${n} * 2px)`],
    )
  }
  decls.push(
    ['--md-sys-widget-inset', 'var(--md-sys-c)'],
    ['--md-sys-shape-corner-base', 'var(--md-sys-card-radius)'],
    // clause 6: the six gap enums keep their names at the element's own n.
    ['--md-sys-space-none', '0'],
    ['--md-sys-space-xs', 'var(--md-sys-c)'],
    ['--md-sys-space-sm', 'var(--md-sys-inset)'],
    ['--md-sys-space-md', 'var(--md-sys-group-margin)'],
    ['--md-sys-space-lg', 'var(--md-sys-widget-margin)'],
    ['--md-sys-space-xl', 'var(--md-sys-card-margin)'],
    ['--md-sys-space-2xl', 'var(--md-sys-layout-margin)'],
  )
  for (const [role, skillRole] of Object.entries(TYPESCALE_ROLE)) {
    for (const [m3, step] of Object.entries(M3_SIZE)) decls.push([`--md-sys-typescale-${role}-${m3}-size`, roleAt(skillRole, step, a)])
  }
  decls.push(['--ui-bar-inline-inset', 'var(--md-sys-layout-margin)'])
  for (const [old, name] of Object.entries(RENAMED)) decls.push([old, `var(${name})`])
  return decls
}

/** Every name the legacy opt-out sets to `initial`: the inputs, the derived block, the bridge's own n and the
 *  renamed type labels, so a consumer's `var(--md-sys-type-group-label, <fallback>)` takes its fallback there. */
function legacyInitialNames() {
  const inputs = ['tier-n0', 'tier-a', 'tier-k', 'tier-g', 'tier-ratio', 'scale-s', 'size-z', 'title-bump', 'density-d'].map((n) => `--md-sys-${n}`)
  const bridge = Object.keys(STEP).flatMap((step) => [`--md-sys-bridge-n-${step}`, `--md-sys-bridge-body-${step}`])
  return [...inputs, ...derivedDeclarations().map(([name]) => name), ...bridge, ...Object.keys(RENAMED)]
}

/** Render the bridge sheet. It loads after foundations.gen.css. */
export function renderBridgeCss({ rootDefault = ROOT_DEFAULT, anchors: a = anchors() } = {}) {
  refuseOnFailure(a)
  const out = [
    '/* foundations-bridge.gen.css: GENERATED by scripts/generate-foundations.mjs (ADR-0245 clause 10a). DO NOT EDIT. */',
    '/* The old names alias the derived values; the retired scale and density attributes are no longer mapped (T-0169); */',
    '/* [data-foundations="legacy"] opts a region out (clause 10e). The whole sheet retires at W7. */',
  ]
  out.push(`${recomputeList(rootDefault)} {`)
  for (const [name, value] of bridgeDeclarations(a)) out.push(`  ${name}: ${value};`)
  out.push('}')
  out.push("[data-foundations='legacy'] {")
  for (const name of legacyInitialNames()) out.push(`  ${name}: initial;`)
  for (const [name, value] of Object.entries(LEGACY)) out.push(`  ${name}: ${value};`)
  out.push('}')
  out.push(`[data-foundations='legacy'] :is(${recomputeList(true).replace(':root, [data-tier], ', '')}) {`)
  for (const [name, value] of Object.entries(LEGACY)) out.push(`  ${name}: ${value};`)
  out.push('}')
  return `${out.join('\n')}\n`
}

const SHEETS = [
  [OUT_REL, renderFoundationsCss],
  [BRIDGE_REL, renderBridgeCss],
]

function main() {
  const root = fileURLToPath(new URL('..', import.meta.url))
  let rendered
  try {
    rendered = SHEETS.map(([rel, render]) => [rel, render()])
  } catch (err) {
    console.error(`generate-foundations: ${err.message}`)
    process.exit(1)
  }
  const stale = rendered.filter(([rel, fresh]) => {
    const outPath = join(root, rel)
    return !existsSync(outPath) || readFileSync(outPath, 'utf8') !== fresh
  })
  if (process.argv.includes('--check')) {
    if (stale.length === 0) return
    for (const [rel] of stale) console.error(`generate-foundations: ${rel} is stale; run node scripts/generate-foundations.mjs`)
    process.exit(1)
  }
  if (stale.length === 0) return console.log('generate-foundations: both sheets already fresh')
  for (const [rel, fresh] of stale) {
    writeFileSync(join(root, rel), fresh)
    console.log(`generate-foundations: wrote ${rel}`)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
