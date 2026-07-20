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
// surface as the primitive's own system bubble via `AgentTurnHandle.fail()`).
//
// Recorded-default (`createRecordedTransport`, ADR-0073); the live arm reuses the identical DEV-guarded
// dynamic-import + switcher pattern `a2ui-live.ts`/`a2a-artifact-feed.ts` each already ship (SPEC-R8).
import { mountFullBleedPage } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import './a2ui-chat.css'
import '@agent-ui/app/chat-shell.css' // ui-chat-shell's own host flex-column layout (round 4, GH #98)
import '@agent-ui/app/chat-shell' // self-defines <ui-chat-shell> (composes an inner <ui-super-shell>)
import '@agent-ui/app/super-shell.css' // the composed inner ui-super-shell's own geometry/collapse CSS
import '@agent-ui/app/conversation.css' // ui-conversation's own thread/narration layout (LLD-C6)
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

const switcherSlot = el('div', 'switcher-slot')
shell.append(switcherSlot) // switcher (dev-only, populated on probe) sits below the conversation

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

/** Test-only injection seam (the `a2ui-live.ts` `__setTransportForTest` precedent) — otherwise reassigned
 *  ONLY by `wireLiveOverlay()`'s real, dev-only live-key probe. Never called by any production path. */
export function __setTransportForTest(next: AgentTransport): void {
  transport = next
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
        continue
      }
      turnLines.push(line)
      handle.ingestLine(line) // routes by surfaceId to a fresh/known inline ui-surface-host, or narrates
    }
    if (note !== undefined) handle.setNote(note)
    handle.finalize()
  } catch (e) {
    failed = true
    handle.fail((e as Error).message) // SPEC-R6 AC3 — the primitive truncates narration + surfaces a system bubble
  } finally {
    setBusy(false)
  }

  if (failed) return
  if (turnLines.length === 0 && note === undefined) {
    status('The agent has no further turns in this recorded transcript. Reset to start over.')
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

// ════════════════ reset ════════════════
resetBtn.addEventListener('click', () => {
  conv.reset() // disposes every open surface host + clears the thread (SPEC-R7)
  session = { turns: [] }
  transport = createRecordedTransport(recordedTranscript)
  status('New conversation. Send a prompt to begin.')
  wireLiveOverlay() // re-probe (dev only)
})

// ════════════════ the dev-only LIVE overlay (SPEC-R8/N2: dynamic + DEV-guarded ⇒ tree-shaken from build) ════
function wireLiveOverlay(): void {
  if (!import.meta.env.DEV) {
    status('Recorded transcript demo. Send a prompt to render turn 1, then interact with the surface to continue.')
    return
  }
  void (async () => {
    try {
      const overlay = await import('../lib/live-proxy-transport.ts')
      const probe = await overlay.probeLive()
      if (probe.available) {
        const { mountSwitcher } = await import('../lib/provider-switcher.ts')
        const selection = mountSwitcher(switcherSlot)
        transport = overlay.createLiveProxyTransport(selection)
        status(`Live agent connected (${probe.providers} provider(s) available). Prompt it to generate a real A2UI surface.`)
      } else {
        status('Recorded transcript (no live API key found). Set a provider key in .env and restart `npm run dev` for a live agent.')
      }
    } catch {
      status('Recorded transcript demo (live overlay unavailable).')
    }
  })()
}
wireLiveOverlay()
