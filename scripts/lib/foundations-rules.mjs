// foundations-rules.mjs: the one definition of "still on the old foundations" (ADR-0245), shared by
// scripts/foundations-census.mjs (counts and gates it) and scripts/foundations-codemod.mjs (rewrites the
// mechanical part of it), so the two can never disagree about what a violation is.
//
// Four rules, each a list of findings per file:
//   tokens  a read of a hand-tabled ramp token (`var(--md-sys-height-md)` and kin, `--md-sys-widget-inset`)
//           that is not already the fallback of a derived token (`var(--md-sys-height, var(--md-sys-height-md))`
//           is the dark-launch form, clause 10a, and passes)
//   px      a px literal in a geometry declaration of a stylesheet, other than 0 and the 1px hairline, and
//           other than inside a derived token's fallback (clause 9's sibling rule, report shape)
//   glyph   ui-icon's `glyph` prop, renamed `symbol` (clause 4): the attribute, the object key, the property,
//           the attribute calls and the descriptor row
//   axes    the retired `[scale]` and `[density]` attributes (clause 2): selectors, markup and attribute calls
// Comments are blanked before matching in code and stylesheets (offsets kept), so prose about an old name is
// not a use of it.

/** Hand-tabled ramp token -> the derived token that replaces it at the element's own n (clauses 3, 4, 10a). */
export const LEGACY_TO_DERIVED = [
  [/--md-sys-height-(?:sm|md|lg)(?![\w-])/, '--md-sys-height'],
  [/--md-sys-font-(?:sm|md|lg)(?![\w-])/, '--md-sys-type-control'],
  [/--md-sys-icon-(?:sm|md|lg)(?![\w-])/, '--md-sys-icon-box'],
  [/--md-sys-gap-(?:sm|md|lg)(?![\w-])/, '--md-sys-inset'],
  [/--md-sys-compact-(?:sm|md|lg)(?![\w-])/, '--md-sys-icon-box'],
  [/--md-sys-widget-inset(?![\w-])/, '--md-sys-c'],
]

/** Every derived token foundations.gen.css declares (generate-foundations.mjs). */
export const DERIVED = new Set([
  'n', 'c', 'height', 'inset', 'radius', 'icon-box', 'glyph-box', 'glyph-stroke', 'corner-shape',
  ...['display', 'heading', 'subhead', 'section-kicker', 'title', 'body', 'control', 'field-label', 'group-kicker'].map((r) => `type-${r}`),
  ...['group', 'widget', 'card', 'layout'].flatMap((l) => ['margin', 'gutter', 'radius'].map((q) => `${l}-${q}`)),
].map((name) => `--md-sys-${name}`))

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
  return tail !== null && DERIVED.has(tail[1])
}

function tokensFindings(code) {
  const out = []
  for (const m of code.matchAll(LEGACY_READ)) if (!isWrapped(code, m.index)) out.push({ index: m.index, text: m[1] })
  return out
}

const GEOMETRY_PROP =
  /^(?:(?:min-|max-)?(?:width|height|inline-size|block-size)|padding(?:-[\w-]+)?|margin(?:-[\w-]+)?|gap|row-gap|column-gap|border(?:-[\w-]+)?-radius|inset(?:-[\w-]+)?|top|right|bottom|left|font-size|line-height|flex-basis|--ui-[\w-]*(?:height|size|pad|padding|gap|radius|inset|width|margin|offset|box))$/
const PX = /(?<![\w.-])(\d*\.?\d+)px\b/g

/** A declaration value with every derived token (and its fallback) cut out. */
function withoutDerived(value) {
  let out = value
  for (let i = out.indexOf('var('); i !== -1; i = out.indexOf('var(', i + 1)) {
    const name = /^var\(\s*(--md-sys-[\w-]+)/.exec(out.slice(i))
    if (!name || !DERIVED.has(name[1])) continue
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
const AXES_FORMS = {
  css: [AXES_SELECTOR],
  code: [AXES_VALUED_SELECTOR, AXES_MARKUP, AXES_CALL],
  html: [AXES_VALUED_SELECTOR, AXES_MARKUP, AXES_CALL],
  md: [AXES_MARKUP],
}

const matchAllOf = (src, forms) =>
  forms.flatMap((re) => [...src.matchAll(re)].map((m) => ({ index: m.index, text: m[0].trim() }))).sort((a, b) => a.index - b.index)

/** The file kinds each rule reads. */
export const kindOf = (path) =>
  /\.css$/.test(path) ? 'css' : /\.(?:ts|tsx|mts|js|mjs)$/.test(path) ? 'code' : /\.html$/.test(path) ? 'html' : /\.md$/.test(path) ? 'md' : null

// A deliberate use of a deprecated alias (ui-icon's `glyph`, or ui-theme-provider's `scale` / `density` carriers
// that the bridge maps for one release: the alias itself, its descriptor row and the proofs that it still
// resolves, ADR-0245 cl.10d) carries this marker in a comment on its own line, or in a descriptor, anywhere in its
// attribute entry. The gate then needs no allowlist line for it; the marker retires with the aliases at W7.
export const ALIAS_MARKER = 'foundations-alias'

/** True when the glyph finding at `index` is a marked deliberate use of the deprecated alias. */
export function isMarkedAlias(src, index, kind) {
  const lineStart = src.lastIndexOf('\n', index - 1) + 1
  let end = src.indexOf('\n', index)
  if (kind === 'md') {
    const next = src.slice(index).search(/\n\s*- name:|\n\S/)
    end = next === -1 ? src.length : index + next
  }
  return src.slice(lineStart, end === -1 ? src.length : end).includes(ALIAS_MARKER)
}

/** Every finding in one file's source, by rule. */
export function findingsIn(path, src) {
  const kind = kindOf(path)
  const res = { tokens: [], px: [], glyph: [], axes: [] }
  if (kind === null) return res
  const code = kind === 'css' ? blankComments(src, { lineComments: false }) : kind === 'code' ? blankComments(src) : src
  if (kind === 'css' || kind === 'code' || kind === 'html') res.tokens = tokensFindings(code)
  if (kind === 'css') res.px = pxFindings(code)
  res.glyph = (kind === 'md' ? glyphMdFindings(code) : glyphFindings(code)).filter((f) => !isMarkedAlias(src, f.index, kind))
  res.axes = matchAllOf(code, AXES_FORMS[kind]).filter((f) => !isMarkedAlias(src, f.index, kind))
  return res
}

/** 1-based line of `index` in `src`. */
export const lineOf = (src, index) => src.slice(0, index).split('\n').length
