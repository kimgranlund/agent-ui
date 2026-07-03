// site/pages/icon-doc.ts — the ui-icon API doc page (tier=display ⇒ {doc} only, ADR-0065/0066). DERIVED from
// `icon.md`: the API table is built row-by-row from the canonical parser's `attributes[]` (name/label — both
// plain strings, no enum), so it cannot drift from the descriptor the contract trip-wire enforces (ADR-0004,
// one parser / two consumers). The one page-local block is the live icon gallery: it imports the REAL
// `@agent-ui/icons/phosphor` pack (a self-register side effect) and iterates the REAL `ICON_NAMES` vocabulary,
// so a future name added to the curated set appears here for free — and this page is the end-to-end proof that
// the adapter + Phosphor pack + ui-icon consumer surface actually render together (ADR-0065 acceptance).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadIconDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading, specimenRow } from '../lib/doc-page.ts'
import { ICON_NAMES } from '@agent-ui/icons'
import '@agent-ui/icons/phosphor' // self-registers + activates the Phosphor default pack (ADR-0066)

const { descriptor, body } = loadIconDoc()

const { content } = mountPage({
  title: 'ui-icon — API',
  intro:
    'The Display-class icon primitive — the declarative consumer surface over the @agent-ui/icons adapter ' +
    '(ADR-0065/0066). Generated from icon.md: the API table is descriptor-derived, so it cannot drift; the ' +
    'gallery below iterates the real ICON_NAMES vocabulary against the shipped Phosphor default pack.',
})

composeDocPage(content, descriptor, body, renderGallery())

// renderGallery — a live <ui-icon> specimen per canonical ICON_NAMES member, rendered against the real Phosphor
// pack (imported above for its self-register side effect). Each specimen is captioned with the name it sets.
function renderGallery(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Gallery'))
  section.append(
    specimenRow(
      ICON_NAMES.map((name) => {
        const figure = document.createElement('figure')
        figure.style.cssText = 'display:flex; flex-direction:column; gap:0.35rem; align-items:center; margin:0; font-size:1.5rem;'
        const icon = document.createElement('ui-icon')
        icon.setAttribute('name', name)
        const caption = document.createElement('figcaption')
        caption.style.fontSize = '0.75rem'
        const code = document.createElement('code')
        code.textContent = name
        caption.append(code)
        figure.append(icon, caption)
        return figure
      }),
    ),
  )
  return section
}
