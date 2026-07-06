// a2ui-catalog.ts — the A2UI Catalog gallery. Enumerates EVERY component the shipped default catalog declares
// and renders each live through the real renderer, via one <component-preview mode="a2ui"> per component (a full
// live-knobs playground: edit any prop → the canvas re-renders through a fresh renderer). The component list is
// DERIVED from `defaultCatalog.components` — a new catalog type appears here automatically, so the gallery cannot
// drift from the shipped catalog. Sub-part helper types (Option, the Tab/TabPanel, the Card regions) render only
// nested under their owner, so they are folded into that owner's sample content rather than listed standalone.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './a2ui-catalog.css' // page-local: the filter bar + section spacing (after the shared shell)
import '../lib/component-preview.ts' // registers <component-preview> (side-effect import)
import { defaultCatalog } from '@agent-ui/a2ui'
import type { UITextFieldElement } from '@agent-ui/components/components'

// The sub-part types that only make sense INSIDE their owner (each is a container region / list item). They still
// render standalone, but as top-level gallery entries they carry no context — so the gallery folds them into the
// owner's sample subtree (Select ships its Options, Tabs its Tab/TabPanel, Card its regions) instead.
const NESTED_ONLY = new Set(['Option', 'Tab', 'TabPanel', 'CardHeader', 'CardContent', 'CardFooter'])

const names = Object.keys(defaultCatalog.components)
  .filter((name) => !NESTED_ONLY.has(name))
  .sort((a, b) => a.localeCompare(b))

const { content } = mountPage({ title: 'A2UI Catalog' })
content.append(
  pageLead(
    `Every component the default agent-ui catalog declares (${names.length} shown), rendered live through the real ` +
      'renderer. Each card is a playground: edit a prop on the left and the surface on the right re-renders from a ' +
      'freshly-built A2UI payload. The list is derived from the shipped catalog, so it never drifts from it.',
  ),
)

// ── name filter (live, case-insensitive) — hides non-matching sections ────────────────────────────────────────
const filterWrap = document.createElement('div')
filterWrap.className = 'catalog-filter'
// Dogfoods ui-text-field (type=search) in place of a native <input type=search> (Kim's directive) — the
// gallery filter precedent. `label` is the bare-usage naming seam (text-field.md labelSource → the editor's
// aria-label), matching the old input's `aria-label`; `.value` + the `input` event drive the live filter.
const filter = document.createElement('ui-text-field') as UITextFieldElement
filter.setAttribute('type', 'search')
filter.className = 'catalog-filter-input'
filter.setAttribute('placeholder', `Filter ${names.length} components…`)
filter.setAttribute('label', 'Filter catalog components by name')
filterWrap.append(filter)
content.append(filterWrap)

// ── one titled section + live preview per catalog component ───────────────────────────────────────────────────
const sections: Array<{ name: string; el: HTMLElement }> = []
for (const name of names) {
  const section = document.createElement('section')
  section.className = 'catalog-item'
  const heading = document.createElement('h2')
  heading.className = 'catalog-item-title'
  heading.textContent = name
  const preview = document.createElement('component-preview')
  preview.setAttribute('mode', 'a2ui')
  preview.setAttribute('target', name)
  section.append(heading, preview)
  content.append(section)
  sections.push({ name, el: section })
}

filter.addEventListener('input', () => {
  const q = filter.value.trim().toLowerCase()
  for (const { name, el } of sections) el.hidden = q !== '' && !name.toLowerCase().includes(q)
})
