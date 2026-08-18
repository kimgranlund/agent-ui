// site/pages/audio-demo.ts — the ui-audio demo (tier=display; pairs with audio-doc.ts, the API page). Mounts
// the REAL native-<audio controls> bar in a believable product situation — a support thread with voice memos:
// a playable memo (a WAV synthesized AT RUNTIME from a sine sweep — real, audible, and NOT a binary asset in the
// repo), the three `preload` policies on a podcast-episode list, and the empty-src rule proven MODEL-DRIVEN (a
// button writes `src` onto an empty player; the `<audio data-part="media">` appears only then — never a dead
// bar before). ui-audio emits NO events (audio.md `events: []` — the native element owns playback), so there is
// no event log and this page fakes none.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (section spacing + .demo-figure)
import { el, exampleSection, captioned, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-audio — demo',
  intro:
    'A support thread with voice memos, live: a playable memo (a WAV synthesized in the browser — press play), ' +
    'the three preload policies on an episode list, and the empty-src rule — an empty player renders NO ' +
    '<audio> at all until a model write supplies a source. The UA bar is the whole visual; no custom chrome. ' +
    'The API table is on the ui-audio API page.',
})

// ── a runtime-synthesized WAV (8-bit mono PCM) — real, playable audio with zero bytes in the repo ──────────
function toneWav(seconds: number, fromHz: number, toHz: number, sampleRate = 8000): string {
  const frames = Math.floor(seconds * sampleRate)
  const bytes = new Uint8Array(44 + frames)
  const view = new DataView(bytes.buffer)
  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i)
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + frames, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate, true) // byte rate (8-bit mono)
  view.setUint16(32, 1, true) // block align
  view.setUint16(34, 8, true) // bits per sample
  ascii(36, 'data')
  view.setUint32(40, frames, true)
  let phase = 0
  for (let i = 0; i < frames; i += 1) {
    const t = i / frames
    const hz = fromHz + (toHz - fromHz) * t
    phase += (2 * Math.PI * hz) / sampleRate
    const envelope = Math.min(1, t * 20, (1 - t) * 20) // 50 ms fade in/out — no click
    bytes[44 + i] = Math.round(128 + 96 * envelope * Math.sin(phase))
  }
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return `data:audio/wav;base64,${btoa(binary)}`
}

const MEMO_SRC = toneWav(2, 440, 660)

function player(attrs: Record<string, string>, width = 'min(100%, 28rem)'): HTMLElement {
  const a = el('ui-audio', attrs)
  a.style.cssText = `display:block; inline-size:${width};`
  return a
}

// ── the voice memo — a playable specimen ───────────────────────────────────────────────────────────────────
const memo = player({ src: MEMO_SRC, label: 'Voice memo from Priya · 0:02 · "the login loop repros on Safari"' })
const memoNote = el('p', {}, [
  document.createTextNode('This one plays: the source is a two-second sine sweep synthesized on page load as a '),
  el('code', {}, [document.createTextNode('data:audio/wav')]),
  document.createTextNode(' URI — the site ships no media files. '),
  el('code', {}, [document.createTextNode('label')]),
  document.createTextNode(' becomes the interior '),
  el('code', {}, [document.createTextNode('<audio aria-label>')]),
  document.createTextNode(' — the bar\'s accessible name; the host mints no ARIA of its own.'),
])

// ── preload policies — an episode list ─────────────────────────────────────────────────────────────────────
const EPISODES = [
  { policy: 'none', title: 'Ep. 41 · Effects that never re-run (38 min)' },
  { policy: 'metadata', title: 'Ep. 42 · The scheduler, explained (44 min)' },
  { policy: 'auto', title: 'Ep. 43 · Live Q&A (61 min)' },
] as const
const list = el('div', { style: 'display:flex; flex-direction:column; gap:1rem;' })
for (const ep of EPISODES) list.append(captioned(`preload="${ep.policy}" — ${ep.title}`, player({ src: MEMO_SRC, preload: ep.policy, label: ep.title })))
const preloadNote = el('p', {}, [
  document.createTextNode('The policy passes through verbatim to the native '),
  el('code', {}, [document.createTextNode('<audio preload>')]),
  document.createTextNode(' — none defers every byte until play, metadata (default) fetches duration only, auto lets the UA buffer ahead. Autoplay/loop are deliberately absent at v1.'),
])

// ── the empty-src rule, model-driven ───────────────────────────────────────────────────────────────────────
const lazyPlayer = player({ label: 'Voice memo from Ola · pending upload' })
const loadButton = uiButton('Attach memo (write src)', 'solid')
const clearButton = uiButton('Detach (src = "")', 'soft')
const state = el('p', { 'aria-live': 'polite', style: 'margin:0.5rem 0 0; font-family: var(--ui-font-mono, ui-monospace, monospace); font-size: 0.85em;' })
function reportState(): void {
  const media = lazyPlayer.querySelector('[data-part="media"]')
  state.textContent = media === null ? 'src is empty → no <audio> in the DOM (nothing rendered, no dead bar).' : 'src set → <audio data-part="media" controls> is live.'
}
loadButton.addEventListener('click', () => {
  lazyPlayer.setAttribute('src', MEMO_SRC)
  queueMicrotask(reportState)
})
clearButton.addEventListener('click', () => {
  lazyPlayer.setAttribute('src', '')
  queueMicrotask(reportState)
})
reportState()
const lazyRow = el('div', { style: 'display:flex; gap:0.5rem; flex-wrap:wrap; margin-block-start:0.75rem;' }, [loadButton, clearButton])

content.append(
  exampleSection('A playable voice memo', memo, memoNote),
  exampleSection('preload policies on an episode list', list, preloadNote),
  exampleSection('Empty src renders no player (model-driven)', lazyPlayer, lazyRow, state),
)
