// site/pages/toc-content.ts — GH #964: the sticky-TOC content-layout COMPOSITION RECIPE (SaaS UX brief §5,
// "Content layout (a): TOC corpus + sticky nav -> select on mobile"). A long-form article + a scroll-spy'd
// `ui-nav-rail` sidebar (link-shaped items — a real in-page anchor nav, native Tab/click/status-bar-preview
// all free) that swaps to a `ui-select` below the ADR-0150 compact line, entirely over EXISTING fleet
// controls — `ui-nav-rail` + `ui-select` + `ui-text`-style real headings + the new `scrollSpy` trait
// (`@agent-ui/components/traits/scroll-spy`, GH #964's first slice). No `ui-toc` control minted: see
// "Mint-last verdict" below, the recipe's own proof that the composition carries the pattern without one.
//
// This page IS its own dogfood (the ticket's pre-decided minor, §3.3): rather than a second synthetic demo
// page, this recipe's OWN explanatory prose about itself is the "one long page" — genuinely substantial
// reference content (nine real sections), not lorem ipsum, so the composition is proven against the SAME
// shape of content the pattern targets (a docs/reference corpus), not a toy fixture.
//
// The TOC is HEADING-DERIVED (the brief's own gap #2: "no heading-derived TOC, no nav->select responsive
// swap primitive"): the nav-rail items and the compact select's options are built by SCANNING the article's
// own rendered `h2` elements (`article.querySelectorAll('h2')`), never a parallel hand-authored list that
// could drift from the real content.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import './toc-content.css'
import '@agent-ui/app/nav-rail' // self-defines ui-nav-rail (+ -group/-item, side-effect of the same import)
import '@agent-ui/app/nav-rail.css'
import '@agent-ui/components/controls/select' // self-defines ui-select
import type { UISelectElement } from '@agent-ui/components/controls/select'
import { scrollSpy } from '@agent-ui/components/traits/scroll-spy'
// `UIElement` is a TYPE-ONLY import (verbatimModuleSyntax erases it) — it costs this page's bundle nothing
// even though the root barrel it comes from is heavy; only `scrollSpy`'s own opt-in subpath (above) is a
// real runtime import.
import type { UIElement } from '@agent-ui/components'
import { heading } from '../lib/doc-page.ts'

const { content } = mountPage({
  title: 'Sticky TOC content layout',
  intro:
    'A long-form article + a scroll-spy’d ui-nav-rail sidebar, swapped to a ui-select below the ' +
    'ADR-0150 compact line — the composition recipe for GH #964’s "content corpus + sticky nav" ' +
    'pattern. The TOC below is derived from this very page’s own headings; scroll it and watch the ' +
    'active item track your position.',
})

content.append(
  pageLead(
    'Every ingredient already shipped — ui-nav-rail, ui-select, real ui-text-style headings, and ' +
      'shell-breakpoint.ts’s named compact line. What was missing was the scroll-spy wiring and the ' +
      'responsive swap between them; this recipe supplies both without a new control.',
  ),
)

// ── slugify + a heading builder that stamps a stable id (doc-page.ts's `heading()` makes NO id of its own
// ── — a TOC needs one per section to anchor-link and observe against) ──────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function section(text: string): HTMLElement {
  const h = heading(2, text)
  h.id = slugify(text)
  return h
}

function p(text: string): HTMLElement {
  const el = document.createElement('p')
  el.textContent = text
  return el
}

// ── the article — nine real sections (this recipe's own dogfooding: see the file banner) ───────────────────

const article = document.createElement('article')
article.className = 'toc-content-article'
article.append(
  section('Overview'),
  p(
    'A reference corpus — docs, a knowledge base, a long settings/help page — reads best with a ' +
      'content column plus a sticky side nav that always shows where you are. Below a certain width there ' +
      'is no room for a sidebar at all, so the same navigation collapses into a single control pinned at ' +
      'the top: MDN and most SaaS docs sites take this shape (the brief’s canonical pattern).',
  ),
  section('Why not a scroll listener'),
  p(
    'The obvious first instinct is a `scroll` event handler that re-measures every heading’s ' +
      '`getBoundingClientRect()` on every frame. That works, but it runs continuously whether anything ' +
      'changed or not. An IntersectionObserver only fires when a heading actually crosses a named band near ' +
      'the top of the viewport — the browser does the continuous work, the trait only reacts to real ' +
      'crossings.',
  ),
  section('The scroll-spy trait'),
  p(
    '`scrollSpy(host, opts)` (traits/ tier, `@agent-ui/components/traits/scroll-spy`) takes the list of ' +
      'headings to watch and an `onActiveChange(id)` callback. It keeps its own live map of every heading’s ' +
      'intersecting state — IntersectionObserver callbacks are DELTA-only, reporting just the targets ' +
      'that changed — and reports the last (topmost-crossed) intersecting heading in document order, ' +
      'falling back to the nearest already-passed heading so the active id never blanks out mid-article.',
  ),
  section('Composing the wide rail'),
  p(
    'The sidebar is a plain `ui-nav-rail` with `collapse="none"` (the family’s own escape hatch for "a ' +
      'consumer whose shell owns the narrow behavior" — this page does, not the rail). One ' +
      '`ui-nav-rail-item` per `h2`, each with a real `href="#slug"` — link-shaped, so it renders a real ' +
      '`<a>`: native Tab order, status-bar preview, ctrl/cmd-click-new-tab, and the browser’s own anchor ' +
      'jump all come free, no click handler needed for navigation itself.',
  ),
  section('The compact swap'),
  p(
    'Below the ADR-0150 compact line (52.5rem / 840px — shell-breakpoint.ts’s ' +
      '`SHELL_COMPACT_BREAKPOINT_REM`, the SAME line ui-settings’ rail→select swap uses, GH #962) the ' +
      'rail hides and a `ui-select` holding the identical set of sections takes its place, pinned above the ' +
      'article. A `ResizeObserver` on the layout’s own box stamps `data-compact` — the exact idiom ' +
      '#962 shipped, reused rather than re-invented (this page cannot import the constant directly: it sits ' +
      'outside @agent-ui/app’s package.json exports map, the same cross-package situation this site’s ' +
      'own header-chip collapse already documents — see this file’s TOC_COMPACT_BREAKPOINT_REM banner ' +
      'below for the citation).',
  ),
  section('Wiring active-state sync'),
  p(
    'One `scrollSpy` call drives BOTH halves: its `onActiveChange` callback marks the matching ' +
      '`ui-nav-rail-item`’s `selected` attribute (native ARIA/indicator handling, zero extra work) and ' +
      'writes the compact `ui-select`’s `.value` in lock-step — a silent, non-emitting reflect (ADR-0019), ' +
      'so keeping both synced risks no doubled event. Choosing a section from the select scrolls the matching ' +
      'heading into view; scrolling the article updates the rail’s indicator. Either surface stays correct ' +
      'regardless of which one is currently visible.',
  ),
  section('Accessibility notes'),
  p(
    'Link-shaped `ui-nav-rail-item`s carry native anchor semantics, so no ARIA is hand-rolled for the rail ' +
      'itself. `scroll-margin-block-start` on every heading keeps an anchor jump (or a `scrollIntoView()` call ' +
      'from the compact select) from landing UNDER the page’s own sticky header. The active-item ' +
      'indication is a real `selected` attribute driving a `border-inline-start` bar — not color alone — ' +
      'so it survives forced-colors mode, the same law the rest of the nav-rail family already carries.',
  ),
  section('Anti-patterns'),
  p(
    'Do not fork a second compact-breakpoint mechanism: reuse the named ADR-0150 line, never a bespoke width ' +
      'guess. Do not run the scroll-spy decision off a raw `scroll` listener when IntersectionObserver is ' +
      'available — the continuous-cost trade-off above. Do not show the rail AND the select at the same ' +
      'width — exactly one navigation surface is visible at any given band, matching ui-settings’ own ' +
      'rail/select posture.',
  ),
  section('Mint-last verdict: no ui-toc'),
  p(
    'This recipe carries the whole pattern — heading-derived entries, sticky positioning, scroll-spy ' +
      'sync, and the responsive swap — in about 150 lines of composition over shipped controls, with no ' +
      'bespoke rendering, no new ARIA contract, and no new CSS component. A `ui-toc` control would duplicate ' +
      'exactly what `ui-nav-rail` + `ui-select` + `scrollSpy` already do; the mint bar (recipe too heavy to ' +
      'ask of consumers) is not met. Verdict: DO NOT MINT — recorded in the issue’s Findings, ' +
      'reconsider only if a second consumer needs this composition and finds the wiring genuinely too heavy ' +
      'to repeat.',
  ),
)

// ── the TOC — heading-derived from the article’s own rendered h2s, never a parallel hand list ──────────

interface TocEntry {
  readonly id: string
  readonly label: string
}

const entries: TocEntry[] = [...article.querySelectorAll('h2')].map((h) => ({
  id: (h as HTMLElement).id,
  label: h.textContent ?? '',
}))

const nav = document.createElement('ui-nav-rail')
nav.className = 'toc-content-nav'
nav.setAttribute('collapse', 'none')
nav.setAttribute('aria-label', 'Table of contents')

const select = document.createElement('ui-select') as UISelectElement
select.className = 'toc-content-select'
select.label = 'Table of contents'

const itemsById = new Map<string, HTMLElement>()
for (const entry of entries) {
  const item = document.createElement('ui-nav-rail-item')
  item.setAttribute('href', `#${entry.id}`)
  item.textContent = entry.label
  itemsById.set(entry.id, item)
  nav.append(item)

  const option = document.createElement('div')
  option.setAttribute('role', 'option')
  option.setAttribute('value', entry.id)
  option.textContent = entry.label
  select.append(option)
}

// Selecting a TOC section jumps the article to it — the rail's own items navigate natively (real
// href="#slug" anchors); only the compact select needs an explicit scroll (it commits a value, it does not
// navigate).
select.addEventListener('select', () => {
  const value = select.value
  if (!value) return
  document.getElementById(value)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

function markActive(id: string | null): void {
  for (const [entryId, item] of itemsById) item.toggleAttribute('selected', entryId === id)
  if (id && select.value !== id) select.value = id
}

// ── the layout grid — select (compact-only), article, rail (wide-only); see toc-content.css ────────────

const layout = document.createElement('div')
layout.className = 'toc-content-layout'
layout.append(select, article, nav)
content.append(layout)

// GH #964 — the compact-band watcher, the #962 `data-compact`/ResizeObserver idiom mirrored verbatim
// (settings.ts's own banner: observes the SAME box the responsive swap keys off, stamps `data-compact` at
// the shell family's named COMPACT line, root-font-size-aware so a non-16px root is handled). NOT imported
// from `@agent-ui/app`'s shell-breakpoint.ts: the site isn't in that package's package.json exports map, and
// `_page.ts`'s own GH #183 header-chip collapse already established the convention for this exact
// cross-package situation — a site call site keeps its own cited literal rather than a shared import
// (see that file's banner for the full reasoning). This is the SAME 52.5rem value, cited, not a second
// mechanism.
const TOC_COMPACT_BREAKPOINT_REM = 52.5 // == @agent-ui/app's shell-breakpoint.ts SHELL_COMPACT_BREAKPOINT_REM

function applyCompactBand(inlineSize: number): void {
  const rootFontPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const compact = inlineSize > 0 && inlineSize < TOC_COMPACT_BREAKPOINT_REM * rootFontPx
  layout.toggleAttribute('data-compact', compact)
}

if (typeof ResizeObserver === 'undefined') {
  applyCompactBand(layout.clientWidth) // a pre-RO engine — one static read (the ui-settings jsdom guard)
} else {
  const bandObserver = new ResizeObserver((resizeEntries) => {
    const entry = resizeEntries[0]
    if (entry === undefined) return
    applyCompactBand(entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width)
  })
  bandObserver.observe(layout, { box: 'content-box' })
}

// GH #964 — measure the page's own sticky header so the TOC's sticky offset clears it (the header's
// rendered height varies per page shape — with/without tabs, with/without a wrapped description — so
// a guessed rem constant would drift; this stays correct across every page shape and viewport width).
const pageHeader = document.querySelector('.page-header')
if (pageHeader instanceof HTMLElement) {
  const applyHeaderOffset = (): void => {
    layout.style.setProperty('--toc-sticky-top', `${pageHeader.offsetHeight + 16}px`)
  }
  if (typeof ResizeObserver === 'undefined') {
    applyHeaderOffset()
  } else {
    const headerObserver = new ResizeObserver(applyHeaderOffset)
    headerObserver.observe(pageHeader)
  }
}

// ── the scroll-spy wiring — one call drives both the rail and the compact select (see "Wiring
// ── active-state sync" above) ─────────────────────────────────────────────────────────────────────────────

const headingEls = [...article.querySelectorAll('h2')] as HTMLElement[]
scrollSpy(nav as unknown as UIElement, {
  headings: headingEls,
  onActiveChange: markActive,
})
