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

import { mountPage } from './_page.ts' // FIRST import — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './a2ui-patterns.css' // page-local layout chrome only (the demo grid + the live-surface frame + the log)
import { codeBlock } from '../lib/code-block.ts' // shared <pre><code> previews (textContent, no injection)
import { createRenderer } from '@agent-ui/a2ui'
import type { A2uiServerMessage, A2uiClientMessage } from '@agent-ui/a2ui'

const { content } = mountPage({
  title: 'A2UI patterns',
  intro:
    'Five UIs an agent actually emits — a settings form, a destructive-action confirmation, a wizard, a ' +
    'dashboard, a schedule picker — each streamed as a valid A2UI v1.0 payload through the same renderer the ' +
    'canvas and list pages use. Every demo pairs the payload the agent sends with the live surface it renders; ' +
    'the shown JSON is derived from the very messages fed to the renderer, so they can never drift. Interact ' +
    'with a surface and its client→server messages appear in the log — the round-trip an agent would receive.',
})

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

// ── P1 — settings form: Field-wrapped controls + Switch toggles under a FormProvider; submit gated ───────────
// The everyday coordinated-form ask. Inputs two-way-bind under /settings/*; `sendDataModel: true` makes a valid
// submit's action carry the live typed aggregate. The submit Button's action is `submit: true` — a CLIENT-only
// flag the renderer reads to gate the click on the FormProvider's own validity (ADR-0054): all members valid →
// the action emits with the aggregate; a required field left empty → NO emit + first-invalid focus.
const SETTINGS_ID = 'pattern-settings'
const settingsMessages: readonly A2uiServerMessage[] = [
  { version: 'v1.0', createSurface: { surfaceId: SETTINGS_ID, catalogId: 'agent-ui', sendDataModel: true } },
  {
    version: 'v1.0',
    updateDataModel: {
      surfaceId: SETTINGS_ID,
      value: { settings: { workspace: 'Acme Inc', plan: 'pro', notify: true, weekly: false, twofa: true } },
    },
  },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: SETTINGS_ID,
      components: [
        { id: 'root', component: 'Card', elevation: '1', children: ['form'] },
        { id: 'form', component: 'FormProvider', children: ['col'] },
        { id: 'col', component: 'Column', gap: 'md', children: ['title', 'f_workspace', 'toggles', 'f_plan', 'actions'] },
        { id: 'title', component: 'Text', variant: 'h4', text: 'Workspace settings' },
        { id: 'f_workspace', component: 'Field', label: 'Workspace name', child: 'in_workspace' },
        { id: 'in_workspace', component: 'TextField', name: 'workspace', required: true, value: { path: '/settings/workspace' } },
        { id: 'toggles', component: 'Column', gap: 'sm', children: ['sw_notify', 'sw_weekly', 'sw_twofa'] },
        { id: 'sw_notify', component: 'Switch', name: 'notify', label: 'Product announcements', checked: { path: '/settings/notify' } },
        { id: 'sw_weekly', component: 'Switch', name: 'weekly', label: 'Weekly digest email', checked: { path: '/settings/weekly' } },
        { id: 'sw_twofa', component: 'Switch', name: 'twofa', label: 'Require two-factor sign-in', checked: { path: '/settings/twofa' } },
        { id: 'f_plan', component: 'Field', label: 'Plan', child: 'in_plan' },
        {
          id: 'in_plan', component: 'Select', name: 'plan', value: { path: '/settings/plan' },
          children: ['opt_free', 'opt_pro', 'opt_scale'],
        },
        { id: 'opt_free', component: 'Option', value: 'free', label: 'Free' },
        { id: 'opt_pro', component: 'Option', value: 'pro', label: 'Pro' },
        { id: 'opt_scale', component: 'Option', value: 'scale', label: 'Scale' },
        { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_save'] },
        { id: 'btn_save', component: 'Button', variant: 'solid', label: 'Save settings', action: { action: 'save_settings', submit: true } },
      ],
    },
  },
]

// ── P2 — confirmation card with a destructive action: action NAMES are the contract ──────────────────────────
// Works with today's catalog (no form). Two Buttons carry two intents by their action NAME: `confirm_delete`
// vs `cancel`. The confirm sets `wantResponse: true` — the client registers a correlation slot and the reply
// (whether the delete happened) is the SERVER's to send. No danger Button tone exists in the fleet, so the
// destructive weight is carried by wording + a solid/soft variant contrast; the tone gap is noted honestly.
const CONFIRM_ID = 'pattern-confirm'
const confirmMessages: readonly A2uiServerMessage[] = [
  { version: 'v1.0', createSurface: { surfaceId: CONFIRM_ID, catalogId: 'agent-ui' } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: CONFIRM_ID,
      components: [
        { id: 'root', component: 'Card', elevation: '1', children: ['col'] },
        { id: 'col', component: 'Column', gap: 'md', children: ['title', 'body', 'actions'] },
        { id: 'title', component: 'Text', variant: 'h4', text: 'Delete workspace?' },
        {
          id: 'body', component: 'Text', variant: 'body',
          text: 'This permanently deletes “Reactive Labs” and all 42 projects, boards, and files. This cannot be undone.',
        },
        { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_cancel', 'btn_delete'] },
        { id: 'btn_cancel', component: 'Button', variant: 'soft', label: 'Cancel', action: { action: 'cancel' } },
        { id: 'btn_delete', component: 'Button', variant: 'solid', label: 'Delete workspace', action: { action: 'confirm_delete', wantResponse: true } },
      ],
    },
  },
]

// ── P3 — wizard / stepper via bindable Tabs: `selected` is client state that rides the data model ────────────
// Staged data entry across three Tab panels. The catalog's Tab rows carry no `value`, so `selected` addresses
// tabs by INDEX ('0'|'1'|'2') and two-way-binds to /wizard/step — the client tracks which step the user is on
// with NO server round-trip. Fields across every panel two-way-bind under /wizard/*; the final panel's submit
// (gated by the FormProvider) emits ONE action carrying the whole aggregate, step included.
const WIZARD_ID = 'pattern-wizard'
const wizardMessages: readonly A2uiServerMessage[] = [
  { version: 'v1.0', createSurface: { surfaceId: WIZARD_ID, catalogId: 'agent-ui', sendDataModel: true } },
  {
    version: 'v1.0',
    updateDataModel: {
      surfaceId: WIZARD_ID,
      value: { wizard: { step: '0', email: 'ada@example.com', workspace: 'Reactive Labs', size: '11-50' } },
    },
  },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: WIZARD_ID,
      components: [
        { id: 'root', component: 'Card', elevation: '1', children: ['form'] },
        { id: 'form', component: 'FormProvider', children: ['tabs'] },
        {
          id: 'tabs', component: 'Tabs', selected: { path: '/wizard/step' },
          children: ['tab0', 'tab1', 'tab2', 'panel0', 'panel1', 'panel2'],
        },
        { id: 'tab0', component: 'Tab', children: ['tl0'] },
        { id: 'tl0', component: 'Text', variant: 'body', text: 'Account' },
        { id: 'tab1', component: 'Tab', children: ['tl1'] },
        { id: 'tl1', component: 'Text', variant: 'body', text: 'Workspace' },
        { id: 'tab2', component: 'Tab', children: ['tl2'] },
        { id: 'tl2', component: 'Text', variant: 'body', text: 'Review' },
        { id: 'panel0', component: 'TabPanel', children: ['f_email'] },
        { id: 'f_email', component: 'Field', label: 'Work email', child: 'in_email' },
        { id: 'in_email', component: 'TextField', name: 'email', type: 'email', value: { path: '/wizard/email' } },
        { id: 'panel1', component: 'TabPanel', children: ['f_ws'] },
        { id: 'f_ws', component: 'Field', label: 'Workspace name', child: 'in_ws' },
        { id: 'in_ws', component: 'TextField', name: 'workspace', required: true, value: { path: '/wizard/workspace' } },
        { id: 'panel2', component: 'TabPanel', children: ['review_col'] },
        { id: 'review_col', component: 'Column', gap: 'md', children: ['f_size', 'actions'] },
        { id: 'f_size', component: 'Field', label: 'Team size', child: 'in_size' },
        {
          id: 'in_size', component: 'Select', name: 'size', value: { path: '/wizard/size' },
          children: ['sz1', 'sz2', 'sz3'],
        },
        { id: 'sz1', component: 'Option', value: '1-10', label: '1–10 people' },
        { id: 'sz2', component: 'Option', value: '11-50', label: '11–50 people' },
        { id: 'sz3', component: 'Option', value: '51+', label: '51+ people' },
        { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_finish'] },
        { id: 'btn_finish', component: 'Button', variant: 'solid', label: 'Create workspace', action: { action: 'create_workspace', submit: true } },
      ],
    },
  },
]

// ── P4 — dashboard tiles: a display-only list template over /metrics with `${…}` label composition ───────────
// The cheapest surface an agent emits: ONE data array + ONE template Card. The Row's `children` is the v1.0
// template `{ path: '/metrics', componentId: 'tile' }` — one Card per element, positionally. Each tile's value
// and delta are `${…}` DynamicString templates that COMPOSE a label from relative item paths (value + unit,
// delta + a literal run) rather than binding a single path. No interaction, no data round-trip.
const DASH_ID = 'pattern-dashboard'
const dashMessages: readonly A2uiServerMessage[] = [
  { version: 'v1.0', createSurface: { surfaceId: DASH_ID, catalogId: 'agent-ui' } },
  {
    version: 'v1.0',
    updateDataModel: {
      surfaceId: DASH_ID,
      value: {
        metrics: [
          { label: 'Revenue', value: '128.4', unit: 'k€', delta: '+12%' },
          { label: 'Active users', value: '8,204', unit: '', delta: '+3.1%' },
          { label: 'Churn', value: '1.8', unit: '%', delta: '−0.4%' },
        ],
      },
    },
  },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: DASH_ID,
      components: [
        { id: 'root', component: 'Row', gap: 'md', wrap: true, children: { path: '/metrics', componentId: 'tile' } },
        { id: 'tile', component: 'Card', elevation: '1', children: ['tile_col'] },
        { id: 'tile_col', component: 'Column', gap: 'xs', children: ['tile_label', 'tile_value', 'tile_delta'] },
        { id: 'tile_label', component: 'Text', variant: 'caption', text: { path: 'label' } },
        // Two ${…} TEMPLATES over relative item paths — the agent composes each label from data.
        { id: 'tile_value', component: 'Text', variant: 'h3', text: '${value}${unit}' },
        { id: 'tile_delta', component: 'Text', variant: 'caption', text: '${delta} vs last month' },
      ],
    },
  },
]

// ── P5 — schedule picker card: the Wave-5 date/time reach through the catalog ─────────────────────────────────
// TextField `type=date` + `type=time` come through the catalog's 12-value type enum; `type=date` opens a calendar
// overlay inside the control (no renderer/catalog involvement). The values in the model are ISO-canonical (a
// `YYYY-MM-DD` date, an `HH:MM` time, an IANA time zone) while the control renders a localized display — the
// aggregate the action carries is the wire-portable ISO form (createSurface sets sendDataModel).
//
// Deliberately NOT wrapped in a FormProvider (unlike P1/P3): a `type=date` field nested in a ui-form-provider
// currently triggers a component-side reactive write-loop (the field's hidden ui-calendar, a UIFormElement, is
// discovered as a SECOND provider member and the calendar↔field↔provider aggregation fails to converge — a2ui-
// form-catalog-examples wave, flagged to the coordinator for the components backlog). P5's lesson is the date/
// time reach + ISO-canonical values, which needs no provider; the gated-form idiom is already P1's and P3's.
const SCHEDULE_ID = 'pattern-schedule'
const scheduleMessages: readonly A2uiServerMessage[] = [
  { version: 'v1.0', createSurface: { surfaceId: SCHEDULE_ID, catalogId: 'agent-ui', sendDataModel: true } },
  {
    version: 'v1.0',
    updateDataModel: {
      surfaceId: SCHEDULE_ID,
      value: { schedule: { date: '2026-07-15', time: '09:30', tz: 'Europe/Helsinki' } },
    },
  },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: SCHEDULE_ID,
      components: [
        { id: 'root', component: 'Card', elevation: '1', children: ['col'] },
        { id: 'col', component: 'Column', gap: 'md', children: ['title', 'f_date', 'f_time', 'f_tz', 'actions'] },
        { id: 'title', component: 'Text', variant: 'h4', text: 'Schedule a call' },
        { id: 'f_date', component: 'Field', label: 'Date', child: 'in_date' },
        { id: 'in_date', component: 'TextField', name: 'date', type: 'date', value: { path: '/schedule/date' } },
        { id: 'f_time', component: 'Field', label: 'Time', child: 'in_time' },
        { id: 'in_time', component: 'TextField', name: 'time', type: 'time', value: { path: '/schedule/time' } },
        { id: 'f_tz', component: 'Field', label: 'Time zone', child: 'in_tz' },
        {
          id: 'in_tz', component: 'Select', name: 'tz', value: { path: '/schedule/tz' },
          children: ['tz_hel', 'tz_lon', 'tz_nyc'],
        },
        { id: 'tz_hel', component: 'Option', value: 'Europe/Helsinki', label: 'Helsinki (EET)' },
        { id: 'tz_lon', component: 'Option', value: 'Europe/London', label: 'London (GMT)' },
        { id: 'tz_nyc', component: 'Option', value: 'America/New_York', label: 'New York (EST)' },
        { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_schedule'] },
        { id: 'btn_schedule', component: 'Button', variant: 'solid', label: 'Schedule', action: { action: 'schedule_call' } },
      ],
    },
  },
]

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
    messages: settingsMessages,
    surfaceId: SETTINGS_ID,
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
    messages: confirmMessages,
    surfaceId: CONFIRM_ID,
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
    messages: wizardMessages,
    surfaceId: WIZARD_ID,
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
    messages: dashMessages,
    surfaceId: DASH_ID,
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
    messages: scheduleMessages,
    surfaceId: SCHEDULE_ID,
    interactive: true,
    hint:
      'Open the date field (a calendar), pick a day, set a time, choose a zone, then press “Schedule” — the action carries the ISO /schedule aggregate the server would store.',
  }),
)
