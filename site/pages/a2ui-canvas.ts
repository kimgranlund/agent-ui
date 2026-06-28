// a2ui-canvas.ts — the wave-4 CAPSTONE page (B-canvas). This is the payoff of the whole stack: a literal
// 2-line A2UI payload is fed through the REAL @agent-ui/a2ui renderer and becomes a LIVE, clickable
// <ui-button>, and the click round-trips back out as an A2UI `action` client→server message. Nothing here
// reaches into renderer internals — it uses the public host surface (`createRenderer`) exactly as the server
// transport would, so the page IS the integration proof the renderer.test.ts asserts, made visible.
//
// Data flow, left→right: [1] PAYLOAD (the two JSONL lines, shown as readable JSON) → ingest() → [2] RENDERED
// SURFACE (the upgraded ui-button mounts under #surface) → click → [3] MESSAGES (every onClientMessage —
// actions on click, plus any PARSE/SCHEMA/CATALOG/IDGRAPH errors — appended, pretty-printed).

import { mountFullBleedPage } from './_page.ts' // FIRST import — foundation CSS cascade + self-defining ui-* controls
import './a2ui-canvas.css' // page-local layout chrome only (the 3-region flow + the log)
import { codeBlock } from '../lib/code-block.ts' // shared <pre><code> previews (textContent, no injection)
import { createRenderer } from '@agent-ui/a2ui'
import type { RendererHost, A2uiClientMessage, A2uiServerMessage } from '@agent-ui/a2ui'

// FULL-BLEED: the canvas owns the whole `.app-page` region (no sticky page-header/footer) and lays out its own
// 3-region view (payload → rendered surface → messages), each region carrying its own heading + blurb. The
// per-region context replaces a page-level intro; the document <title> in a2ui-canvas.html names the page.
const { content } = mountFullBleedPage()

// ── the payload: the exact two server messages fed as JSONL (renderer dispatch.ts envelope shape) ──────────
// Line 1 stands up surface "canvas" on the default `agent-ui` catalog (pre-registered by createRenderer).
// Line 2 sends one Button root; `action:{action:'submit'}` is the action-prop shape the host's readActionSpec
// accepts (`{ action: <name> }`), which the host STRIPS from the DOM node and re-wires as click→emitAction.
// Typed as A2uiServerMessage so this page type-checks against the real wire contract (protocol.ts).
const SURFACE_ID = 'canvas'
const CREATE_SURFACE: A2uiServerMessage = {
  version: 'v1.0',
  createSurface: { surfaceId: SURFACE_ID, catalogId: 'agent-ui' },
}
const UPDATE_COMPONENTS: A2uiServerMessage = {
  version: 'v1.0',
  updateComponents: {
    surfaceId: SURFACE_ID,
    components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Click me', action: { action: 'submit' } }],
  },
}
// The literal JSONL the renderer ingests: one compact JSON object per line (newline-delimited). Derived from
// the SAME objects shown in the payload pane, so the displayed input and the fed input can never drift.
const PAYLOAD: readonly A2uiServerMessage[] = [CREATE_SURFACE, UPDATE_COMPONENTS]
const jsonl = (message: A2uiServerMessage): string => JSON.stringify(message)

// ── small light-DOM scaffold helpers (page chrome only — they never restyle a ui-* control) ────────────────
function region(step: string, title: string, blurb: string): { section: HTMLElement; body: HTMLElement } {
  const section = document.createElement('section')
  section.className = 'region'
  const heading = document.createElement('h2')
  const badge = document.createElement('span')
  badge.className = 'region-step'
  badge.textContent = step
  heading.append(badge, document.createTextNode(` ${title}`))
  const lead = document.createElement('p')
  lead.className = 'region-blurb'
  lead.textContent = blurb
  const body = document.createElement('div')
  body.className = 'region-body'
  section.append(heading, lead, body)
  return { section, body }
}

function arrow(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'flow-arrow'
  el.setAttribute('aria-hidden', 'true')
  el.textContent = '→'
  return el
}

// A page affordance, dogfooding the real control (a ui-button with a native click listener). tabindex="0"
// makes it keyboard-activatable (the control sets none itself); the press-activation trait does the rest.
function controlButton(label: string, variant: 'solid' | 'soft' | 'ghost', onClick: () => void): HTMLElement {
  const el = document.createElement('ui-button')
  el.textContent = label
  el.setAttribute('variant', variant)
  el.setAttribute('tabindex', '0')
  el.addEventListener('click', onClick)
  return el
}

// ── [1] PAYLOAD region — the two JSONL lines, shown as readable (pretty) JSON, labelled by envelope key ────
const payload = region('1', 'A2UI payload', 'The two server messages fed to the renderer, one JSONL line each.')
for (const [i, message] of PAYLOAD.entries()) {
  const key = Object.keys(message).find((k) => k !== 'version') ?? '?'
  const figure = document.createElement('figure')
  figure.className = 'payload-line'
  const caption = document.createElement('figcaption')
  caption.textContent = `Line ${i + 1} — ${key}`
  const code = codeBlock(JSON.stringify(message, null, 2), 'json') // pretty for reading; fed compact via jsonl() below
  figure.append(caption, code)
  payload.body.append(figure)
}

// ── [2] RENDERED SURFACE region — where the live ui-button mounts (the renderer attaches the root here) ────
const rendered = region('2', 'Rendered surface', 'The live ui-button the renderer built from the payload.')
const surfaceEl = document.createElement('div')
surfaceEl.id = 'surface'
surfaceEl.className = 'surface'
rendered.body.append(surfaceEl)

// ── [3] MESSAGES region — the client→server log: every onClientMessage (actions + errors), pretty-printed ──
const messages = region('3', 'Client → server messages', 'Every message the renderer emits — actions on click, any errors.')
const logList = document.createElement('ol')
logList.className = 'msg-log'
logList.setAttribute('aria-live', 'polite')
let seq = 0
function appendLog(message: A2uiClientMessage): void {
  seq += 1
  const kind = 'action' in message ? 'action' : 'error'
  const item = document.createElement('li')
  item.dataset.kind = kind
  const head = document.createElement('div')
  head.className = 'msg-head'
  head.textContent = `#${String(seq).padStart(2, '0')}  ${kind === 'action' ? 'action ▸ server' : 'error ▸ server'}`
  const pre = codeBlock(JSON.stringify(message, null, 2), 'json')
  item.append(head, pre)
  logList.append(item)
  logList.scrollTop = logList.scrollHeight
}
messages.body.append(logList)

// ── the demo lifecycle — feed the payload through a fresh renderer; repeatable via "Re-run payload" ────────
// run() tears down any prior renderer (leak-free, N3), clears the surface + log, then drives the public host
// surface end to end exactly as the transport would: subscribe → mount → ingest line 1 → ingest line 2 →
// finalize. The click→action wiring is the host's: it stripped the Button's `action` prop and bound the
// control's click to ActionDispatcher.emitAction, so every click appends an `action` message to the log.
let host: RendererHost | undefined
function run(): void {
  host?.dispose()
  surfaceEl.replaceChildren()
  logList.replaceChildren()
  seq = 0
  host = createRenderer()
  host.onClientMessage(appendLog)
  host.mount(surfaceEl)
  for (const message of PAYLOAD) host.ingest(jsonl(message))
  host.finalize(SURFACE_ID) // validate the COMPLETE set (ADR-0002); a valid root finalizes clean
}

// Toolbar affordances (dogfooding ui-button): re-run the payload (fresh button + cleared log), or clear the
// log alone. Placed in the payload region so "feed input" reads as the start of the flow.
const toolbar = document.createElement('div')
toolbar.className = 'toolbar'
toolbar.append(
  controlButton('Re-run payload', 'solid', run),
  controlButton('Clear log', 'ghost', () => {
    logList.replaceChildren()
    seq = 0
  }),
)
payload.body.append(toolbar)

content.append(payload.section, arrow(), rendered.section, arrow(), messages.section)

run() // drive the flow on first paint so the canvas arrives already rendered
