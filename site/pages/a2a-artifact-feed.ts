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
// Live-arm seam (structure only — this wave ships NONE of it, LLD §7): a future live arm would replace
// `feedRaw` with a dev-proxy response (`probeLive()` + a dynamic `import()` under `import.meta.env.DEV`,
// the a2ui-live/arena overlay pattern) — named here so a later wave doesn't invent a second posture.
// Nothing else in this page would change.
import { mountPage } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { codeBlock } from '../lib/code-block.ts'
import { createCanvasSurface, applyRootStretch } from '../lib/canvas-surface.ts' // its OWN CSS import must land BEFORE
// this page's own stylesheet, so `.feed-artifact-stage`'s definite block-size override below wins the cascade
// (same specificity, source-order-wins) over canvas-surface.css's `.canvas-stage { block-size: 100% }` base rule.
import './a2a-artifact-feed.css'
import { createRenderer } from '@agent-ui/a2ui'
import type { RendererHost, A2uiClientMessage } from '@agent-ui/a2ui'
import { loadFeed } from '../lib/artifact-feed.ts'
import type { FeedEntry, FeedVerdict } from '../lib/artifact-feed.ts'
import { wrapClientTurn } from '../../packages/agent-ui/a2ui/tools/pipeline/transports/a2a.ts'

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
  disposeAllHosts()
  // Drop any composed bubbles appended after the loaded entries — a reset returns to the recorded state.
  for (const node of [...timeline.children]) {
    if ((node as HTMLElement).dataset.composed !== undefined) node.remove()
  }
  cursor = 0
  renderStep()
})

build()
