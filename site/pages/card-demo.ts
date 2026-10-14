// site/pages/card-demo.ts — the ui-card composition demo (the ratified container `demo`). Shows the card doing
// its job with the REAL region sub-elements: the three regions composed, the elevation × brightness surface
// range (the ladder iterated from the parsed card enum), a nested card at the card level radius, and the whole-container
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
    'range, a nested card at the card level radius, and whole-container scroll mode with its automatic edge fade. The API ' +
    'table is on the ui-card API page.',
})

const text = (s: string): Text => document.createTextNode(s)

// A decorative leading mark for a header, canonical slot=leading (anatomy.md). A dot is a functional mark, so it is a
// ui-glyph in its glyph box (decorative by default), not a text bullet at the title's size (T-0150).
function dot(): HTMLElement {
  const mark = el('ui-glyph', { slot: 'leading', symbol: 'dot' })
  mark.style.color = 'var(--md-sys-color-neutral-on-surface-variant)' // a quiet mark, never heavier than the title
  return mark
}

// The header's trailing more-actions affordance: an icon-only ghost ui-button (a round square), not a bare
// "⋯" glyph with no button shape (T-0141).
function moreButton(): HTMLElement {
  const icon = el('ui-icon', { slot: 'leading', 'data-role': 'icon', symbol: 'dots-three' })
  return el('ui-button', { slot: 'trailing', variant: 'ghost', 'icon-only': '', 'aria-label': 'More actions' }, [icon])
}

// ── [1] the composed card — header (leading + title + trailing) · content · footer (action) ─────────────────
const composed = el('ui-card', {}, [
  el('ui-card-header', {}, [dot(), text('Account'), moreButton()]),
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

// ── [3] nested card: card › ui-card-content › card. Under the derived geometry (ADR-0245) every card keeps
// its level radius (3n, Kim's ruling), so the nested card does NOT step its corner down; the ADR-0018
// --ui-card-child-radius decrement is only the legacy fallback when --md-sys-card-radius is unset. ────────────
const nested = el('ui-card', { elevation: '1' }, [
  el('ui-card-content', {}, [
    text('Outer card. A card keeps its level radius wherever it sits, so the nested card below has the same corner.'),
    // a permanent specimen of the nested shape, so the render lint's nested-card rule skips it by marker (T-0170)
    el('ui-card', { elevation: '2', 'data-dogfood-ok': 'nested-card', 'data-dogfood-reason': 'the nested-card radius specimen (T-0141 ruling)' }, [
      el('ui-card-content', {}, [text('Nested card, at the card level radius.')]),
    ]),
  ]),
])
applyDemoWidth(nested, '24rem')

// ── [4] scrollable — ui-card-content IS the viewport (REVISED 2026-07-07): it manages its own overflow and ──
// carries the edge-fade mask directly; the header/footer are OVERLAID peers (position:absolute, no background),
// so the fade stays visible through the WHOLE scroll at any content length, with no author-written wrapper.
// REVISED 2026-07-08 (ADR-0046 Amendment 6): the native scrollbar is HIDDEN (native scrolling is unaffected) —
// the fade is now the sole scroll affordance. ui-card-content becomes a real Tab stop (tabindex=0) with its
// own Arrow/Page/Home/End keyboard handling to compensate (WCAG 2.1.1).
const longText = 'Scrollable content. '.repeat(40)
const scrollCard = el('ui-card', { scrollable: '' }, [
  el('ui-card-header', {}, [text('Scrollable')]),
  el('ui-card-content', {}, [text(longText)]),
  el('ui-card-footer', {}, [text('Footer stays put')]),
])
applyDemoWidth(scrollCard, '24rem')
scrollCard.style.maxBlockSize = '12rem' // constrain the card so scroll mode bites
const scrollNote = document.createElement('p')
scrollNote.textContent =
  'ui-card-content manages its own overflow and carries the automatic edge-fade mask directly — no author-' +
  'written wrapper needed. The header/footer are overlaid peers (no background of their own); the mask fades ' +
  'scrolled content as it passes beneath them (try it) so the see-through reads as fading, not a hard cut. ' +
  'The native scrollbar is hidden — try Tab, then Arrow/Page/Home/End (try it): the fade is the only visible ' +
  'scroll affordance, and the region itself is keyboard-scrollable.'

// ── [5] structured header — ADR-0186's ONE new prop, format="structured" (the Figma dialog-bubble frame's
// "DATE SELECTION" card: leading icon · uppercase mono title · trailing status, a header/body divider, and
// label/value-chip body rows — ui-row[justify='between'] + ui-text[variant='label'] + ui-badge[intent='neutral'],
// the intake's §4b recipe, zero new mechanism). Exactly ONE knob: the `format="structured"` attribute below —
// every other element here is composition of already-shipped controls (ui-icon/ui-badge/ui-row/ui-text).
const labelValueRow = (label: string, value: string): HTMLElement =>
  el('ui-row', { justify: 'between' }, [
    el('ui-text', { variant: 'label' }, [text(label)]),
    el('ui-badge', { intent: 'neutral', label: value }, []),
  ])

const structured = el('ui-card', {}, [
  el('ui-card-header', { format: 'structured' }, [
    el('ui-icon', { slot: 'leading', symbol: 'calendar', 'aria-hidden': 'true' }),
    text('Date selection'),
    el('ui-badge', { slot: 'trailing', intent: 'success', label: 'Confirmed' }),
  ]),
  el('ui-card-content', {}, [labelValueRow('Arrive', 'Aug 14'), labelValueRow('Depart', 'Aug 18')]),
])
applyDemoWidth(structured, '22rem')
const structuredNote = document.createElement('p')
structuredNote.textContent =
  'format="structured" (ui-card-header) repoints the title to the kicker metrics + the fleet mono typeface ' +
  'and adds a header/body divider — the leading/trailing slots and the zero-padding shell law are unchanged. ' +
  'The body rows below are plain composition (ui-row + ui-text + ui-badge), no new mechanism.'

content.append(
  exampleSection('Composed regions', composed),
  exampleSection('Surface — elevation range', surfaceGrid),
  exampleSection('Nested card radius', nested),
  exampleSection('Scrollable content', scrollNote, scrollCard),
  exampleSection('Structured header', structuredNote, structured),
)
