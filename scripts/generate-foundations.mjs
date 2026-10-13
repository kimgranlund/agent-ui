#!/usr/bin/env node
// generate-foundations.mjs: writes packages/agent-ui/shared/src/tokens/foundations.gen.css and its consumer bridge
// foundations-bridge.gen.css from the vendored skill config `scale.mjs` beside them (ADR-0245 clauses 1 and 10a).
// Changing the system means editing CFG in scale.mjs, never a generated sheet. The generator refuses to emit when
// `check()` returns any failure (M1 to M10), so a broken config can never reach a stylesheet.
//
// The sheet is the skill's tokens.css form under ADR-0140 names: the tier inputs on `[data-tier="…"]`,
// scale and size on their attributes, and one derived block (`--md-sys-n`, the box values as multiples of
// n or c, the type roles, the four container levels) re-declared wherever an input changes, so each element
// computes its own n. ROOT_DEFAULT is the cut (clause 10a): true, so `:root` takes ROOT_INPUTS (product at
// scale sm) and the full recompute list. Set it to false to roll the cut back: every declaration then sits
// inside an opt-in `[data-tier]` region and each `var(<derived>, <today>)` resolves to today's value again.
//
// The bridge (clause 10a, one release after the cut, removed at W7) keeps the old names working: the
// hand-tabled `--md-sys-{height,font,icon,gap,compact}-{sm,md,lg}`, `--md-sys-widget-inset`,
// `--md-sys-shape-corner-base`, `--md-sys-space-*`, `--md-sys-typescale-*-size` and `--ui-bar-inline-inset`
// alias the derived values, `[scale]` and `[density]` set the tier and scale inputs (clause 2's table), and
// `[data-foundations="legacy"]` is the per-region opt-out (clause 10e): every derived token is `initial`, so the
// fleet's `var(<derived>, <today>)` fallbacks render today's geometry there, and the old names pin LEGACY.
//
// Usage:
//   node scripts/generate-foundations.mjs           rewrite the sheets when they are stale
//   node scripts/generate-foundations.mjs --check   write nothing; exit 1 when a sheet is stale or check() fails

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { CFG, check } from '../packages/agent-ui/shared/src/tokens/scale.mjs'
import { SCALE_TO_TIER } from './lib/foundations-rules.mjs'

export const OUT_REL = 'packages/agent-ui/shared/src/tokens/foundations.gen.css'
export const BRIDGE_REL = 'packages/agent-ui/shared/src/tokens/foundations-bridge.gen.css'
export const ROOT_DEFAULT = true
export const ROOT_INPUTS = { tier: 'product', scale: 'sm' }

const STEP = { sm: -1, md: 0, lg: 1 }
const N = 'var(--md-sys-n)'
const C = 'var(--md-sys-c)'
// scale.mjs measures the linear type anchors and Q from n = 5 (its `n - 5`), independent of the ladder.
const lin = ([at5, perStep]) => `calc((${at5} + ${perStep} * (${N} - 5)) * 1px)`
const q = `(${CFG.Q[0]} + ${CFG.Q[1]} * (${N} - 5))`
const headingRole = (power) => `round(nearest, var(--md-sys-type-body) * pow(${q}, ${power}), 1px)`

/** The derived block: every quantity scale.mjs `at()` returns, as a formula of this element's n. */
function derivedDeclarations() {
  const levels = Object.entries(CFG.levels).flatMap(([level, [margin, gutter, radius]]) => [
    [`--md-sys-${level}-margin`, `calc(${N} * ${margin}px)`],
    [`--md-sys-${level}-gutter`, `calc(${N} * ${gutter}px)`],
    [`--md-sys-${level}-radius`, `calc(${N} * ${radius}px)`],
  ])
  return [
    ['--md-sys-n', 'calc(var(--md-sys-tier-n0) + var(--md-sys-tier-a) * var(--md-sys-scale-s, 0) + var(--md-sys-tier-k) * var(--md-sys-size-z, 0) + var(--md-sys-tier-g) * var(--md-sys-scale-s, 0) * var(--md-sys-size-z, 0))'],
    ['--md-sys-c', `calc(round(up, ${N} / 4, 1) * 1px)`],
    ['--md-sys-height', `calc(${N} * 4px)`],
    ['--md-sys-inset', `calc(${N} * 1px)`],
    ['--md-sys-radius', `calc(${N} * 1px)`],
    ['--md-sys-icon-box', `calc(${N} * 2px)`],
    ['--md-sys-glyph-box', `calc(${N} * 2px - 2 * ${C})`],
    ['--md-sys-glyph-stroke', `max(1.5px, ${C} / 2)`],
    ['--md-sys-corner-shape', 'squircle'],
    ['--md-sys-type-display', headingRole(3)],
    ['--md-sys-type-heading', headingRole(2)],
    ['--md-sys-type-subhead', headingRole(1)],
    ['--md-sys-type-section-kicker', 'round(nearest, var(--md-sys-type-body) * var(--md-sys-tier-ratio), 1px)'],
    ['--md-sys-type-title', `calc(var(--md-sys-type-body) + var(--md-sys-title-bump, ${CFG.titleBump.md}) * 1px)`],
    ['--md-sys-type-body', lin(CFG.linear.body)],
    ['--md-sys-type-control', lin(CFG.linear.control)],
    ['--md-sys-type-field-label', lin(CFG.linear.fieldLabel)],
    ['--md-sys-type-group-kicker', lin(CFG.linear.groupKicker)],
    ['--md-sys-group-margin', `calc(var(--md-sys-inset) + ${C})`],
    ['--md-sys-group-gutter', C],
    ['--md-sys-group-radius', `calc(var(--md-sys-radius) + ${C})`],
    ...levels,
  ]
}

const tierInputs = ([n0, a, k, g]) =>
  `--md-sys-tier-n0: ${n0}; --md-sys-tier-a: ${a}; --md-sys-tier-k: ${k}; --md-sys-tier-g: ${g}; --md-sys-tier-ratio: ${CFG.kicker};`

/** The legacy axes join the recompute list at the cut so a `[scale]` / `[density]` element recomputes its n. */
const LEGACY_AXES = '[scale], [density]'

/** Where the derived block is declared: everywhere an input changes (the cut), or inside opt-in regions only. */
export const recomputeList = (rootDefault = ROOT_DEFAULT) =>
  rootDefault
    ? `:root, [data-tier], [data-scale], [data-size], [size], ${LEGACY_AXES}`
    : '[data-tier], [data-tier] :is([data-scale], [data-size], [size])'

/** Render the whole sheet. Throws (writes nothing) when check() reports a failure. */
export function renderFoundationsCss({ rootDefault = ROOT_DEFAULT } = {}) {
  const failures = check()
  if (failures.length) throw new Error(`scale.mjs check() failed, refusing to emit:\n  ${failures.join('\n  ')}`)
  // Scoped: an attribute counts only on a region root or inside one. Unscoped (the cut): anywhere.
  const scoped = (sel) => (rootDefault ? sel : `[data-tier]${sel}, [data-tier] ${sel}`)
  const out = [
    '/* foundations.gen.css: GENERATED by scripts/generate-foundations.mjs from scale.mjs (ADR-0245). DO NOT EDIT. */',
    '/* n = n0 + a*s + k*z + g*s*z per element (s = data-scale, z = data-size or a control\'s size, each -1 / 0 / +1). */',
    `/* ${rootDefault ? 'Root default (the cut): :root is product at scale sm and every element derives from one n.' : 'Dark launch: tokens exist only inside an opt-in [data-tier] region; nothing is declared on :root.'} */`,
  ]
  if (rootDefault) {
    const [n0, a, k, g] = CFG.tiers[ROOT_INPUTS.tier]
    out.push(`:root { ${tierInputs([n0, a, k, g])} --md-sys-scale-s: ${STEP[ROOT_INPUTS.scale]}; }`)
  }
  for (const [tier, constants] of Object.entries(CFG.tiers)) out.push(`[data-tier='${tier}'] { ${tierInputs(constants)} }`)
  for (const [step, s] of Object.entries(STEP)) out.push(`${scoped(`[data-scale='${step}']`)} { --md-sys-scale-s: ${s}; }`)
  for (const [step, z] of Object.entries(STEP)) {
    out.push(`${scoped(`:is([data-size='${step}'], [size='${step}'])`)} { --md-sys-size-z: ${z}; --md-sys-title-bump: ${CFG.titleBump[step]}; }`)
  }
  out.push(`${recomputeList(rootDefault)} {`)
  for (const [name, value] of derivedDeclarations()) out.push(`  ${name}: ${value};`)
  out.push('}')
  return `${out.join('\n')}\n`
}

// ---- The bridge (clause 10a) ----------------------------------------------------------------------------

/** M3 size names of the typescale rows -> the size step whose n they read. */
const M3_SIZE = { small: 'sm', medium: 'md', large: 'lg' }
/**
 * ui-text's typescale roles (ADR-0078) -> the skill role that derives them (ADR-0245 clause 7). `kicker` maps
 * to the field-label role, not the section kicker: every consumer of the old kicker rows (nav-rail group
 * labels, gauge and select captions, ui-text itself) is a small uppercase label over a group, 11 / 12 / 14px
 * today, never an eyebrow above a heading (T-0117; the section-kicker role keeps its own token).
 */
const TYPESCALE_ROLE = {
  display: 'display', headline: 'heading', title: 'title', body: 'body', label: 'fieldLabel',
  kicker: 'fieldLabel', overline: 'groupKicker', lead: 'subhead', quote: 'subhead',
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

/** A skill type role at the bridge n of `step` (scale.mjs `at()`, as CSS). */
function roleAt(role, step) {
  const n = `var(--md-sys-bridge-n-${step})`
  const body = `var(--md-sys-bridge-body-${step})`
  const lin = ([at5, perStep]) => `calc((${at5} + ${perStep} * (${n} - 5)) * 1px)`
  const heading = (power) => `round(nearest, ${body} * pow((${CFG.Q[0]} + ${CFG.Q[1]} * (${n} - 5)), ${power}), 1px)`
  switch (role) {
    case 'display': return heading(3)
    case 'heading': return heading(2)
    case 'subhead': return heading(1)
    case 'sectionKicker': return `round(nearest, ${body} * ${CFG.kicker}, 1px)`
    case 'title': return `calc(${body} + ${CFG.titleBump[step]}px)`
    case 'body': return body
    default: return lin(CFG.linear[role])
  }
}

/** The bridge aliases: old name -> its derived value at the element's tier and scale. */
function bridgeDeclarations() {
  const decls = []
  for (const [step, z] of Object.entries(STEP)) decls.push([`--md-sys-bridge-n-${step}`, bridgeN(z)])
  for (const step of Object.keys(STEP)) decls.push([`--md-sys-bridge-body-${step}`, `calc((${CFG.linear.body[0]} + ${CFG.linear.body[1]} * (var(--md-sys-bridge-n-${step}) - 5)) * 1px)`])
  for (const step of Object.keys(STEP)) {
    const n = `var(--md-sys-bridge-n-${step})`
    decls.push(
      [`--md-sys-height-${step}`, `calc(${n} * 4px)`],
      [`--md-sys-font-${step}`, roleAt('control', step)],
      [`--md-sys-icon-${step}`, `calc(${n} * 2px)`],
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
    for (const [m3, step] of Object.entries(M3_SIZE)) decls.push([`--md-sys-typescale-${role}-${m3}-size`, roleAt(skillRole, step)])
  }
  decls.push(['--ui-bar-inline-inset', 'var(--md-sys-layout-margin)'])
  return decls
}

/** Every name the legacy opt-out sets to `initial`: the inputs, the derived block and the bridge's own n. */
function legacyInitialNames() {
  const inputs = ['tier-n0', 'tier-a', 'tier-k', 'tier-g', 'tier-ratio', 'scale-s', 'size-z', 'title-bump'].map((n) => `--md-sys-${n}`)
  const bridge = Object.keys(STEP).flatMap((step) => [`--md-sys-bridge-n-${step}`, `--md-sys-bridge-body-${step}`])
  return [...inputs, ...derivedDeclarations().map(([name]) => name), ...bridge]
}

/** Render the bridge sheet. It loads after foundations.gen.css. */
export function renderBridgeCss({ rootDefault = ROOT_DEFAULT } = {}) {
  const failures = check()
  if (failures.length) throw new Error(`scale.mjs check() failed, refusing to emit:\n  ${failures.join('\n  ')}`)
  const out = [
    '/* foundations-bridge.gen.css: GENERATED by scripts/generate-foundations.mjs (ADR-0245 clause 10a). DO NOT EDIT. */',
    '/* The old names alias the derived values for one release after the cut; [scale] and [density] map onto tier and scale; */',
    '/* [data-foundations="legacy"] opts a region out (clause 10e). The whole sheet retires at W7. */',
  ]
  for (const [value, [tier, scale]] of Object.entries(SCALE_TO_TIER)) {
    out.push(`[scale='${value}'] { ${tierInputs(CFG.tiers[tier])} --md-sys-scale-s: ${STEP[scale]}; }`)
  }
  // [density] moved the gaps only; under one n it moves the scale (clause 2): compact is the root's sm, spacious one step up.
  out.push("[density='compact'] { --md-sys-scale-s: -1; }")
  out.push("[density='spacious'] { --md-sys-scale-s: 0; }")
  out.push(`${recomputeList(rootDefault)} {`)
  for (const [name, value] of bridgeDeclarations()) out.push(`  ${name}: ${value};`)
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
