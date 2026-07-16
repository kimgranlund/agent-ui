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
import { familiesOf, parseColorPrimitives, parseColorRoles, parseDimensionRamp, type ColorRole } from '../lib/token-parse.ts'
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
  { prefix: 'ui-height', label: '--ui-height-*', note: 'The Control-class block-size (button · text-field · select · field) — the frame the h/2 centring law measures from.' },
  { prefix: 'ui-font', label: '--ui-font-*', note: 'The control-band glyph size, paired 1:1 with --ui-height-* (the square-centring law) — never the document type scale.' },
  { prefix: 'ui-icon', label: '--ui-icon-*', note: 'The fixed CONTENT-icon register (a field’s leading icon, a status glyph) — distinct from an inline affordance, which is sized = font.' },
  { prefix: 'ui-compact', label: '--ui-compact-*', note: 'The Indicator/Range widget-box ramp (checkbox · switch · radio · slider) — a separate size system from Control height.' },
  { prefix: 'ui-space', label: '--ui-space-*', note: 'Layout spacing BETWEEN components (gaps, padding, margin) — density-derived, never control geometry (geometry.md’s "not interchangeable" rule).' },
]
for (const { prefix } of DIMENSION_LADDERS) {
  if (parseDimensionRamp(dimensionsCss, prefix).length === 0) {
    throw new Error(`tokens.ts: parseDimensionRamp resolved 0 tiers for --${prefix}-* — dimensions.css did not match the expected shape`)
  }
}

const { content } = mountPage({
  title: 'Token reference',
  intro:
    `${ROLES.length} colour roles across ${FAMILIES.length} families, the numbered tonal primitives, plus ` +
    'the five dimensional ladders — parsed live from the foundation sheets and rendered on the shipped ' +
    'token-surface primitives, not hand-copied. If this page and the shipped tokens ever disagree, the page ' +
    'is stale and its derivation is the bug.',
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
