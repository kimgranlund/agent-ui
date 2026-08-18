// site/pages/audio-doc.ts — the ui-audio API doc page (tier=display ⇒ {doc} only, GH #1209). DERIVED from
// `audio.md` via the shared doc-page.ts renderer. Specimen mirrors video-doc.ts's no-real-media posture.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadAudioDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

const { descriptor, body } = loadAudioDoc()

const { content } = mountPage({
  title: 'ui-audio — API',
  intro:
    'The Display-class native audio player (GH #1209, the A2UI standard-catalog AudioPlayer shape): the ' +
    'real <audio controls>, nothing more — the UA bar IS the visual; no custom chrome, no aspect box. ' +
    'Generated from audio.md: the attribute and parts tables are descriptor-derived.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'))
  const intro = document.createElement('p')
  intro.textContent =
    'An empty src renders no bar at all; a non-empty src builds the native <audio controls> at the UA ' +
    "bar's intrinsic height. The specimen uses a tiny data: URI — the native bar is the exhibit."
  section.append(intro)
  const el = document.createElement('ui-audio') as HTMLElement & { src: string; label: string }
  el.style.cssText = 'max-inline-size: 28rem; display: block;'
  el.src = 'data:audio/mp3;base64,AAAA'
  el.label = 'Specimen player (no real media)'
  section.append(el)
  return section
}
