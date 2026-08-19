// site/pages/image-demo.ts — the ui-image demo (tier=display; pairs with image-doc.ts, the API page). Mounts
// the REAL control in a believable product situation — a rental-listing photo gallery: one `usage-hint="hero"`
// lead photo with a bottom-scrim caption, a `1/1` thumbnail strip, the `fit` cover/contain difference on a
// portrait source in a landscape frame, and a MODEL-DRIVEN aspect switch (buttons rewrite `aspect` on the live
// hero, the same shape an agent's data-model write would take). ui-image emits NO events (image.md
// `events: []`) — there is no event log to keep, and this page does not fake one. Sources are inline SVG data
// URIs (the image-doc.ts / avatar-doc.ts precedent): offline-safe, zero binary assets, deterministic in tests.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (section spacing + .demo-figure)
import { el, exampleSection, captioned, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-image — demo',
  intro:
    'A rental listing\'s photo gallery, live: a hero photo (usage-hint="hero" — eager, high fetch priority) ' +
    'with a bottom-scrim caption, a square thumbnail strip, cover vs contain on a portrait source, and a ' +
    'model-driven aspect switch on the hero. Every box is reserved before its image loads (zero CLS). ' +
    'The API table is on the ui-image API page.',
})

// ── photo sources — inline SVG "photos" (offline-safe; the image-doc.ts precedent) ──────────────────────────
interface Photo {
  readonly alt: string
  readonly src: string
}

function svgPhoto(width: number, height: number, top: string, bottom: string, accent: string): string {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
        `<stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>` +
        '</linearGradient></defs>' +
        `<rect width="${width}" height="${height}" fill="url(#g)"/>` +
        `<circle cx="${Math.round(width * 0.78)}" cy="${Math.round(height * 0.24)}" r="${Math.round(Math.min(width, height) * 0.09)}" fill="${accent}"/>` +
        `<rect y="${Math.round(height * 0.72)}" width="${width}" height="${Math.round(height * 0.28)}" fill="${bottom}" opacity="0.85"/>` +
        '</svg>',
    )
  )
}

const HERO: Photo = { alt: 'Living room with floor-to-ceiling windows facing the harbor', src: svgPhoto(640, 360, '#6ea8d8', '#1b3a5c', '#fff5d6') }
const PORTRAIT: Photo = { alt: 'Stairwell to the loft bedroom', src: svgPhoto(300, 480, '#d9b38c', '#5c3a1b', '#fff5d6') }
const THUMBS: readonly Photo[] = [
  { alt: 'Kitchen island in oak', src: svgPhoto(400, 400, '#c9d8b6', '#3f5c2a', '#fff5d6') },
  { alt: 'Bathroom with walk-in shower', src: svgPhoto(400, 400, '#b6c9d8', '#2a3f5c', '#fff5d6') },
  { alt: 'Balcony at dusk', src: svgPhoto(400, 400, '#d8b6c9', '#5c2a3f', '#fff5d6') },
  { alt: 'Building entrance', src: svgPhoto(400, 400, '#d8d0b6', '#5c542a', '#fff5d6') },
]

function image(photo: Photo, attrs: Record<string, string> = {}, width = '10rem'): HTMLElement {
  const img = el('ui-image', { src: photo.src, alt: photo.alt, ...attrs })
  img.style.inlineSize = width
  return img
}

// ── the hero — usage-hint="hero", a scrim caption, and the model-driven aspect switch ───────────────────────
const hero = image(HERO, { aspect: '16/9', 'usage-hint': 'hero' }, 'min(100%, 32rem)')
hero.append(el('span', {}, [document.createTextNode('Harborview loft · 2 bed · from €1,850/mo')]))

const aspectRow = el('div', { style: 'display:flex; gap:0.5rem; flex-wrap:wrap; margin-block-start:0.75rem;' })
for (const ratio of ['16/9', '4/3', '1/1', '21/9'] as const) {
  const b = uiButton(`aspect="${ratio}"`, ratio === '16/9' ? 'solid' : 'soft')
  b.addEventListener('click', () => {
    hero.setAttribute('aspect', ratio)
    for (const sibling of aspectRow.querySelectorAll('ui-button')) sibling.setAttribute('variant', sibling === b ? 'solid' : 'soft')
  })
  aspectRow.append(b)
}

const heroNote = el('p', {}, [
  document.createTextNode('The caption is default-slotted light DOM pinned over the bottom scrim — the '),
  el('code', {}, [document.createTextNode('<img data-part="media">')]),
  document.createTextNode(' is created once and never replaced, so the caption survives every attribute write. Switching '),
  el('code', {}, [document.createTextNode('aspect')]),
  document.createTextNode(' re-reserves the box instantly; the photo re-crops under object-fit: cover.'),
])

// ── the thumbnail strip — 1/1, usage-hint="thumb" (lazy) ────────────────────────────────────────────────────
const strip = el('div', { style: 'display:flex; gap:0.75rem; flex-wrap:wrap;' })
for (const photo of THUMBS) strip.append(image(photo, { aspect: '1/1', 'usage-hint': 'thumb' }, '7rem'))

// ── fit: cover vs contain — a portrait source in a landscape frame ─────────────────────────────────────────
const fitRow = el('div', { style: 'display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-start;' }, [
  captioned('fit="cover" (default) — fills, crops the stairwell top and bottom', image(PORTRAIT, { aspect: '4/3', fit: 'cover' }, '14rem')),
  captioned('fit="contain" — letterboxes, the whole frame survives', image(PORTRAIT, { aspect: '4/3', fit: 'contain' }, '14rem')),
])

content.append(
  exampleSection('Hero photo with caption', hero, aspectRow, heroNote),
  exampleSection('Thumbnail strip (aspect="1/1", usage-hint="thumb")', strip),
  exampleSection('fit: cover vs contain', fitRow),
)
