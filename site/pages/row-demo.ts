// site/pages/row-demo.ts — the ui-row interaction demo (the ratified layout `demo`; pairs with row-doc.html, the
// API page). Mounts the REAL horizontal primitive around a believable settings-form row and lets the reader flip
// its live props — gap / align / justify / wrap / reflow — with real ui-button knobs; a knob log proves every
// attribute write lands (a layout primitive emits no events — row.md `events: []` — so the log records the
// prop flips, the whole of its contract). The control owns all layout mechanics (row.css); this page only stages.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log · .demo-box · .reflow-frame)
import { captioned, demoBox, el, exampleSection, uiButton } from '../lib/specimens.ts'
import { booleanKnob, enumKnob, knobLog } from '../lib/layout-demo-knobs.ts'

const { content } = mountPage({
  title: 'ui-row — demo',
  intro: 'The horizontal layout primitive, live. A settings form row and an action bar are laid out by real ' +
    'ui-row instances; the knobs flip gap / align / justify / wrap / reflow on them and the log records every ' +
    'attribute write. The API table is on the ui-row API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── scenario 1: a settings form row — label · field · save/cancel, the everyday consumer of ui-row ────────
const settingsRow = el('ui-row', { gap: 'md', align: 'center' }, [
  el('ui-text', { variant: 'label' }, [text('Display name')]),
  el('ui-text-field', { label: 'Display name', value: 'Kim Granlund', placeholder: 'Your name' }),
  uiButton('Save', 'solid'),
  uiButton('Cancel', 'ghost'),
])

// ── scenario 2: an action bar — justify=between reads best with a leading title and trailing actions ──────
const actionBar = el('ui-row', { gap: 'sm', align: 'center', justify: 'between', elevation: '1' }, [
  el('ui-text', { variant: 'title' }, [text('Team members')]),
  el('ui-row', { gap: 'xs', align: 'center' }, [
    uiButton('Invite', 'soft'),
    uiButton('Export CSV', 'ghost'),
  ]),
])

// The knobs drive BOTH scenario rows so one flip shows the same prop on two compositions.
const targets = [settingsRow, actionBar]
const log = knobLog()
const knobs = el('ui-column', { gap: 'sm' }, [
  enumKnob(targets, 'gap', ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'], log),
  enumKnob(targets, 'align', ['start', 'center', 'end', 'stretch', 'baseline'], log),
  enumKnob(targets, 'justify', ['start', 'center', 'end', 'between', 'around', 'evenly'], log),
  booleanKnob(targets, 'wrap', log),
  enumKnob(targets, 'reflow', ['auto', 'locked'], log),
])

// ── scenario 3: the wrap + reflow story — a tag row that wraps, inside a resizable query container ─────────
const tags = ['design-system', 'a11y', 'tokens', 'layout', 'forms', 'agents', 'streaming', 'a2ui', 'router']
const tagRow = el('ui-row', { gap: 'xs', wrap: '', reflow: 'locked' }, tags.map((t) => demoBox(t)))
const wrapFrame = el('div', { class: 'reflow-frame' }, [tagRow])

const reflowRow = el('ui-row', { gap: 'sm', align: 'center' }, [
  demoBox('Avatar'),
  demoBox('Name + email'),
  demoBox('Role'),
  uiButton('Remove', 'ghost'),
])
const reflowFrame = el('div', { class: 'reflow-frame' }, [reflowRow])

const reflowNote = el('p', {}, [
  text('Drag either frame narrower. The tag row is '), code('wrap'), text(' + '), code('reflow="locked"'),
  text(': it stays a row and wraps its items onto new lines. The member row is '), code('reflow="auto"'),
  text(' (the default): under the '), strong('24rem container-query line'),
  text(' it stacks into a column — reflow on the ancestor container\'s width, never the viewport (ADR-0016 cl.4 / ADR-0096).'),
])

// ── the axis specimens — align × justify at a glance, each captioned with the attribute it demonstrates ────
const alignGrid = el('div', { class: 'demo-grid' }, ['start', 'center', 'end', 'stretch', 'baseline'].map((v) =>
  captioned(`align="${v}"`, el('ui-row', { gap: 'sm', align: v, style: 'min-block-size: 5rem' }, [
    demoBox('short'),
    el('div', { class: 'demo-box', style: 'min-block-size: 4rem' }, [text('tall')]),
    demoBox('short'),
  ])),
))
const justifyGrid = el('div', { class: 'demo-grid' }, ['start', 'center', 'end', 'between', 'around', 'evenly'].map((v) =>
  captioned(`justify="${v}"`, el('ui-row', { gap: 'sm', justify: v }, [demoBox('A'), demoBox('B'), demoBox('C')])),
))

content.append(
  exampleSection('Settings form row', settingsRow),
  exampleSection('Action bar', actionBar),
  exampleSection('Knobs', el('p', {}, [text('Each knob writes the attribute on both rows above; the active value is solid.')]), knobs),
  exampleSection('Knob log', log.list),
  exampleSection('Wrap & reflow', wrapFrame, reflowFrame, reflowNote),
  exampleSection('align', alignGrid),
  exampleSection('justify', justifyGrid),
)
