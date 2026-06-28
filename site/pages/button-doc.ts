// site/pages/button-doc.ts — the ui-button API doc page (T4). DERIVED from `button.md`: the API table is built
// row-by-row from the canonical parser's `attributes[]`, and the live variant/size/state specimens iterate the
// parsed enum members — so neither the table nor those examples can drift from the descriptor the contract
// trip-wire enforces (ADR-0004, one parser / two consumers). The generic table + body renderers live in
// lib/doc-page.ts (shared with every control's doc page); only the button-specific specimens + the Anatomy
// section live here. The Anatomy specimens (ADR-0012) are the one hand-authored block: the position×role
// adornment STRUCTURES (slot=leading/trailing × data-role=icon/caret) are markup SHAPES, not attributes, so
// they are authored here rather than derived from the parse.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadButtonDoc } from '../lib/frontmatter.ts'
import { findAttr, heading, renderApiTable, renderMarkdownBody, specimenRow } from '../lib/doc-page.ts'
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'

// Declared up top (not beside its anatomy-section users) so it is initialised before the render below runs:
// the helpers that read it are reached during the eager `content.append`, ahead of the helper definitions below.
const SVG_NS = 'http://www.w3.org/2000/svg'

const { descriptor, body } = loadButtonDoc()

const { content } = mountPage({
  title: 'ui-button — API',
  intro: 'The reference FACE control. This page is generated from button.md: the API table and the live ' +
    'specimens are derived from the same frontmatter the contract trip-wire validates, so they cannot drift.',
})

content.append(renderApiTable(descriptor.attributes), renderExamples(descriptor), renderAnatomy(), renderMarkdownBody(body))

// ── live specimens (derived from the parsed enum members) ───────────────────────────────────────────────

// renderExamples — working <ui-button> specimens. The variant + size rows iterate the PARSED enum members,
// so adding a variant to button.md adds a specimen here for free; a disabled row shows the inert state.
function renderExamples(d: ParsedDescriptor): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'))

  const variant = findAttr(d, 'variant')
  if (variant?.values) section.append(heading(3, 'Variants'), specimenRow(variant.values.map((v) => button({ variant: v }, v))))

  const size = findAttr(d, 'size')
  if (size?.values) section.append(heading(3, 'Sizes'), specimenRow(size.values.map((s) => button({ size: s }, s))))

  section.append(heading(3, 'States'), specimenRow([button({}, 'Default'), button({ disabled: '' }, 'Disabled')]))
  return section
}

// button — a live specimen: a real <ui-button> with the given attributes set and a text label (its a11y name).
function button(attrs: Record<string, string>, label: string): HTMLElement {
  const el = document.createElement('ui-button')
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value)
  el.textContent = label
  return el
}

// ── anatomy specimens (hand-authored: the position × role adornment structures, ADR-0012) ───────────────

// The structure of one anatomy specimen: a structure caption + the ROLE filling each adornment slot (or none).
// These are markup SHAPES (slot = position × data-role = kind), not attributes, so they are hand-authored here
// rather than derived from the parser. POSITION and ROLE are orthogonal (ADR-0012) — leading/trailing each
// carry an independent role, so the same slots read FORWARD (icon · caret) or REVERSED (caret · icon).
type AdornmentRole = 'icon' | 'caret'
type SlotName = 'leading' | 'trailing'
interface AnatomyShape {
  readonly caption: string
  readonly leading?: AdornmentRole
  readonly trailing?: AdornmentRole
}

// renderAnatomy — a real <ui-button> per structure the family standard names (ADR-0012). The FORWARD set
// (leading icon × trailing caret) and the REVERSED set (leading caret × trailing icon) — proving position ⊥
// role: any role sits in either slot. The shapes are local (not a module const) so they initialise when this
// runs, inside the eager render. Each specimen is captioned with its notation.
function renderAnatomy(): HTMLElement {
  const shapes: readonly AnatomyShape[] = [
    { caption: '[ icon | label ]', leading: 'icon' },
    { caption: '[ label | caret ]', trailing: 'caret' },
    { caption: '[ icon | label | caret ]', leading: 'icon', trailing: 'caret' },
    // Reversed (ADR-0012: position ⊥ role) — the caret on the LEFT, the icon on the RIGHT.
    { caption: '[ caret | label ]', leading: 'caret' },
    { caption: '[ label | icon ]', trailing: 'icon' },
    { caption: '[ caret | label | icon ]', leading: 'caret', trailing: 'icon' },
  ]
  const section = document.createElement('section')
  section.append(
    heading(2, 'Anatomy — [ icon | label | caret ] and reversed [ caret | label | icon ]'),
    specimenRow(shapes.map(anatomySpecimen)),
  )
  return section
}

// anatomySpecimen — one captioned figure: the live button above its structure notation, so the slot/role
// shape reads next to the rendering (the page ships no stylesheet, so the figure carries inline layout).
function anatomySpecimen(shape: AnatomyShape): HTMLElement {
  const figure = document.createElement('figure')
  figure.style.cssText = 'display:flex; flex-direction:column; align-items:flex-start; gap:0.5rem; margin:0;'
  const caption = document.createElement('figcaption')
  const code = document.createElement('code')
  code.textContent = shape.caption
  caption.append(code)
  figure.append(anatomyButton(shape), caption)
  return figure
}

// anatomyButton — a live <ui-button> with the structure's adornments in DOM order (leading → label → trailing).
// The label text is the accessible name; the slotted adornments are decorative. ROLE is dispatched per slot —
// the same slot can carry an icon or a caret (position ⊥ role), so the reversed shapes lead with a caret.
function anatomyButton(shape: AnatomyShape): HTMLElement {
  const el = document.createElement('ui-button')
  if (shape.leading) el.append(makeAdornment('leading', shape.leading))
  el.append(document.createTextNode('Label')) // the label region (the accessible name)
  if (shape.trailing) el.append(makeAdornment('trailing', shape.trailing))
  return el
}

// makeAdornment — dispatch on ROLE to the matching glyph helper, PLACED in the given slot (POSITION). The
// orthogonality (ADR-0012): any role can sit in either slot — a caret can lead, an icon can trail.
function makeAdornment(slot: SlotName, role: AdornmentRole): SVGElement {
  return role === 'icon' ? makeIcon(slot) : makeCaret(slot)
}

// makeIcon — a decorative icon (download glyph), mirroring button-permutations.ts so the doc renders the same.
// The slot PLACES it (POSITION, default leading — its canonical home); data-role="icon" is the content role
// (sized to fill the icon cell, ADR-0012). `currentColor` inherits the button ink; `aria-hidden` keeps the label name.
function makeIcon(slot: SlotName = 'leading'): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('slot', slot) // POSITION (start/end cell)
  svg.setAttribute('data-role', 'icon') // CONTENT role (icon · caret · future tag/badge)
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('viewBox', '0 0 24 24')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', 'M12 3v10m0 0l-4-4m4 4l4-4M5 21h14')
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '2')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')
  svg.append(path)
  return svg
}

// makeCaret — a decorative chevron-down (the dropdown/disclosure adornment), mirroring button-permutations.ts.
// The slot PLACES it (POSITION, default trailing — its canonical home); data-role="caret" is the inline-affordance
// role (the GLYPH sized = font, centered in the icon cell, ADR-0012 §4.6 — wherever the caret sits). The caret
// carries NO semantics — disclosure AX rides the host (G7), so a plain button never lies.
function makeCaret(slot: SlotName = 'trailing'): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('slot', slot) // POSITION (start/end cell)
  svg.setAttribute('data-role', 'caret') // CONTENT role
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('viewBox', '0 0 24 24')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', 'M6 9l6 6 6-6') // chevron-down
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '2')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')
  svg.append(path)
  return svg
}
