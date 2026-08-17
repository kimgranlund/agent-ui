// devtools-harness.ts — the chat & A2UI dev/debug harness page (GH #1122, ADR-0200 clause 5 /
// devtools-harness SPEC-R8/R9; decomp n4). Site-internal by the ADR-0137 placement law: the portable
// core (transports · `recordTurn` · the capture format) lives in `@agent-ui/devtools`; this page is the
// COMPOSED browser surface over the shipped primitives — the reused `ui-conversation` chat thread (the
// a2ui-chat re-host idiom, SPEC-N4: no new chat component), a backend switcher over `listBackends`
// rows, the live raw-payload timeline pane (one NDJSON row per `DevtoolsEvent`, copyable), the A2UI
// canvas render-confirm view (per-surface verdicts re-emitted as `render` events — browser truth,
// SPEC-R9: a failure is a visible verdict row, never a blank canvas), and capture export/import
// (SPEC-R10, `parseCapture`/`serializeCapture` — ONE format module owns serialization).
//
// The ONE construction site (SPEC-R2 AC1 / R8 AC2): `makeTransport(id)` below is the only place a
// backend becomes a transport — switching backends changes NOTHING else on this page. The recorder is
// the package's own `recordTurn` (SPEC-R7's one producer); the page re-stamps `seq` at page level so
// the multi-turn page timeline stays contiguous-from-0 (the capture's own `seq` contract), and appends
// its `render`/`client` events into the SAME timeline — one vocabulary, no second shape.
//
// DOM hooks (SPEC-R8 AC3): every affordance the `@agent-ui/devtools/playwright` helper drives carries
// a stable `data-devtools` attribute — the helper's selector list and this page's hooks are the SAME
// list, drift-gated by the harness smoke specs. Hooks: `backend` (+`data-backend-id`/`data-active`/
// `data-available`) · `status` (+`data-turn-state`/`data-turn-count`) · `conversation` · `timeline`
// (+ per-row `data-devtools-event`) · `copy-timeline` · `canvas` · `verdict` (+`data-surface-id`/
// `data-ok`) · `export` · `capture-output` · `capture-input` · `import`.
import { mountFullBleedPage } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import './devtools-harness.css'
import '@agent-ui/app/conversation.css' // ui-conversation's own thread/narration layout (LLD-C6)
import '@agent-ui/app/conversation-dialog.css' // the adopted-or-created log's own scroll/layout CSS (ADR-0180)
import '@agent-ui/app/conversation-composer.css' // the composed ui-conversation-composer's own layout/parts CSS
import '@agent-ui/app/conversation' // self-defines <ui-conversation> (+ <ui-surface-host>/<ui-conversation-composer>)
import type { UIConversationElement } from '@agent-ui/app'
import { createRenderer } from '@agent-ui/a2ui'
import type { RendererHost, A2uiClientMessage } from '@agent-ui/a2ui'
import { canvasButtonSeed } from '@agent-ui/a2ui/examples' // the shared seed shelf — shown ≡ fed ≡ GATED (ADR-0055)
import { createLoopbackPair } from '@agent-ui/a2a'
import {
  scriptTransport,
  replayTransport,
  proxyTransport,
  peerTransport,
  listBackends,
  DEFAULT_PROXY_MOUNT,
  recordTurn,
  serializeDevtoolsEvent,
  parseCapture,
  serializeCapture,
  CaptureParseError,
  DEVTOOLS_CAPTURE_KIND,
  DEVTOOLS_CAPTURE_VERSION,
} from '@agent-ui/devtools'
import type { DevtoolsEvent, DevtoolsCapture, BackendId } from '@agent-ui/devtools'
import { nextTurn, appendUserTurn, appendAssistantTurn, frameClientMessage, shouldRunTurn } from '../lib/agent-runtime.ts'
import type { AgentTransport, TurnInput, Session } from '../lib/agent-runtime.ts'

const { content } = mountFullBleedPage()

// ── the replay seed: the canvas-button example, serialized as its JSONL wire (shown ≡ fed ≡ gated) ─────
const SEED_LINES = canvasButtonSeed.messages.map((m) => JSON.stringify(m))
const REPLAY_TIMELINES: string[][] = [SEED_LINES]

// ── page scaffold (light-DOM chrome only — never restyles a ui-* control) ──────────────────────────────
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  return node
}

const root = el('div', 'devtools-harness')

const controls = el('header', 'dh-controls')
const title = el('h1', 'dh-title')
title.textContent = 'Devtools Harness'
const backendBar = el('div', 'dh-backends')
const statusLine = el('p', 'dh-status')
statusLine.setAttribute('aria-live', 'polite')
statusLine.dataset.devtools = 'status'
statusLine.dataset.turnState = 'idle'
statusLine.dataset.turnCount = '0'
controls.append(title, backendBar, statusLine)

const chatPane = el('section', 'dh-pane dh-chat')
const chatHead = document.createElement('h2')
chatHead.textContent = 'Conversation'
const conv = document.createElement('ui-conversation') as UIConversationElement
conv.setAttribute('disclosure', '') // opt IN to the raw-wire per-turn dump (ADR-0129 clause 3 — a debug page wants it)
conv.dataset.devtools = 'conversation'
chatPane.append(chatHead, conv)

const timelinePane = el('section', 'dh-pane dh-timeline')
const timelineHead = document.createElement('h2')
timelineHead.textContent = 'DevtoolsEvent timeline (NDJSON)'
const copyBtn = document.createElement('ui-button')
copyBtn.setAttribute('variant', 'ghost')
copyBtn.setAttribute('size', 'small')
copyBtn.setAttribute('tabindex', '0')
copyBtn.textContent = 'Copy'
copyBtn.dataset.devtools = 'copy-timeline'
timelineHead.append(copyBtn)
const timelineList = document.createElement('ol')
timelineList.dataset.devtools = 'timeline'
timelinePane.append(timelineHead, timelineList)

const canvasPane = el('section', 'dh-pane dh-canvas')
const canvasHead = document.createElement('h2')
canvasHead.textContent = 'Canvas render-confirm'
const canvasEl = el('div', 'dh-canvas-surface')
canvasEl.dataset.devtools = 'canvas'
const verdictList = el('ul', 'dh-verdicts')
const captureBox = el('div', 'dh-capture')
const captureOutput = document.createElement('textarea')
captureOutput.readOnly = true
captureOutput.placeholder = 'Exported capture JSON appears here (copyable).'
captureOutput.dataset.devtools = 'capture-output'
const captureInput = document.createElement('textarea')
captureInput.placeholder = 'Paste a DevtoolsCapture JSON here, then Import — it replays on the replay backend.'
captureInput.dataset.devtools = 'capture-input'
const captureActions = el('div', 'dh-capture-actions')
const exportBtn = document.createElement('ui-button')
exportBtn.setAttribute('variant', 'soft')
exportBtn.setAttribute('size', 'small')
exportBtn.setAttribute('tabindex', '0')
exportBtn.textContent = 'Export capture'
exportBtn.dataset.devtools = 'export'
const importBtn = document.createElement('ui-button')
importBtn.setAttribute('variant', 'soft')
importBtn.setAttribute('size', 'small')
importBtn.setAttribute('tabindex', '0')
importBtn.textContent = 'Import capture'
importBtn.dataset.devtools = 'import'
captureActions.append(exportBtn, importBtn)
captureBox.append(captureActions, captureOutput, captureInput)
canvasPane.append(canvasHead, canvasEl, verdictList, captureBox)

root.append(controls, chatPane, timelinePane, canvasPane)
content.append(root)

function status(text: string): void {
  statusLine.textContent = text
}

// ── the page timeline — ONE vocabulary (SPEC-R7): recordTurn's events re-stamped with a page-level
// contiguous seq, plus this page's own `render`/`client` events, all in one list the capture stores. ───
let pageSeq = 0
const pageTimeline: DevtoolsEvent[] = []

function pushEvent(event: DevtoolsEvent): void {
  const stamped = { ...event, seq: pageSeq } as DevtoolsEvent
  pageSeq += 1
  pageTimeline.push(stamped)
  const row = document.createElement('li')
  row.dataset.devtoolsEvent = stamped.kind
  row.textContent = serializeDevtoolsEvent(stamped)
  timelineList.append(row)
  timelineList.scrollTop = timelineList.scrollHeight
}

copyBtn.addEventListener('click', () => {
  const text = pageTimeline.map((e) => serializeDevtoolsEvent(e)).join('\n')
  const clipboard = navigator.clipboard as { writeText?: (t: string) => Promise<void> } | undefined
  if (clipboard?.writeText !== undefined) {
    clipboard.writeText(text).then(
      () => status(`Copied ${pageTimeline.length} NDJSON line(s).`),
      () => status('Clipboard unavailable — select the rows and copy manually.'),
    )
  } else {
    status('Clipboard unavailable — select the rows and copy manually.')
  }
})

// ── the canvas render-confirm view (SPEC-R9): the REAL renderer, public surface only (the a2ui-canvas
// posture) — per-surface verdicts derive from what the renderer actually accepted + what the DOM holds. ─
const host: RendererHost = createRenderer()
host.mount(canvasEl)
const surfaceErrors = new Map<string, string>() // VALIDATION_FAILED text per surfaceId, this turn
host.onClientMessage((message) => {
  if ('error' in message && message.error.code === 'VALIDATION_FAILED') {
    surfaceErrors.set(message.error.surfaceId, message.error.message)
  }
})

function emitVerdict(surfaceId: string): void {
  const error = surfaceErrors.get(surfaceId)
  // Per-surface root presence (GH #1165 — retired the global-canvas heuristic): the renderer stamps
  // each attached root with `data-a2ui-surface`, so a silently-empty surface reads ok:false even when
  // ANOTHER surface put DOM on the canvas.
  // (Attribute EQUALITY over children, not a selector — no CSS.escape dependency; roots attach as
  // direct children of the mount.)
  const hasRoot = [...canvasEl.children].some((child) => child.getAttribute('data-a2ui-surface') === surfaceId)
  const ok = error === undefined && hasRoot
  pushEvent({
    seq: 0, // re-stamped by pushEvent
    at: new Date().toISOString(),
    kind: 'render',
    surfaceId,
    ok,
    ...(error !== undefined ? { error } : {}),
  })
  const row = document.createElement('li')
  row.dataset.devtools = 'verdict'
  row.dataset.surfaceId = surfaceId
  row.dataset.ok = String(ok)
  row.textContent = ok ? `${surfaceId} — rendered` : `${surfaceId} — FAILED: ${error ?? 'no root mounted on the canvas'}`
  verdictList.append(row)
}

/** Pull every surfaceId a parsed server message names — the message-body arms (`createSurface`,
 *  `updateComponents`, …) each carry one; a malformed line contributes none (the renderer reports it). */
function surfaceIdsOf(line: string): string[] {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>
    const ids: string[] = []
    for (const value of Object.values(parsed)) {
      if (typeof value === 'object' && value !== null && typeof (value as { surfaceId?: unknown }).surfaceId === 'string') {
        ids.push((value as { surfaceId: string }).surfaceId)
      }
    }
    return ids
  } catch {
    return []
  }
}

// ── the backends — descriptor rows feed the switcher (SPEC-R2); ONE construction site below ────────────
let backendId: BackendId = 'replay'
let importedCapture: DevtoolsCapture | undefined
let disposePeer: (() => void) | undefined

/** The page's in-browser scripted A2A peer: a loopback pair whose far end answers every inbound message
 *  with the seed lines — the arena's message-level isolation posture as a demo backend. */
function makeLoopbackPeerTransport(): AgentTransport {
  const [ours, theirs] = createLoopbackPair()
  void (async () => {
    try {
      for await (const _msg of theirs.receive()) {
        await theirs.send({
          kind: 'message',
          role: 'agent',
          parts: SEED_LINES.map((text) => ({ kind: 'text' as const, text })),
          messageId: 'harness-peer-reply',
        })
      }
    } catch {
      // both ends were closed by a backend switch — a post-close send is moot
    }
  })()
  disposePeer = () => {
    ours.close()
    theirs.close()
  }
  return peerTransport(ours)
}

/** THE one construction site (SPEC-R2 AC1 / SPEC-R8 AC2): backend id in, `AgentTransport` out —
 *  swapping backends changes nothing else on this page. */
function makeTransport(id: BackendId): AgentTransport {
  disposePeer?.()
  disposePeer = undefined
  switch (id) {
    case 'replay':
      return importedCapture !== undefined ? replayTransport(importedCapture) : scriptTransport(REPLAY_TIMELINES)
    case 'proxy':
      return proxyTransport({ url: DEFAULT_PROXY_MOUNT })
    case 'a2a':
      return makeLoopbackPeerTransport()
  }
}

let transport: AgentTransport = makeTransport(backendId)

const backendButtons = new Map<BackendId, HTMLElement>()
for (const descriptor of listBackends()) {
  const btn = document.createElement('ui-button')
  btn.setAttribute('variant', 'soft')
  btn.setAttribute('size', 'small')
  btn.setAttribute('tabindex', '0')
  btn.textContent = descriptor.label
  btn.dataset.devtools = 'backend'
  btn.dataset.backendId = descriptor.id
  btn.dataset.active = String(descriptor.id === backendId)
  btn.addEventListener('click', () => selectBackend(descriptor.id))
  backendButtons.set(descriptor.id, btn)
  backendBar.append(btn)
  // Availability is a rendering fact (SPEC-R2 AC2 — a probe failure reads false, never throws).
  void descriptor.available().then((ok) => {
    btn.dataset.available = String(ok)
  })
}

function selectBackend(id: BackendId): void {
  backendId = id
  transport = makeTransport(id)
  for (const [rowId, btn] of backendButtons) btn.dataset.active = String(rowId === id)
  status(`Backend: ${id}. Send a prompt to run a turn.`)
}

// ── the turn loop — recordTurn wraps the transport (SPEC-R7's one producer); the conversation renders
// the chat; the timeline pane logs every event; verdicts land after the turn settles (SPEC-R9). ────────
let session: Session = { turns: [] }
let busy = false
let turnCount = 0

async function runTurn(input: TurnInput): Promise<void> {
  if (busy) return
  busy = true
  statusLine.dataset.turnState = 'running'
  const handle = conv.beginAgentTurn()
  const turnLines: string[] = []
  const turnSurfaces = new Set<string>()
  surfaceErrors.clear()
  let note: string | undefined
  let failure: string | undefined

  try {
    for await (const event of recordTurn(transport, input, { backend: backendId })) {
      pushEvent(event)
      if (event.kind === 'line') {
        turnLines.push(event.line)
        for (const id of surfaceIdsOf(event.line)) turnSurfaces.add(id)
        handle.ingestLine(event.line) // the conversation's inline surface mounts
        host.ingest(event.line) // the canvas render-confirm view — the same wire, the real renderer
      } else if (event.kind === 'meta') {
        if (event.meta.progress !== undefined) handle.progress(event.meta.progress)
        if (event.meta.note !== undefined) note = event.meta.note
        if (event.meta.error !== undefined) failure = event.meta.error
      } else if (event.kind === 'error') {
        failure = event.message
      }
      // turn-start / turn-end need no page-side handling beyond the timeline row.
    }

    if (failure !== undefined) {
      // Failed turns are TIMELINE-ONLY by design: the session transcript keeps committed turns,
    // the timeline keeps everything (S4–S6 code-checker nit, named not fixed).
    handle.fail(failure) // the primitive's own system bubble (a2ui-chat's GH #415 discipline)
      status(`⚠ ${failure}`)
      return
    }
    if (note !== undefined) handle.setNote(note)
    handle.finalize()
    for (const surfaceId of turnSurfaces) {
      host.finalize(surfaceId) // validate the COMPLETE set (ADR-0002) — failures emit VALIDATION_FAILED
      emitVerdict(surfaceId) // browser truth, visible row + `render` event (SPEC-R9 AC1)
    }
    session = appendUserTurn(session, input.kind === 'intent' ? input.text : frameClientMessage(input.message))
    session = appendAssistantTurn(session, turnLines.join('\n'))
  } finally {
    busy = false
    turnCount += 1
    statusLine.dataset.turnCount = String(turnCount)
    statusLine.dataset.turnState = 'idle'
  }
}

conv.onSubmit((text) => void runTurn({ kind: 'intent', text, session }))
conv.onClientMessage((message: A2uiClientMessage) => {
  if (!shouldRunTurn(message)) return // an explicit wantResponse:false opt-out applies silently (ADR-0088 §3)
  pushEvent({ seq: 0, at: new Date().toISOString(), kind: 'client', message }) // the page's own injection (SPEC-R7)
  void runTurn(nextTurn(session, message))
})

// ── capture export/import (SPEC-R10) — parseCapture/serializeCapture, the ONE format module ───────────
exportBtn.addEventListener('click', () => {
  const capture: DevtoolsCapture = {
    kind: DEVTOOLS_CAPTURE_KIND,
    version: DEVTOOLS_CAPTURE_VERSION,
    createdAt: new Date().toISOString(),
    backend: backendId,
    session,
    timeline: [...pageTimeline],
  }
  captureOutput.value = serializeCapture(capture)
  status(`Exported ${pageTimeline.length} event(s) — copy the JSON from the output box.`)
})

importBtn.addEventListener('click', () => {
  try {
    importedCapture = parseCapture(captureInput.value)
    selectBackend('replay') // the imported capture replays on the replay backend (SPEC-R10 AC1)
    status(`Imported capture (${importedCapture.timeline.length} events) — replay backend armed. Send a prompt to replay.`)
  } catch (err) {
    importedCapture = undefined
    status(err instanceof CaptureParseError ? `Import failed: ${err.message}` : 'Import failed: not a capture.')
  }
})

status('Backend: replay. Send a prompt to run the canned canvas-button turn.')
