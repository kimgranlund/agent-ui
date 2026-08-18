// site/pages/image-doc.ts — the ui-image API doc page (GH #1189, tier=display ⇒ {doc} only). DERIVED from
// `image.md` via the shared doc-page.ts renderer: the attribute table is built from the parsed `attributes[]`
// and the parts[] surface renders as the descriptor-derived Parts table — so neither can drift from the
// contract the trip-wire enforces (ADR-0004). The specimens are hand-authored (a doc page has no source to
// derive representative image data from) — a self-contained inline-SVG data URI (the avatar-doc.ts
// `PORTRAIT_SRC` precedent: offline-safe, no flaky live-network dependency in a browser/jsdom test run)
// demonstrating the zero-CLS aspect-ratio box across ratios, the fit=cover/contain letterboxing difference,
// and the bottom-scrim caption (R2).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadImageDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading, specimenRow } from '../lib/doc-page.ts'

// A self-contained inline SVG data URI — no network fetch, works offline and in every test environment (the
// avatar-doc.ts `PORTRAIT_SRC` precedent). A "horizon" gradient reads legibly under either `fit` value and
// any `aspect` ratio.
const HARBOR_SRC =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#6ea8d8"/><stop offset="1" stop-color="#1b3a5c"/>' +
      '</linearGradient></defs>' +
      '<rect width="320" height="180" fill="url(#g)"/>' +
      '<circle cx="256" cy="48" r="20" fill="#fff5d6"/>' +
      '<rect y="128" width="320" height="52" fill="#0e2338"/>' +
      '</svg>',
  )
const HARBOR_ALT = 'Boats moored in the harbor at sunset'

const { descriptor, body } = loadImageDoc()

const { content } = mountPage({
  title: 'ui-image — API',
  intro:
    'The Display-class URL-sourced content image (GH #1189 R1/R2) — a reserved aspect-ratio box around a ' +
    'real <img>, with native lazy-loading and an optional bottom-scrim caption. Not interactive, not ' +
    'form-associated: no events, no keyboard contract, no [size]/[scale] control geometry — unlike ui-avatar, ' +
    'there is no fallback chain here, just the <img> mechanics. Generated from image.md: the attribute and ' +
    'parts tables are descriptor-derived; the specimens below show the zero-CLS aspect box, the fit ' +
    'letterboxing difference, and the bottom-scrim caption.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(
    heading(2, 'Examples'),
    labelled(
      'Zero CLS, any aspect',
      'The same source at three `aspect` ratios — the box is reserved before the image has any natural ' +
        'dimensions to report, whether or not `aspect` is supplied.',
      specimenRow([
        image({ aspect: '16/9' }),
        image({ aspect: '1/1' }),
        image({ aspect: '4/3' }),
      ]),
    ),
    labelled(
      '`fit`: cover vs contain',
      '`cover` (default) fills and crops the frame; `contain` letterboxes, preserving the whole image.',
      specimenRow([image({ fit: 'cover' }), image({ fit: 'contain' })]),
    ),
    labelled(
      'The bottom-scrim caption (R2)',
      'Default-slotted (unnamed) light-DOM content is pinned to the bottom over a flat-scrim wash — a ' +
        'caption-less image (above) paints no scrim box at all.',
      specimenRow([captionedImage()]),
    ),
  )
  return section
}

function labelled(title: string, description: string, node: HTMLElement): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'margin: 0 0 1.75rem;'
  const h = heading(3, title)
  const p = document.createElement('p')
  p.textContent = description
  wrap.append(h, p, node)
  return wrap
}

function image(attrs: Record<string, string>): HTMLElement {
  const el = document.createElement('ui-image')
  el.setAttribute('src', HARBOR_SRC)
  el.setAttribute('alt', HARBOR_ALT)
  el.style.cssText = 'width: 10rem;'
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

function captionedImage(): HTMLElement {
  const el = image({ aspect: '16/9' })
  el.style.cssText = 'width: 16rem;'
  const caption = document.createElement('span')
  caption.textContent = HARBOR_ALT
  el.append(caption)
  return el
}
