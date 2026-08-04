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
// This page also exposes a Model picker once a live provider is confirmed — but NOT a2ui-live.ts's own
// two-step "Provider dropdown narrows a Model dropdown" shape (`providers`+`provider` driving the
// composer's `#effectiveModels()`, conversation-composer.ts). Kim's ask (screenshot of agent-admin's
// Surface Options Model grid — provider-grouped rows, not two pickers) is realized here as ONE flat,
// provider-grouped Models picker instead: `provider-mode-selection.ts`'s `groupedModelOptions()` reshapes
// the SAME `PROVIDER_OPTIONS` data (no new source) into a single list — a disabled, non-committable
// header row per provider, its own model rows beneath — fed to the composer's plain `models`/`model`
// axis; `providers`/`provider` are never set, so the composer's OWN Provider picker never even builds
// (`#syncProvidersPicker`'s `options === undefined` branch). This is a deliberate SCOPE NARROWING from
// agent-admin's own grid: agent-admin's grid layers a SECOND concept on top of the grouped rows — a
// per-model include/exclude switch, backed by `MODELS_INCLUDED_KEY`'s admin-curated `SettingsStore`
// roster — which has no counterpart here: this is a public demo page with no admin/end-user split and no
// settings store, and every provider/model `providers.json` configures is already meant to be offered
// (there's no roster to curate DOWN from). So only agent-admin's OTHER concept — one flat, provider-
// grouped, single-active-pick list — is reproduced; see `providerIdForModel()` below for how a commit
// recovers the `{provider,model}` pair the live-proxy POST body still needs, now that Provider is no
// longer its own picker. The Mode picker is deliberately left UNEXPOSED here: `GenUiMode` (gen-ui-mode.ts)
// is the orthogonal A2UI-catalog prompt-disposition axis (default/specific/blue-sky) — `system-prompt.ts`'s
// `genuiBlock` composes independent of `mode`, so the axis has no bearing on a GenUI-only demo; exposing
// it would only add a control this page has no honest use for.
//
// The Effort picker (`efforts`/`effort`/`onEffortChange`) rides the SAME shared `provider-mode-selection.ts`
// infra (`EFFORT_LEVELS`/`DEFAULT_EFFORT`/`StoredSelection.effort`) a2ui-live.ts's own `wireLiveOverlay()`
// already wires (GH #272) — the server-side gap this comment used to describe (`ProduceOptions` had no
// `effort` field; the generic POST branch parsed none) is CLOSED: GH #270 threaded the reasoning-effort
// dial through `produce()`'s own provider-call seam, and GH #271 threaded it through the dev proxy + Worker
// route this page's transport hits, so `live-proxy-transport.ts`'s `SelectionRef.effort` now genuinely
// reaches the live call. Wired below exactly like a2ui-live.ts's own copy.
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
// GH #257/#266/#270 — the shared Provider/Model/Effort option data + persistence (a2ui-live.ts's own
// precedent), reused once a live provider is confirmed; see the file banner for why the Mode picker is not
// wired here, and for the flat provider-grouped Model roster (`groupedModelOptions`/`providerIdForModel`)
// this page uses INSTEAD of a2ui-live.ts's own two-step Provider→Model flow.
import { PROVIDER_OPTIONS, EFFORT_LEVELS, groupedModelOptions, providerIdForModel, loadPersistedSelection, persistSelection } from '../lib/provider-mode-selection.ts'
import type { EffortLevel } from '../lib/provider-mode-selection.ts'
// genui-surface.spec.md v0.5 §11 (SPEC-R12, GH #316/ADR-0162) — the dogfood frame asset pair, the opt-in
// `@agent-ui/components` subpath (`site` already imports `components`; catalog-invisible by construction).
import { DOGFOOD_CSS, DOGFOOD_JS } from '@agent-ui/components/dogfood-frame'
import type { SandboxFrameAssets } from '@agent-ui/components/components'

// Computed ONCE at module scope — `PROVIDER_OPTIONS` is static (built from the committed `providers.json`
// at import time), so the grouped reshape never needs to re-run per turn/reset (`#syncModelsPicker`'s own
// reference-identity check, conversation-composer.ts, also wants a STABLE array reference across renders —
// recomputing per call would defeat its "unchanged options ⇒ skip the rebuild" fast path).
const MODEL_OPTIONS = groupedModelOptions(PROVIDER_OPTIONS)

// genui-surface.spec.md v0.5 §11 (SPEC-R12, GH #316/ADR-0162) — the ONE committed asset pair, read once at
// module load (the same "generated data, imported like any other module constant" shape the fleet already
// uses); passed to a mounted `ui-sandbox-frame` only when the dogfood toggle is on (below).
const DOGFOOD_ASSETS: SandboxFrameAssets = { css: DOGFOOD_CSS, js: DOGFOOD_JS }

// genui-surface.spec.md v0.5 §11 — the "Use agent-ui components" toggle's own tiny persisted flag. A
// page-local key (not `provider-mode-selection.ts`'s shared `StoredSelection`): this is a GenUI-only
// concept with no counterpart on a2ui-live.ts, the OTHER consumer of that shared module — a dedicated key
// keeps the dogfood toggle from becoming a third page's reason to touch a module two OTHER pages share.
const DOGFOOD_LS_KEY = 'gen-ui-live-dogfood'
function loadDogfoodPersisted(): boolean {
  try {
    return localStorage.getItem(DOGFOOD_LS_KEY) === 'true'
  } catch {
    return false // storage unavailable — the default OFF state (byte-identical to before this toggle existed)
  }
}
function persistDogfood(on: boolean): void {
  try {
    localStorage.setItem(DOGFOOD_LS_KEY, on ? 'true' : 'false')
  } catch {
    /* storage unavailable — the in-memory toggle still works this session */
  }
}

// The ONE shared, MUTABLE genui config object both `wireLiveOverlay()` (constructs the live transport) and
// the toggle's own change handler read/write — `createLiveProxyTransport`'s `genui` param is captured by
// REFERENCE in its returned transport's closure (live-proxy-transport.ts), and `JSON.stringify` reads an
// object's CURRENT property values at each `turn()` call, not a value frozen at construction — so mutating
// `.dogfood` here reaches the NEXT turn without reconstructing the transport (the live-apply law, LLD-C4).
// `enabled`/`exclusive` are always `true` for this GenUI-only demo (the file banner's own "no off mode"
// note) — only `dogfood` is a real per-page toggle.
const genuiConfig: { enabled: true; exclusive: true; dogfood: boolean } = {
  enabled: true,
  exclusive: true,
  dogfood: loadDogfoodPersisted(),
}

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

// genui-surface.spec.md v0.5 §11 (SPEC-R11 note, GH #316/ADR-0162) — the dogfood options-strip toggle
// (the agent-admin Surface Options row's Fisher-Price label, "Use agent-ui components"). Live-apply: the
// change handler mutates `genuiConfig.dogfood` in place (reaches the transport's NEXT turn, no
// reconstruction) and `renderGenuiSurface` reads it fresh at every mount/rebuild — never sticky from a
// prior envelope.
const dogfoodStrip = el('div', 'options-strip')
const dogfoodToggle = document.createElement('ui-switch') as HTMLElement & { checked: boolean }
dogfoodToggle.setAttribute('aria-label', 'Use agent-ui components in the GenUI frame')
dogfoodToggle.checked = genuiConfig.dogfood
const dogfoodLabel = el('span', 'options-strip-label')
dogfoodLabel.textContent = 'Use agent-ui components'
dogfoodToggle.addEventListener('change', () => {
  genuiConfig.dogfood = dogfoodToggle.checked
  persistDogfood(dogfoodToggle.checked)
})
dogfoodStrip.append(dogfoodToggle, dogfoodLabel)
chatPane.append(dogfoodStrip)

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
  // genui-surface.spec.md v0.5 §11 (GH #316/ADR-0162) — a FRESH read of the toggle's CURRENT state (the
  // live-apply law): never sticky from a prior envelope, on a fresh mount OR a rebuild-in-place alike.
  const assets = genuiConfig.dogfood ? DOGFOOD_ASSETS : undefined
  const existing = surfaces.get(surfaceId)
  if (existing) {
    existing.host.assets = assets ?? {} // live-apply: re-applied on every rebuild, never sticky
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
  if (assets !== undefined) host.assets = assets
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
// GH #408 — WHICH backbone `transport` currently is, tracked at every one of the three sites that assign it
// (this initializer, Reset's fail-closed restart, `wireLiveOverlay()`'s live swap). `runTurn`'s empty-turn
// branch used to be transport-BLIND: a LIVE turn that rendered nothing printed the recorded backbone's own
// "no further turns in this recorded transcript" wording — a claim about a transcript that isn't running.
let isLive = false

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
    let transportError: string | undefined
    for await (const line of transport.turn(input)) {
      // The SAME reserved-meta-line filter a2ui-live.ts uses (readMetaLine, meta-line.ts) — GenUI's
      // `progress`/`note`/`error` ride the identical envelope; only the CONTENT line kind differs (genui, not
      // A2UI JSONL).
      const meta = readMetaLine(line)
      if (meta) {
        if (meta.a2uiMeta.progress !== undefined) routeProgress(meta.a2uiMeta.progress)
        if (meta.a2uiMeta.note !== undefined) note = meta.a2uiMeta.note
        // GH #144/#408 — the transport-composed TERMINAL error line (`formatErrorLine`, meta-line.ts): the
        // ONLY way a proxy whose headers already committed 200 can report a `ProduceHalt`/upstream fault
        // instead of ending as a silently-empty "success". It parses cleanly and matched NEITHER arm above,
        // so pre-#408 it was `continue`d into silence — and the turn, now holding zero genui lines, fell
        // through to the empty-turn branch below and blamed a recorded transcript for a live failure.
        if (meta.a2uiMeta.error !== undefined) transportError = meta.a2uiMeta.error
        continue
      }
      // SPEC-R1: structural whole-line rejection — a line that is neither a meta-line nor a valid genui
      // envelope is silently dropped (never partially honored, never a throw).
      const envelope = readGenuiLine(line)
      if (envelope === undefined) continue
      genuiLines.push(line)
      renderGenuiSurface(envelope.genui.surfaceId, envelope.genui.html)
    }
    // GH #408 — an error-terminated turn is a FAILED turn, treated exactly like one that threw: the SAME
    // visible pair the catch block below composes (an error entry + `narration.fail()`, which truncates
    // whatever stage was still active + forces the header to `error`, ADR-0146 F8) plus the ⚠ system
    // message — never `narration.finalize()`, which would settle the strip green over a turn that genuinely
    // failed, and never the empty-turn branch below, which would misname the cause.
    if (transportError !== undefined) {
      narration.appendEntry({ key: 'progress-error', status: 'error', label: `Turn failed — ${transportError}` })
      narration.fail()
      addMessage('system', `⚠ ${transportError}`)
      return
    }
    if (lastProgressKey !== undefined) settleProgress(lastProgressKey)
    narration.finalize()

    if (genuiLines.length === 0 && note === undefined) {
      // GH #408 — transport-honest: only the RECORDED backbone has a finite transcript to exhaust, so only it
      // may say so. A live turn that emitted nothing renderable (and no error line — that path returned
      // above) states just that fact.
      addMessage(
        'system',
        isLive
          ? "The agent's turn produced no renderable output."
          : 'The agent has no further turns in this recorded transcript. Reset to start over.',
      )
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
  isLive = false // GH #408 — reset alongside the transport it describes; the re-probe below sets it true again only if the live swap actually lands
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
        // GH #257/#270's shared picker infra — Model (the flat provider-grouped roster, the file banner's
        // scope-narrowed take on agent-admin's grid) + Effort. `providers`/`provider`/`onProviderChange`
        // are deliberately NEVER set on this page's composer (unlike a2ui-live.ts): the grouped `models`
        // list IS the provider axis now, visually and functionally — a second Provider picker would only
        // reintroduce the two-step flow this upgrade replaces.
        let selection = loadPersistedSelection()
        composer.models = MODEL_OPTIONS
        composer.model = selection.model
        composer.efforts = EFFORT_LEVELS
        composer.effort = selection.effort
        composer.onModelChange((id) => {
          // `providerIdForModel` recovers `{provider}` from the flat commit (a model belongs to exactly
          // one provider) — the live-proxy POST body still needs BOTH fields; falls back to the current
          // `selection.provider` for a `__group-*` header id or a stale/unknown one (never actually
          // reachable: header rows are `disabled`, ui-menu's own click/keydown delegation skips them).
          selection = { ...selection, model: id, provider: providerIdForModel(id) ?? selection.provider }
          composer.model = id
          persistSelection(selection)
        })
        composer.onEffortChange((id) => {
          selection = { ...selection, effort: id as EffortLevel }
          composer.effort = id
          persistSelection(selection)
        })
        // `exclusive: true` — this page has NO A2UI catalog renderer at all (the file banner's own "this is
        // deliberately NOT an A2UI page"); see genui-surface-config.ts's `GenuiSurfaceConfig.exclusive` doc
        // for why this bit matters: without it, the shared system prompt's own "A2UI stays your default"
        // framing (genui-teaching.md) reasonably steers the model toward catalog-expressible requests (e.g.
        // "make a card game" as buttons/text/score readouts) — real, VALID A2UI JSONL that ships on the wire
        // but is structurally invisible to this page's genui-only consumption loop below (readGenuiLine
        // rejects it by design, the SAME disjointness check that keeps a genui line out of the A2UI
        // validator). Root cause of the GH card-game repro: a real agent note rendered in chat, an empty
        // render pane, `genuiLines.length === 0` — the model chose A2UI, and this page silently dropped it.
        // `genuiConfig` (module scope, above) — the SAME shared mutable object the dogfood toggle's own
        // change handler mutates; passed by reference so a later toggle reaches the NEXT turn (live-apply).
        transport = overlay.createLiveProxyTransport({ get: () => selection }, genuiConfig)
        isLive = true // GH #408 — the ONE place a live backbone is adopted; set adjacent to the assignment it describes so the two can never drift
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
