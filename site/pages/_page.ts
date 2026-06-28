// site/pages/_page.ts — the shared /site page shell (wave-2 prep). EVERY /site page module imports this
// file FIRST; it is the single place that performs the load-bearing foundation import cascade (ADR-0003), so
// the three wave-2 page builders (permutations / states / button-doc) never repeat — or reorder — it.
//
// Import order is load-bearing: the colour `--c-*` roles + the `--ui-{height,font,gap}-*` ramp from the
// FOUNDATION barrel must be declared BEFORE a control's `:where()` block reads them. So foundation CSS loads
// tokens-first, then the per-component CSS, then the behaviour that self-defines the ui-* controls. Because a
// page module imports `_page.ts` as its first statement, ES depth-first evaluation runs these three before any
// other control-touching import in the page — so the cascade order holds for the whole site.
import '@agent-ui/components/foundation-styles.css' // [1] foundation: tokens.css -> dimensions.css (FIRST)
import '@agent-ui/components/component-styles.css' // [2] per-control CSS, after the foundation
import '@agent-ui/components/components' // [3] self-defining ui-* controls (registers ui-button on import)
import './_page.css' // [4] shared page chrome (nav + header), AFTER the foundation so it reads the --c-* roles

// What a page builder gets back from mountPage: the <main> container to append its content into. Kept to a
// single field so the three wave-2 page slices share a stable, minimal contract.
export interface PageHandle {
  readonly content: HTMLElement
}

// ── shared site nav ──────────────────────────────────────────────────────────────────────────────────────
// The site's table of contents, rendered into the `[data-site-nav]` slot of EVERY page so the whole site shares
// one nav. It is GROUPED per component: a labelled cluster (`ui-button`, `ui-text-field`, …) of that control's
// per-type pages, bracketed by the ungrouped site-level links (Home, A2UI Canvas). A new component's docs append
// ONE group here. Hrefs are sibling-relative (`./x.html`): every page shell lives at the site root, so these
// resolve from any page. Per-component page filenames follow the one convention `{name}-{page-type}.html`
// (the coverage gate, site-coverage.test.ts, derives the required set from it).
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
  { links: [{ href: './a2ui-canvas.html', label: 'A2UI Canvas' }] },
]

// isCurrent — is this link the page we are on? Compare resolved pathnames, treating the site root (`/`) as
// `index.html` so Home highlights on the landing. Marks the active link with `aria-current="page"`.
function isCurrent(href: string): boolean {
  const target = new URL(href, location.href).pathname
  const normalize = (path: string): string => (path.endsWith('/') ? `${path}index.html` : path)
  return normalize(location.pathname) === normalize(target)
}

// buildNav — the shared cross-page nav: a labelled `<nav data-site-nav>` (pages key off the attribute) holding
// one `<div class="nav-group">` per group — an optional `<span class="nav-group-label">` (the component name)
// above a `<ul>` of that group's links, the current page flagged with `aria-current`. Dependency-free light DOM;
// styling lives in `_page.css`.
function buildNav(): HTMLElement {
  const nav = document.createElement('nav')
  nav.setAttribute('data-site-nav', '')
  nav.setAttribute('aria-label', 'Site')

  for (const group of NAV) {
    const groupEl = document.createElement('div')
    groupEl.className = 'nav-group'

    if (group.label) {
      const label = document.createElement('span')
      label.className = 'nav-group-label'
      label.textContent = group.label
      groupEl.append(label)
    }

    const list = document.createElement('ul')
    for (const link of group.links) {
      const item = document.createElement('li')
      const anchor = document.createElement('a')
      anchor.href = link.href
      anchor.textContent = link.label
      if (isCurrent(link.href)) anchor.setAttribute('aria-current', 'page')
      item.append(anchor)
      list.append(item)
    }
    groupEl.append(list)
    nav.append(groupEl)
  }
  return nav
}

export interface PageOptions {
  /** The page <h1>. */
  readonly title: string
  /** Optional lead paragraph rendered under the title. */
  readonly intro?: string
}

// mountPage — stamp the consistent page chrome into `#app` (falling back to <body>) and hand back the content
// container. Chrome = the shared `<nav data-site-nav>` (A5 cross-page links, current page flagged), the <h1>
// title, an optional intro <p class="page-intro">, and the `<main data-page-content>` the page fills.
// Framework-free: plain light-DOM + the self-defining ui-* controls imported above.
export function mountPage(options: PageOptions): PageHandle {
  const root = document.querySelector('#app') ?? document.body

  const header = document.createElement('header')
  header.className = 'site-header'

  // Cross-page nav — the shared site nav, identical on every page (it lives here, in the one shell).
  header.append(buildNav())

  const heading = document.createElement('h1')
  heading.textContent = options.title
  header.append(heading)

  if (options.intro) {
    const intro = document.createElement('p')
    intro.className = 'page-intro'
    intro.textContent = options.intro
    header.append(intro)
  }

  const content = document.createElement('main')
  content.setAttribute('data-page-content', '')

  root.append(header, content)
  return { content }
}
