// site/pages/card-demo.ts — the ui-card composition demo (the ratified container `demo`). Shows the card doing
// its job with the REAL region sub-elements: the three regions composed, the elevation × brightness surface
// range (the ladder iterated from the parsed card enum), the one-level nested radius, and the whole-container
// scroll mode with its automatic edge fade. All surface/radius/scroll behaviour is the card's own CSS — this page only
// composes regions + demo content and supplies display widths/heights (layout context, not a restyle).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome (.demo-grid / captions)
import { loadCardDoc } from '../lib/frontmatter.ts'
import { findAttr } from '../lib/doc-page.ts'
import { applyDemoWidth, captioned, el, exampleSection, uiButton } from '../lib/specimens.ts'

const { descriptor } = loadCardDoc()
const elevations = findAttr(descriptor, 'elevation')?.values ?? [] // the parsed surface ladder

const { content } = mountPage({
  title: 'ui-card — demo',
  intro: 'The card doing its job: the three region sub-elements composed, the elevation × brightness surface ' +
    'range, the one-level nested radius, and whole-container scroll mode with its automatic edge fade. The API ' +
    'table is on the ui-card API page.',
})

const text = (s: string): Text => document.createTextNode(s)

// A decorative leading glyph (aria-hidden) for a header — canonical slot=leading (anatomy.md).
function dot(): HTMLElement {
  const span = document.createElement('span')
  span.setAttribute('slot', 'leading')
  span.setAttribute('aria-hidden', 'true')
  span.textContent = '●'
  return span
}

// ── [1] the composed card — header (leading + title + trailing) · content · footer (action) ─────────────────
const composed = el('ui-card', {}, [
  el('ui-card-header', {}, [dot(), text('Account'), el('span', { slot: 'trailing', 'aria-hidden': 'true' }, [text('⋯')])]),
  el('ui-card-content', {}, [text('A card composes ui-card-header, ui-card-content, and ui-card-footer as a presence-driven grid — an absent region leaves no phantom row.')]),
  el('ui-card-footer', {}, [el('ui-row', { gap: 'sm', justify: 'end' }, [uiButton('Cancel', 'ghost'), uiButton('Save', 'solid')])]),
])
applyDemoWidth(composed, '24rem')

// ── [2] elevation range — the surface ladder (derived from the parsed enum) ─────────────────────────────────
const surfaceGrid = document.createElement('div')
surfaceGrid.className = 'demo-grid'
for (const value of elevations) {
  const c = el('ui-card', { elevation: value }, [
    el('ui-card-content', {}, [text(`elevation = ${value}`)]),
  ])
  surfaceGrid.append(captioned(`[elevation="${value}"]`, c))
}

// ── [3] nested radius (one level) — card › ui-card-content › card, the inner reads --ui-card-child-radius ────
const nested = el('ui-card', { elevation: '1' }, [
  el('ui-card-content', {}, [
    text('Outer card. The nested card below decrements its corner one level (the concentric-corner law, ADR-0018).'),
    el('ui-card', { elevation: '2' }, [el('ui-card-content', {}, [text('Nested card — its radius shrinks with the parent padding.')])]),
  ]),
])
applyDemoWidth(nested, '24rem')

// ── [4a] scrollable — the WRAPPER MODEL (recommended): a <span scroll-wrapper> is the real viewport, so the ──
// edge-fade mask (fixed on ui-card-content, a flex frame around the wrapper) stays visible through the WHOLE
// scroll, not just its extremes.
const longText = 'Scrollable content. '.repeat(40)
const wrapperScrollCard = el('ui-card', { scrollable: '' }, [
  el('ui-card-header', {}, [text('Scrollable')]),
  el('ui-card-content', {}, [el('span', { 'scroll-wrapper': '' }, [text(longText)])]),
  el('ui-card-footer', {}, [text('Footer stays put')]),
])
applyDemoWidth(wrapperScrollCard, '24rem')
wrapperScrollCard.style.maxBlockSize = '12rem' // constrain the card so scroll mode bites
const wrapperScrollNote = document.createElement('p')
wrapperScrollNote.textContent =
  'The RECOMMENDED shape: a <span scroll-wrapper> inside ui-card-content is the real scroll viewport, nested ' +
  'two levels below the header/footer. ui-card-content itself becomes a FIXED flex frame around it that carries ' +
  'the automatic edge-fade mask — because that frame never scrolls, the fade stays visible through the WHOLE ' +
  'scroll (try it), not just near the extremes. Header/footer stay fully crisp at every scroll position.'

// ── [4b] scrollable — the FALLBACK shape (no [scroll-wrapper]): the CARD itself is the scroll viewport, ──
// degrading gracefully to the prior behaviour — the fade is only visible near the scroll extremes for content
// this long.
const fallbackScrollCard = el('ui-card', { scrollable: '' }, [
  el('ui-card-header', {}, [text('Scrollable (fallback)')]),
  el('ui-card-content', {}, [text(longText)]),
  el('ui-card-footer', {}, [text('Footer stays put')]),
])
applyDemoWidth(fallbackScrollCard, '24rem')
fallbackScrollCard.style.maxBlockSize = '12rem'
const fallbackScrollNote = document.createElement('p')
fallbackScrollNote.textContent =
  'The FALLBACK shape: plain ui-card-content children with no [scroll-wrapper] — the CARD itself becomes the ' +
  'scroll viewport (degrading gracefully, not an error). Header/footer stay just as crisp, but for content this ' +
  'long the edge-fade mask (still on ui-card-content) is only visible near the very start/end of the scroll ' +
  "range, not throughout (mask-image paints relative to content's own box, which here IS the full scroll extent)."

content.append(
  exampleSection('Composed regions', composed),
  exampleSection('Surface — elevation range', surfaceGrid),
  exampleSection('Nested radius (one level)', nested),
  exampleSection('Scrollable content — the wrapper model (recommended)', wrapperScrollNote, wrapperScrollCard),
  exampleSection('Scrollable content — the fallback shape (no wrapper)', fallbackScrollNote, fallbackScrollCard),
)
