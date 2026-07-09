// site/pages/router-doc.ts — the @agent-ui/router package guide (LLD-C10b, SPEC-R8): a live memory-mode
// demo (links + outlet + back/forward buttons, all reading the SAME router instance), the URL-reflection
// opt-in snippet + hash-vs-history guidance, and the two elements' descriptor-derived API tables (the
// SECOND consumer of the canonical parser, same discipline as every ui-* control's own doc page). Router
// is a package ABOVE components on the DAG (SPEC-R1) — a GUIDE page, not a fleet component in
// components/src; site-coverage/site-toc/site-canon never expect a `router-{type}.html` per-component set.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './router-doc.css'
import { createRouter } from '@agent-ui/router'
import '@agent-ui/router/router-outlet'
import { UIRouterLinkElement } from '@agent-ui/router/router-link'
import '@agent-ui/router/router-link.css'
import type { UIRouterOutletElement } from '@agent-ui/router/router-outlet'
import { el, exampleSection, uiButton } from '../lib/specimens.ts'
import { codeBlock } from '../lib/code-block.ts'
import { loadRouterOutletDoc, loadRouterLinkDoc, type ComponentDoc } from '../lib/frontmatter.ts'
import { heading, renderApiTable, renderPropertiesTable, renderEventsTable, renderSlotsTable, renderPartsTable } from '../lib/doc-page.ts'

const { content } = mountPage({
  title: '@agent-ui/router',
  intro:
    'A memory-first SPA router (v1): route state lives in a kernel signal and navigation is a plain ' +
    'function over an in-memory history stack, in any host — plus an opt-in URL-reflection adapter (hash ' +
    'default / history opt-in) that projects that same state onto the browser URL without ever becoming a ' +
    'second source of truth. Two light-DOM elements turn matches into rendered content (ui-router-outlet) ' +
    'and markup into navigation (ui-router-link).',
})

// ── live demo — memory mode only (connectUrl is never called on this page): the links below therefore
// show the documented memory-only href degradation (SPEC-R6) — a hash-form href you can hover to inspect —
// while a plain click still navigates in-app via interception, exactly as it would with reflection attached.
const router = createRouter([
  { path: '/', component: () => routeCard('Home', 'The router-doc landing route.') },
  { path: '/about', component: () => routeCard('About', '@agent-ui/router — zero-dependency, memory-first, opt-in URL reflection.') },
  { path: '/items/:id', component: (match) => routeCard('Item', `Viewing item #${match.params.id} — a :param capture.`) },
])

function routeCard(title: string, text: string): Element {
  return el('div', {}, [heading(3, title), el('p', { style: 'margin:0.35rem 0 0;' }, [document.createTextNode(text)])])
}

const outlet = document.createElement('ui-router-outlet') as UIRouterOutletElement
outlet.router = router // property-only — no attribute form (SPEC-R5)
UIRouterLinkElement.defaultRouter = router // the one-line app wiring every ui-router-link on this page reads (ADR-0115 fork F4)

const status = document.createElement('p')
status.className = 'router-demo-status'
function updateStatus(): void {
  status.textContent = `router.route.value?.path = ${JSON.stringify(router.route.value?.path ?? null)}`
}
updateStatus()

const nav = el('nav', { class: 'router-demo-nav', 'aria-label': 'Demo navigation' }, [
  el('ui-router-link', { to: '/' }, [document.createTextNode('Home')]),
  el('ui-router-link', { to: '/about' }, [document.createTextNode('About')]),
  el('ui-router-link', { to: '/items/42' }, [document.createTextNode('Item #42')]),
])
// A plain click on ui-router-link calls router.navigate() SYNCHRONOUSLY inside its own bubble-phase click
// listener (attached directly on the stamped <a>, LLD-C8) — by the time this delegated ancestor listener
// runs, router.route.value already reflects the new route, so no extra reactive wiring is needed here.
nav.addEventListener('click', () => updateStatus())

const backBtn = uiButton('◀ back', 'ghost')
backBtn.addEventListener('click', () => {
  router.back()
  updateStatus()
})
const forwardBtn = uiButton('forward ▶', 'ghost')
forwardBtn.addEventListener('click', () => {
  router.forward()
  updateStatus()
})
const controls = el('div', { class: 'router-demo-controls' }, [backBtn, forwardBtn])

const frame = el('div', { class: 'router-demo-frame' }, [outlet])

content.append(exampleSection('Live demo (memory mode)', nav, controls, frame, status))

// ── URL reflection — opt-in, shown as a snippet (this page's own demo router stays memory-only above, so
// clicking a link here never changes the browser's own address bar or interferes with site navigation). ──
content.append(
  exampleSection(
    'URL reflection (opt-in)',
    codeBlock(
      [
        "import { createRouter, connectUrl } from '@agent-ui/router'",
        '',
        'const router = createRouter(routes)',
        "const cleanup = connectUrl(router)                        // hash mode (default): '#/about'",
        "// const cleanup = connectUrl(router, { mode: 'history' }) // clean paths: '/about'",
      ].join('\n'),
      'ts',
    ),
    el('p', {}, [
      document.createTextNode(
        'Hash mode (the default) works on any static host — every deep link resolves client-side, no ' +
          'server route table needed. History mode produces clean paths, but a direct hit on ' +
          '/about 404s at the server unless it is configured to serve the app shell for every route — use ' +
          'it only when you control that config. The live demo above never calls connectUrl(); its links ' +
          'show the resulting memory-only degradation directly: hover one to see its hash-form href, and ' +
          'notice a plain click still navigates in-app.',
      ),
    ]),
  ),
)

// ── API — descriptor-derived tables, one section per element (the same parser/tables every ui-* control's
// own doc page uses; router-outlet.md / router-link.md carry the same ADR-0004 frontmatter shape). ──
function elementSection(title: string, doc: ComponentDoc): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, title))
  if (doc.descriptor.attributes.length > 0) section.append(renderApiTable(doc.descriptor.attributes, 3))
  for (const table of [
    renderPropertiesTable(doc.descriptor, 3),
    renderEventsTable(doc.descriptor),
    renderSlotsTable(doc.descriptor),
    renderPartsTable(doc.descriptor),
  ]) {
    if (table) section.append(table)
  }
  return section
}

content.append(elementSection('ui-router-outlet', loadRouterOutletDoc()), elementSection('ui-router-link', loadRouterLinkDoc()))
