// foundations-rules.mjs: the one definition of "still on the old foundations" (ADR-0245), shared by
// scripts/foundations-census.mjs (counts and gates it) and scripts/foundations-codemod.mjs (rewrites the
// mechanical part of it), so the two can never disagree about what a violation is.
//
// Four rules, each a list of findings per file:
//   tokens  a read of a hand-tabled ramp token (`var(--md-sys-height-md)` and kin, `--md-sys-widget-inset`)
//           that is not already the fallback of a derived token (`var(--md-sys-height, var(--md-sys-height-md))`
//           is the dark-launch form, clause 10a, and passes), and any read of a type label renamed to the skill's
//           kicker (`var(--md-sys-type-group-label)`, T-0373), which the codemod renames
//   px      a px literal in a geometry declaration of a stylesheet, other than 0 and the 1px hairline, and
//           other than inside a derived token's fallback (clause 9's sibling rule, report shape)
//   glyph   ui-icon's `glyph` prop, renamed `symbol` (clause 4): the attribute, the object key, the property,
//           the attribute calls and the descriptor row
//   axes    the retired `[scale]` and `[density]` attributes (clause 2): selectors, markup, attribute calls and an
//           attribute-name union type that feeds a call through a variable (T-0169)
// Comments are blanked before matching in code and stylesheets (offsets kept), so prose about an old name is
// not a use of it.

import { resolve } from '../../packages/agent-ui/shared/src/tokens/scale.mjs'

/** Hand-tabled ramp token -> the derived token that replaces it at the element's own n (clauses 3, 4, 10a). */
export const LEGACY_TO_DERIVED = [
  [/--md-sys-height-(?:sm|md|lg)(?![\w-])/, '--md-sys-height'],
  [/--md-sys-font-(?:sm|md|lg)(?![\w-])/, '--md-sys-type-control'],
  [/--md-sys-icon-(?:sm|md|lg)(?![\w-])/, '--md-sys-icon-box'],
  [/--md-sys-gap-(?:sm|md|lg)(?![\w-])/, '--md-sys-inset'],
  [/--md-sys-compact-(?:sm|md|lg)(?![\w-])/, '--md-sys-icon-box'],
  [/--md-sys-widget-inset(?![\w-])/, '--md-sys-c'],
]

/** Every derived token foundations.gen.css declares (generate-foundations.mjs); foundations.test.ts fails when they drift. */
export const DERIVED = new Set([
  'n', 'm', 'c', 'control-margin', 'control-gutter', 'label-compensation', 'height', 'inset', 'label-inset', 'radius', 'control-radius', 'icon-box', 'glyph-box', 'glyph-slot', 'glyph-stroke', 'corner-shape',
  'checkbox-radius',
  ...['display', 'heading', 'subhead', 'section-kicker', 'title', 'body', 'control', 'field-label', 'small-control', 'group-kicker', 'floor'].map((r) => `type-${r}`),
  ...['chip', 'group', 'widget', 'card', 'layout'].flatMap((l) => ['margin', 'gutter', 'radius'].map((q) => `${l}-${q}`)),
].map((name) => `--md-sys-${name}`))

/** The type labels the skill's kicker names replaced (T-0373): old name -> the derived token foundations.gen.css
 *  aliases it to until W7. No consumer reads an old name: the tokens rule finds a new read and the codemod renames it. */
export const RENAMED = Object.freeze({
  '--md-sys-type-section-label': '--md-sys-type-section-kicker',
  '--md-sys-type-group-label': '--md-sys-type-group-kicker',
})

/** True when a fallback sits inside a derived token, or inside an old label whose own read is already a finding (its
 *  rename then clears the fallback too, so one fix is one finding). */
const wrapsFallback = (name) => DERIVED.has(name) || Object.hasOwn(RENAMED, name)

/** The glyph box of a register: the skill's n + 6 artwork, centred in its square 3n glyph slot (T-0374, Kim's
 *  2026-10-19 ruling). It is at least 10 on the whole ladder n 4 to 24, so the retired 8px floor (ADR-0245
 *  Amendment 7) never binds. The browser tests read the glyph box through glyphBox(), never the frozen scale.mjs
 *  resolve().glyph, the retired formula; the render lint reads it here too. */
export const glyphBox = (r) => r.n + 6

/** The page root register (ADR-0245 Amendment 8): the tier and scale `:root` takes at the cut. The one definition:
 *  generate-foundations.mjs emits it as its ROOT_INPUTS, and every lint and test that means "the root" reads it here
 *  (browser-safe, so the browser tests share it), so the next root change touches this line and a regenerate. */
export const ROOT_REGISTER = Object.freeze({ tier: 'product', scale: 'md' })

/** T-0170: a dogfood lint allowlist reason names its owner, a ticket (T-NNNN), an ADR (ADR-NNNN) or a ruling.
 *  Both dogfood gates (dogfood-compose.mjs and the render lint) read it, so an entry with no owner fails either. */
export const OWNER_REF = /\bT-\d{4}\b|\bADR-\d{4}\b|\bruling\b/i
export const hasOwner = (why) => typeof why === 'string' && !why.startsWith('TODO') && OWNER_REF.test(why)

/** `--md-sys-scale-s` per scale step, as the generator declares it and the root readers decode it. */
export const STEP = Object.freeze({ sm: -1, md: 0, lg: 1 })

/** scale.mjs resolve() at the root register, at `size` and `density`. */
export const rootResolve = (size = 'md', density = 'default') => resolve(ROOT_REGISTER.tier, ROOT_REGISTER.scale, size, density)

/** Clause 2: today's `[scale]` value -> the tier and scale it becomes. */
export const SCALE_TO_TIER = {
  'ui-sm': ['widget', 'sm'],
  'ui-md': ['product', 'sm'],
  'ui-lg': ['product', 'md'],
  'content-sm': ['content', 'sm'],
  'content-md': ['content', 'md'],
  'content-lg': ['content', 'lg'],
}

export const RULES = ['tokens', 'px', 'glyph', 'axes']

const LEGACY_READ = /var\(\s*(--md-sys-(?:height|font|icon|gap|compact)-(?:sm|md|lg)|--md-sys-widget-inset)(?![\w-])/g
const DERIVED_FALLBACK_TAIL = /var\(\s*(--md-sys-[\w-]+)\s*,\s*$/

/** Blank `/* … *\/` blocks, and in code `// …` line comments, keeping every offset. */
export function blankComments(src, { lineComments = true } = {}) {
  const blank = (m) => m.replace(/[^\n]/g, ' ')
  let out = src.replace(/\/\*[\s\S]*?\*\//g, blank)
  if (lineComments) out = out.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, pre) => pre + blank(m.slice(pre.length)))
  return out
}

/** The index just past the `)` that closes the `(` at `open`, or -1. */
export function closeParen(src, open) {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')' && --depth === 0) return i + 1
  }
  return -1
}

/** True when the legacy read at `index` already sits as the fallback of a derived token. */
export function isWrapped(src, index) {
  const tail = DERIVED_FALLBACK_TAIL.exec(src.slice(Math.max(0, index - 80), index))
  return tail !== null && wrapsFallback(tail[1])
}

// The finding sits on the old name itself (not on `var(`), so the codemod's rename replaces exactly it.
const RENAMED_READ = /(?<=var\(\s*)--md-sys-type-(?:section|group)-label(?![\w-])/g

function tokensFindings(code) {
  const out = []
  for (const m of code.matchAll(LEGACY_READ)) if (!isWrapped(code, m.index)) out.push({ index: m.index, text: m[1] })
  for (const m of code.matchAll(RENAMED_READ)) out.push({ index: m.index, text: m[0] })
  return out.sort((a, b) => a.index - b.index)
}

const GEOMETRY_PROP =
  /^(?:(?:min-|max-)?(?:width|height|inline-size|block-size)|padding(?:-[\w-]+)?|margin(?:-[\w-]+)?|gap|row-gap|column-gap|border(?:-[\w-]+)?-radius|inset(?:-[\w-]+)?|top|right|bottom|left|font-size|line-height|flex-basis|--ui-[\w-]*(?:height|size|pad|padding|gap|radius|inset|width|margin|offset|box))$/
const PX = /(?<![\w.-])(\d*\.?\d+)px\b/g

/** A declaration value with every derived token (and its fallback) cut out. */
function withoutDerived(value) {
  let out = value
  for (let i = out.indexOf('var('); i !== -1; i = out.indexOf('var(', i + 1)) {
    const name = /^var\(\s*(--md-sys-[\w-]+)/.exec(out.slice(i))
    if (!name || !wrapsFallback(name[1])) continue
    const end = closeParen(out, i + 3)
    if (end === -1) break
    out = out.slice(0, i) + ' '.repeat(end - i) + out.slice(end)
  }
  return out
}

function pxFindings(css) {
  const out = []
  const decl = /([{;]\s*)(--[\w-]+|[a-z-]+)\s*:([^;{}]*)/g
  for (const m of css.matchAll(decl)) {
    const prop = m[2]
    if (!GEOMETRY_PROP.test(prop)) continue
    const valueStart = m.index + m[1].length + m[0].slice(m[1].length).indexOf(':') + 1
    for (const px of withoutDerived(m[3]).matchAll(PX)) {
      const n = Number(px[1])
      if (n === 0 || n === 1) continue
      out.push({ index: valueStart + px.index, text: `${prop}: ${px[0]}` })
    }
  }
  return out
}

const GLYPH_FORMS = [
  /(?<![\w.$-])glyph=["']/g, // markup attribute
  /\b(?:set|get|has|remove|toggle)Attribute\(\s*['"]glyph['"]/g, // attribute calls
  /\[glyph(?=[\]=~|^$*])/g, // attribute selector
]
// `glyph` is also an ordinary field name (a quiz state's text mark, a part handle, scale.mjs's glyph box), so
// the key and property forms count only when aimed at ui-icon: the nearest element name before them is
// ui-icon, or the receiver's own name says icon (`this.#icon.glyph`).
const GLYPH_KEY = /(?<![\w.$'"-])glyph\??:(?!:)/g // `{ glyph: 'x' }`, `{ glyph?: unknown }`
const GLYPH_PROPERTY = /([\w#$]+)\??\.glyph(?![\w-])/g // `icon.glyph = 'x'`, `el.glyph`

/** The element a use at `index` is aimed at: the nearest `ui-icon` / `ui-glyph` name before it. */
export function nearestElement(src, index, window = 160) {
  const hits = [...src.slice(Math.max(0, index - window), index).matchAll(/ui-(icon|glyph)\b/g)]
  return hits.at(-1)?.[1] ?? null
}

function glyphFindings(code) {
  const out = matchAllOf(code, GLYPH_FORMS)
  for (const m of code.matchAll(GLYPH_KEY)) if (nearestElement(code, m.index) === 'icon') out.push({ index: m.index, text: m[0] })
  for (const m of code.matchAll(GLYPH_PROPERTY)) {
    if (/icon/i.test(m[1]) || nearestElement(code, m.index, 400) === 'icon') out.push({ index: m.index, text: m[0] })
  }
  return out.sort((a, b) => a.index - b.index)
}

/** A descriptor's `- name: glyph` counts only inside its `attributes:` block (a part may be named glyph). */
function glyphMdFindings(md) {
  const out = matchAllOf(md, [/(?<![\w.$-])glyph=["']/g])
  const block = /^attributes:[^\n]*\n((?:[ \t]+[^\n]*\n|[ \t]*\n)*)/m.exec(md)
  if (block) {
    const start = block.index + block[0].length - block[1].length
    for (const m of block[1].matchAll(/^\s*- name: glyph\s*$/gm)) out.push({ index: start + m.index, text: '- name: glyph' })
  }
  return out.sort((a, b) => a.index - b.index)
}

// A bare `[scale]` in a stylesheet is a selector; in code or prose it is usually a test title or a comment
// naming the axis, so outside stylesheets only a selector with a value counts.
const AXES_SELECTOR = /\[(?:scale|density)(?=[\]=~|^$*])/g
const AXES_VALUED_SELECTOR = /\[(?:scale|density)(?=[~|^$*]?=)/g
const AXES_MARKUP = /(?<![\w.$[-])(?:scale|density)=["']/g
const AXES_CALL = /\b(?:set|get|has|remove|toggle)Attribute\(\s*['"](?:scale|density)['"]/g
// T-0169: an attribute name passed through a variable typed as a union of the retired names
// (`attr: 'scale' | 'density'`, then `setAttribute(attr, v)`), which the call form above cannot see.
const AXES_UNION = /['"](?:scale|density)['"](?=\s*\|)|(?<=\|\s*)['"](?:scale|density)['"]/g
const AXES_FORMS = {
  css: [AXES_SELECTOR],
  code: [AXES_VALUED_SELECTOR, AXES_MARKUP, AXES_CALL, AXES_UNION],
  html: [AXES_VALUED_SELECTOR, AXES_MARKUP, AXES_CALL],
  md: [AXES_MARKUP],
}

const matchAllOf = (src, forms) =>
  forms.flatMap((re) => [...src.matchAll(re)].map((m) => ({ index: m.index, text: m[0].trim() }))).sort((a, b) => a.index - b.index)

/** The file kinds each rule reads. */
export const kindOf = (path) =>
  /\.css$/.test(path) ? 'css' : /\.(?:ts|tsx|mts|js|mjs)$/.test(path) ? 'code' : /\.html$/.test(path) ? 'html' : /\.md$/.test(path) ? 'md' : null

/** Every finding in one file's source, by rule. */
export function findingsIn(path, src) {
  const kind = kindOf(path)
  const res = { tokens: [], px: [], glyph: [], axes: [] }
  if (kind === null) return res
  const code = kind === 'css' ? blankComments(src, { lineComments: false }) : kind === 'code' ? blankComments(src) : src
  if (kind === 'css' || kind === 'code' || kind === 'html') res.tokens = tokensFindings(code)
  if (kind === 'css') res.px = pxFindings(code)
  res.glyph = kind === 'md' ? glyphMdFindings(code) : glyphFindings(code)
  res.axes = matchAllOf(code, AXES_FORMS[kind])
  return res
}

/** 1-based line of `index` in `src`. */
export const lineOf = (src, index) => src.slice(0, index).split('\n').length
