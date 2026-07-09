// site/pages/code-doc.ts — the ui-code API doc page (tier=display ⇒ {doc} only, ADR-0113 /
// content-family.lld.md LLD-C12). DERIVED from `code.md` via the shared doc-page.ts renderer: the attribute
// table (language) and the slots[] table (the default `code` slot) are read straight from the parse — so
// neither can drift from the descriptor the contract trip-wire enforces (ADR-0004). The specimens are
// hand-authored fixtures (a doc page has no source to derive representative content from): a short verbatim
// command, a whitespace/indentation-preserving multi-line block, and a long unbroken line proving the
// component's OWN horizontal overflow (never the page's) — the content-family LLD's "overflow/verbatim
// fixtures" requirement.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadCodeDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

const { descriptor, body } = loadCodeDoc()

const { content } = mountPage({
  title: 'ui-code — API',
  intro:
    'The Display-class, zero-machinery verbatim code leaf (ADR-0113, content family v1) — mono, ' +
    'whitespace-preserved, scrolled inside its own box. Not interactive, not form-associated: no events, no ' +
    'clipboard affordance, no syntax highlighting. Generated from code.md: the attribute table is ' +
    'descriptor-derived; the fixtures below show a verbatim command, an indentation-preserving block, and the ' +
    "component's own horizontal overflow.",
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'))

  const short = document.createElement('ui-code')
  short.textContent = 'npm run check && npm test'

  const verbatim = document.createElement('ui-code')
  verbatim.setAttribute('language', 'json')
  verbatim.textContent = '{\n  "ok": true,\n  "components": ["table", "stat", "badge"]\n}'

  const overflow = document.createElement('ui-code')
  overflow.style.cssText = 'max-inline-size:28rem;'
  overflow.textContent =
    'const REVENUE_BY_REGION = [{ label: "EMEA", value: 42 }, { label: "Americas", value: 58 }, { label: "APAC", value: 31 }, { label: "LATAM", value: 12 }]'

  section.append(
    labelled('A verbatim shell command', 'A single line, no language set — language is inert metadata at v1.', short),
    labelled('An indentation-preserving block', 'language="json" — inert (no highlighting), but the round-trip habit is honored.', verbatim),
    labelled('The component\'s own overflow', 'A long unbroken line scrolls inside a 28rem box (overflow-x:auto on the host) — it never wraps mid-token and never blows out the container.', overflow),
  )
  return section
}

function labelled(title: string, description: string, node: HTMLElement): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'margin:0.5rem 0 1.5rem;'
  const desc = document.createElement('p')
  desc.textContent = description
  wrap.append(heading(3, title), desc, node)
  return wrap
}
