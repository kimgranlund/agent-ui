// a2ui-live.ts — LLD-C9 / SPEC-R10: the live-agent demo chat app (the ladder's last rung made visible).
// Layout: [ chat | a2ui-canvas ]. The chat drives an AgentTransport; the agent's A2UI stream renders into
// the canvas (a REAL @agent-ui/a2ui surface); interacting with the surface round-trips a client message
// that becomes the next turn ("the agent continues"). The canvas pane is TABS — Canvas (the rendered
// surface, translate-centered), JSON (the JSONL payload), HTML (the rendered markup).
//
// The page consumes ONLY the AgentTransport seam (SPEC-R1): the default is the deterministic RECORDED
// BACKBONE (works offline, under CI, and whenever no live provider is configured). The LIVE overlay — a
// real model via a same-origin proxy + the Provider/Model/Mode picker (GH #257: now the composer's own
// `providers`/`provider`/`modes`/`mode` props, `../lib/provider-mode-selection.ts` supplying the option
// lists + persistence) — is swapped in via a dynamic import, probed
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
import { AskRegistry, surfaceIdOf, componentTypesOf, setAnsweredOnControls, CHOICE_CONTROL_TAGS } from '../lib/ask-registry.ts'
import type { AskEntry } from '../lib/ask-registry.ts'
// GH #579 — wire the shipped host-side plan-runner (PR #580, ADR-0174/SPEC-R21/R22) into this page.
import { runPlannerTurn, PLAN_SYNTHESIS_GROUP_KEY, sanitizeFailureReason } from '../lib/plan-runner.ts'
import type { PlanStepState } from '../lib/plan-runner.ts'
// The SAME persona-scoped modality-gate PRECEDENT `SURFACE_A2UI_KEY`/`SURFACE_GENUI_KEY` already use
// (ADR-0174 cl.1). This page has no persona/settings surface at all (that is agent-admin's own `store`),
// so its reachability here is a documented dev toggle (below) reading the SAME constant/reader the
// `ui-agent-admin` Surface Options row now ALSO reads — OF3 is RULED (agent-admin.ts's Planner row, beside
// GenUI): the two stay independent stores, not one shared one (see the close-out note below for the why).
import { createMemoryStore } from '@agent-ui/app'
import { SURFACE_PLANNER_KEY, isPlannerSurfaceEnabled } from '@agent-ui/app/agent-admin-schema'
// GH #257 — the Provider/Model/Mode picker now rides the standalone composer's own `providers`/`provider`/
// `modes`/`mode` props, replacing the standalone `ui-select` trio `provider-switcher.ts` used to mount into
// `switcherSlot`. Plain, safe data (no fetch/key) — statically importable; only the prop ASSIGNMENT below
// stays behind the live-probe branch, preserving the exact prior UX.
import {
  PROVIDER_OPTIONS,
  MODE_OPTIONS,
  EFFORT_LEVELS,
  loadPersistedSelection,
  persistSelection,
} from '../lib/provider-mode-selection.ts'
import type { StoredSelection, EffortLevel } from '../lib/provider-mode-selection.ts'

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

// ── chat pane: log · composer (its own dev-only Provider/Model/Mode picker, GH #257) · reset ────────────
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

/** Annotate a just-frozen ask bubble (ADR-0097 §2: truthful history, never hidden). The BYPASSED leg keeps
 * the original prose annotation on the now-inert bubble; the ANSWERED leg SETTLES the card instead
 * (ADR-0196 cl.5 — summary row + Edit affordance; the registry already set `answered` on its controls). */
function annotateAskFrozen(entry: AskEntry, state: 'answered' | 'bypassed'): void {
  if (state === 'bypassed') {
    const note = el('p', 'ask-annotation')
    note.textContent = 'No longer pending — the conversation moved on.'
    entry.bubble.append(note)
    return
  }
  settleAskBubble(entry)
}

// ════════════════ ADR-0196 — the questionnaire card's settle/edit-amend flow (GH #1065) ═════════════════
// On submit the ask card SETTLES, never disappears: options collapse to the selected answer(s) (CSS,
// keyed off `[data-state='answered']:not([data-editing])` — collapsed via display, never removed: the
// Edit-anchor law) plus ONE compact summary row with an Edit affordance. Edit re-opens the options and
// clears `answered` on the controls for the edit's duration; confirming a CHANGED answer appends an
// amendment turn ("Changed: X → Y") the agent reconciles FORWARD (prior turns are never rewritten);
// re-confirming the SAME answer appends nothing — the card simply re-settles.
//
// GH #1107 — the CANCEL leg (ADR-0196 left no way back out of an Edit re-open — the a2ui-mechanism review's
// improvised-by-omission LOW finding). A ✕ affordance (always) + Esc-while-focus-is-within-the-card (the
// component-patterns overlay/dismissal row's Escape half, ADR-0043/0045 — but this card is an INLINE settled
// bubble, never a floating/anchored panel, so click-away is deliberately NOT adopted: the chat log's own
// scroll/click surface has no "outside" boundary a light-dismiss controller could anchor to, and a stray
// click on an unrelated message would silently discard an in-progress correction). Cancel restores the
// settled state EXACTLY — snapshot the controls' raw values when Edit opens, write them back verbatim via
// each control's own SILENT programmatic setter (the fleet convention every value-bearing control already
// follows — `UICheckboxElement.checked` / `UIRadioGroupElement.value` / `UISelectElement.value` are directly
// settable and never self-emit on assignment, only an interaction-driven commit does), so restoring is
// zero-emission by construction: no `change`/`select` event, no data-model write, no action dispatch.

/** The last-settled compact answer per ask surface — the amendment diff's "X" side. */
const askAnswers = new Map<string, string>()

/** The Cancel restore closure per ask surface, captured by `reopenAskForEdit` when Edit opens and consumed
 * by `cancelAskEdit`. `undefined` whenever the card isn't mid-edit (never mounted until the first Edit). */
const askEditSnapshots = new Map<string, () => void>()

/** The raw-value read/write pair per CHOICE_CONTROL_TAGS member (mirrors ANSWER_PROJECTIONS' own exhaustive-
 * over-the-const discipline, a2ui-mechanism review M4, GH #1065): a tag added to CHOICE_CONTROL_TAGS without
 * a row here is a TS2741 compile error, not a silently-unrestorable control on cancel. This reads/writes the
 * control's OWN raw value (radio-group's `.value`, checkbox's `.checked`, …) — never the human-readable
 * projection above, which is lossy for a multi-control card and unusable as a write-back target. */
const CONTROL_SNAPSHOT_OPS: Record<(typeof CHOICE_CONTROL_TAGS)[number], { read: (el: HTMLElement) => unknown; write: (el: HTMLElement, v: unknown) => void }> = {
  'ui-radio-group': {
    read: (el) => (el as HTMLElement & { value: string | null }).value,
    write: (el, v) => {
      ;(el as HTMLElement & { value: string | null }).value = v as string | null
    },
  },
  'ui-segmented-control': {
    read: (el) => (el as HTMLElement & { value: string | null }).value,
    write: (el, v) => {
      ;(el as HTMLElement & { value: string | null }).value = v as string | null
    },
  },
  'ui-checkbox': {
    read: (el) => (el as HTMLElement & { checked: boolean }).checked,
    write: (el, v) => {
      ;(el as HTMLElement & { checked: boolean }).checked = v as boolean
    },
  },
  'ui-switch': {
    read: (el) => (el as HTMLElement & { checked: boolean }).checked,
    write: (el, v) => {
      ;(el as HTMLElement & { checked: boolean }).checked = v as boolean
    },
  },
  'ui-select': {
    read: (el) => (el as HTMLElement & { value: string }).value,
    write: (el, v) => {
      ;(el as HTMLElement & { value: string }).value = v as string
    },
  },
  'ui-combo-box': {
    read: (el) => (el as HTMLElement & { value: string }).value,
    write: (el, v) => {
      ;(el as HTMLElement & { value: string }).value = v as string
    },
  },
  'ui-multi-select': {
    read: (el) => [...((el as HTMLElement & { value: readonly string[] }).value ?? [])],
    write: (el, v) => {
      ;(el as HTMLElement & { value: string[] }).value = v as string[]
    },
  },
}

/** Snapshot every choice control's raw value under `bubble` right now, returning a closure that writes every
 * one back verbatim — the exact settled state Cancel restores. */
function snapshotAskControls(bubble: HTMLElement): () => void {
  const restores: Array<() => void> = []
  for (const tag of CHOICE_CONTROL_TAGS) {
    const ops = CONTROL_SNAPSHOT_OPS[tag]
    for (const control of bubble.querySelectorAll<HTMLElement>(tag)) {
      const prior = ops.read(control)
      restores.push(() => ops.write(control, prior))
    }
  }
  return () => {
    for (const restore of restores) restore()
  }
}

/** A compact, human-readable summary of the card's CURRENT selection, read from the rendered controls
 * themselves (DOM truth — the same controls the user just committed). */
// The VALUE-READ projection per CHOICE_CONTROL_TAGS member (a2ui-mechanism review M4, GH #1065):
// keyed EXHAUSTIVELY off the const's own union — a tag added to CHOICE_CONTROL_TAGS without a row here
// is a TS2741 compile error, not silent summary drift. (The CSS collapse pair in a2ui-live.css covers
// only the option-LIST members; its own drift note points back here.)
const ANSWER_PROJECTIONS: Record<(typeof CHOICE_CONTROL_TAGS)[number], (bubble: HTMLElement) => string[]> = {
  'ui-radio-group': (b) => [...b.querySelectorAll('ui-radio[checked]')].map((r) => r.textContent?.trim() ?? '').filter(Boolean),
  'ui-segmented-control': (b) => [...b.querySelectorAll('ui-segment[checked]')].map((r) => r.textContent?.trim() ?? '').filter(Boolean),
  'ui-checkbox': (b) => [...b.querySelectorAll('ui-checkbox[checked]')].map((r) => r.textContent?.trim() ?? '').filter(Boolean),
  'ui-switch': (b) => [...b.querySelectorAll('ui-switch[checked]')].map((r) => r.textContent?.trim() ?? '').filter(Boolean),
  'ui-select': (b) => [...b.querySelectorAll<HTMLElement & { value?: string | null }>('ui-select')].map((c) => (typeof c.value === 'string' ? c.value : '')).filter(Boolean),
  'ui-combo-box': (b) => [...b.querySelectorAll<HTMLElement & { value?: string | null }>('ui-combo-box')].map((c) => (typeof c.value === 'string' ? c.value : '')).filter(Boolean),
  'ui-multi-select': (b) => [...b.querySelectorAll<HTMLElement & { value?: readonly string[] }>('ui-multi-select')].flatMap((m) => (Array.isArray(m.value) && m.value.length > 0 ? [m.value.join(', ')] : [])),
}

function readAskAnswer(bubble: HTMLElement): string {
  const parts: string[] = []
  for (const tag of CHOICE_CONTROL_TAGS) parts.push(...ANSWER_PROJECTIONS[tag](bubble))
  return parts.join(' · ')
}

/** Settle (or RE-settle, after an edit) an answered ask card: `answered` back on its controls, the summary
 * row refreshed, the Edit affordance wired. Idempotent — one `.ask-settle` row per bubble, updated in place. */
function settleAskBubble(entry: AskEntry): void {
  const bubble = entry.bubble
  delete bubble.dataset.editing
  askEditSnapshots.delete(entry.surfaceId) // any in-progress edit is over — committed or cancelled either way
  setAnsweredOnControls(bubble, true)
  const answer = readAskAnswer(bubble)
  askAnswers.set(entry.surfaceId, answer)
  let row = bubble.querySelector<HTMLElement>('.ask-settle')
  if (row === null) {
    row = el('p', 'ask-annotation ask-settle')
    const summary = el('span', 'ask-settle-summary')
    // The Edit affordance — page chrome (a plain button, like the tabs' own shells); it emits nothing on
    // any ui-* event channel, so the seven-member vocabulary (ADR-0153) is untouched.
    const edit = document.createElement('button')
    edit.type = 'button'
    edit.className = 'ask-edit'
    edit.textContent = 'Edit'
    edit.addEventListener('click', () => reopenAskForEdit(entry))
    row.append(summary, edit)
    bubble.append(row)
  }
  const summaryEl = row.querySelector<HTMLElement>('.ask-settle-summary')
  if (summaryEl) summaryEl.textContent = answer === '' ? 'Answered.' : `Answered — ${answer}.`
}

/** Edit re-opens the card: options expand again (CSS keys off `data-editing`) and `answered` clears on its
 * controls for the duration of the edit (ADR-0196 cl.5). The entry STAYS frozen for line-routing — a later
 * agent line targeting it is still dropped; only the user's own correction flows, through the card's own
 * commit → `interceptAskAmendment` below, or the Cancel leg (✕ / Esc, GH #1107) → `cancelAskEdit` below. */
function reopenAskForEdit(entry: AskEntry): void {
  const bubble = entry.bubble
  askEditSnapshots.set(entry.surfaceId, snapshotAskControls(bubble))
  bubble.dataset.editing = ''
  setAnsweredOnControls(bubble, false)

  // The Cancel bar — page chrome, idempotent (one `.ask-edit-bar` per bubble, built once, shown only while
  // `[data-editing]` via CSS — mirrors `.ask-settle`'s own idempotent-row pattern). A ✕ button (the safe
  // core dismissal affordance) plus a bubble-SCOPED Escape listener (never `document`-level — Esc only
  // cancels when focus is actually within THIS card, the "platform dismissal" convention's keyboard half
  // narrowed to an inline, non-overlay surface). Click-away is deliberately NOT wired — see the file-header
  // note above.
  if (bubble.querySelector('.ask-edit-bar') === null) {
    const bar = el('p', 'ask-annotation ask-edit-bar')
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'ask-cancel'
    cancel.textContent = '✕ Cancel'
    cancel.setAttribute('aria-label', 'Cancel edit — keep the previous answer')
    cancel.addEventListener('click', () => cancelAskEdit(entry))
    bar.append(cancel)
    bubble.append(bar)
    bubble.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return
      if (bubble.dataset.editing === undefined) return // only while THIS card is actually mid-edit
      event.stopPropagation()
      cancelAskEdit(entry)
    })
  }
}

/** The Cancel leg (✕ / Esc, GH #1107): restore the settled state EXACTLY as it was before Edit — write the
 * `reopenAskForEdit` snapshot back verbatim (zero-emission by construction, see the file-header note), clear
 * `data-editing`, then re-settle (re-derives the summary from the just-restored controls — same answer, same
 * text). Emits NOTHING: no `updateDataModel`, no action, no amendment turn — `entry.state`/`askAnswers` are
 * left exactly as they were (settleAskBubble only re-reads, it never diffs against a "prior" the way
 * `interceptAskAmendment`'s commit leg does). A no-op if the card isn't actually mid-edit (defensive; nothing
 * wires a Cancel click/Esc without `reopenAskForEdit` having run first). */
function cancelAskEdit(entry: AskEntry): void {
  const restore = askEditSnapshots.get(entry.surfaceId)
  if (restore === undefined) return
  restore()
  settleAskBubble(entry)
}

/** The amendment leg: a commit from an ALREADY-ANSWERED card is the edit flow, never a fresh answer turn.
 * Returns `true` when the message was consumed here. Same answer → re-settle, append NOTHING; changed →
 * re-settle + append the "Changed: X → Y" amendment turn (a plain user turn the agent reconciles forward). */
function interceptAskAmendment(message: A2uiClientMessage): boolean {
  if (!('action' in message)) return false
  const entry = askRegistry.get(message.action.surfaceId)
  if (entry === undefined || entry.state !== 'answered') return false
  // Busy-window guard (a2ui-mechanism review HIGH, GH #1065): runTurn's own `if (busy) return` fires
  // AFTER this function has already appended the visible turn and advanced the diff baseline — a
  // re-commit while the previous reconcile is in flight would show "Changed: X → Y" in chat, dispatch
  // nothing, and permanently swallow the amendment (ADR-0196 cl.5 says append-and-reconcile, ADR-0097 §2
  // says the transcript stays truthful). Consume the commit but keep the card OPEN in its editing state
  // — the user's change stays live on the controls and re-commits cleanly once the turn settles.
  if (busy) return true
  const prior = askAnswers.get(entry.surfaceId) ?? ''
  settleAskBubble(entry) // re-reads the controls, clears data-editing, restores `answered`
  const next = askAnswers.get(entry.surfaceId) ?? ''
  if (next === prior) return true // re-confirming the same answer appends nothing (ADR-0196 cl.5)
  // An empty prior (a2ui-mechanism review cosmetic finding, GH #1065/#1107) reads as a phantom diff —
  // "Changed:  → X" — rather than the true shape: this is the card's FIRST recorded answer, worded the
  // same as a fresh settle.
  const amendment = prior === '' ? `Answered: ${next}` : `Changed: ${prior} → ${next}`
  addMessage('user', amendment)
  void runTurn({ kind: 'intent', text: traceDigest() + amendment, session })
  return true
}

// The modern composer (Figma chat-input refactor) — a standalone `<ui-conversation-composer>` instance,
// replacing the bare `<form>` + raw `<ui-text-field>`/`<ui-button>` pair. Composed directly (never via
// `<ui-conversation>`, ADR-0129 Fork B): `models`/`contextItems` are left unset (Models rides the
// Provider-narrowed `#effectiveModels()` view instead of its own standalone list; nothing on this page
// surfaces a dismissable context chip) — but `efforts` is NOT one of these anymore: it was left unset when
// this comment was first written, before GH #257 widened this same page with live Provider/Model/Mode
// pickers; Effort now rides the composer's own `efforts`/`effort` props too (wireLiveOverlay, below), same
// event contract (`onSubmit`), same turn-loop wiring below, only the INPUT WIDGET itself changed. `onMicClick`
// is never registered either — the mic button stays hidden
// (its own opt-in reveal), so it never becomes "the composer's first ui-button" (the exact hazard
// conversation-composer.ts's own header documents a2ui-chat.ts hit before its fix) for anything that
// still needs the SEND button specifically — see `[data-part="send"]` at every such call site.
// GH #257 — the dev-only Provider/Model/Mode picker (once wired live) now rides the composer's OWN
// `providers`/`provider`/`modes`/`mode` props (wireLiveOverlay, below) instead of a standalone
// `switcherSlot` mounted beside it.
const composer = document.createElement('ui-conversation-composer') as UIConversationComposerElement
composer.className = 'chat-composer' // kept — the pre-existing `.chat-composer [data-part="editor"]` test selectors resolve unchanged

chatPane.append(composer)

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
// GH #408 — WHICH backbone `transport` currently is, tracked at every one of the three sites that assign it
// (this initializer, Reset's fail-closed restart, `wireLiveOverlay()`'s live swap). `runTurn`'s empty-turn
// branch used to be transport-BLIND: a LIVE turn that produced nothing printed the recorded backbone's own
// "no further turns in this recorded transcript" wording — a claim about a transcript that isn't running.
let isLive = false

/**
 * Test-only injection seam (post-ship review finding 2, SPEC §6 open item): `transport` is otherwise
 * reassigned ONLY by `wireLiveOverlay()` below (the real, dev-only live-key probe), so a jsdom test has no
 * way to drive the page's ask orchestration (buffering/collision/freeze/dataModel-carrying dispatch) end to
 * end without a live key. This lets a test swap in a scripted `AgentTransport` stub before dispatching a
 * turn. Never called by any production path — invisible to `wireLiveOverlay()` and every other real caller.
 * `live` (GH #408) declares which backbone the stub STANDS FOR, so a test can drive the live-only empty-turn
 * wording; omitted ⇒ recorded, leaving every pre-#408 call site byte-unaffected.
 */
export function __setTransportForTest(next: AgentTransport, live = false): void {
  transport = next
  isLive = live
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
    let transportError: string | undefined
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
        // GH #144/#408 — the transport-composed TERMINAL error line (`formatErrorLine`, meta-line.ts): the
        // ONLY way a proxy whose headers already committed 200 can report a `ProduceHalt`/upstream fault
        // instead of ending as a silently-empty "success". It parses cleanly and matched none of the arms
        // above, so pre-#408 it was `continue`d into silence — and the turn, now holding zero lines, fell
        // through to the empty-turn branch below and blamed a recorded transcript for a live failure.
        if (meta.a2uiMeta.error !== undefined) transportError = meta.a2uiMeta.error
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
    // GH #408 — an error-terminated turn is a FAILED turn, treated exactly like one that threw: it takes the
    // catch block's own visible path (an error entry + `narration.fail()`, which truncates whatever stage was
    // still active + forces the header to `error`, ADR-0146 F8, plus the ⚠ system message) and — like a
    // thrown turn — reaches NONE of the completion work below: no `canvasHost.finalize()`, no
    // `freezePriorPendingAsk` (a failed turn must leave a prior pending ask pending and interactive,
    // ADR-0097 §2), no ask resolution, no session append, and never the empty-turn branch that would misname
    // the cause.
    if (transportError !== undefined) {
      narration.appendEntry({ key: 'progress-error', status: 'error', label: `Turn failed — ${transportError}` })
      narration.fail()
      addMessage('system', `⚠ ${transportError}`)
      // GH #810 — a failed turn must never strand the persistent canvas disabled: `canvasHost`'s own click
      // (surface-host.ts's self-wired listener) already disabled it before this turn ever ran; nothing else
      // on THIS path re-enables it (no `finalize()`/`ingest()` below — this branch returns early). A no-op
      // when the canvas wasn't the thing that started this turn (`setInteractiveDisabled` only ever reverts
      // elements its OWN sweep claimed, surface-host.ts's `#sweepDisabled`).
      canvasHost.setInteractiveDisabled(false)
      return
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
    // GH #810 — the thrown-turn leg of the same fail arm as the transportError branch above (a genuine
    // `for await` exception, e.g. the transport itself throwing) — same reasoning, same no-op-if-unrelated
    // guarantee.
    canvasHost.setInteractiveDisabled(false)
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
  // ADR-0196 — a commit from an already-ANSWERED ask card is the settle/edit-amend flow (same answer:
  // re-settle silently; changed: the "Changed: X → Y" amendment turn), never the ordinary action turn.
  if (interceptAskAmendment(message)) return
  // ADR-0088 §3: `action.wantResponse === false` is the agent's explicit per-action opt-out — apply
  // SILENTLY (no chat entry, no turn, no LLM round-trip). Absent/`true` (and every functionResponse/error)
  // keep today's full visible-turn path, via the pure reducer's routing predicate (LLD-C5).
  if (!shouldRunTurn(message)) return
  // A control in the canvas emitted an action/response/error → the agent continues on the next turn.
  // The pure reducer (SPEC-R8) frames it as the next TurnInput.
  void runTurn(nextTurn(session, message))
}

// ════════════════ the planner-stage pilot (ADR-0174 cl.1/cl.3/cl.4/cl.6, SPEC-R21/R22) — OPT-IN, OFF by
// default; this page's wiring for the shipped `site/lib/plan-runner.ts` (GH #579). ════════════════════════
//
// The dev toggle (see the import comment above): `?planner=1`/`?planner=0` on the URL flips
// `SURFACE_PLANNER_KEY` through `createMemoryStore`'s `localStorage` mirror (persisted, the SAME
// "one visit sticks" UX the Provider/Model/Mode picker's own persistence uses) — read through the SAME
// fail-closed `isPlannerSurfaceEnabled` reader `ui-agent-admin`'s own row now uses, never a page-local
// reinvention of the gate's shape.
//
// OF3 close-out ruling: `plannerStore` below stays PAGE-LOCAL to a2ui-live (its own `createMemoryStore`
// instance, `persistKey: 'a2ui-live.dev'`) — it is NOT, and does not REPOINT to, the persona/`SettingsStore`
// `ui-agent-admin` reads its own `SURFACE_A2UI_KEY`/`SURFACE_GENUI_KEY` through. True sharing was judged
// architecturally wrong, not just awkward: a2ui-live is a docs-site demo page that never mounts
// `ui-agent-admin` at all (this file's own header says so — "no persona/settings surface"), so there is no
// single running instance of BOTH stores for one to repoint into; the two pages don't even coexist in one
// document. The admin row (agent-admin.ts's Planner row in Surface Options, beside GenUI) writes `ui-
// agent-admin`'s own `this.store` — the SAME persona store its A2UI/GenUI rows already write, and the seam
// a future admin-side runner wiring would read — while THIS page's `?planner=1`/`?planner=0` toggle remains
// its own documented DEV override, independent of any persona. The two can read different values on their
// own separate pages; that is the intended shape, not a divergence bug.
const plannerStore = createMemoryStore({ persistKey: 'a2ui-live.dev' })
{
  const urlPlanner = new URLSearchParams(location.search).get('planner')
  if (urlPlanner === '1') plannerStore.set(SURFACE_PLANNER_KEY, true)
  else if (urlPlanner === '0') plannerStore.set(SURFACE_PLANNER_KEY, false)
}
// Discoverability (the gate's own "reachable" acceptance criterion) — a plain visible fact, never stage
// prose (ADR-0174 cl.6 governs STAGE teaching, not this host status line).
if (isPlannerSurfaceEnabled(plannerStore.get(SURFACE_PLANNER_KEY))) {
  addMessage('system', 'Planner mode is ON (dev toggle — add "?planner=0" to the URL to turn it off). Prompts run the multi-step plan → execute → synthesize loop.')
}

/** Test-only injection seam (the `__setTransportForTest` precedent) — flips the SAME store a real
 *  `?planner=1` visit would, so a page-level test can drive the gate-ON path without touching
 *  `location.search`. Never called by any production path. */
export function __setPlannerEnabledForTest(enabled: boolean): void {
  plannerStore.set(SURFACE_PLANNER_KEY, enabled)
}

/**
 * Wrap the page's own `AgentTransport` so every dispatch the plan-runner drives renders its content lines
 * into the SAME shared canvas AS THEY STREAM (SPEC-R5's progressive-paint law, unchanged for a plan run) —
 * `plan-runner.ts` is a deliberately pure driver (its own file header: "never imports or calls produce()
 * directly... never touches the component itself"), so RENDERING each dispatch's own surface is this
 * PAGE's job, exactly as `runTurn` already does for an ordinary turn.
 *
 * The meta-line peel here is READ-ONLY (never mutates what it forwards) — `runPlannerTurn`'s own
 * `drainTurn` peels its OWN copy for `plan`/`progress`/`error` (`readMetaLine` is a pure, idempotent read,
 * so peeling the SAME line twice is safe). Unlike the first cut of this wrapper, it ALSO captures `note`
 * (rendered via `addMessage`, same as `runTurn`) and `trace` (fed into the SAME `traces`/`notesByTurnIndex`
 * bookkeeping `runTurn` grows) — code-checker finding 1/6 on 6bdcd39: `drainTurn` silently drops both
 * (documented in `plan-runner.ts`'s own header), and THIS wrapper is the only place downstream of the wire
 * that ever sees the raw line, so it is where "the ask's question survives as the turn's prose note"
 * (SPEC-R21 "Asks during a run") must actually become true ON THIS PAGE, and where a run's own trace
 * history must land so a LATER ordinary turn's `traceDigest()` isn't blind to what a plan run just did.
 * This wrapper never mounts an ask (no `askRegistry.create` call here — a runner-dispatched ask stays
 * exactly what SPEC-R21 requires: prose only) — it also carries `runTurn`'s own ask-registry line guard
 * (a2ui-live.ts's `handleClientMessage`-adjacent guard in `runTurn`): a line targeting a surface id an
 * ask ALREADY owns (pending or frozen, from a PRIOR ordinary turn) is never re-ingested into the shared
 * canvas as ordinary plan-run content.
 *
 * `canvasHost.finalize()` runs once per dispatch, in a `finally` (code-checker finding 5): a thrown/failed
 * dispatch still finalizes whatever DID stream before the fault, matching this comment's own claim on the
 * error path, not just the happy path — harmless either way (it only re-stretches the artboard layout,
 * never resets state), so a K-step plan finalizing K+2 times is inert repetition, not a bug.
 */
function renderingTransport(base: AgentTransport): AgentTransport {
  return {
    turn(input: TurnInput): AsyncIterable<string> {
      return (async function* (): AsyncGenerator<string> {
        let note: string | undefined
        try {
          for await (const line of base.turn(input)) {
            const meta = readMetaLine(line)
            if (meta !== undefined) {
              if (meta.a2uiMeta.note !== undefined) note = meta.a2uiMeta.note
              const trace = meta.a2uiMeta.trace
              if (trace !== undefined) {
                traces.push(trace)
                if (note !== undefined) notesByTurnIndex.set(trace.turnIndex, note)
              }
              yield line
              continue
            }
            const targetId = surfaceIdOf(line)
            if (targetId !== undefined && askRegistry.has(targetId)) {
              yield line // ask territory (a PRIOR turn's) — never re-ingested as plan-run canvas content
              continue
            }
            allLines.push(line)
            noteCreatedSurface(line)
            canvasHost.ingest(line) // validated JSONL streamed line-by-line → progressive paint (SPEC-N4)
            yield line
          }
        } finally {
          // SPEC-R21 "Asks during a run" — an `ask` on a runner-dispatched turn is NEVER mounted (no
          // `askRegistry.create` call anywhere in this wrapper); its question survives ONLY because the
          // note itself renders here, same role `runTurn` uses for an ordinary turn's note.
          if (note !== undefined) addMessage('agent', note)
          canvasHost.finalize()
        }
      })()
    },
  }
}

/** SPEC-R21 Projection — route ONE step/synthesis dispatch's own `TurnProgress` events as nested children
 *  under its status-stream GROUP (ADR-0146 F5's `parent` key, ADR-0159's receipt pattern), reusing the SAME
 *  closed `PROGRESS_LABEL` table `runTurn`'s own `routeProgress` closure uses for an ordinary turn — scoped
 *  per group so two groups' progress entries never collide on one key. One fresh router per group (a group
 *  dispatches exactly once, so this never needs to reset mid-flight). */
function makeGroupProgressRouter(narration: UIStatusStreamElement, groupKey: string): (progress: TurnProgress) => void {
  const seen = new Set<string>()
  const doneLabelByKey = new Map<string, string>()
  let lastKey: string | undefined
  const settle = (key: string): void => {
    const doneLabel = doneLabelByKey.get(key)
    narration.update(key, doneLabel === undefined ? { status: 'done' } : { status: 'done', label: doneLabel })
  }
  return (progress: TurnProgress): void => {
    const pair = PROGRESS_LABEL[progress.stage] as ProgressLabelPair | undefined
    if (pair === undefined) return
    if (progress.stage === 'done') {
      if (lastKey !== undefined) settle(lastKey)
      lastKey = undefined
      return
    }
    const suffix =
      progress.stage === 'retry'
        ? progress.round === undefined
          ? ''
          : ` (round ${progress.round})`
        : progress.stage === 'tool' && progress.detail
          ? ` (${progress.detail})`
          : ''
    const label = `${pair.live}${suffix}`
    const key = `${groupKey}:${
      progress.stage === 'retry' ? `retry-${progress.round ?? 1}` : progress.stage === 'tool' ? `tool-${progress.detail ?? 'unknown'}` : progress.stage
    }`
    doneLabelByKey.set(key, `${pair.done}${suffix}`)
    if (lastKey !== undefined && lastKey !== key) settle(lastKey)
    if (seen.has(key)) narration.update(key, { status: 'active', label })
    else {
      seen.add(key)
      narration.appendEntry({ key, status: 'active', label, parent: groupKey })
    }
    lastKey = key
  }
}

/** `PlanStepState` → this strip's `ItemStatus` — an exhaustive switch (a widened `PlanStepState` fails
 *  compilation here, not silently). `not-run` maps to `warning` (distinct from a still-`pending` group
 *  that simply never got its turn — "aborted before dispatch" deserves its own visible ink, ADR-0146 F6's
 *  severity ladder already ranks `warning` above `pending`). */
function planStepStatus(state: PlanStepState): 'pending' | 'active' | 'done' | 'error' | 'warning' {
  switch (state) {
    case 'pending':
      return 'pending'
    case 'running':
      return 'active'
    case 'done':
      return 'done'
    case 'failed':
      return 'error'
    case 'not-run':
      return 'warning'
  }
}

const PLAN_STEP_STATE_WORD: Record<PlanStepState, string> = {
  pending: 'Queued',
  running: 'Running…',
  done: 'Done',
  failed: 'Failed',
  'not-run': 'Not run (aborted)',
}

/** `reason` (#602 display honesty) is present ONLY on a `'failed'` terminal state — already a sanitized,
 *  ≤120-char, one-line string (`sanitizeFailureReason`, plan-runner.ts); rendered in parens after the state
 *  word, never re-processed here. */
function planGroupLabel(groupKey: string, state: PlanStepState, reason?: string): string {
  const name = groupKey === PLAN_SYNTHESIS_GROUP_KEY ? 'Synthesis' : `Step "${groupKey.slice('plan-step:'.length)}"`
  const word = PLAN_STEP_STATE_WORD[state]
  return reason !== undefined ? `${name} — ${word} (${reason})` : `${name} — ${word}`
}

/**
 * ADR-0174/SPEC-R21 — drive ONE user-submitted intent through the host-side sequential plan-runner instead
 * of `runTurn`'s single dispatch, when the dev-reachable gate above is ON. Mirrors `runTurn`'s own
 * busy/narration discipline: one narration strip appended at t=0 (seeding K+1 GROUPS instead of one flat
 * progress strip — SPEC-R21 Projection) and `setBusy` held for the run's WHOLE duration — the v0.11
 * "mid-run composer suppression" ruling's DISABLE presentation, never queue-then-replay: the composer
 * already ships the `busy` affordance `runTurn` uses for an ordinary turn, and a queued-resubmit UX is a
 * genuinely separate feature this ticket does not build (an OPEN item, not a silent gap). The over-cap
 * refusal's ONE visible warning (SPEC-R21 Bounds/AC4) rides the SAME narration strip.
 */
async function runPlannerFlow(intent: string): Promise<void> {
  if (busy) return
  // ADR-0097 §2 — a plan run is a fresh, non-interactive top-level intent, never an answer to a specific
  // ask (SPEC-R21 "Asks during a run": no runner-dispatched turn ever mounts one). Freeze whatever was
  // LEFT pending by a prior ORDINARY turn now, same reasoning `runTurn`'s own `freezePriorPendingAsk` call
  // uses — but at the TOP here, not after completion: a plan run spans K+2 dispatches, and leaving a stale
  // ask "pending" (interactive, answerable) for that whole suppressed duration would let it be answered
  // mid-run, racing the very suppression this function exists to guarantee.
  freezePriorPendingAsk(undefined)
  setBusy(true)
  const narration = makeNarration()
  narration.setAttribute('label', 'Plan run')
  chatLog.append(narration)
  chatLog.scrollTop = chatLog.scrollHeight

  const TERMINAL_STATES = new Set<PlanStepState>(['done', 'failed', 'not-run'])
  const groupState = new Map<string, PlanStepState>()
  const progressRouters = new Map<string, (progress: TurnProgress) => void>()

  const onStepState = (groupKey: string, state: PlanStepState, reason?: string): void => {
    const status = planStepStatus(state)
    const label = planGroupLabel(groupKey, state, reason)
    if (groupState.has(groupKey)) narration.update(groupKey, { status, label })
    else narration.appendEntry({ key: groupKey, status, label })
    groupState.set(groupKey, state)
  }
  const onProgress = (groupKey: string, progress: TurnProgress): void => {
    let router = progressRouters.get(groupKey)
    if (router === undefined) {
      router = makeGroupProgressRouter(narration, groupKey)
      progressRouters.set(groupKey, router)
    }
    router(progress)
  }
  const onRefused = ({ declaredSteps, cap }: { declaredSteps: number; cap: number }): void => {
    // SPEC-R21 Bounds/AC4 — the ONE visible warning entry an over-cap refusal requires: "the model's note
    // announced a plan, so silent non-execution would lie by omission."
    narration.appendEntry({
      key: 'plan-refused',
      status: 'warning',
      label: `Plan refused — declared ${declaredSteps} step(s), over the ${cap}-step cap.`,
    })
  }

  try {
    session = await runPlannerTurn({
      transport: renderingTransport(transport),
      session,
      intent,
      plannerEnabled: true,
      onStepState,
      onProgress,
      onRefused,
    })
    narration.finalize()
    refreshJson(allLines)
    refreshHtml()
    showCanvas()
    addMessage('system', 'Plan run finished — see the status stream above for each step.')
  } catch (e) {
    // GH #592 FIXED upstream (plan-runner.ts): a step/synthesis dispatch that THROWS now routes through
    // `runPlan`'s own `drainStepTurn` catch-and-continue, folding into the SAME failed-tier a transport-
    // composed `error` meta-line already gets — the run continues and every seeded group reaches a real
    // terminal state before this promise ever settles. So this catch's only remaining entry is the
    // plan-request turn's own genuine failure (SPEC-R22's tier-1 "one true abort" — thrown from inside
    // `runPlannerTurn` BEFORE `runPlan`/its group-seeding ever runs, so `groupState` is still empty and the
    // loop below is a no-op for that case). Left as a defensive backstop for any other truly-unexpected
    // throw (e.g. the projection/narration layer itself) that would otherwise strand a group at
    // "Queued"/"Running…" forever — display-honest either way.
    for (const [groupKey, state] of [...groupState]) {
      if (!TERMINAL_STATES.has(state)) onStepState(groupKey, 'not-run')
    }
    // #602 review follow-up — this tier-1 message is a RAW upstream/thrown string, same as tier 2/3's
    // `errorMessage`; it MUST pass through the SAME `sanitizeFailureReason` before reaching either rendered
    // surface below (the narration label AND the chat message) — this catch is the only site in this
    // module that ever displayed an unsanitized fault message.
    const reason = sanitizeFailureReason((e as Error).message)
    narration.appendEntry({ key: 'plan-error', status: 'error', label: `Plan run failed — ${reason}` })
    narration.fail()
    addMessage('system', `⚠ ${reason}`)
  } finally {
    setBusy(false)
  }
}

// The composer's own `onSubmit` callback (never a CustomEvent, matching `ui-conversation`'s own event
// contract, conversation.ts's composer-wiring section) fires with the text ALREADY trimmed and non-empty —
// its internal `#send()` guards emptiness AND its own `busy` prop before ever calling this back, so no
// re-check is needed here. It also already cleared its own value; this page never touches the widget's
// value directly (props down, callbacks up — `readField`/`clearField` are gone with the raw field).
composer.onSubmit((text) => {
  addMessage('user', text) // the chat shows the user's OWN typed text — never the digest prepended below
  if (isPlannerSurfaceEnabled(plannerStore.get(SURFACE_PLANNER_KEY))) {
    // ADR-0174/SPEC-R21 — gate ON: the host-side plan-runner drives this intent (the gate-OFF branch below
    // is BYTE-UNTOUCHED — SPEC-R21 AC1's own requirement).
    void runPlannerFlow(text)
  } else {
    void runTurn({ kind: 'intent', text: traceDigest() + text, session })
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
  askAnswers.clear() // ADR-0196 — the settle/amend diff baseline dies with the asks it described
  knownSurfaceIds.clear()
  session = { turns: [] }
  allLines.length = 0
  traces.length = 0
  notesByTurnIndex.clear()
  transport = createRecordedTransport(recordedTranscript)
  isLive = false // GH #408 — reset alongside the transport it describes; the re-probe below sets it true again only if the live swap actually lands
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
        // GH #257 — the Provider/Model/Mode picker rides the composer's OWN props now (never a standalone
        // `switcherSlot`); `wireLiveOverlay` re-runs on Reset, so each call simply re-registers the
        // (single-slot) callbacks — never additive, no duplicate firing.
        let selection = loadPersistedSelection()
        composer.providers = PROVIDER_OPTIONS
        composer.provider = selection.provider
        composer.model = selection.model
        composer.modes = MODE_OPTIONS
        composer.mode = selection.mode
        composer.efforts = EFFORT_LEVELS
        composer.effort = selection.effort
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
          // The Mode picker's own `modes` list is always built from `MODE_OPTIONS`/`GEN_UI_MODES` above —
          // every committable id genuinely IS a `GenUiMode`; `onModeChange` itself carries the composer's
          // plain `(id: string)` shape (props down/callbacks up — it never imports `GenUiMode`).
          selection = { ...selection, mode: id as StoredSelection['mode'] }
          composer.mode = id
          persistSelection(selection)
        })
        composer.onEffortChange((id) => {
          selection = { ...selection, effort: id as EffortLevel }
          composer.effort = id
          persistSelection(selection)
        })
        transport = overlay.createLiveProxyTransport({ get: () => selection })
        isLive = true // GH #408 — the ONE place a live backbone is adopted; set adjacent to the assignment it describes so the two can never drift
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
