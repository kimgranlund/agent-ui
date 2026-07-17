// a2ui-live.ts — LLD-C9 / SPEC-R10: the live-agent demo chat app (the ladder's last rung made visible).
// Layout: [ chat | a2ui-canvas ]. The chat drives an AgentTransport; the agent's A2UI stream renders into
// the canvas (a REAL @agent-ui/a2ui surface); interacting with the surface round-trips a client message
// that becomes the next turn ("the agent continues"). The canvas pane is TABS — Canvas (the rendered
// surface, translate-centered), JSON (the JSONL payload), HTML (the rendered markup).
//
// The page consumes ONLY the AgentTransport seam (SPEC-R1): the default is the deterministic RECORDED
// BACKBONE (works offline, in the built static site, and under CI). The LIVE overlay — a real model via
// the dev proxy + the provider switcher — is swapped in ONLY under `import.meta.env.DEV` via a dynamic
// import, so `vite build` tree-shakes it out and no key path is ever baked into the build (SPEC-N2). No
// `fetch`, proxy URL, or transport internal appears in this file's render/round-trip logic — the swap is
// the construction site alone (SPEC-R1 AC1).

import { mountFullBleedPage } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import '@agent-ui/app/app-shell.css' // ui-app-shell region-grid CSS (LLD-C9 re-host), after foundation
import '@agent-ui/app/app-shell' // self-defines ui-app-shell / ui-app-shell-region
import '@agent-ui/app/surface-host.css' // ui-surface-host's own artboard chrome (ADR-0129 Amendment re-host)
import '@agent-ui/app/surface-host' // self-defines <ui-surface-host>
import './a2ui-live.css'
import { codeBlock } from '../lib/code-block.ts'
import type { A2uiClientMessage, A2uiServerMessage } from '@agent-ui/a2ui'
import type { UISurfaceHostElement } from '@agent-ui/app'
import {
  createRecordedTransport,
  recordedTranscript,
  nextTurn,
  appendUserTurn,
  appendAssistantTurn,
  frameClientMessage,
  shouldRunTurn,
  readMetaLine,
  isFeedSurfaceType,
} from '../lib/agent-runtime.ts'
import type { AgentTransport, TurnInput, Session, TurnTrace, AskDeclaration } from '../lib/agent-runtime.ts'
import { AskRegistry, surfaceIdOf, componentTypesOf } from '../lib/ask-registry.ts'
import type { AskEntry } from '../lib/ask-registry.ts'

const { content } = mountFullBleedPage()

// ── small light-DOM chrome helpers (page chrome only — never restyle a ui-* control) ────────────────────
function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  return node
}
function paneTitle(title: string, blurb: string): HTMLElement {
  const head = el('header', 'pane-head')
  const h = document.createElement('h2')
  h.className = 'pane-title'
  h.textContent = title
  const p = el('p', 'pane-blurb')
  p.textContent = blurb
  head.append(h, p)
  return head
}

// ════════════════ the two panes — ui-app-shell regions (LLD-C9/SPEC-R8: the shell replaces this page's own
// hand-rolled two-pane flex chrome; `main` is the mandatory region — SPEC-R3 — so the canvas, the surface
// this page exists to show, takes it, and the chat composer docks into `navigation` alongside it) ════════════════
const shell = document.createElement('ui-app-shell')
const chatPane = document.createElement('ui-app-shell-region')
chatPane.setAttribute('region', 'navigation') // the LEFT column (grid placement only, ADR-0083 decouples the landmark below)
chatPane.setAttribute('landmark', 'complementary') // ADR-0083: the correct ARIA landmark for a chat composer, not "navigation"
chatPane.setAttribute('collapse', 'stack') // ADR-0084: stays visible + full-width when narrow — the composer is primary input, not disposable chrome
chatPane.className = 'chat-pane'
const canvasPane = document.createElement('ui-app-shell-region')
canvasPane.setAttribute('region', 'main')
canvasPane.className = 'canvas-pane'
shell.append(chatPane, canvasPane)
content.append(shell)

// ── chat pane: log · composer · (dev) switcher · reset ──────────────────────────────────────────────────
chatPane.append(paneTitle('Chat', 'Prompt the agent, then interact with the surface it renders.'))
const chatLog = el('div', 'chat-log')
chatLog.setAttribute('aria-live', 'polite')
chatPane.append(chatLog)

function addMessage(role: 'user' | 'agent' | 'system', text: string): void {
  const item = el('div', 'msg')
  item.dataset.role = role
  const who = el('span', 'msg-who')
  who.textContent = role === 'user' ? 'You' : role === 'agent' ? 'Agent' : 'System'
  const body = el('p', 'msg-body')
  body.textContent = text
  item.append(who, body)
  chatLog.append(item)
  chatLog.scrollTop = chatLog.scrollHeight
}

// ADR-0097 §2 — a feed-embedded ask's own message bubble: the SAME `.msg` shape `addMessage` builds (an
// "Agent" row), but its body is a live `<div>` mount for a per-ask `createRenderer()` host (AskRegistry)
// instead of static text — the ask IS the message.
function addAskBubble(surfaceId: string): { bubble: HTMLElement; mountEl: HTMLElement } {
  const item = el('div', 'msg')
  item.dataset.role = 'agent'
  item.dataset.ask = surfaceId
  const who = el('span', 'msg-who')
  who.textContent = 'Agent'
  const mountEl = el('div', 'ask-surface')
  item.append(who, mountEl)
  chatLog.append(item)
  chatLog.scrollTop = chatLog.scrollHeight
  return { bubble: item, mountEl }
}

/** Append a small, visible annotation to a just-frozen ask bubble (ADR-0097 §2: "an annotation line" —
 * truthful history, never hidden). */
function annotateAskFrozen(entry: AskEntry, state: 'answered' | 'bypassed'): void {
  const note = el('p', 'ask-annotation')
  note.textContent = state === 'answered' ? 'Answered.' : 'No longer pending — the conversation moved on.'
  entry.bubble.append(note)
}

const switcherSlot = el('div', 'switcher-slot')

const composer = el('form', 'chat-composer')
const field = document.createElement('ui-text-field')
field.setAttribute('label', 'Message')
field.setAttribute('placeholder', 'Ask the agent to build something…')
const sendBtn = document.createElement('ui-button')
sendBtn.setAttribute('variant', 'solid')
sendBtn.setAttribute('tabindex', '0')
sendBtn.textContent = 'Send'
composer.append(field, sendBtn)

const readField = (): string => String((field as unknown as { value?: string }).value ?? '')
const clearField = (): void => {
  ;(field as unknown as { value: string }).value = ''
}

chatPane.append(switcherSlot, composer) // switcher (dev-only, populated on probe) sits ABOVE the composer

// ── canvas pane: ui-tabs (Canvas · JSON · HTML) — the shipped compound, DOGFOODED in place of the former
// hand-rolled `role=tablist` strip + roving/selectTab (Batch C). ui-tabs owns the tablist part, the tab↔panel
// ARIA wiring (roles/aria-selected/aria-controls/aria-labelledby all via ElementInternals), the roving
// keyboard, and selection — only the active panel shows (the rest keep `hidden` and stay in the DOM). This
// page authors only the tabs/panels and reads the ONE `select` commit event. ───────────────────────────────
canvasPane.append(paneTitle('A2UI canvas', 'The rendered surface, its JSONL payload, and its HTML.'))

const tabs = document.createElement('ui-tabs')
tabs.className = 'canvas-tabs'
tabs.setAttribute('selected', 'canvas') // the active tab's `key` (a plain reflected prop; '' would pick the first)
function makeTab(value: string, label: string): HTMLElement {
  const tab = document.createElement('ui-tab')
  tab.setAttribute('key', value)
  tab.textContent = label
  return tab
}
// The three panels — paired to the tabs by DOM order (tab i ↔ panel i, tabs.md "Anatomy"). Canvas holds the
// shared artboard; JSON/HTML hold scrollable code blocks kept current EAGERLY each turn (refreshJson/refreshHtml).
const canvasPanel = document.createElement('ui-tab-panel')
const jsonPanel = document.createElement('ui-tab-panel')
const htmlPanel = document.createElement('ui-tab-panel')
tabs.append(
  makeTab('canvas', 'Canvas'),
  makeTab('json', 'JSON'),
  makeTab('html', 'HTML'),
  canvasPanel,
  jsonPanel,
  htmlPanel,
)
canvasPane.append(tabs)

// Canvas tab → the persistent shared artboard, now the `ui-surface-host` mount/stream primitive (ADR-0129
// Amendment re-host) in place of the former hand-mounted `lib/canvas-surface.ts` pair. No `label` (parallels
// `ui-conversation`'s own choice, surface-host.md): the tab-panel this element lives in already carries an
// accessible name ("Canvas") via `ui-tabs`' own aria-labelledby wiring — a nested `region` landmark of the
// same name would only be redundant.
let canvasHost = document.createElement('ui-surface-host') as UISurfaceHostElement
canvasPanel.append(canvasHost)

// Switch to the Canvas tab programmatically — a plain reflected `selected` write applies SILENTLY (no `select`
// event echoed, so it never loops back through a listener; binding hygiene, tabs.md). Replaces the old selectTab().
function showCanvas(): void {
  tabs.setAttribute('selected', 'canvas')
}

function refreshJson(lines: string[]): void {
  const pretty = lines.map((l) => JSON.stringify(JSON.parse(l), null, 2)).join('\n')
  jsonPanel.replaceChildren(codeBlock(pretty || '(no payload yet)', 'json'))
}
function refreshHtml(): void {
  const surfaceEl = canvasHost.querySelector('[data-part="surface"]')
  const html = (surfaceEl?.innerHTML ?? '').replace(/></g, '>\n<').trim()
  htmlPanel.replaceChildren(codeBlock(html || '(nothing rendered yet)', 'html'))
}

// ════════════════ the transport + the chat loop ════════════════
// Default: the deterministic recorded backbone (SPEC-R2). Swapped for the live overlay under dev only.
let transport: AgentTransport = createRecordedTransport(recordedTranscript)

/**
 * Test-only injection seam (post-ship review finding 2, SPEC §6 open item): `transport` is otherwise
 * reassigned ONLY by `wireLiveOverlay()` below (the real, dev-only live-key probe), so a jsdom test has no
 * way to drive the page's ask orchestration (buffering/collision/freeze/dataModel-carrying dispatch) end to
 * end without a live key. This lets a test swap in a scripted `AgentTransport` stub before dispatching a
 * turn. Never called by any production path — invisible to `wireLiveOverlay()` and every other real caller.
 */
export function __setTransportForTest(next: AgentTransport): void {
  transport = next
}

let session: Session = { turns: [] }
const allLines: string[] = []
let busy = false

// ADR-0088 §2 — the browser-held decision trace, PARALLEL to `session` (never inside `session.turns`:
// that array is the Messages-API payload the model consumes; a `TurnTrace` is runtime-assembled, never
// something the model authored). `notesByTurnIndex` retains each turn's own `note` (keyed by that turn's
// `TurnTrace.turnIndex`, a `session.turns` MESSAGE index — see meta-line.ts) so the NEXT intent turn can
// inject a grounded "why" digest citing the model's own at-the-time rationale, not a confabulation.
const traces: TurnTrace[] = []
const notesByTurnIndex = new Map<number, string>()

// ADR-0097 §2 — the per-ask lifecycle registry (one createRenderer() host per ask, mounted in its own
// chat bubble) + the collision guard's memory of every surfaceId this conversation has EVER created (a
// canvas surface OR a rendered ask) — an `ask` naming one of these ids again is a stale/reused id, never a
// fresh ask (dropped, defense-in-depth alongside produce()'s own session-known-surface check).
const askRegistry = new AskRegistry()
const knownSurfaceIds = new Set<string>()

canvasHost.onClientMessage(handleClientMessage)

let busyRow: HTMLElement | null = null
function setBusy(next: boolean): void {
  busy = next
  composer.classList.toggle('is-busy', next)
  if (next) {
    sendBtn.setAttribute('aria-disabled', 'true')
    // Show an in-flight indicator in the aria-live log so the wait is both visible and announced.
    busyRow = el('div', 'chat-status')
    busyRow.textContent = 'Agent is working…'
    chatLog.append(busyRow)
    chatLog.scrollTop = chatLog.scrollHeight
  } else {
    sendBtn.removeAttribute('aria-disabled')
    busyRow?.remove()
    busyRow = null
  }
}

function describeClientMessage(m: A2uiClientMessage): string {
  if ('action' in m) return `clicked "${m.action.name}"`
  if ('functionResponse' in m) return `function ${m.functionResponse.call} → ${JSON.stringify(m.functionResponse.value)}`
  return `error: ${m.error.code}`
}

function summarize(lines: string[]): string {
  const kinds = lines.map((l) => {
    const msg = JSON.parse(l) as A2uiServerMessage
    return Object.keys(msg).find((k) => k !== 'version') ?? '?'
  })
  return `Emitted ${lines.length} A2UI message(s): ${kinds.join(', ')}. See the JSON / HTML tabs.`
}

/**
 * Freeze whichever ask is currently pending, if any (ADR-0097 §2) — called ONCE per turn that actually
 * COMPLETES (never for a turn that throws — LLD §6's "a ProduceHalt/transport error leaves a pending ask
 * pending, still answerable" edge). `answeringSurfaceId` is the just-completed turn's OWN action surface
 * id, when the input that drove it was an action (`undefined` for an intent, a functionResponse, or an
 * error) — the pending ask freezes `'answered'` iff it IS that surface, `'bypassed'` otherwise (a typed
 * prose reply, an unrelated canvas action, or a different ask entirely — at most one is ever pending, so
 * this is never ambiguous). Called BEFORE this turn's own fresh ask (if any) is created, so it can never
 * mistake a brand-new ask for the one being frozen.
 */
function freezePriorPendingAsk(answeringSurfaceId: string | undefined): void {
  const pending = askRegistry.pending()
  if (pending === undefined) return
  const state: 'answered' | 'bypassed' = pending.surfaceId === answeringSurfaceId ? 'answered' : 'bypassed'
  if (askRegistry.freeze(pending.surfaceId, state)) annotateAskFrozen(pending, state)
}

/** The `createSurface.surfaceId`s this turn's CANVAS lines create, added to `knownSurfaceIds` as they're
 * ingested (ADR-0097 §1/§2 collision guard — client-side defense-in-depth alongside produce()'s own). */
function noteCreatedSurface(line: string): void {
  let msg: unknown
  try {
    msg = JSON.parse(line)
  } catch {
    return
  }
  const sid = (msg as { createSurface?: { surfaceId?: unknown } }).createSurface?.surfaceId
  if (typeof sid === 'string') knownSurfaceIds.add(sid)
}

async function runTurn(input: TurnInput): Promise<void> {
  if (busy) return
  setBusy(true)
  try {
    const turnLines: string[] = []
    const askLines: string[] = []
    let note: string | undefined
    let ask: AskDeclaration | undefined
    for await (const line of transport.turn(input)) {
      // ADR-0088 §1: peel the reserved leading meta-line BEFORE it ever reaches the renderer — it must
      // never enter `allLines`/the JSON tab or `canvasHost.ingest` (the meta-line is provably not an
      // `A2uiServerMessage`, but filtering here — not just relying on that fact — keeps the renderer's
      // ingest path pristine by construction). ADR-0097 §1: `ask`, if any, rides the SAME meta-line.
      const meta = readMetaLine(line)
      if (meta) {
        note = meta.a2uiMeta.note
        ask = meta.a2uiMeta.ask
        const trace = meta.a2uiMeta.trace
        if (trace) {
          traces.push(trace)
          if (note !== undefined) notesByTurnIndex.set(trace.turnIndex, note)
        }
        continue
      }
      const targetId = surfaceIdOf(line)
      // ADR-0097 §2 (post-ship review finding 3 fix): a line targeting a surface the ask REGISTRY already
      // knows — pending OR frozen — is ask territory, closed to any OTHER turn's canvas lines; only THIS
      // turn's own freshly authored ask (`ask.surfaceId`, buffered below) may still target it. Checking
      // `isFrozen` alone left a one-turn-late gap: freeze only fires AFTER a turn completes (completion-
      // freeze, SPEC-R8), so DURING the very turn that is about to freeze a prior pending ask, that ask is
      // still `pending` — a stale/rogue line aimed at it would pass an `isFrozen` check and mis-route into
      // the canvas host. `has()` closes the gap regardless of pending/frozen state.
      if (targetId !== undefined && askRegistry.has(targetId) && targetId !== ask?.surfaceId) continue
      if (ask !== undefined && targetId === ask.surfaceId) {
        askLines.push(line) // buffered — resolved AFTER the stream ends (collision + fail-closed checks)
        continue
      }
      turnLines.push(line)
      allLines.push(line)
      noteCreatedSurface(line)
      canvasHost.ingest(line) // validated JSONL streamed line-by-line → progressive paint (SPEC-N4)
    }
    canvasHost.finalize() // also stretches a root ui-column to fill the artboard (ui-surface-host's own finalize())

    // ADR-0097 §2 — freeze whatever was pending BEFORE this turn, now that it has genuinely completed
    // (never on a thrown turn — the catch block below never reaches here).
    const answeringSurfaceId = input.kind === 'client' && 'action' in input.message ? input.message.action.surfaceId : undefined
    freezePriorPendingAsk(answeringSurfaceId)

    // ADR-0097 §2/§3 — resolve THIS turn's own ask, if any. "Shown ≡ produced" (SPEC-R10): the ask's own
    // lines join `allLines`/the JSON tab regardless of whether they end up rendered — a fail-closed drop
    // must still be visible in the JSON tab as what the agent actually emitted.
    let askRendered = false
    if (ask !== undefined && askLines.length > 0) {
      allLines.push(...askLines)
      if (!knownSurfaceIds.has(ask.surfaceId)) {
        // Fail-closed (ADR-0097 §3, defense-in-depth alongside produce()'s own FEED_SCOPE gate): every
        // component type on the buffered ask lines must be in-scope, or the WHOLE ask drops to the note —
        // never a partial render.
        const inScope = componentTypesOf(askLines).every((t) => isFeedSurfaceType(t))
        if (inScope) {
          const { bubble, mountEl } = addAskBubble(ask.surfaceId)
          const askEntry = askRegistry.create(ask.surfaceId, bubble, mountEl, handleClientMessage)
          for (const line of askLines) askEntry.host.ingest(line)
          askEntry.host.finalize()
          knownSurfaceIds.add(ask.surfaceId)
          askRendered = true
        }
        // else: fail-closed drop — the lines are counted in allLines above but rendered nowhere; the note
        // (note-standalone rule, ADR-0097 §4) still carries the question as prose.
      }
      // else: collision (a stale/reused surfaceId) — same fail-closed drop, defense-in-depth alongside
      // produce()'s own session-known-surface check.
    }

    if (turnLines.length === 0 && askLines.length === 0 && note === undefined) {
      addMessage('system', 'The agent has no further turns in this recorded transcript. Reset to start over.')
      return
    }
    session = appendUserTurn(session, input.kind === 'intent' ? input.text : frameClientMessage(input.message))
    // The session record carries EVERYTHING this turn emitted (turnLines + askLines) — what the agent
    // actually produced, independent of whether the client chose to render the ask structurally.
    session = appendAssistantTurn(session, [...turnLines, ...askLines].join('\n'))
    // ADR-0088 §1: show the model's OWN prose verbatim when it emitted a note; `summarize()` is only the
    // BACKWARD-COMPAT fallback for a turn that carries no note (e.g. the recorded backbone, pre-slice-6).
    addMessage('agent', note ?? summarize(turnLines))
    refreshJson(allLines)
    refreshHtml()
    if (!askRendered) showCanvas() // an ask turn stays on whichever tab was active — the ask IS the reply, in the chat feed
  } catch (e) {
    addMessage('system', `⚠ ${(e as Error).message}`)
  } finally {
    setBusy(false)
  }
}

/**
 * ADR-0088 §2 — the grounding mechanism: a compact digest of the recent `TurnTrace`s (+ each one's own
 * retained `note`) prepended to the NEXT intent turn's text, so a follow-up "why did you choose X not Y"
 * is answered from REAL retrieval/self-correct history rather than a retroactive confabulation. This is a
 * CLIENT-SIDE prompt-shaping decision — it rides the EXISTING `TurnInput.text: string` field (no wire/
 * transport type change, per the ADR's explicit out-of-scope on a typed frame), so only the text the
 * MODEL receives grows; the chat log still shows the user's own typed text unmodified (`send()` calls
 * `addMessage('user', text)` with the bare text, before this digest is prepended for the model).
 */
function traceDigest(): string {
  if (traces.length === 0) return ''
  const recent = traces.slice(-5) // "compact" (ADR-0088 §2) — the last few turns' trace, not the whole history
  const rows = recent.map((t) => {
    const note = notesByTurnIndex.get(t.turnIndex)
    const bits = [`turn ${t.turnIndex}`]
    if (note !== undefined) bits.push(`note: "${note}"`)
    bits.push(`exemplars: [${t.exemplarIds.join(', ') || 'none'}]`)
    bits.push(`rounds: ${t.rounds}`)
    bits.push(`healed: ${t.healed}`)
    if (t.failureCodes.length > 0) bits.push(`failures: [${t.failureCodes.join(', ')}]`)
    bits.push(`model: ${t.model}`)
    return `- ${bits.join(' · ')}`
  })
  return `[Your own recent decision trace — cite this if asked "why", never invent a justification]\n${rows.join('\n')}\n\n`
}

function handleClientMessage(message: A2uiClientMessage): void {
  // ADR-0088 §3: `action.wantResponse === false` is the agent's explicit per-action opt-out — apply
  // SILENTLY (no chat entry, no turn, no LLM round-trip). Absent/`true` (and every functionResponse/error)
  // keep today's full visible-turn path, via the pure reducer's routing predicate (LLD-C5).
  if (!shouldRunTurn(message)) return
  // A control in the canvas emitted an action/response/error → the agent continues on the next turn.
  // The pure reducer (SPEC-R8) frames it as the next TurnInput.
  addMessage('user', `↳ ${describeClientMessage(message)}`)
  void runTurn(nextTurn(session, message))
}

function send(): void {
  const text = readField().trim()
  if (text === '' || busy) return
  addMessage('user', text) // the chat shows the user's OWN typed text — never the digest prepended below
  clearField()
  void runTurn({ kind: 'intent', text: traceDigest() + text, session })
}
sendBtn.addEventListener('click', send)
composer.addEventListener('submit', (e) => {
  e.preventDefault()
  send()
})
field.addEventListener('keydown', (e) => {
  if ((e as KeyboardEvent).key === 'Enter') {
    e.preventDefault()
    send()
  }
})

// ── Reset: dispose the renderer, clear the session + canvas + log, restart the transport ────────────────
const resetBtn = document.createElement('ui-button')
resetBtn.setAttribute('variant', 'ghost')
resetBtn.setAttribute('tabindex', '0')
resetBtn.textContent = 'Reset'
resetBtn.addEventListener('click', () => {
  // Swap in a FRESH `<ui-surface-host>` rather than reusing this one: removal fires its `disconnected()`
  // leak-safety net (surface-host.ts), disposing the old internal `RendererHost` automatically — no explicit
  // `.dispose()` call needed here — and the fresh element's own `connected()` mounts a brand-new host.
  const freshCanvasHost = document.createElement('ui-surface-host') as UISurfaceHostElement
  canvasHost.replaceWith(freshCanvasHost)
  canvasHost = freshCanvasHost
  canvasHost.onClientMessage(handleClientMessage)
  askRegistry.disposeAll() // ADR-0097 §2 — every ask host disposed alongside the canvas host, no leak
  knownSurfaceIds.clear()
  session = { turns: [] }
  allLines.length = 0
  traces.length = 0
  notesByTurnIndex.clear()
  transport = createRecordedTransport(recordedTranscript)
  chatLog.replaceChildren() // drops every ask bubble's DOM too — disposeAll() above already tore down its host
  refreshJson([])
  refreshHtml()
  addMessage('system', 'New conversation. Send a prompt to begin.')
  wireLiveOverlay() // re-probe (dev only)
})
const resetBar = el('div', 'reset-bar')
resetBar.append(resetBtn)
canvasPane.append(resetBar)

// ── initial state ───────────────────────────────────────────────────────────────────────────────────────
refreshJson([])
refreshHtml()

// ════════════════ the dev-only LIVE overlay (SPEC-N2: dynamic + DEV-guarded ⇒ tree-shaken from build) ════
function wireLiveOverlay(): void {
  if (!import.meta.env.DEV) {
    addMessage('system', 'Recorded backbone demo. Send any prompt to render turn 1, then click the button to continue.')
    return
  }
  void (async () => {
    try {
      const overlay = await import('../lib/live-proxy-transport.ts')
      const status = await overlay.probeLive()
      if (status.available) {
        const { mountSwitcher } = await import('../lib/provider-switcher.ts')
        const selection = mountSwitcher(switcherSlot)
        transport = overlay.createLiveProxyTransport(selection)
        addMessage('system', `Live agent connected (${status.providers} provider(s) available). Prompt it to generate a real A2UI surface.`)
      } else {
        addMessage('system', 'Recorded backbone (no live API key found). Set a provider key in .env and restart `npm run dev` for a live agent.')
      }
    } catch {
      addMessage('system', 'Recorded backbone demo (live overlay unavailable).')
    }
  })()
}
wireLiveOverlay()
