// site/pages/video-demo.ts — the ui-video demo (tier=display; pairs with video-doc.ts, the API page). Mounts
// the REAL native-<video controls> player in a believable product situation — a course's lesson page: a 16/9
// lesson player with a poster frame, a 9/16 vertical "short" beside it, the three `preload` policies side by
// side, and the empty-src rule proven MODEL-DRIVEN (a button writes `src` onto an empty player; the
// `<video data-part="media">` appears only then — never a dead shell before). ui-video emits NO events
// (video.md `events: []` — the native element owns playback), so there is no event log and this page fakes
// none. No media files ship with the site: posters are inline SVG data URIs, and `src` is a tiny data: URI
// (the video-doc.ts posture) — the reserved box, the poster, and the native chrome are the exhibit.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (section spacing + .demo-figure)
import { el, exampleSection, captioned, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-video — demo',
  intro:
    'A course lesson page, live: the 16/9 lesson player with a poster frame, a 9/16 vertical short, the ' +
    'three preload policies, and the empty-src rule — an empty player renders NO <video> at all until a ' +
    'model write supplies a source. Native chrome only; the box is reserved before any metadata loads. ' +
    'The API table is on the ui-video API page.',
})

// ── poster frames — inline SVG (no media files in the repo) ────────────────────────────────────────────────
function poster(width: number, height: number, title: string, top: string, bottom: string): string {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
        `<stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>` +
        '</linearGradient></defs>' +
        `<rect width="${width}" height="${height}" fill="url(#g)"/>` +
        `<text x="${Math.round(width / 2)}" y="${Math.round(height / 2)}" font-family="system-ui, sans-serif" font-size="${Math.round(Math.min(width, height) * 0.09)}" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${title}</text>` +
        '</svg>',
    )
  )
}

// A tiny, intentionally-unresolvable data: URI — exercises the reserved box + native chrome without shipping
// bytes (video-doc.ts's own posture). A real deployment points `src` at a hosted file.
const CLIP_SRC = 'data:video/mp4;base64,AAAA'

function player(attrs: Record<string, string>, width: string): HTMLElement {
  const v = el('ui-video', attrs)
  v.style.inlineSize = width
  return v
}

// ── the lesson player — 16/9 (default aspect), poster, preload="metadata" (default) ────────────────────────
const lesson = player(
  { src: CLIP_SRC, label: 'Lesson 3 · Signals and effects (12:40)', poster: poster(640, 360, 'Lesson 3 · Signals & effects', '#1b3a5c', '#6ea8d8') },
  'min(100%, 32rem)',
)
const short = player(
  { src: CLIP_SRC, aspect: '9/16', label: 'Short · Why effects re-run (0:45)', poster: poster(270, 480, 'Short', '#5c2a3f', '#d8b6c9') },
  '9rem',
)
const lessonRow = el('div', { style: 'display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-start;' }, [
  captioned('aspect="16/9" (default) · poster · preload="metadata"', lesson),
  captioned('aspect="9/16" — a vertical short', short),
])

// ── preload policies ────────────────────────────────────────────────────────────────────────────────────────
const preloadRow = el('div', { style: 'display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-start;' })
for (const policy of ['none', 'metadata', 'auto'] as const) {
  preloadRow.append(
    captioned(
      `preload="${policy}"`,
      player({ src: CLIP_SRC, preload: policy, label: `Lesson 4 · Derived state — preload ${policy}`, poster: poster(320, 180, `preload=${policy}`, '#3f5c2a', '#c9d8b6') }, '12rem'),
    ),
  )
}
const preloadNote = el('p', {}, [
  document.createTextNode('The policy passes through verbatim to the native '),
  el('code', {}, [document.createTextNode('<video preload>')]),
  document.createTextNode(' — none defers every byte until play, metadata (default) fetches dimensions/duration only, auto lets the UA buffer ahead. Autoplay/loop/muted are deliberately absent at v1.'),
])

// ── the empty-src rule, model-driven ───────────────────────────────────────────────────────────────────────
const lazyPlayer = player({ label: 'Lesson 5 · Cleanup and disposal (9:12)', poster: poster(640, 360, 'Lesson 5', '#5c542a', '#d8d0b6') }, 'min(100%, 28rem)')
const loadButton = uiButton('Load lesson (write src)', 'solid')
const clearButton = uiButton('Clear (src = "")', 'soft')
const state = el('p', { 'aria-live': 'polite', style: 'margin:0.5rem 0 0; font-family: var(--ui-font-mono, ui-monospace, monospace); font-size: 0.85em;' })
function reportState(): void {
  const media = lazyPlayer.querySelector('[data-part="media"]')
  state.textContent = media === null ? 'src is empty → no <video> in the DOM (only the reserved box).' : 'src set → <video data-part="media" controls> is live inside the box.'
}
loadButton.addEventListener('click', () => {
  lazyPlayer.setAttribute('src', CLIP_SRC)
  queueMicrotask(reportState)
})
clearButton.addEventListener('click', () => {
  lazyPlayer.setAttribute('src', '')
  queueMicrotask(reportState)
})
reportState()
const lazyRow = el('div', { style: 'display:flex; gap:0.5rem; flex-wrap:wrap; margin-block-start:0.75rem;' }, [loadButton, clearButton])

content.append(
  exampleSection('Lesson player with poster', lessonRow),
  exampleSection('preload policies', preloadRow, preloadNote),
  exampleSection('Empty src renders no player (model-driven)', lazyPlayer, lazyRow, state),
)
