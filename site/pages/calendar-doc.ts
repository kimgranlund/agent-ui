// site/pages/calendar-doc.ts — the ui-calendar API doc page (Wave 5B-1, ADR-0048). DERIVED from `calendar.md` via
// the shared doc-page.ts renderer (the descriptor-derived tables cannot drift). A live calendar specimen shows
// the real form control; the value round-trip in a <form> + the change/select log is on the calendar demo page.
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

// ── live specimen — a calendar seeded to a recent date ───────────────────────────────────────

const specimenSection = exampleSection('Live specimen')

const specimen = document.createElement('ui-calendar') as HTMLElement & { value: string }
specimen.setAttribute('value', '2026-07-15')
specimen.setAttribute('name', 'specimen-date')
specimenSection.append(specimen)
content.append(specimenSection)

// ── descriptor-derived API tables ────────────────────────────────────────────────────────────

composeDocPage(content, descriptor, body, { tag: 'ui-calendar' })

// ── a second specimen with min/max (range constraint demonstration) ───────────────────────────

const rangeSection = exampleSection('Range constraint (min=first of month, max=15th)')

const rangeEl = document.createElement('ui-calendar') as HTMLElement & { min: string; max: string }
rangeEl.setAttribute('value', '2026-07-10')
rangeEl.setAttribute('min', '2026-07-01')
rangeEl.setAttribute('max', '2026-07-15')
rangeSection.append(rangeEl)
content.append(rangeSection)

void el // suppress unused-import lint if el is only used via exampleSection
