// site/pages/attachment-demo.ts — the ui-attachment demo (tier=display; pairs with attachment-doc.ts, the API
// page). Mounts the REAL file card in a believable product situation — a support-chat composer: a pending
// attachment strip the user grows ("Attach next file") and shrinks (a Remove button per card), plus a received
// message's attachment list. ui-attachment itself emits NOTHING (attachment.md `events: []` — a display leaf);
// the add/remove actions are the COMPOSER's, driven by real ui-buttons around each card, and the action log
// records exactly those page-level events — honestly labelled as such, never attributed to the card. Names,
// mime types and sizes are hand-authored fixtures; nothing is uploaded (ADR-0073 trust boundary untouched).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection, inline, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-attachment — demo',
  intro:
    'A support-chat composer, live: attach files into the pending strip and remove them again — every card is ' +
    'a real ui-attachment (mime-derived glyph, name, formatted size); the add/remove buttons and the action ' +
    'log belong to the composer, since the card itself is a display leaf that emits nothing. Below it, a ' +
    'received message\'s attachment list. The API table is on the ui-attachment API page.',
})

interface FileFixture {
  readonly name: string
  readonly mimeType: string
  readonly sizeBytes: number
}

// The user's "file picker" queue — hand-authored fixtures, attached one per click.
const QUEUE: readonly FileFixture[] = [
  { name: 'safari-login-loop.mov', mimeType: 'video/quicktime', sizeBytes: 18_400_000 },
  { name: 'console-export.json', mimeType: 'application/json', sizeBytes: 42_300 },
  { name: 'network.har', mimeType: 'application/octet-stream', sizeBytes: 3_900_000 },
  { name: 'screenshot-2026-08-18.png', mimeType: 'image/png', sizeBytes: 611_000 },
]

// The agent's reply carries its own attachments.
const RECEIVED: readonly FileFixture[] = [
  { name: 'workaround-steps.pdf', mimeType: 'application/pdf', sizeBytes: 96_500 },
  { name: 'patched-config.zip', mimeType: 'application/zip', sizeBytes: 1_250_000 },
  { name: 'walkthrough.mp3', mimeType: 'audio/mpeg', sizeBytes: 2_800_000 },
]

function card(file: FileFixture): HTMLElement {
  return el('ui-attachment', { filename: file.name, 'mime-type': file.mimeType, 'size-bytes': String(file.sizeBytes) })
}

// ── the composer action log — page-level add/remove, honestly labelled ─────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logAction(action: 'attach' | 'remove', file: FileFixture, pending: number): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  composer:${action}  →  ${file.name}  pending=${String(pending)}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

// ── the pending strip ──────────────────────────────────────────────────────────────────────────────────────
const strip = el('div', { role: 'list', 'aria-label': 'Pending attachments', style: 'display:flex; gap:0.75rem; flex-wrap:wrap; min-block-size:3rem; align-items:flex-start;' })
const empty = el('p', { style: 'margin:0; opacity:0.7;' }, [document.createTextNode('No files attached yet.')])
strip.append(empty)
let next = 0

function pendingCount(): number {
  return strip.querySelectorAll('ui-attachment').length
}
function refreshChrome(): void {
  empty.hidden = pendingCount() > 0
  attachButton.toggleAttribute('disabled', next >= QUEUE.length)
}

function attach(file: FileFixture): void {
  const row = el('div', { role: 'listitem', style: 'display:flex; gap:0.375rem; align-items:center;' })
  const remove = uiButton('Remove', 'ghost')
  remove.setAttribute('size', 'sm')
  remove.setAttribute('aria-label', `Remove ${file.name}`)
  remove.addEventListener('click', () => {
    row.remove()
    refreshChrome()
    logAction('remove', file, pendingCount())
  })
  row.append(card(file), remove)
  strip.append(row)
  refreshChrome()
  logAction('attach', file, pendingCount())
}

const attachButton = inline(uiButton('Attach next file', 'solid')) // ADR-0223: bare demo action in block flow — hugs
attachButton.addEventListener('click', () => {
  const file = QUEUE[next]
  if (!file) return
  next += 1
  attach(file)
})
attach(QUEUE[0]!) // the thread opens with one file already attached
next = 1
refreshChrome()

const composerNote = el('p', {}, [
  document.createTextNode('Each card reads its glyph from '),
  el('code', {}, [document.createTextNode('mime-type')]),
  document.createTextNode(' and formats '),
  el('code', {}, [document.createTextNode('size-bytes')]),
  document.createTextNode(' through Intl.NumberFormat; a long name ellipsizes inside its cell. The Remove buttons and the log are the composer\'s — ui-attachment has no events, no focus, no keyboard contract of its own.'),
])

// ── a received message's attachment list ───────────────────────────────────────────────────────────────────
const message = el('div', { style: 'display:grid; gap:0.5rem; max-inline-size: 36rem;' }, [
  el('p', { style: 'margin:0;' }, [document.createTextNode('Support agent · 14:22 — Thanks, reproduced it. Try the attached workaround; the patched config disables the redirect on Safari 26.')]),
  el('div', { role: 'list', 'aria-label': 'Attachments in this message', style: 'display:flex; gap:0.75rem; flex-wrap:wrap;' }, RECEIVED.map((f) => el('div', { role: 'listitem' }, [card(f)]))),
])

content.append(
  exampleSection('Composer: pending attachments', strip, el('div', { style: 'margin-block-start:0.75rem;' }, [attachButton]), composerNote),
  exampleSection('Received message with attachments', message),
  exampleSection('Composer action log', log),
)
