// foundations-model.mjs: the inputs scripts/generate-foundations.mjs emits, and resolve(), the same tokens as px
// (T-0372). Browser-safe, so a browser test can read it the way it reads foundations-rules.mjs.
//
// Two resolvers feed the sheets. The skill's current resolver is vendored untouched under
// packages/agent-ui/shared/src/tokens/vendor/mathematical-design-system/ and read at regular density: it keeps
// floats, and the generator rounds only at CSS emission. The repo's own `scale.mjs` (the skill's former revision,
// sha 3c319761, frozen) supplies every input the current resolver cannot reproduce byte for byte (LEGACY_PATH) and
// `check()`. anchors() reads the vendored CFG on every call, so a change to it reaches the next render.

import { CFG as LEGACY_CFG } from '../../packages/agent-ui/shared/src/tokens/scale.mjs'
import { CFG, resolveGeometry } from '../../packages/agent-ui/shared/src/tokens/vendor/mathematical-design-system/scale.mjs'
import { GLYPH_FLOOR, ROOT_REGISTER, STEP } from './foundations-rules.mjs'

/**
 * What stays on the repo's scale.mjs, because the current resolver gives a different value (T-0374 moves each one,
 * behind an approved mockup): the content and brand tier rows (current 11/3 and 15/4 against 10/2 and 14/2; all four
 * rows stay so `check()` validates the rows it emits), the density axis and m (current: five multipliers of n), the
 * field label (current 10 at n 5) and group label (current groupKicker 10 + 1 per step, against 9 + 0.5), the
 * roomy-level gutters (current: role percentages of one margin reference), and every token the current resolver has
 * no field for (inset, label inset, radii, glyph box, chip, checkbox and group levels).
 */
export const LEGACY_PATH = {
  tiers: LEGACY_CFG.tiers,
  density: LEGACY_CFG.density,
  levels: LEGACY_CFG.levels,
  linear: { fieldLabel: LEGACY_CFG.linear.fieldLabel, groupLabel: LEGACY_CFG.linear.groupLabel },
}

/** The roomy level token -> the current resolver's container: the tokens keep the names widget, card and layout. */
const CONTAINER = { widget: 'tile', card: 'card', layout: 'section' }
/** The legacy roomy level -> its token name: the skill renamed `layout` to `page`; the tokens keep `layout`. */
const LEVEL_TOKEN = { widget: 'widget', card: 'card', page: 'layout' }

/**
 * The anchors the generator reads from the current resolver, at regular density at the root register, as
 * coefficients of n. The container factors assume d == m: the current resolver's d is n at regular density, and the
 * legacy m is n at default density on the whole ladder, so a container margin over n is its multiple of m.
 */
export function anchors() {
  const g = resolveGeometry(ROOT_REGISTER.tier, ROOT_REGISTER.scale, 'md', 'regular')
  const perN = (x) => x / g.n
  return {
    heightPerN: perN(g.surface.height),
    iconPerN: perN(g.surface.icon),
    containers: Object.fromEntries(Object.entries(CONTAINER).map(([token, key]) => [token, perN(g.containers[key].margin)])),
    Q: [...CFG.Q],
    floor: CFG.floor,
    titleBump: { ...CFG.titleBump },
    kicker: CFG.kicker,
    linear: { body: [...CFG.linear.body], control: [...CFG.linear.control], ...LEGACY_PATH.linear },
  }
}

/**
 * The roomy levels as [token, margin, gutter] multiples of m. The margin (and the radius, equal to it) is the
 * anchor's container factor; the gutter stays on the legacy path, walked off LEGACY_PATH.levels the way the repo's
 * scale.mjs `at()` walks them: the child's span, where the control counts as m. Today: widget 2 / 1, card 3 / 2,
 * layout 4 / 3; the reserved levels (tray, lane, shell) have no token.
 */
export function roomyLevels(a = anchors()) {
  const span = { control: 1 }
  const out = []
  for (const [level, [wrap, child]] of Object.entries(LEGACY_PATH.levels)) {
    if (wrap !== 'roomy') continue
    span[level] = span[child] + 1
    const token = LEVEL_TOKEN[level]
    out.push([token, a.containers[token], span[child]])
  }
  return out
}

const ROLES = ['display', 'heading', 'subhead', 'sectionLabel', 'body', 'control', 'fieldLabel', 'groupLabel']

/** The type roles at n, as the sheet computes them (CSS round(nearest) is Math.round for these positive sizes). */
function typeAt(n, size, a) {
  const lin = ([at5, perStep]) => Math.max(a.floor, at5 + perStep * (n - 5))
  const body = lin(a.linear.body)
  const q = a.Q[0] + a.Q[1] * (n - 5)
  return {
    display: Math.round(body * q ** 3), heading: Math.round(body * q ** 2), subhead: Math.round(body * q),
    sectionLabel: Math.round(body * a.kicker), title: body + a.titleBump[size], body,
    control: lin(a.linear.control), fieldLabel: lin(a.linear.fieldLabel), groupLabel: lin(a.linear.groupLabel),
  }
}

/**
 * The tokens foundations.gen.css declares on one element, in px (the bare numbers n and m excepted), at a tier,
 * scale, size and density. It mirrors the derived block term for term; foundations.test.ts holds it to the repo's
 * scale.mjs resolve() on every cell. Consumers move to it in T-0373.
 */
export function resolve(tier = ROOT_REGISTER.tier, scale = ROOT_REGISTER.scale, size = 'md', density = 'default', a = anchors()) {
  const [n0, ta, k, g] = LEGACY_PATH.tiers[tier]
  const s = STEP[scale]
  const z = STEP[size]
  const n = n0 + ta * s + k * z + g * s * z
  const c = Math.ceil(n / 4)
  const m = Math.max(n + ta * LEGACY_PATH.density[density], Math.floor((n + c) / 2) + 1)
  const height = n * a.heightPerN
  const levels = Object.fromEntries(roomyLevels(a).map(([token, margin, gutter]) => [token, { margin: m * margin, gutter: m * gutter, radius: m * margin }]))
  return {
    n, m, c, height, inset: n, labelInset: n - c, radius: n, controlRadius: height / 2, iconBox: n * a.iconPerN,
    glyphBox: Math.max(GLYPH_FLOOR, 2 * n - 2 * c), glyphStroke: Math.max(1.5, c / 2), checkboxRadius: Math.ceil(n / 2),
    type: typeAt(n, size, a),
    chip: { margin: c, gutter: c, radius: n + c },
    group: { margin: n + c, gutter: c, radius: n + c },
    ...levels,
  }
}

/**
 * The guard on the anchors (the refuse-to-emit rule beside the repo's check()): every anchor finite, the heading
 * ratio and the linear roles never falling as n grows, the type order and the floor held on the whole ladder, the
 * title bump rising with size, the icon inside the control and the roomy levels nesting. Returns the failures.
 */
export function checkAnchors(a = anchors()) {
  const bad = []
  const nums = [a.heightPerN, a.iconPerN, ...Object.values(a.containers), ...a.Q, a.floor, a.kicker, ...Object.values(a.titleBump), ...Object.values(a.linear).flat()]
  if (!nums.every(Number.isFinite)) return ['A1 an anchor is not finite']
  if (!(a.Q[0] > 1) || a.Q[1] < 0) bad.push(`A2 heading ratio ${a.Q[0]} + ${a.Q[1]} per step must be above 1 and never fall`)
  for (const [role, [, perStep]] of Object.entries(a.linear)) if (perStep < 0) bad.push(`A2 ${role} falls as n grows`)
  if (!(a.kicker >= 1)) bad.push(`A3 section kicker ratio ${a.kicker} is below 1`)
  if (!(a.titleBump.sm >= 0 && a.titleBump.sm <= a.titleBump.md && a.titleBump.md <= a.titleBump.lg)) bad.push('A3 title bump does not rise with size')
  if (!(a.iconPerN > 0 && a.iconPerN < a.heightPerN)) bad.push(`A4 icon ${a.iconPerN}n does not fit the ${a.heightPerN}n control`)
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
