// site/pages/composition.ts — the composition-patterns / recipes HUB (GH #1042): routes to (a) the
// consumer-assembly pattern map, (b) every shipped recipe page, and (c) the three deeper compose-procedure
// skills. Two derived surfaces, zero hand-copied bodies:
//
//   - The pattern rows are a build-time glob of `.claude/skills/composition-patterns/references/*.md`,
//     parsed by lib/composition-patterns.ts's pure parser (the adr-index.ts precedent) — a routing sentence
//     (the assembly problem) + the owning ADR/exemplar citation per row, NEVER the mechanism prose (the
//     skill's own "fleet's answer" column, which stays the skill's to own — the never-copy-bodies discipline).
//   - The recipe-page blurbs are read straight from site/lib/site-manifest.json (the SAME single-owner
//     manifest generate-sitemap.mjs derives the sitemap/rail from), filtered to the six recipe hrefs — never
//     hand-retyped, so a manifest description edit updates this hub for free.
//
// The three deeper skills (layout-composition / ui-composition / app-composition) are agent-facing `.claude/
// skills/*` files, not site pages — named by path + their own one-line routing rule (SKILL.md frontmatter),
// hand-authored because a skill's frontmatter has no build-time import path from a site page (T6 soft
// staleness — cited by file path so a reviewer can re-verify against the live file).
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './composition.css'
import { heading, tableHead, tableRow, appendInline } from '../lib/doc-page.ts'
import { el } from '../lib/specimens.ts'
import { parsePatternFiles } from '../lib/composition-patterns.ts'
import manifestData from '../lib/site-manifest.json'

const { content } = mountPage({
  title: 'Composition patterns',
  intro:
    'How to correctly CONSUME the fleet — the consumer-assembly pattern map, every shipped recipe page, and ' +
    'the deeper compose-procedure skills. This hub routes; it never restates a pattern’s mechanism (cite, ' +
    'never copy — the owning ADR/exemplar is one click away).',
})

content.append(
  pageLead(
    'agent-ui ships two kinds of pattern doc: the SKILL map below (a routing sentence + citation per ' +
      'assembly problem, read by an agent or a human) and the RECIPE pages (a real, live, copyable ' +
      'composition). Start with a recipe if you want working code; start with the pattern table if you ' +
      'want the rule and its owner.',
  ),
)

// ── the pattern map — build-time parsed from the skill's own reference tables ───────────────────────────────
content.append(heading(2, 'Consumer assembly patterns'))
content.append(
  el('p', { class: 'comp-source' }, [
    document.createTextNode(
      'Derived from .claude/skills/composition-patterns/SKILL.md and its four references/ tables — parsed at ' +
        'build time (lib/composition-patterns.ts), so a new/renamed row appears here with zero page edits. ' +
        'Each row names the assembly problem and its owner; the fleet’s actual answer stays in the cited file.',
    ),
  ]),
)

// Build-time glob of the skill's reference tables — eager RAW text, the adr-index.ts precedent.
// `exhaustive: true` is LOAD-BEARING: `.claude` is a dot-directory Vite's glob excludes by default.
const PATTERN_MODULES = import.meta.glob('../../.claude/skills/composition-patterns/references/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
  exhaustive: true,
}) as Record<string, string>

const PATTERN_GROUPS = parsePatternFiles(
  Object.entries(PATTERN_MODULES).sort(([a], [b]) => a.localeCompare(b)),
)

// Anti-vacuous: a silently-empty pattern list is a broken build (a dot-dir glob miss), not a valid empty state.
if (PATTERN_GROUPS.length === 0 || PATTERN_GROUPS.every((g) => g.rows.length === 0)) {
  throw new Error('composition.ts: the composition-patterns references/ glob resolved 0 pattern rows')
}

for (const group of PATTERN_GROUPS) {
  content.append(heading(3, group.title))
  content.append(
    el('p', { class: 'comp-group-path' }, [document.createTextNode(group.path.replace('../../', ''))]),
  )
  const table = document.createElement('table')
  table.className = 'comp-pattern-table'
  table.append(tableHead('Assembly problem', 'Owner · exemplar'))
  const tbody = document.createElement('tbody')
  for (const row of group.rows) {
    const problemCell = document.createElement('td')
    appendInline(problemCell, row.problem)
    const ownerCell = document.createElement('td')
    appendInline(ownerCell, row.owner)
    tbody.append(tableRow(problemCell, ownerCell))
  }
  table.append(tbody)
  content.append(table)
}

// ── the recipe pages — real, live, copyable compositions ────────────────────────────────────────────────────
content.append(heading(2, 'Recipe pages'))
content.append(
  el('p', { class: 'comp-source' }, [
    document.createTextNode(
      'Each recipe is a full site page mounting the real composition end-to-end. Titles/blurbs below are read ' +
        'straight from site/lib/site-manifest.json — the same source generate-sitemap.mjs derives the left ' +
        'rail from — never hand-retyped.',
    ),
  ]),
)

interface ManifestEntry {
  readonly href: string
  readonly label: string
  readonly description: string
  readonly level: string
  readonly section: string
}
const MANIFEST = manifestData as readonly ManifestEntry[]

// The six shipped recipe hrefs GH #1042 names — a page SELECTION (which existing pages this hub routes to),
// not a restated FACT about any one of them; the label/description text itself is manifest-derived below.
const RECIPE_HREFS = [
  './onboarding-checklist.html',
  './card-grid-drawer.html',
  './toc-content.html',
  './workspace-shell.html',
  './surface-host-doc.html',
  './conversation-doc.html',
] as const

const RECIPES = RECIPE_HREFS.map((href) => {
  const entry = MANIFEST.find((e) => e.href === href)
  if (!entry) throw new Error(`composition.ts: RECIPE_HREFS names ${href}, absent from site-manifest.json`)
  return entry
})

const recipeList = document.createElement('ul')
recipeList.className = 'comp-recipe-list'
for (const recipe of RECIPES) {
  const item = document.createElement('li')
  const link = document.createElement('a')
  link.href = recipe.href
  link.textContent = recipe.label
  const blurb = document.createElement('span')
  blurb.className = 'comp-recipe-blurb'
  blurb.textContent = ` — ${recipe.description}`
  item.append(link, blurb)
  recipeList.append(item)
}
content.append(recipeList)

// ── the deeper routes — the compose-procedure skills, one routing sentence each ─────────────────────────────
content.append(heading(2, 'Composing a whole screen or app'))
content.append(
  el('p', { class: 'comp-source' }, [
    document.createTextNode(
      'A pattern above answers one assembly question; these three `.claude/skills/*` procedures cover the ' +
        'larger job it sits inside of — agent-facing, not site pages, so they are named here rather than linked.',
    ),
  ]),
)

interface DeeperSkill {
  readonly name: string
  readonly path: string
  readonly rule: string
}
const DEEPER_SKILLS: readonly DeeperSkill[] = [
  {
    name: 'layout-composition',
    path: '.claude/skills/layout-composition/SKILL.md',
    rule: 'Compose ONE screen/page layout from the layout primitives (row/column/grid/card/tabs/modal/disclosure) and prove the whole rendered shape.',
  },
  {
    name: 'ui-composition',
    path: '.claude/skills/ui-composition/SKILL.md',
    rule: 'Compose ONE feature/fragment from shipped controls — a form, a toolbar, a settings panel — through each control’s public surface only.',
  },
  {
    name: 'app-composition',
    path: '.claude/skills/app-composition/SKILL.md',
    rule: 'Compose an APPLICATION on agent-ui — the package DAG, ui-super-shell regions, memory-first routing, app-wide theming, and the optional A2UI arm.',
  },
]
const skillList = document.createElement('ul')
skillList.className = 'comp-skill-list'
for (const skill of DEEPER_SKILLS) {
  const item = document.createElement('li')
  const code = document.createElement('code')
  code.textContent = skill.name
  const path = document.createElement('span')
  path.className = 'comp-skill-path'
  path.textContent = ` (${skill.path})`
  const rule = document.createElement('p')
  rule.className = 'comp-skill-rule'
  rule.textContent = skill.rule
  item.append(code, path, rule)
  skillList.append(item)
}
content.append(skillList)
