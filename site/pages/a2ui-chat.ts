// a2ui-chat.ts — the conversational agent surface, RE-HOSTED onto `ui-conversation` (app-surfaces-m2.spec.md
// SPEC-R9 / ADR-0129 clause 4). What this page used to hand-build — the scrolling thread, the per-turn
// narration strip, the per-surface renderer-host registry (`site/lib/surface-registry.ts`), the line-routing
// rule, the composer, the scroll-follow guard, the wire disclosure — is now OWNED by the shipped
// `<ui-conversation>` primitive (`@agent-ui/app`). This page keeps ONLY what a primitive must never own
// (PRD-D2, SPEC-R8): the transport/produce loop, the session bookkeeping, and the dev-only live overlay.
//
// The turn loop feeds the primitive imperatively (SPEC-R8): `conv.beginAgentTurn()` returns an
// `AgentTurnHandle` the app's own `transport.turn(input)` iteration drives line-by-line
// (`ingestLine`/`setNote`/`finalize`/`fail`). Outbound client messages from whatever inline surfaces the
// conversation mounts bubble back through `conv.onClientMessage`; the composer's reply rides
// `conv.onSubmit`. Neither the wire format nor the session ever leaks a transport-shaped type into the
// primitive (SPEC-R8 AC1/AC2 — the transport call site is UNCHANGED, still `../lib/agent-runtime.ts`).
//
// Wire disclosure: this page opts IN (ADR-0129 clause 3 — `disclosure` default off) so the raw-JSONL
// `<details>` dump a2ui-chat always showed is preserved. Narration ships unconditionally inside the
// primitive (SPEC-R6). Meta notices that are NOT conversation turns (reset, transcript-exhausted, the
// dev-overlay's connection status) render as a page-level status line OUTSIDE the thread — the primitive
// exposes no `addSystemMessage`, and these are page chrome, not agent turns (genuine turn FAILURES still
// surface as the primitive's own system bubble via `AgentTurnHandle.fail()`). GH #415: a TRANSPORT-composed
// terminal failure (`a2uiMeta.error`) takes that same `fail()` path AND echoes on the status line — it is
// the notice that REPLACES the transcript-exhausted one this line already owned, so the aria-live channel
// must announce it rather than leave a stale "Live agent connected" sitting under a failed turn.
//
// Recorded-default (`createRecordedTransport`, ADR-0073); the live arm reuses the identical runtime-probed
// dynamic-import pattern `a2ui-live.ts` ships (SPEC-R8, superseded by ADR-0152 — the probe now resolves in
// every environment, not only dev: production carries a Cloudflare Worker port of the dev proxy under
// `/__a2ui/agent`). GH #257 — the Provider/Model/Mode picker rides the composed `ui-conversation-composer`'s
// own `providers`/`provider`/`modes`/`mode` props now (`../lib/provider-mode-selection.ts` supplies the
// option lists + localStorage persistence), replacing the old standalone `provider-switcher.ts` overlay.
// `a2a-artifact-feed.ts` stays dev-only by design — out of ADR-0152's scope.
import { mountFullBleedPage } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import './a2ui-chat.css'
import '@agent-ui/app/chat-shell.css' // ui-chat-shell's own host flex-column layout (round 4, GH #98)
import '@agent-ui/app/chat-shell' // self-defines <ui-chat-shell> (composes an inner <ui-super-shell>)
import '@agent-ui/app/super-shell.css' // the composed inner ui-super-shell's own geometry/collapse CSS
import '@agent-ui/app/conversation.css' // ui-conversation's own thread/narration layout (LLD-C6)
import '@agent-ui/app/conversation-dialog.css' // ADR-0180 (GH #688) — the adopted-or-created log's own scroll/layout CSS, promoted off conversation.css
import '@agent-ui/app/conversation-composer.css' // TKT-0056 — the composed ui-conversation-composer's own layout/parts CSS
import '@agent-ui/app/conversation' // self-defines <ui-conversation> (which registers <ui-surface-host>/<ui-conversation-composer> in turn)
import '@agent-ui/code/markdown.css'
import '@agent-ui/code/markdown' // self-defines <ui-markdown> — the SPEC-R12 (TKT-0071) content-render hook's own concern, NOT ui-conversation's; this page is free to import @agent-ui/code, ui-conversation itself never does
import type { A2uiClientMessage } from '@agent-ui/a2ui'
import type { UIConversationElement } from '@agent-ui/app'
import type { UIMarkdownElement } from '@agent-ui/code/markdown'
import {
  createRecordedTransport,
  recordedTranscript,
  nextTurn,
  appendUserTurn,
  appendAssistantTurn,
  frameClientMessage,
  shouldRunTurn,
  readMetaLine,
} from '../lib/agent-runtime.ts'
import type { AgentTransport, TurnInput, Session } from '../lib/agent-runtime.ts'
// GH #257 — the Provider/Model/Mode picker now lives INSIDE ui-conversation's own composed
// ui-conversation-composer (providers/provider/modes/mode props), replacing the standalone
// `provider-switcher.ts` overlay. This module is plain, safe data (no fetch/key) — statically importable;
// only the ACTUAL prop assignment below stays behind the live-probe branch, preserving the exact prior UX
// (no picker shown before a live provider is confirmed reachable).
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

// `ui-chat-shell` composes its inner `ui-super-shell` from `this.children` AT CONNECT time (chat-shell.ts)
// — unlike the plain `<div>` this replaced, children must be appended BEFORE `shell` itself joins the live
// `content` region, or it composes empty (its own `#compose()` guard makes that permanent, never re-run).
const shell = document.createElement('ui-chat-shell')
shell.classList.add('chat-shell')

const header = el('header', 'chat-head')
header.setAttribute('data-slot', 'header')
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

// The whole thread + composer + narration + per-surface mounts + wire disclosure is ONE primitive now.
const conv = document.createElement('ui-conversation') as UIConversationElement
conv.setAttribute('disclosure', '') // opt IN to the raw-wire per-turn dump (ADR-0129 clause 3) — a2ui-chat always showed it
// SPEC-R12 (TKT-0071): agent-turn note + system-bubble text render through ui-markdown instead of literal
// `**bold**` syntax reaching the user. This page owns the @agent-ui/code import — ui-conversation itself
// never does (the app DAG stays untouched, CLAUDE.md's layering law).
conv.setContentRenderer((text) => {
  const node = document.createElement('ui-markdown') as UIMarkdownElement
  node.markdown = text
  return node
})
shell.append(conv)

// A page-level status line for meta notices that are NOT conversation turns (reset / transcript-exhausted /
// dev-overlay connection status). aria-live so a screen reader still announces them; latest-wins.
const statusLine = el('p', 'chat-status')
statusLine.setAttribute('aria-live', 'polite')
shell.append(statusLine)
function status(text: string): void {
  statusLine.textContent = text
}

const resetBar = el('div', 'reset-bar')
const resetBtn = document.createElement('ui-button')
resetBtn.setAttribute('variant', 'ghost')
resetBtn.setAttribute('tabindex', '0')
resetBtn.textContent = 'Reset'
resetBar.append(resetBtn)
shell.append(resetBar)

content.append(shell) // LAST — every child is present before this element ever connects (see the note above)

// ════════════════ the transport + the turn loop ════════════════

let transport: AgentTransport = createRecordedTransport(recordedTranscript)
// GH #415 (the sibling pages' GH #408 fix, ported) — WHICH backbone `transport` currently is, tracked at
// every one of the three sites that assign it (this initializer, Reset's fail-closed restart,
// `wireLiveOverlay()`'s live swap). The empty-turn notice below used to be transport-BLIND: a LIVE turn that
// produced nothing printed the recorded backbone's own "no further turns in this recorded transcript"
// wording — a claim about a transcript that isn't running, with the wrong remedy attached.
let isLive = false

/** Test-only injection seam (the `a2ui-live.ts` `__setTransportForTest` precedent) — otherwise reassigned
 *  ONLY by `wireLiveOverlay()`'s real live-key probe. Never called by any other page-code path. `live`
 *  (GH #415) declares which backbone the injected stub STANDS FOR, so a test can drive the live-only
 *  empty-turn wording; omitted ⇒ recorded, leaving every pre-#415 call site byte-unaffected. */
export function __setTransportForTest(next: AgentTransport, live = false): void {
  transport = next
  isLive = live
}

let session: Session = { turns: [] }
let busy = false

function setBusy(next: boolean): void {
  busy = next
  // A page-owned busy signal (the composer lives INSIDE the primitive, so there is no send-button to
  // disable from here) — reflected on the shell so the turn loop serializes and tests can await idle.
  if (next) shell.dataset.busy = '1'
  else delete shell.dataset.busy
}

async function runTurn(input: TurnInput): Promise<void> {
  if (busy) return
  setBusy(true)
  const handle = conv.beginAgentTurn()
  let note: string | undefined
  const turnLines: string[] = []
  let failed = false
  let transportError: string | undefined

  try {
    for await (const line of transport.turn(input)) {
      // ADR-0088 §1: peel the reserved leading meta-line BEFORE it reaches the primitive — it must never be
      // ingested (it is provably not an `A2uiServerMessage`), so it never enters narration, routing, or the
      // wire disclosure. `note` rides the meta-line; a `trace`, if present (live arm only), is ignored here
      // (the frozen `AgentTurnHandle` has no trace-narration call site — app-surfaces-m2.lld.md §6). ADR-0146
      // F1: a `progress` meta-line routes to `handle.progress()` (live narration) — the SAME filter growing
      // one arm, never a new parse path; it never reaches ingestLine/the wire disclosure/the corpus.
      const meta = readMetaLine(line)
      if (meta) {
        if (meta.a2uiMeta.progress) handle.progress(meta.a2uiMeta.progress)
        if (meta.a2uiMeta.note !== undefined) note = meta.a2uiMeta.note
        // GH #144/#415 — the transport-composed TERMINAL error line (`formatErrorLine`, meta-line.ts): the
        // ONLY way a proxy whose headers already committed 200 can report a `ProduceHalt`/upstream fault
        // instead of ending as a silently-empty "success". It parses cleanly and matched NEITHER arm above,
        // so pre-#415 it was `continue`d into silence — and the turn, now holding zero lines, fell through
        // to the empty-turn branch below and blamed a recorded transcript for a live failure.
        if (meta.a2uiMeta.error !== undefined) transportError = meta.a2uiMeta.error
        continue
      }
      turnLines.push(line)
      handle.ingestLine(line) // routes by surfaceId to a fresh/known inline ui-surface-host, or narrates
    }
    // GH #415 — an error-terminated turn is a FAILED turn, treated exactly like one that THREW: the same
    // `handle.fail()` the catch block below calls (SPEC-R6 AC3 — the primitive truncates narration, forces
    // the strip header to `error`, and surfaces the ⚠ system bubble), plus the page-level status notice this
    // failure now owns. Like a thrown turn it reaches NONE of the completion work below: no `setNote`, no
    // `finalize` (which would settle the strip green over a turn that genuinely failed), no feedback chips,
    // no session append, and never the empty-turn branch that would misname the cause. The `finally` still
    // runs on this `return`, so `busy` is released exactly as on every other exit.
    if (transportError !== undefined) {
      handle.fail(transportError)
      status(`⚠ ${transportError}`)
      return
    }
    if (note !== undefined) handle.setNote(note)
    // GH #291/ADR-0160 clause 3 — the pre-hydrated action-chip mechanism's own proof-of-concept
    // consumer wiring: a settled turn with real content gets a Helpful/Not-Helpful feedback pair (the
    // reference's own illustrative example — this page's choice, not something the primitive hardcodes).
    // GH #291 review — "real content" includes a NOTE-ONLY settled turn (a prose note IS the turn's
    // content when there are no wire lines, ADR-0088's own note law); gating on `turnLines.length > 0`
    // alone silently excluded that case even though `note !== undefined` was already checked two lines
    // above for the identical reason.
    handle.finalize(
      turnLines.length > 0 || note !== undefined
        ? [
            { id: 'helpful', label: 'Helpful 👍' },
            { id: 'not-helpful', label: 'Not Helpful 👎' },
          ]
        : undefined,
    )
  } catch (e) {
    failed = true
    handle.fail((e as Error).message) // SPEC-R6 AC3 — the primitive truncates narration + surfaces a system bubble
  } finally {
    setBusy(false)
  }

  if (failed) return
  if (turnLines.length === 0 && note === undefined) {
    // GH #415 — transport-honest: only the RECORDED backbone has a finite transcript to exhaust, so only it
    // may say so (and only it can be Reset back to turn 1). A live turn that emitted nothing renderable (and
    // no error line — that path returned above) states just that fact.
    status(
      isLive
        ? "The agent's turn produced no renderable output."
        : 'The agent has no further turns in this recorded transcript. Reset to start over.',
    )
    return
  }
  session = appendUserTurn(session, input.kind === 'intent' ? input.text : frameClientMessage(input.message))
  session = appendAssistantTurn(session, turnLines.join('\n'))
}

function handleClientMessage(message: A2uiClientMessage): void {
  if (!shouldRunTurn(message)) return // ADR-0088 §3: an explicit wantResponse:false opt-out applies silently
  void runTurn(nextTurn(session, message))
}

// The reply affordance + the bubbled-up client messages are CALLBACKS, never CustomEvents (SPEC-R5) — safe
// to register before OR after the element connects.
conv.onSubmit((text) => void runTurn({ kind: 'intent', text, session }))
conv.onClientMessage(handleClientMessage)

// GH #291/ADR-0160 clause 3 — `action` IS a real CustomEvent (ADR-0153's seventh closed-vocabulary
// member, reused, never an eighth): the feedback pair's own commit. This page just surfaces it as a
// status line — a real product would send it to telemetry.
// GH #291 review — `action` is ALSO the shape a genui `ui-sandbox-frame`'s own game-loop action
// bubbles as (conversation.ts's `routeGenui`, SPEC-R8), and it bubbles/composes through `ui-conversation`
// the same as the chip row's own commit (conversation.md's `action` entry). Discriminate by
// `event.target`: the chip row fires ON `conv` itself (conversation.md's `action` entry); a genui
// action's target is the sandbox-frame that mounted it, never `conv`. Without this guard a genui action
// click on this page misfires this thank-you line.
conv.addEventListener('action', (e) => {
  if (e.target !== conv) return
  const id = (e as CustomEvent<{ id: string }>).detail.id
  status(id === 'helpful' ? 'Thanks for the feedback!' : "Thanks — noted, we'll do better.")
})

// ════════════════ reset ════════════════
resetBtn.addEventListener('click', () => {
  conv.reset() // disposes every open surface host + clears the thread (SPEC-R7)
  session = { turns: [] }
  transport = createRecordedTransport(recordedTranscript)
  isLive = false // GH #415 — reset alongside the transport it describes; the re-probe below sets it true again only if the live swap actually lands
  status('New conversation. Send a prompt to begin.')
  wireLiveOverlay() // re-probe
})

// ════════════════ the LIVE overlay — probed dynamically in both dev and prod (SPEC-R8/N2 superseded: prod
// now carries a Cloudflare Worker port of the dev proxy under `/__a2ui/agent`, worker/index.ts — see
// a2ui-live.ts's header for the full rationale, identical here). A prompt still degrades cleanly to the
// recorded transcript whenever `/status` reports no live provider available. ════════════════════════════
function wireLiveOverlay(): void {
  void (async () => {
    try {
      const overlay = await import('../lib/live-proxy-transport.ts')
      const probe = await overlay.probeLive()
      if (probe.available) {
        // GH #257 — the Provider/Model/Mode picker now rides ui-conversation's own composed
        // ui-conversation-composer props (providers/provider/modes/mode) instead of a standalone
        // provider-switcher.ts overlay. `conv` never writes `model`/`provider`/`mode`/`effort` itself outside
        // this page's OWN callback handlers below (props down, callbacks up) — the restored/committed
        // selection lives in this closure, persisted the same way provider-switcher.ts's SelectionRef did.
        // GH #273 — `effort` rides the SAME forwarded prop pair (efforts/effort, already shared with
        // a2ui-live.ts's `createLiveProxyTransport` seam via `StoredSelection`); this page's own live
        // requests were already sending the persisted effort with no picker to explain or change it — this
        // closes that gap by parity with a2ui-live.ts, the smaller of the issue's two fix options.
        let selection = loadPersistedSelection()
        conv.providers = PROVIDER_OPTIONS
        conv.provider = selection.provider
        conv.model = selection.model
        conv.modes = MODE_OPTIONS
        conv.mode = selection.mode
        conv.efforts = EFFORT_LEVELS
        conv.effort = selection.effort
        conv.onProviderChange((id) => {
          selection = { ...selection, provider: id }
          conv.provider = id
          persistSelection(selection)
        })
        conv.onModelChange((id) => {
          selection = { ...selection, model: id }
          conv.model = id
          persistSelection(selection)
        })
        conv.onModeChange((id) => {
          // The Mode picker's own `modes` list is always built from `MODE_OPTIONS`/`GEN_UI_MODES` above —
          // every committable id genuinely IS a `GenUiMode`; `conv.onModeChange` itself carries the
          // composer's plain `(id: string)` shape (props down/callbacks up — it never imports `GenUiMode`).
          selection = { ...selection, mode: id as StoredSelection['mode'] }
          conv.mode = id
          persistSelection(selection)
        })
        conv.onEffortChange((id) => {
          selection = { ...selection, effort: id as EffortLevel }
          conv.effort = id
          persistSelection(selection)
        })
        transport = overlay.createLiveProxyTransport({ get: () => selection })
        isLive = true // GH #415 — the ONE place a live backbone is adopted; set adjacent to the assignment it describes so the two can never drift
        status(`Live agent connected (${probe.providers} provider(s) available). Prompt it to generate a real A2UI surface.`)
      } else if (import.meta.env.DEV) {
        status('Recorded transcript (no live API key found). Set a provider key in .env and restart `npm run dev` for a live agent.')
      } else {
        status('Recorded transcript demo. Send a prompt to render turn 1, then interact with the surface to continue.')
      }
    } catch {
      status('Recorded transcript demo (live overlay unavailable).')
    }
  })()
}
wireLiveOverlay()
