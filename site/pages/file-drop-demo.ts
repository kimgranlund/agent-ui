// site/pages/file-drop-demo.ts — the ui-file-drop interaction demo (ADR-0210, GH #1391). Mounts the REAL
// control inside a <form> and proves the host-mediated handle model honestly: a stub `intake` seam mints
// fake-but-plausible descriptors from whatever File the browser hands it (drop / paste / the Browse
// picker) — no bytes ever leave this page, and the descriptors are exactly what a real host's registry
// would hand back. The change event log shows every committed mutation (mint or remove); a live readout
// reads `files` + the FormData round-trip. The control owns the whole commit path (file-drop.ts); this
// page only stages the form, the fake intake seam, and reads it back.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection, uiButton } from '../lib/specimens.ts'
import type { UIFileDropElement, FileHandleDescriptor } from '@agent-ui/components/controls/file-drop'

const { content } = mountPage({
  title: 'ui-file-drop — demo',
  intro: 'The file-drop form field, live inside a <form>. Drag a file onto it, paste one (Cmd/Ctrl+V while ' +
    'focused), or use the Browse button — a stub host `intake` seam mints a fake handle descriptor from ' +
    'whatever File the platform hands it (no bytes ever leave this page). The change log tracks every ' +
    'committed mutation (a mint landing, a chip removed); the readout shows `files` + the FormData ' +
    'round-trip. The API table is on the ui-file-drop API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── the change event log ─────────────────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logEvent(line: string): void {
  seq += 1
  const li = document.createElement('li')
  li.textContent = `#${String(seq).padStart(2, '0')}  ${line}`
  log.append(li)
  log.scrollTop = log.scrollHeight
}

// ── the live ui-file-drop inside a real <form> — multiple, capped at 3 files, 2 MB each. The stub
// `intake` is the ONLY thing standing in for a real host registry: it mints a plausible id and hands back
// the descriptor triple (name/mimeType/sizeBytes) verbatim off the platform File — never touching bytes.
const drop = el('ui-file-drop', {
  name: 'attachments',
  label: 'Drop supporting documents here',
  multiple: '',
  'max-files': '3',
  'max-size-bytes': String(2 * 1024 * 1024),
}) as UIFileDropElement

let mintSeq = 0
drop.intake = async (files) =>
  files.map((f): FileHandleDescriptor => ({ id: `demo-${mintSeq++}`, name: f.name, mimeType: f.type, sizeBytes: f.size }))

const form = el('form', {}, [drop])
form.style.display = 'flex'
form.style.flexDirection = 'column'
form.style.gap = '0.75rem'
form.style.alignItems = 'stretch'
form.style.maxInlineSize = '28rem'

const readout = document.createElement('p')
readout.style.fontFamily = 'var(--md-sys-typeface-mono)'
readout.style.margin = '0'
function refreshReadout(): void {
  const submitted = new FormData(form as HTMLFormElement).get('attachments')
  readout.textContent = `files = ${JSON.stringify(drop.files)}   ·   FormData.get('attachments') = ${JSON.stringify(submitted)}`
}

drop.addEventListener('change', () => {
  logEvent(`change  files=${JSON.stringify(drop.files.map((f) => f.name))}`)
  refreshReadout()
})

const submit = uiButton('Submit', 'solid')
submit.addEventListener('click', (event) => {
  event.preventDefault() // demo only — report the round-trip instead of navigating
  refreshReadout()
  logEvent('submit')
})
form.append(submit)
refreshReadout()

const note = el('p', {}, [
  text('The stub host '), code('intake'), text(' seam above is what makes this demo honest: '),
  text('the control never sees the byte content and neither does this page — only the handed-back '),
  code('{id, name, mimeType, sizeBytes}'), text(' descriptor. A real A2UI host wires the same seam onto '),
  text('its own file registry (ADR-0210 cl.4.2, the renderer’s own separate build).'),
])

content.append(
  exampleSection('Live file-drop in a form (Submit reports the round-trip)', form),
  exampleSection('Form value', readout),
  exampleSection('The host-mediated handle model', note),
  exampleSection('change event log', log),
)
