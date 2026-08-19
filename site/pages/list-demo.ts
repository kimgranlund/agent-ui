// site/pages/list-demo.ts — the ui-list interaction demo (the ratified layout `demo`; pairs with list-doc.html,
// the API page). Mounts the REAL semantic stack (role="list" via ElementInternals — the host carries no role
// attribute) as a contact list of real rows (avatar · name/email · role badge · action) and lets the reader flip
// its live props — gap / align / justify / wrap — with real ui-button knobs; the knob log records every attribute
// write (list.md `events: []` — a layout primitive's whole contract is attribute-in → layout-out). Each item is a
// `role="listitem"` child, the semantics the list leaves to its children by design. list.css owns the mechanics.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log · .demo-box)
import { applyDemoWidth, captioned, demoBox, el, exampleSection, uiButton } from '../lib/specimens.ts'
import { booleanKnob, enumKnob, knobLog } from '../lib/layout-demo-knobs.ts'

const { content } = mountPage({
  title: 'ui-list — demo',
  intro: 'The semantic vertical stack, live. A contact list of real rows and a bordered settings list are laid ' +
    'out by real ui-list instances (role="list" through ElementInternals, each child a listitem); the knobs flip ' +
    'gap / align / justify / wrap and the log records every attribute write. The API table is on the ui-list API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── scenario 1: a contact list — each item a listitem row: avatar · name + email · role badge · action ─────
interface Contact { readonly name: string; readonly email: string; readonly role: string; readonly intent: string }
const contacts: readonly Contact[] = [
  { name: 'Ada Lindqvist', email: 'ada@northwind.example', role: 'Owner', intent: 'success' },
  { name: 'Tomas Berg', email: 'tomas@northwind.example', role: 'Admin', intent: 'info' },
  { name: 'Priya Natarajan', email: 'priya@northwind.example', role: 'Member', intent: 'neutral' },
  { name: 'Jonas Weber', email: 'jonas@northwind.example', role: 'Invited', intent: 'warning' },
]
const contactItem = (c: Contact): HTMLElement =>
  el('ui-row', { role: 'listitem', gap: 'md', align: 'center', elevation: '1' }, [
    el('ui-avatar', { identity: c.name, label: c.name, size: 'sm' }),
    el('ui-column', { gap: 'none' }, [
      el('ui-text', { variant: 'label' }, [text(c.name)]),
      el('ui-text', { variant: 'body', size: 'sm' }, [text(c.email)]),
    ]),
    el('ui-badge', { intent: c.intent, label: c.role }),
    uiButton('Message', 'ghost'),
  ])
const contactList = el('ui-list', { gap: 'sm' }, contacts.map(contactItem))
applyDemoWidth(contactList, '32rem')

// ── scenario 2: a settings list — plain listitems inside one elevated list surface ─────────────────────────
const settingItem = (label: string, value: string): HTMLElement =>
  el('ui-row', { role: 'listitem', gap: 'md', align: 'center', justify: 'between' }, [
    el('ui-text', { variant: 'body' }, [text(label)]),
    el('ui-text', { variant: 'label' }, [text(value)]),
  ])
const settingsList = el('ui-list', { gap: 'sm', elevation: '1' }, [
  settingItem('Workspace', 'Northwind'),
  settingItem('Region', 'eu-north-1'),
  settingItem('Retention', '90 days'),
  settingItem('SSO', 'Enabled'),
])
applyDemoWidth(settingsList, '24rem')

// The knobs drive BOTH lists so one flip shows the same prop on two compositions.
const targets = [contactList, settingsList]
const log = knobLog()
const knobs = el('ui-column', { gap: 'sm' }, [
  enumKnob(targets, 'gap', ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'], log),
  enumKnob(targets, 'align', ['stretch', 'start', 'center', 'end', 'baseline'], log),
  enumKnob(targets, 'justify', ['start', 'center', 'end', 'between', 'around', 'evenly'], log),
  booleanKnob(targets, 'wrap', log),
])

const semanticsNote = el('p', {}, [
  text('ui-list is a ui-column that announces itself as a '), code('list'), text(' — the role is set through '),
  strong('ElementInternals'), text(', so the host carries no '), code('role'),
  text(' attribute (inspect it). Each child above sets its own '), code('role="listitem"'),
  text(': the list never imposes an item element. Reach for ui-list when the items share one semantic role; ' +
    'for a plain stack, ui-column.'),
])

// ── the axis specimens — align × justify at a glance ─────────────────────────────────────────────────────────
const alignGrid = el('div', { class: 'demo-grid' }, ['stretch', 'start', 'center', 'end'].map((v) =>
  captioned(`align="${v}"`, el('ui-list', { gap: 'xs', align: v }, [
    el('div', { role: 'listitem', class: 'demo-box' }, [text('short')]),
    el('div', { role: 'listitem', class: 'demo-box' }, [text('a longer list item')]),
    el('div', { role: 'listitem', class: 'demo-box' }, [text('mid')]),
  ])),
))
const justifyGrid = el('div', { class: 'demo-grid' }, ['start', 'center', 'end', 'between'].map((v) =>
  captioned(`justify="${v}"`, el('ui-list', { gap: 'xs', justify: v, style: 'min-block-size: 10rem' }, [
    el('div', { role: 'listitem', class: 'demo-box' }, [text('A')]),
    el('div', { role: 'listitem', class: 'demo-box' }, [text('B')]),
  ])),
))

content.append(
  exampleSection('Contact list', contactList),
  exampleSection('Settings list', settingsList),
  exampleSection('Knobs', el('p', {}, [text('Each knob writes the attribute on both lists above; the active value is solid.')]), knobs),
  exampleSection('Knob log', log.list),
  exampleSection('Semantics', semanticsNote, demoBox('The host: role=list via internals; children: role=listitem')),
  exampleSection('align', alignGrid),
  exampleSection('justify', justifyGrid),
)
