// a2ui-live.ts — LLD-C9 / SPEC-R10: the live-agent demo chat app (the ladder's last rung made visible).
// Layout: [ chat | a2ui-canvas ]. The chat drives an AgentTransport; the agent's A2UI stream renders into
// the canvas (a REAL @agent-ui/a2ui surface); interacting with the surface round-trips a client message
// that becomes the next turn ("the agent continues"). The canvas pane is TABS — Canvas (the rendered
// surface, translate-centered), JSON (the JSONL payload), HTML (the rendered markup).
//
// The page consumes ONLY the AgentTransport seam (SPEC-R1): the default is the deterministic RECORDED
// BACKBONE (works offline, under CI, and whenever no live provider is configured). The LIVE overlay — a
// real model via a same-origin proxy + the provider switcher — is swapped in via a dynamic import, probed
// with `GET /status` at runtime; a client browser NEVER holds a key either way (ADR-0073 clause 5). In dev
// that proxy is `dev-proxy-plugin.ts` (Vite middleware); in production it's the Cloudflare Worker port
// (`packages/agent-ui/a2ui/tools/agent/worker/index.ts`) mounted at `/__a2ui/agent` on this same site — a
// deliberate SPEC-R3/N2 supersession (that spec described a build-time DEV-only tree-shake; the boundary
// it protected — no browser-held key — still holds, just enforced by the runtime `/status` probe's
// graceful degrade instead). No `fetch`, proxy URL, or transport internal appears in this file's
// render/round-trip logic — the swap is the construction site alone (SPEC-R1 AC1).

import { mountFullBleedPage } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import '@agent-ui/app/super-shell.css' // ui-super-shell's own token ladder + collapse CSS (ADR-0156 re-host), after foundation
import '@agent-ui/app/super-shell' // self-defines ui-super-shell
import '@agent-ui/app/surface-host.css' // ui-surface-host's own artboard chrome (ADR-0129 Amendment re-host)
import '@agent-ui/app/surface-host' // self-defines <ui-surface-host>
// ADR-0129 Fork B (Kim's 2026-07-12 ruling, commit 4e7e386, RE-CONFIRMED 2026-07-24): a2ui-live composes
// ONLY the two standalone widgets below, never `<ui-conversation>` itself — its ask-freeze/answered/
// bypassed/fail-closed-gate lifecycle (ADR-0097, `../lib/ask-registry.ts`) stays entirely app-side,
// UNTOUCHED, because it does not map onto `ui-conversation`'s own open/closed surface registry.
import '@agent-ui/app/conversation-composer.css' // ui-conversation-composer's own field-frame chrome (TKT-0056/0058)
import '@agent-ui/app/conversation-composer' // self-defines <ui-conversation-composer> — composed standalone, NOT via <ui-conversation>
import type { UIConversationComposerElement } from '@agent-ui/app/conversation-composer' // the ONE subpath — never the root barrel, which would also type-name (never runtime-import) UIConversationElement
import type { UIStatusStreamElement } from '@agent-ui/components/components' // the standalone narration widget (ui-status-stream is already registered — `_page.ts`'s `@agent-ui/components/components` import, step [3])
import './a2ui-live.css'
import { codeBlock } from '../lib/code-block.ts'
import type { A2uiClientMessage, A2uiServerMessage } from '@agent-ui/a2ui'
import type { UISurfaceHostElement } from '@agent-ui/app'
// ADR-0146 F1 — the closed, produce-layer-owned live-turn lifecycle vocabulary (type-only: it erases at
// build, so zero producer bytes cross the ADR-0137 identity gate — the meta-line.ts file-header precedent).
import type { TurnProgress, TurnProgressStage } from '@agent-ui/a2ui/agent/meta-line'
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

// ════════════════ the two panes — ui-super-shell slots (ADR-0156 re-host: ui-app-shell is deprecated,
// ui-super-shell is the one shell grammar new/migrated work composes on). `content` is the mandatory slot
// — SPEC-R1 — so the canvas, the surface this page exists to show, takes it, and the chat composer docks
// into `nav-pane` (the shell's "start"-side pane) alongside it. The old per-region `landmark`/`collapse`
// props are now: `data-landmark` on the slotted child (super-shell.ts's roleFor(), the SAME ADR-0083
// role-decoupled-from-placement pattern, continued as family law per ADR-0156 clause 3) + the shell-level
// `narrow-start` enum (ADR-0084's region vocabulary, now a per-SIDE, not per-region, property). ════════════
const shell = document.createElement('ui-super-shell')
shell.setAttribute('narrow-start', 'stack') // ADR-0084's pattern, continued: the composer stays visible + full-width when narrow — primary input, not disposable chrome
const chatPane = document.createElement('div')
chatPane.setAttribute('data-slot', 'nav-pane') // the shell's "start"-side pane (super-shell.ts's `startStack`)
chatPane.setAttribute('data-landmark', 'complementary') // ADR-0083's decouple, continued: the correct ARIA landmark for a chat composer, not "navigation"
chatPane.className = 'chat-pane'
const canvasPane = document.createElement('div')
canvasPane.setAttribute('data-slot', 'content') // the mandatory slot
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

// The modern composer (Figma chat-input refactor) — a standalone `<ui-conversation-composer>` instance,
// replacing the bare `<form>` + raw `<ui-text-field>`/`<ui-button>` pair. Composed directly (never via
// `<ui-conversation>`, ADR-0129 Fork B): `models`/`efforts`/`contextItems` are left unset, so this gets
// exactly "the ORIGINAL field+Send composer" shape conversation-composer.ts's own header names a2ui-live
// as an example consumer of — same event contract (`onSubmit`), same turn-loop wiring below, only the
// INPUT WIDGET itself changed. `onMicClick` is never registered either — the mic button stays hidden
// (its own opt-in reveal), so it never becomes "the composer's first ui-button" (the exact hazard
// conversation-composer.ts's own header documents a2ui-chat.ts hit before its fix) for anything that
// still needs the SEND button specifically — see `[data-part="send"]` at every such call site.
const composer = document.createElement('ui-conversation-composer') as UIConversationComposerElement
composer.className = 'chat-composer' // kept — the pre-existing `.chat-composer [data-part="editor"]` test selectors resolve unchanged

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

// `busy` now rides the composer's OWN reflected prop (TKT-0034's mechanism, the same one `ui-conversation`
// forwards its turn-in-flight count through) — it owns disabling/dimming its own editor + send/mic/picker
// parts from ONE write; the page no longer hand-manipulates a send button or an aria-live "Agent is
// working…" text row (replaced by the per-turn narration strip below, which shows the SAME "working" fact
// plus real content instead of a static string).
function setBusy(next: boolean): void {
  busy = next
  composer.busy = next
}

// ── narration (ADR-0146 F1, GH #239/ADR-0159) — a standalone `<ui-status-stream>`, ONE fresh instance per
// turn, appended into the chat log (never inside a `.msg` bubble — the ask/message bubble chrome is
// out of scope, GH #241). Routes the `progress` meta-lines this page used to drop entirely (see the
// removed comment this replaces, below in runTurn) directly into the strip, bypassing `<ui-conversation>`
// entirely (ADR-0129 Fork B — only the shared canvas migrated there, never this page's chat pane).
function makeNarration(): UIStatusStreamElement {
  const narration = document.createElement('ui-status-stream') as UIStatusStreamElement
  narration.setAttribute('size', 'sm')
  narration.setAttribute('label', 'Agent activity')
  narration.setAttribute('header', '') // ADR-0146 F8 — reads "working" from t=0, even a zero-progress turn
  // GH #239/ADR-0159 — the SAME two opt-in props `agent-admin.ts` sets on its conversation-owned strip
  // (`conversation.receipt = true`), set directly here: they belong to `ui-status-stream` itself, not to
  // `<ui-conversation>`, so this works identically on a standalone instance.
  narration.setAttribute('oneline', '')
  narration.setAttribute('receipt', '')
  narration.classList.add('narration-strip')
  return narration
}

interface ProgressLabelPair {
  live: string
  done: string
}

// The closed, code-owned progress stage → label table (ADR-0146 F2/F8) — promoted VERBATIM from
// `conversation.ts`'s own `PROGRESS_LABEL` (never re-invented: same closed vocabulary, same factual
// process labels, same live/done pair convention, GH #238/ADR-0159). a2ui-live never imports
// `conversation.ts` (ADR-0129 Fork B bars `<ui-conversation>` entirely), so this is a deliberate,
// small, page-local duplicate of the identical closed table, not a parallel invention.
const PROGRESS_LABEL: Record<TurnProgressStage, ProgressLabelPair> = {
  sent: { live: 'Request sent', done: 'Request sent' },
  started: { live: 'Generating…', done: 'Generated' },
  reasoning: { live: 'Reasoning…', done: 'Reasoned' },
  content: { live: 'Writing the response…', done: 'Wrote the response' },
  validating: { live: 'Validating…', done: 'Validated' },
  retry: { live: 'Self-correcting…', done: 'Self-corrected' },
  tool: { live: 'Running an integration…', done: 'Ran an integration' },
  done: { live: 'Done', done: 'Done' },
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
  // ADR-0146 F1/GH #239 — a fresh narration strip for THIS turn, appended into the log right away (so the
  // "working" header is visible from t=0, before any line arrives) and settled at this turn's own
  // finalize()/fail() below — never reused across turns (its own completion invariant is truly terminal).
  const narration = makeNarration()
  chatLog.append(narration)
  chatLog.scrollTop = chatLog.scrollHeight
  // Per-turn progress-routing state (promoted from conversation.ts's own `routeProgress` closure) — the
  // keys this turn has already narrated, the current active stage's key (settled `done` as the next stage
  // begins), and each key's own composed done-form label (GH #238 — a done checkmark never wears an
  // "-ing…" label again).
  const progressKeysSeen = new Set<string>()
  const doneLabelByKey = new Map<string, string>()
  let lastProgressKey: string | undefined
  const settleProgress = (key: string): void => {
    const doneLabel = doneLabelByKey.get(key)
    narration.update(key, doneLabel === undefined ? { status: 'done' } : { status: 'done', label: doneLabel })
  }
  /** Route ONE live-turn progress event into the strip (ADR-0146 F1) through the CLOSED code-owned label
   *  table — never model text. An unknown/unobserved stage renders NOTHING (the F2 honesty guard). Each
   *  stage's entry goes `active` when it begins and settles `done` — with its done-form label — as the
   *  NEXT stage begins; `retry`/`tool` compose the real round ordinal/tool name in (factual, never model
   *  prose). Promoted from conversation.ts's own `routeProgress` — same closed table, same key/settle
   *  discipline, minus the GH #240 `sources` wave-B reveal (out of this task's scope). */
  const routeProgress = (ev: TurnProgress): void => {
    const pair = PROGRESS_LABEL[ev.stage] as ProgressLabelPair | undefined
    if (pair === undefined) return
    if (ev.stage === 'done') {
      if (lastProgressKey !== undefined) settleProgress(lastProgressKey)
      lastProgressKey = undefined
      return
    }
    const suffix =
      ev.stage === 'retry'
        ? (ev.round === undefined ? '' : ` (round ${ev.round})`)
        : ev.stage === 'tool' && ev.detail
          ? ` (${ev.detail})`
          : ''
    const label = `${pair.live}${suffix}`
    const key =
      ev.stage === 'retry'
        ? `progress-retry-${ev.round ?? 1}`
        : ev.stage === 'tool'
          ? `progress-tool-${ev.detail ?? 'unknown'}`
          : `progress-${ev.stage}`
    doneLabelByKey.set(key, `${pair.done}${suffix}`)
    if (lastProgressKey !== undefined && lastProgressKey !== key) settleProgress(lastProgressKey)
    if (progressKeysSeen.has(key)) narration.update(key, { status: 'active', label })
    else {
      progressKeysSeen.add(key)
      narration.appendEntry({ key, status: 'active', label })
    }
    lastProgressKey = key
  }
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
        // ADR-0146 F1: a `progress` meta-line routes into the standalone narration strip above — the SAME
        // filter growing one arm, never a new parse path; it never reaches `allLines`/the JSON tab or
        // `canvasHost.ingest`. Guard note/ask so a progress-only line (both undefined on it) never clobbers
        // a real note/ask.
        if (meta.a2uiMeta.progress !== undefined) routeProgress(meta.a2uiMeta.progress)
        if (meta.a2uiMeta.note !== undefined) note = meta.a2uiMeta.note
        if (meta.a2uiMeta.ask !== undefined) ask = meta.a2uiMeta.ask
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
    // ADR-0146 F1/GH #239 — settle this turn's own narration: the last-active progress stage (if any) to
    // done, then the strip's own completion invariant (auto-collapses to the one-line receipt). Called
    // ONCE per turn that actually COMPLETES — never for a turn that throws (the catch block below fails it
    // instead), mirroring `freezePriorPendingAsk`'s own "never on a thrown turn" discipline right below.
    if (lastProgressKey !== undefined) settleProgress(lastProgressKey)
    narration.finalize()

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
    // A genuine finally-scoped truncation (SPEC-R6 AC3, the conversation.ts `fail()` precedent) — the
    // live-narrated progress stage stays as it was (whatever completed shows done, the rest truncate under
    // `fail()`); `narration.fail()` forces the streaming header to `error` (ADR-0146 F8's header-level face).
    narration.appendEntry({ key: 'progress-error', status: 'error', label: `Turn failed — ${(e as Error).message}` })
    narration.fail()
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
  void runTurn(nextTurn(session, message))
}

// The composer's own `onSubmit` callback (never a CustomEvent, matching `ui-conversation`'s own event
// contract, conversation.ts's composer-wiring section) fires with the text ALREADY trimmed and non-empty —
// its internal `#send()` guards emptiness AND its own `busy` prop before ever calling this back, so no
// re-check is needed here. It also already cleared its own value; this page never touches the widget's
// value directly (props down, callbacks up — `readField`/`clearField` are gone with the raw field).
composer.onSubmit((text) => {
  addMessage('user', text) // the chat shows the user's OWN typed text — never the digest prepended below
  void runTurn({ kind: 'intent', text: traceDigest() + text, session })
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
  wireLiveOverlay() // re-probe
})
const resetBar = el('div', 'reset-bar')
resetBar.append(resetBtn)
canvasPane.append(resetBar)

// ── initial state ───────────────────────────────────────────────────────────────────────────────────────
refreshJson([])
refreshHtml()

// ════════════════ the LIVE overlay — probed dynamically in both dev and prod (SPEC-R3/N2 superseded: prod
// now carries a Cloudflare Worker port of the dev proxy under `/__a2ui/agent`, worker/index.ts). A prompt
// still degrades cleanly to the recorded backbone whenever `/status` reports no live provider available
// (no key configured), so this is a strict widening — dev's behavior is unchanged. ════════════════════════
function wireLiveOverlay(): void {
  void (async () => {
    try {
      const overlay = await import('../lib/live-proxy-transport.ts')
      const status = await overlay.probeLive()
      if (status.available) {
        const { mountSwitcher } = await import('../lib/provider-switcher.ts')
        const selection = mountSwitcher(switcherSlot)
        transport = overlay.createLiveProxyTransport(selection)
        addMessage('system', `Live agent connected (${status.providers} provider(s) available). Prompt it to generate a real A2UI surface.`)
      } else if (import.meta.env.DEV) {
        addMessage('system', 'Recorded backbone (no live API key found). Set a provider key in .env and restart `npm run dev` for a live agent.')
      } else {
        addMessage('system', 'Recorded backbone demo. Send any prompt to render turn 1, then click the button to continue.')
      }
    } catch {
      addMessage('system', 'Recorded backbone demo (live overlay unavailable).')
    }
  })()
}
wireLiveOverlay()
