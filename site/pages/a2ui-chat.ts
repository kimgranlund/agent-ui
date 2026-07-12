// a2ui-chat.ts — TKT-0020 / a2ui-chat.spec.md (SPEC-R1…R8) / a2ui-chat.lld.md (LLD-C1…C7): the
// conversational agent surface — ONE scrolling chat log (not a2ui-live's two-pane chat+canvas split). A
// user turn is a prose bubble; an agent turn's own bubble carries, in order: (a) a `ui-status-stream`
// narrating the turn's mechanical shape as it proceeds (SPEC-R5), (b) the turn's own `note` as prose
// (ADR-0088, unchanged), and (c) — only on the turn whose lines contain a surface's OWN `createSurface`
// line — that surface's freshly mounted inline A2UI render (SPEC-R2/R3).
//
// Persistent surface identity (SPEC-R3/R4): a later turn's `updateComponents`/`updateDataModel`/
// `deleteSurface` line targeting a KNOWN `surfaceId` routes to that surface's own already-mounted host at
// its ORIGINAL bubble — never a new mount for the same id — via `SurfaceRegistry` (`../lib/surface-
// registry.ts`, LLD-C2), the per-ask host lifecycle (`ask-registry.ts`, ADR-0097 §2) generalized from
// "asks only" to every surface a turn creates. `deleteSurface` disposes that ONE surface's host and
// annotates its bubble "Closed." — visible history, never a silent disappearance.
//
// Reuses (never forks): `agent-runtime.ts`'s transport/session/transcript/meta-line machinery, `ask-
// registry.ts`'s `surfaceIdOf` routing helper, `@agent-ui/a2ui`'s renderer, `ui-status-stream`. Recorded-
// default (`createRecordedTransport`, ADR-0073); the live arm reuses the identical DEV-guarded dynamic-
// import + switcher pattern `a2ui-live.ts`/`a2a-artifact-feed.ts` each already ship (SPEC-R8).
import { mountFullBleedPage } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import './a2ui-chat.css'
import { codeBlock } from '../lib/code-block.ts'
import { applyRootStretch } from '../lib/canvas-surface.ts'
import type { A2uiClientMessage, A2uiServerMessage } from '@agent-ui/a2ui'
import {
  createRecordedTransport,
  nextTurn,
  appendUserTurn,
  appendAssistantTurn,
  frameClientMessage,
  shouldRunTurn,
  readMetaLine,
} from '../lib/agent-runtime.ts'
import type { AgentTransport, TurnInput, Session, TurnTrace } from '../lib/agent-runtime.ts'
import { surfaceIdOf } from '../lib/ask-registry.ts' // reused unchanged (LLD-C3) — the componentTypesOf fail-closed
// gate stays ask-specific (ADR-0097 §3); a2ui-chat's non-goals leave the `ask`/AskDeclaration mechanism untouched
import { SurfaceRegistry } from '../lib/surface-registry.ts'
import type { SurfaceEntry } from '../lib/surface-registry.ts'
import type { UIStatusStreamElement } from '@agent-ui/components/components'

const { content } = mountFullBleedPage()

// ── small light-DOM chrome helpers (page chrome only — never restyle a ui-* control) ────────────────────
function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  return node
}

const shell = el('div', 'chat-shell')
content.append(shell)

const header = el('header', 'chat-head')
const title = document.createElement('h1')
title.className = 'chat-title'
title.textContent = 'A2UI Chat'
const blurb = el('p', 'chat-blurb')
blurb.textContent =
  'A conversation with an agent — its narration streams live as each turn proceeds, and the A2UI ' +
  'surfaces it opens render inline in the log, persisting across later turns until it closes them. ' +
  'Recorded transcript by default; a dev-only live overlay swaps in a real model.'
header.append(title, blurb)
shell.append(header)

const chatLog = el('div', 'chat-log')
chatLog.setAttribute('aria-live', 'polite')
shell.append(chatLog)

// ── the outer log's OWN stick-to-bottom guard (SPEC-R6) — independent of each embedded ui-status-stream's
// own guard (status-stream.ts's #trackStickToBottom); this page never reaches into a stream's internals.
//
// Deliberately NOT a persistent flag updated reactively off a 'scroll' LISTENER (the naive status-stream.ts
// `#trackStickToBottom` port this page started with): an embedded `ui-status-stream`'s OWN internal
// `item.scrollIntoView({block:'end'})` (its `#tailFollow`) can — per the real `scrollIntoView` algorithm,
// which walks EVERY scrolling ancestor as needed, not only the nearest one — also move THIS log's
// scrollTop when a just-appended bubble sits below the fold, since revealing the item requires revealing
// its ancestor bubble too. That is a REAL browser-level cascade, not a bug in the embedded stream, and it
// lands `chatLog` at some intermediate position a reactive listener would misread as "the user scrolled
// away" — permanently latching the guard false. Sampled once, synchronously, right when a turn's own
// bubble is about to be created (before anything about to grow the log has grown it), `isNearLogBottom()`
// (captured as `wasNear`) sidesteps the cascade entirely: nothing this turn's OWN narration/mount/note
// growth does can retroactively change a value already captured before it happened.
const LOG_STICK_THRESHOLD_PX = 24

function isNearLogBottom(): boolean {
  return chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight <= LOG_STICK_THRESHOLD_PX
}

// A freshly mounted subtree (a custom-element upgrade, its own reactive first render, and any lazily-
// resolved marker glyph) can keep growing the log's scrollHeight for a while past the point its DOM nodes
// first exist — a fixed handful of `requestAnimationFrame`s undershot the true bottom in practice. Worse,
// an EMBEDDED `ui-status-stream`'s own `appendEntry` tail-follow uses `scrollIntoView({behavior:'smooth'})`
// (status-stream.ts `#tailFollow`), and per the real `scrollIntoView` algorithm that cascades into EVERY
// scrolling ancestor as needed, not only the nearest one — so this log can end up mid-flight through a
// browser-native, compositor-driven smooth-scroll animation that keeps overriding a plain, instant
// `scrollTop =` assignment on the very next frame until that animation finishes on its own. `waitUntilSettled`
// -style polling (the `status-stream.browser.test.ts` precedent — its own banner: "let the smooth-scroll
// animation finish, not just the #tailFollow CALL"; "a momentary same-value read... requires SEVERAL
// consecutive stable reads, not just one") re-asserts `scrollTop = scrollHeight` on a real-clock interval
// and watches `scrollTop` ITSELF for stability — content still growing OR a competing animation still
// fighting for the final position both show up as "not yet stable" this way; a fixed frame count catches
// neither reliably.
const TAIL_FOLLOW_STABLE_CHECKS = 3 // consecutive unchanged reads required before declaring "settled"
const TAIL_FOLLOW_CHECK_MS = 40
const TAIL_FOLLOW_MAX_CHECKS = 25 // a ~1s wall-clock ceiling — never blocks the composer indefinitely

/** Scroll to the log's newest content IFF `wasNear` (the guard sampled before this reveal's own content
 *  started growing) held — never re-samples reactively (see the banner above). Returns a promise that
 *  resolves once the log's OWN scroll position has genuinely stopped moving (or the ceiling is hit) —
 *  `runTurn` awaits this before releasing `busy`, so the NEXT turn's own `wasNear` sample is never read
 *  against a still-settling scroll (a race that would otherwise misread "not yet caught up" as "the user
 *  scrolled away", latching every later turn's follow off). Resolves immediately when `wasNear` is false —
 *  there is nothing to wait for. */
function tailFollowLog(wasNear: boolean): Promise<void> {
  if (!wasNear) return Promise.resolve()
  return new Promise((resolve) => {
    let prevTop = -1
    let stableStreak = 0
    let checks = 0
    const tick = (): void => {
      chatLog.scrollTop = chatLog.scrollHeight
      const top = chatLog.scrollTop
      stableStreak = top === prevTop ? stableStreak + 1 : 0
      prevTop = top
      checks += 1
      if (stableStreak >= TAIL_FOLLOW_STABLE_CHECKS || checks >= TAIL_FOLLOW_MAX_CHECKS) {
        resolve()
        return
      }
      setTimeout(tick, TAIL_FOLLOW_CHECK_MS)
    }
    tick()
  })
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
shell.append(switcherSlot, composer) // switcher (dev-only, populated on probe) sits ABOVE the composer

const resetBar = el('div', 'reset-bar')
const resetBtn = document.createElement('ui-button')
resetBtn.setAttribute('variant', 'ghost')
resetBtn.setAttribute('tabindex', '0')
resetBtn.textContent = 'Reset'
resetBar.append(resetBtn)
shell.append(resetBar)

// ════════════════ bubbles ════════════════

function addUserBubble(text: string): void {
  const wasNear = isNearLogBottom()
  const bubble = el('div', 'msg')
  bubble.dataset.role = 'user'
  const who = el('span', 'msg-who')
  who.textContent = 'You'
  const body = el('p', 'msg-body')
  body.textContent = text
  bubble.append(who, body)
  chatLog.append(bubble)
  void tailFollowLog(wasNear)
}

function addSystemBubble(text: string): void {
  const wasNear = isNearLogBottom()
  const bubble = el('div', 'msg')
  bubble.dataset.role = 'system'
  const body = el('p', 'msg-body')
  body.textContent = text
  bubble.append(body)
  chatLog.append(bubble)
  void tailFollowLog(wasNear)
}

interface AgentBubble {
  readonly bubble: HTMLElement
  readonly narrationEl: UIStatusStreamElement
  readonly noteEl: HTMLElement
  readonly mountsContainer: HTMLElement
}

/** Build ONE agent bubble with its three regions reserved in SPEC-R2's literal order — (a) narration,
 *  (b) note, (c) mounts — so a fresh surface's mount (appended into `mountsContainer` mid-turn, LLD-C3)
 *  never displaces the note/narration that read ABOVE it, regardless of streaming timing. `wasNear` is
 *  sampled ONCE by the caller (`runTurn`) before this turn's own content starts growing, and reused for
 *  every tail-follow call across the WHOLE turn (this bubble's own reveal here, and `runTurn`'s later
 *  ones) — never re-sampled mid-turn (see the guard's own banner above). */
function addAgentBubble(wasNear: boolean): AgentBubble {
  const bubble = el('div', 'msg')
  bubble.dataset.role = 'agent'
  const who = el('span', 'msg-who')
  who.textContent = 'Agent'
  bubble.append(who)

  const narrationEl = document.createElement('ui-status-stream') as UIStatusStreamElement
  narrationEl.setAttribute('size', 'sm')
  narrationEl.setAttribute('label', 'Agent activity')
  narrationEl.classList.add('turn-narration')
  bubble.append(narrationEl)

  const noteEl = el('p', 'msg-body')
  bubble.append(noteEl)

  const mountsContainer = el('div', 'chat-surface-mounts')
  bubble.append(mountsContainer)

  chatLog.append(bubble)
  void tailFollowLog(wasNear)
  return { bubble, narrationEl, noteEl, mountsContainer }
}

/** A collapsed wire disclosure of every raw A2UI JSONL line this turn's transport emitted (SPEC-R7) — the
 *  `a2a-artifact-feed.ts` `disclosure()` idiom, copied as page chrome (LLD-C5). The leading meta-line is
 *  never shown here (the note/narration ABOVE already surface its content honestly) — the `a2ui-live.ts`
 *  discipline: the meta-line never enters a wire dump. */
function disclosure(turnLines: readonly string[]): HTMLElement {
  const pretty = turnLines.map((l) => JSON.stringify(JSON.parse(l), null, 2)).join('\n')
  const details = document.createElement('details')
  details.className = 'chat-disclosure'
  const summary = document.createElement('summary')
  summary.textContent = 'wire ▸'
  details.append(summary, codeBlock(pretty || '(no payload this turn)', 'json'))
  return details
}

// ════════════════ narration (LLD-C4, SPEC-R5) ════════════════

type Category = 'open' | 'restructure' | 'react' | 'close'

const LABEL: Record<Category, string> = {
  open: 'Opening a new surface…',
  restructure: 'Updating the surface…',
  react: 'Updating data…',
  close: 'Closing the surface…',
}

/** The SAME envelope-key inspection technique `a2ui-live.ts`'s `summarize()` already uses — reused for a
 *  new purpose (SPEC-R5's "derived the same way"), never a re-invented parser. `undefined` for an
 *  envelope kind narration has no category label for (e.g. `actionResponse`/`callFunction`). */
function categoryOf(line: string): Category | undefined {
  let msg: unknown
  try {
    msg = JSON.parse(line)
  } catch {
    return undefined
  }
  if (typeof msg !== 'object' || msg === null) return undefined
  const m = msg as Record<string, unknown>
  if ('createSurface' in m) return 'open'
  if ('updateComponents' in m) return 'restructure'
  if ('updateDataModel' in m) return 'react'
  if ('deleteSurface' in m) return 'close'
  return undefined
}

const NARRATION_STEP_MS = 60 // status-stream-demo.ts's delay(60) precedent — visibly live pacing
const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** One entry per DISTINCT category `categories` names, in emission order (already deduplicated by the
 *  caller) — pending -> active -> done, paced so the transition is visibly live even against the near-
 *  instant recorded transport (SPEC-R5 AC1). Never a fabricated sentence — the label table's own text is
 *  the entire vocabulary (SPEC-N5). */
async function narrateCategories(stream: UIStatusStreamElement, turnSeq: number, categories: readonly Category[]): Promise<void> {
  for (const cat of categories) {
    const key = `t${turnSeq}-${cat}`
    stream.appendEntry({ key, status: 'pending', label: LABEL[cat] })
    await delay(NARRATION_STEP_MS)
    stream.update(key, { status: 'active' })
    await delay(NARRATION_STEP_MS)
    stream.update(key, { status: 'done' })
  }
}

/** ONE further entry stating the turn's real `TurnTrace` fields verbatim (SPEC-R5 AC2) — present only on
 *  the live arm (`meta.trace`, absent on the shipped recorded transcript); no re-derivation, no gloss. */
function narrateTrace(stream: UIStatusStreamElement, turnSeq: number, trace: TurnTrace): void {
  stream.appendEntry({
    key: `t${turnSeq}-trace`,
    status: 'done',
    label: `model: ${trace.model}`,
    description: `exemplars: [${trace.exemplarIds.join(', ') || 'none'}] · rounds: ${trace.rounds} · healed: ${trace.healed}`,
  })
}

// ════════════════ the per-surface registry + line routing (LLD-C2/C3) ════════════════

const registry = new SurfaceRegistry()

function isDeleteSurfaceFor(line: string, id: string): boolean {
  try {
    const msg = JSON.parse(line) as { deleteSurface?: { surfaceId?: string } }
    return msg.deleteSurface?.surfaceId === id
  } catch {
    return false
  }
}

interface RouteCtx {
  freshEntry: SurfaceEntry | undefined
  readonly touchedIds: Set<string>
  readonly heldNoIdLines: string[]
}

/** LLD-C3's entire routing rule, verbatim: a fresh `surfaceId` opens a NEW mount in THIS turn's own
 *  bubble; a KNOWN `surfaceId` (open or closed) routes to that surface's ORIGINAL bubble's host; a line
 *  with no surface context ingests into whichever surface THIS turn already opened, or is held until one
 *  does. No ask-specific carve-out — every surface is routed the same way (SPEC's own non-goal). */
function routeLine(line: string, bubble: HTMLElement, mountsContainer: HTMLElement, ctx: RouteCtx): void {
  const id = surfaceIdOf(line)
  if (id === undefined) {
    if (ctx.freshEntry !== undefined) ctx.freshEntry.host.ingest(line)
    else ctx.heldNoIdLines.push(line)
    return
  }
  ctx.touchedIds.add(id)
  if (registry.has(id)) {
    const entry = registry.get(id)!
    entry.host.ingest(line) // SPEC-R3: routes to the surface's ORIGINAL bubble, never the current turn's
    if (isDeleteSurfaceFor(line, id)) registry.close(id)
    return
  }
  // A FRESH surfaceId — this turn's own createSurface line.
  const mount = document.createElement('div')
  mount.className = 'chat-surface-mount'
  mountsContainer.append(mount)
  const entry = registry.create(id, bubble, mount, handleClientMessage)
  entry.host.ingest(line)
  ctx.freshEntry = entry
  for (const held of ctx.heldNoIdLines) entry.host.ingest(held)
  ctx.heldNoIdLines.length = 0
}

// ════════════════ the transport + the turn loop ════════════════

let transport: AgentTransport = createRecordedTransport()

/** Test-only injection seam (the `a2ui-live.ts` `__setTransportForTest` precedent) — otherwise reassigned
 *  ONLY by `wireLiveOverlay()`'s real, dev-only live-key probe. Never called by any production path. */
export function __setTransportForTest(next: AgentTransport): void {
  transport = next
}

let session: Session = { turns: [] }
let turnCounter = 0
let busy = false

function setBusy(next: boolean): void {
  busy = next
  composer.classList.toggle('is-busy', next)
  if (next) sendBtn.setAttribute('aria-disabled', 'true')
  else sendBtn.removeAttribute('aria-disabled')
}

function describeClientMessage(m: A2uiClientMessage): string {
  if ('action' in m) return `clicked "${m.action.name}"`
  if ('functionResponse' in m) return `function ${m.functionResponse.call} → ${JSON.stringify(m.functionResponse.value)}`
  return `error: ${m.error.code}`
}

/** Backward-compat fallback for a turn with no `note` (SPEC-N5: a factual message-kind tally, never a
 *  fabricated sentence) — the `a2ui-live.ts` `summarize()` precedent. Dead on the shipped transcript
 *  (every turn carries a `note`) but load-bearing for a live turn that omits one. */
function summarize(lines: readonly string[]): string {
  if (lines.length === 0) return ''
  const kinds = lines.map((l) => {
    const msg = JSON.parse(l) as A2uiServerMessage
    return Object.keys(msg).find((k) => k !== 'version') ?? '?'
  })
  return `Emitted ${lines.length} A2UI message(s): ${kinds.join(', ')}.`
}

async function runTurn(input: TurnInput): Promise<void> {
  if (busy) return
  busy = true
  setBusy(true)
  turnCounter += 1
  const seq = turnCounter
  const wasNear = isNearLogBottom() // sampled ONCE, before this turn's own content starts growing
  const { bubble, narrationEl, noteEl, mountsContainer } = addAgentBubble(wasNear)

  let note: string | undefined
  let trace: TurnTrace | undefined
  const turnLines: string[] = []
  const categoriesSeen: Category[] = []
  const seenCats = new Set<Category>()
  const ctx: RouteCtx = { freshEntry: undefined, touchedIds: new Set(), heldNoIdLines: [] }
  let failed = false

  try {
    for await (const line of transport.turn(input)) {
      const meta = readMetaLine(line)
      if (meta) {
        note = meta.a2uiMeta.note
        trace = meta.a2uiMeta.trace
        continue
      }
      turnLines.push(line)
      const cat = categoryOf(line)
      if (cat !== undefined && !seenCats.has(cat)) {
        seenCats.add(cat)
        categoriesSeen.push(cat)
      }
      routeLine(line, bubble, mountsContainer, ctx)
    }
    await narrateCategories(narrationEl, seq, categoriesSeen)
    if (trace) narrateTrace(narrationEl, seq, trace)
  } catch (e) {
    failed = true
    narrationEl.appendEntry({ key: `t${seq}-error`, status: 'error', label: `Turn failed — ${(e as Error).message}` })
    addSystemBubble(`⚠ ${(e as Error).message}`)
  } finally {
    // LLD §6 risk: this MUST be a genuine finally (never a2ui-live's try-scoped mistake) so a thrown turn
    // still truncates narration cleanly (SPEC-R5 AC3) — an intentional improvement, not a reuse. `busy`
    // itself is released LATER, once the tail-follow below has genuinely settled (see that function's own
    // banner) — never here, or the NEXT turn's own `wasNear` sample could race a still-pending catch-up.
    narrationEl.finalize()
    for (const id of ctx.touchedIds) {
      const entry = registry.get(id)
      if (entry !== undefined && entry.state === 'open') entry.host.finalize(id)
    }
    if (ctx.freshEntry !== undefined) applyRootStretch(ctx.freshEntry.mount)
  }

  noteEl.textContent = note ?? summarize(turnLines)
  if (turnLines.length > 0) bubble.append(disclosure(turnLines))

  if (!failed) {
    if (turnLines.length === 0 && note === undefined) {
      addSystemBubble('The agent has no further turns in this recorded transcript. Reset to start over.')
    } else {
      session = appendUserTurn(session, input.kind === 'intent' ? input.text : frameClientMessage(input.message))
      session = appendAssistantTurn(session, turnLines.join('\n'))
    }
  }
  await tailFollowLog(wasNear)
  busy = false
  setBusy(false)
}

function handleClientMessage(message: A2uiClientMessage): void {
  if (!shouldRunTurn(message)) return // ADR-0088 §3: an explicit wantResponse:false opt-out applies silently
  addUserBubble(`↳ ${describeClientMessage(message)}`)
  void runTurn(nextTurn(session, message))
}

// ════════════════ composer + reset ════════════════

function readField(): string {
  return String((field as unknown as { value?: string }).value ?? '')
}
function clearField(): void {
  ;(field as unknown as { value: string }).value = ''
}
function send(): void {
  const text = readField().trim()
  if (text === '' || busy) return
  addUserBubble(text)
  clearField()
  void runTurn({ kind: 'intent', text, session })
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

resetBtn.addEventListener('click', () => {
  registry.disposeAll()
  session = { turns: [] }
  turnCounter = 0
  transport = createRecordedTransport()
  chatLog.replaceChildren()
  addSystemBubble('New conversation. Send a prompt to begin.')
  wireLiveOverlay() // re-probe (dev only)
})

// ════════════════ the dev-only LIVE overlay (SPEC-R8/N2: dynamic + DEV-guarded ⇒ tree-shaken from build) ════
function wireLiveOverlay(): void {
  if (!import.meta.env.DEV) {
    addSystemBubble('Recorded transcript demo. Send a prompt to render turn 1, then interact with the surface to continue.')
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
        addSystemBubble(`Live agent connected (${status.providers} provider(s) available). Prompt it to generate a real A2UI surface.`)
      } else {
        addSystemBubble('Recorded transcript (no live API key found). Set a provider key in .env and restart `npm run dev` for a live agent.')
      }
    } catch {
      addSystemBubble('Recorded transcript demo (live overlay unavailable).')
    }
  })()
}
wireLiveOverlay()
