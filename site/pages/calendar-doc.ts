// site/pages/calendar-doc.ts — the ui-calendar API doc page (Wave 5B-1, ADR-0048). DERIVED from `calendar.md` via
// the shared doc-page.ts renderer (composeDocPage): the attribute / properties / events / slots tables are read
// straight from the descriptor the contract trip-wire validates, so they cannot drift. Two LIVE specimens sit
// between the tables and the prose — a plain seeded picker and a min/max-constrained one — mounting the real
// form control; the value round-trip in a <form> + the change/select log is on the calendar demo page.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadCalendarDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadCalendarDoc()

const { content } = mountPage({
  title: 'ui-calendar — API',
  intro: 'The standalone month-grid date picker — a FACE form control contributing an ISO YYYY-MM-DD value. ' +
    'Keyboard: Arrow ±1/±7, Home/End week-start/-end, PageUp/Down ±month, Enter/Space commit. Generated from ' +
    'calendar.md (descriptor-derived tables). See the calendar demo for the live form round-trip + event log.',
})

// ── live specimens (real <ui-calendar>s, placed between the tables and the prose) ─────────────────────────────
// A seeded picker, and a second one whose min/max clamp the selectable range so the out-of-range (aria-disabled)
// cells show. Attributes are the author surface — value/min/max all reflect, so setAttribute drives the same
// selection + range styling as author-set markup.
const specimen = el('ui-calendar', { name: 'specimen-date', value: '2026-07-15' })
const rangeEl = el('ui-calendar', { name: 'range-date', value: '2026-07-10', min: '2026-07-01', max: '2026-07-15' })

const specimens = document.createElement('div')
specimens.append(
  exampleSection('Live specimen', specimen),
  exampleSection('Range constraint (min = 1st · max = 15th)', rangeEl),
)

composeDocPage(content, descriptor, body, specimens)
