// a2ui-stream.ts — the A2UI STREAMING page. Where the other A2UI pages feed a whole payload at once and show
// the finished surface, this page shows the *arrival*: the SHARED generative-form seed streamed line-by-line
// through the REAL renderer so you watch a form ASSEMBLE. Like the canvas/list/form pages it uses the public
// host surface (`createRenderer`) exactly as a server transport would — nothing reaches into renderer internals.
//
// The single owner of the payload is the seed shelf (`@agent-ui/a2ui/examples`, ADR-0055): Demo 1 streams
// `generativeFormSeed.messages` verbatim; Demo 2 streams a runtime PERMUTATION of the SAME objects (never a
// second literal). Every fact on the page is derived from those messages — the `line k/N` counter (N =
// message count), each line's envelope-key caption, the "root arrives at line X" numbers (found in the seed),
// and the first-paint marker (read off `surfaceEl.childElementCount` after each ingest). Nothing is hand-typed,
// so nothing can drift from the seed.
//
// What the two demos prove — and where each is GATED (this page is the visible proof of tests that already
// exist; the T5 docs-author discipline "the renderer integration test; the page is its visible proof"):
//   • arrival-order application (SPEC-R1)         → renderer.test.ts "streams createSurface + updateComponents…"
//   • render-on-root (SPEC-R3)                    → tree.test.ts "does not render until the root component arrives"
//   • forward-reference held + patched (SPEC-R4)  → tree.test.ts "out-of-order child held + patched" / "child …
//                                                    delivered before its parent … mounts under the parent"
//   • progressive first paint as a metric (N1)    → the R3+R4 pair above, made VISIBLE here as a timing readout
//   • fault isolation, stream continues (N4)      → renderer.test.ts "a malformed line emits error{PARSE} and
//                                                    the stream continues" / parser.test.ts "fault isolation…"
//   • validate-at-finalize (ADR-0002)             → renderer.test.ts "finalize catches a missing root … NOT
//                                                    falsely raised in-stream" · the seed itself: examples.test.ts
// The seed's own validity + clean real-host render is the standing examples.test.ts gate (ADR-0055) — this page
// rides it; it invents no parallel check.

import { mountPage } from './_page.ts' // FIRST import — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './a2ui-stream.css' // page-local layout chrome only (the feed log · the live-surface frame · the client log)
import { codeBlock } from '../lib/code-block.ts' // shared <pre><code> previews (textContent, no injection)
import { createRenderer } from '@agent-ui/a2ui'
import type { RendererHost, A2uiClientMessage, A2uiServerMessage } from '@agent-ui/a2ui'
import { generativeFormSeed } from '@agent-ui/a2ui/examples' // the shared, fine-grained form seed (ADR-0055, fork F1)

const { content } = mountPage({
  title: 'A2UI streaming',
  intro:
    'An agent does not hand you a finished screen — it *streams* one. Each JSONL line is applied the moment it ' +
    'arrives, so the surface assembles as you watch. Below, the same generative-form payload the form page renders ' +
    'in one shot is fed line-by-line through the real renderer. The feed on the left grows exactly as it is fed ' +
    '(shown ≡ fed); the live surface on the right is the renderer’s output. Demo 1 streams it in order — the root ' +
    'arrives early, so the surface paints early and fills in field by field. Demo 2 feeds the same objects with the ' +
    'root LAST, and nothing paints until it lands: root-early is what makes a stream *feel* progressive.',
})

const PACE_MS = 300 // one line every ~0.3s — readable, and short enough that the whole 9-line form streams in ~3s.

// A page-local, deliberately-malformed line — NOT part of any seed (the shelf stays validator-clean, so the
// standing examples.test.ts gate never sees it). Truncated JSON: `JSON.parse` throws → the renderer's parser
// fault-isolates it as a ParseError and emits ONE client error (internally a `PARSE` fault; on the closed v1.0
// wire it surfaces as `VALIDATION_FAILED` with an empty surfaceId — ADR-0031's two-code collapse), and the
// stream CONTINUES to a clean finalize (runtime SPEC-N4, live).
const MALFORMED_LINE = '{"version":"v1.0","updateComponents":{"surfaceId":"form",'

// ── payload derivation — every message the demos feed comes from the seed; Demo 2 is a permutation, not a copy ─
/** The non-`version` envelope key of a server message (`createSurface` / `updateComponents` / …) — the caption. */
function envelopeKey(message: A2uiServerMessage): string {
  return Object.keys(message).find((k) => k !== 'version') ?? '?'
}

/** The 1-based index of the message that DEFINES the root component (`id: 'root'`) — the "first paint" line. */
function rootLine(messages: readonly A2uiServerMessage[]): number {
  const i = messages.findIndex((m) => 'updateComponents' in m && m.updateComponents.components.some((c) => c.id === 'root'))
  return i + 1 // 1-based for the human-facing "line X of N"; 0 if none found (never, for a valid seed)
}

/**
 * rootLastPermutation — Demo 2's ordering, DERIVED from the seed at runtime (never a second literal). Keeps
 * `createSurface` FIRST (a surface must exist before content routes — decomp §6 invariant, preserved because
 * the root-defining message is never index 0), preserves the order of every other message, and moves ONLY the
 * root-defining `updateComponents` to the END. Filtering + appending by object identity makes the result a
 * provable permutation of the same multiset — the finalize set is byte-identical to Demo 1's, so it validates
 * the same (ADR-0002). The Select+Options message is one object and is never split, so ADR-0053's
 * first-connect rule (a Select must arrive WITH its Options) holds under the reorder.
 */
function rootLastPermutation(messages: readonly A2uiServerMessage[]): readonly A2uiServerMessage[] {
  const root = messages.find((m) => 'updateComponents' in m && m.updateComponents.components.some((c) => c.id === 'root'))
  if (root === undefined) return messages // defensive: a seed with no root has nothing to reorder
  return [...messages.filter((m) => m !== root), root]
}

// ── page chrome scaffold (light-DOM only — it never restyles a ui-* control) ─────────────────────────────────
/** A dogfooded control affordance: a real ui-button with a native click listener (the canvas precedent). */
function controlButton(label: string, variant: 'solid' | 'soft' | 'ghost', onClick: () => void): HTMLElement {
  const el = document.createElement('ui-button')
  el.textContent = label
  el.setAttribute('variant', variant)
  el.setAttribute('tabindex', '0') // the control sets none itself; the press-activation trait does the rest
  el.addEventListener('click', onClick)
  return el
}

// The client→server log renderer (canvas precedent): discriminate the three outbound arms into a scannable head
// line; the full envelope still pretty-prints below (the source of truth). A PARSE fault arrives here as an
// `error` whose wire code is VALIDATION_FAILED with an empty surfaceId (ADR-0031) — labelled honestly.
function describeClientMessage(message: A2uiClientMessage): { kind: string; label: string } {
  if ('action' in message) return { kind: 'action', label: `action ▸ server · ${message.action.name}` }
  if ('functionResponse' in message) {
    const r = message.functionResponse
    return { kind: 'response', label: `functionResponse ▸ server · ${r.call} = ${JSON.stringify(r.value)}` }
  }
  const e = message.error // A2uiWireError: VALIDATION_FAILED+surfaceId | INVALID_FUNCTION_CALL+functionCallId
  const id = 'functionCallId' in e ? e.functionCallId : e.surfaceId
  return { kind: 'error', label: `error ▸ server · ${e.code}${id ? ` (${id})` : ''}` }
}

/**
 * streamDemo — one captioned streaming demo. Left pane: the FEED LOG that grows as lines are fed (shown ≡ fed),
 * with a `k/N` counter. Right pane: the LIVE renderer surface, a status/first-paint readout, and the client→
 * server log (where an injected PARSE fault surfaces). A toolbar drives the feed: Replay (fresh renderer, from
 * scratch), Step (pause + advance one line), and — for the streaming demo — Inject fault. Auto-runs ONCE.
 */
function streamDemo(opts: {
  step: string
  title: string
  blurb: string
  messages: readonly A2uiServerMessage[]
  surfaceId: string
  promptText?: string // Demo 1 shows the seed's prompt — the instruction the agent "received" (derived, not typed)
  faultInjection?: boolean // Demo 1 carries the malformed-line affordance (N4); Demo 2 is about order alone
}): HTMLElement {
  const N = opts.messages.length
  const lines = opts.messages.map((m) => JSON.stringify(m)) // the compact JSONL actually fed — same objects, derived

  const section = document.createElement('section')
  section.className = 'demo'

  const heading = document.createElement('h2')
  const badge = document.createElement('span')
  badge.className = 'demo-step'
  badge.textContent = opts.step
  heading.append(badge, document.createTextNode(` ${opts.title}`))

  const blurb = document.createElement('p')
  blurb.className = 'demo-blurb'
  blurb.textContent = opts.blurb
  section.append(heading, blurb)

  // The prompt the agent "received" (Demo 1) — pulled straight off the seed so it can never drift from the payload.
  if (opts.promptText !== undefined) {
    const prompt = document.createElement('blockquote')
    prompt.className = 'demo-prompt'
    const label = document.createElement('span')
    label.className = 'demo-prompt-label'
    label.textContent = 'Prompt'
    const body = document.createElement('p')
    body.textContent = opts.promptText
    prompt.append(label, body)
    section.append(prompt)
  }

  // ── toolbar (drives the feed) ──────────────────────────────────────────────────────────────────────────────
  const toolbar = document.createElement('div')
  toolbar.className = 'stream-toolbar'
  const stepButton = controlButton('Step', 'soft', () => step())
  const buttons: HTMLElement[] = [controlButton('Replay', 'solid', () => replay()), stepButton]
  if (opts.faultInjection) buttons.push(controlButton('Inject a malformed line', 'ghost', () => injectFault()))
  toolbar.append(...buttons)
  section.append(toolbar)

  // ── the two-pane grid: feed log (left) | live surface + status + client log (right) ─────────────────────────
  const grid = document.createElement('div')
  grid.className = 'demo-grid'

  const feedPane = document.createElement('div')
  feedPane.className = 'feed-pane'
  const counter = document.createElement('div')
  counter.className = 'feed-counter'
  const feedLog = document.createElement('ol')
  feedLog.className = 'feed-log'
  feedLog.setAttribute('aria-live', 'polite')
  feedPane.append(counter, feedLog)

  const outputPane = document.createElement('div')
  outputPane.className = 'output-pane'
  const surfaceEl = document.createElement('div')
  surfaceEl.className = 'surface'
  const statusBar = document.createElement('div')
  statusBar.className = 'stream-status'
  const phaseEl = document.createElement('span')
  phaseEl.className = 'status-phase'
  const firstPaintEl = document.createElement('span')
  firstPaintEl.className = 'status-first-paint'
  firstPaintEl.hidden = true
  statusBar.append(phaseEl, firstPaintEl)
  const msgLog = document.createElement('ol')
  msgLog.className = 'msg-log'
  msgLog.setAttribute('aria-live', 'polite')
  outputPane.append(surfaceEl, statusBar, msgLog)

  grid.append(feedPane, outputPane)
  section.append(grid)

  // ── the demo's own driver state (one closure per demo — independent host / cursor / timer) ──────────────────
  let host: RendererHost | undefined
  let cursor = 0 // lines fed so far (0..N)
  let firstPaintLine: number | undefined // the line after which surfaceEl first became non-empty (the N1 metric)
  let timer: number | undefined // pending auto-advance timeout (cleared on Step / Replay — no runaway loops)
  let mode: 'idle' | 'auto' | 'step' | 'done' = 'idle'
  let seq = 0 // client-message counter

  function clearTimer(): void {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  function appendClientMessage(message: A2uiClientMessage): void {
    seq += 1
    const { kind, label } = describeClientMessage(message)
    const item = document.createElement('li')
    item.dataset.kind = kind
    const head = document.createElement('div')
    head.className = 'msg-head'
    head.textContent = `#${String(seq).padStart(2, '0')}  ${label}`
    item.append(head, codeBlock(JSON.stringify(message, null, 2), 'json'))
    msgLog.append(item)
    msgLog.scrollTop = msgLog.scrollHeight
  }

  function appendFeedEntry(n: number, message: A2uiServerMessage): void {
    const item = document.createElement('li')
    item.dataset.kind = 'message'
    const head = document.createElement('div')
    head.className = 'feed-head'
    head.textContent = `Line ${n}/${N} — ${envelopeKey(message)}`
    item.append(head, codeBlock(JSON.stringify(message, null, 2), 'json')) // pretty for reading; fed compact above
    feedLog.append(item)
    feedLog.scrollTop = feedLog.scrollHeight
  }

  function appendFaultEntry(raw: string): void {
    const item = document.createElement('li')
    item.dataset.kind = 'fault'
    const head = document.createElement('div')
    head.className = 'feed-head'
    head.textContent = 'Injected malformed line — not part of the payload'
    item.append(head, codeBlock(raw, 'json'))
    feedLog.append(item)
    feedLog.scrollTop = feedLog.scrollHeight
  }

  function renderStatus(): void {
    counter.textContent = `Fed ${cursor} of ${N} lines`
    phaseEl.dataset.phase = mode
    phaseEl.textContent =
      mode === 'done'
        ? 'Stream complete — finalized (validate-at-finalize, ADR-0002); client log clean.'
        : cursor === 0
          ? 'Ready — press Replay or Step to feed the stream.'
          : `Streaming… line ${cursor} of ${N}.`
    if (firstPaintLine !== undefined) {
      firstPaintEl.hidden = false
      firstPaintEl.textContent = `First paint after line ${firstPaintLine} of ${N}.`
    }
  }

  // Enable Step only while there is more to feed; the click handlers self-guard regardless (the button honours
  // its own `disabled` render — the page never restyles it).
  function syncControls(): void {
    stepButton.toggleAttribute('disabled', mode === 'done')
  }

  // Feed exactly one line into the current host, mirror it into the feed log, and re-read first-paint. When the
  // last line lands, finalize the COMPLETE set (ADR-0002) — the honest end-of-stream validation.
  function advance(): void {
    if (host === undefined || cursor >= N) return
    const message = opts.messages[cursor]
    if (message === undefined) return
    host.ingest(lines[cursor]!)
    cursor += 1
    appendFeedEntry(cursor, message)
    if (firstPaintLine === undefined && surfaceEl.childElementCount > 0) firstPaintLine = cursor
    if (cursor >= N) {
      host.finalize(opts.surfaceId)
      mode = 'done'
    }
    renderStatus()
    syncControls()
  }

  // Auto mode: advance on a timer until done. NOT a loop — it stops itself at `done`, and Step/Replay clear the
  // pending tick, so the page never autoplays in a cycle (decomp §2: "auto-run ONCE on load; no loops").
  function auto(): void {
    mode = 'auto'
    syncControls()
    clearTimer()
    const tick = (): void => {
      advance()
      timer = mode === 'auto' && cursor < N ? window.setTimeout(tick, PACE_MS) : undefined
    }
    timer = window.setTimeout(tick, PACE_MS)
  }

  // Step: pause any auto-advance and hand the feed to the click — one line per press (the teaching mode).
  function step(): void {
    if (mode === 'done') return
    clearTimer()
    mode = 'step'
    advance()
  }

  // Replay: tear the prior renderer down cleanly (leak-free, N3) and re-run from a fresh one — idempotent, no
  // residue across replays (the canvas `run()` teardown pattern extended for a paced feed).
  function reset(): void {
    clearTimer()
    host?.dispose()
    surfaceEl.replaceChildren()
    feedLog.replaceChildren()
    msgLog.replaceChildren()
    cursor = 0
    seq = 0
    firstPaintLine = undefined
    firstPaintEl.hidden = true
    mode = 'idle'
    host = createRenderer()
    host.onClientMessage(appendClientMessage)
    host.mount(surfaceEl)
    renderStatus()
    syncControls()
  }

  function replay(): void {
    reset()
    auto()
  }

  // Inject ONE malformed line into the live host mid-stream: it appears in the feed (shown ≡ fed, marked as the
  // out-of-band fault it is) and the resulting PARSE error surfaces on the client channel — the stream is
  // otherwise untouched (SPEC-N4). Never counted toward k/N (it is not part of the payload).
  function injectFault(): void {
    if (host === undefined) return
    host.ingest(MALFORMED_LINE)
    appendFaultEntry(MALFORMED_LINE)
  }

  reset()
  auto() // auto-run ONCE on first paint
  return section
}

// ── Demo 1 — root-early: the agent composes a form while you watch ───────────────────────────────────────────
const SEED = generativeFormSeed
const N = SEED.messages.length
const ROOT_LINE = rootLine(SEED.messages)

content.append(
  streamDemo({
    step: '1',
    title: 'The agent composes a form while you watch',
    blurb:
      `The shared generative-form seed, streamed in order. createSurface stands up the surface, then the root Card ` +
      `arrives at line ${ROOT_LINE} of ${N} — so the surface paints early and the form fills in field by field as ` +
      `each updateComponents lands (forward references on the FormProvider’s children resolve as their fields arrive, ` +
      `SPEC-R4). The “first paint after line ${ROOT_LINE}” readout is the visible SPEC-N1 proof: render begins the ` +
      `moment the root exists, not at the end of the stream.`,
    messages: SEED.messages,
    surfaceId: SEED.surfaceId,
    promptText: SEED.promptText,
    faultInjection: true,
  }),
  streamDemo({
    step: '2',
    title: 'Same payload, hostile order — root last',
    blurb:
      `The exact same objects, reordered at runtime so the root Card is fed LAST (line ${N} of ${N}); createSurface ` +
      `still goes first. Every field arrives before there is a root to hang it on, so the renderer holds each as a ` +
      `pending anchor and paints NOTHING (render-on-root, SPEC-R3) — until the root lands and the whole tree appears ` +
      `at once. Same finalize set, same clean result (ADR-0002); only the felt experience differs. The lesson for an ` +
      `agent author: emit the root early.`,
    messages: rootLastPermutation(SEED.messages),
    surfaceId: SEED.surfaceId,
  }),
)
