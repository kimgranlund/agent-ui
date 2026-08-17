// site/pages/conversation-doc.ts — the ui-conversation family guide (GH #833; LLD-C4/C5/C6, ADR-0129
// clause 2, ADR-0180 GH #688). `ui-conversation` (+ its three ADR-0180 recognized-children tags —
// ui-conversation-header/-dialog/-composer) lives in `@agent-ui/app`, OUTSIDE the `components/src` fleet
// the site-coverage/site-toc drift gates enumerate — an UNGROUPED site-level page (the router-doc.ts/
// surface-host-doc.ts precedent), registered once in site-manifest.json.
//
// BOTH contracts, each with a live example: (1) the imperative-only default (every shipped consumer today —
// a2ui-chat, a2ui-live, agent-admin — authors zero children) and (2) ADR-0180's opt-in declarative
// composition (the three recognized tags authored directly as light-DOM children; adopted, never created a
// second time), proving the SAME imperative API is path-blind by construction (ADR-0180 clause 4).
//
// DERIVE-FIRST: every API table AND every prose section below is read straight from the shipped descriptors
// (conversation.md / conversation-header.md / conversation-dialog.md / conversation-composer.md) through the
// SAME canonical parser (parseDoc) the in-package contract trip-wires validate, rendered by the SAME shared
// doc-page renderer every ui-* control's own doc page uses (composeDocPage/renderMarkdownBody) — the two
// live demos are the only hand-authored content, since a runnable turn-loop example has no descriptor field
// to derive from.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import '@agent-ui/app/conversation.css' // ui-conversation's own thread/narration layout (LLD-C6)
import '@agent-ui/app/conversation-header.css' // ADR-0180 — the header band's own layout CSS
import '@agent-ui/app/conversation-dialog.css' // ADR-0180 — the adopted-or-created log's own scroll/layout CSS
import '@agent-ui/app/conversation-composer.css' // TKT-0056 — the composed/adopted composer's own layout/parts CSS
import '@agent-ui/app/conversation' // self-defines <ui-conversation> (which registers header/dialog/composer in turn)
import './conversation-doc.css' // page-local demo chrome only (the framed shell) — never restyles a control's internals
import { composeDocPage, heading } from '../lib/doc-page.ts'
import { exampleSection } from '../lib/specimens.ts'
import {
  loadConversationDoc,
  loadConversationHeaderDoc,
  loadConversationDialogDoc,
  loadConversationComposerDoc,
} from '../lib/frontmatter.ts'
import type { UIConversationElement, AgentTurnHandle } from '@agent-ui/app/conversation'

const { content } = mountPage({
  title: 'ui-conversation — API',
  intro:
    'The M2 thread + composer + per-turn narration primitive (@agent-ui/app, ADR-0129 clause 2) — zero ' +
    'app-written chat chrome. Every method below is generated from conversation.md: the API tables and the ' +
    'prose body are read straight from the same descriptor the contract trip-wire validates; only the two ' +
    'live demos (imperative-only, then ADR-0180’s declarative composition) are hand-authored.',
})

// ── small demo scaffold (page chrome only — never restyles a ui-* control's internals) ────────────────────
function frame(el: HTMLElement): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'cvd-frame'
  wrap.append(el)
  return wrap
}

function code(text: string): HTMLElement {
  const c = document.createElement('code')
  c.textContent = text
  return c
}


/** A scripted "agent turn" — no real transport, standing in for `for await (const line of transport.turn(...))`.
 *  Streams one narration note after a short delay, then finalizes with a fallback tally. */
function runScriptedTurn(handle: AgentTurnHandle): void {
  handle.progress({ stage: 'started' })
  setTimeout(() => {
    handle.progress({ stage: 'done' })
    handle.setNote('Looked that up — here’s what I found.')
    handle.finalize()
  }, 700)
}

// ════════════════ 1 · The imperative-only default (every shipped consumer today) ════════════════
content.append(heading(2, '1 · The imperative-only default'))
content.append(
  pageLead(
    'By default the DOM is never author-composed: the thread + composer are built entirely by this ' +
      'element’s own imperative API. Every shipped consumer today — a2ui-chat, a2ui-live, agent-admin — ' +
      'drives this element with zero authored children, exactly like the bare instance below. Type a ' +
      'message and press Send; a scripted turn (no real transport) narrates briefly, then settles.',
  ),
)

const imperative = document.createElement('ui-conversation') as UIConversationElement
imperative.className = 'cvd-conv'
imperative.onSubmit((text) => {
  imperative.addUserMessage(text)
  const handle = imperative.beginAgentTurn()
  runScriptedTurn(handle)
})
content.append(exampleSection('Live demo — imperative-only', frame(imperative)))

// ════════════════ 2 · ADR-0180 — the opt-in declarative composition mode ════════════════
content.append(heading(2, '2 · The declarative composition mode (ADR-0180, GH #688)'))
content.append(
  pageLead(
    'An author MAY instead compose the three recognized child tags directly; ui-conversation ADOPTS ' +
      'whichever it finds instead of creating it — never a second imperative surface, and the whole turn/' +
      'registry/narration/busy engine stays solely on ui-conversation regardless of which path seated its ' +
      'parts (clause 4 — the imperative API below is path-blind). ',
    code('ui-conversation-header'),
    ' is the family’s ONE fully author-composed member — its children are the consumer’s own DOM, never ' +
      'created internally.',
  ),
)

const declarative = document.createElement('ui-conversation') as UIConversationElement
declarative.className = 'cvd-conv'

const header = document.createElement('ui-conversation-header')
const headerTitle = document.createElement('strong')
headerTitle.textContent = 'Support Agent'
header.append(headerTitle)

const dialog = document.createElement('ui-conversation-dialog')
const composer = document.createElement('ui-conversation-composer')

// Any subset works and band order is normalized at connect (header → dialog → composer) regardless of
// authored order — authored here out of order (composer before dialog) to demonstrate exactly that.
declarative.append(header, composer, dialog)

// The SAME imperative API, zero mode branches — it writes through whichever dialog/composer got seated,
// adopted or created (clause 4).
declarative.onSubmit((text) => {
  declarative.addUserMessage(text)
  const handle = declarative.beginAgentTurn()
  runScriptedTurn(handle)
})
content.append(exampleSection('Live demo — declarative composition (header/dialog/composer authored directly)', frame(declarative)))

// ════════════════ API reference — DERIVED from each descriptor ════════════════
content.append(heading(2, 'API reference'))

const conversationDoc = loadConversationDoc()
content.append(heading(3, 'ui-conversation'))
composeDocPage(content, conversationDoc.descriptor, conversationDoc.body)

const headerDoc = loadConversationHeaderDoc()
content.append(heading(3, 'ui-conversation-header'))
composeDocPage(content, headerDoc.descriptor, headerDoc.body)

const dialogDoc = loadConversationDialogDoc()
content.append(heading(3, 'ui-conversation-dialog'))
composeDocPage(content, dialogDoc.descriptor, dialogDoc.body)

const composerDoc = loadConversationComposerDoc()
content.append(heading(3, 'ui-conversation-composer'))
composeDocPage(content, composerDoc.descriptor, composerDoc.body)
