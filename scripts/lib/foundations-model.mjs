// foundations-model.mjs: the inputs scripts/generate-foundations.mjs emits, and resolve(), the same tokens as px
// (T-0372), in the skill's structure (T-0373): its type role names, the control surface anatomy, the spacing roles
// of one margin reference, and the emitted values checked finite and monotonic in n (checkEmitted(), T-0374).
// Browser-safe, so a browser test can read it the way it reads foundations-rules.mjs.
//
// Two resolvers feed the sheets. The skill's current resolver is vendored untouched under
// packages/agent-ui/shared/src/tokens/vendor/mathematical-design-system/ and read at its five densities (T-0374): it
// keeps floats, and fractional px ship. The repo's own `scale.mjs` (the skill's former revision,
// sha 3c319761, frozen) supplies every input the current resolver cannot reproduce byte for byte (LEGACY_PATH) and
// `check()`. anchors() reads the vendored CFG on every call, so a change to it reaches the next render.

import { CFG as LEGACY_CFG } from '../../packages/agent-ui/shared/src/tokens/scale.mjs'
import { CFG, DENSITIES, SPACING_ROLES, resolveControlSurface, resolveGeometry } from '../../packages/agent-ui/shared/src/tokens/vendor/mathematical-design-system/scale.mjs'
import { radiusPercentagePresets } from '../../packages/agent-ui/shared/src/tokens/vendor/mathematical-design-system/curvature.mjs'
import { ROOT_REGISTER, STEP } from './foundations-rules.mjs'

/**
 * What stays on the repo's scale.mjs, because the current resolver gives a different value (T-0374 moves each one,
 * behind an approved mockup): the group kicker value (current 10 + 1 per step, against 9 + 0.5): the group kicker
 * takes the skill's name with the former group label's value. The field label (10 + 1) and the small control role
 * (9 + 1) read the current resolver (T-0374 step 2), and so do the four tier rows (T-0374 step 3: content 11/3/2/1
 * and brand 15/4/2/1; checkAnchors() holds them to the ladder and to growth along size and scale) and the density
 * axis (T-0374 step 4: the vendored DENSITIES, tight 2 to loose 6, moving the control margin and m). The radii take
 * the vendored curvature presets (T-0374 step 6, radiusAmounts()). Every token the current resolver has no field for
 * (inset, label inset, chip, checkbox and group levels) keeps its own formula below.
 */
export const LEGACY_PATH = {
  linear: { groupKicker: LEGACY_CFG.linear.groupLabel },
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
 * container's 4d, read as 4m: m is the current resolver's d = nq/4 (containerUnit(), floored). The spacing roles are
 * the skill's percentages of it (SPACING_ROLES). The radius presets are the vendored curvature percentages, and the
 * root takes balanced (Kim's 2026-10-19 ruling, T-0374 step 6; pill is opt-in).
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
    linear: {
      body: [...CFG.linear.body], control: [...CFG.linear.control], fieldLabel: [...CFG.linear.fieldLabel],
      smallControl: [...CFG.linear.smallControl], ...LEGACY_PATH.linear,
    },
    radiusPresets: { ...radiusPercentagePresets },
    radiusPreset: 'balanced',
  }
}

/** The radius preset names `data-radius` takes: the vendored percentage presets plus pill. */
export const RADIUS_PRESETS = ['sharp', 'crisp', 'balanced', 'round', 'pill']

/**
 * The two radius amounts of a preset, as fractions (the skill's percentage A over 100, F = 0): `container` scales
 * the margins (the surface n, the group, widget, card and layout levels), `control` scales h/2 (a single-line
 * control) and the chip's h/2. Pill is the skill's h/2, exempt from A, on the control family only: the control amount
 * is 1 and the containers keep the root preset's amount (a container pill is a measured min(w, h)/2, which no token
 * can emit).
 */
export function radiusAmounts(preset = anchors().radiusPreset, a = anchors()) {
  if (preset === 'pill') return { container: radiusAmounts(a.radiusPreset === 'pill' ? 'balanced' : a.radiusPreset, a).container, control: 1 }
  const pct = a.radiusPresets[preset]
  return { container: pct / 100, control: pct / 100 }
}

/** The control height per n at regular density, the slot plus a margin above and below (the skill's H = 3n + 2m).
 *  The bridge's `--md-sys-height-{sm,md,lg}` read it (they stay at regular until W7 retires them). */
export const heightPerN = (a = anchors()) => a.slotPerN + 2 * a.marginPerN

/** The control margin per n at a density: resolveControlSurface()'s (q - 2)n/4, the regular anchor scaled by q - 2
 *  (q is 4 at regular, so a nudged anchor moves every density with it). */
export const marginPerNAt = (density = 'regular', a = anchors()) =>
  (a.marginPerN * (DENSITIES[density] - 2)) / (DENSITIES.regular - 2)

/** The container unit m at n and a density: the vendored d = nq/4 (n at regular), floored at floor((n + c)/2) + 1 so
 *  the widget margin 2m stays outside the group margin n + c at every density (checkAnchors() holds it). */
export const containerUnit = (n, density = 'regular') =>
  Math.max((n * DENSITIES[density]) / DENSITIES.regular, Math.floor((n + Math.ceil(n / 4)) / 2) + 1)

/** The roomy levels as [token, margin, gutter] multiples of m: the margin reference at each level's two role
 *  percentages (the skill's composeContainer() arithmetic, which throws on a bad input where this never does). */
export function roomyLevels(a = anchors()) {
  const at = (role) => (a.marginReference * a.roles[role]) / 100
  return ROOMY.map(([token, margin, gutter]) => [token, at(margin), at(gutter)])
}

const ROLES = ['display', 'heading', 'subhead', 'sectionKicker', 'body', 'control', 'fieldLabel', 'smallControl', 'groupKicker']

/** The type roles at n, as the sheet computes them (CSS round(nearest) is Math.round for these positive sizes). */
function typeAt(n, size, a) {
  const lin = ([at5, perStep]) => Math.max(a.floor, at5 + perStep * (n - 5))
  const body = lin(a.linear.body)
  const q = a.Q[0] + a.Q[1] * (n - 5)
  return {
    display: Math.round(body * q ** 3), heading: Math.round(body * q ** 2), subhead: Math.round(body * q),
    sectionKicker: Math.round(body * a.kicker), title: body + a.titleBump[size], body,
    control: lin(a.linear.control), fieldLabel: lin(a.linear.fieldLabel),
    smallControl: lin(a.linear.smallControl), groupKicker: lin(a.linear.groupKicker),
  }
}

/**
 * The tokens foundations.gen.css declares on one element, in px (the bare numbers n and m excepted), at a tier,
 * scale, size and density. It mirrors the derived block term for term; foundations.test.ts holds it to the repo's
 * scale.mjs resolve() on every cell, the glyph box and slot aside. The radii are the preset's amounts (radiusAmounts(),
 * `a.radiusPreset`, balanced by default): the container family A x its margin, the control family A x h/2. `surface` is the control anatomy of
 * resolveControlSurface(): the glyph is the skill's n + 6 artwork in the square 3n glyph slot (T-0374), emitted as
 * `glyphBox` and `glyphSlot`. Density (T-0374 step 4, the vendored DENSITIES; absent means regular) moves the control
 * margin (q - 2)n/4, emitted as `controlMargin`, so the height 3n + 2 margin runs from 3n at tight to 5n at loose,
 * and m. Values may be fractional px; checkEmitted() holds them finite and monotonic in n.
 */
export function resolve(tier = ROOT_REGISTER.tier, scale = ROOT_REGISTER.scale, size = 'md', density = 'regular', a = anchors()) {
  const [n0, ta, k, g] = CFG.tiers[tier]
  const s = STEP[scale]
  const z = STEP[size]
  const n = n0 + ta * s + k * z + g * s * z
  const c = Math.ceil(n / 4)
  const m = containerUnit(n, density)
  const slot = n * a.slotPerN
  const controlMargin = n * marginPerNAt(density, a)
  const height = slot + 2 * controlMargin
  const iconBox = n * a.iconPerN
  const glyphBox = n + 6
  const A = radiusAmounts(a.radiusPreset, a)
  const levels = Object.fromEntries(roomyLevels(a).map(([token, margin, gutter]) => [token, { margin: m * margin, gutter: m * gutter, radius: A.container * m * margin }]))
  return {
    n, m, c, height, controlMargin, inset: n, labelInset: n - c, radius: A.container * n, controlRadius: A.control * height / 2, iconBox,
    glyphBox, glyphSlot: slot, glyphStroke: Math.max(1.5, c / 2), checkboxRadius: Math.ceil(n / 2),
    surface: { slot, margin: controlMargin, height, icon: iconBox, iconInset: (slot - iconBox) / 2, glyph: glyphBox, glyphInset: (slot - glyphBox) / 2 },
    type: typeAt(n, size, a),
    chip: { margin: c, gutter: c, radius: A.control * (n + c) },
    group: { margin: n + c, gutter: c, radius: A.container * (n + c) },
    ...levels,
  }
}

/**
 * The guard on the anchors (the refuse-to-emit rule beside the repo's check()): every anchor finite, the heading
 * ratio and the linear roles never falling as n grows, the type order and the floor held on the whole ladder, the
 * title bump rising with size, the icon inside its slot, the margin reference and role percentages in range, the
 * roomy levels nesting, the widget margin outside the group margin at every density (widgetOverGroup()), and the
 * radius presets in range with every radius at most half its box (radiusFailures()).
 * Returns the failures; never throws (a malformed anchor set is an A1 failure).
 */
export function checkAnchors(a = anchors()) {
  try {
    return [...anchorFailures(a), ...widgetOverGroup(a), ...radiusFailures(a)]
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
  // The legacy check() validates its own rows only, so the vendored rows the sheet emits take M1 and M2 here: every
  // cell's n an integer on the ladder, and n growing along size and along scale in every tier.
  for (const [tier, [n0, ta, k, g]] of Object.entries(CFG.tiers)) {
    const rung = (s, z) => n0 + ta * s + k * z + g * s * z
    const ix = Object.values(STEP)
    for (const s of ix) for (const z of ix) {
      const n = rung(s, z)
      if (!Number.isInteger(n) || n < lo || n > hi) bad.push(`M1 ${tier} ${s}/${z}: n ${n} is not an integer on the ladder ${lo} to ${hi}`)
      if (z > ix[0] && !(n > rung(s, z - 1))) bad.push(`M2 ${tier} ${s}/${z}: n does not grow along size`)
      if (s > ix[0] && !(n > rung(s - 1, z))) bad.push(`M2 ${tier} ${s}/${z}: n does not grow along scale`)
    }
  }
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

/**
 * The widget margin 2m sits outside the group margin n + c at every density on the whole ladder (T-0374 step 4): the
 * floor in containerUnit() holds it at tight, where nq/4 alone is n/2 and the widget margin falls to n. `unit` is the
 * container unit under test; the default is the one resolve() uses. Returns the failures.
 */
export function widgetOverGroup(a = anchors(), unit = containerUnit) {
  const bad = []
  const [, widgetMargin] = roomyLevels(a)[0]
  const [lo, hi] = LEGACY_CFG.ladder
  for (const density of Object.keys(DENSITIES)) for (let n = lo; n <= hi; n++) {
    const widget = unit(n, density) * widgetMargin
    const group = n + Math.ceil(n / 4)
    if (!(widget > group)) bad.push(`A6 n ${n} ${density}: the widget margin ${widget} does not exceed the group margin ${group}`)
  }
  return bad
}

/**
 * The radius guard (T-0374 step 6): every preset amount within 0 to 100, and at every preset on every cell every
 * radius at most half its box, the skill's physical cap (no tolerance, no clamping): a control at most h/2, a chip
 * at most n + c (h/2 of the 2n + 2c chip), the checkbox at most n (its 2n box), and the surface and each level at most
 * its margin (the narrowest box a margin pads on both sides is twice it). Returns the failures.
 */
export function radiusFailures(a = anchors()) {
  const bad = []
  for (const [preset, pct] of Object.entries(a.radiusPresets)) {
    if (!(Number.isFinite(pct) && pct >= 0 && pct <= 100)) bad.push(`A7 radius preset ${preset} ${pct}% is outside 0 to 100`)
  }
  if (bad.length) return bad
  for (const preset of RADIUS_PRESETS) for (const [t, s, z, d] of CELLS()) {
    const r = resolve(t, s, z, d, { ...a, radiusPreset: preset })
    const caps = [
      ['control', r.controlRadius, r.height / 2], ['chip', r.chip.radius, r.n + r.c], ['checkbox', r.checkboxRadius, r.n],
      ['surface', r.radius, r.inset], ...['group', 'widget', 'card', 'layout'].map((l) => [l, r[l].radius, r[l].margin]),
    ]
    for (const [name, radius, cap] of caps) if (!(radius <= cap)) bad.push(`A7 ${preset} ${t}/${s}/${z} ${d}: ${name} radius ${radius} exceeds half its box ${cap}`)
  }
  return bad
}

/** The steps of each axis checkEmitted() walks: every tier, scale, size and density the sheet can declare. */
const CELLS = () => Object.keys(CFG.tiers).flatMap((t) => Object.keys(STEP).flatMap((s) => Object.keys(STEP).flatMap((z) =>
  Object.keys(DENSITIES).map((d) => [t, s, z, d]))))

/** Every numeric field of a resolve() result as [key, value], nested objects flattened (`type title`, `widget margin`). */
const fieldsOf = (r) => Object.entries(r).flatMap(([name, v]) =>
  typeof v === 'object' ? Object.entries(v).map(([k, x]) => [`${name} ${k}`, x]) : [[name, v]])

/**
 * The emit-time gate (T-0373, relaxed by Kim's 2026-10-19 ruling in T-0374: fractional px ship), on the n-only
 * quantities of the frozen resolver's M14 rule: at each density, with the cells sorted by n, every field of resolve()
 * is finite and never falls as n grows. `type title` is checked finite only: it is the one size-bumped value (body +
 * titleBump[size]), so a smaller-size cell at a higher n has a smaller title (widget lg/lg is n 8 with title 17,
 * content md/sm n 9 with title 16). Returns the failures.
 */
export function checkEmitted(a = anchors()) {
  const bad = []
  for (const density of Object.keys(DENSITIES)) {
    const cells = CELLS().filter(([, , , d]) => d === density).map(([t, s, z, d]) => [`${t}/${s}/${z} ${d}`, resolve(t, s, z, d, a)])
    cells.sort(([, x], [, y]) => x.n - y.n)
    let was = null
    for (const [at, r] of cells) {
      const fields = fieldsOf(r)
      for (const [key, x] of fields) if (!Number.isFinite(x)) bad.push(`E1 ${at}: ${key} ${x} is not finite`)
      if (was) {
        const before = Object.fromEntries(fieldsOf(was[1]))
        for (const [key, x] of fields) {
          if (key !== 'type title' && x < before[key]) bad.push(`E1 ${was[0]} -> ${at}: ${key} falls ${before[key]} -> ${x} as n grows`)
        }
      }
      was = [at, r]
    }
  }
  return bad
}
