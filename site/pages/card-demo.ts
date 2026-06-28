// site/pages/card-demo.ts — the ui-card composition demo (the ratified container `demo`). Shows the card doing
// its job with the REAL region sub-elements: the three regions composed, the elevation × brightness surface
// range (the ladder iterated from the parsed card enum), the one-level nested radius, and the scrollable +
// scroll-fade content hooks. All surface/radius/scroll behaviour is the card's own CSS — this page only
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
    'range, the one-level nested radius, and the scrollable / scroll-fade content hooks. The API table is on ' +
    'the ui-card API page.',
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

// ── [4] scrollable + scroll-fade — a constrained card whose content scrolls with an edge fade ───────────────
const longText = 'Scrollable content. '.repeat(40)
const scrollCard = el('ui-card', {}, [
  el('ui-card-header', {}, [text('Scrollable')]),
  el('ui-card-content', { scrollable: '', 'scroll-fade': '' }, [text(longText)]),
])
applyDemoWidth(scrollCard, '24rem')
scrollCard.style.maxBlockSize = '12rem' // constrain the card so `scrollable` bites (the body's 1fr can shrink)
const scrollNote = document.createElement('p')
scrollNote.textContent =
  'ui-card-content carries two pure-CSS hooks: scrollable (a scrolling viewport — it needs a constrained card ' +
  'block-size to bite, supplied here) and scroll-fade (a mask edge fade). The shipped fade is a static symmetric mask.'

content.append(
  exampleSection('Composed regions', composed),
  exampleSection('Surface — elevation range', surfaceGrid),
  exampleSection('Nested radius (one level)', nested),
  exampleSection('Scrollable content', scrollNote, scrollCard),
)
