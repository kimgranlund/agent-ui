// a2ui-patterns.ts — the A2UI PATTERNS page. Five real-world agent UIs, each streamed as a VALID A2UI v1.0
// payload through the REAL @agent-ui/a2ui renderer (`createRenderer`) into a live ui-* surface — the exact
// path the server transport would take. Nothing reaches into renderer internals. Each demo shows, side by
// side, the PAYLOAD the agent emits (its data model + its component tree, the two halves it streams) and the
// LIVE rendered surface that payload produces. The displayed JSON is derived from the SAME message objects
// fed to the renderer, so the shown input and the fed input can never drift (shown ≡ fed).
//
// The five (a2ui-form-catalog-examples.decomp §4, fork F5 — no P6): (1) SETTINGS FORM — Field-wrapped
// controls + Switch toggles under a FormProvider, submit gated by the provider's validity (ADR-0054);
// (2) CONFIRMATION CARD — a destructive action expressed by action NAMES (no danger Button tone exists in the
// fleet — the pattern is carried by wording + variant contrast; the gap is noted, not improvised);
// (3) WIZARD — staged data entry via a bindable Tabs whose `selected` is client state that rides the data
// model; (4) DASHBOARD TILES — a display-only list template over `/metrics` with `${…}` label composition;
// (5) SCHEDULE PICKER — the Wave-5 date/time reach through the catalog (ISO canonical values in the model).
//
// Every payload is typed `readonly A2uiServerMessage[]`, so the site typecheck (`check:site`, folded into
// `npm run check`) pins each demo's message-envelope + child-graph shape; catalog-prop conformance and the
// id-graph ride runtime validation, surfaced in each interactive demo's message log (an invalid demo would
// show an `error ▸ server` line). The whole set is proven 0-error (CATALOG + IDGRAPH) against the default
// catalog before commit — a validator rejection on our own demo is a contradiction to fix, not to ship.

import { mountPage, pageLead } from './_page.ts' // FIRST import — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './a2ui-patterns.css' // page-local layout chrome only (the demo grid + the live-surface frame + the log)
import { codeBlock } from '../lib/code-block.ts' // shared <pre><code> previews (textContent, no injection)
import { createRenderer } from '@agent-ui/a2ui'
import type { A2uiServerMessage, A2uiClientMessage } from '@agent-ui/a2ui'
// The five pattern payloads now live ONCE on the example seed shelf (ADR-0055), extracted from this page's former
// literals. Importing them makes shown ≡ fed ≡ GATED — the SAME objects each demo displays and feeds are what
// `examples.test.ts` validates + render-smokes at check time. The hand-authored pedagogy (blurb/proves/teaches/
// toneGap/hint below) stays page-local — it is teaching prose, not payload data.
import {
  patternSettingsSeed,
  patternConfirmSeed,
  patternWizardSeed,
  patternDashboardSeed,
  patternScheduleSeed,
} from '@agent-ui/a2ui/examples'

const { content } = mountPage({ title: 'A2UI patterns' })
content.append(
  pageLead(
    'Five UIs an agent actually emits — a settings form, a destructive-action confirmation, a wizard, a ' +
      'dashboard, a schedule picker — each streamed as a valid A2UI v1.0 payload through the same renderer the ' +
      'canvas and list pages use. Every demo pairs the payload the agent sends with the live surface it renders; ' +
      'the shown JSON is derived from the very messages fed to the renderer, so they can never drift. Interact ' +
      'with a surface and its client→server messages appear in the log — the round-trip an agent would receive.',
  ),
)

// ── payload extractors — read the data model + the component set straight off the fed messages (no drift) ─────
// The two halves an agent streams: the data MODEL (the initial state the tree binds against) and the
// COMPONENTS (the tree itself). Both are pulled from the SAME A2uiServerMessage[] handed to the renderer.
function dataModelOf(messages: readonly A2uiServerMessage[]): unknown {
  for (const m of messages) if ('updateDataModel' in m) return m.updateDataModel.value
  return undefined
}
function hasDataModel(messages: readonly A2uiServerMessage[]): boolean {
  for (const m of messages) if ('updateDataModel' in m) return true
  return false
}
function componentsOf(messages: readonly A2uiServerMessage[]): unknown {
  for (const m of messages) if ('updateComponents' in m) return m.updateComponents.components
  return []
}
function sendsDataModel(messages: readonly A2uiServerMessage[]): boolean {
  for (const m of messages) if ('createSurface' in m) return m.createSurface.sendDataModel === true
  return false
}

// ── small light-DOM scaffold (page chrome only — it never restyles a ui-* control) ───────────────────────────
function codeFigure(caption: string, value: unknown): HTMLElement {
  const figure = document.createElement('figure')
  figure.className = 'code-figure'
  const cap = document.createElement('figcaption')
  cap.textContent = caption
  figure.append(cap, codeBlock(JSON.stringify(value, null, 2), 'json'))
  return figure
}

/** The two-line pedagogy every pattern carries: what it PROVES about the protocol + what it TEACHES an author. */
function teachBlock(proves: string, teaches: string): HTMLElement {
  const block = document.createElement('div')
  block.className = 'demo-teach'
  const provesLine = document.createElement('span')
  provesLine.append(bold('Proves: '), document.createTextNode(proves))
  const teachesLine = document.createElement('span')
  teachesLine.append(bold('Copy this: '), document.createTextNode(teaches))
  block.append(provesLine, teachesLine)
  return block
}
function bold(text: string): HTMLElement {
  const b = document.createElement('b')
  b.textContent = text
  return b
}

/**
 * patternSection — one captioned pattern demo: a heading + blurb + the two-line pedagogy, then a two-pane grid
 * of [payload | live surface]. The payload pane shows the data model (when the payload carries one) + the
 * component tree; the output pane mounts the LIVE renderer surface the payload produces. `interactive` adds a
 * client→server message log (fed by the host's `onClientMessage`) so a demo's actions/round-trips are visible.
 * `toneGap` renders the P2 honesty note about the fleet's missing destructive Button tone.
 */
function patternSection(opts: {
  step: string
  title: string
  blurb: string
  proves: string
  teaches: string
  messages: readonly A2uiServerMessage[]
  surfaceId: string
  interactive?: boolean
  hint?: string
  toneGap?: string
}): HTMLElement {
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

  const grid = document.createElement('div')
  grid.className = 'demo-grid'

  // LEFT — the streamed payload (data model + components), derived from the fed messages so it can't drift.
  const payloadPane = document.createElement('div')
  payloadPane.className = 'payload-pane'
  if (hasDataModel(opts.messages)) payloadPane.append(codeFigure('Data model', dataModelOf(opts.messages)))
  payloadPane.append(
    codeFigure(
      sendsDataModel(opts.messages) ? 'Components (createSurface sendDataModel: true)' : 'Components',
      componentsOf(opts.messages),
    ),
  )

  // RIGHT — the live rendered surface (the real renderer's output), plus the tone note + round-trip log.
  const outputPane = document.createElement('div')
  outputPane.className = 'output-pane'
  const surfaceEl = document.createElement('div')
  surfaceEl.className = 'surface'
  outputPane.append(surfaceEl)

  if (opts.toneGap) {
    const note = document.createElement('p')
    note.className = 'tone-gap'
    note.textContent = opts.toneGap
    outputPane.append(note)
  }

  let appendLog: ((message: A2uiClientMessage) => void) | undefined
  if (opts.interactive) {
    const hint = document.createElement('p')
    hint.className = 'demo-hint'
    hint.textContent = opts.hint ?? 'Interact with the surface — the client→server messages appear below.'
    const log = document.createElement('ol')
    log.className = 'msg-log'
    log.setAttribute('aria-live', 'polite')
    outputPane.append(hint, log)
    let seq = 0
    appendLog = (message) => {
      seq += 1
      const kind = 'action' in message ? 'action' : 'error'
      const item = document.createElement('li')
      item.dataset.kind = kind
      const head = document.createElement('div')
      head.className = 'msg-head'
      head.textContent = `#${String(seq).padStart(2, '0')}  ${kind === 'action' ? 'action ▸ server' : 'error ▸ server'}`
      item.append(head, codeBlock(JSON.stringify(message, null, 2), 'json'))
      log.append(item)
      log.scrollTop = log.scrollHeight
    }
  }

  // Drive the payload through a fresh renderer via its PUBLIC surface — exactly as the transport would.
  const host = createRenderer()
  if (appendLog) host.onClientMessage(appendLog)
  host.mount(surfaceEl)
  for (const message of opts.messages) host.ingestMessage(message)
  host.finalize(opts.surfaceId)

  grid.append(payloadPane, outputPane)
  section.append(heading, blurb, teachBlock(opts.proves, opts.teaches), grid)
  return section
}

// ── the five patterns — each fed straight from its shelf seed (the payloads that were once local to this page) ──
// P1 = patternSettingsSeed (a settings form gated by a FormProvider) · P2 = patternConfirmSeed (a destructive-
// action confirmation whose action NAMES carry the intent) · P3 = patternWizardSeed (a bindable-Tabs stepper) ·
// P4 = patternDashboardSeed (a display-only /metrics template) · P5 = patternScheduleSeed (the Wave-5 date/time
// reach). Each demo reads `messages`/`surfaceId` off its seed — no local literal.
//
// PAGE-LOCAL rationale that is NOT seed data (the seed encodes the STRUCTURE, this note explains the CHOICE):
// P5's schedule card is deliberately NOT wrapped in a FormProvider (unlike P1/P3). A `type=date` field nested in a
// ui-form-provider currently triggers a component-side reactive write-loop (the field's hidden ui-calendar, a
// UIFormElement, is discovered as a SECOND provider member and the calendar↔field↔provider aggregation fails to
// converge — flagged to the coordinator for the components backlog). P5's lesson is the date/time reach + ISO-
// canonical values, which needs no provider; the gated-form idiom is already P1's and P3's.
content.append(
  patternSection({
    step: '1',
    title: 'Settings form',
    blurb:
      'A Card wrapping a FormProvider: a text Field, three Switch toggles, and a Select, each two-way-bound under /settings/*. Flip a toggle or edit the name, then press “Save settings”. Because createSurface set sendDataModel, the valid submit’s action carries the live typed aggregate — booleans stay booleans, the two-way binds wrote the model.',
    proves:
      'the coordinated-form idiom an agent emits in the wild — Field-labelled controls, toggles that two-way-bind, and a submit gated by the FormProvider’s own validity (ADR-0054), all from one payload.',
    teaches:
      'set createSurface.sendDataModel, bind every input to /form/* (or /settings/*), and flag the submit Button’s action with submit: true — the provider becomes the gate and the aggregate rides the action’s dataModel.',
    messages: patternSettingsSeed.messages,
    surfaceId: patternSettingsSeed.surfaceId,
    interactive: true,
    hint:
      'Toggle a switch or edit the workspace name, then press “Save settings” — the action below carries the live /settings aggregate. Now clear the workspace name and submit again: the provider gate suppresses the action and focuses the empty required field (no message emitted).',
  }),
  patternSection({
    step: '2',
    title: 'Confirmation card — a destructive action',
    blurb:
      'A static Card, no form: a title, a warning body, and two Buttons whose action NAMES carry the two intents — “Cancel” emits { action: "cancel" }, “Delete workspace” emits { action: "confirm_delete", wantResponse: true }. The confirm asks for a response, so the client registers a correlation slot and waits for the server’s reply (whether the delete succeeded).',
    proves:
      'the action name IS the contract — two Buttons, two intents, no shared state; and wantResponse: true opens a correlation the server’s actionResponse settles.',
    teaches:
      'name actions for the intent, not the widget; set wantResponse only when you need the server’s answer back. There is no need for client-side branching — the server reads the action name.',
    messages: patternConfirmSeed.messages,
    surfaceId: patternConfirmSeed.surfaceId,
    interactive: true,
    hint:
      'Press either button — its action appears below. “Delete workspace” carries wantResponse: true (a reply is expected); “Cancel” does not.',
    toneGap:
      'Tone gap: the fleet ships no danger/destructive Button tone (only solid · soft · ghost), so the destructive weight here is carried by wording and a solid-vs-soft contrast. A danger tone is flagged for the components backlog — the pattern is presented honestly rather than improvised.',
  }),
  patternSection({
    step: '3',
    title: 'Wizard / stepper',
    blurb:
      'Three Tab panels — Account, Workspace, Review — under a FormProvider. The catalog’s Tab rows carry no value, so Tabs.selected addresses steps by index and two-way-binds to /wizard/step: clicking a tab is client state, tracked with no server round-trip. Fields in every panel bind under /wizard/*; the Review panel’s “Create workspace” submit (gated by the provider) emits the whole aggregate — the step you left off on included.',
    proves:
      'a bindable Tabs.selected is client state the agent can READ — staged disclosure without a server round-trip, and the current step rides the data model on submit.',
    teaches:
      'bind Tabs.selected to a data path to make the active step part of the aggregate; keep fields for every step in the tree (hidden panels stay mounted) so one gated submit collects them all.',
    messages: patternWizardSeed.messages,
    surfaceId: patternWizardSeed.surfaceId,
    interactive: true,
    hint:
      'Click through the tabs — each selection writes /wizard/step in the model (no message sent). Fill any step, land on “Review”, and press “Create workspace”: the action carries the full /wizard aggregate, step and all.',
  }),
  patternSection({
    step: '4',
    title: 'Dashboard tiles',
    blurb:
      'A Row whose children is a template over /metrics: one Card per metric, positionally. Each tile’s big number is the ${…} template “${value}${unit}” and its footnote is “${delta} vs last month” — the agent composes each label from relative item paths rather than binding one path. Add a metric to the array and a tile appears; it is display-only, so there is nothing to round-trip.',
    proves:
      'display surfaces are cheap: one data array + one template Card renders the whole grid, and ${…} composes each label from data in source order.',
    teaches:
      'reach for a children template ({ path, componentId }) the moment you have a list of like things; compose labels with ${…} over relative paths instead of pre-formatting strings server-side.',
    messages: patternDashboardSeed.messages,
    surfaceId: patternDashboardSeed.surfaceId,
  }),
  patternSection({
    step: '5',
    title: 'Schedule picker card',
    blurb:
      'A Card with a date Field, a time Field, and a time-zone Select. TextField type=date and type=time come straight through the catalog’s 12-value type enum (type=date opens a calendar inside the control). The model holds ISO-canonical values — a YYYY-MM-DD date, an HH:MM time, an IANA zone — while the control renders a localized display; the action carries the wire-portable ISO form (createSurface set sendDataModel).',
    proves:
      'the Wave-5 date/time reach is fully catalog-expressible — type=date/time are ordinary reflecting props — and the data model stays ISO-canonical regardless of the localized display.',
    teaches:
      'pick the TextField type (date, time, currency, …) in the payload and bind its value like any string; trust the model’s ISO value as the wire form and let the control own the localized presentation.',
    messages: patternScheduleSeed.messages,
    surfaceId: patternScheduleSeed.surfaceId,
    interactive: true,
    hint:
      'Open the date field (a calendar), pick a day, set a time, choose a zone, then press “Schedule” — the action carries the ISO /schedule aggregate the server would store.',
  }),
  composingContainers(),
)

// ── the "Composing containers" teaching block (ADR-0056 pedagogy leg 3) ─────────────────────────────
// The composition rules a payload author must know — the capability-bearing idioms the patterns above
// MODEL. Kept beside the demos (not seed data): these are authored teaching, gated only by review.
function composingContainers(): HTMLElement {
  const section = document.createElement('section')
  section.className = 'demo'
  const h2 = document.createElement('h2')
  h2.textContent = 'Composing containers — the region rules'
  const intro = document.createElement('p')
  intro.textContent =
    'Every pattern above follows three composition rules an agent-emitted payload should honor:'
  const list = document.createElement('ul')
  for (const [rule, why] of [
    [
      'Card children SHOULD be regions (CardHeader / CardContent / CardFooter).',
      'Regions carry the spacing system, and sticky header/footer + scrollable content REQUIRE them. A region-less Card still renders humanely (a CSS fallback pads the box — ADR-0056), but that is mercy, not parity: the fallback cannot give sticky or scroll.',
    ],
    [
      'A Field wraps exactly ONE form control.',
      'The field labels, describes, and error-reports its single slotted control (first-wins); compose multiple inputs as sibling Fields under one FormProvider.',
    ],
    [
      'Select children are Option components.',
      'Options carry value + label; the Select owns the popup, the keyboard model, and the committed value bind.',
    ],
  ] as const) {
    const li = document.createElement('li')
    const strong = document.createElement('strong')
    strong.textContent = rule
    li.append(strong, ' ', why)
    list.append(li)
  }
  section.append(h2, intro, list)
  return section
}
