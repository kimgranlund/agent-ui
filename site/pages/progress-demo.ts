// site/pages/progress-demo.ts — the ui-progress demo (the ratified `demo` tier; pairs with progress-doc.ts, the
// API page). Realistic long-running-work scenarios over the REAL control: a BUTTON-DRIVEN attachment upload
// (determinate — `current` advances against `max` on a timer, one line per file), a knowledge-base INDEXING run
// (indeterminate while the document count is unknown, then determinate once it is, then complete), and a
// discrete "step N of M" onboarding readout (`segments`, SPEC-R1 Amendment v1) stepped by Back/Next. Every
// driven write lands in the update log, so the page proves `current`/`max`/`segments` round-trip live.
// ui-progress is display-only (no events, SPEC-R1); the control owns the rail geometry, clamping, and the
// reduced-motion sweep (progress.ts + progress.css) — this page only drives + logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { captioned, el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-progress — demo',
  intro:
    'Progress bars doing real work, live. Start the upload and watch current advance file by file; run the ' +
    'indexer and watch it switch from an indeterminate sweep to a counted bar once the total is known; step ' +
    'the onboarding readout with Back/Next. Every write lands in the update log. The API table is on the ' +
    'ui-progress API page.',
})

const text = (s: string): Text => document.createTextNode(s)

/** bar — one live `<ui-progress>` (the real control, never mocked), width-bounded so a rail reads. */
function bar(attrs: Record<string, string>): HTMLElement {
  const b = el('ui-progress', attrs)
  b.style.cssText = 'max-inline-size:28rem;'
  return b
}

function controls(...nodes: readonly Node[]): HTMLElement {
  return el('div', { style: 'display:flex; flex-wrap:wrap; gap:0.5rem; margin-block-end:0.75rem;' }, nodes)
}

// ── the shared update log ────────────────────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logLine(message: string): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${message}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

// ── 1. Attachment upload — determinate, button-driven ────────────────────────────────────────────────────────
const FILES = [
  { name: 'q3-board-deck.pdf', kb: 4200 },
  { name: 'hiring-plan.xlsx', kb: 860 },
  { name: 'offsite-photos.zip', kb: 12800 },
] as const
const TOTAL_KB = FILES.reduce((n, f) => n + f.kb, 0)

const upload = bar({ current: '0', max: String(TOTAL_KB), label: 'Uploading 3 attachments' })
const uploadStatus = el('p', { style: 'margin:0.5rem 0 0;' }, [text('Idle — 3 files queued (17.9 MB).')])
let uploadTimer: ReturnType<typeof setInterval> | null = null

function stopUpload(): void {
  if (uploadTimer !== null) clearInterval(uploadTimer)
  uploadTimer = null
}
function startUpload(): void {
  stopUpload()
  let sent = 0
  let fileIndex = 0
  upload.setAttribute('current', '0')
  upload.setAttribute('label', 'Uploading 3 attachments')
  uploadStatus.textContent = `Uploading ${FILES[0].name}…`
  logLine(`upload  start  max=${TOTAL_KB} (kB)`)
  uploadTimer = setInterval(() => {
    sent = Math.min(TOTAL_KB, sent + 640)
    upload.setAttribute('current', String(sent))
    // one log line per file boundary — the moment a file finishes, not every tick
    let doneKb = 0
    for (let i = 0; i <= fileIndex && i < FILES.length; i += 1) doneKb += FILES[i].kb
    if (fileIndex < FILES.length && sent >= doneKb) {
      logLine(`upload  ${FILES[fileIndex].name} done  current=${sent}/${TOTAL_KB}`)
      fileIndex += 1
      uploadStatus.textContent = fileIndex < FILES.length ? `Uploading ${FILES[fileIndex].name}…` : 'All files uploaded.'
    }
    if (sent >= TOTAL_KB) {
      stopUpload()
      upload.setAttribute('label', 'Upload complete')
      logLine(`upload  complete  current=${TOTAL_KB}/${TOTAL_KB}`)
    }
  }, 120)
}
function resetUpload(): void {
  stopUpload()
  upload.setAttribute('current', '0')
  upload.setAttribute('label', 'Uploading 3 attachments')
  uploadStatus.textContent = 'Idle — 3 files queued (17.9 MB).'
  logLine('upload  reset  current=0')
}
const startUploadBtn = uiButton('Start upload', 'soft')
const resetUploadBtn = uiButton('Reset', 'soft')
startUploadBtn.addEventListener('click', startUpload)
resetUploadBtn.addEventListener('click', resetUpload)

// ── 2. Knowledge-base indexing — indeterminate → determinate → complete ──────────────────────────────────────
const DOC_COUNT = 48
const indexer = bar({ label: 'Indexer idle' })
const indexerStatus = el('p', { style: 'margin:0.5rem 0 0;' }, [text('Idle.')])
let indexTimer: ReturnType<typeof setInterval> | null = null
let countTimer: ReturnType<typeof setTimeout> | null = null

function stopIndexing(): void {
  if (indexTimer !== null) clearInterval(indexTimer)
  if (countTimer !== null) clearTimeout(countTimer)
  indexTimer = null
  countTimer = null
}
function startIndexing(): void {
  stopIndexing()
  // phase 1: the total is unknown ⇒ no `current` ⇒ the indeterminate sweep ("working", not "0%")
  indexer.removeAttribute('current')
  indexer.setAttribute('label', 'Counting documents')
  indexerStatus.textContent = 'Counting documents in the workspace…'
  logLine('index  start  current=null (indeterminate)')
  countTimer = setTimeout(() => {
    // phase 2: the count is known ⇒ determinate against max=DOC_COUNT
    let done = 0
    indexer.setAttribute('max', String(DOC_COUNT))
    indexer.setAttribute('current', '0')
    indexer.setAttribute('label', `Indexing ${DOC_COUNT} documents`)
    indexerStatus.textContent = `Found ${DOC_COUNT} documents — indexing…`
    logLine(`index  count known  max=${DOC_COUNT}  current=0`)
    indexTimer = setInterval(() => {
      done = Math.min(DOC_COUNT, done + 3)
      indexer.setAttribute('current', String(done))
      if (done % 12 === 0 || done === DOC_COUNT) logLine(`index  current=${done}/${DOC_COUNT}`)
      if (done >= DOC_COUNT) {
        stopIndexing()
        indexer.setAttribute('label', 'Index up to date')
        indexerStatus.textContent = `Indexed ${DOC_COUNT} documents.`
        logLine('index  complete')
      }
    }, 150)
  }, 1400)
}
const startIndexBtn = uiButton('Index knowledge base', 'soft')
startIndexBtn.addEventListener('click', startIndexing)

// ── 3. Onboarding readout — discrete "step N of M" via `segments` ───────────────────────────────────────────
const STEPS = ['Welcome', 'Workspace name', 'Invite teammates', 'Choose a theme', 'Done'] as const
let step = 2
const stepper = bar({ current: String(step), segments: String(STEPS.length), label: `Step ${step} of ${STEPS.length}` })
const stepStatus = el('p', { style: 'margin:0.5rem 0 0;' }, [text(`Step ${step} of ${STEPS.length} — ${STEPS[step - 1]}`)])
function goTo(next: number): void {
  step = Math.max(0, Math.min(STEPS.length, next))
  stepper.setAttribute('current', String(step))
  stepper.setAttribute('label', `Step ${step} of ${STEPS.length}`)
  stepStatus.textContent = step === 0 ? 'Not started.' : `Step ${step} of ${STEPS.length} — ${STEPS[step - 1]}`
  logLine(`steps  current=${step}  segments=${STEPS.length}`)
}
const backBtn = uiButton('Back', 'soft')
const nextBtn = uiButton('Next', 'soft')
backBtn.addEventListener('click', () => goTo(step - 1))
nextBtn.addEventListener('click', () => goTo(step + 1))

const stepNote = el('p', {}, [
  text('With '),
  el('code', {}, [text('segments')]),
  text(' set, the rail is drawn as discrete cells and '),
  el('code', {}, [text('max')]),
  text(' is ignored — the value floors to a whole step count.'),
])

// ── 4. Static states — the models side by side (no timers) ───────────────────────────────────────────────────
const states = el('div', { style: 'display:flex; flex-direction:column; gap:1rem;' }, [
  captioned('determinate — current=64 max=100', bar({ current: '64', label: 'Syncing calendar' })),
  captioned('indeterminate — no current', bar({ label: 'Waiting for the server' })),
  captioned('discrete — current=3 segments=4', bar({ current: '3', segments: '4', label: 'Step 3 of 4' })),
  captioned('clamped — current=130 max=100 renders full, never overflows', bar({ current: '130', label: 'Over max' })),
  captioned('unlabeled — still role=progressbar, never silent', bar({ current: '20' })),
])

content.append(
  exampleSection('Attachment upload (determinate, button-driven)', controls(startUploadBtn, resetUploadBtn), upload, uploadStatus),
  exampleSection('Knowledge-base indexing (indeterminate → determinate)', controls(startIndexBtn), indexer, indexerStatus),
  exampleSection('Onboarding readout (segments)', controls(backBtn, nextBtn), stepper, stepStatus, stepNote),
  exampleSection('The models side by side', states),
  exampleSection('Update log', log),
)
