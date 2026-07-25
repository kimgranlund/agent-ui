// gen-ui-live.ts — the GenUI chat demo (genui-surface.spec.md SPEC §3.2/§3.3, D9; Kim's 2026-07-24
// ruling). Layout: [ chat | render ]. The chat drives an AgentTransport; the render pane hosts one
// `ui-sandbox-frame` per rendered surface — the fail-closed containment host, never A2UI (this is
// deliberately NOT an A2UI page: GenUI validates the BOUNDARY, not a catalog payload).
//
// The page consumes ONLY the AgentTransport seam (SPEC-R1), mirroring a2ui-live.ts's own construction site:
// the default is the deterministic RECORDED BACKBONE (works offline, under CI, and whenever no live
// provider is configured). GH #266 (B2) shipped the server-side wiring a live overlay needed — both
// `dev-proxy-plugin.ts` and `worker/index.ts` already parse a `genui` field through `validateGenuiSurface()`
// (chat-validation.ts) into `ProduceOptions.genuiSurface` — this page's own live overlay was the one
// remaining gap; it is closed here. The LIVE overlay — a real model via the SAME same-origin proxy
// a2ui-live.ts uses (`/__a2ui/agent`; dev-proxy-plugin.ts in dev, worker/index.ts in prod), probed with
// `GET /status` at runtime, ALWAYS sending `genui: {enabled: true}` (this demo's entire point IS GenUI —
// there is no "off" mode for this page, unlike agent-admin's Surface Options, where GenUI is one of several
// optional modalities) — is swapped in via the same dynamic-import + probe pattern a2ui-live.ts's own
// `wireLiveOverlay()` uses (`live-proxy-transport.ts`'s `createLiveProxyTransport` now takes an optional
// second `genui` param for exactly this call site — a2ui-live.ts's own one-arg call stays byte-identical).
// A client browser never holds a key either way (ADR-0073 clause 5).
//
// This page also exposes the composer's own Provider/Model picker (GH #257's shared
// `provider-mode-selection.ts`, reused verbatim from a2ui-live.ts — already-built shared infrastructure,
// not new UI) once a live provider is confirmed; `models` is left unset deliberately — the composer's own
// `#effectiveModels()` (conversation-composer.ts) already narrows the Models picker from `providers`+
// `provider` alone. The Mode picker is deliberately left UNEXPOSED here: `GenUiMode` (gen-ui-mode.ts) is
// the orthogonal A2UI-catalog prompt-disposition axis (default/specific/blue-sky) — `system-prompt.ts`'s
// `genuiBlock` composes independent of `mode`, so the axis has no bearing on a GenUI-only demo; exposing
// it would only add a control this page has no honest use for.
//
// The Effort picker (`efforts`/`effort`/`onEffortChange`, agent-admin.ts's own wiring pattern) is ALSO
// deliberately left unwired here — NOT a simplification, a verified server-side gap: `produce.ts`'s
// `ProduceOptions` has no `effort` field at all, and the generic POST branch BOTH `dev-proxy-plugin.ts` and
// `worker/index.ts` use for this transport (the one `createLiveProxyTransport` hits) parses only
// `{input,provider,model,mode,genui,...}` — never `effort` (only the SEPARATE `/chat` route, agent-admin's
// own raw one-shot `provider.stream()` call bypassing `produce()` entirely, threads `effort` through
// today). a2ui-live.ts's own composer construction leaves `efforts` unset for the identical reason. Wiring
// this picker here would render a control with NO effect on the live call — dishonest UI; see this
// change's own handback for the recommended produce()/dev-proxy-plugin.ts/worker/index.ts amendment
// (mirroring the `mode`/`genui` precedent) that would need to land FIRST.
//
// RECORDED BY DEFAULT (still the fallback, same fail-closed/degrade-clean posture as every other live
// surface in this repo): a "Recorded demo" badge in the render pane + an opening system message state this
// plainly whenever no live provider is configured; both are replaced (badge removed, a live-connected
// system message shown) once `/status` confirms a real provider key — the same honesty a2ui-live.ts's own
// non-DEV system message practices.
//
// The wire shape this page's transport yields is the REAL SPEC-R1 envelope (`{"genui":{surfaceId, html}}`)
// — `genui-line.ts` is now a thin re-export of the shipped `@agent-ui/a2ui/agent/genui-line` module
// (SPEC-R1's "ONE implementation both producer and client use"), so the recorded backbone and the live
// overlay both speak the identical, real contract; no reshaping of the render/round-trip path below either
// way.

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
// GH #257/#266 — the shared Provider/Model option data + persistence (a2ui-live.ts's own precedent),
// reused verbatim once a live provider is confirmed; see the file banner for why the Mode picker is not
// wired here.
import { PROVIDER_OPTIONS, loadPersistedSelection, persistSelection } from '../lib/provider-mode-selection.ts'

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

/** Show/replace/remove the render pane's own "Recorded demo" badge (`.render-pane .pane-head`) — the ONE
 *  DOM spot `wireLiveOverlay()`/Reset update as the live probe resolves: `text` shown when running on the
 *  recorded backbone, `undefined` to remove it once a live provider is confirmed (a2ui-live.ts has no
 *  equivalent badge, only its own system messages — this page keeps the badge because it existed before
 *  the live overlay shipped and remains an honest, at-a-glance signal). */
function setDemoBadge(text: string | undefined): void {
  const head = renderPane.querySelector('.pane-head') as HTMLElement | null
  if (!head) return
  let badge = head.querySelector('.demo-badge') as HTMLElement | null
  if (text === undefined) {
    badge?.remove()
    return
  }
  if (!badge) {
    badge = el('span', 'demo-badge')
    head.append(badge)
  }
  badge.textContent = text
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
// Default: the deterministic recorded backbone (SPEC §6) — swapped for the live overlay by
// `wireLiveOverlay()` (see the file banner + the bottom of this file) whenever `/status` confirms a real
// provider key; also reassigned by Reset, which restarts recorded first, then re-probes.
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
  transport = createRecordedTransport(genuiTranscript) // fail-closed default — wireLiveOverlay() below re-probes + swaps back in if a live key is still available
  chatLog.replaceChildren()
  setDemoBadge('Recorded demo') // reset to the fail-closed default; wireLiveOverlay() removes it again if the re-probe still finds a live key
  addMessage('system', 'New conversation. Send a message to begin.')
  wireLiveOverlay() // re-probe
})
const resetBar = el('div', 'reset-bar')
resetBar.append(resetBtn)
renderPane.append(resetBar)

// ════════════════ the LIVE overlay — probed dynamically in both dev and prod (the a2ui-live.ts precedent;
// see the file banner). Always sends `genui: {enabled: true}` — this page's entire point IS GenUI, so
// there is no "off" branch to preserve. Degrades cleanly to the recorded backbone whenever `/status`
// reports no live provider available (no key configured). ════════════════════════
function wireLiveOverlay(): void {
  void (async () => {
    try {
      const overlay = await import('../lib/live-proxy-transport.ts')
      const status = await overlay.probeLive()
      if (status.available) {
        // GH #257's shared picker infra, reused verbatim from a2ui-live.ts's own wireLiveOverlay — Provider/
        // Model only (see the file banner for why Mode AND Effort both stay unexposed on this page — Effort
        // specifically is a verified server-side gap, not a scope choice: produce.ts's ProduceOptions/this
        // transport's own POST body have no `effort` field to receive one).
        let selection = loadPersistedSelection()
        composer.providers = PROVIDER_OPTIONS
        composer.provider = selection.provider
        composer.model = selection.model
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
        transport = overlay.createLiveProxyTransport({ get: () => selection }, { enabled: true })
        setDemoBadge(undefined)
        addMessage('system', `Live agent connected (${status.providers} provider(s) available). Prompt it to render a real GenUI surface.`)
      } else if (import.meta.env.DEV) {
        setDemoBadge('Recorded demo')
        addMessage('system', 'Recorded backbone (no live API key found). Set a provider key in .env and restart `npm run dev` for a live GenUI agent.')
      } else {
        setDemoBadge('Recorded demo')
        addMessage('system', 'Recorded demo. Send a message to begin — the demo advances one canned turn per message (it does not read what you type).')
      }
    } catch {
      setDemoBadge('Recorded demo')
      addMessage('system', 'Recorded backbone demo (live overlay unavailable).')
    }
  })()
}

// ── initial state ───────────────────────────────────────────────────────────────────────────────────────
wireLiveOverlay()
