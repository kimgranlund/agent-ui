// foundations-model.mjs: the inputs scripts/generate-foundations.mjs emits, and resolve(), the same tokens as px
// (T-0372), in the skill's structure (T-0373): its type role names, the control surface anatomy, the spacing roles
// of one margin reference, and whole px checked on the emitted values (checkEmitted()), not in the model.
// Browser-safe, so a browser test can read it the way it reads foundations-rules.mjs.
//
// Two resolvers feed the sheets. The skill's current resolver is vendored untouched under
// packages/agent-ui/shared/src/tokens/vendor/mathematical-design-system/ and read at regular density: it keeps
// floats, and the generator rounds only at CSS emission. The repo's own `scale.mjs` (the skill's former revision,
// sha 3c319761, frozen) supplies every input the current resolver cannot reproduce byte for byte (LEGACY_PATH) and
// `check()`. anchors() reads the vendored CFG on every call, so a change to it reaches the next render.

import { CFG as LEGACY_CFG } from '../../packages/agent-ui/shared/src/tokens/scale.mjs'
import { CFG, SPACING_ROLES, resolveControlSurface, resolveGeometry } from '../../packages/agent-ui/shared/src/tokens/vendor/mathematical-design-system/scale.mjs'
import { ROOT_REGISTER, STEP } from './foundations-rules.mjs'

/**
 * What stays on the repo's scale.mjs, because the current resolver gives a different value (T-0374 moves each one,
 * behind an approved mockup): the content and brand tier rows (current 11/3 and 15/4 against 10/2 and 14/2; all four
 * rows stay so `check()` validates the rows it emits), the density axis and m (current: five multipliers of n), and
 * the field label and group kicker values (current 10 + 1 per step for both, against 9 + 1 and 9 + 0.5): the group
 * kicker takes the skill's name with the former group label's value. Every token the current resolver has no field
 * for (inset, label inset, radii, chip, checkbox and group levels) keeps its own formula below.
 */
export const LEGACY_PATH = {
  tiers: LEGACY_CFG.tiers,
  density: LEGACY_CFG.density,
  linear: { fieldLabel: LEGACY_CFG.linear.fieldLabel, groupKicker: LEGACY_CFG.linear.groupLabel },
}

/**
 * The roomy levels, outermost last, as the spacing roles of their margin and gutter: each level's gutter is the role
 * one step below its margin's. Against the section reference 4m that is widget 2 / 1, card 3 / 2 and layout 4 / 3
 * multiples of m, the ladder the repo's scale.mjs walks. The skill calls the layout level `page`; the tokens keep
 * the ADR-0140 names widget, card and layout.
 */
const ROOMY = [['widget', 'group', 'control'], ['card', 'container', 'group'], ['layout', 'page', 'container']]

/**
 * The anchors the generator reads from the current resolver, at regular density at the root register, as
 * coefficients of n. The control surface (resolveControlSurface): the 3n slot every icon, label and glyph wrapper
 * fills, its margin and the 2n icon artwork; the height is slot + 2 margin. The margin reference is the section
 * container's 4d, read as 4m: the current resolver's d is n at regular density, and the legacy m is n at default
 * density on the whole ladder. The spacing roles are the skill's percentages of it (SPACING_ROLES).
 */
export function anchors() {
  const g = resolveGeometry(ROOT_REGISTER.tier, ROOT_REGISTER.scale, 'md', 'regular')
  const surface = resolveControlSurface(g.n, 'regular')
  const perN = (x) => x / g.n
  return {
    slotPerN: perN(surface.innerHeight),
    marginPerN: perN(surface.margin),
    iconPerN: perN(surface.icon),
    marginReference: perN(g.containers.section.margin),
    roles: { ...SPACING_ROLES },
    Q: [...CFG.Q],
    floor: CFG.floor,
    titleBump: { ...CFG.titleBump },
    kicker: CFG.kicker,
    linear: { body: [...CFG.linear.body], control: [...CFG.linear.control], ...LEGACY_PATH.linear },
  }
}

/** The control height per n, the slot plus a margin above and below (the skill's H = 3n + 2m). */
export const heightPerN = (a = anchors()) => a.slotPerN + 2 * a.marginPerN

/** The roomy levels as [token, margin, gutter] multiples of m: the margin reference at each level's two role
 *  percentages (the skill's composeContainer() arithmetic, which throws on a bad input where this never does). */
export function roomyLevels(a = anchors()) {
  const at = (role) => (a.marginReference * a.roles[role]) / 100
  return ROOMY.map(([token, margin, gutter]) => [token, at(margin), at(gutter)])
}

const ROLES = ['display', 'heading', 'subhead', 'sectionKicker', 'body', 'control', 'fieldLabel', 'groupKicker']

/** The type roles at n, as the sheet computes them (CSS round(nearest) is Math.round for these positive sizes). */
function typeAt(n, size, a) {
  const lin = ([at5, perStep]) => Math.max(a.floor, at5 + perStep * (n - 5))
  const body = lin(a.linear.body)
  const q = a.Q[0] + a.Q[1] * (n - 5)
  return {
    display: Math.round(body * q ** 3), heading: Math.round(body * q ** 2), subhead: Math.round(body * q),
    sectionKicker: Math.round(body * a.kicker), title: body + a.titleBump[size], body,
    control: lin(a.linear.control), fieldLabel: lin(a.linear.fieldLabel), groupKicker: lin(a.linear.groupKicker),
  }
}

/**
 * The tokens foundations.gen.css declares on one element, in px (the bare numbers n and m excepted), at a tier,
 * scale, size and density. It mirrors the derived block term for term; foundations.test.ts holds it to the repo's
 * scale.mjs resolve() on every cell, the glyph box and slot aside. `surface` is the control anatomy of
 * resolveControlSurface(): the glyph is the skill's n + 6 artwork in the square 3n glyph slot (T-0374), emitted as
 * `glyphBox` and `glyphSlot`, both whole px on every cell. The sheet emits the surface's height, icon box, glyph box
 * and slot only. The rest is not gated: its n/2 margin and icon inset are fractional at odd n, so a later step adds
 * a surface value to checkEmitted() before the sheet emits it (foundations.test.ts fails on a surface token in the
 * derived block until then).
 */
export function resolve(tier = ROOT_REGISTER.tier, scale = ROOT_REGISTER.scale, size = 'md', density = 'default', a = anchors()) {
  const [n0, ta, k, g] = LEGACY_PATH.tiers[tier]
  const s = STEP[scale]
  const z = STEP[size]
  const n = n0 + ta * s + k * z + g * s * z
  const c = Math.ceil(n / 4)
  const m = Math.max(n + ta * LEGACY_PATH.density[density], Math.floor((n + c) / 2) + 1)
  const height = n * heightPerN(a)
  const slot = n * a.slotPerN
  const iconBox = n * a.iconPerN
  const glyphBox = n + 6
  const levels = Object.fromEntries(roomyLevels(a).map(([token, margin, gutter]) => [token, { margin: m * margin, gutter: m * gutter, radius: m * margin }]))
  return {
    n, m, c, height, inset: n, labelInset: n - c, radius: n, controlRadius: height / 2, iconBox,
    glyphBox, glyphSlot: slot, glyphStroke: Math.max(1.5, c / 2), checkboxRadius: Math.ceil(n / 2),
    surface: { slot, margin: n * a.marginPerN, height, icon: iconBox, iconInset: (slot - iconBox) / 2, glyph: glyphBox, glyphInset: (slot - glyphBox) / 2 },
    type: typeAt(n, size, a),
    chip: { margin: c, gutter: c, radius: n + c },
    group: { margin: n + c, gutter: c, radius: n + c },
    ...levels,
  }
}

/**
 * The guard on the anchors (the refuse-to-emit rule beside the repo's check()): every anchor finite, the heading
 * ratio and the linear roles never falling as n grows, the type order and the floor held on the whole ladder, the
 * title bump rising with size, the icon inside its slot, the margin reference and role percentages in range and the
 * roomy levels nesting. Returns the failures; never throws (a malformed anchor set is an A1 failure).
 */
export function checkAnchors(a = anchors()) {
  try {
    return anchorFailures(a)
  } catch (err) {
    return [`A1 the anchors are malformed: ${err instanceof Error ? err.message : String(err)}`]
  }
}

function anchorFailures(a) {
  const bad = []
  const nums = [a.slotPerN, a.marginPerN, a.iconPerN, a.marginReference, ...Object.keys(SPACING_ROLES).map((r) => a.roles?.[r]), ...a.Q, a.floor, a.kicker, ...Object.values(a.titleBump), ...Object.values(a.linear).flat()]
  if (!nums.every(Number.isFinite)) return ['A1 an anchor is not finite']
  if (!(a.Q[0] > 1) || a.Q[1] < 0) bad.push(`A2 heading ratio ${a.Q[0]} + ${a.Q[1]} per step must be above 1 and never fall`)
  for (const [role, [, perStep]] of Object.entries(a.linear)) if (perStep < 0) bad.push(`A2 ${role} falls as n grows`)
  if (!(a.kicker >= 1)) bad.push(`A3 section kicker ratio ${a.kicker} is below 1`)
  if (!(a.titleBump.sm >= 0 && a.titleBump.sm <= a.titleBump.md && a.titleBump.md <= a.titleBump.lg)) bad.push('A3 title bump does not rise with size')
  if (!(a.iconPerN > 0 && a.iconPerN <= a.slotPerN)) bad.push(`A4 icon ${a.iconPerN}n does not fit the ${a.slotPerN}n slot`)
  if (!(a.marginPerN >= 0)) bad.push(`A4 control margin ${a.marginPerN}n is negative`)
  if (!(a.marginReference >= 0)) bad.push(`A5 margin reference ${a.marginReference}m is negative`)
  for (const role of Object.keys(SPACING_ROLES)) {
    const pct = a.roles[role]
    if (!(pct >= 0 && pct <= 200)) bad.push(`A5 ${role} role ${pct}% is outside 0 to 200`)
  }
  const levels = roomyLevels(a)
  levels.forEach(([token, margin, gutter], i) => {
    if (!(gutter < margin)) bad.push(`A4 ${token} gutter ${gutter}m is not below its margin ${margin}m`)
    if (i && !(levels[i - 1][1] < margin)) bad.push(`A4 ${token} margin ${margin}m does not nest outside ${levels[i - 1][0]}`)
  })
  const [lo, hi] = LEGACY_CFG.ladder
  let was = null
  for (let n = lo; n <= hi; n++) {
    const t = typeAt(n, 'md', a)
    ROLES.slice(1).forEach((r, i) => { if (t[ROLES[i]] < t[r]) bad.push(`A3 n ${n}: ${ROLES[i]} < ${r}`) })
    if (Math.min(...ROLES.map((r) => t[r])) < a.floor) bad.push(`A3 n ${n}: type below the ${a.floor}px floor`)
    if (was) ROLES.forEach((r) => { if (t[r] < was[r]) bad.push(`A2 n ${n - 1} -> ${n}: ${r} shrinks`) })
    was = t
  }
  return bad
}

/** The steps of each axis checkEmitted() walks: every tier, scale, size and density the sheet can declare. */
const CELLS = () => Object.keys(LEGACY_PATH.tiers).flatMap((t) => Object.keys(STEP).flatMap((s) => Object.keys(STEP).flatMap((z) =>
  Object.keys(LEGACY_PATH.density).map((d) => [t, s, z, d]))))
/** resolve() fields checkEmitted() holds to the 0.5px grid or leaves ungated, not to whole px. */
const NOT_WHOLE = new Set(['type', 'glyphStroke', 'surface'])

/**
 * The emit-time whole-px gate (T-0373), in place of the repo's model-level M7: the current resolver keeps floats and
 * rounds only at presentation, so the rule holds on what the sheet emits. On every tier, scale, size and density
 * cell, n and m are integers, every length is whole px, and the type roles and the glyph stroke sit on the 0.5px
 * grid (the group kicker steps 0.5 per n, the stroke is c / 2). The anatomy in `surface` is not emitted and is not
 * gated. Returns the failures.
 */
export function checkEmitted(a = anchors()) {
  const bad = []
  const onGrid = (x, step) => Number.isInteger(x / step)
  for (const [t, s, z, d] of CELLS()) {
    const r = resolve(t, s, z, d, a)
    const at = `${t}/${s}/${z} ${d}`
    for (const [name, v] of Object.entries(r)) {
      if (NOT_WHOLE.has(name)) continue
      const parts = typeof v === 'object' ? Object.entries(v).map(([k, x]) => [`${name} ${k}`, x]) : [[name, v]]
      for (const [key, x] of parts) if (!onGrid(x, 1)) bad.push(`E1 ${at}: ${key} ${x} is not whole px`)
    }
    for (const [role, x] of Object.entries(r.type)) if (!onGrid(x, 0.5)) bad.push(`E1 ${at}: type ${role} ${x} is off the 0.5px grid`)
    if (!onGrid(r.glyphStroke, 0.5)) bad.push(`E1 ${at}: glyph stroke ${r.glyphStroke} is off the 0.5px grid`)
  }
  return bad
}
