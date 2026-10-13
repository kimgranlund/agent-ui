// a2ui-catalog.ts: the A2UI Catalog gallery. A `Catalog` selector above the filter picks one shipped catalog id
// (`../lib/a2ui-catalog-selector.ts`: the capability registry's ids, agent-ui first, then the other bases, then the
// derived base--persona ids), mirrored in the `?catalog=` query parameter (dropped for agent-ui, T-0064).
//
// agent-ui, the default view: every component the shipped default catalog declares, rendered live through the real
// renderer via one <component-preview mode="a2ui"> per component (a full live-knobs playground: edit any prop and
// the canvas re-renders through a fresh renderer). The list is DERIVED from `defaultCatalog.components`, so a new
// catalog type appears here automatically; sub-part helper types (Option, Tab/TabPanel, the Card regions) render
// only nested under their owner. GH #970 groups the list into five page-level tier tabs (Widget/Primitive/Compound/
// Feature/Input, `../lib/a2ui-catalog-tiers.ts`) via `ui-tabs`; the name filter stays orthogonal to the active tab,
// and each entry cross-links to the A2UI gallery seeds that render it, derived from the seed shelf.
//
// Any other id: the filter, status line and tabs hide, and a cached `div.catalog-alt` shows one card per type that
// catalog previews (a derived id: only its persona fragment's own types), each rendered from the first example seed
// that uses it, or naming its documented coverage exemption.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './a2ui-catalog.css' // page-local: the filter bar + section spacing (after the shared shell)
import '../lib/component-preview.ts' // registers <component-preview> (side-effect import)
import type { UITextFieldElement } from '@agent-ui/components/controls/text-field'
import type { UITabsElement } from '@agent-ui/components/controls/tabs'
import { TIERS, TIER_LABEL, browsableNames, tierOf, seedsUsingType, seedGalleryHref } from '../lib/a2ui-catalog-tiers.ts'
import type { Tier } from '../lib/a2ui-catalog-tiers.ts'
import type { UISelectElement } from '@agent-ui/components/controls/select'
import { createRenderer } from '@agent-ui/a2ui'
import { FLEET_CATALOG_ID } from '@agent-ui/a2ui/registry'
import { CATALOG_OPTIONS, catalogFromSearch, exampleSeedFor, exemptionFor, typesFor } from '../lib/a2ui-catalog-selector.ts'
import { createCanvasSurface, applyRootStretch } from '../lib/canvas-surface.ts'
import '../lib/warm-catalog.ts' // ADR-0241 (T-0040): the default catalog body is in before the first <component-preview mode="a2ui"> builds its renderer, which that element reads synchronously

// The browsable name list is the ONE derivation in `../lib/a2ui-catalog-tiers.ts` (`browsableNames()` — catalog
// keys minus NESTED_ONLY, alphabetized); the page consumes it rather than re-deriving its own copy, so the tier
// test suite and the live page can never disagree about which names are browsable (review MED, GH #970).
const names = browsableNames()

const { content } = mountPage({ title: 'A2UI Catalog' })
content.append(
  pageLead(
    `Every component the default agent-ui catalog declares (${names.length} shown), rendered live through the real ` +
      'renderer. Each card is a playground: edit a prop on the left and the surface on the right re-renders from a ' +
      'freshly-built A2UI payload. The list is derived from the shipped catalog, so it never drifts from it, and is ' +
      'grouped below into tabs by tier (owner-approved 2026-08-15 audit). Pick another catalog in the Catalog ' +
      'selector to preview its types, each rendered from an example seed that uses it.',
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

// The catalog selector (T-0064): one option per capability registry catalog id, the capability-registry page
// precedent. Inline layout keeps the page stylesheet, and the site CSS bundle it joins, untouched.
const catalogField = document.createElement('ui-field')
catalogField.setAttribute('label', 'Catalog')
const catalogSelect = document.createElement('ui-select') as UISelectElement
catalogSelect.className = 'catalog-select'
catalogSelect.style.cssText = 'display:grid; inline-size:min(100%, 28rem);'
for (const id of CATALOG_OPTIONS) {
  const option = document.createElement('div')
  option.setAttribute('role', 'option')
  option.setAttribute('value', id)
  option.textContent = id
  catalogSelect.append(option)
}
catalogField.append(catalogSelect)
content.append(catalogField)

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

// ── the alternate view for any non-default catalog id (T-0064): built once per id, cached, and shown in place
// of the filter, status line and tier tabs. The agent-ui DOM above is never rebuilt, only hidden. ──────────
const altViews = new Map<string, HTMLElement>()

/** Hide or show one agent-ui view element. `.catalog-tabs` sets its own `display`, which outranks the UA
 *  `[hidden]` rule, so an inline `display:none` rides along; showing removes it and any emptied `style`. */
function setShown(el: HTMLElement, shown: boolean): void {
  el.hidden = !shown
  if (shown) {
    el.style.removeProperty('display')
    if (el.getAttribute('style') === '') el.removeAttribute('style')
  } else {
    el.style.display = 'none'
  }
}

/** Render one seed into a fresh canvas; flag the card rendered once the renderer settles with a mounted root. */
async function renderSeedCard(section: HTMLElement, seed: NonNullable<ReturnType<typeof exampleSeedFor>>): Promise<void> {
  const { stage, surface } = createCanvasSurface()
  stage.style.cssText = 'block-size:28rem;'
  section.append(stage)
  const host = createRenderer()
  host.mount(surface)
  for (const message of seed.messages) host.ingest(JSON.stringify(message))
  host.finalize(seed.surfaceId)
  applyRootStretch(surface)
  await host.settled()
  section.dataset.rendered = surface.childElementCount > 0 ? 'true' : 'false'
}

/** Fill one alternate view: a lead line, then one card per type the catalog previews. */
async function fillAltView(view: HTMLElement, catalogId: string): Promise<void> {
  const lead = document.createElement('p')
  const cut = catalogId.indexOf('--')
  const types = typesFor(catalogId)
  if (cut === -1) {
    lead.textContent = `Every type the ${catalogId} catalog declares (${types.length}), each rendered from the first example seed that uses it.`
  } else {
    const base = catalogId.slice(0, cut)
    lead.textContent =
      `The ${catalogId.slice(cut + 2)} persona on the ${base} base: the ${types.length} types its fragment adds, each ` +
      `rendered from the first example seed that uses it. The ${base} types are under the ${base} option.`
  }
  view.append(lead)

  // Warm the catalog once: the ADR-0241 memo then registers its body on every card's renderer at once.
  try {
    await createRenderer().preload(catalogId)
  } catch (error) {
    const failed = document.createElement('p')
    failed.textContent = `The ${catalogId} catalog failed to load: ${error instanceof Error ? error.message : String(error)}`
    view.append(failed)
    return
  }

  const pending: Promise<void>[] = []
  for (const type of types) {
    const section = document.createElement('section')
    section.className = 'catalog-alt-item'
    section.dataset.type = type
    section.style.cssText = 'display:grid; gap:0.5rem; margin-block:1.5rem;'
    const heading = document.createElement('h2')
    heading.className = 'catalog-alt-title'
    heading.textContent = type
    section.append(heading)
    view.append(section)

    const exemption = exemptionFor(catalogId, type)
    if (exemption !== undefined) {
      const note = document.createElement('p')
      note.className = 'catalog-alt-exempt'
      note.textContent = `No example seed renders ${type}: ${exemption}`
      section.append(note)
      continue
    }
    const seed = exampleSeedFor(catalogId, type)
    const about = document.createElement('p')
    if (seed === undefined) {
      about.textContent = `No example seed renders ${type} yet.`
      section.append(about)
      continue
    }
    about.textContent = `${seed.name}: ${seed.description}`
    section.append(about)
    pending.push(renderSeedCard(section, seed))
  }
  await Promise.all(pending)
}

function showCatalog(catalogId: string): void {
  const isDefault = catalogId === FLEET_CATALOG_ID
  setShown(filterWrap, isDefault)
  setShown(filterStatus, isDefault)
  setShown(tabs, isDefault)
  if (!isDefault && !altViews.has(catalogId)) {
    const view = document.createElement('div')
    view.className = 'catalog-alt'
    view.dataset.catalog = catalogId
    altViews.set(catalogId, view)
    content.append(view)
    void fillAltView(view, catalogId)
  }
  for (const [id, view] of altViews) view.hidden = id !== catalogId
}

catalogSelect.addEventListener('change', () => {
  const catalogId = catalogSelect.value
  const url = new URL(location.href)
  if (catalogId === FLEET_CATALOG_ID) url.searchParams.delete('catalog')
  else url.searchParams.set('catalog', catalogId)
  history.replaceState(history.state, '', url)
  showCatalog(catalogId)
})
const initialCatalog = catalogFromSearch(location.search)
catalogSelect.value = initialCatalog
if (initialCatalog !== FLEET_CATALOG_ID) showCatalog(initialCatalog)
