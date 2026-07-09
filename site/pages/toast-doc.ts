// site/pages/toast-doc.ts — the ui-toast API doc page (tier=pattern ⇒ {doc, demo}, ADR-0112 /
// feed-family.lld.md LLD-C12). DERIVED from `toast.md` via the shared doc-page.ts renderer: the attribute
// table (urgent, duration, action), the properties[] table (close()), the events[] table (select, close), and
// the parts[] table (message, action, close) are read straight from the parse — so none can drift from the
// descriptor the contract trip-wire enforces (ADR-0004). Deliberately NOT catalogued (ADR-0112 cl.6) — a
// toast is app-surface chrome, never agent-emittable content (see the "App-surface consumption story" prose
// below, rendered from the body). The specimens are STATIC (duration="0", so they never auto-dismiss while
// reading) — the live timing / pause-on-hover / show() interaction is the Demo page's job.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadToastDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

const { descriptor, body } = loadToastDoc()

const { content } = mountPage({
  title: 'ui-toast — API',
  intro:
    "The fleet's first transient notification card (ADR-0112, feed family v1), region-hosted by its sibling " +
    'ui-toast-region. Not form-associated. Generated from toast.md: the attribute/properties/events/parts ' +
    "tables are descriptor-derived. See the ui-toast demo for the live timing and show() story.",
})

composeDocPage(content, descriptor, body, renderSpecimens())

// renderSpecimens — static specimens (duration="0" ⇒ never auto-dismiss) for inspection, outside a region so
// they sit in normal page flow. Plain (role=status), urgent (role=alert), and actionable (never auto-dismisses
// even without duration="0" — action alone disables the timer, SPEC-R16).
function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'))
  const note = document.createElement('p')
  note.textContent = 'Static for inspection (duration="0"). Mount these inside a ui-toast-region in a real app.'

  const plain = document.createElement('ui-toast')
  plain.setAttribute('duration', '0')
  plain.textContent = 'File uploaded.'

  const urgent = document.createElement('ui-toast')
  urgent.setAttribute('urgent', '')
  urgent.setAttribute('duration', '0')
  urgent.textContent = 'Upload failed.'

  const actionable = document.createElement('ui-toast')
  actionable.setAttribute('action', 'Retry')
  actionable.textContent = 'Upload failed — retry?'

  const stack = document.createElement('div')
  stack.style.cssText = 'display:flex; flex-direction:column; gap:0.75rem; max-inline-size:20em;'
  stack.append(plain, urgent, actionable)

  section.append(note, stack)
  return section
}
