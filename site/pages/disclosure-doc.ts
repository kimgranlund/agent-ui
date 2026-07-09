// site/pages/disclosure-doc.ts — the ui-disclosure API doc page (tier=pattern ⇒ {doc, demo}, ADR-0113 /
// content-family.lld.md LLD-C12). DERIVED from `disclosure.md` via the shared doc-page.ts renderer: the
// attribute table (open, summary), the events[] table (toggle), the slots[] table (body), and the parts[]
// table (details/summary/chevron/summary-text/body) are read straight from the parse — so none can drift
// from the descriptor the contract trip-wire enforces (ADR-0004). One representative live specimen (closed)
// plus one pre-opened specimen; the rich click/model-toggle interaction + event log live on the Demo page.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadDisclosureDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadDisclosureDoc()

const { content } = mountPage({
  title: 'ui-disclosure — API',
  intro:
    'The native-<details>-backed fold (ADR-0113, content family v1) — a one-line summary that expands to ' +
    'reveal content, with find-in-page auto-expand for free. Not form-associated. Generated from ' +
    'disclosure.md: the attribute/events/slots/parts tables are descriptor-derived. See the ui-disclosure ' +
    'demo for the live click + model-driven toggle with an event log.',
})

const closed = el('ui-disclosure', { summary: 'Full log' }, [
  el('ui-code', { language: 'sh' }, [document.createTextNode('2026-07-08T12:00:00Z deploy started\n2026-07-08T12:00:04Z deploy finished (ok)')]),
])

const open = el('ui-disclosure', { summary: 'Details', open: '' }, [
  el('p', { style: 'margin:0;' }, [document.createTextNode('Expanded on load — the open attribute is reflected + bindable.')]),
])

composeDocPage(content, descriptor, body, exampleSection('Example', closed, open))
