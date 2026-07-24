// gen-ui-live.ts — the GenUI chat demo (genui-surface.spec.md SPEC §3.2/§3.3, D9; Kim's 2026-07-24
// ruling). Layout: [ chat | render ]. The chat drives a deterministic RECORDED transport (SPEC §6's B1/B2
// split — only B1, `ui-sandbox-frame`, has shipped; there is no live GenUI producer yet), mirroring
// a2ui-live.ts's own recorded-backbone-by-default construction site (SPEC-R1's "the page consumes ONLY the
// transport seam" discipline, carried over here even though this page has no live overlay to swap in). The
// render pane hosts one `ui-sandbox-frame` per rendered surface — the fail-closed containment host, never
// A2UI (this is deliberately NOT an A2UI page: GenUI validates the BOUNDARY, not a catalog payload).
//
// RECORDED-ONLY, BY DESIGN (not a stopgap): unlike a2ui-live.ts, this page has no `wireLiveOverlay()` at
// all. A2UI already has a real, shipped live producer (`@agent-ui/a2ui/agent`) to probe for; GenUI's own
// wire + producer (SPEC §6's B2 slice) has not shipped. Building a probe for a backend that does not exist
// would be dead code, not a widening — so the page states its recorded nature plainly instead (a permanent
// "Recorded demo" badge + an opening system message), the same honesty a2ui-live's own non-DEV system
// message practices ("Recorded backbone demo…") when no live key is configured.
//
// The wire shape this page's transport yields is the REAL SPEC-R1 envelope (`{"genui":{surfaceId, html}}`,
// `genui-line.ts`) — a site-local STUB reader, not the shipped B2 module (which does not exist yet), but
// structurally identical to it. Swapping in the real producer later means: (a) point `transport` at a real
// `AgentTransport` instead of `createRecordedTransport(genuiTranscript)`, and (b) swap the one `genui-
// line.ts` import for the real `@agent-ui/a2ui/agent`'s module — no reshaping of the render/round-trip
// path below, which already speaks the real contract.

import { mountFullBleedPage } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import '@agent-ui/app/super-shell.css' // ui-super-shell's own token ladder + collapse CSS (ADR-0156)
import '@agent-ui/app/super-shell' // self-defines ui-super-shell
// ADR-0129 Fork B's precedent, continued here (a2ui-live.ts's own construction-site note): compose ONLY
// the standalone composer + narration widgets, never `<ui-conversation>` — this page has no AskRegistry
// precedent to preserve at all (no feed-embedded asks; Kim's ruling), so there is nothing `<ui-
// conversation>`'s own lifecycle would even need to coexist with — staying consistent with the sibling
// page's proven standalone-widget shape is the only reason to name that choice at all.
import '@agent-ui/app/conversation-composer.css' // ui-conversation-composer's own field-frame chrome (TKT-0056/0058)
import '@agent-ui/app/conversation-composer' // self-defines <ui-conversation-composer> — composed standalone
import type { UIConversationComposerElement } from '@agent-ui/app/conversation-composer'
import type { UIStatusStreamElement, UISandboxFrameElement, GenuiActionDetail } from '@agent-ui/components/components'
import './gen-ui-live.css'
import { createRecordedTransport, appendUserTurn, appendAssistantTurn, readMetaLine } from '../lib/agent-runtime.ts'
import type { AgentTransport, TurnInput, Session } from '../lib/agent-runtime.ts'
import type { TurnProgress, TurnProgressStage } from '@agent-ui/a2ui/agent/meta-line' // type-only — erases at build (ADR-0146 F1 precedent)
import { readGenuiLine } from '../lib/genui-line.ts'
import { genuiTranscript } from '../lib/genui-transcript.ts'

const { content } = mountFullBleedPage()

// ── small light-DOM chrome helpers (page chrome only — never restyle a ui-* control) ────────────────────
function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  return node
}
function paneHead(title: string, blurb: string, badge?: string): HTMLElement {
  const head = el('header', 'pane-head')
  const text = el('div', 'pane-head-text')
  const h = document.createElement('h2')
  h.className = 'pane-title'
  h.textContent = title
  const p = el('p', 'pane-blurb')
  p.textContent = blurb
  text.append(h, p)
  head.append(text)
  if (badge) {
    const b = el('span', 'demo-badge')
    b.textContent = badge
    head.append(b)
  }
  return head
}

// ════════════════ the two panes — ui-super-shell slots (the a2ui-live.ts precedent, ADR-0156 re-host):
// `content` is the mandatory slot, so the render pane — the surface this page exists to show — takes it;
// the chat composer docks into `nav-pane` alongside it. ════════════════
const shell = document.createElement('ui-super-shell')
shell.setAttribute('narrow-start', 'stack') // the composer stays visible + full-width when narrow — primary input, not disposable chrome
const chatPane = document.createElement('div')
chatPane.setAttribute('data-slot', 'nav-pane')
chatPane.setAttribute('data-landmark', 'complementary')
chatPane.className = 'chat-pane'
const renderPane = document.createElement('div')
renderPane.setAttribute('data-slot', 'content')
renderPane.className = 'render-pane'
shell.append(chatPane, renderPane)
content.append(shell)

// ── chat pane: log · composer ────────────────────────────────────────────────────────────────────────────
chatPane.append(paneHead('Chat', 'Prompt the demo, then interact with the surface it renders.'))
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

const composer = document.createElement('ui-conversation-composer') as UIConversationComposerElement
composer.className = 'chat-composer'
chatPane.append(composer)

// ── render pane: the GenUI stack — a scrollable list of per-surface cards, one `ui-sandbox-frame` per
// rendered surface (SPEC §3.2). ─────────────────────────────────────────────────────────────────────────
renderPane.append(paneHead('GenUI render', 'Sandboxed, agent-authored HTML/CSS/JS — contained, never trusted.', 'Recorded demo'))
const surfaceStack = el('div', 'surface-stack')
renderPane.append(surfaceStack)

interface MountedSurface {
  readonly host: UISandboxFrameElement
}
const surfaces = new Map<string, MountedSurface>()

/** `titleFromSurfaceId` — `q3-revenue` -> `Q3 Revenue` (the same tag→title-case shape generate-sitemap.mjs's
 *  own `titleCaseFromTag` uses), a purely cosmetic per-card label. */
function titleFromSurfaceId(surfaceId: string): string {
  return surfaceId
    .split('-')
    .map((w) => (w.toUpperCase() === w ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

/** Mount a NEW surface card, or — for a surfaceId already on the stack (SPEC-R5's "replace" lifecycle,
 *  same-surface continuation) — rebuild the EXISTING instance's `html` in place, atomically, rather than
 *  minting a duplicate card. Every mounted frame gets its own `action` listener wired once, at creation. */
function renderGenuiSurface(surfaceId: string, html: string): void {
  const existing = surfaces.get(surfaceId)
  if (existing) {
    existing.host.html = html // SPEC-R5 replace: the control rebuilds the whole srcdoc atomically
    return
  }
  const card = el('section', 'surface-card')
  const cardHead = el('div', 'surface-card-head')
  const cardTitle = document.createElement('h3')
  cardTitle.className = 'surface-card-title'
  cardTitle.textContent = titleFromSurfaceId(surfaceId)
  const cardId = el('span', 'surface-card-id')
  cardId.textContent = surfaceId
  cardHead.append(cardTitle, cardId)
  const host = document.createElement('ui-sandbox-frame') as UISandboxFrameElement
  host.surfaceId = surfaceId
  host.addEventListener('action', (e) => {
    const detail = (e as CustomEvent<GenuiActionDetail>).detail
    handleGenuiAction(detail)
  })
  host.html = html
  card.append(cardHead, host)
  surfaceStack.append(card)
  surfaces.set(surfaceId, { host })
  surfaceStack.scrollTop = surfaceStack.scrollHeight
}

// ════════════════ the transport + the chat loop ════════════════
// The ONLY transport this page ever constructs: the deterministic recorded backbone (SPEC §6). No live
// overlay exists for GenUI yet (see the file banner) — `transport` is reassigned only by Reset, below.
let transport: AgentTransport = createRecordedTransport(genuiTranscript)

let session: Session = { turns: [] }
let busy = false

function setBusy(next: boolean): void {
  busy = next
  composer.busy = next
}

// ── narration (ADR-0146 F1, GH #239/ADR-0159) — the SAME standalone `<ui-status-stream>` pattern a2ui-
// live.ts composes: one fresh instance per turn, appended into the chat log. Promoted verbatim rather than
// imported (a2ui-live.ts's own precedent: this is a deliberate small page-local duplicate of the identical
// closed table, not a parallel invention — neither page imports `conversation.ts`, which `<ui-
// conversation>`'s ADR-0129 Fork B bars from this family of pages entirely). ──────────────────────────────
function makeNarration(): UIStatusStreamElement {
  const narration = document.createElement('ui-status-stream') as UIStatusStreamElement
  narration.setAttribute('size', 'sm')
  narration.setAttribute('label', 'Agent activity')
  narration.setAttribute('header', '') // reads "working" from t=0, even a zero-progress turn
  narration.setAttribute('oneline', '')
  narration.setAttribute('receipt', '')
  narration.classList.add('narration-strip')
  return narration
}

interface ProgressLabelPair {
  live: string
  done: string
}

// The closed, code-owned progress stage → label table (ADR-0146 F2/F8), promoted verbatim from
// conversation.ts's own `PROGRESS_LABEL` — the SAME closed vocabulary, same factual process labels, same
// live/done pair convention a2ui-live.ts already duplicates for the identical reason.
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

async function runTurn(input: TurnInput): Promise<void> {
  if (busy) return
  setBusy(true)
  const narration = makeNarration()
  chatLog.append(narration)
  chatLog.scrollTop = chatLog.scrollHeight

  const progressKeysSeen = new Set<string>()
  const doneLabelByKey = new Map<string, string>()
  let lastProgressKey: string | undefined
  const settleProgress = (key: string): void => {
    const doneLabel = doneLabelByKey.get(key)
    narration.update(key, doneLabel === undefined ? { status: 'done' } : { status: 'done', label: doneLabel })
  }
  const routeProgress = (ev: TurnProgress): void => {
    const pair = PROGRESS_LABEL[ev.stage] as ProgressLabelPair | undefined
    if (pair === undefined) return
    if (ev.stage === 'done') {
      if (lastProgressKey !== undefined) settleProgress(lastProgressKey)
      lastProgressKey = undefined
      return
    }
    const suffix =
      ev.stage === 'retry' ? (ev.round === undefined ? '' : ` (round ${ev.round})`) : ev.stage === 'tool' && ev.detail ? ` (${ev.detail})` : ''
    const label = `${pair.live}${suffix}`
    const key = ev.stage === 'retry' ? `progress-retry-${ev.round ?? 1}` : ev.stage === 'tool' ? `progress-tool-${ev.detail ?? 'unknown'}` : `progress-${ev.stage}`
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
    const genuiLines: string[] = []
    let note: string | undefined
    for await (const line of transport.turn(input)) {
      // The SAME reserved-meta-line filter a2ui-live.ts uses (readMetaLine, meta-line.ts) — GenUI's
      // `progress`/`note` ride the identical envelope; only the CONTENT line kind differs (genui, not
      // A2UI JSONL).
      const meta = readMetaLine(line)
      if (meta) {
        if (meta.a2uiMeta.progress !== undefined) routeProgress(meta.a2uiMeta.progress)
        if (meta.a2uiMeta.note !== undefined) note = meta.a2uiMeta.note
        continue
      }
      // SPEC-R1: structural whole-line rejection — a line that is neither a meta-line nor a valid genui
      // envelope is silently dropped (never partially honored, never a throw).
      const envelope = readGenuiLine(line)
      if (envelope === undefined) continue
      genuiLines.push(line)
      renderGenuiSurface(envelope.genui.surfaceId, envelope.genui.html)
    }
    if (lastProgressKey !== undefined) settleProgress(lastProgressKey)
    narration.finalize()

    if (genuiLines.length === 0 && note === undefined) {
      addMessage('system', 'The agent has no further turns in this recorded transcript. Reset to start over.')
      return
    }
    session = appendUserTurn(session, input.kind === 'intent' ? input.text : '')
    session = appendAssistantTurn(session, genuiLines.join('\n'))
    addMessage('agent', note ?? `Rendered ${genuiLines.length} GenUI surface(s) — see the render pane.`)
  } catch (e) {
    narration.appendEntry({ key: 'progress-error', status: 'error', label: `Turn failed — ${(e as Error).message}` })
    narration.fail()
    addMessage('system', `⚠ ${(e as Error).message}`)
  } finally {
    setBusy(false)
  }
}

/**
 * SPEC-R8's routing law, demo-scale: a valid `action` from a sandboxed surface becomes the NEXT USER TURN,
 * dispatched through the SAME bounded `runTurn` loop the composer uses — a GenUI action can never open an
 * unbounded turn loop (the recorded transport is inherently bounded: a finite, committed turn array). The
 * three facts SPEC-R8 names — surfaceId, name, payload — ride verbatim in the framed text; this page has
 * no `A2uiClientMessage` shape to reuse for a GenUI action (it isn't an A2UI client message), so an
 * `intent`-kind `TurnInput` carrying the facts as plain, factual text is the honest choice here, pending a
 * real B2 producer's own typed routing contract.
 */
function handleGenuiAction(detail: GenuiActionDetail): void {
  addMessage('system', `Received action from "${detail.surfaceId}" — ${detail.name}(${JSON.stringify(detail.payload ?? null)})`)
  const text = `[GenUI action] surface=${detail.surfaceId} name=${detail.name} payload=${JSON.stringify(detail.payload ?? null)}`
  void runTurn({ kind: 'intent', text, session })
}

composer.onSubmit((text) => {
  addMessage('user', text)
  void runTurn({ kind: 'intent', text, session })
})

// ── Reset: clear the session + surfaces + log, restart the transport ───────────────────────────────────
const resetBtn = document.createElement('ui-button')
resetBtn.setAttribute('variant', 'ghost')
resetBtn.setAttribute('tabindex', '0')
resetBtn.textContent = 'Reset'
resetBtn.addEventListener('click', () => {
  surfaceStack.replaceChildren() // disposes every mounted ui-sandbox-frame's own disconnected() cleanup
  surfaces.clear()
  session = { turns: [] }
  transport = createRecordedTransport(genuiTranscript)
  chatLog.replaceChildren()
  addMessage('system', 'Recorded demo. Send a message to begin — the demo advances one canned turn per message (it does not read what you type).')
})
const resetBar = el('div', 'reset-bar')
resetBar.append(resetBtn)
renderPane.append(resetBar)

// ── initial state ───────────────────────────────────────────────────────────────────────────────────────
addMessage('system', 'Recorded demo. Send a message to begin — the demo advances one canned turn per message (it does not read what you type).')
