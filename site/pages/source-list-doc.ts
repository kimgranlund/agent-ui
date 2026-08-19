// site/pages/source-list-doc.ts — the ui-source-list API doc page (tier=display ⇒ {doc} only, ADR-0214,
// GH #1394). DERIVED from `source-list.md` via the shared doc-page.ts renderer: the attribute table is
// built from the parsed `attributes[]`, the parts[] surface renders as the descriptor-derived Parts table
// (row/index/title/snippet), and the prose from the body — so neither can drift from the descriptor the
// contract trip-wire enforces (ADR-0004). The specimen DATA are hand-authored (a doc page has no source to
// derive representative data from) — a cited-answer source list plus a per-entry safeHref gate
// demonstration (an allowed https: source beside a denied javascript: source that degrades to plain text).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadSourceListDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

const { descriptor, body } = loadSourceListDoc()

const { content } = mountPage({
  title: 'ui-source-list — API',
  intro:
    'The source-attribution aggregate leaf (ADR-0214, GH #1394) — a numbered list of cited sources, ' +
    'index markers assigned by array position (never producer-authored), each entry titled with a real ' +
    'gated hyperlink when its href crosses the fleet safe-href scheme allowlist. Not interactive beyond ' +
    'the platform-native link an allowed href stamps; no events, no [size]/[scale] control geometry. ' +
    'Generated from source-list.md: the attribute and parts tables are descriptor-derived; the specimens ' +
    'below show a grounded-answer citation list and the per-entry safeHref gate.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'), heading(3, 'A cited answer'))

  const desc = document.createElement('p')
  desc.textContent =
    'The core agentic-trust pattern: a grounded answer cites its evidence. Index markers are the array ' +
    'position — "1", "2", "3" — never an authored field, so marker↔row drift is unrepresentable.'
  const cited = specimen([
    { href: 'https://example.com/report', title: 'Q3 Market Report', snippet: 'Revenue grew 12% year over year.' },
    { href: 'https://example.com/notes', title: 'Internal analyst notes' },
    { href: 'https://example.com/filing', title: 'SEC quarterly filing', snippet: 'Filed 2026-08-14.' },
  ])

  const gateHeading = heading(3, 'The per-entry safeHref gate')
  const gateDesc = document.createElement('p')
  gateDesc.textContent =
    'Every href crosses the fleet’s fail-closed scheme allowlist (ADR-0114) independently — the ' +
    'static validator does not descend into array items, so this component-side gate is load-bearing. ' +
    'An allowed https:/http:/mailto: href renders a real gated link; a denied scheme (here, javascript:) ' +
    'strips the link and renders the title as plain text — attribution survives, the link does not.'
  const gated = specimen([
    { href: 'https://example.com/allowed', title: 'An allowed source (https:)' },
    { href: 'javascript:alert(1)', title: 'A denied source (javascript:) — renders as text' },
    { href: '', title: 'No destination — also denied, also plain text' },
  ])

  section.append(desc, box(cited), gateHeading, gateDesc, box(gated))
  return section
}

function specimen(sources: readonly Record<string, unknown>[]): HTMLElement {
  const el = document.createElement('ui-source-list')
  el.setAttribute('sources', JSON.stringify(sources))
  return el
}

function box(el: HTMLElement): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'max-width: 32rem; margin: 0.5rem 0 1.75rem;'
  wrap.append(el)
  return wrap
}
