// site/pages/surface-host-doc.ts — the ui-surface-host public-API guide (GH #834; LLD-C1, ADR-0129 clause 1,
// SPEC-R2/R3). `ui-surface-host` lives in `@agent-ui/app`, OUTSIDE the `components/src` fleet the
// site-coverage/site-toc drift gates enumerate — an UNGROUPED site-level page (the router-doc.ts precedent),
// registered once in site-manifest.json.
//
// DERIVE-FIRST: the API table below is NOT hand-restated — it reads straight from the shipped descriptor
// (surface-host.md) through the SAME canonical parser (parseDoc) the in-package contract trip-wire
// (surface-host.test.ts) validates, rendered by the SAME shared doc-page renderer every ui-* control's own
// doc page uses. surface-host.md's own prose body ALREADY documents the imperative API
// (ingest/finalize/dispose/onClientMessage/setInteractiveDisabled) and the GH #805 disable-on-action
// mechanics in full — this page renders that body verbatim (renderMarkdownBody) rather than re-narrating it
// by hand, so the two can never drift apart.
//
// The one hand-authored piece is the live demo: a REAL, standalone `<ui-surface-host>` — composed directly
// into this page, NOT nested inside a `ui-conversation` (SPEC-R3's own claim: "behaves identically composed
// directly into an app frame's persistent canvas... or nested inline inside ui-conversation's own per-surface
// registry — same class, same public methods, no conditional behaviour keyed on ancestry"). It reuses the
// SAME `canvasButtonSeed` example the A2UI Canvas page feeds (`@agent-ui/a2ui/examples`, ADR-0055) — shown ≡
// fed ≡ GATED (examples.test.ts validates + render-smokes it at check time) — rather than inventing a new
// payload, so the demo genuinely exercises the SAME two-line stream the canonical seed shelf already proves.
import { mountPage } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import '@agent-ui/app/surface-host.css' // ui-surface-host's own checkered-artboard geometry
import '@agent-ui/app/surface-host' // self-defines <ui-surface-host>
import './surface-host-doc.css' // page-local demo chrome only (the framed artboard + the message log) — never restyles the control's internals
import { loadSurfaceHostDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { exampleSection } from '../lib/specimens.ts'
import { canvasButtonSeed } from '@agent-ui/a2ui/examples'
import type { UISurfaceHostElement, A2uiClientMessage } from '@agent-ui/app/surface-host'

const { descriptor, body } = loadSurfaceHostDoc()

const { content } = mountPage({
  title: 'ui-surface-host — API',
  intro:
    'The M2 mount/stream seam (@agent-ui/app, ADR-0129 clause 1) — wraps exactly ONE @agent-ui/a2ui ' +
    'RendererHost, exposing its mount/stream seam as public imperative methods. Standalone-usable (SPEC-R3): ' +
    'composed here directly, with no ui-conversation ancestor — the exact same class, same public methods, no ' +
    'conditional behaviour keyed on ancestry. This page is generated from surface-host.md: the API tables and ' +
    'the full imperative-API + GH #805 disable-on-action prose below are read straight from the same ' +
    'descriptor the contract trip-wire validates; only the live demo is hand-authored.',
})

// ── the live, standalone demo (SPEC-R3) ─────────────────────────────────────────────────────────────────────

const host = document.createElement('ui-surface-host') as UISurfaceHostElement
host.setAttribute('label', 'Standalone surface — no ui-conversation ancestor')

const log = document.createElement('ol')
log.className = 'sh-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function appendLog(text: string): void {
  seq += 1
  const item = document.createElement('li')
  item.textContent = `#${String(seq).padStart(2, '0')}  ${text}`
  log.append(item)
  log.scrollTop = log.scrollHeight
}

host.onClientMessage((message: A2uiClientMessage) => {
  appendLog(`onClientMessage → ${JSON.stringify(message)}`)
})

const reenableBtn = document.createElement('button')
reenableBtn.type = 'button'
reenableBtn.className = 'sh-reenable'
reenableBtn.textContent = 'Simulate a failed turn → setInteractiveDisabled(false)'
reenableBtn.addEventListener('click', () => {
  host.setInteractiveDisabled(false)
  appendLog('setInteractiveDisabled(false) — the caller-driven re-enable arm (a failed/aborted turn)')
})

const frame = document.createElement('div')
frame.className = 'sh-frame'
frame.append(host)

content.append(
  exampleSection(
    'Standalone demo — ingest / finalize / onClientMessage / the GH #805 disable-on-action arm',
    frame,
    reenableBtn,
    log,
  ),
)

content.append(
  (() => {
    const p = document.createElement('p')
    p.className = 'sh-note'
    p.textContent =
      'Fed the SAME canvasButtonSeed payload the A2UI Canvas page uses (ADR-0055) — one createSurface line, ' +
      'one Button root whose action:{action:"submit"} carries no wantResponse:false opt-out. Click the ' +
      'button: it emits an outbound action client-message, which this host is self-wired to react to before ' +
      'any consumer callback runs — every interactive descendant (here, the one button) disables immediately ' +
      '(the double-submit guard, for free). It stays disabled as answered history unless a NEW line arrives ' +
      'for this surface (ingest() re-enables unconditionally on entry) — or the app explicitly calls ' +
      'setInteractiveDisabled(false) itself, the one arm this host cannot own (a failed/aborted turn).'
    return p
  })(),
)

for (const message of canvasButtonSeed.messages) host.ingest(JSON.stringify(message))
host.finalize()

// ── API reference — DERIVED from the descriptor, then the full prose body (imperative API + GH #805) ───────
composeDocPage(content, descriptor, body)
