// site/pages/video-doc.ts — the ui-video API doc page (tier=display ⇒ {doc} only, GH #1209). DERIVED from
// `video.md` via the shared doc-page.ts renderer (ADR-0004: one parser / two consumers — the tables cannot
// drift from the descriptor the contract trip-wire enforces). The specimen uses an absent-src state plus a
// poster-only fixture: a doc page ships no real media files, and the empty-src "no dead shell" discipline is
// itself the behavior worth showing.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadVideoDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

const { descriptor, body } = loadVideoDoc()

const { content } = mountPage({
  title: 'ui-video — API',
  intro:
    'The Display-class native video player (GH #1209, the A2UI standard-catalog Video shape): the real ' +
    '<video controls> in a reserved aspect-ratio box (zero CLS, the ui-image law) — native chrome only, ' +
    'no custom transport UI. Generated from video.md: the attribute and parts tables are descriptor-derived.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'))

  const intro = document.createElement('p')
  intro.textContent =
    'An empty src renders no player at all (never a dead shell); a non-empty src builds the native ' +
    '<video controls> inside the reserved 16/9 box. The specimen below uses a tiny data: URI so the box, ' +
    'native chrome, and letterbox canvas are all visible without shipping media files.'
  section.append(intro)

  const el = document.createElement('ui-video') as HTMLElement & { src: string; label: string }
  el.style.cssText = 'max-inline-size: 28rem;'
  // A 1-frame silent MP4 would be bytes-in-repo; an intentionally-unresolvable data: URI still exercises the
  // reserved box + native chrome (the player renders its shell before/without media) — the point on show.
  el.src = 'data:video/mp4;base64,AAAA'
  el.label = 'Specimen player (no real media — the reserved box and native chrome are the exhibit)'
  section.append(el)
  return section
}
