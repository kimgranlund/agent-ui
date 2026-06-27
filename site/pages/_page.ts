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

// What a page builder gets back from mountPage: the <main> container to append its content into. Kept to a
// single field so the three wave-2 page slices share a stable, minimal contract.
export interface PageHandle {
  readonly content: HTMLElement
}

export interface PageOptions {
  /** The page <h1>. */
  readonly title: string
  /** Optional lead paragraph rendered under the title. */
  readonly intro?: string
}

// mountPage — stamp the consistent page chrome into `#app` (falling back to <body>) and hand back the content
// container. Chrome = a `<nav data-site-nav>` placeholder (wave-3 / A5 fills the cross-page links), the <h1>
// title, an optional intro <p class="page-intro">, and the `<main data-page-content>` the page fills.
// Framework-free: plain light-DOM + the self-defining ui-* controls imported above.
export function mountPage(options: PageOptions): PageHandle {
  const root = document.querySelector('#app') ?? document.body

  const header = document.createElement('header')

  // Cross-page nav placeholder — empty until wave-3 (A5) populates it; pages key off [data-site-nav].
  const nav = document.createElement('nav')
  nav.setAttribute('data-site-nav', '')
  header.append(nav)

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
