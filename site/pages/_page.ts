// site/pages/_page.ts — the shared /site page shell. EVERY /site page module imports this file FIRST; it is
// the single place that performs the load-bearing foundation import cascade (ADR-0003), so a page builder never
// repeats — or reorders — it.
//
// Import order is load-bearing: the colour `--md-sys-color-*` roles + the `--ui-{height,font,gap}-*` ramp from the
// FOUNDATION barrel must be declared BEFORE a control's `:where()` block reads them. So foundation CSS loads
// tokens-first, then the per-component CSS, then the behaviour that self-defines the ui-* controls. Because a
// page module imports `_page.ts` as its first statement, ES depth-first evaluation runs these three before any
// other control-touching import in the page — so the cascade order holds for the whole site.
//
// SHELL NOTE — a CSS-only app shell (the outer context frame + the per-page sticky header/footer is
// `_page.css` grid + sticky and the structure below). The LEFT NAV RAIL is no longer hand-rolled: it is now
// a real `ui-nav-rail` (ADR-0130, the mode-1 consumer of the shared nav-rail family), fed from
// `sitemap.json` and hidden/overlaid at narrow by the shell itself (GH #170/ADR-0155 — no rail-owned
// `collapse="menu"` dropdown here). The remaining top-bar / footer / CTA are still CSS-only placeholders an
// app-shell component family will own later, the same way the pages already dogfood ui-button / ui-text-field.
import '@agent-ui/components/foundation-styles.css' // [1] foundation: tokens.css -> dimensions.css (FIRST)
import '@agent-ui/components/component-styles.css' // [2] per-control CSS, after the foundation
import '@agent-ui/components/components' // [3] self-defining ui-* controls (registers ui-button on import)
import '@agent-ui/app/nav-rail' // [3a] the shared ui-nav-rail family (@agent-ui/app) the site nav composes (ADR-0130, mode 1)
import '@agent-ui/app/nav-rail.css' // [3a] its stylesheet — the rail's grouped vertical anatomy, after the foundation
import '@agent-ui/app/super-shell' // [3c] M5 (GH #84): the site chrome now RIDES the shell system — ui-super-shell owns the frame
import '@agent-ui/app/super-shell.css' // [3c] its stylesheet (the 18px module ladder + per-side collapse)
import '@agent-ui/icons/phosphor' // [3b] activate the Phosphor default pack (ADR-0065/0066): the controls above render their
// affordances (select caret, text-field clear/reveal/steppers, calendar nav) through the app-owned icon pack — pack-agnostic
// by design, so the SHELL that self-defines them must activate the default pack, else those glyphs resolve to an empty <svg>.
import './_page.css' // [4] shared page chrome (shell + nav + header), AFTER the foundation so it reads the --md-sys-color-* roles
import type { UIButtonElement, UIMenuElement, UIThemeProviderElement } from '@agent-ui/components/components'
import { THEME_OPTIONS, applyTheme, applyScheme, persistTheme, persistScheme, loadPersistedTheme, loadPersistedScheme, type SchemeId } from '../lib/theme-loader.ts'

// The build-time site index (TKT-0018): the ONE source the browse rail derives from. 56 L1 components
// (proper name + tag), 25 L2 guides, the 2 L3 record landings — each carrying a `section` (Components /
// Guides / Records). A static import keeps `buildNav()` synchronous and lets the drift gate re-derive the
// expected rail count from the SAME source (the command palette fetches it at runtime for a different
// reason). Imports the src-tree COPY, not site/public/sitemap.json directly — Vite hard-errors on a static
// JS import of anything under publicDir ("Assets in public directory cannot be imported from
// JavaScript"); generate-sitemap.mjs writes both copies from the same generation, byte-identical, so this
// can never independently drift from the public copy command-palette.ts fetches at runtime.
import sitemapData from '../sitemap.json'

// What a page builder gets back from mountPage: the <main> container to append its content into. Kept to a
// single field so every page slice shares a stable, minimal contract.
export interface PageHandle {
  readonly content: HTMLElement
}

// ── the page-header tab-strip source (formerly ALSO the rail source) ─────────────────────────────────────────
// `NAV` groups the site's per-component page-type links (Permutations/States/API/Demo). Since ADR-0130's mode-1
// migration, the LEFT RAIL no longer derives from this array — it derives from `sitemap.json` (SITE_NAV_ENTRIES
// below, rendered on `ui-nav-rail`). `NAV` SURVIVES only as the residue that genuinely cannot
// derive from the sitemap: the per-component page-type sub-links, which `sitemap.json` (one `-doc.html` per
// component) does not carry. `activeGroup()`/`buildTabs()`/`buildPageHeader()` read it to render the page-header
// context-label + tab strip, so a component's page-type pages tab between each other for free (SPEC-R10 AC3 —
// the sub-links stay on the tab strip, deliberately NOT folded into the rail). Hrefs are sibling-relative
// (`./x.html`). The site-toc drift gate still scans this array to hold its per-component groups ≡ the fleet.
interface NavLink {
  readonly href: string
  readonly label: string
}
interface NavGroup {
  /** The component label for a per-component cluster; absent for the ungrouped site-level links. */
  readonly label?: string
  readonly links: readonly NavLink[]
}
export const NAV: readonly NavGroup[] = [
  { links: [{ href: './index.html', label: 'Home' }] },
  {
    // The conceptual GUIDE cluster — ungrouped site-level links (no `label:`, hence no site-toc GROUP), the same
    // posture as the A2UI/A2A/meta clusters below: seven independent destinations for a cold-start human
    // consumer, not a fleet component's page-type set. Placed right after Home so a newcomer meets them first.
    links: [
      { href: './getting-started.html', label: 'Getting started' },
      { href: './theming.html', label: 'Theming' },
      { href: './tokens.html', label: 'Tokens' },
      { href: './sizing.html', label: 'Sizing & density' },
      { href: './forms.html', label: 'Forms' },
      { href: './choosing.html', label: 'Which component when' },
      { href: './changelog.html', label: 'Changelog' },
    ],
  },
  {
    label: 'ui-button',
    links: [
      { href: './button-permutations.html', label: 'Permutations' },
      { href: './button-states.html', label: 'States' },
      { href: './button-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-text-field',
    links: [
      { href: './text-field-permutations.html', label: 'Permutations' },
      { href: './text-field-states.html', label: 'States' },
      { href: './text-field-doc.html', label: 'API' },
    ],
  },
  {
    // ADR-0134 — ui-textarea, the multi-line FACE sibling of ui-text-field (tier=control ⇒ the same
    // {permutations, states, doc} set as ui-button/ui-text-field).
    label: 'ui-textarea',
    links: [
      { href: './textarea-permutations.html', label: 'Permutations' },
      { href: './textarea-states.html', label: 'States' },
      { href: './textarea-doc.html', label: 'API' },
    ],
  },
  {
    // The Display-class text primitive — a single descriptor-derived API doc (tier=display ⇒ {doc} only).
    label: 'ui-text',
    links: [{ href: './text-doc.html', label: 'API' }],
  },
  {
    // The Display-class icon primitive (ADR-0065/0066) — a single descriptor-derived API doc + live gallery.
    label: 'ui-icon',
    links: [{ href: './icon-doc.html', label: 'API' }],
  },
  {
    // The Wave M1 chart family (ADR-0107) — two Display-class axis-free charts, each a single descriptor-derived
    // API doc (tier=display ⇒ {doc} only, the ui-text/ui-icon precedent; display leaves are per-component groups).
    label: 'ui-sparkline',
    links: [{ href: './sparkline-doc.html', label: 'API' }],
  },
  {
    label: 'ui-bar-chart',
    links: [{ href: './bar-chart-doc.html', label: 'API' }],
  },
  {
    // The token-surface family (ADR-0118) — three Display-class show-never-edit primitives, each a single
    // descriptor-derived API doc (tier=display ⇒ {doc} only, the ui-sparkline/ui-bar-chart precedent).
    label: 'ui-swatch',
    links: [{ href: './swatch-doc.html', label: 'API' }],
  },
  {
    label: 'ui-ramp',
    links: [{ href: './ramp-doc.html', label: 'API' }],
  },
  {
    label: 'ui-ladder',
    links: [{ href: './ladder-doc.html', label: 'API' }],
  },
  {
    // The Indicator-class form controls (Wave 1, ADR-0041/0042) — per-component groups, tag-labelled (the
    // site-toc rule: control/container/pattern tiers each get ONE ui-{tag} group; only layout bundles).
    label: 'ui-checkbox',
    links: [{ href: './checkbox-doc.html', label: 'API' }],
  },
  {
    label: 'ui-switch',
    links: [{ href: './switch-doc.html', label: 'API' }],
  },
  {
    label: 'ui-radio',
    links: [{ href: './radio-doc.html', label: 'API' }],
  },
  {
    label: 'ui-radio-group',
    links: [
      { href: './radio-group-demo.html', label: 'Demo' },
      { href: './radio-group-doc.html', label: 'API' },
    ],
  },
  {
    // ADR-0095 (supersedes ADR-0086's ui-radio-group[variant='segmented'], hard cutover): the standalone
    // segmented control + its child leaf — tag-labelled, same as every other per-component group.
    label: 'ui-segment',
    links: [{ href: './segment-doc.html', label: 'API' }],
  },
  {
    label: 'ui-segmented-control',
    links: [
      { href: './segmented-control-demo.html', label: 'Demo' },
      { href: './segmented-control-doc.html', label: 'API' },
    ],
  },
  {
    // The Range-class controls (Wave 2, ADR-0042) — per-component indicator-tier groups, tag-labelled.
    label: 'ui-slider',
    links: [{ href: './slider-doc.html', label: 'API' }],
  },
  {
    label: 'ui-slider-multi',
    links: [{ href: './slider-multi-doc.html', label: 'API' }],
  },
  {
    // The layout primitives share one tier showcase (overview + surface×layout) + a per-component API doc each.
    label: 'Layout primitives',
    links: [
      { href: './layout-overview.html', label: 'Overview' },
      { href: './layout-permutations.html', label: 'Surface × layout' },
      { href: './row-doc.html', label: 'row' },
      { href: './column-doc.html', label: 'column' },
      { href: './list-doc.html', label: 'list' },
      { href: './grid-doc.html', label: 'grid' },
      // ui-toast-region (ADR-0112, tier=layout) folds into this bundle rather than growing its own group —
      // the site-toc editorial rule (a new layout primitive joins the existing showcase, never a 5th group).
      { href: './toast-region-doc.html', label: 'toast-region' },
      // ui-split / ui-split-pane (ADR-0120 cl.2, app-surfaces-m4.lld.md LLD-C1) — same fold, tier=layout.
      { href: './split-doc.html', label: 'split' },
      { href: './split-pane-doc.html', label: 'split-pane' },
    ],
  },
  {
    label: 'ui-card',
    links: [
      { href: './card-demo.html', label: 'Demo' },
      { href: './card-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-tabs',
    links: [
      { href: './tabs-demo.html', label: 'Demo' },
      { href: './tabs-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-modal',
    links: [
      { href: './modal-demo.html', label: 'Demo' },
      { href: './modal-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-toolbar',
    links: [
      { href: './toolbar-demo.html', label: 'Demo' },
      { href: './toolbar-doc.html', label: 'API' },
    ],
  },
  {
    // The Overlay family (Wave 4, ADR-0043) — tier=pattern controls on the overlay controller, each a per-component
    // ui-{tag} group with a live interaction Demo + a descriptor-derived API doc (the site-toc pattern-tier rule).
    label: 'ui-popover',
    links: [
      { href: './popover-demo.html', label: 'Demo' },
      { href: './popover-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-tooltip',
    links: [
      { href: './tooltip-demo.html', label: 'Demo' },
      { href: './tooltip-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-menu',
    links: [
      { href: './menu-demo.html', label: 'Demo' },
      { href: './menu-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-select',
    links: [
      { href: './select-demo.html', label: 'Demo' },
      { href: './select-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-combo-box',
    links: [
      { href: './combo-box-demo.html', label: 'Demo' },
      { href: './combo-box-doc.html', label: 'API' },
    ],
  },
  {
    // ADR-0125 — the CMD-K command palette: nests ui-modal + re-derives the combo-box active-descendant filter.
    // Permanently catalog-excluded (app-owner launcher chrome, F8) — still a site-documented fleet member.
    label: 'ui-command-modal',
    links: [
      { href: './command-modal-demo.html', label: 'Demo' },
      { href: './command-modal-doc.html', label: 'API' },
    ],
  },
  // Picker controls — Wave 5B (ADR-0048): standalone date picker + future type=date overlay body.
  {
    label: 'ui-calendar',
    links: [
      { href: './calendar-demo.html', label: 'Demo' },
      { href: './calendar-doc.html', label: 'API' },
    ],
  },
  // ADR-0123 — the OKLCH-internal 2-axis color-input control; also the popup body for ui-text-field
  // type=color (lazily imported there, the ADR-0048 type=date seam verbatim).
  {
    label: 'ui-color-picker',
    links: [
      { href: './color-picker-demo.html', label: 'Demo' },
      { href: './color-picker-doc.html', label: 'API' },
    ],
  },
  // The G7 form-composition family (ADR-0050/0051) — the field wrapper + the coordination provider, each a
  // per-component container group (Demo + API), the site-toc container-tier rule.
  {
    label: 'ui-field',
    links: [
      { href: './field-demo.html', label: 'Demo' },
      { href: './field-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-form-provider',
    links: [
      { href: './form-provider-demo.html', label: 'Demo' },
      { href: './form-provider-doc.html', label: 'API' },
    ],
  },
  // ADR-0117 — the promoted theming subtree provider, a pure coordination/carrier primitive (tier=container,
  // the same {doc, demo} shape as ui-form-provider above).
  {
    label: 'ui-theme-provider',
    links: [
      { href: './theme-provider-demo.html', label: 'Demo' },
      { href: './theme-provider-doc.html', label: 'API' },
    ],
  },
  // The Wave M1 report family (ADR-0111) — three Display-class descriptor-derived API docs (tier=display ⇒
  // {doc} only, the ui-text/ui-icon/chart precedent).
  {
    label: 'ui-table',
    links: [{ href: './table-doc.html', label: 'API' }],
  },
  {
    label: 'ui-stat',
    links: [{ href: './stat-doc.html', label: 'API' }],
  },
  {
    label: 'ui-badge',
    links: [{ href: './badge-doc.html', label: 'API' }],
  },
  // The Wave M1 content family (ADR-0113) — ui-code (tier=display ⇒ {doc} only) + ui-disclosure (tier=pattern
  // ⇒ {doc, demo}, the tooltip/popover precedent).
  {
    label: 'ui-code',
    links: [{ href: './code-doc.html', label: 'API' }],
  },
  {
    label: 'ui-disclosure',
    links: [
      { href: './disclosure-demo.html', label: 'Demo' },
      { href: './disclosure-doc.html', label: 'API' },
    ],
  },
  // The Wave M1 feed family (ADR-0112) — progress/attachment (display) + avatar (indicator) are {doc} only;
  // toast (pattern) gets {doc, demo}; toast-region (layout) folds into the Layout primitives bundle below.
  {
    label: 'ui-progress',
    links: [{ href: './progress-doc.html', label: 'API' }],
  },
  {
    label: 'ui-avatar',
    links: [{ href: './avatar-doc.html', label: 'API' }],
  },
  {
    label: 'ui-attachment',
    links: [{ href: './attachment-doc.html', label: 'API' }],
  },
  {
    label: 'ui-toast',
    links: [
      { href: './toast-demo.html', label: 'Demo' },
      { href: './toast-doc.html', label: 'API' },
    ],
  },
  // ADR-0122 — the timeline family: the shared marker-system rail row (ui-timeline-item), its durable
  // authored-children host (ui-timeline), and its live imperatively-fed sibling (ui-status-stream).
  {
    label: 'ui-timeline-item',
    links: [
      { href: './timeline-item-demo.html', label: 'Demo' },
      { href: './timeline-item-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-timeline',
    links: [
      { href: './timeline-demo.html', label: 'Demo' },
      { href: './timeline-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-status-stream',
    links: [
      { href: './status-stream-demo.html', label: 'Demo' },
      { href: './status-stream-doc.html', label: 'API' },
    ],
  },
  // ADR-0124 — the ui-swiper family: a CSS-native scroll-snap carousel. ui-swiper-item (tier=layout) folds
  // into the Layout primitives bundle (no group of its own, the ui-toast-region/ui-split-pane precedent);
  // the three pattern/display chrome tags (pagination/paddles/label) each get their own group.
  {
    label: 'ui-swiper',
    links: [
      { href: './swiper-demo.html', label: 'Demo' },
      { href: './swiper-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-swiper-pagination',
    links: [
      { href: './swiper-pagination-demo.html', label: 'Demo' },
      { href: './swiper-pagination-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-swiper-paddles',
    links: [
      { href: './swiper-paddles-demo.html', label: 'Demo' },
      { href: './swiper-paddles-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-swiper-label',
    links: [{ href: './swiper-label-doc.html', label: 'API' }],
  },
  {
    // The application-frame primitive (@agent-ui/app, ADR-0082/0083/0084). A GUIDE page, not a fleet component
    // in components/src — so it is an ungrouped site-level link (no `label:`, hence no site-toc GROUP), exactly
    // like the A2UI pages below; site-coverage/site-toc derive their fleet from components/src and never expect
    // an `app-shell-{type}.html` set for it.
    links: [{ href: './app-shell.html', label: 'App Shell' }],
  },
  {
    // ui-super-shell (@agent-ui/app, M5 — ADR-0151/shell-archetypes-m5.spec.md, GH #83/#84). The SAME
    // ungrouped-site-level-link posture as App Shell just above.
    links: [{ href: './super-shell.html', label: 'Super Shell' }],
  },
  {
    // ui-chat-shell (@agent-ui/app, M5 round 4 — GH #98; shell-archetypes-m5.lld.md LLD-C6). The SAME
    // ungrouped-site-level-link posture as App Shell/Super Shell just above.
    links: [{ href: './chat-shell.html', label: 'Chat Shell' }],
  },
  {
    // ui-master-detail (@agent-ui/app, ADR-0120 cl.3a; app-surfaces-m4.lld.md LLD-C10, M4 Phase 2) — the
    // SAME ungrouped-site-level-link posture as App Shell just above: a GUIDE page for an app-tier
    // composition, not a fleet component in components/src.
    links: [{ href: './master-detail.html', label: 'Master Detail' }],
  },
  {
    // ui-settings (@agent-ui/app, ADR-0120 cl.4; app-surfaces-m4.lld.md LLD-C12, M4 Phase 3) — the SAME
    // ungrouped-site-level-link posture as App Shell/Master Detail just above: a GUIDE page for an app-tier
    // composition, not a fleet component in components/src.
    links: [{ href: './settings.html', label: 'Settings' }],
  },
  {
    // @agent-ui/router (LLD-C10b, SPEC-R8) — another package above components on the DAG, same posture as
    // App Shell just above: a GUIDE page for a package, not a fleet component in components/src, so it is an
    // ungrouped site-level link — site-coverage/site-toc/site-canon (all components/src-scoped) never expect a
    // `router-{type}.html` per-component set for it.
    links: [{ href: './router-doc.html', label: 'Router' }],
  },
  {
    // @agent-ui/code/editor (ui-code-editor, ADR-0139) — the SAME ungrouped-site-level-link posture as Router
    // just above: a GUIDE page for an opt-in subpath outside components/src, not a fleet component in it.
    links: [{ href: './code-editor-doc.html', label: 'Code Editor' }],
  },
  {
    // @agent-ui/code/markdown (ui-markdown, ADR-0119 fork F4) — the SAME posture as Code Editor just above:
    // a real tagged element outside components/src, so ungrouped here even though TKT-0095's L1_TREES fix
    // already promotes it to a real Components entry in the sitemap-derived left rail.
    links: [{ href: './markdown-doc.html', label: 'Markdown' }],
  },
  {
    // @agent-ui/code/highlight (ADR-0119) — no tagged element at all (a registry + 7 tokenizers), the SAME
    // ungrouped-site-level-link posture as Router: a GUIDE page for a package, not a fleet component.
    links: [{ href: './highlight-doc.html', label: 'Highlight' }],
  },
  {
    // ui-agent-admin (@agent-ui/app, TKT-0039/ADR-0131) — the SAME ungrouped-site-level-link posture as
    // App Shell/Master Detail/Settings just above: a GUIDE page for an app-tier composition (ui-split +
    // ui-settings + ui-conversation), not a fleet component in components/src.
    links: [{ href: './agent-admin.html', label: 'Agent Admin' }],
  },
  {
    links: [
      { href: './a2ui-canvas.html', label: 'A2UI Canvas' },
      { href: './a2ui-catalog.html', label: 'A2UI Catalog' },
      { href: './a2ui-list.html', label: 'A2UI Dynamic List' },
      { href: './a2ui-form.html', label: 'A2UI Generative Form' },
      { href: './a2ui-patterns.html', label: 'A2UI Patterns' },
      { href: './a2ui-gallery.html', label: 'A2UI Gallery' },
      { href: './a2ui-stream.html', label: 'A2UI Streaming' },
      { href: './a2ui-live.html', label: 'A2UI Live Agent' },
      { href: './a2ui-chat.html', label: 'A2UI Chat' },
      { href: './a2ui-authoring.html', label: 'A2UI Authoring Guide' },
    ],
  },
  {
    // The A2A cluster — ungrouped site-level links, same posture as the A2UI cluster above (independent
    // destinations, not a fleet component's page-type set). The arena (LLD-C11, a2a-tic-tac-toe.lld.md), the
    // corpus-derived concepts/demos section (corpus LLD-C12, a2a-corpus-docs.lld.md), and the A2UI-over-A2A
    // artifact feed (LLD-C7, a2a-a2ui-bridge.lld.md, B6) sit together.
    links: [
      { href: './a2a-tic-tac-toe.html', label: 'A2A Tic-Tac-Toe Arena' },
      { href: './a2a-concepts.html', label: 'A2A Concepts & Demos' },
      { href: './a2a-artifact-feed.html', label: 'A2A Artifact Feed' },
    ],
  },
  {
    // Site-level meta pages (ungrouped — no component label, so not a fleet TOC group per site-toc.test.ts).
    // The gallery (ADR-0079) joins here too: it is docs meta-infra composing every control, not itself a
    // fleet component, so it carries no per-component label/tab-strip group.
    links: [
      { href: './adr-index.html', label: 'Decision Records' },
      { href: './gallery.html', label: 'Gallery' },
    ],
  },
]

// ── the sitemap-derived browse rail source (mode-1, SPEC-R10) ────────────────────────────────────────────────
// One rail entry per sitemap.json entry, grouped by the sitemap's own `section` axis. The derivation INVERTED
// (TKT-0029): the rail reads the build-time index, not the hand array. `section` is exactly the sitemap's field
// today — Components (56 L1, name|tag rows) / Guides (25 L2) / Records (the ADR index) — no curated re-grouping.
interface SitemapEntry {
  readonly name: string
  readonly tag?: string
  readonly url: string
  readonly section: string
}

// dedupeByUrl — collapse entries that resolve to the SAME page (the sitemap lists `changelog.html` under both
// the Guides L2 and the Records L3 rows); the rail lists each destination once, first occurrence winning.
function dedupeByUrl(entries: readonly SitemapEntry[]): SitemapEntry[] {
  const seen = new Set<string>()
  const out: SitemapEntry[] = []
  for (const entry of entries) {
    const url = entry.url.split('#')[0]
    if (seen.has(url)) continue
    seen.add(url)
    out.push({ ...entry, url })
  }
  return out
}

// EXPORTED so the cross-engine nav smoke (site-nav.browser.test.ts) re-derives its expected rail-entry count
// from the SAME source the rail is built from — the sitemap, never `NAV.length` (the derivation inverted): the
// rendered `<a>` count must equal the unique-url entry count, so the rail can't silently drop/duplicate an entry
// AND the gate never re-drifts as the fleet grows.
export const SITE_NAV_ENTRIES: readonly SitemapEntry[] = dedupeByUrl(sitemapData.entries as SitemapEntry[])

// isCurrent — is this link the page we are on? Compare resolved pathnames, treating the site root (`/`) as
// `index.html` so Home highlights on the landing. Marks the active link with `aria-current="page"`.
function isCurrent(href: string): boolean {
  const target = new URL(href, location.href).pathname
  const normalize = (path: string): string => (path.endsWith('/') ? `${path}index.html` : path)
  return normalize(location.pathname) === normalize(target)
}

// activeGroup — the NAV group whose links contain the current page. The page-header derives its context-label
// (the group's component name) and its tab strip (the group's page-type links) from this, so a component's
// pages tab between one another with no per-page wiring. Undefined on the ungrouped site-level links.
function activeGroup(): NavGroup | undefined {
  return NAV.find((group) => group.links.some((link) => isCurrent(link.href)))
}

// buildNav — the shared cross-page browse rail, a real `ui-nav-rail` (ADR-0130, the mode-1 consumer) fed
// from `sitemap.json`. It renders its grouped vertical anatomy at EVERY band — one `ui-nav-rail-group` per
// sitemap `section`, its context-label the section name, each item a real `<a>` with the proper name at the
// leading edge and (for the tag-bearing Components) the tag right-justified in the trailing `data-role="tag"`
// cell (SPEC-R6's name|tag row). Narrow is now the SHELL's job (GH #170/ADR-0155): the ui-super-shell hides
// this whole pane below the 52.5rem compact line and toggle-restores it as an overlay, so the rail's own
// `collapse="menu"` dropdown + `collapse-container="ancestor"` arrangement (TKT-0035) RETIRE for this
// consumer. The rail's active indicator keys off the `selected` item — the current page, or,
// on a component's sub-page (Permutations/States/API), that component's own doc entry so the rail still shows
// where you are while the tab strip carries the sub-pages. Role derivation (all items href-bearing) makes the
// rail a `navigation` landmark and stamps `aria-current="page"` on the active link — the primitive's own job.
function buildNav(): HTMLElement {
  const rail = document.createElement('ui-nav-rail')
  // GH #170 / ADR-0155 — `collapse="none"`: the rail renders its FULL vertical anatomy at every band. The
  // shell's own compact/narrow overlay (collapse-band="compact" + narrow-start="collapse" on the shell)
  // owns the narrow story now, so the rail's own `collapse="menu"` dropdown + its TKT-0035
  // `collapse-container="ancestor"` arrangement RETIRE for this consumer (`ui-nav-rail` keeps the
  // capability via its other collapse modes — only the site opts into `none`).
  rail.setAttribute('collapse', 'none')
  rail.setAttribute('data-site-nav', '') // the shell's scroll hook (_page.css); NOT the rail's own anatomy
  rail.setAttribute('aria-label', 'Site')

  // On a component's sub-page the exact URL is not in the sitemap (only its `-doc.html` is), so map the active
  // NAV group (the tab-strip residue) to that component's doc URL and mark IT selected — the rail stays oriented.
  const active = activeGroup()
  const activeDocUrl = active?.label?.startsWith('ui-') ? `./${active.label.slice('ui-'.length)}-doc.html` : undefined
  const isSelected = (url: string): boolean => isCurrent(url) || url === activeDocUrl

  // Group by the sitemap's `section`, preserving first-seen section + item order (a Map keeps insertion order).
  const bySection = new Map<string, SitemapEntry[]>()
  for (const entry of SITE_NAV_ENTRIES) {
    const list = bySection.get(entry.section) ?? []
    list.push(entry)
    bySection.set(entry.section, list)
  }

  for (const [section, entries] of bySection) {
    const group = document.createElement('ui-nav-rail-group')
    group.setAttribute('label', section) // the context-label (SPEC-R6)
    for (const entry of entries) {
      const item = document.createElement('ui-nav-rail-item')
      item.setAttribute('href', entry.url) // link-shaped ⇒ real navigation + aria-current on the active one
      if (isSelected(entry.url)) item.setAttribute('selected', '')
      item.append(document.createTextNode(entry.name)) // the proper name (leading edge)
      if (entry.tag) {
        // The wide name|tag row: the tag right-justified in the trailing tag cell; narrow it truncates (ellipsis).
        const tag = document.createElement('span')
        tag.setAttribute('slot', 'trailing')
        tag.setAttribute('data-role', 'tag')
        tag.textContent = entry.tag
        item.append(tag)
      }
      group.append(item)
    }
    rail.append(group)
  }
  return rail
}

// ── the app chrome frame (right column, rows 1 & 3) ──────────────────────────────────────────────────────
// The non-scrolling top-bar + footer that bracket the page scroll region. CSS-only placeholders today (an
// app-shell component family will own these later). Their CONTENT defaults are chosen here, not per page.

// SCHEME_CYCLE — the compact toggle's three-state ring (ADR-0117's unset='' IS "Auto": it tracks the OS/an
// ancestor, never re-mapped to a literal 'light'). Order chosen so a first click from the untouched default
// reaches Light before Dark — the more common explicit override.
const SCHEME_CYCLE: readonly SchemeId[] = ['', 'light', 'dark']
const SCHEME_LABEL: Record<SchemeId, string> = { '': 'Auto', light: 'Light', dark: 'Dark' }

/** The real Theme control (TKT-0088/ADR-0141 cl.4/5) — a scheme-cycle button + a theme `ui-menu` picker,
 *  both wired to `provider` (the shell's own `ui-theme-provider`, ADR-0141 cl.1) via `theme-loader.ts`.
 *  Mounts already showing the PERSISTED choice (no flash of the default before JS settles — the provider
 *  itself was already set from the same persisted values at shell-creation time, below; this control just
 *  reads that same state back for its own initial label). */
function buildThemeControl(provider: UIThemeProviderElement): HTMLElement {
  const group = document.createElement('div')
  group.className = 'app-context-theme-group'

  // ── the scheme-cycle button ──────────────────────────────────────────────────────────────────────────
  const schemeBtn = document.createElement('ui-button') as UIButtonElement
  schemeBtn.setAttribute('variant', 'soft')
  let scheme = loadPersistedScheme()
  const renderScheme = (): void => {
    schemeBtn.textContent = SCHEME_LABEL[scheme]
  }
  renderScheme()
  schemeBtn.addEventListener('click', () => {
    const next = SCHEME_CYCLE[(SCHEME_CYCLE.indexOf(scheme) + 1) % SCHEME_CYCLE.length] as SchemeId
    scheme = next
    applyScheme(provider, scheme)
    persistScheme(scheme)
    renderScheme()
  })
  group.append(schemeBtn)

  // ── the theme picker (the composer's #buildPicker idiom — a pill trigger + ui-menu) ─────────────────
  const trigger = document.createElement('ui-button') as UIButtonElement
  trigger.setAttribute('variant', 'soft')
  const menu = document.createElement('ui-menu') as UIMenuElement
  menu.dataset.part = 'theme-menu'
  menu.append(trigger)
  group.append(menu)
  trigger.setAttribute('data-picker', 'theme') // set AFTER append — ui-menu's own connected() re-tags the trigger's data-part

  let currentTheme = loadPersistedTheme()
  const renderTrigger = (): void => {
    trigger.textContent = THEME_OPTIONS.find((o) => o.id === currentTheme)?.label ?? 'Default'
  }
  renderTrigger()

  const populate = (): void => {
    const panel = menu.querySelector('[data-part="panel"]')
    if (!panel) return // still not connected — should be unreachable past the microtask deferral below
    panel.replaceChildren()
    for (const option of THEME_OPTIONS) {
      const item = document.createElement('div')
      item.setAttribute('role', 'menuitem')
      item.setAttribute('tabindex', option.id === currentTheme ? '0' : '-1')
      item.dataset.value = option.id
      item.textContent = option.label
      item.toggleAttribute('data-selected', option.id === currentTheme)
      panel.append(item)
    }
  }
  // `menu` builds its own [data-part="panel"] inside ui-menu's connected() — which hasn't run yet at this
  // point in construction (this whole header is still detached; `mountPage` appends the shell to the
  // document synchronously AFTER this function returns). A microtask runs after that synchronous append
  // completes, so by the time `populate()` actually executes, `menu` is guaranteed connected — no retry
  // loop, no polling.
  queueMicrotask(populate)

  menu.addEventListener('select', (e) => {
    const id = (e as CustomEvent<{ value: string }>).detail.value as (typeof THEME_OPTIONS)[number]['id']
    currentTheme = id
    renderTrigger()
    const panel = menu.querySelector('[data-part="panel"]')
    if (panel) for (const child of panel.children) child.toggleAttribute('data-selected', (child as HTMLElement).dataset.value === id)
    void applyTheme(provider, id)
    persistTheme(id)
  })

  return group
}

// buildContextHeader — the app top-bar (right column, row 1, fixed): the app wordmark (a Home link) + a
// placeholder region for app-level chrome. `Search` is now a REAL button opening the already-mounted
// `ui-command-modal` (TKT-0018's own palette, `mountCommandPaletteOnce` below — the mod+k hotkey's own
// affordance, made clickable too); `Theme` is the REAL scheme+theme control above, wired to `provider`
// (TKT-0088/ADR-0141 cl.4/5 — the shell's own ui-theme-provider, created by the caller).
function buildContextHeader(provider: UIThemeProviderElement): HTMLElement {
  const bar = document.createElement('header')
  bar.className = 'app-context-header'

  const brand = document.createElement('a')
  brand.className = 'app-brand'
  brand.href = './index.html'
  brand.textContent = 'agent-ui'
  bar.append(brand)

  const actions = document.createElement('div')
  actions.className = 'app-context-actions'
  const search = document.createElement('ui-button') as UIButtonElement
  search.setAttribute('variant', 'soft')
  search.textContent = 'Search'
  // Lazy import — same module `mountCommandPaletteOnce` already pulled in at shell-build time (below),
  // so this resolves from the browser's own module cache, not a second network fetch; keeps the "a page
  // that never opens the palette pays no bundle cost" discipline intact for this call site too.
  search.addEventListener('click', () => {
    void import('../lib/command-palette.ts').then((m) => m.openCommandPalette())
  })
  actions.append(search, buildThemeControl(provider))
  bar.append(actions)
  return bar
}

// buildContextFooter — the app footer (right column, row 3, fixed): a slim placeholder app-level line. The bar
// itself spans the column edge-to-edge (background + top divider); its CONTENT sits in an inner wrapper pinned to
// the SAME reading column as `.page-header-inner` / `[data-page-content]`, so header, content, and footer read as
// one column rather than the line floating at a different inset from the page body.
function buildContextFooter(): HTMLElement {
  const footer = document.createElement('footer')
  footer.className = 'app-context-footer'
  const inner = document.createElement('div')
  inner.className = 'app-context-footer-inner'
  const line = document.createElement('span')
  line.textContent = 'agent-ui — zero-dependency, signals-based web components · docs shell placeholder'
  inner.append(line)
  footer.append(inner)
  return footer
}

// ── the page header / footer (the row-2 scroll region's sticky brackets) ─────────────────────────────────

// buildTabs — the page-header tab strip: a `<nav class="page-tabs">` of the component's page-type links, the
// current page flagged with `aria-current`. Defaults to the active NAV group's links, so the component's pages
// tab between each other for free; an explicit `tabs` option overrides.
function buildTabs(tabs: readonly NavLink[]): HTMLElement {
  const nav = document.createElement('nav')
  nav.className = 'page-tabs'
  nav.setAttribute('aria-label', 'Section')
  const list = document.createElement('ul')
  for (const tab of tabs) {
    const item = document.createElement('li')
    const anchor = document.createElement('a')
    anchor.href = tab.href
    anchor.textContent = tab.label
    if (isCurrent(tab.href)) anchor.setAttribute('aria-current', 'page')
    item.append(anchor)
    list.append(item)
  }
  nav.append(list)
  return nav
}

// buildCta — the page-header primary action: a styled link rendered to read as a button (CSS-only; no ui-*
// control yet). Optional — only the pages that pass a `cta` get one.
function buildCta(cta: PageCta): HTMLElement {
  const anchor = document.createElement('a')
  anchor.className = 'page-cta'
  anchor.href = cta.href
  anchor.textContent = cta.label
  return anchor
}

/**
 * pageLead — a lead paragraph for the page BODY (the first child of the content region), NOT the sticky header.
 * Pages that keep the sticky header lean (heading only) put their descriptive copy here instead, so it scrolls
 * away with the content rather than permanently pinning a tall block above the scroll region. Plain text
 * (textContent), matching the header `page-description` it replaces.
 */
export function pageLead(text: string): HTMLElement {
  const p = document.createElement('p')
  p.className = 'page-lead'
  p.textContent = text
  return p
}

// buildPageHeader — the STICKY page header (top of the row-2 scroll region): the regions context-label ·
// heading (the <h1>) · description (the lead <p>) · tab strip · CTA. The context-label + tabs AUTO-DERIVE from
// the active NAV group, so a page that passes only `{ title, intro }` still gets a correct header; `contextLabel`
// / `tabs` / `cta` override or add. Only a LABELED component group renders a tab strip (its page-types); an
// ungrouped site-level cluster (Home, the A2UI pages, the ADR index) does NOT — those are independent
// destinations, not views of one subject (the left rail already lists each directly).
function buildPageHeader(options: PageOptions): HTMLElement {
  const group = activeGroup()

  const header = document.createElement('header')
  header.className = 'page-header'
  const inner = document.createElement('div')
  inner.className = 'page-header-inner'

  const contextLabel = options.contextLabel ?? group?.label
  if (contextLabel) {
    const label = document.createElement('span')
    label.className = 'page-context-label'
    label.textContent = contextLabel
    inner.append(label)
  }

  const headingRow = document.createElement('div')
  headingRow.className = 'page-heading-row'
  const heading = document.createElement('h1')
  heading.className = 'page-heading'
  heading.textContent = options.title
  headingRow.append(heading)
  if (options.cta) headingRow.append(buildCta(options.cta))
  inner.append(headingRow)

  if (options.intro) {
    const description = document.createElement('p')
    description.className = 'page-description'
    description.textContent = options.intro
    inner.append(description)
  }

  // Tabs are page-TYPES of ONE subject — a LABELED component group (Permutations/States/API of ui-button). An
  // UNGROUPED site-level cluster (the A2UI pages, the ADR index) is independent destinations, not views of one
  // thing, so it gets NO default tab strip — the left rail already lists each; an explicit `options.tabs` wins.
  const tabs: readonly NavLink[] | undefined = options.tabs ?? (group?.label ? group.links : undefined)
  if (tabs && tabs.length >= 2) inner.append(buildTabs(tabs))

  header.append(inner)
  return header
}

// buildPageFooter — the STICKY page footer (bottom of the row-2 scroll region): a slim placeholder page-level
// bar (prev/next or actions land here later). Inert spans for now.
function buildPageFooter(): HTMLElement {
  const footer = document.createElement('footer')
  footer.className = 'page-footer'
  const inner = document.createElement('div')
  inner.className = 'page-footer-inner'
  for (const [cls, text] of [['page-footer-prev', '← Previous'], ['page-footer-next', 'Next →']] as const) {
    const span = document.createElement('span')
    span.className = cls
    span.textContent = text
    inner.append(span)
  }
  footer.append(inner)
  return footer
}

/** The page-header tab strip entry shape — a label + a sibling-relative href (see NAV). */
export interface PageTab {
  readonly href: string
  readonly label: string
}

/** The page-header primary action (a styled link). */
export interface PageCta {
  readonly label: string
  readonly href: string
}

export interface PageOptions {
  /** The page <h1> (the page-heading region). */
  readonly title: string
  /** Optional lead paragraph (the page-description region). */
  readonly intro?: string
  /** The page-context-label. DEFAULT: the active NAV group's component label. */
  readonly contextLabel?: string
  /** The page-tabs strip. DEFAULT: the active NAV group's page-type links (suppressed for a single-link group). */
  readonly tabs?: readonly PageTab[]
  /** Optional page-header primary-action button. */
  readonly cta?: PageCta
}

// mountCommandPaletteOnce — the ui-command-modal search palette (TKT-0018, site-command-search.lld.md LLD-C6),
// lazily import()ed so a page that never opens it (mod+k) pays no bundle cost beyond this stub call — the
// text-field type=date -> ui-calendar lazy-import precedent. Called from BOTH mountPage and
// mountFullBleedPage, so every /site page gets exactly one instance; the module itself guards re-entry
// (command-palette.ts's `if (current) return`) in case a page somehow calls both in one load.
function mountCommandPaletteOnce(): void {
  // `.catch` is load-bearing, not defensive filler: a jsdom page-mount test (no real network/base URL) or a
  // real `sitemap.json` fetch failure must never surface as an unhandled rejection off page mount — the
  // palette is optional site chrome, not a page's own render path.
  void import('../lib/command-palette.ts')
    .then((m) => m.mountCommandPalette())
    .catch(() => {})
}

// buildThemedShell — TKT-0088/ADR-0141 cl.1/5: the shell's root IS the site-wide `ui-theme-provider` (a
// tag swap from the old plain `<div class="app-shell">` — `.app-shell`'s own CSS is entirely class-keyed,
// never tag-keyed, so nothing else moves). Applies the PERSISTED scheme/theme synchronously at creation,
// before the shell ever paints, so a reload never flashes the default before JS catches up — `applyTheme`
// for a non-default persisted choice is genuinely async (its pack must load), an accepted one-time cost
// the ticket's own acceptance criteria names ("first selection injects the pack CSS once"). Shared by
// `mountPage`/`mountFullBleedPage` so the provider-setup logic has exactly one home.
function buildThemedShell(page: HTMLElement): UIThemeProviderElement {
  const provider = document.createElement('ui-theme-provider') as UIThemeProviderElement
  provider.className = 'app-shell'
  applyScheme(provider, loadPersistedScheme())
  void applyTheme(provider, loadPersistedTheme())
  // M5 / GH #84 — the CSS-grid placeholder chrome retired: the frame is now a real `ui-super-shell`
  // (shell-archetypes-m5.spec.md). Region builders are UNCHANGED; they just declare their slot —
  // header full-width (the wireframe's own shape), the ui-nav-rail as the nav-pane, the page region as
  // the canvas, the footer as permanent chrome. The provider stays the ROOT (tokens live there,
  // ADR-0141 unchanged); GH #170/ADR-0155 retired its old ui-nav-rail-collapse named container.
  const shell = document.createElement('ui-super-shell') as HTMLElement & { collapsedStart: boolean }
  shell.className = 'site-shell'
  // GH #170 / ADR-0155 — the nav story moves from `stack` to OVERLAY: below the 52.5rem compact-window
  // line the nav pane hides and the header's menu toggle restores it as an overlay (X glyph, scrim/Escape
  // dismiss, full vertical rail inside the pane). `collapse-band="compact"` selects that line (ADR-0150's
  // number); `narrow-start="collapse"` picks the overlay arm. `nav` is authored FIRST (below) — the
  // DOM-first ("start") side, per LLD-C4/GH #95 (this site is LTR-only prose, so start == physical left).
  shell.setAttribute('narrow-start', 'collapse')
  shell.setAttribute('collapse-band', 'compact')
  const header = buildContextHeader(provider)
  header.setAttribute('data-slot', 'header')
  const nav = buildNav()
  nav.setAttribute('data-slot', 'nav-pane')
  page.setAttribute('data-slot', 'content')
  const footer = buildContextFooter()
  footer.setAttribute('data-slot', 'footer')
  shell.append(header, nav, page, footer)
  // SPEC-R2d — the collapse choice persists across navigations (the "collapsible menus" ask): restore
  // BEFORE first paint, persist on every flip (attribute observation — the reflected state IS the API).
  try {
    if (localStorage.getItem('agent-ui.site.nav-collapsed') === 'true') shell.collapsedStart = true
  } catch { /* storage unavailable — session-only state */ }
  new MutationObserver(() => {
    try {
      localStorage.setItem('agent-ui.site.nav-collapsed', String(shell.hasAttribute('collapsed-start')))
    } catch { /* ignore */ }
  }).observe(shell, { attributes: true, attributeFilter: ['collapsed-start'] })
  provider.append(shell)
  return provider
}

// mountPage — stamp the app shell into `#app` (falling back to <body>) and hand back the page-content container.
// The shell is a CSS grid (`_page.css`): a full-height nav RAIL down the left, and a right column of
// [ context-header | page | context-footer ]. The PAGE (row 2) is the scroll region — itself
// [ sticky page-header | page-content | sticky page-footer ]. `data-page-content` is the returned <main>, so a
// page's body code is unchanged. Framework-free: plain light-DOM + the self-defining ui-* controls imported above.
export function mountPage(options: PageOptions): PageHandle {
  const root = document.querySelector('#app') ?? document.body

  const content = document.createElement('main')
  content.setAttribute('data-page-content', '')

  const page = document.createElement('div')
  page.className = 'app-page'
  page.append(buildPageHeader(options), content, buildPageFooter())

  root.append(buildThemedShell(page))
  mountCommandPaletteOnce()
  return { content }
}

// mountFullBleedPage — the FULL-BLEED page variant. Same app shell (nav rail · context-header · context-footer),
// but the PAGE region (row 2) is handed wholesale to the page: NO sticky page-header / page-footer, and the
// content fills `.app-page` edge-to-edge (no centered reading column) and scrolls its OWN inner regions. For a
// page that owns its in-region layout end to end — the A2UI gen-UI canvas, a 3-region view that scrolls inside
// itself. The `.app-page--full-bleed` modifier (see _page.css) drops the centered-column constraint; the page's
// own CSS owns the inner layout. Returns the same PageHandle, so a page's body code is unchanged.
export function mountFullBleedPage(): PageHandle {
  const root = document.querySelector('#app') ?? document.body

  const content = document.createElement('main')
  content.setAttribute('data-page-content', '')

  const page = document.createElement('div')
  page.className = 'app-page app-page--full-bleed'
  page.append(content) // no sticky page-header / page-footer — the page owns the whole region

  root.append(buildThemedShell(page))
  mountCommandPaletteOnce()
  return { content }
}
