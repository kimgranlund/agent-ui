// a2ui-catalog.ts — the A2UI Catalog gallery. Enumerates EVERY component the shipped default catalog declares
// and renders each live through the real renderer, via one <component-preview mode="a2ui"> per component (a full
// live-knobs playground: edit any prop → the canvas re-renders through a fresh renderer). The component list is
// DERIVED from `defaultCatalog.components` — a new catalog type appears here automatically, so the gallery cannot
// drift from the shipped catalog. Sub-part helper types (Option, the Tab/TabPanel, the Card regions) render only
// nested under their owner, so they are folded into that owner's sample content rather than listed standalone.
//
// GH #970 (owner-approved 2026-08-15 audit): the flat 54-item alphabetized list is now grouped into FIVE
// page-level tabs by TIER — Widget/Primitive/Pattern/Feature/Input (`../lib/a2ui-catalog-tiers.ts`) — via the
// shipped `ui-tabs` compound. The name filter stays orthogonal to the active tab: it narrows every tier's
// section list identically regardless of which tab is currently showing, so switching tabs never drops or
// resets an in-progress search. Each entry additionally cross-links to the A2UI gallery examples that actually
// render it ("see it in real use") — DERIVED from the example-seed shelf, never hand-listed.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './a2ui-catalog.css' // page-local: the filter bar + section spacing (after the shared shell)
import '../lib/component-preview.ts' // registers <component-preview> (side-effect import)
import type { UITextFieldElement, UITabsElement } from '@agent-ui/components/components'
import { TIERS, TIER_LABEL, browsableNames, tierOf, seedsUsingType, seedGalleryHref } from '../lib/a2ui-catalog-tiers.ts'
import type { Tier } from '../lib/a2ui-catalog-tiers.ts'

// The browsable name list is the ONE derivation in `../lib/a2ui-catalog-tiers.ts` (`browsableNames()` — catalog
// keys minus NESTED_ONLY, alphabetized); the page consumes it rather than re-deriving its own copy, so the tier
// test suite and the live page can never disagree about which names are browsable (review MED, GH #970).
const names = browsableNames()

const { content } = mountPage({ title: 'A2UI Catalog' })
content.append(
  pageLead(
    `Every component the default agent-ui catalog declares (${names.length} shown), rendered live through the real ` +
      'renderer. Each card is a playground: edit a prop on the left and the surface on the right re-renders from a ' +
      'freshly-built A2UI payload. The list is derived from the shipped catalog, so it never drifts from it — ' +
      'grouped below into tabs by tier (owner-approved 2026-08-15 audit).',
  ),
)

// ── reciprocal cross-link to the composition gallery (GH #970 — "the two pages link each other") ─────────
const galleryLinkAnchor = document.createElement('a')
galleryLinkAnchor.href = './a2ui-gallery.html'
galleryLinkAnchor.textContent = 'the A2UI gallery'
content.append(
  pageLead(
    'Looking for a full composed example instead of one type? Browse ',
    galleryLinkAnchor,
    ' — every card there is built from the types on this page.',
  ),
)

// ── name filter (live, case-insensitive) — hides non-matching sections in EVERY tab, not just the active
// one (GH #970's "search stays orthogonal" acceptance bullet: the filter never resets or re-scopes on a
// tab switch, so a query typed on one tab still narrows the others when the reader switches to them) ──────
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

// A live status line — announces the cross-tab match count so a reader whose ACTIVE tab happens to show
// zero matches still learns the query hit something (the observable half of "filters across all tabs":
// filtering that only ever narrowed the current tab's own contents would look, from the active panel alone,
// identical to a per-tab-scoped filter — this line is what actually proves the difference).
const filterStatus = document.createElement('p')
filterStatus.className = 'catalog-filter-status'
filterStatus.setAttribute('aria-live', 'polite')
content.append(filterStatus)

// ── one ui-tabs strip, one tab + panel per tier, sections grouped + still alphabetized within their tier ──
const tabs = document.createElement('ui-tabs') as UITabsElement
tabs.className = 'catalog-tabs'
tabs.setAttribute('selected', TIERS[0])

const sections: Array<{ name: string; tier: Tier; el: HTMLElement }> = []
const tabEls: HTMLElement[] = []
const panelEls: HTMLElement[] = []
// Keyed so the filter listener below can rewrite each tab's own count label live (GH #1002 — the counts
// were built once at mount and never revisited, so they went stale the instant a reader typed a query).
const tabByTier = new Map<Tier, HTMLElement>()

for (const tier of TIERS) {
  const tierNames = names.filter((name) => tierOf(name) === tier)

  const tab = document.createElement('ui-tab')
  tab.setAttribute('key', tier)
  tab.textContent = `${TIER_LABEL[tier]} (${tierNames.length})`
  tabEls.push(tab)
  tabByTier.set(tier, tab)

  const panel = document.createElement('ui-tab-panel')
  panel.className = 'catalog-tab-panel'

  for (const name of tierNames) {
    const section = document.createElement('section')
    section.className = 'catalog-item'
    const heading = document.createElement('h2')
    heading.className = 'catalog-item-title'
    heading.textContent = name
    const preview = document.createElement('component-preview')
    preview.setAttribute('mode', 'a2ui')
    preview.setAttribute('target', name)
    section.append(heading, preview)

    // "See it in real use" — DERIVED from the example-seed shelf (never hand-listed): every gallery seed
    // whose payload actually renders this type, linked via a plain hash-anchor (no JS needed to land on
    // it). Omitted entirely when no shelf seed happens to use the type — an empty "see it in real use:"
    // prefix would be noise, not a fact.
    const uses = seedsUsingType(name)
    if (uses.length > 0) {
      const usesPara = document.createElement('p')
      usesPara.className = 'catalog-item-uses'
      usesPara.append(document.createTextNode('See it in real use: '))
      uses.forEach((seedName, i) => {
        if (i > 0) usesPara.append(document.createTextNode(', '))
        const a = document.createElement('a')
        a.href = seedGalleryHref(seedName)
        a.textContent = seedName
        usesPara.append(a)
      })
      usesPara.append(document.createTextNode('.'))
      section.append(usesPara)
    }

    panel.append(section)
    sections.push({ name, tier, el: section })
  }

  panelEls.push(panel)
}
tabs.append(...tabEls, ...panelEls)
content.append(tabs)

filter.addEventListener('input', () => {
  const q = filter.value.trim().toLowerCase()
  const matchesByTier = new Map<Tier, number>()
  for (const { name, tier, el } of sections) {
    const matches = q === '' || name.toLowerCase().includes(q)
    el.hidden = !matches
    if (matches) matchesByTier.set(tier, (matchesByTier.get(tier) ?? 0) + 1)
  }
  // Live tab-label counts — LIVE from the same `matchesByTier` tally the status line reads below, not the
  // build-time `tierNames.length` (GH #1002): an empty query still runs this since `matches` is unconditionally
  // true then, so `matchesByTier` already equals the natural per-tier totals — one source, no separate branch.
  for (const tier of TIERS) {
    const tab = tabByTier.get(tier)
    if (tab) tab.textContent = `${TIER_LABEL[tier]} (${matchesByTier.get(tier) ?? 0})`
  }
  if (q === '') {
    filterStatus.textContent = ''
    return
  }
  const total = [...matchesByTier.values()].reduce((sum, n) => sum + n, 0)
  const breakdown = TIERS.filter((t) => matchesByTier.has(t))
    .map((t) => `${TIER_LABEL[t]} (${matchesByTier.get(t)})`)
    .join(', ')
  filterStatus.textContent =
    total === 0
      ? `No components match "${filter.value}".`
      : `${total} of ${names.length} components match "${filter.value}" — ${breakdown}.`
})
