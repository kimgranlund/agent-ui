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
// SHELL NOTE — the outer frame is a real `ui-super-shell` (M5/GH #84, `buildThemedShell` below); the
// per-page sticky header/footer stays `_page.css` grid + sticky and the structure below. The LEFT NAV RAIL
// is no longer hand-rolled: it is now a real `ui-nav-rail` (ADR-0130, the mode-1 consumer of the shared
// nav-rail family), fed from `sitemap.json` and hidden/overlaid at narrow by the shell itself
// (GH #170/ADR-0155 — no rail-owned `collapse="menu"` dropdown here). The top-bar / footer CONTENT stays
// site-built chrome slotted into that frame, the same way the pages already dogfood ui-button / ui-text-field.
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
import { siteStorage } from '../lib/site-storage.ts'

// The nav-collapse flag's key under `siteStorage`'s `agent-ui` namespace — the stored localStorage key
// is `agent-ui.site.nav-collapsed`, byte-identical to the pre-GH-#1544 hand-rolled one.
const NAV_COLLAPSED_KEY = 'site.nav-collapsed'

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
    // posture as the A2UI/A2A/meta clusters below: independent destinations for a cold-start human consumer,
    // not a fleet component's page-type set. Placed right after Home so a newcomer meets them first.
    links: [
      { href: './getting-started.html', label: 'Getting started' },
      { href: './accessibility.html', label: 'Accessibility' },
      { href: './testing-guide.html', label: 'Testing guide' },
      { href: './theming.html', label: 'Theming' },
      { href: './tokens.html', label: 'Tokens' },
      { href: './sizing.html', label: 'Sizing & density' },
      { href: './forms.html', label: 'Forms' },
      { href: './credentials.html', label: 'Registration & sign in' },
      { href: './magic-link.html', label: 'Magic link sign in' },
      { href: './otp-signin.html', label: 'One-time code sign in' },
      { href: './social-signin.html', label: 'Social sign in' },
      { href: './onboarding.html', label: 'Onboarding' },
      { href: './account-settings.html', label: 'Account settings' },
      { href: './composition.html', label: 'Composition patterns' },
      { href: './onboarding-checklist.html', label: 'Onboarding checklist' },
      { href: './card-grid-drawer.html', label: 'Card grid + drawer edit' },
      { href: './toc-content.html', label: 'Sticky TOC content layout' },
      { href: './workspace-shell.html', label: 'Workspace Shell' },
      { href: './surface-host-doc.html', label: 'Surface Host' },
      { href: './conversation-doc.html', label: 'Conversation' },
      { href: './choosing.html', label: 'Which component when' },
      { href: './events.html', label: 'Events' },
      { href: './changelog.html', label: 'Changelog' },
    ],
  },
  {
    label: 'ui-button',
    links: [
      { href: './button-demo.html', label: 'Demo' },
      { href: './button-permutations.html', label: 'Permutations' },
      { href: './button-states.html', label: 'States' },
      { href: './button-doc.html', label: 'API' },
    ],
  },
  {
    // ADR-0179 GH #686 Amendment S7-a — ui-toggle, the fleet's first pressed-state pill button (GH #832).
    // tier=control ⇒ {permutations, states, doc} — the same page-type set ui-button carries.
    label: 'ui-toggle',
    links: [
      { href: './toggle-demo.html', label: 'Demo' },
      { href: './toggle-permutations.html', label: 'Permutations' },
      { href: './toggle-states.html', label: 'States' },
      { href: './toggle-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-text-field',
    links: [
      { href: './text-field-demo.html', label: 'Demo' },
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
      { href: './textarea-demo.html', label: 'Demo' },
      { href: './textarea-permutations.html', label: 'Permutations' },
      { href: './textarea-states.html', label: 'States' },
      { href: './textarea-doc.html', label: 'API' },
    ],
  },
  {
    // code-entry-control.lld.md (GH #490 S2-a) — ui-otp-field, the identity family's segmented N-cell
    // one-time-code entry field (tier=control ⇒ the same {permutations, states, doc} set). Permanently
    // catalog-excluded (ADR-0176 cl.3) — still a site-documented fleet member like any other control.
    label: 'ui-otp-field',
    links: [
      { href: './otp-field-demo.html', label: 'Demo' },
      { href: './otp-field-permutations.html', label: 'Permutations' },
      { href: './otp-field-states.html', label: 'States' },
      { href: './otp-field-doc.html', label: 'API' },
    ],
  },
  {
    // The Display-class text primitive — a single descriptor-derived API doc (tier=display ⇒ {doc} only).
    label: 'ui-text',
    links: [
      { href: './text-demo.html', label: 'Demo' }, // GH #1279 — the article/typographic-scale demo (Demo first, API second)
      { href: './text-doc.html', label: 'API' },
    ],
  },
  {
    // The Display-class icon primitive (ADR-0065/0066) — a single descriptor-derived API doc + live gallery.
    label: 'ui-icon',
    links: [
      { href: './icon-demo.html', label: 'Demo' }, // GH #1279 — icons in buttons/lists, the size ramp, meaningful icons
      { href: './icon-doc.html', label: 'API' },
    ],
  },
  {
    // The Wave M1 chart family (ADR-0107) — two Display-class axis-free charts, each a single descriptor-derived
    // API doc (tier=display ⇒ {doc} only, the ui-text/ui-icon precedent; display leaves are per-component groups),
    // plus a rich Demo page each (Kim's 2026-08-18 "every component page gets a demo tab" ruling; Demo first,
    // API second — the ui-disclosure precedent below).
    label: 'ui-sparkline',
    links: [
      { href: './sparkline-demo.html', label: 'Demo' },
      { href: './sparkline-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-bar-chart',
    links: [
      { href: './bar-chart-demo.html', label: 'Demo' },
      { href: './bar-chart-doc.html', label: 'API' },
    ],
  },
  {
    // ADR-0205/GH #1207 — the fleet's first axis-bearing chart (a value-range baseline + always-shown
    // min/max labels, single-series). Same shape as the two above — Display-class, {doc} + demo.
    label: 'ui-line-chart',
    links: [
      { href: './line-chart-demo.html', label: 'Demo' },
      { href: './line-chart-doc.html', label: 'API' },
    ],
  },
  {
    // ADR-0219 — the fourth chart-family control: the part-of-whole ring (donut, default) or solid pie,
    // lifting ADR-0107's pie fence on its own three stated conditions. Same shape as the two above —
    // Display-class, {doc} + demo.
    label: 'ui-pie-chart',
    links: [
      { href: './pie-chart-demo.html', label: 'Demo' },
      { href: './pie-chart-doc.html', label: 'API' },
    ],
  },
  {
    // ADR-0228/ADR-0229 (svg-charts wave 1, GH #1565) — the fifth chart-family control: a category-major
    // stacked (or dense single-series) axis-bearing column mark, the first consumer of the shared
    // `_chart/` axis/inset/series vocabulary. Same shape as the three above — Display-class, {doc} + demo.
    label: 'ui-column-chart',
    links: [
      { href: './column-chart-demo.html', label: 'Demo' },
      { href: './column-chart-doc.html', label: 'API' },
    ],
  },
  {
    // ADR-0229 cl.4 (svg-charts wave 3, GH #1567) — the sixth chart-family control: a multi-ring RADIAL
    // gauge, concentric independent 0-100 progress rings (never part-of-whole) plus a real-DOM legend
    // column. Same shape as the five above — Display-class, {doc} + demo.
    label: 'ui-gauge',
    links: [
      { href: './gauge-demo.html', label: 'Demo' },
      { href: './gauge-doc.html', label: 'API' },
    ],
  },
  {
    // The token-surface family (ADR-0118) — three Display-class show-never-edit primitives, each a single
    // descriptor-derived API doc (tier=display ⇒ {doc} only, the ui-sparkline/ui-bar-chart precedent).
    label: 'ui-swatch',
    links: [
      { href: './swatch-demo.html', label: 'Demo' },
      { href: './swatch-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-ramp',
    links: [
      { href: './ramp-demo.html', label: 'Demo' },
      { href: './ramp-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-ladder',
    links: [
      { href: './ladder-demo.html', label: 'Demo' },
      { href: './ladder-doc.html', label: 'API' },
    ],
  },
  {
    // The Indicator-class form controls (Wave 1, ADR-0041/0042) — per-component groups, tag-labelled (the
    // site-toc rule: control/container/pattern tiers each get ONE ui-{tag} group; only layout bundles).
    label: 'ui-checkbox',
    links: [
      { href: './checkbox-demo.html', label: 'Demo' },
      { href: './checkbox-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-switch',
    links: [
      { href: './switch-demo.html', label: 'Demo' },
      { href: './switch-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-radio',
    links: [
      { href: './radio-demo.html', label: 'Demo' },
      { href: './radio-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-radio-group',
    links: [
      { href: './radio-group-demo.html', label: 'Demo' },
      { href: './radio-group-doc.html', label: 'API' },
    ],
  },
  {
    // ADR-0220 (GH #1368) — the `choice` family: the rich-card selection container + its option unit.
    label: 'ui-choice-group',
    links: [
      { href: './choice-group-demo.html', label: 'Demo' },
      { href: './choice-group-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-choice-card',
    links: [
      { href: './choice-card-demo.html', label: 'Demo' },
      { href: './choice-card-doc.html', label: 'API' },
    ],
  },
  {
    // ADR-0224 (GH #1429) — the availability-stated service/agent launch card (tier=pattern ⇒ {doc, demo}).
    label: 'ui-service-card',
    links: [
      { href: './service-card-demo.html', label: 'Demo' },
      { href: './service-card-doc.html', label: 'API' },
    ],
  },
  {
    // ADR-0225 (GH #1478) — the true card-face/back display leaf (tier=display).
    label: 'ui-playing-card',
    links: [
      { href: './playing-card-demo.html', label: 'Demo' },
      { href: './playing-card-doc.html', label: 'API' },
    ],
  },
  {
    // ADR-0095 (supersedes ADR-0086's ui-radio-group[variant='segmented'], hard cutover): the standalone
    // segmented control + its child leaf — tag-labelled, same as every other per-component group.
    label: 'ui-segment',
    links: [
      { href: './segment-demo.html', label: 'Demo' },
      { href: './segment-doc.html', label: 'API' },
    ],
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
    links: [
      { href: './slider-demo.html', label: 'Demo' },
      { href: './slider-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-slider-multi',
    links: [
      { href: './slider-multi-demo.html', label: 'Demo' },
      { href: './slider-multi-doc.html', label: 'API' },
    ],
  },
  {
    // ADR-0216 / GH #1395 — the star-value Range control, a THIRD UIRangeElement leaf alongside
    // slider/slider-multi (same Wave-2 tag-labelled convention).
    label: 'ui-rating',
    links: [
      { href: './rating-demo.html', label: 'Demo' },
      { href: './rating-doc.html', label: 'API' },
    ],
  },
  {
    // The layout primitives share one tier showcase (overview + surface×layout) + a per-component API doc each.
    label: 'Layout primitives',
    links: [
      { href: './layout-overview.html', label: 'Overview' },
      { href: './layout-permutations.html', label: 'Surface × layout' },
      // Each primitive's Demo sits RIGHT AFTER its own doc link (Kim, 2026-08-18: every component page gets a
      // demo tab). This bundle's tab strip is SHARED (Overview first — the group's editorial anchor), so the
      // per-component "Demo first, API second" ordering of a `ui-*` group cannot apply here; `row · row demo`
      // adjacency is the bundle-shaped equivalent, and every demo page joins the group (activeGroup matches by
      // href) so it inherits the same strip.
      { href: './row-doc.html', label: 'row' },
      { href: './row-demo.html', label: 'row demo' },
      { href: './column-doc.html', label: 'column' },
      { href: './column-demo.html', label: 'column demo' },
      { href: './list-doc.html', label: 'list' },
      { href: './list-demo.html', label: 'list demo' },
      { href: './grid-doc.html', label: 'grid' },
      { href: './grid-demo.html', label: 'grid demo' },
      // ui-toast-region (ADR-0112, tier=layout) folds into this bundle rather than growing its own group —
      // the site-toc editorial rule (a new layout primitive joins the existing showcase, never a 5th group).
      { href: './toast-region-doc.html', label: 'toast-region' },
      // Each folded primitive's Demo tab sits right after its doc tab (the bundle's own Demo-beside-API shape;
      // the per-component groups put Demo FIRST, but a shared strip reads best doc → demo per primitive).
      { href: './toast-region-demo.html', label: 'toast-region demo' },
      // ui-split / ui-split-pane (ADR-0120 cl.2, app-surfaces-m4.lld.md LLD-C1) — same fold, tier=layout.
      { href: './split-doc.html', label: 'split' },
      { href: './split-demo.html', label: 'split demo' },
      { href: './split-pane-doc.html', label: 'split-pane' },
      { href: './split-pane-demo.html', label: 'split-pane demo' },
      // ui-swiper-item (ADR-0124, LLD-C4, tier=layout) — the same fold (its family comment below always said
      // so; the links themselves landed with the demo wave).
      { href: './swiper-item-doc.html', label: 'swiper-item' },
      { href: './swiper-item-demo.html', label: 'swiper-item demo' },
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
    label: 'ui-drawer',
    links: [
      { href: './drawer-demo.html', label: 'Demo' },
      { href: './drawer-doc.html', label: 'API' },
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
    // M-F — the multi-select field (multi-select-field.lld.md · ADR-0175): tier=pattern ⇒ {doc, demo}.
    label: 'ui-multi-select',
    links: [
      { href: './multi-select-demo.html', label: 'Demo' },
      { href: './multi-select-doc.html', label: 'API' },
    ],
  },
  {
    // GH #294 F4 — the packaged ui-popover + form-spine recipe: a control-created trigger over a real
    // form-content panel. tier=pattern ⇒ {doc, demo}, the ui-popover/ui-select precedent.
    label: 'ui-form-popover',
    links: [
      { href: './form-popover-demo.html', label: 'Demo' },
      { href: './form-popover-doc.html', label: 'API' },
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
  {
    // genui-surface.spec.md SPEC §3.2/§3.3 (D9, B1) — the GenUI containment host: one native
    // sandboxed iframe + the closed bridge + the fail-closed fallback. Permanently catalog-excluded
    // (SPEC-N1/PRD-G4) — still a site-documented fleet member.
    label: 'ui-sandbox-frame',
    links: [
      { href: './sandbox-frame-demo.html', label: 'Demo' },
      { href: './sandbox-frame-doc.html', label: 'API' },
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
  // {doc} only, the ui-text/ui-icon/chart precedent) — ui-table + ui-stat each also carry a rich Demo page
  // (Demo first, API second — the ui-disclosure precedent).
  {
    label: 'ui-table',
    links: [
      { href: './table-demo.html', label: 'Demo' },
      { href: './table-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-stat',
    links: [
      { href: './stat-demo.html', label: 'Demo' },
      { href: './stat-doc.html', label: 'API' },
    ],
  },
  // ADR-0201 (GH #1185) — the key–value receipt primitive, same Display-class {doc}-only shape.
  {
    label: 'ui-description-list',
    links: [
      { href: './description-list-demo.html', label: 'Demo' }, // GH #1279 — confirm-step receipts + the omission law live
      { href: './description-list-doc.html', label: 'API' },
    ],
  },
  // ADR-0214 (GH #1394) — the source-attribution aggregate leaf, same Display-class {doc}-only shape.
  {
    label: 'ui-source-list',
    links: [{ href: './source-list-doc.html', label: 'API' }],
  },
  {
    label: 'ui-badge',
    links: [
      { href: './badge-demo.html', label: 'Demo' }, // GH #1279 — status/count tokens in a run list + a live bound intent write
      { href: './badge-doc.html', label: 'API' },
    ],
  },
  // ADR-0163 cl.6 — ui-pagination, the fleet's first standalone page navigator (tier=pattern ⇒ {doc, demo}).
  {
    label: 'ui-pagination',
    links: [
      { href: './pagination-demo.html', label: 'Demo' },
      { href: './pagination-doc.html', label: 'API' },
    ],
  },
  // ADR-0213 (GH #1393) — ui-suggestions, the one-shot follow-up/next-prompt chip set (tier=pattern ⇒ {doc, demo}).
  {
    label: 'ui-suggestions',
    links: [
      { href: './suggestions-demo.html', label: 'Demo' },
      { href: './suggestions-doc.html', label: 'API' },
    ],
  },
  // GH #1515 (no ADR — routine mint) — ui-breadcrumb, the wayfinding trail with an optional
  // `collapse="menu"` overflow fold (tier=pattern ⇒ {doc, demo}).
  {
    label: 'ui-breadcrumb',
    links: [
      { href: './breadcrumb-demo.html', label: 'Demo' },
      { href: './breadcrumb-doc.html', label: 'API' },
    ],
  },
  // The Wave M1 content family (ADR-0113) — ui-code (tier=display ⇒ {doc} only) + ui-disclosure (tier=pattern
  // ⇒ {doc, demo}, the tooltip/popover precedent).
  {
    label: 'ui-code',
    links: [
      { href: './code-demo.html', label: 'Demo' }, // GH #1279 — inline vs block, seven languages verbatim vs projected, overflow
      { href: './code-doc.html', label: 'API' },
    ],
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
    links: [
      { href: './progress-demo.html', label: 'Demo' },
      { href: './progress-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-avatar',
    links: [
      { href: './avatar-demo.html', label: 'Demo' },
      { href: './avatar-doc.html', label: 'API' },
    ],
  },
  // GH #1189 — ui-image, the URL-sourced content-image primitive (tier=display ⇒ {doc} only, a conventional
  // component admission — no new ADR). NOT a fallback chain like ui-avatar above — just the <img> mechanics.
  {
    label: 'ui-image',
    links: [
      { href: './image-demo.html', label: 'Demo' },
      { href: './image-doc.html', label: 'API' },
    ],
  },
  // GH #1209 — the native media players (tier=display ⇒ {doc} only, conventional admissions per the
  // ui-image ruling): real <video>/<audio controls>, no custom chrome.
  {
    label: 'ui-video',
    links: [
      { href: './video-demo.html', label: 'Demo' },
      { href: './video-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-audio',
    links: [
      { href: './audio-demo.html', label: 'Demo' },
      { href: './audio-doc.html', label: 'API' },
    ],
  },
  {
    label: 'ui-attachment',
    links: [
      { href: './attachment-demo.html', label: 'Demo' },
      { href: './attachment-doc.html', label: 'API' },
    ],
  },
  {
    // ADR-0210 (GH #1391) — the fleet's file-INPUT affordance, composing ui-attachment above for its chips.
    label: 'ui-file-drop',
    links: [
      { href: './file-drop-demo.html', label: 'Demo' },
      { href: './file-drop-doc.html', label: 'API' },
    ],
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
    links: [
      { href: './swiper-label-demo.html', label: 'Demo' },
      { href: './swiper-label-doc.html', label: 'API' },
    ],
  },
  // ADR-0195 — ui-drill, the N-level drill-down panel container (tier=pattern ⇒ {doc, demo}, GH #954).
  {
    label: 'ui-drill',
    links: [
      { href: './drill-demo.html', label: 'Demo' },
      { href: './drill-doc.html', label: 'API' },
    ],
  },
  {
    // ui-super-shell (@agent-ui/app, M5 — ADR-0151/shell-archetypes-m5.spec.md, GH #83/#84): the
    // application-frame archetype family's grammar ceiling. A GUIDE page, not a fleet component in
    // components/src — so it is an ungrouped site-level link (no `label:`, hence no site-toc GROUP), exactly
    // like the A2UI pages below; site-coverage/site-toc derive their fleet from components/src and never
    // expect a `super-shell-{type}.html` set for it. (The App Shell link retired with its teaching page —
    // ADR-0156.)
    links: [{ href: './super-shell.html', label: 'Super Shell' }],
  },
  {
    // ui-chat-shell (@agent-ui/app, M5 round 4 — GH #98; shell-archetypes-m5.lld.md LLD-C6). The SAME
    // ungrouped-site-level-link posture as Super Shell just above.
    links: [{ href: './chat-shell.html', label: 'Chat Shell' }],
  },
  {
    // ui-master-detail (@agent-ui/app, ADR-0120 cl.3a; app-surfaces-m4.lld.md LLD-C10, M4 Phase 2) — the
    // SAME ungrouped-site-level-link posture as Super Shell just above: a GUIDE page for an app-tier
    // composition, not a fleet component in components/src.
    links: [{ href: './master-detail.html', label: 'Master Detail' }],
  },
  {
    // ui-settings (@agent-ui/app, ADR-0120 cl.4; app-surfaces-m4.lld.md LLD-C12, M4 Phase 3) — the SAME
    // ungrouped-site-level-link posture as Super Shell/Master Detail just above: a GUIDE page for an
    // app-tier composition, not a fleet component in components/src.
    links: [{ href: './settings.html', label: 'Settings' }],
  },
  {
    // ui-nav-rail (@agent-ui/app, ADR-0130; nav-rail-family.lld.md LLD-C4) — the SAME
    // ungrouped-site-level-link posture as Master Detail/Settings just above. Added by GH #368: the family
    // had NO site surface at all, so nothing demonstrated `collapse="menu"` or visually guarded it.
    links: [{ href: './nav-rail.html', label: 'Nav Rail' }],
  },
  {
    // @agent-ui/router (LLD-C10b, SPEC-R8) — another package above components on the DAG, same posture as
    // Super Shell just above: a GUIDE page for a package, not a fleet component in components/src, so it is an
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
    // @agent-ui/data (ADR-0192, saas-data-utilities.spec.md SPEC-R14 e) — the FOURTH sibling branch off
    // components (`shared ← components ← {a2ui, router, code, data}`); no tagged element at all (a headless
    // seam + signals + gateway + stream), the SAME ungrouped-site-level-link posture as Router/Highlight:
    // a GUIDE page for a package, not a fleet component in components/src.
    links: [{ href: './data-doc.html', label: 'Data' }],
  },
  {
    // @agent-ui/components/traits/* (overlay/list-reorder/scroll-spy) + ./dogfood-frame — the SAME
    // ungrouped-site-level-link posture as Router/Highlight/Data just above: a GUIDE page for traits
    // published as their own subpath, not a fleet component in components/src/controls (no descriptor).
    links: [{ href: './traits-doc.html', label: 'Traits' }],
  },
  {
    // dom/view-transition.ts (ADR-0183, GH #740/#742/#958/#1005/#1043) — the SAME ungrouped-site-level-link
    // posture as Router/Traits just above: a GUIDE page over a seam + its four opt-in surfaces, none of which
    // is a components/src/controls fleet member with its own descriptor-driven page set.
    links: [{ href: './motion.html', label: 'View Transitions' }],
  },
  {
    // @agent-ui/app entry-list/entry-data (ADR-0132/ADR-0164) — the SAME ungrouped-site-level-link posture
    // as Router/Highlight/Data/Traits just above: a GUIDE page for a headless mount function (no
    // customElements.define, no tag of its own — controls-coverage.test.ts's own EXEMPT row), not a fleet
    // component in components/src (GH #1049).
    links: [{ href: './entry-list.html', label: 'Entry List' }],
  },
  {
    // @agent-ui/shared's StorageAdapter seam (ADR-0193, GH #1046) — the SAME ungrouped-site-level-link
    // posture as Data/Traits just above: a GUIDE page for a seam, not a fleet component in components/src.
    links: [{ href: './persistence.html', label: 'Persistence' }],
  },
  {
    // ui-agent-admin (@agent-ui/app, TKT-0039/ADR-0131) — the SAME ungrouped-site-level-link posture as
    // Super Shell/Master Detail/Settings just above: a GUIDE page for an app-tier composition (ui-split +
    // ui-settings + ui-conversation), not a fleet component in components/src. Agent Admin App joins here
    // too (Kim's 2026-07-25 overturn of the 2026-07-19 standalone opt-out): the full composition at real
    // viewport scale, now discoverable from this rail/the landing grid — but still rendered shell-less
    // (agent-admin-app.ts imports no `_page.ts`), since its whole point is the real production surface,
    // not a docs-wrapped preview of it (agent-admin.html already owns that teaching job). The Persona
    // Library Pattern joins here too (GH #406, M-B DoD box 3) — a conceptual guide over agent-admin's
    // persona export/import, the SAME card-less GUIDE posture as Agent Admin itself. Agent Schema joins
    // here too (GH #781) — the agentConfigSchema()/AgentConfigSnapshot data-shape reference, derived live
    // from agent-admin-schema.ts, the SAME posture again.
    links: [
      { href: './agent-admin.html', label: 'Agent Admin' },
      { href: './agent-admin-app.html', label: 'Agent Admin App' },
      { href: './persona-library-pattern.html', label: 'Persona Library Pattern' },
      { href: './agent-schema.html', label: 'Agent Schema' },
    ],
  },
  // The Devtools Harness (GH #1122, ADR-0200 clause 5) — the chat & A2UI dev/debug surface over @agent-ui/devtools.
  { links: [{ href: './devtools-harness.html', label: 'Devtools Harness' }] },
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
      { href: './a2ui-agent.html', label: 'A2UI Agent Guide' },
    ],
  },
  {
    // genui-surface.spec.md SPEC §3.2/§3.3 (D9) — the GenUI chat demo: a chat pane driving a recorded
    // backbone of canned prompt->HTML turns, rendered through ui-sandbox-frame — NOT A2UI (GenUI
    // validates the boundary, not a catalog payload), so it gets its own ungrouped site-level link
    // rather than folding into the A2UI cluster above, the same posture as that cluster's own links.
    links: [{ href: './gen-ui-live.html', label: 'GenUI Chat Demo' }],
  },
  {
    // GH #1584 (genui-b3-judged-eval.lld.md LLD-C5) — the B3 judged pack-idiom eval's own results page:
    // the SAME ungrouped-site-level posture as GenUI Chat Demo just above (an independent destination,
    // not a sub-page of it).
    links: [{ href: './genui-corpus.html', label: 'GenUI Corpus Eval' }],
  },
  {
    // The SaaS Data Workbench (GH #461, M-A MA-3) — the SAME standalone/ungrouped posture as Agent Admin
    // App/GenUI Chat Demo just above: a real, listed destination (an entry in site-manifest.json/
    // sitemap.json, an ungrouped nav link here, a landing card in main.ts) that still renders shell-less
    // on load (workbench.ts imports no `_page.ts` — its own reason to exist is the composition itself, not
    // a docs-wrapped preview of it).
    links: [{ href: './workbench.html', label: 'SaaS Data Workbench' }],
  },
  {
    // The Support Dashboard (GH #499, M-F) — the fleet's SECOND SaaS composition, the SAME standalone/
    // ungrouped posture as the SaaS Data Workbench just above (a real, listed destination that still
    // renders shell-less on load — dashboard.ts imports no `_page.ts`).
    links: [{ href: './dashboard.html', label: 'Support Dashboard' }],
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

// isNavCurrent — is `url` (a SITE_NAV_ENTRIES entry) the one this page should be treated as "current"
// for? True for the real current page, OR — on a component's own sub-page (Permutations/States/API,
// which SITE_NAV_ENTRIES doesn't carry, only the `{tag}-doc.html` does) — the active NAV group's own doc
// entry, so a sub-page still resolves to that entry. ONE predicate shared by `buildNav`'s rail-highlight
// (`isSelected`, below) and `buildPageFooter`'s prev/next index, so a component sub-page gets a working
// pager derived from its parent doc's neighbors instead of an empty band (the S3c pager and the rail can
// never independently drift on what "current" means for a sub-page).
function isNavCurrent(url: string): boolean {
  const active = activeGroup()
  const activeDocUrl = active?.label?.startsWith('ui-') ? `./${active.label.slice('ui-'.length)}-doc.html` : undefined
  return isCurrent(url) || url === activeDocUrl
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

  // On a component's sub-page the exact URL is not in the sitemap (only its `-doc.html` is) — `isNavCurrent`
  // maps the active NAV group (the tab-strip residue) to that component's doc URL so the rail stays oriented.
  const isSelected = isNavCurrent

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
// The non-scrolling top-bar + footer that bracket the page scroll region — site-built chrome slotted into
// the `ui-super-shell` frame (`buildThemedShell`). Their CONTENT defaults are chosen here, not per page.

// SCHEME_CYCLE — the compact toggle's three-state ring (ADR-0117's unset='' IS "Auto": it tracks the OS/an
// ancestor, never re-mapped to a literal 'light'). Order chosen so a first click from the untouched default
// reaches Light before Dark — the more common explicit override.
const SCHEME_CYCLE: readonly SchemeId[] = ['', 'light', 'dark']
const SCHEME_LABEL: Record<SchemeId, string> = { '': 'Auto', light: 'Light', dark: 'Dark' }

// GH #183 — the header-chip row-cramp collapse: the SAME 40rem line named by
// `@agent-ui/app`'s `shell-breakpoint.ts` (`SHELL_NARROW_BREAKPOINT_REM`), per ADR-0155 clause 1's own
// routing rule — "`stack`/`tabs` sides keep the 40rem line, which answers a different question (row
// cramp, not side visibility)" — and chip truncation is exactly a row-cramp question, never a side-
// visibility one (the docs shell's 52.5rem `collapse-band="compact"` line, below). NOT imported: the
// site isn't in `@agent-ui/app`'s package.json `exports` map, and `shell-breakpoint.ts`'s own header
// already documents why each of its five internal call sites keeps its own cited literal rather than a
// shared import (no live CSS custom-property substitution point exists for an `@container` condition) —
// this call site follows the identical convention, for a `ResizeObserver` comparison rather than a CSS
// query (see `buildContextHeader`'s own comment for why). Empirically measured (2026-07-21, this file's
// actual brand + 3-chip content): the real squeeze onset is ~415px (~26rem) — 40rem/640px collapses
// with comfortable headroom above that, while 52.5rem/840px would additionally over-collapse ordinary
// 700-800px widths where the header still fits its full text with room to spare.
const HEADER_ICON_ONLY_BREAKPOINT_REM = 40

/** Render one header action chip for the given band (GH #183): full label text (wide) or a real icon +
 *  `aria-label` carrying the SAME text (narrow — `icon-only`, button.ts's fifth "square" content-model
 *  structure, the toast.ts close-button precedent). `icon-only` is an explicit, author-driven content
 *  swap — CSS alone cannot detect an empty/text-node label (button.ts's own comment) — so this always
 *  runs in JS, on every band change AND every dynamic-label change (scheme/theme selection), never just
 *  once at mount. */
function renderChip(btn: UIButtonElement, glyph: string, label: string, iconOnly: boolean): void {
  btn.toggleAttribute('icon-only', iconOnly)
  btn.replaceChildren()
  if (iconOnly) {
    const icon = document.createElement('ui-icon')
    icon.setAttribute('slot', 'leading')
    icon.setAttribute('data-role', 'icon')
    icon.setAttribute('glyph', glyph)
    btn.append(icon)
    btn.setAttribute('aria-label', label)
  } else {
    btn.textContent = label
    btn.removeAttribute('aria-label')
  }
}

/** The real Theme control (TKT-0088/ADR-0141 cl.4/5) — a scheme-cycle button + a theme `ui-menu` picker,
 *  both wired to `provider` (the shell's own `ui-theme-provider`, ADR-0141 cl.1) via `theme-loader.ts`.
 *  Mounts already showing the PERSISTED choice (no flash of the default before JS settles — the provider
 *  itself was already set from the same persisted values at shell-creation time, below; this control just
 *  reads that same state back for its own initial label). Returns a `setIconOnly` handle (GH #183) so the
 *  caller's single band observer can flip both chips together — the row-cramp collapse is one shared
 *  band, not a per-chip decision. */
function buildThemeControl(provider: UIThemeProviderElement): { element: HTMLElement; setIconOnly: (iconOnly: boolean) => void } {
  const group = document.createElement('div')
  group.className = 'app-context-theme-group'
  let iconOnly = false // the shared band flag — set by the caller before this control ever paints narrow

  // ── the scheme-cycle button ──────────────────────────────────────────────────────────────────────────
  const schemeBtn = document.createElement('ui-button') as UIButtonElement
  schemeBtn.setAttribute('variant', 'soft')
  let scheme = loadPersistedScheme()
  const renderScheme = (): void => renderChip(schemeBtn, 'circle-half', SCHEME_LABEL[scheme], iconOnly)
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
    const label = THEME_OPTIONS.find((o) => o.id === currentTheme)?.label ?? 'Default'
    renderChip(trigger, 'palette', label, iconOnly)
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

  const setIconOnly = (value: boolean): void => {
    if (value === iconOnly) return
    iconOnly = value
    renderScheme()
    renderTrigger()
  }

  return { element: group, setIconOnly }
}

// buildContextHeader — the app top-bar (right column, row 1, fixed): the app wordmark (a Home link) + a
// placeholder region for app-level chrome. `Search` is now a REAL button opening the already-mounted
// `ui-command-modal` (TKT-0018's own palette, `mountCommandPaletteOnce` below — the mod+k hotkey's own
// affordance, made clickable too); `Theme` is the REAL scheme+theme control above, wired to `provider`
// (TKT-0088/ADR-0141 cl.4/5 — the shell's own ui-theme-provider, created by the caller). GH #183: the
// wordmark (`.app-brand`, `_page.css`) never wraps or truncates at any band — when the row is cramped,
// these three chips collapse to icon-only instead (never the brand).
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
  let iconOnly = false // the shared row-cramp band flag (GH #183) — the ResizeObserver below is its one writer
  const renderSearch = (): void => renderChip(search, 'magnifying-glass', 'Search', iconOnly)
  renderSearch()
  // Lazy import — same module `mountCommandPaletteOnce` already pulled in at shell-build time (below),
  // so this resolves from the browser's own module cache, not a second network fetch; keeps the "a page
  // that never opens the palette pays no bundle cost" discipline intact for this call site too.
  search.addEventListener('click', () => {
    void import('../lib/command-palette.ts').then((m) => m.openCommandPalette())
  })
  const theme = buildThemeControl(provider)
  actions.append(search, theme.element)
  bar.append(actions)

  // GH #183 — the row-cramp icon-only collapse, keyed off THIS element's own measured width via
  // `ResizeObserver`, deliberately NOT `window.matchMedia`. `bar` is exactly the box brand+chips squeeze
  // inside: `ui-super-shell` (`packages/agent-ui/app/src/controls/super-shell/super-shell.ts` `#compose`)
  // relocates this same node, unchanged, into its own `[data-part="bar-content"]` wrapper — a real
  // container-width question, matching how the shell's OWN `@container ui-super-shell (inline-size <
  // 40rem)` narrow arm already works (`super-shell.css`) and how its one shell-owned `#bandObserver`
  // already watches itself via `ResizeObserver`, never `matchMedia` (same file). Concretely verified this
  // matters: the fleet's own `_page.visual.browser.test.ts` `mountNarrow()` helper simulates a narrow
  // viewport by constraining an ANCESTOR `<div>`'s width inside the `visual` vitest project's actual
  // 900px-wide browser window (`vitest.browser.config.ts`'s `visual` project, chosen so a WIDE fixture's
  // screenshot doesn't itself clip) — `window.matchMedia('(max-width: 40rem)')` reads that real 900px
  // window and never matches, silently no-op-ing this entire fix under the exact baseline meant to prove
  // it (measured: the CURRENT, pre-fix baseline already shows the row-cramp truncation bug at this same
  // 900px-window/390px-div combination — proof the squeeze tracks the div's width, not the window's).
  // Feature-detected for jsdom parity (the super-shell `#bandObserver` precedent) — jsdom has no
  // `ResizeObserver`, so a `npm test` mount just keeps the default wide (full-text) render, which is fine:
  // narrow-band behaviour is this exact suite's (the browser visual shard's) job, not jsdom's.
  const iconOnlyPx = (): number => HEADER_ICON_ONLY_BREAKPOINT_REM * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)
  const applyBand = (width: number): void => {
    const next = width < iconOnlyPx()
    if (next === iconOnly) return
    iconOnly = next
    renderSearch()
    theme.setIconOnly(iconOnly)
  }
  if (typeof ResizeObserver !== 'undefined') {
    // The FIRST notification after `observe()` always delivers synchronously-scheduled, PRE-PAINT (the
    // spec's own guarantee for a newly-observed element) — so a page that loads directly at a narrow
    // width still renders icon-only chips on first paint, never a wide-then-narrow flash.
    new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) applyBand(entry.contentRect.width)
    }).observe(bar)
  }

  return bar
}

// buildContextFooter — the app footer (right column, row 3, fixed): the tagline + a link to the GitHub
// repo (S3b — real footer content, not the retired "docs shell placeholder" copy), plus a link to the
// generated agent-facing index (GH #1049 — llms.txt was generated but linked from no page). The bar
// itself spans the column edge-to-edge (background + top divider); its CONTENT sits in an inner wrapper
// pinned to the SAME reading column as `.page-header-inner` / `[data-page-content]`, so header, content,
// and footer read as one column rather than the line floating at a different inset from the page body.
function buildContextFooter(): HTMLElement {
  const footer = document.createElement('footer')
  footer.className = 'app-context-footer'
  const inner = document.createElement('div')
  inner.className = 'app-context-footer-inner'
  const tagline = document.createElement('span')
  tagline.textContent = 'agent-ui — zero-dependency, signals-based web components'
  const repo = document.createElement('a')
  repo.className = 'app-context-footer-link'
  repo.href = 'https://github.com/kimgranlund/agent-ui'
  repo.textContent = 'GitHub'
  // GH #1049 — llms.txt (the agent-facing docs index, site/public/llms.txt) is a real, gated file
  // (site/lib/llms.test.ts's G2 coverage gate) but was linked from no page; llms.txt's OWN "Meta" section
  // already links llms-full.txt, so the missing direction was the human-facing site pointing AT llms.txt.
  // Grouped with the repo link (`.app-context-footer-links`) rather than appended as a THIRD direct child
  // of `.app-context-footer-inner` — that box's `justify-content: space-between` is pinned to exactly TWO
  // endpoints by `_page-bar-inset.browser.test.ts`'s alignment measurement; a group keeps that two-item
  // geometry unchanged.
  const llms = document.createElement('a')
  llms.className = 'app-context-footer-link'
  llms.href = './llms.txt'
  llms.textContent = 'llms.txt'
  const links = document.createElement('span')
  links.className = 'app-context-footer-links'
  links.append(repo, llms)
  inner.append(tagline, links)
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

// buildCta — the page-header primary action: a styled link rendered to read as a button. Deliberately a
// plain `<a>` styled by `.page-cta` in `_page.css`, NOT a `ui-button` — the CTA must stay a real navigation
// anchor (that file's own `.page-cta` comment is the rationale). Optional — only pages passing a `cta` get one.
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
 * away with the content rather than permanently pinning a tall block above the scroll region. Accepts plain
 * strings AND inline nodes (e.g. an `<a>` cross-link) via variadic args — text args become TextNodes, so a
 * single-string call behaves exactly like the old `textContent` form. Folds in the `para()` idiom that used
 * to be hand-duplicated per page (chat-shell.ts/super-shell.ts/conversation-doc.ts and siblings) for mixed
 * text+link lead paragraphs (GH #1002) — ONE shared helper for every `.page-lead` paragraph, plain or mixed.
 */
export function pageLead(...parts: (string | Node)[]): HTMLElement {
  const p = document.createElement('p')
  p.className = 'page-lead'
  for (const part of parts) p.append(typeof part === 'string' ? document.createTextNode(part) : part)
  return p
}

// appendDescription — S4, Kim's standing description-clamp standard: the page-description shows up to 2
// lines by default (CSS `line-clamp`, `.page-description`) with a quiet "more"/"less" text-button toggle
// (the `.page-context-label` muted-ink register) that lifts/restores the clamp. The toggle stays hidden
// (`hidden = true`) until it is PROVEN necessary: `queueMicrotask` defers the overflow measurement past
// this whole synchronous mount (the `buildThemeControl` `populate()` precedent, above — `mountPage`'s
// final `root.append(...)` runs after this function returns, so `description` has no real layout to
// measure against until then), and only a description whose `scrollHeight` exceeds its clamped
// `clientHeight` ever reveals the toggle — a permanently-visible "more" on a one-line description would
// be noise, not a standard.
function appendDescription(inner: HTMLElement, text: string): void {
  const description = document.createElement('p')
  description.className = 'page-description'
  description.textContent = text
  inner.append(description)

  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = 'page-description-toggle'
  toggle.textContent = 'more'
  toggle.setAttribute('aria-expanded', 'false')
  toggle.hidden = true
  let expanded = false
  toggle.addEventListener('click', () => {
    expanded = !expanded
    description.classList.toggle('page-description--expanded', expanded)
    toggle.textContent = expanded ? 'less' : 'more'
    toggle.setAttribute('aria-expanded', String(expanded))
  })
  inner.append(toggle)

  queueMicrotask(() => {
    if (description.scrollHeight > description.clientHeight + 1) toggle.hidden = false
  })
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

  if (options.intro) appendDescription(inner, options.intro)

  // Tabs are page-TYPES of ONE subject — a LABELED component group (Permutations/States/API of ui-button). An
  // UNGROUPED site-level cluster (the A2UI pages, the ADR index) is independent destinations, not views of one
  // thing, so it gets NO default tab strip — the left rail already lists each; an explicit `options.tabs` wins.
  const tabs: readonly NavLink[] | undefined = options.tabs ?? (group?.label ? group.links : undefined)
  if (tabs && tabs.length >= 2) inner.append(buildTabs(tabs))

  header.append(inner)
  return header
}

// buildPageFooter — the STICKY page footer (bottom of the row-2 scroll region): real Previous/Next
// navigation (S3c), derived from `SITE_NAV_ENTRIES` — the SAME canonical flattened sitemap order the
// left rail already renders from (`buildNav`, above), via the SAME `isNavCurrent` predicate (so a
// component's own sub-page — Permutations/States/API, absent from SITE_NAV_ENTRIES — resolves to its
// parent doc entry and gets ITS working neighbors, exactly like the rail highlight does; the pager and
// the rail share one source of truth in fact, not just in comment). Returns `undefined` when nothing
// resolves at all (e.g. the landing page, which sits outside the sitemap AND has no active NAV group) —
// the caller then renders NO footer band, rather than an empty sticky bar. The first entry in the order
// has no Previous and the last has no Next — hidden outright rather than a dead `<a>` with no href, per
// Kim's "no dead ends" call on this fork.
function buildPageFooter(): HTMLElement | undefined {
  const index = SITE_NAV_ENTRIES.findIndex((entry) => isNavCurrent(entry.url))
  const prev = index > 0 ? SITE_NAV_ENTRIES[index - 1] : undefined
  const next = index !== -1 && index < SITE_NAV_ENTRIES.length - 1 ? SITE_NAV_ENTRIES[index + 1] : undefined
  if (!prev && !next) return undefined

  const footer = document.createElement('footer')
  footer.className = 'page-footer'
  const inner = document.createElement('div')
  inner.className = 'page-footer-inner'

  if (prev) {
    const link = document.createElement('a')
    link.className = 'page-footer-prev'
    link.href = prev.url
    link.textContent = `← ${prev.name}`
    inner.append(link)
  }
  if (next) {
    const link = document.createElement('a')
    link.className = 'page-footer-next'
    link.href = next.url
    link.textContent = `${next.name} →`
    inner.append(link)
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
// tag swap from the old plain `<div class="app-shell">` — `.app-shell` is the SITE's own chrome class,
// unrelated to the removed `ui-app-shell` element (ADR-0156), and its CSS is entirely class-keyed,
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
  // BEFORE first paint (getSync — same-tick, ADR-0193 Amendment), persist on every flip (attribute
  // observation — the reflected state IS the API). Through the shared `agent-ui`-namespaced tier
  // (GH #1544): the stored key stays `agent-ui.site.nav-collapsed` and the stored BYTES stay
  // 'true'/'false' (a boolean's JSON encoding), so a pre-drain value reads back unchanged. The
  // adapter no-ops (never throws) when storage is unavailable — session-only state.
  if (siteStorage.getSync(NAV_COLLAPSED_KEY) === true) shell.collapsedStart = true
  new MutationObserver(() => {
    void siteStorage.set(NAV_COLLAPSED_KEY, shell.hasAttribute('collapsed-start'))
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
  page.append(buildPageHeader(options), content)
  const footer = buildPageFooter() // undefined ⇒ no prev/next resolves at all (e.g. the landing page) — no empty band
  if (footer) page.append(footer)

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
