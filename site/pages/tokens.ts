// site/pages/tokens.ts — the DERIVED token reference: every `--md-sys-color-{family}-{role}` semantic role
// (tokens.css) as a live ui-swatch table, the numbered tonal-primitive steps as a live ui-ramp per family, and
// the five dimensional ladders (dimensions.css) as live ui-ladder lists. Nothing here is hand-typed: both
// sheets are pulled at build time via Vite's `?raw` (the frontmatter.ts / adr-index.ts convention) and parsed
// by the pure `site/lib/token-parse.ts` helpers — the SAME helpers `tokens-doc.test.ts` asserts against, so a
// token rename/add/remove flows to this page and its drift gate with zero edits here. Anti-vacuous by
// construction: every parser throws below if the sheet-scan comes back empty (the adr-index.ts precedent for a
// build-time glob that could silently resolve to nothing).
//
// Re-hosted onto the shipped token-surface primitives (ADR-0118, token-surfaces.lld.md §5 LLD-C12 — PRD-G3):
// color roles compose `ui-swatch` (a semantic role SET is not an ordered progression — roles-as-ramp was
// REJECTED, Kim 2026-07-10), the numbered tonal-primitive steps compose `ui-ramp` (the honest home for the
// genuinely ordered-series idiom, a NEW section this re-host adds), and the five dimensional tables compose
// `ui-ladder` (retitled "Dimensional ladders" — the F1 vocabulary rider, ADR-0118 cl.1: color=ramp /
// dimensions=ladder). The live swatches/ramps/ladders read the SAME custom properties `getComputedStyle` used
// to read back before this re-host — the `--var` lane (ui-swatch/ui-ramp) is the SAME live-resolution honesty,
// just routed through the shipped primitive instead of a hand-built `div`.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './tokens.css'
import { heading } from '../lib/doc-page.ts'
import { familiesOf, parseColorPrimitives, parseColorRoles, parseDimensionRamp, parseTypescale, type ColorRole } from '../lib/token-parse.ts'
import tokensCss from '../../packages/agent-ui/shared/src/tokens/tokens.css?raw'
import dimensionsCss from '../../packages/agent-ui/shared/src/tokens/dimensions.css?raw'

const ROLES = parseColorRoles(tokensCss)
if (ROLES.length === 0) {
  throw new Error('tokens.ts: parseColorRoles resolved 0 roles — tokens.css did not match the expected :root shape')
}
const FAMILIES = familiesOf(ROLES)

const PRIMITIVES = parseColorPrimitives(tokensCss)
if (Object.keys(PRIMITIVES).length === 0) {
  throw new Error('tokens.ts: parseColorPrimitives resolved 0 families — tokens.css did not match the expected :root shape')
}

// The F1 vocabulary rider (ADR-0118 cl.1): this dimensional-tier enumeration retitles from `DIMENSION_RAMPS`
// (color=ramp / dimensions=ladder now converges) — the PARSE helper `parseDimensionRamp` in token-parse.ts is
// NOT renamed (SPEC-R17: it stays site-local, and `tokens-doc.test.ts` calls it by that name unchanged).
const DIMENSION_LADDERS: readonly { readonly prefix: string; readonly label: string; readonly note: string }[] = [
  { prefix: 'md-sys-height', label: '--md-sys-height-*', note: 'The Control-class block-size (button · text-field · select · field) — the frame the h/2 centring law measures from.' },
  { prefix: 'md-sys-font', label: '--md-sys-font-*', note: 'The control-band glyph size, paired 1:1 with --md-sys-height-* (the square-centring law) — never the document type scale.' },
  { prefix: 'md-sys-icon', label: '--md-sys-icon-*', note: 'The fixed CONTENT-icon register (a field’s leading icon, a status glyph) — distinct from an inline affordance, which is sized = font.' },
  { prefix: 'md-sys-compact', label: '--md-sys-compact-*', note: 'The Indicator/Range widget-box ramp (checkbox · switch · radio · slider) — a separate size system from Control height.' },
  { prefix: 'md-sys-space', label: '--md-sys-space-*', note: 'Layout spacing BETWEEN components (gaps, padding, margin) — density-derived, never control geometry (geometry.md’s "not interchangeable" rule).' },
]
for (const { prefix } of DIMENSION_LADDERS) {
  if (parseDimensionRamp(dimensionsCss, prefix).length === 0) {
    throw new Error(`tokens.ts: parseDimensionRamp resolved 0 tiers for --${prefix}-* — dimensions.css did not match the expected shape`)
  }
}

// GH #728 — the type scale (the missing quarter of the token story): every complete
// `--md-sys-typescale-{role}-{size}` cell, joined from the sheet's two declaration homes. Anti-vacuous
// like every parser above.
const TYPESCALE = parseTypescale(dimensionsCss)
if (TYPESCALE.length === 0) {
  throw new Error('tokens.ts: parseTypescale resolved 0 rows — dimensions.css did not match the expected typescale shape')
}
const TYPESCALE_ROLES = [...new Set(TYPESCALE.map((r) => r.role))]

const { content } = mountPage({
  title: 'Token reference',
  intro:
    `${ROLES.length} colour roles across ${FAMILIES.length} families, the numbered tonal primitives, ` +
    `the five dimensional ladders, plus the ${TYPESCALE_ROLES.length}-role type scale — parsed live from ` +
    'the foundation sheets and rendered on the shipped token-surface primitives, not hand-copied. If this ' +
    'page and the shipped tokens ever disagree, the page is stale and its derivation is the bug.',
})

content.append(
  pageLead(
    'Every value below is read straight from @agent-ui/shared’s two foundation sheets: tokens.css (colour) ' +
      'and dimensions.css (geometry + spacing), rendered through ui-swatch/ui-ramp/ui-ladder (ADR-0118) — the ' +
      'SAME live resolution as before (each swatch carries its own color-scheme and reads the real custom ' +
      'property via the browser’s actual light-dark() resolution), now dogfooding the shipped primitives ' +
      'instead of bespoke display code. For the theming CONTRACT (how a page adopts these), see the theming ' +
      'guide; for the geometry LAW the dimensional ladders implement, see the sizing guide.',
  ),
)

// ── colour roles — a per-family ui-swatch table (roles STAY swatch tables; a semantic role set is not an
// ordered progression, so roles-as-ramp was rejected, Kim 2026-07-10) ──────────────────────────────────────
function swatchCell(role: ColorRole, scheme: 'light' | 'dark'): HTMLElement {
  const td = document.createElement('td')
  const el = document.createElement('ui-swatch')
  el.setAttribute('color', role.varName)
  el.setAttribute('label', role.role)
  el.setAttribute('scheme', scheme)
  td.append(el)
  return td
}

function roleRow(role: ColorRole): HTMLElement {
  const tr = document.createElement('tr')
  const nameCell = document.createElement('td')
  const code = document.createElement('code')
  code.textContent = role.varName
  nameCell.append(code)
  tr.append(nameCell, swatchCell(role, 'light'), swatchCell(role, 'dark'))
  return tr
}

content.append(heading(2, 'Colour roles'))
for (const family of FAMILIES) {
  const familyRoles = ROLES.filter((r) => r.family === family)
  const section = document.createElement('section')
  section.append(heading(3, family))
  const table = document.createElement('table')
  table.className = 'token-table'
  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  for (const label of ['Token', 'Light', 'Dark']) {
    const th = document.createElement('th')
    th.textContent = label
    headRow.append(th)
  }
  thead.append(headRow)
  const tbody = document.createElement('tbody')
  for (const role of familyRoles) tbody.append(roleRow(role))
  table.append(thead, tbody)
  section.append(table)
  content.append(section)
}

// ── tonal primitives — the ramp dogfood (NEW section, Kim 2026-07-10): the numbered --md-sys-color-{family}-
// {N} base steps as one ui-ramp per family, the genuinely ordered series parseColorRoles deliberately excludes ─
content.append(heading(2, 'Tonal primitives'))
content.append(
  pageLead(
    'The numbered base steps behind each family’s semantic roles — a genuinely ORDERED progression (unlike ' +
      'the role set above), the honest home for the ramp idiom. Derived live via the additive ' +
      'parseColorPrimitives helper — the same sheet, a different filter.',
  ),
)
for (const family of FAMILIES) {
  const steps = PRIMITIVES[family] ?? []
  if (steps.length === 0) continue // e.g. `focus` — a bare utility token with no numbered tonal ladder
  const section = document.createElement('section')
  section.append(heading(3, family))
  const ramp = document.createElement('ui-ramp')
  ramp.setAttribute('steps', JSON.stringify(steps.map((s) => ({ label: s.step, value: s.varName }))))
  ramp.setAttribute('label', `${family} tonal range`)
  section.append(ramp)
  content.append(section)
}

// ── dimensional ladders — the five ramps as live ui-ladder lists (the F1 retitle: "Dimensional ramps" → ─────
// "Dimensional ladders", ADR-0118 cl.1 — "tonal ramp" stays the color term) ──────────────────────────────────
content.append(heading(2, 'Dimensional ladders'))
content.append(
  pageLead(
    'The default (ui-md-equivalent) tier of each ladder — the row every control resolves from before a ' +
      '[scale] ancestor re-tables it. See the sizing guide for the full [scale] × [size] stepping demo.',
  ),
)
for (const { prefix, label, note } of DIMENSION_LADDERS) {
  const tiers = parseDimensionRamp(dimensionsCss, prefix)
  const section = document.createElement('section')
  section.append(heading(3, label))
  const p = document.createElement('p')
  p.textContent = note
  section.append(p)
  const ladder = document.createElement('ui-ladder')
  ladder.setAttribute('tiers', JSON.stringify(tiers.map((t) => ({ label: t.tier, value: t.value }))))
  ladder.setAttribute('label', label)
  section.append(ladder)
  content.append(section)
}

// ── type scale (GH #728) — every --md-sys-typescale-{role}-{size} cell as a LIVE specimen ─────────────────
// The fourth quarter of the token story: real rendered text at each cell's resolved size/weight/line-height/
// tracking, reading the SAME custom properties every consumer reads (the swatch/ladder live-resolution
// honesty, applied to type). A small in-page display idiom, deliberately NOT a new shipped primitive
// (ui-ladder's one-value-per-tier shape does not fit a 4-property cell — the issue's own scope ruling).
const typescaleHeading = heading(2, 'Type scale')
typescaleHeading.id = 'type-scale' // the cross-link anchor (sizing/theming link here)
content.append(typescaleHeading)
{
  const lead = document.createElement('p')
  lead.className = 'page-lead'
  lead.append(
    document.createTextNode(
      `The ${TYPESCALE_ROLES.length}-role × 3-size fleet type scale (--md-sys-typescale-{role}-{size}-*, ` +
        'ADR-0078): the five M3-verbatim roles plus the editorial extensions, each cell four properties — ' +
        'size (the one leg that rides [scale]) · weight · line-height · tracking. Rendered live below at each ' +
        'cell’s own resolved values. Note: kicker and overline render uppercase in consumers (a text.css ' +
        'treatment, not a typescale property). Controls never read these directly — ui-text does, via its own ' +
        '--ui-text-* repoint. How a subtree rescales the -size leg is the ',
    ),
    (() => {
      const a = document.createElement('a')
      a.href = './theming.html'
      a.textContent = 'theming guide'
      return a
    })(),
    document.createTextNode('’s story; where the type scale sits among the five size systems is the '),
    (() => {
      const a = document.createElement('a')
      a.href = './sizing.html'
      a.textContent = 'sizing guide'
      return a
    })(),
    document.createTextNode('’s.'),
  )
  content.append(lead)
}
for (const role of TYPESCALE_ROLES) {
  const section = document.createElement('section')
  section.append(heading(3, role))
  for (const row of TYPESCALE.filter((r) => r.role === role)) {
    const base = `--md-sys-typescale-${row.role}-${row.size}`
    const wrap = document.createElement('div')
    wrap.className = 'typescale-row'
    const meta = document.createElement('code')
    meta.className = 'typescale-meta'
    meta.textContent = `${base}-*  ·  ${row.sizeValue}  ·  ${row.weight}  ·  ${row.lineHeight}  ·  ${row.tracking}`
    const specimen = document.createElement('div')
    specimen.className = 'typescale-specimen'
    // LIVE resolution — the specimen reads the real custom properties, so a [scale] ancestor or a token
    // edit repaints it exactly as it repaints every consumer (never a re-typed literal).
    specimen.style.fontSize = `var(${base}-size)`
    specimen.style.fontWeight = `var(${base}-weight)`
    specimen.style.lineHeight = `var(${base}-line-height)`
    specimen.style.letterSpacing = `var(${base}-tracking)`
    specimen.textContent = `${row.role} ${row.size} — Sphinx of black quartz, judge my vow`
    wrap.append(meta, specimen)
    section.append(wrap)
  }
  content.append(section)
}
