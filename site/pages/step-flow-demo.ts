// site/pages/step-flow-demo.ts: the ui-step-flow demo (T-0198; pairs with step-flow-doc.ts, the descriptor-derived
// API page). Mounts the real control over the approved Direction B mockup's booking: five scenes walked on the
// client (dates, guests, room, extras, and a last scene that commits itself, Back on its row), then a short flow
// whose finish action carries the bound draft. Each press is written to an event log.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log/.demo-figure/.demo-grid + section spacing)
import { el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-step-flow: demo',
  intro:
    'The client-side wizard, live: Step n of m over a segmented bar, the control\'s own Back and Next with no ' +
    'agent turn, and Next refused while a scene field is invalid. The API table is on the ui-step-flow API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])
const field = (label: string, control: HTMLElement): HTMLElement => el('ui-field', { label }, [control])

const log = el('ul', { class: 'event-log', 'aria-live': 'polite' })
const record = (name: string) => (event: Event): void => {
  if (event.target !== event.currentTarget && event.type !== 'click') return // a scene field's own change bubbles
  log.prepend(el('li', {}, [text(`${name}: ${event.type} ${JSON.stringify((event as CustomEvent).detail ?? null)}`)]))
}

// ── [1] Concierge: a five-scene booking, the last scene commits itself ─────────────────────────────────────────
const booking = el('ui-step-flow', { style: 'max-inline-size:30rem;' })
Object.assign(booking, { steps: ['Dates', 'Guests', 'Room', 'Extras', 'Confirm'] })
const dates = el('ui-column', { gap: 'sm' }, [
  field('Arrival', el('ui-text-field', { type: 'date', name: 'checkIn', required: '' })),
  field('Departure', el('ui-text-field', { type: 'date', name: 'checkOut', required: '' })),
])
const guests = el('ui-amount-picker', { label: 'Guests', name: 'guests', value: '2', min: '1', max: '8' })
const room = el('ui-radio-group', { name: 'room', required: '' }, [
  el('ui-radio', { value: 'king' }, [text('Deluxe king, $240')]),
  el('ui-radio', { value: 'twin' }, [text('Garden twin, $210')]),
])
const extras = el('ui-column', { gap: 'sm' }, [
  el('ui-checkbox', { name: 'breakfast', checked: '' }, [text('Breakfast')]),
  el('ui-checkbox', { name: 'spa' }, [text('Spa credit')]),
  el('ui-checkbox', { name: 'late' }, [text('Late check-out')]),
])
// The BookingForm shape: a form root in a column, the card above, the md commit Button a direct child at the end
// edge. StepFlow draws Back on the Button's row and never moves the Button.
const commit = el('ui-button', { size: 'md' }, [text('Book stay')])
const confirm = el(
  'ui-form-provider',
  { style: 'display:flex; flex-direction:column; align-items:flex-end; gap:var(--md-sys-widget-gutter);' },
  [
    el('ui-card', { style: 'align-self:stretch;' }, [
      el('ui-card-content', {}, [
        el('ui-column', { gap: 'sm' }, [
          field('Name', el('ui-text-field', { name: 'name', value: 'Ada Lovelace', required: '' })),
          field('Email', el('ui-text-field', { name: 'email', type: 'email', value: 'ada@example.com' })),
        ]),
      ]),
    ]),
    commit,
  ],
)
booking.append(dates, guests, room, extras, confirm)
booking.addEventListener('change', record('Booking'))
commit.addEventListener('click', record('Book stay'))

const bookingNote = el('p', {}, [
  text('Next checks the scene\'s fields and reports the first invalid one: try it on Dates with a field empty. '),
  text('Each move writes '), code('step'), text(' and emits '), code('change'),
  text('. The last scene has no '), code('finishAction'),
  text(', so its own Book stay commits and Back shares that row.'),
])

// ── [2] A finish action carrying the draft ───────────────────────────────────────────────────────────────────
const short = el('ui-step-flow', { style: 'max-inline-size:30rem;' })
Object.assign(short, {
  steps: ['Party', 'Seating'],
  finishAction: { action: 'review_table' },
  finishLabel: 'Review',
  draft: { party: '4', seating: 'window' },
})
short.append(
  el('ui-amount-picker', { label: 'Party size', value: '4', min: '1', max: '12' }),
  el('ui-radio-group', { name: 'seating', value: 'window' }, [
    el('ui-radio', { value: 'window' }, [text('By the window')]),
    el('ui-radio', { value: 'bar' }, [text('At the bar')]),
  ]),
)
short.addEventListener('change', record('Table'))
short.addEventListener('action', record('Table'))
const shortNote = el('p', {}, [
  text('With '), code('finishAction'), text(' set, the last scene shows a '), code('finishLabel'),
  text(' button that emits '), code('action'), text(' with the bound '), code('draft'), text(' in its context.'),
])

const liveBlock = el('div', { style: 'display:flex; flex-direction:column; gap:var(--md-sys-widget-margin);' }, [booking, log])
content.append(
  exampleSection('A five-scene booking, live', liveBlock, bookingNote),
  exampleSection('A finish action with the draft', short, shortNote),
)
