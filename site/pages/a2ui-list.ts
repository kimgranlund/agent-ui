// a2ui-list.ts — the A2UI DYNAMIC-LIST page. The headline of the renderer's v1.0 list capability (ADR-0024):
// a container whose `children` is a TEMPLATE — `{ path, componentId }` over a data array — instead of a static
// `string[]`. The renderer instantiates one item per array element, POSITIONALLY (index-based, no per-item key).
// Inside the template a RELATIVE binding resolves to `{path}/{index}/…` (read AND write, so interactive items
// round-trip); an ABSOLUTE binding resolves from the data root. CONTAINER templates render their whole subtree
// (a Card / Row per item, with descendants); NESTED lists compose (a relative template path inside an item).
//
// Like the A2UI canvas, this page feeds VALID A2UI v1.0 messages through the REAL @agent-ui/a2ui renderer host
// (`createRenderer`) via its public surface — the exact path the server transport would. Nothing reaches into
// renderer internals. Each demo shows, side by side, the streamed PAYLOAD (its data model + its components, the
// two halves the agent emits) and the LIVE rendered surface that payload produces. The displayed JSON is derived
// from the SAME message objects fed to the renderer, so the shown input and the fed input can never drift.
//
// Demos, in order of value: (1) a leaf display list; (2) a CONTAINER template (a Card subtree per item); (3) an
// INTERACTIVE list whose edits round-trip into the data model (proven by an `action` carrying the live
// `dataModel`); (4) a NESTED list (a template whose items hold their own template).

import { mountPage } from './_page.ts' // FIRST import — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './a2ui-list.css' // page-local layout chrome only (the demo grid + the live-surface frame + the log)
import { codeBlock } from '../lib/code-block.ts' // shared <pre><code> previews (textContent, no injection)
import { createRenderer } from '@agent-ui/a2ui'
import type { A2uiServerMessage, A2uiClientMessage, A2uiComponent } from '@agent-ui/a2ui'

const { content } = mountPage({
  title: 'A2UI dynamic list',
  intro:
    'A2UI v1.0 lets a container bind its children to a data array: `children: { path, componentId }` renders one ' +
    'instance of the template component per element, positionally. Relative bindings inside the template resolve ' +
    'to that element; container templates render a whole subtree; nested lists compose. Each demo below feeds a ' +
    'real A2UI payload through the same renderer the canvas uses — the live surface is the renderer’s output.',
})

// ── payload extractors — read the data model + the component set straight off the fed messages (no drift) ─────
// The two halves an agent streams for a list: the data MODEL (the array the template iterates) and the COMPONENTS
// (where the `children` template lives). Both are pulled from the SAME A2uiServerMessage[] handed to the renderer.
function dataModelOf(messages: readonly A2uiServerMessage[]): unknown {
  for (const m of messages) if ('updateDataModel' in m) return m.updateDataModel.value
  return undefined
}
function componentsOf(messages: readonly A2uiServerMessage[]): A2uiComponent[] {
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

/**
 * demoSection — one captioned dynamic-list demo: a heading + blurb, then a two-pane grid of [payload | output].
 * The payload pane shows the data model + the components (the template lives in `children`); the output pane
 * mounts the LIVE renderer surface the payload produces. `interactive` adds a client→server message log so the
 * round-trip demo can show the `action` (with its `dataModel`) the edited surface emits.
 */
function demoSection(opts: {
  step: string
  title: string
  blurb: string
  messages: readonly A2uiServerMessage[]
  surfaceId: string
  interactive?: boolean
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
  payloadPane.append(
    codeFigure('Data model', dataModelOf(opts.messages)),
    codeFigure(
      sendsDataModel(opts.messages) ? 'Components (createSurface sendDataModel: true)' : 'Components',
      componentsOf(opts.messages),
    ),
  )

  // RIGHT — the live rendered surface (the real renderer's output), plus the round-trip log when interactive.
  const outputPane = document.createElement('div')
  outputPane.className = 'output-pane'
  const surfaceEl = document.createElement('div')
  surfaceEl.className = 'surface'
  outputPane.append(surfaceEl)

  let appendLog: ((message: A2uiClientMessage) => void) | undefined
  if (opts.interactive) {
    const hint = document.createElement('p')
    hint.className = 'demo-hint'
    hint.textContent = 'Edit a field, then press “Send to agent”. The action below carries the live data model — the edits round-tripped through the relative paths.'
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
  section.append(heading, blurb, grid)
  return section
}

// ── demo 1 — display list: a leaf Text template over /tags (one ui-text per element, text from a relative path) ─
const DISPLAY_ID = 'list-display'
const displayMessages: readonly A2uiServerMessage[] = [
  { version: 'v1.0', createSurface: { surfaceId: DISPLAY_ID, catalogId: 'agent-ui' } },
  {
    version: 'v1.0',
    updateDataModel: {
      surfaceId: DISPLAY_ID,
      value: { tags: [{ name: 'signals' }, { name: 'web-components' }, { name: 'zero-dep' }, { name: 'A2UI' }] },
    },
  },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: DISPLAY_ID,
      components: [
        { id: 'root', component: 'Row', gap: 'md', wrap: true, children: { path: '/tags', componentId: 'tag_chip' } },
        { id: 'tag_chip', component: 'Text', variant: 'body', text: { path: 'name' } },
      ],
    },
  },
]

// ── demo 2 — container template: a Card subtree per /people element, descendants bound to relative paths ──────
const PEOPLE_ID = 'list-people'
const peopleMessages: readonly A2uiServerMessage[] = [
  { version: 'v1.0', createSurface: { surfaceId: PEOPLE_ID, catalogId: 'agent-ui' } },
  {
    version: 'v1.0',
    updateDataModel: {
      surfaceId: PEOPLE_ID,
      value: {
        people: [
          { name: 'Ada Lovelace', role: 'Engineer' },
          { name: 'Grace Hopper', role: 'Architect' },
          { name: 'Lin Clark', role: 'Writer' },
        ],
      },
    },
  },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: PEOPLE_ID,
      components: [
        { id: 'root', component: 'Column', gap: 'md', children: { path: '/people', componentId: 'person_card' } },
        { id: 'person_card', component: 'Card', elevation: '1', children: ['person_row'] },
        { id: 'person_row', component: 'Row', gap: 'md', align: 'center', justify: 'between', children: ['person_name', 'person_role'] },
        { id: 'person_name', component: 'Text', variant: 'h5', text: { path: 'name' } },
        { id: 'person_role', component: 'Text', variant: 'caption', text: { path: 'role' } },
      ],
    },
  },
]

// ── demo 3 — interactive list: TextField items whose edits round-trip; an action carries the live data model ──
const FORM_ID = 'list-form'
const formMessages: readonly A2uiServerMessage[] = [
  { version: 'v1.0', createSurface: { surfaceId: FORM_ID, catalogId: 'agent-ui', sendDataModel: true } },
  {
    version: 'v1.0',
    updateDataModel: {
      surfaceId: FORM_ID,
      value: {
        fields: [
          { label: 'First name', value: 'Ada' },
          { label: 'Last name', value: 'Lovelace' },
        ],
      },
    },
  },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: FORM_ID,
      components: [
        { id: 'root', component: 'Column', gap: 'md', children: ['fields_col', 'send_btn'] },
        { id: 'fields_col', component: 'Column', gap: 'sm', children: { path: '/fields', componentId: 'field_input' } },
        { id: 'field_input', component: 'TextField', label: { path: 'label' }, value: { path: 'value' } },
        { id: 'send_btn', component: 'Button', variant: 'solid', label: 'Send to agent', action: { action: 'submit' } },
      ],
    },
  },
]

// ── demo 4 — nested list: a template whose items hold their own (relative-path) template ──────────────────────
const NESTED_ID = 'list-nested'
const nestedMessages: readonly A2uiServerMessage[] = [
  { version: 'v1.0', createSurface: { surfaceId: NESTED_ID, catalogId: 'agent-ui' } },
  {
    version: 'v1.0',
    updateDataModel: {
      surfaceId: NESTED_ID,
      value: {
        sections: [
          { title: 'Fruit', items: [{ name: 'Apple' }, { name: 'Pear' }] },
          { title: 'Reactive primitives', items: [{ name: 'signal' }, { name: 'effect' }, { name: 'scope' }] },
        ],
      },
    },
  },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: NESTED_ID,
      components: [
        { id: 'root', component: 'Column', gap: 'md', children: { path: '/sections', componentId: 'section_card' } },
        { id: 'section_card', component: 'Card', elevation: '1', children: ['section_col'] },
        { id: 'section_col', component: 'Column', gap: 'sm', children: ['section_title', 'items_row'] },
        { id: 'section_title', component: 'Text', variant: 'h4', text: { path: 'title' } },
        // A RELATIVE template path ('items', no leading slash) → /sections/{i}/items — the inner list.
        { id: 'items_row', component: 'Row', gap: 'md', wrap: true, children: { path: 'items', componentId: 'item_chip' } },
        { id: 'item_chip', component: 'Text', variant: 'body', text: { path: 'name' } },
      ],
    },
  },
]

content.append(
  demoSection({
    step: '1',
    title: 'Display list',
    blurb:
      'A Row whose children is a template over /tags. The renderer renders one ui-text per array element, each bound to the relative path “name” — i.e. /tags/{index}/name. Add an element to the array and an item appears, positionally.',
    messages: displayMessages,
    surfaceId: DISPLAY_ID,
  }),
  demoSection({
    step: '2',
    title: 'Container template — a subtree per item',
    blurb:
      'The template componentId is a Card, not a leaf. Each /people element renders the Card’s whole subtree — a Row with a name (ui-text h5) and a role (ui-text caption) — every descendant binding resolved relative to that element (/people/{index}/name, /role).',
    messages: peopleMessages,
    surfaceId: PEOPLE_ID,
  }),
  demoSection({
    step: '3',
    title: 'Interactive items round-trip',
    blurb:
      'Each /fields element renders a ui-text-field bound to a relative value. A relative path resolves the same pointer for READ and WRITE, so committing an edit writes back to /fields/{index}/value. Press “Send to agent” to emit an action carrying the live data model — your edits are in it.',
    messages: formMessages,
    surfaceId: FORM_ID,
    interactive: true,
  }),
  demoSection({
    step: '4',
    title: 'Nested lists compose',
    blurb:
      'A list item is itself a container whose children is a template. The inner template path is relative (“items”), so it resolves under the outer element — /sections/{i}/items/{j}/name. Each section card carries its own independently-sized list.',
    messages: nestedMessages,
    surfaceId: NESTED_ID,
  }),
)
