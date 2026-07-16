// site/pages/choosing.ts — "which component when": the human-facing version of the A2UI catalog's §5.2
// usage-guidance rows. The report/content/feed/layout guidance below is CONDENSED/ADAPTED from
// .claude/docs/specs/specs/a2ui-catalog.spec.md §5.2 (cited inline; the spec is the canonical ruling, this
// page is its second reader — group intros carry the spec's own one-line rule verbatim where one exists,
// e.g. the report four-way; the per-row `rule` cells are this page's condensation of the per-type Notes,
// not quotes). The forms/overlays groupings have no single spec row at all; they are HAND-AUTHORED, derived
// from the fleet's own tier structure (form-associated controls; the overlay-controller family) and flagged
// as such — the T6 soft-staleness case docs-author's method names.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './choosing.css'
import { heading } from '../lib/doc-page.ts'
import { el } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'Which component when',
  intro:
    'A quick chooser between components that overlap in purpose — condensed from the A2UI catalog’s own §5.2 ' +
    'usage-guidance rows (the rulings an agent is taught), read here for a human picking a component by hand.',
})

content.append(
  pageLead(
    'Each row below names the fork and the rule that resolves it. Groups marked “catalog spec” are condensed ' +
      'from a2ui-catalog.spec.md §5.2 (the group intro quotes the spec’s own one-line rule where one exists; ' +
      'the per-row rules are this page’s condensation of the per-type notes); groups marked “fleet grouping” ' +
      'have no single spec row and are this page’s own synthesis over the tier structure.',
  ),
)

interface Choice {
  readonly when: string
  readonly pick: string
  readonly rule: string
  readonly specimen?: () => HTMLElement
}
interface ChoiceGroup {
  readonly title: string
  readonly source: 'catalog spec' | 'fleet grouping'
  readonly intro: string
  readonly choices: readonly Choice[]
}

function miniStat(): HTMLElement {
  const stat = document.createElement('ui-stat')
  stat.setAttribute('label', 'Revenue')
  stat.setAttribute('figure', '48200')
  stat.setAttribute('delta', '4.2')
  return stat
}
function miniSparkline(): HTMLElement {
  const s = document.createElement('ui-sparkline')
  s.setAttribute('label', 'Trend')
  s.setAttribute('values', JSON.stringify([4, 7, 5, 9, 12, 10, 14]))
  return s
}
function miniBarChart(): HTMLElement {
  const b = document.createElement('ui-bar-chart')
  b.setAttribute('label', 'By region')
  b.setAttribute('data', JSON.stringify([{ label: 'East', value: 32 }, { label: 'West', value: 21 }]))
  return b
}
function miniTable(): HTMLElement {
  const t = document.createElement('ui-table')
  t.setAttribute('label', 'Orders')
  t.setAttribute('columns', JSON.stringify([{ key: 'id', label: 'ID' }, { key: 'total', label: 'Total', type: 'number' }]))
  t.setAttribute('rows', JSON.stringify([{ id: '1024', total: 88 }]))
  return t
}
function miniCode(): HTMLElement {
  const c = document.createElement('ui-code')
  c.setAttribute('language', 'ts')
  c.textContent = "const x = 1"
  return c
}
function miniDisclosure(): HTMLElement {
  const d = document.createElement('ui-disclosure')
  d.setAttribute('summary', 'Details')
  d.append(document.createTextNode('The folded body.'))
  return d
}
function miniLink(): HTMLElement {
  const t = document.createElement('ui-text')
  t.setAttribute('as', 'a')
  t.setAttribute('href', 'https://example.com')
  t.textContent = 'a source link'
  return t
}
function miniAvatar(): HTMLElement {
  const a = document.createElement('ui-avatar')
  a.setAttribute('identity', 'Ada Lovelace')
  a.setAttribute('size', 'sm')
  return a
}
function miniProgress(): HTMLElement {
  const p = document.createElement('ui-progress')
  p.setAttribute('label', 'Uploading')
  p.setAttribute('current', '60')
  return p
}
function miniAttachment(): HTMLElement {
  const a = document.createElement('ui-attachment')
  a.setAttribute('name', 'report.pdf')
  a.setAttribute('mimeType', 'application/pdf')
  a.setAttribute('sizeBytes', '204800')
  return a
}

const GROUPS: readonly ChoiceGroup[] = [
  {
    title: 'Reporting a number',
    source: 'catalog spec',
    intro:
      'a2ui-catalog.spec.md §5.2 (ADR-0107 cl.6 / ADR-0111 cl.6), the four-way rule verbatim: “Stat for a ' +
      'latest value · Sparkline for the shape of a series · BarChart for comparing magnitudes · Table when ' +
      'exact values must be scanned row-by-row.”',
    choices: [
      { when: 'a latest single value', pick: 'ui-stat', rule: 'A metric tile — label/value/delta/caption.', specimen: miniStat },
      { when: 'the shape of a series over time', pick: 'ui-sparkline', rule: 'A trend line/area, no axes — shape, not exact values.', specimen: miniSparkline },
      { when: 'comparing magnitudes across categories', pick: 'ui-bar-chart', rule: 'All-positive or mixed-sign diverging bars.', specimen: miniBarChart },
      { when: 'exact values scanned row-by-row', pick: 'ui-table', rule: 'A real native table — typed columns + record rows.', specimen: miniTable },
    ],
  },
  {
    title: 'Content and prose',
    source: 'catalog spec',
    intro: 'a2ui-catalog.spec.md §5.2 (ADR-0113 cl.5).',
    choices: [
      { when: 'prose', pick: 'ui-text', rule: 'The Display-class text primitive — never for emphasis-as-a-hack.' },
      { when: 'verbatim / preformatted output', pick: 'ui-code', rule: 'Mono, whitespace-preserved — never used for emphasis.', specimen: miniCode },
      { when: 'progressive detail', pick: 'ui-disclosure', rule: 'Never hides the primary answer or a required control.', specimen: miniDisclosure },
      { when: 'a source or reference', pick: 'ui-text with an href', rule: 'https links only — never bare navigation-as-action (actions are ui-buttons).', specimen: miniLink },
    ],
  },
  {
    title: 'Feed and activity',
    source: 'catalog spec',
    intro: 'a2ui-catalog.spec.md §5.2 (ADR-0112 cl.6) — Avatar / Progress / Attachment, plus the TaskState pairing.',
    choices: [
      { when: 'who acted', pick: 'ui-avatar', rule: 'Beside a name, decorative.', specimen: miniAvatar },
      { when: 'how far along', pick: 'ui-progress', rule: 'Indeterminate unless a real fraction exists.', specimen: miniProgress },
      { when: 'what was produced', pick: 'ui-attachment', rule: 'Never a hand-built icon + text card.', specimen: miniAttachment },
    ],
  },
  {
    title: 'Arranging children',
    source: 'catalog spec',
    intro: 'a2ui-catalog.spec.md §5.2 (ADR-0087 Fork A) — Row/Column vs List vs Grid.',
    choices: [
      { when: 'a deliberate, heterogeneous arrangement (a toolbar, a field stack)', pick: 'ui-row / ui-column', rule: 'The general flex-grammar primitives.' },
      { when: 'a homogeneous, itemized collection (search results, a feed)', pick: 'ui-list', rule: 'A Column specialization carrying role=list for free.' },
      { when: 'a reflowing tile layout (a card gallery, a dashboard)', pick: 'ui-grid', rule: 'The auto-fit/minmax() track model — column count reflows with width.' },
    ],
  },
  {
    title: 'Collecting input',
    source: 'fleet grouping',
    intro: 'No single §5.2 row covers the whole form-control family; grouped here by the fleet’s own tier structure.',
    choices: [
      { when: 'free text / typed values (email, currency, unit, percent, date, time)', pick: 'ui-text-field', rule: 'One control, twelve types — never a bespoke input for a typed value the field already codecs.' },
      { when: 'one choice from a short, always-visible set', pick: 'ui-radio-group', rule: 'Every option visible at once; roving keyboard.' },
      { when: 'one choice from a longer or dynamic list', pick: 'ui-select', rule: 'Overlay listbox; form-associated value.' },
      { when: 'free-text filtering over a list of options', pick: 'ui-combo-box', rule: 'Editable text + filtered options — never fake it with a select + JS filter.' },
      { when: 'a single on/off toggle taking effect immediately', pick: 'ui-switch', rule: 'An immediate-effect setting — not a form field awaiting submit.' },
      { when: 'a single yes/no bound to a submitted value', pick: 'ui-checkbox', rule: 'Tri-state, form-associated — the submit-awaiting case switch is not.' },
      { when: 'a calendar date', pick: 'ui-calendar', rule: 'A bespoke 2D grid — never a text-field faking date entry.' },
    ],
  },
  {
    title: 'Layering a transient surface',
    source: 'fleet grouping',
    intro: 'The overlay-controller family (ADR-0043) shares one mechanism; grouped here by disclosure intent.',
    choices: [
      { when: 'a click-triggered panel the user dismisses', pick: 'ui-popover', rule: 'Escape / outside-click dismiss; focus returns to the anchor.' },
      { when: 'a hover/focus description with no interactive content', pick: 'ui-tooltip', rule: 'Never steals focus; keyboard focus shows it immediately.' },
      { when: 'a list of commands to choose from', pick: 'ui-menu', rule: 'Arrow-rove + type-ahead; commits and closes.' },
      { when: 'a modal, page-blocking task', pick: 'ui-modal', rule: 'Native <dialog>; persistent vs dismissable is explicit.' },
    ],
  },
]

for (const group of GROUPS) {
  content.append(heading(2, group.title))
  content.append(el('p', { class: 'choosing-source' }, [document.createTextNode(`${group.intro} (${group.source})`)]))
  const table = document.createElement('table')
  table.className = 'choosing-table'
  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  for (const l of ['When you need…', 'Pick', 'Why', 'Specimen']) {
    const th = document.createElement('th')
    th.textContent = l
    headRow.append(th)
  }
  thead.append(headRow)
  const tbody = document.createElement('tbody')
  for (const choice of group.choices) {
    const tr = document.createElement('tr')
    const whenCell = document.createElement('td')
    whenCell.textContent = choice.when
    const pickCell = document.createElement('td')
    const pickCode = document.createElement('code')
    pickCode.textContent = choice.pick
    pickCell.append(pickCode)
    const ruleCell = document.createElement('td')
    ruleCell.textContent = choice.rule
    const specimenCell = document.createElement('td')
    specimenCell.className = 'choosing-specimen-cell'
    if (choice.specimen) specimenCell.append(choice.specimen())
    tr.append(whenCell, pickCell, ruleCell, specimenCell)
    tbody.append(tr)
  }
  table.append(thead, tbody)
  content.append(table)
}
