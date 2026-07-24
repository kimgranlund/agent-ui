// a2a-artifact-feed.ts — LLD-C7 (SPEC-R16 AC2): the artifact-feed demo — a message TIMELINE where text
// parts render as prose bubbles and some agent turns carry LIVE A2UI artifacts (a metric-tile report, a
// region-breakdown table), each hosted by its own `createRenderer()` instance (the ADR-0097 per-message
// host lifecycle: create → ingest per envelope → finalize → dispose-on-reset). A separate page from the
// A2A arena (LLD §10 fork 1 — one proof per page: the arena's centerpiece is isolation, this page's is
// the bridge).
//
// Recorded-default, zero network (SPEC-R16 AC2): the committed fixture is a Vite `?raw` static import, so
// the static build ships no fetch for it. The verdict line is computed IN-PAGE from `loadFeed(...)` — the
// SAME checks the standing fixture gate (`a2ui/src/bridge/feed-fixture.test.ts`) runs — never a
// hardcoded badge.
//
// Live arm (LLD-C11, SPEC-R18 — fills the reserved bridge-LLD §7 seam this comment used to describe as
// "structure only"): `probeFeedLive()` + a DEV-guarded dynamic import of `feed-live-transport.ts` (never
// reachable from `vite build` — SPEC-N2), a composer that genuinely SENDS over A2A once live, and every
// bubble — recorded or live — rendered through `deriveFeedEntry`'s ONE derivation (LLD-C9).
import { mountPage } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { codeBlock } from '../lib/code-block.ts'
import { createCanvasSurface, applyRootStretch } from '../lib/canvas-surface.ts' // its OWN CSS import must land BEFORE
// this page's own stylesheet, so `.feed-artifact-stage`'s definite block-size override below wins the cascade
// (same specificity, source-order-wins) over canvas-surface.css's `.canvas-stage { block-size: 100% }` base rule.
import './a2a-artifact-feed.css'
import '@agent-ui/app/conversation-composer.css' // ui-conversation-composer's own field-frame chrome (TKT-0056/0058)
import '@agent-ui/app/conversation-composer' // self-defines <ui-conversation-composer> — composed standalone, NOT via <ui-conversation> (the a2ui-live.ts precedent)
import type { UIConversationComposerElement } from '@agent-ui/app/conversation-composer' // the ONE subpath — never the root barrel
import { createRenderer } from '@agent-ui/a2ui'
import type { RendererHost, A2uiClientMessage } from '@agent-ui/a2ui'
import { loadFeed, deriveFeedEntry, PROTOCOL_VERSION } from '../lib/artifact-feed.ts'
import type { FeedEntry, FeedVerdict } from '../lib/artifact-feed.ts'
import { wrapClientTurn, partToEnvelope } from '../../packages/agent-ui/a2ui/tools/pipeline/transports/a2a.ts'
// GH #257 — the Provider/Model/Mode picker now rides the standalone composer's own `providers`/`provider`/
// `modes`/`mode` props (the a2ui-chat.ts/a2ui-live.ts precedent), replacing the standalone `ui-select` trio
// `provider-switcher.ts` used to mount into a `switcherSlot` beside a hand-rolled `<form>` composer — this
// page's message compose UI is ITSELF migrated onto `ui-conversation-composer` in the same sweep (it never
// composed one before; the `a2a-artifact-feed.ts` live composer was still the pre-TKT-0056 hand-rolled
// `<form>` + `ui-text-field` shape).
import {
  PROVIDER_OPTIONS,
  MODE_OPTIONS,
  loadPersistedSelection,
  persistSelection,
} from '../lib/provider-mode-selection.ts'
import type { StoredSelection } from '../lib/provider-mode-selection.ts'

// The committed fixture (LLD-C4) — a zero-network static import (Vite `?raw`), the a2a-tic-tac-toe precedent.
import feedRaw from '../../packages/agent-ui/a2ui/tools/pipeline/fixtures/artifact-feed.a2a.jsonl?raw'

const { content } = mountPage({
  title: 'A2A Artifact Feed',
  intro:
    'A conversation carried over A2A, some turns bearing LIVE A2UI artifacts. Every client turn shows its ' +
    '"capabilities" handshake (the HV-8 teaching surface); every bubble’s raw wire JSON is one disclosure ' +
    'away. The verdict below runs the SAME checks the standing fixture gate runs — live, in this page.',
})

// ── verdict line (SPEC-R16 AC2: computed in-page, never a hardcoded badge) ─────────────────────────────
const verdictPanel = document.createElement('p')
verdictPanel.className = 'feed-verdict'
verdictPanel.setAttribute('role', 'status')
verdictPanel.dataset.verdict = ''
content.append(verdictPanel)

const errorPanel = document.createElement('p')
errorPanel.className = 'feed-error'
errorPanel.setAttribute('role', 'status')
errorPanel.dataset.error = ''
errorPanel.hidden = true
content.append(errorPanel)

function renderVerdict(verdict: FeedVerdict): void {
  verdictPanel.dataset.verdict = verdict.clean ? 'clean' : 'failed'
  const failing = verdict.checks.filter((c) => c.failures.length > 0)
  verdictPanel.textContent = verdict.clean
    ? `VERDICT: CLEAN — ${verdict.checks.length} check(s) passed (schema · mime tag · capabilities · a2ui).`
    : `VERDICT: FAILED — ${failing.length} check(s) failing.`
}

// ── the timeline ─────────────────────────────────────────────────────────────────────────────────────────
const timeline = document.createElement('div')
timeline.className = 'feed-timeline'
content.append(timeline)

const stepControls = document.createElement('div')
stepControls.className = 'feed-step-controls'
const prevBtn = document.createElement('ui-button')
prevBtn.setAttribute('variant', 'ghost')
prevBtn.setAttribute('tabindex', '0')
prevBtn.textContent = '← Prev'
const stepLabel = document.createElement('span')
stepLabel.className = 'feed-step-label'
const nextBtn = document.createElement('ui-button')
nextBtn.setAttribute('variant', 'ghost')
nextBtn.setAttribute('tabindex', '0')
nextBtn.textContent = 'Next →'
const resetBtn = document.createElement('ui-button')
resetBtn.setAttribute('variant', 'soft')
resetBtn.setAttribute('tabindex', '0')
resetBtn.textContent = 'Reset'
stepControls.append(prevBtn, stepLabel, nextBtn, resetBtn)
content.append(stepControls)

// ── live arm chrome (LLD-C11): the "Go live" trigger, and the composer that ships ONLY once a live
// conversation has started. Hidden by default; `wireFeedLiveOverlay()` reveals "Go live" once
// `probeFeedLive()` confirms a key — the static build never runs that probe (SPEC-N2, dev-only dynamic
// import). GH #257 — the dev-only Provider/Model/Mode picker now rides the composer's OWN `providers`/
// `provider`/`modes`/`mode` props (wireFeedLiveOverlay, below), not a standalone switcher beside this bar.
const liveBar = document.createElement('div')
liveBar.className = 'feed-live-bar'
const goLiveBtn = document.createElement('ui-button')
goLiveBtn.setAttribute('variant', 'solid')
goLiveBtn.setAttribute('tabindex', '0')
goLiveBtn.textContent = 'Go live'
goLiveBtn.hidden = true
liveBar.append(goLiveBtn)
content.append(liveBar)

// The composer — a standalone `<ui-conversation-composer>` instance (never via `<ui-conversation>`, the
// a2ui-live.ts precedent: this page's own ask/live-turn lifecycle stays entirely page-side). Replaces the
// pre-TKT-0056 hand-rolled `<form>` + raw `ui-text-field`/`ui-button` pair this page had never migrated off
// — `models`/`efforts`/`contextItems` stay unset (the ORIGINAL field+Send shape) until the live overlay
// opts the Provider/Model/Mode axes in (wireFeedLiveOverlay, below).
const composer = document.createElement('ui-conversation-composer') as UIConversationComposerElement
composer.className = 'feed-composer'
composer.hidden = true // shown only once a live conversation has started
content.append(composer)

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  return node
}

/** A disclosure — `<details><summary>{label} ▸</summary>{body}</details>` — the shared teaching-surface
 *  idiom for the handshake chip and the wire inspector. */
function disclosure(label: string, body: HTMLElement): HTMLElement {
  const details = document.createElement('details')
  details.className = 'feed-disclosure'
  const summary = document.createElement('summary')
  summary.textContent = `${label} ▸`
  details.append(summary, body)
  return details
}

interface Bubble {
  readonly root: HTMLElement
  readonly artifactMount?: HTMLElement
}

/** Build ONE bubble for a feed entry — prose text, an optional handshake chip (user turns), an optional
 *  artifact mount point (created but not yet hosted — hosting happens lazily on first reveal, §8 edge),
 *  and the wire-JSON disclosure every bubble carries. */
function buildBubble(entry: FeedEntry): Bubble {
  const root = el('div', 'msg')
  root.dataset.role = entry.role
  root.dataset.index = String(entry.index)
  root.hidden = true

  const who = el('span', 'msg-who')
  who.textContent = entry.role === 'user' ? 'You' : 'Agent'
  root.append(who)

  if (entry.handshake !== undefined) {
    const pretty = codeBlock(JSON.stringify(entry.handshake, null, 2), 'json')
    root.append(disclosure('capabilities', pretty))
  }

  for (const line of entry.prose) {
    const p = el('p', 'msg-body')
    p.textContent = line
    root.append(p)
  }

  let artifactMount: HTMLElement | undefined
  if (entry.artifact !== undefined) {
    const { stage, surface } = createCanvasSurface()
    stage.classList.add('feed-artifact-stage')
    root.append(stage)
    artifactMount = surface
  }

  const wirePretty = codeBlock(JSON.stringify(JSON.parse(entry.wire), null, 2), 'json')
  root.append(disclosure('wire', wirePretty))

  return { root, artifactMount }
}

// ── load + render ────────────────────────────────────────────────────────────────────────────────────────
const loaded = loadFeed(feedRaw)

const artifactHosts = new Map<number, RendererHost>()
let composedCounter = 0

/** `wrapClientTurn`'s contextId — read off the feed's own first message so the composed bubble's wire
 *  shape matches the conversation it belongs to (never a magic constant duplicated from the fixture). */
function feedContextId(): string | undefined {
  if (!loaded.ok || loaded.entries.length === 0) return undefined
  const first = JSON.parse(loaded.entries[0]!.wire) as { contextId?: string }
  return first.contextId
}

/** Append a "composed locally — not sent" user bubble for a client message an artifact control emitted
 *  (LLD §7 "compose, don't send" interaction) — the round-trip made visible with zero network. */
function appendComposedBubble(message: A2uiClientMessage): void {
  composedCounter += 1
  const wire = wrapClientTurn({ message }, { messageId: `composed-${composedCounter}`, contextId: feedContextId() })
  const root = el('div', 'msg')
  root.dataset.role = 'user'
  root.dataset.composed = ''
  const who = el('span', 'msg-who')
  who.textContent = 'You'
  root.append(who)
  const annotation = el('p', 'msg-annotation')
  annotation.textContent = 'Composed locally — not sent (recorded demo).'
  root.append(annotation)
  const handshake = codeBlock(JSON.stringify(wire.metadata!.a2uiClientCapabilities, null, 2), 'json')
  root.append(disclosure('capabilities', handshake))
  const wirePretty = codeBlock(JSON.stringify(wire, null, 2), 'json')
  root.append(disclosure('wire', wirePretty))
  timeline.append(root)
  revealScroll(root) // a composed reply is new content at the timeline's end — same animate-to-bottom (TKT-0004)
}

function hostArtifact(entry: FeedEntry, mount: HTMLElement): void {
  if (entry.artifact === undefined || artifactHosts.has(entry.index)) return
  const host = createRenderer()
  host.onClientMessage(appendComposedBubble)
  host.mount(mount)
  for (const line of entry.artifact.lines) host.ingest(line)
  host.finalize()
  applyRootStretch(mount)
  artifactHosts.set(entry.index, host)
}

let bubbles: { entry: FeedEntry; bubble: Bubble }[] = []
let cursor = 0

/** Animate the page to a newly arrived/revealed bubble (TKT-0004): its END lands in view ("animate to
 *  bottom"). Deferred one frame past a second rAF so the bubble's lazily-mounted A2UI artifact has laid
 *  out first (the renderer's kernel flushes effects on microtasks; two frames is the settled-layout
 *  point — the sizing-page live-matrix precedent). Smooth by default; `prefers-reduced-motion` collapses
 *  to an instant jump (the house motion discipline). Forward reveals + composed appends ONLY — Prev/Reset
 *  are backward navigation, not new content, and never call this. */
function revealScroll(target: HTMLElement): void {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' })
    }),
  )
}

function renderStep(): void {
  if (bubbles.length === 0) return
  for (const { entry, bubble } of bubbles) {
    const visible = entry.index <= cursor
    bubble.root.hidden = !visible
    if (visible && bubble.artifactMount !== undefined) hostArtifact(entry, bubble.artifactMount)
  }
  stepLabel.textContent = `Message ${cursor + 1} of ${bubbles.length}`
  prevBtn.toggleAttribute('disabled', cursor === 0)
  nextBtn.toggleAttribute('disabled', cursor === bubbles.length - 1)
}

function disposeAllHosts(): void {
  for (const host of artifactHosts.values()) host.dispose()
  artifactHosts.clear()
}

// ════════════════ the live arm (LLD-C11, SPEC-R18) ════════════════
// `liveApi` is populated ONLY by `wireFeedLiveOverlay()`'s dev-only dynamic import (never statically
// imported — SPEC-N2 keeps this whole path out of `vite build`), the a2ui-live `AgentTransport` precedent.
// `liveSelection` is a plain `{get(): StoredSelection}` ref (GH #257 — provider-mode-selection.ts's own
// shape; `sendTurn` only reads `{provider,model}`, `mode` rides along unread — the SAME "coming along for
// the ride" shape provider-switcher.ts's SelectionRef always was for this page).
let liveApi: typeof import('../lib/feed-live-transport.ts') | undefined
let liveSelection: { get(): StoredSelection } | undefined
let liveKeyAvailable = false
let liveMode = false
let liveLog: string[] = []
let liveContextId = ''
let liveEntryIndex = 0
let userTurnCounter = 0
let liveBusy = false
let liveAbort: AbortController | undefined

function setLiveMode(next: boolean): void {
  liveMode = next
  goLiveBtn.hidden = next || !liveKeyAvailable // hide "Go live" once already live, or before a key is confirmed
  composer.hidden = !next
  stepControls.hidden = next
}

function nextUserMessageId(): string {
  userTurnCounter += 1
  return `live-u${userTurnCounter}`
}

/** SPEC-R18 AC2's in-page arm: recompute the SAME standing feed checks over the live conversation, in
 *  progress, after every completed turn — never a hardcoded verdict. */
function recomputeLiveVerdict(): void {
  const result = loadFeed(liveLog.join('\n'))
  if (result.ok) {
    renderVerdict(result.verdict)
  } else {
    verdictPanel.dataset.verdict = 'failed'
    verdictPanel.textContent = `VERDICT: FAILED — ${result.reasons.join('; ')}`
  }
}

/** Append ONE dispatch-ready user turn (typed prose or an interaction round-trip) to the live log + the
 *  timeline, then run the agent's reply. Shared by the composer and `handleLiveClientMessage` — one
 *  construction of the user-turn bubble either way, via `deriveFeedEntry`/`buildBubble` (LLD-C9's ONE
 *  derivation — the handshake chip shows the REAL wire that is about to travel). */
function appendLiveUserTurnAndRespond(payload: { text?: string; message?: A2uiClientMessage }): void {
  if (liveBusy || liveApi === undefined || liveSelection === undefined) return
  const userMsg = wrapClientTurn(payload, { messageId: nextUserMessageId(), contextId: liveContextId })
  liveLog.push(JSON.stringify(userMsg))
  const entry = deriveFeedEntry(userMsg, liveEntryIndex)
  liveEntryIndex += 1
  const bubble = buildBubble(entry)
  bubble.root.hidden = false // buildBubble defaults to hidden (the recorded stepping model) — a live turn shows immediately
  timeline.append(bubble.root)
  revealScroll(bubble.root)
  void runLiveAgentTurn(liveSelection.get())
}

/** ADR-0097-style per-message host lifecycle, run live: build the agent bubble immediately (so a reply-in-
 *  flight is visible even for a note-only or zero-part turn), paint each part as it streams (`sendTurn`'s
 *  progressive frames), then finalize once the assembler reassembles the complete message. Faults (a
 *  transport error, a non-2xx response, or a failed `complete()`) annotate the bubble and tear down any
 *  partial artifact paint — the failed turn's line never joins `liveLog` (fail-closed, SPEC-R18 clause 5). */
async function runLiveAgentTurn(sel: { provider: string; model: string }): Promise<void> {
  liveBusy = true
  composer.busy = true

  const bubbleRoot = el('div', 'msg')
  bubbleRoot.dataset.role = 'agent'
  bubbleRoot.dataset.index = String(liveEntryIndex)
  const who = el('span', 'msg-who')
  who.textContent = 'Agent'
  bubbleRoot.append(who)
  timeline.append(bubbleRoot)
  revealScroll(bubbleRoot)

  const controller = new AbortController()
  liveAbort = controller
  let host: RendererHost | undefined
  let artifactSurface: HTMLElement | undefined

  try {
    const gen = liveApi!.sendTurn(liveLog, sel, { signal: controller.signal })
    let step = await gen.next()
    while (!step.done) {
      const { part } = step.value
      if (part.kind === 'text') {
        const p = el('p', 'msg-body')
        p.textContent = part.text
        bubbleRoot.append(p)
      } else {
        const envelope = partToEnvelope(part)
        if (envelope !== undefined) {
          if (host === undefined) {
            host = createRenderer()
            host.onClientMessage((message) => appendLiveUserTurnAndRespond({ message }))
            const { stage, surface } = createCanvasSurface()
            stage.classList.add('feed-artifact-stage')
            bubbleRoot.append(stage)
            artifactSurface = surface
            host.mount(surface)
            artifactHosts.set(liveEntryIndex, host)
          }
          host.ingest(JSON.stringify(envelope))
        }
      }
      step = await gen.next()
    }
    host?.finalize()
    if (host !== undefined && artifactSurface !== undefined) applyRootStretch(artifactSurface)

    const message = step.value
    liveLog.push(JSON.stringify(message))
    const wirePretty = codeBlock(JSON.stringify(message, null, 2), 'json')
    bubbleRoot.append(disclosure('wire', wirePretty))
    liveEntryIndex += 1
    recomputeLiveVerdict()
  } catch (e) {
    if (controller.signal.aborted) return // a deliberate Reset mid-turn — that flow already tears everything down
    if (host !== undefined) {
      host.dispose()
      artifactHosts.delete(liveEntryIndex)
    }
    const failNote = el('p', 'msg-annotation')
    failNote.textContent = `⚠ Turn failed — not recorded (${e instanceof Error ? e.message : String(e)}).`
    bubbleRoot.append(failNote)
  } finally {
    if (liveAbort === controller) liveAbort = undefined
    liveBusy = false
    composer.busy = false
  }
}

/** Go live (ADR-0116 fork F6): a FRESH conversation, never appended to the recorded fixture — a new
 *  `contextId` + a synthesized `provenance.source:'live'` header line starts `liveLog`. */
function startLiveConversation(): void {
  liveAbort?.abort()
  liveAbort = undefined
  disposeAllHosts()
  timeline.replaceChildren()
  bubbles = []
  cursor = 0
  liveEntryIndex = 0
  userTurnCounter = 0
  const now = new Date().toISOString()
  liveContextId = `live-${now}`
  const header = { a2aFeed: { protocolVersion: PROTOCOL_VERSION, a2ui: 'v1.0', provenance: { source: 'live', date: now } } }
  liveLog = [JSON.stringify(header)]
  setLiveMode(true)
  errorPanel.hidden = true
  timeline.hidden = false
  verdictPanel.hidden = false
  verdictPanel.dataset.verdict = 'pending'
  verdictPanel.textContent = 'VERDICT: live conversation in progress — recomputed after each completed turn.'
}

// The composer's own `onSubmit` callback (never a CustomEvent, matching `ui-conversation`'s own event
// contract) fires with the text ALREADY trimmed and non-empty — its internal `#send()` guards emptiness
// AND its own `busy` prop before ever calling this back (the SAME re-entrancy guard `liveBusy` provides for
// the OTHER live-turn entry point, `handleLiveClientMessage`'s surface-action round-trip) — this page never
// touches the composer's `value` directly (props down, callbacks up; `readComposerField`/`clearComposerField`
// are gone with the raw `<form>`/`ui-text-field` pair).
composer.onSubmit((text) => {
  if (liveBusy) return
  appendLiveUserTurnAndRespond({ text })
})

goLiveBtn.addEventListener('click', startLiveConversation)

/** Dev-only probe (SPEC-N2: dynamic + DEV-guarded ⇒ tree-shaken from `vite build`) — mirrors
 *  `a2ui-live.ts`'s `wireLiveOverlay()`. Reveals "Go live" + sets the composer's OWN Provider/Model/Mode
 *  picker props (GH #257) only once a key is confirmed; the recorded, static-shaped page is entirely
 *  unaffected otherwise. */
function wireFeedLiveOverlay(): void {
  if (!import.meta.env.DEV) return
  void (async () => {
    try {
      const live = await import('../lib/feed-live-transport.ts')
      const status = await live.probeFeedLive()
      if (status.available) {
        liveApi = live
        let selection = loadPersistedSelection()
        composer.providers = PROVIDER_OPTIONS
        composer.provider = selection.provider
        composer.model = selection.model
        composer.modes = MODE_OPTIONS
        composer.mode = selection.mode
        composer.onProviderChange((id) => {
          selection = { ...selection, provider: id }
          composer.provider = id
          persistSelection(selection)
        })
        composer.onModelChange((id) => {
          selection = { ...selection, model: id }
          composer.model = id
          persistSelection(selection)
        })
        composer.onModeChange((id) => {
          // The Mode picker's own `modes` list is always built from `MODE_OPTIONS`/`GEN_UI_MODES` — every
          // committable id genuinely IS a `GenUiMode`; `onModeChange` carries the composer's plain
          // `(id: string)` shape (props down/callbacks up — it never imports `GenUiMode` itself). This
          // page's own `sendTurn` never reads `mode` either way (see `liveSelection`'s own banner above).
          selection = { ...selection, mode: id as StoredSelection['mode'] }
          composer.mode = id
          persistSelection(selection)
        })
        liveSelection = { get: () => selection }
        liveKeyAvailable = true
        setLiveMode(liveMode) // refresh "Go live" visibility now that a key is confirmed
      }
    } catch {
      // no live overlay available (a production build, or a network/proxy fault) — the recorded page stands
    }
  })()
}

/**
 * Test-only injection seam (the `a2ui-live.ts` `__setTransportForTest` precedent, post-ship review
 * finding 2, SPEC §6 open item): `wireFeedLiveOverlay()` is otherwise the ONLY thing that ever populates
 * `liveApi`/`liveSelection`, and it requires a real dev proxy — so a browser test with no proxy running
 * has no way to drive the live composer/progressive-paint/fault-annotation path end to end. This lets a
 * test swap in a scripted `sendTurn` before activating "Go live". Never called by any production path.
 */
export function __setLiveApiForTest(
  sendTurn: (typeof import('../lib/feed-live-transport.ts'))['sendTurn'],
  sel: { provider: string; model: string },
): void {
  liveApi = { sendTurn, probeFeedLive: async () => ({ available: true, providers: 1 }) }
  // `mode` rides along unread by `sendTurn` (see `liveSelection`'s own banner above) — a fixed literal
  // satisfies the shared `StoredSelection` shape without pulling in `gen-ui-mode.ts` for a value nothing
  // here consumes.
  liveSelection = { get: () => ({ ...sel, mode: 'default' }) }
  liveKeyAvailable = true
  setLiveMode(liveMode)
}

function build(): void {
  if (!loaded.ok) {
    errorPanel.hidden = false
    errorPanel.textContent = `Feed unavailable — ${loaded.reasons.join('; ')}`
    verdictPanel.hidden = true
    timeline.hidden = true
    stepControls.hidden = true
    return
  }
  renderVerdict(loaded.verdict)
  bubbles = loaded.entries.map((entry) => ({ entry, bubble: buildBubble(entry) }))
  timeline.replaceChildren(...bubbles.map((b) => b.bubble.root))
  cursor = 0
  renderStep()
}

prevBtn.addEventListener('click', () => {
  if (cursor > 0) {
    cursor -= 1
    renderStep()
  }
})
nextBtn.addEventListener('click', () => {
  if (cursor < bubbles.length - 1) {
    cursor += 1
    renderStep()
    revealScroll(bubbles[cursor]!.bubble.root) // the newly revealed entry animates into view (TKT-0004)
  }
})
resetBtn.addEventListener('click', () => {
  liveAbort?.abort()
  liveAbort = undefined
  disposeAllHosts()
  if (liveMode) {
    // Reset restores the recorded fixture EXACTLY (ADR-0116 fork F6) — the live log is dropped, never
    // merged into the recorded timeline.
    liveLog = []
    liveEntryIndex = 0
    setLiveMode(false)
    timeline.replaceChildren()
    build()
    return
  }
  // Drop any composed bubbles appended after the loaded entries — a reset returns to the recorded state.
  for (const node of [...timeline.children]) {
    if ((node as HTMLElement).dataset.composed !== undefined) node.remove()
  }
  cursor = 0
  renderStep()
})

build()
wireFeedLiveOverlay()
