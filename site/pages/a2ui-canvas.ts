// a2ui-canvas.ts — the wave-4 CAPSTONE page (B-canvas). This is the payoff of the whole stack: a shared
// 2-line A2UI seed payload is fed through the REAL @agent-ui/a2ui renderer and becomes a LIVE, clickable
// <ui-button>, and the click round-trips back out as an A2UI `action` client→server message. Nothing here
// reaches into renderer internals — it uses the public host surface (`createRenderer`) exactly as the server
// transport would, so the page IS the integration proof the renderer.test.ts asserts, made visible.
//
// Data flow, left→right: [1] PAYLOAD (the two JSONL lines, shown as readable JSON) → ingest() → [2] RENDERED
// SURFACE (the upgraded ui-button mounts under #surface) → click → [3] MESSAGES (every onClientMessage —
// actions on click, plus any PARSE/SCHEMA/CATALOG/IDGRAPH errors — appended, pretty-printed).
//
// The payload also drives a SECOND server-message kind: a server-initiated `callFunction` RPC (ADR-0034 /
// SPEC-R14). Two buttons fire one each — a `clientOrRemote` ping that round-trips a `functionResponse`, and a
// `clientOnly` call the renderer rejects with `INVALID_FUNCTION_CALL` (the hard-floor guard) — both surfacing
// on the SAME client→server channel (region 3), proving the RPC path through the public host surface.

import { mountFullBleedPage } from './_page.ts' // FIRST import — foundation CSS cascade + self-defining ui-* controls
import './a2ui-canvas.css' // page-local layout chrome only (the 3-region flow + the log)
import { codeBlock } from '../lib/code-block.ts' // shared <pre><code> previews (textContent, no injection)
import { createRenderer } from '@agent-ui/a2ui'
import type { RendererHost, A2uiClientMessage, A2uiServerMessage } from '@agent-ui/a2ui'
import { canvasButtonSeed } from '@agent-ui/a2ui/examples' // the shared seed shelf (ADR-0055) — shown ≡ fed ≡ GATED

// FULL-BLEED: the canvas owns the whole `.app-page` region (no sticky page-header/footer) and lays out its own
// 3-region view (payload → rendered surface → messages), each region carrying its own heading + blurb. The
// per-region context replaces a page-level intro; the document <title> in a2ui-canvas.html names the page.
const { content } = mountFullBleedPage()

// ── the payload: the shared canvas-button seed (ADR-0055) fed as JSONL (renderer dispatch.ts envelope shape) ─
// The two server messages now live ONCE on the example seed shelf (`@agent-ui/a2ui/examples`), extracted from
// this page's former literal: line 1 stands up surface "canvas" on the default `agent-ui` catalog, line 2 sends
// one Button root whose `action:{action:'submit'}` the host STRIPS from the DOM node and re-wires as
// click→emitAction. Importing the seed makes shown ≡ fed ≡ GATED — the SAME objects this page displays and
// feeds are what `examples.test.ts` validates + render-smokes at check time; drift is now a failing test, not a
// visual surprise. The seed's `surfaceId` is the `finalize` target.
const SURFACE_ID = canvasButtonSeed.surfaceId
const PAYLOAD = canvasButtonSeed.messages
const jsonl = (message: A2uiServerMessage): string => JSON.stringify(message)

// ── server-initiated callFunction RPC (ADR-0034 / SPEC-R14) — two simulated server calls ───────────────────
// A `callFunction` is surfaceless: the server invokes a catalog function by name with CONCRETE args, and the
// renderer answers on the client→server channel. `functionCallId` is the top-level correlation id copied
// verbatim into the reply. `ping` (clientOrRemote) → `functionResponse{call:'ping', value:true}` when
// `wantResponse`. `required` is clientOnly → the renderer rejects it `INVALID_FUNCTION_CALL` regardless of
// wantResponse (the hard-floor guard, ADR-0034 amendment) — the same guard the gallery's checks rely on.
const PING_CALL: A2uiServerMessage = {
  version: 'v1.0',
  functionCallId: 'fc1',
  wantResponse: true,
  callFunction: { call: 'ping' },
}
const REQUIRED_CALL: A2uiServerMessage = {
  version: 'v1.0',
  functionCallId: 'fc2',
  callFunction: { call: 'required', args: { value: '' } },
}

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
const messages = region('3', 'Client → server messages', 'Every message the renderer emits — actions on click, callFunction responses/errors, any validation errors.')
const logList = document.createElement('ol')
logList.className = 'msg-log'
logList.setAttribute('aria-live', 'polite')
let seq = 0
// Discriminate the three outbound arms (A2uiClientMessage = action | functionResponse | error) into a styled
// kind + a scannable head line; the full envelope still pretty-prints below (the source of truth).
function describe(message: A2uiClientMessage): { kind: string; label: string } {
  if ('action' in message) return { kind: 'action', label: 'action ▸ server' }
  if ('functionResponse' in message) {
    const r = message.functionResponse
    return { kind: 'response', label: `functionResponse ▸ server · ${r.call} = ${JSON.stringify(r.value)} (${r.functionCallId})` }
  }
  const e = message.error // A2uiWireError: VALIDATION_FAILED+surfaceId | INVALID_FUNCTION_CALL+functionCallId
  const id = 'functionCallId' in e ? e.functionCallId : e.surfaceId
  return { kind: 'error', label: `error ▸ server · ${e.code} (${id})` }
}
function appendLog(message: A2uiClientMessage): void {
  seq += 1
  const { kind, label } = describe(message)
  const item = document.createElement('li')
  item.dataset.kind = kind
  const head = document.createElement('div')
  head.className = 'msg-head'
  head.textContent = `#${String(seq).padStart(2, '0')}  ${label}`
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

// Fire one server-initiated callFunction into the CURRENT renderer via the same public `ingest` the transport
// uses — the renderer's reply (functionResponse or INVALID_FUNCTION_CALL) emits back through onClientMessage
// into the log. `host` is always live here (run() ran on first paint); the `?.` only narrows the type.
function simulateCall(message: A2uiServerMessage): void {
  host?.ingest(jsonl(message))
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

// The server-RPC affordances (dogfooding ui-button) — a captioned group below the run controls: fire a
// callFunction and watch the renderer answer in region 3. "Ping" (clientOrRemote) round-trips a
// functionResponse; "Call required" (clientOnly) is rejected INVALID_FUNCTION_CALL — the guard, demoed live.
const rpc = document.createElement('div')
rpc.className = 'rpc-group'
const rpcCaption = document.createElement('p')
rpcCaption.className = 'rpc-caption'
rpcCaption.textContent = 'Server-initiated callFunction (RPC) — ADR-0034'
const rpcTools = document.createElement('div')
rpcTools.className = 'toolbar'
rpcTools.append(
  controlButton('Ping (server-invocable)', 'soft', () => simulateCall(PING_CALL)),
  controlButton('Call required (clientOnly)', 'soft', () => simulateCall(REQUIRED_CALL)),
)
rpc.append(rpcCaption, rpcTools)
payload.body.append(rpc)

content.append(payload.section, arrow(), rendered.section, arrow(), messages.section)

run() // drive the flow on first paint so the canvas arrives already rendered
