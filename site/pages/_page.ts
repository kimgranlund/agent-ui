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
// SHELL NOTE — this is a CSS-ONLY app shell (the outer nav-rail / context frame + the per-page sticky
// header/footer is `_page.css` grid + sticky and the structure below; it uses NO `ui-*` components). It is a
// deliberate placeholder: once an app-shell component family ships, this shell should be REBUILT to dogfood
// those controls (rail / top-bar / tab-strip / CTA become real `ui-*` specimens), the same way the pages
// already dogfood ui-button / ui-text-field. Until then, plain light-DOM keeps the shell dependency-free.
import '@agent-ui/components/foundation-styles.css' // [1] foundation: tokens.css -> dimensions.css (FIRST)
import '@agent-ui/components/component-styles.css' // [2] per-control CSS, after the foundation
import '@agent-ui/components/components' // [3] self-defining ui-* controls (registers ui-button on import)
import '@agent-ui/icons/phosphor' // [3b] activate the Phosphor default pack (ADR-0065/0066): the controls above render their
// affordances (select caret, text-field clear/reveal/steppers, calendar nav) through the app-owned icon pack — pack-agnostic
// by design, so the SHELL that self-defines them must activate the default pack, else those glyphs resolve to an empty <svg>.
import './_page.css' // [4] shared page chrome (shell + nav + header), AFTER the foundation so it reads the --md-sys-color-* roles

// What a page builder gets back from mountPage: the <main> container to append its content into. Kept to a
// single field so every page slice shares a stable, minimal contract.
export interface PageHandle {
  readonly content: HTMLElement
}

// ── shared site nav ──────────────────────────────────────────────────────────────────────────────────────
// The site's table of contents, rendered into the LEFT RAIL of EVERY page so the whole site shares one nav. The
// rail lists COMPONENTS, not pages: each per-component group (`ui-button`, `ui-text-field`, …) collapses to ONE
// entry linking to that control's first page — its per-type pages are NOT repeated in the rail, because the
// page-header tab strip (DERIVED from the same group) already offers them once you are on the component. The
// component entries are bracketed by the ungrouped site-level links (Home, A2UI Canvas). A new component's docs
// append ONE group here. Hrefs are sibling-relative (`./x.html`): every page shell lives at the site root, so
// these resolve from any page. Per-component page filenames follow the one convention `{name}-{page-type}.html`
// (the coverage gate, site-coverage.test.ts, derives the required set from it). The same grouping DERIVES each
// page's context-label + tab strip (see mountPage), so a component's page-type pages tab between each other for
// free — which is exactly why the rail need not list them a second time.
//
// EXPORTED so the cross-engine nav smoke (site-nav.browser.test.ts) derives its expected rail-entry count from
// this single source rather than a magic constant: the rendered `<a>` count must equal ONE entry per labelled
// group + each ungrouped link (buildNav's rule), so the rail can't silently drop/duplicate entries AND the gate
// never re-drifts when a component group is appended here.
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
  // Picker controls — Wave 5B (ADR-0048): standalone date picker + future type=date overlay body.
  {
    label: 'ui-calendar',
    links: [
      { href: './calendar-demo.html', label: 'Demo' },
      { href: './calendar-doc.html', label: 'API' },
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
  {
    // The application-frame primitive (@agent-ui/app, ADR-0082/0083/0084). A GUIDE page, not a fleet component
    // in components/src — so it is an ungrouped site-level link (no `label:`, hence no site-toc GROUP), exactly
    // like the A2UI pages below; site-coverage/site-toc derive their fleet from components/src and never expect
    // an `app-shell-{type}.html` set for it.
    links: [{ href: './app-shell.html', label: 'App Shell' }],
  },
  {
    // @agent-ui/router (LLD-C10b, SPEC-R8) — another package above components on the DAG, same posture as
    // App Shell just above: a GUIDE page for a package, not a fleet component in components/src, so it is an
    // ungrouped site-level link — site-coverage/site-toc/site-canon (all components/src-scoped) never expect a
    // `router-{type}.html` per-component set for it.
    links: [{ href: './router-doc.html', label: 'Router' }],
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

// navItem — one rail entry (`<li><a>`): a sibling-relative link, flagged active via aria-current when `active`.
// `exact` picks the token — `page` when the href IS the current page (a site-level link, or a component sitting
// on its landing page), `true` when the entry merely represents the active SECTION (a component while you are on
// one of its sub-pages, which the tab strip is showing). Both spellings get the active rail style (_page.css).
function navItem(href: string, label: string, active: boolean, exact: boolean): HTMLElement {
  const item = document.createElement('li')
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.textContent = label
  if (active) anchor.setAttribute('aria-current', exact ? 'page' : 'true')
  item.append(anchor)
  return item
}

// currentNavLabel — the label of the rail entry for the page we are on, for the collapsed disclosure trigger.
// Mirrors buildNav's entry rule: a component group contributes ONE entry labelled by the component name (active
// across its whole section), so a sub-page reports the component label; a site-level link reports its own label.
// Falls back to 'Menu' off any known route (defensive — every shipped page is in NAV).
function currentNavLabel(): string {
  const group = activeGroup()
  if (group) return group.label ?? group.links.find((link) => isCurrent(link.href))?.label ?? 'Menu'
  return 'Menu'
}

// buildNav — the shared cross-page nav: a `<nav data-site-nav>` (one shell, identical on every page). At rail
// width it is a single flat `<ul>` down the left; below the shell's collapse breakpoint that same list becomes a
// zero-JS `<details>` DROPDOWN — a `<summary>` trigger (current page + chevron, `aria-expanded` for free) over
// the list, so the 10-item bar no longer overflows into a horizontal scroller. ONE list is built; CSS alone
// (the `_page.css` media query) decides rail-vs-dropdown — no per-width markup, so the nav structure (and the
// drift gates that mirror it) is untouched. A per-component group contributes ONE entry — the component name,
// linking to its first page and highlighted across the WHOLE group; its per-type pages live in the page-header
// tab strip, not the rail. An ungrouped site-level group contributes its link(s) directly. Dependency-free light
// DOM; the rail/dropdown styling lives in `_page.css`.
function buildNav(): HTMLElement {
  const nav = document.createElement('nav')
  nav.setAttribute('data-site-nav', '')
  nav.setAttribute('aria-label', 'Site')

  const active = activeGroup()
  const list = document.createElement('ul')

  for (const group of NAV) {
    if (group.label) {
      // A component group → ONE rail entry, linking to its first page; the tab strip offers its per-type pages.
      const [first] = group.links
      list.append(navItem(first.href, group.label, active === group, isCurrent(first.href)))
    } else {
      // Ungrouped site-level links (Home, A2UI Canvas) — a direct link each, active only on its exact page.
      for (const link of group.links) list.append(navItem(link.href, link.label, isCurrent(link.href), true))
    }
  }

  // Wrap the list in a `<details>` disclosure. At rail width CSS hides the summary and shows the list always
  // (the disclosure is inert chrome); below the breakpoint the summary IS the trigger and the list shows only
  // when open. `<details>`/`<summary>` is keyboard-operable and exposes expanded/collapsed state with zero JS —
  // the zero-dependency choice. The summary carries the current page label so the collapsed trigger names where
  // you are; the chevron (a CSS pseudo-element, `_page.css`) flips with `[open]`.
  const disclosure = document.createElement('details')
  disclosure.setAttribute('data-site-nav-disclosure', '')
  const summary = document.createElement('summary')
  summary.className = 'site-nav-trigger'
  const triggerLabel = document.createElement('span')
  triggerLabel.className = 'site-nav-trigger-label'
  triggerLabel.textContent = currentNavLabel()
  summary.append(triggerLabel)
  disclosure.append(summary, list)

  nav.append(disclosure)
  return nav
}

// ── the app chrome frame (right column, rows 1 & 3) ──────────────────────────────────────────────────────
// The non-scrolling top-bar + footer that bracket the page scroll region. CSS-only placeholders today (an
// app-shell component family will own these later). Their CONTENT defaults are chosen here, not per page.

// buildContextHeader — the app top-bar (right column, row 1, fixed): the app wordmark (a Home link) + a
// placeholder region for app-level chrome (search / theme toggle). The placeholders are inert spans — the
// future app-shell component supplies the real controls.
function buildContextHeader(): HTMLElement {
  const bar = document.createElement('header')
  bar.className = 'app-context-header'

  const brand = document.createElement('a')
  brand.className = 'app-brand'
  brand.href = './index.html'
  brand.textContent = 'agent-ui'
  bar.append(brand)

  const actions = document.createElement('div')
  actions.className = 'app-context-actions'
  for (const text of ['Search', 'Theme']) {
    const slot = document.createElement('span')
    slot.className = 'app-context-slot'
    slot.textContent = text
    actions.append(slot)
  }
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

  const shell = document.createElement('div')
  shell.className = 'app-shell'
  shell.append(buildNav(), buildContextHeader(), page, buildContextFooter())

  root.append(shell)
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

  const shell = document.createElement('div')
  shell.className = 'app-shell'
  shell.append(buildNav(), buildContextHeader(), page, buildContextFooter())

  root.append(shell)
  return { content }
}
