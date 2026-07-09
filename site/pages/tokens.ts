// site/pages/tokens.ts — the DERIVED token reference: every `--md-sys-color-{family}-{role}` semantic role
// (tokens.css) as a live swatch row, plus the five dimensional ramps (dimensions.css) as tables. Nothing here is
// hand-typed: both sheets are pulled at build time via Vite's `?raw` (the frontmatter.ts / adr-index.ts
// convention) and parsed by the pure `site/lib/token-parse.ts` helpers — the SAME helpers `tokens-doc.test.ts`
// asserts against, so a token rename/add/remove flows to this page and its drift gate with zero edits here.
// Anti-vacuous by construction: both parsers throw below if the sheet-scan comes back empty (the adr-index.ts
// precedent for a build-time glob that could silently resolve to nothing).
//
// The colour swatches are LIVE, not a hand-picked hex: each swatch element gets its OWN `color-scheme` (light or
// dark) and reads `background: var(--role)`, so the browser's real light-dark() resolution paints it — then
// getComputedStyle reads the resolved value back as text. This is the tokens.html analogue of "run the real
// control" (docs-author's honesty discipline) — the row shows what the token ACTUALLY resolves to, in a real
// DOM, not a description of it.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './tokens.css'
import { heading } from '../lib/doc-page.ts'
import { familiesOf, parseColorRoles, parseDimensionRamp, type ColorRole, type DimensionTier } from '../lib/token-parse.ts'
import tokensCss from '../../packages/agent-ui/shared/src/tokens/tokens.css?raw'
import dimensionsCss from '../../packages/agent-ui/shared/src/tokens/dimensions.css?raw'

const ROLES = parseColorRoles(tokensCss)
if (ROLES.length === 0) {
  throw new Error('tokens.ts: parseColorRoles resolved 0 roles — tokens.css did not match the expected :root shape')
}
const FAMILIES = familiesOf(ROLES)

const DIMENSION_RAMPS: readonly { readonly prefix: string; readonly label: string; readonly note: string }[] = [
  { prefix: 'ui-height', label: '--ui-height-*', note: 'The Control-class block-size (button · text-field · select · field) — the frame the h/2 centring law measures from.' },
  { prefix: 'ui-font', label: '--ui-font-*', note: 'The control-band glyph size, paired 1:1 with --ui-height-* (the square-centring law) — never the document type scale.' },
  { prefix: 'ui-icon', label: '--ui-icon-*', note: 'The fixed CONTENT-icon register (a field’s leading icon, a status glyph) — distinct from an inline affordance, which is sized = font.' },
  { prefix: 'ui-compact', label: '--ui-compact-*', note: 'The Indicator/Range widget-box ramp (checkbox · switch · radio · slider) — a separate size system from Control height.' },
  { prefix: 'ui-space', label: '--ui-space-*', note: 'Layout spacing BETWEEN components (gaps, padding, margin) — density-derived, never control geometry (geometry.md’s "not interchangeable" rule).' },
]
for (const { prefix } of DIMENSION_RAMPS) {
  if (parseDimensionRamp(dimensionsCss, prefix).length === 0) {
    throw new Error(`tokens.ts: parseDimensionRamp resolved 0 tiers for --${prefix}-* — dimensions.css did not match the expected shape`)
  }
}

const { content } = mountPage({
  title: 'Token reference',
  intro:
    `${ROLES.length} colour roles across ${FAMILIES.length} families, plus the five dimensional ramps — ` +
    'parsed live from the foundation sheets, not hand-copied. If this page and the shipped tokens ever ' +
    'disagree, the page is stale and its derivation is the bug.',
})

content.append(
  pageLead(
    'Every value below is read straight from @agent-ui/shared’s two foundation sheets: tokens.css (colour) ' +
      'and dimensions.css (geometry + spacing). The colour swatches are rendered LIVE — each one carries its ' +
      'own color-scheme and reads the real custom property, so what you see is the browser’s actual ' +
      'light-dark() resolution, read back via getComputedStyle. For the theming CONTRACT (how a page adopts ' +
      'these), see the theming guide; for the geometry LAW these dimensional ramps implement, see the sizing guide.',
  ),
)

// ── colour roles — one swatch-row per --md-sys-color-{family}-{role} ────────────────────────────────────────
function swatch(role: ColorRole, scheme: 'light' | 'dark'): HTMLElement {
  const box = document.createElement('div')
  box.className = 'token-swatch'
  box.style.colorScheme = scheme
  box.style.background = `var(${role.varName})`
  // Read the resolved colour back — a real getComputedStyle call over the real custom property, in the real
  // scheme this element carries. `title` surfaces the exact serialized value on hover (a live fact, not prose).
  const resolved = getComputedStyle(box).backgroundColor
  box.title = `${scheme}: ${resolved}`
  return box
}

function roleRow(role: ColorRole): HTMLElement {
  const tr = document.createElement('tr')
  const nameCell = document.createElement('td')
  const code = document.createElement('code')
  code.textContent = role.varName
  nameCell.append(code)

  const roleCell = document.createElement('td')
  roleCell.textContent = role.role

  const lightCell = document.createElement('td')
  lightCell.append(swatch(role, 'light'))
  const darkCell = document.createElement('td')
  darkCell.className = 'token-cell-dark'
  darkCell.append(swatch(role, 'dark'))

  tr.append(nameCell, roleCell, lightCell, darkCell)
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
  for (const label of ['Token', 'Role', 'Light', 'Dark']) {
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

// ── dimensional ramps — the five ladders as tables ───────────────────────────────────────────────────────────
content.append(heading(2, 'Dimensional ramps'))
content.append(
  (() => {
    const p = document.createElement('p')
    p.className = 'token-ramp-lead'
    p.textContent =
      'The default (ui-md-equivalent) tier of each ramp — the row every control resolves from before a ' +
      '[scale] ancestor re-tables it. See the sizing guide for the full [scale] × [size] stepping demo.'
    return p
  })(),
)
for (const { prefix, label, note } of DIMENSION_RAMPS) {
  const tiers: DimensionTier[] = parseDimensionRamp(dimensionsCss, prefix)
  const section = document.createElement('section')
  section.append(heading(3, label))
  const p = document.createElement('p')
  p.textContent = note
  section.append(p)
  const table = document.createElement('table')
  table.className = 'token-table'
  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  for (const l of ['Tier', 'Value']) {
    const th = document.createElement('th')
    th.textContent = l
    headRow.append(th)
  }
  thead.append(headRow)
  const tbody = document.createElement('tbody')
  for (const tier of tiers) {
    const tr = document.createElement('tr')
    const tierCell = document.createElement('td')
    const code = document.createElement('code')
    code.textContent = tier.tier
    tierCell.append(code)
    const valueCell = document.createElement('td')
    const valueCode = document.createElement('code')
    valueCode.textContent = tier.value
    valueCell.append(valueCode)
    tr.append(tierCell, valueCell)
    tbody.append(tr)
  }
  table.append(thead, tbody)
  section.append(table)
  content.append(section)
}
