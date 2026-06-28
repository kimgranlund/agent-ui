// site/pages/_page.ts — the shared /site page shell. EVERY /site page module imports this file FIRST; it is
// the single place that performs the load-bearing foundation import cascade (ADR-0003), so a page builder never
// repeats — or reorders — it.
//
// Import order is load-bearing: the colour `--c-*` roles + the `--ui-{height,font,gap}-*` ramp from the
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
import './_page.css' // [4] shared page chrome (shell + nav + header), AFTER the foundation so it reads the --c-* roles

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
interface NavLink {
  readonly href: string
  readonly label: string
}
interface NavGroup {
  /** The component label for a per-component cluster; absent for the ungrouped site-level links. */
  readonly label?: string
  readonly links: readonly NavLink[]
}
const NAV: readonly NavGroup[] = [
  { links: [{ href: './index.html', label: 'Home' }] },
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
    // The layout primitives share one tier showcase (overview + surface×layout) + a per-component API doc each.
    label: 'Layout primitives',
    links: [
      { href: './layout-overview.html', label: 'Overview' },
      { href: './layout-permutations.html', label: 'Surface × layout' },
      { href: './row-doc.html', label: 'row' },
      { href: './column-doc.html', label: 'column' },
      { href: './list-doc.html', label: 'list' },
      { href: './grid-doc.html', label: 'grid' },
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
  { links: [{ href: './a2ui-canvas.html', label: 'A2UI Canvas' }] },
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

// buildNav — the shared cross-page nav: a `<nav data-site-nav>` (one shell, identical on every page) holding a
// single flat `<ul>`. A per-component group contributes ONE entry — the component name, linking to its first
// page and highlighted across the WHOLE group (the section you are in); its per-type pages live in the page-
// header tab strip, not the rail. An ungrouped site-level group contributes its link(s) directly. Dependency-
// free light DOM; the rail styling lives in `_page.css`.
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

  nav.append(list)
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

// buildPageHeader — the STICKY page header (top of the row-2 scroll region): the regions context-label ·
// heading (the <h1>) · description (the lead <p>) · tab strip · CTA. The context-label + tabs AUTO-DERIVE from
// the active NAV group, so a page that passes only `{ title, intro }` still gets a correct header; `contextLabel`
// / `tabs` / `cta` override or add. A single-link group (Home, A2UI Canvas) renders no tab strip — a one-tab
// strip carries no navigation value.
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

  const tabs: readonly NavLink[] | undefined = options.tabs ?? group?.links
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
